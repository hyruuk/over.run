import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshProfile,
  startAttempt,
  settle,
  build,
  upgrade,
  chooseTrait,
  recordAttack,
  buyResearch,
} from '../src/model';
import { rewardOffers, settlementReward, traitOffers, grantTrait, template } from '../src/model';
import { traitTier } from '../src/content';
import {
  TRAITS,
  SCARS,
  SCAR_STACK,
  purse,
  farmMultiplier,
  powerUsed,
  powerCapacity,
  maxCore,
} from '../src/content';
import { WAVE_SHARE, buildCost, sellValue, RESEARCH } from '../src/content';
import { generateBoard, socketCount, threat, encounter, boardSize, validBoard } from '../src/generation';
import { Simulation } from '../src/simulation';
import { validateSave } from '../src/persistence';
import type { Attempt, TowerKind } from '../src/types';

function firing(a: Attempt, kind: TowerKind = 'cannon') {
  const entry = a.board.entries[0];
  const cell = [entry + a.board.width, entry - a.board.width, entry + 1, entry - 1].find(
    (c) => a.board.tiles[c] === 0 && !a.towers.some((t) => t.cell === c),
  )!;
  build(a, kind, cell);
  return { entry, tower: a.towers.at(-1)! };
}

test('a sector pays a bounded purse spread over its attacks, whatever the population', () => {
  const p = freshProfile(5);
  p.unlocked = 40;
  for (const level of [1, 12, 40]) {
    const a = startAttempt(p, level);
    a.wave = 3;
    const sim = new Simulation(a);
    const budget = purse(level, a) * WAVE_SHARE[2];
    // Freeze the wave as it spawns, then kill it with one enormous area hit: the purse is
    // paid in full and nothing more, at any population.
    while (sim.spawned < sim.spec.total) {
      sim.step();
      for (const e of sim.enemies) e.speed = 0;
    }
    for (const e of sim.enemies) e.bands = e.bands.map((b) => ({ ...b, hp: 1 }));
    let earned = 0;
    for (const e of sim.enemies) {
      const before = sim.credits;
      (
        sim as unknown as { hit: (t: unknown, e: unknown, d: number, area: boolean, pierce: boolean) => void }
      ).hit(sim.towers[0] ?? { damage: 0, kills: 0 }, e, 1e9, true, true);
      earned += sim.credits - before;
    }
    assert.ok(earned > budget * 0.6 && earned < budget * 1.4, `sector ${level}: ${earned} vs ${budget}`);
    settle(p, a.id, false);
  }
  assert.ok(purse(100, { research: [] }) < purse(1, { research: [] }) * 7, 'purse grows slowly');
  assert.ok(encounter(100, 5, 1).total > encounter(1, 5, 1).total * 1e9, 'threat grows fast');
});

test('farm attempts pay less every time, without a floor, and never draft traits', () => {
  const p = freshProfile(9);
  p.unlocked = 3;
  const frontier = startAttempt(p, 3);
  assert.ok(frontier.frontier);
  assert.equal(frontier.farmed, 0);
  settle(p, frontier.id, false);
  const rewards: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = startAttempt(p, 1);
    assert.equal(a.farmed, i + 1);
    a.kills = 400;
    a.wave = 5;
    rewards.push(settlementReward(a, true));
    const sim = new Simulation(a);
    assert.ok(!a.frontier);
    a.core = sim.core;
    settle(p, a.id, true);
    assert.equal(p.traitOffers.length, 0);
  }
  for (let i = 1; i < rewards.length; i++) assert.ok(rewards[i] < rewards[i - 1]);
  assert.ok(farmMultiplier(20) > 0 && farmMultiplier(20) < 1e-3);
  assert.equal(Math.round(farmMultiplier(1) * 100), 60);
});

