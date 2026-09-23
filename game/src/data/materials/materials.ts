import type { Material } from '@/core/material/Material'
import { SPIRIT_STONE_MATERIALS } from '@/core/material/SpiritStoneMaterial'
import type { ProfessionMaterialMeta } from '@/core/profession/ProfessionMaterial'
import {
  buildProfessionMaterialId,
  herbBaseId,
  herbMaterialId,
} from '@/core/profession/ProfessionMaterial'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import { REALM_TIERS } from '@/core/realm/RealmTierMap'
import { REALMS } from '@/data/realms/realm'
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
    description: 'Tinh hoa ngưng tụ từ thể phách phàm thú, dùng để rèn luyện 6 tầng thân thể.',
  },

  {
    id: LUYEN_KHI_TINH_HOA_ID,
    name: 'Luyện Khí Tinh Hoa',
    category: 'essence',
    sourceType: 'building',
    description: 'Tinh hoa thu được từ phân giải trang bị, dùng cho các thao tác luyện khí.',
    // Currency-like sink/source shared by every grade. Match Linh Thach's
    // effectively unbounded safe-integer convention so normal progression
    // cannot hit the former reachable 9,999 cap.
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
    description: 'Đan hạch ngưng tụ trong thân Hung Giao Xà — nguyên liệu chính luyện Thông Mạch Đan.',
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

/** Nhan realm (Pham Nhan..Do Kiep) - ten material ghep nhan tuoi + realm. */
const REALM_LABEL_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(
  REALMS.map((realm) => [realm.id, realm.name]),
)

function buildProfessionMaterials(): Material[] {
  const list: Material[] = []

  // gp123 6E (task C2): truc tuoi thong nhat 5 bac cho thao/go/khoang -
  // id `<realm>_wood_<age>` / `<realm>_ore_<age>`, plain wood XOA han.
  // Ten hien thi = "<Tuoi> Linh Moc/Khoang <Realm>" (du info khi tim kiem).
  const ages = ['decade', 'century', 'millennium', 'myriad_year', 'thuong_co'] as const

  // ---- Lam: go 9 realm x 5 tuoi ----
  // Cac tier Kim Dan+ la data placeholder de building level 4-9 co cost
  // hop le trong registry.
  for (const realmId of REALM_TIERS) {
    for (const age of ages) {
      list.push({
        id: buildProfessionMaterialId('wood', realmId, age),
        name: `${MATERIAL_AGE_LABELS[age]} Linh Mộc ${REALM_LABEL_BY_ID[realmId] ?? realmId}`,
        category: 'wood',
        element: 'wood',
        sourceType: 'exploration',
        years: HERB_AGE_YEARS[age],
        description: 'Linh mộc phân phẩm dùng cho xây dựng động phủ.',
        profession: { resourceKind: 'wood', realmId, age },
      })
    }
  }

  // ---- Quang: khoang 9 realm x 5 tuoi ----
  for (const realmId of REALM_TIERS) {
    for (const age of ages) {
      list.push({
        id: buildProfessionMaterialId('ore', realmId, age),
        name: `${MATERIAL_AGE_LABELS[age]} Linh Khoáng ${REALM_LABEL_BY_ID[realmId] ?? realmId}`,
        category: 'ore',
        element: 'metal',
        sourceType: 'exploration',
        years: HERB_AGE_YEARS[age],
        description: 'Linh khoáng phân phẩm dùng cho luyện khí và xây dựng.',
        profession: { resourceKind: 'ore', realmId, age },
      })
    }
  }

  return list
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
    description: 'Tinh hoa ngưng tụ từ thể phách bảo thú, dùng để rèn luyện thân thể cấp Bảo.',
  },
  {
    id: 'tinh_hoa_phap_the',
    name: 'Tinh Hoa Pháp Thể',
    category: 'essence',
    sourceType: 'monster',
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
