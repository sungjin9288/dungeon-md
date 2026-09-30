/**
 * 진화 후보 — 지금 삼중 결속(같은 몬스터 3체)을 할 수 있는 종류와, 한 번 누르면 채울 재료 3체. 순수 모듈.
 */
import type { OwnedMonster } from './barracks';
import { getNextEvolution } from './fusion';

export const EVOLUTION_MATERIALS = 3;
/** registry 인계 — 다른 화면(병영 상세)에서 합성 의식실을 이 종류의 재료로 채워 열 때. */
export const FUSION_EVOLVE_ID_KEY = 'fusionEvolveId';
/** registry 인계 — 합성 의식실 '← 귀환'이 돌아갈 씬(없으면 홈). */
export const FUSION_RETURN_SCENE_KEY = 'fusionReturnScene';

export interface EvolutionCandidate {
  readonly id: string;
  readonly count: number;
  readonly resultId: string;
  readonly ready: boolean;
}

/** 진화할 수 있는 종류별 보유 수 — 바로 가능한 것 먼저, 그다음 많이 모은 순. */
export function listEvolutionCandidates(owned: readonly OwnedMonster[]): EvolutionCandidate[] {
  const counts = new Map<string, number>();
  for (const monster of owned) counts.set(monster.id, (counts.get(monster.id) ?? 0) + 1);
  const candidates: EvolutionCandidate[] = [];
  for (const [id, count] of counts) {
    const next = getNextEvolution(id);
    if (next) candidates.push({ id, count, resultId: next.resultId, ready: count >= EVOLUTION_MATERIALS });
  }
  return candidates.sort((a, b) => Number(b.ready) - Number(a.ready) || b.count - a.count || a.id.localeCompare(b.id));
}

/**
 * 한 번에 채울 재료 3체: 가장 높은 레벨 1체(결과가 그 레벨을 잇는다) + 가장 낮은 레벨 2체.
 * 남는 복사본의 레벨 합이 가장 커지는 선택이다. 3체가 안 되면 빈 배열.
 */
export function pickEvolutionMaterials(owned: readonly OwnedMonster[], id: string): OwnedMonster[] {
  const copies = owned.filter(monster => monster.id === id);
  if (copies.length < EVOLUTION_MATERIALS) return [];
  const byLevel = [...copies].sort((a, b) => a.level - b.level);
  const top = byLevel[byLevel.length - 1];
  return [top, ...byLevel.slice(0, EVOLUTION_MATERIALS - 1)];
}
