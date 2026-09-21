/**
 * The forge shows what crafting actually gives you.
 *
 * `BlueprintDef` used to carry its own `stats` / `statDesc`, rendered in the
 * forge while combat read `EQUIPMENT_STATS[resultId]` — two tables in disjoint
 * key namespaces (atkBonus / roomHPBonus / skillCDReduction against atkMult /
 * roomHpBonus / skillCdMult) that nothing kept in step. 19 of 24 blueprints
 * displayed something other than what they delivered: 구미호 로브 advertised
 * its only effect as 쿨타임 -20% and gave 방 HP +120 · 발동 +3%, and 신성 방패
 * promised 피해 -25% · 천상 ATK +20% — neither of which exists as an equipment
 * field at all.
 *
 * The advertising namespace is deleted. These hold the remaining single source
 * honest: every blueprint's display is its equipment's, every equipment key has
 * a label, and no raw key can leak into the UI.
 */
import { describe, expect, it } from 'vitest';
import { BLUEPRINT_DEFS } from '../data/fusion';
import { EQUIPMENT_STATS, getEquipmentStats } from '../data/barracks';
import { summarizeBlueprintEffects, summarizeStatEffects } from './ForgeShared';

const BLUEPRINTS = Object.values(BLUEPRINT_DEFS);

describe('forge display is the equipment, not a parallel table', () => {
  it('every blueprint resolves to real equipment', () => {
    expect(BLUEPRINTS.length).toBeGreaterThan(0);
    for (const bp of BLUEPRINTS) {
      expect(EQUIPMENT_STATS[bp.resultId], `${bp.id} → ${bp.resultId}`).toBeDefined();
    }
  });

  it('what is shown equals what is delivered', () => {
    for (const bp of BLUEPRINTS) {
      const shown = summarizeBlueprintEffects(bp);
      const delivered = summarizeStatEffects(getEquipmentStats(bp.resultId) as Record<string, number>, '기본 장비');
      expect(shown, `${bp.name} (${bp.resultId})`).toEqual(delivered);
    }
  });

  it('no equipment key leaks into the UI as a raw identifier', () => {
    // A key with no label case falls through as `magicBoost +1` / `goldMult +0.2`,
    // which is how those two shipped.
    for (const [equipId, stats] of Object.entries(EQUIPMENT_STATS)) {
      for (const label of summarizeStatEffects(stats as Record<string, number>, '기본 장비')) {
        for (const key of Object.keys(stats)) {
          expect(label.includes(key), `${equipId}: "${label}" leaks the raw key "${key}"`).toBe(false);
        }
      }
    }
  });

  it('a blueprint advertises at least one effect', () => {
    for (const bp of BLUEPRINTS) {
      expect(summarizeBlueprintEffects(bp).length, `${bp.name}`).toBeGreaterThan(0);
    }
  });
});
