import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRANCHES,
  RESEARCH,
  PERKS,
  prerequisites,
  researchAvailable,
  maxCore,
  towerRange,
  nodeCost,
  nodeLevel,
  bonus,
  buildCost,
  upgradeCost,
  sellValue,
} from '../src/content';
import {
  freshProfile,
  startAttempt,
  buyResearch,
  build,
  upgrade,
  sell,
  rewardOffers,
  chooseReward,
  settlementReward,
} from '../src/model';
import { validateSave } from '../src/persistence';
import { profileLoadout } from '../src/model';
import { Simulation, health } from '../src/simulation';
import { generateScore, musicNotes } from '../src/music';
import { GENRES } from '../src/beats';

test('research graph has eight branches of distinct leveled nodes, reachable forks and capstones', () => {
  assert.equal(BRANCHES.length, 8);
  assert.equal(RESEARCH.length, 81);
  assert.equal(PERKS.filter((p) => p.unlock).length, 24);
  assert.equal(new Set(RESEARCH.map((n) => n.id)).size, RESEARCH.length);
  assert.equal(new Set(RESEARCH.map((n) => n.name)).size, RESEARCH.length, 'no node name repeats');
  assert.ok(RESEARCH.every((n) => n.levels >= 1 && n.levels <= 10));
  assert.ok(RESEARCH.some((n) => n.levels === 10) && RESEARCH.some((n) => n.levels === 2));
  const p = freshProfile(1);
  p.research = '99999999';
  const pending = new Set(RESEARCH.map((n) => n.id));
  while (pending.size) {
    const available = RESEARCH.filter((n) => pending.has(n.id) && researchAvailable(n, p.nodes));
    assert.ok(available.length, 'no cycles or unreachable nodes');
    for (const n of available) {
      for (let level = 0; level < n.levels; level++) buyResearch(p, n.id);
      assert.throws(() => buyResearch(p, n.id), /fully compiled/);
      pending.delete(n.id);
    }
  }
  assert.equal(
    p.nodes.length,
    RESEARCH.reduce((s, n) => s + n.levels, 0),
  );
  assert.deepEqual(validateSave(p), p);
  assert.ok(RESEARCH.some((n) => prerequisites(n).length > 1));
  const a = startAttempt(p, 1);
  assert.equal(a.core, maxCore(profileLoadout(p)));
  assert.ok(a.core > 148, 'core passives stack across levels');
  assert.deepEqual(validateSave(p), p);
});

test('each research level costs 35% more and every level adds its effect', () => {
  const node = RESEARCH.find((n) => n.id === 'arsenal-1')!;
  assert.equal(nodeCost(node, 1), node.cost);
  assert.equal(nodeCost(node, 2), Math.round(node.cost * 1.35));
  const p = freshProfile(3);
  p.research = '10000';
  buyResearch(p, 'arsenal-1');
  const one = bonus(profileLoadout(p), 'damage');
  buyResearch(p, 'arsenal-1');
  assert.equal(nodeLevel(p.nodes, 'arsenal-1'), 2);
  assert.ok(Math.abs(bonus(profileLoadout(p), 'damage') - one * 2) < 1e-9);
  assert.equal(BigInt(10000) - BigInt(p.research), BigInt(nodeCost(node, 1) + nodeCost(node, 2)));
});

test('weapon licenses enforce prerequisites, capstones enforce both branches, and save validation agrees', () => {
  const p = freshProfile(7);
  p.research = '9999';
  assert.throws(() => buyResearch(p, 'ballistics-1'), /prerequisite/);
  buyResearch(p, 'arsenal-1');
  buyResearch(p, 'ballistics-1');
  assert.ok(!p.nodes.includes('ballistics-2'), 'sibling remains a choice');
  buyResearch(p, 'ballistics-4');
  buyResearch(p, 'ballistics-7');
  assert.throws(() => buyResearch(p, 'ballistics-10'), /prerequisite/);
  buyResearch(p, 'energy-3');
  buyResearch(p, 'ballistics-10');
  const corrupt = structuredClone(p);
  corrupt.nodes = corrupt.nodes.filter((id) => id !== 'energy-3');
  assert.ok(!validateSave(corrupt).nodes.includes('ballistics-10'), 'orphaned capstone is dropped on load');
  const a = startAttempt(p, 1);
  build(a, 'scatter', a.board.tiles.indexOf(0));
  assert.throws(() => build(a, 'shredder', a.board.tiles.lastIndexOf(0)), /Unlock/);
});

test('old sequential research saves load: unknown nodes and orphaned levels are dropped', () => {
  for (let rank = 1; rank <= 24; rank++) {
    const p = freshProfile(4);
    p.nodes = Array.from({ length: rank }, (_, i) => `arsenal-${i + 1}`);
    const loaded = validateSave(p);
    assert.deepEqual(loaded.nodes, p.nodes.slice(0, Math.min(rank, 8)));
    assert.deepEqual(loaded.traits, []);
  }
  const p = freshProfile(4);
  p.nodes = [
    'arsenal-1',
    'arsenal-1',
    'arsenal-1',
    'arsenal-1',
    'arsenal-1',
    'arsenal-1',
    'arsenal-2',
    'arsenal-4',
  ];
  assert.deepEqual(validateSave(p).nodes, [
    'arsenal-1',
    'arsenal-1',
    'arsenal-1',
    'arsenal-1',
    'arsenal-1',
    'arsenal-2',
    'arsenal-4',
  ]);
  const orphan = freshProfile(4);
  orphan.nodes = ['arsenal-2', 'arsenal-4'];
  assert.deepEqual(validateSave(orphan).nodes, []);
});

