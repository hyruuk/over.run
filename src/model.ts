import {
  RESEARCH,
  PERKS,
  TOWERS,
  TRAITS,
  SCARS,
  maxCore,
  powerCapacity,
  powerUsed,
  powerDraw,
  nodeLevel,
  nodeCost,
  maxLevel,
  isCombat,
  slotLimit,
  traitTier,
  farmMultiplier,
  startingCredits,
  type Loadout,
} from './content';
import { bonus, buildCost, upgradeCost, sellValue, researchAvailable } from './content';
import { BOARD_VERSION, generateBoard, rng } from './generation';
import type { Attempt, Board, Profile, Rule, Snapshot, TowerKind } from './types';
export function freshProfile(seed = Math.floor(Math.random() * 2 ** 32)): Profile {
  return {
    version: 1,
    revision: 0,
    seed,
    research: '0',
    unlocked: 1,
    nodes: [],
    attempts: 0,
    victories: 0,
    kills: 0,
    boards: {},
    active: null,
    lastReceipt: '',
    bankedCredits: null,
    traits: [],
    traitOffers: [],
    scars: [],
    farmed: {},
    settings: {
      reducedMotion: false,
      sound: true,
      music: true,
      volume: 0.6,
      musicVolume: 0.6,
      effectsVolume: 0.6,
      quality: 'high',
    },
    onboarded: false,
  };
}
/** The run-wide rules that apply outside an attempt, or to the next one. */
export const profileLoadout = (p: Profile): Loadout => ({
  research: p.nodes,
  traits: p.traits,
  scars: p.scars,
});
export function startAttempt(profile: Profile, level: number): Attempt {
  if (!Number.isSafeInteger(level) || level < 1 || level > profile.unlocked)
    throw new Error('This sector is locked.');
  if (profile.active) throw new Error('Finish or discard the current attempt first.');
  if (profile.traitOffers.length) throw new Error('Choose a trait before reconnecting.');
  const cached = profile.boards[level];
  const board = cached?.version === BOARD_VERSION ? cached : generateBoard(profile.seed, level);
  profile.boards[level] = board;
  // Board cache is bounded; deterministic generation recovers older unchanged boards.
  const keys = Object.keys(profile.boards);
  if (keys.length > 64) delete profile.boards[keys.find((k) => Number(k) !== level)!];
  profile.attempts++;
  const seed = (profile.seed ^ Math.imul(profile.attempts, 1597334677)) >>> 0;
  const credits = profile.bankedCredits ?? startingCredits(profileLoadout(profile));
  profile.bankedCredits = 0;
  // The frontier is the highest unlocked sector: never cleared, so it pays in full.
  // Every attempt on a cleared sector counts as a farm and pays less than the one before.
  const frontier = level === profile.unlocked;
  const farmed = frontier ? 0 : (profile.farmed[level] ?? 0) + 1;
  if (!frontier) profile.farmed[level] = farmed;
  return (profile.active = {
    id: `${profile.seed}-${profile.attempts}`,
    level,
    seed,
    board,
    wave: 1,
    core: maxCore(profileLoadout(profile)),
    credits,
    towers: [],
    rules: [],
    perks: [],
    research: [...profile.nodes],
    traits: [...profile.traits],
    scars: [...profile.scars],
    frontier,
    farmed,
    kills: 0,
    phase: 'prepare',
    offers: [],
  });
}
/**
 * The tiles a defense may occupy: gates on traces, supplies on sockets (or anywhere with an
 * open-grid trait, and on substrate for boards generated before sockets existed), weapons on substrate.
 */
export const placementTiles = (kind: TowerKind, board: Pick<Board, 'version'>, l: Loadout): number[] =>
  kind === 'gate'
    ? [1]
    : kind === 'reactor'
      ? board.version >= 5
        ? bonus(l, 'openGrid') > 0
          ? [0, 3]
          : [3]
        : [0]
      : [0];
