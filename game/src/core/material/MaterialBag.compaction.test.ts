import { describe, expect, it } from 'vitest'
import { MaterialBag } from './MaterialBag'
import type { Material } from './Material'
const material: Material = { id: 'bounded_wood', name: 'Wood', category: 'other', sourceType: 'monster', stackLimit: 100_000 }
describe('bounded material receipt frontier', () => {
  it('keeps acknowledged history constant sized through 100, 2000 and 20000 commits', () => {
    const bag = new MaterialBag(() => 1_000_000)
    bag.setDeliveryConsumer(() => {})
    const sizes: number[] = []
    for (let index = 1; index <= 20_000; index++) {
      bag.credit(material, 1)
      if ([100, 2_000, 20_000].includes(index)) sizes.push(JSON.stringify(bag.receiptSnapshot()).length)
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(30)
    expect(Math.max(...sizes)).toBeLessThan(500)
    expect(bag.receiptSnapshot().pending).toEqual([])
  })
  it('retains failed delivery, blocks a later grant before mutation and resumes after recovery', () => {
    const bag = new MaterialBag(() => 1_000_000)
    let failing = true
    bag.setDeliveryConsumer(() => { if (failing) throw new Error('consumer unavailable') })
    const first = bag.credit(material, 3)
    expect(bag.receiptSnapshot().pending).toHaveLength(1)
    expect(() => bag.credit(material, 2)).toThrow('consumer unavailable')
    expect(bag.getAmount(material.id)).toBe(3)
    failing = false
    bag.flushDeliveries()
    expect(bag.receiptSnapshot().pending).toEqual([])
    expect(() => bag.credit(material, 3, first.sourceId)).toThrow()
    expect(bag.getAmount(material.id)).toBe(3)
    bag.credit(material, 2)
    expect(bag.getAmount(material.id)).toBe(5)
  })
})
