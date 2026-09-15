// R9 (AR-23 4d) - dissolve quote/commit parity: the quote must apply the
// SAME validation and dedupe as the commit path (no silent skipping).
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
  mainStats: [{ stat: 'might', min: 10, max: 20 }],
  enhanceCost: [{ materialId: 'qi_refining_ore_century', amount: 1 }],
}

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
  materialBag.add(materials.find((m) => m.id === 'qi_refining_ore_century')!, 100)
  materialBag.add(SPIRIT_STONE_MATERIAL, 1_000)
  materialBag.add(materials.find((m) => m.id === LUYEN_KHI_TINH_HOA_ID)!, 0)

  return { system, bag, registry, affixRegistry, slotManager, materialBag, player }
}

function plainInstance(instanceId: string): EquipmentInstance {
  return makeInstance({
    instanceId,
    itemId: TEMPLATE.id,
    grade: 'bat_pham',
    quality: 'hoang',
    mainStat: {
      id: 'roll-main-might',
      sourceId: 'roll-main',
      sourceType: 'equipment',
      stat: 'might',
      flat: 15,
    },
  })
}

describe('dissolve quote parity (AR-23 4d)', () => {
  it('valid selection quotes totals (read-only, nothing removed)', () => {
    const ctx = setup()
    const a = plainInstance('diss-a')
    const b = plainInstance('diss-b')
    ctx.bag.add(a)
    ctx.bag.add(b)

    const quote = ctx.system.quoteDissolveInstances(['diss-a', 'diss-b'], ctx.bag)

    expect(quote.ok).toBe(true)
    expect(quote.totals).toHaveLength(1)
    expect(quote.totals![0]!.materialId).toBe(LUYEN_KHI_TINH_HOA_ID)
    expect(quote.totals![0]!.minAmount).toBeGreaterThan(0)

    // Read-only: both items still in the bag.
    expect(ctx.bag.get('diss-a')).toBeDefined()
    expect(ctx.bag.get('diss-b')).toBeDefined()
  })

  it('duplicate ids are deduped (same as the commit path)', () => {
    const ctx = setup()
    ctx.bag.add(plainInstance('diss-a'))

    const quote = ctx.system.quoteDissolveInstances(['diss-a', 'diss-a'], ctx.bag)

    expect(quote.ok).toBe(true)
    // Single item counted once.
    expect(quote.totals![0]!.maxAmount).toBeLessThan(100)
  })

  it('an invalid item REJECTS the batch (no silent skipping)', () => {
    const ctx = setup()
    const locked = plainInstance('diss-locked')
    locked.locked = true
    ctx.bag.add(plainInstance('diss-ok'))
    ctx.bag.add(locked)

    const quote = ctx.system.quoteDissolveInstances(['diss-ok', 'diss-locked'], ctx.bag)

    expect(quote.ok).toBe(false)
    expect(quote.reason).toBe('locked')

    // And the commit path rejects for the same reason - one rule.
    const commit = ctx.system.dissolveInstances(['diss-ok', 'diss-locked'], ctx.bag)
    expect(commit.ok).toBe(false)
    expect(commit.reason).toBe('locked')
  })

  it('missing item rejects the quote', () => {
    const ctx = setup()

    const quote = ctx.system.quoteDissolveInstances(['ghost-id'], ctx.bag)

    expect(quote.ok).toBe(false)
    expect(quote.reason).toBe('not_found')
  })
})
