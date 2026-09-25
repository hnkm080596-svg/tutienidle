// skilldef/SkillDefinitionRegistry.ts -- the authored-definition catalog
// + startup validation. Immutable defs (deep-frozen at registration),
// unique ids, cross-reference checks against the buff registry and the
// skill registry itself.
//
// Structural failure = loud (contract sec.50 parity): validation returns
// a fault list for authoring diagnostics; the registry constructor throws
// the aggregate on any fault -- never a silent pass.

import type { BuffDefinitionId, SkillId } from '../battle/contracts/ids'

import type {
  AuthoredBuffSelector,
  AuthoredModifier,
  AuthoredSkillOperation,
  SkillCondition,
  SkillTargetIntent,
} from './AuthoredOperation'
import type { ScalarExpression, SkillValueQuery } from './ScalarExpression'
import type { SkillDefinition } from './SkillDefinition'

// ---------------------------------------------------------------------------
// Faults
// ---------------------------------------------------------------------------

export type SkillDefinitionFaultCode =
  | 'duplicate_id'
  | 'unknown_reference'
  | 'empty_composite_pool'
  | 'missing_empowerment_target'
  | 'active_field_on_passive'
  | 'passive_field_on_active'
  | 'malformed_cleanse_query'
  | 'loop_target_outside_for_each'
  | 'contradictory_damage_policy'
  | 'policy_without_hit'
  | 'runtime_id_field'
  | 'invalid_field_value'
  | 'malformed_expression'
  | 'malformed_condition'

export interface SkillDefinitionFault {
  code: SkillDefinitionFaultCode
  /** JSON-ish path into the definition (e.g. "operations[2].target"). */
  path: string
  message: string
}

/** Cross-reference predicates -- injected so skilldef never imports a
    concrete registry (dependency direction: registries depend on this
    module, not vice versa). */
export interface SkillDefinitionValidationDeps {
  /** buff definition resolvability (BuffRegistry/ElementalStateRegistry
      owner injects this); absent = definitionId refs are not checked. */
  isBuffDefinitionId?(id: BuffDefinitionId): boolean
  /** skill resolvability for compositePool/empowerment/counterSkillId
      refs; the registry supplies itself when omitted. */
  isSkillId?(id: SkillId): boolean
}

const SET_VALUED_TARGET_INTENTS: ReadonlySet<string> = new Set<SkillTargetIntent>([
  'affected_targets',
  'all_enemies',
  'all_allies',
  'allies_except_self',
])

const SKILL_TARGET_INTENTS: ReadonlySet<string> = new Set<SkillTargetIntent>([
  'self',
  'primary_target',
  'affected_targets',
  'all_enemies',
  'allies_except_self',
  'all_allies',
  'attacker',
  'loop_target',
])

const CLEANSE_KINDS: ReadonlySet<string> = new Set(['buff', 'debuff', 'ailment', 'marker'])
const CLEANSE_POLARITIES: ReadonlySet<string> = new Set(['buff', 'debuff'])
const ELEMENT_TYPES: ReadonlySet<string> = new Set(['wood', 'fire', 'earth', 'metal', 'water'])
const REACTION_ELIGIBILITIES: ReadonlySet<string> = new Set(['eligible', 'suppressed'])
const RESOURCE_TYPES: ReadonlySet<string> = new Set(['none', 'mana', 'the'])
const LANDED_SEMANTICS: ReadonlySet<string> = new Set(['default', 'any_damage_landed', 'always'])
const DAMAGE_TYPES: ReadonlySet<string> = new Set(['physical', 'primordial'])
const DAMAGE_COMPONENT_KINDS: ReadonlySet<string> = new Set(['physical', 'primordial', 'element'])
const MODIFIER_CHANNELS: ReadonlySet<string> = new Set([
  'potency',
  'periodic_damage',
  'next_periodic_damage',
  'duration',
  'application_chance',
  'elemental_penetration',
])
const MODIFIER_OPERATIONS: ReadonlySet<string> = new Set(['add', 'multiply', 'set'])
const MODIFIER_REAPPLY: ReadonlySet<string> = new Set(['replace', 'stack', 'max', 'min'])
const MODIFIER_LIFETIME_TYPES: ReadonlySet<string> = new Set([
  'buff_lifetime',
  'uses',
  'holder_turns',
  'source_turns',
  'rounds',
  'battle',
  'explicit',
])
const BUFF_REMOVAL_REASONS: ReadonlySet<string> = new Set([
  'expired',
  'consumed',
  'cleansed',
  'reaction',
  'death',
  'source_death',
  'battle_end',
  'replaced',
  'scripted',
])
const VALUE_QUERIES: ReadonlySet<string> = new Set([
  'buff_stacks',
  'buff_duration',
  'hp_percent',
  'resource_current',
  'resource_max',
  'resource_snapshot',
  'stat_scalar',
  'skill_level',
  'var',
  'cast_outcome',
  'alive_count',
])
const EXPRESSION_OPS: ReadonlySet<string> = new Set([
  'add',
  'multiply',
  'subtract',
  'divide',
  'min',
  'max',
  'clamp',
  'if',
])
const CONDITION_KINDS: ReadonlySet<string> = new Set([
  'stacks_at_least',
  'hp_percent_below',
  'resource_at_least',
  'target_alive',
  'var',
  'crit_landed',
  'any_target_landed',
  'target_hit_landed',
])
const PASSIVE_EVENTS: ReadonlySet<string> = new Set([
  'skill_landed',
  'damage_taken',
  'damage_dealt',
  'ailment_applied',
  'ailment_tick',
  'evade',
  'turn_start',
  'turn_end',
])

/** CON-01 deep-scan guard -- authored definitions may never carry
    runtime-id fields under these key names (anywhere in the tree). */
const RUNTIME_ID_KEYS: ReadonlySet<string> = new Set([
  'targetId',
  'sourceId',
  'instanceId',
  'combatSequence',
])

/** Active-only field names -- a PassiveSkillDefinition carrying any of
    these is an authoring error (the passive schema deliberately does not
    inherit the active surface). */
