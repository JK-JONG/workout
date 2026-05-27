<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'

const log = useLogStore()
const { kcalIn, kcalOut, kcalNet, recommendedKcal, recommendedKcalDetail } = storeToRefs(log)

// 계산식 팝오버
const showFormula = ref(false)
const formulaRef = ref<HTMLElement | null>(null)
function toggleFormula() { showFormula.value = !showFormula.value }
function onDocClick(ev: MouseEvent) {
  if (!showFormula.value) return
  const el = formulaRef.value
  if (el && !el.contains(ev.target as Node)) showFormula.value = false
}
if (typeof document !== 'undefined') {
  document.addEventListener('mousedown', onDocClick)
  onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
}

const activityLabel = computed(() => {
  const a = recommendedKcalDetail.value?.activity ?? 0
  if (a >= 1.7) return '높음'
  if (a >= 1.5) return '보통'
  if (a >= 1.35) return '약간'
  return '낮음'
})

function intensityLabel(kcal: number): string {
  if (kcal === 0) return '없음'
  if (kcal < 100) return '가벼움'
  if (kcal < 250) return '보통'
  if (kcal < 500) return '강함'
  return '매우 강함'
}

const intakeRatio = computed(() => {
  if (!recommendedKcal.value) return 0
  return Math.round((kcalIn.value / recommendedKcal.value) * 100)
})

const intakeStatus = computed<{ label: string; tone: 'ok' | 'warn' | 'over' | 'neutral' }>(() => {
  if (!recommendedKcal.value || kcalIn.value === 0) return { label: '입력 전', tone: 'neutral' }
  const r = intakeRatio.value
  if (r < 60) return { label: '부족', tone: 'warn' }
  if (r <= 110) return { label: '적정', tone: 'ok' }
  if (r <= 130) return { label: '약간 초과', tone: 'warn' }
  return { label: '초과', tone: 'over' }
})

// 원형 차트(r=50) 둘레 = 2πr ≈ 314.159
const RING_CIRC = 2 * Math.PI * 50
const ringDashArray = String(RING_CIRC)
const ringDashOffset = computed(() => {
  const r = Math.min(intakeRatio.value, 100) / 100
  return String(RING_CIRC * (1 - r))
})
const remain = computed(() => recommendedKcal.value - kcalIn.value)
</script>

<template>
  <section class="board" :class="{ 'no-rec': !recommendedKcal }">
    <!-- 좌측: 권장 도넛 (체중 정보가 있을 때만) -->
    <div v-if="recommendedKcal" class="ring-block">
      <div class="ring-wrap">
        <svg
          class="rec-ring"
          viewBox="0 0 120 120"
          :aria-label="`권장 ${recommendedKcal} kcal 중 ${kcalIn} kcal (${intakeRatio}%)`"
        >
          <circle cx="60" cy="60" r="50" class="rec-ring-track" />
          <circle
            cx="60" cy="60" r="50"
            class="rec-ring-fill"
            :class="intakeStatus.tone"
            :stroke-dasharray="ringDashArray"
            :stroke-dashoffset="ringDashOffset"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div class="rec-center" aria-hidden="true">
          <div class="rec-pct num">{{ intakeRatio }}<span class="rec-pct-unit">%</span></div>
          <div class="rec-status-label" :class="intakeStatus.tone">{{ intakeStatus.label }}</div>
        </div>
      </div>
      <div class="ring-meta" ref="formulaRef">
        <div class="rec-label">
          <span>권장 {{ recommendedKcal.toLocaleString() }} kcal</span>
          <button
            type="button"
            class="info-btn"
            @click="toggleFormula"
            :aria-expanded="showFormula"
            aria-label="계산식 보기"
            title="계산식 보기"
          >?</button>
        </div>
        <div class="rec-remain muted small">
          <template v-if="remain > 0">{{ remain.toLocaleString() }} kcal 남음</template>
          <template v-else>{{ Math.abs(remain).toLocaleString() }} kcal 초과</template>
        </div>

        <div v-if="showFormula && recommendedKcalDetail" class="formula-pop" role="dialog">
          <div class="formula-head">
            <span>{{ recommendedKcalDetail.method === 'mifflin' ? 'Mifflin-St Jeor 공식' : '간이 추정 (체중 × 30)' }}</span>
            <button type="button" class="formula-x" @click="showFormula = false" aria-label="닫기">×</button>
          </div>
          <ul v-if="recommendedKcalDetail.method === 'mifflin'" class="formula-list num">
            <li><span>체중</span><b>{{ recommendedKcalDetail.weightKg }} kg</b></li>
            <li><span>신장</span><b>{{ recommendedKcalDetail.heightCm }} cm</b></li>
            <li><span>나이</span><b>{{ recommendedKcalDetail.age }}세</b></li>
            <li><span>성별</span><b>{{ recommendedKcalDetail.sex === 'male' ? '남성' : '여성' }}</b></li>
            <li><span>활동량</span><b>×{{ recommendedKcalDetail.activity?.toFixed(2) }} ({{ activityLabel }})</b></li>
            <li class="formula-eq">
              <span>BMR</span>
              <b>{{ recommendedKcalDetail.bmr?.toLocaleString() }} kcal</b>
            </li>
            <li class="formula-eq strong">
              <span>TDEE</span>
              <b>{{ recommendedKcalDetail.tdee.toLocaleString() }} kcal</b>
            </li>
          </ul>
          <ul v-else class="formula-list num">
            <li><span>체중</span><b>{{ recommendedKcalDetail.weightKg }} kg</b></li>
            <li class="formula-eq strong">
              <span>권장</span>
              <b>{{ recommendedKcalDetail.tdee.toLocaleString() }} kcal</b>
            </li>
          </ul>
          <div class="formula-foot muted small">
            <template v-if="recommendedKcalDetail.method === 'mifflin'">
              BMR(남) = 10·W + 6.25·H − 5·age + 5 / BMR(여) = 10·W + 6.25·H − 5·age − 161 · TDEE = BMR × 활동계수
            </template>
            <template v-else>
              신장·나이·성별을 입력하면 더 정확한 Mifflin-St Jeor 공식으로 계산됩니다.
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 우측: 4칸 stat -->
    <div class="summary">
      <div class="stat">
        <div class="stat-label">섭취</div>
        <div class="stat-value num">{{ kcalIn }}<span class="stat-unit">kcal</span></div>
      </div>
      <div class="stat">
        <div class="stat-label">소모</div>
        <div class="stat-value num accent">{{ kcalOut }}<span class="stat-unit">kcal</span></div>
      </div>
      <div class="stat">
        <div class="stat-label">Net</div>
        <div class="stat-value num" :class="{ warn: kcalNet > 0, accent: kcalNet < 0 }">
          {{ kcalNet > 0 ? '+' : '' }}{{ kcalNet }}<span class="stat-unit">kcal</span>
        </div>
      </div>
      <div class="stat">
        <div class="stat-label">오늘 강도</div>
        <div class="stat-value-text">{{ intensityLabel(kcalOut) }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ─── 한 줄 통합 보드 ─── */
.board {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
  padding: 12px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}
.board.no-rec { grid-template-columns: 1fr; }
@media (max-width: 720px) {
  .board { grid-template-columns: 1fr; gap: 12px; padding: 12px; }
}

.ring-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 14px;
  border-right: 1px solid var(--c-border);
}
@media (max-width: 720px) {
  .ring-block { padding-right: 0; padding-bottom: 12px; border-right: none; border-bottom: 1px solid var(--c-border); }
}
.ring-wrap { position: relative; width: 88px; height: 88px; flex-shrink: 0; }
.ring-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}

