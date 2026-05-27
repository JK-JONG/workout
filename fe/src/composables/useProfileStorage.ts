import { ref, watch, type Ref } from 'vue'
import { useProfileStore } from '@/stores/profile'

// 프로필별로 분리되는 localStorage 래퍼.
// 키 형식: `wt.p.{profile}.{key}`
export function useProfileStorage<T>(key: string, defaultValue: T): Ref<T> {
  const profile = useProfileStore()
  const data = ref(structuredClone(defaultValue)) as Ref<T>
  let suppressSave = false

  function fullKey(p: string) {
    return `wt.p.${p}.${key}`
  }

  function load() {
    const p = profile.activeProfile
    suppressSave = true
    if (!p) {
      data.value = structuredClone(defaultValue)
    } else {
      const raw = localStorage.getItem(fullKey(p))
      try {
        data.value = raw ? (JSON.parse(raw) as T) : structuredClone(defaultValue)
      } catch {
        data.value = structuredClone(defaultValue)
      }
    }
    // 다음 마이크로태스크에서 watcher fire 후 suppress 해제
    queueMicrotask(() => { suppressSave = false })
  }

  function save() {
    if (suppressSave) return
    const p = profile.activeProfile
    if (!p) return
    localStorage.setItem(fullKey(p), JSON.stringify(data.value))
  }

  watch(() => profile.activeProfile, load, { immediate: true })
  watch(data, save, { deep: true })

  return data
}
