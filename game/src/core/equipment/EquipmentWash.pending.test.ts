// R9 (AR-21) - wash pending-result: the paid random roll must be
// DOMAIN-OWNED. Preview returns a one-use ticket id (NOT the affixes as
// authoritative data); commit consumes the ticket on every attempt and
// re-validates item identity/membership. Modeled on the refine
// pending-preview precedent (EquipmentSystem.ts:1045-1118).
// M2 (ARCH-011 / AUD-E02) - the ticket additionally binds the EXACT item
// object + bag-membership generation + issued-at snapshot, and commit
// revalidates locked/favorite eligibility on the current item.
import { describe, expect, it } from 'vitest'
import { EquipmentSystem } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { makeInstance } from './EquipmentInstance.fixture'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 10, max: 20 }],
  enhanceCost: [{ materialId: 'qi_refining_ore_century', amount: 1 }],
}

const ENHANCE_ORE = materials.find((m) => m.id === 'qi_refining_ore_century')!
const ESSENCE = materials.find((m) => m.id === LUYEN_KHI_TINH_HOA_ID)!

function setup() {
  const system = new EquipmentSystem()
  const bag = new EquipmentBag()
  const registry = new EquipmentRegistry()
  const affixRegistry = new AffixRegistry()
  const slotManager = new EquipmentSlotManager()
  const materialBag = new MaterialBag()
  const player = createDefaultPlayer()

  registry.register(TEMPLATE)
  for (const affix of affixes) {
    affixRegistry.register(affix)
  }
  materialBag.add(ENHANCE_ORE, 100_000)
  materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)
  materialBag.add(ESSENCE, 100)

  return { system, bag, registry, affixRegistry, slotManager, materialBag, player }
}

function manualInstance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return makeInstance({
    instanceId: 'manual-1',
    itemId: TEMPLATE.id,
    grade: 'bat_pham',
    quality: 'hoang',
    mainStat: {
      id: 'roll-main-attack',
      sourceId: 'roll-main',
      sourceType: 'equipment',
      stat: 'attack',
      flat: 15,
    },
    forgeUsesRemaining: 0,
    ...overrides,
  })
}

function ticketedItem(ctx: ReturnType<typeof setup>) {
  const instance = manualInstance()
  instance.forgeUsesRemaining = instance.forgeUsesTotal
  instance.equipped = true
  instance.affixes = [
    { affixId: affixes[0]!.id, tier: 1, value: 5 },
    { affixId: affixes[1]!.id, tier: 1, value: 5 },
    { affixId: affixes[2]!.id, tier: 1, value: 5 },
  ]
  ctx.bag.add(instance)
  return instance
}

const ROLL: () => number = () => 0.99

