<script setup lang="ts">
// Scene 08 detail content for Luyen The (body_refinement): the unit card
// plus the persisted physique-grade line and the discovery-gated hidden
// mortal rung (HIDDEN-B / AUTH-2 port - frozen records stay inert and
// never render as active progression).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { getPhysiqueGrade } from '@/core/realm/body/BodyProgressionSystem'
import { betaHiddenRealmRecordFor } from '@/core/betaScopeSurface'
import type { BodyChapterModel } from './useBodySceneModel'
import type { BodyUnitView } from './bodySceneModel'
import BodyDetailPanel from './BodyDetailPanel.vue'

const props = defineProps<{
  chapter: BodyChapterModel
  unit: BodyUnitView | null
}>()

const emit = defineEmits<{ invest: [] }>()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

// M-QI-07 (QI-D4) - persisted physique grade, pure read through the
// canonical read model.
const physiqueGradeLabel = computed(() => {
  stateVersion.value
  return t(`panels.realm.physique.grades.${getPhysiqueGrade(player.$state)}`)
})

// HIDDEN-B (design sec.9/sec.19): display-only "Bac 7 - Pham Cot" row;
// renders only once the hidden mortal trial has actually fired and is
// not frozen. Beta scope lock: scope-hidden record resolves undefined.
const hiddenMortalRow = computed(() => {
  stateVersion.value

  const record = betaHiddenRealmRecordFor(player.$state, 'mortal')
  if (record?.discovered !== true || record.frozen === true) {
    return null
  }

  return { completed: record.bodyCompleted === true }
})
</script>

<template>
  <BodyDetailPanel
    :unit="unit"
    :cta-label="t('panels.body.actions.investRefinement')"
    :chapter-unlocked="chapter.unlocked"
    @invest="emit('invest')"
  >
    <p class="refinement-physique">
      {{ t('panels.realm.physique.line', { grade: physiqueGradeLabel }) }}
    </p>
    <p v-if="chapter.unlocked" class="refinement-note">
      {{ t('panels.realm.bodyRefinement.note') }}
    </p>

    <div
      v-if="hiddenMortalRow"
      class="body-detail__tier body-detail__tier--hidden body-refinement__tier--hidden"
      :class="{ 'refinement-hidden--done': hiddenMortalRow.completed }"
    >
      <div class="refinement-hidden__head">
        <span class="refinement-hidden__name">{{ t('hidden.mortal.tier7Name') }}</span>
        <span class="refinement-hidden__state">
          {{ hiddenMortalRow.completed ? t('hidden.mortal.stateDone') : t('hidden.mortal.stateTrial') }}
        </span>
      </div>
      <p class="refinement-hidden__desc">{{ t('hidden.mortal.tier7Desc') }}</p>
    </div>
  </BodyDetailPanel>
</template>

<style scoped>
.refinement-physique {
  margin: 0;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--hk-jade, #3fa68b);
}
.refinement-note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--hk-text-muted, #7a7260);
}
.refinement-hidden__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.refinement-hidden__name {
  font-weight: 600;
  font-size: var(--text-md);
  color: var(--hk-text-primary, var(--chrome-100));
}
.refinement-hidden__state {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hk-jade, var(--jade));
}
.refinement-hidden__desc {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.body-detail__tier--hidden {
  padding: 8px 10px;
  border: 1px solid var(--hk-jade, var(--jade));
  border-radius: var(--hk-radius-sm, 6px);
}
</style>
