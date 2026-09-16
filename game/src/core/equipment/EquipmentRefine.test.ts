// EquipmentRefine — module-level coverage for the exported surface that
// the system-level suite (EquipmentSystem.test.ts "Tinh Luyen" block)
// cannot reach: the pending-slot accessor contract, scoped preview
// cancel semantics, guard inputs that need unusual items (zero affix
// lines, unregistered template, contract-violating bag), the one-slot
// replace rule end to end, and the RefineDeps call contract.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { makeInstance } from './EquipmentInstance.fixture'
import { captureEquipmentInstanceSnapshot } from './EquipmentInstanceSnapshot'
import {
  commitRefineValues,
  createRefinePendingSlotAccessor,
  discardRefinePreview,
  invalidatePendingRefinePreview,
  previewRefineValues,
  refineAffixValues,
  type RefineDeps,
  type RefineValueEntry,
} from './EquipmentRefine'
import {
  REFINE_SPIRIT_STONE_PER_UNIT,
  REFINE_TINH_HOA_COST_BY_QUALITY,
} from './RefinementBalance'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import {
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
} from '../material/SpiritStoneMaterial'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'might', min: 10, max: 20 }],
  enhanceCost: [{ materialId: 'qi_refining_ore_century', amount: 1 }],
}

const ESSENCE = materials.find((material) => material.id === LUYEN_KHI_TINH_HOA_ID)!

function setup() {
  const bag = new EquipmentBag()
  const registry = new EquipmentRegistry()
  const affixRegistry = new AffixRegistry()
  const slotManager = new EquipmentSlotManager()
  const materialBag = new MaterialBag()

  registry.register(TEMPLATE)
  for (const affix of affixes) {
    affixRegistry.register(affix)
  }
  materialBag.add(ESSENCE, 1_000)
  materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

  // Hand-bound RefineDeps — same wiring EquipmentSystem.refineDeps()
  // builds, kept local so dep call counts are directly observable.
  const refinePendingSlot = createRefinePendingSlotAccessor()
  const applyCostDiscount = vi.fn((amount: number) => amount)
  const spendItemRefinementPoints = vi.fn((instance: EquipmentInstance, amount: number) => {
    instance.forgeUsesRemaining = Math.max(0, instance.forgeUsesRemaining - amount)
  })
  const refreshEquippedModifiers = vi.fn()
  const deps: RefineDeps = {
    applyCostDiscount,
    itemRefinementPoints: (instance) => instance.forgeUsesRemaining,
    spendItemRefinementPoints,
    refreshEquippedModifiers,
    refinePendingSlot,
  }

  return {
    bag,
    registry,
    affixRegistry,
    slotManager,
    materialBag,
    deps,
    refinePendingSlot,
    applyCostDiscount,
    spendItemRefinementPoints,
    refreshEquippedModifiers,
  }
}

type Ctx = ReturnType<typeof setup>

// Two eligible tier-2 lines (prefix_attack 7..12, prefix_max_hp 21..40)
// with a full per-item forge budget from the fixture.
function refinableInstance(
  instanceId: string,
  overrides: Partial<EquipmentInstance> = {},
): EquipmentInstance {
  return makeInstance({
    instanceId,
    itemId: TEMPLATE.id,
    grade: 'bat_pham',
    quality: 'hoang',
    affixes: [
      { affixId: affixes[0]!.id, tier: 2, value: 8 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
    ],
    ...overrides,
  })
}

function preview(
  ctx: Ctx,
  instanceId: string,
  lockedIndices: readonly number[] = [],
  random: () => number = () => 0,
) {
  return previewRefineValues(
    instanceId,
    lockedIndices,
    ctx.bag,
    ctx.registry,
    ctx.materialBag,
    ctx.affixRegistry,
    ctx.deps,
    random,
  )
}

function commit(ctx: Ctx, instanceId: string, values: readonly RefineValueEntry[]) {
  return commitRefineValues(
    instanceId,
    values,
    ctx.bag,
    ctx.slotManager,
    ctx.affixRegistry,
    ctx.deps,
  )
}

function balances(ctx: Ctx) {
  return {
    essence: ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID),
    stones: ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID),
  }
}

