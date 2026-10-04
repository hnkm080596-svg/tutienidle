import type { ArtifactPath } from '../artifact/Artifact'
import { tryUpgradeArtifactGrade } from '../artifact/ArtifactProgression'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { PillBag } from '../pill/PillBag'
import type { PlayerData } from '../player/Player'
import { capturePlayerSnapshot, restorePlayerSnapshotInPlace } from '../player/PlayerSnapshot'
import type { ElementType } from '../element/ElementType'
import { isBetaElement, isBetaFeature, isBetaWay, isScopeHidden } from '../betaScope'
import { betaTechniqueAdmitted } from '../betaScopeSkillDomain'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '../../data/progression/PhapTuNodes.builders'
import { canPurchaseNode as canPurchaseNodeSystem } from '../progression/NodeSystem'
import { CULTIVATION_PATH_MODULES, declaresElementAxis, getActiveWayDefinition, isCultivationPathOffered, type CultivationPathId, type CultivationWayId } from '../player/CultivationPathKit'
import { applyBreakthroughMerge } from '../kiem-tu/NguKiemDao'
import { issueCompanionGifts } from '../companion/CompanionGifts'
import type { NodeRegistry } from '../progression/NodeRegistry'
import { applyPathChoice, grantCultivationPathRealmReward as grantPathRealmReward, reconcileCultivationPathRealmRewards as reconcilePathRealmRewards, hasStaticPathCapability } from '../player/CultivationPathSystem'
import { grantSkillCore } from '../progression/NodeSystem'
import {
  computeBreakthroughGrade,
  investBodyChapterState,
} from '../realm/body/BodyProgressionSystem'
import {
  bodyChapterEssenceGrade,
  getBodyChapterDefinition,
  type BodyChapterCurrency,
  type BodyChapterId,
} from '../realm/body/BodyChapter'
import {
  essenceSubstitutionCoverage,
  planEssenceSubstitution,
} from '../realm/body/BodyChapterEssenceSubstitution'
import { pourCultivationOvercharge } from '../cultivation/CultivationSystem'
import {
  physiqueEssenceMaterialId,
} from '../../data/realm/PhysiqueEssence'
import type { PhysiqueGradeId } from '../../data/realm/PhysiqueLadder'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'
import { grantRealmPassive } from '../realm/RealmPassiveSystem'
import { CORE_REALM_LEVEL, getCurrentRealm } from '../realm/realmSystem'
import {
  closeHiddenLineage,
  recordHiddenBreakthrough,
  resolveBreakthroughType,
} from '../realm/hidden/HiddenLineage'
// HIDDEN-C - registering the Nghich Chu Tian mechanic module (validator +
// finished reader self-register at load) and the ops-owned entry points:
// post-invest discovery check + the dual-cost attempt command.
import {
  attemptNghichChuTian,
  maybeDiscoverNghichChuTian,
  type NghichChuTianAttemptResult,
} from '../realm/hidden/NghichChuTian'
import {
  canTriggerBreakthrough as gateCanTriggerBreakthrough,
  getBreakthroughRequirements as gateGetBreakthroughRequirements,
  type BreakthroughRequirementRow,
} from '../realm/BreakthroughGate'
import { isArtifactDomainUnlocked } from '../artifact/ArtifactProgression'
import type { Skill } from '../skill/Skill'
import type { SkillManager } from '../skill/SkillManager'
import type { SkillSystem } from '../skill/SkillSystem'
import type { Technique } from '../technique/Technique'
import type { TechniqueManager } from '../technique/TechniqueManager'
import type { TechniqueSystem } from '../technique/TechniqueSystem'
import {
  canAdvanceTechniqueGrade,
  getTechniqueGradeCeiling,
  getTechniqueGradeUpgradeCost,
} from '../technique/TechniqueProgression'
import type {
  BreakthroughOutcomeService,
  BreakthroughOutcomeResult,
  BreakthroughPlayerWriter,
} from '../tribulation/BreakthroughOutcomeService'
import {
  resolveTalentEntitlement as resolveTalentEntitlementRecord,
  type TalentEntitlementDecision,
} from '../talent/TalentEntitlement'
import type { GameManagerProgressionOps } from './GameManagerProgressionOps'
import type { TemplateRegistry } from './TemplateRegistry'
import {
  betaTechniqueSurfaceFor,
  type BetaTechniqueSurfaceModel,
} from '../betaScopeTechniqueDomain'

/**
 * M-QI-03 - one row of the normal breakthrough requirement read-model.
 * The UI renders a label per key; `met` is the live predicate flag.
 * Hidden foundation/grade inputs (truc_co_dan, body tiers, meridian,
 * perfection, talents) are intentionally NOT rows here - QI-D6 keeps
 * them resolver-internal.
 */
export type { BreakthroughRequirementRow }

/**
 * BETA SCOPE LOCK v2 (phase-2) - the failure reasons of
 * commitFiveElementInitiation. Every preflight condition maps to one
 * explicit code so the caller can render a user-visible message per
 * case; 'commit_failed' is the post-preflight catch-all (the commit
 * region rolls back to the byte-equivalent pre-commit state before it
 * is returned).
 */
export type FiveElementInitiationFailure =
  | 'invalid_element'
  | 'not_mortal'
  | 'already_committed'
  | 'realm_level_too_low'
  | 'in_combat'
  | 'way_unavailable'
  | 'way_not_offered'
  | 'element_committed'
  | 'missing_technique'
  | 'technique_occupied'
  | 'technique_grade_exceeds'
  | 'missing_element_root'
  | 'element_root_blocked'
  | 'missing_kit_skill'
  | 'commit_failed'

export type FiveElementInitiationResult =
  | { ok: true }
  | { ok: false; reason: FiveElementInitiationFailure }



