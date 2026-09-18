// BuffRegistry.ts -- definition catalog + spec sec.56 startup validation.
// Dev/test builds THROW on the first violation -- no silent fallback, no
// partial catalog: an invalid authored definition is a data bug, not a
// runtime state.

import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { CapabilityValidatorRegistry } from '../battle/runtime/capability/CapabilityValidatorRegistry'
import type { ElementType } from '../element/ElementType'
import type {
  BuffDefinition,
  BuffPeriodicDefinition,
} from './BuffDefinition'
import type { BuffDefinitionLookup } from './BuffQuery'

/** Damage-profile catalog port (spec sec.56): the profile owns the combat
    formula AND its declared snapshot-field schema -- a snapshot periodic's
    authored `snapshotFields` selection must be a subset of it. buff2 never
    interprets profile semantics. */
export interface BuffDamageProfileCatalog {
  has(profileId: string): boolean
  /** Declared snapshot schema for the profile (empty = profile snapshots
      nothing -- a snapshot selection then always fails). */
  snapshotFields(profileId: string): readonly string[]
}

const ELEMENTS: readonly ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']
const SCOPES = new Set(['per_source', 'per_target'])
const CLOCKS = new Set(['holder_turns', 'source_turns', 'rounds', 'seconds', 'permanent'])
const SCALINGS = new Set(['fixed', 'ailment_scaled'])
const STACK_POLICIES = new Set(['add', 'replace', 'keep'])
const DURATION_POLICIES = new Set(['refresh', 'keep', 'extend'])
const TIMINGS = new Set([
  'holder_turn_start',
  'holder_turn_end',
  'source_turn_start',
  'source_turn_end',
  'interval',
])
const CONTROLS = new Set(['stun', 'freeze', 'root'])
const KINDS = new Set(['buff', 'debuff', 'ailment', 'marker'])

export class BuffDefinitionValidationError extends Error {}

function fail(id: string, detail: string): never {
  throw new BuffDefinitionValidationError(`BuffDefinition '${id}': ${detail}`)
}

function requireNonEmptyString(
  id: string,
  value: unknown,
  field: string,
): void {
  if (typeof value !== 'string' || value.length === 0) {
    fail(id, `${field} must be a non-empty string`)
  }
}

function requireBoolean(id: string, value: unknown, field: string): void {
  if (typeof value !== 'boolean') fail(id, `${field} must be a boolean`)
}

function requireFiniteNumber(
  id: string,
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(id, `${field} must be a finite number`)
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}

export class BuffRegistry implements BuffDefinitionLookup {
  private readonly definitions = new Map<BuffDefinitionId, BuffDefinition>()
  private sealed = false

  constructor(
    private readonly deps: {
      damageProfiles: BuffDamageProfileCatalog
      capabilityValidators: CapabilityValidatorRegistry
    },
  ) {}

  /** Per-definition validation + registration. Cross-reference checks
      (convertsToId resolvable) run at seal() once every def is loaded. */
  register(definition: BuffDefinition): void {
    if (this.sealed) {
      throw new BuffDefinitionValidationError('BuffRegistry: register() after seal()')
    }
    if (typeof definition !== 'object' || definition === null) {
      throw new BuffDefinitionValidationError('BuffRegistry: definition must be an object')
    }
    const id = definition.id
    requireNonEmptyString('<unknown>', id, 'id')
    if (this.definitions.has(id)) fail(id, 'duplicate id')
    this.validateDefinition(definition)
    this.definitions.set(id, deepFreeze({ ...definition }))
  }

  /** Cross-reference validation: convertsToId must resolve inside the
      loaded catalog. After seal the registry is read-only. */
  seal(): void {
    for (const definition of this.definitions.values()) {
      if (
        definition.convertsToId !== undefined &&
        !this.definitions.has(definition.convertsToId)
      ) {
        fail(
          definition.id,
          `convertsToId '${definition.convertsToId}' does not resolve to a registered definition`,
        )
      }
    }
    this.sealed = true
  }

  get(id: BuffDefinitionId): BuffDefinition {
    const definition = this.definitions.get(id)
    if (definition === undefined) {
      throw new BuffDefinitionValidationError(`BuffRegistry: unknown definition '${id}'`)
    }
    return definition
  }

  tryGet(id: BuffDefinitionId): BuffDefinition | undefined {
    return this.definitions.get(id)
  }

  has(id: BuffDefinitionId): boolean {
    return this.definitions.has(id)
  }

  all(): readonly BuffDefinition[] {
    return [...this.definitions.values()]
  }

  // -------------------------------------------------------------------
  // spec sec.56 validation -- the FULL list; every rule throws.
  // -------------------------------------------------------------------

