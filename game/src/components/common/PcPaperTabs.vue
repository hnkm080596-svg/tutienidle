<script setup lang="ts">
defineProps<{ items: readonly { id: string; label: string }[]; selected: string; label: string }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <nav class="pc-paper-tabs" :aria-label="label">
    <button v-for="item in items" :key="item.id" type="button" :aria-pressed="item.id === selected" @click="emit('select', item.id)">{{ item.label }}</button>
  </nav>
</template>