test('locked and irrelevant exploits never appear; unlocked relevant ones enter deterministic drafts', () => {
  const p = freshProfile(8),
    a = startAttempt(p, 1);
  const seen = new Set<string>();
  for (let seed = 0; seed < 300; seed++) {
    a.seed = seed;
    for (const id of rewardOffers(a)) assert.ok(!PERKS.find((p) => p.id === id)!.unlock);
  }
  a.research = RESEARCH.flatMap((n) => Array<string>(n.levels).fill(n.id));
  a.credits = 99999;
  a.board.tiles = a.board.tiles.map((t) => (t === 3 ? 0 : t));
  for (const kind of [
    'cannon',
    'mortar',
    'scatter',
    'shredder',
    'arc',
    'pulse',
    'laser',
    'rail',
    'slow',
    'gate',
  ] as const) {
    const cell = a.board.tiles.findIndex(
      (tile, i) =>
        tile === (kind === 'gate' ? 1 : 0) &&
        !a.board.entries.includes(i) &&
        i !== a.board.core &&
        !a.towers.some((t) => t.cell === i),
    );
    build(a, kind, cell);
  }
  for (let seed = 0; seed < 400; seed++) {
    a.seed = seed;
    const offers = rewardOffers(a);
    assert.deepEqual(offers, rewardOffers(a));
    offers.forEach((id) => seen.add(id));
  }
  for (const perk of PERKS) assert.ok(seen.has(perk.id), perk.id);
  a.towers = [];
  for (let seed = 0; seed < 100; seed++) {
    a.seed = seed;
    for (const id of rewardOffers(a)) assert.ok(!PERKS.find((p) => p.id === id)!.weapons);
  }
});

test('economy perks change actual build, upgrade, refund and research amounts', () => {
  const a = startAttempt(freshProfile(), 1);
  a.phase = 'reward';
  a.offers = ['fabricator'];
  chooseReward(a, 'fabricator');
  assert.equal(buildCost('cannon', a), 60);
  const before = a.credits;
  build(a, 'cannon', a.board.tiles.indexOf(0));
  assert.equal(a.credits, before - 60);
  const t = a.towers[0],
    cost = upgradeCost(t, a);
  upgrade(a, t.id);
  assert.equal(t.spent, 60 + cost);
  a.perks.push('recycle');
  const refund = sellValue(t, a),
    balance = a.credits;
  sell(a, t.id);
  assert.equal(a.credits, balance + refund);
  a.kills = 100;
  const ordinary = settlementReward(a, true);
  a.perks.push('archive');
  assert.ok(settlementReward(a, true) > ordinary);
});

function combat(perks: string[]) {
  const a = startAttempt(freshProfile(123), 1);
  const entry = a.board.entries[0];
  const cell = a.board.tiles[entry + a.board.width] === 0 ? entry + a.board.width : entry - a.board.width;
  a.perks = perks;
  build(a, 'cannon', cell);
  const sim = new Simulation(a);
  sim.addEnemy('sentinel', 1, entry);
  sim.step();
  return sim;
}
test('combat perks affect armor, rate, range, kill rewards and breach penalties', () => {
  const ordinary = combat([]),
    piercing = combat(['sabot', 'capacitor']);
  assert.ok(piercing.towers[0].damage > ordinary.towers[0].damage);
  assert.ok(piercing.towers[0].cooldown < ordinary.towers[0].cooldown);
  assert.ok(
    towerRange({ kind: 'cannon', level: 1 }, { research: [], perks: ['wide-optics'] }) >
      towerRange({ kind: 'cannon', level: 1 }, { research: [] }),
  );
  const a = startAttempt(freshProfile(4), 1);
  a.perks = ['hardened', 'clean-clock'];
  const sim = new Simulation(a);
  sim.addEnemy('boss', 1, a.board.core);
  sim.enemies[0].progress = 999;
  sim.step();
  assert.equal(sim.core, 76);
  assert.ok(sim.diagnostics.events.some((e) => e.text.includes('4.0s')));
  const withBounty = combat(['bounty']);
  const withoutBounty = combat([]);
  for (const run of [withBounty, withoutBounty]) {
    run.enemies[0].bands = [{ hp: 1, count: 1 }];
    run.towers[0].cooldown = 0;
    run.step();
  }
  assert.ok(withBounty.diagnostics.earned > withoutBounty.diagnostics.earned);
  assert.ok(
    piercing.enemies.reduce((n, e) => n + health(e), 0) < ordinary.enemies.reduce((n, e) => n + health(e), 0),
  );
});

test('sector compositions are deterministic, distinct and evolve beyond the old eight-bar loop', () => {
  const signatures = new Set<string>();
  for (let sector = 0; sector < 20; sector++) {
    const score = generateScore(42, sector);
    assert.deepEqual(score, generateScore(42, sector));
    const range = GENRES.find((g) => g.id === score.genre)!.bpm;
    assert.ok(score.bpm >= range[0] && score.bpm <= range[1]);
    signatures.add(JSON.stringify(score.melody));
    for (let step = 0; step < 1024; step++)
      for (const note of musicNotes(score, step)) {
        assert.ok(Number.isFinite(note.hz) && note.hz > 0);
        assert.ok(note.duration > 0 && note.velocity > 0 && note.velocity < 0.3);
      }
  }
  assert.equal(signatures.size, 20);
  const score = generateScore(42, 0);
  const phrase = (offset: number) => Array.from({ length: 128 }, (_, i) => musicNotes(score, i + offset));
  assert.notDeepEqual(phrase(0), phrase(128));
  assert.notDeepEqual(phrase(0), phrase(256));
});
