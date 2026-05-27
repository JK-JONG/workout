import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useProfileStorage } from '@/composables/useProfileStorage'

export interface MealEntry {
  id: string
  date: string        // YYYY-MM-DD
  foodId: string
  foodName: string
  portion: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: number
}

export interface SetLog {
  reps: number
  weight?: number
}

export interface WorkoutEntry {
  id: string
  date: string
  exerciseId: string
  exerciseName: string
  unit: 'reps' | 'time' | 'distance'
  sets?: number
  reps?: number
  weight?: number
  setLogs?: SetLog[]
  minutes?: number
  km?: number
  kcal: number
  createdAt: number
}

export interface BodyEntry {
  id: string
  date: string        // YYYY-MM-DD
  weightKg: number    // 필수
  bodyFatPct?: number
  muscleKg?: number
  note?: string
  createdAt: number
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useLogStore = defineStore('log', () => {
  // 사용자 기본 체중 (운동 칼로리 계산용 — 신체 기록의 최신 weightKg 와는 별도)
  const weightKg = useProfileStorage<number>('weight', 70)
  const meals = useProfileStorage<MealEntry[]>('meals', [])
  const workouts = useProfileStorage<WorkoutEntry[]>('workouts', [])
  const body = useProfileStorage<BodyEntry[]>('body', [])
  const selectedDate = useProfileStorage<string>('selectedDate', todayStr())

  function addMeal(e: Omit<MealEntry, 'id' | 'createdAt'>) {
    meals.value = [...meals.value, { ...e, id: crypto.randomUUID(), createdAt: Date.now() }]
  }
  function addWorkout(e: Omit<WorkoutEntry, 'id' | 'createdAt'>) {
    workouts.value = [...workouts.value, { ...e, id: crypto.randomUUID(), createdAt: Date.now() }]
  }
  function addBody(e: Omit<BodyEntry, 'id' | 'createdAt'>) {
    body.value = [...body.value, { ...e, id: crypto.randomUUID(), createdAt: Date.now() }]
  }
  function removeMeal(id: string) { meals.value = meals.value.filter(m => m.id !== id) }
  function removeWorkout(id: string) { workouts.value = workouts.value.filter(w => w.id !== id) }
  function removeBody(id: string) { body.value = body.value.filter(b => b.id !== id) }

  function updateBody(id: string, patch: Partial<Omit<BodyEntry, 'id' | 'createdAt'>>) {
    body.value = body.value.map(b => b.id === id ? { ...b, ...patch } : b)
  }

  // 선택된 날짜의 합계
  const mealsOfDate = computed(() => meals.value.filter(m => m.date === selectedDate.value))
  const workoutsOfDate = computed(() => workouts.value.filter(w => w.date === selectedDate.value))
  const bodyOfDate = computed(() => body.value.filter(b => b.date === selectedDate.value))

  const kcalIn = computed(() => mealsOfDate.value.reduce((s, m) => s + m.kcal, 0))
  const kcalOut = computed(() => workoutsOfDate.value.reduce((s, w) => s + w.kcal, 0))
  const kcalNet = computed(() => kcalIn.value - kcalOut.value)

  const dailyOutMap = computed(() => {
    const m = new Map<string, number>()
    for (const w of workouts.value) m.set(w.date, (m.get(w.date) ?? 0) + w.kcal)
    return m
  })
  const dailyInMap = computed(() => {
    const m = new Map<string, number>()
    for (const e of meals.value) m.set(e.date, (m.get(e.date) ?? 0) + e.kcal)
    return m
  })

  function lastWorkoutOf(exerciseId: string): WorkoutEntry | null {
    const candidates = workouts.value
      .filter(w => w.exerciseId === exerciseId && w.date < selectedDate.value)
      .sort((a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt))
    return candidates[0] ?? null
  }

  // 최신 신체 기록 (체중·체지방·근육량의 최근값)
  const latestBody = computed<BodyEntry | null>(() => {
    if (!body.value.length) return null
    return [...body.value].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0]
  })

  // 선택된 날짜에 신체 기록이 없고 과거에 기록이 있으면 그 날짜로 자동 복제.
  // 운동 kcal 계산용 기준 체중도 함께 갱신.
  // 같은 날짜에 두 번 복제되지 않도록 호출부에서 한 번만 부르면 된다.
  function carryoverBodyTo(date: string): boolean {
    const exists = body.value.some(b => b.date === date)
    if (exists) {
      // 이미 그날 기록이 있으면 weightKg만 운동 기준에 반영
      const today = body.value.find(b => b.date === date)
      if (today) weightKg.value = today.weightKg
      return false
    }
    const last = latestBody.value
    if (!last) return false
    body.value = [
      ...body.value,
      {
        ...last,
        id: crypto.randomUUID(),
        date,
        createdAt: Date.now(),
      },
    ]
    weightKg.value = last.weightKg
    return true
  }

  return {
    carryoverBodyTo,
    weightKg,
    meals, workouts, body, selectedDate,
    mealsOfDate, workoutsOfDate, bodyOfDate,
    kcalIn, kcalOut, kcalNet,
    dailyOutMap, dailyInMap,
    latestBody,
    addMeal, addWorkout, addBody,
    removeMeal, removeWorkout, removeBody, updateBody,
    lastWorkoutOf,
  }
})
