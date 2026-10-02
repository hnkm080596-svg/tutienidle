<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import TechniqueRankCompare from './TechniqueRankCompare.vue'
import TechniqueMaterialCard from './TechniqueMaterialCard.vue'
import TechniqueUpgradeCta from './TechniqueUpgradeCta.vue'
import type { BetaTechniqueSurfaceModel } from '@/core/betaScopeTechniqueDomain'

// Right region (`upgrade-panel`): "Tăng Rank" -> corrected "Nâng Cảnh"
// panel — grade compare header, materials list, ceremonial CTA pinned
// bottom. surface-m-panel chrome wired; overflow uses the scrollfade.
const props = defineProps<{
  model: BetaTechniqueSurfaceModel
}>()

const emit = defineEmits<{ advance: [] }>()

const { t } = useI18n()

const panelSlice = computed(() => chromeSlice('surface-m-panel'))

const fromLabel = computed(() =>
  props.model.grade !== undefined
    ? t('panels.skillPath.technique.gradeNode', { grade: props.model.grade })
    : '—',
)
const toLabel = computed(() =>
  props.model.gradeAdvance.targetGrade !== undefined
    ? t('panels.skillPath.technique.gradeNode', { grade: props.model.gradeAdvance.targetGrade })
    : '—',
)
</script>

<template>
  <aside
    class="technique-scene__upgrade technique-upgrade-panel"
    data-hk-region="upgrade-panel"
    :art-needed="!panelSlice || undefined"
    data-art-id="surface-m-panel"
  >
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <h3 class="technique-upgrade-panel__title">{{ t('panels.skillPath.technique.gradeAction') }}</h3>

    <template v-if="model.state === 'available'">
      <TechniqueRankCompare :from-label="fromLabel" :to-label="toLabel" />

      <div class="technique-upgrade-panel__materials">
        <Eyebrow as="h5">{{ t('panels.skillPath.technique.materialsTitle') }}</Eyebrow>
        <TechniqueMaterialCard
          v-if="model.gradeAdvance.materialName && model.gradeAdvance.cost !== undefined"
          :name="model.gradeAdvance.materialName"
          :owned="model.gradeAdvance.owned ?? 0"
          :cost="model.gradeAdvance.cost"
        />
        <p v-else class="technique-upgrade-panel__no-material">—</p>
      </div>

      <TechniqueUpgradeCta :grade-advance="model.gradeAdvance" @advance="emit('advance')" />
    </template>

    <EmptyState v-else class="technique-scene__empty" size="sm">
      {{ t('panels.skillPath.technique.emptyNoTechnique') }}
    </EmptyState>
  </aside>
</template>

<style scoped>
.technique-upgrade-panel {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-4);
  min-width: 0;
  min-height: 0;
  padding: var(--hk-space-4);
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
}

.technique-upgrade-panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.technique-upgrade-panel__title {
  margin: 0;
  font-family: var(--hk-font-display);
  font-size: var(--text-title);
  color: var(--hk-gold);
  letter-spacing: 0.04em;
}

.technique-upgrade-panel__materials {
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-2);
}

.technique-upgrade-panel__no-material {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--hk-text-muted);
}
</style>
