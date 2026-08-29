import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Battle, BattleEnemy } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Enemy, EnemyReward } from '../enemy/Enemy'
import type { RewardReceiver } from '../reward/RewardSystem'
import { BattleLootSystem, type BattleLootSystemDeps } from './BattleLootSystem'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'

// Thiên phú hook rẻ (talent-direction-choice-plan §6) — Tụ Bảo (Linh Thạch),
// Đại Trí Nhược Ngu/Nghịch Thiên (Cảm Ngộ Kỹ Năng), Cơ Duyên (chance rơi
// trang bị), Huyết Chiến (diệt quái hồi máu). Stub deps mirror
// BattleLootSystem.artifactDrop.test.ts; realmId 'qi_refining' để cô lập
// khỏi Đoán Bảo Thạch (chỉ roll từ Trúc Cơ).
function createDeadEnemy(
  id: string,
  rewards: EnemyReward,
  entity: Partial<CombatEntity> = {},
): BattleEnemy {
  return {
    entity: { alive: false, id, isBoss: false, isElite: false, ...entity } as CombatEntity,
    attackTimer: 0,
    rewardGranted: false,
  } as BattleEnemy
}

const EQUIPMENT_TEMPLATE = { id: 'eq_test', name: 'Kiếm Test' }
const EQUIPMENT_INSTANCE = { rarity: 'hoang', quality: 1, zoneId: undefined, icon: undefined }

function createTestSetup(rewards: EnemyReward, talentIds: string[] = []) {
  const materialRegistry = new MaterialRegistry()
  materialRegistry.register({
    id: 'mat_test',
    name: 'Vật Liệu Test',
    category: 'other',
    sourceType: 'monster',
    description: 'test fixture',
  })
  const materialBag = new MaterialBag()
  const equipmentBag = { add: vi.fn() }
  const giveReward = vi.fn()
  const applyHealing = vi.fn((target: { currentHp: number; maxHp: number }, amount: number) => {
    const before = target.currentHp
    target.currentHp = Math.min(target.maxHp, target.currentHp + Math.max(0, amount))
    return target.currentHp - before
  })

  const deps: BattleLootSystemDeps = {
    eventBus: { emit: vi.fn() },
    notifications: { push: vi.fn(), drain: () => [] },
    combatSystem: { applyHealing },
    materialRegistry,
    materialBag,
    pillRegistry: {},
    pillBag: {},
    equipmentRegistry: { getAll: () => [EQUIPMENT_TEMPLATE], has: () => true, get: () => EQUIPMENT_TEMPLATE },
    equipmentBag,
    equipmentSystem: { createInstance: () => EQUIPMENT_INSTANCE },
    affixRegistry: {},
    zoneRegistry: { has: () => false, getZoneForStage: () => undefined },
    techniqueManager: { getEquipped: () => undefined },
    techniqueSystem: {},
    techniqueTemplates: {},
    enemySystem: {
      get: () => ({ realmId: 'qi_refining', rewards }) as unknown as Enemy,
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

  return { loot, player, materialBag, equipmentBag, giveReward, applyHealing }
}

function createBattle(
  enemies: BattleEnemy[],
  playerEntity: Partial<CombatEntity> = {},
): Battle {
  return {
    enemies,
    player: { alive: true, currentHp: 100, maxHp: 100, ...playerEntity } as CombatEntity,
  } as unknown as Battle
}

describe('BattleLootSystem — Tụ Bảo (spirit_stone_gain)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('không có talent — Linh Thạch giữ nguyên', () => {
    const { loot, giveReward } = createTestSetup({ techniqueInsight: 0, spiritStone: 10 })

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', { techniqueInsight: 0, spiritStone: 10 })]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 10 })
    expect(loot.getSummary().spiritStone).toBe(10)
  })

  it('Tụ Bảo +50% — Linh Thạch nhân 1.5 cả lượng thật lẫn summary', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 10 }
    const { loot, giveReward } = createTestSetup(rewards, ['tu_bao'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 15 })
    expect(loot.getSummary().spiritStone).toBe(15)
  })

  it('Tụ Bảo floor kết quả — 10 × 1.5 lẻ vẫn làm tròn xuống', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 7 }
    const { loot, giveReward } = createTestSetup(rewards, ['tu_bao'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 10 }) // floor(10.5)
    expect(loot.getSummary().spiritStone).toBe(10)
  })
})

