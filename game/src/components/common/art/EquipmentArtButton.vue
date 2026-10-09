<script setup lang="ts">
withDefaults(defineProps<{ gold?: boolean; disabled?: boolean; filterArt?: boolean; squareArt?: boolean }>(), {
  gold: false,
  disabled: false,
  filterArt: false,
  squareArt: false,
})
const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>
<template>
  <button type="button" class="equipment-art-button" :class="{ gold, 'filter-art': filterArt, 'square-art': squareArt }" :disabled="disabled" @click="emit('click', $event)">
    <slot />
  </button>
</template>
<style scoped>
.equipment-art-button {
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 32px;
  padding: 7px 15px;
  border: 0;
  background: transparent;
  color: #f2e3c2;
  /* Owner ruling 2026-10-09: same face + weight as the scene op-tab
     buttons (700) so every function button in Trang Bi reads alike. */
  font: 700 14px/1.2 var(--pc-font-body);
  cursor: pointer;
}
.equipment-art-button::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / contain no-repeat;
  pointer-events: none;
}
.equipment-art-button.gold { color: #30210e; }
.equipment-art-button.gold::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-selected-v2.png');
}
.equipment-art-button:not(:disabled):hover::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-hover-v2.png');
}
.equipment-art-button.gold:not(:disabled):hover::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-selected-v2.png');
  filter: brightness(1.08);
}
.equipment-art-button:not(:disabled):active { color: #f2e3c2; transform: translateY(1px); }
.equipment-art-button:not(:disabled):active::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-pressed-v2.png');
  filter: none;
}
.equipment-art-button:disabled { opacity: 0.45; cursor: default; }
.equipment-art-button:focus-visible { outline: 2px solid #e5bd65; outline-offset: 2px; }
.equipment-art-button.filter-art { aspect-ratio: 1225 / 324; padding: 0 12px; min-height: 0; }
.equipment-art-button.square-art { color: #f2e3c2; }
.equipment-art-button.square-art::before,
.equipment-art-button.square-art.gold::before,
.equipment-art-button.square-art:not(:disabled):hover::before,
.equipment-art-button.square-art:not(:disabled):active::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-level-seal-v1.png');
}
.equipment-art-button.square-art.gold::before,
.equipment-art-button.square-art:not(:disabled):hover::before {
  filter: brightness(1.5) drop-shadow(0 0 3px #e7b654);
}
.equipment-art-button.square-art:not(:disabled):active::before { filter: brightness(0.8); }
</style>
