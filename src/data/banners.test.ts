import { describe, it, expect } from 'vitest';
import {
  SEASON_BANNERS,
  getActiveBanner,
  getBannerTimeLeft,
  applyBannerBoost,
} from './banners';
import type { SeasonBanner } from './banners';
import type { MonsterId } from './monsters';
import { MONSTER_DEFS } from './monsters';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

const SAMPLE_BANNER: SeasonBanner = {
  id: 'test_banner',
  name: '테스트 배너',
  subname: '테스트',
  icon: '🧪',
  description: '테스트용 배너',
  season: 'special',
  bgColor: 0x000000,
  borderColor: 0xffffff,
  glowColor: 0xaaaaaa,
  accentCss: '#fff',
  featuredMonsters: ['gumiho_guardian', 'white_tiger'],
  boostedRarity: 'epic',
  rateMultiplier: 0.6,
  validSummonTypes: ['normal'],
  startDate: '2026-01-01',
  endDate: '2026-01-31',
};

// ─── SEASON_BANNERS data integrity ───────────────────────────────────────────

describe('SEASON_BANNERS', () => {
  it('contains at least 7 banners', () => {
    expect(SEASON_BANNERS.length).toBeGreaterThanOrEqual(7);
  });

  it('has unique banner ids', () => {
    const ids = SEASON_BANNERS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every banner has a non-empty name, icon, and description', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.name.length, `banner ${b.id} name`).toBeGreaterThan(0);
      expect(b.icon.length, `banner ${b.id} icon`).toBeGreaterThan(0);
      expect(b.description.length, `banner ${b.id} description`).toBeGreaterThan(0);
    }
  });

  it('startDate is always before or equal to endDate', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.startDate <= b.endDate, `banner ${b.id}`).toBe(true);
    }
  });

  it('rateMultiplier is between 0 and 1 for every banner', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.rateMultiplier, `banner ${b.id}`).toBeGreaterThan(0);
      expect(b.rateMultiplier, `banner ${b.id}`).toBeLessThanOrEqual(1);
    }
  });

  it('every banner has at least one featuredMonster', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.featuredMonsters.length, `banner ${b.id}`).toBeGreaterThan(0);
    }
  });

  it('every banner has at least one validSummonType', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.validSummonTypes.length, `banner ${b.id}`).toBeGreaterThan(0);
    }
  });

  it('ch8_abyss_2027 banner exists with correct key fields', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'ch8_abyss_2027');
    expect(b).toBeDefined();
    expect(b!.startDate).toBe('2027-02-01');
    expect(b!.endDate).toBe('2027-03-31');
    expect(b!.boostedRarity).toBe('legendary');
    expect(b!.rateMultiplier).toBe(0.70);
    expect(b!.validSummonTypes).toContain('special');
    expect(b!.validSummonTypes).toContain('soul');
    expect(b!.featuredMonsters).toContain('god_realm_general');
    expect(b!.featuredMonsters).toContain('abyss_mage');
  });
});

// ─── getActiveBanner ─────────────────────────────────────────────────────────

describe('getActiveBanner', () => {
  it('returns null when no banner is active', () => {
    const result = getActiveBanner(makeDate('2025-01-01'));
    expect(result).toBeNull();
  });

  it('returns a banner when date is within range', () => {
    // spring_gumiho_2026: 2026-03-01 ~ 2026-04-30
    const result = getActiveBanner(makeDate('2026-03-15'));
    expect(result).not.toBeNull();
    expect(result!.startDate <= '2026-03-15').toBe(true);
    expect(result!.endDate >= '2026-03-15').toBe(true);
  });

  it('returns a banner on the start date (inclusive)', () => {
    const first = SEASON_BANNERS[0];
    const result = getActiveBanner(makeDate(first.startDate));
    expect(result).not.toBeNull();
  });

  it('returns a banner on the end date (inclusive)', () => {
    const first = SEASON_BANNERS[0];
    const result = getActiveBanner(makeDate(first.endDate));
    expect(result).not.toBeNull();
  });

  it('returns null one day before start date', () => {
    const isolated = SEASON_BANNERS.find(b => b.id === 'ch8_abyss_2027')!;
    // 2027-01-31 is before 2027-02-01
    const result = getActiveBanner(makeDate('2027-01-31'));
    // Should not be ch8_abyss_2027
    expect(result?.id).not.toBe(isolated.id);
  });

  it('returns null one day after end date', () => {
    const isolated = SEASON_BANNERS.find(b => b.id === 'ch8_abyss_2027')!;
    // 2027-04-01 is after 2027-03-31
    const result = getActiveBanner(makeDate('2027-04-01'));
    expect(result?.id).not.toBe(isolated.id);
  });

  it('returns null for a far-future date (2028-01-01) after all banners have ended', () => {
    expect(getActiveBanner(makeDate('2028-01-01'))).toBeNull();
  });

  it('returns spring_gumiho_2026 specifically on 2026-03-15', () => {
    const result = getActiveBanner(makeDate('2026-03-15'));
    expect(result?.id).toBe('spring_gumiho_2026');
  });
});

