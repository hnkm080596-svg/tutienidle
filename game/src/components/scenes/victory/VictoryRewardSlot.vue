<script setup lang="ts">
// Scene 14 reward tile: square slot (frame-s-slot family) holding the
// item icon, an amount badge in the corner and the canonical item name
// as caption below - one per BattleRewardSummary gain.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { VictorySlotView } from './victorySceneModel'

const props = defineProps<{ slot: VictorySlotView }>()

const KIND_GLYPH: Record<VictorySlotView['kind'], string> = {
  currency: '◆',
  growth: '✦',
  material: '◈',
  pill: '●',
  equipment: '▣',
}
</script>

<template>
  <li
    class="victory-slot"
    :class="`victory-slot--${props.slot.kind}`"
    :data-art-id="`victory-slot-${props.slot.kind}`"
    :title="props.slot.name"
  >
    <span class="victory-slot__tile">
      <InkNineSlice chrome-id="frame-s-slot" layer="surface" />
      <HuyenKimSymbol v-if="props.slot.symbol" class="victory-slot__symbol" :name="props.slot.symbol" />
      <img
        v-else-if="props.slot.icon"
        class="victory-slot__icon"
        :src="props.slot.icon"
        :alt="props.slot.name"
        loading="lazy"
      />
      <span v-else class="victory-slot__glyph" aria-hidden="true">{{ KIND_GLYPH[props.slot.kind] }}</span>
      <span class="victory-slot__amount">{{ formatNumber(props.slot.amount) }}</span>
    </span>
    <span class="victory-slot__name">{{ props.slot.name }}</span>
  </li>
</template>

<style scoped>
.victory-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 0;
  list-style: none;
}

.victory-slot__tile {
  position: relative;
  isolation: isolate;
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
}
.victory-slot__tile .ink-nine-slice { z-index: 0; }

.victory-slot__icon {
  position: relative;
  z-index: 1;
  width: 80%;
  height: 80%;
  object-fit: contain;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
}
.victory-slot__glyph {
  position: relative;
  z-index: 1;
  font-size: 22px;
  color: var(--hk-gold, #b99a55);
}
.victory-slot--currency .victory-slot__glyph { color: var(--hk-jade-soft, #67c4ab); }
.victory-slot--pill .victory-slot__glyph { color: var(--hk-cinnabar, #b54432); }

.victory-slot__symbol {
  position: relative;
  z-index: 1;
  width: 60%;
  height: 60%;
  color: var(--hk-gold-radiant, #f4d98b);
}

.victory-slot__amount {
  position: absolute;
  z-index: 2;
  right: -2px;
  bottom: -2px;
  min-width: 18px;
  padding: 1px 4px;
  border-radius: 7px;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background: #141d18;
  color: var(--hk-gold-radiant, #f4d98b);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.victory-slot__name {
  max-width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  /* Tile captions sit on cream paper - dark ink, not the dark-theme
     secondary ramp. */
  color: var(--paper-text-soft, #5e5a50);
}
</style>
