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
</script>

<template>
  <section class="wrap">
    <!-- 권장 칼로리 hint -->
    <div v-if="recommendedKcal" class="rec">
      <div class="rec-main">
        <span class="rec-label">하루 권장 섭취</span>
        <span class="rec-value num">{{ recommendedKcal.toLocaleString() }}<span class="rec-unit">kcal</span></span>
        <span class="rec-formula muted small">체중 × 30 추정 (활동 보통)</span>
      </div>
      <div class="rec-progress">
        <div class="rec-bar">
          <div
            class="rec-bar-fill"
            :class="intakeStatus.tone"
            :style="{ width: Math.min(intakeRatio, 130) / 130 * 100 + '%' }"
          ></div>
          <div class="rec-bar-marker" :style="{ left: (100 / 130 * 100) + '%' }" title="권장 100%"></div>
        </div>
        <div class="rec-meta">
          <span class="num">{{ intakeRatio }}%</span>
          <span class="rec-status" :class="intakeStatus.tone">{{ intakeStatus.label }}</span>
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

/* ─── 권장 칼로리 ─── */
.rec {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 16px;
  align-items: center;
  padding: 12px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}
.rec-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rec-label {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
}
.rec-value {
  font-size: var(--fs-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--c-text);
}
.rec-unit {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  margin-left: 4px;
  font-weight: 500;
}
.rec-formula { font-size: 11px; margin-top: 2px; }

.rec-progress { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rec-bar {
  position: relative;
  width: 100%;
  height: 10px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  overflow: hidden;
}
.rec-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.rec-bar-fill.ok { background: var(--c-accent); }
.rec-bar-fill.warn { background: var(--c-warn); }
.rec-bar-fill.over { background: var(--c-danger); }
.rec-bar-fill.neutral { background: var(--c-text-muted); }
.rec-bar-marker {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--c-text-soft);
  border-radius: 1px;
  transform: translateX(-50%);
  pointer-events: none;
}
.rec-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}
.rec-meta .num { font-weight: 600; color: var(--c-text); font-size: var(--fs-sm); }
.rec-status { font-weight: 600; }
.rec-status.ok { color: var(--c-accent-ink); }
.rec-status.warn { color: var(--c-warn); }
.rec-status.over { color: var(--c-danger); }
.rec-status.neutral { color: var(--c-text-muted); }

@media (max-width: 640px) {
  .rec { grid-template-columns: 1fr; gap: 10px; }
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
