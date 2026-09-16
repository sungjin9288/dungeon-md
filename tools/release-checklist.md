# 던전 수호자 v1.1 — App Store 출시 체크리스트

## 빌드 상태 (최종 확인: 2026-09-03 — 현재 worktree 재검증)
- [x] `npm test` + `npm run build` — 테스트 2,818개 / 96 파일 전부 통과, production build 성공
- [x] `npx cap sync` — 2026-09-03 dist → iOS + Android 재동기화 (`LANG=en_US.UTF-8`, pod install OK).
      `public/` 웹 자산은 gitignore 파생물이라 추적 diff 없음(정상).
- [x] 번들 크기(gzip): phaser 338kB + app-gameplay 239kB + app-data 97kB + tone 62kB + 그 외 ~17kB
      = **합계 ~753kB gzip** (raw ~3.10MB). manualChunks로 phaser/tone/data/gameplay 분리.
- [x] iOS 버전: 1.1 / 빌드: 2
- [x] **출하 번들 standalone 검증** — 2026-09-03 dev server 없이 iPhone 17 Pro Max 시뮬레이터에 설치해
      부팅→홈·군단·도감·소환·침공 scene 진입과 Safe Area를 실제 입력으로 재검증.

---

## Phase A — Xcode (iOS)

### 1. 프로젝트 열기
```bash
npx cap open ios
```

### 2. 서명 설정
- **Xcode → App 타겟 → Signing & Capabilities**
- Team: 본인 Apple Developer 계정 선택
- Bundle Identifier: `com.dungeon.guardian`
- Provisioning Profile: Automatic (Xcode Managed)

### 3. 앱 아이콘 추가
```
ios/App/App/Assets.xcassets/AppIcon.appiconset/
```
- `tools/icons/AppIcon-1024@2x.png` → 1024×1024 App Store 아이콘으로 복사
- Xcode에서 AppIcon.appiconset에 드래그

