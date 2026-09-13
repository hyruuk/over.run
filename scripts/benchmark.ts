import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import { freshProfile, startAttempt } from '../src/model';
import { Simulation, mergeCohorts, population } from '../src/simulation';
const results = [];
for (const [name, records, members] of [
  ['individuals', 10000, 1],
  ['million swarm', 1000, 1000],
  ['fragmented swarm', 4000, 250],
] as const) {
  const a = startAttempt(freshProfile(77), 1),
    sim = new Simulation(a, { aggregation: name !== 'individuals' });
  for (let i = 0; i < records; i++) {
    sim.addEnemy('virus', members, a.board.entries[i % 2]);
    sim.enemies.at(-1)!.progress = i % 1000;
  }
  if (name === 'fragmented swarm')
    for (const e of sim.enemies)
      e.bands = [
        { hp: 10, count: 50 },
        { hp: 23, count: 100 },
        { hp: 32, count: 100 },
      ];
  const tickTimes = [];
  const start = performance.now();
  for (let i = 0; i < 300; i++) {
    const t = performance.now();
    sim.step();
    tickTimes.push(performance.now() - t);
  }
  tickTimes.sort((a, b) => a - b);
  results.push({
    name,
    initialRecords: records,
    representedPopulation: records * members,
    ticks: 300,
    elapsedMs: Math.round(performance.now() - start),
    p95TickMs: +tickTimes[Math.floor(tickTimes.length * 0.95)].toFixed(3),
    finalRecords: sim.enemies.length,
    heapMB: +(process.memoryUsage().heapUsed / 1048576).toFixed(1),
  });
}
const report = {
  date: new Date().toISOString(),
  node: process.version,
  cpu: os.cpus()[0]?.model,
  platform: os.platform(),
  scope:
    'Headless simulation, no towers in these population stress cases. Not a GPU or frame-rate benchmark.',
  results,
};
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/simulation-benchmark.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
