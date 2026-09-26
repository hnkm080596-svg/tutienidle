import type { ElementType } from '../../core/element/ElementType'
import type { StatType } from '../../core/stats/StatTypes'
import type {
  NodePrerequisite,
  ProgressionNode,
} from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { SPELL_KIT_IDS } from '../skill/Skills'
import { ELEMENT_LABELS } from '../../core/element/ElementLabels'

// Phap Tu Reimagine (2026-09-26 spec sec.1.4) — the branch is trimmed to
// skill-owned mechanics only: element root (unlocks the basic), the
// ailment mastery growth (ailment = the basic's own channel, ruling
// F14), and the realm-gated linh_ngo_<special> unlock (grants the Phap
// Trang special + the Linh Luc Ho The cap). Retired with the old design:
// minor_<el>_intensity / <el>_damage_mastery generic-stat growths,
// tu_the/truong_the The lanes, all routeTag'd dot/no specializations,
// and linh_ngo_<godUlt> (no ultimate slot in the new kit).

/** Goc hanh — id giu nguyen tu cay cu de presentation/da ton tai giu ten. */
export const PHAP_TU_ELEMENT_ROOT_IDS: Record<ElementType, string> = {
  fire: 'hoa_linh_ngo',
  water: 'thuy_linh_ngo',
  wood: 'moc_linh_ngo',
  metal: 'kim_linh_ngo',
  earth: 'tho_linh_ngo',
}

/** Linh Luc Ho The cap granted by linh_ngo_<special> (spec D9; TBD). */
export const LINH_NGO_HO_THE_CAP = 0.25

function stat(
  nodeId: string,
  statKey: StatType,
  flat: number,
  perLevelFlat = 0,
): StatModifier {
  return {
    id: `${nodeId}_${statKey}`,
    sourceId: 'spell',
    sourceType: 'realm',
    stat: statKey,
    flat,
    perLevelFlat,
    domain: 'spell',
  }
}

function elementRoot(element: ElementType): ProgressionNode {
  const rootId = PHAP_TU_ELEMENT_ROOT_IDS[element]
  const excludes: NodePrerequisite[] = (
    Object.keys(PHAP_TU_ELEMENT_ROOT_IDS) as ElementType[]
  )
    .filter((other) => other !== element)
    .map((other) => ({ kind: 'excludesNode', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[other] }))

  return {
    id: rootId,
    name: `${ELEMENT_LABELS[element]} Linh Ngộ`,
    description: `Mở hành ${ELEMENT_LABELS[element]} — chọn nguyên tố Pháp Tu (nguyên tử, qua selectSpellPathElement).`,
    type: 'major',
    role: 'root',
    insightCost: 0,
    prerequisites: excludes,
    elementTag: element,
    effect: { unlocksSkillIds: [SPELL_KIT_IDS[element][0]] },
  }
}

function growth(
  id: string,
  name: string,
  description: string,
  element: ElementType,
  modifiers: StatModifier[],
): ProgressionNode {
  return {
    id,
    name,
    description,
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [
      { kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] },
    ],
    elementTag: element,
    effect: { statModifiers: modifiers },
  }
}

export function buildElementBranch(element: ElementType): ProgressionNode[] {
  const specialId = SPELL_KIT_IDS[element][1]
  const label = ELEMENT_LABELS[element]

  return [
    elementRoot(element),

    // Ailment mastery growth (kept -- ailment channels are skill-owned:
    // the element basic is the path's only own-source ailment producer,
    // ruling F14).
    growth(
      `${element}_ailment_mastery`,
      `${label} Chưởng`,
      `+4% uy lực tật trạng, +3% thời gian tật trạng ${label}/cấp.`,
      element,
      [
        stat(`${element}_ailment_mastery_pot`, 'ailmentPotencyPercent', 0.04, 0.04),
        stat(`${element}_ailment_mastery_dur`, 'ailmentDurationPercent', 0.03, 0.03),
      ],
    ),

    // Special unlock (spec sec.1.4) — realm gate Truc Co
    // (foundation_establishment): grants the Phap Trang special and the
    // Linh Luc Ho The damage-reduction cap in one purchase. No god-ult
    // node follows it; the kit ends at the special.
    {
      id: `linh_ngo_${specialId}`,
      name: `Linh Ngộ ${label} Đặc Biệt`,
      description: `Mở khóa ${label} đặc biệt — Pháp Trạng ${label} và Linh Lực Hộ Thể.`,
      type: 'major',
      role: 'keystone',
      insightCost: 2,
      prerequisites: [
        { kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] },
        { kind: 'realm', realmId: 'foundation_establishment' },
      ],
      elementTag: element,
      effect: {
        unlocksSkillIds: [specialId],
        statModifiers: [
          stat(`linh_ngo_${specialId}`, 'linhLucHoTheCap', LINH_NGO_HO_THE_CAP),
        ],
      },
    },
  ]
}
