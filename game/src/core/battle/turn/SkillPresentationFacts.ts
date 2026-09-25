import type { CombatVfxPresetId } from '../CombatAction'
import type { BuffInstanceId, CombatOperationId } from '../contracts/ids'
import type { ResolvedCombatOperation } from '../contracts/operations'
import type { CombatOperationResult } from '../contracts/results'
import type { ResolvedSkillPlan } from '../../skilldef/ResolvedSkillPlan'
import type { TurnBattleParticipant, TurnDeclaredAction } from './TurnBattleSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { executionCommitsCast } from './TurnSkillAction'
import { entityGridPosition } from '../BattleGrid'

export type PlaybackRef = Readonly<{ sessionId: number; requestId: string; token: string }>
export type ActorAnchorFact = Readonly<{ entityId: string; row: number; column: number }>
export type CastDisposition =
  'action' | 'charge-start' | 'charge-tick' | 'charge-release' | 'blocked' | 'empty'
export type SkillCastPresentation = Readonly<{
  ref: PlaybackRef
  rootSkillId: string
  resolvedSkillId: string
  presetId: CombatVfxPresetId
  source: ActorAnchorFact
  declaredTargets: readonly ActorAnchorFact[]
  candidateInstanceCount: number
  disposition: CastDisposition
}>
type OutcomeIdentity = Readonly<{
  outcomeId: string
  operationId?: CombatOperationId
  castId?: string
  rootActionId?: string
  subcastIndex?: number
}>
export type SkillPresentationOutcome = OutcomeIdentity &
  (
    | Readonly<{
        kind: 'hit'
        target: ActorAnchorFact
        hitOrdinal: number
        landed: boolean
        crit: boolean
        hpDamage: number
        killed: boolean
      }>
    | Readonly<{ kind: 'heal'; target: ActorAnchorFact; healed: number }>
    | Readonly<{
        kind: 'status'
        target: ActorAnchorFact
        instanceId?: BuffInstanceId
        action: 'apply' | 'remove'
        applied?: boolean
        removed?: boolean
      }>
    | Readonly<{ kind: 'skipped'; target?: ActorAnchorFact; reason: string }>
    | Readonly<{ kind: 'no-effect'; reason: string }>
  )
export type PresentationFootprint =
  | Readonly<{ kind: 'cells'; cells: readonly Readonly<{ row: number; column: number }>[] }>
  | Readonly<{ kind: 'entity-targets'; entityIds: readonly string[] }>
  | Readonly<{ kind: 'none' }>
export type ResolvedPresentationGroup = Readonly<{
  groupId: string
  role: 'primary' | 'composite' | 'combo'
  resolvedSkillId: string
  presetId: CombatVfxPresetId
  source: ActorAnchorFact
  actualTargets: readonly ActorAnchorFact[]
  footprint: PresentationFootprint
  outcomes: readonly SkillPresentationOutcome[]
}>
export type SkillPresentationResolved = Readonly<{
  ref: PlaybackRef
  groups: readonly ResolvedPresentationGroup[]
  sealed: true
}>

