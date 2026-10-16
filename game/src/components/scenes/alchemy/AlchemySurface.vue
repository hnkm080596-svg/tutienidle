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
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import { computeAlchemyJobProgress } from '@/core/alchemy/AlchemySystem'
import { betaRecipeFamilyOfId } from '@/core/betaScope'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { PROFESSION_GRADE_NAMES, getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/core/profession/slotRank'
import { useAudioStore } from '@/stores/audio'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
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

const { stateVersion, bumpState } = useStateVersion()

const nowMs = ref(gameManager.time.now())

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = gameManager.time.now()
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

// Bui Go is the single universal fuel for every brew (materials economy
// rework) - the row no longer depends on the selected herb variant.
const fuelWoodRow = computed(() => {
  stateVersion.value

  const recipe = selectedRecipe.value

  if (!recipe || !selectedHerbId.value) {
    return null
  }

  return {
    label: gameManager.materialRegistry.has(BUI_GO_ID)
      ? gameManager.materialRegistry.get(BUI_GO_ID).name
      : BUI_GO_ID,

    owned: gameManager.materialBag.getAmount(BUI_GO_ID),

    amount: preview.value?.fuelWoodAmount ?? recipe.fuelWoodAmount,
  }
})

// Luyen Dan Tinh Hoa is mandatory for every recipe; the amount scales
// with the recipe tier only (not cost-multiplied - the preview hands the
// authoritative number).
const tinhHoaRow = computed(() => {
  stateVersion.value

  const recipe = selectedRecipe.value

  if (!recipe || !selectedHerbId.value) {
    return null
  }

  return {
    label: gameManager.materialRegistry.has(LUYEN_DAN_TINH_HOA_ID)
      ? gameManager.materialRegistry.get(LUYEN_DAN_TINH_HOA_ID).name
      : LUYEN_DAN_TINH_HOA_ID,

    owned: gameManager.materialBag.getAmount(LUYEN_DAN_TINH_HOA_ID),

    amount: preview.value?.luyenDanTinhHoaAmount ?? recipe.luyenDanTinhHoaAmount,
  }
})

// Plan Workstream F - Linh Thach doc tu MaterialBag.
const spiritStoneRow = computed(() => ({
  owned: gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID),

  amount: preview.value?.spiritStoneCost ?? selectedRecipe.value?.spiritStoneCost ?? 0,
}))

const queueState = computed(() => {
  stateVersion.value
  void nowMs.value
  return gameManager.alchemyOps.getAlchemyQueueState()
})

const jobs = computed(() => {
  const queue = queueState.value
  const ordered = queue.activeJob ? [queue.activeJob, ...queue.waitingJobs] : queue.waitingJobs
  return ordered.map((job): AlchemyJobDisplay => {
    const active = job.jobId === queue.activeJob?.jobId
    const { remainingMs, unitsDone, quantity, progressPercent } = computeAlchemyJobProgress(
      job,
      nowMs.value,
      active,
    )
    return {
      id: job.jobId,
      recipeId: job.recipeId,
      herbMaterialId: job.herbMaterialId,
      roomLevelAtStart: job.roomLevelAtStart,
      name: gameManager.pillRegistry.has(job.pillId) ? gameManager.pillRegistry.get(job.pillId).name : job.pillId,
      icon: pillIconFor(job),
      state: active ? 'active' : 'waiting',
      progress: progressPercent,
      remaining: active ? `${Math.ceil(remainingMs / 60000)}p` : t('alchemy.waitingJob'),
      unitsDone,
      quantity,
    }
  })
})

const maxJobSlots = computed(() => queueState.value.maxTotalJobs)

const brewQuote = computed(() => {
  stateVersion.value
  return gameManager.alchemyOps.quoteAlchemyBrew(
    selectedRecipe.value?.id ?? null,
    selectedHerbId.value,
    player.$state,
  )
})

const canBrew = computed(() => brewQuote.value.canBrew)
const brewBlockReason = computed<string | null>(() => brewQuote.value.blockReason)

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
  const cancelled = gameManager.alchemyOps.cancelAlchemyJob(jobId)
  if (!cancelled) {
    useNotificationStore().push('warning', t('alchemy.cancelFailed'))
    useAudioStore().cue('ui.error')
  } else {
    useAudioStore().cue('ui.cancel')
  }

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
      icon: materialIcon(BUI_GO_ID),
      owned: fuelWoodRow.value.owned,
      enough: fuelWoodRow.value.owned >= fuelWoodRow.value.amount,
    })
  }

  if (tinhHoaRow.value && tinhHoaRow.value.amount > 0) {
    rows.push({
      id: 'tinh_hoa',
      label: tinhHoaRow.value.label,
      value: `${tinhHoaRow.value.owned} / ${tinhHoaRow.value.amount}`,
      icon: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png'),
      owned: tinhHoaRow.value.owned,
      enough: tinhHoaRow.value.owned >= tinhHoaRow.value.amount,
    })
  }

  if (spiritStoneRow.value.amount > 0) {
    rows.push({
      id: 'spirit_stone',
      label: t('alchemy.spiritStones'),
      value: `${spiritStoneRow.value.owned} / ${spiritStoneRow.value.amount}`,
      icon: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png'),
      owned: spiritStoneRow.value.owned,
      enough: spiritStoneRow.value.owned >= spiritStoneRow.value.amount,
    })
  }

  for (const special of selectedRecipe.value?.specialIngredients ?? []) {
    if (special.amount <= 0) continue
    const owned = gameManager.materialBag.getAmount(special.materialId)
    const material = gameManager.materialRegistry.has(special.materialId)
      ? gameManager.materialRegistry.get(special.materialId)
      : null
    rows.push({
      id: `special_${special.materialId}`,
      label: material?.name ?? special.materialId,
      value: `${owned} / ${special.amount}`,
      icon: materialIcon(special.materialId),
      owned,
      enough: owned >= special.amount,
      description: material?.description,
    })
  }

  return rows
})

const recipeDisplay = computed<AlchemyRecipeDisplay | null>(() => {
  const recipe = selectedRecipe.value

  if (!recipe) {
    return null
  }

  const variants: AlchemyHerbChoice[] = variantRows.value.map((row) => {
    const material = gameManager.materialRegistry.has(row.materialId)
      ? gameManager.materialRegistry.get(row.materialId)
      : null

    return {
      id: row.materialId,
      name: row.label,
      icon: row.icon,
      amount: `${row.owned} / ${recipe.herbAmount}`,
      owned: row.owned,
      enough: row.enough,
      description: material?.description,
    }
  })

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
      ? t('alchemy.durationShort', { minutes: Math.ceil(preview.value.durationSeconds / 60) })
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

      @select="selectRecipeById"
      @variant="selectedHerbId = $event"
      @brew="startJob"
      @cancel="cancelJob"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
