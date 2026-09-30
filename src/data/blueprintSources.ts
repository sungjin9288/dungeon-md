/**
 * 설계도 획득처 — 모든 설계도는 얻을 곳이 있어야 한다(blueprintSources.test.ts가 지킨다).
 *
 * - 시작: 메인 임무 MQ-007 완료(도깨비 방망이·철 갑옷)
 * - 메인 임무: QUEST_BLUEPRINT_REWARDS
 * - 라이벌 던전마스터(주간 보스): 보스 부적
 * - 심연 보스층 첫 정복: 10층마다 한 장(깊을수록 희귀)
 * - 모험가 파티 격퇴: 명성 단계에 맞는 아직 없는 설계도 한 장 — 모험가는 짐을 들고 온다(visitors.ts).
 * 순수 모듈.
 */
import { MAIN_QUESTS } from './questData';
import { QUEST_BLUEPRINT_REWARDS } from './questRewardTransactions';
import { STARTER_BLUEPRINTS } from './fusion';
import type { GameState } from './wisdom';

export type BlueprintSourceKind = 'starter' | 'quest' | 'weekly_boss' | 'abyss' | 'adventurer';

export interface BlueprintSource {
  readonly kind: BlueprintSourceKind;
  /** 플레이어에게 보여줄 획득처 한 줄. */
  readonly label: string;
}

/** 심연 보스층(10층마다) 첫 정복 보상. */
export const ABYSS_BLUEPRINT_FLOORS: Readonly<Record<number, string>> = {
  10: 'bp_fox_robe',
  20: 'bp_frost_lance',
  30: 'bp_dragon_fang',
  40: 'bp_moonstone_pendant',
  50: 'bp_heavenly_blade',
  60: 'bp_chrono_charm',
};

/** 모험가 파티를 격퇴하면 명성 단계 `minTier` 이상에서 나오는 설계도(앞에서부터, 아직 없는 것). */
export const ADVENTURER_BLUEPRINT_POOL: ReadonlyArray<{ readonly minTier: number; readonly id: string }> = [
  { minTier: 1, id: 'bp_herb_potion' },
  { minTier: 1, id: 'bp_soul_ring' },
  { minTier: 2, id: 'bp_shadow_blade' },
  { minTier: 2, id: 'bp_ice_shield' },
  { minTier: 4, id: 'bp_spirit_robe' },
  { minTier: 6, id: 'bp_ember_reaver' },
  { minTier: 7, id: 'bp_aegis_bulwark' },
];

export const WEEKLY_BOSS_BLUEPRINT = 'bp_boss_amulet';

function questLabel(questId: string): string {
  const quest = MAIN_QUESTS.find(entry => entry.id === questId);
  return quest ? `임무 「${quest.title}」 완료` : `임무 ${questId} 완료`;
}

/** 설계도 하나를 어디서 얻는가. 획득처가 없으면 null(테스트가 막는다). */
export function getBlueprintSource(blueprintId: string): BlueprintSource | null {
  if (STARTER_BLUEPRINTS.includes(blueprintId)) return { kind: 'starter', label: questLabel('MQ-007') };
  const questId = Object.keys(QUEST_BLUEPRINT_REWARDS).find(id => QUEST_BLUEPRINT_REWARDS[id] === blueprintId);
  if (questId) return { kind: 'quest', label: questLabel(questId) };
  if (blueprintId === WEEKLY_BOSS_BLUEPRINT) return { kind: 'weekly_boss', label: '라이벌 던전마스터 격퇴(월요일)' };
  const floor = Object.keys(ABYSS_BLUEPRINT_FLOORS).map(Number).find(f => ABYSS_BLUEPRINT_FLOORS[f] === blueprintId);
  if (floor !== undefined) return { kind: 'abyss', label: `심연 ${floor}층 첫 정복` };
  const adventurer = ADVENTURER_BLUEPRINT_POOL.find(entry => entry.id === blueprintId);
  if (adventurer) return { kind: 'adventurer', label: `모험가 파티 격퇴 · 명성 ${adventurer.minTier}단계+` };
  return null;
}

/** 이 층을 처음 정복하면 받는 설계도(이미 있으면 null). */
export function abyssBlueprintFor(state: Readonly<Pick<GameState, 'blueprints'>>, floor: number): string | null {
  const id = ABYSS_BLUEPRINT_FLOORS[floor];
  return id && !(state.blueprints ?? []).includes(id) ? id : null;
}

/** 모험가 파티를 격퇴했을 때 받는 설계도: 이 명성 단계에서 열린 것 중 아직 없는 첫 장(없으면 null). */
export function adventurerBlueprintFor(state: Readonly<Pick<GameState, 'blueprints'>>, tier: number): string | null {
  const owned = new Set(state.blueprints ?? []);
  return ADVENTURER_BLUEPRINT_POOL.find(entry => entry.minTier <= tier && !owned.has(entry.id))?.id ?? null;
}

/** 설계도를 더한 새 상태(이미 있으면 같은 참조). */
export function grantBlueprint<T extends Pick<GameState, 'blueprints'>>(state: T, blueprintId: string | null): T {
  if (!blueprintId || (state.blueprints ?? []).includes(blueprintId)) return state;
  return { ...state, blueprints: [...(state.blueprints ?? []), blueprintId] };
}
