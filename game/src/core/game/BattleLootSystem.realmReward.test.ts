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

const EQUIPMENT_TEMPLATE = { id: 'eq_realm_drop', name: 'Kiếm Cảnh Giới' }
const EQUIPMENT_INSTANCE = {
  instanceId: 'realm-drop-instance',
  grade: 'bat_pham',
  quality: 'tien',
  icon: undefined,
}
const PILL = { id: 'pill_grade_drop', name: 'Đan Phẩm', grade: 'tien', icon: undefined }

// Scale thưởng theo cảnh giới stage (balance playtest 2026-08-28) — Trúc Cơ
// tái sử dụng enemyPool Luyện Khí nên nhân thưởng ×3 để thu nhập không khựng.
function createDeadEnemy(id: string, rewards: EnemyReward, entity: Partial<CombatEntity> = {}): BattleEnemy {
  return {
    entity: { alive: false, id, isBoss: false, isElite: false, ...entity } as CombatEntity,
    attackTimer: 0,
    rewardGranted: false,
  } as BattleEnemy
}

function createTestSetup(
  rewards: EnemyReward,
  realmId: string,
  talentIds: string[] = [],
  equipmentDrop = false,
  pillDrop = false,
) {
  const materialRegistry = new MaterialRegistry()
  const materialBag = new MaterialBag()
  const giveReward = vi.fn()
  const eventBus = { emit: vi.fn() }
  const notifications = { push: vi.fn(), drain: () => [] }

  const deps: BattleLootSystemDeps = {
    eventBus,
    notifications,
    combatSystem: {
      applyHealing: (target: { currentHp: number; maxHp: number }, amount: number) => {
        const before = target.currentHp
        target.currentHp = Math.min(target.maxHp, target.currentHp + Math.max(0, amount))
        return target.currentHp - before
      },
    },
    materialRegistry,
    materialBag,
    pillRegistry: pillDrop ? { has: () => true, get: () => PILL } : {},
    pillBag: pillDrop ? { add: vi.fn().mockReturnValue(0) } : {},
    equipmentRegistry: equipmentDrop
      ? { getAll: () => [], has: () => true, get: () => EQUIPMENT_TEMPLATE }
      : { getAll: () => [], has: () => false, get: () => undefined },
    // add() trả AutoDissolveReward[] (cap mềm audit 2026-08-31) — mock khớp hợp đồng thật.
    equipmentBag: { add: vi.fn().mockReturnValue([]) },
    equipmentSystem: equipmentDrop ? { createInstance: () => EQUIPMENT_INSTANCE } : {},
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
    hiddenBeast: { onEnemyDefeated: vi.fn() },
  } as unknown as BattleLootSystemDeps

  const loot = new BattleLootSystem(deps)
  const player = createDefaultPlayer()
  player.selectedTalentIds = talentIds
  loot.setSession({} as RewardReceiver, player)

  return { loot, player, giveReward, eventBus, notifications, equipmentBag: deps.equipmentBag }
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

  it('Trúc Cơ ×3 + talent v3 retired (tu_bao) — không còn bonus ×1.5 (effect rỗng, spec v4 §4.4)', () => {
    const rewards: EnemyReward = { techniqueInsight: 40, spiritStone: 10 }
    const { loot, giveReward } = createTestSetup(rewards, 'foundation_establishment', ['tu_bao'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    // Tụ Bảo retired — chỉ còn realm ×3, đúng hành vi "save cũ an toàn".
    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 30, techniqueInsight: 120 })
    expect(loot.getSummary().spiritStone).toBe(30)
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

  it('equipment drop theo cảnh giới dùng quality cho particle và rank accent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'equipment', itemId: EQUIPMENT_TEMPLATE.id, chance: 1 }],
    }
    const { loot, equipmentBag, eventBus, notifications } = createTestSetup(
      rewards,
      'foundation_establishment',
      [],
      true,
    )

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(equipmentBag.add).toHaveBeenCalledTimes(1)
    expect(equipmentBag.add).toHaveBeenCalledWith(EQUIPMENT_INSTANCE)
    expect(equipmentBag.add).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 'bat_pham', quality: 'tien' }),
    )
    expect(eventBus.emit).toHaveBeenCalledTimes(1)
    expect(eventBus.emit).toHaveBeenCalledWith('reward_particle', {
      sourceId: 'mob',
      kind: 'item',
      color: 0xfff6d8,
    })
    expect(notifications.push).toHaveBeenCalledTimes(1)
    expect(notifications.push).toHaveBeenCalledWith({
      kind: 'loot',
      message: '+1 Kiếm Cảnh Giới',
      loot: expect.objectContaining({ accentColorVar: '--grade-tien' }),
    })
  })

  it('pill drop keeps the grade particle and accent presentation', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'pill', itemId: PILL.id, chance: 1 }],
    }
    const { loot, eventBus, notifications } = createTestSetup(
      rewards,
      'foundation_establishment',
      [],
      false,
      true,
    )

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(eventBus.emit).toHaveBeenCalledTimes(1)
    expect(eventBus.emit).toHaveBeenCalledWith('reward_particle', {
      sourceId: 'mob',
      kind: 'item',
      color: 0xfff6d8,
    })
    expect(notifications.push).toHaveBeenCalledTimes(1)
    expect(notifications.push).toHaveBeenCalledWith({
      kind: 'loot',
      message: '+1 Đan Phẩm',
      loot: expect.objectContaining({ accentColorVar: '--grade-tien' }),
    })
  })
})
