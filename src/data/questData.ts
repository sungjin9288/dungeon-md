// ─── Quest Data ───────────────────────────────────────────────────────────────
// Pure data file — types + MAIN_QUESTS array.
// No GameState dependency. Imported by quests.ts which owns all logic.

export type ObjectiveType =
  | 'build_room'     | 'assign_monster'   | 'defend_invasion'
  | 'reach_dm_level' | 'summon'           | 'upgrade_room'
  | 'feed_monster'   | 'fuse_monsters'    | 'collect_gold'
  | 'complete_stage';

export interface Objective {
  id:          string;
  type:        ObjectiveType;
  target:      number;
  current:     number;   // template default = 0
  description: string;
}

export interface Reward {
  gold?:         number;
  gems?:         number;
  soulCrystals?: number;
  dmXP:          number;
  items?:        string[];
  monsters?:     string[];
  unlocks?:      string[];
}

export interface InvasionWaveEntry { type: string; count: number; }
export interface InvasionWave      { waveNumber: number; invaders: InvasionWaveEntry[]; }

export interface InvasionConfig {
  id:              string;
  name:            string;
  waves:           InvasionWave[];
  isStoryInvasion: true;
}

export interface MainQuest {
  id:                  string;
  chapter:             number;
  title:               string;
  description:         string;
  npcSpeaker:          string;
  npcEmoji:            string;
  objectives:          Objective[];
  reward:              Reward;
  nextQuestId:         string | null;
  autoTrigger:         boolean;
  invasionOnComplete?: InvasionConfig;
}

// ─── Main Quest Chain (MQ-001 ~ MQ-034) ──────────────────────────────────────

