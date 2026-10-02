<script setup lang="ts">
// Scene 11 detail-panel region (spec: 1120/176/412/610, shell-panel
// family: surface-m-panel + seal-chip + button-ceremonial, scrollfade).
import AlchemyRecipeHeader from './AlchemyRecipeHeader.vue'
import AlchemyOutcomeBlock from './AlchemyOutcomeBlock.vue'
import AlchemyIngredientList, { type AlchemyVariantRow } from './AlchemyIngredientList.vue'
import AlchemyCostBlock, { type AlchemyCostRow } from './AlchemyCostBlock.vue'
import AlchemyBrewCta from './AlchemyBrewCta.vue'

defineProps<{
  pillName: string
  gradeLabel: string
  gradeColor: string | undefined
  hasPreview: boolean
  outcomeLabel: string
  durationLabel: string
  herbAmount: number
  variants: AlchemyVariantRow[]
  fuelWoodRow: AlchemyCostRow | null
  spiritStoneRow: { owned: number; amount: number }
  canBrew: boolean
  blockReasonLabel: string | null
}>()
const emit = defineEmits<{ brew: [] }>()
const selectedHerbId = defineModel<string | null>('selectedHerbId', { required: true })
</script>

<template>
  <div class="alchemy-detail scrollfade" data-hk-region="detail-panel">
    <AlchemyRecipeHeader :pill-name="pillName" :grade-label="gradeLabel" :grade-color="gradeColor" />

    <AlchemyOutcomeBlock v-if="hasPreview" :outcome-label="outcomeLabel" :duration-label="durationLabel" />

    <AlchemyIngredientList
      v-model:selected-herb-id="selectedHerbId"
      :variants="variants"
      :herb-amount="herbAmount"
    />

    <AlchemyCostBlock :fuel-wood-row="fuelWoodRow" :spirit-stone-row="spiritStoneRow" />

    <AlchemyBrewCta :can-brew="canBrew" :block-reason-label="blockReasonLabel" @brew="emit('brew')" />
  </div>
</template>

<style scoped>
.alchemy-detail {
  grid-area: detail;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-left: 1px solid color-mix(in srgb, var(--scene-fire-accent) 35%, var(--paper-line));
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