describe('createRefinePendingSlotAccessor', () => {
  it('starts empty and round-trips set/get until set(null)', () => {
    const slot = createRefinePendingSlotAccessor()
    expect(slot.get()).toBeNull()

    const instance = makeInstance()
    const pending = {
      instance,
      membershipGeneration: 1,
      snapshot: captureEquipmentInstanceSnapshot(instance),
      values: [{ index: 0, value: 8.4 }],
    }

    slot.set(pending)
    expect(slot.get()).toBe(pending)

    slot.set(null)
    expect(slot.get()).toBeNull()
  })

  it('keeps each accessor isolated — capabilities never leak across slots', () => {
    const first = createRefinePendingSlotAccessor()
    const second = createRefinePendingSlotAccessor()
    const instance = makeInstance()

    second.set({
      instance,
      membershipGeneration: 1,
      snapshot: captureEquipmentInstanceSnapshot(instance),
      values: [],
    })

    expect(first.get()).toBeNull()
    expect(second.get()?.instance).toBe(instance)
  })
})

describe('discardRefinePreview — scoped cancel semantics', () => {
  it('is a no-op on an empty slot for both scoped and unscoped calls', () => {
    const ctx = setup()

    expect(() => {
      discardRefinePreview(ctx.deps)
      discardRefinePreview(ctx.deps, 'ghost-id')
    }).not.toThrow()
    expect(ctx.refinePendingSlot.get()).toBeNull()
  })

  it('discard for a different instanceId preserves the paid capability', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-scoped')
    ctx.bag.add(instance)
    const result = preview(ctx, instance.instanceId)
    expect(result.ok).toBe(true)

    discardRefinePreview(ctx.deps, 'some-other-item')

    expect(ctx.refinePendingSlot.get()).not.toBeNull()
    expect(commit(ctx, instance.instanceId, result.values ?? [])).toEqual({ ok: true })
    expect(instance.affixes[0]!.value).toBeCloseTo(8.4, 12)
  })

  it('discard without instanceId unconditionally clears the pending capability', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-unscoped')
    ctx.bag.add(instance)
    const result = preview(ctx, instance.instanceId)
    expect(result.ok).toBe(true)

    discardRefinePreview(ctx.deps)

    expect(ctx.refinePendingSlot.get()).toBeNull()
    expect(commit(ctx, instance.instanceId, result.values ?? [])).toEqual({
      ok: false,
      reason: 'invalid_refine_preview',
    })
    expect(instance.affixes[0]!.value).toBe(8)
  })

  it('discard with the bound instanceId still clears after the item left the bag', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-removed')
    ctx.bag.add(instance)
    expect(preview(ctx, instance.instanceId).ok).toBe(true)
    expect(ctx.refinePendingSlot.get()).not.toBeNull()

    // The scope check reads pending.instance.instanceId (the captured
    // object), not the bag contents — the cancel survives the removal.
    ctx.bag.remove(instance.instanceId)
    discardRefinePreview(ctx.deps, instance.instanceId)

    expect(ctx.refinePendingSlot.get()).toBeNull()
  })
})

describe('invalidatePendingRefinePreview', () => {
  it('clears the pending capability unconditionally (session-restore path)', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-invalidate')
    ctx.bag.add(instance)
    const result = preview(ctx, instance.instanceId)
    expect(result.ok).toBe(true)

    invalidatePendingRefinePreview(ctx.deps)

    expect(ctx.refinePendingSlot.get()).toBeNull()
    expect(commit(ctx, instance.instanceId, result.values ?? [])).toEqual({
      ok: false,
      reason: 'invalid_refine_preview',
    })
    expect(instance.affixes[0]!.value).toBe(8)
  })
})

