# Codex 인계 — 결함 스윕 후속 작업

작업 경로는 `/Users/sungjin/dev/personal/dungeon md/dungeon-phaser` 이다. 다른 sibling
prototype이 아니라 이 Phaser/Vite/Capacitor app에서만 작업한다. 워크트리
`dungeon-phaser-p2`가 있고 현재 main과 같은 커밋(`6aa18ba`)이다.

시작 전에 `CLAUDE.md`(게임 시스템 계약)와 `docs/design/AGENT_HANDOFF.md`(구현 기록)를
읽는다. 이 문서는 그 둘을 대체하지 않고, **지금 열려 있는 작업만** 넘긴다.

---

## 0. 지금까지의 맥락 한 문단

전 시스템을 세 가지 결함 클래스로 훑는 스윕을 돌려 47건을 찾고 34건이 3렌즈 반박을
통과했다. 그 34건을 2차로 재심사(산술 재계산 → 의도 탐색 → 분모 확인)해 17건을 결함으로
확정했고, 그중 **17건을 수정**했다. 2건은 직접 검증 후 **기각**했다(뒤에 이유 기록).
4건은 **설계 판단이 필요해 보류**했다. 남은 것은 아래 §2·§3이다.

세 가지 결함 클래스는 이 리포지토리에서 실제로 반복 확인된 모양이다:

| 클래스 | 정의 | 대표 사례 |
|---|---|---|
| **A 눈먼 하니스** | 검증됐다고 기록된 시스템인데 하니스가 구조적으로 대상을 볼 수 없음 | 심연 하니스가 `highestFloor: 0` 고정이라 60층 중 1층만 검증 가능했음 |
| **B 포화·역전 곡선** | 성장 레버가 상한에 닿은 뒤 여러 단계가 하나로 붕괴하거나 뒤집힘 | 심연 26~45층이 동일 전투 하나, 최심부가 중층부보다 약했음 |
| **C 지어낸 표시값** | 플레이어에게 보여주는 숫자가 설명 대상과 독립적으로 계산됨 | 심연 권장 전투력 406,632 vs 실제로는 26층보다 가벼운 웨이브 |

---

## 1. 이 작업에서 반복해서 값을 낸 규칙 (그대로 따를 것)

이건 스타일 선호가 아니라 **이번에 실제로 결함을 잡았거나, 안 지켜서 헛일을 한** 규칙들이다.

1. **에이전트/보고서 결과를 액면 그대로 받지 않는다.** 확정 34건 중 2건은 직접 확인에서
   기각됐다. 커밋 전에 파일을 열고 수치를 재계산한다.

2. **결함이라 부르기 전에 의도를 찾는다.** 옆의 `*.test.ts`, 주석, `CLAUDE.md`,
   `git log -S '<snippet>'`. 형태를 고정하는 증거가 있으면 이상해 보여도 설계다.
   (3티어 함정 건이 이 검사로 기각됐다 — `traps.test.ts`가 "tier N = N종"을 이미 고정.)

3. **분모를 의심한다.** 두 값을 비교한다면 애초에 비교 가능한가? 슬롯당 vs 제작당,
   웨이브당 vs 런당, 표시 vs 전달, 재고 제약 vs 슬롯 제약.

4. **가드는 결함이 있는 축을 봐야 한다.** 이번에 세 번 틀렸다:
   - 일일 도전: 처음 쓴 가드가 `applyDailyChallengeTick`을 직접 불렀다 — 그 함수는 원래도
     정상이었고 없던 건 **호출부**라 수정 전에도 통과했을 것이다.
   - 스토리 침입: 관용도 가드가 헬퍼를 직접 불러 배선을 못 봤다. 생성된 스테이지에서
     읽도록 고치자 실패 건수가 1 → 2로 늘고 메시지가 구체화됐다.
   - **반드시 확인할 것**: 수정을 임시로 되돌려 새 가드가 **실제로 실패하는지** 본다.
     실패하지 않으면 그 가드는 무가치하다.

5. **Phaser 결합 모듈은 유닛 테스트가 안 된다.** 순수 판단부를 분리한다. 기존 선례:
   `spawnDefResolve.ts`, 이번에 추가한 `waveEventMults.ts`, `waveDailyChallengeTicks`,
   `endlessDungeonHp`, `storyInvasionDungeonHp`.

6. **수치가 아니라 게이트를 의심한다.** 모델 입력을 고쳐도 격차가 남으면 다음 질문은
   "플레이어가 쓸 자원은 있는데 쓸 곳이 잠겨 있나"다. (Ch1 5~7 lean이 1/5 승이던 원인은
   밸런스 수치가 아니라 방 레벨 Lv2가 DM5까지 잠겨 있던 것이었다.)

7. **주는 것을 보여준다.** 표시값이 틀렸으면 두 표를 동기화하지 말고 **표를 하나로**
   만든다. 청사진(광고 네임스페이스 삭제), 상인 카드(`merchantPayout` 단일화),
   스테이지 보상(`stageLootPotential` 재사용)이 전부 이 처방이다.

8. **구현할 수 없으면 최소한 팔지는 않는다.** 각성 고유 패시브 30종과 미구현 장비 효과
   12종은 구현하지 않았지만, 구매 화면이 그걸 약속하는 것은 멈췄다.

### 검증 명령

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

organic 하니스는 dev 서버가 필요하다. **동시에 두 개 이상 돌리지 말 것** — 머신 경합으로
headless chromium 컨텍스트가 죽는다(이번에 한 번 날렸다).

```bash
npm run dev    # :8083
WEB_AUDIT_HEADLESS=1 node scripts/verify-campaign-pacing.mjs      # 캠페인 페이싱
WEB_AUDIT_HEADLESS=1 node scripts/verify-abyss-playthrough.mjs    # 심연 (ABYSS_FLOOR=N)
WEB_AUDIT_HEADLESS=1 node scripts/verify-endless-endurance.mjs    # 무한 내구
WEB_AUDIT_HEADLESS=1 node scripts/verify-modal-states.mjs         # 모달/터치 타깃
```

커밋은 요청받을 때만. Opsera 게이트가 있어 `git commit` 직전에 별도 호출로
`touch /tmp/.opsera-pre-commit-scan-passed`가 필요하다. 커밋 메시지에 attribution 금지.

---

## 2. 후속 결함 — 2026-09-21 로컬 수정·검증 완료 (원래 심각도 순)

> **현재 상태:** 2-1~2-7 수정·검증 완료. 재계산, 사용자 결정, 검증·반증과 남은 범위는 §8 참조.
> 아래 항목은 수정 전 원인 기록이다. §3-1은 후속 승인·구현 완료(§10), §3-2는 12건 구현 완료(§11·§12), §3-3은 방 전력 성장 곡선 수정 완료(§13), §3-4는 초과 슬롯 HP 전환으로 수정 완료(§14)다.

전부 2차 심사에서 **REAL_DEFECT · MAJOR · confidence high**로 확정된 건이다. 다만
§1.1대로 **착수 전 직접 재확인**한다.

### 2-1. 시설 근무가 방치 수익에 투자할수록 순손실이 된다 (동작, B)

`src/data/production.ts` · `src/data/idleIncome.ts` · `src/data/productionTransactions.ts`

`assignFacilityStaff`가 수호자를 방에서 빼는데(`monsterIds[idx] = undefined`),
`dungeonGoldPerMin`이 배치 수호자 수로 수익을 세므로 근무는 방 수익을 **잃는다**.

- **이득은 상한**: `(STAFF_AFFINITY_MULT−1) 0.5 × baseRatePerHour 100 × maxLevel 5 ×
  (1 + idleProductionPct ≤ 1.15)` = 최대 287.5 골드/시, 영구히.
- **비용은 무상한**: `IDLE_PER_GUARDIAN 1.5 × (1 + 0.04×dmLevel) × wisdom idleIncomeMult
  (≤1.5) × 60 × (1 + idleGoldPct ≤ 1.45)`.
- 교차점: 지혜·장식 없이 dmLevel 44.4 / `goldHands` 티어5면 21.3 / +`bounty` 3세트면 17.6 /
  +`abyssal`까지면 11.7. dm30 풀스택에서 −1012.03 vs +675.63 = **순 −336.40/시**.

**착수 전 확인할 것**: 위 수치를 직접 재계산하고, 재료 시설(광산·약초원·직조실·마력우물)도
같이 본다 — 2차 심사는 그것들이 `MERCHANT_BUYS` 가격 기준 시간당 34.5 골드로 **어느
구간에서도 손익분기를 넘지 못한다**고 보고했다.

**주의**: 이건 밸런스 축이다. 심연 게이트 때처럼 **수치인지 구조인지** 먼저 가른다.
구조라면(이득에만 상한이 있는 비대칭) 상한을 푸는 쪽이 맞고, 수치라면 사용자 판단이 필요하다.

### 2-2. 방치 보상 패널의 분당 수익이 총액과 어긋난다 (표시, C)

`src/data/idleIncome.ts` `computeIdleReward`의 `ratePerMin`이 명성 배수와 장식 세트
배수를 **제외한** 값인데, 같은 패널의 총액은 그 둘을 적용한다. 플레이어가 받은 금액을
분당 수치로 역산할 수 없다.

### 2-3. 생산 구역의 시간당 수치가 배수를 누락한다 (표시, C)

`src/scenes/ProductionScene.ts`의 `보물고/시간`·`재료/시간`·`현재 생산` 행이
`facilityRatePerHour`를 쓰는데, 실제 수령은 장식 생산 보너스와 명성 배수를 적용한다.
2-2와 같은 뿌리이므로 **한 번에** 처리하는 게 맞다 — `merchantPayout`처럼 수령 계산을
순수 함수로 빼서 표시가 그걸 읽게 한다.

### 2-4. DM 레벨업 오버레이가 일어나지 않은 슬롯 해금을 알린다 (표시, C)

`src/data/invasionTransactions.ts`. 오버레이가 `getUnlockedSlots(prev)`와
`getUnlockedSlots(next)`를 비교하는데 실제 슬롯 수는 `getUnlockedSlotCount(state)`로
지혜 트리 `ancestorsWisdom` 티어를 더하고 9에서 잘린다. 이미 9면 "슬롯 해금"이라고
알리고 아무것도 주지 않는다.

**참고**: `c792579`에서 같은 상호작용을 다뤘다(`wisdomBranchInertReason`). 재사용 가능.

### 2-5. celestialBlood 라벨이 지급 주기를 오해시킨다 (표시, C)

`src/data/wisdom.ts`. 라벨은 영혼 결정을 `웨이브 클리어 시` 준다고 하는데
`crystalPerWave`는 **스테이지 클리어마다 1회** 지급된다. 10웨이브 스테이지면 라벨이
암시하는 양의 1/10이다.

**판단 필요**: 라벨을 고칠지(지급이 맞음) 지급을 고칠지(라벨이 맞음). 노드 가격과
다른 지혜 노드의 수익률을 같이 봐야 한다.

### 2-6. ENEMY_THREAT_SCORE가 26종 중 8종만 덮어 권장 DEF가 거꾸로 간다 (표시, C)

`src/ui/PreBattleShared.ts`. 미등재 타입은 0점이라 후반 챕터 침입자로 채운 웨이브가
초반 웨이브보다 덜 위협적으로 읽힌다. **스토리가 어려워질수록 권장 방어력이 떨어진다.**

**주의**: 심연 `recommendedPower`와 같은 부류다 — 표를 채우는 것보다 **실제 웨이브에서
파생**하는 쪽이 맞는지 먼저 본다.

### 2-7. `skin_all` 업적 목표가 13인데 스킨은 17종 (표시, MINOR)

`src/data/achievementData.ts`. 텍스트도 "13종 수집"이라 한다. `SKIN_DATA`에서 파생하면
끝난다.

---

## 3. 설계 판단 항목 (3-1~3-4 구현 완료)

**2026-09-22 위임 갱신:** 사용자가 §3의 사전 결정 조건을 너무 엄격하게 적용하지
말고 개발을 이어가도록 요청했다. 기존 방향 안의 세부 수치·범위·검증은 담당자가
판단해 진행한다. 진행 구조·보상 경제 등 중요한 방향 변경만 사용자 판단을 구한다.
아래 원인 기록은 유지하며 완료 계약은 §10~§12를 따른다.

### 3-1. 종족 시너지 `spdMult`가 한 필드에 세 의미를 담고 있다

> 2026-09-22 설명 기준 분리·구현을 사용자 승인 후 완료했다. 아래는 원인 기록이며 최신 계약·검증은 §10 참조.

`src/data/synergy.ts`. 설명을 보면:

```
구미호  0.90  "침략자 속도 -10%"    ← 침략자 이동
해신    0.85  "침략자 속도 -15%"    ← 침략자 이동
탈      1.15  "ATK/SPD +15%"       ← 수호자 공격속도
달빛    1.20  "쿨다운 -20%"         ← 수호자 쿨다운 (>1이 빨라짐)
```

`getSynergySpdMult`가 이걸 전부 곱한다 — 0.90 × 1.20 = 1.08에 아무 의미가 없다.
`atkMult`는 `6947a09`에서 전투에 배선했지만 **`spdMult`는 일부러 배선하지 않았다**:
배선하면 *빠진 효과*가 아니라 **틀린 효과**를 출하하게 된다. 코드에 이유를 남겨 뒀다.

필드를 쪼개려면 9부족 × 4티어 데이터 변경이고, 각 티어가 어느 의미였는지 재확정해야 한다.

### 3-2. 미구현 장비 효과 12종

`9bdf4b8`에서 청사진 광고 네임스페이스를 삭제해 **없는 효과를 광고하는 것은 멈췄다.**
남은 질문은 이 12종을 구현할지다: 피해 감소 · 보스 추가 피해 · 성스러운 피해 · 광역 ·
인접 ATK · 천상 ATK · 공속 · 마법 부스트 등. 별도 기능 단위다.

**2026-09-22 사전 대조 (구현 결정 대기):** `9bdf4b8` 직전 청사진의 삭제된
`stats`와 현재 `EQUIPMENT_STATS`를 대조했다. 기존 기록의 “12종”은 정확히는
**11개 장비에 걸친 누락 12건 / 효과 유형 8가지**다.

| 효과 유형 | 누락 건수 | 과거 데이터 |
|---|---:|---|
| 방 피해 감소 | 4 | 영혼 법의 15%, 신성 방패 25%, 광석 흉갑 10%, 심연 갑옷 30% |
| 보스 추가 피해 | 2 | 용아검 25%, 보스 부적 40% |
| 기본공격 속도 | 1 | 월석 목걸이 +20% |
| 주기 광역 공격 | 1 | 천상의 검 매 5번째 공격; 피해량·면역·추가 발동 규칙 미정 |
| 인접 방 ATK | 1 | 수호자의 왕관 +25%; 인접·중첩 범위 미정 |
| 성스러운 피해 | 1 | 천상의 창 +20%; 피해 속성과 면역 관계 미정 |
| 천상족 ATK | 1 | 신성 방패 +20%; 착용자/주변/전체 범위 미정 |
| 마법 강화 | 1 | 마법 핵심 `magicBoost: 1`; 배율인지 기능 플래그인지 근거 없음 |

**사용자에게 제시한 권고 범위:** 우선 앞의 3유형·7건을 구현한다. 피해 감소는
장착 방에 적용하고 같은 방의 최대값만 사용하며 코어는 제외한다. 보스 피해는
장착자의 기본공격에 적용하고 미니·주간 보스를 포함한다. 공격속도는 장착자의
기본공격 간격을 1.2로 나누며 기존 시너지와 합성한다. 주/추가 슬롯, 표시·실제
동작, 회귀·브라우저·연결 무효화 검증을 함께 다룬다. 기존 능력치·제작 비용은
유지한다(월석 목걸이의 현재 스킬 쿨다운 -20%도 유지). 나머지 5건은 설계 확정
전 보류한다. **이후 사용자 “전부 진행” 요청으로 앞의 7건을 구현했다. 나머지 5건의
구체 규칙은 당시 선택 질문으로 제시했다. 이후 사용자의 판단 위임에 따라 5건도
구현했다. 최신 계약·검증은 §12 참조.**

### 3-3. 전력 지표의 방 레벨 항이 선형인데 전투는 지수다

> 2026-09-22 비교 전력 의미를 유지하고 레벨 성장 곡선을 수정했다. 아래는 원인 기록이며 최신 계약·검증은 §13 참조.

`src/data/dungeonMetrics.ts`의 `levelBonus = (roomBasePower + typeBonus) × (roomLevel−1) × 0.1`
vs 전투의 `1.4^(level−1)`. Lv5에서 표시 +40% / 실제 +284%.

단순 표시 문제가 아니다 — `reinforcementRecommendations.ts:340`의 `getGrowthScore`가
`estimatedPowerDelta`를 **성장 추천 랭킹**에 그대로 더하므로, 고레벨 방의 성장이
과소평가된다.

