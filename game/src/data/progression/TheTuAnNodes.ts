import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'

// The Tu Reimagined (spec 2026-09-15 section 8.2, plan Task 20) — the
// hidden the_tu_an tree: a shared stat + The-economy trunk feeding
// three NON-MUTEX roots (ho_mon / phan_mon / tro_mon, T9). One
// branchTag 'the_tu_an' renders the whole tree in a single view.
//
// Path gate: same convention as sibling trees — path gating lives at
// the offer layer (ritual in CultivationPathKit); realm gates are data:
// roots + trunk open at qi_refining, deeper nodes gate
// foundation_establishment (beta content bound, spec section 11).
//
// Delivery channels (only these exist — A8, no invented riders):
//   - statModifiers: attribute stats only (vit/dex/str/int — universal,
//     untagged domain). Chance stats are NEVER authored here (INV-13 —
//     the the_tu_an attribute deriver is the only source of
//     protectChance/counterChance/followUpChance).
//   - effect.theTuAnMechanicModifiers: numeric channels summed by
//     collectTheTuAnMechanicModifiers and baked into participant-local
//     marker/payload clones by buildTheTuAnKit. Trunk economy channels
//     (cap/cost/gain) feed ALL three branches; branch channels are
//     consequence riders only — never probability.

function stat(nodeId: string, statKey: StatModifier['stat'], flat: number, perLevelFlat: number): StatModifier {
  return {
    id: `node:${nodeId}:${statKey}`,
    sourceId: nodeId,
    sourceType: 'talent',
    stat: statKey,
    flat,
    perLevelFlat,
  }
}

const GROWTH_5 = { base: 1, perLevel: 2 } // 1,1,2,2,3 — sibling growth convention.

// ---------------- Trunk (qi_refining) ----------------

const TRUNK_QI: ProgressionNode[] = [
  {
    id: 'minor_ung_the_the_chat',
    name: 'Ứng Thế',
    description: '+3 Thể Chất mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [stat('minor_ung_the_the_chat', 'vitality', 3, 3)] },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_than_phap',
    name: 'Ẩn Thân Pháp',
    description: '+3 Thân Pháp mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [stat('minor_ung_the_than_phap', 'dexterity', 3, 3)] },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_can_cot',
    name: 'Ẩn Căn Cốt',
    description: '+3 Căn Cốt mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [stat('minor_ung_the_can_cot', 'strength', 3, 3)] },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_linh_tri',
    name: 'Ẩn Linh Trí',
    description: '+3 Linh Trí mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { statModifiers: [stat('minor_ung_the_linh_tri', 'intelligence', 3, 3)] },
    branchTag: 'the_tu_an',
  },
  // Economy trunk — feeds all three branches (spec 8.2). cap first.
  {
    id: 'minor_ung_the_bi_the',
    name: 'Bí Thế',
    description: '+10 Thế tối đa mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { theTuAnMechanicModifiers: { maxTheBonus: 10 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_tinh_the',
    name: 'Tĩnh Thế',
    description: 'Kiểm tra phản ứng rẻ hơn 1 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { theTuAnMechanicModifiers: { procCostDelta: -1 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_hoi_the',
    name: 'Hồi Thế',
    description: 'Phản ứng thành công thu thêm +2 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
    effect: { theTuAnMechanicModifiers: { procGainBonus: 2 } },
    branchTag: 'the_tu_an',
  },
]

