<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'

const props = defineProps<{
  submitLabel?: string
  skipLabel?: string
  showSkip?: boolean
}>()
const emit = defineEmits<{
  done: []
  skip: []
}>()

const log = useLogStore()
const { selectedDate, weightKg: defaultWeight } = storeToRefs(log)

const weight = ref<number | null>(null)
const bodyFat = ref<number | null>(null)
const muscle = ref<number | null>(null)
const note = ref('')
const err = ref('')

function submit() {
  err.value = ''
  if (weight.value == null || weight.value <= 0) {
    err.value = '체중을 입력해주세요.'
    return
  }
  log.addBody({
    date: selectedDate.value,
    weightKg: weight.value,
    bodyFatPct: bodyFat.value ?? undefined,
    muscleKg: muscle.value ?? undefined,
    note: note.value.trim() || undefined,
  })
  // 운동 kcal 계산용 기준 체중도 함께 갱신
  defaultWeight.value = weight.value
  emit('done')
}
</script>

<template>
  <form class="body-form" @submit.prevent="submit">
    <div class="row">
      <label class="field">
        <span class="label">체중 (kg) <span class="req">*</span></span>
        <input
          class="input num"
          type="number"
          step="0.1"
          min="20"
          max="250"
          v-model.number="weight"
          autofocus
          placeholder="예: 72.4"
        />
      </label>
    </div>
    <div class="row two">
      <label class="field">
        <span class="label">체지방률 (%)</span>
        <input class="input num" type="number" step="0.1" min="0" max="80" v-model.number="bodyFat" placeholder="선택" />
      </label>
      <label class="field">
        <span class="label">골격근량 (kg)</span>
        <input class="input num" type="number" step="0.1" min="0" max="120" v-model.number="muscle" placeholder="선택" />
      </label>
    </div>
    <label class="field">
      <span class="label">메모</span>
      <input class="input" type="text" v-model="note" maxlength="60" placeholder="(선택)" />
    </label>
    <div v-if="err" class="err">{{ err }}</div>
    <div class="actions">
      <button v-if="props.showSkip" type="button" class="btn btn-ghost" @click="emit('skip')">
        {{ props.skipLabel || '나중에' }}
      </button>
      <button type="submit" class="btn btn-primary">{{ props.submitLabel || '저장' }}</button>
    </div>
  </form>
</template>

<style scoped>
.body-form { display: grid; gap: 10px; }
.row { display: grid; gap: 8px; }
.row.two { grid-template-columns: 1fr 1fr; }
.field { display: grid; gap: 4px; }
.label {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.req { color: var(--c-danger); margin-left: 2px; }
.input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  font-size: var(--fs-md);
  transition: border 0.15s, box-shadow 0.15s;
}
.input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); outline: none; }
.err { font-size: var(--fs-xs); color: var(--c-danger); }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 36px; padding: 0 14px;
  font-size: var(--fs-sm); font-weight: 500;
  border-radius: var(--radius-md);
  transition: background 0.15s, color 0.15s, border 0.15s;
}
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover { background: var(--c-accent-ink); }
.btn-ghost { background: transparent; color: var(--c-text-soft); border: 1px solid var(--c-border-strong); }
.btn-ghost:hover { background: var(--c-surface-2); color: var(--c-text); }
</style>
