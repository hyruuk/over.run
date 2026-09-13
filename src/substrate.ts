/**
 * Procedural board substrate. Every sector paints its own background from a
 * seeded recipe whose density, palette and damage scale continuously from
 * sector 000 to 999. Raster textures are optional raw material: when present
 * they are tiled, flipped and cropped per seed, never shown as-is.
 */
import { rng } from './generation';
import type { Board } from './types';

export const TEXTURE_FILES = {
  grain: 'textures/grain.webp',
  scratches: 'textures/scratches.webp',
  corrosion: 'textures/corrosion.webp',
  weave: 'textures/weave.webp',
} as const;
/** Whole-board photographs used only as low-opacity detail, cropped and flipped per seed. */
export const PHOTO_FILES = ['textures/board-0.webp', 'textures/board-1.webp', 'textures/board-2.webp'];
export const LAST_SECTOR = 999;

type TextureName = keyof typeof TEXTURE_FILES;

export class TextureLibrary {
  version = 0;
  readonly textures: Partial<Record<TextureName, HTMLImageElement>> = {};
  readonly photos: HTMLImageElement[] = [];
  constructor() {
    for (const [name, file] of Object.entries(TEXTURE_FILES) as [TextureName, string][])
      this.load(file, (img) => (this.textures[name] = img));
    for (const file of PHOTO_FILES) this.load(file, (img) => this.photos.push(img));
  }
  private load(file: string, done: (img: HTMLImageElement) => void) {
    const img = new Image();
    img.onload = () => {
      done(img);
      this.version++;
    };
    img.onerror = () => undefined;
    img.src = file;
  }
}
let shared: TextureLibrary | undefined;
export function textureLibrary(): TextureLibrary {
  return (shared ??= new TextureLibrary());
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}
interface Stop {
  t: number;
  mask: Hsl;
  copper: Hsl;
  silk: Hsl;
}
/** Palette keyframes from a calm teal board to a scorched ember one. Hue may exceed 360 to wrap. */
const STOPS: Stop[] = [
  { t: 0, mask: { h: 172, s: 36, l: 13 }, copper: { h: 42, s: 55, l: 58 }, silk: { h: 80, s: 18, l: 60 } },
  { t: 0.25, mask: { h: 210, s: 44, l: 13 }, copper: { h: 45, s: 8, l: 72 }, silk: { h: 195, s: 30, l: 62 } },
  { t: 0.5, mask: { h: 268, s: 32, l: 11 }, copper: { h: 28, s: 62, l: 55 }, silk: { h: 300, s: 28, l: 58 } },
  {
    t: 0.75,
    mask: { h: 335, s: 38, l: 10 },
    copper: { h: 22, s: 75, l: 50 },
    silk: { h: 350, s: 40, l: 58 },
  },
  { t: 1, mask: { h: 382, s: 22, l: 7 }, copper: { h: 18, s: 85, l: 48 }, silk: { h: 30, s: 60, l: 52 } },
];
const mixHsl = (a: Hsl, b: Hsl, k: number): Hsl => ({
  h: a.h + (b.h - a.h) * k,
  s: a.s + (b.s - a.s) * k,
  l: a.l + (b.l - a.l) * k,
});
const hsl = ({ h, s, l }: Hsl, alpha = 1, dl = 0) =>
  `hsla(${h % 360},${s}%,${Math.max(0, Math.min(100, l + dl))}%,${alpha})`;
const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export interface SectorStyle {
  /** Progress from sector 000 (0) to 999 (1). */
  t: number;
  /** Physical wear, starting around sector 300. */
  damage: number;
  mask: Hsl;
  copper: Hsl;
  silk: Hsl;
  traces: number;
  ghosts: number;
  components: number;
  viaFields: number;
  labels: number;
  /** Overlapping, rule-breaking routing that ignores keep-outs; from about sector 500. */
  chaos: number;
  /** Digital corruption of the painted board itself; from about sector 700. */
  glitch: number;
}