/**
 * Realm-advance operations: combat technique learn/equip, cultivation
 * path selection (the mortal -> qi_refining initiation ritual), artifact
 * path/grade, realm passive syncs, body refinement, breakthrough gating.
 * Extracted from GameManager (large-file split); moved verbatim.
 *
 * Public access: `gameManager.realmAdvanceOps.*` (no GameManager facade).
 * Also satisfies the BreakthroughConsequencesContext contract consumed by
 * BreakthroughOutcomeService (the 2 realm-passive syncs below).
 */
export class GameManagerRealmAdvanceOps {
  readonly techniqueManager: TechniqueManager

  constructor(
    private readonly deps: {
      techniqueManager: TechniqueManager
      techniqueTemplates: TemplateRegistry<Technique>
      techniqueSystem: TechniqueSystem
      skillManager: SkillManager
      skillSystem: SkillSystem
      skillTemplates: TemplateRegistry<Skill>
      nodeRegistry: NodeRegistry
      materialBag: MaterialBag
      materialRegistry: MaterialRegistry
      pillBag: PillBag
      breakthroughOutcomeService: BreakthroughOutcomeService
      progressionOps: GameManagerProgressionOps
      getTurnBattle: () => TurnBattle | null
      isTurnBattleInProgress: () => boolean
      markQuestRealmTransition: () => void
      // Material-landing funnel (the essence change credit is a live
      // landing).
      notifyMaterialGained: (materialId: string, amount: number) => void
    },
  ) {
    this.techniqueManager = deps.techniqueManager
  }

  /** Grants the major-realm reward of the cultivation path data kit (artifact + grantedNodeLevels). */
  grantCultivationPathRealmReward(player: PlayerData, realmId: string): boolean {
    return grantPathRealmReward(player, realmId, (nodeId) =>
      this.deps.nodeRegistry.has(nodeId) ? this.deps.nodeRegistry.get(nodeId) : undefined,
    )
  }

  /**
   * Load-time reconcile (F-PT-A9-1): replays realm-entry grants the player
   * already passed -- safe to run on every restore (idempotent max-write).
   */
  reconcileCultivationPathRealmRewards(player: PlayerData): boolean {
    return reconcilePathRealmRewards(player, (nodeId) =>
      this.deps.nodeRegistry.has(nodeId) ? this.deps.nodeRegistry.get(nodeId) : undefined,
    )
  }

  /**
   * M-F-TALENT - resolve the mandatory breakthrough talent transaction
   * (ruling S15-18): ONE decision granting ONE result, clearing the
   * persisted entitlement record that locks the transition's drain.
   * Delegates all grant/legality rules to the domain module (A5); on
   * success the combat-passive sync re-reads talent effects at the new
   * ownership/level. `player` must be the Pinia store instance (same
   * absent-key write semantics as TribulationOutcomeService).
   */
  resolveTalentEntitlement(player: PlayerData, decision: TalentEntitlementDecision): boolean {
    // Out-of-combat write: resolving mid-battle would persist the record
    // while the combat-passive sync no-ops. Rejecting keeps the pending
    // entitlement (and its mandatory modal) valid until the battle ends.
    if (this.deps.isTurnBattleInProgress()) {
      return false
    }
    const resolved = resolveTalentEntitlementRecord(player, decision)

    if (resolved) {
      this.deps.progressionOps.syncTalentCombatPassive(player)
    }

    return resolved
  }

  /**
   * Kiem Tu Reimagined (spec K15) - Ngu Kiem Dao breakthrough merge.
   * Call ONCE per major-realm advance, AFTER the realmId write: the
   * forged swords fold into kiemDaoBase and the live count resets to 1
   * (banked Kiem Y carries into the new realm's forgeCost). No-op for
   * sword_pathway / non-sword players.
   */
  applySwordPathRealmTransition(player: PlayerData): void {
    // M6 - way membership is the discriminator (swordPath.mode retired).
    // P1 - the 'sword.sword_riding' capability carries that membership;
    // the slice presence check stays (corrupt saves fail closed).
    // BETA SCOPE LOCK v2 - the merge mutates the preserved dormant
    // slice (kiemDaoBase) on every realm advance; sword machinery is
    // scope-hidden, so a carried save's slice stays frozen in beta.
    if (isScopeHidden('swordPath')) {
      return
    }

    if (player.swordPath && hasStaticPathCapability(player, 'sword.sword_riding')) {
      applyBreakthroughMerge(player.swordPath)
    }
  }

  /**
   * Ngu Kiem Beta (F-NK-AUT-7) - replay the committed way's
   * grantedNodeIds at restore. Saves that picked a way BEFORE its
   * granted nodes shipped (v84 hidden_sword_pathway predates
   * ngu_kiem_khoi) never re-run the initiation ritual, so the grant is
   * permanently missing and the provider resolves a broken evolution
   * chain. grantSkillCore is idempotent (level>=1 + mirror membership
   * short-circuit) so every restore is safe; unregistered/unknown way
   * pairs no-op (their ownsership/way validators report separately).
   */
  reconcileWayGrants(player: PlayerData): void {
    const way = getActiveWayDefinition(player)

    // BETA SCOPE LOCK v2 - the grant replay is authored on the ACTIVE
    // way record; a way_out_of_scope save's grants stay inert.
    if (way === undefined || !isBetaWay(way.id)) {
      return
    }

    for (const nodeId of way.grantedNodeIds ?? []) {
      if (this.deps.nodeRegistry.has(nodeId)) {
        grantSkillCore(player, this.deps.nodeRegistry.get(nodeId))
      }
    }
  }

  /**
   * M-F-COMPANION-GIFT - companion gift moments authored against the
   * realm just entered. Call once per realm-entered write, AFTER
   * `player.realmId` holds the new realm: issueCompanionGifts is
   * write-if-absent, so repeat fires and realms with no authored moment
   * are harmless no-ops. Naming mirrors applySwordPathRealmTransition.
   */
  applyCompanionGiftRealmTransition(player: PlayerData): void {
    issueCompanionGifts(player, { kind: 'realm_entered', realmId: player.realmId })
  }