export function build(a: Attempt, kind: TowerKind, cell: number) {
  if (a.phase !== 'prepare') throw new Error('Choose an exploit before building.');
  const def = TOWERS[kind];
  if (!def || (def.unlock && !a.research.includes(def.unlock)))
    throw new Error('Unlock this defense in Research.');
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= a.board.tiles.length ||
    a.towers.some((t) => t.cell === cell)
  )
    throw new Error('This cell is occupied.');
  if (
    !placementTiles(kind, a.board, a).includes(a.board.tiles[cell]) ||
    a.board.entries.includes(cell) ||
    a.board.core === cell
  )
    throw new Error(
      kind === 'gate'
        ? 'Gates must occupy a circuit trace.'
        : kind === 'reactor'
          ? 'Power supplies fit only in a power socket.'
          : 'Place defenses on an empty grid cell beside a trace.',
    );
  const limit = slotLimit(a);
  if (isCombat(kind) && limit && a.towers.filter((t) => isCombat(t.kind)).length >= limit)
    throw new Error(`Your traits allow at most ${limit} combat installations.`);
  const cost = buildCost(kind, a);
  if (a.credits < cost) throw new Error('Insufficient credits.');
  if (powerUsed(a.towers, a) + powerDraw(kind, a) > powerCapacity(a, a.towers))
    throw new Error('Power capacity exceeded.');
  let n = 1;
  while (a.towers.some((t) => t.id === `${def.short}-${n}`)) n++;
  a.towers.push({
    id: `${def.short}-${n}`,
    kind,
    cell,
    level: 1,
    closed: kind === 'gate',
    target: kind === 'laser' ? 'strongest' : kind === 'mortar' ? 'cluster' : 'first',
    spent: cost,
  });
  a.credits -= cost;
}
export function upgrade(a: Attempt, id: string) {
  const t = a.towers.find((t) => t.id === id);
  if (!t || a.phase !== 'prepare') throw new Error('Defense unavailable.');
  const cost = upgradeCost(t, a);
  if (t.level >= maxLevel(t.kind, a)) throw new Error('Maximum upgrade reached.');
  if (a.credits < cost) throw new Error('Insufficient credits.');
  a.credits -= cost;
  t.spent += cost;
  t.level++;
}
export function sell(a: Attempt, id: string) {
  const t = a.towers.find((t) => t.id === id);
  if (!t || a.phase !== 'prepare') return;
  const remaining = a.towers.filter((x) => x.id !== id);
  if (powerUsed(remaining, a) > powerCapacity(a, remaining))
    throw new Error('This supply powers installed defenses. Recycle defenses first.');
  a.credits += sellValue(t, a);
  a.towers = a.towers.filter((t) => t.id !== id);
}
export function buyResearch(p: Profile, id: string) {
  if (p.active) throw new Error('Research is purchased between attempts.');
  const node = RESEARCH.find((n) => n.id === id);
  if (!node || !researchAvailable(node, p.nodes)) throw new Error('Unlock all prerequisite nodes first.');
  const level = nodeLevel(p.nodes, id);
  if (level >= node.levels) throw new Error('This node is fully compiled.');
  const cost = nodeCost(node, level + 1);
  if (BigInt(p.research) < BigInt(cost)) throw new Error('Insufficient research.');
  p.research = (BigInt(p.research) - BigInt(cost)).toString();
  const before = startingCredits(profileLoadout(p));
  p.nodes.push(id);
  if (id === 'analysis-9') p.scars.pop();
  if (p.bankedCredits != null) p.bankedCredits += startingCredits(profileLoadout(p)) - before;
}
export function rewardOffers(a: Attempt) {
  const random = rng(a.seed ^ Math.imul(a.wave, 7919));
  return PERKS.filter(
    (p) =>
      (!p.unlock || a.research.includes(p.unlock)) &&
      (!p.weapons || a.towers.some((t) => p.weapons!.includes(t.kind))) &&
      a.perks.filter((x) => x === p.id).length < 3,
  )
    .map((p) => ({ id: p.id, order: random() }))
    .sort((x, y) => x.order - y.order)
    .slice(0, Math.max(1, 3 + bonus(a, 'offers')))
    .map((x) => x.id);
}
export function chooseReward(a: Attempt, id: string) {
  if (a.phase !== 'reward' || !a.offers.includes(id)) throw new Error('That exploit is not available.');
  a.perks.push(id);
  if (id === 'salvage') a.credits += 100;
  if (id === 'repair') a.core = Math.min(maxCore(a), a.core + 25);
  a.phase = 'prepare';
  a.offers = [];
}
/**
 * Three traits from one tier, never one already owned. The tier follows the sector cleared,
 * with a one-in-five chance of drawing from the tier above; a tier that runs dry borrows
 * from its neighbours so a draft is always full while any trait remains.
 */
export function traitOffers(p: Profile, seed: number, level: number) {
  const random = rng(seed ^ 0x5bd1e995);
  const base = traitTier(level);
  const tier = Math.min(5, base + (random() < 0.2 ? 1 : 0));
  const pool = (t: number) =>
    TRAITS.filter((x) => x.tier === t && !p.traits.includes(x.id))
      .map((x) => ({ id: x.id, order: random() }))
      .sort((x, y) => x.order - y.order)
      .map((x) => x.id);
  const offers = pool(tier);
  for (const t of [tier - 1, tier + 1, tier - 2, tier + 2, tier - 3, tier + 3, tier - 4, tier + 4])
    if (offers.length < 3 && t >= 1 && t <= 5) offers.push(...pool(t));
  return offers.slice(0, 3);
}
export function chooseTrait(p: Profile, id: string) {
  if (!p.traitOffers.includes(id)) throw new Error('That trait is not on offer.');
  grantTrait(p, id);
  p.traitOffers = [];
}
/** Adds a trait outside a draft (developer tools). The active attempt receives it as well. */
export function grantTrait(p: Profile, id: string) {
  if (!TRAITS.some((t) => t.id === id)) throw new Error('Unknown trait.');
  if (p.traits.includes(id)) return;
  p.traits.push(id);
  p.active?.traits.push(id);
}
/**
 * Applies a finished attack to the preparation checkpoint: core, credits, kills and new
 * scars. Scars are permanent for the run, so they land on the profile as well. Gates that
 * failed or detonated are rebuilt for the next attack, like every other short-lived state.
 */
