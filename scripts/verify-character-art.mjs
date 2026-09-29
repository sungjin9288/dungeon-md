// Character-art acceptance: isolated saves, production renderers and labelled fixtures.
// GAME_URL=http://127.0.0.1:8083 HEADED=1 node scripts/verify-character-art.mjs
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const base = process.env.GAME_URL ?? 'http://127.0.0.1:8083';
const ids = ['dokkaebi_warrior', 'gumiho_guardian', 'death_messenger', 'mountain_spirit'];
const sizes = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
const hash = value => createHash('sha256').update(value).digest('hex');
const audit = {
  generatedAt: new Date().toISOString(), base,
  scope: 'Four of 136 guardian artworks only. Three-viewport DPR2 rendering. Seeded product views are not an organic acquisition/campaign playthrough. Gallery, mirrored dialogue and supplied SummonResult are explicitly scene-assisted renderer fixtures and do not award inventory or rewards.',
  sources: [], sourceHashes: {}, captures: [], contactSheets: [], receipts: [], lifecycle: [], fallback: [], failures: [],
  knownObservations: [
    { scope: 'Existing Home decorative route-order marker, not monster-level text', source: 'src/scenes/HomeBoardRoute.ts:521', observation: 'String(routeOrder) is 8px at alpha0.66. Retained outside this four-art presentation change; not a claim of zero sub10px text everywhere.' },
    { scope: 'Home world-sprite resolution', source: 'src/art/PortraitGenerator.ts', observation: 'Existing 48px bake is softer when magnified by DPR2. Silhouette/source integration is verified; higher-density world sprites remain a follow-up, distinct from 96px room tokens and 512px cinematic sources.' },
  ],
};
await mkdir(resolve(root, 'tools/screenshots'), { recursive: true });
for (const path of ['src/data/characterArt.ts', 'src/art/PortraitGenerator.ts', 'src/ui/MonsterPortraitView.ts', 'src/scenes/BootScene.ts', 'src/scenes/CinematicScene.ts', 'src/scenes/HomeRoomCards.ts', 'src/ui/RoomSlotRenderer.ts', 'src/ui/SummonAnimations.ts', 'scripts/verify-character-art.mjs']) {
  audit.sourceHashes[path] = hash(await readFile(resolve(root, path)));
}
for (const id of ids) {
  // Runtime cutouts are WebP with alpha since §38 (VP8X header, alpha flag 0x10).
  const path = `public/assets/monsters/ritual-v2/${id}.webp`;
  const data = await readFile(resolve(root, path));
  const isWebp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 16) === 'WEBPVP8X';
  const source = { id, path, bytes: data.length, sha256: hash(data), format: isWebp ? 'webp' : 'unknown', width: isWebp ? 1 + data.readUIntLE(24, 3) : 0, height: isWebp ? 1 + data.readUIntLE(27, 3) : 0, alpha: isWebp && (data[20] & 0x10) === 0x10 };
  audit.sources.push(source);
  if (!isWebp || source.width !== 512 || source.height !== 512 || !source.alpha || source.bytes > 512 * 1024) audit.failures.push({ case: id, reason: 'source dimensions/alpha/size gate', source });
}

const browser = await chromium.launch({ headless: process.env.HEADED === '0' });

