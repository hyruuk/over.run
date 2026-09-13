import { test, expect, type Page } from '@playwright/test';

/** The home screen greets every session; tests that need the console start a run from it. */
async function enter(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const start = page.locator('.home-actions .launch');
    if (await start.isVisible()) await start.click();
    try {
      await page.locator('.workspace').waitFor({ timeout: 5000 });
      return;
    } catch {
      /* the click may have landed during boot; try again */
    }
  }
  await page.locator('.workspace').waitFor();
}
test('trillion-member snapshots keep animating when effects arrive after the frame timestamp', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page);
  const result = await page.evaluate(async () => {
    const modelPath = '/src/model.ts',
      simulationPath = '/src/simulation.ts',
      renderingPath = '/src/rendering.ts';
    const { freshProfile, startAttempt } = await import(modelPath);
    const { Simulation } = await import(simulationPath);
    const { BoardRenderer } = await import(renderingPath);
    const p = freshProfile(123);
    p.unlocked = 1000;
    const a = startAttempt(p, 1000);
    a.wave = 5;
    const sim = new Simulation(a);
    sim.addEnemy('virus', 1e12, a.board.entries[0]);
    const snapshot = sim.snapshot();
    snapshot.shots = [{ from: a.board.core, x: 5, y: 5, kind: 'pulse' }];
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;width:980px;height:630px';
    document.body.append(host);
    const renderer = new BoardRenderer(host, a, () => {});
    // ResizeObserver must size both canvases before drawing.
    await new Promise(requestAnimationFrame);
    const frameTime = performance.now() - 1;
    renderer.update(snapshot);
    renderer.draw(frameTime);
    let draws = 0;
    const original = renderer.draw.bind(renderer);
    renderer.draw = (time: number) => {
      original(time);
      draws++;
    };
    await new Promise((resolve) => setTimeout(resolve, 250));
    const modes = [];
    for (const quality of ['high', 'low']) {
      renderer.quality = quality;
      renderer.draw(performance.now());
      modes.push(quality);
    }
    const gpu = renderer.gpu.gl;
    renderer.gpu.gl = null;
    renderer.draw(performance.now());
    modes.push('canvas');
    renderer.gpu.gl = gpu;
    renderer.destroy();
    host.remove();
    return { alive: snapshot.alive, records: snapshot.records, draws, modes };
  });
  expect(result.alive).toBe(1e12);
  expect(result.records).toBe(1);
  expect(result.draws).toBeGreaterThan(3);
  expect(result.modes).toEqual(['high', 'low', 'canvas']);
});

test('worker delivers advancing snapshots at the trillion-enemy encounter cap', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  const result = await page.evaluate(async () => {
    const path = '/src/model.ts';
    const { freshProfile, startAttempt } = await import(path);
    const p = freshProfile(123);
    p.unlocked = 1000;
    const attempt = startAttempt(p, 1000);
    attempt.wave = 5;
    const worker = new Worker('/src/worker.ts', { type: 'module' });
    return await new Promise<{ ticks: number[]; total: number; records: number }>((resolve, reject) => {
      const ticks: number[] = [];
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Snapshot stream stalled'));
      }, 10000);
      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(e.message));
      };
      worker.onmessage = ({ data }) => {
        if (data.type !== 'snapshot') return;
        ticks.push(data.snapshot.tick);
        worker.postMessage({ type: 'ack', version: 1, id: attempt.id, revision: 0 });
        if (data.snapshot.tick >= 120) {
          clearTimeout(timeout);
          worker.terminate();
          resolve({ ticks, total: data.snapshot.total, records: data.snapshot.records });
        }
      };
      worker.postMessage({ type: 'start', version: 1, attempt, revision: 0, speed: 4 });
    });
  });
  expect(result.total).toBeGreaterThanOrEqual(1e12);
  expect(result.ticks.at(-1)).toBeGreaterThanOrEqual(120);
  expect(result.records).toBeLessThanOrEqual(result.ticks.at(-1)! + 1);
});
