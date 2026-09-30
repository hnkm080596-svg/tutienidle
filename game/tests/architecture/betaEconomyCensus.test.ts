/**
 * BETA SCOPE LOCK v2 sec.17 - economy census: for every material with a
 * live beta faucet there must be a live beta sink, and every material
 * consumed by a beta sink must be producible - unless it sits in an
 * authored exemption class in BETA_ECONOMY_EXEMPTIONS (lore /
 * store_of_value / base_currency - the classification authority is
 * core/betaScope.ts, this file only reads it).
 *
 * Sources computed: Thanh Van production rewards (forest/mine always,
 * grotto filtered to beta recipe families - ProductionSystem applies
 * the same filter at roll time), stage-table material drops, roster
 * family-table material drops, roster-enemy signature drops, enabled
 * quest itemDrops, building producesMaterialId, equipment dissolve
 * output. Post-resolve suppressions (bodyPath essences, companion pull
 * token, domain-gated artifact shard) are excluded, mirroring
 * BattleLootSystem's delivery filters.
 *
 * Sinks computed: beta-family recipe costs (herb variants, fuel wood
 * per age, spirit stone, special ingredients), the enhance cost
 * catalog, building upgrade costs, collect-quest turn-ins, and vendor
 * sellability (residue path for sellable categories). Decompose, wash/
 * refine, companion feed, and hidden-channel emissions are gated this
 * phase and do not count.
 */
import { describe, expect, it } from 'vitest'
import { materials } from '@/data/materials/materials'
import { STAGE_DROP_TABLES } from '@/data/drop/StageDropTables'
import { FAMILY_DROP_TABLES } from '@/data/drop/FamilyDropTables'
import {
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
} from '@/core/production/ProductionCatalog'
import { HERB_AGES } from '@/core/production/ProductionTypes'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { QUESTS } from '@/data/quest/quests'
import { buildings as BUILDINGS } from '@/data/building/buildings'
import { createDefaultEquipmentOperationCostCatalog } from '@/core/equipment/EquipmentOperationCostCatalog'
import { SUPPORTED_PROFESSION_REALMS } from '@/core/profession/ProfessionMaterial'
import { buildProfessionMaterialId } from '@/core/profession/ProfessionMaterial'
import { ENEMIES } from '@/data/enemy/Enemies'
import {
  BETA_ENEMY_ROSTER,
  betaEconomyClassOf,
  betaRecipeFamilyOfId,
  isBetaQuestEnabled,
  isScopeHidden,
} from '@/core/betaScope'
import { physiqueEssenceGradeOf } from '@/data/realm/PhysiqueEssence'
import {
  COMPANION_PULL_TOKEN_MATERIAL_IDS,
  isDomainScopedAcquisitionEnabled,
} from '@/core/realm/ReleasePolicy'
import { VENDOR_SELLABLE_CATEGORIES } from '@/core/economy/VendorBalance'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'

const BETA_REALM_IDS = new Set(SUPPORTED_PROFESSION_REALMS)

const materialById = new Map(materials.map((material) => [material.id, material]))

/** True when the drop-delivery filters in BattleLootSystem still emit. */
function deliversInBeta(materialId: string): boolean {
  if (
    physiqueEssenceGradeOf(materialId) !== undefined &&
    isScopeHidden('bodyPath')
  ) {
    return false
  }
  if (
    COMPANION_PULL_TOKEN_MATERIAL_IDS.includes(
      materialId as 'chieu_hien_lenh',
    ) &&
    isScopeHidden('companion')
  ) {
    return false
  }
  const domainRealmId = materialById.get(materialId)?.domainUnlockRealmId
  if (
    domainRealmId !== undefined &&
    !isDomainScopedAcquisitionEnabled(domainRealmId, 'foundation_establishment')
  ) {
    return false
  }
  return true
}

/** Realm token of a profession material, else undefined (legacy ids). */
function professionRealmOf(materialId: string): string | undefined {
  return materialById.get(materialId)?.profession?.realmId
}

