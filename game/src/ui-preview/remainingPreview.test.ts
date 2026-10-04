// @vitest-environment jsdom
import {expect,it} from 'vitest'
import {createApp,nextTick,type Component} from 'vue'
import {createI18n} from 'vue-i18n'
import {remainingMessages} from './remainingMessages'
import {inventoryFixtures,questFixtures} from './finalPreviewFixtures'
import InventoryFidelityScene from '@/components/scenes/inventory/fidelity/InventoryFidelityScene.vue'
import QuestFidelityScene from '@/components/scenes/quest/fidelity/QuestFidelityScene.vue'
import SettingsFidelitySection from '@/components/scenes/settings/fidelity/SettingsFidelitySection.vue'
import DefeatFidelityScene from '@/components/scenes/defeat/fidelity/DefeatFidelityScene.vue'

function mount(component:Component,props:Record<string,unknown>){
 const container=document.createElement('div')
 const app=createApp(component,props)
 app.use(createI18n({legacy:false,locale:'vi',messages:remainingMessages})).mount(container)
 return {container,close:()=>app.unmount()}
}

it('inventory emits item identity, filter and search without consuming displayed items',()=>{
 const items=Object.freeze(inventoryFixtures(key=>key).map(item=>Object.freeze(item)))
 const events:unknown[]=[]
 const view=mount(InventoryFidelityScene,{items,selected:items[0],filter:'all',query:'',navigation:[],notice:'',onSelect:(id:string)=>events.push(id),onUse:(id:string)=>events.push(id),onQuery:(query:string)=>events.push(query)})
 try {
  view.container.querySelector<HTMLButtonElement>('.item-grid button')!.click()
  view.container.querySelector<HTMLButtonElement>('.item-detail button')!.click()
  const input=view.container.querySelector<HTMLInputElement>('input')!
  input.value='sample';input.dispatchEvent(new Event('input'))
  expect(events).toEqual(['item-0','item-0','sample'])
  expect(items[0]?.amount).toBe('12')
 }finally{view.close()}
})

it('quest requests a claim by identity without changing reward or completion state',()=>{
 const quests=questFixtures(key=>key),quest=Object.freeze(quests[1]!)
 const events:string[]=[]
 const view=mount(QuestFidelityScene,{quests,selected:quest,filter:'all',rewards:[],navigation:[],notice:'',onAction:(id:string)=>events.push(id)})
 try{view.container.querySelector<HTMLButtonElement>('.action')!.click();expect(events).toEqual(['herb']);expect(quest.status).toBe('ready')}finally{view.close()}
})

it('settings emits typed toggle and slider values without changing input props',async()=>{
 const controls=Object.freeze([{id:'master',label:'Volume',kind:'range',value:80},{id:'musicOn',label:'Music',kind:'toggle',value:true}])
 const events:unknown[]=[]
 const view=mount(SettingsFidelitySection,{title:'Audio',controls,onUpdate:(id:string,value:unknown)=>events.push([id,value])})
 try{
  view.container.querySelector<HTMLButtonElement>('[role=switch]')!.click()
  const slider=view.container.querySelector<HTMLInputElement>('input[type=range]')!;slider.value='35';slider.dispatchEvent(new Event('input'));await nextTick()
  expect(events).toEqual([['musicOn',false],['master',35]])
  expect(controls[1]?.value).toBe(true)
 }finally{view.close()}
})

it('defeat supports empty rewards and requests retry/home without granting items',()=>{
 const requests:string[]=[]
 const view=mount(DefeatFidelityScene,{stage:'Stage',reason:'Reason',rewards:[],notice:'',onRetry:()=>requests.push('retry'),onHome:()=>requests.push('home')})
 try{view.container.querySelector<HTMLButtonElement>('.retry')!.click();view.container.querySelector<HTMLButtonElement>('.home')!.click();expect(requests).toEqual(['retry','home']);expect(view.container.textContent).toContain('Không có vật phẩm nhận thêm.')}finally{view.close()}
})
