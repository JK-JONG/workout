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
  <section class="wrap">
    <!-- 권장 칼로리 -->
    <div v-if="recommendedKcal" class="rec">
      <svg
        class="rec-ring"
        viewBox="0 0 120 120"
        :aria-label="`권장 ${recommendedKcal} kcal 중 ${kcalIn} kcal (${intakeRatio}%)`"
      >
        <!-- 트랙 -->
        <circle cx="60" cy="60" r="50" class="rec-ring-track" />
        <!-- 권장(100%) 표시선 — 풀 트랙의 100% 지점이 ring 한바퀴이므로 시각적 가이드는 생략하고 130% 트랙에서 처리 -->
        <!-- 진행률 — 12시 방향에서 시작해서 시계방향으로 -->
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
      <div class="rec-info">
        <div class="rec-label">하루 권장 섭취</div>
        <div class="rec-value num">
          <span class="rec-now">{{ kcalIn.toLocaleString() }}</span>
          <span class="rec-slash">/</span>
          <span class="rec-goal">{{ recommendedKcal.toLocaleString() }}</span>
          <span class="rec-unit">kcal</span>
        </div>
        <div class="rec-remain muted small">
          <template v-if="remain > 0">{{ remain.toLocaleString() }} kcal 남음</template>
          <template v-else>{{ Math.abs(remain).toLocaleString() }} kcal 초과</template>
          <span class="rec-formula"> · 체중 × 30 추정</span>
        </div>
      </div>
    </div>

    <section class="summary">
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
    </section>
  </section>
</template>

<style scoped>
.wrap { display: grid; gap: 10px; }

/* ─── 권장 칼로리 (원형 차트) ─── */
.rec {
  position: relative;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 14px 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}
.rec-ring {
  width: 96px;
  height: 96px;
  display: block;
  grid-column: 1;
  grid-row: 1;
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
  grid-column: 1;
  grid-row: 1;
  width: 96px;
  height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.rec-pct {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--c-text);
}
.rec-pct-unit {
  font-size: 11px;
  color: var(--c-text-muted);
  margin-left: 1px;
  font-weight: 600;
}
.rec-status-label {
  margin-top: 3px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.rec-status-label.ok { color: var(--c-accent-ink); }
.rec-status-label.warn { color: var(--c-warn); }
.rec-status-label.over { color: var(--c-danger); }
.rec-status-label.neutral { color: var(--c-text-muted); }

.rec-info {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.rec-label {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
}
.rec-value {
  font-size: var(--fs-xl);
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.2;
  color: var(--c-text);
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-wrap: wrap;
}
.rec-now { color: var(--c-text); }
.rec-slash { color: var(--c-text-muted); font-weight: 400; }
.rec-goal { color: var(--c-text-soft); }
.rec-unit {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  margin-left: 2px;
  font-weight: 500;
}
.rec-remain { font-size: var(--fs-xs); }
.rec-formula { color: var(--c-text-muted); }

@media (max-width: 480px) {
  .rec { grid-template-columns: 80px minmax(0, 1fr); gap: 14px; padding: 12px; }
  .rec-ring, .rec-center { width: 80px; height: 80px; }
  .rec-pct { font-size: 18px; }
}

.summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.stat {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  box-shadow: var(--shadow-xs);
}
.stat-label {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  margin-bottom: 4px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.stat-value { font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.02em; }
.stat-value-text { font-size: var(--fs-lg); font-weight: 500; color: var(--c-text-soft); }
.stat-unit { font-size: var(--fs-xs); color: var(--c-text-muted); margin-left: 3px; font-weight: 400; }
.accent { color: var(--c-accent); }
.warn { color: var(--c-warn); }

@media (max-width: 600px) {
  .summary { grid-template-columns: repeat(2, 1fr); }
}
</style>
