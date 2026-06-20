// ─── Monster Display Maps ─────────────────────────────────────────────────────
// Centralised emoji and Korean name lookups for all monsters across Ch1–Ch7.
// Used by DungeonHomeScene, PreBattleScene, and any future UI that needs
// human-readable monster display without loading the full MonsterDef.

export const MONSTER_EMOJI: Record<string, string> = {
  // ── Ch1 ─────────────────────────────────────────────────────────────────
  dokkaebi_warrior: '👹', dokkaebi_junior: '👺',
  village_archer:   '🏹', gold_turtle:     '🐢',
  fire_dokkaebi:    '🔥', sage:            '🧙',
  // ── Ch2 ─────────────────────────────────────────────────────────────────
  gumiho_guardian:  '🦊', white_tiger:     '🐯',
  frost_spirit:     '❄️', fox_shaman:      '🪬',
  sea_god_spear:    '🔱', iron_mask:       '🎭',
  // ── Ch3 ─────────────────────────────────────────────────────────────────
  death_messenger:  '💀', thunder_hero:    '⚡',
  ghost_hunter:     '👻', mask_dancer:     '🎪',
  venom_warrior:    '🐍',
  // ── Ch4 ─────────────────────────────────────────────────────────────────
  celestial_dancer:    '🪭', three_legged_crow: '🐦',
  great_serpent:       '🐍', moon_rabbit_sage:  '🐇',
  // ── Ch5 ─────────────────────────────────────────────────────────────────
  mountain_god:     '⛰️',  volcanic_warrior: '🌋',
  storm_archer:     '🏹',  abyss_mage:       '🌀',
  celestial_healer: '✨',  mask_berserker:   '🎭',
  sea_dragon_lord:  '🐉',  fox_spirit_elder: '🦊',
  // ── Ch7 천상족 ────────────────────────────────────────────────────────────
  celestial_guardian: '⚔️', sky_archer:       '🏹',
  heaven_mage:        '🌟', solar_warrior:    '☀️',
  divine_healer:      '💖', starlight_knight: '🌙',
  celestial_sage:     '🔮', god_realm_general:'👑',
  // ── Ch6 도깨비족 ──────────────────────────────────────────────────────────
  thunder_dokkaebi:      '⚡', ice_dokkaebi:        '❄️',
  healer_dokkaebi:       '💚', dokkaebi_captain:    '👹',
  dokkaebi_bomber:       '💣', dokkaebi_duelist:    '⚔️',
  poison_dokkaebi:       '☠️', shadow_dokkaebi:     '🌑',
  shield_dokkaebi:       '🛡️', dokkaebi_shaman:     '🪄',
  dokkaebi_king:         '👑', storm_dokkaebi:      '🌪️',
  gold_dokkaebi:         '💰', fire_dokkaebi_king:  '🔥',
  black_dragon_dokkaebi: '🐲', dokkaebi_general:    '⚔️',
  dokkaebi_god_king:     '🌟',
  // ── Ch6 구미호족 ──────────────────────────────────────────────────────────
  one_tail_fox:    '🦊', three_tail_fox:  '🦊',
  five_tail_fox:   '🦊', spring_gumiho:   '🌸',
  summer_gumiho:   '🌊', ice_gumiho:      '❄️',
  thunder_gumiho:  '⚡', fox_warrior:     '🦊',
  gumiho_queen:    '👑', gumiho_goddess:  '✨',
  gumiho_archmage: '🔮', celestial_fairy: '🧚',
  gumiho_demon:    '😈',
  // ── Ch6 산신족 ────────────────────────────────────────────────────────────
  deer_god:              '🦌', bear_god:           '🐻',
  mountain_spirit_boy:   '⛩️', phoenix:            '🦅',
  thousand_pine:         '🌲', mountain_spirit:    '⛩️',
  mountain_god_complete: '🌄',
  // ── Ch6 해신족 ────────────────────────────────────────────────────────────
  sea_dragon_archer:   '🏹', jellyfish_sorcerer:   '🪼',
  sea_general:         '🐡', sea_witch:            '🧜',
  shark_warrior:       '🦈', kraken_soldier:       '🦑',
  dragon_king_guardian:'🐉', sea_god_complete:     '👑',
  // ── Ch6 저승족 ────────────────────────────────────────────────────────────
  skeleton_knight:    '💀', soul_guardian:      '💀',
  underworld_archer:  '🏹', underworld_witch:   '🧙',
  hell_guard:         '⛩️', yomra_warrior:      '👺',
  ghost_king:         '👑', spirit_summoner:    '📿',
  underworld_complete:'🌟',
  // ── Ch6 탈족 ──────────────────────────────────────────────────────────────
  mask_archer:          '🎭', bongsan_maskman:       '🎭',
  cheoyong_warrior:     '🎭', mask_wizard:           '🎭',
  thunder_mask_warrior: '⚡', glacier_warrior:       '❄️',
  great_mask_god:       '🎭', mask_complete:         '🌟',
  // ── Ch6 달빛족 ────────────────────────────────────────────────────────────
  moonlight_rabbit:       '🐇', starlight_fairy:       '🌟',
  crescent_archer:        '🌙', moonlight_tiger:       '🐯',
  galaxy_warrior:         '🌌', full_moon_sorcerer:    '🌕',
  solar_eclipse_warrior:  '🌑', lunar_eclipse_mage:    '🌒',
  moonlight_complete:     '✨',
  // ── Ch6 용족 ──────────────────────────────────────────────────────────────
  red_dragon_warrior:   '🔴', blue_dragon_guardian:  '🔵',
  gold_dragon_sage:     '🟡', black_dragon_assassin: '⚫',
  white_dragon_healer:  '⚪', blue_dragon_archmage:  '🐲',
  banya_guardian:       '🔱', dragon_avatar:         '🐉',
  twilight_dragon:      '🐲', five_dragon_complete:  '🌟',
  // ── Sea / Celestial additions ─────────────────────────────────────────────
  tide_leviathan:       '🐳', empyrean_sovereign:    '🌌',
};

