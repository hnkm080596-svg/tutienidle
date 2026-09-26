import { isCombatAiStrategy, type CombatAiStrategy } from '../battle/CombatAiStrategy'
import type { ElementType } from '../element/ElementType'
import type { NodeOneShotGrantRecord, PlayerData } from '../player/Player'
import type { NodeRegistry } from '../progression/NodeRegistry'
import {
  canPurchaseNode as canPurchaseNodeSystem,
  canUpgradeNode as canUpgradeNodeSystem,
  devResetBranch as devResetBranchSystem,
  computeNodeRefund as computeNodeRefundSystem,
  getNodeLevel as getNodeLevelSystem,
  getNextLevelCost as getNextLevelCostSystem,
  getNodeMaxLevel as getNodeMaxLevelSystem,
  getEffectiveNodeMaxLevel as getEffectiveNodeMaxLevelSystem,
  ownedNodeIds,
  purchaseNode as purchaseNodeSystem,
  respecNodeTree as respecNodeTreeSystem,
  revokeNodeOwnership,
  specializationClaimingNodes,
  upgradeNode as upgradeNodeSystem,
  grantSkillCore,
  type NodeRespecPreview,
} from '../progression/NodeSystem'
import { getSkillCoreLevel, skillCoreNodeId } from '../progression/SkillCoreLevel'
import { CAST_LEVELING_THRESHOLDS } from '../skill/CastLeveling'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { Skill } from '../skill/Skill'
import type { SkillManager } from '../skill/SkillManager'
import type { SkillSystem } from '../skill/SkillSystem'
import { type OrbId } from '../kiem-tu/KiemTuState'
import { isMortalPrecursorSkillId } from '../skill/MortalPrecursors'
import { forgeCost, gainKiemY, grantKiemDao, loseKiemY } from '../kiem-tu/NguKiemDao'
import { isHiddenSwordPathway } from '../kiem-tu/KiemTuPath'
import { validatePreset } from '../kiem-tu/KiemPhoSystem'
import { getRealmIndex } from '../realm/realmSystem'
import { isBattleInProgress } from '../battle/BattleTypes'
import type { CultivationPathRuntime } from '../player/CultivationPathRuntime'
import {
  resolveCombatSkillRoles,
  type ResolvedDefRole,
  type ResolvedSkillRoles,
} from '../player/CultivationPathRoles'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import { collectTalentEffects } from '../talent/TalentEffects'
import { TALENT_PASSIVE_SKILLS } from '../../data/skill/TalentPassives'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '../../data/progression/PhapTuNodes.builders'
import { getActiveElement, hasStaticPathCapability } from '../player/CultivationPathSystem'
import { commitSpellPathElement } from '../phap-tu/PhapTuState'
import { getEffectiveMainStatCap } from '../stats/StatCap'
import type { MainStatKey } from '../stats/StatTypes'
import type { TemplateRegistry } from './TemplateRegistry'

/**
 * Node Tree / combat roles / talent-sync progression operations.
 * Extracted from GameManager (large-file split): owns the orchestration
 * between NodeRegistry + SkillSystem/SkillManager + PlayerData for the
 * purchase/upgrade/role/specialization contract. All rule logic stays
 * in the domain systems (NodeSystem, SkillSystem) - this class only
 * sequences them (A5). Moved verbatim.
 *
 * Public access: `gameManager.progressionOps.*` (no GameManager facade).
 */

// M-F-RESPEC (ruling S14) - commit-marker nodes exempt from every respec
// scope: Phap Tu element roots are only ever obtained through the atomic
// selectSpellPathElement commit (purchaseNode rejects them), so a reset
// that removed one could never be re-invested - the committed element
// would be stranded. The preserve list lives here with the purchase
// rejection that creates the obligation.
const RESPEC_PRESERVED_NODE_IDS: readonly string[] = Object.values(PHAP_TU_ELEMENT_ROOT_IDS)

export class GameManagerProgressionOps {
  constructor(
    private readonly deps: {
      nodeRegistry: NodeRegistry
      skillTemplates: TemplateRegistry<Skill>
      skillSystem: SkillSystem
      skillManager: SkillManager
      getActivePlayer: () => PlayerData | undefined
      // Combat-state read for the node-tree ops' out-of-combat gate
      // (respec/devReset refuse mid-battle). Owned by the
      // battle owner: a retained terminal TurnBattle does NOT count as
      // in-progress, so the gate is a state query, not object existence.
      isTurnBattleInProgress: () => boolean
      // Deferred closure - turnBattleOps is assigned after this ops class
      // is constructed (same pattern as realmAdvanceOps/effectOps).
      getTurnBattle: () => TurnBattle | null
      // Session rng seam (F-W-7) - GameManager-owned injectable stream so
      // deterministic harnesses can pin the Van Dao free-purchase roll.
      sessionRng: () => number
      // P7-M4 - the SHARED override-aware path-runtime binding (the
      // GameManager owns the override so combat + this UI accessor
      // resolve identically; setPathRuntimeResolver affects both).
      resolvePathRuntime: (player: PlayerData) => CultivationPathRuntime
      // M-QI-05 - Insight-channel level-up notification (GameManager
      // owns notifications; the cast channel notifies via the
      // castCountSink instead - one owner per channel).
      onSkillLevelUp?: (skillId: string, newLevel: number, levelsGained: number) => void
    },
  ) {}