지수로 바꾸면 게임의 **모든 전력 표시**가 바뀌고 `dungeonMetrics.test.ts`가 현재 공식을
고정한다. 전력이 *피해 예측치*냐 *준비도 휴리스틱*이냐의 결정이 먼저다.

### 3-4. 선조의 지혜(145 크리스탈)가 DM8부터 영구히 0슬롯

> 2026-09-22 초과 슬롯을 HP로 전환해 효용을 보완했다. 아래는 원인 기록이며 최신 계약·검증은 §14 참조.

측정: DM5에서 티어1/3/5가 +1/+3/+3, DM7에서 +1/+1/+1, **DM8부터 전부 0**. 그리고
`startPrestige`가 `stageProgress`·`dungeonSlots`는 리셋하지만 **`dmLevel`은 리셋하지
않는다**(spread에 남는다) — 한 번 DM8에 닿으면 이후 모든 프레스티지에서 영구히 0이다.

`c792579`에서 **팔지 않게** 했다(지혜 트리가 "다음 · 추가 방 슬롯 +3" 대신 무효 사유를
경고색으로 표시). 근본 수정은 셋 다 대가가 크다:

| 방법 | 대가 |
|---|---|
| `MAX_DUNGEON_SLOTS` 상향 | 3×3 홈 보드 레이아웃이 깨짐 |
| 프레스티지가 `dmLevel` 리셋 | 진행 구조 재설계 |
| DM 슬롯 곡선 하향 | **이번에 실측한 18스테이지 페이싱 표가 무효화됨** |

---

## 4. 직접 검증 후 기각한 것 (다시 열지 말 것)

### 4-1. "3티어 함정 융합이 순수 하향"

두 가지가 틀렸다. (a) 출력을 소비한 두 입력의 **합**과 비교했는데 그 둘은 슬롯을 두 개
먹는다. 슬롯당으로 보면 3티어 15~19 vs 2티어 13이고 9슬롯 총합은 171 vs 117로 3티어가
유리하다. (b) "콤보 단계 상실"은 설계다 — `traps.test.ts`가 *"six tier-1 singles, six
tier-2 pairs, four tier-3 triples"* 로 **티어 N = N종**을 고정하고, 콤보 상한 4는 단일
함정이 아니라 **다른 방 함정과의 조합**으로 닿게 한 것이다.

### 4-2. "소환 확률 패널이 실제 풀과 무관한 상수표를 표시"

핵심 주장이 재현되지 않는다. `SummonScene`과 `summonTransactions`가 **같은 모듈에서 같은
상수**(`RARITY_RATES`)를 import하고 같은 `RARITIES` 인덱스로 쓴다. 두 번째 표가 없다.
(이 발견이 의존하던 `unlockStage` 풀 게이트는 `695efc4`에서 이미 제거됐다.)

---

## 5. 무한 코어 사망 검증 — 2026-09-22 완료

**현재 상태:** 아래 미검증 경로를 후속 실행했고 네 어서션 모두 통과했다.
실행 조건·보정 3회·근거는 §9에 기록했다. 아래는 최초 인계 시점의 배경과 재현 명령이다.

`scripts/verify-endless-endurance.mjs`의 **코어 사망 경로 어서션 4건이 아직 실행된 적이
없다**: 결과 씬 개방 / `endlessResult` 레지스트리 존재 / 결과 웨이브 == 실제 주행 웨이브 /
`isNewRecord`. 마지막 클린 주행이 상한(웨이브 16)에 걸려 살아서 끝났기 때문이다.
감사 파일에 "assertions did not execute" note를 남기도록 해 뒀다.

```bash
npm run dev
ENDLESS_WAVE_CAP=40 ENDLESS_BUDGET=220 WEB_AUDIT_HEADLESS=1 \
  node scripts/verify-endless-endurance.mjs
```

**단독으로** 돌린다(§1 검증 명령 주의 참조). 약 45~60분. 세 번째 어서션(결과 화면의
웨이브가 실제 주행과 같은가)이 이 하니스의 존재 이유다 — 기존 하니스는 그 값을 직접
주입해서 채웠다.

---

## 6. 아트 (사용자 쪽, GPT images)

코드 작업이 아니다. 핸드오프 문서가 준비돼 있다:

- `docs/design/CHARACTER_ART_CODEX_HANDOFF.md` — 캐릭터 127종
- `docs/design/TRAP_ART_CODEX_HANDOFF.md` — 함정 16종 + 상태이상 아이콘 6종

에셋이 도착하면 런타임 로더 배선은 코드 쪽에서 잇는다. 부족별 계보 트리 그림과 배치
트레이 함정 스트립 아트도 이 슬라이스로 남아 있다.

---

## 7. 이번 세션 커밋 (참고)

```
6aa18ba test: 무한 내구 organic 하니스
e55821f test: 네 번째 "모드가 코어를 안 실음"을 미리 막는 가드
a2907df fix: 스토리 침입 10건이 전부 코어 800에서 싸움 (같은 결함 3번째)
c792579 fix: 선조의 지혜가 DM8부터 영구히 0슬롯인데 계속 팔림
3b96f0c fix: 일일 도전 59종 중 50종이 완료 불가
fd73266 fix: 표시 골드 두 곳이 실제 지급과 다름 + 주간 보스 테스트 시한폭탄
88a07f5 fix: 전력 지표가 교감·흡수·각성을 전부 못 봄
d9f35f8 fix: 무한 마일스톤 둘이 같은 웨이브 일반 개체보다 약함
cbdf105 fix: 명성 티어를 올리면 정예 카드가 쉬워지던 역전
a89b96a fix: 각성과 흡수가 전투에 아무것도 전달하지 않음 (유료 no-op)
9bdf4b8 fix: 청사진 광고와 실제 장비가 24종 중 19종에서 다름
6947a09 fix: 종족 시너지 ATK가 전투에 전혀 안 들어감 (31개 티어 사문화)
6ba9bd7 fix: 무한이 Ch1 S1의 코어 1,500을 상속 (같은 결함 2번째)
9c0a1bc fix: complete_stage 진행도 합산으로 메인 퀘스트가 재플레이 파밍됨
edb916b fix: 웨이브 이벤트가 자기 웨이브에 도달 못 함 (13종 중 11종 무효)
695efc4 fix: 소환 풀 unlockStage 게이트 제거 (스테이지 1 클리어가 가차 파괴)
```

기준: tsc 통과 · vitest **3,031 pass** · `npm run build` 통과 · 워크트리 깨끗 ·
`main`과 `dungeon-phaser-p2` 동일 커밋.

## 8. §2 후속 수정 기록 — 2026-09-21

작업 기준: `main@6e4e905`의 current worktree. 기존 `.gitignore`, `AGENTS.md`,
`.claudeignore`, `.codex/` 변경을 보존했다. 아래 결과는 로컬 수정·검증이며
commit/stage/push/배포는 하지 않았다. §3 네 항목과 §4 기각 건은 변경하지 않았다.

### 재확인과 구현

| 항목 | 확인한 원인과 최종 변경 |
|---|---|
| 2-1 | 손익분기 DM 44.444 / 21.296 / 17.593 / 11.718을 재계산했다. DM30·지혜5·풍요3·심연3·명성10에서 잃던 운영 골드 1,012.0275/h, 보물고 추가 이득 675.625/h, 순손실 336.4025/h. 재료 4종도 적성·Lv5·생산 +15%의 추가분을 `MERCHANT_BUYS`로 환산하면 각각 34.5골드/h. 구조 수정으로 **근무자도 수호자 운영 수익을 유지**하고 같은 DM·지혜·장식·명성 배수를 받는다. 시설 산출/가격/상한, 방어·근무 배타성은 유지한다. 정상 건설된 시설의 근무자만 세며 방·시설 간 중복도 더하지 않는다. |
| 2-2·2-3 | `facilityIncomeRatePerHour`가 근무·생산 장식·골드 전용 명성 배수를 적용한다. 지급과 생산 화면의 레일/타일/현재/다음 단계가 이 계산을 공유한다. 방치 `ratePerMin`은 운영+보물고 총 골드이며 패널도 `총 … 황금/분`으로 표시한다. 지급은 수입원별 최종 내림, 재료는 종류별 내림이다. |
| 2-4 | 실제 결함 위치는 `HomeResultOverlays.ts`. 이미 `HomeLifecycle`에 있는 **정산 전후** `BattleReturnGrowthContext`를 전달한다. 지혜 포함 9슬롯 캡과 다중 레벨업을 반영하며 별도 슬롯 공식을 만들지 않았다. |
| 2-5 | 사용자 결정: **지급 유지·라벨 수정**. 천계의 혈통 총 가격 200 / 최대 +5는 기본 배수에서 40회 클리어 회수; 결정 공명 120 / 기본 보상 +5는 24회다. 웨이브 지급 변경의 경제 확대를 피하고 지혜 노드·전투 토스트를 스테이지 클리어로 정정했다. `crystalPerWave` 필드명은 호환성을 위해 유지하고 주석을 바로잡았다. |
| 2-6 | 미등재 점수는 문서의 0이 아니라 **24 fallback**이었다. 그래도 천상 기사 5체의 표시 66이 방패기사 5체 77보다 낮아 역전이 재현됐다. 점수표를 제거하고 `buildStoryInvasionTarget`의 실제 스폰 HP에서 파생한다. 첫 농민병 기준 14점과 기존 웨이브 가중/0.55 배율을 유지한다. 마지막 `INV-009`는 957 → 12,223. 전체 방어력 공식이나 §3-3 성장 점수는 변경하지 않았다. |
| 2-7 | `skin_all` 목표와 설명을 `SKIN_DATA.length`(현재 17)에서 파생했다. 이미 해금된 업적은 다시 지급하지 않는 기존 규칙을 유지한다. |

**정수 처리 영향:** 보물고는 예전의 `floor(floor(생산량) × 명성)` 대신 모든 배수를
적용한 뒤 한 번 내린다. 따라서 명성 10티어에서는 이전보다 수령당 최대 3골드가
늘 수 있다. 총 분당 원시 수치 × 인정 시간과 지급 총액의 차이는 두 수입원의
내림 때문에 2골드 미만이다. 화면은 분당 한 자리 소수로 반올림한다.

### 검증과 반증

- `npx tsc --noEmit`: 통과.
- `npx vitest run`: **127 파일 / 3,065 테스트 통과**.
- `npm run build`: 통과. 기존 Vite 500kB chunk advisory는 남아 있다.
- `git diff --check`: 통과.
- `WEB_AUDIT_HEADLESS=1 node scripts/verify-defect-sweep.mjs`: 생산 현재/다음 단계,
  방치 총액/분당, 슬롯 캡·부분 해금·다중 레벨업, 후반 침입 권장 DEF, 지혜 토스트를
  **7개 경우 모두 통과**. fresh browser save와 390×844 화면으로 확인했다.
  생산/방치/슬롯/후반 DEF 캡처를 직접 검수했다.
- 브라우저 근거: `output/playwright/defect-sweep/audit.json` 및 같은 폴더의 PNG,
  `checks.json`과 typecheck/vitest/build 로그. JSON에 소스/캡처 SHA-256 기록.
- **수정 무효화 검사:** 자기 변경만 임시 변경 후 `finally`에서 원문 복원했다.
  §2-1 20건, §2-2 1건, §2-3 수령 계산 2건, §2-5 노드 1건, §2-6 10건,
  §2-7 1건의 assertion 실패를 확인했다. 브라우저에서도 §2-3의 예전 씬 배선,
  §2-4의 DM-only 슬롯 공식(캡/다중 레벨업), §2-5의 예전 토스트를 되살린 네 경우
  모두 assertion이 실패했다. 근거: `output/playwright/defect-sweep-mutations/`.
- 하니스 초기 실패는 레벨업 오버레이의 생성/등장 전에 클릭한 것이었다. 실제 생성과
  표시 완료를 기다리도록 수정했다. 소스 무효화 중에는 다른 브라우저 하니스를
  병행하지 않았으며, 최종 통과는 복원된 소스에서 확인했다.
- `graphify` 실행 파일 부재로 query/update는 검증 불가. 코드·Git 이력으로 조사했다.

**남은 범위:** §3은 사용자 결정 전 미착수. §5 무한 코어 사망 organic 장기 주행은
이번 §2 요청 범위 밖으로 미실행이며 기존 미검증 상태를 유지한다. 권장 DEF는 실제
웨이브 HP에 근거한 준비도 휴리스틱이며 organic 승률이나 §3-3 전력 정의 검증을
대체하지 않는다. 네이티브·운영 저장 데이터·외부 배포는 이번 검증에 포함하지 않았다.


## 9. §5 코어 사망 경로 후속 검증 — 2026-09-22

사용자의 다음 스텝 진행 요청에 따라 §5를 단독 실행했다. §3 설계 4건은 사용자
결정 전 미착수 상태를 유지한다. 이번 후속에서 게임 런타임은 변경하지 않았으며,
장기 실행을 관찰할 수 있도록 `verify-endless-endurance.mjs`에 진행 로그만 추가했다.
§8의 §5 미실행 표기는 2026-09-21 당시 상태이며, 이 기록이 최신 검증 결과다.

```bash
ENDLESS_WAVE_CAP=40 ENDLESS_BUDGET=220 WEB_AUDIT_HEADLESS=1 \
  node scripts/verify-endless-endurance.mjs
```

- `main@6e4e905` 위 §2 수정이 있는 worktree에서 실행. 소요 **1,595.1초(26분 35초)**,
  exit 0, `runs: 1`, `hardFailures: 0`. 브라우저 console/runtime 오류 없음.
- 기존 9개 Lv5 방·Lv40 수호자·DM40 fixture와 최고 기록 0에서 시작했다.
  강제 지정 없이 `golden` 변수가 선택됐다(HP ×1.2, 개체 수 ×1.1, 속도 ×1.05,
  보상 ×1.8). **17웨이브에서 코어 HP 0/1,500**, 해당 웨이브 70/220 slices로 종료했다.
- 사망 경로 네 어서션 모두 실행·통과: `EndlessResultScene` 개방,
  `endlessResult` 존재, 결과 웨이브와 주행 웨이브 **17 일치**, `isNewRecord: true`
  (`previousBest: 0`). 결과는 114처치·19,304골드·3결정이다.
- 1·5·12웨이브 probe의 개체 수 6·7·8이 예상과 일치했고 스케일 불일치나
  baseline 하락은 없었다. 결과 PNG를 직접 열어 17웨이브·신기록·보상 표시를 확인했다.
- **검증 한계:** 2·4·6웨이브에서 빈 스폰 큐/생존 적 0인데 웨이브가 닫히지 않아
  기존 하니스의 `checkWaveEnd` 호출 및 종료 보정이 총 3회 적용됐다. 7~17웨이브에는
  이 보정이 없었다. 따라서 완전 무개입 플레이나 모든 변수의 밸런스 검증으로
  일반화하지 않는다. 결과 웨이브와 결과 레지스트리를 직접 주입하지는 않았다.
- `node --check scripts/verify-endless-endurance.mjs`: 통과.
  `npm test`: **127 파일 / 3,065 테스트 통과**. 이번 후속은 런타임 변경이 없어
  build는 재실행하지 않았다(§8의 통과 결과 유지).
- 감사 데이터의 6개 소스 SHA-256을 현재 파일과 대조해 모두 일치함을 확인했다.

근거:

- `tools/endless-endurance-audit.json`
  (SHA-256 `3fb174f0570a3f9e28e7b6d73e21af0b43102ccccb2aef1a226bc7a7c02f73fa`).
- `tools/screenshots/endless-endurance.png`: 실제 결과 화면.
- `output/playwright/endless-endurance-followup/`: `run.log`, `exit.json`,
  `death-path-verification.json`, `vitest.log`. 기존 감사 파일과 PNG는
  `before-endless-endurance-audit.json`, `before-endless-endurance.png`로 보존했다.

모두 로컬 검증이다. 기존 dirty 변경은 보존했으며 stage/commit/push/배포는 하지 않았다.


## 10. §3-1 시너지 속도 의미 분리 — 2026-09-22

사용자가 설명 기준 분리·구현 권고에 대해 “좋아 이어서 개발 작업 진행하자”로
진행을 승인했다. §3-1만 구현했으며 §3-2 장비 효과, §3-3 전력 정의,
§3-4 선조의 지혜는 별도 결정 전 미착수다. 이전 §8·§9의 §3 미착수 기록은 당시 상태다.

### 적용 계약

- 구미호 4체·해신 4체: `invaderMoveMult` 0.90 / 0.85. 침략자 스폰 정의의
  이동 속도에 웨이브·일일 변수와 곱한 뒤 기존 규칙대로 정수 반올림한다.
  동시에 활성화되면 ×0.765이며, 보스·추가 소환도 같은 spawn 경로를 사용한다.
  일시적인 상태이상 타이머가 아니라 기본 이동 속도에 적용하는 보너스다.
