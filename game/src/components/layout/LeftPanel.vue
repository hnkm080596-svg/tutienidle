<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import InventoryPanel from '../panels/InventoryPanel.vue'
import CharacterSurface from '@/components/scenes/character/CharacterSurface.vue'

const ui = useUiStore()

// Huyen Kim rebuild: the old dual ink-drawer AND the shared imperial
// scroll are both retired - scene 04 (Nhan Vat) rides the character-v2
// fidelity surface and scene 09 (Kho Vat) now owns the shared paper
// chrome on its own overlay design canvas, same as the other migrated
// tabs. One authority per surface; close is ui.closeHomeOverlays().
</script>

<template>
  <Transition name="th-panel-swap">
    <CharacterSurface v-if="ui.characterOverlayOpen && ui.characterSceneTab === 'character'" />
    <InventoryPanel v-else-if="ui.characterOverlayOpen" />
  </Transition>
</template>
