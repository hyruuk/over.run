import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  freshProfile,
  startAttempt,
  build,
  upgrade,
  settle,
  buyResearch,
  chooseReward,
  chooseTrait,
  rewardOffers,
  template,
  validateRules,
} from '../src/model';
import {
  BOARD_VERSION,
  entryCount,
  generateBoard,
  validBoard,
  distances,
  neighbors,
} from '../src/generation';
import { Simulation, damageEnemy, health, mergeCohorts, population } from '../src/simulation';
import { RESEARCH, TOWERS, powerCapacity, powerUsed } from '../src/content';
import { SaveStore, validateSave } from '../src/persistence';
import type { Enemy, Attempt, TowerKind } from '../src/types';

/** The trace cell feeding the core; on a one-port board every intruder passes through it. */
function choke(a: Attempt) {
  return neighbors(a.board.core, a.board.width, a.board.height).find((n) => a.board.tiles[n] === 1)!;
}
function attempt(seed = 123) {
  const p = freshProfile(seed);
  return startAttempt(p, 1);
}
function defend(a: Attempt) {
  a.credits = 5000;
  a.research = RESEARCH.flatMap((n) => Array<string>(n.levels).fill(n.id));
  const w = a.board.width;
  for (const kind of [
    'mortar',
    'cannon',
    'slow',
    'laser',
    'arc',
    'mortar',
    'cannon',
    'laser',
    'mortar',
  ] as TowerKind[]) {
    const candidates = a.board.tiles
      .map((t, i) => ({ t, i }))
      .filter((x) => x.t === 0 && !a.towers.some((t) => t.cell === x.i));
    const score = (cell: number) =>
      a.board.tiles.reduce(
        (sum, t, i) =>
          sum +
          (t === 1 &&
          Math.hypot((i % w) - (cell % w), Math.floor(i / w) - Math.floor(cell / w)) < TOWERS[kind].range
            ? 1
            : 0),
        0,
      ) -
      a.towers.reduce(
        (s, t) =>
          s +
          (Math.hypot((t.cell % w) - (cell % w), Math.floor(t.cell / w) - Math.floor(cell / w)) < 3 ? 10 : 0),
        0,
      );
    const cell = candidates.sort((x, y) => score(y.i) - score(x.i))[0].i;
    build(a, kind, cell);
    for (let i = 0; i < 2; i++) upgrade(a, a.towers.at(-1)!.id);
  }
}
function finish(sim: Simulation, batch = 1) {
  while (!sim.done && sim.tick < 20000) sim.step(batch);
  assert.ok(sim.done, 'attack terminates');
  return sim.snapshot();
}
test('1,000 seeded boards are connected, stable and varied', () => {
  const layouts = new Set<string>();
  for (let i = 1; i <= 1000; i++) {
    const a = generateBoard(9876, i);
    assert.ok(validBoard(a));
    assert.deepEqual(a, generateBoard(9876, i));
    layouts.add(a.tiles.join(''));
  }
  assert.ok(layouts.size > 900);
});
test('placement, power, upgrades, and research prerequisites are enforced', () => {
  const a = attempt();
  const cell = a.board.tiles.indexOf(0);
  assert.throws(() => build(a, 'cannon', a.board.entries[0]));
  build(a, 'cannon', cell);
  assert.throws(() => build(a, 'cannon', cell));
  assert.throws(() => build(a, 'laser', a.board.tiles.indexOf(0, cell + 1)));
  a.credits = 10000;
  for (let i = 0; i < a.board.tiles.length; i++)
    if (
      a.board.tiles[i] === 0 &&
      !a.towers.some((t) => t.cell === i) &&
      powerUsed(a.towers, a) < powerCapacity(a)
    )
      build(a, 'cannon', i);
  assert.throws(() => build(a, 'cannon', a.board.tiles.lastIndexOf(0)), /Power/);
  const p = freshProfile();
  p.research = '1000';
  assert.throws(() => buyResearch(p, 'arsenal-2'));
  buyResearch(p, 'arsenal-1');
  buyResearch(p, 'arsenal-2');
  assert.equal(p.nodes.length, 2);
  assert.throws(() => build(a, 'reactor', a.board.tiles.lastIndexOf(0)), /socket/);
});
test('simulation is deterministic across tick batching / playback speeds', () => {
  const a = attempt();
  defend(a);
  const x = finish(new Simulation(structuredClone(a)), 1),
    y = finish(new Simulation(structuredClone(a)), 4);
  assert.deepEqual(x, y);
  assert.ok(x.won);
});
test('undefended core loses and attack terminates', () => {
  const s = finish(new Simulation(attempt()));
  assert.equal(s.won, false);
  assert.equal(s.core, 0);
  assert.ok(s.diagnostics.breaches > 0);
});
test('five attacks can be completed, next level unlocks, research remains, old layout is revisitable', () => {
  const p = freshProfile(44);
  p.nodes = RESEARCH.flatMap((n) => Array<string>(n.levels).fill(n.id));
  const a = startAttempt(p, 1);
  defend(a);
  assert.ok(a.frontier);
  const board = structuredClone(a.board);
  for (let wave = 1; wave <= 5; wave++) {
    a.wave = wave;
    const s = finish(new Simulation(a));
    assert.ok(s.won, `wave ${wave}`);
    a.core = s.core;
    a.kills += s.diagnostics.kills;
  }
  const earned = settle(p, a.id, true);
  assert.ok(earned > 0);
  assert.equal(p.unlocked, 2);
  assert.equal(p.active, null);
  assert.equal(p.traitOffers.length, 3, 'a frontier clear drafts a trait');
  assert.throws(() => startAttempt(p, 2), /trait/);
  chooseTrait(p, p.traitOffers[0]);
  assert.equal(p.traits.length, 1);
  const next = startAttempt(p, 2);
  assert.equal(next.towers.length, 0);
  assert.equal(next.research.length, p.nodes.length);
  assert.deepEqual(next.traits, p.traits);
  settle(p, next.id, false);
  assert.equal(p.traitOffers.length, 0, 'a lost attempt drafts nothing');
  const revisit = startAttempt(p, 1);
  assert.deepEqual(revisit.board, board);
  assert.ok(!revisit.frontier);
  assert.equal(revisit.farmed, 1);
});
test('sealed bottleneck accumulates pressure, fails open, and cannot deadlock', () => {
  const a = attempt();
  build(a, 'gate', choke(a));
  const s = finish(new Simulation(a));
  const gate = s.towers[0];
  assert.ok(gate.failed);
  assert.equal(gate.closed, false);
  assert.ok(s.diagnostics.events.some((e) => e.type === 'gate'));
  assert.equal(a.towers[0].closed, true, 'preparation checkpoint unchanged');
});
test('pressure routine prevents gate failure by opening it', () => {
  const a = attempt();
  build(a, 'gate', choke(a));
  a.rules = [template('pressure', 1)];
  const s = finish(new Simulation(a));
  assert.equal(s.towers[0].failed, false);
  assert.equal(s.towers[0].closed, false);
  assert.ok(s.diagnostics.rules['routine-1'].fired > 0);
});
test('automation validator catches invalid targets, numbers, and locked abilities', () => {
  const a = attempt();
  const r = template('heat', 1);
  r.value = NaN;
  assert.ok(validateRules([r], a).length);
  r.value = 50;
  r.action = 'purge';
  assert.ok(validateRules([r], a).length);
  r.action = 'overclock';
  r.target = 'missing';
  assert.ok(validateRules([r], a).length);
});
test('cohort conversion conserves population, health and single target / area damage', () => {
  const make = (id: number, count: number): Enemy => ({
    id,
    kind: 'virus',
    cell: 0,
    next: 1,
    progress: 100,
    maxHp: 32,
    speed: 45,
    bands: [{ hp: 32, count }],
  });
  const individual = [make(1, 1), make(2, 1), make(3, 1)];
  const merged = mergeCohorts(structuredClone(individual));
  assert.equal(merged.length, 1);
  assert.equal(population(merged[0]), 3);
  assert.equal(health(merged[0]), 96);
  const one = damageEnemy(merged[0], 100, false);
  assert.equal(one.killed, 1);
  assert.equal(population(merged[0]), 2);
  const aoe = damageEnemy(merged[0], 17, true);
  assert.equal(aoe.dealt, 34);
  assert.equal(health(merged[0]), 30);
  assert.equal(damageEnemy(merged[0], 15, true).killed, 2);
  assert.equal(population(merged[0]), 0);
});
test('grouped health damage matches a count-one reference under mixed hit sequences', () => {
  const grouped: Enemy = {
    id: 1,
    kind: 'virus',
    cell: 0,
    next: 1,
    progress: 0,
    maxHp: 32,
    speed: 45,
    bands: [{ hp: 32, count: 1000 }],
  };
  let reference = Array(1000).fill(32);
  for (let i = 0; i < 120; i++) {
    const area = i % 17 === 0,
      amount = (i % 11) + 1;
    damageEnemy(grouped, amount, area);
    if (area) reference = reference.map((h) => h - amount).filter((h) => h > 0);
    else if (reference.length) {
      reference[0] -= amount;
      if (reference[0] <= 0) reference.shift();
    }
    assert.equal(
      health(grouped),
      reference.reduce((a, b) => a + b, 0),
    );
    assert.equal(population(grouped), reference.length);
  }
});
test('million-member cohort stays bounded and area damage accounts for every member', () => {
  const a = attempt();
  const sim = new Simulation(a);
  sim.addEnemy('virus', 1_000_000, a.board.entries[0]);
  assert.equal(sim.enemies.length, 1);
  assert.equal(damageEnemy(sim.enemies[0], 1000, true).killed, 1_000_000);
});
test('arc hits four distinct represented members, matching individual enemies', () => {
  const a = attempt();
  a.research = ['arsenal-1', 'arsenal-2', 'arsenal-3'];
  a.credits = 500;
  const entry = a.board.entries[0];
  const cell = a.board.tiles[entry + a.board.width] === 0 ? entry + a.board.width : entry - a.board.width;
  build(a, 'arc', cell);
  const x = new Simulation(structuredClone(a)),
    y = new Simulation(structuredClone(a));
  x.addEnemy('virus', 10, entry);
  for (let i = 0; i < 10; i++) y.addEnemy('virus', 1, entry);
  x.step();
  y.step();
  assert.equal(x.towers[0].damage, y.towers[0].damage);
  assert.equal(
    x.enemies.reduce((s, e) => s + health(e), 0),
    y.enemies.reduce((s, e) => s + health(e), 0),
  );
});
test('temporary offers are stable; only one can be selected', () => {
  const a = attempt();
  a.wave = 2;
  a.phase = 'reward';
  a.offers = rewardOffers(a);
  assert.deepEqual(a.offers, rewardOffers(a));
  const id = a.offers[0];
  chooseReward(a, id);
  assert.equal(a.phase, 'prepare');
  assert.equal(a.perks.length, 1);
  assert.throws(() => chooseReward(a, id));
});
test('settlement is idempotent and defeat never subtracts research', () => {
  const p = freshProfile();
  p.research = '200';
  const a = startAttempt(p, 1);
  a.kills = 40;
  const id = a.id;
  const r = settle(p, id, false);
  assert.ok(r > 0);
  const balance = p.research;
  assert.equal(settle(p, id, false), 0);
  assert.equal(p.research, balance);
  assert.ok(BigInt(balance) > 200n);
});
test('save validation rejects malformed content without altering input', () => {
  const p = freshProfile(77);
  startAttempt(p, 1);
  assert.deepEqual(validateSave(p), p);
  const broken = structuredClone(p);
  broken.active!.towers = [
    { id: '<script>', kind: 'cannon', cell: 0, level: 1, closed: false, target: 'first', spent: 75 },
  ];
  assert.throws(() => validateSave(broken));
  const corrupt = structuredClone(p);
  corrupt.version = 999 as 1;
  assert.throws(() => validateSave(corrupt));
});
test('atomic storage saves checkpoint, rejects stale writers, and retains settled reward once', async () => {
  const store = new SaveStore();
  await store.open();
  const p = await store.load();
  const old = p.revision;
  startAttempt(p, 1);
  p.revision++;
  await store.save(p, old);
  assert.deepEqual(await store.load(), p);
  const stale = structuredClone(p);
  stale.research = '999';
  await assert.rejects(() => store.save(stale, old));
  assert.equal((await store.load()).research, '0');
  p.active!.kills = 15;
  settle(p, p.active!.id, false);
  const prev = p.revision++;
  await store.save(p, prev);
  const loaded = await store.load();
  assert.equal(loaded.active, null);
  assert.ok(BigInt(loaded.research) > 0n);
  store.close();
});

