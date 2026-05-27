import { useLogStore, type WorkoutEntry, type MealEntry, type BodyEntry } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import { useProfileStore } from '@/stores/profile'
import type { FoodItem } from '@/data/foods'

type RecordType = 'meta' | 'workout' | 'meal' | 'body' | 'customFood'

interface MetaRecord {
  _type: 'meta'
  profile: string
  exportedAt: string
  version: number
}

interface TaggedWorkout extends WorkoutEntry { _type: 'workout' }
interface TaggedMeal extends MealEntry { _type: 'meal' }
interface TaggedBody extends BodyEntry { _type: 'body' }
interface TaggedFood extends FoodItem { _type: 'customFood' }

type AnyRecord = MetaRecord | TaggedWorkout | TaggedMeal | TaggedBody | TaggedFood

export interface ImportResult {
  added: { workouts: number; meals: number; body: number; customFoods: number }
  skipped: number
  invalid: number
  fromProfile: string | null
}

export function useJsonl() {
  const log = useLogStore()
  const catalog = useCatalogStore()
  const profile = useProfileStore()

  function exportToBlob(): Blob {
    const meta: MetaRecord = {
      _type: 'meta',
      profile: profile.activeProfile,
      exportedAt: new Date().toISOString(),
      version: 1,
    }
    const lines: AnyRecord[] = [meta]
    for (const w of log.workouts) lines.push({ _type: 'workout', ...w })
    for (const m of log.meals) lines.push({ _type: 'meal', ...m })
    for (const b of log.body) lines.push({ _type: 'body', ...b })
    for (const f of catalog.customFoods) lines.push({ _type: 'customFood', ...f })
    const body = lines.map(l => JSON.stringify(l)).join('\n')
    return new Blob([body], { type: 'application/x-ndjson' })
  }

  function downloadJsonl() {
    const blob = exportToBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `workout-${profile.activeProfile || 'export'}-${today}.jsonl`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function importFromFile(file: File, mode: 'merge' | 'replace' = 'merge'): Promise<ImportResult> {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)

    if (mode === 'replace') {
      log.workouts = []
      log.meals = []
      log.body = []
      catalog.customFoods = []
    }

    const workoutIds = new Set(log.workouts.map(w => w.id))
    const mealIds = new Set(log.meals.map(m => m.id))
    const bodyIds = new Set(log.body.map(b => b.id))
    const foodIds = new Set(catalog.customFoods.map(f => f.id))

    const newWorkouts: WorkoutEntry[] = []
    const newMeals: MealEntry[] = []
    const newBody: BodyEntry[] = []
    const newFoods: FoodItem[] = []
    let skipped = 0
    let invalid = 0
    let fromProfile: string | null = null

    for (const line of lines) {
      let rec: { _type?: RecordType } & Record<string, unknown>
      try {
        rec = JSON.parse(line)
      } catch {
        invalid++
        continue
      }
      switch (rec._type) {
        case 'meta':
          fromProfile = (rec.profile as string) ?? null
          break
        case 'workout': {
          const { _type: _t, ...data } = rec as unknown as TaggedWorkout
          if (workoutIds.has(data.id)) { skipped++; break }
          newWorkouts.push(data)
          workoutIds.add(data.id)
          break
        }
        case 'meal': {
          const { _type: _t, ...data } = rec as unknown as TaggedMeal
          if (mealIds.has(data.id)) { skipped++; break }
          newMeals.push(data)
          mealIds.add(data.id)
          break
        }
        case 'body': {
          const { _type: _t, ...data } = rec as unknown as TaggedBody
          if (bodyIds.has(data.id)) { skipped++; break }
          newBody.push(data)
          bodyIds.add(data.id)
          break
        }
        case 'customFood': {
          const { _type: _t, ...data } = rec as unknown as TaggedFood
          if (foodIds.has(data.id)) { skipped++; break }
          newFoods.push(data)
          foodIds.add(data.id)
          break
        }
        default:
          invalid++
      }
    }

    if (newWorkouts.length) log.workouts = [...log.workouts, ...newWorkouts]
    if (newMeals.length) log.meals = [...log.meals, ...newMeals]
    if (newBody.length) log.body = [...log.body, ...newBody]
    if (newFoods.length) catalog.customFoods = [...catalog.customFoods, ...newFoods]

    return {
      added: {
        workouts: newWorkouts.length,
        meals: newMeals.length,
        body: newBody.length,
        customFoods: newFoods.length,
      },
      skipped,
      invalid,
      fromProfile,
    }
  }

  return { downloadJsonl, importFromFile }
}
