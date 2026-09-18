// Invader movement-control invariants, driven against a real battle.
//
// Two bugs motivated this harness, both invisible to unit tests because they
// live in Phaser's pause/timeScale semantics:
//
//   1. Overlapping crowd control cancelled itself — a stun expiring resumed an
//      invader that was still frozen or charmed. Tier-2/3 traps apply two or
//      three afflictions at once, so the overlap is routine.
//   2. Fixing (1) by routing speed changes through the resume path broke the
//      opposite way: slow/rally/captain-aura updates un-paused taunt, venom
//      paralysis and the revive animation, which hold the tween with no lock
//      flag. Cost: stage 20 lean went from a 26% win to a 0% loss.
//
// npm run dev, then:
//   WEB_AUDIT_HEADLESS=1 node scripts/verify-invader-movement.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083';
const STAGE = Number(process.env.STAGE ?? 20);

const audit = {
  generatedAt: new Date().toISOString(), base, stage: STAGE,
  scope: 'Movement-lock invariants during a real battle with a tier-3 trap room. Not a balance or endurance run.',
  checks: [], failures: [],
};

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

try {
  await page.addInitScript(() => localStorage.setItem('dungeonGameState', JSON.stringify({ tutorialStage: 99 })));
  await page.goto(`${base}/?skipTutorial=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__phaserGame) && typeof window.advanceTime === 'function', null, { timeout: 30000 });
  await page.evaluate(() => window.advanceTime(2500));

  // Seed a lean home whose first room carries two tier-3 traps: six afflictions
  // land on entry, so locks overlap on essentially every invader.
  await page.evaluate(async (stageNumber) => {
    const wisdom = await import('/src/data/wisdom.ts');
    const pacing = await import('/src/data/campaignPacing.ts');
    const home = pacing.leanHome(stageNumber);
    const state = wisdom.loadGameState();
    state.dmLevel = home.dmLevel;
    state.ownedMonsters = home.ownedMonsters;
    state.dungeonSlots = home.dungeonSlots.map((slot, i) => (
      i === 0 ? { ...slot, roomType: 'trap', building: 'trap', trapIds: ['storm_cage', 'hellmouth'] } : slot
    ));
    state.tutorialStage = 99;
    state.stageProgress = state.stageProgress.map((entry, i) => ({ ...entry, unlocked: i < stageNumber }));
    wisdom.saveGameState(state);
  }, STAGE);

  await page.evaluate((stageNumber) => {
    const game = window.__phaserGame;
    game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    game.registry.set('stageConfig', { stageNumber });
    game.scene.start('DungeonScene');
    window.advanceTime(2500);
  }, STAGE);

  // Order matters: invariant B samples an untouched battle. Invariant A pauses an
  // invader and leaves it paused, which distorts the waves that follow — running A
  // first made B observe maxLocks 1 (no overlap) and fail its own exercise check.
  // ── Invariant B: locks hold, and nothing is stranded once they clear ───────
  const sweep = await page.evaluate(() => {
    const ds = window.__phaserGame.scene.getScene('DungeonScene');
    const pump = ms => { let left = ms; while (left > 0) { const chunk = Math.min(10000, left); window.advanceTime(chunk); left -= chunk; } };
    // Sample at 1x with a short step: a 1000ms stun lasts ~333ms of pumped time
    // at 3x, so a coarse sweep walks straight past the overlap it is meant to
    // observe (the first run of this harness reported maxLocks 1 for that reason).
    ds.setSpeed(1);
    const seen = { samples: 0, maxLocks: 0, lockedMoving: 0, freeStopped: 0, waves: 0 };
    for (let wave = 0; wave < 3; wave++) {
      if (!ds.waveActive) {
        ds.resultOverlay?.destroy(); ds.resultOverlay = undefined; ds.prepActive = false;
        ds.startWave(); pump(800);
      }
      seen.waves++;
      for (let i = 0; i < 40; i++) {
        pump(250);
        for (const inv of (ds.activeInvaders ?? []).filter(x => x.active)) {
          seen.samples++;
          const locks = [inv.isStunned, inv.isRooted, inv.isFrozen, inv.isCharmed].filter(Boolean).length;
          seen.maxLocks = Math.max(seen.maxLocks, locks);
          const paused = inv.pathTween ? inv.pathTween.isPaused() : false;
          const speed  = inv.pathTween ? inv.pathTween.timeScale : 1;
          if (locks > 0 && !paused && speed > 0) seen.lockedMoving++;
          if (locks === 0 && paused) seen.freeStopped++;
        }
        if (ds.dungeonHp <= 0) break;
      }
      if (ds.dungeonHp <= 0) break;
    }
    return { ...seen, wave: ds.wave, dungeonHp: Math.round(ds.dungeonHp) };
  });
  audit.checks.push({ id: 'locks-hold-and-release', ...sweep });
  if (sweep.samples < 20) audit.failures.push({ id: 'locks-hold-and-release', reason: `only ${sweep.samples} invader samples — battle never got going` });
  if (sweep.maxLocks < 2) audit.failures.push({ id: 'locks-hold-and-release', reason: 'no overlapping crowd control observed; the invariant was not exercised' });
  if (sweep.lockedMoving > 0) audit.failures.push({ id: 'locks-hold-and-release', reason: `${sweep.lockedMoving} samples moved while locked` });
  if (sweep.freeStopped > 0) audit.failures.push({ id: 'locks-hold-and-release', reason: `${sweep.freeStopped} samples stayed stopped with no lock` });
  if (errors.length) audit.failures.push({ id: 'console', errors });

  // ── Invariant A: a pause with no lock flag survives speed changes ──────────
  const pauseCheck = await page.evaluate(() => {
    const ds = window.__phaserGame.scene.getScene('DungeonScene');
    ds.setSpeed(3);
    ds.resultOverlay?.destroy(); ds.resultOverlay = undefined; ds.prepActive = false;
    ds.startWave();
    window.advanceTime(2000);
    const inv = (ds.activeInvaders ?? []).find(i => i.active);
    if (!inv) return { ok: false, reason: 'no invader spawned' };
    inv.pathTween.pause();                    // stands in for taunt / venom / revive
    inv.applySlow(0.6, 1500);
    const afterSlow = { paused: inv.pathTween.isPaused(), timeScale: inv.pathTween.timeScale };
    inv.boostMult = 1.3;
    inv.syncPathSpeed();
    const afterBoost = { paused: inv.pathTween.isPaused(), timeScale: Number(inv.pathTween.timeScale.toFixed(3)) };
    return { ok: true, afterSlow, afterBoost, composed: Number((0.6 * 1.3).toFixed(3)) };
  });
  audit.checks.push({ id: 'speed-change-never-resumes', ...pauseCheck });
  if (!pauseCheck.ok) audit.failures.push({ id: 'speed-change-never-resumes', reason: pauseCheck.reason });
  else {
    if (!pauseCheck.afterSlow.paused) audit.failures.push({ id: 'speed-change-never-resumes', reason: 'applySlow resumed a paused tween' });
    if (!pauseCheck.afterBoost.paused) audit.failures.push({ id: 'speed-change-never-resumes', reason: 'boost/aura resumed a paused tween' });
    if (Math.abs(pauseCheck.afterBoost.timeScale - pauseCheck.composed) > 0.001) {
      audit.failures.push({ id: 'speed-composition', reason: `slow × boost = ${pauseCheck.afterBoost.timeScale}, expected ${pauseCheck.composed}` });
    }
  }

  process.stdout.write(
    `movement: slow→paused ${pauseCheck.afterSlow?.paused} · boost→paused ${pauseCheck.afterBoost?.paused} · ` +
    `composed ${pauseCheck.afterBoost?.timeScale} | samples ${sweep.samples} maxLocks ${sweep.maxLocks} ` +
    `lockedMoving ${sweep.lockedMoving} freeStopped ${sweep.freeStopped}\n`,
  );
} catch (error) {
  audit.failures.push({ reason: String(error) });
  process.stderr.write(`movement: ${error}\n`);
} finally {
  await context.close();
  await browser.close();
  await mkdir(resolve(root, 'tools'), { recursive: true });
  audit.summary = { checks: audit.checks.length, hardFailures: audit.failures.length };
  await writeFile(resolve(root, 'tools/invader-movement-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
if (audit.failures.length) process.exitCode = 1;
