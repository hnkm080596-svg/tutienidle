// SkillExecutor.testkit.ts -- shared M3 harness: a REAL CombatScheduler +
// CombatOperationExecutor over fake CombatAuthorityPorts mutating fake
// state. The executor drives real barrier semantics (enqueue -> run ->
// trace); the fake authorities simulate settlement-time side effects
// (dead-target skips, apply-then-reaction-consume) and report scripted
// hit-channel outcomes (landed/crit) for 'skill_hit' payloads.

import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
  CombatOperationId,
  SkillId,
} from '../battle/contracts/ids'
import type { CombatRng } from '../battle/contracts/rng'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type {
  ApplyBuffResult,
  CleanseResult,
  CombatOperationResult,
  ConsumeStacksResult,
  RemoveBuffResult,
} from '../battle/contracts/results'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type {
  CombatAuthorityPorts,
  BuffAuthority,
} from '../battle/runtime/scheduler/CombatAuthorityPorts'
import {
  CombatOperationExecutor,
  CombatOperationSkip,
} from '../battle/runtime/scheduler/CombatOperationExecutor'
import { CombatScheduler } from '../battle/runtime/scheduler/CombatScheduler'

import type { SkillQueryPorts } from './SkillQueryPorts'
import type { SkillCastCommitPort } from './SkillCastCommitPort'
import type { ResolvedSkillPlan } from './ResolvedSkillPlan'
import type { ActiveSkillDefinition } from './SkillDefinition'
import { SkillDefinitionRegistry } from './SkillDefinitionRegistry'
import { SkillResolver } from './SkillResolver'
import { SkillExecutor } from './SkillExecutor'

// ---------------------------------------------------------------------------
// Fake state
// ---------------------------------------------------------------------------

export interface FakeBuff {
  instanceId: BuffInstanceId
  definitionId: BuffDefinitionId
  targetId: CombatEntityId
  sourceId: CombatEntityId
  kind: 'buff' | 'debuff' | 'ailment' | 'marker'
  stacks: number
  hasPeriodic: boolean
  dispellable: boolean
  /** detonate-parity fields (default: remaining 0, mults 1, no
      damage periodics). */
  remainingTurns?: number
  periodicDamageMult?: number
  potencyMult?: number
  damagePeriodics?: readonly {
    periodicId: string
    coefficient: number
    element: 'fire' | 'physical'
    tags?: readonly string[]
  }[]
}

export interface FakeDamageScript {
  /** 'skill_hit' channel: false = the authority dodged the hit. */
  landed?: boolean
  crit?: boolean
  /** hpDamage override (default coefficient * 10). */
  hpDamage?: number
}

interface HarnessOptions {
  defs?: readonly ActiveSkillDefinition[]
  /** scripted hit outcomes consumed in order for 'skill_hit' ops. */
  damageScript?: readonly FakeDamageScript[]
  /** applies run through this hook AFTER the buff instance lands --
      simulates settlement-time reaction consumption (contract sec.94). */
  onBuffApplied?: (inst: FakeBuff) => void
  /** applies consult this hook FIRST: returning 'resist' yields
      {applied:false} with no minted instance and no onBuffApplied --
      the resisted-application lane (Hoa An spec sec.11). */
  applyHook?: (
    req: Parameters<BuffAuthority['apply']>[0],
  ) => 'resist' | undefined
  rng?: CombatRng
}

export interface SkillExecutorHarness {
  state: {
    buffs: FakeBuff[]
    hp: Map<CombatEntityId, { hp: number; max: number }>
    alive: Set<CombatEntityId>
    resources: Map<string, number>
    /** executed op order log (payload target + type). */
    executedOps: ResolvedCombatOperation[]
    /** commits routed through SkillCastCommitPort (cadence owner spy). */
    commits: ResolvedSkillPlan[]
    instanceSeq: number
  }
  scheduler: CombatScheduler
  queries: SkillQueryPorts
  commitPort: SkillCastCommitPort
  registry: SkillDefinitionRegistry
  resolver: SkillResolver
  executor: SkillExecutor
  rng: CombatRng
}

const resourceKey = (id: CombatEntityId, resourceId: string) =>
  `${id}|${resourceId}`

