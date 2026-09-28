# Dungeon Phaser Design Continuation Handoff

## Claude 작업 재개 지침 — 2026-09-28

- 작업 경로: `/Users/sungjin/dev/personal/dungeon md/dungeon-phaser`.
  원격 `https://github.com/sungjin9288/dungeon-md.git`, remote `origin`, branch `main`.
  사용자가 해당 원격 연결과 누적 작업 push를 승인했다. 연결 시 원격은 빈 공개 저장소였다.
- 코드 기준은 `539e2f5`, 누적 검증/인계 기록은 `cbfa1ae`까지다. Git 상태와 실제 코드를
  먼저 대조한다. 원격 진행 여부는 `git ls-remote origin refs/heads/main`으로 확인한다.
- `AGENTS.md` → 이 문서 → `docs/MONSTER_DUNGEON_DESIGN.md` →
  `docs/design/DESIGN.md` → `CLAUDE.md`를 읽고, 결함 이력과 수용 범위는
  `docs/design/CODEX_HANDOFF_DEFECT_SWEEP.md`의 최신 절까지 확인한다.
  §2와 §3-1~3-4는 이미 처리됐다. 과거의 "§3 미착수" 문구로 다시 중단하지 않는다.

**다음 목표:** Home→방 설계/배치→몬스터 성장/장비→전투 준비→전투→결과/홈 복귀를
실제 플레이 경로로 점검하고, 이 흐름을 막는 기능·UX 결함을 작은 단위로 수정한다.
390×844 기준 핵심 정보, 다음 행동, 비용·보상, 클릭 영역, 실패 안내와 복귀 동선을
확인한다. 핵심 기능 안정화 후 화면 구조/조작 흐름을 확정하고 시각 디자인을 다듬는다.
기능 전체 또는 디자인 전체를 먼저 완벽하게 끝내려는 방식으로 진행하지 않는다.

**첫 작업 단위:** 격리된 신규 저장 fixture로 홈에서 전투 결과까지 실제 입력을 사용해
한 사이클을 확인한다. 별도 성장 fixture로 성장/장비 비용·효과·장착·복귀를 확인하고,
발견된 진행 차단/잘못된 안내부터 수정·회귀 검증한다. 이를 마친 뒤 디자인 수정의
구체적인 화면과 우선순위를 기록한다. 신규 콘텐츠 확장이나 전면 재설계는 현재 목표가 아니다.

**기존 계약과 남은 범위:**
- 천계의 혈통은 지급을 유지하고 스테이지 클리어 라벨로 설명한다.
- 방/생산 변경은 이전 단가 정산 후 변경과 함께 한 번 저장한다. 구매 자격은 정산 전
  보유 골드 기준이며 저장 실패 시 메모리와 저장 데이터를 유지한다.
- 장식·DM·지혜·명성의 단가 변경 경계는 미완료다. 통합 점검 중 관련 결함을 재현하면
  별도 작은 수정으로 처리하고, 기존 방/생산 검증으로 완료 처리하지 않는다.
- 과거 무한 모드 주행은 기록된 조건의 근거이며 장기 밸런스/전체 캠페인/native 완료가 아니다.

**검증과 작업 경계:**
- 최신 누적 코드: `npm test -- --maxWorkers=2` 144파일/3,267 tests, `npm run build` 통과.
  브라우저는 `output/playwright/room-income-settlement/verified/`의54검사/오류0이 최신 방 변경 근거다.
  해당 output은 Git 제외라 새 clone에는 없다. 필요 시 저장소의 `scripts/verify-*.mjs`로 재생성한다.
- Chromium 하니스는 한 번에 하나씩 실행하고 종료 후 전체 테스트를 수행한다. 표준 client의
  검은 canvas export는 시각 증거가 아니며 실제 page screenshot을 직접 확인한다.
- 개인 `.codex/hooks.json`, 사용자 저장과 다른 작업을 보존한다. 도구 경로·설치는 실제 환경에서
  확인한다. graphify가 있으면 저장소 지침대로 조회/AST 갱신하며 전역 설치를 임의로 하지 않는다.
- 이번 commit/push 승인은 현재 누적 작업의 원격 보존 범위다. Claude의 새 개발 결과에 대한
  commit/push·배포·native sync까지 자동으로 위임한 것으로 확장하지 않는다.

## 통합 플레이 점검 1차 — 2026-09-28 (Claude, 최신)

신규 저장으로 튜토리얼→설계/배치→MQ-001~003→PreBattle→전투→결과→Home→군단(먹이·장착)→공방→Home을
실제 입력으로 점검하고 13건을 수정했다. 핵심: 전투 결과가 Home 재진입마다 재지급되던 CRITICAL 회귀
(`'battle-result'` 계약이 `battleResult` 미소비), 트레이 커밋 후 지시·퀘스트 정산 멈춤, 최종 웨이브마다
전투/결과가 1/DPR로 축소, 퀘스트 팝업이 편집 레이어 아래·결과 요약을 폐기, 짧은 재진입마다 방치 모달,
튜토리얼 좌표·문구 불일치. 상세·검증·디자인 우선순위·설계 판단 항목은 결함 스윕 인계 §28.
**149파일/3,296 tests**, build, 하니스 room-staff 80/0·production-persistence 96/0 통과.
미커밋(사용자 요청 시 commit). production preview·일반 모션·native·실기기 미검증.

다음 작업: §28의 P1 화면(Home 보드 라벨·배치 트레이 정보·수호자 상세 장비 정보) 구조 확정 →
두 번째 전투 사이클(스테이지 선택 경로·패배 복귀)과 오늘의 손님 카드 경로 점검. 장비 소유 모델과
장식·DM·지혜·명성 단가 경계는 별도 결정/수정 범위로 유지한다.

## 누적 작업 Git checkpoint — 2026-09-28

사용자가 지금까지의 작업 commit/push를 명시 요청했다. `main`에서 진행도/세이브
`1704005`, 전투/장비 `cbd50f2`, 방치 경제/방 관리 `539e2f5`, graphify 규칙
`ebe568d`로 분리했다. 본 인계와 검증 기록은 후속 문서 commit에 포함한다.
현재 누적 코드의 전체144파일/3,267 tests(28.73초) 및 production build 재확인 통과.
개인 절대 경로의 `.codex/hooks.json`과 ignored 브라우저 산출물은 로컬에 보존한다.
Git remote가 없어 push는 아직 실행하지 못했으며 사용자에게 원격 URL을 요청했다.
아래 각 절의 미커밋/미푸시 표시는 해당 검증 시점의 과거 기록이다.

## 일반 방 변경 정산과 미설계 강화 차단 — 2026-09-28 (최신)

§27 완료. 일반 방 배치/해제·설계/건물 전환·강화 전에 이전 상태의 수익을 정산한다.
추천 일괄 배치는 같은 시각을 사용하며 강화 자격은 정산 전 보유 골드 기준이다.
상세 설계/강화와 추천 설계의 저장 실패 시 성공 연출을 중단한다. 브라우저에서 발견한
미설계 방 강화 버튼/비용 차감도 UI와 거래 함수 양쪽에서 차단했다.
신규10검사, 집중74, 전체 **144파일/3,267 tests**, build 통과.
최종 headless/동작 줄이기 브라우저 **54검사/오류0**: 실제 배치/해제/건설/강화 입력,
저장 실패 무변경·재시도1회·이전 단가 지급·reload 보존·미설계 강화 버튼 부재 확인.
근거 `output/playwright/room-income-settlement/verified/`와 상위 검사/빌드/graph 로그.
`final/`은 강화 차단 전 중간 결과여서 최종 근거에서 제외했다. 성공/실패 PNG 직접 열람,
기록된7개 해시 일치. 표준 client 검은 export 제외, Home text state 확인.
graphify AST 갱신(기존4경고), syntax/diff 통과. preview 종료. 일반 모션/native 미검증.
사용자 저장/commit/push/배포 없음. 기존 dirty 변경 보존.

다음 작업: Home→배치→성장→전투 통합 플레이/UX 점검. 저장·진행·보상의 핵심 결함을
우선하고 화면의 정보·행동·피드백을 확정한 뒤 시각 디자인을 다듬는다. 이는 사용자 질문에
대한 권고 순서이며 시각 디자인의 최종 수용을 받은 것은 아니다. 장식·DM·지혜·명성의
단가 변경 경계는 별도 미완료로 유지한다.

## 근무자의 방 복귀 정산과 저장 복구 — 2026-09-28 (최신)

§26 완료. `assignMonsterToRoomSlot`은 필수 timestamp를 받고 근무자의 이전 구간을
정산한 뒤 근무 해제·방 배치·퀘스트 진행을 한 결과로 반환한다. Home 저장 순서는 유지한다.
배치 트레이·몬스터 선택 창·추천 배치에서 저장 실패 안내와 기존 화면 유지/재시도를 지원한다.
일반 비근무자 배치 동작은 유지. 신규6검사(데이터5 중 수정 전4실패), 관련64검사 통과.
전체 **143파일/3,257 tests**, build 통과. headless/동작 줄이기 브라우저 **27검사/오류0**:
두 실제 pointer 경로, 저장 실패 복구, 이전 단가 지급, 저장1회, reload 보존 확인.
근거 `output/playwright/room-staff-settlement/reduced-headless/`, 상위 `tests-final.log`, `build.log`.
시간·저장 오류는 fixture 주입. 초기 퀘스트 보상 혼입·가려진 버튼 오선택·외부 전환 실행은
최종 근거에서 제외. 일반 모션 미검증. 표준 client 검은 export 제외, 실제 PNG 직접 열람.
해시 일치·syntax/diff 확인 및 graphify AST 갱신 완료(기존4경고). 이번 preview 종료.
다음은 일반 방 배치/해제와 방 건설/강화 시 운영 수익 정산이다. 장식·DM·지혜·명성도
별도 미완료 경계다. 사용자 저장/native/commit/push/배포 없음.

## 생산 변경 직전 이전 단가 정산 — 2026-09-28 (최신)

§25 완료. 생산 구역 건설·강화·근무 배정/이동/해제 전에 기존 상태의 미수령 구간을
정산한다. 명시 timestamp를 받는 pure transaction 결과에 수익과 명령을 합쳐 한 번 저장한다.
실패 시 모두 이전 상태를 유지하고 재시도는 한 번 지급한다. 성공 안내에 `적립분 수령` 추가.
구매 자격은 정산 전 보유 골드, 소수 진행분·상한·비용·배수는 유지한다.
신규8검사(수정 전7실패), 집중73, 전체 **141파일/3,251 tests**, build 통과.
브라우저 일반·동작 줄이기 각각 **96검사/오류0**, 실제 진입·저장 실패/재시도·단가 경계·
진행분·reload 확인. 시간은 fixture 주입, 분할 수령 reload 후 복귀만 직접 scene activation.
근거 `output/playwright/production-settlement/{reduced,motion}/` 및 `tests-final.log`.
성공 PNG 직접 열람, 해시 일치 확인, graphify AST 갱신. 표준 client 검은 export는 제외했다.
다음은 `assignMonsterToRoomSlot`으로 근무자를 방에 배치하는 역방향 경로의 정산과
저장 실패 처리다. 방/장식/DM·지혜·명성 변경 경계도 별도 미완료이며 이번 완료로 포함하지 않는다.
사용자 저장/native/commit/push/배포 없음. 이번 preview 종료.

## 반복 수령의 소수 진행분 보존 — 2026-09-22 (최신)

§24 완료. 짧은 주기로 골드를 수령할 때 느린 재료 생산이 계속0으로 초기화되던
문제를 수정했다. 선택 필드 idleRemainder로 수입원별 진행분을 보존하고 정수만 지급한다.
기존 저장은0으로 호환, 백업/reload 유지, 환생 시 골드 진행분만 초기화한다.
시계 역행으로 마지막 수령 시각을 되돌리는 경로도 막았다. 과거 유실분 복원은 없다.
신규14검사(최초9검사 수정 전 실패), 집중167, 전체 **140파일/3,243 tests**, build 통과.
브라우저 일반·동작 줄이기 각각 **70검사/오류0**, 10분×6 수령 총100골드·광석2·천1,
중간 reload 보존과 기존 생산 진입/실패 복구를 확인했다. 시간은 fixture 주입이다.
근거 `output/playwright/idle-remainder/final-reduced/`, `final-motion/`, 상위 최종 로그.
미수령 구간 전체에 현재 단가를 사용하는 기존 흐름은 유지했다. 다음 후속 범위는
시설 강화/배정 변경 전에 변경 전 단가로 구간을 정산하는 처리다.
graphify AST 갱신 완료. 사용자 저장/native 미접촉, commit/push/배포 없음.

## 생산 구역 진입·저장 실패 복구 — 2026-09-22 (최신)

§23 완료. 생산 수령·건설/강화·근무 배정/해제는 저장 성공 후 메모리를 반영하며,
실패 시 원래 상태로 명령판을 다시 그리고 재시도를 안내한다. 비용/수익/250ms 제한 유지.
실제 진입 검사에서 생산 버튼을 누르면 고정 군단 메뉴가 열리는 결함을 추가 발견했다.
StageSelect의 하단 스크롤 여백에 ROOT_NAV_HEIGHT를 포함해 생산 버튼 전체를 노출했다.
신규6검사 수정 전 실패→수정 후 통과, 집중56검사, 전체 **139파일/3,229 tests**, build 통과.
실제 Home→관문 드래그→생산 진입, 실패/재시도/연타/reload는 일반·동작 줄이기 각각
**51검사/오류0**. 건설150·강화270 차감, 수령100골드·광석4, 근무 이동·해제 확인.
근거 `output/playwright/production-persistence/verified-reduced/`, `verified-motion/`와
상위 최종 로그. 초기 진입 실패 receipt도 보존했다. graphify AST 갱신, owned preview 종료.
격리된 fixture와 저장 예외 주입이며 사용자 저장/native 미접촉, commit/push/배포 없음.

## 홈 방치 보상 저장 실패 복구 — 2026-09-22 (최신)

§22 완료. 홈 수령 시 저장 실패로 메모리만 갱신되고 once 버튼이 소진되어
패널에서 빠져나오지 못하던 문제를 수정했다. Home은 저장 성공 후 상태를 반영하고,
실패 시 패널과 버튼을 유지해 재시도한다. 파괴된 패널/종료된 씬의 콜백은 무시한다.
환생 정책·수익 계산은 유지한다. 집중24검사, 전체 **138파일/3,223 tests**, build 통과.
production 실제 실패/재시도/중복 클릭/reload는 일반·동작 줄이기 각각14검사/오류0.
골드200→300, 광석5→7, 저장1회와 메타 보존을 확인했다.
근거 `output/playwright/idle-claim/verified-reduced/`, `verified-motion/`, 상위 최종 로그.
예비 실패 원인과 제외 결과는 결함 스윕 §22에 기록했다. graphify AST 갱신 완료.
사용자 저장/native 미접촉, commit/push/배포 없음. 생산 구역의 별도 저장 handler는
후속 실패 재현 후보이며 이번 홈 검증으로 완료를 주장하지 않는다.

## 환생의 캠페인 초기화 누락 수정 — 2026-09-22 (최신)

§21 완료. 환생 확정이 게임 상태만 저장하고 별도 캠페인 진행도를 남기던 문제를
수정했다. 두 저장소 저장/실패 복구를 `saveGameStateWithCampaign`으로 공유하며
기존 세이브 import도 이 함수를 사용한다. 실패 시 환생 완료 callback을 실행하지 않고
재시도 안내를 표시한다. 영구 성장·보유 자산·백업 형식은 유지한다.
기존 UI3검사 보존 + 신규 저장5검사, 집중 **118 tests**, 전체 **137파일/3,219 tests**,
build/typecheck 통과. 원래 모듈로 되돌리면 신규 검사3개 실패, 수정 바이트 복원 확인.
production 실제 환생/취소/저장 실패 후 재시도/StageSelect/reload **17검사, 오류0**.
최종 근거 `output/playwright/prestige-progress/final/`, 상세는 결함 스윕 §21.
격리된 완료 fixture와 저장 실패 주입을 사용했다. 실제 사용자 저장/native 미접촉,
commit/push/배포 없음. 이전 receipt는 해당 시점 해시 기준으로 보존한다.

## 세이브 복원 비동기 취소·중복 처리 — 2026-09-22 (최신)

§20 완료. 클립보드 응답 대기 중 취소해도 세이브가 덮어써지던 문제와 확인 연타의
중복 요청을 수정했다. 설정창 파괴/씬 종료 뒤 늦은 응답·오류도 무시하며,
성공 후 예약된 800ms Home 재시작은 씬 종료 시 취소한다. 기존 백업 형식은 유지.
신규 lifecycle10 tests, 저장 전송 포함 집중22 tests 통과. 수정 전/되돌림 검사에서
8실패를 재현하고 수정 원문을 복원했다. production 브라우저 **26검사/오류0**.
전체 첫 실행은 기존 Endless 계산 검사1개의 5초 timeout이었고, 브라우저 종료 후
`npm test -- --maxWorkers=2`에서 **136파일/3,214 tests 통과**. 제한 시간·assertion 유지.
build 통과(기존 Phaser chunk advisory). 근거 `output/playwright/save-import-lifecycle/`.
OS 클립보드와 사용자 저장은 미접촉, 실제 권한/native 동작 검증은 아니다.
commit/push/배포 없음. 이전 receipt는 당시 해시 기준으로 보존한다.

## 세이브 백업의 캠페인 진행도 누락 수정 — 2026-09-22 (최신)

§19 완료. 내보내기/가져오기가 `dungeonGameState`만 처리해 별도
`dungeonStageProgress`의 해금·별·HP 기록을 잃거나 대상 기기 기록과 섞던 문제를 수정.
버전1 백업은 두 저장소를 포함하고, 기존 flat 코드도 해당 코드의 진행도로 복원한다.
잘못된 버전/진행도 거절, 저장 예외 시 첫 쓰기 롤백 검증을 추가했다.
집중112 tests, 전체 **135파일/3,204 tests**, build 통과. 최종 회귀 검사를 수정 전
함수로 실행하면 6개 실패하며 수정 파일은 바이트 단위 복원했다.
production 설정 화면의 실제 내보내기/취소/확인/복원/새로고침/오류 경로 **9검사**,
브라우저 오류0. 클립보드는 격리된 mock이며 OS 클립보드·사용자 저장에는 접근하지 않았다.
근거 `output/playwright/save-transfer/2026-09-22T06-59-26.991Z/` 및 상위 검사 로그.
graphify AST 갱신 완료(기존 Gradle3개/SynergyManager parser 경고는 로그 기록).
이전 §18·§17 해시는 당시 코드의 증거다. 이번 수정 뒤 전체 장기 주행을 재실행한 것은 아니다.
commit/push/배포 없음. 실제 클립보드 권한·native 복원과 프로세스 강제 종료 중 원자성은 미검증.

## Production 번들 통합 검증 — 2026-09-22 (최신)