  /**
   * Talent v4 (spec 2026-09-03 sec.4.1) - grant/revoke the hidden passive
   * skill of the currently-chosen combat talents into SkillManager.
   * Idempotent: revokes every old talent passive before granting (talent
   * swapped via save edit does not double up, no leak between players).
   * Called after setActivePlayer/restore + after App.vue writes
   * selectedTalentIds at character creation.
   */
  syncTalentCombatPassive(player: PlayerData) {
    const allTalentPassiveIds = TALENT_PASSIVE_SKILLS.map((skill) => skill.id)

    // Revoke every current talent passive first (granting right after is
    // easy; guarantees idempotent + no stale passive on talent swap).
    for (const passiveId of allTalentPassiveIds) {
      if (this.deps.skillManager.get(passiveId)) {
        this.deps.skillManager.remove(passiveId)
      }
    }

    // M-F-TALENT: every owned talent contributes (multi-ownership +
    // per-level effects supersede the v4 first-id clamp) - a combat
    // talent declares 1-2 combat_passive effects. M-QI-05 - the
    // canonical learn funnel owns insertion (TALENT_PASSIVE_SKILLS are
    // registered templates; learn()'s structuredClone covers the
    // per-battle passiveModifiers copy the old direct add needed).
    for (const effect of collectTalentEffects(player.selectedTalentIds, player.talentLevels)) {
      if (effect.kind === 'combat_passive') {
        this.learnSkill(effect.passiveSkillId, player)
      }
    }
  }

  /**
   * Phap Tu Reimagined (Task 6B) - the player's chosen Phap Tu element.
   * PlayerData.spellPath is the sole authority (committed atomically by
   * selectSpellPathElement); lap_dao_thuan_<el> keystones no longer exist.
   * undefined = not Phap Tu / element not chosen yet.
   */
  getSpellPathElement(): ElementType | undefined {
    const activePlayer = this.deps.getActivePlayer()

    // P1 - the canonical subpath read owns the way gate (element axis
    // requires 'spell.elemental_casting' on the active way).
    return activePlayer === undefined ? undefined : getActiveElement(activePlayer)
  }

  /**
   * M-QI-05 - canonical learn seam. Atomic preflight BEFORE any
   * SkillManager mutation: a levelled template (maxLevel > 1) must
   * resolve a registered Core Node (id convention + levelsSkillId +
   * maxLevel match) - a missing/mismatched core is a data integrity
   * failure, never a silent partial learn. On success the core is
   * granted (nodeLevels[core] = 1 + mirror) via NodeSystem.
   */
  learnSkill(skillId: string, player: PlayerData): boolean {
    const template = this.deps.skillTemplates.get(skillId)

    if (!template) {
      return false
    }

    const core = template.maxLevel > 1 ? this.resolveSkillCore(skillId) : undefined

    if (template.maxLevel > 1 && (core === undefined || (core.maxLevel ?? 1) !== template.maxLevel)) {
      return false
    }

    if (!this.deps.skillSystem.learn(template)) {
      return false
    }

    if (template.maxLevel > 1) {
      grantSkillCore(player, this.deps.nodeRegistry.get(skillCoreNodeId(skillId)))
    }

    return true
  }

  /** Registered core node for a skill, or undefined on any mismatch. */
  private resolveSkillCore(skillId: string): ProgressionNode | undefined {
    const coreId = skillCoreNodeId(skillId)

    if (!this.deps.nodeRegistry.has(coreId)) {
      return undefined
    }

    const node = this.deps.nodeRegistry.get(coreId)

    return node.levelsSkillId === skillId ? node : undefined
  }

  /**
   * M-QI-05 - preflight a learnable skill id: template must exist AND,
   * when the template is levelled, its registered core must resolve
   * (levelsSkillId + maxLevel match). Used by purchase/unlock/ritual
   * preflights so a missing core fails the whole transaction BEFORE
   * insight is spent or the path commits.
   */
  preflightLearnableSkill(skillId: string): boolean {
    const template = this.deps.skillTemplates.get(skillId)

    if (!template) {
      return false
    }

    if (template.maxLevel <= 1) {
      return true
    }

    const core = this.resolveSkillCore(skillId)

    return core !== undefined && (core.maxLevel ?? 1) === template.maxLevel
  }

  /**
   * Preflight a grantsSkillCoreIds / coreSkillIds member: registered
   * core with matching levelsSkillId AND the authored catalog's
   * maxLevel - a tampered/mismatched native core fails BEFORE the
   * purchase/ritual commits (spec oracle 13).
   */
  preflightSkillCoreGrant(skillId: string): boolean {
    const core = this.resolveSkillCore(skillId)
    const authored = SKILL_CORE_NODES.find((node) => node.levelsSkillId === skillId)

    return (
      core !== undefined &&
      authored !== undefined &&
      (core.maxLevel ?? 1) === (authored.maxLevel ?? 1)
    )
  }

