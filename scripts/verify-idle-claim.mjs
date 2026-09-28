// Exercise the real Home idle-reward button with isolated, fallible storage.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inventory, labelClick, logicalClick } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.WEB_AUDIT_OUTPUT ?? `output/playwright/idle-claim/${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/started.json`, '{}', { flag: 'wx' });
const audit = { checks: [], failures: [], errors: [], hashes: {}, captures: {}, scope: 'Isolated post-prestige fixture with retained facilities; actual claim clicks and synthetic storage failure. No user save or native access.' };
const hash = data => createHash('sha256').update(data).digest('hex');
for (const file of ['src/scenes/HomeLifecycle.ts', 'src/scenes/DungeonHomeScene.ts', 'src/data/idleIncome.ts', 'scripts/verify-idle-claim.mjs', 'dist/index.html']) audit.hashes[file] = hash(await readFile(file));
const check = (id, actual, expected) => {
  audit.checks.push({ id, actual, expected });
  try { assert.deepEqual(actual, expected, id); } catch (error) { audit.failures.push(String(error)); }
};
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: process.env.WEB_AUDIT_MOTION === '1' ? 'no-preference' : 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => audit.errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') audit.errors.push(message.text()); });
const snapshot = () => page.evaluate(() => {
  const scene = window.__phaserGame.scene.getScene('DungeonHomeScene');
  const hasPanel = list => list.some(o => o.text === '방치 수익 회수' || (Array.isArray(o.list) && hasPanel(o.list)));
  return { saved: JSON.parse(localStorage.getItem('dungeonGameState')), live: JSON.parse(JSON.stringify(scene.gs)), writes: window.__claimWrites ?? 0, panel: hasPanel(scene.children.list) };
});
const capture = async name => {
  await page.screenshot({ path: `${output}/${name}.png` });
  audit.captures[name] = { hash: hash(await readFile(`${output}/${name}.png`)), state: await inventory(page) };
};
const home = async () => {
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
  await page.waitForTimeout(1000);
};
try {
  await page.addInitScript(() => {
    const now = Date.now();
    if (!localStorage.getItem('dungeonGameState')) localStorage.setItem('dungeonGameState', JSON.stringify({
      prestigeLevel: 3, gameCompleted: false, dmLevel: 12, homeGold: 200,
      soulCrystals: 777, gems: 42, tutorialStage: 99, lastIdleCollect: now - 3600000,
      dungeonSlots: [], productionFacilities: { mine: 1, treasury: 1 }, materials: { common_ore: 5 },
    }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dungeonGameState' && window.__rejectClaim) throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      const result = original.call(this, key, value);
      if (key === 'dungeonGameState' && window.__countClaims) window.__claimWrites = (window.__claimWrites ?? 0) + 1;
      return result;
    };
  });
  await page.goto(process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8084', { waitUntil: 'networkidle' }); await home();
  await capture('available');
  const initial = await snapshot();
  check('idle panel opens for retained facilities', initial.panel, true);
  await page.evaluate(() => { window.__rejectClaim = true; window.__countClaims = true; });
  await labelClick(page, '수령');
  const failed = await snapshot();
  check('failed claim preserves persisted save', failed.saved, initial.saved);
  check('failed claim preserves live state', failed.live, initial.live);
  check('failed claim writes nothing', failed.writes, 0);
  await capture('failed-save');
  check('failure message visible above modal', await page.evaluate(() => window.__phaserGame.scene.getScene('DungeonHomeScene').children.list.some(o => o.text === '수령 저장 실패. 다시 시도해주세요.' && o.depth > 900)), true);
  await page.evaluate(() => { window.__rejectClaim = false; });
  await labelClick(page, '수령');
  const claimed = await snapshot();
  check('retry saves exactly once', claimed.writes, 1);
  check('retry grants facility gold and materials once', [claimed.saved.homeGold - initial.saved.homeGold, claimed.saved.materials.common_ore - initial.saved.materials.common_ore], [100, 2]);
  check('live state matches saved state', claimed.live, claimed.saved);
  check('claim clock advanced', claimed.saved.lastIdleCollect > initial.saved.lastIdleCollect, true);
  check('modal removed after success', claimed.panel, false);
  await capture('claimed');
  // Repeated clicks at the old claim coordinate must not grant or save again.
  await logicalClick(page, 195, 514); await logicalClick(page, 195, 514);
  check('repeated clicks do not duplicate payout', await snapshot(), claimed);
  await page.reload({ waitUntil: 'networkidle' }); await home();
  const reloaded = await snapshot();
  check('claim survives reload', [reloaded.saved.homeGold, reloaded.saved.materials, reloaded.saved.lastIdleCollect], [claimed.saved.homeGold, claimed.saved.materials, claimed.saved.lastIdleCollect]);
  check('prestige and collection currency retained', [reloaded.saved.prestigeLevel, reloaded.saved.soulCrystals, reloaded.saved.gems], [3, 777, 42]);
  check('browser errors', audit.errors, []);
} catch (error) {
  audit.failures.push(String(error)); console.error(error); await capture('failure').catch(() => {});
} finally {
  await context.close(); await browser.close(); await writeFile(`${output}/audit.json`, `${JSON.stringify(audit, null, 2)}\n`);
}
console.log(`Idle claim: ${audit.checks.length} checks, ${audit.failures.length} failures; ${output}`);
if (audit.failures.length) process.exitCode = 1;
