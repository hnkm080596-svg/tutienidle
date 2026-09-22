import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'

// The Tu Reimagined (spec 2026-09-15 section 8.1, plan Task 12) — the
// visible body tree: a shared stat trunk feeding two excludesNode
// mutex roots (INV-2). One branchTag 'the_tu' renders the whole tree in
// a single view — the mutex is a GATE (excludesNode), not hidden UI.
//
// Path gate: every node in this tree carries requiredCultivationPath
// 'body' (stamped once at the export below) — NodeSystem.
// nodePathApplies enforces it at purchase/upgrade/aggregation, so the
// domain rejects wrong-path ownership even if the render/offer layer
// is bypassed. Realm gates are data: roots + trunk open at
// qi_refining, deeper nodes gate foundation_establishment (beta
// content bound, spec section 11).
//
// Delivery channels (only these exist — A8, no invented riders):
//   - statModifiers: character stats; gated stats (blockChance,
//     blockEffectiveness, endurance*) MUST tag domain 'body' or the
//     StatDomain gate rejects them. Chance stats are NEVER authored
//     here (INV-13 — the attribute deriver is the only source).
//   - effect.bodyKitModifiers: numeric kit channels summed by
//     collectBodyKitModifiers and baked into participant-local def
//     clones by buildTheTuKit (missing-HP scalar, Bat Tu duration,
//     reflection ratios, taunt duration, Son Nhac ward ratio).
//
// Spec-listed categories with NO channel today (deferred, documented
// per plan Task 12 "only spec-listed categories"): tran_ap debuff
// riders (slow/attack-down/def-shred need an appliesAilments-injection
// channel on the kit collector), Bat Tu leech/kill-extend (need a
// buff-rider trigger channel), son_nhac self-DR scaling (the buff def
// is registry-level; no participant-local def injection exists for it).

function stat(nodeId: string, statKey: StatModifier['stat'], flat?: number, perLevelFlat?: number): StatModifier {
  return {
    id: `node:${nodeId}:${statKey}`,
    sourceId: nodeId,
    sourceType: 'talent',
    domain: 'body',
    stat: statKey,
    ...(flat !== undefined ? { flat } : {}),
    ...(perLevelFlat !== undefined ? { perLevelFlat } : {}),
  }
}

function statPercent(nodeId: string, statKey: StatModifier['stat'], percent: number, perLevelPercent?: number): StatModifier {
  return {
    id: `node:${nodeId}:${statKey}`,
    sourceId: nodeId,
    sourceType: 'talent',
    domain: 'body',
    stat: statKey,
    percent,
    ...(perLevelPercent !== undefined ? { perLevelPercent } : {}),
  }
}

const GROWTH_5 = { base: 1, perLevel: 2 } // 1,1,2,2,3 — sibling growth convention.

// ---------------- Trunk (available at path entry, qi_refining) ----------------

const TRUNK_QI: ProgressionNode[] = [
  {
    id: 'minor_the_can_cot',
    name: 'Cường Cốt',
    description: '+2 Căn Cốt (Strength) mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [stat('minor_the_can_cot', 'strength', 2, 2)] },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_the_the_chat',
    name: 'Tráng Thể',
    description: '+2 Thể Chất (Vitality) mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [stat('minor_the_the_chat', 'vitality', 2, 2)] },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_the_kim_khue',
    name: 'Kim Khư',
    description: '+3% Sinh Mệnh Tối Đa mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [statPercent('minor_the_kim_khue', 'maxHp', 0.03, 0.03)] },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_the_thiet_bi',
    name: 'Thiết Bị',
    description: '+3 Phòng Ngự (Defense) mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [stat('minor_the_thiet_bi', 'defense', 3, 3)] },
    branchTag: 'the_tu',
  },
]

// Deeper trunk — block/endurance are body-gated stats (Task 3
// migration); the domain tag on each modifier is REQUIRED for delivery.
const TRUNK_FOUNDATION: ProgressionNode[] = [
  {
    id: 'minor_the_thach_the',
    name: 'Thạch Thể',
    description: '+2% Tỉ Lệ Đỡ Đòn (Block) mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'foundation_establishment' }],
    effect: { statModifiers: [stat('minor_the_thach_the', 'blockChance', 0.02, 0.02)] },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_the_lan_da',
    name: 'Lân Da',
    description: '+3% Hiệu Quả Đỡ Đòn mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'foundation_establishment' }],
    effect: { statModifiers: [stat('minor_the_lan_da', 'blockEffectiveness', 0.03, 0.03)] },
    branchTag: 'the_tu',
  },
]

// ---------------- Cuong Chien branch ----------------

const CUONG_ROOT: ProgressionNode = {
  id: 'cuong_chien',
  name: 'Cuồng Chiến',
  description:
    'Nhập môn Cuồng Chiến — lối đánh càng thương càng mạnh: Cuồng Quyền, Loạn Đấu và Bất Tử Bá Thể.',
  type: 'major',
  role: 'root',
  insightCost: 0,
  prerequisites: [
    { kind: 'realm', realmId: 'qi_refining' },
    { kind: 'excludesNode', nodeId: 'tran_the' },
  ],
  effect: {
    // M-QI-05 - the Cuong Chien kit's Core Nodes ride the root grant
    // (revoked with refunds if the branch is dev-reset).
    grantsSkillCoreIds: ['cuong_quyen', 'loan_dau', 'bat_tu_ba_the'],
  },
  branchTag: 'the_tu',
}

