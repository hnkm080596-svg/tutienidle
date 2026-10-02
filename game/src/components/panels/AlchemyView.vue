<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useNotificationStore } from '@/stores/notification'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import { buildProfessionMaterialId } from '@/core/profession/ProfessionMaterial'
import { betaRecipeFamilyOfId } from '@/core/betaScope'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import { PROFESSION_GRADE_NAMES, getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/core/profession/slotRank'
import { useAudioStore } from '@/stores/audio'
import AlchemyRecipeRail from '@/components/scenes/alchemy/AlchemyRecipeRail.vue'
import AlchemyCauldronVista from '@/components/scenes/alchemy/AlchemyCauldronVista.vue'
import AlchemyJobQueue from '@/components/scenes/alchemy/AlchemyJobQueue.vue'
import AlchemyDetailRail from '@/components/scenes/alchemy/AlchemyDetailRail.vue'

// Luyện Đan (2026-08-25, resource-professions-rework plan §8/§9.3) —
// thay RecipeCraftingView: mỗi đan phương nhận ĐÚNG MỘT Linh Thảo
// riêng; chọn biến thể niên đại đang có trong Túi; preview "Chắc chắn
// N viên, X% thêm 1 viên" (không dùng cụm ">100%").
// i18n (task 2.2 lô 1) — chuỗi UI qua t(); REASON_LABELS cũ (dead const,
// zero consumers) trích thành alchemy.reason.* trong locales.
const { t, te } = useI18n()

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

  // BETA SCOPE LOCK v2 (contract sec.F) - only beta-enabled recipe
  // families render (the canonical family authority, same predicate
  // getBetaAlchemyRecipeModels applies); every other family is
  // scope-hidden - no teaser rows, no dead craft buttons.
  // M10 (ARCH-008) — retired pill families (Hoi Xuan Dan) are hidden from
  // the craft list entirely; startJob still rejects them defensively.
  return gameManager.alchemyOps.getAlchemyRecipes()
    .filter(
      (recipe) =>
        recipe.realmId === player.realmId &&
        recipe.retired !== true &&
        betaRecipeFamilyOfId(recipe.id) !== null,
    )
})

const currentGrade = computed(() => getProfessionGradeForRealm(player.realmId))

const currentGradeLabel = computed(() =>
  currentGrade.value ? PROFESSION_GRADE_NAMES[currentGrade.value] : t('alchemy.gradeUnknown'),
)

// Pham text carries its rank color everywhere it appears (user ruling).
const currentGradeColor = computed(() =>
  currentGrade.value ? `var(--rank-color-${professionGradeRank(currentGrade.value)})` : undefined,
)

const selectedRecipeId = ref<string | null>(null)

const selectedRecipe = computed(
  () => recipes.value.find((recipe) => recipe.id === selectedRecipeId.value) ?? null,
)

function pillNameFor(recipe: AlchemyRecipe): string {
  return gameManager.pillRegistry.has(recipe.pillId)
    ? gameManager.pillRegistry.get(recipe.pillId).name
    : recipe.pillId
}

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

  return gameManager.alchemyOps.previewAlchemyOutcome(
    selectedRecipe.value.id,
    selectedHerbId.value,
    undefined,
    player.$state,
  )
})

/** Gỗ nhiên liệu theo biến thể thảo đã chọn (gp123 6E): `<realm>_wood_<age>`
 * — CÙNG realm recipe + CÙNG tuổi thảo, KHÔNG thay thế bậc (không scan). */
const fuelWoodRow = computed(() => {
  stateVersion.value

  const recipe = selectedRecipe.value

  const herbId = selectedHerbId.value

  if (!recipe || !herbId) {
    return null
  }

  const variant = recipe.herbVariants.find((candidate) => candidate.materialId === herbId)

  if (!variant) {
    return null
  }

  const woodId = buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)

  return {
    label: gameManager.materialRegistry.has(woodId)
      ? gameManager.materialRegistry.get(woodId).name
      : woodId,

    owned: gameManager.materialBag.getAmount(woodId),

    amount: preview.value?.fuelWoodAmount ?? recipe.fuelWoodAmount,
  }
})

// Plan Workstream F — Linh Thạch đọc từ MaterialBag.
const spiritStoneRow = computed(() => ({
  owned: gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID),

  amount: preview.value?.spiritStoneCost ?? selectedRecipe.value?.spiritStoneCost ?? 0,
}))

