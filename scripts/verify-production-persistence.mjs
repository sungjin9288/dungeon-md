// Real production commands, fallible isolated storage, retry and reload.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inventory, labelClick, logicalClick, namedClick, namedCenter } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.WEB_AUDIT_OUTPUT ?? `output/playwright/production-persistence/${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/started.json`, '{}', { flag: 'wx' });
const audit = { checks: [], failures: [], errors: [], hashes: {}, captures: {}, scope: 'Isolated save; real Home/StageSelect/Production pointer route and commands. Storage faults and one-hour old-rate intervals before every production command injected; independent fixture-rate arithmetic verifies settlement and carry. Repeated ten-minute accrual fixtures injected. Fractional-output reload uses direct scene activation to resume. No user data/native access.' };
const hash = data => createHash('sha256').update(data).digest('hex');
for (const file of ['src/scenes/ProductionScene.ts', 'src/scenes/StageSelectScene.ts', 'src/scenes/productionPersistence.test.ts', 'src/data/productionTransactions.ts', 'src/data/productionSettlement.test.ts', 'src/data/idleIncome.ts', 'src/data/production.ts', 'src/data/wisdom.ts', 'src/data/idleRemainder.test.ts', 'scripts/verify-production-persistence.mjs', 'dist/index.html']) audit.hashes[file] = hash(await readFile(file));
const check = (id, actual, expected) => { audit.checks.push({ id, actual, expected }); assert.deepEqual(actual, expected, id); };
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: process.env.WEB_AUDIT_MOTION === '1' ? 'no-preference' : 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => audit.errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') audit.errors.push(message.text()); });
const snapshot = () => page.evaluate(() => {
  const scene = window.__phaserGame.scene.getScene('ProductionScene');
  return { saved: JSON.parse(localStorage.getItem('dungeonGameState')), live: JSON.parse(JSON.stringify(scene.gs)), writes: window.__writes ?? 0, receipt: scene.receipt };
});
const capture = async name => {
  await page.screenshot({ path: `${output}/${name}.png` });
  audit.captures[name] = { hash: hash(await readFile(`${output}/${name}.png`)), state: await inventory(page) };
};
async function doubleClick(name) {
  const center = await namedCenter(page, name), canvas = await page.locator('canvas').boundingBox();
  assert(center, `Missing ${name}`);
  const x = canvas.x + center.x * canvas.width / 390, y = canvas.y + center.y * canvas.height / 844;
  await page.mouse.click(x, y); await page.waitForTimeout(20); await page.mouse.click(x, y);
  await page.waitForTimeout(450);
}
// This fixture has no rooms, decorations or notoriety bonuses. Keep its oracle
// independent of the runtime helpers: treasury 100/h, mine 2/level/h, dokkaebi
// contributes x1.5 at the treasury and x1.2 at the mine.
function oldRatePayout(before, timestamp) {
  assert.equal(before.dungeonSlots.filter(s => s.roomType).length, 0);
  assert.equal((before.placedDecorations ?? []).length, 0);
  assert.equal(before.notorietyTier, 1);
  const hours = Math.min(timestamp - before.lastIdleCollect, 12 * 3600000) / 3600000;
  const goldRaw = 100 * (before.productionFacilities.treasury ?? 0) * (before.facilityStaff.treasury ? 1.5 : 1) * hours + (before.idleRemainder?.productionGold ?? 0);
  const oreRaw = 2 * (before.productionFacilities.mine ?? 0) * (before.facilityStaff.mine ? 1.2 : 1) * hours + (before.idleRemainder?.materials.common_ore ?? 0);
  const gold = Math.floor(goldRaw + 1e-9), ore = Math.floor(oreRaw + 1e-9);
  return { gold, ore, goldCarry: Math.max(0, goldRaw - gold), oreCarry: Math.max(0, oreRaw - ore) };
}
async function retry(id, prepare, name, expected, double = false) {
  await page.evaluate(() => {
    window.__count = false;
    const gs = JSON.parse(localStorage.getItem('dungeonGameState'));
    gs.lastIdleCollect = Date.now() - 3600000;
    localStorage.setItem('dungeonGameState', JSON.stringify(gs));
    window.__phaserGame.scene.getScene('ProductionScene').scene.restart();
  });
  await page.waitForTimeout(400);
  await prepare(); const before = await snapshot();
  await page.evaluate(() => { window.__reject = true; window.__count = true; });
  await namedClick(page, name);
  const failed = await snapshot();
  check(`${id}: failed save unchanged`, failed.saved, before.saved);
  check(`${id}: failed live state unchanged`, failed.live, before.live);
  check(`${id}: failed writes unchanged`, failed.writes, before.writes);
  check(`${id}: retry receipt`, failed.receipt, { text: '저장 실패 · 다시 시도해주세요', tone: 'warning' });
  await capture(`${id}-failed`);
  await page.evaluate(() => { window.__reject = false; });
  await prepare();
  if (double) await doubleClick(name); else await namedClick(page, name);
  const after = await snapshot();
  check(`${id}: exactly one successful write`, after.writes, before.writes + 1);
  check(`${id}: live state matches save`, after.live, after.saved);
  check(`${id}: success receipt`, after.receipt.tone, 'success');
  const paid = oldRatePayout(before.saved, after.saved.lastIdleCollect);
  check(`${id}: elapsed clock advanced`, after.saved.lastIdleCollect > before.saved.lastIdleCollect, true);
  check(`${id}: old-rate ore paid`, after.saved.materials.common_ore - before.saved.materials.common_ore, paid.ore);
  check(`${id}: fractional output preserved`, Math.abs(after.saved.idleRemainder.productionGold - paid.goldCarry) < 1e-8 && Math.abs((after.saved.idleRemainder.materials.common_ore ?? 0) - paid.oreCarry) < 1e-8, true);
  if (id !== 'collect') check(`${id}: automatic payout explained`, after.receipt.text.includes('적립분 수령'), true);
  expected(after.saved, before.saved, paid);
  await capture(`${id}-success`);
}
try {
  await page.addInitScript(() => {
    if (!localStorage.getItem('dungeonGameState')) localStorage.setItem('dungeonGameState', JSON.stringify({
      dmLevel: 12, homeGold: 5000, soulCrystals: 777, gems: 42, tutorialStage: 99,
      lastIdleCollect: Date.now(), dungeonSlots: [], productionFacilities: { treasury: 1 }, materials: { common_ore: 5 },
    }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dungeonGameState' && window.__reject) throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      const result = original.call(this, key, value);
      if (key === 'dungeonGameState' && window.__count) window.__writes = (window.__writes ?? 0) + 1;
      return result;
    };
  });
  await page.goto(process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8084', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
  await logicalClick(page, 341.25, 808);
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('StageSelectScene'));
  const canvas = await page.locator('canvas').boundingBox();
  // Eight real upward drags reach the production command below chapter nine.
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(canvas.x + 12 * canvas.width / 390, canvas.y + 740 * canvas.height / 844);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 12 * canvas.width / 390, canvas.y + 140 * canvas.height / 844, { steps: 12 });
    await page.mouse.up();
  }
  await page.waitForTimeout(200); await capture('production-entry');
  const entry = (await inventory(page)).scenes.flatMap(s => s.inputs).find(i => i.label === '🏭 생산');
  check('entire production button clears fixed navigation', Boolean(entry && entry.bounds.y >= 124 && entry.bounds.y + entry.bounds.height <= 780), true);
  await labelClick(page, '🏭 생산');
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('ProductionScene'));
  await retry('build', () => namedClick(page, 'production-facility-mine'), 'production-order', (s, b, paid) => check('mine build costs 150 after old-rate payout', [s.homeGold - b.homeGold - paid.gold, s.productionFacilities.mine], [-150, 1]), true);
  await retry('upgrade', () => namedClick(page, 'production-facility-mine'), 'production-order', (s, b, paid) => check('mine upgrade costs 270 after old-rate payout', [s.homeGold - b.homeGold - paid.gold, s.productionFacilities.mine], [-270, 2]), true);
  const staff = async id => { await namedClick(page, `production-facility-${id}`); await namedClick(page, 'production-staff'); };
  await retry('assign', () => staff('mine'), 'production-staff-dokkaebi_warrior', (s, b, paid) => { check('assigned once', s.facilityStaff, { mine: 'dokkaebi_warrior' }); check('assignment pays previous gold', s.homeGold - b.homeGold, paid.gold); });
  await retry('transfer', () => staff('treasury'), 'production-staff-dokkaebi_warrior', (s, b, paid) => { check('staff moved between facilities', s.facilityStaff, { treasury: 'dokkaebi_warrior' }); check('transfer pays previous gold', s.homeGold - b.homeGold, paid.gold); });
  await retry('clear', () => staff('treasury'), 'production-staff-clear', (s, b, paid) => { check('staff cleared', s.facilityStaff, {}); check('removal pays previous gold', s.homeGold - b.homeGold, paid.gold); });
  await retry('collect', async () => {}, 'production-collect', (s, b, paid) => check('collection pays gold and ore once', [s.homeGold - b.homeGold, s.materials.common_ore - b.materials.common_ore], [paid.gold, paid.ore]), true);
  await capture('complete'); const final = (await snapshot()).saved;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
  check('state survives reload', await page.evaluate(() => {
    const gs = JSON.parse(localStorage.getItem('dungeonGameState'));
    return [gs.homeGold, gs.materials, gs.productionFacilities, gs.facilityStaff, gs.lastIdleCollect, gs.soulCrystals, gs.gems];
  }), [final.homeGold, final.materials, final.productionFacilities, {}, final.lastIdleCollect, 777, 42]);

  // Six ten-minute claims must retain slower material production. The clock
  // fixture changes elapsed time only; each payout uses the real UI handler.
  await page.evaluate(() => {
    const gs = JSON.parse(localStorage.getItem('dungeonGameState'));
    gs.homeGold = 0; gs.materials = {}; delete gs.idleRemainder;
    gs.productionFacilities = { mine: 1, weavery: 1, treasury: 1 };
    localStorage.setItem('dungeonGameState', JSON.stringify(gs));
    window.__phaserGame.scene.getScene('DungeonHomeScene').scene.start('ProductionScene');
  });
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('ProductionScene'));
  for (let i = 1; i <= 6; i++) {
    await page.evaluate(() => {
      const gs = JSON.parse(localStorage.getItem('dungeonGameState'));
      gs.lastIdleCollect = Date.now() - 600000;
      localStorage.setItem('dungeonGameState', JSON.stringify(gs));
      window.__phaserGame.scene.getScene('ProductionScene').scene.restart();
    });
    await page.waitForTimeout(400); await namedClick(page, 'production-collect');
    const state = (await snapshot()).saved;
    check(`claim ${i}: cumulative gold`, state.homeGold, Math.floor(i * 100 / 6));
    check(`claim ${i}: cumulative ore and cloth`, [state.materials.common_ore ?? 0, state.materials.old_cloth ?? 0], [Math.floor(i / 3), Math.floor(i / 4)]);
    check(`claim ${i}: fractions remain bounded`, Object.values(state.idleRemainder.materials).every(v => v >= 0 && v < 1) && state.idleRemainder.productionGold >= 0 && state.idleRemainder.productionGold < 1, true);
    if (i === 2) {
      await capture('fraction-before-reload');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
      check('fraction survives full reload', await page.evaluate(() => JSON.parse(localStorage.getItem('dungeonGameState')).idleRemainder), state.idleRemainder);
      await page.evaluate(() => window.__phaserGame.scene.getScene('DungeonHomeScene').scene.start('ProductionScene'));
      await page.waitForFunction(() => window.__phaserGame.scene.isActive('ProductionScene'));
    }
  }
  await capture('fraction-complete');
  check('browser errors', audit.errors, []);
} catch (error) {
  audit.failures.push(String(error)); console.error(error); await capture('failure').catch(() => {});
} finally {
  await context.close(); await browser.close(); await writeFile(`${output}/audit.json`, `${JSON.stringify(audit, null, 2)}\n`);
}
console.log(`Production persistence: ${audit.checks.length} checks, ${audit.failures.length} failures; ${output}`);
if (audit.failures.length) process.exitCode = 1;
