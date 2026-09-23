import type { PlayerData } from '../player/Player'
import type { NodePrerequisite, ProgressionNode, TurnSkillResourceModifier } from './ProgressionNode'
import { hasStaticPathCapability } from '../player/CultivationPathSystem'

import type { SpellPathRoute } from '../phap-tu/PhapTuState'
import { getRealmIndex } from '../realm/realmSystem'
import { getEffectiveTechniqueRank } from '../technique/TechniqueProgression'
import { getNodeCostFreeChance } from '../talent/TalentEffects'
import { kiemDaoCap } from '../kiem-tu/NguKiemDao'
import { getSkillCoreLevel, getSkillCoreUpgradeCost, skillCoreNodeId } from './SkillCoreLevel'
import { CAST_LEVELING_THRESHOLDS } from '../skill/CastLeveling'

/**
 * Shared node-level infrastructure (combat-skill-flow-element-power-dot-plan.md
 * sec.6.1/sec.6.8) - `player.nodeLevels` is the SINGLE SOURCE OF TRUTH for
 * invested state:
 * - Level 0 = not purchased; level >= 1 = purchased and prerequisite met.
 * - maxLevel defaults to 1 -> all legacy nodes keep one-shot purchase behavior.
 * - Modifiers are NO LONGER pushed permanently into player.modifiers nor
 *   mutate the Skill instance on purchase - every effect is derived from
 *   (registry, nodeLevels) via aggregateNodeStatModifiers()/
 *   aggregateNodeSkillModifiers() so recompute always yields the same
 *   deterministic result, never double-applied on load.
 *
 * Data-driven per-level cost: node.upgradeCost = { base, perLevel }
 * with cost(level L -> L+1) = base + floor(L / perLevel). Power 10 levels
 * {1,3} -> 1,1,1,2,2,2,3,3,3,4; growth/specialization 5 levels {1,2} ->
 * 1,1,2,2,3 (per sec.6.2/sec.6.7). A node without upgradeCost uses
 * insightCost for EVERY purchase/upgrade (single-level root/keystone).
 */
export function getNodeMaxLevel(node: ProgressionNode): number {
  return Math.max(1, node.maxLevel ?? 1)
}

/** Current node level in PlayerData - nodeLevels is the source of truth. */
export function getNodeLevel(player: PlayerData, nodeId: string): number {
  // Defensive (?.) - old saves from before nodeLevels (pre-v46) return
  // undefined; treat as no nodes purchased rather than crashing the UI.
  return player.nodeLevels?.[nodeId] ?? 0
}

/** Cost to raise from `currentLevel` to `currentLevel + 1`. */
export function getNextLevelCost(node: ProgressionNode, currentLevel: number): number {
  // M-QI-05 - Core Nodes use the frozen skill-level curve (re-homed
  // verbatim); upgradeCost/insightCost fields are inert on cores.
  if (node.levelsSkillId !== undefined) {
    return getSkillCoreUpgradeCost(currentLevel)
  }

  if (node.upgradeCost) {
    return node.upgradeCost.base + Math.floor(Math.max(0, currentLevel) / node.upgradeCost.perLevel)
  }

  return node.insightCost
}

