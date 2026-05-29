import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { sha256Hex } from '@/lib/hash'

// 프로필 이름 검증: 1~24자, 슬래시/따옴표 등 키 깨뜨릴 문자 차단
const NAME_RE = /^[^\\/"'<>\s][^\\/"'<>]{0,23}$/

export const useProfileStore = defineStore('profile', () => {
  const activeProfile = useLocalStorage<string>('wt.activeProfile', '')
  const knownProfiles = useLocalStorage<string[]>('wt.knownProfiles', [])
  // 삭제된 프로필 이름 톰스톤. sync 시 vault 에 함께 올라가, 다른 기기에서도
  // 같은 이름이 union 머지로 되살아나는 걸 막는다. 같은 이름으로 다시 생성하면
  // setProfile 에서 톰스톤이 제거된다(부활).
  const deletedProfiles = useLocalStorage<string[]>('wt.deletedProfiles', [])

  function isValidName(name: string): boolean {
    return NAME_RE.test(name.trim())
  }

  function isValidPassword(pw: string): boolean {
    return typeof pw === 'string' && pw.length >= 4 && pw.length <= 64
  }

  // localStorage 직접 접근(프로필별 비번 hash 저장). sync.ts 의 patten 과 동일한 키 형식.
  function pwKey(name: string): string { return `wt.p.${name}.passwordHash` }
  function getStoredHash(name: string): string {
    try { return JSON.parse(localStorage.getItem(pwKey(name)) ?? '""') as string } catch { return '' }
  }
  function setStoredHash(name: string, hash: string): void {
    localStorage.setItem(pwKey(name), JSON.stringify(hash))
  }
  function removeStoredHash(name: string): void {
    localStorage.removeItem(pwKey(name))
  }

  // 비번 검증: vault(localStorage 캐시)에 hash 가 있으면 비교, 없으면 첫 설정으로 저장.
  // 반환: { ok, firstSet } — firstSet=true 는 grandfathered/새 프로필의 첫 설정.
  async function verifyOrSetPassword(name: string, pw: string): Promise<{ ok: boolean; firstSet: boolean }> {
    if (!isValidPassword(pw)) return { ok: false, firstSet: false }
    const hash = await sha256Hex(pw)
    const stored = getStoredHash(name)
    if (!stored) {
      setStoredHash(name, hash)
      return { ok: true, firstSet: true }
    }
    return { ok: stored === hash, firstSet: false }
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
    activeProfile, knownProfiles, deletedProfiles,
    setProfile, clearProfile, removeProfile, isValidName, isValidPassword,
    verifyOrSetPassword, getStoredHash, setStoredHash, removeStoredHash,
  }
})
