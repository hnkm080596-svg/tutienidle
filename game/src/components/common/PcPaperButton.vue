<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary'; icon?: boolean }>(), { variant: 'primary', icon: false })
const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button type="button" class="pc-paper-button" :class="[`pc-paper-button--${variant}`, { 'pc-paper-button--icon': icon }]" @click="emit('click', $event)"><slot /></button>
</template>
