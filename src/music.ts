import { rng } from './generation';
import { MELODY_LIBRARY, type Mode, type PhraseNote } from './melodies';
import { GENRES, FILLS, genre as genreSpec, hits, bassDegree, type Genre } from './beats';

const MODES: Record<Mode, readonly number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};
export const TUNINGS = [
  { id: 'equal', name: '12-tone equal' },
  { id: 'rational', name: 'Just-interval palette' },
  { id: 'fifths', name: 'Pythagorean fifths' },
  { id: 'nineteen', name: '19-tone equal' },
  { id: 'gong', name: 'Chinese gong-inspired pentatonic' },
  { id: 'yu', name: 'Chinese yu-inspired pentatonic' },
  { id: 'bhupali', name: 'Bhupali-inspired just pentatonic' },
  { id: 'yaman', name: 'Yaman-inspired raised fourth' },
  { id: 'bhairav', name: 'Bhairav-inspired palette' },
  { id: 'hirajoshi', name: 'Hirajoshi-inspired pentatonic' },
  { id: 'twentyfour', name: '24-tone lattice' },
  { id: 'thirtyone', name: '31-tone equal' },
] as const;
export type Tuning = (typeof TUNINGS)[number]['id'];
/** The rhythm parts drawn from the genre banks for one arrangement: two of each, alternated per bar. */
export interface Rhythm {
  kicks: [string, string];
  snares: [string, string];
  hats: [string, string, string];
  openHats: string;
  percussion: [string, string];
  bass: [string, string];
  fills: [string, string];
}
export interface SectorScore {
  seed: number;
  sector: number;
  genre: Genre;
  bpm: number;
  swing: number;
  tonic: number;
  referenceHz: number;
  tuning: Tuning;
  mode: Mode;
  melodyId: string;
  progression: readonly number[];
  melody: readonly PhraseNote[];
  rhythm: Rhythm;
  voice: OscillatorType;
  /** Generated track name shown to the player. */
  name: string;
  /** Title of the sourced melody excerpt, for attribution. */
  title: string;
}
export type Instrument =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'ghost'
  | 'hat'
  | 'ohat'
  | 'perc'
  | 'tom'
  | 'bass'
  | 'lead'
  | 'echo'
  | 'pad'
  | 'stab';
export interface MusicNote {
  instrument: Instrument;
  hz: number;
  duration: number;
  velocity: number;
  delay: number;
}
export const MUSIC_GENRES = ['auto', ...GENRES.map((g) => g.id)] as const;
/** Genres are drawn at random per sector and arrangement; a reroll can change the genre too. */
export const autoGenre = (seed: number, sector: number, arrangement = 0): Genre =>
  GENRES[
    Math.floor(
      rng((seed ^ Math.imul(sector + 7, 0x9e3779b1) ^ Math.imul(arrangement + 1, 0x85ebca6b)) >>> 0)() *
        GENRES.length,
    )
  ].id;
