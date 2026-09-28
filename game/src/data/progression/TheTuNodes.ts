import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// The Tu beta (the-tu-body-pathway-design sec.56) - the visible body
// tree: two excludesNode-mutex roots, each a vertical line
//   root -> Basic branch (2 nodes) -> - Truc Co - -> Special branch (2 nodes)
// rendered by TheTuTreePanel (two root cards, realm separators, the
// abandoned root shows 'Da bo con duong nay').
//
// Path gate: every node carries requiredCultivationPath 'body' +
// requiredWay 'body_pathway' (stamped once at the export below) -
// NodeSystem.nodePathApplies/nodeWayApplies enforce at purchase/upgrade/
// aggregation, so a wrong-path level can never aggregate even if the
// render layer is bypassed. Realm gates are data: roots + the Basic
// branches open at qi_refining; Specials and their branches gate
// foundation_establishment (the beta content bound).
//
// Beta rules (design): nodes are SKILL-LOCAL only - `bodyKitModifiers`
// channels summed by collectBodyKitModifiers and baked into
// participant-local kit clones by buildTheTuKit. NO node grants
// Might/HP/Defense/Block or generic player stats - the retired stat
// trunk + stat nodes are gone (audit CONFLICTS). Node levels are
// modifier levels only; Core Skill Level stays the sole skill-level
// authority (M-QI-05). Legacy post-beta nodes (bat_tu/son_nhac/taunt
// duration) are dropped from the tree with their channels.

const GROWTH_5 = { base: 1, perLevel: 2 } // 1,1,2,2,3 - sibling growth convention.

// ---------------- Cuong Chien (Might -> single-target) ----------------

const CUONG_ROOT: ProgressionNode = {
  id: 'cuong_chien',
  name: 'Cuồng Chiến',
  description:
    'Nhập môn Cuồng Chiến — lối đánh càng thương càng mạnh: Cuồng Quyền là nắm đấm, Trúc Cơ mở Loạn Đấu.',
  type: 'major',
  role: 'root',
  insightCost: 0,
  prerequisites: [
    { kind: 'realm', realmId: 'qi_refining' },
    { kind: 'excludesNode', nodeId: 'tran_the' },
  ],
  effect: {
    // The root grants the BASIC core only - the Truc Co special arrives
    // through major_loan_dau (M-QI-05 grant seam, revoked on dev-reset).
    grantsSkillCoreIds: ['cuong_quyen'],
  },
  branchTag: 'the_tu',
}

const CUONG_BASIC_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_trong_quyen',
    name: 'Trọng Quyền',
    description: 'Cuồng Quyền chuyển hóa Căn Cốt sâu hơn: +0.10 hệ số sát thương mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'cuong_chien' }],
    effect: { bodyKitModifiers: { cuongQuyenCoefficientBonus: 0.1 } },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_pha_kinh',
    name: 'Phá Kình',
    description: 'Cuồng Quyền xuyên giáp: đòn đánh bỏ qua thêm +15% tỉ lệ giảm sát thương từ Phòng Ngự mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'cuong_chien' }],
    effect: { bodyKitModifiers: { cuongQuyenArmorPierce: 0.15 } },
    branchTag: 'the_tu',
  },
]

// Truc Co gate - learning Loan Dau opens the TC special AND the kit's
// Huyet Cuong passive (missing-HP damage for the Cuong Chien kit only).
const LOAN_DAU_MAJOR: ProgressionNode = {
  id: 'major_loan_dau',
  name: 'Loạn Đấu',
  description:
    'Trúc Cơ: học Loạn Đấu — hiến sinh một phần Sinh Mệnh Tối Đa để đánh loạn liên hoàn; mở nội tại Huyết Cuồng (máu càng ít, Cuồng Chiến càng mạnh).',
  type: 'major',
  role: 'keystone',
  insightCost: 2,
  prerequisites: [
    { kind: 'realm', realmId: 'foundation_establishment' },
    { kind: 'node', nodeId: 'cuong_chien' },
    { kind: 'techniqueRank', rank: 5 },
  ],
  effect: { grantsSkillCoreIds: ['loan_dau'] },
  branchTag: 'the_tu',
}

