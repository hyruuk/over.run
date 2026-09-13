import type { EnemyKind, TowerKind } from './types';
export const TOWERS: Record<
  TowerKind,
  {
    name: string;
    short: string;
    description: string;
    cost: number;
    power: number;
    range: number;
    damage: number;
    cooldown: number;
    color: string;
    unlock?: string;
  }
> = {
  cannon: {
    name: 'Packet cannon',
    short: 'PKT',
    description: 'Rapid, precise packets. Reliable single-target defense.',
    cost: 75,
    power: 2,
    range: 3.6,
    damage: 13,
    cooldown: 13,
    color: '#b9f578',
  },
  mortar: {
    name: 'Packet mortar',
    short: 'AoE',
    description: 'Explosive payloads. Damages every virus in a 1.6-cell radius.',
    cost: 120,
    power: 3,
    range: 4.6,
    damage: 23,
    cooldown: 55,
    color: '#c6a0ff',
  },
  slow: {
    name: 'Throttle field',
    short: 'ICE',
    description: 'Slows traffic by 45%. Fields do not stack.',
    cost: 85,
    power: 2,
    range: 2.8,
    damage: 0,
    cooldown: 30,
    color: '#7bdde9',
  },
  arc: {
    name: 'Arc relay',
    short: 'ARC',
    description: 'Chains a pulse through up to four targets. Ignores armor.',
    cost: 155,
    power: 3,
    range: 3.5,
    damage: 20,
    cooldown: 30,
    color: '#eadc8c',
    unlock: 'arsenal-3',
  },
  laser: {
    name: 'Null beam',
    short: 'NUL',
    description: 'Long-range armor-piercing beam. Prioritizes strong threats.',
    cost: 190,
    power: 4,
    range: 6,
    damage: 82,
    cooldown: 65,
    color: '#ff92b0',
    unlock: 'arsenal-6',
  },
  scatter: {
    unlock: 'ballistics-1',
    name: 'Bit shotgun',
    short: 'BIT',
    description: 'Close-range fan of fragments. Hits every member near the target.',
    cost: 95,
    power: 2,
    range: 2.4,
    damage: 18,
    cooldown: 26,
    color: '#ffb76b',
  },
  pulse: {
    unlock: 'energy-1',
    name: 'EMP capacitor',
    short: 'EMP',
    description: 'Radial armor-piercing discharge hits every threat in range.',
    cost: 160,
    power: 4,
    range: 2.3,
    damage: 24,
    cooldown: 70,
    color: '#72aaff',
  },
  rail: {
    unlock: 'energy-2',
    name: 'Rail driver',
    short: 'RAIL',
    description: 'Pierces every enemy along a narrow line. Excellent against Daemons.',
    cost: 175,
    power: 3,
    range: 5.5,
    damage: 60,
    cooldown: 58,
    color: '#f4efe0',
  },
  shredder: {
    unlock: 'ballistics-2',
    name: 'Hex shredder',
    short: 'HEX',
    description: 'Twin rotary barrels shred unarmored traffic at extreme speed.',
    cost: 110,
    power: 3,
    range: 3,
    damage: 7,
    cooldown: 4,
    color: '#ff759e',
  },
  gate: {
    name: 'Circuit gate',
    short: 'GTE',
    description: 'Place on a trace. Seals traffic until pressure breaks it open.',
    cost: 50,
    power: 1,
    range: 0,
    damage: 0,
    cooldown: 0,
    color: '#e9c877',
  },
  reactor: {
    name: 'Power supply',
    short: 'PSU',
    description:
      'Socket-only. Adds 4 W; each upgrade adds 2 W. Radiates heat to nearby weapons, trips under heavy load, and is never refunded.',
    cost: 300,
    power: 0,
    range: 0,
    damage: 0,
    cooldown: 0,
    color: '#76e0ce',
  },
};
export const ENEMIES: Record<
  EnemyKind,
  { name: string; hp: number; speed: number; armor: number; breach: number; color: string }
> = {
  virus: { name: 'Worm', hp: 32, speed: 45, armor: 0, breach: 3, color: '#f28a8a' },
  runner: { name: 'Ghost packet', hp: 22, speed: 78, armor: 0, breach: 2, color: '#e5c979' },
  armored: { name: 'Trojan', hp: 100, speed: 32, armor: 5, breach: 6, color: '#c6a0ff' },
  rootkit: { name: 'Rootkit', hp: 160, speed: 48, armor: 8, breach: 8, color: '#7bdde9' },
  swarm: { name: 'Mite swarm', hp: 12, speed: 65, armor: 0, breach: 1, color: '#ffa55d' },
  leech: { name: 'Cache leech', hp: 60, speed: 40, armor: 1, breach: 4, color: '#b5db68' },
  sentinel: { name: 'Iron sentinel', hp: 210, speed: 23, armor: 12, breach: 10, color: '#a4b8cd' },
  glitch: { name: 'Glitch sprite', hp: 42, speed: 92, armor: 0, breach: 3, color: '#d88dff' },
  boss: { name: 'Daemon', hp: 620, speed: 21, armor: 4, breach: 30, color: '#ff587b' },
};
export const CORE_BRANCHES = ['arsenal', 'infrastructure', 'automation', 'analysis'] as const;
export const BRANCHES = [...CORE_BRANCHES, 'ballistics', 'energy', 'resilience', 'economy'] as const;
export type BonusKey =
  | 'damage'
  | 'range'
  | 'haste'
  | 'cooling'
  | 'gate'
  | 'core'
  | 'credits'
  | 'bounty'
  | 'research'
  | 'discount'
  | 'refund'
  | 'breachResist'
  | 'jamResist'
  | 'chain'
  | 'blast'
  | 'slow'
  | 'overclock'
  | 'overclockDuration'
  | 'armorPierce'
  | 'bossDamage'
  | 'power'
  | 'crit'
  | 'supplyOutput'
  | 'supplyHeat'
  | 'pressureDrain'
  | 'interrupt'
  | 'sensorRange'
  | 'vent'
  | 'routines'
  | 'purse'
  | 'forecast'
  | 'heatGain'
  | 'daemonHp'
  | 'daemonBounty'
  | 'offers'
  | 'critDamage'
  | 'supplyLevels'
  | 'openGrid'
  | 'daemons'
  | 'slowStack'
  | 'slowedDamage'
  | 'tripInterval'
  | 'gateBlast'
  | 'shortCircuit'
  | 'chainBlast'
  | 'slots'
  | 'slotDamage'
  | 'breachCharge'
  | 'unreferenced'
  | 'coreRegen'
  | `damage:${TowerKind}`
  | `draw:${TowerKind}`
  | `cost:${TowerKind}`;
export type Bonuses = Partial<Record<BonusKey, number>>;
export type Branch = (typeof BRANCHES)[number];
/**
 * Everything that modifies rules for a board: research levels, temporary exploits,
 * run traits and Daemon scars. An Attempt satisfies it directly.
 */
