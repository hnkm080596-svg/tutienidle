import { describe, expect, it } from 'vitest'
import { MaterialBag } from './MaterialBag'
import type { Material } from './Material'
const wood: Material = { id: 'wood', name: 'Wood', category: 'other', sourceType: 'monster', stackLimit: 10 }
describe('material grant receipts', () => {
  it('reopens a compact frontier and rejects retired arbitrary origins without a fresh credit', () => {
    const bag = new MaterialBag()
    const grant = bag.credit(wood, 3)
    const reopened = new MaterialBag()
    reopened.restoreReceiptState(bag.receiptSnapshot())
    reopened.restoreStacks(bag.getAll())
    expect(() => reopened.credit(wood, 3, grant.sourceId)).toThrow('Retired')
    expect(() => reopened.credit(wood, 4, grant.sourceId)).toThrow('Retired')
    expect(reopened.getAmount('wood')).toBe(3)
    reopened.credit(wood, 2)
    expect(reopened.getAmount('wood')).toBe(5)
  })
  it('never grants a retired full-overflow event after capacity is freed', () => {
    const bag = new MaterialBag()
    bag.add(wood, 10)
    const full = bag.credit(wood, 2)
    expect(full.receipt).toBeNull()
    bag.remove('wood', 5)
    expect(() => bag.credit(wood, 2, full.sourceId)).toThrow('Retired')
    expect(bag.getAmount('wood')).toBe(5)
  })
  it('rejects malformed/foreign state before mutation and detaches the pending outbox', () => {
    const bag = new MaterialBag()
    bag.setDeliveryConsumer(() => { throw new Error('pending') })
    bag.credit(wood, 2)
    const snapshot = bag.receiptSnapshot()
    expect(() => bag.restoreReceiptState({ ...snapshot, sequence: 0 })).toThrow()
    const other = new MaterialBag()
    other.credit(wood, 1)
    expect(() => bag.restoreReceiptState(other.receiptSnapshot())).toThrow()
    snapshot.pending.length = 0
    expect(bag.receiptSnapshot().pending).toHaveLength(1)
  })
})
