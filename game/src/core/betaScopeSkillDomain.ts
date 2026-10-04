// BETA SCOPE LOCK v2 Phase-3 - canonical read-models for the
// combat/skill domain. The frontend renders these verdicts; it must
// never rederive combat roles or skill-tree visibility from
// realm + skill registry itself.
//
// betaScope.ts stays the release-policy authority - this module only
// COMPOSES its BetaScopeVerdict tri-state with the existing domain
// predicates (CultivationPathSystem way/element reads, NodeSystem
// purchase gates, MortalPrecursors pick, SPELL_KIT_IDS kit table).
// Nothing here writes state, consumes RNG, or grants content - every
// function is a pure query (Q9).
//
// Contract (spec sec.7/8, work-order sec.4/5/18-19):
//   - Role rail: always [basic, special, ultimate]. 'ultimate' is
//     permanently 'scope-hidden' in beta - an explicit verdict, never
//     an empty slot the UI must guess about.
//   - Skill tree: every catalog node carries a per-node state. The
//     four non-committed element branches are 'scope-hidden' (NOT
//     rendered as locked branches); progression-gated in-branch nodes
//     are 'progression-locked'.
//   - Precursor surfaces (sword orb-picker dynamicBasic, An emblem
//     ngo_dao_hon_don in the ult slot) are reported scope-hidden for
//     beta players. The dormant provider/emblem systems themselves are
//     untouched - only their beta SURFACE verdict is pinned here.
import type { ElementType } from './element/ElementType'
import type { PlayerData } from './player/Player'
import type { NodePrerequisite, ProgressionNode } from './progression/ProgressionNode'
import {
  CULTIVATION_PATH_MODULES,
  getActiveWayDefinition,
  type CultivationWayId,
  type PathCapabilityDeps,
} from './player/CultivationPathKit'
import {
  getActiveElement,
  getActiveWay,
  hasPathCapability,
  hasStaticPathCapability,
  isActivePath,
} from './player/CultivationPathSystem'
import {
  canPurchaseNode,
  canUpgradeNode,
  getEffectiveNodeMaxLevel,
  getNextLevelCost,
  getNodeLevel,
  getNodeMaxLevel,
  hasPrerequisite,
  nodePathApplies,
  nodeWayApplies,
} from './progression/NodeSystem'
import {
  HIDDEN_BRANCH_TAGS,
  viewBranchTags,
} from './progression/NodeBranchViews'
import {
  MORTAL_DEFAULT_BASIC_ID,
  isMortalPrecursorSkillId,
} from './skill/MortalPrecursors'
import {
  betaScopeVerdict,
  isBetaElement,
  isBetaFeature,
  isBetaWay,
  type BetaScopeVerdict,
} from './betaScope'
import { SPELL_KIT_IDS } from '../data/skill/Skills'
import { PHAP_TU_NODES } from '../data/progression/PhapTuNodes'

// ---------------------------------------------------------------------------
// A. Combat role rail
// ---------------------------------------------------------------------------

export type BetaCombatRole = 'basic' | 'special' | 'ultimate'

export interface BetaCombatRoleEntry {
  role: BetaCombatRole
  /**
   * The canonical skill for the role, or null when no beta skill can be
   * named yet (element uncommitted / role out of scope / state corrupt).
   * Display metadata resolves via turnSkillDisplayMetaOf(skillId).
   */
  skillId: string | null
  state: BetaScopeVerdict
  /** Stable machine-readable blocker tag when state is not 'available'. */
  reason?: string
}

/**
 * The beta combat role rail - spec sec.7/8:
 *   Pham Nhan (Act I)      - basic only (the player's precursor pick;
 *                            linh_bao is the family's canonical member)
 *   Luyen Khi (Act II)     - basic (elemental once committed)
 *   Truc Co (Act III)      - basic + special
 *   ultimate               - NO ultimate role in beta -> scope-hidden
 *
 * Realm drives the rail shape; way gates admission. A non-beta way or a
 * corrupt way-less non-mortal save fails closed: every role is
 * scope-hidden.
 */
