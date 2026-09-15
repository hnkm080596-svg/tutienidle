import { isCombatAiStrategy, type CombatAiStrategy } from '../battle/CombatAiStrategy'
import type { ElementType } from '../element/ElementType'
import type { PlayerData } from '../player/Player'
import type { NodeRegistry } from '../progression/NodeRegistry'
import {
  canPurchaseNode as canPurchaseNodeSystem,
  canUpgradeNode as canUpgradeNodeSystem,
  devResetBranch as devResetBranchSystem,
  getNodeLevel as getNodeLevelSystem,
  getNextLevelCost as getNextLevelCostSystem,
  getNodeMaxLevel as getNodeMaxLevelSystem,
  purchaseNode as purchaseNodeSystem,
  switchRoute as switchRouteSystem,
  upgradeNode as upgradeNodeSystem,
} from '../progression/NodeSystem'
import type { Skill } from '../skill/Skill'
import type { SkillManager } from '../skill/SkillManager'
import type { SkillSystem } from '../skill/SkillSystem'
import { getSkillLoadoutSlotCount } from '../skill/SkillLoadoutSlots'
import { collectTalentEffects } from '../talent/TalentEffects'
import { TALENT_PASSIVE_SKILLS, getTalentPassiveSkill } from '../../data/skill/TalentPassives'
import { PHAP_TU_KIT_IDS } from '../../data/skill/Skills'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '../../data/progression/PhapTuNodes.builders'
import type { PhapTuRoute } from '../phap-tu/PhapTuState'
import { getMainStatCap } from '../stats/StatCap'
import type { MainStatKey } from '../stats/StatTypes'
import type { TemplateRegistry } from './TemplateRegistry'

/**
 * Node Tree / skill loadout / talent-sync progression operations.
 * Extracted from GameManager (large-file split): owns the orchestration
 * between NodeRegistry + SkillSystem/SkillManager + PlayerData for the
 * purchase/upgrade/loadout/specialization contract. All rule logic stays
 * in the domain systems (NodeSystem, SkillSystem) - this class only
 * sequences them (A5). Moved verbatim.
 *
 * Public access: `gameManager.progressionOps.*` (no GameManager facade).
 */
export class GameManagerProgressionOps {
  constructor(
    private readonly deps: {
      nodeRegistry: NodeRegistry
      skillTemplates: TemplateRegistry<Skill>
      skillSystem: SkillSystem
      skillManager: SkillManager
      getActivePlayer: () => PlayerData | undefined
      // Phap Tu Reimagined Task 4 — combat-state read for switchRoute's
      // out-of-combat gate (route is static during battle).
      getTurnBattle: () => unknown
    },
  ) {}

  /**
   * Talent v4 (spec 2026-09-03 §4.1) - grant/revoke the hidden passive
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

    // Grant by FIRST talent (collectTalentEffects sorts by spec §3.2 id):
    // each combat talent declares 1-2 combat_passive effects.
    for (const effect of collectTalentEffects(player.selectedTalentIds)) {
      if (effect.kind === 'combat_passive') {
        const template = getTalentPassiveSkill(effect.passiveSkillId)

        if (template) {
          // Shallow copy - passiveModifiers stacks are per-battle runtime
          // state, must not share the object with the template data.
          this.deps.skillManager.add({ ...template, passiveModifiers: template.passiveModifiers?.map((modifier) => ({ ...modifier })) })
        }
      }
    }
  }

  /**
   * Snapshot of purchased on-hit Kiem Tran node levels (reads
   * PlayerData.nodeLevels through the registry - the node is the source
   * of truth for `effect.onHitEffect`). Returns {} with no player / no
   * purchased nodes.
   */
  getOnHitNodeLevelsSnapshot(): Record<string, number> {
    const levels: Record<string, number> = {}
    const activePlayer = this.deps.getActivePlayer()

    if (!activePlayer) {
      return levels
    }

    for (const [nodeId, level] of Object.entries(activePlayer.nodeLevels)) {
      if (level <= 0 || !this.deps.nodeRegistry.has(nodeId)) {
        continue
      }

      const node = this.deps.nodeRegistry.get(nodeId)

      if (node.effect.onHitEffect) {
        levels[nodeId] = level
      }
    }

    return levels
  }

  /**
   * Phap Tu Reimagined (Task 6B) - the player's chosen Phap Tu element.
   * PlayerData.phapTu is the sole authority (committed atomically by
   * selectPhapTuElement); lap_dao_thuan_<el> keystones no longer exist.
   * undefined = not Phap Tu / element not chosen yet.
   */
  getPhapTuElement(): ElementType | undefined {
    const activePlayer = this.deps.getActivePlayer()

    if (activePlayer?.cultivationPath !== 'phap_tu') {
      return undefined
    }

    return activePlayer.phapTu.element ?? undefined
  }