/** Deterministic look for a sector: continuous ramps plus a little per-seed variation. */
export function sectorStyle(level: number, seed: number): SectorStyle {
  const random = rng((seed ^ Math.imul(level, 374761393)) >>> 0);
  const t = Math.max(0, Math.min(1, (level - 1) / LAST_SECTOR));
  const stop = STOPS.findIndex((s, i) => i === STOPS.length - 1 || STOPS[i + 1].t > t);
  const a = STOPS[Math.max(0, Math.min(stop, STOPS.length - 2))],
    b = STOPS[Math.max(0, Math.min(stop, STOPS.length - 2)) + 1],
    k = (t - a.t) / (b.t - a.t);
  const jitter = (random() - 0.5) * 16;
  const mask = mixHsl(a.mask, b.mask, k);
  mask.h += jitter;
  mask.l += (random() - 0.5) * 2;
  const copper = mixHsl(a.copper, b.copper, k),
    silk = mixHsl(a.silk, b.silk, k);
  silk.h += jitter;
  const vary = () => 0.8 + random() * 0.4,
    tt = t * t;
  return {
    t,
    damage: smooth(0.25, 0.9, t),
    mask,
    copper,
    silk,
    traces: Math.round((45 + 110 * t + 320 * tt) * vary()),
    ghosts: t < 0.12 ? 0 : Math.round((3 + 14 * t + 40 * tt) * vary()),
    components: Math.round((16 + 60 * t + 140 * tt) * vary()),
    viaFields: Math.round((4 + 14 * t + 30 * tt) * vary()),
    labels: Math.round((6 + 40 * t + 80 * tt) * vary()),
    chaos: smooth(0.5, 1, t),
    glitch: smooth(0.7, 1, t),
  };
}

/** Tile an image 2×2 mirrored so any texture becomes seamless, then return a pattern. */
function seamless(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scale: number): CanvasPattern | null {
  const tile = document.createElement('canvas');
  const w = Math.max(1, Math.round(img.naturalWidth * scale)),
    h = Math.max(1, Math.round(img.naturalHeight * scale));
  tile.width = w * 2;
  tile.height = h * 2;
  const t = tile.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    t.save();
    t.translate(i % 2 ? w * 2 : 0, i > 1 ? h * 2 : 0);
    t.scale(i % 2 ? -1 : 1, i > 1 ? -1 : 1);
    t.drawImage(img, 0, 0, w, h);
    t.restore();
  }
  return ctx.createPattern(tile, 'repeat');
}

