import type { ElementType } from '../element/ElementType'
import type { StatModifier } from '../stats/StatCalculator'
import type { OrbId } from '../kiem-tu/KiemTuState'
import type { TheTuKitModifierValues } from '../the-tu/TheTuKitModifiers'
import type { TheTuAnMechanicModifierValues } from '../the-tu/TheTuAnMechanicModifiers'
import type { CultivationPathId, PathWayId } from '../player/CultivationPathKit'

export type NodeType = 'minor' | 'major'

/**
 * Pháp Tu Redesign (magicpath mục 31) — điều kiện unlock 1 node, AND
 * logic (node.prerequisites là mảng, TOÀN BỘ phải thoả). Discriminated
 * union theo đúng phong cách SkillDamageComponent/TribulationPhase đã
 * có — không phải generic scripting/callback.
 */
export type NodePrerequisite =
  | { kind: 'realm'; realmId: string }
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

  unlocksSkillIds?: string[]

  // Pháp Tu Thuần Hệ (E-8, 2026-09-03) — "node biến thể": mua node là
  // CHỌN HẲN 1 specialization của 1 skill (SkillSystem.
  // selectSpecialization — wire ở GameManager.purchaseNode, effect này
  // THUẦN DATA trong NodeSystem). Data (Task 8) tự đảm bảo mutex: 2
  // node biến thể đối diện gate nhau bằng prerequisite excludesNode.
  selectsSpecialization?: { skillId: string; specializationId: string }

  // Phap Tu Reimagined (Task 6) — The-resource lane scoped to a
  // specific turn skill. NOT SkillResourceStatKey (that global runtime
  // bag would lose the skillId); aggregated per authored skill by
  // NodeSystem.aggregateTurnSkillResourceModifiers(). Values apply per
  // node level (level L contributes value x L).
  turnSkillResourceModifiers?: TurnSkillResourceModifier[]

  // Phap Tu Reimagined (Task 6) — Truong The nodes: raise the
  // battle-scoped The cap by this amount per node level. Consumed by
  // resolveMaxThe(); maxThe is never persisted on PlayerData.
  theCapPerLevel?: number

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
    // already applies the same definition the stacks MERGE (add);
    // different definitionIds COEXIST in the combo's appliesBuffs list.
    appliesBuff?: { definitionId: string; target: 'self' | 'target'; stacks?: number }
    // Adds stacks to every buff the combo carries (no-op when empty).
    bonusAilmentStacks?: number
    // Deterministic apply order — ascending, nodeId tiebreak. Default 0.
    priority?: number
  }

  // The Tu Reimagined (plan Task 6) — the ONLY node -> the_tu kit
  // channel. Each channel value is the PER-LEVEL contribution;
  // collectTheTuKitModifiers(registry, player) sums them over owned
  // levels and the participant build bakes the totals into
  // participant-local kit/buff def clones.
  theTuKitModifiers?: Partial<TheTuKitModifierValues>

  // The Tu Reimagined (plan Task 20, review P1.7) — the ONLY node ->
  // the_tu_an channel. Trunk economy channels (cap/cost/gain) plus
  // branch consequence riders (intercept ward, heavy counter payload,
  // Tro heal/cost) summed by collectTheTuAnMechanicModifiers and baked
  // into participant-local def clones by buildTheTuAnKit.
  theTuAnMechanicModifiers?: Partial<TheTuAnMechanicModifierValues>
}

/**
 * The-resource modifier for ONE authored turn skill (see NodeEffect.
 * turnSkillResourceModifiers). theGainOnLandedCast = The granted once
 * per cast that lands >=1 target; theGainOnCrit = once per crit cast.
 */
export interface TurnSkillResourceModifier {
  skillId: string

  theGainOnLandedCast?: number

  theGainOnCrit?: number
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
   * Ownership gate — the node only purchases/upgrades/aggregates for a
   * player on that cultivation path (enforced by
   * NodeSystem.nodePathApplies at purchase, upgrade, and every
   * aggregator). undefined = path-agnostic, so mortal/universal nodes
   * keep working for every path.
   */
  requiredCultivationPath?: CultivationPathId

  /**
   * Cultivation Path Framework (M3, spec 2026-09-16) — way-membership
   * gate, the branch-level sibling of requiredCultivationPath: the node
   * only purchases/upgrades/aggregates for a player whose
   * player.cultivationWay matches (enforced by NodeSystem.nodeWayApplies
   * beside nodePathApplies at purchase, upgrade, and every aggregator).
   * Path-scoped id — pair with requiredCultivationPath when the way id
   * alone is ambiguous across paths. undefined = way-agnostic, so all
   * existing (untagged) nodes keep working for every way.
   */
  requiredWay?: PathWayId

  effect: NodeEffect

  // Nhãn nhóm THUẦN HIỂN THỊ (vd 'fire', 'kiem_tu_core') — không ảnh
  // hưởng logic mua/prerequisite, chỉ để UI vẽ đúng nhánh cây.
  branchTag?: string

  // Phap Tu Reimagined — route membership: node only has effect while
  // the player's phapTu.route matches (aggregators skip inactive-route
  // nodes; INV-19 forbids shared nodes depending on route-tagged ones).
  routeTag?: 'dot' | 'no'

  // Phap Tu Reimagined — element-branch membership for the normal
  // Phap Tu tree; a node with elementTag belongs to that element's
  // branch and is purchasable only while phapTu.element matches.
  elementTag?: ElementType
}
