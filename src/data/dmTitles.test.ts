import { describe, expect, it } from 'vitest';
import { MAIN_QUESTS } from './questData';
import { DM_TITLE_MAP, questUnlockLabel } from './dmTitles';

// Quest popups listed every unlock id raw ("해금 summon_altar"), but only DM
// titles do anything: the other ids are recorded and never read. Only unlocks
// with an effect are shown, by name.
describe('quest unlock labels', () => {
  it('names DM title unlocks', () => {
    expect(questUnlockLabel('abyss_title')).toBe(`칭호 · ${DM_TITLE_MAP.abyss_title.label}`);
    expect(questUnlockLabel('heaven_title')).toBe(`칭호 · ${DM_TITLE_MAP.heaven_title.label}`);
  });
  it('hides unlocks that nothing reads', () => {
    expect(['summon_altar', 'research_lab', 'affinity_system', 'primordial_skin'].map(questUnlockLabel))
      .toEqual([null, null, null, null]);
  });
  it('never shows a raw id for any quest unlock', () => {
    for (const quest of MAIN_QUESTS) {
      for (const id of quest.reward.unlocks ?? []) {
        const label = questUnlockLabel(id);
        if (label !== null) expect(label).not.toContain(id);
      }
    }
  });
});
