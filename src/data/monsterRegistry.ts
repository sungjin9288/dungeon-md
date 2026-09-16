import type { MonsterDef, MonsterId } from './monstersTypes';
import { MONSTERS_CH1_5 } from './monstersDataCh1to5';
import { MONSTERS_CH6 } from './monstersDataCh6';
import { MONSTERS_CH7 } from './monstersDataCh7andExtras';
import { MONSTERS_CH8 } from './monstersDataCh8';
import { MONSTERS_CH9 } from './monstersDataCh9';

/** Canonical monster registry shared by gameplay and fusion projections. */
export const MONSTER_DEFS: Record<MonsterId, MonsterDef> = {
  ...MONSTERS_CH1_5,
  ...MONSTERS_CH6,
  ...MONSTERS_CH7,
  ...MONSTERS_CH8,
  ...MONSTERS_CH9,
} as Record<MonsterId, MonsterDef>;
