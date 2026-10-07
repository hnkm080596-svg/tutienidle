<script setup lang="ts">
import {computed,shallowRef} from 'vue'
import {useI18n} from 'vue-i18n'
import {resolveAssetUrl} from '@/presentation/assets/AssetBaseUrl'
import {DEFAULT_THANH_VAN_VARIANT,thanhVanLoadList} from '@/presentation/background/ThanhVanBackdropArt'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DefeatFidelityScene from '@/components/scenes/defeat/fidelity/DefeatFidelityScene.vue'
const {t}=useI18n()
const notice=shallowRef('')
const existing=thanhVanLoadList(DEFAULT_THANH_VAN_VARIANT)
const layers=[0,1,2,6,3,4,5].map(index=>existing[index]!).map(layer=>({id:layer.key,src:resolveAssetUrl(layer.url)}))
const rewards=computed(()=>[{id:'ore',name:t('items.ore'),amount:'2',icon:resolveAssetUrl('/assets/materials/linh_khoang.png'),tone:'#9cc8e6'},{id:'wood',name:t('items.wood'),amount:'3',icon:resolveAssetUrl('/assets/materials/linh_moc.png'),tone:'#b5cf84'},{id:'stone',name:t('items.stone'),amount:'48',motif:'jade' as const,tone:'#76d5b0'}])
function home(){window.location.assign('/legacy/ui-dong-fu.html')}
</script>
<template><SceneDesignCanvas><div class="defeat-host"><div class="existing-art" aria-hidden="true"><img v-for="layer in layers" :key="layer.id" :src="layer.src" alt="" draggable="false"></div><DefeatFidelityScene :stage="t('questPreview.names.mountain')" :reason="t('defeat.hint')" :rewards="rewards" :notice="notice" @retry="notice=t('notice')" @home="home"/></div></SceneDesignCanvas></template>
<style scoped>.defeat-host{position:relative;width:100%;height:100%;background:#172526}.existing-art{position:absolute;inset:0;pointer-events:none}.existing-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}</style>
