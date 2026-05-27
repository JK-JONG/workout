<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { useCatalogStore } from '@/stores/catalog'
import { useAllProfilesData, colorForProfile } from '@/composables/useAllProfilesData'
import { useProfileStore } from '@/stores/profile'
import MiniHeatmap from '@/components/MiniHeatmap.vue'
import LineChart from '@/components/LineChart.vue'

const catalog = useCatalogStore()
const { exercises } = storeToRefs(catalog)

// 모든 프로필 데이터 합산 (잔디·평균·PR 공용 / 신체 추이는 프로필별 분리)
const {
  allWorkouts: rawWorkouts,
  allMeals: rawMeals,
  allBody: rawBody,
} = useAllProfilesData()

// ── 프로필 탭 ('' = 전체 합산) ──
const profileStore = useProfileStore()
const selectedProfile = useLocalStorage<string>('wt.statsProfile', '')

const tabProfiles = computed<string[]>(() => {
  const set = new Set<string>(profileStore.knownProfiles)
  for (const w of rawWorkouts.value) set.add(w.profile)
  for (const m of rawMeals.value) set.add(m.profile)
  for (const b of rawBody.value) set.add(b.profile)
  return Array.from(set).filter(Boolean).sort()
})

const isAll = computed(() => selectedProfile.value === '')
function passes(p: string): boolean {
  return isAll.value || p === selectedProfile.value
}

const allWorkouts = computed(() => rawWorkouts.value.filter(w => passes(w.profile)))
const allMeals = computed(() => rawMeals.value.filter(m => passes(m.profile)))
const allBody = computed(() => rawBody.value.filter(b => passes(b.profile)))

const outColors = ['#ebedf0', '#c8e6c9', '#9be9a8', '#40c463', '#216e39']
const inColors = ['#ebedf0', '#fde4cf', '#fcc89b', '#f59e0b', '#b45309']

// ── 잔디용 합계 맵 ──
const dailyOutMap = computed(() => {
  const m = new Map<string, number>()
  for (const w of allWorkouts.value) m.set(w.date, (m.get(w.date) ?? 0) + w.kcal)
  return m
})
const dailyInMap = computed(() => {
  const m = new Map<string, number>()
  for (const e of allMeals.value) m.set(e.date, (m.get(e.date) ?? 0) + e.kcal)
  return m
})
// ── 최근 N일 통계 ──
function inWindow(date: string, days: number): boolean {
  const d = new Date(date)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = (now.getTime() - d.getTime()) / 86400000
  return diff >= 0 && diff < days
}
function avgKcalOut(days: number): number {
  let total = 0
  for (const [date, kcal] of dailyOutMap.value) if (inWindow(date, days)) total += kcal
  return Math.round(total / days)
}
function avgKcalIn(days: number): number {
  let total = 0
  for (const [date, kcal] of dailyInMap.value) if (inWindow(date, days)) total += kcal
  return Math.round(total / days)
}
function workoutDays(days: number): number {
  const dates = new Set<string>()
  for (const w of allWorkouts.value) if (inWindow(w.date, days)) dates.add(w.date)
  return dates.size
}

const stats30 = computed(() => ({ avgOut: avgKcalOut(30), avgIn: avgKcalIn(30), days: workoutDays(30) }))
const stats90 = computed(() => ({ avgOut: avgKcalOut(90), avgIn: avgKcalIn(90), days: workoutDays(90) }))

// ── 프로필별 최근 30일 활동 분포 ──
const perProfileActivity = computed(() => {
  const m = new Map<string, { count: number; kcal: number }>()
  for (const w of allWorkouts.value) {
    if (!inWindow(w.date, 30)) continue
    const cur = m.get(w.profile) ?? { count: 0, kcal: 0 }
    cur.count++
    cur.kcal += w.kcal
    m.set(w.profile, cur)
  }
  return Array.from(m.entries())
    .map(([profile, v]) => ({ profile, ...v, color: colorForProfile(profile) }))
    .sort((a, b) => b.count - a.count)
})

