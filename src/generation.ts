import type { Board, EnemyKind } from './types';
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const BOARD_VERSION = 6;
export const BASE_WIDTH = 28,
  BASE_HEIGHT = 18;
/**
 * Board dimensions grow with the sector: barely through sector 100 (×1.3), then steeply, so
 * sector 999 is gigantic (×6, about 168 × 108 cells). Cells keep a minimum on-screen size and
 * the board scrolls instead of shrinking its objects.
 */
export function boardScale(level: number) {
  const slow = 1 + 0.003 * (Math.min(level, 100) - 1);
  return level <= 100 ? slow : slow + 4.7 * Math.pow((level - 100) / 899, 1.5);
}
export function boardSize(level: number) {
  const f = boardScale(level);
  return { width: Math.round(BASE_WIDTH * f), height: Math.round(BASE_HEIGHT * f) };
}
/** Traces run on a lattice three cells apart, so every trace keeps build space beside it. */
const lattice = (from: number, to: number) => {
  const out: number[] = [];
  for (let v = from; v <= to; v += 3) out.push(v);
  return out;
};

/** Entry ports grow with the sector, reaching six by sector 024. */
export function entryCount(level: number) {
  return level < 2 ? 1 : level < 4 ? 2 : level < 7 ? 3 : level < 12 ? 4 : level < 25 ? 5 : 6;
}
/**
 * Power sockets: the only cells that accept a power supply. One early, four by sector 030,
 * then growing with board area so gigantic sectors can host a real power grid (about 108
 * sockets at sector 999).
 */
export function socketCount(level: number) {
  return level < 40 ? Math.min(4, 1 + Math.floor(level / 10)) : Math.round(3 * boardScale(level) ** 2);
}
/**
 * Threat scaling per sector, uncapped. Health compounds so sectors past 100 read as
 * seemingly impossible and sectors past 900 as virtually impossible; armor, speed and
 * breach damage creep so late sectors also demand piercing weapons and sealed routes.
 */
export function threat(level: number) {
  return {
    hp: (1 + Math.log2(level) * 0.45) * Math.pow(1.02, level - 1),
    armor: Math.floor(level / 40),
    speed: Math.min(2, 1 + (level - 1) * 0.004),
    breach: 1 + (level - 1) / 50,
    daemons: 1 + Math.floor(level / 100),
  };
}
/** Route detours, cross-links and blocked density rise slowly, saturating the lattice near sector 350. */
export function routingComplexity(level: number) {
  return {
    waypoints: Math.min(7, 1 + Math.floor(level / 40)),
    links: Math.min(14, Math.floor(level / 25)),
    density: Math.min(0.45, 0.04 + (level - 1) * 0.006),
  };
}

/**
 * Fully procedural board: a random interior core, random edge ports, and routes
 * that wander through seeded lattice waypoints toward the core. Later sectors add
 * ports, longer detours, cross-links between routes, and denser blocked cells.
 */