§18 완료. 새 `npm run build` 산출물을 로컬 preview에서 실행해 **47검사 통과**.
하단 메뉴 이동, 지혜 실제 구매(145→140), 전체 새로고침 후 저장 유지,
StageSelect의 무한 던전 버튼과 방어 개시/확인 버튼으로 1웨이브 진입을 확인했다.
코어 HP 1520에 구매한 +20이 반영되고 침입자 2명이 실제 생성됐다.
9개 추가 허브는 직접 scene activation으로 렌더링 확인했으며 사용자 진입 경로 검증과
구분한다. JS/CSS 10개 응답 해시가 dist와 일치, 개발 모듈 요청·브라우저 오류 0.
전체 **134파일/3,192 tests**, build, syntax/diff 검사 통과. 기존 Phaser chunk 경고 유지.
최종 근거 `output/playwright/production-smoke/2026-09-22T05-09-40.859Z/`.
홈·구매·스테이지 진입·전투 page screenshot 시각 확인. 이번 범위는 검증 하니스와
기록 보강이며 런타임 변경 없음. 로컬 production smoke이며 배포/native 검증은 아니다.
§2·§3 및 후속 검증 범위 완료. commit/push/배포 없음.

## 무한 모드 연속 전투 재검증 — 2026-09-22 (최신)

§16 후속 완료. 최신 런타임에서 `golden` 변수·3배속·DM40/Lv40 수호자 9명/
Lv5 전투실 fixture로 **20웨이브 코어 사망, 멈춤·강제 보정 0회**를 확인했다.
10·20웨이브 HP 하한과 직전 큐 전달, 1·5·12웨이브 변수 적용, 결과 기록/저장 및
결과 씬 재진입 시 중복 지급 방지 통과. 결과는 142처치·23,938골드·영혼 수정6,
최고 기록20. source hash291개가 현재 코드와 일치한다. 전체 3,192 tests 통과.
하니스의 강제 종료를 제거하고 미완주는 기본 실패 처리한다. cap·budget·의도적인
종료 차단 세 검사도 각각 예상 실패를 검출했다. 임시 fault는 원문 해시 그대로 복원했다.
최종 근거 `output/playwright/endless-continuation/run-02/`, 상세는 결함 스윕 인계 §17.
이번 변경은 하니스·기록이며 게임 런타임의 최종 변경은 없다. 고정 fixture의 연속 전투
검증으로, 전체 도전 변수·경제 밸런스·native 실기기·장시간 메모리 검증을 뜻하지 않는다.
아래 장기 주행 미실행 표시는 이전 시점 기록이다. 기존 receipt와 dirty 상태 보존,
commit/push/배포 없음.

## 웨이브 준비 타이머의 늦은 초기화 — 2026-09-22 (최신)

장기 실행의 기존 종료 보정을 조사하다 실제 결과 버튼에서도 발생하는 결함을 재현했다.
‘다음 침입 즉시 시작’ 후 이전 준비 타이머가 새 웨이브의 `waveHasSpawned`를 false로
되돌리고 버튼을 다시 활성화했다. 새 웨이브 시작·방어선 확인·준비 교체·씬 종료 시
이전 타이머와 표시를 취소한다. 재진입 시 파괴된 준비 바 참조도 초기화한다.
상세는 결함 스윕 인계 §16. 전체 **134파일/3,192 tests**, build, 실제 Phaser
**12검사** 통과. 수정 전 플래그 초기화 1회와 prepTimer -1, 파괴된 바 재사용을
별도 receipt로 보존했다. 최종 근거는 `output/playwright/wave-prep/final-status/`.
이번 검증은 격리된 완료 웨이브·버튼·타이머·재진입 fixture다. 장기 연속 전투는
다시 실행하지 않았으며, §9의 세 번의 보정 모두 같은 원인이라고 단정하지 않는다.
다음 장기 검증에서는 기존 하니스의 강제 종료 보정 여부를 반드시 확인해야 한다.
기존 dirty 상태와 이전 endurance receipt 보존, commit/push/배포 없음.

## 무한 모드 마일스톤 HP 역전 — 2026-09-22 (최신)

기존 간헐 실패를 수정했다. 실행 중 직전 생성 큐 HP를 기록하고 마일스톤 총 HP가
직전의 1.12배 올림보다 작으면 대표 개체에 부족분만 더한다. 일반 웨이브도 기록을
갱신하며 새 실행에서 초기화한다. 적 종류·수·속도·보상과 저장 schema는 유지한다.
도전 변수 반영 후·웨이브 이벤트 반영 전의 큐 HP 계약이며 전술 난이도 보장은 아니다.
상세는 결함 스윕 인계 §15. 관련 95 tests, 전체 133파일/3,186 tests, typecheck/build,
실제 Phaser 11검사 통과. 18조건 × 32 seed × 140웨이브의 80,640개 큐 검증 포함.
근거: `output/playwright/endless-milestones/`. 아래 미해결 표시는 당시 기록이다.
§2·§3와 후속 재현 결함의 로컬 수정·검증 완료. organic 장기 난이도 재검증과
native 검증은 이번 범위에 포함하지 않았다. commit/push/배포 없음.

## 선조의 지혜 효용 — 2026-09-22

§3-4 완료. 9칸 상한을 넘는 지혜 슬롯당 던전 최대 HP +20을 적용한다.
DM8 이상 5등급은 +100 HP. 보드·DM 해금·비용·프레스티지·저장 형식을 유지하고
기존 투자에도 파생 계산으로 적용한다. 현재/다음 효과와 구매 확인을 실제 슬롯·HP로
표시하며 확인 중 효과가 바뀌면 거래를 거절한다. 상세는 결함 스윕 인계 §14.
관련 110 tests, 전체 133파일/3,182 tests, TypeScript/build, 브라우저 15검사 통과.
실제 구매·재진입·프레스티지·전투 코어 HP +100과 390×844 화면을 확인했다.
근거: `output/playwright/wisdom-overflow/`. §2 및 §3 네 항목 구현 완료.
기존 무한 모드 난수 기반 마일스톤 HP 비교는 별도 미해결이다.
기존 dirty 상태 보존, commit/push/배포 없음.

## 방 전력 성장 곡선 — 2026-09-22

§3-3 완료. 전력은 비교 점수로 유지하며 방 레벨 계수를 전투와 같은
`1.4^(level−1)`로 맞췄다. 실제 전투 계수는 유지하고 공유 helper로 연결했다.
성장·장비 미리보기와 추천이 고레벨 방 기여를 반영한다. 상세·제한은
`CODEX_HANDOFF_DEFECT_SWEEP.md` §13. 관련 139 tests, 전체 133파일/3,173 tests,
TypeScript/build, 실제 Phaser·막사 16검사 통과. 막사 캡처 직접 검수.
이전 무한 모드 난수 테스트의 간헐 실패는 이번에 발생하지 않았으나 미해결이다.
근거는 `output/playwright/room-power/`. 기존 dirty 상태 보존, commit/push/배포 없음.
당시 후속 항목인 §3-4는 위 최신 기록에서 완료했다.

## 제작 장비 누락 12건 구현 완료 — 2026-09-22

사용자가 §3의 세부 판단을 담당자에게 위임했다. 기존 방향 안의 수치·범위는 직접
정해 진행하고 성장·보상 구조의 큰 변경만 확인한다. §3-2의 나머지 5건도 구현했다:
천상의 검 5타 전체 50%, 왕관 인접 ATK +25%, 천상의 창 추가 마법피해 +20%,
신성 방패 전체 천상족 ATK +20%, 마법 핵심 마법 기본피해 +20%.
주/추가 슬롯·면역·오라 중첩·웨이브 초기화·3효과 표시까지 연결했다.
상세 계약·제한은 `CODEX_HANDOFF_DEFECT_SWEEP.md` §12.

관련 125 tests, 실제 Phaser 41검사와 장비/화면 59검사, 최종 typecheck/build 통과.
연결 무효화 5건 탐지·복원, audit 소스 해시 일치. 전체 suite는 3,160 통과·1실패:
기존 무한 모드의 무작위 마일스톤 HP 비교가 실패했고 변경 전 코드에서도 재현했다.
이 문제는 미해결이며 전체 tests 통과로 취급하지 않는다. 증거는
`output/playwright/equipment-specials/`, `equipment-complete/`, `equipment-special-mutations/`.
당시 후속 항목인 §3-3·§3-4는 이후 완료했다.
기존 dirty 상태를 보존했고 commit/push/배포 없음.

## 제작 장비 효과 — 2026-09-22 (첫 7건 시점 기록)

`CODEX_HANDOFF_DEFECT_SWEEP.md` §3-2 중 규칙이 제시된 7건을 구현했다.
피해 감소 4종·보스 기본피해 2종·월석 기본공속 1종이며, 현재 배치/교체/추가 슬롯과
제작·보관함·막사 표시를 연결했다. 상세 계약과 근거는 §11.
최종 130파일/3,137 tests, build, live Phaser 52검사 통과. 연결 무효화5건을
탐지·복원했고 audit의21개 소스 해시가 현재와 일치한다. 공방4개 캡처 직접 검수.
당시 나머지 5건은 구체 규칙 선택 질문을 보낸 상태였으며, 최신 완료 상태는 위 기록을 따른다.
§3-3/3-4도 미착수. 이전 시너지/Endless 근거를 새 장비 밸런스 검증으로 재사용하지 않는다.
기존 dirty 상태를 보존했고 commit/push 없음.

## 시너지 속도 효과 분리 — 2026-09-22 (최신)

사용자 승인에 따라 `CODEX_HANDOFF_DEFECT_SWEEP.md` §3-1 구현·검증 완료.
최신 계약과 근거는 해당 문서 §10. 구미호·해신의 적 이동 속도, 탈의 기본공격 속도,
달빛의 기본공격·액티브 쿨다운을 별도 필드로 분리해 실제 전투와 표시를 연결했다.
최고 티어 하나만 적용하는 기존 규칙은 유지한다. 당시 §3-2~3-4는 미착수였으며 최신 상태는 위 기록을 따른다.
타입 검사 / 3,111 tests / build / live Phaser 7조합 통과. 연결 무효화 3건도 탐지했고
원문 복원 후 정상 audit의 13개 소스 해시와 일치를 확인했다. 아래 §5 주행은 이번
변경 이전의 근거이며 새 밸런스 승률 검증이 아니다. commit/push 없음.

## 무한 코어 사망 후속 — 2026-09-22

`CODEX_HANDOFF_DEFECT_SWEEP.md` §5 검증 완료. 최신 근거와 한계는 해당 문서 §9에 있다.
무작위 `golden` 단일 주행에서 17웨이브 코어 사망 후 결과 씬·레지스트리·웨이브 일치·
신기록 네 어서션이 모두 통과했다. 1·5·12웨이브 스폰 probe도 통과했고 결과 화면을
직접 확인했다. 2·4·6웨이브에는 기존 하니스의 빈 웨이브 종료 보정이 있어 완전 무개입
플레이 검증으로 해석하지 않는다. 감사 파일은 `tools/endless-endurance-audit.json`.
전체 3,065 tests 및 하니스 문법 검사 통과. 이번 후속은 진행 로그와 검증·인계 기록만
갱신했으며 게임 런타임 변경은 없다. §3은 사용자 결정 전 미착수. commit/push 없음.

## 결함 스윕 후속 — 2026-09-21

`CODEX_HANDOFF_DEFECT_SWEEP.md` §2의 7건은 current worktree에서 수정·검증 완료.
구현 판단·사용자 결정(천계의 혈통 지급 유지)·소스 무효화 검사는 해당 문서 §8이
최신 기록이다. 근무자의 운영 수익 유지, 지급/생산 표시 공통 계산, 실제 슬롯 해금,
실제 웨이브 HP 기반 권장 DEF, 스킨 카탈로그 목표를 반영했다.
`main@6e4e905` 위 미커밋 변경이며 tsc / 3,065 tests / build / 브라우저 7건 통과.
당시 §3 설계 4건과 §5 무한 코어 사망 장기 주행은 미착수·미검증이었다.
§5의 최신 완료 결과는 위 2026-09-22 기록을 따른다.
기존 dirty 설정과 과거 아트·디자인 증거는 보존했다.

## Boot follow-up — 2026-09-07 (latest)

`docs/design/CHARACTER_B1_BOOT_PROFILE.md` supersedes the next-action suggestion
in the earlier B1 snapshot below. Alternating nine/96 versus four/48 response-only
ablation was completed without runtime edits. Two complete-inventory series
(16 contexts) recorded0 errors/source drift. Post-warm-up medians were693/661ms
and1086/1007ms. The previous2.4–3.8s delay did not reproduce; its cause is not
established. Do not interpret diagnostic variability as a proven optimization.

Next gate is a recorded production/device baseline and readiness budget before
performance acceptance or loading-architecture changes. Existing B1 functional
acceptance remains intact. Final profiler: `scripts/profile-character-b1-boot.mjs`;
latest receipt: `tools/character-b1-boot-profile-paired04.json`. Old receipts and
assets remain unchanged; no commit/push/native operation was performed.

## Current B1 verification — 2026-09-07

- Approved scope and live execution: `docs/design/CHARACTER_B1_SPEC.md` and
  `docs/design/CHARACTER_B1_IMPLEMENTATION.md` (Astra plan, model-routed implementation).
- Five B1 art exports accepted in `tools/character-b1-assets.json`; runtime code,
  command verification, browser functional gates and independent Astra review passed.
  IDs: `village_archer`,
  `dokkaebi_junior`, `gold_turtle`, `fire_dokkaebi`, `sage`.
- Current command receipt: `tools/character-b1-verification.json` records
  105 files / 2904 tests, build, exporter 13 tests and legacy136 checks. Its 12
  source hashes match the current runtime.
- `tools/character-b1-audit.json`: 27 captures, 5 contact sheets, 19 isolated
  fixtures at360×800/390×844/430×932 DPR2;0 failures/console/network/source drift.
  Normal/reduced motion each passed3 panel and3 route cycles; Quest55 objects
  leave0 live objects/input registrations/tween targets after close. Parent
  visually reviewed all5 contacts plus full-size edge-case captures.
- Browser fixture coverage is not organic acquisition/campaign/native evidence.
  Boot timings are reported separately, without a speed PASS; current context is
  WebGL1.0, while the historical baseline did not record its actual GL version.
- Next priority before B2: profile the boot slowdown. Exact baseline-matched
  samples in `tools/character-b1-boot-matched.json` are3391.4347/3759.0004/
  2399.6640ms, versus baseline1090.2105/615.749333/622.938542ms. Functional
  acceptance does not close this performance question. Use a controlled paired
  comparison, retain all observations, and identify the direct owner before fixes.
- Owned Vite PID27680 is stopped; TCP8083 has no listener. Restart a task-owned
  local server for the next diagnostic run; do not stop unrelated browser/server processes.
- Preserve the existing dirty checkout, all legacy136 JPGs, previous four master/
  runtime assets and old audits. B1 creates separate evidence; no new Goal or Git
  delivery/native/publishing action. Detailed ownership lives in the B1 plan.
- The dated September 5 record below remains historical evidence; its four-art
  count and 48px world-bake observation are not a current B1 completion claim.

> Snapshot: 2026-09-05, Asia/Seoul
> Workspace: `/Users/sungjin/dev/personal/dungeon md/dungeon-phaser`
> Branch/HEAD at snapshot: `main` / `68546cb feat: complete monster portrait integration`

이 문서는 다른 agent/tool이 현재 디자인 작업을 안전하게 이어가기 위한 내부
운영 문서다. 구현·검증 사실은 live code, `git diff`, 테스트 출력, 렌더 증빙이
이 문서보다 우선한다. 이 문서에 `완료`라고 적힌 항목도 commit, release,
store-ready를 뜻하지 않는다.

## 1. Outcome

최신 사용자 요청은 캐릭터와 전체 디자인의 게임 기획 정합성이다.
`docs/design/CHARACTER_ART_REVISION.md`가 이 후속 범위의 실행 계획이다.
기존 17개 web surface 완료와 캐릭터 전종 개정은 별개다. 현재 대표 네 종의
versioned art와 shared portrait/token/theatre 연결을 구현했고, 60개 browser capture와
75개 행동·fallback receipt를 검증했다. A0–A4, 독립 code/context/QA review와
인수인계 동기화가 완료되었다. 기존 136 JPG와 이전 evidence를 그대로 보존한다.

2026-09-05 web-completion implementation and verification are recorded in
`docs/design/WEB_COMPLETION_PLAN.md`. All 17 scoped surfaces now have contracts
and evidence in the current worktree, including EndlessResult/Cinematic and
three-viewport aggregate first-state smoke. G0–G5 and independent code/QA/context
reviews are COMPLETE/PASS; earlier dated surface records remain historical evidence.

390×844 portrait canvas에서 플레이어가 첫 화면부터 자신을 던전마스터로
인식하고 다음 loop를 잃지 않게 만든다.

```text
던전 약점 확인
  → 방/수호자/장비 보강
  → 준비도 변화 확인
  → 침입 방어
  → 보상과 군단 확장
  → 다음 보강 선택
```

화면은 generic dashboard나 bright card pack이 아니라 하나의 살아 있는
Korean-folklore dungeon으로 연결되어야 한다. 각 surface는 `현재 상태 → 다음
행동 → 예상 결과`를 한 번에 설명하고, primary action은 하나만 우세해야 한다.

## 2. Mandatory reading order

다른 agent는 수정 전에 아래 순서로 읽는다.

1. `AGENTS.md` — 작업 권한, 안전 규칙, 390×844 기준, verification 명령
2. `docs/design/AGENT_HANDOFF.md` — 현재 snapshot과 다음 작업 경계
3. `docs/MONSTER_DUNGEON_DESIGN.md` — 전역 design authority와 장기 roadmap
4. `docs/design/DESIGN.md` — 실제 완료 surface별 contract와 evidence
   현재 캐릭터 작업은 `docs/design/CHARACTER_ART_REVISION.md`도 읽는다.
   게임 루프·경제·성장 곡선 작업은 `docs/design/GAME_DESIGN_BENCHMARK.md`
   (2026-09-17 승인)를 읽는다 — `MONSTER_DUNGEON_DESIGN.md`가 DEFER한
   economy/meta-progression 범위를 이어받는 제안서다.
   Phase 2(침입 예보·명성) 구현은 `docs/design/PHASE2_NOTORIETY_FORECAST.md`의
   데이터 모델·트랜잭션·테스트 계약을 따른다.
5. `CLAUDE.md` — scene/data/runtime 구조 참고
6. 대상 scene, 연결 UI, data transaction, 관련 tests
7. `git status --short --branch`와 대상별 `git diff -- <paths>`

Authority 우선순위는 `AGENTS.md → live code/tests →
docs/MONSTER_DUNGEON_DESIGN.md → docs/design/DESIGN.md → 이 handoff →
README.md`다. `README.md`의 2026-06 “모든 pass 완료” 문구는 과거 roadmap
기록이며, 2026-09 redesign 완료 범위를 판단하는 근거로 사용하지 않는다.

## 3. Runtime and fixed constraints

- Runtime: Phaser 3.88 + TypeScript + Vite 5 + Capacitor 8
- Logical canvas: 390×844, FIT scale, DPR-aware rendering
- Main entry: `src/main.ts`; local dev server: `npm run dev` on port 8083
- Direct QA route: `?skipTutorial=1&scene=<SceneName>`
- Persistence: `dungeonGameState` through `loadGameState()` / `saveGameState()`
- Runtime color authority: `src/constants/colors.ts`
- Shared UI first: `src/ui/GameUiPrimitives.ts`
- Root navigation authority: `src/data/navigationContract.ts`
- Core text: 10px minimum; primary/tabs/reward/purchase targets: approximately
  44px or taller