  /**
   * Grant a registered Core Node by skill id (ritual way.coreSkillIds,
   * node grantsSkillCoreIds). Returns false on a missing/mismatched
   * core - callers preflight so this never silently fails post-commit.
   */
  grantSkillCoreBySkillId(player: PlayerData, skillId: string): boolean {
    const core = this.resolveSkillCore(skillId)

    if (!core) {
      return false
    }

    grantSkillCore(player, core)

    return true
  }

  /**
   * Phap Tu Redesign (magicpath) - purchase 1 ProgressionNode (LINH NGO,
   * 0->1). Calls the pure `purchaseNode()` (core/progression/NodeSystem.ts)
   * first - that function handles everything registry-free. Only
   * `unlocksSkillIds` still needs learnSkill() (skillTemplates live here).
   * Does NOT auto-equip the newly unlocked skill.
   *
   * sec.6.8 - no more Skill-instance mutation / player.modifiers push at
   * purchase: every effect is derived from (registry, nodeLevels) via
   * getAggregatedModifiers, always recomputed for the same deterministic
   * result.
   */
  purchaseNode(nodeId: string, player: PlayerData): boolean {
    if (!this.deps.nodeRegistry.has(nodeId)) {
      return false
    }

    // Phap Tu Reimagined (Task 6) - element roots commit through the
    // atomic selectSpellPathElement() only; public purchase of a root
    // would bypass the commit's learnable-skill preflight.
    if (
      (Object.values(PHAP_TU_ELEMENT_ROOT_IDS) as string[]).includes(nodeId)
    ) {
      return false
    }

    const node = this.deps.nodeRegistry.get(nodeId)

    // M-QI-05 - transaction boundary (same discipline as
    // selectSpellPathElement): every unlocked skill must be learnable
    // (template + levelled-skill core) and every granted core must be
    // registered BEFORE insight is spent.
    for (const skillId of node.effect.unlocksSkillIds ?? []) {
      if (!this.preflightLearnableSkill(skillId)) {
        return false
      }
    }

    for (const skillId of node.effect.grantsSkillCoreIds ?? []) {
      if (!this.preflightSkillCoreGrant(skillId)) {
        return false
      }
    }

    if (!purchaseNodeSystem(player, node, this.deps.sessionRng)) {
      return false
    }

    // Skill-unlock effects only run on the 0 -> 1 transition -
    // purchaseNodeSystem only returns true exactly on that transition.
    const learnedSkillIds: string[] = []

    for (const skillId of node.effect.unlocksSkillIds ?? []) {
      if (this.learnSkill(skillId, player)) {
        learnedSkillIds.push(skillId)
      }
    }

    for (const skillId of node.effect.grantsSkillCoreIds ?? []) {
      grantSkillCore(player, this.deps.nodeRegistry.get(skillCoreNodeId(skillId)))
    }

    // Phap Tu Thuan He (E-8, 2026-09-03) - variant node: purchasing the
    // node CHOOSES the skill's specialization via SkillSystem (same path
    // as the UI's selectSkillSpecialization). Skill not learned / spec
    // missing -> selectSpecialization returns false, purchase is NOT
    // rolled back (Task 8 data guarantees the unlocksSkillIds prereq ran
    // earlier in the loop above).
    const selectsSpec = node.effect.selectsSpecialization
    const selectsSpecApplied =
      selectsSpec !== undefined &&
      this.deps.skillSystem.selectSpecialization(selectsSpec.skillId, selectsSpec.specializationId)

    // Kiem Tu Reimagined Task 11 (spec sec.5.4/sec.6) - Cuu Cung grants run
    // through the NguKiemDao domain functions (the domain owns the cap
    // rule; nodes never touch player.swordPath directly). The
    // kiemDaoBelowCap prereq already blocked capped buys upstream.
    if (node.effect.kiemYGrant) {
      gainKiemY(player, node.effect.kiemYGrant)
    }

    if (node.effect.kiemDaoGrant) {
      grantKiemDao(player, node.effect.kiemDaoGrant)
    }

    // F-W-2 - record provenance CHI cho grant thuc su phat: learned
    // chi khi learnSkill tra true (skill hoc san tu ritual/root/way kit
    // khong ghi -> clawback khong the tuoc nham grant nguon khac);
    // kiemY chi ghi khi pool thuc su nhan (mo phong guard cua gainKiemY);
    // grantsSkillCoreIds khong ghi - revokeNodeOwnership cascade tu lo.
    const grantRecord: NodeOneShotGrantRecord = {}

    if (learnedSkillIds.length > 0) {
      grantRecord.learnedSkillIds = learnedSkillIds
    }

    if (node.effect.kiemYGrant && player.swordPath && isHiddenSwordPathway(player)) {
      grantRecord.kiemY = node.effect.kiemYGrant
    }

    if (node.effect.kiemDaoGrant && player.swordPath && isHiddenSwordPathway(player)) {
      grantRecord.kiemDao = node.effect.kiemDaoGrant
    }

    if (selectsSpecApplied && selectsSpec) {
      grantRecord.specializationSkillId = selectsSpec.skillId
      grantRecord.specializationId = selectsSpec.specializationId
    }

    if (Object.keys(grantRecord).length > 0) {
      player.nodeOneShotGrants[node.id] = grantRecord
    }

    return true
  }

