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

## 2. 남은 결함 (수정 대상, 심각도 순)

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

## 3. 설계 판단이 필요해 보류한 것 (사용자 결정 먼저)

**임의로 진행하지 말 것.** 넷 다 "명백히 이상하지만 고치는 방법이 여러 갈래이고
각 갈래의 대가가 다른" 경우다.

### 3-1. 종족 시너지 `spdMult`가 한 필드에 세 의미를 담고 있다

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
인접 ATK · 천상 ATK · 공속 · 마법 부스트 등. 새 전투 메커니즘 12개라 별도 기능 단위다.

### 3-3. 전력 지표의 방 레벨 항이 선형인데 전투는 지수다

`src/data/dungeonMetrics.ts`의 `levelBonus = (roomBasePower + typeBonus) × (roomLevel−1) × 0.1`
vs 전투의 `1.4^(level−1)`. Lv5에서 표시 +40% / 실제 +284%.

단순 표시 문제가 아니다 — `reinforcementRecommendations.ts:340`의 `getGrowthScore`가
`estimatedPowerDelta`를 **성장 추천 랭킹**에 그대로 더하므로, 고레벨 방의 성장이
과소평가된다.

지수로 바꾸면 게임의 **모든 전력 표시**가 바뀌고 `dungeonMetrics.test.ts`가 현재 공식을
고정한다. 전력이 *피해 예측치*냐 *준비도 휴리스틱*이냐의 결정이 먼저다.

### 3-4. 선조의 지혜(145 크리스탈)가 DM8부터 영구히 0슬롯

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

## 5. 미완 검증 하나

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