export function hasPrerequisite(player: PlayerData, prerequisite: NodePrerequisite): boolean {
  switch (prerequisite.kind) {
    case 'realm': {
      // T8-75 - an unknown prerequisite realm resolves to index -1 and
      // `playerIndex >= -1` used to silently pass. Content drift must
      // fail closed (the player's own unknown realmId already fails via
      // `>=`: -1 >= required is false whenever required is valid).
      const requiredIndex = getRealmIndex(prerequisite.realmId)

      if (requiredIndex < 0) {
        console.warn(`[NodeSystem] hasPrerequisite: unknown prerequisite realmId '${prerequisite.realmId}' - failing closed`)

        return false
      }

      return getRealmIndex(player.realmId) >= requiredIndex
    }

    // sec.6.1 - checked via LEVEL instead of a separate boolean list.
    case 'node':
      return getNodeLevel(player, prerequisite.nodeId) >= 1

    case 'nodeCount': {
      const purchasedCount = prerequisite.nodeIds.filter(nodeId => getNodeLevel(player, nodeId) >= 1).length

      return purchasedCount >= prerequisite.countRequired
    }

    case 'excludesNode':
      return getNodeLevel(player, prerequisite.nodeId) === 0

    // Kiem Tu (2026-08-28) - reads the player.skillCastCounts mirror + the
    // canonical Core Node level (M-QI-05 - the skill instance lives in
    // SkillManager; NodeSystem only receives PlayerData so it cannot look it up).
    case 'skillCastCount': {
      const counts = player.skillCastCounts ?? {}

      const castOk = prerequisite.count === undefined || (counts[prerequisite.skillId] ?? 0) >= prerequisite.count
      const levelOk = prerequisite.level === undefined || getSkillCoreLevel(player, prerequisite.skillId) >= prerequisite.level

      return castOk && levelOk
    }

    // Kiem Tu Reimagined (spec K20) - the Cuu Cung cap guard. Lives in
    // hasPrerequisite so canPurchaseNode blocks the buy BEFORE insight
    // is deducted or the node recorded. Mortal realm (index 0) fails -
    // hidden_sword_pathway cannot be entered there anyway. M6: way membership replaces
    // the retired swordPath.mode discriminator.
    case 'kiemDaoBelowCap': {
      const state = player.swordPath
      const realmIndex = getRealmIndex(player.realmId)

      if (!state || !hasStaticPathCapability(player, 'sword.sword_riding') || realmIndex < 1) {
        return false
      }

      return state.kiemDaoCount < kiemDaoCap(realmIndex)
    }

    // P7-M6 + M-F-TECHNIQUE (F5) - technique gates read the live-cycle
    // mirror only; absent mirror fails closed for any positive
    // requirement (a rank:0/grade:0 gate would pass - authored
    // thresholds stay >= 1 by data discipline). F5 effective rank:
    // a lagging live grade contributes rank 0 - the sealed cycle's
    // rank dies at freeze, frozen-before-grade-up window included.
    // Owned node levels above the gate stay legal frozen surplus
    // (purchase/upgrade gates never de-level).
    case 'techniqueRank':
      return getEffectiveTechniqueRank(player.techniqueProgress, player.realmId) >= prerequisite.rank

    // techniqueGrade reads the LIVE grade (monotonic nondecreasing
    // across catch-up) - no effective-rank semantics apply.
    case 'techniqueGrade':
      return (player.techniqueProgress?.grade ?? 0) >= prerequisite.grade
  }
}

/** Prerequisite (gates only the level 0->1 PURCHASE, not upgrades). */
function meetsPrerequisites(player: PlayerData, node: ProgressionNode): boolean {
  return (node.prerequisites ?? []).every(prerequisite => hasPrerequisite(player, prerequisite))
}

/**
 * M-QI-06 (QI-D3) - the gate(s) currently BINDING this node's
 * upgrade ceiling: the unsatisfied levelGates entry(ies) tied at the
 * minimum relevant `atLevel`. "Relevant" = unsatisfied AND
 * `2 <= atLevel <= getNodeMaxLevel(node)` - gates above the authored
 * max are inert and never surface as blockers, so a caller may treat
 * a non-empty result as "blocked" without re-filtering. THE authority
 * for "which gate blocks now" - `getEffectiveNodeMaxLevel` derives
 * from it and presentation consumes it; the min-selection algorithm
 * lives here only.
 */
export function getBlockingNodeLevelGates(
  player: PlayerData,
  node: ProgressionNode,
): { atLevel: number; prerequisite: NodePrerequisite }[] {
  const authoredMax = getNodeMaxLevel(node)
  const unsatisfied = (node.levelGates ?? []).filter(
    (gate) =>
      gate.atLevel >= 2 && gate.atLevel <= authoredMax && !hasPrerequisite(player, gate.prerequisite),
  )

  if (unsatisfied.length === 0) {
    return []
  }

  const minAtLevel = Math.min(...unsatisfied.map((gate) => gate.atLevel))

  return unsatisfied.filter((gate) => gate.atLevel === minAtLevel)
}