export function makeHarness(options: HarnessOptions = {}): SkillExecutorHarness {
  const buffs: FakeBuff[] = []
  const hp = new Map<CombatEntityId, { hp: number; max: number }>()
  const alive = new Set<CombatEntityId>()
  const resources = new Map<string, number>()
  const executedOps: ResolvedCombatOperation[] = []
  const commits: ResolvedSkillPlan[] = []
  const damageScript = [...(options.damageScript ?? [])]
  let instanceSeq = 0

  const isAlive = (id: CombatEntityId) => alive.has(id)
  const requireAlive = (id: CombatEntityId) => {
    if (!isAlive(id)) {
      throw new CombatOperationSkip('invalid_target_state')
    }
  }

  const findInstance = (sel: BuffInstanceSelector): FakeBuff | undefined => {
    switch (sel.kind) {
      case 'instance':
        return buffs.find((b) => b.instanceId === sel.instanceId)
      case 'identity':
        return buffs.find(
          (b) =>
            b.definitionId === sel.definitionId &&
            b.sourceId === sel.sourceId &&
            b.targetId === sel.targetId,
        )
      case 'target_definition':
        return buffs.find(
          (b) => b.targetId === sel.targetId && b.definitionId === sel.definitionId,
        )
    }
  }

  const buffAuthority: BuffAuthority = {
    apply(req) {
      requireAlive(req.targetId)
      if (options.applyHook?.(req) === 'resist') {
        return { applied: false }
      }
      const inst: FakeBuff = {
        instanceId: `buff.${instanceSeq++}` as BuffInstanceId,
        definitionId: req.definitionId,
        targetId: req.targetId,
        sourceId: req.sourceId,
        kind: 'buff',
        stacks: req.stacks,
        hasPeriodic: false,
        dispellable: true,
      }
      buffs.push(inst)
      options.onBuffApplied?.(inst)
      const result: ApplyBuffResult = {
        applied: true,
        instanceId: inst.instanceId,
        created: true,
        stacksAfter: inst.stacks,
      }
      return result
    },
    addStacks(sel, stacks) {
      const inst = findInstance(sel)
      if (inst === undefined) throw new CombatOperationSkip('invalid_target_state')
      const before = inst.stacks
      inst.stacks += stacks
      return { stacksBefore: before, stacksAfter: inst.stacks }
    },
    removeStacks(sel, stacks) {
      const inst = findInstance(sel)
      if (inst === undefined) throw new CombatOperationSkip('invalid_target_state')
      const before = inst.stacks
      inst.stacks = Math.max(0, inst.stacks - stacks)
      return { stacksBefore: before, stacksAfter: inst.stacks }
    },
    consumeStacks(sel, stacks) {
      const inst = findInstance(sel)
      if (inst === undefined) throw new CombatOperationSkip('invalid_target_state')
      const consumed = stacks === 'all' ? inst.stacks : Math.min(stacks, inst.stacks)
      inst.stacks -= consumed
      let removed = false
      if (inst.stacks <= 0) {
        buffs.splice(buffs.indexOf(inst), 1)
        removed = true
      }
      const result: ConsumeStacksResult = {
        consumed,
        remaining: inst.stacks,
        removed,
      }
      return result
    },
    addModifier: () => ({ applied: true }),
    removeModifier: () => ({ removed: true, removedRuntimeIds: [] }),
    refreshDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
    extendDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
    triggerPeriodic: () => ({ started: false, candidateUnitCount: 0 }),
    remove(sel) {
      const inst = findInstance(sel)
      if (inst === undefined) return { removed: false }
      buffs.splice(buffs.indexOf(inst), 1)
      const result: RemoveBuffResult = {
        removed: true,
        instanceId: inst.instanceId,
        stacksAtRemoval: inst.stacks,
      }
      return result
    },
    setStacks(sel, stacks) {
      const inst = findInstance(sel)
      if (inst === undefined) throw new CombatOperationSkip('invalid_target_state')
      const before = inst.stacks
      inst.stacks = stacks
      return { stacksBefore: before, stacksAfter: stacks }
    },
    setRemainingDuration: () => ({ durationBefore: 0, durationAfter: 0 }),
    cleanse(targetId, query, limit) {
      requireAlive(targetId)
      const matching = buffs.filter(
        (b) =>
          b.targetId === targetId &&
          (query.definitionId === undefined || b.definitionId === query.definitionId) &&
          (query.kind === undefined || b.kind === query.kind) &&
          (query.polarity === undefined ||
            (query.polarity === 'buff' ? b.kind === 'buff' : b.kind !== 'buff')),
      )
      const dispellable = matching.filter((b) => b.dispellable)
      const skipped = matching.filter((b) => !b.dispellable)
      const taken = limit === undefined ? dispellable : dispellable.slice(0, limit)
      for (const inst of taken) buffs.splice(buffs.indexOf(inst), 1)
      const result: CleanseResult = {
        cleansed: taken.map((b) => b.instanceId),
        skipped: skipped.map((b) => b.instanceId),
      }
      return result
    },
  }

  const ports: CombatAuthorityPorts = {
    buffs: buffAuthority,
    damage: {
      dealDamage(payload) {
        requireAlive(payload.targetId)
        const scripted =
          payload.damageProfile === 'skill_hit' ? damageScript.shift() : undefined
        const landed = scripted?.landed ?? true
        const hpDamage = landed ? (scripted?.hpDamage ?? payload.coefficient * 10) : 0
        const vit = hp.get(payload.targetId)
        let killed = false
        if (landed && vit !== undefined) {
          vit.hp -= hpDamage
          if (vit.hp <= 0) {
            vit.hp = 0
            alive.delete(payload.targetId)
            killed = true
          }
        }
        return {
          rawDamage: hpDamage,
          hpDamage,
          killed,
          landed,
          crit: scripted?.crit ?? false,
        }
      },
    },
    heal: {
      heal(payload) {
        requireAlive(payload.targetId)
        const vit = hp.get(payload.targetId)
        const healed =
          vit === undefined
            ? payload.amount
            : Math.min(payload.amount, vit.max - vit.hp)
        if (vit !== undefined) vit.hp += healed
        return { requested: payload.amount, healed, after: vit?.hp ?? healed }
      },
    },
    resource: {
      gain(targetId, resourceId, amount) {
        const key = resourceKey(targetId, resourceId)
        const before = resources.get(key) ?? 0
        resources.set(key, before + amount)
        return { before, requested: amount, applied: amount, after: before + amount }
      },
      consume(targetId, resourceId, amount) {
        const key = resourceKey(targetId, resourceId)
        const before = resources.get(key) ?? 0
        const applied = amount === 'all' ? before : Math.min(amount, before)
        resources.set(key, before - applied)
        return { before, requested: amount, applied, after: before - applied }
      },
    },
    gauge: {
      pushGauge(targetId, fractionOfMax) {
        return {
          before: 0,
          requestedDelta: fractionOfMax,
          appliedDelta: fractionOfMax,
          after: fractionOfMax,
        }
      },
    },
    shield: {
      applyShield: (targetId, amount) => ({ applied: amount, shieldAfter: amount }),
    },
  }

  const opExecutor = new (class extends CombatOperationExecutor {
    override execute(
      op: ResolvedCombatOperation,
      ctx: Parameters<CombatOperationExecutor['execute']>[1],
    ): CombatOperationResult {
      executedOps.push(op)
      return super.execute(op, ctx)
    }
  })(ports)
  const scheduler = new CombatScheduler(opExecutor, {
    preconditions: { isAlive },
  })

  const queries: SkillQueryPorts = {
    buffs: {
      stacksOf: (definitionId, sourceId, targetId) =>
        buffs
          .filter(
            (b) =>
              b.definitionId === definitionId &&
              b.targetId === targetId &&
              (sourceId === undefined || b.sourceId === sourceId),
          )
          .reduce((sum, b) => sum + b.stacks, 0),
      durationOf: (definitionId, targetId) =>
        buffs.some(
          (b) => b.definitionId === definitionId && b.targetId === targetId,
        )
          ? 3
          : 0,
      has: (sel) => findInstance(sel) !== undefined,
      listInstances: (targetId) =>
        buffs
          .filter((b) => b.targetId === targetId)
          .map((b) => ({
            instanceId: b.instanceId,
            definitionId: b.definitionId,
            sourceId: b.sourceId,
            kind: b.kind,
            stacks: b.stacks,
            hasPeriodic: b.hasPeriodic,
            remainingTurns: b.remainingTurns ?? 0,
            periodicDamageMult: b.periodicDamageMult ?? 1,
            potencyMult: b.potencyMult ?? 1,
            damagePeriodics: b.damagePeriodics ?? [],
          })),
    },
    vitals: {
      alive: isAlive,
      hp: (id) => hp.get(id)?.hp ?? 0,
      hpMax: (id) => hp.get(id)?.max ?? 0,
      hpPercent: (id) => {
        const vit = hp.get(id)
        return vit === undefined || vit.max === 0 ? 0 : vit.hp / vit.max
      },
    },
    resources: {
      current: (id, resourceId) => resources.get(resourceKey(id, resourceId)) ?? 0,
      max: () => 100,
    },
    opResults: {
      lastOpResult: (operationId: CombatOperationId) =>
        [...scheduler.trace.records]
          .reverse()
          .find((r) => r.operation.operationId === operationId)?.result,
    },
  }

  const commitPort: SkillCastCommitPort = {
    commit: (plan) => {
      commits.push(plan)
    },
  }

  const registry = new SkillDefinitionRegistry(options.defs ?? [], {
    isBuffDefinitionId: () => true,
  })
  const rng: CombatRng = options.rng ?? { roll: () => 0.5, rollChance: () => false }
  const resolver = new SkillResolver(registry, rng)
  const executor = new SkillExecutor(
    scheduler,
    resolver,
    registry,
    queries,
    commitPort,
    rng,
  )

  return {
    state: { buffs, hp, alive, resources, executedOps, commits, instanceSeq: 0 },
    scheduler,
    queries,
    commitPort,
    registry,
    resolver,
    executor,
    rng,
  }
}

