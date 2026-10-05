import { describe, expect, it } from 'vitest'
import { BOSS_MODIFIER, TINH_ANH_MODIFIER } from './DropModifier'
import type { FamilyDropTable, SignatureDrop, StageDropTable } from './DropTable'
import { resolveDrops } from './resolveDrops'

/** Deterministic stand-in for Math.random: replays the given numbers, then 0. */
function scriptedRng(values: number[]): () => number {
  let index = 0

  return () => (index < values.length ? values[index++]! : 0)
}

const STAGE: StageDropTable = {
  realmId: 'mortal',
  floors: { min: 1, max: 10 },
  currency: { spiritStone: { min: 2, max: 2 }, techniqueMastery: { min: 10, max: 10 } },
  guaranteed: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 1, max: 1 }, chance: 0.7 }],
  pool: [{ kind: 'material', itemId: 'stage_item', weight: 50 }],
}

const FAMILY: FamilyDropTable = {
  familyId: 'boar',
  guaranteed: [],
  pool: [{ kind: 'material', itemId: 'family_item', weight: 50 }],
}

describe('resolveDrops - roll count', () => {
  it('draws the pool once for a plain kill', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.1]),
    })

    // rng[0] = 0.99 fails the 0.7 guaranteed line; rng[1] picks one pool draw.
    expect(result.items).toHaveLength(1)
  })

  it('draws once per extra roll', () => {
    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER, TINH_ANH_MODIFIER],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.1, 0.1, 0.1, 0.1, 0.1]),
    })

    expect(result.items).toHaveLength(5)
  })
})

describe('resolveDrops - both layers feed one bag', () => {
  it('can draw from the family table as well as the stage table', () => {
    const high = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.99]),
    })

    expect(high.items[0]!.itemId).toBe('family_item')

    const low = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.1]),
    })

    expect(low.items[0]!.itemId).toBe('stage_item')
  })
})

describe('resolveDrops - amount roll interleaving', () => {
  it('rolls an amount for a succeeding guaranteed line without disturbing the following pool draw', () => {
    const localStage: StageDropTable = {
      realmId: 'test',
      floors: { min: 1, max: 1 },
      currency: { spiritStone: { min: 0, max: 0 }, techniqueMastery: { min: 0, max: 0 } },
      guaranteed: [{ kind: 'material', itemId: 'wide_amount_item', amount: { min: 1, max: 5 }, chance: 1 }],
      pool: [
        { kind: 'material', itemId: 'pool_low', weight: 50 },
        { kind: 'material', itemId: 'pool_high', weight: 50 },
      ],
    }

    // rng[0] = 0 passes the chance === 1 guaranteed line.
    // rng[1] = 0.5 is consumed inline by the amount roll for that line (amount 1..5 -> 3).
    // rng[2] = 0.1 is left for the pool draw, which must still pick the low-weight slot.
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: localStage,
      rng: scriptedRng([0, 0.5, 0.1]),
    })

    expect(result.items[0]).toEqual({ kind: 'material', itemId: 'wide_amount_item', amount: 3 })
    expect(result.items[1]!.itemId).toBe('pool_low')
  })
})

