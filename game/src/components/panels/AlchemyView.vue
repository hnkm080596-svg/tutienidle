<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'

// Luyện Đan (2026-08-25, resource-professions-rework plan §8/§9.3) —
// thay RecipeCraftingView: mỗi đan phương nhận ĐÚNG MỘT Linh Thảo
// riêng; chọn biến thể niên đại đang có trong Túi; preview "Chắc chắn
// N viên, X% thêm 1 viên" (không dùng cụm ">100%").
const REALM_LABELS: Record<string, string> = {
  mortal: 'Phàm Nhân',
  qi_refining: 'Luyện Khí',
  foundation_establishment: 'Trúc Cơ',
}

const REASON_LABELS: Record<string, string> = {
  not_found: 'Không tìm thấy đan phương',
  room_not_built: 'Cần xây Đan Phòng trước',
  job_slots_full: 'Lò đang bận',
  wrong_herb: 'Sai Linh Thảo — đan phương chỉ nhận đúng một loại thảo',
  missing_herb: 'Không đủ Linh Thảo',
  missing_fuel_wood: 'Không đủ Gỗ nhiên liệu đạt cảnh giới yêu cầu',
  missing_spirit_stone: 'Không đủ Linh Thạch',
}

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const nowMs = ref(Date.now())

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = Date.now()
  }, 500)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

const recipes = computed<AlchemyRecipe[]>(() => {
  stateVersion.value

  return gameManager.getAlchemyRecipes()
})

const grouped = computed(() => {
  const groups = new Map<string, AlchemyRecipe[]>()

  for (const recipe of recipes.value) {
    const list = groups.get(recipe.realmId) ?? []

    list.push(recipe)

    groups.set(recipe.realmId, list)
  }

  return Array.from(groups.entries())
})

const selectedRecipeId = ref<string | null>(null)

const selectedRecipe = computed(
  () => recipes.value.find((recipe) => recipe.id === selectedRecipeId.value) ?? null,
)

/** Biến thể niên đại người chơi chọn cho đan phương hiện tại. */
const selectedHerbId = ref<string | null>(null)

function selectRecipe(recipe: AlchemyRecipe) {
  selectedRecipeId.value = recipe.id

  // Mặc định chọn biến thể cao nhất người chơi đủ số lượng.
  const affordable = [...recipe.herbVariants]
    .reverse()
    .find((variant) => gameManager.materialBag.getAmount(variant.materialId) >= recipe.herbAmount)

  selectedHerbId.value =
    affordable?.materialId ?? recipe.herbVariants[recipe.herbVariants.length - 1]?.materialId ?? null
}

interface VariantRow {
  materialId: string

  label: string

  owned: number

  enough: boolean
}

const variantRows = computed<VariantRow[]>(() => {
  stateVersion.value

  if (!selectedRecipe.value) {
    return []
  }

  return selectedRecipe.value.herbVariants.map((variant) => ({
    materialId: variant.materialId,

    label: variant.label,

    owned: gameManager.materialBag.getAmount(variant.materialId),

    enough: gameManager.materialBag.getAmount(variant.materialId) >= selectedRecipe.value!.herbAmount,
  }))
})

const preview = computed(() => {
  stateVersion.value

  if (!selectedRecipe.value || !selectedHerbId.value) {
    return null
  }

  return gameManager.previewAlchemyOutcome(selectedRecipe.value.id, selectedHerbId.value)
})

/** Gỗ nhiên liệu rẻ nhất đạt realm tối thiểu của recipe (hiển thị cost). */
const fuelWoodRow = computed(() => {
  stateVersion.value

  if (!selectedRecipe.value) {
    return null
  }

  const realms = ['mortal', 'qi_refining', 'foundation_establishment']

  const minIndex = Math.max(0, realms.indexOf(selectedRecipe.value.fuelWoodRealmId))

  for (let index = minIndex; index < realms.length; index++) {
    const woodId = `${realms[index]}_wood`

    const name =
      gameManager.materialRegistry.has(woodId)
        ? gameManager.materialRegistry.get(woodId).name
        : woodId

    return {
      label: name,

      owned: gameManager.materialBag.getAmount(woodId),

      amount: selectedRecipe.value.fuelWoodAmount,
    }
  }

  return null
})

// Plan Workstream F — Linh Thạch đọc từ MaterialBag.
const spiritStoneRow = computed(() => ({
  owned: gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID),

  amount: selectedRecipe.value?.spiritStoneCost ?? 0,
}))

const jobs = computed(() => {
  stateVersion.value

  void nowMs.value

  return gameManager.getAlchemyJobs().map((job) => {
    const remainingMs = Math.max(0, job.completesAtMs - nowMs.value)

    const totalSeconds = Math.max(1, Math.ceil((job.completesAtMs - job.startedAtMs) / 1000))

    const pillName = gameManager.pillRegistry.has(job.pillId)
      ? gameManager.pillRegistry.get(job.pillId).name
      : job.pillId

    return {
      jobId: job.jobId,

      pillName,

      progress: Math.min(1, 1 - remainingMs / (totalSeconds * 1000)),

      remainingLabel: `${Math.ceil(remainingMs / 60000)}p`,
    }
  })
})

function startJob() {
  if (!selectedRecipe.value || !selectedHerbId.value) {
    return
  }

  const result = gameManager.startAlchemyJob(selectedRecipe.value.id, selectedHerbId.value, player.$state)

  if (!result.ok) {
    console.warn('start alchemy failed:', result.reason)
  }

  bumpState()
}

