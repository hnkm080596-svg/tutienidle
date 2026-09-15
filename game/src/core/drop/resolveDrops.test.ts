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
  currency: { spiritStone: { min: 2, max: 2 }, techniqueInsight: { min: 10, max: 10 } },
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
      currency: { spiritStone: { min: 0, max: 0 }, techniqueInsight: { min: 0, max: 0 } },
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

describe('resolveDrops - currency', () => {
  it('multiplies the stage currency by the modifier law', () => {
    const plain = resolveDrops({ modifiers: [], channel: 'active', stageTable: STAGE, rng: scriptedRng([0.99]) })

    expect(plain.spiritStone).toBe(2)
    expect(plain.techniqueInsight).toBe(10)

    const both = resolveDrops({
      modifiers: [BOSS_MODIFIER, TINH_ANH_MODIFIER],
      channel: 'active',
      stageTable: STAGE,
      rng: scriptedRng([0.99]),
    })

    expect(both.spiritStone).toBe(8)
    expect(both.techniqueInsight).toBe(40)
    expect(both.currencyMultiplier).toBe(4)
    expect(both.qualityBonusSteps).toBe(1)
  })
})

describe('resolveDrops - signature drops (spec E7/E11)', () => {
  const SIGNATURE: SignatureDrop[] = [
    { kind: 'material', itemId: 'great_dao_seed', chance: 1, requiresModifier: 'boss' },
    { kind: 'technique', itemId: 'tu_linh_quyet', chance: 1 },
  ]

  it('skips a line whose required modifier is absent', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      signatureDrops: SIGNATURE,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['tu_linh_quyet'])
  })

  it('grants it when the modifier is present', () => {
    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER],
      channel: 'active',
      signatureDrops: SIGNATURE,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['great_dao_seed', 'tu_linh_quyet'])
  })

  it('on idle keeps only the certain lines', () => {
    const idleSignature: SignatureDrop[] = [
      { kind: 'material', itemId: 'great_dao_seed', chance: 0.5, requiresModifier: 'boss' },
      { kind: 'technique', itemId: 'tu_linh_quyet', chance: 1, requiresModifier: 'boss' },
    ]

    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER],
      channel: 'idle',
      signatureDrops: idleSignature,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['tu_linh_quyet'])
  })
})
