import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'

// Kiếm Tu — 2 cây node (2026-08-28, xem
// .superpowers/sdd/2026-08-28-kiem-tu-tu-luc/task-5-brief.md):
//
//   Cây Kiếm Trận (branchTag 'kiem_tran') — 9 trận, mỗi trận là 1 keystone
//   unlock 1 skill chiêu trận riêng (kiem_tran_*), chain theo realm TĂNG DẦN
//   + node trận liền trước. Lưỡng Nghi (Luyện Khí) và Tam Tài (Trúc Cơ) là
//   2 trận trong-scope (đúng plan §3.5/spec §3.5); Tứ Tượng→Vô Cực CHAIN +
//   GATE đầy đủ ở data nhưng chưa cần đảm bảo reachable ở bản này (realm
//   cao hơn thực tế đã có trong game, xem data/realms/realm.ts, nên gate
//   vẫn hợp lệ — chỉ là chưa ai chơi tới đó).
//
//   Cây Bạt Kiếm (branchTag 'bat_kiem') — root `bat_kiem_an` gate bởi
//   NodeSystem prerequisite `skillCastCount` (Task 2): Huy Kiếm (`tram`)
//   đạt Lv3 VÀ tích lũy 9999 lần cast. Growth CHỈ được phép buff sát
//   thương/phòng thủ trong lúc tụ lực — TUYỆT ĐỐI không đụng tickSeconds
//   (spec §4.3): BattleSystem.updateChanneling()/setChannelTickSeconds()
//   coi tickSeconds là dữ liệu UI-driven (Task 7's slider 3-9s), KHÔNG có
//   field runtime nào cho node cộng vào — nếu cho node chỉnh trần x thì
//   phải thêm field mới vào SkillRuntimeStats.ts (core engine, ngoài phạm
//   vi task data-only này) nên growth Bạt Kiếm CHỦ ĐỘNG tránh hẳn hướng đó,
//   dùng statModifiers CHỈ NHẮM stat nhân vật CÓ THẬT — skillDamagePercent
//   (khuếch đại chính effect 'damage' của Bạt Kiếm Thuật, xem
//   StatTypes.ts's ghi chú "Kiếm Tu... % khuếch đại TOÀN BỘ effect damage
//   của skill chủ động"), wardMax/finalDamageReductionPercent/
//   ailmentResistPercent (sống sót + giảm khả năng bị Choáng/Thạch Hóa/
//   Trói Chân ngắt tụ lực giữa chừng, xem isChannelInterrupted()). Không
//   field nào trong nhóm này có thể LÀM GIẢM tickSeconds — hài hòa cả quy
//   tắc "không node giảm thời gian tụ" (constraint hard) lẫn "ưu tiên stat
//   có thật, chỉ phát minh field mới nếu bất khả kháng" (ở đây khả kháng —
//   không phát minh gì).

function stat(nodeId: string, statKey: StatModifier['stat'], flat?: number, perLevelFlat?: number): StatModifier {
  return {
    id: `node:${nodeId}:${statKey}`,
    sourceId: nodeId,
    sourceType: 'talent',
    stat: statKey,
    ...(flat !== undefined ? { flat } : {}),
    ...(perLevelFlat !== undefined ? { perLevelFlat } : {}),
  }
}

// ───────────────────────── Cây Kiếm Trận ─────────────────────────

// Exported (không chỉ dùng nội bộ file này) — Skills.ts's 9 `kiem_tran_*`
// skill entries generate THẲNG từ bảng này (Task 5 review fix, 2026-08-28)
// để tránh định nghĩa lại chuỗi id/name/realmId/swordCount lần 2.
// `skillDescription` optional — mặc định suy công thức chung, Vô Cực override
// riêng (dòng chữ khác hẳn, không phải lỗi copy-paste).
export const TRAN_SEQUENCE: Array<{
  id: string
  name: string
  realmId: string
  skillId: string
  swordCount: number
  skillDescription?: string
}> = [
  { id: 'kiem_tran_luong_nghi', name: 'Lưỡng Nghi Kiếm Trận', realmId: 'qi_refining', skillId: 'kiem_tran_luong_nghi', swordCount: 2 },
  { id: 'kiem_tran_tam_tai', name: 'Tam Tài Kiếm Trận', realmId: 'foundation_establishment', skillId: 'kiem_tran_tam_tai', swordCount: 3 },
  { id: 'kiem_tran_tu_tuong', name: 'Tứ Tượng Kiếm Trận', realmId: 'golden_core', skillId: 'kiem_tran_tu_tuong', swordCount: 4 },
  { id: 'kiem_tran_ngu_hanh', name: 'Ngũ Hành Kiếm Trận', realmId: 'nascent_soul', skillId: 'kiem_tran_ngu_hanh', swordCount: 5 },
  { id: 'kiem_tran_luc_dao', name: 'Lục Đạo Kiếm Trận', realmId: 'soul_transformation', skillId: 'kiem_tran_luc_dao', swordCount: 6 },
  { id: 'kiem_tran_that_tinh', name: 'Thất Tinh Kiếm Trận', realmId: 'void_refinement', skillId: 'kiem_tran_that_tinh', swordCount: 7 },
  { id: 'kiem_tran_bat_quai', name: 'Bát Quái Kiếm Trận', realmId: 'body_integration', skillId: 'kiem_tran_bat_quai', swordCount: 8 },
  { id: 'kiem_tran_cuu_cung', name: 'Cửu Cung Kiếm Trận', realmId: 'mahayana', skillId: 'kiem_tran_cuu_cung', swordCount: 9 },
  // swordCount + damage/ratio scaling ĐẠT TRẦN ở Cửu Cung (9 kiếm) — Vô Cực
  // (đại cảnh giới cuối) CHỦ ĐỘNG dùng lại đúng swordCount/số liệu, chỉ khác
  // biệt bằng realm gate cao hơn + flavor text riêng (vòng tròn vô tận), không
  // phải lỗi copy-paste thiếu tăng tiến — 9 thanh kiếm đã là giới hạn thiết kế.
  { id: 'kiem_tran_vo_cuc', name: 'Vô Cực Kiếm Trận', realmId: 'tribulation', skillId: 'kiem_tran_vo_cuc', swordCount: 9, skillDescription: 'Bày Vô Cực Kiếm Trận, 9 thanh phi kiếm hợp thành vòng tròn vô tận chém liên hoàn.' },
]

