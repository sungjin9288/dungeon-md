import type { MonsterId } from './monsters';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SummonBannerType = 'normal' | 'special' | 'soul' | 'friendship';
export type BannerSeason = 'spring' | 'summer' | 'fall' | 'winter' | 'special';
export type BannerRarity = 'rare' | 'epic' | 'legendary';

export interface SeasonBanner {
  id:                string;
  name:              string;           // "봄맞이 구미호 배너"
  subname:           string;           // "이달의 피처드 배너"
  icon:              string;           // "🌸"
  description:       string;          // 한 줄 설명
  season:            BannerSeason;
  bgColor:           number;           // 패널 배경
  borderColor:       number;           // 외곽선 (펄스 애니)
  glowColor:         number;           // 내부 글로우
  accentCss:         string;           // 텍스트 강조색
  featuredMonsters:  MonsterId[];      // 확률 부스트 대상
  boostedRarity:     BannerRarity;     // 부스트가 적용될 희귀도 Pool
  rateMultiplier:    number;           // 해당 Pool 내 피처드 비중 (0~1, 0.5 = 50%)
  validSummonTypes:  SummonBannerType[];  // 이 배너가 적용되는 소환 타입
  startDate:         string;           // "YYYY-MM-DD"
  endDate:           string;           // "YYYY-MM-DD" (inclusive)
}

// ─── Banner data ──────────────────────────────────────────────────────────────

