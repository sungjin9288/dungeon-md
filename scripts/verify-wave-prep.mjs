// Isolated completed-wave fixture, then actual result-button input and Phaser timers.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener, labelClick } from './lib/web-audit.mjs';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.WAVE_PREP_OUTPUT ?? 'output/playwright/wave-prep/after';
await mkdir(output, { recursive: true });
const audit = { scope: 'Synthetic cleared waves; actual result CTAs and scene restart. Immediate-start regression uses advanceTime; remaining timer cases advance the real Phaser scene clock directly. Not an endurance run.', checks: [], failures: [], sourceHashes: {} };
const check = (id, actual, expected) => {
  audit.checks.push({ id, actual, expected });
  try { assert.deepEqual(actual, expected, id); } catch (error) { audit.failures.push(String(error)); }
};
for (const file of ['src/combat/WaveLifecycle.ts', 'src/combat/WaveStart.ts', 'src/combat/ResultPanel.ts', 'src/scenes/DungeonScene.ts', 'scripts/verify-wave-prep.mjs']) {
  audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const browser = await chromium.launch({ headless: true });
try {
  const open = createSceneOpener({ browser, base: process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083' });
  const { page, context, errors } = await open('DungeonHomeScene', { width: 390, height: 844 });
  try {
    await page.evaluate(() => {
      const game = window.__phaserGame;
      game.scene.stop('DungeonHomeScene');
      game.registry.set('stageConfig', { endless: true, stageNumber: 0 });
      game.scene.start('DungeonScene');
    });
    await page.waitForFunction(() => window.__phaserGame.scene.getScene('DungeonScene').roomGrid.length > 0);
    await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      ds.setSpeed(1);
      ds.wave = 1;
      ds.waveHasSpawned = true;
      ds.showWaveClear();
      // Include a visible countdown status before the player skips preparation.
      ds.time.preUpdate();
      ds.time.update(ds.time.now + 1001, 1001);
      // Record late writes instead of sampling a flag that another spawn can restore.
      let spawned = ds.waveHasSpawned;
      window.__lateSpawnResets = [];
      Object.defineProperty(ds, 'waveHasSpawned', {
        configurable: true, get: () => spawned,
        set: value => {
          if (!value && ds.waveActive && ds.wave === 2) window.__lateSpawnResets.push(ds.time.now);
          spawned = value;
        },
      });
    });
    await page.screenshot({ path: `${output}/clear.png` });
    await labelClick(page, '다음 침입 즉시 시작');
    const before = await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      window.__lateSpawnResets = []; // startWave's intentional reset precedes this point.
      return { wave: ds.wave, active: ds.waveActive, prep: ds.prepActive };
    });
    await page.evaluate(() => window.advanceTime(1500));
    const after = await page.evaluate(() => ({
      lateResets: window.__lateSpawnResets,
      state: JSON.parse(window.render_game_to_text()),
      prepTimer: window.__phaserGame.scene.getScene('DungeonScene').prepTimer,
      status: window.__phaserGame.registry.get('status'),
    }));
    await page.screenshot({ path: `${output}/next-wave.png` });
    await writeFile(`${output}/state.json`, JSON.stringify({ before, after }, null, 2));
    for (const [id, actual, expected] of [
      ['result CTA starts wave 2', before.wave, 2],
      ['result CTA starts combat', before.active, true],
      ['result CTA exits prep', before.prep, false],
      ['old countdown never resets new wave spawn flag', after.lateResets.length, 0],
      ['cancelled countdown cannot go negative', after.prepTimer >= 0, true],
      ['old countdown status is cleared', after.status, ''],
    ]) {
      check(id, actual, expected);
    }

    const cleared = await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      // Synthetic empty battlefield: test end detection, not combat/balance.
      ds.activeInvaders.forEach(invader => invader.destroy());
      ds.activeInvaders = [];
      ds.spawnQueue = [];
      ds.checkWaveEnd();
      ds.time.preUpdate();
      ds.time.update(ds.time.now + 801, 801);
      return { active: ds.waveActive, prep: ds.prepActive, result: Boolean(ds.resultOverlay) };
    });
    check('empty second wave settles without forced waveActive override', cleared, { active: false, prep: true, result: true });

    await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      Object.defineProperty(ds, 'waveHasSpawned', { configurable: true, writable: true, value: ds.waveHasSpawned });
      ds.scene.restart();
    });
    await page.waitForFunction(() => window.__phaserGame.scene.getScene('DungeonScene').wave === 0);
    const liveBar = await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      ds.wave = 1;
      ds.showWaveClear();
      return ds.countdownBar?.scene === ds;
    });
    check('restart creates a live countdown bar', liveBar, true);
    await labelClick(page, '방어선 확인');
    const inspected = await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      ds.waveHasSpawned = true; // sentinel owned by a later battle
      ds.time.preUpdate();
      ds.time.update(ds.time.now + 1200, 1200);
      return { spawned: ds.waveHasSpawned, prep: ds.prepActive, timer: ds.prepTimer };
    });
    check('inspection cancels timer without a late flag reset', inspected, { spawned: true, prep: false, timer: 0 });
    const natural = await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      ds.showWaveClear();
      for (let i = 0; i < 10; i++) {
        ds.time.preUpdate();
        ds.time.update(ds.time.now + 1001, 1001);
      }
      return {
        prep: ds.prepActive, timer: ds.prepTimer, label: ds.waveLabel.text,
        cleanupListeners: ds.events.listeners('shutdown').filter(fn => fn.name === 'cleanup').length,
      };
    });
    check('normal countdown enables invasion button', natural, { prep: false, timer: 0, label: '침입 방어 개시', cleanupListeners: 0 });
    await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      ds.showWaveClear(); // restart while a countdown is still pending
      ds.scene.restart();
    });
    await page.waitForFunction(() => window.__phaserGame.scene.getScene('DungeonScene').wave === 0);
    const restarted = await page.evaluate(() => {
      const ds = window.__phaserGame.scene.getScene('DungeonScene');
      ds.time.preUpdate();
      ds.time.update(ds.time.now + 1200, 1200);
      return {
        prep: ds.prepActive, timer: ds.prepTimer, wave: ds.wave,
        cleanupListeners: ds.events.listeners('shutdown').filter(fn => fn.name === 'cleanup').length,
      };
    });
    check('active-prep restart releases old timer and listener', restarted, { prep: false, timer: 0, wave: 0, cleanupListeners: 0 });
    check('no browser errors', errors, []);
  } finally { await context.close(); }
} catch (error) { audit.failures.push(String(error)); }
finally {
  await browser.close();
  await writeFile(`${output}/audit.json`, JSON.stringify(audit, null, 2) + '\n');
}
console.log(JSON.stringify(audit));
if (audit.failures.length) process.exitCode = 1;