### 4. 스플래시 스크린
- **Capacitor SplashScreen 플러그인** 이미 설정됨 (backgroundColor: #1a0f00)
- 추가 커스텀이 필요하면 `ios/App/App/Assets.xcassets/Splash.imageset/` 수정

### 5. 스크린샷 촬영 (Simulator)
> ✅ 2026-09-03 — `tools/screenshots/01~05.png`를 현재 standalone iOS 번들에서 재촬영
> (iPhone 17 Pro Max, 1320×2868, 상태바 9:41). dev-only scene jump를 사용하지 않고 실제 화면 입력으로 이동했으며,
> Home·Stage Select·Summon·Codex·Barracks와 Safe Area를 캡처 후 육안 확인함.
> ✅ 2026-09-03 — `tools/screenshots/ipad-01~03.png`도 현재 standalone iOS 번들에서 실제 입력으로 재촬영
> (iPad Pro 13-inch M5, 2064×2752): Home·Stage Select·Summon 확인 완료.
```
iPhone 17 Pro Max (6.9") — 현재 증빙
iPad Pro 13-inch (M5) — 현재 증빙
```
> iPad는 390×844 portrait game canvas를 풀하이트로 유지하고 좌우 여백을 사용함.
씬별 캡처 방법:
1. Simulator에서 게임 실행
2. 각 씬 진입 후 `Cmd + S` (Screenshot to Desktop)
3. 현재 해상도: iPhone 1320×2868 / iPad 2064×2752

촬영할 씬 5종:
| 번호 | 씬 | 내용 |
|------|-----|------|
| 01 | DungeonHomeScene | 던전 허브 + 방 배치 |
| 02 | StageSelectScene | 챕터/스테이지 진행도 |
| 03 | SummonScene | 소환 제단 + 시즌 배너 |
| 04 | CodexScene | 136종 몬스터 도감 |
| 05 | BarracksScene | 몬스터 막사 + 스킬 트리 |

### 6. 아카이브 & 업로드
```
Product → Archive → Distribute App → App Store Connect
```

---

## Phase B — App Store Connect

### 1. 앱 기본 정보
| 항목 | 값 |
|------|-----|
| 이름 | 던전 수호자 |
| 영문 이름 | Dungeon Guardian |
| 기본 언어 | 한국어 |
| 카테고리 | 게임 > 전략 |
| 부 카테고리 | 게임 > 롤플레잉 |

### 2. 메타데이터 붙여넣기
→ `tools/store-metadata.md` 파일 내용 참조

- **앱 설명 (한국어)**: 4,000자 이내 설명 복사
- **홍보 문구**: 170자 이내 한 줄 설명
- **키워드**: 100자 이내, 쉼표 구분

### 3. 개인정보처리방침 URL
```
https://[본인 도메인]/privacy.html
```
> `public/privacy.html` 파일을 웹 호스팅에 배포 (GitHub Pages 가능)

#### GitHub Pages 배포 방법:
```bash
# 방법 1: dist 폴더를 GitHub Pages에 직접 배포
# - GitHub 저장소 생성
# - dist/ 내용을 gh-pages 브랜치에 push
# - Settings > Pages > Source: gh-pages branch

# 방법 2: Netlify Drop
# https://app.netlify.com/drop → dist 폴더 드래그
```

### 4. 연령 등급
- **4+** 선택 (폭력/성인 콘텐츠 없음)
- 만화/판타지 폭력: 없음
- 도박: 없음 (소환은 가상 화폐, 실제 결제 없음)

### 5. 가격
- **무료** 선택
- 인앱결제: 없음

---

## Phase C — Android (Google Play) — 선택

### 1. 서명 키 생성 (최초 1회)
```bash
keytool -genkey -v \
  -keystore dungeon-guardian.keystore \
  -alias dungeon-guardian \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

### 2. 릴리즈 빌드
```bash
cd android
./gradlew assembleRelease
# 또는 Bundle (권장):
./gradlew bundleRelease
```

### 3. 서명
```bash
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore dungeon-guardian.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  dungeon-guardian
```

---

## 최종 검증 항목

### 기능 테스트
- [x] 첫 실행 → 튜토리얼 오버레이 표시 (2026-06-11 Preview E2E — 5단계 전체 완주, stage DONE)
- [x] MQ-001 퀘스트 자동 시작 (2026-06-11 — MQ-001→002→003→004 체인 검증, 홈 정산 데드락 수정 후)
- [x] 방 건설 → 몬스터 배치 → 전투 시작 (2026-06-11 — 추천 배치 → INV-001 방어 승리 ★★★ → 귀환 정산)
- [x] 소환 (일반 1회 / 우정 소환 무료) (2026-06-11 — 우정 무료 1회 + 일반 💎30 1회, 몬스터 획득·재화 차감 확인)
- [x] 업적 달성 확인 (2026-06-11 — 비전투 해금 스윕 수정 후 2/70 해금·수령 💎+5 확인)
- [ ] 오디오 BGM + SFX 재생 — 실기기 필요 (설정 토글·영속화 + API 크래시 안전성(SFX 9종/BGM 2종/볼륨, suspended 컨텍스트) 검증 완료, 사운드 출력만 미확인)
- [x] 설정 화면 (음량 조절, 토글) (2026-06-11 — BGM ON→OFF 토글, dungeonAudioSettings 저장 확인)

### 성능 테스트
- [ ] iPhone SE (2세대) — 저사양 기기
- [ ] 60fps 유지 확인 (브라우저 전투 중 FPS 60 표시 확인 — 실기기 재확인 필요)
- [ ] 메모리 경고 없음
- [ ] 배터리 과소비 없음

### UI 확인
- [x] Safe Area 적용 (노치/Dynamic Island 영역) (2026-09-03 — iPhone 17 Pro Max 5개 씬, iPad 3개 씬 재검증)
- [x] 가로 화면 잠금 (세로 전용) (2026-06-11 — iOS Info.plist Portrait 전용 + UIRequiresFullScreen, Android screenOrientation="portrait")
- [x] 다크 모드 무관 (게임 자체 테마) (2026-06-12 — prefers-color-scheme:dark 강제 상태에서 동일 렌더, body #1a0f00 고정)

### 네이티브 빌드 검증 (현재 상태: 2026-09-03)
- [x] iOS 시뮬레이터 빌드 — iPhone 17 Pro Max 대상 `xcodebuild` BUILD SUCCEEDED, standalone 설치·구동 확인
- [ ] 향후 iOS lifecycle 대응 — Xcode 26 runtime이 `UIScene` lifecycle 채택이 곧 필수가 된다고 경고함.
      현재 실행에는 영향 없지만 다음 native shell 업데이트 범위에서 전환 필요
- [ ] 향후 iPad orientation 대응 — Xcode 26 runtime이 `UIRequiresFullScreen`이 향후 무시되고 전체 orientation 지원이
      필요해질 예정이라고 경고함. 현재 portrait 실행에는 영향 없지만 다음 iPadOS 대응 전에 native shell 검토 필요
- [x] Android 현재 worktree debug 빌드 — Android Studio bundled OpenJDK 21로 `:app:assembleDebug` BUILD SUCCESSFUL
- [ ] Android 현재 emulator visual smoke — 새 APK cold start와 `DungeonHomeScene` 렌더는 확인했지만 headless AVD의
      `System UI isn't responding` overlay 때문에 깨끗한 캡처·추가 입력 검증은 보류 (앱 process의 `FATAL EXCEPTION`은 없음)
- [x] **Android 에뮬레이터 실행 검증** — APK 설치·구동, 게임 홈·튜토리얼 인터랙션 정상,
      세로 잠금 작동(가로 회전 강제에도 ROTATION_0 유지), `tools/screenshots/android-01-home.png`
      (2026-06-11 기록: Medium Phone API 36, 1080×2400. ※ Android 아이콘·스플래시 커스텀 교체 완료 — 게임 문양 + #1A0F00 배경)
- [x] cap sync 정상 (※ `LANG=en_US.UTF-8` 필요 — CocoaPods UTF-8 제약)
- [x] 앱 아이콘 1024×1024 AppIcon.appiconset 배치 완료
- [x] public/privacy.html 존재 (Phase B: 웹 호스팅 배포만 남음)

---

## 출시 후 할 일
- [ ] App Store 리뷰 모니터링
- [ ] 크래시 리포트 확인 (Xcode Organizer)
- [ ] 사용자 피드백 수집
- [ ] v1.2.0 계획 (Ch5 콘텐츠, 추가 몬스터)
