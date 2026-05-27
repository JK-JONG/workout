<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, type Sex } from '@/stores/log'
import { useProfileStore } from '@/stores/profile'

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
const profile = useProfileStore()
const { activeProfile } = storeToRefs(profile)
const {
  selectedDate,
  sex: storedSex,
  birthYear: storedBirthYear,
  latestBody,
} = storeToRefs(log)

const weight = ref<number | null>(null)
const height = ref<number | null>(latestBody.value?.heightCm ?? null)
const sexInput = ref<Sex | ''>(storedSex.value || '')
const birthYearInput = ref<number | null>(storedBirthYear.value || null)
const bodyFat = ref<number | null>(null)
const muscle = ref<number | null>(null)
const note = ref('')
const err = ref('')

const thisYear = new Date().getFullYear()

function submit() {
  err.value = ''
  if (weight.value == null || weight.value <= 0) {
    err.value = '체중을 입력해주세요.'
    return
  }
  if (height.value == null || height.value <= 0) {
    err.value = '신장을 입력해주세요.'
    return
  }
  if (!sexInput.value) {
    err.value = '성별을 선택해주세요.'
    return
  }
  if (!birthYearInput.value || birthYearInput.value < 1900 || birthYearInput.value > thisYear) {
    err.value = '출생연도를 정확히 입력해주세요.'
    return
  }
  log.addBody({
    date: selectedDate.value,
    weightKg: weight.value,
    heightCm: height.value,
    bodyFatPct: bodyFat.value ?? undefined,
    muscleKg: muscle.value ?? undefined,
    note: note.value.trim() || undefined,
  })
  // BMR 계산용 정보 + 운동 kcal 기준 체중을 명시적으로 저장 (ref set + localStorage 즉시 기록)
  log.setProfileMeta({
    sex: sexInput.value as Sex,
    birthYear: birthYearInput.value,
    weightKg: weight.value,
  })
  emit('done')
}
</script>

<template>
  <form class="body-form" @submit.prevent="submit">
    <label class="field">
      <span class="label">이름 (현재 프로필)</span>
      <input
        class="input name-input"
        type="text"
        :value="activeProfile"
        readonly
        aria-readonly="true"
        tabindex="-1"
      />
    </label>
    <div class="row two">
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
      <label class="field">
        <span class="label">신장 (cm) <span class="req">*</span></span>
        <input
          class="input num"
          type="number"
          step="0.1"
          min="100"
          max="230"
          v-model.number="height"
          placeholder="예: 175.0"
        />
      </label>
    </div>
    <div class="row two">
      <div class="field">
        <span class="label">성별 <span class="req">*</span></span>
        <div class="seg">
          <button
            type="button"
            class="seg-btn"
            :class="{ active: sexInput === 'male' }"
            @click="sexInput = 'male'"
          >남성</button>
          <button
            type="button"
            class="seg-btn"
            :class="{ active: sexInput === 'female' }"
            @click="sexInput = 'female'"
          >여성</button>
        </div>
      </div>
      <label class="field">
        <span class="label">출생연도 <span class="req">*</span></span>
        <input
          class="input num"
          type="number"
          step="1"
          min="1900"
          :max="thisYear"
          v-model.number="birthYearInput"
          placeholder="예: 1995"
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
    <p class="hint muted small">
      성별·신장·출생연도는 권장 칼로리(BMR/TDEE) 계산에 사용됩니다.
    </p>
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
.row.two { grid-template-columns: 1fr 1fr; gap: 8px; }
.field { display: grid; gap: 4px; }
.label {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-weight: 600;
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
.name-input {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  font-weight: 700;
  border-color: var(--c-accent);
  cursor: default;
}
.name-input:focus { box-shadow: none; }

.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 2px;
  height: 38px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
}
.seg-btn {
  display: inline-grid; place-items: center;
  height: 32px;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-text-soft);
  background: transparent;
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.seg-btn:hover { color: var(--c-text); }
.seg-btn.active {
  background: var(--c-accent);
  color: #fff;
  box-shadow: var(--shadow-xs);
}

.hint { line-height: 1.5; padding: 0 2px; }
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
