/**
 * Context builder functions extracted from DungeonScene.
 *
 * Each function takes a DungeonScene instance and returns the context object
 * required by the corresponding combat subsystem. DungeonScene is imported as
 * a TYPE ONLY to avoid a circular-dependency at runtime.
 */
import type { DungeonScene } from '../scenes/DungeonScene';
import type { ObjectiveType } from '../data/quests';
import { loadGameState, saveGameState } from '../data/wisdom';
import { type RoomInputContext, showRepairOption as _showRepairOption, type RepairUIContext } from './RoomInput';
import { type ActiveSkillContext } from './ActiveSkills';
import { type WaveStartContext } from './WaveStart';
import { type SpawnPipelineContext } from './SpawnPipeline';
import { type CombatResolverContext } from './CombatResolver';
import { type BossContext } from './BossBehaviors';
import { type ResultFlowContext } from './ResultFlow';
import { type RoomMechanicsContext } from './RoomMechanics';
import { type CheckWaveEndContext } from './WaveLifecycle';
import { type WaveEventContext } from './WaveEvents';
import { type KillHandlerContext } from './KillHandler';
import { type BattleEventContext } from './BattleEventHandlers';
import { type GameplayInitContext } from './GameplayInit';
import { type QuestTrackerContext } from './QuestTracker';
import {
  showFloatText as _showFloatText,
  showGoldFloat as _showGoldFloat,
  showHealEffect as _showHealEffect,
  showSoulHarvestExec as _showSoulHarvestExec,
} from './VisualEffects';
import { showTigersPounce as _showTigersPounce } from './ImpactVfx';
import {
  triggerChainLightning as _triggerChainLightning,
  triggerScrollBurst as _triggerScrollBurst,
  triggerSpectralBolt as _triggerSpectralBolt,
  triggerWhirlwind as _triggerWhirlwind,
  updateArmoryBonuses as _updateArmoryBonuses,
} from './RoomTriggers';
import { spawnGhostWarrior as _spawnGhostWarrior } from './RoomMechanics';
import { applyInvaderBehavior } from './InvaderBehaviors';
import { setupWeeklyBossPhases } from './WeeklyBossBehavior';
import { hasDivineTerritory } from './GridQueries';
import { applyRoomSlotDamage as _applyRoomSlotDamage } from './RoomDurability';
import { saveRoomHpsToGameState as _saveRoomHpsToGameState } from './RoomDurability';
import { paintWaveButton } from './DungeonLayout';
import { grantMonsterXp as _grantMonsterXp } from './QuestTracker';
import { spawnCoinFlyEffect as _spawnCoinFlyEffect } from './RoomVfx';

// ─── RoomInput ────────────────────────────────────────────────────────────────

export function buildRoomInputCtx(ds: DungeonScene): RoomInputContext {
  return {
    waveActive:           ds.waveActive,
    equipmentMap:         ds.equipmentMap,
    skillCooldowns:       ds.skillCooldowns,
    speedMult:            ds.speedMult,
    nowMs:                ds.time.now,
    get targetingSkillId()    { return ds.targetingSkillId; },
    set targetingSkillId(v)   { ds.targetingSkillId = v; },
    get skillPopup()          { return ds.skillPopup; },
    set skillPopup(v)         { ds.skillPopup = v; },
    isInSwapMode:       ()          => ds.swapManager?.isInSwapMode() ?? false,
    routeSwapTap:       (r, c)      => ds.swapManager?.onRoomTap(r, c),
    startSwapPress:     (r, c)      => ds.swapManager?.onRoomPointerDown(r, c),
    activateSkill:      (id, room)  => ds.activateSkill(id, room),
    showSkillCooldown:  (id, ms)    => ds.skillHUD?.startCooldown(id, ms),
    clearSkillSelection:()          => ds.skillHUD?.clearSelection(),
    showRepairOption:   (r, c)      => _showRepairOption(buildRepairCtx(ds), r, c),
    showSkillPopup:     (r)         => ds.showSkillPopup(r),
    showRangePreview:   (r, c, rng) => ds.showRangePreview(r, c, rng),
  };
}

