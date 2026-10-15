<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
// Nhan Vat surface (G3 landscape-design skin): the mock's three-column
// paper panel - portrait + power card | stats/talent/elements cards |
// detail scroll - on the same CharacterUiModel the G2 scene carried.
// R9 ruling: no PaperPanelNavigation and no back affordance inside the
// panel; the rail navigates, Escape/click-outside still close.
// `preview` renders the BAN DUYET stamp for the standalone page only.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import CharacterFidelityIdentity from './CharacterFidelityIdentity.vue'
import CharacterFidelityStats from './CharacterFidelityStats.vue'
import CharacterFidelityDetails from './CharacterFidelityDetails.vue'
import { CHARACTER_ART, type CharacterUiModel } from './characterUi'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const titleDivider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/title-divider-clouds-v1.png')
withDefaults(defineProps<{
  model: CharacterUiModel
  notice: string
  preview?: boolean
}>(), { preview: false })
const emit = defineEmits<{
  select: [id: string]
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
  <section ref="rootRef" class="rail-panel-scene cf-scene" :aria-label="t('panels.wheel.slots.character')" @click.self="emit('back')">
    <GamePanel :title="t('panels.wheel.slots.character')">
    <div class="cf-panel" :style="{ '--character-paper': `url('${CHARACTER_ART.paper}')`, '--character-card': `url('${CHARACTER_ART.card}')` }">
      
      <div class="cf-panel__content">
        <CharacterFidelityIdentity :model="model" />
        <CharacterFidelityStats :model="model" @select="emit('select', $event)" @allocate="emit('allocate', $event)" />
        <CharacterFidelityDetails :model="model" />
      </div>
      <p v-if="preview" class="cf-preview">{{ t('preview') }}</p>
      <div class="cf-notice" role="status" aria-live="polite">{{ notice }}</div>
    </div>
    </GamePanel>
  </section>
</template>
<style scoped>
/* The shared rail scene boundary is click-through; GamePanel owns input. */
.cf-scene { position: absolute; inset: 0;  color: #f0dfbb; font-family: var(--font-display, Georgia, serif); }
.cf-scene :deep(*) { box-sizing: border-box; }
.cf-scene :deep(button), .cf-scene :deep(a) { font-family: inherit; }
.cf-scene :deep(button:focus-visible), .cf-scene :deep(a:focus-visible) { outline: 2px solid #e8b657; outline-offset: 4px; }
.cf-scene :deep(button:hover) { filter: brightness(1.12); }
/* Panel frame + cards: the approved landscape-design skin (paper page
   under a double border; nine-slice card frames via border-image). */
/* Geometry: the 1440x810 design space is scaled x1.0889 to the viewport,
   so values below are mock screen-px / 1.0889 (mock panel: x376 y166
   w1160 h662, 30px pad). */
.cf-panel { position: absolute; left: 345px; top: 101px; width: 1065px; height: 608px; padding: 22px 27px 26px; background: #f2e4c8 var(--character-paper) center/cover; border: 3px double #b28a43; overflow: hidden; }
.cf-panel__header { height: 61px; border-bottom: 0; display: flex; align-items: flex-start; justify-content: flex-start; padding-left: 54px; color: #302519; background: linear-gradient(#b28a43, #b28a43) left bottom/61px 1px no-repeat, linear-gradient(#b28a43, #b28a43) right bottom/calc(100% - 257px) 1px no-repeat; }
:is(#app, body) .cf-panel__header h1 { margin: 0; font-size: 56px; position: relative; top: 6px; left: -85px; } .cf-head-title{display:flex;flex-direction:column}.cf-divider{width:200px;margin-top:0;object-fit:contain;opacity:.9;position:relative;top:-19px;left:5px;pointer-events:none}
.cf-panel__content { --character-footer-card-height: 96px; display: grid; grid-template-columns: 28% 39% 1fr; gap: 14px; height: calc(100% - 72px); margin-top: 11px; min-height: 0; }
.cf-scene :deep(.character-card) { position: relative; }
/* The power card opts out of the card relative box: it docks to the
   portrait column's bottom edge over the figure (mock geometry). */
.cf-scene :deep(.character-power) { position: absolute; bottom: 0; left: 0; right: 0; }
.cf-preview { position: absolute; left: 121px; top: 582px; width: 210px; font-size: 10px; line-height: 15px; letter-spacing: .4px; color: #675c43; z-index: 4; }
.cf-notice { position: absolute; left: 356px; bottom: 8px; width: 675px; height: 25px; text-align: center; font-size: 13px; color: #4e3b1d; z-index: 6; pointer-events: none; }

/* Layout instances are relative to the owning panel content. */
.cf-scene :deep(.game-panel__content .cf-panel) { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; background: transparent; border: 0; box-shadow: none; }
.cf-scene :deep(.game-panel__content .cf-panel__header) { display: none; }
.cf-scene :deep(.game-panel__content .cf-panel__content) { position: absolute; inset: 0; width: 100%; height: 100%; min-width: 0; min-height: 0; margin: 0; padding-top: 12px; box-sizing: border-box; }
.cf-scene :deep(.game-panel__content .cf-notice) { left: 0; right: 0; top: auto; bottom: 0; width: 100%; }
</style>