describe('EquipmentSystem - wash pending-result (AR-21)', () => {
  it('preview returns a ticket, not authoritative affixes; display copy is readable by ticket', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)

    const result = ctx.system.previewWashAffixes(
      instance.instanceId,
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      ROLL,
    )

    expect(result.ok).toBe(true)
    const ticket = (result as { ticketId: string }).ticketId
    expect(typeof ticket).toBe('string')
    expect(ticket.length).toBeGreaterThan(0)

    // Display copy is available through the read model.
    const preview = ctx.system.getWashPreviewAffixes(ticket)
    expect(preview).toBeDefined()
    expect(preview!.affixes.length).toBeGreaterThan(0)
  })

  it('commit without a preview ticket is rejected (no caller-fabricated affixes)', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)
    const before = structuredClone(instance.affixes)

    const result = ctx.system.commitWashAffixes(
      instance.instanceId,
      'fabricated-ticket',
      ctx.bag,
      ctx.slotManager,
      ctx.affixRegistry,
    )

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_pending_wash')
    expect(instance.affixes).toEqual(before)
  })

  it('commit consumes the ticket - a second commit is rejected', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)

    const preview = ctx.system.previewWashAffixes(
      instance.instanceId, ctx.bag, ctx.registry, ctx.materialBag, ctx.affixRegistry, ROLL,
    ) as { ok: true; ticketId: string }

    const first = ctx.system.commitWashAffixes(
      instance.instanceId, preview.ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
    expect(first.ok).toBe(true)

    const second = ctx.system.commitWashAffixes(
      instance.instanceId, preview.ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('no_pending_wash')
  })

  it('item removed between preview and commit -> rejected, ticket consumed', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)

    const preview = ctx.system.previewWashAffixes(
      instance.instanceId, ctx.bag, ctx.registry, ctx.materialBag, ctx.affixRegistry, ROLL,
    ) as { ok: true; ticketId: string }

    ctx.bag.remove(instance.instanceId)

    const result = ctx.system.commitWashAffixes(
      instance.instanceId, preview.ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not_found')
  })

  it('commit applies the rolled affixes and refreshes equipped modifiers', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)

    const preview = ctx.system.previewWashAffixes(
      instance.instanceId, ctx.bag, ctx.registry, ctx.materialBag, ctx.affixRegistry, ROLL,
    ) as { ok: true; ticketId: string }
    const previewAffixes = structuredClone(
      ctx.system.getWashPreviewAffixes(preview.ticketId)!.affixes,
    )
    // Preview charged the cost once; capture the balance AFTER it.
    const essenceAfterPreview = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)

    const result = ctx.system.commitWashAffixes(
      instance.instanceId, preview.ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
    expect(result.ok).toBe(true)
    expect(instance.affixes).toEqual(previewAffixes)
    // Commit charges nothing beyond the preview payment.
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(essenceAfterPreview)
  })

  it('discard ticket invalidates it for commit', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)

    const preview = ctx.system.previewWashAffixes(
      instance.instanceId, ctx.bag, ctx.registry, ctx.materialBag, ctx.affixRegistry, ROLL,
    ) as { ok: true; ticketId: string }

    ctx.system.discardWashTicket(preview.ticketId)

    const result = ctx.system.commitWashAffixes(
      instance.instanceId, preview.ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_pending_wash')
  })

  it('every new preview charges the cost again (re-roll keeps paying)', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)
    const essenceBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)

    const first = ctx.system.previewWashAffixes(
      instance.instanceId, ctx.bag, ctx.registry, ctx.materialBag, ctx.affixRegistry, ROLL,
    ) as { ok: true; ticketId: string }
    const second = ctx.system.previewWashAffixes(
      instance.instanceId, ctx.bag, ctx.registry, ctx.materialBag, ctx.affixRegistry, ROLL,
    ) as { ok: true; ticketId: string }

    // Two previews = two payments (same cost each) - ticket of the FIRST
    // preview is replaced by the second (single pending slot, refine style).
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBeLessThan(essenceBefore)
    expect(first.ticketId).not.toBe(second.ticketId)

    // Commit the LATEST ticket; the replaced first ticket is already
    // invalid. After a successful commit every later attempt (including
    // the replaced ticket) is rejected - consume-on-every-attempt.
    const latest = ctx.system.commitWashAffixes(
      instance.instanceId, second.ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
    expect(latest.ok).toBe(true)

    const stale = ctx.system.commitWashAffixes(
      instance.instanceId, first.ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
    expect(stale.ok).toBe(false)
    expect(stale.reason).toBe('no_pending_wash')
  })
})

