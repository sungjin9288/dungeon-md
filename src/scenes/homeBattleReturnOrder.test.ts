import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DungeonHomeScene } from './DungeonHomeScene';
import { checkBattleReturn, presentBattleReturnWin, settlePendingQuestCompletion } from './HomeLifecycle';
import { loadGameState, saveGameState } from '../data/wisdom';
import { showBattleReturnOverlay, showDmLevelUpOverlay } from '../ui/HomeOverlays';
import { showQuestCompleteOverlay } from '../ui/QuestLogPanel';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock('../ui/HomeOverlays', () => ({
  showBattleReturnOverlay: vi.fn(), showDmLevelUpOverlay: vi.fn(), showBattleDefeatOverlay: vi.fn(),
}));
vi.mock('../ui/QuestLogPanel', () => ({ showQuestCompleteOverlay: vi.fn(), showGameCompleteOverlay: vi.fn() }));
vi.mock('../ui/InvasionUI', async importOriginal => ({
  ...(await importOriginal<typeof import('../ui/InvasionUI')>()), checkForInvasion: vi.fn(),
}));

// A won story invasion completes MQ-003. Home create() runs initQuests right
// after the battle return, which used to settle the quest at once: its popup
// sat above the victory summary and its Home restart discarded the summary.
function scene() {
  const s = new DungeonHomeScene();
  s.gs = loadGameState();
  Object.assign(s, {
    time: { delayedCall: (_ms: number, cb: () => void) => cb() },
    scene: { isActive: () => true },
    registry: { set: vi.fn(), get: vi.fn(), remove: vi.fn() },
    refreshCurrencyTexts: vi.fn(),
  });
  return s;
}
const growth = { previousDmLevel: 2, nextDmLevel: 2, previousSlots: 4, nextSlots: 4, questCompletionPending: true };
const result = { won: true, goldEarned: 30, dmXP: 150 };

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  saveGameState({
    ...loadGameState(), tutorialStage: 99, activeMainQuestId: 'MQ-003',
    questProgress: { 'MQ-003': { objectives: { O1: 1 }, completed: false } },
  });
});

describe('Home battle return order', () => {
  it('holds the quest popup while the victory summary is presenting', () => {
    const s = scene();
    s.battleReturnPresenting = true;
    expect(settlePendingQuestCompletion(s)).toBe(false);
    expect(loadGameState().activeMainQuestId).toBe('MQ-003');
    expect(showQuestCompleteOverlay).not.toHaveBeenCalled();
  });

  it('shows summary first, then the quest popup once it is dismissed', () => {
    const s = scene();
    s.battleReturnPresenting = true;
    presentBattleReturnWin(s, result, growth, false);
    settlePendingQuestCompletion(s); // create() → initQuests runs before any tap
    expect(showBattleReturnOverlay).toHaveBeenCalledTimes(1);
    expect(showQuestCompleteOverlay).not.toHaveBeenCalled();
    vi.mocked(showBattleReturnOverlay).mock.calls[0][2]();
    expect(showQuestCompleteOverlay).toHaveBeenCalledTimes(1);
    expect(s.battleReturnPresenting).toBe(false);
  });

  it('puts a DM level-up between the summary and the quest popup', () => {
    const s = scene();
    s.battleReturnPresenting = true;
    presentBattleReturnWin(s, result, { ...growth, nextDmLevel: 3 }, true);
    settlePendingQuestCompletion(s);
    vi.mocked(showBattleReturnOverlay).mock.calls[0][2]();
    expect(showDmLevelUpOverlay).toHaveBeenCalledTimes(1);
    expect(showQuestCompleteOverlay).not.toHaveBeenCalled();
    vi.mocked(showDmLevelUpOverlay).mock.calls[0][2]?.onDismiss?.();
    expect(showQuestCompleteOverlay).toHaveBeenCalledTimes(1);
  });
});

// Phase 2c moved Home's battle hand-off onto the navigation contract, whose
// 'battle-result' entry consumed only `returnTo`. `battleResult` survived, so
// every later Home create (quest popup restart, back from 군단/공방) paid the
// same win again: gold, DM XP and the victory summary.
describe('Home battle return settles once', () => {
  it('drops the hand-off so a second Home entry does not pay it again', () => {
    const registry = new Map<string, unknown>([['battleResult', { won: true, goldEarned: 30, dmXP: 150 }], ['returnTo', 'DungeonHomeScene']]);
    const s = scene();
    Object.assign(s, {
      registry: { get: (k: string) => registry.get(k), set: (k: string, v: unknown) => registry.set(k, v), remove: (k: string) => registry.delete(k) },
      currencyTexts: [], refreshHomeDynamicPanels: vi.fn(),
    });
    const before = loadGameState();
    checkBattleReturn(s);
    const once = loadGameState();
    expect(once.homeGold).toBe(before.homeGold + 30);
    s.gs = loadGameState();
    checkBattleReturn(s);
    expect(loadGameState().homeGold).toBe(once.homeGold);
    expect(loadGameState().dmXP).toBe(once.dmXP);
    expect(showBattleReturnOverlay).toHaveBeenCalledTimes(1);
  });
});
