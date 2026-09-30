import type { MonsterId } from './monsters';
import { bondAtkMult } from './bond';

// ─── Owned Monster ────────────────────────────────────────────────────────────

export interface OwnedMonster {
  id:               string;           // base MonsterId OR evolved/hybrid id
  level:            number;           // 1–50
  xp:               number;           // current XP in this level
  skillPoints:      number;           // unspent SP
  spentSkills:      Record<string, number>;  // skillNodeId → tier spent (0/1/2/3)
  equippedSkills:   string[];         // up to 2 active skill IDs
  equipment:        string | null;    // equipment ID or null
  rarity?:          number;           // 0=common 1=unc 2=rare 3=epic 4=leg
  absorptionStacks?: number;          // same-type absorption stacks 0–10
  evoStage?:        number;           // evolution stage (0 = base, 1 = evo1, etc.)
}

// ─── XP curve ─────────────────────────────────────────────────────────────────

export function xpToNextLevel(level: number): number {
  return Math.round(100 * Math.pow(1.18, level - 1));
}

export function addXp(monster: OwnedMonster, amount: number): { levelled: boolean; newLevel: number } {
  monster.xp += amount;
  let levelled = false;
  while (monster.level < 50) {
    const needed = xpToNextLevel(monster.level);
    if (monster.xp < needed) break;
    monster.xp -= needed;
    monster.level++;
    levelled = true;
    // SP: 1 point every 5 levels
    if (monster.level % 5 === 0) monster.skillPoints++;
  }
  if (monster.level >= 50) monster.xp = 0;
  return { levelled, newLevel: monster.level };
}

// ─── Stat scaling from level ──────────────────────────────────────────────────

/** Per-level attack growth: +3% compounding (Lv.20 ≈ ×1.75, Lv.50 ≈ ×4.3). */
export const GUARDIAN_LEVEL_ATK_GROWTH = 1.03;

/**
 * A guardian's own damage multiplier from raising: level growth and the
 * combat-tree 강타 node. Combat (CombatResolver / runExtraMonsterAttacks) and
 * the forecast simulation both apply this, so the barracks ATK figure is the
 * number that actually fights.
 */
/**
 * Awakening's payload. 각성 is gated behind 교감 affinity 100 — the top bond
 * tier, itself +15% — and costs an awakening stone on top, so it sits one step
 * above that ladder.
 *
 * Until this existed, awakening delivered NOTHING: `monsterAwakened` had zero
 * references under src/combat, and the only field `applyFusionAwakening`
 * mutated (absorptionStacks) had no reader outside the fusion UI. The player
 * paid a stone and a 100-point grind for a boolean that filtered the monster
 * out of its own picker.
 *
 * The 30 entries in `AWAKENED_PASSIVES` promise bespoke mechanics (piercing
 * attacks, permanent auras, room immunity, execute-on-crit). Those are a design
 * backlog, not something this multiplier stands in for — see
 * docs/design/AGENT_HANDOFF.md. What this guarantees is that awakening is not a
 * paid no-op.
 */
export const AWAKENED_ATK_MULT = 1.25;

/** Per-stack ATK growth from 흡수 — deliberately the same step a level buys. */
export const ABSORPTION_ATK_GROWTH = GUARDIAN_LEVEL_ATK_GROWTH;
export const ABSORPTION_STACK_MAX = 10;

export interface GuardianRaising {
  /** 흡수 stacks 0–10; the fusion UI already calls these "ATK stack". */
  readonly absorptionStacks?: number;
  /** 각성 (fusion awakening) — GameState.monsterAwakened[monsterId]. */
  readonly awakened?: boolean;
}

export function guardianAtkMult(
  level: number,
  spentSkills: Readonly<Record<string, number>> | undefined,
  affinity = 0,
  raising: GuardianRaising = {},
): number {
  let mult = Math.pow(GUARDIAN_LEVEL_ATK_GROWTH, Math.max(1, level) - 1);
  // Combat tree A1 강타: +15%
  if ((spentSkills?.['A1'] ?? 0) >= 1) mult *= 1.15;
  // 흡수 stacks: the same +3% step a level buys, capped at 10.
  const stacks = Math.max(0, Math.min(ABSORPTION_STACK_MAX, Math.floor(raising.absorptionStacks ?? 0)));
  mult *= Math.pow(ABSORPTION_ATK_GROWTH, stacks);
  // 각성: the tier above 교감 일심.
  if (raising.awakened) mult *= AWAKENED_ATK_MULT;
  // 교감 tiers (bond.ts): +3/6/10/15% at 25/50/75/100.
  return mult * bondAtkMult(affinity);
}

/** Map monsterId → guardianAtkMult for a roster; unknown ids read as ×1. */
export function buildGuardianAtkMultMap(
  ownedMonsters: readonly OwnedMonster[] | undefined,
  monsterAffinity: Readonly<Record<string, number>> | undefined = undefined,
  monsterAwakened: Readonly<Record<string, boolean>> | undefined = undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const monster of ownedMonsters ?? []) {
    map.set(monster.id, guardianAtkMult(monster.level, monster.spentSkills, monsterAffinity?.[monster.id] ?? 0, {
      absorptionStacks: monster.absorptionStacks,
      awakened: monsterAwakened?.[monster.id] ?? false,
    }));
  }
  return map;
}

export function getMonsterAtk(baseAtk: number, level: number, spentSkills: Record<string, number>, affinity = 0): number {
  return Math.round(baseAtk * guardianAtkMult(level, spentSkills, affinity));
}

/**
 * ATK for an owned monster with EVERY raising channel applied — the same set
 * combat reads through `buildGuardianAtkMultMap`.
 *
 * `getMonsterAtk` takes loose primitives and defaults affinity to 0, so most
 * callers silently dropped 교감; after 흡수 stacks and 각성 joined
 * `guardianAtkMult`, they dropped those too. Three growth systems the game
 * sells were invisible in every ATK and 전력 readout except the monster-detail
 * header, which was the one call site that bothered to pass affinity.
 */
export function getOwnedMonsterAtk(
  baseAtk: number,
  monster: Pick<OwnedMonster, 'id' | 'level' | 'spentSkills' | 'absorptionStacks'>,
  raising: {
    readonly monsterAffinity?: Readonly<Record<string, number>>;
    readonly monsterAwakened?: Readonly<Record<string, boolean>>;
  } = {},
): number {
  return Math.round(baseAtk * guardianAtkMult(
    monster.level,
    monster.spentSkills,
    raising.monsterAffinity?.[monster.id] ?? 0,
    { absorptionStacks: monster.absorptionStacks, awakened: raising.monsterAwakened?.[monster.id] ?? false },
  ));
}

