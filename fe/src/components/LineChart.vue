<script setup lang="ts">
import { computed } from 'vue'

interface Series {
  label: string
  color: string
  points: { x: number; y: number }[]   // x = day index, y = value
}

const props = withDefaults(defineProps<{
  series: Series[]
  unit?: string
  height?: number
  showLegend?: boolean
  xLabels?: { x: number; label: string }[]
}>(), {
  unit: '',
  height: 180,
  showLegend: true,
  xLabels: () => [],
})

const VB_W = 600
const PAD_L = 36
const PAD_R = 10
const PAD_T = 10
const PAD_B = 22

const layout = computed(() => {
  const allPts = props.series.flatMap(s => s.points)
  if (!allPts.length) return null
  const xs = allPts.map(p => p.x)
  const ys = allPts.map(p => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)
  if (yMin === yMax) { yMin -= 1; yMax += 1 }
  const yRange = yMax - yMin
  yMin -= yRange * 0.08
  yMax += yRange * 0.08

  const w = VB_W - PAD_L - PAD_R
  const h = props.height - PAD_T - PAD_B
  const xRange = xMax - xMin || 1

  function tx(x: number) { return PAD_L + ((x - xMin) / xRange) * w }
  function ty(y: number) { return PAD_T + (1 - (y - yMin) / (yMax - yMin)) * h }

  const grid: { y: number; label: string }[] = []
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const v = yMin + (yMax - yMin) * (i / steps)
    grid.push({ y: ty(v), label: v.toFixed(v >= 100 ? 0 : 1) })
  }

  const series = props.series.map(s => {
    const path = s.points.length
      ? s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${tx(p.x).toFixed(1)},${ty(p.y).toFixed(1)}`).join(' ')
      : ''
    return { ...s, path, dots: s.points.map(p => ({ x: tx(p.x), y: ty(p.y), v: p.y })) }
  })

  const xL = props.xLabels.map(l => ({ x: tx(l.x), label: l.label }))

  return { grid, series, xL, yMin, yMax, height: props.height }
})
</script>

<template>
  <div class="lc">
    <svg v-if="layout" :viewBox="`0 0 ${VB_W} ${layout.height}`" class="lc-svg">
      <!-- 그리드 -->
      <g class="lc-grid">
        <line v-for="(g, i) in layout.grid" :key="i" :x1="PAD_L" :x2="VB_W - PAD_R" :y1="g.y" :y2="g.y" />
        <text v-for="(g, i) in layout.grid" :key="'l'+i" :x="PAD_L - 4" :y="g.y" class="lc-y-label">{{ g.label }}</text>
      </g>
      <!-- 라인 + 점 -->
      <g v-for="s in layout.series" :key="s.label">
        <path :d="s.path" :stroke="s.color" fill="none" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
        <circle v-for="(d, i) in s.dots" :key="i" :cx="d.x" :cy="d.y" r="2.3" :fill="s.color" />
      </g>
      <!-- x 라벨 -->
      <g class="lc-x">
        <text v-for="(l, i) in layout.xL" :key="i" :x="l.x" :y="layout.height - 6" class="lc-x-label">{{ l.label }}</text>
      </g>
    </svg>
    <div v-else class="lc-empty">기록이 없습니다.</div>

    <div v-if="showLegend && series.length" class="lc-legend">
      <span v-for="s in series" :key="s.label" class="lc-leg">
        <span class="lc-leg-dot" :style="{ background: s.color }"></span>
        {{ s.label }}<span v-if="unit" class="lc-leg-unit">({{ unit }})</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.lc { display: grid; gap: 4px; }
.lc-svg { width: 100%; height: auto; display: block; max-height: 220px; }
.lc-grid line { stroke: var(--c-border); stroke-width: 0.5; stroke-dasharray: 2 2; }
.lc-y-label {
  font-family: var(--font-num);
  font-size: 11px;
  fill: var(--c-text-muted);
  text-anchor: end;
  dominant-baseline: middle;
}
.lc-x-label {
  font-family: var(--font-num);
  font-size: 11px;
  fill: var(--c-text-muted);
  text-anchor: middle;
}
.lc-empty {
  padding: 24px; text-align: center;
  color: var(--c-text-muted); font-size: var(--fs-sm);
  background: var(--c-surface-2);
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
}
.lc-legend {
  display: flex; gap: 12px; flex-wrap: wrap;
  font-size: var(--fs-xs); color: var(--c-text-soft);
}
.lc-leg { display: inline-flex; align-items: center; gap: 4px; }
.lc-leg-dot { width: 8px; height: 8px; border-radius: 50%; }
.lc-leg-unit { color: var(--c-text-muted); margin-left: 2px; }
</style>
