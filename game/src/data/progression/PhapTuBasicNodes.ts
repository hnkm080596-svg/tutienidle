import type { ElementType } from '../../core/element/ElementType'
import type { StatType } from '../../core/stats/StatTypes'
import type {
  NodePrerequisite,
  ProgressionNode,
} from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { PHAP_TU_ELEMENT_ROOT_IDS } from './PhapTuNodes.builders'
import { SPELL_KIT_IDS } from '../skill/Skills'

// 2026-09-25 three-path content design (design doc sec.1.2a, user rulings
// #1-#8) -- the BASIC-skill lane per element. Distinct from the existing
// special/ult/route lanes: every node here powers the element's SKILL
// kit (skill stat keys: skillDamagePercent /
// elementApplicationPercent / ailmentPotencyPercent / ailmentDurationPercent
// / criticalRate / criticalDamage / finalDamagePercent -- the last is a
// broader all-hits multiplier reserved for the earth capstone, which
// honestly discloses that scope; never character stats like
// might/hp/armor). Stat scope is the spell domain: modifiers only
// exist for a spell-path player, and inside the beta window (LQ/TC)
// the basic is the only reachable spell skill, so the nodes' in-window
// effect is exactly the basic lane; post-Kim-Dan spells share the same
// element stats -- a per-skillId stat channel is future engine work,
// not beta scope. Every node is leveled, and
// a maxed node adds at most +10% of the skill's authored base in ONE
// direction (power nodes: 5 levels x 2%, or 4 levels x 2.5%; apply-chance
// nodes: +10% RELATIVE to the basic's base ailmentChance -- the engine
// consumes elementApplicationPercent multiplicatively as x(1+pool), so
// base 0.5 needs pool 0.10 -> 0.02/level, landing the roll at 0.55).
//
// Gating contract (ruling #8): the REALM decides which ring opens --
// trunk nodes require only the element root (open at Luyen Khi), the
// outer ring + The lanes + capstones require realm 'foundation_establishment'
// (The economy awakens at Truc Co per ruling #5 / breakthrough reward);
// the MINOR tier inside a realm decides the level CAP via levelGates
// (techniqueRank = the minor-tier progression inside a realm cycle).
// Capstones are a 2-way variance split (ruling #7): two opposing
// selectsSpecialization nodes gating each other through excludesNode.
//
// Kim Dan+ content keeps the honesty treatment (existing realm prereq
// renders locked + inspector shows the realm name -- ruling #16 option C).



/** Per-capstone pair: specialization ids authored on the basic Skill def. */
const CAPSTONE_PAIR: Record<ElementType, [string, string]> = {
  fire: ['hoa_tu_diem', 'hoa_tan_diem'],
  water: ['thuy_ngan_lien', 'thuy_dao_lan'],
  wood: ['moc_tu_doc', 'moc_lan_doc'],
  metal: ['kim_tu_phong', 'kim_tan_phong'],
  earth: ['tho_tu_nhan', 'tho_bang_loa'],
}

const FOUNDATION: NodePrerequisite = { kind: 'realm', realmId: 'foundation_establishment' }

/**
 * Minor-tier level gates (ruling #8: "bac nho hon quy dinh duoc cong den
 * level may"): techniqueRank is the in-realm minor tier, so each cap
 * rides on the live technique rank of the player's current cycle.
 */
const MINOR_TIER_GATES: ProgressionNode['levelGates'] = [
  { atLevel: 3, prerequisite: { kind: 'techniqueRank', rank: 2 } },
  { atLevel: 4, prerequisite: { kind: 'techniqueRank', rank: 3 } },
  { atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } },
]

/** Same ramp truncated for maxLevel-4 nodes (atLevel must be <= maxLevel). */
const MINOR_TIER_GATES_4: ProgressionNode['levelGates'] = [
  { atLevel: 3, prerequisite: { kind: 'techniqueRank', rank: 2 } },
  { atLevel: 4, prerequisite: { kind: 'techniqueRank', rank: 3 } },
]

function stat(nodeId: string, statKey: StatType, perLevelFlat: number): StatModifier {
  return {
    id: `${nodeId}_${statKey}`,
    sourceId: 'spell',
    sourceType: 'realm',
    stat: statKey,
    flat: perLevelFlat,
    perLevelFlat,
    domain: 'spell',
  }
}

