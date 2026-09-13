/**
 * Vector art for the battlefield. Every sprite is an inline SVG with colour
 * placeholders so the same drawing can be tinted per cohort or per weapon:
 *   {{c}} body colour, {{h}} highlight, {{o}} outline, {{d}} dark fill.
 * Sprites are rasterised on demand into cached canvases (Canvas2D path) or
 * packed into a grayscale atlas that the WebGL point-sprite shader multiplies
 * by the cohort colour.
 */
import type { EnemyKind, TowerKind } from './types';

const OUTLINE = '#0b1416';
const DARK = '#101c20';
const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">';
const tail = '</svg>';

/** Enemy silhouettes. Travel direction is unknown, so designs stay readable at any heading. */
export const ENEMY_ART: Record<EnemyKind, string> = {
  virus: `${head}<g stroke="{{o}}" stroke-width="3" stroke-linejoin="round" fill="{{c}}"><circle cx="13" cy="38" r="8"/><circle cx="25" cy="31" r="9.5"/><circle cx="38" cy="30" r="10.5"/><circle cx="50" cy="34" r="9.5"/></g><path d="M20 27a6 6 0 0 1 7-3M33 25a7 7 0 0 1 8-2" fill="none" stroke="{{h}}" stroke-width="2.4" stroke-linecap="round"/><circle cx="53" cy="32" r="2.4" fill="{{o}}"/>${tail}`,
  runner: `${head}<path d="M8 32h10M4 24h8M6 40h6" stroke="{{c}}" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M22 32 40 14l20 18-20 18z" fill="{{c}}" stroke="{{o}}" stroke-width="3" stroke-linejoin="round"/><path d="M28 32 40 20l12 12" fill="none" stroke="{{h}}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 26 46 32 40 38 34 32z" fill="{{o}}"/>${tail}`,
  armored: `${head}<path d="M32 4 58 16v18c0 12-12 22-26 26C18 56 6 46 6 34V16z" fill="{{c}}" stroke="{{o}}" stroke-width="3" stroke-linejoin="round"/><path d="M32 12v44M12 24h40M16 40h32" stroke="{{o}}" stroke-width="2.5"/><path d="M15 18 32 10l17 8" fill="none" stroke="{{h}}" stroke-width="2.4" stroke-linecap="round"/><g fill="{{o}}"><circle cx="22" cy="31" r="2"/><circle cx="42" cy="31" r="2"/><circle cx="24" cy="47" r="2"/><circle cx="40" cy="47" r="2"/></g>${tail}`,
  rootkit: `${head}<g fill="none" stroke="{{c}}" stroke-width="5" stroke-linecap="round"><path d="M32 32 12 12M32 32 52 12M32 32 12 52M32 32 52 52"/><path d="M12 12 8 20M12 12 20 8M52 12l4 8M52 12l-8-4M12 52l-4-8M12 52l8 4M52 52l4-8M52 52l-8 4"/></g><g fill="none" stroke="{{o}}" stroke-width="1.5" stroke-linecap="round"><path d="M32 32 12 12M32 32 52 12M32 32 12 52M32 32 52 52"/></g><circle cx="32" cy="32" r="11" fill="{{c}}" stroke="{{o}}" stroke-width="3"/><circle cx="32" cy="32" r="5" fill="{{o}}"/><circle cx="29" cy="28" r="2" fill="{{h}}"/>${tail}`,
  boss: `${head}<path d="M32 3 40 15 54 8l-4 15 12 9-12 9 4 15-14-7-8 12-8-12-14 7 4-15L2 32l12-9-4-15 14 7z" fill="{{c}}" stroke="{{o}}" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="32" r="17" fill="{{d}}" stroke="{{o}}" stroke-width="2.5"/><path d="M18 24 26 30l-8 4zM46 24l-8 6 8 4z" fill="{{c}}"/><path d="M22 41c6 6 14 6 20 0" fill="none" stroke="{{c}}" stroke-width="3" stroke-linecap="round"/><path d="M26 41v5M32 43v5M38 41v5" stroke="{{c}}" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="30" r="2.2" fill="{{h}}"/><circle cx="40" cy="30" r="2.2" fill="{{h}}"/>${tail}`,
  swarm: `${head}<g stroke="{{o}}" stroke-width="2.4" stroke-linejoin="round"><g fill="{{c}}"><ellipse cx="20" cy="22" rx="8" ry="6.5"/><ellipse cx="44" cy="26" rx="8" ry="6.5"/><ellipse cx="30" cy="44" rx="8" ry="6.5"/></g></g><g stroke="{{c}}" stroke-width="2.2" stroke-linecap="round"><path d="M12 18l-5-4M12 26l-5 3M28 18l5-4M28 26l5 3M36 22l-5-4M36 30l-5 3M52 22l5-4M52 30l5 3M22 40l-5-4M22 48l-5 3M38 40l5-4M38 48l5 3"/></g><g fill="{{o}}"><circle cx="17" cy="21" r="1.4"/><circle cx="41" cy="25" r="1.4"/><circle cx="27" cy="43" r="1.4"/></g><g fill="{{h}}"><circle cx="23" cy="20" r="1.5"/><circle cx="47" cy="24" r="1.5"/><circle cx="33" cy="42" r="1.5"/></g>${tail}`,
  leech: `${head}<path d="M10 32c0-10 8-14 18-14h14c9 0 14 6 14 14s-5 14-14 14H28C18 46 10 42 10 32z" fill="{{c}}" stroke="{{o}}" stroke-width="3"/><path d="M24 20v24M31 18v28M38 18v28M45 19v26" stroke="{{o}}" stroke-width="2"/><circle cx="14" cy="32" r="6" fill="{{d}}" stroke="{{o}}" stroke-width="2.5"/><circle cx="14" cy="32" r="2.4" fill="{{c}}"/><path d="M28 24c4-2 12-2 16 0" fill="none" stroke="{{h}}" stroke-width="2.4" stroke-linecap="round"/>${tail}`,
  sentinel: `${head}<rect x="7" y="7" width="50" height="50" rx="6" fill="{{c}}" stroke="{{o}}" stroke-width="3"/><path d="M7 20h50M7 44h50M20 7v50M44 7v50" stroke="{{o}}" stroke-width="2"/><g fill="{{o}}"><circle cx="13.5" cy="13.5" r="2.2"/><circle cx="50.5" cy="13.5" r="2.2"/><circle cx="13.5" cy="50.5" r="2.2"/><circle cx="50.5" cy="50.5" r="2.2"/></g><circle cx="32" cy="32" r="10" fill="{{d}}" stroke="{{o}}" stroke-width="2.5"/><circle cx="32" cy="32" r="4.5" fill="{{h}}"/><path d="M12 12h6M46 12h6" stroke="{{h}}" stroke-width="2.4" stroke-linecap="round"/>${tail}`,
  glitch: `${head}<g fill="{{c}}" stroke="{{o}}" stroke-width="2.6" stroke-linejoin="round"><path d="M12 12h30v10H12z"/><path d="M22 24h32v10H22z"/><path d="M8 36h34v10H8z"/><path d="M18 48h28v8H18z"/></g><g fill="{{o}}"><rect x="30" y="15" width="6" height="4"/><rect x="26" y="27" width="10" height="4"/><rect x="14" y="39" width="6" height="4"/><rect x="44" y="39" width="6" height="4"/></g><g fill="{{h}}"><rect x="14" y="14" width="10" height="2.5"/><rect x="40" y="26" width="10" height="2.5"/><rect x="24" y="50" width="8" height="2.5"/></g>${tail}`,
};

