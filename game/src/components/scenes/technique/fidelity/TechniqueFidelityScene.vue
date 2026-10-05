<script setup lang="ts">
import { ref } from 'vue'
import '@/assets/tien-hiep-progression.css'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperSceneActions from '@/components/common/PcPaperSceneActions.vue'
import TechniquePaperInfo from './TechniquePaperInfo.vue'
import TechniquePaperArtifact from './TechniquePaperArtifact.vue'
import TechniquePaperUpgrade from './TechniquePaperUpgrade.vue'
import type { TechniqueUiModel } from './techniqueUi'
withDefaults(
  defineProps<{ model: TechniqueUiModel; navigation: readonly PaperNavigationItem[]; selected: string; notice: string; preview?: boolean }>(),
  { preview: false },
)
const emit = defineEmits<{ navigate: [id: string]; back: []; select: [id: string]; advance: [] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" role="dialog" aria-modal="true" tabindex="-1" class="progression-scene pc-progression pc-progression--technique technique-paper-scene" :aria-label="t('technique.title')" @click.self="emit('back')">
    <PcPaperScene :title="t('technique.title')">
      <div class="progression-workspace technique-workspace" :class="{'is-empty': !model.hasTechnique}"><TechniquePaperInfo :model="model" /><template v-if="model.hasTechnique"><TechniquePaperArtifact :model="model" :selected="selected" @select="emit('select', $event)" /><TechniquePaperUpgrade :model="model" :notice="notice" @advance="emit('advance')" /></template></div>
      <template #footer><p v-if="preview" class="progression-preview-label">{{ t('technique.preview') }}</p></template>
      <template #actions><PcPaperSceneActions :items="navigation" active="technique" @navigate="emit('navigate', $event)" @back="emit('back')" /></template>
    </PcPaperScene>
  </section>
</template>
