<script setup lang="ts">
// Scene 14 VICTORY (spec scene 15): the ceremonial horizontal scroll -
// Thang calligraphy band, Phan Thuong reward slot row, Tang Truong
// growth cards, and the retry/continue action pair over jade-roller
// scroll furniture. Presentation restructure only: rewards read the
// canonical BattleRewardSummary through useVictorySceneModel; battle
// actions stay owned by the wrapper panel.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import type { BattleRunMode } from '@/stores/ui'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'
import { useVictorySceneModel } from './useVictorySceneModel'
import VictoryRoller from './VictoryRoller.vue'
import VictoryTitleBand from './VictoryTitleBand.vue'
import VictorySectionPlaque from './VictorySectionPlaque.vue'
import VictoryRewardSlots from './VictoryRewardSlots.vue'
import VictoryGrowthRow from './VictoryGrowthRow.vue'
import VictoryActions from './VictoryActions.vue'

const props = defineProps<{
  summary: BattleRewardSummary
  runMode: BattleRunMode
  countdownLabel: string
}>()

const emit = defineEmits<{ retry: []; continue: [] }>()
const { t } = useI18n()

const model = useVictorySceneModel(computed(() => props.summary))
</script>

<template>
  <div class="victory-scene paper-on-dark">
    <InkWashBackdrop :left-mountain="false" bottom-mist seal="large" />
    <InkNineSlice chrome-id="surface-xl-scroll" layer="surface" />
    <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

    <VictoryRoller side="left" />
    <VictoryRoller side="right" />

    <div class="victory-scene__inner">
      <VictoryTitleBand :stage-name="model.stageName.value" />

      <VictorySectionPlaque>{{ t('combat.victory.sections.rewards') }}</VictorySectionPlaque>
      <VictoryRewardSlots v-if="model.slots.value.length" :slots="model.slots.value" />

      <VictorySectionPlaque>{{ t('combat.victory.sections.growth') }}</VictorySectionPlaque>
      <VictoryGrowthRow :cards="model.growth.value" />

      <VictoryActions
        :run-mode="props.runMode"
        :countdown-label="props.countdownLabel"
        @retry="emit('retry')"
        @continue="emit('continue')"
      />
    </div>
  </div>
</template>

<style scoped>
/* Scene 15 ceremonial scroll: ~620px content column (design
   526/240/620/430), rollers sit on the scroll edge band. */
.victory-scene {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: min(660px, calc(100vw - 32px));
  padding: 34px 40px 30px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  text-align: center;
  font-family: var(--font-body);
}

.victory-scene > :not(.ink-nine-slice):not(.ink-wash-backdrop):not(.victory-roller) {
  position: relative;
  z-index: 3;
}

.victory-scene__inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