- 탈 4체: `guardianAttackSpeedMult` 1.15. 전원 기본공격 간격을 1.15로 나눈다.
- 달빛 2/4체: `guardianCooldownMult` 0.90 / 0.80. 전원 기본공격 간격과
  액티브 스킬 재사용 시간을 10% / 20% 줄인다. 탈과 달빛 4체가 함께 활성화되면
  기본공격 간격은 `기존 간격 × 0.8 ÷ 1.15`다. 적 둔화는 이 계산에 섞이지 않는다.
- 기본공격은 주 슬롯·추가 슬롯 양쪽에 적용한다. 액티브는 방 팝업·HUD 타기팅
  양쪽에 장비 `skillCdMult`와 함께 적용한다. 기존 전투 배속 계산은 유지한다.
  팝업 준비 시간, HUD ready-at/진행 링, 방 공격 링은 실제 적용 간격을 사용한다.
- 최고 티어 하나만 적용하는 기존 규칙을 유지한다. 따라서 6/8체에 명시되지 않은
  하위 속도 효과를 누적하지 않는다. 수호자 없는 방·함정의 공격 간격과 주기형
  패시브 타이머는 변경하지 않았다. 시너지 설명에 적용 대상을 명시하고 긴 설명은
  모바일 화면 안에서 줄바꿈하도록 했다.
- 정적 시너지 카탈로그와 전투 계산 변경이다. 저장 데이터 migration이나 가격 변경은 없다.

### 검증

- `npx tsc --noEmit`: 통과.
- `npx vitest run src/data/synergy.test.ts src/combat/roomMechanics.test.ts src/combat/spawnPipeline.test.ts`:
  **3 파일 / 131 테스트 통과**. 독립 축 합성, 9부족 36티어 선택, 추가 슬롯 타이밍,
  주간 보스 HP 계약과 이동 속도 합성을 검증했다.
- `npm test`: **127 파일 / 3,111 테스트 통과**.
- `npm run build`: 통과. 기존 500kB 초과 chunk advisory는 남아 있다.
- `WEB_AUDIT_HEADLESS=1 node scripts/verify-synergy-timing.mjs`: **7개 live Phaser fixture 통과**.
  무시너지, 구미호+달빛, 해신, 탈+달빛, 달빛 2체, 구미호+해신, 달빛 6체를 확인했다.
  실제 spawn adapter와 이동 tween 시간, 공격 직전/직후 경계, 추가 슬롯, 빈 방 제외,
  씬이 전달하는 공격 링 간격, 1/3배속 스킬 팝업·HUD 입력 경로와 실제 쿨다운을 검사했다.
  툴팁 화면 경계도 검사했으며 무시너지·구미호+달빛 캡처를 직접 검수했다.
- 예시: 궁수 기본 간격 1,333ms → 탈+달빛에서 약 927.304ms. 강타 기본 8초에
  장비 ×0.75와 달빛 ×0.8 적용 시 1배속 4.8초 / 3배속 1.6초로 두 사용 경로와 HUD가 일치했다.
- **연결 무효화 검사:** `SynergyManager`의 이동·공격 간격·스킬 쿨다운 getter를
  각각 일시적으로 중립값 1로 바꿨다. 실제 이동 55≠47, 공격 경계 미발생,
  스킬 6,000≠5,400ms로 해당 브라우저 검사가 각각 실패했다. 매회 원문 복원 후
  최종 13개 소스 SHA-256이 정상 통과 audit과 모두 일치함을 확인했다.
- `git diff --check` 및 하니스 `node --check`: 통과.
- `graphify` 실행 파일 부재로 update는 검증 불가. 전역 설치는 하지 않았다.

근거: `scripts/verify-synergy-timing.mjs`,
`output/playwright/synergy-timing/`의 `audit.json`, `checks.json`, `run.log`, PNG,
`vitest.log`, `build.log`; 실패 탐지·복원 근거는
`output/playwright/synergy-timing-mutations/checks.json`과 각 하위 폴더의 audit/log다.

**범위와 한계:** 전투 배선·타이밍·표시의 로컬 회귀 검증이다. 미적용이던 보너스가
활성화되므로 해당 편성의 전투력과 스킬 사용 빈도가 높아진다. 캠페인 전체 승률·경제
재조정이나 native 검증은 하지 않았다. §5 장기 주행은 이번 시너지 변경 전의 근거이며
새 버전의 장기 밸런스 검증으로 재사용하지 않는다. 기존 dirty 변경을 보존했고
stage/commit/push/배포는 하지 않았다.


## 11. 장비 누락 효과 — 2026-09-22, 첫 7/12 구현 시점 기록

> 당시 범위·검증을 보존한 기록이다. 잔여 5건은 후속 구현했으며 최신 상태는 §12를 따른다.

### 범위와 결정

사용자의 “좋아 이어서 전부 진행해보자”를 §3-2 장비 12건 진행 요청으로 해석했다.
이미 제시한 7건의 수치·범위는 구현했다. 과거 데이터만으로 결정할 수 없는 나머지
5건은 최초의 “§3은 사용자 결정 없이 착수하지 않는다” 조건에 따라 구체안을 제시한
상태다. **§3-2 전체 완료가 아니며 §3-3 전력 정의·§3-4 슬롯 설계는 미착수다.**

### 구현 계약

- 영혼 법의/신성 방패/광석 흉갑/심연 갑옷은 현재 장착자가 있는 방의 피해를
  15/25/10/30% 줄인다. 주·추가 슬롯 중 최대값만 사용한다. 구조 HP 피해는
  소수점을 유지하며 돌파·반사로 인한 영속 슬롯 내구도는 감소 적용 후 한 번 ceil한다.
  코어 HP는 보호하지 않는다. 전투 배치에서 제외되거나 교체된 장착자의 기존 방에
  효과가 남지 않도록 현재 배치 IDs를 읽는다. 저장된 원래 배치는 바꾸지 않는다.
- 심판·삼신 독 홍수는 공통 `Room.damageRoomHp`로 전달한다. 구조 HP의 데이터와
  표시를 함께 갱신하며 회복도 동일하게 동기화한다. 영속 내구도와 전투 구조 HP는
  기존 별도 체계를 유지한다.
- 용아검/보스 부적은 장착자의 기본공격에 보스·미니보스 피해 +25/+40%를 준다.
  주간 보스의 기존 isBoss 플래그도 포함한다. 기본공격 대체인 유령 화살·회오리는
  각 피격 대상별로 적용해 같은 광역의 일반 적에게 보스 보너스가 번지지 않는다.
  별도 액티브·주기 패시브·연쇄 추가타에는 새 보스 보너스를 붙이지 않는다.
- 월석 목걸이는 기본공격 간격을 1.2로 나눈다. 기존 스킬 쿨다운 -20%는 유지한다.
  주·추가 슬롯 및 공격 링에 적용하며 기존 시너지·배속 계산과 합성한다.
- 추가 슬롯에서 기존 장비 ATK가 빠지던 경로도 연결했다. 장비 ID/비용/기존 수치는
  유지한다. 전력·제작 추천 점수의 재정의(§3-3)는 포함하지 않는다.
- 제작 확인·보관함·막사 상세는 현재 `getEquipmentStats`를 공통 라벨로 표시한다.
  과거 제작 snapshot에도 신규 효과가 표시되며 저장 migration은 필요하지 않다.
  칩 폭은 실제 텍스트 너비로 계산한다.
- 독립 코드 검토에서 수호자 교체가 `monsterSlot`만 바꾸고 `monsterSlots[0]`을
  남기는 문제를 확인했다. 양쪽 첫 슬롯을 동기화하고 추가 슬롯을 보존했다.

### 잔여 5건 — 제안만, 런타임 미구현

한 번의 선택 질문으로 다음 안을 제시했다. 응답 전 구현하지 않는다.

1. 천상의 검: 기본공격 5회마다 살아 있는 적 전체에 해당 기본 피해 50% 추가;
   재발동/상태이상 없이 기존 면역 적용.
2. 수호자의 왕관: 상하좌우 인접 방 수호자 ATK +25%; 같은 효과 중첩 없음.
3. 천상의 창: 기본공격에 마법 속성 추가 피해 +20%; 기존 마법 면역 적용.
4. 신성 방패: 배치된 천상족 전체 ATK +20%; 같은 효과 중첩 없음.
5. 마법 핵심: 마법형 수호자 기본공격 피해 +20%로 명확화.
   과거 `magicBoost: 1`을 근거 없이 +100%로 해석하지 않는다.

### 검증 근거

- `npx tsc --noEmit`: 통과. 이후 최종 `npm run build`의 tsc도 통과.
- `npx vitest run`: **130 파일 / 3,137 테스트 통과**.
- `npm run build`: 통과. 기존 500kB chunk advisory 유지.
- `WEB_AUDIT_HEADLESS=1 node scripts/verify-equipment-effects.mjs`:
  **52 검사 통과**, browser errors 0. 실제 저장→장비 map, 주/추가 슬롯 보스 피해,
  1/3배속 기본공격 경계·링, 유령 화살/회오리의 대상별 보너스, 방어구 4종,
  중첩·회복·심판 HP, 영속 내구도, 배치 제외, 코어 제외, 교체 후 효과 이동,
  제작 확인·과거 보관함·막사 설명을 검증했다. 공방 4개 캡처를 직접 확인했다.
- 최종 audit의 **21개 소스 SHA-256 일치**, 연결 무효화 5건 탐지·복원.
- `git diff --check`, `node --check scripts/verify-equipment-effects.mjs`: 통과.

실행 결과는 `output/playwright/equipment-effects/`의 audit, run/build/vitest 로그와
PNG에 저장한다. `scripts/verify-equipment-effects.mjs`는 고립된 저장 상태와 실제
Phaser scene/adapters를 사용한다. 캠페인 승률·경제 밸런스·native 검증이 아니다.

연결 무효화는 `output/playwright/equipment-mutations/mutate.py`로 보스 기본공격,
주 슬롯 공속, 방 구조 피해 감소, 추가 슬롯 장비 map, 교체 첫 슬롯 동기화 5곳을
각각 제거했다. 모두 실제 브라우저 assertion 실패를 탐지했고 원문을 복원했다.
각 실패·원문 SHA-256은 같은 폴더 `checks.json`과 하위 audit/log에 기록했다.
초기 하니스의 Math.random 고정은 Phaser texture UUID를 중복시켰으므로 제거했다.
이것은 하니스 오류이며 제품 코드의 난수/renderer를 변경하지 않았다.

기존 dirty 변경을 보존했다. Git stage/commit/push 및 배포는 수행하지 않았다.
`graphify` 실행 파일이 없어 graph update는 실행하지 못했다.


## 12. 장비 누락 효과 12/12 구현 — 2026-09-22 후속

### 위임과 구현 계약

사용자가 “§3은 사용자 결정 없이 착수하지 않는다 이 조건을 너무 타이트하게
보지는 말자”라고 요청했다. 앞서 제시한 5건의 세부 규칙을 담당자가 확정해 구현했다.
§3-2의 11개 장비에 걸친 누락 효과 12건을 모두 연결했다. 비용·장비 ID·기존 기본
능력치와 저장 형식은 유지하며 신규 효과도 과거 제작 snapshot 대신 현재 정의를 읽는다.

| 장비 | 확정한 동작 |
|---|---|
| 천상의 검 | 피해를 주는 기본공격 매 5회마다 살아 있는 적 전체에 기본 피해 50% 추가. 카운터는 착용자별이며 교체 시 유지, 웨이브 시작 시 초기화한다. |
| 수호자의 왕관 | 상하좌우 인접 방 수호자 ATK +25%. 자기 방·대각선 제외, 같은 효과는 최대값만 적용한다. |
| 천상의 창 | 기본공격에 마법 속성 추가 피해 +20%. 마법 면역을 적용한다. |
| 신성 방패 | 살아 있는 배치 방의 장착자가 천상족 수호자 전체에 ATK +20%. 같은 효과는 최대값만 적용한다. |
| 마법 핵심 | 마법형 수호자의 기본 피해 +20%. 모호했던 과거 magicBoost: 1을 +100%로 해석하지 않는다. |

- 주·추가 슬롯 모두 적용하며 오라는 현재 배치와 방 HP를 읽는다. 다른 종류의
  오라는 곱하고 동일 오라는 중첩하지 않는다. 파괴·교체 시 이전 방 효과가 남지 않는다.
- 장비 추가타는 각 대상의 면역·철갑·함정 방어를 적용한다. 대상별 용의 둥지 보스
  배율·빙결 함정 배율이 다른 적에게 번지지 않는다. 추가 상태이상·연쇄 재발동은 없다.
- 유령 화살·회오리 같은 대체 기본공격은 1회로 세며 성스러운 추가 피해는 각 대상에
  적용한다. 처치가 live 배열을 변경해도 다음 대상을 건너뛰지 않는다.
- 추가 슬롯의 마법 기본공격도 영구·시간제 마법 면역을 반영한다. 천상 관통의 기존
  기본공격 규칙과 장비 추가타의 마법 면역 규칙을 구분한다.
- 제작 확인·완료·보관함에서 세 번째 효과가 잘리지 않도록 줄바꿈과 영역을 조정했다.
  왕관·신성 방패 제작 확인/완료 및 보관함 캡처를 직접 확인했다.

### 검증과 제한

- 최종 `npx tsc --noEmit`, `npm run build`, `git diff --check`: 통과.
  기존 500kB chunk advisory는 유지한다.
- 관련 11파일 **125 tests 통과**. 전체 suite는 **131파일 통과·1파일 실패,
  3,160 tests 통과·1 test 실패**였다. 이후 시간제 면역 보완은 관련 검사와 실제
  브라우저 검사 및 최종 build로 검증했다. 전체 suite 성공으로 보고하지 않는다.
- 실패는 변경하지 않은 `endlessWave.test.ts:683`의 마일스톤 난이도 비교다.
  해당 실행에서 10웨이브 HP 3,313이 9웨이브 3,764보다 작았다. 장비 효과를 참조하지
  않는 기존 생성 코드에서 seed 9로 3,342 < 3,394를 재현했다. 생성 코드·침략자
  데이터·해당 테스트는 HEAD와 동일하다. 이 기존 난수 기반 난이도 계약 문제는
  미해결로 남겼으며 assertion이나 생성 밸런스를 변경하지 않았다.
- `scripts/verify-equipment-specials.mjs`: 실제 Phaser 전투 **41검사 통과**.
  주/추가 슬롯, 면역, 중첩, 방 파괴, 대체 기본공격, 대상별 보스 배율, 웨이브 초기화 포함.
- `scripts/verify-equipment-effects.mjs`: 기존 효과와 화면을 합쳐 **59검사 통과**.
  두 브라우저 실행 모두 browser errors 0이며 독립 fixture를 사용했다.
- 신규 기본공격 연결·오라·마법 강화·성스러운 피해·웨이브 카운터 초기화를 각각
  제거한 5건 모두 assertion 실패를 탐지했다. 원문 SHA-256 복원을 확인했다.
- audit의 모든 소스 해시를 현재 파일과 대조했다. 근거는
  `output/playwright/equipment-specials/`의 audit·verification·전체/관련 tests·build 로그,
  `equipment-complete/`의 audit·화면, `equipment-special-mutations/`의 반증 receipt다.
  실제 캠페인 승률·장기 경제 밸런스·native 검증으로 일반화하지 않는다.

당시 다음 순서는 §3-3 전력 지표와 성장 추천의 의미 정합성이었으며 후속 결과는 §13에 기록했다. §3-4는 진행 구조에 영향을
주는 대안을 먼저 비교한다. 둘 다 이번 구현에는 포함하지 않았다. 기존 dirty 변경을
보존했으며 stage/commit/push/배포는 수행하지 않았다. graphify 실행 파일이 없어
해당 graph update는 미실행이다.


## 13. 방 전력 성장 곡선 정합성 — 2026-09-22

§3 세부 판단 위임과 후속 진행 요청에 따라 §3-3을 수정했다. 방 전력은 **배치·장비·
방 유형·내구도를 합산한 비교 점수**로 유지한다. DPS·승률 예측으로 재정의하지 않는다.
기존 구성요소와 가중치, 내구도 할인, 슬롯 충족률인 준비도 %, 전리품 점수는 유지하고
레벨 계수만 선형 `1 + (level−1) × 0.1`에서 `1.4^(level−1)`로 변경했다.

- `rooms.ts:getRoomLevelDamageMult`를 방 전력·주 슬롯 기본공격·추가 슬롯 기본공격·
  기존 범위 공격이 공유한다. 유효한 Lv1~5 전투 피해는 바뀌지 않는다.
- 같은 배치의 전력은 Lv1~5에서 43 / 60 / 84 / 118 / 165다. 이전 Lv5는 60이었다.
  Lv4→5 강화 예상 +47은 실제 변경 후 던전 합계 차이와 일치한다.
- 실제 배치에 대한 성장·장비 미리보기는 기존 `projectRoomReinforcement`를 통해
  같은 계산을 사용한다. 같은 Lv1 도깨비의 Lv2 성장 기여는 Lv1 방 +1, Lv5 방 +4이며
  같은 조건의 성장 추천에서 Lv5 방 수호자가 앞선다. 원본 저장 상태는 변경하지 않는다.