  /**
   * F-W-2 - thu hoi dung cac one-shot grant ma node bi revoke da phat,
   * chay SAU commit cua respec/devReset (revokedOut da phan
   * anh dung set node bi go). Pure field mutation, KHONG throw - dry-run
   * cua respecApply da validate atomicity cua node-set roi.
   *
   * Bounds (documented): swords da merge vao kiemDaoBase khong un-merge
   * (residual cua loseKiemY hap thu); cast counts giu lai; grant tu
   * nguon khac khong bao gio trong record.
   *
   * Tra ve tong Insight ma cac leg da hoan lai vao player.skillInsight
   * (hien chi core refund) - caller cong vao refund domain de bao cao
   * dung tong, khop previewNodeRespec.
   */
  applyOneShotClawback(player: PlayerData, revokedNodeIds: ReadonlySet<string>): number {
    let clawbackRefund = 0

    for (const nodeId of revokedNodeIds) {
      const record = player.nodeOneShotGrants[nodeId]

      if (!record) {
        continue
      }

      for (const skillId of record.learnedSkillIds ?? []) {
        // Dual-source guard: neu mot node con so huu khac cung unlock
        // skill nay thi membership phai song tiep. Authority la
        // nodeLevels (grant ghi o do); purchasedNodeIds chi la mirror
        // nen phai doc ca hai de khong bo sot node grant-owned.
        const stillGrantedElsewhere = ownedNodeIds(player).some((ownedId) => {
          const owned = this.deps.nodeRegistry.has(ownedId)
            ? this.deps.nodeRegistry.get(ownedId)
            : undefined

          return owned?.effect.unlocksSkillIds?.includes(skillId) ?? false
        })

        if (stillGrantedElsewhere) {
          continue
        }

        this.deps.skillSystem.unlearn(skillId)

        // Core <skill> duoc grant kem membership - revoke qua cung
        // funnel (refund Insight da do vao core levels: hop ly vi so
        // Insight do di theo skill do node cap). Dual-source guard
        // giong skill leg: mot node con so huu khac grant core nay qua
        // grantsSkillCoreIds thi core phai song tiep - D9d save
        // validation bat moi grantsSkillCoreIds member ton tai.
        const coreId = skillCoreNodeId(skillId)
        const coreStillGranted = ownedNodeIds(player).some((ownedId) => {
          const owned = this.deps.nodeRegistry.has(ownedId)
            ? this.deps.nodeRegistry.get(ownedId)
            : undefined

          return owned?.effect.grantsSkillCoreIds?.includes(skillId) ?? false
        })

        if (!coreStillGranted && this.deps.nodeRegistry.has(coreId)) {
          const coreRefund = revokeNodeOwnership(
            player,
            this.deps.nodeRegistry.get(coreId),
            this.deps.nodeRegistry,
          )

          player.skillInsight += coreRefund
          clawbackRefund += coreRefund
        }
      }

      if (record.kiemY) {
        loseKiemY(player, record.kiemY)
      }

      if (record.kiemDao) {
        const state = player.swordPath

        if (state) {
          state.kiemDaoCount = Math.max(0, state.kiemDaoCount - record.kiemDao)
        }
      }

      if (record.specializationSkillId && record.specializationId) {
        // Dual-source guard: giong chan skill leg - neu mot node con
        // so huu khac cung claim spec nay thi spec phai song tiep. Do
        // voi tap claimant day du (dau tien trong registry khong phai
        // claimant duy nhat hop le).
        const specStillClaimed = specializationClaimingNodes(
          this.deps.nodeRegistry,
          record.specializationSkillId,
          record.specializationId,
        ).some((claimant) => ownedNodeIds(player).includes(claimant.id))

        if (specStillClaimed) {
          delete player.nodeOneShotGrants[nodeId]
          continue
        }

        // selectsSpecialization viet len skill instance - chi clear khi
        // spec hien tai van la spec record do (chon spec khac sau nay
        // khong phai viec cua grant nay).
        this.deps.skillSystem.clearSpecialization(
          record.specializationSkillId,
          record.specializationId,
        )
      }

      delete player.nodeOneShotGrants[nodeId]
    }

    return clawbackRefund
  }

