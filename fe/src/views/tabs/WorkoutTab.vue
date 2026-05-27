<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, type SetLog } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import { type ExerciseItem, type Routine } from '@/data/exercises'
import { kcalByDuration, kcalByDistance, kcalByReps } from '@/composables/useCalorie'

const log = useLogStore()
const catalog = useCatalogStore()
const { weightKg, selectedDate, workoutsOfDate } = storeToRefs(log)
const { exercises } = storeToRefs(catalog)

const ROUTINE_ORDER: Routine[] = ['등&삼두', '하체&이두', '가슴&복근', '어깨&삼두']
const EXTRA_CATEGORY_ORDER = ['가슴', '등', '하체', '어깨', '팔', '복근', '맨몸']

const exerciseQuery = ref('')
const filteredExercises = computed(() => {
  const q = exerciseQuery.value.trim()
  if (!q) return exercises.value
  return exercises.value.filter(e =>
    e.name.includes(q) ||
    (e.search_en ?? '').toLowerCase().includes(q.toLowerCase()) ||
    e.category.includes(q) ||
    e.equipment.includes(q) ||
    (e.routine ?? '').includes(q),
  )
})
function routineExercises(r: Routine): ExerciseItem[] {
  return filteredExercises.value
    .filter(e => e.routine === r)
    .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
}
const cardioExercises = computed(() =>
  filteredExercises.value.filter(e => !e.routine && e.category === '유산소'),
)
const extraExerciseGroups = computed(() => {
  const m = new Map<string, ExerciseItem[]>()
  for (const e of filteredExercises.value) {
    if (e.routine) continue
    if (e.category === '유산소') continue
    const list = m.get(e.category) ?? []
    list.push(e)
    m.set(e.category, list)
  }
  return EXTRA_CATEGORY_ORDER
    .filter(c => m.has(c))
    .map(c => [c, m.get(c)!] as [string, ExerciseItem[]])
})
const extraExerciseCount = computed(() =>
  filteredExercises.value.filter(e => !e.routine && e.category !== '유산소').length,
)

const selectedExercise = ref<ExerciseItem | null>(null)
const setLogs = ref<SetLog[]>([])
const exMinutes = ref(20)
const exKm = ref(3)

function pickExercise(e: ExerciseItem) {
  selectedExercise.value = e
  const last = log.lastWorkoutOf(e.id)
  if (e.unit === 'reps') {
    if (last?.setLogs?.length) {
      setLogs.value = last.setLogs.map(s => ({ reps: s.reps, weight: s.weight }))
    } else if (last) {
      const n = last.sets ?? 4
      setLogs.value = Array.from({ length: n }, () => ({ reps: last.reps ?? 10, weight: last.weight }))
    } else {
      // 이전 기록 없음 — 최소 5kg부터 시작 (0kg = 운동 안 한 것)
      setLogs.value = Array.from({ length: 4 }, (_, i) => ({ reps: 12, weight: 5 + i * 5 }))
    }
  } else if (e.unit === 'time') {
    exMinutes.value = last?.minutes ?? 20
  } else {
    exKm.value = last?.km ?? 3
  }
}
function addSet() {
  const tail = setLogs.value[setLogs.value.length - 1]
  // 마지막 세트 무게 +5kg. 무게가 비어있던 운동이면 최소 5부터 시작.
  const nextWeight = tail?.weight != null ? tail.weight + 5 : 5
  setLogs.value.push({ reps: tail?.reps ?? 12, weight: nextWeight })
}
function removeSet(idx: number) { setLogs.value.splice(idx, 1) }
function copyDown(idx: number) {
  const src = setLogs.value[idx]
  for (let i = idx + 1; i < setLogs.value.length; i++) {
    setLogs.value[i] = { reps: src.reps, weight: src.weight }
  }
}

