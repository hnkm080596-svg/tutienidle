// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import viMessages from '@/locales/vi.json'
import type { ArchitectureBuildingModel } from '@/core/game/ArchitectureReadModel'
import ArchitectureBuildingCard from './ArchitectureBuildingCard.vue'

const base: ArchitectureBuildingModel = {
  id:'pill_room', instanceId:'room', name:'Room', description:'', level:1, maxLevel:9,
  artOnly:false, maxed:false, canUpgrade:true, reason:null, requiredRealmId:null,
  currentEffects:[{key:'queueSlots',value:3,unit:'count'}],
  nextEffects:[{key:'queueSlots',value:6,unit:'count'}], costs:[],
}
const cleanups: Array<() => void> = []
afterEach(()=>{cleanups.splice(0).forEach(cleanup=>cleanup())})
function mount(canUpgrade=true) {
  const host=document.createElement('div')
  document.body.append(host)
  const model=ref({...base,canUpgrade})
  const upgrade=vi.fn()
  const app=createApp({render:()=>h(ArchitectureBuildingCard,{model:model.value,artUrl:'',onUpgrade:upgrade})})
  app.use(createI18n({legacy:false,locale:'vi',messages:{vi:viMessages}}))
  app.mount(host)
  cleanups.push(()=>{app.unmount();host.remove()})
  return {host,model,upgrade,button:host.querySelector('button')!}
}
describe('architecture upgrade preview',()=>{
  it('shows next effects only while hovering an eligible upgrade',async()=>{
    const {host,button,upgrade}=mount()
    expect(host.querySelector('.is-preview')).toBeNull()
    button.dispatchEvent(new Event('mouseenter'))
    await nextTick()
    expect(host.querySelector('.is-preview')).not.toBeNull()
    button.click()
    expect(upgrade).toHaveBeenCalledOnce()
    button.dispatchEvent(new Event('mouseleave'))
    await nextTick()
    expect(host.querySelector('.is-preview')).toBeNull()
  })
  it('does not preview or dispatch a disabled upgrade',async()=>{
    const {host,button,upgrade}=mount(false)
    button.dispatchEvent(new Event('mouseenter'))
    await nextTick()
    button.click()
    expect(host.querySelector('.is-preview')).toBeNull()
    expect(upgrade).not.toHaveBeenCalled()
  })
  it('invalidates a hover preview when eligibility changes',async()=>{
    const {host,button,model}=mount()
    button.dispatchEvent(new Event('mouseenter'))
    await nextTick()
    model.value={...model.value,canUpgrade:false}
    await nextTick()
    expect(host.querySelector('.is-preview')).toBeNull()
  })
})
