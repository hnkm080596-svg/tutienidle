<script setup lang="ts">
import GameDropdownButton from '@/components/common/GameDropdownButton.vue'

export interface BagChipOption {
  value: string
  label: string
}
defineProps<{ modelValue: string; options: readonly BagChipOption[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <GameDropdownButton :model-value="modelValue" :options="options" :label="label"
    @update:model-value="emit('update:modelValue', $event)" />
</template>