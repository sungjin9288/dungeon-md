// Built-output integration smoke; never import Vite's /src modules in the browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inventory, labelClick, logicalClick, namedClick } from './lib/web-audit.mjs';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8084';
const output = process.env.WEB_AUDIT_OUTPUT ?? `output/playwright/production-smoke/${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/started.json`, JSON.stringify({ base, startedAt: new Date().toISOString() }), { flag: 'wx' });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const audit = {
  base, checks: [], failures: [], errors: [], requests: [], servedBundles: {}, captures: {},
  buildIndexHash: hash(await readFile('dist/index.html')),
  harnessHash: hash(await readFile('scripts/verify-production-smoke.mjs')),
  helperHash: hash(await readFile('scripts/lib/web-audit.mjs')),
  scope: 'Isolated DM8 save. Production root navigation, Wisdom purchase/reload and first Endless wave. Additional hubs use direct scene activation; no native/deployment or balance claim.',
};
const check = (id, actual, expected) => {
  audit.checks.push({ id, actual, expected });
  assert.deepEqual(actual, expected, id);
};
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage();
const pendingResponses = [];
page.on('console', message => { if (message.type() === 'error') audit.errors.push({ type: 'console', text: message.text() }); });
page.on('pageerror', error => audit.errors.push({ type: 'pageerror', text: String(error) }));
page.on('requestfailed', request => audit.errors.push({ type: 'requestfailed', url: request.url(), error: request.failure() }));
page.on('request', request => audit.requests.push(new URL(request.url()).pathname));
page.on('response', response => {
  if (response.status() >= 400) audit.errors.push({ type: 'http', status: response.status(), url: response.url() });
  const path = new URL(response.url()).pathname;
  if (/^\/assets\/[^/]+\.(js|css)$/.test(path)) {
    pendingResponses.push((async () => {
      const actual = hash(await response.body());
      const expected = hash(await readFile(`dist${path}`));
      check(`served build ${path}`, actual, expected);
      audit.servedBundles[path] = actual;
    })().catch(error => { audit.failures.push(String(error)); }));
  }
});
const waitScene = async key => {
  await page.waitForFunction(key => {
    const game = window.__phaserGame;
    return game?.scene.isActive(key) && game.scene.getScene(key).children.list.length > 0;
  }, key);
  await page.waitForTimeout(400);
};
const capture = async name => {
  await page.screenshot({ path: `${output}/${name}.png` });
  audit.captures[name] = { hash: hash(await readFile(`${output}/${name}.png`)), snapshot: await inventory(page) };
};
const activate = async key => {
  await page.evaluate(key => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    game.scene.start(key);
  }, key);
  await waitScene(key);
};
const savedPurchase = () => page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('dungeonGameState'));
  return { tier: state.wisdomTree.ancestorsWisdom, crystals: state.soulCrystals };
});
try {
  await page.addInitScript(() => {
    // Seed exactly once so a browser reload exercises the application's real save.
    if (localStorage.getItem('dungeonGameState') === null) {
      localStorage.setItem('dungeonGameState', JSON.stringify({ tutorialStage: 99, lastIdleCollect: Date.now(), dmLevel: 8, soulCrystals: 145, wisdomTree: { ancestorsWisdom: 0 } }));
      localStorage.setItem('dungeonStageProgress', JSON.stringify(Array.from({ length: 90 }, (_, index) => ({ unlocked: index <= 10, bestStars: index < 10 ? 3 : 0 }))));
    }
  });
  await page.goto(`${base}/?scene=ForgeScene&skipTutorial=1`, { waitUntil: 'networkidle' });
  await waitScene('DungeonHomeScene');
  check('development scene shortcut excluded', await page.evaluate(() => window.__phaserGame.scene.isActive('ForgeScene')), false);
  await capture('home');
  check('WebGL renderer', audit.captures.home.snapshot.renderer, 2);
  check('logical mobile frame', audit.captures.home.snapshot.logical, { width: 390, height: 844 });
  for (const [key, x] of [['BarracksScene', 146.25], ['ForgeScene', 243.75], ['StageSelectScene', 341.25], ['DungeonHomeScene', 48.75]]) {
    await logicalClick(page, x, 808);
    await waitScene(key);
    check(`root navigation ${key}`, (await inventory(page)).activeScenes, [key]);
  }
  for (const key of ['SummonScene', 'ShopScene', 'FusionScene', 'CodexScene', 'AchievementScene', 'AbyssScene', 'ProductionScene', 'DecorationScene', 'AncestralWisdomScene']) {
    await activate(key);
    const state = await inventory(page);
    check(`hub renders ${key}`, state.scenes.some(scene => scene.scene === key && scene.visibleTextCount > 0 && scene.visibleInputCount > 0), true);
    await capture(key);
  }
  await namedClick(page, 'wisdom-lineage-conquest');
  await namedClick(page, 'wisdom-branch-ancestorsWisdom');
  await namedClick(page, 'wisdom-upgrade');
  await capture('wisdom-confirm');
  await namedClick(page, 'wisdom-confirm');
  check('Wisdom purchase persisted', await savedPurchase(), { tier: 1, crystals: 140 });
  await capture('wisdom-purchased');
  await page.reload({ waitUntil: 'networkidle' });
  await waitScene('DungeonHomeScene');
  check('purchase survives full reload', await savedPurchase(), { tier: 1, crystals: 140 });
  await logicalClick(page, 341.25, 808);
  await waitScene('StageSelectScene');
  await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelectScene').cameras.main.centerOn(195, 4546));
  await page.waitForTimeout(200);
  await capture('stage-endless-entry');
  await labelClick(page, '무한 던전');
  await waitScene('DungeonScene');
  await waitScene('UIScene');
  check('purchased bonus reaches combat', await page.evaluate(() => window.__phaserGame.scene.getScene('DungeonScene').wisdomBonuses.dungeonMaxHpBonus), 20);
  await labelClick(page, '침입 방어 개시');
  await labelClick(page, '침입 방어 개시');
  await page.evaluate(() => window.advanceTime(1500));
  audit.combat = await page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('DungeonScene');
    return { endless: scene.isEndless, wave: scene.wave, hasSpawned: scene.waveHasSpawned, activeInvaders: scene.activeInvaders.length, maxHp: scene.maxHp, state: JSON.parse(window.render_game_to_text()) };
  });
  check('Endless mode entered through stage button', audit.combat.endless, true);
  check('core includes purchased overflow HP', audit.combat.maxHp, 1520);
  check('first wave started', audit.combat.wave, 1);
  check('actual invaders spawned', audit.combat.hasSpawned && audit.combat.activeInvaders > 0, true);
  await capture('combat');
  check('purchase unchanged during entry', await savedPurchase(), { tier: 1, crystals: 140 });
  await Promise.all(pendingResponses);
  check('built bundles actually loaded', Object.keys(audit.servedBundles).length > 0, true);
  check('no development module requests', audit.requests.filter(path => /^\/(src\/|@vite\/|@id\/)/.test(path)), []);
  check('browser/network errors', audit.errors, []);
} catch (error) {
  audit.failures.push(String(error));
  console.error(error);
  await capture('failure').catch(() => {});
} finally {
  await Promise.all(pendingResponses);
  await context.close();
  await browser.close();
  await writeFile(`${output}/audit.json`, `${JSON.stringify(audit, null, 2)}\n`);
}
console.log(`Production smoke: ${audit.checks.length} checks, ${audit.failures.length} failures; ${output}`);
if (audit.failures.length) process.exitCode = 1;
