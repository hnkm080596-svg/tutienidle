<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import EquipmentPaperdoll from '../panels/EquipmentPaperdoll.vue'
import InventoryPanel from '../panels/InventoryPanel.vue'

const ui = useUiStore()
</script>

<template>
  <Transition name="panel-slide-right">
    <aside v-if="ui.characterOverlayOpen" class="right-panel ink-drawer">
      <div class="right-panel__equipment"><EquipmentPaperdoll /></div>
      <div class="ink-divider" aria-hidden="true" />
      <div class="right-panel__inventory"><InventoryPanel /></div>
    </aside>
  </Transition>
</template>

<style scoped>
.right-panel { position: absolute; z-index: 10; top: 0; right: 0; bottom: 0; width: clamp(340px, 27vw, 440px); display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--surface-shadow-deep); container-type: inline-size; container-name: right-panel;
  /* Panel-drawer-bg anchored right — the cloud bank + seal ornament
     edge of the art faces this drawer (left drawer gets the dragon). */
  --ink-drawer-bg-pos: right center; }
.right-panel__equipment { flex: 0 0 30%; min-height: 0; }
.right-panel__inventory { flex: 1; min-height: 0; overflow: auto; }
.panel-slide-right-enter-active,.panel-slide-right-leave-active { transition: transform .28s ease, opacity .28s ease; }
.panel-slide-right-enter-from,.panel-slide-right-leave-to { transform: translateX(100%); opacity: 0; }
/* Fit-refactor đợt 4 — floor 260px: dưới 900px hai drawer vẫn đủ chỗ slot
   grid tối thiểu; hẹp hơn nữa thì overlay character chiếm toàn màn thay
   vì hai drawer đè nhau (characterOverlayOpen chỉ mở khi còn chỗ). */
@media (max-width: 900px) { .right-panel { width: min(44vw, 400px); } }
@media (max-width: 620px) { .right-panel { width: 100%; } }
</style>