export function betaCombatRolesFor(
  player: PlayerData,
  deps: PathCapabilityDeps,
): BetaCombatRoleEntry[] {
  const ultimate: BetaCombatRoleEntry = {
    role: 'ultimate',
    skillId: null,
    state: 'scope-hidden',
    reason: 'out-of-beta-scope',
  }

  // Mortal-boundary contract pairing (core/skill/MortalPrecursors.ts):
  // realmId 'mortal' with no committed pair is the legal Act-I shape;
  // mortal + a committed pair is contradictory on its face and fails
  // closed the same as a way-less non-mortal save.
  const isMortalRealm = player.realmId === 'mortal'
  const isMortal =
    isMortalRealm &&
    player.cultivationPath === undefined &&
    player.cultivationWay === undefined
  const way = getActiveWay(player)
  const betaWay = way !== undefined && isBetaWay(way)

  if (isMortal) {
    // Mirror createMortalRuntime.resolveBasic: the persisted pick,
    // guarded to the precursor family + learned membership, else the
    // tram default. Read-only - never grants the fallback.
    const pick = player.mortalBasicSkillId
    const basicId =
      pick !== undefined && isMortalPrecursorSkillId(pick) && deps.hasSkill(pick)
        ? pick
        : MORTAL_DEFAULT_BASIC_ID

    return [
      { role: 'basic', skillId: basicId, state: 'available' },
      // The special is beta content gated behind Act III - in scope but
      // unmet, so progression-locked (never scope-hidden).
      { role: 'special', skillId: null, state: 'progression-locked', reason: 'realm-gate' },
      ultimate,
    ]
  }

  if (!betaWay || isMortalRealm) {
    // A committed non-beta way (sword/body/hidden) is out of scope; a
    // way-less non-mortal save or a contradictory mortal pair is corrupt -
    // all fail closed.
    const reason =
      way === undefined || isMortalRealm ? 'unresolved-way-state' : 'non-beta-way'

    return [
      { role: 'basic', skillId: null, state: 'scope-hidden', reason },
      { role: 'special', skillId: null, state: 'scope-hidden', reason },
      ultimate,
    ]
  }

  // The only beta way today is spell_pathway (BETA_PLAYABLE_WAYS). Basic
  // mirrors createSpellPathwayRuntime.resolveBasic: the element kit
  // basic once committed, the way-authored starter (linh_bao) before.
  const element = getActiveElement(player)
  const basicId =
    element !== undefined && isBetaElement(element)
      ? SPELL_KIT_IDS[element][0]
      : (getActiveWayDefinition(player)?.starterBasicSkillId ?? null)

  let special: BetaCombatRoleEntry

  if (element === undefined || !isBetaElement(element)) {
    special = {
      role: 'special',
      skillId: null,
      state: 'progression-locked',
      reason: 'element-uncommitted',
    }
  } else {
    const specialId = SPELL_KIT_IDS[element][1]
    // The special's realm gate IS the authored gate on the
    // linh_ngo_<special> keystone that unlocks it - derived from the
    // node, never restated as a literal here.
    const keystone = PHAP_TU_NODES.find(
      (node) => node.effect.unlocksSkillIds?.includes(specialId) ?? false,
    )
    // Missing/renamed keystone = content drift: the special then has no
    // unlock path at all, so fail locked rather than silently gate-met.
    const keystoneGatesMet =
      keystone !== undefined &&
      (keystone.prerequisites ?? []).every((prerequisite) =>
        hasPrerequisite(player, prerequisite),
      )

    if (!keystoneGatesMet) {
      special = {
        role: 'special',
        skillId: specialId,
        state: 'progression-locked',
        reason: 'realm-gate',
      }
    } else if (!deps.hasSkill(specialId)) {
      special = {
        role: 'special',
        skillId: specialId,
        state: 'progression-locked',
        reason: 'not-learned',
      }
    } else {
      special = { role: 'special', skillId: specialId, state: 'available' }
    }
  }

  return [
    { role: 'basic', skillId: basicId, state: 'available' },
    special,
    ultimate,
  ]
}

// ---------------------------------------------------------------------------
// B. Skill tree surface
// ---------------------------------------------------------------------------