  private validateDefinition(d: BuffDefinition): void {
    const id = String(d.id)
    requireNonEmptyString(id, d.id, 'id')
    requireNonEmptyString(id, d.name, 'name')
    if (!KINDS.has(d.kind)) fail(id, `unknown kind '${String(d.kind)}'`)
    if (d.polarity !== undefined && d.polarity !== 'buff' && d.polarity !== 'debuff') {
      fail(id, `invalid polarity '${String(d.polarity)}'`)
    }
    if (d.element !== undefined && !ELEMENTS.includes(d.element)) {
      fail(id, `unknown element '${String(d.element)}'`)
    }
    if (d.hidden !== undefined) requireBoolean(id, d.hidden, 'hidden')
    if (!SCOPES.has(d.instanceScope)) {
      fail(id, `invalid instanceScope '${String(d.instanceScope)}'`)
    }
    if (d.sourceOwnership !== undefined) {
      if (d.sourceOwnership !== 'latest' && d.sourceOwnership !== 'first') {
        fail(id, `invalid sourceOwnership '${String(d.sourceOwnership)}'`)
      }
      if (d.instanceScope !== 'per_target') {
        fail(id, `sourceOwnership is only meaningful with instanceScope 'per_target'`)
      }
    }

    this.validateStacking(d)
    this.validateLifetime(d)
    this.validateApplication(d)
    this.validatePeriodic(d)
    this.validateStatModifiers(d)
    this.validateControls(d)
    this.validateCapabilities(d)

    requireBoolean(id, d.dispellable, 'dispellable')
    if (d.clearsCcOnApply !== undefined) requireBoolean(id, d.clearsCcOnApply, 'clearsCcOnApply')
    if (d.convertsAtStackCap !== undefined) requireBoolean(id, d.convertsAtStackCap, 'convertsAtStackCap')
    if (d.convertsToId !== undefined) requireNonEmptyString(id, d.convertsToId, 'convertsToId')
    if (d.convertsAfterContinuousTurns !== undefined) {
      requireFiniteNumber(id, d.convertsAfterContinuousTurns, 'convertsAfterContinuousTurns')
      if (d.convertsAfterContinuousTurns < 0) fail(id, 'convertsAfterContinuousTurns must be >= 0')
    }
    if (d.convertsAfterContinuousSeconds !== undefined) {
      requireFiniteNumber(id, d.convertsAfterContinuousSeconds, 'convertsAfterContinuousSeconds')
      if (d.convertsAfterContinuousSeconds < 0) fail(id, 'convertsAfterContinuousSeconds must be >= 0')
    }
  }

  private validateStacking(d: BuffDefinition): void {
    const id = String(d.id)
    const s = d.stacking
    if (typeof s !== 'object' || s === null) fail(id, 'stacking is required')
    requireFiniteNumber(id, s.maxStacks, 'stacking.maxStacks')
    if (s.maxStacks < 1) fail(id, 'stacking.maxStacks must be >= 1')
    if (!STACK_POLICIES.has(s.onReapplyStacks)) {
      fail(id, `invalid stacking.onReapplyStacks '${String(s.onReapplyStacks)}'`)
    }
    if (!DURATION_POLICIES.has(s.onReapplyDuration)) {
      fail(id, `invalid stacking.onReapplyDuration '${String(s.onReapplyDuration)}'`)
    }
    if (s.replaceInstanceOnReapply !== undefined) {
      requireBoolean(id, s.replaceInstanceOnReapply, 'stacking.replaceInstanceOnReapply')
    }
  }

  private validateLifetime(d: BuffDefinition): void {
    const id = String(d.id)
    const l = d.lifetime
    if (typeof l !== 'object' || l === null) fail(id, 'lifetime is required')
    if (!CLOCKS.has(l.clock)) fail(id, `invalid lifetime.clock '${String(l.clock)}'`)
    if (!SCALINGS.has(l.scaling)) fail(id, `invalid lifetime.scaling '${String(l.scaling)}'`)
    if (l.clock === 'permanent') {
      if (l.duration !== undefined) {
        fail(id, `lifetime.duration must be absent when clock is 'permanent'`)
      }
    } else {
      requireFiniteNumber(id, l.duration, 'lifetime.duration')
      if (l.duration! < 0) fail(id, 'lifetime.duration must be >= 0')
    }
    if (l.removeOnSourceDeath !== undefined) {
      requireBoolean(id, l.removeOnSourceDeath, 'lifetime.removeOnSourceDeath')
    }
  }

  private validateApplication(d: BuffDefinition): void {
    const id = String(d.id)
    const a = d.application
    if (a === undefined) return
    if (a.resistance !== 'none' && a.resistance !== 'ailment') {
      fail(id, `invalid application.resistance '${String(a.resistance)}'`)
    }
    if (a.clampChance !== undefined) requireBoolean(id, a.clampChance, 'application.clampChance')
  }

  private validatePeriodic(d: BuffDefinition): void {
    const id = String(d.id)
    if (d.periodic === undefined) return
    const seen = new Set<string>()
    for (const p of d.periodic) this.validatePeriodicEntry(id, p, seen)
  }

