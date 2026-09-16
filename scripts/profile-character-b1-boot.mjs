// Diagnostic only: response-local ablation; never rewrites runtime or old evidence.
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadavg, platform, arch } from 'node:os';
import assert from 'node:assert/strict';
import { chromium } from '/Users/sungjin/.codex/node_modules/playwright/index.mjs';

const base = 'http://127.0.0.1:8083';
const output = process.argv[2];
assert.match(output ?? '', /^tools\/character-b1-boot-profile-[a-z0-9-]+\.json$/);
const screenshotPath = output.replace('tools/', 'tools/screenshots/').replace('.json', '.png');
for (const path of [output, screenshotPath]) {
  try {
    await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  throw new Error(`Refusing to overwrite profile evidence: ${path}`);
}
const ids = ['village_archer', 'dokkaebi_junior', 'gold_turtle', 'fire_dokkaebi', 'sage'];
const sourcePaths = Object.keys(JSON.parse(await readFile('tools/character-b1-audit.json')).sourceHashes);
sourcePaths.push('scripts/profile-character-b1-boot.mjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, sha(await readFile(path))])));
function once(text, from, to) {
  assert.equal(text.split(from).length, 2, `instrumentation anchor cardinality: ${from}`);
  return text.replace(from, to);
}
const report = {
  date: new Date().toISOString(), sourceHashes: hashes, platform: platform(), arch: arch(),
  scope: 'Alternating response-only four-art/48px ablation versus current nine-art/96px; not a complete historical checkout or device benchmark.',
  conditions: { viewport: [390, 844], dpr: 2, reducedMotion: 'reduce', headed: true,
    cache: 'fresh context, Playwright routing disables HTTP cache in both arms',
    warmup: 'first pair retained and labelled warmup, never discarded from evidence' },
  samples: [], failures: [],
};
const browser = await chromium.launch({ headless: false });
report.browser = browser.version();
try {
  for (const [index, arm] of ['current', 'four-art-48', 'four-art-48', 'current', 'current', 'four-art-48', 'four-art-48', 'current'].entries()) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    const routed = [];
    await page.route(/\/src\/(scenes\/BootScene|data\/characterArt|art\/PortraitGenerator)\.ts(?:\?.*)?$/, async route => {
      try {
      const response = await route.fetch();
      let body = await response.text();
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/BootScene.ts')) {
        body = once(body, 'preload() {', `preload() {
          performance.mark('b1-preload');
          this.load.once('start', () => performance.mark('b1-loader-start'));
          this.load.once('complete', () => performance.mark('b1-loader-complete'));`);
        body = once(body, 'this.generateTextures();', "performance.mark('b1-create'); this.generateTextures(); performance.mark('b1-invaders-done');");
        body = once(body, 'this.generateMonsterTextures();', "this.generateMonsterTextures(); performance.mark('b1-monsters-done');");
      }
      if (arm === 'four-art-48' && pathname.endsWith('/characterArt.ts')) {
        for (const id of ids) {
          const pattern = new RegExp(`  ${id}: Object\\.freeze\\(\\{[\\s\\S]*?\\}\\),?`, 'g');
          assert.equal([...body.matchAll(pattern)].length, 1, `exact art record ${id}`);
          body = body.replace(pattern, '');
        }
      }
      if (arm === 'four-art-48' && pathname.endsWith('/PortraitGenerator.ts')) {
        body = once(body, 'const density = 96;', 'const density = 48;');
      }
      routed.push({ pathname, responseHash: sha(body) });
      await route.fulfill({ response, body });
      } catch (error) {
        errors.push(`response instrumentation: ${error}`);
        await route.abort();
      }
    });
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(4096);
      window.__bootResourceBufferFull = false;
      performance.addEventListener('resourcetimingbufferfull', () => { window.__bootResourceBufferFull = true; });
      localStorage.setItem('dungeonGameState', JSON.stringify({ tutorialStage: 99, dmLevel: 1,
        lastIdleCollect: Date.now(), homeGold: 200, activeMainQuestId: 'MQ-008',
        questProgress: { 'MQ-008': { completed: false, objectives: { O1: 0 } } },
        ownedMonsters: [{ id: 'dokkaebi_warrior', level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null }],
        dungeonSlots: [{ roomType: 'combat', monsterIds: ['dokkaebi_warrior'], trapIds: [], roomLevel: 1, hp: 100, maxHp: 100 }],
      }));
      window.__bootLongTasks = [];
      new PerformanceObserver(list => window.__bootLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))))
        .observe({ type: 'longtask', buffered: true });
      let game;
      Object.defineProperty(window, '__phaserGame', {
        configurable: true, get: () => game, set: value => {
          game = value;
          const observe = () => {
            if (!game.scene.isActive('DungeonHomeScene')) return;
            performance.mark('b1-home-frame');
            game.events.off('postrender', observe);
          };
          game.events.on('postrender', observe);
        },
      });
    });
    const started = performance.now();
    const hostLoad = loadavg();
    try {
      await page.goto(`${base}/?skipTutorial=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => performance.getEntriesByName('b1-home-frame').length > 0);
      const observedMs = performance.now() - started;
      const metrics = await page.evaluate(() => {
        const game = window.__phaserGame;
        const marks = Object.fromEntries(performance.getEntriesByType('mark').filter(e => e.name.startsWith('b1-')).map(e => [e.name, e.startTime]));
        const resources = performance.getEntriesByType('resource').map(e => ({
          path: new URL(e.name).pathname, start: e.startTime, end: e.responseEnd,
          duration: e.duration, transfer: e.transferSize, decoded: e.decodedBodySize,
        }));
        const sprite = game.textures.get('sprite-ritual-v2-dokkaebi_warrior').getSourceImage();
        return { marks, domContentLoaded: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
          resources, resourceBufferFull: window.__bootResourceBufferFull, longTasks: window.__bootLongTasks,
          ritualSources: Object.keys(game.textures.list).filter(k => k.startsWith('monster-ritual-v2-')),
          sprite: [sprite.width, sprite.height], renderer: game.renderer.gl.getParameter(game.renderer.gl.VERSION),
          state: JSON.parse(window.render_game_to_text()),
        };
      });
      assert.equal(new URL(page.url()).origin, base);
      assert.equal(metrics.ritualSources.length, arm === 'current' ? 9 : 4);
      assert.equal(metrics.resourceBufferFull, false, 'resource timing buffer overflow');
      assert.equal(metrics.resources.filter(r => /^\/assets\/monsters\/[^/]+\.jpg$/.test(r.path)).length, 136);
      assert.equal(metrics.resources.filter(r => r.path.startsWith('/assets/monsters/ritual-v2/')).length, arm === 'current' ? 9 : 4);
      assert.deepEqual(metrics.sprite, arm === 'current' ? [96, 96] : [48, 48]);
      for (const name of ['b1-preload', 'b1-loader-start', 'b1-loader-complete', 'b1-create', 'b1-invaders-done', 'b1-monsters-done', 'b1-home-frame']) assert.ok(Number.isFinite(metrics.marks[name]), name);
      assert.equal(errors.length, 0, errors.join('\n'));
      report.samples.push({ index, arm, warmup: index < 2, hostLoad, observedMs, routed, errors, ...metrics });
      if (index === 7) {
        const screenshot = await page.screenshot();
        await writeFile(screenshotPath, screenshot, { flag: 'wx' });
        report.screenshot = { path: screenshotPath, sha256: sha(screenshot) };
      }
      console.log(JSON.stringify({ index, arm, observedMs, marks: metrics.marks }));
    } catch (error) {
      report.failures.push({ index, arm, error: String(error), errors });
      throw error;
    } finally { await context.close(); }
  }
} catch (error) { process.exitCode = 1; console.error(error); }
finally {
  await browser.close();
  for (const [path, expected] of Object.entries(hashes)) {
    if (sha(await readFile(path)) !== expected) report.failures.push({ sourceDrift: path });
  }
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  if (report.failures.length) process.exitCode = 1;
}