const lastSameWorkout = computed(() =>
  selectedExercise.value ? log.lastWorkoutOf(selectedExercise.value.id) : null,
)
const previewKcal = computed(() => {
  const e = selectedExercise.value
  if (!e) return 0
  if (e.unit === 'reps') {
    let total = 0
    for (const s of setLogs.value) total += kcalByReps(e, weightKg.value, 1, s.reps)
    return total
  }
  if (e.unit === 'time') return kcalByDuration(e.met, weightKg.value, exMinutes.value)
  return kcalByDistance(e.met, weightKg.value, exKm.value)
})
const previewVolume = computed(() => {
  if (selectedExercise.value?.unit !== 'reps') return 0
  return setLogs.value.reduce((s, x) => s + x.reps * (x.weight || 0), 0)
})
function addWorkout() {
  const e = selectedExercise.value
  if (!e) return
  const w: Record<string, unknown> = {
    date: selectedDate.value,
    exerciseId: e.id,
    exerciseName: e.name,
    unit: e.unit,
  }
  if (e.unit === 'reps') {
    const valid = setLogs.value.filter(s => s.reps > 0)
    if (valid.length === 0) return
    w.setLogs = valid.map(s => ({ reps: s.reps, weight: s.weight || undefined }))
    w.sets = valid.length
    w.reps = Math.round(valid.reduce((a, b) => a + b.reps, 0) / valid.length)
    const weights = valid.map(s => s.weight || 0)
    w.weight = Math.max(...weights) || undefined
  } else if (e.unit === 'time') {
    w.minutes = exMinutes.value
  } else {
    w.km = exKm.value
  }
  w.kcal = previewKcal.value
  log.upsertWorkout(w as Parameters<typeof log.upsertWorkout>[0])
}

function lastSummary(exId: string): string | null {
  const l = log.lastWorkoutOf(exId)
  if (!l) return null
  if (l.unit === 'reps') {
    if (l.setLogs?.length) {
      const wt = l.setLogs.find(s => s.weight)?.weight
      return `${l.setLogs.length}×${l.setLogs.map(s => s.reps).join('/')}${wt ? ' @' + wt + 'kg' : ''}`
    }
    return `${l.sets ?? '?'}×${l.reps ?? '?'}${l.weight ? ' @' + l.weight + 'kg' : ''}`
  }
  if (l.unit === 'time') return `${l.minutes ?? 0}분`
  return `${l.km ?? 0}km`
}
</script>