/**
 * The ATK a player reads on a guardian: every raising channel plus the equipped
 * item's `atkMult`, the same factor `CombatResolver`/`runExtraMonsterAttacks`
 * multiply into each hit. Readouts that used raw `getMonsterAtk` stayed flat
 * when a weapon was equipped, so the header never moved after 장착.
 * Readouts that show equipment as its own line use `getOwnedMonsterAtk` instead.
 */
export function getOwnedMonsterBattleAtk(
  baseAtk: number,
  monster: Pick<OwnedMonster, 'id' | 'level' | 'spentSkills' | 'absorptionStacks' | 'equipment'>,
  raising: Parameters<typeof getOwnedMonsterAtk>[2] = {},
): number {
  const atkMult = getEquipmentStats(monster.equipment ?? null).atkMult ?? 0;
  return Math.round(getOwnedMonsterAtk(baseAtk, monster, raising) * Math.max(0, 1 + atkMult));
}

// ─── Skill Trees ──────────────────────────────────────────────────────────────

export interface SkillNode {
  id:          string;
  name:        string;
  tier:        1 | 2 | 3;
  cost:        number;          // SP cost
  branch:      'A' | 'B' | 'C';
  requires?:   string;          // prerequisite node id
  desc:        string;
  icon:        string;          // emoji
}

export interface SkillTree {
  monsterId: string;
  branchNames: { A: string; B: string; C: string };
  nodes: SkillNode[];
}

// ─── 도깨비 전사 Skill Tree (full) ────────────────────────────────────────────

const DOKKAEBI_WARRIOR_TREE: SkillTree = {
  monsterId: 'dokkaebi_warrior',
  branchNames: { A: '전투', B: '방어', C: '지원' },
  nodes: [
    // Branch A — Combat
    { id: 'A1', name: '강타',       tier: 1, cost: 1, branch: 'A', icon: '⚔️',
      desc: 'ATK +15%' },
    { id: 'A2', name: '연속 공격',  tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '⚡',
      desc: '첫 공격 시 2회 연속 타격' },
    { id: 'A3', name: '무쌍',       tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '💥',
      desc: '첫 타격 기절 1.5s → 5s' },
    // Branch B — Defense
    { id: 'B1', name: '철갑',       tier: 1, cost: 1, branch: 'B', icon: '🛡️',
      desc: '방 HP +50' },
    { id: 'B2', name: '분노의 반격', tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🔥',
      desc: '방 HP 50% 이하: ATK +50%' },
    { id: 'B3', name: '불굴',       tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🏰',
      desc: '방 파괴 불가 (최소 1HP 유지)' },
    // Branch C — Support
    { id: 'C1', name: '도깨비 연대', tier: 1, cost: 1, branch: 'C', icon: '👥',
      desc: 'PACK_FRENZY 범위 +1칸' },
    { id: 'C2', name: '선봉대',     tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '🎯',
      desc: '웨이브 첫 침략자 즉사' },
    { id: 'C3', name: '도깨비 왕',  tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '👑',
      desc: '도깨비 전체 ATK +30%' },
  ],
};

// ─── 구미호 수호자 Skill Tree ─────────────────────────────────────────────────

const GUMIHO_GUARDIAN_TREE: SkillTree = {
  monsterId: 'gumiho_guardian',
  branchNames: { A: '여우불', B: '환술', C: '영혼유대' },
  nodes: [
    // Branch A — Fox Fire
    { id: 'A1', name: '여우불 점화',   tier: 1, cost: 1, branch: 'A', icon: '🔥',
      desc: '공격 시 여우불 부여, 3s 지속 화상' },
    { id: 'A2', name: '청화 폭발',     tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '💙',
      desc: '여우불 3중첩 시 폭발, 범위 피해 150%' },
    { id: 'A3', name: '구미 화염',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '🦊',
      desc: '9개의 꼬리에서 화염 동시 발사, ATK +60%' },
    // Branch B — Illusion
    { id: 'B1', name: '환영 생성',     tier: 1, cost: 1, branch: 'B', icon: '👤',
      desc: '환영을 생성하여 침략자 혼란 2s' },
    { id: 'B2', name: '거울 미로',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🪞',
      desc: '침략자 이동 속도 -40% / 5s' },
    { id: 'B3', name: '완벽한 환술',   tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🌀',
      desc: '침략자가 역방향으로 이동 (3s)' },
    // Branch C — Soul Bond
    { id: 'C1', name: '영혼 연결',     tier: 1, cost: 1, branch: 'C', icon: '💫',
      desc: '인접 몬스터 ATK +10%' },
    { id: 'C2', name: '영혼 공명',     tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '✨',
      desc: '연결된 몬스터 피해 공유 (받는 피해 -30%)' },
    { id: 'C3', name: '구미호 맹약',   tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '💕',
      desc: '여우 계열 전체 ATK +35%, 쿨타임 -25%' },
  ],
};

// ─── 백호 Skill Tree ─────────────────────────────────────────────────────────

const WHITE_TIGER_TREE: SkillTree = {
  monsterId: 'white_tiger',
  branchNames: { A: '백호발톱', B: '철갑', C: '산신의축복' },
  nodes: [
    // Branch A — White Tiger Claw
    { id: 'A1', name: '발톱 강화',     tier: 1, cost: 1, branch: 'A', icon: '🐯',
      desc: 'ATK +20%, 출혈 부여' },
    { id: 'A2', name: '쌍발톱',       tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '⚡',
      desc: '공격 시 2회 연속 타격, 출혈 중첩' },
    { id: 'A3', name: '백호 포효',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '🌪️',
      desc: '포효로 전 열 기절 3s + ATK +50%' },
    // Branch B — Iron Guard
    { id: 'B1', name: '강철 가죽',     tier: 1, cost: 1, branch: 'B', icon: '🛡️',
      desc: '방 HP +80' },
    { id: 'B2', name: '반사 갑옷',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🔄',
      desc: '받는 피해 20% 반사' },
    { id: 'B3', name: '백호 결계',     tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🏔️',
      desc: '방 파괴 시 자동 부활 (HP 50%), 1회' },
    // Branch C — Mountain Blessing
    { id: 'C1', name: '산의 기운',     tier: 1, cost: 1, branch: 'C', icon: '🍃',
      desc: '매 웨이브 시작 시 HP +30 회복' },
    { id: 'C2', name: '산신 가호',     tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '🌿',
      desc: '인접 몬스터 방 HP +50, 재생 +10/s' },
    { id: 'C3', name: '영수의 위엄',   tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '👑',
      desc: '전체 몬스터 ATK +20%, 방 HP +30%' },
  ],
};

