# CLAUDE.md — workout-tracker

## 프로젝트 개요

- **서비스**: 운동·식단·신체 기록을 위한 **프론트엔드 단독 PWA**
- **서버 직접 운영 없음**: 데이터는 기본 브라우저 localStorage. **선택적**으로 동기화 코드를 켜면 관리형 Supabase(Postgres + RPC)로 기기 간 공유 — 우리가 띄우는 서버는 없음.
- **호스팅**: GitHub Pages 자동 배포 (`.github/workflows/pages.yml`)
- **URL 형태**: `https://<user>.github.io/<repo>/#/` (hash router)
- **스택**: Vue 3 + Vite 6 + Pinia + vite-plugin-pwa

---

## 실행 방법

### 로컬 개발
```bash
cd fe
npm install
npm run dev          # http://localhost:5173
```

### 빌드
```bash
cd fe
npm run build        # → fe/dist
npm run preview      # 빌드 결과 미리보기
```

### 타입체크
```bash
cd fe
npm run typecheck
```

### GitHub Pages 배포
- `main` 브랜치 푸시 → 워크플로우 자동 실행 → Pages 배포
- 저장소 Settings → Pages → Source = **GitHub Actions** 한 번만 설정해두면 됨
- 워크플로우가 `VITE_BASE=/${{ repo }}/` 자동 주입

---

## 폴더 구조

```
fe/
├── src/
│   ├── App.vue                    # AppGate + AppNav + RouterView 래퍼
│   ├── main.ts
│   ├── components/
│   │   ├── AppGate.vue            # 동기화 코드 + 프로필 선택 게이트
│   │   ├── AppNav.vue             # 상단 네비 (기록/통계/설정)
│   │   ├── DailySummary.vue       # kcal 섭취/소모/Net 카드
│   │   ├── LineChart.vue          # SVG 라인 차트 (신체 추이용)
│   │   └── MiniHeatmap.vue        # 잔디 (52주 그리드)
│   ├── composables/
│   │   ├── useCalorie.ts          # MET 기반 kcal 계산
│   │   ├── useProfileStorage.ts   # 프로필별 localStorage 래퍼
│   │   └── useJsonl.ts            # JSONL Export/Import
│   ├── data/
│   │   ├── exercises.ts           # 운동 카탈로그 (BE seed_data.py 에서 이관)
│   │   ├── foods.ts               # 음식 카탈로그
│   │   └── mealPresets.ts         # 박종권 식단 택1~5
│   ├── stores/
│   │   ├── profile.ts             # 프로필 선택·삭제(톰스톤)
│   │   ├── catalog.ts             # 정적 데이터 + 커스텀 음식
│   │   └── log.ts                 # 운동/식단/신체 기록
│   ├── router/index.ts            # hash router · 3 routes
│   └── views/
│       ├── RecordView.vue         # 날짜·탭 wrapper + Summary
│       ├── StatsView.vue          # 잔디·추이·PR
│       ├── SettingsView.vue       # 프로필·JSONL·위험구역
│       └── tabs/
│           ├── WorkoutTab.vue     # 운동 입력·기록
│           ├── MealTab.vue        # 식단 입력·기록
│           └── BodyTab.vue        # 신체 입력·기록
├── public/favicon.svg
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts                 # base = $VITE_BASE ?? '/'
```

---

## 핵심 규칙

### 게이트 (동기화 코드 전용)
- 비밀번호 단계는 제거됨. 사이트 진입 시 곧장 **동기화 코드 입력 화면**이 뜬다.
- 코드(24자, Crockford Base32)를 모르면 아무것도 못 봄. 코드는 번들에 박지 않으므로 관리자만 안다.
- 코드는 한 기기당 1회 입력 → localStorage 저장 → 이후 자동 통과.

### 프로필 시스템
- 모든 데이터 키는 `wt.p.<프로필이름>.<항목>` 형태로 localStorage 에 분리 저장.
- 새 컴포저블에서 프로필별 상태가 필요하면 `useProfileStorage<T>(key, default)` 사용.
- 전역 키 (프로필 무관) 는 `wt.<항목>` (예: `wt.activeProfile`).

