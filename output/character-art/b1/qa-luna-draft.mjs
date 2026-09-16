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

const sourcePaths = [
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
    dmXP: 0,
    lastIdleCollect: Date.now(),
    homeGold: 200,
    gems: 0,
    soulCrystals: 0,
    activeMainQuestId: 'MQ-008',
    questProgress: { 'MQ-008': { completed: false, objectives: { O1: 0 } } },
    ownedMonsters: [monster('dokkaebi_warrior')],
    dungeonSlots: [{
      roomType: 'combat', monsterIds: ['dokkaebi_warrior'], trapIds: [], roomLevel: 1, hp: 100, maxHp: 100,
    }],
  };
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
    common.activeMainQuestId = '';
    common.questProgress = {};
  }
  if (kind === 'seeded-long') {
    common.activeMainQuestId = 'EQ-005';
    common.questProgress = { 'EQ-005': { completed: false, objectives: { O1: 0, O2: 0, O3: 0 } } };
  }
  return common;
}

async function captureSourceHashes() {
  for (const relative of sourcePaths) {
    audit.sourceHashes[relative] = hash(await readFile(resolve(root, relative)));
  }
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
      const header = readPngHeader(bytes);
      const source = {
        id, path: relative, bytes: bytes.length, sha256: hash(bytes), ...header,
        approved: approved ? {
          sha256: approved.sha256, bytes: approved.bytes, width: approved.width, height: approved.height,
          bitDepth: approved.bitDepth, colorType: approved.colorType, margins: approved.margins,
        } : null,
      };
      audit.sourceAssets.push(source);
      if (!approved || source.sha256 !== approved.sha256 || source.bytes !== approved.bytes
        || source.width !== 512 || source.height !== 512 || source.bitDepth !== 8
        || source.colorType !== 6 || source.bytes > 512 * 1024) {
        fail(`asset-${id}`, 'exact PNG acceptance gate', source);
      }
    } catch (error) {
      fail(`asset-${id}`, 'asset read failed', String(error));
    }
  }
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
  await page.addInitScript(({ state, options }) => {
    localStorage.setItem('dungeonGameState', JSON.stringify(state));
    if (options?.headingInstrumentation) {
      const calls = [];
      const proto = window.CanvasRenderingContext2D?.prototype;
      const original = proto?.fillText;
      window.__characterB1HeadingFillTextCalls = calls;
      if (proto && original) {
        proto.fillText = function instrumentedFillText(text, ...args) {
          if (typeof text === 'string' && text.includes('메인 퀘스트')) {
            calls.push({ text, loneSurrogate: /[\uD800-\uDFFF]/u.test(text) });
          }
          return original.call(this, text, ...args);
        };
        window.__characterB1RestoreHeadingFillText = () => { proto.fillText = original; };
      }
    }
  }, { state, options });
  const started = performance.now();
  await page.goto(`${base}/?skipTutorial=1&scene=DungeonHomeScene`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.__phaserGame?.renderer?.type === 2
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
    return {
      renderer: game.renderer.type,
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
    path: relative, sha256: hash(bytes), png,
    renderer: state.renderer, dpr: state.dpr, logical: state.logical,
    scenes: state.scenes, errors: [...errors], networkErrors: [...networkErrors],
    ...(options.extra ? { extra: options.extra } : {}),
  };
  audit.captures.push(receipt);
  if (errors.length || networkErrors.length) fail(name, 'console/page/network error', { errors, networkErrors });
  if (state.renderer !== 2 || state.dpr !== 2 || state.logical.width !== 390 || state.logical.height !== 844
    || png.width !== viewport.width * 2 || png.height !== viewport.height * 2) {
    fail(name, 'WebGL2/DPR/logical canvas/screenshot gate', { renderer: state.renderer, dpr: state.dpr, logical: state.logical, png, viewport });
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
    return {
      records, sources,
      registeredCount: Object.keys(CHARACTER_ART).length,
      ritualSourceCount: ritual.length,
      ritualSourceDimensions: ritual.map(record => record.dimensions),
      ritualSourcePixels: ritual.reduce((total, record) => total + (record.dimensions?.[0] ?? 0) * (record.dimensions?.[1] ?? 0), 0),
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

async function runGallery(fixture, missing = 'none') {
  const { page } = fixture;
  const receipts = await page.evaluate(async ({ ids, missing, state }) => {
    const { addMonsterPortrait } = await import('/src/ui/MonsterPortraitView.ts');
    const { generateMonsterSprite, generatePortrait, generateRoomToken } = await import('/src/art/PortraitGenerator.ts');
    const { selectCharacterArtSource } = await import('/src/data/characterArt.ts');
    const { drawBattleSlot } = await import('/src/ui/RoomSlotRenderer.ts');
    const { Room } = await import('/src/objects/Room.ts');
    const { getActiveTheme } = await import('/src/themes/themes.ts');
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    const derivedKeys = id => [
      `portrait-ritual-v2-${id}`, `portrait-${id}`, `roomtoken-ritual-v2-${id}`, `roomtoken-${id}`,
      `sprite-ritual-v2-${id}`, `sprite-${id}`,
    ];
    // Each fresh context has not invoked the generator yet. Clear derived caches
    // before source admission faults so module-local generator caches cannot lie.
    if (missing !== 'none') {
      for (const id of ids) {
        for (const key of derivedKeys(id)) if (game.textures.exists(key)) game.textures.remove(key);
        if (missing === 'v2' || missing === 'both') {
          for (const key of [`monster-ritual-v2-${id}`]) if (game.textures.exists(key)) game.textures.remove(key);
        }
        if (missing === 'both') {
          for (const key of [`monster-ai-${id}`]) if (game.textures.exists(key)) game.textures.remove(key);
        }
      }
    }
    const records = [];
    game.scene.add('CharacterB1Gallery', {
      create() {
        this.cameras.main.setZoom(window.__gameDpr).centerOn(195, 422).setBackgroundColor(0x080c0e);
        this.add.text(12, 10, `B1 character gallery · ${missing}`, { fontFamily: 'sans-serif', fontSize: '16px', color: '#eee1c6' });
        this.add.text(12, 31, 'Scene-assisted presentation fixture; no inventory/reward mutation', { fontFamily: 'sans-serif', fontSize: '10px', color: '#97a5a1' });
        const card = 155;
        ids.forEach((id, index) => {
          const y = 58 + index * card;
          this.add.text(12, y, id, { fontFamily: 'monospace', fontSize: '10px', color: '#ddc48f' });
          const sizes = [24, 46, 64, 104];
          const xs = [28, 78, 136, 230];
          const portraits = sizes.map((size, portraitIndex) => {
            const refs = addMonsterPortrait(this, null, xs[portraitIndex], y + 42, id, { size });
            const source = refs.image?.texture.getSourceImage?.();
            return {
              size,
              key: refs.image?.texture.key ?? null,
              display: refs.image ? [refs.image.displayWidth, refs.image.displayHeight] : null,
              source: source ? [source.width, source.height] : null,
              hasBadges: Boolean(refs.roleCue && refs.elementCue),
              input: Object.values(refs).some(object => object?.input?.enabled),
            };
          });
          const roomTokenKey = generateRoomToken(this, id);
          const roomToken = roomTokenKey ? this.add.image(150, y + 42, roomTokenKey).setOrigin(0.5).setDisplaySize(46, 46) : null;
          const worldSpriteKey = generateMonsterSprite(this, id);
          const worldSprite = this.add.image(222, y + 42, worldSpriteKey).setOrigin(0.5).setDisplaySize(60, 60);
          const portraitSkinKey = generatePortrait(this, id, 'qa-explicit-skin');
          const portraitSkinSource = this.textures.get(portraitSkinKey)?.getSourceImage?.();
          const source = selectCharacterArtSource(id, key => this.textures.exists(key));
          this.add.text(96, y + 72, roomTokenKey ? 'token46' : 'token→sprite', { fontFamily: 'sans-serif', fontSize: '9px', color: '#8da59b' });
          this.add.text(185, y + 72, 'gallery sprite60', { fontFamily: 'sans-serif', fontSize: '9px', color: '#8da59b' });
          const galleryRoom = new Room(this, 310, y + 42, index, 0, 'occupied', () => {}, 112);
          galleryRoom.occupyWith('guardian');
          galleryRoom.setDungeonSlotLoadoutVisual({
            roomTypeIcon: '⚔️', roomTypeName: '전투실', accentColor: 0xa98245,
            slotRoomType: 'combat', primaryMonsterEmoji: '👹', primaryMonsterId: id,
            monsterCount: 1, monsterCapacity: 2, equipmentCount: 0, trapCount: 0, trapCapacity: 1,
          });
          const roomSprite = galleryRoom.list.find(object => object.type === 'Image' && object.texture?.key?.includes(id));
          records.push({
            id, source, missing,
            portraits,
            token: { key: roomTokenKey, display: roomToken ? [roomToken.displayWidth, roomToken.displayHeight] : null, source: roomTokenKey ? [this.textures.get(roomTokenKey).getSourceImage().width, this.textures.get(roomTokenKey).getSourceImage().height] : null },
            sprite: { key: worldSpriteKey, display: [worldSprite.displayWidth, worldSprite.displayHeight], source: [this.textures.get(worldSpriteKey).getSourceImage().width, this.textures.get(worldSpriteKey).getSourceImage().height] },
            explicitSkin: { key: portraitSkinKey, source: portraitSkinSource ? [portraitSkinSource.width, portraitSkinSource.height] : null, sourceSelection: selectCharacterArtSource(id, key => this.textures.exists(key), 'qa-explicit-skin') },
            roomVisuals: roomSprite ? { key: roomSprite.texture.key, display: [roomSprite.displayWidth, roomSprite.displayHeight], source: [roomSprite.texture.getSourceImage().width, roomSprite.texture.getSourceImage().height] } : null,
          });
          this.add.text(278, y + 72, 'RoomVisuals', { fontFamily: 'sans-serif', fontSize: '9px', color: '#8da59b' });
        });
        const scene = this;
        const sourceState = {
          ...state,
          ownedMonsters: ids.map(id => ({ id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null })),
          dungeonSlots: ids.map(id => ({ roomType: 'combat', monsterIds: [id], trapIds: [], roomLevel: 1, hp: 100, maxHp: 100 })),
        };
        const roomSlotRenderer = [];
        ids.forEach((id, index) => {
          const slotContainer = this.add.container(0, 0);
          const slotGraphics = this.add.graphics();
          drawBattleSlot({ scene, theme: getActiveTheme('cave'), gs: sourceState, reducedMotion: true }, slotContainer, slotGraphics, 145, 720, index, true);
          const image = slotContainer.list.find(object => object.type === 'Image' && object.texture?.key?.includes(id));
          roomSlotRenderer.push(image ? { id, key: image.texture.key, display: [image.displayWidth, image.displayHeight], source: [image.texture.getSourceImage().width, image.texture.getSourceImage().height] } : { id, key: null, display: null, source: null });
          slotContainer.destroy(true);
          slotGraphics.destroy();
        });
        records.forEach((record, index) => { record.roomSlotRenderer = roomSlotRenderer[index]; });
        this.add.text(116, 824, 'RoomSlotRenderer actual path', { fontFamily: 'sans-serif', fontSize: '8px', color: '#8da59b' });
      },
    }, true);
    return records;
  }, {
    ids,
    missing,
    state: await page.evaluate(() => JSON.parse(JSON.stringify(window.__phaserGame.scene.getScene('DungeonHomeScene')?.gs ?? {}))),
  });
  return receipts;
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
    const galleryScene = game.scene.getScene('CharacterB1Gallery');
    const originalPortraits = Object.fromEntries(originalIds.map(id => {
      const key = generatePortrait(galleryScene, id);
      const source = galleryScene.textures.get(key)?.getSourceImage?.();
      return [id, { key, source: source ? [source.width, source.height] : null }];
    }));
    return { exact: exactResults, legacy, missing, unknown, originals, originalPortraits };
  }, { ids, originalIds });
}

async function openQuest(page, options = {}) {
  if (options.kind === 'seeded-no-active' || options.kind === 'seeded-long') {
    await page.evaluate(async kind => {
      const scene = window.__phaserGame.scene.getScene('DungeonHomeScene');
      if (kind === 'seeded-no-active') {
        scene.gs.activeMainQuestId = '';
        scene.gs.questProgress = {};
      } else {
        scene.gs.activeMainQuestId = 'MQ-004';
        scene.gs.questProgress = { 'MQ-004': { completed: false, objectives: { O1: 0, O2: 0 } } };
        const { MAIN_QUESTS } = await import('/src/data/questData.ts');
        const quest = MAIN_QUESTS.find(item => item.id === 'MQ-004');
        window.__characterB1LongQuestBackup = quest ? { title: quest.title, description: quest.description, objectives: quest.objectives } : null;
        if (quest) {
          quest.title = '던전 방어를 위한 장기 작전과 산맥의 봉인된 수호자 기록';
          quest.description = '오래 이어지는 방어 작전의 첫 문장을 읽고 모든 준비를 확인하라.\n두 번째 문장은 화면 아래의 objectives를 계속 확인하게 한다.';
          quest.objectives = [
            { id: 'O1', type: 'build_room', target: 12, current: 0, description: '서로 다른 방을 열두 개 건설하고 방어 연결망을 완성한다' },
            { id: 'O2', type: 'reach_dm_level', target: 20, current: 0, description: '던전 마스터 레벨 스무 단계에 도달한다' },
            { id: 'O3', type: 'collect_gold', target: 9999, current: 0, description: '장기 작전에 필요한 골드를 충분히 모은다' },
          ];
        }
      }
    }, options.kind);
  }
  const before = await storage(page);
  await logicalClick(page, 202, 32, 360);
  await page.waitForFunction(() => Boolean(window.__phaserGame?.scene.getScene('DungeonHomeScene')?.questLogState?.questLogOpen));
  await page.waitForTimeout(260);
  return { before, afterOpen: await storage(page), state: await snapshot(page) };
}

async function closeQuest(page) {
  const before = await storage(page);
  await logicalClick(page, 364, 25, 360);
  await page.waitForFunction(() => !window.__phaserGame?.scene.getScene('DungeonHomeScene')?.questLogState?.questLogOpen);
  return { before, afterClose: await storage(page) };
}

async function restoreLongQuest(page) {
  await page.evaluate(() => {
    const backup = window.__characterB1LongQuestBackup;
    if (!backup) return;
    import('/src/data/questData.ts').then(({ MAIN_QUESTS }) => {
      const quest = MAIN_QUESTS.find(item => item.id === 'MQ-004');
      if (quest) Object.assign(quest, backup);
    });
  });
}

async function runQuestCase(fixture, name, kind) {
  const opened = await openQuest(fixture.page, { kind });
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
  if (kind === 'seeded-long') await restoreLongQuest(fixture.page);
  if (opened.before !== opened.afterOpen && kind !== 'seeded-mq008') {
    fail(name, 'unexpected storage write for non-preparation quest fixture', { before: opened.before, afterOpen: opened.afterOpen });
  }
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
  // The first roster card is a real interactive card. Its center is stable in
  // the observed 390px layout and remains inside the card's 44px hit region.
  const detailBefore = await storage(fixture.page);
  await logicalClick(fixture.page, 195, 240, 380);
  const detail = await capture(fixture, 'detail', 'Barracks detail opened through real roster-card pointer');
  const detailState = await fixture.page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('BarracksScene');
    return { overlay: Boolean(scene?.detailOverlay), text: window.render_game_to_text?.() ?? null };
  });
  audit.input.push({ case: 'Barracks detail', pointer: { x: 195, y: 240 }, overlay: detailState.overlay });
  if (!detailState.overlay) fail('Barracks detail', 'real roster card did not open detail overlay');
  await logicalClick(fixture.page, 349, 41, 360);
  const detailClosed = await fixture.page.evaluate(() => !window.__phaserGame.scene.getScene('BarracksScene').detailOverlay);
  audit.input.push({ case: 'Barracks detail close', pointer: { x: 349, y: 41 }, closed: detailClosed, saveNeutral: detailBefore === await storage(fixture.page) });
  if (!detailClosed) fail('Barracks detail close', 'detail overlay remained after real close pointer');
  if (detailBefore !== await storage(fixture.page)) fail('Barracks detail close', 'detail presentation changed storage');
  return { homeReceipt, barracks, detail };
}

