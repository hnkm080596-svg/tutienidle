import type { Material } from '@/core/material/Material'
import { SPIRIT_STONE_MATERIALS } from '@/core/material/SpiritStoneMaterial'
import type { ProfessionMaterialMeta } from '@/core/profession/ProfessionMaterial'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import { REALM_TIERS } from '@/core/realm/RealmTierMap'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'

// sourceType (MASTER SPEC Mục II-V) — nhãn nguồn CHÍNH, không ràng
// buộc cứng. Nhóm nguyên liệu tự nhiên age-tiered (Linh Thảo/Linh Mộc/
// Linh Thiết) là nguồn thu chính; currency đặc thù (great_dao_seed +
// 4 item Trúc Cơ ẩn) giữ NGUYÊN — không thuộc phạm vi đơn giản hoá
// "nguyên liệu tự nhiên" của tài liệu.
const legacyMaterials: Material[] = [
  // Realm Passive & Pressure System (2026-08-20) — currency Luyện Thể,
  // CHỈ rơi từ 20 quái Phàm Nhân (data/enemy/Enemies.ts), đầu tư qua
  // GameManager.investBodyRefinement() để lấp đầy 6 tầng (xem
  // data/realm/LuyenThe.ts/core/realm/BodyRefinementSystem.ts). id khớp
  // TINH_HOA_PHAM_THE_MATERIAL_ID.
  {
    id: 'tinh_hoa_pham_the',
    name: 'Tinh Hoa Phàm Thể',
    category: 'essence',
    sourceType: 'monster',
    description: 'Tinh hoa ngưng tụ từ thể phách phàm thú, dùng để rèn luyện 6 tầng thân thể.',
  },

  {
    id: LUYEN_KHI_TINH_HOA_ID,
    name: 'Luyện Khí Tinh Hoa',
    category: 'essence',
    sourceType: 'building',
    description: 'Tinh hoa thu được từ phân giải trang bị, dùng cho các thao tác luyện khí.',
    // Currency-like sink/source shared by every grade. Match Linh Thạch's
    // effectively unbounded safe-integer convention so normal progression
    // cannot hit the former reachable 9,999 cap.
    stackLimit: Number.MAX_SAFE_INTEGER,
  },

  // Đột Phá Trúc Cơ (Phase 3) — điều kiện ẩn của Đại Đạo (mục 8/15
  // spec `breakthrough`), rơi 0.01% từ Boss "Đại Vương Sơn Tặc" (xem
  // data/enemy/Enemies.ts's bandit.bossRewards). Description CỐ Ý
  // không tiết lộ công dụng — verbatim đúng spec, KHÔNG được sửa.
  {
    id: 'great_dao_seed',
    name: 'Đại Đạo Chi Cơ',
    category: 'other',
    sourceType: 'boss',
    description: 'Một vật phẩm kỳ dị, không thể xác định công dụng.',
  },

  // Đoán Bảo Thạch + spec dot-pha-loi-kiep §4.1b/c — 2 nguyên liệu
  // của gate Trúc Cơ: Yêu Đan (boss Luyện Khí tầng 10, nguyên liệu
  // chính Thông Mạch Đan/Trúc Cơ Đan) + Thiên Địa Chi Kiều (5% từ
  // quái ẩn Huyết Mông, nguyên liệu Kỳ Kinh).
  {
    id: 'yeu_dan_hung_giao',
    name: 'Yêu Đan',
    category: 'other',
    sourceType: 'boss',
    description: 'Đan hạch ngưng tụ trong thân Hung Giao Xà — nguyên liệu chính luyện Thông Mạch Đan.',
    stackLimit: 100,
  },
  {
    id: 'thien_dia_chi_kieu',
    name: 'Thiên Địa Chi Kiều',
    category: 'other',
    sourceType: 'monster',
    description: 'Một vật phẩm kỳ dị, không thể xác định công dụng.',
    stackLimit: 10,
  },

  // Bản Mệnh Pháp Bảo (2026-08-27, foundation-artifact-system-plan.md
  // §6) — đá nâng phẩm, rơi từ quái Trúc Cơ trở lên (xem
  // BattleLootSystem.grantArtifactStoneDrop() + ArtifactDropBalance.ts).
  {
    id: 'doan_bao_thach',
    name: 'Đoán Bảo Thạch',
    category: 'other',
    sourceType: 'monster',
    description: 'Đá dị chất kết tinh từ khí tức yêu thú Trúc Cơ trở lên, dùng để nâng phẩm bản mệnh pháp bảo.',
  },

  // Đột Phá Trúc Cơ (Phase 6) — loot "vô thưởng vô phạt" (mục 14 spec
  // `breakthrough`): KHÔNG stat/effect, KHÔNG mở quest, KHÔNG dùng
  // crafting — chỉ tạo manh mối qua description, verbatim đúng spec,
  // KHÔNG được sửa/diễn giải thêm.
  {
    id: 'broken_foundation_scroll',
    name: 'Tàn Quyển Trúc Cơ',
    category: 'other',
    sourceType: 'exploration',
    description: 'Chín tầng đã đủ để bước vào con đường của người thường.',
  },

  {
    id: 'old_jade_slip',
    name: 'Ngọc Giản Cũ',
    category: 'other',
    sourceType: 'exploration',
    description: 'Có người dừng lại ở tầng thứ chín. Có người không.',
  },

  {
    id: 'cultivator_diary',
    name: 'Nhật Ký Tu Sĩ',
    category: 'other',
    sourceType: 'monster',
    description: 'Ta đã vượt qua tầng thứ mười hai.',
  },

  {
    id: 'stele_fragment',
    name: 'Mảnh Bia',
    category: 'other',
    sourceType: 'monster',
    description: 'Mười hai...',
  },
]

