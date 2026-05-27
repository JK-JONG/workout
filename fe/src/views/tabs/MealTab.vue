<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import { FOOD_CATEGORIES, type FoodItem } from '@/data/foods'
import type { Slot } from '@/data/mealPresets'

const log = useLogStore()
const catalog = useCatalogStore()
const { selectedDate, mealsOfDate } = storeToRefs(log)
const { foods, mealPresets, foodById } = storeToRefs(catalog)

const SLOTS: Slot[] = ['아침', '점심', '저녁', '간식']

const foodQuery = ref('')
const filteredFoods = computed(() => {
  const q = foodQuery.value.trim()
  if (!q) return foods.value
  return foods.value.filter(f => f.name.includes(q) || f.category.includes(q))
})

function slotFoodGroups(slot: Slot) {
  const ids = new Set<string>()
  for (const p of mealPresets.value) {
    if (p.slot !== slot) continue
    for (const it of p.items) ids.add(it.food_id)
  }
  const groups = new Map<string, FoodItem[]>()
  for (const id of ids) {
    const f = foodById.value.get(id)
    if (!f) continue
    if (foodQuery.value && !f.name.includes(foodQuery.value) && !f.category.includes(foodQuery.value)) continue
    const list = groups.get(f.category) ?? []
    list.push(f)
    groups.set(f.category, list)
  }
  return Array.from(groups.entries())
}

interface FoodSelection { foodId: string; slot: Slot }
const selectedFoods = ref<FoodSelection[]>([])
function isSelected(slot: Slot, foodId: string) {
  return selectedFoods.value.some(s => s.slot === slot && s.foodId === foodId)
}
function toggleSelected(slot: Slot, foodId: string) {
  const i = selectedFoods.value.findIndex(s => s.slot === slot && s.foodId === foodId)
  if (i >= 0) selectedFoods.value.splice(i, 1)
  else selectedFoods.value.push({ slot, foodId })
}
const selectedTotal = computed(() => {
  let kcal = 0, p = 0, c = 0, fa = 0
  for (const s of selectedFoods.value) {
    const f = foodById.value.get(s.foodId)
    if (!f) continue
    kcal += f.kcal; p += f.protein; c += f.carbs; fa += f.fat
  }
  return { kcal, p, c, fa, count: selectedFoods.value.length }
})
function addSelectedMeals() {
  for (const s of selectedFoods.value) {
    const f = foodById.value.get(s.foodId)
    if (!f) continue
    log.addMeal({
      date: selectedDate.value,
      foodId: f.id,
      foodName: `[${s.slot}] ${f.name}`,
      portion: 1,
      kcal: f.kcal,
      protein: Math.round(f.protein),
      carbs: Math.round(f.carbs),
      fat: Math.round(f.fat),
    })
  }
  selectedFoods.value = []
}

function addPreset(slot: Slot, pick: number) {
  const preset = mealPresets.value.find(p => p.slot === slot && p.pick === pick)
  if (!preset) return
  for (const item of preset.items) {
    const f = foodById.value.get(item.food_id)
    if (!f) continue
    log.addMeal({
      date: selectedDate.value,
      foodId: f.id,
      foodName: `[${slot} 택${pick}] ${f.name}`,
      portion: 1,
      kcal: f.kcal,
      protein: Math.round(f.protein),
      carbs: Math.round(f.carbs),
      fat: Math.round(f.fat),
    })
  }
}
function slotPresets(slot: Slot) {
  return mealPresets.value.filter(p => p.slot === slot).sort((a, b) => a.pick - b.pick)
}

const showAddFood = ref(false)
const newFood = ref({ name: '', kcal: 100, protein: 0, carbs: 0, fat: 0, category: '기타' })
function submitNewFood() {
  if (!newFood.value.name.trim()) return
  catalog.addCustomFood({ ...newFood.value })
  showAddFood.value = false
  newFood.value = { name: '', kcal: 100, protein: 0, carbs: 0, fat: 0, category: '기타' }
}