  /**
   * Phap Tu Reimagined (Task 6) - the ONLY public writer of
   * player.spellPath.element. Atomic: validates eligibility +
   * root purchasability FIRST, then purchases the element root through
   * the generic NodeSystem primitive, applies unlock effects, and
   * finally commits { element }. Any failure leaves spellPath
   * untouched. (Reimagined spec: the route half of the old atomic
   * (element, route) commitment is retired - element alone commits.)
   */
  selectSpellPathElement(element: ElementType, player: PlayerData): boolean {
    // Out-of-combat contract -- same guard as devResetBranch: the live
    // battle loadout is snapshotted, so a mid-battle element commit
    // would silently split party state.
    if (this.deps.isTurnBattleInProgress()) {
      return false
    }
    // Cultivation Path Framework (M4, R6): element machinery is
    // spell_pathway-only - P1 - the declared 'spell.elemental_casting'
    // capability is the gate, so the post-M7 collapsed ('spell',
    // 'hidden_spell_pathway') shape cannot commit an element. The requiredWay stamp
    // on PHAP_TU_NODES is the second layer.
    if (!hasStaticPathCapability(player, 'spell.elemental_casting')) {
      return false
    }

    if (player.spellPath.element !== null) {
      return false
    }

    const rootId = PHAP_TU_ELEMENT_ROOT_IDS[element]

    if (!rootId || !this.deps.nodeRegistry.has(rootId)) {
      return false
    }

    const root = this.deps.nodeRegistry.get(rootId)

    if (!canPurchaseNodeSystem(player, root)) {
      return false
    }

    // Transaction boundary (review round-4, atomicity hardening): every
    // skill the root unlocks must be learnable BEFORE the purchase
    // spends insight + commits { element } - a missing template
    // would leave the element committed without its basic. M-QI-05 -
    // the same boundary now covers levelled-skill cores and
    // grantsSkillCoreIds members.
    for (const skillId of root.effect.unlocksSkillIds ?? []) {
      if (!this.preflightLearnableSkill(skillId)) {
        return false
      }
    }

    for (const skillId of root.effect.grantsSkillCoreIds ?? []) {
      if (!this.preflightSkillCoreGrant(skillId)) {
        return false
      }
    }

    if (!purchaseNodeSystem(player, root, this.deps.sessionRng)) {
      return false
    }

    for (const skillId of root.effect.unlocksSkillIds ?? []) {
      this.learnSkill(skillId, player)
    }

    for (const skillId of root.effect.grantsSkillCoreIds ?? []) {
      grantSkillCore(player, this.deps.nodeRegistry.get(skillCoreNodeId(skillId)))
    }

    commitSpellPathElement(player, element)

    return true
  }

  /**
   * Upgrade a comprehended node by +1 level with Cam Ngo (sec.6.2) - cost
   * per node data; cannot exceed maxLevel; failure mutates nothing.
   */
  upgradeNode(nodeId: string, player: PlayerData): boolean {
    if (!this.deps.nodeRegistry.has(nodeId)) {
      return false
    }

    return upgradeNodeSystem(player, this.deps.nodeRegistry.get(nodeId), this.deps.sessionRng)
  }

  getNodeLevel(nodeId: string, player: PlayerData): number {
    return this.deps.nodeRegistry.has(nodeId) ? getNodeLevelSystem(player, nodeId) : 0
  }

  getNodeMaxLevel(nodeId: string): number {
    return this.deps.nodeRegistry.has(nodeId) ? getNodeMaxLevelSystem(this.deps.nodeRegistry.get(nodeId)) : 0
  }

  /** Cam Ngo cost of the NEXT purchase/upgrade - undefined when maxed
   *  or parked at a level-gate effective cap (M-QI-06). */
  getNextNodeCost(nodeId: string, player: PlayerData): number | undefined {
    if (!this.deps.nodeRegistry.has(nodeId)) {
      return undefined
    }

    const node = this.deps.nodeRegistry.get(nodeId)

    const level = getNodeLevelSystem(player, nodeId)

    if (level >= getEffectiveNodeMaxLevelSystem(player, node)) {
      return undefined
    }

    return getNextLevelCostSystem(node, level)
  }

  canPurchaseNode(nodeId: string, player: PlayerData): boolean {
    if (!this.deps.nodeRegistry.has(nodeId)) {
      return false
    }

    const node = this.deps.nodeRegistry.get(nodeId)

    return canPurchaseNodeSystem(player, node)
  }

  canUpgradeNode(nodeId: string, player: PlayerData): boolean {
    return (
      this.deps.nodeRegistry.has(nodeId) && canUpgradeNodeSystem(player, this.deps.nodeRegistry.get(nodeId))
    )
  }

  /**
   * Dev-reset a branch (sec.6.10) - refunds exactly the total Cam Ngo spent
   * (derived from level/cost data), cascades orphan child nodes; modifiers
   * update via the aggregators (no reverse subtraction of old modifiers).
   */
  devResetBranch(branchTag: string, player: PlayerData): number | null {
    // Same out-of-combat contract as respecNodeTree: node
    // investment is static during battle, so a mid-battle reset is
    // refused even though this op is dev-console only today.
    if (this.deps.isTurnBattleInProgress()) {
      return null
    }

    const revoked = new Set<string>()
    const refund = devResetBranchSystem(player, this.deps.nodeRegistry, branchTag, revoked)

    return refund + this.applyOneShotClawback(player, revoked)
  }

  /**
   * M-F-RESPEC (ruling S14) - read-only respec projection for the
   * confirm dialog. Phap Tu element roots ride along as preserveIds -
   * the same layer that rejects their public purchase (they commit
   * via selectSpellPathElement only) exempts them from the reset, so a
   * respec can never strand a committed element without its root.
   */
  previewNodeRespec(player: PlayerData, scope?: { rootId?: string }): NodeRespecPreview {
    // JSON round-trip (not structuredClone): callers hand in the Pinia
    // reactive state; PlayerData is what the save system serializes.
    const sim = JSON.parse(JSON.stringify(player)) as PlayerData

    const revoked = new Set<string>()
    const refund = respecNodeTreeSystem(sim, this.deps.nodeRegistry, {
      ...scope,
      preserveIds: RESPEC_PRESERVED_NODE_IDS,
    }, revoked)

    const clawback = this.dryRunOneShotClawback(sim, revoked)

    const resetNodeIds = Object.keys(player.nodeLevels ?? {}).filter(
      id => !(id in (sim.nodeLevels ?? {})),
    )

    return {
      refund: refund + clawback.refund,
      resetNodeIds,
      resetCount: resetNodeIds.length,
      clawback,
    }
  }

