import { describe, expect, it, vi } from 'vitest'
import type { Battle } from '../battle/Battle'
import type { BattleEnemy } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Enemy } from '../enemy/Enemy'
import { createEmptyBattleRewardSummary } from '../reward/BattleRewardSummary'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { PlayerData } from '../player/Player'
import { BattleLootSystem, type BattleLootSystemDeps } from './BattleLootSystem'

// P2 fix (2026-08-24) — beginTribulation() phải reset receiver + summary.
// Unit test mức BattleLootSystem: chứng minh gate `if (this.receiver)`
// trong processDefeatedEnemies() KHÔNG còn chạy sau beginTribulation()
// (quái chết trong trận Kiếp — kể cả khi sau này trận Kiếp có
// enemy/summon — không chảy reward qua session cũ), trong khi despawn
// vẫn chạy bình thường.

function createDeadEnemy(id: string): BattleEnemy {
  return {
    entity: { alive: false, id } as CombatEntity,
    attackTimer: 0,
    rewardGranted: false,
  } as BattleEnemy
}

function createStubDeps() {
  const give = vi.fn()
  const despawn = vi.fn()

  const deps: BattleLootSystemDeps = {
    eventBus: { emit: vi.fn() },
    notifications: { push: vi.fn(), drain: () => [] },
    materialRegistry: {},
    materialBag: {},
    pillRegistry: {},
    pillBag: {},
    equipmentRegistry: {},
    equipmentBag: {},
    equipmentSystem: {},
    affixRegistry: {},
    zoneRegistry: {},
    techniqueManager: { getEquipped: () => undefined },
    techniqueSystem: {},
    techniqueTemplates: {},
    enemySystem: {
      // Enemy có rewards thật — nếu receiver còn thì give() PHẢI được gọi.
      get: () => ({
        rewards: { techniqueInsight: 5, spiritStone: 7 },
      }) as unknown as Enemy,
      despawn,
    },
    rewardSystem: { give },
    stageManager: { get: () => undefined },
    stageTemplates: {},
    questSystem: { onEnemyDefeated: vi.fn() },
    questRegistry: {},
    questManager: {},
  } as unknown as BattleLootSystemDeps

  return { deps, give, despawn }
}

describe('BattleLootSystem.beginTribulation — reset session battle-scoped', () => {
  it('sau beginTribulation, quái chết KHÔNG được cấp reward qua receiver cũ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // không rớt đồ ngẫu nhiên
    const { deps, give, despawn } = createStubDeps()
    const loot = new BattleLootSystem(deps)

    const previousPlayer = { name: 'trận-stage-cũ' } as PlayerData
    loot.setSession({} as RewardReceiver, previousPlayer)

    loot.beginTribulation({ name: 'người-độ-kiếp' } as PlayerData)

    loot.processDefeatedEnemies({ enemies: [createDeadEnemy('kiep')] } as unknown as Battle)

    expect(give).not.toHaveBeenCalled()
    expect(despawn).toHaveBeenCalledWith('kiep')
    expect(loot.getSummary()).toEqual(createEmptyBattleRewardSummary())
  })

  it('đối chứng: receiver CÒN (setSession) thì cùng quái chết ĐƯỢC cấp reward', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { deps, give } = createStubDeps()
    const loot = new BattleLootSystem(deps)

    const player = { name: 'player' } as PlayerData
    loot.setSession({} as RewardReceiver, player)

    loot.processDefeatedEnemies({ enemies: [createDeadEnemy('stage-mob')] } as unknown as Battle)

    // Gate receiver hoạt động thật — chứng minh test trên có ý nghĩa.
    expect(give).toHaveBeenCalledTimes(1)
  })
})
