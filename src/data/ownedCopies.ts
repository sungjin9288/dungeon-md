/**
 * 같은 몬스터의 복사본 묶기. 수호자는 id로 식별되므로(방 배치·프로필·성장) 첫 복사본이 "그 수호자"이고,
 * 나머지는 진화(같은 몬스터 3체)·흡수(희생)용 재료다. 보관함·배치 목록은 한 줄로 보여주고 수만 붙인다. 순수 모듈.
 */
import type { OwnedMonster } from './barracks';

export interface OwnedMonsterGroup {
  /** 이 종류의 대표(첫) 복사본 — 배치·성장이 가리키는 개체. */
  readonly monster: OwnedMonster;
  readonly copies: number;
}

export function groupOwnedCopies(owned: readonly OwnedMonster[]): OwnedMonsterGroup[] {
  const groups = new Map<string, { monster: OwnedMonster; copies: number }>();
  for (const monster of owned) {
    const group = groups.get(monster.id);
    if (group) group.copies++;
    else groups.set(monster.id, { monster, copies: 1 });
  }
  return [...groups.values()];
}