const NAME_HEADS = [
  'null',
  'root',
  'kernel',
  'ghost',
  'packet',
  'daemon',
  'zero',
  'cipher',
  'buffer',
  'phantom',
  'shadow',
  'proxy',
  'glitch',
  'static',
  'neon',
  'silicon',
  'phosphor',
  'hex',
  'byte',
  'stack',
];
const NAME_TAILS = [
  'overflow',
  'pointer',
  'panic',
  'runner',
  'storm',
  'cascade',
  'injection',
  'drift',
  'lullaby',
  'protocol',
  'handshake',
  'exception',
  'segfault',
  'override',
  'breach',
  'payload',
  'requiem',
  'shell',
  'signal',
  'reactor',
];
const NAME_FORMS: ((a: string, b: string, n: number) => string)[] = [
  (a, b) => `${a}_${b}.exe`,
  (a, b) => `${a.toUpperCase()}//${b.toUpperCase()}`,
  (a, b, n) => `${a} ${b} v${n % 9}.${(n * 7) % 10}`,
  (a, b) => `sudo ${a} --${b}`,
  (a, b, n) => `0x${((n * 2654435761) >>> 0).toString(16).slice(0, 4).toUpperCase()} ${a} ${b}`,
  (a, b) => `${a}://${b}`,
  (a, b) => `[${a}] ${b} (dub mix)`,
  (a, b) => `${a}.${b}()`,
  (a, b, n) => `${a}-${b}-${String(n % 1000).padStart(3, '0')}`,
  (a, b) => `${a} of the ${b}`,
];
/** A hacker-flavoured track name, deterministic for the arrangement. */
export function trackName(random: () => number): string {
  const a = NAME_HEADS[Math.floor(random() * NAME_HEADS.length)],
    b = NAME_TAILS[Math.floor(random() * NAME_TAILS.length)],
    form = NAME_FORMS[Math.floor(random() * NAME_FORMS.length)];
  return form(a, b, Math.floor(random() * 1000));
}
export function generateScore(
  seed: number,
  sector: number,
  arrangement = 0,
  preference = 'auto',
): SectorScore {
  const mixed = (seed ^ arrangement ^ Math.imul(sector + 1, 0x45d9f3b)) >>> 0;
  const random = rng(mixed);
  const pick = <T>(values: readonly T[]) => values[Math.floor(random() * values.length)];
  const spec = genreSpec(preference === 'auto' ? autoGenre(seed, sector, arrangement) : preference);
  const name = trackName(rng(mixed ^ 0x51ed270b));
  /** Two distinct patterns from a bank, so bars can alternate. */
  const pair = (bank: string[]): [string, string] => {
    const a = pick(bank);
    let b = pick(bank);
    if (b === a) b = bank[(bank.indexOf(a) + 1) % bank.length];
    return [a, b];
  };
  // Step through every composed phrase before repeating; neighboring sectors never repeat a phrase.
  // A reroll (arrangement > 0) jumps to another phrase, tuning and key as well as new patterns.
  const phrase =
    MELODY_LIBRARY[((seed % MELODY_LIBRARY.length) + sector * 5 + arrangement * 37) % MELODY_LIBRARY.length];
  const melody: PhraseNote[] = phrase.notes.map((note) => [...note]);
  // Change at most one weak-beat passing note. Downbeats and the opening/cadence stay authored.
  const eligible = phrase.notes
    .map((note, i) => ({ note, i }))
    .filter(({ note, i }) => i > 0 && i < phrase.notes.length - 2 && note[0] % 4 !== 0);
  if (eligible.length) {
    const { note, i } = pick(eligible);
    melody[i] = [note[0], note[1] + pick([-1, 1]), note[2]];
  }
  const [hatA, hatB] = pair(spec.hats);
  return {
    seed: mixed,
    sector,
    genre: spec.id,
    bpm: spec.bpm[0] + ((sector * 3 + (seed % 7) + arrangement) % (spec.bpm[1] - spec.bpm[0] + 1)),
    swing: spec.swing,
    tonic: 45 + ((sector * 5 + (seed % 12) + arrangement * 7) % 12),
    referenceHz: pick([432, 440, 444]),
    tuning: TUNINGS[(sector + (seed % TUNINGS.length) + arrangement * 5) % TUNINGS.length].id,
    mode: phrase.mode,
    melodyId: phrase.id,
    progression: phrase.progression,
    melody,
    rhythm: {
      kicks: pair(spec.kicks),
      snares: pair(spec.snares),
      hats: [hatA, hatB, pick(spec.hats)],
      openHats: pick(spec.openHats),
      percussion: pair(spec.percussion),
      bass: pair(spec.bass),
      fills: pair(FILLS),
    },
    voice: pick<OscillatorType>(['square', 'triangle', 'sawtooth']),
    name,
    title: phrase.title,
  };
}
/** A single home-root tuning lattice for every pitched voice, including negative degrees. */
export function tunedFrequency(
  score: Pick<SectorScore, 'tonic' | 'referenceHz' | 'tuning' | 'mode'>,
  degree: number,
): number {
  const octave = Math.floor(degree / 7),
    index = ((degree % 7) + 7) % 7;
  const palettes: Partial<Record<Tuning, number[]>> = {
    gong: [0, 2, 4, 7, 9],
    yu: [0, 3, 5, 7, 10],
    bhupali: [0, 2, 4, 7, 9],
    yaman: [0, 2, 4, 6, 7, 9, 11],
    bhairav: [0, 1, 4, 5, 7, 8, 11],
    hirajoshi: [0, 2, 3, 7, 8],
    twentyfour: [0, 1.5, 3, 5, 7, 8.5, 10],
  };
  const palette = palettes[score.tuning] ?? MODES[score.mode];
  const semitones = palette[Math.round((index * (palette.length - 1)) / 6)];
  let ratio: number;
  if (score.tuning === 'rational' || score.tuning === 'bhupali') {
    const ratios = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];
    ratio = ratios[semitones];
  } else if (score.tuning === 'fifths') {
    const ratios = [
      1,
      256 / 243,
      9 / 8,
      32 / 27,
      81 / 64,
      4 / 3,
      729 / 512,
      3 / 2,
      128 / 81,
      27 / 16,
      16 / 9,
      243 / 128,
    ];
    ratio = ratios[semitones];
  } else if (score.tuning === 'nineteen') ratio = 2 ** (Math.round((semitones * 19) / 12) / 19);
  else if (score.tuning === 'thirtyone') ratio = 2 ** (Math.round((semitones * 31) / 12) / 31);
  else ratio = 2 ** (semitones / 12);
  return score.referenceHz * 2 ** ((score.tonic - 69) / 12) * ratio * 2 ** octave;
}
/**
 * Layers by attack: each wave adds an element, from a bare kick and bass to the full arrangement.
 *   1 kick + bass + pad · 2 + snare and hats · 3 + lead · 4 + percussion, open hats, fills · 5 + rolls, stabs, echo.
 * Authored lead phrases repeat intact while the rhythm section varies per bar from the genre banks.
 */
