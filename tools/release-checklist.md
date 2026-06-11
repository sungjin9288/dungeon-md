# 던전 수호자 v1.0.0 — App Store 출시 체크리스트

## 빌드 상태 (최종 확인)
- [x] `npm run build` — TypeScript 에러 0
- [x] `npx cap sync` — iOS + Android 동기화 완료
- [x] 번들 크기: index 498kB + tone 251kB + phaser 1479kB (gzip 합계 ~535kB)
- [x] 버전: 1.0.0 / 빌드: 1

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
```
iPhone 15 Pro Max (6.7") — 필수
iPad Pro 12.9" (6세대) — 권장
```
씬별 캡처 방법:
1. Simulator에서 게임 실행
2. 각 씬 진입 후 `Cmd + S` (Screenshot to Desktop)
3. 해상도: 1290×2796 (iPhone 15 Pro Max)

촬영할 씬 5종:
| 번호 | 씬 | 내용 |
|------|-----|------|
| 01 | DungeonHomeScene | 던전 허브 + 방 배치 |
| 02 | StageSelectScene | 챕터/스테이지 진행도 |
| 03 | SummonScene | 소환 제단 + 시즌 배너 |
| 04 | CodexScene | 117종 몬스터 도감 |
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
- [ ] 첫 실행 → 튜토리얼 오버레이 표시
- [ ] MQ-001 퀘스트 자동 시작
- [ ] 방 건설 → 몬스터 배치 → 전투 시작
- [ ] 소환 (일반 1회 / 우정 소환 무료)
- [ ] 업적 달성 확인
- [ ] 오디오 BGM + SFX 재생
- [ ] 설정 화면 (음량 조절, 토글)

### 성능 테스트
- [ ] iPhone SE (2세대) — 저사양 기기
- [ ] 60fps 유지 확인
- [ ] 메모리 경고 없음
- [ ] 배터리 과소비 없음

### UI 확인
- [ ] Safe Area 적용 (노치/Dynamic Island 영역)
- [ ] 가로 화면 잠금 (세로 전용)
- [ ] 다크 모드 무관 (게임 자체 테마)

---

## 출시 후 할 일
- [ ] App Store 리뷰 모니터링
- [ ] 크래시 리포트 확인 (Xcode Organizer)
- [ ] 사용자 피드백 수집
- [ ] v1.1.0 계획 (Ch5 콘텐츠, 추가 몬스터)
