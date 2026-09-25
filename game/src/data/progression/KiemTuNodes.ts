import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import type { OrbId } from '../../core/kiem-tu/KiemTuState'
import { REALMS } from '../realms/realm'
import { ORB_UNLOCK_REALM } from '../skill/KiemPhoOrbs'

// Kiem Tu Reimagined (spec 2026-09-15 sec.6) -- the tree after the legacy
// Kiem Tran / Bat Kiem retirement:
//
//   branchTag 'kiem_pho' -- 5 orb branches (hien way). Each branch: 5
//   growth nodes realm-gated to the orb's own unlock realm (spec K13)
//   + 1 keystone capstone carrying effect.swordPathComboModifier -- the
//   ONLY channel a node may alter a combo (spec sec.4.2). All stamped
//   requiredWay 'sword_pathway' -- inert and unpurchasable on the ngu way.
//
//   branchTag 'ngu_kiem' -- the ngu way subtree (Cultivation Path
//   Framework M6: way membership replaces the retired kiem_tu_an flip
//   node -- entry is ritual-only now). Ngu Kiem Beta: the subtree is
//   ONE vertical accumulation spine -- one evolution node per realm
//   tier (Khoi granted at the ritual, Lien purchasable at Truc Co,
//   plus a sealed '???' placeholder for the next tier). Chained node
//   prereqs render the spine automatically inside the shared
//   NodeTreePanel; old evolutions stay active once owned.
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

// ------------------- Orb branches (hien) -------------------

interface OrbGrowthSpec {
  name: string
  description: string
  modifier: StatModifier
}

interface OrbBranchSpec {
  orb: OrbId
  orbName: string
  growth: [
    OrbGrowthSpec, // [0] is the branch root -- realm gate only
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

// ----------------- Ngu branch -- evolution spine -----------------

// Ngu Kiem Beta (design sec.7/sec.52) -- the hidden way's ONLY nodes:
// one vertical accumulation spine, one single-level evolution node per
// realm tier. Chained 'node' prereqs make NodeTreePanel depth-group them
// vertically (the spine) -- no dedicated view needed. effect.evolutionId
// is the DATA marker the provider collects (combat stays node-agnostic);
// the sealed '???' placeholder carries no effect so an owned tier never
// resolves a mechanic it has no design for.
export const NGU_KIEM_EVOLUTION_NODE_IDS = [
  'ngu_kiem_khoi',
  'ngu_kiem_lien',
  'ngu_kiem_phong_an',
] as const

const NGU_EVOLUTION_NODES: ProgressionNode[] = [
  {
    id: 'ngu_kiem_khoi',
    name: 'Ngự Kiếm · Khởi',
    description:
      'Trước: chưa có phi kiếm. Sau: mỗi Kiếm Đạo triệu hồi một phi kiếm — mỗi kiếm một đòn đánh độc lập theo thứ tự.',
    type: 'major',
    role: 'keystone',
    insightCost: 0,
    maxLevel: 1,
    // Granted at the Initiation Ritual (way.grantedNodeIds) -- never
    // purchasable (design sec.28/sec.50).
    grantedOnly: true,
    effect: { evolutionId: 'khoi' },
    branchTag: 'ngu_kiem',
  },
  {
    id: 'ngu_kiem_lien',
    name: 'Ngự Kiếm · Liên',
    description:
      'Trước: mỗi phi kiếm đánh độc lập, không cộng dồn. Sau: phi kiếm trúng tích Kiếm Thế — kiếm sau trong cùng một lần xuất kiếm mạnh hơn theo số kiếm đã trúng.',
    type: 'major',
    role: 'keystone',
    insightCost: 3,
    maxLevel: 1,
    prerequisites: [
      { kind: 'node', nodeId: 'ngu_kiem_khoi' },
      { kind: 'realm', realmId: 'foundation_establishment' },
    ],
    effect: { evolutionId: 'lien' },
    branchTag: 'ngu_kiem',
  },
  {
    // Sealed '???' placeholder for the next tier (design: future realms
    // may show sealed slots on the spine). prereq realm golden_core
    // puts it permanently out of reach inside the beta ceiling -- it
    // renders locked forever. Fresh id: the retired 'ngu_kiem_phong'
    // stat node shipped at v84, so reusing that id would rebind owned
    // levels in live saves to a no-op placeholder.
    id: 'ngu_kiem_phong_an',
    name: '???',
    description: 'Tầng tiếp theo của Ngự Kiếm — chưa mở.',
    type: 'major',
    role: 'keystone',
    insightCost: 3,
    maxLevel: 1,
    prerequisites: [
      { kind: 'node', nodeId: 'ngu_kiem_lien' },
      { kind: 'realm', realmId: 'golden_core' },
    ],
    // F-NK-INT-16: grantedOnly so the sealed '???' node can never be
    // bought for Insight (empty effect would make any purchase a pure
    // trap) - the golden_core prereq alone cannot keep it locked once
    // the realm ladder reaches that realm.
    grantedOnly: true,
    effect: {},
    branchTag: 'ngu_kiem',
  },
]

// M6 -- path + way membership stamped at export (same pattern as
// TheTuNodes): 'sword_pathway' owns the orb branches, 'hidden_sword_pathway' owns everything in
// the hidden subtree. requiredCultivationPath is REQUIRED alongside --
// way ids are globally unique but still module-owned, so the pair
// (not the way alone) is the atomic gate. The
// hidden-sword flip node is gone; requiredWay is the only sword-way gate.
export const KIEM_TU_NODES: ProgressionNode[] = [
  ...ORB_NODES.map(node => ({
    ...node,
    requiredCultivationPath: 'sword' as const,
    requiredWay: 'sword_pathway' as const,
  })),
  ...NGU_EVOLUTION_NODES.map(node => ({
    ...node,
    requiredCultivationPath: 'sword' as const,
    requiredWay: 'hidden_sword_pathway' as const,
  })),
]