- Motion: 120–320ms feedback by default; required information must appear without
  motion under `prefers-reduced-motion: reduce`

UI scene에서 `GameState`를 직접 mutate하지 않는다. 상태 변경은 기존
`src/data` transaction을 호출하고 반환된 새 객체만 저장한다. 새 dependency,
save field, balance, route, asset, native shell, store metadata는 별도 승인이 없는
한 추가하지 않는다. 2026-09-05 캐릭터 개정 요청에 따른 대표 네 종의
`ritual-v2` asset과 presentation registry는 명시된 예외다.

## 4. Worktree safety — highest priority

현재 checkout은 clean commit이 아니다. `main@68546cb` 위에 design, combat,
portrait, data, native 설정, 문서, screenshot 변경이 대량으로 섞인 dirty
worktree다.

- 현재 worktree가 이어서 작업할 기준이다. `git reset`, `git checkout --`,
  `git clean`, 광범위한 restore를 실행하지 않는다.
- 미추적 `docs/design/`, tests, helpers, screenshots도 사용자 작업으로 보존한다.
- Android/Capacitor/package와 기존 legacy monster-art 변경은 이번 캐릭터 개정의
  소유 범위가 아니다. 새 `ritual-v2` 경로만 추가하며 기존 JPG는 덮어쓰지 않는다.
- 변경 전후에 대상 path만 `git diff -- <paths>`로 비교한다.
- commit, stage, push, merge, PR, native sync, publishing은 명시 요청 전까지 하지
  않는다.
- 완료 보고는 `current worktree에서 구현·검증됨`으로 표현한다. `main에 반영됨`,
  `release-ready`, `native-ready`라고 표현하지 않는다.

## 5. Design contract already established

### Visual thesis

- Base surfaces: charcoal/indigo stone, soot, iron
- Interaction/reward: restrained brass
- Ready/production/success: jade
- Threat/damage/deficit: ember
- Summon/occult identity: moonlight accent
- Forge/equipment work: copper
- Rarity and chapter colors decorate identity; they do not replace labels
- Structure comes from composition, spacing, silhouette, and cutaway space before
  border, glow, bevel, or card count

### Rejected patterns

- glossy candy caps, cream card piles, pill soup, glassmorphism, neon dashboard
- emoji-only navigation or control affordances
- several CTAs with the same visual weight
- unavailable action that looks enabled
- color-only cost, rarity, readiness, damage, or lock state
- decorative infinite motion without reduced-motion handling
- presentation work that changes economy, eligibility, rewards, save schema, or route

## 6. Completed range in the current worktree

`COMPLETE` means the scoped surface was implemented and received its recorded
unit/build/browser evidence. It does not mean the repository is committed or the
whole game is finished.

| Surface | Status | Implemented outcome | Main code anchors | Evidence authority |
| --- | --- | --- | --- | --- |
| Dungeon Home | COMPLETE | Dashboard를 entrance→rooms→heart→next seal의 living dungeon overview로 변경; 하나의 readiness directive와 spatial target 유지 | `DungeonHomeScene.ts`, `HomeBoard*`, `HomeChrome.ts`, `HomeCommandDeck.ts`, `DungeonBoardLayout.ts` | `DESIGN.md` / Dungeon Home contract |
| Invasion path | COMPLETE | Stage Select를 gate/corridor frontier로, Pre-Battle을 threat→room weakness→launch briefing으로 정리 | `StageSelectScene.ts`, `PreBattleScene.ts`, `PreBattleDefenseUI.ts`, `InvasionUI.ts` | `DESIGN.md` / Invasion Readiness contract |
| Monster raising | COMPLETE | Barracks와 monster detail을 portrait-first growth, equipment, room recommendation 화면으로 변경 | `BarracksScene.ts`, `BarracksGrowthHall.ts`, `BarracksCard.ts`, `MonsterDetail*.ts` | `DESIGN.md` / Monster Raising contract |
| Forge | COMPLETE | target guardian, blueprint, materials, expected power delta, craft/equip/dismantle 흐름을 한 readiness surface로 연결 | `ForgeScene.ts`, `ForgeWorkbench.ts`, `ForgeTabs.ts`, `ForgeCraftFx.ts` | `DESIGN.md` / Forge Readiness contract |
| Room editing | COMPLETE | room detail 첫 viewport를 actual guardian/trap/equipment socket이 보이는 cutaway editor로 변경 | `RoomDetailOverlay.ts`, `RoomDetailInterior*.ts`, `RoomDetailOperations.ts`, `RoomPickerModals.ts` | `DESIGN.md` / Room Editing contract |
| Battle command/outcome | COMPLETE | formation/route/HUD/briefing/tactical dock/boss/result hierarchy를 같은 dungeon language로 통일 | `DungeonScene.ts`, `UIScene.ts`, `BossHud.ts`, `SkillHUD.ts`, `ResultPanel.ts`, `StageClearFlow.ts` | `DESIGN.md` / Battle Command & Outcome contract |
| Summon altar | COMPLETE | bright gacha cards를 physical altar, contract ledger, affordability/pity, history, bounded single/ten-pull result로 교체 | `SummonScene.ts`, `SummonShowcase.ts`, `SummonHistory.ts`, `SummonAnimations.ts`, `SummonPullLogic.ts` | `DESIGN.md` / Summon Altar contract |
| Fusion chamber | COMPLETE | bright emoji 연구소를 four-rite dungeon chamber로 교체하고, 비용·소비·결과·위험·persistent receipt를 한 viewport 흐름으로 연결 | `FusionScene.ts`, `FusionTabs.ts`, four `Fusion*Tab.ts` renderers, `FusionSelectionState.ts` | `DESIGN.md` / Fusion Chamber contract |
| Shop quartermaster | COMPLETE | unbounded bright catalog를 resource ledger, bounded shelves, safe preview, confirm/receipt가 연결된 dungeon quartermaster로 교체 | `ShopScene.ts`, three `Shop*Tab.ts` renderers, `ShopShared.ts` | `DESIGN.md` / Shop Quartermaster contract |
| Production district | COMPLETE | 반복 facility card를 one undercroft cutaway, capped collection cistern, selectable stations, exact command/receipt 흐름으로 교체 | `ProductionScene.ts` | `DESIGN.md` / Production District contract |
| Decoration reliquary | COMPLETE | long card catalog를 four set seals, three relic pedestals, tier ledger, exact acquire/place/remove command와 durable receipt로 교체 | `DecorationScene.ts` | `DESIGN.md` / Decoration Reliquary contract |
| Abyss expedition | COMPLETE | 60-card depth stack을 five-floor shaft window, threat/material ledger, one challenge-or-sweep command, durable return receipt와 supply routes로 교체 | `AbyssScene.ts` | `DESIGN.md` / Abyss Expedition contract |
| Achievement hall | COMPLETE | masked 79-card scroll을 eight category seals, all-84 bounded archive, selected reward ledger, once-only claim과 durable receipt로 교체 | `AchievementScene.ts` | `DESIGN.md` / Achievement Hall contract |
| Codex archive | COMPLETE | omitted/scrolling archive를 all-136 guardian registry, 52 invaders, 17 modifiers, 13 events의 bounded records와 fresh-save tribe reward command로 교체 | `CodexScene.ts`, `CodexMonsterDetail.ts`, `CodexShared.ts` | `DESIGN.md` / Codex Archive contract |
| Ancestral wisdom | COMPLETE | clipped emoji radial map을 four lineage seals, all-12 named branch tablets, exact current→next ledger, shielded once-only upgrade와 durable receipt가 있는 ritual chamber로 교체 | `AncestralWisdomScene.ts`, `AncestralWisdomShared.ts` | `DESIGN.md` / Ancestral Wisdom Chamber contract |
| Endless result | COMPLETE | 종료된 run의 기록·보상·modifier를 expedition memorial에 표시하고 중복 지급 없는 retry/return을 연결 | `EndlessResultScene.ts` | `DESIGN.md` / Endless Result contract, `tools/endless-result-audit.json` |
| Cinematic chronicle | COMPLETE | 원본 대사를 stone theatre와 speaker/folio로 표시하고 reveal·advance·skip·auto-pause를 owned lifecycle로 연결 | `CinematicScene.ts` | `DESIGN.md` / Cinematic contract, `tools/cinematic-audit.json` |

### Completion details that must be preserved

- Home, room, Barracks, Forge, Pre-Battle은 동일한 readiness vocabulary와
  focused-room return context를 사용한다.
- Root navigation은 `dungeon / legion / forge / invasion` 네 zone을 유지한다.
  Summon, Codex, Shop, Fusion, Skill은 Legion 내부 route이지 root zone이 아니다.
- Battle result와 Summon result의 background input shielding, once-only action,
  reduced-motion, delayed callback cleanup을 약화하지 않는다.
- Summon은 rapid cross-button input에도 transaction 한 번만 저장하도록
  scene-level in-flight latch를 사용한다.
- Fusion은 CTA `pointerdown`에서 scene-level transaction latch를 획득하고,
  confirmation/animation/result 전체에서 background input을 차단한다.
- Combination retained source는 live owned roster와 다시 결합한다. 선택한 copy가
  사라졌으면 같은 ID의 실제 남은 copy를 표시·사용하고, source가 없으면 slot을
  비운다. Transaction authority도 미보유 source를 거부한다.
- Shop은 card skin purchase와 preview purchase-and-equip을 구분한다. Theme purchase는
  즉시 equip하고, owned theme/skin의 equip·unequip은 추가 결제 없는 reversible action이다.
- Shop purchase confirmation은 scene-level latch와 full-screen shield를 유지한다.
  Daily offer는 confirm 시 현재 UTC catalog에 다시 포함되는지 검증하며, 자정에
  교체된 offer는 저장 없이 거부하고 latch 해제 뒤 한 개의 scene timer가 shelf를 갱신한다.
- Production은 selection을 저장하지 않고 build/upgrade와 collect만 기존 pure
  transaction으로 저장한다. 현재 render의 enabled action은 once-only이며, facility
  비용·rate·max와 idle cap/decoration multiplier는 data authority를 그대로 따른다.
- Decoration은 set/relic selection을 저장하지 않고 acquire/place/remove만 기존
  pure transaction 결과로 저장한다. 12개 catalog, 비용, slot scaling, tier와 bonus
  aggregation은 data authority를 그대로 따르며 transaction latch와 durable receipt를 유지한다.
- Abyss는 page/floor selection을 저장하지 않는다. Daily key refill, cleared-floor
  sweep, next-floor battle, first-clear loot/depth, 60-floor scaling/boss/loot/wave
  authority는 기존 data/transaction/result flow를 유지하며, rapid/cross-input latch와
  persistent sweep/return receipt를 보존한다.
- Achievement는 category/page/record selection을 저장하지 않는다. 79개 base와
  5개 epilogue definition, progress/unlock 계산, individual/claim-all reward
  transaction, save schema, previous-scene return은 기존 authority를 유지한다.
  Pointer-down transaction latch, 250ms cooldown, durable receipt, stale-claim
  non-mutation, all-84 reachability를 보존한다.
- Codex는 tab/group/page/record/filter selection을 저장하지 않는다. Eleven tribes와
  presentation-only `기타`가 136종을 모두 노출하고, nine chapters의 52 invaders,
  17 modifiers, 13 events를 bounded controls로 열어야 한다. Tribe requirement는
  mapped reward와 모든 `codex_reward` record를 제외하고 fresh save에서 다시 계산한다.
  Existing reward transaction, previous-scene return, four-zone root navigation,
  route/transaction shared latch, persistent receipt, all-record reachability를 보존한다.
- Ancestral Wisdom은 lineage/branch selection을 저장하지 않는다. Four lineages가
  authoritative 12 branches를 정확히 한 번씩 노출하고, live code에 실제 존재하는
  `upgradeWisdomBranch`만 호출한다. Confirm 당시 branch/tier/cost/balance snapshot과
  fresh save가 정확히 일치할 때만 returned success state를 한 번 저장하며,
  confirm/cancel shared admission, pending-render guard, 250ms cooldown, full-screen
  shield, durable success/stale receipt, previous-scene return을 보존한다. Equip/reset
  transaction이나 save field는 없으므로 새로 만들지 않는다.
- Portrait asset이 없으면 기존 procedural fallback이 동작해야 한다.
- EndlessResult는 upstream registry receipt만 표시하며 저장·보상을 재실행하지
  않는다. Retry의 `{ stageNumber: 0, slots: 9, endless: true }`, StageSelect return,
  첫 pointerdown route latch를 유지한다.
- Cinematic은 기존 text/order/side/pause와 caller nextScene/nextData, entry 시
  seen-once 저장을 유지한다. Phase/version admission과 line-owned timer/tween
  cleanup으로 중복 advance/finish와 stale auto-pause를 차단한다.

### Latest aggregate evidence

2026-09-05 character-art revision record:

- First four of136 redesigned; remaining132 and all existing JPGs preserved.
- Focused3files/40tests, full104files/2,876tests, TypeScript, production build,
  legacy portrait check and diff-check passed; large-chunk advisory remains.
- `tools/character-art-audit.json`:60 DPR2 captures,3 viewports, normal/reduced
  speaker input, exact save neutrality after entry, real renderer fallback and
  three-entry lifecycle. No console/runtime errors, enforced failures or source drift.
- 8 contact sheets visually reviewed;75 receipts passed;81 hash entries matched.
  Independent code/export, context and QA cross-reviews PASS. Owned browsers and
  dev server closed;TCP8083 listener absent. No stage/commit/push/native/publish.
- Exact scope and known observations: `CHARACTER_ART_REVISION.md`. Seeded fixtures
  are not organic campaign/acquisition; 8px decorative route-order and 48px world
  sprite softness remain pre-existing limitations, not covered-up zero-debt claims.

2026-09-05 overall web-completion record (before character-art revision):

- Focused wave/modifier 2 files / 18, story/cinematic 2 files / 76,
  Barracks/Summon/HUD 4 files / 186 tests passed.
- Full `npm test`: 103 files / 2,846 tests passed; TypeScript, production build
  and diff-check passed. Existing Vite large-chunk advisory remains.
- Aggregate browser smoke: 45 initial-state captures + three active-banner
  captures at 360×800 / 390×844 / 430×932, DPR 2. Four root routes and four
  selection-save neutrality checks passed; no runtime/console errors, fixed
  overflow, rendered sub-10px logical text or sub-44px logical targets.
- EndlessResult: 15 state captures, all 17 modifiers, normal/reduced route races,
  stable three restarts and upstream +9 crystals with neutral redisplay passed.
- Cinematic: all 21 definitions / 80 lines in both motion modes (160 checks),
  six alternate-size representative states, seen-once and exact contextual route,
  pause/input races and lifecycle checks passed.
- Reproducible scripts and exact source/PNG hashes are in `scripts/verify-*.mjs`
  and the three JSON ledgers referenced in section 18. Independent code/authority,
  QA/evidence and goal/context reviews passed. All 34 source-hash entries and 73
  image-hash entries matched; 198 literal document paths and fences passed.
- Verification browsers and the owned Vite server were closed; TCP 8083 listener
  absent. No commit/stage/push/merge/PR/native sync/publishing performed.
- This is first-state responsive smoke plus scoped interaction evidence, not
  every nested modal, organic campaign/endless/Abyss completion or native QA.

2026-09-03 current-worktree record:

- Full `npm test`: 99 files, 2,824 tests passed
- `npm run build`: passed
- `git diff --check`: passed
- Vite의 existing large-chunk advisory는 남아 있음
- 390×844, DPR 2 browser smoke에서 변경 scene의 application exception/console
  error가 보고되지 않음
- 세 독립 review angle(goal/context, code/security, QA/evidence)이 Summon close-out을
  PASS 처리함

2026-09-04 Fusion close-out record:

- Focused Fusion checks: 3 files, 128 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 100 files, 2,830 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: 19 state captures, transaction
  receipts, normal/reduced-motion race, three-cycle cleanup, stale-source guard,
  console/runtime audit passed; recorded SHA-256 values matched all PNGs
- Three independent review angles(goal/context, code/security, QA/evidence) passed
  after the stale-source fix and coupled-document synchronization

2026-09-04 Shop close-out record:

- Focused Shop checks: 3 files, 25 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed
- Final-source 390×844, DPR 2 browser harness: four catalogs, bounded pagination,
  preview/confirm/result shields, cancel/success/failure, card-versus-preview skin
  semantics, theme fallback, daily purchases, rapid/cross-tab input, simulated UTC
  rollover rejection, Barracks return, and three-cycle cleanup passed
- Independent review angles found and closed the UTC rollover stale-offer edge;
  final goal/context, code/security, and QA/evidence verdicts are recorded at close-out

2026-09-04 Production close-out record:

- Focused Production/idle/HUD-formatting checks: 4 files, 39 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: empty/deficit, operating/capped,
  maxed, build/upgrade/collect receipts, selection non-mutation, disabled actions,
  normal/reduced rapid and cross-input, post-cooldown retry, high-balance HUD,
  back route, and three-cycle lifecycle passed
- Eight screenshot hashes and exact transaction deltas are recorded in the
  Production District contract

2026-09-04 Decoration close-out record:

- Focused decoration/transaction/idle-income checks: 3 files, 43 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: four sets, twelve relics,
  gold/craft acquisition, place/remove, tier transition, deficit/full-slot,
  normal/reduced rapid and cross-input, post-cooldown recovery, high-balance HUD,
  back route, and three-cycle lifecycle passed
- Eleven screenshot hashes and exact state deltas are recorded in the Decoration
  Reliquary contract
- Independent goal/context, code/transaction, and QA/evidence reviews passed
  after the contract/progress wording was synchronized to the implemented scope

2026-09-04 Abyss close-out record:

- Focused Abyss checks: 2 files, 34 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation, evidence, and handoff synchronization
- Final-source 390×844, DPR 2 browser harness: five-floor paging through all 60
  targets, save-neutral selection, daily refill, no-key disabled action, sweep
  receipt/deltas, rapid/cross-input and cooldown recovery, boss challenge registry,
  returned win/loss one-time consumption, max floor, three routes, and three-cycle
  lifecycle passed
- Ten screenshot hashes and exact state/registry receipts are recorded in the
  Abyss Expedition contract
- Independent goal/context, code/transaction, and QA/evidence reviews passed after
  the route-listener race fix and final coupled-document synchronization

2026-09-04 Achievement close-out record:

- Focused achievement/progression/reward checks: 4 files, 187 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: eight categories, all 84 unique
  records over 28 pages, save-neutral navigation, individual/cooldown/claim-all,
  epilogue and stale claims, claim/back race, exact receipts, reduced motion, and
  three-cycle lifecycle passed with zero timers/tweens/scene drag listeners
- Ten screenshot hashes and exact transaction deltas are recorded in the
  Achievement Hall contract
- Independent goal/context, code/transaction, and QA/evidence reviews passed
  after the reduced-motion latch-release fix, current-source browser regeneration,
  and coupled-document synchronization

2026-09-04 Codex close-out record:

- Focused Codex/monster/reward/navigation checks: 10 files, 500 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,841 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Browser evidence reached all 136 guardian records, twelve groups, all 52
  invaders/nine chapters, 17 modifiers, and 13 events without save mutation;
  the final source's two additional route-latch statements were covered by the
  subsequent current-source visual, transaction, modal, and route/race reruns.
  Individual/aggregate/already-owned/stale reward paths, duplicate/cross-input,
  cooldown retry, detail isolation, normal/reduced route races, contextual/root
  routes, and three-cycle lifecycle passed with exact receipts.
