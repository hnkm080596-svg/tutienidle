// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import InventoryTooltipBody from './InventoryTooltipBody.vue'
import type { GradedItemTooltipContent } from '@/composables/useTooltip'

const cleanups:Array<()=>void>=[]
afterEach(()=>cleanups.splice(0).forEach(cleanup=>cleanup()))
function mount(content:GradedItemTooltipContent) {
  const host=document.createElement('div')
  document.body.append(host)
  const app=createApp({render:()=>h(InventoryTooltipBody,{content})})
  app.mount(host)
  cleanups.push(()=>{app.unmount();host.remove()})
  return host
}
describe('inventory tooltip purpose-specific presentation',()=>{
  it('materials show purpose before metadata and retain owned quantity',()=>{
    const host=mount({kind:'material',name:'Timber',description:'Crafting material',ownedCount:12,sections:[{label:'Metadata',rows:[{label:'Age',value:'100 years'}]}]})
    const purpose=host.querySelector('.inventory-tooltip__purpose')!
    const metadata=host.querySelector('.inventory-tooltip__section')!
    expect(purpose.compareDocumentPosition(metadata)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(host.textContent).toContain('100 years')
    expect(host.querySelector('.inventory-tooltip__owned')?.textContent).toContain('12')
    expect(host.querySelector('.slot-view')?.tagName).toBe('SPAN')
  })
  it('pills prioritize effects and show the use instruction once',()=>{
    const host=mount({kind:'pill',name:'Pill',description:'Pill description',sections:[{label:'Effects',rows:[{label:'HP',value:'+20'}]},{label:'Confirm consumption',rows:[]}]})
    expect(host.querySelector('.inventory-tooltip__purpose')).toBeNull()
    expect(host.querySelector('.inventory-tooltip__row')?.textContent).toContain('+20')
    expect(host.querySelectorAll('.inventory-tooltip__hint')).toHaveLength(1)
    expect(host.querySelector('.inventory-tooltip__hint')?.textContent).toBe('Confirm consumption')
    expect(host.querySelector('.inventory-tooltip__owned')).toBeNull()
  })
})
