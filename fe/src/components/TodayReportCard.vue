<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'
import { useProfileStore } from '@/stores/profile'

const log = useLogStore()
const profile = useProfileStore()
const { selectedDate, workoutsOfDate, mealsOfDate, bodyOfDate, kcalIn, kcalOut, kcalNet } = storeToRefs(log)
const { activeProfile } = storeToRefs(profile)

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

const intensity = computed(() => {
  const k = kcalOut.value
  if (k === 0) return { label: '휴식', tone: 'neutral' }
  if (k < 100) return { label: '가볍게', tone: 'ok' }
  if (k < 250) return { label: '꾸준히', tone: 'ok' }
  if (k < 500) return { label: '강하게', tone: 'good' }
  return { label: '고강도', tone: 'strong' }
})

const balance = computed(() => {
  const n = kcalNet.value
  if (kcalIn.value === 0 && kcalOut.value === 0) return { label: '기록 없음', tone: 'neutral' }
  if (n <= -300) return { label: '감량 페이스', tone: 'good' }
  if (n < 0) return { label: '소모 우위', tone: 'ok' }
  if (n <= 200) return { label: '유지', tone: 'neutral' }
  if (n <= 500) return { label: '약간 초과', tone: 'warn' }
  return { label: '초과', tone: 'warn' }
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
    <header class="hdr">
      <div class="hdr-meta">
        <div class="brand">WORKOUT TRACKER</div>
        <div class="label">오늘의 운동 평가서</div>
      </div>
      <div class="hdr-date">
        <div class="date-ymd">{{ dateLabel.ymd }}</div>
        <div class="date-wd">{{ dateLabel.wd }}</div>
      </div>
      <div v-if="activeProfile" class="hdr-profile">{{ activeProfile }}</div>
    </header>

    <section class="kpi">
      <div class="kpi-cell">
        <div class="kpi-k">섭취</div>
        <div class="kpi-v">{{ kcalIn }}</div>
        <div class="kpi-u">kcal</div>
      </div>
      <div class="kpi-cell strong">
        <div class="kpi-k">소모</div>
        <div class="kpi-v">{{ kcalOut }}</div>
        <div class="kpi-u">kcal</div>
      </div>
      <div class="kpi-cell" :class="balance.tone">
        <div class="kpi-k">NET</div>
        <div class="kpi-v">{{ kcalNet > 0 ? '+' : '' }}{{ kcalNet }}</div>
        <div class="kpi-u">kcal</div>
      </div>
    </section>

    <section class="band">
      <div class="band-cell">
        <div class="band-k">운동 강도</div>
        <div class="band-v" :class="intensity.tone">{{ intensity.label }}</div>
      </div>
      <div class="band-cell">
        <div class="band-k">칼로리 밸런스</div>
        <div class="band-v" :class="balance.tone">{{ balance.label }}</div>
      </div>
    </section>

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
      <ul v-if="mealsOfDate.length" class="rows">
        <li v-for="m in mealsOfDate" :key="m.id" class="row">
          <div class="row-name">{{ m.foodName }}</div>
          <div class="row-mid"></div>
          <div class="row-kcal warn">+{{ m.kcal }}</div>
        </li>
      </ul>
      <div v-else class="empty">식단 기록 없음</div>
    </section>

    <section v-if="bodyOfDate.length" class="block">
      <div class="block-head">
        <div class="block-title">신체</div>
      </div>
      <ul class="rows">
        <li v-for="b in bodyOfDate" :key="b.id" class="row">
          <div class="row-name">체중 {{ b.weightKg }}kg</div>
          <div class="row-mid">
            <span v-if="b.bodyFatPct != null">체지방 {{ b.bodyFatPct }}%</span>
            <span v-if="b.muscleKg != null"> · 근육 {{ b.muscleKg }}kg</span>
          </div>
          <div class="row-kcal"></div>
        </li>
      </ul>
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
  min-height: 1620px;
  padding: 72px 64px 60px;
  background: linear-gradient(180deg, #f7f6f3 0%, #ece8df 100%);
  color: #1a1a18;
  font-family: 'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif;
  letter-spacing: -0.01em;
  display: flex;
  flex-direction: column;
  gap: 36px;
  box-sizing: border-box;
}

.hdr {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 12px;
  padding-bottom: 28px;
  border-bottom: 2px solid #1a1a18;
  position: relative;
}
.hdr-meta { display: flex; flex-direction: column; gap: 10px; }
.brand {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 18px;
  letter-spacing: 0.18em;
  color: #5a564d;
  font-weight: 600;
}
.label {
  font-size: 56px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #1a1a18;
  line-height: 1;
}
.hdr-date { text-align: right; font-family: 'JetBrains Mono', ui-monospace, monospace; }
.date-ymd { font-size: 44px; font-weight: 700; color: #1a1a18; letter-spacing: -0.02em; }
.date-wd { font-size: 20px; color: #5a564d; margin-top: 4px; letter-spacing: 0.04em; }
.hdr-profile {
  position: absolute;
  top: -10px;
  right: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2f7d4a;
  background: #dff0e4;
  padding: 6px 14px;
  border-radius: 999px;
  letter-spacing: 0;
}

.kpi {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.kpi-cell {
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 16px;
  padding: 28px 24px 22px;
  text-align: left;
  position: relative;
}
.kpi-cell.strong {
  background: #1a1a18;
  border-color: #1a1a18;
  color: #fbfaf7;
}
.kpi-cell.strong .kpi-k { color: #b8b4ab; }
.kpi-cell.strong .kpi-u { color: #b8b4ab; }
.kpi-cell.good { background: #dff0e4; border-color: #b8d9c2; }
.kpi-cell.good .kpi-v { color: #1f5733; }
.kpi-cell.warn { background: #fbe9d6; border-color: #e8c79a; }
.kpi-cell.warn .kpi-v { color: #b45309; }
.kpi-cell.ok .kpi-v { color: #2f7d4a; }
.kpi-cell.neutral .kpi-v { color: #1a1a18; }

.kpi-k {
  font-size: 16px;
  font-weight: 600;
  color: #5a564d;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}
.kpi-v {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 78px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
}
.kpi-u {
  font-size: 18px;
  color: #9a948a;
  margin-top: 8px;
  letter-spacing: 0.02em;
}

.band {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.band-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 28px;
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 14px;
}
.band-k {
  font-size: 18px;
  color: #5a564d;
  font-weight: 600;
}
.band-v {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.band-v.ok { color: #2f7d4a; }
.band-v.good { color: #1f5733; }
.band-v.strong { color: #b45309; }
.band-v.warn { color: #b45309; }
.band-v.neutral { color: #1a1a18; }

.block {
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 18px;
  padding: 28px 30px 24px;
}
.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid #ece8df;
  gap: 16px;
}
.block-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.block-meta {
  font-size: 18px;
  color: #5a564d;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  letter-spacing: -0.01em;
  text-align: right;
}
.rows { display: flex; flex-direction: column; gap: 2px; }
.row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.4fr) 110px;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px dashed #f1ede4;
}
.row:last-child { border-bottom: none; }
.row-name {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a18;
  letter-spacing: -0.01em;
}
.row-mid {
  font-size: 17px;
  color: #5a564d;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.row-kcal {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 22px;
  font-weight: 700;
  text-align: right;
  color: #2f7d4a;
}
.row-kcal.warn { color: #b45309; }
.empty {
  padding: 24px 0;
  text-align: center;
  color: #9a948a;
  font-size: 18px;
}

.ftr {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 28px;
}
.ftr-line { width: 80px; height: 2px; background: #1a1a18; }
.ftr-text {
  font-size: 18px;
  color: #5a564d;
  letter-spacing: 0.04em;
  font-weight: 500;
}
</style>
