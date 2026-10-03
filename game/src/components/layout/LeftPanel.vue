<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import InventoryPanel from '../panels/InventoryPanel.vue'
import CharacterSurface from '@/components/scenes/character/CharacterSurface.vue'

const ui = useUiStore()
const { t } = useI18n()

// Huyen Kim rebuild: the old dual ink-drawer became the imperial scroll
// surface; scene 04 (Nhan Vat) has now migrated to the approved
// character-v2 fidelity surface (paper over the Dong Fu vista, its own
// overlay design canvas). Scene 09 (Kho Vat) keeps the scroll shell
// until its own fidelity pass - one authority per surface.
function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <CharacterSurface v-if="ui.characterOverlayOpen && ui.characterSceneTab === 'character'" />
  <ImperialScrollScene
    v-else
    :open="ui.characterOverlayOpen"
    :title="t('panels.bag.title')"
    scene="inventory"
    data-testid="home-scroll-scene"
    @close="close"
  >
    <InventoryPanel />
  </ImperialScrollScene>
</template>
