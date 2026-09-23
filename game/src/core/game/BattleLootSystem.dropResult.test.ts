import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLootTestSetup,
  TEST_EQUIPMENT_TEMPLATE,
} from './battleLootTestSetup'

// Drop-system Task 8 (2026-09-12): BattleLootSystem consumes the
// DropResult that resolveDrops already decided — stage/family tables and
// signature drops are the source of truth, enemy.rewards is no longer a
// loot table. These tests pin that boundary: WHAT drops comes from the
// resolver, HOW it lands (bags, toasts, particles, summary) stays here.
describe('BattleLootSystem — DropResult consumer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('grants what the resolver returned, not what the enemy authored', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, materialBag, giveReward, loot, gainMastery } = createLootTestSetup({
      // Old-style per-enemy rewards are deliberately empty/zero — if any
      // loot still flows, it came from the tables, not from the enemy.
      rewards: { techniqueMastery: 0, spiritStone: 0 },
      realmId: 'mortal',
      family: 'boar',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
      materialIds: ['tinh_hoa_pham_the'],
    })

    killEnemy()

    // Mortal stage guaranteed line: tinh_hoa_pham_the chance 0.7 passes at
    // rng 0, amount roll lands on min 1.
    expect(materialBag.getAmount('tinh_hoa_pham_the')).toBe(1)
    // Currency comes from the stage table (mortal min: 1 stone / 5
    // insight), NOT from enemy.rewards which authored 0/0.
    expect(giveReward).toHaveBeenCalledTimes(1)
    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 1 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(5)
  })

  it('equipment_any draws a template through the equipment registry', () => {
    // rng 0.8: mortal guaranteed line (0.7) misses; pool draw roll
    // 0.8 * 35 = 28 -> past base_kiem (15) -> equipment_any entry.
    vi.spyOn(Math, 'random').mockReturnValue(0.8)
    const { killEnemy, equipmentBag, createInstance } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    killEnemy()

    expect(createInstance).toHaveBeenCalledTimes(1)
    expect(equipmentBag.add).toHaveBeenCalledTimes(1)
  })

  it('passes qualityBonusSteps from the stacked modifiers into createInstance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, createInstance } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE, { id: 'base_kiem', name: 'Kiếm' }],
    })

    // Boss + elite on the active channel -> [boss, tinh_anh] -> 5 pool
    // draws (all land on base_kiem at rng 0) and qualityBonusSteps = 1.
    killEnemy({ isBoss: true, isElite: true })

    expect(createInstance).toHaveBeenCalled()
    expect(createInstance.mock.calls[0]?.[4]).toBe(1)
  })

  it('plain kill carries no modifier: 1 pool draw, 0 quality steps', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8)
    const { killEnemy, createInstance, equipmentBag } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    killEnemy()

    expect(equipmentBag.add).toHaveBeenCalledTimes(1)
    expect(createInstance.mock.calls[0]?.[4]).toBe(0)
  })

  it('idle channel strips the elite tag: boss kill draws 4, not 5, and earns no quality steps', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8)
    const { loot, killEnemy, createInstance, equipmentBag } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    loot.setChannel('idle')
    // rng 0.8: guaranteed misses, every pool draw lands on equipment_any.
    // Boss survives on idle (4 draws); the tinh_anh tag is stripped, so
    // no 5th draw and no quality bonus.
    killEnemy({ isBoss: true, isElite: true })

    expect(equipmentBag.add).toHaveBeenCalledTimes(4)
    expect(createInstance.mock.calls[0]?.[4]).toBe(0)
  })

  it('signature drops land through the material bag even without a stage table', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'qi_refining',
      signatureDrops: [
        { kind: 'material', itemId: 'sig_mat', chance: 1, amount: { min: 2, max: 2 } },
      ],
      materialIds: ['sig_mat'],
    })

    killEnemy()

    expect(materialBag.getAmount('sig_mat')).toBe(2)
  })

  it('signature requiresModifier gates the drop: plain kill skips it, boss kill earns it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const signatureDrops = [
      { kind: 'material' as const, itemId: 'sig_mat', chance: 1, requiresModifier: 'boss' },
    ]
    const first = createLootTestSetup({ realmId: 'mortal', signatureDrops, materialIds: ['sig_mat'] })

    first.killEnemy()

    expect(first.materialBag.getAmount('sig_mat')).toBe(0)

    const second = createLootTestSetup({ realmId: 'mortal', signatureDrops, materialIds: ['sig_mat'] })

    second.killEnemy({ isBoss: true })

    expect(second.materialBag.getAmount('sig_mat')).toBe(1)
  })

  // M-QI-08 - the essence particle stream is family-wide: any authored
  // Tinh Hoa <Grade> material routes to 'essence', not by literal id.
  it('routes every physique-essence family member to the essence particle stream', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, eventBus } = createLootTestSetup({
      realmId: 'qi_refining',
      signatureDrops: [
        { kind: 'material', itemId: 'tinh_hoa_bao_the', chance: 1, amount: { min: 1, max: 1 } },
      ],
      materialIds: ['tinh_hoa_bao_the'],
    })

    killEnemy()

    const materialParticles = eventBus.emit.mock.calls.filter(
      (call) =>
        call[0] === 'reward_particle' &&
        (call[1].kind === 'essence' || call[1].kind === 'item'),
    )
    expect(materialParticles).toEqual([
      ['reward_particle', expect.objectContaining({ kind: 'essence' })],
    ])
  })

  it('keeps non-family materials on the item particle path', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, eventBus } = createLootTestSetup({
      realmId: 'qi_refining',
      signatureDrops: [
        { kind: 'material', itemId: 'sig_mat', chance: 1, amount: { min: 1, max: 1 } },
      ],
      materialIds: ['sig_mat'],
    })

    killEnemy()

    const materialParticles = eventBus.emit.mock.calls.filter(
      (call) =>
        call[0] === 'reward_particle' &&
        (call[1].kind === 'essence' || call[1].kind === 'item'),
    )
    expect(materialParticles).toEqual([
      ['reward_particle', expect.objectContaining({ kind: 'item' })],
    ])
  })
})
