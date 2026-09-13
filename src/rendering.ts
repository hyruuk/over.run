import { ENEMIES, TOWERS, towerRange } from './content';
import { neighbors } from './generation';
import { placementTiles } from './model';
import type { Attempt, EnemyKind, Snapshot, TowerKind } from './types';
import {
  ATLAS_COLUMNS,
  CHIP,
  CORE,
  ENEMY_ART,
  GATE_CLOSED,
  GATE_OPEN,
  PORT,
  TOWER_BASE,
  TOWER_HEAD,
  bucket,
  buildEnemyAtlas,
  rasterise,
} from './art';
import { paintSubstrate, textureLibrary } from './substrate';
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];
class VirusLayer {
  gl: WebGL2RenderingContext | null;
  program?: WebGLProgram;
  buffer?: WebGLBuffer;
  position?: WebGLUniformLocation | null;
  size?: WebGLUniformLocation | null;
  ready?: WebGLUniformLocation | null;
  atlas?: WebGLTexture;
  atlasReady = false;
  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false });
    const gl = this.gl;
    if (!gl) return;
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'Shader failed');
      return s;
    };
    this.program = gl.createProgram()!;
    gl.attachShader(
      this.program,
      shader(
        gl.VERTEX_SHADER,
        `#version 300 es
      in vec2 aPosition; in vec3 aColor; in float aSize; in float aKind; flat out int kind; uniform vec2 uBoard; uniform float uSize; out vec3 color;
      void main(){gl_Position=vec4((aPosition+0.5)/uBoard*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);gl_PointSize=aSize*uSize;color=aColor;kind=int(aKind);}`,
      ),
    );
    gl.attachShader(
      this.program,
      shader(
        gl.FRAGMENT_SHADER,
        `#version 300 es
      precision mediump float; in vec3 color; flat in int kind; out vec4 outColor;
      uniform sampler2D uAtlas; uniform float uReady;
      void main(){
        vec2 q=gl_PointCoord;
        if(uReady<.5){ if(length(q-.5)>.36)discard; outColor=vec4(color*.9,1.); return; }
        vec2 cell=vec2(float(kind%${ATLAS_COLUMNS}),float(kind/${ATLAS_COLUMNS}));
        vec4 t=texture(uAtlas,(cell+q)/vec2(${ATLAS_COLUMNS}.,${Math.ceil(ENEMY_KINDS.length / ATLAS_COLUMNS)}.));
        if(t.a<.03)discard;
        float lum=t.r; float boost=lum>.95?1.35:1.;
        outColor=vec4(min(color*lum*boost,vec3(1.)),t.a);
      }`,
      ),
    );
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Renderer link failed');
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    let offset = 0;
    for (const [name, n] of [
      ['aPosition', 2],
      ['aColor', 3],
      ['aSize', 1],
      ['aKind', 1],
    ] as const) {
      const loc = gl.getAttribLocation(this.program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 28, offset);
      offset += n * 4;
    }
    this.position = gl.getUniformLocation(this.program, 'uBoard');
    this.size = gl.getUniformLocation(this.program, 'uSize');
    this.ready = gl.getUniformLocation(this.program, 'uReady');
    gl.uniform1i(gl.getUniformLocation(this.program, 'uAtlas'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.atlas = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    void buildEnemyAtlas(ENEMY_KINDS)
      .then((canvas) => {
        if (!this.gl || gl.isContextLost()) return;
        gl.bindTexture(gl.TEXTURE_2D, this.atlas!);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.atlasReady = true;
      })
      .catch(() => {
        this.atlasReady = false;
      });
  }
  draw(data: Float32Array, width: number, height: number, quality: string) {
    const gl = this.gl;
    if (!gl) return;
    const vertices: number[] = [],
      colors = Object.values(ENEMIES).map((e) => rgb(e.color));
    const max = quality === 'low' ? 2500 : 10000;
    const cellPx = this.canvas.width / width,
      largest = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] / cellPx;
    for (let i = 0; i < data.length && vertices.length / 7 < max; i += 5) {
      const count = data[i + 3];
      const copies = Math.min(count, quality === 'low' ? 2 : 8);
      for (let j = 0; j < copies && vertices.length / 7 < max; j++)
        vertices.push(
          data[i] + (j ? Math.sin(j * 2.4 + i) * 0.27 : 0),
          data[i + 1] + (j ? Math.cos(j * 2.4 + i) * 0.27 : 0),
          ...colors[data[i + 2]],
          Math.min(
            largest,
            ENEMY_KINDS[data[i + 2]] === 'boss' ? 1.45 : 0.68 + Math.min(0.22, Math.log10(count + 1) * 0.06),
          ),
          data[i + 2],
        );
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program!);
    gl.uniform2f(this.position!, width, height);
    gl.uniform1f(this.size!, cellPx);
    gl.uniform1f(this.ready!, this.atlasReady ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas!);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer!);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, vertices.length / 7);
  }
  destroy() {
    if (this.gl) {
      this.gl.deleteBuffer(this.buffer!);
      this.gl.deleteTexture(this.atlas!);
      this.gl.deleteProgram(this.program!);
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
}
export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private gpu: VirusLayer;
  private observer: ResizeObserver;
  private substrate = document.createElement('canvas');
  private substrateKey = '';
  private library = textureLibrary();
  private frame = 0;
  private last = 0;
  hover = -1;
  selected = '';
  tool: TowerKind | null = null;
  snapshot: Snapshot | null = null;
  reducedMotion = false;
  quality = 'high';
  private effects: { from: number; x: number; y: number; kind: TowerKind; born: number }[] = [];
  private bursts: { x: number; y: number; kind: string; radius: number; born: number }[] = [];
  readonly mode: string;
  constructor(
    readonly container: HTMLElement,
    readonly attempt: Attempt,
    readonly onCell: (cell: number) => void,
  ) {
    container.innerHTML =
      '<canvas class="board-base" aria-label="Circuit board. Use arrow keys to select a grid cell and Enter to build or inspect." tabindex="0" role="application"></canvas><canvas class="board-viruses" aria-hidden="true"></canvas>';
    const base = container.querySelector<HTMLCanvasElement>('.board-base')!;
    this.ctx = base.getContext('2d')!;
    this.gpu = new VirusLayer(container.querySelector('.board-viruses')!);
    this.mode = this.gpu.gl ? 'WebGL2' : 'Canvas2D';
    const point = (e: PointerEvent) => {
      const r = base.getBoundingClientRect();
      return (
        Math.min(
          attempt.board.height - 1,
          Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * attempt.board.height)),
        ) *
          attempt.board.width +
        Math.min(
          attempt.board.width - 1,
          Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * attempt.board.width)),
        )
      );
    };
    base.onpointermove = (e) => {
      this.hover = point(e);
    };
    base.onpointerleave = () => {
      this.hover = -1;
    };
    base.onclick = (e) => this.onCell(point(e as PointerEvent));
    base.onkeydown = (e) => {
      const { width, height } = attempt.board;
      const old = Math.max(0, this.hover),
        x = old % width,
        y = Math.floor(old / width);
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        this.hover =
          e.key === 'ArrowLeft'
            ? y * width + Math.max(0, x - 1)
            : e.key === 'ArrowRight'
              ? y * width + Math.min(width - 1, x + 1)
              : e.key === 'ArrowUp'
                ? Math.max(0, y - 1) * width + x
                : Math.min(height - 1, y + 1) * width + x;
        base.setAttribute(
          'aria-label',
          `Circuit board. Column ${(this.hover % width) + 1}, row ${Math.floor(this.hover / width) + 1}. Enter to build or inspect.`,
        );
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onCell(old);
      }
    };
    // Cells never shrink below MIN_CELL css pixels: a gigantic board scrolls inside the panel
    // instead of shrinking its installations and viruses out of sight.
    const MIN_CELL = 18;
    const { width: bw, height: bh } = attempt.board;
    let sized = '';
    this.observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      if (!rect.width) return;
      const fit = rect.width / bw;
      const cell = Math.max(MIN_CELL, fit),
        oversized = cell > fit + 0.01;
      const cssW = Math.round(cell * bw),
        cssH = Math.round(cell * bh);
      const dpr = Math.min(2, devicePixelRatio, 8192 / cssW, 8192 / cssH);
      const key = `${cssW}x${cssH}@${dpr}`;
      if (key === sized) return;
      const first = !sized;
      sized = key;
      container.classList.toggle('oversized', oversized);
      container.style.aspectRatio = oversized ? '28/18' : `${bw}/${bh}`;
      for (const c of [base, this.gpu.canvas]) {
        c.style.width = `${cssW}px`;
        c.style.height = `${cssH}px`;
        c.width = Math.round(cssW * dpr);
        c.height = Math.round(cssH * dpr);
      }
      // A board that scrolls opens centred on the core rather than on its top-left corner.
      if (oversized && first) {
        container.scrollLeft = ((attempt.board.core % bw) + 0.5) * cell - rect.width / 2;
        container.scrollTop = (Math.floor(attempt.board.core / bw) + 0.5) * cell - rect.height / 2;
      }
      this.draw(performance.now());
    });
    this.observer.observe(container);
    const loop = (time: number) => {
      if (time - this.last > (this.reducedMotion ? 100 : 15)) {
        this.draw(time);
        this.last = time;
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }
  update(s: Snapshot) {
    this.snapshot = s;
    if (!this.reducedMotion)
      this.effects.push(...s.shots.slice(0, 40).map((x) => ({ ...x, born: performance.now() })));
    this.effects = this.effects.slice(-80);
    if (!this.reducedMotion)
      this.bursts.push(...s.bursts.slice(0, 20).map((x) => ({ ...x, born: performance.now() })));
    this.bursts = this.bursts.slice(-40);
  }
  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.gpu.destroy();
  }
  private draw(time: number) {
    const c = this.ctx,
      a = this.attempt,
      b = a.board,
      w = c.canvas.width,
      h = c.canvas.height,
      s = w / b.width;
    if (!w || !h) return;
    const xy = (cell: number) => [((cell % b.width) + 0.5) * s, (Math.floor(cell / b.width) + 0.5) * s];
    c.clearRect(0, 0, w, h);
    c.fillStyle = ['#0b1418', '#092b21', '#16213c', '#302016', '#281b34', '#142d30'][(b.level - 1) % 6];
    c.fillRect(0, 0, w, h);
    const substrateKey = `${w}x${h}|${this.library.version}|${this.reducedMotion}`;
    if (substrateKey !== this.substrateKey) {
      this.substrate.width = w;
      this.substrate.height = h;
      paintSubstrate(this.substrate, b, this.library, this.reducedMotion);
      this.substrateKey = substrateKey;
    }
    c.drawImage(this.substrate, 0, 0);
    const blit = (svg: string, color: string, x: number, y: number, size: number, angle = 0) => {
      const img = rasterise(svg, bucket(size), { c: color });
      if (!img) return false;
      if (angle) {
        c.save();
        c.translate(x, y);
        c.rotate(angle);
        c.drawImage(img, -size / 2, -size / 2, size, size);
        c.restore();
      } else c.drawImage(img, x - size / 2, y - size / 2, size, size);
      return true;
    };
    c.lineWidth = 1;
    c.strokeStyle = '#263e3c55';
    for (let x = 0; x <= b.width; x++) {
      c.beginPath();
      c.moveTo(x * s, 0);
      c.lineTo(x * s, h);
      c.stroke();
    }
    for (let y = 0; y <= b.height; y++) {
      c.beginPath();
      c.moveTo(0, y * s);
      c.lineTo(w, y * s);
      c.stroke();
    }
    const segments: number[][] = [],
      pads: number[][] = [];
    for (let cell = 0; cell < b.tiles.length; cell++) {
      const [x, y] = xy(cell);
      if (b.tiles[cell] === 1) {
        const links: number[] = [];
        for (const n of neighbors(cell, b.width, b.height))
          if (b.tiles[n] === 1) {
            links.push(n);
            if (n > cell) segments.push([x, y, ...xy(n)]);
          }
        const bend =
          links.length === 2 &&
          links[0] % b.width !== links[1] % b.width &&
          Math.floor(links[0] / b.width) !== Math.floor(links[1] / b.width);
        if (links.length !== 2 || bend || b.entries.includes(cell) || cell === b.core) pads.push([x, y]);
      } else if (b.tiles[cell] === 2) blit(CHIP, '#4a5c63', x, y, s * 0.98);
      else if (b.tiles[cell] === 3) {
        // Power socket: the only cell that accepts a supply.
        c.save();
        c.strokeStyle = '#76e0ce';
        c.fillStyle = 'rgba(118, 224, 206, 0.08)';
        c.lineWidth = 1.5;
        c.setLineDash([3, 3]);
        c.strokeRect(x - s * 0.36, y - s * 0.36, s * 0.72, s * 0.72);
        c.fillRect(x - s * 0.36, y - s * 0.36, s * 0.72, s * 0.72);
        c.setLineDash([]);
        c.font = `${s * 0.22}px monospace`;
        c.textAlign = 'center';
        c.fillStyle = '#76e0ce';
        c.fillText('PSU', x, y + s * 0.08);
        c.restore();
      }
    }
    const trace = (style: string, width: number, alpha = 1) => {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.globalAlpha = alpha;
      c.beginPath();
      for (const [x, y, xx, yy] of segments) {
        c.moveTo(x, y);
        c.lineTo(xx, yy);
      }
      c.stroke();
      c.globalAlpha = 1;
    };
    c.lineCap = 'round';
    c.lineJoin = 'round';
    trace('#0a1416', s * 0.52, 0.85);
    trace('#213d3c', s * 0.4);
    trace('#2b4d49', s * 0.3);
    trace('#c9a862', Math.max(1, s * 0.045), 0.9);
    trace('#f2dfa6', Math.max(0.5, s * 0.012), 0.5);
    c.lineCap = 'butt';
    for (const [x, y] of pads) {
      c.beginPath();
      c.arc(x, y, s * 0.11, 0, Math.PI * 2);
      c.fillStyle = '#c9a862';
      c.fill();
      c.beginPath();
      c.arc(x, y, s * 0.05, 0, Math.PI * 2);
      c.fillStyle = '#16282a';
      c.fill();
    }
    const selected = a.towers.find((t) => t.id === this.selected);
    const cell = this.tool ? this.hover : (selected?.cell ?? -1);
    const kind = this.tool ?? selected?.kind;
    if (cell >= 0 && kind) {
      const [x, y] = xy(cell);
      const color = TOWERS[kind].color;
      c.strokeStyle = color;
      c.fillStyle = `${color}0b`;
      c.beginPath();
      const tower = this.tool
        ? { kind, level: 1 }
        : (this.snapshot?.towers.find((t) => t.id === selected?.id) ?? selected!);
      c.arc(x, y, towerRange(tower, a) * s, 0, Math.PI * 2);
      c.fill();
      c.setLineDash([4, 6]);
      c.stroke();
      c.setLineDash([]);
    }
    if (this.hover >= 0) {
      const [x, y] = xy(this.hover);
      c.strokeStyle = this.tool
        ? placementTiles(this.tool, a.board, a).includes(a.board.tiles[this.hover])
          ? '#b9f578'
          : '#ed8585'
        : '#748b8d';
      c.lineWidth = 2;
      c.strokeRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4);
    }
    for (const entry of b.entries) {
      const [x, y] = xy(entry);
      const column = entry % b.width;
      const angle =
        column === 0 ? 0 : column === b.width - 1 ? Math.PI : entry < b.width ? Math.PI / 2 : -Math.PI / 2;
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      c.fillStyle = '#ff8b8733';
      c.fillRect(-s / 2, -s * 0.6, s, s * 1.2);
      c.restore();
      if (!blit(PORT, '#f39c95', x, y, s * 1.25, angle)) {
        c.fillStyle = '#f39c95';
        c.font = `bold ${s * 0.36}px monospace`;
        c.fillText('»', x - s * 0.2, y + s * 0.13);
      }
    }
    const [cx, cy] = xy(b.core);
    c.shadowColor = '#b9f578';
    c.shadowBlur = this.reducedMotion ? 0 : s * 0.5;
    if (!blit(CORE, '#b9f578', cx, cy, s * 1.9)) {
      c.fillStyle = '#142522';
      c.fillRect(cx - s * 0.9, cy - s * 0.9, s * 1.8, s * 1.8);
    }
    c.shadowBlur = 0;
    c.textAlign = 'center';
    c.fillStyle = '#d2edbc';
    c.font = `bold ${s * 0.3}px monospace`;
    c.fillText('CORE', cx, cy + s * 0.1);
    c.font = `${s * 0.2}px monospace`;
    c.fillStyle = '#81928b';
    c.fillText('SYS_00', cx, cy + s * 1.35);
    for (const t of this.snapshot?.towers ?? a.towers) {
      const [x, y] = xy(t.cell),
        def = TOWERS[t.kind],
        size = s * 0.98;
      if (!blit(TOWER_BASE[t.kind], def.color, x, y, size)) {
        c.strokeStyle = def.color;
        c.fillStyle = '#122022';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, s * 0.4, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      const headArt = t.kind === 'gate' ? (t.closed ? GATE_CLOSED : GATE_OPEN) : TOWER_HEAD[t.kind];
      if (headArt) {
        const recent =
          t.kind === 'gate' || t.kind === 'slow' || t.kind === 'pulse'
            ? undefined
            : [...this.effects].reverse().find((e) => e.from === t.cell);
        const angle = recent ? Math.atan2((recent.y + 0.5) * s - y, (recent.x + 0.5) * s - x) : 0;
        blit(headArt, def.color, x, y, size, angle);
      }
      if ((t.kind === 'slow' || t.kind === 'pulse') && !this.reducedMotion) {
        c.save();
        c.globalAlpha = 0.18;
        c.strokeStyle = def.color;
        c.lineWidth = s * 0.055;
        c.beginPath();
        c.arc(x, y, (1 + Math.sin(time / 600) * 0.12) * towerRange(t, a) * s, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      c.textAlign = 'center';
      c.fillStyle = def.color;
      c.font = `${s * 0.17}px monospace`;
      c.fillText('▰'.repeat(t.level), x, y + s * 0.66);
      if ('offline' in t && typeof t.offline === 'number' && t.offline > 0) {
        c.fillStyle = '#76e0ce';
        c.font = `${s * 0.2}px monospace`;
        c.textAlign = 'center';
        c.fillText(t.kind === 'reactor' ? 'TRIP' : 'NO PWR', x, y - s * 0.62);
      }
      if ('heat' in t && typeof t.heat === 'number' && t.heat > 5) {
        c.fillStyle = '#ff9d73';
        c.fillRect(x - s * 0.4, y - s * 0.6, (s * 0.8 * t.heat) / 100, 2);
      }
      if (t.id === this.selected) {
        c.strokeStyle = '#f2f9e8';
        c.lineWidth = 2;
        c.strokeRect(x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1);
      }
    }
    this.effects = this.effects.filter((e) => time - e.born < 420);
    for (const effect of this.effects) {
      const [x, y] = xy(effect.from),
        // A worker message can arrive after this frame's RAF timestamp, but before
        // its callback runs. New effects must start at zero, never a negative radius.
        age = Math.max(0, Math.min(1, (time - effect.born) / 420));
      const tx = (effect.x + 0.5) * s,
        ty = (effect.y + 0.5) * s;
      c.globalAlpha = 1 - age;
      c.strokeStyle = c.fillStyle = TOWERS[effect.kind].color;
      c.lineWidth = effect.kind === 'laser' ? s * 0.09 : s * 0.04;
      c.beginPath();
      if (effect.kind === 'pulse') {
        c.arc(x, y, towerRange({ kind: 'pulse', level: 1 }, a) * s * age, 0, Math.PI * 2);
      } else if (effect.kind === 'mortar') {
        const flight = Math.min(1, age * 2);
        if (flight < 1) {
          c.arc(
            x + (tx - x) * flight,
            y + (ty - y) * flight - Math.sin(flight * Math.PI) * s * 1.5,
            s * 0.13,
            0,
            Math.PI * 2,
          );
          c.fill();
        } else c.arc(tx, ty, (age - 0.5) * 3.2 * s, 0, Math.PI * 2);
      } else if (effect.kind === 'arc') {
        c.moveTo(x, y);
        for (let j = 1; j <= 8; j++)
          c.lineTo(
            x + ((tx - x) * j) / 8 + (j < 8 ? Math.sin(j * 17) * s * 0.25 : 0),
            y + ((ty - y) * j) / 8,
          );
      } else if (effect.kind === 'scatter') {
        for (let j = -1; j <= 1; j++) {
          c.moveTo(x, y);
          c.lineTo(tx + j * s * 0.35, ty + j * s * 0.28);
        }
      } else if (effect.kind === 'laser' || effect.kind === 'rail') {
        c.moveTo(x, y);
        c.lineTo(tx, ty);
        c.stroke();
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1;
      } else {
        const travel = Math.min(1, age * 3);
        c.arc(x + (tx - x) * travel, y + (ty - y) * travel, s * 0.09, 0, Math.PI * 2);
        c.fill();
      }
      c.stroke();
    }
    // Simulation bursts: explosions, short-circuits and supply trips draw as expanding rings.
    this.bursts = this.bursts.filter((e) => time - e.born < 700);
    for (const burst of this.bursts) {
      const age = Math.max(0, Math.min(1, (time - burst.born) / 700));
      const bx = (burst.x + 0.5) * s,
        by = (burst.y + 0.5) * s;
      const color =
        burst.kind === 'explosion'
          ? '#ffb76b'
          : burst.kind === 'short'
            ? '#eadc8c'
            : burst.kind === 'trip'
              ? '#76e0ce'
              : '#ff92b0';
      c.globalAlpha = (1 - age) * 0.9;
      c.strokeStyle = c.fillStyle = color;
      c.lineWidth = s * 0.08;
      c.beginPath();
      c.arc(bx, by, burst.radius * s * (0.3 + age * 0.7), 0, Math.PI * 2);
      c.stroke();
      if (burst.kind !== 'trip') {
        c.globalAlpha = (1 - age) * 0.25;
        c.fill();
      }
    }
    c.globalAlpha = 1;
    const data = this.snapshot?.enemies ?? new Float32Array();
    this.gpu.draw(data, b.width, b.height, this.quality);
    if (!this.gpu.gl) {
      const defs = Object.values(ENEMIES);
      for (let i = 0; i < Math.min(data.length, 10000); i += 5) {
        const kind = data[i + 2],
          ex = (data[i] + 0.5) * s,
          ey = (data[i + 1] + 0.5) * s,
          size = s * (ENEMY_KINDS[kind] === 'boss' ? 1.45 : 0.72);
        if (!blit(ENEMY_ART[ENEMY_KINDS[kind]], defs[kind].color, ex, ey, size)) {
          c.fillStyle = defs[kind].color;
          c.beginPath();
          c.arc(ex, ey, size * 0.36, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    for (let i = 0; i < data.length; i += 5) {
      if (data[i + 4] < 0.99 || Object.keys(ENEMIES)[data[i + 2]] === 'boss') {
        const ex = (data[i] + 0.5) * s,
          ey = (data[i + 1] - 0.1) * s;
        c.fillStyle = '#101719';
        c.fillRect(ex - s * 0.4, ey, s * 0.8, 3);
        c.fillStyle = Object.values(ENEMIES)[data[i + 2]].color;
        c.fillRect(ex - s * 0.4, ey, s * 0.8 * data[i + 4], 3);
      }
    }
    c.textAlign = 'left';
    c.font = `${s * 0.23}px monospace`;
    c.fillStyle = '#516a6a';
    c.fillText(
      `PCB / ${(a.level - 1).toString().padStart(3, '0')}   ·   ${b.seed.toString(16).toUpperCase()}`,
      s * 0.6,
      h - s * 0.4,
    );
  }
}