<template>
  <section class="card workout-card">
    <div class="card-head">
      <h2 class="card-title">운동</h2>
      <div class="card-head-tools">
        <input
          class="input input-sm search-inline"
          type="text"
          v-model="exerciseQuery"
          placeholder="이름·부위·기구 검색…"
        />
      </div>
    </div>

    <div class="split">
      <!-- 좌: 4분할 + 유산소 -->
      <div class="split-left">
        <div v-for="r in ROUTINE_ORDER" :key="r" class="routine-block">
          <div class="routine-head">
            <span class="routine-name">{{ r }}</span>
            <span class="routine-count muted small">{{ routineExercises(r).length }}개</span>
          </div>
          <ul class="list">
            <li
              v-for="e in routineExercises(r)"
              :key="e.id"
              class="row-item"
              :class="{ picked: selectedExercise?.id === e.id }"
              @click="pickExercise(e)"
            >
              <img v-if="e.image_url" :src="e.image_url" :alt="e.name" class="row-thumb" loading="lazy" />
              <div class="row-main">
                <div class="row-lead">
                  <span class="row-index num">{{ e.order_no }}</span>
                  <span class="row-name">
                    {{ e.name }}<span v-if="e.search_en" class="row-en"> ({{ e.search_en }})</span>
                  </span>
                </div>
                <div class="row-sub">
                  <span class="tag">{{ e.equipment }}</span>
                  <span class="muted">{{ e.body_part }}</span>
                  <span v-if="e.note" class="muted">· {{ e.note }}</span>
                </div>
              </div>
              <div class="row-aux-col">
                <span v-if="lastSummary(e.id)" class="last-pill num">전 {{ lastSummary(e.id) }}</span>
                <span class="row-aux num">MET {{ e.met }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="cardioExercises.length" class="routine-block">
          <div class="routine-head">
            <span class="routine-name">유산소</span>
          </div>
          <ul class="list">
            <li v-for="e in cardioExercises" :key="e.id" class="row-item" :class="{ picked: selectedExercise?.id === e.id }" @click="pickExercise(e)">
              <img v-if="e.image_url" :src="e.image_url" :alt="e.name" class="row-thumb" loading="lazy" />
              <div class="row-main">
                <div class="row-name">{{ e.name }}<span v-if="e.search_en" class="row-en"> ({{ e.search_en }})</span></div>
                <div class="row-sub muted">{{ e.equipment }}</div>
              </div>
              <span class="row-aux num">MET {{ e.met }}</span>
            </li>
          </ul>
        </div>

        <details v-if="extraExerciseCount > 0" class="extras">
          <summary>
            <span class="extras-title">+ 기타 운동 (헬스기구·맨몸)</span>
            <span class="extras-count muted small">{{ extraExerciseCount }}개</span>
          </summary>
          <div class="extras-body">
            <details v-for="[cat, list] in extraExerciseGroups" :key="cat" class="extras-cat">
              <summary>
                <span class="extras-cat-name">{{ cat }}</span>
                <span class="muted small">{{ list.length }}개</span>
              </summary>
              <ul class="list">
                <li v-for="e in list" :key="e.id" class="row-item" :class="{ picked: selectedExercise?.id === e.id }" @click="pickExercise(e)">
                  <img v-if="e.image_url" :src="e.image_url" :alt="e.name" class="row-thumb" loading="lazy" />
                  <div class="row-main">
                    <div class="row-name">{{ e.name }}<span v-if="e.search_en" class="row-en"> ({{ e.search_en }})</span></div>
                    <div class="row-sub">
                      <span class="tag">{{ e.equipment }}</span>
                      <span class="muted">{{ e.body_part }}</span>
                    </div>
                  </div>
                  <div class="row-aux-col">
                    <span v-if="lastSummary(e.id)" class="last-pill num">전 {{ lastSummary(e.id) }}</span>
                    <span class="row-aux num">MET {{ e.met }}</span>
                  </div>
                </li>
              </ul>
            </details>
          </div>
        </details>
      </div>

      <!-- 우: picker(선택 시) + 오늘 운동 기록 (항상 보임, sticky) -->
      <div class="split-right">
        <div v-if="selectedExercise" class="picker">
          <div class="picker-head">
            <div class="picker-title">
              <div class="picker-name">{{ selectedExercise.name }}</div>
              <span v-if="selectedExercise.search_en" class="picker-en">{{ selectedExercise.search_en }}</span>
            </div>
            <button class="icon-btn" @click="selectedExercise = null" aria-label="닫기">×</button>
          </div>

          <div v-if="lastSameWorkout" class="last-hint">
            <span class="last-hint-k">최근</span>
            <span class="last-hint-v num">{{ lastSummary(selectedExercise.id) }}</span>
            <span class="last-hint-meta muted small">{{ lastSameWorkout.date }} · {{ lastSameWorkout.kcal }} kcal</span>
          </div>

          <div v-if="selectedExercise.unit === 'reps'" class="sets">
            <div class="sets-head">
              <span class="sets-title">세트</span>
              <button class="btn-mini" @click="addSet">+ 세트</button>
            </div>
            <div v-for="(s, i) in setLogs" :key="i" class="set-row">
              <span class="set-no">{{ i + 1 }}</span>
              <div class="set-input-group">
                <input class="set-field num" type="number" v-model.number="s.reps" min="0" max="100" aria-label="횟수" />
                <span class="set-x">×</span>
                <input class="set-field num" type="number" v-model.number="s.weight" min="0" max="500" step="5" placeholder="0" aria-label="무게(kg)" />
                <span class="set-unit">kg</span>
              </div>
              <div class="set-steppers">
                <button class="step-btn" @click="s.weight = Math.max(0, (s.weight || 0) - 5)" title="−5kg">−</button>
                <button class="step-btn" @click="s.weight = (s.weight || 0) + 5" title="+5kg">＋</button>
              </div>
              <div class="set-actions">
                <button class="icon-btn" @click="copyDown(i)" title="아래 세트에 같은 값 복사">⇣</button>
                <button class="icon-btn" @click="removeSet(i)" :disabled="setLogs.length <= 1" aria-label="삭제">×</button>
              </div>
            </div>
          </div>
          <div v-else-if="selectedExercise.unit === 'time'" class="single-field">
            <label class="field">
              <span class="field-label">시간 (분)</span>
              <input class="input num" type="number" v-model.number="exMinutes" min="1" max="300" />
            </label>
          </div>
          <div v-else class="single-field">
            <label class="field">
              <span class="field-label">거리 (km)</span>
              <input class="input num" type="number" v-model.number="exKm" min="0.1" max="50" step="0.1" />
            </label>
          </div>

          <div class="picker-foot">
            <div class="estimate">
              <span class="est-k">예상 소모</span>
              <span class="est-v num accent">{{ previewKcal }}<span class="est-u">kcal</span></span>
              <span v-if="selectedExercise.unit === 'reps' && previewVolume" class="est-vol muted small num">
                · 볼륨 {{ previewVolume.toLocaleString() }}
              </span>
            </div>
            <button class="btn btn-primary btn-add" @click="addWorkout">기록 추가</button>
          </div>
        </div>

        <!-- 우측 항상 표시되는 오늘 운동 기록 -->
        <div class="today-card">
          <div class="today-head">
            <div class="today-title">오늘 운동 기록</div>
            <span class="muted small">{{ workoutsOfDate.length }}건</span>
          </div>
          <ul v-if="workoutsOfDate.length" class="today-list">
            <li v-for="w in workoutsOfDate" :key="w.id" class="today-item">
              <div class="today-item-main">
                <div class="today-item-name">{{ w.exerciseName }}</div>
                <div class="today-item-sub muted num">
                  <template v-if="w.unit === 'reps'">
                    <template v-if="w.setLogs?.length">
                      {{ w.setLogs.length }}세트 ·
                      <span v-for="(s, i) in w.setLogs" :key="i">{{ i > 0 ? ' / ' : '' }}{{ s.reps }}{{ s.weight ? '×' + s.weight + 'kg' : '' }}</span>
                    </template>
                    <template v-else>
                      {{ w.sets }}×{{ w.reps }}<span v-if="w.weight"> @{{ w.weight }}kg</span>
                    </template>
                  </template>
                  <template v-else-if="w.unit === 'time'">{{ w.minutes }}분</template>
                  <template v-else>{{ w.km }} km</template>
                </div>
              </div>
              <div class="today-item-actions">
                <span class="num accent">−{{ w.kcal }}</span>
                <button class="icon-btn" @click="log.removeWorkout(w.id)" aria-label="삭제">×</button>
              </div>
            </li>
          </ul>
          <div v-else class="today-empty muted small">
            아직 오늘 추가된 운동이 없습니다.
          </div>
        </div>
      </div>
    </div>
  </section>

</template>

<style scoped>
.card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-xs);
  margin-bottom: 14px;
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.card-title { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); letter-spacing: 0.01em; }
.card-head-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.search-inline { min-width: 200px; }

