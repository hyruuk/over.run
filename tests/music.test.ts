import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MELODY_LIBRARY } from '../src/melodies';
import { generateScore, musicNotes, tunedFrequency, TUNINGS } from '../src/music';
import { GENRES, FILLS, validateBanks } from '../src/beats';
import { freshProfile } from '../src/model';
import { validateSave } from '../src/persistence';

test('128 distinct sourced phrases ship with their original MIDI and attribution', () => {
  const credits = JSON.parse(readFileSync('public/music/credits.json', 'utf8'));
  assert.equal(MELODY_LIBRARY.length, 128);
  assert.equal(credits.tunes.length, 128);
  assert.equal(new Set(MELODY_LIBRARY.map((m) => JSON.stringify(m.notes))).size, 128);
  for (const phrase of MELODY_LIBRARY) {
    const record = credits.tunes.find((t: { id: string }) => t.id === phrase.id);
    assert.ok(record && record.source.includes(credits.commit));
    assert.equal(record.license, 'CC-BY-4.0');
    const data = readFileSync(`public/music/sources/${record.sourceFile}`);
    assert.equal(data.subarray(0, 4).toString(), 'MThd');
    assert.equal(createHash('sha256').update(data).digest('hex'), record.sha256);
    assert.ok(phrase.notes.length >= 16);
    let end = 0;
    for (const [step, degree, length] of phrase.notes) {
      assert.ok(Number.isInteger(step) && Number.isInteger(degree) && Number.isInteger(length));
      assert.ok(step >= end && length > 0 && step + length <= 64);
      end = step + length;
    }
  }
});

test('every melody is visited before repeating and procedural edits preserve its authored rhythm', () => {
  const original = JSON.stringify(MELODY_LIBRARY),
    visited = new Set();
  for (let sector = 0; sector < 128; sector++) {
    const score = generateScore(42, sector);
    visited.add(score.melodyId);
    const source = MELODY_LIBRARY.find((m) => m.id === score.melodyId)!;
    assert.deepEqual(
      score.melody.map((n) => [n[0], n[2]]),
      source.notes.map((n) => [n[0], n[2]]),
    );
    const changed = score.melody.filter((n, i) => n[1] !== source.notes[i][1]);
    assert.ok(changed.length <= 1);
    for (const n of changed) {
      assert.notEqual(n[0] % 4, 0);
      const base = source.notes.find((b) => b[0] === n[0])!;
      assert.equal(Math.abs(base[1] - n[1]), 1);
    }
    const lead = Array.from({ length: 64 }, (_, step) => ({
      step,
      notes: musicNotes(score, step).filter((n) => n.instrument === 'lead'),
    })).filter((n) => n.notes.length);
    assert.deepEqual(
      lead.map((n) => n.step),
      source.notes.map((n) => n[0]),
    );
    for (const { notes } of lead) assert.ok(notes[0].delay >= 0 && notes[0].delay <= 0.006);
  }
  assert.equal(visited.size, 128);
  assert.equal(generateScore(42, 128).melodyId, generateScore(42, 0).melodyId);
  assert.equal(JSON.stringify(MELODY_LIBRARY), original);
});

test('tunings change interval ratios while bass, lead and pads share exact octaves', () => {
  const thirds = new Set<number>();
  for (const tuning of TUNINGS) {
    const score = {
      ...generateScore(0, 0),
      tonic: 69,
      referenceHz: 440,
      mode: 'major' as const,
      tuning: tuning.id,
    };
    assert.equal(tunedFrequency(score, 0), 440);
    assert.equal(tunedFrequency(score, 7), 880);
    assert.equal(tunedFrequency(score, -7), 220);
    thirds.add(tunedFrequency(score, 2));
    for (let degree = -14; degree < 21; degree++)
      assert.ok(tunedFrequency(score, degree + 1) >= tunedFrequency(score, degree));
    assert.equal(tunedFrequency({ ...score, referenceHz: 432 }, 0), 432);
  }
  assert.ok(thirds.size >= 4, 'tuning is more than transposing the same equal-tempered scale');
  const score = {
    ...generateScore(0, 0),
    tonic: 69,
    referenceHz: 440,
    mode: 'major' as const,
    tuning: 'rational' as const,
  };
  assert.equal(tunedFrequency(score, 2), 550);
  assert.equal(tunedFrequency(score, 4), 660);
});

test('music defaults on for new and legacy profiles while an explicit mute survives', () => {
  const p = freshProfile(4);
  assert.equal(p.settings.music, true);
  delete p.settings.music;
  p.settings.sound = false;
  const loaded = validateSave(p);
  assert.equal(loaded.settings.music, true);
  assert.equal(loaded.settings.sound, false);
  assert.equal(p.settings.music, undefined, 'migration does not mutate imported data');
  loaded.settings.music = false;
  assert.equal(validateSave(loaded).settings.music, false);
  const bad = structuredClone(loaded);
  (bad.settings as unknown as { music: unknown }).music = 'on';
  assert.throws(() => validateSave(bad), /settings/);
});

test('rhythm banks are well formed and large, and every genre is reachable', () => {
  assert.deepEqual(validateBanks(), []);
  assert.equal(GENRES.length, 5);
  for (const g of GENRES) {
    assert.ok(g.kicks.length >= 8 && g.snares.length >= 6 && g.hats.length >= 6, g.id);
    assert.ok(g.openHats.length >= 3 && g.percussion.length >= 4 && g.bass.length >= 6, g.id);
  }
  assert.ok(FILLS.length >= 10);
  const seen = new Set<string>(),
    names = new Set<string>();
  for (let sector = 0; sector < 40; sector++) {
    const score = generateScore(7, sector);
    seen.add(score.genre);
    names.add(score.name);
    assert.ok(score.name.length >= 6 && score.name !== score.title, score.name);
  }
  assert.equal(seen.size, 5, 'random genres cover every genre');
  assert.ok(names.size >= 30, 'generated names vary');
  assert.equal(generateScore(7, 3).name, generateScore(7, 3).name, 'names are deterministic');
  assert.notEqual(generateScore(7, 3, 0).name, generateScore(7, 3, 1).name, 'a reroll renames the track');
  for (const g of GENRES) {
    const score = generateScore(7, 3, 0, g.id);
    assert.equal(score.genre, g.id);
    assert.ok(score.bpm >= g.bpm[0] && score.bpm <= g.bpm[1]);
  }
});

