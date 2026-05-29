<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'added', name: string): void }>()

const catalog = useCatalogStore()

const name = ref('')
const error = ref('')
const submitted = ref(false)

watch(() => props.open, (v) => {
  if (v) { name.value = ''; error.value = ''; submitted.value = false }
})

function close() { emit('close') }

function submit() {
  error.value = ''
  const n = name.value.trim()
  if (!n) { error.value = '운동 이름을 입력해주세요.'; return }
  if (n.length > 60) { error.value = '너무 길어요 (60자 이하).'; return }
  const ok = catalog.addExerciseRequest(n)
  if (!ok) { error.value = '이미 카탈로그에 있거나 요청 목록에 있어요.'; return }
  submitted.value = true
  emit('added', n)
  name.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="close">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="exadd-title">
        <header class="modal-head">
          <h2 id="exadd-title">운동 추가 요청</h2>
          <button class="x" type="button" @click="close" aria-label="닫기">✕</button>
        </header>

        <form class="modal-body" @submit.prevent="submit">
          <p class="lead">
            추가하고 싶은 운동 이름만 적어주세요. 관리자(설정 화면)에서 모아서 한 번에 카탈로그에 반영합니다.
          </p>

          <div class="row">
            <label class="lab">운동 이름</label>
            <input v-model="name" class="inp" type="text" placeholder="예) 머신 체스트 프레스" maxlength="60" autofocus />
          </div>

          <p v-if="error" class="err">{{ error }}</p>
          <p v-else-if="submitted" class="ok">요청에 추가됐어요. 다음 운동도 입력하거나 닫아주세요.</p>

          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="close">닫기</button>
            <button type="submit" class="btn-primary" :disabled="!name.trim()">요청 추가</button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 1000; padding: 16px; }
.modal { background: var(--c-surface); border-radius: var(--radius-lg); width: 100%; max-width: 460px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; border: 1px solid var(--c-border); }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--c-border); }
.modal-head h2 { font-size: var(--fs-lg); margin: 0; }
.x { width: 30px; height: 30px; border: none; background: transparent; cursor: pointer; font-size: 16px; color: var(--c-text-muted); border-radius: 6px; }
.x:hover { background: var(--c-border); color: var(--c-text); }
.modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.lead { font-size: var(--fs-sm); color: var(--c-text-muted); line-height: 1.55; margin: 0; }
.row { display: flex; flex-direction: column; gap: 6px; }
.lab { font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.04em; text-transform: uppercase; }
.inp { height: 38px; padding: 0 12px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); font-size: var(--fs-md); }
.inp:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }
.err { color: var(--c-danger); font-size: var(--fs-sm); margin: 0; }
.ok { color: var(--c-accent-ink); font-size: var(--fs-sm); margin: 0; }
.modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.btn-ghost, .btn-primary { height: 38px; padding: 0 18px; border-radius: var(--radius-md); border: none; font-size: var(--fs-sm); cursor: pointer; }
.btn-ghost { background: var(--c-border); color: var(--c-text); }
.btn-ghost:hover { background: var(--c-border-strong); }
.btn-primary { background: var(--c-accent); color: #fff; font-weight: 600; }
.btn-primary:hover:not(:disabled) { background: var(--c-accent-ink); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
</style>
