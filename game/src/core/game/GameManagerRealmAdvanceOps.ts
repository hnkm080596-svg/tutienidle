import type { ArtifactPath } from '../artifact/Artifact'
import { tryUpgradeArtifactGrade } from '../artifact/ArtifactProgression'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type { MaterialBag } from '../material/MaterialBag'
import type { PlayerData } from '../player/Player'
import type { CultivationPathId, CultivationWayId } from '../player/CultivationPathKit'
import { applyBreakthroughMerge } from '../kiem-tu/NguKiemDao'
import { CULTIVATION_PATH_MODULES, getActiveWayDefinition } from '../player/CultivationPathKit'
import type { NodeRegistry } from '../progression/NodeRegistry'
import { applyPathChoice, grantCultivationPathRealmReward as grantPathRealmReward, hasStaticPathCapability } from '../player/CultivationPathSystem'
import { investTinhHoa, computeBreakthroughGrade } from '../realm/BodyRefinementSystem'
import { TINH_HOA_PHAM_THE_MATERIAL_ID, BODY_REFINEMENT_TIERS } from '../../data/realm/BodyRefinement'
import { grantRealmPassive } from '../realm/RealmPassiveSystem'
import { CORE_REALM_LEVEL, getCurrentRealm } from '../realm/realmSystem'
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
import type { GameManagerProgressionOps } from './GameManagerProgressionOps'
import type { TemplateRegistry } from './TemplateRegistry'



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
      breakthroughOutcomeService: BreakthroughOutcomeService
      progressionOps: GameManagerProgressionOps
      getTurnBattle: () => TurnBattle | null
      markQuestRealmTransition: () => void
    },
  ) {
    this.techniqueManager = deps.techniqueManager
  }

  /** Grants the major-realm reward of the cultivation path data kit (P7-M3: artifact-only). */
  grantCultivationPathRealmReward(player: PlayerData, realmId: string): boolean {
    return grantPathRealmReward(player, realmId)
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
      this.deps.progressionOps.learnSkill(skillId)
    })

    // P7-M4 - starter learnedness pin: the way's starter basic is
    // learned inside the commit block (idempotent - boot already taught
    // it; this repairs a save whose starter entry is missing). A
    // successful initiation always yields a learned starter.
    if (way.starterBasicSkillId !== undefined) {
      this.deps.progressionOps.learnSkill(way.starterBasicSkillId)
    }

    // P7-M2 - way-declared initiation passives (replaces the technique's
    // innateSkillId grant). P7-M4: learn-only - learned passives always
    // apply (membership is the authority; no equip switch remains).
    for (const passiveId of way.passiveSkillIds ?? []) {
      if (!this.deps.skillManager.has(passiveId)) {
        this.deps.progressionOps.learnSkill(passiveId)
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
        player.bodyRefinementCompletedTiers >= BODY_REFINEMENT_TIERS.length &&
        MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= getMainStatCap('mortal'))

      player.realmId = 'qi_refining'
      player.realmLevel = 1
      player.cultivation = 0

      // R8.1 (AR-09) - realm transition may unlock quests; reconcile on
      // the next tick instead of waiting for a panel read.
      this.deps.markQuestRealmTransition()

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
   * P7-M3 (D4) - canonical Technique grade-advance transaction: rank 10
   * + below the realm ceiling + OUTSIDE combat + 100 x targetGrade
   * current-tier spirit stones; resets rank/mastery for the new grade.
   * The combat guard is enforced HERE, not just in the UI.
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

    return this.deps.techniqueSystem.advanceTechniqueGrade()
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

    const template = this.deps.skillTemplates.get(skillId)

    if (!template) {
      return
    }

    this.deps.skillSystem.learn(template)

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
   * Invests Tinh Hoa Pham The (held in materialBag) into the in-progress
   * Luyen The tier - see core/realm/BodyRefinementSystem.ts. Returns the
   * amount of Tinh Hoa actually consumed (0 when no tier remains or none
   * is held).
   */
  investBodyRefinement(player: PlayerData): number {
    const available = this.deps.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)

    const consumed = investTinhHoa(player, available)

    if (consumed > 0) {
      this.deps.materialBag.remove(TINH_HOA_PHAM_THE_MATERIAL_ID, consumed)
    }

    return consumed
  }

  /**
   * Unified breakthrough gate - one function for EVERY realm. Returns
   * true when the player meets the conditions to press Breakthrough
   * (Quan Khi / Truc Co / ...).
   *
   * PRODUCT SCOPE: the game is currently designed up to Truc Co tier 18.
   * Placeholder realms (Kim Dan+) return false until their content pass
   * lands.
   */
  canTriggerBreakthrough(player: PlayerData): boolean {
    if (player.realmId === 'mortal' || player.realmId === 'qi_refining') {
      return player.realmLevel >= CORE_REALM_LEVEL
    }
    return false
  }
}
