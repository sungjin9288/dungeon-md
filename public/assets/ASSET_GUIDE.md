# 던전 수호자 — 일러스트 에셋 드롭인 가이드 (#C)

> Runtime asset 규격과 originality의 최종 권위는 `docs/MONSTER_DUNGEON_DESIGN.md`다. 이 문서는 drop-in 절차만 보조하며, 충돌하면 디자인 문서를 따른다.

## 현재 캐릭터 아트 개정 (2026-09-05)

아래 흰 배경 JPG/프롬프트는 legacy catalog 안내다. 새로운 캐릭터 제작은
`docs/design/CHARACTER_ART_REVISION.md`와 `output/character-art/ritual-v2/PROMPTS.md`
를 따른다. 첫 네 종은 `monsters/ritual-v2/{id}.png`의 512×512 RGBA /512 KiB 이하
cutout으로 연결한다. 실제 alpha를 검사하고, 기존136 JPG는 덮어쓰지 않는다.
`src/data/characterArt.ts`에 명시된 versioned override만 로드된다. Portrait/room
token은 v2→legacy JPG→기존 procedural 경로를 사용한다. Home world sprite는
v2→procedural이며 JPG를 사용하지 않는다. Cinematic의 exact mapped speaker는
v2→legacy JPG→원래 emoji, unmapped speaker는 원래 emoji를 사용한다.
새 PNG를 legacy JPG manifest에 추가하거나 경로만 바꿔 같은 texture cache에
재사용하지 않는다.

검증: `npx vitest run src/data/characterArt.test.ts src/data/portraitManifest.test.ts`,
Vite 실행 후 `HEADED=1 node scripts/verify-character-art.mjs`. PNG 채널의 존재만으로
투명을 판정하지 말고 실제 transparent pixel과 renderer 배경을 확인한다.

진짜 "경영물" 룩의 결정적 도약은 **일러스트 에셋**이다. 코드 측 분위기/UI 폴리시는 끝냈고
(`SceneAtmosphere` + `applyCasualBackground`), 이 문서는 **이미지를 생성해 드롭인하면 즉시
반영**되도록 슬롯·사양·프롬프트를 정리한다. 모든 슬롯은 폴백이 있어, 파일이 없으면 기존
절차적 렌더로 안전하게 떨어진다.

공통 아트 디렉션 (모든 프롬프트 앞에 붙일 것):
> 한국 설화 기반 다크 던전 판타지, **페인터리 일러스트(픽셀아트 아님)**, 따뜻한 횃불 조명 +
> 깊은 그림자, 모바일 경영/수집 게임 품질(쿠키런 킹덤·AFK 저니·타운십 톤), 응집된 팔레트
> (먹색 베이스 + 황금/주황 토치 + 보라/청록 마법광), 한 세트로 보이는 일관성, 텍스트·UI 없음.

---

## 우선순위 1 — 몬스터 portrait (배선 완료)
수집 몬스터 136종 모두가 일러스트 portrait를 사용한다. 실제 상태는
`npm run check:portraits`와 `src/data/portraitManifest.test.ts`가 검증한다.
- **경로**: `public/assets/monsters/{monsterId}.jpg`
- **규격**: 정확히 256×256 JPEG, 150KB 이하, 중앙 정렬 전신 치비, 흰 배경.
- **드롭인**: 정확한 `monsterId` 파일을 넣고 `npm run check:portraits` →
  `npm run gen:portraits` → `npm test`를 실행한다. `BootScene` 배열을 수동 수정하지 않는다.
- 파일/매니페스트에 없는 몬스터는 404 없이 procedural art로 폴백한다.
- **프롬프트 템플릿**: `{공통}, "{한글명}" — {tribe}족 {element}속성 {rarity}등급, {melee/ranged/
  magic/support} 역할이 드러나는 포즈, 중앙 정렬 전신 치비.`
  예) `…"공허 군왕" — 공허족 암흑속성 전설등급, 근접 전사(탱커/돌격) 컨셉이 드러나는 무(無)를 두른 중앙 정렬 전신 치비 포즈.`

## 우선순위 2 — 챕터별 전투 배경 (배선 완료)
Chapter 1과 승인된 FC1/FC3/FC4/FC5/FC6/FC7/FC8/FC9 Chapter 2–9는 각각 `battle-ch1.png`부터 `battle-ch9.png`까지 사용한다. 모든 campaign chapter에 전용 battle backdrop이 있으며, 파일이 없거나 texture load가 실패하면 `dungeon-chamber.png`로 안전하게 폴백한다.
배선은 끝났다 — `drawDungeonDefenseFrame`이 `bg-battle-ch{chapter}` 텍스처가 있으면 그걸,
없으면 chamber→절차적으로 자동 폴백한다.
- **경로**: `public/assets/backgrounds/battle-ch{1..9}.png`
- **치수**: 정확히 1024×1024 PNG, 512 KiB 이하. 어둡게, 중앙 70%×70%는 비워 방 그리드가 읽히게 한다.
- **드롭인(2스텝)**: ① 파일을 위 경로에 넣고 ② `src/scenes/BootScene.ts`의
  `BATTLE_BG_CHAPTERS` 배열에 챕터 번호 N 추가. 끝. (목록에 없으면 로드 안 함 → 404 없음.)
- **프롬프트**: `{공통}, original {챕터 테마} 전투 환경 — 정사각, 어두운 중앙(빈 무대) + 가장자리
  횃불·구조물, 인물·몬스터·문자·UI·logo·watermark 없음, 특정 작품 모사 없음.` 챕터 테마: 1 도깨비숲 / 2 구미호계곡 / 3 용왕해저궁 / 4 저승관문 / 5 삼신산 /
  6 영원의왕좌 / 7 신계침공 / 8 원초의심연 / 9 공허 너머.

## 우선순위 3 — 보스 일러스트
최종/챕터 보스 등장 연출·인트로 임팩트.
- **경로**: `public/assets/bosses/{invaderType}.png` (신규 슬롯 — 요청 시 배선).
- **치수**: 768×1024 세로 전신, 투명 배경(PNG).
- 대상: `primordial_titan`, `void_sovereign`(Ch9 최종), 각 챕터 보스.
- **프롬프트**: `{공통}, "{한글명}" 보스 전신 일러스트, 위협적 실루엣, 투명 배경.`

## 우선순위 4 — 홈 배경 정련 (선택)
`dungeon-shaft.png`(971×1619) 이미 사용 중. 더 높은 품질로 교체 가능(동일 경로/키).

---

## 통합 원리 (참고)
- 배경: `src/art/DungeonBackdrop.ts`의 `bakeDungeonBackdrop(scene, key, w, h, realAssetKey?)`
  — `realAssetKey` 텍스처가 로드돼 있으면 그걸, 아니면 Canvas2D 폴백을 베이킹. 홈=`bg-dungeon-shaft`,
  전투=`bg-dungeon-chamber`.
- 초상: 코덱스/병영/소환이 `monster-ai-{id}` 텍스처를 우선 사용, 없으면 `PixelMonsters` 절차 렌더.
- 분위기(코드, 완료): 모든 다크 씬은 `applyCasualBackground`→`addSceneAtmosphere`로 토치
  글로우+잉걸+비네트를 자동 획득. 전투는 `vignette:false`로 적용.

새 에셋을 추가하거나 교체한 뒤에는 위 검사·생성·테스트 순서로 배선을 동기화한다.