export interface Loadout {
  research: string[];
  perks?: string[];
  traits?: string[];
  scars?: string[];
}
export interface ResearchNode {
  id: string;
  branch: Branch;
  rank: number;
  name: string;
  /** Effect of one level; the tree shows the current and next level. */
  description: string;
  /** Cost of level one; each further level costs 35% more. */
  cost: number;
  levels: number;
  parent?: string;
  requires?: string[];
  /** Granted per level owned. */
  bonuses?: Bonuses;
  category?: 'weapon' | 'perk' | 'passive';
}
/** Research is a list of level purchases: a node id appears once per level owned. */
export const nodeLevel = (nodes: string[], id: string) => nodes.filter((x) => x === id).length;
export const nodeCost = (node: ResearchNode, level: number) =>
  Math.round(node.cost * Math.pow(1.35, Math.max(0, level - 1)));
export const levelsIn = (nodes: string[], branch: string) =>
  nodes.filter((x) => x.startsWith(`${branch}-`)).length;
export const branchLevels = (branch: string) =>
  RESEARCH.filter((n) => n.branch === branch).reduce((s, n) => s + n.levels, 0);
// Core disciplines: eight or nine distinct nodes each, one parent per node (1→2→3→6→9, 2→5→8 and
// 1→4→7). Ids keep the historical numbering that weapon licenses and bridges reference.
type CoreSpec = [string, string, number, Bonuses, ('weapon' | 'passive')?];
const core: Record<(typeof CORE_BRANCHES)[number], CoreSpec[]> = {
  arsenal: [
    ['Packet shaping', '+6% weapon damage.', 5, { damage: 0.06 }],
    ['Payload expansion', '+12% mortar and shotgun blast radius.', 4, { blast: 0.12 }],
    ['Arc relay', 'Unlocks Arc relay.', 1, {}, 'weapon'],
    ['Precision optics', '+5% range for combat defenses.', 4, { range: 0.05 }],
    ['Deep inspection', 'Hits ignore 1 point of armor.', 4, { armorPierce: 1 }],
    ['Null beam', 'Unlocks Null beam.', 1, {}, 'weapon'],
    ['Forked current', 'Arc relay chains through 1 more target.', 3, { chain: 1 }],
    ['Lethal syntax', '+2% critical chance. Critical hits deal double damage.', 10, { crit: 0.02 }],
  ],
  infrastructure: [
    ['Auxiliary bus', '+2 W base power capacity.', 10, { power: 2 }],
    ['Thermal paste', '+10% passive cooling.', 6, { cooling: 0.1 }],
    ['Reinforced seals', '+12% gate pressure capacity.', 5, { gate: 0.12 }],
    ['Reserve cells', '+6 maximum core integrity.', 6, { core: 6 }],
    ['Superconductors', 'Power supplies output +1 W.', 3, { supplyOutput: 1 }],
    ['Cold storage', 'Power supplies radiate 25% less heat.', 4, { supplyHeat: 0.25 }],
    ['Pressure vessel', 'Gate pressure dissipates 25% faster.', 3, { pressureDrain: 0.25 }],
    ['Redundant core', 'Breaches deal 6% less damage.', 5, { breachResist: 0.06 }],
  ],
  automation: [
    ['Fast interrupts', 'Routines evaluate one tick sooner (3 → 2 → 1 ticks).', 2, { interrupt: 1 }],
    ['Safe overclock', '+8 percentage points to overclock speed.', 5, { overclock: 0.08 }],
    ['Purge protocol', 'Unlocks the automatic purge action.', 1, {}, 'weapon'],
    ['Wide-band sensors', 'Nearby sensors read 1 cell further.', 3, { sensorRange: 1 }],
    ['Clock multiplier', '+4% weapon firing speed.', 6, { haste: 0.04 }],
    ['Adaptive cooling', 'Venting removes 15 more heat.', 4, { vent: 15 }],
    ['Parallel execution', 'A board supports 4 more routines.', 4, { routines: 4 }],
    ['Zero latency', 'Overclock lasts 25% longer.', 2, { overclockDuration: 0.25 }],
  ],
  analysis: [
    ['Memory recovery', '+5% research from settlement.', 10, { research: 0.05 }],
    [
      'Threat profiling',
      'The forecast reveals composition shares, then health, then Daemon health.',
      3,
      { forecast: 1 },
    ],
    ['Salvage protocol', 'Recycling returns 5 percentage points more.', 4, { refund: 0.05 }],
    ['Research cache', '+40 starting credits.', 5, { credits: 40 }],
    ['Forensic tools', '+6% credits from kills.', 5, { bounty: 0.06 }],
    ['Bounty signatures', '+10% damage against Daemons.', 5, { bossDamage: 0.1 }],
    ['Predictive model', 'The forecast also previews the following attack.', 1, { forecast: 3 }],
    ['Archive access', '+5% sector purse.', 6, { purse: 0.05 }],
    ['Quarantine', 'Purges your most recent Daemon scar when purchased.', 3, {}],
  ],
};
export const RESEARCH: ResearchNode[] = CORE_BRANCHES.flatMap((branch) =>
  core[branch].map(([name, description, levels, bonuses, category], i) => ({
    id: `${branch}-${i + 1}`,
    branch,
    rank: i + 1,
    name,
    description,
    levels,
    cost: category === 'weapon' ? 30 : 14 + i * 3,
    parent: i ? `${branch}-${i < 3 ? i : i - 2}` : undefined,
    bonuses,
    category: category ?? 'passive',
  })),
);
export interface Perk {
  id: string;
  name: string;
  tag: string;
  description: string;
  unlock?: string;
  weapons?: TowerKind[];
  bonuses?: Bonuses;
}
/** Temporary exploits: drafted between attacks, cleared with the attempt, at most three copies each. */
export const PERKS: Perk[] = [
  {
    id: 'payload',
    name: 'Dirty payload',
    tag: 'ARSENAL',
    description: '+25% damage for all weapons.',
    bonuses: { damage: 0.25 },
  },
  {
    id: 'range',
    name: 'Long exposure',
    tag: 'TARGETING',
    description: '+15% range for all combat defenses.',
    bonuses: { range: 0.15 },
  },
  {
    id: 'cooling',
    name: 'Cold boot',
    tag: 'THERMAL',
    description: 'Double passive cooling. Overclock longer.',
    bonuses: { cooling: 1 },
  },
  {
    id: 'gate',
    name: 'Pressure vessel',
    tag: 'INFRASTRUCTURE',
    description: '+75% gate pressure capacity.',
    bonuses: { gate: 0.75 },
    weapons: ['gate'],
  },
  {
    id: 'power',
    name: 'Ghost current',
    tag: 'POWER',
    description: '+4 power capacity this attempt.',
    bonuses: { power: 4 },
  },
  { id: 'salvage', name: 'Memory dividend', tag: 'ECONOMY', description: '+100 credits immediately.' },
  {
    id: 'repair',
    name: 'Recovery sector',
    tag: 'CORE',
    description: 'Restore 25 core integrity immediately.',
  },
  {
    id: 'haste',
    name: 'Fast clock',
    tag: 'ARSENAL',
    description: 'Weapons fire 18% faster.',
    bonuses: { haste: 0.18 },
  },
  {
    id: 'splash',
    name: 'Fragmentation',
    tag: 'MORTAR',
    description: '+35% mortar blast radius.',
    bonuses: { blast: 0.35 },
    weapons: ['mortar'],
  },
  {
    id: 'slow',
    name: 'Deep freeze',
    tag: 'THROTTLE',
    description: 'Throttle fields slow traffic by another 20 percentage points.',
    bonuses: { slow: 0.2 },
    weapons: ['slow'],
  },
];
// Three parallel specializations in each discipline. Tier four requires a bridge into another discipline.
const specialties = {
  ballistics: {
    roots: [
      ['Bit shotgun', 'Unlocks Bit shotgun.', {}],
      ['Hex shredder', 'Unlocks Hex shredder.', {}],
      ['Ballistic calibration', '+8% cannon damage.', { 'damage:cannon': 0.08 }],
    ],
    perks: [
      ['flak', 'Flak bloom', '+40% Bit shotgun damage.', { 'damage:scatter': 0.4 }, ['scatter']],
      ['belt', 'Endless belt', '+35% Hex shredder damage.', { 'damage:shredder': 0.35 }, ['shredder']],
      ['sabot', 'Sabot rounds', 'Hits ignore 3 points of armor.', { armorPierce: 3 }],
      [
        'wide-blast',
        'Wide bore',
        '+30% mortar and shotgun blast radius.',
        { blast: 0.3 },
        ['mortar', 'scatter'],
      ],
      ['packet', 'Hot packets', '+35% Packet cannon damage.', { 'damage:cannon': 0.35 }, ['cannon']],
      ['daemon-hunter', 'Daemon hunter', '+40% damage against Daemons.', { bossDamage: 0.4 }],
    ],
    caps: [
      ['Terminal ballistics', '+8% weapon damage.', { damage: 0.08 }],
      ['Accelerator feed', '+6% firing speed.', { haste: 0.06 }],
      ['Armor fracture', 'All hits ignore 1 more point of armor.', { armorPierce: 1 }],
    ],
    entry: 'arsenal-1',
    bridge: 'energy-3',
  },
  energy: {
    roots: [
      ['EMP capacitor', 'Unlocks EMP capacitor.', {}],
      ['Rail driver', 'Unlocks Rail driver.', {}],
      ['Waveguides', '+4% range for combat defenses.', { range: 0.04 }],
    ],
    perks: [
      ['aftershock', 'Aftershock', '+40% EMP damage.', { 'damage:pulse': 0.4 }, ['pulse']],
      ['rail-charge', 'Rail charge', '+35% Rail driver damage.', { 'damage:rail': 0.35 }, ['rail']],
      ['null-lens', 'Null lens', '+35% Null beam damage.', { 'damage:laser': 0.35 }, ['laser']],
      ['resonance', 'Forked resonance', 'Arc relay hits 2 more targets.', { chain: 2 }, ['arc']],
      ['capacitor', 'Fast discharge', '+20% weapon firing speed.', { haste: 0.2 }],
      ['wide-optics', 'Wide optics', '+12% weapon and field range.', { range: 0.12 }],
    ],
    caps: [
      ['Entangled relays', 'Arc relay hits 1 extra target.', { chain: 1 }],
      ['Coherent light', '+5% range for combat defenses.', { range: 0.05 }],
      ['Zero resistance', '+1 power capacity and +10% cooling.', { power: 1, cooling: 0.1 }],
    ],
    entry: 'arsenal-1',
    bridge: 'automation-3',
  },
  resilience: {
    roots: [
      ['Ceramic core', '+5 maximum core integrity.', { core: 5 }],
      ['Thermal reservoir', '+10% passive cooling.', { cooling: 0.1 }],
      ['Reinforced sockets', '+8% gate strength.', { gate: 0.08 }],
    ],
    perks: [
      ['hardened', 'Hardened kernel', 'Take 20% less core breach damage.', { breachResist: 0.2 }],
      ['firewall', 'Heavy firewall', '+50% gate pressure capacity.', { gate: 0.5 }, ['gate']],
      ['coolant', 'Liquid coolant', '+60% passive cooling.', { cooling: 0.6 }],
      ['clean-clock', 'Clean clock', 'Daemon clock corruption lasts 50% less time.', { jamResist: 0.5 }],
      ['safe-boost', 'Turbo window', '+25 percentage points to overclock speed.', { overclock: 0.25 }],
      [
        'absolute-zero',
        'Absolute zero',
        'Throttle fields slow by another 10 percentage points (80% maximum).',
        { slow: 0.1 },
        ['slow'],
      ],
    ],
    caps: [
      ['Fault containment', 'Take 5% less core breach damage.', { breachResist: 0.05 }],
      ['Cryogenic loop', '+20% passive cooling.', { cooling: 0.2 }],
      ['Redundant substrate', '+10 maximum core integrity.', { core: 10 }],
    ],
    entry: 'infrastructure-1',
    bridge: 'energy-3',
  },
  economy: {
    roots: [
      ['Seed capital', '+15 starting credits.', { credits: 15 }],
      ['Salvage rights', '+5% credits from kills.', { bounty: 0.05 }],
      ['Open archive', '+5% research from settlement.', { research: 0.05 }],
    ],
    perks: [
      ['bounty', 'Signature bounty', '+35% credits from kills.', { bounty: 0.35 }],
      ['fabricator', 'Cheap fabrication', 'Building and upgrading cost 20% less.', { discount: 0.2 }],
      [
        'recycle',
        'Circular economy',
        'Recycling returns 15 percentage points more (100% maximum).',
        { refund: 0.15 },
      ],
      ['archive', 'Deep archive', '+35% research from this sector.', { research: 0.35 }],
      ['reserve-bus', 'Reserve bus', '+2 power capacity.', { power: 2 }],
      ['war-dividend', 'War dividend', '+10% damage and +15% kill credits.', { damage: 0.1, bounty: 0.15 }],
    ],
    caps: [
      ['Automated foundry', 'Building and upgrading cost 5% less.', { discount: 0.05 }],
      ['Venture cache', '+40 starting credits.', { credits: 40 }],
      ['Knowledge engine', '+12% research from settlement.', { research: 0.12 }],
    ],
    entry: 'analysis-1',
    bridge: 'resilience-3',
  },
} satisfies Record<
  string,
  {
    roots: [string, string, Bonuses][];
    perks: [string, string, string, Bonuses, TowerKind[]?][];
    caps: [string, string, Bonuses][];
    entry: string;
    bridge: string;
  }
