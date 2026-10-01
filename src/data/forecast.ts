// ─── Invasion forecast (침입 예보) ─────────────────────────────────────────────
// Every day the home shows three visitors. Picking one is the day's decision:
// a raid party (토벌대), an elite expedition, or a special guest — merchants,
// an adventurer party after the treasure room (kind 'treasure'), a band of
// wandering monsters looking for a lair (kind 'pilgrim'), the daily rule, or
// Monday's rival dungeon master (kind 'weekly_boss'). Kind ids keep their old
// names so cards already issued into a save stay valid; visitors.ts owns the
// routes. Cards are derived
// from the date and the player's notoriety tier, so re-opening the game shows
// the same three. See docs/design/PHASE2_NOTORIETY_FORECAST.md §2.
//
// Pure: no scene, save or clock access — the caller passes the date.

import { dayIndexOf, seededRand, getDailyDungeon, getWeeklyBoss, type DailyRule, type DailyDungeon, type WeeklyBoss } from './daily';
import { INVADER_DEFS, type InvaderType } from './invaders';
import { getTraitBlurb } from './invaderTraits';
import { bandWaveBudget, getNotorietyBand, invaderThreshold, NOTORIETY_GAIN, type NotorietyBand } from './notoriety';
import { WANDERER_TRIBE, type VisitorKind } from './visitors';
import type { WaveSpec } from './stages';

export type ForecastKind = 'raid' | 'elite' | 'merchant' | 'pilgrim' | 'treasure' | 'weekly_boss' | 'daily_rule';

export interface ForecastReward {
  readonly gold?: number;
  readonly gems?: number;
  readonly soulCrystals?: number;
  readonly materials?: Readonly<Record<string, number>>;
  readonly notoriety: number;
}

export interface ForecastPreview {
  readonly invaderTypes: readonly InvaderType[];
  readonly traitBlurbs: readonly string[];
}

export interface ForecastCard {
  readonly id: string;
  readonly kind: ForecastKind;
  readonly title: string;
  readonly bandTier: number;
  /** Battle cards only — inline waves in the same shape as a story invasion. */
  readonly waves?: WaveSpec[];
  readonly dungeonHp?: number;
  readonly preview: ForecastPreview;
  readonly reward: ForecastReward;
  readonly dailyRule?: DailyRule;
  /** The daily dungeon this card wraps — its own rewards flow through applyClearRewards. */
  readonly daily?: DailyDungeon;
  readonly weeklyBoss?: WeeklyBoss;
}

export const FORECAST_CARDS_PER_DAY = 3;

/** Weights for the day's third card. */
export const FORECAST_SPECIAL_WEIGHTS: ReadonlyArray<readonly [ForecastKind, number]> = [
  ['merchant', 30], ['pilgrim', 25], ['treasure', 15], ['daily_rule', 30],
];

export const FORECAST_TITLES: Readonly<Record<ForecastKind, readonly string[]>> = {
  raid:        ['국경 토벌대', '영주의 토벌대', '마을 자경단', '수도 순찰대'],
  elite:       ['왕실 정예 토벌대', '성기사단 원정', '용사 원정대', '현상금 사냥단'],
  merchant:    ['탐욕의 상인단'],
  pilgrim:     ['떠돌이 몬스터 무리'],
  treasure:    ['모험가 파티'],
  weekly_boss: ['라이벌 던전마스터'],
  daily_rule:  ['오늘의 시련'],
};

/** 카드의 손님 종류 — 전투 경로와 목표 방을 정한다(visitors.ts). 전투 없는 카드는 null. */
export function forecastVisitor(kind: ForecastKind): VisitorKind | null {
  if (kind === 'treasure') return 'adventurer';
  if (kind === 'pilgrim') return 'wanderer';
  return kind === 'merchant' ? null : 'raider';
}

function withVisitor(waves: readonly WaveSpec[], visitor: VisitorKind): WaveSpec[] {
  return waves.map(wave => ({ ...wave, invaders: wave.invaders.map(group => ({ ...group, visitor })) }));
}

