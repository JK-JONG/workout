import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useProfileStorage } from '@/composables/useProfileStorage'
import type { Slot } from '@/data/mealPresets'

export interface MealEntry {
  id: string
  date: string        // YYYY-MM-DD
  foodId: string
  foodName: string
  slot?: Slot         // 아침/점심/저녁/간식 — 신규 entry에서 명시. 옛 entry는 foodName 접두 파싱으로 추출.
  portion: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: number
}

// 옛 entry는 foodName이 "[아침] xxx" 형태였음. 신규 entry는 slot 필드 사용.
const SLOT_TOKENS: Slot[] = ['아침', '점심', '저녁', '간식']
export function resolveSlot(m: MealEntry): Slot | null {
  if (m.slot) return m.slot
  const match = m.foodName.match(/^\[([^\]]+)\]/)
  if (!match) return null
  for (const s of SLOT_TOKENS) if (match[1].includes(s)) return s
  return null
}
export function displayName(m: MealEntry): string {
  // 신규 entry는 slot 필드를 쓰므로 foodName이 깨끗함. 옛 entry는 "[아침] xxx" 접두 제거.
  if (m.slot) return m.foodName
  return m.foodName.replace(/^\[[^\]]+\]\s*/, '')
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

  // 같은 날짜·운동에 다시 입력이 들어오면 별도 row가 아니라 기존 entry를 새 값으로 교체.
  // 합산이 아니라 덮어쓰기 — picker에 직전 값이 prefill 되므로 사용자가 수정 후 저장하면
  // "수정"의 의미. 합산을 원하면 세트를 늘려서 한 번에 저장해야 함.
  // id와 createdAt은 보존해서 외부 참조·정렬 안정성 유지.
  function upsertWorkout(e: Omit<WorkoutEntry, 'id' | 'createdAt'>) {
    const idx = workouts.value.findIndex(w => w.date === e.date && w.exerciseId === e.exerciseId)
    if (idx < 0) {
      addWorkout(e)
      return
    }
    const existing = workouts.value[idx]
    const replaced: WorkoutEntry = {
      ...e,
      id: existing.id,
      createdAt: existing.createdAt,
    }
    workouts.value = [...workouts.value.slice(0, idx), replaced, ...workouts.value.slice(idx + 1)]
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

  // 같은 운동의 가장 최근 기록. 오늘(selectedDate)에 이미 추가한 기록도 포함 — 같은 운동을
  // 다시 선택했을 때 직전에 입력한 reps/weight가 그대로 prefill 되도록.
  function lastWorkoutOf(exerciseId: string): WorkoutEntry | null {
    const candidates = workouts.value
      .filter(w => w.exerciseId === exerciseId && w.date <= selectedDate.value)
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
    upsertWorkout,
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
