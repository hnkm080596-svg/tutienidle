import type { Material } from '@/core/material/Material'
import { SPIRIT_STONE_MATERIALS } from '@/core/material/SpiritStoneMaterial'
import type { ProfessionMaterialMeta } from '@/core/profession/ProfessionMaterial'
import {
  buildProfessionMaterialId,
  herbBaseId,
  herbMaterialId,
} from '@/core/profession/ProfessionMaterial'
import {
  BUI_GO_ID,
  LUYEN_DAN_TINH_HOA_ID,
  LUYEN_KHI_TINH_HOA_ID,
} from '@/core/equipment/TinhHoaMaterial'
import { REALM_TIERS } from '@/core/realm/RealmTierMap'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'
import type { HerbAge } from '@/core/production/ProductionTypes'
import { ARTIFACT_UNLOCK_REALM_ID } from '@/core/artifact/ArtifactDomain'

// sourceType (MASTER SPEC Muc II-V) - nhan nguon CHINH, khong rang
// buoc cung. Nhom nguyen lieu tu nhien age-tiered (Linh Thao/Linh Moc/
// Linh Thiet) la nguon thu chinh; currency dac thu giu NGUYEN - khong
// thuoc pham vi don gian hoa "nguyen lieu tu nhien" cua tai lieu.
const legacyMaterials: Material[] = [
  // Realm Passive & Pressure System (2026-08-20) - currency Luyen The,
  // CHI roi tu 20 quai Pham Nhan (data/enemy/Enemies.ts), dau tu qua
  // realmAdvanceOps.investBodyChapter() de lap day 6 tang (xem
  // data/realm/BodyRefinement.ts/core/realm/body/). id khop
  // TINH_HOA_PHAM_THE_MATERIAL_ID.
  {
    id: 'tinh_hoa_pham_the',
    name: 'Tinh Hoa Phàm Thể',
    category: 'essence',
    sourceType: 'monster',
    icon: '/assets/materials/tinh_hoa_pham_the.png',
    description: 'Tinh hoa ngưng tụ từ thể phách phàm thú, dùng để rèn luyện 6 tầng thân thể.',
  },

  {
    id: LUYEN_KHI_TINH_HOA_ID,
    name: 'Luyện Khí Tinh Hoa',
    category: 'essence',
    sourceType: 'building',
    icon: '/assets/materials/luyen_khi_tinh_hoa.png',
    description: 'Tinh hoa thu được từ phân giải trang bị, dùng cho các thao tác luyện khí.',
    // Currency-like sink/source shared by every grade. Match Linh Thach's
    // effectively unbounded safe-integer convention so normal progression
    // cannot hit the former reachable 9,999 cap.
    stackLimit: Number.MAX_SAFE_INTEGER,
  },

  // Materials economy rework (2026-10-11) - outputs of the 3-family
  // decompose tab: wood stacks -> Bui Go, grotto herbs -> Luyen Dan
  // Tinh Hoa. Same essence/building/unbounded-stack shape as Luyen Khi
  // Tinh Hoa.
  {
    id: BUI_GO_ID,
    name: 'Bụi Gỗ',
    category: 'essence',
    sourceType: 'building',
    icon: '/assets/materials/bui_go.png',
    description: 'Bụi gỗ thu được từ phân giải linh mộc, dùng làm nhiên liệu lò đan và rèn luyện trang bị.',
    stackLimit: Number.MAX_SAFE_INTEGER,
  },

  {
    id: LUYEN_DAN_TINH_HOA_ID,
    name: 'Luyện Đan Tinh Hoa',
    category: 'essence',
    sourceType: 'building',
    icon: '/assets/materials/luyen_dan_tinh_hoa.png',
    description: 'Tinh hoa thu được từ phân giải linh thảo, bắt buộc cho mọi mẻ luyện đan.',
    stackLimit: Number.MAX_SAFE_INTEGER,
  },

  // 2026-09-23 hidden-perfection-lineage sec.19 - great_dao_seed retired:
  // Dai Dao belongs to the lineage channel (hidden breakthrough), never
  // to a material the old resolver could read.

  // Doan Bao Thach + spec dot-pha-loi-kiep sec.4.1b - Yeu Dan (boss Luyen
  // Khi tang 10, nguyen lieu chinh Thong Mach Dan/Truc Co Dan).
  // 2026-09-23: Thien Dia Chi Kieu retired with the 9th meridian.
  {
    id: 'yeu_dan_hung_giao',
    name: 'Yêu Đan',
    category: 'other',
    sourceType: 'boss',
    icon: '/assets/materials/yeu_dan_hung_giao.png',
    description: 'Đan hạch ngưng tụ trong thân Hung Giao Xà — nguyên liệu chính luyện Trúc Cơ Đan.',
    stackLimit: 100,
  },
  // Companion gacha (2026-09-12, companion-gacha plan Task 6) - pull
  // token for Chieu Hien Quan. Sources (Tru Co+ only, P7-M9/D4):
  // foundation floor-10 boss signatureDrops x3 (requiresModifier 'boss',
  // see FoundationEnemies.ts) + daily_chieu_hien_lenh quest
  // (realm-gated). Sink: GameManagerCompanionOps.pullCompanion() spends
  // 1 per pull.
  {
    id: 'chieu_hien_lenh',
    name: 'Chiêu Hiền Lệnh',
    category: 'other',
    sourceType: 'boss',
    icon: '/assets/materials/chieu_hien_lenh.png',
    description: 'Lệnh bài khắc phù văn chiêu mộ — dùng tại Chiêu Hiền Quán để chiêu mộ đồng đội.',
    stackLimit: 999,
  },

  // ban_menh_phap_bao (2026-08-27, foundation-artifact-system-plan.md
  // sec.6) - grade-upgrading stone, drops from Foundation+ enemies via
  // the weighted path in StageDropTables (no lower table lists it).
  // M-F-ARTIFACT-DEFER: its only live purpose is artifact upgrade, which
  // is deferred to Kim Dan+ - the record is domain-scoped through the
  // SHARED unlock declaration (never a realm literal) so delivery is
  // suppressed by the canonical domain rule until the artifact domain
  // is unlocked for the player. The TC drop-table row stays authored;
  // acquisition resumes for a Kim Dan+ player once the window opens.
  {
    id: 'doan_bao_thach',
    name: 'Đoán Bảo Thạch',
    category: 'other',
    sourceType: 'monster',
    icon: '/assets/materials/doan_bao_thach.png',
    description: 'Đá dị chất kết tinh từ khí tức yêu thú Trúc Cơ trở lên, dùng để nâng phẩm bản mệnh pháp bảo.',
    domainUnlockRealmId: ARTIFACT_UNLOCK_REALM_ID,
  },

  // Dot Pha Truc Co (Phase 6) - loot "vo thuong vo phat" (muc 14 spec
  // `breakthrough`): KHONG stat/effect, KHONG mo quest, KHONG dung
  // crafting - chi tao manh moi qua description, verbatim dung spec,
  // KHONG duoc sua/dien giai them.
  {
    id: 'broken_foundation_scroll',
    name: 'Tàn Quyển Trúc Cơ',
    category: 'other',
    sourceType: 'exploration',
    icon: '/assets/materials/broken_foundation_scroll.png',
    description: 'Chín tầng đã đủ để bước vào con đường của người thường.',
  },

  {
    id: 'old_jade_slip',
    name: 'Ngọc Giản Cũ',
    category: 'other',
    sourceType: 'exploration',
    icon: '/assets/materials/old_jade_slip.png',
    description: 'Có người dừng lại ở tầng thứ chín. Có người không.',
  },

  {
    id: 'cultivator_diary',
    name: 'Nhật Ký Tu Sĩ',
    category: 'other',
    sourceType: 'monster',
    icon: '/assets/materials/cultivator_diary.png',
    description: 'Ta đã vượt qua tầng thứ mười hai.',
  },

  {
    id: 'stele_fragment',
    name: 'Mảnh Bia',
    category: 'other',
    sourceType: 'monster',
    icon: '/assets/materials/stele_fragment.png',
    description: 'Mười hai...',
  },
]