  /**
   * R8.2 Slice 2 (AR-10): facade for the minor-realm breakthrough outcome
   * chain. The service owns all consequences (passive sync, banked
   * artifact release, and the documented-dead major-realm branches);
   * this orchestrator only delegates (A5 - no formula logic here).
   * `player` must be the Pinia store instance, NOT `store.$state`
   * (same absent-key write semantics as TribulationOutcomeService).
   */
  breakthroughWithConsequences(player: BreakthroughPlayerWriter): BreakthroughOutcomeResult {
    return this.deps.breakthroughOutcomeService.breakthrough(player, this)
  }

  /**
   * P7-M3 - grant the Way's canonical Technique into the 0-or-1 holder.
   * `player.realmId` must already be the post-promotion realm:
   * chooseCultivationPath calls this AFTER the mortal -> qi_refining
   * promotion so grant() enforces the grade ceiling against qi_refining.
   */
  grantCanonicalTechnique(techniqueId: string, player: PlayerData): boolean {
    const template = this.deps.techniqueTemplates.get(techniqueId)

    if (!template) {
      return false
    }

    return this.deps.techniqueSystem.grant(template, player.realmId)
  }

  /**
   * Phap Tu profession-tier ladder (2026-08-14, merged combat technique
   * 2026-08-15) - "choose profession", ONE TIME ONLY, PERMANENT (see
   * PlayerData.cultivationPath) - auto-grants the fixed kit of that tier:
   * the way's ONE canonical technique + its fixed skills
   * (basic/special/ultimate, OVERWRITING any skills holding those slots).
   * NOT a free-build system - reuses the canonical grant + learnSkill()/
   * equipToSlot() intact. P7-M3: the technique grant runs after the
   * mortal -> qi_refining promotion so the grade ceiling reads the
   * committed realm.
   *
   * Initiation Ritual (2026-08-16) - choosing the path IS the mortal ->
   * qi_refining breakthrough ritual ("advancing to a new realm always has
   * a ritual" - Truc Co has its own Tribulation; Pham Nhan -> Luyen Khi
   * uses this profession choice instead of a normal Breakthrough button,
   * see CultivationSystem.breakthrough()'s guard blocking realmId ===
   * 'mortal'). If the player is still mortal when choosing, atomically
   * moves them to qi_refining level 1 - the 3 calls after that are
   * IDENTICAL to useBreakthrough.ts/useTribulation.ts after every major
   * breakthrough.
   */
  chooseCultivationPath(pathId: CultivationPathId, wayId: CultivationWayId, player: PlayerData): boolean {
    // M2 - the (path, way) pair resolves its way definition from the
    // module catalog; an unknown pair yields no way and fails closed.
    // Way OFFERABILITY is no longer checked here: applyPathChoice owns
    // the offerGate evaluation.
    const way = CULTIVATION_PATH_MODULES[pathId]?.ways[wayId]

    // BETA SCOPE LOCK v2 (phase-2) - the ritual's admission gate is the
    // beta allow-list: a non-beta way fails closed here. And a way
    // declaring an element subpath axis (today: spell_pathway) can NEVER
    // ride this op - it commits an element intrinsically, so its only
    // entry point is commitFiveElementInitiation() below (a permanent
    // contract, not a beta flag: an element-committing way must commit
    // atomically).
    if (!isBetaWay(wayId) || declaresElementAxis(way)) {
      return false
    }

    if (
      player.cultivationPath ||
      player.realmId !== 'mortal' ||
      player.realmLevel < CORE_REALM_LEVEL
    ) {
      return false
    }

    // A realm commit mid-battle rewrites realmId/cultivation while a
    // cycle is live - and inside a hidden trial it also freezes the
    // lineage so the earned completion can silently never land. The
    // sibling write paths below already refuse the same states.
    if (this.deps.isTurnBattleInProgress()) {
      return false
    }

    if (!way) {
      return false
    }

    // Transaction boundary (review round-4, atomicity hardening): verify
    // every registry entry the ritual grants BEFORE committing
    // cultivationPath - a missing template must fail the whole choice,
    // never leave the path committed with a partial kit.
    const techniqueTemplate = this.deps.techniqueTemplates.get(way.techniqueId)

    if (!techniqueTemplate) {
      return false
    }

    // P7-M3 (D9) - a mortal holds NO technique. A pre-existing entry
    // (even the canonical id) is corrupt progression; reject pre-commit
    // so path/way/realm/slices stay untouched. grant() repeats this
    // check defensively.
    if (this.deps.techniqueManager.getActive() !== undefined) {
      return false
    }

    // Defensive: grant() would refuse a template whose grade exceeds the
    // post-promotion (qi_refining) ceiling - fail the whole ritual first.
    if (techniqueTemplate.grade > getTechniqueGradeCeiling('qi_refining')) {
      return false
    }

    const grantedSkillIds: readonly string[] = way.skillIds ?? []

    if (grantedSkillIds.some((skillId) => !this.deps.skillTemplates.has(skillId))) {
      return false
    }

    // P7-M2 - initiation passives are way-declared now; their templates
    // get the same pre-commit check (was techniqueTemplate.innateSkillId).
    if ((way.passiveSkillIds ?? []).some((skillId) => !this.deps.skillTemplates.has(skillId))) {
      return false
    }

    // P7-M4 - the way's starter basic gets the same pre-commit template
    // check: a way whose starter cannot resolve a template fails the
    // whole ritual before the path/way commit.
    if (way.starterBasicSkillId !== undefined && !this.deps.skillTemplates.has(way.starterBasicSkillId)) {
      return false
    }

    // M-QI-05 - levelled kit skills must resolve their canonical Core
    // Node (template maxLevel > 1 needs a registered core_<id> with
    // matching levelsSkillId + maxLevel) BEFORE the path/way commit;
    // the same preflight covers way-declared coreSkillIds (native
    // defs). A missing/mismatched core is a data-integrity failure -
    // never a partial kit on a committed path.
    for (const skillId of [...grantedSkillIds, ...(way.passiveSkillIds ?? []), ...(way.starterBasicSkillId !== undefined ? [way.starterBasicSkillId] : [])]) {
      if (!this.deps.progressionOps.preflightLearnableSkill(skillId)) {
        return false
      }
    }

    for (const skillId of way.coreSkillIds ?? []) {
      if (!this.deps.progressionOps.preflightSkillCoreGrant(skillId)) {
        return false
      }
    }

    // Ngu Kiem Beta -- every declared granted node must be registered
    // (a missing id fails the whole ritual before commit).
    for (const nodeId of way.grantedNodeIds ?? []) {
      if (!this.deps.nodeRegistry.has(nodeId)) {
        return false
      }
    }

    // Path/way commit - the authority validates the pair, evaluates the
    // offerGate live, and writes cultivationWay + the base
    // cultivationPath id plus the path-state slice (sword). Zero
    // mutation on failure, so an ineligible/wrong-path pick stops here.
    if (!applyPathChoice(player, pathId, wayId).ok) {
      return false
    }

    // P7-M4 - the mortal-only basic pick ends at initiation: cleared
    // INSIDE the post-commit region (every pre-commit failure above
    // preserves it byte-identically). A way player can never carry one -
    // the v71 save boundary rejects post-path presence.
    delete player.mortalBasicSkillId

    // P7-M4 - the post-commit kit contract is learn-only: way.skillIds
    // enter SkillManager membership (the learned authority); combat
    // resolves roles from the way kit, not a generic slot loadout.
    // sword basics come from the orb preset via the dynamicBasic
    // provider; both body ways resolve their kit at battle build;
    // hidden_spell_pathway's third kit member is a passiveSkillIds
    // passive, not an active.
    way.skillIds?.forEach((skillId) => {
      this.deps.progressionOps.learnSkill(skillId, player)
    })

    // M-QI-05 - way-owned native Core Nodes ride the same grant seam
    // as node-effect grantsSkillCoreIds (level authority: nodeLevels).
    for (const skillId of way.coreSkillIds ?? []) {
      this.deps.progressionOps.grantSkillCoreBySkillId(player, skillId)
    }

    // Ngu Kiem Beta -- granted evolution nodes (Khoi at ritual) write
    // through the same seam: nodeLevels + purchasedNodeIds (respec
    // preserves them; devResetBranch still strips them deliberately).
    for (const nodeId of way.grantedNodeIds ?? []) {
      grantSkillCore(player, this.deps.nodeRegistry.get(nodeId))
    }

    // P7-M4 - starter learnedness pin: the way's starter basic is
    // learned inside the commit block (idempotent - boot already taught
    // it; this repairs a save whose starter entry is missing). A
    // successful initiation always yields a learned starter.
    if (way.starterBasicSkillId !== undefined) {
      this.deps.progressionOps.learnSkill(way.starterBasicSkillId, player)
    }

    // P7-M2 - way-declared initiation passives (replaces the technique's
    // innateSkillId grant). P7-M4: learn-only - learned passives always
    // apply (membership is the authority; no equip switch remains).
    for (const passiveId of way.passiveSkillIds ?? []) {
      if (!this.deps.skillManager.has(passiveId)) {
        this.deps.progressionOps.learnSkill(passiveId, player)
      }
    }
    // Phap Tu Reimagined (Task 6) - no auto-Fire starter: choosing
    // spell leaves player.spellPath { element: null } until
    // progressionOps.selectSpellPathElement() commits the atomic choice.

    if (player.realmId === 'mortal') {
      this.commitInitiationRealmAdvance(player)
    }

    // P7-M3 - canonical Technique grant runs AFTER the realm promotion
    // so grant() enforces the grade ceiling against qi_refining (D9/D10).
    // Preflight guarantees this cannot fail (template exists, holder
    // empty, grade within ceiling).
    this.grantCanonicalTechnique(way.techniqueId, player)

    return true
  }