describe('M2 (ARCH-011 / AUD-E02) - ticket binds the exact item lifetime', () => {
  function previewOn(
    ctx: ReturnType<typeof setup>,
    instance: EquipmentInstance,
  ): { ok: true; ticketId: string } {
    const preview = ctx.system.previewWashAffixes(
      instance.instanceId, ctx.bag, ctx.registry, ctx.materialBag, ctx.affixRegistry, ROLL,
    ) as { ok: true; ticketId: string }
    expect(preview.ok).toBe(true)
    return preview
  }

  function commitOn(
    ctx: ReturnType<typeof setup>,
    instanceId: string,
    ticketId: string,
  ) {
    return ctx.system.commitWashAffixes(
      instanceId, ticketId, ctx.bag, ctx.slotManager, ctx.affixRegistry,
    )
  }

  // Ported AUD-E02 diagnostic: preview a real instance, remove it, add a
  // DIFFERENT object behind the same instanceId marked locked+favorite.
  it('same-instanceId replacement marked locked+favorite rejects commit and keeps its own affixes', () => {
    const ctx = setup()
    const original = ticketedItem(ctx)
    const preview = previewOn(ctx, original)

    ctx.bag.remove(original.instanceId)
    const replacementAffixes = [{ affixId: affixes[4]!.id, tier: 2, value: 9 }]
    const replacement = manualInstance({
      instanceId: original.instanceId,
      locked: true,
      favorite: true,
      affixes: replacementAffixes,
    })
    ctx.bag.add(replacement)
    expect(ctx.bag.get(original.instanceId)).toBe(replacement)

    const commit = commitOn(ctx, original.instanceId, preview.ticketId)
    expect(commit.ok).toBe(false)
    expect(commit.reason).toBe('locked')
    expect(replacement.affixes).toEqual(replacementAffixes)

    // The attempt consumed the ticket — replay cannot reach the replacement.
    expect(commitOn(ctx, original.instanceId, preview.ticketId).ok).toBe(false)
  })

  it('same-instanceId replacement without protection still rejects (exact-object binding)', () => {
    const ctx = setup()
    const original = ticketedItem(ctx)
    const preview = previewOn(ctx, original)

    ctx.bag.remove(original.instanceId)
    const replacementAffixes = [{ affixId: affixes[4]!.id, tier: 2, value: 9 }]
    const replacement = manualInstance({
      instanceId: original.instanceId,
      affixes: replacementAffixes,
    })
    ctx.bag.add(replacement)

    const commit = commitOn(ctx, original.instanceId, preview.ticketId)
    expect(commit.ok).toBe(false)
    expect(commit.reason).toBe('no_pending_wash')
    expect(replacement.affixes).toEqual(replacementAffixes)
  })

  it('remove + re-add of the SAME object bumps membership generation and rejects', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)
    const preview = previewOn(ctx, instance)

    ctx.bag.remove(instance.instanceId)
    ctx.bag.add(instance)
    expect(ctx.bag.get(instance.instanceId)).toBe(instance)

    const commit = commitOn(ctx, instance.instanceId, preview.ticketId)
    expect(commit.ok).toBe(false)
    expect(commit.reason).toBe('no_pending_wash')
    expect(instance.affixes).toEqual([
      { affixId: affixes[0]!.id, tier: 1, value: 5 },
      { affixId: affixes[1]!.id, tier: 1, value: 5 },
      { affixId: affixes[2]!.id, tier: 1, value: 5 },
    ])
  })

  it('item mutated between preview and commit rejects (affix shape, then grade)', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)
    const originalAffixes = structuredClone(instance.affixes)

    const first = previewOn(ctx, instance)
    instance.affixes.push({ affixId: affixes[3]!.id, tier: 1, value: 1 })
    const affixCommit = commitOn(ctx, instance.instanceId, first.ticketId)
    expect(affixCommit.ok).toBe(false)
    expect(affixCommit.reason).toBe('no_pending_wash')

    const second = previewOn(ctx, instance)
    instance.grade = 'that_pham'
    const gradeCommit = commitOn(ctx, instance.instanceId, second.ticketId)
    expect(gradeCommit.ok).toBe(false)
    expect(gradeCommit.reason).toBe('no_pending_wash')
    expect(instance.affixes).toEqual([...originalAffixes, { affixId: affixes[3]!.id, tier: 1, value: 1 }])
  })

  it.each(['locked', 'favorite'] as const)(
    'same object flagged %s after preview rejects with the eligibility reason',
    (flag) => {
      const ctx = setup()
      const instance = ticketedItem(ctx)
      const before = structuredClone(instance.affixes)
      const preview = previewOn(ctx, instance)

      instance[flag] = true

      const commit = commitOn(ctx, instance.instanceId, preview.ticketId)
      expect(commit.ok).toBe(false)
      expect(commit.reason).toBe(flag)
      expect(instance.affixes).toEqual(before)
    },
  )

  it('an unmodified bound item still commits exactly once', () => {
    const ctx = setup()
    const instance = ticketedItem(ctx)
    const preview = previewOn(ctx, instance)
    const previewAffixes = structuredClone(
      ctx.system.getWashPreviewAffixes(preview.ticketId)!.affixes,
    )

    expect(commitOn(ctx, instance.instanceId, preview.ticketId).ok).toBe(true)
    expect(instance.affixes).toEqual(previewAffixes)

    // Replay on the same (now post-commit shaped) item is still rejected.
    const replay = commitOn(ctx, instance.instanceId, preview.ticketId)
    expect(replay.ok).toBe(false)
    expect(replay.reason).toBe('no_pending_wash')
  })
})
