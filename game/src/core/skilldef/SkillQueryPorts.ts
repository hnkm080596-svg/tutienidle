// skilldef/SkillQueryPorts.ts -- R-S3 v2: synchronous READONLY read
// ports the executor uses BETWEEN settlement barriers. Command and query
// surfaces stay SEPARATE: CombatAuthorityPorts are mutation ports (every
// method takes CombatAuthorityExecutionContext); reads NEVER route
// through them. Composition root wires each port to its owning domain --
// one domain authority != one interface for every use.

import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
  CombatOperationId,
} from '../battle/contracts/ids'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type { CombatOperationResult } from '../battle/contracts/results'

/** Buff reads -- backed by the existing BuffReadPort (buff2/BuffQuery.ts)
    at composition root. */
export interface SkillBuffQuery {
  /** summed live stacks for (definitionId, targetId), optionally
      filtered to one source (undefined = any source --
      target_definition parity). */
  stacksOf(
    definitionId: BuffDefinitionId,
    sourceId: CombatEntityId | undefined,
    targetId: CombatEntityId,
  ): number
  /** remaining duration of the target's instance of the def (0 when
      absent). */
  durationOf(definitionId: BuffDefinitionId, targetId: CombatEntityId): number
  has(selector: BuffInstanceSelector): boolean
  /** per-instance enumeration in canonical sortedForTarget order --
      the for_each_instance filter surface (detonate periodicOnly etc.). */
  listInstances(targetId: CombatEntityId): readonly SkillBuffInstanceSummary[]
}

export interface SkillBuffInstanceSummary {
  instanceId: BuffInstanceId
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  kind: 'buff' | 'debuff' | 'ailment' | 'marker'
  stacks: number
  /** the def carries periodic/dot effects (detonate lane). */
  hasPeriodic: boolean
}

/** Entity vitals reads -- backed by the vitals/entity read at
    composition root. */
export interface SkillVitalsQuery {
  alive(id: CombatEntityId): boolean
  hp(id: CombatEntityId): number
  hpMax(id: CombatEntityId): number
  hpPercent(id: CombatEntityId): number
}

/** Resource reads -- backed by the resource owner (The/MP/ward/gauge
    domains) at composition root. */
export interface SkillResourceQuery {
  current(id: CombatEntityId, resourceId: string): number
  max(id: CombatEntityId, resourceId: string): number
}

/** Op-result reads -- backed by the scheduler trace
    (fractionOfPriorDamage heals, consume-for-damage gates). */
export interface SkillOpResultQuery {
  lastOpResult(operationId: CombatOperationId): CombatOperationResult | undefined
}

export interface SkillQueryPorts {
  buffs: SkillBuffQuery
  vitals: SkillVitalsQuery
  resources: SkillResourceQuery
  opResults: SkillOpResultQuery
}