const ACTIVE_ONLY_FIELDS: readonly string[] = [
  'targetIntent',
  'actionTags',
  'cadence',
  'cost',
  'consumesAllThe',
  'subcasts',
  'variants',
  'landed',
  'grants',
  'counterable',
  'counterSkillId',
  'emblemOnly',
  'theScaling',
  'instances',
]

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateSkillDefinition(
  definition: SkillDefinition,
  deps: SkillDefinitionValidationDeps = {},
): SkillDefinitionFault[] {
  const faults: SkillDefinitionFault[] = []
  const fault = (code: SkillDefinitionFaultCode, path: string, message: string): void => {
    faults.push({ code, path, message })
  }

  validateRuntimeIdGuard(definition, '', fault)

  if (typeof definition.id !== 'string' || definition.id.length === 0) {
    fault('invalid_field_value', 'id', 'id must be a non-empty string')
  }
  if (typeof definition.name !== 'string' || definition.name.length === 0) {
    fault('invalid_field_value', 'name', 'name must be a non-empty string')
  }

  if (definition.kind === 'active') {
    validateActive(definition, deps, fault)
  } else if (definition.kind === 'passive') {
    validatePassive(definition, deps, fault)
  } else {
    fault(
      'invalid_field_value',
      'kind',
      `kind must be 'active' or 'passive', got '${String((definition as { kind?: unknown }).kind)}'`,
    )
  }

  validateSharedFields(definition, deps, fault)
  return faults
}

/** Registry-level checks that need the whole catalog: unique ids +
    cross-definition references. */
export function validateSkillDefinitionSet(
  definitions: readonly SkillDefinition[],
  deps: SkillDefinitionValidationDeps = {},
): SkillDefinitionFault[] {
  const faults: SkillDefinitionFault[] = []
  const seen = new Set<SkillId>()
  const ids = new Set<SkillId>(definitions.map((d) => d.id))

  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      faults.push({
        code: 'duplicate_id',
        path: definition.id,
        message: `duplicate skill definition id '${definition.id}'`,
      })
    }
    seen.add(definition.id)
    faults.push(...validateSkillDefinition(definition, deps))
  }

  const resolveSkillRef = (id: SkillId): boolean =>
    deps.isSkillId !== undefined ? deps.isSkillId(id) : ids.has(id)

  for (const definition of definitions) {
    if (definition.kind !== 'active') continue
    for (const ref of definition.subcasts?.compositePool ?? []) {
      if (!resolveSkillRef(ref)) {
        faults.push({
          code: 'unknown_reference',
          path: `${definition.id}.subcasts.compositePool`,
          message: `compositePool references unknown skill '${ref}'`,
        })
      }
    }
    const empoweredId = definition.variants?.empowerment?.empoweredSkillId
    if (empoweredId !== undefined && !resolveSkillRef(empoweredId)) {
      faults.push({
        code: 'missing_empowerment_target',
        path: `${definition.id}.variants.empowerment.empoweredSkillId`,
        message: `empowerment references unknown skill '${empoweredId}'`,
      })
    }
    if (definition.counterSkillId != null && !resolveSkillRef(definition.counterSkillId)) {
      faults.push({
        code: 'unknown_reference',
        path: `${definition.id}.counterSkillId`,
        message: `counterSkillId references unknown skill '${definition.counterSkillId}'`,
      })
    }
  }
  return faults
}

// ---------------------------------------------------------------------------
// Per-kind validation
// ---------------------------------------------------------------------------

