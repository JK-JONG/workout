<script setup lang="ts">
import { computed } from 'vue'

interface LegendItem { label: string; range: string }

const props = withDefaults(defineProps<{
  data: Map<string, number>       // 'YYYY-MM-DD' → value
  weeks?: number                   // 표시할 주 수 (기본 26 = 약 6개월)
  max?: number                     // 색상 스케일 상한
  unit?: string                    // 툴팁 단위
  colors?: string[]                // 5단계 색상
  legendItems?: LegendItem[]       // 5단계 라벨 + 기준 (없으면 간단 적음/많음)
}>(), {
  weeks: 26,
  max: 500,
  unit: 'kcal',
  colors: () => ['#ebedf0', '#c8e6c9', '#9be9a8', '#40c463', '#216e39'],
  legendItems: () => [],
})

const emit = defineEmits<{
  hover: [
    cell: { date: string; value: number; future: boolean } | null,
    rect: { top: number; left: number; width: number; height: number } | null,
  ]
}>()

function onEnter(ev: MouseEvent, cell: { date: string; value: number; future: boolean }) {
  const t = ev.currentTarget as HTMLElement
  const r = t.getBoundingClientRect()
  emit('hover', cell, { top: r.top, left: r.left, width: r.width, height: r.height })
}
function onLeave() {
  emit('hover', null, null)
}

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// 오늘부터 weeks*7일 전까지. 그리드는 가장 오래된 일요일부터 시작.
const grid = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // 마지막 컬럼의 토요일까지 채워서 정렬되게
  const end = new Date(today)
  const daysToSat = 6 - end.getDay()    // 일=0 ... 토=6
  end.setDate(end.getDate() + daysToSat)
  const start = new Date(end)
  start.setDate(end.getDate() - props.weeks * 7 + 1)

  const cells: Array<{ date: string; weekday: number; value: number; future: boolean; monthLabel?: string }> = []
  let lastMonth = -1
  for (let i = 0; i < props.weeks * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = fmt(d)
    const value = props.data.get(key) ?? 0
    const future = d.getTime() > today.getTime()
    // 새 주(일요일)이고 새 달이면 월 라벨
    let monthLabel: string | undefined
    if (d.getDay() === 0 && d.getMonth() !== lastMonth) {
      monthLabel = `${d.getMonth() + 1}월`
      lastMonth = d.getMonth()
    }
    cells.push({ date: key, weekday: d.getDay(), value, future, monthLabel })
  }
  return cells
})

function levelOf(value: number): number {
  if (value === 0) return 0
  const r = value / props.max
  if (r < 0.25) return 1
  if (r < 0.5) return 2
  if (r < 0.75) return 3
  return 4
}

// 컬럼별 월 라벨 (일요일 셀에 잡혀있는 라벨)
const monthLabels = computed(() => {
  const labels: Array<{ col: number; label: string }> = []
  for (let col = 0; col < props.weeks; col++) {
    const sunday = grid.value[col * 7]
    if (sunday?.monthLabel) labels.push({ col, label: sunday.monthLabel })
  }
  return labels
})
</script>

<template>
  <div class="mh">
    <!-- 월 라벨 -->
    <div class="mh-months" :style="{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }">
      <span v-for="col in weeks" :key="col" class="mh-month-cell">
        <template v-for="m in monthLabels" :key="m.col">
          <template v-if="m.col === col - 1">{{ m.label }}</template>
        </template>
      </span>
    </div>

    <div class="mh-body">
      <!-- 그리드: 컬럼 = 주, 셀 = 일 -->
      <div class="mh-grid" :style="{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }">
        <div v-for="col in weeks" :key="col" class="mh-col">
          <div
            v-for="row in 7"
            :key="row"
            class="mh-cell"
            :class="{ future: grid[(col - 1) * 7 + (row - 1)].future }"
            :style="{ background: grid[(col - 1) * 7 + (row - 1)].future ? 'transparent' : colors[levelOf(grid[(col - 1) * 7 + (row - 1)].value)] }"
            :title="`${grid[(col - 1) * 7 + (row - 1)].date} · ${grid[(col - 1) * 7 + (row - 1)].value} ${unit}`"
            @mouseenter="onEnter($event, grid[(col - 1) * 7 + (row - 1)])"
            @mouseleave="onLeave"
          ></div>
        </div>
      </div>
    </div>

    <!-- 레전드: 기준 있으면 5단계 펼침, 없으면 간단 적음/많음 -->
    <div v-if="legendItems.length === colors.length" class="mh-legend-detail">
      <div
        v-for="(item, i) in legendItems"
        :key="i"
        class="mh-leg-item"
      >
        <span class="mh-leg-swatch" :style="{ background: colors[i] }"></span>
        <span class="mh-leg-label">{{ item.label }}</span>
        <span class="mh-leg-range">{{ item.range }}</span>
      </div>
    </div>
    <div v-else class="mh-legend">
      <span>적음</span>
      <span v-for="c in colors" :key="c" class="mh-legend-cell" :style="{ background: c }"></span>
      <span>많음</span>
    </div>
  </div>
</template>

<style scoped>
.mh { display: flex; flex-direction: column; gap: 4px; font-family: var(--font-num); }

.mh-months {
  display: grid;
  font-size: 9px;
  color: var(--c-text-muted);
  letter-spacing: -0.02em;
}
.mh-month-cell { text-align: left; }

.mh-body { display: flex; gap: 4px; }

.mh-grid { flex: 1; display: grid; gap: 2px; }
.mh-col { display: grid; grid-template-rows: repeat(7, 1fr); gap: 2px; }
.mh-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.03);
  transition: transform 0.1s;
  min-height: 10px;
}
.mh-cell:hover { transform: scale(1.4); border-color: var(--c-text-soft); z-index: 2; position: relative; }
.mh-cell.future { border: 1px dashed var(--c-border); }

.mh-legend-detail {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-top: 6px;
}
.mh-leg-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 4px 6px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  min-width: 0;
}
.mh-leg-swatch {
  width: 12px; height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.mh-leg-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.005em;
  font-family: var(--font-sans);
  line-height: 1.2;
}
.mh-leg-range {
  font-size: 9px;
  color: var(--c-text-muted);
  letter-spacing: -0.01em;
  font-family: var(--font-num);
  line-height: 1.2;
}
@media (max-width: 540px) {
  .mh-legend-detail { grid-template-columns: repeat(2, 1fr); }
}

.mh-legend {
  display: flex; align-items: center; gap: 3px;
  justify-content: flex-end;
  font-size: 10px; color: var(--c-text-muted);
  margin-top: 2px;
}
.mh-legend-cell { width: 9px; height: 9px; border-radius: 2px; }
</style>
