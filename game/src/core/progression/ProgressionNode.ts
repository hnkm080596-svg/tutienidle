import type { ElementType } from '../element/ElementType'
import type { StatModifier } from '../stats/StatCalculator'
import type { OrbId } from '../kiem-tu/KiemTuState'
import type { BodyKitModifierValues } from '../the-tu/TheTuKitModifiers'
import type { HiddenBodyMechanicModifierValues } from '../the-tu/TheTuAnMechanicModifiers'
import type { CultivationPathId, CultivationWayId } from '../player/CultivationPathKit'

export type NodeType = 'minor' | 'major'

/**
 * Phap Tu Redesign (magicpath sec.31) - unlock conditions for a node, AND
 * logic (node.prerequisites is an array, ALL must hold). Discriminated
 * union in the established SkillDamageComponent/TribulationPhase style -
 * not generic scripting/callbacks.
 */
export type NodePrerequisite =
  | { kind: 'realm'; realmId: string }
  | { kind: 'node'; nodeId: string }
  // Phap Tu Redesign (magicpath sec.11) - "fully purchase 2-3
  // branches": satisfied when AT LEAST `countRequired` nodes in `nodeIds` are
  // purchased (does not require EXACTLY those nodes - any-N-of-M, unlike `kind:
  // 'node'` which is a hard AND on each). Used for Wind/Lightning unlocks
  // (needs mastery nodes of N/M Five-Element paths) or any "any N of M"
  // gate of the same shape later - NOT hard-coded for Wind/Lightning only.
  | { kind: 'nodeCount'; nodeIds: string[]; countRequired: number }
  // FirePath.md sec.11 - Truc Co Hoa allows activating only 1 Major Path
  // (Reaction XOR Pure) at a time: satisfied while `nodeId` is NOT purchased,
  // the exact inverse of `kind: 'node'`. Used for 2 mutually-exclusive Majors
  // (Dan Hoa/Tu Hoa, see data/progression/PhapTuNodes.ts) - generic, not
  // hard-coded for Fire only.
  | { kind: 'excludesNode'; nodeId: string }
  // Kiem Tu (2026-08-28) - Bat Kiem gate: skill `skillId` must reach
  // `level` AND accumulate `count` casts (reads PlayerData.skillCastCounts,
  // the save source of truth).
  | { kind: 'skillCastCount'; skillId: string; level?: number; count?: number }
  // Kiem Tu Reimagined (spec K20) - Cuu Cung preflight: holds only while
  // the player is in hidden_sword_pathway mode AND kiemDaoCount < kiemDaoCap(realmIndex).
  // Evaluated inside canPurchaseNode, so a capped sword pool blocks the
  // purchase BEFORE insight is deducted - including the Y-grant outer
  // nodes (no Y may accumulate past cap).
  | { kind: 'kiemDaoBelowCap' }
  // P7-M6 - technique-gated prerequisites. `>=` threshold semantics like
  // kind:'realm' (progression gate, purchase-only - a bought node stays
  // bought even though advanceTechniqueGrade resets rank to 0). Reads
  // the read-only mirror player.techniqueProgress; absent mirror fails
  // closed for any positive requirement. No authored gates yet.
  | { kind: 'techniqueRank'; rank: number }
  | { kind: 'techniqueGrade'; grade: number }

/**
 * What a node ACTUALLY does when purchased - optional field, not a
 * generic effect script (keeps the SkillEffect/TribulationPhase style).
 * `unlocksSkillIds` is shared by EVERY path (Kiem Tu/The Tu have no
 * Element so they unlock content through this, not `unlocksElement`) -
 * an array because unlocking one element usually grants the WHOLE kit
 * (3 active skills + 1 passive), not one skill per node.
 */
export interface NodeEffect {
  statModifiers?: StatModifier[]

  unlocksSkillIds?: string[]

  // Phap Tu Thuan He (E-8, 2026-09-03) - "variant node": purchasing is
  // CHOOSING exactly 1 specialization of 1 skill (SkillSystem.
  // selectSpecialization - wired in GameManager.purchaseNode; this effect
  // stays PURE DATA in NodeSystem). The data (Task 8) guarantees mutex:
  // 2 opposing variant nodes gate each other via excludesNode prerequisites.
  selectsSpecialization?: { skillId: string; specializationId: string }

