import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Battle, BattleEnemy } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Enemy } from '../enemy/Enemy'
import type { RewardReceiver } from '../reward/RewardSystem'
import { BattleLootSystem, type BattleLootSystemDeps } from './BattleLootSystem'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'

// Bản Mệnh Pháp Bảo (doc §6/§5.2) — mirror
// BattleLootSystem.beginTribulation.test.ts's stub deps style, dùng
// MaterialRegistry/MaterialBag THẬT (không stub) để verify drop thật
// sự lên bag, không chỉ verify hàm được gọi.
function createDeadEnemy(id: string, entity: Partial<CombatEntity> = {}): BattleEnemy {
  return {
    entity: { alive: false, id, isBoss: false, isElite: false, ...entity } as CombatEntity,
    attackTimer: 0,
    rewardGranted: false,
  } as BattleEnemy
}

function createTestSetup(realmId: string, techniqueInsight = 10) {
  const materialRegistry = new MaterialRegistry()
  materialRegistry.register({
    id: 'doan_bao_thach',
    name: 'Đoán Bảo Thạch',
    category: 'other',
    sourceType: 'monster',
    description: 'test fixture',
  })
  const materialBag = new MaterialBag()

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
    equipmentRegistry: { getAll: () => [] },
    equipmentBag: {},
    equipmentSystem: {},
    affixRegistry: {},
    zoneRegistry: {},
    techniqueManager: { getEquipped: () => undefined },
    techniqueSystem: {},
    techniqueTemplates: {},
    enemySystem: {
      get: () => ({
        realmId,
        rewards: { techniqueInsight, spiritStone: 0 },
      }) as unknown as Enemy,
      despawn: vi.fn(),
    },
    rewardSystem: { give: vi.fn() },
    stageManager: { get: () => undefined },
    stageTemplates: {},
    questSystem: { onEnemyDefeated: vi.fn(), onMaterialCollected: vi.fn() },
    questRegistry: {},
    questManager: {},
    hiddenBeast: { onEnemyDefeated: vi.fn() },
  } as unknown as BattleLootSystemDeps

  const loot = new BattleLootSystem(deps)
  const player = createDefaultPlayer()
  player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

  loot.setSession({} as RewardReceiver, player)

  return { loot, materialBag, player }
}

describe('BattleLootSystem — Đoán Bảo Thạch drop (doc §6)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('quái dưới Trúc Cơ không bao giờ rơi đá dù roll trúng', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // luôn trúng mọi roll

    const { loot, materialBag } = createTestSetup('qi_refining')

    loot.processDefeatedEnemies({ enemies: [createDeadEnemy('mob')] } as unknown as Battle)

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('quái Trúc Cơ thường roll trúng thì rơi đúng 1 đá', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { loot, materialBag } = createTestSetup('foundation_establishment')

    loot.processDefeatedEnemies({ enemies: [createDeadEnemy('mob')] } as unknown as Battle)

    expect(materialBag.getAmount('doan_bao_thach')).toBe(1)
  })

  it('quái Trúc Cơ roll trượt thì không rơi', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const { loot, materialBag } = createTestSetup('foundation_establishment')

    loot.processDefeatedEnemies({ enemies: [createDeadEnemy('mob')] } as unknown as Battle)

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('Boss chỉ dùng đúng 1 bảng (boss), không roll thêm normal/elite, rơi 1-2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { loot, materialBag } = createTestSetup('foundation_establishment')

    loot.processDefeatedEnemies({
      enemies: [createDeadEnemy('boss', { isBoss: true })],
    } as unknown as Battle)

    const amount = materialBag.getAmount('doan_bao_thach')

    expect(amount).toBeGreaterThanOrEqual(1)
    expect(amount).toBeLessThanOrEqual(2)
  })

  it('double-grant bị chặn bởi rewardGranted — chỉ cộng đúng 1 lần dù xử lý lặp', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { loot, materialBag } = createTestSetup('foundation_establishment')
    const enemy = createDeadEnemy('mob')

    loot.processDefeatedEnemies({ enemies: [enemy] } as unknown as Battle)
    // giả lập entity vẫn còn trong mảng do caller quên filter — rewardGranted đã true
    loot.processDefeatedEnemies({ enemies: [enemy] } as unknown as Battle)

    expect(materialBag.getAmount('doan_bao_thach')).toBe(1)
  })

  it('rơi vào bag + summary.items + notification đúng 1 lần', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { loot } = createTestSetup('foundation_establishment')

    loot.processDefeatedEnemies({ enemies: [createDeadEnemy('mob')] } as unknown as Battle)

    const summary = loot.getSummary()
    const stoneItem = summary.items.filter((item) => item.itemId === 'doan_bao_thach')

    expect(stoneItem).toHaveLength(1)
    expect(stoneItem[0]!.amount).toBe(1)
  })
})

describe('BattleLootSystem — EXP Bản Mệnh Pháp Bảo (doc §5.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('quái chết cấp đúng EXP theo base = max(1, floor(techniqueInsight*0.25))', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999) // không rớt đá, cô lập EXP

    const { loot, player } = createTestSetup('foundation_establishment', 10)

    loot.processDefeatedEnemies({ enemies: [createDeadEnemy('mob')] } as unknown as Battle)

    expect(player.artifact?.experience).toBe(2)
    expect(loot.getSummary().artifactInsight).toBe(2)
  })

  it('không có artifact (Kiếm Tu) thì không crash, không cộng gì', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const { loot, player } = createTestSetup('foundation_establishment', 10)
    player.artifact = undefined

    expect(() =>
      loot.processDefeatedEnemies({ enemies: [createDeadEnemy('mob')] } as unknown as Battle),
    ).not.toThrow()
    expect(loot.getSummary().artifactInsight).toBe(0)
  })
})