- Ten final screenshot hashes, four source hashes, exact transaction deltas, and
  the standard-client boundary are recorded in the Codex Archive contract.
- Independent goal/context, code/transaction, and QA/evidence reviews passed
  after closing a reduced-motion route-to-order race and synchronizing the
  three-versus-four page-size wording and completion records.

2026-09-04 Ancestral Wisdom close-out record:

- Focused Wisdom/presentation checks: 3 files, 96 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 103 files, 2,846 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: all four lineages/all twelve
  branches, save-neutral selection, affordable/deficit/maxed states, exact
  `goldHands 2→3` and soul-crystal `100→80` success, shield/cancel, exact stale
  snapshot rejection, normal/reduced cross-input, cooldown recovery, contextual
  and fallback return, and three-cycle lifecycle passed
- Seven final screenshot hashes, three source hashes, four authority hashes,
  exact transaction deltas, and the standard-client boundary are recorded in
  the Ancestral Wisdom Chamber contract
- Independent review findings closed the confirm/cancel admission race,
  fresh-save consequence drift, branch→obsolete-order lock, and coupled-document
  gaps; final goal/context, code/transaction, and QA/evidence verdicts passed

상세 screenshot path, SHA-256, interaction receipt, iOS 검증 여부는
`docs/design/DESIGN.md` 각 contract의 dated `Verification record`를 사용한다.
Fusion, Shop, Production, Decoration, Abyss, Achievement, Codex, Ancestral Wisdom은 2026-09-04 record,
이전 surface는 각 기록 날짜가 권위다. Battle, Summon, Fusion, Shop,
Production, Decoration, Abyss, Achievement, Codex, Ancestral Wisdom은 web renderer 기준이며 전체 native
release readiness를 의미하지 않는다.

## 7. What is not complete

현재 계획의 17개 surface redesign은 완료되었다. 아래는 후속 acceptance이며,
기능이 없다는 뜻이나 이미 검증한 화면을 다시 구현하라는 지시가 아니다.

- 현재 우선순위는 `CHARACTER_ART_REVISION.md`의 캐릭터 개정이다. 첫 네 종을
  기준으로 남은 132종과 NPC/invader의 batch acceptance를 순차 확정한다.
  네 종 완료를 all-136 redesign이나 전체 native-ready로 보고하지 않는다.
- progression-valid organic gameplay acceptance: **캠페인 CLOSED 2026-09-19**
  (18스테이지 실측, 패배 0 — 아래 표). **심연 CLOSED 2026-09-19** (깊이 곡선
  복구 + 4개 층 organic). 남은 것은 **무한(endless) 내구 주행**이다. 캐릭터
  요청이 balance/data/native 변경 권한을 열지는 않는다.
- ~~Nested modal/selection/result states at 360×800 and 430×932~~
  → CLOSED 2026-09-16. Viewport 축은 구조적으로 닫혔고, modal/selection/result
  17개 상태를 재현 가능한 하네스로 감사했다. 아래 기록 참조.
- ~~Abyss floor battle의 launch→organic win/loss return full E2E play-through~~
  → CLOSED 2026-09-16. hand-off 계약과 organic 전투 양쪽 모두 닫혔다.
  아래 기록 참조.
- ~~옵션 B 홈 던전 단일화 (Phase 1)~~ → 구현 CLOSED 2026-09-17, organic 검증 기록은 아래 참조.
- ~~함정 제작·융합·숙련·콤보 (Phase 3a/3b)~~ → 구현 CLOSED 2026-09-18 (phase2 브랜치, main 병합 `0bfd911`), 아래 기록 참조.
- ~~운영 수익 통합·몬스터 근무 (Phase 3, P1 ③④)~~ → 구현 CLOSED 2026-09-18, 아래 기록 참조.
- ~~수호자 레벨 전투 배선 + 교감 (Phase 3, P3 ②)~~ → 구현 CLOSED 2026-09-18, 아래 기록 참조.
- ~~계보도 · 목표 핀 (Phase 3, P3 ①)~~ → 구현 CLOSED 2026-09-18, 아래 기록 참조. 부족별 트리 *시각화*(전체 그림)는 하지 않았다 — 상세 스트립 + 홈 directive로 노출.
- ~~중복 소환 → 각성석·부족 조각 (Phase 4, P4 ②)~~ → 구현 CLOSED 2026-09-18, 아래 기록 참조.
- ~~페이싱 모델이 수호자를 Lv1로 가정하던 문제 (시뮬 vs organic 불일치의 진짜 원인)~~ → 수정 CLOSED 2026-09-18 (20:lean 3/3 승). 아래 기록 참조.
- ~~Ch1 후반(5~7)이 lean에서 1/5 승이던 구조적 구멍~~ → 수정 CLOSED 2026-09-18: 스킬 포인트 모델 입력 + 방 레벨 Lv2 게이트 DM5→DM3. 재측정 6/6 승 HP 83~90%. 아래 기록 참조.
- ~~겹친 군중 제어가 서로를 깨뜨리던 문제 (이동 잠금·속도 복원)~~ → 수정 CLOSED 2026-09-18, 아래 기록 참조.
- ~~보스 처치 슬로모 고착 (Ch9 90 veteran 미정산의 실제 원인)~~ → 수정 CLOSED 2026-09-18, 아래 기록 참조.
- ~~Phase 3~4 마감 작업(홈 할 일 배지·콤보 피드백·구 세이브 회귀)~~ → CLOSED 2026-09-18, 아래 기록 참조.
- ~~주간 보석 인플로우 밴드 (Phase 4, P4 ①)~~ → CLOSED 2026-09-18: `gemInflow.ts` 추정 + 명성 주간 정산에 기본 100 추가(티어 1: 190→290, 티어 2~5 밴드 안). P4 ③은 배너가 이미 부족 픽업이라 `bannerSynergy.ts` 전망 한 줄만 추가해 CLOSED.
- Whole-app Android/iOS packaging and store release validation — PARTIAL.
  Android/iOS 모두 **빌드 + 실제 구동(에뮬레이터/시뮬레이터)** 까지 검증됐다.
  남은 것은 서명/스토어 업로드뿐이며 자격증명이 필요하다.
  아래 2026-09-16 / 2026-09-17 기록 참조.
- ~~Clean commit/merge/release history for the accumulated dirty worktree~~
  → CLOSED 2026-09-16. 아래 기록 참조.
- ~~Global performance/bundle remediation for the existing large-chunk advisory~~
  → CLOSED 2026-09-16. 아래 기록 참조.

### 2026-09-16 — worktree 정리 · 번들 · viewport/modal 검증

**Worktree (CLOSED).** 누적 dirty worktree를 4개 논리 commit으로 정리했다:
`f4ed54a` src 160개(신규 25개 포함) / `fb5e641` 설계 문서·검증 스크립트·
ritual-v2 아트 / `5e95f39` Capacitor 8 동기화 + native safe-area /
`34d59b6` 증빙·아트 마스터 + QA 캡처 gitignore. 정리 전 상태에서 신규 소스
25개가 미추적이었고 그 중 12개(`ShopShared` 5곳, `characterArt` 5곳,
`HudResourceFormatting` 8곳 등)가 이미 프로덕션 경로에서 import되고 있어
`git checkout`/`clean` 한 번에 앱이 깨지는 상태였다. 이제 worktree는 clean이다.
`tools/screenshots/`(117MB), `.playwright-cli/`, `output/playwright/`는
gitignore로 제외하고, 이미 추적 중이던 캡처 11장은 유지했다.

**Bundle (CLOSED).** `app-gameplay` 단일 청크가 858KB로 Vite 500KB 임계를
넘고 있었고 `vite.config.ts` 주석의 "stays under 500KB"는 사실과 달랐다.
`app-scenes`(265KB) / `app-ui`(392KB) / `app-combat`(206KB)로 분리해 모든 앱
청크를 임계 미만으로 내렸다(`d691af6`). 주석이 우려하던 circular-chunk 위험은
실측으로 반증했다 — 빌드 경고 0, built output 부팅 후 허브 12개 씬과
DungeonScene/UIScene 전환 전부 성공, console error 0. `phaser`(1.48MB)는 단일
vendor 라이브러리라 custom build 없이 분리 불가하며 advisory가 남는 것이
정상이다. `chunkSizeWarningLimit`은 앱 청크 회귀를 계속 잡기 위해 기본값을
유지했다. Scene lazy-load는 채택하지 않았다: 20개 씬이 `main.ts`에서 즉시
등록되고 Capacitor 셸에서 `dist/`를 로컬로 읽으므로, 81개 `scene.start`
호출부를 async로 바꾸는 위험 대비 전달 이득이 없다.

**Viewport 축 (CLOSED).** `main.ts`는 `Phaser.Scale.FIT` + 고정
`390×844` 논리 캔버스를 쓴다. 브라우저 viewport가 바뀌어도 논리 좌표계는
그대로이고 letterbox/scale만 변하므로, 360×800과 430×932는 레이아웃 reflow를
만들지 않는다. 즉 "360×800 / 430×932에서 다시 본다"는 별도 축이 아니다.
`verify-web-surfaces.mjs`가 bounds를 390×844로 재는 것도 이 때문에 올바르다.
디바이스별로 실제 달라지는 것은 safe-area inset이며, 이는 `index.html`의
`max(env(safe-area), --native-safe-*)`가 담당한다(`5e95f39`).

**Modal 검증 (PARTIAL).** `verify-web-surfaces.mjs` 재실행(현재 분리 빌드
기준): 45 initial captures / 3 viewports, errors 0, hardFailures 0,
fixedOverflow 0, scrollBoundaryPartials 0, undersizedTargets 0,
textBelow10 0. 유일한 flag는 ShopScene 6건 + DungeonHomeScene 1건의
`overlapCandidates`인데, 실물 확인 결과 썸네일 모서리에 의도적으로 겹쳐 둔
배지 칩(⚔/◆/✦/◐)이라 결함이 아니다. 중첩 modal은 Shop `외형 검수대`를
직접 열어 계측했다 — worldView 정확히 390×844, fixedOverflow 0,
undersized target 0, 10px 미만 텍스트 0, interactive 21개. Barracks 몬스터
상세 modal도 정상 개방(visible object 105→201)을 확인했다.
남은 것: 나머지 surface의 confirm/result/picker 상태 전수. 임시 probe가
보고하는 추가 overflow는 `scrollFactor:0` 고정 하단 내비의 월드 좌표
artifact이므로 실결함으로 계수하지 않는다.

**Abyss hand-off seam (CLOSED).** `AbyssScene.climb()` → `DungeonScene` →
`resolveReturnedBattle()` 왕복을 실제 런타임에서 세 경로 전부 태웠다:
승리 시 `clearAbyssFloor` 적용 + `highestFloor 0→1` + firstClear receipt,
패배 시 `highestFloor` 불변 + 재도전 안내, `battleResult` 부재 시 상태 불변
+ "결과 확인 불가". 세 경우 모두 `abyssPendingFloor`/`battleResult`/`returnTo`
잔여가 없음을 확인했다(console error 0).

이 과정에서 계약 결함을 하나 고쳤다: `navigationContract.ts`는 스스로를
"transient hand-off의 테스트 가능한 기록"이라 선언하면서도 `battle-result`가
`returnTo` 하나만 소비한다고 적어, 실제로 3개를 소비하는 abyss 복귀를
과소 선언하고 있었다. `abyssPendingFloor`/`battleResult` 필드와 `abyss-return`
연산을 추가하고, `AbyssScene`이 수동 `registry.remove` 3회 대신 그 계약을
순회하도록 바꿔 선언과 런타임이 갈라질 수 없게 했다. 회귀 테스트를
`navigationContract.test.ts`에 추가했다(6→7 케이스).

**Abyss organic play-through (CLOSED).** `scripts/verify-abyss-playthrough.mjs`가
층 진입부터 실제 wave 전투, 실제 result-flow 버튼, 정산까지 왕복한다.
`{runs:2, hardFailures:0}` (`tools/abyss-playthrough-audit.json`).

- win — 수호자 9종 배치, 3/3 wave를 HP 1000/1000 무손실로 방어 →
  `highestFloor 0→1`, "1층 정복 완료 · 최심 0→1" + 전리품 영수증
- loss — 방 미건설, 3/3 wave 동안 심장부 HP 1000→0 →
  `highestFloor 0` 유지, "1층 원정 실패 · 최심 0층 유지", 열쇠 12/12 미소모
- 두 경우 모두 `abyssPendingFloor`/`battleResult`/`returnTo` 잔여 0, console error 0

검증 중 확인한 동작: **수호자를 0명 배치해도 패배하지 않는다.** `DungeonLayout`이
몬스터 없는 슬롯에도 `ROOM_DEFS[roomType].attackCooldown`을 부여해 빈 전투실
자체가 공격하기 때문이다. 따라서 패배 fixture는 "수호자 미배치"가 아니라
"방 미건설"(`dungeonSlots: []`)이어야 한다. 이건 결함이 아니라 방 자체가 방어
주체라는 설계이며, 후속 balance 판단 시 참고할 것.

도구 제약 두 가지를 기록한다:
- Result 버튼은 tween `onComplete`에서 `onPress()`를 호출하므로 eval 컨텍스트
  에서는 절대 발화하지 않는다(CLAUDE.md의 알려진 함정). Playwright context를
  `reducedMotion: 'reduce'`로 열면 버튼이 reduced-motion 직행 경로를 타서
  실제 핸들러가 실행된다. 이 스크립트가 Playwright를 쓰는 이유다.
- `window.advanceTime(ms)`는 호출마다 `renderGameToText()`로 게임 전체를
  직렬화해 반환한다. 작은 step으로 반복 호출하면 시뮬레이션이 아니라 직렬화가
  병목이 된다. 허용 최대치(10s) 단위로 끊고, wave 정착을 짧은 slice로 폴링할 것.

**네이티브 패키징 (PARTIAL).** Capacitor 8 업그레이드(`5e95f39`)는 커밋만 되고
sync/빌드로 검증된 적이 없었다. 이번에 확인한 범위:

- 버전 정합: core/android/ios/cli 모두 8.2.0, 설치본도 동일
- `npm run build && LANG=en_US.UTF-8 npx cap sync` — android/ios 양쪽 copy·update와
  `pod install`까지 성공. 이후 `git status` 0 (멱등). 동기화 산출물은 Capacitor가
  만든 중첩 `.gitignore`(`android/.gitignore:96`, `ios/.gitignore:4`)가 제외하므로
  추적되지 않는 것이 정상이며, 네이티브 빌드 전 `cap sync` 선행이 필수다.
- **iOS 시뮬레이터 빌드 `** BUILD SUCCEEDED **`** — Capacitor 8 셸이 실제로
  컴파일된다. 산출 `App.app/public/assets`에 분리된 청크(`app-scenes`/`app-ui`/
  `app-combat`)가 그대로 들어간 것도 확인했다.
- Android 정적 정합성: `variables.gradle`의 minSdk 24 / compileSdk 36 /
  targetSdk 36이 Capacitor 8 기본값과 일치. Gradle wrapper 8.14.3.

막힌 것(환경 제약, 코드 문제 아님):
- Android 빌드 — 이 머신에 **JDK 미설치 + ANDROID_HOME 미설정**. Capacitor 8은
  Java 21을 요구한다.
- iOS 시뮬레이터 구동 — `xcode-select`가 Xcode.app을 가리키지 않는다. 수정은
  sudo가 필요해 agent가 할 수 없다:
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- 서명/스토어 업로드 — 자격증명 필요.

부수 수정: `CLAUDE.md`의 앱 설정 4줄 중 3줄이 실제와 달랐다(버전 1.0/build 1 →
실제 1.1/2, iOS target 13.0 → 15.0, Android minSdk 22/targetSdk 34 → 24/36).
실측값으로 고치고 빌드 전제조건 표를 추가했다.

**Modal/selection/result 전수 (CLOSED).** `scripts/verify-modal-states.mjs`를
신설해 각 surface의 초기 상태에서 한 단계 더 들어간 17개 상태를 감사했다:
`{cases:17, fixedOverflow:0, undersizedTargets:0, textBelow10:0, errors:0,
hardFailures:0}` (`tools/modal-state-audit.json`).

덮은 상태 유형:
- 오버레이 modal — Shop 외형 검수대/구매 확인, Codex 수호자 상세,
  Fusion 재료 피커, Summon 확률 상세, Barracks 관리
- 인라인 selection — Wisdom 가지, Achievement 기록, Production 시설,
  Decoration 유물 (텍스트 수가 1:1 교체되어 개수는 불변이나 선택은 반영됨)
- 탭 전환 — Codex 침략자, Fusion 흡수, Forge 분해
- **자원 게이트 뒤 confirm 레이어** — 기본 픽스처는 보석/영혼수정이 0이라
  도달 자체가 불가능했다. 해당 게이트가 요구하는 자원만 시드해 열었고,
  Wisdom `의식 승인` modal이 등급 0→1·소모 5·보유 500→495의 정확한
  스냅샷을 렌더하는 것을 확인했다.

구조 변경: `verify-web-surfaces.mjs`의 `openScene`/`inventory`/`logicalClick`/
`namedClick`을 `scripts/lib/web-audit.mjs`로 **순수 추출**해 두 하네스가 동일
기하로 측정하도록 했다(갈라지면 두 감사 수치가 비교 불가능해진다). 추출은
동작 변경이 없음을 실증했다 — 추출 전후 표면 하네스 summary가
`{45,3,0,0,4,4}`로 동일하다. `openScene`에 선택적 `seed`를 추가했고 기본값은
기존과 같다. 입력 탐색용 `scripts/discover-inputs.mjs`도 추가해 트리거를
추측이 아니라 실측 라벨로 고르게 했다.

남은 것: overlapCandidates 48건은 hardFailure가 아닌 review candidate이며,
표본 확인 결과 썸네일 배지·아이콘 칩의 bounding-box 중첩이었다. 전수 육안
심사는 하지 않았다.

현재 사용자 요청과 `CHARACTER_ART_REVISION.md`에 따라 다음 한 batch의 exact IDs,
acceptance와 허용 파일을 먼저 확정한다. Packaging/publishing 권한은 포함되지 않는다.

### 2026-09-17 — 네이티브 빌드·구동 검증 · 기여자 문서 번들 제외

2026-09-16에 환경 제약으로 막혀 있던 두 항목을 사용자가 해소해(Xcode 선택,
Temurin JDK 21 설치) 나머지를 실측했다.

**Android (CLOSED).** `./gradlew assembleDebug` → `BUILD SUCCESSFUL`.
산출 APK 20MB, aapt2 badging 실측 `com.dungeon.guardian` / versionName 1.1 /
versionCode 2 / minSdk 24 / targetSdk 36 — `variables.gradle`과 일치한다.
APK 내부 `assets/public/assets/`에 분리 청크 9개가 모두 들어간다.

에뮬레이터(Medium_Phone_API_36.1) 구동까지 확인: Capacitor가 10개 청크를
`https://localhost/assets/...` 로컬 스킴으로 서빙하고, 부팅 화면 → 홈 보드
렌더 → 튜토리얼 각인 1/4 → 탭 → 2/4 진행. `FATAL EXCEPTION`/`AndroidRuntime`/
JS 예외 0건.

