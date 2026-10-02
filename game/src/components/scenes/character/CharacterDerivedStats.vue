<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { BASE_STAT_LABELS, formatStat } from '@/core/stats/StatLabels'
import CharacterSectionPlaque from './CharacterSectionPlaque.vue'

// derived-stats region: the "Thuec Tinh Phu" scroll list - every
// secondary attribute (combat/survival/special/defense_advanced) as a
// compact name/value hairline row. The full grouped detail stays in
// the Chi Tiet drawer.
const { t } = useI18n()
const player = usePlayerStore()

const derivedStats = computed(() =>
  BASE_STAT_LABELS.filter(stat => stat.category !== 'attribute'),
)
</script>

<template>
  <section class="derived-stats" data-hk-region="derived-stats">
    <CharacterSectionPlaque :title="t('panels.character.sections.derivedStats')" />

    <ul class="derived-stats__list scrollfade">
      <li
        v-for="stat in derivedStats"
        :key="stat.key"
        class="derived-stats__row"
        :data-stat="stat.key"
        v-tooltip="stat.description"
      >
        <span class="derived-stats__name">{{ stat.label }}</span>
        <span class="derived-stats__value">{{ formatStat(stat.key, player.finalStats[stat.key]) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.derived-stats {
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

.derived-stats__list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  /* Right padding clears the frame art's painted rim (~10px), so the
     trailing glyph of a right-aligned value never slides under it. */
  padding: 0 12px var(--hk-space-2, 6px) var(--hk-space-2, 6px);
  list-style: none;
  scrollbar-width: none;
}
.derived-stats__list::-webkit-scrollbar { display: none; }

.derived-stats__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--hk-space-2, 6px);
  padding: 4px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--paper-line) 70%, transparent);
  cursor: default;
}
.derived-stats__row:last-child { border-bottom: 0; }

.derived-stats__name {
  font-size: var(--text-sm);
  color: var(--paper-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.derived-stats__value {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--paper-text);
}
</style>
