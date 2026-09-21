// Endless endurance organic run: roll a modifier -> fight real waves until the
// core falls -> the result scene reports the run that actually happened.
//
// verify-endless-result.mjs covers the result SCREEN, but it injects a literal
// ({ wave: 35, kills: 723, ... }) and never starts a battle, so nothing checked
// that endless combat runs at all, that the rolled 도전 변수 reaches the spawn
// queue, or that the numbers on the result screen came from the fight. That is
// this script's job; it does not re-check layout.
//
// The load-bearing assertion is the modifier probe: it reads the live invaders'
// scaled HP out of the running scene and holds it against
// buildEndlessSpawnQueue(wave, modifier) computed in the page. A modifier that
// is rolled, displayed, and then dropped on the way to combat passes every
// existing test and fails here.
//
// npm run dev, then:
//   WEB_AUDIT_HEADLESS=1 node scripts/verify-endless-endurance.mjs
//   ENDLESS_WAVE_CAP=40 ENDLESS_MODIFIER=glass_cannon node scripts/verify-endless-endurance.mjs
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

// A run is cut off here rather than played to death: HP grows 1.12^(w-1), so a
// strong board still survives long enough to make an uncapped run open-ended.
const WAVE_CAP = Number(process.env.ENDLESS_WAVE_CAP ?? 30);
// Pin the roll to audit one 도전 변수; unset rolls like the game does.
const FORCED_MODIFIER = process.env.ENDLESS_MODIFIER ?? null;
// Waves whose spawned invaders are held against the pure spawn queue.
// Must be NON-milestone waves (milestones at 10/20/25/30/40/50/60/70/80/90 add
// entries with their own extra HP factor). Filler entries are exactly
// round(base.hp × 1.12^(w-1) × modifier.hpMult), which is what the probe checks.
const PROBE_WAVES = [1, 5, 12];
// Total slices, matching verify-campaign-pacing.mjs's accounting (2.5s each).
const BUDGET = Number(process.env.ENDLESS_BUDGET ?? 120);

const ROSTER = [
  'dokkaebi_warrior', 'fire_dokkaebi', 'dokkaebi_junior', 'gold_turtle', 'sage',
  'village_archer', 'white_tiger', 'mountain_god', 'thunder_hero',
];

const audit = {
  generatedAt: new Date().toISOString(), base, waveCap: WAVE_CAP, forcedModifier: FORCED_MODIFIER,
  scope: 'Endless endurance organic run: real wave combat through the production wave loop, the rolled run modifier held against the pure spawn queue, and the result scene read back. Not a layout audit (verify-endless-result.mjs owns that).',
  method: 'Playwright with reducedMotion: reduce so result buttons take their direct onPress path. Combat advances through window.advanceTime, the app\'s own fixed-step driver, at the 3x battle speed the mode ships with.',
  sourceHashes: {}, runs: [], failures: [],
};
for (const path of [
  'src/data/endlessWave.ts', 'src/data/endlessModifiers.ts', 'src/combat/WaveStart.ts',
  'src/combat/DungeonSceneInit.ts', 'src/scenes/EndlessResultScene.ts', 'scripts/verify-endless-endurance.mjs',
]) {
  audit.sourceHashes[path] = sha(await readFile(resolve(root, path)));
}

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base });
await mkdir(shots, { recursive: true });

/** Give the run a board strong enough to reach deep waves, and a clean record. */
async function seedDefence(page) {
  return page.evaluate(async ({ roster }) => {
    const wisdom = await import('/src/data/wisdom.ts');
    const barracks = await import('/src/data/barracks.ts');
    const state = wisdom.loadGameState();
    state.dmLevel = 40;
    state.gold = 999999;
    state.endlessHighScore = 0;
    state.ownedMonsters = roster.map(id => ({ ...barracks.defaultOwnedMonster(id), level: 40 }));
    state.dungeonSlots = roster.map(id => ({
      roomType: 'combat', monsterIds: [id], trapIds: [], roomLevel: 5, hp: 400, maxHp: 400,
    }));
    wisdom.saveGameState(state);
    return { slots: state.dungeonSlots.length };
  }, { roster: ROSTER });
}

/**
 * Fight the run. Budget is total, not per wave (a slow early wave must not eat
 * the slices a later one needs), and a wave that the production wave-end check
 * cannot close is force-closed the way verify-campaign-pacing.mjs closes it — a
 * board that kills everything instantly leaves `waveActive` true with nothing
 * alive and nothing queued, which otherwise burns the whole budget on one wave.
 */