const CUONG_SPECIAL_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_huyet_sat',
    name: 'Huyết Sát',
    description: 'Loạn Đấu nghiệt hơn: +0.002 hệ số sát thương cho mỗi điểm máu đã hiến trả mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'major_loan_dau' }],
    effect: { bodyKitModifiers: { loanDauPaidHpBonus: 0.002 } },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_cuong_y',
    name: 'Cuồng Ý',
    description: 'Huyết Cuồng bộc phát mạnh hơn: +0.5% sát thương mỗi 1% máu đã mất, mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'major_loan_dau' }],
    effect: { bodyKitModifiers: { missingHpBonusBonus: 0.005 } },
    branchTag: 'the_tu',
  },
]

// ---------------- Tran The (Max HP -> AoE) ----------------

const TRAN_ROOT: ProgressionNode = {
  id: 'tran_the',
  name: 'Trấn Thể',
  description:
    'Nhập môn Trấn Thể — thân làm thành trì: Trấn Áp quét theo Sinh Mệnh Tối Đa, Trúc Cơ mở Phản Chấn phản kích.',
  type: 'major',
  role: 'root',
  insightCost: 0,
  prerequisites: [
    { kind: 'realm', realmId: 'qi_refining' },
    { kind: 'excludesNode', nodeId: 'cuong_chien' },
  ],
  effect: {
    // The root grants the BASIC core only - the Truc Co special arrives
    // through major_phan_chan.
    grantsSkillCoreIds: ['tran_ap'],
  },
  branchTag: 'the_tu',
}

const TRAN_BASIC_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_trong_the',
    name: 'Trọng Thế',
    description: 'Trấn Áp mượn thêm Sinh Mệnh Tối Đa: +6% Max-HP chuyển vào sát thương mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'tran_the' }],
    effect: { bodyKitModifiers: { tranApMaxHpRatioBonus: 0.06 } },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_tran_kinh',
    name: 'Trấn Kình',
    description: 'Kẻ địch trúng Trấn Áp bị đánh yếu: đòn kế tiếp của chúng giảm sát thương (mạnh hơn mỗi cấp).',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'tran_the' }],
    effect: { bodyKitModifiers: { tranKinhWeakenRatio: 0.15 } },
    branchTag: 'the_tu',
  },
]

const PHAN_CHAN_MAJOR: ProgressionNode = {
  id: 'major_phan_chan',
  name: 'Phản Chấn',
  description:
    'Trúc Cơ: học Phản Chấn — khiêu khích và đánh ấn mọi kẻ địch; kẻ đánh trúng Trấn Thể bị phản kích theo Sinh Mệnh Tối Đa.',
  type: 'major',
  role: 'keystone',
  insightCost: 2,
  prerequisites: [
    { kind: 'realm', realmId: 'foundation_establishment' },
    { kind: 'node', nodeId: 'tran_the' },
    { kind: 'techniqueRank', rank: 5 },
  ],
  effect: { grantsSkillCoreIds: ['phan_chan'] },
  branchTag: 'the_tu',
}

const TRAN_SPECIAL_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_chan_cot',
    name: 'Chấn Cốt',
    description: 'Phản Chấn phản nặng hơn: +1% Sinh Mệnh Tối Đa sát thương phản mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'major_phan_chan' }],
    effect: { bodyKitModifiers: { reflectMaxHpRatioBonus: 0.01 } },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_tran_an',
    name: 'Trấn Ấn',
    description: 'Chấn Ấn ngấm sâu: kẻ mang ấn chịu phản kích thêm +2% Sinh Mệnh Tối Đa mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'major_phan_chan' }],
    effect: { bodyKitModifiers: { reflectMarkedRatioBonus: 0.02 } },
    branchTag: 'the_tu',
  },
]

// M5 - path/way stamps once here: every node belongs to the BASE
// body path family (NodeSystem.nodePathApplies resolves both eras to
// the family) and to the HIEN way only (nodeWayApplies). An ung_the
// player can neither purchase nor aggregate this tree; the An tree
// carries the matching ung_the stamp.
export const THE_TU_NODES: ProgressionNode[] = [
  CUONG_ROOT,
  ...CUONG_BASIC_BRANCH,
  LOAN_DAU_MAJOR,
  ...CUONG_SPECIAL_BRANCH,
  TRAN_ROOT,
  ...TRAN_BASIC_BRANCH,
  PHAN_CHAN_MAJOR,
  ...TRAN_SPECIAL_BRANCH,
].map(
  (node): ProgressionNode => ({
    ...node,
    requiredCultivationPath: 'body',
    requiredWay: 'body_pathway',
  }),
)
