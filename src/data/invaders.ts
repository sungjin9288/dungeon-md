export type InvaderType =
  | 'peasant' | 'soldier' | 'knight' | 'shaman' | 'void' | 'undying'
  // ─── Chapter 2 ───
  | 'berserker' | 'shadow_ninja' | 'siege_soldier' | 'holy_paladin'
  | 'iron_golem' | 'high_priest' | 'mercenary_captain' | 'trap_breaker'
  | 'fox_queen' | 'fox_spirit'
  // ─── Chapter 3 ───
  | 'undying_knight'
  | 'scarecrow_mage'
  | 'venom_dancer'
  | 'void_assassin'
  | 'dragon_king'
  // ─── Chapter 4 ───
  | 'void_assassin_elite'
  | 'death_emissary'
  | 'ghost_add'
  // ─── Chapter 5 ───
  | 'void_invader'
  | 'undying_warrior'
  | 'three_god_destroyer'
  // ─── Chapter 6 ───
  | 'mirror_knight'
  | 'swarm_larva'
  | 'swarm_spawn'
  | 'shadow_wraith'
  | 'celestial_crusader'
  | 'void_colossus'
  | 'plague_herald'
  | 'titan_sentinel'
  | 'eternal_emperor'
  // ─── Chapter 7 ───
  | 'celestial_knight'
  | 'divine_archer'
  | 'heaven_general'
  | 'sky_titan'
  | 'radiant_seraph'
  | 'celestial_dragon'
  | 'god_emperor'
  // ─── Chapter 8 ───
  | 'void_soldier'
  | 'abyss_berserker'
  | 'primordial_guard'
  | 'primordial_titan'
  // ─── Chapter 9 (공허 너머) ───
  | 'abyss_reaver'
  | 'void_sovereign'
  // ─── Endless-only variety (no campaign placement) ───
  | 'raider' | 'plague_rat' | 'bone_archer';

export type InvaderBehavior =
  | 'VOID_PHASE'         // immune to traps for 5s after spawn (purple aura)
  | 'REVIVE_ONCE'        // intercept death once: revive at 40% HP
  | 'BERSERKER_RAGE'     // below 40% HP: double speed + red aura
  | 'STEALTH'            // invisible for 3s after spawn; traps can't target
  | 'SIEGE_SHIELD'       // 50% dmg reduction from trap rooms only
  | 'DIVINE_WARD'        // magic immune: ignores PERMAFROST + FOX_FIRE_CHARM
  | 'IRON_BODY'          // halves all damage; no crowd-control effects
  | 'RALLY_CRY'          // on enter: nearby invaders +20% speed for 5s
  | 'TRAP_IMMUNITY'      // completely immune to all trap/trap_corridor rooms
  | 'FOX_QUEEN_PHASE'    // boss: 3 phases (100%→60%→30% HP), summons illusions
  | 'UNDYING_KNIGHT'     // revive once at 60% HP; magic kills prevent revive
  | 'DECOY_CLONE'        // spawn decoy every 15s; real invader immune while clone alive
  | 'POISON_TRAIL'       // leaves 8s poison trail; adjacent rooms take 5HP/s
  | 'VOID_TELEPORT'      // after 2s: teleports to final row, skips all cells
  | 'DRAGON_KING_PHASE'  // 3-phase boss: standard → fire_immune → submerge
  | 'VOID_STEALTH_ELITE'  // teleport + 2s post-teleport stealth
  | 'STUN_IMMUNE'         // immune to all damage unless stunned; adds every 20s
  | 'FIVE_PHASE'          // 5-phase final boss
  // ─── Chapter 6 ───
  | 'MIRROR_SHIELD'       // reflects 30% damage back; shield breaks after 3 hits
  | 'SWARM'               // on death: splits into 3 swarm_spawn (30% HP each)
  | 'SHADOW_REALM'        // phases out (immune + invisible) for 2s every 8s
  | 'EMPEROR_PHASE'       // 4-phase final boss (100%→70%→40%→15%)
  // ─── Chapter 7 ───
  | 'GOD_EMPEROR_PHASE'   // 5-phase god boss (100%→80%→60%→40%→20%)
  // ─── Chapter 8 ───
  | 'VOID_SURGE'          // enters void-phase instantly; re-activates every 10s
  | 'PRIMORDIAL_PHASE';   // 6-phase origin boss (100%→85%→70%→50%→30%→10%)

