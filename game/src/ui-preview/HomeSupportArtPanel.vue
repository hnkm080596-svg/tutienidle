<script setup lang="ts">
import {ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import EquipmentArtCard from './equipment/EquipmentArtCard.vue'
import EquipmentArtButton from './equipment/EquipmentArtButton.vue'
import QuestCategoryArtButton from './QuestCategoryArtButton.vue'
const props=defineProps<{kind:'settings'|'feedback'}>()
const {t}=useI18n()
const section=ref(0)
const defaults=()=>({master:80,music:60,sfx:70,ui:70,sound:true,shake:false,motion:false,scale:100,quality:'high',language:'vi'})
const values=ref(defaults())
const channels=['master','music','sfx','ui'] as const
const categories=['audio','display','language']
watch(()=>props.kind,()=>{section.value=0})
</script>
<template>
<section class="home-support-art" :data-testid="kind==='settings'?'home-settings-panel':'home-help-panel'">
<header><h1>{{t(kind==='settings'?'sp.settings':'sp.help')}}</h1></header>
<div class="support-columns"><nav><QuestCategoryArtButton v-for="index in (kind==='settings'?3:5)" :key="index" :icon="'/assets/ui/tien-hiep-2026-10/icons/navigation-'+(kind==='settings'?'settings':['home','character','body','equipment','quest'][index-1])+'-v2.png'" :label="t(kind==='settings'?'sp.'+categories[index-1]:'sp.helpGroups.'+(index-1))" hint="" :selected="section===index-1" @click="section=index-1"/></nav>
<EquipmentArtCard class="support-main">
<template v-if="kind==='settings'">
 <template v-if="section===0"><h2>{{t('sp.audio')}}</h2><label class="toggle"><input v-model="values.sound" type="checkbox">{{t('sp.sound')}}</label><label v-for="channel in channels" :key="channel" class="range-row"><span>{{t('sp.'+channel)}}</span><input v-model.number="values[channel]" type="range" min="0" max="100" :disabled="!values.sound" :aria-label="t('sp.'+channel)"><output>{{values[channel]}}%</output></label></template>
 <template v-else-if="section===1"><h2>{{t('sp.display')}}</h2><label class="toggle"><input v-model="values.shake" type="checkbox">{{t('sp.shake')}}</label><label class="toggle"><input v-model="values.motion" type="checkbox">{{t('sp.motion')}}</label><h3>{{t('sp.scale')}}</h3><div class="support-options"><EquipmentArtButton v-for="scale in [80,100,120]" :key="scale" :gold="values.scale===scale" :aria-pressed="values.scale===scale" @click="values.scale=scale">{{scale}}%</EquipmentArtButton></div><h3>{{t('sp.quality')}}</h3><div class="support-options"><EquipmentArtButton v-for="quality in ['low','medium','high']" :key="quality" :gold="values.quality===quality" :aria-pressed="values.quality===quality" @click="values.quality=quality">{{t('sp.'+quality)}}</EquipmentArtButton></div></template>
 <template v-else><h2>{{t('sp.language')}}</h2><div class="support-options"><EquipmentArtButton v-for="language in ['vi','en']" :key="language" :gold="values.language===language" :aria-pressed="values.language===language" @click="values.language=language">{{t('sp.'+language)}}</EquipmentArtButton></div></template>
 <footer><small>{{t('sp.preview')}}</small><EquipmentArtButton @click="values=defaults()">{{t('sp.reset')}}</EquipmentArtButton></footer>
</template>
<template v-else><div class="help-banner"><img :src="'/assets/ui/tien-hiep-2026-10/icons/navigation-'+['home','character','body','equipment','quest'][section]+'-v2.png'" alt=""><h2>{{t('sp.helpTitles.'+section)}}</h2></div><p class="help-copy">{{t('sp.helpText.'+section)}}</p><h3>{{t('sp.tipTitle')}}</h3><ul><li v-for="index in 4" :key="index">{{t('sp.tips.'+(index-1))}}</li></ul></template>
</EquipmentArtCard></div>
</section>
</template>
<style scoped>
.home-support-art{position:absolute;left:24%;top:12.5%;width:74%;height:75%;z-index:20;box-sizing:border-box;padding:14px 24px 20px;background:#f2e4c8 url('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png') center/cover;border:3px double #b28a43;color:#efdfb9;font-family:var(--pc-font-body);}header{position:relative;inset:auto;height:55px;border-bottom:1px solid #b28a4380;}h1{margin:0;font-size:38px;color:#30271b;}.support-columns{display:grid;grid-template-columns:23% minmax(0,1fr);gap:24px;height:calc(100% - 73px);padding-top:18px;}.support-columns>nav{display:flex;flex-direction:column;gap:18px;padding-top:8px;}.support-main{display:flex;flex-direction:column;gap:22px;min-height:0;padding:24px 28px;}h2{font-size:25px;margin:0;border-bottom:1px solid #b28a4360;padding-bottom:12px;}h3{font-size:20px;margin:0;}.range-row{display:grid;grid-template-columns:170px minmax(0,1fr) 48px;gap:20px;align-items:center;font-size:18px;}.range-row input{width:100%;accent-color:#d8ab55;cursor:pointer;}.range-row output{font-size:16px;text-align:right;}.toggle{display:flex;gap:12px;align-items:center;font-size:18px;}.toggle input{width:20px;height:20px;accent-color:#d8ab55;}.support-options{display:flex;gap:14px;}.support-options button{width:140px;height:44px;font-size:17px;}footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:20px;}footer small{font-size:12px;}footer button{width:210px;height:45px;}.help-banner{display:flex;align-items:center;gap:20px;padding:15px;background:linear-gradient(90deg,#18191480,#d3ac4b20);}.help-banner img{width:65px;height:65px;object-fit:contain;}.help-banner h2{border:0;padding:0;}.help-copy{font-size:19px;line-height:1.75;margin:0;}ul{padding-left:24px;margin:0;display:grid;gap:16px;font-size:17px;}li::marker{color:#dcaf55;}
</style>