test('rerolling an arrangement redraws everything: melody, tuning, key, name and rhythm parts', () => {
  const a = generateScore(99, 4, 0),
    b = generateScore(99, 4, 1);
  assert.notEqual(a.melodyId, b.melodyId);
  assert.notEqual(a.tuning, b.tuning);
  assert.notEqual(a.tonic, b.tonic);
  assert.notEqual(a.name, b.name);
  assert.notDeepEqual(a.rhythm, b.rhythm);
  assert.deepEqual(generateScore(99, 4, 1), b, 'a variant is deterministic');
  const arrangements = new Set<string>();
  for (let v = 0; v < 40; v++) arrangements.add(JSON.stringify(generateScore(99, 4, v).rhythm));
  assert.ok(arrangements.size >= 38, 'variants draw distinct pattern combinations');
});

test('each attack adds a layer: more instruments, never fewer, and the bare layer is kick and bass', () => {
  const score = generateScore(5, 2);
  const instruments = (layer: number) => {
    const set = new Set<string>();
    for (let step = 0; step < 512; step++)
      for (const n of musicNotes(score, step, layer)) set.add(n.instrument);
    return set;
  };
  let previous = new Set<string>();
  for (let layer = 1; layer <= 5; layer++) {
    const now = instruments(layer);
    for (const i of previous) assert.ok(now.has(i), `layer ${layer} keeps ${i}`);
    assert.ok(now.size > previous.size, `layer ${layer} adds something`);
    previous = now;
  }
  const bare = instruments(1);
  assert.ok(bare.has('kick') && bare.has('bass') && !bare.has('lead') && !bare.has('snare'));
  assert.ok(instruments(3).has('lead') && !instruments(2).has('lead'));
  assert.ok(instruments(5).has('stab') && instruments(4).has('ohat'));
});

test('bars vary: alternate patterns, fills on phrase ends, and swing only in swung genres', () => {
  const dnb = generateScore(3, 0, 0, 'dnb'),
    garage = generateScore(3, 0, 0, 'garage');
  const drumsOf = (score: typeof dnb, bar: number) =>
    Array.from({ length: 16 }, (_, beat) =>
      musicNotes(score, bar * 16 + beat)
        .filter((n) => ['kick', 'snare', 'clap', 'hat', 'tom'].includes(n.instrument))
        .map((n) => n.instrument)
        .join(','),
    ).join('|');
  const bars = new Set<string>();
  for (let bar = 0; bar < 32; bar++) bars.add(drumsOf(dnb, bar));
  assert.ok(bars.size >= 6, `${bars.size} distinct drum bars in 32`);
  const odd = [1, 3, 5, 7, 9, 11, 13, 15];
  assert.ok(
    odd.some((step) => musicNotes(garage, step).some((n) => n.delay > 0.012)),
    'garage off-beats swing',
  );
  for (const step of odd)
    assert.ok(
      musicNotes(dnb, step).every((n) => n.instrument === 'lead' || n.instrument === 'echo' || n.delay === 0),
    );
});

test('track codes round-trip and reproduce the score exactly', async () => {
  const { encodeTrack, decodeTrack } = await import('../src/music');
  const track = { seed: 0x52c44db4, sector: 7, arrangement: 7919 * 3 };
  const code = encodeTrack(track);
  assert.match(code, /^OVR-[0-9A-F]{8}-\d{3}-[0-9A-F]{8}$/);
  assert.deepEqual(decodeTrack(code), track);
  assert.deepEqual(decodeTrack(` ${code.toLowerCase()} `), track);
  assert.equal(decodeTrack('OVR-1234-5-6'), null);
  assert.equal(decodeTrack('nope'), null);
  const decoded = decodeTrack(code)!;
  assert.deepEqual(
    generateScore(decoded.seed, decoded.sector, decoded.arrangement),
    generateScore(track.seed, track.sector, track.arrangement),
  );
});

test('the calm rendition keeps the melody and key but drops the snare, fills and stabs', async () => {
  const { calmNotes } = await import('../src/music');
  const score = generateScore(11, 6);
  const calm = new Set<string>(),
    full = new Set<string>();
  const calmLead: number[] = [],
    fullLead: number[] = [];
  for (let step = 0; step < 256; step++) {
    for (const n of calmNotes(score, step)) {
      calm.add(n.instrument);
      if (n.instrument === 'lead') calmLead.push(n.hz);
    }
    for (const n of musicNotes(score, step)) {
      full.add(n.instrument);
      if (n.instrument === 'lead') fullLead.push(n.hz);
    }
  }
  for (const i of ['snare', 'clap', 'stab', 'ohat', 'perc', 'tom']) assert.ok(!calm.has(i), i);
  assert.ok(calm.has('lead') && calm.has('pad') && calm.has('bass') && full.has('lead'));
  assert.equal(calmLead.length, fullLead.length, 'same melody');
  for (let i = 0; i < calmLead.length; i++)
    assert.ok(Math.abs(calmLead[i] / fullLead[i] - 2) < 1e-6, 'one octave up');
});
