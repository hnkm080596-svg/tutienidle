// ElementalStateRegistry.test.ts -- megaplan M1: the barrel re-exports
// the CONTRACT registry (interface + validating factory from
// runtime/elemental). Malformation coverage lives in
// runtime/elemental/elemental.test.ts (contract foundation) -- this file
// pins the reaction-local import site + the fixture mapping round-trip.

import { describe, expect, it } from 'vitest'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import {
  createElementalStateRegistry,
  type ElementalStateRegistry,
} from './ElementalStateRegistry'
import { TEST_ELEMENT_BUFF_IDS } from './testing/ReactionTestFixtures'

describe('ElementalStateRegistry (reaction import site)', () => {
  it('re-exports the contract validating factory', () => {
    const registry = createElementalStateRegistry(TEST_ELEMENT_BUFF_IDS)
    const typed: ElementalStateRegistry = registry
    expect(typed.getDefinitionId('fire')).toBe('test_seal_fire')
  })

  it('fixture mapping round-trips all 5 elements', () => {
    const registry = createElementalStateRegistry(TEST_ELEMENT_BUFF_IDS)
    for (const [element, defId] of Object.entries(TEST_ELEMENT_BUFF_IDS)) {
      expect(registry.getDefinitionId(element as keyof typeof TEST_ELEMENT_BUFF_IDS)).toBe(defId)
      expect(registry.getElement(defId)).toBe(element)
    }
  })

  it('unknown definitionId yields null element', () => {
    const registry = createElementalStateRegistry(TEST_ELEMENT_BUFF_IDS)
    expect(registry.getElement('test_bleed' as BuffDefinitionId)).toBeNull()
  })

  it('still rejects malformed mappings (missing element / duplicate id)', () => {
    expect(() =>
      createElementalStateRegistry({ ...TEST_ELEMENT_BUFF_IDS, water: undefined }),
    ).toThrow(/water/)
    expect(() =>
      createElementalStateRegistry({
        ...TEST_ELEMENT_BUFF_IDS,
        wood: TEST_ELEMENT_BUFF_IDS.fire,
      }),
    ).toThrow(/duplicate/)
  })
})