  /**
   * Dry-run the one-shot-grant clawback analytically: mirror every leg
   * of applyOneShotClawback on the post-revocation sim without
   * SkillSystem writes (SkillManager is a live registry, not part of
   * PlayerData).
   */
  private dryRunOneShotClawback(
    sim: PlayerData,
    revoked: Set<string>,
  ): NonNullable<NodeRespecPreview['clawback']> {
    const clawback: NonNullable<NodeRespecPreview['clawback']> = {
      refund: 0,
      removedNodeIds: [],
      unlearnedSkillIds: [],
      clearedSpecializations: [],
      kiemY: 0,
      kiemDao: 0,
    }

    for (const nodeId of revoked) {
      const record = sim.nodeOneShotGrants[nodeId]

      if (!record) {
        continue
      }

      for (const skillId of record.learnedSkillIds ?? []) {
        const stillGrantedElsewhere = ownedNodeIds(sim).some((ownedId) => {
          const owned = this.deps.nodeRegistry.has(ownedId)
            ? this.deps.nodeRegistry.get(ownedId)
            : undefined

          return owned?.effect.unlocksSkillIds?.includes(skillId) ?? false
        })

        if (stillGrantedElsewhere) {
          continue
        }

        if (
          this.deps.skillManager.has(skillId) &&
          !clawback.unlearnedSkillIds.includes(skillId)
        ) {
          clawback.unlearnedSkillIds.push(skillId)
        }

        const coreId = skillCoreNodeId(skillId)
        // Dual-source guard giong apply: core song tiep khi mot node
        // con so huu van grant no qua grantsSkillCoreIds (D9d).
        const coreStillGranted = ownedNodeIds(sim).some((ownedId) => {
          const owned = this.deps.nodeRegistry.has(ownedId)
            ? this.deps.nodeRegistry.get(ownedId)
            : undefined

          return owned?.effect.grantsSkillCoreIds?.includes(skillId) ?? false
        })

        if (!coreStillGranted && this.deps.nodeRegistry.has(coreId) && !this.deps.nodeRegistry.get(coreId).rewardOnly) {
          const core = this.deps.nodeRegistry.get(coreId)
          const level = getNodeLevelSystem(sim, coreId)
          const coreRefund = computeNodeRefundSystem(
            core,
            level,
            sim.nodeFreePurchaseRecord?.[coreId],
          )
          clawback.refund += coreRefund

          if (coreId in sim.nodeLevels) {
            delete sim.nodeLevels[coreId]
            clawback.removedNodeIds.push(coreId)
          }

          const index = sim.purchasedNodeIds.indexOf(coreId)

          if (index !== -1) {
            sim.purchasedNodeIds.splice(index, 1)
          }

          if (sim.nodeFreePurchaseRecord) {
            delete sim.nodeFreePurchaseRecord[coreId]
          }
        }
      }

      if (record.kiemY && sim.swordPath) {
        const debited = Math.min(sim.swordPath.kiemY, record.kiemY)
        sim.swordPath.kiemY -= debited
        clawback.kiemY += debited

        const residual = record.kiemY - debited
        const realmIndex = getRealmIndex(sim.realmId)

        if (residual > 0 && realmIndex >= 1) {
          const swords = Math.min(
            sim.swordPath.kiemDaoCount,
            Math.ceil(residual / forgeCost(realmIndex)),
          )

          sim.swordPath.kiemDaoCount -= swords
          clawback.kiemDao += swords
        }
      }

      if (record.kiemDao && sim.swordPath) {
        const removed = Math.min(record.kiemDao, sim.swordPath.kiemDaoCount)
        sim.swordPath.kiemDaoCount -= removed
        clawback.kiemDao += removed
      }

      if (record.specializationSkillId && record.specializationId) {
        const stillClaimed = specializationClaimingNodes(
          this.deps.nodeRegistry,
          record.specializationSkillId,
          record.specializationId,
        ).some((claimant) => ownedNodeIds(sim).includes(claimant.id))

        if (
          !stillClaimed &&
          this.deps.skillManager.get(record.specializationSkillId)
            ?.selectedSpecializationId === record.specializationId
        ) {
          clawback.clearedSpecializations.push({
            skillId: record.specializationSkillId,
            specializationId: record.specializationId,
          })
        }
      }

      delete sim.nodeOneShotGrants[nodeId]
    }

    return clawback
  }

