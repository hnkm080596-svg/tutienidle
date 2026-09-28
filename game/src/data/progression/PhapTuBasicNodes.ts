import type { ElementType } from '../../core/element/ElementType'
import type { StatType } from '../../core/stats/StatTypes'
import type {
  NodePrerequisite,
  ProgressionNode,
} from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { PHAP_TU_ELEMENT_ROOT_IDS } from './PhapTuNodes.builders'
import { SPELL_KIT_IDS } from '../skill/Skills'

// Phap Tu Reimagine (2026-09-26 spec sec.1.4 + openQuestion 5) -- the
// basic lane keeps ONLY skill-owned channels: the ailment family
// (elementApplicationPercent / ailmentPotencyPercent /
// ailmentDurationPercent -- the element basic is the path's only
// own-source ailment producer, so the global channel IS the skill
// channel, ruling F14) plus the two-way capstone specializations
// (they modify the basic itself). The generic-stat nodes
// (skillDamagePercent / criticalRate / criticalDamage /
// finalDamagePercent) are cut outright; a per-skillId coefficient/
// conversion channel was considered and deferred -- no kept mechanic
// needs it.
//
// Gating contract is unchanged: trunk nodes require only the element
// root (open at Luyen Khi); the outer ring + capstones also require
// realm 'foundation_establishment'; the MINOR tier inside a realm caps
// levels via levelGates (techniqueRank = the in-realm minor tier).
// Capstones stay a mutex 2-way variance split through excludesNode;
// each hangs off a surviving ailment node of the same element.
//
// Glyph shape: depth-1 trunk / depth-2 ring / depth-3 capstone.


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
  options: { foundation?: boolean; maxLevel?: number; prereqNodeId?: string } = {},
): ProgressionNode {
  const prerequisites: NodePrerequisite[] = [
    { kind: 'node', nodeId: options.prereqNodeId ?? PHAP_TU_ELEMENT_ROOT_IDS[element] },
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
  prereqNodeId: string,
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
      { kind: 'node', nodeId: prereqNodeId },
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
      'hoa_diem_chuan',
      'Diễm Chuẩn',
      '+2% tỉ lệ áp dụng tật trạng mỗi cấp (tối đa +10% so với gốc).',
      'fire',
      [stat('hoa_diem_chuan', 'elementApplicationPercent', 0.02)],
    ),
    powerNode(
      'hoa_an_sau',
      'Hỏa Ấn Sâu',
      '+2% uy lực tật trạng mỗi cấp.',
      'fire',
      [stat('hoa_an_sau', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'hoa_nhiet_keo',
      'Nhiệt Kéo',
      '+2.5% thời gian tật trạng mỗi cấp (tầng Trúc Cơ).',
      'fire',
      [stat('hoa_nhiet_keo', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'hoa_an_sau' },
    ),
    powerNode(
      'hoa_diem_tham',
      'Diễm Thấm',
      '+2.5% tỉ lệ áp dụng tật trạng mỗi cấp (tầng Trúc Cơ).',
      'fire',
      [stat('hoa_diem_tham', 'elementApplicationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'hoa_diem_chuan' },
    ),
    capstone(
      'fire',
      'hoa_tu_diem',
      'Tụ Diễm',
      'Hỏa Cầu tụ một điểm — sát thương cao hơn, Thiêu Đốt dễ trúng.',
      'hoa_nhiet_keo',
    ),
    capstone(
      'fire',
      'hoa_tan_diem',
      'Tán Diễm',
      'Hỏa Cầu tán thành vùng — quét nhiều mục tiêu, đòn nhẹ hơn, Thiêu Đốt khó trúng hơn.',
      'hoa_diem_tham',
    ),
  ]
}

function buildWater(): ProgressionNode[] {
  return [
    powerNode(
      'thuy_diem_chuan',
      'Lưu Chuẩn',
      '+2% tỉ lệ áp dụng tật trạng mỗi cấp (tối đa +10% so với gốc).',
      'water',
      [stat('thuy_diem_chuan', 'elementApplicationPercent', 0.02)],
    ),
    powerNode(
      'thuy_te_dam',
      'Tê Đẫm',
      '+2% uy lực tật trạng mỗi cấp.',
      'water',
      [stat('thuy_te_dam', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'thuy_luu_tich',
      'Lưu Tích',
      '+2% thời gian tật trạng mỗi cấp (tối đa +10%).',
      'water',
      [stat('thuy_luu_tich', 'ailmentDurationPercent', 0.02)],
    ),
    powerNode(
      'thuy_nhiet_tri',
      'Nhiễm Trì',
      '+2.5% thời gian tật trạng mỗi cấp (tầng Trúc Cơ).',
      'water',
      [stat('thuy_nhiet_tri', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'thuy_luu_tich' },
    ),
    powerNode(
      'thuy_te_tham',
      'Tê Thấm',
      '+2.5% uy lực tật trạng mỗi cấp (tầng Trúc Cơ).',
      'water',
      [stat('thuy_te_tham', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'thuy_te_dam' },
    ),
    capstone(
      'water',
      'thuy_ngan_lien',
      'Ngưng Liễn',
      'Thủy Tiễn ngưng một điểm — sát thương cao hơn, Tê Cóng dễ trúng.',
      'thuy_te_tham',
    ),
    capstone(
      'water',
      'thuy_dao_lan',
      'Đào Lan',
      'Thủy Tiễn vỡ thành làn sóng — quét nhiều mục tiêu, đòn nhẹ hơn, Tê Cóng khó trúng hơn.',
      'thuy_nhiet_tri',
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
      '+2% uy lực tật trạng mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_sau', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'moc_doc_dien',
      'Độc Diễn',
      '+2% thời gian tật trạng mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_dien', 'ailmentDurationPercent', 0.02)],
    ),
    powerNode(
      'moc_doc_tham',
      'Độc Thấm',
      '+2.5% uy lực tật trạng mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_tham', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'moc_doc_sau' },
    ),
    powerNode(
      'moc_doc_man',
      'Độc Mạn',
      '+2.5% thời gian tật trạng mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_man', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'moc_doc_dien' },
    ),
    powerNode(
      'moc_doc_nhuan',
      'Độc Nhuần',
      '+2% thời gian tật trạng mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_nhuan', 'ailmentDurationPercent', 0.02)],
    ),
    powerNode(
      'moc_doc_tu',
      'Độc Tú',
      '+2% uy lực tật trạng mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_tu', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'moc_doc_am',
      'Độc Ám',
      '+2.5% uy lực tật trạng mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_am', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'moc_doc_tu' },
    ),
    powerNode(
      'moc_doc_nhiem',
      'Độc Nhiễm',
      '+2.5% uy lực tật trạng mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_nhiem', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'moc_doc_tu' },
    ),
    capstone(
      'wood',
      'moc_tu_doc',
      'Tụ Độc',
      'Độc Chưởng tụ một điểm — đắp thêm 1 tầng Trúng Độc khi trúng.',
      'moc_doc_tham',
    ),
    capstone(
      'wood',
      'moc_lan_doc',
      'Lan Độc',
      'Độc Chưởng lan thành vùng — phủ nhiều mục tiêu, nhưng Trúng Độc không còn chắc trúng.',
      'moc_doc_nhiem',
    ),
  ]
}

