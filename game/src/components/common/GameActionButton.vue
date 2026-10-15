<script setup lang="ts">
import EquipmentArtButton from './art/EquipmentArtButton.vue'
withDefaults(defineProps<{ disabled?: boolean; gold?: boolean }>(), { disabled: false, gold: true })
const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>
<template>
  <EquipmentArtButton class="game-action-button" filter-art :gold="gold && !disabled" :disabled="disabled" @click="emit('click', $event)"><slot /></EquipmentArtButton>
</template>
<style scoped>
.game-action-button { flex: 0 0 auto; height: 38px; }
</style>
