import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { buffs as LIVE_BUFFS } from '../../../data/buff/buffs'
import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { BuffDefinitionId, CombatEntityId } from '../contracts/ids'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import {
  PHAN_CHAN_BASE_RATIO,
  PHAN_CHAN_BUFF,
  PHAN_CHAN_MARKED_RATIO,
} from '../../../data/buff/TheTuBuffs'
import { buildTheTuKit } from '../../../data/skill/TheTuSkills'
import { collectBodyKitModifiers } from '../../the-tu/TheTuKitModifiers'
import { createDefaultPlayer } from '../../player/Player'
import type { ProgressionNode } from '../../progression/ProgressionNode'

// The Tu beta (the-tu-body-pathway-design, Phan Chan) - on a TAKEN
// hostile hit (hpDamage > 0 from an eligible 'normal'/'skill' action)
// the holder reflects holder.maxHp x baseRatio back at the attacker as
// a terminal 'reflection' op - never a hit/crit roll, never a window on
// the attacker side, max ONE per hostile action (multi-hit settles
// first), marked attackers take the higher marked ratio. DoT /
// environmental / self-inflicted / reactive damage never triggers.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity

  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
} as const

function makeTank(id: string, overrides: Parameters<typeof createBaseStats>[0] = {}): CombatEntity {
  return createCombatant({
    id,
    type: 'player',
    stats: createBaseStats({ ...NO_MITIGATION, might: 0, ...overrides }),
    currentHp: 10_000,
    maxHp: 10_000,
  })
}

function makeAttacker(id: string, overrides: Parameters<typeof createBaseStats>[0] = {}): CombatEntity {
  return createCombatant({
    id,
    stats: createBaseStats({ ...NO_MITIGATION, might: 100, ...overrides }),
    currentHp: 10_000,
    maxHp: 10_000,
  })
}

// Self-scope noop with NO damage - a x0 physical hit would still floor
// to 1 damage ("toi thieu 1" in resolveAttack) and pollute the deltas.
const NOOP_PLAYER_BASIC = {
  id: 'tank_noop',
  cooldownTurns: 0,
  targetScope: 'self',
  targeting: { shape: 'single' },
} as const

function makeBattle(
  tank: CombatEntity,
  attacker: CombatEntity,
  registry: BuffRegistry = BUFF_REGISTRY,
  attackerBasic: Partial<TurnSkillDefinition> = {},
): {
  battle: TurnBattle
  tankP: TurnBattleParticipant
  attackerP: TurnBattleParticipant
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  const tankP = makeParticipant(tank.id, tank, 10, 0)
  tankP.basic = { ...NOOP_PLAYER_BASIC }

  const attackerP = makeParticipant(attacker.id, attacker, 9, 100)
  attackerP.basic = { ...makeAttackerBasic(), ...attackerBasic }

  const battle: TurnBattle = { players: [tankP], enemies: [attackerP], state: 'fighting' }
  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry,
    participants: () => [...battle.players, ...battle.enemies],
    combatSystem: combat,
  })

  return { battle, tankP, attackerP, combat, runtime }
}

function makeAttackerBasic() {
  return {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  } as const
}

function applyPhanChan(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant): void {
  runtime.applyBuff(PHAN_CHAN_BUFF.id, participant)
}

function systemOf(w: { combat: CombatSystem; runtime: TurnRuntimeFixture }): TurnBattleSystem {
  return new TurnBattleSystem(w.combat, 10, w.runtime.registry, undefined, w.runtime)
}

