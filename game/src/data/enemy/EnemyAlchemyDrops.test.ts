import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'

const LEGACY_ALCHEMY_MATERIALS = new Set([
  'linh_chi',
  'bach_nien_linh_chi',
  'thien_nien_linh_chi',
  'que',
  'bach_nien_que',
  'thien_nien_que',
  'cuc_hoa',
  'bach_nien_cuc_hoa',
  'thien_nien_cuc_hoa',
  'linh_thao_chung',
])

describe('Enemy drops — luyện đan rework', () => {
  it('không quái thường, Elite hoặc Boss nào còn rơi linh thảo legacy', () => {
    for (const enemy of ENEMIES) {
      for (const reward of [enemy.rewards, enemy.eliteRewards, enemy.bossRewards]) {
        for (const drop of reward?.itemDrops ?? []) {
          expect(
            drop.kind !== 'material' || !LEGACY_ALCHEMY_MATERIALS.has(drop.itemId),
            `${enemy.id} vẫn rơi ${drop.itemId}`,
          ).toBe(true)
        }
      }
    }
  })
})
