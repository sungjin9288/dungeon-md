// In-page balance runner — the verify-campaign-pacing.mjs loop, run inside an open dev page.
// Headless Playwright runs slowed to minutes per slice (P5-a); inside the preview pane a battle
// takes 15–60 s. Battles run as a background queue so a 45 s tool call can poll.
//
// In the dev page console (npm run dev):
//   await import('/scripts/inpage-balance-runner.js');
//   __balanceStart([{ kind: 'tier', tier: 3, card: 'raid', seed: 1, home: 'expected' },
//                   { kind: 'stage', stageNumber: 20, home: 'lean' }]);
//   __balance.results.map(__fmt)    // poll; __balance.running is false when the queue is empty
//   __balanceTiers({ tiers: [1, 2, 3], seeds: [1, 2, 3, 4] });   // a tier sweep over several compositions
//   __balanceSummary()               // win rate · HP% spread · mean per spec (seed folded in)
//
// One battle says little: the same spec has ended at 100% and at 2% (2026-10-01). Read win rates
// over several seeds, never a single result.
//
// Replaces dungeonGameState / dungeonStageProgress with a fresh save per battle: back up the save
// first and restore it afterwards. Do not edit src/
// while a queue runs — the dev server reloads the page and the numbers mix two builds.
const TIER_REFERENCE_STAGE = [1, 8, 16, 26, 36, 46, 56, 66, 76, 86];

