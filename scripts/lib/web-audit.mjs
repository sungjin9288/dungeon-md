// Shared browser-audit primitives for the verify-* harnesses.
//
// Extracted verbatim from verify-web-surfaces.mjs so that surface audits and
// modal-state audits measure geometry the same way. If these two drifted, their
// overflow/target numbers would stop being comparable, which is the whole point
// of reporting them against one 390x844 logical frame.
//
// Geometry method: world bounds are transformed by the actual camera matrix and
// cumulative container scroll factors, then divided by DPR. That is what keeps a
// `scrollFactor: 0` element (pinned bottom navigation) from being mis-reported as
// out of view when the camera is scrolled.

/**
 * Build a scene opener bound to a launched browser and a base URL.
 * @param {{ browser: import('playwright').Browser, base: string }} deps
 */
export function createSceneOpener({ browser, base }) {
  /**
   * @param {object} [options]
   * @param {object} [options.seed] extra GameState fields merged into the starter
   *   save. Resource-gated confirm/result layers are unreachable on the default
   *   zero-currency fixture, so an audit that needs them seeds only what that
   *   layer requires. The merge still goes through loadGameState migration.
   */
  return async function openScene(scene, viewport, fixedDate, options = {}) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await context.newPage();
    if (fixedDate) await page.clock.setFixedTime(new Date(fixedDate));
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', text: message.text() }); });
    page.on('pageerror', error => errors.push({ type: 'pageerror', text: String(error) }));
    await page.addInitScript(seed => {
      localStorage.setItem('dungeonGameState', JSON.stringify({ tutorialStage: 99, lastIdleCollect: Date.now(), ...seed }));
    }, options.seed ?? {});
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
  };
}

export async function inventory(page) {
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

export async function storage(page) {
  return page.evaluate(() => localStorage.getItem('dungeonGameState'));
}

export async function logicalClick(page, x, y) {
  const canvas = await page.locator('canvas').first().boundingBox();
  await page.mouse.move(canvas.x + x * canvas.width / 390, canvas.y + y * canvas.height / 844);
  await page.waitForTimeout(30);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await page.waitForTimeout(350);
}

export async function namedClick(page, name) {
  const state = await inventory(page);
  const input = state.scenes.flatMap(scene => scene.inputs).find(input => input.name === name);
  if (!input) throw new Error(`Missing input ${name}`);
  await logicalClick(page, input.bounds.x + input.bounds.width / 2, input.bounds.y + input.bounds.height / 2);
}

/**
 * Click the smallest visible input whose inferred label contains `label`.
 * Modal triggers rarely carry an explicit `name`, so they are addressed by the
 * text rendered on them. Smallest-area wins so a button is preferred over the
 * card or panel that contains it.
 */
export async function labelClick(page, label, state) {
  const snapshot = state ?? await inventory(page);
  const matches = snapshot.scenes
    .flatMap(scene => scene.inputs)
    .filter(input => typeof input.label === 'string' && input.label.includes(label));
  if (!matches.length) throw new Error(`Missing input labelled ${label}`);
  matches.sort((a, b) => (a.bounds.width * a.bounds.height) - (b.bounds.width * b.bounds.height));
  const input = matches[0];
  await logicalClick(page, input.bounds.x + input.bounds.width / 2, input.bounds.y + input.bounds.height / 2);
  return input;
}
