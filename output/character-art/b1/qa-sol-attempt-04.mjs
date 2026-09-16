// B1 character-art acceptance: isolated production renderers, real input paths,
// and bounded lifecycle evidence. Historical character-art QA is intentionally
// not imported or overwritten here.
// GAME_URL=http://127.0.0.1:8083 HEADED=1 node scripts/verify-character-b1.mjs

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightModule = process.env.PLAYWRIGHT_MODULE
  ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const base = process.env.GAME_URL ?? 'http://127.0.0.1:8083';
const ids = ['village_archer', 'dokkaebi_junior', 'gold_turtle', 'fire_dokkaebi', 'sage'];
const originalIds = ['dokkaebi_warrior', 'gumiho_guardian', 'death_messenger', 'mountain_spirit'];
const allIds = [...originalIds, ...ids];
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const hash = value => createHash('sha256').update(value).digest('hex');
const screenshotDir = resolve(root, 'tools/screenshots');
const auditPath = resolve(root, 'tools/character-b1-audit.json');
const baselinePath = resolve(root, 'tools/character-b1-baseline.json');
const assetsPath = resolve(root, 'tools/character-b1-assets.json');
const protectedBaselinePath = resolve(root, 'output/character-art/b1/baseline.json');
const verificationPath = resolve(root, 'tools/character-b1-verification.json');

const sourcePaths = [
  'scripts/verify-character-b1.mjs',
  'scripts/export-character-art.mjs',
  'scripts/character-art-export-options.mjs',
  'scripts/character-art-export-options.test.mjs',
  'src/data/characterArt.ts',
  'src/data/characterArt.test.ts',
  'src/art/PortraitGenerator.ts',
  'src/ui/MonsterPortraitView.ts',
  'src/ui/RoomSlotRenderer.ts',
  'src/objects/RoomVisuals.ts',
  'src/objects/Room.ts',
  'src/scenes/HomeRoomCards.ts',
  'src/ui/QuestSpeakerView.ts',
  'src/ui/QuestSpeakerView.test.ts',
  'src/ui/QuestLogPanel.ts',
  'src/scenes/BootScene.ts',
  'src/main.ts',
];

const audit = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  base,
  scope: 'B1 five-art character gallery, v2 density, quest folio and bounded real-input QA. Seeded presentation fixtures are not organic acquisition, campaign, native or release evidence.',
  ids,
  originalIds,
  viewports,
  fixtures: [],
  sourceAssets: [],
  registry: null,
  geometry: [],
  input: [],
  save: [],
  fallback: [],
  quest: { resolver: [], folio: [], headingRegression: [] },
  lifecycle: [],
  boot: { samples: [], baseline: null, comparison: null },
  captures: [],
  contactSheets: [],
  sourceHashes: {},
  protectedHashes: null,
  expectedRuntimeHashes: null,
  errors: [],
  failures: [],
  sourceDrift: [],
  unverified: [
    'No GPU-process memory claim; texture source pixels are an estimate only.',
    'No comparable frame-array baseline was preserved, so frame comparison remains unavailable.',
    'Seeded saves do not prove organic acquisition, campaign progression, native behavior or release readiness.',
  ],
};

const failures = audit.failures;
function fail(caseName, reason, detail = undefined) {
  failures.push({ case: caseName, reason, ...(detail === undefined ? {} : { detail }) });
}
function recordFixture(kind, detail = {}) {
  const fixture = { kind, seeded: kind.startsWith('seeded-'), ...detail };
  audit.fixtures.push(fixture);
  return fixture;
}
function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function readPngHeader(bytes) {
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function expectedState(kind = 'seeded-mq008') {
  const monster = id => ({
    id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null,
  });
  const common = {
    tutorialStage: 99,
    dmLevel: 1,
    lastIdleCollect: Date.now(),
    homeGold: 200,
    activeMainQuestId: 'MQ-008',
    questProgress: { 'MQ-008': { completed: false, objectives: { O1: 0 } } },
    ownedMonsters: [monster('dokkaebi_warrior')],
    dungeonSlots: [{
      roomType: 'combat', monsterIds: ['dokkaebi_warrior'], trapIds: [], roomLevel: 1, hp: 100, maxHp: 100,
    }],
  };
  if (kind === 'seeded-boot') return common;
  // The baseline Task 0 fixture is intentionally minimal and must remain
  // comparable to the parent receipt. Product/quest fixtures add the already
  // known sub-quest containers so their first folio open can isolate daily
  // preparation as an expected write.
  if (kind !== 'seeded-boot') {
    common.activeSubQuestIds = ['SQ-001', 'SQ-016'];
    common.subQuestProgress = { 'SQ-001': 0, 'SQ-016': 0 };
    common.completedSubQuestIds = [];
  }
  if (kind === 'seeded-no-active') {
    // Leave the terminal quest one real objective update short. The edge-case
    // runner completes it through production transactions after Home settles,
    // yielding the canonical empty activeMainQuestId without a synthetic quest.
    common.activeMainQuestId = 'EQ-005';
    common.questProgress = {
      'EQ-005': { completed: false, objectives: { O1: 99, O2: 1000000, O3: 30 } },
    };
  }
  if (kind === 'seeded-eq005') {
    common.activeMainQuestId = 'EQ-005';
    common.questProgress = { 'EQ-005': { completed: false, objectives: { O1: 0, O2: 0, O3: 0 } } };
  }
  if (kind === 'seeded-unknown') {
    common.activeMainQuestId = 'MQ-011';
    common.questProgress = { 'MQ-011': { completed: false, objectives: { O1: 0 } } };
  }
  return common;
}

async function captureSourceHashes() {
  for (const relative of sourcePaths) {
    audit.sourceHashes[relative] = hash(await readFile(resolve(root, relative)));
  }
}
async function inspectExpectedRuntimeHashes() {
  const verification = JSON.parse(await readFile(verificationPath, 'utf8'));
  const mismatches = [];
  for (const [relative, expected] of Object.entries(verification.sourceHashes ?? {})) {
    const observed = hash(await readFile(resolve(root, relative)));
    if (observed !== expected) mismatches.push({ path: relative, expected, observed });
  }
  audit.expectedRuntimeHashes = {
    path: 'tools/character-b1-verification.json',
    total: Object.keys(verification.sourceHashes ?? {}).length,
    mismatches,
  };
  if (mismatches.length) fail('expected-runtime-hashes', 'runtime differs from parent command receipt', mismatches);
}

async function inspectProtectedHashes() {
  const baseline = JSON.parse(await readFile(protectedBaselinePath, 'utf8'));
  const allowlisted = new Set([
    'docs/design/AGENT_HANDOFF.md',
    'docs/design/CHARACTER_ART_REVISION.md',
    'docs/design/DESIGN.md',
    'progress.md',
    'scripts/export-character-art.mjs',
    'src/data/characterArt.test.ts',
    'src/data/characterArt.ts',
    'src/art/PortraitGenerator.ts',
    'src/objects/RoomVisuals.ts',
    'src/scenes/BootScene.ts',
    'src/ui/QuestLogPanel.ts',
    'src/ui/RoomSlotRenderer.ts',
  ]);
  const expectedChanges = [];
  const unexpectedMismatches = [];
  for (const [relative, expected] of Object.entries(baseline.hashes ?? {})) {
    const file = resolve(root, relative);
    try {
      await access(file);
    } catch {
      unexpectedMismatches.push({ path: relative, expected, observed: null, status: 'missing' });
      continue;
    }
    const observed = hash(await readFile(file));
    if (observed === expected) continue;
    const entry = { path: relative, expected, observed, status: allowlisted.has(relative) ? 'allowlisted-runtime-or-doc-change' : 'unexpected' };
    (allowlisted.has(relative) ? expectedChanges : unexpectedMismatches).push(entry);
  }
  audit.protectedHashes = {
    baseline: 'output/character-art/b1/baseline.json',
    total: Object.keys(baseline.hashes ?? {}).length,
    expectedChanges,
    unexpectedMismatches,
  };
  if (audit.protectedHashes.total !== 1006) fail('protected-hashes', 'protected baseline inventory count changed', audit.protectedHashes.total);
  if (unexpectedMismatches.length) fail('protected-hashes', 'unexpected historical artifact drift', unexpectedMismatches);
}

async function inspectAssets() {
  const manifest = JSON.parse(await readFile(assetsPath, 'utf8'));
  const expected = new Map(manifest.assets.map(asset => [asset.id, asset]));
  if (manifest.status !== 'ACCEPTED') fail('assets', 'parent asset acceptance is not ACCEPTED', manifest.status);
  for (const id of ids) {
    const approved = expected.get(id);
    const relative = approved?.path ?? `public/assets/monsters/ritual-v2/${id}.png`;
    const file = resolve(root, relative);
    try {
      const bytes = await readFile(file);
      const masterBytes = approved?.master ? await readFile(resolve(root, approved.master)) : null;
      const header = readPngHeader(bytes);
      const source = {
        id, path: relative, bytes: bytes.length, sha256: hash(bytes), ...header,
        master: masterBytes ? { path: approved.master, bytes: masterBytes.length, sha256: hash(masterBytes) } : null,
        approved: approved ? {
          sha256: approved.sha256, bytes: approved.bytes, width: approved.width, height: approved.height,
          bitDepth: approved.bitDepth, colorType: approved.colorType, margins: approved.margins,
          transparentFraction: approved.transparentFraction, maxAlpha: approved.maxAlpha,
          master: approved.master, masterHash: approved.masterHash,
        } : null,
      };
      audit.sourceAssets.push(source);
      if (!approved || source.sha256 !== approved.sha256 || source.bytes !== approved.bytes
        || source.width !== 512 || source.height !== 512 || source.bitDepth !== 8
        || source.colorType !== 6 || source.bytes > 512 * 1024
        || source.master?.sha256 !== approved.masterHash) {
        fail(`asset-${id}`, 'exact PNG acceptance gate', source);
      }
    } catch (error) {
      fail(`asset-${id}`, 'asset read failed', String(error));
    }
  }
}

async function registeredRitualBytes() {
  let total = 0;
  for (const id of allIds) {
    total += (await readFile(resolve(root, `public/assets/monsters/ritual-v2/${id}.png`))).length;
  }
  return total;
}

async function newFixture(viewport, motion = 'reduce', kind = 'seeded-mq008', options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: motion });
  const page = await context.newPage();
  const errors = [];
  const networkErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => networkErrors.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  const state = expectedState(kind);
  await page.addInitScript(state => {
    localStorage.setItem('dungeonGameState', JSON.stringify(state));
  }, state);
  const started = performance.now();
  await page.goto(`${base}/?skipTutorial=1&scene=DungeonHomeScene`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.__phaserGame?.renderer?.type === 2
      && Boolean(window.__phaserGame.renderer.gl)
      && window.__phaserGame.scene.isActive('DungeonHomeScene'));
    await page.waitForFunction(() => Boolean(window.__phaserGame?.scene.getScene('DungeonHomeScene')?.children?.list?.length));
  } catch (error) {
    const observed = await page.evaluate(() => ({
      renderer: window.__phaserGame?.renderer?.type,
      active: window.__phaserGame?.scene.getScenes(true).map(scene => scene.scene.key),
    }));
    throw new Error(`Home entry failed: ${error}; ${JSON.stringify({ observed, errors, networkErrors })}`);
  }
  const readyMs = round(performance.now() - started, 4);
  if (new URL(page.url()).origin !== new URL(base).origin) {
    throw new Error(`fixture left loopback origin before readiness: ${page.url()}`);
  }
  await page.waitForTimeout(motion === 'reduce' ? 260 : 700);
  recordFixture(kind, { viewport, motion, entry: 'DungeonHomeScene', readyMs });
  return { context, page, errors, networkErrors, viewport, motion, kind, readyMs };
}