function buildMetal(): ProgressionNode[] {
  return [
    powerNode(
      'kim_diem_chuan',
      'Điểm Chuẩn',
      '+2% tỉ lệ áp dụng tật trạng mỗi cấp (tối đa +10% so với gốc).',
      'metal',
      [stat('kim_diem_chuan', 'elementApplicationPercent', 0.02)],
    ),
    powerNode(
      'kim_liet_huyet',
      'Liệt Huyết',
      '+2% uy lực tật trạng mỗi cấp (tối đa +10%).',
      'metal',
      [stat('kim_liet_huyet', 'ailmentPotencyPercent', 0.02)],
    ),
    powerNode(
      'kim_diem_tham',
      'Điểm Thấm',
      '+2.5% tỉ lệ áp dụng tật trạng mỗi cấp (tầng Trúc Cơ).',
      'metal',
      [stat('kim_diem_tham', 'elementApplicationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'kim_diem_chuan' },
    ),
    capstone(
      'metal',
      'kim_tu_phong',
      'Tụ Phong',
      'Điểm Kim tụ một điểm — đòn đánh đậm hơn, Xuất Huyết dễ trúng hơn.',
      'kim_diem_tham',
    ),
    capstone(
      'metal',
      'kim_tan_phong',
      'Tán Phong',
      'Điểm Kim tán thành mũi lưỡi — quét nhiều mục tiêu, đòn nhẹ hơn, Xuất Huyết khó trúng hơn.',
      'kim_liet_huyet',
    ),
  ]
}

function buildEarth(): ProgressionNode[] {
  return [
    powerNode(
      'tho_tran_sau',
      'Trần Sâu',
      '+2% thời gian tật trạng mỗi cấp (tối đa +10%).',
      'earth',
      [stat('tho_tran_sau', 'ailmentDurationPercent', 0.02)],
    ),
    powerNode(
      'tho_tran_cung',
      'Trần Củng',
      '+2.5% thời gian tật trạng mỗi cấp (tầng Trúc Cơ).',
      'earth',
      [stat('tho_tran_cung', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'tho_tran_sau' },
    ),
    capstone(
      'earth',
      'tho_tu_nhan',
      'Tụ Nhán',
      'Thổ Cầu nén một điểm — sát thương cao hơn.',
      'tho_tran_cung',
    ),
    capstone(
      'earth',
      'tho_bang_loa',
      'Đá Loạn',
      'Thổ Cầu vỡ thành mảnh đá — quét nhiều mục tiêu, đòn nhẹ hơn, Thạch Hóa yếu hơn.',
      'tho_tran_sau',
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
