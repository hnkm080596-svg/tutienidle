// contracts/selectors.ts -- BuffInstanceSelector discriminated union.
// NO optional soup: each member carries exactly the fields its resolution
// strategy needs.

import type { BuffDefinitionId, BuffInstanceId, CombatEntityId } from './ids'

export type BuffInstanceSelector =
  | { kind: 'instance'; instanceId: BuffInstanceId }
  | {
      kind: 'identity'
      definitionId: BuffDefinitionId
      sourceId: CombatEntityId
      targetId: CombatEntityId
    }
  // 'target_definition' resolves the TARGET's instance of a def regardless
  // of source (used by consume-for-damage 'any' scope and per_target
  // instanceScope defs). v7.2 rename -- was 'holder_definition'/'holderId';
  // `targetId` is the canonical persistent subject (no separate holder
  // identity).
  | { kind: 'target_definition'; targetId: CombatEntityId; definitionId: BuffDefinitionId }

function requireStringField(value: unknown, field: string, kind: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `BuffInstanceSelector kind '${kind}' requires a non-empty string '${field}'`,
    )
  }
}

/** Runtime guard for untrusted input -- validates the BuffInstanceSelector
    discriminated union. Structural failure: throws (contract sec.50), never
    a silent pass. */
export function assertValidSelector(
  selector: unknown,
): asserts selector is BuffInstanceSelector {
  if (typeof selector !== 'object' || selector === null) {
    throw new Error('BuffInstanceSelector must be a non-null object')
  }
  const kind = (selector as { kind?: unknown }).kind
  switch (kind) {
    case 'instance': {
      const s = selector as { instanceId?: unknown }
      requireStringField(s.instanceId, 'instanceId', kind)
      return
    }
    case 'identity': {
      const s = selector as {
        definitionId?: unknown
        sourceId?: unknown
        targetId?: unknown
      }
      requireStringField(s.definitionId, 'definitionId', kind)
      requireStringField(s.sourceId, 'sourceId', kind)
      requireStringField(s.targetId, 'targetId', kind)
      return
    }
    case 'target_definition': {
      const s = selector as { targetId?: unknown; definitionId?: unknown }
      requireStringField(s.targetId, 'targetId', kind)
      requireStringField(s.definitionId, 'definitionId', kind)
      return
    }
    default:
      throw new Error(
        `BuffInstanceSelector: unknown kind '${String(kind)}'`,
      )
  }
}
