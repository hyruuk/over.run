import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, startAttempt, settle, build, upgrade, sell, chooseTrait } from '../src/model';
import { powerCapacity } from '../src/content';
import { validateSave } from '../src/persistence';
import { Simulation } from '../src/simulation';
import { generateScore, TUNINGS, tunedFrequency } from '../src/music';

test('credits persist across settlement, save reload and next sector, without repeat grants', () => {
  let p = freshProfile(123);
  let a = startAttempt(p, 1);
  a.credits = 731;
  settle(p, a.id, true);
  chooseTrait(p, p.traitOffers[0]);
  p = validateSave(p);
  a = startAttempt(p, 2);
  assert.equal(a.credits, 731);
  settle(p, a.id, false);
  assert.equal(startAttempt(p, 2).credits, 731);
  p.active!.core = 0;
  settle(p, p.active!.id, false);
  assert.equal(startAttempt(p, 1).credits, 360);
});

test('power supplies expand capacity, upgrades add output, and live supplies cannot be recycled', () => {
  const a = startAttempt(freshProfile(123), 1);
  a.credits = 10000;
  const cells = a.board.tiles.flatMap((t, i) => (t === 0 ? [i] : []));
  const sockets = a.board.tiles.flatMap((t, i) => (t === 3 ? [i] : []));
  assert.equal(sockets.length, 1, 'sector 000 has one socket');
  assert.throws(() => build(a, 'reactor', cells[0]), /socket/);
  assert.throws(() => build(a, 'cannon', sockets[0]), /empty grid cell/);
  build(a, 'reactor', sockets[0]);
  assert.equal(a.credits, 10000 - 300);
  assert.equal(powerCapacity(a, a.towers), 18);
  upgrade(a, a.towers[0].id);
  assert.equal(powerCapacity(a, a.towers), 20);
  upgrade(a, a.towers[0].id);
  assert.throws(() => upgrade(a, a.towers[0].id), /Maximum/);
  assert.equal(a.towers[0].level, 3);
  for (let i = 0; i < 11; i++) build(a, 'cannon', cells.shift()!);
  assert.throws(() => build(a, 'cannon', cells.shift()!), /Power capacity/);
  assert.throws(() => sell(a, a.towers[0].id), /powers installed/);
  for (const t of [...a.towers].slice(1, 5)) sell(a, t.id);
  const before = a.credits;
  sell(a, a.towers[0].id);
  assert.equal(a.credits, before, 'supplies are never refunded');
  assert.equal(powerCapacity(a, a.towers), 14);
});

test('a custom vent routine prevents shutdown and improves sustained damage', () => {
  const a = startAttempt(freshProfile(123), 1),
    entry = a.board.entries[0];
  const cell = [entry + 28, entry - 28].find((c) => a.board.tiles[c] === 0)!;
  build(a, 'cannon', cell);
  const run = (vent: boolean) => {
    const copy = structuredClone(a);
    if (vent)
      copy.rules = [
        {
          id: 'custom',
          sensor: 'heat',
          compare: 'above',
          value: 65,
          target: 'all',
          action: 'vent',
          repeat: 5,
          enabled: true,
        },
      ];
    const sim = new Simulation(copy);
    sim.addEnemy('virus', 10000, entry);
    sim.enemies[0].speed = 0;
    for (let i = 0; i < 1800; i++) sim.step();
    return sim;
  };
  const plain = run(false),
    automated = run(true);
  assert.ok(plain.towers[0].damage < automated.towers[0].damage);
  assert.ok(plain.diagnostics.events.some((e) => e.text.includes('thermal shutdown')));
  assert.ok(automated.diagnostics.rules.custom.fired > 0);
});

test('twelve palettes and deployment seeds produce stable, distinct arrangements', () => {
  assert.equal(TUNINGS.length, 12);
  assert.deepEqual(generateScore(12, 2, 99), generateScore(12, 2, 99));
  assert.notDeepEqual(generateScore(12, 2, 99), generateScore(12, 2, 100));
  for (const tuning of ['gong', 'yu', 'bhupali', 'hirajoshi'] as const) {
    const score = { ...generateScore(12, 2), tuning };
    assert.equal(new Set(Array.from({ length: 7 }, (_, i) => tunedFrequency(score, i))).size, 5);
  }
});
