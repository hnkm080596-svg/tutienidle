<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { ELEMENT_LABELS, ELEMENT_ORDER } from '@/core/element/ElementLabels'
import CharacterSectionPlaque from './CharacterSectionPlaque.vue'

// element-summary region: the "Ngu Hanh Tom Tat" mini column - one row
// per hanh, disc + name + share of the total elemental Power.
const { t } = useI18n()
const player = usePlayerStore()

const elementRows = computed(() => {
  const powers = ELEMENT_ORDER.map(element =>
    Math.max(0, player.finalStats[`${element}Power`] ?? 0),
  )
  const total = powers.reduce((sum, power) => sum + power, 0)
  return ELEMENT_ORDER.map((element, index) => ({
    element,
    label: ELEMENT_LABELS[element],
    power: powers[index] ?? 0,
    share: total > 0 ? Math.round(((powers[index] ?? 0) / total) * 100) : 0,
  }))
})
</script>

<template>
  <section class="element-summary" data-hk-region="element-summary">
    <CharacterSectionPlaque :title="t('panels.character.sections.elementSummary')" />

    <div class="element-summary__rows scrollfade">
      <div
        v-for="row in elementRows"
        :key="row.element"
        class="element-summary__row"
        :data-element="row.element"
        v-tooltip="t('panels.character.tooltips.elementShare', { share: row.share })"
      >
        <img
          class="element-summary__disc"
          :src="resolveAssetUrl(`/assets/ui/elements/el-${row.element}.png`)"
          :alt="row.label"
        />
        <span class="element-summary__name">{{ row.label }}</span>
        <span class="element-summary__share">{{ row.share }}%</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.element-summary {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 var(--hk-space-2, 4px);
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #7a6234) 40%, transparent);
  border-radius: var(--hk-radius-md, 8px);
  background:
    linear-gradient(175deg, rgba(185, 154, 85, 0.06), transparent 55%),
    color-mix(in srgb, var(--paper-50) 45%, transparent);
}

.element-summary__rows {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  /* Same frame-rim clearance as derived-stats: right values were
     clipping under the card's painted edge. */
  padding: 0 12px var(--hk-space-2, 6px) var(--hk-space-2, 6px);
  scrollbar-width: none;
}
.element-summary__rows::-webkit-scrollbar { display: none; }

.element-summary__row {
  display: flex;
  align-items: center;
  gap: var(--hk-space-2, 6px);
  padding: 4px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--paper-line) 70%, transparent);
  cursor: default;
}
.element-summary__row:last-child { border-bottom: 0; }

.element-summary__disc {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.element-summary__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--paper-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.element-summary__share {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: var(--text-sm);
  color: var(--hk-gold-bright, #e8c35a);
}
</style>
