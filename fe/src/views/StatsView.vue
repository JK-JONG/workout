<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, type WorkoutEntry } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import MiniHeatmap from '@/components/MiniHeatmap.vue'
import LineChart from '@/components/LineChart.vue'

const log = useLogStore()
const catalog = useCatalogStore()
const { workouts, meals, body, dailyOutMap, dailyInMap } = storeToRefs(log)
const { exercises } = storeToRefs(catalog)

const outColors = ['#ebedf0', '#c8e6c9', '#9be9a8', '#40c463', '#216e39']
const inColors = ['#ebedf0', '#fde4cf', '#fcc89b', '#f59e0b', '#b45309']

// ── 잔디용 데이터 — 운동 횟수(건수) 기준 잔디도 별도로
const dailyWorkoutCount = computed(() => {
  const m = new Map<string, number>()
  for (const w of workouts.value) m.set(w.date, (m.get(w.date) ?? 0) + 1)
  return m
})

// ── 최근 30일/90일/1년 통계 ──
function inWindow(date: string, days: number): boolean {
  const d = new Date(date)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = (now.getTime() - d.getTime()) / 86400000
  return diff >= 0 && diff < days
}

function avgKcalOut(days: number): number {
  let total = 0
  for (const [date, kcal] of dailyOutMap.value) {
    if (inWindow(date, days)) total += kcal
  }
  return Math.round(total / days)
}
function avgKcalIn(days: number): number {
  let total = 0
  for (const [date, kcal] of dailyInMap.value) {
    if (inWindow(date, days)) total += kcal
  }
  return Math.round(total / days)
}
function workoutDays(days: number): number {
  const dates = new Set<string>()
  for (const w of workouts.value) if (inWindow(w.date, days)) dates.add(w.date)
  return dates.size
}

const stats30 = computed(() => ({
  avgOut: avgKcalOut(30),
  avgIn: avgKcalIn(30),
  days: workoutDays(30),
}))
const stats90 = computed(() => ({
  avgOut: avgKcalOut(90),
  avgIn: avgKcalIn(90),
  days: workoutDays(90),
}))

// ── 부위별 빈도 (최근 90일, routine 운동만) ──
const exerciseById = computed(() => {
  const m = new Map<string, typeof exercises.value[number]>()
  for (const e of exercises.value) m.set(e.id, e)
  return m
})

const categoryFreq = computed(() => {
  const m = new Map<string, number>()
  for (const w of workouts.value) {
    if (!inWindow(w.date, 90)) continue
    const ex = exerciseById.value.get(w.exerciseId)
    const cat = ex?.category ?? '기타'
    m.set(cat, (m.get(cat) ?? 0) + 1)
  }
  const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  const max = arr[0]?.[1] ?? 1
  return arr.map(([cat, count]) => ({ cat, count, pct: (count / max) * 100 }))
})

// ── 신체 추이 데이터 (최근 90일) ──
function dateToDayIdx(date: string, baseDate: Date): number {
  const d = new Date(date)
  return Math.round((d.getTime() - baseDate.getTime()) / 86400000)
}

const bodyChart = computed(() => {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - 89)
  const sorted = [...body.value]
    .filter(b => inWindow(b.date, 90))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return null

  const weightPts = sorted.map(b => ({ x: dateToDayIdx(b.date, base), y: b.weightKg }))
  const fatPts = sorted.filter(b => b.bodyFatPct).map(b => ({ x: dateToDayIdx(b.date, base), y: b.bodyFatPct! }))
  const musclePts = sorted.filter(b => b.muscleKg).map(b => ({ x: dateToDayIdx(b.date, base), y: b.muscleKg! }))

  // x 라벨: 30일 단위
  const xLabels: { x: number; label: string }[] = []
  for (let i = 0; i <= 89; i += 30) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    xLabels.push({ x: i, label: `${d.getMonth() + 1}/${d.getDate()}` })
  }
  xLabels.push({ x: 89, label: '오늘' })

  return { weightPts, fatPts, musclePts, xLabels }
})

const weightSeries = computed(() => {
  if (!bodyChart.value) return []
  return [{ label: '몸무게', color: '#2f7d4a', points: bodyChart.value.weightPts }]
})
const fatSeries = computed(() => {
  if (!bodyChart.value || !bodyChart.value.fatPts.length) return []
  return [{ label: '체지방률', color: '#b45309', points: bodyChart.value.fatPts }]
})
const muscleSeries = computed(() => {
  if (!bodyChart.value || !bodyChart.value.musclePts.length) return []
  return [{ label: '골격근량', color: '#1d4ed8', points: bodyChart.value.musclePts }]
})

