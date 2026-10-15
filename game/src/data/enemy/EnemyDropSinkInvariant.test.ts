import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'
import { STAGE_DROP_TABLES } from '../drop/StageDropTables'
import { FAMILY_DROP_TABLES } from '../drop/FamilyDropTables'
import { QUESTS } from '../quest/quests'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../realm/BodyRefinement'
import { PHYSIQUE_ESSENCES, physiqueEssenceGradeOf } from '../realm/PhysiqueEssence'
import { BODY_CHAPTERS } from '../../core/realm/body/BodyChapter'
import { DOAN_BAO_THACH_MATERIAL_ID } from '../../core/artifact/ArtifactProgression'
import { createDefaultEquipmentOperationCostCatalog } from '../../core/equipment/EquipmentOperationCostCatalog'
import { SUPPORTED_PROFESSION_REALMS } from '../../core/profession/ProfessionMaterial'
import { alchemyRecipes } from '../alchemy/alchemyRecipes'
import { COMPANION_PULL_TOKEN_ID } from '../../core/game/GameManagerCompanionOps'

// Item lore / manh moi Dot Pha Truc Co - CO Y khong co sink chuc nang
// (description an cong dung, xem data/materials/materials.ts). Chung duoc
// phep roi ma khong can noi tieu thu.
const LORE_ALLOWLIST = new Set([
  'broken_foundation_scroll',
  'old_jade_slip',
  'cultivator_diary',
  'stele_fragment',
])

function collectDroppedMaterialIds(): Set<string> {
  const ids = new Set<string>()

  // Drop-system (2026-09-12): materials drop from THREE sources now -
  // stage tables, family tables, and per-enemy signatureDrops. The old
  // rewards/eliteRewards/bossRewards fields are being retired; missing
  // any one source here would leave this invariant green while the rule
  // leaks.
  const addFrom = (entries: readonly { kind: string; itemId?: string }[]) => {
    for (const entry of entries) {
      if (entry.kind === 'material' && entry.itemId) {
        ids.add(entry.itemId)
      }
    }
  }

  for (const table of STAGE_DROP_TABLES) {
    addFrom(table.guaranteed)
    addFrom(table.pool)
  }

  for (const table of FAMILY_DROP_TABLES) {
    addFrom(table.guaranteed)
    addFrom(table.pool)
  }

  for (const enemy of ENEMIES) {
    addFrom(enemy.signatureDrops ?? [])
  }

  return ids
}

function collectSinkMaterialIds(): Set<string> {
  const sinks = new Set<string>()

  // Quest nop vat pham (collect).
  for (const quest of QUESTS) {
    if (quest.condition.kind === 'collect') {
      sinks.add(quest.condition.materialId)
    }
  }

  // Luyen The - an essence drains at investBodyChapter through the
  // chapter that declares it as material currency (body_refinement ->
  // pham, zhou_tian -> phap). Owner ruling 2026-10-10: an essence no
  // chapter consumes (tinh_hoa_bao_the today) has no sink, and the
  // intake cap yields its drops nothing at the award seam, so it can
  // never accumulate in the bag (exempted from the dead-drop rule
  // below).
  for (const chapter of BODY_CHAPTERS) {
    for (const currency of [chapter.currency, chapter.auxCurrency]) {
      if (currency?.bag === 'material' && physiqueEssenceGradeOf(currency.id) !== undefined) {
        sinks.add(currency.id)
      }
    }
  }

  // Phap bao - Doan Bao Thach.
  sinks.add(DOAN_BAO_THACH_MATERIAL_ID)

  // Khi Duong Cuong Hoa - quang cung canh gioi.
  const catalog = createDefaultEquipmentOperationCostCatalog()
  for (const realmId of SUPPORTED_PROFESSION_REALMS) {
    for (const material of catalog.resolve('enhance', realmId)?.materials ?? []) {
      sinks.add(material.materialId)
    }
  }

  // Dan phuong dac biet (spec dot-pha-loi-kiep sec.4.1b) - Yeu Dan la
  // nguyen lieu chinh Thong Mach Dan/Truc Co Dan.
  for (const recipe of alchemyRecipes) {
    for (const special of recipe.specialIngredients ?? []) {
      sinks.add(special.materialId)
    }
  }

  // Chieu Hien Quan (companion gacha Task 6) - Chieu Hien Lenh is spent
  // by GameManagerCompanionOps.pullCompanion() via materialBag.remove.
  sinks.add(COMPANION_PULL_TOKEN_ID)

  return sinks
}

describe('Enemy drops — mọi material rơi đều có sink (economy T6)', () => {
  it('không material nào rơi từ quái/kiếp mà vừa không có sink vừa không phải lore item', () => {
    const dropped = collectDroppedMaterialIds()
    const sinks = collectSinkMaterialIds()

    // Owner ruling 2026-10-10 - intake-cap exemption: a physique
    // essence with no consuming chapter can never reach the bag (the
    // award seam skips its credit), so it is not a dead drop.
    const capGatedEssence = new Set<string>(
      PHYSIQUE_ESSENCES.map((def) => def.materialId).filter((id) => !sinks.has(id)),
    )

    const deadDrops = [...dropped].filter(
      (id) => !sinks.has(id) && !LORE_ALLOWLIST.has(id) && !capGatedEssence.has(id),
    )

    expect(
      deadDrops,
      `Material rơi nhưng không có nơi tiêu thụ: ${deadDrops.join(', ')}`,
    ).toEqual([])
  })

  it('quặng + tinh hoa rơi thật sự được phủ bởi sink', () => {
    const sinks = collectSinkMaterialIds()

    expect(sinks.has('material_spirit_ore_decade')).toBe(true)
    expect(sinks.has(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(true)
  })
})
