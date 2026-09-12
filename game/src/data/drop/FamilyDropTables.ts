import type { FamilyDropTable } from '../../core/drop/DropTable'

/**
 * Family layer (spec E2): decides the THEMED part of a kill - the fang, the
 * hide, the beast core. Shared by every enemy of that family, so a family's
 * loot no longer depends on whether someone remembered to hand-copy a table
 * onto that particular enemy. That omission is exactly why 33 of 43 enemies
 * dropped nothing extra as elites.
 *
 * All 21 families come from game/src/data/enemy/Enemies.ts's family field.
 * Item ids come from the old per-enemy itemDrops, extracted (not invented):
 * - Where a family's only historical drop was a realm-generic item already
 *   covered by the stage layer (tinh_hoa_pham_the, the plain qi_refining ore,
 *   or the shared base_kiem drop several unrelated families all rolled),
 *   there is nothing distinctly "themed" left, so pool stays empty.
 * - Where a family's only historical drop was a narrative "breakthrough"
 *   lore item (great_dao_seed, cultivator_diary, stele_fragment,
 *   thien_dia_chi_kieu, yeu_dan_hung_giao - see data/materials/materials.ts),
 *   it is excluded on purpose: those are hand-placed signature drops tied to
 *   a specific countdown narrative, not generic family loot (mirrors
 *   DropTable.ts's note on great_dao_seed staying out of the shared pool).
 * - flame_fox, hawk, pool_toad currently drop no items at all in the data
 *   (their qi_refining enemies only pay currency), so pool is empty too.
 */
export const FAMILY_DROP_TABLES: FamilyDropTable[] = [
  {
    familyId: 'bandit',
    guaranteed: [],
    // van_kiem_quyet is NOT here on purpose: its authored contract is
    // elite-gated ("Tâm pháp hiếm rơi từ Elite" - 20% elite / 100% boss
    // on the qi_refining bandit). An ungated pool line would leak it to
    // every bandit-family kill including the mortal-realm bandits - see
    // resolveDrops.gating.qa.test.ts. The gate lives in the bandit's
    // signatureDrops (requiresModifier tinh_anh / boss) instead.
    pool: [],
  },
  {
    familyId: 'magma_boar',
    guaranteed: [],
    // base_quan (helmet slot) is magma_boar's exclusive equipment drop.
    pool: [{ kind: 'equipment', itemId: 'base_quan', weight: 10 }],
  },
  {
    familyId: 'rock_bear',
    guaranteed: [],
    // base_hai (boots slot) is rock_bear's exclusive equipment drop.
    pool: [{ kind: 'equipment', itemId: 'base_hai', weight: 10 }],
  },
  {
    familyId: 'metal_beetle',
    guaranteed: [],
    // base_gioi (ring slot) is metal_beetle's exclusive equipment drop.
    pool: [{ kind: 'equipment', itemId: 'base_gioi', weight: 10 }],
  },
  {
    familyId: 'flood_serpent',
    guaranteed: [],
    // base_truy (necklace slot) is flood_serpent's exclusive equipment drop.
    // yeu_dan_hung_giao also dropped here historically but is a breakthrough
    // gate material (see file header), not themed family loot.
    pool: [{ kind: 'equipment', itemId: 'base_truy', weight: 10 }],
  },

  // No family-exclusive item in the current data - only the realm-generic
  // qi_refining ore, already covered by the stage layer.
  { familyId: 'earthworm', guaranteed: [], pool: [] },
  { familyId: 'forest_fiend', guaranteed: [], pool: [] },
  { familyId: 'sand_lynx', guaranteed: [], pool: [] },
  { familyId: 'blade_hawk', guaranteed: [], pool: [] },

  // No family-exclusive item in the current data - only the realm-generic
  // mortal essence (tinh_hoa_pham_the) and/or the shared base_kiem drop,
  // both already covered by the mortal stage table.
  { familyId: 'wolf', guaranteed: [], pool: [] },
  { familyId: 'boar', guaranteed: [], pool: [] },
  { familyId: 'dog', guaranteed: [], pool: [] },
  { familyId: 'tiger', guaranteed: [], pool: [] },
  { familyId: 'lynx', guaranteed: [], pool: [] },
  { familyId: 'ox', guaranteed: [], pool: [] },
  { familyId: 'fox', guaranteed: [], pool: [] },
  { familyId: 'crocodile', guaranteed: [], pool: [] },

  // hidden_beast's only historical drop besides the generic mortal essence
  // was thien_dia_chi_kieu, a breakthrough gate material excluded per the
  // file header - no themed item remains.
  { familyId: 'hidden_beast', guaranteed: [], pool: [] },

  // These families' enemies (qi_refining realm) pay only currency in the
  // current data - no itemDrops of any kind to draw from.
  { familyId: 'flame_fox', guaranteed: [], pool: [] },
  { familyId: 'hawk', guaranteed: [], pool: [] },
  { familyId: 'pool_toad', guaranteed: [], pool: [] },
]

export function familyDropTableFor(familyId: string | undefined): FamilyDropTable | undefined {
  if (!familyId) {
    return undefined
  }

  return FAMILY_DROP_TABLES.find((table) => table.familyId === familyId)
}