// ============================================================
// NGUYEN LIEU NGHE MOI (2026-08-25, resource-professions-rework plan
// sec.5/sec.6): KHONG con cap raw|processed (plan sec.2). Ba nhom truc tiep:
// - Lam: go `<realm>_wood_<age>` - xay/nang cong trinh + nhien lieu
//   dan lo (gp123 6E C2: plain `<realm>_wood` da bi XOA).
// - Quang: `<realm>_ore_<age>` - sink Khi Duong (Cuong Hoa/Tay Luyen).
// - Dong Thien: moi dan phuong mot thao rieng x 5 nien dai
//   `<herbBase>_<age>` - sink Dan Phong.
// Tat ca sinh bang generator de tranh author tay entry lech chuan;
// ten hien thi dat TRAN o day (khong parse tu id).
// ============================================================

// Nhan "chat" thong nhat theo he TUOI (2026-08-30, spec
// 2026-08-30-unify-material-quality-names-design.md + gp123 6E task C2):
// Go/Khoang dung CUNG truc tuoi voi Linh Thao - id `<realm>_wood_<age>` /
// `<realm>_ore_<age>` (age decade..thuong_co). Bang nay la NGUON SU
// THAT DUY NHAT cua nhan 5 bac tuoi, dung chung cho thao/go/khoang.
// Bang pham cu ORE_QUALITY_LABELS (hoang..tien) da bi xoa cung id pham cu.
export const MATERIAL_AGE_LABELS: Record<HerbAge, string> = {
  decade: 'Thập Niên',
  century: 'Bách Niên',
  millennium: 'Thiên Niên',
  myriad_year: 'Vạn Niên',
  thuong_co: 'Thượng Cổ',
}