test('sector progression adds approaches, changes direction, and keeps all traces reachable', () => {
  for (const seed of [1, 44, 123, 9876]) {
    let previous = '';
    for (let level = 1; level <= 30; level++) {
      const board = generateBoard(seed, level);
      assert.equal(board.entries.length, entryCount(level));
      const d = distances(board);
      board.tiles.forEach((tile, cell) => {
        if (tile === 1) assert.ok(d[cell] >= 0, `disconnected trace in sector ${level}`);
      });
      const topology = board.tiles.map((t) => (t === 1 ? 1 : 0)).join('');
      assert.notEqual(topology, previous);
      previous = topology;
      const p = freshProfile(seed);
      p.unlocked = level;
      const a = startAttempt(p, level);
      assert.deepEqual(validateSave(p), p);
      finish(new Simulation(a), 4);
    }
    assert.ok(
      generateBoard(seed, 15).tiles.filter((t) => t === 2).length >
        generateBoard(seed, 1).tiles.filter((t) => t === 2).length,
    );
  }
});
test('legacy saves preserve active boards and refresh old cached layouts on the next attempt', () => {
  const p = freshProfile(44);
  const a = startAttempt(p, 1);
  a.board.version = 1;
  const original = structuredClone(a.board);
  assert.deepEqual(validateSave(p).active!.board, original);
  settle(p, a.id, false);
  const next = startAttempt(p, 1);
  assert.equal(next.board.version, BOARD_VERSION);
  settle(p, next.id, false);
  assert.deepEqual(startAttempt(p, 1).board, next.board);
});