export const SEASON_BANNERS: SeasonBanner[] = [
  // ── 봄맞이 구미호 배너 (2026-03-01 ~ 2026-04-30) ─────────────────────────────
  {
    id:               'spring_gumiho_2026',
    name:             '봄맞이 구미호 배너',
    subname:          '🌸 이달의 피처드 배너',
    icon:             '🌸',
    description:      '벚꽃 피는 봄, 구미호 일족 등장 확률 3배!',
    season:           'spring',
    bgColor:          0x1a0015,
    borderColor:      0xff44aa,
    glowColor:        0xff88cc,
    accentCss:        '#ff88cc',
    featuredMonsters: ['gumiho_guardian', 'five_tail_fox', 'ice_gumiho', 'thunder_gumiho', 'gumiho_queen'],
    boostedRarity:    'rare',
    rateMultiplier:   0.55,   // 55% chance to pick from featured if rare is rolled
    validSummonTypes: ['normal', 'special'],
    startDate:        '2026-03-01',
    endDate:          '2026-04-30',
  },

  // ── 여름 해신 배너 (2026-06-01 ~ 2026-08-31) ─────────────────────────────────
  {
    id:               'summer_sea_2026',
    name:             '해신의 부름 배너',
    subname:          '🌊 이달의 피처드 배너',
    icon:             '🌊',
    description:      '여름 바다의 신들이 깨어난다! 해신족 3배!',
    season:           'summer',
    bgColor:          0x00101a,
    borderColor:      0x00aaff,
    glowColor:        0x44ddff,
    accentCss:        '#44ddff',
    featuredMonsters: ['sea_god_spear', 'sea_dragon_archer', 'sea_general', 'sea_witch', 'shark_warrior', 'kraken_soldier', 'dragon_king_guardian'],
    boostedRarity:    'epic',
    rateMultiplier:   0.55,
    validSummonTypes: ['normal', 'special'],
    startDate:        '2026-06-01',
    endDate:          '2026-08-31',
  },

  // ── 가을 저승 배너 (2026-09-15 ~ 2026-10-31) ─────────────────────────────────
  {
    id:               'fall_underworld_2026',
    name:             '저승의 문 배너',
    subname:          '💀 한정 이벤트 배너',
    icon:             '💀',
    description:      '이승과 저승의 경계가 허물어진다. 저승족 부스트!',
    season:           'fall',
    bgColor:          0x0a0010,
    borderColor:      0xaa44ff,
    glowColor:        0xcc88ff,
    accentCss:        '#cc88ff',
    featuredMonsters: ['death_messenger', 'underworld_archer', 'underworld_witch', 'hell_guard', 'yomra_warrior', 'ghost_king', 'spirit_summoner'],
    boostedRarity:    'epic',
    rateMultiplier:   0.55,
    validSummonTypes: ['normal', 'special'],
    startDate:        '2026-09-15',
    endDate:          '2026-10-31',
  },

  // ── 늦가을 달빛 배너 (2026-11-01 ~ 2026-11-30) ──────────────────────────────
  {
    id:               'late_fall_moonlight_2026',
    name:             '달빛 축제 배너',
    subname:          '🌙 이달의 피처드 배너',
    icon:             '🌙',
    description:      '가을밤 달빛 아래 신비로운 일족이 나타난다!',
    season:           'fall',
    bgColor:          0x080020,
    borderColor:      0x6666ff,
    glowColor:        0x9999ff,
    accentCss:        '#9999ff',
    featuredMonsters: ['moonlight_rabbit', 'starlight_fairy', 'crescent_archer', 'moonlight_tiger', 'galaxy_warrior', 'full_moon_sorcerer', 'mask_dancer', 'mask_archer'],
    boostedRarity:    'epic',
    rateMultiplier:   0.55,
    validSummonTypes: ['normal', 'special'],
    startDate:        '2026-11-01',
    endDate:          '2026-11-30',
  },

  // ── 겨울 산신 배너 (2026-12-01 ~ 2027-01-31) ─────────────────────────────────
  {
    id:               'winter_mountain_2026',
    name:             '설산의 수호자 배너',
    subname:          '⛰️ 이달의 피처드 배너',
    icon:             '⛰️',
    description:      '눈 덮인 산에 신령이 깨어났다. 산신족 3배!',
    season:           'winter',
    bgColor:          0x000d1a,
    borderColor:      0x44aaff,
    glowColor:        0x88ccff,
    accentCss:        '#88ccff',
    featuredMonsters: ['white_tiger', 'frost_spirit', 'bear_god', 'mountain_spirit_boy', 'phoenix', 'thousand_pine', 'mountain_god'],
    boostedRarity:    'legendary',
    rateMultiplier:   0.60,
    validSummonTypes: ['special'],
    startDate:        '2026-12-01',
    endDate:          '2027-01-31',
  },

  // ── 용족 특별 배너 (2026-05-01 ~ 2026-05-31) ─────────────────────────────────
  {
    id:               'special_dragon_2026',
    name:             '용의 각성 배너',
    subname:          '🐲 스페셜 한정 배너',
    icon:             '🐲',
    description:      '전설의 용족이 모습을 드러낸다! 전설 보장!',
    season:           'special',
    bgColor:          0x100800,
    borderColor:      0xff8800,
    glowColor:        0xffcc44,
    accentCss:        '#ffcc44',
    featuredMonsters: ['red_dragon_warrior', 'blue_dragon_guardian', 'gold_dragon_sage', 'black_dragon_assassin', 'white_dragon_healer', 'blue_dragon_archmage'],
    boostedRarity:    'epic',
    rateMultiplier:   0.65,
    validSummonTypes: ['special'],
    startDate:        '2026-05-01',
    endDate:          '2026-05-31',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the banner that is currently active (based on today's date),
 * or null if none is active.
 */
export function getActiveBanner(now: Date = new Date()): SeasonBanner | null {
  const today = now.toISOString().slice(0, 10);
  return SEASON_BANNERS.find(b => b.startDate <= today && today <= b.endDate) ?? null;
}

/**
 * Returns the remaining time of the active banner as a human-readable string.
 * e.g.  "37일 14시간 남음"
 */
export function getBannerTimeLeft(banner: SeasonBanner, now: Date = new Date()): string {
  const end        = new Date(banner.endDate + 'T23:59:59');
  const diffMs     = end.getTime() - now.getTime();
  if (diffMs <= 0) return '종료됨';

  const totalSecs  = Math.floor(diffMs / 1000);
  const days       = Math.floor(totalSecs / 86400);
  const hours      = Math.floor((totalSecs % 86400) / 3600);
  const mins       = Math.floor((totalSecs % 3600) / 60);

  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${mins}분 남음`;
  return `${mins}분 남음`;
}

/**
 * Given a rolled rarity pool, apply the banner boost:
 * returns either a featured monster (with probability rateMultiplier)
 * or picks normally from the full pool.
 */
export function applyBannerBoost(
  banner:   SeasonBanner,
  rarity:   string,
  pool:     MonsterId[],
): MonsterId {
  if (rarity !== banner.boostedRarity) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const featured = banner.featuredMonsters.filter(id => pool.includes(id));
  if (featured.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  if (Math.random() < banner.rateMultiplier) {
    return featured[Math.floor(Math.random() * featured.length)];
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
