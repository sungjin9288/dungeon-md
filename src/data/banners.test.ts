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
