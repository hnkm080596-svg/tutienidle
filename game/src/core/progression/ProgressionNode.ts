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
}

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

  insightCost: number

  prerequisites?: NodePrerequisite[]

  effect: NodeEffect

  // Nhãn nhóm THUẦN HIỂN THỊ (vd 'fire', 'kiem_tu_core') — không ảnh
  // hưởng logic mua/prerequisite, chỉ để UI vẽ đúng nhánh cây.
  branchTag?: string
}
