/**
 * Dungeon simulation — pure math, no Phaser.
 * Estimates battle outcome based on current dungeon config vs stage waves.
 */
import { resolveMonsterDef } from './monsters';
import { INVADER_DEFS } from './invaders';
import type { DungeonSlot, OwnedMonster } from './wisdom';
import type { WaveSpec } from './stages';

// Approximate one-way path length for an invader traversing the dungeon (px)
const PATH_LENGTH_PX = 640;

// Effective flat DPS contribution per trap type (simplified)
const TRAP_EFFECTIVE_DPS: Record<string, number> = {
  spike_trap:  5,   // 20 dmg on entry ÷ ~4s average encounter window
  slow_trap:   4,   // speed reduction means more time exposed to monster attacks
  poison_trap: 8,   // 8 dmg/s × 4s = 32 per invader, divided over encounter
  stun_trap:   6,   // 1s stun buys extra attack time
};

export interface WaveSimResult {
  waveNum:     number;
  invaderCount: number;
  invaderHpSum: number;
  damageDealt:  number;
  survived:     number;
  hpLost:       number;
  difficulty:   'easy' | 'medium' | 'hard' | 'extreme';
}

export interface SimulationDiagnostic {
  readonly kind: 'unknown-invader-type';
  readonly waveNum: number;
  readonly invaderType: string;
  readonly count: number;
}

export interface SimResult {
  totalDps:    number;
  waveResults: WaveSimResult[];
  finalHp:     number;
  startHp:     number;
  winPct:      number;      // 0–100
  worstWave:   number;      // 1-indexed wave with most HP lost
  recommendation: string;
  diagnostics: SimulationDiagnostic[];
}

/** Calculate approximate total DPS of the current dungeon configuration. */
export function calcDungeonDps(
  slots: DungeonSlot[],
  ownedMonsters: OwnedMonster[],
): number {
  let dps = 0;

  for (const slot of slots) {
    if (!slot || slot.hp <= 0) continue;

    // Trap DPS
    for (const tId of slot.trapIds) {
      if (tId && TRAP_EFFECTIVE_DPS[tId]) dps += TRAP_EFFECTIVE_DPS[tId];
    }

    // Monster DPS
    for (const mId of slot.monsterIds) {
      if (!mId) continue;
      const def = resolveMonsterDef(mId);
      if (!def || def.attackCooldown === 0) continue;

      // Level multiplier from owned-monster record (10% per level above 1)
      const om = ownedMonsters.find(m => m.id === mId);
      const levelMult = om ? 1 + (om.level - 1) * 0.10 : 1;
      // Room level is the home dungeon's main damage lever; mirror
      // CombatResolver.resolveAttack's 1.4^(level-1) so the forecast tracks it.
      const roomMult = Math.pow(1.4, Math.max(0, (slot.roomLevel ?? 1) - 1));

      dps += (def.baseDamage * levelMult * roomMult) / (def.attackCooldown / 1000);
    }
  }

  return dps;
}

/** Simulate all waves of a stage and return a detailed SimResult. */
export function simulateDungeon(
  slots: DungeonSlot[],
  ownedMonsters: OwnedMonster[],
  waves: WaveSpec[],
  startHp: number,
): SimResult {
  const dps = calcDungeonDps(slots, ownedMonsters);
  let hp = startHp;
  const waveResults: WaveSimResult[] = [];
  let worstWave = 0;
  let worstHpLost = 0;
  const diagnostics: SimulationDiagnostic[] = [];

  for (let wi = 0; wi < waves.length; wi++) {
    const wave = waves[wi];
    let totalHp    = 0;
    let totalHit   = 0;
    let survived   = 0;
    let hpLost     = 0;
    let totalCount = 0;

    for (const grp of wave.invaders) {
      const def = INVADER_DEFS[grp.type];
      if (!def) {
        diagnostics.push({
          kind: 'unknown-invader-type',
          waveNum: wi + 1,
          invaderType: grp.type,
          count: grp.count,
        });
        continue;
      }

      // Effective travel time (seconds) through the dungeon path
      const travelSec = PATH_LENGTH_PX / def.speed;
      const damagePerInvader = dps * travelSec;

      for (let k = 0; k < grp.count; k++) {
        const invHp = def.hp;
        totalHp += invHp;
        totalCount++;
        if (damagePerInvader >= invHp) {
          totalHit += invHp;
        } else {
          totalHit += damagePerInvader;
          survived++;
          hpLost += def.damage;
        }
      }
    }

    hp = Math.max(0, hp - hpLost);

    const ratio = totalHp > 0 ? totalHit / totalHp : 1;
    let difficulty: WaveSimResult['difficulty'];
    if      (ratio >= 1.1)  difficulty = 'easy';
    else if (ratio >= 0.80) difficulty = 'medium';
    else if (ratio >= 0.55) difficulty = 'hard';
    else                    difficulty = 'extreme';

    waveResults.push({
      waveNum: wi + 1,
      invaderCount: totalCount,
      invaderHpSum: totalHp,
      damageDealt:  totalHit,
      survived,
      hpLost,
      difficulty,
    });

    if (hpLost > worstHpLost) {
      worstHpLost = hpLost;
      worstWave   = wi + 1;
    }
  }

  // Win % = HP remaining ratio × 100 (cap at 0–100)
  const winPct = Math.round(Math.max(0, Math.min(100, (hp / startHp) * 100)));

  let recommendation: string;
  if (dps < 8)          recommendation = '몬스터를 더 배치하세요!';
  else if (hp <= 0)      recommendation = '방어 불충분 — 몬스터 업그레이드 필요';
  else if (worstHpLost > startHp * 0.25)
                         recommendation = `${worstWave}웨이브가 취약 — 강화 권장`;
  else if (winPct >= 80) recommendation = '현재 배치로 클리어 가능!';
  else                   recommendation = '업그레이드로 생존율을 높이세요';

  return { totalDps: dps, waveResults, finalHp: hp, startHp, winPct, worstWave, recommendation, diagnostics };
}
