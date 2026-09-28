import type Phaser from 'phaser';
import { saveGameState, type GameState } from '../data/wisdom';

interface StateOwner { persistGameState(next: GameState): void }

/**
 * Save a change made by a panel hosted on `scene`. Home keeps its own GameState
 * copy (`persistGameState` saves and adopts it); writing storage behind its back
 * let Home's next save restore the pre-change copy — a claimed reward vanished
 * and could be claimed again. Scenes without an owned copy write storage.
 */
export function commitSceneState(scene: Phaser.Scene, next: GameState): void {
  const owner = scene as unknown as Partial<StateOwner>;
  if (typeof owner.persistGameState === 'function') owner.persistGameState(next);
  else saveGameState(next);
}