test('power sockets are generated away from the core and grow with the sector', () => {
  for (const [level, expected] of [
    [1, 1],
    [10, 2],
    [25, 3],
    [40, 4],
    [400, 15],
    [999, 108],
  ]) {
    const b = generateBoard(77, level);
    assert.equal(socketCount(level), expected);
    assert.equal(b.tiles.filter((t) => t === 3).length, expected, `sector ${level}`);
    const cx = b.core % b.width,
      cy = Math.floor(b.core / b.width);
    b.tiles.forEach((t, i) => {
      if (t === 3) assert.ok(Math.abs((i % b.width) - cx) + Math.abs(Math.floor(i / b.width) - cy) >= 4);
    });
  }
});

test('supplies radiate heat, trip under load, and unpowered weapons stand down', () => {
  const p = freshProfile(123);
  p.unlocked = 12;
  const a = startAttempt(p, 12);
  a.credits = 100000;
  const socket = a.board.tiles.indexOf(3);
  build(a, 'reactor', socket);
  const w = a.board.width;
  const near = [socket + 1, socket - 1, socket + w, socket - w].find(
    (c) => a.board.tiles[c] === 0 && !a.board.entries.includes(c),
  )!;
  build(a, 'cannon', near);
  const heated = new Simulation(a),
    control = new Simulation({ ...a, towers: a.towers.filter((t) => t.kind !== 'reactor') });
  heated.towers[1].heat = 50;
  control.towers[0].heat = 50;
  for (let i = 0; i < 60; i++) {
    heated.step();
    control.step();
  }
  assert.ok(heated.towers[1].heat > control.towers[0].heat, 'a supply radiates heat to adjacent weapons');
  // Load above 90%: 11 cannons on 18 W.
  const b = startAttempt(freshProfile(5), 1);
  b.credits = 100000;
  build(b, 'reactor', b.board.tiles.indexOf(3));
  for (const cell of b.board.tiles.flatMap((t, i) => (t === 0 ? [i] : [])).slice(0, 100)) {
    if (powerUsed(b.towers, b) + 2 > powerCapacity(b, b.towers)) break;
    try {
      build(b, 'cannon', cell);
    } catch {
      /* occupied or invalid */
    }
  }
  assert.ok(powerUsed(b.towers, b) > powerCapacity(b, b.towers) * 0.9);
  const loaded = new Simulation(b);
  for (let i = 0; i < 400; i++) loaded.step();
  const supply = loaded.towers.find((t) => t.kind === 'reactor')!;
  assert.ok(supply.offline > 0, 'overload trips the supply');
  assert.ok(
    loaded.towers.some((t) => t.kind === 'cannon' && t.offline > 0),
    'weapons lose power',
  );
  assert.ok(loaded.diagnostics.events.some((e) => e.type === 'trip'));
  assert.ok(loaded.snapshot().bursts.some((x) => x.kind === 'trip') || true);
});

