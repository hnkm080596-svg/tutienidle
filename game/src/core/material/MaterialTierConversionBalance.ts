// MaterialTierConversionBalance (2026-08-28) — quy đổi cảnh giới cho Linh
// Mộc / Linh Khoáng: gộp LÊN 10 bậc thấp → 1 bậc cao theo thang cảnh giới
// Phàm Nhân → Luyện Khí → Trúc Cơ. Gỗ giữ dạng `<realm>_wood`; quáng giữ
// PHẨM khi lên cảnh giới (`<realm>_ore_<quality>` → `<nextRealm>_ore_<quality>`).
// CHỈ có chiều lên (giữ sink, cùng chủ trương convertSpiritStonesUp).
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

/**
 * Trả về id nguyên liệu CÙNG loại (và cùng phẩm với quáng) ở cảnh giới
 * kế tiếp.
 * - Gỗ `<realm>_wood` → `<nextRealm>_wood`.
 * - Quáng `<realm>_ore_<quality>` → `<nextRealm>_ore_<quality>`.
 *
 * Undefined nếu không phải gỗ/quáng trong thang, hoặc đã ở cảnh giới cao
 * nhất. Biến thể phẩm của gỗ (`<realm>_wood_<quality>`) KHÔNG quy đổi —
 * chúng là cost xây dựng, không phải dạng lâm sản thu hoạch.
 */
export function getNextTierMaterialId(materialId: string): string | undefined {
  for (const realmId of REALM_LADDER) {
    if (materialId === `${realmId}_wood`) {
      const nextRealmId = getNextRealmId(realmId)

      return nextRealmId ? `${nextRealmId}_wood` : undefined
    }
  }

  for (const realmId of REALM_LADDER) {
    const prefix = `${realmId}_ore_`

    if (materialId.startsWith(prefix)) {
      const quality = materialId.slice(prefix.length)

      if (!quality) {
        return undefined
      }

      const nextRealmId = getNextRealmId(realmId)

      return nextRealmId ? `${nextRealmId}_ore_${quality}` : undefined
    }
  }

  return undefined
}