async function runBattle(spec) {
  const wisdom = await import('/src/data/wisdom.ts');
  const pacing = await import('/src/data/campaignPacing.ts');
  const { ALL_STAGES } = await import('/src/data/allStages.ts');
  const { NOTORIETY_BANDS } = await import('/src/data/notoriety.ts');
  const { buildBandWaves } = await import('/src/data/forecast.ts');
  const { seededRand } = await import('/src/data/daily.ts');
  // kind 'abyss': floor `spec.floor` fought by the home of campaign stage `spec.refStage`.
  const refStage = spec.kind === 'tier' ? TIER_REFERENCE_STAGE[spec.tier - 1]
    : spec.kind === 'abyss' ? spec.refStage : spec.stageNumber;
  const home = spec.home === 'starter' ? pacing.starterHome()
    : spec.home === 'expected' ? pacing.expectedHome(refStage)
    : spec.home === 'veteran' ? pacing.veteranHome(refStage)
    : pacing.leanHome(refStage);
  let stageConfig;
  let simStage;
  if (spec.kind === 'tier') {
    // Calibration (spec.budgetScale): scale the band's wave threat budget without editing src/.
    const baseBand = NOTORIETY_BANDS[spec.tier - 1];
    // spec.veteranScale does the same for veteranMult — through buildBandWaves, so head counts follow it.
    const band = {
      ...baseBand,
      ...(spec.budgetScale ? { wavePeakThreat: baseBand.wavePeakThreat * spec.budgetScale } : {}),
      ...(spec.veteranScale ? { veteranMult: baseBand.veteranMult * spec.veteranScale } : {}),
    };
    // Same seed formula as notorietyBands.test.ts.
    const built = buildBandWaves(band, spec.card, seededRand((spec.seed ?? 1) * 1000 + band.tier));
    // Calibration only: scale every non-boss group (spec.headScale) without editing src/.
    const waves = spec.headScale ? built.map(wave => ({
      ...wave,
      invaders: wave.invaders.map(group => (group.isBoss ? group : { ...group, count: Math.max(1, Math.round(group.count * spec.headScale)) })),
    })) : built;
    // Same chapter the live forecast passes (ForecastTray: chapter = bandTier) — rooms gated by
    // chapter (death messenger, armory, spirit altar…) only run from Ch3/Ch4. spec.chapter overrides.
    stageConfig = { waves, dungeonHp: band.dungeonHp, chapter: spec.chapter ?? band.tier };
    simStage = { id: 0, chapter: band.tier, waves, dungeonHp: band.dungeonHp };
  } else if (spec.kind === 'abyss') {
    // Same config AbyssScene.climb builds, for a player whose deepest clear is refStage; spec.chapter overrides.
    const { abyssBattleStageConfig } = await import('/src/data/abyssBattle.ts');
    const cleared = { stageProgress: Array.from({ length: refStage }, () => ({ bestStars: 1 })) };
    const built = abyssBattleStageConfig(spec.floor, cleared);
    stageConfig = { ...built, chapter: spec.chapter ?? built.chapter };
    simStage = { id: 0, chapter: stageConfig.chapter, waves: built.waves, dungeonHp: built.dungeonHp };
  } else {
    stageConfig = { stageNumber: spec.stageNumber };
    simStage = ALL_STAGES.find(entry => entry.id === spec.stageNumber);
  }
  // Calibration (spec.stageVeteran): swap the stage's waves for a copy at that chapter veteran
  // multiplier for this battle — the battle reads ALL_STAGES by id — and put them back after.
  const stageEntry = spec.kind === 'stage' && spec.stageVeteran ? ALL_STAGES.find(entry => entry.id === spec.stageNumber) : null;
  const originalWaves = stageEntry?.waves;
  if (stageEntry) {
    const { withChapterVeteran } = await import('/src/data/allStages.ts');
    const bare = { ...stageEntry, waves: stageEntry.waves.map(w => ({ ...w, invaders: w.invaders.map(g => { const { veteranMult: _v, ...rest } = g; return rest; }) })) };
    stageEntry.waves = withChapterVeteran(bare, spec.stageVeteran).waves;
  }
  // Calibration only (spec.chapter on a stage): run the stage's own waves inline under another chapter.
  if (spec.kind === 'stage' && spec.chapter) {
    const entry = ALL_STAGES.find(item => item.id === spec.stageNumber);
    stageConfig = { waves: entry.waves, dungeonHp: entry.dungeonHp, chapter: spec.chapter };
  }
  const sim = pacing.simulateHome(home, simStage);
  // Calibration only (spec.hpScale): raise every invader's HP for this battle, restored after it.
  const { INVADER_DEFS } = await import('/src/data/invaders.ts');
  // spec.dmgScale does the same for the damage a leak deals to the heart.
  const scaled = spec.hpScale || spec.dmgScale;
  const hpBackup = scaled ? Object.fromEntries(Object.entries(INVADER_DEFS).map(([type, def]) => [type, [def.hp, def.damage]])) : null;
  if (hpBackup) for (const def of Object.values(INVADER_DEFS)) {
    def.hp = Math.round(def.hp * (spec.hpScale ?? 1));
    def.damage = Math.round(def.damage * (spec.dmgScale ?? 1));
  }
  try {

  // Every battle starts from a NEW save. Writing the home into the previous run's save let
  // achievements, quest state, kill counters and the rest pile up across runs, and the same
  // spec drifted from 100% to an early loss over a long queue (2026-10-01).
  localStorage.removeItem('dungeonStageProgress');
  localStorage.removeItem('dungeonGameState');
  const state = wisdom.loadGameState();
  state.dmLevel = home.dmLevel;
  state.ownedMonsters = home.ownedMonsters;
  state.dungeonSlots = home.dungeonSlots;
  state.dungeonPlan = home.dungeonPlan;
  state.dungeonLicenses = { corridor: 0, side: 0, legacyCorridor: 0, legacyWisdom: 0 };
  state.tutorialStage = 99;
  state.stageProgress = state.stageProgress.map((entry, index) => ({ ...entry, unlocked: index < refStage }));
  wisdom.saveGameState(state);

  const game = window.__phaserGame;
  game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
  game.registry.remove('returnTo');
  game.registry.remove('abyssPendingFloor');
  game.registry.set('stageConfig', stageConfig);
  game.scene.start('DungeonScene');
  window.advanceTime(2000);
  if (game.scene.isActive('DungeonHomeScene')) game.scene.stop('DungeonHomeScene');
  const ds = game.scene.getScene('DungeonScene');
  const yieldToTimers = () => new Promise(resolve => setTimeout(resolve, 0));
  const pump = ms => { let left = ms; while (left > 0) { const chunk = Math.min(10000, left); window.advanceTime(chunk); left -= chunk; } };
  ds.setSpeed(3);
  const budget = spec.budget ?? 160;
  let slices = 0;
  let stalls = 0;
  while (slices < budget) {
    if (ds.dungeonHp <= 0) break;
    if (ds.wave >= ds.maxWave && !ds.waveActive) break;
    if (!ds.waveActive) {
      ds.resultOverlay?.destroy(); ds.resultOverlay = undefined; ds.prepActive = false;
      ds.startWave(); pump(1000); await yieldToTimers();
    }
    let idle = 0;
    while (slices < budget) {
      pump(2500); slices++;
      await yieldToTimers();
      const alive = (ds.activeInvaders ?? []).filter(invader => invader.active).length;
      const queued = (ds.spawnQueue ?? []).length;
      if ((!ds.waveActive && queued === 0 && alive === 0) || ds.dungeonHp <= 0) break;
      idle = ds.waveActive && alive === 0 && queued === 0 ? idle + 1 : 0;
      if (idle >= 2) { stalls++; ds.checkWaveEnd?.(); pump(500); if (ds.waveActive) ds.waveActive = false; break; }
    }
    if (ds.dungeonHp <= 0) break;
  }
  const outcome = ds.dungeonHp > 0 && ds.wave >= ds.maxWave ? 'win' : ds.dungeonHp <= 0 ? 'loss' : 'unsettled';
  const result = {
    spec, refStage, dm: home.dmLevel, rooms: home.slotCount, roomLv: home.roomLevel, roster: home.roster.length,
    simWin: sim.winPct, outcome, hpPct: Math.round((Math.max(0, ds.dungeonHp) / ds.maxHp) * 100),
    waves: `${ds.wave}/${ds.maxWave}`, stalls, slices,
  };
  game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
  return result;
  } finally {
    if (stageEntry && originalWaves) stageEntry.waves = originalWaves;
    if (hpBackup) for (const [type, [hp, damage]] of Object.entries(hpBackup)) { INVADER_DEFS[type].hp = hp; INVADER_DEFS[type].damage = damage; }
  }
}