  /**
   * BETA SCOPE LOCK v2 (phase-2) - the shared mortal -> qi_refining
   * promotion leg of the initiation ritual. Both ritual entry points
   * (the legacy chooseCultivationPath for non-beta ways and the atomic
   * commitFiveElementInitiation for the spell way) run the SAME block -
   * single implementation, never duplicated.
   */
  private commitInitiationRealmAdvance(player: PlayerData): void {
    // Realm Passive & Pressure System (2026-08-20) - lock the Nhap Dao
    // grade BEFORE granting so Nhap Dao (RealmPassives.ts) reads the
    // final Luyen The value at the moment of the Initiation Ritual.
    player.breakthroughGrade = computeBreakthroughGrade(player)

    // Hidden Perfection Lineage (2026-09-23): the breakthrough TYPE
    // (normal vs hidden) resolves at commit - mortal uses
    // chooseCultivationPath instead of a tribulation attempt. A
    // NORMAL success closes the lineage on the DEPARTING realm
    // (here 'mortal'); a hidden entry records the entered realm
    // after the realm write below so the enhanced Nhap Dao selects.
    const breakthroughType = resolveBreakthroughType(player)
    if (breakthroughType === 'normal') {
      closeHiddenLineage(player, 'mortal')
    }

    player.realmId = 'qi_refining'
    player.realmLevel = 1
    player.cultivation = 0

    // Hai Nap (M2) - banked overflow follows into the new realm's level
    // 1 - same owner helper as the minor-tier breakthrough pour.
    pourCultivationOvercharge(player)

    if (breakthroughType === 'hidden') {
      recordHiddenBreakthrough(player, 'qi_refining')
    }

    // R8.1 (AR-09) - realm transition may unlock quests; reconcile on
    // the next tick instead of waiting for a panel read.
    this.deps.markQuestRealmTransition()

    // M-F-COMPANION-GIFT - companion gift moments authored against
    // qi_refining entry fire here (write-if-absent; idempotent).
    this.applyCompanionGiftRealmTransition(player)

    this.syncRealmPassive(player)
    this.syncRealmStatPassive(player)

    // Uniform funnel: every major-realm entry runs the way-authored
    // realm-reward grant (qi_refining authors none today - no-op).
    grantPathRealmReward(player, 'qi_refining', (nodeId) =>
      this.deps.nodeRegistry.has(nodeId) ? this.deps.nodeRegistry.get(nodeId) : undefined,
    )

    // M6 - NO applySwordPathRealmTransition here: hidden_sword_pathway can now be picked at
    // this very ritual, so the pre-M6 "hidden_sword_pathway cannot exist at mortal"
    // assumption is false. The slice was JUST created (kiemDaoCount 1 -
    // nothing forged this realm); merging it would hand out a free
    // kiemDaoBase bump at entry. The merge stays on real major-realm
    // advances (TribulationOutcomeService), where forged swords exist.
  }

