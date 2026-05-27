<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, type BodyEntry } from '@/stores/log'

const log = useLogStore()
const { selectedDate, body, bodyOfDate, latestBody } = storeToRefs(log)

interface Draft {
  weightKg: number | null
  bodyFatPct: number | null
  muscleKg: number | null
  note: string
}

const draft = ref<Draft>({ weightKg: null, bodyFatPct: null, muscleKg: null, note: '' })

// 날짜가 바뀌면 기존 기록을 폼에 채우거나 비움
watch(selectedDate, syncDraft, { immediate: true })
watch(body, syncDraft, { deep: true })

function syncDraft() {
  const existing = bodyOfDate.value[bodyOfDate.value.length - 1]
  if (existing) {
    draft.value = {
      weightKg: existing.weightKg,
      bodyFatPct: existing.bodyFatPct ?? null,
      muscleKg: existing.muscleKg ?? null,
      note: existing.note ?? '',
    }
  } else if (latestBody.value) {
    // 새 날짜면 가장 최근 값을 프리필 (덮어쓰기 전까지 기록되지 않음)
    draft.value = {
      weightKg: latestBody.value.weightKg,
      bodyFatPct: latestBody.value.bodyFatPct ?? null,
      muscleKg: latestBody.value.muscleKg ?? null,
      note: '',
    }
  } else {
    draft.value = { weightKg: null, bodyFatPct: null, muscleKg: null, note: '' }
  }
}

function save() {
  if (!draft.value.weightKg || draft.value.weightKg <= 0) return
  const existing = bodyOfDate.value[bodyOfDate.value.length - 1]
  const payload = {
    date: selectedDate.value,
    weightKg: draft.value.weightKg,
    bodyFatPct: draft.value.bodyFatPct ?? undefined,
    muscleKg: draft.value.muscleKg ?? undefined,
    note: draft.value.note.trim() || undefined,
  }
  if (existing) {
    log.updateBody(existing.id, payload)
  } else {
    log.addBody(payload)
  }
}

const sortedBody = computed<BodyEntry[]>(() =>
  [...body.value].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
)

function loadEntry(b: BodyEntry) {
  log.selectedDate = b.date
}

function deltaText(curr: number | undefined | null, prev: number | undefined | null, unit: string): string {
  if (curr == null || prev == null) return ''
  const d = +(curr - prev).toFixed(1)
  if (d === 0) return ''
  return ` (${d > 0 ? '+' : ''}${d}${unit})`
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2 class="card-title">신체 입력 · {{ selectedDate }}</h2>
      <span v-if="bodyOfDate.length" class="muted small">이미 기록된 날짜 — 저장 시 덮어쓰기</span>
    </div>

    <div class="form-grid">
      <div class="form-row-2">
        <label class="field">
          <span class="field-label required">몸무게 (kg)</span>
          <input class="input num" type="number" v-model.number="draft.weightKg" min="20" max="250" step="0.1" placeholder="필수" />
        </label>
        <label class="field">
          <span class="field-label">체지방률 (%)</span>
          <input class="input num" type="number" v-model.number="draft.bodyFatPct" min="0" max="60" step="0.1" placeholder="선택" />
        </label>
      </div>
      <div class="form-row-2">
        <label class="field">
          <span class="field-label">골격근량 (kg)</span>
          <input class="input num" type="number" v-model.number="draft.muscleKg" min="0" max="100" step="0.1" placeholder="선택" />
        </label>
        <label class="field">
          <span class="field-label">메모</span>
          <input class="input" type="text" v-model="draft.note" placeholder="예: 아침 공복" maxlength="60" />
        </label>
      </div>
      <button class="btn btn-primary" :disabled="!draft.weightKg" @click="save">
        {{ bodyOfDate.length ? '오늘 기록 덮어쓰기' : '오늘 기록 저장' }}
      </button>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2 class="card-title">신체 기록 ({{ sortedBody.length }}건)</h2>
    </div>
    <ul class="list">
      <li v-for="(b, i) in sortedBody" :key="b.id" class="row-item">
        <div class="row-main" @click="loadEntry(b)">
          <div class="row-name">
            <span class="num">{{ b.date }}</span>
            <span class="muted small" v-if="b.note">· {{ b.note }}</span>
          </div>
          <div class="row-sub muted num">
            {{ b.weightKg }}kg{{ deltaText(b.weightKg, sortedBody[i + 1]?.weightKg, 'kg') }}
            <span v-if="b.bodyFatPct">· 체지방 {{ b.bodyFatPct }}%{{ deltaText(b.bodyFatPct, sortedBody[i + 1]?.bodyFatPct, '%') }}</span>
            <span v-if="b.muscleKg">· 근육 {{ b.muscleKg }}kg{{ deltaText(b.muscleKg, sortedBody[i + 1]?.muscleKg, 'kg') }}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="icon-btn" @click="log.removeBody(b.id)" aria-label="삭제">×</button>
        </div>
      </li>
      <li v-if="sortedBody.length === 0" class="empty">아직 기록이 없습니다. 위에서 입력해주세요.</li>
    </ul>
  </section>
</template>

<style scoped>
.card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-xs); margin-bottom: 14px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.card-title { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); letter-spacing: 0.01em; }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }

.form-grid { display: grid; gap: 8px; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field { display: flex; flex-direction: column; gap: 3px; }
.field-label { font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.02em; }
.field-label.required::after { content: ' *'; color: var(--c-warn); }
.input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); font-size: var(--fs-md); transition: border 0.15s, box-shadow 0.15s; }
.input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }

.btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; font-size: var(--fs-md); font-weight: 500; border-radius: var(--radius-md); transition: background 0.15s, opacity 0.15s; }
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover:not(:disabled) { background: var(--c-accent-ink); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.list { display: flex; flex-direction: column; gap: 1px; }
.row-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-md); transition: background 0.12s; }
.row-item:hover { background: var(--c-surface-2); }
.row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; cursor: pointer; }
.row-name { font-size: var(--fs-md); color: var(--c-text); }
.row-sub { display: flex; flex-wrap: wrap; gap: 6px; font-size: var(--fs-sm); color: var(--c-text-muted); }
.row-actions { display: flex; align-items: center; gap: 6px; }
.icon-btn { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--c-text-muted); border-radius: 50%; transition: background 0.15s; }
.icon-btn:hover { background: var(--c-border); color: var(--c-text); }
.empty { padding: 18px 10px; font-size: var(--fs-sm); color: var(--c-text-muted); text-align: center; }
</style>