  // Phap Tu Reimagined (Task 6) - The-resource lane scoped to a
  // specific turn skill. NOT SkillResourceStatKey (that global runtime
  // bag would lose the skillId); aggregated per authored skill by
  // NodeSystem.aggregateTurnSkillResourceModifiers(). Values apply per
  // node level (level L contributes value x L).
  turnSkillResourceModifiers?: TurnSkillResourceModifier[]

  // Phap Tu Reimagined (Task 6) - Truong The nodes: raise the
  // battle-scoped The cap by this amount per node level. Consumed by
  // resolveMaxThe(); maxThe is never persisted on PlayerData.
  theCapPerLevel?: number

  // Kiem Tu Reimagined (spec sec.6, Cuu Cung) - lump Kiem Y granted ONCE
  // at purchase through gainKiemY() (the domain owner - conversion and
  // the cap rule live there; nodes never touch player.swordPath).
  kiemYGrant?: number

  // Kiem Tu Reimagined (spec sec.5.4, Trung Cung) - direct +N kiemDaoCount
  // at purchase through grantKiemDao() (clamped at the realm cap; the
  // kiemDaoBelowCap prereq should already have blocked a capped buy).
  kiemDaoGrant?: number

  // Kiem Tu Reimagined (spec sec.5.2 Roll Cascade) - purchasing unlocks
  // one cascade slot; the Ngu provider reads these via
  // collectKiemDaoCascadeUnlocks (effect-driven - node id is free).
  cascadeUnlock?: 'a' | 'e' | 'd'

  // Kiem Tu Reimagined (spec sec.4.2) - DATA form of a combo capstone.
  // KiemPhoNodeModifiers converts purchased nodes carrying this field
  // into KiemPhoComboModifier hooks at battle-build time; it is the
  // ONLY channel through which a node may alter a combo.
  swordPathComboModifier?: {
    // matches(combo): combo pattern contains >= count of `orb`.
    minOrbCount: { orb: OrbId; count: number }
    // Multiplies the combo's bonus damage by (1 + x) - no-op on
    // damage-less combos.
    bonusDamageMultiplier?: number
    // Attaches a buff/ailment application to the combo; if the combo
    // already applies the same definition the stacks MERGE (add);
    // different definitionIds COEXIST in the combo's appliesBuffs list.
    appliesBuff?: { definitionId: string; target: 'self' | 'target'; stacks?: number }
    // Adds stacks to every buff the combo carries (no-op when empty).
    bonusAilmentStacks?: number
    // Deterministic apply order - ascending, nodeId tiebreak. Default 0.
    priority?: number
  }

  // The Tu Reimagined (plan Task 6) - the ONLY node -> body kit
  // channel. Each channel value is the PER-LEVEL contribution;
  // collectBodyKitModifiers(registry, player) sums them over owned
  // levels and the participant build bakes the totals into
  // participant-local kit/buff def clones.
  bodyKitModifiers?: Partial<BodyKitModifierValues>

  // The Tu Reimagined (plan Task 20, review P1.7) - the ONLY node ->
  // hidden_body channel. Trunk economy channels (cap/cost/gain) plus
  // branch consequence riders (intercept ward, heavy counter payload,
  // Tro heal/cost) summed by collectHiddenBodyMechanicModifiers and baked
  // into participant-local def clones by buildTheTuAnKit.
  hiddenBodyMechanicModifiers?: Partial<HiddenBodyMechanicModifierValues>

