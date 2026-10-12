import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { Stage } from '../stage/Stage'

const stage: Stage = {
  id: 'view_stage', name: 'View stage', description: '', floor: 1,
  enemyPool: [{ enemyId: 'mortal_wild_boar', weight: 1 }],
  totalEnemyCount: 2, waves: [2], spawnIntervalSeconds: 0,
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
describe('Expedition presentation query', () => {
  it('reads the authoritative cycle remainder without granting or advancing state', () => {
    vi.useFakeTimers()
    const manager = new GameManager()
    manager.catalogOps.registerStages([stage])
    const player = createDefaultPlayer()
    player.perfectClearStageIds.push(stage.id)
    player.perfectClearSeconds[stage.id] = 10
    expect(manager.turnBattleOps.autoFarmOps.startAutoFarm(player, stage.id)).toBe(true)
    const marker = { ...player.autoFarmStage! }
    vi.advanceTimersByTime(2500)
    const view = manager.turnBattleOps.autoFarmOps.getAutoFarmView(player)
    expect(view).toMatchObject({ stageId: stage.id, stageName: stage.name, cycleSeconds: 10, progress: 0.25, remainingSeconds: 7.5, enemyIds: ['mortal_wild_boar'] })
    expect(player.autoFarmStage).toEqual(marker)
    expect(manager.materialBag.getAll()).toEqual([])
    vi.advanceTimersByTime(10_000)
    expect(manager.turnBattleOps.autoFarmOps.getAutoFarmView(player)?.progress).toBe(0.25)
    expect(player.autoFarmStage).toEqual(marker)
    expect(manager.materialBag.getAll()).toEqual([])
    manager.turnBattleOps.autoFarmOps.stopAutoFarm(player)
    expect(manager.turnBattleOps.autoFarmOps.getAutoFarmView(player)).toBeNull()
  })
  it('does not reconcile a stale marker or acquire a stage on query', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    player.autoFarmStage = { stageId: 'removed', lastCheckedMs: 0 }
    expect(manager.turnBattleOps.autoFarmOps.getAutoFarmView(player)).toBeNull()
    expect(player.autoFarmStage.stageId).toBe('removed')
    expect(manager.stageManager.getActive()).toBeNull()
  })
})