const TRUNK_FOUNDATION: ProgressionNode[] = [
  {
    id: 'minor_ung_the_tuc_the',
    name: 'Túc Thế',
    description: 'Né đòn thu thêm +1 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'foundation_establishment' }],
    effect: { theTuAnMechanicModifiers: { evadeGainBonus: 1 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_nap_the',
    name: 'Nạp Thế',
    description: 'Trúng đòn thu thêm +1 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'foundation_establishment' }],
    effect: { theTuAnMechanicModifiers: { takenGainBonus: 1 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_hap_the',
    name: 'Hấp Thế',
    description: 'Đòn thường trúng thu thêm +1 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'foundation_establishment' }],
    effect: { theTuAnMechanicModifiers: { basicGainBonus: 1 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ung_the_chu_the',
    name: 'Chu Thế',
    description: 'Mỗi vòng thu thêm +1 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'realm', realmId: 'foundation_establishment' }],
    effect: { theTuAnMechanicModifiers: { roundGainBonus: 1 } },
    branchTag: 'the_tu_an',
  },
]

// ---------------- Roots (non-mutex, T9) ----------------
// Each root's purchase plants its mechanic marker at battle build via
// buildTheTuAnKit (getNodeLevel read). effect:{} — the root IS the
// mechanic; consequences live in branch nodes.

const HO_ROOT: ProgressionNode = {
  id: 'ho_mon',
  name: 'Hộ Môn',
  description: 'Nhập môn Hộ — đón thay đòn cho đồng đội: đòn đơn mục tiêu của địch có thể bị chặn lại bởi người gần nhất.',
  type: 'major',
  role: 'root',
  insightCost: 0,
  prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
  effect: {},
  branchTag: 'the_tu_an',
}

const PHAN_ROOT: ProgressionNode = {
  id: 'phan_mon',
  name: 'Phản Môn',
  description: 'Nhập môn Phản — trúng đòn hoặc né đòn đều có thể phản kích lại kẻ ra tay.',
  type: 'major',
  role: 'root',
  insightCost: 0,
  prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
  effect: {},
  branchTag: 'the_tu_an',
}

const TRO_ROOT: ProgressionNode = {
  id: 'tro_mon',
  name: 'Trợ Môn',
  description: 'Nhập môn Trợ — theo sau hành động trúng đòn của đồng đội bằng một đòn đánh theo.',
  type: 'major',
  role: 'root',
  insightCost: 0,
  prerequisites: [{ kind: 'realm', realmId: 'qi_refining' }],
  effect: {},
  branchTag: 'the_tu_an',
}

// ---------------- Ho branch ----------------

const HO_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_ho_the_tich',
    name: 'Hộ Thế Tích',
    description: 'Đón thay thành công thu thêm +4 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'ho_mon' }],
    effect: { theTuAnMechanicModifiers: { interceptTheGainBonus: 4 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_ho_the_can',
    name: 'Hộ Thể Căn',
    description: '+4 Thể Chất mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'ho_mon' }],
    effect: { statModifiers: [stat('minor_ho_the_can', 'vitality', 4, 4)] },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_ho_bi',
    name: 'Hộ Bích',
    description: 'Đón thay thành công: đồng đội được che chắn nhận lớp giáp ngoài bằng 15% Sinh Mệnh Tối Đa của người hộ.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'ho_mon' },
    ],
    effect: { theTuAnMechanicModifiers: { interceptWardRatio: 0.15 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_ho_bi_thanh',
    name: 'Hộ Bích Thành',
    description: 'Hộ Bích dày thêm: lớp giáp ngoài khi đón thay tăng thêm +10% Sinh Mệnh Tối Đa của người hộ.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'major_ho_bi' },
    ],
    effect: { theTuAnMechanicModifiers: { interceptWardRatio: 0.1 } },
    branchTag: 'the_tu_an',
  },
]

// ---------------- Phan branch ----------------

const PHAN_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_phan_than_phap',
    name: 'Phản Thân Pháp',
    description: '+4 Thân Pháp mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'phan_mon' }],
    effect: { statModifiers: [stat('minor_phan_than_phap', 'dexterity', 4, 4)] },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_phan_pha_the',
    name: 'Phản Phá Thế',
    description: 'Phản Kích có thêm +8% tỉ lệ gây Choáng mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'phan_mon' }],
    effect: { theTuAnMechanicModifiers: { counterChoangChance: 0.08 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_phan_trong_kich',
    name: 'Trọng Phản Kích',
    description: 'Phản sau khi né đòn trở thành Trọng Phản Kích: đòn phản nặng hơn (+60% sát thương).',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'phan_mon' },
    ],
    effect: { theTuAnMechanicModifiers: { evadeCounterMultiplierBonus: 0.6 } },
    branchTag: 'the_tu_an',
  },
]

// ---------------- Tro branch ----------------

const TRO_BRANCH: ProgressionNode[] = [
  {
    id: 'minor_tro_than_phap',
    name: 'Trợ Thân Pháp',
    description: '+4 Thân Pháp mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'tro_mon' }],
    effect: { statModifiers: [stat('minor_tro_than_phap', 'dexterity', 4, 4)] },
    branchTag: 'the_tu_an',
  },
  {
    id: 'minor_tro_tiet_the',
    name: 'Trợ Tiết Thế',
    description: 'Kiểm tra Trợ rẻ hơn 2 Thế mỗi cấp.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: GROWTH_5,
    prerequisites: [{ kind: 'node', nodeId: 'tro_mon' }],
    effect: { theTuAnMechanicModifiers: { troCostDelta: -2 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_tro_hoi_nguyen',
    name: 'Trợ Hồi Nguyên',
    description: 'Trợ thành công: đồng đội vừa ra tay hồi 15% Sinh Mệnh Tối Đa.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'tro_mon' },
    ],
    effect: { theTuAnMechanicModifiers: { troHealTriggeringAllyRatio: 0.15 } },
    branchTag: 'the_tu_an',
  },
  {
    id: 'major_tro_van_ung',
    name: 'Trợ Vạn Ứng',
    description: 'Trợ có thể theo sau MỌI hành động của đồng đội, kể cả hành động không gây sát thương.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'realm', realmId: 'foundation_establishment' },
      { kind: 'node', nodeId: 'tro_mon' },
    ],
    effect: { theTuAnMechanicModifiers: { troAnyAction: 1 } },
    branchTag: 'the_tu_an',
  },
]

export const THE_TU_AN_NODES: ProgressionNode[] = [
  ...TRUNK_QI,
  ...TRUNK_FOUNDATION,
  HO_ROOT,
  ...HO_BRANCH,
  PHAN_ROOT,
  ...PHAN_BRANCH,
  TRO_ROOT,
  ...TRO_BRANCH,
]
