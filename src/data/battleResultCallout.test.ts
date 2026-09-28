import { describe, expect, it } from 'vitest';
import {
  projectBattleResultCallout,
  type BattleResultCalloutInput,
  type BattleResultCalloutSlot,
} from './battleResultCallout';
import { getReadinessDirectiveCopy } from './readinessDirectives';

function slot(
  roomType: string,
  hp: number,
  maxHp = 100,
): BattleResultCalloutSlot {
  return { roomType, hp, maxHp };
}

function project(
  outcome: boolean,
  slots: ReadonlyArray<BattleResultCalloutSlot | null | undefined>,
  recentStartHps?: ReadonlyArray<number | null | undefined>,
) {
  return projectBattleResultCallout({ outcome, slots, recentStartHps });
}

describe('battleResultCallout projector', () => {
  it('prioritizes destroyed rooms and uses the canonical room-repair copy', () => {
    const callout = project(true, [
      slot('combat', 40),
      slot('trap', 0),
      slot('support', 20),
    ], [100, 1, 100]);
    const copy = getReadinessDirectiveCopy('room-repair', { roomLabel: '방 #2' });

    expect(callout).toMatchObject({
      state: 'destroyed',
      directiveKind: 'room-repair',
      slotIdx: 1,
      roomLabel: '방 #2',
      roleLabel: '함정실',
      icon: copy.icon,
      title: copy.title,
      body: copy.body,
      chip: copy.chip,
      statLabel: copy.statLabel,
      accent: copy.accent,
      severity: copy.severity,
      statValue: '0/100 HP',
    });
  });

  it('orders partial damage by recent relative loss but displays current durability', () => {
    const callout = project(true, [
      slot('combat', 60, 100),
      slot('magic', 80, 200),
    ], [100, 200]);

    expect(callout).toMatchObject({
      state: 'damaged',
      directiveKind: 'battle-recovery',
      slotIdx: 1,
      roleLabel: '마법진',
      statValue: '80/200 HP',
    });
    expect(callout?.body).toContain('80/200');
    expect(callout?.body).not.toContain('40% 피해');
  });

  it('uses current HP ratio when a failed battle has no recent-loss evidence', () => {
    const callout = project(false, [
      slot('combat', 80),
      slot('support', 25),
    ]);

    expect(callout).toMatchObject({
      state: 'damaged',
      directiveKind: 'battle-recovery',
      slotIdx: 1,
      roomLabel: '방 #2',
      roleLabel: '지원실',
      statValue: '25/100 HP',
    });
  });

  it('uses canonical battle-ready copy for an undamaged win with overall identity', () => {
    const callout = project(true, [slot('magic', 120, 120)]);
    const copy = getReadinessDirectiveCopy('battle-ready', {});

    expect(callout).toMatchObject({
      state: 'ready',
      directiveKind: 'battle-ready',
      slotIdx: null,
      roomLabel: null,
      roleLabel: null,
      icon: copy.icon,
      title: copy.title,
      body: copy.body,
      chip: copy.chip,
      statLabel: copy.statLabel,
      accent: copy.accent,
      severity: copy.severity,
      statValue: '완료',
    });
  });

  it('uses overall battle-recovery review when a failed battle keeps all rooms full', () => {
    const callout = project(false, [slot('combat', 100), slot('magic', 200, 200)]);

    expect(callout).toMatchObject({
      state: 'damaged',
      directiveKind: 'battle-recovery',
      slotIdx: null,
      roomLabel: null,
      roleLabel: null,
      statValue: '편성 점검',
    });
    expect(callout?.body).toContain('내구도는 유지');
    expect(callout?.body).toContain('배치와 성장');
    expect(callout?.body).not.toContain('수리');
  });

  it('ignores null, invalid, impossible, and unknown-role slots', () => {
    const input: BattleResultCalloutInput = {
      outcome: true,
      slots: [
        null,
        { roomType: 'unknown', hp: 0, maxHp: 100 },
        { roomType: 'combat', hp: 0, maxHp: 0 },
        { roomType: 'support', hp: 120, maxHp: 100 },
        { roomType: 'trap', hp: 70, maxHp: 100 },
        { roomType: 'magic', hp: -1, maxHp: 100 },
      ],
    };

    expect(projectBattleResultCallout(input)).toMatchObject({
      slotIdx: 4,
      roomLabel: '방 #5',
      roleLabel: '함정실',
    });
  });

  it('breaks equal recent-loss and HP-ratio ties by slot index', () => {
    const callout = project(true, [
      slot('combat', 50),
      slot('trap', 50),
      slot('support', 50),
    ], [100, 100, 100]);

    expect(callout?.slotIdx).toBe(0);
  });

  it('does not mutate slots or recent evidence and keeps a closed output shape', () => {
    const slots = Object.freeze([
      Object.freeze(slot('combat', 60)),
      Object.freeze(slot('trap', 40)),
    ]);
    const recentStartHps = Object.freeze([100, 100]);
    const before = JSON.stringify({ slots, recentStartHps });

    const callout = project(true, slots, recentStartHps);

    expect(JSON.stringify({ slots, recentStartHps })).toBe(before);
    expect(Object.keys(callout ?? {})).toEqual([
      'state', 'directiveKind', 'slotIdx', 'roomLabel', 'roleLabel',
      'icon', 'title', 'body', 'chip', 'statLabel', 'statValue',
      'accent', 'severity',
    ]);
  });

  it('returns no callout when every slot is absent or invalid', () => {
    expect(projectBattleResultCallout({
      outcome: true,
      slots: [null, { roomType: 'combat', hp: Number.NaN, maxHp: 100 }],
    })).toBeNull();
  });
});