async function fightRun(page, { waveCap, budget, probeWaves, forcedModifier }) {
  return page.evaluate(async ({ waveCap, budget, probeWaves, forcedModifier }) => {
    // Boss slow-mo restores itself on a wall-clock timer; a synchronous pump
    // loop starves it and the run sticks at 0.15x (see CLAUDE.md 보스 처치 슬로모).
    const yieldToTimers = () => new Promise(resolve => setTimeout(resolve, 0));
    const game = window.__phaserGame;
    const endlessWave = await import('/src/data/endlessWave.ts');
    const endlessModifiers = await import('/src/data/endlessModifiers.ts');
    const { INVADER_DEFS } = await import('/src/data/invaders.ts');
    const ds = game.scene.getScene('DungeonScene');
    const pump = ms => { let left = ms; while (left > 0) { const chunk = Math.min(10000, left); window.advanceTime(chunk); left -= chunk; } };

    if (forcedModifier) game.registry.set('endlessModifier', forcedModifier);
    const modifierId = game.registry.get('endlessModifier') ?? null;
    const modifier = endlessModifiers.getEndlessModifierById(modifierId);

    ds.setSpeed(3);
    const timeline = [];
    const probes = [];
    let slices = 0;
    let stalls = 0;

    while (slices < budget) {
      if (ds.dungeonHp <= 0 || ds.wave > waveCap) break;
      let queuedAtStart = null;
      if (!ds.waveActive) {
        ds.resultOverlay?.destroy(); ds.resultOverlay = undefined; ds.prepActive = false;
        ds.startWave();
        // Snapshot before pumping: processSpawnQueue drains the queue as
        // invaders go out, so a queue read even one second later is short by
        // however many already spawned (measured: exactly 3, and the missing
        // ones were the high-HP milestone entries at the front).
        if (probeWaves.includes(ds.wave)) queuedAtStart = (ds.spawnQueue ?? []).map(entry => ({ type: entry.def?.type, hp: entry.def?.hp }));
        pump(1000); await yieldToTimers();
      }

      const wave = ds.wave;
      if (probeWaves.includes(wave)) {
        // Live invaders are the wrong sample entirely: a strong board kills a
        // wave-1 peasant inside the first slice, so sampling the field reported
        // "spawned nothing" for a wave that spawned fine. The queue the
        // production path just built is the real artifact — it came through
        // registry -> getEndlessModifierById -> buildEndlessSpawnQueue.
        //
        // The queue cannot be compared against a recomputed one: the builder
        // draws its types at random, so a second call returns a different wave.
        // Each entry is checked against ITS OWN type instead, which is exact.
        const queued = queuedAtStart ?? (ds.spawnQueue ?? []).map(entry => ({ type: entry.def?.type, hp: entry.def?.hp }));
        const waveHpMult = Math.pow(1.12, wave - 1);
        const mHp = modifier?.hpMult ?? 1;
        const entries = queued.map(entry => {
          const base = INVADER_DEFS[entry.type];
          return {
            type: entry.type,
            hp: entry.hp,
            expected: base ? Math.round(base.hp * waveHpMult * mHp) : null,
            baseline: base ? Math.round(base.hp * waveHpMult) : null,
          };
        });
        probes.push({
          wave,
          mHp,
          count: queued.length,
          expectedCount: endlessWave.buildEndlessSpawnQueue(wave, modifier).length,
          entries,
          mismatched: entries.filter(entry => entry.expected === null || entry.hp !== entry.expected),
          allAtBaseline: mHp !== 1 && entries.length > 0 && entries.every(entry => entry.hp === entry.baseline),
        });
      }

      let settled = false;
      let idle = 0;
      while (slices < budget) {
        pump(2500); slices++;
        await yieldToTimers();
        const alive = (ds.activeInvaders ?? []).filter(invader => invader.active).length;
        const queued = (ds.spawnQueue ?? []).length;
        settled = !ds.waveActive && queued === 0 && alive === 0;
        if (settled || ds.dungeonHp <= 0) break;
        idle = ds.waveActive && alive === 0 && queued === 0 ? idle + 1 : 0;
        if (idle >= 2) { stalls++; ds.checkWaveEnd?.(); pump(500); if (ds.waveActive) ds.waveActive = false; break; }
      }
      timeline.push({ wave, hp: Math.round(ds.dungeonHp), settled: settled || idle >= 2, stalled: idle >= 2, slices });
      if (ds.dungeonHp <= 0) break;
    }
    pump(2000);

    return {
      modifierId,
      modifierResolved: modifier ? { id: modifier.id, hpMult: modifier.hpMult ?? 1, countMult: modifier.countMult ?? 1, speedMult: modifier.speedMult ?? 1, rewardMult: modifier.rewardMult ?? 1 } : null,
      wave: ds.wave, dungeonHp: Math.round(ds.dungeonHp), maxHp: Math.round(ds.maxHp),
      kills: ds.totalKills ?? null,
      slices, stalls, budget,
      timeline, probes,
    };
  }, { waveCap, budget, probeWaves, forcedModifier });
}

/** What the result scene ended up holding, if the run reached it. */
async function readResult(page) {
  return page.evaluate(() => {
    const game = window.__phaserGame;
    return {
      activeScenes: game.scene.getScenes(true).map(entry => entry.scene.key),
      endlessResult: game.registry.get('endlessResult') ?? null,
      endlessModifier: game.registry.get('endlessModifier') ?? null,
    };
  });
}

