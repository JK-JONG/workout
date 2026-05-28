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
  // 삭제된 프로필 이름 톰스톤. sync 시 vault 에 함께 올라가, 다른 기기에서도
  // 같은 이름이 union 머지로 되살아나는 걸 막는다. 같은 이름으로 다시 생성하면
  // setProfile 에서 톰스톤이 제거된다(부활).
  const deletedProfiles = useLocalStorage<string[]>('wt.deletedProfiles', [])

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
    // 동일 이름을 다시 만들면 톰스톤에서 제거(부활) — 안 그러면 sync 머지에서 다시 빠짐.
    if (deletedProfiles.value.includes(n)) {
      deletedProfiles.value = deletedProfiles.value.filter(p => p !== n)
    }
  }

  function clearProfile() {
    activeProfile.value = ''
  }

  function removeProfile(name: string) {
    knownProfiles.value = knownProfiles.value.filter(p => p !== name)
    // 톰스톤 등록 — sync 시 다른 기기에서도 같은 이름이 사라지도록 한다.
    if (!deletedProfiles.value.includes(name)) {
      deletedProfiles.value = [...deletedProfiles.value, name]
    }
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
    unlocked, activeProfile, knownProfiles, deletedProfiles, ready,
    unlock, lock, setProfile, clearProfile, removeProfile, isValidName,
  }
})
