import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import type { OrbId } from '../../core/kiem-tu/KiemTuState'
import { REALMS } from '../realms/realm'
import { ORB_UNLOCK_REALM } from '../skill/KiemPhoOrbs'

// Kiem Tu Reimagined (spec 2026-09-15 §6) — the tree after the legacy
// Kiem Tran / Bat Kiem retirement:
//
//   branchTag 'kiem_pho' — 5 orb branches (hien way). Each branch: 5
//   growth nodes realm-gated to the orb's own unlock realm (spec K13)
//   + 1 keystone capstone carrying effect.swordPathComboModifier — the
//   ONLY channel a node may alter a combo (spec §4.2). All stamped
//   requiredWay 'sword_pathway' — inert and unpurchasable on the ngu way.
//
//   branchTag 'ngu_kiem' — the ngu way subtree (Cultivation Path
//   Framework M6: way membership replaces the retired kiem_tu_an flip
//   node — entry is ritual-only now): 3 cascade unlock nodes (a/e/d),
//   3 per-instance growth nodes (generic statModifiers — every phi
//   kiem instance runs the standard damage pipeline so player stats
//   scale all of them), and the Cuu Cung 3x3: 8 realm-gated
//   kiemYGrant outers feeding trung_cung's +1 kiemDaoGrant. All 9 Cuu
//   Cung nodes carry the kiemDaoBelowCap prereq — a capped pool
//   rejects the buy BEFORE insight moves (spec K20).
//
function stat(
  nodeId: string,
  statKey: StatModifier['stat'],
  flat?: number,
  perLevelFlat?: number,
  percent?: number,
  perLevelPercent?: number,
): StatModifier {
  return {
    id: `node:${nodeId}:${statKey}`,
    sourceId: nodeId,
    sourceType: 'talent',
    stat: statKey,
    ...(flat !== undefined ? { flat } : {}),
    ...(perLevelFlat !== undefined ? { perLevelFlat } : {}),
    ...(percent !== undefined ? { percent } : {}),
    ...(perLevelPercent !== undefined ? { perLevelPercent } : {}),
  }
}

// ───────────────────────── Orb branches (hien) ─────────────────────────

interface OrbGrowthSpec {
  name: string
  description: string
  modifier: StatModifier
}

interface OrbBranchSpec {
  orb: OrbId
  orbName: string
  growth: [
    OrbGrowthSpec, // [0] is the branch root — realm gate only
    OrbGrowthSpec, // [1] prereq g0
    OrbGrowthSpec, // [2] prereq g0
    OrbGrowthSpec, // [3] prereq g1
    OrbGrowthSpec, // [4] prereq g2
  ]
  capstone: {
    name: string
    description: string
    modifier: NonNullable<ProgressionNode['effect']['swordPathComboModifier']>
  }
}

function orbGrowth(orb: OrbId, spec: OrbGrowthSpec, index: number): ProgressionNode {
  const id = `${orb}_${index + 1}`
  const chainTo = index === 0 ? null : `${orb}_${index === 3 ? 2 : index === 4 ? 3 : 1}`

  return {
    id,
    name: spec.name,
    description: spec.description,
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM[orb]]!.id },
      ...(chainTo ? [{ kind: 'node' as const, nodeId: chainTo }] : []),
    ],
    effect: { statModifiers: [spec.modifier] },
    branchTag: 'kiem_pho',
  }
}

