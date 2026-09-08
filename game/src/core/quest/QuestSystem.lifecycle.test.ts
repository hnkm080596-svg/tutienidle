// R8.1 (AR-09) - quest activation lifecycle: activation is a lifecycle
// COMMAND (reconcileActiveQuests), queries are purely observational.
// Normal gameplay (kills/collects) must count without ever opening
// QuestPanel.
import { describe, expect, it } from 'vitest'
import { QuestSystem } from './QuestSystem'
import { QuestRegistry } from './QuestRegistry'
import { QuestManager } from './QuestManager'
import type { Quest } from './Quest'
import type { PlayerData } from '../player/Player'

const ONCE_QUEST: Quest = {
  id: 'quest_once_a',
  name: 'Once quest',
  description: '',
  condition: { kind: 'collect', materialId: 'linh_chi', amount: 5 },
  reward: {},
  cadence: 'once',
}

const DAILY_QUEST: Quest = {
  id: 'quest_daily_b',
  name: 'Daily quest',
  description: '',
  condition: { kind: 'kill', amount: 2 },
  reward: {},
  cadence: 'daily',
}

const KILL_QUEST: Quest = {
  id: 'quest_kill_c',
  name: 'Kill quest',
  description: '',
  condition: { kind: 'kill', enemyId: 'enemy_x', amount: 3 },
  reward: {},
  cadence: 'once',
}

const LOCKED_QUEST: Quest = {
  id: 'quest_once_locked',
  name: 'Locked quest',
  description: '',
  condition: { kind: 'kill', amount: 1 },
  reward: {},
  cadence: 'once',
  requiredRealmId: 'foundation_establishment',
}

function makeHarness(playerRealmId = 'qi_refining') {
  const registry = new QuestRegistry()
  registry.register(ONCE_QUEST)
  registry.register(DAILY_QUEST)
  registry.register(KILL_QUEST)
  registry.register(LOCKED_QUEST)
  const manager = new QuestManager()
  const system = new QuestSystem()
  const player = { realmId: playerRealmId } as unknown as PlayerData
  return { system, registry, manager, player }
}

describe('QuestSystem.reconcileActiveQuests - lifecycle command (AR-09)', () => {
  it('activates every unlocked eligible quest', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_once_a')).toBeDefined()
    expect(manager.getProgress('quest_daily_b')).toBeDefined()
    expect(manager.getProgress('quest_kill_c')).toBeDefined()
  })

  it('skips locked and completed-once quests', () => {
    const { system, registry, manager, player } = makeHarness('mortal')
    manager.markCompletedOnce('quest_once_a')
    system.reconcileActiveQuests(registry, manager, player)
    // Locked: requires foundation_establishment, player is mortal.
    expect(manager.getProgress('quest_once_locked')).toBeUndefined()
    // Completed once: never reappears.
    expect(manager.getProgress('quest_once_a')).toBeUndefined()
    // player realm mortal still unlocks nothing else here except
    // quests without a realm gate: daily + kill stay eligible.
    expect(manager.getProgress('quest_daily_b')).toBeDefined()
  })

  it('is idempotent - repeated reconcile does not duplicate or reset progress', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress('quest_daily_b', 3)
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_daily_b')!.progress).toBe(3)
    expect(manager.getActive().filter((p) => p.questId === 'quest_daily_b')).toHaveLength(1)
  })

  it('getActiveQuests does NOT activate - pure read', () => {
    const { system, registry, manager, player } = makeHarness()
    const before = JSON.stringify(manager.getState())
    const result = system.getActiveQuests(registry, manager, player)
    expect(result).toEqual([]) // nothing activated yet
    expect(JSON.stringify(manager.getState())).toBe(before)
  })

  it('events count after lifecycle activation (unopened UI)', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    system.onEnemyDefeated(registry, manager, 'enemy_x', undefined)
    expect(manager.getProgress('quest_kill_c')!.progress).toBe(1)
  })

  it('events do NOT count before activation (no retroactive credit)', () => {
    const { system, registry, manager, player } = makeHarness()
    system.onEnemyDefeated(registry, manager, 'enemy_x', undefined)
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_kill_c')!.progress).toBe(0)
  })

  it('daily rollover then reconcile repopulates the board', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress('quest_daily_b', 2)
    system.checkAndResetDaily(registry, manager, player, Date.now() + 25 * 60 * 60 * 1000)
    expect(manager.getProgress('quest_daily_b')).toBeUndefined() // reset clears
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('quest_daily_b')).toBeDefined() // rebuilt
    expect(manager.getProgress('quest_daily_b')!.progress).toBe(0)
  })
})

describe('query purity guard (A3/A7)', () => {
  it('two consecutive reads return equal results and leave state untouched', () => {
    const { system, registry, manager, player } = makeHarness()
    system.reconcileActiveQuests(registry, manager, player)
    const snapshotBefore = JSON.stringify(manager.getState())
    const first = system.getActiveQuests(registry, manager, player)
    const second = system.getActiveQuests(registry, manager, player)
    expect(first).toEqual(second)
    expect(JSON.stringify(manager.getState())).toBe(snapshotBefore)
  })
})
