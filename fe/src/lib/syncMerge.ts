import type { WorkoutEntry, MealEntry, BodyEntry, Sex } from '@/stores/log'
import type { FoodItem } from '@/data/foods'

// vault(동기화 저장 단위) 페이로드 — 앱 전체 스냅샷(모든 프로필).
// v2: deletedProfiles(톰스톤) 추가 — 한 기기에서 지운 프로필이 union 머지로
//     다른 기기 sync 때 되살아나는 문제를 해결. 이전 vault(v1)는 deletedProfiles
//     가 없으므로 mergeVaults 에서 `?? []` 로 안전하게 처리한다.
// v3: VaultProfile.passwordHash 추가 — 프로필별 비밀번호(sha256 hex). v2 vault 는
//     passwordHash 가 없는데, 다음 로그인 시 사용자가 입력한 값이 첫 설정으로 저장된다.
export const VAULT_SCHEMA = 3

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
  // 프로필 비밀번호의 sha256 hex. 비어있으면 vault 에 비번이 아직 설정 안 됨(v2 호환).
  passwordHash?: string
}

export interface VaultData {
  v: number
  knownProfiles: string[]
  // 삭제된 프로필 이름(톰스톤). 두 기기 union 머지에도 삭제가 살아남게 한다.
  // 같은 이름으로 다시 생성하면 톰스톤에서 제거된다(profile.setProfile 참고).
  deletedProfiles: string[]
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
    // password 는 remote(vault 의 정본) 우선. 두 기기에서 동시에 첫 설정한 경우엔
    // remote 가 살아남고 local 입력은 다음 sync 에서 reject 된다(검증 단계에서).
    passwordHash: remote.passwordHash || local.passwordHash,
  }
}

// 두 vault 병합. 배열은 id 합집합, 메타는 스칼라 규칙.
// 프로필 삭제는 톰스톤(deletedProfiles)으로 전파한다 — 한 기기에서 지우면
// 다른 기기 sync 때도 사라진다. (v1 vault 에는 톰스톤 필드가 없으므로 [] 로 취급)
export function mergeVaults(local: VaultData, remote: VaultData): VaultData {
  const deleted = unique([
    ...(local.deletedProfiles ?? []),
    ...(remote.deletedProfiles ?? []),
  ])
  const deletedSet = new Set(deleted)
  const allNames = unique([
    ...local.knownProfiles,
    ...Object.keys(local.profiles),
    ...remote.knownProfiles,
    ...Object.keys(remote.profiles),
  ])
  const profiles: Record<string, VaultProfile> = {}
  for (const name of allNames) {
    if (deletedSet.has(name)) continue   // 톰스톤된 프로필은 데이터도 제외
    const l = local.profiles[name]
    const r = remote.profiles[name]
    if (l && r) profiles[name] = mergeProfile(l, r)
    else profiles[name] = l ?? r ?? emptyProfile()
  }
  const known = unique([...local.knownProfiles, ...remote.knownProfiles])
    .filter(n => !deletedSet.has(n))
  return {
    v: VAULT_SCHEMA,
    knownProfiles: known,
    deletedProfiles: deleted,
    profiles,
  }
}