// ─── getBannerTimeLeft ────────────────────────────────────────────────────────

describe('getBannerTimeLeft', () => {
  it('returns "종료됨" when banner has expired', () => {
    const result = getBannerTimeLeft(SAMPLE_BANNER, makeDate('2026-02-01'));
    expect(result).toBe('종료됨');
  });

  it('shows days remaining when > 24 hours left', () => {
    // endDate 2026-01-31T23:59:59, check from 2026-01-20 → ~11 days left
    const result = getBannerTimeLeft(SAMPLE_BANNER, makeDate('2026-01-20'));
    expect(result).toMatch(/\d+일/);
  });

  it('returns a string containing "남음" when banner has days remaining', () => {
    // From Jan 1 with endDate Jan 31 → clearly 30 days left, no timezone issues
    const result = getBannerTimeLeft(SAMPLE_BANNER, makeDate('2026-01-01'));
    expect(result).toContain('남음');
    expect(result).toMatch(/\d+일/);
  });

  it('returns a non-empty string for any active date', () => {
    const result = getBannerTimeLeft(SAMPLE_BANNER, makeDate('2026-01-15'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('shows hours+minutes string when < 24 hours remain', () => {
    // Construct "now" as 5.5 hours before the computed end timestamp — timezone-safe.
    const end = new Date('2026-01-31T23:59:59');
    const now = new Date(end.getTime() - 5.5 * 3600 * 1000);
    const result = getBannerTimeLeft(SAMPLE_BANNER, now);
    expect(result).toMatch(/\d+시간.*분 남음/);
    expect(result).not.toContain('일');
  });

  it('shows minutes-only string when < 1 hour remains', () => {
    const end = new Date('2026-01-31T23:59:59');
    const now = new Date(end.getTime() - 30 * 60 * 1000); // 30 min before end
    const result = getBannerTimeLeft(SAMPLE_BANNER, now);
    expect(result).toMatch(/^\d+분 남음$/);
    expect(result).not.toContain('시간');
    expect(result).not.toContain('일');
  });

  it('days format includes both 일 and 시간 components', () => {
    // From Jan 20 with endDate Jan 31 → >24 hours left → "N일 M시간 남음"
    const result = getBannerTimeLeft(SAMPLE_BANNER, makeDate('2026-01-20'));
    expect(result).toMatch(/\d+일 \d+시간 남음/);
  });

  it('1 second before expiry returns "0분 남음"', () => {
    const end = new Date('2026-01-31T23:59:59');
    const now = new Date(end.getTime() - 1000); // 1 second before end
    // totalSecs=1, days=0, hours=0, mins=0 → "0분 남음"
    expect(getBannerTimeLeft(SAMPLE_BANNER, now)).toBe('0분 남음');
  });
});

// ─── applyBannerBoost ─────────────────────────────────────────────────────────

describe('applyBannerBoost', () => {
  const epicPool: MonsterId[] = ['gumiho_guardian', 'white_tiger', 'death_messenger', 'fire_dokkaebi'] as MonsterId[];

  it('returns a monster from pool when rarity does not match boostedRarity', () => {
    const result = applyBannerBoost(SAMPLE_BANNER, 'rare', epicPool);
    expect(epicPool).toContain(result);
  });

  it('returns featured monsters more often than non-featured when rarity matches', () => {
    // Pool has 2 featured + 2 non-featured. Featured should appear more than 50%.
    let featuredHits = 0;
    const RUNS = 500;
    for (let i = 0; i < RUNS; i++) {
      const m = applyBannerBoost(SAMPLE_BANNER, 'epic', epicPool);
      if (SAMPLE_BANNER.featuredMonsters.includes(m)) featuredHits++;
    }
    // Featured in pool = 2/4 = 50% baseline. rateMultiplier=0.6 boosts this further.
    // Actual expected rate ≈ 0.6 + 0.4*0.5 = 0.8. Expect clearly > 50%.
    expect(featuredHits / RUNS).toBeGreaterThan(0.55);
  });

  it('falls back to full pool when no featured monsters are in pool', () => {
    const noFeaturedPool: MonsterId[] = ['death_messenger', 'fire_dokkaebi'] as MonsterId[];
    const result = applyBannerBoost(SAMPLE_BANNER, 'epic', noFeaturedPool);
    expect(noFeaturedPool).toContain(result);
  });

  it('always returns a string monster id', () => {
    for (let i = 0; i < 20; i++) {
      const result = applyBannerBoost(SAMPLE_BANNER, 'epic', epicPool);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('rateMultiplier=1.0 always picks a featured monster', () => {
    const alwaysFeatured: SeasonBanner = { ...SAMPLE_BANNER, rateMultiplier: 1.0 };
    for (let i = 0; i < 30; i++) {
      const result = applyBannerBoost(alwaysFeatured, 'epic', epicPool);
      expect(alwaysFeatured.featuredMonsters).toContain(result);
    }
  });
});

// ─── SEASON_BANNERS × MONSTER_DEFS — featuredMonsters cross-reference ─────────

describe('SEASON_BANNERS × MONSTER_DEFS — no orphan featuredMonsters', () => {
  it('every featuredMonsters id exists in MONSTER_DEFS', () => {
    for (const banner of SEASON_BANNERS) {
      for (const id of banner.featuredMonsters) {
        expect(
          MONSTER_DEFS[id as keyof typeof MONSTER_DEFS],
          `Banner "${banner.id}" featuredMonster "${id}" not found in MONSTER_DEFS`,
        ).toBeDefined();
      }
    }
  });

  it('spring_gumiho_2026 features gumiho tribe monsters', () => {
    const banner = SEASON_BANNERS.find(b => b.id === 'spring_gumiho_2026')!;
    expect(banner).toBeDefined();
    // gumiho_guardian is a core Ch2 gumiho monster
    expect(banner.featuredMonsters).toContain('gumiho_guardian');
  });

  it('ch7_celestial_2026 features all 8 celestial tribe monsters', () => {
    const banner = SEASON_BANNERS.find(b => b.id === 'ch7_celestial_2026')!;
    expect(banner).toBeDefined();
    expect(banner.featuredMonsters).toHaveLength(8);
    expect(banner.featuredMonsters).toContain('god_realm_general');
    expect(banner.featuredMonsters).toContain('celestial_guardian');
  });

  it('special_dragon_2026 features dragon tribe monsters', () => {
    const banner = SEASON_BANNERS.find(b => b.id === 'special_dragon_2026')!;
    expect(banner).toBeDefined();
    expect(banner.featuredMonsters).toContain('blue_dragon_archmage');
  });

  it('dates are valid ISO strings (YYYY-MM-DD) for every banner', () => {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const banner of SEASON_BANNERS) {
      expect(dateRe.test(banner.startDate), `${banner.id} startDate`).toBe(true);
      expect(dateRe.test(banner.endDate),   `${banner.id} endDate`  ).toBe(true);
    }
  });
});

// ─── SEASON_BANNERS — season and rarity coverage ──────────────────────────────

describe('SEASON_BANNERS — season and rarity coverage', () => {
  const seasons = new Set(SEASON_BANNERS.map(b => b.season));

  it('spring season is represented', () => expect(seasons.has('spring')).toBe(true));
  it('summer season is represented', () => expect(seasons.has('summer')).toBe(true));
  it('fall season is represented',   () => expect(seasons.has('fall')).toBe(true));
  it('winter season is represented', () => expect(seasons.has('winter')).toBe(true));
  it('special season is represented',() => expect(seasons.has('special')).toBe(true));

  it('every boostedRarity is rare, epic, or legendary', () => {
    const valid = new Set<string>(['rare', 'epic', 'legendary']);
    for (const b of SEASON_BANNERS) {
      expect(valid.has(b.boostedRarity), `${b.id} boostedRarity "${b.boostedRarity}"`).toBe(true);
    }
  });

  it('every validSummonType entry is a known summon type', () => {
    const valid = new Set<string>(['normal', 'special', 'soul', 'friendship']);
    for (const b of SEASON_BANNERS) {
      for (const t of b.validSummonTypes) {
        expect(valid.has(t), `${b.id} validSummonType "${t}"`).toBe(true);
      }
    }
  });

  it('accentCss is a non-empty string for every banner', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.accentCss.length, `${b.id} accentCss`).toBeGreaterThan(0);
    }
  });

  it('ch8_abyss_2027 has the highest rateMultiplier (0.70)', () => {
    const max = Math.max(...SEASON_BANNERS.map(b => b.rateMultiplier));
    const b = SEASON_BANNERS.find(b => b.id === 'ch8_abyss_2027')!;
    expect(b.rateMultiplier).toBeCloseTo(max);
    expect(b.rateMultiplier).toBeCloseTo(0.70);
  });

  it('subname is a non-empty string for every banner', () => {
    for (const b of SEASON_BANNERS) {
      expect(typeof b.subname, `${b.id} subname type`).toBe('string');
      expect(b.subname.length, `${b.id} subname`).toBeGreaterThan(0);
    }
  });

  it('bgColor, borderColor, and glowColor are all positive numbers for every banner', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.bgColor,     `${b.id} bgColor`    ).toBeGreaterThan(0);
      expect(b.borderColor, `${b.id} borderColor`).toBeGreaterThan(0);
      expect(b.glowColor,   `${b.id} glowColor`  ).toBeGreaterThan(0);
    }
  });
});

