<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, resolveSlot, displayName, type MealEntry } from '@/stores/log'
import { useCatalogStore } from '@/stores/catalog'
import { type FoodItem } from '@/data/foods'
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

// 오늘 이미 로그된 (slot, foodId) 조합. 토글 UI 시각화·중복 추가 방지에 사용.
const loggedSet = computed(() => {
  const s = new Set<string>()
  for (const m of mealsOfDate.value) {
    const slot = resolveSlot(m)
    if (slot) s.add(`${slot}::${m.foodId}`)
  }
  return s
})
function isAlreadyLogged(slot: Slot, foodId: string) {
  return loggedSet.value.has(`${slot}::${foodId}`)
}
function isSelected(slot: Slot, foodId: string) {
  return selectedFoods.value.some(s => s.slot === slot && s.foodId === foodId)
}
function isChecked(slot: Slot, foodId: string) {
  return isAlreadyLogged(slot, foodId) || isSelected(slot, foodId)
}
function toggleSelected(slot: Slot, foodId: string) {
  if (isAlreadyLogged(slot, foodId)) return // 이미 기록된 항목은 토글 안 됨 (시각적으로만 체크)
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
      foodName: f.name,
      slot: s.slot,
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
    if (isAlreadyLogged(slot, f.id)) continue // 이미 같은 슬롯에 있는 항목은 건너뜀
    log.addMeal({
      date: selectedDate.value,
      foodId: f.id,
      foodName: `${f.name} (택${pick})`,
      slot,
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

// ── 즉석 추가 (당일 한정 — customFood 영구 등록 X) ──
const showQuickAdd = ref(false)
const quickName = ref('')
const quickKcal = ref<number | null>(null)
const quickSlot = ref<Slot>('점심')
const quickErr = ref('')

function submitQuickAdd() {
  quickErr.value = ''
  const name = quickName.value.trim()
  if (!name) { quickErr.value = '음식명을 입력해주세요.'; return }
  if (quickKcal.value == null || quickKcal.value <= 0) { quickErr.value = '칼로리를 입력해주세요.'; return }
  log.addMeal({
    date: selectedDate.value,
    foodId: `quick-${crypto.randomUUID()}`,
    foodName: name,
    slot: quickSlot.value,
    portion: 1,
    kcal: quickKcal.value,
    protein: 0,
    carbs: 0,
    fat: 0,
  })
  quickName.value = ''
  quickKcal.value = null
}

const presetFoodIds = computed(() => {
  const s = new Set<string>()
  for (const p of mealPresets.value) for (const it of p.items) s.add(it.food_id)
  return s
})

// 오늘 식단을 슬롯별로 그룹화
function mealsOfSlot(slot: Slot): MealEntry[] {
  return mealsOfDate.value.filter(m => resolveSlot(m) === slot)
}
function unslottedMeals(): MealEntry[] {
  return mealsOfDate.value.filter(m => !resolveSlot(m))
}
function slotKcal(slot: Slot): number {
  return mealsOfSlot(slot).reduce((s, m) => s + m.kcal, 0)
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2 class="card-title">식단</h2>
      <div class="card-head-tools">
        <input class="input input-sm search-inline" type="text" v-model="foodQuery" placeholder="음식 검색…" />
        <button class="btn btn-ghost btn-sm" @click="showQuickAdd = !showQuickAdd">
          {{ showQuickAdd ? '취소' : '+ 즉석 추가' }}
        </button>
      </div>
    </div>

    <!-- 즉석 추가: 음식명 + kcal + 슬롯 — 그날 한정. 카탈로그에 영구 저장 X -->
    <form v-if="showQuickAdd" class="quick-form" @submit.prevent="submitQuickAdd">
      <div class="quick-row">
        <input
          class="input quick-name"
          type="text"
          v-model="quickName"
          placeholder="음식명 (예: 회식 삼겹살)"
          maxlength="40"
        />
        <input
          class="input num quick-kcal"
          type="number"
          v-model.number="quickKcal"
          min="0"
          max="3000"
          placeholder="kcal"
        />
        <select class="input quick-slot" v-model="quickSlot">
          <option v-for="s in SLOTS" :key="s" :value="s">{{ s }}</option>
        </select>
        <button type="submit" class="btn btn-primary btn-sm">추가</button>
      </div>
      <div class="quick-hint muted small">오늘 기록에만 추가됩니다 (다음 날엔 음식 목록에 남지 않음).</div>
      <div v-if="quickErr" class="err small">{{ quickErr }}</div>
    </form>

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
                :class="{
                  checked: isChecked(slot, f.id),
                  logged: isAlreadyLogged(slot, f.id),
                }"
              >
                <input
                  type="checkbox"
                  :checked="isChecked(slot, f.id)"
                  :disabled="isAlreadyLogged(slot, f.id)"
                  @change="toggleSelected(slot, f.id)"
                />
                <div class="cc-body">
                  <div class="cc-name">
                    {{ f.name }}
                    <span v-if="isAlreadyLogged(slot, f.id)" class="cc-tag">기록됨</span>
                  </div>
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
          :class="{ checked: isChecked('아침', f.id), logged: isAlreadyLogged('아침', f.id) }"
        >
          <input
            type="checkbox"
            :checked="isChecked('아침', f.id)"
            :disabled="isAlreadyLogged('아침', f.id)"
            @change="toggleSelected('아침', f.id)"
          />
          <div class="cc-body">
            <div class="cc-name">{{ f.name }}
              <span v-if="f.id.startsWith('custom-')" class="tag tag-soft">내 음식</span>
              <span v-if="isAlreadyLogged('아침', f.id)" class="cc-tag">기록됨</span>
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
    <div v-if="mealsOfDate.length === 0" class="empty">기록 없음</div>
    <div v-else class="slot-grid">
      <div v-for="slot in SLOTS" :key="slot" class="slot-col" :class="{ filled: mealsOfSlot(slot).length > 0 }">
        <div class="slot-col-head">
          <span class="slot-col-name">{{ slot }}</span>
          <span class="slot-col-meta num">
            <template v-if="mealsOfSlot(slot).length">
              {{ mealsOfSlot(slot).length }}건 · <b class="accent">{{ slotKcal(slot) }}</b> kcal
            </template>
            <template v-else>—</template>
          </span>
        </div>
        <ul class="slot-list">
          <li v-for="m in mealsOfSlot(slot)" :key="m.id" class="slot-item">
            <div class="slot-item-main">
              <div class="slot-item-name">{{ displayName(m) }}</div>
              <div class="slot-item-meta muted num">
                {{ m.kcal }} kcal
                <template v-if="m.protein || m.carbs || m.fat">
                  · P{{ m.protein }}·C{{ m.carbs }}·F{{ m.fat }}
                </template>
              </div>
            </div>
            <button class="icon-btn" @click="log.removeMeal(m.id)" aria-label="삭제">×</button>
          </li>
          <li v-if="mealsOfSlot(slot).length === 0" class="slot-empty">없음</li>
        </ul>
      </div>
    </div>
    <!-- 슬롯 정보 없는 옛 데이터 (foodName에 [xxx] prefix 없음) -->
    <div v-if="unslottedMeals().length" class="unslotted">
      <div class="unslotted-head">슬롯 미지정</div>
      <ul class="slot-list">
        <li v-for="m in unslottedMeals()" :key="m.id" class="slot-item">
          <div class="slot-item-main">
            <div class="slot-item-name">{{ m.foodName }}</div>
            <div class="slot-item-meta muted num">{{ m.kcal }} kcal</div>
          </div>
          <button class="icon-btn" @click="log.removeMeal(m.id)" aria-label="삭제">×</button>
        </li>
      </ul>
    </div>
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

/* ─── 즉석 추가 폼 ─── */
.quick-form {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}
.quick-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px 90px auto;
  gap: 6px;
  align-items: center;
}
@media (max-width: 640px) {
  .quick-row { grid-template-columns: 1fr 1fr; }
  .quick-name { grid-column: 1 / -1; }
}
.quick-name { min-width: 0; }
.quick-kcal { text-align: right; }
.quick-hint { padding: 0 2px; }
.err { color: var(--c-danger); padding: 0 2px; }

/* ─── 등록됨 표시 ─── */
.check-card.logged {
  background: var(--c-accent-soft);
  border-color: var(--c-accent);
  opacity: 0.85;
  cursor: default;
}
.check-card.logged:hover { background: var(--c-accent-soft); }
.check-card input[type='checkbox']:disabled { cursor: default; opacity: 1; }
.cc-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  background: var(--c-accent);
  color: #fff;
  border-radius: 999px;
  letter-spacing: 0.02em;
  vertical-align: 1px;
}

/* ─── 오늘 식단 슬롯 그리드 ─── */
.slot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
@media (max-width: 920px) { .slot-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 520px) { .slot-grid { grid-template-columns: 1fr; } }
.slot-col {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  min-height: 90px;
}
.slot-col.filled {
  background: var(--c-surface);
  border-color: var(--c-border-strong);
}
.slot-col-head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--c-border);
}
.slot-col-name {
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-accent-ink);
  letter-spacing: -0.005em;
}
.slot-col-meta { font-size: var(--fs-xs); color: var(--c-text-muted); }
.slot-list { display: flex; flex-direction: column; gap: 2px; }
.slot-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 4px;
  border-bottom: 1px dashed var(--c-border);
}
.slot-item:last-child { border-bottom: none; }
.slot-item-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.slot-item-name { font-size: var(--fs-sm); color: var(--c-text); }
.slot-item-meta { font-size: var(--fs-xs); }
.slot-empty {
  padding: 8px 4px;
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  text-align: center;
  font-style: italic;
}
.unslotted {
  margin-top: 10px;
  padding: 8px 10px;
  background: var(--c-surface-2);
  border: 1px dashed var(--c-border-strong);
  border-radius: var(--radius-md);
}
.unslotted-head {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
</style>
