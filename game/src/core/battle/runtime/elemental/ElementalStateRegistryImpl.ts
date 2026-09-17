import type { ElementType } from '../../../element/ElementType'

import type { ElementalStateRegistry } from '../../contracts/elemental'
import type { BuffDefinitionId } from '../../contracts/ids'

// All five Ngũ Hành members must be mapped (contract §19). Duplicated
// here rather than imported from core/element/ElementLabels so runtime/
// keeps its dependency surface to contracts/ + the ElementType type.
// `as const` preserves the literal member union so the exhaustiveness
// guard below can prove completeness at compile time.
const REQUIRED_ELEMENTS = [
  'wood',
  'fire',
  'earth',
  'metal',
  'water',
] as const satisfies readonly ElementType[]

// Compile-time exhaustiveness guard (review M1 fix-r1): if an ElementType
// member is ever missing from REQUIRED_ELEMENTS, Exclude<...> is non-never
// and the `true` assignment fails the type-check.
type _AllElementsMapped =
  Exclude<ElementType, (typeof REQUIRED_ELEMENTS)[number]> extends never
    ? true
    : never
const _allElementsMappedCheck: _AllElementsMapped = true
void _allElementsMappedCheck

/**
 * createElementalStateRegistry — validating factory for the shared
 * element <-> buff-definitionId authority (contract §19).
 *
 * Input is treated as untrusted: a malformed mapping is a STRUCTURAL
 * failure (contract §50) — the factory throws instead of returning a
 * registry that would silently desync reaction state.
 *
 * Validates:
 * - every ElementType member is mapped to a non-empty definitionId
 * - definitionIds are distinct (bijection — otherwise getElement cannot
 *   round-trip)
 * - no unknown extra keys
 */
export function createElementalStateRegistry(
  mapping: Readonly<Partial<Record<ElementType, BuffDefinitionId>>>,
): ElementalStateRegistry {
  if (typeof mapping !== 'object' || mapping === null) {
    throw new Error('ElementalStateRegistry: mapping must be a non-null object')
  }

  for (const key of Object.keys(mapping)) {
    if (!REQUIRED_ELEMENTS.includes(key as ElementType)) {
      throw new Error(`ElementalStateRegistry: unknown element key '${key}'`)
    }
  }

  const byElement = new Map<ElementType, BuffDefinitionId>()
  const byDefinitionId = new Map<BuffDefinitionId, ElementType>()

  for (const element of REQUIRED_ELEMENTS) {
    const definitionId = mapping[element]
    if (typeof definitionId !== 'string' || definitionId.length === 0) {
      throw new Error(
        `ElementalStateRegistry: missing or invalid definitionId for element '${element}'`,
      )
    }
    const prior = byDefinitionId.get(definitionId)
    if (prior !== undefined) {
      throw new Error(
        `ElementalStateRegistry: duplicate definitionId '${definitionId}' (elements '${prior}' and '${element}')`,
      )
    }
    byElement.set(element, definitionId)
    byDefinitionId.set(definitionId, element)
  }

  return {
    getDefinitionId(element: ElementType): BuffDefinitionId {
      const definitionId = byElement.get(element)
      if (definitionId === undefined) {
        // Unreachable after validation — kept as a structural guard.
        throw new Error(`ElementalStateRegistry: unmapped element '${element}'`)
      }
      return definitionId
    },
    getElement(definitionId: BuffDefinitionId): ElementType | null {
      return byDefinitionId.get(definitionId) ?? null
    },
  }
}