const jobs = computed(() => {
  stateVersion.value

  void nowMs.value

  // Scope-hidden recipe families never render - a carried save's
  // dormant in-flight job still settles in the domain but stays off
  // the surface (contract sec.F).
  return gameManager.alchemyOps.getAlchemyJobs()
    .filter((job) => betaRecipeFamilyOfId(job.recipeId) !== null)
    .map((job) => {
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

/**
 * Job-slot cap read the same way GameManagerAlchemyOps does - the domain
 * owns the concurrent_job_slots rule; the view only consumes it.
 */
const maxJobSlots = computed(() => {
  stateVersion.value

  const instance = gameManager.buildingManager.getByBuildingId('pill_room')

  if (!instance) {
    return 0
  }

  const template = gameManager.buildingRegistry.get('pill_room')

  return gameManager.buildingSystem.getCraftModifiers(instance, template).concurrentJobSlots
})

const canBrew = computed(() => {
  stateVersion.value

  if (!selectedRecipe.value || !selectedHerbId.value) {
    return false
  }

  if (jobs.value.length >= Math.max(1, maxJobSlots.value)) {
    return false
  }

  const variant = variantRows.value.find((row) => row.materialId === selectedHerbId.value)

  if (!variant?.enough) {
    return false
  }

  if (fuelWoodRow.value && fuelWoodRow.value.owned < fuelWoodRow.value.amount) {
    return false
  }

  if (spiritStoneRow.value.owned < spiritStoneRow.value.amount) {
    return false
  }

  return true
})

// ui-audit economy M4: the brew button was disabled with NO on-screen
// reason, so "why won't it brew" was invisible. The herb input is
// reported first (it is the player's selection), then slot/fuel/stone
// in canBrew order; every branch maps to an existing alchemy.reason.*
// key so the line under the button names the exact missing input.
const brewBlockReason = computed<string | null>(() => {
  stateVersion.value

  if (!selectedRecipe.value) {
    return null
  }

  if (!selectedHerbId.value || !variantRows.value.find((row) => row.materialId === selectedHerbId.value)?.enough) {
    return 'missing_herb'
  }

  if (jobs.value.length >= Math.max(1, maxJobSlots.value)) {
    return 'job_slots_full'
  }

  if (fuelWoodRow.value && fuelWoodRow.value.owned < fuelWoodRow.value.amount) {
    return 'missing_fuel_wood'
  }

  if (spiritStoneRow.value.owned < spiritStoneRow.value.amount) {
    return 'missing_spirit_stone'
  }

  return null
})

// audit M4: the old outcome sentence always rendered the "{chance}% thêm
// {extra} viên" tail — at 0% it literally promised "0% thêm 2 viên" and
// at guaranteed=0 it read "Chắc chắn 0 viên". Pick the one string shape
// that matches the actual guarantee.
const outcomeLabel = computed(() => {
  if (!preview.value) {
    return ''
  }

  const { guaranteedPills, extraPillChance, extraPillYield } = preview.value

  if (guaranteedPills > 0 && extraPillChance > 0) {
    return t('alchemy.outcome', { guaranteed: guaranteedPills, chance: extraPillChance, extra: extraPillYield })
  }

  if (guaranteedPills > 0) {
    return t('alchemy.outcomeGuaranteed', { guaranteed: guaranteedPills })
  }

  if (extraPillChance > 0) {
    return t('alchemy.outcomeChanceOnly', { chance: extraPillChance, extra: extraPillYield })
  }

  // guaranteed == 0 && chance == 0: brewing yields nothing on this run
  // (e.g. a recipe below the player's room level) - say so plainly.
  return t('alchemy.outcomeNone')
})

function alchemyErrorMessage(reason: string | undefined): string {
  const key = `alchemy.reason.${reason ?? 'fallback'}`

  return te(key) ? t(key) : t('alchemy.reason.fallback')
}

function startJob() {
  if (!selectedRecipe.value || !selectedHerbId.value) {
    return
  }

  const result = gameManager.alchemyOps.startAlchemyJob(selectedRecipe.value.id, selectedHerbId.value, player.$state)

  if (!result.ok) {
    useNotificationStore().push('warning', alchemyErrorMessage(result.reason))
    useAudioStore().cue('ui.error')
    bumpState()
    return
  }

  // W7: a committed brew is the craft-start beat.
  useAudioStore().cue('craft.start')

  bumpState()
}

function cancelJob(jobId: string) {
  gameManager.alchemyOps.cancelAlchemyJob(jobId)
  useAudioStore().cue('ui.cancel')

  bumpState()
}
</script>

<template>
  <div class="alchemy-view">
    <AlchemyRecipeRail
      :recipes="recipes"
      :selected-recipe-id="selectedRecipeId"
      :grade-label="currentGradeLabel"
      :grade-color="currentGradeColor"
      :pill-name-for="pillNameFor"
      @select="selectRecipe"
    />

    <!-- Huyen Kim scene 11: the cauldron prop is the scene focal point;
         the brew queue rides a prominent strip across the bottom of the
         recipe+cauldron span (per ref + spec job-queue region). -->
    <AlchemyCauldronVista />

    <AlchemyDetailRail
      v-if="selectedRecipe"
      v-model:selected-herb-id="selectedHerbId"
      :pill-name="pillNameFor(selectedRecipe)"
      :grade-label="currentGradeLabel"
      :grade-color="currentGradeColor"
      :has-preview="!!preview"
      :outcome-label="outcomeLabel"
      :duration-label="preview ? t('alchemy.duration', { minutes: Math.ceil(preview.durationSeconds / 60) }) : ''"
      :herb-amount="selectedRecipe.herbAmount"
      :variants="variantRows"
      :fuel-wood-row="fuelWoodRow"
      :spirit-stone-row="spiritStoneRow"
      :can-brew="canBrew"
      :block-reason-label="brewBlockReason ? alchemyErrorMessage(brewBlockReason) : null"
      @brew="startJob"
    />

    <AlchemyJobQueue :jobs="jobs" :max-job-slots="maxJobSlots" @cancel="cancelJob" />
  </div>
</template>

<style scoped>
.alchemy-view {
  position: relative;
  display: grid;
  /* Spec 11 columns on the 1244 band: recipe 380 | cauldron 420 |
     detail 412 with two 16px gaps. */
  grid-template-columns: minmax(0, 380fr) minmax(0, 420fr) minmax(0, 412fr);
  column-gap: 1.29%;
  row-gap: 6px;
  /* Row 1 pinned to the spec recipe-list height (540 design px = 64.286
     of the 840cqh envelope) so the cauldron/recipes never share height
     with the job queue; cqh resolves against the scroll envelope. */
  grid-template-rows: minmax(0, 64.286cqh) minmax(0, 1fr);
  grid-template-areas:
    "recipes cauldron detail"
    "queue   queue    detail";
  height: 100%;
  min-height: 0;
  color: var(--paper-text);
  font-family: var(--font-body);
  overflow: hidden;
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 42% 0%, color-mix(in srgb, var(--scene-fire-glow) 10%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}
</style>
