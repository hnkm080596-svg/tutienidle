import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'
import { STAGE_DROP_TABLES } from '../drop/StageDropTables'
import { FAMILY_DROP_TABLES } from '../drop/FamilyDropTables'

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

// Drop-system (2026-09-12): material drops now live in stage tables,
// family tables and per-enemy signatureDrops — the ban must cover all
// three or a legacy herb could sneak back in through an unwatched source.
describe('Enemy drops — luyện đan rework', () => {
  it('không nguồn drop nào (stage/family/signature) còn rơi linh thảo legacy', () => {
    const assertNoLegacy = (entries: readonly { kind: string; itemId?: string }[], source: string) => {
      for (const entry of entries) {
        expect(
          entry.kind !== 'material' ||
            entry.itemId === undefined ||
            !LEGACY_ALCHEMY_MATERIALS.has(entry.itemId),
          `${source} vẫn rơi ${entry.itemId}`,
        ).toBe(true)
      }
    }

    for (const table of STAGE_DROP_TABLES) {
      assertNoLegacy(table.guaranteed, `stage table ${table.realmId} guaranteed`)
      assertNoLegacy(table.pool, `stage table ${table.realmId} pool`)
    }

    for (const table of FAMILY_DROP_TABLES) {
      assertNoLegacy(table.guaranteed, `family table ${table.familyId} guaranteed`)
      assertNoLegacy(table.pool, `family table ${table.familyId} pool`)
    }

    for (const enemy of ENEMIES) {
      assertNoLegacy(enemy.signatureDrops ?? [], `${enemy.id} signatureDrops`)
    }
  })
})
