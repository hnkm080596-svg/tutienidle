<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import VictoryFidelityRewards from './VictoryFidelityRewards.vue'
import VictoryFidelityGrowth from './VictoryFidelityGrowth.vue'
import type { VictoryDisplayModel } from './victoryUi'
defineProps<{ model: VictoryDisplayModel; notice: string }>()
const emit = defineEmits<{ retry: []; continue: [] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
const title = resolveAssetUrl('/assets/ui/huyen-kim/scene/victory-v2/victory-title-v1.png')
const divider = resolveAssetUrl('/assets/ui/huyen-kim/ornaments/divider-ornament@2x.png')
</script>
<template><section class="victory-fidelity" :aria-label="t('title')"><div class="result-shade" aria-hidden="true" /><header class="victory-header"><h1><img :src="title" :alt="t('title')"></h1><p class="victory-stage">{{ model.stage }}</p><p class="victory-caption">{{ model.caption }}</p></header><div class="victory-paper" :style="{ borderImageSource: `url('${paper}')` }"><VictoryFidelityRewards :rewards="model.rewards" /><img class="section-divider" :src="divider" alt=""><VictoryFidelityGrowth :growth="model.growth" /></div><div class="victory-actions"><button class="retry" @click="emit('retry')"><span aria-hidden="true">↻</span>{{ t('retry') }}</button><button class="continue" @click="emit('continue')">{{ t('continue') }}<span aria-hidden="true">»</span></button></div><p class="victory-notice" role="status">{{ notice }}</p><p class="victory-preview">{{ t('preview') }}</p></section></template>
<style scoped>
.victory-fidelity { position:absolute; inset:0; color:#f1d99b; font-family:var(--font-display,Georgia,serif); }.victory-fidelity :deep(*) { box-sizing:border-box; }.result-shade { position:absolute; inset:0; background:#06110dcc; }.victory-header { position:absolute; left:380px; top:90px; width:680px; text-align:center; z-index:2; }.victory-header h1 { margin:0 auto; width:550px; height:217px; }.victory-header h1 img { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 3px 8px #0009); }.victory-stage { margin:-7px auto 0; padding:7px 32px; width:max-content; max-width:600px; border:1px solid #b89650; border-radius:3px; background:linear-gradient(#293626,#102016); color:#ffe7ac; font-size:20px; }.victory-caption { margin:10px 0 0; font-size:14px; color:#e5d3a9; text-shadow:0 2px 4px #000; }
.victory-paper { position:absolute; left:255px; top:361px; width:930px; height:316px; padding:28px 59px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:53px; border-image-repeat:stretch; filter:drop-shadow(0 9px 14px #0009); }.section-divider { display:block; width:350px; height:17px; margin:10px auto 4px; object-fit:contain; }
.victory-actions { position:absolute; left:454px; top:696px; display:flex; gap:30px; }.victory-actions button { display:flex; justify-content:center; align-items:center; gap:20px; width:251px; height:50px; border:1px solid #d3b773; border-radius:5px; box-shadow:inset 0 0 0 3px #efcf8533,0 3px 9px #0006; font:700 20px var(--font-display,Georgia,serif); cursor:pointer; }.retry { background:linear-gradient(#3c5b46,#112a1b); color:#f6e3ac; }.continue { background:linear-gradient(#ffe5a1,#c69649); color:#38250e; }.victory-actions span { font:30px Georgia,serif; }.victory-actions button:hover { filter:brightness(1.13); }.victory-actions button:focus-visible { outline:2px solid #ffe6a7; outline-offset:4px; }.victory-notice { position:absolute; top:750px; left:370px; width:700px; height:25px; margin:0; text-align:center; font-size:12px; color:#eee0bf; text-shadow:0 1px 3px #000; }.victory-preview { position:absolute; bottom:13px; left:370px; width:700px; margin:0; text-align:center; font-size:10px; color:#c4b99a; }
.victory-paper { padding-top:20px; padding-bottom:20px; }.section-divider { height:10px; margin:6px auto 2px; }
</style>