// ─── 사신 Skill Tree ─────────────────────────────────────────────────────────

const DEATH_MESSENGER_TREE: SkillTree = {
  monsterId: 'death_messenger',
  branchNames: { A: '사신낫', B: '저승결계', C: '영혼수확' },
  nodes: [
    // Branch A — Death Scythe
    { id: 'A1', name: '저승낫',       tier: 1, cost: 1, branch: 'A', icon: '⚔️',
      desc: 'ATK +25%, 사망 판정 확률 5%' },
    { id: 'A2', name: '사선 가르기',   tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '💀',
      desc: 'HP 30% 이하 침략자 즉사 확률 20%' },
    { id: 'A3', name: '사망 선고',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '☠️',
      desc: '공격 대상에 사망 표식, 5s 후 즉사' },
    // Branch B — Underworld Barrier
    { id: 'B1', name: '저승 안개',     tier: 1, cost: 1, branch: 'B', icon: '🌫️',
      desc: '방 진입 시 침략자 이동속도 -30%' },
    { id: 'B2', name: '혼백 장벽',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🛡️',
      desc: '방 HP +100, 사망한 침략자마다 +20 추가' },
    { id: 'B3', name: '저승문',       tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🚪',
      desc: '방 파괴 불가 (최소 1HP), 침략자 감속 60%' },
    // Branch C — Soul Harvest
    { id: 'C1', name: '영혼 흡수',     tier: 1, cost: 1, branch: 'C', icon: '👻',
      desc: '처치 시 영혼 획득, 5개마다 ATK +10%' },
    { id: 'C2', name: '망자의 군대',   tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '💀',
      desc: '수확한 영혼 10개마다 유령 전사 소환' },
    { id: 'C3', name: '저승사자 각성', tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '🔮',
      desc: '전투 중 처치 수 비례 ATK +100% (최대)' },
  ],
};

// ─── 뇌전영웅 Skill Tree ─────────────────────────────────────────────────────

const THUNDER_HERO_TREE: SkillTree = {
  monsterId: 'thunder_hero',
  branchNames: { A: '뇌전격', B: '뇌신방어', C: '천둥소환' },
  nodes: [
    // Branch A — Thunder Strike
    { id: 'A1', name: '번개 일격',     tier: 1, cost: 1, branch: 'A', icon: '⚡',
      desc: 'ATK +20%, 15% 감전 확률' },
    { id: 'A2', name: '연쇄 번개',     tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '🌩️',
      desc: '공격이 최대 3체에게 연쇄, 피해 70%' },
    { id: 'A3', name: '뇌신 강림',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '💥',
      desc: '5초마다 낙뢰, 전 열 200% 피해 + 기절 2s' },
    // Branch B — Thunder Shield
    { id: 'B1', name: '정전기 갑옷',   tier: 1, cost: 1, branch: 'B', icon: '🛡️',
      desc: '방 HP +60, 접촉 시 감전' },
    { id: 'B2', name: '뇌전 결계',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '⚡',
      desc: '방 진입 침략자 자동 기절 1s' },
    { id: 'B3', name: '뇌운 방벽',     tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🌩️',
      desc: '방 피해 면역 3s (쿨타임 15s), HP +150' },
    // Branch C — Thunder Summon
    { id: 'C1', name: '뇌수 소환',     tier: 1, cost: 1, branch: 'C', icon: '🐉',
      desc: '번개 정령 소환, ATK 50% 추가 공격' },
    { id: 'C2', name: '폭풍 소환',     tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '🌪️',
      desc: '폭풍 영역 생성, 범위 내 감전 + 감속 50%' },
    { id: 'C3', name: '천둥신 해방',   tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '👑',
      desc: '번개 계열 전체 ATK +40%, 감전 지속 2배' },
  ],
};

// ─── 탈춤꾼 Skill Tree ───────────────────────────────────────────────────────

const MASK_DANCER_TREE: SkillTree = {
  monsterId: 'mask_dancer',
  branchNames: { A: '가면춤', B: '신비춤', C: '축제광란' },
  nodes: [
    // Branch A — Mask Dance
    { id: 'A1', name: '탈바꿈',       tier: 1, cost: 1, branch: 'A', icon: '🎭',
      desc: '공격마다 가면 교체, ATK +10% 중첩' },
    { id: 'A2', name: '광대 가면',     tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '🃏',
      desc: '3번째 공격 시 침략자 혼란 3s' },
    { id: 'A3', name: '귀신 가면',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '👹',
      desc: '귀면 착용: ATK +60%, 공포 부여 (도주)' },
    // Branch B — Mystic Dance
    { id: 'B1', name: '방어 춤사위',   tier: 1, cost: 1, branch: 'B', icon: '💃',
      desc: '방 HP +50, 회피 확률 10%' },
    { id: 'B2', name: '무아지경',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🌀',
      desc: '춤 중 모든 피해 -40%, 반사 15%' },
    { id: 'B3', name: '신들린 춤',     tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '✨',
      desc: '방 파괴 면역 5s (쿨 20s), 인접 방 HP +50' },
    // Branch C — Festival Frenzy
    { id: 'C1', name: '축제 시작',     tier: 1, cost: 1, branch: 'C', icon: '🎉',
      desc: '인접 몬스터 공격속도 +15%' },
    { id: 'C2', name: '흥겨운 장단',   tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '🥁',
      desc: '전체 몬스터 ATK +15%, 쿨타임 -10%' },
    { id: 'C3', name: '대동 놀이',     tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '🎊',
      desc: '탈춤 계열 전체 ATK +40%, 축제 버프 전파' },
  ],
};

// ─── 선녀 무희 Skill Tree ────────────────────────────────────────────────────

