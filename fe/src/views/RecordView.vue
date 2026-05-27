<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { useLogStore } from '@/stores/log'
import DailySummary from '@/components/DailySummary.vue'
import WorkoutTab from '@/views/tabs/WorkoutTab.vue'
import MealTab from '@/views/tabs/MealTab.vue'
import BodyTab from '@/views/tabs/BodyTab.vue'

type TabKey = 'workout' | 'meal' | 'body'
const tab = useLocalStorage<TabKey>('wt.recordTab', 'workout')

const log = useLogStore()
const { selectedDate } = storeToRefs(log)

const tabs: { key: TabKey; label: string }[] = [
  { key: 'workout', label: '운동' },
  { key: 'meal', label: '식단' },
  { key: 'body', label: '신체' },
]
</script>

<template>
  <div class="record">
    <div class="record-head">
      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>
      <input class="date-input" type="date" v-model="selectedDate" />
    </div>

    <DailySummary />

    <div class="tab-body">
      <WorkoutTab v-if="tab === 'workout'" />
      <MealTab v-else-if="tab === 'meal'" />
      <BodyTab v-else-if="tab === 'body'" />
    </div>
  </div>
</template>

<style scoped>
.record { display: grid; gap: 12px; }
.record-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.tabs {
  display: inline-flex; gap: 2px; padding: 3px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}
.tab {
  padding: 6px 16px;
  font-size: var(--fs-sm); font-weight: 500;
  color: var(--c-text-soft);
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}
.tab:hover { color: var(--c-text); }
.tab.active {
  background: var(--c-surface);
  color: var(--c-accent-ink);
  box-shadow: var(--shadow-xs);
}
.date-input {
  height: 32px; padding: 0 10px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  font-size: var(--fs-md);
  font-family: var(--font-num);
}
.date-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); outline: none; }
.tab-body { margin-top: 4px; }
</style>
