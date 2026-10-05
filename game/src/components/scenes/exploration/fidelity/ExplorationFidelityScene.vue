<script setup lang="ts">
import '@/assets/tien-hiep-progression.css'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperSceneActions from '@/components/common/PcPaperSceneActions.vue'
import ExplorationPaperMap from './ExplorationPaperMap.vue'
import ExplorationPaperDetails from './ExplorationPaperDetails.vue'
import type { ExplorationPaperModel, ExplorationDetail } from './explorationUi'
const props = withDefaults(defineProps<{ model: ExplorationPaperModel; stage: ExplorationDetail | null; navigation: readonly PaperNavigationItem[]; notice: string; preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ select: [id: string]; zone: [id: string]; navigate: [id: string]; back: []; mode: [id: string]; stopFarm: []; openBuild: []; start: [] }>()
const { t } = useI18n()
const progress = computed(() => Number.isFinite(props.model.progress) ? Math.max(0, Math.min(100, props.model.progress)) : 0)

// Same dialog contract ImperialScrollScene carried: Escape closes,
// focus and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" role="dialog" aria-modal="true" tabindex="-1" class="progression-scene pc-progression pc-progression--exploration exploration-scene" :aria-label="t('exploration.title')" @click.self="emit('back')">
    <PcPaperScene :title="t('exploration.title')" :subtitle="model.subtitle">
      <template #tabs><div class="exploration-zones pc-paper-tabs" role="group" :aria-label="t('exploration.zones')"><button v-for="zone in model.zones" :key="zone.id" :class="{'is-locked': !zone.unlocked}" :aria-pressed="model.zone === zone.id" :disabled="!zone.unlocked" @click="emit('zone', zone.id)">{{ zone.label }}</button></div></template>
      <div class="progression-workspace exploration-workspace"><div class="exploration-map-region"><h2 class="zone-title">{{ model.title }}</h2><ExplorationPaperMap :chapters="model.chapters" :terrain="model.terrain" :selected="stage?.id ?? ''" @select="emit('select', $event)" /><div class="progress"><div class="progress-label"><span>{{ t('exploration.progress') }}</span><span>{{ model.progressLabel }}</span></div><div class="track" role="progressbar" :aria-label="t('exploration.progress')" :aria-valuenow="progress" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${progress}%` }" /></div></div></div><ExplorationPaperDetails :model="model" :stage="stage" :notice="notice" @mode="emit('mode', $event)" @stop-farm="emit('stopFarm')" @open-build="emit('openBuild')" @start="emit('start')" /></div>
      <template #footer><p v-if="preview" class="progression-preview-label">{{ t('exploration.preview') }}</p></template>
      <template #actions><PcPaperSceneActions :items="navigation" active="exploration" @navigate="emit('navigate', $event)" @back="emit('back')" /></template>
    </PcPaperScene>
  </section>
</template>