### 데이터 흐름
- `catalog.exercises/foods/mealPresets` — 정적 데이터 + 커스텀 음식 병합 (computed)
- `log.workouts/meals/body` — 프로필별 기록 (useProfileStorage)
- `profile.activeProfile` 이 바뀌면 useProfileStorage 가 자동으로 새 키 로드

### JSONL
- NDJSON. 각 줄에 `_type` 태그 + 페이로드.
- 가져오기 시 `id` 충돌은 병합 모드면 건너뜀, 덮어쓰기 모드면 전체 비운 뒤 적용.
- 포맷 변경 시 `MetaRecord.version` 올리고 `useJsonl.ts` 에 마이그레이션 분기 추가.

### 동기화 (Supabase · 선택)
- **모델**: "동기화 코드"(Crockford Base32, 120bit) 1개 = vault 1개 = 앱 전체 데이터(모든 프로필). 코드를 켜야만 동작하고, 끄면 종전처럼 완전 로컬.
- **저장소**: Supabase `vaults` 테이블(`code_hash`/`data`/`version`/`updated_at`). RLS ON + 정책 0개로 직접 접근 차단, 접근은 `sync_pull`/`sync_push` RPC(`SECURITY DEFINER`, `search_path` 고정)로만. 해시는 내장 `sha256()` 사용(pgcrypto 불필요). SQL은 `supabase/migrations/0001_vaults.sql` — Supabase **SQL Editor**에 붙여넣어 적용.
- **키/URL**: `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY` (둘 다 public, 노출 안전). 로컬은 `fe/.env.local`, Pages 빌드는 워크플로우 `env`(또는 repo Variables)로 주입.
- **흐름**: 앱 진입 시 1회 pull→병합→push, 이후 변경분 자동 push(디바운스 1.5s). 충돌은 `version` 낙관적 잠금 + id 기반 union 재병합(최대 3회).
- **게이트**: 사이트 진입 첫 화면이 **동기화 코드 입력**. 코드 없는 기기는 이 화면에서 빠져나갈 수 없다(재접속에도 동일). 코드는 정확히 24자(Crockford Base32) — 부분 입력으로 다른 vault 에 우연히 접근하는 사고를 막는다.
- **삭제 전파(v2)**: 프로필 삭제는 `deletedProfiles` 톰스톤으로 vault 에 함께 올라가, 다른 기기에서도 union 머지 후 제외된다. 같은 이름을 다시 만들면 톰스톤에서 자동 제거(부활). 운동/식단/신체 항목 개별 삭제는 여전히 union 머지라 톰스톤 없음(v1 트레이드오프 유지).
- **관련 파일**: `lib/supabase.ts`, `lib/syncMerge.ts`(순수 병합), `stores/sync.ts`(로직·상태), `views/SettingsView.vue`(동기화 섹션), App.vue `onMounted`에서 `useSyncStore().init()`.

---

## 주의사항

- **우리가 직접 운영하는 백엔드는 없습니다.** Docker·docker-compose·FastAPI 같은 자산을 만들지 마세요. 데이터는 기본 브라우저 안이며, 동기화를 켜면 **관리형 Supabase**(테이블 1개 + RPC 2개)만 사용합니다 — 직접 서버를 띄우지 않습니다. (위 "동기화" 항목 참고)
- **라우터는 hash 모드입니다.** GitHub Pages 의 단일 `index.html` 만 있는 환경에서 새로고침 시 404 가 안 나도록 의도된 선택. `createWebHistory()` 로 바꾸지 마세요 (push 후 새로고침 깨짐).
- **vite base 는 `VITE_BASE` 환경변수로 주입됩니다.** 워크플로우가 `/${repo}/` 자동 설정. 다른 호스팅 (Cloudflare Pages 루트 도메인 등) 에선 `VITE_BASE=/` 로 빌드.
- **운동 GIF** 는 GitHub raw 외부 URL — 첫 방문 시 네트워크 필요. PWA Workbox 가 60일간 캐시.
- **PWA service worker** 가 있어서 새 빌드 배포 후 첫 방문은 옛 버전이 보일 수 있음. 한 번 더 새로고침하면 갱신.

---

## 분류

`01.DEV` (웹 단독). 향후 Capacitor 등으로 네이티브 래핑하면 `02.TOOL` 로 이동.