// ── 칼로리 추이 (최근 30일) — net 라인
const kcalChart = computed(() => {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - 29)
  const pts: { date: string; idx: number; out: number; in: number; net: number }[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const out = dailyOutMap.value.get(key) ?? 0
    const inv = dailyInMap.value.get(key) ?? 0
    pts.push({ date: key, idx: i, out, in: inv, net: inv - out })
  }
  const xLabels: { x: number; label: string }[] = []
  for (let i = 0; i < 30; i += 7) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    xLabels.push({ x: i, label: `${d.getMonth() + 1}/${d.getDate()}` })
  }
  xLabels.push({ x: 29, label: '오늘' })
  return { pts, xLabels }
})

const kcalSeries = computed(() => {
  const c = kcalChart.value
  return [
    { label: '소모', color: '#2f7d4a', points: c.pts.map(p => ({ x: p.idx, y: p.out })) },
    { label: '섭취', color: '#b45309', points: c.pts.map(p => ({ x: p.idx, y: p.in })) },
  ]
})

// 최고 기록 (운동 PR — reps 운동의 최대 무게)
const personalBests = computed(() => {
  const best = new Map<string, { name: string; weight: number; date: string }>()
  for (const w of workouts.value) {
    if (w.unit !== 'reps' || !w.weight) continue
    const cur = best.get(w.exerciseId)
    if (!cur || w.weight > cur.weight) {
      best.set(w.exerciseId, { name: w.exerciseName, weight: w.weight, date: w.date })
    }
  }
  return Array.from(best.values()).sort((a, b) => b.weight - a.weight).slice(0, 8)
})

const totalCounts = computed(() => ({
  workouts: workouts.value.length,
  meals: meals.value.length,
  body: body.value.length,
  days: new Set([...workouts.value.map((w: WorkoutEntry) => w.date), ...meals.value.map(m => m.date)]).size,
}))
</script>

