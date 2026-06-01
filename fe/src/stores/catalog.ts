import { defineStore } from 'pinia'
import { computed } from 'vue'
import { EXERCISES, type ExerciseItem } from '@/data/exercises'
import { FOODS, type FoodItem } from '@/data/foods'
import { MEAL_PRESETS, type MealPreset } from '@/data/mealPresets'
import { useProfileStorage } from '@/composables/useProfileStorage'

// 정적 데이터 기반 카탈로그. 커스텀 음식·운동은 프로필별 localStorage에 누적.
export interface ExerciseRequest { name: string; requestedAt: string }

export const useCatalogStore = defineStore('catalog', () => {
  const customFoods = useProfileStorage<FoodItem[]>('customFoods', [])
  const customExercises = useProfileStorage<ExerciseItem[]>('customExercises', [])
  // 커스텀 음식 삭제 톰스톤. sync union 머지에서 부활을 막는다.
  const deletedCustomFoodIds = useProfileStorage<string[]>('deletedCustomFoodIds', [])
  // 프로필별 운동 즐겨찾기 id 목록.
  const favoriteExerciseIds = useProfileStorage<string[]>('favoriteExerciseIds', [])
  // 사용자가 추가 요청한 운동 이름 목록 (관리자가 보고 한 번에 카탈로그에 반영).
  const exerciseRequests = useProfileStorage<ExerciseRequest[]>('exerciseRequests', [])

  const exercises = computed<ExerciseItem[]>(() => [...EXERCISES, ...customExercises.value])
  const foods = computed<FoodItem[]>(() => [...FOODS, ...customFoods.value])
  const mealPresets = computed<MealPreset[]>(() => MEAL_PRESETS)

  const routines = computed(() => {
    const map = new Map<string, ExerciseItem[]>()
    for (const e of exercises.value) {
      if (!e.routine) continue
      const list = map.get(e.routine) ?? []
      list.push(e)
      map.set(e.routine, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
    }
    return map
  })

  const foodById = computed(() => {
    const m = new Map<string, FoodItem>()
    for (const f of foods.value) m.set(f.id, f)
    return m
  })

  function addCustomFood(payload: Omit<FoodItem, 'id'>): FoodItem {
    const created: FoodItem = { ...payload, id: `custom-${crypto.randomUUID()}` }
    customFoods.value = [...customFoods.value, created]
    return created
  }

  function removeCustomFood(id: string) {
    customFoods.value = customFoods.value.filter(f => f.id !== id)
    if (!deletedCustomFoodIds.value.includes(id)) {
      deletedCustomFoodIds.value = [...deletedCustomFoodIds.value, id]
    }
  }

  function addCustomExercise(payload: Omit<ExerciseItem, 'id'>): ExerciseItem {
    const created: ExerciseItem = { ...payload, id: `custom-ex-${crypto.randomUUID()}` }
    customExercises.value = [...customExercises.value, created]
    return created
  }

  function removeCustomExercise(id: string) {
    customExercises.value = customExercises.value.filter(e => e.id !== id)
  }

  function isFavorite(id: string): boolean { return favoriteExerciseIds.value.includes(id) }
  function toggleFavorite(id: string) {
    favoriteExerciseIds.value = isFavorite(id)
      ? favoriteExerciseIds.value.filter(x => x !== id)
      : [...favoriteExerciseIds.value, id]
  }

  function addExerciseRequest(name: string): boolean {
    const n = name.trim()
    if (!n || n.length > 60) return false
    // 중복 방지 (같은 이름이 이미 요청에 있거나, 카탈로그에 이미 있으면 거부)
    if (exerciseRequests.value.some(r => r.name === n)) return false
    if (exercises.value.some(e => e.name === n)) return false
    exerciseRequests.value = [...exerciseRequests.value, { name: n, requestedAt: new Date().toISOString() }]
    return true
  }
  function removeExerciseRequest(name: string) {
    exerciseRequests.value = exerciseRequests.value.filter(r => r.name !== name)
  }

  return {
    exercises, foods, mealPresets, customFoods, customExercises, favoriteExerciseIds, exerciseRequests,
    deletedCustomFoodIds,
    routines, foodById,
    addCustomFood, removeCustomFood,
    addCustomExercise, removeCustomExercise,
    isFavorite, toggleFavorite,
    addExerciseRequest, removeExerciseRequest,
  }
})