/** Per-node render state - BetaScopeVerdict plus the two owned/buyable
    refinements the tree surface needs. */
export type BetaSkillNodeState =
  | 'purchased'
  | 'purchasable'
  | 'available'
  | 'progression-locked'
  | 'scope-hidden'

/** One displayable gate row - authored prerequisite or levelGate. */
export interface BetaSkillNodeGate {
  kind: NodePrerequisite['kind']
  /** Which authored field this row came from. */
  gate: 'purchase' | 'reveal' | 'level'
  /** Set for 'level' gates - the node level the gate unlocks at. */
  atLevel?: number
  /** Display targets: realmId / nodeId(s) / skillId per kind. */
  targetIds: string[]
  /** Primary numeric threshold (countRequired / count / rank / grade). */
  required?: number
  met: boolean
}

export interface BetaSkillTreeNode {
  nodeId: string
  name: string
  description?: string
  nodeType: ProgressionNode['type']
  role?: ProgressionNode['role']
  elementTag?: ElementType
  state: BetaSkillNodeState
  reason?: string
  level: number
  /** Authored ceiling (getNodeMaxLevel). */
  maxLevel: number
  /** Reachable ceiling under current levelGates. */
  effectiveMaxLevel: number
  /** Insight cost of the next level; null when the effective cap is reached. */
  nextLevelCost: number | null
  affordable: boolean
  /** True when the owned node can level right now (canUpgradeNode). */
  canUpgrade: boolean
  /** Authored purchase/reveal prereqs with per-row met flags. */
  prerequisites: BetaSkillNodeGate[]
  /** Authored levelGates with per-row met flags (upgrade ceiling lift). */
  levelGates: BetaSkillNodeGate[]
  /** Skills the node grants (unlocksSkillIds + grantsSkillCoreIds). */
  grantsSkillIds: string[]
  /** Info-anchor node: rendered for readability, never purchasable -
      the named skill's own channel (casts/grants) owns its level. */
  infoSkillId?: string
}

/**
 * Beta tree-node admission (frontend-contract sec.D): a node renders or
 * accepts writes only on an admitted tree surface. A node scoped to a
 * non-beta way (requiredWay) or carrying a view tag owned by a dormant
 * way's tree - or a hidden branch tag - is scope-hidden for every
 * player, so a carried way_out_of_scope save cannot spend insight on a
 * kit the gated combat runtime never executes. Element-tagged nodes
 * belong to the beta spell tree and stay admitted; untagged nodes are
 * way-agnostic and stay admitted on every save.
 */
// Evaluated per call, never memoized at module load: BETA_PLAYABLE_WAYS
// is a mutable set (test fixtures unlock then re-pin it), so a snapshot
// frozen at import time would silently admit every way in tests.
function betaDormantTreeViewTags(): ReadonlySet<string> {
  const tags = new Set<string>(HIDDEN_BRANCH_TAGS)

  for (const path of Object.values(CULTIVATION_PATH_MODULES)) {
    for (const way of Object.values(path.ways)) {
      if (!isBetaWay(way.id) && way.nodeTreeTag !== undefined) {
        for (const tag of viewBranchTags(way.nodeTreeTag)) {
          tags.add(tag)
        }
      }
    }
  }

  return tags
}

// Grant-only content never joins the tree surface (rewardOnly realm
// grants; grantedOnly/levelsSkillId cores are defensive coverage -
// PHAP_TU_NODES currently authors none of those two). Shared with the
// constellation layout validation so a new exclusion flag here stays
// authoritative for both consumers.
export function betaNodeTreeRenderable(node: ProgressionNode): boolean {
  return !(node.rewardOnly === true || node.grantedOnly === true || node.levelsSkillId !== undefined)
}

/**
 * Mortal tree-surface admission: pre-initiation the player owns no
 * path/way, so no pathway-scoped tag set applies - the surface admits
 * only the branches that carry a renderable info anchor (the mortal
 * precursor skills' readable seats on the 'tien_than' branch tag).
 * Every node on an admitted branch still carries its own mortal
 * 'initiation-pending' verdict; nothing here unlocks purchase.
 */