const presetFoodIds = computed(() => {
  const s = new Set<string>()
  for (const p of mealPresets.value) for (const it of p.items) s.add(it.food_id)
  return s
})
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2 class="card-title">식단</h2>
      <div class="card-head-tools">
        <input class="input input-sm search-inline" type="text" v-model="foodQuery" placeholder="음식 검색…" />
        <button class="btn btn-ghost btn-sm" @click="showAddFood = !showAddFood">
          {{ showAddFood ? '취소' : '+ 등록' }}
        </button>
      </div>
    </div>

    <div v-if="showAddFood" class="form-grid">
      <label class="field">
        <span class="field-label">이름</span>
        <input class="input" type="text" v-model="newFood.name" placeholder="예: 그릭요거트(저지방)" />
      </label>
      <div class="form-row-2">
        <label class="field">
          <span class="field-label">분류</span>
          <select class="input" v-model="newFood.category">
            <option v-for="c in FOOD_CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">kcal</span>
          <input class="input num" type="number" v-model.number="newFood.kcal" min="0" max="2000" />
        </label>
      </div>
      <div class="form-row-3">
        <label class="field">
          <span class="field-label">단백질(g)</span>
          <input class="input num" type="number" v-model.number="newFood.protein" min="0" />
        </label>
        <label class="field">
          <span class="field-label">탄수(g)</span>
          <input class="input num" type="number" v-model.number="newFood.carbs" min="0" />
        </label>
        <label class="field">
          <span class="field-label">지방(g)</span>
          <input class="input num" type="number" v-model.number="newFood.fat" min="0" />
        </label>
      </div>
      <button class="btn btn-primary" @click="submitNewFood">내 음식으로 저장</button>
    </div>

    <div class="meal-grid">
      <div v-for="slot in SLOTS" :key="slot" class="meal-slot">
        <div class="meal-slot-head">
          <span class="meal-slot-name">{{ slot }}</span>
          <div class="meal-slot-presets">
            <button
              v-for="p in slotPresets(slot)"
              :key="p.pick"
              class="btn-mini"
              @click="addPreset(slot, p.pick)"
              :title="`택${p.pick} 통째 추가`"
            >택{{ p.pick }}</button>
          </div>
        </div>
        <div class="pool">
          <div v-for="[cat, list] in slotFoodGroups(slot)" :key="cat" class="pool-group">
            <div class="pool-group-head">{{ cat }}</div>
            <div class="pool-items">
              <label
                v-for="f in list"
                :key="f.id"
                class="check-card"
                :class="{ checked: isSelected(slot, f.id) }"
              >
                <input
                  type="checkbox"
                  :checked="isSelected(slot, f.id)"
                  @change="toggleSelected(slot, f.id)"
                />
                <div class="cc-body">
                  <div class="cc-name">{{ f.name }}</div>
                  <div class="cc-meta muted">
                    <span class="num">{{ f.kcal }}</span> kcal · P{{ f.protein }}·C{{ f.carbs }}·F{{ f.fat }}
                  </div>
                </div>
              </label>
            </div>
          </div>
          <div v-if="slotFoodGroups(slot).length === 0" class="empty">검색 결과 없음</div>
        </div>
      </div>
    </div>

    <details class="extra-foods">
      <summary>다른 음식 추가 (등록 음식 + 카탈로그 외)</summary>
      <div class="pool-items extra-grid">
        <label
          v-for="f in filteredFoods.filter(x => !presetFoodIds.has(x.id))"
          :key="f.id"
          class="check-card"
          :class="{ checked: selectedFoods.some(s => s.foodId === f.id) }"
        >
          <input
            type="checkbox"
            :checked="selectedFoods.some(s => s.foodId === f.id)"
            @change="toggleSelected('아침', f.id)"
          />
          <div class="cc-body">
            <div class="cc-name">{{ f.name }}
              <span v-if="f.id.startsWith('custom-')" class="tag tag-soft">내 음식</span>
            </div>
            <div class="cc-meta muted">
              <span class="num">{{ f.kcal }}</span> kcal · P{{ f.protein }}·C{{ f.carbs }}·F{{ f.fat }}
            </div>
          </div>
        </label>
      </div>
    </details>

    <div class="sticky-add" :class="{ visible: selectedTotal.count > 0 }">
      <div class="sa-info">
        <span class="num">{{ selectedTotal.count }}개 선택</span>
        <span class="muted">·</span>
        <span class="num accent">{{ selectedTotal.kcal }} kcal</span>
        <span class="muted small">
          P{{ Math.round(selectedTotal.p) }} · C{{ Math.round(selectedTotal.c) }} · F{{ Math.round(selectedTotal.fa) }}
        </span>
      </div>
      <button class="btn btn-primary" @click="addSelectedMeals">선택한 음식 기록</button>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2 class="card-title">오늘 식단 기록</h2>
      <span class="muted small">{{ mealsOfDate.length }}건</span>
    </div>
    <ul class="list">
      <li v-for="m in mealsOfDate" :key="m.id" class="row-item">
        <div class="row-main">
          <div class="row-name">{{ m.foodName }} <span class="muted small">×{{ m.portion }}</span></div>
          <div class="row-sub muted">P {{ m.protein }}g · C {{ m.carbs }}g · F {{ m.fat }}g</div>
        </div>
        <div class="row-actions">
          <span class="num">{{ m.kcal }} kcal</span>
          <button class="icon-btn" @click="log.removeMeal(m.id)" aria-label="삭제">×</button>
        </div>
      </li>
      <li v-if="mealsOfDate.length === 0" class="empty">기록 없음</li>
    </ul>
  </section>
</template>

<style scoped>
.card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-xs); margin-bottom: 14px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.card-title { font-size: var(--fs-md); font-weight: 600; color: var(--c-text-soft); letter-spacing: 0.01em; }
.card-head-tools { display: flex; gap: 8px; align-items: center; }
.search-inline { min-width: 200px; }

