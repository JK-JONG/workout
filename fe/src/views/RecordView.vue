<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
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
import TodayView from '@/views/TodayView.vue'

type TabKey = 'workout' | 'meal' | 'body' | 'today'
const tab = useLocalStorage<TabKey>('wt.recordTab', 'workout')

const log = useLogStore()
const profile = useProfileStore()
const { selectedDate, body } = storeToRefs(log)
const { activeProfile } = storeToRefs(profile)

// ── 신체 정보 진입 모달 + 오늘 체중 캐리오버 ──
const showBodyModal = ref(false)
const skippedBodyModal = useLocalStorage<string>('wt.bodyModalSkipped', '') // 프로필명 저장 — 다음 진입 시 안 띄움
const lastCarryAt = useLocalStorage<string>('wt.bodyCarryAt', '')

function ymd(d: Date): string {
  // 로컬 기준 YYYY-MM-DD. toISOString은 UTC 변환으로 KST 자정 → 전날 15시가 되어 날짜가 어긋남.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function todayStr() { return ymd(new Date()) }

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
  { key: 'today', label: '오늘', icon: '👀' },
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

// ── 날짜 네비게이션 ──
const isToday = computed(() => selectedDate.value === todayStr())
const dateLabel = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00')
  if (isNaN(d.getTime())) return selectedDate.value
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day} (${wd})`
})

function shiftDate(days: number) {
  const d = new Date(selectedDate.value + 'T00:00:00')
  if (isNaN(d.getTime())) return
  d.setDate(d.getDate() + days)
  selectedDate.value = ymd(d)
}
function goToday() {
  selectedDate.value = todayStr()
}

// ── 커스텀 달력 popover ──
const showCalendar = ref(false)
const calendarRef = ref<HTMLElement | null>(null)
const viewMonth = ref(new Date())

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface CalCell { date: string; day: number; outside: boolean; today: boolean; selected: boolean; weekday: number }

const calendarCells = computed<CalCell[]>(() => {
  const y = viewMonth.value.getFullYear()
  const m = viewMonth.value.getMonth()
  const first = new Date(y, m, 1)
  const startDow = first.getDay()
  const start = new Date(y, m, 1 - startDow)
  const today = todayStr()
  const cells: CalCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dateStr = ymd(d)
    cells.push({
      date: dateStr,
      day: d.getDate(),
      outside: d.getMonth() !== m,
      today: dateStr === today,
      selected: dateStr === selectedDate.value,
      weekday: d.getDay(),
    })
  }
  return cells
})

const calendarMonthLabel = computed(() => {
  return `${viewMonth.value.getFullYear()}년 ${viewMonth.value.getMonth() + 1}월`
})

function openCalendar() {
  const d = new Date(selectedDate.value + 'T00:00:00')
  viewMonth.value = isNaN(d.getTime()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), 1)
  showCalendar.value = true
}
function closeCalendar() { showCalendar.value = false }
function toggleCalendar() {
  if (showCalendar.value) closeCalendar()
  else openCalendar()
}
function shiftMonth(delta: number) {
  const d = new Date(viewMonth.value)
  d.setMonth(d.getMonth() + delta)
  viewMonth.value = d
}
function pickCell(cell: CalCell) {
  selectedDate.value = cell.date
  closeCalendar()
}

function onDocClick(ev: MouseEvent) {
  if (!showCalendar.value) return
  const el = calendarRef.value
  if (el && !el.contains(ev.target as Node)) closeCalendar()
}

function onKey(ev: KeyboardEvent) {
  // 입력 요소에 포커스가 있을 땐 무시 (값 편집 중)
  const t = ev.target as HTMLElement | null
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
  if (t?.isContentEditable) return
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return
  if (ev.key === 'ArrowLeft') { shiftDate(-1); ev.preventDefault() }
  else if (ev.key === 'ArrowRight') { shiftDate(1); ev.preventDefault() }
  else if (ev.key.toLowerCase() === 't' && !isToday.value) { goToday(); ev.preventDefault() }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('mousedown', onDocClick)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('mousedown', onDocClick)
})

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
            <span class="btn-export-icon" aria-hidden="true">📄</span>
            <span>{{ exporting ? '생성 중…' : '오늘의 평가요약' }}</span>
          </button>

          <div v-if="tab !== 'today'" ref="calendarRef" class="date-picker" :class="{ 'is-today': isToday, 'is-open': showCalendar }">
            <button
              type="button"
              class="date-nav"
              @click="shiftDate(-1)"
              aria-label="이전 날짜"
              title="이전 날짜 (←)"
            >‹</button>
            <button
              type="button"
              class="date-display"
              @click="toggleCalendar"
              :title="selectedDate"
            >
              <span class="date-icon" aria-hidden="true">📅</span>
              <span class="date-text">{{ dateLabel }}</span>
              <span v-if="isToday" class="date-badge">오늘</span>
            </button>
            <button
              type="button"
              class="date-nav"
              @click="shiftDate(1)"
              aria-label="다음 날짜"
              title="다음 날짜 (→)"
            >›</button>
            <button
              type="button"
              class="date-today"
              :disabled="isToday"
              @click="goToday"
              title="오늘로"
            >오늘</button>

            <!-- 커스텀 달력 popover -->
            <div v-if="showCalendar" class="cal-popover" role="dialog" aria-label="날짜 선택">
              <div class="cal-head">
                <button type="button" class="cal-nav" @click="shiftMonth(-1)" aria-label="이전 달">‹</button>
                <div class="cal-month">{{ calendarMonthLabel }}</div>
                <button type="button" class="cal-nav" @click="shiftMonth(1)" aria-label="다음 달">›</button>
              </div>
              <div class="cal-weekdays">
                <span
                  v-for="(w, i) in WEEKDAYS"
                  :key="w"
                  class="cal-weekday"
                  :class="{ sun: i === 0, sat: i === 6 }"
                >{{ w }}</span>
              </div>
              <div class="cal-grid">
                <button
                  v-for="c in calendarCells"
                  :key="c.date"
                  type="button"
                  class="cal-cell"
                  :class="{
                    outside: c.outside,
                    today: c.today,
                    selected: c.selected,
                    sun: c.weekday === 0,
                    sat: c.weekday === 6,
                  }"
                  @click="pickCell(c)"
                >{{ c.day }}</button>
              </div>
              <div class="cal-foot">
                <button type="button" class="cal-foot-btn" @click="goToday(); closeCalendar()">오늘로</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DailySummary v-if="tab !== 'today'" />

      <div class="tab-body">
        <TodayView v-if="tab === 'today'" />
        <WorkoutTab v-else-if="tab === 'workout'" />
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
          :show-skip="false"
          @done="onBodyDone"
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

/* ─── 날짜 선택 ─── */
.date-picker {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 36px;
  padding: 2px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  position: relative;
}
.date-picker.is-today { border-color: var(--c-accent); }
.date-nav {
  width: 28px; height: 30px;
  display: inline-grid; place-items: center;
  font-size: 18px;
  color: var(--c-text-muted);
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}
.date-nav:hover { background: var(--c-surface-2); color: var(--c-text); }
.date-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: transparent;
  color: var(--c-text);
  font-size: var(--fs-md);
  font-weight: 600;
  letter-spacing: -0.005em;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.date-display:hover { background: var(--c-surface-2); }
.date-icon { font-size: 14px; line-height: 1; }
.date-text { font-family: var(--font-num); }
.date-badge {
  margin-left: 4px;
  padding: 2px 7px;
  background: var(--c-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 999px;
  font-family: var(--font-sans);
}
.date-today {
  height: 30px;
  margin-left: 4px;
  padding: 0 12px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-accent-ink);
  background: var(--c-accent-soft);
  border-radius: var(--radius-sm);
  letter-spacing: 0.02em;
  transition: background 0.15s, color 0.15s;
}
.date-today:hover { background: var(--c-accent); color: #fff; }
.date-today:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--c-surface-2);
  color: var(--c-text-muted);
}

/* ─── 커스텀 달력 popover ─── */
.cal-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  width: 304px;
  padding: 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 32px -8px rgba(20,18,12,0.18), 0 4px 8px rgba(20,18,12,0.06);
  animation: cal-pop 0.15s ease-out;
}
@keyframes cal-pop {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.cal-head {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}
.cal-nav {
  width: 32px; height: 32px;
  display: inline-grid; place-items: center;
  font-size: 20px;
  color: var(--c-text-soft);
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}
.cal-nav:hover { background: var(--c-surface-2); color: var(--c-text); }
.cal-month {
  text-align: center;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.005em;
  font-family: var(--font-num);
}
.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--c-border);
}
.cal-weekday {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-muted);
  text-align: center;
  letter-spacing: 0.04em;
}
.cal-weekday.sun { color: #d97070; }
.cal-weekday.sat { color: #6b8fb5; }
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cal-cell {
  height: 34px;
  display: inline-grid; place-items: center;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-text);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-num);
  transition: background 0.12s, color 0.12s, transform 0.05s;
}
.cal-cell:hover {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
}
.cal-cell:active { transform: scale(0.94); }
.cal-cell.outside { color: var(--c-text-muted); opacity: 0.45; }
.cal-cell.sun { color: #d97070; }
.cal-cell.sat { color: #6b8fb5; }
.cal-cell.outside.sun, .cal-cell.outside.sat { opacity: 0.35; }
.cal-cell.today {
  font-weight: 700;
  position: relative;
}
.cal-cell.today::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--c-accent);
}
.cal-cell.selected {
  background: var(--c-accent);
  color: #fff !important;
  font-weight: 700;
  opacity: 1;
}
.cal-cell.selected::after { background: #fff; }
.cal-cell.selected:hover { background: var(--c-accent-ink); }

.cal-foot {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--c-border);
  display: flex;
  justify-content: center;
}
.cal-foot-btn {
  padding: 6px 14px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-accent-ink);
  background: var(--c-accent-soft);
  border-radius: 999px;
  transition: background 0.15s, color 0.15s;
}
.cal-foot-btn:hover { background: var(--c-accent); color: #fff; }

@media (max-width: 480px) {
  .cal-popover { right: auto; left: 0; width: calc(100vw - 32px); max-width: 320px; }
}

.tab-body { margin-top: 4px; }

.record-head-right { display: inline-flex; align-items: center; gap: 8px; }
.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 16px;
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--c-text);
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.05s;
}
.btn-export-icon { font-size: 14px; line-height: 1; }
.btn-export:hover {
  background: var(--c-surface-2);
  border-color: var(--c-accent);
  color: var(--c-accent-ink);
}
.btn-export:active { transform: translateY(1px); }
.btn-export:disabled {
  opacity: 0.55;
  cursor: progress;
  transform: none;
}

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