/**
 * 전투에 넘길 카드의 웨이브 — 카드 종류의 손님을 단다. 발급 때도 달지만, 이 규칙 이전에 발급돼 세이브에
 * 남은 오늘의 카드도 같은 경로로 싸우도록 시작할 때 한 번 더 적용한다.
 */
export function forecastBattleWaves(card: Pick<ForecastCard, 'kind' | 'waves'>): WaveSpec[] {
  const visitor = forecastVisitor(card.kind);
  const waves = card.waves ?? [];
  return visitor === 'adventurer' || visitor === 'wanderer' ? withVisitor(waves, visitor) : [...waves];
}

// ─── Wave composition ─────────────────────────────────────────────────────────

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))];
}

/** Corridor board cap: past this many heads a wave stops being spaced out. */
export const MAX_BAND_WAVE_HEADS = 14;
/** Heads kept free for the second group (wave 3+) when sizing the lead. */
const LEAD_RESERVED_HEADS = 4;

/** Heads of `type` that spend `budget` of sustained-DPS threat (veteran HP included), at least 1. */
function headsFor(type: InvaderType, budget: number, veteranMult: number, cap: number): number {
  return Math.max(1, Math.min(cap, Math.round(budget / (invaderThreshold(type) * veteranMult))));
}

/**
 * Draw from `pool`, but only units strong enough to spend `minThreatPerHead` per head — so a budget
 * can always be met inside the head cap. Without it a tier-10 wave that drew peasants for its second
 * group stopped at 77% of budget, and raising tier 2's budget 2.5× changed nothing (its peasants
 * hit the cap). Falls back to the strongest unit when none qualifies.
 */
function pickStrongEnough(pool: readonly InvaderType[], veteranMult: number, minThreatPerHead: number, rand: () => number): InvaderType {
  const strongEnough = pool.filter(type => invaderThreshold(type) * veteranMult >= minThreatPerHead);
  if (strongEnough.length > 0) return pick(strongEnough, rand);
  return pool.reduce((best, type) => (invaderThreshold(type) > invaderThreshold(best) ? type : best));
}

/**
 * A band-tier expedition: 6–10 waves on a threat budget (`bandWaveBudget`). The lead is drawn from
 * the band's lead pool and takes the whole budget on waves 1–2, 65% after; the second group
 * (wave 3+) from the whole pool takes the rest. Head count follows from the budget, so a tough
 * lead comes in fewer — before the budget a fixed head count made the same tier swing with the
 * draw (tier 10 per-wave threat varied ±50%). Elites close with a band boss.
 */
export function buildBandWaves(band: NotorietyBand, kind: 'raid' | 'elite', rand: () => number): WaveSpec[] {
  const waveCount = Math.min(10, 6 + Math.floor((band.tier - 1) / 2));
  const veteran = band.veteranMult !== 1 ? { veteranMult: band.veteranMult } : {};
  const waves: WaveSpec[] = [];
  for (let w = 1; w <= waveCount; w++) {
    const budget = bandWaveBudget(band, w);
    const delay = Math.max(1200, 2400 - band.tier * 80 - w * 60);
    const leadShare = w >= 3 ? 0.65 : 1;
    const leadCap = MAX_BAND_WAVE_HEADS - (w >= 3 ? LEAD_RESERVED_HEADS : 0);
    const lead = pickStrongEnough(band.lead, band.veteranMult, budget * leadShare / leadCap, rand);
    const leadCount = headsFor(lead, budget * leadShare, band.veteranMult, leadCap);
    const invaders: WaveSpec['invaders'] = [{ type: lead, count: leadCount, spawnDelay: delay, ...veteran }];
    if (w >= 3) {
      const room = MAX_BAND_WAVE_HEADS - leadCount;
      const second = pickStrongEnough(band.pool, band.veteranMult, budget * (1 - leadShare) / room, rand);
      const secondCount = headsFor(second, budget * (1 - leadShare), band.veteranMult, room);
      invaders.push({ type: second, count: secondCount, spawnDelay: delay, ...veteran });
    }
    const reward = Math.round((40 + w * 15) * band.lootMult);
    waves.push({ wave: w, clearReward: reward, invaders });
  }
  if (kind === 'elite') {
    const boss = pick(band.bosses, rand);
    waves.push({
      wave: waveCount + 1,
      clearReward: Math.round(300 * band.lootMult),
      invaders: [
        { type: boss, count: 1, spawnDelay: 0, isBoss: true },
        { type: pick(band.pool, rand), count: 3, spawnDelay: 1500, ...veteran },
      ],
    });
  }
  return waves;
}

