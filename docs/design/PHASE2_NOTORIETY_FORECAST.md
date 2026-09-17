# Phase 2 구현 스펙 — 침입 예보(하루 카드) + 명성(악명)

> 2026-09-17 작성. `GAME_DESIGN_BENCHMARK.md` §4.1(P1)·§4.5(P5)의 구현 계약.
> 옵션 B(홈 던전 단일화, `65f6d7c`→`a0d71be`) 위에서만 성립한다: 예보 카드로 오는
> 손님은 **홈 던전이 그대로** 맞는다. 라벨은 벤치마크 문서와 같다([FACT]/[DRAFT]).
>
> 원칙: pure transaction(`*Transactions.ts`) → 테스트 → 씬. `GameState` 직접 변형
> 금지. 새 축을 늘리지 않고 기존 일일·주간·홈 침입을 카드 하나로 **흡수**한다.

---

## 0. 한 줄

홈에 들어오면 **오늘의 손님 3장**이 있고, 하나를 고르면 누가 오는지 보이며, 제작·배치로
대비한 뒤 막으면 **명성**이 오르고, 명성이 오르면 다음 날 더 부유하고 더 위험한 손님이
온다. 카드 3장을 다 쓰면 오늘 할 일이 끝난다.

---

## 1. 데이터 모델

### 1.1 `GameState` 추가 필드 (`wisdom.ts`, 마이그레이션 기본값 포함)

```ts
notoriety: number;                 // 명성 포인트, 기본 0
notorietyTier: number;             // 1..10, 플레이어가 "간판을 올려" 승인한 티어. 기본 1
notorietyWeekStart: string;        // 주간 정산 주의 월요일 YYYY-MM-DD, 기본 ''
forecast: {
  date: string;                    // YYYY-MM-DD, 카드가 발급된 날
  cards: ForecastCard[];           // 오늘 발급된 카드(최대 3)
  taken: string[];                 // 오늘 선택·처리한 cardId
};
```

기존 `dailyDungeonCompleted / dailyChallenges / weeklyBoss*` 필드는 **유지**(마이그레이션
비용 0). 카드 시스템이 그 값들을 읽고 쓴다.

### 1.2 `ForecastCard` (`forecast.ts`, 순수 정의)

```ts
type ForecastKind = 'raid' | 'elite' | 'merchant' | 'pilgrim' | 'treasure' | 'weekly_boss' | 'daily_rule';

interface ForecastCard {
  id: string;                      // `${date}-${index}`
  kind: ForecastKind;
  title: string;                   // "국경 순찰대", "탐욕의 상인단" …
  bandTier: number;                // 편성을 뽑은 명성 밴드
  waves?: WaveSpec[];              // 전투형 카드만. 홈 침입과 같은 인라인 형식
  dungeonHp?: number;              // 전투형 카드만
  preview: {                       // "누가 오는가" — battleForecast·invaderTraits 재사용
    invaderTypes: InvaderType[];
    traitBlurbs: string[];         // getTraitBlurb
    resistHint?: string;           // Phase 3 함정 콤보용 자리(지금은 undefined)
  };
  reward: { gold?: number; gems?: number; soulCrystals?: number; materials?: Record<string, number>; notoriety: number };
  dailyRule?: DailyRule;           // 'daily_rule' 카드
  weeklyBoss?: WeeklyBoss;         // 'weekly_boss' 카드
}
```

### 1.3 명성 밴드 (`notoriety.ts`) — [DRAFT]

침입자 38종을 `hp×speed/640`(지속 DPS 임계) 기준으로 밴드에 배치한다. 보스급
(단일 페이즈 유닛)은 밴드의 `boss` 슬롯에만 들어간다. 무한 전용(`endlessOnly`)은
카드에 쓰지 않는다.

