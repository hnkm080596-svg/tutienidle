import type { StageDropTable } from '../../core/drop/DropTable'

/**
 * Stage layer (spec E2): decides WHICH items exist at this point of
 * progression. It deliberately does NOT decide equipment quality - that stays
 * EquipmentSystem.rollItemQuality()'s job (spec E5).
 *
 * One band per realm to start with. Splitting a band later is a data change,
 * not a code change - but every new band is another cell the economy guard
 * has to balance, so do not split without a reason.
 *
 * Currency ranges replace the three hand-copied reward tables that used to
 * live on each enemy. Numbers are a shipping starting point, tuned by
 * playtest, not a balance conclusion.
 *
 * Item ids below were extracted from the live rewards on
 * game/src/data/enemy/Enemies.ts (mortal, qi_refining, foundation_establishment
 * realms), not invented. Narrative "breakthrough" lore items (great_dao_seed,
 * cultivator_diary, stele_fragment, thien_dia_chi_kieu, yeu_dan_hung_giao,
 * broken_foundation_scroll, old_jade_slip - see data/materials/materials.ts)
 * are intentionally excluded: they are hand-placed signature drops tied to a
 * specific narrative countdown, not generic stage loot (see DropTable.ts's
 * note on great_dao_seed staying out of the shared pool).
 */
export const STAGE_DROP_TABLES: StageDropTable[] = [
  {
    realmId: 'mortal',
    floors: { min: 1, max: 10 },
    currency: { spiritStone: { min: 1, max: 2 }, techniqueInsight: { min: 5, max: 8 } },
    guaranteed: [
      // Was rollMortalEssenceAmount(isBoss) hardcoded in BattleLootSystem;
      // the boss branch is gone - a boss simply draws more often.
      { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 1, max: 3 }, chance: 0.7 },
    ],
    pool: [
      // base_kiem is the only equipment id every mortal-realm enemy family
      // (bandit, boar, dog, tiger, lynx, ox, fox, crocodile, wolf) actually
      // drops in the current data.
      { kind: 'equipment', itemId: 'base_kiem', weight: 15 },
      { kind: 'equipment_any', weight: 20 },
    ],
  },

  {
    realmId: 'qi_refining',
    floors: { min: 1, max: 10 },
    currency: { spiritStone: { min: 8, max: 12 }, techniqueInsight: { min: 35, max: 45 } },
    guaranteed: [],
    pool: [
      // Ore is the qi_refining realm's general-purpose crafting material,
      // dropped by 8 of the realm's families (bandit, earthworm,
      // forest_fiend, magma_boar, sand_lynx, rock_bear, blade_hawk,
      // metal_beetle) under the old hand-copied tables.
      { kind: 'material', itemId: 'qi_refining_ore_decade', amount: { min: 1, max: 3 }, weight: 30 },
      { kind: 'equipment_any', weight: 20 },
    ],
  },

  {
    realmId: 'foundation_establishment',
    floors: { min: 1, max: 10 },
    currency: { spiritStone: { min: 25, max: 35 }, techniqueInsight: { min: 90, max: 120 } },
    guaranteed: [],
    pool: [
      // Doan Bao Thach used to be gated by an explicit realm check. The
      // gate is now simply which tables list it: it appears here and in no
      // lower band, so the check has nothing left to ask (spec 2.5).
      { kind: 'material', itemId: 'doan_bao_thach', amount: { min: 1, max: 3 }, weight: 25 },
      // Ore still drops at this realm too under the old foundationBeast()
      // helper (bossEligible branch), so it stays in this band's pool.
      { kind: 'material', itemId: 'qi_refining_ore_decade', amount: { min: 1, max: 2 }, weight: 15 },
      { kind: 'equipment_any', weight: 20 },
    ],
  },
]

export function stageDropTableFor(
  realmId: string | undefined,
  floor: number | undefined,
): StageDropTable | undefined {
  if (!realmId) {
    return undefined
  }

  const effectiveFloor = floor ?? 1

  return STAGE_DROP_TABLES.find(
    (table) =>
      table.realmId === realmId &&
      effectiveFloor >= table.floors.min &&
      effectiveFloor <= table.floors.max,
  )
}