const KIEM_TRAN_KEYSTONES: ProgressionNode[] = TRAN_SEQUENCE.map((entry, index) => ({
  id: entry.id,
  name: entry.name,
  description: `Bày ${entry.name} — mở khoá chiêu thức ${entry.name}, dùng chung ${entry.swordCount} thanh phi kiếm.`,
  type: 'major',
  role: 'keystone',
  // Lưỡng Nghi (Luyện Khí) miễn phí — vào scope y hệt root Ngũ Hành trong
  // PhapTuNodes.ts (rootCost 0 cho hành mở sẵn lúc chọn path). Từ Tam Tài
  // trở đi tốn 2 Cảm Ngộ mỗi trận, cùng mức với keystone Trúc Cơ Pháp Tu.
  insightCost: index === 0 ? 0 : 2,
  prerequisites: [
    { kind: 'realm', realmId: entry.realmId },
    ...(index > 0 ? [{ kind: 'node' as const, nodeId: TRAN_SEQUENCE[index - 1]!.id }] : []),
  ],
  effect: { unlocksSkillIds: [entry.skillId] },
  branchTag: 'kiem_tran',
}))

// Growth phụ Kiếm Trận — gắn sau node đầu (Lưỡng Nghi) để mở sớm, chỉ dùng
// stat CÓ THẬT trong StatTypes.ts (metalPower/attackSpeed/skillDamagePercent
// — xem PhapTuNodes.ts's "power nền"/"minor_metal_heart" cho tiền lệ dùng
// đúng những field này).
const KIEM_TRAN_GROWTH: ProgressionNode[] = [
  {
    id: 'minor_tran_kim_luc',
    name: 'Trận Kim Lực',
    description: '+3 Kim Lực mỗi cấp (cấp 5 = +15).',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'kiem_tran_luong_nghi' }],
    effect: { statModifiers: [stat('minor_tran_kim_luc', 'metalPower', 3, 3)] },
    branchTag: 'kiem_tran',
  },
  {
    id: 'minor_tran_kiem_toc',
    name: 'Kiếm Tốc',
    description: '+2% Tốc Độ Ra Đòn mỗi cấp (cấp 5 = +10%).',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'kiem_tran_luong_nghi' }],
    effect: {
      statModifiers: [{
        id: 'node:minor_tran_kiem_toc:attackSpeed',
        sourceId: 'minor_tran_kiem_toc',
        sourceType: 'talent',
        stat: 'attackSpeed',
        percent: 0.02,
        perLevelPercent: 0.02,
      }],
    },
    branchTag: 'kiem_tran',
  },
  {
    id: 'minor_tran_kiem_uy',
    name: 'Kiếm Uy',
    description: '+3% Sát Thương Kỹ Năng Chủ Động mỗi cấp (cấp 5 = +15%).',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'kiem_tran_luong_nghi' }],
    effect: {
      statModifiers: [{
        id: 'node:minor_tran_kiem_uy:skillDamagePercent',
        sourceId: 'minor_tran_kiem_uy',
        sourceType: 'talent',
        stat: 'skillDamagePercent',
        percent: 0.03,
        perLevelPercent: 0.03,
      }],
    },
    branchTag: 'kiem_tran',
  },
]

// ───────────────────────── Cây Bạt Kiếm ─────────────────────────