describe('resolveDrops - poolDrawChance gate', () => {
  /**
   * Gate arithmetic: merged hit weight is 100 (stage 50 + family 50), so
   * chance 0.5 reserves 100 miss weight and the draw hits on roll <= 100
   * of 200 total - i.e. rng() < 0.5.
   */
  const GATED_STAGE: StageDropTable = {
    ...STAGE,
    poolDrawChance: 0.5,
  }

  it('a roll in the miss band yields no item from that draw', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: GATED_STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.99, 0.5, 0.5]),
    })

    // rng[0] = 0.99 fails the 0.7 guaranteed line; rng[1] = 0.99 -> roll
    // 198 of 200 lands in the miss band; rng[2]/rng[3] pay currency.
    expect(result.items).toHaveLength(0)
    expect(result.spiritStone).toBe(2)
    expect(result.techniqueMastery).toBe(10)
  })

  it('a miss still spends exactly one rng() - downstream rolls keep their positions', () => {
    const cadenceStage: StageDropTable = {
      realmId: 'gated',
      floors: { min: 1, max: 1 },
      currency: { spiritStone: { min: 0, max: 9 }, techniqueMastery: { min: 0, max: 9 } },
      guaranteed: [],
      poolDrawChance: 0.5,
      pool: [{ kind: 'material', itemId: 'loot', weight: 10 }],
    }

    // missWeight = 10 -> total 20. rng[0] = 0.9 -> roll 18 -> miss.
    // If the miss consumed a second rng(), spiritStone would read rng[2]
    // (9 not 1) and techniqueMastery the fallback 0.
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: cadenceStage,
      rng: scriptedRng([0.9, 0.1, 0.9]),
    })

    expect(result.items).toHaveLength(0)
    expect(result.spiritStone).toBe(1)
    expect(result.techniqueMastery).toBe(9)
  })

  it('a roll in the hit band still resolves an entry', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: GATED_STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.4]),
    })

    // rng[1] = 0.4 -> roll 80 of 200; stage_item covers 0-50, family_item
    // 50-100, so 80 lands on family_item.
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.itemId).toBe('family_item')
  })

  it('gates the whole merged bag - family entries cannot leak around the miss band', () => {
    const gated = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: GATED_STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.6]),
    })

    // Same roll on an ungated table (rng 0.6 -> 120 of 100) pays the last
    // entry; under the gate it is a miss.
    expect(gated.items).toHaveLength(0)

    const ungated = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.6]),
    })

    expect(ungated.items).toHaveLength(1)
  })

  it('applies the gate to every draw, including extra rolls', () => {
    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER],
      channel: 'active',
      stageTable: GATED_STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.99, 0.4, 0.99, 0.4]),
    })

    // Boss = 3 extra rolls -> 4 draws total: rng[1] and rng[3] land in
    // the miss band, rng[2] and rng[4] hit.
    expect(result.items).toHaveLength(2)
  })

  it('chance 1 or absent leaves every draw hitting, including the float-edge fallback', () => {
    for (const poolDrawChance of [undefined, 1]) {
      const result = resolveDrops({
        modifiers: [],
        channel: 'active',
        stageTable: { ...STAGE, poolDrawChance },
        familyTable: FAMILY,
        rng: scriptedRng([0.99, 0.99]),
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.itemId).toBe('family_item')
    }
  })

  it('chance 0 makes every draw miss', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: { ...STAGE, poolDrawChance: 0 },
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0, 0.5, 0.5]),
    })

    expect(result.items).toHaveLength(0)
    expect(result.spiritStone).toBe(2)
    expect(result.techniqueMastery).toBe(10)
  })
})

describe('resolveDrops - currency', () => {
  it('multiplies the stage currency by the modifier law', () => {
    const plain = resolveDrops({ modifiers: [], channel: 'active', stageTable: STAGE, rng: scriptedRng([0.99]) })

    expect(plain.spiritStone).toBe(2)
    expect(plain.techniqueMastery).toBe(10)

    const both = resolveDrops({
      modifiers: [BOSS_MODIFIER, TINH_ANH_MODIFIER],
      channel: 'active',
      stageTable: STAGE,
      rng: scriptedRng([0.99]),
    })

    expect(both.spiritStone).toBe(8)
    expect(both.techniqueMastery).toBe(40)
    expect(both.currencyMultiplier).toBe(4)
    expect(both.qualityBonusSteps).toBe(1)
  })
})

describe('resolveDrops - signature drops (spec E7/E11)', () => {
  const SIGNATURE: SignatureDrop[] = [
    { kind: 'material', itemId: 'great_dao_seed', chance: 1, requiresModifier: 'boss' },
    { kind: 'material', itemId: 'dao_herb', chance: 1 },
  ]

  it('skips a line whose required modifier is absent', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      signatureDrops: SIGNATURE,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['dao_herb'])
  })

  it('grants it when the modifier is present', () => {
    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER],
      channel: 'active',
      signatureDrops: SIGNATURE,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['great_dao_seed', 'dao_herb'])
  })

  it('on idle keeps only the certain lines', () => {
    const idleSignature: SignatureDrop[] = [
      { kind: 'material', itemId: 'great_dao_seed', chance: 0.5, requiresModifier: 'boss' },
      { kind: 'material', itemId: 'dao_herb', chance: 1, requiresModifier: 'boss' },
    ]

    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER],
      channel: 'idle',
      signatureDrops: idleSignature,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['dao_herb'])
  })
})
