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
// (elementApplicationPercent / ailmentPotencyPercent -- the element
// basic is the path's only own-source ailment producer, so the global
// channel IS the skill channel, ruling F14; ailmentDurationPercent is
// dead on 2-4 turn lifetimes, Minh filter 2026-10-07) plus the two-way
// capstone specializations
// (they modify the basic itself). Generic GLOBAL-stat nodes stay cut;
// the per-skillId channel landed 2026-10-06 as cast-scoped
// `castStatModifiers` on `skillDefinitionModifiers` (fold in
// PhapTuNodeModifiers) - the five-node Ly Hoa chain + Tam Muoi trades
// use it for hit-layer stats (skill damage / accuracy / resist-ignore /
// crit) that must NOT leak into character stats or ailment reads.
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

// Insight pace retune 2026-10-05: per-level prices are window-anchored.
// QI-window minors cost 600/level (one element line ~11-15k - near the
// end of the ~24h QI window at ~1.4k/h idle insight); Truc Co-gated
// minors cost 40,000/level (TC idle ~10-13.6k/h across the ~1-week
// window). Flat base: the base+floor(L/perLevel) step is invisible at
// this magnitude. See SkillInsightBalance for the income re-base.
const GROWTH_QI = { base: 600, perLevel: 5 } // perLevel >= maxLevel -> flat 600/level.
const GROWTH_TC = { base: 40_000, perLevel: 5 } // perLevel >= maxLevel -> flat 40,000/level.

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

/**
 * Hoa lane cast-scope (Minh rulings 2026-10-06): a powerNode sibling
 * whose bonus lives on the kit def's `castModifiers` - it moves the
 * CASTER's stat view only while a Ly Hoa hit resolves (fold in
 * PhapTuNodeModifiers); nothing lands in aggregated character stats.
 * Gating mirrors powerNode: element root by default, FOUNDATION realm
 * gate for the TC ring.
 */
