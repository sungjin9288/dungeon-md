// ─── Invasion forecast (침입 예보) ─────────────────────────────────────────────
// Every day the home shows three visitors. Picking one is the day's decision:
// a plain raid, an elite expedition, or a special guest (merchants, pilgrims,
// treasure hunters, the daily rule, Monday's weekly boss). Cards are derived
// from the date and the player's notoriety tier, so re-opening the game shows
// the same three. See docs/design/PHASE2_NOTORIETY_FORECAST.md §2.
//
// Pure: no scene, save or clock access — the caller passes the date.

import { dayIndexOf, seededRand, getDailyDungeon, getWeeklyBoss, type DailyRule, type DailyDungeon, type WeeklyBoss } from './daily';
import { INVADER_DEFS, type InvaderType } from './invaders';
import { getTraitBlurb } from './invaderTraits';
import { getNotorietyBand, NOTORIETY_GAIN, type NotorietyBand } from './notoriety';
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
  readonly weeklyBoss?: WeeklyBoss;
}

export const FORECAST_CARDS_PER_DAY = 3;

/** Weights for the day's third card. */
export const FORECAST_SPECIAL_WEIGHTS: ReadonlyArray<readonly [ForecastKind, number]> = [
  ['merchant', 30], ['pilgrim', 25], ['treasure', 15], ['daily_rule', 30],
];

export const FORECAST_TITLES: Readonly<Record<ForecastKind, readonly string[]>> = {
  raid:        ['국경 순찰대', '떠돌이 용병단', '마을 자경단', '보물 사냥꾼 일당'],
  elite:       ['왕실 정예대', '성기사단 원정', '길드의 정찰 부대', '현상금 사냥단'],
  merchant:    ['탐욕의 상인단'],
  pilgrim:     ['순례자 행렬'],
  treasure:    ['보물 사냥꾼의 도박'],
  weekly_boss: ['주간 토벌대'],
  daily_rule:  ['오늘의 시련'],
};

// ─── Wave composition ─────────────────────────────────────────────────────────

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))];
}

/**
 * A band-tier expedition: 6–10 waves whose head count scales with the tier and
 * whose roster is drawn from the band pool, closing with a boss for elites.
 */
export function buildBandWaves(band: NotorietyBand, kind: 'raid' | 'elite', rand: () => number): WaveSpec[] {
  const waveCount = Math.min(10, 6 + Math.floor((band.tier - 1) / 2));
  const waves: WaveSpec[] = [];
  for (let w = 1; w <= waveCount; w++) {
    const count = 3 + Math.floor(w * 0.6) + Math.floor(rand() * 2);
    const delay = Math.max(1200, 2400 - band.tier * 80 - w * 60);
    const lead = pick(band.pool, rand);
    const invaders: WaveSpec['invaders'] = [{ type: lead, count: Math.ceil(count * 0.65), spawnDelay: delay }];
    if (w >= 3) {
      const second = pick(band.pool, rand);
      invaders.push({ type: second, count: Math.max(1, Math.floor(count * 0.35)), spawnDelay: delay });
    }
    const reward = Math.round((40 + w * 15) * band.lootMult);
    waves.push({ wave: w, clearReward: reward, invaders });
  }
  if (kind === 'elite') {
    const boss = pick(band.bosses, rand);
    waves.push({
      wave: waveCount + 1,
      clearReward: Math.round(300 * band.lootMult),
      invaders: [{ type: boss, count: 1, spawnDelay: 0, isBoss: true }, { type: pick(band.pool, rand), count: 3, spawnDelay: 1500 }],
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

function pilgrimCard(id: string, band: NotorietyBand, rand: () => number): ForecastCard {
  const waves = buildBandWaves(band, 'raid', rand).slice(0, 4);
  return {
    id, kind: 'pilgrim', bandTier: band.tier, title: FORECAST_TITLES.pilgrim[0],
    waves, dungeonHp: band.dungeonHp, preview: previewOf(waves),
    reward: { soulCrystals: Math.round(20 * band.lootMult), notoriety: NOTORIETY_GAIN.pilgrim },
  };
}

function treasureCard(id: string, band: NotorietyBand, rand: () => number): ForecastCard {
  const waves = buildBandWaves(band, 'elite', rand);
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
    reward: { soulCrystals: daily.rewards.crystals, notoriety: NOTORIETY_GAIN.daily_rule },
    dailyRule: daily.rule,
  };
}

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
  if (input.isMonday) {
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
