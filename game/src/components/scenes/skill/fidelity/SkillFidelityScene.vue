<script setup lang="ts">
import '@/assets/tien-hiep-progression.css'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperSceneActions from '@/components/common/PcPaperSceneActions.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import SkillPaperTree from './SkillPaperTree.vue'
import SkillPaperDetails from './SkillPaperDetails.vue'
import type { SkillUiNode, SkillUiEdge, SkillUiElement } from './skillUi'
withDefaults(
  defineProps<{
    nodes: readonly SkillUiNode[]
    edges: readonly SkillUiEdge[]
    elements: readonly SkillUiElement[]
    element: string
    selected: SkillUiNode | null
    navigation: readonly PaperNavigationItem[]
    notice: string
    /** Way/pathway identity line under the title. */
    identity: string
    /** Insight balance rendered beside the respec entry. */
    insightLabel: string
    respecDisabled: boolean
    /** Natural square layout size + zoom-to-fit for the graph. */
    graphSize?: number
    graphFit?: number
    preview?: boolean
  }>(),
  { preview: false, graphSize: 710, graphFit: 1 },
)
const emit = defineEmits<{ navigate: [id: string]; back: []; select: [id: string]; element: [id: string]; upgrade: [id: string]; respec: [] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" role="dialog" aria-modal="true" tabindex="-1" class="progression-scene pc-progression pc-progression--skill skill-paper-scene" :aria-label="t('skill.title')" @click.self="emit('back')">
    <PcPaperScene :title="t('skill.title')" :subtitle="identity">
      <template #tabs><div v-if="elements.length" class="skill-elements pc-paper-tabs" role="group" :aria-label="t('skill.elements')"><button v-for="entry in elements" :key="entry.id" :aria-pressed="entry.id === element" @click="emit('element', entry.id)"><img :src="entry.icon" alt=""><span>{{ entry.label }}</span></button></div></template>
      <div class="progression-workspace skill-workspace"><SkillPaperTree :nodes="nodes" :edges="edges" :selected="selected?.id ?? ''" :size="graphSize" :fit="graphFit" @select="emit('select', $event)" /><SkillPaperDetails :node="selected" :notice="notice" @upgrade="emit('upgrade', $event)" /></div>
      <template #footer><div class="skill-meta"><span class="skill-insight">{{ insightLabel }}</span><PcPaperButton variant="secondary" class="skill-respec" :disabled="respecDisabled" @click="emit('respec')">{{ t('panels.nodeTree.respec.button') }}</PcPaperButton></div><p v-if="preview" class="progression-preview-label">{{ t('skill.preview') }}</p></template>
      <template #actions><PcPaperSceneActions :items="navigation" active="skill" @navigate="emit('navigate', $event)" @back="emit('back')" /></template>
    </PcPaperScene>
  </section>
</template>