- 이 점수의 레벨 계수는 구성요소 전체의 비교 가중치다. 개별 함정·장비 HP·경제 효과가
  실제 전투에서 모두 같은 배율로 커진다는 뜻은 아니다. 별도 PreBattle DEF 공식,
  수호자 ATK 합계, 시뮬레이션, 장비별 특수효과 평가를 일괄 통합하지 않았다.
  보상·강화 비용·저장 형식·성장 추천의 행동 우선 가중치는 변경하지 않았다.

검증:
- 수정 전 새 회귀 검사에서 5건 실패로 낮게 계산되는 레벨 효과를 재현했다.
- 관련 7파일 139 tests 통과. `npm test`: **133파일 / 3,173 tests 통과**.
- `npm run build`: TypeScript 검사와 번들 통과. 기존 500kB chunk advisory 유지.
- `node scripts/verify-room-power.mjs`: **16검사 통과**, browser errors 0.
  격리 저장 fixture의 점수 합계·성장 순서·막사 전력 88→92 표시를 확인했고,
  실제 Phaser 주/추가 슬롯의 Lv1~5 피해 20/28/39/55/77을 각각 확인했다.
  390×844 막사 캡처를 직접 열어 추천 방 #2와 전력 표시를 검수했다.
- `git diff --check`, `node --check scripts/verify-room-power.mjs` 통과.
  audit 7개 소스 SHA-256 일치. 근거: `output/playwright/room-power/`.

이전 §12의 무한 모드 난수 기반 마일스톤 비교 실패는 이번 실행에서는 발생하지
않았지만 원인을 수정한 것은 아니다. 기존 재현 기록과 미해결 상태를 유지한다.
캠페인 승률·장기 경제·native 검증은 이번 범위에 포함하지 않는다. graphify 실행
파일이 없어 graph update는 미실행이다. 기존 dirty 변경을 보존했고 commit/push/
배포는 하지 않았다. 당시 다음 설계 항목인 §3-4는 후속 완료했다(§14).


## 14. 선조의 지혜 초과 슬롯 효용 — 2026-09-22

후속 진행 요청과 §3 세부 판단 위임에 따라, 보드·DM 성장·프레스티지를 바꾸지 않는
대안을 구현했다. **9칸에 들어가는 지혜 슬롯은 해금하고 초과 슬롯당 던전 최대 HP
+20을 적용한다.** 수치는 기존 강인한 성벽의 등급당 +20과 맞췄다. 기존 총 비용
145와 등급 1~5는 그대로다. 기존 투자와 이후 투자 모두 같은 계산을 사용한다.

| DM / 투자 등급 | 실제 추가 슬롯 | 전환 HP |
|---|---:|---:|
| DM1 / 5 | 5 | 0 |
| DM5 / 5 | 3 | 40 |
| DM7 / 3 | 1 | 40 |
| DM8 이상 / 5 | 0 | 100 |

`getAncestorsWisdomEffect`가 현재 DM 레벨·투자 등급에서 효과를 계산한다.
DM 성장으로 기본 슬롯이 늘면 그만큼 투자 효과가 HP로 전환된다. 저장 필드를
추가하거나 수정·환불·일회성 보상을 지급하지 않는다. 프레스티지는 기존대로
DM과 지혜 투자를 유지하므로 HP 효과도 유지된다.

`getWisdomBonuses.extraSlots`는 실제 추가 슬롯 수이며, 전환 HP는 강인한 성벽과
합쳐 `dungeonMaxHpBonus`로 전달한다. 전투 초기화는 기존대로 요새 HP까지 합한 뒤
장식 배율을 적용한다. 전투 시작 안내도 실제 슬롯·합산 HP를 표시한다.

화면의 현재·다음 효과를 실제 슬롯/HP로 표시하고 비용과 다음 효과를 별도 줄로
배치했다. 기존 무효 경고는 제거했다. 구매 확인 snapshot에 표시 효과를 포함해
확인 중 DM이 올라 슬롯/HP 효과가 바뀌면 수정 차감 없이 재확인하게 한다.

검증:
- 관련 3파일 **110 tests 통과**: DM1/5/7/8/12/40 × 등급0~5, 부분·전체 상한,
  기존 투자·가호 합산·저장/불러오기·프레스티지·145 비용·효과 변경 시 거래 거절.
- `npm test`: **133파일 / 3,182 tests 통과**.
- `npx tsc --noEmit`, `npm run build`: 통과. 기존 500kB chunk advisory 유지.
- `node scripts/verify-wisdom-overflow.mjs`: **15검사 통과**, browser errors 0.
  실제 화면 handler로 DM8의 5단계 구매(145→0)를 수행했고 scene 재진입,
  혼합 슬롯/HP 표시, 확인 중 DM 변경 거절을 확인했다. 실제 전투의 최대 HP가
  1,850→1,950으로 +100 증가했고 프레스티지 후에도 1,950이었다.
  이 fixture는 강인한 성벽 +100·요새 +250·장식 HP 0%를 사용했다.
- 390×844의 구매 전·혼합 효과·확인 modal·최고 등급 캡처를 직접 검수했다.
  `git diff --check`, 하니스 syntax 검사 통과. audit 소스 SHA-256 6개 일치.
- 초기 브라우저 하니스는 기존 250ms 거래 cooldown보다 빨리 눌러 실패했다.
  입력 간격을 350ms로 조정했다. 빈 초기 던전에 배치 방이 있다고 가정한 대기도
  실제 scene/grid 초기화 기준으로 수정했다. 게임 거래 보호나 배치 규칙은 바꾸지 않았다.

근거는 `output/playwright/wisdom-overflow/`의 audit·tests·build·browser 로그와 PNG다.
이번 작업은 기능·저장·화면 연결 검증이며 장기 캠페인 난이도·경제·native 검증은 아니다.
§2와 §3 네 항목의 구현은 완료했다. 별도 미해결은 §12의 무한 모드 난수 기반
마일스톤 HP 비교다. 이번 전체 검사에서는 통과했지만 원인을 수정한 것은 아니다.
기존 dirty 변경 보존, stage/commit/push/배포 없음. graphify 실행 파일 부재로
해당 graph update는 미실행이다.


## 15. 무한 모드 마일스톤 HP 역전 수정 — 2026-09-22

§12에서 확인한 난수 기반 실패를 수정했다. 원인은 일반 적의 무작위 HP 합계가
마일스톤의 추가 적 HP보다 크게 변동하는 것이다. 테스트만 seed 고정으로 통과시키지
않고 실제 실행에서 직전 큐 HP를 전달하도록 변경했다.

- `buildEndlessSpawnQueue`는 직전 HP가 주어진 마일스톤에서 총 HP를 직전 합계의
  **1.12배 올림 이상**으로 보충한다. 기존 웨이브 HP 성장률과 같은 12%를 사용한다.
  부족분은 마일스톤 전용 개체 중 HP가 가장 큰 한 개체에만 더한다. 이미 충분한
  큐와 일반 웨이브는 변경하지 않는다. 공유된 개체 정의는 복제해 이중 보충을 피한다.
- 적 종류·수·속도·보상·등장 간격은 유지한다. HP 상승만으로 보상을 더 지급하지 않는다.
  기존 seed 9의 직전 3,394 / 마일스톤 3,342는 보충 후 마일스톤 3,802가 된다.
- `WaveStart` → `DungeonSceneCtx` → generator로 직전 합계를 전달하고, dispatch로
  큐가 소모되기 전에 새 합계를 기록한다. 일반 웨이브도 기록을 갱신하며 새 실행의
  `DungeonScene.create`에서 0으로 초기화한다. 저장 schema는 변경하지 않는다.
- 적용 기준은 도전 변수 반영 후·웨이브 이벤트 반영 전의 **생성 큐 HP**다.
  웨이브 이벤트, 속도, 특수 능력을 포함한 전술 난이도·DPS·승률을 보장하지 않는다.
  직전 HP 없는 독립 generator 호출은 기존 무작위 생성과 호환된다.

검증:
- 관련 2파일 **95 tests 통과**. 재현 seed 9의 정확한 수치, 일반 웨이브 불변,
  충분한 HP인 마일스톤 불변, 공유 개체 분리, 강한 직전 조합/약한 다음 조합 검증.
- 기본 조건 + 도전 변수 17종 × 고정 seed 32개 × 140웨이브 = **80,640개 큐**를
  연속 생성해 모든 마일스톤의 하한을 검사했다. 기존 비결정적 비교를 이 연속 실행
  검사로 교체했으며 assertion은 직전 초과에서 최소 12% 증가로 강화했다.
- `npm test`: **133파일 / 3,186 tests 통과**.
- `npx tsc --noEmit`, `npm run build`: 통과. 기존 500kB chunk advisory 유지.
- `node scripts/verify-endless-milestones.mjs`: **11검사 통과**, browser errors 0.
  실제 Phaser의 직전 큐 기록/전달, 보충 합계, 실제 스폰 HP·보상, 일반 웨이브 갱신,
  웨이브 상한 거절, 새 실행 초기화를 확인했다. 부족분 경로는 직전 HP 1,000,000을
  주입한 격리 fixture로 1,120,000을 확인했다. organic 장기 주행 검증은 아니다.
- 첫 하니스의 loop 정지/재시작 처리가 scene 재시작을 막아 초기화 대기가 timeout했다.
  한 번의 동기 evaluate 안에서는 loop 정지가 필요 없으므로 이를 제거했다.
  제품의 scene 초기화는 그대로 두고 정상 loop에서 재시작을 검증했다.
- `git diff --check`, 하니스 syntax 검사 통과. audit 소스 SHA-256 7개 일치.
  근거: `output/playwright/endless-milestones/`의 audit·focused/full tests·build·browser 로그.

§12~§14의 간헐 실패 미해결 표시는 당시 상태이며 이 후속으로 해결했다. 앞선 §9
endurance 결과는 그 당시 코드·fixture의 기록으로 유지한다. 이번 변경 후 organic
장기 난이도·native 검증은 하지 않았다. 기존 dirty 변경 보존, commit/push/배포 없음.
graphify 실행 파일 부재로 graph update는 미실행이다.


## 16. 이전 준비 타이머의 새 웨이브 침범 수정 — 2026-09-22

장기 검증을 준비하며 §9의 빈 웨이브 종료 보정을 조사했다. 기존 하니스뿐 아니라
실제 결과 화면의 ‘다음 침입 즉시 시작’도 prepActive/prepTimer만 바꾸고 예약된
준비 tick을 남겼다. 이 tick은 새 전투 중 `enableWaveButton`을 호출하여
`waveHasSpawned=false`로 되돌리고 진행 중 버튼을 다시 활성화했다. 마지막 스폰 후
초기화되면 적이 모두 사라져도 `checkWaveEnd`가 반환하여 다음 단계로 진행하지 못한다.

변경:
- `WaveLifecycle`에서 씬별 준비 타이머의 취소 함수를 관리한다. 새 웨이브 시작,
  방어선 확인, 새 준비로 교체, 정상 완료, 씬 shutdown에서 예약 tick·링·숫자·미리보기·
  상태 문구·shutdown listener를 정리한다. 취소된 tick은 뒤늦게 호출되어도 반환한다.
- `WaveStart`는 웨이브 진입 가드 통과 후 준비 타이머를 취소하고 기존 전투 초기화를
  수행한다. `enableWaveButton` 역시 타이머를 취소한다. 정상 10초 준비 규칙은 유지한다.
- 씬 재진입 검사에서 파괴된 준비 바를 다시 사용하는 결함도 재현했다.
  `DungeonScene.create`에서 countdownBar 참조를 초기화해 실제 표시 객체를 새로 만든다.
- 저장 schema·보상·성장·전투 수치는 변경하지 않는다. 이전 dirty 변경은 보존했다.

검증:
- 수정 전 `scripts/verify-wave-prep.mjs`의 실제 결과 버튼 입력에서 **늦은 스폰 플래그
  초기화 1회**, **prepTimer -1**을 확인했다. `before/`에 코드 사본·audit·화면을 보존했다.
  확장 검사에서는 재진입한 준비 바의 scene이 유효하지 않아 실패했고 `extended-before/`에
  기록했다. 수정 후 같은 검사는 통과한다.
- `npx vitest run src/combat/wavePrep.test.ts src/combat/waveLifecycle.test.ts`: **7 tests 통과**.
  정상 10초 완료·취소 후 플래그 보존·방어선 확인·준비 교체·shutdown·씬별 분리 포함.
- 최종 `npm test`: **134파일 / 3,192 tests 통과**.
- 최종 `npm run build`: TypeScript와 Vite 통과. 기존 500kB chunk advisory 유지.
  초기 테스트 mock의 UI 메서드 누락과 테스트 helper의 Graphics 타입 오류는 수정했다.
- `WAVE_PREP_OUTPUT=output/playwright/wave-prep/final-status node scripts/verify-wave-prep.mjs`:
  **12검사 통과**, browser errors 0. 두 결과 버튼, 늦은 플래그/상태 문구 변경 방지,
  자연 카운트다운, 준비 중 재시작, listener 정리, 유효한 바 재생성을 확인했다.
  두 번째 웨이브는 적/큐를 비운 fixture에서 `checkWaveEnd`와 실제 Phaser clock으로
  결과 처리되는 것을 확인했다. waveActive를 강제로 false로 바꿔 통과시키지 않았다.
- 즉시 시작 회귀는 앱의 `advanceTime`, 나머지 타이머 경계는 실제 Phaser scene clock을
  직접 진행했다. 완료 웨이브와 빈 전장을 주입한 **격리 fixture 검증**이다.
  장기 연속 전투·난이도·native 검증으로 확대하지 않는다.
- 최종 결과/다음 전투 캡처를 직접 검수했다. 표준 web-game client의 Home 상태 수집도
  실행했으나 기존 WebGL canvas export가 검은 이미지여서 시각 근거에서 제외한다.
  화면 근거는 Playwright page screenshot이다. audit 소스 해시 5개와 현재 파일 일치,
  하니스 문법 검사·`git diff --check` 통과.

근거: `output/playwright/wave-prep/`의 before·extended-before·final-status audit/PNG,
focused-tests.log·tests.log·build.log·최종 browser 로그. 기존 §9 endurance receipt는
덮어쓰지 않았다. 이번에는 재현된 진행 정지 결함을 먼저 수정했으며 수정 후 장기 주행은
미실행이다. 과거 세 번의 종료 보정이 모두 이 원인이었다고 단정하지 않는다.
다음 단계는 최신 런타임의 장기 전투 재실행이며, 기존 하니스에 남은 강제 종료 보정이
발생하면 완전 무개입 통과로 해석하지 말고 원인을 재현해야 한다.
commit/push/배포 없음. graphify 실행 파일 부재로 graph update 미실행.

## 17. 최신 런타임의 무한 모드 연속 전투 검증 — 2026-09-22

§16 다음 단계인 연속 전투를 완료했다. 게임 런타임의 최종 변경은 없으며 하니스와
검증 기록만 갱신했다. fixture는 DM40·Lv40 수호자 9명·Lv5 전투실 9개(방 HP400),
장비/함정 없음, 코어 HP1,500, `golden` 도전 변수, 실제 속도 버튼으로 선택한 3배속이다.
한 번에 Chromium 하나만 실행했고 실제 WebGL 렌더링/앱 `advanceTime`을 사용했다.
이 환경은 ANGLE Metal / Apple M5였으며 최종 주행 wall time은 약121초다.

하니스 개선:
- 빈 전투가 끝나지 않으면 상태를 기록하고 실패한다. 이전의 `checkWaveEnd` 재호출과
  `waveActive=false` 강제 보정을 제거했다. 적 제거·코어 HP 변경으로 진행하지 않는다.
- 웨이브 상한 초과 1회를 막고, wave-cap / slice budget / stalled / death를 구분한다.
  코어 사망을 기본 필수로 하여 미완주를 성공 처리하지 않는다. 제한된 smoke만
  `ENDLESS_REQUIRE_DEATH=0`으로 분리할 수 있으며 미완주 사실은 receipt에 남는다.
- 매 웨이브 큐가 소모되기 전 HP 합계를 읽어 실제 기록/다음 전달을 비교하고,
  마일스톤 하한을 검사한다. probe의 count 확인은 난수를 추가 소비하지 않는다.
- 실제 killsThisRun과 goldEarnedThisRun을 결과 payload와 비교하고 수정 보상 산식,
  저장된 최고 기록/영혼 수정, 결과 씬 재진입 후 중복 지급 여부를 검사한다.
- 출력은 실행별 새 디렉터리이며 기존 receipt가 있으면 덮어쓰지 않는다.
  소스·공유 하니스·lockfile 291개 해시를 실행 전후 대조한다.

