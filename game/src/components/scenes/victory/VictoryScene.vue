<script setup lang="ts">
// Scene 14 VICTORY (spec scene 15): the ceremonial horizontal scroll -
// Thang calligraphy band, Phan Thuong reward slot row, Tang Truong
// growth cards, and the retry/continue action pair over jade-roller
// scroll furniture. Presentation restructure only: rewards read the
// canonical BattleRewardSummary through useVictorySceneModel; battle
// actions stay owned by the wrapper panel.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PcPaperChrome from '@/components/common/PcPaperChrome.vue'
import { pcPaperControlStyles } from '@/presentation/assets/PcPaperControls'
import type { BattleRunMode } from '@/stores/ui'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'
import { useVictorySceneModel } from './useVictorySceneModel'
import VictoryTitleBand from './VictoryTitleBand.vue'
import VictorySectionPlaque from './VictorySectionPlaque.vue'
import VictoryRewardSlots from './VictoryRewardSlots.vue'
import VictoryGrowthRow from './VictoryGrowthRow.vue'
import VictoryActions from './VictoryActions.vue'
import '@/assets/tien-hiep-outcomes.css'

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
  <div class="victory-scene paper-on-dark pc-outcome-live" :style="pcPaperControlStyles()">
    <PcPaperChrome />

    <div class="victory-scene__inner">
      <VictoryTitleBand :stage-name="model.stageName.value" />

      <div class="victory-scene__results">
        <section class="victory-scene__rewards">
          <VictorySectionPlaque>{{ t('combat.victory.sections.rewards') }}</VictorySectionPlaque>
          <VictoryRewardSlots v-if="model.slots.value.length" :slots="model.slots.value" />
        </section>
        <section class="victory-scene__growth">
          <VictorySectionPlaque>{{ t('combat.victory.sections.growth') }}</VictorySectionPlaque>
          <VictoryGrowthRow :cards="model.growth.value" />
        </section>
      </div>

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
/* Scene 15 ceremonial scroll: spec envelope 760 design px = 45.45% of
   the 1672 frame - a fixed ~582px was only correct at 1280w (audit:
   ~30% at 1080p). vw keeps the ratio at every viewport; rollers sit on
   the scroll edge band. */
.victory-scene {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: min(45.45vw, calc(100vw - 32px));
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
