// BuffDefinition.ts -- spec sec.6-9, sec.11, sec.17-20, sec.22, sec.42,
// sec.44, sec.47. Immutable authored data: the registry deep-freezes every
// definition at load. NO `effects` union -- each legacy effect kind has a
// spec-shaped home (statModifiers/controls/periodic) or a capability grant.
//
// Migration mapping (megaplan M1 step 4):
//   stackMode:'stack'    -> stacking{onReapplyStacks:'add', onReapplyDuration:'refresh'}
//                          (+convertsAtStackCap when convertsToId present)
//   stackMode:'refresh'  -> stacking{onReapplyStacks:'keep', onReapplyDuration:'refresh'}
//   stackMode:'replace'  -> stacking{onReapplyStacks:'replace', onReapplyDuration:'refresh',
//                          replaceInstanceOnReapply:true}
//   uniquePerTarget      -> instanceScope:'per_target' + sourceOwnership:'latest' +
//                          stacking{onReapplyStacks:'replace', onReapplyDuration:'refresh'}
//   durationPolicy       -> lifetime.scaling ('ailment_scaled'/'fixed_holder_turns'->'fixed')
//   turn-ticked duration -> lifetime.clock:'holder_turns'; wall-clock -> 'seconds'
//   cc                   -> controls[];  statModifier -> statModifiers[];
//   dot                  -> periodic[{type:'damage', timing:'holder_turn_end',
//                          scaling:'dynamic', stackScaling:'multiply',
//                          damageProfile:'legacy_dot', canCrit:false, canMiss:false,
//                          hitCount:1}] (+tags:['armor_ignore_by_realm'] when set)
//   onHitProc/reactive*/theEconomy/gaugeDelta/dotRecovery/marker -> capabilities[]

import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { CapabilityGrantDefinition } from '../battle/contracts/capability'
import type { ElementType } from '../element/ElementType'
import type { StatType } from '../stats/StatTypes'
import type { StatDomain } from '../stats/StatDomain'

export type BuffKind = 'buff' | 'debuff' | 'ailment' | 'marker' // spec sec.6 -- no 'stance'
export type BuffInstanceScope = 'per_source' | 'per_target' // spec sec.7 -- no 'all'
export type BuffSourceOwnership = 'latest' | 'first' // per_target reapply policy (spec sec.7)

// spec sec.9 -- stacks and duration are INDEPENDENT axes (Hoa An = add + refresh)
export interface BuffStackingDefinition {
  maxStacks: number // >= 1 (registry-validated; legacy uncapped stackers get an authored cap per census)
  onReapplyStacks: 'add' | 'replace' | 'keep'
  onReapplyDuration: 'refresh' | 'keep' | 'extend'
  replaceInstanceOnReapply?: boolean // legacy stackMode:'replace' parity -- default false keeps instanceId stable
}

// spec sec.17-20 -- duration amount / clock / scaling are three INDEPENDENT concepts
export type BuffLifetimeClock = 'holder_turns' | 'source_turns' | 'rounds' | 'seconds' | 'permanent'
export type BuffDurationScaling = 'fixed' | 'ailment_scaled'
export interface BuffLifetimeDefinition {
  clock: BuffLifetimeClock
  duration?: number // required unless clock==='permanent' (validated); absent for permanent
  scaling: BuffDurationScaling
  removeOnSourceDeath?: boolean // default false -- spec sec.41
}

// spec sec.11 -- whether target resistance gates the application roll
export interface BuffApplicationDefinition {
  resistance: 'none' | 'ailment'
  clampChance?: boolean // default true -> clamp [0,1]
}

// spec sec.22 -- periodic recipe. DamageSystem owns the combat formula via
// damageProfile; the def carries everything the contract request needs.
export interface PeriodicDamageDefinition {
  id: string
  type: 'damage'
  element: ElementType | 'physical'
  damageProfile: string // DamageProfileId -- profile owns stats/mitigation/crit channel
  coefficient: number // authored scalar (legacy `dpsRatio` -> this field)
  scaling: 'dynamic' | 'snapshot' // spec sec.24/25
  snapshotFields?: readonly string[] // REQUIRED iff scaling==='snapshot' -- authored selection within the profile's snapshot schema
  timing: 'holder_turn_start' | 'holder_turn_end' | 'source_turn_start' | 'source_turn_end' | 'interval'
  intervalSeconds?: number // REQUIRED iff timing==='interval' (validated)
  stackScaling: 'multiply' | 'ignore'
  canCrit: boolean
  canMiss: boolean
  hitCount: number
  tags?: readonly string[] // forwarded to the request (e.g. 'armor_ignore_by_realm')
}
export interface PeriodicHealDefinition {
  id: string
  type: 'heal'
  amount: number // flat authored amount
  timing: 'holder_turn_start' | 'holder_turn_end' | 'source_turn_start' | 'source_turn_end' | 'interval'
  intervalSeconds?: number
  stackScaling: 'multiply' | 'ignore'
  tags?: readonly string[]
}
export type BuffPeriodicDefinition = PeriodicDamageDefinition | PeriodicHealDefinition
// Union extends ONLY when real gameplay needs it -- no catch-all callback (spec sec.22).

export interface BuffStatModifierDefinition {
  stat: StatType
  percent?: number
  flat?: number
  domain?: StatDomain
}
export interface BuffControlDefinition {
  type: 'stun' | 'freeze' | 'root'
}

export interface BuffDefinition {
  // spec sec.6 -- all fields readonly; registry freezes at load
  id: BuffDefinitionId
  name: string
  description?: string
  kind: BuffKind
  polarity?: 'buff' | 'debuff' // StatModifier.sourceType feed -- default: buff->'buff', debuff/ailment->'debuff', marker->'buff' unless declared
  element?: ElementType // canonical element tag (today's `element` field)
  hidden?: boolean
  instanceScope: BuffInstanceScope
  sourceOwnership?: BuffSourceOwnership // per_target only; default 'latest'
  stacking: BuffStackingDefinition
  lifetime: BuffLifetimeDefinition
  application?: BuffApplicationDefinition
  periodic?: readonly BuffPeriodicDefinition[]
  statModifiers?: readonly BuffStatModifierDefinition[]
  controls?: readonly BuffControlDefinition[]
  capabilities?: readonly CapabilityGrantDefinition[] // contract type -- generic grants, owner-validated payloads
  forbiddenActionTags?: readonly string[] // contract sec.6 -- Cam Cong channel
  dispellable: boolean // spec sec.42 -- cleanse() gate
  tags?: readonly string[]
  // Phap Tu Reimagined (spec D10) -- window-bound markers: when the
  // SOURCE entity no longer holds an instance of this definition, the
  // instance dies at the next runPhaseB liveness sweep ('expired').
  boundToSourceBuffId?: BuffDefinitionId
  // legacy-parity lifecycle fields (not in spec sec.6 -- documented deviations)
  clearsCcOnApply?: boolean // strips target's control instances before own apply commits
  convertsToId?: BuffDefinitionId
  convertsAfterContinuousTurns?: number
  convertsAfterContinuousSeconds?: number
  convertsAtStackCap?: boolean // legacy: stack-mode reapply reaching maxStacks converts instead
}