  learnSkill(skillId: string): boolean {
    const template = this.deps.skillTemplates.get(skillId)

    if (!template) {
      return false
    }

    return this.deps.skillSystem.learn(template)
  }

  /**
   * Phap Tu Redesign (magicpath) - purchase 1 ProgressionNode (LĨNH NGỘ,
   * 0->1). Calls the pure `purchaseNode()` (core/progression/NodeSystem.ts)
   * first - that function handles everything registry-free. Only
   * `unlocksSkillIds` still needs learnSkill() (skillTemplates live here).
   * Does NOT auto-equip the newly unlocked skill.
   *
   * §6.8 - no more Skill-instance mutation / player.modifiers push at
   * purchase: every effect is derived from (registry, nodeLevels) via
   * getAggregatedModifiers, always recomputed for the same deterministic
   * result.
   */
  purchaseNode(nodeId: string, player: PlayerData): boolean {
    if (!this.deps.nodeRegistry.has(nodeId)) {
      return false
    }

    // Phap Tu Reimagined (Task 6) — element roots commit through the
    // atomic selectPhapTuElement() only; public purchase of a root would
    // split the element+route invariant (element != null implies route
    // != null).
    if (
      (Object.values(PHAP_TU_ELEMENT_ROOT_IDS) as string[]).includes(nodeId)
    ) {
      return false
    }

    const node = this.deps.nodeRegistry.get(nodeId)

    if (!purchaseNodeSystem(player, node)) {
      return false
    }

    // Skill-unlock effects only run on the 0 -> 1 transition -
    // purchaseNodeSystem only returns true exactly on that transition.
    for (const skillId of node.effect.unlocksSkillIds ?? []) {
      this.learnSkill(skillId)

      // Kiem The / Kiem Y (spec 2026-08-29 §5.1) - sword-formation
      // evolution: each route OWNS 1 active skill at slot 0, the new
      // keystone REPLACES the old formation (equipToSlot swaps the
      // occupant). No separate KIEM_TRAN_SLOT_INDEX anymore.
      if (skillId.startsWith('kiem_tran_')) {
        this.deps.skillSystem.equipToSlot(skillId, 0)
      }
    }

    // Phap Tu Thuan He (E-8, 2026-09-03) - variant node: purchasing the
    // node CHOOSES the skill's specialization via SkillSystem (same path
    // as the UI's selectSkillSpecialization). Skill not learned / spec
    // missing -> selectSpecialization returns false, purchase is NOT
    // rolled back (Task 8 data guarantees the unlocksSkillIds prereq ran
    // earlier in the loop above).
    const selectsSpec = node.effect.selectsSpecialization

    if (selectsSpec) {
      this.deps.skillSystem.selectSpecialization(selectsSpec.skillId, selectsSpec.specializationId)
    }

    return true
  }