  /**
   * BETA SCOPE LOCK v2 (phase-2) - the ONE canonical Ngu Hanh
   * initiation: spell + spell_pathway + element + realm +
   * five_elements_art committed in a single all-or-nothing transaction
   * (spec: 'pick pathway then pick element elsewhere' is replaced; the
   * element root is never an ordinary purchase and
   * selectSpellPathElement only commits inside this transaction).
   *
   * Every preflight condition maps to an explicit failure reason the
   * caller can present. On { ok: false } NOTHING mutated; on a
   * post-preflight leg failure the commit region rolls back to the
   * byte-equivalent pre-commit state before returning 'commit_failed'.
   */
  commitFiveElementInitiation(element: ElementType, player: PlayerData): FiveElementInitiationResult {
    // Element admission - the BETA_PLAYABLE_ELEMENTS allow-list.
    if (!isBetaElement(element)) {
      return { ok: false, reason: 'invalid_element' }
    }

    // The op is bound to the element-committing way declared in the
    // catalog: resolve it from the element subpath axis instead of a
    // literal id so a future element way needs no code change here.
    const way = Object.values(CULTIVATION_PATH_MODULES).flatMap((path) =>
      Object.values(path.ways),
    ).find((candidate) => declaresElementAxis(candidate))

    if (!way || !isBetaWay(way.id)) {
      return { ok: false, reason: 'way_unavailable' }
    }

    if (player.realmId !== 'mortal') {
      return { ok: false, reason: 'not_mortal' }
    }

    if (player.cultivationPath !== undefined || player.cultivationWay !== undefined) {
      return { ok: false, reason: 'already_committed' }
    }

    if (player.realmLevel < CORE_REALM_LEVEL) {
      return { ok: false, reason: 'realm_level_too_low' }
    }

    // Same out-of-combat discipline as chooseCultivationPath.
    if (this.deps.isTurnBattleInProgress()) {
      return { ok: false, reason: 'in_combat' }
    }

    if (!isCultivationPathOffered(way, player)) {
      return { ok: false, reason: 'way_not_offered' }
    }

    const techniqueTemplate = this.deps.techniqueTemplates.get(way.techniqueId)

    if (!techniqueTemplate) {
      return { ok: false, reason: 'missing_technique' }
    }

    if (this.deps.techniqueManager.getActive() !== undefined) {
      return { ok: false, reason: 'technique_occupied' }
    }

    // grant() refuses a template whose grade exceeds the post-promotion
    // (qi_refining) ceiling - fail before commit, same as the ritual.
    if (techniqueTemplate.grade > getTechniqueGradeCeiling('qi_refining')) {
      return { ok: false, reason: 'technique_grade_exceeds' }
    }

    if (player.spellPath.element !== null) {
      return { ok: false, reason: 'element_committed' }
    }

    const rootId = PHAP_TU_ELEMENT_ROOT_IDS[element]
    const root = this.deps.nodeRegistry.has(rootId) ? this.deps.nodeRegistry.get(rootId) : undefined

    if (!root) {
      return { ok: false, reason: 'missing_element_root' }
    }

    // Element roots are way-gated (requiredWay 'spell_pathway'): the
    // purchasability probe runs on a post-commit player clone so the
    // check evaluates the state the commit will actually produce.
    const probe = JSON.parse(JSON.stringify(player)) as PlayerData
    probe.cultivationPath = way.pathId
    probe.cultivationWay = way.id

    if (!canPurchaseNodeSystem(probe, root)) {
      return { ok: false, reason: 'element_root_blocked' }
    }

    // Every skill the transaction learns - way kit members (declared,
    // passives, starter), the element basic riding the root's unlock
    // effect, and the qi_refining realm passive granted inside the
    // promotion leg - must resolve template + core BEFORE any mutation.
    const qiRefiningPassiveId = way.realmRewards?.['qi_refining']?.passiveSkillId
    const kitSkillIds: string[] = [
      ...(way.skillIds ?? []),
      ...(way.passiveSkillIds ?? []),
      ...(way.starterBasicSkillId !== undefined ? [way.starterBasicSkillId] : []),
      ...(root.effect.unlocksSkillIds ?? []),
      ...(qiRefiningPassiveId != null ? [qiRefiningPassiveId] : []),
    ]

    for (const skillId of kitSkillIds) {
      if (!this.deps.progressionOps.preflightLearnableSkill(skillId)) {
        return { ok: false, reason: 'missing_kit_skill' }
      }
    }

    for (const skillId of [...(way.coreSkillIds ?? []), ...(root.effect.grantsSkillCoreIds ?? [])]) {
      if (!this.deps.progressionOps.preflightSkillCoreGrant(skillId)) {
        return { ok: false, reason: 'missing_kit_skill' }
      }
    }

    for (const nodeId of way.grantedNodeIds ?? []) {
      if (!this.deps.nodeRegistry.has(nodeId)) {
        return { ok: false, reason: 'missing_kit_skill' }
      }
    }

    // ---- COMMIT REGION --------------------------------------------------
    // Snapshot for byte-equivalent rollback: the player payload (JSON
    // clone, same rule as investBodyChapter - structuredClone throws on
    // nested Pinia proxies), the learned-skill set, and the 0-or-1
    // technique holder. External observers fired inside the promotion
    // leg (quest transition mark, companion gifts) are idempotent
    // write-if-absent channels - a rolled-back commit leaves them marked
    // but state-consistent (a later real transition reconciles).
    const playerSnapshot = capturePlayerSnapshot(player)
    const learnedBefore = new Set(this.deps.skillManager.getAll().map((skill) => skill.id))
    const techniquesBefore = this.deps.techniqueManager.getAll()

    const rollback = (): void => {
      restorePlayerSnapshotInPlace(player, playerSnapshot)
      for (const skill of this.deps.skillManager.getAll()) {
        if (!learnedBefore.has(skill.id)) {
          this.deps.skillSystem.unlearn(skill.id)
        }
      }
      this.deps.techniqueManager.restore(techniquesBefore)
    }

    try {
      // Path/way commit - validates the pair, evaluates offerGate, writes
      // cultivationPath + cultivationWay + the way's path-state slice.
      if (!applyPathChoice(player, way.pathId, way.id).ok) {
        rollback()
        return { ok: false, reason: 'commit_failed' }
      }

      // The mortal-only basic pick ends at initiation (same contract as
      // the ritual - post-path presence is corrupt on the save boundary).
      delete player.mortalBasicSkillId

      // Way kit learns - identical legs to the ritual's commit block.
      way.skillIds?.forEach((skillId) => {
        this.deps.progressionOps.learnSkill(skillId, player)
        if (!this.deps.skillManager.has(skillId)) {
          throw new Error(`five-element initiation: kit learn failed: ${skillId}`)
        }
      })

      for (const skillId of way.coreSkillIds ?? []) {
        this.deps.progressionOps.grantSkillCoreBySkillId(player, skillId)
      }

      for (const nodeId of way.grantedNodeIds ?? []) {
        grantSkillCore(player, this.deps.nodeRegistry.get(nodeId))
      }

      if (way.starterBasicSkillId !== undefined) {
        this.deps.progressionOps.learnSkill(way.starterBasicSkillId, player)
        if (!this.deps.skillManager.has(way.starterBasicSkillId)) {
          throw new Error(`five-element initiation: starter learn failed: ${way.starterBasicSkillId}`)
        }
      }

      for (const passiveId of way.passiveSkillIds ?? []) {
        if (!this.deps.skillManager.has(passiveId)) {
          this.deps.progressionOps.learnSkill(passiveId, player)
        }
      }

      // The element leg: root purchase + kit basic learn +
      // spellPath.element commit through the ONE element-commit op
      // (gated to mortal-only, so it can only ever run inside an
      // in-flight initiation like this one).
      if (!this.deps.progressionOps.selectSpellPathElement(element, player)) {
        rollback()
        return { ok: false, reason: 'commit_failed' }
      }

      this.commitInitiationRealmAdvance(player)

      if (!this.grantCanonicalTechnique(way.techniqueId, player)) {
        rollback()
        return { ok: false, reason: 'commit_failed' }
      }
    } catch (error) {
      rollback()
      throw error
    }

    return { ok: true }
  }