export interface InvaderDef {
  type:          InvaderType;
  koreanName:    string;
  hp:            number;
  speed:         number;    // px/sec
  reward:        number;    // gold on kill
  damage:        number;    // dungeon damage if reaches end
  color:         number;
  radius:        number;
  behavior?:     InvaderBehavior;
  isMiniBoss?:   boolean;   // wave 20 mini-boss: no death-split
  isBoss?:       boolean;   // full chapter boss
  endlessOnly?:  boolean;
  chapter?:      number;    // 1 or 2
}

export const INVADER_DEFS: Record<InvaderType, InvaderDef> = {
  // ─── Chapter 1 ────────────────────────────────────────────────────────────
  peasant:  { type: 'peasant',  koreanName: '농민',        hp: 60,   speed: 70,  reward: 10, damage: 50,  color: 0x8b6040, radius: 12 },
  soldier:  { type: 'soldier',  koreanName: '병사',        hp: 150,  speed: 55,  reward: 25, damage: 100, color: 0x6080a0, radius: 14 },
  knight:   { type: 'knight',   koreanName: '기사',        hp: 350,  speed: 40,  reward: 60, damage: 200, color: 0x404060, radius: 16 },
  shaman:   { type: 'shaman',   koreanName: '무당',        hp: 120,  speed: 80,  reward: 40, damage: 150, color: 0x7a30c8, radius: 13 },
  void:     { type: 'void',     koreanName: '공허 침략자', hp: 200,  speed: 100, reward: 55, damage: 180, color: 0x2a0050, radius: 13, behavior: 'VOID_PHASE',   endlessOnly: true },
  undying:  { type: 'undying',  koreanName: '불사 전사',   hp: 300,  speed: 70,  reward: 75, damage: 250, color: 0x6a0010, radius: 15, behavior: 'REVIVE_ONCE',  endlessOnly: true },

  // ─── Chapter 2 ────────────────────────────────────────────────────────────
  berserker: {
    type: 'berserker', koreanName: '광전사', chapter: 2,
    hp: 180, speed: 65, reward: 30, damage: 130,
    color: 0xcc2200, radius: 14, behavior: 'BERSERKER_RAGE',
  },
  shadow_ninja: {
    type: 'shadow_ninja', koreanName: '그림자 닌자', chapter: 2,
    hp: 100, speed: 110, reward: 35, damage: 120,
    color: 0x1a1a3a, radius: 11, behavior: 'STEALTH',
  },
  siege_soldier: {
    type: 'siege_soldier', koreanName: '공성 병사', chapter: 2,
    hp: 250, speed: 45, reward: 40, damage: 160,
    color: 0x604020, radius: 15, behavior: 'SIEGE_SHIELD',
  },
  holy_paladin: {
    type: 'holy_paladin', koreanName: '성전사', chapter: 2,
    hp: 220, speed: 50, reward: 45, damage: 150,
    color: 0xe8d060, radius: 14, behavior: 'DIVINE_WARD',
  },
  iron_golem: {
    type: 'iron_golem', koreanName: '철 골렘', chapter: 2,
    hp: 500, speed: 28, reward: 80, damage: 300,
    color: 0x708090, radius: 18, behavior: 'IRON_BODY',
  },
  high_priest: {
    type: 'high_priest', koreanName: '대제사장', chapter: 2,
    hp: 160, speed: 60, reward: 50, damage: 140,
    color: 0xc060e0, radius: 13, behavior: 'RALLY_CRY',
  },
  mercenary_captain: {
    type: 'mercenary_captain', koreanName: '용병 대장', chapter: 2,
    hp: 280, speed: 55, reward: 55, damage: 180,
    color: 0xa08030, radius: 15, behavior: 'RALLY_CRY',
  },
  trap_breaker: {
    type: 'trap_breaker', koreanName: '덫 파괴자', chapter: 2,
    hp: 140, speed: 75, reward: 35, damage: 110,
    color: 0x308050, radius: 12, behavior: 'TRAP_IMMUNITY',
  },
  fox_queen: {
    type: 'fox_queen', koreanName: '여우 여왕 (보스)', chapter: 2,
    hp: 1600, speed: 45, reward: 400, damage: 500,
    color: 0xff6600, radius: 22, behavior: 'FOX_QUEEN_PHASE', isMiniBoss: true,
  },
  // Lesser fox elite that closes Ch2 stages S11–S19 (the full fox_queen is the
  // S20 chapter boss). Keeps the fox motif while sitting ~28 dpsWall — above Ch2
  // regulars (~24) yet below Ch3 regulars (33.8), so Ch2→Ch3 no longer inverts.
  fox_spirit: {
    type: 'fox_spirit', koreanName: '여우 정령', chapter: 2,
    hp: 360, speed: 50, reward: 70, damage: 200,
    color: 0xff9944, radius: 16,
  },

  // ─── Chapter 3 ────────────────────────────────────────────────────────────

  undying_knight: {
    type: 'undying_knight', koreanName: '불사 기사', chapter: 3,
    hp: 280, speed: 65, reward: 45, damage: 200,
    color: 0x8b0000, radius: 15, behavior: 'UNDYING_KNIGHT',
  },
  scarecrow_mage: {
    type: 'scarecrow_mage', koreanName: '허수아비 마법사', chapter: 3,
    hp: 160, speed: 60, reward: 40, damage: 160,
    color: 0x6a4a8a, radius: 13, behavior: 'DECOY_CLONE',
  },
  venom_dancer: {
    type: 'venom_dancer', koreanName: '독무 춤꾼', chapter: 3,
    hp: 200, speed: 70, reward: 50, damage: 180,
    color: 0x2a7a1a, radius: 13, behavior: 'POISON_TRAIL',
  },
  void_assassin: {
    type: 'void_assassin', koreanName: '공허 암살자', chapter: 3,
    hp: 240, speed: 90, reward: 55, damage: 220,
    color: 0x1a0040, radius: 12, behavior: 'VOID_TELEPORT',
  },
  dragon_king: {
    type: 'dragon_king', koreanName: '용왕 (보스)', chapter: 3,
    hp: 2800, speed: 40, reward: 600, damage: 700,
    color: 0x006080, radius: 28, behavior: 'DRAGON_KING_PHASE', isMiniBoss: true,
  },

  // ─── Chapter 4 ────────────────────────────────────────────────────────────
  void_assassin_elite: {
    type: 'void_assassin_elite', koreanName: '공허 암살자 (강화)', chapter: 4,
    hp: 350, speed: 80, damage: 100, reward: 55,
    radius: 14, color: 0x440066,
    behavior: 'VOID_STEALTH_ELITE',
  },
  death_emissary: {
    type: 'death_emissary', koreanName: '저승왕 사자', chapter: 4,
    hp: 3000, speed: 35, damage: 400, reward: 700,
    radius: 28, color: 0x110022,
    behavior: 'STUN_IMMUNE', isBoss: true,
  },
  ghost_add: {
    type: 'ghost_add', koreanName: '유령 병사', chapter: 4,
    hp: 80, speed: 100, damage: 30, reward: 5,
    radius: 10, color: 0x8888cc,
    behavior: 'DIVINE_WARD',
  },
  // ─── Chapter 5 ────────────────────────────────────────────────────────────
  void_invader: {
    type: 'void_invader', koreanName: '공허 침략자', chapter: 5,
    hp: 300, speed: 100, damage: 80, reward: 60,
    radius: 12, color: 0x330044,
    behavior: 'VOID_TELEPORT',
  },
  undying_warrior: {
    type: 'undying_warrior', koreanName: '불사 전사', chapter: 5,
    hp: 400, speed: 70, damage: 90, reward: 65,
    radius: 14, color: 0x333366,
    behavior: 'UNDYING_KNIGHT',
  },
  three_god_destroyer: {
    type: 'three_god_destroyer', koreanName: '삼신 파괴자', chapter: 5,
    hp: 5000, speed: 35, damage: 600, reward: 1000,
    radius: 32, color: 0x332200,
    behavior: 'FIVE_PHASE', isBoss: true,
  },

  // ─── Chapter 6 ────────────────────────────────────────────────────────────
  mirror_knight: {
    type: 'mirror_knight', koreanName: '거울 기사', chapter: 6,
    hp: 500, speed: 50, reward: 70, damage: 100,
    color: 0xc0c0d0, radius: 15, behavior: 'MIRROR_SHIELD',
  },
  swarm_larva: {
    type: 'swarm_larva', koreanName: '군체 유충', chapter: 6,
    hp: 800, speed: 40, reward: 80, damage: 120,
    color: 0x4a6030, radius: 16, behavior: 'SWARM',
  },
  swarm_spawn: {
    type: 'swarm_spawn', koreanName: '군체 새끼', chapter: 6,
    hp: 240, speed: 90, reward: 15, damage: 40,
    color: 0x607040, radius: 10,
  },
  shadow_wraith: {
    type: 'shadow_wraith', koreanName: '그림자 망령', chapter: 6,
    hp: 600, speed: 75, reward: 85, damage: 110,
    color: 0x1a0030, radius: 13, behavior: 'SHADOW_REALM',
  },
  celestial_crusader: {
    type: 'celestial_crusader', koreanName: '천상 십자군', chapter: 6,
    hp: 700, speed: 55, reward: 90, damage: 130,
    color: 0xe0c040, radius: 16, behavior: 'DIVINE_WARD',
  },
  void_colossus: {
    type: 'void_colossus', koreanName: '공허 거신', chapter: 6,
    hp: 1200, speed: 30, reward: 120, damage: 200,
    color: 0x200040, radius: 20, behavior: 'IRON_BODY',
  },
  plague_herald: {
    type: 'plague_herald', koreanName: '역병 전령', chapter: 6,
    hp: 550, speed: 65, reward: 95, damage: 100,
    color: 0x305010, radius: 14, behavior: 'POISON_TRAIL',
  },
  titan_sentinel: {
    type: 'titan_sentinel', koreanName: '타이탄 파수꾼', chapter: 6,
    hp: 1500, speed: 35, reward: 150, damage: 250,
    color: 0x606080, radius: 22, behavior: 'SIEGE_SHIELD',
  },
  eternal_emperor: {
    type: 'eternal_emperor', koreanName: '영원의 황제 (보스)', chapter: 6,
    hp: 5500, speed: 30, reward: 2000, damage: 800,
    color: 0xd4af37, radius: 36, behavior: 'EMPEROR_PHASE', isBoss: true,
  },

  // ─── Chapter 7 ────────────────────────────────────────────────────────────
  celestial_knight: {
    type: 'celestial_knight', koreanName: '천상 기사', chapter: 7,
    hp: 650, speed: 55, reward: 80, damage: 110,
    color: 0xe8d4a0, radius: 16, behavior: 'DIVINE_WARD',
  },
  divine_archer: {
    type: 'divine_archer', koreanName: '신성 궁수', chapter: 7,
    hp: 480, speed: 78, reward: 85, damage: 105,
    color: 0xffd080, radius: 13, behavior: 'STEALTH',
  },
  heaven_general: {
    type: 'heaven_general', koreanName: '천계 장군', chapter: 7,
    hp: 1300, speed: 42, reward: 120, damage: 200,
    color: 0xcc8800, radius: 18, behavior: 'RALLY_CRY',
  },
  sky_titan: {
    type: 'sky_titan', koreanName: '창공 거인', chapter: 7,
    hp: 2200, speed: 25, reward: 160, damage: 280,
    color: 0x6080cc, radius: 22, behavior: 'IRON_BODY',
  },
  radiant_seraph: {
    type: 'radiant_seraph', koreanName: '광휘 세라프', chapter: 7,
    hp: 800, speed: 60, reward: 90, damage: 120,
    color: 0xffeebb, radius: 14, behavior: 'DIVINE_WARD',
  },
  celestial_dragon: {
    type: 'celestial_dragon', koreanName: '천룡 (보스)', chapter: 7,
    hp: 3800, speed: 30, reward: 900, damage: 650,
    color: 0xaaddff, radius: 28, behavior: 'DRAGON_KING_PHASE', isMiniBoss: true,
  },
  god_emperor: {
    type: 'god_emperor', koreanName: '신황제 (최종 보스)', chapter: 7,
    hp: 10000, speed: 22, reward: 4000, damage: 1400,
    color: 0xffd700, radius: 40, behavior: 'GOD_EMPEROR_PHASE', isBoss: true,
  },

  // ─── Chapter 8 ────────────────────────────────────────────────────────────
  void_soldier: {
    type: 'void_soldier', koreanName: '공허 병사', chapter: 8,
    hp: 700, speed: 65, reward: 90, damage: 120,
    color: 0x220044, radius: 14, behavior: 'VOID_SURGE',
  },
  abyss_berserker: {
    type: 'abyss_berserker', koreanName: '심연 광전사', chapter: 8,
    hp: 950, speed: 78, reward: 105, damage: 145,
    color: 0x3a0060, radius: 15, behavior: 'BERSERKER_RAGE',
  },
  primordial_guard: {
    type: 'primordial_guard', koreanName: '원초 수문장', chapter: 8,
    hp: 2200, speed: 28, reward: 145, damage: 240,
    color: 0x1a0035, radius: 20, behavior: 'IRON_BODY',
  },
  primordial_titan: {
    type: 'primordial_titan', koreanName: '원초신 (최종 보스)', chapter: 8,
    hp: 14000, speed: 18, reward: 6000, damage: 2000,
    color: 0x660099, radius: 46, behavior: 'PRIMORDIAL_PHASE', isBoss: true,
  },
  // ─── Chapter 9: 공허 너머 (reuse existing behaviors — data-driven) ───
  abyss_reaver: {
    type: 'abyss_reaver', koreanName: '심연 약탈자', chapter: 9,
    hp: 1300, speed: 88, reward: 125, damage: 190,
    color: 0x4a0070, radius: 16, behavior: 'BERSERKER_RAGE',
  },
  void_sovereign: {
    type: 'void_sovereign', koreanName: '공허 군주 (최종 보스)', chapter: 9,
    hp: 22000, speed: 20, reward: 10000, damage: 3000,
    color: 0x8800cc, radius: 50, behavior: 'PRIMORDIAL_PHASE', isBoss: true,
  },
  // ─── Endless-only variety (no special behavior; pure stat archetypes) ───────
  raider:      { type: 'raider',      koreanName: '약탈자',    hp: 240, speed: 95,  reward: 35, damage: 130, color: 0xc44a2a, radius: 13, endlessOnly: true },
  plague_rat:  { type: 'plague_rat',  koreanName: '역병 쥐떼', hp: 90,  speed: 115, reward: 18, damage: 70,  color: 0x6a8a3a, radius: 10, endlessOnly: true },
  bone_archer: { type: 'bone_archer', koreanName: '해골 궁수', hp: 200, speed: 78,  reward: 45, damage: 150, color: 0xc8c0a8, radius: 13, endlessOnly: true },
};
