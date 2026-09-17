// Forecast card organic play-through: home issues today's cards → take the
// raid card → fight its waves for real → return home → the card settles the
// name and leaves no registry residue.
//
// forecastTransactions.test.ts covers the settlement CONTRACT. This covers the
// path through the scenes: ForecastTray launching DungeonScene with the card's
// inline waves, StageClearFlow handing battleResult back, and HomeLifecycle
// routing a tagged return through settleForecastBattle.
//
// npm run dev, then:
//   WEB_AUDIT_HEADLESS=1 node scripts/verify-forecast-playthrough.mjs
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createSceneOpener } from './lib/web-audit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083';
const shots = resolve(root, 'tools/screenshots');
const sha = value => createHash('sha256').update(value).digest('hex');
const viewport = { width: 390, height: 844 };

const audit = {
  generatedAt: new Date().toISOString(), base,
  scope: 'One forecast raid card fought organically from the home tray and settled on return. Not a multi-day or multi-card endurance run.',
  method: 'Home seeded with the starter board and a stage-10 lean home (campaignPacing.leanHome) so the tier-1 raid is winnable; the tray is opened by pressing the deck chip, the raid card by its own button; waves advance through window.advanceTime at 3x; return via the result-flow button.',
  sourceHashes: {}, runs: [], failures: [],
};
await mkdir(shots, { recursive: true });
for (const path of ['src/ui/ForecastTray.ts', 'src/scenes/HomeLifecycle.ts', 'src/data/forecastTransactions.ts', 'scripts/verify-forecast-playthrough.mjs']) {
  audit.sourceHashes[path] = sha(await readFile(resolve(root, path)));
}

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base });

/** Press the first interactive zone whose nearest text label matches. Same walk as the abyss harness. */
async function pressLabel(page, label) {
  return page.evaluate(label => {
    const game = window.__phaserGame;
    const dpr = window.__gameDpr;
    let center = null;
    for (const scene of game.scene.getScenes(true)) {
      const camera = scene.cameras.main;
      const walk = (list, sx, sy) => {
        for (const object of list) {
          if (!object || object.visible === false) continue;
          const nsx = sx * (object.scrollFactorX ?? 1), nsy = sy * (object.scrollFactorY ?? 1);
          if (object.type === 'Container' && object.list) { walk(object.list, nsx, nsy); continue; }
          if (typeof object.text === 'string' && object.text.includes(label) && !center) {
            const bounds = object.getBounds();
            const a = camera.matrix.transformPoint(bounds.x - camera.scrollX * nsx, bounds.y - camera.scrollY * nsy);
            const b = camera.matrix.transformPoint(bounds.right - camera.scrollX * nsx, bounds.bottom - camera.scrollY * nsy);
            center = { x: (a.x + b.x) / 2 / dpr, y: (a.y + b.y) / 2 / dpr, label: object.text };
          }
        }
      };
      walk(scene.children.list, 1, 1);
      if (center) break;
    }
    if (!center) return { pressed: false, reason: `label not rendered: ${label}` };
    const hits = [];
    for (const scene of game.scene.getScenes(true)) {
      const camera = scene.cameras.main;
      const walk = (list, sx, sy) => {
        for (const object of list) {
          if (!object || object.visible === false) continue;
          const nsx = sx * (object.scrollFactorX ?? 1), nsy = sy * (object.scrollFactorY ?? 1);
          if (object.type === 'Container' && object.list) walk(object.list, nsx, nsy);
          if (object.input?.enabled && object.getBounds) {
            const bounds = object.getBounds();
            const a = camera.matrix.transformPoint(bounds.x - camera.scrollX * nsx, bounds.y - camera.scrollY * nsy);
            const b = camera.matrix.transformPoint(bounds.right - camera.scrollX * nsx, bounds.bottom - camera.scrollY * nsy);
            const x1 = Math.min(a.x, b.x) / dpr, x2 = Math.max(a.x, b.x) / dpr;
            const y1 = Math.min(a.y, b.y) / dpr, y2 = Math.max(a.y, b.y) / dpr;
            if (center.x >= x1 && center.x <= x2 && center.y >= y1 && center.y <= y2) hits.push({ object, area: (x2 - x1) * (y2 - y1) });
          }
        }
      };
      walk(scene.children.list, 1, 1);
    }
    hits.sort((a, b) => a.area - b.area);
    const hit = hits[0];
    if (!hit) return { pressed: false, reason: `no zone under ${label}` };
    hit.object.emit('pointerdown', { x: center.x, y: center.y });
    hit.object.emit('pointerup', { x: center.x, y: center.y });
    window.advanceTime(1500);
    return { pressed: true, label: center.label, candidates: hits.length };
  }, label);
}

async function seedHome(page) {
  return page.evaluate(async () => {
    const wisdom = await import('/src/data/wisdom.ts');
    const pacing = await import('/src/data/campaignPacing.ts');
    const home = pacing.leanHome(10);
    const state = wisdom.loadGameState();
    state.dmLevel = home.dmLevel;
    state.ownedMonsters = home.ownedMonsters;
    state.dungeonSlots = home.dungeonSlots;
    state.tutorialStage = 99;
    state.notoriety = 40;
    wisdom.saveGameState(state);
    return { dmLevel: home.dmLevel, slotCount: home.slotCount, roomLevel: home.roomLevel, roster: home.roster.length };
  });
}

async function restartHome(page) {
  await page.evaluate(() => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    game.scene.start('DungeonHomeScene');
    window.advanceTime(2500);
  });
}