**iOS (CLOSED).** 시뮬레이터 빌드 `** BUILD SUCCEEDED **` 후 iPhone 17
(iOS 26.5)에 설치·실행. WebView 전 리소스 200, 홈 보드 렌더, 탭으로 각인
1/4 → 2/4 진행 확인. 양 플랫폼이 동일 화면을 렌더한다.

**빌드 전제조건 정정.** `ANDROID_HOME`은 **필요 없다**. `android/local.properties`의
`sdk.dir`가 Gradle에 SDK 위치를 알려주므로, 환경변수 없이도 빌드된다. 실제로
필요한 것은 JDK 21과 SDK(platform 36 + build-tools 36.x)다. `CLAUDE.md`의
전제조건 표를 이에 맞게 고쳤다.

**함정 — 에뮬레이터 저장소 임계치.** `/data`가 96% 차 있으면 APK 크기와
무관하게 `IOException: Requested internal only, but not enough space`로 설치가
거부된다. Android의 저장소 저한계는 `min(파티션의 5%, 500MB)`라, 5.8G 파티션
기준 약 304MB 아래로 떨어지면 20MB APK도 못 들어간다. `pm trim-caches`는
2MB밖에 회수하지 못했다. 다른 프로젝트 앱을 지우거나 파티션을 건드리는 대신
`settings put global sys_storage_threshold_percentage 1`로 임계치만 일시
완화해 설치하고, 끝난 뒤 `settings delete`로 기본값(null)에 원복하는 것이
가장 부작용이 적다.

**기여자 문서 번들 제외 (신규 수정).** `public/assets/ASSET_GUIDE.md`와
`public/assets/backgrounds/README.md`가 스토어 빌드에 그대로 실려 나가고
있었다. `public/`은 Vite가 `dist/`로 그대로 복사하고 Capacitor가 그 `dist/`를
APK/IPA에 패키징하므로, 빌드를 압축 해제하면 누구나 읽을 수 있는 상태였다.
런타임에서 fetch하지 않고 주석에서만 참조되는 기여자 문서다.

두 문서는 각자 문서화 대상 폴더 옆에 있어야 쓸모가 있으므로 **이동하지 않고**,
`vite.config.ts`에 `strip-bundled-docs` 플러그인을 추가해 빌드 산출물에서만
`.md`를 제거한다. `outDir`은 하드코딩하지 않고 `configResolved`에서 읽는다.
제거 대상은 빌드 로그에 그대로 남는다(조용히 사라지지 않게).

검증: `dist` `.md` 0건 / `privacy.html`·청크 10개 보존 / 재빌드한 APK의 `.md`
엔트리 0건 / `cap sync` 후 양쪽 네이티브 셸 `.md` 0건 / tsc clean /
2905 tests pass.

**남은 것.** 서명·스토어 업로드(자격증명 필요), 그리고 캐릭터 아트 127종
(`docs/design/CHARACTER_ART_CODEX_HANDOFF.md`) — 둘 다 agent 단독으로 끝낼 수
없는 항목이다.

### 2026-09-17 — 옵션 B: 홈 던전 단일화 (Phase 1)

`GAME_DESIGN_BENCHMARK.md` §4.7 사용자 결정에 따라 전투 중 임시 방어선을 제거했다.
커밋 4개: `65f6d7c`(1a 데이터 계약) → `e624bb6`(1b 전투 UI 제거) →
`c2fb2ef`(1c 건물 12종) → `ac6a9cc`(1d 페이싱 모델·Ch1 재구성).

**계약.** 전투 그리드 = 홈 슬롯(`getUnlockedSlotCount`, DM1 3 → DM8 9). 전투 골드는
전리품(0 시작, 수리만 소비). `StageConfig.startGold`·`STAGE_CONFIGS.slots/
unlockedStage` 삭제. 방 레벨 상한 5 단일 상수. 홈 방 = 가족 4 × 건물 12
(`roomBuildings.ts`, 챕터 해금). 스타터 로스터 3체. 지혜 가지 3개 재배치.
자세한 규칙은 `CLAUDE.md` "홈 던전 단일화".

**페이싱 모델과 가드.** `campaignPacing.ts`의 starter/lean/expected/veteran 홈을
`campaignPacing.test.ts`가 전 스테이지에 대해 가드한다(1~80: lean·expected,
Ch9: veteran). 옛 `goldEconomy.test.ts`는 폐기.

**시뮬 보정 — 이번 작업의 핵심 발견.** organic 주행(`scripts/verify-campaign-
pacing.mjs`)에서 시뮬이 ~3배 낙관적이었다. 원인은 사거리: 사거리 1인 방은 3행
경로 중 자기 행에서만 때린다. `simulation.ts`에 `range/GRID_ROWS` 커버리지를
곱하자 시뮬 패배 웨이브가 실전(스타터 vs 옛 스테이지 1: 웨이브 9 패배)과
일치했다. 방 없는 슬롯의 자체 공격, 2번째 이후 몬스터의 기본 피해, 방 레벨
배수도 실전과 같게 했고, **전투가 쓰지 않는 몬스터 레벨 배수는 뺐다**.

**Ch1 재구성.** 보정된 lean 하한(12.8/17.2/21.7/≈35 DPS)에 맞춰 10개 스테이지의
침입자 구성만 바꿨다(보상·HP 유지). 병사≈13·무당≈15가 단계별 시험, 기사≈22는
8스테이지 전까지 보스 전용. 시뮬: 스타터 스테이지 1 HP 70%, lean 여유 1.34~2.39,
Ch2~8 lean 1.5~5×, Ch9는 veteran 5.9×(lean 0.69 — 의도된 로스터 관문).

**하니스 함정.** 런당 ~15분. `advanceTime` 직렬화 비용 때문에 예산(100슬라이스)을
늘리면 시간이 폭증한다(480×4런 = 3시간 행). 웨이브 종료 후 "즉시 시작" 경로와
스폰 스톨 복구(2슬라이스 idle → `checkWaveEnd`)가 없으면 멈춘다.

**organic 실측 (2026-09-17, `a0d71be`).** 시뮬이 70%로 본 스타터 홈이 재구성한
스테이지 1에서도 웨이브 6에 패배했다. 시작 보드는 1행 3개 단일 표적 방이라
**농민조차 웨이브당 1~2기 새어 나간다** — 시뮬은 사거리 커버리지까지만 보고 방의
처리량(쿨다운당 1타)은 못 본다. 초반은 organic이 진실원: 스테이지 1을 6웨이브·
HP 1500으로, 2를 8웨이브·HP 1500으로 줄인 뒤 실측 **스타터 스테이지 1 승리
(HP 83%)**, **lean 스테이지 2 승리(HP 60%)**. 챕터 경계(5/10/20/…/80 lean, 90
veteran) 주행은 아래 후속 기록 참조.

**검증.** tsc clean, 2885 pass, 모달 하니스 17상태 `{0,0,0,48,0,0}` 동일,
abyss organic 승/패 왕복 통과.

**P3에 넘기는 발견.** (1) 전투 피해는 몬스터 레벨을 쓰지 않는다 — "개별 육성
노가다"가 의미를 가지려면 `CombatResolver`에 배선해야 한다. (2) 먹이(`feedOwnedMonster`, 골드→XP)는 `MonsterDetailPanel`에서
닿지만 `monsterAffinity/lastTalkTime/dailyTrainCount`는 어디서도 읽지 않는다 —
교감은 먹이 한 축만 살아 있고, 생산 산출물과는 연결돼 있지 않다.

### 2026-09-18 — Phase 2: 침입 예보(하루 카드) + 명성

`PHASE2_NOTORIETY_FORECAST.md` 스펙대로 4단계 커밋(phase2 브랜치 → main ff):
`6f9e1de`(2a 데이터) → `6385a79`(2b 트랜잭션·계약) → `b4887f0`(1d-3 홈 방어
템포, Phase 1 잔여) → `8765cee`(2c 홈 트레이·정산 배선).

**Phase 1 잔여 — 홈 방어 템포.** organic 실측에서 완화한 Ch1조차 lean 홈이
스테이지 5·10·20에서 졌다. 방 하나가 쿨다운당 1타로 단일 표적을 잡는 처리량이
침입자 도착 속도를 못 따라간다 — 옵션 B가 전투 중 성장을 뺀 만큼의 구멍.
`combatTempo.ts HOME_DEFENSE_TEMPO = 1.5`(모든 방·수호자 쿨다운 ÷1.5, 시뮬 동일)
하나로 해결: 스타터 스테이지 1 HP 100%, lean 2 100%, 5 42%, 10 81% (4/4 승).
챕터 경계(20~80 lean, 90 veteran) 주행은 아래 후속 기록 참조.

**organic 실측 (2026-09-18, main `6b59321` 그리드 수정 후).** 20:lean(dm8·슬롯 9·
방 Lv2·로스터 9) 방 9/9 배치, 10/10 웨이브 HP 660/2500(26%) 승; 32:lean(dm10·Lv3·
로스터 13) 10/10 HP 4500/4500(100%) 승. 스톨 0, `{runs:2, wins:2, hardFailures:0}`.
20의 26%는 시뮬 80%와 방향이 같다(시뮬이 여전히 낙관).

**organic 챕터 경계 (2026-09-18, main `0bfd911` = Phase 3a/3b 병합 후, 8083).**
42:lean(dm11·Lv3·로스터 17) 10/10 HP 89% 승 · 56:lean(dm13·Lv3·21) 96% 승 ·
68:lean(dm14·Lv3·25) 100% 승(스톨 2 복구) · 80:lean(dm15·Lv4·29) 15/15 HP 100% 승.
90:veteran(dm52·Lv5·33, 시뮬 DPS 3491)은 HP 100%인 채 4/15 웨이브에서 **예산(70
슬라이스) 소진**으로 미정산 — 패배가 아니라 하니스 예산 한계(15웨이브 스테이지 +
스톨 1). `{runs:5, wins:4, hardFailures:1}`.

> **2026-09-18 정정 — 이 표본은 스테이지당 1회다.** organic 전투는 결정적이지 않고
> (스폰 순서·패시브 발동·웨이브 사건이 매번 구른다) 한계 스테이지는 1회 주행으로
> 판정할 수 없다. 실제로 **20 lean은 재측정에서 3연패**했다: main(이동 수정 없음)
> 7/10 패, phase2(이동 수정 있음) 6/10 패 ×2 — 즉 **이동 수정과 무관하며**
> (a03b812 이후 밸런스 경로 diff는 전부 중립: `runGoldVeins` 제거=전투 골드,
> `staffedMonsterIds`=페이싱 홈에선 빈 집합, 콤보·육성 배율=Lv1·무함정이라 1.0),
> 09-17의 660/2500(26%) 승리가 분포의 운 좋은 꼬리였다고 보는 것이 맞다.
> 현재 20 lean 표본: **1승 / 4회**. "1~80 lean 전부 승"은 표본 1회에서 일반화한
> 과장이었으므로, 승률은 `PACING_REPEATS`로 다시 측정한 뒤에만 기록할 것.

**2026-09-19 — 위 n=1 기록을 실측 표로 교체한다.** 모델 현실화(레벨 → 함정 → 스킬
포인트)와 방 레벨 게이트 수정이 끝난 뒤, 현재 빌드(`614670f`)에서 다시 쟀다. 위
`6b59321`·`0bfd911` 기록은 **구 모델의 것이므로 더 이상 현재 밸런스를 말하지 않는다** —
아래 표가 유효한 기록이다.

| 스테이지 | 주행 | 승 | HP% |
| --- | --- | --- | --- |
| 1 starter | 1 | 1 | 63 |
| 2 lean | 2 | 2 | 87, 100 |
| 3 lean | 2 | 2 | 100, 100 |
| 4 lean | 2 | 2 | 100, 100 |
| 5 lean | 2 | 2 | 83, 89 |
| 6 lean | 2 | 2 | 89, 89 |
| 7 lean | 2 | 2 | 90, 90 |
| 8 lean | 2 | 2 | 76, 90 |
| 9 lean | 2 | 2 | 64, 73 |
| 10 lean | 1 | 1 | 100 |
| 20 lean | 1 | 1 | 76 |
| 32 lean | 1 | 1 | 100 |
| 42 lean | 1 | 1 | 89 |
| 52 lean | 1 | 1 | 92 |
| 62 lean | 1 | 1 | 89 |
| 72 lean | 1 | 1 | 73 |
| 80 lean | 4 | 4 | 34, 38, 46, 49 |
| 90 veteran | 1 | 1 | 100 (54슬라이스) |

**표 읽는 법.** 2회 이상은 승률 기록, **1회는 선별(screen)이지 판정이 아니다.**
회차 간 HP 편차는 관측상 9~15%p이므로(8: 76↔90, 2: 87↔100, 9: 64↔73) 73% 이상은
한계선과 멀고 1회로 충분하다. **80:lean 34%만 그 기준에 걸려 `PACING_REPEATS=3`으로
재측정했고 3/3 승(38·46·49)이었다** — 합계 4/4, 평균 ~42%, 분포가 42% 언저리에
모여 꼬리가 0에 닿지 않는다. 80은 캠페인 lean의 **최저 마진 지점이지만 버틴다**.

**현재 상태: 측정한 18스테이지 전부 승, 패배 0.** 1~10을 촘촘히, 20~90을 챕터
경계로 덮었다. 남은 organic 미검증 영역은 캠페인이 아니라 심연·무한이다.

**Ch1 난이도 저점이 5~7에서 8~9로 옮겨갔다.** 이건 게이트 때문이 아니라 **로스터
공급** 때문이다: `expectedRoster`가 `unlockStage <= stageNumber`로 거르는데 스테이지
9까지 열리는 공격 몬스터가 5체뿐이고 6번째가 10에서 열린다. 즉 9는 슬롯 6개를
수호자 5명으로 받는 마지막 스테이지다. 64%는 편안한 승리라 손대지 않는다 —
다음에 Ch1을 건드릴 때 이 구조를 기억할 것(방 레벨이 아니라 몬스터 해금 곡선이 레버).

**감사 파일.** `tools/campaign-pacing-audit.json`은 *마지막 주행 하나*의 기계 증거다.
누적 기록이 아니므로, 여러 배치의 결과를 남기려면 이 표를 갱신할 것.

**90 veteran 재주행 (`PACING_BUDGET=160`, main `3b84a56`, 42분).** 여전히 미정산:
5/15 웨이브, HP 15000/15000(100%), 스톨 2. 웨이브별 슬라이스 2·5·**37(스톨)**·
**87(스톨)**·36+ — 웨이브 3부터 스폰 큐가 비고 생존 침입자도 없는데 `waveActive`가
남는 스톨이 반복돼 예산을 먹는다(하니스가 `checkWaveEnd`로 강제 종료해도 다음
웨이브가 같은 패턴). 방어는 무손실이므로 **밸런스 문제가 아니라 Ch9 스테이지의
스폰 루프/웨이브 종료 조건 문제**(소환 전용·고스트 추가 침입자 또는 지연 스폰이
큐 밖에서 대기하는 것으로 추정). 후속: 스테이지 90 `spawnQueue`/`waveActive`
진단을 별도 슬라이스로; 그 전까지 Ch9 veteran 가드는 시뮬(`campaignPacing.test`)에
의존한다. 감사 JSON은 5런 기록(`c3123cd`)을 유지하고 이 재주행은 여기에만 남긴다.

**Phase 2 구조.** `notoriety.ts`(밴드 10·승인제 승격·감소·주간 정산),
`forecast.ts`(카드 정의·시드 발급·밴드 웨이브 생성기), `forecastTransactions.ts`
(하루 시작·선택·정산; 일일/주간 보상은 전투 씬 소유), `navigationContract`의
`forecast-return`, `ForecastTray.ts`(홈 트레이), `HomeCommandDeck`('오늘의 손님'
칩·명성 헤더), `HomeLifecycle`(하루 시작·정산 분기), `DailyContentPanel`은
도전 과제·출석만. `CLAUDE.md` "침입 예보 · 명성" 절이 계약의 단일 진실원.

**검증.** notoriety/forecast/forecastTransactions/notorietyBands 테스트 46건,
전체 2931 pass, tsc clean. 모달 하니스 19케이스(트레이 2케이스 추가)
`{overflow 0, small 0, tiny 0, errors 0, hardFailures 0}`. 예보 organic
(`verify-forecast-playthrough.mjs`): stage-10 lean 홈이 트레이에서 일반 카드를
맞이 → 6웨이브 무피해 승리 → 귀환 정산 **명성 40 → 55**(10 × 무피해 1.5), 카드
처리 완료, 레지스트리 잔여 0, 콘솔 오류 0 — `{runs:1, hardFailures:0}`.

**부수 수정.** 스타터 3체로 병영 로스터가 캔버스 아래로 이어져 하니스가
overflow로 읽던 것을 뷰포트 마스크로 클립(`BarracksScene`).

**남은 것 (Phase 3~4).** 함정 제작·조합·콤보(P2), 운영 수익 통합·근무(P1 ③④),
계보도·교감(P3), 재화 순환·중복·부족 배너(P4). P3 첫 작업은 몬스터 레벨의
전투 배선(현재 전투는 방 레벨만 본다).

### 2026-09-18 — Phase 3a/3b: 함정 제작·융합·숙련·콤보

phase2 브랜치 2커밋: `470d33d`(3a 데이터·전투·재고) → `75346b2`(3b 공방 탭·트레이).
`CLAUDE.md` "함정 제작 · 콤보" 절이 계약의 단일 진실원.

**구조.** `traps.ts` 상태이상 6종 × 함정 16종(1티어 6 / 2티어 6 융합 / 3티어 4
융합+boss_essence), 숙련 +15%/lv(최대 5), 콤보 `1+0.25×(상이 상태이상−1)` 최대 4.
`trapTransactions.ts`(craft/enhance, 재고 `trapStock`·숙련 `trapMastery`),
`roomSlotTransactions`(2·3티어는 재고에서 설치·해제 시 복귀), `Invader.comboCount`
(2초 창), `CombatResolver`/`runExtraMonsterAttacks` 콤보 배율, `applyTrapToInvader`
일반화(숙련 배율), `simulation.ts` `trapEffectiveDps`. UI: `trapForgeView.ts`(순수
행 투영) → `ForgeTrapTab.ts`, 공방 3탭(제작/함정/분해), 배치 트레이 함정 칩 티어
배지·재고 표시·재고 없음 → 공방 딥링크(`forgeTab`, `forge-entry` 소비).
기존 4종 id는 유지되므로 세이브 마이그레이션 없음(재고·숙련 기본 `{}`).

**검증.** tsc clean, vitest 112 파일 2904 pass(traps/trapTransactions/trapForgeView
신규, stages·roomMechanics·추천·navigationContract 갱신). 프리뷰(8084) 수동 주행:
공방에서 독가시 벽 융합(가시 덫 1·독 덫 1·철 3·약초 3 소모, 재고 2) → 홈 트레이
DM20에서 설치(재고 2→1, 골드 불변, 방 T1) → 해제(재고 복귀 2) → 재고 없는 뇌전
그물 탭 → ForgeScene `activeTab='trap'`, 레지스트리 잔여 0. 모달 하니스
`forge-trap-tab`·`forge-trap-fuse-result` `{overflow 0, small 0, tiny 0, errors 0,
hardFailures 0}` (overlap 1 = 토스트가 페이지 내비 위에 뜨는 기존 토스트 위치, 검토
후보).