export const LAYERS = 5;
export function musicNotes(score: SectorScore, step: number, intensity = LAYERS): MusicNote[] {
  const layer = Math.max(1, Math.min(LAYERS, Math.round(intensity)));
  const beat = step % 16,
    bar = Math.floor(step / 16),
    section = Math.floor(bar / 8) % 4;
  const random = rng(score.seed ^ Math.imul(step + 1, 0x27d4eb2d));
  const barRandom = rng(score.seed ^ Math.imul(bar + 1, 0x165667b1));
  const chord = score.progression[bar % score.progression.length];
  const r = score.rhythm;
  const notes: MusicNote[] = [];
  const swing = beat % 2 ? (score.swing * 60) / score.bpm / 4 : 0;
  const add = (instrument: Instrument, degree: number, duration: number, velocity: number, delay = 0) =>
    notes.push({ instrument, hz: tunedFrequency(score, degree), duration, velocity, delay });
  // Bar-level variation: alternate bank patterns, fill the last bar of a phrase, drop the kick once per 16 bars.
  const alt = bar % 4 === 2 || barRandom() < 0.2;
  const fillBar = bar % 4 === 3 && barRandom() < 0.7 && layer >= 4;
  const fill = fillBar ? r.fills[bar % 8 === 7 ? 1 : 0] : '';
  const fillHit = fill ? fill[beat] : '.';
  const dropout = bar % 16 === 8 && beat < 8 && layer >= 2;
  const breakdown = section === 2 && bar % 8 < 4 && layer >= 3;
  const kick = hits(r.kicks[alt ? 1 : 0]).find((h) => h.step === beat);
  const snare = hits(r.snares[alt ? 1 : 0]).find((h) => h.step === beat);
  const hat = hits(r.hats[bar % 8 < 4 ? 0 : bar % 8 < 6 ? 1 : 2]).find((h) => h.step === beat);
  const ohat = hits(r.openHats).find((h) => h.step === beat);
  const perc = hits(r.percussion[bar % 2]).find((h) => h.step === beat);
  const bass = r.bass[bar % 8 < 4 ? 0 : 1][beat];
  const inFill = fill !== '' && beat >= 8;
  if (fillHit === 'k' || (kick && !inFill && !dropout && !(breakdown && beat)) || beat === 0)
    add('kick', 0, 0.15, 0.24 * (kick?.velocity ?? 1) * (breakdown ? 0.6 : 1), swing);
  if (layer >= 2 && !breakdown) {
    if (fillHit === 's') add('snare', 0, 0.12, 0.14 + random() * 0.04, swing);
    else if (snare && !inFill) {
      if (snare.char === 'g') {
        if (layer >= 4 && random() > 0.3) add('ghost', 0, 0.08, 0.06, swing);
      } else add(genreSpec(score.genre).clap ? 'clap' : 'snare', 0, 0.13, 0.16 * snare.velocity, swing);
    }
    if (fillHit === 't') add('tom', 0, 0.16, 0.12, swing);
    if (hat && !inFill)
      add('hat', 0, 0.045, hat.velocity >= 1 ? 0.05 : hat.velocity > 0.5 ? 0.03 : 0.018, swing);
    if (layer >= 5 && bar % 4 === 3 && beat >= 12 && beat % 2 === 1) add('hat', 0, 0.03, 0.02, swing);
  }
  if (layer >= 4 && !breakdown) {
    if (ohat) add('ohat', 0, 0.18, 0.035, swing);
    if (perc && random() > 0.15) add('perc', 0, 0.06, 0.05 * (perc.char === 'g' ? 0.7 : 1), swing);
  }
  if (bass !== '.' && !(breakdown && beat) && !(dropout && beat)) {
    const octaveJump = layer >= 5 && bar % 4 === 3 && beat >= 12;
    add('bass', chord - 7 + bassDegree(bass) + (octaveJump ? 7 : 0), 0.24, 0.12, swing);
  }
  if (layer >= 3) {
    const note = score.melody.find((n) => n[0] === step % 64);
    if (note) {
      const expression = 0.94 + random() * 0.12;
      const duration = ((note[2] * 60) / score.bpm / 4) * 0.88;
      add('lead', note[1] + 7, duration, (breakdown ? 0.032 : 0.025) * expression, random() * 0.006);
      if (layer >= 5) add('echo', note[1] + 7, duration * 0.6, 0.008, (60 / score.bpm / 4) * 3);
    }
  }
  if (beat === 0)
    for (const offset of [0, 2, 4, 6]) add('pad', chord + offset, 1.3, layer >= 2 ? 0.018 : 0.028);
  if (layer >= 5 && !breakdown && (beat === 6 || beat === 14) && bar % 2 === 1)
    for (const offset of [0, 2, 4]) add('stab', chord + offset + 7, 0.09, 0.03, swing);
  return notes;
}
