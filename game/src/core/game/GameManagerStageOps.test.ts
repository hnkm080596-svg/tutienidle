// Stage surface read-model tests (BETA SCOPE LOCK v2 section 9): the model
// delegates to the owning authorities - a player who unlocks/completes
// stages sees the same state the start/auto-farm gates would compute.
import { describe, expect, it } from 'vitest'

import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { STAGES } from '../../data/stage/Stages'
import { zones } from '../../data/stage/Zones'
import { ENEMIES } from '../../data/enemy/Enemies'

function harness() {
  const manager = new GameManager()
  manager.catalogOps.registerStages(STAGES)
  manager.catalogOps.registerEnemyTemplates(ENEMIES)
  manager.catalogOps.registerZones(zones)
  const player = createDefaultPlayer()
  manager.setActivePlayer(player)
  return { manager, player }
}

describe('GameManagerStageOps - stage surface read-model', () => {
  it('fresh mortal player: first stage current+startable, later floors locked with floor reason', () => {
    const { manager, player } = harness()

    const first = manager.stageOps.getStageSurfaceModel('mortal_dong_1', player)!
    expect(first.state).toBe('current')
    expect(first.startAvailable).toBe(true)
    expect(first.disabledReason).toBeNull()
    expect(first.act).toBe(1)
    expect(first.realmId).toBe('mortal')
    expect(first.floor).toBe(1)
    expect(first.isBossFloor).toBe(false)
    expect(first.displayEnemy?.id).toBe('mortal_wild_boar')
    expect(first.autoFarmAvailable).toBe(false)

    const second = manager.stageOps.getStageSurfaceModel('mortal_dong_2', player)!
    expect(second.state).toBe('locked')
    expect(second.startAvailable).toBe(false)
    // Floor 2 requires realmLevel 2 - a realmLevel-1 player sees the
    // realm reason (the lock-reason precedence order).
    expect(second.disabledReason).toEqual({ kind: 'realm', realmId: 'mortal', realmLevel: 2 })

    // At full mortal realmLevel the realm gate clears and the same
    // stage reports the sequential-progress floor reason.
    player.realmLevel = 10
    const secondAtCap = manager.stageOps.getStageSurfaceModel('mortal_dong_2', player)!
    expect(secondAtCap.disabledReason).toEqual({ kind: 'floor', floor: 1 })
  })

  it('realm-locked acts report a realm reason, not a floor one', () => {
    const { manager, player } = harness()

    const qiFirst = manager.stageOps.getStageSurfaceModel('qi_refining_forest', player)!
    expect(qiFirst.state).toBe('locked')
    expect(qiFirst.disabledReason).toEqual({
      kind: 'realm',
      realmId: 'qi_refining',
      realmLevel: 1,
    })
  })

  it('completed chain flips the frontier and marks perfect distinctly', () => {
    const { manager, player } = harness()
    player.realmLevel = 10

    player.completedStageIds.push('mortal_dong_1')
    player.perfectClearStageIds.push('mortal_dong_1')
    player.perfectClearSeconds['mortal_dong_1'] = 45

    const done = manager.stageOps.getStageSurfaceModel('mortal_dong_1', player)!
    expect(done.state).toBe('perfect')
    expect(done.autoFarmAvailable).toBe(true)

    const next = manager.stageOps.getStageSurfaceModel('mortal_dong_2', player)!
    expect(next.state).toBe('current')
    expect(next.startAvailable).toBe(true)
  })

  it('busy reason: an occupied single slot reports busy on an unlocked stage', () => {
    const { manager, player } = harness()
    player.realmLevel = 10

    const stage1 = STAGES.find((stage) => stage.id === 'mortal_dong_1')!
    player.completedStageIds.push('mortal_dong_1')

    expect(manager.turnBattleOps.startStage(player, stage1, false)).toBe(true)

    const model = manager.stageOps.getStageSurfaceModel('mortal_dong_2', player)!
    expect(model.state).toBe('current')
    expect(model.startAvailable).toBe(false)
    expect(model.disabledReason).toEqual({ kind: 'busy' })
  })

  it('boss floor model: boss flag + roster boss as display enemy', () => {
    const { manager, player } = harness()

    const boss = manager.stageOps.getStageSurfaceModel('mortal_dong_10', player)!
    expect(boss.isBossFloor).toBe(true)
    expect(boss.displayEnemy?.id).toBe('mortal_ferocious_wild_boar')
  })

  it('reward preview surfaces the realm band drop table', () => {
    const { manager, player } = harness()

    const model = manager.stageOps.getStageSurfaceModel('qi_refining_abyssal_pool', player)!
    expect(model.rewardPreview?.spiritStone).toEqual({ min: 8, max: 12 })
    expect(model.rewardPreview?.techniqueMastery).toEqual({ min: 35, max: 45 })
    expect(model.rewardPreview?.poolItems.length).toBeGreaterThan(0)
  })

  it('list models: zone order, 30 models, one current frontier', () => {
    const { manager, player } = harness()

    const models = manager.stageOps.getStageSurfaceModels(player)
    expect(models).toHaveLength(30)
    expect(models[0]!.stageId).toBe('mortal_dong_1')
    expect(models.filter((model) => model.state === 'current')).toHaveLength(1)
    expect(models[0]!.state).toBe('current')
  })

  it('unknown stage id returns undefined', () => {
    const { manager, player } = harness()
    expect(manager.stageOps.getStageSurfaceModel('nope', player)).toBeUndefined()
  })
})
