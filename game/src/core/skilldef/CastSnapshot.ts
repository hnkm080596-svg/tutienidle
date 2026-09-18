// skilldef/CastSnapshot.ts -- spec sec.24-27: the per-cast frozen context
// (R6 state layer 4). Minted at RESOLVE, frozen for the plan's lifetime:
// composite picks roll ONCE here, the empowered The-burn captures BEFORE
// the consume op zeroes the pool, and stat scalars freeze so a mid-plan
// stat change cannot retroactively alter authored formulas.

import type { CombatEntityId, SkillId } from '../battle/contracts/ids'

import type { SkillProgressionState } from './SkillProgressionState'
import type { SkillCombatRuntimeState } from './SkillCombatRuntimeState'

export interface CastSnapshot {
  /** minted per committed cast */
  castId: string
  rootActionId: string
  sourceId: CombatEntityId
  /** the AUTHORED def id (the cast's identity) -- not the variant */
  definitionId: SkillId
  /** empowered def id when the variant swap fired */
  resolvedVariantId?: SkillId
  /** composite pool picks rolled ONCE at RESOLVE (picks[0] = this plan's
      payload def; picks[1..] drive follow-up subcast plans) */
  compositePicks?: readonly SkillId[]
  /** pre-consume capture -- {the: burnedAmount} for consumesAllThe
      empowered casts (spec sec.26; theScaling reads the SNAPSHOT, never
      the live pool). */
  resourcesConsumed: Readonly<Record<string, number>>
  /** frozen scalar inputs -- attributeScaling stat values, manaScaling
      base (maxMp), realmIndex, skill_level, and every stat_scalar query
      key the definition's expressions reference. */
  statScalars: Readonly<Record<string, number>>
  declaredTargetIds: readonly CombatEntityId[]
}

// ---------------------------------------------------------------------------
// Resolver input ports (readonly, synchronous -- RESOLVE-time reads only).
// ---------------------------------------------------------------------------

/** Stat/scalar reads for snapshot capture. Implementations bridge combat
    stats (might/defense/maxMp/realmIndex), progression-derived scalars
    (castLeveledSkillLevel, huyKiemFlatDamageBonus), and live player state
    (kiemDaoCount) through one keyed channel -- the resolver captures only
    the keys the definition actually references. */
export interface StatReadPort {
  scalar(sourceId: CombatEntityId, key: string): number
}

/** Entity reads the resolver needs for variant checks + target-set
    resolution. Roster accessors return STABLE participant order
    (battle roster order -- never set-iteration). */
export interface SkillResolveEntityQuery {
  currentThe(id: CombatEntityId): number
  currentMp(id: CombatEntityId): number
  alive(id: CombatEntityId): boolean
  enemiesOf(sourceId: CombatEntityId): readonly CombatEntityId[]
  alliesOf(sourceId: CombatEntityId): readonly CombatEntityId[]
}

/** Reactive-context ids -- 'attacker' intent binding for reactive casts;
    absent on normal casts (attacker-scoped ops resolve to empty). */
export interface SkillResolveContextIds {
  attackerId?: CombatEntityId
}