function collectEconomy(): {
  sources: Map<string, Set<string>>
  sinks: Map<string, Set<string>>
} {
  const sources = new Map<string, Set<string>>()
  const sinks = new Map<string, Set<string>>()

  const addSource = (materialId: string, label: string) => {
    if (!deliversInBeta(materialId)) return
    const set = sources.get(materialId) ?? new Set<string>()
    set.add(label)
    sources.set(materialId, set)
  }

  const addSink = (materialId: string, label: string) => {
    const set = sinks.get(materialId) ?? new Set<string>()
    set.add(label)
    sinks.set(materialId, set)
  }

  // --- faucets ---
  for (const reward of THANH_VAN_FOREST_REWARDS) {
    addSource(reward.materialId, `forest:${reward.realmId}`)
  }
  for (const reward of THANH_VAN_MINE_REWARDS) {
    addSource(reward.materialId, `mine:${reward.realmId}`)
  }
  for (const herb of THANH_VAN_GROTTO_HERBS) {
    // ProductionSystem gates the grotto identity roll on the same
    // betaRecipeFamilyOfId check - dormant-family herbs never emit.
    if (betaRecipeFamilyOfId(herb.pillRecipeId) === null) continue
    addSource(herb.materialId, `grotto:${herb.realmId}`)
  }

  for (const table of STAGE_DROP_TABLES) {
    if (!BETA_REALM_IDS.has(table.realmId)) continue
    for (const entry of [...table.guaranteed, ...table.pool]) {
      if (entry.kind === 'material' && entry.itemId) {
        addSource(entry.itemId, `stage:${table.realmId}`)
      }
    }
  }

  const rosterEnemies = ENEMIES.filter((enemy) =>
    BETA_ENEMY_ROSTER.some((entry) => entry.id === enemy.id),
  )
  const rosterFamilies = new Set(
    rosterEnemies.map((enemy) => enemy.family).filter((family): family is string => !!family),
  )
  for (const familyId of rosterFamilies) {
    const table = FAMILY_DROP_TABLES.find((entry) => entry.familyId === familyId)
    for (const entry of [...(table?.guaranteed ?? []), ...(table?.pool ?? [])]) {
      if (entry.kind === 'material' && entry.itemId) {
        addSource(entry.itemId, `family:${familyId}`)
      }
    }
  }

  for (const enemy of rosterEnemies) {
    for (const drop of enemy.signatureDrops ?? []) {
      if (drop.kind === 'material' && drop.itemId) {
        addSource(drop.itemId, `signature:${enemy.id}`)
      }
    }
  }

  for (const quest of QUESTS) {
    if (!isBetaQuestEnabled(quest)) continue
    for (const reward of quest.reward.itemDrops ?? []) {
      if (reward.kind === 'material') {
        addSource(reward.itemId, `quest:${quest.id}`)
      }
    }
  }

  for (const building of BUILDINGS) {
    if (building.producesMaterialId) {
      addSource(building.producesMaterialId, `building:${building.id}`)
    }
  }

  // Equipment dissolve is a beta action and pays tinh hoa.
  addSource(LUYEN_KHI_TINH_HOA_ID, 'equipment:dissolve')

  // --- sinks ---
  for (const recipe of alchemyRecipes) {
    if (betaRecipeFamilyOfId(recipe.id) === null || recipe.retired === true) {
      continue
    }
    for (const variant of recipe.herbVariants) {
      addSink(variant.materialId, `recipe:${recipe.id}:herb`)
      // resolveFuelWood accepts wood of the recipe realm at the herb's
      // age (6E) - every age variant is a live sink.
      addSink(
        buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age),
        `recipe:${recipe.id}:fuel`,
      )
    }
    for (const special of recipe.specialIngredients ?? []) {
      addSink(special.materialId, `recipe:${recipe.id}:special`)
    }
    if (recipe.spiritStoneCost > 0) {
      addSink(
        getSpiritStoneMaterialIdForRealmTier(getRealmTier(recipe.realmId)),
        `recipe:${recipe.id}:stone`,
      )
    }
  }

  const enhanceCatalog = createDefaultEquipmentOperationCostCatalog()
  for (const realmId of BETA_REALM_IDS) {
    const cost = enhanceCatalog.resolve('enhance', realmId, {})
    for (const material of cost?.materials ?? []) {
      addSink(material.materialId, `enhance:${realmId}`)
    }
    if ((cost?.spiritStone ?? 0) > 0) {
      addSink(
        getSpiritStoneMaterialIdForRealmTier(getRealmTier(realmId)),
        `enhance:${realmId}:stone`,
      )
    }
  }

  for (const building of BUILDINGS) {
    for (const levelCost of building.upgradeCost ?? []) {
      for (const cost of levelCost) {
        addSink(cost.materialId, `building:${building.id}`)
      }
    }
  }

  for (const quest of QUESTS) {
    if (!isBetaQuestEnabled(quest)) continue
    if (quest.condition.kind === 'collect') {
      addSink(quest.condition.materialId, `quest-turnin:${quest.id}`)
    }
  }

  // Vendor: sellable categories always have the residue sink.
  for (const material of materials) {
    if (
      (VENDOR_SELLABLE_CATEGORIES as readonly string[]).includes(material.category)
    ) {
      addSink(material.id, 'vendor')
    }
  }

  return { sources, sinks }
}

