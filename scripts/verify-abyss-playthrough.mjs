// Abyss floor organic play-through: launch -> fight real waves -> win/loss -> settle.
//
// verify-modal-states.mjs and the navigationContract regression cover the abyss
// hand-off CONTRACT. This script covers the part that contract work explicitly
// did not: actually fighting the floor's waves and letting the real result flow
// settle the floor.
//
// Two runs:
//   win  — a seeded defence strong enough to hold all waves
//   loss — no guardians placed, so the dungeon core falls
//
// Why Playwright and not a browser console: the result buttons call onPress()
// from a tween onComplete, which does not run in an eval context (see CLAUDE.md).
// Playwright contexts here open with reducedMotion: 'reduce', and the button's
// reduced-motion path calls onPress() directly, so the real handler runs.
//
// npm run dev, then:
//   WEB_AUDIT_HEADLESS=1 node scripts/verify-abyss-playthrough.mjs
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
const FLOOR = Number(process.env.ABYSS_FLOOR ?? 1);

const ROSTER = [
  'dokkaebi_warrior', 'fire_dokkaebi', 'dokkaebi_junior', 'gold_turtle', 'sage',
  'village_archer', 'white_tiger', 'mountain_god', 'thunder_hero',
];

const audit = {
  generatedAt: new Date().toISOString(), base, floor: FLOOR,
  scope: 'Abyss floor organic play-through: real wave combat through the production wave loop, then the real result-flow button settling the floor. Not a campaign or endless endurance run.',
  method: 'Playwright context with reducedMotion: reduce so result buttons take their direct onPress path (tween onComplete does not fire under eval). Combat advances through window.advanceTime, the app\'s own fixed-step driver.',
  sourceHashes: {}, runs: [], failures: [],
};
await mkdir(shots, { recursive: true });
for (const path of ['src/scenes/AbyssScene.ts', 'src/combat/StageClearFlow.ts', 'src/combat/ResultPanel.ts', 'src/combat/WaveLifecycle.ts', 'scripts/verify-abyss-playthrough.mjs']) {
  audit.sourceHashes[path] = sha(await readFile(resolve(root, path)));
}

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base });

/**
 * Seed a save whose defence either holds the floor or cannot.
 *
 * The loss run seeds NO rooms at all, not merely empty guardian slots: an empty
 * combat room still attacks, because DungeonLayout falls back to
 * `ROOM_DEFS[roomType].attackCooldown` when a slot has no monsters. A fully
 * unbuilt dungeon is what actually lets invaders reach the core.
 */
async function seedDefence(page, { armed }) {
  return page.evaluate(async ({ armed, roster }) => {
    const wisdom = await import('/src/data/wisdom.ts');
    const barracks = await import('/src/data/barracks.ts');
    const state = wisdom.loadGameState();
    state.dmLevel = 40;
    state.gold = 999999;
    state.ownedMonsters = roster.map(id => ({ ...barracks.defaultOwnedMonster(id), level: 40 }));
    state.abyss = { ...state.abyss, highestFloor: 0, keys: 12 };
    state.dungeonSlots = armed
      ? roster.map(id => ({ roomType: 'combat', monsterIds: [id], trapIds: [], roomLevel: 5, hp: 400, maxHp: 400 }))
      : [];
    wisdom.saveGameState(state);
    return { slots: state.dungeonSlots.length, armed: state.dungeonSlots.filter(slot => slot.monsterIds.length).length };
  }, { armed, roster: ROSTER });
}

/** Drive every wave of the current battle to its end. */
async function fightFloor(page) {
  return page.evaluate(() => {
    const game = window.__phaserGame;
    const ds = game.scene.getScene('DungeonScene');
    // advanceTime serializes the whole game to text on every call, so step in
    // the largest chunk it accepts (10s) instead of many small ones.
    const pump = ms => { let left = ms; while (left > 0) { const chunk = Math.min(10000, left); window.advanceTime(chunk); left -= chunk; } };
    const timeline = [];
    ds.setSpeed(3);

    // A wave settles in roughly 5-15s of game time at 3x, and every stepped frame
    // costs real time under headless WebGL, so poll in short slices and stop as
    // soon as the wave is actually done instead of burning a fixed large budget.
    for (let guard = 0; guard < ds.maxWave + 2; guard++) {
      if (ds.dungeonHp <= 0) break;
      if (ds.wave >= ds.maxWave && !ds.waveActive) break;
      if (!ds.waveActive) { ds.startWave(); pump(1000); }
      let settled = false;
      for (let i = 0; i < 10; i++) {
        pump(2500);
        settled = !ds.waveActive && (ds.spawnQueue ?? []).length === 0
          && (ds.activeInvaders ?? []).filter(invader => invader.active).length === 0;
        if (settled || ds.dungeonHp <= 0) break;
      }
      timeline.push({ wave: ds.wave, hp: ds.dungeonHp, settled });
      if (ds.dungeonHp <= 0) break;
    }
    pump(2000);
    const rooms = (ds.rooms ?? []).flat().filter(Boolean);
    return {
      wave: ds.wave, maxWave: ds.maxWave, dungeonHp: ds.dungeonHp, maxHp: ds.maxHp,
      armedRooms: rooms.filter(room => room.roomData?.monsterSlot).length,
      timeline,
    };
  });
}

