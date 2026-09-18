// skilldef/SkillDefinition.ts -- spec sec.4-6 discriminated union;
// immutable authored intent (R6 state layer 1).
//
// ActiveSkillDefinition is implemented + production-used this program.
// PassiveSkillDefinition is schema + validation ONLY -- PassiveSystem
// remains the passive runtime (R-S7): passives do NOT inherit active
// fields (spec: "Khong ep passive vao schema active voi hang loat field
// vo nghia").

import type { CombatVfxPresetId } from '../battle/CombatAction'
import type { SkillId } from '../battle/contracts/ids'
import type { CultivationPathId, PathWayId } from '../player/CultivationPathKit'
import type { SkillResourceType } from '../skill/SkillTypes'

import type {
  AuthoredSkillOperation,
  LandedSemantics,
  SkillCondition,
  SkillTargetIntent,
} from './AuthoredOperation'
import type { ScalarExpression } from './ScalarExpression'

// ---------------------------------------------------------------------------
// Requirements -- authored gates (realm/path/way/node/skill). Evaluated by
// progression/orchestration before the def reaches combat; the resolver
// and executor never see them.
// ---------------------------------------------------------------------------

export type SkillRequirement =
  | { kind: 'realm'; realmId: string; minLevel?: number }
  | { kind: 'path'; pathId: CultivationPathId }
  | { kind: 'way'; pathId: CultivationPathId; wayId: PathWayId }
  | { kind: 'node'; nodeId: string; minLevel?: number }
  | { kind: 'skill'; skillId: SkillId; minLevel?: number }

// ---------------------------------------------------------------------------
// Balance metadata -- authored-presentation classification
// (unreleased/buildTag parity with the legacy Skill surface). Never
// gameplay-affecting.
// ---------------------------------------------------------------------------

export interface SkillBalanceMetadata {
  /** UI grouping tag -- legacy `buildTag` parity. */
  buildTag?: 'core' | 'dot' | 'burst' | 'ult'
  /** Content flag: catalogued but not production-usable. */
  unreleased?: boolean
}

// ---------------------------------------------------------------------------
// Passive triggers (spec sec.53) -- semantic combat events. Schema only;
// PassiveSystem stays the passive runtime (R-S7).
// ---------------------------------------------------------------------------

export interface PassiveTriggerDefinition {
  event:
    | 'skill_landed'
    | 'damage_taken'
    | 'damage_dealt'
    | 'ailment_applied'
    | 'ailment_tick'
    | 'evade'
    | 'turn_start'
    | 'turn_end'
  condition?: SkillCondition
  /** trigger-local cadence, in TURNS (R8: no seconds). */
  cooldown?: number
  /** 0..1 -- deterministic CombatRng roll at fire time. */
  procChance?: number
}

// ---------------------------------------------------------------------------
// Active definition fragments (megaplan v2.1 locked shapes).
// ---------------------------------------------------------------------------

/** Cast cost -- 'none' for basics (cooldown only), 'mana' for specials,
    'the' gates The Tu ultimates. */
export interface SkillCastCost {
  resourceType: SkillResourceType
  amount: number
}

/** Replaces multicast/repeatCasts/compositePicks -- each subcast is a
    SEPARATE sequential ResolvedSkillPlan (R-S1). */
export interface SkillSubcasts {
  /** fixed repeats (repeatCasts parity) */
  count?: number
  multicast?: { chance: number; maxExtraCasts: number }
  /** element_basic parity: pick compositeCount defs, resolve picks[0] */
  compositePool?: readonly SkillId[]
  compositeCount?: number
}

/** Replaces empowerment + specialization-selected payloads. */
export interface SkillVariants {
  empowerment?: {
    theThreshold: number
    empoweredSkillId: SkillId
  }
}

/** theGainOnLandedCast / theGainOnCrit parity -- The economy grants. */
export interface SkillGrants {
  theOnLandedCast?: number
  theOnCrit?: number
}

/** R-S8: DECLARATIVE per-instance hit options (replaces the runtime
    perInstanceOptions closure). `each` fields stamp as contract-v1.6
    policies onto every instance's DealDamageOperation payload;
    `each.execute` compiles to a per-instance branch{hp_percent_below}
    folding damageMultiplier into coefficient. */
export interface SkillInstances {
  /** may query player state (Ngu Kiem Dao kiemDaoCount) */
  count: ScalarExpression
  each?: {
    /** phi kiem never miss -> hitPolicy.guaranteedHit */
    guaranteedHit?: boolean
    /** live-target hp% at EXECUTE -> execute-branch coefficient fold */
    execute?: { hpPercentBelow: ScalarExpression; damageMultiplier: number }
    /** DamageAuthority rolls per hit (contract v1.6) -> critPolicy */
    critChance?: number
    /** one authority roll: bypass, else mitigation x (1-fraction)
        -> armorPolicy{bypassChance, pierceFractionOnFail} */
    armorPierce?: { bypassChance: number; pierceFraction: number }
  }
}

// ---------------------------------------------------------------------------
// The union.
// ---------------------------------------------------------------------------

export interface ActiveSkillDefinition {
  kind: 'active'
  id: SkillId
  name: string
  /** authored selector -- never runtime ids; 'enemy'/'ally' do NOT exist
      (use 'primary_target'/'affected_targets'/etc.). */
  targetIntent: SkillTargetIntent
  /** Cam Cong's tag taxonomy ('attack'|'heal'|'buff'|'cleanse'|'defend'|
      'utility' -- free-form strings, reaction plan R-E2 upgrade path). */
  actionTags?: readonly string[]
  /** R8: turn units are the ONLY combat-authoritative cadence. */
  cadence: { cooldownTurns: number; chargeTurns?: number }
  cost?: SkillCastCost
  /** consumesAllThe parity (Task 13): the resolved payload burns the
      ENTIRE The pool at CAST_COMMIT, after the cost op. Lives on the
      def that carries it (the empowered form; a root-level flag burns
      on its own commit). theBurned captures pre-burn into the
      snapshot for theScaling. */
  consumesAllThe?: boolean
  /** ordered; every operation step settles before the next plan step
      (contract sec.55). Empty ONLY for composite-shell defs whose entire
      payload rides subcasts.compositePool. */
  operations: readonly AuthoredSkillOperation[]
  subcasts?: SkillSubcasts
  variants?: SkillVariants
  /** override; default = R-S2 landed semantics. */
  landed?: LandedSemantics
  grants?: SkillGrants
  /** vfx only -- never gameplay. */
  presentation?: { presetId?: CombatVfxPresetId }
  counterable?: boolean
  counterSkillId?: SkillId | null
  emblemOnly?: boolean
  theScaling?: { coeff: number }
  instances?: SkillInstances
  /** R-S5/R-S8 tier-C surface -- fields the adapter could NOT express as
      canonical semantics. NOT gameplay data: presence marks the def as
      partially-migrated; the report channel stays loud
      (collectUnsupportedSkillSemantics parity). */
  adapterUnsupportedMetadata?: readonly string[]
}

export interface PassiveSkillDefinition {
  kind: 'passive'
  id: SkillId
  name: string
  /** spec sec.53 semantic combat events. */
  triggers: readonly PassiveTriggerDefinition[]
  /** shared authored op vocabulary (spec sec.6 `effects` -> `operations`). */
  operations: readonly AuthoredSkillOperation[]
  requirements?: readonly SkillRequirement[]
  presentation?: { presetId?: CombatVfxPresetId }
  balance?: SkillBalanceMetadata
  adapterUnsupportedMetadata?: readonly string[]
}

export type SkillDefinition = ActiveSkillDefinition | PassiveSkillDefinition