// ── 부위별 빈도 (최근 90일) ──
const exerciseById = computed(() => {
  const m = new Map<string, typeof exercises.value[number]>()
  for (const e of exercises.value) m.set(e.id, e)
  return m
})
const categoryFreq = computed(() => {
  const m = new Map<string, number>()
  for (const w of allWorkouts.value) {
    if (!inWindow(w.date, 90)) continue
    const ex = exerciseById.value.get(w.exerciseId)
    const cat = ex?.category ?? '기타'
    m.set(cat, (m.get(cat) ?? 0) + 1)
  }
  const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  const max = arr[0]?.[1] ?? 1
  return arr.map(([cat, count]) => ({ cat, count, pct: (count / max) * 100 }))
})

// ── 신체 추이 (프로필별 색상 분리, 최근 90일) ──
function dateToDayIdx(date: string, baseDate: Date): number {
  const d = new Date(date)
  return Math.round((d.getTime() - baseDate.getTime()) / 86400000)
}

const bodyChart = computed(() => {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - 89)

  // 프로필별 그룹
  const byProfile = new Map<string, typeof allBody.value>()
  for (const b of allBody.value) {
    if (!inWindow(b.date, 90)) continue
    const list = byProfile.get(b.profile) ?? []
    list.push(b)
    byProfile.set(b.profile, list)
  }

  const weight: { label: string; color: string; points: { x: number; y: number }[] }[] = []
  const fat: typeof weight = []
  const muscle: typeof weight = []

  for (const [p, list] of byProfile) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const color = colorForProfile(p)
    const w = sorted.map(b => ({ x: dateToDayIdx(b.date, base), y: b.weightKg }))
    if (w.length) weight.push({ label: p, color, points: w })
    const f = sorted.filter(b => b.bodyFatPct).map(b => ({ x: dateToDayIdx(b.date, base), y: b.bodyFatPct! }))
    if (f.length) fat.push({ label: p, color, points: f })
    const mu = sorted.filter(b => b.muscleKg).map(b => ({ x: dateToDayIdx(b.date, base), y: b.muscleKg! }))
    if (mu.length) muscle.push({ label: p, color, points: mu })
  }

  const xLabels: { x: number; label: string }[] = []
  for (let i = 0; i <= 89; i += 30) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    xLabels.push({ x: i, label: `${d.getMonth() + 1}/${d.getDate()}` })
  }
  xLabels.push({ x: 89, label: '오늘' })

  return { weight, fat, muscle, xLabels, hasAny: byProfile.size > 0 }
})