/** Shared hexagonal plinth every installation sits on. */
const PLINTH = `<polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" fill="{{d}}" stroke="{{c}}" stroke-width="2.4" stroke-linejoin="round"/><polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="none" stroke="{{c}}" stroke-opacity=".3" stroke-width="1.4"/><g fill="{{c}}" fill-opacity=".7"><circle cx="32" cy="8" r="1.6"/><circle cx="53" cy="20" r="1.6"/><circle cx="53" cy="44" r="1.6"/><circle cx="32" cy="56" r="1.6"/><circle cx="11" cy="44" r="1.6"/><circle cx="11" cy="20" r="1.6"/></g>`;

/** Static base per installation. Gate and reactor are complete without a head. */
export const TOWER_BASE: Record<TowerKind, string> = {
  cannon: `${head}${PLINTH}${tail}`,
  mortar: `${head}${PLINTH}<circle cx="32" cy="32" r="15" fill="none" stroke="{{c}}" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 3"/>${tail}`,
  slow: `${head}${PLINTH}<circle cx="32" cy="32" r="17" fill="none" stroke="{{c}}" stroke-opacity=".35" stroke-width="1.5"/>${tail}`,
  arc: `${head}${PLINTH}<path d="M18 46 32 20l14 26" fill="none" stroke="{{c}}" stroke-opacity=".3" stroke-width="1.5"/>${tail}`,
  laser: `${head}${PLINTH}<path d="M16 20v24M20 20v24" stroke="{{c}}" stroke-opacity=".4" stroke-width="1.5"/>${tail}`,
  scatter: `${head}${PLINTH}${tail}`,
  pulse: `${head}${PLINTH}<rect x="18" y="18" width="28" height="28" rx="6" fill="none" stroke="{{c}}" stroke-opacity=".35" stroke-width="1.5"/>${tail}`,
  rail: `${head}${PLINTH}<path d="M14 26h36M14 38h36" stroke="{{c}}" stroke-opacity=".3" stroke-width="1.5"/>${tail}`,
  shredder: `${head}${PLINTH}${tail}`,
  gate: `${head}<rect x="12" y="6" width="40" height="52" rx="4" fill="{{d}}" stroke="{{c}}" stroke-width="2.4"/><path d="M12 18h40M12 46h40" stroke="{{c}}" stroke-opacity=".5" stroke-width="1.5"/><g fill="{{c}}" fill-opacity=".8"><circle cx="18" cy="12" r="1.6"/><circle cx="46" cy="12" r="1.6"/><circle cx="18" cy="52" r="1.6"/><circle cx="46" cy="52" r="1.6"/></g>${tail}`,
  reactor: `${head}<rect x="6" y="6" width="52" height="52" rx="5" fill="{{d}}" stroke="{{c}}" stroke-width="2.4"/><circle cx="32" cy="32" r="18" fill="none" stroke="{{c}}" stroke-width="2"/><path d="M32 32 32 15A17 17 0 0 1 46 24zM32 32 46 40A17 17 0 0 1 32 49zM32 32 18 40A17 17 0 0 1 18 24z" fill="{{c}}" fill-opacity=".55"/><circle cx="32" cy="32" r="4" fill="{{c}}"/><g fill="{{c}}" fill-opacity=".8"><circle cx="12" cy="12" r="1.8"/><circle cx="52" cy="12" r="1.8"/><circle cx="12" cy="52" r="1.8"/><circle cx="52" cy="52" r="1.8"/></g><path d="M12 22v20" stroke="{{h}}" stroke-width="2" stroke-linecap="round"/>${tail}`,
};

