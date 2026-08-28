<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import EquipmentPaperdoll from '../panels/EquipmentPaperdoll.vue'
import InventoryPanel from '../panels/InventoryPanel.vue'

const ui = useUiStore()
</script>

<template>
  <Transition name="panel-slide-right">
    <aside v-if="ui.characterOverlayOpen" class="right-panel">
      <div class="right-panel__equipment"><EquipmentPaperdoll /></div>
      <div class="right-panel__inventory"><InventoryPanel /></div>
    </aside>
  </Transition>
</template>

<style scoped>
.right-panel { position: absolute; z-index: 10; top: 0; right: 0; bottom: 0; width: clamp(340px, 27vw, 440px); display: flex; flex-direction: column; overflow: hidden; background: var(--ink-900); border-left: 1px solid var(--ink-line); box-shadow: var(--shadow-panel); container-type: inline-size; container-name: right-panel; }
.right-panel__equipment { flex: 0 0 30%; min-height: 0; border-bottom: 1px solid var(--ink-line); }
.right-panel__inventory { flex: 1; min-height: 0; overflow: auto; }
.panel-slide-right-enter-active,.panel-slide-right-leave-active { transition: transform .28s ease, opacity .28s ease; }
.panel-slide-right-enter-from,.panel-slide-right-leave-to { transform: translateX(100%); opacity: 0; }
@media (max-width: 900px) { .right-panel { width: min(44vw, 400px); } }
</style>
