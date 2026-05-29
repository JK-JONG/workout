<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, displayName, resolveSlot, type WorkoutEntry, type MealEntry } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import type { ExerciseItem } from '@/data/exercises'
import type { Slot } from '@/data/mealPresets'

const log = useLogStore()
const catalog = useCatalogStore()
const { workouts, meals, recommendedKcal, selectedDate } = storeToRefs(log)
const { exercises } = storeToRefs(catalog)

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 실제 로컬 오늘 — '오늘' 배지 표시용. 자정/포커스 복귀에도 갱신.
const todayRef = ref(ymd(new Date()))
function refreshToday() { todayRef.value = ymd(new Date()) }
let interval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshToday()
  interval = setInterval(refreshToday, 60_000)
  document.addEventListener('visibilitychange', refreshToday)
})
onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
  document.removeEventListener('visibilitychange', refreshToday)
})
const isToday = computed(() => selectedDate.value === todayRef.value)
const dateLabel = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00')
  if (isNaN(d.getTime())) return selectedDate.value
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`
})

// ── 운동 ──
const exerciseById = computed(() => {
  const m = new Map<string, ExerciseItem>()
  for (const e of exercises.value) m.set(e.id, e)
  return m
})

const todayWorkouts = computed<WorkoutEntry[]>(() =>
  workouts.value
    .filter(w => w.date === selectedDate.value)
    .sort((a, b) => a.createdAt - b.createdAt)
)

const kcalOut = computed(() => todayWorkouts.value.reduce((s, w) => s + w.kcal, 0))

interface SetSummary { reps: number; weight?: number }
function summarizeSets(w: WorkoutEntry): SetSummary[] {
  if (Array.isArray(w.setLogs) && w.setLogs.length) {
    return w.setLogs.map(s => ({ reps: s.reps, weight: s.weight }))
  }
  // 옛 단일 sets/reps 모델 fallback
  if (w.sets && w.reps) {
    return Array.from({ length: w.sets }, () => ({ reps: w.reps!, weight: w.weight }))
  }
  return []
}

function workoutMainLine(w: WorkoutEntry): string {
  if (w.unit === 'time' && w.minutes != null) return `${w.minutes}분`
  if (w.unit === 'distance' && w.km != null) return `${w.km}km`
  const sets = summarizeSets(w)
  if (!sets.length) return ''
  return `${sets.length}세트`
}

// ── 식단 ──
const SLOTS: Slot[] = ['아침', '점심', '저녁', '간식']

const todayMeals = computed<MealEntry[]>(() =>
  meals.value
    .filter(m => m.date === selectedDate.value)
    .sort((a, b) => a.createdAt - b.createdAt)
)
const kcalIn = computed(() => todayMeals.value.reduce((s, m) => s + m.kcal, 0))
const proteinIn = computed(() => todayMeals.value.reduce((s, m) => s + (m.protein ?? 0), 0))
const carbsIn = computed(() => todayMeals.value.reduce((s, m) => s + (m.carbs ?? 0), 0))
const fatIn = computed(() => todayMeals.value.reduce((s, m) => s + (m.fat ?? 0), 0))

interface SlotGroup { slot: Slot | '기타'; entries: MealEntry[]; kcal: number }

const mealsBySlot = computed<SlotGroup[]>(() => {
  const map = new Map<Slot | '기타', MealEntry[]>()
  for (const m of todayMeals.value) {
    const s = resolveSlot(m) ?? '기타'
    const arr = map.get(s) ?? []
    arr.push(m); map.set(s, arr)
  }
  const order: (Slot | '기타')[] = [...SLOTS, '기타']
  return order
    .filter(s => map.has(s))
    .map(s => {
      const entries = map.get(s)!
      const kcal = entries.reduce((sum, e) => sum + e.kcal, 0)
      return { slot: s, entries, kcal }
    })
})

const kcalNet = computed(() => kcalIn.value - kcalOut.value)
const kcalGoalDiff = computed(() => recommendedKcal.value ? kcalIn.value - recommendedKcal.value : null)

const slotIcon: Record<Slot | '기타', string> = {
  '아침': '🌅', '점심': '🌞', '저녁': '🌙', '간식': '🍎', '기타': '🍽',
}
</script>

<template>
  <div class="today">
    <header class="today-head">
      <div class="today-title">
        <span class="today-title-icon" aria-hidden="true">📋</span>
        <span>요약</span>
      </div>
      <div class="today-date">
        {{ dateLabel }}
        <span v-if="isToday" class="today-chip">오늘</span>
      </div>
    </header>

    <!-- 상단 요약 카드 -->
    <section class="summary">
      <div class="summary-cell">
        <div class="summary-label">섭취</div>
        <div class="summary-value in">{{ Math.round(kcalIn) }}<span class="unit">kcal</span></div>
        <div v-if="kcalGoalDiff !== null" class="summary-sub" :class="{ over: kcalGoalDiff > 0 }">
          목표 대비 {{ kcalGoalDiff > 0 ? '+' : '' }}{{ Math.round(kcalGoalDiff) }}
        </div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-cell">
        <div class="summary-label">소모</div>
        <div class="summary-value out">{{ Math.round(kcalOut) }}<span class="unit">kcal</span></div>
        <div class="summary-sub muted">운동 {{ todayWorkouts.length }}개</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-cell">
        <div class="summary-label">Net</div>
        <div class="summary-value" :class="{ net: true, over: kcalNet > 0 }">
          {{ kcalNet > 0 ? '+' : '' }}{{ Math.round(kcalNet) }}<span class="unit">kcal</span>
        </div>
        <div v-if="recommendedKcal" class="summary-sub muted">목표 {{ recommendedKcal }}</div>
      </div>
    </section>

    <!-- 2단 그리드 -->
    <div class="grid">
      <!-- 좌: 운동 -->
      <section class="panel">
        <header class="panel-head">
          <span class="panel-icon" aria-hidden="true">🏋️</span>
          <h2 class="panel-title">운동</h2>
          <span class="panel-count">{{ todayWorkouts.length }}개</span>
        </header>
        <ul v-if="todayWorkouts.length" class="ex-list">
          <li v-for="w in todayWorkouts" :key="w.id" class="ex-row">
            <div class="ex-img-wrap">
              <img
                v-if="exerciseById.get(w.exerciseId)?.image_url"
                :src="exerciseById.get(w.exerciseId)!.image_url!"
                :alt="w.exerciseName"
                class="ex-img"
                loading="lazy"
              />
              <span v-else class="ex-img-fallback" aria-hidden="true">
                {{ exerciseById.get(w.exerciseId)?.emoji ?? '🏋️' }}
              </span>
            </div>
            <div class="ex-body">
              <div class="ex-name">{{ w.exerciseName }}</div>
              <div class="ex-meta">
                <span class="ex-main">{{ workoutMainLine(w) }}</span>
                <span class="ex-kcal">−{{ Math.round(w.kcal) }} kcal</span>
              </div>
              <div v-if="w.unit === 'reps'" class="ex-sets">
                <span
                  v-for="(s, i) in summarizeSets(w)"
                  :key="i"
                  class="ex-set-chip"
                  :title="`${i + 1}세트 · ${s.reps}회${s.weight ? ' · ' + s.weight + 'kg' : ''}`"
                >
                  {{ s.reps }}{{ s.weight != null ? `×${s.weight}` : '' }}
                </span>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="empty">오늘 기록된 운동이 없어요.</p>
      </section>

      <!-- 우: 식단 -->
      <section class="panel">
        <header class="panel-head">
          <span class="panel-icon" aria-hidden="true">🍱</span>
          <h2 class="panel-title">식단</h2>
          <span class="panel-count">{{ todayMeals.length }}개</span>
        </header>
        <ul v-if="mealsBySlot.length" class="meal-groups">
          <li v-for="g in mealsBySlot" :key="g.slot" class="meal-group">
            <div class="meal-group-head">
              <span class="meal-slot-icon" aria-hidden="true">{{ slotIcon[g.slot] }}</span>
              <span class="meal-slot-name">{{ g.slot }}</span>
              <span class="meal-slot-kcal">{{ Math.round(g.kcal) }} kcal</span>
            </div>
            <ul class="meal-items">
              <li v-for="m in g.entries" :key="m.id" class="meal-row">
                <span class="meal-name">{{ displayName(m) }}</span>
                <span class="meal-portion" v-if="m.portion && m.portion !== 1">×{{ m.portion }}</span>
                <span class="meal-kcal">{{ Math.round(m.kcal) }} kcal</span>
              </li>
            </ul>
          </li>
        </ul>
        <p v-else class="empty">오늘 기록된 식단이 없어요.</p>

        <div v-if="todayMeals.length" class="macro-foot">
          <span class="macro-chip"><b>탄</b> {{ Math.round(carbsIn) }}g</span>
          <span class="macro-chip"><b>단</b> {{ Math.round(proteinIn) }}g</span>
          <span class="macro-chip"><b>지</b> {{ Math.round(fatIn) }}g</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.today { display: grid; gap: 14px; }
.today-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.today-title {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: var(--fs-xl);
  font-weight: 700;
  letter-spacing: -0.015em;
}
.today-title-icon { font-size: 22px; }
.today-date {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-num);
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  font-weight: 500;
}
.today-chip {
  padding: 2px 8px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  background: var(--c-accent);
  border-radius: 999px;
}

/* 상단 요약 */
.summary {
  display: grid;
  grid-template-columns: 1fr 1px 1fr 1px 1fr;
  align-items: center;
  padding: 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
}
.summary-cell { display: grid; gap: 4px; text-align: center; min-width: 0; }
.summary-divider { width: 1px; height: 36px; background: var(--c-border); justify-self: center; }
.summary-label {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.summary-value {
  font-family: var(--font-num);
  font-size: var(--fs-xxl, 22px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.summary-value .unit {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  margin-left: 2px;
  font-weight: 500;
}
.summary-value.in  { color: var(--c-accent-ink); }
.summary-value.out { color: #6b8fb5; }
.summary-value.net { color: var(--c-text); }
.summary-value.net.over { color: #d97070; }
.summary-sub {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  font-weight: 500;
}
.summary-sub.over { color: #d97070; }
.summary-sub.muted { color: var(--c-text-muted); }

/* 2단 그리드 */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}
.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: 14px;
  min-width: 0;
}
.panel-head {
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--c-border);
}
.panel-icon { font-size: 18px; }
.panel-title { font-size: var(--fs-lg); font-weight: 700; letter-spacing: -0.01em; margin: 0; flex: 1; }
.panel-count {
  font-family: var(--font-num);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-text-muted);
}

/* 운동 리스트 */
.ex-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.ex-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  padding: 8px;
  background: var(--c-surface-2);
  border-radius: var(--radius-md);
  min-width: 0;
}
.ex-img-wrap {
  width: 64px; height: 64px;
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: grid; place-items: center;
}
.ex-img { width: 100%; height: 100%; object-fit: cover; }
.ex-img-fallback { font-size: 28px; opacity: 0.6; }
.ex-body { display: grid; gap: 3px; min-width: 0; }
.ex-name {
  font-size: var(--fs-md);
  font-weight: 600;
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ex-meta {
  display: flex; align-items: baseline; gap: 8px;
  font-size: var(--fs-xs);
}
.ex-main { color: var(--c-text-soft); font-weight: 600; font-family: var(--font-num); }
.ex-kcal { color: #6b8fb5; font-weight: 600; font-family: var(--font-num); }
.ex-sets {
  display: flex; flex-wrap: wrap; gap: 4px;
  margin-top: 2px;
}
.ex-set-chip {
  font-family: var(--font-num);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  color: var(--c-text-soft);
}

/* 식단 그룹 — 헤더(아침/점심…)와 항목 행이 좌우 패딩 동일하게 flush 정렬 */
.meal-groups { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.meal-group { display: grid; gap: 4px; }
.meal-group-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 0 0 5px;
  border-bottom: 1px dashed var(--c-border);
}
.meal-slot-icon { font-size: 14px; }
.meal-slot-name {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.005em;
}
.meal-slot-kcal {
  font-family: var(--font-num);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-accent-ink);
}
.meal-items { list-style: none; padding: 0; margin: 0; display: grid; gap: 0; }
.meal-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: baseline;
  padding: 4px 0;
  font-size: var(--fs-sm);
  transition: background 0.12s;
}
.meal-row:hover { background: var(--c-surface-2); }
.meal-name {
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meal-portion {
  font-family: var(--font-num);
  font-size: 11px;
  color: var(--c-text-muted);
  font-weight: 600;
}
.meal-kcal {
  font-family: var(--font-num);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-text-soft);
}

.macro-foot {
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--c-border);
}
.macro-chip {
  font-family: var(--font-num);
  font-size: var(--fs-xs);
  font-weight: 600;
  padding: 3px 9px;
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  border-radius: 999px;
}
.macro-chip b { margin-right: 3px; font-weight: 800; opacity: 0.7; }

.empty {
  margin: 0;
  padding: 28px 0;
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}

@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
  .summary { grid-template-columns: 1fr; gap: 8px; padding: 12px; }
  .summary-divider { display: none; }
  .summary-cell { padding: 6px 0; border-bottom: 1px solid var(--c-border); }
  .summary-cell:last-child { border-bottom: none; }
}
</style>
