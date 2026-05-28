<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useProfileStore } from '@/stores/profile'
import { useLogStore } from '@/stores/log'
import BodyOnboardingForm from '@/components/BodyOnboardingForm.vue'
import { useSyncStore } from '@/stores/sync'

const profile = useProfileStore()
const log = useLogStore()
const syncStore = useSyncStore()
const { unlocked, activeProfile, knownProfiles } = storeToRefs(profile)
const { body, sex, birthYear, latestBody } = storeToRefs(log)

// 새 프로필 강제 신체 입력 모드
const needsBodyForNewProfile = ref(false)
// 기존 프로필인데 BMR 정보가 비어있는 경우 자동 보완 모드 (한 번 dismiss하면 더 안 띄움)
const dismissedMeta = ref(false)

const needsMetaUpdate = computed(() => {
  if (!activeProfile.value) return false
  if (body.value.length === 0) return false // body 자체가 비면 'body' 단계에서 처리됨
  if (!sex.value || !birthYear.value) return true
  if (!latestBody.value?.heightCm) return true
  return false
})

const stage = computed<'password' | 'sync' | 'profile' | 'body' | 'meta' | 'done'>(() => {
  if (!unlocked.value) return 'password'
  // 동기화 미설정(코드 없음) 기기는 무조건 이 화면으로 보낸다.
  // setCode/generateCode 가 code 를 채우면 hasCode=true 가 되므로, 네트워크
  // 왕복 동안에도 화면을 붙잡으려고 syncBusy 를 함께 본다. (env 미설정이면 생략)
  if (syncStore.configured && (!syncStore.hasCode || syncBusy.value)) return 'sync'
  if (!activeProfile.value) return 'profile'
  if (needsBodyForNewProfile.value && body.value.length === 0) return 'body'
  if (needsMetaUpdate.value && !dismissedMeta.value) return 'meta'
  return 'done'
})

// 프로필이 바뀌면 강제/dismiss 모드 자동 해제
watch(activeProfile, () => {
  needsBodyForNewProfile.value = false
  dismissedMeta.value = false
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
  const isNew = !knownProfiles.value.includes(n)
  needsBodyForNewProfile.value = isNew
  profile.setProfile(n)
}
function pickProfile(name: string) {
  needsBodyForNewProfile.value = false
  profile.setProfile(name)
}

// ── 동기화 단계 ──────────────────────────────────────────
// 모델: 관리자가 가진 "고정 동기화 코드" 하나를 기기마다 1회 입력한다.
// 같은 코드를 입력한 기기끼리 같은 vault(DB)를 공유. 코드는 번들에 박지 않고
// 입력값이므로, 코드를 아는 사람(=관리자)만 데이터에 접근할 수 있다.
// syncBusy: 네트워크 왕복 동안 화면을 유지하기 위한 로컬 가드.
const syncCodeInput = ref('')
const syncFormError = ref('')
const syncBusy = ref(false)
const syncing = computed(() => syncStore.status === 'syncing')
const syncFailed = computed(() => syncStore.status === 'error')

async function submitSyncCode() {
  syncFormError.value = ''
  if (!syncStore.setCode(syncCodeInput.value)) {
    syncFormError.value = '코드는 24자여야 합니다 (대시 제외).'
    return
  }
  syncBusy.value = true                  // setCode 로 hasCode=true 가 돼도 화면 유지
  const ok = await syncStore.syncNow()   // vault 없으면 생성, 있으면 합류 — 둘 다 자동
  if (ok) syncBusy.value = false         // 성공 → 프로필 단계로 진행
  // 실패면 syncBusy 유지 → 아래 에러/재시도 UI
}

async function retrySync() {
  const ok = await syncStore.syncNow()
  if (ok) syncBusy.value = false
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

      <!-- 동기화 단계 — 코드 없는 기기는 고정 코드를 입력해야 진행 -->
      <div v-else-if="stage === 'sync'" class="gate-form">
        <label class="gate-label">동기화 코드 <span class="req">필수</span></label>
        <p class="gate-hint">
          동기화 코드를 입력하면 이 기기가 같은 데이터에 연결됩니다.
          같은 코드를 입력한 모든 기기끼리 자동으로 동기화됩니다.
        </p>

        <!-- 동기화 중 -->
        <div v-if="syncing" class="gate-busy">동기화 중…</div>

        <!-- 실패 -->
        <template v-else-if="syncBusy && syncFailed">
          <div class="gate-error">{{ syncStore.errorMsg }}</div>
          <button class="gate-btn" type="button" @click="retrySync">다시 시도</button>
        </template>

        <!-- 입력 -->
        <template v-else>
          <form class="gate-name-form" @submit.prevent="submitSyncCode">
            <input
              class="gate-input"
              type="text"
              v-model="syncCodeInput"
              autocomplete="off"
              autocapitalize="characters"
              placeholder="동기화 코드 입력"
            />
            <button class="gate-btn" type="submit">연결</button>
          </form>
          <div v-if="syncFormError" class="gate-error">{{ syncFormError }}</div>
        </template>
      </div>

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

      <!-- 신체 정보 입력 단계 (새 프로필) — 필수 -->
      <div v-else-if="stage === 'body'" class="gate-form">
        <label class="gate-label">신체 정보 <span class="req">필수</span></label>
        <p class="gate-hint">
          <b>{{ activeProfile }}</b> 님의 신체 정보를 입력해주세요. 운동 칼로리·권장 섭취 계산 기준이 됩니다.
          체지방·근육량은 나중에 추가해도 되지만 체중·신장·성별·출생연도는 시작 시 꼭 필요합니다.
        </p>
        <BodyOnboardingForm
          submit-label="시작하기"
          :show-skip="false"
          @done="needsBodyForNewProfile = false"
        />
      </div>

      <!-- 기존 프로필인데 BMR 계산용 정보 비어있음 — 보완 단계 -->
      <div v-else-if="stage === 'meta'" class="gate-form">
        <label class="gate-label">프로필 정보 보완 <span class="req">필요</span></label>
        <p class="gate-hint">
          정확한 권장 칼로리 계산(Mifflin-St Jeor 공식)을 위해 추가 정보가 필요합니다.
          한 번만 입력하면 다음부터는 안 물어봅니다.
        </p>
        <BodyOnboardingForm
          submit-label="저장하고 시작"
          :show-skip="false"
          @done="dismissedMeta = true"
        />
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
  width: 100%; max-width: 440px;
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
.req {
  font-size: var(--fs-xs);
  color: var(--c-danger);
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-left: 4px;
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
.gate-busy {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  padding: 8px 0;
}
</style>