export const MAIN_QUESTS: MainQuest[] = [
  {
    id: 'MQ-001', chapter: 1, autoTrigger: true,
    title: '던전의 각성',
    npcSpeaker: '산신령', npcEmoji: '⛩️',
    description: '오래 잠들었던 던전이 깨어났다.\n첫 번째 방을 지어 수호자를 맞이하라.',
    objectives: [
      { id: 'O1', type: 'build_room', target: 1, current: 0, description: '방 1개 건설' },
    ],
    reward: { gold: 100, dmXP: 50, monsters: ['dokkaebi_warrior'] },
    nextQuestId: 'MQ-002',
  },
  {
    id: 'MQ-002', chapter: 1, autoTrigger: true,
    title: '첫 번째 수호자',
    npcSpeaker: '도깨비 전사', npcEmoji: '👹',
    description: '크흠... 준비됐다. 나를 전투 구역에 배치해라.\n내가 이 던전을 지켜주겠다.',
    objectives: [
      { id: 'O1', type: 'assign_monster', target: 1, current: 0, description: '전투 구역에 몬스터 배치' },
    ],
    reward: { gold: 200, dmXP: 80 },
    nextQuestId: 'MQ-003',
  },
  {
    id: 'MQ-003', chapter: 1, autoTrigger: true,
    title: '첫 번째 침략',
    npcSpeaker: '산신령', npcEmoji: '⛩️',
    description: '마을 척후병이 던전을 발견했다!\n첫 번째 침략이 시작된다. 막아라!',
    objectives: [
      { id: 'O1', type: 'defend_invasion', target: 1, current: 0, description: '첫 번째 침략 격퇴' },
    ],
    invasionOnComplete: {
      id: 'INV-001', name: '마을 척후병대', isStoryInvasion: true,
      waves: [{ waveNumber: 1, invaders: [{ type: 'peasant_soldier', count: 3 }] }],
    },
    reward: { gold: 300, dmXP: 150, soulCrystals: 5 },
    nextQuestId: 'MQ-004',
  },
  {
    id: 'MQ-004', chapter: 1, autoTrigger: true,
    title: '던전을 강화하라',
    npcSpeaker: '도깨비 전사', npcEmoji: '👹',
    description: '한 번만으론 끝나지 않는다.\n더 많은 방을 지어 방어를 강화하라.',
    objectives: [
      { id: 'O1', type: 'build_room',     target: 2, current: 0, description: '방 2개 건설 (누적)' },
      { id: 'O2', type: 'reach_dm_level', target: 3, current: 0, description: '던전 마스터 Lv.3 달성' },
    ],
    reward: { gold: 400, dmXP: 200, unlocks: ['summon_altar'] },
    nextQuestId: 'MQ-005',
  },
  {
    id: 'MQ-005', chapter: 1, autoTrigger: true,
    title: '새로운 동료',
    npcSpeaker: '산신령', npcEmoji: '⛩️',
    description: '소환 제단이 완성됐다.\n제단의 힘으로 새로운 동료를 불러라.',
    objectives: [
      { id: 'O1', type: 'summon', target: 1, current: 0, description: '소환 1회 실행' },
    ],
    reward: { gold: 200, dmXP: 100, soulCrystals: 10 },
    nextQuestId: 'MQ-006',
  },
  {
    id: 'MQ-006', chapter: 1, autoTrigger: true,
    title: '두 번째 침략',
    npcSpeaker: '구미호', npcEmoji: '🦊',
    description: '호호... 마을 사람들이 용기를 냈나봐요.\n이번엔 방패를 든 병사들이 왔어요.',
    objectives: [
      { id: 'O1', type: 'defend_invasion', target: 1, current: 0, description: '두 번째 침략 격퇴' },
    ],
    invasionOnComplete: {
      id: 'INV-002', name: '마을 민병대', isStoryInvasion: true,
      waves: [
        { waveNumber: 1, invaders: [{ type: 'peasant_soldier', count: 5 }] },
        { waveNumber: 2, invaders: [{ type: 'peasant_soldier', count: 4 }, { type: 'shield_knight', count: 2 }] },
      ],
    },
    reward: { gold: 500, dmXP: 200, items: ['basic_sword'] },
    nextQuestId: 'MQ-007',
  },
  {
    id: 'MQ-007', chapter: 1, autoTrigger: true,
    title: '방을 업그레이드하라',
    npcSpeaker: '도깨비 전사', npcEmoji: '👹',
    description: '방패병들은 튼튼하다.\n방을 업그레이드해서 더 강하게 만들어야 한다.',
    objectives: [
      { id: 'O1', type: 'upgrade_room', target: 1, current: 0, description: '방 1개 Lv.2로 업그레이드' },
    ],
    reward: { gold: 300, dmXP: 150, soulCrystals: 15, unlocks: ['forge'] },
    nextQuestId: 'MQ-008',
  },
  {
    id: 'MQ-008', chapter: 1, autoTrigger: true,
    title: '동료를 돌봐라',
    npcSpeaker: '신선 도인', npcEmoji: '🧙',
    description: '몬스터들도 쉬고 먹어야 강해지는 법이니라.\n거처에서 동료에게 먹이를 주어라.',
    objectives: [
      { id: 'O1', type: 'feed_monster', target: 3, current: 0, description: '몬스터에게 먹이 주기 3회' },
    ],
    reward: { gold: 200, dmXP: 120, unlocks: ['affinity_system'] },
    nextQuestId: 'MQ-009',
  },
  {
    id: 'MQ-009', chapter: 1, autoTrigger: true,
    title: '세 번째 침략 — 야간 기습',
    npcSpeaker: '산신령', npcEmoji: '⛩️',
    description: '...어둠 속에서 움직이는 기운이 있다.\n야간 기습이다. 조심하라.',
    objectives: [
      { id: 'O1', type: 'defend_invasion', target: 1, current: 0, description: '야간 기습 격퇴' },
    ],
    invasionOnComplete: {
      id: 'INV-003', name: '밤의 도적단', isStoryInvasion: true,
      waves: [
        { waveNumber: 1, invaders: [{ type: 'shadow_thief', count: 4 }] },
        { waveNumber: 2, invaders: [{ type: 'shadow_thief', count: 3 }, { type: 'field_medic', count: 2 }] },
        { waveNumber: 3, invaders: [{ type: 'shadow_thief', count: 4 }, { type: 'shield_knight', count: 3 }, { type: 'field_medic', count: 1 }] },
      ],
    },
    reward: { gold: 600, dmXP: 250, soulCrystals: 20 },
    nextQuestId: 'MQ-010',
  },
  {
    id: 'MQ-010', chapter: 1, autoTrigger: true,
    title: '연구소 개방',
    npcSpeaker: '구미호', npcEmoji: '🦊',
    description: '호호, 던전이 많이 성장했네요.\n이제 몬스터를 합성할 수 있는 연구소를 열 수 있어요.',
    objectives: [
      { id: 'O1', type: 'reach_dm_level', target: 5,    current: 0, description: '던전 마스터 Lv.5 달성' },
      { id: 'O2', type: 'collect_gold',   target: 1000, current: 0, description: '골드 1000 누적 획득' },
    ],
    reward: { gold: 500, dmXP: 300, unlocks: ['research_lab'], gems: 10 },
    nextQuestId: 'MQ-011',
  },

  // ── Chapter 2 (MQ-011 ~ MQ-013) ──────────────────────────────────────────
  {
    id: 'MQ-011', chapter: 2, autoTrigger: true,
    title: '구미호의 속삭임',
    npcSpeaker: '구미호 수호자', npcEmoji: '🦊',
    description: '후후... 새로운 영역이 열리고 있어요.\n11번째 스테이지를 돌파하면 그 비밀을 알려줄게요.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 11, current: 0, description: '스테이지 11 클리어' },
    ],
    reward: { gold: 300, dmXP: 100, soulCrystals: 10 },
    nextQuestId: 'MQ-012',
  },
  {
    id: 'MQ-012', chapter: 2, autoTrigger: true,
    title: '호랑이의 시련',
    npcSpeaker: '백호 검사', npcEmoji: '🐯',
    description: '이 던전이 살아남으려면 탑이 필요하다.\n탑 3개를 건설하여 방어 체계를 갖춰라.',
    objectives: [
      { id: 'O1', type: 'build_room', target: 3, current: 0, description: '탑 3개 건설' },
    ],
    invasionOnComplete: {
      id: 'INV-004', name: '광전사 돌격대', isStoryInvasion: true,
      waves: [
        { waveNumber: 1, invaders: [{ type: 'berserker', count: 4 }, { type: 'shadow_ninja', count: 2 }] },
        { waveNumber: 2, invaders: [{ type: 'berserker', count: 5 }, { type: 'siege_soldier', count: 3 }] },
        { waveNumber: 3, invaders: [{ type: 'holy_paladin', count: 3 }, { type: 'iron_golem', count: 2 }, { type: 'berserker', count: 4 }] },
      ],
    },
    reward: { gold: 400, dmXP: 150, soulCrystals: 15 },
    nextQuestId: 'MQ-013',
  },
  {
    id: 'MQ-013', chapter: 2, autoTrigger: true,
    title: '얼음 결계',
    npcSpeaker: '빙결 산령', npcEmoji: '❄️',
    description: '차가운 기운이 던전을 감싸고 있다.\n던전 마스터의 힘을 더 끌어올려라.',
    objectives: [
      { id: 'O1', type: 'reach_dm_level', target: 5, current: 0, description: '던전 마스터 Lv.5 달성' },
    ],
    reward: { gold: 500, dmXP: 200, soulCrystals: 20 },
    nextQuestId: 'MQ-014',
  },

  // ── Chapter 3 (MQ-014 ~ MQ-016) ──────────────────────────────────────────
  {
    id: 'MQ-014', chapter: 3, autoTrigger: true,
    title: '저승의 문이 열리다',
    npcSpeaker: '저승사자', npcEmoji: '💀',
    description: '...저승의 기운이 스며들고 있다.\n21번째 스테이지를 돌파하면 그 문이 열릴 것이다.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 21, current: 0, description: '스테이지 21 클리어' },
    ],
    reward: { gold: 500, dmXP: 200, soulCrystals: 15 },
    nextQuestId: 'MQ-015',
  },
  {
    id: 'MQ-015', chapter: 3, autoTrigger: true,
    title: '탈춤의 비밀',
    npcSpeaker: '탈춤꾼', npcEmoji: '🎪',
    description: '얼쑤! 새로운 동료들이 필요하지 않겠나?\n소환을 5번 해서 전력을 보강해라!',
    objectives: [
      { id: 'O1', type: 'summon', target: 5, current: 0, description: '소환 5회 실행' },
    ],
    invasionOnComplete: {
      id: 'INV-005', name: '저승 원정대', isStoryInvasion: true,
      waves: [
        { waveNumber: 1, invaders: [{ type: 'undying_knight', count: 4 }, { type: 'scarecrow_mage', count: 2 }] },
        { waveNumber: 2, invaders: [{ type: 'venom_dancer', count: 3 }, { type: 'void_assassin', count: 3 }] },
        { waveNumber: 3, invaders: [{ type: 'undying_knight', count: 4 }, { type: 'scarecrow_mage', count: 3 }, { type: 'venom_dancer', count: 2 }] },
      ],
    },
    reward: { gold: 600, dmXP: 250, soulCrystals: 20 },
    nextQuestId: 'MQ-016',
  },
  {
    id: 'MQ-016', chapter: 3, autoTrigger: true,
    title: '독사의 그림자',
    npcSpeaker: '독사 전사', npcEmoji: '🐍',
    description: '쉿... 적들이 더 강해지고 있다.\n방 5개를 업그레이드하여 독기를 퍼뜨려라.',
    objectives: [
      { id: 'O1', type: 'upgrade_room', target: 5, current: 0, description: '방 업그레이드 5회' },
    ],
    reward: { gold: 700, dmXP: 300, soulCrystals: 25 },
    nextQuestId: 'MQ-017',
  },

  // ── Chapter 4 (MQ-017 ~ MQ-022) ──────────────────────────────────────────
  {
    id: 'MQ-017', chapter: 4, autoTrigger: true,
    title: '천상의 부름',
    npcSpeaker: '천녀', npcEmoji: '🪭',
    description: '하늘에서 빛이 내려오고 있어요.\n33번째 스테이지를 돌파하면 천상의 힘을 얻을 수 있어요.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 33, current: 0, description: '스테이지 33 클리어' },
    ],
    reward: { gold: 800, dmXP: 350, soulCrystals: 25 },
    nextQuestId: 'MQ-018',
  },
  {
    id: 'MQ-018', chapter: 4, autoTrigger: true,
    title: '삼족오의 시험',
    npcSpeaker: '삼족오', npcEmoji: '🐦',
    description: '태양의 새가 시험을 내린다.\n골드 5000을 모아 그 가치를 증명하라.',
    objectives: [
      { id: 'O1', type: 'collect_gold', target: 5000, current: 0, description: '골드 5000 누적 획득' },
    ],
    reward: { gold: 1000, dmXP: 400, soulCrystals: 30 },
    nextQuestId: 'MQ-019',
  },
  {
    id: 'MQ-019', chapter: 4, autoTrigger: true,
    title: '거대 용의 분노',
    npcSpeaker: '대사', npcEmoji: '🐍',
    description: '거대한 용의 분노가 하늘을 뒤덮는다.\n이 침략을 막아라!',
    objectives: [
      { id: 'O1', type: 'defend_invasion', target: 1, current: 0, description: '거대 용의 침략 격퇴' },
    ],
    invasionOnComplete: {
      id: 'INV-006', name: '천상 원정대', isStoryInvasion: true,
      waves: [
        { waveNumber: 1, invaders: [{ type: 'void_assassin_elite', count: 3 }, { type: 'death_emissary', count: 2 }] },
        { waveNumber: 2, invaders: [{ type: 'death_emissary', count: 3 }, { type: 'ghost_add', count: 5 }] },
        { waveNumber: 3, invaders: [{ type: 'void_assassin_elite', count: 4 }, { type: 'death_emissary', count: 3 }, { type: 'ghost_add', count: 4 }] },
      ],
    },
    reward: { gold: 1200, dmXP: 500, soulCrystals: 30 },
    nextQuestId: 'MQ-020',
  },
  {
    id: 'MQ-020', chapter: 4, autoTrigger: true,
    title: '합성의 비밀',
    npcSpeaker: '신선 도인', npcEmoji: '🧙',
    description: '합성의 첫걸음은 동료를 잘 돌보는 것이니라.\n먹이를 3번 주어 친밀도를 쌓아라.',
    objectives: [
      { id: 'O1', type: 'feed_monster', target: 3, current: 0, description: '몬스터에게 먹이 주기 3회' },
    ],
    reward: { gold: 500, dmXP: 200, soulCrystals: 20 },
    nextQuestId: 'MQ-021',
  },
  {
    id: 'MQ-021', chapter: 4, autoTrigger: true,
    title: '첫 번째 합성',
    npcSpeaker: '신선 도인', npcEmoji: '🧙',
    description: '합성 재료가 필요하다.\n소환을 3번 하여 새로운 동료들을 모아라.',
    objectives: [
      { id: 'O1', type: 'summon', target: 3, current: 0, description: '소환 3회 실행' },
    ],
    reward: { gold: 600, dmXP: 250, soulCrystals: 25 },
    nextQuestId: 'MQ-022',
  },
  {
    id: 'MQ-022', chapter: 4, autoTrigger: true,
    title: '진화의 길',
    npcSpeaker: '신선 도인', npcEmoji: '🧙',
    description: '진정한 진화는 던전 마스터 자신의 성장에서 오는 것이니라.\nLv.10에 도달하라.',
    objectives: [
      { id: 'O1', type: 'reach_dm_level', target: 10, current: 0, description: '던전 마스터 Lv.10 달성' },
    ],
    reward: { gold: 1000, dmXP: 400, soulCrystals: 30 },
    nextQuestId: 'MQ-023',
  },

  // ── Chapter 5 (MQ-023 ~ MQ-025) ──────────────────────────────────────────
  {
    id: 'MQ-023', chapter: 5, autoTrigger: true,
    title: '스킨 수집가',
    npcSpeaker: '상인 도깨비', npcEmoji: '👹',
    description: '크흐흐... 부자가 되고 싶다고?\n골드 10000을 모아봐라. 그럼 특별한 걸 줄게.',
    objectives: [
      { id: 'O1', type: 'collect_gold', target: 10000, current: 0, description: '골드 10000 누적 획득' },
    ],
    reward: { gold: 800, dmXP: 300, soulCrystals: 50 },
    nextQuestId: 'MQ-024',
  },
  {
    id: 'MQ-024', chapter: 5, autoTrigger: true,
    title: '도감 학자',
    npcSpeaker: '학자 도깨비', npcEmoji: '📖',
    description: '도감을 채우려면 다양한 동료가 필요하다네.\n소환을 10번 실행하여 컬렉션을 늘려보게.',
    objectives: [
      { id: 'O1', type: 'summon', target: 10, current: 0, description: '소환 10회 실행' },
    ],
    reward: { gold: 1000, dmXP: 400, soulCrystals: 40 },
    nextQuestId: 'MQ-025',
  },
  {
    id: 'MQ-025', chapter: 5, autoTrigger: true,
    title: '던전의 전설',
    npcSpeaker: '던전 마스터', npcEmoji: '🏰',
    description: '이 던전의 주인으로서 최고의 경지에 올라라.\n던전 마스터 Lv.15를 달성하면 전설이 될 것이다.',
    objectives: [
      { id: 'O1', type: 'reach_dm_level', target: 15, current: 0, description: '던전 마스터 Lv.15 달성' },
    ],
    reward: { gold: 2000, dmXP: 500, soulCrystals: 100 },
    nextQuestId: 'MQ-026',
  },

  // ── Chapter 6: 영원의 왕좌 (MQ-026 ~ MQ-030) ─────────────────────────────
  {
    id: 'MQ-026', chapter: 6, autoTrigger: true,
    title: '영원의 문',
    npcSpeaker: '왕좌의 수호자', npcEmoji: '👑',
    description: '영원의 왕좌로 가는 문이 열렸다.\n첫 번째 시련을 통과하라.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 53, current: 0, description: '스테이지 53 클리어' },
    ],
    reward: { gold: 1200, dmXP: 500, soulCrystals: 40 },
    nextQuestId: 'MQ-027',
  },
  {
    id: 'MQ-027', chapter: 6, autoTrigger: true,
    title: '왕좌의 수호자들',
    npcSpeaker: '왕좌의 수호자', npcEmoji: '👑',
    description: '공허의 왕좌를 지키려면 더 강력한 수호자가 필요하다.\n소환하여 새로운 전력을 확보하라.',
    objectives: [
      { id: 'O1', type: 'summon',         target: 5, current: 0, description: '소환 5회 실행' },
      { id: 'O2', type: 'assign_monster', target: 3, current: 0, description: '몬스터 3마리 배치' },
    ],
    invasionOnComplete: {
      id: 'INV-006', name: '공허의 척후대', isStoryInvasion: true,
      waves: [
        { waveNumber: 1, invaders: [{ type: 'mirror_knight', count: 4 }] },
        { waveNumber: 2, invaders: [{ type: 'shadow_wraith', count: 3 }, { type: 'mirror_knight', count: 3 }] },
        { waveNumber: 3, invaders: [{ type: 'swarm_larva', count: 2 }, { type: 'shadow_wraith', count: 3 }] },
      ],
    },
    reward: { gold: 1500, dmXP: 600, soulCrystals: 50 },
    nextQuestId: 'MQ-028',
  },
  {
    id: 'MQ-028', chapter: 6, autoTrigger: true,
    title: '그림자의 왕좌',
    npcSpeaker: '왕좌의 수호자', npcEmoji: '👑',
    description: '거신의 문을 돌파하고 던전을 강화하라.\n왕좌에 가까워질수록 적은 더 강해진다.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 58, current: 0, description: '스테이지 58 클리어' },
      { id: 'O2', type: 'upgrade_room',   target: 3,  current: 0, description: '방 업그레이드 3회' },
    ],
    reward: { gold: 2000, dmXP: 700, soulCrystals: 60 },
    nextQuestId: 'MQ-029',
  },
  {
    id: 'MQ-029', chapter: 6, autoTrigger: true,
    title: '최후의 결전',
    npcSpeaker: '왕좌의 수호자', npcEmoji: '👑',
    description: '영원의 황제와 마주하기 전에 준비를 마쳐라.\n충분한 자원과 경험이 필요하다.',
    objectives: [
      { id: 'O1', type: 'collect_gold',   target: 20000, current: 0, description: '골드 20000 누적 획득' },
      { id: 'O2', type: 'reach_dm_level', target: 20,    current: 0, description: '던전 마스터 Lv.20 달성' },
    ],
    reward: { gold: 2500, dmXP: 800, soulCrystals: 80 },
    nextQuestId: 'MQ-030',
  },
  {
    id: 'MQ-030', chapter: 6, autoTrigger: true,
    title: '영원의 황제',
    npcSpeaker: '영원의 황제', npcEmoji: '⚔️',
    description: '공허의 왕좌에 앉은 자여, 나를 쓰러뜨릴 수 있겠느냐?\n마지막 스테이지를 클리어하면 진정한 던전의 주인이 된다.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 62, current: 0, description: '스테이지 62 클리어' },
    ],
    reward: { gold: 5000, dmXP: 1000, soulCrystals: 200 },
    nextQuestId: 'MQ-031',
  },

  // ── Chapter 7: 천계 (MQ-031 ~ MQ-034) ───────────────────────────────────
  {
    id: 'MQ-031', chapter: 7, autoTrigger: true,
    title: '천상계의 문',
    npcSpeaker: '천상 수호자', npcEmoji: '✨',
    description: '천상계의 문이 열렸다. 신들의 영역에 처음 발을 내딛어라.\n첫 번째 신계 시련을 통과하라.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 63, current: 0, description: '스테이지 63 클리어' },
    ],
    reward: { gold: 3000, dmXP: 800, soulCrystals: 60 },
    nextQuestId: 'MQ-032',
  },
  {
    id: 'MQ-032', chapter: 7, autoTrigger: true,
    title: '천상 군단 소집',
    npcSpeaker: '천상 수호자', npcEmoji: '✨',
    description: '신계를 지키려면 천상족 수호자가 필요하다.\n천상 신전을 건설하고 소환을 강화하라.',
    objectives: [
      { id: 'O1', type: 'build_room',   target: 1, current: 0, description: '천상 신전 건설' },
      { id: 'O2', type: 'summon',       target: 5, current: 0, description: '소환 5회 실행' },
      { id: 'O3', type: 'upgrade_room', target: 3, current: 0, description: '방 업그레이드 3회' },
    ],
    invasionOnComplete: {
      id: 'INV-007', name: '천상계 척후대', isStoryInvasion: true,
      waves: [
        { waveNumber: 1, invaders: [{ type: 'celestial_knight', count: 3 }] },
        { waveNumber: 2, invaders: [{ type: 'divine_archer', count: 3 }, { type: 'celestial_knight', count: 2 }] },
        { waveNumber: 3, invaders: [{ type: 'heaven_general', count: 1 }, { type: 'divine_archer', count: 3 }] },
      ],
    },
    reward: { gold: 4000, dmXP: 1000, soulCrystals: 80 },
    nextQuestId: 'MQ-033',
  },
  {
    id: 'MQ-033', chapter: 7, autoTrigger: true,
    title: '신계의 전선',
    npcSpeaker: '산신령', npcEmoji: '⛩️',
    description: '천상계의 관문에 도달했다. 자원을 확보하고 신계 중심부로 돌진하라.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 68,    current: 0, description: '스테이지 68 클리어' },
      { id: 'O2', type: 'collect_gold',   target: 30000, current: 0, description: '골드 30000 누적 획득' },
    ],
    reward: { gold: 5000, dmXP: 1200, soulCrystals: 100 },
    nextQuestId: 'MQ-034',
  },
  {
    id: 'MQ-034', chapter: 7, autoTrigger: true,
    title: '천제를 쓰러뜨려라',
    npcSpeaker: '천제', npcEmoji: '👼',
    description: '드디어 천제와 마주할 시간이다.\n모든 힘을 모아 신계 최고의 존재를 물리쳐라.',
    objectives: [
      { id: 'O1', type: 'complete_stage', target: 72, current: 0, description: '스테이지 72 클리어' },
    ],
    reward: { gold: 10000, dmXP: 2000, soulCrystals: 500 },
    nextQuestId: null,
  },
];
