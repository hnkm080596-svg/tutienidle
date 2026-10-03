<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import PaperPanelNavigation, { type PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
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
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="technique-paper-scene" :aria-label="t('technique.title')" @click.self="emit('back')">
    <div class="technique-paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <PaperPanelNavigation :items="navigation" active="technique" :label="t('technique.navigation')" :back-label="t('dongFu.aria')" @select="emit('navigate', $event)" @back="emit('back')" />
    <TechniquePaperInfo :model="model" />
    <template v-if="model.hasTechnique">
      <TechniquePaperArtifact :model="model" :selected="selected" @select="emit('select', $event)" />
      <TechniquePaperUpgrade :model="model" :notice="notice" @advance="emit('advance')" />
    </template>
    <p v-if="preview" class="technique-preview-label">{{ t('technique.preview') }}</p>
  </section>
</template>
<style scoped>
.technique-paper-scene { position:absolute; inset:0; pointer-events:auto; color:#3c2f1e; font-family:var(--font-display,Georgia,serif); line-height:1.3; }.technique-paper-scene :deep(*) { box-sizing:border-box; }
.technique-paper { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; border-image-repeat:stretch; filter:drop-shadow(0 12px 15px #0009); }
.technique-preview-label { position:absolute; left:232px; top:702px; width:280px; margin:0; color:#7e6a44; font-size:10px; }
</style>