function validateActive(
  definition: Extract<SkillDefinition, { kind: 'active' }>,
  deps: SkillDefinitionValidationDeps,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if ('triggers' in definition) {
    fault('passive_field_on_active', 'triggers', 'active definitions do not carry passive triggers')
  }
  if (!SKILL_TARGET_INTENTS.has(definition.targetIntent)) {
    fault(
      'invalid_field_value',
      'targetIntent',
      `unknown target intent '${String(definition.targetIntent)}'`,
    )
  }

  const cadence = definition.cadence
  if (cadence === undefined || typeof cadence !== 'object') {
    fault('invalid_field_value', 'cadence', 'cadence is required on active definitions')
  } else {
    // Fractional cooldownTurns are legal: the legacy converter copies
    // Skill.cooldown (authored seconds) verbatim into turn units, so
    // adapted definitions carry non-integer cadences (2.5 -> ready on
    // the third turn tick). The decrement semantics are identical.
    if (!Number.isFinite(cadence.cooldownTurns) || cadence.cooldownTurns < 0) {
      fault('invalid_field_value', 'cadence.cooldownTurns', 'cooldownTurns must be a finite number >= 0')
    }
    if (
      cadence.chargeTurns !== undefined &&
      (!Number.isInteger(cadence.chargeTurns) || cadence.chargeTurns <= 0)
    ) {
      fault('invalid_field_value', 'cadence.chargeTurns', 'chargeTurns must be an integer > 0')
    }
  }

  if (definition.cost !== undefined) {
    if (!RESOURCE_TYPES.has(definition.cost.resourceType)) {
      fault(
        'invalid_field_value',
        'cost.resourceType',
        `unknown resource type '${String(definition.cost.resourceType)}'`,
      )
    }
    if (typeof definition.cost.amount !== 'number' || definition.cost.amount < 0) {
      fault('invalid_field_value', 'cost.amount', 'cost.amount must be a number >= 0')
    }
  }

  const subcasts = definition.subcasts
  if (subcasts !== undefined) {
    if (subcasts.count !== undefined && (!Number.isInteger(subcasts.count) || subcasts.count < 0)) {
      fault('invalid_field_value', 'subcasts.count', 'count must be an integer >= 0')
    }
    if (subcasts.multicast !== undefined) {
      const { chance, maxExtraCasts } = subcasts.multicast
      if (typeof chance !== 'number' || chance < 0 || chance > 1) {
        fault('invalid_field_value', 'subcasts.multicast.chance', 'chance must be in [0, 1]')
      }
      if (!Number.isInteger(maxExtraCasts) || maxExtraCasts < 1) {
        fault('invalid_field_value', 'subcasts.multicast.maxExtraCasts', 'maxExtraCasts must be an integer >= 1')
      }
    }
    if (subcasts.compositePool !== undefined) {
      if (subcasts.compositePool.length === 0) {
        fault('empty_composite_pool', 'subcasts.compositePool', 'compositePool must be non-empty when present')
      }
      for (const ref of subcasts.compositePool) {
        if (typeof ref !== 'string' || ref.length === 0) {
          fault('invalid_field_value', 'subcasts.compositePool', 'compositePool entries must be non-empty skill ids')
        }
      }
      if (
        subcasts.compositeCount !== undefined &&
        (!Number.isInteger(subcasts.compositeCount) || subcasts.compositeCount < 1)
      ) {
        fault('invalid_field_value', 'subcasts.compositeCount', 'compositeCount must be an integer >= 1')
      }
    }
  }

  const empowerment = definition.variants?.empowerment
  if (empowerment !== undefined) {
    if (typeof empowerment.theThreshold !== 'number' || empowerment.theThreshold < 0) {
      fault('invalid_field_value', 'variants.empowerment.theThreshold', 'theThreshold must be a number >= 0')
    }
    if (typeof empowerment.empoweredSkillId !== 'string' || empowerment.empoweredSkillId.length === 0) {
      fault('invalid_field_value', 'variants.empowerment.empoweredSkillId', 'empoweredSkillId must be a non-empty skill id')
    }
  }

  if (definition.landed !== undefined && !LANDED_SEMANTICS.has(definition.landed)) {
    fault('invalid_field_value', 'landed', `unknown landed semantics '${String(definition.landed)}'`)
  }

  const instances = definition.instances
  if (instances !== undefined) {
    validateExpression(instances.count, 'instances.count', fault)
    const each = instances.each
    if (each !== undefined) {
      if (each.execute !== undefined) {
        validateExpression(each.execute.hpPercentBelow, 'instances.each.execute.hpPercentBelow', fault)
        if (typeof each.execute.damageMultiplier !== 'number') {
          fault('invalid_field_value', 'instances.each.execute.damageMultiplier', 'damageMultiplier must be a number')
        }
      }
      if (each.critChance !== undefined && (each.critChance < 0 || each.critChance > 1)) {
        fault('invalid_field_value', 'instances.each.critChance', 'critChance must be in [0, 1]')
      }
      if (
        each.momentumPerLandedInstance !== undefined &&
        (typeof each.momentumPerLandedInstance !== 'number' ||
          !Number.isFinite(each.momentumPerLandedInstance) ||
          each.momentumPerLandedInstance < 0)
      ) {
        fault('invalid_field_value', 'instances.each.momentumPerLandedInstance', 'momentumPerLandedInstance must be a finite number >= 0')
      }
      if (each.armorPierce !== undefined) {
        if (each.armorPierce.bypassChance < 0 || each.armorPierce.bypassChance > 1) {
          fault('invalid_field_value', 'instances.each.armorPierce.bypassChance', 'bypassChance must be in [0, 1]')
        }
        if (each.armorPierce.pierceFraction < 0 || each.armorPierce.pierceFraction > 1) {
          fault('invalid_field_value', 'instances.each.armorPierce.pierceFraction', 'pierceFraction must be in [0, 1]')
        }
      }
    }
  }

  // A composite shell (all payload inside subcasts.compositePool) or an
  // emblemOnly marker (never cast -- slot occupant/presentation lane)
  // may carry an empty operations list; every other active def needs
  // >= 1 op.
  if (
    definition.operations.length === 0 &&
    subcasts?.compositePool === undefined &&
    definition.emblemOnly !== true
  ) {
    fault('invalid_field_value', 'operations', 'active definitions need at least one operation (or a compositePool shell)')
  }
  validateOperationList(definition.operations, 'operations', deps, false, fault)
}

function validatePassive(
  definition: Extract<SkillDefinition, { kind: 'passive' }>,
  deps: SkillDefinitionValidationDeps,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  for (const field of ACTIVE_ONLY_FIELDS) {
    if (field in definition) {
      fault('active_field_on_passive', field, `passive definitions do not carry '${field}'`)
    }
  }
  for (const [index, trigger] of definition.triggers.entries()) {
    const path = `triggers[${index}]`
    if (!PASSIVE_EVENTS.has(trigger.event)) {
      fault('invalid_field_value', `${path}.event`, `unknown passive event '${String(trigger.event)}'`)
    }
    if (trigger.cooldown !== undefined && (!Number.isInteger(trigger.cooldown) || trigger.cooldown < 0)) {
      fault('invalid_field_value', `${path}.cooldown`, 'cooldown must be an integer >= 0 (turns)')
    }
    if (trigger.procChance !== undefined && (trigger.procChance < 0 || trigger.procChance > 1)) {
      fault('invalid_field_value', `${path}.procChance`, 'procChance must be in [0, 1]')
    }
    if (trigger.condition !== undefined) {
      validateCondition(trigger.condition, `${path}.condition`, deps, false, fault)
    }
  }
  validateOperationList(definition.operations, 'operations', deps, false, fault)
}

function validateSharedFields(
  definition: SkillDefinition,
  deps: SkillDefinitionValidationDeps,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  for (const entry of definition.adapterUnsupportedMetadata ?? []) {
    if (typeof entry !== 'string' || entry.length === 0) {
      fault('invalid_field_value', 'adapterUnsupportedMetadata', 'entries must be non-empty strings')
    }
  }
  const requirements = 'requirements' in definition ? definition.requirements : undefined
  for (const [index, req] of (requirements ?? []).entries()) {
    const path = `requirements[${index}]`
    switch (req.kind) {
      case 'realm':
        if (typeof req.realmId !== 'string' || req.realmId.length === 0) {
          fault('invalid_field_value', `${path}.realmId`, 'realmId must be a non-empty string')
        }
        break
      case 'path':
      case 'way':
        break
      case 'node':
        if (typeof req.nodeId !== 'string' || req.nodeId.length === 0) {
          fault('invalid_field_value', `${path}.nodeId`, 'nodeId must be a non-empty string')
        }
        break
      case 'skill':
        if (typeof req.skillId !== 'string' || req.skillId.length === 0) {
          fault('invalid_field_value', `${path}.skillId`, 'skillId must be a non-empty string')
        } else if (deps.isSkillId !== undefined && !deps.isSkillId(req.skillId)) {
          fault('unknown_reference', `${path}.skillId`, `requirement references unknown skill '${req.skillId}'`)
        }
        break
      default:
        fault('invalid_field_value', `${path}.kind`, `unknown requirement kind '${String((req as { kind?: unknown }).kind)}'`)
    }
  }
  void deps
}

