<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import CharacterPanel from '../panels/CharacterPanel.vue'
import CharacterDetailCard from '../panels/CharacterDetailCard.vue'
import InventoryPanel from '../panels/InventoryPanel.vue'

const ui = useUiStore()
const { t } = useI18n()

// Huyen Kim rebuild: the old dual ink-drawer (Character left /
// Paperdoll+Inventory right) becomes the imperial scroll surface shared
// by scene 04 (Nhan Vat) and scene 09 (Kho Vat). One scroll instance -
// nav between the two swaps content instead of replaying the unfold.
function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <ImperialScrollScene
    :open="ui.characterOverlayOpen"
    :title="ui.characterSceneTab === 'inventory' ? t('panels.bag.title') : t('panels.wheel.slots.character')"
    :scene="ui.characterSceneTab === 'inventory' ? 'inventory' : 'character'"
    data-testid="home-scroll-scene"
    @close="close"
  >
    <CharacterPanel v-if="ui.characterSceneTab === 'character'" />
    <InventoryPanel v-else />

    <!-- Chi tiet drawer (scene 04 chi-tiet-drawer): rides the scroll's
         right edge as a floating overlay, same authority as before. -->
    <Transition name="stats-card-fade">
      <CharacterDetailCard
        v-if="ui.characterOverlayOpen && ui.characterSceneTab === 'character' && ui.characterDetailOpen"
        class="character-detail-dock"
      />
    </Transition>
  </ImperialScrollScene>
</template>

<style scoped>
/* The detail card overlays the scroll's right content column (spec:
   envelope-right-overlay). It sits inside the scroll's main region via
   absolute positioning against the envelope's stacking context. */
.character-detail-dock {
  position: absolute;
  right: 1cqw;
  top: 0;
  bottom: 0;
  z-index: 6;
  width: min(30cqw, 400px);
}

.stats-card-fade-enter-active,
.stats-card-fade-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.stats-card-fade-enter-from,
.stats-card-fade-leave-to {
  transform: translateX(-8px);
  opacity: 0;
}
</style>
