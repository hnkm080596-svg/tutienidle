<script setup lang="ts">
// Huyen Kim scene 06 - Tam Phap dedicated imperial scroll (mission
// sec.11): the ACTIVE technique showcased, not a library browser.
// Composition: runtime slot card + plinth centerpiece + detail/upgrade
// rail. All state/mutations stay on the canonical beta read-model
// (realmAdvanceOps.getBetaTechniqueSurfaceModel / tryAdvanceTechniqueGrade)
// - this panel adds no domain calls of its own.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import TechniqueSlotCard from '@/components/panels/skill-path/TechniqueSlotCard.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'

const PLINTH_SRC = stableSceneArtUrl('technique-display-plinth', '@2x')

const ui = useUiStore()
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

// Spec 06 bottom grade-track: the live grade -> next grade node trail.
// Runtime owns both ends; hidden grades never render as placeholders.
const gradeTrack = computed(() => {
  const current = model.value.grade
  const target = gradeAdvance.value.targetGrade
  const nodes: Array<{ grade: number; state: 'current' | 'next' }> = []

  if (current !== undefined) {
    nodes.push({ grade: current, state: 'current' })
  }
  if (target !== undefined && target !== current) {
    nodes.push({ grade: target, state: 'next' })
  }

  return nodes
})

function upgradeGrade(): void {
  if (gameManager.realmAdvanceOps.tryAdvanceTechniqueGrade(player.$state)) {
    bumpState()
  }
}

function close() { ui.closeHomeOverlays() }
</script>

<template>
  <ImperialScrollScene
    scene="technique"
    :open="ui.standalonePanel === 'technique'"
    :title="t('panels.skillPath.technique.title')"
    @close="close"
  >
    <div class="technique-scene">
      <!-- Left: the technique identity card (slot renders its own
           empty-state glyph + label when the model is unavailable) -->
      <div class="technique-scene__card">
        <TechniqueSlotCard :label="t('panels.skillPath.technique.heroLabel')" size="hero" />
      </div>

      <!-- Center: plinth centerpiece (scene furniture; runtime card stays above) -->
      <div class="technique-scene__vista">
        <img class="technique-scene__plinth" :src="PLINTH_SRC" alt="" aria-hidden="true" />
      </div>

      <!-- Right: effects / mastery / upgrade requirements -->
      <div class="technique-scene__upgrade">
        <template v-if="model.state === 'available'">
          <div v-for="section in techniqueSections" :key="section.label" class="technique-scene__group">
            <Eyebrow as="h5">{{ section.label }}</Eyebrow>
            <ul class="technique-scene__rows">
              <StatRow v-for="row in section.rows" :key="row.label" :label="row.label" bordered>
                {{ row.value }}
              </StatRow>
            </ul>
          </div>

          <EmptyState v-if="techniqueSections.length === 0" size="sm">
            {{ t('panels.skillPath.technique.emptyNoBonus') }}
          </EmptyState>

          <button
            class="technique-scene__grade-btn"
            :disabled="!gradeAdvance.available"
            @click="upgradeGrade"
          >
            {{ t('panels.skillPath.technique.gradeAction') }}
            <template v-if="gradeAdvance.cost !== undefined">
              — {{ formatNumber(gradeAdvance.cost) }} {{ gradeAdvance.materialName }} ({{ formatNumber(gradeAdvance.owned ?? 0) }})
            </template>
          </button>
        </template>

        <EmptyState v-else size="sm">
          {{ t('panels.skillPath.technique.emptyNoTechnique') }}
        </EmptyState>
      </div>

      <!-- Bottom: live grade -> target grade track (spec 06 grade-track) -->
      <div v-if="gradeTrack.length" class="technique-scene__track" aria-hidden="true">
        <template v-for="(node, i) in gradeTrack" :key="node.grade">
          <span v-if="i > 0" class="technique-scene__track-link" />
          <span class="technique-scene__track-node" :class="`is-${node.state}`">
            {{ t('panels.skillPath.technique.gradeNode', { grade: node.grade }) }}
          </span>
        </template>
      </div>
    </div>
  </ImperialScrollScene>
</template>

<style scoped>
/* Spec 06: card | artifact vista | upgrade rail, grade track across the
   bottom. Content box 1244x702 design. */
.technique-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(220px, 1.1fr) minmax(0, 1.2fr) minmax(240px, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 18px;
  padding: 6px 2px;
}

.technique-scene__card {
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.technique-scene__vista {
  position: relative;
  min-height: 0;
  display: grid;
  place-items: center;
}
.technique-scene__plinth {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  pointer-events: none;
}

.technique-scene__upgrade {
  min-height: 0;
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.technique-scene__group { margin-bottom: 6px; }
.technique-scene__group .eyebrow { margin: 0 0 4px; }
.technique-scene__rows { list-style: none; margin: 0; padding: 0; font-size: var(--text-sm); }

.technique-scene__grade-btn {
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
.technique-scene__grade-btn:hover:not(:disabled) {
  color: var(--hk-gold-bright, var(--mineral-gold));
  border-color: var(--hk-gold, var(--mineral-gold));
}
.technique-scene__grade-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* Grade track: node chain across the bottom of the scene. */
.technique-scene__track {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 6px 0 2px;
}
.technique-scene__track-node {
  display: inline-grid;
  place-items: center;
  min-width: 52px;
  height: 52px;
  padding: 0 10px;
  border-radius: 50%;
  border: 1px solid var(--hk-border-muted, #2a352f);
  background: var(--hk-surface-raised, #131b17);
  color: var(--hk-text-secondary, #b8ae97);
  font: 600 var(--text-xs) var(--font-body);
}
.technique-scene__track-node.is-current {
  border-color: var(--hk-jade, #3fa68b);
  color: var(--hk-jade-soft, #67c4ab);
  box-shadow: 0 0 14px var(--hk-glow-jade, rgba(63, 166, 139, 0.35));
}
.technique-scene__track-node.is-next {
  border-color: var(--hk-gold, #c99a4a);
  color: var(--hk-gold, #c99a4a);
}
.technique-scene__track-link {
  width: 42px;
  height: 1px;
  background: var(--hk-border-muted, #2a352f);
}

.technique-scene__empty { flex: 1 1 auto; }

@container (max-width: 900px) {
  .technique-scene { grid-template-columns: 1fr; grid-template-rows: auto minmax(160px, 30%) 1fr auto; overflow-y: auto; }
  .technique-scene__upgrade { overflow-y: visible; }
}
</style>
