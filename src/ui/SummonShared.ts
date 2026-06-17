/**
 * SummonShared.ts — layout constants, label maps, and pure helpers
 * shared across SummonScene, SummonShowcase, and SummonHistory.
 * No Phaser render logic. No imports from sibling Summon* modules.
 */

import { CANVAS_WIDTH } from '../constants/layout';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { type loadGameState } from '../data/wisdom';

// ─── Layout constants ──────────────────────────────────────────────────────────

export const CX        = CANVAS_WIDTH / 2;
export const CARD_W    = 178;
export const CARD_H    = 190;
export const CARD_GAP  = 8;
export const CARD_ML   = 11;   // left margin
export const CARDS_Y   = 228;  // top of first row
export const PORTAL_CY = 130;  // portal center Y
export const TAB_Y     = 186;  // tab bar top

// ─── Label maps ───────────────────────────────────────────────────────────────

export const SUMMON_TRIBE_LABELS: Record<string, string> = {
  dokkaebi:  '도깨비',
  gumiho:    '구미호',
  dragon:    '용족',
  underworld:'저승',
  sansin:    '산신',
  sea:       '해신',
  mask:      '탈족',
  moonlight: '달빛',
  celestial: '천상',
};

export const SUMMON_ELEMENT_LABELS: Record<string, string> = {
  fire:      '화염',
  frost:     '서리',
  lightning: '번개',
  dark:      '암흑',
  holy:      '신성',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Zero-padded dex number for the given monster id (e.g. "001"). */
export function getDexNo(monsterId: MonsterId): string {
  const index = Object.keys(MONSTER_DEFS).indexOf(monsterId);
  return String(Math.max(0, index) + 1).padStart(3, '0');
}

/** Tribe · element tagline for a monster definition. */
export function getMonsterTagLine(def: (typeof MONSTER_DEFS)[MonsterId]): string {
  const tribe   = def.tribe   ? SUMMON_TRIBE_LABELS[def.tribe]     ?? def.tribe   : '던전';
  const element = def.element ? SUMMON_ELEMENT_LABELS[def.element] ?? def.element : '중립';
  return `${tribe} · ${element}`;
}

/** Summarise the player's collection from game state. */
export function getCollectionSummary(gs: ReturnType<typeof loadGameState>): {
  owned:      number;
  total:      number;
  totalPulls: number;
  epics:      number;
  legends:    number;
  recent:     NonNullable<ReturnType<typeof loadGameState>['summonHistory']>;
} {
  const validIds = new Set(Object.keys(MONSTER_DEFS));
  const ownedIds = new Set(
    (gs.ownedMonsters ?? [])
      .map(monster => monster.id)
      .filter(id => validIds.has(id)),
  );
  const history = gs.summonHistory ?? [];
  return {
    owned:      ownedIds.size,
    total:      validIds.size,
    totalPulls: history.length,
    epics:      history.filter(record => record.rarity === 'epic').length,
    legends:    history.filter(record => record.rarity === 'legendary').length,
    recent:     history.slice().reverse().slice(0, 3),
  };
}
