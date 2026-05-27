<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'

const log = useLogStore()
const { kcalIn, kcalOut, kcalNet, recommendedKcal } = storeToRefs(log)

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
      <div class="ring-meta">
        <div class="rec-label">권장 {{ recommendedKcal.toLocaleString() }} kcal</div>
        <div class="rec-remain muted small">
          <template v-if="remain > 0">{{ remain.toLocaleString() }} kcal 남음</template>
          <template v-else>{{ Math.abs(remain).toLocaleString() }} kcal 초과</template>
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
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: -0.005em;
  color: var(--c-text);
  font-family: var(--font-num);
}
.rec-remain { font-size: var(--fs-xs); }

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
