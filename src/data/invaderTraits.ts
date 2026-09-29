/**
 * Player-facing one-line blurbs for invader special traits (behaviors).
 *
 * Used by the in-battle trait callout (announce a special enemy the first time
 * it appears so players learn how to counter it) — pure data, no Phaser.
 *
 * Only "notable" tactical behaviors get a blurb. Multi-phase boss behaviors
 * (FOX_QUEEN_PHASE, *_PHASE, VOID_SURGE …) are intentionally omitted: bosses
 * are self-evident set-pieces with their own dramatic intros, not a trait the
 * player needs taught.
 */

import type { InvaderBehavior } from './invaders';

export const INVADER_TRAIT_BLURBS: Partial<Record<InvaderBehavior, string>> = {
  VOID_PHASE:         '등장 직후 5초간 함정 면역',
  REVIVE_ONCE:        '쓰러져도 1회 부활',
  BERSERKER_RAGE:     '체력이 낮으면 이동 속도 2배',
  STEALTH:            '등장 직후 투명 — 함정이 조준 불가',
  SIEGE_SHIELD:       '함정 피해 50% 감소',
  DIVINE_WARD:        '마법(빙결·매혹) 면역',
  IRON_BODY:          '모든 피해 절반 · 군중제어 무효',
  RALLY_CRY:          '주변 아군의 이동 속도 증가',
  TRAP_IMMUNITY:      '모든 함정 완전 무효',
  UNDYING_KNIGHT:     '1회 부활 — 마법으로 처치 시 부활 차단',
  DECOY_CLONE:        '분신 소환 — 분신 살아있는 동안 본체 무적',
  POISON_TRAIL:       '지나간 자리에 독 장판',
  VOID_TELEPORT:      '2초 후 종점 부근으로 순간이동',
  VOID_STEALTH_ELITE: '순간이동 + 직후 투명화',
  STUN_IMMUNE:        '기절 상태에서만 피해 — 주기적 추가 소환',
  MIRROR_SHIELD:      '받은 피해 30% 반사 (3회 피격 후 파괴)',
  SWARM:              '쓰러지면 새끼 셋으로 분열',
  SHADOW_REALM:       '8초마다 2초간 무적 + 투명',
};

/** Player-facing blurb for a behavior, or null if it has none (e.g. boss phases). */
export function getTraitBlurb(behavior: InvaderBehavior | undefined): string | null {
  if (!behavior) return null;
  return INVADER_TRAIT_BLURBS[behavior] ?? null;
}
