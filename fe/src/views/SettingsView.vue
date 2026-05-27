<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProfileStore } from '@/stores/profile'
import { useLogStore } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import { useJsonl, type ImportResult } from '@/composables/useJsonl'

const profile = useProfileStore()
const log = useLogStore()
const catalog = useCatalogStore()
const { activeProfile, knownProfiles } = storeToRefs(profile)
const { workouts, meals, body } = storeToRefs(log)
const { customFoods } = storeToRefs(catalog)

const jsonl = useJsonl()
const fileInput = ref<HTMLInputElement | null>(null)
const importMode = ref<'merge' | 'replace'>('merge')
const importResult = ref<ImportResult | null>(null)
const importError = ref('')

const stats = computed(() => ({
  workouts: workouts.value.length,
  meals: meals.value.length,
  body: body.value.length,
  customFoods: customFoods.value.length,
}))

const newProfileName = ref('')
const newProfileError = ref('')

function switchProfile(name: string) {
  if (name === activeProfile.value) return
  profile.setProfile(name)
}

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

function logout() {
  profile.clearProfile()
}
function lockApp() {
  profile.clearProfile()
  profile.lock()
}

function confirmRemoveProfile(name: string) {
  if (!confirm(`'${name}' 프로필의 모든 데이터를 삭제합니다. 되돌릴 수 없습니다. 진행할까요?`)) return
  profile.removeProfile(name)
}

function confirmClearAll() {
  if (!confirm(`현재 프로필(${activeProfile.value})의 모든 기록을 삭제합니다. 되돌릴 수 없습니다. 진행할까요?`)) return
  log.workouts = []
  log.meals = []
  log.body = []
  catalog.customFoods = []
}

function triggerImport() {
  fileInput.value?.click()
}
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
  <div class="settings">
    <!-- 현재 프로필 요약 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">현재 프로필</h2>
      </div>
      <div class="profile-row">
        <div class="profile-name">{{ activeProfile }}</div>
        <div class="profile-stats">
          <span class="muted small">운동 <span class="num">{{ stats.workouts }}</span></span>
          <span class="muted small">식단 <span class="num">{{ stats.meals }}</span></span>
          <span class="muted small">신체 <span class="num">{{ stats.body }}</span></span>
          <span class="muted small">내 음식 <span class="num">{{ stats.customFoods }}</span></span>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" @click="logout">프로필 전환</button>
        <button class="btn btn-ghost" @click="lockApp">잠금</button>
      </div>
    </section>

    <!-- 프로필 관리 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">프로필 관리</h2>
        <span class="muted small">{{ knownProfiles.length }}개</span>
      </div>
      <ul class="profile-list">
        <li v-for="n in knownProfiles" :key="n" class="profile-item" :class="{ active: n === activeProfile }">
          <span class="profile-pname">{{ n }}</span>
          <span v-if="n === activeProfile" class="tag tag-soft">사용 중</span>
          <span class="grow"></span>
          <button v-if="n !== activeProfile" class="btn-mini" @click="switchProfile(n)">전환</button>
          <button class="btn-mini btn-mini-warn" @click="confirmRemoveProfile(n)">삭제</button>
        </li>
      </ul>
      <div class="new-profile">
        <input
          class="input"
          type="text"
          v-model="newProfileName"
          placeholder="새 프로필 이름"
          maxlength="24"
          @keyup.enter="startNewProfile"
        />
        <button class="btn btn-primary" @click="startNewProfile">새 프로필 시작</button>
      </div>
      <div v-if="newProfileError" class="err">{{ newProfileError }}</div>
    </section>

    <!-- 백업·복원 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">백업 · 복원 (JSONL)</h2>
      </div>
      <p class="hint">
        브라우저를 비우거나 다른 기기로 옮길 때는 <b>내보내기</b>로 `.jsonl` 파일을 받아두세요.
        다른 기기에서 같은 사이트를 열고 <b>가져오기</b>하면 그대로 복원됩니다.
      </p>
      <div class="actions">
        <button class="btn btn-primary" @click="jsonl.downloadJsonl()">내보내기 (.jsonl)</button>

        <label class="mode-toggle">
          <input type="radio" v-model="importMode" value="merge" />
          <span>병합 (중복 ID는 건너뛰기)</span>
        </label>
        <label class="mode-toggle">
          <input type="radio" v-model="importMode" value="replace" />
          <span>덮어쓰기 (현재 프로필 비운 뒤 적용)</span>
        </label>
        <button class="btn btn-ghost" @click="triggerImport">파일 선택…</button>
        <input ref="fileInput" type="file" accept=".jsonl,.ndjson,application/x-ndjson,application/json" hidden @change="onFile" />
      </div>

      <div v-if="importResult" class="import-result">
        <div v-if="importResult.fromProfile" class="muted small">
          파일 출처 프로필: <b>{{ importResult.fromProfile }}</b>
          {{ importResult.fromProfile !== activeProfile ? ` (현재: ${activeProfile})` : '' }}
        </div>
        <div>
          추가 — 운동 <span class="num accent">{{ importResult.added.workouts }}</span>,
          식단 <span class="num accent">{{ importResult.added.meals }}</span>,
          신체 <span class="num accent">{{ importResult.added.body }}</span>,
          내 음식 <span class="num accent">{{ importResult.added.customFoods }}</span>
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
          <div>
            <div class="food-name">{{ f.name }}</div>
            <div class="muted small num">{{ f.kcal }} kcal · P{{ f.protein }} · C{{ f.carbs }} · F{{ f.fat }} · {{ f.category }}</div>
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
      <button class="btn btn-danger" @click="confirmClearAll">현재 프로필 데이터 전부 삭제</button>
    </section>

    <footer class="foot muted small">
      비밀번호: 알려받은 값 · 잠그면 다음 방문 시 재입력 필요.
    </footer>
  </div>
