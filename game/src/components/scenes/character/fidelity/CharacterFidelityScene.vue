<script setup lang="ts">
import '@/assets/tien-hiep-collections.css'
// Nhan Vat paper surface (fidelity) - rendered inside the host's design
// canvas above the Dong Fu vista. Pure surface: model/notice/selection
// in, intent events out. The Chi Tiet dock is always rendered open.
// `preview` renders the BAN DUYET stamp for the standalone page only.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import CharacterFidelityIdentity from './CharacterFidelityIdentity.vue'
import CharacterFidelityFigure from './CharacterFidelityFigure.vue'
import CharacterFidelityStats from './CharacterFidelityStats.vue'
import CharacterFidelityDetails from './CharacterFidelityDetails.vue'
import { type CharacterUiModel } from './characterUi'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperSceneActions from '@/components/common/PcPaperSceneActions.vue'
withDefaults(defineProps<{
  model: CharacterUiModel
  notice: string
  navigation: readonly PaperNavigationItem[]
  preview?: boolean
}>(), { preview: false })
const emit = defineEmits<{
  select: [id: string]
  navigate: [id: string]
  allocate: [id: string]
  back: []
}>()
const { t } = useI18n()
// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" role="dialog" aria-modal="true" tabindex="-1" class="th-collection pc-collection cf-scene" :aria-label="t('panels.wheel.slots.character')" @click.self="emit('back')">
    <PcPaperScene :title="t('panels.wheel.slots.character')" class="pc-collection-page">
      <template #actions><PcPaperSceneActions :items="navigation" active="character" @navigate="emit('navigate', $event)" @back="emit('back')" /></template>
      <div class="pc-collection-stage">

    <div class="character-study">
      <CharacterFidelityIdentity :model="model" />
      <CharacterFidelityFigure />
    </div>
    <CharacterFidelityStats :model="model" @select="emit('select', $event)" @allocate="emit('allocate', $event)" />
    <CharacterFidelityDetails :model="model" />
    <p v-if="preview" class="cf-preview">{{ t('preview') }}</p>
    <div class="cf-notice" role="status" aria-live="polite">{{ notice }}</div>
      </div>
    </PcPaperScene>
  </section>
</template>
<style scoped>
/* pointer-events:auto on the scene root: the overlay canvas disables
   pointer events for all descendants, so each surface opts back in at
   its root. @click.self on it doubles as the outside-paper close. */
.cf-scene { position: absolute; inset: 0; pointer-events: auto; color: #30291d; font-family: var(--font-display, Georgia, serif); }
.cf-scene :deep(*) { box-sizing: border-box; }.cf-scene :deep(button), .cf-scene :deep(a) { font-family: inherit; }
.cf-scene :deep(button:focus-visible), .cf-scene :deep(a:focus-visible) { outline: 2px solid #7a481f; outline-offset: 4px; }.cf-scene :deep(button:hover) { filter: brightness(1.12); }
.cf-paper { position: absolute; left: 94px; top: 123px; width: 1334px; height: 633px; border: 0 solid transparent; border-image-slice: 300 fill; border-image-width: 83px; border-image-repeat: stretch; filter: drop-shadow(0 12px 15px #0009); }
.cf-preview { position: absolute; left: 215px; top: 705px; width: 210px; font-size: 10px; line-height: 15px; letter-spacing: .4px; color: #675c43; z-index: 4; }
.cf-notice { position: absolute; left: 450px; top: 704px; width: 675px; height: 25px; text-align: center; font-size: 13px; color: #4e3b1d; z-index: 6; pointer-events: none; }
</style>
