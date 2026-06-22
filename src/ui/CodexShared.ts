/**
 * CodexShared.ts — consts, types, and pure helpers for the Codex feature.
 * NO Phaser render logic, NO imports from CodexCell or CodexScene.
 */

import { CANVAS_WIDTH } from '../constants/layout';
import { type TribeId, type MonsterId, MONSTER_DEFS } from '../data/monsters';

// ─── Tribe metadata ───────────────────────────────────────────────────────────

export interface TribeMeta {
  id:     TribeId;
  name:   string;
  emoji:  string;
  bonus:  string;
  reward: string;   // Korean name of codex completion reward
  color:  number;   // accent color
}

export const TRIBE_META: TribeMeta[] = [
  { id: 'dokkaebi',   name: '도깨비족',  emoji: '👹', color: 0xcc3300,
    bonus: '도깨비족 전체 ATK +15%',
    reward: '도깨비 신왕 (전설) 해금' },
  { id: 'gumiho',     name: '구미호족',  emoji: '🦊', color: 0xd06010,
    bonus: '구미호족 매혹 확률 +10%',
    reward: '구미호 악신 (전설) 해금' },
  { id: 'sansin',     name: '산신족',    emoji: '⛩️', color: 0x3a8a3a,
    bonus: '전체 던전 회복력 +20%',
    reward: '산신 완성체 (전설) 해금' },
  { id: 'sea',        name: '해신족',    emoji: '🌊', color: 0x1060a0,
    bonus: '밀어내기 효과 +50%',
    reward: '해신 완성체 (전설) 해금' },
  { id: 'underworld', name: '저승족',    emoji: '💀', color: 0x6020a0,
    bonus: '처형 임계치 15% → 25%',
    reward: '저승 완성체 (전설) 해금' },
  { id: 'mask',       name: '탈족',      emoji: '🎭', color: 0x804040,
    bonus: '도발 지속시간 +1초',
    reward: '탈족 완성체 (전설) 해금' },
  { id: 'moonlight',  name: '달빛족',    emoji: '🌙', color: 0x4040a0,
    bonus: '신성 속성 피해 +20%',
    reward: '달빛 완성체 (전설) 해금' },
  { id: 'dragon',     name: '용족',      emoji: '🐉', color: 0xc04000,
    bonus: '전설 몬스터 ATK +25%',
    reward: '오룡 완성체 (전설) 해금' },
  { id: 'celestial',  name: '천상족',    emoji: '✨', color: 0xffd700,
    bonus: '천상족 성스러운 피해 +30%',
    reward: '천제 분신 (전설) 해금' },
  { id: 'primordial', name: '원초족',    emoji: '🌌', color: 0x8800cc,
    bonus: '원초족 ATK +25%',
    reward: '영원의 거신 (전설) 해금' },
  { id: 'void',       name: '공허족',    emoji: '🕳️', color: 0xbb55ff,
    bonus: '공허족 ATK +25%',
    reward: '공허 군왕 (전설) 해금' },
];

// Tribe ID → reward monster to unlock on 100% completion
export const TRIBE_REWARD_MONSTER: Record<string, MonsterId> = {
  dokkaebi:   'dokkaebi_god_king',
  gumiho:     'gumiho_demon',
  sansin:     'mountain_god_complete',
  sea:        'sea_god_complete',
  underworld: 'underworld_complete',
  mask:       'mask_complete',
  moonlight:  'moonlight_complete',
  dragon:     'five_dragon_complete',
  celestial:  'god_realm_general',
  primordial: 'eternal_colossus',
  void:       'void_monarch',
};

// ─── Layout ───────────────────────────────────────────────────────────────────

export const CX    = CANVAS_WIDTH / 2;
export const HDR_H = 120;  // addSceneHeader (~56) + addTabBar (38) + stats row (~26)
export const BOT_H = 64;
export const PAD   = 12;

export const CODEX_RARITY_META: Record<string, { label: string; stars: string; color: number; css: string }> = {
  C: { label: 'C', stars: '★',     color: 0x8f98a5, css: '#b9c0ca' },
  U: { label: 'U', stars: '★★',    color: 0x58c681, css: '#8ff0ad' },
  R: { label: 'R', stars: '★★★',   color: 0x62a8ff, css: '#9bc9ff' },
  E: { label: 'E', stars: '★★★★',  color: 0xc978ff, css: '#e3b4ff' },
  L: { label: 'L', stars: '★★★★★', color: 0xffc857, css: '#ffd878' },
};

export const CODEX_ELEMENT_LABELS: Record<string, string> = {
  fire: '화염',
  frost: '서리',
  lightning: '번개',
  dark: '암흑',
  holy: '신성',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function getDexNo(monsterId: MonsterId): string {
  const index = Object.keys(MONSTER_DEFS).indexOf(monsterId);
  return String(Math.max(0, index) + 1).padStart(3, '0');
}

export function getRarityMeta(
  rarityTier: string | undefined,
): (typeof CODEX_RARITY_META)[keyof typeof CODEX_RARITY_META] {
  return CODEX_RARITY_META[rarityTier ?? 'C'] ?? CODEX_RARITY_META['C'];
}

export function truncateLabel(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
}

/**
 * A tribe's codex completion reward is claimable when every NON-reward monster
 * in the tribe is owned and the reward has not been claimed yet.
 *
 * The reward monster is excluded from the requirement on purpose: it is granted
 * BY claiming (unlockMethod 'codex_reward', not in any summon pool), so counting
 * it toward completion makes the tribe permanently unclaimable (a soft-lock).
 */
export function isTribeClaimable(
  tribeMonsterIds: readonly MonsterId[],
  rewardMonsterId: MonsterId | undefined,
  isOwned: (id: MonsterId) => boolean,
  alreadyClaimed: boolean,
): boolean {
  if (!rewardMonsterId || alreadyClaimed) return false;
  const required = tribeMonsterIds.filter(id => id !== rewardMonsterId);
  if (required.length === 0) return false;
  return required.every(id => isOwned(id));
}
