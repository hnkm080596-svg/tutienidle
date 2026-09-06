// MaterialTierConversionBalance (2026-08-28) — quy đổi cảnh giới cho Linh
// Mộc / Linh Khoáng: gộp LÊN 10 bậc thấp → 1 bậc cao theo thang cảnh giới
// Phàm Nhân → Luyện Khí → Trúc Cơ. gp123 6E (task C2): id theo trục tuổi
// thống nhất — gỗ `<realm>_wood_<age>` → `<nextRealm>_wood_<age>`; quáng
// giữ TUỔI khi lên cảnh giới (`<realm>_ore_<age>` → `<nextRealm>_ore_<age>`).
// CHỈ có chiều lên (giữ sink, cùng chủ trương convertSpiritStonesUp).
// NOTE (plan Group 6E / task E2): tính năng quy đổi này sẽ bị XÓA ở task
// E2 — giữ nguyên hoạt động cho tới lúc đó.
import { HERB_AGES } from '../production/ProductionTypes'
import { SUPPORTED_PROFESSION_REALMS } from '../profession/ProfessionMaterial'

/** Tỉ lệ gộp: 10 nguyên liệu cảnh giới thấp → 1 nguyên liệu cảnh giới kế. */
export const MATERIAL_TIER_CONVERSION_RATIO = 10

/** Thang cảnh giới sản xuất — nguồn sự thật từ profession scope. */
const REALM_LADDER: readonly string[] = SUPPORTED_PROFESSION_REALMS

function getNextRealmId(realmId: string): string | undefined {
  const index = REALM_LADDER.indexOf(realmId)

  if (index < 0) {
    return undefined
  }

  return REALM_LADDER[index + 1]
}

/** Tách `<realm>_wood_<age>` / `<realm>_ore_<age>` → { kind, realmId, age } | null. */
function parseProfessionMaterial(materialId: string): {
  kind: 'wood' | 'ore'

  realmId: string

  age: string
} | null {
  for (const kind of ['wood', 'ore'] as const) {
    const marker = `_${kind}_`

    const index = materialId.indexOf(marker)

    if (index <= 0) {
      continue
    }

    const realmId = materialId.slice(0, index)

    const age = materialId.slice(index + marker.length)

    if (HERB_AGES.includes(age as (typeof HERB_AGES)[number])) {
      return { kind, realmId, age }
    }
  }

  return null
}

/**
 * Trả về id nguyên liệu CÙNG loại (và cùng tuổi) ở cảnh giới kế tiếp —
 * gp123 6E task C2: gỗ và khoáng đều dạng `<realm>_<kind>_<age>`.
 *
 * Undefined nếu không phải gỗ/quáng theo trục tuổi, hoặc đã ở cảnh giới
 * cao nhất.
 */
export function getNextTierMaterialId(materialId: string): string | undefined {
  const parsed = parseProfessionMaterial(materialId)

  if (!parsed) {
    return undefined
  }

  const nextRealmId = getNextRealmId(parsed.realmId)

  return nextRealmId ? `${nextRealmId}_${parsed.kind}_${parsed.age}` : undefined
}
