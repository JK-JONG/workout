# Workout Tracker

운동·식단·신체 기록을 모두 **브라우저 안**에 저장하는 단일 프론트엔드 PWA.
서버·DB·로그인 시스템 없이 GitHub Pages 같은 정적 호스팅에 올려두고 URL만 공유하면 끝.

## 핵심 특징

- **백엔드 없음** — 모든 데이터는 사용자 브라우저의 localStorage 에 저장. 같은 URL을 받은 사람마다 자기 데이터를 갖는다.
- **간단 게이트** — 첫 진입 시 비밀번호(앱에 하드코딩) + 이름(프로필 키) 한 번만 입력.
- **프로필별 분리** — 한 기기에서 가족·친구가 각자 이름으로 들어와도 데이터가 안 섞임.
- **JSONL 백업** — 설정 메뉴에서 `.jsonl` 파일로 내보내기·가져오기. 다른 기기로 옮기거나 백업할 때 사용.
- **PWA** — 홈 화면 추가 시 앱처럼 동작. 운동 GIF·정적 자원 캐싱으로 오프라인에서도 열림.

## 화면 구성

| 경로 | 내용 |
|---|---|
| `/#/` | 기록 — 운동 / 식단 / 신체 3탭. 상단에 날짜 + kcal 섭취/소모/Net 요약. |
| `/#/stats` | 통계 — 1년 잔디(소모·섭취·운동횟수), 신체 추이(몸무게·체지방·근육량), 최근 30일 칼로리 추이, 부위별 빈도, PR Top 8. |
| `/#/settings` | 설정 — 프로필 전환·삭제, JSONL 내보내기/가져오기(병합/덮어쓰기), 내가 등록한 음식 관리, 위험 구역. |

## 실행 방법 (로컬 개발)

```bash
cd fe
npm install
npm run dev                # http://localhost:5173
```

## 빌드 / 배포

### GitHub Pages 자동 배포 (권장)

`main` 브랜치에 푸시하면 `.github/workflows/pages.yml` 이 자동 실행:

1. 저장소 Settings → Pages → Source = **GitHub Actions** 로 변경
2. `main` 으로 푸시
3. Actions 탭에서 빌드 완료 후 `https://<user>.github.io/<repo>/` 에 배포됨

워크플로우가 `VITE_BASE=/<repo>/` 를 자동 주입해 정적 경로를 맞춰준다.

### 로컬 빌드

```bash
cd fe
npm run build              # → fe/dist
npx serve dist             # 또는 npm run preview
```

루트 외 다른 base 가 필요할 땐:
```bash
VITE_BASE=/custom-base/ npm run build
```

## 데이터 모델

localStorage 키 형식: `wt.p.<프로필이름>.<항목>`

| 키 | 내용 |
|---|---|
| `workouts` | 운동 기록 (WorkoutEntry[]) |
| `meals` | 식단 기록 (MealEntry[]) |
| `body` | 신체 기록 (BodyEntry[]) — 몸무게 필수, 체지방·근육량·메모 선택 |
| `customFoods` | 사용자가 등록한 음식 (FoodItem[]) |
| `weight` | 운동 칼로리 계산용 기본 체중 |
| `selectedDate` | 현재 보고 있는 날짜 |

전역 키 (프로필 공용):
- `wt.gateUnlocked` — 비밀번호 통과 여부
- `wt.activeProfile` — 현재 사용 중인 프로필 이름
- `wt.knownProfiles` — 이 기기에서 사용된 프로필 목록
- `wt.recordTab` — 마지막으로 본 기록 탭(운동/식단/신체)

## JSONL 포맷

NDJSON 형태. 각 줄이 하나의 JSON 객체.

```jsonl
{"_type":"meta","profile":"olaf","exportedAt":"2026-05-27T01:30:00Z","version":1}
{"_type":"workout","id":"...","date":"2026-05-27","exerciseId":"bench-press",...}
{"_type":"meal","id":"...","date":"2026-05-27","foodId":"chicken-breast-200",...}
{"_type":"body","id":"...","date":"2026-05-27","weightKg":75.2,"bodyFatPct":18.5}
{"_type":"customFood","id":"custom-...","name":"내 음식","kcal":150,...}
```

가져오기 시 `id` 기준 중복 제거(병합) 또는 전체 덮어쓰기 선택 가능.

## 보안 메모

- 비밀번호는 JS 번들에 포함됨 → URL 우연 접근 차단 수준의 약한 게이트. 강력한 인증이 필요하면 Cloudflare Pages + Access 같은 호스팅 레벨 인증으로 옮길 것.
- 데이터는 어차피 각 브라우저 안에만 있으므로, URL 이 유출돼도 다른 사람이 내 기록을 보지는 못함.

## 기술 스택

- Vue 3 (Composition API + `<script setup>`)
- TypeScript
- Vite 6
- Pinia (상태)
- VueUse (`useLocalStorage` 등)
- vite-plugin-pwa (PWA + Workbox)
- vue-router (hash 모드 — GitHub Pages 호환)

## 데이터 출처

- 운동 GIF: `hasaneyldrm/exercises-dataset` 공개 데이터셋
- 영양값: 일반적인 추정치 (정확한 식이요법용 아님)
- 본 앱: 개인 사용 목적