async function open(viewport, scene = 'DungeonHomeScene', motion = 'reduce') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: motion });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(monsterIds => localStorage.setItem('dungeonGameState', JSON.stringify({
    tutorialStage: 99, dmLevel: 1, lastIdleCollect: Date.now(), homeGold: 200,
    activeMainQuestId: 'MQ-003', questProgress: { 'MQ-003': { completed: false, objectives: { O1: 0 } } },
    ownedMonsters: monsterIds.map(id => ({ id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null })),
    dungeonSlots: [{ roomType: 'combat', monsterIds: ['dokkaebi_warrior'], trapIds: [], roomLevel: 1, hp: 100, maxHp: 100 }],
  })), ids);
  await page.goto(`${base}/?skipTutorial=1&scene=${scene}`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(key => window.__phaserGame?.renderer?.type === 2 && window.__phaserGame.scene.isActive(key), scene);
  } catch (error) {
    const observed = await page.evaluate(() => ({ renderer: window.__phaserGame?.renderer?.type, active: window.__phaserGame?.scene.getScenes(true).map(s => s.scene.key) }));
    throw new Error(`Entry ${scene}: ${error}; ${JSON.stringify({ observed, errors })}`);
  }
  // Ritual-v2 cutouts stream on demand (CharacterArtStreamer), not at boot.
  await page.evaluate(async artIds => {
    const { getCharacterArtStreamer } = await import('/src/art/CharacterArtStreamer.ts');
    getCharacterArtStreamer(window.__phaserGame).request(artIds);
  }, ids);
  await page.waitForFunction(artIds => artIds.every(id => window.__phaserGame.textures.exists(`monster-ritual-v2-${id}`)), ids);
  await page.waitForTimeout(700);
  return { context, page, errors };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__phaserGame, dpr = window.__gameDpr;
    const all = [];
    const round = n => Math.round(n * 100) / 100;
    const rect = b => ({ x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) });
    const scenes = game.scene.getScenes(true).map(scene => {
      const camera = scene.cameras.main;
      const entries = [];
      const walk = (object, shown = true, opacity = 1, sx = 1, sy = 1, scrolling = false) => {
        scrolling ||= object === scene.contentContainer && scene.maxScrollY > 0;
        shown = shown && object.visible !== false && !(object.cameraFilter & camera.id);
        opacity *= object.alpha ?? 1;
        sx *= object.scrollFactorX ?? 1; sy *= object.scrollFactorY ?? 1;
        if (object.getBounds && (object.type === 'Image' || object.type === 'Text' || object.input?.enabled)) {
          const world = object.getBounds();
          const pts = [[world.x, world.y], [world.right, world.y], [world.right, world.bottom], [world.x, world.bottom]].map(([x, y]) => camera.matrix.transformPoint(x - camera.scrollX * sx, y - camera.scrollY * sy));
          const xs = pts.map(p => p.x / dpr), ys = pts.map(p => p.y / dpr);
          const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
          const inViewport = bounds.x + bounds.width > 0 && bounds.x < 390 && bounds.y + bounds.height > 0 && bounds.y < 844;
          const matrix = object.getWorldTransformMatrix();
          entries.push({ type: object.type, name: object.name, text: object.text ?? null, texture: object.texture?.key ?? null, visible: shown && opacity > 0.09 && inViewport, alpha: round(opacity), bounds: rect(bounds), fontSize: parseFloat(object.style?.fontSize ?? '0') * Math.hypot(matrix.a, matrix.b) * camera.zoom / dpr, input: Boolean(object.input?.enabled), hit: object.input?.hitArea ? { width: object.input.hitArea.width ?? 2 * object.input.hitArea.radius, height: object.input.hitArea.height ?? 2 * object.input.hitArea.radius } : null, scrollable: scrolling || (camera._bounds?.height > 844 && sy !== 0) });
        }
        if (Array.isArray(object.list)) object.list.forEach(child => walk(child, shown, opacity, sx, sy, scrolling));
      };
      scene.children.list.forEach(o => walk(o));
      all.push(...entries);
      const texts = entries.filter(e => e.visible && e.type === 'Text');
      const inputs = entries.filter(e => e.visible && e.input);
      return { key: scene.scene.key, children: scene.children.list.length, inputs: inputs.length, images: entries.filter(e => e.visible && e.type === 'Image'), textBelow10: texts.filter(e => e.fontSize < 9.9), fixedOverflow: texts.filter(e => !e.scrollable && (e.bounds.x < -0.5 || e.bounds.y < -0.5 || e.bounds.x + e.bounds.width > 390.5 || e.bounds.y + e.bounds.height > 844.5)), under44: inputs.filter(e => e.hit?.width < 44 || e.hit?.height < 44), inputObjects: inputs, texts, timers: scene.time._active.length, tweens: scene.tweens.getTweens().length, listeners: { pointerdown: scene.input.listenerCount('pointerdown'), wheel: scene.input.listenerCount('wheel'), drag: scene.input.listenerCount('drag') } };
    });
    const canvas = game.canvas.getBoundingClientRect();
    return { renderer: game.renderer.type, dpr, gameText: window.render_game_to_text?.() ?? null, logical: { width: game.canvas.width / dpr, height: game.canvas.height / dpr }, canvasCss: rect(canvas), scenes, textures: [...new Set(all.filter(e => e.visible && e.texture).map(e => e.texture))] };
  });
}

