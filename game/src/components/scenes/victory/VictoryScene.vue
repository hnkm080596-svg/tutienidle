<script setup lang="ts">
// Scene 14 VICTORY (huyen-kim reskin): floating calligraphy title over
// the scrim, stage plaque, caption, then the cream-paper panel
// (imperial-scroll-body + frame-xl-ceremony) holding reward slots and
// growth cards; dark-metal actions sit BELOW the paper edge.
// Presentation restructure only: rewards still read the canonical
// BattleRewardSummary through useVictorySceneModel; battle actions stay
// owned by the wrapper panel.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { BattleRunMode } from '@/stores/ui'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'
import { useVictorySceneModel } from './useVictorySceneModel'
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

const titleUrl = resolveAssetUrl('/assets/ui/huyen-kim/scene/victory-v2/victory-title-v1.png')
const stageLabel = computed(() => model.stageName.value ?? t('combat.victory.subtitle'))
</script>

<template>
  <div class="victory-scene">
    <header class="victory-scene__hero" data-hk-region="title">
      <h1 class="victory-scene__title">
        <img :src="titleUrl" :alt="t('combat.victory.title')" />
      </h1>
      <p class="victory-scene__stage">
        <InkNineSlice chrome-id="scroll-title-plaque" layer="surface" />
        <span class="victory-scene__stage-name">{{ stageLabel }}</span>
      </p>
      <p class="victory-scene__flavor">{{ t('combat.victory.flavor') }}</p>
    </header>

    <section class="victory-scene__paper">
      <InkNineSlice chrome-id="imperial-scroll-body" layer="surface" />
      <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />
      <div class="victory-scene__paper-inner">
        <VictorySectionPlaque>{{ t('combat.victory.sections.rewards') }}</VictorySectionPlaque>
        <VictoryRewardSlots v-if="model.slots.value.length" :slots="model.slots.value" />

        <VictorySectionPlaque>{{ t('combat.victory.sections.growth') }}</VictorySectionPlaque>
        <VictoryGrowthRow :cards="model.growth.value" />
      </div>
    </section>

    <VictoryActions
      class="victory-scene__actions"
      :run-mode="props.runMode"
      :countdown-label="props.countdownLabel"
      @retry="emit('retry')"
      @continue="emit('continue')"
    />
  </div>
</template>

<style scoped>
/* Mock envelope: paper ~930 design px = 64.6% of the 1440 frame. */
.victory-scene {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: min(64vw, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  font-family: var(--font-body);
}

.victory-scene__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 6px;
}
.victory-scene__title {
  margin: 0;
  width: min(52%, 560px);
}
.victory-scene__title img {
  display: block;
  width: 100%;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.6));
}
.victory-scene__stage {
  position: relative;
  isolation: isolate;
  margin: 4px auto 0;
  min-width: 240px;
  padding: 9px 34px;
}
.victory-scene__stage-name {
  position: relative;
  z-index: 3;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--hk-gold-radiant, #f4d98b);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}
.victory-scene__flavor {
  margin: 6px 0 0;
  font-size: var(--text-sm);
  color: var(--hk-text-secondary, #e5d3a9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.85);
}

.victory-scene__paper {
  position: relative;
  isolation: isolate;
  width: 100%;
  padding: 30px 44px 26px;
  filter: drop-shadow(0 9px 14px rgba(0, 0, 0, 0.55));
}
.victory-scene__paper > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}
.victory-scene__paper-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* The rewards plaque straddles the paper's top edge like the mock. */
.victory-scene__paper-inner > .victory-plaque:first-child {
  margin-top: -26px;
}
</style>