최종 실행:
```sh
ENDLESS_OUTPUT=output/playwright/endless-continuation/run-02 \
ENDLESS_WAVE_CAP=40 ENDLESS_BUDGET=220 ENDLESS_MODIFIER=golden \
WEB_AUDIT_HEADLESS=0 node scripts/verify-endless-endurance.mjs
```

- **20웨이브 코어 사망**, 51/220 slices, stalls **0**, hardFailures **0**, browser errors **0**.
  완료된 1~19웨이브는 전투 종료 로직으로 정산됐다. 하니스는 완료 화면을 닫고 다음
  웨이브를 시작하므로 수동 플레이 또는 입력 무개입 검증으로 표현하지 않는다.
- 10웨이브: 직전 HP4,159 → 하한4,659 / 실제7,206.
  20웨이브: 직전15,412 → 하한17,262 / 실제26,046. 기록·전달 모두 일치했다.
- 1·5·12웨이브 스폰 probe: 적 수6/7/8, 개체별 HP 배율 일치.
- 결과: **142처치 / 23,938골드 / 영혼 수정6 / 신기록20**.
  저장된 soulCrystals=6, endlessHighScore=20. 결과 씬 CREATE 완료를 기다려 다시
  읽었으며 동일한 지급/기록을 유지했다. 10웨이브와 결과 화면 PNG를 직접 확인했다.
- 최초 run-01도 21웨이브 사망·stalls0·정산 검사를 통과했다. 그러나 하니스가 변수와
  속도를 직접 바꿔 HUD의 초기 표시와 어긋났다. 고정 변수 주입 뒤 HUD 재생성,
  실제 속도 버튼 클릭으로 하니스를 수정하고 run-02를 최종 근거로 삼았다.
  run-01의 당시 하니스 사본·receipt는 보존하며 화면 정합성 근거로 재사용하지 않는다.

실패 검출 확인:
- cap-negative: 2웨이브 상한에서 생존 종료 → `wave-cap`, exit1, 사망 경로 미도달 검출.
- budget-negative: 2 slices에서 종료 → `budget`, exit1, 사망 경로 미도달 검출.
- stall-negative: WaveLifecycle의 정상 종료를 임시로 차단 → 1웨이브에서
  `stalled`, settled=false, exit1. 보정 없이 실패했다. 이 fault는 검증용이며
  finally에서 원문 바이트를 복원했다. 이후 run-02의 **291개 해시 모두 일치**를 확인했다.
- `npm test`: **134파일 / 3,192 tests 통과**. 하니스 syntax·`git diff --check` 통과.
  런타임/의존성/build 설정 최종 변경이 없어 production build는 재실행하지 않았다.
  §16의 build 통과는 당시 기록으로 유지한다.
- 표준 web-game client로 최종 Home 상태 수집을 실행했다. 시각 근거는 위 실제 전투/
  결과의 Playwright page screenshot이다. `tools/endless-endurance-audit.json`의 과거
  receipt와 그 screenshot hash도 유지됨을 확인했다.

근거는 `output/playwright/endless-continuation/`의 run-02 audit/PNG/state, 각 negative
receipt와 negative-checks.json, source-check.json, tests.log다. `check-negative-runs.py`는
fault 주입/복원 절차와 실행 결과를 재현하는 기록이다. 출력 경로가 이미 있으면 새 이름을
사용한다. §9의 세 번의 보정이 모두 같은 원인이었다고 소급 단정하지 않는다.

이 fixture의 전투→사망→저장→결과 재진입 흐름을 검증했다. 전 도전 변수의 승률·경제
밸런스, 수십 분 이상 wall-clock 메모리 지속성, native 실기기 검증은 포함하지 않는다.
§2·§3와 후속 결함 수정 및 이번 연속 전투 범위 완료. 기존 dirty 상태 보존,
commit/push/배포 없음. graphify 실행 파일 부재로 graph update 미실행.

## 18. Production 번들 통합 smoke — 2026-09-22 완료

§17 이후 새 결함을 가정하지 않고, 최근 런타임 변경을 포함한 실제 production 번들의
로딩·화면 이동·저장·전투 진입을 검증했다. `scripts/verify-production-smoke.mjs`는
기존 `scripts/lib/web-audit.mjs`의 좌표/입력/상태 수집을 재사용한다. 브라우저에서
`/src` 모듈을 import하지 않으며, 출력 경로가 이미 사용됐으면 덮어쓰지 않는다.

실행:
1. `npm run build` — 통과. 기존 Phaser 1,478.57 kB chunk advisory만 유지.
2. `npm run preview -- --host 127.0.0.1 --strictPort` — 로컬 8084.
3. `node scripts/verify-production-smoke.mjs` — 최종 **47검사 / 실패0 / 오류0**.
4. `npm test` — **134파일 / 3,192 tests 통과**.
5. `node --check scripts/verify-production-smoke.mjs`, `git diff --check` — 통과.

검증 범위:
- 격리된 Chromium 390×844/DPR2/WebGL. DM8·영혼 수정145·빈 방·10스테이지 클리어
  저장 fixture를 최초 한 번만 주입한다. reload에서는 실제 구매 저장값을 그대로 읽는다.
- production에서 개발용 `?scene=ForgeScene`이 무시되고 Home으로 시작한다.
- 실제 하단 입력으로 Home→Barracks→Forge→StageSelect→Home 이동.
- Summon/Shop/Fusion/Codex/Achievement/Abyss/Production/Decoration/Wisdom은 직접
  scene activation 후 텍스트·입력 렌더링 확인. 이 9개는 사용자 진입 경로 증명이 아니다.
- 실제 Wisdom 탭/노드/승인 입력으로 ancestorsWisdom 0→1, 수정145→140 저장.
  전체 reload 후 유지. StageSelect 카메라를 이동한 뒤 실제 무한 던전 버튼을 클릭하고
  방어 개시와 미리보기 확인 버튼을 눌러 첫 웨이브 진입. 고정 시간 진행을 사용한다.
- `isEndless=true`, wave1, 실제 침입자2명, core HP1520(기본1500+구매20) 확인.
- JS/CSS 응답10개 SHA-256이 로컬 dist 파일과 일치. 개발 모듈 요청0,
  HTTP/요청 실패/console/page error0. index·하니스·공유 helper·PNG 해시도 기록한다.

최종 근거: `output/playwright/production-smoke/2026-09-22T05-09-40.859Z/audit.json`와
PNG, 상위 `build.log`/`tests.log`. `2026-09-22T05-08-44.004Z/`는 43검사 예비 실행이며
최종 근거와 구분한다. 최종 홈·구매 후·무한 진입·전투 캡처를 시각 확인했다.
표준 web-game client도 production에서 1회 실행했다. 알려진 검은 canvas export는
시각 근거에서 제외하고 Playwright page screenshot을 사용한다.

게임 런타임 변경 없음. 이 smoke는 seeded 첫 웨이브 통합 검증으로 native 실기기,
배포, 전체 캠페인/밸런스 검증을 뜻하지 않는다. 이번 owned preview는 종료했다.
§2·§3 및 후속 검증 완료. 기존 dirty 상태 보존, commit/push/배포 없음.
graphify 실행 파일 부재로 graph update 미실행.

## 19. 세이브 백업의 캠페인 진행도 누락 — 2026-09-22 수정 완료

§18 이후 저장 복원 경로를 확인했다. `StageSelectScene`은 `dungeonStageProgress`를
읽지만 `exportGameState`/`importGameState`는 `dungeonGameState`만 처리했다.
새 기기로 복원하면 캠페인이 초기화되고, 진행도가 있는 기기로 복원하면 대상 기기의
별점/해금이 남아 서로 다른 저장 상태가 섞인다. 기존 테스트는 게임 상태만 확인했다.

수정:
- Base64 내부를 `format: dungeon-guardian-save`, `version: 1`, `gameState`,
  `campaignProgress`로 구성. 두 저장소 값을 각각 보존한다. 기존 게임 저장 schema는 유지.
- 기존 flat 코드도 지원. 별도 캠페인 백업이 없는 옛 코드에서는 내장 stageProgress를
  사용하고, 없으면 초기 진행도다. 백업에 없는 기록을 복구하거나 목적지 기록과 합치지 않는다.
- 미지원 버전, 잘못된 진행도 항목을 저장 전에 거절. 캠페인을 먼저 저장하고 게임 상태
  쓰기가 실패하면 캠페인의 기존 raw 값/키 부재를 복원한다. 강제 종료·복구 쓰기까지
  불가능한 저장소 장애에서 두 키의 원자성을 보장하는 transaction 도입은 아니다.
- `stageProgress.ts`의 키 상수를 공유해 저장 위치를 중복 정의하지 않는다.

검증:
- 신규 `saveTransfer.test.ts` 12검사: 새 기기 round-trip, 기존 목적지 교체,
  legacy padding/기록 없음, 손상/미지원 입력, 각 저장소 쓰기 실패와 rollback.
- 최초 검사 7실패 중 2개는 happy-dom localStorage spy의 다음 테스트 오염이었다.
  격리된 global stub/cleanup으로 바로잡았다. 최종 검사를 원래 export/import 함수에
  적용하면 **6실패/6통과, exit1**. 이후 수정 원문을 복원하고 SHA-256 일치 확인.
  `reverted-tests.log`와 `reverted-check.json`이 최종 반증 근거다.
- `npx vitest run src/data/saveTransfer.test.ts src/data/wisdom.test.ts src/data/legacySaveMigration.test.ts`
  **3파일/112 tests 통과**. `npm test` **135파일/3,204 tests 통과**.
- `npm run build` 통과(기존 Phaser chunk advisory). `node --check scripts/verify-save-transfer.mjs`,
  `git diff --check` 통과.
- `node scripts/verify-save-transfer.mjs`: 로컬 production preview에서 **9검사/실패0/오류0**.
  실제 설정 버튼으로 export→다른 저장 fixture→cancel→confirm import→StageSelect→reload
  →잘못된 코드 거절. DM8/골드12345/수정145, 1~10관문 3별·HP87%, 11관문 해금 복원.
  StageSelect의 실제 progress 배열도 확인했다. 확인창·복원된 관문·거절 화면을 시각 확인했다.
  clipboard API만 mock했으며 OS 클립보드나 사용자의 실제 저장은 변경하지 않았다.
- 표준 web-game client production 1회 실행. 검은 canvas export는 확인 후 시각 근거에서 제외.
  page screenshot을 사용한다. `graphify update .` 완료, Gradle3개/SynergyManager1개
  parser 부분 추출 경고는 `graphify.log`에 기록. TypeScript/build 실패는 아니다.

최종 근거 `output/playwright/save-transfer/2026-09-22T06-59-26.991Z/` 및 상위 로그.
신규 백업은 수정된 앱에서 복원해야 한다. 기존 flat 코드 읽기는 유지된다.
실제 OS 클립보드 권한/native 복원·앱 강제 종료 중 원자성은 검증하지 않았다.
이전 production/endurance receipt는 당시 해시 기준으로 보존한다. commit/push/배포 없음.

## 20. 세이브 복원 확인창의 늦은 응답·중복 요청 — 2026-09-22 수정 완료

§19 저장 함수 수정 뒤 호출 UI를 확인했다. `showImportConfirm`은 confirm마다
`clipboard.readText()`를 호출하고, 취소/배경 닫기/부모 설정창 파괴/씬 종료 뒤에도
Promise 응답으로 저장을 덮어썼다. 늦은 거절도 이미 닫힌 화면에 toast를 만들었다.

수정 범위는 `src/ui/ImportExportModal.ts`다. 창이 살아 있는지와 요청 진행 여부를
확인해 한 번만 읽는다. 대기 중 '읽는 중…'을 표시하되 취소는 유지한다. destroy 시
요청 결과를 무효화하고 부모/씬 listener를 해제한다. 성공 후 Home 재시작 예약도
씬 shutdown 시 취소한다. 원래 800ms 대기와 저장 함수/백업 형식은 유지했다.

검증:
- 신규 `ImportExportModal.test.ts` **10 tests**: 확인 연타, 취소/배경/부모/씬 종료 후
  응답, 늦은 거절, 권한 거절, clipboard API 부재, 성공 후 종료, 잘못된 데이터.
  `saveTransfer.test.ts`를 포함한 집중 **22 tests 통과**.
- 수정 전 **8실패/2통과**. 최종 테스트를 원래 모듈로 다시 실행해 같은 8실패를
  확인했다. finally에서 수정 원문을 복원하고 SHA-256 일치를 기록했다.
- 기존 `verify-save-transfer.mjs`를 확장해 production에서 **26검사/실패0/오류0**.
  실제 확인/취소/배경 입력, 부모 destroy와 씬 전환 fixture, clipboard 지연/거절,
  중복 확인을 검증한다. 닫힌 뒤 두 저장소가 그대로이며 씬 전환 뒤 Home으로
  되돌아가지 않는다. 완료된 요청은 골드54321 fixture를 정상 복원한다.
  '읽는 중…'/취소 표시와 복원 후 Home screenshot을 직접 확인했다.
- 첫 `npm test`는 **3,213통과/1 timeout**. 기존 Endless 80,640 큐 계산 검사가
  부하가 높은 실행 중 5초 제한을 넘겼다. 테스트 내용/제한은 변경하지 않았다.
  브라우저를 종료하고 `npm test -- --maxWorkers=2` 실행:
  **136파일/3,214 tests 통과**, 58.79초. 두 로그를 각각 보존한다.
- `npm run build` 통과, 기존 Phaser chunk advisory 유지. syntax/diff 검사 통과.
- 표준 web-game client 1회 실행. 검은 canvas export는 열어 확인 후 제외하고
  page screenshot을 시각 근거로 사용했다. `graphify update .` 완료(기존 네 파일
  parser 부분 추출 경고 유지). 이번에 시작한 preview 서버는 종료했다.

근거 `output/playwright/save-import-lifecycle/run-01/audit.json`과 PNG,
상위 `before-tests.log`, `focused-tests.log`, `reverted-tests.log`, `reverted-check.json`,
`tests.log`, `tests-limited-workers.log`, `build.log`.
격리된 브라우저 저장과 mock clipboard를 썼으며 사용자 저장/OS clipboard 미접촉.
실제 기기 권한이나 native 동작 검증으로 일반화하지 않는다. commit/push/배포 없음.

## 21. 환생 후 남아 있는 캠페인 진행도 — 2026-09-22 수정 완료

`startPrestige`는 GameState의 진행도를 초기화하지만, 실제 확정 버튼은 게임 상태만
저장했다. StageSelect가 읽는 별도 `dungeonStageProgress`에는 이전 회차의 해금·별·
HP가 남았다. 기존 UI 검사도 saveGameState 호출만 확인해 이 불일치를 보지 못했다.

수정:
- §19의 두 키 쓰기/실패 rollback을 `saveGameStateWithCampaign`으로 추출해 import와
  환생 확정에서 재사용한다. 일반 saveGameState나 startPrestige의 순수 전이는 바꾸지 않는다.
- 환생 확정은 새 state와 그 stageProgress를 함께 저장한다. 실패 시 완료 callback을
  호출하지 않고 모달을 닫은 뒤 '환생 저장 실패. 다시 시도해주세요.'를 표시한다.
  원래 완료 상태가 유지되므로 다시 열어 재시도할 수 있다.
- 영구 성장 유지와 초기화 대상은 기존 startPrestige 규칙 그대로다. 기존 환생 완료
  저장을 자동 수선하거나 사용자 저장을 migration하지 않는다.

검증:
- `prestigePersistence.test.ts` 신규5검사: 실제 confirm handler의 두 저장소 초기화,
  영구 성장 보존·중복 확정 거절, 취소, 최신 완료 여부 재확인, 각 저장소 실패.
  원래 모듈로 실행하면 **3실패/2통과**, 수정 후5통과. explicit revert의 원문 복원
  해시는 `reverted-final-check.json`에 기록했다.
- 기존 `PrestigeModal.test.ts`의 blocker·호출 순서·badge3검사는 보존하고 저장 함수
  expectation만 갱신했다. 초기 작업 중 새 검사로 이 파일을 대체한 것을 diff review에서
  바로잡아 별도 파일로 분리했다. 예비 tests.log(3216)는 최종 결과가 아니다.
- `npx vitest run src/ui/PrestigeModal.test.ts src/ui/prestigePersistence.test.ts src/data/prestigeTransactions.test.ts src/data/saveTransfer.test.ts src/data/wisdom.test.ts`
  **5파일/118 tests 통과**. `npm test -- --maxWorkers=2` **137파일/3,219 tests 통과**.
- `npm run build` 통과(기존 Phaser chunk advisory), 최종 테스트 구성의 `npx tsc --noEmit`
  통과. syntax와 `git diff --check` 통과.
- `verify-prestige-progress.mjs`: production 실제 홈 환생 버튼→취소→각 저장소 예외
  →다시 확정→StageSelect→reload **17검사/실패0/오류0**. 명성2→3, 골드9000→200,
  90관문 완료→1관문만 해금/전체 별0. DM12·수정777·보석42·몬스터·지혜·무한 최고20 유지.