**남은 것.** P1 ③④(운영 수익 통합·몬스터 근무), 콤보의 organic 체감 확인(전투
로그로 콤보 배율 발화 횟수 측정은 미실시), P3·P4.

### 2026-09-18 — Phase 3 (P1 ③④): 운영 수익 통합 + 몬스터 근무

`CLAUDE.md` "운영 수익 · 몬스터 근무" 절이 계약의 단일 진실원.

**구조.** `idleIncome.ts`: 골드 = (운영 방 수익 + 보물고) × 명성 `1+0.15×(티어−1)` ×
장식, 재료는 명성 미적용; 상한 12h → 티어 5부터 24h(`idleCapHours`); 홈 `황금 광맥`
= 수익 방 12/분. 전투 `runGoldVeins`·`goldTick` 삭제(옵션 B: 전투 골드는 전리품).
`production.ts` `FACILITY_AFFINITY`·`facilityStaffMult`(×1.2 / 적성 ×1.5),
`facilityRatePerHour(def, level, staffMult)`, `facilityProductionOverMs(…, staff)`.
`productionTransactions.ts` `assignFacilityStaff`(방·다른 시설에서 이동)·
`clearFacilityStaff`·`staffedMonsterIds`; `assignMonsterToRoomSlot`은 근무 해제;
`deployDungeonSlotsToGrid.staffedMonsterIds`·추천 제외. UI: `ProductionScene` 명령판
'근무 수호자' 줄(44px) + `ProductionStaffPicker.ts`(적성·현재 위치 표시, 9칩/페이지),
배치 트레이 '근무 중' 표기.

**검증.** tsc clean, vitest 113 파일 2914 pass(`facilityStaff.test.ts` 신규,
production/idleIncome 확장). 프리뷰(8084): 광산 명령판 → 피커(6체, 전원 방 배치 중
표시) → 도깨비 전사 배정 → 방 #1 비워짐·`facilityStaff.mine` 설정·산출 2→2.4/h·
영수증 "방에서 이동", 방치 골드가 수호자 1체분 감소(21,717→20,969, 3h·티어5 ×1.6).
모달 하니스 `production-facility-order`(명령판 재배치 회귀)·`production-staff-picker`·
`production-staff-assigned` 결과는 커밋 메시지 참조.

**남은 것.** P3(몬스터 레벨 전투 배선 → 계보도·교감), P4(재화 순환·중복·부족 배너),
4.6 통폐합. 근무 몬스터의 교감(§4.3 ②) 연결은 P3에서.

### 2026-09-18 — Phase 3 (P3 첫 단계): 수호자 레벨 → 전투 피해 배선

**왜 먼저.** 사용자 결정 "개별 육성 = 노가다 콘텐츠"가 성립하려면 병영의 레벨·스킬이
실전 피해에 들어가야 한다. 지금까지 전투는 방 레벨(`1.4^(lv-1)`)만 봤다.

**구조.** `barracks.guardianAtkMult(level, spentSkills)` = `1.03^(lv-1)` × 강타(A1) 1.15
— 병영 ATK 표시(`getMonsterAtk`)와 같은 식. `DungeonScene.guardianAtkMult`
(`buildGuardianAtkMultMap(ownedMonsters)`, `equipmentMap`과 같은 수명)를
`CombatResolver.resolveAttack`(첫 몬스터)·`runExtraMonsterAttacks`(추가 몬스터)가
곱하고, `simulation.calcDungeonDps`도 같은 맵을 적용해 예보가 육성을 반영한다.
근무 중인 수호자는 배치에서 이미 빠지므로 여기서 따로 걸러내지 않는다.

**검증.** tsc clean, vitest 2916 pass(`barracks.test` 2건 추가, `simulation.test`의
"레벨 무시" 고정 2건을 "레벨 배율" 검증으로 반전). 페이싱 가드는 로스터 Lv1이라
수치 불변 — 육성은 가드 위의 여유분이다. organic 재주행은 불필요(Lv1 로스터).

**주의.** 하니스가 8084를 쓰는 동안 이 트리의 `src/`를 편집하면 HMR 리로드로
`Execution context was destroyed` 실패가 난다(`forge-trap-fuse-result` 1건이 그
사례 — 제품 결함 아님, 격리 재실행 통과). 하니스 주행 중엔 문서만 만진다.

### 2026-09-18 — Phase 3 (P3 ②): 교감

`CLAUDE.md` "교감" 절이 계약의 단일 진실원. `monsterAffinity`는 각성 게이트(100)만
읽고 아무도 올리지 않던 필드였다 — 각성이 도달 불가능했던 셈. 이 슬라이스가 그
경로를 연다.

**구조.** `bond.ts`(행동 3종·임계 4단·부족별 이야기·`bondAtkMult`),
`bondTransactions.ts`(`performBondAction`: 소유·최대·일일 한도·골드·재료 대안 검증,
임계 통과 보상 1회, 합동 훈련 XP는 복사본에 `addXp`), `GameState.bondDaily`,
`guardianAtkMult(level, spentSkills, affinity)`로 전투·시뮬·병영 ATK 표시가 같은
수를 본다. UI `MonsterDetailBond.ts` + 상세 패널 4탭(탭 너비 = 탭 수로 계산).

**검증.** tsc clean, vitest 114 파일 2922 pass(`bond.test.ts` 6건). 프리뷰(8084)
병영 → 도깨비 전사 상세 → 교감 탭: 44 → 간식(약초 3→2) 52 → 대화 57, 우정(50)
통과로 이야기 해금·헤더 "우정 · 공격 ×1.06", 토스트 "대화 · 교감 52 → 57",
`bondDaily` 기록. 모달 하니스 `barracks-bond-tab`/`barracks-bond-action` 결과는
커밋 메시지 참조.

**남은 것.** P3 ① 계보도(진화·조합 트리 시각화 + 목표 핀 → 홈 directive), P4(재화
순환·중복→각성석/부족 조각·부족 배너), 4.6 통폐합(장식 세트 흡수는 idleIncome에서
이미 배수로 소비 중), 근무·교감을 홈 directive에 노출.

### 2026-09-18 — Phase 3 (P3 ①): 계보도 · 목표 핀

`CLAUDE.md` "계보도 · 목표 핀" 절이 계약의 단일 진실원.

**구조.** `lineage.ts`(노드 파생·목표 계획·다음 단계·핀 제안, 데이터 추가 없음),
`GameState.lineageGoal`, `homeReadinessDirective.getLineageDirective`(방 작업 →
**계보 목표** → 전투 준비 순), `HomeCommandDeck`이 `'codex'` 목적지를 CodexScene으로
라우팅, `CodexMonsterDetail` 하단 44px '계보' 스트립(진화/조합 요약 + 핀 토글, 토글
시 스트립 전체 재렌더).

**범위 결정.** §4.3 ①의 "부족별 트리 시각화"는 그리지 않았다. 상세 스트립(어디서
와서 어디로 가는가)과 홈 directive(지금 할 한 가지)가 "목표 있는 반복"에 필요한
노출을 이미 채우고, 전체 트리 그림은 아트 파이프라인(Codex 핸드오프)과 함께 다룰
것. 핀은 하나만 둔다(directive가 한 줄이므로).

**검증.** tsc clean, vitest 115 파일 2927 pass(`lineage.test.ts` 4건). 모달 하니스
`codex-lineage-pin`·`home-lineage-goal-chip` 결과는 커밋 메시지 참조. 프리뷰 실측: 기대 홈(40)조차 빈 몬스터 슬롯 때문에 방 작업 큐가 9건이라 directive 카드는 거의 방 작업이 차지한다 → 헤더 📌 칩을 추가해 핀이 항상 보이게 했다.

### 2026-09-18 — Phase 4 (P4 ②): 중복 소환 → 각성석 · 부족 조각

`CLAUDE.md` "중복 소환 → 각성석 · 부족 조각" 절이 계약의 단일 진실원.

**구조.** `tribeShards.ts`(희귀도별 조각/각성석 표, `redeemableTribeMonsters`는 소환
풀 ∪·해금 게이트·미보유로 좁힘, `redeemTribeShards` 100 소모 → 1체), `applySummonPull`
중복 분기 확장(영혼 결정은 그대로), `GameState.tribeShards`, `SummonScene` 스트립 +
`redeemShards`(토스트 후 소환 탭 재구성), 결과 뱃지 확장. 조각 스트립은 시즌 배너가
없을 때만 카드 아래 44px에 들어간다 — 배너가 있을 때의 노출은 후속(배너 카드 안에
한 줄) 과제.

**검증.** tsc clean, vitest 결과·모달 하니스 `summon-shard-redeem`·프리뷰 교환 실측은
커밋 메시지 참조.

### 2026-09-18 — Phase 3~4 마감: 노출·피드백·회귀

Phase 1~4 병합 후 남은 "만들었지만 보이지 않는" 구멍 셋을 닫았다.

**① 홈 할 일 배지.** 지시 카드는 한 건만 보여주고 방 작업 큐가 거의 항상 이를
차지한다(기대 홈 40에서도 큐 9건). 새 시스템을 배지로 노출: 헤더 `⛏ 근무 N`
(`home-staffing-chip`) — **ProductionScene으로 가는 유일한 홈 경로**(그전까지 생산
구역은 스테이지 지도에서만 도달), 칩 `육성 N`(오늘 교감 가능 수호자)·`제작 N`(지금
융합 가능한 2·3티어 함정). 순수 계산은 `homeTodos.ts`.

**② 콤보 피드백.** 콤보 배율이 전투에서 전혀 보이지 않아 "함정 조합이 전술"이라는
설계가 학습되지 않았다. `shouldAnnounceCombo`(순수) + `Invader.noteComboAnnounce`로
**단계가 오를 때만** 침입자 위에 `콤보 ×N`을 띄운다. 프리뷰 실측: 3티어 함정 2개를
둔 방에서 한 웨이브에 `콤보 ×1.75` 5회(침입자당 1회, 타격당 스팸 없음).

**③ 구 세이브 회귀.** `legacySaveMigration.test.ts` — Phase 3~4 이전 세이브를
`importGameState`로 복원해 신규 필드 기본값(`{}`/null), 기존 함정 4종 설치 유지와
골드 환급, 그리고 trapForgeView/homeTodos/lineage/bannerSynergy/gemInflow/idleIncome/
simulation이 전부 무예외 동작함을 고정.

**검증.** tsc clean, vitest 119 파일 2940 pass, `npm run build` 성공(청크 경고는
기존 Phaser 권고), 모달 하니스 `home-todo-badges`·`home-staffing-route`
`{overflow 0, small 0, tiny 0, errors 0, hardFailures 0}`.

### 2026-09-18 — 보스 처치 슬로모 고착 (밸런스가 아니라 버그였다)

이전 기록에서 "Ch9 스폰 루프/웨이브 종료 조건 과제"로 남겨둔 90 veteran 미정산의
원인을 계측으로 특정했다. **밸런스도, 스폰 루프도 아니었다.**

**계측.** 스테이지 90을 veteran 홈으로 띄우고 슬라이스마다 `waveActive/
waveHasSpawned/waveEndChecked/spawnQueue/alive/coreHp/roomHp/time.timeScale`를
기록(55슬라이스). 결과: 웨이브 1~2는 2~3슬라이스에 정리, **웨이브 3에 진입하는
순간 `time.timeScale`이 3 → 0.15로 떨어지고 끝까지 돌아오지 않았다.** 그 뒤 모든
슬라이스에서 `alive=0`, 방 HP 9칸 전부 200/200 무손상, 코어 15000/15000 —
싸움이 느린 게 아니라 **시계가 기어가고 있었다**. 큐는 슬라이스당 1/3개꼴로만
빠졌다(설정 간격 1300ms인데도).

**원인.** `ImpactVfx.playBossKillReaction`이 160ms 히트 포즈를 위해 `time/
tweens.timeScale`을 0.15로 낮추고 **직전 값을 캡처해** wall-clock `setTimeout`으로
복원한다. (a) 160ms 안에 보스가 둘 죽으면 두 번째가 0.15를 "직전 값"으로 캡처해
**영구 0.15배**가 된다 — 전 캠페인에서 보스 2기 이상 웨이브는 6개(스테이지 89 14,
90의 9·11·13·14·15)로 전부 최종 그라인드 챕터이고, 무한 모드는 더 자주 겹친다.
(b) 복원이 `tweens.timeScale = 1`이라 3배속 전투가 1배속 모션으로 떨어졌다.
(c) 하니스는 `page.evaluate` 안 동기 pump 루프라 wall-clock 타이머가 **굶어서**
보스 1기만 죽어도 복원이 영영 오지 않았다 — 웨이브 3(거인 1기)에서 고착된 이유.

**수정.** 모듈 토큰으로 최신 슬로모만 복원하고, 시계·트윈 모두 `baseScale`
(`DungeonScene.speedMult`)로 되돌린다(`KillHandlerContext.speedMult` 추가).
양 organic 하니스는 슬라이스마다 `await yieldToTimers()`로 이벤트 루프를 양보한다.
가드 `bossSlowMo.test.ts` 3건(복원 대상·중첩 캡처·씬 종료). vitest 2951 pass.

**수정 후 재주행 (p2 `61f9df1`, 8084, PACING_BUDGET=160).** 90:veteran **15/15
웨이브 클리어, HP 15000/15000(100%), 54슬라이스, 전리품 133,558** —
같은 예산에서 5/15 미정산이던 주행이 예산의 1/3만 쓰고 완주했다. Ch9 veteran
가드는 이제 organic으로도 닫혔다(마지막 보스 웨이브 1건만 grace 창 샘플링으로
stall 플래그).

**후속 정리.** `combat/BattleSpeed.ts applyBattleSpeed`로 배속 기록 지점을 통합하고
(setSpeed·일시정지·재진입 리셋·슬로모 복원) **전투 재진입 시 시계를 speedMult로
재적용**한다 — Phaser가 씬을 재사용하는데 시계는 재초기화되지 않아, 최종 보스 처치
직후 스테이지가 끝나면 다음 전투가 0.15배로 시작할 수 있었다.

**함의.** 이 버그 이전의 **보스 웨이브 이후 organic 타이밍은 신뢰할 수 없다**
(0.15배 게임을 측정했다). 보스 침입자가 등장하는 스테이지는 42·52·62·72·80·
87·88·89·90 아홉 개뿐이고, 90 이전에는 전부 보스 1기가 최종 웨이브에만 나온다 →
고착은 마지막 웨이브 꼬리에서만 생길 수 있고, 42·80 주행은 예산 안에서 10/10·
15/15로 **완주**했으므로 "1~80 lean 클리어" 결론 자체는 유지된다. 반면 90은 보스가
웨이브 3부터 나와 전체 주행이 0.15배였으므로, 수정 후 재주행이 진실원이다.

### 2026-09-18 — 겹친 군중 제어 상호 파괴 (함정 콤보가 상시로 만드는 조합)

보스 슬로모와 같은 계열의 결함이 침입자 이동 제어에도 있었다. 효과가 하나씩
추가되며 조건이 누적된 흔적이 그대로 남아 있었다:

| 만료 콜백 | 기존 조건 | 결과 |
| --- | --- | --- |
| 기절 | **없음** (무조건 `resume()`) | 빙결·매혹·속박을 조기 해제 |
| 속박 | `!isStunned` | 빙결·매혹 무시 |
| 빙결 | `!isStunned && !isRooted` | 매혹 무시 |
| 도발·독 폭발·사망 | 네 가지 전부 확인 | 올바름 (나중에 추가된 경로) |

속도 쪽도 같은 문제였다: 매혹 해제·둔화 만료·가속 만료가 모두 `timeScale = 1`로
되돌려 **살아 있는 둔화를 지웠고**, 용병 대장 아우라는 `timeScale = 1.3`을 직접 써서
둔화를 덮은 뒤 아우라를 벗어날 때 1로 되돌려 둔화를 영구히 잃게 했다.

**왜 지금 중요한가.** 2·3티어 함정은 진입 한 번에 상태이상을 2~3종 건다
(`storm_cage` = 둔화+감전+공포, `quagmire` = 둔화+중독). 겹침이 예외가 아니라
기본값이 되면서 이 결함들이 상시로 발화한다.

**수정.** `objects/movementLock.ts`(순수): `isMovementLocked`(기절·속박·빙결·매혹)와
`restingPathSpeed`(둔화 × 가속). `Invader.resumePathIfFree()`가 유일한 복귀 통로이고
모든 만료 콜백·아우라가 이를 통한다. 아우라는 `boostMult` 수정자만 설정한다.

**검증.** `movementLock.test.ts` 5건, vitest 2957 pass. 프리뷰 실측(8084, 20스테이지에
`storm_cage`+`quagmire` 설치, 3웨이브 98 침입자 샘플): 동시 잠금 2종이 실제로 발생했고
**잠긴 채 이동 0건 · 잠금 없이 정지 0건** — 조기 해제도, 새로 생길 수 있는 영구 정지도
없다. 페이싱 모델 홈은 함정을 설치하지 않으므로(`trapIds: [undefined]`) 캠페인 가드
수치에는 영향이 없다.

**주의.** 하니스 주행 중에 같은 트리의 `src/`를 편집하면 HMR 리로드로
`Execution context was destroyed`가 난다. 이번에 20:lean 주행을 그렇게 날렸다 —
organic 회귀는 편집을 멈춘 뒤 다시 돌린다.

### 2026-09-18 — 페이싱 모델 현실화: 수호자 레벨을 누적 처치 XP에서 파생

**증상.** 스테이지 20(챕터2 피날레)이 organic에서 **lean 0/4 · expected 0/3** 전패.
시뮬은 같은 스테이지를 lean 80% · expected 100%로 봤다. 대조군(이동 수정 없는 main)도
동일하게 패배해 코드 회귀가 아님을 먼저 확인했고, a03b812 이후 밸런스 경로 diff도
전부 중립이었다.

**원인 — 게임이 아니라 모델이 틀렸다.** `buildHome`이 `defaultOwnedMonster`로 로스터를
만들어 **모든 수호자가 Lv1**이었다. 그런데 처치 XP는 로스터 전체에 지급된다
(`KillHandler`: 침입자 5, 보스 100). 1~19를 한 번씩만 깨도 누적 7,700 XP =
**Lv17**(`guardianAtkMult` ×1.60). 즉 모델은 실전 피해를 60~109% 과소평가한 홈으로
"이 스테이지는 클리어 가능한가"를 묻고 있었다.

**수정.** `stageKillXp` / `cumulativeKillXpByStage` / `expectedGuardianLevel`을 추가하고
`buildHome`이 그 레벨로 `ownedMonsters`를 만든다. 스타터 홈은 처치 XP가 0이라 Lv1 유지.
시뮬 재계산 결과 피날레 20·32·52·72가 전부 100%로 올라갔다(이전 80~88%).

**전제.** 이 수정이 의미를 가지려면 레벨이 실제 전투 피해에 들어가야 한다 — 같은 날
배선한 `guardianAtkMult`(전투·시뮬 공통)가 그 전제다. 그 전에는 모델에 레벨을 넣어도
아무 효과가 없었다.

**모델에 아직 없는 것.** 장비·함정·교감·장식. 레벨이 지배적 항이라 먼저 적용했고,
organic 재측정이 여전히 부족하면 같은 방식(게임 경제에서 파생)으로 추가한다 —
배수를 임의로 얹지 않는다.