/** Rotating head per weapon, drawn pointing right (+x). Fields have static heads. */
export const TOWER_HEAD: Partial<Record<TowerKind, string>> = {
  cannon: `${head}<rect x="28" y="28" width="30" height="8" rx="2" fill="{{c}}" stroke="{{o}}" stroke-width="2"/><rect x="50" y="26" width="8" height="12" rx="2" fill="{{c}}" stroke="{{o}}" stroke-width="2"/><circle cx="28" cy="32" r="11" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><circle cx="28" cy="32" r="4" fill="{{c}}"/>${tail}`,
  mortar: `${head}<circle cx="30" cy="32" r="15" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><circle cx="30" cy="32" r="9" fill="{{o}}" stroke="{{c}}" stroke-width="2"/><circle cx="30" cy="32" r="4" fill="{{c}}" fill-opacity=".6"/><rect x="42" y="25" width="16" height="14" rx="3" fill="{{c}}" stroke="{{o}}" stroke-width="2"/><path d="M46 28v8M52 28v8" stroke="{{o}}" stroke-width="2"/>${tail}`,
  slow: `${head}<circle cx="32" cy="32" r="14" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><circle cx="32" cy="32" r="8" fill="none" stroke="{{c}}" stroke-width="2"/><path d="M32 22v20M22 32h20M25 25l14 14M39 25 25 39" stroke="{{c}}" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="32" r="3" fill="{{h}}"/>${tail}`,
  arc: `${head}<circle cx="32" cy="32" r="13" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><circle cx="32" cy="32" r="8" fill="none" stroke="{{c}}" stroke-opacity=".5" stroke-width="1.5"/><path d="M29 22l-4 9h6l-4 11 10-14h-6l3-6z" fill="{{h}}" stroke="{{o}}" stroke-width="1.5" stroke-linejoin="round"/><path d="M45 32h13" stroke="{{c}}" stroke-width="4" stroke-linecap="round"/><circle cx="58" cy="32" r="3.5" fill="{{c}}" stroke="{{o}}" stroke-width="1.5"/>${tail}`,
  laser: `${head}<rect x="24" y="29" width="36" height="6" rx="2" fill="{{c}}" stroke="{{o}}" stroke-width="2"/><path d="M34 26v12M39 26v12M44 26v12" stroke="{{c}}" stroke-width="2.5"/><circle cx="58" cy="32" r="4.5" fill="{{h}}" stroke="{{o}}" stroke-width="2"/><circle cx="24" cy="32" r="10" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><circle cx="24" cy="32" r="3.5" fill="{{c}}"/>${tail}`,
  scatter: `${head}<g fill="{{c}}" stroke="{{o}}" stroke-width="2"><path d="M30 30h26v5H30z" transform="rotate(-22 30 32)"/><path d="M30 30h26v5H30z" transform="rotate(22 30 32)"/><rect x="30" y="29.5" width="28" height="6" rx="2"/></g><circle cx="29" cy="32" r="11" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><path d="M24 28h10M24 32h10M24 36h10" stroke="{{c}}" stroke-width="2" stroke-linecap="round"/>${tail}`,
  pulse: `${head}<rect x="18" y="18" width="28" height="28" rx="7" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><rect x="25" y="25" width="14" height="14" rx="3" fill="none" stroke="{{c}}" stroke-width="2"/><circle cx="32" cy="32" r="3.5" fill="{{h}}"/><path d="M18 26h-6M18 38h-6M46 26h6M46 38h6M26 18v-6M38 18v-6M26 46v6M38 46v6" stroke="{{c}}" stroke-width="2.5" stroke-linecap="round"/>${tail}`,
  rail: `${head}<g fill="{{c}}" stroke="{{o}}" stroke-width="2"><rect x="22" y="24" width="38" height="5" rx="1.5"/><rect x="22" y="35" width="38" height="5" rx="1.5"/></g><path d="M34 29v6M44 29v6M54 29v6" stroke="{{c}}" stroke-width="3"/><circle cx="24" cy="32" r="10" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><circle cx="24" cy="32" r="4" fill="{{h}}"/>${tail}`,
  shredder: `${head}<g fill="{{c}}" stroke="{{o}}" stroke-width="2"><rect x="30" y="22" width="28" height="7" rx="2"/><rect x="30" y="35" width="28" height="7" rx="2"/></g><path d="M40 22v7M48 22v7M40 35v7M48 35v7" stroke="{{o}}" stroke-width="1.8"/><circle cx="28" cy="32" r="12" fill="{{d}}" stroke="{{c}}" stroke-width="2.6"/><g fill="{{c}}"><circle cx="28" cy="25" r="2.2"/><circle cx="34" cy="28.5" r="2.2"/><circle cx="34" cy="35.5" r="2.2"/><circle cx="28" cy="39" r="2.2"/><circle cx="22" cy="35.5" r="2.2"/><circle cx="22" cy="28.5" r="2.2"/></g><circle cx="28" cy="32" r="2.5" fill="{{h}}"/>${tail}`,
};

