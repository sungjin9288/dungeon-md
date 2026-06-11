import { describe, expect, it } from 'vitest';
import { getReadinessDirectiveCopy } from './readinessDirectives';

describe('readinessDirectives', () => {
  it('builds room-specific forge guidance with readiness context', () => {
    const copy = getReadinessDirectiveCopy('forge-equipment', {
      roomLabel: '방 #2',
      readiness: 42,
    });

    expect(copy.title).toBe('장비 제작 보강');
    expect(copy.body).toContain('방 #2 준비도 42%');
    expect(copy.ctaLabel).toBe('제작 이동');
    expect(copy.chip).toBe('보강');
    expect(copy.severity).toBe('warning');
  });

  it('uses the same battle-ready language for stable defense states', () => {
    const copy = getReadinessDirectiveCopy('battle-ready', {
      currentPower: 160,
      requiredPower: 120,
    });

    expect(copy.title).toBe('침공 대응 준비');
    expect(copy.body).toContain('권장 DEF 120 / 현재 DEF 160');
    expect(copy.ctaLabel).toBe('전투 준비');
    expect(copy.chip).toBe('준비');
    expect(copy.severity).toBe('ready');
  });

  it('can describe an empty dungeon using unlocked slot count', () => {
    const copy = getReadinessDirectiveCopy('room-design', { unlockedSlots: 3 });

    expect(copy.title).toBe('새 방 설계');
    expect(copy.body).toContain('해금 슬롯 3개');
    expect(copy.ctaLabel).toBe('던전 정비');
    expect(copy.severity).toBe('danger');
  });

  it('builds combat power risk guidance from DEF pressure', () => {
    const copy = getReadinessDirectiveCopy('power-risk', {
      currentPower: 80,
      requiredPower: 140,
    });

    expect(copy.title).toBe('장비 제작 보강');
    expect(copy.body).toContain('권장 DEF 140 / 현재 DEF 80');
    expect(copy.chip).toBe('위험');
    expect(copy.severity).toBe('danger');
  });
});
