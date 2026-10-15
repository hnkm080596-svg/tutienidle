<script setup lang="ts">
import EquipmentArtButton from './art/EquipmentArtButton.vue'
withDefaults(
  defineProps<{ disabled?: boolean; gold?: boolean; sound?: boolean; silent?: boolean }>(),
  { disabled: false, gold: true, sound: true, silent: false },
)
const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>
<template>
  <EquipmentArtButton class="game-action-button" filter-art :gold="gold && !disabled" :disabled="disabled" :sound="sound" :silent="silent" @click="emit('click', $event)"><slot /></EquipmentArtButton>
</template>
<style scoped>
.game-action-button { flex: 0 0 auto; height: 38px; }
</style>
