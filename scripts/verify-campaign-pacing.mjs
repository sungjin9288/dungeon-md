// Campaign pacing organic play-through: seed the pacing model's home, fight a
// real stage through the production wave loop, record the outcome.
//
// campaignPacing.test.ts guards the campaign against the headless simulation.
// That simulation is optimistic by construction (every point of DPS reaches
// every invader), so this script is the calibration: it plays the same homes
// through real combat — targeting, rows, ranges, cooldowns — and reports how
// much dungeon HP actually survives. Stage data is tuned against BOTH.
//
// Homes come from the model itself (imported inside the page) so the harness
// can never drift from what the guard believes a player has.
//
// npm run dev, then:
//   WEB_AUDIT_HEADLESS=1 node scripts/verify-campaign-pacing.mjs
//   PACING_RUNS="1:starter,2:lean,10:lean,90:veteran" ... to pick runs (kinds: starter | lean | expected | veteran)
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

// Chapter boundaries plus the two homes the guard treats as hard floors.
const DEFAULT_RUNS = '1:starter,2:lean,5:lean,10:lean,20:lean,32:lean,42:lean,52:lean,62:lean,72:lean,80:lean,90:veteran';
const RUNS = (process.env.PACING_RUNS ?? DEFAULT_RUNS).split(',').map(entry => {
  const [stage, kind] = entry.split(':');
  return { stageNumber: Number(stage), kind: kind ?? 'lean' };
});

const audit = {
  generatedAt: new Date().toISOString(), base,
  scope: 'Campaign stages fought organically by the pacing model\'s starter / lean / expected homes. Calibrates campaignPacing.test.ts (headless sim) against real combat. Not a full campaign endurance run.',
  method: 'Home seeded in-page from src/data/campaignPacing.ts, DungeonScene started with { stageNumber }, waves driven through window.advanceTime at 3x. Outcome = dungeon HP after the last wave.',
  sourceHashes: {}, runs: [], failures: [],
};
await mkdir(shots, { recursive: true });
for (const path of ['src/data/campaignPacing.ts', 'src/data/simulation.ts', 'src/combat/DungeonLayout.ts', 'scripts/verify-campaign-pacing.mjs']) {
  audit.sourceHashes[path] = sha(await readFile(resolve(root, path)));
}

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base });

/** Seed the model's home for this stage and report what the sim predicts for it. */
async function seedHome(page, { stageNumber, kind }) {
  return page.evaluate(async ({ stageNumber, kind }) => {
    const wisdom = await import('/src/data/wisdom.ts');
    const pacing = await import('/src/data/campaignPacing.ts');
    const { ALL_STAGES } = await import('/src/data/allStages.ts');
    const home = kind === 'starter' ? pacing.starterHome()
      : kind === 'expected' ? pacing.expectedHome(stageNumber)
      : kind === 'veteran' ? pacing.veteranHome(stageNumber)
      : pacing.leanHome(stageNumber);
    const stage = ALL_STAGES.find(entry => entry.id === stageNumber);
    const sim = pacing.simulateHome(home, stage);

    const state = wisdom.loadGameState();
    state.dmLevel = home.dmLevel;
    state.ownedMonsters = home.ownedMonsters;
    state.dungeonSlots = home.dungeonSlots;
    state.tutorialStage = 99;
    state.stageProgress = state.stageProgress.map((entry, index) => ({ ...entry, unlocked: index < stageNumber }));
    wisdom.saveGameState(state);
    return {
      dmLevel: home.dmLevel, slotCount: home.slotCount, roomLevel: home.roomLevel, roster: home.roster,
      sim: { winPct: sim.winPct, finalHp: sim.finalHp, startHp: sim.startHp, totalDps: Number(sim.totalDps.toFixed(1)), worstWave: sim.worstWave },
    };
  }, { stageNumber, kind });
}

async function launchStage(page, stageNumber) {
  await page.evaluate(stageNumber => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    game.registry.set('stageConfig', { stageNumber });
    game.scene.start('DungeonScene');
    window.advanceTime(2000);
  }, stageNumber);
}

