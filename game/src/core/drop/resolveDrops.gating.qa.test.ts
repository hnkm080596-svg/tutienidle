import { describe, expect, it } from 'vitest'
import { resolveDrops } from './resolveDrops'
import { stageDropTableFor } from '../../data/drop/StageDropTables'
import { familyDropTableFor } from '../../data/drop/FamilyDropTables'
import { ENEMIES } from '../../data/enemy/Enemies'

// QA evidence (2026-09-12 drop-system review): the bandit family pool
// briefly held van_kiem_quyet at weight 10 with NO realm/rank gate, so
// the merged weighted pool offered it to ANY bandit-family kill -
// including mortal_mountain_bandit on mortal floors. The item's authored
// contract ("Tâm pháp hiếm rơi từ Elite", Techniques.ts:244) was elite
// 20% / boss 100% on the qi_refining bandit alone; the extraction had
// dropped that gate. Fix: the family pool line was removed - the
// bandit's signatureDrops (requiresModifier tinh_anh/boss) carry the
// gated drop instead. TechniqueSystem.learn() has no realm check, so
// without the gate a mortal-tier player could learn it on day one.
//
// These tests pin the contract so a future table edit cannot silently
// reopen the leak. rng 0.9 * (15 + 20 + 0) = 31.5 -> lands on the
// equipment_any slice; the technique cannot appear at any weight.

const bandit = ENEMIES.find((enemy) => enemy.id === 'bandit')!

describe('drop QA — van_kiem_quyet keeps its elite/boss gate', () => {
  it('a plain mortal bandit-family kill can never roll the technique', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: stageDropTableFor('mortal', 1),
      familyTable: familyDropTableFor('bandit'),
      rng: () => 0.9,
    })

    expect(result.items.some((item) => item.itemId === 'van_kiem_quyet')).toBe(false)
  })

  it('the qi_refining bandit still drops it through signatureDrops (elite gate)', () => {
    const eliteSignature = bandit.signatureDrops?.find(
      (drop) => drop.itemId === 'van_kiem_quyet' && drop.requiresModifier === 'tinh_anh',
    )
    const bossSignature = bandit.signatureDrops?.find(
      (drop) => drop.itemId === 'van_kiem_quyet' && drop.requiresModifier === 'boss',
    )

    expect(eliteSignature?.chance).toBe(0.2)
    expect(bossSignature?.chance).toBe(1)
  })

  it('a tinh_anh bandit kill still rolls the signature line', () => {
    const result = resolveDrops({
      modifiers: [{ id: 'tinh_anh', extraRolls: 1, currencyBonus: 1 }],
      channel: 'active',
      stageTable: stageDropTableFor('qi_refining', 1),
      familyTable: familyDropTableFor('bandit'),
      signatureDrops: bandit.signatureDrops,
      // rng 0.05 < 0.2 signature chance -> the elite line lands.
      rng: () => 0.05,
    })

    expect(result.items).toContainEqual(
      expect.objectContaining({ kind: 'technique', itemId: 'van_kiem_quyet' }),
    )
  })
})
