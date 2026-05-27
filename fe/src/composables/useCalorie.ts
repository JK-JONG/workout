// MET 기반 칼로리 계산.
// 공식: kcal/min = (MET × 3.5 × 체중kg) / 200

import type { ExerciseItem } from '@/data/exercises'

export function kcalByDuration(met: number, weightKg: number, minutes: number): number {
  return Math.round((met * 3.5 * weightKg * minutes) / 200)
}

// 달리기: 9 km/h 가정 (~1km = 6.7분)
export function kcalByDistance(met: number, weightKg: number, km: number): number {
  return kcalByDuration(met, weightKg, km * 6.7)
}

export function kcalByReps(ex: ExerciseItem, weightKg: number, sets: number, reps: number): number {
  const perSet = ex.duration_per_set ?? 0.7
  const factor = reps / 10
  return kcalByDuration(ex.met, weightKg, sets * perSet * factor)
}