async function storage(page) {
  return page.evaluate(() => localStorage.getItem('dungeonGameState'));
}

async function logicalClick(page, x, y, settle = 300) {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('canvas bounding box unavailable');
  await page.mouse.move(box.x + x * box.width / 390, box.y + y * box.height / 844);
  await page.waitForTimeout(24);
  await page.mouse.down();
  await page.waitForTimeout(36);
  await page.mouse.up();
  await page.waitForTimeout(settle);
}

async function waitActive(page, key) {
  await page.waitForFunction(sceneKey => window.__phaserGame?.scene.isActive(sceneKey), key);
  await page.waitForTimeout(220);
}

async function switchScene(page, key, data = undefined) {
  await page.evaluate(({ key: sceneKey, data: sceneData }) => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    game.scene.start(sceneKey, sceneData);
  }, { key, data });
  await waitActive(page, key);
}

async function restoreHome(page, expectedQuestId = 'MQ-008') {
  await page.evaluate(() => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    for (const key of ['CharacterB1PortraitGallery', 'CharacterB1WorldGallery']) {
      if (game.scene.keys?.[key]) game.scene.remove(key);
    }
    game.scene.start('DungeonHomeScene');
  });
  await page.waitForFunction(expected => {
    const scene = window.__phaserGame?.scene.getScene('DungeonHomeScene');
    return window.__phaserGame?.scene.isActive('DungeonHomeScene')
      && Boolean(scene?.children?.list?.length)
      && scene?.gs?.activeMainQuestId === expected;
  }, expectedQuestId);
  await page.waitForTimeout(260);
  return page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('DungeonHomeScene');
    return { active: scene.scene.isActive(), children: scene.children.list.length, questId: scene.gs.activeMainQuestId };
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__phaserGame;
    const dpr = window.__gameDpr ?? 1;
    const round = value => Math.round(value * 100) / 100;
    const rect = bounds => ({ x: round(bounds.x), y: round(bounds.y), width: round(bounds.width), height: round(bounds.height) });
    const scenes = game.scene.getScenes(true).map(scene => {
      const camera = scene.cameras.main;
      const entries = [];
      const walk = (object, visible = true, alpha = 1, sx = 1, sy = 1, scrollable = false) => {
        const shown = visible && object.visible !== false && !(object.cameraFilter & camera.id);
        const nextAlpha = alpha * (object.alpha ?? 1);
        const nextSx = sx * (object.scrollFactorX ?? 1);
        const nextSy = sy * (object.scrollFactorY ?? 1);
        const nextScrollable = scrollable || object === scene.contentContainer || scene.maxScrollY > 0 && nextSy !== 0;
        if (object.getBounds && (object.type === 'Image' || object.type === 'Text' || object.input?.enabled)) {
          const world = object.getBounds();
          const points = [[world.x, world.y], [world.right, world.y], [world.right, world.bottom], [world.x, world.bottom]]
            .map(([x, y]) => camera.matrix.transformPoint(x - camera.scrollX * nextSx, y - camera.scrollY * nextSy));
          const xs = points.map(point => point.x / dpr);
          const ys = points.map(point => point.y / dpr);
          const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
          const inViewport = bounds.x + bounds.width > 0 && bounds.x < 390 && bounds.y + bounds.height > 0 && bounds.y < 844;
          const matrix = object.getWorldTransformMatrix();
          entries.push({
            type: object.type, name: object.name || null, text: object.text ?? null,
            texture: object.texture?.key ?? null, visible: shown && nextAlpha > 0.09 && inViewport,
            alpha: round(nextAlpha), bounds: rect(bounds),
            display: object.type === 'Image' ? { width: round(object.displayWidth), height: round(object.displayHeight) } : null,
            source: object.texture?.getSourceImage ? (() => { const source = object.texture.getSourceImage(); return source ? { width: source.width, height: source.height } : null; })() : null,
            fontSize: parseFloat(object.style?.fontSize ?? '0') * Math.hypot(matrix.a, matrix.b) * camera.zoom / dpr,
            input: Boolean(object.input?.enabled),
            hit: object.input?.hitArea ? { width: object.input.hitArea.width ?? 2 * object.input.hitArea.radius, height: object.input.hitArea.height ?? 2 * object.input.hitArea.radius } : null,
            scrollable: nextScrollable,
          });
        }
        if (Array.isArray(object.list)) object.list.forEach(child => walk(child, shown, nextAlpha, nextSx, nextSy, nextScrollable));
      };
      scene.children.list.forEach(object => walk(object));
      const visible = entries.filter(entry => entry.visible);
      const texts = visible.filter(entry => entry.type === 'Text');
      const inputObjects = visible.filter(entry => entry.input);
      return {
        key: scene.scene.key,
        children: scene.children.list.length,
        inputs: inputObjects.length,
        inputObjects,
        images: visible.filter(entry => entry.type === 'Image'),
        texts,
        textBelow10: texts.filter(entry => entry.fontSize < 9.9),
        fixedOverflow: texts.filter(entry => !entry.scrollable && (entry.bounds.x < -0.5 || entry.bounds.y < -0.5 || entry.bounds.x + entry.bounds.width > 390.5 || entry.bounds.y + entry.bounds.height > 844.5)),
        under44: inputObjects.filter(entry => (entry.hit?.width ?? 0) < 44 || (entry.hit?.height ?? 0) < 44),
        timers: scene.time?._active?.length ?? 0,
        tweens: scene.tweens?.getTweens?.().length ?? 0,
        listeners: {
          pointerdown: scene.input?.listenerCount?.('pointerdown') ?? 0,
          wheel: scene.input?.listenerCount?.('wheel') ?? 0,
          drag: scene.input?.listenerCount?.('drag') ?? 0,
        },
        quest: scene.questLogState ? { open: scene.questLogState.questLogOpen } : null,
        scroll: typeof scene.scrollY === 'number' ? { y: scene.scrollY, maxY: scene.maxScrollY ?? 0 } : null,
      };
    });
    const canvas = game.canvas.getBoundingClientRect();
    const gl = game.renderer.gl;
    return {
      renderer: game.renderer.type,
      graphicsContext: {
        live: Boolean(gl),
        constructor: gl?.constructor?.name ?? null,
        version: gl?.getParameter?.(gl.VERSION) ?? null,
        isWebGL2: Boolean(typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext),
      },
      dpr,
      logical: { width: game.canvas.width / dpr, height: game.canvas.height / dpr },
      canvasCss: rect(canvas),
      scenes,
      gameText: window.render_game_to_text?.() ?? null,
    };
  });
}

