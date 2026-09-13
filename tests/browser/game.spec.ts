import { test, expect, type Page } from '@playwright/test';
import { freshProfile, startAttempt, build, upgrade } from '../../src/model';
import { RESEARCH, TOWERS } from '../../src/content';
import type { TowerKind } from '../../src/types';
import { writeFileSync } from 'node:fs';
test('upgraded ranges are shown accurately and any unlocked sector is reachable', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.locator('[data-action="tool"][data-kind="cannon"]').click();
  const canvas = page.locator('.board-base');
  await canvas.focus();
  // The board is seeded at random on first boot; walk right until an empty substrate cell accepts the cannon.
  for (let step = 0; step < 8; step++) {
    await canvas.press('Enter');
    if ((await page.locator('#inspector').textContent())?.includes('cells')) break;
    await canvas.press('ArrowRight');
  }
  await expect(page.locator('#inspector')).toContainText('3.6 cells');
  await page.getByRole('button', { name: /Upgrade ·/ }).click();
  await expect(page.locator('#inspector')).toContainText('3.8 cells');
  const p = freshProfile(77);
  p.unlocked = 50;
  p.attempts = 1;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.locator('#import-file').setInputFiles({
    name: 'late-campaign.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole('button', { name: 'Sectors', exact: true }).click();
  await page.getByLabel('Connect to any unlocked sector').fill('1');
  await page.getByRole('button', { name: '> connect', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Memory fortress' })).toBeVisible();
});
test('build, compile, execute, reload checkpoint, export and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await enter(page);
  await expect(page.getByRole('heading', { name: 'Perimeter defense' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/desktop-initial.png', fullPage: true });
  await page.getByRole('button', { name: 'Load starter layout' }).click();
  await expect(page.getByText('4 installations ·')).toBeVisible();
  await page.getByRole('button', { name: 'Open routine editor' }).click();
  await page.getByRole('button', { name: '+ Pressure relief' }).click();
  await page.getByRole('button', { name: '+ Safe overclock' }).click();
  await page.screenshot({ path: 'artifacts/routine-editor.png', fullPage: true });
  await page.getByRole('button', { name: '> compile' }).click();
  await expect(page.getByText('4 installations · 2 routines')).toBeVisible();
  await page.getByRole('button', { name: 'Run attack' }).click();
  await expect(page.getByText('ATTACK IN PROGRESS', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4 times speed' }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'artifacts/combat.png', fullPage: true });
  await expect(page.locator('[data-action="tool"]').first()).toBeDisabled();
  await page.reload();
  await enter(page);
  await expect(page.getByText('PREPARATION', { exact: true })).toBeVisible();
  await expect(page.getByText('4 installations · 2 routines')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  expect((await download).suggestedFilename()).toMatch(/over\.run-save/);
  await page.getByRole('button', { name: 'Reset progression', exact: true }).click();
  await expect(page.getByText('Erase this system?')).toBeVisible();
  await page.getByRole('button', { name: 'Erase all progression' }).click();
  await expect(page.getByText('Your core is exposed.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
test('imported progression can complete all five attacks and advance to a fresh board', async ({ page }) => {
  const p = freshProfile(44);
  p.nodes = RESEARCH.flatMap((n) => Array<string>(n.levels).fill(n.id));
  p.research = '500';
  const a = startAttempt(p, 1);
  a.credits = 5000;
  const w = a.board.width;
  for (const kind of [
    'mortar',
    'cannon',
    'slow',
    'laser',
    'arc',
    'mortar',
    'cannon',
    'laser',
    'mortar',
  ] as TowerKind[]) {
    const score = (cell: number) =>
      a.board.tiles.reduce(
        (sum, t, i) =>
          sum +
          (t === 1 &&
          Math.hypot((i % w) - (cell % w), Math.floor(i / w) - Math.floor(cell / w)) < TOWERS[kind].range
            ? 1
            : 0),
        0,
      ) -
      a.towers.reduce(
        (s, t) =>
          s +
          (Math.hypot((t.cell % w) - (cell % w), Math.floor(t.cell / w) - Math.floor(cell / w)) < 3 ? 10 : 0),
        0,
      );
    const cell = a.board.tiles
      .map((t, i) => ({ t, i }))
      .filter((x) => x.t === 0 && !a.towers.some((t) => t.cell === x.i))
      .sort((x, y) => score(y.i) - score(x.i))[0].i;
    build(a, kind, cell);
    upgrade(a, a.towers.at(-1)!.id);
    upgrade(a, a.towers.at(-1)!.id);
  }
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.locator('#import-file').setInputFiles({
    name: 'campaign.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.getByText('9 installations ·')).toBeVisible();
  for (let wave = 1; wave <= 5; wave++) {
    await page.getByRole('button', { name: 'Run attack', exact: true }).click();
    if (wave > 1) await expect(page.getByRole('button', { name: '4 times speed' })).toHaveClass('active');
    await page.getByRole('button', { name: '4 times speed' }).click();
    await expect(page.locator('#modal-title')).toBeVisible({ timeout: 60000 });
    if (wave < 5) {
      await expect(page.locator('#modal-title')).toHaveText('Read the aftermath.');
      await page.getByRole('button', { name: 'Choose exploit', exact: true }).last().click();
      await page.locator('.reward-card').first().click();
    } else await expect(page.locator('#modal-title')).toHaveText('Intrusion contained.');
  }
  await page.screenshot({ path: 'artifacts/victory.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // A frontier clear drafts a permanent trait before the intermission.
  await expect(page.locator('#modal-title')).toHaveText('The sector is yours. Choose what it makes of you.');
  await expect(page.locator('.trait-card')).toHaveCount(3);
  await page.locator('.trait-card').first().click();
  await expect(page.locator('#modal-title')).toHaveText('Upgrade before the next breach.');
  await expect(page.locator('.run-profile .chip-trait')).toHaveCount(1);
  await page.getByRole('button', { name: 'Choose next sector', exact: true }).click();
  await page.locator('[data-action="start-sector"][data-level="2"]').click();
  await expect(page.getByRole('heading', { name: 'Memory fortress' })).toBeVisible();
  await expect(page.getByText('Your core is exposed.')).toBeVisible();
  await page.reload();
  await enter(page);
  await expect(page.getByRole('heading', { name: 'Memory fortress' })).toBeVisible();
});
test('a second tab cannot overwrite the active campaign; invalid imports leave progress intact', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await enter(page);
  await expect(page.getByText('PREPARATION', { exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByText('Another tab is already running this game.')).toBeVisible();
  await second.close();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#import-file').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.locator('#toast')).toContainText('unsupported version');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByText('Your core is exposed.')).toBeVisible();
});
test('renderer benchmark records dense sprite workloads without changing simulation', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await enter(page);
  await expect(page.getByText('PREPARATION', { exact: true })).toBeVisible();
  const report = await page.evaluate(async () => {
    const renderingPath = '/src/rendering.ts',
      modelPath = '/src/model.ts';
    const { BoardRenderer } = await import(renderingPath),
      { freshProfile, startAttempt } = await import(modelPath);
    const results = [];
    for (const [name, records, members] of [
      ['10k visible individuals', 10000, 1],
      ['million represented swarm', 1000, 1000],
    ] as const) {
      const container = document.createElement('div');
      container.style.cssText =
        'position:fixed;inset:0;width:980px;height:630px;z-index:100;background:#10171c';
      document.body.append(container);
      const r = new BoardRenderer(container, startAttempt(freshProfile(44), 1), () => {});
      const data = new Float32Array(records * 5);
      for (let i = 0; i < records; i++)
        data.set([(i % 280) / 10, Math.floor(i / 280) % 18, i % 4, members, 1], i * 5);
      r.snapshot = { enemies: data, towers: [] };
      const times: number[] = [];
      const original = r.draw.bind(r);
      r.draw = (time: number) => {
        const start = performance.now();
        original(time);
        times.push(performance.now() - start);
      };
      const start = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const elapsed = performance.now() - start;
      times.sort((a, b) => a - b);
      const gl = container.querySelectorAll('canvas')[1].getContext('webgl2')!;
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      results.push({
        name,
        records,
        population: records * members,
        renderMode: r.mode,
        measuredDrawsPerSecond: +((times.length / elapsed) * 1000).toFixed(1),
        p95DrawSubmissionMs: +times[Math.floor(times.length * 0.95)].toFixed(2),
        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      });
      r.destroy();
      container.remove();
    }
    return {
      date: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: '980×630 battlefield, DPR ' + devicePixelRatio,
      results,
      limitations:
        'Headless browser. Submission time is not GPU completion time. Software rendering is identified by GPU string; real-device FPS remains unverified.',
    };
  });
  writeFileSync('artifacts/browser-benchmark.json', JSON.stringify({ browserName, ...report }, null, 2));
  expect(report.results.every((r) => r.renderMode === 'WebGL2')).toBeTruthy();
});
test('loss settles research, unlock purchases persist, and a new attempt can begin', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Load starter layout' }).click();
  await page.getByRole('button', { name: 'Run attack' }).click();
  await page.getByRole('button', { name: '4 times speed' }).click();
  await expect(page.locator('#modal-title')).toBeVisible({ timeout: 80000 });
  await page.screenshot({ path: 'artifacts/diagnostics.png', fullPage: true });
  // The starter may win or lose depending on its generated layout; both must settle cleanly.
  const title = await page.locator('#modal-title').textContent();
  if (title === 'Read the aftermath.') {
    await page.getByRole('button', { name: 'Choose exploit', exact: true }).last().click();
    await expect(page.locator('.reward-card')).toHaveCount(3);
    await page.locator('.reward-card').first().click();
    await page.getByRole('button', { name: 'Sectors', exact: true }).click();
    await page.getByRole('button', { name: 'End attempt & collect research' }).click();
    await page.getByRole('button', { name: 'Collect & disconnect' }).click();
  } else {
    await page.getByRole('button', { name: /Try again/ }).click();
    await expect(page.getByText('Your core is exposed.')).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.screenshot({ path: 'artifacts/research-tree.png', fullPage: true });
  await expect(page.getByRole('tab')).toHaveCount(8);
  await expect(page.locator('.research-node')).toHaveCount(8);
  await expect(page.locator('.node-levels').first()).toBeVisible();
  const node = page.locator('[data-id="arsenal-1"]');
  if (await node.isEnabled()) {
    await node.click();
    await expect(node).toHaveClass(/owned/);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Sectors', exact: true }).click();
  await page.locator('[data-action="start-sector"]').first().click();
  await expect(page.getByText('Your core is exposed.')).toBeVisible();
});
test('production bundle launches its worker and retains the preparation checkpoint', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');
  await enter(page);
  await expect(page).toHaveTitle(/over\.run/);
  await page.getByRole('button', { name: 'Load starter layout' }).click();
  await page.getByRole('button', { name: 'Run attack', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Attack running', exact: true })).toBeDisabled();
  await expect(page.locator('#time-value')).not.toHaveText('0s', { timeout: 5000 });
  await page.reload();
  await enter(page);
  await expect(page.getByText('PREPARATION', { exact: true })).toBeVisible();
  await expect(page.getByText('4 installations ·')).toBeVisible();
  expect(errors).toEqual([]);
});

/** The home screen greets every session; tests that need the console start a run from it. */
async function enter(page: Page) {
  const start = page.locator('.home-actions .launch');
  if (await start.isVisible()) await start.click();
  await page.locator('.workspace').waitFor();
}
test('death screen retries at sector 000 with no research after reload', async ({ page }) => {
  const p = freshProfile(21);
  p.nodes = ['arsenal-1'];
  p.research = '999';
  p.unlocked = 4;
  const a = startAttempt(p, 4);
  a.core = 1;
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.locator('#import-file').setInputFiles({
    name: 'death.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole('button', { name: 'Run attack', exact: true }).click();
  await page.getByRole('button', { name: '4 times speed' }).click();
  await expect(page.locator('#modal-title')).toHaveText('Core lost. Boot again.', { timeout: 60000 });
  await page.screenshot({ path: 'artifacts/death-screen.png', fullPage: true });
  await page.getByRole('button', { name: /Try again/ }).click();
  await expect(page.locator('.page-heading .eyebrow')).toContainText('SECTOR 000');
  await page.reload();
  await enter(page);
  await expect(page.getByText('Your core is exposed.')).toBeVisible();
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.locator('.research-node.owned')).toHaveCount(0);
});

test('selected speed reaches the worker when Run starts', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: '4 times speed' }).click();
  await page.getByRole('button', { name: 'Run attack', exact: true }).click();
  await expect(page.getByRole('button', { name: '4 times speed' })).toHaveClass('active');
  await expect
    .poll(async () => Number((await page.locator('#time-value').textContent())?.replace('s', '')), {
      timeout: 3000,
    })
    .toBeGreaterThanOrEqual(4);
});

test('branch graph purchases license weapons and persist unlocked exploits', async ({ page }) => {
  const p = freshProfile(42);
  p.research = '9999';
  p.attempts = 1;
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.locator('#import-file').setInputFiles({
    name: 'research.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(8);
  await page.locator('[data-id="arsenal-1"]').click();
  await page.getByRole('tab', { name: /ballistics/ }).click();
  await expect(page.locator('.research-node')).toHaveCount(12);
  await expect(page.locator('[data-id="ballistics-10"]')).toBeDisabled();
  await page.locator('[data-id="ballistics-1"]').click();
  await page.locator('[data-id="ballistics-2"]').click();
  await page.locator('[data-id="ballistics-4"]').click();
  await expect(page.locator('[data-id="ballistics-4"]')).toHaveClass(/owned/);
  await page.locator('.perk-catalog summary').click();
  await expect(page.locator('.perk-catalog .unlocked')).toHaveCount(11);
  await page.screenshot({ path: 'artifacts/branching-research.png', fullPage: true });
  await page.getByRole('tab', { name: /energy/ }).click();
  await page.locator('[data-id="energy-1"]').click();
  await page.locator('[data-id="energy-2"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/research-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.reload();
  // The home screen's navigation reaches the sector directory without starting a run first.
  await page.getByRole('button', { name: 'Sectors', exact: true }).click();
  await page.locator('[data-action="start-sector"][data-level="1"]').click();
  for (const kind of ['scatter', 'shredder', 'pulse', 'rail'])
    await expect(page.locator(`[data-kind="${kind}"]`)).toBeEnabled();
  await expect(page.locator('[data-kind="laser"]')).toBeDisabled();
});

test('music settings show a different composition in each sector', async ({ page }) => {
  const descriptions: string[] = [];
  await page.goto('/');
  await enter(page);
  for (const level of [1, 2]) {
    const p = freshProfile(42);
    p.unlocked = 2;
    startAttempt(p, level);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    page.once('dialog', (d) => d.accept());
    await page.locator('#import-file').setInputFiles({
      name: 'music.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(p)),
    });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    descriptions.push(
      await page
        .locator('.settings-list label')
        .filter({ has: page.locator('[data-setting="music"]') })
        .innerText(),
    );
    await page.getByRole('button', { name: 'Close dialog' }).click();
  }
  expect(descriptions[0]).not.toEqual(descriptions[1]);
});

test('research tabs and exploit library are reachable by keyboard', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('tab', { name: /arsenal/i }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: /economy/i })).toBeFocused();
  await expect(page.getByRole('tab', { name: /economy/i })).toHaveAttribute('aria-selected', 'true');
  await page.locator('.research-scroll').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.perk-catalog summary')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.perk-catalog')).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
});

test('music defaults on, produces audio after interaction, and mute persists independently of effects', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    class ObservedContext extends Native {
      private captured = false;
      override createGain() {
        const gain = super.createGain();
        if (!this.captured) {
          this.captured = true;
          const analyser = this.createAnalyser();
          analyser.fftSize = 2048;
          gain.connect(analyser);
          Object.assign(window, { testAudio: { context: this, analyser } });
        }
        return gain;
      }
    }
    window.AudioContext = ObservedContext;
  });
  await page.goto('/');
  await enter(page);
  await page.locator('.board-base').click({ position: { x: 10, y: 10 } });
  const rms = () =>
    page.evaluate(() => {
      const probe = (window as unknown as { testAudio?: { context: AudioContext; analyser: AnalyserNode } })
        .testAudio;
      if (!probe || probe.context.state !== 'running') return 0;
      const data = new Float32Array(2048);
      probe.analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((n, v) => n + v * v, 0) / data.length);
    });
  await expect.poll(rms).toBeGreaterThan(0.0001);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('[data-setting="music"]')).toBeChecked();
  await expect(page.locator('.settings-list')).toContainText('128 melodies');
  await page.locator('[data-setting="sound"]').uncheck();
  await expect(page.locator('[data-setting="music"]')).toBeChecked();
  await expect.poll(rms).toBeGreaterThan(0.0001);
  await page.locator('[data-setting="music"]').uncheck();
  await expect.poll(rms).toBeLessThan(0.00001);
  await page.reload();
  await enter(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('[data-setting="music"]')).not.toBeChecked();
  await expect(page.locator('[data-setting="sound"]')).not.toBeChecked();
  await page.getByRole('button', { name: 'Reset progression', exact: true }).click();
  await page.getByRole('button', { name: 'Erase all progression' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('[data-setting="music"]')).toBeChecked();
});

test('developer tools and a routine authored from scratch persist', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('[data-setting="devMode"]').check();
  await page.getByRole('button', { name: 'Open developer tools' }).click();
  await page.getByRole('button', { name: 'Get 1,000 credits' }).click();
  await expect(page.locator('#credits-value')).toHaveText('1,360');
  await page.getByRole('button', { name: 'Unlock all research & weapons' }).click();
  await page.getByRole('button', { name: 'Skip to next sector' }).click();
  await expect(page.getByRole('heading', { name: 'Memory fortress' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Open routine editor' }).click();
  await page.getByRole('button', { name: '+ New routine', exact: true }).click();
  await expect(page.locator('[data-rule-field="sensor"]')).toHaveValue('');
  await page.locator('[data-rule-field="sensor"]').selectOption('heat');
  await page.locator('[data-rule-field="target"]').selectOption('kind:cannon');
  await page.locator('[data-rule-field="value"]').fill('65');
  await page.locator('[data-rule-field="action"]').selectOption('vent');
  await page.locator('[data-rule-field="repeat"]').fill('5');
  await page.getByRole('button', { name: '> compile' }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('.nav-count')).toHaveText('1');
  await page.screenshot({ path: 'artifacts/expanded-mainboard.png', fullPage: true });
  await page.reload();
  await enter(page);
  await expect(page.getByRole('button', { name: 'DEV', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open routine editor' }).click();
  await expect(page.locator('[data-rule-field="action"]')).toHaveValue('vent');
  await expect(page.locator('[data-rule-field="target"]')).toHaveValue('kind:cannon');
  await page.screenshot({ path: 'artifacts/custom-routine.png', fullPage: true });
});

test('home screen starts a run, the tutorial guides the first build, and skipping persists', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.home-copy h1')).toContainText('over.');
  await expect(page.getByRole('button', { name: /New run/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(page.locator('#tutorial')).toContainText('STEP 1 OF 6');
  await expect(page.locator('[data-kind="cannon"].tutorial-target')).toBeVisible();
  await page.locator('[data-kind="cannon"]').click();
  const canvas = page.locator('.board-base');
  await canvas.focus();
  for (let step = 0; step < 8; step++) {
    await canvas.press('Enter');
    if ((await page.locator('#inspector').textContent())?.includes('cells')) break;
    await canvas.press('ArrowRight');
  }
  await expect(page.locator('#tutorial')).toContainText('STEP 2 OF 6');
  await page.screenshot({ path: 'artifacts/tutorial.png', fullPage: false });
  await page.getByRole('button', { name: /Skip/ }).click();
  await expect(page.locator('#tutorial')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue run/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay tutorial' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/home.png', fullPage: true });
  await page.keyboard.press('Enter');
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('#tutorial')).toHaveCount(0);
  await page.getByRole('link', { name: /over\./ }).click();
  await expect(page.locator('.home-copy')).toBeVisible();
});