describe('roll guards not exercised at system level', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('item with zero affix lines rejects no_affixes before any spend or RNG', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-no-affix', { affixes: [] })
    ctx.bag.add(instance)
    const forgeBefore = instance.forgeUsesRemaining
    const before = balances(ctx)
    const random = vi.fn(() => 0)

    const result = preview(ctx, instance.instanceId, [], random)

    expect(result).toEqual({ ok: false, reason: 'no_affixes' })
    expect(random).not.toHaveBeenCalled()
    expect(instance.forgeUsesRemaining).toBe(forgeBefore)
    expect(balances(ctx)).toEqual(before)
    expect(ctx.refinePendingSlot.get()).toBeNull()
  })

  it('instance in the bag whose itemId is not registered rejects not_found', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-ghost-template', {
      itemId: 'unregistered-template',
    })
    ctx.bag.add(instance)
    const forgeBefore = instance.forgeUsesRemaining
    const before = balances(ctx)

    const result = preview(ctx, instance.instanceId)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(instance.forgeUsesRemaining).toBe(forgeBefore)
    expect(balances(ctx)).toEqual(before)
    expect(ctx.refinePendingSlot.get()).toBeNull()
  })

  it.each([
    ['duplicate index', [0, 0]],
    ['negative index', [-1]],
    ['non-integer index', [0.5]],
    ['NaN index', [Number.NaN]],
  ] as const)('lock selection with %s rejects invalid_lock atomically', (_case, lockedIndices) => {
    const ctx = setup()
    const instance = refinableInstance('refine-bad-lock')
    ctx.bag.add(instance)
    const affixesBefore = structuredClone(instance.affixes)
    const forgeBefore = instance.forgeUsesRemaining
    const before = balances(ctx)

    const result = preview(ctx, instance.instanceId, lockedIndices)

    expect(result).toEqual({ ok: false, reason: 'invalid_lock' })
    expect(instance.affixes).toEqual(affixesBefore)
    expect(instance.forgeUsesRemaining).toBe(forgeBefore)
    expect(balances(ctx)).toEqual(before)
    expect(ctx.refinePendingSlot.get()).toBeNull()
  })

  it('locking the only affix line rejects cannot_lock_all (lineCount = 1 boundary)', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-single-line', {
      affixes: [{ affixId: affixes[0]!.id, tier: 2, value: 8 }],
    })
    ctx.bag.add(instance)
    const before = balances(ctx)

    const result = preview(ctx, instance.instanceId, [0])

    expect(result).toEqual({ ok: false, reason: 'cannot_lock_all' })
    expect(balances(ctx)).toEqual(before)
    expect(ctx.refinePendingSlot.get()).toBeNull()
  })

  it('a bag that breaks the membership contract rejects not_found with zero spend', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-broken-bag')
    ctx.bag.add(instance)
    // Contract-violating bag: get() resolves the object yet reports no
    // membership generation. The pre-transaction guard must still stop
    // the roll from spending anything.
    vi.spyOn(ctx.bag, 'getMembershipGeneration').mockReturnValue(undefined)
    const forgeBefore = instance.forgeUsesRemaining
    const before = balances(ctx)

    const result = preview(ctx, instance.instanceId)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(instance.forgeUsesRemaining).toBe(forgeBefore)
    expect(balances(ctx)).toEqual(before)
    expect(ctx.refinePendingSlot.get()).toBeNull()
  })
})