export function buildRepairCtx(ds: DungeonScene): RepairUIContext {
  return {
    scene:    ds,
    roomGrid: ds.roomGrid,
    rooms:    ds.rooms,
    get gold() { return ds.gold; },
    showFloatText: (x, y, t, c) => _showFloatText(ds, x, y, t, c),
    setGold: (v) => { ds.gold = v; ds.registry.set('gold', v); },
  };
}

// ─── ActiveSkills ─────────────────────────────────────────────────────────────

export function buildActiveSkillContext(ds: DungeonScene, room: import('../objects/Room').Room): ActiveSkillContext {
  return {
    scene:             ds,
    room,
    activeInvaders:    ds.activeInvaders.filter(i => i.active && !i.isDead),
    effectiveCellSize: ds.effectiveCellSize,
    roomGrid:          ds.roomGrid,
    rooms:             ds.rooms,
    now:               ds.time.now,
    addGold: (amount) => {
      ds.gold += amount;
      ds.registry.set('gold', ds.gold);
    },
    showGoldFloat:     (text, x, y) => _showGoldFloat(ds, text, x, y),
    spawnGhostWarrior: (r, c)       => _spawnGhostWarrior(buildRoomMechanicsCtx(ds), r, c),
  };
}

// ─── WaveStart ────────────────────────────────────────────────────────────────

export function buildWaveStartCtx(ds: DungeonScene): WaveStartContext {
  return {
    scene:             ds,
    maxWave:           ds.maxWave,
    isEndless:         ds.isEndless,
    endlessHighScore:  ds.endlessHighScore,
    stageChapter:      ds.stageChapter,
    maxHp:             ds.maxHp,
    effectiveCellSize: ds.effectiveCellSize,
    roomGrid:          ds.roomGrid,
    waveConfigs:       ds.waveConfigs,
    dungeonTrapSlots:  ds.dungeonTrapSlots,
    activeInvaders:    ds.activeInvaders,
    get wave()                 { return ds.wave; },
    set wave(v)                { ds.wave = v; },
    get waveActive()           { return ds.waveActive; },
    set waveActive(v)          { ds.waveActive = v; },
    get endlessRecordBroken()  { return ds.endlessRecordBroken; },
    set endlessRecordBroken(v) { ds.endlessRecordBroken = v; },
    get waveEndChecked()       { return ds.waveEndChecked; },
    set waveEndChecked(v)      { ds.waveEndChecked = v; },
    get waveHasSpawned()       { return ds.waveHasSpawned; },
    set waveHasSpawned(v)      { ds.waveHasSpawned = v; },
    get dungeonHp()            { return ds.dungeonHp; },
    set dungeonHp(v)           { ds.dungeonHp = v; },
    get recentlyDeadInvaders()    { return ds.recentlyDeadInvaders; },
    set recentlyDeadInvaders(v)   { ds.recentlyDeadInvaders = v; },
    get tauntBoostActiveUntil()   { return ds.tauntBoostActiveUntil; },
    set tauntBoostActiveUntil(v)  { ds.tauntBoostActiveUntil = v; },
    get killsThisWave()        { return ds.killsThisWave; },
    set killsThisWave(v)       { ds.killsThisWave = v; },
    get breakthruCount()       { return ds.breakthruCount; },
    set breakthruCount(v)      { ds.breakthruCount = v; },
    get waveStartSlotHps()     { return ds.waveStartSlotHps; },
    set waveStartSlotHps(v)    { ds.waveStartSlotHps = v; },
    get waveStartDungeonHp()   { return ds.waveStartDungeonHp; },
    set waveStartDungeonHp(v)  { ds.waveStartDungeonHp = v; },
    get waveInvaderTotal()     { return ds.waveInvaderTotal; },
    set waveInvaderTotal(v)    { ds.waveInvaderTotal = v; },
    get killCounterText()      { return ds.killCounterText; },
    set killCounterText(v)     { ds.killCounterText = v; },
    get waveGoldMult()         { return ds.waveGoldMult; },
    set waveGoldMult(v)        { ds.waveGoldMult = v; },
    get waveHpMult()           { return ds.waveHpMult; },
    set waveHpMult(v)          { ds.waveHpMult = v; },
    get waveAtkMult()          { return ds.waveAtkMult; },
    set waveAtkMult(v)         { ds.waveAtkMult = v; },
    get waveSpdMult()          { return ds.waveSpdMult; },
    set waveSpdMult(v)         { ds.waveSpdMult = v; },
    get waveFogOverlay()       { return ds.waveFogOverlay; },
    set waveFogOverlay(v)      { ds.waveFogOverlay = v; },
    get spawnQueue()           { return ds.spawnQueue; },
    set spawnQueue(v)          { ds.spawnQueue = v; },
    setWaveRegistry:    (v)   => ds.registry.set('wave', v),
    setHpRegistry:      (v)   => ds.registry.set('hp', v),
    setWaveLabelText:   (t, c) => ds.waveLabel.setText(t).setColor(c),
    disableWaveButton:  ()    => { ds.waveBtnBg.setAlpha(0.4); ds.waveBtnZone.disableInteractive(); },
    hasSynergy:         (id)  => ds.synergyManager.hasSpecial(id),
    updateArmoryBonuses:()    => _updateArmoryBonuses(buildRoomMechanicsCtx(ds)),
    triggerScrollBurst: (d)   => _triggerScrollBurst(buildRoomMechanicsCtx(ds), d),
    showBossWarning:    ()    => ds.showBossWarning(),
    processSpawnQueue:  (dl)  => ds.processSpawnQueue(dl),
    showEndlessMilestoneToast: () => ds.showEndlessMilestoneToast(),
    showWaveEnemyPreview:      () => ds._showWaveEnemyPreview(),
  };
}