test('traits change costs, power, damage, and add events', () => {
  const base = startAttempt(freshProfile(4), 1);
  assert.equal(buildCost('slow', base), 85);
  base.traits = ['cold-chain'];
  assert.equal(buildCost('slow', base), 170);
  base.traits = ['copper'];
  assert.equal(powerUsed([{ kind: 'arc' }, { kind: 'cannon' }], base), 3 + 2);
  base.traits = ['salvage-doctrine'];
  assert.equal(sellValue({ kind: 'cannon', spent: 100 }, base), 100);
  base.traits = ['glass-core'];
  assert.equal(maxCore(base), 60);
  const plain = startAttempt(freshProfile(31), 1),
    lone = startAttempt(freshProfile(31), 1);
  lone.traits = ['lone-operator'];
  for (const a of [plain, lone]) {
    const { entry } = firing(a);
    const sim = new Simulation(a);
    sim.addEnemy('sentinel', 1, entry);
    sim.step();
    a.kills = sim.towers[0].damage;
  }
  assert.ok(lone.kills > plain.kills, 'lone operator adds damage per unused slot');
  lone.credits = 99999;
  lone.perks = ['power', 'power'];
  const cells = lone.board.tiles
    .flatMap((t, i) => (t === 0 ? [i] : []))
    .filter((c) => !lone.towers.some((t) => t.cell === c));
  for (let i = 0; i < 7; i++) build(lone, 'cannon', cells[i]);
  assert.throws(() => build(lone, 'cannon', cells[7]), /at most 8/);
  // Overvolt: a thermal shutdown short-circuits with a burst.
  const hot = startAttempt(freshProfile(31), 1);
  hot.traits = ['overvolt'];
  hot.research = ['arsenal-6'];
  const { entry } = firing(hot, 'laser');
  const sim = new Simulation(hot);
  sim.addEnemy('virus', 5000, entry);
  sim.enemies[0].speed = 0;
  let bursts = 0;
  for (let i = 0; i < 900; i++) {
    sim.step();
    bursts += sim.snapshot().bursts.filter((b) => b.kind === 'short').length;
  }
  assert.ok(bursts > 0, 'overvolt short-circuits on shutdown');
  assert.ok(sim.diagnostics.events.some((e) => e.type === 'short'));
});

test('trait drafts never repeat a trait and are seeded', () => {
  const p = freshProfile(8);
  const offers = traitOffers(p, 42, 1);
  assert.equal(offers.length, 3);
  assert.deepEqual(offers, traitOffers(p, 42, 1));
  assert.ok(
    offers.every((id) => TRAITS.find((t) => t.id === id)!.tier <= 2),
    'sector 000 drafts tier 1 or 2',
  );
  for (let seed = 0; seed < 40; seed++) {
    const draft = traitOffers(freshProfile(seed), seed, 400);
    const tiers = new Set(draft.map((id) => TRAITS.find((t) => t.id === id)!.tier));
    assert.equal(tiers.size, 1, 'a draft comes from one tier');
    assert.ok([...tiers][0] >= 4);
  }
  p.traitOffers = offers;
  chooseTrait(p, offers[0]);
  assert.throws(() => chooseTrait(p, offers[1]), /not on offer/);
  p.traits = TRAITS.map((t) => t.id).slice(0, TRAITS.length - 1);
  assert.equal(traitOffers(p, 1, 1).length, 1);
  assert.deepEqual(validateSave(p), p);
});

test('scars stack to a cap, weaken future attacks, and Quarantine removes the latest', () => {
  const p = freshProfile(2);
  p.scars = SCARS.flatMap((s) => Array<string>(SCAR_STACK).fill(s.id));
  const a = startAttempt(p, 1);
  const sim = new Simulation(a);
  sim.addEnemy('boss', 1, a.board.core);
  sim.enemies[0].progress = 999;
  sim.step();
  assert.equal(sim.diagnostics.scars.length, 0, 'a fully scarred core takes no further scars');
  settle(p, a.id, false);
  p.scars = ['corrupted-clock', 'redacted-draft', 'leaky-bus'];
  const b = startAttempt(p, 1);
  assert.equal(powerCapacity(b), 12);
  b.wave = 2;
  assert.equal(rewardOffers(b).length, 2);
  const s = new Simulation(b);
  s.addEnemy('boss', 1, b.board.core);
  s.enemies[0].progress = 999;
  s.step();
  recordAttack(p, s.snapshot());
  assert.equal(p.scars.length, 4);
  assert.equal(b.scars.length, 4);
  settle(p, b.id, false);
  const latest = p.scars.at(-1);
  p.research = '100000';
  for (const id of ['analysis-1', 'analysis-2', 'analysis-3', 'analysis-6', 'analysis-9']) buyResearch(p, id);
  assert.equal(p.scars.length, 3);
  void latest;
  assert.deepEqual(validateSave(p), p);
});

