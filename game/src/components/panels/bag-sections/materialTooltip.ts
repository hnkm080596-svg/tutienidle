// Shared builder for the material item-info card (extracted from
// MaterialBagSection.vue's buildTooltip): the bag passes `owned`,
// drop previews (exploration reward cells) pass `extraRows` for drop
// amount/chance rows instead. Label maps are built once per factory.
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/core/profession/slotRank'
import type { Material, MaterialCategory } from '@/core/material/Material'
import type { GradedItemTooltipContent, TooltipStatRow } from '@/composables/useTooltip'

type Translate = (key: string, named?: Record<string, unknown>) => string

// Realm ids share this key map between the tooltip builder and
// materialRealmLabel (bag cell aria override, spec section 5b).
const REALM_LABEL_KEYS: Record<string, string> = {
  mortal: 'panels.bag.tooltip.realms.mortal',
  qi_refining: 'panels.bag.tooltip.realms.qiRefining',
  foundation_establishment: 'panels.bag.tooltip.realms.foundationEstablishment',
  golden_core: 'panels.bag.tooltip.realms.goldenCore',
  nascent_soul: 'panels.bag.tooltip.realms.nascentSoul',
  soul_transformation: 'panels.bag.tooltip.realms.soulTransformation',
  void_refinement: 'panels.bag.tooltip.realms.voidRefinement',
  body_integration: 'panels.bag.tooltip.realms.bodyIntegration',
  mahayana: 'panels.bag.tooltip.realms.mahayana',
  tribulation: 'panels.bag.tooltip.realms.tribulation',
}

export function materialRealmLabel(realmId: string | undefined, t: Translate): string | undefined {
  const key = realmId ? REALM_LABEL_KEYS[realmId] : undefined

  return key ? t(key) : undefined
}

export interface MaterialTooltipOptions {
  // "So huu: N" - renders only when > 0 (spec: never a zero count).
  owned?: number
  // Extra rows appended to the info section (e.g. drop amount/chance).
  extraRows?: TooltipStatRow[]
}

// Mau theo pham nghe canh gioi (spec 2026-08-30-unify-material-quality-
// names-design.md): nhin TEN biet tuoi/chat, nhin MAU (ten + khung) biet
// realm. Material khong co profession meta (linh thach, legacy...) khong
// to - undefined = mau mac dinh.
export function professionRankOfMaterial(material: Material): number | undefined {
  const realmId = material.profession?.realmId

  if (!realmId) {
    return undefined
  }

  const grade = getProfessionGradeForRealm(realmId)

  return grade ? professionGradeRank(grade) : undefined
}

export function createMaterialTooltipBuilder(t: Translate) {
  const AGE_LABELS: Record<string, string> = {
    decade: t('panels.bag.tooltip.ages.decade'),
    century: t('panels.bag.tooltip.ages.century'),
    millennium: t('panels.bag.tooltip.ages.millennium'),
    myriad_year: t('panels.bag.tooltip.ages.myriadYear'),
    thuong_co: t('panels.bag.tooltip.ages.thuongCo'),
  }

  const SOURCE_LABELS: Record<Material['sourceType'], string> = {
    boss: t('panels.bag.tooltip.sourceTypes.boss'),
    monster: t('panels.bag.tooltip.sourceTypes.monster'),
    building: t('panels.bag.tooltip.sourceTypes.building'),
    exploration: t('panels.bag.tooltip.sourceTypes.exploration'),
  }

  const CATEGORY_LABELS: Record<MaterialCategory, string> = {
    herb: t('panels.bag.tooltip.categories.herb'),
    wood: t('panels.bag.tooltip.categories.wood'),
    ore: t('panels.bag.tooltip.categories.ore'),
    monster_core: t('panels.bag.tooltip.categories.monsterCore'),
    spirit_stone: SPIRIT_STONE_LABEL,
    essence: t('panels.bag.tooltip.categories.essence'),
    byproduct: t('panels.bag.tooltip.categories.byproduct'),
    other: t('panels.bag.tooltip.categories.other'),
  }

  // Nhan canh gioi cho tooltip - nguoi choi khong phan biet duoc mau
  // (color-blind) van doc duoc realm tren tooltip (spec sec"Canh gioi").
  return function buildMaterialTooltip(
    material: Material,
    options: MaterialTooltipOptions = {},
  ): GradedItemTooltipContent {
    const realmId = material.profession?.realmId
    const realmText = materialRealmLabel(realmId, t)
    const rank = professionRankOfMaterial(material)

    const rows: TooltipStatRow[] = [
      { label: t('panels.bag.tooltip.category'), value: CATEGORY_LABELS[material.category] },
      { label: t('panels.bag.tooltip.source'), value: SOURCE_LABELS[material.sourceType] },
      // Realm text IS the material's Pham axis - carry its rank color
      // (user ruling: every Pham/Chat text shows in its set color).
      ...(realmText ? [{ label: t('panels.bag.tooltip.realm'), value: realmText, colorVar: rank !== undefined ? `--rank-color-${rank}` : undefined }] : []),
    ]

    if (material.profession?.age) {
      rows.push({
        label: t('panels.bag.tooltip.age'),
        value: AGE_LABELS[material.profession.age] ?? t('panels.bag.tooltip.yearsSuffix', { count: material.years ?? 0 }),
      })
    } else if (material.years !== undefined) {
      rows.push({ label: t('panels.bag.tooltip.age'), value: t('panels.bag.tooltip.yearsSuffix', { count: material.years }) })
    }
    if (material.element !== undefined)
      rows.push({ label: t('panels.bag.tooltip.element'), value: ELEMENT_LABELS[material.element] })

    const owned = options.owned ?? 0

    return {
      kind: 'material',
      name: material.name,

      // Single title color = the material's Pham rank color (spec
      // section 2) - materials have no Chat axis so the Pham ramp is the
      // name color.
      nameColorVar: rank !== undefined ? `--rank-color-${rank}` : undefined,

      // Static SlotView header (spec section 3): same signals the bag
      // cell binds - Pham seal via the 10-step rarity scale, realm in
      // aria.
      slotPreview: {
        icon: material.icon,
        label: material.name,
        accessibleLabel: realmText ? `${material.name}, ${realmText}` : material.name,
        rarityRank: rank,
        rarityRankScale: 10,
      },

      imagePath: material.icon,
      // Pham rank (10-step ramp) - feeds the tooltip aura color;
      // materials have no Chat axis so gradeKey stays unset (2026-09-14
      // ruling).
      gradeRank: rank,
      // Spec: "So huu: N" renders only when the player owns at least one
      // - never emit a zero count.
      ownedCount: owned > 0 ? owned : undefined,
      description: material.description,
      sections: [{ label: t('panels.bag.tooltip.section'), rows: [...rows, ...(options.extraRows ?? [])] }],
    }
  }
}