export function recordAttack(p: Profile, s: Snapshot) {
  const a = p.active!;
  a.core = s.won && s.core > 0 ? Math.min(maxCore(a), s.core + Math.max(0, bonus(a, 'coreRegen'))) : s.core;
  a.credits = s.credits;
  a.kills += s.diagnostics.kills;
  for (const id of s.diagnostics.scars) {
    p.scars.push(id);
    a.scars.push(id);
  }
}
export function settlementReward(a: Attempt, won: boolean) {
  return Math.floor(
    (Math.sqrt(a.kills) * 2 + Math.max(0, a.wave - 1) * 6 + (won ? 30 : 0)) *
      (1 + Math.log2(a.level) * 0.4) *
      (1 + bonus(a, 'research')) *
      farmMultiplier(a.farmed),
  );
}
export function settle(p: Profile, id: string, won: boolean) {
  if (p.lastReceipt === id) return 0;
  const a = p.active;
  if (!a || a.id !== id) throw new Error('Attempt is no longer active.');
  const dead = a.core <= 0;
  p.bankedCredits = dead ? null : Math.floor(a.credits);
  const reward = dead ? 0 : settlementReward(a, won);
  if (dead) {
    p.nodes = [];
    p.research = '0';
    p.unlocked = 1;
    p.boards = {};
    p.traits = [];
    p.traitOffers = [];
    p.scars = [];
    p.farmed = {};
    // A fresh seed: every sector is rewired after death, as after a reset.
    p.seed = Math.floor(Math.random() * 2 ** 32);
  }
  p.research = (BigInt(p.research) + BigInt(reward)).toString();
  if (won) {
    p.unlocked = Math.max(p.unlocked, a.level + 1);
    p.victories++;
    // A frontier clear earns one permanent trait; farms never do.
    if (a.frontier) p.traitOffers = traitOffers(p, a.seed, a.level);
  }
  p.kills += a.kills;
  p.lastReceipt = id;
  p.active = null;
  return reward;
}
export function template(type: string, index: number): Rule {
  return {
    id: `routine-${index}`,
    sensor: type === 'pressure' ? 'pressure' : type === 'heat' ? 'heat' : 'nearby',
    compare: type === 'heat' ? 'below' : 'above',
    value: type === 'pressure' ? 70 : type === 'heat' ? 35 : 3,
    target: 'all',
    action: type === 'pressure' ? 'open' : type === 'heat' ? 'overclock' : 'cluster',
    repeat: type === 'pressure' ? 0 : 5,
    enabled: true,
  };
}
export const routineLimit = (l: Loadout) => 32 + bonus(l, 'routines');
export function validateRules(rules: Rule[], a: Attempt): string[] {
  const errors: string[] = [];
  const limit = routineLimit(a);
  if (rules.length > limit) errors.push(`A board supports up to ${limit} routines.`);
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) errors.push('Routine IDs must be unique.');
    ids.add(r.id);
    if (
      !['pressure', 'heat', 'nearby', 'integrity', 'time'].includes(r.sensor) ||
      !['above', 'below'].includes(r.compare) ||
      !['open', 'close', 'overclock', 'first', 'strongest', 'cluster', 'purge', 'vent'].includes(r.action)
    )
      errors.push('Unknown node or connection.');
    if (
      !Number.isFinite(r.value) ||
      r.value < 0 ||
      r.value > 1e6 ||
      !Number.isFinite(r.repeat) ||
      r.repeat < 0 ||
      r.repeat > 3600
    )
      errors.push('Threshold or repeat interval is out of range.');
    if (r.target !== 'all' && !r.target.startsWith('kind:') && !a.towers.some((t) => t.id === r.target))
      errors.push(`${r.id}: missing defense ${r.target}.`);
    if (r.target.startsWith('kind:') && !(r.target.slice(5) in TOWERS)) errors.push('Unknown defense group.');
    if (r.action === 'purge' && !a.research.includes('automation-3'))
      errors.push('Unlock Purge protocol in Research.');
  }
  return errors;
}
