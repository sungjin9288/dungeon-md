import { describe, expect, it } from 'vitest';
import {
  buildBattleForecast,
  buildStoryInvasionTarget,
  resolveStoryInvaderType,
  type StoryInvasionTarget,
} from './battleForecast';
import { MAIN_QUESTS, type InvasionConfig } from './quests';
import { simulateDungeon } from './simulation';
import type { StageConfig } from './stages';
import type { DungeonSlot } from './wisdom';

function makeStage(count: number): StageConfig {
  return {
    id: 1,
    chapter: 1,
    koreanName: '예측 시험',
    dungeonHp: 1000,
    startGold: 300,
    waves: [{ wave: 1, invaders: [{ type: 'peasant', count, spawnDelay: 0 }] }],
  };
}

function makeTarget(stage: StageConfig): StoryInvasionTarget {
  return { stage, diagnostics: [] };
}

function makeSlot(monsterIds: (string | undefined)[]): DungeonSlot {
  return { monsterIds, trapIds: [], hp: 200, maxHp: 200, roomLevel: 1 };
}

describe('buildStoryInvasionTarget', () => {
  it('converts every configured MAIN_QUESTS story invasion into a valid StageConfig', () => {
    const invasions = MAIN_QUESTS.flatMap(quest => quest.invasionOnComplete ? [quest.invasionOnComplete] : []);
    expect(invasions).toHaveLength(10);

    for (const invasion of invasions) {
      const target = buildStoryInvasionTarget(invasion);
      expect(target.diagnostics, invasion.id).toEqual([]);
      expect(target.stage, invasion.id).not.toBeNull();
      expect(target.stage!.waves).toHaveLength(invasion.waves.length);
      expect(target.stage!.waves.flatMap(wave => wave.invaders)).not.toHaveLength(0);
    }
  });

  it('resolves story aliases and canonical invader types without UI dependencies', () => {
    expect(resolveStoryInvaderType('peasant_soldier')).toBe('peasant');
    expect(resolveStoryInvaderType('shield_knight')).toBe('knight');
    expect(resolveStoryInvaderType('void_soldier')).toBe('void_soldier');

    const invasion: InvasionConfig = {
      id: 'mixed', name: '혼성', isStoryInvasion: true,
      waves: [{ waveNumber: 1, invaders: [
        { type: 'shadow_thief', count: 2 },
        { type: 'primordial_guard', count: 1 },
      ] }],
    };
    const target = buildStoryInvasionTarget(invasion);
    expect(target.stage?.waves[0].invaders.map(invader => invader.type))
      .toEqual(['shadow_ninja', 'primordial_guard']);
  });

  it('returns deterministic diagnostics rather than a partial target for unknown invaders', () => {
    const invasion: InvasionConfig = {
      id: 'broken', name: '오류 침략', isStoryInvasion: true,
      waves: [{ waveNumber: 3, invaders: [{ type: 'missing_invader', count: 4 }] }],
    };
    const target = buildStoryInvasionTarget(invasion);
    expect(target.stage).toBeNull();
    expect(target.diagnostics).toEqual([{
      kind: 'unknown-invader-type', waveNumber: 3, invaderType: 'missing_invader', count: 4,
    }]);
  });

  it('treats prototype keys as unknown invader types', () => {
    expect(resolveStoryInvaderType('toString')).toBeUndefined();
    const target = buildStoryInvasionTarget({
      id: 'prototype-key', name: '오류 침략', isStoryInvasion: true,
      waves: [{ waveNumber: 1, invaders: [{ type: 'toString', count: 1 }] }],
    });
    expect(target.stage).toBeNull();
    expect(target.diagnostics[0]?.invaderType).toBe('toString');
  });
});

describe('battle forecast', () => {
  it('keeps the built StageConfig instance for the forecast path', () => {
    const invasion = MAIN_QUESTS.find(quest => quest.invasionOnComplete)?.invasionOnComplete!;
    const target = buildStoryInvasionTarget(invasion);
    const forecast = buildBattleForecast(target, [], []);
    expect(forecast.stage).toBe(target.stage);
  });

  it('exposes an incomplete forecast for unknown target data', () => {
    const target = buildStoryInvasionTarget({
      id: 'broken', name: '오류 침략', isStoryInvasion: true,
      waves: [{ waveNumber: 1, invaders: [{ type: 'unknown', count: 1 }] }],
    });
    const forecast = buildBattleForecast(target, [], []);
    expect(forecast.status).toBe('incomplete');
    expect(forecast.simulation).toBeNull();
    expect(forecast.diagnostics).toHaveLength(1);
  });

  it('simulation also reports unknown invaders deterministically', () => {
    const result = simulateDungeon([], [], [{ invaders: [{ type: 'unknown' as never, count: 2, spawnDelay: 0 }] }], 100);
    expect(result.diagnostics).toEqual([{
      kind: 'unknown-invader-type', waveNum: 1, invaderType: 'unknown', count: 2,
    }]);
  });

  it('reaches all four forecast risk bands', () => {
    expect(buildBattleForecast(makeTarget(makeStage(1)), [], []).risk).toBe('secure');
    expect(buildBattleForecast(makeTarget(makeStage(4)), [], []).risk).toBe('guarded');
    expect(buildBattleForecast(makeTarget(makeStage(15)), [], []).risk).toBe('strained');
    expect(buildBattleForecast(makeTarget(makeStage(20)), [], []).risk).toBe('critical');
  });

  it('strengthening the same loadout cannot worsen the deterministic forecast', () => {
    const target = makeTarget(makeStage(20));
    const weak = buildBattleForecast(target, [], []);
    const strong = buildBattleForecast(target, Array.from({ length: 6 }, () => makeSlot(['dokkaebi_warrior'])), []);
    const severity = { secure: 0, guarded: 1, strained: 2, critical: 3 } as const;

    expect(weak.risk).not.toBeNull();
    expect(strong.risk).not.toBeNull();
    expect(severity[strong.risk!]).toBeLessThanOrEqual(severity[weak.risk!]);
    expect(strong.simulation!.finalHp).toBeGreaterThanOrEqual(weak.simulation!.finalHp);
  });

  it('uses heuristic copy with remaining dungeon HP and no probability claim', () => {
    const forecast = buildBattleForecast(makeTarget(makeStage(4)), [], []);
    expect(forecast.heuristicCopy).toContain('결정론적');
    for (const excludedSystem of ['장비', '스킬', '지혜', '장식', '시너지', '방 메커니즘']) {
      expect(forecast.heuristicCopy).toContain(excludedSystem);
    }
    expect(forecast.marginCopy).toContain('남은 던전 HP');
    expect(`${forecast.heuristicCopy} ${forecast.marginCopy}`).not.toMatch(/확률|생존율|정확한 전투/);
  });
});
