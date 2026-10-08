<script setup lang="ts">
import { equipmentArt } from './equipmentArt'
withDefaults(
  defineProps<{
    icon?: string
    label: string
    circular?: boolean
    selected?: boolean
    quality?: 'gold' | 'blue' | 'purple'
    empty?: boolean
  }>(),
  { circular: false, selected: false, empty: false, quality: 'gold' },
)
const emit = defineEmits<{ select: [] }>()
</script>
<template>
  <button
    type="button"
    class="equipment-art-slot"
    :class="[{ circular, selected, empty }, `quality-${quality}`]"
    :disabled="empty"
    :aria-label="label"
    :aria-pressed="!empty && selected"
    @click="emit('select')"
  >
    <img
      class="equipment-slot-frame"
      :src="equipmentArt(circular ? 'equipment-circle-frame-v1' : 'item-slot-v1')"
      alt=""
    />
    <img v-if="icon" class="equipment-slot-item" :src="icon" alt="" />
  </button>
</template>
<style scoped>
.equipment-art-slot {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  isolation: isolate;
}
.equipment-slot-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  filter: var(--equipment-slot-tone, brightness(1));
}
.equipment-slot-item {
  position: absolute;
  inset: 12%;
  width: 76%;
  height: 76%;
  object-fit: contain;
  pointer-events: none;
}
.circular .equipment-slot-item {
  inset: 20%;
  width: 60%;
  height: 60%;
}
.quality-blue:not(.circular) {
  --equipment-slot-tone: hue-rotate(160deg) saturate(0.65);
}
.quality-purple:not(.circular) {
  --equipment-slot-tone: hue-rotate(225deg) saturate(0.55);
}
.equipment-art-slot:not(:disabled):hover .equipment-slot-frame {
  filter: var(--equipment-slot-tone, brightness(1)) brightness(1.65) drop-shadow(0 0 3px #ffd785) drop-shadow(0 0 7px #e9a935aa);
}
.equipment-art-slot.selected .equipment-slot-frame {
  filter: var(--equipment-slot-tone, brightness(1)) brightness(1.8) drop-shadow(0 0 3px #ffe6a4) drop-shadow(0 0 8px #edb747bb);
}
.equipment-art-slot:not(:disabled):active .equipment-slot-frame {
  filter: var(--equipment-slot-tone, brightness(1)) brightness(0.88);
}
.equipment-art-slot:focus-visible {
  outline: 2px solid #d6ad5d;
  outline-offset: 2px;
}
.circular:focus-visible {
  border-radius: 50%;
}
.empty {
  cursor: default;
}
</style>