// ---------------------------------------------------------------------------
// Operation validation (recursive -- if/for_each_target nest op lists)
// ---------------------------------------------------------------------------

function validateOperationList(
  ops: readonly AuthoredSkillOperation[],
  path: string,
  deps: SkillDefinitionValidationDeps,
  insideForEach: boolean,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  for (const [index, op] of ops.entries()) {
    validateOperation(op, `${path}[${index}]`, deps, insideForEach, fault)
  }
}

function validateOperation(
  op: AuthoredSkillOperation,
  path: string,
  deps: SkillDefinitionValidationDeps,
  insideForEach: boolean,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  const requireTarget = (target: SkillTargetIntent | undefined, field = 'target'): void => {
    validateTargetIntent(target, `${path}.${field}`, insideForEach, fault)
  }
  const requireBuffRef = (id: BuffDefinitionId | undefined, field = 'definitionId'): void => {
    validateBuffRef(id, `${path}.${field}`, deps, fault)
  }
  const requireSingleBindingTarget = (
    target: SkillTargetIntent | undefined,
    field: string,
  ): void => {
    validateSingleBindingIntent(target, `${path}.${field}`, insideForEach, fault)
  }

  switch (op.type) {
    case 'deal_damage': {
      requireTarget(op.target)
      if (op.coefficient !== undefined) validateExpression(op.coefficient, `${path}.coefficient`, fault)
      if (op.damageType !== undefined && !DAMAGE_TYPES.has(op.damageType)) {
        fault('invalid_field_value', `${path}.damageType`, `unknown damage type '${String(op.damageType)}'`)
      }
      for (const [index, component] of (op.components ?? []).entries()) {
        const cpath = `${path}.components[${index}]`
        if (!DAMAGE_COMPONENT_KINDS.has(component.kind)) {
          fault('invalid_field_value', `${cpath}.kind`, `unknown component kind '${String(component.kind)}'`)
        }
        if (component.kind === 'element' && !ELEMENT_TYPES.has(component.element)) {
          fault('invalid_field_value', `${cpath}.element`, `unknown element '${String(component.element)}'`)
        }
        if (typeof component.ratio !== 'number' || component.ratio < 0) {
          fault('invalid_field_value', `${cpath}.ratio`, 'component ratio must be a number >= 0')
        }
      }
      if (op.hitCount !== undefined && (!Number.isInteger(op.hitCount) || op.hitCount < 1)) {
        fault('invalid_field_value', `${path}.hitCount`, 'hitCount must be an integer >= 1')
      }

      // Contract v1.6 damage policies -- declared intent only; legal only
      // when the op resolves a primary hit (coefficient present).
      const hasPolicy = op.hitPolicy !== undefined || op.critPolicy !== undefined || op.armorPolicy !== undefined
      if (hasPolicy && op.coefficient === undefined) {
        fault(
          'policy_without_hit',
          path,
          'hit/crit/armor policies require a primary hit (coefficient must be present)',
        )
      }
      if (op.critPolicy !== undefined && op.canCrit === false) {
        fault('contradictory_damage_policy', `${path}.critPolicy`, 'critPolicy contradicts canCrit:false')
      }
      if (op.armorPolicy !== undefined && explicitlyNonPhysical(op)) {
        fault(
          'contradictory_damage_policy',
          `${path}.armorPolicy`,
          'armorPolicy on an explicitly all-non-physical op (armor applies to physical hits only)',
        )
      }
      if (op.hitPolicy !== undefined && op.hitPolicy.guaranteedHit !== undefined && typeof op.hitPolicy.guaranteedHit !== 'boolean') {
        fault('invalid_field_value', `${path}.hitPolicy.guaranteedHit`, 'guaranteedHit must be a boolean')
      }
      if (op.critPolicy !== undefined && op.critPolicy.bonusChance !== undefined && (op.critPolicy.bonusChance < 0 || op.critPolicy.bonusChance > 1)) {
        fault('invalid_field_value', `${path}.critPolicy.bonusChance`, 'bonusChance must be in [0, 1]')
      }
      if (op.armorPolicy !== undefined) {
        if (op.armorPolicy.bypassChance !== undefined && (op.armorPolicy.bypassChance < 0 || op.armorPolicy.bypassChance > 1)) {
          fault('invalid_field_value', `${path}.armorPolicy.bypassChance`, 'bypassChance must be in [0, 1]')
        }
        if (op.armorPolicy.pierceFractionOnFail !== undefined && (op.armorPolicy.pierceFractionOnFail < 0 || op.armorPolicy.pierceFractionOnFail > 1)) {
          fault('invalid_field_value', `${path}.armorPolicy.pierceFractionOnFail`, 'pierceFractionOnFail must be in [0, 1]')
        }
      }
      if (op.consumeBuff !== undefined) {
        requireBuffRef(op.consumeBuff.definitionId, 'consumeBuff.definitionId')
        validateExpression(op.consumeBuff.damagePerStack, `${path}.consumeBuff.damagePerStack`, fault)
      }
      if (op.scaleBuff !== undefined) {
        requireBuffRef(op.scaleBuff.definitionId, 'scaleBuff.definitionId')
        validateExpression(op.scaleBuff.damagePerStack, `${path}.scaleBuff.damagePerStack`, fault)
      }
      if (op.consumeWard !== undefined) {
        validateExpression(op.consumeWard.damagePerWardPoint, `${path}.consumeWard.damagePerWardPoint`, fault)
      }
      if (op.healPercentOfDamage !== undefined) {
        validateExpression(op.healPercentOfDamage, `${path}.healPercentOfDamage`, fault)
      }
      if (op.missingHpBonusPerMissingPercent !== undefined && op.missingHpBonusPerMissingPercent < 0) {
        fault('invalid_field_value', `${path}.missingHpBonusPerMissingPercent`, 'must be >= 0')
      }
      if (op.missingHpBonusCap !== undefined && op.missingHpBonusCap < 0) {
        fault('invalid_field_value', `${path}.missingHpBonusCap`, 'must be >= 0')
      }
      for (const [index, landedOp] of (op.onLanded ?? []).entries()) {
        const lpath = `${path}.onLanded[${index}]`
        // Per-hit consequence ops: flat lanes only -- no nested damage
        // hits, control flow, or loops; targets bind via loop_target
        // (the hit's target) or self (the caster).
        if (
          landedOp.type === 'deal_damage' ||
          landedOp.type === 'if' ||
          landedOp.type === 'for_each_target' ||
          landedOp.type === 'read_stacks'
        ) {
          fault(
            'invalid_field_value',
            lpath,
            `onLanded does not allow '${landedOp.type}' ops (flat consequence lanes only)`,
          )
          continue
        }
        const landedBindingOk = (t: SkillTargetIntent | undefined): boolean =>
          t === 'loop_target' || t === 'self'
        if ('target' in landedOp && !landedBindingOk(landedOp.target)) {
          fault(
            'invalid_field_value',
            `${lpath}.target`,
            `onLanded ops must target 'loop_target' or 'self' -- got '${landedOp.target}'`,
          )
        }
        if ('selector' in landedOp && landedOp.selector !== undefined) {
          const landedSelector = landedOp.selector
          if (!landedBindingOk(landedSelector.target)) {
            fault(
              'invalid_field_value',
              `${lpath}.selector.target`,
              `onLanded selector targets must be 'loop_target' or 'self' -- got '${landedSelector.target}'`,
            )
          }
          if (
            landedSelector.kind === 'identity' &&
            !landedBindingOk(landedSelector.source)
          ) {
            fault(
              'invalid_field_value',
              `${lpath}.selector.source`,
              `onLanded selector sources must be 'loop_target' or 'self' -- got '${landedSelector.source}'`,
            )
          }
        }
        validateOperation(landedOp, lpath, deps, true, fault)
      }
      return
    }
    case 'heal': {
      requireTarget(op.target)
      if (op.amount !== undefined) validateExpression(op.amount, `${path}.amount`, fault)
      if (op.fractionOfMaxHp !== undefined && (op.fractionOfMaxHp < 0 || op.fractionOfMaxHp > 1)) {
        fault('invalid_field_value', `${path}.fractionOfMaxHp`, 'fractionOfMaxHp must be in [0, 1]')
      }
      if (op.fractionOfPriorDamage !== undefined) {
        if (op.fractionOfPriorDamage.fraction < 0 || op.fractionOfPriorDamage.fraction > 1) {
          fault('invalid_field_value', `${path}.fractionOfPriorDamage.fraction`, 'fraction must be in [0, 1]')
        }
        if (op.fractionOfPriorDamage.capRatio !== undefined && op.fractionOfPriorDamage.capRatio <= 0) {
          fault('invalid_field_value', `${path}.fractionOfPriorDamage.capRatio`, 'capRatio must be > 0')
        }
      }
      if (op.amount === undefined && op.fractionOfMaxHp === undefined && op.fractionOfPriorDamage === undefined) {
        fault('invalid_field_value', path, 'heal needs amount, fractionOfMaxHp, or fractionOfPriorDamage')
      }
      return
    }
    case 'apply_buff': {
      requireTarget(op.target)
      requireBuffRef(op.definitionId)
      if (op.stacks !== undefined) validateExpression(op.stacks, `${path}.stacks`, fault)
      if (op.chance !== undefined) validateExpression(op.chance, `${path}.chance`, fault)
      if (op.durationOverride !== undefined) validateExpression(op.durationOverride, `${path}.durationOverride`, fault)
      if (op.reactionEligibility !== undefined && !REACTION_ELIGIBILITIES.has(op.reactionEligibility)) {
        fault('invalid_field_value', `${path}.reactionEligibility`, `unknown eligibility '${String(op.reactionEligibility)}'`)
      }
      if (
        op.externalWardGrant !== undefined &&
        (!Number.isFinite(op.externalWardGrant.sourceMaxHpRatio) ||
          op.externalWardGrant.sourceMaxHpRatio < 0)
      ) {
        fault('invalid_field_value', `${path}.externalWardGrant`, 'sourceMaxHpRatio must be a finite number >= 0')
      }
      return
    }
    case 'add_buff_stacks':
    case 'remove_buff_stacks':
    case 'consume_buff_stacks': {
      validateSelector(op.selector, `${path}.selector`, deps, insideForEach, fault)
      if (op.stacks === 'all') {
        if (op.type !== 'consume_buff_stacks') {
          fault('invalid_field_value', `${path}.stacks`, `'all' is only legal on consume_buff_stacks`)
        }
      } else {
        validateExpression(op.stacks, `${path}.stacks`, fault)
      }
      return
    }
    case 'add_buff_modifier':
    case 'remove_buff_modifier': {
      validateSelector(op.selector, `${path}.selector`, deps, insideForEach, fault)
      validateModifier(op.modifier, `${path}.modifier`, fault)
      return
    }
    case 'refresh_buff_duration':
    case 'extend_buff_duration': {
      validateSelector(op.selector, `${path}.selector`, deps, insideForEach, fault)
      if (op.turns !== undefined && (!Number.isInteger(op.turns) || op.turns < 0)) {
        fault('invalid_field_value', `${path}.turns`, 'turns must be an integer >= 0')
      }
      return
    }
    case 'trigger_buff_periodic': {
      validateSelector(op.selector, `${path}.selector`, deps, insideForEach, fault)
      return
    }
    case 'remove_buff': {
      requireTarget(op.target)
      validateSelector(op.selector, `${path}.selector`, deps, insideForEach, fault)
      if (op.reason !== undefined && !BUFF_REMOVAL_REASONS.has(op.reason)) {
        fault('invalid_field_value', `${path}.reason`, `unknown removal reason '${String(op.reason)}'`)
      }
      return
    }
    case 'cleanse': {
      requireTarget(op.target)
      validateCleanseQuery(op, path, deps, fault)
      return
    }
    case 'detonate': {
      requireTarget(op.target)
      if (typeof op.amp !== 'number' || !Number.isFinite(op.amp) || op.amp < 0) {
        fault('invalid_field_value', `${path}.amp`, 'detonate amp must be a finite number >= 0')
      }
      return
    }
    case 'push_gauge': {
      requireTarget(op.target)
      validateExpression(op.fractionOfMax, `${path}.fractionOfMax`, fault)
      return
    }
    case 'gain_resource':
    case 'consume_resource': {
      requireTarget(op.target)
      if (op.amount !== 'all') validateExpression(op.amount, `${path}.amount`, fault)
      if (typeof op.resourceId !== 'string' || op.resourceId.length === 0) {
        fault('invalid_field_value', `${path}.resourceId`, 'resourceId must be a non-empty string')
      }
      return
    }
    case 'apply_shield': {
      requireTarget(op.target)
      validateExpression(op.amount, `${path}.amount`, fault)
      return
    }
    case 'read_stacks': {
      // single-binding only: a set-valued target/source has no defined
      // `into` variable binding (resolveIntentSingle would silently take
      // member[0]).
      requireSingleBindingTarget(op.target, 'target')
      requireBuffRef(op.definitionId)
      if (op.source !== undefined) {
        requireSingleBindingTarget(op.source, 'source')
      }
      if (typeof op.into !== 'string' || op.into.length === 0) {
        fault('invalid_field_value', `${path}.into`, 'into must be a non-empty var name')
      }
      return
    }
    case 'if': {
      validateCondition(op.condition, `${path}.condition`, deps, insideForEach, fault)
      if (op.then.length === 0 && (op.else === undefined || op.else.length === 0)) {
        fault('invalid_field_value', path, 'if op needs a non-empty then or else branch')
      }
      validateOperationList(op.then, `${path}.then`, deps, insideForEach, fault)
      if (op.else !== undefined) {
        validateOperationList(op.else, `${path}.else`, deps, insideForEach, fault)
      }
      return
    }
    case 'for_each_target': {
      requireTarget(op.target)
      if (op.target === 'loop_target') {
        fault('invalid_field_value', `${path}.target`, 'for_each_target cannot iterate loop_target')
      }
      if (op.ops.length === 0) {
        fault('invalid_field_value', `${path}.ops`, 'for_each_target needs at least one nested op')
      }
      validateOperationList(op.ops, `${path}.ops`, deps, true, fault)
      return
    }
    default: {
      fault('invalid_field_value', `${path}.type`, `unknown operation type '${String((op as { type?: unknown }).type)}'`)
    }
  }
}

