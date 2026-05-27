import { computed } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useLogStore, type WorkoutEntry, type MealEntry, type BodyEntry } from '@/stores/log'

export interface ProfiledWorkout extends WorkoutEntry { profile: string }
export interface ProfiledMeal extends MealEntry { profile: string }
export interface ProfiledBody extends BodyEntry { profile: string }

// 모든 프로필의 데이터를 합쳐서 반환. 통계 페이지 등 공용 뷰에서 사용.
// 현재 프로필 데이터는 reactive (실시간 갱신), 다른 프로필은 localStorage 스냅샷.
export function useAllProfilesData() {
  const profileStore = useProfileStore()
  const log = useLogStore()

  function readOther(p: string, key: string): unknown[] {
    try {
      const raw = localStorage.getItem(`wt.p.${p}.${key}`)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const otherWorkouts = computed<ProfiledWorkout[]>(() => {
    const out: ProfiledWorkout[] = []
    for (const p of profileStore.knownProfiles) {
      if (p === profileStore.activeProfile) continue
      for (const w of readOther(p, 'workouts') as WorkoutEntry[]) {
        out.push({ ...w, profile: p })
      }
    }
    return out
  })
  const otherMeals = computed<ProfiledMeal[]>(() => {
    const out: ProfiledMeal[] = []
    for (const p of profileStore.knownProfiles) {
      if (p === profileStore.activeProfile) continue
      for (const m of readOther(p, 'meals') as MealEntry[]) {
        out.push({ ...m, profile: p })
      }
    }
    return out
  })
  const otherBody = computed<ProfiledBody[]>(() => {
    const out: ProfiledBody[] = []
    for (const p of profileStore.knownProfiles) {
      if (p === profileStore.activeProfile) continue
      for (const b of readOther(p, 'body') as BodyEntry[]) {
        out.push({ ...b, profile: p })
      }
    }
    return out
  })

  const allWorkouts = computed<ProfiledWorkout[]>(() => {
    const me = profileStore.activeProfile
    return [
      ...log.workouts.map(w => ({ ...w, profile: me })),
      ...otherWorkouts.value,
    ]
  })
  const allMeals = computed<ProfiledMeal[]>(() => {
    const me = profileStore.activeProfile
    return [
      ...log.meals.map(m => ({ ...m, profile: me })),
      ...otherMeals.value,
    ]
  })
  const allBody = computed<ProfiledBody[]>(() => {
    const me = profileStore.activeProfile
    return [
      ...log.body.map(b => ({ ...b, profile: me })),
      ...otherBody.value,
    ]
  })

  return { allWorkouts, allMeals, allBody }
}

// 프로필 이름 → 안정적인 색상 매핑
const PROFILE_COLORS = ['#2f7d4a', '#b45309', '#1d4ed8', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#7c3aed']

export function colorForProfile(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash * 31) + name.charCodeAt(i)) >>> 0
  return PROFILE_COLORS[hash % PROFILE_COLORS.length]
}
