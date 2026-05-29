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
const { activeProfile, knownProfiles } = storeToRefs(profile)
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

const stage = computed<'sync' | 'profile' | 'body' | 'meta' | 'done'>(() => {
  // 동기화 미설정(코드 없음) 기기는 무조건 이 화면으로 보낸다.
  // setCode 가 code 를 채우면 hasCode=true 가 되므로, 네트워크 왕복 동안에도
  // 화면을 붙잡으려고 syncBusy 를 함께 본다. (env 미설정이면 생략 → 곧장 profile)
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

const nameInput = ref('')
const pwInput = ref('')
const nameError = ref('')
async function submitName() {
  nameError.value = ''
  const n = nameInput.value.trim()
  const pw = pwInput.value
  if (!n) { nameError.value = '닉네임을 입력해주세요.'; return }
  if (!profile.isValidName(n)) { nameError.value = '닉네임에 사용할 수 없는 문자가 포함되어 있습니다.'; return }
  if (!profile.isValidPassword(pw)) { nameError.value = '비밀번호는 4자 이상이에요.'; return }
  const isNew = !knownProfiles.value.includes(n)
  // 비번 검증: vault 에 hash 가 있으면 일치해야 진행, 없으면 첫 설정으로 저장.
  const res = await profile.verifyOrSetPassword(n, pw)
  if (!res.ok) { nameError.value = '비밀번호가 맞지 않아요.'; return }
  needsBodyForNewProfile.value = isNew
  profile.setProfile(n)
  pwInput.value = ''
  // 다음 sync 때 passwordHash 가 vault 에 함께 push 됨(첫 설정의 경우).
  syncStore.syncNow().catch(() => { /* 실패해도 게이트는 통과 */ })
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

      <!-- 동기화 단계 — 코드 없는 기기는 고정 코드를 입력해야 진행 (첫 화면) -->
      <div v-if="stage === 'sync'" class="gate-form">
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

      <!-- 프로필 단계 — 닉네임 직접 입력. 클릭만으로는 다른 프로필에 못 들어가게. -->
      <div v-else-if="stage === 'profile'" class="gate-form">
        <label class="gate-label">닉네임</label>
        <p class="gate-hint">
          기존 닉네임을 정확히 입력하면 그 기록으로, 새 이름이면 새로 시작합니다.
          데이터는 이름별로 따로 보관됩니다.
        </p>
        <p v-if="knownProfiles.length" class="gate-hint gate-existing">
          사용 중인 닉네임: <b>{{ knownProfiles.join(', ') }}</b>
        </p>

        <form class="gate-pw-form" @submit.prevent="submitName">
          <input
            class="gate-input"
            type="text"
            v-model="nameInput"
            autocomplete="off"
            placeholder="닉네임 입력"
            maxlength="24"
          />
          <input
            class="gate-input"
            type="password"
            v-model="pwInput"
            autocomplete="current-password"
            placeholder="비밀번호 (4자 이상)"
            maxlength="64"
          />
          <button class="gate-btn" type="submit">들어가기</button>
        </form>
        <p class="gate-hint">처음 들어오는 닉네임이라면 입력한 비밀번호가 그대로 저장돼요. 이미 쓰던 닉네임이라면 일치해야 들어올 수 있어요.</p>
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
.gate-existing {
  margin-top: 4px;
  padding: 6px 10px;
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  border-radius: var(--radius-md);
}
.gate-name-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: end;
}
.gate-name-form .gate-btn { padding: 0 14px; }
.gate-pw-form { display: grid; gap: 8px; }
.gate-pw-form .gate-btn { padding: 0 14px; height: 40px; }
.gate-busy {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  padding: 8px 0;
}
</style>