<template>
  <div class="stats">
    <!-- 요약 카드 -->
    <section class="kpi">
      <div class="kpi-box">
        <div class="kpi-label">최근 30일</div>
        <div class="kpi-row">
          <span class="kpi-mini">운동 <span class="num accent">{{ stats30.days }}</span>일</span>
          <span class="kpi-mini">평균 소모 <span class="num">{{ stats30.avgOut }}</span></span>
          <span class="kpi-mini">평균 섭취 <span class="num">{{ stats30.avgIn }}</span></span>
        </div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">최근 90일</div>
        <div class="kpi-row">
          <span class="kpi-mini">운동 <span class="num accent">{{ stats90.days }}</span>일</span>
          <span class="kpi-mini">평균 소모 <span class="num">{{ stats90.avgOut }}</span></span>
          <span class="kpi-mini">평균 섭취 <span class="num">{{ stats90.avgIn }}</span></span>
        </div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">총 누적</div>
        <div class="kpi-row">
          <span class="kpi-mini">운동 <span class="num">{{ totalCounts.workouts }}</span></span>
          <span class="kpi-mini">식단 <span class="num">{{ totalCounts.meals }}</span></span>
          <span class="kpi-mini">신체 <span class="num">{{ totalCounts.body }}</span></span>
        </div>
      </div>
    </section>

    <!-- 잔디 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">활동 잔디 · 1년</h2>
      </div>
      <div class="heatmap-grid">
        <div>
          <div class="heatmap-label muted small">운동 소모 (kcal)</div>
          <MiniHeatmap :data="dailyOutMap" :weeks="52" :max="500" :colors="outColors" unit="kcal" />
        </div>
        <div>
          <div class="heatmap-label muted small">음식 섭취 (kcal)</div>
          <MiniHeatmap :data="dailyInMap" :weeks="52" :max="2500" :colors="inColors" unit="kcal" />
        </div>
        <div>
          <div class="heatmap-label muted small">운동 종목 수</div>
          <MiniHeatmap :data="dailyWorkoutCount" :weeks="52" :max="6" :colors="outColors" unit="회" />
        </div>
      </div>
    </section>

    <!-- 신체 추이 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">신체 추이 · 최근 90일</h2>
        <span class="muted small">기록 {{ body.length }}건</span>
      </div>
      <div class="charts">
        <div class="chart-block">
          <div class="chart-label">몸무게 (kg)</div>
          <LineChart :series="weightSeries" :x-labels="bodyChart?.xLabels ?? []" :show-legend="false" unit="kg" />
        </div>
        <div v-if="fatSeries.length" class="chart-block">
          <div class="chart-label">체지방률 (%)</div>
          <LineChart :series="fatSeries" :x-labels="bodyChart?.xLabels ?? []" :show-legend="false" unit="%" />
        </div>
        <div v-if="muscleSeries.length" class="chart-block">
          <div class="chart-label">골격근량 (kg)</div>
          <LineChart :series="muscleSeries" :x-labels="bodyChart?.xLabels ?? []" :show-legend="false" unit="kg" />
        </div>
      </div>
    </section>

    <!-- 칼로리 추이 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">칼로리 추이 · 최근 30일</h2>
      </div>
      <LineChart :series="kcalSeries" :x-labels="kcalChart.xLabels" unit="kcal" />
    </section>

    <!-- 부위별 빈도 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">부위별 빈도 · 최근 90일</h2>
      </div>
      <ul v-if="categoryFreq.length" class="bars">
        <li v-for="row in categoryFreq" :key="row.cat" class="bar-row">
          <span class="bar-label">{{ row.cat }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: row.pct + '%' }"></div>
          </div>
          <span class="bar-count num">{{ row.count }}회</span>
        </li>
      </ul>
      <div v-else class="empty">기록 없음</div>
    </section>

    <!-- PR -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">최고 무게 기록 (Top 8)</h2>
      </div>
      <ul v-if="personalBests.length" class="pr-list">
        <li v-for="(pb, i) in personalBests" :key="pb.name + i" class="pr-row">
          <span class="pr-rank num">{{ i + 1 }}</span>
          <span class="pr-name">{{ pb.name }}</span>
          <span class="pr-weight num accent">{{ pb.weight }}kg</span>
          <span class="pr-date num muted small">{{ pb.date }}</span>
        </li>
      </ul>
      <div v-else class="empty">아직 무게 기록이 없습니다.</div>
    </section>
  </div>
</template>

<style scoped>
.stats { display: grid; gap: 14px; }
.card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-xs); }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.card-title { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }
.accent { color: var(--c-accent); }

.kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
@media (max-width: 760px) { .kpi { grid-template-columns: 1fr; } }
.kpi-box { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-md); padding: 10px 12px; box-shadow: var(--shadow-xs); }
.kpi-label { font-size: var(--fs-xs); color: var(--c-text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.kpi-row { display: flex; flex-wrap: wrap; gap: 12px; font-size: var(--fs-md); }
.kpi-mini { color: var(--c-text-soft); }
.kpi-mini .num { font-weight: 600; color: var(--c-text); margin: 0 2px; }

.heatmap-grid { display: grid; gap: 14px; }
.heatmap-label { margin-bottom: 4px; }

.charts { display: grid; gap: 12px; }
.chart-block { display: grid; gap: 4px; }
.chart-label { font-size: var(--fs-xs); color: var(--c-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

.bars { display: grid; gap: 6px; }
.bar-row { display: grid; grid-template-columns: 64px 1fr 60px; align-items: center; gap: 8px; }
.bar-label { font-size: var(--fs-sm); color: var(--c-text-soft); }
.bar-track { height: 8px; background: var(--c-surface-2); border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--c-accent-soft), var(--c-accent)); border-radius: 999px; }
.bar-count { font-size: var(--fs-sm); color: var(--c-text-soft); text-align: right; }

.pr-list { display: grid; gap: 2px; }
.pr-row { display: grid; grid-template-columns: 24px 1fr auto auto; align-items: center; gap: 10px; padding: 6px 8px; border-radius: var(--radius-md); }
.pr-row:hover { background: var(--c-surface-2); }
.pr-rank { color: var(--c-text-muted); text-align: center; font-size: var(--fs-sm); }
.pr-name { font-size: var(--fs-md); color: var(--c-text); }
.pr-weight { font-size: var(--fs-md); font-weight: 600; }
.pr-date { white-space: nowrap; }
.empty { padding: 18px; text-align: center; color: var(--c-text-muted); font-size: var(--fs-sm); }
</style>