/** Gate bars, drawn over the gate base. */
export const GATE_CLOSED = `${head}<g fill="{{c}}" stroke="{{o}}" stroke-width="1.8"><rect x="17" y="21" width="30" height="5" rx="1.5"/><rect x="17" y="29.5" width="30" height="5" rx="1.5"/><rect x="17" y="38" width="30" height="5" rx="1.5"/></g><circle cx="32" cy="32" r="3" fill="{{h}}"/>${tail}`;
export const GATE_OPEN = `${head}<g fill="{{c}}" stroke="{{o}}" stroke-width="1.8"><rect x="17" y="21" width="9" height="5" rx="1.5"/><rect x="38" y="21" width="9" height="5" rx="1.5"/><rect x="17" y="29.5" width="9" height="5" rx="1.5"/><rect x="38" y="29.5" width="9" height="5" rx="1.5"/><rect x="17" y="38" width="9" height="5" rx="1.5"/><rect x="38" y="38" width="9" height="5" rx="1.5"/></g><path d="M29 32h6" stroke="{{c}}" stroke-opacity=".6" stroke-width="2" stroke-dasharray="1.5 1.5"/>${tail}`;

/** Two-cell processor package that hosts the core. Label text is drawn by the renderer. */
export const CORE = `${head}<rect x="4" y="4" width="56" height="56" rx="3" fill="{{d}}" stroke="{{c}}" stroke-width="2"/><g stroke="{{c}}" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round"><path d="M0 14h4M0 20h4M0 26h4M0 32h4M0 38h4M0 44h4M0 50h4M60 14h4M60 20h4M60 26h4M60 32h4M60 38h4M60 44h4M60 50h4M14 0v4M20 0v4M26 0v4M32 0v4M38 0v4M44 0v4M50 0v4M14 60v4M20 60v4M26 60v4M32 60v4M38 60v4M44 60v4M50 60v4"/></g><rect x="14" y="14" width="36" height="36" rx="2" fill="{{o}}" stroke="{{c}}" stroke-opacity=".6" stroke-width="1.5"/><path d="M14 22h36M14 42h36M22 14v36M42 14v36" stroke="{{c}}" stroke-opacity=".18" stroke-width="1"/><circle cx="9" cy="9" r="1.8" fill="{{c}}"/>${tail}`;

