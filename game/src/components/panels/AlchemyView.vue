<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import SceneHeader from '@/components/common/SceneHeader.vue'
import { PROFESSION_GRADE_NAMES, getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'

// Luyện Đan (2026-08-25, resource-professions-rework plan §8/§9.3) —
// thay RecipeCraftingView: mỗi đan phương nhận ĐÚNG MỘT Linh Thảo
// riêng; chọn biến thể niên đại đang có trong Túi; preview "Chắc chắn
// N viên, X% thêm 1 viên" (không dùng cụm ">100%").
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

  return gameManager.getAlchemyRecipes().filter((recipe) => recipe.realmId === player.realmId)
})

const currentGradeLabel = computed(() => {
  const grade = getProfessionGradeForRealm(player.realmId)
  return grade ? PROFESSION_GRADE_NAMES[grade] : 'Chưa xác định'
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

watch(recipes, (available) => {
  if (!available.some((recipe) => recipe.id === selectedRecipeId.value)) {
    const first = available[0]
    if (first) selectRecipe(first)
  }
}, { immediate: true })

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
      <SceneHeader
        class="alchemy-view__furnace"
        asset="/assets/buildings/dong-fu/pill_room.png"
        scene="fire"
        :height="150"
        object-position="center 58%"
        :image-opacity="0.7"
      >
        <template #decoration>
          <span class="alchemy-view__furnace-core">丹</span>
        </template>
      </SceneHeader>

      <section class="alchemy-group">
        <p class="alchemy-group__eyebrow">Đan lô hiện tại</p>
        <h4 class="alchemy-group__title">{{ currentGradeLabel }}</h4>
        <small>8 đan phương · phẩm tự khóa theo cảnh giới</small>

        <button
          v-for="(recipe, index) in recipes"
          :key="recipe.id"
          type="button"
          class="alchemy-row"
          :class="{ 'is-selected': recipe.id === selectedRecipeId }"
          @click="selectRecipe(recipe)"
        >
          <span class="alchemy-row__pill">
            <b>{{ String(index + 1).padStart(2, '0') }}</b>
            {{
              gameManager.pillRegistry.has(recipe.pillId)
                ? gameManager.pillRegistry.get(recipe.pillId).name
                : recipe.pillId
            }}
          </span>

          <span class="alchemy-row__herb">{{ recipe.herbAmount }} chủ dược</span>
        </button>
      </section>
    </div>

    <div v-if="selectedRecipe" class="alchemy-detail">
      <header class="alchemy-detail__header">
        <span>ĐAN PHƯƠNG</span>
        <h3>{{ gameManager.pillRegistry.get(selectedRecipe.pillId).name }}</h3>
        <small>{{ currentGradeLabel }} · Đan lô cấp {{ gameManager.getAlchemyRoomLevel() || 0 }}</small>
      </header>
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
          <StatRow v-if="fuelWoodRow" :label="fuelWoodRow.label" :tone="fuelWoodRow.owned < fuelWoodRow.amount ? 'negative' : 'default'">
            {{ fuelWoodRow.owned }}/{{ fuelWoodRow.amount }}
          </StatRow>

          <StatRow label="Linh Thạch" :tone="spiritStoneRow.owned < spiritStoneRow.amount ? 'negative' : 'default'">
            {{ spiritStoneRow.owned }}/{{ spiritStoneRow.amount }}
          </StatRow>
        </ul>

        <GameButton class="alchemy-detail__action" size="sm" accent-var="--scene-fire-text" @click="startJob">
          Bắt đầu luyện
        </GameButton>
      </section>

      <section v-if="jobs.length > 0" class="alchemy-detail__block">
        <h4>Lò đang luyện</h4>

        <div v-for="job in jobs" :key="job.jobId" class="alchemy-job">
          <div class="alchemy-job__head">
            <span>{{ job.pillName }}</span>

            <span>{{ job.remainingLabel }}</span>
          </div>

          <Bar class="alchemy-job__progress" :value="job.progress" :max="1" :height="6" />

          <GameButton class="alchemy-job__cancel" variant="ghost" size="sm" @click="cancelJob(job.jobId)">
            Huỷ (mất nguyên liệu)
          </GameButton>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.alchemy-view {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  color: var(--text-primary);
  font-family: var(--font-body);
  overflow: hidden;
  background:
    radial-gradient(circle at 23% 28%, color-mix(in srgb, var(--scene-fire-glow) 13%, transparent), transparent 30%),
    linear-gradient(135deg, color-mix(in srgb, var(--scene-fire-deep) 96%, transparent), color-mix(in srgb, var(--ink-950) 98%, transparent));
}

.alchemy-view__recipes {
  flex: 0 0 39%;
  overflow-y: auto;
  padding: 14px;
  border-right: 1px solid color-mix(in srgb, var(--scene-fire-accent) 30%, transparent);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alchemy-view__furnace {
  border: 1px solid color-mix(in srgb, var(--scene-fire-accent) 35%, transparent);
  border-radius: var(--radius-md);
  background: radial-gradient(circle at 50% 75%, color-mix(in srgb, var(--scene-fire-glow) 30%, transparent), transparent 45%), var(--scene-fire-deep);
  box-shadow: inset 0 0 35px rgba(0, 0, 0, .7);
}

.alchemy-view__furnace :deep(.scene-header__image) {
  filter: sepia(.25) saturate(1.2) contrast(1.05);
}

.alchemy-view__furnace :deep(.scene-header__scrim) {
  display: none;
}

.alchemy-view__furnace-core {
  position: absolute;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--scene-fire-text);
  font: 700 var(--text-display) var(--font-display);
  border: 1px solid color-mix(in srgb, var(--scene-fire-text) 75%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--scene-fire-deep) 88%, transparent);
  box-shadow: 0 0 22px color-mix(in srgb, var(--scene-fire-glow) 70%, transparent), inset 0 0 12px color-mix(in srgb, var(--scene-fire-text) 25%, transparent);
}

.alchemy-group__eyebrow { margin: 0; color: var(--scene-fire-text-soft); font-size: var(--text-xs); letter-spacing: .18em; }
.alchemy-group > small { display: block; margin-bottom: 9px; color: var(--text-muted); }

.alchemy-group__title {
  margin: 2px 0;
  color: var(--scene-fire-text);
  font: 700 var(--text-lg) var(--font-display);
}

.alchemy-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 9px 10px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--scene-fire-deep) 72%, transparent), color-mix(in srgb, var(--ink-800) 82%, transparent));
  border: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 25%, transparent);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-body);
}

