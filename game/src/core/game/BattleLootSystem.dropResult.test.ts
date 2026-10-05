import { afterEach, describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import {
  createLootTestSetup,
  TEST_EQUIPMENT_TEMPLATE,
} from './battleLootTestSetup'

// Drop-system Task 8 (2026-09-12): BattleLootSystem consumes the
// DropResult that resolveDrops already decided - stage/family tables and
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
      // Old-style per-enemy rewards are deliberately empty/zero - if any
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
    expect(gainMastery).toHaveBeenCalledWith(5, 'mortal', 1)
  })

  it('equipment_any draws a template through the equipment registry', () => {
    // rng[0] 0.8: mortal guaranteed line (0.7) misses. Pool draw at 0.1:
    // roll 0.1 * (20 + 113.33) ~= 13 lands inside the 15% hit band of the
    // gated mortal table (poolDrawChance 0.15) -> equipment_any entry.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8).mockReturnValue(0.1)
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
    // Guaranteed misses at 0.8; the lone pool draw hits at 0.1 (mortal
    // band gate: hit band = first 15% of the weighted roll).
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8).mockReturnValue(0.1)
    const { killEnemy, createInstance, equipmentBag } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    killEnemy()

    expect(equipmentBag.add).toHaveBeenCalledTimes(1)
    expect(createInstance.mock.calls[0]?.[4]).toBe(0)
  })

  // Gear-pace retune (2026-10-05): the stage floor that resolved the drop
  // table also caps the quality an equipment roll may reach
  // (ITEM_QUALITY_FLOOR_CEILING in ItemQualityBalance). createInstance arg
  // index 6 carries the resolved ceiling, so stage kills can no longer roll
  // end-game qualities on early floors. A kill with no stage context keeps
  // the flat ladder (undefined ceiling).
  it.each([
    [2, 'huyen'],
    [5, 'dia'],
    [8, 'thien'],
    [10, 'tien'],
  ] as const)('floor %i caps equipment roll quality at %s', (floor, expectedCeiling) => {
    // Guaranteed misses at 0.8; pool draw hits inside the gated mortal
    // band's 15% hit region at 0.1.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8).mockReturnValue(0.1)
    const { killEnemy, createInstance } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    killEnemy()

    expect(createInstance).toHaveBeenCalledTimes(1)
    expect(createInstance.mock.calls[0]?.[6]).toBe(expectedCeiling)
  })

  // A stage can legally omit `floor` (Stage.floor is optional; the
  // chapter builder normalizes requiredRealmLevel = floor). The ceiling
  // must still resolve through the canonical fallback, not fall uncapped.
  it('stage without floor resolves the ceiling via requiredRealmLevel', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8).mockReturnValue(0.1)
    const { killEnemy, createInstance } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: undefined, requiredRealmLevel: 7 },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    killEnemy()

    expect(createInstance).toHaveBeenCalledTimes(1)
    expect(createInstance.mock.calls[0]?.[6]).toBe('thien')
  })

  it('no stage context leaves the quality ladder uncapped', () => {
    // Signature line (chance 1) lands at 0.8; pool draw hits the gated
    // band at 0.1.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8).mockReturnValue(0.1)
    const { killEnemy, createInstance } = createLootTestSetup({
      realmId: 'mortal',
      signatureDrops: [{ kind: 'equipment', itemId: 'eq_test', chance: 1 }],
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    killEnemy()

    // Two grants land (stage-table equipment_any draw + the signature
    // equipment line); BOTH resolve with no floor, so both stay uncapped.
    expect(createInstance).toHaveBeenCalledTimes(2)
    for (const call of createInstance.mock.calls) {
      expect(call[6]).toBeUndefined()
    }
  })

  it('idle channel strips the elite tag: boss kill draws 4, not 5, and earns no quality steps', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8).mockReturnValue(0.1)
    const { loot, killEnemy, createInstance, equipmentBag } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
      equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
    })

    loot.setChannel('idle')
    // rng 0.8 then 0.1: guaranteed misses, every pool draw lands on
    // equipment_any inside the gated band's 15% hit region.
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
    // M-QI-10: the qi_refining band guaranteed line is live - rng 0
    // passes its 0.7 chance, so the kill emits the band's bao essence
    // AND the synthetic signature drop. Both route to 'essence'.
    expect(materialParticles).toEqual([
      ['reward_particle', expect.objectContaining({ kind: 'essence' })],
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

describe('BattleLootSystem — hidden_window_opened emit (Sound System W6)', () => {
  it('emits one event per channel id the kill crossed', () => {
    const { killEnemy, eventBus, deps } = createLootTestSetup({})
    const opened = deps.hiddenBeast.onEnemyDefeated as unknown as ReturnType<typeof vi.fn>
    opened.mockReturnValue(['chan_a', 'chan_b'])

    killEnemy()

    const calls = eventBus.emit.mock.calls
      .map((args) => args[1])
      .filter((e) => (e as { type?: string }).type === 'hidden_window_opened')
    expect(calls).toEqual([
      { type: 'hidden_window_opened', channelId: 'chan_a' },
      { type: 'hidden_window_opened', channelId: 'chan_b' },
    ])
  })

  it('empty crossing report emits nothing', () => {
    const { killEnemy, eventBus } = createLootTestSetup({})
    killEnemy()
    const calls = eventBus.emit.mock.calls
      .map((args) => args[1])
      .filter((e) => (e as { type?: string }).type === 'hidden_window_opened')
    expect(calls).toHaveLength(0)
  })
})