/**
 * M-QI-06 (QI-D3) - effective reachable max under levelGates: the
 * smallest unsatisfied relevant gate's `atLevel - 1`, floored by the
 * authored maxLevel. UPGRADE semantics only - `getNodeMaxLevel` stays
 * the authored/registered ceiling read by save validation, catalog
 * checks, and true-completion display.
 */
export function getEffectiveNodeMaxLevel(player: PlayerData, node: ProgressionNode): number {
  const authoredMax = getNodeMaxLevel(node)
  const blocking = getBlockingNodeLevelGates(player, node)

  return blocking.length === 0
    ? authoredMax
    : Math.min(authoredMax, Math.min(...blocking.map((gate) => gate.atLevel - 1)))
}

/**
 * Phap Tu Reimagined Task 4 - route membership: a routeTag node only
 * exists while the player's route matches (untagged nodes are always
 * active). Aggregators skip inactive-route nodes and purchase/upgrade
 * reject them, so an inactive node's levels can never take effect.
 */
export function isNodeRouteActive(player: PlayerData, node: ProgressionNode): boolean {
  return node.routeTag === undefined || player.spellPath.route === node.routeTag
}

/**
 * Phap Tu Reimagined Task 6 - element-branch membership: a node with
 * elementTag is active only while spellPath.element matches (untagged
 * nodes are always active). Same gate points as routeTag: aggregators
 * skip inactive-element nodes, purchase/upgrade reject them. While
 * spellPath.element is null (pre-selection) every element node counts as
 * active so selectSpellPathElement can purchase its root - unreachable
 * branch children still fail their root prerequisite.
 */
export function isNodeElementActive(player: PlayerData, node: ProgressionNode): boolean {
  return (
    node.elementTag === undefined ||
    player.spellPath.element === null ||
    player.spellPath.element === node.elementTag
  )
}

/** Eligible to PURCHASE (0->1): no level yet, prereq met, enough Insight for the level-1 cost. */
export function canPurchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  // M-QI-05 - Core Nodes are granted through learn/kit-root/way-commit
  // seams, never purchased.
  if (node.levelsSkillId !== undefined) {
    return false
  }

  if (getNodeLevel(player, node.id) > 0) {
    return false
  }

  if (!isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
    return false
  }

  if (player.skillInsight < getNextLevelCost(node, 0)) {
    return false
  }

  // Kiem Tu Reimagined - a hidden node is never purchasable before its
  // revealWhen gate holds (display gate + purchase gate share the read).
  if (node.revealWhen && !hasPrerequisite(player, node.revealWhen)) {
    return false
  }

  return meetsPrerequisites(player, node)
}

/** Eligible to UPGRADE (L->L+1): already purchased, not maxed, enough Insight. */
export function canUpgradeNode(player: PlayerData, node: ProgressionNode): boolean {
  // M-QI-05 - cast-channel cores level by cast count ONLY; Insight is
  // never a valid input for them (QI-D3).
  if (node.levelsSkillId !== undefined && CAST_LEVELING_THRESHOLDS[node.levelsSkillId] !== undefined) {
    return false
  }

  if (!isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
    return false
  }

  const level = getNodeLevel(player, node.id)

  // M-QI-06 - the level-gate effective ceiling replaces the authored
  // read here: an unsatisfied gate blocks the L -> L+1 transaction.
  if (level < 1 || level >= getEffectiveNodeMaxLevel(player, node)) {
    return false
  }

  return player.skillInsight >= getNextLevelCost(node, level)
}

/**
 * Applies the registry-free part of the effect at pure-data level (except
 * skillInsight, writes nodeLevels/purchasedNodeIds, unlocksElement). Does NOT
 * push modifiers into player.modifiers (sec.6.8 - effects are derived by the
 * aggregator). `unlocksSkillIds` is handled by GameManager.purchaseNode()
 * after this call (needs skillTemplates). Returns false if
 * !canPurchaseNode().
 */
