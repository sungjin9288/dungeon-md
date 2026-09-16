// Run with Vite on :8083. Uses only a fresh browser save; writes QA artifacts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const baseURL = process.env.GAME_URL ?? 'http://127.0.0.1:8083';
const evidence = { generatedAt: new Date().toISOString(), sourceHashes: {}, viewports: [], modifiers: [], routes: [], lifecycle: [], errors: [] };
for (const file of ['src/scenes/EndlessResultScene.ts', 'src/data/waveTransactions.ts', 'src/combat/WaveLifecycle.ts', 'src/data/endlessModifiers.ts', 'scripts/verify-endless-result.mjs']) {
  evidence.sourceHashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
}
const standard = { wave: 35, kills: 723, goldEarned: 12500, crystalsEarned: 18, isNewRecord: true, previousBest: 25 };

async function fixture(viewport = { width: 390, height: 844 }, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion });
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') evidence.errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('dungeonGameState', JSON.stringify({ tutorialStage: 99, soulCrystals: 100, endlessHighScore: 15 }));
  });
  await page.goto(`${baseURL}/?skipTutorial=1`);
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
  await page.waitForTimeout(300);
  return { context, page };
}

async function start(page, result = standard, modifier = 'glass_cannon') {
  await page.evaluate(({ result, modifier }) => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    game.registry.set('endlessResult', result);
    game.registry.set('endlessModifier', modifier);
    game.scene.start('EndlessResultScene');
  }, { result, modifier });
  await page.waitForTimeout(300);
}

async function storage(page) { return page.evaluate(() => localStorage.getItem('dungeonGameState')); }

async function audit(page) {
  return page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('EndlessResultScene');
    const texts = scene.children.list.filter(o => o.type === 'Text' && o.visible)
      .map(o => ({ text: o.text, size: parseFloat(o.style.fontSize), ...o.getBounds() }));
    const targets = scene.children.list.filter(o => o.input?.enabled)
      .map(o => ({ name: o.name, ...o.getBounds() }));
    const overlaps = [];
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1
        && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) overlaps.push([a.text, b.text]);
    }
    return {
      texts, targets, overlaps,
      sub11: texts.filter(t => t.size < 11),
      overflow: texts.filter(t => t.x < -1 || t.y < -1 || t.x + t.width > 391 || t.y + t.height > 845),
      smallTargets: targets.filter(t => t.width < 44 || t.height < 44),
      children: scene.children.length, timers: scene.time._active.length,
      tweens: scene.tweens.getTweens().length,
      activeScenes: window.__phaserGame.scene.getScenes(true).map(s => s.scene.key),
      canvas: (() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
    };
  });
}

function check(result) {
  assert.deepEqual(result.overflow, [], 'text must fit logical canvas');
  assert.deepEqual(result.overlaps, [], 'text pairs must not overlap');
  assert.deepEqual(result.sub11, []);
  assert.deepEqual(result.smallTargets, []);
}