/** Trace entry port on the board edge, opening toward +x. */
export const PORT = `${head}<rect x="2" y="8" width="44" height="48" rx="4" fill="{{d}}" stroke="{{c}}" stroke-width="2.4"/><rect x="10" y="20" width="22" height="24" rx="2" fill="{{o}}" stroke="{{c}}" stroke-opacity=".6" stroke-width="1.5"/><path d="M15 26l6 6-6 6M23 26l6 6-6 6" fill="none" stroke="{{h}}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 20h16M46 32h16M46 44h16" stroke="{{c}}" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/><g fill="{{c}}" fill-opacity=".8"><circle cx="8" cy="14" r="1.6"/><circle cx="8" cy="50" r="1.6"/></g>${tail}`;

/** Surface-mount package occupying a blocked cell. */
export const CHIP = `${head}<g stroke="{{c}}" stroke-width="2.4" stroke-linecap="round"><path d="M8 20h8M8 28h8M8 36h8M8 44h8M48 20h8M48 28h8M48 36h8M48 44h8"/></g><rect x="16" y="12" width="32" height="40" rx="2" fill="{{d}}" stroke="{{o}}" stroke-width="2"/><rect x="21" y="17" width="22" height="30" rx="1.5" fill="none" stroke="{{c}}" stroke-opacity=".45" stroke-width="1.2"/><circle cx="23" cy="19.5" r="1.6" fill="{{c}}"/>${tail}`;

export interface Palette {
  c: string;
  h?: string;
  o?: string;
  d?: string;
}

export function lighten(hex: string, amount = 0.45): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('')}`;
}

function fill(svg: string, palette: Palette): string {
  return svg
    .replaceAll('{{c}}', palette.c)
    .replaceAll('{{h}}', palette.h ?? lighten(palette.c))
    .replaceAll('{{o}}', palette.o ?? OUTLINE)
    .replaceAll('{{d}}', palette.d ?? DARK);
}

const cache = new Map<string, HTMLCanvasElement | null>();
const loaders = new Map<string, Promise<HTMLCanvasElement>>();

/** Rasterise an SVG into a square canvas. Returns null until the image has decoded. */
export function rasterise(svg: string, size: number, palette: Palette): HTMLCanvasElement | null {
  const key = `${size}|${palette.c}|${palette.h ?? ''}|${palette.o ?? ''}|${palette.d ?? ''}|${svg}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  cache.set(key, null);
  void load(fill(svg, palette), size).then((canvas) => cache.set(key, canvas));
  return null;
}

export function load(svg: string, size: number): Promise<HTMLCanvasElement> {
  const key = `${size}|${svg}`;
  let pending = loaders.get(key);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d')!.drawImage(image, 0, 0, size, size);
        resolve(canvas);
      };
      image.onerror = () => reject(new Error('Sprite failed to decode'));
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    loaders.set(key, pending);
  }
  return pending;
}

/** Sprite resolution bucket for a cell size in device pixels, so resizes reuse rasters. */
export function bucket(cell: number): number {
  return Math.min(256, Math.max(48, Math.ceil(cell / 32) * 32));
}

export const ATLAS_COLUMNS = 3;
export const ATLAS_CELL = 96;

/** Grayscale enemy atlas for the GPU layer: white body, near-white highlight, dark outline. */
export function buildEnemyAtlas(kinds: EnemyKind[]): Promise<HTMLCanvasElement> {
  const rows = Math.ceil(kinds.length / ATLAS_COLUMNS);
  const atlas = document.createElement('canvas');
  atlas.width = ATLAS_COLUMNS * ATLAS_CELL;
  atlas.height = rows * ATLAS_CELL;
  const ctx = atlas.getContext('2d')!;
  const pad = 6;
  return Promise.all(
    kinds.map((kind, i) =>
      load(
        fill(ENEMY_ART[kind], { c: '#e2e2e2', h: '#ffffff', o: '#141414', d: '#383838' }),
        ATLAS_CELL - pad * 2,
      ).then((sprite) =>
        ctx.drawImage(
          sprite,
          (i % ATLAS_COLUMNS) * ATLAS_CELL + pad,
          Math.floor(i / ATLAS_COLUMNS) * ATLAS_CELL + pad,
        ),
      ),
    ),
  ).then(() => atlas);
}
