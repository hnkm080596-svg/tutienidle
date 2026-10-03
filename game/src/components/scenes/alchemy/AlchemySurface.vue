<script setup lang="ts">
// S11 Luyen Dan production surface - the Luyen Dan paper scene mounted
// on the overlay design canvas. ALL domain state flows through
// GameManagerAlchemyOps / materialBag / previewAlchemyOutcome exactly
// as the retired AlchemyView did; the fidelity scene receives a fully
// resolved display model (sufficiency, brew gating, block reason).
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notification'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import { buildProfessionMaterialId } from '@/core/profession/ProfessionMaterial'
import { betaRecipeFamilyOfId } from '@/core/betaScope'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { PROFESSION_GRADE_NAMES, getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/core/profession/slotRank'
import { useAudioStore } from '@/stores/audio'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import AlchemyFidelityScene from './fidelity/AlchemyFidelityScene.vue'
import type {
  AlchemyCostRow,
  AlchemyHerbChoice,
  AlchemyJobDisplay,
  AlchemyRecipeChoice,
  AlchemyRecipeDisplay,
} from './fidelity/alchemyUi'


const { t, te } = useI18n()

const player = usePlayerStore()
const ui = useUiStore()
const gameManager = useGameManager()
const { items: navItems, navigate } = usePaperNavigation()

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
  // M10 (ARCH-008) - retired pill families (Hoi Xuan Dan) keep their
  // recipes resolvable for in-flight settle but stay off the list.
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

function pillFor(recipe: AlchemyRecipe | { pillId: string }) {
  return gameManager.pillRegistry.has(recipe.pillId)
    ? gameManager.pillRegistry.get(recipe.pillId)
    : null
}

function pillNameFor(recipe: AlchemyRecipe): string {
  return pillFor(recipe)?.name ?? recipe.pillId
}

function pillIconFor(recipe: AlchemyRecipe | { pillId: string }): string {
  return resolveAssetUrl(pillFor(recipe)?.icon ?? '/assets/pills/truc_co_dan.png')
}

/** Bien the nien dai nguoi choi chon cho dan phuong hien tai. */
const selectedHerbId = ref<string | null>(null)

function selectRecipe(recipe: AlchemyRecipe) {
  selectedRecipeId.value = recipe.id

  // Mac dinh chon bien the cao nhat nguoi choi du so luong.
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
  icon: string
  owned: number
  enough: boolean
}

const variantRows = computed<VariantRow[]>(() => {
  stateVersion.value

  if (!selectedRecipe.value) {
    return []
  }

  return selectedRecipe.value.herbVariants.map((variant) => {
    const owned = gameManager.materialBag.getAmount(variant.materialId)
    return {
      materialId: variant.materialId,
      label: variant.label,
      icon: materialIcon(variant.materialId),
      owned,
      enough: owned >= selectedRecipe.value!.herbAmount,
    }
  })
})

function materialIcon(materialId: string): string {
  return resolveAssetUrl(
    gameManager.materialRegistry.has(materialId)
      ? gameManager.materialRegistry.get(materialId).icon ?? '/assets/materials/linh_moc.png'
      : '/assets/materials/linh_moc.png',
  )
}

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

// Go nhien lieu theo bien the thao da chon (gp123 6E):
// `<realm>_wood_<age>` - CUNG realm recipe + CUNG tuoi thao.
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

// Plan Workstream F - Linh Thach doc tu MaterialBag.
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
    .map((job): AlchemyJobDisplay => {
      const remainingMs = Math.max(0, job.completesAtMs - nowMs.value)

      const totalSeconds = Math.max(1, Math.ceil((job.completesAtMs - job.startedAtMs) / 1000))

      return {
        id: job.jobId,

        name: gameManager.pillRegistry.has(job.pillId)
          ? gameManager.pillRegistry.get(job.pillId).name
          : job.pillId,

        icon: pillIconFor(job),

        progress: Math.min(100, (1 - remainingMs / (totalSeconds * 1000)) * 100),

        remaining: `${Math.ceil(remainingMs / 60000)}p`,
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

// Same admission the domain checks first (GameManagerAlchemyOps fails
// closed with 'room_not_built'): without a pill-room instance there is
// no furnace, so the surface must block brew the same way.
const pillRoomBuilt = computed(() => {
  stateVersion.value

  return Boolean(gameManager.buildingManager.getByBuildingId('pill_room'))
})

const canBrew = computed(() => {
  stateVersion.value

  if (!pillRoomBuilt.value) {
    return false
  }

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

  // Room gate first - matches the domain's own startAlchemyJob order
  // (no instance -> room_not_built beats every material check).
  if (!pillRoomBuilt.value) {
    return 'room_not_built'
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

// audit M4: pick the one string shape that matches the actual
// guarantee so a 0% tail never promises "0% them N vien".
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

// ---------------------------------------------------------------------------
// Fidelity display model
// ---------------------------------------------------------------------------

const recipeChoices = computed<readonly AlchemyRecipeChoice[]>(() =>
  recipes.value.map((recipe) => ({
    id: recipe.id,
    name: pillNameFor(recipe),
    icon: pillIconFor(recipe),
    grade: currentGradeLabel.value,
    gradeColor: currentGradeColor.value,
  })),
)

const costRows = computed<readonly AlchemyCostRow[]>(() => {
  const rows: AlchemyCostRow[] = []

  if (fuelWoodRow.value) {
    rows.push({
      id: 'fuel_wood',
      label: fuelWoodRow.value.label,
      value: `${fuelWoodRow.value.owned} / ${fuelWoodRow.value.amount}`,
      enough: fuelWoodRow.value.owned >= fuelWoodRow.value.amount,
    })
  }

  if (spiritStoneRow.value.amount > 0) {
    rows.push({
      id: 'spirit_stone',
      label: t('alchemy.spiritStones'),
      value: `${spiritStoneRow.value.owned} / ${spiritStoneRow.value.amount}`,
      enough: spiritStoneRow.value.owned >= spiritStoneRow.value.amount,
    })
  }

  return rows
})

const recipeDisplay = computed<AlchemyRecipeDisplay | null>(() => {
  const recipe = selectedRecipe.value

  if (!recipe) {
    return null
  }

  const variants: AlchemyHerbChoice[] = variantRows.value.map((row) => ({
    id: row.materialId,
    name: row.label,
    icon: row.icon,
    amount: `${row.owned} / ${recipe.herbAmount}`,
    enough: row.enough,
  }))

  return {
    id: recipe.id,
    name: pillNameFor(recipe),
    icon: pillIconFor(recipe),
    grade: currentGradeLabel.value,
    gradeColor: currentGradeColor.value,
    description: pillFor(recipe)?.description ?? '',
    variants,
    costs: costRows.value,
    duration: preview.value
      ? `${Math.ceil(preview.value.durationSeconds / 60)}p`
      : '',
    outcome: outcomeLabel.value,
    brewDisabled: !canBrew.value,
    blockReason: brewBlockReason.value ? alchemyErrorMessage(brewBlockReason.value) : '',
  }
})

function selectRecipeById(id: string) {
  const recipe = recipes.value.find((candidate) => candidate.id === id)
  if (recipe) selectRecipe(recipe)
}
</script>

<template>
  <SceneDesignCanvas overlay>
    <AlchemyFidelityScene
      :recipes="recipeChoices"
      :recipe="recipeDisplay"
      :variant="selectedHerbId"
      :jobs="jobs"
      :capacity="maxJobSlots"
      :navigation="navItems"
      notice=""
      @select="selectRecipeById"
      @variant="selectedHerbId = $event"
      @brew="startJob"
      @cancel="cancelJob"
      @navigate="navigate"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
