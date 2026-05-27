<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { useProfileStore } from '@/stores/profile'
import { useLogStore } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import { useJsonl, type ImportResult } from '@/composables/useJsonl'
import { colorForProfile } from '@/composables/useAllProfilesData'
import type { BodyEntry, Sex } from '@/stores/log'

const ALLOWED_PROFILE = '박종권'
const ADMIN_PW = '45121006'

const profile = useProfileStore()
const log = useLogStore()
const catalog = useCatalogStore()
const { activeProfile } = storeToRefs(profile)
const { workouts, meals, body } = storeToRefs(log)
const { customFoods } = storeToRefs(catalog)

const jsonl = useJsonl()
const fileInput = ref<HTMLInputElement | null>(null)
const importMode = ref<'merge' | 'replace'>('merge')
const importResult = ref<ImportResult | null>(null)
const importError = ref('')

// ── 관리자 가드 ─────────────────────────────────────────
const adminUnlocked = useLocalStorage<boolean>('wt.adminUnlocked', false)
const isOwner = computed(() => activeProfile.value === ALLOWED_PROFILE)
const accessGranted = computed(() => isOwner.value || adminUnlocked.value)

const adminPwInput = ref('')
const adminPwError = ref('')
function submitAdminPw() {
  adminPwError.value = ''
  if (adminPwInput.value === ADMIN_PW) {
    adminUnlocked.value = true
    adminPwInput.value = ''
  } else {
    adminPwError.value = '비밀번호가 맞지 않습니다.'
    adminPwInput.value = ''
  }
}
function lockAdmin() {
  adminUnlocked.value = false
}

// ── 통계 ────────────────────────────────────────────────
const stats = computed(() => ({
  workouts: workouts.value.length,
  meals: meals.value.length,
  body: body.value.length,
  customFoods: customFoods.value.length,
}))