describe('single pending capability', () => {
  it('a successful preview on another item replaces the paid preview (one slot)', () => {
    const ctx = setup()
    const first = refinableInstance('refine-item-a')
    const second = refinableInstance('refine-item-b')
    ctx.bag.add(first)
    ctx.bag.add(second)

    const previewA = preview(ctx, first.instanceId)
    expect(previewA.ok).toBe(true)
    expect(ctx.refinePendingSlot.get()?.instance).toBe(first)

    const previewB = preview(ctx, second.instanceId)
    expect(previewB.ok).toBe(true)

    // The single slot now binds item B — item A's paid payload is dead.
    // (Asserted before any commit: every commit attempt consumes the slot.)
    expect(ctx.refinePendingSlot.get()?.instance).toBe(second)
    expect(ctx.refinePendingSlot.get()?.values).toEqual(previewB.values)

    expect(commit(ctx, second.instanceId, previewB.values ?? [])).toEqual({ ok: true })
    expect(second.affixes[0]!.value).toBeCloseTo(8.4, 12)

    expect(commit(ctx, first.instanceId, previewA.values ?? [])).toEqual({
      ok: false,
      reason: 'invalid_refine_preview',
    })
    expect(first.affixes[0]!.value).toBe(8)
  })

  it('refineAffixValues consumes its own capability — the rolled payload cannot be committed', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-one-shot')
    ctx.bag.add(instance)

    const result = refineAffixValues(
      instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      ctx.deps,
      () => 0,
    )

    expect(result).toEqual({ ok: true })
    expect(instance.affixes[0]!.value).toBeCloseTo(8.4, 12)
    expect(instance.affixes[1]!.value).toBeCloseTo(26.25, 12)
    expect(ctx.refinePendingSlot.get()).toBeNull()

    // The internal commit already consumed the slot — replaying the same
    // rolled values through commitRefineValues is rejected.
    expect(
      commit(ctx, instance.instanceId, [
        { index: 0, value: 8.4 },
        { index: 1, value: 26.25 },
      ]),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
  })
})

describe('RefineDeps call contract', () => {
  it('prices essence and spirit stone through applyCostDiscount as separate raw amounts', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-dep-pricing')
    ctx.bag.add(instance)

    const result = preview(ctx, instance.instanceId, [0])

    expect(result.ok).toBe(true)
    expect(ctx.applyCostDiscount).toHaveBeenCalledTimes(2)
    expect(ctx.applyCostDiscount).toHaveBeenNthCalledWith(
      1,
      REFINE_TINH_HOA_COST_BY_QUALITY[instance.quality],
    )
    expect(ctx.applyCostDiscount).toHaveBeenNthCalledWith(
      2,
      (instance.affixes.length + 1) * REFINE_SPIRIT_STONE_PER_UNIT,
    )
    expect(ctx.spendItemRefinementPoints).toHaveBeenCalledTimes(1)
    expect(ctx.spendItemRefinementPoints).toHaveBeenCalledWith(instance, 1)
  })

  it('a successful commit refreshes equipped modifiers exactly once; a rejected commit never does', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-dep-refresh')
    ctx.bag.add(instance)
    const result = preview(ctx, instance.instanceId)
    expect(result.ok).toBe(true)

    expect(commit(ctx, instance.instanceId, result.values ?? [])).toEqual({ ok: true })
    expect(ctx.refreshEquippedModifiers).toHaveBeenCalledTimes(1)
    expect(ctx.refreshEquippedModifiers).toHaveBeenCalledWith(
      instance,
      ctx.slotManager,
      ctx.affixRegistry,
    )

    // Rejected commit path (tampered payload) must not touch modifiers.
    const second = preview(ctx, instance.instanceId)
    expect(second.ok).toBe(true)
    expect(
      commit(ctx, instance.instanceId, [{ index: 0, value: 999 }]),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.refreshEquippedModifiers).toHaveBeenCalledTimes(1)
  })

  it('stores the capability payload detached — mutating the returned values cannot poison it', () => {
    const ctx = setup()
    const instance = refinableInstance('refine-detach')
    ctx.bag.add(instance)
    const result = preview(ctx, instance.instanceId)
    expect(result.ok).toBe(true)

    // Caller mutates its display copy; the stored capability must keep
    // the issued values, so the tampered array no longer matches.
    result.values![0]!.value = 999

    expect(commit(ctx, instance.instanceId, result.values ?? [])).toEqual({
      ok: false,
      reason: 'invalid_refine_preview',
    })
    expect(instance.affixes[0]!.value).toBe(8)
  })
})