/**
 * Van Dao (M2, spec sec.4.3): each purchase/upgrade rolls a chance to waive
 * the insight cost. The waived amount is recorded in
 * player.nodeFreePurchaseRecord[nodeId] so refunds later repay only the
 * insight ACTUALLY paid. The affordability gate (canPurchase/canUpgrade)
 * is unchanged - a free roll still requires being able to afford it.
 * Returns true when the cost was waived (caller deducts nothing).
 */
function rollVanDaoWaive(player: PlayerData, node: ProgressionNode, cost: number): boolean {
  const chance = getNodeCostFreeChance(player.selectedTalentIds)

  if (chance <= 0 || cost <= 0) {
    return false
  }

  if (Math.random() >= chance) {
    return false
  }

  player.nodeFreePurchaseRecord ??= {}
  player.nodeFreePurchaseRecord[node.id] =
    (player.nodeFreePurchaseRecord[node.id] ?? 0) + cost

  return true
}

export function purchaseNode(player: PlayerData, node: ProgressionNode): boolean {
  if (!canPurchaseNode(player, node)) {
    return false
  }

  const cost = getNextLevelCost(node, 0)

  if (!rollVanDaoWaive(player, node, cost)) {
    player.skillInsight -= cost
  }

  // Defensive - old saves may lack this object.
  player.nodeLevels ??= {}

  player.nodeLevels[node.id] = 1

  // Read-only compat: keeps the id list in sync with "level >= 1".
  if (!player.purchasedNodeIds.includes(node.id)) {
    player.purchasedNodeIds.push(node.id)
  }

  return true
}

/**
 * Raises a node from its current level by +1 (sec.6.2) - charges exactly the
 * next level's cost, never exceeds maxLevel; failure mutates NOTHING.
 */
export function upgradeNode(player: PlayerData, node: ProgressionNode): boolean {
  if (!canUpgradeNode(player, node)) {
    return false
  }

  const cost = getNextLevelCost(node, getNodeLevel(player, node.id))

  // M-QI-05 - cores never roll the waive: skill upgrades never did, and
  // nodeFreePurchaseRecord stays a tree-purchase concept.
  if (node.levelsSkillId !== undefined || !rollVanDaoWaive(player, node, cost)) {
    player.skillInsight -= cost
  }

  // Defensive - old saves may lack this object.
  player.nodeLevels ??= {}

  player.nodeLevels[node.id] = getNodeLevel(player, node.id) + 1

  return true
}

/**
 * Scales a modifier by level - same formula as getScaledPassiveModifiers():
 * value at level L = base + perLevel x (L - 1). A single-level node (root/
 * keystone) at L=1 yields exactly base, no perLevel.
 */
function scaleModifierForLevel<T extends { flat?: number; percent?: number; perLevelFlat?: number; perLevelPercent?: number }>(
  modifier: T,

  level: number,
): T & { flat: number; percent: number } {
  const extraLevels = Math.max(0, level - 1)

  return {
    ...modifier,

    flat: (modifier.flat ?? 0) + (modifier.perLevelFlat ?? 0) * extraLevels,

    percent: (modifier.percent ?? 0) + (modifier.perLevelPercent ?? 0) * extraLevels,
  }
}

/**
 * Aggregates a character's stat modifiers from (registry, nodeLevels)
 * (sec.6.8 step 3) - fully replaces the old player.modifiers push path.
 * Same (registry, levels) regardless of purchase order -> same result.
 */
/**
 * Ownership gate - a node authored for one cultivation path can be
 * purchased/upgraded by, and aggregates effects for, only a player on
 * that same path. requiredCultivationPath undefined = path-agnostic.
 *
 * M7 - both sides are BASE path ids, so the gate is direct equality;
 * WAY isolation inside the path family is nodeWayApplies' job below.
 * A player with no path fails the gate.
 */
export function nodePathApplies(player: PlayerData, node: ProgressionNode): boolean {
  if (node.requiredCultivationPath === undefined) {
    return true
  }

  return player.cultivationPath === node.requiredCultivationPath
}

/**
 * Cultivation Path Framework (M3) - way-membership gate, the
 * branch-level sibling of nodePathApplies: a node authored for one way
 * inside a path can be purchased/upgraded by, and aggregates effects
 * for, only a player whose cultivationWay matches. requiredWay
 * undefined = way-agnostic.
 */