.input { width: 100%; height: 32px; padding: 0 10px; border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); font-size: var(--fs-md); color: var(--c-text); transition: border 0.15s, box-shadow 0.15s; }
.input::placeholder { color: var(--c-text-muted); }
.input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }
.input-sm { height: 28px; width: auto; min-width: 70px; }
select.input { background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path fill='%239a948a' d='M2 4l4 4 4-4'/></svg>"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 26px; }
.field { display: flex; flex-direction: column; gap: 3px; }
.field-label { font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.02em; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.form-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.form-grid { display: grid; gap: 8px; padding: 12px; background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: var(--radius-md); margin-bottom: 12px; }

.list { display: flex; flex-direction: column; gap: 1px; }
.row-item { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: var(--radius-md); transition: background 0.12s; }
.row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.row-name { font-size: var(--fs-md); color: var(--c-text); }
.row-sub { display: flex; flex-wrap: wrap; gap: 6px; font-size: var(--fs-xs); color: var(--c-text-muted); }
.row-actions { display: flex; align-items: center; gap: 6px; }
.empty { padding: 12px 10px; font-size: var(--fs-sm); color: var(--c-text-muted); text-align: center; }
.tag { display: inline-block; padding: 1px 6px; font-size: var(--fs-xs); border: 1px solid var(--c-border-strong); border-radius: var(--radius-xs); color: var(--c-text-soft); }
.tag-soft { background: var(--c-accent-soft); border-color: var(--c-accent-soft); color: var(--c-accent-ink); }
.accent { color: var(--c-accent); }
.muted { color: var(--c-text-muted); }
.small { font-size: var(--fs-xs); font-weight: normal; }

.meal-grid { display: grid; gap: 14px; }
@media (min-width: 920px) { .meal-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 920px) and (max-width: 1180px) { .meal-grid { grid-template-columns: repeat(2, 1fr); } }
.meal-slot { background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: var(--radius-md); padding: 10px 12px; }
.meal-slot-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--c-border); }
.meal-slot-name { font-size: var(--fs-md); font-weight: 600; color: var(--c-accent-ink); }
.meal-slot-presets { display: flex; gap: 4px; }

.pool { display: grid; gap: 8px; }
.pool-group-head { font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 3px; }
.pool-items { display: grid; gap: 4px; }
.check-card { display: flex; align-items: flex-start; gap: 6px; padding: 6px 8px; cursor: pointer; border: 1px solid var(--c-border); border-radius: var(--radius-sm); background: var(--c-surface); transition: border 0.15s, background 0.15s; }
.check-card:hover { background: var(--c-chip); }
.check-card.checked { border-color: var(--c-accent); background: var(--c-accent-soft); }
.check-card input[type='checkbox'] {
  appearance: none; -webkit-appearance: none;
  width: 13px; height: 13px; margin-top: 2px;
  border: 1.5px solid var(--c-border-strong); border-radius: 3px;
  background: var(--c-surface); cursor: pointer; flex-shrink: 0;
}
.check-card input[type='checkbox']:checked {
  background: var(--c-accent); border-color: var(--c-accent);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path fill='none' stroke='white' stroke-width='2' d='M2.5 6.5l2.5 2.5 4.5-5'/></svg>");
  background-repeat: no-repeat; background-position: center;
}
.cc-body { min-width: 0; flex: 1; }
.cc-name { font-size: var(--fs-sm); color: var(--c-text); line-height: 1.3; }
.cc-meta { font-size: var(--fs-xs); margin-top: 1px; }

.extra-foods { margin-top: 12px; }
.extra-foods summary { font-size: var(--fs-sm); color: var(--c-text-soft); cursor: pointer; padding: 6px 0; list-style: none; }
.extra-foods summary::before { content: '▸ '; }
.extra-foods[open] summary::before { content: '▾ '; }
.extra-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); margin-top: 6px; }

.sticky-add {
  position: sticky; bottom: 8px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-top: 12px; padding: 10px 12px;
  background: var(--c-surface); border: 1px solid var(--c-accent);
  border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  opacity: 0; transform: translateY(8px); pointer-events: none;
  transition: opacity 0.18s, transform 0.18s;
}
.sticky-add.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
.sa-info { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; font-size: var(--fs-md); }

.btn { display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 0 12px; font-size: var(--fs-sm); font-weight: 500; border-radius: var(--radius-md); transition: background 0.15s; }
.btn-sm { height: 26px; padding: 0 8px; font-size: var(--fs-xs); }
.btn-primary { background: var(--c-accent); color: #fff; box-shadow: var(--shadow-xs); }
.btn-primary:hover { background: var(--c-accent-ink); }
.btn-ghost { background: transparent; color: var(--c-text-soft); border: 1px solid var(--c-border-strong); }
.btn-ghost:hover { background: var(--c-surface-2); color: var(--c-text); }
.btn-mini { height: 22px; padding: 0 8px; font-size: var(--fs-xs); background: var(--c-surface); color: var(--c-accent-ink); border: 1px solid var(--c-accent-soft); border-radius: 999px; }
.btn-mini:hover { background: var(--c-accent-soft); }
.icon-btn { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--c-text-muted); border-radius: 50%; }
.icon-btn:hover { background: var(--c-border); color: var(--c-text); }

@media (max-width: 760px) {
  .meal-grid { grid-template-columns: 1fr !important; }
}
</style>
