<script setup lang="ts">
import GamePanel from './GamePanel.vue'
defineProps<{ title: string }>()
</script>
<template><GamePanel :title="title"><slot /></GamePanel></template>