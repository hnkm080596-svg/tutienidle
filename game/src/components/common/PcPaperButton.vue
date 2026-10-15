<script setup lang="ts">
import { playUiButtonClick } from '@/presentation/audio/buttonClickAudio'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'currency'
    icon?: boolean
    sound?: boolean
    silent?: boolean
  }>(),
  { variant: 'primary', icon: false, sound: true, silent: false },
)
const emit = defineEmits<{ click: [event: MouseEvent] }>()

function handleClick(event: MouseEvent) {
  playUiButtonClick({ sound: props.sound, silent: props.silent })
  emit('click', event)
}
</script>

<template>
  <button type="button" class="pc-paper-button" :class="[`pc-paper-button--${variant}`, { 'pc-paper-button--icon': icon }]" @click="handleClick"><slot /></button>
</template>
