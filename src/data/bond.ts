// ─── Bond (교감) ──────────────────────────────────────────────────────────────
// The third thing a guardian can be doing besides defending and working:
// being cared for. Affinity 0–100 (GameState.monsterAffinity, the field
// awakening already gates on at 100) rises through three daily-limited
// actions and unlocks a small attack bonus, a story line, and a crystal gift
// on the way. Design: GAME_DESIGN_BENCHMARK.md §4.3 ②. Pure data.

export type BondActionId = 'treat' | 'talk' | 'spar';

export interface BondActionDef {
  readonly id: BondActionId;
  readonly name: string;
  readonly emoji: string;
  readonly desc: string;
  /** Affinity gained per use. */
  readonly gain: number;
  readonly dailyLimit: number;
  readonly gold: number;
  /** Alternative material costs — the first one the player can pay is used. */
  readonly materialsAny: ReadonlyArray<Readonly<Record<string, number>>>;
  /** Guardian XP granted alongside (spar only). */
  readonly xp: number;
}

export const BOND_MAX = 100;

export const BOND_ACTIONS: Readonly<Record<BondActionId, BondActionDef>> = {
  treat: { id: 'treat', name: '간식',      emoji: '🍖', desc: '약초원·광산 산출물을 먹인다', gain: 8, dailyLimit: 3, gold: 0,   materialsAny: [{ herb: 1 }, { common_ore: 1 }], xp: 0 },
  talk:  { id: 'talk',  name: '대화',      emoji: '💬', desc: '하루 한 번, 무료',               gain: 5, dailyLimit: 1, gold: 0,   materialsAny: [], xp: 0 },
  spar:  { id: 'spar',  name: '합동 훈련', emoji: '⚔️', desc: '골드를 들여 함께 훈련한다 (+XP)', gain: 6, dailyLimit: 2, gold: 120, materialsAny: [], xp: 10 },
};

export const BOND_ACTION_ORDER: readonly BondActionId[] = ['treat', 'talk', 'spar'];

export interface BondThreshold {
  readonly at: number;
  readonly label: string;
  readonly blurb: string;
  /** Guardian attack multiplier granted from this threshold on (cumulative, highest wins). */
  readonly atkMult: number;
  readonly reward?: { readonly soulCrystals?: number; readonly gems?: number };
}

export const BOND_THRESHOLDS: readonly BondThreshold[] = [
  { at: 25,  label: '신뢰',   blurb: '패시브 강화 · 공격 +3%',        atkMult: 1.03 },
  { at: 50,  label: '우정',   blurb: '개인 이야기 해금 · 공격 +6%',   atkMult: 1.06 },
  { at: 75,  label: '유대',   blurb: '영혼 결정 30 · 공격 +10%',      atkMult: 1.10, reward: { soulCrystals: 30 } },
  { at: 100, label: '일심',   blurb: '각성 가능 · 공격 +15%',         atkMult: 1.15 },
];

export function clampBond(value: number): number {
  return Math.max(0, Math.min(BOND_MAX, Math.floor(value)));
}

/** The highest threshold reached at `affinity`, or null below the first. */
export function bondTier(affinity: number): BondThreshold | null {
  let reached: BondThreshold | null = null;
  for (const threshold of BOND_THRESHOLDS) if (affinity >= threshold.at) reached = threshold;
  return reached;
}

/** Attack multiplier from bond alone — folded into guardianAtkMult by barracks. */
export function bondAtkMult(affinity: number | undefined): number {
  return bondTier(affinity ?? 0)?.atkMult ?? 1;
}

/** Thresholds crossed when affinity moves from `before` to `after`. */
export function bondThresholdsCrossed(before: number, after: number): readonly BondThreshold[] {
  return BOND_THRESHOLDS.filter(threshold => before < threshold.at && after >= threshold.at);
}

export function nextBondThreshold(affinity: number): BondThreshold | null {
  return BOND_THRESHOLDS.find(threshold => affinity < threshold.at) ?? null;
}

/** One line of the guardian's own story, unlocked at 우정 (50). Keyed by tribe; generic otherwise. */
export const BOND_STORY_BY_TRIBE: Readonly<Record<string, string>> = {
  dokkaebi:   '"이 던전에 처음 왔을 땐 방망이가 손에 안 맞았어. 이제는 내 손이 방망이야."',
  gumiho:     '"꼬리가 하나 늘 때마다 잊는 게 하나씩 생겨. 네 이름은 안 잊을게."',
  dragon:     '"바다 밑에서 천 년을 잤다. 깨어나 보니 지킬 것이 생겼더군."',
  underworld: '"저승의 문지기였지. 여긴 문이 많아서 좋아."',
  sansin:     '"산은 서두르지 않는다. 나도, 이 던전도."',
  sea:        '"파도는 돌아온다. 나도 매번 돌아올 거야."',
  mask:       '"탈 뒤의 얼굴이 궁금해? 이 던전에선 벗어도 되겠지."',
  moonlight:  '"달이 차면 나도 찬다. 오늘 밤은 꽤 밝겠어."',
  celestial:  '"하늘에서 보던 것보다 여기가 더 넓다."',
  primordial: '"세상이 생기기 전을 기억해. 그때도 이렇게 시끄럽진 않았지."',
  void:       '"…아무것도 없는 곳에서 왔어. 여긴 뭔가가 있네."',
};

export const BOND_STORY_DEFAULT = '"처음엔 그냥 방을 지키는 일이었는데, 이제는 네 던전을 지키는 일이야."';
