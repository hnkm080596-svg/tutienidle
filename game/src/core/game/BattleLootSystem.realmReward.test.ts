import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Battle, BattleEnemy } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Enemy, EnemyReward } from '../enemy/Enemy'
import type { RewardReceiver } from '../reward/RewardSystem'
import { BattleLootSystem, type BattleLootSystemDeps } from './BattleLootSystem'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import { getRealmRewardMultiplier } from '../reward/RealmRewardScale'

// Scale thưởng theo cảnh giới stage (balance playtest 2026-08-28) — Trúc Cơ
// tái sử dụng enemyPool Luyện Khí nên nhân thưởng ×3 để thu nhập không khựng.
function createDeadEnemy(id: string, rewards: EnemyReward, entity: Partial<CombatEntity> = {}): BattleEnemy {
  return {
    entity: { alive: false, id, isBoss: false, isElite: false, ...entity } as CombatEntity,
    attackTimer: 0,
    rewardGranted: false,
  } as BattleEnemy
}

function createTestSetup(rewards: EnemyReward, realmId: string, talentIds: string[] = []) {
  const materialRegistry = new MaterialRegistry()
  const materialBag = new MaterialBag()
  const giveReward = vi.fn()

  const deps: BattleLootSystemDeps = {
    eventBus: { emit: vi.fn() },
    notifications: { push: vi.fn(), drain: () => [] },
    combatSystem: {
      applyHealing: (target: { currentHp: number; maxHp: number }, amount: number) => {
        const before = target.currentHp
        target.currentHp = Math.min(target.maxHp, target.currentHp + Math.max(0, amount))
        return target.currentHp - before
      },
    },
    materialRegistry,
    materialBag,
    pillRegistry: {},
    pillBag: {},
    equipmentRegistry: { getAll: () => [], has: () => false, get: () => undefined },
    equipmentBag: { add: vi.fn() },
    equipmentSystem: {},
    affixRegistry: {},
    zoneRegistry: { has: () => false, getZoneForStage: () => undefined },
    techniqueManager: { getEquipped: () => undefined },
    techniqueSystem: {},
    techniqueTemplates: {},
    enemySystem: {
      get: () => ({ realmId, rewards }) as unknown as Enemy,
      despawn: vi.fn(),
    },
    rewardSystem: { give: giveReward },
    stageManager: { get: () => undefined },
    stageTemplates: {},
    questSystem: { onEnemyDefeated: vi.fn(), onMaterialCollected: vi.fn() },
    questRegistry: {},
    questManager: {},
  } as unknown as BattleLootSystemDeps

  const loot = new BattleLootSystem(deps)
  const player = createDefaultPlayer()
  player.selectedTalentIds = talentIds
  loot.setSession({} as RewardReceiver, player)

  return { loot, player, giveReward }
}

function createBattle(enemies: BattleEnemy[]): Battle {
  return {
    enemies,
    player: { alive: true, currentHp: 100, maxHp: 100 } as CombatEntity,
  } as unknown as Battle
}

describe('getRealmRewardMultiplier', () => {
  it('mortal & Luyện Khí ×1; Trúc Cơ ×3; Kim Đan ×9', () => {
    expect(getRealmRewardMultiplier('mortal')).toBe(1)
    expect(getRealmRewardMultiplier('qi_refining')).toBe(1)
    expect(getRealmRewardMultiplier('foundation_establishment')).toBe(3)
    expect(getRealmRewardMultiplier('golden_core')).toBe(9)
  })

  it('realm không biết — ×1 (an toàn)', () => {
    expect(getRealmRewardMultiplier('unknown_realm')).toBe(1)
  })
})

describe('BattleLootSystem — realm reward scaling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Luyện Khí ×1 — Linh Thạch + Cảm Ngộ giữ nguyên', () => {
    const rewards: EnemyReward = { techniqueInsight: 40, spiritStone: 10 }
    const { loot, giveReward } = createTestSetup(rewards, 'qi_refining')

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 10, techniqueInsight: 40 })
    expect(loot.getSummary().spiritStone).toBe(10)
  })

  it('Trúc Cơ ×3 — Linh Thạch + Cảm Ngộ nhân 3', () => {
    const rewards: EnemyReward = { techniqueInsight: 40, spiritStone: 10 }
    const { loot, giveReward } = createTestSetup(rewards, 'foundation_establishment')

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 30, techniqueInsight: 120 })
    expect(loot.getSummary().spiritStone).toBe(30)
  })

  it('Trúc Cơ ×3 + Tụ Bảo ×1.5 — Linh Thạch ×4.5, Cảm Ngộ chỉ ×3', () => {
    const rewards: EnemyReward = { techniqueInsight: 40, spiritStone: 10 }
    const { loot, giveReward } = createTestSetup(rewards, 'foundation_establishment', ['tu_bao'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 45, techniqueInsight: 120 })
    expect(loot.getSummary().spiritStone).toBe(45)
  })

  it('Trúc Cơ — Cảm Ngộ Kỹ năng suy ra từ techniqueInsight cũng ×3', () => {
    const rewards: EnemyReward = { techniqueInsight: 10, spiritStone: 0 }
    const { loot, player } = createTestSetup(rewards, 'foundation_establishment')

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(player.skillInsight).toBe(30)
    expect(loot.getSummary().skillInsight).toBe(30)
  })

  it('Trúc Cơ floor — 10 thạch ×3 lẻ vẫn làm tròn xuống', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 7 }
    const { loot, giveReward } = createTestSetup(rewards, 'foundation_establishment')

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 21 })
  })
})