const CELESTIAL_DANCER_TREE: SkillTree = {
  monsterId: 'celestial_dancer',
  branchNames: { A: '선무', B: '월광', C: '비천' },
  nodes: [
    // Branch A — Celestial Dance
    { id: 'A1', name: '선녀 무예',     tier: 1, cost: 1, branch: 'A', icon: '🌸',
      desc: 'ATK +20%, 공격에 신성 피해 추가' },
    { id: 'A2', name: '천상 회전',     tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '💫',
      desc: '범위 공격으로 변환, 인접 2체 추가 타격' },
    { id: 'A3', name: '천녀산화',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '🌺',
      desc: '꽃잎 폭풍: 전 열 150% 피해 + 매혹 3s' },
    // Branch B — Moonlight
    { id: 'B1', name: '월광 장막',     tier: 1, cost: 1, branch: 'B', icon: '🌙',
      desc: '방 HP +60, 야간 전투 시 +추가 30' },
    { id: 'B2', name: '달빛 치유',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🌕',
      desc: '매 10s 인접 방 HP +40 회복' },
    { id: 'B3', name: '만월 결계',     tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🌝',
      desc: '방 피해 면역 4s (쿨 18s), 전체 방 HP +20%' },
    // Branch C — Sky Flight
    { id: 'C1', name: '비천 날개',     tier: 1, cost: 1, branch: 'C', icon: '🕊️',
      desc: '어느 방이든 지원 가능 (범위 무제한)' },
    { id: 'C2', name: '천상 은혜',     tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '👼',
      desc: '전체 몬스터 쿨타임 -15%, 회복 +20%' },
    { id: 'C3', name: '승천',         tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '☁️',
      desc: '선녀 계열 전체 ATK +35%, 비천 상태 유지' },
  ],
};

// ─── 산신 Skill Tree ─────────────────────────────────────────────────────────

const MOUNTAIN_GOD_TREE: SkillTree = {
  monsterId: 'mountain_god',
  branchNames: { A: '산신력', B: '대지방벽', C: '자연재생' },
  nodes: [
    // Branch A — Mountain Power
    { id: 'A1', name: '바위 주먹',     tier: 1, cost: 1, branch: 'A', icon: '🪨',
      desc: 'ATK +20%, 공격 시 넉백' },
    { id: 'A2', name: '산사태',       tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '⛰️',
      desc: '범위 공격, 3체에게 120% 피해 + 기절 1.5s' },
    { id: 'A3', name: '산신 일격',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '🏔️',
      desc: '대지 분쇄: 전 열 200% 피해 + 감속 80%' },
    // Branch B — Earth Wall
    { id: 'B1', name: '대지 방패',     tier: 1, cost: 1, branch: 'B', icon: '🛡️',
      desc: '방 HP +100' },
    { id: 'B2', name: '석벽 소환',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🧱',
      desc: '석벽 생성, 침략자 진행 차단 3s' },
    { id: 'B3', name: '산맥 결계',     tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🗻',
      desc: '방 파괴 불가 (최소 1HP), 인접 방 HP +80' },
    // Branch C — Nature Regen
    { id: 'C1', name: '생명의 숲',     tier: 1, cost: 1, branch: 'C', icon: '🌲',
      desc: '매 5s 방 HP +20 자연 회복' },
    { id: 'C2', name: '자연의 축복',   tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '🌿',
      desc: '전체 방 HP 재생 +15/s, 독·화상 면역' },
    { id: 'C3', name: '산신 각성',     tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '🌏',
      desc: '자연 계열 전체 ATK +30%, 방 HP +50%' },
  ],
};

// ─── 해신창 Skill Tree ───────────────────────────────────────────────────────

const SEA_GOD_SPEAR_TREE: SkillTree = {
  monsterId: 'sea_god_spear',
  branchNames: { A: '파도창', B: '해신갑', C: '조류조종' },
  nodes: [
    // Branch A — Wave Spear
    { id: 'A1', name: '파도 찌르기',   tier: 1, cost: 1, branch: 'A', icon: '🔱',
      desc: 'ATK +20%, 관통 공격 (뒤 1체 추가)' },
    { id: 'A2', name: '해일 창술',     tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '🌊',
      desc: '파도 충격파, 직선 3체 130% 피해' },
    { id: 'A3', name: '용왕 창격',     tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '🐲',
      desc: '해신 일격: 전 열 180% 피해 + 익사 (5s DOT)' },
    // Branch B — Sea Armor
    { id: 'B1', name: '산호 갑옷',     tier: 1, cost: 1, branch: 'B', icon: '🐚',
      desc: '방 HP +70, 화염 피해 면역' },
    { id: 'B2', name: '해류 장벽',     tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🛡️',
      desc: '방 진입 시 침략자 감속 40%, 피해 -20%' },
    { id: 'B3', name: '심해 갑주',     tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🐋',
      desc: '방 HP +200, 수압으로 침략자 ATK -30%' },
    // Branch C — Current Control
    { id: 'C1', name: '조류 변환',     tier: 1, cost: 1, branch: 'C', icon: '🌀',
      desc: '침략자 이동 경로 변경 (우회)' },
    { id: 'C2', name: '소용돌이',     tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '🌪️',
      desc: '소용돌이 생성, 범위 내 3s 속박' },
    { id: 'C3', name: '해신 지배',     tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '👑',
      desc: '바다 계열 전체 ATK +35%, 익사 피해 2배' },
  ],
};

// ─── Simplified trees for other Ch1 monsters ──────────────────────────────────

function simpleTree(id: string, bA: string, bB: string, bC: string): SkillTree {
  return {
    monsterId: id,
    branchNames: { A: bA, B: bB, C: bC },
    nodes: [
      { id: 'A1', name: '강화 I',  tier: 1, cost: 1, branch: 'A', icon: '⬆️', desc: 'ATK +15%' },
      { id: 'A2', name: '강화 II', tier: 2, cost: 2, branch: 'A', requires: 'A1', icon: '⬆️', desc: 'ATK +25%' },
      { id: 'A3', name: '강화 III',tier: 3, cost: 3, branch: 'A', requires: 'A2', icon: '⬆️', desc: 'ATK +40%' },
      { id: 'B1', name: '방어 I',  tier: 1, cost: 1, branch: 'B', icon: '🛡️', desc: '방 HP +50' },
      { id: 'B2', name: '방어 II', tier: 2, cost: 2, branch: 'B', requires: 'B1', icon: '🛡️', desc: '방 HP +100' },
      { id: 'B3', name: '방어 III',tier: 3, cost: 3, branch: 'B', requires: 'B2', icon: '🛡️', desc: '쿨타임 -20%' },
      { id: 'C1', name: '지원 I',  tier: 1, cost: 1, branch: 'C', icon: '✨', desc: '골드 +5%/초' },
      { id: 'C2', name: '지원 II', tier: 2, cost: 2, branch: 'C', requires: 'C1', icon: '✨', desc: '처치 골드 +20%' },
      { id: 'C3', name: '지원 III',tier: 3, cost: 3, branch: 'C', requires: 'C2', icon: '✨', desc: '파동 효과 강화' },
    ],
  };
}

