<script setup lang="ts">
// P7-M7 - canonical technique band inside SkillPathPanel, ported
// verbatim from the retired TechniquePanel.vue (hero card + sections +
// Nang Canh). Reads the 0-or-1 technique through
// techniqueManager.getActive(); the ONLY player-facing grade mutation
// stays inside realmAdvanceOps.tryAdvanceTechniqueGrade.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import TechniqueSlotCard from './TechniqueSlotCard.vue'
import { buildTechniqueSections } from '@/composables/useTechniqueSections'
import StatRow from '@/components/common/primitives/StatRow.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import {
  canAdvanceTechniqueGrade,
  getTechniqueGradeUpgradeCost,
} from '@/core/technique/TechniqueProgression'
import { formatNumber } from '@/core/format/NumberFormatter'

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

const equippedTechnique = computed(() => {
  stateVersion.value

  return gameManager.techniqueManager.getActive()
})

const techniqueSections = computed(() => {
  const technique = equippedTechnique.value

  return technique ? buildTechniqueSections(technique) : []
})

const gradeUpgradeCost = computed(() => {
  stateVersion.value

  const technique = equippedTechnique.value

  return technique && technique.grade < 99
    ? getTechniqueGradeUpgradeCost(technique.grade + 1, player.$state.realmId)
    : undefined
})

const canUpgradeGrade = computed(() => {
  stateVersion.value

  const technique = equippedTechnique.value
  const cost = gradeUpgradeCost.value

  return technique !== undefined && cost !== undefined
    && canAdvanceTechniqueGrade(technique, player.$state.realmId)
    && gameManager.materialBag.getAmount(cost.materialId) >= cost.amount
})

function materialName(materialId: string): string {
  return gameManager.materialRegistry.get(materialId)?.name ?? materialId
}

function ownedAmount(materialId: string): number {
  stateVersion.value

  return gameManager.materialBag.getAmount(materialId)
}

function upgradeGrade(): void {
  if (gameManager.realmAdvanceOps.tryAdvanceTechniqueGrade(player.$state)) {
    bumpState()
  }
}
</script>

<template>
  <div class="technique-band">
    <template v-if="equippedTechnique">
      <div class="technique-band__hero">
        <Eyebrow>{{ t('panels.skillPath.technique.title') }}</Eyebrow>
        <TechniqueSlotCard :label="t('panels.skillPath.technique.heroLabel')" size="hero" />
      </div>

      <div class="technique-band__detail">
        <div v-for="section in techniqueSections" :key="section.label" class="technique-band__group">
          <Eyebrow as="h5">{{ section.label }}</Eyebrow>

          <ul class="technique-band__rows">
            <StatRow v-for="row in section.rows" :key="row.label" :label="row.label" bordered>
              {{ row.value }}
            </StatRow>
          </ul>
        </div>

        <EmptyState v-if="techniqueSections.length === 0" size="sm">{{ t('panels.skillPath.technique.emptyNoBonus') }}</EmptyState>

        <button
          class="technique-band__grade-btn"
          :disabled="!canUpgradeGrade"
          @click="upgradeGrade"
        >
          {{ t('panels.skillPath.technique.gradeAction') }}
          <template v-if="gradeUpgradeCost">
            — {{ formatNumber(gradeUpgradeCost.amount) }} {{ materialName(gradeUpgradeCost.materialId) }} ({{ formatNumber(ownedAmount(gradeUpgradeCost.materialId)) }})
          </template>
        </button>
      </div>
    </template>

    <EmptyState v-else size="sm" class="technique-band__empty">{{ t('panels.skillPath.technique.emptyNoTechnique') }}</EmptyState>
  </div>
</template>

<style scoped>
.technique-band {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ink-line);
}

.technique-band__hero {
  flex: 0 0 min(240px, 100%);
  display: flex;
  flex-direction: column;
}

.technique-band__hero .eyebrow {
  margin-bottom: 6px;
}

.technique-band__detail {
  flex: 1 1 260px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.technique-band__group {
  margin-bottom: 6px;
}

.technique-band__group .eyebrow {
  margin: 0 0 4px;
}

.technique-band__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--text-sm);
}

.technique-band__grade-btn {
  align-self: flex-start;
  margin-top: 8px;
  padding: 6px 14px;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--paper-text);
  background: transparent;
  border: 1px solid var(--mineral-gold);
  border-radius: 6px;
  cursor: pointer;
}

.technique-band__grade-btn:hover:not(:disabled) {
  color: var(--mineral-gold);
}

.technique-band__grade-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.technique-band__empty {
  flex: 1 1 auto;
}
</style>