- 저장 실패 메시지, 환생 Home, 초기화된 관문 화면을 시각 확인했다. 표준 web-game
  client도1회 실행했으며 알려진 검은 canvas export를 제외하고 page screenshot을 사용한다.

최종 근거 `output/playwright/prestige-progress/final/` 및 상위 `focused-final-tests.log`,
`tests-final.log`, `reverted-final-tests.log`, `reverted-final-check.json`, `build.log`,
`typecheck.log`. 예비 실행 receipt는 보존한다. fixture와 저장 예외 주입 검증이며,
실제 사용자 저장/native/프로세스 강제 종료 중 두 키 원자성 검증은 아니다.
graphify AST update 완료(기존 네 파일 parser 경고 유지), owned preview 종료.
commit/push/배포 없음.

## 22. 홈 방치 보상 저장 실패 후 재시도 — 2026-09-22 수정 완료

환생 후 유지된 생산 시설의 수익을 확인하던 중, 홈 수령 버튼에서 저장 예외가
발생하면 메모리의 골드·재료·수령 시각만 바뀌고 버튼의 once listener가 소진되어
패널이 닫히지도 재시도되지도 않는 문제를 재현했다. 환생 초기화 정책과 수익 계산은
기존 규칙을 유지한다.

수정:
- `DungeonHomeScene.persistGameState`는 새 상태를 저장한 뒤 scene.gs와 표시를 갱신한다.
- 홈 수령은 저장 실패 시 상태·패널·버튼을 유지하고 모달 위에 재시도 안내를 표시한다.
- 성공 시 패널을 닫으며, 파괴된 패널/종료된 씬의 남은 버튼 콜백은 무시한다.

검증:
- `homeIdlePersistence.test.ts`는 실제 Home persist 메서드와 수령 handler를 사용한다.
  성공 후 중복 호출, 실패 시 메모리/저장 원문 보존과 재시도, 패널/씬 종료 후 콜백을
  검증한다. 수정 전 최초3검사 모두 실패했고 최종4검사와 idleIncome20검사가 통과했다.
- `npx vitest run src/scenes/homeIdlePersistence.test.ts src/data/idleIncome.test.ts`:
  **2파일/24 tests 통과**. `npm run build` 통과(기존 Phaser chunk advisory).
- `npm test -- --maxWorkers=2`: **138파일/3,223 tests 통과**(60.67초).
- `verify-idle-claim.mjs`: 격리된 환생3/빈 방/광산1·보물고1 fixture에서 실제 수령 버튼을
  클릭한다. 저장 실패→동일 버튼 재시도→추가 클릭→reload를 일반 애니메이션과
  동작 줄이기에서 각각 **14검사 통과, 브라우저 오류0**. 골드200→300, 광석5→7,
  저장1회이며 명성·수정·보석을 보존한다. 실패 안내/성공 Home PNG를 시각 확인했다.
- 원래 번들의 `before-live-clock/`은 13검사 중7실패와 QuotaExceededError를 기록했다.
  초기 `before/`는 하니스 Date.now 고정으로 tween이 정지한 실패다. 초기 build.log의
  ES2020 Array.at/Mock type 오류를 테스트에서 수정했으며, 그 실패 뒤 이전 번들을
  검사한 `final-reduced/`는 최종 근거가 아니다. 예비 결과도 보존했다.
- 표준 web-game client도 실행했고 알려진 검은 canvas export를 열어 확인한 뒤 제외했다.
  시각 근거는 정상 렌더링한 page screenshot이다.

최종 브라우저 근거 `output/playwright/idle-claim/verified-reduced/`, `verified-motion/`.
집중 검사와 build 근거는 같은 상위 경로의 `focused-final-tests.log`, `build-final.log`.
전체 검사는 `tests-final.log`. graphify AST update 완료(기존 네 파일 parser 경고 유지).
최종 receipt의 소스/하니스/dist index 해시 일치와 syntax/diff 검사를 확인하고,
이번 작업에서 시작한 preview 서버를 종료했다.
실제 사용자 저장/native 미접촉, commit/push/배포 없음. 생산 구역의 별도 수령·건설
handler에 같은 실패가 있는지는 후속 재현 대상이며 이번 홈 수정의 검증 범위는 아니다.

## 23. 생산 구역 진입과 저장 실패 복구 — 2026-09-22 수정 완료

생산 구역의 수령·건설/강화·근무 배정/해제는 저장 전에 scene.gs를 교체했다.
저장 예외가 발생하면 메모리만 바뀌고 성공/실패 표시가 갱신되지 않아, 재시도 시
비용·단계·배치 기준이 실제 저장과 달라졌다. 6개 실패 회귀 검사로 확인했다.
실제 진입 검증에서는 StageSelect 하단의 생산 버튼이 고정 군단 메뉴에 가려져
중앙을 누르면 BarracksScene이 열리는 별도 결함도 재현했다.

수정:
- ProductionScene 내부의 네 저장 지점을 `persistGameState`로 공유한다. 저장 후
  메모리를 반영하고, 실패 시 원래 상태로 다시 그리며 명령판에 재시도를 안내한다.
- 기존 비용·수익·배정 규칙과 250ms 중복 입력 제한은 유지한다.
- StageSelect의 스크롤 범위에 `ROOT_NAV_HEIGHT` 여백을 더해 최하단 생산·심연·장식
  버튼이 고정 메뉴 위로 올라오도록 한다. 관문/메뉴 좌표와 전환 대상은 유지한다.

검증:
- `productionPersistence.test.ts` 신규6검사: 최초 건설/강화/수령/방에서 배정/시설 간
  이동/해제의 실패 상태 보존→재시도→같은 시각 중복 호출. 실제 scene handler와
  localStorage를 사용하고 렌더링만 mock한다. 수정 전6실패, 수정 후6통과.
- `npx vitest run src/scenes/productionPersistence.test.ts src/data/productionTransactions.test.ts src/data/facilityStaff.test.ts src/data/idleIncome.test.ts`
  **4파일/56 tests 통과**. `npm run build` 통과(기존 Phaser chunk advisory).
- `npm test -- --maxWorkers=2`: **139파일/3,229 tests 통과**(16.80초).
- `verify-production-persistence.mjs`: Home→침공→8회 실제 드래그→생산 버튼 진입,
  버튼 전체가 고정 메뉴 위인지 확인, 6개 명령의 실패/재시도와 건설·강화·수령 연타,
  reload를 일반/동작 줄이기 설정에서 각각 **51검사 통과, 브라우저 오류0**.
  건설150·강화270을 한 번씩 차감, 수령100골드·광석4, 최종4680골드·광석9·광산Lv2.
  근무 이동·해제와 수정777·보석42 보존도 확인했다. 수령 적립 시간1h는 fixture로
  주입했으며 실제 1h 경과 시험은 아니다. 브라우저 근무 배정은 대기 수호자 기준이고
  방에서 빠지는 전이는 unit 검사로 확인했다.
- 초기 `reduced/`의 진입 timeout/군단 PNG를 보존했다. 최종 `verified-reduced/`,
  `verified-motion/`의 진입/실패 안내/성공 화면을 직접 시각 확인했다.
- 표준 web-game client 실행/검은 canvas export 열람 후 제외, page screenshot을 사용한다.
  graphify AST 갱신 완료(기존 네 파일 parser 경고 유지). 기록된 소스/하니스/dist index
  해시 일치, syntax/diff 검사 통과. 이번에 시작한 preview 서버는 종료했다.

근거 `output/playwright/production-persistence/`의 두 verified 경로와
`before-tests.log`, `focused-tests.log`, `tests-final.log`, `build-final.log`. 실제 사용자 저장/native
미접촉, commit/push/배포 없음. 이전 receipt는 당시 코드의 검증 근거로 보존한다.

## 24. 반복 수령으로 사라지는 생산 진행분 — 2026-09-22 수정 완료

수령마다 골드·재료를 내림한 뒤 공통 시계를 초기화해, 광산Lv1/보물고Lv1에서
10분마다 수령하면 1시간 뒤 골드96·광석0이 된다(한 번 수령하면100·2).
직조실의 시간당1.5개 생산도 같은 문제다. 새9개 재현 검사가 원래 코드에서 실패했다.

수정:
- 선택 필드 `idleRemainder`로 운영 골드·보물고 골드·재료별 소수 진행분을 저장한다.
  정수만 보유 자산에 지급하며, 같은 정산 함수를 미리보기와 수령에 사용한다.
  생산 단가 계산은 공유하고, 기존 정수 반환 `facilityProductionOverMs` 계약도 유지한다.
- 누락된 기존 저장은 진행분0으로 읽는다. 유효하지 않은 진행분은 사용하지 않으며,
  반복 소수 연산의 부동소수 오차만 1e-9로 보정한다. 이미 유실된 과거 수익은 복원하지 않는다.
- 적립 상한은 새 경과 시간에 적용한다. 새로고침/백업 복원은 진행분을 유지하고,
  환생은 기존 자산 정책에 맞춰 골드 진행분만 초기화한다.
- 과거 시각으로 수령해도 마지막 수령 시각을 되돌리지 않아 동일 구간 재지급을 막는다.

검증:
- `idleRemainder.test.ts`14검사: 1/10/20/30분 분할 수령과1회 수령 총량 일치,
  수입원별 내림, 읽기 전용 미리보기, 저장/백업, 상한, 역행 시각, 환생,
  잘못된 진행분, 보관된 진행분의 시설 강화 후 유지. 기존 관련 검사 포함
  `npx vitest run src/data/idleRemainder.test.ts src/data/idleIncome.test.ts src/data/production.test.ts src/scenes/productionPersistence.test.ts src/scenes/homeIdlePersistence.test.ts src/data/saveTransfer.test.ts src/data/wisdom.test.ts`
  **7파일/167 tests 통과**. `npm run build` 통과(기존 Phaser chunk advisory).
- `npm test -- --maxWorkers=2`: **140파일/3,243 tests 통과**(19.61초).
- 기존 `verify-production-persistence.mjs`에 10분×6 수령과 중간 reload를 추가했다.
  일반·동작 줄이기 각각 **70검사 통과/오류0**, 골드100·광석2·천1과 소수 진행분의
  범위(0 이상1 미만)를 확인했다. 최초 진입·실패 복구·연타51검사도 계속 통과한다. 적립 시간은
  fixture 주입이며 실제60분 대기는 아니다. 진행분 reload 후 생산 씬 복귀는 직접
  activation이며, 최초 Home→관문→생산 진입은 실제 pointer 경로다.
- 최종 브라우저 근거 `output/playwright/idle-remainder/final-reduced/`, `final-motion/`.
  진행 중/수령 완료 PNG를 직접 확인했다. 초기 build.log의 테스트 변수 타입 오류는
  GameState 명시로 수정했고, 그 직후 이전 번들을 본 `verified-reduced/`는 최종 증거가 아니다.

상위 `before-tests.log`, `focused-final-tests.log`, `build-final.log`에 검사 결과를 보존했다.
전체 결과는 `tests-final.log`. 표준 client 실행/검은 export 열람 후 page capture를
시각 근거로 사용했다. graphify AST 갱신(기존 네 parser 경고 유지), 최종 receipt 해시
일치 및 syntax/diff 검사를 확인했다.
이번 작업에서 시작한 preview 서버는 종료했다.
기존 전체 미수령 구간을 현재 단가로 계산하는 방식은 유지한다. 강화·배정 변경 전에
기존 단가로 구간을 확정하는 처리는 별도 후속 범위이며 이번 진행분 보존과 구분한다.
사용자 저장/native 미접촉, commit/push/배포 없음.


## §25 생산 변경 직전의 이전 단가 정산 — 2026-09-28

§24의 후속 범위 완료. 생산 구역에서 시설을 건설·강화하거나 근무를 배정·이동·해제하면
이전 미수령 시간 전체에 새 단가가 적용되던 문제를 수정했다.

- `productionTransactions.ts`의 세 mutation에 필수 timestamp를 추가했다. 기존 대상·비용
  검증을 통과한 뒤 `collectIdleIncome`으로 변경 전 상태를 정산하고 시설/근무 변경을 합친다.
  정산과 명령 결과를 기존 ProductionScene 저장 함수가 한 번에 저장한다. 저장 실패 시
  메모리·재화·시설·수령 시각은 모두 이전 상태이며, 재시도는 원래 구간을 한 번 지급한다.
- 성공 결과의 `idleReward`로 실제 지급이 있을 때만 `적립분 수령`을 안내한다.
  구매 가능 여부는 정산 전 보유 골드 기준이다. 소수 진행분·12/24시간 상한·비용·배수·
  연타 차단 규칙은 유지한다. 최초 시각 초기화도 데이터 트랜잭션이 담당한다.
- 예: 광산 Lv.1에서 1시간 뒤 강화하면 광석2를 지급하고, 다음 1시간은 Lv.2의4를
  지급한다. 새로 건설한 시설은 건설 전 시간의 산출물을 지급하지 않는다.

검증:
- 신규 `productionSettlement.test.ts` 8검사 중 수정 전7실패로 재현했다. 건설/강화,
  근무 배정→이동→해제, 근무자의 운영 수익, 0지급 구간의 소수 진행분, 적립 상한,
  legacy 시각 초기화, 실패한 명령의 무변경을 확인했다.
- `npm test -- --maxWorkers=2 src/data/productionSettlement.test.ts src/data/productionTransactions.test.ts src/data/production.test.ts src/data/facilityStaff.test.ts src/scenes/productionPersistence.test.ts src/data/idleRemainder.test.ts`
  **6파일/73 tests 통과**. 저장 실패/재시도 scene 테스트도 자동 정산 결과를 검사한다.
- `npm run build` **통과**. 기존 Phaser chunk advisory 유지. 빌드 성공을 확인한 뒤
  production preview에서 브라우저 검증을 실행했다.
- 기존 `verify-production-persistence.mjs`에 명령별 이전 1시간 fixture와 독립 산술 검사를
  추가했다. 일반·동작 줄이기 각각 **96검사 통과/오류0**. 실제 Home→관문→생산 진입,
  실패 복구, 건설/강화 연타, 배정/이동/해제, 저장 1회, 이전 단가의 골드·광석·소수 진행분,
  전체 reload와 10분×6 수령을 확인했다. 적립 시간은 주입값이며 실제 시간 대기 시험은 아니다.
  분할 수령 중 reload 후 생산 복귀는 직접 scene activation이다.
- `npm test -- --maxWorkers=2`: **141파일/3,251 tests 통과**(37.62초).
  로그: `output/playwright/production-settlement/tests-final.log`.
- 브라우저 근거: 같은 경로의 `reduced/audit.json`, `motion/audit.json` 및 PNG.
  강화·배정·이동·해제 성공 화면에서 안내 줄바꿈과 배율을 직접 확인했다. 기록된 코드/빌드
  해시는 현재 파일과 일치한다. 표준 web-game client도 실행했으나 검은 export와 빈 activeScenes
  결과는 시각 근거에서 제외하고 실제 page screenshot을 사용했다.
- graphify AST 갱신 완료(기존 Gradle3·SynergyManager parser 경고 유지), syntax/diff 검사 통과.
  이번 작업에서 시작한 preview 서버 종료. 사용자 저장/native 미접촉, commit/push/배포 없음.

남은 경계: `assignMonsterToRoomSlot`의 방 배치로 근무를 해제하는 경로는 아직 정산하지 않는다.
다음 후속 작업은 이 역방향 이동과 호출부의 저장 실패 처리를 확인하는 것이다. 방 건설/강화,
장식, DM 성장, 지혜/명성 등의 단가 변경도 이번 생산 구역 트랜잭션 범위에는 포함되지 않는다.


## §26 근무자의 방 복귀 정산과 저장 실패 복구 — 2026-09-28

§25에서 남긴 역방향 이동을 처리했다. `assignMonsterToRoomSlot`은 필수 timestamp를 받고,
목적지 검증 후 이동할 수호자가 근무 중이면 `collectIdleIncome`으로 변경 전 상태를 정산한다.
그 결과에 근무 해제·방 배치·기존 퀘스트 진행을 합쳐 반환한다. 기존 저장 함수가 결과를
한 번 저장한 뒤 메모리와 통화를 갱신한다. 일반 비근무자 배치의 정산 동작은 바꾸지 않았다.

- 배치 트레이의 공통 commit, 몬스터 선택 창, 추천 몬스터 배치에 저장 예외 안내를 추가했다.
  실패 시 `저장 실패 · 다시 시도해주세요`를 표시하고 창·배치·근무·재화·시각을 유지한다.
  실패한 명령은 성공 피드백이나 닫기/재열기를 실행하지 않는다.
- 기존 호출부와 테스트에 timestamp를 명시했다. 근무자의 운영 골드 기여, 생산 배수,
  소수 진행분, 적립 상한, 보유 자산의 정수 지급, 기존 퀘스트 집계 규칙은 유지한다.
