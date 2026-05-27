<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, type BodyEntry, type Sex } from '@/stores/log'

const log = useLogStore()
const {
  selectedDate, body, bodyOfDate, latestBody,
  sex: storedSex, birthYear: storedBirthYear, activityLevel: storedActivity,
} = storeToRefs(log)

interface Draft {
  weightKg: number | null
  bodyFatPct: number | null
  muscleKg: number | null
  note: string
}

const draft = ref<Draft>({ weightKg: null, bodyFatPct: null, muscleKg: null, note: '' })

// ── 프로필 정보 수정 (신장/성별/출생연도/활동량) ──
const thisYear = new Date().getFullYear()
const editingProfile = ref(false)
const profileDraft = ref({
  heightCm: latestBody.value?.heightCm ?? null as number | null,
  sex: (storedSex.value || '') as Sex | '',
  birthYear: storedBirthYear.value as number | null,
  activityLevel: storedActivity.value,
})
const profileErr = ref('')

const ACTIVITY_LEVELS: { value: number; label: string; desc: string }[] = [
  { value: 1.2,   label: '거의 안 함',   desc: '하루 종일 앉아 있음' },
  { value: 1.375, label: '가벼움',       desc: '주 1~3회 가벼운 활동' },
  { value: 1.55,  label: '보통',         desc: '주 3~5회 운동' },
  { value: 1.725, label: '활발',         desc: '주 6~7회 운동' },
  { value: 1.9,   label: '매우 활발',    desc: '하루 2번 운동/육체노동' },
]

function startEditProfile() {
  profileDraft.value = {
    heightCm: latestBody.value?.heightCm ?? null,
    sex: (storedSex.value || '') as Sex | '',
    birthYear: storedBirthYear.value,
    activityLevel: storedActivity.value,
  }
  profileErr.value = ''
  editingProfile.value = true
}
function cancelEditProfile() {
  editingProfile.value = false
  profileErr.value = ''
}
function saveProfile() {
  profileErr.value = ''
  const h = profileDraft.value.heightCm
  if (!h || h < 100 || h > 230) { profileErr.value = '신장을 100~230cm 범위로 입력해주세요.'; return }
  if (!profileDraft.value.sex) { profileErr.value = '성별을 선택해주세요.'; return }
  const by = profileDraft.value.birthYear
  if (!by || by < 1900 || by > thisYear) { profileErr.value = '출생연도를 정확히 입력해주세요.'; return }
  // 신장은 BodyEntry 안에 들어있어서 별도 처리 필요 — 최신 entry의 heightCm 갱신,
  // 또는 entry가 없으면 새로 추가
  const latest = latestBody.value
  if (latest && latest.heightCm !== h) {
    log.updateBody(latest.id, { heightCm: h })
  } else if (!latest) {
    // 신체 entry가 아예 없으면 임시 entry 생성
    log.addBody({ date: selectedDate.value, weightKg: 70, heightCm: h })
  }
  log.setProfileMeta({
    sex: profileDraft.value.sex as Sex,
    birthYear: by,
    activityLevel: profileDraft.value.activityLevel,
  })
  editingProfile.value = false
}

const currentAge = computed(() => storedBirthYear.value ? thisYear - storedBirthYear.value : null)
const activityLabel = computed(() => {
  const a = storedActivity.value
  return ACTIVITY_LEVELS.find(l => Math.abs(l.value - a) < 0.01)?.label ?? `×${a}`
})

// 날짜가 바뀌면 기존 기록을 폼에 채우거나 비움
watch(selectedDate, syncDraft, { immediate: true })
watch(body, syncDraft, { deep: true })

function syncDraft() {
  const existing = bodyOfDate.value[bodyOfDate.value.length - 1]
  if (existing) {
    draft.value = {
      weightKg: existing.weightKg,
      bodyFatPct: existing.bodyFatPct ?? null,
      muscleKg: existing.muscleKg ?? null,
      note: existing.note ?? '',
    }
  } else if (latestBody.value) {
    // 새 날짜면 가장 최근 값을 프리필 (덮어쓰기 전까지 기록되지 않음)
    draft.value = {
      weightKg: latestBody.value.weightKg,
      bodyFatPct: latestBody.value.bodyFatPct ?? null,
      muscleKg: latestBody.value.muscleKg ?? null,
      note: '',
    }
  } else {
    draft.value = { weightKg: null, bodyFatPct: null, muscleKg: null, note: '' }
  }
}

function save() {
  if (!draft.value.weightKg || draft.value.weightKg <= 0) return
  const existing = bodyOfDate.value[bodyOfDate.value.length - 1]
  const payload = {
    date: selectedDate.value,
    weightKg: draft.value.weightKg,
    bodyFatPct: draft.value.bodyFatPct ?? undefined,
    muscleKg: draft.value.muscleKg ?? undefined,
    note: draft.value.note.trim() || undefined,
  }
  if (existing) {
    log.updateBody(existing.id, payload)
  } else {
    log.addBody(payload)
  }
}