const ORB_BRANCHES: OrbBranchSpec[] = [
  {
    orb: 'orb_dam',
    orbName: 'Đâm',
    growth: [
      { name: 'Kiếm Căn · Đâm', description: '+2 Uy Lực mỗi cấp — nền của đường kiếm đâm.', modifier: stat('orb_dam_1', 'might', 2, 2) },
      { name: 'Đâm Chuẩn', description: '+5 Chính Xác mỗi cấp.', modifier: stat('orb_dam_2', 'accuracyRating', 5, 5) },
      { name: 'Đâm Xuyên', description: '+2% Xuyên Kháng mỗi cấp.', modifier: stat('orb_dam_3', 'chanceToIgnoreResistance', undefined, undefined, 0.02, 0.02) },
      { name: 'Đâm Uy', description: '+3% Sát Thương Kỹ Năng mỗi cấp.', modifier: stat('orb_dam_4', 'skillDamagePercent', undefined, undefined, 0.03, 0.03) },
      { name: 'Đâm Sát', description: '+4% Sát Thương Chí Mạng mỗi cấp.', modifier: stat('orb_dam_5', 'criticalDamage', undefined, undefined, 0.04, 0.04) },
    ],
    capstone: {
      name: 'Đâm Tâm Pháp',
      description: 'Combo chứa ít nhất 2 Đâm: +25% sát thương combo.',
      modifier: { minOrbCount: { orb: 'orb_dam', count: 2 }, bonusDamageMultiplier: 0.25 },
    },
  },
  {
    orb: 'orb_chem',
    orbName: 'Chém',
    growth: [
      { name: 'Kiếm Căn · Trảm', description: '+2 Uy Lực mỗi cấp — nền của đường kiếm chém.', modifier: stat('orb_chem_1', 'might', 2, 2) },
      { name: 'Trảm Liệt', description: '+3% Hiệu Lực Dị Thường mỗi cấp — Kiếm Thương chảy mạnh hơn.', modifier: stat('orb_chem_2', 'ailmentPotencyPercent', undefined, undefined, 0.03, 0.03) },
      { name: 'Trảm Dai', description: '+3% Thời Gian Dị Thường mỗi cấp — vết thương kéo dài hơn.', modifier: stat('orb_chem_3', 'ailmentDurationPercent', undefined, undefined, 0.03, 0.03) },
      { name: 'Trảm Uy', description: '+3% Sát Thương Kỹ Năng mỗi cấp.', modifier: stat('orb_chem_4', 'skillDamagePercent', undefined, undefined, 0.03, 0.03) },
      { name: 'Trảm Sát', description: '+2% Tỉ Lệ Chí Mạng mỗi cấp.', modifier: stat('orb_chem_5', 'criticalRate', undefined, undefined, 0.02, 0.02) },
    ],
    capstone: {
      name: 'Trảm Tâm Pháp',
      description: 'Combo chứa ít nhất 2 Chém: gây thêm 2 tầng Kiếm Thương.',
      modifier: {
        minOrbCount: { orb: 'orb_chem', count: 2 },
        appliesBuff: { definitionId: 'kiem_thuong', target: 'target', stacks: 2 },
      },
    },
  },
  {
    orb: 'orb_bo',
    orbName: 'Bổ',
    growth: [
      { name: 'Kiếm Căn · Bổ', description: '+3 Uy Lực mỗi cấp — nền của đường kiếm nặng.', modifier: stat('orb_bo_1', 'might', 3, 3) },
      { name: 'Bổ Cốt', description: '+3% Xuyên Kháng mỗi cấp — nhát bổ xé giáp.', modifier: stat('orb_bo_2', 'chanceToIgnoreResistance', undefined, undefined, 0.03, 0.03) },
      { name: 'Bổ Uy', description: '+2% Sát Thương Cuối mỗi cấp.', modifier: stat('orb_bo_3', 'finalDamagePercent', undefined, undefined, 0.02, 0.02) },
      { name: 'Bổ Thế', description: '+4% Sát Thương Kỹ Năng mỗi cấp.', modifier: stat('orb_bo_4', 'skillDamagePercent', undefined, undefined, 0.04, 0.04) },
      { name: 'Bổ Sát', description: '+5% Sát Thương Chí Mạng mỗi cấp.', modifier: stat('orb_bo_5', 'criticalDamage', undefined, undefined, 0.05, 0.05) },
    ],
    capstone: {
      name: 'Bổ Tâm Pháp',
      description: 'Combo chứa Bổ: gây Suy Nhược lên mục tiêu.',
      modifier: {
        minOrbCount: { orb: 'orb_bo', count: 1 },
        appliesBuff: { definitionId: 'suy_nhuoc', target: 'target' },
      },
    },
  },
  {
    orb: 'orb_hat',
    orbName: 'Hất',
    growth: [
      { name: 'Kiếm Căn · Hất', description: '+2% Tốc Độ Ra Đòn mỗi cấp — nền của đường kiếm khống chế.', modifier: stat('orb_hat_1', 'speed', undefined, undefined, 0.02, 0.02) },
      { name: 'Hất Chưởng', description: '+4% Thời Gian Dị Thường mỗi cấp — khống chế kéo dài.', modifier: stat('orb_hat_2', 'ailmentDurationPercent', undefined, undefined, 0.04, 0.04) },
      { name: 'Hất Uy', description: '+2% Hiệu Lực Dị Thường mỗi cấp.', modifier: stat('orb_hat_3', 'ailmentPotencyPercent', undefined, undefined, 0.02, 0.02) },
      { name: 'Hất Thế', description: '+2% Sát Thương Kỹ Năng mỗi cấp.', modifier: stat('orb_hat_4', 'skillDamagePercent', undefined, undefined, 0.02, 0.02) },
      { name: 'Hất Linh', description: '+2% Né Tránh mỗi cấp.', modifier: stat('orb_hat_5', 'evasionRate', undefined, undefined, 0.02, 0.02) },
    ],
    capstone: {
      name: 'Hất Tâm Pháp',
      description: 'Combo chứa Hất: gây Choáng lên mục tiêu.',
      modifier: {
        minOrbCount: { orb: 'orb_hat', count: 1 },
        appliesBuff: { definitionId: 'choang', target: 'target' },
      },
    },
  },
  {
    orb: 'orb_quet',
    orbName: 'Quét',
    growth: [
      { name: 'Kiếm Căn · Quét', description: '+2 Uy Lực mỗi cấp — nền của đường kiếm quét ngang.', modifier: stat('orb_quet_1', 'might', 2, 2) },
      { name: 'Quét Trần', description: '+2% Sát Thương Cuối mỗi cấp.', modifier: stat('orb_quet_2', 'finalDamagePercent', undefined, undefined, 0.02, 0.02) },
      { name: 'Quét Uy', description: '+3% Sát Thương Kỹ Năng mỗi cấp.', modifier: stat('orb_quet_3', 'skillDamagePercent', undefined, undefined, 0.03, 0.03) },
      { name: 'Quét Sát', description: '+2% Tỉ Lệ Chí Mạng mỗi cấp.', modifier: stat('orb_quet_4', 'criticalRate', undefined, undefined, 0.02, 0.02) },
      { name: 'Quét Phong', description: '+2% Tốc Độ Ra Đòn mỗi cấp.', modifier: stat('orb_quet_5', 'speed', undefined, undefined, 0.02, 0.02) },
    ],
    capstone: {
      name: 'Quét Tâm Pháp',
      description: 'Combo chứa Quét: +35% sát thương combo.',
      modifier: { minOrbCount: { orb: 'orb_quet', count: 1 }, bonusDamageMultiplier: 0.35 },
    },
  },
]

