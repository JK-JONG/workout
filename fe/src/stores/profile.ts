import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

// 단순 게이트 비밀번호. 코드 번들에 포함되므로 강한 보안은 아님 — URL 우연 접근 차단용.
const GATE_PASSWORD = '10061006'

// 프로필 이름 검증: 1~24자, 슬래시/따옴표 등 키 깨뜨릴 문자 차단
const NAME_RE = /^[^\\/"'<>\s][^\\/"'<>]{0,23}$/

export const useProfileStore = defineStore('profile', () => {
  const unlocked = useLocalStorage<boolean>('wt.gateUnlocked', false)
  const activeProfile = useLocalStorage<string>('wt.activeProfile', '')
  const knownProfiles = useLocalStorage<string[]>('wt.knownProfiles', [])

  const ready = computed(() => unlocked.value && !!activeProfile.value)

  function unlock(pw: string): boolean {
    if (pw === GATE_PASSWORD) {
      unlocked.value = true
      return true
    }
    return false
  }

  function lock() {
    unlocked.value = false
  }

  function isValidName(name: string): boolean {
    return NAME_RE.test(name.trim())
  }

  function setProfile(name: string) {
    const n = name.trim()
    if (!isValidName(n)) return
    activeProfile.value = n
    if (!knownProfiles.value.includes(n)) {
      knownProfiles.value = [...knownProfiles.value, n]
    }
  }

  function clearProfile() {
    activeProfile.value = ''
  }

  function removeProfile(name: string) {
    knownProfiles.value = knownProfiles.value.filter(p => p !== name)
    // 해당 프로필의 모든 localStorage 키 삭제
    const prefix = `wt.p.${name}.`
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
    if (activeProfile.value === name) activeProfile.value = ''
  }

  return {
    unlocked, activeProfile, knownProfiles, ready,
    unlock, lock, setProfile, clearProfile, removeProfile, isValidName,
  }
})