// ── 전체 프로필 정보 (localStorage 직접 읽기) ──
interface ProfileInfo {
  name: string
  color: string
  sex: Sex | ''
  age: number | null
  height: number | null
  weight: number | null
  activity: number | null
  tdee: number | null
  records: number
}
function readKey<T>(prof: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`wt.p.${prof}.${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}
const allProfilesInfo = computed<ProfileInfo[]>(() => {
  const thisYear = new Date().getFullYear()
  return profile.knownProfiles.map(name => {
    let sx: Sex | '' = ''
    let by: number | null = null
    let act: number | null = null
    let bodyArr: BodyEntry[] = []
    let workoutCount = 0
    let mealCount = 0
    let bodyCount = 0
    if (name === activeProfile.value) {
      sx = (log.sex as Sex | '') || ''
      by = log.birthYear
      act = log.activityLevel
      bodyArr = body.value
      workoutCount = workouts.value.length
      mealCount = meals.value.length
      bodyCount = body.value.length
    } else {
      sx = readKey<Sex | ''>(name, 'sex', '')
      by = readKey<number | null>(name, 'birthYear', null)
      act = readKey<number | null>(name, 'activityLevel', null)
      bodyArr = readKey<BodyEntry[]>(name, 'body', [])
      workoutCount = readKey<unknown[]>(name, 'workouts', []).length
      mealCount = readKey<unknown[]>(name, 'meals', []).length
      bodyCount = bodyArr.length
    }
    const latest = bodyArr.length
      ? [...bodyArr].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0]
      : null
    const age = by ? thisYear - by : null
    const weight = latest?.weightKg ?? null
    const height = latest?.heightCm ?? null
    let tdee: number | null = null
    if (weight && height && age && sx && act) {
      const bmr = sx === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161
      tdee = Math.round((bmr * act) / 10) * 10
    } else if (weight) {
      tdee = Math.round((weight * 30) / 10) * 10
    }
    return {
      name,
      color: colorForProfile(name),
      sex: sx,
      age,
      height,
      weight,
      activity: act,
      tdee,
      records: workoutCount + mealCount + bodyCount,
    }
  })
})

// ── 새 프로필 ───────────────────────────────────────────
const newProfileName = ref('')
const newProfileError = ref('')
function startNewProfile() {
  newProfileError.value = ''
  const n = newProfileName.value.trim()
  if (!profile.isValidName(n)) {
    newProfileError.value = '이름에 사용할 수 없는 문자가 포함되어 있습니다.'
    return
  }
  profile.setProfile(n)
  newProfileName.value = ''
}

function logout() { profile.clearProfile() }
function lockApp() { profile.clearProfile(); profile.lock() }

function confirmClearAll() {
  if (!confirm(`현재 프로필(${activeProfile.value})의 모든 기록을 삭제합니다. 되돌릴 수 없습니다. 진행할까요?`)) return
  log.workouts = []
  log.meals = []
  log.body = []
  catalog.customFoods = []
}

function triggerImport() { fileInput.value?.click() }
async function onFile(e: Event) {
  importResult.value = null
  importError.value = ''
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (importMode.value === 'replace') {
    if (!confirm('현재 프로필의 모든 기록을 삭제하고 파일 내용으로 대체합니다. 진행할까요?')) {
      target.value = ''
      return
    }
  }
  try {
    importResult.value = await jsonl.importFromFile(file, importMode.value)
  } catch (err) {
    importError.value = (err as Error).message
  } finally {
    target.value = ''
  }
}

function removeCustomFood(id: string) {
  catalog.removeCustomFood(id)
}
</script>

<template>
  <!-- 관리자 가드 ──────────────────────────────────────── -->
  <div v-if="!accessGranted" class="locked">
    <div class="locked-card">
      <div class="locked-icon">🔒</div>
      <h1 class="locked-title">설정은 관리자만 접근할 수 있습니다</h1>
      <p class="locked-sub">
        <b>{{ ALLOWED_PROFILE }}</b> 프로필이 아니거나 처음 접근하는 경우,
        관리자 비밀번호를 입력해주세요.
      </p>
      <form class="locked-form" @submit.prevent="submitAdminPw">
        <input
          class="locked-input"
          type="password"
          v-model="adminPwInput"
          inputmode="numeric"
          autocomplete="off"
          autofocus
          placeholder="관리자 비밀번호"
        />
        <button class="locked-btn" type="submit">확인</button>
      </form>
      <div v-if="adminPwError" class="locked-err">{{ adminPwError }}</div>
      <div class="locked-foot muted small">
        현재 프로필: <b>{{ activeProfile || '(없음)' }}</b>
      </div>
    </div>
  </div>

  <!-- 본 설정 ────────────────────────────────────────────── -->
  <div v-else class="settings">
    <!-- 페이지 헤더 -->
    <header class="page-head">
      <div>
        <div class="page-eyebrow">SETTINGS</div>
        <h1 class="page-title">설정</h1>
        <p class="page-sub muted">프로필 · 데이터 백업 · 관리자 도구</p>
      </div>
      <div class="page-head-tools">
        <span v-if="isOwner" class="badge owner">관리자</span>
        <span v-else class="badge admin">관리자 해제됨</span>
        <button v-if="!isOwner" class="btn btn-ghost btn-sm" @click="lockAdmin">관리자 잠금</button>
      </div>
    </header>

    <!-- 현재 프로필 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">현재 프로필</h2>
      </div>
      <div class="profile-block">
        <div class="profile-id">
          <div class="profile-avatar">{{ activeProfile.charAt(0) || '?' }}</div>
          <div class="profile-meta">
            <div class="profile-name">{{ activeProfile }}</div>
            <div class="profile-tag muted small">활성 프로필</div>
          </div>
        </div>
        <div class="profile-counts">
          <div class="count">
            <div class="count-label">운동</div>
            <div class="count-value num">{{ stats.workouts }}</div>
          </div>
          <div class="count">
            <div class="count-label">식단</div>
            <div class="count-value num">{{ stats.meals }}</div>
          </div>
          <div class="count">
            <div class="count-label">신체</div>
            <div class="count-value num">{{ stats.body }}</div>
          </div>
          <div class="count">
            <div class="count-label">내 음식</div>
            <div class="count-value num">{{ stats.customFoods }}</div>
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" @click="logout">프로필 전환</button>
        <button class="btn btn-ghost" @click="lockApp">전체 잠금</button>
      </div>
    </section>

    <!-- 모든 프로필 정보 -->
    <section v-if="allProfilesInfo.length" class="card">
      <div class="card-head">
        <h2 class="card-title">전체 프로필 정보</h2>
        <span class="muted small">{{ allProfilesInfo.length }}명</span>
      </div>
      <p class="hint">이 기기에 등록된 프로필별 신체·계산 정보입니다. 비어있는 칸은 해당 프로필이 아직 입력하지 않은 항목입니다.</p>
      <div class="profile-table">
        <div class="pt-head">
          <span>프로필</span>
          <span>성별</span>
          <span>나이</span>
          <span>신장</span>
          <span>체중</span>
          <span>활동×</span>
          <span>권장 kcal</span>
          <span>기록 수</span>
        </div>
        <div
          v-for="p in allProfilesInfo"
          :key="p.name"
          class="pt-row"
          :class="{ 'pt-row-self': p.name === activeProfile }"
        >
          <span class="pt-name">
            <span class="pt-dot" :style="{ background: p.color }"></span>
            {{ p.name }}
            <span v-if="p.name === activeProfile" class="pt-tag">현재</span>
          </span>
          <span :class="{ missing: !p.sex }">{{ p.sex === 'male' ? '남' : p.sex === 'female' ? '여' : '—' }}</span>
          <span :class="{ missing: !p.age }">{{ p.age ? p.age + '세' : '—' }}</span>
          <span :class="{ missing: !p.height }">{{ p.height ? p.height + 'cm' : '—' }}</span>
          <span :class="{ missing: !p.weight }">{{ p.weight ? p.weight + 'kg' : '—' }}</span>
          <span :class="{ missing: !p.activity }">{{ p.activity ? '×' + p.activity.toFixed(2) : '—' }}</span>
          <span :class="{ missing: !p.tdee }" class="num">{{ p.tdee ? p.tdee.toLocaleString() : '—' }}</span>
          <span class="muted num">{{ p.records }}건</span>
        </div>
      </div>
    </section>

    <!-- 새 프로필 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">새 프로필 만들기</h2>
        <span class="muted small">현재 데이터는 보존됩니다</span>
      </div>
      <p class="hint">다른 이름으로 시작하면 빈 상태의 새 프로필이 만들어집니다. 가족·친구가 같은 기기를 써도 데이터가 섞이지 않습니다.</p>
      <form class="new-profile" @submit.prevent="startNewProfile">
        <input
          class="input"
          type="text"
          v-model="newProfileName"
          placeholder="새 프로필 이름"
          maxlength="24"
        />
        <button class="btn btn-primary" type="submit">새 프로필 시작</button>
      </form>
      <div v-if="newProfileError" class="err">{{ newProfileError }}</div>
    </section>

    <!-- 백업·복원 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">백업 · 복원</h2>
        <span class="muted small">JSONL 형식</span>
      </div>
      <p class="hint">
        브라우저 데이터를 비우거나 다른 기기로 옮길 때는 <b>내보내기</b>로 <code>.jsonl</code> 파일을 받아두세요.
        다른 기기에서도 같은 사이트를 열고 <b>가져오기</b>하면 그대로 복원됩니다.
      </p>

      <div class="block-row">
        <button class="btn btn-primary" @click="jsonl.downloadJsonl()">
          <span>내보내기</span>
          <span class="btn-suffix">.jsonl</span>
        </button>
      </div>

      <div class="import-block">
        <div class="block-label">가져오기 모드</div>
        <div class="radio-grid">
          <label class="radio-card" :class="{ active: importMode === 'merge' }">
            <input type="radio" v-model="importMode" value="merge" />
            <div class="radio-body">
              <div class="radio-title">병합</div>
              <div class="radio-desc">중복 ID는 건너뜁니다. 안전한 기본값.</div>
            </div>
          </label>
          <label class="radio-card warn" :class="{ active: importMode === 'replace' }">
            <input type="radio" v-model="importMode" value="replace" />
            <div class="radio-body">
              <div class="radio-title">덮어쓰기</div>
              <div class="radio-desc">현재 프로필을 비운 뒤 파일 내용으로 교체합니다.</div>
            </div>
          </label>
        </div>
        <div class="block-row">
          <button class="btn btn-ghost" @click="triggerImport">파일 선택…</button>
          <input
            ref="fileInput"
            type="file"
            accept=".jsonl,.ndjson,application/x-ndjson,application/json"
            hidden
            @change="onFile"
          />
        </div>
      </div>

      <div v-if="importResult" class="import-result">
        <div v-if="importResult.fromProfile" class="muted small">
          파일 출처 프로필: <b>{{ importResult.fromProfile }}</b>
          {{ importResult.fromProfile !== activeProfile ? ` (현재: ${activeProfile})` : '' }}
        </div>
        <div class="result-counts">
          <span>운동 <b class="num accent">+{{ importResult.added.workouts }}</b></span>
          <span>식단 <b class="num accent">+{{ importResult.added.meals }}</b></span>
          <span>신체 <b class="num accent">+{{ importResult.added.body }}</b></span>
          <span>내 음식 <b class="num accent">+{{ importResult.added.customFoods }}</b></span>
        </div>
        <div class="muted small">
          중복 건너뜀 {{ importResult.skipped }}건 · 무효 {{ importResult.invalid }}건
        </div>
      </div>
      <div v-if="importError" class="err">{{ importError }}</div>
    </section>

    <!-- 내가 등록한 음식 -->
    <section v-if="customFoods.length" class="card">
      <div class="card-head">
        <h2 class="card-title">내가 등록한 음식</h2>
        <span class="muted small">{{ customFoods.length }}개</span>
      </div>
      <ul class="food-list">
        <li v-for="f in customFoods" :key="f.id" class="food-row">
          <div class="food-main">
            <div class="food-name">{{ f.name }}</div>
            <div class="food-meta muted small num">
              {{ f.kcal }} kcal · P {{ f.protein }} · C {{ f.carbs }} · F {{ f.fat }} · {{ f.category }}
            </div>
          </div>
          <button class="icon-btn" @click="removeCustomFood(f.id)" aria-label="삭제">×</button>
        </li>
      </ul>
    </section>

    <!-- 위험 구역 -->
    <section class="card danger">
      <div class="card-head">
        <h2 class="card-title danger-title">위험 구역</h2>
      </div>
      <p class="hint">
        현재 프로필의 모든 운동·식단·신체 기록과 내가 등록한 음식이 영구히 삭제됩니다.
        실행 전 반드시 백업하세요.
      </p>
      <button class="btn btn-danger" @click="confirmClearAll">
        현재 프로필 데이터 전부 삭제
      </button>
    </section>

    <footer class="foot muted small">
      게이트 비밀번호: 별도 안내 · 잠그면 다음 방문 시 재입력 필요.
    </footer>
  </div>
</template>

<style scoped>
/* ─── 페이지 ─── */
.settings { display: grid; gap: 14px; max-width: 760px; padding-bottom: 24px; }

.page-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
  padding: 4px 2px 14px;
  border-bottom: 1px solid var(--c-border);
  margin-bottom: 4px;
}
.page-eyebrow {
  font-family: var(--font-num);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--c-text-muted);
  font-weight: 600;
  margin-bottom: 4px;
}
.page-title {
  font-size: var(--fs-3xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--c-text);
  line-height: 1.1;
}
.page-sub { font-size: var(--fs-sm); margin-top: 4px; }
.page-head-tools { display: inline-flex; align-items: center; gap: 8px; }
.badge {
  font-size: var(--fs-xs);
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}
.badge.owner { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.badge.admin { background: #fde9c8; color: #92400e; }

/* ─── 카드 ─── */
.card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  padding: 16px 18px 14px;
  box-shadow: var(--shadow-xs);
}
.card.danger { border-color: #f3c5c5; background: #fff8f7; }
.card-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 10px; margin-bottom: 10px;
  padding-bottom: 8px; border-bottom: 1px dashed var(--c-border);
}
.card-title { font-size: var(--fs-md); font-weight: 700; color: var(--c-text); letter-spacing: -0.005em; }
.danger-title { color: var(--c-danger); }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }
.accent { color: var(--c-accent); }
.err { font-size: var(--fs-sm); color: var(--c-danger); margin-top: 8px; }
.hint { font-size: var(--fs-sm); color: var(--c-text-soft); line-height: 1.6; margin-bottom: 12px; }

/* ─── 현재 프로필 블록 ─── */
.profile-block {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: center;
  padding: 4px 0 12px;
}
.profile-id { display: flex; align-items: center; gap: 12px; }
.profile-avatar {
  width: 48px; height: 48px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--c-accent-soft), var(--c-accent));
  color: #fff;
  font-size: var(--fs-xl); font-weight: 700;
  border-radius: 50%;
  box-shadow: var(--shadow-xs);
}
.profile-meta { display: flex; flex-direction: column; gap: 2px; }
.profile-name { font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.01em; }
.profile-tag { letter-spacing: 0.03em; text-transform: uppercase; }
.profile-counts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.count {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  text-align: left;
}
.count-label {
  font-size: 10px;
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.count-value { font-size: var(--fs-xl); font-weight: 700; line-height: 1.2; }
@media (max-width: 640px) {
  .profile-block { grid-template-columns: 1fr; }
  .profile-counts { grid-template-columns: repeat(4, 1fr); }
}

.actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 8px; border-top: 1px dashed var(--c-border); }

/* ─── 전체 프로필 정보 테이블 ─── */
.profile-table {
  display: grid;
  gap: 1px;
  background: var(--c-border);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-size: var(--fs-sm);
}
.pt-head, .pt-row {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) 44px 56px 64px 64px 56px 80px 60px;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--c-surface);
}
.pt-head {
  font-size: 10px;
  font-weight: 700;
  color: var(--c-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--c-surface-2);
}
.pt-row {
  font-family: var(--font-num);
  color: var(--c-text);
  transition: background 0.12s;
}
.pt-row:hover { background: var(--c-surface-2); }
.pt-row-self { background: var(--c-accent-soft); }
.pt-row-self:hover { background: #c8e6cf; }
.pt-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-weight: 600;
  min-width: 0;
}
.pt-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pt-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 2px 6px;
  background: var(--c-accent);
  color: #fff;
  border-radius: 999px;
  font-family: var(--font-sans);
}
.pt-row .missing {
  color: var(--c-text-muted);
  opacity: 0.55;
}
@media (max-width: 720px) {
  .profile-table {
    font-size: var(--fs-xs);
    overflow-x: auto;
  }
  .pt-head, .pt-row {
    grid-template-columns: minmax(140px, 1.6fr) 38px 48px 56px 56px 50px 70px 50px;
    min-width: 600px;
  }
}

/* ─── 새 프로필 ─── */
.new-profile { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.input {
  height: 38px; padding: 0 12px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  font-size: var(--fs-md);
  transition: border 0.15s, box-shadow 0.15s;
}
.input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); outline: none; }

/* ─── 백업·복원 ─── */
.block-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.block-label {
  font-size: var(--fs-xs); color: var(--c-text-muted);
  letter-spacing: 0.04em; text-transform: uppercase;
  margin-bottom: 6px;
}
.btn-suffix { margin-left: 6px; font-family: var(--font-num); font-size: var(--fs-xs); opacity: 0.85; }

.import-block {
  margin-top: 6px;
  padding: 12px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}
.radio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
@media (max-width: 540px) { .radio-grid { grid-template-columns: 1fr; } }
.radio-card {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border 0.15s, background 0.15s;
}
.radio-card:hover { border-color: var(--c-accent-soft); }
.radio-card.active {
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
}
.radio-card.warn.active {
  border-color: var(--c-warn);
  background: #fdeed7;
}
.radio-card input[type='radio'] {
  margin-top: 3px;
  width: 14px; height: 14px;
  border: 1.5px solid var(--c-border-strong); border-radius: 50%;
  appearance: none; -webkit-appearance: none;
  background: var(--c-surface);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.radio-card.active input[type='radio'] {
  border-color: var(--c-accent);
  background: radial-gradient(circle, var(--c-accent) 0 4px, var(--c-surface) 5px 100%);
}
.radio-card.warn.active input[type='radio'] {
  border-color: var(--c-warn);
  background: radial-gradient(circle, var(--c-warn) 0 4px, var(--c-surface) 5px 100%);
}
.radio-body { display: flex; flex-direction: column; gap: 2px; }
.radio-title { font-size: var(--fs-sm); font-weight: 600; }
.radio-desc { font-size: var(--fs-xs); color: var(--c-text-muted); line-height: 1.4; }

.import-result {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--c-accent-soft);
  border-radius: var(--radius-md);
  display: grid; gap: 6px;
}
.result-counts { display: flex; flex-wrap: wrap; gap: 12px; font-size: var(--fs-sm); }
.result-counts b { font-weight: 700; }

/* ─── 음식 리스트 ─── */
.food-list { display: grid; gap: 2px; }
.food-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 8px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.12s;
}
.food-row:hover { background: var(--c-surface-2); }
.food-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.food-name { font-size: var(--fs-md); font-weight: 500; }
.food-meta { letter-spacing: -0.005em; }

/* ─── 버튼 공통 ─── */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 38px; padding: 0 16px;
  font-size: var(--fs-sm); font-weight: 600;
  border-radius: var(--radius-md);
  transition: background 0.15s, color 0.15s, border 0.15s, transform 0.05s;
}
.btn:active { transform: translateY(1px); }
.btn-sm { height: 30px; padding: 0 12px; font-size: var(--fs-xs); }
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover { background: var(--c-accent-ink); }
.btn-ghost { background: var(--c-surface); color: var(--c-text-soft); border: 1px solid var(--c-border-strong); }
.btn-ghost:hover { background: var(--c-surface-2); color: var(--c-text); border-color: var(--c-text-muted); }
.btn-danger { background: var(--c-danger); color: #fff; box-shadow: var(--shadow-xs); }
.btn-danger:hover { background: #8c1414; }
.icon-btn {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 18px; color: var(--c-text-muted);
  border-radius: 50%;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: var(--c-border); color: var(--c-text); }

code {
  font-family: var(--font-num);
  font-size: 0.92em;
  background: var(--c-chip);
  padding: 1px 5px;
  border-radius: 4px;
}

.foot { padding: 8px 4px 0; text-align: center; }

/* ─── 잠금 화면 ─── */
.locked {
  min-height: 60vh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
}
.locked-card {
  width: 100%;
  max-width: 380px;
  padding: 32px 28px 24px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
  display: grid; gap: 10px;
}
.locked-icon { font-size: 36px; margin-bottom: 4px; }
.locked-title {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.005em;
  line-height: 1.4;
}
.locked-sub {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
  line-height: 1.55;
  margin-bottom: 6px;
}
.locked-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  margin-top: 4px;
}
.locked-input {
  height: 40px; padding: 0 12px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  font-size: var(--fs-md);
  text-align: left;
  font-family: var(--font-num);
}
.locked-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); outline: none; }
.locked-btn {
  height: 40px; padding: 0 18px;
  background: var(--c-accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: background 0.15s;
}
.locked-btn:hover { background: var(--c-accent-ink); }
.locked-err { font-size: var(--fs-xs); color: var(--c-danger); margin-top: 2px; }
.locked-foot { margin-top: 6px; }
</style>
