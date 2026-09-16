// Module-level coverage for EquipmentWash.ts branches that the
// system-level suites (EquipmentSystem.wash.test.ts,
// EquipmentWash.pending.test.ts) cannot reach through the bound
// EquipmentSystem deps: the pending-slot accessor contract, read-model
// mismatch branches, the defensive roll guards (unregistered item,
// missing template via injected deps, unbindable membership), the
// opposite-kind fallback, the Tien exalted edge cases, and commit
// ticket-id/instance-id mismatches.
import { describe, expect, it } from 'vitest'
import {
  commitWashAffixes,
  createWashPendingSlotAccessor,
  discardWashTicket,
  getWashPreviewAffixes,
  invalidatePendingWashTicket,
  previewWashAffixes,
  type PendingWashSlot,
  type WashDeps,
  type WashPendingSlotAccessor,
} from './EquipmentWash'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import type { Affix } from './Affix'
import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { makeInstance } from './EquipmentInstance.fixture'
import { captureEquipmentInstanceSnapshot } from './EquipmentInstanceSnapshot'
import { WASH_SPIRIT_STONE_COST, WASH_TINH_HOA_COST_BY_QUALITY } from './RefinementBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'
import { SPIRIT_STONE_MATERIAL, SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import { materials } from '../../data/materials/materials'

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

const TIERS: Affix['tiers'] = [
  { tier: 1, min: 5, max: 5 },
  { tier: 2, min: 10, max: 10 },
  { tier: 3, min: 15, max: 15 },
]

const PREFIX_CRIT: Affix = {
  id: 'mod-prefix-crit',
  name: 'Module prefix crit',
  stat: 'criticalRate',
  kind: 'prefix',
  pool: 'basic',
  slots: ['weapon'],
  tiers: TIERS,
}

const SUFFIX_ACCURACY: Affix = {
  id: 'mod-suffix-accuracy',
  name: 'Module suffix accuracy',
  stat: 'accuracyRating',
  kind: 'suffix',
  pool: 'basic',
  slots: ['weapon'],
  tiers: TIERS,
}

const STANDARD_AFFIXES: readonly Affix[] = [PREFIX_CRIT, SUFFIX_ACCURACY]

const SENTINEL_AFFIXES = [{ affixId: 'pre-existing-affix', tier: 1, value: 3 }]

interface WashContext {
  bag: EquipmentBag
  registry: EquipmentRegistry
  affixRegistry: AffixRegistry
  slotManager: EquipmentSlotManager
  materialBag: MaterialBag
  slot: WashPendingSlotAccessor
  deps: WashDeps
  refreshed: EquipmentInstance[]
}

function setup(affixList: readonly Affix[] = STANDARD_AFFIXES): WashContext {
  const bag = new EquipmentBag()
  const registry = new EquipmentRegistry()
  const affixRegistry = new AffixRegistry()
  const slotManager = new EquipmentSlotManager()
  const materialBag = new MaterialBag()
  const slot = createWashPendingSlotAccessor()

  registry.register(TEMPLATE)
  for (const affix of affixList) {
    affixRegistry.register(affix)
  }
  materialBag.add(ESSENCE, 1_000)
  materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

  // Mirrors the EquipmentSystem.washDeps() bindings (tryGetTemplate
  // wrapper, balance-table cost, forge-use spend, equipped refresh).
  const refreshed: EquipmentInstance[] = []
  const deps: WashDeps = {
    tryGetTemplate: (equipmentRegistry, itemId) =>
      equipmentRegistry.has(itemId) ? equipmentRegistry.get(itemId) : undefined,

    getWashCost: (quality) => ({
      tinhHoa: WASH_TINH_HOA_COST_BY_QUALITY[quality],
      spiritStone: WASH_SPIRIT_STONE_COST,
    }),

    spendItemRefinementPoints: (instance, amount) => {
      instance.forgeUsesRemaining = Math.max(0, instance.forgeUsesRemaining - amount)
    },

    refreshEquippedModifiers: (instance) => {
      refreshed.push(instance)
    },

    washPendingSlot: slot,
  }

  return { bag, registry, affixRegistry, slotManager, materialBag, slot, deps, refreshed }
}

function washable(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return makeInstance({
    instanceId: 'wash-module-item',
    itemId: TEMPLATE.id,
    grade: 'bat_pham',
    quality: 'hoang',
    mainStat: {
      id: 'main-might',
      sourceId: 'main',
      sourceType: 'equipment',
      stat: 'might',
      flat: 15,
    },
    affixes: structuredClone(SENTINEL_AFFIXES),
    ...overrides,
  })
}

function preview(ctx: WashContext, instanceId: string, rolls: number[] = [0.99]) {
  return previewWashAffixes(
    instanceId,
    ctx.bag,
    ctx.registry,
    ctx.materialBag,
    ctx.affixRegistry,
    ctx.deps,
    () => rolls.shift() ?? 0,
  )
}

function previewOk(ctx: WashContext, instanceId: string, rolls?: number[]): string {
  const result = preview(ctx, instanceId, rolls)
  expect(result.ok).toBe(true)
  if (!result.ticketId) {
    throw new Error('preview did not issue a ticket')
  }
  return result.ticketId
}

function commit(ctx: WashContext, instanceId: string, ticketId: string) {
  return commitWashAffixes(
    instanceId,
    ticketId,
    ctx.bag,
    ctx.slotManager,
    ctx.affixRegistry,
    ctx.deps,
  )
}

describe('createWashPendingSlotAccessor', () => {
  it('starts empty; set/get round-trips the exact slot and set(null) clears it', () => {
    const slot = createWashPendingSlotAccessor()
    expect(slot.get()).toBeNull()

    const instance = makeInstance()
    const pending: PendingWashSlot = {
      ticketId: 'ticket-1',
      instance,
      membershipGeneration: 1,
      snapshot: captureEquipmentInstanceSnapshot(instance),
      affixes: [{ affixId: 'a', tier: 1, value: 1 }],
    }

    slot.set(pending)
    expect(slot.get()).toBe(pending)

    slot.set(null)
    expect(slot.get()).toBeNull()
  })

  it('nextTicketId issues unique ids with an incrementing counter prefix', () => {
    const slot = createWashPendingSlotAccessor()

    const first = slot.nextTicketId()
    const second = slot.nextTicketId()

    expect(first).not.toBe(second)
    expect(first.startsWith('wash-ticket-1-')).toBe(true)
    expect(second.startsWith('wash-ticket-2-')).toBe(true)
  })
})

describe('getWashPreviewAffixes', () => {
  it('returns undefined when nothing is pending and for a mismatched ticketId (a read, not a consume)', () => {
    const ctx = setup()
    expect(getWashPreviewAffixes(ctx.slot, 'anything')).toBeUndefined()

    const instance = washable()
    ctx.bag.add(instance)
    const ticketId = previewOk(ctx, instance.instanceId)

    expect(getWashPreviewAffixes(ctx.slot, 'wrong-ticket')).toBeUndefined()

    // The mismatch only hides the copy — the pending ticket survives.
    expect(ctx.slot.get()).not.toBeNull()
    expect(getWashPreviewAffixes(ctx.slot, ticketId)).toBeDefined()
  })

  it('returns a detached display copy — mutating it cannot corrupt the paid roll', () => {
    const ctx = setup()
    const instance = washable()
    ctx.bag.add(instance)
    const ticketId = previewOk(ctx, instance.instanceId)

    const display = getWashPreviewAffixes(ctx.slot, ticketId)!
    expect(display.affixes).toHaveLength(1)
    display.affixes[0]!.value = -999
    display.affixes[0]!.affixId = 'forged-affix'

    expect(commit(ctx, instance.instanceId, ticketId).ok).toBe(true)
    expect(instance.affixes).toEqual([{ affixId: PREFIX_CRIT.id, tier: 1, value: 5 }])
    // Commit delegates the equipped-modifier refresh through deps.
    expect(ctx.refreshed).toEqual([instance])
  })
})

describe('discardWashTicket', () => {
  it('ignores empty slots and mismatched ids — the pending ticket still commits', () => {
    const ctx = setup()
    expect(() => discardWashTicket(ctx.slot, 'nothing-pending')).not.toThrow()

    const instance = washable()
    ctx.bag.add(instance)
    const ticketId = previewOk(ctx, instance.instanceId)

    discardWashTicket(ctx.slot, 'someone-elses-ticket')
    expect(getWashPreviewAffixes(ctx.slot, ticketId)).toBeDefined()

    expect(commit(ctx, instance.instanceId, ticketId).ok).toBe(true)
    expect(instance.affixes).toEqual([{ affixId: PREFIX_CRIT.id, tier: 1, value: 5 }])
  })
})

describe('invalidatePendingWashTicket', () => {
  it('drops the pending ticket unconditionally — commit reports no_pending_wash', () => {
    const ctx = setup()
    const instance = washable()
    ctx.bag.add(instance)
    const ticketId = previewOk(ctx, instance.instanceId)

    invalidatePendingWashTicket(ctx.slot)

    expect(ctx.slot.get()).toBeNull()
    expect(getWashPreviewAffixes(ctx.slot, ticketId)).toBeUndefined()
    expect(commit(ctx, instance.instanceId, ticketId)).toEqual({
      ok: false,
      reason: 'no_pending_wash',
    })
    expect(instance.affixes).toEqual(SENTINEL_AFFIXES)
  })
})

describe('previewWashAffixes — roll-time guards', () => {
  it('rejects not_found when the instanceId is absent from the bag', () => {
    const ctx = setup()
    expect(preview(ctx, 'missing-item')).toEqual({ ok: false, reason: 'not_found' })
  })

  it('rejects not_found when the instance itemId is not registered', () => {
    const ctx = setup()
    const ghost = washable({ itemId: 'unregistered-template' })
    ctx.bag.add(ghost)

    expect(preview(ctx, ghost.instanceId)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('rejects template_not_found when the injected template lookup resolves nothing', () => {
    const ctx = setup()
    // registry.has() passes — only the deps lookup fails (EquipmentSystem's
    // binding cannot reach this; the seam exists for other hosts).
    ctx.deps.tryGetTemplate = () => undefined
    const instance = washable()
    ctx.bag.add(instance)
    const usesBefore = instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(preview(ctx, instance.instanceId)).toEqual({ ok: false, reason: 'template_not_found' })
    expect(instance.forgeUsesRemaining).toBe(usesBefore)
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('rejects not_found when the bag cannot bind a membership generation — nothing is charged', () => {
    const ctx = setup()
    const instance = washable()
    ctx.bag.add(instance)
    // Misbehaving-bag seam: get() proves membership but the generation
    // capability is unbindable, so the paid roll must not charge.
    ctx.bag.getMembershipGeneration = () => undefined
    const usesBefore = instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(preview(ctx, instance.instanceId)).toEqual({ ok: false, reason: 'not_found' })
    expect(instance.forgeUsesRemaining).toBe(usesBefore)
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('falls back to the opposite kind when no same-kind candidate is eligible', () => {
    const suffixSpeed: Affix = {
      id: 'mod-suffix-speed',
      name: 'Module suffix speed',
      stat: 'speed',
      kind: 'suffix',
      pool: 'basic',
      slots: ['weapon'],
      tiers: TIERS,
    }
    const ctx = setup([suffixSpeed])
    const instance = washable()
    ctx.bag.add(instance)

    // Line roll 0.75 -> floor(0.75 * 2) = 1 requested line, always a
    // prefix first; no prefix exists, so the suffix pool fills the line.
    const ticketId = previewOk(ctx, instance.instanceId, [0.75])
    expect(commit(ctx, instance.instanceId, ticketId).ok).toBe(true)
    expect(instance.affixes).toEqual([{ affixId: suffixSpeed.id, tier: 1, value: 5 }])
  })

  it('a Tien exalted roll with no supreme candidate still completes without a bonus line', () => {
    const ctx = setup()
    const instance = washable({ quality: 'tien' })
    ctx.bag.add(instance)

    // Rolls: lineCount -> 1 line; exalted chance 0.1 < 0.15 hits but the
    // registry holds no 'supreme' affix, so the reservation is null and
    // the result keeps exactly the base line count.
    const ticketId = previewOk(ctx, instance.instanceId, [0.2, 0.1])

    const display = getWashPreviewAffixes(ctx.slot, ticketId)!
    expect(display.affixes).toEqual([{ affixId: PREFIX_CRIT.id, tier: 1, value: 5 }])
  })

  it('the exalted reservation removes its stat from the base-roll pool', () => {
    const supremeCrit: Affix = {
      id: 'mod-supreme-crit',
      name: 'Module supreme crit',
      stat: 'criticalRate',
      kind: 'prefix',
      pool: 'supreme',
      slots: ['weapon'],
      tiers: [{ tier: 5, min: 50, max: 50 }],
    }
    const basicCrit: Affix = {
      id: 'mod-basic-crit',
      name: 'Module basic crit',
      stat: 'criticalRate',
      kind: 'prefix',
      pool: 'basic',
      slots: ['weapon'],
      tiers: TIERS,
    }
    const basicSpeed: Affix = {
      id: 'mod-basic-speed',
      name: 'Module basic speed',
      stat: 'speed',
      kind: 'prefix',
      pool: 'basic',
      slots: ['weapon'],
      tiers: TIERS,
    }
    const ctx = setup([supremeCrit, basicCrit, basicSpeed])
    const instance = washable({ quality: 'tien' })
    ctx.bag.add(instance)

    // Rolls: lineCount -> 1 prefix line; exalted chance hits and the
    // supreme criticalRate line is reserved FIRST, so the base roll
    // cannot consume criticalRate and must land on speed. Without the
    // reservation the pick roll (0) would take mod-basic-crit.
    const ticketId = previewOk(ctx, instance.instanceId, [0.2, 0.1])

    expect(getWashPreviewAffixes(ctx.slot, ticketId)!.affixes).toEqual([
      { affixId: basicSpeed.id, tier: 1, value: 5 },
      { affixId: supremeCrit.id, tier: 5, value: 50 },
    ])
  })
})

describe('commitWashAffixes — ticket binding edges', () => {
  it('a mismatched ticket id rejects and still consumes the real pending ticket', () => {
    const ctx = setup()
    const instance = washable()
    ctx.bag.add(instance)
    const ticketId = previewOk(ctx, instance.instanceId)

    expect(commit(ctx, instance.instanceId, 'wash-ticket-forgery')).toEqual({
      ok: false,
      reason: 'no_pending_wash',
    })
    expect(instance.affixes).toEqual(SENTINEL_AFFIXES)

    // Consume-on-every-attempt: even the genuine ticket is now dead.
    expect(commit(ctx, instance.instanceId, ticketId)).toEqual({
      ok: false,
      reason: 'no_pending_wash',
    })
  })

  it('a ticket bound to another instanceId rejects as no_pending_wash and is consumed', () => {
    const ctx = setup()
    const first = washable({ instanceId: 'wash-first' })
    const secondAffixes = [{ affixId: 'second-sentinel', tier: 1, value: 7 }]
    const second = washable({ instanceId: 'wash-second', affixes: structuredClone(secondAffixes) })
    ctx.bag.add(first)
    ctx.bag.add(second)
    const ticketId = previewOk(ctx, first.instanceId)

    // The ticket exists and the id resolves to a real item, but the
    // snapshot binds the paid roll to 'wash-first' only.
    expect(commit(ctx, second.instanceId, ticketId)).toEqual({
      ok: false,
      reason: 'no_pending_wash',
    })
    expect(second.affixes).toEqual(secondAffixes)

    expect(commit(ctx, first.instanceId, ticketId)).toEqual({
      ok: false,
      reason: 'no_pending_wash',
    })
    expect(first.affixes).toEqual(SENTINEL_AFFIXES)
  })
})
