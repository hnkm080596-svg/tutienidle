import type { ArtifactPath } from '../artifact/Artifact'
import { tryUpgradeArtifactGrade } from '../artifact/ArtifactProgression'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type { MaterialBag } from '../material/MaterialBag'
import type { PlayerData, KiemTuRoute } from '../player/Player'
import type { CultivationPathId } from '../player/CultivationPathKit'
import {
  CULTIVATION_PATH_KITS,
  PHAP_TU_AN_BASIC_ID,
  PHAP_TU_AN_SPECIAL_ID,
} from '../player/CultivationPathKit'
import type { NodeRegistry } from '../progression/NodeRegistry'
import { grantCultivationPathRealmReward as grantPathRealmReward, isPhapTuAnEligible } from '../player/CultivationPathSystem'
import { investTinhHoa, computeBreakthroughGrade } from '../realm/BodyRefinementSystem'
import { TINH_HOA_PHAM_THE_MATERIAL_ID, BODY_REFINEMENT_TIERS } from '../../data/realm/BodyRefinement'
import { grantRealmPassive } from '../realm/RealmPassiveSystem'
import { CORE_REALM_LEVEL, getCurrentRealm } from '../realm/realmSystem'
import type { Skill } from '../skill/Skill'
import { HUY_KIEM_L3_CASTS } from '../skill/SkillSystem'
import type { SkillManager } from '../skill/SkillManager'
import type { SkillSystem } from '../skill/SkillSystem'
import { getMainStatCap } from '../stats/StatCap'
import { MAIN_STAT_KEYS } from '../stats/StatTypes'
import type { Technique } from '../technique/Technique'
import type { TechniqueManager } from '../technique/TechniqueManager'
import type { TechniqueSystem } from '../technique/TechniqueSystem'
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
 * BreakthroughOutcomeService (techniqueManager + the 4 sync/learn/equip
 * methods below).
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

  /** Grants the major-realm reward of the cultivation path data kit. */
  grantCultivationPathRealmReward(player: PlayerData, realmId: string): boolean {
    return grantPathRealmReward(player, realmId, {
      getEquippedTechnique: () => this.deps.techniqueManager.getEquipped(),
      getTechnique: techniqueId => this.deps.techniqueManager.get(techniqueId),
      learnTechnique: techniqueId => this.learnTechnique(techniqueId),
      equipTechnique: techniqueId => this.equipTechnique(techniqueId),
    })
  }

  /**
   * R8.2 Slice 2 (AR-10): facade for the minor-realm breakthrough outcome
   * chain. The service owns all consequences (passive sync, banked
   * artifact release, and the documented-dead major-realm branches);
   * this orchestrator only delegates (A5 — no formula logic here).
   * `player` must be the Pinia store instance, NOT `store.$state`
   * (same absent-key write semantics as TribulationOutcomeService).
   */
  breakthroughWithConsequences(player: BreakthroughPlayerWriter): BreakthroughOutcomeResult {
    return this.deps.breakthroughOutcomeService.breakthrough(player, this)
  }

  learnTechnique(techniqueId: string): boolean {
    const template = this.deps.techniqueTemplates.get(techniqueId)

    if (!template) {
      return false
    }

    return this.deps.techniqueSystem.learn(template)
  }

  /**
   * A combat technique may carry `innateSkillId` (signature combat
   * innate) - auto-learn + equip that passive skill the moment the
   * technique is equipped, same pattern as syncRealmPassive()
   * (idempotent via skillManager.has(); un-equipping the technique later
   * does NOT remove the skill - "learned is kept" system-wide).
   */
  equipTechnique(techniqueId: string): boolean {
    const success = this.deps.techniqueSystem.equip(techniqueId)

    if (!success) {
      return false
    }

    const technique = this.deps.techniqueManager.get(techniqueId)

    if (technique?.innateSkillId && !this.deps.skillManager.has(technique.innateSkillId)) {
      const template = this.deps.skillTemplates.get(technique.innateSkillId)

      if (template) {
        this.deps.skillSystem.learn(template)

        // innateSkillId is always a passive (see Technique.ts) - not part
        // of the Skill Loadout, uses equipWithoutSlot() like every other
        // passive (syncRealmPassive()).
        this.deps.skillSystem.equipWithoutSlot(technique.innateSkillId)
      }
    }

    return true
  }

  unequipTechnique(techniqueId: string): boolean {
    return this.deps.techniqueSystem.unequip(techniqueId)
  }

  /**
   * Phap Tu profession-tier ladder (2026-08-14, merged combat technique
   * 2026-08-15) - "choose profession", ONE TIME ONLY, PERMANENT (see
   * PlayerData.cultivationPath) - auto-grants the fixed kit of that tier:
   * 1 merged technique (OVERWRITES the equipped one, including the
   * starter) + 3 fixed skills (basic/special/ultimate, OVERWRITING any
   * skills holding those 3 slots). NOT a free-build system - reuses
   * learnTechnique()/equipTechnique()/learnSkill()/equipToSlot() intact.
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
  chooseCultivationPath(pathId: CultivationPathId, player: PlayerData): boolean {
    if (
      player.cultivationPath ||
      player.realmId !== 'mortal' ||
      player.realmLevel < CORE_REALM_LEVEL
    ) {
      return false
    }

    // Phap Tu An (Task 7) — hidden path, offered only when linh_bao
    // reached Lv3 at THIS ritual moment. Re-check BEFORE any side
    // effect (technique learn/equip, cultivationPath write): an
    // ineligible pick mutates nothing. The persisted record is
    // cultivationPath itself — no eligibility flag is stored, and
    // post-ritual casts can never reopen the option.
    if (pathId === 'phap_tu_an' && !isPhapTuAnEligible(player)) {
      return false
    }

    const kit = CULTIVATION_PATH_KITS[pathId]

    // Kiem Tu route resolves BEFORE the commit so grant validation can
    // see which skill the ritual will grant (spec 2026-08-29 §1 — tram
    // Lv3 at path choice -> Bat Kiem, otherwise Kiem Tran).
    const kiemTuRoute: KiemTuRoute | null =
      pathId === 'kiem_tu'
        ? (player.skillCastCounts?.['tram'] ?? 0) >= HUY_KIEM_L3_CASTS
          ? 'bat_kiem'
          : 'kiem_tran'
        : null

    // Transaction boundary (review round-4, atomicity hardening): verify
    // every registry entry the ritual grants BEFORE committing
    // cultivationPath — a missing template must fail the whole choice,
    // never leave the path committed with a partial kit.
    const techniqueTemplate = this.deps.techniqueTemplates.get(kit.techniqueId)

    if (!techniqueTemplate) {
      return false
    }

    if (
      techniqueTemplate.innateSkillId !== undefined &&
      !this.deps.skillTemplates.has(techniqueTemplate.innateSkillId)
    ) {
      return false
    }

    const grantedSkillIds: readonly string[] =
      pathId === 'phap_tu_an'
        ? [PHAP_TU_AN_BASIC_ID, PHAP_TU_AN_SPECIAL_ID]
        : kiemTuRoute === 'bat_kiem'
          ? ['bat_kiem_thuat']
          : (kit.skillIds ?? [])

    if (grantedSkillIds.some((skillId) => !this.deps.skillTemplates.has(skillId))) {
      return false
    }

    if (kiemTuRoute === 'kiem_tran' && !this.deps.nodeRegistry.has('kiem_tran_luong_nghi')) {
      return false
    }

    player.cultivationPath = pathId

    this.learnTechnique(kit.techniqueId)
    this.equipTechnique(kit.techniqueId)

    // Kiem The / Kiem Y (spec 2026-08-29-kiem-the-kiem-y §1) - the route
    // locks PERMANENTLY at path choice: Huy Kiem (tram) already at Lv3
    // (10,000 casts) -> Bat Kiem; otherwise Kiem Tran. There is NO route
    // switch API (setKiemTuRoute removed) - the other branch's nodes are
    // hidden in the UI (SkillPathPanel renders one branch per route).
    // kit.skillIds for Kiem Tu is intentionally unused (each route has a
    // single skill, granted in this branch) - the old 3-skill tuple stays
    // in CultivationPathKit.
    if (pathId === 'phap_tu_an') {
      this.deps.progressionOps.learnSkill(PHAP_TU_AN_BASIC_ID)
      this.deps.progressionOps.learnSkill(PHAP_TU_AN_SPECIAL_ID)
      this.deps.skillSystem.equipToSlot(PHAP_TU_AN_BASIC_ID, 0)
      this.deps.skillSystem.equipToSlot(PHAP_TU_AN_SPECIAL_ID, 1)
    } else if (pathId === 'kiem_tu') {
      player.kiemTuRoute = kiemTuRoute!

      // Each route OWNS 1 active skill (spec §5) - strip the old kit
      // skills + tram from the loadout (NOT unlearn: a Pham Nhan save
      // can still use tram; once Kiem Tu locked the route, tram is
      // blocked from re-equip by the SkillSystem guard - see the tram
      // guard below).
      this.deps.skillSystem.unequip('tram')
      for (const skillId of ['ngu_kiem_thuat', 'kiem_khai_thien_mon', 'van_kiem_trieu_tong']) {
        this.deps.skillSystem.unequip(skillId)
      }
    } else if (kit.skillIds) {
      kit.skillIds.forEach((skillId, index) => {
        this.deps.progressionOps.learnSkill(skillId)
        this.deps.skillSystem.equipToSlot(skillId, index)
      })
    }
    // Phap Tu Reimagined (Task 6) — no auto-Fire starter: choosing
    // phap_tu leaves player.phapTu { element: null, route: null } until
    // progressionOps.selectPhapTuElement() commits the atomic choice.

    if (player.realmId === 'mortal') {
      // Realm Passive & Pressure System (2026-08-20) - lock the Nhap Dao
      // grade BEFORE granting so Nhap Dao (RealmPassives.ts) reads the
      // final Luyen The value at the moment of the Initiation Ritual.
      player.breakthroughGrade = computeBreakthroughGrade(player)

      // Spec dot-pha-loi-kiep §4.2 - the "perfect Pham Nhan" snapshot
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
    }

    // Kiem The / Kiem Y (spec §1/5) - grant the route skill AFTER the
    // realm advance: the Luong Nghi root has a 'qi_refining' realm prereq,
    // so the realm swap must happen before purchaseNode. Each route OWNS
    // 1 active skill at slot 0 (don kiem/bat kiem thuat or da kiem/luong
    // nghi evolution).
    if (pathId === 'kiem_tu' && player.kiemTuRoute === 'bat_kiem') {
      this.deps.progressionOps.learnSkill('bat_kiem_thuat')
      this.deps.skillSystem.equipToSlot('bat_kiem_thuat', 0)
    } else if (pathId === 'kiem_tu') {
      this.deps.progressionOps.purchaseNode('kiem_tran_luong_nghi', player)
    }

    return true
  }

  /**
   * Ban Menh Phap Bao (doc §7.1) - choose/switch the Cong/Thu/Khong
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
   * Ban Menh Phap Bao (doc §5.3) - upgrade grade with Doan Bao Thach,
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
   * Unlocks + auto-equips the passive skill for the player's current
   * realm - call right after a successful breakthrough(). The passive
   * source now comes from the EQUIPPED technique
   * (Technique.passiveSkillIdsByRealm, merged 2026-08-15 - no separate
   * 'cultivation' slot), no longer fixed per realm (the old
   * RealmData.unlockSkillId) - swapping technique also swaps the 9 future
   * passives, while already-learned passives stay. No equipped technique
   * means no passive is learned. Idempotent (checks skillManager.has()
   * before learn) so repeat calls or post-load calls are safe.
   */
  syncRealmPassive(player: PlayerData) {
    const realm = getCurrentRealm(player.realmId)

    const technique = this.deps.techniqueManager.getEquipped()

    const skillId = technique?.passiveSkillIdsByRealm?.[realm.id]

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

    // Passives do NOT belong to the Skill Loadout (no slot contention
    // with active skills) - equipWithoutSlot() behaves exactly like the
    // old equip() did for passives.
    this.deps.skillSystem.equipWithoutSlot(skillId)
  }

  /**
   * Realm Passive & Pressure System (2026-08-20) - grants the PERMANENT
   * buff (Nhap Dao/Kien Co/..., see data/realm/RealmPassives.ts) of the
   * CURRENT realm; named apart from syncRealmPassive() above (that is
   * the technique-based passive SKILL, this is the stat modifier by
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