window.__balance = window.__balance ?? { queue: [], results: [], running: false };
window.__balanceRun = runBattle;
window.__balanceStart = specs => {
  const state = window.__balance;
  state.queue.push(...specs);
  if (state.running) return 'queued';
  state.running = true;
  (async () => {
    while (state.queue.length) {
      const spec = state.queue.shift();
      try { state.results.push(await runBattle(spec)); }
      catch (error) { state.results.push({ spec, error: String(error) }); }
    }
    state.running = false;
  })();
  return 'started';
};
window.__fmt = r => {
  if (r.error) return JSON.stringify(r);
  const head = r.spec.kind === 'tier' ? `T${r.spec.tier}${r.spec.card[0]} s${r.spec.seed ?? 1}${r.spec.headScale ? ` x${r.spec.headScale}` : ''}${r.spec.hpScale ? ` hp${r.spec.hpScale}` : ''}${r.spec.dmgScale ? ` dmg${r.spec.dmgScale}` : ''}${r.spec.budgetScale ? ` b${r.spec.budgetScale}` : ''}${r.spec.veteranScale ? ` v${r.spec.veteranScale}` : ''}${r.spec.chapter ? ` c${r.spec.chapter}` : ''}` : r.spec.kind === 'abyss' ? `A${r.spec.floor}@${r.spec.refStage} ${r.spec.home}${r.spec.chapter ? ` c${r.spec.chapter}` : ''}` : `S${r.spec.stageNumber} ${r.spec.home}${r.spec.hpScale ? ` hp${r.spec.hpScale}` : ''}${r.spec.stageVeteran ? ` v${r.spec.stageVeteran}` : ''}${r.spec.chapter ? ` c${r.spec.chapter}` : ''}`;
  return `${head} → ${r.outcome} ${r.hpPct}% ${r.waves}${r.stalls ? ` st${r.stalls}` : ''}`;
};

/** Queue every tier × seed (raid unless `cards` says otherwise). Every tier uses the lean home (P5-q). */
window.__balanceTiers = ({ tiers, seeds = [1, 2, 3, 4], cards = ['raid'], budgetScale, veteranScale }) => window.__balanceStart(
  tiers.flatMap(tier => seeds.flatMap(seed => cards.map(card => ({
    kind: 'tier', tier, card, seed, home: 'lean',
    ...(budgetScale ? { budgetScale: typeof budgetScale === 'number' ? budgetScale : budgetScale[tier] } : {}),
    ...(veteranScale ? { veteranScale: typeof veteranScale === 'number' ? veteranScale : veteranScale[tier] } : {}),
  })))),
);

/** Per spec with the seed folded out: wins/attempts, HP% sorted, mean HP% (losses count as 0). */
window.__balanceSummary = () => {
  const groups = new Map();
  for (const r of window.__balance.results) {
    if (r.error) continue;
    const { seed: _seed, ...rest } = r.spec;
    const key = JSON.stringify(rest);
    const entry = groups.get(key) ?? { spec: rest, wins: 0, attempts: 0, hp: [] };
    entry.attempts++;
    if (r.outcome === 'win') entry.wins++;
    entry.hp.push(r.outcome === 'win' ? r.hpPct : 0);
    groups.set(key, entry);
  }
  return [...groups.values()].map(entry => {
    const label = entry.spec.kind === 'tier' ? `T${entry.spec.tier}${entry.spec.card[0]} ${entry.spec.home}` : `S${entry.spec.stageNumber} ${entry.spec.home}`;
    const mean = Math.round(entry.hp.reduce((a, b) => a + b, 0) / entry.hp.length);
    return `${label}: ${entry.wins}/${entry.attempts} wins · hp ${[...entry.hp].sort((a, b) => a - b).join(',')} · mean ${mean}`;
  });
};