function explicitlyNonPhysical(
  op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
): boolean {
  if (op.components !== undefined && op.components.length > 0) {
    return !op.components.some((c) => c.kind === 'physical')
  }
  return op.damageType === 'primordial'
}

function validateTargetIntent(
  target: SkillTargetIntent | undefined,
  path: string,
  insideForEach: boolean,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (target === undefined || !SKILL_TARGET_INTENTS.has(target)) {
    fault('invalid_field_value', path, `unknown target intent '${String(target)}'`)
    return
  }
  if (target === 'loop_target' && !insideForEach) {
    fault('loop_target_outside_for_each', path, `'loop_target' is only valid inside for_each_target`)
  }
}

/** Single-binding positions (reads, identity selector source): a
    set-valued intent would silently truncate to member[0] -- reject it. */
function validateSingleBindingIntent(
  target: SkillTargetIntent | undefined,
  path: string,
  insideForEach: boolean,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  validateTargetIntent(target, path, insideForEach, fault)
  if (target !== undefined && SET_VALUED_TARGET_INTENTS.has(target)) {
    fault(
      'invalid_field_value',
      path,
      `'${target}' is set-valued -- this position requires a single-binding intent (self/primary_target/attacker/loop_target)`,
    )
  }
}

function validateBuffRef(
  id: BuffDefinitionId | undefined,
  path: string,
  deps: SkillDefinitionValidationDeps,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (typeof id !== 'string' || id.length === 0) {
    fault('invalid_field_value', path, 'definitionId must be a non-empty string')
    return
  }
  if (deps.isBuffDefinitionId !== undefined && !deps.isBuffDefinitionId(id)) {
    fault('unknown_reference', path, `unknown buff definition '${id}'`)
  }
}

