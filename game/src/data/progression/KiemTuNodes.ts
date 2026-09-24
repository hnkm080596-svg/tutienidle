import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { REALMS } from '../realms/realm'
import { ORB_UNLOCK_REALM } from '../skill/KiemPhoOrbs'

// Kiem Tu Reimagined (spec 2026-09-15 §6) — the tree after the legacy
// Kiem Tran / Bat Kiem retirement:
//
//   branchTag 'kiem_pho' - the KIEM PHO BETA tree (design sec.10-12,
//   docs/specs/kiem-pho-beta-spec.md): one four-role branch per beta
//   orb - Can (growth, skill-scoped per-level multiplier), Thuan Thuc
//   (skill-scoped keystone), Kiem Ket (combo modifier on the
//   completing orb), Lien Thuc (combo modifier on >=2 of that orb).
//   All stamped requiredWay 'sword_pathway' - inert and unpurchasable
//   on the ngu way. Design sec.16.A: NO statModifiers on this branch -
//   nodes modify the SKILL via effect.skillDefinitionModifiers /
//   effect.swordPathComboModifier, never the character. Bo/Hat/Quet
//   branches stay out until their design window lands.
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

// ------------- Kiem Pho Beta branches (hien way) -------------
// Design sec.10-12: one four-role branch per beta orb - Can (growth,
// per-level skill multiplier), Thuan Thuc (skill-scoped keystone),
// Kiem Ket (combo modifier keyed on the completing orb), Lien Thuc
// (combo modifier keyed on >=2 of that orb). Shape per branch:
//   Can (realm gate = the orb's own unlock realm, spec K13) ->
//   Thuan Thuc & Kiem Ket (prereq Can) ->
//   Lien Thuc (prereq Thuan Thuc + Kiem Ket).
// Predicate-based matching is the contract (no combo-id lists): the
// predicates happen to reach exactly the beta combos inside the Truc
// Co window, and stay correct when later orbs land.
const DAM_BETA_NODES: ProgressionNode[] = [
  {
    id: 'thich_can',
    name: 'Kiếm Căn · Đâm',
    description: 'Đâm +8% sát thương mỗi cấp — nền của đường kiếm đâm.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    // Same authored cap gate as the ngu growth nodes (M-QI-06
    // precedent): the last mastery level needs technique rank 4.
    levelGates: [{ atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } }],
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_dam]!.id },
    ],
    effect: {
      skillDefinitionModifiers: [
        { skillId: 'orb_dam', damageMultiplierPerLevel: 0.08 },
      ],
    },
    branchTag: 'kiem_pho',
  },
  {
    id: 'nhat_diem',
    name: 'Nhất Điểm',
    description:
      'Đâm xuyên 30% giáp trên đòn đánh của chính nó — xuyên một phần cố định, không roll xác suất.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_dam]!.id },
      { kind: 'node', nodeId: 'thich_can' },
    ],
    effect: {
      skillDefinitionModifiers: [
        { skillId: 'orb_dam', armorPierceFraction: 0.3 },
      ],
    },
    branchTag: 'kiem_pho',
  },
  {
    id: 'quy_tuyen',
    name: 'Quy Tuyến',
    description:
      'Combo kết bằng Đâm: +20% sát thương combo.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_dam]!.id },
      { kind: 'node', nodeId: 'thich_can' },
    ],
    effect: {
      swordPathComboModifier: {
        completingOrb: 'orb_dam',
        bonusDamageMultiplier: 0.2,
      },
    },
    branchTag: 'kiem_pho',
  },
  {
    id: 'lien_thich',
    name: 'Liên Thích',
    description:
      'Combo chứa ít nhất 2 Đâm: +25% sát thương combo.',
    type: 'major',
    role: 'keystone',
    insightCost: 3,
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_dam]!.id },
      { kind: 'node', nodeId: 'nhat_diem' },
      { kind: 'node', nodeId: 'quy_tuyen' },
    ],
    effect: {
      swordPathComboModifier: {
        minOrbCount: { orb: 'orb_dam', count: 2 },
        bonusDamageMultiplier: 0.25,
      },
    },
    branchTag: 'kiem_pho',
  },
]

const CHEM_BETA_NODES: ProgressionNode[] = [
  {
    id: 'tram_can',
    name: 'Kiếm Căn · Trảm',
    description: 'Chém +8% sát thương mỗi cấp — nền của đường kiếm chém.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    levelGates: [{ atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } }],
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_chem]!.id },
    ],
    effect: {
      skillDefinitionModifiers: [
        { skillId: 'orb_chem', damageMultiplierPerLevel: 0.08 },
      ],
    },
    branchTag: 'kiem_pho',
  },
  {
    id: 'thuong_tham',
    name: 'Thương Thâm',
    description:
      'Kiếm Thương do Chém gây: +25% sát thương mỗi nhịp — móc khoá trên vết thương của chính đòn đó.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_chem]!.id },
      { kind: 'node', nodeId: 'tram_can' },
    ],
    effect: {
      skillDefinitionModifiers: [
        {
          skillId: 'orb_chem',
          addAilmentInteractions: [
            {
              kind: 'add_modifier',
              buffId: 'kiem_thuong',
              modifier: {
                id: 'thuong_tham',
                channel: 'periodic_damage',
                operation: 'multiply',
                value: 1.25,
                reapply: 'max',
                priority: 0,
                lifetime: { type: 'buff_lifetime' },
              },
            },
          ],
        },
      ],
    },
    branchTag: 'kiem_pho',
  },
  {
    id: 'luu_ngan',
    name: 'Lưu Ngân',
    description:
      'Combo kết bằng Chém: Kiếm Thương cùng nguồn kéo dài thêm 1 lượt.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_chem]!.id },
      { kind: 'node', nodeId: 'tram_can' },
    ],
    effect: {
      swordPathComboModifier: {
        completingOrb: 'orb_chem',
        ailmentInteractions: [
          { kind: 'extend_duration', buffId: 'kiem_thuong', turns: 1 },
        ],
      },
    },
    branchTag: 'kiem_pho',
  },
  {
    id: 'lien_tram',
    name: 'Liên Trảm',
    description:
      'Combo chứa ít nhất 2 Chém: kích hoạt một nhịp Kiếm Thương cùng nguồn ngay lập tức.',
    type: 'major',
    role: 'keystone',
    insightCost: 3,
    prerequisites: [
      { kind: 'realm', realmId: REALMS[ORB_UNLOCK_REALM.orb_chem]!.id },
      { kind: 'node', nodeId: 'thuong_tham' },
      { kind: 'node', nodeId: 'luu_ngan' },
    ],
    effect: {
      swordPathComboModifier: {
        minOrbCount: { orb: 'orb_chem', count: 2 },
        ailmentInteractions: [
          { kind: 'trigger_periodic', buffId: 'kiem_thuong' },
        ],
      },
    },
    branchTag: 'kiem_pho',
  },
]

const ORB_NODES: ProgressionNode[] = [...DAM_BETA_NODES, ...CHEM_BETA_NODES]

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
    // M-QI-06 authored cap gate: the last mastery level needs
    // technique rank 4 (mechanism-proving set).
    levelGates: [{ atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } }],
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
    // M-QI-06 authored cap gate: the last mastery level needs
    // technique rank 4 (mechanism-proving set).
    levelGates: [{ atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } }],
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
    // M-QI-06 authored cap gate: the last mastery level needs
    // technique rank 4 (mechanism-proving set).
    levelGates: [{ atLevel: 5, prerequisite: { kind: 'techniqueRank', rank: 4 } }],
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
