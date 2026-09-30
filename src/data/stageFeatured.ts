/**
 * 관문 칸에 보여줄 대표 침입자 — 보스가 있으면 보스, 없으면 전 웨이브에서 비중(수 × HP)이 가장 큰 유닛.
 * 침공 지도에서 "누구와 싸우는가"를 번호 대신 보여준다. 순수.
 */
import { INVADER_DEFS, type InvaderType } from './invaders';
import type { StageConfig } from './stages';

export function stageFeaturedInvader(stage: Pick<StageConfig, 'waves'>): InvaderType | null {
  const weight = new Map<InvaderType, number>();
  for (const wave of stage.waves) {
    for (const group of wave.invaders) {
      if (group.isBoss) return group.type;
      const hp = INVADER_DEFS[group.type]?.hp ?? 0;
      weight.set(group.type, (weight.get(group.type) ?? 0) + group.count * hp);
    }
  }
  let best: InvaderType | null = null;
  for (const [type, w] of weight) if (best === null || w > (weight.get(best) ?? 0)) best = type;
  return best;
}
