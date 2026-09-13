import { RESEARCH, TOWERS, PERKS, TRAITS, SCARS, SCAR_STACK, researchAvailable, maxCore } from './content';
import { nodeLevel, maxLevel } from './content';
import { validBoard, boardSize } from './generation';
import { MUSIC_GENRES, decodeTrack } from './music';
import { freshProfile, placementTiles, validateRules } from './model';
import type { Board, Profile } from './types';
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid save: ${message}`);
}
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
/**
 * Research is a list of level purchases. Saves written before leveled nodes may hold ids that
 * no longer exist or more copies than a node has levels; those entries are dropped, and so is
 * any node whose prerequisites were dropped with them.
 */
function normalizeNodes(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) return [];
  let kept = nodes.filter((id): id is string => typeof id === 'string' && RESEARCH.some((n) => n.id === id));
  kept = kept.filter(
    (id, i) => kept.slice(0, i).filter((x) => x === id).length < RESEARCH.find((n) => n.id === id)!.levels,
  );
  for (;;) {
    const next = kept.filter((id) =>
      researchAvailable(
        RESEARCH.find((n) => n.id === id)!,
        kept,
      ),
    );
    if (next.length === kept.length) return kept;
    kept = next;
  }
}
export function validateSave(raw: unknown): Profile {
  assert(raw && typeof raw === 'object', 'expected an object');
  const p = structuredClone(raw) as Profile;
  assert(p.version === 1, 'unsupported version');
  p.nodes = normalizeNodes(p.nodes);
  p.traits ??= [];
  p.traitOffers ??= [];
  p.scars ??= [];
  p.farmed ??= {};
  if (p.active) {
    p.active.research = normalizeNodes(p.active.research).filter((id) => p.nodes.includes(id));
    p.active.traits ??= [];
    p.active.scars ??= [];
    p.active.frontier ??= p.active.level === p.unlocked;
    p.active.farmed ??= 0;
  }
  assert(p.bankedCredits == null || integer(p.bankedCredits), 'credit bank');
  assert(typeof p.research === 'string' && /^\d{1,1000}$/.test(p.research), 'research balance');
  for (const field of ['revision', 'seed', 'attempts', 'victories', 'kills'] as const)
    assert(integer(p[field]), field);
  assert(integer(p.unlocked) && p.unlocked >= 1, 'level');
  assert(
    RESEARCH.every((n) => nodeLevel(p.nodes, n.id) <= n.levels) &&
      p.nodes.every((id) =>
        researchAvailable(
          RESEARCH.find((n) => n.id === id)!,
          p.nodes,
        ),
      ),
    'research prerequisites',
  );
  assert(
    Array.isArray(p.traits) &&
      new Set(p.traits).size === p.traits.length &&
      p.traits.every((id) => TRAITS.some((t) => t.id === id)) &&
      Array.isArray(p.traitOffers) &&
      p.traitOffers.length <= 3 &&
      p.traitOffers.every((id) => TRAITS.some((t) => t.id === id) && !p.traits.includes(id)),
    'traits',
  );
  assert(
    Array.isArray(p.scars) &&
      p.scars.every((id) => SCARS.some((s) => s.id === id)) &&
      SCARS.every((s) => p.scars.filter((x) => x === s.id).length <= SCAR_STACK),
    'scars',
  );
  assert(
    p.farmed && typeof p.farmed === 'object' && Object.values(p.farmed).every((n) => integer(n)),
    'farm ledger',
  );
  assert(
    p.settings &&
      typeof p.settings.sound === 'boolean' &&
      (p.settings.devMode === undefined || typeof p.settings.devMode === 'boolean') &&
      (p.settings.music === undefined || typeof p.settings.music === 'boolean') &&
      typeof p.settings.reducedMotion === 'boolean' &&
      typeof p.settings.volume === 'number' &&
      p.settings.volume >= 0 &&
      p.settings.volume <= 1 &&
      ['high', 'low'].includes(p.settings.quality) &&
      (p.settings.musicGenre === undefined || MUSIC_GENRES.includes(p.settings.musicGenre as 'auto')) &&
      (p.settings.musicVariant === undefined || integer(p.settings.musicVariant, 1e6)) &&
      [p.settings.musicVolume, p.settings.effectsVolume].every(
        (v) => v === undefined || (typeof v === 'number' && v >= 0 && v <= 1),
      ) &&
      (p.settings.tutorial === undefined || integer(p.settings.tutorial, 99)) &&
      (p.settings.musicCode === undefined || decodeTrack(p.settings.musicCode) !== null),
    'settings',
  );
  assert(typeof p.onboarded === 'boolean' && typeof p.lastReceipt === 'string', 'metadata');
  assert(p.boards && typeof p.boards === 'object' && Object.keys(p.boards).length <= 64, 'board cache');
  const boardCheck = (b: Board) => {
    const largest = boardSize(1000);
    assert(
      b &&
        integer(b.width, largest.width) &&
        integer(b.height, largest.height) &&
        b.width >= 28 &&
        b.height >= 18 &&
        [1, 2, 3, 4, 5, 6].includes(b.version) &&
        integer(b.level) &&
        integer(b.seed),
      'board dimensions',
    );
    const cells = b.width * b.height;
    assert(
      Array.isArray(b.tiles) && b.tiles.length === cells && b.tiles.every((v) => [0, 1, 2, 3].includes(v)),
      'tiles',
    );
    assert(
      Array.isArray(b.entries) &&
        b.entries.length >= 1 &&
        b.entries.length <= 6 &&
        new Set(b.entries).size === b.entries.length &&
        !b.entries.includes(b.core) &&
        b.entries.every((e) => integer(e, cells - 1) && b.tiles[e] === 1) &&
        integer(b.core, cells - 1) &&
        b.tiles[b.core] === 1 &&
        validBoard(b),
      'board connectivity',
    );
  };
  Object.values(p.boards).forEach(boardCheck);
  if (p.active !== null) {
    const a = p.active;
    assert(a && typeof a.id === 'string' && a.id.length < 100, 'attempt');
    boardCheck(a.board);
    assert(
      integer(a.level) &&
        a.level >= 1 &&
        a.level <= p.unlocked &&
        a.level === a.board.level &&
        integer(a.seed) &&
        integer(a.wave, 5) &&
        a.wave > 0,
      'attempt progress',
    );
    assert(
      integer(a.credits) &&
        integer(a.core, maxCore(a)) &&
        integer(a.kills) &&
        integer(a.farmed) &&
        typeof a.frontier === 'boolean' &&
        ['prepare', 'reward'].includes(a.phase),
      'attempt resources',
    );
    assert(
      Array.isArray(a.traits) &&
        a.traits.every((id) => TRAITS.some((t) => t.id === id)) &&
        Array.isArray(a.scars) &&
        a.scars.every((id) => SCARS.some((s) => s.id === id)),
      'attempt traits',
    );
    assert(
      Array.isArray(a.perks) && a.perks.length <= 4 && a.perks.every((id) => PERKS.some((x) => x.id === id)),
      'exploits',
    );
    assert(
      Array.isArray(a.offers) &&
        a.offers.length <= 3 &&
        a.offers.every((id) => PERKS.some((x) => x.id === id)) &&
        (a.phase !== 'reward' || a.offers.length > 0),
      'offers',
    );
    assert(Array.isArray(a.towers) && a.towers.length <= a.board.tiles.length, 'towers');
    const cells = new Set<number>(),
      ids = new Set<string>();
    for (const t of a.towers) {
      assert(
        t &&
          typeof t.id === 'string' &&
          /^[A-Za-z0-9-]{1,40}$/.test(t.id) &&
          !ids.has(t.id) &&
          t.kind in TOWERS &&
          integer(t.cell, a.board.tiles.length - 1) &&
          !cells.has(t.cell) &&
          integer(t.level, maxLevel(t.kind, a)) &&
          t.level >= 1 &&
          integer(t.spent) &&
          typeof t.closed === 'boolean' &&
          ['first', 'strongest', 'cluster'].includes(t.target),
        'tower data',
      );
      assert(
        placementTiles(t.kind, a.board, a).includes(a.board.tiles[t.cell]) &&
          t.cell !== a.board.core &&
          !a.board.entries.includes(t.cell),
        'tower placement',
      );
      cells.add(t.cell);
      ids.add(t.id);
    }
    assert(
      Array.isArray(a.rules) &&
        a.rules.length <= 32 &&
        a.rules.every(
          (r) =>
            r &&
            typeof r.id === 'string' &&
            /^[a-zA-Z0-9-]{1,40}$/.test(r.id) &&
            typeof r.target === 'string' &&
            typeof r.enabled === 'boolean',
        ),
      'routines',
    );
    assert(
      validateRules(a.rules, a).filter((e) => !e.includes('missing defense')).length === 0,
      'routine graph',
    );
  }
  p.settings.music ??= true;
  return p;
}
export class SaveStore {
  private db!: IDBDatabase;
  async open() {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('0xdefend', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('state');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async load(): Promise<Profile> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('state');
      const r = tx.objectStore('state').get('profile');
      r.onsuccess = () => {
        try {
          resolve(r.result ? validateSave(r.result) : freshProfile());
        } catch (e) {
          reject(e);
        }
      };
      r.onerror = () => reject(r.error);
    });
  }
  async save(p: Profile, expectedRevision: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction('state', 'readwrite');
      const s = tx.objectStore('state');
      const get = s.get('profile');
      get.onsuccess = () => {
        if (get.result && get.result.revision !== expectedRevision) {
          tx.abort();
          return;
        }
        s.put(p, 'profile');
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Save failed'));
      tx.onabort = () => reject(new Error('Save conflict or storage unavailable. Reload before continuing.'));
    });
  }
  close() {
    this.db?.close();
  }
}