export function nodeWayApplies(player: PlayerData, node: ProgressionNode): boolean {
  return node.requiredWay === undefined || node.requiredWay === player.cultivationWay
}

export function aggregateNodeStatModifiers(
  registry: { getAll(): ProgressionNode[] },

  player: PlayerData,
) {
  const modifiers = []

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0 || !isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
      continue
    }

    for (const modifier of node.effect.statModifiers ?? []) {
      modifiers.push(scaleModifierForLevel(modifier, level))
    }
  }

  return modifiers
}

/**
 * Phap Tu Reimagined Task 6 - aggregate the The-resource lane: for
 * each authored turn skill, sum node-level-scaled theGainOnLandedCast /
 * theGainOnCrit across all active nodes. Values contribute
 * per node level (level L adds value x L). The modifier stays scoped
 * to its authored skillId - it cannot leak to other elements, Kiem
 * Tu, or mortal skills.
 */
export function aggregateTurnSkillResourceModifiers(
  registry: { getAll(): ProgressionNode[] },

  player: PlayerData,
): Map<string, TurnSkillResourceModifier> {
  const result = new Map<string, TurnSkillResourceModifier>()

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0 || !isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
      continue
    }

    for (const entry of node.effect.turnSkillResourceModifiers ?? []) {
      const existing = result.get(entry.skillId) ?? { skillId: entry.skillId }

      existing.theGainOnLandedCast =
        (existing.theGainOnLandedCast ?? 0) + (entry.theGainOnLandedCast ?? 0) * level
      existing.theGainOnCrit =
        (existing.theGainOnCrit ?? 0) + (entry.theGainOnCrit ?? 0) * level

      result.set(entry.skillId, existing)
    }
  }

  return result
}

/**
 * M-QI-05 - grant a Core Node (0->1): idempotent write of
 * nodeLevels[core] = 1 + purchasedNodeIds membership. An existing
 * higher level is untouched (re-grant paths like re-buy are no-ops).
 */
export function grantSkillCore(player: PlayerData, node: ProgressionNode): void {
  if (getNodeLevel(player, node.id) < 1) {
    player.nodeLevels ??= {}
    player.nodeLevels[node.id] = 1
  }

  if (!player.purchasedNodeIds.includes(node.id)) {
    player.purchasedNodeIds.push(node.id)
  }
}

/**
 * M-QI-05 - shared ownership-removal seam: deletes the node's level +
 * purchasedNodeIds membership, repays the Insight actually spent on it
 * (total cost minus waived record, cleared alongside), and revokes
 * every `effect.grantsSkillCoreIds` member of the removed node -
 * granted cores are lifecycle-tied to their granting node. Revoked
 * cores repay their own spent Insight the same way (deterministic from
 * the frozen curve; cores never waive). Returns the total refund.
 */
function revokeNodeOwnership(
  player: PlayerData,
  node: ProgressionNode,
  registry: { has(id: string): boolean; get(id: string): ProgressionNode },
): number {
  const level = getNodeLevel(player, node.id)

  let refund = 0

  // M-QI-05 - a core's level 1 is GRANTED free: only its upgrades
  // (levels 1..L-1) repaid Insight. Ordinary nodes paid for level 1.
  const spentStart = node.levelsSkillId !== undefined ? 1 : 0

  for (let spent = spentStart; spent < level; spent++) {
    refund += getNextLevelCost(node, spent)
  }

  // Van Dao (M2): refund only the insight ACTUALLY paid - subtract the
  // waived amounts recorded at purchase time, then clear the record
  // alongside the node itself.
  refund = Math.max(0, refund - (player.nodeFreePurchaseRecord?.[node.id] ?? 0))
  if (player.nodeFreePurchaseRecord) {
    delete player.nodeFreePurchaseRecord[node.id]
  }

  delete player.nodeLevels[node.id]

  const index = player.purchasedNodeIds.indexOf(node.id)

  if (index !== -1) {
    player.purchasedNodeIds.splice(index, 1)
  }

  for (const skillId of node.effect.grantsSkillCoreIds ?? []) {
    const coreId = skillCoreNodeId(skillId)

    if (registry.has(coreId) && getNodeLevel(player, coreId) >= 1) {
      refund += revokeNodeOwnership(player, registry.get(coreId), registry)
    }
  }

  return refund
}