const HERB_AGE_YEARS: Record<string, number> = {
  decade: 10,
  century: 100,
  millennium: 1000,
  myriad_year: 10000,
  thuong_co: 100000,
}

function buildProfessionMaterials(): Material[] {
  return (['wood', 'ore'] as const).flatMap(resourceKind =>
    (['decade', 'century', 'millennium', 'myriad_year', 'thuong_co'] as const).map(age => ({
      id: buildProfessionMaterialId(resourceKind, age),
      name: `${MATERIAL_AGE_LABELS[age]} ${resourceKind === 'wood' ? 'Linh Mộc' : 'Linh Khoáng'}`,
      category: resourceKind,
      icon: resourceKind === 'wood' ? '/assets/materials/linh_moc.png' : '/assets/materials/linh_khoang.png',
      element: resourceKind === 'wood' ? 'wood' as const : 'metal' as const,
      sourceType: 'exploration' as const,
      years: HERB_AGE_YEARS[age],
      description: resourceKind === 'wood'
        ? 'Linh mộc tích tụ linh khí theo niên đại, dùng xây dựng và hóa luyện.'
        : 'Linh khoáng tích tụ linh khí theo niên đại, dùng xây dựng và luyện khí.',
      profession: { resourceKind, age },
    })),
  )
}

function buildReworkPillHerbs(): Material[] {
  // gp123 6E (task C1): truc tuoi 5 bac - thuong_co mo bac "Thuong Co".
  const ages = ['decade', 'century', 'millennium', 'myriad_year', 'thuong_co'] as const

  // Nhan tuoi thao - dung chung MATERIAL_AGE_LABELS (gp123 6E C2: bang
  // nhan 5 bac duy nhat cho thao/go/khoang).
  const HERB_AGE_LABELS = MATERIAL_AGE_LABELS

  return REALM_TIERS.flatMap((realmId) =>
    PILL_FAMILIES.flatMap((family) => {
      const baseId = herbBaseId(family.herbId, realmId)

      return ages.map((age) => ({
        id: herbMaterialId(baseId, age),
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
          herbBaseId: baseId,
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

// M-QI-08 - physique-essence family members above pham (the pham entry
// stays in legacyMaterials with its original id). No live drop source
// yet - M-QI-10 wires the band entries authored in
// PHYSIQUE_ESSENCE_BAND_DROPS.
const physiqueEssenceMaterials: Material[] = [
  {
    id: 'tinh_hoa_bao_the',
    name: 'Tinh Hoa Bảo Thể',
    category: 'essence',
    sourceType: 'monster',
    icon: '/assets/materials/tinh_hoa_bao_the.png',
    description: 'Tinh hoa ngưng tụ từ thể phách bảo thú, dùng để rèn luyện thân thể cấp Bảo.',
  },
  {
    id: 'tinh_hoa_phap_the',
    name: 'Tinh Hoa Pháp Thể',
    category: 'essence',
    sourceType: 'monster',
    icon: '/assets/materials/tinh_hoa_phap_the.png',
    description: 'Tinh hoa ngưng tụ từ thể phách pháp thú, dùng để rèn luyện thân thể cấp Pháp.',
  },
]

export const materials: Material[] = [
  // Linh Thach - MATERIAL that (plan Workstream F), tham gia moi sort
  // trong tab Nguyen Lieu nhu material binh thuong; KHONG con currency
  // state tren PlayerData.
  ...SPIRIT_STONE_MATERIALS,

  // Linh thao legacy (Linh Chi/Que/Cuc Hoa/Linh Thao Chung) da bi xoa
  // han khoi legacyMaterials - Dan Phong chi dung 8 ho thao moi ben duoi.
  ...legacyMaterials,

  ...physiqueEssenceMaterials,

  ...buildProfessionMaterials(),
  ...buildReworkPillHerbs(),
].map(attachSharedProfessionResourceIcon)