export const SKILL_TREES: Partial<Record<MonsterId, SkillTree>> = {
  // ─── Custom trees (tribe leaders) ───
  dokkaebi_warrior:  DOKKAEBI_WARRIOR_TREE,
  gumiho_guardian:   GUMIHO_GUARDIAN_TREE,
  white_tiger:       WHITE_TIGER_TREE,
  death_messenger:   DEATH_MESSENGER_TREE,
  thunder_hero:      THUNDER_HERO_TREE,
  mask_dancer:       MASK_DANCER_TREE,
  celestial_dancer:  CELESTIAL_DANCER_TREE,
  mountain_god:      MOUNTAIN_GOD_TREE,
  sea_god_spear:     SEA_GOD_SPEAR_TREE,
  // ─── Simple trees (Ch1) ───
  dokkaebi_junior:   simpleTree('dokkaebi_junior',   '속도',   '연대',   '강화'),
  village_archer:    simpleTree('village_archer',    '사격',   '방어',   '지원'),
  gold_turtle:       simpleTree('gold_turtle',       '황금',   '보호',   '풍요'),
  fire_dokkaebi:     simpleTree('fire_dokkaebi',     '화염',   '폭발',   '연소'),
  sage:              simpleTree('sage',              '명상',   '치유',   '강화'),
  // ─── Simple trees (Ch2) ───
  frost_spirit:      simpleTree('frost_spirit',      '빙결',   '냉기갑', '서리축복'),
  fox_shaman:        simpleTree('fox_shaman',        '주술',   '여우결계', '영매'),
  iron_mask:         simpleTree('iron_mask',         '철면공격', '철벽',   '위압'),
  // ─── Simple trees (Ch3) ───
  ghost_hunter:      simpleTree('ghost_hunter',      '퇴마',   '영벽',   '혼백술'),
  venom_warrior:     simpleTree('venom_warrior',     '맹독',   '독갑',   '역병'),
  // ─── Simple trees (Ch4) ───
  three_legged_crow: simpleTree('three_legged_crow', '태양화', '깃털방어', '일출'),
  great_serpent:     simpleTree('great_serpent',     '독아',   '비늘갑', '탈피'),
  moon_rabbit_sage:  simpleTree('moon_rabbit_sage',  '달빛약', '월광방어', '불로초'),
  // ─── Simple trees (Ch5) ───
  volcanic_warrior:  simpleTree('volcanic_warrior',  '화산폭발', '용암갑', '화염축복'),
  storm_archer:      simpleTree('storm_archer',      '폭풍사격', '바람방패', '질풍'),
  abyss_mage:        simpleTree('abyss_mage',        '심연술법', '허공방벽', '어둠강화'),
  celestial_healer:  simpleTree('celestial_healer',  '천상치유', '성광방어', '회복강화'),
  mask_berserker:    simpleTree('mask_berserker',    '광전공격', '가면방어', '열기'),
  sea_dragon_lord:   simpleTree('sea_dragon_lord',   '해룡격', '용비늘갑', '용의축복'),
  fox_spirit_elder:  simpleTree('fox_spirit_elder',  '장로술법', '영혼결계', '지혜'),
  // ─── Simple trees (Ch6 — dokkaebi tribe) ───
  thunder_dokkaebi:  simpleTree('thunder_dokkaebi',  '번개공격', '전격갑', '뇌신'),
  ice_dokkaebi:      simpleTree('ice_dokkaebi',      '빙결공격', '얼음갑', '서리'),
  healer_dokkaebi:   simpleTree('healer_dokkaebi',   '치유술', '회복갑', '도깨비치유'),
  dokkaebi_captain:  simpleTree('dokkaebi_captain',  '대장공격', '통솔방어', '지휘'),
  dokkaebi_bomber:   simpleTree('dokkaebi_bomber',   '폭발공격', '폭탄방벽', '폭격'),
  dokkaebi_duelist:  simpleTree('dokkaebi_duelist',  '쌍검공격', '결투방어', '이도류'),
  poison_dokkaebi:   simpleTree('poison_dokkaebi',   '맹독공격', '독갑', '역병'),
  shadow_dokkaebi:   simpleTree('shadow_dokkaebi',   '암영공격', '그림자갑', '은신'),
  shield_dokkaebi:   simpleTree('shield_dokkaebi',   '방패공격', '철벽방어', '수호'),
  dokkaebi_shaman:   simpleTree('dokkaebi_shaman',   '주술공격', '주술결계', '도깨비주술'),
  dokkaebi_king:     simpleTree('dokkaebi_king',     '왕의공격', '왕의방어', '왕의위엄'),
  storm_dokkaebi:    simpleTree('storm_dokkaebi',    '폭풍공격', '폭풍갑', '폭풍소환'),
  gold_dokkaebi:     simpleTree('gold_dokkaebi',     '황금공격', '황금방어', '황금보상'),
  fire_dokkaebi_king:simpleTree('fire_dokkaebi_king','불꽃왕격', '불꽃왕갑', '화염지배'),
  black_dragon_dokkaebi: simpleTree('black_dragon_dokkaebi', '흑룡격', '흑룡갑', '흑룡기운'),
  dokkaebi_general:  simpleTree('dokkaebi_general',  '장군공격', '장군방어', '장군지휘'),
  dokkaebi_god_king: simpleTree('dokkaebi_god_king', '신왕격', '신왕갑', '신왕지배'),
  // ─── Simple trees (Ch6 — gumiho tribe) ───
  one_tail_fox:      simpleTree('one_tail_fox',      '여우불', '은신',   '민첩'),
  three_tail_fox:    simpleTree('three_tail_fox',    '삼화염', '환영',   '영혼'),
  five_tail_fox:     simpleTree('five_tail_fox',     '오화염', '오미여우결계', '영혼강화'),
  spring_gumiho:     simpleTree('spring_gumiho',     '봄꽃공격', '꽃잎방어', '봄의기운'),
  summer_gumiho:     simpleTree('summer_gumiho',     '여름파도', '여름갑', '여름축복'),
  ice_gumiho:        simpleTree('ice_gumiho',        '빙설여우불', '빙설갑', '냉기'),
  thunder_gumiho:    simpleTree('thunder_gumiho',    '번개여우불', '번개갑', '뇌전'),
  fox_warrior:       simpleTree('fox_warrior',       '여우무예', '여우방어', '여우기운'),
  gumiho_queen:      simpleTree('gumiho_queen',      '여왕공격', '여왕방어', '여왕위엄'),
  gumiho_goddess:    simpleTree('gumiho_goddess',    '여신공격', '여신방어', '여신축복'),
  gumiho_archmage:   simpleTree('gumiho_archmage',   '대마법공격', '마법방벽', '마법지배'),
  celestial_fairy:   simpleTree('celestial_fairy',   '선녀공격', '선녀방어', '선녀축복'),
  gumiho_demon:      simpleTree('gumiho_demon',      '악신공격', '악신방어', '악신지배'),
  // ─── Simple trees (Ch6 — mountain spirit tribe) ───
  deer_god:          simpleTree('deer_god',          '신록공격', '사슴신갑', '자연축복'),
  bear_god:          simpleTree('bear_god',          '곰발격', '곰가죽갑', '산신기운'),
  mountain_spirit_boy: simpleTree('mountain_spirit_boy', '도령공격', '도령방어', '도령기운'),
  phoenix:           simpleTree('phoenix',           '봉황불꽃', '봉황깃방어', '부활'),
  thousand_pine:     simpleTree('thousand_pine',     '송진공격', '소나무방벽', '천년기운'),
  mountain_spirit:   simpleTree('mountain_spirit',   '산신공격', '산신방어', '산신축복'),
  mountain_god_complete: simpleTree('mountain_god_complete', '산신완성격', '산신완성갑', '산신완성기운'),
  // ─── Simple trees (Ch6 — sea god tribe) ───
  sea_dragon_archer: simpleTree('sea_dragon_archer', '해룡사격', '해룡갑', '해룡기운'),
  jellyfish_sorcerer:simpleTree('jellyfish_sorcerer','해파리공격', '해파리방어', '독성'),
  sea_general:       simpleTree('sea_general',       '용궁공격', '용궁방어', '용궁지휘'),
  sea_witch:         simpleTree('sea_witch',         '바다마법', '파도방벽', '바다저주'),
  shark_warrior:     simpleTree('shark_warrior',     '상어공격', '상어갑', '혈흔'),
  kraken_soldier:    simpleTree('kraken_soldier',    '촉수공격', '크라켄갑', '심해'),
  dragon_king_guardian: simpleTree('dragon_king_guardian', '용왕수호격', '용왕수호갑', '용왕기운'),
  sea_god_complete:  simpleTree('sea_god_complete',  '해신완성격', '해신완성갑', '해신완성기운'),
  // ─── Simple trees (Ch6 — underworld tribe) ───
  skeleton_knight:   simpleTree('skeleton_knight',   '뼈칼공격', '뼈갑', '저승기운'),
  soul_guardian:     simpleTree('soul_guardian',     '영혼검', '영혼방패', '영혼수호'),
  underworld_archer: simpleTree('underworld_archer', '저승화살', '저승갑', '저승사격'),
  underworld_witch:  simpleTree('underworld_witch',  '저승마법', '저승방벽', '저승저주'),
  hell_guard:        simpleTree('hell_guard',        '지옥문격', '지옥문방어', '지옥수호'),
  yomra_warrior:     simpleTree('yomra_warrior',     '염라공격', '염라갑', '염라위엄'),
  ghost_king:        simpleTree('ghost_king',        '귀왕격', '귀왕방어', '귀왕지배'),
  spirit_summoner:   simpleTree('spirit_summoner',   '망자소환', '소환방벽', '망자군단'),
  underworld_complete: simpleTree('underworld_complete', '저승완성격', '저승완성갑', '저승완성기운'),
  // ─── Simple trees (Ch6 — mask tribe) ───
  mask_archer:       simpleTree('mask_archer',       '탈사격', '탈갑', '탈기운'),
  bongsan_maskman:   simpleTree('bongsan_maskman',   '봉산탈격', '봉산탈갑', '봉산기운'),
  cheoyong_warrior:  simpleTree('cheoyong_warrior',  '처용공격', '처용방어', '처용기운'),
  mask_wizard:       simpleTree('mask_wizard',       '탈마법', '탈방벽', '탈저주'),
  thunder_mask_warrior: simpleTree('thunder_mask_warrior', '번개탈격', '번개탈갑', '번개탈기운'),
  glacier_warrior:   simpleTree('glacier_warrior',   '빙하공격', '빙하갑', '빙하기운'),
  great_mask_god:    simpleTree('great_mask_god',    '대탈신격', '대탈신갑', '대탈신지배'),
  mask_complete:     simpleTree('mask_complete',     '탈족완성격', '탈족완성갑', '탈족완성기운'),
  // ─── Simple trees (Ch6 — moonlight tribe) ───
  moonlight_rabbit:  simpleTree('moonlight_rabbit',  '달빛공격', '달빛갑', '달빛기운'),
  starlight_fairy:   simpleTree('starlight_fairy',   '별빛공격', '별빛방어', '별빛기운'),
  crescent_archer:   simpleTree('crescent_archer',   '초승달사격', '달갑', '달기운'),
  moonlight_tiger:   simpleTree('moonlight_tiger',   '달빛호격', '달빛호갑', '달빛호기운'),
  galaxy_warrior:    simpleTree('galaxy_warrior',    '은하공격', '은하갑', '은하기운'),
  full_moon_sorcerer:simpleTree('full_moon_sorcerer','보름달마법', '보름달방벽', '보름달기운'),
  solar_eclipse_warrior: simpleTree('solar_eclipse_warrior', '일식공격', '일식갑', '일식기운'),
  lunar_eclipse_mage:simpleTree('lunar_eclipse_mage','월식마법', '월식방벽', '월식기운'),
  moonlight_complete:simpleTree('moonlight_complete','달빛완성격', '달빛완성갑', '달빛완성기운'),
  // ─── Simple trees (Ch6 — dragon tribe) ───
  red_dragon_warrior:    simpleTree('red_dragon_warrior',    '적룡공격', '적룡갑', '적룡기운'),
  blue_dragon_guardian:  simpleTree('blue_dragon_guardian',  '청룡수호격', '청룡수호갑', '청룡기운'),
  gold_dragon_sage:      simpleTree('gold_dragon_sage',      '황룡지혜', '황룡방어', '황룡기운'),
  black_dragon_assassin: simpleTree('black_dragon_assassin', '흑룡암살', '흑룡갑', '흑룡기운'),
  white_dragon_healer:   simpleTree('white_dragon_healer',   '백룡치유', '백룡방어', '백룡기운'),
  blue_dragon_archmage:  simpleTree('blue_dragon_archmage',  '청룡대마법', '청룡방벽', '청룡지배'),
  banya_guardian:        simpleTree('banya_guardian',        '반야수호격', '반야수호갑', '반야기운'),
  dragon_avatar:         simpleTree('dragon_avatar',         '용화신격', '용화신갑', '용화신기운'),
  five_dragon_complete:  simpleTree('five_dragon_complete',  '오룡완성격', '오룡완성갑', '오룡완성기운'),
};