function powerNode(
  id: string,
  name: string,
  description: string,
  element: ElementType,
  modifiers: StatModifier[],
  options: { foundation?: boolean; maxLevel?: number } = {},
): ProgressionNode {
  const prerequisites: NodePrerequisite[] = [
    { kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] },
    ...(options.foundation ? [FOUNDATION] : []),
  ]

  return {
    id,
    name,
    description,
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: options.maxLevel ?? 5,
    upgradeCost: { base: 1, perLevel: 2 },
    levelGates: options.maxLevel === 4 ? MINOR_TIER_GATES_4 : MINOR_TIER_GATES,
    prerequisites,
    elementTag: element,
    effect: { statModifiers: modifiers },
  }
}

function capstone(
  element: ElementType,
  specializationId: string,
  name: string,
  description: string,
): ProgressionNode {
  const [a, b] = CAPSTONE_PAIR[element]
  const other = specializationId === a ? b : a

  return {
    id: `${element}_basic_${specializationId}`,
    name,
    description,
    type: 'minor',
    role: 'keystone',
    insightCost: 3,
    maxLevel: 1,
    prerequisites: [
      { kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS[element] },
      FOUNDATION,
      { kind: 'excludesNode', nodeId: `${element}_basic_${other}` },
    ],
    elementTag: element,
    effect: {
      selectsSpecialization: { skillId: SPELL_KIT_IDS[element][0], specializationId },
    },
  }
}

