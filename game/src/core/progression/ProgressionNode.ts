import type { ElementType } from '../element/ElementType'
import type { StatModifier } from '../stats/StatCalculator'
import type { SkillResourceStatKey } from '../skill/Skill'
import type { OrbId } from '../kiem-tu/KiemTuState'

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
  // Kiem Tu Reimagined (spec K20) — Cuu Cung preflight: holds only while
  // the player is in ngu mode AND kiemDaoCount < kiemDaoCap(realmIndex).
  // Evaluated inside canPurchaseNode, so a capped sword pool blocks the
  // purchase BEFORE insight is deducted — including the Y-grant outer
  // nodes (no Y may accumulate past cap).
  | { kind: 'kiemDaoBelowCap' }

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

  // Pháp Tu Thuần Hệ (E-8, 2026-09-03) — "node biến thể": mua node là
  // CHỌN HẲN 1 specialization của 1 skill (SkillSystem.
  // selectSpecialization — wire ở GameManager.purchaseNode, effect này
  // THUẦN DATA trong NodeSystem). Data (Task 8) tự đảm bảo mutex: 2
  // node biến thể đối diện gate nhau bằng prerequisite excludesNode.
  selectsSpecialization?: { skillId: string; specializationId: string }

  // Kiem Tu Reimagined (spec 2026-09-15 K4) — purchasing flips
  // player.kiemTu.mode (one-way hien → ngu). The wire lives in
  // GameManagerProgressionOps.purchaseNode; mode-switch nodes are
  // non-refundable and devResetBranch skips them.
  kiemTuModeSwitch?: 'ngu'

  // Kiem Tu Reimagined (spec §6, Cuu Cung) — lump Kiem Y granted ONCE
  // at purchase through gainKiemY() (the domain owner — conversion and
  // the cap rule live there; nodes never touch player.kiemTu).
  kiemYGrant?: number

  // Kiem Tu Reimagined (spec §5.4, Trung Cung) — direct +N kiemDaoCount
  // at purchase through grantKiemDao() (clamped at the realm cap; the
  // kiemDaoBelowCap prereq should already have blocked a capped buy).
  kiemDaoGrant?: number

  // Kiem Tu Reimagined (spec §5.2 Roll Cascade) — purchasing unlocks
  // one cascade slot; the Ngu provider reads these via
  // collectKiemDaoCascadeUnlocks (effect-driven — node id is free).
  cascadeUnlock?: 'a' | 'e' | 'd'

  // Kiem Tu Reimagined (spec §4.2) — DATA form of a combo capstone.
  // KiemPhoNodeModifiers converts purchased nodes carrying this field
  // into KiemPhoComboModifier hooks at battle-build time; it is the
  // ONLY channel through which a node may alter a combo.
  kiemTuComboModifier?: {
    // matches(combo): combo pattern contains >= count of `orb`.
    minOrbCount: { orb: OrbId; count: number }
    // Multiplies the combo's bonus damage by (1 + x) — no-op on
    // damage-less combos.
    bonusDamageMultiplier?: number
    // Attaches a buff/ailment application to the combo; if the combo
    // already applies the same definition the stacks MERGE (add).
    appliesBuff?: { definitionId: string; target: 'self' | 'target'; stacks?: number }
    // Adds stacks to the combo's existing appliesBuff (no-op without one).
    bonusAilmentStacks?: number
    // Deterministic apply order — ascending, nodeId tiebreak. Default 0.
    priority?: number
  }
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

  /**
   * Kiem Tu Reimagined (spec K2) — display gate for hidden nodes: the
   * node does not RENDER in the tree until this prereq holds, AND
   * canPurchaseNode re-checks it (a hidden node is never purchasable
   * before reveal). Evaluated through the same hasPrerequisite() as
   * `prerequisites` — no new machinery.
   */
  revealWhen?: NodePrerequisite

  /**
   * Kiem Tu Reimagined — the mode this node's effects belong to.
   * Aggregators skip nodes whose kiemTuMode does not match
   * player.kiemTu.mode (a hien orb node grants nothing while ngu, and
   * vice versa). undefined = mode-agnostic.
   */
  kiemTuMode?: 'hien' | 'ngu'

  effect: NodeEffect

  // Nhãn nhóm THUẦN HIỂN THỊ (vd 'fire', 'kiem_tu_core') — không ảnh
  // hưởng logic mua/prerequisite, chỉ để UI vẽ đúng nhánh cây.
  branchTag?: string
}
