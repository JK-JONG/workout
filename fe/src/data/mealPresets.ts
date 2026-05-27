// 박종권 식단표 (택1~5 × 아침/점심/저녁/간식)

export type Slot = '아침' | '점심' | '저녁' | '간식'

export interface MealPresetItem {
  food_id: string
  order_no: number
}

export interface MealPreset {
  slot: Slot
  pick: number
  items: MealPresetItem[]
}

const presetRows: [Slot, number, string[]][] = [
  // 아침
  ['아침', 1, ['greek-yogurt', 'boiled-egg-2', 'olive-lemon', 'almond-14']],
  ['아침', 2, ['apple', 'boiled-egg-2', 'olive-lemon', 'veggie-salad']],
  ['아침', 3, ['greek-yogurt', 'banana', 'olive-lemon', 'almond-14']],
  ['아침', 4, ['oatmeal-60g', 'boiled-egg-2', 'olive-lemon', 'almond-14']],
  // 점심
  ['점심', 1, ['sweet-potato-200', 'chicken-breast-200', 'veggie-salad', 'broccoli-100']],
  ['점심', 2, ['chicken-breast-200', 'cabbage-steamed', 'brown-rice-210', 'broccoli-100']],
  ['점심', 3, ['chicken-breast-200', 'pumpkin-half', 'boiled-egg']],
  ['점심', 4, ['tuna-can-small', 'chicken-breast-100', 'brown-rice-210', 'cucumber-pepper']],
  // 저녁
  ['저녁', 1, ['chicken-breast-200', 'brown-rice-210', 'cherry-tomato']],
  ['저녁', 2, ['mackerel-grilled', 'brown-rice-210', 'broccoli-100']],
  ['저녁', 3, ['beef-lowfat-200', 'brown-rice-210', 'mushroom-grilled', 'ssam-vegetables']],
  ['저녁', 4, ['tofu-half', 'chicken-breast-100', 'sweet-potato-200', 'cherry-tomato']],
  ['저녁', 5, ['soy-egg-rice', 'chicken-breast-100']],
  // 간식
  ['간식', 1, ['wing-shake', 'banana']],
  ['간식', 2, ['wing-shake', 'black-soy-milk']],
  ['간식', 3, ['energy-bar']],
]

export const MEAL_PRESETS: MealPreset[] = presetRows.map(([slot, pick, ids]) => ({
  slot,
  pick,
  items: ids.map((food_id, i) => ({ food_id, order_no: i })),
}))
