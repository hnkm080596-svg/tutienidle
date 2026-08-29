import type { ElementType } from '../element/ElementType'
import type { StatModifier } from '../stats/StatCalculator'
import type { SkillResourceStatKey } from '../skill/Skill'

/**
 * Skill rework (2026-08-21) — bonus nhắm THẲNG 1 field trên object
 * Skill (xem Skill.ts's SkillResourceStatKey), KHÔNG đi qua
 * StatModifier/ModifierSystem chung của nhân vật. Chỉ giữ flat/percent
 * (đủ cho mọi node hiện có — không node nào cần multiplier/stacks/
 * perLevel cho nhóm field này) — `percent` áp NGAY tại thời điểm mua
 * (nhân trực tiếp vào giá trị hiện có), do prerequisite luôn đảm bảo
 * major (cấp flat gốc) được mua TRƯỚC minor (cấp percent), xem
 * GameManager.purchaseNode().
 */
export interface SkillModifier {
  stat: SkillResourceStatKey

  flat?: number

  percent?: number

  // Node nhiều cấp (§6.1) — cộng thêm mỗi level trên mức base:
  // giá trị tại level L = flat + perLevelFlat × (L − 1).
  perLevelFlat?: number

  perLevelPercent?: number
}

export type NodeType = 'minor' | 'major'

/**
 * Pháp Tu Redesign (magicpath mục 31) — điều kiện unlock 1 node, AND
 * logic (node.prerequisites là mảng, TOÀN BỘ phải thoả). Discriminated
 * union theo đúng phong cách SkillDamageComponent/TribulationPhase đã
 * có — không phải generic scripting/callback.
 */
export type NodePrerequisite =
  | { kind: 'realm'; realmId: string }
  | { kind: 'element'; element: ElementType }
  | { kind: 'node'; nodeId: string }
  // Pháp Tu Redesign (magicpath mục 11) — "lĩnh ngộ hoàn toàn 2-3
  // nhánh": thoả khi ÍT NHẤT `countRequired` node trong `nodeIds` đã
  // mua (không cần ĐÚNG những node nào — any-N-of-M, khác `kind:
  // 'node'` vốn là AND cứng từng cái). Dùng cho unlock Phong/Lôi (cần
  // mastery node của N/M hành Ngũ Hành) hoặc bất kỳ gate "any N of M"
  // tương tự sau này — KHÔNG hard-code riêng cho Phong/Lôi.
  | { kind: 'nodeCount'; nodeIds: string[]; countRequired: number }
  // FirePath.md mục 11 — Trúc Cơ Hỏa chỉ cho kích hoạt 1 Major Path
  // (Reaction XOR Pure) tại 1 thời điểm: thoả khi `nodeId` CHƯA mua,
  // ngược hẳn `kind: 'node'`. Dùng cho 2 Major loại trừ nhau (Dẫn
  // Hỏa/Tụ Hỏa, xem data/progression/PhapTuNodes.ts) — generic, không
  // hard-code riêng cho Hỏa.
  | { kind: 'excludesNode'; nodeId: string }
  // Kiếm Tu (2026-08-28) — gate Bạt Kiếm: skill `skillId` phải đạt
  // `level` VÀ tích lũy `count` cast (đọc PlayerData.skillCastCounts,
  // mirror Skill.totalExperience — nguồn sự thật save).
  | { kind: 'skillCastCount'; skillId: string; level?: number; count?: number }

/**
 * Những gì 1 node THẬT SỰ làm khi mua — optional field, không phải
 * generic effect script (giữ đúng phong cách SkillEffect/TribulationPhase).
 * `unlocksSkillIds` dùng chung cho MỌI path (Kiếm Tu/Thể Tu không có
 * Element nên unlock nội dung qua đây, không qua `unlocksElement`) —
 * mảng vì unlock 1 hành thường cấp CẢ BỘ (3 skill chủ động + 1 nội
 * tại), không phải từng skill 1 node riêng.
 */
export interface NodeEffect {
  statModifiers?: StatModifier[]

  // Skill rework (2026-08-21) — thay cho phần statModifiers từng nhắm
  // vào 19 field "Thế tài nguyên" (hoaTheGainPerCast, thuyThePercent...)
  // — giờ ghi thẳng vào Skill instance qua `skillId`, xem
  // GameManager.purchaseNode().
  skillModifiers?: { skillId: string; statModifiers: SkillModifier[] }[]

  unlocksElement?: ElementType

  unlocksSkillIds?: string[]

  // Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 4) — on-hit
  // effect của kiếm trận: mỗi hit kiếm trận/ult TTKT roll tỉ lệ độc lập
  // theo cấp node (3%/level, max 15% ở Lv5), hiệu ứng chạy qua modifier
  // pipeline + damage engine (KiemTranOnHitSystem).
  onHitEffect?: {
    kind: OnHitEffectKind
    baseChancePercent: number
    perLevelChancePercent: number
  }
}

/** 9 loại on-hit kiếm trận (spec mục 4) — mở theo cấp trận 2→9. */
export type OnHitEffectKind =
  | 'khiem_khi_dmg'
  | 'khiem_phong_haste'
  | 'xuat_huyet_dot'
  | 'tran_tru_cc'
  | 'phan_kich_dodge'
  | 'hap_linh_leech'
  | 'pha_giap_pen'
  | 'quang_crit'
  | 'than_ngu_hanh'

/**
 * Node Tree (magicpath mục 7/30) — hạ tầng CHUNG cho mọi path (Pháp
 * Tu/Kiếm Tu/Thể Tu), mỗi path tự định nghĩa cây node riêng chạy trên
 * CÙNG type này — không tạo NodeSystem riêng cho từng path. `cost`
 * data-driven, KHÔNG suy ra tự động từ `type` (mục 30: "Cost không
 * được hard-code theo loại node").
 */
export interface ProgressionNode {
  id: string

  name: string

  description?: string

  type: NodeType

  // Node role (combat-skill-flow-element-power-dot-plan.md §6.4) —
  // semantic rõ: 'root' (mở hành, 1 cấp), 'growth' (tăng chỉ số tuyến
  // tính, 5/10 cấp), 'keystone' (đổi behavior, loại trừ keystone đối
  // diện, 1 cấp), 'specialization' (chỉ hiệu lực sau keystone cha, 5
  // cấp). Optional — node cũ không khai vẫn chạy như trước.
  role?: 'root' | 'growth' | 'keystone' | 'specialization'

  insightCost: number

  /**
   * §6.1 — số cấp tối đa (mặc định 1 → mua một lần như cũ). Level >= 1
   * nghĩa là đã lĩnh ngộ; nâng tiếp tốn cost theo `upgradeCost`.
   */
  maxLevel?: number

  /**
   * Cost theo cấp data-driven: nâng L→L+1 tốn base + floor(L / perLevel)
   * Cảm Ngộ. Power 10 cấp {1,3} → 1,1,1,2,2,2,3,3,3,4; growth/specialization
   * 5 cấp {1,2} → 1,1,2,2,3. Không khai → dùng insightCost cho mọi lần.
   */
  upgradeCost?: { base: number; perLevel: number }

  prerequisites?: NodePrerequisite[]

  effect: NodeEffect

  // Nhãn nhóm THUẦN HIỂN THỊ (vd 'fire', 'kiem_tu_core') — không ảnh
  // hưởng logic mua/prerequisite, chỉ để UI vẽ đúng nhánh cây.
  branchTag?: string
}