async function capture(fixture, name, kind, options = {}) {
  const { page, errors, networkErrors, viewport } = fixture;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await snapshot(page);
  const filename = `character-b1-${name}-${viewport.width}x${viewport.height}.png`;
  const relative = `tools/screenshots/${filename}`;
  const file = resolve(root, relative);
  await page.screenshot({ path: file });
  const bytes = await readFile(file);
  const png = readPngHeader(bytes);
  const receipt = {
    name, kind, fixture: fixture.kind, motion: fixture.motion, viewport,
    url: page.url(),
    path: relative, sha256: hash(bytes), png,
    renderer: state.renderer, graphicsContext: state.graphicsContext, dpr: state.dpr, logical: state.logical,
    scenes: state.scenes, errors: [...errors], networkErrors: [...networkErrors],
    ...(options.extra ? { extra: options.extra } : {}),
  };
  audit.captures.push(receipt);
  if (new URL(page.url()).origin !== new URL(base).origin) fail(name, 'capture left loopback origin', page.url());
  if (errors.length || networkErrors.length) fail(name, 'console/page/network error', { errors, networkErrors });
  if (state.renderer !== 2 || !state.graphicsContext.live || !state.graphicsContext.version?.startsWith('WebGL ')
    || state.dpr !== 2 || state.logical.width !== 390 || state.logical.height !== 844
    || png.width !== viewport.width * 2 || png.height !== viewport.height * 2) {
    fail(name, 'live WebGL context/DPR/logical canvas/screenshot gate', { renderer: state.renderer, graphicsContext: state.graphicsContext, dpr: state.dpr, logical: state.logical, png, viewport });
  }
  for (const scene of state.scenes) {
    if (scene.fixedOverflow.length) fail(`${name}-${scene.key}`, 'fixed text overflow', scene.fixedOverflow);
    if (scene.under44.length) fail(`${name}-${scene.key}`, 'interactive hit area below 44px', scene.under44);
  }
  return receipt;
}

async function collectRuntimeRegistry(page) {
  return page.evaluate(async ({ ids, originalIds }) => {
    const { CHARACTER_ART, selectCharacterArtSource } = await import('/src/data/characterArt.ts');
    const game = window.__phaserGame;
    const records = Object.values(CHARACTER_ART).map(art => {
      const source = game.textures.get(art.textureKey)?.getSourceImage?.();
      return { ...art, exists: game.textures.exists(art.textureKey), dimensions: source ? [source.width, source.height] : null };
    });
    const idsToCheck = [...originalIds, ...ids];
    const sources = Object.fromEntries(idsToCheck.map(id => [id, selectCharacterArtSource(id, key => game.textures.exists(key))]));
    const ritual = records.filter(record => record.version === 'ritual-v2' && record.exists);
    const textureSources = Object.values(game.textures.list ?? {})
      .flatMap(texture => texture.source ?? []);
    return {
      records, sources,
      graphicsContext: {
        constructor: game.renderer.gl?.constructor?.name ?? null,
        version: game.renderer.gl?.getParameter?.(game.renderer.gl.VERSION) ?? null,
        isWebGL2: Boolean(typeof WebGL2RenderingContext !== 'undefined' && game.renderer.gl instanceof WebGL2RenderingContext),
      },
      registeredCount: Object.keys(CHARACTER_ART).length,
      ritualSourceCount: ritual.length,
      ritualSourceDimensions: ritual.map(record => record.dimensions),
      ritualSourcePixels: ritual.reduce((total, record) => total + (record.dimensions?.[0] ?? 0) * (record.dimensions?.[1] ?? 0), 0),
      sourcePixels: textureSources.reduce((total, source) => {
        const image = source.image;
        return total + (image?.width ?? 0) * (image?.height ?? 0);
      }, 0),
      visibleTextureCount: game.textures.list ? Object.keys(game.textures.list).length : null,
    };
  }, { ids, originalIds });
}

