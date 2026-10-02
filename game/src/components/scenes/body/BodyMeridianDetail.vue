<script setup lang="ts">
// Scene 08 detail content for Bat Mach (meridian): the unit card plus
// the discovery-gated Quan The continuation row (HIDDEN-B / AUTH-2 port
// - the row renders only once the qi_refining hidden realm record is
// discovered and unfrozen; beta scope lock keeps it invisible in beta).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { getQuanTheMechanic } from '@/core/realm/hidden/QuanTheDiversion'
import { betaHiddenRealmRecordFor } from '@/core/betaScopeSurface'
import { formatNumber } from '@/core/format/NumberFormatter'
import Bar from '@/components/common/primitives/Bar.vue'
import type { BodyChapterModel } from './useBodySceneModel'
import type { BodyUnitView } from './bodySceneModel'
import BodyDetailPanel from './BodyDetailPanel.vue'

defineProps<{
  chapter: BodyChapterModel
  unit: BodyUnitView | null
}>()

const emit = defineEmits<{ invest: [] }>()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

const hiddenQuanThe = computed(() => {
  stateVersion.value

  const record = betaHiddenRealmRecordFor(player.$state, 'qi_refining')
  if (record?.discovered !== true || record.frozen === true) {
    return null
  }

  const mechanic = getQuanTheMechanic(player.$state)

  return {
    completed: record.bodyCompleted === true,
    progress: mechanic?.progress ?? 0,
    required: mechanic?.required ?? 0,
  }
})
</script>

<template>
  <BodyDetailPanel
    :unit="unit"
    :cta-label="t('panels.realm.meridian.invest')"
    :chapter-unlocked="chapter.unlocked"
    :chapter-gate="t('panels.realm.meridian.seqGate')"
    @invest="emit('invest')"
  >
    <div
      v-if="hiddenQuanThe"
      class="meridian-hidden body-refinement__tier--hidden meridian-section__row--hidden"
      :class="{ 'meridian-hidden--opened': hiddenQuanThe.completed }"
    >
      <div class="meridian-hidden__head">
        <span class="meridian-hidden__name">{{ t('hidden.qi.quanTheName') }}</span>
        <span class="meridian-hidden__state">
          {{ hiddenQuanThe.completed ? t('hidden.qi.stateDone') : t('hidden.qi.stateActive') }}
        </span>
      </div>

      <p class="meridian-hidden__desc">{{ t('hidden.qi.quanTheDesc') }}</p>

      <Bar :value="hiddenQuanThe.progress" :max="hiddenQuanThe.required" :height="5" />

      <span class="meridian-hidden__count">
        {{ formatNumber(hiddenQuanThe.progress) }} / {{ formatNumber(hiddenQuanThe.required) }}
      </span>
    </div>
  </BodyDetailPanel>
</template>

<style scoped>
.meridian-hidden {
  padding: 8px 10px;
  border: 1px solid var(--hk-jade, var(--jade));
  border-radius: var(--hk-radius-sm, 6px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.meridian-hidden__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.meridian-hidden__name {
  font-weight: 600;
  font-size: var(--text-md);
  color: var(--hk-text-primary, var(--chrome-100));
}
.meridian-hidden__state {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hk-jade, var(--jade));
}
.meridian-hidden__desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.meridian-hidden__count {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
