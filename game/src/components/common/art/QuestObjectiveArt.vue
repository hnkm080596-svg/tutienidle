<script setup lang="ts">
defineProps<{ done: boolean; label: string; amount: string }>()
</script>
<template><div class="quest-objective"><i :class="{done}">{{ done?'✓':'○' }}</i><span>{{ label }}</span><small>{{ amount }}</small></div></template>
<style scoped>
.quest-objective{display:flex;align-items:center;gap:8px;font-size:12px;}.quest-objective i{display:grid;place-items:center;width:20px;height:20px;border:1px solid #ca9e48;border-radius:50%;font-style:normal;color:#e8bb63;font-size:17px;}.quest-objective .done{color:#b3eba3;border-color:#9dd186;box-shadow:0 0 5px #86d96860;}.quest-objective small{margin-left:auto;white-space:nowrap;}
</style>
