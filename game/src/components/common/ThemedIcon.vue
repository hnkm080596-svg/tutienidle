<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { getIconPath } from './iconRegistry'

interface Props {
  name: string
  size?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), { size: 24 })
defineEmits<{ (e: 'click'): void }>()

const { currentTheme } = useTheme()

const iconPath = computed(() => getIconPath(props.name, currentTheme.value))
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-label="props.ariaLabel"
    role="img"
    @click="$emit('click')"
  >
    <path :d="iconPath" />
  </svg>
</template>
