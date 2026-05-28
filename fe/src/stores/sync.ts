import { defineStore } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useLocalStorage, useDebounceFn } from '@vueuse/core'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useProfileStore } from '@/stores/profile'
import { useLogStore, type Sex } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import {
  mergeVaults,
  VAULT_SCHEMA,
  type VaultData,
  type VaultProfile,
} from '@/lib/syncMerge'

// ── 동기화 코드 생성/정규화 ────────────────────────────
// Crockford Base32 (혼동 문자 I·L·O·U 제외). 15바이트=120bit → 24자.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function toBase32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

function makeCode(): string {
  const bytes = new Uint8Array(15)
  crypto.getRandomValues(bytes)
  return toBase32(bytes) // 24자, 대시 없음(=canonical)
}

// 입력 정규화: 대문자화·구분자 제거·혼동 문자 교정. 저장·전송은 항상 이 형태.
export function canonicalizeCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V')
}

// 표시용: 4자마다 대시. (저장값은 대시 없는 canonical)
export function formatCode(canonical: string): string {
  return (canonical.match(/.{1,4}/g) ?? []).join('-')
}

const MIN_CODE_LEN = 16

// ── localStorage 직접 접근 헬퍼 ────────────────────────
function pKey(profile: string, key: string): string {
  return `wt.p.${profile}.${key}`
}
function readKey<T>(profile: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(pKey(profile, key))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeKey(profile: string, key: string, value: unknown): void {
  localStorage.setItem(pKey(profile, key), JSON.stringify(value))
}
function uniq(arr: string[]): string[] {
  return [...new Set(arr)]
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'

export const useSyncStore = defineStore('sync', () => {
  const code = useLocalStorage<string>('wt.syncCode', '')
  const autoSync = useLocalStorage<boolean>('wt.syncAuto', true)
  const lastSyncedAt = useLocalStorage<number>('wt.syncLastAt', 0)

  const status = ref<SyncStatus>('idle')
  const errorMsg = ref('')
  const remoteVersion = ref<number | null>(null)

  // 내부 가드: pull 적용 중엔 watcher 가 push 를 스케줄하지 않도록.
  let applying = false
  let inFlight = false
  let initialized = false

  const configured = computed(() => supabaseConfigured)
  const hasCode = computed(() => code.value.length >= MIN_CODE_LEN)
  const enabled = computed(() => configured.value && hasCode.value)
  const displayCode = computed(() => formatCode(code.value))

  // ── vault 스냅샷 읽기 (활성 프로필은 live store, 나머진 localStorage) ──
  function readLocalVault(): VaultData {
    const profile = useProfileStore()
    const log = useLogStore()
    const catalog = useCatalogStore()
    const active = profile.activeProfile
    const names = uniq(active ? [...profile.knownProfiles, active] : [...profile.knownProfiles])

    const profiles: Record<string, VaultProfile> = {}
    for (const name of names) {
      if (name === active) {
        profiles[name] = {
          workouts: JSON.parse(JSON.stringify(log.workouts)),
          meals: JSON.parse(JSON.stringify(log.meals)),
          body: JSON.parse(JSON.stringify(log.body)),
          customFoods: JSON.parse(JSON.stringify(catalog.customFoods)),
          meta: {
            weight: log.weightKg,
            sex: log.sex || undefined,
            birthYear: log.birthYear,
            activityLevel: log.activityLevel,
          },
        }
      } else {
        profiles[name] = {
          workouts: readKey(name, 'workouts', []),
          meals: readKey(name, 'meals', []),
          body: readKey(name, 'body', []),
          customFoods: readKey(name, 'customFoods', []),
          meta: {
            weight: readKey<number | undefined>(name, 'weight', undefined),
            sex: readKey<Sex | ''>(name, 'sex', '') || undefined,
            birthYear: readKey<number | null>(name, 'birthYear', null),
            activityLevel: readKey<number | undefined>(name, 'activityLevel', undefined),
          },
        }
      }
    }
    return { v: VAULT_SCHEMA, knownProfiles: names, profiles }
  }

  // ── 병합 결과를 localStorage + 활성 프로필 store 에 반영 ──
  function applyVault(v: VaultData): void {
    applying = true
    const profile = useProfileStore()
    const log = useLogStore()
    const catalog = useCatalogStore()
    const active = profile.activeProfile

    for (const [name, p] of Object.entries(v.profiles)) {
      writeKey(name, 'workouts', p.workouts)
      writeKey(name, 'meals', p.meals)
      writeKey(name, 'body', p.body)
      writeKey(name, 'customFoods', p.customFoods)
      if (p.meta.weight != null) writeKey(name, 'weight', p.meta.weight)
      if (p.meta.sex) writeKey(name, 'sex', p.meta.sex)
      if (p.meta.birthYear != null) writeKey(name, 'birthYear', p.meta.birthYear)
      if (p.meta.activityLevel != null) writeKey(name, 'activityLevel', p.meta.activityLevel)
    }

    profile.knownProfiles = uniq([...profile.knownProfiles, ...v.knownProfiles])

    // 활성 프로필은 화면이 즉시 갱신되도록 live ref 도 교체.
    if (active && v.profiles[active]) {
      const p = v.profiles[active]
      log.workouts = p.workouts
      log.meals = p.meals
      log.body = p.body
      catalog.customFoods = p.customFoods
      if (p.meta.weight != null) log.weightKg = p.meta.weight
      if (p.meta.sex) log.sex = p.meta.sex
      if (p.meta.birthYear !== undefined) log.birthYear = p.meta.birthYear ?? null
      if (p.meta.activityLevel != null) log.activityLevel = p.meta.activityLevel
    }

    // watcher flush 가 끝난 뒤(다음 tick) 가드 해제 → 적용으로 인한 echo push 방지.
    nextTick(() => { applying = false })
  }

  // ── RPC ────────────────────────────────────────────────
  async function rpcPull(): Promise<{ data: VaultData | null; version: number }> {
    if (!supabase) throw new Error('동기화가 설정되지 않았습니다.')
    const { data, error } = await supabase.rpc('sync_pull', { p_code: code.value })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return { data: null, version: 0 }
    return { data: row.data as VaultData, version: row.version as number }
  }

  async function rpcPush(payload: VaultData, expected: number) {
    if (!supabase) throw new Error('동기화가 설정되지 않았습니다.')
    const { data, error } = await supabase.rpc('sync_push', {
      p_code: code.value,
      p_data: payload,
      p_expected_version: expected,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      version: row.version as number,
      conflict: Boolean(row.conflict),
      data: (row.data ?? null) as VaultData | null,
    }
  }

  function humanError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e)
    if (/Failed to fetch|NetworkError|fetch/i.test(msg)) return '네트워크 연결을 확인하세요.'
    if (/function .* does not exist|sync_pull|sync_push/i.test(msg)) {
      return 'DB 설정(SQL 마이그레이션)이 아직 적용되지 않았습니다.'
    }
    return msg
  }

  // ── 핵심: pull → 병합 → push (충돌 시 최대 3회 재병합) ──
  async function syncNow(): Promise<boolean> {
    if (!enabled.value || inFlight) return false
    inFlight = true
    status.value = 'syncing'
    errorMsg.value = ''
    try {
      const remote = await rpcPull()
      const local = readLocalVault()
      let merged = remote.data ? mergeVaults(local, remote.data) : local
      let expected = remote.version

      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await rpcPush(merged, expected)
        if (!res.conflict) {
          remoteVersion.value = res.version
          applyVault(merged)
          lastSyncedAt.value = Date.now()
          status.value = 'ok'
          return true
        }
        // 충돌: 서버 최신본과 다시 병합 후 재시도
        merged = res.data ? mergeVaults(merged, res.data) : merged
        expected = res.version
        await sleep(150 * (attempt + 1))
      }
      status.value = 'error'
      errorMsg.value = '동기화 충돌이 반복됩니다. 잠시 후 다시 시도하세요.'
      return false
    } catch (e) {
      status.value = 'error'
      errorMsg.value = humanError(e)
      return false
    } finally {
      inFlight = false
    }
  }

  const debouncedSync = useDebounceFn(() => { void syncNow() }, 1500)

  // ── 코드 관리 ───────────────────────────────────────────
  function generateCode(): string {
    code.value = makeCode()
    remoteVersion.value = null
    return code.value
  }
  function setCode(input: string): boolean {
    const c = canonicalizeCode(input)
    if (c.length < MIN_CODE_LEN) return false
    code.value = c
    remoteVersion.value = null
    return true
  }
  function clearCode(): void {
    code.value = ''
    remoteVersion.value = null
    status.value = 'idle'
    errorMsg.value = ''
  }

  // ── 초기화: 부트스트랩 동기화 + 자동 push watcher ──────
  function init(): void {
    if (initialized || !configured.value) return
    initialized = true

    const log = useLogStore()
    const catalog = useCatalogStore()
    const profile = useProfileStore()

    watch(
      () => [
        log.workouts, log.meals, log.body, catalog.customFoods,
        log.weightKg, log.sex, log.birthYear, log.activityLevel,
        profile.knownProfiles, profile.activeProfile,
      ],
      () => {
        if (applying || !autoSync.value || !enabled.value) return
        debouncedSync()
      },
      { deep: true },
    )

    if (enabled.value) void syncNow()
  }

  return {
    code, autoSync, lastSyncedAt,
    status, errorMsg, remoteVersion,
    configured, hasCode, enabled, displayCode,
    generateCode, setCode, clearCode, syncNow, init,
  }
})
