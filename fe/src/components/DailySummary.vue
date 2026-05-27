<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'

const log = useLogStore()
const { kcalIn, kcalOut, kcalNet } = storeToRefs(log)

function intensityLabel(kcal: number): string {
  if (kcal === 0) return '없음'
  if (kcal < 100) return '가벼움'
  if (kcal < 250) return '보통'
  if (kcal < 500) return '강함'
  return '매우 강함'
}
</script>

<template>
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
</template>

<style scoped>
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
