import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
const { resolveBossHudLabel } = await import('./BossHud');

describe('resolveBossHudLabel', () => {
  it('names the boss on the field instead of a fixed dokkaebi-king default', () => {
    expect(resolveBossHudLabel(undefined, '기사')).toBe('기사');
    expect(resolveBossHudLabel(undefined, '여우 여왕 (보스)')).toBe('여우 여왕');
    expect(resolveBossHudLabel(undefined, '신황제 (최종 보스)')).toBe('신황제');
  });

  it('keeps an explicit phase label and falls back to 보스 before a boss is found', () => {
    expect(resolveBossHudLabel('용왕', '용왕 (보스)')).toBe('용왕');
    expect(resolveBossHudLabel(undefined, undefined)).toBe('보스');
    expect(resolveBossHudLabel(undefined, '  ')).toBe('보스');
  });
});