describe('BattleLootSystem — insight_gain (Đại Trí Nhược Ngu / Nghịch Thiên)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('không có talent — Cảm Ngộ Kỹ năng giữ nguyên', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0, skillInsight: 5 }
    const { loot, player } = createTestSetup(rewards)

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(player.skillInsight).toBe(5)
    expect(loot.getSummary().skillInsight).toBe(5)
  })

  it('Đại Trí Nhược Ngu +100% — Cảm Ngộ Kỹ năng ×2', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0, skillInsight: 5 }
    const { loot, player } = createTestSetup(rewards, ['dai_tri_nhuoc_ngu'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(player.skillInsight).toBe(10)
    expect(loot.getSummary().skillInsight).toBe(10)
  })

  it('Nghịch Thiên −30% — Cảm Ngộ Kỹ năng floor(10 × 0.7) = 7', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0, skillInsight: 10 }
    const { loot, player } = createTestSetup(rewards, ['nghich_thien'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(player.skillInsight).toBe(7)
    expect(loot.getSummary().skillInsight).toBe(7)
  })
})

describe('BattleLootSystem — Cơ Duyên (equipment_drop_chance)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('không có talent — roll 0.5 trượt drop chance 0.4', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'equipment', itemId: 'eq_test', chance: 0.4 }],
    }
    const { loot, equipmentBag } = createTestSetup(rewards)

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(equipmentBag.add).not.toHaveBeenCalled()
  })

  it('Cơ Duyên +50% — chance 0.4 thành 0.6, cùng roll 0.5 trúng', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'equipment', itemId: 'eq_test', chance: 0.4 }],
    }
    const { loot, equipmentBag } = createTestSetup(rewards, ['co_duyen'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(equipmentBag.add).toHaveBeenCalledTimes(1)
  })

  it('chance nhân vượt 1.0 — cap tại 1.0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'equipment', itemId: 'eq_test', chance: 0.8 }],
    }
    const { loot, equipmentBag } = createTestSetup(rewards, ['co_duyen'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(equipmentBag.add).toHaveBeenCalledTimes(1) // min(1, 0.8 × 1.5) = 1 > 0.999
  })

  it('material drop KHÔNG bị nhân chance — cùng roll vẫn trượt như không talent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'material', itemId: 'mat_test', chance: 0.4, amount: 1 }],
    }
    const { loot, materialBag } = createTestSetup(rewards, ['co_duyen'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(materialBag.getAmount('mat_test')).toBe(0)
  })

  it('boss rơi trang bị ngẫu nhiên — Cơ Duyên nhân cả BOSS_EQUIPMENT_DROP_CHANCE', () => {
    // 0.4 >= 0.3 (boss thường) nhưng 0.4 < 0.45 (boss × 1.5 talent)
    vi.spyOn(Math, 'random').mockReturnValue(0.4)

    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const withoutTalent = createTestSetup(rewards)
    const withTalent = createTestSetup(rewards, ['co_duyen'])

    withoutTalent.loot.processDefeatedEnemies(
      createBattle([createDeadEnemy('boss', rewards, { isBoss: true })]),
    )
    withTalent.loot.processDefeatedEnemies(
      createBattle([createDeadEnemy('boss', rewards, { isBoss: true })]),
    )

    expect(withoutTalent.equipmentBag.add).not.toHaveBeenCalled()
    expect(withTalent.equipmentBag.add).toHaveBeenCalledTimes(1)
  })
})

describe('BattleLootSystem — Huyết Chiến (heal_on_kill)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('không có talent — máu không đổi khi quái chết', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const { loot } = createTestSetup(rewards)
    const battle = createBattle([createDeadEnemy('mob', rewards)], { currentHp: 500, maxHp: 1000 })

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(500)
  })

  it('Huyết Chiến — diệt 1 quái hồi 2% max HP', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const { loot } = createTestSetup(rewards, ['huyet_chien'])
    const battle = createBattle([createDeadEnemy('mob', rewards)], { currentHp: 500, maxHp: 1000 })

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(520)
  })

  it('Huyết Chiến — hồi clamp đúng maxHp, không tràn', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const { loot } = createTestSetup(rewards, ['huyet_chien'])
    const battle = createBattle([createDeadEnemy('mob', rewards)], { currentHp: 990, maxHp: 1000 })

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(1000)
  })

  it('Huyết Chiến — hồi máu đi qua combatSystem.applyHealing (vitals event), không mutate thẳng HP', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const { loot, applyHealing } = createTestSetup(rewards, ['huyet_chien'])
    const battle = createBattle([createDeadEnemy('mob', rewards)], { currentHp: 500, maxHp: 1000 })

    loot.processDefeatedEnemies(battle)

    expect(applyHealing).toHaveBeenCalledTimes(1)
    expect(applyHealing).toHaveBeenCalledWith(battle.player, 20, battle.player.id, 'healing')
  })

  it('Huyết Chiến — diệt 2 quái cùng đợt hồi 2 lần', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const { loot } = createTestSetup(rewards, ['huyet_chien'])
    const battle = createBattle(
      [createDeadEnemy('mob_1', rewards), createDeadEnemy('mob_2', rewards)],
      { currentHp: 500, maxHp: 1000 },
    )

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(540)
  })
})
