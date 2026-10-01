<script setup lang="ts">
// P7-M7 - canonical technique band inside SkillPathPanel, ported
// verbatim from the retired TechniquePanel.vue (hero card + sections +
// Nang Canh).
//
// BETA FE-CONTRACT (work-order sec.4A): renders the canonical
// BetaTechniqueSurfaceModel via realmAdvanceOps - eligibility, cost and
// bag comparisons resolve inside the model; this panel never calls
// canAdvanceTechniqueGrade / getTechniqueGradeUpgradeCost /
// materialBag.getAmount. The ONLY player-facing grade mutation stays
// inside realmAdvanceOps.tryAdvanceTechniqueGrade.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import TechniqueSlotCard from './TechniqueSlotCard.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'

// technique-display-plinth (stable art): empty pedestal below the runtime
// slot card - the plinth is scene furniture; the artifact stays runtime.
const PLINTH_SRC = stableSceneArtUrl('technique-display-plinth', '@2x')

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

const model = computed(() => {
  stateVersion.value

  return gameManager.realmAdvanceOps.getBetaTechniqueSurfaceModel(player.$state)
})

const techniqueSections = computed(() => model.value.sections)

const gradeAdvance = computed(() => model.value.gradeAdvance)

function upgradeGrade(): void {
  if (gameManager.realmAdvanceOps.tryAdvanceTechniqueGrade(player.$state)) {
    bumpState()
  }
}
</script>

<template>
  <div class="technique-band">
    <template v-if="model.state === 'available'">
      <div class="technique-band__hero">
        <Eyebrow>{{ t('panels.skillPath.technique.title') }}</Eyebrow>
        <div class="technique-band__plinth">
          <img class="technique-band__plinth-img" :src="PLINTH_SRC" alt="" aria-hidden="true" />
          <TechniqueSlotCard :label="t('panels.skillPath.technique.heroLabel')" size="hero" />
        </div>
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
          :disabled="!gradeAdvance.available"
          @click="upgradeGrade"
        >
          {{ t('panels.skillPath.technique.gradeAction') }}
          <template v-if="gradeAdvance.cost !== undefined">
            — {{ formatNumber(gradeAdvance.cost) }} {{ gradeAdvance.materialName }} ({{ formatNumber(gradeAdvance.owned ?? 0) }})
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
  border-bottom: 1px solid var(--hk-border-muted, var(--ink-line));
}

.technique-band__hero {
  flex: 0 0 min(240px, 100%);
  display: flex;
  flex-direction: column;
}

/* Plinth art occupies the card area; the runtime slot card floats above
   the pedestal (contain@south art, so the column anchors bottom). */
.technique-band__plinth {
  position: relative;
  flex: 1;
  min-height: 150px;
  display: grid;
  place-items: center;
}

.technique-band__plinth-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  pointer-events: none;
}

.technique-band__plinth :deep(.technique-card) {
  position: relative;
  z-index: 1;
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
  color: var(--hk-text-primary, var(--paper-text));
  background: transparent;
  border: 1px solid var(--hk-gold-muted, var(--mineral-gold));
  border-radius: var(--hk-radius-sm, 6px);
  cursor: pointer;
  transition: border-color var(--hk-motion-micro, 150ms) var(--hk-ease-standard, ease);
}

.technique-band__grade-btn:hover:not(:disabled) {
  color: var(--hk-gold-bright, var(--mineral-gold));
  border-color: var(--hk-gold, var(--mineral-gold));
}

.technique-band__grade-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.technique-band__empty {
  flex: 1 1 auto;
}
</style>
