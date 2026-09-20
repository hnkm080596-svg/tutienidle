// CanonicalSealBinding.ts -- canonical-seals/reaction megaplan S1 (plan
// sec.7.2). BuffSystem derives a committed application's event element
// from the ElementalStateRegistry, not def.element -- so registry-vs-def
// agreement needs its own fail-fast check at composition. A malformed
// canonical seal prevents battle mint entirely: no half-configured
// reaction graph.

import type { ElementalStateRegistry } from '../battle/contracts/elemental'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import { CANONICAL_ELEMENTAL_SEALS } from '../battle/runtime/elemental/ElementalStateRegistryImpl'
import type { ElementType } from '../element/ElementType'

export interface CanonicalSealBuffLookup {
  has(id: BuffDefinitionId): boolean
  tryGet(id: BuffDefinitionId): { element?: ElementType; kind?: string; instanceScope?: string; stacking?: { maxStacks?: number }; application?: { resistance?: string } } | undefined
}

const EXPECTED_SHAPE = {
  kind: 'ailment',
  instanceScope: 'per_source',
  maxStacks: 5,
  resistance: 'ailment',
} as const

/**
 * validateCanonicalSealBinding -- assert each canonical element maps to
 * its seal def AND that the registered def carries the canonical seal
 * shape. Throws on the first malformed binding (composition-time fail).
 */
export function validateCanonicalSealBinding(
  elements: ElementalStateRegistry,
  buffRegistry: CanonicalSealBuffLookup,
): void {
  for (const element of Object.keys(CANONICAL_ELEMENTAL_SEALS) as readonly ElementType[]) {
    const expectedId = CANONICAL_ELEMENTAL_SEALS[element]
    const mappedId = elements.getDefinitionId(element)
    if (mappedId !== expectedId) {
      throw new Error(
        `CanonicalSealBinding: element '${element}' maps to '${mappedId}', expected canonical seal '${expectedId}'`,
      )
    }
    if (elements.getElement(expectedId) !== element) {
      throw new Error(
        `CanonicalSealBinding: seal '${expectedId}' does not round-trip to element '${element}'`,
      )
    }
    const definition = buffRegistry.tryGet(mappedId)
    if (definition === undefined) {
      throw new Error(
        `CanonicalSealBinding: canonical seal '${mappedId}' is not registered`,
      )
    }
    if (definition.element !== element) {
      throw new Error(
        `CanonicalSealBinding: seal '${mappedId}' declares element '${String(definition.element)}', expected '${element}'`,
      )
    }
    if (definition.kind !== EXPECTED_SHAPE.kind) {
      throw new Error(
        `CanonicalSealBinding: seal '${mappedId}' kind '${String(definition.kind)}', expected '${EXPECTED_SHAPE.kind}'`,
      )
    }
    if (definition.instanceScope !== EXPECTED_SHAPE.instanceScope) {
      throw new Error(
        `CanonicalSealBinding: seal '${mappedId}' instanceScope '${String(definition.instanceScope)}', expected '${EXPECTED_SHAPE.instanceScope}'`,
      )
    }
    if (definition.stacking?.maxStacks !== EXPECTED_SHAPE.maxStacks) {
      throw new Error(
        `CanonicalSealBinding: seal '${mappedId}' maxStacks '${String(definition.stacking?.maxStacks)}', expected ${EXPECTED_SHAPE.maxStacks}`,
      )
    }
    if (definition.application?.resistance !== EXPECTED_SHAPE.resistance) {
      throw new Error(
        `CanonicalSealBinding: seal '${mappedId}' resistance '${String(definition.application?.resistance)}', expected '${EXPECTED_SHAPE.resistance}'`,
      )
    }
  }
}
