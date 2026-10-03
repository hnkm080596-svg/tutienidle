<script setup lang="ts">
import {computed,shallowRef} from 'vue'
import {useI18n} from 'vue-i18n'
import PaperPreviewSurface from './PaperPreviewSurface.vue'
import InventoryFidelityScene from '@/components/scenes/inventory/fidelity/InventoryFidelityScene.vue'
import {inventoryFixtures} from './finalPreviewFixtures'
const {t}=useI18n()
const filter=shallowRef('all'),query=shallowRef(''),selectedId=shallowRef('item-0'),notice=shallowRef(''),sorted=shallowRef(false)
const items=computed(()=>{const result=inventoryFixtures(t).filter(item=>(filter.value==='all'||item.category===filter.value)&&item.name.toLocaleLowerCase('vi').includes(query.value.trim().toLocaleLowerCase('vi')));return sorted.value?result.sort((a,b)=>a.name.localeCompare(b.name,'vi')):result})
const selected=computed(()=>items.value.find(i=>i.id===selectedId.value)??items.value[0])
</script>
<template><PaperPreviewSurface :title="t('inventoryPreview.title')" active="inventory" :notice="notice"><InventoryFidelityScene :items="items" :selected="selected" :filter="filter" :query="query" @filter="filter=$event;notice=''" @query="query=$event;notice=''" @select="selectedId=$event;notice=''" @sort="sorted=!sorted" @use="notice=t('notice')"/></PaperPreviewSurface></template>