export function generateBoard(seed: number, level: number): Board {
  const random = rng((seed ^ Math.imul(level, 2654435761)) >>> 0);
  const { width, height } = boardSize(level),
    tiles = Array(width * height).fill(0);
  const COLS = lattice(1, width - 3),
    ROWS = lattice(1, height - 2);
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)];
  const line = (x: number, y: number, xx: number, yy: number) => {
    while (x !== xx || y !== yy) {
      tiles[y * width + x] = 1;
      if (x !== xx) x += Math.sign(xx - x);
      else y += Math.sign(yy - y);
    }
    tiles[y * width + x] = 1;
  };
  const path = (points: number[][]) => {
    for (let i = 1; i < points.length; i++)
      line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  };
  const { waypoints, links, density } = routingComplexity(level);
  const cx = pick(COLS.slice(1, -1)),
    cy = pick(ROWS.slice(1, -1));
  const core = cy * width + cx;
  // Ports sit on lattice rows or columns so the cells beside them along the edge stay free.
  const entries: number[] = [],
    ports: number[][] = [];
  const sides = level < 3 ? ['left', 'right'] : ['left', 'right', 'top', 'bottom'];
  let guard = 0;
  while (entries.length < entryCount(level) && guard++ < 200) {
    const side = pick(sides);
    const x = side === 'left' ? 0 : side === 'right' ? width - 1 : pick(COLS),
      y = side === 'top' ? 0 : side === 'bottom' ? height - 1 : pick(ROWS);
    const cell = y * width + x;
    if (entries.includes(cell) || (x === cx && y === cy)) continue;
    entries.push(cell);
    ports.push([x, y]);
  }
  const step = (list: number[], value: number, target: number) => {
    if (random() < 0.35) return pick(list);
    const i = list.indexOf(value),
      dir = Math.sign(target - value) || (random() < 0.5 ? -1 : 1);
    return list[Math.max(0, Math.min(list.length - 1, i + dir * (1 + Math.floor(random() * 2))))];
  };
  for (const [ex, ey] of ports) {
    const start =
      ex === 0
        ? [COLS[0], ey]
        : ex === width - 1
          ? [COLS[COLS.length - 1], ey]
          : ey === 0
            ? [ex, ROWS[0]]
            : [ex, ROWS[ROWS.length - 1]];
    const points = [[ex, ey], start];
    let [x, y] = start;
    for (let i = 0; i < waypoints; i++) {
      x = step(COLS, x, cx);
      y = step(ROWS, y, cy);
      points.push([x, y]);
    }
    points.push([cx, cy]);
    path(points);
  }
  // Cross-links join existing lattice nodes, creating loops and shortcuts.
  const nodes = () => COLS.flatMap((x) => ROWS.filter((y) => tiles[y * width + x] === 1).map((y) => [x, y]));
  for (let i = 0; i < links; i++) {
    const list = nodes(),
      a = pick(list),
      b = pick(list);
    if (a !== b) path([a, b]);
  }

  // Keep a usable firing position beside every trace, then progressively constrain build space.
  const reserved = new Set<number>();
  for (let cell = 0; cell < tiles.length; cell++) {
    if (tiles[cell] !== 1) continue;
    const sites = neighbors(cell, width, height).filter((n) => tiles[n] === 0);
    if (sites.length) reserved.add(sites[Math.floor(random() * sites.length)]);
  }
  for (let cell = 0; cell < tiles.length; cell++) {
    if (tiles[cell] === 0 && !reserved.has(cell) && random() < density) tiles[cell] = 2;
  }
  // Power sockets sit on free substrate away from the core, so supplies never take the best firing cells.
  const far = (cell: number, min: number) =>
    Math.abs((cell % width) - cx) + Math.abs(Math.floor(cell / width) - cy) >= min;
  for (const min of [7, 4, 0]) {
    let candidates = tiles.map((t, i) => i).filter((i) => tiles[i] === 0 && !reserved.has(i) && far(i, min));
    while (candidates.length && tiles.filter((t) => t === 3).length < socketCount(level)) {
      const cell = pick(candidates);
      tiles[cell] = 3;
      candidates = candidates.filter((i) => i !== cell);
    }
    if (tiles.filter((t) => t === 3).length >= socketCount(level)) break;
  }
  return { width, height, tiles, entries, core, seed, level, version: BOARD_VERSION };
}
export function neighbors(cell: number, w: number, h: number) {
  const x = cell % w,
    y = Math.floor(cell / w);
  return [
    x > 0 ? cell - 1 : -1,
    x < w - 1 ? cell + 1 : -1,
    y > 0 ? cell - w : -1,
    y < h - 1 ? cell + w : -1,
  ].filter((n) => n >= 0);
}
export function distances(board: Board, blocked = new Set<number>()) {
  const d = new Int32Array(board.tiles.length).fill(-1),
    queue = [board.core];
  d[board.core] = 0;
  for (let i = 0; i < queue.length; i++)
    for (const n of neighbors(queue[i], board.width, board.height))
      if (board.tiles[n] === 1 && d[n] < 0 && !blocked.has(n)) {
        d[n] = d[queue[i]] + 1;
        queue.push(n);
      }
  return d;
}
export function validBoard(board: Board) {
  const d = distances(board);
  return board.entries.every((e) => d[e] > 0) && board.tiles.filter((t) => t === 0).length > 30;
}
export function encounter(level: number, wave: number, seed: number) {
  const random = rng(seed + wave * 997);
  const total = Math.min(1e12, Math.floor((24 + wave * 10) * Math.pow(1.28, level - 1)));
  const kinds: EnemyKind[] = ['virus'];
  if (wave >= 2 || level >= 2) kinds.push('runner');
  if (wave >= 3 || level >= 3) kinds.push('armored');
  if (level >= 4) kinds.push('rootkit');
  if (wave >= 2) kinds.push('swarm');
  if (wave >= 3) kinds.push('leech');
  if (wave >= 4) kinds.push('glitch');
  if (wave >= 5 || level >= 3) kinds.push('sentinel');
  const duration = 540 + wave * 70 + Math.min(level, 100) * 8;
  return {
    total,
    duration,
    kinds,
    boss: wave === 5,
    daemons: wave === 5 ? threat(level).daemons : 0,
    seed: Math.floor(random() * 2 ** 32),
  };
}