.input { width: 100%; height: 32px; padding: 0 10px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); font-size: var(--fs-md); color: var(--c-text); transition: border 0.15s, box-shadow 0.15s; }
.input::placeholder { color: var(--c-text-muted); }
.input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }
.input-sm { height: 28px; width: auto; min-width: 70px; }
.field { display: flex; flex-direction: column; gap: 3px; }
.field-inline { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); color: var(--c-text-soft); }
.field-label { font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.02em; }
.field-suffix { font-size: var(--fs-xs); color: var(--c-text-muted); }

.list { display: flex; flex-direction: column; gap: 1px; }
.row-item { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: var(--radius-md); cursor: pointer; transition: background 0.12s; }
.row-item:hover { background: var(--c-surface-2); }
.row-item.picked { background: var(--c-accent-soft); }
.row-thumb { width: 48px; height: 48px; border-radius: var(--radius-sm); border: 1px solid var(--c-border); background: var(--c-surface-2); object-fit: cover; flex-shrink: 0; }
.row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.row-lead { display: flex; align-items: baseline; gap: 8px; }
.row-index { font-size: var(--fs-xs); color: var(--c-text-muted); width: 14px; text-align: right; }
.row-name { font-size: var(--fs-md); color: var(--c-text); }
.row-en { font-size: var(--fs-xs); color: var(--c-text-muted); font-weight: 400; margin-left: 4px; }
.row-sub { display: flex; flex-wrap: wrap; gap: 6px; font-size: var(--fs-xs); color: var(--c-text-muted); }
.row-aux { font-size: var(--fs-xs); color: var(--c-text-muted); white-space: nowrap; }
.row-aux-col { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; white-space: nowrap; }
.last-pill { font-size: var(--fs-xs); padding: 1px 7px; border-radius: 999px; background: var(--c-accent-soft); color: var(--c-accent-ink); }
.row-actions { display: flex; align-items: center; gap: 6px; }
.empty { padding: 12px 10px; font-size: var(--fs-sm); color: var(--c-text-muted); text-align: center; }
.tag { display: inline-block; padding: 1px 6px; font-size: var(--fs-xs); border: 1px solid var(--c-border-strong); border-radius: var(--radius-xs); color: var(--c-text-soft); }
.tag-soft { background: var(--c-accent-soft); border-color: var(--c-accent-soft); color: var(--c-accent-ink); }
.accent { color: var(--c-accent); }
.warn { color: var(--c-warn); }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }

