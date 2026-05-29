<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { ROUTINES, type ExerciseItem, type ExerciseUnit, type Routine } from '@/data/exercises'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'added', item: ExerciseItem): void }>()

const catalog = useCatalogStore()

const EQUIPMENTS = ['바벨', '덤벨', '머신', '케이블', '맨몸', '유산소기구'] as const
const UNITS: { v: ExerciseUnit; label: string }[] = [
  { v: 'reps', label: '횟수(reps)' },
  { v: 'time', label: '시간(분)' },
  { v: 'distance', label: '거리(km)' },
]

const name = ref('')
const category = ref('')
const equipment = ref<typeof EQUIPMENTS[number]>('덤벨')
const met = ref<number>(5)
const unit = ref<ExerciseUnit>('reps')
const routine = ref<Routine | ''>('')
const bodyPart = ref('')
const note = ref('')
const imageUrl = ref('')
const emoji = ref('')

const error = ref('')

const isValid = computed(() => {
  return name.value.trim().length > 0
    && category.value.trim().length > 0
    && met.value > 0 && met.value < 20
})

function reset() {
  name.value = ''; category.value = ''; equipment.value = '덤벨'
  met.value = 5; unit.value = 'reps'; routine.value = ''
  bodyPart.value = ''; note.value = ''; imageUrl.value = ''; emoji.value = ''
  error.value = ''
}

watch(() => props.open, (v) => { if (v) reset() })

function close() { emit('close') }

function submit() {
  error.value = ''
  if (!isValid.value) { error.value = '운동 이름·카테고리·MET 는 필수예요.'; return }
  const payload: Omit<ExerciseItem, 'id'> = {
    name: name.value.trim(),
    category: category.value.trim(),
    equipment: equipment.value,
    met: Number(met.value),
    unit: unit.value,
    routine: routine.value || undefined,
    body_part: bodyPart.value.trim() || undefined,
    note: note.value.trim() || undefined,
    image_url: imageUrl.value.trim() || undefined,
    emoji: emoji.value.trim() || undefined,
  }
  const created = catalog.addCustomExercise(payload)
  emit('added', created)
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="close">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="exadd-title">
        <header class="modal-head">
          <h2 id="exadd-title">운동 추가</h2>
          <button class="x" type="button" @click="close" aria-label="닫기">✕</button>
        </header>

        <form class="modal-body" @submit.prevent="submit">
          <div class="row">
            <label class="lab">운동 이름 <span class="req">*</span></label>
            <input v-model="name" class="inp" type="text" placeholder="예) 머신 체스트 프레스" maxlength="40" autofocus />
          </div>

          <div class="grid2">
            <div class="row">
              <label class="lab">카테고리 <span class="req">*</span></label>
              <input v-model="category" class="inp" type="text" placeholder="예) 가슴" maxlength="20" />
            </div>
            <div class="row">
              <label class="lab">루틴</label>
              <select v-model="routine" class="inp">
                <option value="">없음</option>
                <option v-for="r in ROUTINES" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
          </div>

          <div class="grid2">
            <div class="row">
              <label class="lab">장비</label>
              <select v-model="equipment" class="inp">
                <option v-for="eq in EQUIPMENTS" :key="eq" :value="eq">{{ eq }}</option>
              </select>
            </div>
            <div class="row">
              <label class="lab">단위</label>
              <select v-model="unit" class="inp">
                <option v-for="u in UNITS" :key="u.v" :value="u.v">{{ u.label }}</option>
              </select>
            </div>
          </div>

          <div class="grid2">
            <div class="row">
              <label class="lab">MET (칼로리 계수) <span class="req">*</span></label>
              <input v-model.number="met" class="inp" type="number" min="1" max="20" step="0.1" />
              <small class="hint">참고: 가벼움 3~4 · 중간 5~6 · 강함 7~10</small>
            </div>
            <div class="row">
              <label class="lab">주요 부위</label>
              <input v-model="bodyPart" class="inp" type="text" placeholder="예) 대흉근" maxlength="40" />
            </div>
          </div>

          <div class="row">
            <label class="lab">GIF/이미지 URL <span class="opt">선택</span></label>
            <input v-model="imageUrl" class="inp" type="url" placeholder="https://..." />
            <small class="hint">없으면 아래 이모지가 fallback 으로 표시됩니다.</small>
          </div>

          <div class="grid2">
            <div class="row">
              <label class="lab">이모지 <span class="opt">선택</span></label>
              <input v-model="emoji" class="inp" type="text" placeholder="🏋️" maxlength="4" />
            </div>
            <div class="row">
              <label class="lab">메모</label>
              <input v-model="note" class="inp" type="text" maxlength="80" />
            </div>
          </div>

          <p v-if="error" class="err">{{ error }}</p>

          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="close">취소</button>
            <button type="submit" class="btn-primary" :disabled="!isValid">추가</button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display: grid; place-items: center; z-index: 1000;
  padding: 16px;
}
.modal {
  background: var(--c-surface); border-radius: var(--radius-lg);
  width: 100%; max-width: 560px; max-height: 90dvh;
  box-shadow: var(--shadow-lg); display: flex; flex-direction: column;
  border: 1px solid var(--c-border);
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--c-border);
}
.modal-head h2 { font-size: var(--fs-lg); margin: 0; }
.x { width: 30px; height: 30px; border: none; background: transparent; cursor: pointer; font-size: 16px; color: var(--c-text-muted); border-radius: 6px; }
.x:hover { background: var(--c-border); color: var(--c-text); }

.modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.row { display: flex; flex-direction: column; gap: 6px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.lab { font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.04em; text-transform: uppercase; }
.req { color: var(--c-danger); font-weight: 700; }
.opt { color: var(--c-text-muted); font-weight: 400; }
.inp { height: 38px; padding: 0 12px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); font-size: var(--fs-md); transition: border 0.15s, box-shadow 0.15s; }
.inp:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }
.hint { color: var(--c-text-muted); font-size: var(--fs-xs); }
.err { color: var(--c-danger); font-size: var(--fs-sm); margin: 0; }

.modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.btn-ghost, .btn-primary { height: 38px; padding: 0 18px; border-radius: var(--radius-md); border: none; font-size: var(--fs-sm); cursor: pointer; }
.btn-ghost { background: var(--c-border); color: var(--c-text); }
.btn-ghost:hover { background: var(--c-border-strong); }
.btn-primary { background: var(--c-accent); color: #fff; font-weight: 600; }
.btn-primary:hover:not(:disabled) { background: var(--c-accent-ink); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }

@media (max-width: 520px) {
  .grid2 { grid-template-columns: 1fr; }
}
</style>