  /**
   * M-F-RESPEC (ruling S14) - player-facing FREE Beta respec: revoke
   * node investment and refund 100% of actually-paid Insight. Out of
   * combat ONLY (same guard as devResetBranch). scope.rootId scopes the
   * reset to that subtree root; omitted = the whole NodeTree. Returns
   * the refunded Insight, or null when rejected in battle.
   */
  respecNodeTree(player: PlayerData, scope?: { rootId?: string }): number | null {
    if (this.deps.isTurnBattleInProgress()) {
      return null
    }

    const revoked = new Set<string>()
    const refund = respecNodeTreeSystem(player, this.deps.nodeRegistry, {
      ...scope,
      preserveIds: RESPEC_PRESERVED_NODE_IDS,
    }, revoked)

    return refund + this.applyOneShotClawback(player, revoked)
  }

  /**
   * skill-insight-and-auto-combat-hud-plan.md sec.5 - upgrade a skill with
   * Skill Insight, pure passthrough to SkillSystem (already has
   * skillManager via its own constructor, needs nothing else here).
   */
  /**
   * M-QI-05 / QI-D3 - the canonical Insight channel for skill levels:
   * resolves the skill's Core Node and upgrades it through NodeSystem
   * (costs/gating/maxed checks live there - cast-channel cores reject
   * at canUpgradeNode). Emits the level-up notification through the
   * injected dep so GameManager stays the notification owner.
   */
  levelUpSkill(skillId: string, player: PlayerData): boolean {
    const coreId = skillCoreNodeId(skillId)

    if (!this.deps.nodeRegistry.has(coreId)) {
      return false
    }

    const node = this.deps.nodeRegistry.get(coreId)

    if (node.levelsSkillId !== skillId) {
      return false
    }

    const prior = getNodeLevelSystem(player, coreId)

    if (!upgradeNodeSystem(player, node, this.deps.sessionRng)) {
      return false
    }

    this.deps.onSkillLevelUp?.(skillId, prior + 1, 1)

    return true
  }

  /** Canonical level read for UI - 0 when the core is ungranted. */
  getSkillLevel(skillId: string, player: PlayerData): number {
    return getSkillCoreLevel(player, skillId)
  }

  /** Max level of the skill's registered core (1 when none exists). */
  getSkillCoreMaxLevel(skillId: string): number {
    const coreId = skillCoreNodeId(skillId)

    return this.deps.nodeRegistry.has(coreId)
      ? getNodeMaxLevelSystem(this.deps.nodeRegistry.get(coreId))
      : 1
  }

  /**
   * Insight cost of the NEXT core level - undefined when the core is
   * ungranted, missing, maxed, or Insight-ineligible (cast channel).
   * Deliberately NOT gated on current skillInsight - the detail UI shows
   * the cost on a disabled button; affordability is canUpgrade's job.
   */
  getSkillCoreUpgradeCost(skillId: string, player: PlayerData): number | undefined {
    const coreId = skillCoreNodeId(skillId)

    if (!this.deps.nodeRegistry.has(coreId)) {
      return undefined
    }

    const node = this.deps.nodeRegistry.get(coreId)

    if (node.levelsSkillId !== skillId || CAST_LEVELING_THRESHOLDS[skillId] !== undefined) {
      return undefined
    }

    const level = getNodeLevelSystem(player, coreId)

    // M-QI-06 - effective cap read: a gated core level never previews
    // an Insight cost (cores carry no levelGates today, but the
    // accessor must not contradict canUpgradeNode if one is authored).
    if (level < 1 || level >= getEffectiveNodeMaxLevelSystem(player, node)) {
      return undefined
    }

    return getNextLevelCostSystem(node, level)
  }

  /**
   * PLAN HOAN CHINH sec.2 - spend 1 attributePoint into EXACTLY 1 Main Stat.
   * No-op (returns false) when out of points or the stat hit the current
   * major-realm cap (getEffectiveMainStatCap() - hidden-perfection
   * completed bodies raise the cap, design 2026-09-23 sec.7) - cap is
   * per-stat, there is NO shared cap across all 5 (per the doc's
   * "Nguyen tac" sec.2).
   */
  allocateAttributePoint(player: PlayerData, stat: MainStatKey): boolean {
    if (player.attributePoints <= 0) {
      return false
    }

    if (player.baseStats[stat] >= getEffectiveMainStatCap(player)) {
      return false
    }

    player.attributePoints--
    player.baseStats[stat]++

    return true
  }

  /**
   * P7-M4 - the ONLY role write in the game: pick which learned
   * precursor the mortal player fights with. Mortal-scoped - once ANY
   * cultivation path is chosen the pick can never be written (the K3
   * precursor gate). SkillManager membership is the learned authority
   * (spec sec.4.3a - a held entry IS learned). The realm term mirrors
   * the v82 save preflight (mortal = realmId 'mortal' + pathless) so a
   * write can never produce a state restore would reject.
   */
  setMortalBasicSkill(player: PlayerData, skillId: string): boolean {
    if (player.realmId !== 'mortal' || player.cultivationPath !== undefined) {
      return false
    }

    if (!isMortalPrecursorSkillId(skillId)) {
      return false
    }

    if (!this.deps.skillManager.has(skillId)) {
      return false
    }

    // learned=>core leg of the boundary contract - mirror it here so
    // the write guard covers the full three-channel contract instead
    // of relying on learnSkill's atomic grant staying invariant.
    if (getSkillCoreLevel(player, skillId) < 1) {
      return false
    }

    player.mortalBasicSkillId = skillId

    return true
  }

