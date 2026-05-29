<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { useLogStore } from '@/stores/log'

const log = useLogStore()
const { body } = storeToRefs(log)
const router = useRouter()

// 같은 기준: RecordView 의 tab 키.
const recordTab = useLocalStorage<'workout' | 'meal' | 'body'>('wt.recordTab', 'workout')

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const daysSinceLast = computed<number | null>(() => {
  if (!body.value.length) return null
  const dates = body.value.map(b => b.date).sort()
  const last = dates[dates.length - 1]
  const lastDate = new Date(last + 'T00:00:00')
  if (isNaN(lastDate.getTime())) return null
  const today = new Date(ymd(new Date()) + 'T00:00:00')
  return Math.floor((today.getTime() - lastDate.getTime()) / 86400000)
})

// 안내 조건: 기록이 아예 없거나, 가장 최근 기록이 4일 이상 지났을 때.
const show = computed(() => {
  if (!body.value.length) return true
  return (daysSinceLast.value ?? 0) >= 4
})

const message = computed(() => {
  if (!body.value.length) return '신체 기록이 아직 없어요. 지금 한번 적어두면 칼로리·추이가 정확해져요.'
  const d = daysSinceLast.value ?? 0
  return `신체 기록이 ${d}일 동안 없어요. 오늘 한 번 적어두세요.`
})

function goBody() {
  recordTab.value = 'body'
  router.push({ name: 'record' }).catch(() => { /* 이미 같은 라우트면 무시 */ })
}
</script>

<template>
  <div v-if="show" class="banner" role="status">
    <span class="banner-icon" aria-hidden="true">📏</span>
    <span class="banner-text">{{ message }}</span>
    <button type="button" class="banner-btn" @click="goBody">신체 입력하기 →</button>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin: 0 0 12px;
  background: var(--c-accent-soft);
  border: 1px solid color-mix(in srgb, var(--c-accent) 30%, transparent);
  color: var(--c-accent-ink);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: -0.005em;
  animation: slip 0.2s ease-out;
}
.banner-icon { font-size: 18px; line-height: 1; flex: none; }
.banner-text { flex: 1; min-width: 0; }
.banner-btn {
  flex: none;
  padding: 7px 13px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: #fff;
  background: var(--c-accent);
  border-radius: 999px;
  letter-spacing: -0.005em;
  transition: background 0.15s, transform 0.06s;
}
.banner-btn:hover { background: var(--c-accent-ink); }
.banner-btn:active { transform: translateY(1px); }

@keyframes slip {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 560px) {
  .banner { flex-wrap: wrap; }
  .banner-btn { width: 100%; padding: 9px 12px; }
}
</style>