export function betaMortalTreeViewTags(
  tree: readonly ProgressionNode[],
): ReadonlySet<string> {
  const tags = new Set<string>()
  for (const node of tree) {
    const viewTag = node.elementTag ?? node.branchTag
    if (
      node.infoSkillId !== undefined &&
      viewTag !== undefined &&
      betaNodeTreeRenderable(node)
    ) {
      tags.add(viewTag)
    }
  }
  return tags
}

export function betaTreeNodeAdmitted(node: ProgressionNode): boolean {
  if (node.requiredWay !== undefined && !isBetaWay(node.requiredWay)) {
    return false
  }

  const viewTag = node.elementTag ?? node.branchTag

  return viewTag === undefined || !betaDormantTreeViewTags().has(viewTag)
}

/**
 * Beta skill admission (frontend-contract sec.D): a skill id is
 * scope-hidden when every way declaring ownership of it is dormant.
 * Ownership rides the way's declared lists - skillIds /
 * passiveSkillIds / coreSkillIds / ownedContent.skillIds - the same
 * data chooseCultivationPath preflights and the contract suite
 * validates as way-unique. starterBasicSkillId is mortal-domain (a
 * learned precursor the runtime falls back to), not an exclusive
 * claim, so it never contributes here; an id a beta way also owns
 * stays admitted. Mortal/native skills no way claims stay admitted
 * on every save.
 * Evaluated per call like betaDormantTreeViewTags - live lock state.
 */
function betaDormantSkillIds(): ReadonlySet<string> {
  const betaOwned = new Set<string>()
  const dormant = new Set<string>()

  for (const path of Object.values(CULTIVATION_PATH_MODULES)) {
    for (const way of Object.values(path.ways)) {
      const declared: readonly (readonly string[] | undefined)[] = [
        way.skillIds,
        way.passiveSkillIds,
        way.coreSkillIds,
        way.ownedContent?.skillIds,
      ]
      const sink = isBetaWay(way.id) ? betaOwned : dormant
      for (const ids of declared) {
        for (const id of ids ?? []) sink.add(id)
      }
    }
  }

  for (const id of betaOwned) dormant.delete(id)
  return dormant
}

export function betaSkillAdmitted(skillId: string): boolean {
  return !betaDormantSkillIds().has(skillId)
}

/**
 * Way-owned canonical techniques (way.techniqueId): a technique minted by
 * a dormant way carries that way's dormancy - its grade advancement,
 * tier emissions and combat modifiers are scope-hidden machinery.
 * Unowned (mortal) techniques stay admitted on every save.
 * Evaluated per call like betaDormantSkillIds - live lock state.
 */
function betaDormantTechniqueIds(): ReadonlySet<string> {
  const betaOwned = new Set<string>()
  const dormant = new Set<string>()

  for (const path of Object.values(CULTIVATION_PATH_MODULES)) {
    for (const way of Object.values(path.ways)) {
      const sink = isBetaWay(way.id) ? betaOwned : dormant
      sink.add(way.techniqueId)
    }
  }

  for (const id of betaOwned) dormant.delete(id)
  return dormant
}

export function betaTechniqueAdmitted(techniqueId: string): boolean {
  return !betaDormantTechniqueIds().has(techniqueId)
}

/**
 * Active-way admission for effect seams: a way-less player is the beta
 * mortal baseline (admitted); a committed way is admitted only when the
 * beta allow-list owns it. Mirrors the wayAdmitted seam in CombatBuild.
 */
export function betaActiveWayAdmitted(player: PlayerData): boolean {
  const wayId = getActiveWay(player)
  return wayId === undefined || isBetaWay(wayId)
}

/**
 * One write/effect admission predicate for progression ops and their
 * readers: tree-surface admission (dormant way/hidden branch tags) AND
 * skill-level admission (a core node leveling a dormant way's kit skill
 * stays rejected even though core nodes carry no view tag).
 */
export function betaNodeWriteAdmitted(node: ProgressionNode): boolean {
  return betaTreeNodeAdmitted(node) && betaNodeSkillLevelAdmitted(node)
}

/**
 * Beta core-node admission: a node that levels a skill is admitted
 * only when the leveled skill is - untagged core nodes carry no tree
 * view tag, so betaTreeNodeAdmitted alone admits dormant way kits.
 */
