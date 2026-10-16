<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Bar from '@/components/common/primitives/Bar.vue'
import GameCard from '@/components/common/GameCard.vue'
import { formatNumber } from '@/core/format/NumberFormatter'

defineProps<{
  hp: number
  maxHp: number
}>()
const { t } = useI18n()
</script>

<template>
  <GameCard as="section" class="tribulation-ui__hp-cluster" data-hk-region="hp-cluster">
    <div class="tribulation-ui__hp-head">
      <span class="tribulation-ui__hp">
        {{ t('tribulation.overlay.hp', { hp: formatNumber(Math.ceil(hp)), max: formatNumber(maxHp) }) }}
      </span>
      <span class="tribulation-ui__resolve">{{ t('tribulation.overlay.resolve') }}</span>
    </div>
    <Bar class="tribulation-ui__hp-track" :value="hp" :max="maxHp" :height="12" />
  </GameCard>
</template>

<style scoped>
.tribulation-ui__hp-cluster {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(440px, 52vw);
  padding: 12px 18px;
  box-sizing: border-box;
  isolation: isolate;
}

.tribulation-ui__hp-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.tribulation-ui__hp {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f4e7c8;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.tribulation-ui__resolve {
  font-size: 12px;
  color: rgba(213, 183, 116, 0.82);
}

.tribulation-ui__hp-track {
  width: 100%;
  border-radius: 4px;
  border: 1px solid rgba(213, 183, 116, 0.35);
  --bar-track: rgba(10, 14, 18, 0.85);
  --bar-from: #a83232;
  --bar-to: #d9534f;
}
</style>