async function collectSourceAlpha(page) {
  return page.evaluate(async idsToInspect => {
    const results = [];
    for (const id of idsToInspect) {
      const image = new Image();
      image.src = `/assets/monsters/ritual-v2/${id}.png`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0; let partial = 0; let maxAlpha = 0;
      let minX = canvas.width; let minY = canvas.height; let maxX = -1; let maxY = -1;
      for (let index = 0; index < canvas.width * canvas.height; index++) {
        const alpha = bytes[index * 4 + 3];
        const x = index % canvas.width; const y = Math.floor(index / canvas.width);
        if (alpha === 0) transparent++;
        else if (alpha < 255) partial++;
        maxAlpha = Math.max(maxAlpha, alpha);
        if (alpha > 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      }
      results.push({
        id, width: canvas.width, height: canvas.height, maxAlpha,
        fullyTransparentFraction: transparent / (canvas.width * canvas.height),
        partialAlphaFraction: partial / (canvas.width * canvas.height),
        margins: [minX, minY, canvas.width - 1 - maxX, canvas.height - 1 - maxY],
      });
    }
    return results;
  }, ids);
}

async function runPortraitGallery(fixture, missing = 'none') {
  const { page } = fixture;
  return page.evaluate(async ({ ids, missing }) => {
    const { addMonsterPortrait } = await import('/src/ui/MonsterPortraitView.ts');
    const { generatePortrait } = await import('/src/art/PortraitGenerator.ts');
    const { selectCharacterArtSource } = await import('/src/data/characterArt.ts');
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    for (const key of ['CharacterB1PortraitGallery', 'CharacterB1WorldGallery']) {
      if (game.scene.keys?.[key]) game.scene.remove(key);
    }
    if (missing !== 'none') {
      for (const id of ids) {
        for (const key of [`portrait-ritual-v2-${id}`, `portrait-${id}`]) {
          if (game.textures.exists(key)) game.textures.remove(key);
        }
        if (game.textures.exists(`monster-ritual-v2-${id}`)) game.textures.remove(`monster-ritual-v2-${id}`);
        if (missing === 'both' && game.textures.exists(`monster-ai-${id}`)) game.textures.remove(`monster-ai-${id}`);
      }
    }
    const records = [];
    game.scene.add('CharacterB1PortraitGallery', {
      create() {
        this.cameras.main.setZoom(window.__gameDpr).centerOn(195, 422).setBackgroundColor(0x080c0e);
        this.add.text(12, 10, `B1 portrait gallery · ${missing}`, { fontFamily: 'sans-serif', fontSize: '16px', color: '#eee1c6' });
        this.add.text(12, 31, 'Actual addMonsterPortrait · 24 / 46 / 64 / 104 envelopes', { fontFamily: 'sans-serif', fontSize: '11px', color: '#97a5a1' });
        const sizes = [24, 46, 64, 104];
        const centers = [30, 89, 165, 280];
        ids.forEach((id, index) => {
          const labelY = 58 + index * 145;
          const centerY = labelY + 75;
          this.add.text(12, labelY, id, { fontFamily: 'monospace', fontSize: '11px', color: '#ddc48f' });
          const portraits = sizes.map((size, portraitIndex) => {
            const refs = addMonsterPortrait(this, null, centers[portraitIndex], centerY, id, { size });
            const source = refs.image?.texture.getSourceImage?.();
            return {
              requestedDisplay: [size, size],
              key: refs.image?.texture.key ?? null,
              imageDisplay: refs.image ? [refs.image.displayWidth, refs.image.displayHeight] : null,
              source: source ? [source.width, source.height] : null,
              hasBadges: Boolean(refs.roleCue && refs.elementCue),
              input: Object.values(refs).some(object => object?.input?.enabled),
            };
          });
          const portraitSkinKey = generatePortrait(this, id, 'qa-explicit-skin');
          const portraitSkinSource = this.textures.get(portraitSkinKey)?.getSourceImage?.();
          records.push({
            id, source: selectCharacterArtSource(id, key => this.textures.exists(key)), missing,
            portraits,
            explicitSkin: { key: portraitSkinKey, source: portraitSkinSource ? [portraitSkinSource.width, portraitSkinSource.height] : null, sourceSelection: selectCharacterArtSource(id, key => this.textures.exists(key), 'qa-explicit-skin') },
          });
        });
      },
    }, true);
    return records;
  }, { ids, missing });
}

async function runWorldGallery(fixture, missing = 'none') {
  return fixture.page.evaluate(async ({ ids, missing }) => {
    const { generateMonsterSprite, generatePortrait, generateRoomToken } = await import('/src/art/PortraitGenerator.ts');
    const { selectCharacterArtSource } = await import('/src/data/characterArt.ts');
    const { drawBattleSlot } = await import('/src/ui/RoomSlotRenderer.ts');
    const { Room } = await import('/src/objects/Room.ts');
    const { loadGameState } = await import('/src/data/wisdom.ts');
    const { getActiveTheme } = await import('/src/themes/themes.ts');
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    for (const key of ['CharacterB1PortraitGallery', 'CharacterB1WorldGallery']) {
      if (game.scene.keys?.[key]) game.scene.remove(key);
    }
    const derivedKeys = id => [
      `portrait-ritual-v2-${id}`, `portrait-${id}`, `roomtoken-ritual-v2-${id}`, `roomtoken-${id}`,
      `sprite-ritual-v2-${id}`, `sprite-${id}`,
    ];
    if (missing !== 'none') {
      for (const id of ids) {
        for (const key of derivedKeys(id)) if (game.textures.exists(key)) game.textures.remove(key);
        if (game.textures.exists(`monster-ritual-v2-${id}`)) game.textures.remove(`monster-ritual-v2-${id}`);
        if (missing === 'both' && game.textures.exists(`monster-ai-${id}`)) game.textures.remove(`monster-ai-${id}`);
      }
    }
    const normalized = loadGameState();
    const sourceState = {
      ...normalized,
      ownedMonsters: ids.map(id => ({ id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null })),
      dungeonSlots: ids.map(id => ({ roomType: 'combat', monsterIds: [id], trapIds: [], roomLevel: 1, hp: 100, maxHp: 100 })),
    };
    const records = [];
    game.scene.add('CharacterB1WorldGallery', {
      create() {
        this.cameras.main.setZoom(window.__gameDpr).centerOn(195, 422).setBackgroundColor(0x080c0e);
        this.add.text(12, 10, `B1 world / room renderers · ${missing}`, { fontFamily: 'sans-serif', fontSize: '16px', color: '#eee1c6' });
        for (const [x, label] of [[35, 'token46'], [94, 'sprite60'], [195, 'RoomVisuals112'], [320, 'RoomSlot100']]) {
          this.add.text(x, 34, label, { fontFamily: 'sans-serif', fontSize: '10px', color: '#97a5a1' }).setOrigin(0.5);
        }
        ids.forEach((id, index) => {
          const labelY = 58 + index * 145;
          const centerY = labelY + 76;
          this.add.text(12, labelY, id, { fontFamily: 'monospace', fontSize: '11px', color: '#ddc48f' });
          const source = selectCharacterArtSource(id, key => this.textures.exists(key));
          const tokenKey = generateRoomToken(this, id);
          const token = tokenKey ? this.add.image(35, centerY, tokenKey).setOrigin(0.5).setDisplaySize(46, 46) : null;
          const spriteKey = generateMonsterSprite(this, id);
          const sprite = this.add.image(94, centerY, spriteKey).setOrigin(0.5).setDisplaySize(60, 60);

          const room = new Room(this, 195, centerY, index, 0, 'occupied', () => {}, 112);
          room.occupyWith('guardian');
          room.setDungeonSlotLoadoutVisual({
            roomTypeIcon: '⚔️', roomTypeName: '전투실', accentColor: 0xa98245,
            slotRoomType: 'combat', primaryMonsterEmoji: '👹', primaryMonsterId: id,
            monsterCount: 1, monsterCapacity: 2, equipmentCount: 0, trapCount: 0, trapCapacity: 1,
          });
          const roomImage = room.list.find(object => object.type === 'Image' && object.texture?.key?.includes(id));

          const slotContainer = this.add.container(0, 0);
          const slotGraphics = this.add.graphics();
          // Match HomeChrome's production ordering: the slot background is the
          // container's first child, then drawBattleSlot appends its occupant.
          slotContainer.add(slotGraphics);
          drawBattleSlot(
            { scene: this, theme: getActiveTheme('cave'), gs: sourceState, reducedMotion: true },
            slotContainer, slotGraphics, 270, centerY - 50, index, true,
          );
          const slotImage = slotContainer.list.find(object => object.type === 'Image' && object.texture?.key?.includes(id));
          const slotBounds = slotImage?.getBounds?.();
          const explicitSkinKey = generatePortrait(this, id, 'qa-explicit-skin');
          const explicitSkinSource = this.textures.get(explicitSkinKey)?.getSourceImage?.();
          const imageReceipt = image => image ? {
            key: image.texture.key,
            display: [image.displayWidth, image.displayHeight],
            source: [image.texture.getSourceImage().width, image.texture.getSourceImage().height],
          } : null;
          records.push({
            id, source, missing,
            token: tokenKey ? { key: tokenKey, display: [token.displayWidth, token.displayHeight], source: [this.textures.get(tokenKey).getSourceImage().width, this.textures.get(tokenKey).getSourceImage().height] } : { key: null, display: null, source: null },
            sprite: imageReceipt(sprite),
            roomVisuals: { cellSize: room.cs, input: [room.input.hitArea.width, room.input.hitArea.height], image: imageReceipt(roomImage) },
            roomSlotRenderer: {
              slotSize: [100, 100],
              image: imageReceipt(slotImage),
              imageBounds: slotBounds ? [slotBounds.x, slotBounds.y, slotBounds.width, slotBounds.height] : null,
              expectedBounds: [270, centerY - 50, 100, 100],
              visible: Boolean(slotImage?.visible && (slotImage.alpha ?? 1) > 0),
              backgroundBeforeImage: slotContainer.list.indexOf(slotGraphics) < slotContainer.list.indexOf(slotImage),
            },
            explicitSkin: { key: explicitSkinKey, source: explicitSkinSource ? [explicitSkinSource.width, explicitSkinSource.height] : null, sourceSelection: selectCharacterArtSource(id, key => this.textures.exists(key), 'qa-explicit-skin') },
          });
        });
      },
    }, true);
    return records;
  }, { ids, missing });
}

async function runQuestResolver(page) {
  return page.evaluate(async ({ ids, originalIds }) => {
    const { resolveQuestSpeakerVisual } = await import('/src/ui/QuestSpeakerView.ts');
    const { selectCharacterArtSource } = await import('/src/data/characterArt.ts');
    const { generatePortrait } = await import('/src/art/PortraitGenerator.ts');
    const game = window.__phaserGame;
    const exact = [
      ['도깨비 전사', '👹', 'monster-ritual-v2-dokkaebi_warrior'],
      ['구미호', '🦊', 'monster-ritual-v2-gumiho_guardian'],
      ['저승사자', '💀', 'monster-ritual-v2-death_messenger'],
      ['산신령', '⛩️', 'monster-ritual-v2-mountain_spirit'],
      ['신선 도인', '🧙', 'monster-ritual-v2-sage'],
    ];
    const exactResults = exact.map(([speaker, emoji, key]) => ({ speaker, expected: key, observed: resolveQuestSpeakerVisual(speaker, emoji, keyName => game.textures.exists(keyName)) }));
    const legacy = resolveQuestSpeakerVisual('신선 도인', '🧙', key => key === 'monster-ai-sage');
    const missing = resolveQuestSpeakerVisual('신선 도인', '🧙', () => false);
    const unknown = ['신선 도인 ', '산신', '구미호 수호자', 'constructor', '__proto__'].map(speaker => ({ speaker, observed: resolveQuestSpeakerVisual(speaker, '❔', () => true) }));
    const originals = Object.fromEntries(originalIds.map(id => [id, selectCharacterArtSource(id, key => game.textures.exists(key))]));
    const galleryScene = game.scene.getScene('DungeonHomeScene');
    const originalPortraits = Object.fromEntries(originalIds.map(id => {
      const key = generatePortrait(galleryScene, id);
      const source = galleryScene.textures.get(key)?.getSourceImage?.();
      return [id, { key, source: source ? [source.width, source.height] : null }];
    }));
    return { exact: exactResults, legacy, missing, unknown, originals, originalPortraits };
  }, { ids, originalIds });
}

async function openQuest(page) {
  const before = await storage(page);
  await logicalClick(page, 202, 32, 360);
  await page.waitForFunction(() => Boolean(window.__phaserGame?.scene.getScene('DungeonHomeScene')?.questLogState?.questLogOpen));
  await page.waitForTimeout(260);
  return { before, afterOpen: await storage(page), state: await snapshot(page) };
}

async function inspectQuestHeading(page) {
  return page.evaluate(() => {
    const root = window.__phaserGame.scene.getScene('DungeonHomeScene')?.questLogState?.questLogContainer;
    let heading = null;
    const walk = object => {
      if (object.text === '📜  메인 퀘스트') heading = object;
      if (Array.isArray(object.list)) object.list.forEach(walk);
    };
    if (root) walk(root);
    if (!heading) throw new Error('main quest heading not found');
    const calls = [];
    const original = heading.context.fillText;
    heading.context.fillText = function recordFillText(text, ...args) {
      calls.push(text);
      return original.call(this, text, ...args);
    };
    try {
      heading.updateText();
    } finally {
      heading.context.fillText = original;
    }
    return {
      calls,
      loneSurrogates: calls.filter(text => text.length === 1
        && text.charCodeAt(0) >= 0xD800 && text.charCodeAt(0) <= 0xDFFF),
    };
  });
}

async function prepareTerminalNoActive(page) {
  return page.evaluate(async () => {
    const { applyQuestObjectiveUpdate } = await import('/src/data/quests.ts');
    const { settleCompletedHomeMainQuest } = await import('/src/data/questLifecycleTransactions.ts');
    const scene = window.__phaserGame.scene.getScene('DungeonHomeScene');
    const [objectiveState, update] = applyQuestObjectiveUpdate(scene.gs, 'summon', 1);
    const settlement = settleCompletedHomeMainQuest(objectiveState);
    scene.applyGameStateResult(settlement);
    const overlayTexts = scene.children.list
      .flatMap(object => Array.isArray(object.list) ? object.list : [object])
      .filter(object => object.type === 'Text')
      .map(object => object.text);
    return {
      update,
      completion: settlement.completion?.completedQuest.id ?? null,
      nextQuestId: settlement.completion?.nextQuestId ?? null,
      activeMainQuestId: scene.gs.activeMainQuestId,
      overlayVisible: overlayTexts.includes('퀘스트 완료'),
    };
  });
}

async function closeQuest(page) {
  const before = await storage(page);
  await logicalClick(page, 364, 25, 360);
  await page.waitForFunction(() => !window.__phaserGame?.scene.getScene('DungeonHomeScene')?.questLogState?.questLogOpen);
  return { before, afterClose: await storage(page) };
}

async function runQuestCase(fixture, name, kind) {
  const opened = await openQuest(fixture.page);
  if (kind === 'seeded-mq008' && fixture.viewport.width === 390) {
    const heading = await inspectQuestHeading(fixture.page);
    audit.quest.headingRegression.push({ viewport: fixture.viewport, ...heading });
    if (heading.loneSurrogates.length) fail('quest-heading-surrogate', 'main quest heading emitted lone surrogate fillText input', heading);
  }
  const captureReceipt = await capture(fixture, name, `seeded-${kind} quest folio`, {
    extra: { storage: { before: opened.before, afterOpen: opened.afterOpen }, fixtureKind: kind },
  });
  const questScene = captureReceipt.scenes.find(scene => scene.key === 'DungeonHomeScene');
  audit.quest.folio.push({
    case: name,
    fixture: kind,
    visibleTexts: questScene?.texts?.filter(entry => entry.visible).map(entry => entry.text).filter(Boolean) ?? [],
    fixedOverflow: questScene?.fixedOverflow ?? [],
    scroll: questScene?.scroll ?? null,
  });
  const close = await closeQuest(fixture.page);
  audit.save.push({ case: name, fixture: kind, preparationWrite: opened.before !== opened.afterOpen, presentationCloseNeutral: close.before === close.afterClose });
  audit.input.push({ case: name, fixture: kind, opened: true, closed: true, closeTarget: 'real 44px close zone', storage: { afterOpen: opened.afterOpen, afterClose: close.afterClose } });
  if (close.before !== close.afterClose) fail(name, 'presentation close changed storage', { before: close.before, afterClose: close.afterClose });
  return captureReceipt;
}

async function runNavigation(fixture, homeReceipt) {
  const before = await storage(fixture.page);
  await logicalClick(fixture.page, 146.25, 808, 380);
  await waitActive(fixture.page, 'BarracksScene');
  const after = await storage(fixture.page);
  const barracks = await capture(fixture, 'barracks', 'seeded product view via real Home→Barracks root input');
  audit.input.push({ case: 'Home→Barracks', pointer: { x: 146.25, y: 808 }, active: 'BarracksScene', closed: true, storageNeutralAfterPreparation: before === after });
  audit.save.push({ case: 'Home→Barracks', preparationWrite: before !== after, presentationNeutral: before === after });
  if (before !== after) fail('Home→Barracks', 'root navigation changed save after Home preparation', { before, after });
  // The selected roster card's real 성장 detail CTA is a 44px product target.
  const detailBefore = await storage(fixture.page);
  await logicalClick(fixture.page, 254, 204, 380);
  await fixture.page.waitForFunction(() => Boolean(window.__phaserGame.scene.getScene('BarracksScene')?.detailOverlay));
  const detailState = await fixture.page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('BarracksScene');
    return { overlay: Boolean(scene?.detailOverlay), text: window.render_game_to_text?.() ?? null };
  });
  if (!detailState.overlay) throw new Error('Barracks detail overlay missing before capture');
  const detail = await capture(fixture, 'detail', 'Barracks detail opened through real growth CTA');
  audit.input.push({ case: 'Barracks detail', pointer: { x: 254, y: 204 }, overlay: detailState.overlay });
  if (!detailState.overlay) fail('Barracks detail', 'real roster card did not open detail overlay');
  await logicalClick(fixture.page, 349, 41, 360);
  const detailClosed = await fixture.page.evaluate(() => !window.__phaserGame.scene.getScene('BarracksScene').detailOverlay);
  audit.input.push({ case: 'Barracks detail close', pointer: { x: 349, y: 41 }, closed: detailClosed, saveNeutral: detailBefore === await storage(fixture.page) });
  if (!detailClosed) fail('Barracks detail close', 'detail overlay remained after real close pointer');
  if (detailBefore !== await storage(fixture.page)) fail('Barracks detail close', 'detail presentation changed storage');
  return { homeReceipt, barracks, detail };
}