const sortedBody = computed<BodyEntry[]>(() =>
  [...body.value].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
)

function loadEntry(b: BodyEntry) {
  log.selectedDate = b.date
}

function deltaText(curr: number | undefined | null, prev: number | undefined | null, unit: string): string {
  if (curr == null || prev == null) return ''
  const d = +(curr - prev).toFixed(1)
  if (d === 0) return ''
  return ` (${d > 0 ? '+' : ''}${d}${unit})`
}
</script>

<template>
  <!-- 프로필 정보 (신장/성별/출생연도/활동량) -->
  <section class="card">
    <div class="card-head">
      <h2 class="card-title">프로필 정보</h2>
      <button v-if="!editingProfile" class="btn-mini" @click="startEditProfile">수정</button>
    </div>

    <div v-if="!editingProfile" class="profile-summary">
      <div class="ps-cell">
        <div class="ps-label">신장</div>
        <div class="ps-value num">
          <template v-if="latestBody?.heightCm">{{ latestBody.heightCm }} cm</template>
          <template v-else>—</template>
        </div>
      </div>
      <div class="ps-cell">
        <div class="ps-label">성별</div>
        <div class="ps-value">
          <template v-if="storedSex === 'male'">남성</template>
          <template v-else-if="storedSex === 'female'">여성</template>
          <template v-else>—</template>
        </div>
      </div>
      <div class="ps-cell">
        <div class="ps-label">나이</div>
        <div class="ps-value num">
          <template v-if="currentAge">{{ currentAge }}세</template>
          <template v-else>—</template>
        </div>
      </div>
      <div class="ps-cell">
        <div class="ps-label">활동량</div>
        <div class="ps-value">{{ activityLabel }} <span class="muted small num">×{{ storedActivity.toFixed(2) }}</span></div>
      </div>
    </div>

    <div v-else class="form-grid">
      <div class="form-row-2">
        <label class="field">
          <span class="field-label required">신장 (cm)</span>
          <input class="input num" type="number" v-model.number="profileDraft.heightCm" min="100" max="230" step="0.1" />
        </label>
        <label class="field">
          <span class="field-label required">출생연도</span>
          <input class="input num" type="number" v-model.number="profileDraft.birthYear" min="1900" :max="thisYear" />
        </label>
      </div>
      <div class="field">
        <span class="field-label required">성별</span>
        <div class="seg">
          <button
            type="button"
            class="seg-btn"
            :class="{ active: profileDraft.sex === 'male' }"
            @click="profileDraft.sex = 'male'"
          >남성</button>
          <button
            type="button"
            class="seg-btn"
            :class="{ active: profileDraft.sex === 'female' }"
            @click="profileDraft.sex = 'female'"
          >여성</button>
        </div>
      </div>
      <div class="field">
        <span class="field-label">활동량</span>
        <div class="activity-list">
          <label
            v-for="a in ACTIVITY_LEVELS"
            :key="a.value"
            class="activity-row"
            :class="{ active: Math.abs(profileDraft.activityLevel - a.value) < 0.01 }"
          >
            <input
              type="radio"
              :value="a.value"
              v-model.number="profileDraft.activityLevel"
            />
            <div class="activity-body">
              <span class="activity-name">{{ a.label }} <span class="muted small num">×{{ a.value.toFixed(2) }}</span></span>
              <span class="activity-desc muted small">{{ a.desc }}</span>
            </div>
          </label>
        </div>
      </div>
      <div v-if="profileErr" class="err">{{ profileErr }}</div>
      <div class="form-actions">
        <button class="btn btn-ghost" @click="cancelEditProfile">취소</button>
        <button class="btn btn-primary" @click="saveProfile">저장</button>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2 class="card-title">신체 입력 · {{ selectedDate }}</h2>
      <span v-if="bodyOfDate.length" class="muted small">이미 기록된 날짜 — 저장 시 덮어쓰기</span>
    </div>

    <div class="form-grid">
      <div class="form-row-2">
        <label class="field">
          <span class="field-label required">몸무게 (kg)</span>
          <input class="input num" type="number" v-model.number="draft.weightKg" min="20" max="250" step="0.1" placeholder="필수" />
        </label>
        <label class="field">
          <span class="field-label">체지방률 (%)</span>
          <input class="input num" type="number" v-model.number="draft.bodyFatPct" min="0" max="60" step="0.1" placeholder="선택" />
        </label>
      </div>
      <div class="form-row-2">
        <label class="field">
          <span class="field-label">골격근량 (kg)</span>
          <input class="input num" type="number" v-model.number="draft.muscleKg" min="0" max="100" step="0.1" placeholder="선택" />
        </label>
        <label class="field">
          <span class="field-label">메모</span>
          <input class="input" type="text" v-model="draft.note" placeholder="예: 아침 공복" maxlength="60" />
        </label>
      </div>
      <button class="btn btn-primary" :disabled="!draft.weightKg" @click="save">
        {{ bodyOfDate.length ? '오늘 기록 덮어쓰기' : '오늘 기록 저장' }}
      </button>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2 class="card-title">신체 기록 ({{ sortedBody.length }}건)</h2>
    </div>
    <ul class="list">
      <li v-for="(b, i) in sortedBody" :key="b.id" class="row-item">
        <div class="row-main" @click="loadEntry(b)">
          <div class="row-name">
            <span class="num">{{ b.date }}</span>
            <span class="muted small" v-if="b.note">· {{ b.note }}</span>
          </div>
          <div class="row-sub muted num">
            {{ b.weightKg }}kg{{ deltaText(b.weightKg, sortedBody[i + 1]?.weightKg, 'kg') }}
            <span v-if="b.bodyFatPct">· 체지방 {{ b.bodyFatPct }}%{{ deltaText(b.bodyFatPct, sortedBody[i + 1]?.bodyFatPct, '%') }}</span>
            <span v-if="b.muscleKg">· 근육 {{ b.muscleKg }}kg{{ deltaText(b.muscleKg, sortedBody[i + 1]?.muscleKg, 'kg') }}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="icon-btn" @click="log.removeBody(b.id)" aria-label="삭제">×</button>
        </div>
      </li>
      <li v-if="sortedBody.length === 0" class="empty">아직 기록이 없습니다. 위에서 입력해주세요.</li>
    </ul>
  </section>