test('death erases the whole run and saves a clean sector 000 restart', () => {
  const p = freshProfile(21);
  p.unlocked = 7;
  p.nodes = ['arsenal-1'];
  p.research = '999';
  const a = startAttempt(p, 7);
  a.core = 0;
  a.kills = 50;
  a.perks = ['payload'];
  p.traits = ['overvolt'];
  p.scars = ['leaky-bus'];
  p.farmed = { 3: 2 };
  assert.equal(settle(p, a.id, false), 0);
  assert.equal(p.research, '0');
  assert.deepEqual(p.nodes, []);
  assert.deepEqual(p.traits, []);
  assert.deepEqual(p.scars, []);
  assert.deepEqual(p.farmed, {});
  assert.equal(p.unlocked, 1);
  assert.equal(p.active, null);
  assert.equal(settle(p, a.id, false), 0);
  const saved = validateSave(p);
  const next = startAttempt(saved, 1);
  assert.equal(next.core, 100);
  assert.equal(next.credits, 360);
  assert.deepEqual(next.research, []);
  assert.deepEqual(next.perks, []);
  assert.deepEqual(next.towers, []);
  assert.deepEqual(next.rules, []);
});

test('Daemon breach applies temporary corruption, a permanent scar, and leeches steal credits', () => {
  const a = attempt();
  const sim = new Simulation(a);
  sim.addEnemy('boss', 1, a.board.core);
  sim.enemies[0].progress = 999;
  sim.step();
  assert.equal(sim.core, 70);
  assert.ok(sim.diagnostics.events.some((e) => e.type === 'malus' && e.text.includes('8.0s')));
  assert.equal(sim.diagnostics.scars.length, 1);
  assert.ok(sim.diagnostics.events.some((e) => e.type === 'scar' && e.text.includes('Permanent')));
  sim.addEnemy('leech', 1, a.board.core);
  sim.enemies[0].progress = 999;
  sim.step();
  assert.equal(sim.credits, a.credits - 15);
});

test('new weapons damage threats and armor-piercing weapons counter sentinels', () => {
  for (const kind of ['scatter', 'pulse', 'rail', 'shredder'] as TowerKind[]) {
    const a = attempt();
    const entry = a.board.entries[0];
    const cell = a.board.tiles[entry + a.board.width] === 0 ? entry + a.board.width : entry - a.board.width;
    assert.throws(() => build(a, kind, cell), /Unlock/);
    a.research = [TOWERS[kind].unlock!];
    build(a, kind, cell);
    const sim = new Simulation(a);
    sim.addEnemy('sentinel', 2, entry);
    sim.step();
    assert.ok(sim.towers[0].damage > 0, kind);
    if (kind === 'pulse' || kind === 'rail') assert.equal(sim.towers[0].damage, TOWERS[kind].damage * 2);
  }
});
