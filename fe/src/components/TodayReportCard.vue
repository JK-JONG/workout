<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, resolveSlot, displayName, type MealEntry } from '@/stores/log'
import { useProfileStore } from '@/stores/profile'
import type { Slot } from '@/data/mealPresets'

const log = useLogStore()
const profile = useProfileStore()
const {
  selectedDate, workoutsOfDate, mealsOfDate,
  kcalIn, kcalOut, kcalNet,
  recommendedKcal, recommendedKcalDetail,
} = storeToRefs(log)
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
  const rec = recommendedKcal.value
  if (kcalIn.value === 0 && kcalOut.value === 0) return { label: '기록 없음', tone: 'neutral', rule: '입력 없음' }
  // 권장 칼로리 정보가 있으면 권장 대비로 평가 (더 정확)
  if (rec > 0) {
    const diff = kcalIn.value - rec
    if (diff <= -300) return { label: '감량 페이스', tone: 'good',    rule: `섭취 ≤ 권장 − 300` }
    if (diff < 0)     return { label: '잘 지킴',     tone: 'ok',      rule: `섭취 < 권장` }
    if (diff <= 200)  return { label: '유지',        tone: 'neutral', rule: `권장 ± 200` }
    if (diff <= 500)  return { label: '약간 초과',   tone: 'warn',    rule: `권장 + 200~500` }
    return              { label: '초과',             tone: 'warn',    rule: `권장 + 500 초과` }
  }
  // 권장 정보가 없으면 NET 절대값으로 fallback
  if (n <= -300) return { label: '감량 페이스', tone: 'good',    rule: 'NET ≤ −300' }
  if (n < 0)     return { label: '소모 우위',   tone: 'ok',      rule: '−300 < NET < 0' }
  if (n <= 200)  return { label: '유지',        tone: 'neutral', rule: '0 ≤ NET ≤ 200' }
  if (n <= 500)  return { label: '약간 초과',   tone: 'warn',    rule: '200 < NET ≤ 500' }
  return         { label: '초과',               tone: 'warn',    rule: 'NET > 500' }
})

// 평가 코멘트 — 사용자가 왜 그런 평가가 나왔는지 한눈에 보게
const comment = computed(() => {
  const lines: string[] = []
  // 강도
  if (kcalOut.value > 0) {
    lines.push(`운동 소모 ${kcalOut.value} kcal → 강도 "${intensity.value.label}" (${intensity.value.rule})`)
  }
  // 권장 대비 (가장 중요한 평가 기준)
  if (recommendedKcal.value > 0 && kcalIn.value > 0) {
    const diff = kcalIn.value - recommendedKcal.value
    const ratio = Math.round((kcalIn.value / recommendedKcal.value) * 100)
    if (diff > 0) {
      lines.push(`섭취 ${kcalIn.value} kcal · 권장 ${recommendedKcal.value} 대비 +${diff} kcal (${ratio}%)`)
    } else if (diff < 0) {
      lines.push(`섭취 ${kcalIn.value} kcal · 권장 ${recommendedKcal.value} 대비 ${diff} kcal (${ratio}%) — 잘 지키는 중`)
    } else {
      lines.push(`섭취 ${kcalIn.value} kcal · 권장 ${recommendedKcal.value} 정확히 도달 (100%)`)
    }
  }
  // 운동 효과 (NET 의미)
  if (kcalIn.value > 0 || kcalOut.value > 0) {
    const sign = kcalNet.value >= 0 ? '+' : ''
    lines.push(`섭취 ${kcalIn.value} − 소모 ${kcalOut.value} = NET ${sign}${kcalNet.value} kcal → "${balance.value.label}"`)
  }
  return lines
})

