<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const props = defineProps<{ art: string; family?: 'combat' | 'tribulation' }>()
const source = computed(() => resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/${props.family ?? 'combat'}/${props.art}-v1.png`))
</script>
<template><section class="combat-art-surface" :data-family="family ?? 'combat'"><img class="combat-art-surface__art" :src="source" alt="" aria-hidden="true"><slot /></section></template>
<style scoped>
.combat-art-surface { position: relative; isolation: isolate; color: #f3dfb5; }
.combat-art-surface__art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1; pointer-events: none; }
.combat-art-surface[data-family="combat"] > .combat-art-surface__art { filter: saturate(.48) brightness(.8); }
</style>