export function betaNodeSkillLevelAdmitted(node: ProgressionNode): boolean {
  return node.levelsSkillId === undefined || betaSkillAdmitted(node.levelsSkillId)
}

export interface BetaSkillTree {
  /** Committed element; null pre-commit or off spell_pathway. */
  element: ElementType | null
  realmId: string
  way: CultivationWayId | null
  /** Pre-initiation mortal (realmId 'mortal' + no path/way pair) -
      the surface uses this to admit the info-anchor branches. */
  mortal: boolean
  /** Committed way's display name; null when way is null. */
  wayName: string | null
  /** The committed way's declared nodeTreeTag (which fixed tree this
      way renders); undefined for element-driven or tree-less ways. */
  wayNodeTreeTag: string | undefined
  /** 'spell.elemental_casting' capability - the gate that decides
      whether the element-tree surface exists at all (a collapsed
      ('spell','hidden_spell_pathway') player owns no branches). */
  elementCasting: boolean
  /** Every tree-catalog node with its verdict - scope-hidden entries are
      emitted explicitly; renderable nodes are state !== 'scope-hidden'. */
  nodes: BetaSkillTreeNode[]
}

/** Pre-initiation mortal: realm mortal AND no committed path/way pair. */
function isPreInitiationMortal(player: PlayerData): boolean {
  return (
    player.realmId === 'mortal' &&
    player.cultivationPath === undefined &&
    player.cultivationWay === undefined
  )
}

function gateTargets(prerequisite: NodePrerequisite): string[] {
  switch (prerequisite.kind) {
    case 'realm':
      return [prerequisite.realmId]
    case 'node':
    case 'excludesNode':
      return [prerequisite.nodeId]
    case 'nodeCount':
      return [...prerequisite.nodeIds]
    case 'skillCastCount':
      return [prerequisite.skillId]
    case 'techniqueRank':
    case 'techniqueGrade':
      return []
  }
}

function gateRequired(prerequisite: NodePrerequisite): number | undefined {
  switch (prerequisite.kind) {
    case 'nodeCount':
      return prerequisite.countRequired
    case 'skillCastCount':
      return prerequisite.count
    case 'techniqueRank':
      return prerequisite.rank
    case 'techniqueGrade':
      return prerequisite.grade
    case 'realm':
    case 'node':
    case 'excludesNode':
      return undefined
  }
}

function gateRow(
  player: PlayerData,
  prerequisite: NodePrerequisite,
  gate: BetaSkillNodeGate['gate'],
  atLevel?: number,
): BetaSkillNodeGate {
  return {
    kind: prerequisite.kind,
    gate,
    atLevel,
    targetIds: gateTargets(prerequisite),
    required: gateRequired(prerequisite),
    met: hasPrerequisite(player, prerequisite),
  }
}