async function capture(fixture, name, kind) {
  const { page, errors } = fixture;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await snapshot(page);
  const viewport = page.viewportSize();
  const path = `tools/screenshots/character-art-${name}-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: resolve(root, path) });
  const data = await readFile(resolve(root, path));
  audit.captures.push({ name, kind, viewport, ...state, path, pngPixels: { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }, sha256: hash(data), errors: [...errors] });
  if (errors.length || state.renderer !== 2 || state.dpr !== 2) audit.failures.push({ case: name, reason: 'render/console gate', errors });
  if (state.logical.width !== 390 || state.logical.height !== 844 || data.readUInt32BE(16) !== viewport.width * 2 || data.readUInt32BE(20) !== viewport.height * 2) audit.failures.push({ case: name, reason: 'logical canvas/DPR screenshot gate' });
  return state;
}
async function storage(page) { return page.evaluate(() => localStorage.getItem('dungeonGameState')); }
async function click(page, x, y) {
  const b = await page.locator('canvas').first().boundingBox();
  await page.mouse.move(b.x + x * b.width / 390, b.y + y * b.height / 844);
  await page.waitForTimeout(30); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(210);
}
async function switchScene(page, key, data) {
  await page.evaluate(({ key, data }) => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    game.scene.start(key, data);
  }, { key, data });
  await page.waitForFunction(key => window.__phaserGame.scene.isActive(key), key);
  await page.waitForTimeout(300);
}

async function gallery(fixture, missing = 'none') {
  return fixture.page.evaluate(async ({ ids, missing }) => {
    const { addMonsterPortrait, setMonsterPortraitAlpha } = await import('/src/ui/MonsterPortraitView.ts');
    const { generateRoomToken, generateMonsterSprite, generatePortrait } = await import('/src/art/PortraitGenerator.ts');
    const { selectCharacterArtSource } = await import('/src/data/characterArt.ts');
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    if (missing !== 'none') {
      for (const id of ids) {
        for (const key of [`monster-ritual-v2-${id}`, `portrait-ritual-v2-${id}`, `roomtoken-ritual-v2-${id}`, `sprite-ritual-v2-${id}`, `portrait-${id}`, `roomtoken-${id}`]) if (game.textures.exists(key)) game.textures.remove(key);
        if (missing === 'both' && game.textures.exists(`monster-ai-${id}`)) game.textures.remove(`monster-ai-${id}`);
      }
    }
    const receipts = [];
    game.scene.add('CharacterArtQa', {
      create() {
        this.cameras.main.setZoom(window.__gameDpr).centerOn(195, 422).setBackgroundColor(0x080c0e);
        this.add.text(14, 14, `Character renderer · ${missing}`, { fontSize: '19px', color: '#eee1c6' });
        this.add.text(14, 42, 'Scene-assisted fixture · no inventory/reward mutation', { fontSize: '11px', color: '#97a5a1' });
        const xs = [28, 77, 137, 231, 340], sizes = [24, 46, 64, 104, 64];
        xs.forEach((x, i) => this.add.text(x, 63, i === 4 ? '0.35 alpha' : String(sizes[i]), { fontSize: '10px', color: '#bfaa74' }).setOrigin(0.5));
        ids.forEach((id, row) => {
          const cy = 150 + row * 180;
          this.add.text(14, cy - 66, id, { fontSize: '11px', color: '#ddc48f' });
          const source = selectCharacterArtSource(id, key => this.textures.exists(key));
          const portraits = xs.map((x, i) => {
            const refs = addMonsterPortrait(this, null, x, cy, id, { size: sizes[i] });
            if (i === 4) setMonsterPortraitAlpha(refs, 0.35);
            return { size: sizes[i], key: refs.image?.texture.key, imageWidth: refs.image?.displayWidth, hasBadges: Boolean(refs.roleCue && refs.elementCue), alphas: Object.fromEntries(Object.entries(refs).filter(([, object]) => object).map(([key, object]) => [key, object.alpha])), inputAdded: Object.values(refs).some(object => object?.input?.enabled) };
          });
          const token = generateRoomToken(this, id), sprite = generateMonsterSprite(this, id);
          if (token) this.add.image(42, cy + 75, token).setDisplaySize(46, 46);
          this.add.text(72, cy + 67, token ? 'Room token 46' : 'Token → sprite fallback', { fontSize: '10px', color: '#8da59b' });
          this.add.image(240, cy + 75, sprite).setDisplaySize(46, 46);
          this.add.text(270, cy + 67, 'Home sprite 46', { fontSize: '10px', color: '#8da59b' });
          const generatedPortrait = generatePortrait(this, id);
          const dimensions = key => { const image = key && this.textures.get(key).getSourceImage(); return image ? [image.width, image.height] : null; };
          const skinId = 'qa-explicit-skin';
          const skinPortrait = generatePortrait(this, id, skinId);
          receipts.push({ id, source, portraits, token, sprite, generatedPortrait, dimensions: { portrait: dimensions(generatedPortrait), token: dimensions(token), sprite: dimensions(sprite) }, skinSource: selectCharacterArtSource(id, key => this.textures.exists(key), skinId), skinPortrait, skinDimensions: dimensions(skinPortrait) });
        });
      },
    }, true);
    return receipts;
  }, { ids, missing });
}

try {
  for (const viewport of sizes) {
    if (process.env.ART_WIDTHS && !process.env.ART_WIDTHS.split(',').includes(String(viewport.width))) continue;
    const fixture = await open(viewport);
    try {
      const { page } = fixture;
      if (!audit.sourceAlpha) audit.sourceAlpha = await page.evaluate(ids => ids.map(id => {
        const source = window.__phaserGame.textures.get(`monster-ritual-v2-${id}`).getSourceImage();
        const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0);
        const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = 0, partial = 0, opaque = 0, maxAlpha = 0, minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
        for (let pixel = 0; pixel < canvas.width * canvas.height; pixel++) {
          const alpha = bytes[pixel * 4 + 3], x = pixel % canvas.width, y = Math.floor(pixel / canvas.width);
          if (alpha === 0) transparent++; else if (alpha < 255) partial++;
          if (alpha >= 250) opaque++;
          maxAlpha = Math.max(maxAlpha, alpha);
          if (alpha > 8) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
        }
        return { id, width: canvas.width, height: canvas.height, maxAlpha, alphaAtLeast250Fraction: opaque / (canvas.width * canvas.height), fullyTransparentFraction: transparent / (canvas.width * canvas.height), partialAlphaFraction: partial / (canvas.width * canvas.height), alphaOver8Bounds: { minX, minY, maxX, maxY }, marginFractions: { left: minX / canvas.width, top: minY / canvas.height, right: (canvas.width - 1 - maxX) / canvas.width, bottom: (canvas.height - 1 - maxY) / canvas.height } };
      }), ids);
      const home = await capture(fixture, 'home-inhabited', 'seeded product view');
      if (!home.textures.includes('sprite-ritual-v2-dokkaebi_warrior')) audit.failures.push({ case: 'home', reason: 'v2 world sprite not visible' });
      const before = await storage(page);
      await click(page, 146.25, 808);
      await page.waitForFunction(() => window.__phaserGame.scene.isActive('BarracksScene'));
      audit.receipts.push({ case: 'Home→Barracks real root input', viewport, saveNeutral: before === await storage(page) });
      await capture(fixture, 'barracks', 'seeded product view via real root navigation');
      const preDetail = await storage(page);
      await click(page, 254, 204);
      await capture(fixture, 'detail', 'product detail opened by real growth CTA');
      audit.receipts.push({ case: 'detail opening', viewport, saveNeutral: preDetail === await storage(page) });
      await click(page, 349, 41);
      audit.receipts.push({ case: 'detail close real input', viewport, saveNeutral: preDetail === await storage(page), closed: await page.evaluate(() => !window.__phaserGame.scene.getScene('BarracksScene').detailOverlay) });
      for (const key of ['CodexScene', 'ForgeScene', 'FusionScene']) {
        await switchScene(page, key);
        if (key === 'FusionScene') {
          const beforePick = await storage(page);
          await click(page, 86, 390);
          await capture(fixture, 'fusion-picker', 'product picker opened by real input');
          const options = await snapshot(page);
          const pick = options.scenes.flatMap(s => s.inputObjects).find(e => e.bounds.width > 65 && e.bounds.width < 110 && e.bounds.y > 400 && e.bounds.height >= 70);
          if (!pick) throw new Error('Fusion picker target not found');
          await click(page, pick.bounds.x + pick.bounds.width / 2, pick.bounds.y + pick.bounds.height / 2);
          audit.receipts.push({ case: 'Fusion source selection', viewport, saveNeutral: beforePick === await storage(page) });
        }
        await capture(fixture, key.replace('Scene', '').toLowerCase(), 'seeded product renderer');
      }
      await switchScene(page, 'SummonScene');
      const beforeReveal = await storage(page);
      await page.evaluate(async () => {
        const { playSinglePullAnimation } = await import('/src/ui/SummonAnimations.ts');
        playSinglePullAnimation(window.__phaserGame.scene.getScene('SummonScene'), { monsterId: 'dokkaebi_warrior', rarity: 'common', rarityIdx: 0, isNew: false, scComp: 0, ceilingHit: false }, () => { window.__artRevealClosed = true; });
      });
      await page.waitForFunction(() => {
        const scene = window.__phaserGame.scene.getScene('SummonScene');
        const overlay = scene.children.list.find(object => object.type === 'Container' && object.depth === 100);
        return overlay?.list.some(object => object.text === '소환 제단으로' && object.alpha === 1);
      });
      const reveal = await capture(fixture, 'summon-result', 'scene-assisted supplied SummonResult; no draw/award transaction');
      if (!reveal.textures.includes('portrait-ritual-v2-dokkaebi_warrior')) audit.failures.push({ case: 'summon', reason: 'v2 reveal texture absent' });
      audit.receipts.push({ case: 'supplied result render', viewport, saveNeutral: beforeReveal === await storage(page) });
      await click(page, 195, 538);
      audit.receipts.push({ case: 'supplied result close real input', viewport, saveNeutral: beforeReveal === await storage(page), closed: await page.evaluate(() => window.__artRevealClosed === true) });

      for (const [name, cinematicId, index] of [['mountain-left', 'ch1_opening', 0], ['dokkaebi-right', 'ch1_opening', 2], ['gumiho-right', 'ch2_opening', 0], ['dokkaebi-left', 'ch2_opening', 2], ['messenger-left', 'ch4_opening', 0], ['unknown-left', 'stage10_boss_intro', 0], ['unknown-right', 'stage20_boss_intro', 0]]) {
        await switchScene(page, 'CinematicScene', { cinematicId, nextScene: 'BarracksScene' });
        const entered = await storage(page);
        for (let i = 0; i < index; i++) await click(page, 195, 764);
        const state = await capture(fixture, `story-${name}`, 'canonical story definition with actual next input');
        const receipt = await page.evaluate(() => {
          const scene = window.__phaserGame.scene.getScene('CinematicScene');
          return { index: scene.lineIndex, line: scene.lines[scene.lineIndex], artVisible: scene.speakerArt.visible, artKey: scene.speakerArt.texture.key, artX: scene.speakerArt.x, artSize: [scene.speakerArt.displayWidth, scene.speakerArt.displayHeight], emojiVisible: scene.speakerEmoji.visible, phase: scene.phase };
        });
        audit.receipts.push({ case: `story-${name}`, viewport, ...receipt, saveNeutralAfterEntry: entered === await storage(page) });
        if (name.startsWith('unknown') ? receipt.artVisible || !receipt.emojiVisible : !receipt.artVisible || !receipt.artKey.startsWith('monster-ritual-v2-')) audit.failures.push({ case: name, reason: 'speaker source/fallback gate', receipt });
        if (state.scenes.some(s => s.fixedOverflow.length || s.under44.length || s.textBelow10.length)) audit.failures.push({ case: name, reason: 'cinematic layout minimum gate' });
        await click(page, 318, 48);
        await page.waitForFunction(() => window.__phaserGame.scene.isActive('BarracksScene'));
        audit.receipts.push({ case: `story-${name} skip`, viewport, saveNeutralAfterEntry: entered === await storage(page) });
      }
      await switchScene(page, 'BarracksScene');
      const signatures = [];
      for (let i = 0; i < 3; i++) {
        await switchScene(page, 'BarracksScene');
        const s = (await snapshot(page)).scenes[0];
        signatures.push({ children: s.children, inputs: s.inputs, timers: s.timers, tweens: s.tweens, listeners: s.listeners, textures: s.images.map(image => image.texture) });
      }
      audit.lifecycle.push({ viewport, scene: 'BarracksScene', signatures, stable: signatures.every(s => JSON.stringify(s) === JSON.stringify(signatures[0])) });
      const preGallery = await storage(page);
      const receipts = await gallery(fixture);
      await page.waitForTimeout(150);
      await capture(fixture, 'gallery', 'scene-assisted actual addMonsterPortrait / RoomToken / Home sprite matrix');
      audit.receipts.push({ case: 'gallery', viewport, portraits: receipts, saveNeutral: preGallery === await storage(page) });
    } finally { await fixture.context.close(); }
  }

  if (!process.env.ART_WIDTHS || process.env.ART_WIDTHS.split(',').includes('390')) {
    const normal = await open({ width: 390, height: 844 }, 'BarracksScene', 'no-preference');
    try {
      for (const [name, cinematicId, index] of [['mountain', 'ch1_opening', 0], ['dokkaebi', 'ch1_opening', 2], ['gumiho', 'ch2_opening', 0], ['messenger', 'ch4_opening', 0]]) {
        await switchScene(normal.page, 'CinematicScene', { cinematicId, nextScene: 'BarracksScene' });
        const entered = await storage(normal.page);
        for (let line = 0; line <= index; line++) {
          await normal.page.waitForFunction(() => window.__phaserGame.scene.getScene('CinematicScene').phase === 'ready');
          if (line < index) await click(normal.page, 195, 764);
        }
        const state = await capture(normal, `normal-${name}`, 'normal-motion canonical story; real timer reveal and next input');
        const observed = await normal.page.evaluate(() => { const s = window.__phaserGame.scene.getScene('CinematicScene'); return { reducedMotion: s.reducedMotion, line: s.lines[s.lineIndex], artKey: s.speakerArt.texture.key, artVisible: s.speakerArt.visible, emojiVisible: s.speakerEmoji.visible, phase: s.phase }; });
        audit.receipts.push({ case: `normal-${name}`, ...observed, saveNeutralAfterEntry: entered === await storage(normal.page) });
        if (observed.reducedMotion || observed.phase !== 'ready' || !observed.artVisible || observed.emojiVisible || !observed.artKey.startsWith('monster-ritual-v2-')) audit.failures.push({ case: name, reason: 'normal-motion speaker gate' });
        if (state.scenes.some(s => s.fixedOverflow.length || s.under44.length || s.textBelow10.length)) audit.failures.push({ case: name, reason: 'normal-motion layout gate' });
        // Only presentation side changes in this explicit fixture, never canonical definitions.
        await normal.page.evaluate(() => { const s = window.__phaserGame.scene.getScene('CinematicScene'); s.lines = s.lines.map((line, i) => i === s.lineIndex ? { ...line, side: line.side === 'left' ? 'right' : 'left' } : line); s.showLine(s.lineIndex); });
        await normal.page.waitForFunction(() => window.__phaserGame.scene.getScene('CinematicScene').phase === 'ready');
        const mirrored = await capture(normal, `mirrored-${name}`, 'scene-assisted opposite-side display only; copied line, unchanged canonical definition');
        audit.receipts.push({ case: `mirrored-${name}`, saveNeutralAfterEntry: entered === await storage(normal.page), art: mirrored.scenes.flatMap(s => s.images).find(image => image.name === 'cinematic-speaker-art') });
        await click(normal.page, 318, 48);
        await normal.page.waitForFunction(() => window.__phaserGame.scene.isActive('BarracksScene'));
        audit.receipts.push({ case: `normal-${name} skip`, saveNeutralAfterEntry: entered === await storage(normal.page) });
      }
      const signatures = [];
      for (let i = 0; i < 3; i++) {
        await switchScene(normal.page, 'CinematicScene', { cinematicId: 'ch1_opening', nextScene: 'BarracksScene' });
        await normal.page.waitForFunction(() => window.__phaserGame.scene.getScene('CinematicScene').phase === 'ready');
        const s = (await snapshot(normal.page)).scenes[0];
        signatures.push({ children: s.children, inputs: s.inputs, timers: s.timers, tweens: s.tweens, listeners: s.listeners, textures: s.images.map(image => image.texture) });
        await click(normal.page, 318, 48);
        await normal.page.waitForFunction(() => window.__phaserGame.scene.isActive('BarracksScene'));
      }
      audit.lifecycle.push({ viewport: { width: 390, height: 844 }, scene: 'CinematicScene', motion: 'normal', signatures, stable: signatures.every(s => JSON.stringify(s) === JSON.stringify(signatures[0])) });
    } finally { await normal.context.close(); }
    for (const missing of ['v2', 'both']) {
      const fixture = await open({ width: 390, height: 844 });
      try {
        const before = await storage(fixture.page);
        const receipts = await gallery(fixture, missing);
        await fixture.page.waitForTimeout(150);
        await capture(fixture, `fallback-${missing}`, 'fault injection removes real source and generated cache textures before invoking actual renderers');
        audit.fallback.push({ missing, receipts, saveNeutral: before === await storage(fixture.page) });
        await switchScene(fixture.page, 'CinematicScene', { cinematicId: 'ch1_opening', nextScene: 'BarracksScene' });
        await capture(fixture, `story-fallback-${missing}`, 'canonical story after same actual texture-removal fault');
        const story = await fixture.page.evaluate(() => { const scene = window.__phaserGame.scene.getScene('CinematicScene'); return { artVisible: scene.speakerArt.visible, artKey: scene.speakerArt.texture.key, emojiVisible: scene.speakerEmoji.visible }; });
        audit.fallback[audit.fallback.length - 1].story = story;
      } finally { await fixture.context.close(); }
    }
  }
  // Review sheets only combine the actual captured browser PNGs, never fake scenes.
  const sheetPage = await browser.newPage({ viewport: { width: 820, height: 980 }, deviceScaleFactor: 1 });
  for (let start = 0; start < audit.captures.length; start += 8) {
    const batch = audit.captures.slice(start, start + 8);
    const cards = await Promise.all(batch.map(async c => `<figure><figcaption>${c.name} · ${c.viewport.width}</figcaption><img src="data:image/png;base64,${(await readFile(resolve(root, c.path))).toString('base64')}"></figure>`));
    await sheetPage.setContent(`<style>body{margin:0;padding:8px;background:#252a28;color:white;font:10px sans-serif;display:grid;grid-template-columns:repeat(4,195px);gap:8px}figure{margin:0}figcaption{height:24px}img{width:195px;max-height:455px;object-fit:contain;display:block}</style>${cards.join('')}`);
    await sheetPage.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    const path = `tools/screenshots/character-art-contact-${String(start / 8 + 1).padStart(2, '0')}.png`;
    await sheetPage.screenshot({ path: resolve(root, path), fullPage: true });
    const bytes = await readFile(resolve(root, path));
    audit.contactSheets.push({ path, sha256: hash(bytes), captures: batch.map(c => c.path) });
  }
  await sheetPage.close();
} catch (error) {
  audit.failures.push({ reason: String(error) });
  process.stderr.write(`${error}\n`);
} finally {
  await browser.close();
  audit.sourceDrift = [];
  for (const [path, initial] of Object.entries(audit.sourceHashes)) if (hash(await readFile(resolve(root, path))) !== initial) audit.sourceDrift.push(path);
  for (const source of audit.sources) if (hash(await readFile(resolve(root, source.path))) !== source.sha256) audit.sourceDrift.push(source.path);
  for (const source of audit.sourceAlpha ?? []) {
    if (source.fullyTransparentFraction < 0.3 || source.fullyTransparentFraction > 0.85 || Math.min(...Object.values(source.marginFractions)) < 42 / 512 || source.maxAlpha < 250) audit.failures.push({ case: source.id, reason: 'actual source alpha/safe-margin gate', source });
  }
  for (const receipt of audit.receipts) {
    if (receipt.saveNeutral === false || receipt.saveNeutralAfterEntry === false || receipt.closed === false) audit.failures.push({ case: receipt.case, reason: 'save-neutral/input-close gate', viewport: receipt.viewport });
  }
  function validateGallery(receipts, missing) {
    for (const r of receipts) {
      const version = missing === 'none' ? 'ritual-v2' : missing === 'v2' ? 'legacy' : null;
      const expectedPortrait = missing === 'none' ? `portrait-ritual-v2-${r.id}` : `portrait-${r.id}`;
      const expectedToken = missing === 'none' ? `roomtoken-ritual-v2-${r.id}` : missing === 'v2' ? `roomtoken-${r.id}` : null;
      const expectedSprite = missing === 'none' ? `sprite-ritual-v2-${r.id}` : `sprite-${r.id}`;
      const badPortrait = r.portraits.some((p, i) => p.key !== expectedPortrait || p.imageWidth !== p.size - 8 || p.hasBadges !== (p.size >= 34) || p.inputAdded || Object.values(p.alphas).some(a => Math.abs(a - (i === 4 ? 0.35 : 1)) > 0.001));
      if ((r.source?.version ?? null) !== version || r.token !== expectedToken || r.sprite !== expectedSprite || r.generatedPortrait !== expectedPortrait || badPortrait || r.dimensions.portrait[0] !== (missing === 'both' ? 64 : 256) || r.skinSource !== null || r.skinDimensions[0] !== 64) audit.failures.push({ case: `gallery-${missing}-${r.id}`, reason: 'actual source/portrait/badges/alpha/skin/fallback gate', receipt: r });
    }
  }
  for (const receipt of audit.receipts.filter(r => r.case === 'gallery')) validateGallery(receipt.portraits, 'none');
  for (const receipt of audit.fallback) {
    validateGallery(receipt.receipts, receipt.missing);
    const story = receipt.story;
    if (!receipt.saveNeutral || (receipt.missing === 'v2' ? !story.artVisible || story.emojiVisible || story.artKey !== 'monster-ai-mountain_spirit' : story.artVisible || !story.emojiVisible)) audit.failures.push({ case: `fallback-${receipt.missing}`, reason: 'save/fallback story gate', receipt });
  }
  const portraitCases = ['barracks', 'detail', 'codex', 'forge', 'fusion', 'summon-result'];
  for (const c of audit.captures.filter(c => portraitCases.includes(c.name))) if (!c.textures.includes('portrait-ritual-v2-dokkaebi_warrior')) audit.failures.push({ case: c.name, reason: 'product portrait-source gate', viewport: c.viewport });
  audit.summary = { captures: audit.captures.length, contactSheets: audit.contactSheets.length, failures: audit.failures.length, consoleErrors: audit.captures.reduce((n, r) => n + r.errors.length, 0), lifecycleStable: audit.lifecycle.every(r => r.stable), sourceDrift: audit.sourceDrift.length, existingSmallTextObservations: audit.captures.flatMap(c => c.scenes.flatMap(s => s.textBelow10)).length };
  await writeFile(resolve(root, 'tools/character-art-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
}
console.log(JSON.stringify(audit.summary));
if (audit.failures.length || audit.sourceDrift.length || audit.lifecycle.some(r => !r.stable)) process.exitCode = 1;