.alchemy-row.is-selected {
  border-color: var(--scene-fire-accent);
  box-shadow: inset 3px 0 var(--scene-fire-accent), 0 0 14px color-mix(in srgb, var(--scene-fire-text-soft) 12%, transparent);
}

.alchemy-row__pill { display: flex; align-items: center; gap: 8px; }
.alchemy-row__pill b { color: var(--scene-fire-text-soft); font-size: var(--text-xs); }

.alchemy-row__herb {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.alchemy-detail {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alchemy-detail__header {
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--scene-fire-accent) 28%, transparent);
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--scene-fire-deep) 35%, transparent), color-mix(in srgb, var(--ink-900) 80%, transparent));
}
.alchemy-detail__header span { color: var(--scene-fire-text-soft); font-size: var(--text-xs); letter-spacing: .18em; }
.alchemy-detail__header h3 { margin: 3px 0; color: var(--scene-fire-text); font: 700 var(--text-panel-title) var(--font-display); }
.alchemy-detail__header small { color: var(--text-secondary); }

.alchemy-detail__block h4 {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--scene-fire-accent);
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

.alchemy-detail__action {
  width: 100%;
  padding: 8px;
}

@media (max-width: 760px) {
  .alchemy-view { flex-direction: column; overflow-y: auto; }
  .alchemy-view__recipes { flex-basis: auto; max-height: none; border-right: 0; border-bottom: 1px solid color-mix(in srgb, var(--scene-fire-accent) 30%, transparent); }
  .alchemy-view__furnace { height: 110px; }
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
  border-radius: 3px;
}

.alchemy-job__cancel {
  align-self: flex-end;
  color: var(--crimson);
  font-size: var(--text-xs);
}
</style>