// ─── SpawnPipeline ────────────────────────────────────────────────────────────

export function buildSpawnPipelineCtx(ds: DungeonScene): SpawnPipelineContext {
  return {
    scene:           ds,
    invaderPath:     ds.invaderPath,
    waveHpMult:      ds.waveHpMult,
    waveSpdMult:     ds.waveSpdMult,
    dailySpeedMult:  ds.dailyMode?.modifiers.invaderSpeedMult ?? 1,
    weeklyBoss:      ds.weeklyBossMode,
    seenTraits:      ds.seenTraitBehaviors,
    get waveActive()     { return ds.waveActive; },
    get activeInvaders() { return ds.activeInvaders; },
    get spawnQueue()     { return ds.spawnQueue; },
    set spawnQueue(v)    { ds.spawnQueue = v; },
    set waveHasSpawned(v: boolean) { ds.waveHasSpawned = v; },
    setRemainingInvadersRegistry: (n) => ds.registry.set('remainingInvaders', n),
    hasSynergy:   (id)       => ds.synergyManager.hasSpecial(id),
    applyBehavior: (inv, def) => {
      // Weekly boss mode: the boss runs the generic raid phase ruleset
      // instead of its native chapter behavior; escorts stay native.
      const weekly = ds.weeklyBossMode;
      if (weekly && def.type === weekly.bossType) {
        setupWeeklyBossPhases(buildBossCtx(ds), inv, weekly);
      } else {
        applyInvaderBehavior(buildBossCtx(ds), inv, def);
      }
    },
  };
}

// ─── CombatResolver ──────────────────────────────────────────────────────────

export function buildCombatResolverCtx(ds: DungeonScene): CombatResolverContext {
  return {
    scene:             ds,
    rooms:             ds.rooms,
    roomGrid:          ds.roomGrid,
    activeInvaders:    ds.activeInvaders,
    effectiveCols:     ds.effectiveCols,
    effectiveCellSize: ds.effectiveCellSize,
    equipmentMap:      ds.equipmentMap,
    guardianAtkMult:   ds.guardianAtkMult,
    waveAtkMult:       ds.waveAtkMult,
    wisdomBonuses:     ds.wisdomBonuses,
    prestigeDmgMult:   ds.prestigeDmgMult,
    speedMult:         ds.speedMult,
    get gold()               { return ds.gold; },
    set gold(v)              { ds.gold = v; },
    get tauntBoostActiveUntil() { return ds.tauntBoostActiveUntil; },
    setGoldRegistry:         (v)          => ds.registry.set('gold', v),
    hasSynergy:              (id)         => ds.synergyManager.hasSpecial(id),
    applyWarHexToHighestHP:  ()           => ds.applyWarHexToHighestHP(),
    triggerTauntingRoar:     (rx, ry)     => ds.triggerTauntingRoar(rx, ry),
    triggerSpectralBolt:     (rx, cy, r, d) => _triggerSpectralBolt(buildRoomMechanicsCtx(ds), rx, cy, r, d),
    triggerWhirlwind:        (r, d, rx, cy) => _triggerWhirlwind(buildRoomMechanicsCtx(ds), r, d, rx, cy),
    triggerChainLightning:   (src, cd, mc) => _triggerChainLightning(buildRoomMechanicsCtx(ds), src, cd, mc),
  };
}