const ORB_NODES: ProgressionNode[] = ORB_BRANCHES.flatMap(branch => {
  const growth = branch.growth.map((spec, index) => orbGrowth(branch.orb, spec, index))
  const capstone: ProgressionNode = {
    id: `${branch.orb}_capstone`,
    name: branch.capstone.name,
    description: branch.capstone.description,
    type: 'major',
    role: 'keystone',
    insightCost: 3,
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM[branch.orb]]!.id },
      { kind: 'node', nodeId: `${branch.orb}_4` },
      { kind: 'node', nodeId: `${branch.orb}_5` },
    ],
    effect: { swordPathComboModifier: branch.capstone.modifier },
    branchTag: 'kiem_pho',
  }

  return [...growth, capstone]
})

// ─────────────────── Hidden-path root (Task 10 contract) ───────────────────


// ───────────────────────── Ngu branch ─────────────────────────

// Roll Cascade unlocks (spec §5.2) — one node per slot, realm-gated to
// the spec's ladder: a (execute) @ Truc Co, e (crit) @ Kim Dan,
// d (armor) @ Nguyen Anh. The provider reads effect.cascadeUnlock via
// collectKiemDaoCascadeUnlocks — the ids are content, not contract.
const NGU_CASCADE_NODES: ProgressionNode[] = [
  {
    id: 'ngu_cascade_a',
    name: 'Phi Kiếm · Sát',
    description: 'Mở Roll Cascade Sát: mỗi phi kiếm xử quyết mục tiêu dưới ngưỡng HP theo cảnh giới.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
    ],
    effect: { cascadeUnlock: 'a' },
    branchTag: 'ngu_kiem',
  },
  {
    id: 'ngu_cascade_e',
    name: 'Phi Kiếm · Biến',
    description: 'Mở Roll Cascade Biến: mỗi phi kiếm tự roll chí mạng.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'golden_core' },
    ],
    effect: { cascadeUnlock: 'e' },
    branchTag: 'ngu_kiem',
  },
  {
    id: 'ngu_cascade_d',
    name: 'Phi Kiếm · Phá',
    description: 'Mở Roll Cascade Phá: mỗi phi kiếm tự roll xuyên/bỏ giáp.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'nascent_soul' },
    ],
    effect: { cascadeUnlock: 'd' },
    branchTag: 'ngu_kiem',
  },
]

