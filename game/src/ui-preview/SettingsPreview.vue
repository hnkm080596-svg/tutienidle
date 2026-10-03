<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import PaperPreviewSurface from './PaperPreviewSurface.vue'
import SettingsFidelityScene from '@/components/scenes/settings/fidelity/SettingsFidelityScene.vue'
import type {SettingsDisplayControl} from '@/components/scenes/settings/fidelity/SettingsFidelitySection.vue'
const {t}=useI18n()
const active=shallowRef('all'),notice=shallowRef('')
const values=shallowRef<Record<string,string|number|boolean>>({master:80,music:60,effects:70,musicOn:true,effectsOn:true,scale:'100',language:'vi',motion:false})
const groups=computed(()=>{const audio:SettingsDisplayControl[]=['master','music','effects'].map(id=>({id,label:t(`settingsPreview.${id}`),kind:'range',value:values.value[id]!}));audio.push(...['musicOn','effectsOn'].map(id=>({id,label:t(`settingsPreview.${id}`),kind:'toggle' as const,value:values.value[id]!}))); const display:SettingsDisplayControl[]=[{id:'scale',label:t('settingsPreview.scale'),kind:'select',value:values.value.scale!,options:['80','100','120'].map(id=>({id,label:`${id}%`}))},{id:'language',label:t('settingsPreview.language'),kind:'select',value:values.value.language!,options:['vi','en'].map(id=>({id,label:t(`settingsPreview.${id}`)}))},{id:'motion',label:t('settingsPreview.motion'),kind:'toggle',value:values.value.motion!}];return [{id:'audio',label:t('settingsPreview.audio'),controls:audio},{id:'display',label:t('settingsPreview.display'),controls:display}].filter(g=>active.value==='all'||g.id===active.value)})
function update(id:string,value:string|number|boolean){values.value={...values.value,[id]:value};notice.value=t('notice')}
</script>
<template><PaperPreviewSurface :title="t('settingsPreview.title')" active="settings" :notice="notice"><SettingsFidelityScene :groups="groups" :active="active" @select="active=$event;notice=''" @update="update" @action="notice=t('notice')"/></PaperPreviewSurface></template>