- 신규 데이터5검사 중 수정 전4실패로 재현했다. 근무 전 단가/이후 단가, 방의 기존 수호자
  교체, 소수 진행분, 적립 상한, 잘못된 목적지, 최초 시각, 중복 수익 방지를 확인했다.
  실제 Home 저장 callback을 쓰는 추천 배치 실패→재시도1검사도 추가했다.
  관련 room/staff/editor 포함 총 **64 tests 통과**(두 번의 집중 실행).
- `npm test -- --maxWorkers=2`: **143파일/3,257 tests 통과**(102.25초).
  로그 `output/playwright/room-staff-settlement/tests-final.log`, 빌드 로그는 같은 경로의 `build.log`.
- `npm run build` 통과 후 production preview에서 검증했다. 기존 Phaser chunk advisory 유지.
  `verify-room-staff-settlement.mjs`의 headless/동작 줄이기 실행에서 **27검사 통과/오류0**.
  실제 Home 방 카드→배치 트레이, 상세→즉시 배치→몬스터 선택 창의 pointer 경로를 확인했다.
  두 경로 모두 저장 실패 무변경, 재시도 저장1회, 이전 단가 지급, 근무 해제와 방 배치,
  reload 후 자산·시각·소수 진행분 보존을 확인했다. 시간과 저장 오류는 격리 fixture 주입이다.
- 최종 브라우저 근거: `output/playwright/room-staff-settlement/reduced-headless/audit.json`
  및 PNG. 실패 안내와 성공 배치를 직접 열람했고 코드·빌드·하니스 해시가 일치한다.
  초기 퀘스트 보상이 섞인 실행, 가려진 상세 버튼 대신 뒤쪽 홈을 누른 실행, 외부 페이지로
  전환된 headed 실행은 최종 근거에서 제외했다. fixture는 미완료 MQ-003으로 고정했고
  가려진 지시 버튼은 실제 화면의 관찰 좌표로 클릭한다. 일반 모션은 이번 실행에서 미검증.
- 표준 web-game client 실행과 Home text state 확인. 검은 canvas export는 시각 근거에서
  제외하고 위 page screenshot을 사용했다. graphify AST 갱신(기존 parser 경고4개 유지),
  syntax/diff 검사 통과. 이번 preview 종료. 사용자 저장/native/commit/push/배포 없음.

다음 범위: 일반 수호자 방 배치/해제와 방 건설·강화가 운영 단가를 변경하는 지점의 정산.
장식·DM·지혜·명성 변경도 아직 별도 경계다. 이들을 이번 완료 범위로 일반화하지 않는다.

## §27 일반 방 변경의 이전 단가 정산과 미설계 강화 차단 — 2026-09-28

일반 수호자의 배치/해제, 방 설계/건물 전환, 방 강화가 운영 단가를 바꾸기 전에
`collectIdleIncome`으로 이전 상태의 미수령 구간을 정산한다. 결과에 방 변경과 기존
퀘스트 진행을 합쳐 한 번 저장한다. 모든 호출부에 timestamp를 명시했고 추천 일괄
배치에는 하나의 시각을 사용한다. 강화 자격은 정산 전 보유 골드로 판단한다.
기존 비용·배수·소수 진행분·적립 상한은 유지한다.

- 상세의 설계/강화와 추천 설계에도 저장 예외 안내를 추가했다. 실패 시 성공 연출과
  닫기/재열기를 중단한다. 배치 트레이는 기존 공통 저장 실패 처리를 재사용한다.
- 브라우저에서 미설계 Lv.0 방에 `강화 1,200골드`가 표시되는 결함을 추가 발견했다.
  트레이/상세에서 미설계 방의 강화 버튼을 숨기고 거래 함수도 `room_not_built`로
  거절한다. 미설계 Lv.0/Lv.1 모두 비용·누적 수익·시각을 변경하지 않는다.
- 신규 데이터10검사. 최초 수익8검사 중7개와 미설계 Lv.1 강화 검사는 수정 전 실패로
  재현했다. 기존 강화 테스트2개의 미설계 fixture는 의도에 맞는 support 방으로 보완했다.
  관련6파일 **74 tests 통과**. 가격·용량·레벨 제한 assertion은 유지했다.
- `npm test -- --maxWorkers=2`: **144파일/3,267 tests 통과**(28.36초).
  최종 검사 로그는 `output/playwright/room-income-settlement/tests-final.log`,
  같은 상위 경로에 `tests-focused.log`, `build.log`, `graph.log`를 보존했다.
- `npm run build` 통과(기존 Phaser chunk advisory 유지). Production preview의
  headless/동작 줄이기 브라우저에서 **54검사 통과/오류0**. 실제 Home 방 카드에서
  배치/해제/건설/강화 입력, 실패 무변경, 재시도 저장1회, 이전 단가 지급, reload 보존을
  확인했다. 시각과 저장 오류는 격리 fixture 주입이며 일반 모션/native는 미검증이다.
- 최종 브라우저 근거는 `output/playwright/room-income-settlement/verified/audit.json`
  및 PNG. 건설 실패/성공과 강화 성공 화면을 직접 열람했고 기록된7개 해시가 일치한다.
  `final/`의53검사는 미설계 강화 차단 전 중간 결과이므로 최종 근거에서 제외한다.
- 표준 web-game client1회와 Home text state 확인. 검은 canvas export는 직접 열람 후
  시각 근거에서 제외했다. graphify AST 갱신 완료(기존4개 parser 경고 유지), syntax/diff
  검사 통과. 이번 preview 종료. 사용자 저장/native/commit/push/배포 없음.

다음 우선순위는 Home→배치→성장→전투의 통합 플레이/UX 점검이다. 핵심 저장·진행·보상
결함을 우선하고, 해당 흐름의 정보·행동·피드백을 확정한 뒤 시각 디자인을 다듬는다.
기능 전부 또는 시각 디자인 전부의 완벽한 완료를 서로의 선행 조건으로 두지 않는다.
장식·DM·지혜·명성 변경 시 단가 경계는 별도 미완료이며 이번 검증으로 일반화하지 않는다.

## §28 Home→배치→성장→전투→복귀 통합 플레이 1차 — 2026-09-28 (Claude)

격리된 Playwright 컨텍스트(390×844, DPR2, 동작 줄이기)에서 신규 저장으로 튜토리얼→방 설계→
수호자 배치→MQ-001/002 정산→첫 침략(MQ-003) PreBattle→전투→결과→Home 복귀→군단(먹이·장착)
→공방→Home 복귀를 실제 입력으로 진행했다. 전투는 MQ-003 직전 상태를 seed로 재현해 반복했다.
기기 부하(load 16~74)로 게임이 1~12 FPS였고, 이 때문에 생긴 튜토리얼 지연은 결함에서 제외했다.

### 수정한 결함 (진행 차단·잘못된 안내·중복 지급 우선)

1. **전투 결과 중복 정산(CRITICAL).** Phase 2c(`8765cee`)가 Home의 `registry.remove('battleResult')`를
   navigation 계약으로 바꿨는데 `'battle-result'`가 `returnTo`만 소비했다. 승리/패배 뒤 Home이 다시
   create될 때마다(퀘스트 팝업 재시작, 군단/공방 왕복) 같은 전리품 골드·DM XP와 결과창이 반복 지급됐다.
   브라우저에서 군단 왕복 1회로 골드 +30·DM XP +150(Lv3→4) 재지급을 재현. 계약이 `battleResult`도 소비한다.
2. **배치 트레이 커밋 후 지시·퀘스트 미갱신.** 트레이는 보드만 다시 그렸다. 방 #1 설계·배치 뒤에도
   `다음 수비 지시`가 "준비도 0% · 방 0/3 · 방 #1 설계"로 남았고, MQ-001(방 1개 건설) 달성 후 보상·다음
   퀘스트·첫 침략 연쇄가 멈췄다. 트레이도 방 상세와 같은 `refreshHomeDynamicPanels`를 쓴다.
3. **메인 퀘스트 팝업이 편집 레이어 아래.** 깊이 80이 방 상세 100·피커 110·트레이 120보다 낮아 확인
   버튼이 가려졌다. `MAIN_QUEST_RESULT_DEPTH = 130`.
4. **퀘스트 팝업이 전투 결과 요약을 덮고 폐기.** `create()`의 `initQuests`가 귀환 연출보다 먼저 퀘스트를
   정산해 팝업(재시작)이 요약 위에 떴다. `battleReturnPresenting` 게이트로 요약→DM 레벨업→퀘스트 순서를
   보장한다(`presentBattleReturnWin`). 재시작 중 대기 플래그가 남지 않게 `create()`에서 초기화한다.
5. **MQ-001 보상 표시의 유령 몬스터.** `reward.monsters`는 어디서도 지급되지 않았고 대상은 이미 보유한
   스타터였다. 팝업에 원시 ID `dokkaebi_warrior`까지 노출. 필드·표시를 제거(지급액 변화 없음).
6. **최종 웨이브마다 전투 화면이 1/DPR로 축소.** `wave === maxWave`면 항상 보스 경고가 재생되고, 카메라
   펀치가 절대 줌 1.06→1.0을 써서 DPR 줌(웹2·iPhone3)을 잃었다. 이후 전투와 결과 패널·터치 영역이
   절반/3분의 1로 렌더. 펀치를 호출 시점 줌의 배수로 바꿨다(`playBossCameraPunch`).
7. **승리 후 HUD "잔여 1".** 처치 중인 침입자가 사망 연출 동안 `active`라 카운트에 포함됐고, 심장부 돌파는
   카운트를 갱신하지 않았다. `remainingInvaderCount`로 두 경로를 맞췄다.
8. **전투 빈 칸 "방 추가".** 옵션 B는 전투 중 건설이 없고 탭해도 반응이 없다. Home과 같은 "빈 터"로.
9. **짧은 재진입마다 방치 수익 모달.** 골드가 1이라도 쌓이면 Home create마다 차단 모달이 떴다(퀘스트 확인,
   군단/공방 복귀). 5분 미만 부재는 같은 `collectIdleIncome`으로 조용히 정산하고 토스트만 띄운다. 저장
   실패 시 상태를 유지해 다음 진입에서 재정산. 정산 주기를 줄이지 않으므로 장식·DM·지혜·명성 단가 경계의
   노출을 늘리지 않는다(그 경계는 여전히 미완료).
10. **튜토리얼 강조 영역·안내 문구가 현재 Home과 불일치.** 2단계가 방 카드를 반으로 자르고 3단계가 없는
    "퀘스트 패널·방어 버튼"을 가리켰다. 단계마다 실제 Home 기하(`collectTutorialAnchors`: 첫 방·상단 방 줄·
    명령 덱·침공 탭)에 맞추고 3단계를 "다음 수비 지시 → 상단 경보의 방어 준비" 경로로 고쳤다.
11. **군단 카드가 보유 장비를 두고 "제작"을 안내.** 신규 플레이어는 장비 3개를 보유하지만 설계도가 없어
    공방에서 할 수 있는 것이 없다. 장착 가능한 보유 장비가 있으면 "장비 장착 · 보유 장비 N개 · 장착".
12. **공방 대상 레일의 "배치 대기".** 설계도가 없으면 추천이 없어 실제 배치와 무관하게 "배치 대기"였다.
    추천이 없을 때 실제 배치(`실제 방 #N`)로 대체.
13. **장착 후 상세가 성장 탭으로 복귀.** 장비·스킬 탭에서 장착하면 탭 문맥을 잃었다. 새로고침에 탭을 유지.

### 검증

- 신규/보강 테스트: `homePlacementTrayRefresh`, `homeBattleReturnOrder`(4: 게이트·순서·레벨업·1회 정산),
  `bossCameraPunch`(DPR 1/2/3), `remainingInvaders`, `tutorialAnchors`(10), `idleIncome`·`homeIdlePersistence`
  (짧은 부재 자동 정산·저장 실패 보존·긴 부재 모달), `BarracksShared`(장착 cue·공방 방 cue),
  `navigationContract`·`questData` 기대값 갱신. 게이트/카메라/정산 가드는 수정을 되돌려 실패를 확인했다.
- `npm test -- --maxWorkers=2`: **149파일/3,296 tests 통과**. `npm run build` 통과. graphify AST 갱신.
- 브라우저(dev 8083, 격리 컨텍스트): 트레이 설계→MQ-001 즉시 정산·덱 갱신, 팝업 최상단, 전투 결과 줌 2 유지,
  잔여 0, 요약→퀘스트 순서, 귀환·퀘스트 재시작·군단 왕복 후 골드/XP 1회 정산(526→562→864→866),
  카드 "장착" cue, 공방 "실제 방 #1", 장착 후 탭 유지, 튜토리얼 4단계 정렬.
- 하니스: `verify-room-staff-settlement` **80/0**, `verify-production-persistence` **96/0**. 두 하니스의
  reload 지속성 검사는 Home의 짧은 부재 자동 정산과 분리하려고 reload 직전 page clock을 저장된 수령 시각에
  고정했다. `verify-idle-claim`은 이 기기 FPS에서 첫 `수령` 탭이 처리되지 않는 1건이 **기준 커밋
  1b48b2b에서도 동일하게 실패**해 이번 변경과 무관한 환경 제약으로 기록한다(나머지 13/14 통과).
- 근거: `output/playwright/integrated-play-20260928/`(git 제외, PNG·하니스 audit). production preview·
  일반 모션·native·실기기는 미검증. commit/push 없음.

### 디자인 수정 대상과 우선순위 (시각 작업 전 화면 구조·정보 확정용)

- **P1 Home 보드:** 방 카드 제목 "방 #1"이 `설계/수호` 핀에 가려진다. 보드 좌→우가 #1·#3·#2라
  침입 순서(INVASION_ORDER)와 번호 의미가 읽히지 않는다. 방 카드 `준비 53% · M1 T0` 약어.
- **P1 배치 트레이:** 몬스터 칩에 이름·역할·적합도가 없다(초상화+Lv만). 건물 카드에 효과 요약이 없다.
  DM 게이트로 막힌 강화가 `강화 최대`로 표시된다(→ "DM3 필요" 류).
- **P1 수호자 상세:** 장비 칩이 아이콘+`추천/R1`뿐이라 이름·능력치·다른 수호자 착용 여부를 모른다. 헤더
  ATK가 장비를 제외해 장착 직후 변화가 없다(전력 미리보기에만 반영). `장비 장착 추천` 본문과 `0/2 스킬` 겹침.
- **P2 PreBattle:** `보강 100%+` 배지 잘림, `입구` 라벨과 1번 노드 겹침, `T -`와 `1 배치` 겹침,
  `철수 불가`와 `← 취소`의 의미 충돌.
- **P2 결과:** `준비 완료/준비` 중복 라벨, MVP 칩 "도깨비"(실제 도깨비 전사), 결과 중 HUD `⚠ 최종 침략!` 유지,
  PreBattle "농민병사"와 정찰 보고 "농민" 명칭 불일치. 퀘스트 해금 행이 원시 ID(`summon_altar`)를 보인다.

### 설계 판단이 필요한 항목 (수정하지 않음)

- **장비는 ID 공유 해금으로 동작한다.** 보유 1개로 모든 수호자가 동시에 장착할 수 있고 공방 분해 로직도
  이 모델을 전제한다. 개별 소유로 바꾸면 경제·밸런스(페이싱 모델에 장비 없음)·기존 저장 이관이 걸린다.
- **튜토리얼은 클릭 진행형이다.** 각 단계가 실제 행동을 기다리지 않는다. 행동 대기형 전환은 별도 범위.
- 짧은 부재 기준 5분은 이번 수정에서 정한 값이다(`IDLE_PANEL_MIN_MS`). 조정 가능.
- `items: ['basic_sword']`(MQ 보상)는 지급·표시 모두 없는 데이터다. 지급할지 제거할지 결정 필요.

## §29 두 번째 전투 사이클·패배·오늘의 손님·P1 화면 정보 — 2026-09-28 (Claude)

§28 이후 침공 탭→스테이지 선택→스테이지 1→결과, 스테이지 패배, 오늘의 손님 카드(패배)까지 실제 입력으로
진행하고 P1 화면 정보를 고쳤다. 커밋 `8c1162f` `e684324` `0d309e1` `8fca8e5`(push 없음).

### 수정

1. **캠페인 스테이지 전리품·DM XP 미적립(HIGH).** 스테이지는 `returnTo`가 없어 `battleResult` 인계가 없었고,
   처치 저장은 통계만 올렸다. 결과창 "황금 965 · 낡은 천 ×3"이 저장에 반영되지 않았고 페이싱 모델 전제
   (전리품 + 클리어 XP 150)와 실제가 어긋났다. 클리어 순간 `applyBattleReturnSettlement(..., {defendInvasion:false})`
   로 정산한다(침략 방어 목표는 올리지 않음). 재도전 클리어도 지급한다.
2. **스테이지 패배 시 출구 없음.** 광고 부활·보석 부활·처음부터 재정비뿐이었다. 모든 패배에
   "던전으로 귀환 · 방어선 보강"을 제공하고 스테이지는 전리품 + 패배 XP 30을 즉시 정산해 홈으로 간다
   (`buildFailOptions`).