</template>

<style scoped>
.card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-xs); margin-bottom: 14px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.card-title { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); letter-spacing: 0.01em; }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }

.form-grid { display: grid; gap: 8px; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field { display: flex; flex-direction: column; gap: 3px; }
.field-label { font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.02em; }
.field-label.required::after { content: ' *'; color: var(--c-warn); }
.input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); font-size: var(--fs-md); transition: border 0.15s, box-shadow 0.15s; }
.input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }

.btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; font-size: var(--fs-md); font-weight: 500; border-radius: var(--radius-md); transition: background 0.15s, opacity 0.15s; }
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover:not(:disabled) { background: var(--c-accent-ink); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.list { display: flex; flex-direction: column; gap: 1px; }
.row-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-md); transition: background 0.12s; }
.row-item:hover { background: var(--c-surface-2); }
.row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; cursor: pointer; }
.row-name { font-size: var(--fs-md); color: var(--c-text); }
.row-sub { display: flex; flex-wrap: wrap; gap: 6px; font-size: var(--fs-sm); color: var(--c-text-muted); }
.row-actions { display: flex; align-items: center; gap: 6px; }
.icon-btn { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--c-text-muted); border-radius: 50%; transition: background 0.15s; }
.icon-btn:hover { background: var(--c-border); color: var(--c-text); }
.empty { padding: 18px 10px; font-size: var(--fs-sm); color: var(--c-text-muted); text-align: center; }

/* ─── 프로필 정보 요약 / 편집 ─── */
.profile-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 640px) { .profile-summary { grid-template-columns: repeat(2, 1fr); } }
.ps-cell {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.ps-label {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 4px;
}
.ps-value {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.01em;
}

.btn-mini {
  height: 28px;
  padding: 0 12px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-accent-ink);
  background: var(--c-accent-soft);
  border-radius: 999px;
  transition: background 0.15s, color 0.15s;
}
.btn-mini:hover { background: var(--c-accent); color: #fff; }

.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 2px;
  height: 38px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
}
.seg-btn {
  display: inline-grid; place-items: center;
  height: 32px;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-text-soft);
  background: transparent;
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}
.seg-btn:hover { color: var(--c-text); }
.seg-btn.active { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }

.activity-list { display: grid; gap: 4px; }
.activity-row {
  display: grid;
  grid-template-columns: 18px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s, border 0.12s;
}
.activity-row:hover { background: var(--c-surface-2); }
.activity-row.active { background: var(--c-accent-soft); border-color: var(--c-accent); }
.activity-row input[type='radio'] {
  appearance: none; -webkit-appearance: none;
  width: 14px; height: 14px;
  border: 1.5px solid var(--c-border-strong);
  border-radius: 50%;
  display: grid; place-items: center;
}
.activity-row.active input[type='radio'] {
  border-color: var(--c-accent);
  background: radial-gradient(circle, var(--c-accent) 0 4px, var(--c-surface) 5px 100%);
}
.activity-body { display: flex; flex-direction: column; gap: 1px; }
.activity-name { font-size: var(--fs-sm); font-weight: 600; color: var(--c-text); }
.activity-desc { font-size: var(--fs-xs); }

.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.btn-ghost { background: transparent; color: var(--c-text-soft); border: 1px solid var(--c-border-strong); }
.btn-ghost:hover { background: var(--c-surface-2); color: var(--c-text); }
.err { font-size: var(--fs-xs); color: var(--c-danger); padding: 0 2px; }
</style>
