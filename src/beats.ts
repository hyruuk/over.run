/**
 * Rhythm banks. Every drum and bass part is assembled from several large sets of one-bar
 * patterns per genre, combined and varied per bar, so no two arrangements play the same.
 *
 * Pattern strings are sixteen characters, one per sixteenth note:
 *   X accent · x hit · g ghost · . rest
 * Bass strings use degrees instead: r root · f fifth · o octave · p passing · s sub · . rest
 * Fill strings use s snare · k kick · t tom · . rest and replace the tail of a phrase's last bar.
 */
export type Genre = 'dnb' | 'dubstep' | 'bass' | 'house' | 'garage';
export interface GenreSpec {
  id: Genre;
  /** The invented, player-facing style name; the id is the underlying genre and stays internal. */
  name: string;
  bpm: [number, number];
  /** Fraction of a sixteenth by which off-beat sixteenths are delayed. */
  swing: number;
  /** Snare on beat three only (half-time feel). */
  halfTime: boolean;
  clap: boolean;
  kicks: string[];
  snares: string[];
  hats: string[];
  openHats: string[];
  percussion: string[];
  bass: string[];
}
export const GENRES: GenreSpec[] = [
  {
    id: 'dnb',
    name: 'Packetstep',
    bpm: [170, 176],
    swing: 0,
    halfTime: false,
    clap: false,
    kicks: [
      'X.........x.....',
      'X......x..x.....',
      'X.........x..x..',
      'X...........x...',
      'X.......x.x.....',
      'X..x......x.....',
      'X......x.......x',
      'X.........x.x...',
      'X.....x...x.....',
      'X.........xx....',
    ],
    snares: [
      '....X.......X...',
      '....X.......X..g',
      '....X..g....X...',
      '....X.......X.g.',
      '....X.g.....X...',
      '.g..X.......X..g',
      '....X.......X.gg',
      '....X...g...X...',
    ],
    hats: [
      'x.x.x.x.x.x.x.x.',
      'xgxgxgxgxgxgxgxg',
      'x.xxx.xxx.xxx.xx',
      '..x...x...x...x.',
      'x.x.x.xxx.x.x.x.',
      'xg.gxg.gxg.gxg.g',
      'x..xx..xx..xx..x',
      'xxxxxxxxxxxxxxxx',
    ],
    openHats: ['..........x.....', '......x.......x.', '...............x', '..x.......x.....'],
    percussion: [
      '..g...g.g...g...',
      '.......g......g.',
      '..g.......g.....',
      'g...g.g...g.g...',
      '.....g.....g...g',
    ],
    bass: [
      'r...r.....o...f.',
      'r.......r...p...',
      'r..r....f..r....',
      'r.....r...o.....',
      'r...r...r...r...',
      'r......r..s.....',
      'r..r..r.....o...',
      'r.....s.r.....f.',
    ],
  },
  {
    id: 'dubstep',
    name: 'Halfclock Sub',
    bpm: [138, 142],
    swing: 0,
    halfTime: true,
    clap: false,
    kicks: [
      'X.........x.....',
      'X..X......x.....',
      'X.......x.x.....',
      'X......x........',
      'X.........x..X..',
      'X.X.......x.....',
      'X.....x.....x...',
      'X..........x..x.',
      'X...x.....x.....',
      'X.........x...x.',
    ],
    snares: [
      '........X.......',
      '........X.....g.',
      '........X.g.....',
      '..g.....X.......',
      '........X...g...',
      '.....g..X.......',
      '........X......g',
      '........X..g..g.',
    ],
    hats: [
      'x.x.x.x.x.x.x.x.',
      'x..x..x..x..x..x',
      'xgxgxgxgxgxgxgxg',
      '..x...x...x...x.',
      'x.x.x.x.xxx.x.x.',
      'x...x...x...x...',
      'x.x.x.x.x.x.xxxx',
      'x.xgx.xgx.xgx.xg',
    ],
    openHats: ['......x.........', '..............x.', '..x...........x.', '......x.......x.'],
    percussion: [
      '...g.......g....',
      '.....g........g.',
      '..g........g.g..',
      'g......g........',
      '...g.g.....g.g..',
    ],
    bass: [
      'r.......r.......',
      'r...r...r...r...',
      'r.......s...p...',
      'r..r..r.o.......',
      'r.....r.......f.',
      'r.......r.r.r...',
      'r.r.....r.r.....',
      'r.....s.....o...',
    ],
  },
  {
    id: 'bass',
    name: 'Subroutine',
    bpm: [138, 150],
    swing: 0.05,
    halfTime: false,
    clap: true,
    kicks: [
      'X......x..x.....',
      'X..x......x..x..',
      'X.....x...x.....',
      'X.......x.....x.',
      'X..x..x...x.....',
      'X.........x...x.',
      'X......x.....x..',
      'X..x.....x......',
      'X.....x.x.......',
      'X......xx.x.....',
    ],
    snares: [
      '....X.......X...',
      '....X.....X.....',
      '....X.......X.x.',
      '..x.X.......X...',
      '....X.......X..g',
      '....X..g....X.g.',
      '....X.x.....X...',
      '....X.......Xg..',
    ],
    hats: [
      'x.x.x.x.x.x.x.x.',
      'x.xx.x.xx.x.xx.x',
      'xgxxxgxxxgxxxgxx',
      '..x...x...x...x.',
      'x.x.xx.x.x.xx.x.',
      'xxx.xxx.xxx.xxx.',
      'x..x.x..x..x.x..',
      'xg.xxg.xxg.xxg.x',
    ],
    openHats: ['..x.......x.....', '......x.......x.', '..........x...x.', '.......x........'],
    percussion: [
      '..g..g....g..g..',
      '.g....g..g....g.',
      '...g...g...g...g',
      'g..g.....g..g...',
      '.....g.g.....g.g',
    ],
    bass: [
      'r..r..r.f..f..o.',
      'r.....r.p.....f.',
      'r..r....r..r....',
      'r.r.....s.s.....',
      'r...p...f...o...',
      'r..o..r.f..o..r.',
      'r.....r..r......',
      'r..s..r...f.p...',
    ],
  },
  {
    id: 'house',
    name: 'Fourbeat Daemon',
    bpm: [122, 128],
    swing: 0.1,
    halfTime: false,
    clap: true,
    kicks: [
      'X...X...X...X...',
      'X...X...X...X..x',
      'X...X...X...X.x.',
      'X...X..xX...X...',
      'X...X...X.x.X...',
      'X...X...X...X.xx',
      'X...X...X.xxX...',
      'X..xX...X...X...',
      'X...X...X..xX...',
      'X...X...X...Xx..',
    ],
    snares: [
      '....X.......X...',
      '....X.......X..x',
      '....X.......X.x.',
      '....X..x....X...',
      '....X.......X.xx',
      '....X.......Xx..',
      '..g.X.......X...',
      '....X.g.....X...',
    ],
    hats: [
      '..x...x...x...x.',
      '..X...x...X...x.',
      'x.x.x.x.x.x.x.x.',
      '..x...x...x..xx.',
      'xgxgxgxgxgxgxgxg',
      '..x..xx...x...x.',
      'x.xxx.xxx.xxx.xx',
      '..x...x.x.x...x.',
    ],
    openHats: ['..x...x...x...x.', '..x.......x.....', '......x.......x.', '..........x...x.'],
    percussion: [
      '...g...g...g...g',
      'g..g..g...g..g..',
      '..g.g.....g.g...',
      '.g.....g.g.....g',
      '......g.......g.',
    ],
    bass: [
      'r.r.r.r.r.r.r.r.',
      '..r...r...r...r.',
      'r..r..r...r..r..',
      'r.....r.f.....o.',
      'r.r...r.p.r...f.',
      'r.......r.o.r...',
      '.r.r.r.r.r.r.r.r',
      'r..r..r.o..o..f.',
    ],
  },
  {
    id: 'garage',
    name: 'Shuffle Protocol',
    bpm: [130, 138],
    swing: 0.22,
    halfTime: false,
    clap: false,
    kicks: [
      'X.........x.....',
      'X......x..x.....',
      'X.....x...x.....',
      'X..x......x.....',
      'X.......x.x.....',
      'X......x.....x..',
      'X.........x..x..',
      'X...x.....x.....',
      'X.....x.......x.',
      'X......x..x..x..',
    ],
    snares: [
      '....X.......X...',
      '....X.......X.g.',
      '....X..g....X...',
      '....X.......X..g',
      '..g.X.......X...',
      '....X.g.....X.g.',
      '....X.....g.X...',
      '....X...g...X..g',
    ],
    hats: [
      'x.xxx.xxx.xxx.xx',
      '..x...x...x...x.',
      'x.x.x.x.x.x.x.x.',
      'x..xx..xx..xx..x',
      '..xx..x...xx..x.',
      'xg.xxg.xxg.xxg.x',
      'x.x.xx.x.x.xx.x.',
      '..x.x.x...x.x.x.',
    ],
    openHats: ['..x.......x.....', '......x.......x.', '..x...x...x...x.', '.......x.......x'],
    percussion: [
      '.g.g.g.g.g.g.g.g',
      '..g..g..g..g..g.',
      '...g......g.....',
      'g.g...g.g...g.g.',
      '.....g.....g..g.',
    ],
    bass: [
      'r.....r...o.....',
      'r..r......f..o..',
      'r......r..r.....',
      'r.....s...r..p..',
      'r..o..r...f.....',
      'r......r.....o..',
      'r..r..r...o..f..',
      'r.....r.r...s...',
    ],
  },
];
/** Shared fills; each replaces the last eight steps of a phrase's final bar. */
export const FILLS = [
  '........s.s.s.s.',
  '............ssss',
  '........s..s.s.s',
  '..........s.s.ss',
  '........t.t.s.s.',
  '............k.ss',
  '........s...ss.s',
  '.............sss',
  '........ss..ss..',
  '..........t.t.t.',
  '........t..t..ss',
  '........s.t.s.t.',
];
export const genre = (id: string) => GENRES.find((g) => g.id === id) ?? GENRES[0];
export interface Hit {
  step: number;
  velocity: number;
  char: string;
}
/** Parses a sixteen-step pattern into hits with velocity by accent class. */
export function hits(pattern: string): Hit[] {
  const out: Hit[] = [];
  for (let i = 0; i < 16; i++) {
    const c = pattern[i];
    if (!c || c === '.') continue;
    out.push({ step: i, char: c, velocity: c === 'X' ? 1 : c === 'g' ? 0.35 : 0.75 });
  }
  return out;
}
/** Bass degree offset from the chord root for a bass pattern character. */
export const bassDegree = (c: string) => (c === 'f' ? 4 : c === 'o' ? 7 : c === 'p' ? 2 : c === 's' ? -7 : 0);
/** Every pattern in every bank is exactly sixteen steps of known characters. */
export function validateBanks(): string[] {
  const errors: string[] = [];
  const check = (name: string, list: string[], allowed: string) => {
    for (const p of list) {
      if (p.length !== 16) errors.push(`${name}: "${p}" is ${p.length} steps`);
      for (const c of p) if (!allowed.includes(c)) errors.push(`${name}: "${p}" uses "${c}"`);
    }
    if (new Set(list).size !== list.length) errors.push(`${name}: duplicate pattern`);
  };
  for (const g of GENRES) {
    check(`${g.id} kicks`, g.kicks, 'Xxg.');
    check(`${g.id} snares`, g.snares, 'Xxg.');
    check(`${g.id} hats`, g.hats, 'Xxg.');
    check(`${g.id} open hats`, g.openHats, 'Xxg.');
    check(`${g.id} percussion`, g.percussion, 'Xxg.');
    check(`${g.id} bass`, g.bass, 'rfops.');
    if (!g.kicks.every((k) => k[0] === 'X'))
      errors.push(`${g.id}: every kick pattern starts on the downbeat`);
  }
  check('fills', FILLS, 'skt.');
  return errors;
}