const BAT_KIEM_ROOT: ProgressionNode = {
  id: 'bat_kiem_an',
  name: 'Bạt Kiếm Ấn',
  description:
    'Lĩnh ngộ Bạt Kiếm Ấn sau khi Huy Kiếm đạt cấp 3 và tích lũy đủ 9999 lần xuất chiêu — mở khoá Bạt Kiếm Thuật.',
  type: 'major',
  role: 'root',
  insightCost: 2,
  prerequisites: [{ kind: 'skillCastCount', skillId: 'tram', level: 3, count: 9999 }],
  effect: { unlocksSkillIds: ['bat_kiem_thuat'] },
  branchTag: 'bat_kiem',
}

const BAT_KIEM_GROWTH: ProgressionNode[] = [
  {
    id: 'minor_bat_kiem_uy',
    name: 'Bạt Kiếm Uy',
    description: '+3% Sát Thương Kỹ Năng Chủ Động mỗi cấp (cấp 5 = +15%) — khuếch đại thẳng Bạt Kiếm Thuật.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'bat_kiem_an' }],
    effect: {
      statModifiers: [{
        id: 'node:minor_bat_kiem_uy:skillDamagePercent',
        sourceId: 'minor_bat_kiem_uy',
        sourceType: 'talent',
        stat: 'skillDamagePercent',
        percent: 0.03,
        perLevelPercent: 0.03,
      }],
    },
    branchTag: 'bat_kiem',
  },
  {
    id: 'minor_bat_kiem_ho_the',
    name: 'Bạt Kiếm Hộ Thể',
    description: '+20 Hộ Thuẫn tối đa mỗi cấp (cấp 5 = +100) — trụ vững trong lúc tụ lực.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'bat_kiem_an' }],
    effect: { statModifiers: [stat('minor_bat_kiem_ho_the', 'wardMax', 20, 20)] },
    branchTag: 'bat_kiem',
  },
  {
    id: 'minor_bat_kiem_kien_nhan',
    name: 'Bạt Kiếm Kiên Nhẫn',
    description: '+3% Kháng Dị Thường mỗi cấp (cấp 5 = +15%) — khó bị Choáng/Thạch Hóa/Trói Chân ngắt tụ lực hơn.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'bat_kiem_an' }],
    effect: {
      statModifiers: [{
        id: 'node:minor_bat_kiem_kien_nhan:ailmentResistPercent',
        sourceId: 'minor_bat_kiem_kien_nhan',
        sourceType: 'talent',
        stat: 'ailmentResistPercent',
        percent: 0.03,
        perLevelPercent: 0.03,
      }],
    },
    branchTag: 'bat_kiem',
  },
  {
    id: 'minor_bat_kiem_kien_nhan_2',
    name: 'Bạt Kiếm Bất Động',
    description: '+2% Giảm Sát Thương Cuối mỗi cấp (cấp 5 = +10%) — chịu đòn tốt hơn trong lúc đứng yên tụ lực.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'bat_kiem_an' }],
    effect: {
      statModifiers: [{
        id: 'node:minor_bat_kiem_kien_nhan_2:finalDamageReductionPercent',
        sourceId: 'minor_bat_kiem_kien_nhan_2',
        sourceType: 'talent',
        stat: 'finalDamageReductionPercent',
        percent: 0.02,
        perLevelPercent: 0.02,
      }],
    },
    branchTag: 'bat_kiem',
  },
]

// Keystone — "bật chế độ đường Bạt Kiếm" (Task 6 dùng getNodeLevel(player,
// 'bat_kiem_thuc') >= 1 làm gate route-switch, xem task-5-brief.md's ruling
// pre-flight). Bản thân node này KHÔNG unlock skill nào thêm (đã unlock ở
// root) — chỉ đóng vai trò cột mốc/gate UI thuần túy.
const BAT_KIEM_KEYSTONE: ProgressionNode = {
  id: 'bat_kiem_thuc',
  name: 'Bạt Kiếm Thức',
  description: 'Đại thành Bạt Kiếm Thức — chính thức khai mở đường lối chiến đấu Bạt Kiếm.',
  type: 'major',
  role: 'keystone',
  insightCost: 2,
  prerequisites: [
    { kind: 'node', nodeId: 'bat_kiem_an' },
    { kind: 'node', nodeId: 'minor_bat_kiem_uy' },
  ],
  effect: { unlocksSkillIds: [] },
  branchTag: 'bat_kiem',
}

export const KIEM_TU_NODES: ProgressionNode[] = [
  ...KIEM_TRAN_KEYSTONES,
  ...KIEM_TRAN_GROWTH,
  BAT_KIEM_ROOT,
  ...BAT_KIEM_GROWTH,
  BAT_KIEM_KEYSTONE,
]

/** Số kiếm của trận theo skillId (Lưỡng Nghi 2 → Cửu Cung 9) — dùng
 * cho gain Kiếm Thế mỗi cast (spec 2026-08-29-kiem-the-kiem-y mục 2);
 * skillId không thuộc chuỗi trận → undefined. */
export function getFormationSwordCount(skillId: string): number | undefined {
  return TRAN_SEQUENCE.find((entry) => entry.skillId === skillId)?.swordCount
}
