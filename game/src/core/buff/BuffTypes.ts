import type { StatType } from '../stats/StatTypes'
import type { StatDomain } from '../stats/StatDomain'
import type { ElementType } from '../element/ElementType'

// R4 (AR-19) — Canonical Buff & Status Types.
// Consolidates turn-based and persistent buff shapes under one authority.

export type BuffPolarity = 'buff' | 'debuff'

export type BuffStackMode = 'stack' | 'refresh' | 'replace'

export type BuffCcEffect = 'stun' | 'freeze' | 'root'

// --- Template-time shapes (BuffDefinition.effects) ---

export interface StatModifierEffect {
  type: 'statModifier'
  stat: StatType
  percent?: number
  flat?: number
  // stat-system-reimagined Task 3 — forwarded onto the emitted
  // StatModifier so a buff targeting a domain-gated stat (e.g. MP pool
  // stats gated to 'phap_tu' once STAT_DOMAIN activates in Task 7)
  // declares its credential at authoring time.
  domain?: StatDomain
}

export interface DotEffectTemplate {
  type: 'dot'
  dpsRatio: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
  armorIgnorePercentByRealm?: boolean
}

export interface CcEffect {
  type: 'cc'
  ccEffect: BuffCcEffect
}

export interface OnHitProcEffect {
  type: 'onHitProc'
  chance: number
  appliesBuffId: string
}

/**
 * The Tu Reimagined (plan Task 16) — the shared reactive-window name
 * space. 'onCastBegin'/'onImpactLanded' predate the redesign; 'onEvade'
 * fires on the dodge branch of the hit loop; 'onAllyTargeted' /
 * 'onAllyActionComplete' serve the Ho intercept and Tro follow-up
 * windows (Tasks 17-18).
 */
export type ReactiveTriggerName =
  | 'onCastBegin'
  | 'onImpactLanded'
  | 'onEvade'
  | 'onAllyTargeted'
  | 'onAllyActionComplete'

export interface ReactiveTriggerEffect {
  type: 'reactiveTrigger'
  trigger: ReactiveTriggerName
  chance: number
  appliesDefinitionId?: string
  queuesFollowUp?: boolean
  // The Tu Reimagined (spec 2026-09-15 section 5.2) — phan_chinh
  // Reflection payload: on a `taken` hit the holder deals
  // `hpDamage * takenRatio + holder.stats.maxHp * maxHpRatio` back to the
  // attacker as a terminal damage event (no windows opened, INV-8).
  // Resolution lives in BuffSystem.rollReactiveTrigger + TurnBattleSystem
  // (Task 8); node scaling adjusts the def CLONE via
  // collectTheTuKitModifiers, never the registry def.
  reflectsDamage?: { maxHpRatio: number; takenRatio: number }
}

/**
 * The Tu Reimagined (plan Task 6) — flag-only marker effect: no numeric
 * payload, presence is the data. Flags:
 * - displacementImmune: holder ignores displacement/cast-interruption
 *   (flag only; no turn-engine displacement consumer exists today).
 * - grantsExternalWard: the buff instance marks an externalWard grant —
 *   the reconcile hook keys on this field (plan Task 11, review P1.1).
 */
export interface MarkerEffectTemplate {
  type: 'marker'
  displacementImmune?: boolean
  grantsExternalWard?: boolean
}

export interface GaugeDeltaEffect {
  type: 'gaugeDelta'
  percentOfMax: number
}

/**
 * The Tu Reimagined (spec 2026-09-15 sections 4.1/6, plan Task 14) —
 * the ung_the marker effect: presence marks the holder as a the_tu_an
 * reactive combatant eligible for proc windows and the free-income
 * table. `gainOnBasicHit` is the OWN-basic-lands income channel (review
 * P1 single-channel lock: THE_GAIN_ON_BASIC lives here because
 * TurnSkillDefinition has no landed-cast gain field — never both).
 * Task 15's economy reads this marker; it never flows through
 * StatModifier.
 */
export interface TheEconomyEffect {
  type: 'theEconomy'
  gainOnBasicHit?: number
  // Task 20 — the remaining free-income channels also live on the
  // marker so node bonuses bake onto the participant-local clone
  // (collectTheTuAnMechanicModifiers -> buildTheTuAnKit). Same
  // single-channel rule: the constants in TheEconomy.ts are the
  // authored bases, these fields are the live values.
  gainOnEvade?: number
  gainOnHitTaken?: number
  gainPerRound?: number
}

/**
 * The Tu Reimagined (spec section 6.2, plan Task 14) — root-purchase
 * marker planting one reactive mechanic on the holder's pool:
 * - 'intercept' (ho_mon): substitute as the action's target pre-impact
 * - 'counter' (phan_mon): queue phan_kich after taken/evaded outcomes
 * - 'follow_up' (tro_mon): queue tro_kich after another ally's landed
 *   action
 * `chanceStat` names the derived stat the window rolls; `payloadSkillId`
 * names the queued bypass-turn payload (intercept has none — the
 * substitution itself is the effect). Tasks 15-18 consume.
 */