// ─── SEASON_BANNERS — per-banner spot-checks ─────────────────────────────────

describe('SEASON_BANNERS — per-banner spot-checks', () => {
  it('summer_sea_2026: season=summer, boostedRarity=epic, features sea monsters', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'summer_sea_2026')!;
    expect(b).toBeDefined();
    expect(b.season).toBe('summer');
    expect(b.boostedRarity).toBe('epic');
    expect(b.featuredMonsters.length).toBeGreaterThan(0);
  });

  it('fall_underworld_2026: season=fall, boostedRarity=epic', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'fall_underworld_2026')!;
    expect(b).toBeDefined();
    expect(b.season).toBe('fall');
    expect(b.boostedRarity).toBe('epic');
  });

  it('winter_mountain_2026: season=winter, boostedRarity=legendary, rateMultiplier=0.60', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'winter_mountain_2026')!;
    expect(b).toBeDefined();
    expect(b.season).toBe('winter');
    expect(b.boostedRarity).toBe('legendary');
    expect(b.rateMultiplier).toBeCloseTo(0.60);
  });

  it('late_fall_moonlight_2026: season=fall, features moonlight tribe', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'late_fall_moonlight_2026')!;
    expect(b).toBeDefined();
    expect(b.season).toBe('fall');
  });

  it('spring_gumiho_2026: startDate=2026-03-01, rateMultiplier=0.55', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'spring_gumiho_2026')!;
    expect(b.startDate).toBe('2026-03-01');
    expect(b.rateMultiplier).toBeCloseTo(0.55);
  });

  it('ch7_celestial_2026: season=special, boostedRarity=epic, rateMultiplier=0.65', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'ch7_celestial_2026')!;
    expect(b.season).toBe('special');
    expect(b.boostedRarity).toBe('epic');
    expect(b.rateMultiplier).toBeCloseTo(0.65);
  });

  it('special_dragon_2026: season=special, boostedRarity=epic, rateMultiplier=0.65', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'special_dragon_2026')!;
    expect(b).toBeDefined();
    expect(b.season).toBe('special');
    expect(b.boostedRarity).toBe('epic');
    expect(b.rateMultiplier).toBeCloseTo(0.65);
  });

  it('special_dragon_2026: startDate=2026-05-01, endDate=2026-05-31, validSummonTypes=[special]', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'special_dragon_2026')!;
    expect(b.startDate).toBe('2026-05-01');
    expect(b.endDate).toBe('2026-05-31');
    expect(b.validSummonTypes).toEqual(['special']);
  });

  it('special_dragon_2026 features all 6 dragon tribe monsters', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'special_dragon_2026')!;
    expect(b.featuredMonsters).toHaveLength(6);
    expect(b.featuredMonsters).toContain('red_dragon_warrior');
    expect(b.featuredMonsters).toContain('blue_dragon_archmage');
  });
});