/** Resolve a monster's skill tree; monsters without a custom tree get the standard fallback. */
export function getSkillTree(monsterId: string): SkillTree {
  return SKILL_TREES[monsterId as MonsterId] ?? simpleTree(monsterId, '공격', '방어', '지원');
}

// ─── Active Skills (purchasable) ──────────────────────────────────────────────

export interface ActiveSkill {
  id:       string;
  name:     string;
  icon:     string;
  desc:     string;
  cooldown: number;   // seconds
  goldCost: number;
  gemCost:  number;
  category: 'combat' | 'defense' | 'support';
}

export const ACTIVE_SKILLS: ActiveSkill[] = [
  // Combat
  { id: 'fire_burst',    name: '화염 폭발',  icon: '🔥', category: 'combat',
    desc: '전 열 화염 피해 200',            cooldown: 20, goldCost: 150, gemCost: 30 },
  { id: 'ice_arrow',     name: '얼음 화살',  icon: '❄️', category: 'combat',
    desc: '침략자 3체 동시 빙결 2s',        cooldown: 15, goldCost: 120, gemCost: 25 },
  { id: 'lightning',     name: '번개 폭풍',  icon: '⚡', category: 'combat',
    desc: '연쇄 번개 5대상',               cooldown: 25, goldCost: 180, gemCost: 35 },
  { id: 'poison_cloud',  name: '독 안개',    icon: '🌫️', category: 'combat',
    desc: '전체 침략자 독 5s',             cooldown: 30, goldCost: 160, gemCost: 32 },
  { id: 'heavy_strike',  name: '강타',       icon: '💥', category: 'combat',
    desc: '다음 공격 3× 피해',             cooldown: 8,  goldCost: 80,  gemCost: 15 },
  // Defense
  { id: 'fortress',      name: '철옹성',     icon: '🏰', category: 'defense',
    desc: '이 방 10s 피해 면역',           cooldown: 45, goldCost: 200, gemCost: 40 },
  { id: 'heal_room',     name: '회복',       icon: '💚', category: 'defense',
    desc: '이 방 HP +100 즉시',            cooldown: 20, goldCost: 100, gemCost: 20 },
  { id: 'shield',        name: '보호막',     icon: '🛡️', category: 'defense',
    desc: '인접 방 5s 피해 면역',          cooldown: 30, goldCost: 170, gemCost: 34 },
  // Support
  { id: 'gold_rush',     name: '골드 러시',  icon: '💰', category: 'support',
    desc: '즉시 골드 +200',               cooldown: 60, goldCost: 250, gemCost: 50 },
  { id: 'speed_up',      name: '속도 증가',  icon: '🌀', category: 'support',
    desc: '전체 몬스터 공속 +50% / 8s',   cooldown: 40, goldCost: 190, gemCost: 38 },
  { id: 'summon_ghost',  name: '영혼 소환',  icon: '👻', category: 'support',
    desc: '유령 전사 소환',               cooldown: 35, goldCost: 150, gemCost: 30 },
  { id: 'timestop',      name: '시간 정지',  icon: '⏸️', category: 'support',
    desc: '전체 침략자 3s 빙결',           cooldown: 50, goldCost: 220, gemCost: 44 },
  { id: 'curse_all',     name: '저주',       icon: '🔮', category: 'support',
    desc: '전체 침략자 동시 저주 10s',     cooldown: 45, goldCost: 200, gemCost: 40 },
  { id: 'healing_rain',  name: '치유의 비',  icon: '🌧️', category: 'support',
    desc: '전체 방 HP +30',               cooldown: 25, goldCost: 130, gemCost: 26 },
  { id: 'rage',          name: '분노',       icon: '😤', category: 'support',
    desc: '선택 몬스터 ATK +100% / 10s',  cooldown: 30, goldCost: 160, gemCost: 32 },
  // ── Batch: 3 new active skills (effects reuse existing combat primitives) ──
  { id: 'meteor',           name: '메테오',      icon: '☄️', category: 'combat',
    desc: '전체 침략자 직격 피해 150',     cooldown: 28, goldCost: 200, gemCost: 40 },
  { id: 'emergency_repair', name: '긴급 수리',   icon: '🔧', category: 'defense',
    desc: '전체 방 HP +80 · 3s 면역',      cooldown: 40, goldCost: 220, gemCost: 44 },
  { id: 'war_cry',          name: '격노의 함성', icon: '📣', category: 'support',
    desc: '전체 방 ATK 강화 8s',           cooldown: 35, goldCost: 190, gemCost: 38 },
];

