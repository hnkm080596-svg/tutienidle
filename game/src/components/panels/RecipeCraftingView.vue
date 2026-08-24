<script setup lang="ts">
// BUILDing spec mục 6/16 — layout tham khảo ảnh "Luyện Đan" (CHỈ lấy
// bố cục: tab danh mục trái + khu vực trung tâm dạng lư/đài với
// nguyên liệu xếp quanh + panel phải hiện thông tin/Job Slot — KHÔNG
// lấy asset, KHÔNG bịa thêm hệ thống "Linh Căn" nào (ảnh chỉ minh hoạ
// bố cục, xem ghi chú kế hoạch). Danh mục dùng requiredRealmId có sẵn
// của Recipe (không thêm field mới) — không đủ recipe để cần điều
// hướng 2 tầng tab+list như ảnh gốc, gộp thành 1 danh sách phân nhóm.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import SlotView from '../common/SlotView.vue'
import CraftProgress from './CraftProgress.vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { getCurrentRealm, getRealmIndex } from '@/core/realm/realmSystem'
import type { Recipe, RecipeResultType } from '@/core/recipe/Recipe'
import { formatNumber } from '@/core/format/NumberFormatter'
import { itemGradeRank } from '@/composables/slots/normalizeSlotRank'

const props = defineProps<{
  resultType: RecipeResultType
}>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const notification = useNotificationStore()

const selectedRecipeId = ref<string | null>(null)

// Đồng hồ đếm tiến độ craft — cùng pattern với ExplorationPanel.vue
// (không có ref reactive nào khác báo "thời gian vừa trôi").
const nowSeconds = ref(Date.now() / 1000)

let progressTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  progressTimer = setInterval(() => {
    nowSeconds.value = Date.now() / 1000
  }, 1000)
})

onUnmounted(() => {
  if (progressTimer) {
    clearInterval(progressTimer)
  }
})

const recipes = computed(() => {
  stateVersion.value

  return gameManager.getRecipesByType(props.resultType)
})

// Nhóm theo requiredRealmId (mở dần theo cảnh giới, field đã có sẵn
// trên Recipe — không thêm field/hệ thống mới) — bậc "Cơ Bản" gộp mọi
// recipe không yêu cầu cảnh giới.
const categories = computed(() => {
  const groups = new Map<string, Recipe[]>()

  for (const recipe of recipes.value) {
    const key = recipe.requiredRealmId ?? '__basic__'

    if (!groups.has(key)) {
      groups.set(key, [])
    }

    groups.get(key)!.push(recipe)
  }

  return Array.from(groups.entries()).map(([realmId, list]) => ({
    key: realmId,

    label: realmId === '__basic__' ? 'Cơ Bản' : getCurrentRealm(realmId).name,

    recipes: list,

    unlocked: realmId === '__basic__' || getRealmIndex(player.realmId) >= getRealmIndex(realmId),
  }))
})

const selectedRecipe = computed(
  () => recipes.value.find(recipe => recipe.id === selectedRecipeId.value) ?? null,
)

// UI redesign Step 15/17/18 (spec mục 18/20/21 — "Result → ItemSlot →
// Tooltip") — cauldron vessel trước đây chỉ hiện "chữ cái đầu tên
// trong 1 vòng tròn" (không icon/không tooltip), cùng anti-pattern đã
// sửa ở EquipmentHallPanel.vue (Step 9). Tra template thật qua
// GameManager.getRecipeResultTemplate() (cùng switch pattern với
// getRecipeResultGrade() đã có sẵn, xem GameManager.ts).
const resultTemplate = computed(() => {
  stateVersion.value

  return selectedRecipe.value ? gameManager.getRecipeResultTemplate(selectedRecipe.value) : null
})

function materialLabel(materialId: string): string {
  return gameManager.materialRegistry.has(materialId) ? gameManager.materialRegistry.get(materialId).name : materialId
}

