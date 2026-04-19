/**
 * SummonPullLogic — pull execution logic for SummonScene.
 * Extracted from SummonScene.executePull (~664-805).
 */

import { loadGameState, saveGameState, type SummonRarity, type SummonRecord } from '../data/wisdom';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { defaultOwnedMonster } from '../data/barracks';
import { audioManager } from '../audio/AudioManager';
import { applyBannerBoost, type SeasonBanner } from '../data/banners';
import { logger } from '../utils/logger';
import {
  type SummonType, SUMMON_TYPE_DEFS,
  RARITY_RATES, RARITIES, RARITY_KO, SC_COMP, RARITY_POOLS, rollRarity,
} from '../data/summonPools';
import { playSinglePullAnimation, playMultiPullAnimation } from './SummonAnimations';
import type Phaser from 'phaser';

/** A single pull result passed to the animation layer. */
export interface PullResult {
  monsterId: MonsterId;
  rarity:    SummonRarity;
  rarityIdx: number;
  isNew:     boolean;
  scComp:    number;
  ceilingHit: boolean;
}

/** External context the pull logic needs from the scene. */
export interface PullContext {
  scene: Phaser.Scene;
  activeBanner: SeasonBanner | null;
  showToast: (msg: string) => void;
}

/**
 * Executes a summon pull (1 or 10 times), deducts currency, updates state,
 * plays SFX, and triggers the pull animation.
 */
export function executePull(ctx: PullContext, type: SummonType, count: number): void {
  const gs = loadGameState();

  // ── Local accumulators (avoid mutating gs directly) ───────────
  let newGems         = gs.gems;
  let newSoulCrystals = gs.soulCrystals;
  let lastFriendSummon = gs.lastFriendSummon;

  // ── Currency check ────────────────────────────────────────────
  const def = SUMMON_TYPE_DEFS.find(d => d.id === type)!;
  if (type === 'friendship') {
    const today = new Date().toISOString().slice(0, 10);
    if (gs.lastFriendSummon === today) {
      ctx.showToast('오늘의 무료 소환을 이미 사용했습니다');
      return;
    }
  } else {
    const cost = count === 1 ? def.cost1 : (def.cost10 ?? def.cost1 * count);
    if (def.currency === 'gems') {
      if (gs.gems < cost) { ctx.showToast(`💎 부족 (${gs.gems}/${cost})`); return; }
      newGems -= cost;
    } else if (def.currency === 'soul') {
      if (gs.soulCrystals < cost) { ctx.showToast(`💠 부족 (${gs.soulCrystals}/${cost})`); return; }
      newSoulCrystals -= cost;
    }
  }

  // ── Unlock-gated pool helper ──────────────────────────────────
  // Filter each rarity pool to monsters whose unlockStage <= player's highest cleared stage.
  const highestCleared = (gs.stageProgress ?? []).reduce(
    (max: number, p: { bestStars?: number }, idx: number) => (p?.bestStars ?? 0) > 0 ? idx + 1 : max, 0,
  );
  const getPool = (rarity: SummonRarity): MonsterId[] => {
    const base = RARITY_POOLS[rarity];
    if (highestCleared <= 0) return base;
    return base.filter(id => {
      const mDef = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS];
      return !mDef || (mDef.unlockStage ?? 1) <= highestCleared;
    });
  };

  // ── Roll results ──────────────────────────────────────────────
  const results: PullResult[] = [];

  // Local mutable copies for loop accumulation
  const pity = gs.summonPity
    ? { normal: { ...gs.summonPity.normal }, special: { ...gs.summonPity.special } }
    : { normal: { count: 0, guaranteed: 50 }, special: { count: 0, guaranteed: 80 } };
  const newMonsters = [...gs.ownedMonsters];
  const newHistory  = [...(gs.summonHistory ?? [])];

  for (let i = 0; i < count; i++) {
    let rarityIdx: number;
    let ceilingHit = false;

    // Pity check
    if ((type === 'normal' || type === 'special') && pity[type]) {
      pity[type].count++;
      if (pity[type].count >= pity[type].guaranteed) {
        rarityIdx  = type === 'normal' ? 3 : 4; // epic / legendary
        ceilingHit = true;
        pity[type].count = 0;
      } else {
        rarityIdx = rollRarity(RARITY_RATES[type]);
      }
    } else {
      rarityIdx = rollRarity(RARITY_RATES[type]);
    }

    const rarity = RARITIES[rarityIdx];
    const pool   = getPool(rarity);

    // Soul summon: prefer unowned
    let monsterId: MonsterId;
    if (type === 'soul') {
      const ownedIds = new Set(newMonsters.map(m => m.id));
      const unowned  = pool.filter(id => !ownedIds.has(id));
      const pick     = unowned.length > 0 ? unowned : pool;
      monsterId = pick[Math.floor(Math.random() * pick.length)] as MonsterId;
    } else if (
      ctx.activeBanner &&
      (ctx.activeBanner.validSummonTypes as string[]).includes(type) &&
      !ceilingHit
    ) {
      // ── Banner boost: bias towards featured monsters ───────────
      monsterId = applyBannerBoost(ctx.activeBanner, rarity, pool) as MonsterId;
    } else {
      monsterId = pool[Math.floor(Math.random() * pool.length)] as MonsterId;
    }

    const alreadyOwned = newMonsters.some(m => m.id === monsterId);
    let scComp = 0;

    if (!alreadyOwned) {
      newMonsters.push(defaultOwnedMonster(monsterId));
    } else {
      scComp = SC_COMP[rarityIdx];
      newSoulCrystals += scComp;
    }

    // Friendship summon: mark used today
    if (type === 'friendship') {
      lastFriendSummon = new Date().toISOString().slice(0, 10);
    }

    const record: SummonRecord = {
      type, monsterId, rarity, isNew: !alreadyOwned,
      timestamp: Date.now(), scCompensation: scComp || undefined,
      ceilingHit: ceilingHit || undefined,
    };
    newHistory.push(record);

    results.push({ monsterId, rarity, rarityIdx, isNew: !alreadyOwned, scComp, ceilingHit });

    const logRarity = RARITY_KO[rarityIdx];
    logger.debug(
      `[SUMMON] type:${type} rarity:${rarity}(${logRarity}) monster:${monsterId}` +
      ` new:${!alreadyOwned}` +
      (ceilingHit ? ' 천장달성!' : '') +
      ((type === 'normal' || type === 'special')
        ? ` pity:${pity[type as 'normal' | 'special'].count}/${pity[type as 'normal' | 'special'].guaranteed}`
        : '') +
      (!alreadyOwned ? '' : ` compensation:+${scComp}💠 totalSC:${newSoulCrystals}`)
    );
  }

  const updated = {
    ...gs,
    gems:          newGems,
    soulCrystals:  newSoulCrystals,
    summonPity:    pity,
    ownedMonsters: newMonsters,
    summonHistory: newHistory,
    lastFriendSummon,
  };
  updateQuestObjective(updated, 'summon', count);
  saveGameState(tickSubQuestProgress(updated, 'summon', count));

  // ── SFX ───────────────────────────────────────────────────────
  const hasLegendary = results.some(r => r.rarity === 'legendary');
  audioManager.playSfx(hasLegendary ? 'summon_legendary' : 'summon_pull');

  // ── Trigger animation ─────────────────────────────────────────
  const onAnimComplete = () => ctx.scene.scene.restart();
  if (count === 1) {
    playSinglePullAnimation(ctx.scene, results[0], onAnimComplete);
  } else {
    playMultiPullAnimation(ctx.scene, results, onAnimComplete);
  }
}