  /**
   * Ban Menh Phap Bao (doc sec.7.1) - choose/switch the Cong/Thu/Khong
   * direction. Switchable MULTIPLE times outside combat (unlike
   * chooseCultivationPath() above - that is permanent, this is a "free
   * out-of-combat swap for testing"). Keeps EXP/tier/grade, applies from
   * the next battle (runtime artifact snapshot at battle start; not
   * re-read mid-fight). Does NOT use window.confirm - unlike
   * QuanKhiPanel.vue (that choice is irreversible, this one is not).
   */
  setArtifactPath(player: PlayerData, path: ArtifactPath): boolean {
    // M-F-ARTIFACT-DEFER: outermost guard - path selection is domain
    // ACCESS, so a persisted dormant artifact can never be pathed while
    // the domain is deferred (even a beyond-ceiling save reaching KD
    // keeps the gate closed until the window opens).
    if (!isArtifactDomainUnlocked(player.realmId)) {
      return false
    }

    if (!player.artifact) {
      return false
    }

    if (this.deps.isTurnBattleInProgress()) {
      return false
    }

    player.artifact.selectedPath = path

    return true
  }

  /**
   * Ban Menh Phap Bao (doc sec.5.3) - upgrade grade with Doan Bao Thach,
   * OUTSIDE combat only (the real transaction lives in the pure-core
   * tryUpgradeArtifactGrade() - the combat guard is enforced HERE, not
   * just in the UI).
   */
  tryUpgradeArtifactGrade(player: PlayerData): boolean {
    // M-F-ARTIFACT-DEFER: outermost guard, same reasoning as
    // setArtifactPath - grade upgrade is domain ACCESS, so a persisted
    // dormant artifact cannot consume Doan Bao Thach while deferred.
    if (!isArtifactDomainUnlocked(player.realmId)) {
      return false
    }

    if (!player.artifact) {
      return false
    }

    if (this.deps.isTurnBattleInProgress()) {
      return false
    }

    return tryUpgradeArtifactGrade(player.artifact, this.deps.materialBag)
  }

  /**
   * M-F-TECHNIQUE (F4) - realm-exit freeze: call ONCE per major-realm
   * advance BEFORE the realmId/realmLevel writes (the departing
   * realmLevel is the freeze-time ceiling dai_thanh evaluates
   * against; post-write realmLevel is already 1). Seals the live
   * cycle when the new realm's index exceeds its grade; write-if-
   * absent idempotent. Naming mirrors applySwordPathRealmTransition
   * (the other per-transition hook).
   */
  applyTechniqueRealmTransition(player: PlayerData, targetRealmId: string): void {
    this.deps.techniqueSystem.sealFrozenCycle(targetRealmId, player.realmLevel)
  }

