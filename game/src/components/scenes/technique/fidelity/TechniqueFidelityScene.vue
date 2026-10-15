<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import TechniquePaperInfo from './TechniquePaperInfo.vue'
import TechniquePaperArtifact from './TechniquePaperArtifact.vue'
import TechniquePaperUpgrade from './TechniquePaperUpgrade.vue'
import type { TechniqueUiModel } from './techniqueUi'
withDefaults(
  defineProps<{ model: TechniqueUiModel; selected: string; notice: string; preview?: boolean }>(),
  { preview: false },
)
const emit = defineEmits<{ back: []; select: [id: string]; advance: [] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="rail-panel-scene technique-paper-scene" :aria-label="t('technique.title')" @click.self="emit('back')">
    <GamePanel :title="t('technique.title')">
    
    <TechniquePaperInfo :model="model" />
    <template v-if="model.hasTechnique">
      <TechniquePaperArtifact :model="model" :selected="selected" @select="emit('select', $event)" />
      <TechniquePaperUpgrade :model="model" :notice="notice" @advance="emit('advance')" />
    </template>
    <p v-if="preview" class="technique-preview-label">{{ t('technique.preview') }}</p>
    </GamePanel>
  </section>
</template>
<style scoped>
.technique-paper-scene { position:absolute; inset:0;  color:#3c2f1e; font-family:var(--font-display,Georgia,serif); line-height:1.3; }.technique-paper-scene :deep(*) { box-sizing:border-box; }
.technique-preview-label { position:absolute; left:232px; top:702px; width:280px; margin:0; color:#7e6a44; font-size:10px; }

/* Layout instances are relative to the owning panel content. */
.technique-paper-scene :deep(.game-panel__content .technique-info) { left: 0; top: 0; width: 27%; height: 100%; }
.technique-paper-scene :deep(.game-panel__content .technique-artifact) { left: 28.5%; top: 0; width: 37%; height: 100%; }
.technique-paper-scene :deep(.game-panel__content .technique-upgrade) { left: auto; right: 0; top: 0; width: 33%; height: 100%; padding-left: 18px; overflow-y: auto; }
.technique-paper-scene :deep(.game-panel__content .technique-book) { left: 0; width: 100%; height: 330px; }
.technique-paper-scene :deep(.game-panel__content .technique-orbit) { left: 5%; width: 90%; height: 290px; }
.technique-paper-scene :deep(.game-panel__content .technique-art-caption) { top: 320px; }
</style>
