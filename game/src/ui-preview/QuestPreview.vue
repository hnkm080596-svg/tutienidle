<script setup lang="ts">
import {computed,shallowRef} from 'vue'
import {useI18n} from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import QuestFidelityScene from '@/components/scenes/quest/fidelity/QuestFidelityScene.vue'
import {questFixtures} from './finalPreviewFixtures'
import {previewRoutes} from './previewRoutes'
import {resolveAssetUrl} from '@/presentation/assets/AssetBaseUrl'
const {t}=useI18n()
const filter=shallowRef('all'),selectedId=shallowRef('mountain'),notice=shallowRef('')
const quests=computed(()=>questFixtures(t).filter(q=>filter.value==='all'||filter.value==='once'||q.status===filter.value))
const selected=computed(()=>quests.value.find(q=>q.id===selectedId.value)??quests.value[0])
const rewards=computed(()=>[{id:'ore',name:t('items.ore'),amount:'8',icon:resolveAssetUrl('/assets/materials/linh_khoang.png'),tone:'#9ac7b0'},{id:'pill',name:t('items.pill'),amount:'3',icon:resolveAssetUrl('/assets/pills/tu_linh_dan.png'),tone:'#e0bc73'},{id:'stone',name:t('items.stone'),amount:'100',motif:'jade' as const,tone:'#76d5b0'}])
function back(){window.location.assign('/legacy/ui-dong-fu.html')}
</script>
<template><SceneDesignCanvas><div class="quest-preview-host"><DongFuVista /><QuestFidelityScene :quests="quests" :selected="selected" :filter="filter" :rewards="rewards" :notice="notice" preview @back="back" @filter="filter=$event;notice=''" @select="selectedId=$event;notice=''" @action="notice=t('notice')"/></div></SceneDesignCanvas></template>
<style scoped>.quest-preview-host{position:relative;width:100%;height:100%}</style>