// ============================================================
// NGUYÊN LIỆU NGHỀ MỚI (2026-08-25, resource-professions-rework plan
// §5/§6): KHÔNG còn cặp raw|processed (plan §2). Ba nhóm trực tiếp:
// - Lâm: 3 gỗ `<realm>_wood` — xây/nâng công trình + nhiên liệu đan lò.
// - Quáng: `<realm>_ore_<quality>` — sink Khí Đường (Cường Hóa/Tẩy
//   Luyện), phẩm là metadata material.
// - Động Thiên: mỗi đan phương một thảo riêng × 4 niên đại
//   `<herbBase>_<age>` — sink Đan Phòng.
// Tất cả sinh bằng generator để tránh author tay 66 entry lệch chuẩn;
// tên hiển thị đặt TRẦN ở đây (không parse từ id).
// ============================================================

interface ProfessionRealmCell {
  realmId: string

  realmLabel: string
}

const PROFESSION_REALM_CELLS: readonly ProfessionRealmCell[] = [
  { realmId: 'mortal', realmLabel: 'Phàm Nhân' },
  { realmId: 'qi_refining', realmLabel: 'Luyện Khí' },
  { realmId: 'foundation_establishment', realmLabel: 'Trúc Cơ' },
]

// Nhãn "chất" thống nhất theo hệ TUỔI (2026-08-30, spec
// 2026-08-30-unify-material-quality-names-design.md): Gỗ/Khoáng bỏ nhãn
// Hoàng/Huyền/Địa/Thiên/Tiên — dùng cùng hệ tuổi với Linh Thảo. ID
// quality (`hoang`..`tien`) GIỮ NGUYÊN (save/recipe/quy đổi tier không
// đổi); chỉ nhãn hiển thị thay. Bậc 5 mở rộng "Thượng Cổ".
const ORE_QUALITY_LABELS: Record<string, string> = {
  hoang: 'Thập Niên',
  huyen: 'Bách Niên',
  dia: 'Thiên Niên',
  thien: 'Vạn Niên',
  tien: 'Thượng Cổ',
}

/** Gỗ thường Lâm (không phẩm) — mức tuổi thấp nhất của hệ thống. */
const PLAIN_WOOD_AGE_LABEL = 'Thập Niên'

function professionResourceName(realmId: string, kind: 'Linh Mộc' | 'Linh Khoáng', ageLabel?: string): string {
  const suffix = ageLabel ? ` ${ageLabel}` : ''

  return `${suffix} ${kind}`.trim()
}

const HERB_AGE_YEARS: Record<string, number> = {
  decade: 10,
  century: 100,
  millennium: 1000,
  myriad_year: 10000,
}

