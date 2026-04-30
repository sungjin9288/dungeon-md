import { describe, it, expect } from 'vitest';
import { MAIN_QUESTS, SUB_QUEST_POOL, getSubQuestById } from './quests';
import type { ObjectiveType } from './questData';

const VALID_OBJECTIVE_TYPES = new Set<ObjectiveType>([
  'build_room', 'assign_monster', 'defend_invasion',
  'reach_dm_level', 'summon', 'upgrade_room',
  'feed_monster', 'fuse_monsters', 'collect_gold', 'complete_stage',
]);

// ─── MAIN_QUESTS — total count ────────────────────────────────────────────────

describe('MAIN_QUESTS — total count', () => {
  it('contains exactly 49 quests (MQ-001 to MQ-044 + EQ-001 to EQ-005)', () => {
    expect(MAIN_QUESTS).toHaveLength(49);
  });

  it('first quest is MQ-001', () => {
    expect(MAIN_QUESTS[0].id).toBe('MQ-001');
  });

  it('last quest is EQ-005 (terminal)', () => {
    expect(MAIN_QUESTS[MAIN_QUESTS.length - 1].id).toBe('EQ-005');
  });
});

// ─── MAIN_QUESTS — field integrity ───────────────────────────────────────────

describe('MAIN_QUESTS — field integrity', () => {
  it('every quest has a non-empty title', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.title.length, `${q.id} title`).toBeGreaterThan(0);
    }
  });

  it('every quest has a non-empty description', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.description.length, `${q.id} description`).toBeGreaterThan(0);
    }
  });

  it('every quest has a non-empty npcSpeaker and npcEmoji', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.npcSpeaker.length, `${q.id} npcSpeaker`).toBeGreaterThan(0);
      expect(q.npcEmoji.length,   `${q.id} npcEmoji`).toBeGreaterThan(0);
    }
  });

  it('every quest has autoTrigger = true', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.autoTrigger, `${q.id} autoTrigger`).toBe(true);
    }
  });

  it('every chapter value is between 1 and 8', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.chapter, `${q.id} chapter`).toBeGreaterThanOrEqual(1);
      expect(q.chapter, `${q.id} chapter`).toBeLessThanOrEqual(8);
    }
  });

  it('every quest has at least one objective', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.objectives.length, `${q.id} objectives`).toBeGreaterThan(0);
    }
  });

  it('every objective has a valid ObjectiveType', () => {
    for (const q of MAIN_QUESTS) {
      for (const obj of q.objectives) {
        expect(
          VALID_OBJECTIVE_TYPES.has(obj.type as ObjectiveType),
          `${q.id} objective "${obj.id}" type "${obj.type}"`,
        ).toBe(true);
      }
    }
  });

  it('every objective target is a positive integer', () => {
    for (const q of MAIN_QUESTS) {
      for (const obj of q.objectives) {
        expect(obj.target, `${q.id}.${obj.id} target`).toBeGreaterThan(0);
        expect(Number.isInteger(obj.target), `${q.id}.${obj.id} target integer`).toBe(true);
      }
    }
  });

  it('every objective current template is 0', () => {
    for (const q of MAIN_QUESTS) {
      for (const obj of q.objectives) {
        expect(obj.current, `${q.id}.${obj.id} current`).toBe(0);
      }
    }
  });

  it('every objective has a non-empty description', () => {
    for (const q of MAIN_QUESTS) {
      for (const obj of q.objectives) {
        expect(obj.description.length, `${q.id}.${obj.id} desc`).toBeGreaterThan(0);
      }
    }
  });

  it('every reward has a non-negative dmXP', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.reward.dmXP, `${q.id} dmXP`).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── MAIN_QUESTS — chain ordering ─────────────────────────────────────────────

describe('MAIN_QUESTS — chain ordering', () => {
  const idSet = new Set(MAIN_QUESTS.map(q => q.id));

  it('only EQ-005 (last quest) has nextQuestId = null', () => {
    const terminals = MAIN_QUESTS.filter(q => q.nextQuestId === null);
    expect(terminals).toHaveLength(1);
    expect(terminals[0].id).toBe('EQ-005');
  });

  it('every non-null nextQuestId references an existing quest', () => {
    for (const q of MAIN_QUESTS) {
      if (q.nextQuestId !== null) {
        expect(idSet.has(q.nextQuestId), `${q.id} → "${q.nextQuestId}" not found`).toBe(true);
      }
    }
  });

  it('MQ-044 links to EQ-001 (chapter 8 → epilogue transition)', () => {
    const mq044 = MAIN_QUESTS.find(q => q.id === 'MQ-044');
    expect(mq044).toBeDefined();
    expect(mq044!.nextQuestId).toBe('EQ-001');
  });

  it('chapters are non-decreasing across the quest chain (no going back)', () => {
    for (let i = 1; i < MAIN_QUESTS.length; i++) {
      expect(
        MAIN_QUESTS[i].chapter,
        `${MAIN_QUESTS[i].id} chapter should be >= ${MAIN_QUESTS[i - 1].chapter}`,
      ).toBeGreaterThanOrEqual(MAIN_QUESTS[i - 1].chapter);
    }
  });
});

