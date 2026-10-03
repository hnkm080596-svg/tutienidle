<script setup lang="ts">
import {computed,shallowRef} from 'vue'
import {useI18n} from 'vue-i18n'
import PaperPreviewSurface from './PaperPreviewSurface.vue'
import ForgeFidelityScene from '@/components/scenes/equipment/fidelity/ForgeFidelityScene.vue'
import {resolveAssetUrl} from '@/presentation/assets/AssetBaseUrl'
const {t}=useI18n()
const mode=shallowRef('enhance'),selected=shallowRef('sword'),notice=shallowRef('')
const requestedMode=window.location.hash.slice(1)
if(['enhance','wash','refine','dissolve','decompose'].includes(requestedMode))mode.value=requestedMode
const items=computed(()=>['sword','robe','ring'].map((id,i)=>({id,name:t(`items.${id}`),icon:resolveAssetUrl(['/assets/equipment/items/base-kiem/kiem-01.png','/assets/equipment/items/base-bao/bao-01.png','/assets/equipment/items/base-gioi/gioi-01.png'][i]!)})))
const item=computed(()=>items.value.find(i=>i.id===selected.value)!)
</script>
<template><PaperPreviewSurface :title="t('forge.title')" active="equipment" :notice="notice"><ForgeFidelityScene :mode="mode" :items="items" :item="item" @mode="mode=$event;notice=''" @select="selected=$event;notice=''" @action="notice=t('notice')"/></PaperPreviewSurface></template>