/**
 * Resets ONE BRANCH of development (sec.6.10) - refunds exactly the total
 * Insight spent, derived from the level/cost data history; cascades orphaned
 * children when a parent's prerequisite drops to 0; a free root does NOT
 * create a refund discrepancy (cost 0 naturally refunds 0). Out-of-combat
 * use only, for balancing.
 */
export function devResetBranch(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[]; has(id: string): boolean; get(id: string): ProgressionNode },

  branchTag: string,
): number {
  const nodes = registry.getAll().filter(node => node.branchTag === branchTag)

  if (nodes.length === 0) {
    return 0
  }

  let refund = 0

  for (const node of nodes) {
    refund += revokeNodeOwnership(player, node, registry)
  }

  refund += cascadeRevokeOrphanedNodes(player, registry)

  // Refunds Insight to the player (sec.6.10).
  player.skillInsight += refund

  return refund
}

/**
 * Orphan-child cascade removal shared by devResetBranch and
 * respecNodeTree: loops until stable - any node still levelled whose
 * 'node' parent prereq drops to 0 gets revoked too (refunding it as
 * well, since its state is no longer valid). preservedIds exempts a node
 * from the sweep entirely (commit markers are never respec targets).
 */
function cascadeRevokeOrphanedNodes(
  player: PlayerData,
  registry: { getAll(): ProgressionNode[]; has(id: string): boolean; get(id: string): ProgressionNode },
  preservedIds?: ReadonlySet<string>,
): number {
  let refund = 0
  let changed = true

  while (changed) {
    changed = false

    for (const node of registry.getAll()) {
      if (getNodeLevel(player, node.id) < 1) {
        continue
      }

      if (preservedIds?.has(node.id)) {
        continue
      }

      const orphaned = (node.prerequisites ?? []).some(
        prerequisite =>
          prerequisite.kind === 'node' &&
          getNodeLevel(player, prerequisite.nodeId) < 1,
      )

      if (orphaned) {
        refund += revokeNodeOwnership(player, node, registry)
        changed = true
      }
    }
  }

  return refund
}

/**
 * Nodes that sit under `rootId` through 'node'-kind prerequisites - the
 * same set the orphan cascade would sweep if the root itself were
 * revoked. Used when a preserved root still seeds a scoped reset.
 */
function subtreeDescendants(
  rootId: string,
  registry: { getAll(): ProgressionNode[]; get(id: string): ProgressionNode },
): ProgressionNode[] {
  const subtree = new Set([rootId])
  let changed = true

  while (changed) {
    changed = false

    for (const node of registry.getAll()) {
      if (subtree.has(node.id)) {
        continue
      }

      const descends = (node.prerequisites ?? []).some(
        prerequisite => prerequisite.kind === 'node' && subtree.has(prerequisite.nodeId),
      )

      if (descends) {
        subtree.add(node.id)
        changed = true
      }
    }
  }

  subtree.delete(rootId)

  return [...subtree].map(id => registry.get(id))
}

/**
 * Scope of a player respec (M-F-RESPEC, ruling S14). `rootId` scopes the
 * reset to the subtree rooted at that node - the node itself plus every
 * descendant orphaned by its removal; omitting it resets the whole
 * NodeTree (the branch defaults to the whole NodeTree root). `preserveIds`
 * exempts owned ids from any reset - commitment markers the player cannot
 * re-acquire (e.g. Phap Tu element roots) belong here. Preservation
 * excludes a node from REVOCATION, not from seeding: a scoped reset
 * aimed at a preserved root keeps the root but still resets its owned
 * descendants - the un-rebuyable commit marker is an orchestration
 * concern, while descendant investment stays ordinary tree state.
 */
export interface NodeRespecScope {
  rootId?: string
  preserveIds?: readonly string[]
}