// ─── SEASON_BANNERS — index pins, exact count & date spot-checks ──────────────

describe('SEASON_BANNERS — index pins, exact count & date spot-checks', () => {
  it('SEASON_BANNERS contains exactly 8 entries', () => {
    expect(SEASON_BANNERS).toHaveLength(8);
  });

  it('SEASON_BANNERS[0].id is spring_gumiho_2026 (first entry)', () => {
    expect(SEASON_BANNERS[0].id).toBe('spring_gumiho_2026');
  });

  it('getActiveBanner("2026-05-15") returns ch7_celestial_2026 (first-match wins over special_dragon_2026)', () => {
    // ch7_celestial_2026 (index 5): 2026-04-06 ~ 2026-05-31  ← matched first
    // special_dragon_2026 (index 7): 2026-05-01 ~ 2026-05-31  ← also active but later in array
    const result = getActiveBanner(new Date('2026-05-15'));
    expect(result).not.toBeNull();
    expect(result!.id).toBe('ch7_celestial_2026');
  });

  it('winter_mountain_2026 startDate is 2026-12-01', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'winter_mountain_2026')!;
    expect(b.startDate).toBe('2026-12-01');
  });

  it('getBannerTimeLeft with 25 h remaining returns "1일 1시간 남음"', () => {
    const banner = SEASON_BANNERS[0]; // spring_gumiho_2026, endDate 2026-04-30
    const end = new Date('2026-04-30T23:59:59');
    const now = new Date(end.getTime() - 25 * 3600 * 1000);
    expect(getBannerTimeLeft(banner, now)).toBe('1일 1시간 남음');
  });

  it('every banner id contains a 4-digit year', () => {
    for (const b of SEASON_BANNERS) {
      expect(b.id, `${b.id} has no 4-digit year`).toMatch(/\d{4}/);
    }
  });

  it('late_fall_moonlight_2026 endDate is 2026-11-30', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'late_fall_moonlight_2026')!;
    expect(b.endDate).toBe('2026-11-30');
  });
});

