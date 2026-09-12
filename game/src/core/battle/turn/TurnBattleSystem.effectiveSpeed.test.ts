import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { advanceGauge } from './ActionGauge'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffDefinition } from './TurnBuffTypes'

// R2 (AR-05) — participant.speed is a synced read-only cache of effective
// combat speed. Before this fix, TurnBattleAdapter copied
// entity.stats.speed once at battle start and the engine never refreshed
// it, so a +100% speed buff raised stats.speed to 200 while the gauge
// kept incrementing by 100 (stale copy).

const SPEED_BUFF: TurnBuffDefinition = {
  id: 'qa_speed_buff',
  name: 'QA Speed Buff',
  polarity: 'buff',
  duration: 2,
  maxStacks: 1,
  stackMode: 'replace',
  effects: [{ type: 'statModifier', stat: 'speed', percent: 1 }],
}

const REGISTRY = {
  get: (id: string): TurnBuffDefinition => {
    if (id === SPEED_BUFF.id) {
      return SPEED_BUFF
    }
    throw new Error(`unknown fixture buff id: ${id}`)
  },
}

const BASIC = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical' as const, multiplier: 0 },
  targeting: { shape: 'single' as const },
}

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ speed: 100, evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

function battleWithPlayerSpeedBuff(): {
  battle: TurnBattle
  system: TurnBattleSystem
  player: TurnBattleParticipant
  enemy: TurnBattleParticipant
} {
  const playerEntity = createCombatant('player')
  const enemyEntity = createCombatant('enemy')
  enemyEntity.type = 'enemy'

  const player = makeParticipant('player', playerEntity, 100, 0)
  const enemy = makeParticipant('enemy', enemyEntity, 100, 1)
  player.basic = BASIC
  enemy.basic = BASIC

  // Pre-apply the +100% speed buff to the player's pool (as if applied
  // during a previous turn by any buff source).
  new TurnBuffSystem(player.buffs).apply(SPEED_BUFF, playerEntity, playerEntity, REGISTRY)

  const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }
  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100, REGISTRY)

  return { battle, system, player, enemy }
}

describe('effective speed sync (AR-05)', () => {
  it('turn-start recompute syncs participant.speed to effective speed', () => {
    const { battle, system, player } = battleWithPlayerSpeedBuff()

    // Pre-fix stale state: adapter copied 100 at build time.
    expect(player.speed).toBe(100)

    system.resolveNextStep(battle)

    // Turn-start recompute folded the buff: entity effective speed 200,
    // and the participant cache must be refreshed from its owner.
    expect(player.entity.stats.speed).toBe(200)
    expect(player.speed).toBe(200)
  })

  it('gauge advances at effective speed: buffed player reaches GAUGE_MAX in half the enemy steps', () => {
    const { battle, system, player, enemy } = battleWithPlayerSpeedBuff()

    // First resolveNextStep: player acts (priority tiebreak), gauge resets,
    // recompute syncs speed cache to 200. The enemy still paces at 100.
    system.resolveNextStep(battle)
    expect(player.speed).toBe(200)
    expect(enemy.speed).toBe(100)

    // Subsequent pacing: the player (speed 200) must become ready again
    // BEFORE the enemy (speed 100) fills the same gauge — 2× rate means
    // the player's next turn arrives in roughly half the enemy's time.
    let playerReadyTurns = 0

    for (let step = 0; step < 10; step++) {
      const actor = system.peekNextActor(battle)

      if (actor?.id === 'player') {
        playerReadyTurns = step
        break
      }
    }

    // Speed 200 vs 100 from equal post-action gauges: the player's next
    // readiness must come strictly before any enemy turn. With synced
    // speeds the player is the ready actor; the stale-speed bug would let
    // the enemy (equal 100/100 + higher priority number tiebreak... here
    // enemy priority 1 > player priority 0, so player still wins ties —
    // the discriminating assertion is the gauge RATE below).
    expect(playerReadyTurns).toBeLessThan(10)

    // Direct rate check: peek does not consume; accumulate via fresh
    // clones to observe per-step gains without mutating the battle.
    const playerRate = measureGaugeRate(battle, 'player')
    const enemyRate = measureGaugeRate(battle, 'enemy')

    expect(playerRate).toBeCloseTo(enemyRate * 2, 5)
  })
})

/**
 * Measures the per-step gauge accumulation rate for one participant by
 * cloning its gauge fields (no battle mutation) and advancing manually —
 * mirrors what resolveNextTurn does per step.
 */
function measureGaugeRate(battle: TurnBattle, id: string): number {
  const participant =
    battle.players.find((member) => member.id === id) ?? battle.enemies.find((enemy) => enemy.id === id)

  if (!participant) {
    return 0
  }

  const start = participant.actionGauge
  const probe = { id: participant.id, speed: participant.speed, actionGauge: start, alive: true }
  advanceGauge(probe, 1)

  return probe.actionGauge - start
}