function lifecycleSignature(receipt, key) {
  const scene = receipt.scenes.find(item => item.key === key);
  if (!scene) return null;
  return { key: scene.key, children: scene.children, inputs: scene.inputs, timers: scene.timers, tweens: scene.tweens, listeners: scene.listeners };
}

async function collectLifecycleEvidence(page, key, rememberQuest = false) {
  return page.evaluate(({ key: sceneKey, remember }) => {
    const scene = window.__phaserGame.scene.getScene(sceneKey);
    const questRoot = scene.questLogState?.questLogContainer;
    const idleRoots = new Set(scene.children.list.filter(object => object.depth === 899 || object.depth === 900));
    const objects = [];
    const ownerByObject = new Map();
    const walk = (object, owner) => {
      objects.push(object);
      ownerByObject.set(object, owner);
      if (Array.isArray(object.list)) object.list.forEach(child => walk(child, owner));
    };
    scene.children.list.forEach(root => walk(root, root));
    const questObjects = questRoot ? objects.filter(object => object === questRoot || ownerByObject.get(object) === questRoot) : [];
    const questSet = new Set(questObjects);
    if (remember) window.__characterB1RememberedQuestObjects = questObjects;
    const remembered = window.__characterB1RememberedQuestObjects ?? [];
    const tweens = scene.tweens?.getTweens?.() ?? [];
    const tweenTargets = tween => Array.isArray(tween.targets) ? tween.targets : tween.targets ? [tween.targets] : [];
    const signature = object => ({
      type: object.type,
      depth: object.depth ?? 0,
      x: Math.round((object.x ?? 0) * 100) / 100,
      y: Math.round((object.y ?? 0) * 100) / 100,
      text: object.text ?? null,
      hit: object.input?.hitArea ? [
        object.input.hitArea.width ?? 2 * object.input.hitArea.radius ?? 0,
        object.input.hitArea.height ?? 2 * object.input.hitArea.radius ?? 0,
      ] : null,
    });
    const sorted = values => values.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    const inputs = objects.filter(object => object.input?.enabled);
    const stableInputs = inputs.filter(object => {
      const owner = ownerByObject.get(object);
      return !questSet.has(object) && !idleRoots.has(owner);
    });
    const artImages = objects.filter(object => object.type === 'Image' && /ritual-v2/.test(object.texture?.key ?? ''));
    const timerEvents = scene.time?.getAllEvents?.() ?? scene.time?._active ?? [];
    const waterDropTimers = timerEvents.filter(event => String(event.callback).includes('const drop = scene.add.circle'));
    const waterDropObjects = objects.filter(object => object.type === 'Arc' && object.depth === 16);
    const waterDropSet = new Set(waterDropObjects);
    const inputManagerObjects = scene.input?._list ?? [];
    return {
      scene: sceneKey,
      quest: {
        present: Boolean(questRoot),
        objects: questObjects.length,
        types: Object.fromEntries([...new Set(questObjects.map(object => object.type))].sort().map(type => [type, questObjects.filter(object => object.type === type).length])),
        inputs: sorted(questObjects.filter(object => object.input?.enabled).map(signature)),
        activeTweens: tweens.filter(tween => tweenTargets(tween).some(target => questSet.has(target))).length,
      },
      rememberedQuest: {
        objects: remembered.length,
        stillAlive: remembered.filter(object => object.scene || object.parentContainer).length,
        registeredInputs: remembered.filter(object => inputManagerObjects.includes(object)).length,
        activeTweenTargets: tweens.filter(tween => tweenTargets(tween).some(target => remembered.includes(target))).length,
      },
      stableInputs: sorted(stableInputs.map(signature)),
      artImages: sorted(artImages.map(image => ({
        key: image.texture.key,
        display: [image.displayWidth, image.displayHeight],
        visible: image.visible !== false && (image.alpha ?? 1) > 0,
      }))),
      ambient: {
        waterDropLoopTimers: waterDropTimers.filter(event => event.loop || event.repeat === -1).length,
        waterDropInitialTimers: waterDropTimers.filter(event => !event.loop && event.repeat !== -1).length,
        waterDropObjects: waterDropObjects.length,
        waterDropTweens: tweens.filter(tween => tweenTargets(tween).some(target => waterDropSet.has(target))).length,
        idleIncomeRoots: idleRoots.size,
        idleIncomeInputs: inputs.filter(object => idleRoots.has(ownerByObject.get(object))).length,
      },
    };
  }, { key, remember: rememberQuest });
}