// ─── BossContext ──────────────────────────────────────────────────────────────

export function buildBossCtx(ds: DungeonScene): BossContext {
  return {
    scene: ds,
    activeInvaders: ds.activeInvaders,
    rooms: ds.rooms,
    roomGrid: ds.roomGrid,
    get effectiveCols() { return ds.effectiveCols; },
    get effectiveCellSize() { return ds.effectiveCellSize; },
    get speedMult() { return ds.speedMult; },
    invaderPath: ds.invaderPath,
    bossHud: ds.getBossHud(),
    showFloatText: (x, y, text, color) => _showFloatText(ds, x, y, text, color),
    spawnInvader: (type) => ds.spawnInvader(type),
    triggerChainLightning: (source, chainDmg, maxChains) => _triggerChainLightning(buildRoomMechanicsCtx(ds), source, chainDmg, maxChains),
  };
}

// ─── ResultFlow ───────────────────────────────────────────────────────────────

export function buildResultFlowCtx(ds: DungeonScene): ResultFlowContext {
  return {
    scene: ds,
    get effectiveCols() { return ds.effectiveCols; },
    get effectiveCellSize() { return ds.effectiveCellSize; },
    get dungeonHp() { return ds.dungeonHp; },
    get maxHp() { return ds.maxHp; },
    get gold() { return ds.gold; },
    get gems() { return ds.gems; },
    get wave() { return ds.wave; },
    get maxWave() { return ds.maxWave; },
    get stageChapter() { return ds.stageChapter; },
    get isEndless() { return ds.isEndless; },
    get waveActive() { return ds.waveActive; },
    get killsThisRun() { return ds.killsThisRun; },
    get killsThisWave() { return ds.killsThisWave; },
    get breakthruCount() { return ds.breakthruCount; },
    get goldEarnedThisRun() { return ds.goldEarnedThisRun; },
    get materialsEarnedThisRun() { return ds.materialsEarnedThisRun; },
    get waveGoldMult() { return ds.waveGoldMult; },
    get waveEndChecked() { return ds.waveEndChecked; },
    get waveHasSpawned() { return ds.waveHasSpawned; },
    get prepActive() { return ds.prepActive; },
    get prepTimer() { return ds.prepTimer; },
    get returnTo() { return ds.returnTo; },
    get dailyMode() { return ds.dailyMode; },
    get weeklyBossMode() { return ds.weeklyBossMode; },
    get wisdomBonuses() { return ds.wisdomBonuses; },
    get waveConfigs() { return ds.waveConfigs; },
    get dungeonTrapSlots() { return ds.dungeonTrapSlots; },
    get waveStartSlotHps() { return ds.waveStartSlotHps; },
    activeInvaders: ds.activeInvaders,
    get waveBtnBg() { return ds.waveBtnBg; },
    get waveBtnZone() { return ds.waveBtnZone; },
    get waveLabel() { return ds.waveLabel; },
    get resultOverlay() { return ds.resultOverlay; },
    get countdownBar() { return ds.countdownBar; },
    rooms: ds.rooms,
    roomGrid: ds.roomGrid,
    drawBtn: (g, x, y, w, h, hover) => paintWaveButton(g, x, y, w, h, hover),
    startWave: () => ds.startWave(),
    grantMonsterXp: (amount) => _grantMonsterXp(buildQuestTrackerCtx(ds), amount),
    saveRoomHpsToGameState: () => _saveRoomHpsToGameState(ds.dungeonTrapSlots),
    showFloatText: (x, y, text, color) => _showFloatText(ds, x, y, text, color),
    showEndlessResult: () => ds.showEndlessResult(),
    checkAchievementsAndToast: (gs) => ds.checkAchievementsAndToast(gs),
    tickQuestAndNotify: (gs, type, amount) => ds.tickQuestAndNotify(gs, type as ObjectiveType, amount),
    setDungeonHp: (hp) => { ds.dungeonHp = hp; ds.registry.set('hp', hp); },
    setGold: (g) => { ds.gold = g; ds.registry.set('gold', g); },
    setGems: (g) => {
      ds.gems = g;
      ds.registry.set('gems', g);
      // Gems are global currency — persist immediately so revive costs survive
      // battle exit (gold/crystals settle at battle end; gems do not).
      saveGameState({ ...loadGameState(), gems: g });
    },
    setWave: (w) => { ds.wave = w; ds.registry.set('wave', w); },
    setWaveActive: (v) => { ds.waveActive = v; },
    setWaveEndChecked: (v) => { ds.waveEndChecked = v; },
    setWaveHasSpawned: (v) => { ds.waveHasSpawned = v; },
    setPrepActive: (v) => { ds.prepActive = v; },
    setPrepTimer: (v) => { ds.prepTimer = v; },
    setResultOverlay: (ov) => { ds.resultOverlay = ov; },
    setCountdownBar: (bar) => { ds.countdownBar = bar; },
  };
}

