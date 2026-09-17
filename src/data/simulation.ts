/**
 * Dungeon simulation — pure math, no Phaser.
 * Estimates battle outcome based on current dungeon config vs stage waves.
 */
import { buildGuardianAtkMultMap } from './barracks';
import { resolveMonsterDef } from './monsters';
import { INVADER_DEFS } from './invaders';
import { ROOM_DEFS } from './rooms';
import { getSlotBuilding } from './roomBuildings';
import { GRID_ROWS } from '../constants/layout';
import { tempoCooldown } from './combatTempo';
import { trapEffectiveDps } from './traps';
import type { DungeonSlot, OwnedMonster } from './wisdom';
import type { WaveSpec } from './stages';

// Approximate one-way path length for an invader traversing the dungeon (px)
const PATH_LENGTH_PX = 640;

// A room only hits invaders within its reach, and the invasion path crosses
// every board row once. So a range-1 room sees each invader for a third of the
// journey, a range-2 room for two thirds, and only range-3 reach covers it all.
// Organic play-throughs measured the uncovered model as ~3x optimistic for a
// three-room home — exactly this factor.
function pathCoverage(range: number): number {
  return Math.min(1, Math.max(0, range) / GRID_ROWS);
}

// Trap worth comes from the trap's afflictions (traps.ts); mastery is not
// modelled here, so the forecast stays a floor.

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
  monsterAffinity: Readonly<Record<string, number>> | undefined = undefined,
): number {
  let dps = 0;
  const raising = buildGuardianAtkMultMap(ownedMonsters, monsterAffinity);

  for (const slot of slots) {
    if (!slot || slot.hp <= 0) continue;

    // Trap DPS
    for (const tId of slot.trapIds) {
      dps += trapEffectiveDps(tId);
    }

    // Room level is the home dungeon's main damage lever; mirror
    // CombatResolver.resolveAttack's 1.4^(level-1) so the forecast tracks it.
    const roomMult = Math.pow(1.4, Math.max(0, (slot.roomLevel ?? 1) - 1));
    const monsterIds = slot.monsterIds.filter((id): id is string => Boolean(id));

    // A room with no guardian still fights with its own attack (DungeonLayout
    // gives it ROOM_DEFS' damage and cooldown), so an early home of empty
    // guardian rooms is not defenceless.
    if (monsterIds.length === 0) {
      const building = getSlotBuilding(slot);
      const room = building ? ROOM_DEFS[building] : null;
      if (room && room.attackDamage > 0 && room.attackCooldown > 0) {
        dps += (room.attackDamage * roomMult * pathCoverage(room.attackRange)) / (tempoCooldown(room.attackCooldown) / 1000);
      }
      continue;
    }

    // Monster DPS. The primary guardian carries the room's level multiplier;
    // the extra guardians attack at base damage (RoomMechanics.runExtraMonsterAttacks).
    // Every guardian carries its own raising multiplier (level · 강타), the same
    // map CombatResolver / runExtraMonsterAttacks read — so the barracks ATK
    // number is what the forecast counts.
    monsterIds.forEach((mId, index) => {
      const def = resolveMonsterDef(mId);
      if (!def || def.attackCooldown === 0) return;
      const mult = (index === 0 ? roomMult : 1) * (raising.get(mId) ?? 1);
      dps += (def.baseDamage * mult * pathCoverage(def.range)) / (tempoCooldown(def.attackCooldown) / 1000);
    });
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
  return simulateWavesAtDps(calcDungeonDps(slots, ownedMonsters), waves, startHp);
}

/**
 * The wave model at a given sustained DPS. Split out so balance tooling can
 * ask "what DPS does this stage demand?" without inventing a loadout.
 */
export function simulateWavesAtDps(
  dps: number,
  waves: WaveSpec[],
  startHp: number,
): SimResult {
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
  // Below one armed range-1 room's worth of covered DPS (≈4.4) the home is
  // effectively unmanned.
  if (dps < 4)          recommendation = '몬스터를 더 배치하세요!';
  else if (hp <= 0)      recommendation = '방어 불충분 — 몬스터 업그레이드 필요';
  else if (worstHpLost > startHp * 0.25)
                         recommendation = `${worstWave}웨이브가 취약 — 강화 권장`;
  else if (winPct >= 80) recommendation = '현재 배치로 클리어 가능!';
  else                   recommendation = '업그레이드로 생존율을 높이세요';

  return { totalDps: dps, waveResults, finalHp: hp, startHp, winPct, worstWave, recommendation, diagnostics };
}