  /**
   * P7-M3 (D4) + M-F-TECHNIQUE - canonical Technique grade-advance
   * CATCH-UP transaction: live grade below the realm band + OUTSIDE
   * combat + 100 x targetGrade current-tier spirit stones. The
   * transaction seals the outgoing cycle, resets rank/mastery for
   * the new grade, preserves the build, applies monotonic
   * inheritance. The combat guard is enforced HERE, not just in the
   * UI.
   */
  tryAdvanceTechniqueGrade(player: PlayerData): boolean {
    const technique = this.deps.techniqueManager.getActive()

    if (!technique || !canAdvanceTechniqueGrade(technique, player.realmId)) {
      return false
    }

    // BETA SCOPE LOCK - a carried way_out_of_scope save must not spend
    // spirit stones grading the dormant way's canonical technique.
    if (!betaTechniqueAdmitted(technique.id)) {
      return false
    }

    if (this.deps.isTurnBattleInProgress()) {
      return false
    }

    const cost = getTechniqueGradeUpgradeCost(technique.grade + 1, player.realmId)

    if (this.deps.materialBag.getAmount(cost.materialId) < cost.amount) {
      return false
    }

    this.deps.materialBag.remove(cost.materialId, cost.amount)

    return this.deps.techniqueSystem.advanceTechniqueGrade(player.realmId)
  }

  /**
   * BETA FE-CONTRACT (work-order sec.4A) - canonical Technique surface
   * read-model. The frontend renders this model and never calls
   * canAdvanceTechniqueGrade / getTechniqueGradeUpgradeCost /
   * materialBag.getAmount itself; the mutation above stays the domain
   * authority. Pure query - no state touched.
   */
  getBetaTechniqueSurfaceModel(player: PlayerData): BetaTechniqueSurfaceModel {
    return betaTechniqueSurfaceFor(player, {
      activeTechnique: this.deps.techniqueManager.getActive(),
      materialAmount: (materialId) => this.deps.materialBag.getAmount(materialId),
      materialName: (materialId) =>
        this.deps.materialRegistry.has(materialId)
          ? this.deps.materialRegistry.get(materialId).name
          : materialId,
      turnBattleInProgress: this.deps.isTurnBattleInProgress(),
    })
  }

  /**
   * Unlocks + auto-equips the passive skill for the player's current
   * realm - call right after a successful breakthrough(). P7-M2: the
   * passive source is the COMMITTED WAY's realmRewards record
   * (way -> realmRewards[realm] -> passiveSkillId; ways compose the
   * canonical ladder from data/progression/RealmPassiveLadder), no
   * longer the technique - a technique swap cannot change the
   * realm passives a player receives, and a way-less/corrupt pair
   * grants nothing. Idempotent (checks skillManager.has()
   * before learn) so repeat calls are safe.
   */
  syncRealmPassive(player: PlayerData) {
    // A mid-battle sync would reach a learnSkill that rejects the grant,
    // silently swallowing the passive. The skip can fire on a mid-fight
    // minor breakthrough (realmLevel only - realmId never changes
    // mid-battle), and is harmless because the current realm's passive
    // was already granted at realm entry and this learn is idempotent.
    // There is no restore-time re-sync; a passive genuinely missing
    // (corrupt save, future caller) waits for the next breakthrough.
    if (this.deps.isTurnBattleInProgress()) {
      return
    }

    // BETA SCOPE LOCK v2 - the way-authored passive ladder is an
    // inert record on a way_out_of_scope save; learning it through
    // this seam would emit a dormant kit's passive into live play.
    const way = getActiveWayDefinition(player)

    if (way === undefined || !isBetaWay(way.id)) {
      return
    }

    const realm = getCurrentRealm(player.realmId)

    const skillId = way.realmRewards?.[realm.id]?.passiveSkillId

    if (!skillId) {
      return
    }

    if (this.deps.skillManager.has(skillId)) {
      return
    }

    // M-QI-05 - the canonical learn seam owns insertion (template
    // existence + levelled-skill core preflight/grant inside learnSkill).
    this.deps.progressionOps.learnSkill(skillId, player)

    // P7-M4 - learning alone activates the passive: learned passives
    // always apply (SkillManager membership is the authority; the
    // equipWithoutSlot channel is retired).
  }

  /**
   * Realm Passive & Pressure System (2026-08-20) - grants the PERMANENT
   * buff (Nhap Dao/Kien Co/..., see data/realm/RealmPassives.ts) of the
   * CURRENT realm; named apart from syncRealmPassive() above (that is
   * the way-reward passive SKILL, this is the stat modifier by
   * Breakthrough Grade/foundation type) to avoid mixing the two
   * concepts. Idempotent (see RealmPassiveSystem.grantRealmPassive()) -
   * called at the same 3 points as syncRealmPassive()
   * (chooseCultivationPath() below, useBreakthrough.ts,
   * useTribulation.ts's resolveVictory()).
   */
  syncRealmStatPassive(player: PlayerData) {
    // Same battle gate as syncRealmPassive above - a mid-fight grant
    // would write player state outside combat authority.
    if (this.deps.isTurnBattleInProgress()) {
      return
    }
    grantRealmPassive(player, getCurrentRealm(player.realmId).id)
  }