| 티어 | 임계 범위 | 잡몹 풀 | 보스 슬롯 | 전리품 배수 |
| --- | --- | --- | --- | --- |
| 1 | ≤ 13 | peasant, soldier | knight | 1.0 |
| 2 | ≤ 18 | + shaman, high_priest, scarecrow_mage, trap_breaker, shadow_ninja, holy_paladin, siege_soldier, berserker | knight | 1.15 |
| 3 | ≤ 24 | + knight, venom_dancer, mercenary_captain | iron_golem | 1.3 |
| 4 | ≤ 30 | + iron_golem, fox_spirit, undying_knight | fox_queen | 1.5 |
| 5 | ≤ 40 | + void_assassin, swarm_spawn, mirror_knight | void_assassin_elite | 1.75 |
| 6 | ≤ 50 | + void_assassin_elite, undying_warrior, void_invader, swarm_larva | dragon_king | 2.0 |
| 7 | ≤ 60 | + plague_herald, celestial_knight, void_colossus, divine_archer, celestial_crusader | death_emissary | 2.4 |
| 8 | ≤ 75 | + shadow_wraith, void_soldier, radiant_seraph | titan_sentinel | 2.9 |
| 9 | ≤ 100 | + titan_sentinel, heaven_general, sky_titan, primordial_guard | celestial_dragon | 3.5 |
| 10 | 무제한 | + abyss_berserker, abyss_reaver | eternal_emperor / three_god_destroyer / god_emperor / primordial_titan 순환 | 4.5 |

밴드 `n`의 일반 침입(`raid`)은 밴드 n 풀에서, 정예(`elite`)는 밴드 n 풀 + 보스 슬롯
1기. 밴드 n의 카드는 티어 n의 홈이 `campaignPacing`의 `expectedHome`으로 이길 수
있어야 한다(가드 §5).

**명성 포인트 → 티어 승격 조건.** 티어 n→n+1은 `notoriety ≥ TIER_THRESHOLD[n]`
(기하급수, [DRAFT] 100·250·500·900·1500·2400·3600·5200·7500)이고, **자동이 아니다**:
홈에서 "간판을 올린다"를 눌러 승인한다(§4.1 ⑤ 리스크 대응). 내리는 것도 가능(비용 0,
명성 포인트 −20%).

**명성 획득/감소.**

| 사건 | 변화 |
| --- | --- |
| 카드 전투 승리 | `+ card.reward.notoriety` (raid 10·elite 25·weekly_boss 40, 무피해 +50%) |
| 카드 전투 패배 | `− 10%` 현재 포인트 |
| 캠페인 스테이지 최초 클리어 | `+ 5 × chapter` |
| 7일 미접속 | 일당 `− 5%` (티어 하한은 유지 — 승인한 티어는 내려가지 않음) |

### 1.4 주간 정산 (`notoriety.ts`)

월요일 첫 접속에 지난 주 티어 기준 보석 `tier × 30` 지급 + 부족 조각 없음(P4).
`notorietyWeekStart`로 멱등. `attendance.ts`의 일자 헬퍼(`getTodayString`,
`getThisWeekMonday`) 재사용.

---

## 2. 카드 발급 규칙 (`forecastTransactions.ts`)

`issueForecast(state, today, rng)` — 하루 첫 접속(`forecast.date !== today`)에 3장 발급.

1. 카드 1: 항상 `raid` (밴드 = 현재 티어).
2. 카드 2: `elite` 60% / `raid`(밴드 +1, 전리품 1단계 위) 40%.
3. 카드 3: 특수. 가중 추첨 — `merchant` 30(골드 판매 이벤트: 보유 재료 → 골드, 전투 없음)
   · `pilgrim` 25(영혼수정, 짧은 전투 4웨이브) · `treasure` 15(보석 50~100, 정예급 전투)
   · `daily_rule` 30(기존 `getDailyDungeon()` 규칙 4종 재사용).
4. 주간 보스: **월요일 카드 3은 항상 `weekly_boss`**(기존 `getWeeklyBoss()`).
   `weeklyBossHpDealt` 누적 로직 유지.
5. RNG는 `dayIndex`로 시드(기존 `seededShuffle`) — 같은 날 재접속해도 같은 카드.

`takeForecastCard(state, cardId)`:
- 전투형 → registry에 `{ stageConfig: { waves, dungeonHp, chapter: bandTier }, returnTo: 'DungeonHomeScene', forecastCardId }` 를 **호출자가** 세팅(트랜잭션은 `taken`만 갱신, 씬 전이는 UI).
- `merchant` → 즉시 정산(재료 → 골드), `taken` 갱신.

`settleForecastBattle(state, cardId, result: BattleReturnResult)`:
- `applyBattleReturnSettlement`(기존) 후 명성·카드 보상 적용. `daily_rule`/`weekly_boss` 카드는
  기존 `applyClearRewards`의 daily/weekly 분기를 그대로 태운다.
- 하루 카드 3장 모두 `taken` → `forecast.exhausted` 파생값(저장 안 함) → 홈 directive
  "오늘의 손님을 모두 맞았습니다 · 내일 다시".