function previewOf(waves: readonly WaveSpec[]): ForecastPreview {
  const seen = new Set<InvaderType>();
  for (const wave of waves) for (const group of wave.invaders) seen.add(group.type);
  const invaderTypes = [...seen];
  const traitBlurbs = invaderTypes
    .map(type => getTraitBlurb(INVADER_DEFS[type]?.behavior))
    .filter((blurb): blurb is string => Boolean(blurb));
  return { invaderTypes, traitBlurbs: [...new Set(traitBlurbs)].slice(0, 3) };
}

function lootOf(waves: readonly WaveSpec[]): number {
  return waves.reduce((sum, wave) => sum + wave.invaders.reduce((kills, g) => kills + g.count * (INVADER_DEFS[g.type]?.reward ?? 0), 0), 0);
}

// ─── Card builders ────────────────────────────────────────────────────────────

function raidCard(id: string, band: NotorietyBand, kind: 'raid' | 'elite', rand: () => number): ForecastCard {
  const waves = buildBandWaves(band, kind, rand);
  const gain = kind === 'elite' ? NOTORIETY_GAIN.elite : NOTORIETY_GAIN.raid;
  return {
    id, kind, bandTier: band.tier, title: pick(FORECAST_TITLES[kind], rand),
    waves, dungeonHp: band.dungeonHp, preview: previewOf(waves),
    reward: { gold: Math.round(lootOf(waves) * 0.25 * band.lootMult), notoriety: gain },
  };
}

function merchantCard(id: string, band: NotorietyBand): ForecastCard {
  return {
    id, kind: 'merchant', bandTier: band.tier, title: FORECAST_TITLES.merchant[0],
    preview: { invaderTypes: [], traitBlurbs: [] },
    // Sells the day's spare materials at the band's prices; no battle, no notoriety.
    reward: { gold: Math.round(150 * band.lootMult), notoriety: 0 },
  };
}

/**
 * 떠돌이 몬스터 무리: 4웨이브, 괴물형 침입자 중 이 밴드의 위협도(hp×speed) 안에 드는 것만.
 * 밴드 풀의 가장 센 유닛의 1.25배까지 — 굴을 찾아온 손님이지 토벌대보다 센 부대가 아니다.
 */
export function buildWandererWaves(band: NotorietyBand, rand: () => number): WaveSpec[] {
  const ceiling = Math.max(...band.pool.map(invaderThreshold)) * 1.25;
  const all = (Object.keys(WANDERER_TRIBE) as InvaderType[]).sort((a, b) => invaderThreshold(a) - invaderThreshold(b));
  const pool = all.filter(type => invaderThreshold(type) <= ceiling);
  const choices = pool.length > 0 ? pool : all.slice(0, 1);
  const waves: WaveSpec[] = [];
  for (let w = 1; w <= 4; w++) {
    const count = 3 + w + Math.floor(rand() * 2);
    const delay = Math.max(1200, 2400 - band.tier * 80 - w * 60);
    waves.push({
      wave: w,
      clearReward: Math.round((40 + w * 15) * band.lootMult),
      invaders: [{ type: pick(choices, rand), count, spawnDelay: delay, visitor: 'wanderer' }],
    });
  }
  return waves;
}

function pilgrimCard(id: string, band: NotorietyBand, rand: () => number): ForecastCard {
  const waves = buildWandererWaves(band, rand);
  return {
    id, kind: 'pilgrim', bandTier: band.tier, title: FORECAST_TITLES.pilgrim[0],
    waves, dungeonHp: band.dungeonHp, preview: previewOf(waves),
    reward: { soulCrystals: Math.round(20 * band.lootMult), notoriety: NOTORIETY_GAIN.pilgrim },
  };
}