/** Press the result-flow button that returns to the abyss, by its rendered label. */
async function pressResultReturn(page) {
  return page.evaluate(() => {
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
          if (typeof object.text === 'string' && object.text.includes('던전으로 귀환')) {
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
    if (!center) return { pressed: false, reason: 'return button not rendered' };

    // Hit-test in the same transformed space the label was measured in, then fire
    // the zone's own handler. Smallest hit wins so the button beats its backdrop.
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
            if (center.x >= x1 && center.x <= x2 && center.y >= y1 && center.y <= y2) {
              hits.push({ object, area: (x2 - x1) * (y2 - y1) });
            }
          }
        }
      };
      walk(scene.children.list, 1, 1);
    }
    hits.sort((a, b) => a.area - b.area);
    for (const hit of hits) {
      hit.object.emit('pointerdown', { x: center.x, y: center.y });
      hit.object.emit('pointerup', { x: center.x, y: center.y });
      if (game.registry.get('battleResult')) break;
    }
    window.advanceTime(3000);
    return { pressed: true, label: center.label, candidates: hits.length, battleResult: game.registry.get('battleResult') ?? null };
  });
}

async function readAbyss(page) {
  return page.evaluate(async () => {
    const wisdom = await import('/src/data/wisdom.ts');
    const game = window.__phaserGame;
    const scene = game.scene.getScene('AbyssScene');
    return {
      activeScenes: game.scene.getScenes(true).map(entry => entry.scene.key),
      abyss: wisdom.loadGameState().abyss,
      receipt: scene?.receipt ? { tone: scene.receipt.tone, title: scene.receipt.title, detail: scene.receipt.detail } : null,
      residue: {
        abyssPendingFloor: game.registry.get('abyssPendingFloor') ?? null,
        battleResult: game.registry.get('battleResult') ?? null,
        returnTo: game.registry.get('returnTo') ?? null,
      },
    };
  });
}

try {
  for (const mode of ['win', 'loss']) {
    const { context, page, errors } = await openScene('AbyssScene', viewport);
    try {
      const seeded = await seedDefence(page, { armed: mode === 'win' });
      // Re-enter so the battle reads the seeded slots.
      await page.evaluate(floor => {
        const game = window.__phaserGame;
        game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
        game.scene.start('AbyssScene');
        window.advanceTime(1200);
        const before = window.__phaserGame.scene.getScene('AbyssScene');
        before.climb(floor);
        window.advanceTime(2000);
      }, FLOOR);

      const battle = await fightFloor(page);
      const outcome = battle.dungeonHp > 0 && battle.wave >= battle.maxWave ? 'win' : battle.dungeonHp <= 0 ? 'loss' : 'unsettled';
      const press = await pressResultReturn(page);
      const settled = await readAbyss(page);

      const screenshot = `tools/screenshots/abyss-playthrough-${mode}.png`;
      await page.screenshot({ path: resolve(root, screenshot) });

      const record = { mode, seeded, battle, outcome, press, settled, errors, screenshot, sha256: sha(await readFile(resolve(root, screenshot))) };
      audit.runs.push(record);

      const residueClear = Object.values(settled.residue).every(value => value === null);
      const expectedFloor = mode === 'win' ? FLOOR : 0;
      if (outcome !== mode) audit.failures.push({ mode, reason: `expected ${mode}, battle ended ${outcome}`, battle });
      if (!settled.activeScenes.includes('AbyssScene')) audit.failures.push({ mode, reason: 'did not return to AbyssScene', settled });
      if (settled.abyss.highestFloor !== expectedFloor) audit.failures.push({ mode, reason: `highestFloor ${settled.abyss.highestFloor} != ${expectedFloor}`, settled });
      if (!residueClear) audit.failures.push({ mode, reason: 'registry residue left behind', residue: settled.residue });
      if (errors.length) audit.failures.push({ mode, reason: 'console errors', errors });

      process.stdout.write(`${mode}: waves ${battle.wave}/${battle.maxWave} hp ${battle.dungeonHp}/${battle.maxHp} armed=${battle.armedRooms} → ${outcome} | floor ${settled.abyss.highestFloor} | ${settled.receipt?.title ?? 'no receipt'} | residue ${residueClear ? 'clear' : 'LEFT'}\n`);
    } catch (error) {
      audit.failures.push({ mode, reason: String(error) });
      process.stderr.write(`${mode}: ${error}\n`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  audit.summary = { runs: audit.runs.length, hardFailures: audit.failures.length };
  await writeFile(resolve(root, 'tools/abyss-playthrough-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
if (audit.failures.length) process.exitCode = 1;
