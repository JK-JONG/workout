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

// 섭취가 권장 칼로리의 몇 %인지를 기준으로 5단계 평가.
// 90% 중심을 "적정"으로 두고 양쪽 끝(많이 부족 / 많이 초과)이 위험.
const balance = computed(() => {
  const rec = recommendedKcal.value
  if (kcalIn.value === 0 && kcalOut.value === 0) return { label: '기록 없음', tone: 'neutral', rule: '입력 없음' }
  if (rec > 0) {
    const pct = (kcalIn.value / rec) * 100
    if (pct < 70)   return { label: '많이 부족', tone: 'warn',    rule: '권장의 < 70%' }
    if (pct < 85)   return { label: '부족',     tone: 'neutral', rule: '권장의 70 ~ 85%' }
    if (pct <= 110) return { label: '적정',     tone: 'ok',      rule: '권장의 85 ~ 110%' }
    if (pct <= 130) return { label: '초과',     tone: 'warn',    rule: '권장의 110 ~ 130%' }
    return            { label: '많이 초과', tone: 'over',    rule: '권장의 > 130%' }
  }
  // 권장 정보가 없으면 평가 보류
  return { label: '평가 보류', tone: 'neutral', rule: '권장 칼로리 미입력' }
})

// 평가 코멘트 — 운동 부각 → 권장 대비 → 종합 결론 (NET 단편 줄 제거)
const comment = computed(() => {
  const lines: string[] = []
  const hasWorkout = kcalOut.value > 0 || workoutsOfDate.value.length > 0
  const hasMeal = kcalIn.value > 0
  const rec = recommendedKcal.value
  const diff = rec > 0 ? kcalIn.value - rec : 0
  const ratio = rec > 0 ? Math.round((kcalIn.value / rec) * 100) : 0

  // 기록 없음
  if (!hasWorkout && !hasMeal) {
    lines.push(`아직 오늘 기록이 없습니다. 운동이나 식단을 입력해 보세요.`)
    return lines
  }

  // 1) 운동 줄 — 결과 부각
  if (hasWorkout) {
    const parts: string[] = []
    if (totalSets.value > 0) parts.push(`${totalSets.value}세트`)
    if (totalVolume.value > 0) parts.push(`볼륨 ${totalVolume.value.toLocaleString()} kg·rep`)
    if (cardioMinutes.value > 0) parts.push(`유산소 ${cardioMinutes.value}분`)
    if (cardioKm.value > 0) parts.push(`${cardioKm.value}km`)
    const detail = parts.length ? ` (${parts.join(' · ')})` : ''
    lines.push(`오늘 운동으로 ${kcalOut.value.toLocaleString()} kcal를 소모했습니다${detail}. 강도는 "${intensity.value.label}".`)
  } else {
    lines.push(`오늘은 아직 운동 기록이 없습니다.`)
  }

  // 2) 식단 + 권장 평가 — 권장 대비 %로 평가
  if (hasMeal && rec > 0) {
    const pct = ratio
    if (pct < 70) {
      lines.push(`섭취는 ${kcalIn.value.toLocaleString()} kcal로 권장(${rec.toLocaleString()})의 ${pct}%에 그쳤습니다. 영양 부족이 우려되니 다음 끼에 더 챙겨드세요.`)
    } else if (pct < 85) {
      lines.push(`섭취는 ${kcalIn.value.toLocaleString()} kcal로 권장(${rec.toLocaleString()})의 ${pct}% 수준입니다. 살짝 부족하지만 감량 중이라면 괜찮은 페이스.`)
    } else if (pct <= 110) {
      lines.push(`섭취는 ${kcalIn.value.toLocaleString()} kcal로 권장(${rec.toLocaleString()})의 ${pct}%. 적정 범위 안에서 잘 챙겨 드셨어요.`)
    } else if (pct <= 130) {
      lines.push(`섭취는 ${kcalIn.value.toLocaleString()} kcal로 권장(${rec.toLocaleString()})의 ${pct}%. 살짝 초과했으니 내일은 조금만 줄여보세요.`)
    } else {
      lines.push(`섭취는 ${kcalIn.value.toLocaleString()} kcal로 권장(${rec.toLocaleString()})의 ${pct}%. 많이 초과했으니 식단 점검이 필요합니다.`)
    }
  } else if (hasMeal) {
    lines.push(`섭취는 ${kcalIn.value.toLocaleString()} kcal. 신체 정보를 입력하면 권장 칼로리 대비 평가도 함께 보여드립니다.`)
  } else {
    lines.push(`오늘은 아직 식단 기록이 없습니다.`)
  }

  // 3) 종합 결론 — 운동 + 식단 조합별로 자연스럽게
  if (hasWorkout && hasMeal && rec > 0) {
    const pct = ratio
    if (pct < 70) {
      lines.push(`운동까지 ${kcalOut.value.toLocaleString()} kcal를 소모해 부담이 큰 하루입니다. 회복을 위해 다음 끼는 든든히 챙기세요.`)
    } else if (pct <= 110) {
      lines.push(`운동도 챙기고 식단도 적정 범위에 있는 균형 잡힌 하루입니다. 잘 했어요.`)
    } else if (pct <= 130) {
      lines.push(`운동 ${kcalOut.value.toLocaleString()} kcal 덕분에 잉여를 어느 정도 상쇄했습니다. 내일은 식단을 살짝만 다잡아 볼까요.`)
    } else {
      lines.push(`운동으로 ${kcalOut.value.toLocaleString()} kcal를 소모했지만 섭취가 많이 초과됐습니다. 내일은 식단을 더 신경 써 보세요.`)
    }
  } else if (hasWorkout && hasMeal) {
    lines.push(`운동과 식단 모두 기록한 하루입니다. 신체 정보를 채우면 권장 대비 분석도 가능합니다.`)
  } else if (hasWorkout && !hasMeal) {
    lines.push(`운동만 기록한 날입니다. 식단도 함께 남기면 권장 대비 분석이 더 정확해져요.`)
  } else if (!hasWorkout && hasMeal && rec > 0) {
    const pct = ratio
    if (pct <= 110) {
      lines.push(`식단을 잘 지킨 하루. 가벼운 운동을 더하면 컨디션이 한층 더 좋아질 거예요.`)
    } else {
      lines.push(`섭취가 다소 많았던 날입니다. 가벼운 유산소나 코어 운동을 추가해 보세요.`)
    }
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

// 도넛 차트 (섭취 % of 권장) — conic-gradient 기반 (html-to-image 호환)
const intakeRatio = computed(() => {
  if (!recommendedKcal.value) return 0
  return Math.round((kcalIn.value / recommendedKcal.value) * 100)
})
const ringClamp = computed(() => Math.min(intakeRatio.value, 100))
const TONE_HEX: Record<string, string> = {
  ok: '#2f7d4a',
  good: '#1f5733',
  warn: '#d97706',
  strong: '#b45309',
  neutral: '#5a564d',
}
const ringColor = computed(() => TONE_HEX[balance.value.tone] ?? '#2f7d4a')
const ringStyle = computed(() => ({
  background: `conic-gradient(${ringColor.value} 0% ${ringClamp.value}%, #ece8df ${ringClamp.value}% 100%)`,
}))
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
        <div v-if="recommendedKcal > 0" class="donut" :style="ringStyle">
          <div class="donut-inner">
            <div class="ring-pct num">{{ intakeRatio }}<span class="ring-pct-unit">%</span></div>
            <div class="ring-cap">권장 대비</div>
          </div>
        </div>
        <div v-else class="ring-empty">
          <span class="ring-empty-icon">🔥</span>
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
          <div v-if="recommendedKcal > 0 || kcalOut > 0" class="hero-cap">
            <template v-if="recommendedKcal > 0">
              vs 권장 {{ recommendedKcal.toLocaleString() }} · {{ intakeRatio }}%
            </template>
            <template v-if="recommendedKcal > 0 && kcalOut > 0"><br></template>
            <span v-if="kcalOut > 0" class="hero-cap-out">운동 소모 −{{ kcalOut.toLocaleString() }} kcal 반영</span>
          </div>
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
.donut {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 50%;
}
.donut-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 156px;
  height: 156px;
  margin: -78px 0 0 -78px;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px #ece8df;
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
.hero-cell.strong .hero-v { color: #1f5733; }
.hero-cell.good .hero-v { color: #1f5733; }
.hero-cell.warn .hero-v { color: #d97706; }
.hero-cell.over .hero-v { color: #b91c1c; }
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
.hero-cap {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #ece8df;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: #5a564d;
  letter-spacing: -0.005em;
  font-weight: 500;
  line-height: 1.6;
}
.hero-cap-out {
  color: #2f7d4a;
  font-weight: 700;
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
.badge-v.over { color: #b91c1c; }
.badge-v.neutral { color: #5a564d; }
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
