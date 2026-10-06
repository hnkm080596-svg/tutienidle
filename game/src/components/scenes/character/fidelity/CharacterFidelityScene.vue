<script setup lang="ts">
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
  <section ref="rootRef" class="cf-scene" :aria-label="t('panels.wheel.slots.character')" @click.self="emit('back')">
    <div class="cf-panel" :style="{ '--character-paper': `url('${CHARACTER_ART.paper}')`, '--character-card': `url('${CHARACTER_ART.card}')` }">
      <header class="cf-panel__header"><h1>{{ t('panels.wheel.slots.character') }}</h1></header>
      <div class="cf-panel__content">
        <CharacterFidelityIdentity :model="model" />
        <CharacterFidelityStats :model="model" @select="emit('select', $event)" @allocate="emit('allocate', $event)" />
        <CharacterFidelityDetails :model="model" />
      </div>
      <p v-if="preview" class="cf-preview">{{ t('preview') }}</p>
      <div class="cf-notice" role="status" aria-live="polite">{{ notice }}</div>
    </div>
  </section>
</template>
<style scoped>
/* pointer-events:auto on the scene root: the overlay canvas disables
   pointer events for all descendants, so each surface opts back in at
   its root. @click.self on it doubles as the outside-paper close. */
.cf-scene { position: absolute; inset: 0; pointer-events: auto; color: #f0dfbb; font-family: var(--font-display, Georgia, serif); }
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
.cf-panel__header { height: 61px; border-bottom: 1px solid #b28a43; display: flex; align-items: flex-start; justify-content: space-between; color: #302519; }
.cf-panel__header h1 { font-size: 38px; margin: 0; }
.cf-panel__content { display: grid; grid-template-columns: 28% 39% 1fr; gap: 14px; height: calc(100% - 72px); margin-top: 11px; min-height: 0; }
.cf-scene :deep(.character-card) { position: relative; isolation: isolate; background: transparent; border: 0; color: #f0dfbb; padding: 13px 16px; }
/* The power card opts out of the card relative box: it docks to the
   portrait column's bottom edge over the figure (mock geometry). */
.cf-scene :deep(.character-power) { position: absolute; bottom: 0; left: 0; right: 0; }
.cf-scene :deep(.character-card)::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; border: 15px solid transparent; border-image: var(--character-card) 90 fill / 15px stretch; }
.cf-scene :deep(.character-card h2) { font-size: 19px; margin: 0 0 9px; padding-bottom: 7px; border-bottom: 1px solid #9d8049; font-weight: 500; }
.cf-preview { position: absolute; left: 121px; top: 582px; width: 210px; font-size: 10px; line-height: 15px; letter-spacing: .4px; color: #675c43; z-index: 4; }
.cf-notice { position: absolute; left: 356px; bottom: 8px; width: 675px; height: 25px; text-align: center; font-size: 13px; color: #4e3b1d; z-index: 6; pointer-events: none; }
</style>
