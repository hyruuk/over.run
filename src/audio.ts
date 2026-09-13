import type { TowerKind } from './types';
import { generateScore, musicNotes, LAYERS } from './music';

/** Procedural sector scores, scheduled ahead on the audio clock. */
export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private next = 0;
  private step = 0;
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
  private sectorKey = '';
  private musicBus?: GainNode;
  /** Arrangement layers in play (1–5): the attack number during a sector, one on the home screen. */
  intensity = LAYERS;
  score = generateScore(0, 0);
  setSector(seed: number, sector: number, arrangement = 0, genre = 'auto') {
    const key = `${seed}:${sector}:${arrangement}:${genre}`;
    if (key === this.sectorKey) return;
    this.sectorKey = key;
    this.score = generateScore(seed, sector, arrangement, genre);
    this.step = 0;
    if (this.context) {
      const old = this.musicBus;
      old?.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
      if (old) setTimeout(() => old.disconnect(), 1800);
      this.createMusicBus();
      this.next = this.context.currentTime + 0.12;
    }
  }
  private createMusicBus() {
    this.musicBus = this.context!.createGain();
    this.musicBus.connect(this.master!);
    this.musicBus.gain.setValueAtTime(0, this.context!.currentTime);
    this.musicBus.gain.linearRampToValueAtTime(
      this.musicActive ? this.musicLevel * AudioEngine.MUSIC_GAIN : 0,
      this.context!.currentTime + 0.25,
    );
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
    this.musicBus?.gain.cancelScheduledValues(at);
    this.musicBus?.gain.setTargetAtTime(
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
      this.createMusicBus();
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => this.sync());
    }
    await this.context.resume();
    this.sync();
    if (!this.timer) {
      this.next = this.context.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 25);
    }
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
    if (this.next < c.currentTime) this.next = c.currentTime + 0.02;
    while (this.next < c.currentTime + 0.12) {
      const at = this.next;
      if (this.musicActive && !document.hidden) {
        for (const note of musicNotes(this.score, this.step, this.intensity)) {
          const at = this.next + note.delay;
          const genre = this.score.genre;
          if (note.instrument === 'kick')
            this.tone(
              genre === 'house' ? 150 : genre === 'dubstep' ? 120 : 130,
              at,
              genre === 'dubstep' || genre === 'house' ? 0.22 : 0.15,
              note.velocity,
              'sine',
              genre === 'dubstep' ? 30 : 38,
              this.musicBus,
            );
          else if (note.instrument === 'snare' || note.instrument === 'ghost')
            this.drum(at, true, note.instrument === 'ghost', this.musicBus);
          else if (note.instrument === 'hat') this.drum(at, false, note.velocity < 0.03, this.musicBus);
          else if (['clap', 'ohat', 'perc', 'tom'].includes(note.instrument))
            this.percussion(note.instrument, at, note.velocity, this.musicBus!);
          else if (note.instrument === 'stab')
            this.tone(note.hz, at, note.duration, note.velocity, 'square', note.hz, this.musicBus);
          else if (note.instrument === 'echo')
            this.tone(note.hz, at, note.duration, note.velocity, 'triangle', note.hz, this.musicBus);
          else {
            const onset = at;
            this.tone(
              note.hz,
              onset,
              note.duration,
              note.velocity,
              note.instrument === 'lead' ? this.score.voice : 'triangle',
              note.hz,
              this.musicBus,
            );
            if (note.instrument === 'lead')
              this.tone(
                note.hz,
                onset + 60 / this.score.bpm / 2,
                0.3,
                0.009,
                'triangle',
                note.hz,
                this.musicBus,
              );
          }
        }
      }
      this.step++;
      this.next += 60 / this.score.bpm / 4;
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