const calcMethodLabel = computed(() => {
  const d = recommendedKcalDetail.value
  if (!d) return '입력 전'
  if (d.method === 'mifflin') {
    return `Mifflin-St Jeor · ${d.weightKg}kg / ${d.heightCm}cm / ${d.age}세 / ${d.sex === 'male' ? '남' : '여'} · 활동×${d.activity?.toFixed(2)}`
  }
  return `간이 추정 (체중 × 30 = ${d.tdee} kcal)`
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

// 도넛 차트 (섭취 % of 권장)
const RING_CIRC = 2 * Math.PI * 44
const intakeRatio = computed(() => {
  if (!recommendedKcal.value) return 0
  return Math.round((kcalIn.value / recommendedKcal.value) * 100)
})
const ringOffset = computed(() => {
  const r = Math.min(intakeRatio.value, 100) / 100
  return RING_CIRC * (1 - r)
})
</script>

<template>
  <article class="report">
    <!-- 헤더 -->
    <header class="hdr">
      <div class="hdr-left">
        <div class="brand">
          <span class="brand-dot"></span>
          <span class="brand-text">WORKOUT TRACKER</span>
        </div>
        <h1 class="label">오늘의 운동 평가서</h1>
        <div class="hdr-sub">기록은 거짓말하지 않는다</div>
      </div>
      <div class="hdr-right">
        <div class="date-ymd">{{ dateLabel.ymd }}</div>
        <div class="date-wd">{{ dateLabel.wd }}</div>
        <div v-if="activeProfile" class="hdr-profile">{{ activeProfile }}</div>
      </div>
    </header>

    <!-- KPI 메인 — 도넛 + 핵심 숫자 -->
    <section class="hero">
      <div class="hero-ring">
        <svg viewBox="0 0 120 120" class="ring-svg" v-if="recommendedKcal > 0">
          <circle cx="60" cy="60" r="44" class="ring-track" />
          <circle
            cx="60" cy="60" r="44"
            class="ring-fill"
            :class="balance.tone"
            :stroke-dasharray="RING_CIRC"
            :stroke-dashoffset="ringOffset"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div v-else class="ring-empty">
          <span class="ring-empty-icon">🔥</span>
        </div>
        <div v-if="recommendedKcal > 0" class="ring-center">
          <div class="ring-pct num">{{ intakeRatio }}<span class="ring-pct-unit">%</span></div>
          <div class="ring-cap">권장 대비</div>
        </div>
      </div>
      <div class="hero-grid">
        <div class="hero-cell">
          <div class="hero-k">섭취</div>
          <div class="hero-v num">{{ kcalIn.toLocaleString() }}</div>
          <div class="hero-u">kcal</div>
        </div>
        <div class="hero-cell strong">
          <div class="hero-k">소모</div>
          <div class="hero-v num">{{ kcalOut.toLocaleString() }}</div>
          <div class="hero-u">kcal</div>
        </div>
        <div class="hero-cell" :class="balance.tone">
          <div class="hero-k">NET</div>
          <div class="hero-v num">{{ kcalNet > 0 ? '+' : '' }}{{ kcalNet.toLocaleString() }}</div>
          <div class="hero-u">kcal</div>
        </div>
      </div>
    </section>

    <!-- 평가 뱃지 + 코멘트 -->
    <section class="verdict">
      <div class="badges">
        <div class="badge">
          <div class="badge-k">운동 강도</div>
          <div class="badge-v" :class="intensity.tone">{{ intensity.label }}</div>
          <div class="badge-rule">{{ intensity.rule }}</div>
        </div>
        <div class="badge">
          <div class="badge-k">밸런스</div>
          <div class="badge-v" :class="balance.tone">{{ balance.label }}</div>
          <div class="badge-rule">{{ balance.rule }}</div>
        </div>
        <div v-if="recommendedKcal" class="badge">
          <div class="badge-k">권장 섭취</div>
          <div class="badge-v num">{{ recommendedKcal.toLocaleString() }} <span class="badge-v-u">kcal</span></div>
          <div class="badge-rule">{{ calcMethodLabel }}</div>
        </div>
      </div>
      <div v-if="comment.length" class="comment">
        <div class="comment-title">평가 코멘트</div>
        <ul class="comment-list">
          <li v-for="(line, i) in comment" :key="i">{{ line }}</li>
        </ul>
      </div>
    </section>

    <!-- 운동 -->
    <section class="block">
      <div class="block-head">
        <div class="block-title">
          <span class="block-icon">🏋️</span>
          <span>운동</span>
        </div>
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
        <div class="block-title">
          <span class="block-icon">🍱</span>
          <span>식단</span>
        </div>
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
      <div class="ftr-text">잘 했어. 내일도 한 줄 더 쌓자.</div>
    </footer>
  </article>
</template>

<style scoped>
.report {
  width: 1080px;
  padding: 56px 56px 48px;
  background:
    radial-gradient(circle at 0% 0%, rgba(47, 125, 74, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, rgba(180, 83, 9, 0.04) 0%, transparent 50%),
    linear-gradient(180deg, #fcfbf8 0%, #ece8df 100%);
  color: #1a1a18;
  font-family: 'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif;
  letter-spacing: -0.01em;
  display: flex;
  flex-direction: column;
  gap: 26px;
  box-sizing: border-box;
}

/* ─── 헤더 ─── */
.hdr {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 12px;
  padding-bottom: 22px;
  position: relative;
}
.hdr::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, #1a1a18 0%, #1a1a18 40%, transparent 100%);
}
.hdr-left { display: flex; flex-direction: column; gap: 8px; }
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.brand-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #2f7d4a;
  box-shadow: 0 0 0 3px #dff0e4;
}
.brand-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  letter-spacing: 0.22em;
  color: #5a564d;
  font-weight: 600;
}
.label {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #1a1a18;
  line-height: 1.05;
}
.hdr-sub {
  font-size: 14px;
  color: #9a948a;
  font-style: italic;
  letter-spacing: 0;
}
.hdr-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.date-ymd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 28px;
  font-weight: 700;
  color: #1a1a18;
  letter-spacing: -0.02em;
  line-height: 1;
}
.date-wd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  color: #5a564d;
  letter-spacing: 0.05em;
}
.hdr-profile {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #2f7d4a, #1f5733);
  padding: 5px 12px;
  border-radius: 999px;
  box-shadow: 0 1px 3px rgba(31, 87, 51, 0.25);
}

