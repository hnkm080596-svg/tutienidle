import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLootTestSetup } from './battleLootTestSetup'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { remainingEssenceNeed } from '../realm/body/BodyProgressionSystem'

// Owner ruling 2026-10-10 - essence intake cap: a physique-essence drop
// credits the material bag only while the bag holds less than the
// essence's remaining chapter-chain requirement; at/above the cap the
// drop yields nothing (skipped entirely - no conversion, no landing).
describe('BattleLootSystem - physique essence intake cap', () => {
  // QA fixpoint 2026-10-10: restore spies between tests - a leaked
  // Math.random pin would silently leak across cases otherwise.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const phamSig = {
    kind: 'material' as const,
    itemId: TINH_HOA_PHAM_THE_MATERIAL_ID,
    chance: 1,
    amount: { min: 5, max: 5 },
  }

  it('credits the drop while owned stays below the remaining chapter need', () => {
    // rng 0.999: the mortal band's 0.7 guaranteed essence line misses,
    // so only the signature drop lands - deterministic bag count.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const { killEnemy, materialBag, player } = createLootTestSetup({
      signatureDrops: [phamSig],
      materialIds: [TINH_HOA_PHAM_THE_MATERIAL_ID],
    })

    // Fresh player: the full body_refinement track is still open.
    expect(remainingEssenceNeed(player, TINH_HOA_PHAM_THE_MATERIAL_ID)).toBeGreaterThan(0)

    killEnemy()

    expect(materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(5)
  })

  it('skips credit once owned covers the whole remaining need', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const { killEnemy, materialBag, materialRegistry, player, deps, eventBus } = createLootTestSetup({
      signatureDrops: [phamSig],
      materialIds: [TINH_HOA_PHAM_THE_MATERIAL_ID],
    })

    // 5/6 tiers done, 7960/8000 in the last -> exactly 40 left to spend.
    player.bodyProgression.body_refinement.completedTiers = 5
    player.bodyProgression.body_refinement.currentTierProgress = 7960
    materialBag.add(materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID), 40)

    killEnemy()

    expect(materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(40)
    expect(deps.notifyMaterialGained).not.toHaveBeenCalled()
    // No presentation either - a capped drop emits no essence stream.
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      'reward_particle',
      expect.objectContaining({ kind: 'essence' }),
    )
  })

  it('credits the drop while a gap remains below the need', () => {
    // Same pin as the first test - an unmocked band roll would add 1-3
    // pham on top of the signature and flake the count.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const { killEnemy, materialBag, materialRegistry, player } = createLootTestSetup({
      signatureDrops: [phamSig],
      materialIds: [TINH_HOA_PHAM_THE_MATERIAL_ID],
    })

    player.bodyProgression.body_refinement.completedTiers = 5
    player.bodyProgression.body_refinement.currentTierProgress = 7960
    materialBag.add(materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID), 30)

    killEnemy()

    expect(materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(35)
  })

  it('clamps the credit so the bag never overshoots the remaining need', () => {
    // QA fixpoint 2026-10-10 - the gate is also a clamp: owned 38 of a
    // 40 need leaves only 2 open, so a 5-drop credits just the gap.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const { killEnemy, materialBag, materialRegistry, player } = createLootTestSetup({
      signatureDrops: [phamSig],
      materialIds: [TINH_HOA_PHAM_THE_MATERIAL_ID],
    })

    player.bodyProgression.body_refinement.completedTiers = 5
    player.bodyProgression.body_refinement.currentTierProgress = 7960
    materialBag.add(materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID), 38)

    killEnemy()

    expect(materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(40)
  })

  it('skips credit when owned already exceeds the need', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const { killEnemy, materialBag, materialRegistry, player, deps, eventBus } = createLootTestSetup({
      signatureDrops: [phamSig],
      materialIds: [TINH_HOA_PHAM_THE_MATERIAL_ID],
    })

    player.bodyProgression.body_refinement.completedTiers = 5
    player.bodyProgression.body_refinement.currentTierProgress = 7960
    materialBag.add(materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID), 45)

    killEnemy()

    expect(materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(45)
    expect(deps.notifyMaterialGained).not.toHaveBeenCalled()
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      'reward_particle',
      expect.objectContaining({ kind: 'essence' }),
    )
  })

  it('an essence with no consuming chapter yields nothing', () => {
    // tinh_hoa_bao_the is authored but no body chapter spends it today:
    // remainingEssenceNeed is 0, so even an empty bag is at the cap.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const { killEnemy, materialBag, deps, eventBus } = createLootTestSetup({
      signatureDrops: [
        {
          kind: 'material',
          itemId: 'tinh_hoa_bao_the',
          chance: 1,
          amount: { min: 5, max: 5 },
        },
      ],
      materialIds: ['tinh_hoa_bao_the'],
    })

    killEnemy()

    expect(materialBag.getAmount('tinh_hoa_bao_the')).toBe(0)
    expect(deps.notifyMaterialGained).not.toHaveBeenCalled()
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      'reward_particle',
      expect.objectContaining({ kind: 'essence' }),
    )
  })
})
