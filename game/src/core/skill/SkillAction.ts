import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'
import type { AilmentId } from '../ailment/AilmentTypes'
import type { CombatVfxPresetId } from '../battle/CombatAction'

// Trigger/Action rework (2026-08-31 spec, Phase 2A) — replaces the old
// per-mechanic fields on SkillEffect/Skill with composable actions. Every
// SkillActionType has a real executor in SkillActionRegistry.ts — the
// mapped-type registry there is exhaustive, so a missing executor is a
// compile error, not a silent no-op.
export interface DealDamageAction {
  type: 'dealDamage'

  value?: number

  damageType?: 'physical' | 'primordial'

  components?: SkillDamageComponent[]

  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]

  swordIntentDamageRatio?: number

  realmDamageRatio?: number

  manaScalingRatio?: number

  skillExperienceRatio?: number

  hitCountByRealm?: boolean

  // Phase 2A — batch-level knockback (Thổ Tu pattern). Read at
  // beginSkillBatch() time in BattleSystem.ts, same as
  // earthPureAreaBehavior today; NOT a per-hit field on the executor.
  knockbackDistance?: number
}

export interface HealAction {
  type: 'heal'

  value?: number

  // Reads runtime.consumedDamage, written by a prior consumeForDamage
  // action in the same TriggerBinding's action list.
  healPercentOfDamage?: number
}

export interface ApplyBuffAction {
  type: 'applyBuff'

  buffId: string
}

export interface ApplyDebuffAction {
  type: 'applyDebuff'

  buffId: string
}

export interface ApplyAilmentAction {
  type: 'applyAilment'

  ailmentId: AilmentId

  chance?: number
}

// Named resource pools every path can grant/consume — mirrors the fields
// already on CombatEntity (currentSwordIntent, currentMomentum,
// currentHoaThe, currentThoThe, currentKimThe, currentHuyetPha).
export type SkillResourcePoolKey =
  | 'swordIntent'
  | 'momentum'
  | 'hoaThe'
  | 'thoThe'
  | 'kimThe'
  | 'huyetPha'

export interface GrantResourceAction {
  type: 'grantResource'

  pool: SkillResourcePoolKey

  amount: number
}

export interface ConsumeResourceAction {
  type: 'consumeResource'

  // 'breakGauge' targets the TARGET entity's Break Gauge (not source's
  // pool) — the only pool this action reads off `target` instead of
  // `source`. Fires onBreak when it reaches 0.
  pool: SkillResourcePoolKey | 'breakGauge'

  amount: number | 'all'
}

export interface ConsumeForDamageAction {
  type: 'consumeForDamage'

  // 'ailment' = Detonate (consumesAilmentId+damagePerStack pattern),
  // 'ward' = ward-break (consumesWardForDamage+damagePerWardPoint pattern).
  source: 'ailment' | 'ward'

  ailmentId?: AilmentId

  damagePerUnit: number

  healPercentOfDamage?: number
}

export interface SpawnZoneAction {
  type: 'spawnZone'

  zoneKind: 'lava' | 'sword'

  charges: number

  tickInterval: number

  damageRatio: number

  position: 'source' | 'target'
}

export interface SpawnVfxAction {
  type: 'spawnVfx'

  presetId: CombatVfxPresetId

  target?: 'source' | 'target'
}

export type SkillAction =
  | DealDamageAction
  | HealAction
  | ApplyBuffAction
  | ApplyDebuffAction
  | ApplyAilmentAction
  | GrantResourceAction
  | ConsumeResourceAction
  | ConsumeForDamageAction
  | SpawnZoneAction
  | SpawnVfxAction

export type SkillActionType = SkillAction['type']

/**
 * Scratch state shared by every action inside one TriggerBinding's action
 * list, seeded from the firing trigger's context. Lets a later action read
 * a value an earlier action produced (e.g. consumeForDamage writing
 * consumedDamage for a following heal to read) without either action
 * knowing the other by name.
 */
export interface ActionRuntimeContext {
  damageDealt?: number

  isCrit?: boolean

  consumedDamage?: number

  consumedAmount?: number
}
