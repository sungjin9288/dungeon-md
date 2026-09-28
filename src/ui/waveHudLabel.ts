/**
 * Battle HUD wave label. Pure so the result-screen state is testable.
 *
 * `battleOutcome` is the registry key `WaveLifecycle` sets to 'clear' when the
 * final wave falls; the HUD stays visible under the result panel, and without
 * it the label kept shouting "⚠ 최종 침략!" over a won battle (§28 P2).
 */
export type BattleOutcome = 'clear' | null;

export const ENDLESS_MAX_WAVE = 9999;

export interface WaveHudLabel {
  readonly text: string;
  readonly tone: 'normal' | 'final' | 'clear';
}

export function getWaveHudLabel(wave: number, maxWave: number, outcome: BattleOutcome = null): WaveHudLabel {
  if (maxWave >= ENDLESS_MAX_WAVE) {
    return { text: wave > 0 ? `침략 ${wave}` : '침략 대기', tone: 'normal' };
  }
  if (outcome === 'clear') return { text: '✓ 침략 격퇴', tone: 'clear' };
  if (wave > 0 && wave === maxWave) return { text: '⚠ 최종 침략!', tone: 'final' };
  return { text: `침략 ${wave}/${maxWave}`, tone: 'normal' };
}