/**
 * M-F-RESPEC (ruling S14) - player-facing FREE Beta respec: revokes
 * ownership of every node inside `scope` and refunds 100% of the Insight
 * ACTUALLY paid (same paidForNodeLevels + nodeFreePurchaseRecord
 * accounting as devResetBranch), then cascade-revokes orphaned
 * descendants. Whole-tree scope covers every non-core node - skill cores
 * (levelsSkillId) are not tree content and only revoke through
 * grantsSkillCoreIds ties, so a learned skill can never be stranded at
 * level 0. A branch scope targets the subtree root plus whatever it
 * orphans; when the root itself is preserved the reset still sweeps its
 * owned descendants. Deterministic, idempotent (a repeat call refunds 0)
 * and save-safe: only canonical node fields + skillInsight are written.
 */
export function respecNodeTree(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[]; has(id: string): boolean; get(id: string): ProgressionNode },

  scope?: NodeRespecScope,
): number {
  const preservedIds = new Set(scope?.preserveIds ?? [])

  let targets: ProgressionNode[] = []

  if (scope?.rootId !== undefined) {
    if (registry.has(scope.rootId)) {
      targets = preservedIds.has(scope.rootId)
        ? // A preserved root is exempt from revocation but still seeds
          // its subtree - reset the owned descendants below it instead.
          subtreeDescendants(scope.rootId, registry).filter(
            node => !preservedIds.has(node.id),
          )
        : [registry.get(scope.rootId)]
    }
  } else {
    targets = registry
      .getAll()
      .filter(node => node.levelsSkillId === undefined && !preservedIds.has(node.id))
  }

  if (targets.length === 0) {
    return 0
  }

  // Atomicity (C2C round-8 pin): the mutation body mutates `player`
  // node by node, so the identical body is dry-run on a detached JSON
  // clone first - any throw (broken dependency/core tie, corrupt record)
  // fails closed here, BEFORE the first real mutation. The player object
  // can never be left half-respecced.
  respecApply(JSON.parse(JSON.stringify(player)) as PlayerData, targets, registry, preservedIds)

  return respecApply(player, targets, registry, preservedIds)
}

/**
 * The respec mutation body shared by the real call and its clone
 * preflight: revoke every target, cascade-revoke orphans, then a single
 * Insight write once every revocation has settled.
 */
function respecApply(
  player: PlayerData,

  targets: ProgressionNode[],

  registry: { getAll(): ProgressionNode[]; has(id: string): boolean; get(id: string): ProgressionNode },

  preservedIds: ReadonlySet<string>,
): number {
  let refund = 0

  for (const node of targets) {
    refund += revokeNodeOwnership(player, node, registry)
  }

  refund += cascadeRevokeOrphanedNodes(player, registry, preservedIds)

  player.skillInsight += refund

  return refund
}

/**
 * Read-only projection of respecNodeTree for the confirm dialog - runs
 * the real implementation against a structured clone so preview and
 * commit can never diverge (the report IS the dry-run diff).
 */
export interface NodeRespecPreview {
  /** Insight the commit would return (same actual-paid accounting). */
  refund: number
  /** Every ownership record the reset would remove: in-scope purchased
   * nodes + cascade orphans + revoked granted cores (C2C round-8: the
   * confirm dialog's count covers all of them as one number). */
  resetNodeIds: string[]
  resetCount: number
}

export function previewNodeRespec(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[]; has(id: string): boolean; get(id: string): ProgressionNode },

  scope?: NodeRespecScope,
): NodeRespecPreview {
  // JSON round-trip (not structuredClone): callers hand in the Pinia
  // reactive state, which structuredClone refuses; PlayerData is what
  // the save system serializes, so JSON round-trip is exact.
  const sim = JSON.parse(JSON.stringify(player)) as PlayerData

  const refund = respecNodeTree(sim, registry, scope)

  const resetNodeIds = Object.keys(player.nodeLevels ?? {}).filter(
    id => !(id in (sim.nodeLevels ?? {})),
  )

  return { refund, resetNodeIds, resetCount: resetNodeIds.length }
}