describe('phan_chan reflect (Max-HP ratio, once-per-action)', () => {
  it('taken hit -> reflect lands at holder maxHp x base ratio', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    expect(10_000 - attacker.currentHp).toBeCloseTo(10_000 * PHAN_CHAN_BASE_RATIO)
    expect(attacker.alive).toBe(true)
    // The reflect is NOT a fraction of the incoming hit.
    expect(10_000 - attacker.currentHp).not.toBeCloseTo(100)
  })

  it('Chấn Ấn-marked attacker reflects at the higher marked ratio', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)
    // The mark is source-scoped: chan_an applied BY the holder.
    f.runtime.applyBuff('chan_an', f.attackerP, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    expect(10_000 - attacker.currentHp).toBeCloseTo(10_000 * PHAN_CHAN_MARKED_RATIO)
  })

  it('a chan_an mark from a DIFFERENT source does not raise the ratio', () => {
    const tank = makeTank('tank')
    const other = makeTank('other')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)
    const otherP = makeParticipant(other.id, other, 8, 50)
    otherP.basic = { ...NOOP_PLAYER_BASIC }
    f.battle.players.push(otherP)
    f.runtime.applyBuff('chan_an', f.attackerP, otherP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    expect(10_000 - attacker.currentHp).toBeCloseTo(10_000 * PHAN_CHAN_BASE_RATIO)
  })

  it('multi-hit action -> exactly ONE reflect (hits settle first)', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker, BUFF_REGISTRY, {
      instances: { count: 3 },
    })
    applyPhanChan(f.runtime, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    // 3 hits landed (300 total incoming) -> ONE reflect event.
    expect(10_000 - tank.currentHp).toBeCloseTo(300)
    expect(10_000 - attacker.currentHp).toBeCloseTo(10_000 * PHAN_CHAN_BASE_RATIO)
  })

  it('AoE hostile action that hpDamages the holder triggers the reflect', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker, BUFF_REGISTRY, {
      targeting: { shape: 'all_lanes' },
    })
    applyPhanChan(f.runtime, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    expect(10_000 - attacker.currentHp).toBeCloseTo(10_000 * PHAN_CHAN_BASE_RATIO)
  })

  it('one AoE action into TWO phan_chan holders flushes exactly one reflect per holder', () => {
    const tankA = makeTank('tank_a')
    const tankB = makeTank('tank_b')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tankA, attacker, BUFF_REGISTRY, {
      targeting: { shape: 'all_lanes' },
    })

    const tankBP = makeParticipant(tankB.id, tankB, 10, 0)
    tankBP.basic = { ...NOOP_PLAYER_BASIC }
    f.battle.players.push(tankBP)

    applyPhanChan(f.runtime, f.tankP)
    applyPhanChan(f.runtime, tankBP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)
    // Both tanks (speed 10) act before the attacker (speed 9).
    system.resolveNextStep(f.battle)

    // Per-holder reflect: 2 x (holder maxHp x base ratio) -- the
    // once-per-action cap binds per holder, not per action.
    expect(10_000 - attacker.currentHp).toBeCloseTo(2 * (10_000 * PHAN_CHAN_BASE_RATIO))
  })

  it('a non-natural hostile hit (counter payload) never queues a reflect (INV-9)', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    f.attackerP.reactivePayloads = { enemy_hit: { ...makeAttackerBasic() } }
    f.battle.queuedFollowUps = [
      {
        actorId: 'enemy',
        executionKind: 'reactive_bypass',
        actionSource: 'counter',
        payloadSkillId: 'enemy_hit',
        targetIds: ['tank'],
      },
    ]

    const tankHpBefore = tank.currentHp
    const system = systemOf(f)
    system.resolveNextStep(f.battle)

    // The hostile hit landed (the taken window genuinely opened)...
    expect(tank.currentHp).toBeLessThan(tankHpBefore)
    // ...but the bypass-source action feeds no reflect.
    expect(attacker.currentHp).toBe(10_000)
  })

  it('dodged hit -> no reflection', () => {
    // Hit chance floors at 5% (Accuracy.ts) - force the roll high so the
    // dodge is deterministic rather than stat-absurd.
    const tank = makeTank('tank', { evasionRate: 1_000_000 })
    const attacker = makeAttacker('enemy', { accuracyRating: 0 })
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      const system = systemOf(f)
      system.resolveNextStep(f.battle)
      system.resolveNextStep(f.battle)
    } finally {
      random.mockRestore()
    }

    expect(tank.currentHp).toBe(10_000)
    expect(attacker.currentHp).toBe(10_000)
  })

  it('fully ward-absorbed hit -> no reflection (hpDamage = 0 is not taken)', () => {
    const tank = makeTank('tank')
    tank.currentWard = 100_000
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    expect(tank.currentHp).toBe(10_000)
    expect(attacker.currentHp).toBe(10_000)
  })

  it('post-mortem: a holder killed by the triggering hit still reflects (queued at hit time)', () => {
    const tank = makeTank('tank')
    tank.currentHp = 1 // the hostile hit is lethal
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    expect(tank.alive).toBe(false)
    expect(10_000 - attacker.currentHp).toBeCloseTo(10_000 * PHAN_CHAN_BASE_RATIO)
  })

  it('reflect can kill through the vitals authority', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    attacker.currentHp = 10 // reflect (300) exceeds this
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    expect(attacker.alive).toBe(false)
    expect(f.battle.state).toBe('victory')
  })

  it('terminal event: attacker-side phan_chan does NOT reflect the reflection back', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)
    applyPhanChan(f.runtime, f.attackerP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    // Attacker took exactly ONE reflection; if its own phan_chan fired
    // back the tank would have lost hpDamage > the original 100.
    expect(10_000 - attacker.currentHp).toBeCloseTo(10_000 * PHAN_CHAN_BASE_RATIO)
    expect(10_000 - tank.currentHp).toBe(100)
  })

  it('node-adjusted clone (collectBodyKitModifiers) raises base + marked ratios', () => {
    const node: ProgressionNode = {
      id: 'tt_reflect_1',
      name: 'reflect',
      type: 'minor',
      insightCost: 1,
      effect: {
        bodyKitModifiers: {
          reflectMaxHpRatioBonus: 0.01,
          reflectMarkedRatioBonus: 0.02,
        },
      },
    }
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_reflect_1: 1 }

    const mods = collectBodyKitModifiers({ getAll: () => [node] }, player)
    const kit = buildTheTuKit('tran_the', mods, { special: true })
    const passiveBuff = kit.special?.grantsBuffsAtBuild?.find((def) => def.id === 'phan_chan')
    expect(passiveBuff).toBeDefined()

    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    // The kit-clone seam: the node-adjusted passive def replaces the
    // base under its own id in the battle-local registry.
    const registry = makeTestBuffRegistry(
      LIVE_BUFFS.map((def) => (def.id === 'phan_chan' ? passiveBuff! : def)),
    )
    const f = makeBattle(tank, attacker, registry)
    applyPhanChan(f.runtime, f.tankP)
    f.runtime.applyBuff('chan_an', f.attackerP, f.tankP)

    const system = systemOf(f)
    system.resolveNextStep(f.battle)
    system.resolveNextStep(f.battle)

    const expected = 10_000 * (PHAN_CHAN_MARKED_RATIO + 0.02)
    expect(10_000 - attacker.currentHp).toBeCloseTo(expected)
  })
})


