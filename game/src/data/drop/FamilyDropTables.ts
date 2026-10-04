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
    // van_kiem_quyet is NOT here on purpose: it is the Ngu Kiem Dao
    // signature technique now (granted by the ngu way ritual kit), never
    // a drop - the legacy elite/boss signatureDrops lines were removed
    // in the same teardown.
    //
    // Roster remap (2026-10-04): bandit is the qi_refining roster
    // family, so it inherits the realm's equipment bases whose sources
    // left the roster - base_hai (was earthworm's) and base_truy (was
    // flood_serpent's). Dormant family rows below stay untouched.
    pool: [
      { kind: 'equipment', itemId: 'base_hai', weight: 10 },
      { kind: 'equipment', itemId: 'base_truy', weight: 10 },
    ],
  },
  {
    familyId: 'magma_boar',
    guaranteed: [],
    // base_quan (helmet slot) is magma_boar's exclusive equipment drop.
    // BETA SCOPE LOCK v2 Phase-5: off-roster in beta, so the roster
    // sibling 'boar' below pays the same base; this authored row stays
    // untouched (dormant, not removed).
    pool: [{ kind: 'equipment', itemId: 'base_quan', weight: 10 }],
  },
  {
    familyId: 'rock_bear',
    guaranteed: [],
    // base_hai (boots slot) is rock_bear's exclusive equipment drop;
    // roster sibling 'earthworm' pays the same base in beta.
    pool: [{ kind: 'equipment', itemId: 'base_hai', weight: 10 }],
  },
  {
    familyId: 'metal_beetle',
    guaranteed: [],
    // base_gioi (ring slot) is metal_beetle's exclusive equipment drop;
    // roster sibling 'sand_scorpion' pays the same base in beta.
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

  // Phase-4 fallout re-source: giant_earthworm is on the beta roster and
  // carries the same earth heavy-creature theme rock_bear carried, so it
  // now pays base_hai (boots slot - sole base, cannot stay sourceless).
  {
    familyId: 'earthworm',
    guaranteed: [],
    pool: [{ kind: 'equipment', itemId: 'base_hai', weight: 10 }],
  },
  { familyId: 'forest_fiend', guaranteed: [], pool: [] },
  { familyId: 'sand_lynx', guaranteed: [], pool: [] },
  { familyId: 'blade_hawk', guaranteed: [], pool: [] },

  // Phase-4 fallout re-source: foundation_sand_scorpion is on the beta
  // roster (family field forwarded on the foundation tier by this phase)
  // and is the arthropod sibling of metal_beetle, so it pays base_gioi
  // (ring slot - sole base, cannot stay sourceless).
  {
    familyId: 'sand_scorpion',
    guaranteed: [],
    pool: [{ kind: 'equipment', itemId: 'base_gioi', weight: 10 }],
  },

  // Roster remap (2026-10-04): foundation_spirit_wolf is the Truc Co
  // roster species (family 'wolf'), so it pays base_gioi - the ring
  // base that left the roster with sand_scorpion. (The shared base_kiem
  // still lands via the stage table's equipment_any pool, as before.)
  {
    familyId: 'wolf',
    guaranteed: [],
    pool: [{ kind: 'equipment', itemId: 'base_gioi', weight: 10 }],
  },

  // Phase-4 fallout re-source: mortal_wild_boar is on the beta roster and
  // is the literal species sibling of magma_boar, so it now pays
  // base_quan (helmet slot - sole base, cannot stay sourceless).
  {
    familyId: 'boar',
    guaranteed: [],
    pool: [{ kind: 'equipment', itemId: 'base_quan', weight: 10 }],
  },
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