// Per-instance growth — every phi kiem resolves through the standard
// damage pipeline, so generic statModifiers scale every instance.
const NGU_GROWTH_NODES: ProgressionNode[] = [
  {
    id: 'ngu_kiem_sac',
    name: 'Phi Kiếm Sắc',
    description: '+3% Sát Thương Kỹ Năng mỗi cấp — mọi phi kiếm đều hưởng.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [],
    effect: { statModifiers: [stat('ngu_kiem_sac', 'skillDamagePercent', undefined, undefined, 0.03, 0.03)] },
    branchTag: 'ngu_kiem',
  },
  {
    id: 'ngu_kiem_phong',
    name: 'Phi Kiếm Phong',
    description: '+2% Xuyên Kháng mỗi cấp — phi kiếm xé giáp tốt hơn.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [],
    effect: { statModifiers: [stat('ngu_kiem_phong', 'chanceToIgnoreResistance', undefined, undefined, 0.02, 0.02)] },
    branchTag: 'ngu_kiem',
  },
  {
    id: 'ngu_kiem_sat',
    name: 'Phi Kiếm Sát Khí',
    description: '+3% Sát Thương Chí Mạng mỗi cấp — phi kiếm chí mạng đau hơn.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [],
    effect: { statModifiers: [stat('ngu_kiem_sat', 'criticalDamage', undefined, undefined, 0.03, 0.03)] },
    branchTag: 'ngu_kiem',
  },
]

// ───────────────────────── Cuu Cung 3x3 ─────────────────────────
// Spec §5.4: 8 outer palaces each grant a lump of Kiem Y (insight-costed
// + realm-gated, one per realm Luyện Khí → Đại Thừa); Trung Cung grants
// +1 kiemDaoCount and requires ALL 8 outers. Every node in the cluster
// carries kiemDaoBelowCap — at cap nothing here is purchasable, so no
// Kiem Y can pool past the sword cap (K20). Grant amounts are a first
// balance pass (~half of forgeCost at the gate realm).

const CUU_CUNG_OUTER: Array<{
  id: string
  palace: string
  realmId: string
  kiemYGrant: number
}> = [
  { id: 'cuu_cung_kham', palace: 'Khảm', realmId: 'qi_refining', kiemYGrant: 5_000 },
  { id: 'cuu_cung_khon', palace: 'Khôn', realmId: 'foundation_establishment', kiemYGrant: 6_500 },
  { id: 'cuu_cung_chan', palace: 'Chấn', realmId: 'golden_core', kiemYGrant: 8_500 },
  { id: 'cuu_cung_ton', palace: 'Tốn', realmId: 'nascent_soul', kiemYGrant: 11_000 },
  { id: 'cuu_cung_can', palace: 'Càn', realmId: 'soul_transformation', kiemYGrant: 14_500 },
  { id: 'cuu_cung_doai', palace: 'Đoài', realmId: 'void_refinement', kiemYGrant: 18_500 },
  { id: 'cuu_cung_cin', palace: 'Cấn', realmId: 'body_integration', kiemYGrant: 24_000 },
  { id: 'cuu_cung_ly', palace: 'Ly', realmId: 'mahayana', kiemYGrant: 31_000 },
]

const CUU_CUNG_NODES: ProgressionNode[] = [
  ...CUU_CUNG_OUTER.map<ProgressionNode>(palace => ({
    id: palace.id,
    name: `Cửu Cung · ${palace.palace}`,
    description: `Tụ Kiếm Ý vào cung ${palace.palace} — lập tức nhận ${palace.kiemYGrant} Kiếm Ý.`,
    type: 'minor',
    role: 'growth',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: palace.realmId },
      { kind: 'kiemDaoBelowCap' },
    ],
    effect: { kiemYGrant: palace.kiemYGrant },
    branchTag: 'ngu_kiem',
  })),
  {
    id: 'cuu_cung_trung',
    name: 'Cửu Cung · Trung Cung',
    description:
      'Tám cung hội tụ về trung ương — trực tiếp luyện thêm 1 phi kiếm (không tốn Kiếm Ý).',
    type: 'major',
    role: 'keystone',
    insightCost: 5,
    prerequisites: [
      { kind: 'nodeCount', nodeIds: CUU_CUNG_OUTER.map(p => p.id), countRequired: 8 },
      { kind: 'kiemDaoBelowCap' },
    ],
    effect: { kiemDaoGrant: 1 },
    branchTag: 'ngu_kiem',
  },
]

// M6 — path + way membership stamped at export (same pattern as
// TheTuNodes): 'sword_pathway' owns the orb branches, 'hidden_sword_pathway' owns everything in
// the hidden subtree. requiredCultivationPath is REQUIRED alongside —
// way ids are globally unique but still module-owned, so the pair
// (not the way alone) is the atomic gate. The
// hidden-sword flip node is gone; requiredWay is the only sword-way gate.
export const KIEM_TU_NODES: ProgressionNode[] = [
  ...ORB_NODES.map(node => ({
    ...node,
    requiredCultivationPath: 'sword' as const,
    requiredWay: 'sword_pathway' as const,
  })),
  ...[...NGU_CASCADE_NODES, ...NGU_GROWTH_NODES, ...CUU_CUNG_NODES].map(node => ({
    ...node,
    requiredCultivationPath: 'sword' as const,
    requiredWay: 'hidden_sword_pathway' as const,
  })),
]
