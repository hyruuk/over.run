import { TOWERS, ENEMIES, SCARS, SCAR_STACK, SUPPLY, WAVE_SHARE, slotLimit } from './content';
import { maxCore, towerRange, modifiers, isCombat, powerDraw, powerOutput } from './content';
import { powerCapacity, powerUsed, purse, farmMultiplier, type Bonuses } from './content';
import { distances, neighbors, encounter, rng, threat } from './generation';
import type { Attempt, Burst, Enemy, EnemyKind, HealthBand, Snapshot, TowerState } from './types';
import type { Diagnostics, Shot } from './types';
export const TICK_RATE = 30;
export const population = (e: Enemy) => e.bands.reduce((n, b) => n + b.count, 0);
export const health = (e: Enemy) => e.bands.reduce((n, b) => n + b.count * b.hp, 0);
// Health bands preserve per-member damage and kills without allocating one object per member.
export function damageEnemy(e: Enemy, damage: number, area: boolean) {
  let killed = 0,
    dealt = 0;
  if (area) {
    for (const b of e.bands) {
      dealt += Math.min(b.hp, damage) * b.count;
      b.hp -= damage;
      if (b.hp <= 0) killed += b.count;
    }
    e.bands = e.bands.filter((b) => b.hp > 0);
  } else if (e.bands.length) {
    const b = e.bands[0];
    dealt = Math.min(b.hp, damage);
    const hp = b.hp - damage;
    b.count--;
    if (hp <= 0) killed++;
    else {
      const same = e.bands.find((x) => x.hp === hp);
      if (same) same.count++;
      else e.bands.unshift({ hp, count: 1 });
    }
    e.bands = e.bands.filter((b) => b.count > 0);
  }
  return { killed, dealt };
}
export function mergeCohorts(enemies: Enemy[]): Enemy[] {
  const map = new Map<string, Enemy>();
  const result: Enemy[] = [];
  for (const e of enemies) {
    if (e.kind === 'boss' || e.kind === 'rootkit') {
      result.push(e);
      continue;
    }
    const key = `${e.kind}:${e.cell}:${e.next}:${e.progress}:${e.maxHp}:${e.speed}`;
    const previous = map.get(key);
    if (!previous) {
      map.set(key, e);
      result.push(e);
    } else {
      for (const b of e.bands) {
        const band = previous.bands.find((x) => x.hp === b.hp);
        if (band) band.count += b.count;
        else previous.bands.push({ ...b });
      }
    }
  }
  return result;
}
const AREA: string[] = ['mortar', 'scatter', 'pulse'];
export class Simulation {
  tick = 0;
  core: number;
  credits: number;
  enemies: Enemy[] = [];
  towers: TowerState[];
  done = false;
  won = false;
  spawned = 0;
  nextId = 1;
  shots: Shot[] = [];
  bursts: Burst[] = [];
  diagnostics: Diagnostics = {
    kills: 0,
    breaches: 0,
    earned: 0,
    events: [],
    rules: {},
    pressurePeak: 0,
    scars: [],
  };
  readonly spec;
  readonly scale;
  /** Daemons on this attack: the sector's count plus any trait-added signatures. */
  readonly daemons: number;
  private random;
  private openDistances: Int32Array;
  private baseDistances: Int32Array;
  private topology = '';
  private ruleState = new Map<string, { active: boolean; last: number }>();
  private daemonsSpawned = 0;
  private jamUntil = 0;
  private mods: Bonuses;
  private ranges = new Map<string, number>();
  private buckets = new Map<number, Enemy[]>();
  private slowed = new Set<number>();
  /** Credits paid per point of breach value; the sector purse divided by the expected threat. */
  private creditPerBreach: number;
  private farm: number;
  private overloadTicks = 0;
  private tripRotation = 0;
  /** Glass core: damage charge accumulated from breaches this attack. */
  private charge = 0;
  private referenced = new Set<string>();
  constructor(
    readonly attempt: Attempt,
    readonly options = { aggregation: true },
  ) {
    this.mods = modifiers(attempt);
    for (const t of attempt.towers) this.ranges.set(t.id, towerRange(t, attempt));
    this.core = attempt.core;
    this.credits = attempt.credits;
    this.towers = attempt.towers.map((t) => ({
      ...t,
      heat: 0,
      overheated: false,
      ventCooldown: 0,
      cooldown: 0,
      boost: 0,
      ability: 0,
      pressure: 0,
      failed: false,
      offline: 0,
      damage: 0,
      kills: 0,
      shots: 0,
      idle: 0,
    }));
    this.spec = encounter(attempt.level, attempt.wave, attempt.seed);
    this.scale = threat(attempt.level);
    this.daemons = this.spec.boss ? Math.max(1, this.spec.daemons + (this.mods.daemons ?? 0)) : 0;
    this.random = rng(this.spec.seed);
    this.baseDistances = distances(attempt.board);
    this.openDistances = this.baseDistances;
    const meanBreach =
      this.spec.kinds.reduce((s, k) => s + ENEMIES[k].breach, 0) / Math.max(1, this.spec.kinds.length);
    this.farm = farmMultiplier(attempt.farmed ?? 0);
    this.creditPerBreach =
      (purse(attempt.level, attempt) * WAVE_SHARE[attempt.wave - 1]) /
      Math.max(1, this.spec.total * meanBreach);
    for (const r of attempt.rules) {
      if (!r.enabled) continue;
      for (const t of attempt.towers)
        if (r.target === 'all' || r.target === t.id || r.target === `kind:${t.kind}`)
          this.referenced.add(t.id);
    }
  }
  private event(type: string, text: string, cell?: number) {
    this.diagnostics.events.push({ tick: this.tick, type, text, cell });
    if (this.diagnostics.events.length > 100) this.diagnostics.events.shift();
  }
  private burst(x: number, y: number, kind: Burst['kind'], radius: number) {
    if (this.bursts.length < 40) this.bursts.push({ x, y, kind, radius });
  }
  position(e: Enemy) {
    const w = this.attempt.board.width;
    return {
      x: (e.cell % w) + (((e.next % w) - (e.cell % w)) * e.progress) / 1000,
      y: Math.floor(e.cell / w) + ((Math.floor(e.next / w) - Math.floor(e.cell / w)) * e.progress) / 1000,
    };
  }
  private cellOf(t: { cell: number }) {
    const w = this.attempt.board.width;
    return { x: t.cell % w, y: Math.floor(t.cell / w) };
  }
  private spawn() {
    const due = Math.floor(Math.min(1, this.tick / this.spec.duration) * this.spec.total);
    if (due > this.spawned) {
      const count = due - this.spawned;
      const roll = this.random();
      let kind: EnemyKind =
        this.spec.kinds[Math.min(this.spec.kinds.length - 1, Math.floor(roll * this.spec.kinds.length))];
      // Special threats have a bounded individual spawn schedule; mass population remains ordinary.
      if (kind === 'rootkit' && count > 1) kind = 'armored';
      const entry = this.attempt.board.entries[Math.floor(this.random() * this.attempt.board.entries.length)];
      this.addEnemy(kind, count, entry);
      this.spawned = due;
    }
    if (this.spec.boss && this.daemonsSpawned < this.daemons && this.tick >= this.spec.duration) {
      const entries = this.attempt.board.entries;
      this.addEnemy('boss', 1, entries[this.daemonsSpawned % entries.length]);
      this.daemonsSpawned++;
      this.event('warning', 'DAEMON signature detected.');
    }
  }
  addEnemy(kind: EnemyKind, count: number, cell: number) {
    const def = ENEMIES[kind];
    const hp = Math.round(
      def.hp *
        this.scale.hp *
        (1 + (this.attempt.wave - 1) * 0.08) *
        (kind === 'boss' ? 1 + (this.mods.daemonHp ?? 0) : 1),
    );
    this.enemies.push({
      id: this.nextId++,
      kind,
      cell,
      next: cell,
      progress: 0,
      maxHp: hp,
      speed: Math.round(def.speed * this.scale.speed),
      bands: [{ hp, count }],
    });
  }
  private rebuildRoutes() {
    const gates = this.towers.filter((t) => t.kind === 'gate' && t.closed && !t.failed);
    const key = gates.map((t) => t.cell).join(',');
    if (key !== this.topology) {
      this.topology = key;
      this.openDistances = distances(this.attempt.board, new Set(gates.map((t) => t.cell)));
    }
  }
  private indexEnemies() {
    this.buckets.clear();
    const w = this.attempt.board.width;
    for (const e of this.enemies) {
      if (!population(e)) continue;
      const p = this.position(e);
      const cell = Math.round(p.y) * w + Math.round(p.x);
      const b = this.buckets.get(cell);
      if (b) b.push(e);
      else this.buckets.set(cell, [e]);
    }
  }
  private inRange(cell: number, range: number) {
    const { width: w, height: h } = this.attempt.board;
    const x = cell % w,
      y = Math.floor(cell / w),
      out: Enemy[] = [];
    for (
      let yy = Math.max(0, Math.floor(y - range - 1));
      yy <= Math.min(h - 1, Math.ceil(y + range + 1));
      yy++
    )
      for (
        let xx = Math.max(0, Math.floor(x - range - 1));
        xx <= Math.min(w - 1, Math.ceil(x + range + 1));
        xx++
      )
        for (const e of this.buckets.get(yy * w + xx) ?? []) {
          const p = this.position(e);
          if (population(e) && (p.x - x) ** 2 + (p.y - y) ** 2 <= range ** 2) out.push(e);
        }
    return out;
  }
  /** Enemies within a radius of a fractional board position. */
  private around(x: number, y: number, radius: number) {
    const w = this.attempt.board.width;
    return this.inRange(Math.round(y) * w + Math.round(x), radius + 1).filter((e) => {
      const q = this.position(e);
      return (x - q.x) ** 2 + (y - q.y) ** 2 <= radius ** 2;
    });
  }
  range(t: TowerState) {
    return this.ranges.get(t.id)! * (t.kind === 'slow' && t.boost > 0 ? 1.25 : 1);
  }
  gateLimit(t: TowerState) {
    return 100 * Math.max(0.3, 1 + (t.level - 1) * 0.45 + (this.mods.gate ?? 0));
  }
  /** Damage of one shot from a weapon, before armor, criticals and target modifiers. */
  weaponDamage(t: TowerState) {
    const combat = this.towers.filter((x) => isCombat(x.kind)).length,
      slots = slotLimit(this.attempt);
    return (
      TOWERS[t.kind].damage *
      (1 + (t.level - 1) * 0.6) *
      Math.max(0.1, 1 + (this.mods.damage ?? 0) + (this.mods[`damage:${t.kind}`] ?? 0)) *
      (slots ? 1 + (this.mods.slotDamage ?? 0) * Math.max(0, slots - combat) : 1) *
      (!this.referenced.has(t.id) ? Math.max(0.1, 1 - (this.mods.unreferenced ?? 0)) : 1) *
      (1 + this.charge)
    );
  }
  private routines() {
    const claimed = new Set<string>();
    for (const r of this.attempt.rules) {
      if (!r.enabled) continue;
      const targets = this.towers.filter(
        (t) => r.target === 'all' || r.target === t.id || r.target === `kind:${t.kind}`,
      );
      const relevant =
        r.sensor === 'pressure'
          ? targets.filter((t) => t.kind === 'gate')
          : r.sensor === 'heat'
            ? targets.filter((t) => t.kind !== 'gate')
            : targets;
      const value =
        r.sensor === 'time'
          ? this.tick / 30
          : r.sensor === 'integrity'
            ? (this.core / maxCore(this.attempt)) * 100
            : r.sensor === 'pressure'
              ? Math.max(0, ...relevant.map((t) => (t.pressure / this.gateLimit(t)) * 100))
              : r.sensor === 'heat'
                ? Math.max(0, ...relevant.map((t) => t.heat))
                : relevant.reduce(
                    (n, t) =>
                      Math.max(
                        n,
                        this.inRange(
                          t.cell,
                          Math.max(3, this.range(t)) + (this.mods.sensorRange ?? 0),
                        ).reduce((s, e) => s + population(e), 0),
                      ),
                    0,
                  );
      const active =
        (r.sensor === 'time' || r.sensor === 'integrity' || relevant.length > 0) &&
        (r.compare === 'above' ? value > r.value : value < r.value);
      const previous = this.ruleState.get(r.id) ?? { active: false, last: -1e9 };
      if (active && (!previous.active || (r.repeat > 0 && this.tick - previous.last >= r.repeat * 30))) {
        const stat = (this.diagnostics.rules[r.id] ??= { fired: 0, blocked: 0 });
        let fired = false;
        for (const t of targets) {
          if (t.kind === 'reactor') continue;
          const channel = ['open', 'close'].includes(r.action)
            ? 'gate'
            : ['first', 'strongest', 'cluster'].includes(r.action)
              ? 'target'
              : r.action;
          if (claimed.has(`${t.id}:${channel}`)) continue;
          let success = false;
          if (r.action === 'vent' && t.kind !== 'gate' && t.ventCooldown <= 0 && t.heat > 0) {
            t.heat = Math.max(0, t.heat - 55 - (this.mods.vent ?? 0));
            t.boost = 0;
            t.ventCooldown = 150;
            if (t.heat <= 45) t.overheated = false;
            success = true;
          } else if (r.action === 'open' && t.kind === 'gate' && t.closed) {
            t.closed = false;
            success = true;
          } else if (r.action === 'close' && t.kind === 'gate' && !t.closed && !t.failed) {
            t.closed = true;
            success = true;
          } else if (
            r.action === 'overclock' &&
            t.kind !== 'gate' &&
            t.heat < 70 &&
            t.boost <= 0 &&
            t.ability <= 0
          ) {
            t.boost = Math.round(150 * (1 + (this.mods.overclockDuration ?? 0)));
            t.ability = 270;
            success = true;
          } else if (['first', 'strongest', 'cluster'].includes(r.action) && t.kind !== 'gate') {
            t.target = r.action as 'first' | 'strongest' | 'cluster';
            success = true;
          } else if (
            r.action === 'purge' &&
            this.attempt.research.includes('automation-3') &&
            t.kind !== 'gate' &&
            t.ability <= 0
          ) {
            for (const e of this.inRange(t.cell, this.range(t)))
              this.hit(t, e, 45 * this.scale.hp, true, true);
            t.ability = 600;
            success = true;
          }
          if (success) {
            claimed.add(`${t.id}:${channel}`);
            fired = true;
          }
        }
        if (fired) {
          stat.fired++;
          this.event('routine', `${r.id}: ${r.action} executed.`);
        } else stat.blocked++;
      }
      previous.active = active;
      previous.last = this.tick;
      this.ruleState.set(r.id, previous);
    }
  }
  private hit(t: TowerState, e: Enemy, damage: number, area = false, pierce = false) {
    const armor = ENEMIES[e.kind].armor + this.scale.armor;
    const actual = Math.max(
      1,
      Math.round(
        damage *
          (e.kind === 'boss' ? 1 + (this.mods.bossDamage ?? 0) : 1) *
          (this.slowed.has(e.id) ? 1 + (this.mods.slowedDamage ?? 0) : 1),
      ) - (pierce ? 0 : Math.max(0, armor - (this.mods.armorPierce ?? 0))),
    );
    const result = damageEnemy(e, actual, area);
    t.damage += result.dealt;
    t.kills += result.killed;
    this.diagnostics.kills += result.killed;
    // The sector purse is paid out per point of breach value removed; Daemons carry their own bounty.
    const reward =
      (e.kind === 'boss'
        ? result.killed * purse(this.attempt.level, this.attempt) * 0.1 * (1 + (this.mods.daemonBounty ?? 0))
        : result.killed * ENEMIES[e.kind].breach * this.creditPerBreach) *
      Math.max(0, 1 + (this.mods.bounty ?? 0)) *
      this.farm;
    this.credits += reward;
    this.diagnostics.earned += reward;
  }
  /** Area damage at a fractional position, for explosions, short-circuits and gate detonations. */
  private detonate(t: TowerState, x: number, y: number, radius: number, damage: number, kind: Burst['kind']) {
    for (const e of this.around(x, y, radius)) this.hit(t, e, damage, true, true);
    this.burst(x, y, kind, radius);
  }
  private trip(supply: TowerState, ticks: number, reason: string) {
    if (supply.offline > 0) return;
    supply.offline = ticks;
    const p = this.cellOf(supply);
    this.burst(p.x, p.y, 'trip', SUPPLY.radius);
    this.event(
      'trip',
      `${supply.id} tripped (${reason}): ${powerOutput(supply, this.attempt)} W offline for ${(ticks / 30).toFixed(0)}s.`,
      supply.cell,
    );
  }
  /** Supplies radiate heat, trip under load or by protocol, and unpowered weapons stand down. */
  private power() {
    const supplies = this.towers.filter((t) => t.kind === 'reactor');
    const weapons = this.towers.filter((t) => isCombat(t.kind));
    const radiation = SUPPLY.radiation * Math.max(0, 1 - (this.mods.supplyHeat ?? 0));
    // Radiation grows with supply level: a bigger supply is a hotter neighbour.
    for (const s of supplies) {
      if (s.offline > 0) {
        s.offline--;
        continue;
      }
      if (!radiation) continue;
      const p = this.cellOf(s);
      for (const w of weapons) {
        const q = this.cellOf(w);
        if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= SUPPLY.radius ** 2)
          w.heat = Math.min(100, w.heat + radiation * (1 + (s.level - 1) * 0.35));
      }
    }
    if (supplies.length) {
      const capacity = powerCapacity(this.attempt, this.towers),
        used = powerUsed(this.towers, this.attempt);
      this.overloadTicks = used > capacity * 0.9 ? this.overloadTicks + 1 : 0;
      if (this.overloadTicks >= 360) {
        this.overloadTicks = 0;
        this.trip(supplies[this.tripRotation++ % supplies.length], 90, 'overload');
      }
      const interval = Math.round((this.mods.tripInterval ?? 0) * 30);
      if (interval > 0 && this.tick % interval === 0)
        this.trip(supplies[this.tripRotation++ % supplies.length], 120, 'trip protocol');
    }
    let offline = supplies.filter((s) => s.offline > 0).reduce((n, s) => n + powerOutput(s, this.attempt), 0);
    for (const w of weapons) w.offline = 0;
    if (offline > 0)
      for (const w of [...weapons].sort(
        (a, b) =>
          powerDraw(b.kind, this.attempt) - powerDraw(a.kind, this.attempt) || a.id.localeCompare(b.id),
      )) {
        if (offline <= 0) break;
        w.offline = 1;
        offline -= powerDraw(w.kind, this.attempt);
      }
  }
  step(ticks = 1) {
    for (let i = 0; i < ticks && !this.done; i++) this.stepOne();
  }
  private stepOne() {
    this.tick++;
    this.spawn();
    this.indexEnemies();
    if (this.tick % Math.max(1, 3 - (this.mods.interrupt ?? 0)) === 0) this.routines();
    this.rebuildRoutes();
    const gates = new Map(
      this.towers.filter((t) => t.kind === 'gate' && t.closed && !t.failed).map((t) => [t.cell, t]),
    );
    const queued = new Map<string, number>();
    const slows = this.towers.filter((t) => t.kind === 'slow');
    const slowStack = this.mods.slowStack ?? 0;
    this.slowed.clear();
    for (const e of this.enemies) {
      if (!population(e)) continue;
      if (e.next === e.cell) {
        const d = this.openDistances[e.cell] >= 0 ? this.openDistances : this.baseDistances;
        const candidates = neighbors(e.cell, this.attempt.board.width, this.attempt.board.height)
          .filter((n) => d[n] >= 0 && d[n] < d[e.cell])
          .sort((a, b) => d[a] - d[b] || a - b);
        e.next = candidates[0] ?? e.cell;
      }
      const gate = gates.get(e.next) ?? gates.get(e.cell);
      if (gate) {
        queued.set(
          gate.id,
          (queued.get(gate.id) ?? 0) +
            population(e) * (e.kind === 'boss' ? 20 : e.kind === 'armored' ? 2 : 1),
        );
        e.next = e.cell;
        e.progress = 0;
        continue;
      }
      const p = this.position(e);
      let fields = 0;
      for (const t of slows)
        if (
          ((t.cell % this.attempt.board.width) - p.x) ** 2 +
            (Math.floor(t.cell / this.attempt.board.width) - p.y) ** 2 <
          this.range(t) ** 2
        )
          fields++;
      if (fields) this.slowed.add(e.id);
      e.progress += Math.round(
        e.speed * (fields ? Math.max(0.2, 0.55 - (this.mods.slow ?? 0) - (fields > 1 ? slowStack : 0)) : 1),
      );
      if (e.progress >= 1000) {
        e.cell = e.next;
        e.progress -= 1000;
        e.next = e.cell;
        if (e.cell === this.attempt.board.core) this.breach(e);
      }
    }
    this.indexEnemies();
    const heatGain = 1 + (this.mods.heatGain ?? 0);
    this.power();
    for (const t of this.towers) {
      if (t.kind === 'gate') {
        // Recalculate queued live population after hits on the following tick; bounded one-tick latency.
        t.pressure = Math.max(
          0,
          t.pressure + (queued.get(t.id) ?? 0) * 0.065 - 0.22 * (1 + (this.mods.pressureDrain ?? 0)),
        );
        this.diagnostics.pressurePeak = Math.max(this.diagnostics.pressurePeak, t.pressure);
        if (t.closed && !t.failed && t.pressure >= this.gateLimit(t)) {
          t.failed = true;
          t.closed = false;
          this.event('gate', `${t.id} failed open under pressure.`, t.cell);
          if ((this.mods.gateBlast ?? 0) > 0) {
            const p = this.cellOf(t);
            this.detonate(
              t,
              p.x,
              p.y,
              2,
              120 * this.mods.gateBlast! * this.scale.hp * (1 + (this.mods.damage ?? 0)),
              'explosion',
            );
            this.event('explosion', `${t.id} detonated. It is rebuilt before the next attack.`, t.cell);
          }
        }
        continue;
      }
      if (t.kind === 'reactor') continue;
      t.ventCooldown = Math.max(0, t.ventCooldown - 1);
      t.cooldown = Math.max(0, t.cooldown - 1);
      t.ability = Math.max(0, t.ability - 1);
      const cooling = 0.18 * Math.max(0.2, 1 + (this.mods.cooling ?? 0));
      t.heat = Math.max(0, t.heat - cooling);
      if (t.boost > 0) {
        t.boost--;
        t.heat += 0.65 * heatGain;
        if (t.heat >= 100) {
          t.boost = 0;
          this.event('heat', `${t.id} overclock suspended at thermal limit.`, t.cell);
        }
      }
      if (t.overheated && t.heat <= 45) t.overheated = false;
      if (t.heat >= 99 && !t.overheated) {
        t.overheated = true;
        if ((this.mods.shortCircuit ?? 0) > 0 && t.kind !== 'slow') {
          const p = this.cellOf(t);
          this.detonate(t, p.x, p.y, 1.5, this.weaponDamage(t) * this.mods.shortCircuit!, 'short');
          this.event('short', `${t.id} short-circuited: thermal discharge.`, t.cell);
        } else this.event('heat', `${t.id} thermal shutdown. Add a heat → vent routine.`, t.cell);
      }
      if (t.kind === 'slow' || t.cooldown > 0 || t.overheated || t.offline > 0) continue;
      const candidates = this.inRange(t.cell, this.range(t));
      if (!candidates.length) {
        t.idle++;
        continue;
      }
      const score = (e: Enemy) =>
        t.target === 'strongest'
          ? e.maxHp
          : t.target === 'cluster'
            ? population(e) + (this.buckets.get(e.cell)?.length ?? 0)
            : -(this.baseDistances[e.cell] * 1000 - e.progress);
      let target = candidates[0];
      for (const e of candidates) if (score(e) > score(target)) target = e;
      const p = this.position(target);
      const crit = (this.mods.crit ?? 0) > 0 && this.random() < (this.mods.crit ?? 0);
      const damage = this.weaponDamage(t) * (crit ? 2 + (this.mods.critDamage ?? 0) : 1);
      if (t.kind === 'pulse') {
        for (const e of candidates) this.hit(t, e, damage, true, true);
      } else if (t.kind === 'rail') {
        const tx = t.cell % this.attempt.board.width,
          ty = Math.floor(t.cell / this.attempt.board.width);
        const dx = p.x - tx,
          dy = p.y - ty,
          length = Math.hypot(dx, dy) || 1;
        for (const e of candidates) {
          const q = this.position(e),
            along = ((q.x - tx) * dx + (q.y - ty) * dy) / length;
          if (along >= 0 && Math.abs((q.x - tx) * dy - (q.y - ty) * dx) / length < 0.5)
            this.hit(t, e, damage, true, true);
        }
      } else if (t.kind === 'mortar' || t.kind === 'scatter') {
        const radius = (t.kind === 'scatter' ? 0.85 : 1.6) * (1 + (this.mods.blast ?? 0));
        for (const e of this.around(p.x, p.y, radius)) this.hit(t, e, damage, true);
      } else if (t.kind === 'arc') {
        // A chain touches distinct members, including members represented by one cohort.
        let remaining = 4 + (this.mods.chain ?? 0);
        for (const e of candidates) {
          const struck: HealthBand[] = [];
          while (remaining > 0 && population(e) > 0) {
            const band = e.bands[0],
              hp = band.hp;
            band.count--;
            if (!band.count) e.bands.shift();
            const member: Enemy = { ...e, bands: [{ hp, count: 1 }] };
            this.hit(t, member, damage, false, true);
            struck.push(...member.bands);
            remaining--;
          }
          for (const band of struck) {
            const existing = e.bands.find((b) => b.hp === band.hp);
            if (existing) existing.count += band.count;
            else e.bands.push(band);
          }
          if (!remaining) break;
        }
      } else this.hit(t, target, damage, false, t.kind === 'laser');
      if ((this.mods.chainBlast ?? 0) > 0 && AREA.includes(t.kind) && this.random() < this.mods.chainBlast!)
        this.detonate(t, p.x, p.y, 1.2, damage * 0.6, 'explosion');
      t.cooldown = Math.max(
        2,
        Math.round(
          (TOWERS[t.kind].cooldown * (this.tick < this.jamUntil ? 1.67 : 1)) /
            Math.max(0.25, 1 + (this.mods.haste ?? 0)) /
            (t.boost > 0 ? 1.7 + (this.mods.overclock ?? 0) : 1),
        ),
      );
      t.heat = Math.min(
        100,
        t.heat +
          ({ cannon: 3.5, mortar: 6, arc: 9, laser: 18, scatter: 5, pulse: 10, rail: 15, shredder: 1.5 }[
            t.kind
          ] ?? 0) *
            heatGain,
      );
      t.shots++;
      if (this.shots.length < 80) this.shots.push({ from: t.cell, x: p.x, y: p.y, kind: t.kind });
    }
    this.enemies = this.enemies.filter((e) => population(e) > 0);
    if (this.options.aggregation && this.enemies.length > 1800 && this.tick % 30 === 0)
      this.enemies = mergeCohorts(this.enemies);
    if (this.core <= 0) {
      this.done = true;
      this.won = false;
    } else if (
      this.spawned >= this.spec.total &&
      (!this.spec.boss || this.daemonsSpawned >= this.daemons) &&
      this.enemies.length === 0
    ) {
      this.done = true;
      this.won = true;
    }
  }
  private breach(e: Enemy) {
    const n = population(e);
    const each = Math.max(
      1,
      Math.round(
        ENEMIES[e.kind].breach * this.scale.breach * (1 - Math.min(0.7, this.mods.breachResist ?? 0)),
      ),
    );
    this.core = Math.max(0, this.core - n * each);
    this.diagnostics.breaches += n;
    this.event('breach', `${n.toLocaleString()} ${ENEMIES[e.kind].name} breached the core.`, e.cell);
    if ((this.mods.breachCharge ?? 0) > 0) this.charge = Math.min(0.8, this.charge + this.mods.breachCharge!);
    if (e.kind === 'boss') {
      this.jamUntil = this.tick + Math.round(240 * (1 - Math.min(0.8, this.mods.jamResist ?? 0)));
      for (const tower of this.towers) tower.heat = Math.min(100, tower.heat + 45);
      this.event(
        'malus',
        `DAEMON / clock corruption: weapons fire 40% slower for ${((this.jamUntil - this.tick) / 30).toFixed(1)}s; +45 heat.`,
        e.cell,
      );
      const core = this.cellOf({ cell: this.attempt.board.core });
      const nearest = this.towers
        .filter((t) => t.kind === 'reactor')
        .sort((a, b) => {
          const p = this.cellOf(a),
            q = this.cellOf(b);
          return Math.hypot(p.x - core.x, p.y - core.y) - Math.hypot(q.x - core.x, q.y - core.y);
        })[0];
      if (nearest) this.trip(nearest, 180, 'Daemon corruption');
      // A Daemon leaves a scar: a permanent malus for the run, drawn from the pool that has stack room.
      const stacks = (id: string) =>
        this.attempt.scars.filter((x) => x === id).length +
        this.diagnostics.scars.filter((x) => x === id).length;
      const pool = SCARS.filter((s) => stacks(s.id) < SCAR_STACK);
      if (pool.length) {
        const scar = pool[Math.floor(this.random() * pool.length)];
        this.diagnostics.scars.push(scar.id);
        this.event('scar', `DAEMON SCAR / ${scar.name}: ${scar.description} Permanent for this run.`, e.cell);
      }
    }
    if (e.kind === 'leech') {
      const stolen = Math.min(this.credits, 15 * n);
      this.credits -= stolen;
      this.event('malus', `CACHE LEECH / ${Math.floor(stolen)} credits stolen.`, e.cell);
    }
    e.bands = [];
  }
  snapshot(): Snapshot {
    const visible = this.enemies.slice(0, 4000),
      data = new Float32Array(visible.length * 5);
    const kinds = Object.keys(ENEMIES);
    visible.forEach((e, i) => {
      const p = this.position(e);
      data.set(
        [p.x, p.y, kinds.indexOf(e.kind), population(e), health(e) / (population(e) * e.maxHp)],
        i * 5,
      );
    });
    const s = {
      tick: this.tick,
      core: this.core,
      alive: this.enemies.reduce((n, e) => n + population(e), 0),
      records: this.enemies.length,
      spawned: this.spawned,
      total: this.spec.total + this.daemons,
      credits: Math.floor(this.credits),
      enemies: data,
      towers: this.towers,
      shots: this.shots,
      bursts: this.bursts,
      diagnostics: this.diagnostics,
      done: this.done,
      won: this.won,
    };
    this.shots = [];
    this.bursts = [];
    return s;
  }
}