function cancelJob(jobId: string) {
  gameManager.cancelAlchemyJob(jobId)

  bumpState()
}
</script>

<template>
  <div class="alchemy-view">
    <div class="alchemy-view__recipes">
      <section v-for="[realmId, realmRecipes] in grouped" :key="realmId" class="alchemy-group">
        <h4 class="alchemy-group__title">{{ REALM_LABELS[realmId] ?? realmId }}</h4>

        <button
          v-for="recipe in realmRecipes"
          :key="recipe.id"
          type="button"
          class="alchemy-row"
          :class="{ 'is-selected': recipe.id === selectedRecipeId }"
          @click="selectRecipe(recipe)"
        >
          <span class="alchemy-row__pill">
            {{
              gameManager.pillRegistry.has(recipe.pillId)
                ? gameManager.pillRegistry.get(recipe.pillId).name
                : recipe.pillId
            }}
          </span>

          <span class="alchemy-row__herb">{{ recipe.herbAmount }} thảo</span>
        </button>
      </section>
    </div>

    <div v-if="selectedRecipe" class="alchemy-detail">
      <!-- §9.3: preview thời gian + tỷ lệ tổng + guaranteed + chance cộng -->
      <section v-if="preview" class="alchemy-detail__block">
        <h4>Xem trước lần luyện</h4>

        <p class="alchemy-detail__outcome">
          Chắc chắn {{ preview.guaranteedPills }} viên,
          {{ preview.extraPillChance }}% thêm 1 viên
        </p>

        <p class="alchemy-detail__duration">
          Thời gian: ~{{ Math.ceil(preview.durationSeconds / 60) }} phút — Đan Phòng cấp
          {{ gameManager.getAlchemyRoomLevel() || 'chưa xây' }}
        </p>
      </section>

      <section class="alchemy-detail__block">
        <h4>Linh Thảo ({{ selectedRecipe.herbAmount }})</h4>

        <label
          v-for="variant in variantRows"
          :key="variant.materialId"
          class="alchemy-variant"
          :class="{ 'is-enough': variant.enough }"
        >
          <input type="radio" :value="variant.materialId" v-model="selectedHerbId" />

          <span>{{ variant.label }}</span>

          <span class="alchemy-variant__owned">×{{ variant.owned }}</span>
        </label>
      </section>

      <section class="alchemy-detail__block">
        <h4>Chi phí khác</h4>

        <ul class="alchemy-costs">
          <li v-if="fuelWoodRow" :class="{ 'is-missing': fuelWoodRow.owned < fuelWoodRow.amount }">
            <span>{{ fuelWoodRow.label }}</span>

            <span>{{ fuelWoodRow.owned }}/{{ fuelWoodRow.amount }}</span>
          </li>

          <li :class="{ 'is-missing': spiritStoneRow.owned < spiritStoneRow.amount }">
            <span>Linh Thạch</span>

            <span>{{ spiritStoneRow.owned }}/{{ spiritStoneRow.amount }}</span>
          </li>
        </ul>

        <button type="button" class="alchemy-detail__action" @click="startJob">
          Bắt đầu luyện
        </button>
      </section>

      <section v-if="jobs.length > 0" class="alchemy-detail__block">
        <h4>Lò đang luyện</h4>

        <div v-for="job in jobs" :key="job.jobId" class="alchemy-job">
          <div class="alchemy-job__head">
            <span>{{ job.pillName }}</span>

            <span>{{ job.remainingLabel }}</span>
          </div>

          <div class="alchemy-job__progress">
            <div class="alchemy-job__fill" :style="{ width: `${job.progress * 100}%` }" />
          </div>

          <button type="button" class="alchemy-job__cancel" @click="cancelJob(job.jobId)">
            Huỷ (mất nguyên liệu)
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.alchemy-view {
  display: flex;
  height: 100%;
  min-height: 0;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.alchemy-view__recipes {
  flex: 0 0 42%;
  overflow-y: auto;
  padding: 10px;
  border-right: 1px solid var(--ink-line);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alchemy-group__title {
  margin: 0;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--gold-500);
}

.alchemy-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 6px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-body);
}

.alchemy-row.is-selected {
  border-color: var(--gold-500);
}

.alchemy-row__herb {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.alchemy-detail {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alchemy-detail__block h4 {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--gold-500);
}

.alchemy-detail__outcome {
  margin: 0 0 4px;
  font-size: var(--text-sm);
  color: var(--jade);
  font-weight: 700;
}

.alchemy-detail__duration {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.alchemy-variant {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: var(--text-sm);
  cursor: pointer;
}

.alchemy-variant:not(.is-enough) {
  color: var(--text-muted);
}

.alchemy-variant__owned {
  margin-left: auto;
  color: var(--text-secondary);
}

.alchemy-costs {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--text-sm);
}

.alchemy-costs li {
  display: flex;
  justify-content: space-between;
}

.alchemy-costs li.is-missing {
  color: var(--danger, #e05d5d);
}

.alchemy-detail__action {
  width: 100%;
  padding: 8px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
}

.alchemy-job {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alchemy-job__head {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.alchemy-job__progress {
  height: 6px;
  background: var(--ink-700);
  border-radius: 3px;
  overflow: hidden;
}

.alchemy-job__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
}

.alchemy-job__cancel {
  align-self: flex-end;
  background: none;
  border: none;
  color: var(--danger, #e05d5d);
  font-size: var(--text-xs);
  cursor: pointer;
  font-family: var(--font-body);
}
</style>
