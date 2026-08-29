import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'
import { QUESTS } from '../quest/quests'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../realm/BodyRefinement'
import { DOAN_BAO_THACH_MATERIAL_ID } from '../../core/artifact/ArtifactProgression'
import { createDefaultEquipmentOperationCostCatalog } from '../../core/equipment/EquipmentOperationCostCatalog'
import { SUPPORTED_PROFESSION_REALMS } from '../../core/profession/ProfessionMaterial'
import { alchemyRecipes } from '../alchemy/alchemyRecipes'
import { THIEN_DIA_CHI_KIEU_MATERIAL_ID } from '../realm/Meridians'

// Item lore / manh mối Đột Phá Trúc Cơ — CỐ Ý không có sink chức năng
// (description ẩn công dụng, xem data/materials/materials.ts). Chúng được
// phép rơi mà không cần nơi tiêu thụ.
const LORE_ALLOWLIST = new Set([
  'great_dao_seed',
  'broken_foundation_scroll',
  'old_jade_slip',
  'cultivator_diary',
  'stele_fragment',
])

function collectDroppedMaterialIds(): Set<string> {
  const ids = new Set<string>()

  // Spec dot-pha-loi-kiep §5.1 — quái Kiếp đã dỡ (TribulationDirector
  // không dùng quái), chỉ ENEMIES còn rơi material.
  for (const enemy of ENEMIES) {
    for (const reward of [enemy.rewards, enemy.eliteRewards, enemy.bossRewards]) {
      for (const drop of reward?.itemDrops ?? []) {
        if (drop.kind === 'material') {
          ids.add(drop.itemId)
        }
      }
    }
  }

  return ids
}

function collectSinkMaterialIds(): Set<string> {
  const sinks = new Set<string>()

  // Quest nộp vật phẩm (collect).
  for (const quest of QUESTS) {
    if (quest.condition.kind === 'collect') {
      sinks.add(quest.condition.materialId)
    }
  }

  // Luyện Thể — đầu tư Tinh Hoa Phàm Thể.
  sinks.add(TINH_HOA_PHAM_THE_MATERIAL_ID)

  // Pháp bảo — Đoán Bảo Thạch.
  sinks.add(DOAN_BAO_THACH_MATERIAL_ID)

  // Khí Đường Cường Hóa — quặng cùng cảnh giới.
  const catalog = createDefaultEquipmentOperationCostCatalog()
  for (const realmId of SUPPORTED_PROFESSION_REALMS) {
    for (const material of catalog.resolve('enhance', realmId)?.materials ?? []) {
      sinks.add(material.materialId)
    }
  }

  // Đan phương đặc biệt (spec dot-pha-loi-kiep §4.1b) — Yêu Đan là
  // nguyên liệu chính Thông Mạch Đan/Trúc Cơ Đan.
  for (const recipe of alchemyRecipes) {
    for (const special of recipe.specialIngredients ?? []) {
      sinks.add(special.materialId)
    }
  }

  // Bát Mạch — Kỳ Kinh Thiên Địa Chi Kiều (đường 9) cần nguyên liệu ẩn.
  sinks.add(THIEN_DIA_CHI_KIEU_MATERIAL_ID)

  return sinks
}

describe('Enemy drops — mọi material rơi đều có sink (economy T6)', () => {
  it('không material nào rơi từ quái/kiếp mà vừa không có sink vừa không phải lore item', () => {
    const dropped = collectDroppedMaterialIds()
    const sinks = collectSinkMaterialIds()

    const deadDrops = [...dropped].filter(
      (id) => !sinks.has(id) && !LORE_ALLOWLIST.has(id),
    )

    expect(
      deadDrops,
      `Material rơi nhưng không có nơi tiêu thụ: ${deadDrops.join(', ')}`,
    ).toEqual([])
  })

  it('quặng + tinh hoa rơi thật sự được phủ bởi sink', () => {
    const sinks = collectSinkMaterialIds()

    expect(sinks.has('qi_refining_ore_hoang')).toBe(true)
    expect(sinks.has(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(true)
  })
})