// ─── RoomMechanics ────────────────────────────────────────────────────────────

export function buildRoomMechanicsCtx(ds: DungeonScene): RoomMechanicsContext {
  return {
    scene: ds,
    roomGrid: ds.roomGrid,
    rooms: ds.rooms,
    activeInvaders: ds.activeInvaders,
    get effectiveCols() { return ds.effectiveCols; },
    get effectiveCellSize() { return ds.effectiveCellSize; },
    get waveActive() { return ds.waveActive; },
    invaderPath: ds.invaderPath,
    get stageChapter() { return ds.stageChapter; },
    get gold() { return ds.gold; },
    set gold(v) { ds.gold = v; },
    get dungeonHp() { return ds.dungeonHp; },
    set dungeonHp(v) { ds.dungeonHp = v; },
    get maxHp() { return ds.maxHp; },
    dungeonTrapSlots: ds.dungeonTrapSlots,
    trapMastery:       ds.trapMastery,
    guardianAtkMult:   ds.guardianAtkMult,
    slotTrapSynergyMult: ds.slotTrapSynergyMult,
    decorationTrapMult: 1 + (ds.decorationBonuses?.trapDmgPct ?? 0) / 100,
    extraMonsterCooldowns: ds.extraMonsterCooldowns,
    get tauntBoostActiveUntil() { return ds.tauntBoostActiveUntil; },
    get speedMult() { return ds.speedMult; },
    pounceReadyMap: ds.pounceReadyMap,
    get medicineHealTick() { return ds.medicineHealTick; },
    set medicineHealTick(v) { ds.medicineHealTick = v; },
    get medicineGlobalPulseLast() { return ds.medicineGlobalPulseLast; },
    set medicineGlobalPulseLast(v) { ds.medicineGlobalPulseLast = v; },
    get poisonDamageTick() { return ds.poisonDamageTick; },
    set poisonDamageTick(v) { ds.poisonDamageTick = v; },
    get entrancingVeilApplied() { return ds.entrancingVeilApplied; },
    set entrancingVeilApplied(v) { ds.entrancingVeilApplied = v; },
    setGoldRegistry: (g) => ds.registry.set('gold', g),
    showGoldFloat: (text, x, y) => _showGoldFloat(ds, text, x, y),
    showTigersPounce: (rx, ry, tx, ty) => _showTigersPounce(ds, rx, ry, tx, ty),
    showHealEffect: (healer, target, amount) => _showHealEffect(ds, healer, target, amount),
    showSoulHarvestExec: (x, y) => _showSoulHarvestExec(ds, x, y),
    showFloatText: (x, y, text, color) => _showFloatText(ds, x, y, text, color),
    flashRoom: (row, col) => ds.rooms[row][col].flashAttack(),
    healRoomHp: (row, col, amount) => ds.rooms[row][col].healRoomHp(amount),
    damageRoomHp: (row, col, amount) => ds.rooms[row][col].damageRoomHp(amount),
    hasDivineTerritory: () => hasDivineTerritory(ds.roomGrid),
    pushInvader: (inv) => ds.activeInvaders.push(inv),
  };
}

// ─── CheckWaveEnd ─────────────────────────────────────────────────────────────