export interface ReactiveProcEffect {
  type: 'reactiveProc'
  /** Which window this proc listens on (Task 16's shared name space). */
  trigger: ReactiveTriggerName
  mechanic: 'intercept' | 'counter' | 'follow_up'
  chanceStat: 'protectChance' | 'counterChance' | 'followUpChance'
  /** Per-effect cost override; defaults to THE_PROC_COST (15). */
  theCost?: number
  /** Per-effect success credit override; defaults to THE_PROC_GAIN (20). */
  theGainOnSuccess?: number
  /**
   * What a successful proc queues on the typed follow-up queue. Absent
   * on 'intercept' — the substitution itself is the effect. targetMode:
   * 'attacker' = the participant that provoked the window (Phan);
   * 'triggering_targets' = the triggering action's still-live affected
   * set (Tro — plural, an ally AoE queues against the whole landed set).
   */
  queuedAction?: {
    payloadSkillId: string
    actionSource: 'counter' | 'follow_up' | 'intercept'
    targetMode: 'attacker' | 'triggering_targets'
  }
  /**
   * Task 20 (spec 8.2 "intercept->ally ward") — on a successful
   * intercept the ORIGINAL target gains this externalWard pool scaled
   * on the PROTECTOR's maxHp, plus the authored marker buff that keeps
   * the pool alive (same existence-bound contract as son_nhac_ho_the).
   * Baked onto the ho_mon marker clone by buildTheTuAnKit.
   */
  grantsWardToOriginalTarget?: { buffDefinitionId: string; sourceMaxHpRatio: number }
  /**
   * Task 20 (spec 8.2 "tro_kich heals ally") — on a successful Tro proc
   * the TRIGGERING ally is healed by ratio x its own maxHp through the
   * vitals authority. Baked onto the tro_mon marker clone.
   */
  healsTriggeringAllyMaxHpRatio?: number
  /**
   * Task 20 (spec 8.2 "follow-up on ANY ally action") — the Tro window
   * normally opens only when the ally action landed a damaging hit;
   * this flag also opens it on non-damaging ally actions (targets = all
   * living enemies). Baked onto the tro_mon marker clone.
   */
  firesOnNonDamagingAction?: boolean
}

/**
 * The Tu Reimagined (spec section 6.1, plan Task 14/19) — stance-window
 * economy modifiers read from the HOLDER's pool at reactive-check time:
 * - procCostFlatDelta: flat cost shift per proc attempt (tu_the: -5,
 *   floored at 0)
 * - freeProcs: proc attempts cost nothing (bach_ung window)
 * - payloadAilments: authored payload-upgrade rider — merged into the
 *   queued payload's appliesAilments at resolve time (spec's "counter
 *   hits +break" example expressed through the existing ailment
 *   mechanism; NOT an invented damage multiplier).
 */
export interface ReactiveEconomyEffect {
  type: 'reactiveEconomy'
  procCostFlatDelta?: number
  freeProcs?: boolean
  payloadAilments?: { buffDefinitionId: string; chance: number; stacks?: number }[]
}

// stat-system-reimagined Task 4 (D18) -- authored DoT-recovery trigger on
// the SOURCE's own buff (Doc Can). When a DoT tick of a matching element
// lands, the living source heals healPercent * stacks of the damage dealt;
// the heal then scales with the source's healingEffectivenessPercent.
// Element omitted = recovers from any DoT element.
export interface DotRecoveryEffect {
  type: 'dotRecovery'
  element?: ElementType | 'physical'
  healPercent: number
}

export type BuffEffectTemplate =
  | StatModifierEffect
  | DotEffectTemplate
  | CcEffect
  | OnHitProcEffect
  | GaugeDeltaEffect
  | ReactiveTriggerEffect
  | DotRecoveryEffect
  | MarkerEffectTemplate
  | TheEconomyEffect
  | ReactiveProcEffect
  | ReactiveEconomyEffect

// --- Runtime shapes (Buff.effects) ---

export interface DotEffect {
  type: 'dot'
  damagePerTurn?: number
  damagePerSecond?: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export type BuffEffect =
  | StatModifierEffect
  | DotEffect
  | CcEffect
  | OnHitProcEffect
  | GaugeDeltaEffect
  | ReactiveTriggerEffect
  | DotRecoveryEffect
  | MarkerEffectTemplate
  | TheEconomyEffect
  | ReactiveProcEffect
  | ReactiveEconomyEffect

export interface BuffDefinition {
  id: string
  name: string
  description?: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  /**
   * The Tu Reimagined (plan v2.4 review P0) — 'fixed_holder_turns' makes
   * `duration` the literal count of the HOLDER's own turns, skipping both
   * the target's ailmentResistPercent and the source's
   * ailmentDurationPercent multipliers in BuffSystem.apply (a caster's
   * own resist shrinking their own Bat Tu is nonsense). Default/omitted
   * keeps the legacy 'ailment_scaled' formula — debuffs like khiem_khich
   * stay scaled since enemy resist legitimately shortens them.
   */
  durationPolicy?: 'ailment_scaled' | 'fixed_holder_turns'
  /**
   * The Tu Reimagined (plan Task 10/11) — apply() removes ALL existing
   * instances of this id regardless of source before adding the new one.
   * Newest application wins by construction (Taunt newest-wins,
   * son_nhac_ho_the single-owner marker).
   */
  uniquePerTarget?: boolean
  /**
   * The Tu Reimagined (plan Task 9, D10 Ba The) — applying this def
   * strips every cc-effect buff already in the TARGET's pool
   * (BuffPool.clearCcEffects). Honored by the appliesBuffs resolution
   * and the survive-lethal grant path.
   */
  clearsCcOnApply?: boolean
  maxStacks?: number
  stackMode: BuffStackMode

  convertsToId?: string
  convertsAfterContinuousTurns?: number
  convertsAfterContinuousSeconds?: number

  effects: BuffEffectTemplate[]
}

export interface Buff {
  id: string
  sourceId: string
  targetId: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  remainingTurns: number
  remainingTime?: number
  stacks: number
  maxStacks?: number
  stackMode: BuffStackMode

  continuousTurns?: number
  continuousSeconds?: number
  convertsToId?: string
  convertsAfterContinuousTurns?: number
  convertsAfterContinuousSeconds?: number

  effects: BuffEffect[]
}

export interface BuffDefinitionCatalog {
  get(id: string): BuffDefinition
}
