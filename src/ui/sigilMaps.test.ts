import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
const { SIGIL_KINDS } = await import('./Sigils');
const { ACHIEVEMENT_CATEGORY_SIGILS, ACTIVE_SKILL_SIGILS, DECORATION_SET_SIGILS, DECORATION_SIGILS, EMOJI_SIGILS, ENDLESS_MODIFIER_SIGILS, EQUIPMENT_TYPE_SIGILS, MATERIAL_SIGILS, THEME_SIGILS, ROOM_TYPE_SIGILS, WAVE_EVENT_SIGILS, WISDOM_SIGILS } = await import('./sigilMaps');
const { ENDLESS_MODIFIERS } = await import('../data/endlessModifiers');
const { WAVE_EVENTS } = await import('../data/waveEvents');
const { ALL_THEMES } = await import('../themes/themes');
const { EQUIPMENT_DEFS } = await import('../data/barracks');
const { BRANCH_DEFS, ROOM_SLOT_TYPE_DEFS } = await import('../data/wisdom');
const { DECORATION_DEFS, SET_DEFS } = await import('../data/decorations');
const { MATERIAL_DEFS } = await import('../data/fusion');
const { ACTIVE_SKILLS } = await import('../data/barracks');
const { ACHIEVEMENT_DEFS } = await import('../data/achievementData');

// Emoji icons were replaced by line sigils on the meta screens (§37): every
// id those screens draw must map to a real glyph, or it silently falls back.
describe('sigil coverage', () => {
  const known = new Set(SIGIL_KINDS);

  it('maps every wisdom branch', () => {
    for (const b of BRANCH_DEFS) expect(known.has(WISDOM_SIGILS[b.id]), b.id).toBe(true);
  });

  it('maps every decoration and decoration set', () => {
    for (const id of Object.keys(DECORATION_DEFS)) expect(known.has(DECORATION_SIGILS[id]), id).toBe(true);
    for (const id of Object.keys(SET_DEFS)) expect(known.has(DECORATION_SET_SIGILS[id]), id).toBe(true);
  });

  it('maps every achievement category in use', () => {
    for (const a of ACHIEVEMENT_DEFS) expect(known.has(ACHIEVEMENT_CATEGORY_SIGILS[a.category]), a.id).toBe(true);
  });

  it('maps every room family', () => {
    for (const def of ROOM_SLOT_TYPE_DEFS) expect(known.has(ROOM_TYPE_SIGILS[def.id]), def.id).toBe(true);
  });

  it('maps every endless modifier and wave event', () => {
    for (const m of ENDLESS_MODIFIERS) expect(known.has(ENDLESS_MODIFIER_SIGILS[m.id]), m.id).toBe(true);
    for (const e of WAVE_EVENTS) expect(known.has(WAVE_EVENT_SIGILS[e.type]), e.type).toBe(true);
  });

  it('maps every theme and equipment type', () => {
    for (const t of ALL_THEMES) expect(known.has(THEME_SIGILS[t.id]?.kind), t.id).toBe(true);
    for (const e of EQUIPMENT_DEFS) expect(known.has(EQUIPMENT_TYPE_SIGILS[e.type]), e.id).toBe(true);
  });

  it('maps every material', () => {
    for (const id of Object.keys(MATERIAL_DEFS)) expect(known.has(MATERIAL_SIGILS[id]?.kind), id).toBe(true);
  });

  it('maps every active skill and every emoji alias to a real glyph', () => {
    for (const skill of ACTIVE_SKILLS) expect(known.has(ACTIVE_SKILL_SIGILS[skill.id]?.kind), skill.id).toBe(true);
    for (const [emoji, sigil] of Object.entries(EMOJI_SIGILS)) expect(known.has(sigil.kind), emoji).toBe(true);
  });
});