.rec-ring {
  width: 88px;
  height: 88px;
  display: block;
}
.rec-ring-track {
  fill: none;
  stroke: var(--c-surface-2);
  stroke-width: 12;
}
.rec-ring-fill {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.45s ease, stroke 0.2s ease;
}
.rec-ring-fill.ok { stroke: var(--c-accent); }
.rec-ring-fill.warn { stroke: var(--c-warn); }
.rec-ring-fill.over { stroke: var(--c-danger); }
.rec-ring-fill.neutral { stroke: var(--c-text-muted); }

.rec-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.rec-pct {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--c-text);
}
.rec-pct-unit {
  font-size: 10px;
  color: var(--c-text-muted);
  margin-left: 1px;
  font-weight: 600;
}
.rec-status-label {
  margin-top: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.rec-status-label.ok { color: var(--c-accent-ink); }
.rec-status-label.warn { color: var(--c-warn); }
.rec-status-label.over { color: var(--c-danger); }
.rec-status-label.neutral { color: var(--c-text-muted); }

.rec-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: -0.005em;
  color: var(--c-text);
  font-family: var(--font-num);
}
.rec-remain { font-size: var(--fs-xs); }

.info-btn {
  width: 18px; height: 18px;
  display: inline-grid; place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--c-text-muted);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border-strong);
  border-radius: 50%;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  font-family: var(--font-sans);
}
.info-btn:hover {
  background: var(--c-accent);
  color: #fff;
  border-color: var(--c-accent);
}

.ring-meta { position: relative; }
.formula-pop {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 280px;
  padding: 12px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 32px -8px rgba(20,18,12,0.2), 0 4px 8px rgba(20,18,12,0.08);
  animation: fp-pop 0.15s ease-out;
}
@keyframes fp-pop {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.formula-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--c-border);
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-text);
}
.formula-x {
  width: 22px; height: 22px;
  display: inline-grid; place-items: center;
  font-size: 16px;
  color: var(--c-text-muted);
  border-radius: 50%;
  transition: background 0.15s, color 0.15s;
}
.formula-x:hover { background: var(--c-surface-2); color: var(--c-text); }
.formula-list {
  display: grid;
  gap: 6px;
  font-size: var(--fs-xs);
}
.formula-list li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: var(--c-text-soft);
}
.formula-list li b { color: var(--c-text); font-weight: 600; }
.formula-list li.formula-eq {
  padding-top: 6px;
  border-top: 1px dashed var(--c-border);
  margin-top: 2px;
  font-size: var(--fs-sm);
}
.formula-list li.formula-eq.strong b {
  color: var(--c-accent);
  font-weight: 700;
  font-size: var(--fs-md);
}
.formula-foot {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--c-border);
  font-size: 10px;
  line-height: 1.5;
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  align-self: stretch;
}
.stat {
  padding: 4px 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-left: 1px solid var(--c-border);
  min-width: 0;
}
.stat:first-child { border-left: none; padding-left: 4px; }
.stat-label {
  font-size: 10px;
  color: var(--c-text-muted);
  margin-bottom: 4px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
}
.stat-value {
  font-size: var(--fs-2xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.1;
}
.stat-value-text { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); }
.stat-unit { font-size: 10px; color: var(--c-text-muted); margin-left: 3px; font-weight: 500; }
.accent { color: var(--c-accent); }
.warn { color: var(--c-warn); }

@media (max-width: 720px) {
  .summary { grid-template-columns: repeat(4, 1fr); }
  .stat { padding: 4px 10px; }
}
@media (max-width: 520px) {
  .summary { grid-template-columns: repeat(2, 1fr); gap: 0; }
  .stat { padding: 8px 10px; border-left: 1px solid var(--c-border); border-top: 1px solid var(--c-border); }
  .stat:nth-child(2n+1) { border-left: none; }
  .stat:nth-child(-n+2) { border-top: none; }
}
</style>
