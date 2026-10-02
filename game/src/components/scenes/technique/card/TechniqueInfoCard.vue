<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import TechniqueNamePlate from './TechniqueNamePlate.vue'
import TechniqueSectionBlock from './TechniqueSectionBlock.vue'
import type { BetaTechniqueSurfaceModel } from '@/core/betaScopeTechniqueDomain'
import { ITEM_QUALITY_LABELS, ITEM_QUALITY_SHORT_LABELS } from '@/core/item/ItemQuality'

// Left region (`tech-card`): the "Công Pháp" card — title row with help
// seal, name + quality seal, Phẩm line, description, and the model's
// display sections verbatim. surface-m-panel chrome wired.
const props = defineProps<{
  model: BetaTechniqueSurfaceModel
}>()

const { t } = useI18n()

const panelSlice = computed(() => chromeSlice('surface-m-panel'))

const qualityKey = computed(() => props.model.quality ?? 'hoang')
const qualityLabel = computed(() =>
  props.model.quality ? ITEM_QUALITY_SHORT_LABELS[props.model.quality] : '—',
)
const qualityLine = computed(() => {
  if (!props.model.quality) return '—'
  return t('panels.skillPath.technique.qualityLine', {
    quality: ITEM_QUALITY_LABELS[props.model.quality],
  })
})
</script>

<template>
  <article
    class="technique-scene__card technique-info-card"
    data-hk-region="tech-card"
    :art-needed="!panelSlice || undefined"
    data-art-id="surface-m-panel"
  >
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <header class="technique-info-card__head">
      <h3 class="technique-info-card__title">{{ t('panels.skillPath.technique.cardTitle') }}</h3>
      <button
        type="button"
        class="technique-info-card__help"
        art-needed
        data-art-id="icon-button-utility"
        :aria-label="t('panels.skillPath.technique.helpAria')"
      >?</button>
    </header>

    <EmptyState
      v-if="model.state === 'unavailable'"
      class="technique-scene__empty technique-info-card__empty"
      size="lg"
    >
      {{ t('panels.skillPath.technique.emptyNoTechnique') }}
    </EmptyState>

    <template v-else>
      <TechniqueNamePlate
        :name="model.name ?? '—'"
        :quality-key="qualityKey"
        :quality-label="qualityLabel"
        :quality-line="qualityLine"
      />
      <p class="technique-info-card__desc">{{ model.description ?? '—' }}</p>
      <div class="technique-info-card__sections">
        <TechniqueSectionBlock
          v-for="section in model.sections"
          :key="section.label"
          :section="section"
        />
        <EmptyState
          v-if="model.sections.length === 0"
          class="technique-scene__empty technique-info-card__empty-bonus"
          size="sm"
        >
          {{ t('panels.skillPath.technique.emptyNoBonus') }}
        </EmptyState>
      </div>
    </template>
  </article>
</template>

<style scoped>
.technique-info-card {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-3);
  min-width: 0;
  min-height: 0;
  padding: var(--hk-space-4);
  overflow-y: auto;
}

.technique-info-card > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.technique-info-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hk-space-2);
}

.technique-info-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-title);
  color: var(--hk-gold);
  letter-spacing: 0.04em;
}

.technique-info-card__help {
  width: 24px;
  height: 24px;
  border: 1px solid var(--hk-border-muted);
  border-radius: 50%;
  background: var(--paper-100);
  color: var(--hk-text-secondary);
  font-size: var(--text-xs);
  cursor: help;
  flex-shrink: 0;
}

.technique-info-card__desc {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--hk-text-primary);
}

.technique-info-card__sections {
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-4);
  padding-bottom: var(--hk-space-2);
}
</style>