function validateCleanseQuery(
  op: Extract<AuthoredSkillOperation, { type: 'cleanse' }>,
  path: string,
  deps: SkillDefinitionValidationDeps,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  const query = op.query
  if (query === undefined || typeof query !== 'object') {
    fault('malformed_cleanse_query', `${path}.query`, 'cleanse needs a query object')
    return
  }
  if (query.kind !== undefined && !CLEANSE_KINDS.has(query.kind)) {
    fault('malformed_cleanse_query', `${path}.query.kind`, `unknown kind '${String(query.kind)}'`)
  }
  if (query.polarity !== undefined && !CLEANSE_POLARITIES.has(query.polarity)) {
    fault('malformed_cleanse_query', `${path}.query.polarity`, `unknown polarity '${String(query.polarity)}'`)
  }
  if (query.element !== undefined && !ELEMENT_TYPES.has(query.element)) {
    fault('malformed_cleanse_query', `${path}.query.element`, `unknown element '${String(query.element)}'`)
  }
  if (query.tags !== undefined && !query.tags.every((t) => typeof t === 'string' && t.length > 0)) {
    fault('malformed_cleanse_query', `${path}.query.tags`, 'tags must be non-empty strings')
  }
  if (query.definitionId !== undefined) {
    validateBuffRef(query.definitionId, `${path}.query.definitionId`, deps, fault)
  }
  if (op.limit !== undefined && (!Number.isInteger(op.limit) || op.limit < 1)) {
    fault('malformed_cleanse_query', `${path}.limit`, 'limit must be a positive integer (undefined = all)')
  }
}