  /**
   * Phap Tu Reimagined (Task 6) — the ONLY public writer of
   * player.phapTu.element. Atomic: validates eligibility + route +
   * root purchasability FIRST, then purchases the element root through
   * the generic NodeSystem primitive, applies unlock effects, and
   * finally commits { element, route }. Any failure leaves phapTu
   * untouched — element != null implies route != null always.
   */
  selectPhapTuElement(element: ElementType, route: PhapTuRoute, player: PlayerData): boolean {
    if (player.cultivationPath !== 'phap_tu') {
      return false
    }

    if (player.phapTu.element !== null || player.phapTu.route !== null) {
      return false
    }

    if (route !== 'dot' && route !== 'no') {
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

    if (!purchaseNodeSystem(player, root)) {
      return false
    }

    for (const skillId of root.effect.unlocksSkillIds ?? []) {
      this.learnSkill(skillId)
    }

    player.phapTu = { element, route }

    return true
  }

  /**
   * Upgrade a comprehended node by +1 level with Cam Ngo (§6.2) - cost
   * per node data; cannot exceed maxLevel; failure mutates nothing.
   */
  upgradeNode(nodeId: string, player: PlayerData): boolean {
    if (!this.deps.nodeRegistry.has(nodeId)) {
      return false
    }

    return upgradeNodeSystem(player, this.deps.nodeRegistry.get(nodeId))
  }

  getNodeLevel(nodeId: string, player: PlayerData): number {
    return this.deps.nodeRegistry.has(nodeId) ? getNodeLevelSystem(player, nodeId) : 0
  }

  getNodeMaxLevel(nodeId: string): number {
    return this.deps.nodeRegistry.has(nodeId) ? getNodeMaxLevelSystem(this.deps.nodeRegistry.get(nodeId)) : 0
  }

  /** Cam Ngo cost of the NEXT purchase/upgrade - undefined when maxed. */
  getNextNodeCost(nodeId: string, player: PlayerData): number | undefined {
    if (!this.deps.nodeRegistry.has(nodeId)) {
      return undefined
    }

    const node = this.deps.nodeRegistry.get(nodeId)

    const level = getNodeLevelSystem(player, nodeId)

    if (level >= getNodeMaxLevelSystem(node)) {
      return undefined
    }

    return getNextLevelCostSystem(node, level)
  }

  canPurchaseNode(nodeId: string, player: PlayerData): boolean {
    return (
      this.deps.nodeRegistry.has(nodeId) && canPurchaseNodeSystem(player, this.deps.nodeRegistry.get(nodeId))
    )
  }

  canUpgradeNode(nodeId: string, player: PlayerData): boolean {
    return (
      this.deps.nodeRegistry.has(nodeId) && canUpgradeNodeSystem(player, this.deps.nodeRegistry.get(nodeId))
    )
  }

  /**
   * Dev-reset a branch (§6.10) - refunds exactly the total Cam Ngo spent
   * (derived from level/cost data), cascades orphan child nodes; modifiers
   * update via the aggregators (no reverse subtraction of old modifiers).
   */
  devResetBranch(branchTag: string, player: PlayerData): number {
    return devResetBranchSystem(player, this.deps.nodeRegistry, branchTag)
  }

  /**
   * Phap Tu Reimagined Task 4 — switch the route commitment. Out of
   * combat ONLY: a route is static during battle (INV-16), so this
   * rejects while a turn battle is active. The domain function owns
   * the 75% refund + route-tagged level cleanup.
   */
  switchRoute(route: 'dot' | 'no', player: PlayerData): boolean {
    if (this.deps.getTurnBattle()) {
      return false
    }

    // Review fix (HIGH-2): switching requires the atomic
    // (element, route) commit on the normal phap_tu path — otherwise
    // there is no committed route to switch FROM. The domain function
    // enforces the same invariant; the op must not report success for
    // a rejected write.
    if (
      player.cultivationPath !== 'phap_tu' ||
      player.phapTu.element === null ||
      player.phapTu.route === null
    ) {
      return false
    }

    switchRouteSystem(player, this.deps.nodeRegistry, route)

    return true
  }

  /**
   * skill-insight-and-auto-combat-hud-plan.md §5 - upgrade a skill with
   * Skill Insight, pure passthrough to SkillSystem (already has
   * skillManager via its own constructor, needs nothing else here).
   */
  upgradeSkill(skillId: string, player: PlayerData): boolean {
    return this.deps.skillSystem.upgradeSkill(skillId, player)
  }

  getSkillUpgradeInsightCost(skillId: string): number | undefined {
    return this.deps.skillSystem.getSkillUpgradeInsightCost(skillId)
  }

  /**
   * PLAN HOAN CHINH §2 - spend 1 attributePoint into EXACTLY 1 Main Stat.
   * No-op (returns false) when out of points or the stat hit the current
   * major-realm cap (getMainStatCap()) - cap is per-stat, there is NO
   * shared cap across all 5 (per the doc's "Nguyen tac" §2).
   */
  allocateAttributePoint(player: PlayerData, stat: MainStatKey): boolean {
    if (player.attributePoints <= 0) {
      return false
    }

    if (player.baseStats[stat] >= getMainStatCap(player.realmId)) {
      return false
    }

    player.attributePoints--
    player.baseStats[stat]++

    return true
  }

  /**
   * PLAN HOAN CHINH §8/12 - "Set Skill into Loadout" (tier 4), fully
   * separate from learnSkill()/purchaseNode() (tier 3, "learn").
   * skillId === null CLEARS that slot (unequips the occupant if any).
   * slotIndex is validated against realm progression HERE (not in
   * SkillSystem - the pure domain does not know realms).
   */
  setSkillLoadoutSlot(player: PlayerData, slotIndex: number, skillId: string | null): boolean {
    if (skillId === null) {
      const current = this.deps.skillManager.getEquippedInSlot(slotIndex)

      return current ? this.deps.skillSystem.unequipFromSlot(slotIndex) : false
    }

    if (slotIndex < 0 || slotIndex >= getSkillLoadoutSlotCount(player.realmId)) {
      return false
    }

    if (!this.deps.skillManager.has(skillId) || !this.deps.skillManager.get(skillId)!.unlocked) {
      return false
    }

    return this.deps.skillSystem.equipToSlot(skillId, slotIndex)
  }

  unequipSkill(skillId: string): boolean {
    return this.deps.skillSystem.unequip(skillId)
  }

  /**
   * Combat AI strategy (plan §10) - PlayerData is the single source of
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
  selectSkillSpecialization(skillId: string, specializationId: string): boolean {
    return this.deps.skillSystem.selectSpecialization(skillId, specializationId)
  }
}
