<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { AlchemyHerbChoice } from './alchemyUi'
defineProps<{ herb?: AlchemyHerbChoice | null }>()
const { t } = useI18n()
const cauldron = resolveAssetUrl('/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@2x.png')
</script>
<template><section class="cauldron-region" :aria-label="t('alchemy.cauldron')"><div class="cauldron-shadow" aria-hidden="true" /><img class="cauldron-art" :src="cauldron" alt=""><div v-if="herb" class="selected-herb"><span class="herb-icon"><img :src="herb.icon" alt=""></span><div><small>{{ t('alchemy.selectedHerb') }}</small><span>{{ herb.name }}</span></div><strong>{{ herb.amount }}</strong></div><p v-else class="cauldron-hint">{{ t('alchemy.placeIngredients') }}</p></section></template>
<style scoped>
.cauldron-region { position:absolute; left:509px; top:226px; width:425px; height:368px; }.cauldron-art { position:absolute; left:10px; top:0; width:405px; height:305px; object-fit:contain; filter:drop-shadow(0 10px 10px #70421d35); }.cauldron-shadow { position:absolute; left:68px; top:269px; width:290px; height:29px; border-radius:50%; background:radial-gradient(ellipse,#8e744c4d,transparent 70%); }.selected-herb { position:absolute; left:37px; right:37px; bottom:0; display:flex; align-items:center; gap:10px; padding:9px 14px; border-top:1px solid #af91515e; border-bottom:1px solid #af91515e; background:linear-gradient(90deg,transparent,#e3d1a95e,transparent); }.herb-icon { width:39px; height:39px; padding:3px; border:1px solid #ac925455; border-radius:50%; }.herb-icon img { width:100%; height:100%; object-fit:contain; }.selected-herb small { display:block; font-size:11px; color:#8b744a; }.selected-herb span { font-size:15px; }.selected-herb strong { margin-left:auto; font-size:13px; font-weight:500; color:#3d6950; }
.cauldron-hint { position:absolute; left:37px; right:37px; bottom:18px; margin:0; text-align:center; color:#8b744a; font-size:13px; }
</style>
