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
import type { StackExpr } from './StackExpr'
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

/** megaplan sec.8.4 -- every referenced damage profile must resolve
    against the SAME catalog the damage authority validates periodic
    defs with (createDamageProfileCatalog). A typo'd profile currently
    only surfaces when the damage op settles; seal it at registry
    construction like the buff-id check above. */
function validateDamageProfiles(
  def: ReactionDefinition,
  damageProfileExists: (profile: string) => boolean,
): void {
  for (const step of def.payoff.steps) {
    if (
      step.kind === 'reaction_damage' &&
      !damageProfileExists(step.damageProfile)
    ) {
      throw new Error(
        `ReactionRegistry: '${def.id}' reaction_damage references unknown damage profile '${step.damageProfile}'`,
      )
    }
  }
}

/** M4 -- a StackExpr 'stacks' reference or a `when` role must be a role
    the relation actually has (sinh: parent/child; khac:
    attacker/defender). Catching it at seal beats a mid-combat throw
    inside emitPayoffOperations (same authority class as the element and
    buff-id checks above). */
function validatePayoffRoles(def: ReactionDefinition): void {
  const legal =
    def.relation === 'sinh'
      ? new Set(['parent', 'child'])
      : new Set(['attacker', 'defender'])

  const checkExpr = (expr: StackExpr, stepKind: string): void => {
    switch (expr.op) {
      case 'stacks':
        if (!legal.has(expr.role)) {
          throw new Error(
            `ReactionRegistry: '${def.id}' step '${stepKind}' references role '${expr.role}' which relation '${def.relation}' does not have`,
          )
        }
        return
      case 'add':
      case 'mul':
      case 'min':
      case 'max':
        if (expr.args.length === 0) {
          throw new Error(
            `ReactionRegistry: '${def.id}' step '${stepKind}' has an empty '${expr.op}' expr (min/max of nothing is degenerate)`,
          )
        }
        for (const arg of expr.args) checkExpr(arg, stepKind)
        return
      case 'ceil_half':
      case 'floor_half':
        checkExpr(expr.arg, stepKind)
        return
      case 'const':
        return
    }
  }

  const maybeExpr = (expr: StackExpr | undefined, stepKind: string): void => {
    if (expr !== undefined) checkExpr(expr, stepKind)
  }

  // Step kinds bound to a specific role must match the relation:
  // child-* steps are sinh-only (khac has no child participant) and
  // reaction_damage reads the attacker role (khac-only). Other kinds
  // are relation-agnostic.
  const requireRole: Partial<
    Record<ReactionDefinition['payoff']['steps'][number]['kind'], 'child' | 'attacker'>
  > = {
    add_child_stacks: 'child',
    add_child_modifier: 'child',
    extend_child_duration: 'child',
    reaction_damage: 'attacker',
  }

  for (const step of def.payoff.steps) {
    const role = requireRole[step.kind]
    if (role !== undefined && !legal.has(role)) {
      throw new Error(
        `ReactionRegistry: '${def.id}' step '${step.kind}' requires role '${role}' which relation '${def.relation}' does not have`,
      )
    }

    switch (step.kind) {
      case 'add_child_stacks':
        maybeExpr(step.stacks, step.kind)
        break
      case 'add_child_modifier':
        maybeExpr(step.value, step.kind)
        break
      case 'extend_child_duration':
        maybeExpr(step.turns, step.kind)
        break
      case 'reaction_damage':
        maybeExpr(step.coefficient, step.kind)
        break
      case 'apply_status':
        maybeExpr(step.stacks, step.kind)
        maybeExpr(step.durationOverride, step.kind)
        if (step.modifier !== undefined) maybeExpr(step.modifier.value, step.kind)
        if (step.when !== undefined && !legal.has(step.when.role)) {
          throw new Error(
            `ReactionRegistry: '${def.id}' step '${step.kind}' when-role '${step.when.role}' is not a '${def.relation}' participant`,
          )
        }
        break
      case 'push_gauge':
        maybeExpr(step.fractionOfMax, step.kind)
        break
      case 'heal_from_damage':
        maybeExpr(step.fraction, step.kind)
        break
    }
  }

  // heal_from_damage materializes from the preceding damage op's
  // result -- a def without an earlier reaction_damage step can never
  // emit it (the emitter throws; catch it at seal instead).
  let seenDamage = false
  for (const step of def.payoff.steps) {
    if (step.kind === 'reaction_damage') seenDamage = true
    if (step.kind === 'heal_from_damage' && !seenDamage) {
      throw new Error(
        `ReactionRegistry: '${def.id}' heal_from_damage requires a preceding reaction_damage step`,
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
  damageProfileExists: (profile: string) => boolean,
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
    validateDamageProfiles(def, damageProfileExists)
    validatePayoffRoles(def)

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
    damageProfileExists: (profile: string) => boolean,
  ) {
    validateReactionDefinitions(defs, elements, buffExists, damageProfileExists)
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