export function buildCheckWaveEndCtx(ds: DungeonScene): CheckWaveEndContext {
  return {
    scene:              ds,
    wave:               ds.wave,
    maxWave:            ds.maxWave,
    waveStartDungeonHp: ds.waveStartDungeonHp,
    maxHp:              ds.maxHp,
    get waveEndChecked()        { return ds.waveEndChecked; },
    set waveEndChecked(v)       { ds.waveEndChecked = v; },
    get waveHasSpawned()        { return ds.waveHasSpawned; },
    get spawnQueue()            { return ds.spawnQueue; },
    get activeInvaders()        { return ds.activeInvaders; },
    set activeInvaders(v)       { ds.activeInvaders = v; },
    get killCounterText()       { return ds.killCounterText; },
    set killCounterText(v)      { ds.killCounterText = v; },
    get waveActive()            { return ds.waveActive; },
    set waveActive(v)           { ds.waveActive = v; },
    get dungeonHp()             { return ds.dungeonHp; },
    get consecutiveNoDmgWaves() { return ds.consecutiveNoDmgWaves; },
    set consecutiveNoDmgWaves(v){ ds.consecutiveNoDmgWaves = v; },
    saveRoomHpsToGameState: () => _saveRoomHpsToGameState(ds.dungeonTrapSlots),
    showChapterClear:       () => ds.showChapterClear(),
    showWaveClear:          () => ds.showWaveClear(),
  };
}

// ─── WaveEvent ────────────────────────────────────────────────────────────────

export function buildWaveEventCtx(ds: DungeonScene): WaveEventContext {
  return {
    scene: ds,
    get wave() { return ds.wave; },
    get maxWave() { return ds.maxWave; },
    get isEndless() { return ds.isEndless; },
    get waveConfigs() { return ds.waveConfigs; },
    get theme() { return ds.theme; },
    get synergyHasMoonlightHealUp() { return ds.synergyManager.hasSpecial('MOONLIGHT_HEAL_UP'); },
    get maxHp() { return ds.maxHp; },
    get stageNumber() { return ds.stageNumber; },
    get waveGoldMult() { return ds.waveGoldMult; },
    set waveGoldMult(v) { ds.waveGoldMult = v; },
    get waveHpMult() { return ds.waveHpMult; },
    set waveHpMult(v) { ds.waveHpMult = v; },
    get waveAtkMult() { return ds.waveAtkMult; },
    set waveAtkMult(v) { ds.waveAtkMult = v; },
    get waveSpdMult() { return ds.waveSpdMult; },
    set waveSpdMult(v) { ds.waveSpdMult = v; },
    get waveFogOverlay() { return ds.waveFogOverlay; },
    set waveFogOverlay(v) { ds.waveFogOverlay = v; },
    get dungeonHp() { return ds.dungeonHp; },
    set dungeonHp(v) { ds.dungeonHp = v; },
    startWave: () => ds.startWave(),
    setRegistryHp: (hp) => ds.registry.set('hp', hp),
  };
}

// ─── KillHandler ─────────────────────────────────────────────────────────────

