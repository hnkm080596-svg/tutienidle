// @vitest-environment jsdom
import {expect,it} from 'vitest'
import {createApp,nextTick} from 'vue'
import {createI18n} from 'vue-i18n'
import ForgeFidelityScene from './ForgeFidelityScene.vue'
import {forgeMessages} from '@/ui-preview/forgeMessages'
it('exposes five modes and requests operations by item identity without consuming equipment',async()=>{
 const item=Object.freeze({id:'sword',name:'Sword',icon:'/sample.png'})
 const requests:unknown[]=[]
 const container=document.createElement('div')
 const app=createApp(ForgeFidelityScene,{mode:'wash',items:[item],item,onMode:(id:string)=>requests.push(id),onAction:(request:unknown)=>requests.push(request)})
 app.use(createI18n({legacy:false,locale:'vi',messages:forgeMessages})).mount(container)
 try{
  expect(container.querySelectorAll('.forge-tabs button')).toHaveLength(5)
  container.querySelector<HTMLButtonElement>('.lock')!.click();await nextTick()
  expect(container.querySelector('.lock')!.getAttribute('aria-pressed')).toBe('true')
  container.querySelector<HTMLButtonElement>('.submit')!.click()
  expect(requests).toEqual([{mode:'wash',itemId:'sword',kind:'submit'}])
  expect(item.name).toBe('Sword')
 }finally{app.unmount()}
})