async function runLifecycle(motion) {
  const fixture = await newFixture({ width: 390, height: 844 }, motion, 'seeded-lifecycle');
  const panelCycles = [];
  const routeCycles = [];
  const settle = motion === 'reduce' ? 320 : 620;
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      const beforeSave = await storage(fixture.page);
      const before = await snapshot(fixture.page);
      const beforeOwned = await collectLifecycleEvidence(fixture.page, 'DungeonHomeScene');
      await logicalClick(fixture.page, 202, 32, settle);
      await pageWaitQuestOpen(fixture.page);
      const open = await snapshot(fixture.page);
      const openOwned = await collectLifecycleEvidence(fixture.page, 'DungeonHomeScene', true);
      const afterOpenSave = await storage(fixture.page);
      await logicalClick(fixture.page, 364, 25, settle);
      await fixture.page.waitForFunction(() => !window.__phaserGame.scene.getScene('DungeonHomeScene').questLogState.questLogOpen);
      const after = await snapshot(fixture.page);
      const afterOwned = await collectLifecycleEvidence(fixture.page, 'DungeonHomeScene');
      const afterCloseSave = await storage(fixture.page);
      panelCycles.push({
        iteration: cycle + 1,
        before: lifecycleSignature(before, 'DungeonHomeScene'),
        open: lifecycleSignature(open, 'DungeonHomeScene'),
        after: lifecycleSignature(after, 'DungeonHomeScene'),
        owned: { before: beforeOwned, open: openOwned, after: afterOwned },
        preparationWrite: beforeSave !== afterOpenSave,
        closeSaveNeutral: afterOpenSave === afterCloseSave,
      });
      if (afterOpenSave !== afterCloseSave) fail(`lifecycle-panel-${motion}-${cycle + 1}`, 'quest close changed storage after preparation');
    }
    for (let cycle = 0; cycle < 3; cycle++) {
      const before = await storage(fixture.page);
      await logicalClick(fixture.page, 146.25, 808, motion === 'reduce' ? 320 : 620);
      await waitActive(fixture.page, 'BarracksScene');
      const barracks = await snapshot(fixture.page);
      const barracksOwned = await collectLifecycleEvidence(fixture.page, 'BarracksScene');
      await logicalClick(fixture.page, 48.75, 808, settle);
      await waitActive(fixture.page, 'DungeonHomeScene');
      const home = await snapshot(fixture.page);
      const homeOwned = await collectLifecycleEvidence(fixture.page, 'DungeonHomeScene');
      const after = await storage(fixture.page);
      routeCycles.push({
        iteration: cycle + 1,
        barracks: lifecycleSignature(barracks, 'BarracksScene'),
        home: lifecycleSignature(home, 'DungeonHomeScene'),
        owned: { barracks: barracksOwned, home: homeOwned },
        saveNeutral: before === after,
      });
      if (before !== after) fail(`lifecycle-route-${motion}-${cycle + 1}`, 'real Home/Barracks root route changed storage');
    }
  } finally {
    await fixture.context.close();
  }
  const same = values => values.length === 3 && values.every(value => JSON.stringify(value) === JSON.stringify(values[0]));
  const expectedWaterLoops = motion === 'reduce' ? 0 : 5;
  const panelStable = same(panelCycles.map(entry => entry.owned.open.quest))
    && panelCycles.every(entry => !entry.owned.before.quest.present
      && entry.owned.open.quest.present
      && entry.owned.open.quest.inputs.length > 0
      && entry.owned.open.quest.activeTweens === 0
      && !entry.owned.after.quest.present
      && entry.owned.after.rememberedQuest.stillAlive === 0
      && entry.owned.after.rememberedQuest.registeredInputs === 0
      && entry.owned.after.rememberedQuest.activeTweenTargets === 0
      && JSON.stringify(entry.owned.before.stableInputs) === JSON.stringify(entry.owned.after.stableInputs)
      && JSON.stringify(entry.owned.before.artImages) === JSON.stringify(entry.owned.after.artImages)
      && entry.owned.before.ambient.waterDropLoopTimers === expectedWaterLoops
      && entry.owned.open.ambient.waterDropLoopTimers === expectedWaterLoops
      && entry.owned.after.ambient.waterDropLoopTimers === expectedWaterLoops);
  const routesStable = same(routeCycles.map(entry => entry.owned.home.stableInputs))
    && same(routeCycles.map(entry => entry.owned.home.artImages))
    && same(routeCycles.map(entry => entry.owned.barracks.stableInputs))
    && same(routeCycles.map(entry => entry.owned.barracks.artImages))
    && routeCycles.every(entry => !entry.owned.home.quest.present
      && entry.owned.home.ambient.waterDropLoopTimers === expectedWaterLoops);
  const errorFree = fixture.errors.length === 0 && fixture.networkErrors.length === 0;
  const stable = panelStable && routesStable && errorFree;
  audit.lifecycle.push({
    viewport: { width: 390, height: 844 }, motion, panelCycles, routeCycles,
    attribution: {
      excludedFromOwnedEquality: [
        'Home water-drip Arc objects and their 400/800ms tweens; exact owner is addWaterDrip at depth 16.',
        'Home idle-income depth 899 scrim and depth 900 container/inputs; may appear after long normal-motion QA elapsed time.',
      ],
      rawSceneSignaturesRetained: true,
    },
    errors: [...fixture.errors], networkErrors: [...fixture.networkErrors],
    panelStable, routesStable, errorFree, stable, fixture: 'seeded-lifecycle',
  });
  if (!stable) fail(`lifecycle-${motion}`, 'quest-owned resources, stable non-idle inputs/art, ambient loop ownership, or lifecycle errors failed exact repetition gates', { panelCycles, routeCycles, errors: fixture.errors, networkErrors: fixture.networkErrors });
}

async function pageWaitQuestOpen(page) {
  await page.waitForFunction(() => Boolean(window.__phaserGame?.scene.getScene('DungeonHomeScene')?.questLogState?.questLogOpen));
  await page.waitForTimeout(220);
}

async function runBootSamples() {
  const samples = [];
  const ritualSourceBytes = await registeredRitualBytes();
  for (let index = 0; index < 3; index++) {
    const fixture = await newFixture({ width: 390, height: 844 }, 'reduce', 'seeded-boot');
    try {
      const registry = await collectRuntimeRegistry(fixture.page);
      registry.ritualSourceBytes = ritualSourceBytes;
      const sourceAlpha = index === 0 ? await collectSourceAlpha(fixture.page) : undefined;
      if (sourceAlpha) audit.sourceAlpha = sourceAlpha;
      samples.push({ index, readyMs: fixture.readyMs, errors: [...fixture.errors], networkErrors: [...fixture.networkErrors], registry });
    } finally {
      await fixture.context.close();
    }
  }
  audit.boot.samples = samples;
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  audit.boot.baseline = {
    path: 'tools/character-b1-baseline.json',
    fixture: baseline.fixture,
    dpr: baseline.dpr,
    readyCondition: baseline.readyCondition,
    ritualSourceCount: baseline.ritualSourceCount,
    sourcePixels: baseline.sourcePixels,
    ritualSourceBytes: baseline.ritualBytes,
    samples: baseline.samples?.filter(sample => (sample.viewport?.width ?? sample.width) === 390) ?? [],
  };
  audit.boot.comparison = {
    status: 'available-without-frame-comparison',
    fixtureComparable: true,
    contextEvidenceCorrection: 'Historical baseline said WebGL2 from Phaser renderer.type=2, but did not record the actual context version. Current samples record renderer.gl constructor/version; baseline WebGL version is unavailable and is not asserted retrospectively.',
    readyMs: samples.map(sample => sample.readyMs),
    baselineReadyMs: audit.boot.baseline.samples.map(sample => sample.readyMs),
    registeredArtCount: samples.map(sample => sample.registry.registeredCount),
    baselineRegisteredArtCount: baseline.ritualSourceCount,
    ritualSourceBytes: samples.map(sample => sample.registry.ritualSourceBytes),
    baselineRitualSourceBytes: baseline.ritualBytes,
    sourcePixels: samples.map(sample => sample.registry.sourcePixels),
    baselineSourcePixels: baseline.sourcePixels,
    frameComparison: {
      status: 'unavailable',
      reason: 'baseline frame arrays were truncated and no comparable frame dataset was preserved',
    },
  };
  if (samples.some(sample => sample.errors.length || sample.networkErrors.length)) fail('boot-samples', 'fresh boot produced console/network errors', samples);
  if (samples.some(sample => !sample.registry.graphicsContext.version?.startsWith('WebGL ')
    || sample.registry.registeredCount !== 9 || sample.registry.ritualSourceCount !== 9)) {
    fail('boot-samples', 'live WebGL context or nine-source runtime registry gate failed', samples.map(sample => sample.registry));
  }
}

