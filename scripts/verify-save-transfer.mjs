// Production settings UI with an isolated clipboard; never replaces the OS clipboard.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inventory, labelClick, logicalClick } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8084';
const output = process.env.WEB_AUDIT_OUTPUT ?? `output/playwright/save-transfer/${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/started.json`, JSON.stringify({ base }), { flag: 'wx' });
const audit = { checks: [], failures: [], errors: [], hashes: {}, captures: {}, scope: 'Production settings clicks with mocked clipboard and isolated synthetic saves; no OS clipboard, user save or native changes.' };
const hash = data => createHash('sha256').update(data).digest('hex');
for (const file of ['src/data/wisdom.ts', 'src/data/stageProgress.ts', 'src/data/saveTransfer.test.ts', 'src/ui/ImportExportModal.ts', 'src/ui/ImportExportModal.test.ts', 'scripts/verify-save-transfer.mjs', 'dist/index.html']) audit.hashes[file] = hash(await readFile(file));
const check = (id, actual, expected) => { audit.checks.push({ id, actual, expected }); assert.deepEqual(actual, expected, id); };
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => audit.errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') audit.errors.push(message.text()); });
const snapshot = () => page.evaluate(() => ({ game: JSON.parse(localStorage.getItem('dungeonGameState')), campaign: JSON.parse(localStorage.getItem('dungeonStageProgress')) }));
const home = async () => {
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
  await page.waitForTimeout(500);
};
const capture = async name => {
  await page.screenshot({ path: `${output}/${name}.png` });
  audit.captures[name] = { hash: hash(await readFile(`${output}/${name}.png`)), state: await inventory(page) };
};
const openImport = async code => {
  await page.evaluate(code => { window.__testClipboard = code; }, code);
  await logicalClick(page, 246, 31);
  await labelClick(page, '세이브 가져오기');
};
try {
  await page.addInitScript(() => {
    window.__testClipboard = '';
    window.__deferClipboard = false;
    window.__clipboardRequests = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async code => { window.__testClipboard = code; },
      readText: async () => window.__deferClipboard
        ? new Promise((resolve, reject) => window.__clipboardRequests.push({ resolve, reject }))
        : window.__testClipboard,
    } });
    if (localStorage.getItem('dungeonGameState') === null) {
      const campaign = Array.from({ length: 90 }, (_, index) => ({ unlocked: index <= 10, bestStars: index < 10 ? 3 : 0, ...(index < 10 ? { bestHpPercent: 87 } : {}) }));
      localStorage.setItem('dungeonGameState', JSON.stringify({ dmLevel: 8, homeGold: 12345, soulCrystals: 145, tutorialStage: 99, lastIdleCollect: Date.now(), stageProgress: campaign }));
      localStorage.setItem('dungeonStageProgress', JSON.stringify(campaign));
    }
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await home();
  await logicalClick(page, 246, 31);
  await labelClick(page, '세이브 내보내기');
  const code = await page.evaluate(() => window.__testClipboard);
  const backup = JSON.parse(Buffer.from(code, 'base64').toString('utf8'));
  check('versioned backup through settings', [backup.format, backup.version], ['dungeon-guardian-save', 1]);
  check('campaign stars and HP included', backup.campaignProgress[9], { unlocked: true, bestStars: 3, bestHpPercent: 87 });
  await capture('exported');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('dungeonGameState'));
    state.homeGold = 700; state.dmLevel = 2; state.soulCrystals = 4;
    state.stageProgress = Array.from({ length: 90 }, (_, index) => ({ unlocked: true, bestStars: index === 89 ? 3 : 0 }));
    localStorage.setItem('dungeonGameState', JSON.stringify(state));
    localStorage.setItem('dungeonStageProgress', JSON.stringify(state.stageProgress));
  });
  await page.reload({ waitUntil: 'networkidle' }); await home();
  const destination = await snapshot();
  await openImport(code);
  await labelClick(page, '취소');
  check('cancel leaves both saves untouched', await snapshot(), destination);
  await labelClick(page, '닫기');
  await openImport(code);
  await capture('confirm');
  await labelClick(page, '확인');
  await page.waitForTimeout(1000); await home();
  const restored = await snapshot();
  check('resources restored through confirmation', [restored.game.dmLevel, restored.game.homeGold, restored.game.soulCrystals], [8, 12345, 145]);
  check('campaign fully replaced', restored.campaign, backup.campaignProgress);
  await logicalClick(page, 341.25, 808);
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('StageSelectScene'));
  await page.waitForTimeout(400);
  check('stage selector reads restored progress', await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelectScene').progress), backup.campaignProgress);
  await capture('stage-restored');
  await page.reload({ waitUntil: 'networkidle' }); await home();
  check('campaign survives full reload', (await snapshot()).campaign, backup.campaignProgress);
  const beforeInvalid = await snapshot();
  await openImport('invalid-save-code');
  await labelClick(page, '확인');
  check('invalid code preserves both saves', await snapshot(), beforeInvalid);
  await capture('invalid-rejected');

  const replacement = structuredClone(backup);
  replacement.gameState.homeGold = 54321;
  const replacementCode = Buffer.from(JSON.stringify(replacement)).toString('base64');
  for (const way of ['cancel', 'backdrop', 'parent', 'shutdown', 'late-rejection']) {
    // Start each race from a loaded Home. No reseeding on reload.
    await page.reload({ waitUntil: 'networkidle' }); await home();
    const before = await snapshot();
    const listeners = await page.evaluate(() => window.__phaserGame.scene.getScene('DungeonHomeScene').events.listenerCount('shutdown'));
    await page.evaluate(() => { window.__deferClipboard = true; });
    await openImport(replacementCode);
    await labelClick(page, '확인');
    check(`${way} pending clipboard request`, await page.evaluate(() => window.__clipboardRequests.length), 1);
    if (way === 'cancel') await capture('pending-cancel-available');
    if (way === 'cancel' || way === 'late-rejection') await labelClick(page, '취소');
    if (way === 'backdrop') await logicalClick(page, 10, 100);
    if (way === 'parent') await page.evaluate(() => window.__phaserGame.scene.getScene('DungeonHomeScene').children.list.find(object => object.type === 'Container' && object.depth === 50).destroy(true));
    if (way === 'shutdown') {
      await page.evaluate(() => window.__phaserGame.scene.getScene('DungeonHomeScene').scene.start('BarracksScene'));
      await page.waitForFunction(() => window.__phaserGame.scene.isActive('BarracksScene'));
    }
    await page.evaluate(({ way, code }) => {
      const request = window.__clipboardRequests[0];
      if (way === 'late-rejection') request.reject(new Error('Delayed denial'));
      else request.resolve(code);
    }, { way, code: replacementCode });
    await page.waitForTimeout(1100);
    check(`${way} prevents stale save overwrite`, await snapshot(), before);
    if (way === 'shutdown') check('late result does not return from Barracks', await page.evaluate(() => window.__phaserGame.scene.isActive('BarracksScene')), true);
    else check(`${way} releases shutdown listener`, await page.evaluate(() => window.__phaserGame.scene.getScene('DungeonHomeScene').events.listenerCount('shutdown')), listeners);
  }
  await page.reload({ waitUntil: 'networkidle' }); await home();
  await page.evaluate(() => { window.__deferClipboard = true; });
  await openImport(replacementCode);
  const button = (await inventory(page)).scenes.flatMap(scene => scene.inputs).find(input => input.text === '확인');
  assert.ok(button, 'confirm input');
  const x = button.bounds.x + button.bounds.width / 2, y = button.bounds.y + button.bounds.height / 2;
  await logicalClick(page, x, y); await logicalClick(page, x, y);
  check('repeated confirm starts only one clipboard read', await page.evaluate(() => window.__clipboardRequests.length), 1);
  await page.evaluate(code => window.__clipboardRequests[0].resolve(code), replacementCode);
  await page.waitForTimeout(1100); await home();
  check('single pending request imports successfully', (await snapshot()).game.homeGold, 54321);
  await capture('deferred-import-restored');
  check('browser errors', audit.errors, []);
} catch (error) {
  audit.failures.push(String(error)); console.error(error);
  await capture('failure').catch(() => {});
} finally {
  await context.close(); await browser.close();
  await writeFile(`${output}/audit.json`, `${JSON.stringify(audit, null, 2)}\n`);
}
console.log(`Save transfer: ${audit.checks.length} checks, ${audit.failures.length} failures; ${output}`);
if (audit.failures.length) process.exitCode = 1;
