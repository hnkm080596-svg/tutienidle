<script setup lang="ts">
import GameCardTitle from '@/components/common/GameCardTitle.vue'
defineProps<{ label: string }>()
</script>
<template><GameCardTitle :label="label" /></template>