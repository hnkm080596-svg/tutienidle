import { describe, expect, it } from 'vitest'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { makeTestBuffRegistry } from '../battle/turn/testing/TurnRuntimeFixtures'
import { CANONICAL_ELEMENTAL_SEALS, createElementalStateRegistry } from './ElementalStateRegistry'
import { validateCanonicalSealBinding } from './CanonicalSealBinding'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { ElementType } from '../element/ElementType'

// Canonical-seals S1 (plan sec.7.2): the seal<->element binding check is
// the composition-time fail-fast for malformed canonical content.

function canonicalSeal(id: string, element: ElementType): BuffDefinition {
  return {
    id: id as BuffDefinitionId,
    element,
    name: id,
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    dispellable: true,
  }
}

function canonicalRegistry(overrides: Partial<Record<ElementType, Partial<BuffDefinition>>> = {}) {
  const defs = (Object.keys(CANONICAL_ELEMENTAL_SEALS) as readonly ElementType[]).map(
    (element) => ({ ...canonicalSeal(CANONICAL_ELEMENTAL_SEALS[element], element), ...overrides[element] }),
  )
  return makeTestBuffRegistry(defs)
}

describe('validateCanonicalSealBinding', () => {
  it('accepts the production registry against the canonical map', () => {
    const elements = createElementalStateRegistry(CANONICAL_ELEMENTAL_SEALS)
    expect(() => validateCanonicalSealBinding(elements, BUFF_REGISTRY)).not.toThrow()
  })

  it('rejects a non-canonical element mapping', () => {
    const elements = createElementalStateRegistry({
      ...CANONICAL_ELEMENTAL_SEALS,
      fire: 'other_burn' as BuffDefinitionId,
    })
    expect(() => validateCanonicalSealBinding(elements, canonicalRegistry())).toThrow(
      /element 'fire' maps to 'other_burn'/,
    )
  })

  it('rejects an unregistered seal def', () => {
    const elements = createElementalStateRegistry(CANONICAL_ELEMENTAL_SEALS)
    const registry = makeTestBuffRegistry([
      canonicalSeal('han_tuc', 'water'),
      canonicalSeal('doc_can', 'wood'),
      canonicalSeal('liet_thuong', 'metal'),
      canonicalSeal('tran_an', 'earth'),
    ])
    expect(() => validateCanonicalSealBinding(elements, registry)).toThrow(
      /canonical seal 'hoa_an' is not registered/,
    )
  })

  it('rejects a def.element that disagrees with its binding', () => {
    const elements = createElementalStateRegistry(CANONICAL_ELEMENTAL_SEALS)
    const registry = canonicalRegistry({ fire: { element: 'water' } })
    expect(() => validateCanonicalSealBinding(elements, registry)).toThrow(
      /seal 'hoa_an' declares element 'water', expected 'fire'/,
    )
  })

  it('rejects non-canonical seal shape (kind / scope / maxStacks / resistance)', () => {
    const elements = createElementalStateRegistry(CANONICAL_ELEMENTAL_SEALS)
    expect(() =>
      validateCanonicalSealBinding(elements, canonicalRegistry({ wood: { kind: 'debuff' } })),
    ).toThrow(/kind 'debuff'/)
    expect(() =>
      validateCanonicalSealBinding(
        elements,
        canonicalRegistry({ metal: { instanceScope: 'per_target' } }),
      ),
    ).toThrow(/instanceScope 'per_target'/)
    expect(() =>
      validateCanonicalSealBinding(
        elements,
        canonicalRegistry({
          earth: { stacking: { maxStacks: 3, onReapplyStacks: 'add', onReapplyDuration: 'refresh' } },
        }),
      ),
    ).toThrow(/maxStacks '3'/)
    expect(() =>
      validateCanonicalSealBinding(
        elements,
        canonicalRegistry({ water: { application: { resistance: 'none' as never } } }),
      ),
    ).toThrow(/resistance 'none'/)
  })
})
