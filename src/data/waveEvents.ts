/**
 * Random wave events — injected between waves for variety.
 * Deterministic seeded selection ensures same result on replay.
 */

export type WaveEventType =
  | 'merchant' | 'supply' | 'curse' | 'rally' | 'fog'
  | 'void_storm' | 'ancient_blessing' | 'crimson_curse';

export interface WaveEventDef {
  type:        WaveEventType;
  name:        string;
  icon:        string;
  description: string;
  color:       string;   // CSS color for the card accent
}

export const WAVE_EVENTS: WaveEventDef[] = [
  {
    type: 'merchant',
    name: '방랑 상인',
    icon: '🏪',
    description: '이번 웨이브 보상 골드 ×1.5',
    color: '#ffcc44',
  },
  {
    type: 'supply',
    name: '보급품 도착',
    icon: '📦',
    description: '던전 HP 15% 회복',
    color: '#44cc88',
  },
  {
    type: 'curse',
    name: '저주받은 침략',
    icon: '💀',
    description: '침략자 HP +30% · 보상 ×2',
    color: '#cc44cc',
  },
  {
    type: 'rally',
    name: '몬스터 격려',
    icon: '📯',
    description: '모든 몬스터 ATK +25%',
    color: '#ff8844',
  },
  {
    type: 'fog',
    name: '짙은 안개',
    icon: '🌫️',
    description: '침략자 속도 -15%',
    color: '#8899bb',
  },
  // ── New variety events ──────────────────────────────────────────────────
  {
    type: 'void_storm',
    name: '허공의 폭풍',
    icon: '🌀',
    description: '침략자 속도 +25% · 보상 골드 ×1.8',
    color: '#7744dd',
  },
  {
    type: 'ancient_blessing',
    name: '고대의 축복',
    icon: '✨',
    description: '모든 몬스터 ATK +20% · 던전 HP 10% 회복',
    color: '#44bbff',
  },
  {
    type: 'crimson_curse',
    name: '붉은 저주',
    icon: '🩸',
    description: '침략자 HP +50% · 보상 ×3',
    color: '#dd2244',
  },
];

/** Simple seeded hash for deterministic event selection. */
function seededHash(a: number, b: number): number {
  let h = (a * 7919 + b * 31) & 0x7fffffff;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  return ((h >> 16) ^ h) & 0x7fffffff;
}

/**
 * Check if a random event triggers for the given wave.
 * Returns the event definition or null.
 *
 * Rules:
 * - Wave must be ≥ 2
 * - Not a boss wave (wave === maxWave)
 * - 30% chance per eligible wave
 */
export function rollWaveEvent(
  wave: number,
  maxWave: number,
  stageId: number,
): WaveEventDef | null {
  if (wave < 2) return null;
  if (wave === maxWave) return null;   // boss wave — no event

  const hash = seededHash(wave, stageId);
  // 30% trigger chance
  if ((hash % 100) >= 30) return null;

  // Pick event from pool
  const idx = hash % WAVE_EVENTS.length;
  return WAVE_EVENTS[idx];
}