/** Drive every wave of the current battle to its end (same loop as the abyss harness). */
async function fightStage(page) {
  return page.evaluate(() => {
    const game = window.__phaserGame;
    const ds = game.scene.getScene('DungeonScene');
    const pump = ms => { let left = ms; while (left > 0) { const chunk = Math.min(10000, left); window.advanceTime(chunk); left -= chunk; } };
    const timeline = [];
    ds.setSpeed(3);
    // Total budget instead of a per-wave one: a slow early wave (few rooms,
    // long invader lines) must not eat the iterations a later wave needs.
    // Every slice costs real seconds (advanceTime serializes the game), so the
    // budget is tight: 200 slices × 2.5s ≈ 8 game-minutes at 3x.
    // Slices per run (each ≈2.5s of battle at 3×). 15-wave veteran stages need more: PACING_BUDGET=140.
    const BUDGET = Number(process.env.PACING_BUDGET ?? 70);
    let slices = 0;
    let stalls = 0;
    while (slices < BUDGET) {
      if (ds.dungeonHp <= 0) break;
      if (ds.wave >= ds.maxWave && !ds.waveActive) break;
      if (!ds.waveActive) {
        // Take the "즉시 시작" path instead of waiting out the 10s prep countdown.
        ds.resultOverlay?.destroy(); ds.resultOverlay = undefined; ds.prepActive = false;
        ds.startWave(); pump(1000);
      }
      let settled = false;
      let idle = 0;
      while (slices < BUDGET) {
        pump(2500); slices++;
        const alive = (ds.activeInvaders ?? []).filter(invader => invader.active).length;
        const queued = (ds.spawnQueue ?? []).length;
        settled = !ds.waveActive && queued === 0 && alive === 0;
        if (settled || ds.dungeonHp <= 0) break;
        // Spawn-pipeline stall (nothing alive, nothing queued, wave still flagged
        // active): the production wave-end check has nothing to fire on. Give it
        // two slices, then close the wave the way checkWaveEnd would.
        idle = ds.waveActive && alive === 0 && queued === 0 ? idle + 1 : 0;
        if (idle >= 2) { stalls++; ds.checkWaveEnd?.(); pump(500); if (ds.waveActive) ds.waveActive = false; break; }
      }
      timeline.push({ wave: ds.wave, hp: Math.round(ds.dungeonHp), settled: settled || idle >= 2, stalled: idle >= 2, slices });
      if (ds.dungeonHp <= 0) break;
    }
    pump(2000);
    const rooms = (ds.rooms ?? []).flat().filter(Boolean);
    return {
      wave: ds.wave, maxWave: ds.maxWave, dungeonHp: Math.round(ds.dungeonHp), maxHp: ds.maxHp,
      builtRooms: rooms.filter(room => room.state === 'occupied').length,
      armedRooms: rooms.filter(room => room.roomData?.monsterSlot).length,
      gold: ds.gold,
      stalls,
      timeline,
    };
  });
}

try {
  for (const run of RUNS) {
    const label = `${run.stageNumber}:${run.kind}`;
    const { context, page, errors } = await openScene('StageSelectScene', viewport);
    try {
      const seeded = await seedHome(page, run);
      await launchStage(page, run.stageNumber);
      const battle = await fightStage(page);
      const outcome = battle.dungeonHp > 0 && battle.wave >= battle.maxWave ? 'win' : battle.dungeonHp <= 0 ? 'loss' : 'unsettled';
      const hpPct = Math.round((battle.dungeonHp / battle.maxHp) * 100);

      const screenshot = `tools/screenshots/campaign-pacing-${run.stageNumber}-${run.kind}.png`;
      await page.screenshot({ path: resolve(root, screenshot) });
      const record = { ...run, seeded, battle, outcome, hpPct, errors, screenshot, sha256: sha(await readFile(resolve(root, screenshot))) };
      audit.runs.push(record);

      if (outcome !== 'win') audit.failures.push({ run: label, reason: `battle ended ${outcome}`, battle });
      if (errors.length) audit.failures.push({ run: label, reason: 'console errors', errors });

      await writeFile(resolve(root, 'tools/campaign-pacing-audit.json'), `${JSON.stringify({ ...audit, summary: { partial: true, runs: audit.runs.length } }, null, 2)}\n`);
      process.stdout.write(`${label}: dm${seeded.dmLevel} slots ${seeded.slotCount} lv${seeded.roomLevel} roster ${seeded.roster.length} | sim win% ${seeded.sim.winPct} dps ${seeded.sim.totalDps} | real waves ${battle.wave}/${battle.maxWave} hp ${battle.dungeonHp}/${battle.maxHp} (${hpPct}%) rooms ${battle.builtRooms}/${battle.armedRooms} loot ${battle.gold} stalls ${battle.stalls} → ${outcome}\n`);
    } catch (error) {
      audit.failures.push({ run: label, reason: String(error) });
      process.stderr.write(`${label}: ${error}\n`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  audit.summary = { runs: audit.runs.length, wins: audit.runs.filter(run => run.outcome === 'win').length, hardFailures: audit.failures.length };
  await writeFile(resolve(root, 'tools/campaign-pacing-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
if (audit.failures.length) process.exitCode = 1;