function treasureCard(id: string, band: NotorietyBand, rand: () => number): ForecastCard {
  const waves = withVisitor(buildBandWaves(band, 'elite', rand), 'adventurer');
  return {
    id, kind: 'treasure', bandTier: band.tier, title: FORECAST_TITLES.treasure[0],
    waves, dungeonHp: band.dungeonHp, preview: previewOf(waves),
    reward: { gems: 50 + Math.round(5 * band.tier), notoriety: NOTORIETY_GAIN.treasure },
  };
}

function dailyRuleCard(id: string, band: NotorietyBand, daily: DailyDungeon): ForecastCard {
  return {
    id, kind: 'daily_rule', bandTier: band.tier, title: `${FORECAST_TITLES.daily_rule[0]} · ${daily.name}`,
    waves: daily.waves, dungeonHp: band.dungeonHp, preview: previewOf(daily.waves),
    // Crystals/materials are paid by applyClearRewards through `daily`; the card adds the name only.
    reward: { notoriety: NOTORIETY_GAIN.daily_rule },
    dailyRule: daily.rule,
    daily,
  };
}

/**
 * The weekly boss is a fixed 40k–220k HP rotation, far above any band's own
 * boss; offering it at tier 1 put an unwinnable card on a new player's Monday.
 * Below this tier Monday draws from the regular special pool.
 */
export const WEEKLY_BOSS_MIN_TIER = 5;

function weeklyBossCard(id: string, band: NotorietyBand, boss: WeeklyBoss): ForecastCard {
  const waves: WaveSpec[] = [{
    wave: 1, clearReward: boss.rewards.skinShards * 100,
    invaders: [{ type: boss.bossType, count: 1, spawnDelay: 0, isBoss: true }],
  }];
  return {
    id, kind: 'weekly_boss', bandTier: band.tier, title: `${FORECAST_TITLES.weekly_boss[0]} · ${boss.name}`,
    waves, dungeonHp: 3000, preview: previewOf(waves),
    reward: { notoriety: NOTORIETY_GAIN.weekly_boss },
    weeklyBoss: boss,
  };
}

// ─── Issue ────────────────────────────────────────────────────────────────────

export interface ForecastIssueInput {
  readonly date: string;          // YYYY-MM-DD
  readonly tier: number;
  readonly isMonday: boolean;
  readonly daily: DailyDungeon;
  readonly weeklyBoss: WeeklyBoss;
}

/** The day's three cards, deterministic for a (date, tier) pair. */
export function issueForecastCards(input: ForecastIssueInput): ForecastCard[] {
  const rand = seededRand(dayIndexOf(input.date) * 31 + input.tier * 7 + 11);
  const band = getNotorietyBand(input.tier);
  const idOf = (index: number) => `${input.date}-${index}`;

  const first = raidCard(idOf(0), band, 'raid', rand);
  const second = rand() < 0.6
    ? raidCard(idOf(1), band, 'elite', rand)
    : raidCard(idOf(1), getNotorietyBand(band.tier + 1), 'raid', rand);

  let third: ForecastCard;
  if (input.isMonday && input.tier >= WEEKLY_BOSS_MIN_TIER) {
    third = weeklyBossCard(idOf(2), band, input.weeklyBoss);
  } else {
    const total = FORECAST_SPECIAL_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rand() * total;
    let kind: ForecastKind = 'merchant';
    for (const [candidate, weight] of FORECAST_SPECIAL_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) { kind = candidate; break; }
    }
    third = kind === 'merchant' ? merchantCard(idOf(2), band)
      : kind === 'pilgrim' ? pilgrimCard(idOf(2), band, rand)
      : kind === 'treasure' ? treasureCard(idOf(2), band, rand)
      : dailyRuleCard(idOf(2), band, input.daily);
  }
  return [first, second, third];
}

/** Convenience for callers with a clock: today's inputs from the live daily/weekly pools. */
export function forecastIssueInputFor(date: string, tier: number): ForecastIssueInput {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { date, tier, isMonday: day === 1, daily: getDailyDungeon(), weeklyBoss: getWeeklyBoss() };
}

export function isBattleCard(card: ForecastCard): card is ForecastCard & { waves: WaveSpec[]; dungeonHp: number } {
  return Array.isArray(card.waves) && card.waves.length > 0 && typeof card.dungeonHp === 'number';
}