  /**
   * P7-M4 - the resolved-role read for the UI (the retired
   * getLoadoutSkills/getActiveSkills display surface). Consumes the SAME
   * override-aware path-runtime binding combat uses (deps.resolvePathRuntime
   * is the shared GameManager binding - setPathRuntimeResolver affects
   * both), then composes roles through the shared seam: emblem
   * precedence, nominal-vs-dynamic basic are already resolved.
   *
   * Dynamic basics (sword ways) surface as {kind:'dynamic'} with the
   * provider's display label - there is no def to show.
   */
  getResolvedSkillRoles(player: PlayerData): ResolvedSkillRoles {
    const runtime = this.deps.resolvePathRuntime(player)
    const roles = resolveCombatSkillRoles(player, runtime)
    // TurnSkillDefinition carries no display name - resolve learned
    // instance first, then the authored template, then the raw id.
    const decorate = (def?: TurnSkillDefinition): ResolvedDefRole | undefined => {
      if (def === undefined) {
        return undefined
      }

      const skill = this.deps.skillManager.get(def.id)

      return {
        def,
        name: skill?.name ?? this.deps.skillTemplates.get(def.id)?.name ?? def.id,
        skill,
      }
    }

    return {
      basic: roles.basicIsDynamic
        ? {
            kind: 'dynamic',
            label: runtime.describeDynamicBasic?.().name ?? 'Cơ Bản',
          }
        : { kind: 'def', def: roles.basic, name: decorate(roles.basic)!.name, skill: this.deps.skillManager.get(roles.basic.id) },
      special: decorate(roles.special),
      ultimate: decorate(roles.ultimate),
    }
  }

  /**
   * Kiem Tu Reimagined (spec sec.6) - write the sword_pathway preset. Persisted on
   * PlayerData.swordPath.preset; the battle cursor/log are runtime-only and
   * never persist. Out-of-combat only: a mid-battle rewrite would desync
   * the provider's snapshotted preset from PlayerData.
   */
  setKiemPhoPreset(player: PlayerData, preset: OrbId[]): boolean {
    // M6 - way membership is the gate (the retired swordPath.mode
    // discriminator became cultivationWay; preset is sword_pathway machinery).
    // P1 - the 'sword.sword_scroll' capability carries that membership.
    if (!player.swordPath || !hasStaticPathCapability(player, 'sword.sword_scroll')) {
      return false
    }

    if (isBattleInProgress(this.deps.getTurnBattle()?.state)) {
      return false
    }

    if (!validatePreset(preset, getRealmIndex(player.realmId))) {
      return false
    }

    player.swordPath.preset = [...preset]

    return true
  }

  /**
   * Combat AI strategy (plan sec.10) - PlayerData is the single source of
   * truth; the UI keeps no state of its own. Validated through the shared
   * isCombatAiStrategy(); returns false on a bad value. Saved via the
   * existing save scheduling (autosave/visibilitychange) after the UI
   * bumpState().
   */
  setCombatAiStrategy(player: PlayerData, strategy: CombatAiStrategy): boolean {
    if (!isCombatAiStrategy(strategy)) {
      return false
    }

    player.combatAiStrategy = strategy

    return true
  }

  // Core Loop Foundation checklist (Muc SKILL) - "behavior-changing node".
  // Three-path design (2026-09-25): capstone/variant nodes OWN the claim
  // on the specialization they select - the free-switch chip path must
  // hold the claiming node or the 3-Insight cost / realm prereq /
  // excludesNode mutex are all bypassed. Unclaimed specs switch freely.
  selectSkillSpecialization(skillId: string, specializationId: string, player: PlayerData): boolean {
    const claimants = specializationClaimingNodes(this.deps.nodeRegistry, skillId, specializationId)

    // F-PT-C-3 - claim gate reads the same ownership mirror as clawback:
    // ownedNodeIds union (nodeLevels + purchasedNodeIds). nodeLevels-only
    // would disagree with the clawback leg on diverged crafted saves.
    // Any owned claimant authorizes the spec (first registry hit is not
    // the only legitimate owner when nodes share a claim).
    if (claimants.length > 0 && !claimants.some((claimant) => ownedNodeIds(player).includes(claimant.id))) {
      return false
    }

    return this.deps.skillSystem.selectSpecialization(skillId, specializationId)
  }

  // F-PT-INT-2 - load-time reconcile for stale spec claims: a selection
  // made before the claim gate existed (or via a crafted save) may name
  // a spec whose claiming node was never owned. Clear it - the spec
  // gate above means the player can re-pick freely once the claimer is
  // legitimately held.
  reconcileSpecClaims(player: PlayerData): void {
    for (const skill of this.deps.skillManager.getAll()) {
      const specId = skill.selectedSpecializationId
      if (specId === undefined) {
        continue
      }
      const claimants = specializationClaimingNodes(this.deps.nodeRegistry, skill.id, specId)
      if (claimants.length > 0 && !claimants.some((claimant) => ownedNodeIds(player).includes(claimant.id))) {
        this.deps.skillSystem.clearSpecialization(skill.id, specId)
      }
    }
  }
}