export const MONSTER_NAME: Record<string, string> = {
  // ── Ch1 ─────────────────────────────────────────────────────────────────
  dokkaebi_warrior: '도깨비 전사', dokkaebi_junior: '막내 도깨비',
  village_archer:   '마을 궁수',   gold_turtle:     '황금 거북',
  fire_dokkaebi:    '화염 도깨비', sage:            '신선 도인',
  // ── Ch2 ─────────────────────────────────────────────────────────────────
  gumiho_guardian:  '구미호 수호자', white_tiger:   '백호 검사',
  frost_spirit:     '빙결 산령',    fox_shaman:     '여우 무당',
  sea_god_spear:    '해신 창병',    iron_mask:      '철갑 탈',
  // ── Ch3 ─────────────────────────────────────────────────────────────────
  death_messenger:  '저승사자',    thunder_hero:   '벼락 용사',
  ghost_hunter:     '귀신 포수',   mask_dancer:    '탈 춤꾼',
  venom_warrior:    '독사 무사',
  // ── Ch4 ─────────────────────────────────────────────────────────────────
  celestial_dancer:    '천녀 무희', three_legged_crow: '삼족오',
  great_serpent:       '구렁이',    moon_rabbit_sage:  '월토 달인',
  // ── Ch5 ─────────────────────────────────────────────────────────────────
  mountain_god:     '산신',       volcanic_warrior: '화산 전사',
  storm_archer:     '폭풍 궁수',  abyss_mage:       '심연 마법사',
  celestial_healer: '천상 치유사', mask_berserker:  '탈 광전사',
  sea_dragon_lord:  '해룡왕',     fox_spirit_elder: '구미호 장로',
  // ── Ch7 천상족 ────────────────────────────────────────────────────────────
  celestial_guardian: '천상 수호자', sky_archer:       '창공 궁수',
  heaven_mage:        '천계 마법사', solar_warrior:    '태양 전사',
  divine_healer:      '신성 치유자', starlight_knight: '별빛 기사',
  celestial_sage:     '천상 현인',  god_realm_general: '신계 대장군',
  // ── Ch6 도깨비족 ──────────────────────────────────────────────────────────
  thunder_dokkaebi:      '번개 도깨비',   ice_dokkaebi:        '얼음 도깨비',
  healer_dokkaebi:       '치유 도깨비',   dokkaebi_captain:    '도깨비 대장',
  dokkaebi_bomber:       '도깨비 폭격수', dokkaebi_duelist:    '도깨비 쌍검사',
  poison_dokkaebi:       '독 도깨비',     shadow_dokkaebi:     '그림자 도깨비',
  shield_dokkaebi:       '방패 도깨비',   dokkaebi_shaman:     '도깨비 주술사',
  dokkaebi_king:         '도깨비 왕',     storm_dokkaebi:      '폭풍 도깨비',
  gold_dokkaebi:         '황금 도깨비',   fire_dokkaebi_king:  '불꽃 도깨비 왕',
  black_dragon_dokkaebi: '흑룡 도깨비',  dokkaebi_general:    '도깨비 장군',
  dokkaebi_god_king:     '도깨비 신왕',
  // ── Ch6 구미호족 ──────────────────────────────────────────────────────────
  one_tail_fox:    '꼬리 1개 여우', three_tail_fox:  '꼬리 3개 여우',
  five_tail_fox:   '꼬리 5개 여우', spring_gumiho:   '봄 구미호',
  summer_gumiho:   '여름 구미호',   ice_gumiho:      '빙설 구미호',
  thunder_gumiho:  '번개 구미호',   fox_warrior:     '여우 전사',
  gumiho_queen:    '구미호 여왕',   gumiho_goddess:  '구미호 여신',
  gumiho_archmage: '구미호 대마법사', celestial_fairy:'선녀',
  gumiho_demon:    '구미호 악신',
  // ── Ch6 산신족 ────────────────────────────────────────────────────────────
  deer_god:              '사슴 신',     bear_god:           '곰 산신',
  mountain_spirit_boy:   '산신 도령',   phoenix:            '봉황',
  thousand_pine:         '천년 소나무', mountain_spirit:    '산신령',
  mountain_god_complete: '산신 완성체',
  // ── Ch6 해신족 ────────────────────────────────────────────────────────────
  sea_dragon_archer:   '해룡 궁수',    jellyfish_sorcerer: '해파리 술사',
  sea_general:         '용궁 장수',    sea_witch:          '바다 마녀',
  shark_warrior:       '상어 전사',    kraken_soldier:     '크라켄 병사',
  dragon_king_guardian:'용왕 수호자',  sea_god_complete:   '해신 완성체',
  // ── Ch6 저승족 ────────────────────────────────────────────────────────────
  skeleton_knight:    '해골 기사',   soul_guardian:      '영혼 수호자',
  underworld_archer:  '저승 궁수',   underworld_witch:   '저승 마녀',
  hell_guard:         '저승 문지기', yomra_warrior:      '염라 전사',
  ghost_king:         '귀왕',        spirit_summoner:    '망자 소환사',
  underworld_complete:'저승 완성체',
  // ── Ch6 탈족 ──────────────────────────────────────────────────────────────
  mask_archer:          '탈 궁수',         bongsan_maskman:       '봉산 탈꾼',
  cheoyong_warrior:     '처용 전사',       mask_wizard:           '탈 마법사',
  thunder_mask_warrior: '번개 마스크 전사', glacier_warrior:      '빙하 무사',
  great_mask_god:       '대탈 신',         mask_complete:         '탈족 완성체',
  // ── Ch6 달빛족 ────────────────────────────────────────────────────────────
  moonlight_rabbit:       '달빛 토끼',   starlight_fairy:       '별빛 선녀',
  crescent_archer:        '초승달 궁수', moonlight_tiger:       '달빛 호랑이',
  galaxy_warrior:         '은하 무사',   full_moon_sorcerer:    '보름달 술사',
  solar_eclipse_warrior:  '일식 전사',   lunar_eclipse_mage:    '월식 마법사',
  moonlight_complete:     '달빛 완성체',
  // ── Ch6 용족 ──────────────────────────────────────────────────────────────
  red_dragon_warrior:   '적룡 전사',     blue_dragon_guardian:  '청룡 수호자',
  gold_dragon_sage:     '황룡 현자',     black_dragon_assassin: '흑룡 암살자',
  white_dragon_healer:  '백룡 치유사',   blue_dragon_archmage:  '청룡 대마법사',
  banya_guardian:       '반야 수호자',   dragon_avatar:         '용의 화신',
  twilight_dragon:      '황혼룡',        five_dragon_complete:  '오룡 완성체',
  // ── Sea / Celestial additions ─────────────────────────────────────────────
  tide_leviathan:       '심해 거수',      empyrean_sovereign:    '천계 군주',
};
