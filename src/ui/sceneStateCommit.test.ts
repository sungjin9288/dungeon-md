import { describe, expect, it, vi } from 'vitest';
import { loadGameState, saveGameState } from '../data/wisdom';
import { commitSceneState } from './sceneStateCommit';

// Panels opened over Home (attendance, daily challenges, quest log) wrote
// storage directly while Home kept its own copy; Home's next save wrote that
// copy back and erased the claim. A panel commits through its owner when it can.
describe('commitSceneState', () => {
  it('uses the owning scene save so its in-memory state follows', () => {
    const persistGameState = vi.fn();
    const next = { ...loadGameState(), gems: 42 };
    commitSceneState({ persistGameState } as never, next);
    expect(persistGameState).toHaveBeenCalledWith(next);
  });
  it('writes storage for scenes without an owned copy', () => {
    localStorage.clear();
    saveGameState({ ...loadGameState(), gems: 1 });
    commitSceneState({} as never, { ...loadGameState(), gems: 9 });
    expect(loadGameState().gems).toBe(9);
  });
});