>;
for (const [branch, spec] of Object.entries(specialties)) {
  spec.roots.forEach(([name, description, bonuses], i) => {
    const weapon = description.startsWith('Unlocks');
    RESEARCH.push({
      id: `${branch}-${i + 1}`,
      branch: branch as Branch,
      rank: i + 1,
      name,
      description,
      levels: weapon ? 1 : 3,
      cost: 18 + i * 6,
      parent: spec.entry,
      bonuses,
      category: weapon ? 'weapon' : 'passive',
    });
  });
  spec.perks.forEach(([id, name, description, bonuses, weapons], i) => {
    const unlock = `${branch}-${i + 4}`;
    PERKS.push({
      id,
      name,
      description,
      tag: branch.toUpperCase(),
      bonuses,
      weapons: weapons as TowerKind[] | undefined,
      unlock,
    });
    RESEARCH.push({
      id: unlock,
      branch: branch as Branch,
      rank: i + 4,
      name,
      description: `Unlocks exploit: ${description}`,
      levels: 1,
      cost: 26 + Math.floor(i / 3) * 18,
      parent: `${branch}-${i + 1}`,
      category: 'perk',
    });
  });
  spec.caps.forEach(([name, description, bonuses], i) =>
    RESEARCH.push({
      id: `${branch}-${i + 10}`,
      branch: branch as Branch,
      rank: i + 10,
      name,
      description,
      levels: 2,
      cost: 85 + i * 15,
      parent: `${branch}-${i + 7}`,
      requires: [spec.bridge],
      bonuses,
      category: 'passive',
    }),
  );
}
export const prerequisites = (node: ResearchNode) => [
  ...(node.parent ? [node.parent] : []),
  ...(node.requires ?? []),
];
export const researchAvailable = (node: ResearchNode, nodes: string[]) =>
  prerequisites(node).every((id) => nodes.includes(id));
