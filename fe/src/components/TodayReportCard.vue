<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, resolveSlot, displayName, type MealEntry } from '@/stores/log'
import { useProfileStore } from '@/stores/profile'
import type { Slot } from '@/data/mealPresets'

const log = useLogStore()
const profile = useProfileStore()
const { selectedDate, workoutsOfDate, mealsOfDate, kcalIn, kcalOut, kcalNet } = storeToRefs(log)
const { activeProfile } = storeToRefs(profile)

const SLOTS: Slot[] = ['아침', '점심', '저녁', '간식']

const dateLabel = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00')
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return { ymd: `${y}.${m}.${day}`, wd: `${wd}요일` }
})

const totalVolume = computed(() => {
  let v = 0
  for (const w of workoutsOfDate.value) {
    if (w.unit !== 'reps') continue
    if (w.setLogs?.length) {
      for (const s of w.setLogs) v += s.reps * (s.weight || 0)
    } else {
      v += (w.sets ?? 0) * (w.reps ?? 0) * (w.weight ?? 0)
    }
  }
  return v
})

const totalSets = computed(() => {
  let n = 0
  for (const w of workoutsOfDate.value) {
    if (w.unit === 'reps') n += w.setLogs?.length ?? w.sets ?? 0
  }
  return n
})

const cardioMinutes = computed(() => {
  let m = 0
  for (const w of workoutsOfDate.value) {
    if (w.unit === 'time') m += w.minutes ?? 0
  }
  return m
})

const cardioKm = computed(() => {
  let k = 0
  for (const w of workoutsOfDate.value) {
    if (w.unit === 'distance') k += w.km ?? 0
  }
  return Math.round(k * 10) / 10
})

const mealMacros = computed(() => {
  let p = 0, c = 0, f = 0
  for (const m of mealsOfDate.value) {
    p += m.protein
    c += m.carbs
    f += m.fat
  }
  return { p: Math.round(p), c: Math.round(c), f: Math.round(f) }
})

function mealsOfSlot(slot: Slot): MealEntry[] {
  return mealsOfDate.value.filter(m => resolveSlot(m) === slot)
}
function slotKcal(slot: Slot): number {
  return mealsOfSlot(slot).reduce((s, m) => s + m.kcal, 0)
}
const unslotted = computed<MealEntry[]>(() => mealsOfDate.value.filter(m => !resolveSlot(m)))

const intensity = computed(() => {
  const k = kcalOut.value
  if (k === 0)   return { label: '휴식',    tone: 'neutral', rule: '소모 0 kcal' }
  if (k < 100)  return { label: '가볍게',  tone: 'ok',      rule: '< 100 kcal' }
  if (k < 250)  return { label: '꾸준히',  tone: 'ok',      rule: '100–249 kcal' }
  if (k < 500)  return { label: '강하게',  tone: 'good',    rule: '250–499 kcal' }
  return         { label: '고강도',        tone: 'strong',  rule: '≥ 500 kcal' }
})

const balance = computed(() => {
  const n = kcalNet.value
  if (kcalIn.value === 0 && kcalOut.value === 0) return { label: '기록 없음', tone: 'neutral', rule: '입력 없음' }
  if (n <= -300) return { label: '감량 페이스', tone: 'good',    rule: 'NET ≤ −300' }
  if (n < 0)     return { label: '소모 우위',   tone: 'ok',      rule: '−300 < NET < 0' }
  if (n <= 200)  return { label: '유지',        tone: 'neutral', rule: '0 ≤ NET ≤ 200' }
  if (n <= 500)  return { label: '약간 초과',   tone: 'warn',    rule: '200 < NET ≤ 500' }
  return         { label: '초과',               tone: 'warn',    rule: 'NET > 500' }
})

function fmtWorkoutDetail(w: (typeof workoutsOfDate.value)[number]) {
  if (w.unit === 'reps') {
    if (w.setLogs?.length) {
      const wt = w.setLogs.find(s => s.weight)?.weight
      return `${w.setLogs.length}세트 · ${w.setLogs.map(s => s.reps).join('/')}${wt ? ` @${wt}kg` : ''}`
    }
    return `${w.sets ?? '?'}×${w.reps ?? '?'}${w.weight ? ` @${w.weight}kg` : ''}`
  }
  if (w.unit === 'time') return `${w.minutes ?? 0}분`
  return `${w.km ?? 0}km`
}
</script>