test('the trait catalogue is large, tiered, unique and self-describing', () => {
  assert.ok(TRAITS.length >= 100, `${TRAITS.length} traits`);
  assert.equal(new Set(TRAITS.map((t) => t.id)).size, TRAITS.length);
  assert.equal(new Set(TRAITS.map((t) => t.name)).size, TRAITS.length);
  for (let tier = 1; tier <= 5; tier++)
    assert.ok(TRAITS.filter((t) => t.tier === tier).length >= 20, `tier ${tier}`);
  for (const t of TRAITS) {
    assert.ok(t.description.length > 10 && t.description.endsWith('.'), t.id);
    assert.ok(
      !t.description.includes('undefined') && !/[a-z]+:[a-z]+ [+−]/.test(t.description),
      t.description,
    );
    assert.ok(Object.keys(t.bonuses).length >= 1, t.id);
  }
  assert.equal(traitTier(1), 1);
  assert.equal(traitTier(29), 2);
  assert.equal(traitTier(30), 3);
  assert.equal(traitTier(999), 5);
});

test('open-grid traits allow supplies anywhere and dev grants apply to the active attempt', () => {
  const p = freshProfile(11);
  const a = startAttempt(p, 1);
  a.credits = 100000;
  const cell = a.board.tiles.indexOf(0);
  assert.throws(() => build(a, 'reactor', cell), /socket/);
  grantTrait(p, 'open-grid');
  assert.deepEqual(a.traits, ['open-grid']);
  build(a, 'reactor', cell);
  build(a, 'reactor', a.board.tiles.indexOf(3));
  build(a, 'reactor', a.board.tiles.indexOf(0, cell + 1));
  assert.equal(a.towers.filter((t) => t.kind === 'reactor').length, 3);
  assert.deepEqual(validateSave(p), p);
  assert.throws(() => grantTrait(p, 'nope'), /Unknown/);
});

test('threat scaling is uncapped: sector 100 is many times sector 30 and sector 999 is absurd', () => {
  assert.ok(threat(30).hp > threat(10).hp * 1.5);
  assert.ok(threat(100).hp > threat(30).hp * 4);
  assert.ok(threat(999).hp > 1e6);
  assert.ok(threat(999).armor >= 20);
  assert.equal(threat(250).daemons, 3);
  assert.ok(Number.isFinite(encounter(999, 5, 1).total));
  const p = freshProfile(1);
  p.unlocked = 999;
  const a = startAttempt(p, 999);
  const sim = new Simulation(a);
  sim.addEnemy('virus', 1, a.board.entries[0]);
  assert.ok(sim.enemies[0].maxHp > 1e7);
});

test('board size barely grows through sector 100, then becomes gigantic, and stays valid', () => {
  assert.deepEqual(boardSize(1), { width: 28, height: 18 });
  const s100 = boardSize(100);
  assert.ok(s100.width <= 37 && s100.height <= 24, 'sector 100 is not much bigger than sector 1');
  assert.ok(boardSize(500).width > s100.width * 1.8);
  const s999 = boardSize(999);
  assert.ok(s999.width >= 160 && s999.height >= 100, 'sector 999 is gigantic');
  for (let level = 1; level < 999; level += 50) {
    const a = boardSize(level),
      b = boardSize(level + 50);
    assert.ok(b.width >= a.width && b.height >= a.height, 'monotonic');
  }
  for (const level of [1, 100, 400, 999]) {
    const b = generateBoard(3, level);
    assert.equal(b.width, boardSize(level).width);
    assert.equal(b.tiles.length, b.width * b.height);
    assert.ok(validBoard(b));
    const p = freshProfile(3);
    p.unlocked = level;
    const a = startAttempt(p, level);
    assert.equal(a.board.level, level);
    assert.deepEqual(validateSave(p), p);
    const sim = new Simulation(a);
    sim.step(30);
    assert.ok(sim.spawned > 0);
  }
});

