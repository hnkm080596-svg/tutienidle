// @vitest-environment jsdom
import {expect,it} from 'vitest'
import {createApp,nextTick} from 'vue'
import {createI18n} from 'vue-i18n'
import ForgeBatchBag from './ForgeBatchBag.vue'
import {equipmentMessages} from '@/ui-preview/equipmentMessages'
import type {EquipmentDisplay} from './equipmentUi'
it('selects all displayed equipment by identity without consuming it or mounting a large card',async()=>{
 const items:readonly EquipmentDisplay[]=Object.freeze([{id:'one',name:'One',slot:'Sword',icon:'/sample.png',grade:'Rare',level:'1',enhancement:'+1',tone:'#abc',description:'',stats:[]},{id:'two',name:'Two',slot:'Ring',icon:'/sample.png',grade:'Rare',level:'1',enhancement:'+1',tone:'#abc',description:'',stats:[]}])
 const requests:unknown[]=[]
 const container=document.createElement('div')
 const app=createApp(ForgeBatchBag,{mode:'dissolve',items,onSubmit:(request:unknown)=>requests.push(request)})
 app.use(createI18n({legacy:false,locale:'vi',messages:equipmentMessages})).mount(container)
 try{
  container.querySelector<HTMLButtonElement>('header button')!.click();await nextTick()
  expect(container.querySelectorAll('[aria-pressed=true]')).toHaveLength(2)
  container.querySelector<HTMLButtonElement>('.submit')!.click()
  expect(requests).toEqual([{mode:'dissolve',itemIds:['one','two']}])
  expect(items).toHaveLength(2);expect(container.querySelector('.focus-item')).toBeNull()
 }finally{app.unmount()}
})