/** Paint the substrate for a board into a canvas of the given device-pixel size. */
export function paintSubstrate(
  canvas: HTMLCanvasElement,
  board: Board,
  library: TextureLibrary,
  reducedMotion = false,
): void {
  const c = canvas.getContext('2d')!,
    w = canvas.width,
    h = canvas.height,
    s = w / board.width,
    style = sectorStyle(board.level, board.seed),
    random = rng((board.seed ^ Math.imul(board.level, 2246822519)) >>> 0),
    { mask, copper, silk, damage, t, chaos, glitch } = style;
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)];
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';

  // 1. Solder mask with broad tonal variation.
  c.fillStyle = hsl(mask);
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const x = random() * w,
      y = random() * h,
      r = (0.25 + random() * 0.4) * w;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hsl(mask, 0.5, (random() - 0.4) * 5));
    g.addColorStop(1, hsl(mask, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  // 2. Optional photographic detail, cropped and flipped per seed, never shown as-is.
  if (library.photos.length) {
    const photo = pick(library.photos),
      zoom = 1.1 + random() * 0.6,
      pw = photo.naturalWidth / zoom,
      ph = photo.naturalHeight / zoom,
      sx = random() * (photo.naturalWidth - pw),
      sy = random() * (photo.naturalHeight - ph);
    c.save();
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = 0.14 - t * 0.06;
    c.translate(w / 2, h / 2);
    c.scale(random() < 0.5 ? -1 : 1, random() < 0.5 ? -1 : 1);
    const cover = Math.max(w / pw, h / ph);
    c.drawImage(photo, sx, sy, pw, ph, (-pw * cover) / 2, (-ph * cover) / 2, pw * cover, ph * cover);
    c.restore();
  }
  // 3. Surface grain: texture when present, otherwise procedural speckle.
  const grain = library.textures.grain && seamless(c, library.textures.grain, s / 40);
  c.save();
  c.globalCompositeOperation = 'overlay';
  if (grain) {
    c.globalAlpha = 0.3;
    c.fillStyle = grain;
    c.fillRect(0, 0, w, h);
  } else {
    c.globalAlpha = 0.16;
    for (let i = 0; i < w * h * 0.004; i++) {
      c.fillStyle = random() < 0.5 ? '#000' : '#fff';
      c.fillRect(random() * w, random() * h, 1.5, 1.5);
    }
  }
  c.restore();

  // Keep-out grid at half-cell resolution: gameplay traces, entries, and the core stay clear.
  const gw = board.width * 2,
    gh = board.height * 2,
    blocked = new Uint8Array(gw * gh);
  const block = (cx: number, cy: number, radius: number) => {
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++)
        if (x >= 0 && y >= 0 && x < gw && y < gh) blocked[y * gw + x] = 1;
  };
  for (let cell = 0; cell < board.tiles.length; cell++)
    if (board.tiles[cell] !== 0) {
      const x = (cell % board.width) * 2,
        y = Math.floor(cell / board.width) * 2;
      block(x, y, 0);
      block(x + 1, y + 1, 0);
    }
  const core = { x: (board.core % board.width) * 2, y: Math.floor(board.core / board.width) * 2 };
  block(core.x, core.y, 3);
  block(core.x + 1, core.y + 1, 3);
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && !blocked[y * gw + x];
  const px = (x: number) => (x + 0.5) * (s / 2),
    py = (y: number) => (y + 0.5) * (s / 2);

  // 4. Ghost traces from inner layers, visible only through the mask on richer boards.
  /** Manhattan routing with short 45° jogs, the way real boards are laid out. */
  const walk = (length: number, octilinear: boolean, respect: boolean) => {
    let x = Math.floor(random() * gw),
      y = Math.floor(random() * gh);
    if (respect && !free(x, y)) return null;
    const points = [[x, y]];
    let dir = Math.floor(random() * 4) * 2;
    for (let i = 0; i < length; i++) {
      const diagonal = dir % 2 === 1;
      if (diagonal || random() < 0.3) {
        const sign = random() < 0.5 ? 1 : 7;
        const delta = diagonal ? sign : octilinear && random() < 0.65 ? sign : sign === 1 ? 2 : 6;
        dir = (dir + delta) % 8;
      }
      const dx = [1, 1, 0, -1, -1, -1, 0, 1][dir],
        dy = [0, 1, 1, 1, 0, -1, -1, -1][dir];
      const run = dir % 2 ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 5);
      let nx = x,
        ny = y,
        ok = true;
      for (let j = 0; j < run; j++) {
        nx += dx;
        ny += dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || (respect && !free(nx, ny))) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
      x = nx;
      y = ny;
      points.push([x, y]);
    }
    return points.length > 2 ? points : null;
  };
  const stroke = (points: number[][], width: number, colour: string, alpha: number) => {
    c.globalAlpha = alpha;
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))));
    c.stroke();
    c.globalAlpha = 1;
  };
  for (let i = 0; i < style.ghosts; i++) {
    const points = walk(8 + Math.floor(random() * 20), false, false);
    if (points) stroke(points, s * (0.1 + random() * 0.1), hsl(copper, 1, 10), 0.035 + t * 0.03);
  }

  // 5. Hairline copper routing with vias at the ends.
  const via = (x: number, y: number, radius: number, ring = true) => {
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fillStyle = hsl(copper);
    c.fill();
    if (ring) {
      c.beginPath();
      c.arc(x, y, radius * 0.45, 0, Math.PI * 2);
      c.fillStyle = hsl(mask, 1, -4);
      c.fill();
    }
  };
  const occupy = (points: number[][]) => {
    for (const [x, y] of points) blocked[y * gw + x] = 1;
  };
  for (let i = 0; i < style.traces; i++) {
    const points = walk(4 + Math.floor(random() * 22), true, true);
    if (!points) continue;
    stroke(points, Math.max(1, s * 0.035), hsl(copper), 0.75);
    occupy(points);
    if (random() < 0.8) via(px(points[0][0]), py(points[0][1]), s * 0.075);
    if (random() < 0.8) via(px(points[points.length - 1][0]), py(points[points.length - 1][1]), s * 0.075);
    // Bus bundles: parallel copies offset across the first segment's direction.
    if (random() < 0.3 + t * 0.2) {
      const [ax, ay] = points[0],
        [bx, by] = points[1],
        len = Math.hypot(bx - ax, by - ay) || 1,
        nx = (-(by - ay) / len) * s * 0.09,
        ny = ((bx - ax) / len) * s * 0.09;
      const lanes = 1 + Math.floor(random() * 4);
      for (let k = 1; k <= lanes; k++) {
        c.save();
        c.translate(nx * k, ny * k);
        stroke(points, Math.max(1, s * 0.035), hsl(copper), 0.55);
        c.restore();
      }
    }
  }
  // 5b. Chaos routing: extra layers that ignore keep-outs and cross everything, in shifted hues.
  for (let i = 0; i < Math.round(chaos * 220); i++) {
    const points = walk(6 + Math.floor(random() * 30), true, false);
    if (!points) continue;
    const layer = random();
    stroke(
      points,
      Math.max(1, s * (0.025 + random() * 0.04)),
      hsl({ h: copper.h + (layer < 0.5 ? 150 : -40), s: 70, l: 55 }),
      0.18 + chaos * 0.35,
    );
    if (random() < 0.5) via(px(points[0][0]), py(points[0][1]), s * 0.06);
  }
  // 6. Via fields: rows of plated holes near traces and around chips.
  for (let i = 0; i < style.viaFields; i++) {
    const x = Math.floor(random() * gw),
      y = Math.floor(random() * gh),
      cols = 2 + Math.floor(random() * 4),
      rows = 1 + Math.floor(random() * 3);
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) if (free(x + q, y + r)) via(px(x + q), py(y + r), s * 0.07);
  }

  // 7. Surface-mount components and silkscreen designators.
  const silkColour = hsl(silk, 0.55),
    pad = hsl({ h: 40, s: 8, l: 74 }),
    prefixes = ['R', 'C', 'L', 'D', 'U', 'Q', 'J', 'TP'];
  c.font = `${Math.max(6, s * 0.17)}px monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let labels = 0;
  for (let i = 0; i < style.components; i++) {
    const kind = random(),
      cw = kind < 0.55 ? 2 : kind < 0.8 ? 3 : 4,
      ch = kind < 0.55 ? 1 : kind < 0.8 ? 2 : 3,
      x = Math.floor(random() * (gw - cw)),
      y = Math.floor(random() * (gh - ch)),
      horizontal = random() < 0.5;
    const fw = horizontal ? cw : ch,
      fh = horizontal ? ch : cw;
    let ok = true;
    for (let yy = y; yy < y + fh && ok; yy++) for (let xx = x; xx < x + fw && ok; xx++) ok = free(xx, yy);
    if (!ok) continue;
    for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) blocked[yy * gw + xx] = 1;
    const x0 = x * (s / 2),
      y0 = y * (s / 2),
      W = fw * (s / 2),
      H = fh * (s / 2),
      inset = s * 0.06;
    if (kind < 0.55) {
      // Two-terminal passive: pads at the ends and a body between.
      const body = kind < 0.3 ? '#1b1b1f' : '#8a6a4a',
        along = horizontal;
      c.fillStyle = pad;
      if (along) {
        c.fillRect(x0 + inset, y0 + inset, W * 0.22, H - inset * 2);
        c.fillRect(x0 + W - inset - W * 0.22, y0 + inset, W * 0.22, H - inset * 2);
        c.fillStyle = body;
        c.fillRect(x0 + W * 0.28, y0 + inset * 1.4, W * 0.44, H - inset * 2.8);
      } else {
        c.fillRect(x0 + inset, y0 + inset, W - inset * 2, H * 0.22);
        c.fillRect(x0 + inset, y0 + H - inset - H * 0.22, W - inset * 2, H * 0.22);
        c.fillStyle = body;
        c.fillRect(x0 + inset * 1.4, y0 + H * 0.28, W - inset * 2.8, H * 0.44);
      }
    } else {
      // Small integrated circuit with pins on the long sides and a pin-one dot.
      c.fillStyle = pad;
      const pins = Math.max(2, Math.floor((horizontal ? W : H) / (s * 0.16)));
      for (let p = 0; p < pins; p++) {
        const k = (p + 0.5) / pins;
        if (horizontal) {
          c.fillRect(x0 + W * k - s * 0.03, y0, s * 0.06, inset * 1.6);
          c.fillRect(x0 + W * k - s * 0.03, y0 + H - inset * 1.6, s * 0.06, inset * 1.6);
        } else {
          c.fillRect(x0, y0 + H * k - s * 0.03, inset * 1.6, s * 0.06);
          c.fillRect(x0 + W - inset * 1.6, y0 + H * k - s * 0.03, inset * 1.6, s * 0.06);
        }
      }
      c.fillStyle = '#15171b';
      c.fillRect(x0 + inset * 1.4, y0 + inset * 1.4, W - inset * 2.8, H - inset * 2.8);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath();
      c.arc(x0 + inset * 2.6, y0 + inset * 2.6, s * 0.03, 0, Math.PI * 2);
      c.fill();
    }
    // Silkscreen outline and a designator label.
    c.strokeStyle = silkColour;
    c.lineWidth = Math.max(0.6, s * 0.012);
    c.strokeRect(x0 + inset * 0.5, y0 + inset * 0.5, W - inset, H - inset);
    if (labels < style.labels && random() < 0.7) {
      labels++;
      c.fillStyle = silkColour;
      const above = y > 0 && free(x, y - 1);
      c.fillText(
        `${pick(prefixes)}${1 + Math.floor(random() * 99)}`,
        x0 + W / 2,
        above ? y0 - s * 0.12 : y0 + H + s * 0.12,
      );
    }
  }
  // 8. Fiducials and test points in the remaining free space.
  for (let i = 0; i < 2 + style.labels * 0.3; i++) {
    const x = Math.floor(random() * gw),
      y = Math.floor(random() * gh);
    if (!free(x, y)) continue;
    c.beginPath();
    c.arc(px(x), py(y), s * 0.09, 0, Math.PI * 2);
    c.strokeStyle = silkColour;
    c.lineWidth = Math.max(0.6, s * 0.014);
    c.stroke();
    via(px(x), py(y), s * 0.045, false);
  }

  // 9. Wear: corrosion patches, scorched vias, exposed fibreglass, cracks with an ember glow.
  if (damage > 0) {
    const corrosion = library.textures.corrosion && seamless(c, library.textures.corrosion, s / 60);
    for (let i = 0; i < Math.round(damage * 14); i++) {
      const x = random() * w,
        y = random() * h,
        r = s * (0.4 + random() * 1.4);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${18 + random() * 14},70%,38%,${0.35 * damage})`);
      g.addColorStop(0.6, `hsla(25,60%,30%,${0.18 * damage})`);
      g.addColorStop(1, 'hsla(25,60%,30%,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
      for (let k = 0; k < r * 0.6; k++) {
        const a = random() * Math.PI * 2,
          d = Math.sqrt(random()) * r * 0.85;
        c.fillStyle = random() < 0.5 ? `rgba(20,10,5,${0.5 * damage})` : `rgba(230,120,50,${0.35 * damage})`;
        c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.5, 1.5);
      }
      if (corrosion) {
        c.save();
        c.globalCompositeOperation = 'multiply';
        c.globalAlpha = 0.6 * damage;
        c.beginPath();
        c.arc(x, y, r * 0.8, 0, Math.PI * 2);
        c.clip();
        c.fillStyle = corrosion;
        c.fillRect(x - r, y - r, r * 2, r * 2);
        c.restore();
      }
    }
    for (let i = 0; i < Math.round(damage * 10); i++) {
      const x = random() * w,
        y = random() * h,
        r = s * (0.3 + random() * 0.6);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${0.55 * damage})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const weave = library.textures.weave && seamless(c, library.textures.weave, s / 80);
    for (let i = 0; i < Math.round(smooth(0.55, 1, t) * 6); i++) {
      const x = random() * w,
        y = random() * h,
        r = s * (0.35 + random() * 0.7);
      c.save();
      c.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2,
          rr = r * (0.6 + random() * 0.4);
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      c.closePath();
      c.clip();
      c.globalAlpha = 0.5;
      c.fillStyle = '#3d3b2a';
      c.fillRect(x - r, y - r, r * 2, r * 2);
      if (weave) {
        c.globalAlpha = 0.5;
        c.fillStyle = weave;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      } else {
        c.globalAlpha = 0.25;
        c.strokeStyle = '#7a7858';
        c.lineWidth = 1;
        for (let k = -r * 2; k < r * 2; k += 4) {
          c.beginPath();
          c.moveTo(x + k, y - r);
          c.lineTo(x + k, y + r);
          c.moveTo(x - r, y + k);
          c.lineTo(x + r, y + k);
          c.stroke();
        }
      }
      c.restore();
    }
    const ember = smooth(0.7, 1, t);
    for (let i = 0; i < Math.round(smooth(0.4, 1, t) * 9); i++) {
      let x = random() * w,
        y = random() * h;
      const steps = 6 + Math.floor(random() * 14),
        dir = random() * Math.PI * 2;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < steps; k++) {
        x += Math.cos(dir + (random() - 0.5) * 1.6) * s * (0.2 + random() * 0.5);
        y += Math.sin(dir + (random() - 0.5) * 1.6) * s * (0.2 + random() * 0.5);
        c.lineTo(x, y);
      }
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (ember > 0 && !reducedMotion) {
        c.save();
        c.shadowColor = `rgba(255,110,40,${ember})`;
        c.shadowBlur = s * 0.35 * ember;
        c.strokeStyle = `rgba(255,120,50,${0.5 * ember})`;
        c.lineWidth = Math.max(1, s * 0.04);
        c.stroke();
        c.restore();
      }
      c.strokeStyle = `rgba(5,5,8,${0.75})`;
      c.lineWidth = Math.max(1, s * 0.03);
      c.stroke();
    }
  }
  // 9b. Digital corruption of the board image: sliced strips, colour tearing, inverted blocks, noise.
  if (glitch > 0) {
    const snapshot = document.createElement('canvas');
    snapshot.width = w;
    snapshot.height = h;
    snapshot.getContext('2d')!.drawImage(canvas, 0, 0);
    for (let i = 0; i < Math.round(glitch * 26); i++) {
      const y = random() * h,
        band = s * (0.08 + random() * 0.6),
        shift = (random() - 0.5) * s * 3 * glitch;
      c.drawImage(snapshot, 0, y, w, band, shift, y, w, band);
    }
    c.save();
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = 0.35 * glitch;
    c.drawImage(snapshot, s * 0.12 * glitch, 0);
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.5 * glitch;
    c.drawImage(snapshot, -s * 0.12 * glitch, 0);
    c.restore();
    for (let i = 0; i < Math.round(glitch * 12); i++) {
      const x = random() * w,
        y = random() * h,
        bw = s * (0.5 + random() * 2.5),
        bh = s * (0.15 + random() * 1);
      c.save();
      c.globalCompositeOperation = 'difference';
      c.fillStyle = `rgba(255,255,255,${0.18 + glitch * 0.22})`;
      c.fillRect(x, y, bw, bh);
      c.restore();
    }
    for (let i = 0; i < Math.round(glitch * 8); i++) {
      const x = random() * w,
        y = random() * h,
        bw = s * (0.6 + random() * 2),
        bh = s * (0.2 + random() * 0.8);
      for (let k = 0; k < (bw * bh) / 9; k++) {
        c.fillStyle = random() < 0.5 ? '#000' : random() < 0.7 ? '#fff' : hsl(copper);
        c.fillRect(x + random() * bw, y + random() * bh, 2, 2);
      }
    }
    if (glitch > 0.4) {
      c.save();
      c.globalAlpha = (glitch - 0.4) * 0.4;
      c.fillStyle = '#000';
      for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
      c.restore();
    }
  }
  // 10. Scratches and a soft vignette.
  const scratches = library.textures.scratches && seamless(c, library.textures.scratches, s / 50);
  if (scratches) {
    c.save();
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = 0.08 + damage * 0.2;
    c.translate(w / 2, h / 2);
    c.rotate(random() * Math.PI);
    c.fillStyle = scratches;
    c.fillRect(-w, -h, w * 2, h * 2);
    c.restore();
  }
  const vignette = c.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, w * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, `rgba(0,0,0,${0.22 + damage * 0.15})`);
  c.fillStyle = vignette;
  c.fillRect(0, 0, w, h);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
}