/** Registers an entity in the fake world. */
export function spawn(
  harness: SkillExecutorHarness,
  id: CombatEntityId,
  vitals: { hp: number; max?: number } = { hp: 100 },
): void {
  harness.state.hp.set(id, { hp: vitals.hp, max: vitals.max ?? vitals.hp })
  harness.state.alive.add(id)
}

/** Directly seeds a buff instance (pre-cast state for consume/detonate
    lanes). */
export function seedBuff(
  harness: SkillExecutorHarness,
  buff: Omit<FakeBuff, 'instanceId'> & { instanceId?: BuffInstanceId },
): FakeBuff {
  const inst: FakeBuff = {
    ...buff,
    instanceId:
      buff.instanceId ??
      (`buff.seed.${harness.state.instanceSeq++}` as BuffInstanceId),
  }
  harness.state.buffs.push(inst)
  return inst
}

export function setResource(
  harness: SkillExecutorHarness,
  id: CombatEntityId,
  resourceId: string,
  amount: number,
): void {
  harness.state.resources.set(`${id}|${resourceId}`, amount)
}

export const PLAYER = 'entity.player' as CombatEntityId
export const ENEMY_A = 'entity.enemy.a' as CombatEntityId
export const ENEMY_B = 'entity.enemy.b' as CombatEntityId
export const ALLY = 'entity.ally' as CombatEntityId