function treeNodeFor(
  player: PlayerData,
  node: ProgressionNode,
  committedElement: ElementType | undefined,
  way: CultivationWayId | null,
): BetaSkillTreeNode {
  const level = getNodeLevel(player, node.id)
  const effectiveMaxLevel = getEffectiveNodeMaxLevel(player, node)
  const nextLevelCost =
    level >= effectiveMaxLevel ? null : getNextLevelCost(node, level)

  const entry: BetaSkillTreeNode = {
    nodeId: node.id,
    name: node.name,
    description: node.description,
    nodeType: node.type,
    role: node.role,
    elementTag: node.elementTag,
    infoSkillId: node.infoSkillId,
    state: 'scope-hidden',
    level,
    maxLevel: getNodeMaxLevel(node),
    effectiveMaxLevel,
    nextLevelCost,
    affordable: nextLevelCost !== null && player.skillInsight >= nextLevelCost,
    canUpgrade: canUpgradeNode(player, node),
    prerequisites: [
      ...(node.prerequisites ?? []).map((prerequisite) =>
        gateRow(player, prerequisite, 'purchase'),
      ),
      ...(node.revealWhen ? [gateRow(player, node.revealWhen, 'reveal')] : []),
    ],
    levelGates: (node.levelGates ?? []).map((gate) =>
      gateRow(player, gate.prerequisite, 'level', gate.atLevel),
    ),
    grantsSkillIds: [
      ...(node.effect.unlocksSkillIds ?? []),
      ...(node.effect.grantsSkillCoreIds ?? []),
    ],
  }

  if (!betaNodeTreeRenderable(node)) {
    return { ...entry, state: 'scope-hidden', reason: 'grant-only-node' }
  }

  const mortalRealm = player.realmId === 'mortal'
  const mortal = isPreInitiationMortal(player)

  if (mortalRealm && !mortal) {
    // mortal + a committed pair is contradictory (mortalBoundaryContractViolation)
    // - fail closed, never 'initiation-pending' for a save the contract rejects.
    return { ...entry, state: 'scope-hidden', reason: 'unresolved-way-state' }
  }

  if (mortal) {
    // The whole tree is in beta scope but sits behind the initiation
    // ritual - progression-locked, never scope-hidden.
    return { ...entry, state: 'progression-locked', reason: 'initiation-pending' }
  }

  if (way === null || !isBetaWay(way)) {
    // A committed non-beta way (sword/body/hidden) is out of scope; a
    // way-less non-mortal save is corrupt - both fail closed.
    return {
      ...entry,
      state: 'scope-hidden',
      reason: way === null ? 'unresolved-way-state' : 'non-beta-way',
    }
  }

  // Node-stamp gate: content authored for a non-beta way is out of
  // scope for EVERY beta player - hide it, never surface it as a
  // locked branch (work-order sec.19).
  if (node.requiredWay !== undefined && !isBetaWay(node.requiredWay)) {
    return { ...entry, state: 'scope-hidden', reason: 'non-beta-way' }
  }

  // Route-stamp gate: a node stamped for a path/way DIFFERENT from the
  // player's is out of scope for THIS player - hidden, never a locked
  // branch (a committed way cannot progress into foreign content).
  if (!nodePathApplies(player, node) || !nodeWayApplies(player, node)) {
    return { ...entry, state: 'scope-hidden', reason: 'foreign-stamp' }
  }

  // Element gate BEFORE generic gating (spec sec.8): post-commit the
  // other four branches are scope-hidden - not locked branches. The
  // excludesNode prereq on their roots would otherwise read as
  // progression-locked, which is the wrong lock class.
  if (
    committedElement !== undefined &&
    node.elementTag !== undefined &&
    node.elementTag !== committedElement
  ) {
    return { ...entry, state: 'scope-hidden', reason: 'other-element-branch' }
  }

  // Info anchors render for readability only - the mirrored skill's own
  // channel (casts/grants) owns any level, never Insight; the verdict
  // must not read 'available'/'purchasable' or let a dirty level in
  // nodeLevels pass for 'purchased'.
  if (node.infoSkillId !== undefined) {
    return { ...entry, state: 'progression-locked', reason: 'info-only' }
  }

  if (level >= 1) {
    return { ...entry, state: 'purchased' }
  }

  // Progression gates: authored prereqs + revealWhen rows already sit
  // in entry.prerequisites (gate tags mark the source); path/way stamps
  // resolved above as scope-hidden, so only authored gates decide
  // 'locked' here.
  const progressionGatesMet = entry.prerequisites.every((gate) => gate.met)

  if (!progressionGatesMet) {
    return { ...entry, state: 'progression-locked', reason: 'prerequisites-unmet' }
  }

  if (!canPurchaseNode(player, node)) {
    // All progression gates met but purchase rejected - only Insight
    // can still block it here (the canPurchaseNode failure modes that
    // remain after the checks above are insufficient skillInsight).
    return { ...entry, state: 'available', reason: 'insufficient-insight' }
  }

  return { ...entry, state: 'purchasable' }
}

/**
 * The beta skill-tree surface (spec sec.8): every node in the phap-tu
 * catalog with a canonical per-node state + cost/prereq display fields.
 * Frontend renders nodes; it does not decide states.
 */
