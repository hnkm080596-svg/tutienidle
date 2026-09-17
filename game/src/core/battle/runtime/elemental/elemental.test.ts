import { describe, expect, it } from 'vitest'

import type { ElementType } from '../../../element/ElementType'

import type { BuffDefinitionId } from '../../contracts/ids'
import { createElementalStateRegistry } from './ElementalStateRegistryImpl'

// Fixture ids — contract §19 locked baseline, used for shape testing only.
const BASELINE: Record<ElementType, BuffDefinitionId> = {
  wood: 'doc_can',
  fire: 'hoa_an',
  earth: 'tran_an',
  metal: 'liet_thuong',
  water: 'han_tuc',
}

const ALL_ELEMENTS: readonly ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']

describe('createElementalStateRegistry', () => {
  it('maps every element to its definitionId', () => {
    const registry = createElementalStateRegistry(BASELINE)

    for (const element of ALL_ELEMENTS) {
      expect(registry.getDefinitionId(element)).toBe(BASELINE[element])
    }
  })

  it('getElement round-trips through getDefinitionId', () => {
    const registry = createElementalStateRegistry(BASELINE)

    for (const element of ALL_ELEMENTS) {
      expect(registry.getElement(registry.getDefinitionId(element))).toBe(element)
    }
  })

  it('getElement returns null for an unmapped definitionId', () => {
    const registry = createElementalStateRegistry(BASELINE)

    expect(registry.getElement('not_a_canonical_buff')).toBeNull()
  })

  it('throws when an element is missing', () => {
    const { water: _omitted, ...missing } = BASELINE

    expect(() => createElementalStateRegistry(missing)).toThrow(/water/)
  })

  it('throws on a duplicate buff definitionId', () => {
    expect(() =>
      createElementalStateRegistry({ ...BASELINE, water: 'hoa_an' }),
    ).toThrow(/duplicate/i)
  })

  it('throws on an extra unknown key', () => {
    const malformed = { ...BASELINE, shadow: 'bong_an' } as Record<
      ElementType,
      BuffDefinitionId
    >

    expect(() => createElementalStateRegistry(malformed)).toThrow(/shadow/)
  })

  it('throws on a non-string definitionId', () => {
    const malformed = { ...BASELINE, fire: 7 } as unknown as Record<
      ElementType,
      BuffDefinitionId
    >

    expect(() => createElementalStateRegistry(malformed)).toThrow()
  })
})
