import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'
import type { CombatVfxPresetId } from '../battle/CombatAction'

// Trigger/Action rework (2026-08-31 spec, Phase 2A) — replaces the old
// per-mechanic fields on SkillEffect/Skill with composable actions. The
// union is consumed by SkillToTurnSkillConverter into the live turn
// engine (the mapped-type legacy executor was deleted in Mission G).
export interface DealDamageAction {
  type: 'dealDamage'

  value?: number

  damageType?: 'physical' | 'primordial'

  components?: SkillDamageComponent[]

  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]

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

  chance?: number
}

export interface ApplyDebuffAction {
  type: 'applyDebuff'

  buffId: string

  chance?: number
}

// Named resource pools every path can grant/consume — mirrors the fields
// already on CombatEntity — empty: the element/sword pools moved off
// CombatEntity (kiem-tu/phap-tu reimagined) and momentum was retired
// (the-tu-reimagined spec 2026-09-15 D7). `never` until a path re-authors
// a named entity pool; grantResource becomes unproducible while
// consumeResource keeps its 'breakGauge' member below.
export type SkillResourcePoolKey = never

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

  buffId?: string

  damagePerUnit: number

  healPercentOfDamage?: number

  // 'own' (default) — only the executing skill's own source instance.
  // 'any' — every source's instance, summed, all removed.
  scope?: 'own' | 'any'
}

export interface SpawnZoneAction {
  type: 'spawnZone'

  zoneKind: 'lava'

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