// ─── Equipment ────────────────────────────────────────────────────────────────

export interface Equipment {
  id:       string;
  name:     string;
  icon:     string;
  type:     'weapon' | 'armor' | 'accessory';
  desc:     string;
  goldCost: number;
  gemCost:  number;
}

export const EQUIPMENT_DEFS: Equipment[] = [
  // Weapons
  { id: 'dokkaebi_club',   name: '도깨비 방망이', icon: '🪃', type: 'weapon',
    desc: 'ATK +20%, 기절 +0.5s',          goldCost: 300, gemCost: 60 },
  { id: 'dragon_claw',     name: '용의 발톱',   icon: '🐲', type: 'weapon',
    desc: 'ATK +35%, 10% 즉사',            goldCost: 500, gemCost: 100 },
  { id: 'fox_tail',        name: '구미호 꼬리', icon: '🦊', type: 'weapon',
    desc: 'ATK +15%, 5번째 공격마다 매혹', goldCost: 400, gemCost: 80 },
  { id: 'ice_spear',       name: '얼음 창',    icon: '🌨️', type: 'weapon',
    desc: 'ATK +10%, 15% 빙결 확률',       goldCost: 350, gemCost: 70 },
  // Armor
  { id: 'golden_armor',    name: '황금 갑옷',  icon: '🥇', type: 'armor',
    desc: '방 HP +100, 골드 +10%',         goldCost: 400, gemCost: 80 },
  { id: 'stone_shell',     name: '돌 껍질',   icon: '🪨', type: 'armor',
    desc: '방 HP +200, ATK -10%',          goldCost: 300, gemCost: 60 },
  { id: 'soul_robe',       name: '영혼 로브',  icon: '👘', type: 'armor',
    desc: '스킬 쿨타임 -20%',             goldCost: 350, gemCost: 70 },
  // Accessory
  { id: 'lucky_charm',     name: '행운의 부적', icon: '🍀', type: 'accessory',
    desc: '모든 발동 확률 +5%',           goldCost: 250, gemCost: 50 },
  { id: 'soul_crystal_acc',name: '영혼 결정',  icon: '💎', type: 'accessory',
    desc: '영혼 결정 획득 +15%',        goldCost: 300, gemCost: 60 },
  { id: 'battle_ring',     name: '전투의 반지', icon: '💍', type: 'accessory',
    desc: '액티브 스킬 쿨타임 -15%',     goldCost: 280, gemCost: 56 },
];

