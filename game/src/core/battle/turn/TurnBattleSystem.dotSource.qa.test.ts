import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { dotRecoveryTriggers } from '../../combat/DotRecovery'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { CombatEntity } from '../../combat/CombatEntity'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// AR-06 QA Probes:
// Turn DoT resolves its source context through the buff2 authority: the
// periodic request carries the instance's sourceId and the damage adapter
// feeds the source's live capability grants into
// CombatSystem.applyDotDamage (elemental penetration + dotRecoveryTriggers
// poison-recovery hook, stat-system-reimagined Task 4 / D18).

const POISON_BUFF: BuffDefinition = {
  id: 'qa_poison',
  name: 'QA Poison',
  kind: 'debuff',
  polarity: 'debuff',
  element: 'wood',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
  periodic: [
    {
      id: 'qa_poison.tick',
      type: 'damage',
      element: 'wood',
      damageProfile: 'legacy_dot',
      coefficient: 1,
      scaling: 'dynamic',
      timing: 'holder_turn_end',
      stackScaling: 'multiply',
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    },
  ],
  dispellable: true,
}

// Doc Can-shaped authored recovery trigger (Task 4 / D18): the SOURCE
// heals for a fraction of the wood DoT damage it dealt, per stack.
const RECOVERY_BUFF: BuffDefinition = {
  id: 'qa_recovery',
  name: 'QA Recovery',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
  capabilities: [
    { id: 'qa_recovery.dot_recovery', type: 'dot_recovery', payload: { element: 'wood', healPercent: 0.25 } },
  ],
  dispellable: true,
}

const REGISTRY = makeTestBuffRegistry([POISON_BUFF, RECOVERY_BUFF])

function makeRuntimeFor(participants: () => TurnBattleParticipant[], combat: CombatSystem): TurnRuntimeFixture {
  return makeTurnRuntime({ registry: REGISTRY, participants, combatSystem: combat })
}

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, ...overrides.stats })
  const entity = {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity

  // ARCH-002 (M7 R1): refreshParticipantStats reconciles entity.maxHp from
  // entity.stats.maxHp and clamps currentHp — the fixture's declared vitals
  // ceiling must exist in the resolved/base stats or refresh reverts it.
  entity.baseStats = (overrides.baseStats ?? overrides.stats ?? entity.baseStats) as CombatEntity['baseStats']
  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    
    consecutiveHardCcTurns: 0,
  }
}

describe('AR-06: Turn DoT source context', () => {
  it('supplies living source to DoT tick; source with no recovery buff heals nothing', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    // Player is the source of the poison, with missing HP, and holds no
    // dotRecovery buff — the trigger query returns 0, so the source can
    // only lose HP (the enemy's own counterattack), never gain it.
    const player = makeEntity('player', {
      currentHp: 500,
      maxHp: 1000,
      stats: createBaseStats({ speed: 10 }),
    })

    // Enemy has poison applied and is faster (speed 100 vs 10).
    const enemy = makeEntity('enemy', {
      currentHp: 10_000,
      maxHp: 10_000,
      stats: createBaseStats({ speed: 100 }),
    })

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)
    const runtime = makeRuntimeFor(() => [playerP, enemyP], combat)
    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    runtime.applyBuff('qa_poison', enemyP, playerP)

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const hpBefore = player.currentHp

    // Resolve enemy turn: enemy ticks poison -> takes DoT damage.
    system.resolveNextStep(battle)

    expect(dotRecoveryTriggers(player, 'wood', runtime.buffs.getCapabilities(player.id))).toBe(0)
    expect(player.currentHp).toBeLessThanOrEqual(hpBefore)
    expect(enemy.currentHp).toBeLessThan(10_000)
  })

  it('resolveSourceBuffs wiring: a dotRecovery buff on the source heals it during the target tick', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const healEvents: { targetId?: string; value?: number }[] = []
    eventBus.on('heal', (event) => healEvents.push(event as typeof healEvents[number]))

    const player = makeEntity('player', {
      currentHp: 500,
      maxHp: 1000,
      stats: createBaseStats({ speed: 10, woodPower: 10 }),
    })

    const enemy = makeEntity('enemy', {
      currentHp: 10_000,
      maxHp: 10_000,
      stats: createBaseStats({ speed: 100 }),
    })

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)
    const runtime = makeRuntimeFor(() => [playerP, enemyP], combat)
    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    // Doc Can is a self-buff on the SOURCE; the poison sits on the
    // enemy. Recovery must cross instance boundary via sourceGrants.
    runtime.applyBuff('qa_recovery', playerP)
    runtime.applyBuff('qa_poison', enemyP, playerP)

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    system.resolveNextStep(battle)

    // woodPower 10 + might 10 = 20 raw -> recovery 1 stack * 0.25 = 5
    // healed, unamplified (healingEffectivenessPercent 0). The heal is
    // asserted via its event so the enemy's counterattack can't blur it.
    expect(healEvents).toContainEqual(
      expect.objectContaining({ targetId: 'player', value: 5 }),
    )
  })

  it('handles dead or missing source safely without throwing', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const player = makeEntity('player', {
      currentHp: 0,
      alive: false,
    })
    const enemy = makeEntity('enemy', {
      currentHp: 10_000,
      maxHp: 10_000,
    })

    const playerP = makeParticipant('player', player, 0)
    playerP.alive = false
    const enemyP = makeParticipant('enemy', enemy, 1)
    const runtime = makeRuntimeFor(() => [playerP, enemyP], combat)
    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    runtime.applyBuff('qa_poison', enemyP, playerP)

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    // Must not throw when ticking DoT with dead source.
    expect(() => system.resolveNextStep(battle)).not.toThrow()
  })
})