async function readHome(page) {
  return page.evaluate(async () => {
    const wisdom = await import('/src/data/wisdom.ts');
    const game = window.__phaserGame;
    const gs = wisdom.loadGameState();
    return {
      activeScenes: game.scene.getScenes(true).map(entry => entry.scene.key),
      notoriety: gs.notoriety, tier: gs.notorietyTier, homeGold: gs.homeGold,
      forecast: { date: gs.forecast?.date, cards: (gs.forecast?.cards ?? []).map(c => ({ id: c.id, kind: c.kind, tier: c.bandTier })), taken: gs.forecast?.taken ?? [] },
      residue: {
        forecastCardId: game.registry.get('forecastCardId') ?? null,
        battleResult: game.registry.get('battleResult') ?? null,
        returnTo: game.registry.get('returnTo') ?? null,
      },
    };
  });
}

async function fight(page) {
  return page.evaluate(async () => {
    const game = window.__phaserGame;
    const ds = game.scene.getScene('DungeonScene');
    // See verify-campaign-pacing.mjs: wall-clock timers (boss slow-mo restore)
    // need the event loop between slices.
    const yieldToTimers = () => new Promise(resolve => setTimeout(resolve, 0));
    if (!ds || !game.scene.isActive('DungeonScene')) return { started: false };
    const pump = ms => { let left = ms; while (left > 0) { const chunk = Math.min(10000, left); window.advanceTime(chunk); left -= chunk; } };
    ds.setSpeed(3);
    let slices = 0;
    while (slices < 80) {
      if (ds.dungeonHp <= 0) break;
      if (ds.wave >= ds.maxWave && !ds.waveActive) break;
      if (!ds.waveActive) { ds.resultOverlay?.destroy(); ds.resultOverlay = undefined; ds.prepActive = false; ds.startWave(); pump(1000); }
      let idle = 0;
      while (slices < 80) {
        pump(2500); slices++;
        await yieldToTimers();
        const alive = (ds.activeInvaders ?? []).filter(i => i.active).length;
        const queued = (ds.spawnQueue ?? []).length;
        if ((!ds.waveActive && queued === 0 && alive === 0) || ds.dungeonHp <= 0) break;
        idle = ds.waveActive && alive === 0 && queued === 0 ? idle + 1 : 0;
        if (idle >= 2) { ds.checkWaveEnd?.(); pump(500); if (ds.waveActive) ds.waveActive = false; break; }
      }
      if (ds.dungeonHp <= 0) break;
    }
    pump(2000);
    return { started: true, wave: ds.wave, maxWave: ds.maxWave, dungeonHp: Math.round(ds.dungeonHp), maxHp: ds.maxHp, gold: ds.gold };
  });
}

try {
  const { context, page, errors } = await openScene('DungeonHomeScene', viewport);
  try {
    const seeded = await seedHome(page);
    await restartHome(page);
    const before = await readHome(page);

    const openTray = await pressLabel(page, '오늘의 손님');
    const raid = before.forecast.cards.find(card => card.kind === 'raid');
    const takeCard = raid ? await pressLabel(page, '맞이') : { pressed: false, reason: 'no raid card issued' };
    await page.evaluate(() => window.advanceTime(3000));

    const battle = await fight(page);
    const outcome = !battle.started ? 'not-started' : battle.dungeonHp > 0 && battle.wave >= battle.maxWave ? 'win' : battle.dungeonHp <= 0 ? 'loss' : 'unsettled';
    const returned = await pressLabel(page, '던전으로 귀환');
    await page.evaluate(() => window.advanceTime(3000));
    const after = await readHome(page);

    const screenshot = 'tools/screenshots/forecast-playthrough.png';
    await page.screenshot({ path: resolve(root, screenshot) });
    const record = { seeded, before, openTray, takeCard, battle, outcome, returned, after, errors, screenshot, sha256: sha(await readFile(resolve(root, screenshot))) };
    audit.runs.push(record);

    const residueClear = Object.values(after.residue).every(value => value === null);
    if (!openTray.pressed) audit.failures.push({ reason: 'tray did not open', openTray });
    if (!takeCard.pressed) audit.failures.push({ reason: 'raid card not taken', takeCard });
    if (outcome !== 'win') audit.failures.push({ reason: `battle ended ${outcome}`, battle });
    if (!after.activeScenes.includes('DungeonHomeScene')) audit.failures.push({ reason: 'did not return home', after });
    if (raid && !after.forecast.taken.includes(raid.id)) audit.failures.push({ reason: 'card not marked taken', after });
    if (outcome === 'win' && !(after.notoriety > before.notoriety)) audit.failures.push({ reason: `notoriety did not grow (${before.notoriety} → ${after.notoriety})` });
    if (!residueClear) audit.failures.push({ reason: 'registry residue left behind', residue: after.residue });
    if (errors.length) audit.failures.push({ reason: 'console errors', errors });

    process.stdout.write(`forecast: home dm${seeded.dmLevel} slots ${seeded.slotCount} lv${seeded.roomLevel} | cards ${before.forecast.cards.map(c => c.kind).join('/')} | battle ${battle.wave}/${battle.maxWave} hp ${battle.dungeonHp}/${battle.maxHp} → ${outcome} | notoriety ${before.notoriety} → ${after.notoriety} | taken ${after.forecast.taken.length} | residue ${residueClear ? 'clear' : 'LEFT'}\n`);
  } catch (error) {
    audit.failures.push({ reason: String(error) });
    process.stderr.write(`forecast: ${error}\n`);
  } finally { await context.close(); }
} finally {
  await browser.close();
  audit.summary = { runs: audit.runs.length, hardFailures: audit.failures.length };
  await writeFile(resolve(root, 'tools/forecast-playthrough-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
if (audit.failures.length) process.exitCode = 1;
