import { describe, expect, it } from 'vitest'
import { resolveDrops } from './resolveDrops'
import { stageDropTableFor } from '../../data/drop/StageDropTables'
import { familyDropTableFor } from '../../data/drop/FamilyDropTables'
import { ENEMIES } from '../../data/enemy/Enemies'

// Kiem Tu Reimagined Task 12 (spec 2026-09-15 sec.7): van_kiem_quyet was
// repurposed as the Ngu Kiem Dao signature technique - granted by the
// ngu way ritual (M6; formerly the kiem_tu_an conversion node), NEVER
// lootable. The old elite/boss
// signatureDrops lines on the qi_refining bandit were removed in the
// same change. These tests pin the new contract so a future table edit
// cannot silently reopen a loot path: no signature/pool line may offer
// it, at any modifier, on any enemy.

describe('drop QA — van_kiem_quyet is never lootable', () => {
  it('no enemy signatureDrops offers van_kiem_quyet', () => {
    for (const enemy of ENEMIES) {
      const leak = enemy.signatureDrops?.filter((drop) => drop.itemId === 'van_kiem_quyet')
      expect(leak ?? [], `${enemy.id} signatureDrops leaks van_kiem_quyet`).toEqual([])
    }
  })

  it('the bandit family pool cannot roll it', () => {
    const bandit = ENEMIES.find((enemy) => enemy.id === 'bandit')!
    const result = resolveDrops({
      modifiers: [{ id: 'tinh_anh', extraRolls: 1, currencyBonus: 1 }, { id: 'boss', extraRolls: 1, currencyBonus: 1 }],
      channel: 'active',
      stageTable: stageDropTableFor('qi_refining', 1),
      familyTable: familyDropTableFor('bandit'),
      signatureDrops: bandit.signatureDrops,
      // rng 0 -> every chance gate succeeds; the technique still must
      // not appear.
      rng: () => 0,
    })

    expect(result.items.some((item) => item.itemId === 'van_kiem_quyet')).toBe(false)
  })

  it('a boss bandit kill drops no technique at all now', () => {
    const bandit = ENEMIES.find((enemy) => enemy.id === 'bandit')!
    const result = resolveDrops({
      modifiers: [{ id: 'boss', extraRolls: 1, currencyBonus: 1 }],
      channel: 'active',
      stageTable: stageDropTableFor('qi_refining', 1),
      familyTable: familyDropTableFor('bandit'),
      signatureDrops: bandit.signatureDrops,
      rng: () => 0,
    })

    // P7-M3 - the 'technique' DropKind is retired entirely; the old
    // tu_linh_quyet signature line can never resolve.
    expect(result.items.some((item) => item.itemId === 'tu_linh_quyet')).toBe(false)
    // The boss signature table is empty (van_kiem_quyet torn down
    // 2026-09-15; great_dao_seed retired with the material 2026-09-23,
    // hidden-perfection-lineage sec.19) - no signature item resolves.
    expect(bandit.signatureDrops ?? []).toHaveLength(0)
    expect(result.items.some((item) => item.itemId === 'great_dao_seed')).toBe(false)
  })
})