**교훈.** "시뮬이 낙관적"이라고 기록해 온 격차의 상당 부분은 시뮬의 근사 오차가 아니라
**입력 홈이 비현실적**이어서였다. 시뮬과 organic이 크게 갈리면 모델 입력부터 의심할 것.

### 2026-09-18 — Ch1 후반(5~7)의 구조적 구멍: 방 레벨 게이트

**증상.** 가드셋 organic 스윕이 `5:lean` 전패를 물었다(HP 1800 → 0). 반복 측정하니
구간 전체가 선 아래였다 — **5·6·7 lean 합계 1/5 승**, 유일한 승리도 1800 중 50 잔여.
시뮬은 다섯 건 전부 승률 100%를 줬다(margin 5.2~7.4배).

**누출의 모양이 원인을 가리켰다.** 단조 누출이다: 웨이브 1~3 무손실, 4부터 매 웨이브
150~350, 10에서 정확히 0. 그리고 누출이 웨이브 **HP가 아니라 인원수**에 붙는다 —
w10(HP 1000·4명) −250 vs w9(HP 870·10명) −300. 변동이 아니라 처리량 부족이다.

**두 가지 원인.**

1. *모델 입력* — `buildHome`이 레벨은 누적 처치 XP에서 파생하면서 그 레벨이 주는
   스킬 포인트(5레벨당 1)를 안 썼다. `guardianAtkMult`가 읽는 노드는 강타(A1, +15%,
   1SP) 하나뿐이고 모든 트리가 그걸로 시작한다. `expectedSpentSkills`로 수정(lean
   DPS +7~10%). Lv1 가정과 같은 종류의 누락이었다. 수정 후에도 1/5 승이라 이것만으로는
   설명되지 않았다.

2. *게임 — 게이트* — `getMaxRoomLevel`이 Lv2를 DM5(스테이지 8)에 두고 있었다.
   스테이지 5에서 lean 플레이어는 **8,775골드**를 들고 있고 보드 전체를 Lv2로 올리는
   값은 **750**인데 쓸 수가 없다. 5~7 구간에서 방어가 자랄 길은 수호자 레벨 하나뿐인데
   웨이브는 8명 → 13명으로 커진다. lean DPS가 67·69·70으로 평평해지는 구간이 정확히
   거기다. DM3은 슬롯을 하나도 주지 않는 죽은 레벨이었다(`SLOT_UNLOCK_LEVELS`
   0,0,0,2,4,…) — 거기에 방 레벨을 붙였다.

**실측 (같은 주행, PACING_REPEATS=2).**

| | 수정 전 | 수정 후 |
| --- | --- | --- |
| 5:lean | 1/2 승 · HP 3·0% | **2/2 승 · HP 83·89%** |
| 6:lean | 0/2 승 · HP 0·0% | **2/2 승 · HP 89·89%** |
| 7:lean | 0/1 승 · HP 0% | **2/2 승 · HP 90·90%** |

HP 여유가 스테이지 10(100%)·20(68~80%)과 같은 대역에 들어왔다. lean 곡선도 평평한
구간 없이 단조가 됐다: 19→46→58→64→88→93→95→112→114→117. 밸런스 수치는 한 줄도
바꾸지 않았다 — 잠겨 있던 지출을 열었을 뿐이다. 전리품도 2,370 → 2,985로 늘었다.

**음성 결과 — 해석 가드는 만들 수 없다.** 시뮬의 파동 모델은 에너지 보존을 어긴다:
웨이브의 침입자 *한 명 한 명*에게 던전 전체 DPS를 통째로 준다(10명 웨이브 = 던전
출력 10배). 보존을 지키는 대체 모델(웨이브 예산 = dps × 통과시간)을 실측 12건에
맞춰봤지만 승패가 분리되지 않는다 — 80:lean은 예산비 **0.77로 승**, 5:lean은 **1.17로
패**. Ch1은 사거리 1·수호자 1인 방이고 후반은 방마다 여럿이라 노출 구조가 질적으로
다르다. **유닛 시뮬은 플레이어 전망용, 밸런스 판정은 organic 하니스만.** 해석
예측자를 다시 만들려 하지 말 것.

**교훈.** 모델 입력을 의심한 뒤에도 남는 격차가 있으면, 다음은 **수치가 아니라 게이트**다.
"플레이어가 쓸 자원은 있는데 쓸 곳이 잠겨 있는가"를 먼저 본다.

커밋: `6100fd3`(스킬 포인트) → `4e6d984`(기준선 1/5) → `8504b3c`(게이트) →
`ab102c4`(6/6).

### 2026-09-19 — 심연 깊이 곡선: 하니스 결함 둘이 게임 결함 다섯을 가리고 있었다

**증상.** 없었다 — 이게 핵심이다. 심연은 2026-09-16에 "organic 전투까지 닫혔다"고
기록돼 있었지만, 하니스가 구조적으로 **1층 밖을 검증할 수 없었다**.

**하니스 결함 둘.**
1. `state.abyss.highestFloor = 0`을 하드코딩하고 승리 시 `highestFloor === FLOOR`를
   기대했다. `clearAbyssFloor`는 `firstClear = floor === highestFloor + 1`이라
   다음 층만 인정하므로, `ABYSS_FLOOR=1` 말고는 **전부 거짓 실패**였다. 고침:
   `highestFloor = FLOOR - 1`로 시드, 패배 기대값도 `FLOOR - 1`.
2. 웨이브 예산이 10 × 2.5s = 25.0s(stepped)였다. 침입 경로는 **1,310px**이고
   이동 트윈은 `경로 길이 / speed`라, speed 18~20인 최심 보스는 3배속에서
   **21.8~24.3s**가 필요하다. 여유 0.7~3.2초는 여유가 아니다 — 층60 주행에서
   보스가 도착하지 못해 수호자 0인 던전이 378/7493으로 살아남아 **"승리"로
   판정**됐다. 웨이브별 피해 2,725 / 2,505 / 1,885 중 마지막이 보스를 뺀 값과
   정확히 일치한 것이 단서였다. 24슬라이스로 올리고 산정 근거를 주석에 남겼다.

**그 뒤에 드러난 게임 결함 다섯.** `count = min(4 + 층/2, 14)`가 층 20에서 상한에
닿고 그 뒤로는 밴드만 바뀌는데 밴드가 4개뿐이었다.

| | 구 동작 |
| --- | --- |
| 26~45층 (20개 층) | 같은 전투 하나, 총 HP 17,730 |
| 46~60층 (15개 층) | 같은 전투 하나, 10,290 — **중층부보다 42% 쉬움** |
| 보스 층 | 일반 3웨이브(기사 18 = 6,300)를 iron_golem(600) 1기로 교체 → **할인** |
| 던전 HP | `stageConfig`에 `dungeonHp`가 없어 60개 층 전부 `DungeonScene` 기본값 1,000 |
| 권장 전투력 | `40 × 1.16^(층−1)` → 층60에 **406,632**를 UI에 표시, 실제 웨이브는 층26보다 가벼움 |

**근인 한 줄: 전투 축과 전리품 축을 섞었다.** `abyssBand`(4밴드)는 재료 풀과 테마를
고르는 축인데 거기서 적까지 골랐다. `abyssTier`(6티어, 10층마다, 보스로 닫힘)를
분리하고 깊이를 **수가 아니라 유닛 티어**로 올린다(스폰 수 상한은 390px 보드
제약이라 정당하므로 티어 내부에서만 쓴다). 던전 HP와 권장 전투력은 층의 실제
웨이브에서 파생한다.

**실측 (organic, 4개 층 × win/loss).**

| 층 | 티어 보스 | maxHp (계산=실측) | win | loss |
| --- | --- | --- | --- | --- |
| 10 | fox_queen | 2,222 | 9→10, 무손실 | 0/2222, 9 유지 |
| 31 | (일반, undying_warrior) | 2,385 | 30→31, 무손실 | 0/2385, 30 유지 |
| 50 | primordial_titan (최저속 18) | 5,489 | 49→50, 무손실 | 0/5489, 49 유지 |
| 60 | void_sovereign | 7,493 | 59→60, 무손실 | 0/7493, 59 유지 |

hardFailures 0. **네 층 모두 `maxHp`가 파생식 계산값과 정확히 일치** — 배선이
끝까지 맞다는 뜻이다.

**교훈.** "검증 완료"라고 기록된 영역도 **하니스가 무엇을 볼 수 있었는지**를 먼저
물어야 한다. 이 하니스는 1층만 볼 수 있었고, 그래서 60층짜리 던전의 35개 층이
전투 두 개라는 사실이 몇 달을 살아남았다. 계측 도구의 커버리지는 그 자체로
검증 대상이다.

커밋: `63a07fa`(깊이 곡선 + 불변식 5개) → `9d6fb4d`(하니스 예산).

## 8. Completed implementation record: Fusion Chamber

사용자가 2026-09-04에 Fusion continuation을 승인했고, 아래 F0–F4 slice는 current
worktree에서 구현·검증되었다. 이 절은 동일 작업을 다시 실행하라는 지시가 아니라
완료 당시의 product/behavior/verification boundary를 보존하는 기록이다.

### Product job

Fusion은 bright emoji 연구소가 아니라 군단을 재구성하는 dungeon ritual chamber다.
플레이어는 무엇을 잃는지, 무엇이 생성되거나 성장하는지, 비용과 실패 가능성이
무엇인지 확인한 뒤 하나의 irreversible action을 실행해야 한다.

### Existing authoritative behavior

`src/data/fusionTransactions.ts`가 아래 상태 전이를 이미 pure function으로
소유한다. UI redesign은 이를 변경하지 않는다.

| Tab | Existing rule to preserve |
| --- | --- |
| 진화 | 같은 monster 3개를 소비해 다음 evolution을 만들고 선택 재료 중 최고 level을 유지한다. |
| 흡수 | target과 sacrifices를 분리하고, 희생체를 제거해 XP/absorption stack을 적용한다. Target을 sacrifice로 선택할 수 없다. |
| 조합 | owned roster의 서로 다른 2개와 soul crystal 100을 사용한다. Known recipe는 hybrid/discovery를 만들고, unknown recipe는 crystal을 소비하지만 fusion progress를 올리지 않는다. |
| 각성 | owned target, affinity 100, awakening stone 1, not-awakened 조건을 모두 검증한다. |

`totalFusions`, quest progress, `discoveredCombinations`, owned monster copy,
equipment/skill fields의 성공 의미는 보존했다. 독립 review에서 확인된 stale-source
integrity defect에 한해 `combination_source_not_owned` rejection을 추가했다. 이
guard는 crystal이나 roster를 변경하지 않으며 focused regression으로 고정했다.

### Baseline design debt closed in this record

- `FusionScene.ts`가 `CASUAL` cream tray와 bright storybook background를 사용한다.
- header와 ritual focus가 `🔬 연구소`, `🪄` emoji에 의존한다.
- 네 tab의 target/material/result/destructive consequence hierarchy가 분리되어 있다.
- 일부 codex text는 9px이며 close action이 44px surface가 아니다.
- combination/confirmation/result UI가 text objects와 scene-local custom drawing을
  반복한다.
- motion guard가 일부 존재하지만 tab focus, confirm, success/failure, picker,
  lifecycle 전체의 reduced-motion/browser evidence는 없다.

### Implementation phases

F0–F4는 2026-09-04 current-worktree record에서 모두 완료했다.

#### F0 — Read-only audit

1. `FusionScene`을 390×844 real renderer로 연다.
2. 진화/흡수/조합/각성, monster picker, combination codex, confirm, success/fail을
   각각 캡처한다.
3. empty, eligible, insufficient, destructive, known/unknown result 상태를 분리한다.
4. current click destinations, saved fields, timers/tweens, text/touch inventory를
   기록한다.

#### F1 — Contract and shell

1. `docs/design/DESIGN.md`에 `Fusion Chamber Design Contract`를 추가한다.
2. stone lintel, resource/status rail, 44px four-tab bar, ritual chamber shell을
   existing tokens/primitives로 교체한다.
3. default 진화 tab에서 target/material/result/consequence/one CTA가 첫 viewport에
   읽히게 한다.
4. 이 단계에서 transaction/data/recipe/economy를 수정하지 않는다.

#### F2 — Four transaction surfaces

1. 진화: 세 matching slots, resulting guardian preview, consumed identities
2. 흡수: primary target, sacrifice volume, XP/stack delta, irreversible warning
3. 조합: two source guardians, crystal cost, known/unknown outcome language,
   unknown failure still consumes 100 crystals라는 explicit warning
4. 각성: portrait-first target, affinity, stone state, already-awakened state,
   affected result

각 tab은 empty/disabled information을 숨기지 않고 action만 비활성화한다.

#### F3 — Shared overlays and lifecycle

Picker, confirm, codex, success/failure result의 input shield와 44px action을
통일한다. rapid double-tap 또는 서로 다른 tab action race로 transaction이 두 번
실행되지 않아야 한다. scene exit/re-entry 후 timer, tween, listener, blocker가
증가하지 않아야 한다.

#### F4 — Evidence and close-out

- exact 390×844 screenshots and SHA-256
- empty/eligible/insufficient/confirm/success/fail/known/unknown/awakened states
- one real transaction per tab where safe fixtures are available
- destructive cancel and confirm paths
- reduced-motion result/picker/confirm checks
- three-cycle scene restart cleanup and console audit
- focused fusion tests, full tests, build, diff check
- independent goal, code/security, QA evidence review

## 9. Fusion implementation files and completed boundary

### Read first

- `src/scenes/FusionScene.ts`
- `src/ui/FusionTabs.ts`
- `src/ui/FusionEvolutionTab.ts`
- `src/ui/FusionAbsorptionTab.ts`
- `src/ui/FusionCombinationTab.ts`
- `src/ui/FusionAwakeningTab.ts`
- `src/data/fusion.ts`
- `src/data/fusionTransactions.ts`
- `src/data/fusionTransactions.test.ts`
- `src/ui/GameUiPrimitives.ts`
- `src/constants/colors.ts`
- `src/utils/reducedMotion.ts`

### Writable boundary used for this close-out

- `src/scenes/FusionScene.ts`
- `src/ui/FusionTabs.ts`
- the four `src/ui/Fusion*Tab.ts` renderers
- a small Fusion-specific presentation helper/test only when duplication proves it
  necessary
- `src/ui/FusionSelectionState.ts` and its focused test
- `docs/design/DESIGN.md`
- `tools/screenshots/fusion-*.png`

`src/data/fusion.ts` and `src/data/fusionTransactions.ts` are read-only behavior
authority for a visual pass. A verified transaction defect requires a separate,
explicitly explained change and focused tests.

이번 close-out에서는 independent code review가 stale Combination source로
미보유 guardian을 합성할 수 있는 defect를 재현해 `src/data/fusionTransactions.ts`
와 focused test만 예외적으로 수정했다. 다음 surface의 writable boundary는 아직
승인되지 않았다.

## 10. Verification commands and evidence contract

Run the smallest focused check first, then the aggregate gate.

```bash
npm test -- --run src/data/fusion.test.ts src/data/fusionTransactions.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=FusionScene
```

For every rendered state, record:

- fixture/state and whether it mutates isolated localStorage
- viewport and DPR
- screenshot path and SHA-256
- primary/recovery/destructive interaction result
- visible text below 10px and touch targets below 44px
- overlap/clipping/horizontal overflow
- reduced-motion behavior
- console/runtime exceptions
- remaining unverified device or state

Do not run `npx cap sync`, Xcode/Gradle build, asset generation, or store tooling as
part of Fusion F0–F4 unless the user separately includes native/release work.

## 11. Completed implementation record: Shop Quartermaster

사용자가 2026-09-04에 다음 step 진행을 승인했고, Shop을 Legion economy의 남은
핵심 transaction surface로 선택했다. 이 절은 완료 당시의 scope와 invariant를
보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Shop은 bright card catalog가 아니라 군단의 resource와 보급 결정을 처리하는
dungeon quartermaster다. 첫 viewport에서 gem, soul crystal, UTC restock, 현재
department, merchandise state, cost, 다음 action을 함께 읽을 수 있어야 한다.

| Surface | Existing rule preserved |
| --- | --- |
| Skin card | 구매는 owned skin에만 추가하고 자동 장착하지 않는다. |
| Skin preview | 미보유 구매는 purchase-and-equip, 보유 skin은 무료 equip이다. |
| Theme | 구매 시 즉시 equip; owned equip과 non-default unequip은 추가 결제가 없다. |
| Daily equipment | current UTC offer만 soul crystal로 한 번 구매해 unique inventory에 추가한다. |
| Daily skill | current UTC offer만 soul crystal로 한 번 구매해 unique inventory에 추가한다. |

`src/data/shopTransactions.ts`, prices, skin/theme/item registries, UTC shuffle/seed,
save schema, and `BarracksScene` back destination remain authoritative and unchanged.

### Baseline debt closed

- Skin controls/text reached y=1,161/y=1,311 and Theme text reached y=898 without
  scrolling or pagination.
- Skin/theme/preview contained sub-10px labels, and visible 26–30px buttons relied
  on invisible 44px zones.
- Skin preview did not block background tab input.
- Equipment/Skill each added a second reset timer and successful daily purchase did
  not refresh the header crystal balance.

The completed layout uses one ledger, four 44px tabs, Skin shelves of four, Theme
shelves of three, one scene-owned recurring timer, a shielded portrait preview,
and a shared purchase confirm/persistent receipt. Ordinary tab/filter/page refresh
does not restart the scene.

### Implementation and writable boundary used

- `src/scenes/ShopScene.ts`
- `src/ui/ShopSkinTab.ts`
- `src/ui/ShopThemeTab.ts`
- `src/ui/ShopDailyTab.ts`
- `src/ui/ShopShared.ts`
- `src/ui/ShopShared.test.ts`
- `src/ui/ShopDailyTab.test.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/shop-*-final-390x844.png`

No Shop work was authorized in `src/data/shopTransactions.ts`, catalog/price files,
navigation authority, package manifests, assets, Capacitor/native projects, or
unrelated dirty paths. The implemented UTC boundary guard is UI-layer validation:
an offer removed by the current daily rotation returns a persistent non-mutating
receipt, and the pending day index is accepted only after the transaction latch
releases.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/shopTransactions.test.ts src/ui/ShopShared.test.ts src/ui/ShopDailyTab.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=ShopScene
```

Exact screenshots, SHA-256 values, transaction receipts, state deltas, UI metric
counts, and lifecycle signature are in `docs/design/DESIGN.md` under
`Shop Quartermaster Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice. Battle handoff/return은 browser registry simulation과 source-flow
대조로 검증했으며 실제 floor battle 전체 play-through는 아직 수행하지 않았다.

## 12. Completed implementation record: Production District

사용자가 2026-09-04에 다음 step 진행을 승인했고, Production을 completed Home과
Forge/Fusion 사이의 bounded resource loop로 선택했다. 이 절은 완료 당시의 scope와
invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Production은 facility catalog가 아니라 광산, 약초원, 직조실, 마력 우물, 보물고가
한 생산망으로 연결된 working undercroft다. 모든 station을 한 번에 읽되, 선택한
facility의 current→next output, exact cost/shortage, and one order만 command plate에서
우세하게 보여 준다. Claimable payout은 별도 jade collection action이 우선한다.