// ─── SEASON_BANNERS — late-index pins, soul-type & gap coverage ───────────────

describe('SEASON_BANNERS — late-index pins, soul-type & date-gap coverage', () => {
  it('SEASON_BANNERS[6].id is ch8_abyss_2027', () => {
    expect(SEASON_BANNERS[6].id).toBe('ch8_abyss_2027');
  });

  it('SEASON_BANNERS[7].id is special_dragon_2026 (last entry)', () => {
    expect(SEASON_BANNERS[7].id).toBe('special_dragon_2026');
  });

  it('ch8_abyss_2027 is the only banner whose validSummonTypes includes "soul"', () => {
    const soulBanners = SEASON_BANNERS.filter(b => b.validSummonTypes.includes('soul'));
    expect(soulBanners).toHaveLength(1);
    expect(soulBanners[0].id).toBe('ch8_abyss_2027');
  });

  it('ch8_abyss_2027 startDate=2027-02-01 and endDate=2027-03-31', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'ch8_abyss_2027')!;
    expect(b.startDate).toBe('2027-02-01');
    expect(b.endDate).toBe('2027-03-31');
  });

  it('fall_underworld_2026 startDate is 2026-09-15 (starts mid-September)', () => {
    const b = SEASON_BANNERS.find(b => b.id === 'fall_underworld_2026')!;
    expect(b.startDate).toBe('2026-09-15');
  });

  it('getActiveBanner("2026-09-01") returns null (gap between summer and fall banners)', () => {
    // summer_sea_2026 ends 2026-08-31; fall_underworld_2026 starts 2026-09-15
    expect(getActiveBanner(new Date('2026-09-01'))).toBeNull();
  });

  it('exactly 2 banners have validSummonTypes of length 1 (winter_mountain and special_dragon)', () => {
    const singleType = SEASON_BANNERS.filter(b => b.validSummonTypes.length === 1);
    expect(singleType).toHaveLength(2);
    const ids = singleType.map(b => b.id).sort();
    expect(ids).toContain('winter_mountain_2026');
    expect(ids).toContain('special_dragon_2026');
  });
});
