<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { useLogStore } from '@/stores/log'
import { useProfileStore } from '@/stores/profile'
import DailySummary from '@/components/DailySummary.vue'
import TodayReportCard from '@/components/TodayReportCard.vue'
import BodyOnboardingForm from '@/components/BodyOnboardingForm.vue'
import WorkoutTab from '@/views/tabs/WorkoutTab.vue'
import MealTab from '@/views/tabs/MealTab.vue'
import BodyTab from '@/views/tabs/BodyTab.vue'

type TabKey = 'workout' | 'meal' | 'body'
const tab = useLocalStorage<TabKey>('wt.recordTab', 'workout')

const log = useLogStore()
const profile = useProfileStore()
const { selectedDate, body } = storeToRefs(log)
const { activeProfile } = storeToRefs(profile)

// ── 신체 정보 진입 모달 + 오늘 체중 캐리오버 ──
const showBodyModal = ref(false)
const skippedBodyModal = useLocalStorage<string>('wt.bodyModalSkipped', '') // 프로필명 저장 — 다음 진입 시 안 띄움
const lastCarryAt = useLocalStorage<string>('wt.bodyCarryAt', '')

function todayStr() { return new Date().toISOString().slice(0, 10) }

function maybeShowOrCarry() {
  if (!activeProfile.value) return
  if (body.value.length === 0) {
    if (skippedBodyModal.value !== activeProfile.value) {
      showBodyModal.value = true
    }
    return
  }
  // 신체 기록이 있을 때 → 오늘 날짜로 캐리오버 (하루에 한 번만)
  const today = todayStr()
  const carryKey = `${activeProfile.value}::${today}`
  if (lastCarryAt.value !== carryKey) {
    log.carryoverBodyTo(today)
    lastCarryAt.value = carryKey
  }
}

onMounted(maybeShowOrCarry)
watch(activeProfile, () => {
  showBodyModal.value = false
  maybeShowOrCarry()
})

function onBodyDone() {
  showBodyModal.value = false
  skippedBodyModal.value = ''
}
function onBodySkip() {
  showBodyModal.value = false
  skippedBodyModal.value = activeProfile.value
}

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'workout', label: '운동', icon: '🏋️' },
  { key: 'meal', label: '식단', icon: '🍱' },
  { key: 'body', label: '신체', icon: '📏' },
]