/**
 * Phap Tu Reimagined Task 4 - switch the route half of the atomic
 * (element, route) commitment. Out-of-combat only (the orchestration op
 * enforces the no-active-battle rule). For every node tagged with the
 * OLD route: level -> 0, nodeLevels/purchasedNodeIds entries cleared,
 * floor(actualPaid x 0.75) refunded using nodeFreePurchaseRecord
 * exactly like devResetBranch. Nodes tagged with the NEW route are not
 * auto-bought - the player re-invests. Untagged nodes are untouched.
 * No The-pool clear is needed: currentThe is battle-scoped (INV-14)
 * and switching is out-of-combat, so banked The cannot exist at switch
 * time (INV-16 holds by construction).
 * Returns total refunded.
 */
export function switchRoute(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[] },

  route: SpellPathRoute,
): number {
  const oldRoute = player.spellPath.route

  // Review fix (HIGH-2): this is the only writer of spellPath.route besides
  // the atomic (element, route) commit in selectSpellPathElement - it needs
  // the same commitment gate. Without it a pre-commit call stamps route
  // onto {element: null} and permanently poisons selectSpellPathElement's
  // null-check invariant; a non-spell player's dirty route state would
  // also leak universal route stats via getRouteStatModifiers.
  if (
    !hasStaticPathCapability(player, 'spell.elemental_casting') ||
    player.spellPath.element === null ||
    oldRoute === null ||
    oldRoute === route
  ) {
    return 0
  }

  let refund = 0

  for (const node of registry.getAll()) {
    if (node.routeTag !== oldRoute) {
      continue
    }

    const level = getNodeLevel(player, node.id)

    if (level <= 0) {
      continue
    }

    const paid = paidForNodeLevels(player, node)

    if (player.nodeFreePurchaseRecord) {
      delete player.nodeFreePurchaseRecord[node.id]
    }

    refund += Math.floor(paid * 0.75)

    delete player.nodeLevels[node.id]

    const index = player.purchasedNodeIds.indexOf(node.id)

    if (index !== -1) {
      player.purchasedNodeIds.splice(index, 1)
    }
  }

  player.skillInsight += refund

  player.spellPath.route = route

  return refund
}

/** Insight ACTUALLY paid into a node across its levels - Van Dao waived
 * amounts are deducted (same accounting as devResetBranch/switchRoute). */
function paidForNodeLevels(player: PlayerData, node: ProgressionNode): number {
  const level = getNodeLevel(player, node.id)

  let paid = 0

  for (let spent = 0; spent < level; spent++) {
    paid += getNextLevelCost(node, spent)
  }

  return Math.max(0, paid - (player.nodeFreePurchaseRecord?.[node.id] ?? 0))
}

export interface RouteSwitchPreview {
  /** floor(actualPaid x 0.75) summed over the old route's nodes. */
  refund: number

  /** The 25% respec tax - paid insight that is NOT returned. */
  forfeited: number

  /** Old-route nodes that would reset to level 0. */
  resetNodeCount: number
}

/**
 * Task 16 - read-only preview of switchRoute()'s refund math for the
 * "you regain X, lose Y" UI. Shares paidForNodeLevels with switchRoute
 * (A9 - one implementation); mutates nothing.
 */
export function previewRouteSwitch(
  player: PlayerData,

  registry: { getAll(): ProgressionNode[] },
): RouteSwitchPreview {
  const oldRoute = player.spellPath.route

  const preview: RouteSwitchPreview = { refund: 0, forfeited: 0, resetNodeCount: 0 }

  // Same gate as switchRoute (HIGH-2) - never preview a switch the
  // domain would reject.
  if (
    !hasStaticPathCapability(player, 'spell.elemental_casting') ||
    player.spellPath.element === null ||
    oldRoute === null
  ) {
    return preview
  }

  for (const node of registry.getAll()) {
    if (node.routeTag !== oldRoute || getNodeLevel(player, node.id) <= 0) {
      continue
    }

    const paid = paidForNodeLevels(player, node)
    const refund = Math.floor(paid * 0.75)

    preview.refund += refund
    preview.forfeited += paid - refund
    preview.resetNodeCount += 1
  }

  return preview
}