describe('suppressed-reflect coverage pins (cleanC INT)', () => {
  it('queued reflect skipped when the attacker is dead at flush time', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    // Queue the reflect the way the hit lane does, then kill the
    // attacker before the action tail flushes.
    f.runtime.procs.rollReactiveTrigger(
      tank.id as CombatEntityId, 'onImpactLanded',
      { attacker, hpDamage: 100, reflectsEligible: true }, 'root.test.1')
    attacker.alive = false
    f.attackerP.alive = false

    f.runtime.procs.flushReflects()

    expect(attacker.currentHp).toBe(10_000)
  })

  it('residue from an aborted action is discarded, never attributed to the next action', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const f = makeBattle(tank, attacker)
    applyPhanChan(f.runtime, f.tankP)

    f.runtime.procs.rollReactiveTrigger(
      tank.id as CombatEntityId, 'onImpactLanded',
      { attacker, hpDamage: 100, reflectsEligible: true }, 'root.test.1')

    // Entry discard mirrors TBS applyActionImpact pre-queue discard.
    f.runtime.procs.discardPendingReflects()
    f.runtime.procs.flushReflects()

    expect(attacker.currentHp).toBe(10_000)
  })

  it('INV-9 hoist: reflectsEligible:false suppresses EVERY reactive outcome (buff grant + follow-up), not just reflects', () => {
    const REACTIVE_APPLY: BuffDefinition = {
      id: 'qa_reactive_apply' as BuffDefinitionId,
      name: 'QA reactive apply',
      kind: 'buff',
      instanceScope: 'per_target',
      stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
      lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
      capabilities: [
        {
          id: 'qa_reactive_apply.cap',
          type: 'reactive_trigger',
          payload: { trigger: 'onImpactLanded', chance: 1, appliesDefinitionId: 'qa_marker', queuesFollowUp: true },
        },
      ],
      dispellable: true,
    }
    const MARKER: BuffDefinition = {
      id: 'qa_marker' as BuffDefinitionId,
      name: 'QA marker',
      kind: 'buff',
      instanceScope: 'per_target',
      stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
      lifetime: { clock: 'holder_turns', duration: 2, scaling: 'fixed' },
      capabilities: [],
      dispellable: true,
    }
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const registry = makeTestBuffRegistry([...LIVE_BUFFS, REACTIVE_APPLY, MARKER])
    const f = makeBattle(tank, attacker, registry)
    f.runtime.applyBuff('qa_reactive_apply', f.tankP)

    const { firedFollowUp } = f.runtime.procs.rollReactiveTrigger(
      tank.id as CombatEntityId, 'onImpactLanded',
      { attacker, hpDamage: 100, reflectsEligible: false }, 'root.test.2')

    expect(firedFollowUp).toBe(false)
    expect(f.runtime.buffs.getForTarget(tank.id as CombatEntityId).some((i) => i.definitionId === 'qa_marker')).toBe(false)
  })

  it('onCastBegin queued follow-up is honored (not silently dropped)', () => {
    const CAST_FOLLOW: BuffDefinition = {
      id: 'qa_cast_follow' as BuffDefinitionId,
      name: 'QA cast follow',
      kind: 'buff',
      instanceScope: 'per_target',
      stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
      lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
      capabilities: [
        {
          id: 'qa_cast_follow.cap',
          type: 'reactive_trigger',
          payload: { trigger: 'onCastBegin', chance: 1, queuesFollowUp: true },
        },
      ],
      dispellable: true,
    }
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const registry = makeTestBuffRegistry([...LIVE_BUFFS, CAST_FOLLOW])
    const f = makeBattle(tank, attacker, registry)
    f.runtime.applyBuff('qa_cast_follow', f.tankP)

    const system = systemOf(f)
    // Tank's action (speed 10 > 9): onCastBegin fires inside its
    // resolution and queues the holder's bypass follow-up.
    system.resolveNextStep(f.battle)

    expect(f.battle.queuedFollowUps?.map((e) => e.actorId)).toEqual(['tank'])
  })
})
