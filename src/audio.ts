import type { TowerKind } from './types';
import {
  generateScore,
  musicNotes,
  calmNotes,
  LAYERS,
  CALM_TEMPO,
  type MusicNote,
  type SectorScore,
} from './music';
import { FILLS, hits } from './beats';
import { rng } from './generation';

type Instrument = MusicNote['instrument'];
type EntryKind = 'drop' | 'fade' | 'sparse' | 'riser' | 'stutter';
/** How an instrument joins a voice that is already playing. */
interface Entry {
  kind: EntryKind;
  /** Voice step at which the entry was requested. */
  start: number;
  /** First bar-aligned step at which the part plays in full. */
  boundary: number;
  fill: string;
}
/** Which instruments each layer adds, and how they may enter. */
const LAYER_ENTRIES: Record<number, { instruments: Instrument[]; kinds: EntryKind[] }[]> = {
  2: [
    { instruments: ['snare', 'clap', 'tom', 'ghost'], kinds: ['drop'] },
    { instruments: ['hat'], kinds: ['fade', 'stutter'] },
  ],
  3: [{ instruments: ['lead'], kinds: ['riser', 'fade'] }],
  4: [{ instruments: ['ohat', 'perc'], kinds: ['fade', 'drop'] }],
  5: [{ instruments: ['stab', 'echo'], kinds: ['fade'] }],
};
export type TransitionKind = 'crossfade' | 'cut' | 'sweep' | 'breakdown';
export const TRANSITIONS: TransitionKind[] = ['crossfade', 'cut', 'sweep', 'breakdown'];
/** One playing score with its own clock, bus, filter and instrument entries. */
class Voice {
  step = 0;
  next = 0;
  entries = new Map<Instrument, Entry>();
  /** Audio time after which the voice is silent and can be discarded. */
  until = Infinity;
  /** Outgoing 'cut': a fill in the last half bar before the voice stops. */
  outroFill = '';
  outroBoundary = Infinity;
  /** Outgoing 'breakdown': only pads, bass and downbeat kicks remain. */
  thin = false;
  readonly bus: GainNode;
  readonly filter: BiquadFilterNode;
  constructor(
    readonly context: AudioContext,
    destination: GainNode,
    public score: SectorScore,
    public mood: 'normal' | 'victory',
    public intensity: number,
    private random: () => number,
  ) {
    this.bus = context.createGain();
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.filter.Q.value = 0.4;
    this.bus.connect(this.filter).connect(destination);
    // A fresh voice starts its bass on a thinned variation and its lead on a rise.
    if (mood === 'normal') {
      this.enter(['bass'], 'sparse');
      if (intensity >= 3) this.enter(['lead'], 'riser');
    }
  }
  get tempo() {
    return this.score.bpm * (this.mood === 'victory' ? CALM_TEMPO : 1);
  }
  get stepSeconds() {
    return 60 / this.tempo / 4;
  }
  private enter(instruments: Instrument[], kind: EntryKind) {
    // Entries land on the next bar boundary at least half a bar away, so drops are announced by a fill.
    const boundary = Math.ceil((this.step + 8) / 16) * 16;
    const fill = FILLS[Math.floor(this.random() * FILLS.length)];
    for (const i of instruments) this.entries.set(i, { kind, start: this.step, boundary, fill });
  }
  /** Raises the layer count; each new instrument group enters in its own way. */
  raise(intensity: number) {
    const from = this.intensity;
    this.intensity = intensity;
    for (let layer = from + 1; layer <= intensity; layer++)
      for (const group of LAYER_ENTRIES[layer] ?? [])
        this.enter(group.instruments, group.kinds[Math.floor(this.random() * group.kinds.length)]);
  }
  /** Notes for the current step, after entries, outros and thinning. */
  notes(): MusicNote[] {
    const step = this.step,
      beat = step % 16;
    const raw =
      this.mood === 'victory' ? calmNotes(this.score, step) : musicNotes(this.score, step, this.intensity);
    const out: MusicNote[] = [];
    for (const note of raw) {
      if (
        this.thin &&
        !['pad', 'bass'].includes(note.instrument) &&
        !(note.instrument === 'kick' && beat === 0)
      )
        continue;
      const entry = this.entries.get(note.instrument);
      if (!entry) {
        out.push(note);
        continue;
      }
      const progress = Math.max(0, Math.min(1, (step - entry.start) / 64));
      if (entry.kind === 'drop' || entry.kind === 'stutter') {
        if (step < entry.boundary) continue;
        this.entries.delete(note.instrument);
        out.push(note);
      } else if (entry.kind === 'sparse') {
        // Downbeats only for two bars, then the full pattern.
        if (step < entry.start + 32 && beat % 8 !== 0) continue;
        if (step >= entry.start + 32) this.entries.delete(note.instrument);
        out.push(note);
      } else if (entry.kind === 'riser') {
        const p = Math.min(1, (step - entry.start) / 32);
        out.push({ ...note, velocity: note.velocity * (0.35 + 0.65 * p) });
        if (p >= 1) this.entries.delete(note.instrument);
      } else {
        out.push({ ...note, velocity: note.velocity * progress });
        if (progress >= 1) this.entries.delete(note.instrument);
      }
    }
    // Builds announcing a drop: a snare fill or a hat crescendo in the half bar before the boundary.
    for (const [instrument, entry] of this.entries) {
      if (step < entry.boundary - 8 || step >= entry.boundary) continue;
      if (entry.kind === 'drop' && instrument === 'snare') {
        const c = entry.fill[beat];
        if (c === 's') out.push({ instrument: 'snare', hz: 0, duration: 0.12, velocity: 0.12, delay: 0 });
        if (c === 't') out.push({ instrument: 'tom', hz: 0, duration: 0.16, velocity: 0.1, delay: 0 });
      }
      if (entry.kind === 'stutter' && instrument === 'hat' && beat % 2 === 0)
        out.push({
          instrument: 'hat',
          hz: 0,
          duration: 0.04,
          velocity: 0.012 + ((beat - 8) / 8) * 0.03,
          delay: 0,
        });
    }
    if (step >= this.outroBoundary - 8 && step < this.outroBoundary) {
      const c = this.outroFill[beat];
      if (c === 's') out.push({ instrument: 'snare', hz: 0, duration: 0.12, velocity: 0.13, delay: 0 });
      if (c === 't') out.push({ instrument: 'tom', hz: 0, duration: 0.16, velocity: 0.1, delay: 0 });
    }
    return out;
  }
}
/** Procedural sector scores, scheduled ahead on the audio clock. */
export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private musicOut?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private lastShot = 0;
  private noise?: AudioBuffer;
  private active = true;
  private musicActive = true;
  private effectsBus?: GainNode;
  private musicLevel = 0.6;
  private effectsLevel = 0.6;
  /** Synth velocities are small; buses carry make-up gain and the master is compressed. */
  private static readonly MUSIC_GAIN = 3.2;
  private static readonly EFFECTS_GAIN = 2.4;
  private current?: Voice;
  private outgoing?: Voice;
  private key = '';
  private desiredMood: 'normal' | 'victory' = 'normal';
  private desiredIntensity = LAYERS;
  /** The last transition chosen, for diagnostics and tests. */
  lastTransition: TransitionKind | '' = '';
  score = generateScore(0, 0);
  setSector(seed: number, sector: number, arrangement = 0, genre = 'auto') {
    const key = `${seed}:${sector}:${arrangement}:${genre}`;
    if (key === this.key) return;
    this.key = key;
    this.score = generateScore(seed, sector, arrangement, genre);
    this.restart();
  }
  /** 'victory' plays the calm rendition of the current score, as on the sector-cleared screen. */
  set mood(value: 'normal' | 'victory') {
    if (value === this.desiredMood) return;
    this.desiredMood = value;
    this.restart();
  }
  get mood() {
    return this.desiredMood;
  }
  /** Arrangement layers in play (1–5): the attack number during a sector, one on the home screen. */
  set intensity(value: number) {
    const level = Math.max(1, Math.min(LAYERS, Math.round(value)));
    if (level === this.desiredIntensity) return;
    this.desiredIntensity = level;
    if (!this.current) return;
    if (level > this.current.intensity) this.current.raise(level);
    else this.current.intensity = level;
  }
  get intensity() {
    return this.desiredIntensity;
  }
  /** Starts a new voice for the current score and mood, transitioning from whatever plays now. */
  private restart() {
    if (!this.context || !this.musicOut) return;
    const c = this.context,
      now = c.currentTime;
    const random = rng((this.score.seed ^ (this.desiredMood === 'victory' ? 0x7f4a7c15 : 0)) >>> 0);
    const voice = new Voice(c, this.musicOut, this.score, this.desiredMood, this.desiredIntensity, random);
    const old = this.current;
    if (this.outgoing) this.dropVoice(this.outgoing);
    this.outgoing = old;
    this.current = voice;
    if (!old) {
      voice.next = now + 0.1;
      return;
    }
    const kind = TRANSITIONS[Math.floor(random() * TRANSITIONS.length)];
    this.lastTransition = kind;
    const bar = 16 * voice.stepSeconds;
    old.bus.gain.cancelScheduledValues(now);
    old.bus.gain.setValueAtTime(old.bus.gain.value, now);
    if (kind === 'crossfade') {
      old.bus.gain.linearRampToValueAtTime(0, now + 4 * bar);
      old.until = now + 4 * bar;
      voice.bus.gain.setValueAtTime(0, now);
      voice.bus.gain.linearRampToValueAtTime(1, now + 4 * bar);
      voice.next = now + 0.05;
    } else if (kind === 'cut') {
      // The old voice finishes its bar with a fill, then the new one starts on that beat.
      const boundary = Math.ceil((old.step + 8) / 16) * 16;
      const at = old.next + (boundary - old.step) * old.stepSeconds;
      old.outroBoundary = boundary;
      old.outroFill = FILLS[Math.floor(random() * FILLS.length)];
      old.until = at;
      old.bus.gain.setValueAtTime(0, at + 0.02);
      voice.next = at;
    } else if (kind === 'sweep') {
      old.filter.frequency.setValueAtTime(18000, now);
      old.filter.frequency.exponentialRampToValueAtTime(140, now + 2 * bar);
      old.bus.gain.linearRampToValueAtTime(0, now + 2 * bar);
      old.until = now + 2 * bar;
      voice.filter.frequency.setValueAtTime(260, now);
      voice.filter.frequency.exponentialRampToValueAtTime(18000, now + 1.5 * bar);
      voice.next = now + 0.05;
    } else {
      // Breakdown: the old voice thins to pads and bass for two bars, then the new one drops in.
      const boundary = Math.ceil((old.step + 4) / 16) * 16;
      const at = old.next + (boundary - old.step) * old.stepSeconds;
      old.thin = true;
      old.bus.gain.linearRampToValueAtTime(0.7, at);
      old.until = at + 2 * 16 * old.stepSeconds;
      old.bus.gain.linearRampToValueAtTime(0, old.until);
      voice.next = at + 2 * 16 * old.stepSeconds;
    }
  }
  private dropVoice(v: Voice) {
    try {
      v.bus.disconnect();
      v.filter.disconnect();
    } catch {
      /* already disconnected */
    }
  }
  set musicEnabled(value: boolean) {
    this.musicActive = value;
    this.sync();
  }
  get musicEnabled() {
    return this.musicActive;
  }
  set enabled(value: boolean) {
    this.active = value;
    this.sync();
  }
  get enabled() {
    return this.active;
  }
  set musicVolume(value: number) {
    this.musicLevel = Math.max(0, Math.min(1, value));
    this.sync();
  }
  get musicVolume() {
    return this.musicLevel;
  }
  set effectsVolume(value: number) {
    this.effectsLevel = Math.max(0, Math.min(1, value));
    this.sync();
  }
  get effectsVolume() {
    return this.effectsLevel;
  }
  private sync() {
    if (!this.context || !this.master) return;
    const at = this.context.currentTime;
    this.master.gain.setTargetAtTime(document.hidden ? 0 : 1, at, 0.03);
    this.musicOut?.gain.setTargetAtTime(
      this.musicActive ? this.musicLevel * AudioEngine.MUSIC_GAIN : 0,
      at,
      0.05,
    );
    this.effectsBus?.gain.setTargetAtTime(
      this.active ? this.effectsLevel * AudioEngine.EFFECTS_GAIN : 0,
      at,
      0.03,
    );
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 1;
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 18;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      this.master.connect(limiter).connect(this.context.destination);
      this.effectsBus = this.context.createGain();
      this.effectsBus.gain.value = this.active ? this.effectsLevel * AudioEngine.EFFECTS_GAIN : 0;
      this.effectsBus.connect(this.master);
      this.musicOut = this.context.createGain();
      this.musicOut.gain.value = this.musicActive ? this.musicLevel * AudioEngine.MUSIC_GAIN : 0;
      this.musicOut.connect(this.master);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => this.sync());
      this.restart();
    }
    await this.context.resume();
    this.sync();
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }
  private tone(
    hz: number,
    at: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'square',
    end = hz,
    destination = this.effectsBus!,
  ) {
    const c = this.context!,
      osc = c.createOscillator(),
      gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(destination);
    osc.start(at);
    osc.stop(at + duration + 0.01);
  }
  /** Filtered noise burst: the body of snares, claps, hats and percussion. */
  private noiseHit(
    at: number,
    hz: number,
    volume: number,
    decay: number,
    destination: GainNode,
    band = false,
  ) {
    const c = this.context!,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = this.noise!;
    filter.type = band ? 'bandpass' : 'highpass';
    filter.frequency.value = hz;
    if (band) filter.Q.value = 1.4;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    source.connect(filter).connect(gain).connect(destination);
    source.start(at);
    source.stop(at + decay + 0.02);
  }
  private drum(at: number, snare: boolean, soft = false, destination = this.effectsBus!) {
    this.noiseHit(
      at,
      snare ? 1100 : 6500,
      (snare ? 0.16 : 0.045) * (soft ? 0.4 : 1),
      snare ? 0.13 : 0.045,
      destination,
    );
    if (snare) this.tone(185, at, 0.09, soft ? 0.025 : 0.07, 'triangle', 90, destination);
  }
  /** Genre percussion beyond kick, snare and closed hat. */
  private percussion(instrument: string, at: number, velocity: number, destination: GainNode) {
    if (instrument === 'clap') {
      for (const offset of [0, 0.012, 0.024])
        this.noiseHit(at + offset, 1600, velocity * 0.5, 0.05, destination, true);
      this.noiseHit(at + 0.03, 1400, velocity, 0.16, destination, true);
    } else if (instrument === 'ohat') this.noiseHit(at, 7000, velocity, 0.2, destination);
    else if (instrument === 'perc') {
      this.noiseHit(at, 3200, velocity * 0.5, 0.03, destination, true);
      this.tone(820, at, 0.04, velocity * 0.9, 'sine', 640, destination);
    } else if (instrument === 'tom') this.tone(190, at, 0.16, velocity, 'sine', 95, destination);
  }
  private schedule() {
    const c = this.context!;
    for (const voice of [this.current, this.outgoing]) {
      if (!voice) continue;
      if (c.currentTime > voice.until) {
        this.dropVoice(voice);
        if (voice === this.outgoing) this.outgoing = undefined;
        continue;
      }
      if (voice.next < c.currentTime) voice.next = c.currentTime + 0.02;
      while (voice.next < c.currentTime + 0.12) {
        if (this.musicActive && !document.hidden && voice.next < voice.until)
          for (const note of voice.notes()) this.render(voice, note, voice.next + note.delay);
        voice.step++;
        voice.next += voice.stepSeconds;
      }
    }
  }
  private render(voice: Voice, note: MusicNote, at: number) {
    const genre = voice.score.genre,
      bus = voice.bus;
    if (note.instrument === 'kick')
      this.tone(
        genre === 'house' ? 150 : genre === 'dubstep' ? 120 : 130,
        at,
        genre === 'dubstep' || genre === 'house' ? 0.22 : 0.15,
        note.velocity,
        'sine',
        genre === 'dubstep' ? 30 : 38,
        bus,
      );
    else if (note.instrument === 'snare' || note.instrument === 'ghost')
      this.drum(at, true, note.instrument === 'ghost', bus);
    else if (note.instrument === 'hat') this.drum(at, false, note.velocity < 0.03, bus);
    else if (['clap', 'ohat', 'perc', 'tom'].includes(note.instrument))
      this.percussion(note.instrument, at, note.velocity, bus);
    else if (note.instrument === 'stab')
      this.tone(note.hz, at, note.duration, note.velocity, 'square', note.hz, bus);
    else if (note.instrument === 'echo')
      this.tone(note.hz, at, note.duration, note.velocity, 'triangle', note.hz, bus);
    else {
      this.tone(
        note.hz,
        at,
        note.duration,
        note.velocity,
        note.instrument === 'lead' ? voice.score.voice : 'triangle',
        note.hz,
        bus,
      );
      if (note.instrument === 'lead')
        this.tone(note.hz, at + 60 / voice.tempo / 2, 0.3, 0.009, 'triangle', note.hz, bus);
    }
  }
  shot(kind: TowerKind) {
    if (!this.active || !this.context || this.context.currentTime - this.lastShot < 0.075) return;
    this.lastShot = this.context.currentTime;
    const hz: Record<TowerKind, number> = {
      cannon: 700,
      mortar: 90,
      slow: 400,
      arc: 1400,
      laser: 1800,
      gate: 100,
      scatter: 240,
      pulse: 320,
      rail: 2200,
      shredder: 900,
      reactor: 100,
    };
    this.tone(
      hz[kind],
      this.lastShot,
      kind === 'mortar' ? 0.22 : 0.09,
      0.055,
      kind === 'pulse' ? 'sine' : 'square',
      50,
    );
  }
  play(type: 'click' | 'launch' | 'breach' | 'win') {
    if (!this.active || !this.context || this.context.state !== 'running') return;
    const at = this.context.currentTime;
    if (type === 'click') this.tone(1100, at, 0.035, 0.045, 'sine', 750);
    else if (type === 'win')
      [523, 659, 784, 1047].forEach((hz, i) => this.tone(hz, at + i * 0.1, 0.25, 0.09));
    else this.tone(type === 'launch' ? 100 : 230, at, 0.4, 0.15, 'sawtooth', type === 'launch' ? 800 : 30);
  }
}
