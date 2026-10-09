<script setup lang="ts">
import {computed,shallowRef,watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {resolveAssetUrl} from '@/presentation/assets/AssetBaseUrl'
import SlotView from '@/components/common/SlotView.vue'
import type {EquipmentDisplay} from './equipmentUi'
const props=defineProps<{mode:string;items:readonly EquipmentDisplay[]}>()
const emit=defineEmits<{submit:[request:{mode:string;itemIds:readonly string[]}]}>()
const {t}=useI18n()
const selected=shallowRef<readonly string[]>([])
watch(()=>props.mode,()=>{selected.value=[]})
const selectedIds=computed(()=>selected.value.filter(id=>props.items.some(item=>item.id===id)))
function toggle(id:string){selected.value=selected.value.includes(id)?selected.value.filter(value=>value!==id):[...selected.value,id]}
function selectAll(){selected.value=selectedIds.value.length===props.items.length?[]:props.items.map(item=>item.id)}
</script>
<template><section class="batch-bag"><header><h3>{{t('bag')}}</h3><button @click="selectAll">{{t('forge.selectAll')}}</button><span>{{t('forge.selected',{n:selectedIds.length})}}</span></header><div class="batch-grid"><div v-for="item in items" :key="item.id" class="batch-slot" :aria-pressed="selectedIds.includes(item.id)" @click="toggle(item.id)"><SlotView variant="equipment" :item="item" :icon="item.icon" :label="item.name" :accessible-label="item.name" :state="{interaction:selectedIds.includes(item.id)?'selected':'idle'}"/><span class="level">{{item.enhancement}}</span><span v-if="selectedIds.includes(item.id)" class="check" aria-hidden="true">✓</span></div></div><div class="batch-bottom"><div><h4>{{t('forge.output')}}</h4><p class="output"><img :src="resolveAssetUrl('/assets/materials/linh_khoang.png')" alt=""><span>{{t('items.ore')}} · {{t('forge.sampleResult')}}</span></p><p class="warning">{{t('forge.destructiveHint')}}</p></div><button class="submit" @click="emit('submit',{mode,itemIds:selectedIds})">{{t(`forge.${mode}`)}}</button></div></section></template>
<style scoped>
.batch-bag{height:415px;display:flex;flex-direction:column;gap:12px;font-family:var(--font-display,Georgia,serif);color:#4d3821}.batch-bag header{display:flex;align-items:center;gap:12px;min-height:27px}.batch-bag h3{font-size:17px;margin:0;margin-right:auto}.batch-bag header button{border:1px solid #977644;background:#dbc38744;color:#68481f;padding:4px 10px;cursor:pointer;font:12px var(--font-display,Georgia,serif)}header span{font-size:12px;color:#77613c}.batch-grid{display:grid;grid-template-columns:repeat(7,74px);grid-auto-rows:74px;gap:10px;height:252px;overflow:auto;flex-shrink:0;padding:3px;scrollbar-width:thin}.batch-slot{position:relative;width:74px;height:74px;cursor:pointer}.level{position:absolute;right:4px;bottom:3px;color:#f6df9d;font-size:11px;text-shadow:0 1px 3px #000;pointer-events:none}.check{position:absolute;top:3px;right:3px;background:#d5b16a;color:#173a25;padding:0 3px;font-size:13px;pointer-events:none}.batch-slot[aria-pressed=true]{filter:brightness(1.15)}.batch-bottom{display:flex;align-items:flex-end;gap:13px;border-top:1px solid #9c7f4466;padding-top:10px}.batch-bottom>div{flex:1}.batch-bottom h4{margin:0;font-size:14px}.output{display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0}.output img{width:27px;height:27px;object-fit:contain}.warning{font-size:11px;line-height:1.5;color:#924531;margin:0}.submit{flex-shrink:0;background:linear-gradient(#824a34,#48271e);color:#f6dcaa;border:1px solid #a8874b;padding:10px 19px;font:700 16px var(--font-display,Georgia,serif);cursor:pointer}button:hover{filter:brightness(1.12)}button:focus-visible{outline:2px solid #ab7933;outline-offset:3px}
</style>
