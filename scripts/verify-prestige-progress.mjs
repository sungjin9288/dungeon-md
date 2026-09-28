// Actual New Game+ confirmation and campaign reads in an isolated production browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inventory, labelClick, logicalClick } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.WEB_AUDIT_OUTPUT ?? `output/playwright/prestige-progress/${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/started.json`, '{}', { flag: 'wx' });
const audit = { checks: [], failures: [], errors: [], hashes: {}, captures: {}, scope: 'Seeded completed run, real New Game+ clicks, injected localStorage failures and campaign/reload checks. No actual user save or native changes.' };
const hash = data => createHash('sha256').update(data).digest('hex');
for (const file of ['src/data/wisdom.ts', 'src/data/prestigeTransactions.ts', 'src/ui/PrestigeModal.ts', 'src/ui/PrestigeModal.test.ts', 'src/ui/prestigePersistence.test.ts', 'scripts/verify-prestige-progress.mjs', 'dist/index.html']) audit.hashes[file] = hash(await readFile(file));
const check = (id, actual, expected) => { audit.checks.push({ id, actual, expected }); assert.deepEqual(actual, expected, id); };
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => audit.errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') audit.errors.push(message.text()); });
const snapshot = () => page.evaluate(() => ({ game: JSON.parse(localStorage.getItem('dungeonGameState')), campaign: JSON.parse(localStorage.getItem('dungeonStageProgress')) }));
const home = async () => { await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene')); await page.waitForTimeout(500); };
const capture = async name => { await page.screenshot({ path: `${output}/${name}.png` }); audit.captures[name] = { hash: hash(await readFile(`${output}/${name}.png`)), state: await inventory(page) }; };
try {
  await page.addInitScript(() => {
    if (!localStorage.getItem('dungeonGameState')) {
      const progress = Array.from({ length: 90 }, () => ({ unlocked: true, bestStars: 3, bestHpPercent: 90 }));
      localStorage.setItem('dungeonGameState', JSON.stringify({ gameCompleted: true, prestigeLevel: 2, dmLevel: 12, homeGold: 9000, soulCrystals: 777, gems: 42, tutorialStage: 99, lastIdleCollect: Date.now(), wisdomTree: { goldHands: 3 }, stageProgress: progress, endlessHighScore: 20 }));
      localStorage.setItem('dungeonStageProgress', JSON.stringify(progress));
    }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === window.__failStorageKey) throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto(process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8084', { waitUntil: 'networkidle' }); await home();
  const initial = await snapshot();
  await logicalClick(page, 266, 32); await capture('confirm');
  await labelClick(page, '취소');
  check('cancel preserves both stores', await snapshot(), initial);
  for (const key of ['dungeonStageProgress', 'dungeonGameState']) {
    await logicalClick(page, 266, 32);
    await page.evaluate(key => { window.__failStorageKey = key; }, key);
    await labelClick(page, '시작하기');
    await page.evaluate(() => { window.__failStorageKey = undefined; });
    check(`failed ${key} preserves both stores`, await snapshot(), initial);
    check(`failed ${key} stays on Home`, await page.evaluate(() => window.__phaserGame.scene.isActive('DungeonHomeScene')), true);
    if (key === 'dungeonGameState') await capture('failed-save');
  }
  await logicalClick(page, 266, 32); await labelClick(page, '시작하기'); await home();
  const restored = await snapshot();
  const fresh = Array.from({ length: 90 }, (_, index) => ({ unlocked: index === 0, bestStars: 0 }));
  check('prestige increments once and resets gold', [restored.game.prestigeLevel, restored.game.gameCompleted, restored.game.homeGold], [3, false, 200]);
  check('both stores reset together', [restored.game.stageProgress, restored.campaign], [fresh, fresh]);
  for (const key of ['dmLevel', 'soulCrystals', 'gems', 'ownedMonsters', 'wisdomTree', 'endlessHighScore']) check(`permanent ${key} retained`, restored.game[key], initial.game[key]);
  await capture('prestiged-home');
  await logicalClick(page, 341.25, 808);
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('StageSelectScene')); await page.waitForTimeout(400);
  check('StageSelect sees only first stage unlocked', await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelectScene').progress), fresh);
  await capture('reset-stages');
  await page.reload({ waitUntil: 'networkidle' }); await home();
  check('reset survives full reload', (await snapshot()).campaign, fresh);
  check('prestige survives full reload', (await snapshot()).game.prestigeLevel, 3);
  check('browser errors', audit.errors, []);
} catch (error) {
  audit.failures.push(String(error)); console.error(error); await capture('failure').catch(() => {});
} finally {
  await context.close(); await browser.close(); await writeFile(`${output}/audit.json`, `${JSON.stringify(audit, null, 2)}\n`);
}
console.log(`Prestige progress: ${audit.checks.length} checks, ${audit.failures.length} failures; ${output}`);
if (audit.failures.length) process.exitCode = 1;