const cauldronMaterials = computed(() => {
  stateVersion.value

  if (!selectedRecipe.value) {
    return []
  }

  return selectedRecipe.value.materials.map((entry, index) => {
    const owned = gameManager.materialBag.getAmount(entry.materialId)

    return {
      key: entry.materialId,

      label: materialLabel(entry.materialId),

      owned,

      required: entry.amount,

      // Xếp quanh lư theo vòng tròn đều (spec mục 6 — chỉ lấy bố cục
      // "xếp quanh cauldron" từ ảnh tham khảo, không phải asset thật).
      style: ringPosition(index, selectedRecipe.value!.materials.length),
    }
  })
})

function ringPosition(index: number, total: number): { top: string; left: string } {
  const angle = (index / Math.max(1, total)) * 2 * Math.PI - Math.PI / 2
  const radius = 42

  const top = 50 + radius * Math.sin(angle)
  const left = 50 + radius * Math.cos(angle)

  return { top: `${top}%`, left: `${left}%` }
}

// Building modifier (BUILDing spec mục 15-16) — concurrentJobSlots
// quyết định số Job Slot hiện ra, timeReductionPercent áp vào
// craftDuration hiển thị.
const craftModifiers = computed(() => {
  stateVersion.value

  return gameManager.getCraftModifiers(props.resultType)
})

const jobSlots = computed(() => {
  stateVersion.value

  const active = gameManager.getActiveCrafts(props.resultType)

  return Array.from({ length: craftModifiers.value.concurrentJobSlots }, (_, index) => {
    const craft = active[index] ?? null

    const recipe = craft ? gameManager.recipeRegistry.get(craft.recipeId) : null

    const progress = craft ? gameManager.getCraftingProgress(craft.craftId, nowSeconds.value) : 0

    return {
      index,

      craft,

      recipeName: recipe?.name ?? null,

      progress,

      isReady: progress >= 1,
    }
  })
})

const canStart = computed(() => {
  if (!selectedRecipe.value) {
    return false
  }

  return gameManager.canStartCraft(selectedRecipe.value, player.$state)
})

function selectRecipe(id: string) {
  selectedRecipeId.value = id
}

function startCraft() {
  if (!selectedRecipe.value) {
    return
  }

  if (gameManager.startCraft(selectedRecipe.value.id, player.$state)) {
    bumpState()
  }
}

function collect(craftId: string, recipeName: string | null) {
  if (gameManager.collectCraft(craftId)) {
    bumpState()

    if (recipeName) {
      notification.push('craft', `Chế thành công: ${recipeName}`)
    }
  }
}
</script>

