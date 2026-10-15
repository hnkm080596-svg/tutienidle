import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { primeMortalCreationPick } from '../../services/save/GameSave.fixture'
import { buildGameSave, loadGame, writeGameSave } from '../../services/save/SaveSystem'
import { QuestManager } from './QuestManager'
import { QuestSystem } from './QuestSystem'
import { QuestRegistry } from './QuestRegistry'
import type { Quest } from './Quest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { PillBag } from '../pill/PillBag'
import { PillRegistry } from '../pill/PillRegistry'
import { betaQuestSurfaceFor } from '../betaScopeQuestDomain'

afterEach(() => vi.unstubAllGlobals())

const quest: Quest = { id: 's1-integration', name: 'S1', description: '', cadence: 'once',
  condition: { kind: 'allOf', objectives: [
    { id: '__proto__', kind: 'acquire', materialId: 'wood', amount: 2 },
    { id: 'kill', kind: 'kill', enemyId: 'mortal_wild_boar', amount: 1 },
  ] }, reward: {} }

describe('S1 production boundary integration', () => {
  it('preserves nested counters through actual save build/write/load and detached owner restore', () => {
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value) },
      removeItem: (key: string) => { entries.delete(key) },
    })
    const game = new GameManager()
    const player = createDefaultPlayer()
    primeMortalCreationPick(player, game.skillManager)
    game.questManager.ensureActive(quest)
    game.questManager.incrementObjective(quest.id, '__proto__', 2, 2)
    const save = buildGameSave(player, game)
    game.questManager.incrementObjective(quest.id, 'kill', 1, 1)
    expect(save.quests?.active[0]?.objectives).toEqual({ ['__proto__']: 2, kill: 0 })
    expect(writeGameSave(save)).toEqual({ status: 'ok' })
    const outcome = loadGame()
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') throw new Error('Save must round-trip')
    const restored = new QuestManager()
    restored.restore(outcome.save.quests!)
    expect(restored.getProgress(quest.id)?.objectives).toEqual({ ['__proto__']: 2, kill: 0 })
    outcome.save.quests!.active[0]!.objectives!.kill = 99
    expect(restored.getProgress(quest.id)?.objectives?.kill).toBe(0)
  })

  it('applies actual beta policy to every kill leaf and admits daily/weekly cadences', () => {
    const registry = new QuestRegistry()
    registry.register({ ...quest, id: 'off-roster', condition: { kind: 'allOf', objectives: [
      { id: 'kill', kind: 'kill', enemyId: 'not-on-beta-roster', amount: 1 },
    ] } })
    registry.register({ ...quest, id: 'daily', cadence: 'daily' })
    registry.register({ ...quest, id: 'weekly', cadence: 'weekly' })
    registry.register(quest)
    const manager = new QuestManager()
    const system = new QuestSystem()
    const player = createDefaultPlayer()
    system.reconcileActiveQuests(registry, manager, player)
    expect(manager.getProgress('off-roster')).toBeUndefined()
    expect(manager.getProgress('daily')).toBeDefined()
    expect(manager.getProgress('weekly')).toBeDefined()
    expect(manager.getProgress(quest.id)).toBeDefined()
    system.onMaterialCollected(registry, manager, 'wood', 2)
    system.onEnemyDefeated(registry, manager, 'mortal_wild_boar', undefined)
    const bags = { materialBag: new MaterialBag(), materialRegistry: new MaterialRegistry(),
      pillBag: new PillBag(), pillRegistry: new PillRegistry() }
    expect(system.canClaim(registry, manager, bags, quest.id)).toBe(true)
    const before = JSON.stringify(manager.getState())
    expect(betaQuestSurfaceFor(quest, manager.getProgress(quest.id)!, player,
      { ...bags, enemyName: () => undefined }).claim.available).toBe(true)
    expect(JSON.stringify(manager.getState())).toBe(before)
  })

  it('surfaces top-level turnIn shortfall on allOf quests when a collect objective item leaves the bag', () => {
    const allOfCollectQuest: Quest = {
      id: 'allof-collect',
      name: 'AllOf Collect',
      description: '',
      cadence: 'once',
      condition: {
        kind: 'allOf',
        objectives: [
          { id: 'gather', kind: 'collect', materialId: 'linh_thao_ha_pham', amount: 3 },
          { id: 'hunt', kind: 'kill', enemyId: 'mortal_wild_boar', amount: 1 },
        ],
      },
      reward: {},
    }
    const registry = new QuestRegistry()
    registry.register(allOfCollectQuest)
    const manager = new QuestManager()
    const system = new QuestSystem()
    const player = createDefaultPlayer()
    system.reconcileActiveQuests(registry, manager, player)
    system.onMaterialCollected(registry, manager, 'linh_thao_ha_pham', 3)
    system.onEnemyDefeated(registry, manager, 'mortal_wild_boar', undefined)

    const bags = {
      materialBag: new MaterialBag(),
      materialRegistry: new MaterialRegistry(),
      pillBag: new PillBag(),
      pillRegistry: new PillRegistry(),
    }
    const surface = betaQuestSurfaceFor(allOfCollectQuest, manager.getProgress(allOfCollectQuest.id)!, player, {
      ...bags,
      enemyName: () => undefined,
    })
    expect(surface.claim.available).toBe(false)
    expect(surface.claim.disabledReason).toBe('missing-turnin-items')
    expect(surface.turnIn).toEqual({
      materialId: 'linh_thao_ha_pham',
      required: 3,
      owned: 0,
    })
  })
})