.split { display: grid; gap: 14px; }
@media (min-width: 920px) {
  .split { grid-template-columns: minmax(0, 1fr) 380px; }
  .split-right {
    position: sticky;
    top: 64px;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: calc(100vh - 84px);
    overflow-y: auto;
    padding-right: 2px; /* 스크롤바 잘림 방지 */
  }
}
.split-left { min-width: 0; }
.split-right { min-width: 0; }

.routine-block { margin-bottom: 16px; }
.routine-head { display: flex; align-items: baseline; gap: 8px; padding: 4px 4px 6px; border-bottom: 1px solid var(--c-border); margin-bottom: 6px; }
.routine-name { font-size: var(--fs-md); font-weight: 600; color: var(--c-accent-ink); letter-spacing: -0.01em; }

.placeholder { padding: 28px 16px; text-align: center; background: var(--c-surface-2); border: 1px dashed var(--c-border-strong); border-radius: var(--radius-md); }
.ph-title { font-size: var(--fs-md); color: var(--c-text-soft); margin-bottom: 4px; }
.ph-sub { font-size: var(--fs-sm); color: var(--c-text-muted); }

/* ─── 우측 오늘 운동 기록 (항상 표시) ─── */
.today-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-xs);
  display: grid;
  gap: 8px;
  flex-shrink: 0;
}
.today-empty {
  padding: 16px 4px;
  text-align: center;
  font-style: italic;
}
.today-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--c-border);
}
.today-title {
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-accent-ink);
  letter-spacing: -0.005em;
}
.today-list { display: flex; flex-direction: column; gap: 1px; }
.today-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px dashed var(--c-border);
}
.today-item:last-child { border-bottom: none; }
.today-item-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.today-item-name { font-size: var(--fs-sm); font-weight: 500; color: var(--c-text); }
.today-item-sub { font-size: 11px; line-height: 1.35; }
.today-item-actions { display: flex; align-items: center; gap: 4px; white-space: nowrap; }

/* ─── picker (운동 입력 폼) ─── */
.picker {
  padding: 14px 16px 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  display: grid;
  gap: 12px;
}
.picker-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--c-border);
}
.picker-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.picker-name {
  font-size: var(--fs-xl);
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--c-text);
  line-height: 1.2;
}
.picker-en {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  font-family: var(--font-num);
  letter-spacing: 0;
}

.last-hint {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 10px;
  background: var(--c-accent-soft);
  border-radius: var(--radius-sm);
}
.last-hint-k {
  font-size: var(--fs-xs);
  color: var(--c-accent-ink);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}