function switchTab(key: TabKey) {
  if (tab.value !== key) tab.value = key
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const reportRef = ref<HTMLElement | null>(null)
const reportMounted = ref(false)
const exporting = ref(false)

async function exportReport() {
  if (exporting.value) return
  exporting.value = true
  try {
    reportMounted.value = true
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    const el = reportRef.value?.firstElementChild as HTMLElement | null
    if (!el) return
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#f7f6f3',
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `workout-report_${activeProfile.value || 'me'}_${selectedDate.value}.png`
    a.click()
  } catch (e) {
    console.error('[exportReport] failed:', e)
    alert('이미지 생성 실패. 브라우저 콘솔을 확인해주세요.')
  } finally {
    reportMounted.value = false
    exporting.value = false
  }
}
</script>

<template>
  <div class="record">
    <!-- 좌측 사이드 탭 (sticky) -->
    <aside class="side-tabs" aria-label="기록 카테고리">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="side-tab"
        :class="{ active: tab === t.key }"
        @click="switchTab(t.key)"
      >
        <span class="side-tab-icon" aria-hidden="true">{{ t.icon }}</span>
        <span class="side-tab-label">{{ t.label }}</span>
        <span v-if="tab === t.key" class="side-tab-bar" aria-hidden="true"></span>
      </button>
    </aside>

    <!-- 메인 컨텐츠 -->
    <div class="record-main">
      <div class="record-head">
        <div class="record-head-title">
          <span class="record-head-icon" aria-hidden="true">{{ tabs.find(t => t.key === tab)?.icon }}</span>
          <span>{{ tabs.find(t => t.key === tab)?.label }}</span>
        </div>
        <div class="record-head-right">
          <button class="btn-export" :disabled="exporting" @click="exportReport">
            {{ exporting ? '생성 중…' : '🖼 평가서 이미지' }}
          </button>
          <input class="date-input" type="date" v-model="selectedDate" />
        </div>
      </div>

      <DailySummary />

      <div class="tab-body">
        <WorkoutTab v-if="tab === 'workout'" />
        <MealTab v-else-if="tab === 'meal'" />
        <BodyTab v-else-if="tab === 'body'" />
      </div>
    </div>

    <div ref="reportRef" class="report-host" aria-hidden="true">
      <TodayReportCard v-if="reportMounted" />
    </div>

    <!-- 첫 진입 신체 정보 모달 -->
    <div v-if="showBodyModal" class="modal-backdrop" @click.self="onBodySkip">
      <div class="modal" role="dialog" aria-labelledby="body-modal-title">
        <div class="modal-head">
          <div>
            <div id="body-modal-title" class="modal-title">신체 정보 입력</div>
            <div class="modal-sub muted">
              <b>{{ activeProfile }}</b> 님의 시작 신체 정보를 기록해두면 운동 칼로리·추이 그래프가 더 정확해집니다.
            </div>
          </div>
          <button class="modal-x" @click="onBodySkip" aria-label="닫기">×</button>
        </div>
        <BodyOnboardingForm
          submit-label="저장"
          skip-label="나중에"
          :show-skip="true"
          @done="onBodyDone"
          @skip="onBodySkip"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.record {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
.record-main { display: grid; gap: 12px; min-width: 0; }

/* ─── 좌측 sticky 사이드 탭 ─── */
.side-tabs {
  position: sticky;
  top: 64px;
  display: grid;
  gap: 4px;
  padding: 6px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  align-self: start;
}
.side-tab {
  position: relative;
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--c-text-soft);
  background: transparent;
  border-radius: var(--radius-md);
  text-align: left;
  letter-spacing: -0.005em;
  transition: background 0.15s, color 0.15s;
}
.side-tab:hover { background: var(--c-surface-2); color: var(--c-text); }
.side-tab.active {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  font-weight: 700;
}
.side-tab-icon { font-size: 18px; line-height: 1; text-align: center; }
.side-tab-label { line-height: 1.2; }
.side-tab-bar {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--c-accent);
}

.record-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.record-head-title {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: var(--fs-xl);
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--c-text);
}
.record-head-icon { font-size: 22px; line-height: 1; }

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

.record-head-right { display: inline-flex; align-items: center; gap: 8px; }
.btn-export {
  height: 32px;
  padding: 0 14px;
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #fff;
  background: var(--c-accent);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  transition: background 0.15s, transform 0.05s;
}
.btn-export:hover { background: var(--c-accent-ink); }
.btn-export:active { transform: translateY(1px); }
.btn-export:disabled { opacity: 0.55; cursor: progress; }

.report-host {
  position: fixed;
  left: -10000px;
  top: 0;
  pointer-events: none;
  opacity: 0;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 18, 12, 0.45);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 50;
  animation: fade-in 0.15s ease-out;
}
.modal {
  width: 100%;
  max-width: 420px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 18px 18px 16px;
  display: grid;
  gap: 14px;
}
.modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.modal-title { font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.01em; }
.modal-sub { font-size: var(--fs-sm); line-height: 1.5; margin-top: 4px; }
.modal-x {
  width: 28px; height: 28px;
  font-size: 20px;
  color: var(--c-text-muted);
  border-radius: 50%;
  transition: background 0.15s, color 0.15s;
}
.modal-x:hover { background: var(--c-surface-2); color: var(--c-text); }

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

/* ─── 모바일: 사이드 탭을 상단 가로 sticky 행으로 ─── */
@media (max-width: 720px) {
  .record {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .side-tabs {
    position: sticky;
    top: 52px;
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: var(--radius-md);
    z-index: 20;
  }
  .side-tab {
    flex: 1;
    grid-template-columns: auto auto;
    justify-content: center;
    padding: 9px 8px;
    font-size: var(--fs-sm);
    gap: 6px;
  }
  .side-tab-icon { font-size: 16px; }
  .side-tab-bar {
    left: 10%;
    right: 10%;
    top: auto;
    bottom: 2px;
    width: auto;
    height: 3px;
    border-radius: 3px;
  }
}
</style>