/** Permanent run choices, drafted three at a time from one tier after each frontier clear. */
export interface Trait {
  id: string;
  tier: number;
  name: string;
  tag: string;
  /** Generated from the bonuses so the text can never drift from the mechanics. */
  description: string;
  /** What kind of build the trait pushes toward, shown in the draft and the run profile. */
  favors: string;
  bonuses: Bonuses;
}
export const TIERS = [
  { tier: 1, name: 'Patch', from: 1, blurb: 'Small adjustments with a mild cost.' },
  { tier: 2, name: 'Firmware', from: 10, blurb: 'Real tradeoffs and new mechanics.' },
  { tier: 3, name: 'Kernel', from: 30, blurb: 'Build-defining commitments.' },
  { tier: 4, name: 'Architecture', from: 100, blurb: 'Large numbers, heavy downsides.' },
  { tier: 5, name: 'Singularity', from: 300, blurb: 'Warps the whole run.' },
];
/** The tier a frontier clear draws from; later sectors draft from later tiers. */
export const traitTier = (level: number) => TIERS.filter((t) => level >= t.from).at(-1)!.tier;
const pct = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
const signed = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(Number(v.toFixed(2)))}`;
const moreLess = (v: number) => (v > 0 ? 'more' : 'less');
const kindName = (key: string) => TOWERS[key.split(':')[1] as TowerKind].name;
/** One sentence per bonus key, in the order the keys are declared. */
export function describeBonuses(b: Bonuses): string {
  const parts: string[] = [];
  for (const [key, v] of Object.entries(b) as [BonusKey, number][]) {
    if (!v) continue;
    const abs = Math.abs(v);
    parts.push(
      key === 'damage'
        ? `${pct(v)} weapon damage`
        : key.startsWith('damage:')
          ? `${pct(v)} ${kindName(key)} damage`
          : key.startsWith('draw:')
            ? `${kindName(key)}s draw ${signed(v)} W`
            : key.startsWith('cost:')
              ? `${kindName(key)}s cost ${pct(v).slice(1)} ${moreLess(v)}`
              : key === 'range'
                ? `${pct(v)} range`
                : key === 'haste'
                  ? `weapons fire ${pct(v).slice(1)} ${v > 0 ? 'faster' : 'slower'}`
                  : key === 'cooling'
                    ? `${pct(v)} passive cooling`
                    : key === 'gate'
                      ? `${pct(v)} gate pressure capacity`
                      : key === 'core'
                        ? `${signed(v)} maximum core integrity`
                        : key === 'credits'
                          ? `${signed(v)} starting credits`
                          : key === 'bounty'
                            ? `kills pay ${pct(v).slice(1)} ${moreLess(v)}`
                            : key === 'research'
                              ? `${pct(v)} research from settlement`
                              : key === 'discount'
                                ? `building and upgrading cost ${pct(v).slice(1)} ${v > 0 ? 'less' : 'more'}`
                                : key === 'refund'
                                  ? `recycling returns ${Math.round(abs * 100)} points ${moreLess(v)}`
                                  : key === 'breachResist'
                                    ? `breaches deal ${pct(v).slice(1)} ${v > 0 ? 'less' : 'more'} damage`
                                    : key === 'jamResist'
                                      ? `Daemon clock corruption ${pct(v).slice(1)} ${v > 0 ? 'shorter' : 'longer'}`
                                      : key === 'chain'
                                        ? `Arc relay chains through ${signed(v)} targets`
                                        : key === 'blast'
                                          ? `${pct(v)} blast radius`
                                          : key === 'slow'
                                            ? `throttle fields slow ${Math.round(abs * 100)} points ${moreLess(v)}`
                                            : key === 'overclock'
                                              ? `${signed(Math.round(v * 100))} points to overclock speed`
                                              : key === 'overclockDuration'
                                                ? `overclock lasts ${pct(v).slice(1)} ${v > 0 ? 'longer' : 'shorter'}`
                                                : key === 'armorPierce'
                                                  ? `hits ignore ${signed(v)} armor`
                                                  : key === 'bossDamage'
                                                    ? `${pct(v)} damage against Daemons`
                                                    : key === 'power'
                                                      ? `${signed(v)} W power capacity`
                                                      : key === 'crit'
                                                        ? `${signed(Math.round(v * 100))} points critical chance`
                                                        : key === 'critDamage'
                                                          ? `critical hits deal ${pct(v)} more`
                                                          : key === 'supplyOutput'
                                                            ? `power supplies output ${signed(v)} W`
                                                            : key === 'supplyHeat'
                                                              ? `supplies radiate ${pct(v).slice(1)} ${v > 0 ? 'less' : 'more'} heat`
                                                              : key === 'supplyLevels'
                                                                ? `supplies gain ${signed(v)} upgrade levels`
                                                                : key === 'openGrid'
                                                                  ? 'power supplies install on any empty cell, without limit'
                                                                  : key === 'pressureDrain'
                                                                    ? `gate pressure dissipates ${pct(v).slice(1)} ${v > 0 ? 'faster' : 'slower'}`
                                                                    : key === 'interrupt'
                                                                      ? `routines evaluate ${abs} tick${abs === 1 ? '' : 's'} ${v > 0 ? 'sooner' : 'later'}`
                                                                      : key === 'sensorRange'
                                                                        ? `nearby sensors read ${signed(v)} cells`
                                                                        : key === 'vent'
                                                                          ? `venting removes ${signed(v)} heat`
                                                                          : key === 'routines'
                                                                            ? `${signed(v)} routine slots`
                                                                            : key === 'purse'
                                                                              ? `${pct(v)} sector purse`
                                                                              : key === 'forecast'
                                                                                ? 'a deeper threat forecast'
                                                                                : key === 'heatGain'
                                                                                  ? `weapons heat ${pct(v).slice(1)} ${v > 0 ? 'faster' : 'slower'}`
                                                                                  : key === 'daemonHp'
                                                                                    ? `Daemons have ${pct(v).slice(1)} ${moreLess(v)} health`
                                                                                    : key === 'daemonBounty'
                                                                                      ? `Daemon bounty ${pct(v).slice(1)} ${v > 0 ? 'larger' : 'smaller'}`
                                                                                      : key === 'daemons'
                                                                                        ? `${signed(v)} Daemon${abs === 1 ? '' : 's'} on the final attack`
                                                                                        : key === 'offers'
                                                                                          ? `${signed(v)} exploit draft option${abs === 1 ? '' : 's'}`
                                                                                          : key ===
                                                                                              'slowStack'
                                                                                            ? `overlapping fields slow another ${Math.round(abs * 100)} points`
                                                                                            : key ===
                                                                                                'slowedDamage'
                                                                                              ? `slowed enemies take ${pct(v)} damage`
                                                                                              : key ===
                                                                                                  'tripInterval'
                                                                                                ? `one supply trips every ${abs} s`
                                                                                                : key ===
                                                                                                    'gateBlast'
                                                                                                  ? `failing gates detonate (×${abs} blast)`
                                                                                                  : key ===
                                                                                                      'shortCircuit'
                                                                                                    ? `thermal shutdowns short-circuit for ${abs}× weapon damage`
                                                                                                    : key ===
                                                                                                        'chainBlast'
                                                                                                      ? `area hits have a ${Math.round(abs * 100)}% chance of a secondary explosion`
                                                                                                      : key ===
                                                                                                          'slots'
                                                                                                        ? `at most ${abs} combat installations`
                                                                                                        : key ===
                                                                                                            'slotDamage'
                                                                                                          ? `${pct(v)} damage per unused installation slot`
                                                                                                          : key ===
                                                                                                              'breachCharge'
                                                                                                            ? `each breach charges weapons ${pct(v)} for the attack (+80% maximum)`
                                                                                                            : key ===
                                                                                                                'unreferenced'
                                                                                                              ? `weapons no routine references deal ${pct(-v).slice(1)} less`
                                                                                                              : key ===
                                                                                                                  'coreRegen'
                                                                                                                ? `restore ${abs} core integrity after each attack won`
                                                                                                                : `${key} ${signed(v)}`,
    );
  }
  if (!parts.length) return '';
  return `${parts.map((x, i) => (i ? x : x[0].toUpperCase() + x.slice(1))).join('; ')}.`;
}
type TraitSpec = [string, string, string, string, Bonuses];
const traitTiers: TraitSpec[][] = [
  // Tier 1 · Patch (sectors 000–008)
  [
    ['dirty-firmware', 'Dirty firmware', 'ARSENAL', 'Any weapon line.', { damage: 0.12, heatGain: 0.1 }],
    ['long-lens', 'Long lens', 'TARGETING', 'Beams and rails.', { range: 0.1, haste: -0.05 }],
    ['thermal-grease', 'Thermal grease', 'THERMAL', 'Overclock routines.', { cooling: 0.3, damage: -0.05 }],
    ['cheap-solder', 'Cheap solder', 'ECONOMY', 'Building wide.', { discount: 0.15, refund: -0.15 }],
    ['seed-fund', 'Seed fund', 'ECONOMY', 'A strong first attack.', { credits: 120, purse: -0.05 }],
    ['scrap-market', 'Scrap market', 'ECONOMY', 'Rebuilding between attacks.', { refund: 0.2, bounty: -0.1 }],
    ['quick-clock', 'Quick clock', 'ARSENAL', 'Shredders and cannons.', { haste: 0.12, cooling: -0.15 }],
    [
      'wide-shells',
      'Wide shells',
      'EXPLOSIVE',
      'Mortars over queues.',
      { blast: 0.25, 'damage:mortar': -0.1 },
    ],
    ['ice-tuning', 'Ice tuning', 'THROTTLE', 'Field-and-beam corridors.', { slow: 0.1, 'cost:slow': 0.25 }],
    ['spare-cells', 'Spare cells', 'CORE', 'Surviving leaks.', { core: 20, haste: -0.04 }],
    ['bus-tap', 'Bus tap', 'POWER', 'One more installation.', { power: 3, supplyHeat: -0.25 }],
    ['steady-gates', 'Steady gates', 'GATES', 'Sealed routes.', { gate: 0.3, 'draw:gate': 1 }],
    ['archivist', 'Archivist', 'ANALYSIS', 'Research-first runs.', { research: 0.15, bounty: -0.1 }],
    [
      'cannon-doctrine',
      'Cannon doctrine',
      'BALLISTIC',
      'Packet cannons.',
      { 'damage:cannon': 0.3, 'cost:cannon': 0.2 },
    ],
    [
      'mortar-crews',
      'Mortar crews',
      'EXPLOSIVE',
      'Packet mortars.',
      { 'damage:mortar': 0.3, 'draw:mortar': 1 },
    ],
    ['field-patch', 'Field patch', 'CORE', 'Slow, safe sectors.', { coreRegen: 6, credits: -40 }],
    ['armor-reader', 'Armor reader', 'ARSENAL', 'Trojans and sentinels.', { armorPierce: 1, range: -0.05 }],
    ['tight-loop', 'Tight loop', 'AUTOMATION', 'A few sharp routines.', { interrupt: 1, routines: -8 }],
    ['venting-valve', 'Venting valve', 'THERMAL', 'Vent routines.', { vent: 20, overclockDuration: -0.2 }],
    ['daemon-lore', 'Daemon lore', 'ANALYSIS', 'Boss-focused damage.', { bossDamage: 0.25, daemonHp: 0.1 }],
    ['bargain-draft', 'Bargain draft', 'EXPLOITS', 'Exploit-driven boards.', { offers: 1, research: -0.1 }],
    [
      'sensor-array',
      'Sensor array',
      'AUTOMATION',
      'Nearby-sensor routines.',
      { sensorRange: 1, forecast: 1 },
    ],
    ['copper-wire', 'Copper wire', 'POWER', 'Arc relays.', { 'draw:arc': -1, 'draw:cannon': 1 }],
    ['salvage-yard', 'Salvage yard', 'ECONOMY', 'Credit-hungry builds.', { bounty: 0.15, discount: -0.1 }],
  ],
  // Tier 2 · Firmware (sectors 009–028)
  [
    [
      'overvolt',
      'Overvolt',
      'THERMAL',
      'Cooling research, vent routines, deliberate overheating.',
      { damage: 0.4, heatGain: 0.5, shortCircuit: 4 },
    ],
    [
      'static',
      'Static discharge',
      'EXPLOSIVE',
      'Area weapons and dense, sealed traffic.',
      { chainBlast: 0.15, 'draw:mortar': 1, 'draw:scatter': 1, 'draw:pulse': 1 },
    ],
    [
      'copper',
      'Copper economy',
      'POWER',
      'Energy arsenals and the Energy discipline.',
      {
        'draw:arc': -1,
        'draw:laser': -1,
        'draw:pulse': -1,
        'draw:rail': -1,
        'draw:cannon': 1,
        'draw:mortar': 1,
        'draw:scatter': 1,
        'draw:shredder': 1,
      },
    ],
    [
      'cold-chain',
      'Cold chain',
      'THROTTLE',
      'Throttle layering with long-range weapons.',
      { slowStack: 0.25, slowedDamage: 0.2, 'cost:slow': 1 },
    ],
    [
      'brownout',
      'Brownout protocol',
      'POWER',
      'Wide installations that tolerate short outages.',
      { power: 6, tripInterval: 20 },
    ],
    [
      'chokepoint',
      'Chokepoint doctrine',
      'GATES',
      'Sealed routes, pressure routines and mortars on the queue.',
      { gate: 0.5, gateBlast: 1, 'draw:gate': 1 },
    ],
    [
      'interrupt',
      'Interrupt-driven',
      'AUTOMATION',
      'Programming every installation.',
      { interrupt: 2, sensorRange: 2, unreferenced: 0.15 },
    ],
    [
      'hot-start',
      'Hot start',
      'THERMAL',
      'Burst weapons with vent routines.',
      { haste: 0.25, cooling: -0.4 },
    ],
    [
      'salvage-doctrine',
      'Salvage doctrine',
      'ECONOMY',
      'Rebuilding the board between attacks.',
      { refund: 0.2, bounty: -0.3 },
    ],
    [
      'bounty-hunter',
      'Bounty hunter',
      'ECONOMY',
      'Armor-piercing, single-target damage.',
      { daemonHp: 0.5, daemonBounty: 0.5 },
    ],
    [
      'crit-firmware',
      'Crit firmware',
      'ARSENAL',
      'Lethal syntax and fast weapons.',
      { crit: 0.08, damage: -0.1 },
    ],
    [
      'rail-gauge',
      'Rail gauge',
      'ENERGY',
      'Rail drivers on straight traces.',
      { 'damage:rail': 0.5, 'draw:rail': 1 },
    ],
    ['beam-focus', 'Beam focus', 'ENERGY', 'Null beams near the core.', { 'damage:laser': 0.4, range: -0.1 }],
    [
      'belt-feed',
      'Belt feed',
      'BALLISTIC',
      'Hex shredders with venting.',
      { 'damage:shredder': 0.45, heatGain: 0.2 },
    ],
    [
      'choke-bore',
      'Choke bore',
      'BALLISTIC',
      'Bit shotguns at junctions.',
      { 'damage:scatter': 0.4, blast: -0.15 },
    ],
    [
      'capacitor-bank',
      'Capacitor bank',
      'ENERGY',
      'EMP capacitors on queues.',
      { 'damage:pulse': 0.4, 'cost:pulse': 0.3 },
    ],
    ['arc-mesh', 'Arc mesh', 'ENERGY', 'Arc relays over swarms.', { chain: 2, 'damage:arc': -0.15 }],
    ['deep-purse', 'Deep purse', 'ECONOMY', 'Credit-rich sectors.', { purse: 0.2, discount: -0.15 }],
    ['quiet-core', 'Quiet core', 'CORE', 'Tolerating small leaks.', { breachResist: 0.2, core: -15 }],
    [
      'reserve-grid',
      'Reserve grid',
      'POWER',
      'Supplies far from weapons.',
      { supplyOutput: 2, supplyHeat: -0.5 },
    ],
    [
      'relief-valves',
      'Relief valves',
      'GATES',
      'Gates that open and reseal.',
      { pressureDrain: 0.5, gate: -0.15 },
    ],
    ['exploit-cache', 'Exploit cache', 'EXPLOITS', 'Exploit-driven boards.', { offers: 1, purse: -0.1 }],
    ['twin-signature', 'Twin signature', 'ANALYSIS', 'Daemon bounties.', { daemons: 1, daemonBounty: 1 }],
    ['scholar', 'Scholar', 'ANALYSIS', 'Research-first runs.', { research: 0.3, credits: -80 }],
  ],
  // Tier 3 · Kernel (sectors 029–098)
  [
    [
      'lone-operator',
      'Lone operator',
      'ARSENAL',
      'A few heavily upgraded weapons.',
      { slots: 8, slotDamage: 0.08 },
    ],
    [
      'glass-core',
      'Glass core',
      'CORE',
      'Deliberate leaks and late-route defenses.',
      { core: -40, breachCharge: 0.04 },
    ],
    [
      'open-grid',
      'Open grid',
      'POWER',
      'Power-hungry arsenals; keep supplies away from weapons.',
      { openGrid: 1, supplyHeat: -0.25 },
    ],
    ['megawatt-bus', 'Megawatt bus', 'POWER', 'Wide installations.', { power: 12, heatGain: 0.25 }],
    ['crit-kernel', 'Crit kernel', 'ARSENAL', 'Lethal syntax and shredders.', { crit: 0.1, critDamage: 0.5 }],
    ['cryo-kernel', 'Cryo kernel', 'THERMAL', 'Permanent overclock.', { cooling: 1, haste: -0.1 }],
    ['pierce-kernel', 'Pierce kernel', 'ARSENAL', 'Armored sectors.', { armorPierce: 3, damage: -0.1 }],
    [
      'overclock-kernel',
      'Overclock kernel',
      'AUTOMATION',
      'Overclock routines with venting.',
      { overclock: 0.4, overclockDuration: 0.5, heatGain: 0.3 },
    ],
    ['fortress-gates', 'Fortress gates', 'GATES', 'Sealing every route.', { gate: 1, 'draw:gate': 2 }],
    [
      'field-kernel',
      'Field kernel',
      'THROTTLE',
      'Throttle corridors.',
      { slow: 0.15, slowedDamage: 0.3, 'cost:slow': 0.5 },
    ],
    [
      'foundry-kernel',
      'Foundry kernel',
      'ECONOMY',
      'Many cheap installations.',
      { discount: 0.3, purse: -0.15 },
    ],
    [
      'bounty-kernel',
      'Bounty kernel',
      'ECONOMY',
      'Credit-hungry builds.',
      { bounty: 0.5, breachResist: -0.15 },
    ],
    ['archive-kernel', 'Archive kernel', 'ANALYSIS', 'Research-first runs.', { research: 0.5, purse: -0.1 }],
    [
      'daemon-kernel',
      'Daemon kernel',
      'ANALYSIS',
      'Boss-focused damage.',
      { bossDamage: 0.6, daemonHp: 0.3 },
    ],
    ['optic-kernel', 'Optic kernel', 'TARGETING', 'Long-range coverage.', { range: 0.25, haste: -0.1 }],
    [
      'blast-kernel',
      'Blast kernel',
      'EXPLOSIVE',
      'Area saturation.',
      { blast: 0.5, 'damage:mortar': -0.1, 'damage:scatter': -0.1 },
    ],
    ['chain-kernel', 'Chain kernel', 'ENERGY', 'Arc relays over swarms.', { chain: 4, 'cost:arc': 0.5 }],
    [
      'automation-kernel',
      'Automation kernel',
      'AUTOMATION',
      'Programming everything.',
      { routines: 16, interrupt: 2, unreferenced: 0.25 },
    ],
    [
      'supply-kernel',
      'Supply kernel',
      'POWER',
      'Fewer, bigger supplies.',
      { supplyLevels: 2, supplyOutput: 1, tripInterval: 30 },
    ],
    ['regen-kernel', 'Regen kernel', 'CORE', 'Long attrition sectors.', { coreRegen: 15, core: -20 }],
    ['vent-kernel', 'Vent kernel', 'THERMAL', 'Vent routines.', { vent: 40, overclock: -0.2 }],
    ['exploit-kernel', 'Exploit kernel', 'EXPLOITS', 'Exploit-driven boards.', { offers: 2, research: -0.2 }],
  ],
  // Tier 4 · Architecture (sectors 099–298)
  [
    [
      'nuclear-supplies',
      'Nuclear supplies',
      'POWER',
      'Isolated supply farms.',
      { supplyOutput: 6, supplyHeat: -1, tripInterval: 15 },
    ],
    [
      'total-crit',
      'Total crit',
      'ARSENAL',
      'Maxed Lethal syntax.',
      { crit: 0.2, critDamage: 1, damage: -0.25 },
    ],
    [
      'absolute-cold',
      'Absolute cold',
      'THROTTLE',
      'Field walls.',
      { slow: 0.25, slowStack: 0.25, slowedDamage: 0.5, 'cost:slow': 2 },
    ],
    [
      'siege-architecture',
      'Siege architecture',
      'EXPLOSIVE',
      'Mortars and shotguns.',
      { 'damage:mortar': 1, 'damage:scatter': 1, 'draw:mortar': 2, 'draw:scatter': 2 },
    ],
    [
      'beam-architecture',
      'Beam architecture',
      'ENERGY',
      'Beams and rails.',
      { 'damage:laser': 1, 'damage:rail': 1, heatGain: 0.5 },
    ],
    [
      'arc-architecture',
      'Arc architecture',
      'ENERGY',
      'Arc relays.',
      { chain: 6, 'damage:arc': 0.5, 'draw:arc': 2 },
    ],
    [
      'chip-architecture',
      'Chip architecture',
      'BALLISTIC',
      'Cannons and shredders.',
      { 'damage:cannon': 1, 'damage:shredder': 1, 'cost:cannon': 0.5, 'cost:shredder': 0.5 },
    ],
    [
      'fortress-architecture',
      'Fortress architecture',
      'GATES',
      'Sealed everything.',
      { gate: 2, gateBlast: 2, pressureDrain: 1, 'draw:gate': 3 },
    ],
    [
      'thermal-architecture',
      'Thermal architecture',
      'THERMAL',
      'Permanent overclock.',
      { cooling: 2, vent: 60, damage: -0.15 },
    ],
    [
      'grid-architecture',
      'Grid architecture',
      'POWER',
      'Base power over supplies.',
      { power: 20, supplyOutput: -2 },
    ],
    [
      'economy-architecture',
      'Economy architecture',
      'ECONOMY',
      'Buying everything.',
      { purse: 0.5, bounty: 0.3, discount: -0.3 },
    ],
    [
      'research-architecture',
      'Research architecture',
      'ANALYSIS',
      'Tree-first runs.',
      { research: 1, purse: -0.25 },
    ],
    [
      'core-architecture',
      'Core architecture',
      'CORE',
      'Tanking leaks.',
      { core: 80, breachResist: 0.3, haste: -0.15 },
    ],
    ['regen-architecture', 'Regen architecture', 'CORE', 'Attrition.', { coreRegen: 40, core: -30 }],
    [
      'daemon-architecture',
      'Daemon architecture',
      'ANALYSIS',
      'Boss hunting.',
      { daemons: 2, daemonBounty: 2, bossDamage: 0.5 },
    ],
    [
      'pierce-architecture',
      'Pierce architecture',
      'ARSENAL',
      'Armored sectors.',
      { armorPierce: 6, haste: -0.1 },
    ],
    [
      'overclock-architecture',
      'Overclock architecture',
      'AUTOMATION',
      'Overclock routines.',
      { overclock: 0.8, overclockDuration: 1, heatGain: 0.6 },
    ],
    [
      'automation-architecture',
      'Automation architecture',
      'AUTOMATION',
      'Programming everything.',
      { interrupt: 2, sensorRange: 4, routines: 32, unreferenced: 0.4 },
    ],
    [
      'optic-architecture',
      'Optic architecture',
      'TARGETING',
      'Long-range coverage.',
      { range: 0.5, damage: -0.2 },
    ],
    [
      'exploit-architecture',
      'Exploit architecture',
      'EXPLOITS',
      'Exploit-driven boards.',
      { offers: 3, purse: -0.2 },
    ],
    [
      'lean-architecture',
      'Lean architecture',
      'ARSENAL',
      'Six perfect weapons.',
      { slots: 6, slotDamage: 0.2 },
    ],
    [
      'hazard-architecture',
      'Hazard architecture',
      'EXPLOSIVE',
      'Chaos on the board.',
      { chainBlast: 0.35, shortCircuit: 6, heatGain: 0.4 },
    ],
  ],
  // Tier 5 · Singularity (sectors 299+)
  [
    ['damage-singularity', 'Damage singularity', 'ARSENAL', 'Everything.', { damage: 2, core: -50 }],
    ['clock-singularity', 'Clock singularity', 'ARSENAL', 'Cooling stacks.', { haste: 1, heatGain: 1 }],
    [
      'crit-singularity',
      'Crit singularity',
      'ARSENAL',
      'Maxed Lethal syntax.',
      { crit: 0.35, critDamage: 2, haste: -0.3 },
    ],
    [
      'entropy-singularity',
      'Entropy singularity',
      'THROTTLE',
      'Field walls.',
      { slow: 0.3, slowStack: 0.3, slowedDamage: 1, 'cost:slow': 3 },
    ],
    [
      'power-singularity',
      'Power singularity',
      'POWER',
      'Wide installations.',
      { power: 40, supplyOutput: 4, tripInterval: 10 },
    ],
    [
      'grid-singularity',
      'Grid singularity',
      'POWER',
      'Supply farms.',
      { openGrid: 1, supplyOutput: 3, supplyHeat: -1 },
    ],
    [
      'pressure-singularity',
      'Pressure singularity',
      'GATES',
      'Sealed everything.',
      { gate: 4, gateBlast: 4, 'draw:gate': 4 },
    ],
    ['relay-singularity', 'Relay singularity', 'ENERGY', 'Arc relays.', { chain: 10, 'damage:arc': 1 }],
    [
      'null-singularity',
      'Null singularity',
      'ARSENAL',
      'Armored sectors.',
      { armorPierce: 12, damage: -0.3 },
    ],
    [
      'siege-singularity',
      'Siege singularity',
      'EXPLOSIVE',
      'Mortars.',
      { blast: 1, 'damage:mortar': 2, 'draw:mortar': 4 },
    ],
    [
      'beam-singularity',
      'Beam singularity',
      'ENERGY',
      'Beams and rails.',
      { 'damage:laser': 2.5, 'damage:rail': 2.5, cooling: -0.5 },
    ],
    [
      'purse-singularity',
      'Purse singularity',
      'ECONOMY',
      'Buying everything.',
      { purse: 1.5, research: -0.5 },
    ],
    [
      'archive-singularity',
      'Archive singularity',
      'ANALYSIS',
      'Tree-first runs.',
      { research: 2, purse: -0.5 },
    ],
    [
      'core-singularity',
      'Core singularity',
      'CORE',
      'Tanking everything.',
      { core: 200, coreRegen: 60, damage: -0.25 },
    ],
    [
      'daemon-singularity',
      'Daemon singularity',
      'ANALYSIS',
      'Boss hunting.',
      { daemons: 4, daemonBounty: 4, bossDamage: 1.5 },
    ],
    [
      'interrupt-singularity',
      'Interrupt singularity',
      'AUTOMATION',
      'Programming everything.',
      { interrupt: 2, routines: 64, sensorRange: 6, unreferenced: 0.6 },
    ],
    [
      'thermal-singularity',
      'Thermal singularity',
      'THERMAL',
      'Chaos with cooling.',
      { cooling: 3, shortCircuit: 10, heatGain: 1 },
    ],
    [
      'exploit-singularity',
      'Exploit singularity',
      'EXPLOITS',
      'Exploit-driven boards.',
      { offers: 4, purse: -0.3 },
    ],
    [
      'solo-singularity',
      'Solo singularity',
      'ARSENAL',
      'Four perfect weapons.',
      { slots: 4, slotDamage: 0.6 },
    ],
    [
      'glass-singularity',
      'Glass singularity',
      'CORE',
      'Deliberate leaks.',
      { breachCharge: 0.12, core: -60 },
    ],
  ],
];
export const TRAITS: Trait[] = traitTiers.flatMap((list, i) =>
  list.map(([id, name, tag, favors, bonuses]) => ({
    id,
    tier: i + 1,
    name,
    tag,
    favors,
    bonuses,
    description: describeBonuses(bonuses),
  })),
);
/** Permanent maluses a Daemon imprints when it breaches the core. Each stacks up to three times. */
export interface Scar {
  id: string;
  name: string;
  description: string;
  bonuses: Bonuses;
}
export const SCAR_STACK = 3;
export const SCARS: Scar[] = [
  {
    id: 'corrupted-clock',
    name: 'Corrupted clock',
    description: 'Weapons fire 6% slower.',
    bonuses: { haste: -0.06 },
  },
  { id: 'leaky-bus', name: 'Leaky bus', description: '−2 W base power capacity.', bonuses: { power: -2 } },
  { id: 'memory-rot', name: 'Memory rot', description: 'Kills pay 10% less.', bonuses: { bounty: -0.1 } },
  {
    id: 'pressure-fatigue',
    name: 'Pressure fatigue',
    description: 'Gates hold 20% less pressure.',
    bonuses: { gate: -0.2 },
  },
  {
    id: 'hot-silicon',
    name: 'Hot silicon',
    description: 'Weapons heat 15% faster.',
    bonuses: { heatGain: 0.15 },
  },
  {
    id: 'hungry-daemon',
    name: 'Hungry daemon',
    description: 'Daemons have 25% more health.',
    bonuses: { daemonHp: 0.25 },
  },
  {
    id: 'redacted-draft',
    name: 'Redacted draft',
    description: 'Exploit drafts offer one fewer choice.',
    bonuses: { offers: -1 },
  },
  {
    id: 'brittle-core',
    name: 'Brittle core',
    description: 'Breaches deal 10% more damage.',
    bonuses: { breachResist: -0.1 },
  },
];
export function modifiers(l: Loadout): Bonuses {
  const result: Bonuses = {};
  for (const bonuses of [
    ...l.research.map((id) => RESEARCH.find((n) => n.id === id)?.bonuses),
    ...(l.perks ?? []).map((id) => PERKS.find((p) => p.id === id)?.bonuses),
    ...(l.traits ?? []).map((id) => TRAITS.find((t) => t.id === id)?.bonuses),
    ...(l.scars ?? []).map((id) => SCARS.find((s) => s.id === id)?.bonuses),
  ]) {
    for (const [key, amount] of Object.entries(bonuses ?? {}))
      result[key as BonusKey] = (result[key as BonusKey] ?? 0) + amount;
  }
  return result;
}
export const bonus = (l: Loadout, key: BonusKey) => modifiers(l)[key] ?? 0;
export const countPerk = (perks: string[], id: string) => perks.filter((x) => x === id).length;
/** Power supplies: socket-only, three levels, never refunded. */
export const SUPPLY = { output: 4, perLevel: 2, levels: 3, radius: 2, radiation: 0.12 };
export const maxLevel = (kind: TowerKind, l: Loadout = { research: [] }) =>
  kind === 'reactor' ? SUPPLY.levels + Math.max(0, bonus(l, 'supplyLevels')) : 5;
export const buildCost = (kind: TowerKind, l: Loadout) =>
  Math.ceil(
    TOWERS[kind].cost *
      Math.max(0.25, 1 + bonus(l, `cost:${kind}`)) *
      (1 - Math.min(0.6, bonus(l, 'discount'))),
  );
export const upgradeCost = (tower: { kind: TowerKind; level: number }, l: Loadout) =>
  Math.ceil(
    Math.round(
      tower.kind === 'reactor'
        ? TOWERS.reactor.cost * 0.8 * Math.pow(1.6, tower.level - 1)
        : TOWERS[tower.kind].cost * 0.7 * tower.level,
    ) *
      (1 - Math.min(0.6, bonus(l, 'discount'))),
  );
export const sellValue = (tower: { kind: TowerKind; spent: number }, l: Loadout) =>
  tower.kind === 'reactor' ? 0 : Math.floor(tower.spent * Math.min(1, 0.8 + bonus(l, 'refund')));
export const powerOutput = (t: { kind: TowerKind; level: number }, l: Loadout = { research: [] }) =>
  t.kind === 'reactor' ? SUPPLY.output + SUPPLY.perLevel * (t.level - 1) + bonus(l, 'supplyOutput') : 0;
export const powerDraw = (kind: TowerKind, l: Loadout = { research: [] }) =>
  kind === 'reactor' ? 0 : Math.max(0, TOWERS[kind].power + bonus(l, `draw:${kind}`));
export const BASE_POWER = 14;
export const powerCapacity = (l: Loadout, towers: { kind: TowerKind; level: number }[] = []) =>
  Math.max(0, towers.reduce((sum, t) => sum + powerOutput(t, l), 0) + BASE_POWER + bonus(l, 'power'));
export const powerUsed = (towers: { kind: TowerKind }[], l: Loadout = { research: [] }) =>
  towers.reduce((sum, t) => sum + powerDraw(t.kind, l), 0);
export const maxCore = (l: Loadout) => Math.max(40, 100 + bonus(l, 'core'));
/** Combat installation limit from traits; 0 means unlimited. */
export const slotLimit = (l: Loadout) => Math.max(0, bonus(l, 'slots'));
export const isCombat = (kind: TowerKind) => kind !== 'gate' && kind !== 'reactor';
export const towerRange = (tower: { kind: TowerKind; level: number; boost?: number }, l: Loadout) =>
  TOWERS[tower.kind].range *
  (1 + (tower.level - 1) * 0.06 + bonus(l, 'range')) *
  (tower.kind === 'slow' && (tower.boost ?? 0) > 0 ? 1.25 : 1);
/**
 * A sector pays a bounded purse across its five attacks, however many enemies it contains.
 * Growth is slow and linear; scaling has to come from research, exploits and traits.
 */
export const WAVE_SHARE = [0.12, 0.16, 0.2, 0.24, 0.28];
export const purse = (level: number, l: Loadout) =>
  Math.round(900 * (1 + 0.05 * (level - 1)) * (1 + bonus(l, 'purse')));
/** Repeat attempts on a cleared sector pay less every time, without a floor. */
export const farmMultiplier = (farmed: number) => Math.pow(0.6, farmed);
export const startingCredits = (l: Loadout) => 360 + bonus(l, 'credits');
export function format(value: number | string | bigint): string {
  const n = Number(value);
  return n >= 1e12
    ? n.toExponential(1)
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}m`
      : n >= 10000
        ? `${(n / 1000).toFixed(1)}k`
        : Math.floor(n).toLocaleString('en-US');
}
