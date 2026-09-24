import type { ArtifactPath } from '../artifact/Artifact'
import { tryUpgradeArtifactGrade } from '../artifact/ArtifactProgression'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { PillBag } from '../pill/PillBag'
import type { PlayerData } from '../player/Player'
import type { CultivationPathId, CultivationWayId } from '../player/CultivationPathKit'
import { applyBreakthroughMerge } from '../kiem-tu/NguKiemDao'
import { issueCompanionGifts } from '../companion/CompanionGifts'
import { CULTIVATION_PATH_MODULES, getActiveWayDefinition } from '../player/CultivationPathKit'
import type { NodeRegistry } from '../progression/NodeRegistry'
import { applyPathChoice, grantCultivationPathRealmReward as grantPathRealmReward, hasStaticPathCapability } from '../player/CultivationPathSystem'
import {
  computeBreakthroughGrade,
  getBodyRefinementCompletedTiers,
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
import {
  applyBodyPerfection,
  canPerfectBodyRealm,
} from '../realm/body/BodyPerfection'
import { bodyPerfectionMaterialIds } from '../../data/realm/BodyPerfection'
import { pourCultivationOvercharge } from '../cultivation/CultivationSystem'
import type { NotificationQueue } from './NotificationQueue'
import {
  physiqueEssenceMaterialId,
} from '../../data/realm/PhysiqueEssence'
import type { PhysiqueGradeId } from '../../data/realm/PhysiqueLadder'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'
import { BODY_REFINEMENT_TIERS } from '../../data/realm/BodyRefinement'
import { grantRealmPassive } from '../realm/RealmPassiveSystem'
import { CORE_REALM_LEVEL, QI_REFINING_BREAKTHROUGH_STAGE_ID, getCurrentRealm, getNextRealm } from '../realm/realmSystem'
import { isRealmTransitionEnabled } from '../realm/ReleasePolicy'
import { isArtifactDomainUnlocked } from '../artifact/ArtifactProgression'
import type { Skill } from '../skill/Skill'
import type { SkillManager } from '../skill/SkillManager'
import type { SkillSystem } from '../skill/SkillSystem'
import { getMainStatCap } from '../stats/StatCap'
import { MAIN_STAT_KEYS } from '../stats/StatTypes'
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

/**
 * M-QI-03 - one row of the normal breakthrough requirement read-model.
 * The UI renders a label per key; `met` is the live predicate flag.
 * Hidden foundation/grade inputs (truc_co_dan, body tiers, meridian,
 * perfection, talents) are intentionally NOT rows here - QI-D6 keeps
 * them resolver-internal.
 */
export interface BreakthroughRequirementRow {
  key: 'level' | 'chapterClear'
  met: boolean
}



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
      markQuestRealmTransition: () => void
      // M-F-BODY-PERFECTION - material-landing funnel (the essence
      // change credit is a live landing) + the shared toast sink for
      // the perfection transaction's commit notification.
      notifyMaterialGained: (materialId: string, amount: number) => void
      notifications: NotificationQueue
    },
  ) {
    this.techniqueManager = deps.techniqueManager
  }

  /** Grants the major-realm reward of the cultivation path data kit (P7-M3: artifact-only). */
  grantCultivationPathRealmReward(player: PlayerData, realmId: string): boolean {
    return grantPathRealmReward(player, realmId)
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
    if (player.swordPath && hasStaticPathCapability(player, 'sword.sword_riding')) {
      applyBreakthroughMerge(player.swordPath)
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
    if (
      player.cultivationPath ||
      player.realmId !== 'mortal' ||
      player.realmLevel < CORE_REALM_LEVEL
    ) {
      return false
    }

    // M2 - the (path, way) pair resolves its way definition from the
    // module catalog; an unknown pair yields no way and fails closed.
    // Way OFFERABILITY is no longer checked here: applyPathChoice owns
    // the offerGate evaluation.
    const way = CULTIVATION_PATH_MODULES[pathId]?.ways[wayId]

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
    // spell leaves player.spellPath { element: null, route: null } until
    // progressionOps.selectSpellPathElement() commits the atomic choice.

    if (player.realmId === 'mortal') {
      // Realm Passive & Pressure System (2026-08-20) - lock the Nhap Dao
      // grade BEFORE granting so Nhap Dao (RealmPassives.ts) reads the
      // final Luyen The value at the moment of the Initiation Ritual.
      player.breakthroughGrade = computeBreakthroughGrade(player)

      // Spec dot-pha-loi-kiep sec.4.2 - the "perfect Pham Nhan" snapshot
      // (5/5 main stats at mortal cap + Luyen The tier 6/6) locks at the
      // moment Quan Khi is pressed, NOT asked again after entering Luyen
      // Khi. It is one of the Truc Co tribulation conditions.
      player.mortalPerfectionAchieved =
        getBodyRefinementCompletedTiers(player) >= BODY_REFINEMENT_TIERS.length &&
        MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= getMainStatCap('mortal'))

      player.realmId = 'qi_refining'
      player.realmLevel = 1
      player.cultivation = 0

      // Hai Nap (M2) - banked overflow follows into the new realm's level
      // 1 - same owner helper as the minor-tier breakthrough pour.
      pourCultivationOvercharge(player)

      // R8.1 (AR-09) - realm transition may unlock quests; reconcile on
      // the next tick instead of waiting for a panel read.
      this.deps.markQuestRealmTransition()

      // M-F-COMPANION-GIFT - companion gift moments authored against
      // qi_refining entry fire here (write-if-absent; idempotent).
      this.applyCompanionGiftRealmTransition(player)

      this.syncRealmPassive(player)
      this.syncRealmStatPassive(player)
      // M6 - NO applySwordPathRealmTransition here: hidden_sword_pathway can now be picked at
      // this very ritual, so the pre-M6 "hidden_sword_pathway cannot exist at mortal"
      // assumption is false. The slice was JUST created (kiemDaoCount 1 -
      // nothing forged this realm); merging it would hand out a free
      // kiemDaoBase bump at entry. The merge stays on real major-realm
      // advances (TribulationOutcomeService), where forged swords exist.
    }

    // P7-M3 - canonical Technique grant runs AFTER the realm promotion
    // so grant() enforces the grade ceiling against qi_refining (D9/D10).
    // Preflight guarantees this cannot fail (template exists, holder
    // empty, grade within ceiling).
    this.grantCanonicalTechnique(way.techniqueId, player)

    return true
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

    const battle = this.deps.getTurnBattle()

    if (battle && (battle.state === 'intro' || battle.state === 'countdown' || battle.state === 'fighting')) {
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

    const battle = this.deps.getTurnBattle()

    if (battle && (battle.state === 'intro' || battle.state === 'countdown' || battle.state === 'fighting')) {
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

    const battle = this.deps.getTurnBattle()

    if (battle && (battle.state === 'intro' || battle.state === 'countdown' || battle.state === 'fighting')) {
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
    const realm = getCurrentRealm(player.realmId)

    const skillId = getActiveWayDefinition(player)?.realmRewards?.[realm.id]?.passiveSkillId

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
    return investBodyChapterState(player, chapterId, effectiveAvailable, auxOwned)
  }

  private bodyChapterBag(currency: BodyChapterCurrency): { getAmount(id: string): number; has(id: string, amount: number): boolean; remove(id: string, amount: number): boolean } {
    return currency.bag === 'pill' ? this.deps.pillBag : this.deps.materialBag
  }

  /**
   * M-F-BODY-PERFECTION (spec S4) - the ONE Body-perfection
   * transaction: validate -> probe -> consume -> mark -> stack ->
   * rebuild. Atomic: every gate arm + a JSON-probe pass runs before
   * ANY mutation, so a failure leaves zero state change. Idempotent:
   * an already-perfected realm short-circuits inside
   * canPerfectBodyRealm. The "stack + rebuild" steps need no explicit
   * call: getBodyPerfectionMultiplier derives live from
   * perfectedRealmIds inside the Body base-stat channel, and the UI
   * re-resolves stats on the next state bump.
   */
  perfectBodyRealm(player: PlayerData, realmId: string): boolean {
    const ownedOf = (materialId: string): number =>
      this.deps.materialBag.getAmount(materialId)

    if (!canPerfectBodyRealm(player, realmId, ownedOf)) {
      return false
    }

    const required = bodyPerfectionMaterialIds(realmId)

    if (required.length === 0) {
      return false
    }

    // Same Pinia-safe probe convention as investBodyChapter: JSON
    // round-trip (never structuredClone - proxies throw DataCloneError),
    // then the mark step dry-runs on the detached copy. Consumption
    // cannot legitimately fail past the gate, but the probe keeps the
    // atomic convention uniform - and stays fail-closed: any
    // serialization or probe exception returns false with zero mutation.
    try {
      const probe = JSON.parse(JSON.stringify(player)) as PlayerData

      if (!canPerfectBodyRealm(probe, realmId, ownedOf)) {
        return false
      }

      applyBodyPerfection(probe, realmId)
    } catch {
      return false
    }

    for (const materialId of required) {
      this.deps.materialBag.remove(materialId, 1)
    }

    applyBodyPerfection(player, realmId)

    this.deps.notifications.push({
      kind: 'loot',
      message: `Thể Phách Hoàn Thiện: ${getCurrentRealm(realmId).name}`,
      messageKey: 'notifications.bodyRealmPerfected',
      messageParams: { realm: getCurrentRealm(realmId).name },
    })

    return true
  }

  /**
   * M-QI-03 - normal breakthrough requirement read-model: the SAME
   * predicate rows that drive canTriggerBreakthrough, exposed so the UI
   * can render unmet requirements instead of a bare disabled button.
   * mortal: [level]; qi_refining: [level, chapterClear]; others: [].
   */
  getBreakthroughRequirements(player: PlayerData): BreakthroughRequirementRow[] {
    // M-F-CEILING - release policy decides whether the next transition may
    // be attempted at all; a closed transition reports no requirement rows
    // (TC -> KD stays authored but disabled in the Beta window).
    const nextRealmId = getNextRealm(player.realmId)?.id
    if (nextRealmId === undefined || !isRealmTransitionEnabled(player.realmId, nextRealmId)) {
      return []
    }
    if (player.realmId === 'mortal') {
      return [{ key: 'level', met: player.realmLevel >= CORE_REALM_LEVEL }]
    }
    if (player.realmId === 'qi_refining') {
      return [
        { key: 'level', met: player.realmLevel >= CORE_REALM_LEVEL },
        {
          key: 'chapterClear',
          met: player.completedStageIds.includes(QI_REFINING_BREAKTHROUGH_STAGE_ID),
        },
      ]
    }
    return []
  }

  /**
   * Unified breakthrough gate - one function for EVERY realm. Returns
   * true when the player meets the conditions to press Breakthrough
   * (Quan Khi / Truc Co / ...).
   *
   * QI-D5 - Truc Co admission has TWO mandatory inputs: realmLevel >=
   * CORE_REALM_LEVEL AND the qi_refining chapter-final stage cleared
   * (QI_REFINING_BREAKTHROUGH_STAGE_ID in completedStageIds). Hidden
   * grade/foundation inputs stay resolver-internal - they are not part
   * of this normal admission gate. Mortal stays level-only (its real
   * transition is the initiation ritual, chooseCultivationPath).
   *
   * PRODUCT SCOPE: the game is currently designed up to Truc Co tier 18.
   * Transitions into unreleased realms (Kim Dan+) are closed by the
   * release-policy authority (ReleasePolicy.progressionCeilingRealmId) -
   * their content stays authored/dormant.
   */
  canTriggerBreakthrough(player: PlayerData): boolean {
    const requirements = this.getBreakthroughRequirements(player)
    return requirements.length > 0 && requirements.every((row) => row.met)
  }
}
