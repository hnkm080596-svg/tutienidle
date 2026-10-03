<script setup lang="ts">
import {computed,shallowRef} from 'vue'
import {useI18n} from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import QuestFidelityScene from '@/components/scenes/quest/fidelity/QuestFidelityScene.vue'
import {questFixtures} from './finalPreviewFixtures'
import {previewPaperNavigation} from './paperNavigation'
import {previewRoutes} from './previewRoutes'
import {resolveAssetUrl} from '@/presentation/assets/AssetBaseUrl'
const {t}=useI18n()
const filter=shallowRef('all'),selectedId=shallowRef('mountain'),notice=shallowRef('')
const navigation=computed(()=>previewPaperNavigation(t))
const quests=computed(()=>questFixtures(t).filter(q=>filter.value==='all'||filter.value==='once'||q.status===filter.value))
const selected=computed(()=>quests.value.find(q=>q.id===selectedId.value)??quests.value[0])
const rewards=computed(()=>[{id:'ore',name:t('items.ore'),amount:'8',icon:resolveAssetUrl('/assets/materials/linh_khoang.png'),tone:'#9ac7b0'},{id:'pill',name:t('items.pill'),amount:'3',icon:resolveAssetUrl('/assets/pills/tu_linh_dan.png'),tone:'#e0bc73'},{id:'stone',name:t('items.stone'),amount:'100',motif:'jade' as const,tone:'#76d5b0'}])
function navigate(id:string){const route=previewRoutes[id];if(route&&id!=='quest')window.location.assign(route);else if(id!=='quest')notice.value=t('navNotice',{name:t(`nav.${id}`)})}
function back(){window.location.assign('/ui-dong-fu.html')}
</script>
<template><SceneDesignCanvas><div class="quest-preview-host"><DongFuVista /><QuestFidelityScene :quests="quests" :selected="selected" :filter="filter" :rewards="rewards" :navigation="navigation" :notice="notice" preview @navigate="navigate" @back="back" @filter="filter=$event;notice=''" @select="selectedId=$event;notice=''" @action="notice=t('notice')"/></div></SceneDesignCanvas></template>
<style scoped>.quest-preview-host{position:relative;width:100%;height:100%}</style>