function validateSelector(
  selector: AuthoredBuffSelector,
  path: string,
  deps: SkillDefinitionValidationDeps,
  insideForEach: boolean,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (selector === undefined || typeof selector !== 'object') {
    fault('invalid_field_value', path, 'selector is required')
    return
  }
  switch (selector.kind) {
    case 'target_definition':
      validateTargetIntent(selector.target, `${path}.target`, insideForEach, fault)
      validateBuffRef(selector.definitionId, `${path}.definitionId`, deps, fault)
      return
    case 'identity':
      validateBuffRef(selector.definitionId, `${path}.definitionId`, deps, fault)
      // identity source binds exactly one entity -- a set-valued source
      // intent would silently truncate to member[0].
      validateSingleBindingIntent(
        selector.source,
        `${path}.source`,
        insideForEach,
        fault,
      )
      validateTargetIntent(selector.target, `${path}.target`, insideForEach, fault)
      return
    default:
      fault('invalid_field_value', `${path}.kind`, `unknown selector kind '${String((selector as { kind?: unknown }).kind)}'`)
  }
}

function validateModifier(
  modifier: AuthoredModifier,
  path: string,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (typeof modifier.id !== 'string' || modifier.id.length === 0) {
    fault('invalid_field_value', `${path}.id`, 'modifier id must be a non-empty string')
  }
  if (!MODIFIER_CHANNELS.has(modifier.channel)) {
    fault('invalid_field_value', `${path}.channel`, `unknown channel '${String(modifier.channel)}'`)
  }
  if (!MODIFIER_OPERATIONS.has(modifier.operation)) {
    fault('invalid_field_value', `${path}.operation`, `unknown operation '${String(modifier.operation)}'`)
  }
  if (typeof modifier.value !== 'number') {
    fault('invalid_field_value', `${path}.value`, 'modifier value must be a number')
  }
  if (!MODIFIER_REAPPLY.has(modifier.reapply)) {
    fault('invalid_field_value', `${path}.reapply`, `unknown reapply '${String(modifier.reapply)}'`)
  }
  if (typeof modifier.priority !== 'number') {
    fault('invalid_field_value', `${path}.priority`, 'modifier priority must be a number')
  }
  if (!MODIFIER_LIFETIME_TYPES.has(modifier.lifetime.type)) {
    fault('invalid_field_value', `${path}.lifetime.type`, `unknown lifetime type '${String(modifier.lifetime.type)}'`)
  }
}

// ---------------------------------------------------------------------------
// Expression + condition validation (structural -- evaluation is pure)
// ---------------------------------------------------------------------------

function validateExpression(
  expr: ScalarExpression,
  path: string,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (typeof expr === 'number') {
    if (!Number.isFinite(expr)) {
      fault('malformed_expression', path, 'scalar literal must be finite')
    }
    return
  }
  if (expr === null || typeof expr !== 'object') {
    fault('malformed_expression', path, 'expression must be a number or AST node')
    return
  }
  if ('query' in expr) {
    validateValueQuery(expr, path, fault)
    return
  }
  if (!('op' in expr) || !EXPRESSION_OPS.has(expr.op as string)) {
    fault('malformed_expression', path, `unknown expression op '${String((expr as { op?: unknown }).op)}'`)
    return
  }
  switch (expr.op) {
    case 'add':
    case 'multiply':
    case 'min':
    case 'max':
      if (!Array.isArray(expr.values) || expr.values.length === 0) {
        fault('malformed_expression', `${path}.values`, `'${expr.op}' needs a non-empty values array`)
        return
      }
      for (const [index, value] of expr.values.entries()) {
        validateExpression(value, `${path}.values[${index}]`, fault)
      }
      return
    case 'subtract':
    case 'divide':
      validateExpression(expr.left, `${path}.left`, fault)
      validateExpression(expr.right, `${path}.right`, fault)
      return
    case 'clamp':
      validateExpression(expr.value, `${path}.value`, fault)
      validateExpression(expr.min, `${path}.min`, fault)
      validateExpression(expr.max, `${path}.max`, fault)
      return
    case 'if':
      validateConditionShallow(expr.condition, `${path}.condition`, fault)
      validateExpression(expr.then, `${path}.then`, fault)
      validateExpression(expr.else, `${path}.else`, fault)
      return
  }
}

function validateValueQuery(
  query: SkillValueQuery,
  path: string,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (!VALUE_QUERIES.has(query.query)) {
    fault('malformed_expression', `${path}.query`, `unknown value query '${String(query.query)}'`)
    return
  }
  const needTarget = 'target' in query && query.target !== undefined
  if ('target' in query) {
    if (!SKILL_TARGET_INTENTS.has(query.target)) {
      fault('malformed_expression', `${path}.target`, `unknown target intent '${String(query.target)}'`)
    } else if (query.target === 'loop_target') {
      // loop_target inside expressions inherits the enclosing for_each
      // legality -- the op-level walk tracks it; deep expressions inside
      // op fields were already reached under insideForEach, but the query
      // leaf itself cannot see the flag here. loop_target legality is
      // enforced on op/condition targets; a query leaf carrying it is
      // accepted (the for_each binding resolves it at RESOLVE).
    }
  }
  void needTarget
  switch (query.query) {
    case 'buff_stacks':
    case 'buff_duration':
      if (typeof query.definitionId !== 'string' || query.definitionId.length === 0) {
        fault('malformed_expression', `${path}.definitionId`, 'definitionId must be a non-empty string')
      }
      return
    case 'resource_current':
    case 'resource_max':
    case 'resource_snapshot':
      if (typeof query.resourceId !== 'string' || query.resourceId.length === 0) {
        fault('malformed_expression', `${path}.resourceId`, 'resourceId must be a non-empty string')
      }
      return
    case 'stat_scalar':
      if (typeof query.key !== 'string' || query.key.length === 0) {
        fault('malformed_expression', `${path}.key`, 'stat_scalar key must be a non-empty string')
      }
      return
    case 'var':
      if (typeof query.name !== 'string' || query.name.length === 0) {
        fault('malformed_expression', `${path}.name`, 'var name must be a non-empty string')
      }
      return
    case 'cast_outcome':
      if (query.field !== 'landed' && query.field !== 'any_crit') {
        fault('malformed_expression', `${path}.field`, `unknown cast_outcome field '${String(query.field)}'`)
      }
      return
    default:
      return
  }
}

