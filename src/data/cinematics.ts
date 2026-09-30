// ─── Dialogue types ───────────────────────────────────────────────────────────

export interface DialogueLine {
  speaker: string;
  emoji:   string;
  text:    string;
  side:    'left' | 'right';
  pause?:  number;  // extra ms after line before auto-advancing (0 = manual only)
}

export interface CinematicDef {
  id:       string;
  lines:    DialogueLine[];
}

// ─── All cinematic sequences ──────────────────────────────────────────────────

export const CINEMATICS: CinematicDef[] = [
  {
    id: 'ch1_opening',
    lines: [
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '이 산속 깊은 곳... 오래된 던전이 숨쉬고 있다.' },
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '수백 년간 평화로웠던 이곳에 인간들이 탐욕의 눈을 돌리기 시작했다.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '...(으르렁)... 감히 우리 던전을?' },
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '도깨비여. 네가 이 던전의 수호자가 되어야 한다.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '흥! 누가 시키지 않아도 지킨다. 덤벼라, 인간들아!' },
    ],
  },
  {
    id: 'stage5_mid',
    lines: [
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '수호자님... 방패를 든 놈들이 나타났습니다.' },
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '정면 공격은 통하지 않는다. 함정으로 먼저 방패를 깨야 한다.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '크흠... 영혼 덫을 먼저 설치하란 말이군요!' },
    ],
  },
  {
    id: 'stage10_boss_intro',
    lines: [
      { speaker: '도깨비 대왕', emoji: '👹', side: 'left',
        text: '감히... 내 영역까지 쳐들어와?!' },
      { speaker: '도깨비 대왕', emoji: '👹', side: 'left',
        text: '나는 도깨비 대왕이다! 너희 따위에게 지지 않는다!!', pause: 500 },
    ],
  },
  {
    id: 'ch1_clear',
    lines: [
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '훌륭하다, 수호자여. 도깨비 숲을 지켜냈다.' },
      { speaker: '구미호', emoji: '🦊', side: 'right',
        text: '호호... 소문을 들었어요. 강한 던전 수호자가 나타났다고.' },
      { speaker: '구미호', emoji: '🦊', side: 'right',
        text: '저도 함께 싸우고 싶어요. 구미호 계곡으로 와주세요~' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '더 강한 시련이 기다리고 있다. 준비하거라.' },
    ],
  },
  {
    id: 'ch2_opening',
    lines: [
      { speaker: '구미호', emoji: '🦊', side: 'right',
        text: '어서 오세요, 던전 수호자. 이 계곡은 제 영역이에요.' },
      { speaker: '구미호', emoji: '🦊', side: 'right',
        text: '안개 속에 숨어 공격하는 적들이에요. 눈에 보이지 않아도 막아야 해요.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'left',
        text: '...투명한 놈들? 흥, 보이든 안 보이든 두들겨 패면 된다.' },
    ],
  },
  {
    id: 'stage20_boss_intro',
    lines: [
      { speaker: '여우 여왕', emoji: '🦊', side: 'right',
        text: '호호호... 내 영역까지 들어왔군요.' },
      { speaker: '여우 여왕', emoji: '🦊', side: 'right',
        text: '제 꼬리가 몇 개인지 알아요? 아홉 개예요.' },
      { speaker: '여우 여왕', emoji: '🦊', side: 'right',
        text: '당신의 소중한 동료들도... 제 편으로 만들어 드릴게요. 후후후.' },
    ],
  },
  {
    id: 'ch3_opening',
    lines: [
      { speaker: '용왕',   emoji: '🐉', side: 'right',
        text: '...(깊은 바다 속 울림)...' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '조심하거라. 용왕의 해저궁은 다른 법칙으로 움직인다.' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '불꽃은 물속에서 힘을 잃는다. 새로운 전략이 필요하다.' },
    ],
  },
  {
    id: 'dragon_king_boss_intro',
    lines: [
      { speaker: '용왕', emoji: '🐉', side: 'right',
        text: '...감히 내 왕좌까지 왔구나.' },
      { speaker: '용왕', emoji: '🐉', side: 'right',
        text: '이 바다의 모든 것은 내 것이다. 파도도, 심연도, 너희의 목숨도!' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'left',
        text: '바다 따위는 두렵지 않다. 넘어뜨려 주겠다!!', pause: 500 },
    ],
  },
  {
    id: 'ch4_opening',
    lines: [
      { speaker: '저승사자', emoji: '💀', side: 'left',
        text: '이승과 저승의 경계... 여기까지 왔군.' },
      { speaker: '저승사자', emoji: '💀', side: 'left',
        text: '저승왕께서 기다리신다. 살아서 돌아가고 싶다면...' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '겁주지 마라. 우리는 반드시 통과한다.' },
    ],
  },
  {
    id: 'death_emissary_boss_intro',
    lines: [
      { speaker: '저승왕 사자', emoji: '💀', side: 'left',
        text: '...저승의 문은 이미 열렸다.' },
      { speaker: '저승왕 사자', emoji: '💀', side: 'left',
        text: '살아있는 자가 여기까지 오다니. 그 용기, 어리석음과 구분하기 어렵군.' },
      { speaker: '저승왕 사자', emoji: '💀', side: 'left',
        text: '이제 네 영혼도 내 것이 될 것이다.', pause: 500 },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '저승 따위! 우리 던전은 절대 무너지지 않는다!!', pause: 500 },
    ],
  },
  {
    id: 'ch7_opening',
    lines: [
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '...천상계의 문이 열렸다. 이곳은 신들의 영역.' },
      { speaker: '천상 수호자', emoji: '✨', side: 'right',
        text: '당신이 이 땅을 지키는 수호자인가. 우리의 힘이 필요할 것이오.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '천상족이라... 재밌군! 같이 싸워보자고!!' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '하지만 천제(天帝)가 강림한다. 모든 힘을 결집해야 한다.' },
    ],
  },
  {
    id: 'god_emperor_boss_intro',
    lines: [
      { speaker: '천제', emoji: '👼', side: 'left',
        text: '...감히 천상계까지 올라왔구나.' },
      { speaker: '천제', emoji: '👼', side: 'left',
        text: '도깨비, 구미호, 용, 저승, 달빛... 모두를 이겨냈다 해도—' },
      { speaker: '천제', emoji: '👼', side: 'left',
        text: '천상의 뜻은 꺾이지 않는다. 네 던전이 버텨낼 수 있을까?' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '신이든 뭐든 관계없다! 우리 던전은 절대 무너지지 않아!!!', pause: 800 },
    ],
  },
  {
    id: 'ch6_opening',
    lines: [
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '...공허의 왕좌. 세계의 끝이 여기 있다.' },
      { speaker: '구미호', emoji: '🦊', side: 'right',
        text: '이상해요... 이곳의 공기가 제 여우불을 집어삼키려 해요.' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '영원의 황제가 기다리고 있다. 지금까지의 모든 힘을 하나로 모아라.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '흥! 황제든 뭐든 던전을 지키는 건 우리다. 덤벼라!!' },
    ],
  },
  {
    id: 'ch5_opening',
    lines: [
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '마침내... 삼신산에 도달했구나.' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '여기서 지금까지의 모든 힘이 하나로 합쳐진다.' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '삼신 파괴자를 막는다면... 이 던전은 영원히 안전할 것이다.' },
    ],
  },
  {
    id: 'final_boss_intro',
    lines: [
      { speaker: '삼신 파괴자', emoji: '💀', side: 'left',
        text: '...드디어 왔구나.' },
      { speaker: '삼신 파괴자', emoji: '💀', side: 'left',
        text: '도깨비 숲, 구미호 계곡, 용왕 해저궁, 저승 관문...' },
      { speaker: '삼신 파괴자', emoji: '💀', side: 'left',
        text: '모든 것을 이겨냈다고? 그렇다면 나도 전력을 다해야겠군.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '덤벼라!! 우리 던전은 절대 무너지지 않는다!!!', pause: 1000 },
    ],
  },
  {
    id: 'eternal_emperor_boss_intro',
    lines: [
      { speaker: '영원의 황제', emoji: '👑', side: 'left',
        text: '...오랜만이다. 이 공허의 왕좌에 도전자가 나타났군.' },
      { speaker: '영원의 황제', emoji: '👑', side: 'left',
        text: '도깨비 숲, 구미호 계곡, 용왕 해저궁, 저승 관문, 삼신산...' },
      { speaker: '영원의 황제', emoji: '👑', side: 'left',
        text: '모두 이겨냈다고? 하지만 영원은... 결코 꺾이지 않는다.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '영원이라고?! 오늘 그 영원을 끝내주겠다!!!', pause: 800 },
    ],
  },
  {
    id: 'ch8_opening',
    lines: [
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '...심연의 저편. 모든 창조 이전의 공간이다.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '뭔가 다르다... 이건 그냥 강한 게 아니야. 존재 자체가 위협이야.' },
      { speaker: '산신령', emoji: '⛩️', side: 'left',
        text: '원초신이 잠에서 깨어나고 있다. 천계도, 공허도 그 앞에선 먼지에 불과하다.' },
      { speaker: '구미호', emoji: '🦊', side: 'right',
        text: '...그래도 우리의 던전은 여기 있어요. 포기할 수 없잖아요?' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '맞아!! 원초신이든 뭐든—우리 던전은 절대 무너지지 않는다!!!', pause: 800 },
    ],
  },
  {
    id: 'primordial_titan_boss_intro',
    lines: [
      { speaker: '원초신', emoji: '🌑', side: 'left',
        text: '...오랜 잠에서 깨어났다.' },
      { speaker: '원초신', emoji: '🌑', side: 'left',
        text: '천계, 공허, 저승, 삼신산... 모두 나의 꿈속에서 태어난 것들.' },
      { speaker: '원초신', emoji: '🌑', side: 'left',
        text: '그 피조물들을 이겼다고? 그렇다면... 창조주를 상대해 보아라.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '창조주든 뭐든 관계없다!! 이 던전은 우리가 지킨다!!!', pause: 1000 },
    ],
  },
  {
    id: 'game_complete',
    lines: [
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '...해냈구나.' },
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '이 던전을 지킨 수호자여. 네 이름은 영원히 기억될 것이다.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '흥! 당연한 결과지. 우리가 누군데.' },
      { speaker: '구미호',    emoji: '🦊', side: 'right',
        text: '수고하셨어요~ 호호. 이제 좀 쉬어도 되겠네요.' },
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '하지만... 던전의 여정은 끝이 없다. 더 강해져라, 수호자여.' },
    ],
  },
  // ─── Chapter 9: 공허 너머 ──────────────────────────────────────────────────
  {
    id: 'ch9_opening',
    lines: [
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '원초신마저 쓰러뜨렸다... 창조의 끝에 도달한 것이다.' },
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '그러나 창조의 너머에도 무언가가 있다. 모든 것을 삼키는 공허, 그 자체가.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '원초신보다 더한 게 있다고?! 대체 끝이 어디야!' },
      { speaker: '구미호',    emoji: '🦊', side: 'right',
        text: '...여기서 멈추면, 우리 던전도 결국 그 공허에 삼켜질 거예요.' },
      { speaker: '산신령',    emoji: '⛩️', side: 'left',
        text: '공허의 군주가 이미 이쪽을 바라보고 있다. 마지막 여정이다, 수호자여.', pause: 800 },
    ],
  },
  {
    id: 'void_sovereign_boss_intro',
    lines: [
      { speaker: '공허 군주', emoji: '🌌', side: 'left',
        text: '...기어이 여기까지 왔는가. 창조의 잔재여.' },
      { speaker: '공허 군주', emoji: '🌌', side: 'left',
        text: '별도, 신도, 꿈도 — 모든 것은 결국 나의 침묵 속으로 돌아간다.' },
      { speaker: '공허 군주', emoji: '🌌', side: 'left',
        text: '너의 작은 던전 역시 예외는 아니다. 이제, 무(無)로 돌아가라.' },
      { speaker: '도깨비 전사', emoji: '👹', side: 'right',
        text: '웃기지 마라!! 우리 던전은 무가 아니라 — 모두의 전부니까!!' },
      { speaker: '구미호',    emoji: '🦊', side: 'right',
        text: '모두의 마음이 이 안에 있어요. 그게 공허보다 강하다는 걸 보여주죠!!', pause: 1000 },
    ],
  },
];

export function getCinematic(id: string): CinematicDef | undefined {
  return CINEMATICS.find(c => c.id === id);
}

// Stage → cinematic ID mappings (checked on stage entry)
export const STAGE_CINEMATICS: Record<number, string> = {
  1:  'ch1_opening',
  5:  'stage5_mid',
  11: 'ch2_opening',
  21: 'ch3_opening',
  32: 'dragon_king_boss_intro',
  33: 'ch4_opening',
  42: 'death_emissary_boss_intro',
  43: 'ch5_opening',
  52: 'final_boss_intro',
  53: 'ch6_opening',
  62: 'eternal_emperor_boss_intro',
  63: 'ch7_opening',
  72: 'god_emperor_boss_intro',
  73: 'ch8_opening',
  80: 'primordial_titan_boss_intro',
  81: 'ch9_opening',
  90: 'void_sovereign_boss_intro',
};
