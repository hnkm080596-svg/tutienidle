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

    <!-- Chi tiet drawer (scene 04 chi-tiet-drawer): envelope-overlay
         slot so it anchors to the scroll envelope at spec geometry
         instead of hugging the content region's right edge. -->
    <template #overlay>
      <Transition name="stats-card-fade">
        <CharacterDetailCard
          v-if="ui.characterOverlayOpen && ui.characterSceneTab === 'character' && ui.characterDetailOpen"
          class="character-detail-dock"
        />
      </Transition>
    </template>
  </ImperialScrollScene>
</template>

<style scoped>
/* Spec chi-tiet-drawer 1140/96/404/800 on the 1672x941 canvas,
   resolved against the 1540x840 envelope (origin 66/50): left
   69.74cqw, top 5.48cqh, w 26.23cqw, h 95.24cqh - inset, not
   full-height edge-hugging. */
.character-detail-dock {
  position: absolute;
  left: 69.74cqw;
  top: 5.48cqh;
  z-index: 6;
  width: 26.23cqw;
  height: 95.24cqh;
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