async function runProductMatrix() {
  const ritualSourceBytes = await registeredRitualBytes();
  for (const viewport of viewports) {
    const fixture = await newFixture(viewport, 'reduce', 'seeded-product');
    try {
      const registry = await collectRuntimeRegistry(fixture.page);
      registry.ritualSourceBytes = ritualSourceBytes;
      if (!audit.registry) audit.registry = registry;
      const sourceAlpha = await collectSourceAlpha(fixture.page);
      if (!audit.sourceAlpha) audit.sourceAlpha = sourceAlpha;
      const home = await capture(fixture, 'home', 'seeded product Home; actual HomeRoomCards sprite path');
      const homeScene = home.scenes.find(scene => scene.key === 'DungeonHomeScene');
      const homeSprite = homeScene?.images.find(image => image.texture === 'sprite-ritual-v2-dokkaebi_warrior');
      audit.geometry.push({ case: 'Home', viewport, source: homeSprite?.source ?? null, display: homeSprite?.display ?? null, expected: { source: [96, 96], display: [42, 42] } });
      if (!homeSprite || homeSprite.source?.width !== 96 || homeSprite.source?.height !== 96 || homeSprite.display?.width !== 42 || homeSprite.display?.height !== 42) fail('Home geometry', 'actual Home v2 sprite did not meet 96x96 source / 42x42 display', homeSprite);
      await runNavigation(fixture, home);
      const galleryBefore = await storage(fixture.page);
      const portraits = await runPortraitGallery(fixture, 'none');
      audit.geometry.push({ case: 'portrait-gallery', viewport, records: portraits });
      await capture(fixture, 'portrait-gallery', 'scene-assisted five-art addMonsterPortrait renderer matrix');
      const worlds = await runWorldGallery(fixture, 'none');
      audit.geometry.push({ case: 'world-gallery', viewport, records: worlds });
      await capture(fixture, 'world-gallery', 'scene-assisted five-art token/sprite/RoomVisuals/RoomSlot renderer matrix');
      const galleryAfter = await storage(fixture.page);
      audit.save.push({ case: 'galleries', fixture: 'seeded-product', before: galleryBefore, after: galleryAfter, storageNeutral: galleryBefore === galleryAfter });
      audit.input.push({ case: 'portrait-gallery', noInteractivePortraitTargets: portraits.every(record => record.portraits.every(portrait => !portrait.input)) });
      const expectedPortraitSizes = [24, 46, 64, 104];
      const expectedPortraitImageSizes = [16, 38, 56, 96];
      if (portraits.some(record => record.portraits.some((portrait, index) =>
        portrait.key !== `portrait-ritual-v2-${record.id}`
        || portrait.source?.[0] !== 256 || portrait.source?.[1] !== 256
        || portrait.requestedDisplay?.[0] !== expectedPortraitSizes[index]
        || portrait.requestedDisplay?.[1] !== expectedPortraitSizes[index]
        || portrait.imageDisplay?.[0] !== expectedPortraitImageSizes[index]
        || portrait.imageDisplay?.[1] !== expectedPortraitImageSizes[index]
        || portrait.input)
        || record.explicitSkin.source?.[0] !== 64 || record.explicitSkin.source?.[1] !== 64
        || record.explicitSkin.sourceSelection !== null)) {
        fail('portrait-gallery', 'actual portrait key/source/envelope/inset/input or explicit-skin contract mismatch', portraits);
      }
      if (worlds.some(record => {
        const bounds = record.roomSlotRenderer.imageBounds;
        const slot = record.roomSlotRenderer.expectedBounds;
        const slotContained = bounds && slot
          && bounds[0] >= slot[0] && bounds[1] >= slot[1]
          && bounds[0] + bounds[2] <= slot[0] + slot[2]
          && bounds[1] + bounds[3] <= slot[1] + slot[3];
        return record.token.key !== `roomtoken-ritual-v2-${record.id}`
          || record.token.source?.[0] !== 96 || record.token.source?.[1] !== 96
          || record.token.display?.[0] !== 46 || record.token.display?.[1] !== 46
          || record.sprite.key !== `sprite-ritual-v2-${record.id}`
          || record.sprite.source?.[0] !== 96 || record.sprite.source?.[1] !== 96
          || record.sprite.display?.[0] !== 60 || record.sprite.display?.[1] !== 60
          || record.roomVisuals.cellSize !== 112
          || record.roomVisuals.image?.source?.[0] !== 96 || record.roomVisuals.image?.source?.[1] !== 96
          || record.roomVisuals.image?.display?.[0] !== 46 || record.roomVisuals.image?.display?.[1] !== 46
          || record.roomSlotRenderer.slotSize?.[0] !== 100 || record.roomSlotRenderer.slotSize?.[1] !== 100
          || record.roomSlotRenderer.image?.source?.[0] !== 96 || record.roomSlotRenderer.image?.source?.[1] !== 96
          || record.roomSlotRenderer.image?.display?.[0] !== 46 || record.roomSlotRenderer.image?.display?.[1] !== 46
          || !record.roomSlotRenderer.visible || !record.roomSlotRenderer.backgroundBeforeImage || !slotContained;
      })) {
        fail('world-gallery', 'actual v2 token/sprite/RoomVisuals/RoomSlot geometry mismatch', worlds);
      }
      if (galleryBefore !== galleryAfter) fail('galleries', 'scene-assisted renderers changed storage', { before: galleryBefore, after: galleryAfter });
      const restored = await restoreHome(fixture.page, 'MQ-008');
      recordFixture('restored-home-after-gallery', { viewport, motion: fixture.motion, ...restored });
      await runQuestCase(fixture, 'quest-mq008', 'seeded-mq008');
      const questResolver = await runQuestResolver(fixture.page);
      audit.quest.resolver.push({ viewport, fixture: 'seeded-mq008', resolver: questResolver });
      audit.input.push({ case: 'quest-speaker-resolver', fixture: 'seeded-mq008', resolver: questResolver });
      if (questResolver.exact.some(entry => entry.observed.kind !== 'image' || entry.observed.textureKey !== entry.expected)) fail('quest-resolver-exact', 'exact speaker mapping did not select expected v2 key', questResolver.exact);
      if (questResolver.legacy.kind !== 'image' || questResolver.legacy.textureKey !== 'monster-ai-sage') fail('quest-resolver-legacy', 'mapped speaker did not use legacy source fallback', questResolver.legacy);
      if (questResolver.missing.kind !== 'emoji' || questResolver.missing.emoji !== '🧙') fail('quest-resolver-missing', 'missing-both speaker did not preserve emoji', questResolver.missing);
      if (questResolver.unknown.some(entry => entry.observed.kind !== 'emoji' || entry.observed.emoji !== '❔')) fail('quest-resolver-unknown', 'unknown speaker fuzzy-matched or changed emoji', questResolver.unknown);
    } finally {
      await fixture.context.close();
    }
  }
}

async function runQuestEdgeCases() {
  const cases = [
    ...viewports.map(viewport => ({ kind: 'seeded-eq005', name: 'quest-eq005', viewport })),
    { kind: 'seeded-unknown', name: 'quest-unknown', viewport: { width: 390, height: 844 } },
    { kind: 'seeded-no-active', name: 'quest-no-active', viewport: { width: 390, height: 844 } },
  ];
  for (const { kind, name, viewport } of cases) {
    const fixture = await newFixture(viewport, 'reduce', kind);
    try {
      if (kind === 'seeded-no-active') {
        const terminal = await prepareTerminalNoActive(fixture.page);
        recordFixture('terminal-no-active-transaction', { viewport, motion: fixture.motion, ...terminal });
        if (terminal.completion !== 'EQ-005' || terminal.nextQuestId !== null
          || terminal.activeMainQuestId !== '' || terminal.overlayVisible) {
          fail(name, 'real terminal quest transaction did not produce an unobscured no-active state', terminal);
        }
      }
      const questCapture = await runQuestCase(fixture, name, kind);
      const scene = questCapture.scenes.find(item => item.key === 'DungeonHomeScene');
      if (!scene || scene.fixedOverflow.length) fail(name, 'quest edge-case text overflow', scene?.fixedOverflow ?? null);
      const text = scene?.texts?.map(entry => entry.text).filter(Boolean).join('\n') ?? '';
      if (kind === 'seeded-no-active' && !text.includes('진행 중인 메인 퀘스트 없음')) fail(name, 'no-active quest text was not visible', text);
      if (kind === 'seeded-eq005') {
        const expected = ['전설의 던전 마스터', '소환 100회 실행', '골드 1,000,000 누적 획득', '던전 마스터 Lv.30 달성'];
        if (expected.some(value => !text.includes(value))) fail(name, 'actual EQ-005 title or three objectives were not visible', { expected, text });
      }
      if (kind === 'seeded-unknown') {
        const hasUnknownName = text.includes('구미호 수호자');
        const hasOriginalEmoji = scene?.texts?.some(entry => entry.text === '🦊') ?? false;
        const hasSpeakerImage = scene?.images?.some(entry => entry.display?.width === 48 && entry.display?.height === 48) ?? false;
        audit.quest.folio.push({ case: `${name}-fallback`, hasUnknownName, hasOriginalEmoji, hasSpeakerImage });
        if (!hasUnknownName || !hasOriginalEmoji || hasSpeakerImage) fail(name, 'unknown speaker did not preserve exact name plus original emoji', { hasUnknownName, hasOriginalEmoji, hasSpeakerImage });
      }
    } finally {
      await fixture.context.close();
    }
  }
}