/* ─── HERO: 도넛 + 3 KPI ─── */
.hero {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 24px;
  align-items: center;
  padding: 24px 28px;
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(20,18,12,0.04);
  position: relative;
  overflow: hidden;
}
.hero-ring {
  position: relative;
  width: 200px;
  height: 200px;
  display: grid;
  place-items: center;
}
.ring-svg { width: 200px; height: 200px; }
.ring-track {
  fill: none;
  stroke: #ece8df;
  stroke-width: 12;
}
.ring-fill {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
}
.ring-fill.ok { stroke: #2f7d4a; }
.ring-fill.good { stroke: #1f5733; }
.ring-fill.strong { stroke: #b45309; }
.ring-fill.warn { stroke: #d97706; }
.ring-fill.neutral { stroke: #2f7d4a; }
.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.ring-pct {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 48px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  color: #1a1a18;
}
.ring-pct-unit {
  font-size: 20px;
  color: #5a564d;
  margin-left: 2px;
  font-weight: 700;
}
.ring-cap {
  margin-top: 6px;
  font-size: 11px;
  color: #5a564d;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}
.ring-empty {
  width: 200px;
  height: 200px;
  display: grid;
  place-items: center;
  background: #fbfaf7;
  border: 2px dashed #d9d3c4;
  border-radius: 50%;
}
.ring-empty-icon { font-size: 56px; opacity: 0.3; }

.hero-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.hero-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 12px;
  position: relative;
}
.hero-cell.strong {
  background: #fbfaf7;
  border-color: #d9d3c4;
  border-left: 4px solid #2f7d4a;
}
.hero-cell.strong .hero-v { color: #1f5733; }
.hero-cell.good .hero-v { color: #1f5733; }
.hero-cell.warn { border-left: 4px solid #d97706; }
.hero-cell.warn .hero-v { color: #d97706; }
.hero-cell.ok .hero-v { color: #2f7d4a; }
.hero-cell.neutral .hero-v { color: #1a1a18; }

.hero-k {
  font-size: 13px;
  color: #5a564d;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}
.hero-v {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 38px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.hero-u {
  font-size: 13px;
  color: #9a948a;
  font-weight: 500;
}

/* ─── 평가 뱃지 + 코멘트 ─── */
.verdict {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.badges {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.badge {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}
.badge-k {
  font-size: 11px;
  color: #5a564d;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}
.badge-v {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.badge-v-u {
  font-family: 'Pretendard', sans-serif;
  font-size: 12px;
  color: #9a948a;
  margin-left: 2px;
  font-weight: 500;
}
.badge-v.ok { color: #2f7d4a; }
.badge-v.good { color: #1f5733; }
.badge-v.strong { color: #b45309; }
.badge-v.warn { color: #b45309; }
.badge-v.neutral { color: #1a1a18; }
.badge-rule {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: #9a948a;
  padding: 3px 8px;
  background: #fbfaf7;
  border-radius: 999px;
  letter-spacing: 0;
  white-space: nowrap;
  align-self: flex-start;
  border: 1px solid #ece8df;
}

.comment {
  padding: 14px 18px;
  background: linear-gradient(135deg, #fbfaf7 0%, #f6f3eb 100%);
  border: 1px solid #ece8df;
  border-radius: 12px;
  border-left: 4px solid #2f7d4a;
}
.comment-title {
  font-size: 11px;
  color: #2f7d4a;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 8px;
}
.comment-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.comment-list li {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  color: #1a1a18;
  letter-spacing: -0.01em;
  line-height: 1.5;
}
.comment-list li::before {
  content: '› ';
  color: #2f7d4a;
  font-weight: 700;
}

/* ─── 블록 (운동·식단) ─── */
.block {
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 14px;
  padding: 22px 24px 20px;
  box-shadow: 0 1px 2px rgba(20,18,12,0.04);
}
.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ece8df;
  gap: 14px;
}
.block-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.block-icon { font-size: 22px; line-height: 1; }
.block-meta {
  font-size: 13px;
  color: #5a564d;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  text-align: right;
}

.rows { display: flex; flex-direction: column; gap: 2px; }
.row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.4fr) 100px;
  align-items: center;
  gap: 14px;
  padding: 11px 6px;
  border-bottom: 1px dashed #f1ede4;
}
.row:last-child { border-bottom: none; }
.row-name { font-size: 18px; font-weight: 600; color: #1a1a18; }
.row-mid {
  font-size: 15px;
  color: #5a564d;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.row-kcal {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 19px;
  font-weight: 700;
  text-align: right;
  color: #2f7d4a;
}

.empty {
  padding: 22px 0;
  text-align: center;
  color: #9a948a;
  font-size: 14px;
}

/* ─── 식단 4칸 ─── */
.meal-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
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
.meal-col.filled {
  background: #ffffff;
  border-color: #d9d3c4;
  box-shadow: 0 1px 2px rgba(20,18,12,0.03);
}
.meal-col-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #ece8df;
}
.meal-col-name {
  font-size: 15px;
  font-weight: 800;
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
  font-weight: 700;
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
  padding-top: 16px;
}
.ftr-line {
  width: 56px;
  height: 3px;
  background: #2f7d4a;
  border-radius: 3px;
}
.ftr-text {
  font-size: 14px;
  color: #5a564d;
  letter-spacing: 0.02em;
  font-weight: 600;
}
</style>
