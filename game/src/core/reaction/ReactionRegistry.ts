// ReactionRegistry.ts -- validating catalog over authored
// ReactionDefinitions (contract sec.82 + megaplan M1 step 1).
//
// Startup validation is STRUCTURAL: a malformed catalog throws rather
// than letting selection/candidates run against a desynced graph.
// Canonical pair coverage is checked against WuxingRelations (the
// codebase's relation authority) -- all 5 sinh + all 5 khac pairs.

import type { ElementType } from '../element/ElementType'
import {
  KHAC_OVERCOMES,
  SINH_CYCLE,
} from '../element/WuxingRelations'
import type { ElementalStateRegistry } from './ElementalStateRegistry'
import type { ReactionDefinition } from './ReactionDefinition'
import type { ReactionId } from './ReactionTypes'

const ELEMENTS = [
  'wood',
  'fire',
  'earth',
  'metal',
  'water',
] as const satisfies readonly ElementType[]

function pairKey(def: ReactionDefinition): string {
  return def.relation === 'sinh'
    ? `sinh:${def.elements.parent}>${def.elements.child}`
    : `khac:${def.elements.attacker}>${def.elements.defender}`
}

/** Canonical pair set derived from the relation authority -- never a
    hand-authored table (drift would desync validation from gameplay). */
function canonicalPairs(): ReadonlySet<string> {
  const pairs = new Set<string>()
  for (const e of ELEMENTS) {
    pairs.add(`sinh:${e}>${SINH_CYCLE[e]}`)
    pairs.add(`khac:${e}>${KHAC_OVERCOMES[e]}`)
  }
  return pairs
}

function validateElements(
  def: ReactionDefinition,
  elements: ElementalStateRegistry,
): void {
  const relation = def.elements
  if (def.relation === 'sinh') {
    if (relation.parent === undefined || relation.child === undefined) {
      throw new Error(
        `ReactionRegistry: sinh '${def.id}' requires parent + child elements`,
      )
    }
    if (relation.attacker !== undefined || relation.defender !== undefined) {
      throw new Error(
        `ReactionRegistry: sinh '${def.id}' must not carry attacker/defender`,
      )
    }
    if (relation.parent === relation.child) {
      throw new Error(`ReactionRegistry: '${def.id}' self-element relation`)
    }
  } else {
    if (relation.attacker === undefined || relation.defender === undefined) {
      throw new Error(
        `ReactionRegistry: khac '${def.id}' requires attacker + defender elements`,
      )
    }
    if (relation.parent !== undefined || relation.child !== undefined) {
      throw new Error(
        `ReactionRegistry: khac '${def.id}' must not carry parent/child`,
      )
    }
    if (relation.attacker === relation.defender) {
      throw new Error(`ReactionRegistry: '${def.id}' self-element relation`)
    }
  }

  // Every relation element must be mapped in the shared elemental
  // registry -- an unmapped element means the reaction references state
  // no canonical seal can produce.
  for (const element of Object.values(relation) as ElementType[]) {
    try {
      elements.getDefinitionId(element)
    } catch {
      throw new Error(
        `ReactionRegistry: '${def.id}' references unmapped element '${element}'`,
      )
    }
  }

  // Relation direction must agree with the canonical cycles -- a def
  // claiming sinh for a khac pair (or a non-pair) is malformed.
  if (def.relation === 'sinh') {
    if (SINH_CYCLE[relation.parent!] !== relation.child) {
      throw new Error(
        `ReactionRegistry: '${def.id}' (${relation.parent}->${relation.child}) is not a canonical sinh pair`,
      )
    }
  } else if (KHAC_OVERCOMES[relation.attacker!] !== relation.defender) {
    throw new Error(
      `ReactionRegistry: '${def.id}' (${relation.attacker}->${relation.defender}) is not a canonical khac pair`,
    )
  }
}

function validatePayoffBuffIds(
  def: ReactionDefinition,
  buffExists: (id: string) => boolean,
): void {
  for (const step of def.payoff.steps) {
    if (step.kind === 'apply_status' && !buffExists(step.definitionId)) {
      throw new Error(
        `ReactionRegistry: '${def.id}' payoff references unknown buff '${step.definitionId}'`,
      )
    }
  }
}

/** validateReactionDefinitions -- full structural pass (megaplan M1
    step 1). Throws on the FIRST malformation found while iterating the
    input order; deterministic because iteration order is input order. */
export function validateReactionDefinitions(
  defs: readonly ReactionDefinition[],
  elements: ElementalStateRegistry,
  buffExists: (id: string) => boolean,
): void {
  const ids = new Set<ReactionId>()
  const priorities = new Set<number>()
  const pairs = new Map<string, ReactionId>()

  for (const def of defs) {
    if (ids.has(def.id)) {
      throw new Error(`ReactionRegistry: duplicate reaction id '${def.id}'`)
    }
    ids.add(def.id)

    if (priorities.has(def.selectionTiePriority)) {
      throw new Error(
        `ReactionRegistry: duplicate selectionTiePriority ${def.selectionTiePriority} ('${def.id}')`,
      )
    }
    priorities.add(def.selectionTiePriority)

    validateElements(def, elements)
    validatePayoffBuffIds(def, buffExists)

    const key = pairKey(def)
    const prior = pairs.get(key)
    if (prior !== undefined) {
      throw new Error(
        `ReactionRegistry: pair '${key}' defined by both '${prior}' and '${def.id}'`,
      )
    }
    pairs.set(key, def.id)
  }

  for (const canonical of canonicalPairs()) {
    if (!pairs.has(canonical)) {
      throw new Error(
        `ReactionRegistry: canonical pair '${canonical}' has no definition`,
      )
    }
  }
}

export class ReactionRegistry {
  private readonly byId = new Map<ReactionId, ReactionDefinition>()
  private readonly ordered: ReactionDefinition[] = []

  constructor(
    defs: readonly ReactionDefinition[],
    elements: ElementalStateRegistry,
    buffExists: (id: string) => boolean,
  ) {
    validateReactionDefinitions(defs, elements, buffExists)
    for (const def of defs) {
      this.byId.set(def.id, def)
      this.ordered.push(def)
    }
  }

  get(id: ReactionId): ReactionDefinition {
    const def = this.byId.get(id)
    if (def === undefined) {
      throw new Error(`ReactionRegistry: unknown reaction id '${id}'`)
    }
    return def
  }

  /** Catalog order = authored order (candidate scan order; selection
      itself never depends on it -- weight + khac + tiePriority decide). */
  all(): readonly ReactionDefinition[] {
    return this.ordered
  }
}