// ─── Equipment stat lookup ───────────────────────────────────────────────────

export interface EquipmentStats {
  atkMult?:       number;  // e.g. 0.20 = +20% ATK
  roomHpBonus?:   number;  // flat room HP bonus
  dmgReduction?:  number;  // strongest equipment reduction in the occupied room
  bossDmgBonus?:  number;  // wearer basic attacks vs bosses, including mini-bosses
  atkSpeedBonus?: number;  // wearer basic attack rate; interval / (1 + bonus)
  aoeEvery?:      number;  // every N damaging basics, all enemies at 50% basic damage
  adjacentAtkBonus?: number; // strongest orthogonal neighboring-room aura
  celestialAtkBonus?: number; // strongest board aura, celestial guardians only
  holyDmgBonus?:  number;  // magic bonus hit from wearer basic damage
  magicAtkBonus?: number; // magic-type wearer basic damage multiplier bonus
  stunBonus?:     number;  // extra stun duration (ms)
  freezeChance?:  number;  // 0-1
  charmEvery?:    number;  // charm every N attacks
  executeChance?: number;  // 0-1 instant kill chance
  goldMult?:      number;  // gold earning multiplier
  skillCdMult?:   number;  // skill cooldown multiplier (e.g. 0.80 = -20%)
  procBonus?:     number;  // all proc chance bonus (flat)
  crystalMult?:   number;  // soul crystal earning multiplier
}

export const EQUIPMENT_STATS: Record<string, EquipmentStats> = {
  // Weapons
  dokkaebi_club:    { atkMult: 0.20, stunBonus: 500 },
  dragon_claw:      { atkMult: 0.35, executeChance: 0.10 },
  fox_tail:         { atkMult: 0.15, charmEvery: 5 },
  ice_spear:        { atkMult: 0.10, freezeChance: 0.15 },
  // Armor
  golden_armor:     { roomHpBonus: 100, goldMult: 0.10 },
  stone_shell:      { roomHpBonus: 200, atkMult: -0.10 },
  soul_robe:        { skillCdMult: 0.80 },
  // Accessory
  lucky_charm:      { procBonus: 0.05 },
  soul_crystal_acc: { crystalMult: 0.15 },
  battle_ring:      { skillCdMult: 0.85 },
  // Crafted equipment (from blueprints)
  eq_dokkaebi_club: { atkMult: 0.25, stunBonus: 600 },
  eq_iron_armor:    { roomHpBonus: 150 },
  eq_fox_robe:      { roomHpBonus: 120, procBonus: 0.03 },
  eq_frost_lance:   { atkMult: 0.20, freezeChance: 0.12 },
  eq_soul_ring:     { crystalMult: 0.10, procBonus: 0.05 },
  eq_shadow_blade:  { atkMult: 0.30 },
  eq_herb_potion:   { roomHpBonus: 80 },
  eq_ice_shield:    { roomHpBonus: 150, freezeChance: 0.10 },
  eq_dragon_fang:   { atkMult: 0.40, bossDmgBonus: 0.25 },
  eq_spirit_robe:   { roomHpBonus: 300, dmgReduction: 0.15 },
  eq_moonstone_pendant: { skillCdMult: 0.80, atkSpeedBonus: 0.20 },
  eq_heavenly_blade:    { atkMult: 0.60, aoeEvery: 5 },
  eq_guardian_crown:    { roomHpBonus: 200, atkMult: 0.15, adjacentAtkBonus: 0.25 },
  // Ch6 boss-weekly / Ch7 / Ch8 crafted items
  eq_boss_amulet:      { skillCdMult: 0.80, bossDmgBonus: 0.40 },
  eq_celestial_lance:  { atkMult: 0.45, holyDmgBonus: 0.20 },
  eq_divine_aegis:     { roomHpBonus: 500, dmgReduction: 0.25, celestialAtkBonus: 0.20 },
  eq_arcane_core:      { atkMult: 0.30, magicAtkBonus: 0.20 },
  eq_ore_plate:        { roomHpBonus: 200, dmgReduction: 0.10 },
  eq_void_blade:       { atkMult: 0.60, skillCdMult: 0.75 },
  eq_abyss_mail:       { roomHpBonus: 800, dmgReduction: 0.30 },
  eq_primordial_gem:   { atkMult: 0.80, crystalMult: 0.30 },
  // New legendary blueprints
  eq_ember_reaver:     { atkMult: 0.50, executeChance: 0.15 },
  eq_aegis_bulwark:    { roomHpBonus: 400, goldMult: 0.20 },
  eq_chrono_charm:     { skillCdMult: 0.70, crystalMult: 0.25 },
};

export function getEquipmentStats(equipId: string | null): EquipmentStats {
  if (!equipId) return {};
  return EQUIPMENT_STATS[equipId] ?? {};
}

// ─── Default starter roster ───────────────────────────────────────────────────

export function defaultOwnedMonster(id: string): OwnedMonster {
  return { id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null, rarity: 0, absorptionStacks: 0 };
}

// One guardian per starting room (the DM-1 board opens three). Before the
// home dungeon became the only dungeon, stage 1 lent these out for free via
// the in-battle picker; now the player owns them from the first day.
export const STARTER_ROSTER: MonsterId[] = ['dokkaebi_warrior', 'village_archer', 'dokkaebi_junior'];