export function betaSkillTreeFor(
  player: PlayerData,
  tree: readonly ProgressionNode[] = PHAP_TU_NODES,
): BetaSkillTree {
  const way = getActiveWay(player) ?? null
  const wayDefinition = getActiveWayDefinition(player)
  // getActiveElement resolves only through the owning way's element axis
  // (spell_pathway); undefined covers pre-commit, off-way, and mortal
  // realm (a mortal+way corrupt save reports no committed element).
  const committedElement =
    player.realmId !== 'mortal' && way !== null && isBetaWay(way)
      ? getActiveElement(player)
      : undefined

  return {
    element: committedElement ?? null,
    realmId: player.realmId,
    way,
    // A carried way_out_of_scope pair brands nothing: the subtitle is a
    // verdict surface, the tree body already renders empty.
    wayName:
      way !== null && isBetaWay(way) ? wayDefinition?.name ?? null : null,
    wayNodeTreeTag:
      way !== null && isBetaWay(way)
        ? wayDefinition?.nodeTreeTag
        : undefined,
    elementCasting: hasStaticPathCapability(player, 'spell.elemental_casting'),
    mortal: isPreInitiationMortal(player),
    nodes: tree.map((node) => treeNodeFor(player, node, committedElement, way)),
  }
}

/**
 * The renderable projection - the committed element's branch, or every
 * element-active node pre-commit (the root rows double as the commit
 * picker). Empty when no beta spell tree is renderable at all
 * (non-beta way / corrupt state); for a mortal player the entries stay
 * progression-locked rather than hidden.
 */
export function activeElementTreeFor(
  player: PlayerData,
  tree: readonly ProgressionNode[] = PHAP_TU_NODES,
): BetaSkillTreeNode[] {
  return betaSkillTreeFor(player, tree).nodes.filter(
    (node) => node.state !== 'scope-hidden',
  )
}

// ---------------------------------------------------------------------------
// C. Precursor surfaces (work-order sec.5/19)
// ---------------------------------------------------------------------------

export type BetaPrecursorSurfaceId =
  | 'sword-dynamic-basic'
  | 'an-ultimate-emblem'

export interface BetaPrecursorSurfaceVerdict {
  surface: BetaPrecursorSurfaceId
  state: BetaScopeVerdict
  reason?: string
}

/**
 * Verdicts for the two pre-beta combat surfaces that must stop feeding
 * the beta skill bar:
 *   - 'sword-dynamic-basic'  - Kiem Tu dynamicBasic orb picker
 *     (sword_pathway / hidden_sword providers in TurnCombatSkillBar)
 *   - 'an-ultimate-emblem'   - the ngo_dao_hon_don passive emblem the
 *     hidden spell way renders into the ultimate slot
 *
 * Both compose betaScopeVerdict against the BETA_FEATURES flags
 * ('swordPath' / 'hiddenContent'), so a post-beta flag flip re-opens
 * them automatically. The dormant providers/emblem systems stay
 * untouched; only the surface verdict is pinned here.
 */
export function betaCombatSurfacesFor(
  player: PlayerData,
  deps: PathCapabilityDeps,
): BetaPrecursorSurfaceVerdict[] {
  const swordOffered = isBetaFeature('swordPath')
  const auraOffered = isBetaFeature('hiddenContent')
  const swordProgressionMet = isActivePath(player, 'sword')
  const auraProgressionMet = hasPathCapability(player, 'spell.reaction_aura', deps)

  let swordReason: string | undefined
  let auraReason: string | undefined

  if (!swordOffered) {
    swordReason = 'out-of-beta-scope'
  } else if (!swordProgressionMet) {
    swordReason = 'not-on-sword-way'
  }

  if (!auraOffered) {
    auraReason = 'out-of-beta-scope'
  } else if (!auraProgressionMet) {
    auraReason = 'aura-passive-not-learned'
  }

  return [
    {
      surface: 'sword-dynamic-basic',
      state: betaScopeVerdict({
        offered: swordOffered,
        progressionMet: swordProgressionMet,
      }),
      reason: swordReason,
    },
    {
      surface: 'an-ultimate-emblem',
      state: betaScopeVerdict({
        offered: auraOffered,
        progressionMet: auraProgressionMet,
      }),
      reason: auraReason,
    },
  ]
}
