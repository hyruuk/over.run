import { Simulation } from './simulation';
import { validateRules } from './model';
import type { Attempt } from './types';
let sim: Simulation | null = null;
let speed = 1;
let paused = false;
let last = performance.now();
let accumulator = 0;
let revision = 0;
let awaiting = false;
const send = () => {
  if (!sim || awaiting) return;
  const snapshot = sim.snapshot();
  awaiting = true;
  postMessage(
    { type: 'snapshot', version: 1, id: sim.attempt.id, revision, snapshot },
    { transfer: [snapshot.enemies.buffer] },
  );
};
self.onmessage = (event: MessageEvent) => {
  const m = event.data;
  if (m.version !== 1) return;
  if (m.type === 'start') {
    const a = m.attempt as Attempt;
    const errors = validateRules(a.rules, a);
    if (errors.length) {
      postMessage({ type: 'error', text: errors.join(' ') });
      return;
    }
    sim = new Simulation(a);
    revision = m.revision;
    speed = [0.5, 1, 2, 4].includes(m.speed) ? m.speed : 1;
    paused = false;
    accumulator = 0;
    last = performance.now();
    awaiting = false;
    send();
  } else if (sim && m.id === sim.attempt.id && m.revision === revision) {
    if (m.type === 'speed' && [0.5, 1, 2, 4].includes(m.speed)) speed = m.speed;
    if (m.type === 'visibility') {
      paused = m.hidden;
      last = performance.now();
      accumulator = 0;
    }
    if (m.type === 'ack') {
      awaiting = false;
      if (sim.done) sendFinal();
    }
  }
};
let finished = '';
function sendFinal() {
  if (sim?.done && finished !== `${sim.attempt.id}:${sim.attempt.wave}`) {
    finished = `${sim.attempt.id}:${sim.attempt.wave}`;
    send();
  }
}
setInterval(() => {
  const now = performance.now(),
    elapsed = Math.min(100, now - last);
  last = now;
  if (!sim || sim.done || paused) return;
  accumulator += elapsed * speed;
  let ticks = 0;
  const start = performance.now();
  while (accumulator >= 1000 / 30 && ticks < 16 && performance.now() - start < 16) {
    sim.step();
    accumulator -= 1000 / 30;
    ticks++;
  }
  accumulator = Math.min(accumulator, 1000);
  send();
}, 33);
