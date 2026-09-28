import { describe, expect, it, vi } from 'vitest';
import { loadGameState, saveGameState } from '../data/wisdom';

vi.mock('phaser', () => ({ default: {} }));
const { commitQuestLogState } = await import('./QuestLogPanel');

// The quest log saved sub-quest claims straight to storage while Home kept its
// own copy; the next Home action saved that copy back, erasing the reward and
// reopening the claim (repeatable). The log commits through Home when it can.
describe('quest log commits', () => {
  it('goes through the owner so its in-memory state follows', () => {
    const persist = vi.fn();
    const next = { ...loadGameState(), homeGold: 1123 };
    commitQuestLogState({ questLogOpen: true, persist }, next);
    expect(persist).toHaveBeenCalledWith(next);
  });
  it('falls back to storage without an owner', () => {
    localStorage.clear();
    saveGameState({ ...loadGameState(), homeGold: 1 });
    commitQuestLogState({ questLogOpen: true }, { ...loadGameState(), homeGold: 77 });
    expect(loadGameState().homeGold).toBe(77);
  });
});
