import { describe, expect, it } from 'vitest';
import { ALL_STAGES } from './allStages';
import { stageFeaturedInvader } from './stageFeatured';

describe('관문 대표 침입자', () => {
  it('보스가 있으면 보스, 없으면 수×HP가 가장 큰 유닛', () => {
    expect(stageFeaturedInvader({ waves: [
      { invaders: [{ type: 'peasant', count: 10, spawnDelay: 0 }, { type: 'soldier', count: 3, spawnDelay: 0 }] },
    ] })).toBe('peasant');   // 농민 10×60 = 600 > 병사 3×150 = 450
    expect(stageFeaturedInvader({ waves: [
      { invaders: [{ type: 'peasant', count: 5, spawnDelay: 0 }, { type: 'soldier', count: 3, spawnDelay: 0 }] },
    ] })).toBe('soldier');   // 농민 300 < 병사 450
  });

  it('보스 그룹이 있으면 그것을 고른다', () => {
    expect(stageFeaturedInvader({ waves: [
      { invaders: [{ type: 'peasant', count: 40, spawnDelay: 0 }] },
      { invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }] },
    ] })).toBe('knight');
  });

  it('모든 캠페인 관문이 대표 침입자를 가진다', () => {
    for (const stage of ALL_STAGES) expect(stageFeaturedInvader(stage), `stage ${stage.id}`).not.toBeNull();
  });
});