describe('sec.17 beta economy census - no orphan source, no orphan sink', () => {
  const { sources, sinks } = collectEconomy()

  it('the census itself covers the designed economy surface', () => {
    // Faucets: 15 forest wood + 15 mine ore + 45 beta-family grotto
    // herbs (3 herbs x 3 realms x 5 ages) + signature drops + Linh
    // Tuyen spirit stone + dissolve tinh hoa = ~80 live source rows.
    // An importer regression that yields an empty set must fail here,
    // not pass vacuously below.
    expect(sources.size).toBeGreaterThanOrEqual(60)
    expect(sinks.size).toBeGreaterThanOrEqual(60)
  })

  it('every material with a live beta source has a live beta sink or an exemption', () => {
    const orphans: string[] = []
    for (const [materialId, labels] of sources) {
      if (betaEconomyClassOf(materialId) !== undefined) continue
      if (!sinks.has(materialId)) {
        orphans.push(`${materialId} (sources: ${[...labels].join(',')})`)
      }
    }
    expect(orphans).toEqual([])
  })

  it('every material consumed by a beta-realm purpose sink has a live beta source or an exemption', () => {
    const orphans: string[] = []
    for (const [materialId, labels] of sinks) {
      // Vendor residue is a generic offramp, not a purpose: a
      // dormant-family herb that only vendored is NOT a beta-enabled
      // material, so vendor-only sinks impose no source requirement.
      const purposeLabels = [...labels].filter((label) => label !== 'vendor')
      if (purposeLabels.length === 0) continue

      // Materials whose realm is outside beta scope (e.g. Kim Dan+ wood
      // in building upgrade placeholders) are dormant economy entries;
      // their sink tier is unreachable, so they are not census members.
      const realmId = professionRealmOf(materialId)
      if (realmId !== undefined && !BETA_REALM_IDS.has(realmId)) continue

      if (betaEconomyClassOf(materialId) !== undefined) continue
      if (!sources.has(materialId)) {
        orphans.push(`${materialId} (sinks: ${purposeLabels.join(',')})`)
      }
    }
    expect(orphans).toEqual([])
  })

  it('suppressed faucets stay out of the source set entirely', () => {
    // Body-path essences, the companion pull token, and the artifact
    // shard must not appear as beta sources.
    const suppressed = [
      'tinh_hoa_pham_the',
      'tinh_hoa_bao_the',
      'tinh_hoa_phap_the',
      'chieu_hien_lenh',
      'doan_bao_thach',
    ]
    for (const materialId of suppressed) {
      expect(sources.has(materialId), `${materialId} must have no beta source`).toBe(false)
    }
  })

  it('dormant recipe families emit no grotto herbs', () => {
    const dormantHerbs = THANH_VAN_GROTTO_HERBS.filter(
      (herb) => betaRecipeFamilyOfId(herb.pillRecipeId) === null,
    )
    expect(dormantHerbs.length).toBeGreaterThan(0)
    for (const herb of dormantHerbs) {
      expect(
        sources.has(herb.materialId),
        `${herb.materialId} (dormant family ${herb.pillRecipeId}) must have no beta source`,
      ).toBe(false)
    }
  })

  it('the three re-sourced equipment bases drop on roster families', () => {
    const poolByFamily = new Map(
      FAMILY_DROP_TABLES.map((table) => [
        table.familyId,
        table.pool.map((entry) => entry.itemId),
      ]),
    )
    const familyOf = rosterFamilyPairs()
    expect(poolByFamily.get(familyOf.get('mortal_wild_boar')!)).toContain('base_quan')
    expect(poolByFamily.get(familyOf.get('giant_earthworm')!)).toContain('base_hai')
    expect(poolByFamily.get(familyOf.get('foundation_sand_scorpion')!)).toContain('base_gioi')
  })
})

function rosterFamilyPairs(): Map<string, string> {
  return new Map(
    BETA_ENEMY_ROSTER.flatMap((entry): [string, string][] => {
      const family = ENEMIES.find((enemy) => enemy.id === entry.id)?.family
      return family === undefined ? [] : [[entry.id, family]]
    }),
  )
}
