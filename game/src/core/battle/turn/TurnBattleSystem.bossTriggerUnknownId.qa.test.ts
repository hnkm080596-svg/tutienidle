import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import { TurnBuffPool } from './TurnBuffPool'

// QA reproduction (Phase A2 adversarial quick, 2026-09-07):
// TurnBattleSystem's boss-trigger block calls registry.get() unguarded.
// The registry contract (MapTurnBuffRegistry.get) THROWS on unknown ids,
// and an unknown bossTrigger buffDefinitionId becomes reachable with real
// data as of Phase A2 (any future/renamed enrage buff id in enemy data
// crashes every fixed-step tick from the moment the trigger fires, with
// no error isolation at any upstream caller in GameManager's
// updateBattleFixedStep loop).
//
// Expected after the eventual production fix: the tick skips the buff
// gracefully (mirror of the GameManager.ts formation-buff try/catch
// pattern), the battle keeps running, firedAlready stays false so a
// corrected id could still fire later — and, critically, resolveNextStep
// does NOT throw.
//
// This test intentionally FAILS against current code (throw propagates),
// proving the defect is real, per the QA evidence gate.

function createCombatant(id: string): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id,
    name: id,
    type: 'enemy',
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
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

// No-op skill: no damage, no targets — nothing outside the boss-trigger
// block can throw, so any unexpected exception in resolveNextStep traces
// back to the trigger lookup itself.
const BASIC: { id: string; cooldownTurns: number; damage: { kind: 'physical'; multiplier: number }; targeting: { shape: 'single' } } = {
  id: 'qa_noop_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
}

const OTHER_DEFINITION: TurnBuffDefinition = {
  id: 'unrelated_buff',
  name: 'Unrelated Buff',
  polarity: 'buff',
  duration: 5,
  stackMode: 'refresh',
  effects: [],
}

class SingleEntryRegistry implements TurnBuffRegistry {
  constructor(private readonly definition: TurnBuffDefinition) {}

  get(id: string): TurnBuffDefinition {
    if (id !== this.definition.id) {
      throw new Error(`TurnBuffRegistry: unknown buff id "${id}"`)
    }

    return this.definition
  }
}

describe('QA — TurnBattleSystem boss trigger vs unknown buff id (Phase A2 quick)', () => {
  it('resolveNextStep does not throw when the bossTrigger buff id is missing from the registry', () => {
    const player = createCombatant('player')
    const enemyEntity = createCombatant('enemy')

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    // The enemy acts on turn 2 (player priority 0 acts first); with
    // afterTurns: 1 the trigger is ready by then.
    enemyParticipant.bossTrigger = { afterTurns: 1, buffDefinitionId: 'buff_id_not_in_registry', firedAlready: false }
    // Give BOTH sides the no-op basic skill; the enemy actor must reach
    // the trigger block inside declareActorAction (its own turn), so it
    // needs a selectable action too.
    enemyParticipant.basic = BASIC

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    battle.players[0]!.basic = BASIC

    const registry: TurnBuffRegistry = new SingleEntryRegistry(OTHER_DEFINITION)
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    // Turn 1 resolves the player (no bossTrigger — block skipped).
    // Turn 2 resolves the enemy: reaches the boss-trigger block inside
    // declareActorAction, where the unguarded registry.get() throws.
    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(() => system.resolveNextStep(battle)).not.toThrow()

    expect(enemyParticipant.bossTrigger?.firedAlready).toBe(false)
    expect(battle.state).toBe('fighting')
  })
})