async function runFallbackCases() {
  for (const missing of ['v2', 'both']) {
    const fixture = await newFixture({ width: 390, height: 844 }, 'reduce', `source-admission-fault-${missing}`);
    try {
      const before = await storage(fixture.page);
      const portraits = await runPortraitGallery(fixture, missing);
      await capture(fixture, `fallback-${missing}-portrait`, `source-admission fault ${missing}; actual portrait renderer`);
      const records = await runWorldGallery(fixture, missing);
      await capture(fixture, `fallback-${missing}-world`, `source-admission fault ${missing}; actual world/room renderers`);
      const after = await storage(fixture.page);
      audit.fallback.push({
        case: missing, fixture: `source-admission-fault-${missing}`,
        provenance: 'artificial source-admission fault; derived caches cleared before source removal; not natural asset absence',
        portraits, records, saveNeutral: before === after,
      });
      if (records.some(record => record.sprite.source?.[0] !== 48 || record.sprite.source?.[1] !== 48
        || record.sprite.display?.[0] !== 60 || record.sprite.display?.[1] !== 60
        || !record.roomSlotRenderer.visible || !record.roomSlotRenderer.backgroundBeforeImage)) {
        fail(`fallback-${missing}`, 'procedural world fallback did not observe 48px source / 60px display or visible production slot ordering', records);
      }
      if (missing === 'both') {
        if (portraits.some(record => record.portraits.some(portrait => portrait.source?.[0] !== 64 || portrait.source?.[1] !== 64))
          || records.some(record => record.token.key !== null
            || record.roomVisuals.image?.source?.[0] !== 48 || record.roomVisuals.image?.source?.[1] !== 48
            || record.roomVisuals.image?.display?.[0] !== 60 || record.roomVisuals.image?.display?.[1] !== 60
            || record.roomSlotRenderer.image?.source?.[0] !== 48 || record.roomSlotRenderer.image?.source?.[1] !== 48
            || record.roomSlotRenderer.image?.display?.[0] !== 60 || record.roomSlotRenderer.image?.display?.[1] !== 60)) {
          fail('fallback-both', 'missing-both did not use procedural portrait/world paths', { portraits, records });
        }
      }
      if (missing === 'v2') {
        if (portraits.some(record => record.source?.version !== 'legacy'
          || record.portraits.some(portrait => portrait.key !== `portrait-${record.id}`
            || portrait.source?.[0] !== 256 || portrait.source?.[1] !== 256))
          || records.some(record => record.source?.version !== 'legacy'
            || record.token.key !== `roomtoken-${record.id}`
            || record.token.source?.[0] !== 96 || record.token.source?.[1] !== 96
            || record.token.display?.[0] !== 46 || record.token.display?.[1] !== 46)) {
          fail('fallback-v2', 'missing-v2 did not use legacy portrait/token plus procedural world sprite', { portraits, records });
        }
      }
      if ([...portraits, ...records].some(record => record.explicitSkin.source?.[0] !== 64
        || record.explicitSkin.source?.[1] !== 64 || record.explicitSkin.sourceSelection !== null)) {
        fail(`fallback-${missing}`, 'explicit skin path changed during source-admission fault', { portraits, records });
      }
      if (before !== after) fail(`fallback-${missing}`, 'fallback renderer changed storage', { before, after });
    } finally {
      await fixture.context.close();
    }
  }
}

async function buildContactSheets(browser) {
  const captures = audit.captures;
  if (!captures.length) return;
  const page = await browser.newPage({ viewport: { width: 860, height: 980 }, deviceScaleFactor: 1 });
  try {
    for (let start = 0; start < captures.length; start += 6) {
      const batch = captures.slice(start, start + 6);
      const cards = await Promise.all(batch.map(async captureReceipt => {
        const image = (await readFile(resolve(root, captureReceipt.path))).toString('base64');
        return `<figure><figcaption>${captureReceipt.name} · ${captureReceipt.viewport.width}×${captureReceipt.viewport.height}</figcaption><img src="data:image/png;base64,${image}"></figure>`;
      }));
      await page.setContent(`<style>body{margin:0;padding:8px;background:#202522;color:#f1e5cd;font:11px sans-serif;display:grid;grid-template-columns:repeat(3,270px);gap:8px}figure{margin:0}figcaption{height:28px;overflow:hidden}img{width:270px;max-height:585px;object-fit:contain;display:block;background:#080c0e}</style>${cards.join('')}`);
      await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
      const relative = `tools/screenshots/character-b1-contact-${String(start / 6 + 1).padStart(2, '0')}.png`;
      const file = resolve(root, relative);
      await page.screenshot({ path: file, fullPage: true });
      audit.contactSheets.push({ path: relative, sha256: hash(await readFile(file)), captures: batch.map(item => item.path) });
    }
  } finally {
    await page.close();
  }
}

async function finalize() {
  for (const relative of sourcePaths) {
    const observed = hash(await readFile(resolve(root, relative)));
    if (observed !== audit.sourceHashes[relative]) audit.sourceDrift.push({ path: relative, before: audit.sourceHashes[relative], after: observed });
  }
  for (const source of audit.sourceAssets) {
    const observed = hash(await readFile(resolve(root, source.path)));
    if (observed !== source.sha256) audit.sourceDrift.push({ path: source.path, before: source.sha256, after: observed });
  }
  if (audit.sourceDrift.length) fail('source-drift', 'source or accepted asset bytes changed during QA', audit.sourceDrift);
  for (const source of audit.sourceAlpha ?? []) {
    const accepted = audit.sourceAssets.find(asset => asset.id === source.id)?.approved;
    if (source.width !== 512 || source.height !== 512 || source.maxAlpha < 250
      || source.fullyTransparentFraction < 0.3 || source.fullyTransparentFraction > 0.85
      || Math.min(...source.margins) < 42
      || source.maxAlpha !== accepted?.maxAlpha
      || source.fullyTransparentFraction !== accepted?.transparentFraction
      || JSON.stringify(source.margins) !== JSON.stringify(accepted?.margins)) {
      fail(`alpha-${source.id}`, 'actual alpha/margin gate or parent receipt mismatch', { source, accepted });
    }
  }
  audit.summary = {
    captures: audit.captures.length,
    contactSheets: audit.contactSheets.length,
    fixtures: audit.fixtures.length,
    failures: failures.length,
    sourceDrift: audit.sourceDrift.length,
    protectedUnexpectedMismatches: audit.protectedHashes?.unexpectedMismatches?.length ?? null,
    consoleErrors: audit.captures.reduce((sum, captureReceipt) => sum + captureReceipt.errors.length, 0),
    networkErrors: audit.captures.reduce((sum, captureReceipt) => sum + captureReceipt.networkErrors.length, 0),
    lifecycleStable: audit.lifecycle.every(item => item.stable),
    bootComparison: audit.boot.comparison?.status ?? 'unavailable',
  };
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  return audit.summary;
}

const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
let summary;
try {
  await mkdir(screenshotDir, { recursive: true });
  await captureSourceHashes();
  await inspectExpectedRuntimeHashes();
  await inspectProtectedHashes();
  await inspectAssets();
  await runBootSamples();
  await runProductMatrix();
  await runQuestEdgeCases();
  await runFallbackCases();
  await runLifecycle('reduce');
  await runLifecycle('no-preference');
  await buildContactSheets(browser);
} catch (error) {
  audit.errors.push(String(error));
  fail('harness', 'unhandled harness error', String(error));
  process.stderr.write(`${error.stack ?? error}\n`);
} finally {
  await browser.close();
  summary = await finalize();
}
console.log(JSON.stringify(summary));
if (failures.length || audit.sourceDrift.length || audit.protectedHashes?.unexpectedMismatches?.length) process.exitCode = 1;
