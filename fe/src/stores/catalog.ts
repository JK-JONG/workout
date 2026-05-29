import { defineStore } from 'pinia'
import { computed } from 'vue'
import { EXERCISES, type ExerciseItem } from '@/data/exercises'
import { FOODS, type FoodItem } from '@/data/foods'
import { MEAL_PRESETS, type MealPreset } from '@/data/mealPresets'
import { useProfileStorage } from '@/composables/useProfileStorage'

// 정적 데이터 기반 카탈로그. 커스텀 음식·운동은 프로필별 localStorage에 누적.
export const useCatalogStore = defineStore('catalog', () => {
  const customFoods = useProfileStorage<FoodItem[]>('customFoods', [])
  const customExercises = useProfileStorage<ExerciseItem[]>('customExercises', [])
  // 프로필별 운동 즐겨찾기 id 목록.
  const favoriteExerciseIds = useProfileStorage<string[]>('favoriteExerciseIds', [])

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

  return {
    exercises, foods, mealPresets, customFoods, customExercises, favoriteExerciseIds,
    routines, foodById,
    addCustomFood, removeCustomFood,
    addCustomExercise, removeCustomExercise,
    isFavorite, toggleFavorite,
  }
})