const CUONG_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_cuong_huyet_no',
    name: 'Cuồng Huyết Nộ',
    description: 'Cuồng Quyền/Loạn Đấu: +0.5% sát thương mỗi 1% máu đã mất, mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'cuong_chien' }],
    effect: { bodyKitModifiers: { missingHpBonusBonus: 0.005 } },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_cuong_cong_the',
    name: 'Cuồng Công',
    description: '+3 Căn Cốt mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'cuong_chien' }],
    effect: { statModifiers: [stat('minor_cuong_cong_the', 'strength', 3, 3)] },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_cuong_sinh_menh',
    name: 'Cuồng Sinh Mệnh',
    description: '+3 Thể Chất mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'cuong_chien' }],
    effect: { statModifiers: [stat('minor_cuong_sinh_menh', 'vitality', 3, 3)] },
    branchTag: 'the_tu',
  },
  {
    id: 'major_bat_tu_tuc_menh',
    name: 'Bất Tử Tục Mệnh',
    description: 'Bất Tử Bá Thể kéo dài thêm 1 lượt của bản thân (cả kích hoạt tay lẫn kích hoạt khi trí mạng).',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'cuong_chien' },
      // M-QI-06 authored unlock gate (mechanism-proving set).
      { kind: 'techniqueRank', rank: 5 },
    ],
    effect: { bodyKitModifiers: { batTuDurationBonus: 1 } },
    branchTag: 'the_tu',
  },
  {
    id: 'major_loan_dau_sat',
    name: 'Loạn Đấu Sát',
    description: 'Loạn Đấu nghiệt hơn: +1% sát thương mỗi 1% máu đã mất.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'minor_cuong_huyet_no' },
      // M-QI-06 authored unlock gate (mechanism-proving set).
      { kind: 'techniqueRank', rank: 5 },
    ],
    effect: { bodyKitModifiers: { missingHpBonusBonus: 0.01 } },
    branchTag: 'the_tu',
  },
]

// ---------------- Tran The branch ----------------

const TRAN_ROOT: ProgressionNode = {
  id: 'tran_the',
  name: 'Trấn Thể',
  description:
    'Nhập môn Trấn Thể — thân làm thành trì: Trấn Áp, Phản Chấn và Sơn Nhạc che chở cả đội.',
  type: 'major',
  role: 'root',
  insightCost: 0,
  prerequisites: [
    { kind: 'realm', realmId: 'qi_refining' },
    { kind: 'excludesNode', nodeId: 'cuong_chien' },
  ],
  effect: {
    // M-QI-05 - phan_chinh is an internal emblem action, not a core.
    grantsSkillCoreIds: ['tran_ap', 'son_nhac'],
  },
  branchTag: 'the_tu',
}

const TRAN_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_phan_chinh_no',
    name: 'Phản Nộ',
    description: 'Phản Chấn trả thêm +2% sát thương đã nhận mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'tran_the' }],
    effect: { bodyKitModifiers: { reflectTakenRatioBonus: 0.02 } },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_phan_chinh_cuc',
    name: 'Phản Cực',
    description: 'Phản Chấn trần trả thêm +0.4% Sinh Mệnh Tối Đa mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'tran_the' }],
    effect: { bodyKitModifiers: { reflectMaxHpRatioBonus: 0.004 } },
    branchTag: 'the_tu',
  },
  {
    id: 'minor_tran_the_bi',
    name: 'Trấn Bị',
    description: '+3% Hiệu Quả Đỡ Đòn mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'tran_the' }],
    effect: { statModifiers: [stat('minor_tran_the_bi', 'blockEffectiveness', 0.03, 0.03)] },
    branchTag: 'the_tu',
  },
  {
    id: 'major_khiem_khich_dien',
    name: 'Khiêu Khích Diễn',
    description: 'Khiêu Khích kéo dài thêm 1 lượt của kẻ địch bị khiêu.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'tran_the' },
      // M-QI-06 authored unlock gate (mechanism-proving set).
      { kind: 'techniqueRank', rank: 5 },
    ],
    effect: { bodyKitModifiers: { tauntTurnsBonus: 1 } },
    branchTag: 'the_tu',
  },
  {
    id: 'major_son_nhac_bao_bi',
    name: 'Sơn Nhạc Bao Bị',
    description: 'Sơn Nhạc Hộ Thể: lớp giáp ngoài mạnh thêm +5% Sinh Mệnh Tối Đa của bản thân.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'tran_the' },
      // M-QI-06 authored unlock gate (mechanism-proving set).
      { kind: 'techniqueRank', rank: 5 },
    ],
    effect: { bodyKitModifiers: { sonNhacWardRatioBonus: 0.05 } },
    branchTag: 'the_tu',
  },
]

// M5 — path/way stamps once here: every node belongs to the BASE
// body path family (NodeSystem.nodePathApplies resolves both eras to
// the family) and to the HIEN way only (nodeWayApplies). An ung_the
// player can neither purchase nor aggregate this tree; the An tree
// carries the matching ung_the stamp.
export const THE_TU_NODES: ProgressionNode[] = [
  ...TRUNK_QI,
  ...TRUNK_FOUNDATION,
  CUONG_ROOT,
  ...CUONG_BRANCH,
  TRAN_ROOT,
  ...TRAN_BRANCH,
].map(
  (node): ProgressionNode => ({
    ...node,
    requiredCultivationPath: 'body',
    requiredWay: 'body_pathway',
  }),
)