export function buildKillHandlerCtx(ds: DungeonScene): KillHandlerContext {
  return {
    scene:                   ds,
    equipmentMap:            ds.equipmentMap,
    materialsEarnedThisRun:  ds.materialsEarnedThisRun,
    get killCounterText()    { return ds.killCounterText; },
    get waveInvaderTotal()   { return ds.waveInvaderTotal; },
    roomGrid:                ds.roomGrid,
    get wave()               { return ds.wave; },
    get maxWave()            { return ds.maxWave; },
    get isEndless()          { return ds.isEndless; },
    get waveActive()         { return ds.waveActive; },
    get maxHp()              { return ds.maxHp; },
    get stageChapter()       { return ds.stageChapter; },
    get effectiveCols()      { return ds.effectiveCols; },
    get gold()               { return ds.gold; },
    set gold(v)              { ds.gold = v; },
    get killsThisRun()       { return ds.killsThisRun; },
    set killsThisRun(v)      { ds.killsThisRun = v; },
    get killsThisWave()      { return ds.killsThisWave; },
    set killsThisWave(v)     { ds.killsThisWave = v; },
    get goldEarnedThisRun()  { return ds.goldEarnedThisRun; },
    set goldEarnedThisRun(v) { ds.goldEarnedThisRun = v; },
    get killComboCount()     { return ds.killComboCount; },
    set killComboCount(v)    { ds.killComboCount = v; },
    get lastKillTime()       { return ds.lastKillTime; },
    set lastKillTime(v)      { ds.lastKillTime = v; },
    get activeInvaders()     { return ds.activeInvaders; },
    set activeInvaders(v)    { ds.activeInvaders = v; },
    get dungeonHp()          { return ds.dungeonHp; },
    set dungeonHp(v)         { ds.dungeonHp = v; },
    get hexedInvader()       { return ds.hexedInvader; },
    set hexedInvader(v)      { ds.hexedInvader = v; },
    get recentlyDeadInvaders()    { return ds.recentlyDeadInvaders; },
    set recentlyDeadInvaders(v)   { ds.recentlyDeadInvaders = v; },
    setGoldRegistry:              (v) => ds.registry.set('gold', v),
    setHpRegistry:                (v) => ds.registry.set('hp', v),
    setRemainingInvadersRegistry: (n) => ds.registry.set('remainingInvaders', n),
    hasSynergy:                   (id) => ds.synergyManager.hasSpecial(id),
    spawnInvader:                 (type) => ds.spawnInvader(type),
    spawnCoinFlyEffect:           (x, y) => _spawnCoinFlyEffect(ds, x, y),
    checkAchievementsAndToast:    (gs) => ds.checkAchievementsAndToast(gs),
    applyWarHexToHighestHP:       () => ds.applyWarHexToHighestHP(),
    grantMonsterXp:               (amount) => _grantMonsterXp(buildQuestTrackerCtx(ds), amount),
    hasDivineTerritory:           () => hasDivineTerritory(ds.roomGrid),
  };
}

// ─── BattleEvent ─────────────────────────────────────────────────────────────

export function buildBattleEventCtx(ds: DungeonScene): BattleEventContext {
  return {
    scene:          ds,
    wisdomBonuses:  ds.wisdomBonuses,
    roomGrid:       ds.roomGrid,
    rooms:          ds.rooms,
    effectiveCols:  ds.effectiveCols,
    speedMult:      ds.speedMult,
    maxHp:          ds.maxHp,
    get dungeonHp()              { return ds.dungeonHp; },
    set dungeonHp(v)             { ds.dungeonHp = v; },
    get activeInvaders()         { return ds.activeInvaders; },
    set activeInvaders(v)        { ds.activeInvaders = v; },
    get gold()                   { return ds.gold; },
    set gold(v)                  { ds.gold = v; },
    get hexedInvader()           { return ds.hexedInvader; },
    set hexedInvader(v)          { ds.hexedInvader = v; },
    get tauntBoostActiveUntil()  { return ds.tauntBoostActiveUntil; },
    set tauntBoostActiveUntil(v) { ds.tauntBoostActiveUntil = v; },
    get breakthruCount()         { return ds.breakthruCount; },
    set breakthruCount(v)        { ds.breakthruCount = v; },
    hasSynergy:         (id)  => ds.synergyManager.hasSpecial(id),
    applyRoomSlotDamage:(pct) => _applyRoomSlotDamage(ds.dungeonTrapSlots, pct),
    triggerWaveFail:    ()    => ds.triggerWaveFail(),
    updateLowHpVignette:()    => ds.updateLowHpVignette(),
    setHpRegistry:      (v)   => ds.registry.set('hp', v),
    setGoldRegistry:    (v)   => ds.registry.set('gold', v),
  };
}

// ─── GameplayInit ─────────────────────────────────────────────────────────────

export function buildGameplayInitCtx(ds: DungeonScene): GameplayInitContext {
  return {
    scene:         ds,
    roomGrid:      ds.roomGrid,
    rooms:         ds.rooms,
    effectiveCols: ds.effectiveCols,
    effectiveCellSize: ds.effectiveCellSize,
    setTargetingSkillId: (v) => { ds.targetingSkillId = v; },
    setSkillHUD:         (v) => { ds.skillHUD = v; },
    setSwapManager:      (v) => { ds.swapManager = v; },
  };
}

// ─── QuestTracker ─────────────────────────────────────────────────────────────

export function buildQuestTrackerCtx(ds: DungeonScene): QuestTrackerContext {
  return { scene: ds };
}