.last-hint-v {
  font-size: var(--fs-sm);
  color: var(--c-accent-ink);
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.last-hint-meta { font-size: 11px; flex-shrink: 0; }

.single-field { display: grid; gap: 6px; }

/* 세트 입력 */
.sets { display: grid; gap: 6px; }
.sets-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2px;
}
.sets-title {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
}
.set-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}
.set-no {
  width: 22px; height: 22px;
  display: inline-grid; place-items: center;
  background: var(--c-chip);
  color: var(--c-text-soft);
  border-radius: 50%;
  font-size: var(--fs-xs);
  font-weight: 600;
  font-family: var(--font-num);
}
.set-input-group {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.1fr) auto;
  align-items: center;
  gap: 4px;
}
.set-field {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  font-size: var(--fs-md);
  font-weight: 500;
  text-align: right;
  font-family: var(--font-num);
}
.set-field:focus {
  outline: none;
  border-color: var(--c-accent);
  box-shadow: 0 0 0 2px var(--c-accent-soft);
}
.set-x {
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
  font-weight: 500;
}
.set-unit {
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
  font-weight: 500;
}
.set-steppers { display: inline-flex; gap: 2px; }
.step-btn {
  width: 26px; height: 26px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-sm);
  color: var(--c-text-soft);
  font-size: 14px;
  font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.step-btn:hover {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  border-color: var(--c-accent);
}
.set-actions { display: inline-flex; gap: 2px; }

/* picker 하단 — 예상 + 기록 추가 */
.picker-foot {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--c-border);
}
.estimate {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.est-k {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
}
.est-v {
  font-size: var(--fs-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}
.est-u {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  margin-left: 3px;
  font-weight: 500;
}
.est-vol { letter-spacing: -0.005em; }
.btn-add {
  height: 38px;
  padding: 0 18px;
  font-size: var(--fs-md);
  font-weight: 600;
  border-radius: var(--radius-md);
}

.extras { margin-top: 12px; }
.extras > summary { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--c-surface-2); border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); cursor: pointer; list-style: none; font-weight: 500; transition: background 0.15s; }
.extras > summary::-webkit-details-marker { display: none; }
.extras > summary:hover { background: var(--c-chip); }
.extras-title::before { content: '▸ '; color: var(--c-text-muted); }
.extras[open] > summary .extras-title::before { content: '▾ '; }
.extras-count { background: var(--c-chip); padding: 1px 7px; border-radius: 999px; }
.extras-body { padding: 6px 0 4px; }
.extras-cat { margin: 4px 0; }
.extras-cat > summary { display: flex; align-items: center; gap: 6px; padding: 5px 8px; font-size: var(--fs-sm); color: var(--c-text-soft); cursor: pointer; list-style: none; border-radius: var(--radius-sm); transition: background 0.12s; }
.extras-cat > summary::-webkit-details-marker { display: none; }
.extras-cat > summary:hover { background: var(--c-surface-2); }
.extras-cat-name { font-weight: 500; }
.extras-cat-name::before { content: '▸ '; color: var(--c-text-muted); }
.extras-cat[open] > summary .extras-cat-name::before { content: '▾ '; }

.btn { display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 0 12px; font-size: var(--fs-sm); font-weight: 500; border-radius: var(--radius-md); transition: background 0.15s, color 0.15s, border 0.15s; }
.btn-block { width: 100%; }
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover { background: var(--c-accent-ink); }
.btn-mini { height: 22px; padding: 0 8px; font-size: var(--fs-xs); background: var(--c-surface); color: var(--c-accent-ink); border: 1px solid var(--c-accent-soft); border-radius: 999px; transition: background 0.15s; }
.btn-mini:hover { background: var(--c-accent-soft); }
.icon-btn { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--c-text-muted); border-radius: 50%; transition: background 0.15s, color 0.15s; }
.icon-btn:hover { background: var(--c-border); color: var(--c-text); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* 우측 컬럼 폭 확대 (380 → 400) */
@media (min-width: 920px) {
  .split { grid-template-columns: minmax(0, 1fr) 400px !important; }
}

/* today-card 시각 강조 */
.today-card { gap: 6px; }
.today-title { font-size: var(--fs-lg); font-weight: 700; }
.today-item { padding: 8px 4px; }
.today-item-name { font-size: var(--fs-md); font-weight: 600; }
.today-item-sub { font-size: var(--fs-xs); }
</style>
