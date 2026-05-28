import type { WorkoutEntry, MealEntry, BodyEntry, Sex } from '@/stores/log'
import type { FoodItem } from '@/data/foods'

// vault(동기화 저장 단위) 페이로드 — 앱 전체 스냅샷(모든 프로필).
export const VAULT_SCHEMA = 1

export interface VaultMeta {
  weight?: number
  sex?: Sex | ''
  birthYear?: number | null
  activityLevel?: number
}

export interface VaultProfile {
  workouts: WorkoutEntry[]
  meals: MealEntry[]
  body: BodyEntry[]
  customFoods: FoodItem[]
  meta: VaultMeta
}

export interface VaultData {
  v: number
  knownProfiles: string[]
  profiles: Record<string, VaultProfile>
}

export function emptyProfile(): VaultProfile {
  return { workouts: [], meals: [], body: [], customFoods: [], meta: {} }
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)]
}

// id 기준 합집합. local 을 우선 보존하고 remote 에만 있는 항목을 뒤에 덧붙인다.
// (정렬은 화면단에서 date/createdAt 으로 다시 하므로 순서는 중요치 않다.)
function unionById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const seen = new Set(local.map(x => x.id))
  const out = [...local]
  for (const r of remote) {
    if (!seen.has(r.id)) {
      out.push(r)
      seen.add(r.id)
    }
  }
  return out
}

// 스칼라 메타 병합: remote 에 의미있는 값이 있으면 remote, 없으면 local.
// (시계 없이 결정적. remote=공유된 정본을 우선)
function mergeMeta(local: VaultMeta, remote: VaultMeta): VaultMeta {
  return {
    sex: remote.sex ? remote.sex : local.sex,
    birthYear: remote.birthYear != null ? remote.birthYear : local.birthYear,
    weight: remote.weight != null ? remote.weight : local.weight,
    activityLevel: remote.activityLevel != null ? remote.activityLevel : local.activityLevel,
  }
}

function mergeProfile(local: VaultProfile, remote: VaultProfile): VaultProfile {
  return {
    workouts: unionById(local.workouts, remote.workouts),
    meals: unionById(local.meals, remote.meals),
    body: unionById(local.body, remote.body),
    customFoods: unionById(local.customFoods, remote.customFoods),
    meta: mergeMeta(local.meta, remote.meta),
  }
}

// 두 vault 병합. 배열은 id 합집합, 메타는 스칼라 규칙.
// ⚠️ 추가는 항상 보존되지만, 삭제는 전파되지 않는다(한쪽에서 지운 항목이
//    다른 쪽에 남아있으면 합집합으로 되살아남). 단일 기기 사용 흐름에선 문제없음.
export function mergeVaults(local: VaultData, remote: VaultData): VaultData {
  const names = unique([
    ...local.knownProfiles,
    ...Object.keys(local.profiles),
    ...remote.knownProfiles,
    ...Object.keys(remote.profiles),
  ])
  const profiles: Record<string, VaultProfile> = {}
  for (const name of names) {
    const l = local.profiles[name]
    const r = remote.profiles[name]
    if (l && r) profiles[name] = mergeProfile(l, r)
    else profiles[name] = l ?? r ?? emptyProfile()
  }
  return {
    v: VAULT_SCHEMA,
    knownProfiles: unique([...local.knownProfiles, ...remote.knownProfiles]),
    profiles,
  }
}