function buildProfessionMaterials(): Material[] {
  const list: Material[] = []

  // ---- Lâm: 3 gỗ ----
  for (const cell of PROFESSION_REALM_CELLS) {
    list.push({
      id: `${cell.realmId}_wood`,
      name: professionResourceName(cell.realmId, 'Linh Mộc', PLAIN_WOOD_AGE_LABEL),
      category: 'wood',
      element: 'wood',
      sourceType: 'exploration',
      description: `Linh mộc ${cell.realmLabel} của Thanh Vân Lâm — xây công trình và làm nhiên liệu đan lò.`,
      profession: {
        resourceKind: 'wood',
        realmId: cell.realmId,
      },
    })
  }

  // Scaffold 9 cảnh giới × 5 phẩm Linh Mộc. Các tier Kim Đan+ là data
  // placeholder để building level 4-9 có cost hợp lệ trong registry.
  for (const realmId of REALM_TIERS) {
    for (const quality of ['hoang', 'huyen', 'dia', 'thien', 'tien']) {
      list.push({
        id: `${realmId}_wood_${quality}`,
        name: professionResourceName(realmId, 'Linh Mộc', ORE_QUALITY_LABELS[quality]),
        category: 'wood',
        element: 'wood',
        sourceType: 'exploration',
        description: 'Linh mộc phân phẩm dùng cho xây dựng động phủ.',
        profession: { resourceKind: 'wood', realmId, quality },
      })
    }
  }

  // Bổ sung scaffold Linh Khoáng cho sáu cảnh giới chưa có production thật.
  for (const realmId of REALM_TIERS.slice(3)) {
    for (const quality of ['hoang', 'huyen', 'dia', 'thien', 'tien']) {
      list.push({
        id: `${realmId}_ore_${quality}`,
        name: professionResourceName(realmId, 'Linh Khoáng', ORE_QUALITY_LABELS[quality]),
        category: 'ore',
        element: 'metal',
        sourceType: 'exploration',
        description: 'Linh khoáng phân phẩm dùng cho luyện khí và xây dựng.',
        profession: { resourceKind: 'ore', realmId, quality },
      })
    }
  }

  // ---- Quáng: 3 tier × 5 phẩm ----
  for (const cell of PROFESSION_REALM_CELLS) {
    for (const quality of ['hoang', 'huyen', 'dia', 'thien', 'tien']) {
      list.push({
        id: `${cell.realmId}_ore_${quality}`,
        name: professionResourceName(cell.realmId, 'Linh Khoáng', ORE_QUALITY_LABELS[quality]),
        category: 'ore',
        element: 'metal',
        sourceType: 'exploration',
        description: `Quảng thạch ${ORE_QUALITY_LABELS[quality]} của ${cell.realmLabel} — nguyên liệu Khí Đường.`,
        profession: {
          resourceKind: 'ore',
          realmId: cell.realmId,
          quality,
        },
      })
    }
  }

  return list
}

function buildReworkPillHerbs(): Material[] {
  const ages = ['decade', 'century', 'millennium', 'myriad_year'] as const

  // Nhãn tuổi thảo — dùng chung bảng nhãn chất (decade..myriad_year trùng
  // key với 4 bậc đầu của gỗ/khoáng).
  const HERB_AGE_LABELS: Record<string, string> = {
    decade: ORE_QUALITY_LABELS.decade!,
    century: ORE_QUALITY_LABELS.century!,
    millennium: ORE_QUALITY_LABELS.millennium!,
    myriad_year: ORE_QUALITY_LABELS.thien!,
  }

  return REALM_TIERS.flatMap((realmId) =>
    PILL_FAMILIES.flatMap((family) => {
      const herbBaseId = `${family.herbId}_${realmId}`

      return ages.map((age) => ({
        id: `${herbBaseId}_${age}`,
        name: `${HERB_AGE_LABELS[age]} ${family.herbName}`,
        category: 'herb' as const,
        years: HERB_AGE_YEARS[age],
        element: 'wood' as const,
        sourceType: 'exploration' as const,
        icon: `/assets/materials/herbs/${family.herbId}/${age}.png`,
        description: `Linh thảo chủ dược của ${family.name}, niên đại quyết định tỷ lệ thành đan.`,
        profession: {
          resourceKind: 'herb' as const,
          realmId,
          age,
          pillRecipeId: `alchemy_${family.id}_${realmId}`,
          herbBaseId,
        },
      }))
    }),
  )
}

function attachSharedProfessionResourceIcon(material: Material): Material {
  if (material.icon || (material.category !== 'wood' && material.category !== 'ore')) {
    return material
  }

  return {
    ...material,
    icon:
      material.category === 'wood'
        ? '/assets/materials/linh_moc.png'
        : '/assets/materials/linh_khoang.png',
  }
}

export const materials: Material[] = [
  // Linh Thạch — MATERIAL thật (plan Workstream F), tham gia mọi sort
  // trong tab Nguyên Liệu như material bình thường; KHÔNG còn currency
  // state trên PlayerData.
  ...SPIRIT_STONE_MATERIALS,

  // Linh thảo legacy (Linh Chi/Quế/Cúc Hoa/Linh Thảo Chủng) đã bị xoá
  // hẳn khỏi legacyMaterials — Đan Phòng chỉ dùng 8 họ thảo mới bên dưới.
  ...legacyMaterials,

  ...buildProfessionMaterials(),
  ...buildReworkPillHerbs(),
].map(attachSharedProfessionResourceIcon)