function lifecycleSignature(receipt) {
  const scene = receipt.scenes.find(item => item.key === 'DungeonHomeScene' || item.key === 'BarracksScene');
  if (!scene) return null;
  return { key: scene.key, children: scene.children, inputs: scene.inputs, timers: scene.timers, tweens: scene.tweens, listeners: scene.listeners };
}

async function runLifecycle(motion) {
  const fixture = await newFixture({ width: 390, height: 844 }, motion, 'seeded-lifecycle');
  const signatures = [];
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      await switchScene(fixture.page, 'DungeonHomeScene');
      const home = await snapshot(fixture.page);
      await logicalClick(fixture.page, 202, 32, motion === 'reduce' ? 260 : 520);
      await pageWaitQuestOpen(fixture.page);
      await logicalClick(fixture.page, 364, 25, motion === 'reduce' ? 260 : 520);
      await fixture.page.waitForFunction(() => !window.__phaserGame.scene.getScene('DungeonHomeScene').questLogState.questLogOpen);
      await logicalClick(fixture.page, 146.25, 808, motion === 'reduce' ? 320 : 620);
      await waitActive(fixture.page, 'BarracksScene');
      const barracks = await snapshot(fixture.page);
      signatures.push({ cycle, home: lifecycleSignature({ scenes: home.scenes }), barracks: lifecycleSignature({ scenes: barracks.scenes }) });
    }
  } finally {
    await fixture.context.close();
  }
  const stable = signatures.length === 3 && signatures.every((entry, index) => index === 0 || JSON.stringify({ home: entry.home, barracks: entry.barracks }) === JSON.stringify({ home: signatures[0].home, barracks: signatures[0].barracks }));
  audit.lifecycle.push({ viewport: { width: 390, height: 844 }, motion, cycles: signatures, stable, fixture: 'seeded-lifecycle' });
  if (!stable) fail(`lifecycle-${motion}`, 'settled Home/Quest/Barracks signature grew across three cycles', signatures);
}

