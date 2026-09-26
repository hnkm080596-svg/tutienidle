import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { REALMS } from '../realms/realm'
import { ORB_UNLOCK_REALM } from '../skill/KiemPhoOrbs'

// Kiem Tu Reimagined (spec 2026-09-15 sec.6) -- the tree after the legacy
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
    // grantedOnly below makes any cost unreachable - 0 like khoi.
    insightCost: 0,
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
const ORB_NODES: ProgressionNode[] = [...DAM_BETA_NODES, ...CHEM_BETA_NODES]

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