// ── 칼로리 추이 (최근 30일) ──
const kcalChart = computed(() => {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - 29)
  const pts: { idx: number; out: number; in: number }[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const out = dailyOutMap.value.get(key) ?? 0
    const inv = dailyInMap.value.get(key) ?? 0
    pts.push({ idx: i, out, in: inv })
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
const kcalSeries = computed(() => [
  { label: '소모', color: '#2f7d4a', points: kcalChart.value.pts.map(p => ({ x: p.idx, y: p.out })) },
  { label: '섭취', color: '#b45309', points: kcalChart.value.pts.map(p => ({ x: p.idx, y: p.in })) },
])

// ── PR (모든 프로필 합산, 사람도 표시) ──
const personalBests = computed(() => {
  const best = new Map<string, { name: string; weight: number; date: string; profile: string }>()
  for (const w of allWorkouts.value) {
    if (w.unit !== 'reps' || !w.weight) continue
    const key = `${w.profile}|${w.exerciseId}`
    const cur = best.get(key)
    if (!cur || w.weight > cur.weight) {
      best.set(key, { name: w.exerciseName, weight: w.weight, date: w.date, profile: w.profile })
    }
  }
  return Array.from(best.values()).sort((a, b) => b.weight - a.weight).slice(0, 10)
})

const totalCounts = computed(() => ({
  workouts: allWorkouts.value.length,
  meals: allMeals.value.length,
  body: allBody.value.length,
}))
</script>

<template>
  <div class="stats">
    <!-- 프로필 탭 -->
    <section v-if="tabProfiles.length" class="profile-tabs">
      <button
        class="ptab"
        :class="{ active: isAll }"
        @click="selectedProfile = ''"
      >
        <span class="ptab-dot ptab-dot-all"></span>
        <span>전체</span>
        <span class="ptab-count">{{ tabProfiles.length }}명</span>
      </button>
      <button
        v-for="p in tabProfiles"
        :key="p"
        class="ptab"
        :class="{ active: selectedProfile === p }"
        @click="selectedProfile = p"
      >
        <span class="ptab-dot" :style="{ background: colorForProfile(p) }"></span>
        <span>{{ p }}</span>
      </button>
    </section>

    <!-- 요약 -->
    <section class="kpi">
      <div class="kpi-box">
        <div class="kpi-label">최근 30일{{ isAll ? ' · 합산' : ` · ${selectedProfile}` }}</div>
        <div class="kpi-row">
          <span class="kpi-mini">운동 <span class="num accent">{{ stats30.days }}</span>일</span>
          <span class="kpi-mini">평균 소모 <span class="num">{{ stats30.avgOut }}</span></span>
          <span class="kpi-mini">평균 섭취 <span class="num">{{ stats30.avgIn }}</span></span>
        </div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">최근 90일{{ isAll ? ' · 합산' : ` · ${selectedProfile}` }}</div>
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

    <!-- 프로필별 활동 (최근 30일) — 전체 탭에서만 -->
    <section v-if="isAll && perProfileActivity.length" class="card">
      <div class="card-head">
        <h2 class="card-title">사람별 활동 · 최근 30일</h2>
      </div>
      <div class="ppa">
        <div v-for="p in perProfileActivity" :key="p.profile" class="ppa-row">
          <span class="ppa-dot" :style="{ background: p.color }"></span>
          <span class="ppa-name">{{ p.profile }}</span>
          <span class="num muted small">{{ p.count }}건 · {{ p.kcal }} kcal</span>
        </div>
      </div>
    </section>

    <!-- 잔디 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">활동 잔디 · 1년 ({{ isAll ? '모든 사람 합산' : selectedProfile }})</h2>
      </div>
      <div class="heatmap-grid">
        <div>
          <div class="heatmap-label muted small">운동 소모 (kcal{{ isAll ? ' · 합산' : '' }})</div>
          <MiniHeatmap :data="dailyOutMap" :weeks="52" :max="500" :colors="outColors" unit="kcal" />
        </div>
        <div>
          <div class="heatmap-label muted small">음식 섭취 (kcal{{ isAll ? ' · 합산' : '' }})</div>
          <MiniHeatmap :data="dailyInMap" :weeks="52" :max="2500" :colors="inColors" unit="kcal" />
        </div>
      </div>
    </section>

    <!-- 신체 추이 (프로필별 색상) -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">신체 추이 · 최근 90일{{ isAll ? ' (사람별 색)' : ` (${selectedProfile})` }}</h2>
      </div>
      <div v-if="bodyChart.hasAny" class="charts">
        <div class="chart-block">
          <div class="chart-label">몸무게 (kg)</div>
          <LineChart :series="bodyChart.weight" :x-labels="bodyChart.xLabels" :show-legend="true" unit="kg" />
        </div>
        <div v-if="bodyChart.fat.length" class="chart-block">
          <div class="chart-label">체지방률 (%)</div>
          <LineChart :series="bodyChart.fat" :x-labels="bodyChart.xLabels" :show-legend="false" unit="%" />
        </div>
        <div v-if="bodyChart.muscle.length" class="chart-block">
          <div class="chart-label">골격근량 (kg)</div>
          <LineChart :series="bodyChart.muscle" :x-labels="bodyChart.xLabels" :show-legend="false" unit="kg" />
        </div>
      </div>
      <div v-else class="empty">아직 신체 기록이 없습니다.</div>
    </section>

    <!-- 칼로리 추이 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">칼로리 추이 · 최근 30일 ({{ isAll ? '합산' : selectedProfile }})</h2>
      </div>
      <div class="chart-block">
        <LineChart :series="kcalSeries" :x-labels="kcalChart.xLabels" unit="kcal" />
      </div>
    </section>

    <!-- 부위별 빈도 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">부위별 빈도 · 최근 90일 ({{ isAll ? '합산' : selectedProfile }})</h2>
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
        <h2 class="card-title">최고 무게 기록 · Top 10{{ isAll ? ' (사람별)' : ` (${selectedProfile})` }}</h2>
      </div>
      <ul v-if="personalBests.length" class="pr-list">
        <li v-for="(pb, i) in personalBests" :key="pb.profile + pb.name + i" class="pr-row">
          <span class="pr-rank num">{{ i + 1 }}</span>
          <span class="pr-name">{{ pb.name }}</span>
          <span class="pr-profile" :style="{ color: colorForProfile(pb.profile) }">{{ pb.profile }}</span>
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

.profile-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}
.ptab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-text-soft);
  background: transparent;
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.ptab:hover { color: var(--c-text); background: var(--c-surface); }
.ptab.active {
  background: var(--c-surface);
  color: var(--c-accent-ink);
  box-shadow: var(--shadow-xs);
}
.ptab-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--c-text-muted);
}
.ptab-dot-all {
  background: linear-gradient(135deg, #2f7d4a 0%, #b45309 50%, #1d4ed8 100%);
}
.ptab-count {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  font-weight: 400;
}
.card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-xs); }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.card-title { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }
.accent { color: var(--c-accent); }

.kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
@media (max-width: 760px) { .kpi { grid-template-columns: 1fr; } }
.kpi-box { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-md); padding: 8px 12px; box-shadow: var(--shadow-xs); }
.kpi-label { font-size: var(--fs-xs); color: var(--c-text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
.kpi-row { display: flex; flex-wrap: wrap; gap: 10px; font-size: var(--fs-sm); }
.kpi-mini { color: var(--c-text-soft); }
.kpi-mini .num { font-weight: 600; color: var(--c-text); margin: 0 1px; }

.ppa { display: grid; gap: 4px; }
.ppa-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: var(--radius-sm); }
.ppa-row:hover { background: var(--c-surface-2); }
.ppa-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.ppa-name { font-size: var(--fs-sm); font-weight: 500; color: var(--c-text); flex: 1; }

.heatmap-grid { display: grid; gap: 14px; }
.heatmap-grid > div { max-width: 720px; }     /* 52주 잔디 칸이 너무 커지지 않도록 */
.heatmap-label { margin-bottom: 4px; }

.charts { display: grid; gap: 14px; }
.chart-block {
  display: grid; gap: 4px;
  max-width: 720px;     /* 차트 폭 제한: SVG 텍스트 과대 확대 방지 */
}
.chart-label { font-size: var(--fs-xs); color: var(--c-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

.bars { display: grid; gap: 6px; }
.bar-row { display: grid; grid-template-columns: 64px 1fr 60px; align-items: center; gap: 8px; }
.bar-label { font-size: var(--fs-sm); color: var(--c-text-soft); }
.bar-track { height: 8px; background: var(--c-surface-2); border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--c-accent-soft), var(--c-accent)); border-radius: 999px; }
.bar-count { font-size: var(--fs-sm); color: var(--c-text-soft); text-align: right; }

.pr-list { display: grid; gap: 2px; }
.pr-row {
  display: grid;
  grid-template-columns: 22px 1fr auto auto auto;
  align-items: center; gap: 10px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
}
.pr-row:hover { background: var(--c-surface-2); }
.pr-rank { color: var(--c-text-muted); text-align: center; font-size: var(--fs-sm); }
.pr-name { font-size: var(--fs-sm); color: var(--c-text); }
.pr-profile { font-size: var(--fs-xs); font-weight: 500; }
.pr-weight { font-size: var(--fs-sm); font-weight: 600; }
.pr-date { white-space: nowrap; font-size: var(--fs-xs); }
.empty { padding: 18px; text-align: center; color: var(--c-text-muted); font-size: var(--fs-sm); }
</style>
