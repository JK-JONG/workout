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
      // 이전 기록 없음 — 무게는 비워두고 사용자가 채우게 함 (0kg 자동 입력 방지)
      setLogs.value = Array.from({ length: 4 }, () => ({ reps: 12, weight: undefined }))
    }
  } else if (e.unit === 'time') {
    exMinutes.value = last?.minutes ?? 20
  } else {
    exKm.value = last?.km ?? 3
  }
}
function addSet() {
  const tail = setLogs.value[setLogs.value.length - 1]
  // 마지막 세트에 무게가 있으면 +5kg, 없으면 그대로 비워둠
  const nextWeight = tail?.weight != null ? tail.weight + 5 : undefined
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
const lastVolume = computed(() => {
  const l = lastSameWorkout.value
  if (!l || l.unit !== 'reps') return 0
  if (l.setLogs?.length) return l.setLogs.reduce((s, x) => s + x.reps * (x.weight || 0), 0)
  return (l.sets ?? 0) * (l.reps ?? 0) * (l.weight ?? 0)
})
const deltaKcal = computed(() => previewKcal.value - (lastSameWorkout.value?.kcal ?? 0))
const deltaVolume = computed(() => previewVolume.value - lastVolume.value)

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
  log.addWorkout(w as Parameters<typeof log.addWorkout>[0])
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
function youtubeQuery(e: ExerciseItem): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(e.name + ' 자세 핏블리 김계란')}`
}
function fmtDelta(n: number, unit = ''): string {
  if (n === 0) return `±0${unit}`
  return `${n > 0 ? '+' : ''}${n}${unit}`
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

      <!-- 우: picker (또는 비어있을 때 오늘 운동 기록 sticky) -->
      <div class="split-right">
        <div v-if="!selectedExercise" class="today-card">
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
          <div v-else class="placeholder">
            <div class="ph-title">왼쪽에서 운동을 선택해 시작</div>
            <div class="ph-sub">기록을 추가하면 여기에 표시됩니다.</div>
          </div>
        </div>

        <div v-else class="picker">
          <div class="picker-head">
            <div>
              <div class="picker-name">
                {{ selectedExercise.name }}
                <span v-if="selectedExercise.search_en" class="picker-en">({{ selectedExercise.search_en }})</span>
              </div>
              <div class="picker-meta muted">
                <span v-if="selectedExercise.routine" class="tag tag-soft">{{ selectedExercise.routine }}</span>
                {{ selectedExercise.category }} · {{ selectedExercise.equipment }}
                <span v-if="selectedExercise.body_part">· {{ selectedExercise.body_part }}</span>
              </div>
            </div>
            <button class="icon-btn" @click="selectedExercise = null" aria-label="닫기">×</button>
          </div>

          <div class="visual">
            <img
              v-if="selectedExercise.image_url"
              :src="selectedExercise.image_url"
              :alt="selectedExercise.name"
              class="visual-img"
              loading="lazy"
            />
            <a
              class="yt-chip"
              :href="youtubeQuery(selectedExercise)"
              target="_blank"
              rel="noopener"
              title="유튜브 자세 영상 검색"
            >▶ 자세 영상</a>
          </div>

          <div v-if="selectedExercise.unit === 'reps'" class="sets">
            <div class="sets-head">
              <span class="field-label">세트별 (다음 + 5kg 자동)</span>
              <button class="btn-mini" @click="addSet">+ 세트</button>
            </div>
            <div class="set-head-row">
              <span class="set-col-no"></span>
              <span class="set-col-label">회</span>
              <span class="set-col-label">kg</span>
              <span class="set-col-step">−</span>
              <span class="set-col-step">+</span>
              <span class="set-col-action"></span>
              <span class="set-col-action"></span>
            </div>
            <div v-for="(s, i) in setLogs" :key="i" class="set-row">
              <span class="set-no num">{{ i + 1 }}</span>
              <input class="set-field num" type="number" v-model.number="s.reps" min="0" max="100" />
              <input class="set-field num" type="number" v-model.number="s.weight" min="0" max="500" step="5" placeholder="0" />
              <button class="step-btn" @click="s.weight = Math.max(0, (s.weight || 0) - 5)" title="−5kg">−</button>
              <button class="step-btn" @click="s.weight = (s.weight || 0) + 5" title="+5kg">＋</button>
              <button class="icon-btn" @click="copyDown(i)" title="아래 세트에 같은 값 복사">⇣</button>
              <button class="icon-btn" @click="removeSet(i)" :disabled="setLogs.length <= 1" aria-label="삭제">×</button>
            </div>
          </div>
          <div v-else-if="selectedExercise.unit === 'time'" class="form-row-2">
            <label class="field">
              <span class="field-label">시간(분)</span>
              <input class="input num" type="number" v-model.number="exMinutes" min="1" max="300" />
            </label>
          </div>
          <div v-else class="form-row-2">
            <label class="field">
              <span class="field-label">거리(km)</span>
              <input class="input num" type="number" v-model.number="exKm" min="0.1" max="50" step="0.1" />
            </label>
          </div>

          <div class="compare">
            <div class="compare-col">
              <div class="compare-label">전날 동일 운동</div>
              <div v-if="lastSameWorkout" class="compare-val">
                <div class="num">{{ lastSummary(selectedExercise.id) }}</div>
                <div class="muted small">{{ lastSameWorkout.date }} · {{ lastSameWorkout.kcal }} kcal</div>
              </div>
              <div v-else class="muted small">이전 기록 없음</div>
            </div>
            <div class="compare-col">
              <div class="compare-label">오늘 예상</div>
              <div class="compare-val">
                <div class="num accent">{{ previewKcal }} kcal</div>
                <div v-if="selectedExercise.unit === 'reps' && previewVolume" class="muted small num">
                  볼륨 {{ previewVolume }} kg·rep
                </div>
              </div>
            </div>
            <div class="compare-col">
              <div class="compare-label">변화</div>
              <div class="compare-val">
                <div class="num" :class="{ accent: deltaKcal > 0, warn: deltaKcal < 0 }">
                  {{ fmtDelta(deltaKcal) }} kcal
                </div>
                <div v-if="selectedExercise.unit === 'reps' && lastVolume > 0" class="small num" :class="{ accent: deltaVolume > 0, warn: deltaVolume < 0 }">
                  {{ fmtDelta(deltaVolume) }} 볼륨
                </div>
              </div>
            </div>
          </div>

          <button class="btn btn-primary btn-block" @click="addWorkout">기록 추가</button>
        </div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2 class="card-title">오늘 운동 기록</h2>
      <span class="muted small">{{ workoutsOfDate.length }}건</span>
    </div>
    <ul class="list">
      <li v-for="w in workoutsOfDate" :key="w.id" class="row-item">
        <div class="row-main">
          <div class="row-name">{{ w.exerciseName }}</div>
          <div class="row-sub muted num">
            <template v-if="w.unit === 'reps'">
              <template v-if="w.setLogs?.length">
                {{ w.setLogs.length }}세트 ·
                <span v-for="(s, i) in w.setLogs" :key="i">{{ i > 0 ? ' / ' : '' }}{{ s.reps }}{{ s.weight ? '×' + s.weight + 'kg' : '' }}</span>
              </template>
              <template v-else>
                {{ w.sets }}세트 × {{ w.reps }}회<span v-if="w.weight"> @ {{ w.weight }}kg</span>
              </template>
            </template>
            <template v-else-if="w.unit === 'time'">{{ w.minutes }}분</template>
            <template v-else>{{ w.km }} km</template>
          </div>
        </div>
        <div class="row-actions">
          <span class="num accent">−{{ w.kcal }} kcal</span>
          <button class="icon-btn" @click="log.removeWorkout(w.id)" aria-label="삭제">×</button>
        </div>
      </li>
      <li v-if="workoutsOfDate.length === 0" class="empty">기록 없음</li>
    </ul>
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
  .split-right { position: sticky; top: 64px; align-self: start; }
}
.split-left { min-width: 0; }
.split-right { min-width: 0; }

.routine-block { margin-bottom: 16px; }
.routine-head { display: flex; align-items: baseline; gap: 8px; padding: 4px 4px 6px; border-bottom: 1px solid var(--c-border); margin-bottom: 6px; }
.routine-name { font-size: var(--fs-md); font-weight: 600; color: var(--c-accent-ink); letter-spacing: -0.01em; }

.placeholder { padding: 28px 16px; text-align: center; background: var(--c-surface-2); border: 1px dashed var(--c-border-strong); border-radius: var(--radius-md); }
.ph-title { font-size: var(--fs-md); color: var(--c-text-soft); margin-bottom: 4px; }
.ph-sub { font-size: var(--fs-sm); color: var(--c-text-muted); }

/* ─── 우측 sticky 오늘 운동 기록 (picker 자리 비었을 때) ─── */
.today-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-xs);
  display: grid;
  gap: 8px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
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

.picker { padding: 12px; background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: var(--radius-md); display: grid; gap: 8px; }
.picker-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.picker-name { font-size: var(--fs-lg); font-weight: 600; }
.picker-en { font-size: var(--fs-sm); color: var(--c-text-muted); font-weight: 400; margin-left: 6px; letter-spacing: 0; }
.picker-meta { font-size: var(--fs-xs); display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 4px; }

.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.sets { display: grid; gap: 3px; }
.sets-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.set-head-row, .set-row {
  display: grid;
  grid-template-columns: 18px 42px 42px 22px 22px 20px 20px;
  align-items: center; gap: 4px;
  padding: 0 6px;
}
.set-head-row { font-size: 10px; color: var(--c-text-muted); padding-bottom: 2px; }
.set-col-label, .set-col-step { text-align: center; }
.set-row { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-sm); padding: 2px 6px; min-height: 26px; }
.set-no { width: 18px; text-align: center; font-size: 10px; color: var(--c-text-muted); background: var(--c-chip); border-radius: 50%; height: 16px; line-height: 16px; }
.set-field { width: 100%; height: 22px; padding: 0 4px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-xs); background: var(--c-surface); font-size: 12px; text-align: right; }
.set-field:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 2px var(--c-accent-soft); }
.step-btn { height: 20px; width: 22px; background: var(--c-surface-2); border: 1px solid var(--c-border-strong); border-radius: var(--radius-xs); color: var(--c-text-soft); font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; transition: background 0.12s; }
.step-btn:hover { background: var(--c-accent-soft); color: var(--c-accent-ink); border-color: var(--c-accent); }

.visual { position: relative; display: grid; gap: 4px; }
.visual-img { width: 100%; border-radius: var(--radius-md); border: 1px solid var(--c-border); background: var(--c-surface-2); max-height: 150px; object-fit: contain; }
.yt-chip { position: absolute; right: 6px; bottom: 6px; font-size: 10px; line-height: 1; padding: 4px 8px; background: rgba(255, 0, 0, 0.92); color: #fff; border-radius: 999px; box-shadow: 0 1px 4px rgba(0,0,0,0.18); letter-spacing: -0.01em; transition: background 0.15s, transform 0.1s; text-decoration: none; }
.yt-chip:hover { background: #c30000; transform: translateY(-1px); }

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

.compare { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--c-border); border: 1px solid var(--c-border); border-radius: var(--radius-md); overflow: hidden; }
.compare-col { background: var(--c-surface); padding: 8px 10px; }
.compare-label { font-size: var(--fs-xs); color: var(--c-text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.compare-val { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-md); }

.btn { display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 0 12px; font-size: var(--fs-sm); font-weight: 500; border-radius: var(--radius-md); transition: background 0.15s, color 0.15s, border 0.15s; }
.btn-block { width: 100%; }
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover { background: var(--c-accent-ink); }
.btn-mini { height: 22px; padding: 0 8px; font-size: var(--fs-xs); background: var(--c-surface); color: var(--c-accent-ink); border: 1px solid var(--c-accent-soft); border-radius: 999px; transition: background 0.15s; }
.btn-mini:hover { background: var(--c-accent-soft); }
.icon-btn { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--c-text-muted); border-radius: 50%; transition: background 0.15s, color 0.15s; }
.icon-btn:hover { background: var(--c-border); color: var(--c-text); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

@media (max-width: 760px) {
  .compare { grid-template-columns: 1fr; }
}
</style>
