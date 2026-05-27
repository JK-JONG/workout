<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()
const { unlocked, activeProfile, knownProfiles } = storeToRefs(profile)

const stage = computed<'password' | 'profile' | 'done'>(() => {
  if (!unlocked.value) return 'password'
  if (!activeProfile.value) return 'profile'
  return 'done'
})

const pwInput = ref('')
const pwError = ref('')
function submitPw() {
  pwError.value = ''
  if (!profile.unlock(pwInput.value)) {
    pwError.value = '비밀번호가 맞지 않습니다.'
    pwInput.value = ''
  }
}

const nameInput = ref('')
const nameError = ref('')
function submitName() {
  nameError.value = ''
  const n = nameInput.value.trim()
  if (!n) { nameError.value = '이름을 입력해주세요.'; return }
  if (!profile.isValidName(n)) { nameError.value = '이름에 사용할 수 없는 문자가 포함되어 있습니다.'; return }
  profile.setProfile(n)
}
function pickProfile(name: string) {
  profile.setProfile(name)
}
</script>

<template>
  <template v-if="stage === 'done'">
    <slot />
  </template>

  <div v-else class="gate-bg">
    <div class="gate-card">
      <div class="gate-brand">
        <span class="gate-dot"></span>
        <span class="gate-name">Workout Tracker</span>
      </div>

      <!-- 비밀번호 단계 -->
      <form v-if="stage === 'password'" class="gate-form" @submit.prevent="submitPw">
        <label class="gate-label">비밀번호</label>
        <input
          class="gate-input"
          type="password"
          v-model="pwInput"
          inputmode="numeric"
          autocomplete="current-password"
          autofocus
          placeholder="알려받은 비밀번호"
        />
        <div v-if="pwError" class="gate-error">{{ pwError }}</div>
        <button class="gate-btn" type="submit">들어가기</button>
        <p class="gate-hint">처음 한 번만 입력하면 이 기기에서는 다시 묻지 않습니다.</p>
      </form>

      <!-- 프로필 단계 -->
      <div v-else-if="stage === 'profile'" class="gate-form">
        <label class="gate-label">이름</label>
        <p class="gate-hint">데이터는 이름별로 따로 보관됩니다. 가족·친구가 같은 기기를 써도 안 섞입니다.</p>

        <div v-if="knownProfiles.length" class="gate-known">
          <button
            v-for="n in knownProfiles"
            :key="n"
            class="gate-chip"
            type="button"
            @click="pickProfile(n)"
          >{{ n }}</button>
        </div>

        <form class="gate-name-form" @submit.prevent="submitName">
          <input
            class="gate-input"
            type="text"
            v-model="nameInput"
            autocomplete="nickname"
            placeholder="새 이름으로 시작"
            maxlength="24"
          />
          <button class="gate-btn" type="submit">시작</button>
        </form>
        <div v-if="nameError" class="gate-error">{{ nameError }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gate-bg {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--c-bg);
}
.gate-card {
  width: 100%; max-width: 360px;
  padding: 24px 22px 22px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: grid; gap: 14px;
}
.gate-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.gate-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-soft);
}
.gate-name { font-size: var(--fs-lg); font-weight: 600; letter-spacing: -0.01em; }
.gate-form, .gate-name-form { display: grid; gap: 8px; }
.gate-label {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.gate-input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  font-size: var(--fs-md);
  transition: border 0.15s, box-shadow 0.15s;
}
.gate-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }
.gate-btn {
  height: 38px;
  background: var(--c-accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background 0.15s;
}
.gate-btn:hover { background: var(--c-accent-ink); }
.gate-error {
  font-size: var(--fs-xs);
  color: var(--c-danger);
}
.gate-hint {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  line-height: 1.5;
}
.gate-known {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 4px;
}
.gate-chip {
  padding: 6px 12px;
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  border-radius: 999px;
  font-size: var(--fs-sm);
  border: 1px solid transparent;
  transition: background 0.15s, border 0.15s;
}
.gate-chip:hover { border-color: var(--c-accent); }
.gate-name-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: end;
}
.gate-name-form .gate-btn { padding: 0 14px; }
</style>