/** Copies plain facts only; runtime entities and closures never cross this boundary. */
export function freezePresentation<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezePresentation(child)
    Object.freeze(value)
  }
  return value
}
export function actorAnchor(participant: TurnBattleParticipant): ActorAnchorFact {
  return { entityId: participant.id, ...entityGridPosition(participant.entity) }
}
export function declaredPresentationSkill(
  declared: TurnDeclaredAction,
): TurnSkillDefinition | null {
  return (
    (declared.isCharging && declared.chargeResolved
      ? declared.chargedSkill
      : (declared.execution?.resolvedSkill ?? declared.action?.skill)) ?? null
  )
}
export function castDisposition(declared: TurnDeclaredAction): CastDisposition {
  if (declared.ccBlocked) return 'blocked'
  if (declared.isCharging) return declared.chargeResolved ? 'charge-release' : 'charge-tick'
  if ((declared.action?.skill?.chargeTurns ?? 0) > 0 && executionCommitsCast(declared.execution))
    return 'charge-start'
  return declared.action && declared.affected.length > 0 ? 'action' : 'empty'
}
export function buildSkillCastPresentation(
  ref: PlaybackRef,
  actor: TurnBattleParticipant,
  declared: TurnDeclaredAction,
): SkillCastPresentation {
  const skill = declaredPresentationSkill(declared)
  return freezePresentation({
    ref: { ...ref },
    rootSkillId: declared.execution?.rootSkillId ?? declared.skillId,
    resolvedSkillId: skill?.id ?? declared.skillId,
    presetId: skill?.presetId ?? 'arcane_impact',
    source: actorAnchor(actor),
    declaredTargets: declared.affected.map(actorAnchor),
    candidateInstanceCount: skill?.instances?.count ?? 1,
    disposition: castDisposition(declared),
  })
}
export function presentationGroup(
  actor: TurnBattleParticipant,
  skill: TurnSkillDefinition | null,
  role: ResolvedPresentationGroup['role'] = 'primary',
): ResolvedPresentationGroup {
  return {
    groupId: '',
    role,
    resolvedSkillId: skill?.id ?? 'none',
    presetId: skill?.presetId ?? 'arcane_impact',
    source: actorAnchor(actor),
    actualTargets: [],
    footprint: { kind: 'none' },
    outcomes: [],
  }
}
export function withGroupOutcomes(
  group: ResolvedPresentationGroup,
  outcomes: readonly SkillPresentationOutcome[],
): ResolvedPresentationGroup {
  const targets = new Map<string, ActorAnchorFact>()
  for (const outcome of outcomes)
    if ('target' in outcome && outcome.target) targets.set(outcome.target.entityId, outcome.target)
  const actualTargets = [...targets.values()]
  const damageCells = new Map<string, Readonly<{ row: number; column: number }>>()
  for (const outcome of outcomes) {
    if (outcome.kind === 'hit') {
      const { row, column } = outcome.target
      damageCells.set(`${row}:${column}`, { row, column })
    }
  }
  const footprint: PresentationFootprint =
    damageCells.size > 0
      ? { kind: 'cells', cells: [...damageCells.values()] }
      : actualTargets.length > 0
        ? { kind: 'entity-targets', entityIds: actualTargets.map((t) => t.entityId) }
        : { kind: 'none' }
  return { ...group, actualTargets, outcomes, footprint }
}
export function sealSkillPresentation(
  ref: PlaybackRef,
  groups: readonly ResolvedPresentationGroup[],
): SkillPresentationResolved {
  return freezePresentation({
    ref: { ...ref },
    sealed: true as const,
    groups: groups.map((group, index) => {
      const groupId = `${ref.requestId}:group:${index}`
      return {
        ...group,
        groupId,
        outcomes: group.outcomes.map((outcome, ordinal) => ({
          ...outcome,
          outcomeId: `${groupId}:outcome:${ordinal}`,
        })),
      }
    }),
  })
}