</template>

<style scoped>
.settings { display: grid; gap: 14px; max-width: 760px; }
.card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-xs); }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.card-title { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }
.accent { color: var(--c-accent); }
.grow { flex: 1; }
.hint { font-size: var(--fs-sm); color: var(--c-text-soft); line-height: 1.5; margin-bottom: 10px; }
.err { font-size: var(--fs-sm); color: var(--c-danger); margin-top: 6px; }

.profile-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.profile-name { font-size: var(--fs-2xl); font-weight: 600; }
.profile-stats { display: flex; gap: 10px; flex-wrap: wrap; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.profile-list { display: grid; gap: 4px; margin-bottom: 12px; }
.profile-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--c-border); border-radius: var(--radius-md); background: var(--c-surface); }
.profile-item.active { background: var(--c-accent-soft); border-color: var(--c-accent); }
.profile-pname { font-size: var(--fs-md); color: var(--c-text); font-weight: 500; }
.new-profile { display: grid; grid-template-columns: 1fr auto; gap: 6px; }

.input { height: 36px; padding: 0 10px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); font-size: var(--fs-md); transition: border 0.15s, box-shadow 0.15s; }
.input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); outline: none; }

.tag { display: inline-block; padding: 1px 6px; font-size: var(--fs-xs); border: 1px solid var(--c-border-strong); border-radius: var(--radius-xs); color: var(--c-text-soft); }
.tag-soft { background: var(--c-accent-soft); border-color: var(--c-accent-soft); color: var(--c-accent-ink); }

.btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 14px; font-size: var(--fs-sm); font-weight: 500; border-radius: var(--radius-md); transition: background 0.15s, color 0.15s, border 0.15s; }
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover { background: var(--c-accent-ink); }
.btn-ghost { background: transparent; color: var(--c-text-soft); border: 1px solid var(--c-border-strong); }
.btn-ghost:hover { background: var(--c-surface-2); color: var(--c-text); }
.btn-danger { background: var(--c-danger); color: #fff; }
.btn-danger:hover { background: #8c1414; }
.btn-mini { height: 26px; padding: 0 10px; font-size: var(--fs-xs); background: var(--c-surface); color: var(--c-accent-ink); border: 1px solid var(--c-accent-soft); border-radius: var(--radius-sm); transition: background 0.15s; }
.btn-mini:hover { background: var(--c-accent-soft); }
.btn-mini-warn { color: var(--c-danger); border-color: #f3c5c5; }
.btn-mini-warn:hover { background: #fdecec; }

.mode-toggle { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-sm); color: var(--c-text-soft); }
.mode-toggle input[type='radio'] {
  width: 14px; height: 14px;
  border: 1.5px solid var(--c-border-strong); border-radius: 50%;
  appearance: none; -webkit-appearance: none;
  background: var(--c-surface); cursor: pointer;
  display: grid; place-items: center;
}
.mode-toggle input[type='radio']:checked {
  border-color: var(--c-accent);
  background: radial-gradient(circle, var(--c-accent) 0 4px, var(--c-surface) 5px 100%);
}

.import-result {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--c-accent-soft);
  border: 1px solid var(--c-accent);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  display: grid; gap: 4px;
}

.food-list { display: grid; gap: 2px; max-height: 320px; overflow-y: auto; }
.food-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: var(--radius-sm); }
.food-row:hover { background: var(--c-surface-2); }
.food-name { font-size: var(--fs-md); color: var(--c-text); }
.icon-btn { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--c-text-muted); border-radius: 50%; transition: background 0.15s; }
.icon-btn:hover { background: var(--c-border); color: var(--c-text); }

.danger { border-color: #f3c5c5; background: #fdf6f6; }
.danger-title { color: var(--c-danger); }

.foot { text-align: center; padding: 8px; }
</style>