export const BASE_DEF: ActiveSkillDefinition = {
  kind: 'active',
  id: 'skill.test' as SkillId,
  name: 'Test Skill',
  targetIntent: 'primary_target',
  cadence: { cooldownTurns: 2 },
  operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 2 }],
}

export function makeDef(overrides: Partial<ActiveSkillDefinition>): ActiveSkillDefinition {
  return { ...BASE_DEF, ...overrides }
}

export const PROGRESSION = {
  skillId: 'skill.test' as SkillId,
  level: 3,
  experience: 0,
  totalExperience: 10,
}

export function makeInput(
  def: ActiveSkillDefinition,
  overrides: Partial<Parameters<SkillResolver['resolve']>[0]> = {},
): Parameters<SkillResolver['resolve']>[0] {
  return {
    definition: def,
    sourceId: PLAYER,
    declaredTargetIds: [ENEMY_A],
    progression: PROGRESSION,
    sourceStats: { scalar: () => 0 },
    entityQuery: {
      currentThe: () => 0,
      currentMp: () => 50,
      alive: (id) => true,
      enemiesOf: () => [ENEMY_A, ENEMY_B],
      alliesOf: () => [PLAYER, ALLY],
    },
    castId: 'cast.1',
    rootActionId: 'action.turn.1.0',
    subcastIndex: 0,
    ...overrides,
  }
}