<template>
  <div class="recipe-crafting-view">
    <div class="recipe-crafting-view__categories">
      <div v-for="category in categories" :key="category.key" class="crafting-category" :class="{ 'is-locked': !category.unlocked }">
        <h4 class="crafting-category__label">{{ category.label }}</h4>

        <button
          v-for="recipe in category.recipes"
          :key="recipe.id"
          type="button"
          class="crafting-category__recipe"
          :class="{ 'is-selected': recipe.id === selectedRecipeId }"
          :disabled="!category.unlocked"
          v-tooltip="recipe.description"
          @click="selectRecipe(recipe.id)"
        >
          {{ recipe.name }}
          <span v-if="!category.unlocked" class="crafting-category__lock">(Chưa mở)</span>
        </button>
      </div>
    </div>

    <div class="recipe-crafting-view__cauldron">
      <div class="cauldron">
        <div class="cauldron__vessel">
          <SlotView
            v-if="selectedRecipe"
            class="cauldron__product"
            :item="resultTemplate"
            :label="resultTemplate?.name ?? selectedRecipe.name"
            :description="resultTemplate?.description"
            :rarity-rank="resultTemplate?.grade ? itemGradeRank(resultTemplate.grade) : undefined"
            :icon="resultTemplate?.icon"
          />
        </div>

        <div
          v-for="material in cauldronMaterials"
          :key="material.key"
          class="cauldron__material"
          :style="material.style"
        >
          <SlotView
            :item="material"
            :label="material.label"
            :state="{ validation: material.owned >= material.required ? 'valid' : 'missing' }"
            :amount="material.owned"
          />
          <span class="cauldron__material-count">{{ formatNumber(material.owned) }}/{{ formatNumber(material.required) }}</span>
        </div>
      </div>
    </div>

    <div class="recipe-crafting-view__info">
      <template v-if="selectedRecipe">
        <h3 class="recipe-crafting-view__title">{{ selectedRecipe.name }}</h3>
        <p class="recipe-crafting-view__description">{{ selectedRecipe.description }}</p>
        <p class="recipe-crafting-view__duration">
          Thời gian: {{ Math.round(selectedRecipe.craftDuration * (1 - craftModifiers.timeReductionPercent / 100)) }}s
          <span v-if="craftModifiers.timeReductionPercent > 0">(-{{ craftModifiers.timeReductionPercent }}%)</span>
        </p>
        <p v-if="selectedRecipe.spiritStoneCost" class="recipe-crafting-view__duration">
          Linh Thạch: {{ formatNumber(selectedRecipe.spiritStoneCost) }}
          <span :class="{ 'recipe-crafting-view__spirit-stone--missing': player.spiritStone < selectedRecipe.spiritStoneCost }">
            (đang có {{ formatNumber(player.spiritStone) }})
          </span>
        </p>
      </template>

      <p v-else class="recipe-crafting-view__empty">Chọn 1 công thức bên trái.</p>

      <button type="button" class="recipe-crafting-view__start" :disabled="!canStart" @click="startCraft">
        Bắt Đầu Luyện Chế
      </button>

      <div class="recipe-crafting-view__jobs">
        <div v-for="slot in jobSlots" :key="slot.index" class="job-slot">
          <span class="job-slot__label">Lò {{ slot.index + 1 }}</span>

          <template v-if="slot.craft">
            <CraftProgress status="idle" :progress="slot.progress" />

            <button type="button" :disabled="!slot.isReady" @click="collect(slot.craft.craftId, slot.recipeName)">
              {{ slot.isReady ? 'Thu thành phẩm' : slot.recipeName }}
            </button>
          </template>

          <span v-else class="job-slot__empty">Trống</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipe-crafting-view {
  display: flex;
  height: 100%;
  min-height: 0;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.recipe-crafting-view__spirit-stone--missing {
  color: var(--crimson);
}

.recipe-crafting-view__categories {
  flex: 0 0 26%;
  min-width: 0;
  overflow-y: auto;
  padding: 8px;
  border-right: 1px solid var(--ink-line-soft);
}

.crafting-category {
  margin-bottom: 10px;
}

.crafting-category.is-locked {
  opacity: 0.6;
}

.crafting-category__label {
  margin: 0 0 4px;
  font-size: var(--text-sm);
  color: var(--gold-500);
  font-family: var(--font-display);
}

.crafting-category__recipe {
  display: block;
  width: 100%;
  text-align: left;
  padding: 5px 6px;
  margin-bottom: 3px;
  font-size: var(--text-sm);
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.crafting-category__recipe:disabled {
  cursor: not-allowed;
  color: var(--text-muted);
}

.crafting-category__recipe.is-selected {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.crafting-category__lock {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.recipe-crafting-view__cauldron {
  flex: 1 1 40%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.cauldron {
  position: relative;
  width: 100%;
  max-width: 260px;
  aspect-ratio: 1;
}

.cauldron__vessel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 46%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, var(--ink-700), var(--ink-900));
  border: 2px solid var(--gold-500);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cauldron__product {
  width: 68%;
}

.cauldron__material {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 44px;
}

.cauldron__material-count {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: 2px;
}

.recipe-crafting-view__info {
  flex: 0 0 34%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-left: 1px solid var(--ink-line-soft);
  overflow-y: auto;
}

.recipe-crafting-view__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.9rem;
  color: var(--gold-500);
}

.recipe-crafting-view__description,
.recipe-crafting-view__duration,
.recipe-crafting-view__empty {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.recipe-crafting-view__start {
  padding: 8px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}

.recipe-crafting-view__start:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}

.recipe-crafting-view__jobs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.job-slot {
  padding: 6px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
}

.job-slot__label {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.job-slot__empty {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.job-slot button {
  width: 100%;
  margin-top: 4px;
  padding: 4px;
  font-size: var(--text-sm);
  background: var(--ink-700);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.job-slot button:disabled {
  cursor: not-allowed;
  color: var(--text-muted);
}
</style>