/** Session-local projection of executor hooks, excluding unrelated scheduler consequences. */
export class PlanPresentationCollector {
  private readonly selectedBuffs = new Map<
    CombatOperationId,
    { target: ActorAnchorFact; instanceId: BuffInstanceId }
  >()
  private readonly groups = new Map<
    string,
    { group: ResolvedPresentationGroup; outcomes: SkillPresentationOutcome[] }
  >()
  constructor(
    private readonly actor: TurnBattleParticipant,
    private readonly definitions: readonly TurnSkillDefinition[],
    private readonly participant: (id: string) => TurnBattleParticipant | undefined,
    private readonly role: 'primary' | 'combo',
  ) {}
  private entry(plan: ResolvedSkillPlan) {
    const key = `${plan.castId}:${plan.subcastIndex}`
    let entry = this.groups.get(key)
    if (!entry) {
      const id = plan.snapshot.compositePicks?.[0] ?? plan.resolvedVariantId ?? plan.definitionId
      const skill = this.definitions.find((def) => def.id === id)
      entry = {
        group: {
          ...presentationGroup(
            this.actor,
            skill ?? null,
            plan.subcastIndex === 0 ? this.role : 'composite',
          ),
          resolvedSkillId: id,
        },
        outcomes: [],
      }
      this.groups.set(key, entry)
    }
    return entry
  }
  register(plan: ResolvedSkillPlan): void {
    this.entry(plan)
  }
  captureSelectedBuff(
    operationId: CombatOperationId,
    targetId: string,
    instanceId: BuffInstanceId,
  ): void {
    const participant = this.participant(targetId)
    if (participant)
      this.selectedBuffs.set(operationId, { target: actorAnchor(participant), instanceId })
  }
  settle(
    operation: ResolvedCombatOperation,
    result: CombatOperationResult,
    plan: ResolvedSkillPlan,
  ): void {
    const entry = this.entry(plan)
    const id = {
      outcomeId: '',
      operationId: operation.operationId,
      castId: plan.castId,
      rootActionId: plan.rootActionId,
      subcastIndex: plan.subcastIndex,
    }
    const selected = this.selectedBuffs.get(operation.operationId)
    this.selectedBuffs.delete(operation.operationId)
    const targetId =
      'targetId' in operation.payload
        ? operation.payload.targetId
        : 'selector' in operation.payload && 'targetId' in operation.payload.selector
          ? operation.payload.selector.targetId
          : undefined
    const participant = typeof targetId === 'string' ? this.participant(targetId) : undefined
    const target = participant ? actorAnchor(participant) : selected?.target
    if (result.status === 'skipped') {
      entry.outcomes.push({
        ...id,
        kind: 'skipped',
        target,
        reason: result.reason ?? 'operation-skipped',
      })
    } else if (result.type === 'deal_damage' && result.damage && target) {
      entry.outcomes.push({
        ...id,
        kind: 'hit',
        target,
        hitOrdinal: entry.outcomes.filter((o) => o.kind === 'hit').length,
        landed: result.damage.landed !== false,
        crit: result.damage.crit ?? false,
        hpDamage: result.damage.hpDamage,
        killed: result.damage.killed,
      })
    } else if (result.type === 'heal' && result.result && target) {
      entry.outcomes.push({ ...id, kind: 'heal', target, healed: result.result.healed })
    } else if (result.type === 'apply_buff' && result.result && target) {
      entry.outcomes.push({
        ...id,
        kind: 'status',
        target,
        action: 'apply',
        applied: result.result.applied,
        instanceId: result.result.instanceId,
      })
    } else if (result.type === 'remove_buff' && result.result && target) {
      entry.outcomes.push({
        ...id,
        kind: 'status',
        target,
        action: 'remove',
        removed: result.result.removed,
        instanceId: result.result.instanceId,
      })
    } else if (result.type === 'consume_buff_stacks' && result.result && target && selected) {
      entry.outcomes.push({
        ...id,
        kind: 'status',
        target,
        action: 'remove',
        removed: result.result.removed,
        instanceId: selected.instanceId,
      })
    } else if (result.type === 'cleanse_buff' && result.result && target) {
      for (const instanceId of result.result.cleansed)
        entry.outcomes.push({
          ...id,
          kind: 'status',
          target,
          action: 'remove',
          removed: true,
          instanceId,
        })
    }
  }
  finish(reason: string): readonly ResolvedPresentationGroup[] {
    return [...this.groups.values()].map(({ group, outcomes }) =>
      withGroupOutcomes(
        group,
        outcomes.length ? outcomes : [{ outcomeId: '', kind: 'no-effect', reason }],
      ),
    )
  }
}
