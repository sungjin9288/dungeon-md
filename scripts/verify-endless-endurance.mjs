// Endless endurance: seed a board -> fight real waves until the
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
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createSceneOpener, namedClick } from './lib/web-audit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083';
const output = resolve(root, process.env.ENDLESS_OUTPUT ?? `output/playwright/endless-endurance/${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(output, { recursive: true });
// Refuse to overwrite a previous receipt, including one from a failed run.
await writeFile(resolve(output, 'started.json'), JSON.stringify({ startedAt: new Date().toISOString() }), { flag: 'wx' });
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
const REQUIRE_DEATH = process.env.ENDLESS_REQUIRE_DEATH !== '0';
if (!Number.isInteger(WAVE_CAP) || WAVE_CAP < 1 || !Number.isInteger(BUDGET) || BUDGET < 1) {
  throw new Error('ENDLESS_WAVE_CAP and ENDLESS_BUDGET must be positive integers');
}

const ROSTER = [
  'dokkaebi_warrior', 'fire_dokkaebi', 'dokkaebi_junior', 'gold_turtle', 'sage',
  'village_archer', 'white_tiger', 'mountain_god', 'thunder_hero',
];

const audit = {
  generatedAt: new Date().toISOString(), base, waveCap: WAVE_CAP, forcedModifier: FORCED_MODIFIER,
  scope: 'Seeded board, real continuous combat. Harness starts each wave and skips result overlays; never forces a wave to finish, removes enemies, or changes combat HP. Queue history, modifier, settlement and persisted reward checks. Not a balance or manual-play audit.',
  method: 'Playwright with reducedMotion: reduce so result buttons take their direct onPress path. Combat advances through window.advanceTime, the app\'s own fixed-step driver, at the 3x battle speed the mode ships with.',
  sourceHashes: {}, runs: [], failures: [],
};
for (const path of [
  ...(await readdir(resolve(root, 'src'), { recursive: true })).filter(file => file.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(file)).sort().map(file => `src/${file}`),
  'scripts/verify-endless-endurance.mjs', 'scripts/lib/web-audit.mjs', 'package-lock.json',
]) {
  audit.sourceHashes[path] = sha(await readFile(resolve(root, path)));
}

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base });

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
    return { slots: state.dungeonSlots.length, dmLevel: state.dmLevel, monsterLevel: 40, roomLevel: 5, roomHp: 400, roster, soulCrystals: state.soulCrystals ?? 0 };
  }, { roster: ROSTER });
}

/**
 * Fight the run. Budget is total, not per wave (a slow early wave must not eat
 * the slices a later one needs). Empty active waves fail without recovery so
 * a lifecycle regression cannot be hidden by the harness.
 */
async function fightRun(page, { waveCap, budget, probeWaves }) {
  return page.evaluate(async ({ waveCap, budget, probeWaves }) => {
    // Boss slow-mo restores itself on a wall-clock timer; a synchronous pump
    // loop starves it and the run sticks at 0.15x (see CLAUDE.md 보스 처치 슬로모).
    const yieldToTimers = () => new Promise(resolve => setTimeout(resolve, 0));
    const game = window.__phaserGame;
    const endlessModifiers = await import('/src/data/endlessModifiers.ts');
    const { INVADER_DEFS } = await import('/src/data/invaders.ts');
    const ds = game.scene.getScene('DungeonScene');
    const pump = ms => { let left = ms; while (left > 0) { const chunk = Math.min(10000, left); window.advanceTime(chunk); left -= chunk; } };

    const modifierId = game.registry.get('endlessModifier') ?? null;
    const modifier = endlessModifiers.getEndlessModifierById(modifierId);

    if (ds.speedMult !== 3 || game.registry.get('battleSpeed') !== 3) throw new Error('3x speed did not reach combat through the HUD');
    const timeline = [];
    const probes = [];
    const queueHistory = [];
    let slices = 0;
    let stalls = 0;
    let stopReason = 'budget';

    while (slices < budget) {
      if (ds.dungeonHp <= 0) { stopReason = 'death'; break; }
      if (!ds.waveActive && ds.wave >= waveCap) { stopReason = 'wave-cap'; break; }
      let queuedAtStart = null;
      if (!ds.waveActive) {
        ds.resultOverlay?.destroy(); ds.resultOverlay = undefined;
        const previousHp = ds.endlessPreviousWaveHp;
        ds.startWave();
        // Snapshot before pumping: processSpawnQueue drains the queue as
        // invaders go out, so a queue read even one second later is short by
        // however many already spawned (measured: exactly 3, and the missing
        // ones were the high-HP milestone entries at the front).
        queuedAtStart = (ds.spawnQueue ?? []).map(entry => ({ type: entry.def?.type, hp: entry.def?.hp }));
        const milestone = [10, 20, 25, 30, 40, 50, 60, 70, 80, 90].includes(ds.wave) || (ds.wave >= 100 && ds.wave % 10 === 0);
        queueHistory.push({ wave: ds.wave, previousHp, totalHp: queuedAtStart.reduce((sum, entry) => sum + entry.hp, 0), storedHp: ds.endlessPreviousWaveHp, minimumHp: milestone ? Math.ceil(previousHp * 1.12) : null, count: queuedAtStart.length });
        pump(1000); await yieldToTimers();
        if (ds.wave === 10) await window.captureEndlessWave?.(ds.wave);
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
          expectedCount: Math.min(Math.round(Math.min(5 + Math.floor(wave / 5), 20) * (modifier?.countMult ?? 1)), 24),
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
        if (slices % 10 === 0) await window.reportEndlessProgress?.({
          wave: ds.wave, hp: Math.round(ds.dungeonHp), slices, budget,
        });
        const alive = (ds.activeInvaders ?? []).filter(invader => invader.active).length;
        const queued = (ds.spawnQueue ?? []).length;
        settled = !ds.waveActive && queued === 0 && alive === 0;
        if (settled || ds.dungeonHp <= 0) break;
        idle = ds.waveActive && alive === 0 && queued === 0 ? idle + 1 : 0;
        if (idle >= 2) { stalls++; stopReason = 'stalled'; break; }
      }
      timeline.push({ wave, hp: Math.round(ds.dungeonHp), settled, stalled: idle >= 2, slices, waveHasSpawned: ds.waveHasSpawned, waveEndChecked: ds.waveEndChecked });
      await window.reportEndlessProgress?.(timeline[timeline.length - 1]);
      if (ds.dungeonHp <= 0) { stopReason = 'death'; break; }
      if (stalls) break;
    }
    pump(2000);

    return {
      modifierId,
      modifierResolved: modifier ? { id: modifier.id, hpMult: modifier.hpMult ?? 1, countMult: modifier.countMult ?? 1, speedMult: modifier.speedMult ?? 1, rewardMult: modifier.rewardMult ?? 1 } : null,
      wave: ds.wave, dungeonHp: Math.round(ds.dungeonHp), maxHp: Math.round(ds.maxHp),
      kills: ds.killsThisRun, goldEarned: ds.goldEarnedThisRun, crystalEarnMult: ds.wisdomBonuses.crystalEarnMult,
      slices, stalls, budget, stopReason,
      timeline, probes, queueHistory,
    };
  }, { waveCap, budget, probeWaves });
}

/** What the result scene ended up holding, if the run reached it. */
async function readResult(page) {
  return page.evaluate(async () => {
    const game = window.__phaserGame;
    const { loadGameState } = await import('/src/data/wisdom.ts');
    const saved = loadGameState();
    return {
      activeScenes: game.scene.getScenes(true).map(entry => entry.scene.key),
      endlessResult: game.registry.get('endlessResult') ?? null,
      endlessModifier: game.registry.get('endlessModifier') ?? null,
      saved: { endlessHighScore: saved.endlessHighScore, soulCrystals: saved.soulCrystals },
    };
  });
}

try {
  const { context, page, errors } = await openScene('DungeonHomeScene', viewport);
  try {
    await page.exposeFunction('reportEndlessProgress', progress => {
      process.stdout.write(`progress ${JSON.stringify({ at: new Date().toISOString(), ...progress })}\n`);
    });
    await page.exposeFunction('captureEndlessWave', wave => page.screenshot({ path: resolve(output, `wave-${wave}.png`) }));
    audit.renderer = await page.evaluate(() => {
      const gl = window.__phaserGame.renderer.gl;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    const seeded = await seedDefence(page);
    await page.evaluate(() => {
      const game = window.__phaserGame;
      game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
      game.registry.set('returnTo', 'DungeonHomeScene');
      game.registry.set('stageConfig', { endless: true, stageNumber: 0 });
      game.scene.start('DungeonScene');
    });
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('DungeonScene') && window.__phaserGame.scene.getScene('DungeonScene').roomGrid.length > 0);

    if (FORCED_MODIFIER) {
      await page.evaluate(async id => {
        const { getEndlessModifierById } = await import('/src/data/endlessModifiers.ts');
        if (!getEndlessModifierById(id)) throw new Error(`unknown forced modifier: ${id}`);
        const game = window.__phaserGame;
        game.registry.set('endlessModifier', id);
        // Recreate the HUD so its cached chip matches the forced fixture.
        const ui = game.scene.getScene('UIScene');
        await new Promise(resolve => {
          ui.events.once('create', () => resolve());
          ui.scene.restart();
        });
      }, FORCED_MODIFIER);
    }
    for (let clicks = 0; clicks < 3; clicks++) {
      if (await page.evaluate(() => window.__phaserGame.registry.get('battleSpeed') === 3)) break;
      await namedClick(page, 'battleSpeedControl');
    }

    const run = await fightRun(page, { waveCap: WAVE_CAP, budget: BUDGET, probeWaves: PROBE_WAVES });
    const settled = await readResult(page);

    const screenshot = resolve(output, 'endless-endurance.png');
    await page.screenshot({ path: screenshot });
    await writeFile(resolve(output, 'state.json'), await page.evaluate(() => window.render_game_to_text()));
    audit.runs.push({ seeded, run, settled, errors, screenshot, sha256: sha(await readFile(screenshot)) });

    // ── Invariants ───────────────────────────────────────────────────────────
    if (run.wave <= 1) audit.failures.push({ reason: `run never advanced past wave ${run.wave}`, timeline: run.timeline });
    if (!run.modifierId) audit.failures.push({ reason: 'no endless modifier on the registry — DungeonSceneInit did not roll one' });
    if (!run.modifierResolved) audit.failures.push({ reason: `modifier id "${run.modifierId}" does not resolve`, modifierId: run.modifierId });
    if (run.stalls) audit.failures.push({ reason: 'empty active wave stalled; no recovery attempted', timeline: run.timeline });
    for (const entry of run.queueHistory) {
      if (entry.storedHp !== entry.totalHp || (entry.minimumHp !== null && entry.totalHp < entry.minimumHp)) {
        audit.failures.push({ reason: `wave ${entry.wave} queue history or milestone floor mismatch`, entry });
      }
    }
    for (let i = 1; i < run.queueHistory.length; i++) {
      if (run.queueHistory[i].previousHp !== run.queueHistory[i - 1].totalHp) audit.failures.push({ reason: 'previous-wave HP did not carry through the continuous run', entry: run.queueHistory[i] });
    }
    for (const wave of PROBE_WAVES.filter(wave => wave <= run.wave)) {
      if (!run.probes.some(probe => probe.wave === wave)) audit.failures.push({ reason: `missing wave ${wave} modifier probe` });
    }
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
      audit.notes = [...(audit.notes ?? []), `run stopped at ${run.stopReason} alive; result-flow assertions did not execute`];
      if (REQUIRE_DEATH) audit.failures.push({ reason: 'required core-death path was not reached' });
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
        const crystals = Math.round((Math.floor(run.wave / 5) + (run.wave >= 20 ? 2 : 0) + (run.wave >= 50 ? 5 : 0) + (run.wave >= 100 ? 10 : 0)) * run.crystalEarnMult);
        if (settled.endlessResult.kills !== run.kills || settled.endlessResult.goldEarned !== run.goldEarned) audit.failures.push({ reason: 'result kills/gold do not match combat', settled, run });
        if (settled.endlessResult.crystalsEarned !== crystals || settled.saved.soulCrystals !== seeded.soulCrystals + crystals || settled.saved.endlessHighScore !== run.wave) audit.failures.push({ reason: 'persisted crystals or best score do not match the run', crystals, settled });
        await page.evaluate(() => new Promise(resolve => {
          const result = window.__phaserGame.scene.getScene('EndlessResultScene');
          result.events.once('create', () => resolve());
          result.scene.restart();
        }));
        const reopened = await readResult(page);
        audit.runs[0].reopened = reopened;
        if (JSON.stringify(reopened.saved) !== JSON.stringify(settled.saved)) audit.failures.push({ reason: 'result scene re-entry changed the reward', reopened, settled });
      }
    }
    if (errors.length) audit.failures.push({ reason: 'console errors', errors });

    const probeLine = run.probes.map(p => `w${p.wave}:${p.count}/${p.expectedCount}${p.mismatched.length ? '✗' : '✓'}`).join(' ');
    process.stdout.write(
      `endless: wave ${run.wave} hp ${run.dungeonHp}/${run.maxHp} | 변수 ${run.modifierId ?? 'none'}`
      + ` (hp×${run.modifierResolved?.hpMult ?? '?'} cnt×${run.modifierResolved?.countMult ?? '?'})`
      + ` | probe ${probeLine} | ${run.slices}/${run.budget} slices, ${run.stalls} stalls | ${run.stopReason}\n`,
    );
  } catch (error) {
    audit.failures.push({ reason: String(error) });
    process.stderr.write(`endless: ${error}\n`);
  } finally { await context.close(); }
} finally {
  await browser.close();
  for (const [path, before] of Object.entries(audit.sourceHashes)) {
    if (sha(await readFile(resolve(root, path))) !== before) audit.failures.push({ reason: `source changed during run: ${path}` });
  }
  audit.completedAt = new Date().toISOString();
  audit.summary = { runs: audit.runs.length, hardFailures: audit.failures.length, completedDeathPath: audit.runs.some(({ run }) => run.stopReason === 'death'), requiredDeath: REQUIRE_DEATH, milestoneWaves: audit.runs.flatMap(({ run }) => run.queueHistory.filter(entry => entry.minimumHp !== null).map(entry => entry.wave)) };
  await writeFile(resolve(output, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
  for (const failure of audit.failures) process.stdout.write(`  !! ${failure.reason}\n`);
  if (audit.failures.length) process.exitCode = 1;
}
