import { describe, expect, it, vi } from 'vitest';
import { MONSTER_DEFS } from './monsters';
import type { ElementId, MonsterDef, TribeId } from './monstersTypes';

vi.mock('phaser', () => ({ default: {} }));

import { setMonsterPortraitAlpha, type MonsterPortraitRefs } from '../ui/MonsterPortraitView';
import {
  ELEMENT_VISUAL_IDENTITIES,
  ROLE_VISUAL_IDENTITIES,
  TRIBE_VISUAL_IDENTITIES,
  getElementVisualIdentity,
  getMonsterVisualIdentity,
  getRoleVisualIdentity,
  getTribeVisualIdentity,
} from './monsterVisualIdentity';

const ALL_TRIBES: TribeId[] = [
  'dokkaebi', 'gumiho', 'dragon', 'underworld', 'sansin', 'sea', 'mask',
  'moonlight', 'celestial', 'primordial', 'void',
];
const ALL_ROLES: MonsterDef['type'][] = ['melee', 'ranged', 'magic', 'support'];
const ALL_ELEMENTS: ElementId[] = ['fire', 'frost', 'lightning', 'dark', 'holy'];

describe('monster visual identity registry', () => {
  it('covers every tribe, role, and element with a concrete visual language', () => {
    expect(Object.keys(TRIBE_VISUAL_IDENTITIES).sort()).toEqual([...ALL_TRIBES].sort());
    expect(Object.keys(ROLE_VISUAL_IDENTITIES).sort()).toEqual([...ALL_ROLES].sort());
    expect(Object.keys(ELEMENT_VISUAL_IDENTITIES).sort()).toEqual([...ALL_ELEMENTS].sort());

    [...Object.values(TRIBE_VISUAL_IDENTITIES), ...Object.values(ROLE_VISUAL_IDENTITIES), ...Object.values(ELEMENT_VISUAL_IDENTITIES)]
      .forEach(identity => {
        expect(identity.color).toBeGreaterThan(0);
        expect(identity.glyph).not.toHaveLength(0);
        expect(identity.silhouetteCue).not.toHaveLength(0);
        expect(identity.motif).not.toHaveLength(0);
      });
  });

  it('resolves every current monster definition without a missing visual identity', () => {
    Object.values(MONSTER_DEFS).forEach(def => {
      const identity = getMonsterVisualIdentity(def);
      expect(identity.role).toBe(ROLE_VISUAL_IDENTITIES[def.type]);
      expect(identity.element).toBe(ELEMENT_VISUAL_IDENTITIES[def.element!]);
      expect(identity.tribe).toBe(def.tribe ? TRIBE_VISUAL_IDENTITIES[def.tribe] : getTribeVisualIdentity());
    });
  });

  it('uses stable neutral fallbacks for missing or unknown metadata', () => {
    expect(getTribeVisualIdentity()).toBe(getTribeVisualIdentity('missing'));
    expect(getRoleVisualIdentity()).toBe(getRoleVisualIdentity('missing'));
    expect(getElementVisualIdentity()).toBe(getElementVisualIdentity('missing'));

    const fallback = getMonsterVisualIdentity({ type: 'missing' as MonsterDef['type'] });
    expect(fallback.tribe).toBe(getTribeVisualIdentity());
    expect(fallback.role).toBe(getRoleVisualIdentity());
    expect(fallback.element).toBe(getElementVisualIdentity());
  });

  it.each(['constructor', 'toString', '__proto__'])('%s resolves to the own-property fallback', key => {
    expect(getTribeVisualIdentity(key)).toBe(getTribeVisualIdentity());
    expect(getRoleVisualIdentity(key)).toBe(getRoleVisualIdentity());
    expect(getElementVisualIdentity(key)).toBe(getElementVisualIdentity());
  });

  it('dims every portrait layer, including identity cues, together', () => {
    const frame = { setAlpha: vi.fn() };
    const image = { setAlpha: vi.fn() };
    const fallbackText = { setAlpha: vi.fn() };
    const cueGraphic = { setAlpha: vi.fn() };
    const roleCue = { setAlpha: vi.fn() };
    const elementCue = { setAlpha: vi.fn() };
    const portrait = { frame, image, fallbackText, cueGraphic, roleCue, elementCue } as unknown as MonsterPortraitRefs;

    setMonsterPortraitAlpha(portrait, 0.42);

    [frame, image, fallbackText, cueGraphic, roleCue, elementCue].forEach(target => {
      expect(target.setAlpha).toHaveBeenCalledOnce();
      expect(target.setAlpha).toHaveBeenCalledWith(0.42);
    });
  });
});
