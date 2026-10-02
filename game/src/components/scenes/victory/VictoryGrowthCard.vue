<script setup lang="ts">
// Scene 14 growth card: one cultivation-progress gain (technique
// mastery / skill insight / artifact insight) rendered as a list-row
// chip - accent seal glyph + canonical reward label + "+N" amount.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { VictoryGrowthCardView } from './victorySceneModel'

const props = defineProps<{ card: VictoryGrowthCardView }>()

const { t } = useI18n()

const GLYPH: Record<VictoryGrowthCardView['id'], string> = {
  techniqueMastery: '',
  skillInsight: '',
  artifactInsight: '',
}

const SEAL_ART_ID: Record<VictoryGrowthCardView['id'], string> = {
  techniqueMastery: 'victory-growth-seal-technique',
  skillInsight: 'victory-growth-seal-skill',
  artifactInsight: 'victory-growth-seal-artifact',
}

const label = computed(() => t(props.card.labelKey))
</script>

<template>
  <li class="victory-growth-card" :class="`is-${props.card.accent}`">
    <InkNineSlice chrome-id="list-row" layer="surface" />
    <span
      class="victory-growth-card__seal art-needed"
      :data-art-id="SEAL_ART_ID[props.card.id]"
      aria-hidden="true"
    >{{ GLYPH[props.card.id] }}</span>
    <span class="victory-growth-card__body">
      <span class="victory-growth-card__label">{{ label }}</span>
    </span>
    <span class="victory-growth-card__amount">+{{ formatNumber(props.card.amount) }}</span>
  </li>
</template>

<style scoped>
.victory-growth-card {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 8px 14px;
  min-width: 300px;
  max-width: 360px;
  list-style: none;
}
.victory-growth-card .ink-nine-slice { z-index: 0; }
.victory-growth-card > :not(.ink-nine-slice) { position: relative; z-index: 1; }

.victory-growth-card__seal {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background: radial-gradient(circle at 35% 30%, #22322b 0%, #101718 72%);
  font-family: var(--font-display, serif);
  font-size: 15px;
}
.is-gold .victory-growth-card__seal { color: var(--hk-gold-radiant, #f4d98b); }
.is-jade .victory-growth-card__seal { color: var(--hk-jade-soft, #67c4ab); }
.is-cinnabar .victory-growth-card__seal { color: var(--hk-cinnabar-bright, #d8695a); }

.victory-growth-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.victory-growth-card__label {
  font-size: var(--text-sm);
  color: var(--surface-text, #f3ead8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.victory-growth-card__amount {
  flex: 0 0 auto;
  font-weight: 700;
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
}
.is-gold .victory-growth-card__amount { color: var(--hk-gold-radiant, #f4d98b); }
.is-jade .victory-growth-card__amount { color: var(--hk-jade-soft, #67c4ab); }
.is-cinnabar .victory-growth-card__amount { color: var(--hk-cinnabar-bright, #d8695a); }
</style>