`navigationContract.ts`에 `forecastCardId` 필드와 `'forecast-return'` 오퍼레이션
(consume: `forecastCardId, battleResult, returnTo`) 추가 — 심연 `abyss-return`과 같은
패턴, 테스트 동일.

---

## 3. 씬·UI 접점

| 표면 | 변경 |
| --- | --- |
| `DungeonHomeScene` / `HomeCommandDeck` | 카드 패널 3장(가로). 각 카드: 종류 아이콘·제목·밴드 티어·"누가 오는가" 2줄(`invaderTraits`)·보상. 탭 → 확인 모달 → 전투. 44px 히트. |
| `HomeChrome` 상단 레일 | 명성 티어 + 포인트 바. 승격 가능 시 "간판 올리기" 버튼(확인 모달: "더 강한 손님이 옵니다"). |
| `homeReadinessDirective.ts` | directive 소스 추가: 카드 미선택 → "오늘의 손님 고르기", 모두 처리 → "내일 다시". 우선순위는 기존 danger(파손 방) 아래. |
| `DailyContentPanel` | 일일 던전·주간 보스 진입 버튼 **제거**(카드가 대체). 일일 도전(`dailyChallenges`)은 유지하되 패널 이름을 "오늘의 기록"으로. |
| `PreBattleScene` | 카드 전투도 기존 `invasionConfig` 경로처럼 `stageConfig` 인라인으로 진입 — 변경 없음. |
| `battleResultCallout.ts` | 카드 결과 콜아웃("명성 +25 · 티어 3 승격 가능"). |

`DESIGN.md`의 Dungeon Home 계약(월드 65% 노출, 단일 directive, 4구역 셸)을 지킨다:
카드 패널은 기존 command deck 자리(56px 플레이트)를 **대체**하는 접이식 트레이로,
펼쳤을 때만 3장이 보인다.

---

## 4. 통폐합 (벤치마크 §4.6 실행분)

- `daily.ts`의 `getDailyDungeon()`·`getWeeklyBoss()`는 카드 생성기의 **입력**으로
  남기고 진입점만 닫는다. 일일 규칙 4종·주간 보스 풀 데이터 재사용.
- 장식 세트(`decorations.ts`) 보너스에 `notorietyGainPct` 추가(세트 `bounty` = 명성
  +10%) — 장식이 운영 축에 붙는 첫 걸음. 운영 수익 통합(§4.1 ③)과 근무(④)는 Phase 3.

---

## 5. 테스트

- `notoriety.test.ts`: 밴드 전수(모든 비-무한 침입자가 정확히 한 밴드), 승격 임계 단조,
  승인 없이는 티어 불변, 패배 −10%, 미접속 감소는 티어 하한 유지, 주간 정산 멱등.
- `forecastTransactions.test.ts`: 같은 날 재발급 없음, 월요일 카드3 = 주간 보스, 3장 소진
  후 `exhausted`, `takeForecastCard` 불변성, `settleForecastBattle`이 `applyBattleReturn
  Settlement`와 합성됨(골드/XP 이중 지급 없음).
- **밴드 가드** `notorietyBands.test.ts`: 티어 n의 `raid`/`elite` 편성을 `campaignPacing.
  expectedHome(stageFor(n))`로 `simulateDungeon` → 승률 ≥ 60, 여유 ≥ 1.3. `stageFor(n)` =
  티어별 기준 스테이지 [DRAFT] `[1, 8, 16, 26, 36, 46, 56, 66, 76, 86]`.
- `navigationContract.test.ts`: `forecast-return` 소비 필드.
- organic: `verify-forecast-playthrough.mjs` — 카드 발급 → raid 선택 → 실전 → 귀환 정산 →
  명성 증가·잔여 레지스트리 0. `verify-abyss-playthrough.mjs` 복제.

---

## 6. 순서 (커밋 단위)

1. **2a** `notoriety.ts` + `forecast.ts` 정의·밴드·테스트 (데이터만, 씬 없음)
2. **2b** `forecastTransactions.ts` + `GameState` 필드·마이그레이션 + navigationContract
3. **2c** 홈 카드 트레이 + 명성 레일 + directive + DailyContentPanel 진입점 제거
4. **2d** 정산 콜아웃 + 밴드 가드 + organic 하니스 + 문서(`CLAUDE.md`, 핸드오프)

각 단계 tsc·전체 테스트·모달 하니스(카드 트레이·승격 모달 2케이스 추가).
