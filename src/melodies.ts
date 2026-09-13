import imported from './data/melodies.json';

export type Mode = 'dorian' | 'minor' | 'major' | 'mixolydian';
/** Four-bar excerpts: [sixteenth-note onset, home-mode degree, length]. */
export type PhraseNote = readonly [step: number, degree: number, length: number];
export interface MelodyPhrase {
  readonly id: string;
  readonly title: string;
  readonly mode: Mode;
  readonly progression: readonly number[];
  readonly notes: readonly PhraseNote[];
}
/** 128 distinct internet-sourced tunes. Provenance and CC BY 4.0 attribution:
 * public/music/credits.json, public/music/credits.html.
 * Rebuild with scripts/import-melodies.py; no downloads occur during gameplay. */
export const MELODY_LIBRARY = imported as unknown as readonly MelodyPhrase[];
