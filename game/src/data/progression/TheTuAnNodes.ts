import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// The Tu An -- Ung The beta tree (design authority
// docs/design/the-tu-an-ung-the-design.txt Part XIII) -- the hidden
// the_tu_an tree, SIX nodes. The design forbids tree content touching
// main stats, chances, Max HP/Def, generic damage/crit, Ung Tre, the
// debt cap, free reactions, or proc-cost fillers (sec.87) -- every
// channel below is a payload/consequence/observation rider summed by
// collectHiddenBodyMechanicModifiers and baked into participant-local
// clones by buildTheTuAnKit.
//
// Topology (sec.88):
//   Luyen Khi (qi_refining): Tham The (kit basic) -> Thau The +
//     Phan Kinh minors. Phan is BASELINE -- not a node, not a root.
//   Truc Co (foundation_establishment): major_quan_the grants the Quan
//     The skill core (technique-rank gated); unlocking it opens the Ho /
//     Tro baseline channels AND the three consequence majors behind it.
//   The old *_mon purchasable roots and the stat/economy trunk are
//     SUPERSEDED -- Hoi/Phan/Tro are capability presentation, not nodes.
//
// Path gate: every node carries requiredCultivationPath 'body' +
// requiredWay 'hidden_body_pathway' (stamped once at the export below);
// nodePathApplies/nodeWayApplies enforce it at purchase, upgrade, and
// every aggregator.

const GROWTH_3 = { base: 1, perLevel: 2 } // 1,1,2 -- sibling growth convention.

// ---------------- Luyen Khi minors ----------------

const LQ_MINORS: ProgressionNode[] = [
  {
    id: 'minor_thau_the',
    name: 'Thấu Thế',
    description: 'Quan sát sâu hơn: hành động của kẻ địch được quan sát thu thêm +2 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 3,
    upgradeCost: GROWTH_3,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { hiddenBodyMechanicModifiers: { observationGainBonus: 2 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_phan_kinh',
    name: 'Phản Kình',
    description: 'Phản Kích xuyên thêm 15% giáp mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 3,
    upgradeCost: GROWTH_3,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { hiddenBodyMechanicModifiers: { phanKinhArmorPierce: 0.15 } },
    branchTag: 'the_tu_an',
  },
]

// ---------------- Truc Co (Quan The core + consequence majors) ----------------

const TC_MAJORS: ProgressionNode[] = [
  {
    id: 'major_quan_the',
    name: 'Quan Thế',
    description: 'Học Quan Thế: quan sát toàn trận trong vài lượt của bản thân; mở kênh Hộ và Trợ.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'techniqueRank', rank: 5 },
    ],
    effect: { grantsSkillCoreIds: ['quan_the'] },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_ho_bi',
    name: 'Hộ Bích',
    description: 'Hộ cam kết: đồng đội được che chắn nhận lớp giáp ngoài bằng 15% Sinh Mệnh Tối Đa của người hộ.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [{ kind: 'node', nodeId: 'major_quan_the' }],
    effect: { hiddenBodyMechanicModifiers: { interceptWardRatio: 0.15 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_trong_phan',
    name: 'Trọng Phản',
    description: 'Phản sau khi né đòn trở thành Trọng Phản Kích: đòn phản nặng hơn (+60% sát thương).',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [{ kind: 'node', nodeId: 'major_quan_the' }],
    effect: { hiddenBodyMechanicModifiers: { evadeCounterMultiplierBonus: 0.6 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_dan_the',
    name: 'Dẫn Thế',
    description: 'Trợ Kích trúng đặt Dẫn Thế: nhịp quan sát kế tiếp từ kẻ mang ấn sinh gấp ba Thế.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [{ kind: 'node', nodeId: 'major_quan_the' }],
    effect: { hiddenBodyMechanicModifiers: { danTheBonus: 1 } },
    branchTag: 'the_tu_an',
  },
]

// Path/way stamps once here: every node belongs to the BASE 'body' path
// (direct equality in NodeSystem.nodePathApplies) and to the
// hidden_body_pathway way only (nodeWayApplies). The branchTag stays
// 'the_tu_an' -- the tree-view display key, not the gameplay gate.
export const THE_TU_AN_NODES: ProgressionNode[] = [
  ...LQ_MINORS,
  ...TC_MAJORS,
].map(
  (node): ProgressionNode => ({
    ...node,
    requiredCultivationPath: 'body',
    requiredWay: 'hidden_body_pathway',
  }),
)
