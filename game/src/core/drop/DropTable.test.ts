import { describe, expect, it } from 'vitest'
import { assertDropEntryIsAddressable, type DropEntry } from './DropTable'

describe('DropTable - addressability', () => {
  it('accepts an entry that names its item', () => {
    const entry: DropEntry = { kind: 'material', itemId: 'tinh_hoa_pham_the' }

    expect(() => assertDropEntryIsAddressable(entry)).not.toThrow()
  })

  it('accepts equipment_any without an itemId', () => {
    const entry: DropEntry = { kind: 'equipment_any' }

    expect(() => assertDropEntryIsAddressable(entry)).not.toThrow()
  })

  it('rejects any other kind without an itemId', () => {
    const entry: DropEntry = { kind: 'material' }

    expect(() => assertDropEntryIsAddressable(entry)).toThrow(/itemId/)
  })
})
