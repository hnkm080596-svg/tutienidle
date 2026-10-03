<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { stableSymbolUrl } from '@/presentation/huyenKim/StableSceneArt'
import { DEFAULT_THANH_VAN_VARIANT, thanhVanLoadList } from '@/presentation/background/ThanhVanBackdropArt'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import VictoryFidelityScene from '@/components/scenes/victory/fidelity/VictoryFidelityScene.vue'
import type { VictoryDisplayModel } from '@/components/scenes/victory/fidelity/victoryUi'
const { t } = useI18n()
const notice = shallowRef('')
const existing = thanhVanLoadList(DEFAULT_THANH_VAN_VARIANT)
const layers = [0,1,2,6,3,4,5].map(index=>existing[index]!).map(layer=>({id:layer.key,src:resolveAssetUrl(layer.url)}))
const model = computed<VictoryDisplayModel>(() => ({stage:t('stage'),caption:t('caption'),rewards:[
  {id:'stone',name:t('reward.stone'),amount:'318',motif:'jade',tone:'#76d5b0'},
  {id:'ore',name:t('reward.ore'),amount:'8',icon:resolveAssetUrl('/assets/materials/linh_khoang.png'),tone:'#9cc8e6'},
  {id:'wood',name:t('reward.wood'),amount:'12',icon:resolveAssetUrl('/assets/materials/linh_moc.png'),tone:'#b5cf84'},
  {id:'pill',name:t('reward.pill'),amount:'3',icon:resolveAssetUrl('/assets/pills/tu_linh_dan.png'),tone:'#e2c380'},
  {id:'equipment',name:t('reward.equipment'),amount:'1',icon:resolveAssetUrl('/assets/equipment/items/base-kiem/kiem-01.png'),tone:'#d6a0e1'},
],growth:[
  {id:'technique',label:t('progress.technique'),value:'+120',detail:t('detail.technique'),icon:stableSymbolUrl('technique'),progress:64,tone:'#edcf85'},
  {id:'skill',label:t('progress.skill'),value:'+60',detail:t('detail.skill'),icon:stableSymbolUrl('skill'),progress:57.5,tone:'#9bd1ad'},
  {id:'artifact',label:t('progress.artifact'),value:'+30',detail:t('detail.artifact'),icon:stableSymbolUrl('equipment'),progress:64,tone:'#e6aa89'},
]}))
</script>
<template><SceneDesignCanvas><div class="victory-preview-host"><div class="existing-art" aria-hidden="true"><img v-for="layer in layers" :key="layer.id" :src="layer.src" alt="" draggable="false"></div><VictoryFidelityScene :model="model" :notice="notice" @retry="notice=t('notice')" @continue="notice=t('notice')" /></div></SceneDesignCanvas></template>
<style scoped>.victory-preview-host { position:relative; width:100%; height:100%; background:#172526; }.existing-art { position:absolute; inset:0; pointer-events:none; }.existing-art img { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; }</style>