function buildFire(): ProgressionNode[] {
  return [
    powerNode(
      'hoa_sac_nhiet',
      'Sắc Nhiệt',
      '+2% sát thương Hỏa Cầu mỗi cấp (tối đa +10%).',
      'fire',
      [stat('hoa_sac_nhiet', 'skillDamagePercent', 0.02)],
    ),
    powerNode(
      'hoa_diem_chuan',
      'Diễm Chuẩn',
      '+2% tỉ lệ gây Thiêu Đốt mỗi cấp (tối đa +10% so với gốc).',
      'fire',
      [stat('hoa_diem_chuan', 'elementApplicationPercent', 0.02)],
    ),
    powerNode(
      'hoa_an_sau',
      'Hỏa Ấn Sâu',
      '+2% uy lực Thiêu Đốt mỗi cấp.',
      'fire',
      [stat('hoa_an_sau', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'hoa_nhiet_keo',
      'Nhiệt Kéo',
      '+2.5% thời gian Thiêu Đốt mỗi cấp.',
      'fire',
      [stat('hoa_nhiet_keo', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4 },
    ),
    powerNode(
      'hoa_sac_huyet',
      'Sắc Huyết',
      '+2.5% sát thương Hỏa Cầu mỗi cấp (tầng Trúc Cơ).',
      'fire',
      [stat('hoa_sac_huyet', 'skillDamagePercent', 0.025)],
      { foundation: true, maxLevel: 4 },
    ),
    capstone(
      'fire',
      'hoa_tu_diem',
      'Tụ Diễm',
      'Hỏa Cầu tụ một điểm — sát thương cao hơn, Thiêu Đốt dễ trúng.',
    ),
    capstone(
      'fire',
      'hoa_tan_diem',
      'Tán Diễm',
      'Hỏa Cầu tán thành vùng — quét nhiều mục tiêu, Thiêu Đốt nhẹ hơn.',
    ),
  ]
}

function buildWater(): ProgressionNode[] {
  return [
    powerNode(
      'thuy_xuyen_lan',
      'Xuyên Lãn',
      '+2% sát thương Thủy Tiễn mỗi cấp (tối đa +10%).',
      'water',
      [stat('thuy_xuyen_lan', 'skillDamagePercent', 0.02)],
    ),
    powerNode(
      'thuy_diem_chuan',
      'Lưu Chuẩn',
      '+2% tỉ lệ gây Tê Cóng mỗi cấp (tối đa +10% so với gốc).',
      'water',
      [stat('thuy_diem_chuan', 'elementApplicationPercent', 0.02)],
    ),
    powerNode(
      'thuy_te_dam',
      'Tê Đẫm',
      '+2% uy lực Tê Cóng mỗi cấp.',
      'water',
      [stat('thuy_te_dam', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'thuy_nhiet_tri',
      'Nhiễm Trì',
      '+2.5% thời gian Tê Cóng mỗi cấp.',
      'water',
      [stat('thuy_nhiet_tri', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4 },
    ),
    capstone(
      'water',
      'thuy_ngan_lien',
      'Ngưng Liễn',
      'Thủy Tiễn ngưng một điểm — sát thương cao hơn, Tê Cóng dễ trúng.',
    ),
    capstone(
      'water',
      'thuy_dao_lan',
      'Đào Lan',
      'Thủy Tiễn vỡ thành làn sóng — quét nhiều mục tiêu.',
    ),
  ]
}

function buildWood(): ProgressionNode[] {
  // Doc Chuong deals no direct damage -- the basic lane deepens the poison
  // instead of touching skillDamagePercent (asymmetric roster per ruling #2).
  return [
    powerNode(
      'moc_doc_sau',
      'Độc Sâu',
      '+2% uy lực Trúng Độc mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_sau', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'moc_doc_dien',
      'Độc Diễn',
      '+2% thời gian Trúng Độc mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_dien', 'ailmentDurationPercent', 0.02)],
    ),
    powerNode(
      'moc_doc_tham',
      'Độc Thấm',
      '+2.5% uy lực Trúng Độc mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_tham', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4 },
    ),
    capstone(
      'wood',
      'moc_tu_doc',
      'Tụ Độc',
      'Độc Chưởng tụ một điểm — đắp thêm 1 tầng Trúng Độc khi trúng.',
    ),
    capstone(
      'wood',
      'moc_lan_doc',
      'Lan Độc',
      'Độc Chưởng lan thành vùng — Trúng Độc phủ nhiều mục tiêu.',
    ),
  ]
}

function buildMetal(): ProgressionNode[] {
  return [
    powerNode(
      'kim_sac_ben',
      'Sắc Bén',
      '+2% sát thương Điểm Kim mỗi cấp (tối đa +10%).',
      'metal',
      [stat('kim_sac_ben', 'skillDamagePercent', 0.02)],
    ),
    powerNode(
      'kim_diem_chuan',
      'Điểm Chuẩn',
      '+2% tỉ lệ gây Xuất Huyết mỗi cấp (tối đa +10% so với gốc).',
      'metal',
      [stat('kim_diem_chuan', 'elementApplicationPercent', 0.02)],
    ),
    powerNode(
      'kim_xuyen_nhuy',
      'Xuyên Nhuyễn',
      '+2% tỉ lệ bạo kích mỗi cấp (tối đa +10%).',
      'metal',
      [stat('kim_xuyen_nhuy', 'criticalRate', 0.02)],
    ),
    powerNode(
      'kim_bao_the',
      'Bạo Thể',
      '+2.5% sát thương bạo kích mỗi cấp (tầng Trúc Cơ).',
      'metal',
      [stat('kim_bao_the', 'criticalDamage', 0.025)],
      { foundation: true, maxLevel: 4 },
    ),
    capstone(
      'metal',
      'kim_tu_phong',
      'Tụ Phong',
      'Điểm Kim tụ một điểm — sát thương lớn hơn.',
    ),
    capstone(
      'metal',
      'kim_tan_phong',
      'Tán Phong',
      'Điểm Kim tán thành mũi lưỡi — quét nhiều mục tiêu.',
    ),
  ]
}

function buildEarth(): ProgressionNode[] {
  return [
    powerNode(
      'tho_tram_luy',
      'Trầm Lũy',
      '+2% sát thương Thổ Cầu mỗi cấp (tối đa +10%).',
      'earth',
      [stat('tho_tram_luy', 'skillDamagePercent', 0.02)],
    ),
    powerNode(
      'tho_tran_sau',
      'Trần Sâu',
      '+2% thời gian Thạch Hóa mỗi cấp (tối đa +10%).',
      'earth',
      [stat('tho_tran_sau', 'ailmentDurationPercent', 0.02)],
    ),
    powerNode(
      'tho_cung_gioi',
      'Củng Giới',
      '+2% sát thương Thổ Cầu mỗi cấp (tầng Trúc Cơ).',
      'earth',
      [stat('tho_cung_gioi', 'skillDamagePercent', 0.02)],
      { foundation: true },
    ),
    powerNode(
      'tho_linh_the',
      'Lĩnh Thể',
      '+2.5% sát thương Thổ Cầu mỗi cấp (tầng Trúc Cơ).',
      'earth',
      [stat('tho_linh_the', 'skillDamagePercent', 0.025)],
      { foundation: true, maxLevel: 4 },
    ),
    capstone(
      'earth',
      'tho_tu_nhan',
      'Tụ Nhán',
      'Thổ Cầu nén một điểm — sát thương cao hơn.',
    ),
    capstone(
      'earth',
      'tho_bang_loa',
      'Đá Loạn',
      'Thổ Cầu vỡ thành mảnh đá — quét nhiều mục tiêu.',
    ),
  ]
}

/** Basic-skill lane for one element (asymmetric rosters per ruling #2). */
export function buildBasicBranch(element: ElementType): ProgressionNode[] {
  switch (element) {
    case 'fire':
      return buildFire()
    case 'water':
      return buildWater()
    case 'wood':
      return buildWood()
    case 'metal':
      return buildMetal()
    case 'earth':
      return buildEarth()
  }
}