<template>
  <article class="report">
    <!-- 헤더 (컴팩트) -->
    <header class="hdr">
      <div class="hdr-left">
        <div class="brand">WORKOUT TRACKER</div>
        <h1 class="label">오늘의 운동 평가서</h1>
      </div>
      <div class="hdr-right">
        <div class="date-ymd">{{ dateLabel.ymd }}</div>
        <div class="date-wd">{{ dateLabel.wd }}</div>
        <div v-if="activeProfile" class="hdr-profile">{{ activeProfile }}</div>
      </div>
    </header>

    <!-- KPI + 평가 (한 줄에 컴팩트하게) -->
    <section class="topline">
      <div class="kpi-row">
        <div class="kpi-cell">
          <span class="kpi-k">섭취</span>
          <span class="kpi-v">{{ kcalIn }}</span>
          <span class="kpi-u">kcal</span>
        </div>
        <div class="kpi-cell strong">
          <span class="kpi-k">소모</span>
          <span class="kpi-v">{{ kcalOut }}</span>
          <span class="kpi-u">kcal</span>
        </div>
        <div class="kpi-cell" :class="balance.tone">
          <span class="kpi-k">NET</span>
          <span class="kpi-v">{{ kcalNet > 0 ? '+' : '' }}{{ kcalNet }}</span>
          <span class="kpi-u">kcal</span>
        </div>
      </div>
      <div class="band-row">
        <div class="band">
          <span class="band-k">운동 강도</span>
          <span class="band-v" :class="intensity.tone">{{ intensity.label }}</span>
          <span class="band-rule">{{ intensity.rule }}</span>
        </div>
        <div class="band">
          <span class="band-k">밸런스</span>
          <span class="band-v" :class="balance.tone">{{ balance.label }}</span>
          <span class="band-rule">{{ balance.rule }}</span>
        </div>
      </div>
    </section>

    <!-- 운동 (메인 콘텐츠) -->
    <section class="block">
      <div class="block-head">
        <div class="block-title">운동</div>
        <div class="block-meta">
          <span v-if="totalSets > 0">{{ totalSets }}세트</span>
          <span v-if="totalVolume > 0">· 볼륨 {{ totalVolume.toLocaleString() }} kg·rep</span>
          <span v-if="cardioMinutes > 0">· 유산소 {{ cardioMinutes }}분</span>
          <span v-if="cardioKm > 0">· {{ cardioKm }}km</span>
        </div>
      </div>
      <ul v-if="workoutsOfDate.length" class="rows">
        <li v-for="w in workoutsOfDate" :key="w.id" class="row">
          <div class="row-name">{{ w.exerciseName }}</div>
          <div class="row-mid">{{ fmtWorkoutDetail(w) }}</div>
          <div class="row-kcal">−{{ w.kcal }}</div>
        </li>
      </ul>
      <div v-else class="empty">운동 기록 없음</div>
    </section>

    <!-- 식단 4칸 -->
    <section class="block">
      <div class="block-head">
        <div class="block-title">식단</div>
        <div class="block-meta">
          <span v-if="mealsOfDate.length">{{ mealsOfDate.length }}건</span>
          <span v-if="mealMacros.p || mealMacros.c || mealMacros.f">
            · P {{ mealMacros.p }}g · C {{ mealMacros.c }}g · F {{ mealMacros.f }}g
          </span>
        </div>
      </div>
      <div v-if="mealsOfDate.length === 0" class="empty">식단 기록 없음</div>
      <div v-else class="meal-grid">
        <div
          v-for="slot in SLOTS"
          :key="slot"
          class="meal-col"
          :class="{ filled: mealsOfSlot(slot).length > 0 }"
        >
          <div class="meal-col-head">
            <span class="meal-col-name">{{ slot }}</span>
            <span class="meal-col-kcal">
              <template v-if="mealsOfSlot(slot).length">{{ slotKcal(slot) }} kcal</template>
              <template v-else>—</template>
            </span>
          </div>
          <ul v-if="mealsOfSlot(slot).length" class="meal-list">
            <li v-for="m in mealsOfSlot(slot)" :key="m.id" class="meal-item">
              <span class="meal-item-name">{{ displayName(m) }}</span>
              <span class="meal-item-kcal">{{ m.kcal }}</span>
            </li>
          </ul>
          <div v-else class="meal-empty">없음</div>
        </div>
      </div>
      <!-- 슬롯 미지정 옛 기록 -->
      <div v-if="unslotted.length" class="unslotted">
        <div class="unslotted-head">슬롯 미지정</div>
        <ul class="meal-list">
          <li v-for="m in unslotted" :key="m.id" class="meal-item">
            <span class="meal-item-name">{{ m.foodName }}</span>
            <span class="meal-item-kcal">{{ m.kcal }}</span>
          </li>
        </ul>
      </div>
    </section>

    <footer class="ftr">
      <div class="ftr-line"></div>
      <div class="ftr-text">기록은 거짓말하지 않는다.</div>
    </footer>
  </article>
</template>