  /**
   * P7-M5 - unified body-progression invest: reads the chapter's
   * currency descriptor (material OR pill bag - thong_mach_dan is a
   * pill), hands the available amount + aux count to
   * BodyProgressionSystem.investBodyChapterState, and debits ONLY the
   * consumed amount from the chapter's own bag on success. Returns the
   * amount actually consumed (0 when gated/complete/empty).
   */
  investBodyChapter(player: PlayerData, chapterId: BodyChapterId): number {
    const chapter = getBodyChapterDefinition(chapterId)
    const bag = this.bodyChapterBag(chapter.currency)
    const available = bag.getAmount(chapter.currency.id)
    const auxOwned = chapter.auxCurrency
      ? this.bodyChapterBag(chapter.auxCurrency).getAmount(chapter.auxCurrency.id)
      : 0

    // M-QI-09 (QI-D4c) - downward-only essence substitution resolved at
    // this cost check, no exchange UI: a material-bag physique-essence
    // requirement counts higher-grade stacks at the locked adjacent
    // ratio. C2C r10#3 + r17#1 - validate -> consume -> apply: the
    // progression mutation is computed on a cloned probe FIRST, the
    // debit plan is validated (every debit satisfiable AND the change
    // credit committable) while the real player is untouched, bags
    // commit, and only then does the real state apply. Any failure
    // returns 0 with zero state change. The resolver owns the
    // namespace gate (C2C 6) - a non-essence currency takes the
    // legacy path where the single-currency debit cannot fail.
    if (bodyChapterEssenceGrade(chapter.currency) === undefined) {
      const consumed = investBodyChapterState(player, chapterId, available, auxOwned)
      if (consumed > 0) {
        bag.remove(chapter.currency.id, consumed)
        if (chapterId === 'zhou_tian') {
          // HIDDEN-C - a completed 36/36 normal track is the discovery
          // event for the Nghich continuation (sec.12.1); the check is
          // itself gated on realm + lineage and stays a no-op otherwise.
          maybeDiscoverNghichChuTian(player)
        }
      }
      return consumed
    }

    const ownedOf = (grade: PhysiqueGradeId): number => {
      const materialId = physiqueEssenceMaterialId(grade)
      return materialId === undefined
        ? 0
        : this.deps.materialBag.getAmount(materialId)
    }
    const coverage = essenceSubstitutionCoverage(chapter.currency, ownedOf)
    const effectiveAvailable = available + coverage

    // JSON round-trip, NOT structuredClone: the live callers hand in a
    // Pinia store's reactive $state, and structuredClone throws
    // DataCloneError on any nested Proxy (SaveSystem's detachSaveValue
    // ruling). JSON stringify/parse reads through proxies at any depth.
    const probe = JSON.parse(JSON.stringify(player)) as PlayerData
    const consumed = investBodyChapterState(probe, chapterId, effectiveAvailable, auxOwned)
    if (consumed <= 0) {
      return 0
    }

    const plan = planEssenceSubstitution(consumed, chapter.currency, ownedOf)
    if (plan === undefined) {
      return 0 // fail-closed: unreachable for an essence currency
    }
    const allSatisfiable = plan.debits.every((debit) =>
      bag.has(debit.materialId, debit.amount),
    )
    // C2C r17#2 - the whole change credit must land or the invest
    // fails closed: capacity is checked against the post-debit
    // required balance before anything commits.
    let changeCommittable = true
    if (plan.change !== undefined) {
      const changeMaterial = this.deps.materialRegistry.get(plan.change.materialId)
      const requiredDebit = plan.debits.find(
        (debit) => debit.materialId === plan.change?.materialId,
      )
      const postDebitBalance =
        bag.getAmount(plan.change.materialId) - (requiredDebit?.amount ?? 0)
      changeCommittable =
        postDebitBalance + plan.change.amount <=
        (changeMaterial.stackLimit ?? MAX_STACK_AMOUNT)
    }
    if (!allSatisfiable || !changeCommittable) {
      return 0
    }

    for (const debit of plan.debits) {
      bag.remove(debit.materialId, debit.amount)
    }
    if (plan.change !== undefined) {
      const changeMaterial = this.deps.materialRegistry.get(plan.change.materialId)
      this.deps.materialBag.add(changeMaterial, plan.change.amount)
      // M-F-BODY-PERFECTION - the essence change credit is a live
      // material landing; capacity was preflighted so delivered is
      // the full amount.
      this.deps.notifyMaterialGained(plan.change.materialId, plan.change.amount)
    }
    const applied = investBodyChapterState(player, chapterId, effectiveAvailable, auxOwned)
    if (applied > 0 && chapterId === 'zhou_tian') {
      // HIDDEN-C - same post-invest discovery check as the legacy path.
      maybeDiscoverNghichChuTian(player)
    }
    return applied
  }

  /**
   * HIDDEN-C - the Nghich Chu Tian attempt command (design sec.12):
   * dual-cost, RNG + per-level pity, all inside NghichChuTian.attempt -
   * this surface only supplies the material bag. The result object is
   * presentation-neutral so UI can render outcome + costs honestly.
   */
  attemptNghichChuTian(player: PlayerData): NghichChuTianAttemptResult {
    return attemptNghichChuTian(player, this.deps.materialBag)
  }

  private bodyChapterBag(currency: BodyChapterCurrency): { getAmount(id: string): number; has(id: string, amount: number): boolean; remove(id: string, amount: number): boolean } {
    return currency.bag === 'pill' ? this.deps.pillBag : this.deps.materialBag
  }

  /**
   * M-QI-03 - normal breakthrough requirement read-model: the SAME
   * predicate rows that drive canTriggerBreakthrough, exposed so the UI
   * can render unmet requirements instead of a bare disabled button.
   * mortal: [level]; qi_refining: [level, chapterClear]; others: [].
   *
   * 2026-09-23 hidden-perfection-lineage: the rows are pure and shared
   * - this delegates to BreakthroughGate so the hidden eligibility
   *   resolver can read the ordinary gate without a class dependency.
   */
  getBreakthroughRequirements(player: PlayerData): BreakthroughRequirementRow[] {
    return gateGetBreakthroughRequirements(player)
  }

  /**
   * Unified breakthrough gate - one function for EVERY realm. Returns
   * true when the player meets the conditions to press Breakthrough
   * (Quan Khi / Truc Co / ...). Delegates to the pure gate - see
   * core/realm/BreakthroughGate.ts.
   */
  canTriggerBreakthrough(player: PlayerData): boolean {
    return gateCanTriggerBreakthrough(player)
  }
}