  // M-QI-05 / QI-D3 - skill ids whose Core Nodes this node grants at
  // purchase (kit-root seam, `unlocksSkillIds`-style). Ops-layer
  // preflights every member's registered core BEFORE spending; the
  // granted cores revoke (with spent-Insight refund) when this node's
  // ownership is removed by any path.
  grantsSkillCoreIds?: readonly string[]
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
 * Node Tree (magicpath sec.7/30) - SHARED infrastructure for every path
 * (Phap Tu/Kiem Tu/The Tu); each path defines its own node tree on top of
 * this SAME type - no per-path NodeSystem. `cost` is data-driven, NOT
 * derived automatically from `type` (sec.30: "Cost must not be hard-coded
 * by node kind").
 */
export interface ProgressionNode {
  id: string

  name: string

  description?: string

  type: NodeType

  // Node role (combat-skill-flow-element-power-dot-plan.md sec.6.4) -
  // semantic intent: 'root' (opens an element, 1 level), 'growth' (linear stat
  // gain, 5/10 levels), 'keystone' (changes behavior, mutually-exclusive with
  // opposing keystone, 1 level), 'specialization' (effect after parent keystone,
  // 5 levels). Optional - legacy nodes without it behave as before.
  role?: 'root' | 'growth' | 'keystone' | 'specialization'

  insightCost: number

  /**
     * sec.6.1 - max level count (default 1 -> one-shot purchase as before).
     * Level >= 1 means purchased; further upgrades cost per `upgradeCost`.
     */
  maxLevel?: number

  /**
     * Data-driven per-level cost: upgrading L->L+1 costs base +
     * floor(L / perLevel) Insight. Power 10 levels {1,3} ->
     * 1,1,1,2,2,2,3,3,3,4; growth/specialization 5 levels {1,2} -> 1,1,2,2,3.
     * Not declared -> insightCost applies to every purchase.
     */
  upgradeCost?: { base: number; perLevel: number }

  prerequisites?: NodePrerequisite[]

  /**
   * Kiem Tu Reimagined (spec K2) - display gate for hidden nodes: the
   * node does not RENDER in the tree until this prereq holds, AND
   * canPurchaseNode re-checks it (a hidden node is never purchasable
   * before reveal). Evaluated through the same hasPrerequisite() as
   * `prerequisites` - no new machinery.
   */
  revealWhen?: NodePrerequisite

  /**
   * Ownership gate - the node only purchases/upgrades/aggregates for a
   * player on that cultivation path (enforced by
   * NodeSystem.nodePathApplies at purchase, upgrade, and every
   * aggregator). undefined = path-agnostic, so mortal/universal nodes
   * keep working for every path.
   */
  requiredCultivationPath?: CultivationPathId

  /**
   * Cultivation Path Framework (M3, spec 2026-09-16) - way-membership
   * gate, the branch-level sibling of requiredCultivationPath: the node
   * only purchases/upgrades/aggregates for a player whose
   * player.cultivationWay matches (enforced by NodeSystem.nodeWayApplies
   * beside nodePathApplies at purchase, upgrade, and every aggregator).
   * Path-scoped id - pair with requiredCultivationPath when the way id
   * alone is ambiguous across paths. undefined = way-agnostic, so all
   * existing (untagged) nodes keep working for every way.
   */
  requiredWay?: CultivationWayId

  effect: NodeEffect

  // Display-ONLY group label (e.g. 'fire', 'kiem_tu_core') - does not affect
  // purchase/prerequisite logic, only lets the UI draw the right tree branch.
  branchTag?: string

  // Phap Tu Reimagined - route membership: node only has effect while
  // the player's spellPath.route matches (aggregators skip inactive-route
  // nodes; INV-19 forbids shared nodes depending on route-tagged ones).
  routeTag?: 'dot' | 'no'

  // Phap Tu Reimagined - element-branch membership for the normal
  // Phap Tu tree; a node with elementTag belongs to that element's
  // branch and is purchasable only while spellPath.element matches.
  elementTag?: ElementType

  /**
   * M-QI-05 / QI-D3 - marks this node as a SKILL CORE NODE: the
   * canonical level authority for the named skill (top-level Skill
   * template or eligible native TurnSkillDefinition). Core Nodes are
   * granted through learn/kit-root/way-commit seams - never purchased
   * (`canPurchaseNode` rejects), never tree-rendered, never
   * Van-Dao-waived, and level only via Insight (`upgradeNode`) or the
   * cast channel. `levelsSkillId` must NEVER target an internal
   * chained/stance/emblem/reactive/generated sub-action - those
   * inherit their parent's Core level via
   * TurnSkillDefinition.progressionOwnerId instead.
   */
  levelsSkillId?: string
}