<style scoped>
.report {
  width: 1080px;
  padding: 48px 56px 44px;
  background: linear-gradient(180deg, #f7f6f3 0%, #ece8df 100%);
  color: #1a1a18;
  font-family: 'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif;
  letter-spacing: -0.01em;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-sizing: border-box;
}

/* ─── 헤더 (컴팩트) ─── */
.hdr {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 2px solid #1a1a18;
}
.hdr-left { display: flex; flex-direction: column; gap: 6px; }
.brand {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 14px;
  letter-spacing: 0.18em;
  color: #5a564d;
  font-weight: 600;
}
.label {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #1a1a18;
  line-height: 1.05;
}
.hdr-right {
  text-align: right;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.date-ymd { font-size: 26px; font-weight: 700; color: #1a1a18; letter-spacing: -0.015em; line-height: 1.1; }
.date-wd { font-size: 14px; color: #5a564d; letter-spacing: 0.04em; }
.hdr-profile {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #2f7d4a;
  background: #dff0e4;
  padding: 4px 10px;
  border-radius: 999px;
  font-family: 'Pretendard', sans-serif;
}

/* ─── 상단 요약 (KPI + Band) ─── */
.topline { display: flex; flex-direction: column; gap: 10px; }
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.kpi-cell {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 10px;
  padding: 14px 18px;
}
.kpi-cell.strong { background: #1a1a18; border-color: #1a1a18; color: #fbfaf7; }
.kpi-cell.strong .kpi-k { color: #b8b4ab; }
.kpi-cell.strong .kpi-u { color: #b8b4ab; }
.kpi-cell.good { background: #dff0e4; border-color: #b8d9c2; }
.kpi-cell.good .kpi-v { color: #1f5733; }
.kpi-cell.warn { background: #fbe9d6; border-color: #e8c79a; }
.kpi-cell.warn .kpi-v { color: #b45309; }
.kpi-cell.ok .kpi-v { color: #2f7d4a; }

.kpi-k { font-size: 13px; font-weight: 600; color: #5a564d; letter-spacing: 0.06em; }
.kpi-v {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  flex: 1;
  text-align: right;
}
.kpi-u { font-size: 12px; color: #9a948a; }

.band-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.band {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 10px;
}
.band-k { font-size: 13px; color: #5a564d; font-weight: 600; }
.band-v {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
  flex: 1;
}
.band-v.ok { color: #2f7d4a; }
.band-v.good { color: #1f5733; }
.band-v.strong { color: #b45309; }
.band-v.warn { color: #b45309; }
.band-v.neutral { color: #1a1a18; }
.band-rule {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: #9a948a;
  padding: 3px 8px;
  background: #f1ede4;
  border-radius: 999px;
  letter-spacing: 0;
  white-space: nowrap;
}

/* ─── 블록 (운동·식단) ─── */
.block {
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 14px;
  padding: 22px 24px 20px;
}
.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ece8df;
  gap: 14px;
}
.block-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.block-meta {
  font-size: 14px;
  color: #5a564d;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  text-align: right;
}

/* 운동 행 — 크고 잘 보이게 */
.rows { display: flex; flex-direction: column; gap: 2px; }
.row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.4fr) 100px;
  align-items: center;
  gap: 14px;
  padding: 12px 6px;
  border-bottom: 1px dashed #f1ede4;
}
.row:last-child { border-bottom: none; }
.row-name { font-size: 19px; font-weight: 600; color: #1a1a18; }
.row-mid {
  font-size: 16px;
  color: #5a564d;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.row-kcal {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 20px;
  font-weight: 700;
  text-align: right;
  color: #2f7d4a;
}

.empty {
  padding: 18px 0;
  text-align: center;
  color: #9a948a;
  font-size: 15px;
}

/* ─── 식단 4칸 ─── */
.meal-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.meal-col {
  background: #fbfaf7;
  border: 1px solid #ece8df;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 110px;
}
.meal-col.filled { background: #ffffff; border-color: #d9d3c4; }
.meal-col-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #ece8df;
}
.meal-col-name {
  font-size: 15px;
  font-weight: 700;
  color: #1f5733;
  letter-spacing: -0.005em;
}
.meal-col-kcal {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: #5a564d;
  font-weight: 600;
}
.meal-list { display: flex; flex-direction: column; gap: 2px; }
.meal-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 3px 0;
  font-size: 13px;
}
.meal-item-name { color: #1a1a18; word-break: keep-all; }
.meal-item-kcal {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  color: #b45309;
  font-weight: 600;
  font-size: 12px;
  flex-shrink: 0;
}
.meal-empty {
  padding: 6px 0;
  text-align: center;
  color: #9a948a;
  font-size: 12px;
  font-style: italic;
}

.unslotted {
  margin-top: 10px;
  padding: 10px 12px;
  background: #fbfaf7;
  border: 1px dashed #d9d3c4;
  border-radius: 8px;
}
.unslotted-head {
  font-size: 11px;
  color: #9a948a;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 4px;
  font-weight: 600;
}

/* ─── 푸터 ─── */
.ftr {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
}
.ftr-line { width: 60px; height: 2px; background: #1a1a18; }
.ftr-text {
  font-size: 13px;
  color: #5a564d;
  letter-spacing: 0.04em;
  font-weight: 500;
}
</style>
