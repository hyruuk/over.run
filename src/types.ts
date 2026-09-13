export type TowerKind =
  | 'cannon'
  | 'mortar'
  | 'slow'
  | 'arc'
  | 'laser'
  | 'gate'
  | 'scatter'
  | 'pulse'
  | 'rail'
  | 'shredder'
  | 'reactor';
export type EnemyKind =
  'virus' | 'runner' | 'armored' | 'rootkit' | 'boss' | 'swarm' | 'leech' | 'sentinel' | 'glitch';
export type Target = 'first' | 'strongest' | 'cluster';
export type Sensor = 'pressure' | 'heat' | 'nearby' | 'integrity' | 'time';
export type Action = 'open' | 'close' | 'overclock' | 'first' | 'strongest' | 'cluster' | 'purge' | 'vent';
export interface Rule {
  id: string;
  sensor: Sensor;
  compare: 'above' | 'below';
  value: number;
  target: string;
  action: Action;
  repeat: number;
  enabled: boolean;
}
/** Tile values: 0 substrate, 1 trace, 2 blocked component, 3 power socket. */
export interface Board {
  width: number;
  height: number;
  tiles: number[];
  entries: number[];
  core: number;
  seed: number;
  level: number;
  version: 1 | 2 | 3 | 4 | 5 | 6;
}
export interface Tower {
  id: string;
  kind: TowerKind;
  cell: number;
  level: number;
  closed: boolean;
  target: Target;
  spent: number;
}
export interface Attempt {
  id: string;
  level: number;
  seed: number;
  board: Board;
  wave: number;
  core: number;
  credits: number;
  towers: Tower[];
  rules: Rule[];
  perks: string[];
  research: string[];
  /** Run-wide choices frozen at attempt start, like research. */
  traits: string[];
  scars: string[];
  /** True on the sector's first clear attempt; farm attempts pay diminishing rewards. */
  frontier: boolean;
  farmed: number;
  kills: number;
  phase: 'prepare' | 'reward';
  offers: string[];
}
export interface Profile {
  version: 1;
  revision: number;
  seed: number;
  research: string;
  unlocked: number;
  nodes: string[];
  attempts: number;
  victories: number;
  kills: number;
  boards: Record<string, Board>;
  active: Attempt | null;
  lastReceipt: string;
  bankedCredits?: number | null;
  /** Permanent run choices: one trait per frontier sector cleared. */
  traits: string[];
  /** Pending trait draft after a frontier clear; empty when nothing is owed. */
  traitOffers: string[];
  /** Daemon scars inflicted on the core: permanent maluses for the run. */
  scars: string[];
  /** Attempts started on already-cleared sectors, per sector; drives farm decay. */
  farmed: Record<string, number>;
  settings: {
    reducedMotion: boolean;
    sound: boolean;
    music?: boolean;
    devMode?: boolean;
    /** Legacy single fader; music and effects now have their own. */
    volume: number;
    musicVolume?: number;
    effectsVolume?: number;
    quality: 'high' | 'low';
    /** 'auto' rotates genres per sector; otherwise a fixed genre id. */
    musicGenre?: string;
    /** Rerolls the arrangement for the current sector; each increment picks new patterns. */
    musicVariant?: number;
    /** Tutorial progress: step index, 99 when finished or skipped, undefined before it is started. */
    tutorial?: number;
    /** A pasted track code that locks the music to one score until the music is reset. */
    musicCode?: string;
  };
  onboarded: boolean;
}
export interface HealthBand {
  hp: number;
  count: number;
}
export interface Enemy {
  id: number;
  kind: EnemyKind;
  cell: number;
  next: number;
  progress: number;
  bands: HealthBand[];
  maxHp: number;
  speed: number;
}
export interface TowerState extends Tower {
  heat: number;
  overheated: boolean;
  ventCooldown: number;
  cooldown: number;
  boost: number;
  ability: number;
  pressure: number;
  failed: boolean;
  /** Ticks remaining without power after a supply trip. */
  offline: number;
  damage: number;
  kills: number;
  shots: number;
  idle: number;
}
export interface LogEvent {
  tick: number;
  type: string;
  text: string;
  cell?: number;
}
export interface Diagnostics {
  kills: number;
  breaches: number;
  earned: number;
  events: LogEvent[];
  rules: Record<string, { fired: number; blocked: number }>;
  pressurePeak: number;
  /** Scars inflicted during this attack, in order. */
  scars: string[];
}
export interface Shot {
  from: number;
  x: number;
  y: number;
  kind: TowerKind;
}
export type BurstKind = 'explosion' | 'short' | 'surge' | 'trip';
/** A simulation event with a position and radius, drawn by the renderer. */
export interface Burst {
  x: number;
  y: number;
  kind: BurstKind;
  radius: number;
}
export interface Snapshot {
  tick: number;
  core: number;
  alive: number;
  records: number;
  spawned: number;
  total: number;
  credits: number;
  enemies: Float32Array;
  towers: TowerState[];
  shots: Shot[];
  bursts: Burst[];
  diagnostics: Diagnostics;
  done: boolean;
  won: boolean;
}
