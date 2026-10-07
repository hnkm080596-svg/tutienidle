<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
// R9/tribulation reskin: skin selects the pack chrome behind the card.
// 'panel' = ink-panel-cutout (generic dark ornate card), 'question' =
// question-panel (tassel frame reserved for the mind-trial card),
// 'plaque' = title-plaque (wide header strip).
const props = withDefaults(defineProps<{ skin?: 'panel' | 'question' | 'plaque' }>(), { skin: 'panel' })
const ART: Record<'panel' | 'question' | 'plaque', string> = {
  panel: '/assets/ui/tien-hiep-2026-10/source/ink-panel-cutout-v3.png',
  question: '/assets/ui/tien-hiep-2026-10/tribulation/question-panel-v1.png',
  plaque: '/assets/ui/tien-hiep-2026-10/tribulation/title-plaque-v1.png',
}
const frame = computed(() => resolveAssetUrl(ART[props.skin]))
</script>
<template><div class="tribulation-frame" :style="{ '--trib-frame': `url('${frame}')` }"><slot /></div></template>
<style scoped>.tribulation-frame { background:var(--trib-frame) center/100% 100% no-repeat; filter:drop-shadow(0 5px 9px #0008); }</style>