// ─── InvasionConfig integrity ─────────────────────────────────────────────────

describe('InvasionConfig integrity', () => {
  const invasionQuests = MAIN_QUESTS.filter(q => q.invasionOnComplete != null);

  it('exactly 10 quests carry an invasionOnComplete', () => {
    expect(invasionQuests).toHaveLength(10);
  });

  it('every invasion has a non-empty id and name', () => {
    for (const q of invasionQuests) {
      const inv = q.invasionOnComplete!;
      expect(inv.id.length,   `${q.id} invasion id`).toBeGreaterThan(0);
      expect(inv.name.length, `${q.id} invasion name`).toBeGreaterThan(0);
    }
  });

  it('every invasion has isStoryInvasion = true', () => {
    for (const q of invasionQuests) {
      expect(q.invasionOnComplete!.isStoryInvasion, `${q.id} isStoryInvasion`).toBe(true);
    }
  });

  it('every invasion has at least one wave', () => {
    for (const q of invasionQuests) {
      expect(q.invasionOnComplete!.waves.length, `${q.id} waves`).toBeGreaterThan(0);
    }
  });

  it('every wave has a positive waveNumber', () => {
    for (const q of invasionQuests) {
      for (const wave of q.invasionOnComplete!.waves) {
        expect(wave.waveNumber, `${q.id} waveNumber`).toBeGreaterThan(0);
      }
    }
  });

  it('every wave has at least one invader group', () => {
    for (const q of invasionQuests) {
      for (const wave of q.invasionOnComplete!.waves) {
        expect(wave.invaders.length, `${q.id} wave ${wave.waveNumber} invaders`).toBeGreaterThan(0);
      }
    }
  });

  it('every invader group count is positive', () => {
    for (const q of invasionQuests) {
      for (const wave of q.invasionOnComplete!.waves) {
        for (const entry of wave.invaders) {
          expect(entry.count, `${q.id} invader count`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every invader type is a non-empty string', () => {
    // Invasion types may include story-only types (e.g. peasant_soldier, shield_knight)
    // not present in INVADER_DEFS — we verify they are at least non-empty strings.
    for (const q of invasionQuests) {
      for (const wave of q.invasionOnComplete!.waves) {
        for (const entry of wave.invaders) {
          expect(entry.type.length, `${q.id} empty invasion type`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every invasion id is a non-empty string', () => {
    // Some invasions intentionally reuse ids — only non-emptiness is guaranteed.
    for (const q of invasionQuests) {
      expect(q.invasionOnComplete!.id.length, `${q.id} invasion id`).toBeGreaterThan(0);
    }
  });
});

// ─── SUB_QUEST_POOL ───────────────────────────────────────────────────────────

describe('SUB_QUEST_POOL', () => {
  it('contains exactly 36 sub-quests', () => {
    expect(SUB_QUEST_POOL).toHaveLength(36);
  });

  it('every sub-quest id is unique', () => {
    const ids = SUB_QUEST_POOL.map(sq => sq.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every sub-quest has a non-empty icon and title', () => {
    for (const sq of SUB_QUEST_POOL) {
      expect(sq.icon.length,  `${sq.id} icon`).toBeGreaterThan(0);
      expect(sq.title.length, `${sq.id} title`).toBeGreaterThan(0);
    }
  });

  it('every sub-quest objective has a valid ObjectiveType', () => {
    for (const sq of SUB_QUEST_POOL) {
      expect(
        VALID_OBJECTIVE_TYPES.has(sq.objective.type as ObjectiveType),
        `${sq.id} type "${sq.objective.type}"`,
      ).toBe(true);
    }
  });

  it('every sub-quest objective target is a positive integer', () => {
    for (const sq of SUB_QUEST_POOL) {
      expect(sq.objective.target, `${sq.id} target`).toBeGreaterThan(0);
      expect(Number.isInteger(sq.objective.target), `${sq.id} target integer`).toBe(true);
    }
  });

  it('every reward has at least dmXP or gold defined', () => {
    for (const sq of SUB_QUEST_POOL) {
      const hasReward = (sq.reward.dmXP ?? 0) > 0 || (sq.reward.gold ?? 0) > 0;
      expect(hasReward, `${sq.id} has no reward`).toBe(true);
    }
  });
});

// ─── getSubQuestById ──────────────────────────────────────────────────────────

describe('getSubQuestById', () => {
  it('returns the correct sub-quest for a known id', () => {
    const sq = getSubQuestById('SQ-001');
    expect(sq).toBeDefined();
    expect(sq!.id).toBe('SQ-001');
  });

  it('returns undefined for an unknown id', () => {
    expect(getSubQuestById('SQ-999')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getSubQuestById('')).toBeUndefined();
  });

  it('finds every id in SUB_QUEST_POOL', () => {
    for (const sq of SUB_QUEST_POOL) {
      expect(getSubQuestById(sq.id), `missing ${sq.id}`).toBeDefined();
    }
  });
});

// ─── MAIN_QUESTS — per-chapter counts ────────────────────────────────────────

describe('MAIN_QUESTS — per-chapter counts', () => {
  const byChapter = (ch: number) => MAIN_QUESTS.filter(q => q.chapter === ch);

  it('Ch1 has exactly 10 quests (MQ-001 to MQ-010)', () => {
    expect(byChapter(1)).toHaveLength(10);
  });

  it('Ch2 has exactly 3 quests (MQ-011 to MQ-013)', () => {
    expect(byChapter(2)).toHaveLength(3);
  });

  it('Ch3 has exactly 3 quests (MQ-014 to MQ-016)', () => {
    expect(byChapter(3)).toHaveLength(3);
  });

  it('Ch4 has exactly 6 quests (MQ-017 to MQ-022)', () => {
    expect(byChapter(4)).toHaveLength(6);
  });

  it('Ch5 has exactly 3 quests (MQ-023 to MQ-025)', () => {
    expect(byChapter(5)).toHaveLength(3);
  });

  it('Ch6 has exactly 5 quests (MQ-026 to MQ-030)', () => {
    expect(byChapter(6)).toHaveLength(5);
  });

  it('Ch7 has exactly 4 quests (MQ-031 to MQ-034)', () => {
    expect(byChapter(7)).toHaveLength(4);
  });

  it('Ch8 has exactly 15 quests (MQ-035–MQ-044 + EQ-001–EQ-005)', () => {
    expect(byChapter(8)).toHaveLength(15);
  });

  it('Ch1 + Ch4 + Ch8 are the three largest chapter blocks', () => {
    const counts = [1, 2, 3, 4, 5, 6, 7, 8].map(ch => byChapter(ch).length);
    const top3 = [...counts].sort((a, b) => b - a).slice(0, 3);
    expect(top3).toContain(byChapter(1).length); // 10
    expect(top3).toContain(byChapter(4).length); // 6
    expect(top3).toContain(byChapter(8).length); // 15
  });
});

// ─── MAIN_QUESTS — chapter boundary spot-checks ──────────────────────────────

describe('MAIN_QUESTS — chapter boundary spot-checks', () => {
  const get = (id: string) => MAIN_QUESTS.find(q => q.id === id)!;

  it('MQ-010 is the last Ch1 quest and links to MQ-011', () => {
    const q = get('MQ-010');
    expect(q.chapter).toBe(1);
    expect(q.nextQuestId).toBe('MQ-011');
  });

  it('MQ-011 is the first Ch2 quest', () => {
    expect(get('MQ-011').chapter).toBe(2);
  });

  it('MQ-013 (last Ch2) links to MQ-014 (first Ch3)', () => {
    expect(get('MQ-013').nextQuestId).toBe('MQ-014');
    expect(get('MQ-014').chapter).toBe(3);
  });

  it('MQ-030 is the last Ch6 quest and links to MQ-031', () => {
    const q = get('MQ-030');
    expect(q.chapter).toBe(6);
    expect(q.nextQuestId).toBe('MQ-031');
  });

  it('MQ-031 is the first Ch7 quest', () => {
    expect(get('MQ-031').chapter).toBe(7);
  });

  it('MQ-034 (last Ch7) links to MQ-035 (first Ch8 MQ)', () => {
    expect(get('MQ-034').nextQuestId).toBe('MQ-035');
    expect(get('MQ-035').chapter).toBe(8);
  });

  it('MQ-016 (last Ch3) links to MQ-017 (first Ch4)', () => {
    expect(get('MQ-016').nextQuestId).toBe('MQ-017');
    expect(get('MQ-017').chapter).toBe(4);
  });

  it('MQ-022 (last Ch4) links to MQ-023 (first Ch5)', () => {
    expect(get('MQ-022').nextQuestId).toBe('MQ-023');
    expect(get('MQ-023').chapter).toBe(5);
  });

  it('MQ-025 (last Ch5) links to MQ-026 (first Ch6)', () => {
    expect(get('MQ-025').nextQuestId).toBe('MQ-026');
    expect(get('MQ-026').chapter).toBe(6);
  });
});

// ─── MAIN_QUESTS — chain start and terminal ───────────────────────────────────

describe('MAIN_QUESTS — chain start and terminal', () => {
  it('MQ-001 is the very first quest (chapter=1, links to MQ-002)', () => {
    const q = MAIN_QUESTS[0];
    expect(q.id).toBe('MQ-001');
    expect(q.chapter).toBe(1);
    expect(q.nextQuestId).toBe('MQ-002');
  });

  it('EQ-005 is the terminal quest (chapter=8, nextQuestId=null)', () => {
    const q = MAIN_QUESTS[MAIN_QUESTS.length - 1];
    expect(q.id).toBe('EQ-005');
    expect(q.chapter).toBe(8);
    expect(q.nextQuestId).toBeNull();
  });

  it('exactly one quest has nextQuestId=null (the terminal)', () => {
    const terminals = MAIN_QUESTS.filter(q => q.nextQuestId === null);
    expect(terminals).toHaveLength(1);
    expect(terminals[0].id).toBe('EQ-005');
  });

  it('MQ-001 title is non-empty', () => {
    expect(MAIN_QUESTS[0].title.length).toBeGreaterThan(0);
  });
});