function castScopedNode(
  id: string,
  name: string,
  description: string,
  element: ElementType,
  entries: readonly { stat: StatType; perLevel: number }[],
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
    insightCost: options.foundation ? GROWTH_TC.base : GROWTH_QI.base,
    maxLevel: options.maxLevel ?? 5,
    upgradeCost: options.foundation ? GROWTH_TC : GROWTH_QI,
    levelGates: options.maxLevel === 4 ? MINOR_TIER_GATES_4 : MINOR_TIER_GATES,
    prerequisites,
    elementTag: element,
    effect: {
      skillDefinitionModifiers: [
        { skillId: SPELL_KIT_IDS[element][0], castStatModifiers: entries },
      ],
    },
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
    insightCost: options.foundation ? GROWTH_TC.base : GROWTH_QI.base,
    maxLevel: options.maxLevel ?? 5,
    upgradeCost: options.foundation ? GROWTH_TC : GROWTH_QI,
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
    // TC-window XOR specialization capstone: 200,000 insight
    // (~16-18h idle at TC rates).
    insightCost: 200_000,
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
    // Hoa The gate (Minh ruling 2026-10-04): the The loop does NOT come
    // with the element - this node unlocks it. Level = the chance a
    // landed Ly Hoa cast mints +1 The (10%/level, lv4 = 40%).
    // The mechanic is read straight off player.nodeLevels at kit build
    // (CultivationPathRegistry), like the evolution/cascade markers --
    // statModifiers stay empty so nothing double-counts the chance.
    {
      id: 'hoa_the',
      name: 'Tích Diễm',
      description:
        'Mở khóa Hỏa Thế — mỗi cấp +10% tỉ lệ tích 1 tầng Hỏa Thế khi đòn Ly Hỏa trúng. Đủ 5 tầng Hỏa Thế, đòn kế mang Pháp Thế.',
      type: 'minor',
      role: 'growth',
      insightCost: 600,
      maxLevel: 4,
      upgradeCost: { base: 600, perLevel: 5 },
      levelGates: MINOR_TIER_GATES_4,
      prerequisites: [{ kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS.fire }],
      elementTag: 'fire',
      effect: {},
    },
    powerNode(
      'hoa_diem_chuan',
      'Dẫn Hỏa',
      '+2.5% tỉ lệ áp dụng Hỏa Ấn mỗi cấp (tối đa +10% so với gốc).',
      'fire',
      [stat('hoa_diem_chuan', 'elementApplicationPercent', 0.025)],
    ),
    powerNode(
      'hoa_an_sau',
      'Khắc Ấn',
      '+2.5% uy lực Hỏa Ấn mỗi cấp.',
      'fire',
      [stat('hoa_an_sau', 'ailmentPotencyPercent', 0.025)],
    ),
    powerNode(
      'hoa_nhiet_keo',
      'Dư Tẫn',
      '+2.5% uy lực Hỏa Ấn mỗi cấp (tầng Trúc Cơ).',
      'fire',
      [stat('hoa_nhiet_keo', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'hoa_an_sau' },
    ),
    powerNode(
      'hoa_diem_tham',
      'Thấu Hỏa',
      '+2.5% tỉ lệ áp dụng Hỏa Ấn mỗi cấp (tầng Trúc Cơ).',
      'fire',
      [stat('hoa_diem_tham', 'elementApplicationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'hoa_diem_chuan' },
    ),
    capstone(
      'fire',
      'hoa_tu_diem',
      'Tụ Diễm',
      'Ly Hỏa tụ một điểm — sát thương cao hơn, Hỏa Ấn dễ trúng.',
      'hoa_nhiet_keo',
    ),
    capstone(
      'fire',
      'hoa_tan_diem',
      'Tán Diễm',
      'Ly Hỏa tán thành vùng — quét nhiều mục tiêu, đòn nhẹ hơn, Hỏa Ấn khó trúng hơn.',
      'hoa_diem_tham',
    ),

    // ------------------------------------------------------------------
    // Fire tree rulings (Minh, 2026-10-06 spec v4).
    //
    // (a) Ly Hoa hit chain - five cast-scoped growth nodes: their stats
    //     fold into the kit def's castModifiers and apply ONLY while a
    //     Ly Hoa hit resolves (they never touch aggregated stats, so the
    //     Hoa An ailment read stays clean).
    // (b) Tam Muoi lane - three parallel children of
    //     linh_ngo_tam_muoi_chan_hoa: Ngu Hoa trims the Phap Trang
    //     cooldown; each Ngu Viem trade pays +1 CD (once, when learned)
    //     for per-level cast-scoped damage on Ly Hoa. Ngu Viem Than is
    //     intentionally left unauthored (locked seat).
    // (c) Mana branch - SOLO off the element root (Minh ruling):
    //     ho_the is a purchased gate seat; Nguyen Kinh thickens the
    //     Linh Luc Ho The shield, Linh Chuong hardens the barrier as
    //     always-on DR (spec's "while the window holds" has no channel -
    //     flagged), The Diem Kinh raises the Ho The cap ceiling.
    // ------------------------------------------------------------------

    castScopedNode(
      'hoa_diem_uy',
      'Diễm Uy',
      'Đòn Ly Hỏa +6% sát thương kỹ năng mỗi cấp.',
      'fire',
      [{ stat: 'skillDamagePercent', perLevel: 0.06 }],
    ),
    castScopedNode(
      'hoa_hoa_nhan',
      'Hỏa Nhãn',
      'Đòn Ly Hỏa +50 chính xác mỗi cấp.',
      'fire',
      [{ stat: 'accuracyRating', perLevel: 50 }],
      { prereqNodeId: 'hoa_diem_uy' },
    ),
    castScopedNode(
      'hoa_pha_giap_diem',
      'Phá Giáp Diễm',
      'Đòn Ly Hỏa +4% tỉ lệ bỏ qua hoàn toàn kháng phép mỗi cấp.',
      'fire',
      [{ stat: 'chanceToIgnoreResistance', perLevel: 0.04 }],
      { foundation: true, maxLevel: 4, prereqNodeId: 'hoa_hoa_nhan' },
    ),
    castScopedNode(
      'hoa_bao_diem',
      'Bạo Diễm',
      'Đòn Ly Hỏa +4% tỉ lệ chí mạng mỗi cấp.',
      'fire',
      [{ stat: 'criticalRate', perLevel: 0.04 }],
      { foundation: true, maxLevel: 4, prereqNodeId: 'hoa_pha_giap_diem' },
    ),
    castScopedNode(
      'hoa_phe_diem',
      'Phệ Diễm',
      'Đòn Ly Hỏa +25% sát thương chí mạng mỗi cấp.',
      'fire',
      [{ stat: 'criticalDamage', perLevel: 0.25 }],
      { foundation: true, maxLevel: 4, prereqNodeId: 'hoa_bao_diem' },
    ),

    // Ngu Hoa - tempering the Trang cast: each level shaves half a turn
    // off the special's cooldown (folded and floored at 2 turns by
    // PhapTuNodeModifiers).
    {
      id: 'ngu_hoa',
      name: 'Ngự Hỏa',
      description: 'Thuần hóa chân hỏa quanh thân — Ngự Diễm sớm hồi thêm nửa hiệp mỗi cấp (tối đa xuống 2 hiệp).',
      type: 'minor',
      role: 'growth',
      insightCost: GROWTH_TC.base,
      maxLevel: 5,
      upgradeCost: GROWTH_TC,
      levelGates: MINOR_TIER_GATES,
      prerequisites: [
        { kind: 'node', nodeId: 'linh_ngo_tam_muoi_chan_hoa' },
        FOUNDATION,
      ],
      elementTag: 'fire',
      effect: {
        skillDefinitionModifiers: [
          { skillId: SPELL_KIT_IDS.fire[1], cooldownTurnsDelta: { perLevel: -0.5 } },
        ],
      },
    },

    // Tam Muoi trade nodes (song song - parallel children of the
    // special unlock): each pays +1 CD on Ngu Diem ONCE when learned
    // (flat, not per level) for per-level cast-scoped Ly Hoa damage.
    {
      id: 'ngu_viem_tam',
      name: 'Ngự Viêm Tâm',
      description: 'Đổi nhịp Ngự Diễm (+1 hiệp hồi) lấy quyền năng: đòn Ly Hỏa +6% sát thương kỹ năng mỗi cấp.',
      type: 'minor',
      role: 'growth',
      insightCost: GROWTH_TC.base,
      maxLevel: 5,
      upgradeCost: GROWTH_TC,
      levelGates: MINOR_TIER_GATES,
      prerequisites: [
        { kind: 'node', nodeId: 'linh_ngo_tam_muoi_chan_hoa' },
        FOUNDATION,
      ],
      elementTag: 'fire',
      effect: {
        skillDefinitionModifiers: [
          { skillId: SPELL_KIT_IDS.fire[0], castStatModifiers: [{ stat: 'skillDamagePercent', perLevel: 0.06 }] },
          { skillId: SPELL_KIT_IDS.fire[1], cooldownTurnsDelta: { flat: 1 } },
        ],
      },
    },
    {
      id: 'ngu_viem_y',
      name: 'Ngự Viêm Ý',
      description: 'Đổi nhịp Ngự Diễm (+1 hiệp hồi) lấy ý chí thiêu đốt: đòn Ly Hỏa +9% sát thương kỹ năng mỗi cấp.',
      type: 'minor',
      role: 'growth',
      insightCost: GROWTH_TC.base,
      maxLevel: 5,
      upgradeCost: GROWTH_TC,
      levelGates: MINOR_TIER_GATES,
      prerequisites: [
        { kind: 'node', nodeId: 'linh_ngo_tam_muoi_chan_hoa' },
        FOUNDATION,
      ],
      elementTag: 'fire',
      effect: {
        skillDefinitionModifiers: [
          { skillId: SPELL_KIT_IDS.fire[0], castStatModifiers: [{ stat: 'skillDamagePercent', perLevel: 0.09 }] },
          { skillId: SPELL_KIT_IDS.fire[1], cooldownTurnsDelta: { flat: 1 } },
        ],
      },
    },

    // Mana branch (Minh ruling: "nhanh mana solo") - hangs off the
    // element root, NOT the Tam Muoi unlock. Ho The is the purchased
    // gate seat (a thin keystone - it owns no effect itself).
    {
      id: 'ho_the',
      name: 'Hộ Thể',
      description: 'Ngưng Linh Lực thành tầng hộ mệnh — mở nhánh Linh Lực Hộ Thể.',
      type: 'minor',
      role: 'keystone',
      insightCost: GROWTH_TC.base,
      maxLevel: 1,
      prerequisites: [
        { kind: 'node', nodeId: PHAP_TU_ELEMENT_ROOT_IDS.fire },
        FOUNDATION,
      ],
      elementTag: 'fire',
      effect: {},
    },
    {
      id: 'nguyen_kinh',
      name: 'Nguyên Kính',
      description: 'Dày hóa tấm kính nguyên lực — Linh Lực Hộ Thể gánh thêm +5% sát thương nhận vào mỗi cấp.',
      type: 'minor',
      role: 'growth',
      insightCost: GROWTH_TC.base,
      maxLevel: 5,
      upgradeCost: GROWTH_TC,
      levelGates: MINOR_TIER_GATES,
      prerequisites: [{ kind: 'node', nodeId: 'ho_the' }],
      elementTag: 'fire',
      effect: { statModifiers: [stat('nguyen_kinh', 'manaShieldPercent', 0.05)] },
    },
    // Linh Chuong (renamed "Ngu Ho" seat, Minh ruling): parallel with
    // Nguyen Kinh off the same seat. Final-DR is always-on here - the
    // spec's "only while Ngu Diem holds" has no stat channel; flagged
    // on the task report for a conditional gate if wanted.
    {
      id: 'linh_chuong',
      name: 'Linh Chướng',
      description: 'Chướng khí rào quanh thân — +1.5% giảm sát thương cuối mỗi cấp.',
      type: 'minor',
      role: 'growth',
      insightCost: GROWTH_TC.base,
      maxLevel: 3,
      upgradeCost: GROWTH_TC,
      levelGates: [{ atLevel: 3, prerequisite: { kind: 'techniqueRank', rank: 2 } }],
      prerequisites: [{ kind: 'node', nodeId: 'ho_the' }],
      elementTag: 'fire',
      effect: { statModifiers: [stat('linh_chuong', 'finalDamageReductionPercent', 0.015)] },
    },
    {
      id: 'the_diem_kinh',
      name: 'Thể Diễm Kính',
      description: 'Kính diễm dung nạp thêm — nóc Linh Lực Hộ Thể +2% Linh Lực tối đa mỗi cấp.',
      type: 'minor',
      role: 'growth',
      insightCost: GROWTH_TC.base,
      maxLevel: 4,
      upgradeCost: GROWTH_TC,
      levelGates: MINOR_TIER_GATES_4,
      prerequisites: [{ kind: 'node', nodeId: 'nguyen_kinh' }],
      elementTag: 'fire',
      effect: { statModifiers: [stat('the_diem_kinh', 'linhLucHoTheCap', 0.02)] },
    },
  ]
}

function buildWater(): ProgressionNode[] {
  return [
    powerNode(
      'thuy_diem_chuan',
      'Lưu Chuẩn',
      '+2.5% tỉ lệ áp dụng Tê Cóng mỗi cấp (tối đa +10% so với gốc).',
      'water',
      [stat('thuy_diem_chuan', 'elementApplicationPercent', 0.025)],
    ),
    powerNode(
      'thuy_te_dam',
      'Tê Đẫm',
      '+2.5% uy lực Tê Cóng mỗi cấp.',
      'water',
      [stat('thuy_te_dam', 'ailmentPotencyPercent', 0.025)],
    ),
    powerNode(
      'thuy_luu_tich',
      'Lưu Tích',
      '+2.5% thời gian Tê Cóng mỗi cấp (tối đa +10%).',
      'water',
      [stat('thuy_luu_tich', 'ailmentDurationPercent', 0.025)],
    ),
    powerNode(
      'thuy_nhiet_tri',
      'Nhiễm Trì',
      '+2.5% thời gian Tê Cóng mỗi cấp (tầng Trúc Cơ).',
      'water',
      [stat('thuy_nhiet_tri', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'thuy_luu_tich' },
    ),
    powerNode(
      'thuy_te_tham',
      'Tê Thấm',
      '+2.5% uy lực Tê Cóng mỗi cấp (tầng Trúc Cơ).',
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
      '+2.5% uy lực Trúng Độc mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_sau', 'ailmentPotencyPercent', 0.025)],
    ),
    powerNode(
      'moc_doc_dien',
      'Độc Diễn',
      '+2.5% thời gian Trúng Độc mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_dien', 'ailmentDurationPercent', 0.025)],
    ),
    powerNode(
      'moc_doc_tham',
      'Độc Thấm',
      '+2.5% uy lực Trúng Độc mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_tham', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'moc_doc_sau' },
    ),
    powerNode(
      'moc_doc_man',
      'Độc Mạn',
      '+2.5% thời gian Trúng Độc mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_man', 'ailmentDurationPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'moc_doc_dien' },
    ),
    powerNode(
      'moc_doc_nhuan',
      'Độc Nhuần',
      '+2.5% thời gian Trúng Độc mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_nhuan', 'ailmentDurationPercent', 0.025)],
    ),
    powerNode(
      'moc_doc_tu',
      'Độc Tú',
      '+2.5% uy lực Trúng Độc mỗi cấp (tối đa +10%).',
      'wood',
      [stat('moc_doc_tu', 'ailmentPotencyPercent', 0.025)],
    ),
    powerNode(
      'moc_doc_am',
      'Độc Ám',
      '+2.5% uy lực Trúng Độc mỗi cấp (tầng Trúc Cơ).',
      'wood',
      [stat('moc_doc_am', 'ailmentPotencyPercent', 0.025)],
      { foundation: true, maxLevel: 4, prereqNodeId: 'moc_doc_tu' },
    ),
    powerNode(
      'moc_doc_nhiem',
      'Độc Nhiễm',
      '+2.5% uy lực Trúng Độc mỗi cấp (tầng Trúc Cơ).',
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
      '+2.5% tỉ lệ áp dụng Xuất Huyết mỗi cấp (tối đa +10% so với gốc).',
      'metal',
      [stat('kim_diem_chuan', 'elementApplicationPercent', 0.025)],
    ),
    powerNode(
      'kim_liet_huyet',
      'Liệt Huyết',
      '+2.5% uy lực Xuất Huyết mỗi cấp (tối đa +10%).',
      'metal',
      [stat('kim_liet_huyet', 'ailmentPotencyPercent', 0.025)],
    ),
    powerNode(
      'kim_diem_tham',
      'Điểm Thấm',
      '+2.5% tỉ lệ áp dụng Xuất Huyết mỗi cấp (tầng Trúc Cơ).',
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
      '+2.5% thời gian Thạch Hóa mỗi cấp (tối đa +10%).',
      'earth',
      [stat('tho_tran_sau', 'ailmentDurationPercent', 0.025)],
    ),
    powerNode(
      'tho_tran_cung',
      'Trần Củng',
      '+2.5% thời gian Thạch Hóa mỗi cấp (tầng Trúc Cơ).',
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
