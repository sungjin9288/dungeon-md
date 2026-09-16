// Isolated first-viewport WebGL smoke. This is not a campaign or nested-modal E2E.
// node scripts/verify-web-surfaces.mjs
// PLAYWRIGHT_MODULE, WEB_AUDIT_URL, WEB_AUDIT_HEADLESS=1 may override local defaults.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083';
const shots = resolve(root, 'tools/screenshots');
const viewports = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
const scenes = [
  'DungeonHomeScene', 'StageSelectScene', 'PreBattleScene', 'BarracksScene',
  'ForgeScene', 'SummonScene', 'ShopScene', 'FusionScene', 'AncestralWisdomScene',
  'CodexScene', 'AchievementScene', 'AbyssScene', 'ProductionScene', 'DecorationScene', 'DungeonScene',
];
const audit = {
  generatedAt: new Date().toISOString(), base,
  scope: '15 initial states / 16 registered scenes including paired DungeonScene+UIScene, three viewports, DPR2; four-zone navigation and selected save-neutral controls. Cinematic and EndlessResult have current separate evidence. StageRewardOverlay has historical evidence only and was not re-run in this Goal. Not exhaustive nested UI, gameplay, campaign, native, or accessibility verification.',
  fixture: 'Fresh browser contexts; partial starter save merges through loadGameState. tutorialStage=99; current lastIdleCollect. PreBattle starts canonical MQ-003 through startQuest and passes its invasion config through the existing registry contract. This is a seeded entry, not proof of organic quest progression.',
  geometryMethod: 'World bounds transformed by actual camera matrix and cumulative container scroll factors; objects hidden by ancestors, camera filters, or outside viewport excluded. Camera-scroll boundary partials reported separately from fixed-layout overflow. Text overlap and small-font lists are review candidates, not automatic failures. Input labels inferred from intersecting visible text when no explicit name exists.',
  sourceHashes: {}, results: [], bannerResults: [], routes: [], selections: [], failures: [],
};
await mkdir(shots, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
for (const scene of [...scenes, 'UIScene']) {
  audit.sourceHashes[`src/scenes/${scene}.ts`] = sha(await readFile(resolve(root, `src/scenes/${scene}.ts`)));
}
for (const path of ['src/main.ts', 'src/ui/GameZoneNavigation.ts', 'src/data/navigationContract.ts', 'src/scenes/HomeCommandDeck.ts', 'src/ui/BarracksCard.ts', 'src/ui/BarracksGrowthHall.ts', 'src/ui/SummonShared.ts', 'src/ui/SummonBannerCard.ts', 'scripts/verify-web-surfaces.mjs']) {
  audit.sourceHashes[path] = sha(await readFile(resolve(root, path)));
}

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });

async function openScene(scene, viewport, fixedDate) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  if (fixedDate) await page.clock.setFixedTime(new Date(fixedDate));
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', text: message.text() }); });
  page.on('pageerror', error => errors.push({ type: 'pageerror', text: String(error) }));
  await page.addInitScript(() => {
    localStorage.setItem('dungeonGameState', JSON.stringify({ tutorialStage: 99, lastIdleCollect: Date.now() }));
  });
  const entry = scene === 'PreBattleScene' ? 'DungeonHomeScene' : scene;
  await page.goto(`${base}/?skipTutorial=1&scene=${entry}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(key => {
    const game = window.__phaserGame;
    return game?.renderer?.type === 2 && game.scene.isActive(key) && game.scene.getScene(key).children.list.length > 0;
  }, entry);
  if (scene === 'PreBattleScene') {
    await page.evaluate(async () => {
      const { MAIN_QUESTS } = await import('/src/data/questData.ts');
      const { loadGameState, saveGameState } = await import('/src/data/wisdom.ts');
      const { startQuest } = await import('/src/data/quests.ts');
      const quest = MAIN_QUESTS.find(candidate => candidate.id === 'MQ-003');
      if (!quest?.invasionOnComplete) throw new Error('Canonical MQ-003 invasion fixture missing');
      const game = window.__phaserGame;
      const state = startQuest(loadGameState(), quest.id);
      saveGameState(state);
      game.registry.set('invasionConfig', quest.invasionOnComplete);
      game.registry.set('questId', quest.id);
      game.scene.stop('DungeonHomeScene');
      game.scene.start('PreBattleScene');
    });
  }
  await page.waitForFunction(key => window.__phaserGame?.scene.isActive(key), scene);
  await page.waitForTimeout(800);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { context, page, errors };
}

async function inventory(page) {
  return page.evaluate(() => {
    const game = window.__phaserGame;
    const dpr = window.__gameDpr;
    const canvas = game.canvas.getBoundingClientRect();
    const round = value => Math.round(value * 100) / 100;
    const rect = bounds => ({ x: round(bounds.x), y: round(bounds.y), width: round(bounds.width), height: round(bounds.height) });
    const intersect = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const viewport = { x: 0, y: 0, width: 390, height: 844 };
    const sceneAudits = game.scene.getScenes(true).map(scene => {
      const camera = scene.cameras.main;
      const objects = [];
      const visit = (object, parentVisible = true, parentAlpha = 1, parentSX = 1, parentSY = 1) => {
        const visible = parentVisible && object.visible !== false && !(object.cameraFilter & camera.id);
        const alpha = parentAlpha * (object.alpha ?? 1);
        const sx = parentSX * (object.scrollFactorX ?? 1);
        const sy = parentSY * (object.scrollFactorY ?? 1);
        if (visible && alpha >= 0.1 && object.getBounds && (object.type === 'Text' || object.input?.enabled)) {
          const world = object.getBounds();
          const points = [[world.x, world.y], [world.right, world.y], [world.right, world.bottom], [world.x, world.bottom]].map(([x, y]) => camera.matrix.transformPoint(x - camera.scrollX * sx, y - camera.scrollY * sy));
          const xs = points.map(point => point.x / dpr), ys = points.map(point => point.y / dpr);
          const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
          const mask = object.mask ?? object.parentContainer?.mask;
          const inView = intersect(bounds, viewport) > 0;
          const matrix = object.getWorldTransformMatrix();
          const fontSize = parseFloat(object.style?.fontSize ?? '0');
          const renderedFontSize = fontSize * Math.hypot(matrix.a, matrix.b) * camera.zoom / dpr;
          objects.push({ name: object.name || null, type: object.type, text: typeof object.text === 'string' ? object.text : null, fontSize, renderedFontSize: round(renderedFontSize), bounds: rect(bounds), input: Boolean(object.input?.enabled), hitArea: object.input?.hitArea ? { width: object.input.hitArea.width, height: object.input.hitArea.height, radius: object.input.hitArea.radius } : null, scrollable: camera._bounds?.height > 844 && sy !== 0, masked: Boolean(mask), inView });
        }
        if (Array.isArray(object.list)) object.list.forEach(child => visit(child, visible, alpha, sx, sy));
      };
      scene.children.list.forEach(object => visit(object));
      const texts = objects.filter(object => object.text && object.inView && !object.masked);
      const inputs = objects.filter(object => object.input && object.inView && !object.masked).map(object => {
        const labels = texts.filter(text => intersect(text.bounds, object.bounds) >= text.bounds.width * text.bounds.height * 0.6).map(text => text.text);
        const logicalW = object.hitArea?.width ?? (object.hitArea?.radius ? 2 * object.hitArea.radius : object.bounds.width);
        const logicalH = object.hitArea?.height ?? (object.hitArea?.radius ? 2 * object.hitArea.radius : object.bounds.height);
        return { ...object, label: object.name ?? labels.join(' | ') ?? object.type, logicalTarget: { width: round(logicalW), height: round(logicalH) }, cssTarget: { width: round(logicalW * canvas.width / 390), height: round(logicalH * canvas.height / 844) } };
      });
      const overflow = texts.filter(text => text.bounds.x < -0.5 || text.bounds.y < -0.5 || text.bounds.x + text.bounds.width > 390.5 || text.bounds.y + text.bounds.height > 844.5);
      const overlaps = [];
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i], b = texts[j];
          if (a.text === b.text) continue;
          const area = intersect(a.bounds, b.bounds);
          if (area > 8 && area / Math.min(a.bounds.width * a.bounds.height, b.bounds.width * b.bounds.height) > 0.2) overlaps.push({ a: a.text, b: b.text, aBounds: a.bounds, bBounds: b.bounds });
        }
      }
      return {
        scene: scene.scene.key, camera: { zoom: camera.zoom, scrollX: camera.scrollX, scrollY: camera.scrollY, worldView: rect(camera.worldView) },
        visibleTextCount: texts.length, visibleInputCount: inputs.length, inputs,
        textBelow10: texts.filter(text => text.fontSize < 10), text10: texts.filter(text => text.fontSize === 10), text11: texts.filter(text => text.fontSize === 11),
        renderedTextBelow10: texts.filter(text => text.renderedFontSize < 9.9),
        undersizedTargets: inputs.filter(input => input.logicalTarget.width < 43.9 || input.logicalTarget.height < 43.9),
        fixedOverflow: overflow.filter(text => !text.scrollable), scrollBoundaryPartials: overflow.filter(text => text.scrollable),
        overlapCandidates: overlaps, excludedOffscreen: objects.filter(object => !object.inView).length,
        timers: scene.time._active.length, tweens: scene.tweens.getTweens().length,
      };
    });
    return { activeScenes: sceneAudits.map(item => item.scene), renderer: game.renderer.type, dpr, logical: { width: game.canvas.width / dpr, height: game.canvas.height / dpr }, canvasBacking: { width: game.canvas.width, height: game.canvas.height }, canvasCss: rect(canvas), scale: round(canvas.width / 390), state: JSON.parse(window.render_game_to_text()), scenes: sceneAudits };
  });
}

async function storage(page) { return page.evaluate(() => localStorage.getItem('dungeonGameState')); }
async function logicalClick(page, x, y) {
  const canvas = await page.locator('canvas').first().boundingBox();
  await page.mouse.move(canvas.x + x * canvas.width / 390, canvas.y + y * canvas.height / 844);
  await page.waitForTimeout(30);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await page.waitForTimeout(350);
}
async function namedClick(page, name) {
  const state = await inventory(page);
  const input = state.scenes.flatMap(scene => scene.inputs).find(input => input.name === name);
  if (!input) throw new Error(`Missing input ${name}`);
  await logicalClick(page, input.bounds.x + input.bounds.width / 2, input.bounds.y + input.bounds.height / 2);
}

try {
  for (const viewport of viewports) {
    for (const scene of scenes) {
      if (process.env.WEB_AUDIT_SCENES && !process.env.WEB_AUDIT_SCENES.split(',').includes(scene)) continue;
      if (process.env.WEB_AUDIT_WIDTHS && !process.env.WEB_AUDIT_WIDTHS.split(',').includes(String(viewport.width))) continue;
      const { context, page, errors } = await openScene(scene, viewport);
      try {
        const state = await inventory(page);
        const screenshot = `tools/screenshots/completion-${scene.replace(/Scene$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: resolve(root, screenshot), animations: 'disabled' });
        const png = await readFile(resolve(root, screenshot));
        audit.results.push({ scene, viewport, ...state, errors, screenshot, pngPixels: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, sha256: sha(png) });
        const expectedScenes = scene === 'DungeonScene' ? ['DungeonScene', 'UIScene'] : [scene];
        const activeMatches = JSON.stringify([...state.activeScenes].sort()) === JSON.stringify(expectedScenes.sort());
        if (!activeMatches || state.logical.width !== 390 || state.logical.height !== 844 || errors.length) audit.failures.push({ scene, viewport, reason: 'scene/logical bounds/console gate', errors });
        if (state.scenes.some(item => item.undersizedTargets.length || item.textBelow10.length)) audit.failures.push({ scene, viewport, reason: 'visible logical target/font minimum gate' });
        process.stdout.write(`${scene} ${viewport.width}x${viewport.height}: errors=${errors.length}, small=${state.scenes.reduce((sum, s) => sum + s.undersizedTargets.length, 0)}, overlaps=${state.scenes.reduce((sum, s) => sum + s.overlapCandidates.length, 0)}\n`);
        if (viewport.width === 390 && scene === 'DungeonHomeScene') {
          for (const [x, destination] of [[146.25, 'BarracksScene'], [243.75, 'ForgeScene'], [341.25, 'StageSelectScene'], [48.75, 'DungeonHomeScene']]) {
            const before = await storage(page);
            await logicalClick(page, x, 808);
            const observed = await page.evaluate(() => window.__phaserGame.scene.getScenes(true).map(s => s.scene.key));
            process.stdout.write(`route ${destination}: ${observed.join(',')}\n`);
            await page.waitForFunction(key => window.__phaserGame.scene.isActive(key), destination, { timeout: 3000 });
            const next = await inventory(page);
            audit.routes.push({ destination, activeScenes: next.activeScenes, byteEqualSave: before === await storage(page), errors: [...errors] });
          }
        }
        if (viewport.width === 390) {
          const selection = {
            AncestralWisdomScene: ['wisdom-lineage-abyss', 'wisdom-branch-forgeEnhancer'],
            ProductionScene: ['production-facility-mana_well'],
            DecorationScene: ['decoration-set-guardian'],
            CodexScene: ['codex-tab-invaders'],
          }[scene];
          if (selection) {
            const before = await storage(page);
            for (const name of selection) await namedClick(page, name);
            const neutral = before === await storage(page);
            audit.selections.push({ scene, inputs: selection, byteEqualSave: neutral });
            if (!neutral) audit.failures.push({ scene, reason: 'selection mutated save' });
          }
        }
      } catch (error) {
        audit.failures.push({ scene, viewport, reason: String(error) });
        process.stderr.write(`${scene}: ${error}\n`);
      } finally { await context.close(); }
    }
    if (!process.env.WEB_AUDIT_SCENES || process.env.WEB_AUDIT_SCENES.split(',').includes('SummonScene')) {
      if (process.env.WEB_AUDIT_WIDTHS && !process.env.WEB_AUDIT_WIDTHS.split(',').includes(String(viewport.width))) continue;
      const fixedDate = '2026-09-20T12:00:00Z';
      const { context, page, errors } = await openScene('SummonScene', viewport, fixedDate);
      try {
        const state = await inventory(page);
        const screenshot = `tools/screenshots/completion-summon-active-banner-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: resolve(root, screenshot) });
        const activeBanner = await page.evaluate(() => window.__phaserGame.scene.getScene('SummonScene').activeBanner?.id);
        const png = await readFile(resolve(root, screenshot));
        audit.bannerResults.push({ viewport, fixedDate, activeBanner, ...state, errors, screenshot, pngPixels: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, sha256: sha(png) });
        if (activeBanner !== 'fall_underworld_2026' || errors.length) audit.failures.push({ scene: 'SummonScene', viewport, reason: 'active banner render gate', errors });
      } finally { await context.close(); }
    }
  }
  audit.contactSheets = [];
  for (const viewport of viewports) {
    const records = audit.results.filter(result => result.viewport.width === viewport.width);
    if (!records.length) continue;
    const context = await browser.newContext({ viewport: { width: 1350, height: 1850 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      const cards = await Promise.all(records.map(async result => `<article><h2>${result.scene}</h2><img src="data:image/png;base64,${(await readFile(resolve(root, result.screenshot))).toString('base64')}"></article>`));
      await page.setContent(`<style>body{margin:0;background:#17191c;color:#eee;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(5,260px);gap:10px;padding:10px}h2{font-size:14px;height:20px;margin:0 0 5px}img{width:260px;display:block}article{min-width:0}</style><main>${cards.join('')}</main>`);
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      const screenshot = `tools/screenshots/completion-contact-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: resolve(root, screenshot), fullPage: true });
      audit.contactSheets.push({ viewport, screenshot, sha256: sha(await readFile(resolve(root, screenshot))) });
    } finally { await context.close(); }
  }
} catch (error) {
  audit.failures.push({ reason: `fixture or artifact failure: ${error}` });
  process.stderr.write(`${error}\n`);
} finally {
  await browser.close();
  audit.summary = { initialCaptures: audit.results.length, bannerCaptures: audit.bannerResults.length, errors: [...audit.results, ...audit.bannerResults].reduce((sum, item) => sum + item.errors.length, 0), hardFailures: audit.failures.length, routeChecks: audit.routes.length, selectionChecks: audit.selections.length };
  await writeFile(resolve(root, 'tools/completion-web-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
if (audit.failures.length) process.exitCode = 1;