function validateCondition(
  condition: SkillCondition,
  path: string,
  deps: SkillDefinitionValidationDeps,
  insideForEach: boolean,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  validateConditionInner(condition, path, deps, insideForEach, fault)
}

/** Expression-level conditions can't reach the loop binding flag -- they
    inherit legality from the op that hosts them (validateExpression calls
    this shallow variant; the op walk tracks insideForEach separately). */
function validateConditionShallow(
  condition: SkillCondition,
  path: string,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  validateConditionInner(condition, path, {}, true, fault)
}

function validateConditionInner(
  condition: SkillCondition,
  path: string,
  deps: SkillDefinitionValidationDeps,
  insideForEach: boolean,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (condition === null || typeof condition !== 'object' || !CONDITION_KINDS.has(condition.kind)) {
    fault('malformed_condition', path, `unknown condition kind '${String((condition as { kind?: unknown }).kind)}'`)
    return
  }
  switch (condition.kind) {
    case 'stacks_at_least':
      validateTargetIntent(condition.target, `${path}.target`, insideForEach, fault)
      validateBuffRef(condition.definitionId, `${path}.definitionId`, deps, fault)
      if (typeof condition.stacks !== 'number' || condition.stacks < 0) {
        fault('malformed_condition', `${path}.stacks`, 'stacks must be a number >= 0')
      }
      return
    case 'hp_percent_below':
      validateTargetIntent(condition.target, `${path}.target`, insideForEach, fault)
      validateExpression(condition.threshold, `${path}.threshold`, fault)
      return
    case 'resource_at_least':
      if (typeof condition.resourceId !== 'string' || condition.resourceId.length === 0) {
        fault('malformed_condition', `${path}.resourceId`, 'resourceId must be a non-empty string')
      }
      if (typeof condition.amount !== 'number' || condition.amount < 0) {
        fault('malformed_condition', `${path}.amount`, 'amount must be a number >= 0')
      }
      return
    case 'target_alive':
      if (condition.target !== undefined) {
        validateTargetIntent(condition.target, `${path}.target`, insideForEach, fault)
      }
      return
    case 'var':
      if (typeof condition.name !== 'string' || condition.name.length === 0) {
        fault('malformed_condition', `${path}.name`, 'var name must be a non-empty string')
      }
      if (condition.op !== 'gte' && condition.op !== 'lt' && condition.op !== 'eq') {
        fault('malformed_condition', `${path}.op`, `unknown comparison '${String(condition.op)}'`)
      }
      if (typeof condition.value !== 'number') {
        fault('malformed_condition', `${path}.value`, 'var comparison value must be a number')
      }
      return
    case 'crit_landed':
    case 'any_target_landed':
      return
    case 'target_hit_landed':
      // single-binding intents only -- 'affected_targets'/'all_enemies'
      // would bind member[0] silently (misleading); use any_target_landed
      // for the cast-scope check instead.
      if (condition.target !== undefined) {
        if (SET_VALUED_TARGET_INTENTS.has(condition.target)) {
          fault(
            'malformed_condition',
            `${path}.target`,
            `target_hit_landed requires a single-binding intent (loop_target/primary_target/self/attacker), got '${condition.target}' -- use any_target_landed for the cast-scope check`,
          )
        }
        validateTargetIntent(condition.target, `${path}.target`, insideForEach, fault)
      }
      return
  }
}

// ---------------------------------------------------------------------------
// CON-01 deep-scan: no authored field may carry runtime ids.
// ---------------------------------------------------------------------------

function validateRuntimeIdGuard(
  node: unknown,
  path: string,
  fault: (code: SkillDefinitionFaultCode, path: string, message: string) => void,
): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const [index, entry] of node.entries()) {
      validateRuntimeIdGuard(entry, `${path}[${index}]`, fault)
    }
    return
  }
  for (const [key, value] of Object.entries(node)) {
    const childPath = path === '' ? key : `${path}.${key}`
    if (RUNTIME_ID_KEYS.has(key)) {
      fault('runtime_id_field', childPath, `authored definitions may not carry runtime id field '${key}'`)
    }
    validateRuntimeIdGuard(value, childPath, fault)
  }
}

// ---------------------------------------------------------------------------
// Registry -- deep-frozen immutable catalog.
// ---------------------------------------------------------------------------

export class SkillDefinitionRegistry {
  private readonly definitions: ReadonlyMap<SkillId, SkillDefinition>
  private readonly order: readonly SkillId[]

  constructor(
    definitions: readonly SkillDefinition[],
    deps: SkillDefinitionValidationDeps = {},
  ) {
    const faults = validateSkillDefinitionSet(definitions, deps)
    if (faults.length > 0) {
      const summary = faults.map((f) => `  [${f.code}] ${f.path}: ${f.message}`).join('\n')
      throw new Error(`SkillDefinitionRegistry: ${faults.length} validation fault(s)\n${summary}`)
    }
    const map = new Map<SkillId, SkillDefinition>()
    for (const definition of definitions) {
      map.set(definition.id, deepFreeze(definition))
    }
    this.definitions = map
    this.order = definitions.map((d) => d.id)
  }

  get(id: SkillId): SkillDefinition | undefined {
    return this.definitions.get(id)
  }

  require(id: SkillId): SkillDefinition {
    const definition = this.definitions.get(id)
    if (definition === undefined) {
      throw new Error(`SkillDefinitionRegistry: unknown skill '${id}'`)
    }
    return definition
  }

  has(id: SkillId): boolean {
    return this.definitions.has(id)
  }

  list(): readonly SkillDefinition[] {
    return this.order.map((id) => this.definitions.get(id) as SkillDefinition)
  }

  get size(): number {
    return this.definitions.size
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry)
  } else {
    for (const entry of Object.values(value)) deepFreeze(entry)
  }
  return Object.freeze(value)
}