3. **스테이지 카드의 유령 보석(+2/+5)** → 실제 지급되는 DM XP +150 행. 클리어 제목은 장 마지막 관문만
   "N장 전선 확보", 나머지 "관문 N 확보"(`stageClearTitle`).
4. **내구도 0에서만 수리 권고.** 돌파마다 모든 방이 최대 내구 5%를 잃고 회복이 없다. 50% 미만이면
   수리를 최우선으로 권하고 비용을 보인다(`REPAIR_RECOMMEND_PCT`).
5. **전투 복귀 위에 방치 모달.** 실행 중 재진입은 60분(`IDLE_IN_SESSION_PANEL_MIN_MS`) 미만이면 조용히 정산,
   실행 후 첫 홈 진입만 5분 기준 모달.
6. **P1 화면 정보:** 트레이 몬스터 칩 이름, DM 게이트 강화 "강화 DM3 필요", 방 상세의 옛 게이트 표
   (Lv2=DM5 → 실제 DM3) 제거(`getDmLevelForRoomLevel`), 홈 주 행동 핀 "#N 행동", 장비 타일 이름
   (방망이·갑옷·부적)과 보관함 머리의 추천 장비·효과.

### 검증

신규/갱신 테스트: stageLootSettlement(3), stageRetreat(3), stageClearTitle, roomActionRecommendations(수리 경계),
idleIncome·homeIdlePersistence(실행 중 재진입), wisdom(getDmLevelForRoomLevel), MonsterDetailShared(equipmentTileLabel).
전체 **151파일/3,311 tests**, build 통과. 브라우저: 스테이지 1 클리어 시 골드 866→1,831·XP 130→280,
패배 귀환 +11골드·+30XP(Lv4), 수리 지시→트레이 수리(76골드, 내구 10→200), 오늘의 손님 패배 정산
(전리품 +480·XP +30·명성 5→4·재료 +1), 실행 중 6분 재진입 무모달, P1 문구·칩·타일 표시.

### 관찰 (설계 판단 필요, 수정하지 않음)

- **주간 토벌대 카드**는 명성 단계와 무관한 주차별 보스(이번 주 공허 군주 22만 HP)를 신규에게도 제시한다.
  승리 보상은 명성 +40뿐이고 패배는 명성 −10%라 저단계에서는 손해 카드다.
- **광고 부활**은 실제 광고 없이 무료·무제한이다(`[AD] watch_ad` 로그만). 패배를 무의미하게 만든다.
- 일반 스테이지는 PreBattle 없이 컷씬→전투로 들어간다. 스테이지·패배 귀환에서의 DM 레벨업은 별도 연출 없이
  홈 헤더/슬롯 수로만 드러난다.
- 준비도(%)는 내구도를 반영하지 않는다(행동 권고만 반영).

## §30 P2 화면 정리와 1장 연속 진행(스테이지 1~10) — 2026-09-28 (Claude)

커밋 `d31e9c4` `0e1780e` `0fd98bc` `f2a87b8`(push 없음).

### 수정

1. **P2 화면:** PreBattle 적 이름을 실제 침략자로(`enemyDisplayName`, "농민병사"→"농민"), 모순된 "철수 불가"
   제거, 준비도 배지 폭 자동, 루트 방향을 제목("입구 → 던전 심장")으로 옮기고 노드를 내려 순번 핀과
   분리, 함정 배지를 스탯 줄에 합침. 결과 값 "완료"(라벨 "준비"와 중복 제거), MVP 칩 6자 줄임.
   퀘스트 해금 행은 효과가 있는 칭호만 이름으로(`data/dmTitles.ts questUnlockLabel`) — 나머지 해금 ID
   (`summon_altar`·`research_lab`·`affinity_system`·스킨 4종 등)는 저장만 되고 읽히지 않는다.
2. **웨이브 브리핑 중복:** 정찰 보고/웨이브 사건 창의 배경이 입력을 막지 않아 본문 탭이 아래의 "침입 방어
   개시"를 다시 눌렀고, 보고서가 겹치고 사건이 재추첨되거나(배율은 표시 즉시 적용) `startWave`가 두 번
   호출될 수 있었다. `WAVE_BRIEFING_NAME` 가드 + 입력 차단 배경.
3. **퀘스트 로그:** 배경 Graphics에 판정 영역이 없어 의도된 탭-닫기가 동작하지 않고 탭이 홈의 방 카드·
   지시 버튼으로 샜다. 판정 영역 추가. 미완료 목표에 "바로 가기"(`questObjectiveDestination`: 소환·합성·
   먹이·스테이지). MQ-005 "소환 1회"가 1장 내내 방치된 원인이 경로 부재였다.
4. **홈 결과 팝업 배경:** `buildOverlayDim`(전투 귀환·DM 레벨업·패배·장 완료)과 퀘스트/게임 완료 팝업
   배경이 입력을 받지 않아 패널 밖 탭이 방 카드를 눌러 트레이(깊이 120)가 요약 위로 열렸다.

### 1장 연속 진행(격리 컨텍스트, 실제 입력)

홈에서 열린 방마다 트레이 "추천 배치"(+수리, 스테이지 3부터 강화) → 침공 탭 → 스테이지 N → 3배속 전투를
반복했다. 스테이지 1~10 **전부 ★3·던전 HP 무손실**, 스테이지 10 보스 "1장 전선 확보". 수호자 3명
(Lv1~2)·방 7개(Lv2, 함정실 3)였다. 전리품은 스테이지 카드 예상과 일치(1: 1,451/~1,440).
골드 866 → 41,663, DM3 → 7. 소환은 무료 우정 계약(비용 0)과 보유 보석·결정으로 가능했다.

### 관찰 (설계 판단 필요, 수정하지 않음)

- **1장 난이도 여유:** 추천 배치만으로 10개 관문을 무손실. 스테이지 전리품 정산(§29) 이후 경제가
  페이싱 모델 전제대로 흐르면서 초반 여유가 커졌을 가능성. organic 하니스로 재측정 권장.
- **초반 골드 과잉:** 1장 끝 41,663골드. 방 강화는 DM 게이트(Lv3=DM10)에 막혀 주 사용처가 없다.
- 하니스 참고: 기기 부하(load 16~74)로 1~12 FPS. 정찰 보고 패널 높이가 적 종류 수로 달라져 고정 좌표
  입력은 실패한다(라벨 입력 사용).

## §31 방치 수익 단가 경계 완료와 서브 퀘스트 수령 유실 — 2026-09-28 (Claude)

커밋 `ae28f03` `9931b51`(push 없음).

- **단가 경계(인계 미완료 항목 종료):** `settleIdleAcrossChange(prev, next, now)`가 DM·지혜·장식·명성 입력이
  바뀐 변경에서 이전 단가로 미수령 구간을 정산한다. 적용: `applyBattleReturnSettlement`의 `now`(홈 귀환·예보·
  스테이지 클리어·스테이지 철수), 홈 메인 퀘스트 완료, 서브 퀘스트 수령, 장식 배치·해제, 간판 올리기,
  지혜 구매. 브라우저: '풍요' 2세트 배치 시 1시간분이 이전 단가 399(새 단가 439)로 정산.
- **서브 퀘스트 보상 유실/반복 수령(HIGH):** 퀘스트 로그가 저장소에 직접 쓰고 홈 메모리는 그대로여서, 수령 후
  홈에서 방을 하나 설계하면 골드 1,123→1,008·수령 취소로 되돌아갔다(반복 수령 가능). 모든 로그 저장이
  `QuestLogState.persist`로 홈을 거친다. 수정 후 1,134→1,139 유지.
- 퀘스트 로그 깊이 65(침략 배너 60 위), 서브 퀘스트 수령 판정 44px.
- 검증: idleRateBoundary(6)·questLogCommit(2), 전체 157파일/3,329 tests, build 통과.

### §31 후속 — 홈 위 패널 직접 저장 일괄 점검 (`06ada51`)

서브 퀘스트와 같은 구조(홈 위 패널이 저장소에 직접 쓰고 홈 메모리는 그대로)를 전수 확인했다. 출석 보상·도전 과제
패널이 해당했고 `commitSceneState(scene, next)`(소유 씬의 `persistGameState` 우선)로 바꿨다. 장식·지혜·생산 씬은
자기 사본을 함께 갱신하고, 공방·소환·상점·합성은 매번 새로 읽어 해당 없음. 군단은 상세 변경 후 목록·전투력·
성장 지휘가 씬 시작 값을 보이던 표시 결함을 상세 닫기 시 재구성(스크롤 유지)으로 고쳤다.
브라우저: 출석 수령 후 방 설계에도 보상 유지(1,100→1,114), 먹이 후 목록 EXP 즉시 반영. 158파일/3,331 tests.

## §32 2장 진입(스테이지 11~13)과 로스터 크기 — 2026-09-28 (Claude)

1장 완료 직후 상태를 시드(DM7, 40,000골드, 수호자 3체 Lv4, 스테이지 1~10 ★3, 보석 45·영혼 결정 60)로
재현하고 §30과 같은 실제 입력 루프(추천 배치+수리+강화 → 침공 → 3배속)를 돌렸다.

| 로스터 | 결과 |
|--------|------|
| 3체(1장 루프 그대로, 소환 없음) | 11: 2회 모두 패배(웨이브 8·9, 전리품 3,405·4,294 정산 후 홈 귀환) |
| 7체(시드 재화로 우정 1·영혼 1·일반 3 소환, 1체 중복) | 11 승 HP 1,200 · 12 승 HP 850 · 13 승 HP 1,390, 모두 첫 시도 |

- **결함 아님(로스터 벽):** 페이싱 모델의 lean 로스터는 `3 + floor(N/3)`(스테이지 11 = 6체)이고, 1장 루프는 소환을
  하지 않아 3체로 2장에 들어갔다. 1장을 3체로 무손실 통과하므로 소환 동기가 2장 첫 관문에서야 생긴다.
  패배 경로(전리품 정산 → 홈, §29)는 정상 동작했다. MQ-005 "소환 1회"의 바로 가기(§30)가 유일한 소환 유도다.
- **로스터 성장원(참고):** 우정 소환 하루 1회(비용 0, `friendshipPoints`는 읽히지 않는 필드), 영혼 소환 50결정,
  일반 소환 30보석. 스테이지 클리어는 보석을 주지 않고, 초반 보석은 출석(2일차 10·4일차 20)과 업적 몇 개뿐이다.
- **추천 배치 편중(관찰):** 방 트레이 "추천 배치"는 그 방의 몬스터 칸을 채우므로 방 순서대로 누르면 7체가 방 3개에
  몰리고 5개 방은 비었다. 추가 수호자도 방 레벨 배수를 받으므로(`RoomMechanics.ts:463`) 편중이 확실히 불리하다는
  근거는 없다. 사거리·행 커버리지 차이는 organic A/B로만 판단 가능. `CLAUDE.md`의 "레벨 배수는 첫 몬스터에만"
  문장은 코드와 달라 고쳤다.

### 설계 판단 필요 (수정하지 않음)

- 1장이 소환 없이 무손실이면 2장 첫 관문이 첫 벽이 된다. 선택지: 1장 후반에 소환을 요구하는 관문/퀘스트 배치,
  또는 스테이지 11 난도 완화. §30의 "1장 난이도 여유"·"초반 골드 과잉"과 같은 축이다.

## §33 수호자 ATK 표시와 결과 화면 HUD — 2026-09-28 (Claude)

커밋 `e24a648` `1fda750`(push 없음).

- **ATK 표시(§28 P1):** 수호자 상세 헤더·군단 카드/총 전투력/정렬·방 몬스터 선택·결과 MVP 칩이 `getMonsterAtk`
  원시값을 써서 장비 `atkMult`(전투는 매 타격에 곱함)와 교감·흡수·각성이 빠졌다. 장착 직후 헤더가 변하지 않던
  원인. `getOwnedMonsterBattleAtk`(barracks.ts)로 전투와 같은 배수를 표시한다. PreBattle과 전력 장비 영향은
  장비를 별도 행으로 보이므로 육성 포함 기본값(`getOwnedMonsterAtk`)만 쓴다. 추천 모듈의 점수 계산은 바꾸지 않았다.
- **결과 화면 HUD(§28 P2):** 최종 웨이브 클리어 시 `WaveLifecycle`이 레지스트리 `battleOutcome='clear'`를 세우고
  HUD가 "✓ 침략 격퇴"(비취색)로 바꾼다. 라벨 규칙은 `ui/waveHudLabel.ts`(순수). 키는 `DungeonScene.create`에서
  null로 프리시드(첫 set은 changedata 미발화), `UIScene.create`에서 재독(인스턴스 재사용). 패배·부활 경로는 그대로.
- 검증: ownedMonsterBattleAtk(4, 장비 무시로 되돌리면 2건 실패 확인)·waveHudLabel(3), 전체 **160파일/3,338 tests**,
  tsc·build 통과. **브라우저 확인은 ERP 검증 구간 동안 보류 요청으로 미실행** — 재개 시 상세 헤더 장착 전후 ATK와
  스테이지 클리어 결과 HUD를 실제 화면에서 확인할 것.

## §34 메인 퀘스트 목표 정합성 — 2026-09-29 (Claude)

커밋 `1f24935`(push 없음). 브라우저 없이 목표 10종의 진행 지점·도달 가능성·안내를 전수 점검했다(코드 확인 후 수정).

### 수정

1. **`reach_dm_level`이 전투 횟수를 셌다(HIGH).** 정산마다 +1이어서 "DM Lv.10"(MQ-022 등 9개 퀘스트)이 레벨과
   무관하게 전투 10회로 완료됐다. 페이싱 모델(`target <= dmLevel`)과도 어긋났다. 위치형(`POSITIONAL_OBJECTIVES`)으로
   바꾸고 정산은 현재 DM 레벨을 기록한다. 홈 완료 판정(`advanceCompletedMainQuest`) 직전에도 동기화해 퀘스트·서브
   퀘스트 보상으로 오른 레벨도 인정한다. 주석이 가리키던 `syncAutoMetObjectives`는 존재하지 않았다.
2. **스테이지 클리어로 끝난 퀘스트가 홈 보상 단계를 건너뜀(HIGH).** 전투 중 `completeAndAdvance`를 바로 불러
   `applyMainQuestCompletionRewards`(설계도·각성석)와 완료 팝업이 빠졌다 — MQ-030·034·044 설계도 미지급.
   `applyQuestObjectiveProgress`는 진행만 올리고(`questDone` 보고, 토스트 유지) 완료는 홈 `initQuests`가 한다.
3. **`complete_stage` 시작 시 미반영.** 이전 퀘스트 진행 중 이미 깬 스테이지가 새 퀘스트에 0으로 시작해 재도전이
   필요했다. `startQuest`가 `stageProgress`의 최고 클리어 번호로 자동 충족한다.
4. **`totalGoldEarned` 이중 누적.** 처치 순간과 전리품 정산에서 두 번 더해 누적 골드 목표·업적이 부풀었다.
   처치 경로에서 제거.

검증: questObjectiveIntegrity(7, 위치형 되돌리면 실패 확인), 기존 progressionTransactions 테스트 2건은 의도한 동작
변경에 맞게 갱신. 전체 **161파일/3,345 tests**, tsc·build 통과. 브라우저 확인은 ERP 검증 구간 보류로 미실행.
기존 저장의 부풀려진 `reach_dm_level` 진행도는 이관하지 않는다(목표 이상이면 이미 충족, 미만이면 실제 레벨이 넘을 때 충족).

### 설계 판단 필요 (수정하지 않음)

- **`upgrade_room` 영구 정지 가능성:** 강화는 방 9개 × 4회 = 36회가 전부이고 되돌릴 수 없다. MQ-016(5)·028(3)·
  032(3)·036(4)·040(5) 사이에 모든 방을 Lv5로 올린 플레이어는 MQ-036/040을 끝낼 수 없다. 자동 충족 규칙
  (예: 모든 방 최대 레벨이면 충족) 또는 목표 변경 필요.
- **`collect_gold` 규칙 혼재:** 시작 시에는 누적 총액(`totalGoldEarned`)으로 자동 충족, 진행 중에는 전리품만 센다
  (방치 수익·상인·퀘스트 보상 제외).
- **`defend_invasion` 안내:** 퀘스트 침략 배너는 진행도 0일 때만 뜬다. MQ-037(2)·040(3)·041(5)은 첫 승 이후
  오늘의 손님 카드에만 의존하고(상인 카드는 전투 없음) 퀘스트 로그 바로 가기도 없다.
- 침략 설정이 있지만 방어 목표가 없어 발동하지 않는 퀘스트: MQ-012·015·027·032. INV-006 중복(MQ-019·027).
- 퀘스트 해금 `summon_altar`·`forge`·`affinity_system`·`research_lab`은 어떤 기능도 막지 않는다(칭호 표시만).