async function screenshot(page, name) {
  const relative = `tools/screenshots/endless-${name}.png`;
  await page.screenshot({ path: path.join(root, relative) });
  return { path: relative, sha256: createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex') };
}

async function press(page, names) {
  await page.evaluate(names => {
    const scene = window.__phaserGame.scene.getScene('EndlessResultScene');
    for (const name of names) scene.children.getByName(name).emit('pointerdown');
  }, names);
}

try {
  await mkdir(path.join(root, 'tools/screenshots'), { recursive: true });
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const { context, page } = await fixture(viewport);
    for (const [name, result] of Object.entries({
      record: standard,
      tied: { ...standard, wave: 25, isNewRecord: false },
      lower: { ...standard, wave: 15, isNewRecord: false },
      first: { ...standard, wave: 0, previousBest: 0, kills: 0, goldEarned: 0, crystalsEarned: 0, isNewRecord: false },
      high: { ...standard, kills: 999999999999, goldEarned: 999999999999, crystalsEarned: 999999999999 },
    })) {
      const before = await storage(page);
      await start(page, result);
      const resultAudit = await audit(page);
      check(resultAudit);
      assert.equal(await storage(page), before, 'result display must not save');
      evidence.viewports.push({ viewport, name, ...resultAudit, ...await screenshot(page, `${name}-${viewport.width}x${viewport.height}`) });
    }
    await context.close();
  }

  {
    const { context, page } = await fixture();
    const ids = await page.evaluate(async () => (await import('/src/data/endlessModifiers.ts')).ENDLESS_MODIFIERS.map(m => m.id));
    for (const id of ids) {
      await start(page, standard, id);
      const result = await audit(page);
      check(result);
      evidence.modifiers.push({ id, overflow: result.overflow, overlaps: result.overlaps });
    }
    await start(page);
    const initial = await storage(page);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__phaserGame.scene.getScene('EndlessResultScene').scene.restart());
      await page.waitForTimeout(260);
      const state = await audit(page);
      evidence.lifecycle.push({ children: state.children, targets: state.targets.length, timers: state.timers, tweens: state.tweens });
      assert.equal(await storage(page), initial);
    }
    assert.deepEqual(evidence.lifecycle[0], evidence.lifecycle[1]);
    assert.deepEqual(evidence.lifecycle[1], evidence.lifecycle[2]);
    await start(page, null);
    assert.equal(await page.evaluate(() => window.__phaserGame.scene.isActive('StageSelectScene')), true);
    evidence.missingResult = 'StageSelectScene';
    await context.close();
  }

  for (const reducedMotion of ['reduce', 'no-preference']) {
    for (const names of [['endless-retry', 'endless-return'], ['endless-return', 'endless-retry']]) {
      const { context, page } = await fixture(undefined, reducedMotion);
      await start(page);
      const before = JSON.parse(await storage(page));
      await page.evaluate(() => {
        const scene = window.__phaserGame.scene.getScene('EndlessResultScene');
        const original = scene.scene.start.bind(scene.scene);
        window.__endlessRoutes = [];
        scene.scene.start = (key, data) => { window.__endlessRoutes.push(key); return original(key, data); };
      });
      await press(page, [...names, names[0]]);
      await page.waitForTimeout(450);
      const expected = names[0] === 'endless-retry' ? 'DungeonScene' : 'StageSelectScene';
      const routes = await page.evaluate(() => window.__endlessRoutes);
      assert.deepEqual(routes, [expected]);
      const after = JSON.parse(await storage(page));
      assert.equal(after.soulCrystals, before.soulCrystals);
      assert.equal(after.endlessHighScore, before.endlessHighScore);
      const config = await page.evaluate(() => window.__phaserGame.registry.get('stageConfig'));
      if (expected === 'DungeonScene') assert.deepEqual(config, { stageNumber: 0, slots: 9, endless: true });
      evidence.routes.push({ reducedMotion, names, routes, rewardUnchanged: true });
      await context.close();
    }
  }

  {
    const { context, page } = await fixture();
    const before = JSON.parse(await storage(page));
    await page.evaluate(async () => {
      const { showEndlessResult } = await import('/src/combat/WaveLifecycle.ts');
      showEndlessResult(window.__phaserGame.scene.getScene('DungeonHomeScene'), 20, 1.5, 37, 200);
    });
    await page.waitForTimeout(300);
    const after = JSON.parse(await storage(page));
    const receipt = await page.evaluate(() => window.__phaserGame.registry.get('endlessResult'));
    assert.equal(after.soulCrystals - before.soulCrystals, receipt.crystalsEarned);
    assert.equal(after.endlessHighScore, 20);
    await page.evaluate(() => window.__phaserGame.scene.getScene('EndlessResultScene').scene.restart());
    await page.waitForTimeout(250);
    assert.deepEqual(JSON.parse(await storage(page)), after);
    evidence.upstream = { beforeCrystals: before.soulCrystals, afterCrystals: after.soulCrystals, receipt, redisplaySaveNeutral: true };
    await context.close();
  }
  assert.deepEqual(evidence.errors, []);
  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'FAIL';
  evidence.failure = String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(path.join(root, 'tools/endless-result-audit.json'), JSON.stringify(evidence, null, 2) + '\n');
}
console.log(JSON.stringify({ status: evidence.status, viewports: evidence.viewports.length,
  modifiers: evidence.modifiers.length, routes: evidence.routes, lifecycle: evidence.lifecycle,
  upstream: evidence.upstream, errors: evidence.errors, failure: evidence.failure }, null, 2));