try {
  const { context, page, errors } = await openScene('DungeonHomeScene', viewport);
  try {
    const seeded = await seedDefence(page);
    await page.evaluate(() => {
      const game = window.__phaserGame;
      game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
      game.registry.set('returnTo', 'DungeonHomeScene');
      game.registry.set('stageConfig', { endless: true, stageNumber: 0 });
      game.scene.start('DungeonScene');
      window.advanceTime(2000);
    });

    const run = await fightRun(page, { waveCap: WAVE_CAP, budget: BUDGET, probeWaves: PROBE_WAVES, forcedModifier: FORCED_MODIFIER });
    const settled = await readResult(page);

    const screenshot = 'tools/screenshots/endless-endurance.png';
    await page.screenshot({ path: resolve(root, screenshot) });
    audit.runs.push({ seeded, run, settled, errors, screenshot, sha256: sha(await readFile(resolve(root, screenshot))) });

    // ── Invariants ───────────────────────────────────────────────────────────
    if (run.wave <= 1) audit.failures.push({ reason: `run never advanced past wave ${run.wave}`, timeline: run.timeline });
    if (!run.modifierId) audit.failures.push({ reason: 'no endless modifier on the registry — DungeonSceneInit did not roll one' });
    if (!run.modifierResolved) audit.failures.push({ reason: `modifier id "${run.modifierId}" does not resolve`, modifierId: run.modifierId });
    for (const probe of run.probes) {
      if (probe.count === 0) { audit.failures.push({ reason: `wave ${probe.wave} queued nothing`, probe }); continue; }
      if (probe.count !== probe.expectedCount) {
        audit.failures.push({ reason: `wave ${probe.wave} queued ${probe.count} invaders, builder says ${probe.expectedCount}`, probe });
      }
      if (probe.mismatched.length) {
        const sample = probe.mismatched.slice(0, 3).map(entry => `${entry.type} ${entry.hp}!=${entry.expected}`).join(', ');
        audit.failures.push({ reason: `wave ${probe.wave} scaled ${probe.mismatched.length} invader(s) wrong: ${sample}`, probe });
      }
      // A modifier that was rolled and displayed but dropped on the way to
      // combat leaves every invader at its unmodified HP — the failure no
      // existing test can see, because nothing else fights an endless wave.
      if (probe.allAtBaseline) {
        audit.failures.push({ reason: `wave ${probe.wave} fielded baseline HP throughout — modifier "${run.modifierId}" (hp×${probe.mHp}) did not reach combat`, probe });
      }
    }
    const died = run.dungeonHp <= 0;
    if (!died) {
      // The death path carries every assertion below. A capped run proves the
      // waves ran, not that the run settles — say so instead of passing quietly.
      audit.notes = [...(audit.notes ?? []), `run hit the wave cap (${WAVE_CAP}) alive; result-flow assertions did not execute — raise ENDLESS_WAVE_CAP/ENDLESS_BUDGET to exercise them`];
    } else {
      if (!settled.activeScenes.includes('EndlessResultScene')) {
        audit.failures.push({ reason: 'core fell but EndlessResultScene never opened', settled });
      }
      // Guarding this on truthiness let a missing result pass silently.
      if (!settled.endlessResult) {
        audit.failures.push({ reason: 'core fell but no endlessResult on the registry — WaveLifecycle never settled the run', settled });
      } else {
        if (settled.endlessResult.wave !== run.wave) {
          audit.failures.push({ reason: `result scene reports wave ${settled.endlessResult.wave}, run ended on ${run.wave}`, settled });
        }
        // The save was seeded with endlessHighScore 0, so any run past wave 0
        // is a record; a false here means applyEndlessRunReward never ran.
        if (settled.endlessResult.isNewRecord !== true) {
          audit.failures.push({ reason: `run reached wave ${run.wave} from a 0 high score but isNewRecord=${settled.endlessResult.isNewRecord}`, settled });
        }
      }
    }
    if (errors.length) audit.failures.push({ reason: 'console errors', errors });

    const probeLine = run.probes.map(p => `w${p.wave}:${p.count}/${p.expectedCount}${p.mismatched.length ? '✗' : '✓'}`).join(' ');
    process.stdout.write(
      `endless: wave ${run.wave} hp ${run.dungeonHp}/${run.maxHp} | 변수 ${run.modifierId ?? 'none'}`
      + ` (hp×${run.modifierResolved?.hpMult ?? '?'} cnt×${run.modifierResolved?.countMult ?? '?'})`
      + ` | probe ${probeLine} | ${run.slices}/${run.budget} slices, ${run.stalls} stalls | ${died ? 'core fell' : 'cap reached'}\n`,
    );
  } catch (error) {
    audit.failures.push({ reason: String(error) });
    process.stderr.write(`endless: ${error}\n`);
  } finally { await context.close(); }
} finally {
  await browser.close();
  audit.summary = { runs: audit.runs.length, hardFailures: audit.failures.length };
  await writeFile(resolve(root, 'tools/endless-endurance-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
  for (const failure of audit.failures) process.stdout.write(`  !! ${failure.reason}\n`);
  if (audit.failures.length) process.exitCode = 1;
}
