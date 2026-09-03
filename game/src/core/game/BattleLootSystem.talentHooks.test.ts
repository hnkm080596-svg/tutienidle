import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Battle, BattleEnemy } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Enemy, EnemyReward } from '../enemy/Enemy'
import type { RewardReceiver } from '../reward/RewardSystem'
import { BattleLootSystem, type BattleLootSystemDeps } from './BattleLootSystem'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'

// Talent catalog v4 (spec 2026-09-03 §4.4) — 4 hook loot của v3 (Tụ
// Bảo/Đại Trí Nhược Ngu/Cơ Duyên/Huyết Chiến) đã RETIRED: id vẫn
// resolve cho save cũ nhưng effects rỗng → mọi multiplier loot về
// mặc định. File này khóa: (1) pipeline loot nền không talent, (2)
// id retired KHÔNG còn bonus (hành vi "save cũ an toàn").
// Stub deps mirror BattleLootSystem.artifactDrop.test.ts; realmId
// 'qi_refining' để cô lập khỏi Đoán Bảo Thạch (chỉ roll từ Trúc Cơ).
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
const EQUIPMENT_INSTANCE = {
  instanceId: 'talent-drop-instance',
  grade: 'bat_pham',
  quality: 'huyen',
  zoneId: undefined,
  icon: undefined,
}

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
  // EquipmentBag.add() giờ trả AutoDissolveReward[] (cap mềm audit
  // 2026-08-31) — mock phải trả array thay vì undefined để khớp hợp đồng thật.
  const equipmentBag = { add: vi.fn().mockReturnValue([]) }
  const giveReward = vi.fn()
  const eventBus = { emit: vi.fn() }
  const notifications = { push: vi.fn(), drain: () => [] }
  const applyHealing = vi.fn((target: { currentHp: number; maxHp: number }, amount: number) => {
    const before = target.currentHp
    target.currentHp = Math.min(target.maxHp, target.currentHp + Math.max(0, amount))
    return target.currentHp - before
  })

  const deps: BattleLootSystemDeps = {
    eventBus,
    notifications,
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

  return {
    loot,
    player,
    materialBag,
    equipmentBag,
    giveReward,
    applyHealing,
    eventBus,
    notifications,
  }
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

describe('BattleLootSystem — pipeline loot nền (không talent)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Linh Thạch giữ nguyên', () => {
    const { loot, giveReward } = createTestSetup({ techniqueInsight: 0, spiritStone: 10 })

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', { techniqueInsight: 0, spiritStone: 10 })]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 10 })
    expect(loot.getSummary().spiritStone).toBe(10)
  })

  it('Cảm Ngộ Kỹ năng giữ nguyên', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0, skillInsight: 5 }
    const { loot, player } = createTestSetup(rewards)

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(player.skillInsight).toBe(5)
    expect(loot.getSummary().skillInsight).toBe(5)
  })

  it('máu không đổi khi quái chết', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const { loot } = createTestSetup(rewards)
    const battle = createBattle([createDeadEnemy('mob', rewards)], { currentHp: 500, maxHp: 1000 })

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(500)
    expect(battle.player.currentHp).not.toBe(520)
  })

  it('roll 0.5 trượt drop chance 0.4 — không rơi trang bị', () => {
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

  it('material drop với roll 0.5 trượt chance 0.4 — không vào túi', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'material', itemId: 'mat_test', chance: 0.4, amount: 1 }],
    }
    const { loot, materialBag } = createTestSetup(rewards)

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(materialBag.getAmount('mat_test')).toBe(0)
  })
})

describe('BattleLootSystem — talent v3 retired KHÔNG còn bonus (spec v4 §4.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tu_bao (Tụ Bảo) — Linh Thạch KHÔNG nhân 1.5', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 10 }
    const { loot, giveReward } = createTestSetup(rewards, ['tu_bao'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 10 })
    expect(loot.getSummary().spiritStone).toBe(10)
  })

  it('dai_tri_nhuoc_ngu (Đại Trí Nhược Ngu) — Cảm Ngộ KHÔNG nhân 2', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0, skillInsight: 5 }
    const { loot, player } = createTestSetup(rewards, ['dai_tri_nhuoc_ngu'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(player.skillInsight).toBe(5)
  })

  it('co_duyen (Cơ Duyên) — drop chance KHÔNG nhân 1.5 (cùng roll trượt như thường)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const rewards: EnemyReward = {
      techniqueInsight: 0,
      spiritStone: 0,
      itemDrops: [{ kind: 'equipment', itemId: 'eq_test', chance: 0.4 }],
    }
    const { loot, equipmentBag } = createTestSetup(rewards, ['co_duyen'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(equipmentBag.add).not.toHaveBeenCalled()
  })

  it('huyet_chien (Huyết Chiến) — diệt quái KHÔNG hồi máu', () => {
    const rewards: EnemyReward = { techniqueInsight: 0, spiritStone: 0 }
    const { loot, applyHealing } = createTestSetup(rewards, ['huyet_chien'])
    const battle = createBattle([createDeadEnemy('mob', rewards)], { currentHp: 500, maxHp: 1000 })

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(500)
    expect(applyHealing).not.toHaveBeenCalled()
  })

  it('talent v4 combat (kiem_quang) — loot nền KHÔNG bị ảnh hưởng (combat passive không đụng loot)', () => {
    const rewards: EnemyReward = { techniqueInsight: 10, spiritStone: 10, skillInsight: 5 }
    const { loot, player, giveReward } = createTestSetup(rewards, ['kiem_quang'])

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob', rewards)]))

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 10, techniqueInsight: 10 })
    expect(player.skillInsight).toBe(5)
    expect(loot.getSummary().spiritStone).toBe(10)
  })
})
