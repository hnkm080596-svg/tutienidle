import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import { createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

// Bản Mệnh Pháp Bảo (doc §6/§5.2) — drop-system (2026-09-12): Đoán Bảo
// Thạch không còn roll riêng có gate realm trong grantArtifactStoneDrop —
// nó là 1 dòng weighted trong POOL của stage table Trúc Cơ (w25/60), vắng
// mặt ở mọi bảng thấp hơn. "Gate" giờ là dữ liệu bảng, không phải `if`.
const FOUNDATION_STAGE = {
  stageId: 'fe_5',
  requiredRealmId: 'foundation_establishment',
  floor: 5,
}

describe('BattleLootSystem — Đoán Bảo Thạch drop (doc §6)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stage dưới Trúc Cơ không rơi đá — bảng Luyện Khí không chứa nó', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // mọi roll trúng/draw entry đầu

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
      materialIds: ['doan_bao_thach', 'qi_refining_ore_decade'],
    })

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('quái Trúc Cơ bốc trúng dòng đá (pool entry đầu) thì rơi đúng 1 viên (min amount)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialIds: ['doan_bao_thach'],
    })

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(1)
  })

  it('pool draw trượt qua đá (roll vào equipment_any) thì không rơi', () => {
    // rng 0.999 -> roll 59.94/60 -> entry cuối = equipment_any; registry
    // trống nên không có gì rơi.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialIds: ['doan_bao_thach'],
    })

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('boss rơi NHIỀU hơn nhờ extraRolls: 4 lượt bốc → 4 viên (rng 0)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialIds: ['doan_bao_thach'],
    })

    killEnemy({ isBoss: true })

    // Boss modifier = 3 extraRolls → 4 pool draws, mỗi lượt trúng
    // doan_bao_thach với amount min 1 → đúng 4 viên.
    expect(materialBag.getAmount('doan_bao_thach')).toBe(4)
  })

  it('double-grant bị chặn bởi rewardGranted — chỉ cộng đúng 1 lần dù xử lý lặp', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { loot, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialIds: ['doan_bao_thach'],
    })

    const battleEnemy = createDeadEnemy('mob')

    loot.processDefeatedEnemies([battleEnemy], null)
    // giả lập entity vẫn còn trong mảng do caller quên filter — rewardGranted đã true
    loot.processDefeatedEnemies([battleEnemy], null)

    expect(materialBag.getAmount('doan_bao_thach')).toBe(1)
  })

  it('rơi vào bag + summary.items + notification đúng 1 lần', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { killEnemy, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialIds: ['doan_bao_thach'],
    })

    killEnemy()

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
    vi.spyOn(Math, 'random').mockReturnValue(0.999) // pool draw trượt đá, cô lập EXP

    const { killEnemy, loot, player } = createLootTestSetup({
      realmId: 'foundation_establishment',
      rewards: { techniqueInsight: 10, spiritStone: 0 },
      stage: FOUNDATION_STAGE,
      materialIds: ['doan_bao_thach'],
    })
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    killEnemy()

    // EXP đọc từ enemy.rewards (10) — KHÔNG phải từ drop table.
    expect(player.artifact?.experience).toBe(2)
    expect(loot.getSummary().artifactInsight).toBe(2)
  })

  it('không có artifact (Kiếm Tu) thì không crash, không cộng gì', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const { killEnemy, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      rewards: { techniqueInsight: 10, spiritStone: 0 },
      stage: FOUNDATION_STAGE,
      materialIds: ['doan_bao_thach'],
    })

    expect(() => killEnemy()).not.toThrow()
    expect(loot.getSummary().artifactInsight).toBe(0)
  })
})