`src/data/production.ts`, `src/data/productionTransactions.ts`,
`src/data/idleIncome.ts`, save schema, decoration bonus, and `StageSelectScene` back
destination은 authority로 유지되며 변경되지 않았다. Facility selection은 저장하지
않는다. Build/upgrade와 collect만 반환된 새 `GameState`를 저장한다.

### Implementation and writable boundary used

- `src/scenes/ProductionScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/production-*-390x844.png`

No Production work was authorized in data authorities, `wisdom.ts`, navigation,
package manifests, assets, Capacitor/native projects, or unrelated dirty paths.
Enabled transaction controls lock through the press tween and admit one commit per
250ms gesture burst. A rejected duplicate leaves the rebuilt control usable; a
successful action destroys the old display/input objects before rebuilding the
scene, and its receipt remains visible.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/production.test.ts src/data/productionTransactions.test.ts src/data/idleIncome.test.ts src/ui/HudResourceFormatting.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=ProductionScene
```

Exact screenshots, SHA-256 values, transaction deltas, UI metric counts, and
lifecycle signatures are in `docs/design/DESIGN.md` under
`Production District Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 13. Completed implementation record: Decoration Reliquary

사용자가 2026-09-04에 다음 step 진행을 승인했고, Decoration을 completed Production
economy와 battle readiness를 연결하는 bounded bonus-composition surface로 선택했다.
이 절은 완료 당시 scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Decoration은 product-card catalog가 아니라 수집한 전리품을 세트로 조율하는 dungeon
reliquary다. 네 set을 한 화면에서 비교하고, 선택한 set의 세 relic과 2/3-piece tier,
exact cost 또는 slot consequence, acquire/place/remove 명령 하나를 함께 읽는다.

`src/data/decorations.ts`, `src/data/decorationTransactions.ts`, save schema,
Production/Battle bonus consumers, and `StageSelectScene` back destination은 authority로
유지되며 변경되지 않았다. Set/relic selection은 저장하지 않는다. 기존 pure
transaction이 반환한 새 `GameState`만 저장한다.

### Implementation and writable boundary used

- `src/scenes/DecorationScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/decoration-*.png`

No Decoration work was authorized in data authorities, `wisdom.ts`, bonus consumers,
navigation, package manifests, assets, Capacitor/native projects, or unrelated dirty
paths. Enabled orders lock through the press tween and admit one commit per 250ms
gesture burst. Rerender destroys old display/input objects, retains the receipt, and
adds no scene-level drag listener, recurring timer, or infinite tween.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/decorations.test.ts src/data/decorationTransactions.test.ts src/data/idleIncome.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=DecorationScene
```

Exact screenshots, SHA-256 values, transaction deltas, UI metric counts, and
lifecycle signatures are in `docs/design/DESIGN.md` under
`Decoration Reliquary Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 14. Completed implementation record: Abyss Expedition

사용자가 2026-09-04에 다음 step 진행을 승인했고, Abyss를 completed Forge/Fusion
supply loop와 shared battle result flow를 연결하는 bounded farming surface로 선택했다.
이 절은 완료 당시 scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Abyss는 floor-card catalog가 아니라 정복 깊이와 보급 대상을 선택하는 dungeon
expedition room이다. 다섯 층 window로 모든 `1..next` floor를 탐색하고, 선택한 층의
band, boss, recommended power, material pool, key/battle consequence를 읽은 뒤 하나의
challenge 또는 sweep 명령을 실행한다.

`src/data/abyss.ts`, `src/data/abyssTransactions.ts`, save schema, daily 12-key
refill, 60-floor power/loot/boss/wave rules, `DungeonScene` battle handoff, result
return, and Forge/Fusion/StageSelect destinations은 authority로 유지되며 변경되지
않았다. Page/floor selection은 저장하지 않는다. 기존 transaction/result flow가
반환한 새 `GameState`만 저장한다.

### Implementation and writable boundary used

- `src/scenes/AbyssScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/abyss-*-390x844.png`

No Abyss work was authorized in data authorities, `wisdom.ts`, battle/result code,
navigation, package manifests, assets, Capacitor/native projects, or unrelated dirty
paths. The selected order acquires a scene-level pointerdown latch and admits one
commit per 250ms gesture burst. Rerender destroys prior display/input objects,
retains the receipt, and adds no camera-drag listener, recurring timer,
auto-dismiss callback, or infinite tween.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/abyss.test.ts src/data/abyssTransactions.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=AbyssScene
```

Exact screenshots, SHA-256 values, selection/transaction deltas, registry receipts,
and lifecycle signatures are in `docs/design/DESIGN.md` under
`Abyss Expedition Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 15. Completed implementation record: Achievement Hall

사용자가 2026-09-04에 다음 step 진행을 승인했고, Achievement를 completed
progression/economy surfaces의 보상 증거를 모으는 bounded archive로 선택했다. 이
절은 완료 당시 scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Achievement는 long trophy feed가 아니라 하나의 milestone 진행·보상·수령 상태를
읽고 회수하는 dungeon hall of records다. Eight category seals와 three-record window로
79개 base와 5개 epilogue definition을 모두 탐색하고, selected ledger에서 exact
progress/reward와 persistent receipt를 확인한다.

`src/data/achievementData.ts`, `src/data/achievementDefsEpilogue.ts`,
`src/data/achievements.ts`, `src/data/progressionTransactions.ts`,
`src/data/rewardTransactions.ts`, save schema, reward amounts, category/target,
unlock calculation, and registry `previousScene` return은 authority로 유지되며
변경되지 않았다. Category/page/record selection은 저장하지 않고 existing pure
transaction이 반환한 새 `GameState`만 저장한다.

### Implementation and writable boundary used

- `src/scenes/AchievementScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/achievement-*-390x844.png`

No Achievement work was authorized in definition/progression/reward authorities,
persistence, routes, package manifests, assets, Capacitor/native projects, or
unrelated dirty paths. Individual and claim-all commands acquire a scene-level
pointer-down latch, block cross-view input through commit, and retain a receipt.
Rerender happens once on post-update and leaves no recurring timer, infinite tween,
visible mask source, or scene-level drag/wheel listener.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/achievements.test.ts src/data/achievementsEpilogue.test.ts src/data/progressionTransactions.test.ts src/data/rewardTransactions.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=AchievementScene
```

Exact screenshots, SHA-256 values, all-84/category reachability, individual and
aggregate reward deltas, stale-state and input-race receipts, and lifecycle
signatures are in `docs/design/DESIGN.md` under
`Achievement Hall Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 16. Completed implementation record: Codex Archive

사용자가 2026-09-04에 다음 step 진행을 승인했고, Codex를 completed Legion and
reward surfaces의 roster/threat intelligence archive로 선택했다. 이 절은 완료 당시
scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Codex는 long accordion/list가 아니라 하나의 guardian and threat archive다. Twelve
guardian seals, nine invader chapters, and four fixed modes를 통해 all 136 monsters,
52 invaders, 17 endless modifiers, and 13 wave events를 bounded paging으로 열고,
selected ledger에서 exact stats, acquisition or threat context, and tribe reward
receipt를 확인한다.

`MONSTER_DEFS`, `INVADER_DEFS`, `ENDLESS_MODIFIERS`, `WAVE_EVENTS`, existing reward
transactions, save schema, summon pools, combat consumers, Legion membership,
root destinations, and registry `previousScene` return은 authority로 유지되며
변경되지 않았다. Tab/group/page/record/filter state는 저장하지 않고 existing pure
transaction이 반환한 새 `GameState`만 저장한다.

Tribe eligibility는 view helper에서 fresh save를 기준으로 canonical ownership을
resolve하고, mapped reward와 모든 `unlockMethod=codex_reward` record를 requirement에서
제외한다. Existing transaction이 caller를 신뢰하므로 selected/aggregate command는
같은 fresh state에서 계산한 exact tribe/reward pair만 전달한다. 이 UI guard가
transaction authority 자체를 변경하거나 일반 API를 harden한 것으로 해석하면 안 된다.

### Implementation and writable boundary used

- `src/scenes/CodexScene.ts`
- `src/ui/CodexMonsterDetail.ts`
- `src/ui/CodexShared.ts`
- `src/ui/CodexShared.test.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/codex-*-390x844.png`

No Codex work was authorized in monster/invader/modifier/event definitions,
reward/progression transactions, persistence, summon pools, combat, routes,
package manifests, assets, Capacitor/native projects, or unrelated dirty paths.
The active scene no longer imports the old `CodexCell`; its unused legacy helper/
renderer remains existing debt rather than current authority.

Reward and route actions acquire one shared latch before animation or
reduced-motion dispatch. An admitted order blocks group/tab/back/root redirection;
an admitted back/root route blocks a same-frame order. Rerender is queued once on
post-update after a reward result and leaves no recurring timer, infinite tween,
mask object, or scene-level pointer/drag/wheel listener.

### Verification commands and browser evidence

```bash
npm test -- --run src/ui/CodexShared.test.ts src/data/rewardTransactions.test.ts src/data/monsters.test.ts src/data/summonPools.test.ts src/data/wisdom.test.ts src/data/wisdomEconomy.test.ts src/data/achievements.test.ts src/data/achievementsEpilogue.test.ts src/data/progressionTransactions.test.ts src/data/navigationContract.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=CodexScene
```

Exact screenshots, SHA-256 values, all-136/52/17/13 reachability, individual and
aggregate reward deltas, stale-state and route-race receipts, modal isolation, and
lifecycle signatures are in `docs/design/DESIGN.md` under
`Codex Archive Design Contract / Verification record — 2026-09-04`.
Evolved-only reward dedupe and malformed legacy claim-array reconciliation remain
pre-existing transaction/data debt outside this visual slice. Native packaging
and alternate whole-app viewport regression also remain unverified.

## 17. Completed implementation record: Ancestral Wisdom Chamber

사용자가 2026-09-04에 다음 step 진행을 승인했고, Ancestral Wisdom을 permanent
progression ritual chamber로 선택했다. 이 절은 완료 당시 scope와 invariant를
보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Ancestral Wisdom은 branch identity를 숨기는 radial ornament가 아니라 영구 성장을
승인하는 ritual chamber다. Four presentation-only lineages와 three named tablets를
통해 authoritative twelve branches를 모두 열고, selected ledger에서 current effect,
next effect, tier, exact cost/deficit, and post-spend balance를 확인한 뒤 하나의
irreversible upgrade를 승인한다.

`BRANCH_DEFS`, five-tier ceiling, tier costs, effect formulas, computed bonuses,
`upgradeWisdomBranch`, save schema, and `previousScene` return은 authority로 유지되며
변경되지 않았다. Live source에는 wisdom equip/reset transaction이나 save field가
없다. 과거 handoff의 `purchase/equip/reset` 표현은 stale requirement였으며 이
redesign은 존재하지 않는 behavior를 추가하지 않았다.

### Implementation and writable boundary used

- `src/scenes/AncestralWisdomScene.ts`
- `src/ui/AncestralWisdomShared.ts`
- `src/ui/AncestralWisdomShared.test.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/wisdom-*.png`

No Wisdom work was authorized in branch/economy definitions, shared transaction,
bonus consumers, persistence, navigation authority, achievement/summon/forge/combat
consumers, balance, package manifests, dependencies, assets, Capacitor/native files,
or unrelated dirty paths.

Selection is ephemeral. Upgrade admission begins on the command's pointer-down and
blocks lineage/branch/back input. Confirm and cancel share a second overlay-local
first-decision admission. Commit reloads the save and compares the approved
branch/tier/cost/balance snapshot before calling the existing transaction; only its
returned success state is saved. A mismatched or invalid fresh state is rejected
without mutation and remains visible as a durable receipt. Pending selection render
also blocks admission from an obsolete command, and a rejected rebuilt action becomes
available after the 250ms cooldown.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/wisdom.test.ts src/data/wisdomEconomy.test.ts src/ui/AncestralWisdomShared.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=AncestralWisdomScene
```

Exact final screenshots and SHA-256 values, all-twelve reachability, selected-state
layout audits, success/deficit/max/stale deltas, both confirm/cancel decision orders,
normal/reduced cross-input, contextual/fallback routes, cooldown, and lifecycle
signatures are in `docs/design/DESIGN.md` under
`Ancestral Wisdom Chamber Design Contract / Verification record — 2026-09-04`.
Malformed-tier validation inside the shared transaction remains pre-existing authority
debt; this scene blocks it before transaction entry. Alternate whole-app viewports,
physical-device accessibility, native packaging, store release, and commit history
remain unverified or out of scope.

## 18. Completed implementation record: Overall Web Completion

2026-09-05 사용자가 전체 설계·계획을 Goal로 완성하도록 요청했다. G0–G5는 기존
15개 surface를 재구현하지 않고 남은 두 presentation scene과 aggregate regression을
닫는 범위다. Runtime/data/navigation authority는 그대로 유지했다.

- EndlessResult: expedition memorial, exact awarded ledger, bounded modifier,
  separated retry/return and first-input admission. No persistence calls.
- Cinematic: 18px dialogue, left/right speaker seal, explicit action/skip,
  phase/version admission and owned timer/tween cleanup. Original content and
  mark-seen-on-entry behavior preserved.
- Demonstrated integration fixes only: Barracks roster/compact-preview label
  spacing, Home 44px utility controls, Summon 210px card and 44px rate footer.
- Reproducible isolated audits (start `npm run dev` first):

```bash
HEADED=1 node scripts/verify-endless-result.mjs
HEADED=1 node scripts/verify-cinematic.mjs
node scripts/verify-web-surfaces.mjs
npx tsc --noEmit
npm test
npm run build
git diff --check
```

The scripts use the locally installed Playwright runtime. `PLAYWRIGHT_MODULE`
overrides its absolute module path; `GAME_URL` overrides the two scoped scripts'
server, and `WEB_AUDIT_URL` overrides the aggregate server. No dependency added.

Machine evidence: `tools/endless-result-audit.json`, `tools/cinematic-audit.json`,
`tools/completion-web-audit.json`. Each records source and final screenshot hashes.
The dated contracts above define exact counts, receipts and boundaries. Standard
game-client text/state passed, but its black WebGL image exports were excluded;
real page screenshots provide the visual evidence.

Writable boundary used: the two scenes, `HomeCommandDeck.ts`, `BarracksCard.ts`,
`BarracksGrowthHall.ts`, `SummonScene.ts`, `SummonShared.ts`, three verification
scripts, scoped evidence images/JSON, design/plan/handoff/progress. No dependency,
schema, balance, content, route authority, asset, native or store changes.

## 19. Paste-ready continuation prompt

```text
작업 경로는 /Users/sungjin/dev/personal/dungeon md/dungeon-phaser 이다.
다른 sibling prototype이 아니라 이 Phaser/Vite/Capacitor app에서만 작업한다.

먼저 다음 순서로 전부 읽어라.
1. AGENTS.md
2. docs/design/AGENT_HANDOFF.md
3. docs/MONSTER_DUNGEON_DESIGN.md
4. docs/design/DESIGN.md
5. docs/design/CHARACTER_ART_REVISION.md와 output/character-art/ritual-v2/PROMPTS.md
   이전 web 완료는 WEB_COMPLETION_PLAN.md와 handoff 18절을 참고한다.
6. git status --short --branch와 대상 파일의 live diff

현재 completed table의 17개 surface는 current worktree에서 COMPLETE다.
EndlessResult와 Cinematic도 완료되었으므로 다시 구현하지 마라. 세 크기에서
45개 첫 상태와 Summon active banner 3개를 확인했지만 모든 modal/full gameplay
또는 native-ready를 의미하지 않는다. Live source/hash/evidence를 회귀 기준으로 보존하라.
최신 사용자 요청은 캐릭터 및 전체 디자인을 게임 기획에 맞게 다듬는 것이다.
대표 dokkaebi_warrior / gumiho_guardian / death_messenger / mountain_spirit의
ritual-v2 아트와 공통 초상화·world token·speaker 연결을 기준으로 이어간다.
기존 136 JPG는 그대로이며 나머지 132종은 새 아트로 교체되지 않았다.
먼저 live source와 character-art audit의 완료 상태를 확인하라. 다음 기본 후보는
Chapter 1 roster 및 남은 주요 speaker의 한 batch다. Exact IDs, silhouette,
role/material, 512px RGBA/512KiB, provenance와 browser acceptance를 먼저 고정하라.
새 자산은 versioned 경로에 추가하고 legacy/procedural/skin fallback을 보존하라.

반드시 보존할 것:
- 완료된 17개 surface의 contract, evidence, navigation, transaction 의미
- Fusion unknown combination의 soul crystal 100 소비 규칙과 stale-source
  ownership guard
- Shop의 card-purchase/preview-purchase-and-equip 구분, current UTC offer guard,
  one recurring timer, confirm/receipt latch와 overlay shielding
- Production의 facility selection non-mutation, press/cooldown transaction latch,
  persistent receipt, cost/rate/max/cap와 shared idle clock authority
- Decoration의 set/relic selection non-mutation, acquire/place/remove transaction
  authority, 12개 catalog/cost/slot/tier/bonus와 persistent receipt
- Abyss의 page/floor selection non-mutation, daily refill/sweep/clear transaction,
  all-60-floor reachability, battle registry handoff, persistent return receipt
- Achievement의 category/page/record selection non-mutation, all-84 reachability,
  existing unlock/reward transaction, stale-claim guard와 persistent receipt
- Codex의 all-136 guardian / 52 invader / 17 modifier / 13 event reachability,
  fresh-save tribe eligibility, exact mapped reward pair, stale guard, route/order
  shared latch, owned-detail isolation, persistent receipt
- Ancestral Wisdom의 all-12 branch/four-lineage reachability, selection non-mutation,
  upgrade-only authority, exact confirm snapshot guard, confirm/cancel shared admission,
  pending-render guard, cooldown, full-screen shield, persistent receipt
- EndlessResult의 reward-neutral presentation, exact retry payload와 route latch
- Cinematic의 원본 대사/pause, mark-seen-on-entry, nextData와 owned callback cleanup
- 승인된 네 종의 source/master/prompt provenance와 정확한 speaker identity
- root four-zone navigation과 기존 back/codex/picker destinations
- 현재 dirty worktree와 모든 미추적 산출물

금지:
- reset/checkout/clean, unrelated restore
- direct GameState mutation
- 선택되지 않은 다음 surface의 구현 또는 writable boundary 확장
- 새 dependency, token authority, save schema, balance, recipe, route,
  native/store 변경; 선택한 character batch 밖의 asset 교체
- commit/stage/push/merge/PR/cap sync/publishing
- source diff나 mock만 보고 완료 선언

선택된 acceptance의 repo-specific tests와 실제 browser/gameplay evidence를 통과시키고,
`docs/design/DESIGN.md`와 이 handoff의 completed/not-complete/next-boundary 기록을
현재 증빙에 맞게 동기화하라. 완료 보고는 current worktree 기준으로만 하라.
```

## 20. Handoff maintenance

다음 agent는 한 surface를 닫을 때 아래만 갱신한다.

1. 이 문서의 `Completed range`와 `What is not complete`
2. 다음 target과 writable boundary
3. `docs/design/DESIGN.md`의 surface contract/evidence
4. current branch/HEAD, aggregate test/build 결과, unverified targets

과거 evidence를 현재 결과처럼 덮어쓰지 않는다. 날짜별 record를 남기고, 실패한
gate가 있으면 `PARTIAL` 또는 `BLOCKED`로 표시한다.