  private validatePeriodicEntry(
    defId: string,
    p: BuffPeriodicDefinition,
    seen: Set<string>,
  ): void {
    requireNonEmptyString(defId, p.id, 'periodic.id')
    if (seen.has(p.id)) fail(defId, `duplicate periodic id '${p.id}'`)
    seen.add(p.id)
    if (!TIMINGS.has(p.timing)) fail(defId, `periodic '${p.id}': invalid timing '${String(p.timing)}'`)
    if (p.timing === 'interval') {
      requireFiniteNumber(defId, p.intervalSeconds, `periodic '${p.id}'.intervalSeconds`)
      if (p.intervalSeconds! <= 0) fail(defId, `periodic '${p.id}': intervalSeconds must be > 0`)
    }
    if (p.stackScaling !== 'multiply' && p.stackScaling !== 'ignore') {
      fail(defId, `periodic '${p.id}': invalid stackScaling '${String(p.stackScaling)}'`)
    }
    if (p.type === 'damage') {
      requireNonEmptyString(defId, p.damageProfile, `periodic '${p.id}'.damageProfile`)
      if (!this.deps.damageProfiles.has(p.damageProfile)) {
        fail(defId, `periodic '${p.id}': unknown damageProfile '${p.damageProfile}'`)
      }
      requireFiniteNumber(defId, p.coefficient, `periodic '${p.id}'.coefficient`)
      requireBoolean(defId, p.canCrit, `periodic '${p.id}'.canCrit`)
      requireBoolean(defId, p.canMiss, `periodic '${p.id}'.canMiss`)
      requireFiniteNumber(defId, p.hitCount, `periodic '${p.id}'.hitCount`)
      if (p.hitCount < 1) fail(defId, `periodic '${p.id}': hitCount must be >= 1`)
      if (p.element !== 'physical' && !ELEMENTS.includes(p.element)) {
        fail(defId, `periodic '${p.id}': unknown element '${String(p.element)}'`)
      }
      // MEDIUM 2: snapshotFields are validated against the profile's
      // declared snapshot schema -- the PROFILE owns the semantics, not
      // the def author.
      if (p.scaling === 'snapshot') {
        if (!Array.isArray(p.snapshotFields) || p.snapshotFields.length === 0) {
          fail(defId, `periodic '${p.id}': snapshotFields required when scaling is 'snapshot'`)
        }
        const schema = new Set(this.deps.damageProfiles.snapshotFields(p.damageProfile))
        for (const field of p.snapshotFields!) {
          if (!schema.has(field)) {
            fail(
              defId,
              `periodic '${p.id}': snapshotField '${field}' is outside damageProfile '${p.damageProfile}' snapshot schema`,
            )
          }
        }
      } else if (p.scaling === 'dynamic') {
        if (p.snapshotFields !== undefined) {
          fail(defId, `periodic '${p.id}': snapshotFields must be absent when scaling is 'dynamic'`)
        }
      } else {
        fail(defId, `periodic '${p.id}': invalid scaling '${String(p.scaling)}'`)
      }
    } else if (p.type === 'heal') {
      requireFiniteNumber(defId, p.amount, `periodic '${p.id}'.amount`)
    } else {
      const malformed = p as { id?: unknown; type?: unknown }
      fail(defId, `periodic '${String(malformed.id)}': unknown type '${String(malformed.type)}'`)
    }
  }

  private validateStatModifiers(d: BuffDefinition): void {
    const id = String(d.id)
    if (d.statModifiers === undefined) return
    for (const m of d.statModifiers) {
      requireNonEmptyString(id, m.stat, 'statModifiers[].stat')
      if (m.flat === undefined && m.percent === undefined) {
        fail(id, `statModifiers[${m.stat}]: flat or percent required`)
      }
      if (m.flat !== undefined) requireFiniteNumber(id, m.flat, `statModifiers[${m.stat}].flat`)
      if (m.percent !== undefined) requireFiniteNumber(id, m.percent, `statModifiers[${m.stat}].percent`)
    }
  }

  private validateControls(d: BuffDefinition): void {
    const id = String(d.id)
    if (d.controls === undefined) return
    for (const c of d.controls) {
      if (!CONTROLS.has(c.type)) fail(id, `unknown control type '${String(c.type)}'`)
    }
  }

  /** Every grant's type must be REGISTERED and its payload must pass the
      owner's validator -- unknown type or invalid payload throws (spec
      sec.56 'valid capability descriptors'; v7.2 contract). */
  private validateCapabilities(d: BuffDefinition): void {
    const id = String(d.id)
    if (d.capabilities === undefined) return
    for (const grant of d.capabilities) {
      requireNonEmptyString(id, grant.id, 'capabilities[].id')
      requireNonEmptyString(id, grant.type, 'capabilities[].type')
      try {
        this.deps.capabilityValidators.validate(grant.type, grant.payload)
      } catch (error) {
        fail(
          id,
          `capability '${grant.id}' (${grant.type}) failed validation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
  }
}