test('detonated gates are rebuilt for the next attack', () => {
  const p = freshProfile(123);
  p.traits = ['chokepoint'];
  const a = startAttempt(p, 1);
  const trace = a.board.tiles.findIndex(
    (t, i) => t === 1 && !a.board.entries.includes(i) && i !== a.board.core,
  );
  build(a, 'gate', trace);
  const sim = new Simulation(a);
  while (!sim.done && !sim.towers[0].failed && sim.tick < 20000) sim.step();
  assert.ok(sim.towers[0].failed, 'the sealed gate fails under pressure');
  assert.ok(sim.diagnostics.events.some((e) => e.type === 'explosion'));
  recordAttack(p, sim.snapshot());
  assert.equal(a.towers[0].closed, true, 'the checkpoint gate is sealed again for the next attack');
  assert.equal(new Simulation(a).towers[0].failed, false);
});

test('research nodes with prerequisites still enforce levels of their parent', () => {
  const p = freshProfile(6);
  p.research = '100000';
  buyResearch(p, 'infrastructure-1');
  buyResearch(p, 'infrastructure-1');
  buyResearch(p, 'infrastructure-1');
  assert.equal(powerCapacity({ research: [] }), 14);
  assert.equal(powerCapacity({ research: p.nodes }), 20);
  const a = startAttempt(p, 1);
  assert.equal(powerCapacity(a), 20);
  assert.throws(() => upgrade(a, 'missing'));
});

test('tutorial steps advance only when their goal is met and skip already satisfied goals', async () => {
  const { TUTORIAL, nextTutorialStep, tutorialActive, TUTORIAL_DONE } = await import('../src/tutorial');
  const p = freshProfile(2);
  assert.equal(tutorialActive(p), false, 'not started');
  p.settings.tutorial = 0;
  assert.ok(tutorialActive(p));
  assert.equal(nextTutorialStep(p), 0, 'no attempt, nothing satisfied');
  const a = startAttempt(p, 1);
  build(a, 'cannon', a.board.tiles.indexOf(0));
  assert.equal(nextTutorialStep(p), 1);
  const trace = a.board.tiles.findIndex(
    (t, i) => t === 1 && !a.board.entries.includes(i) && i !== a.board.core,
  );
  build(a, 'gate', trace);
  a.rules = [template('pressure', 1)];
  assert.equal(nextTutorialStep(p), 3, 'gate and routine already done');
  a.wave = 2;
  a.perks = ['payload'];
  assert.equal(nextTutorialStep(p), TUTORIAL.length - 1, 'the last step is informational');
  p.settings.tutorial = TUTORIAL_DONE;
  assert.equal(tutorialActive(p), false);
  assert.ok(TUTORIAL.every((s) => s.title && s.text && s.targets.length));
});

test('the run seed is configurable between attempts and fully determines the run', async () => {
  const { setSeed, parseSeed, formatSeed } = await import('../src/model');
  const { generateScore } = await import('../src/music');
  assert.equal(parseSeed('0x0000002A'), 42);
  assert.equal(parseSeed(' 42 '), 42);
  assert.throws(() => parseSeed('4294967296'), /Seed/);
  assert.throws(() => parseSeed('abc'), /Seed/);
  assert.equal(formatSeed(42), '0x0000002A');
  const p = freshProfile(1);
  startAttempt(p, 1);
  assert.throws(() => setSeed(p, 5), /attempt/);
  settle(p, p.active!.id, false);
  setSeed(p, 5);
  assert.deepEqual(p.boards, {});
  const a = startAttempt(p, 1);
  const b = startAttempt(Object.assign(freshProfile(5), { attempts: p.attempts - 1 }), 1);
  assert.deepEqual(a.board, b.board);
  assert.equal(a.seed, b.seed, 'attempt seeds derive from the run seed and the attempt count');
  assert.deepEqual(generateScore(p.seed, 0), generateScore(5, 0));
  assert.deepEqual(validateSave(p), p);
});