async function pageWaitQuestOpen(page) {
  await page.waitForFunction(() => Boolean(window.__phaserGame?.scene.getScene('DungeonHomeScene')?.questLogState?.questLogOpen));
  await page.waitForTimeout(220);
}

async function runBootSamples() {
  const samples = [];
  for (let index = 0; index < 3; index++) {
    const fixture = await newFixture({ width: 390, height: 844 }, 'reduce', 'seeded-boot');
    try {
      const registry = await collectRuntimeRegistry(fixture.page);
      registry.ritualSourceBytes = audit.sourceAssets.reduce((sum, source) => sum + source.bytes, 0);
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
    ritualSourceCount: baseline.ritualSourceCount,
    sourcePixels: baseline.sourcePixels,
    samples: baseline.samples?.filter(sample => sample.viewport?.width === 390) ?? [],
  };
  audit.boot.comparison = {
    status: 'unavailable',
    reason: 'baseline frame arrays were truncated and baseline environment did not preserve a comparable frame dataset',
    readyMs: samples.map(sample => sample.readyMs),
    baselineReadyMs: audit.boot.baseline.samples.map(sample => sample.readyMs),
    registeredArtCount: samples.map(sample => sample.registry.registeredCount),
    baselineRegisteredArtCount: baseline.ritualSourceCount,
    sourcePixels: samples.map(sample => sample.registry.ritualSourcePixels),
    baselineSourcePixels: baseline.sourcePixels,
  };
  if (samples.some(sample => sample.errors.length || sample.networkErrors.length)) fail('boot-samples', 'fresh boot produced console/network errors', samples);
  if (samples.some(sample => sample.registry.registeredCount !== 9 || sample.registry.ritualSourceCount !== 9)) fail('boot-samples', 'runtime registry did not expose nine v2 sources', samples.map(sample => sample.registry));
}

async function runProductMatrix() {
  for (const viewport of viewports) {
    const fixture = await newFixture(viewport, 'reduce', 'seeded-product', { headingInstrumentation: viewport.width === 390 });
    try {
      const registry = await collectRuntimeRegistry(fixture.page);
      registry.ritualSourceBytes = audit.sourceAssets.reduce((sum, source) => sum + source.bytes, 0);
      if (!audit.registry) audit.registry = registry;
      const sourceAlpha = await collectSourceAlpha(fixture.page);
      if (!audit.sourceAlpha) audit.sourceAlpha = sourceAlpha;
      const home = await capture(fixture, 'home', 'seeded product Home; actual HomeRoomCards sprite path');
      const homeScene = home.scenes.find(scene => scene.key === 'DungeonHomeScene');
      const homeSprite = homeScene?.images.find(image => image.texture === 'sprite-ritual-v2-dokkaebi_warrior');
      audit.geometry.push({ case: 'Home', viewport, source: homeSprite?.source ?? null, display: homeSprite?.display ?? null, expected: { source: [96, 96], display: [42, 42] } });
      if (!homeSprite || homeSprite.source?.width !== 96 || homeSprite.source?.height !== 96 || homeSprite.display?.width !== 42 || homeSprite.display?.height !== 42) fail('Home geometry', 'actual Home v2 sprite did not meet 96/42', homeSprite);
      await runNavigation(fixture, home);
      const gallery = await runGallery(fixture, 'none');
      audit.geometry.push({ case: 'gallery', viewport, records: gallery });
      audit.save.push({ case: 'gallery', fixture: 'seeded-product', storageNeutral: true, note: 'scene-assisted renderers do not call saveGameState' });
      const galleryCapture = await capture(fixture, 'gallery', 'scene-assisted five-art production gallery and both room consumers');
      audit.input.push({ case: 'gallery', noInteractivePortraitTargets: gallery.every(record => record.portraits.every(portrait => !portrait.input)) });
      if (gallery.some(record => record.portraits.some(portrait => portrait.input))) fail('gallery', 'quest/gallery portrait helper created an input target', gallery);
      // Capture a fresh Quest folio at each product viewport after returning to Home.
      await switchScene(fixture.page, 'DungeonHomeScene');
      await runQuestCase(fixture, 'quest-mq008', 'seeded-mq008');
      const questResolver = await runQuestResolver(fixture.page);
      audit.quest.resolver.push({ viewport, fixture: 'seeded-mq008', resolver: questResolver });
      audit.input.push({ case: 'quest-speaker-resolver', fixture: 'seeded-mq008', resolver: questResolver });
      if (viewport.width === 390) {
        const heading = await fixture.page.evaluate(() => {
          const calls = [...(window.__characterB1HeadingFillTextCalls ?? [])];
          window.__characterB1RestoreHeadingFillText?.();
          return { calls, restored: true };
        });
        audit.quest.headingRegression.push({ viewport, ...heading });
        if (heading.calls.some(call => call.loneSurrogate)) fail('quest-heading-surrogate', 'main quest heading emitted lone surrogate fillText input', heading);
      }
      audit.save.push({ case: 'quest-mq008', preparationWrite: audit.save.at(-1)?.preparationWrite ?? null, note: 'legitimate sub/daily preparation is reported separately from close neutrality' });
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
  for (const [kind, name] of [['seeded-long', 'quest-long'], ['seeded-no-active', 'quest-no-active']]) {
    const fixture = await newFixture({ width: 390, height: 844 }, 'reduce', kind);
    try {
      const questCapture = await runQuestCase(fixture, name, kind);
      const scene = questCapture.scenes.find(item => item.key === 'DungeonHomeScene');
      if (!scene || scene.fixedOverflow.length) fail(name, 'quest edge-case text overflow', scene?.fixedOverflow ?? null);
      const text = scene?.texts?.map(entry => entry.text).filter(Boolean).join('\n') ?? '';
      if (kind === 'seeded-no-active' && !text.includes('진행 중인 메인 퀘스트 없음')) fail(name, 'no-active quest text was not visible', text);
      if (kind === 'seeded-long' && !text.includes('전설의 던전 마스터')) fail(name, 'long-title/objective fixture text was not visible', text);
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
      const records = await runGallery(fixture, missing);
      audit.fallback.push({
        case: missing, fixture: `source-admission-fault-${missing}`,
        provenance: 'artificial source-admission fault; derived caches cleared before source removal; not natural asset absence',
        records, saveNeutral: before === await storage(fixture.page),
      });
      await capture(fixture, `fallback-${missing}`, 'source-admission fault; both source textures absent, procedural 48/60 path');
      const fallbackRecord = records.find(record => record.id === 'sage');
      if (!fallbackRecord || fallbackRecord.sprite.source?.[0] !== 48 || fallbackRecord.sprite.display?.[0] !== 60) fail(`fallback-${missing}`, 'procedural fallback did not observe 48px source / 60px display', fallbackRecord);
      if (missing === 'both' && records.some(record => record.token.key !== null)) fail(`fallback-${missing}`, 'both-source-missing fallback still produced a room token', records);
      if (missing === 'v2' && records.some(record => record.source?.version !== 'legacy' || record.token.key !== `roomtoken-${record.id}`)) fail(`fallback-${missing}`, 'v2-source-admission fallback did not use actual legacy source/token path', records);
      if (before !== await storage(fixture.page)) fail(`fallback-${missing}`, 'fallback renderer changed storage');
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
    if (source.width !== 512 || source.height !== 512 || source.maxAlpha < 250
      || source.fullyTransparentFraction < 0.3 || source.fullyTransparentFraction > 0.85
      || Math.min(...source.margins) < 42) fail(`alpha-${source.id}`, 'actual alpha/margin gate', source);
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
