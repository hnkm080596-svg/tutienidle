/**
 * Clean Round A - scope authority seam (blind adversarial review, tip
 * 5431ae7e). Probes the write/effect seams a carried dormant-scope save
 * can still reach across the beta lock: every seam must either fail
 * closed (refuse the op) or stay inert (emit no live effect, write no
 * live field). A FAILING test here is a confirmed defect, reproduced
 * deterministically - not a flake.
 *
 * Beta flags are pinned by lockBeta*ForTests() - the suite asserts
 * behavior under the canonical all-false table (global setup unlocks).
 */
import { describe, expect, it } from 'vitest'
import { collectTalentEffects } from '@/core/talent/TalentEffects'
import { isBetaTalentId } from '@/core/betaScope'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { GameManager } from '@/core/game/GameManager'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { KIEM_TU_NODES } from '@/data/progression/KiemTuNodes'
import { THE_TU_NODES } from '@/data/progression/TheTuNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { BREAKTHROUGH_TALENT_POOLS } from '@/data/talent/BreakthroughTalentPools'
import { buildings } from '@/data/building/buildings'
import { materials } from '@/data/materials/materials'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { freshSwordPathState } from '@/core/kiem-tu/KiemTuState'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
 return {
 ...createDefaultPlayer(),
 ...overrides,
 }
}

function swordSave(levels: Record<string, number> = {}): PlayerData {
 return player({
 cultivationPath: 'sword',
 cultivationWay: 'sword_pathway',
 swordPath: freshSwordPathState(),
 skillInsight: 100,
 nodeLevels: levels,
 purchasedNodeIds: Object.keys(levels),
 })
}

// Authored-but-dormant golden_core pool - ReleasePolicy suppresses its
// acquisition channel, so no beta save can legitimately own these ids.
const DORMANT_GOLDEN_CORE_TALENT_IDS = (BREAKTHROUGH_TALENT_POOLS.golden_core ?? []).map((t) => t.id)

describe('write seam: devResetBranch must honor the same dormant-save refusal as respecNodeTree', () => {
 // branchTag exists ONLY on dormant-tree nodes (kiem_pho / ngu_kiem /
 // the_tu / the_tu_an) - every reachable target of this op is dormant.
 it('refuses to refund or revoke dormant kiem_pho records on a carried sword save', () => {
 const gameManager = new GameManager()
 gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
 gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
 const p = swordSave({ thich_can: 2 })

 // respecNodeTree precedent: a save holding registered-dormant
 // nodeLevels is refused outright - dormant records freeze, they are
 // never monetized back into live skillInsight.
 expect(gameManager.progressionOps.devResetBranch('kiem_pho', p)).toBeNull()
 expect(p.nodeLevels).toEqual({ thich_can: 2 })
 expect(p.skillInsight).toBe(100)
 })

 it('refuses dormant the_tu records on a carried body save the same way', () => {
 const gameManager = new GameManager()
 gameManager.catalogOps.registerProgressionNodes(THE_TU_NODES)
 gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
 const p = player({
 cultivationPath: 'body',
 cultivationWay: 'body_pathway',
 skillInsight: 100,
 nodeLevels: { cuong_chien: 1 },
 purchasedNodeIds: ['cuong_chien'],
 })

 expect(gameManager.progressionOps.devResetBranch('the_tu', p)).toBeNull()
 expect(p.nodeLevels).toEqual({ cuong_chien: 1 })
 expect(p.skillInsight).toBe(100)
 })
})

describe('talent roster: dormant golden_core pool must stay out of beta admission', () => {
 it('isBetaTalentId excludes every authored-dormant golden_core talent', () => {
 // The roster documents "every talent id a beta save can legitimately
 // own"; kd_* enter only via the suppressed golden_core pool, so no
 // beta save can legitimately own them - they must fail closed.
 for (const id of DORMANT_GOLDEN_CORE_TALENT_IDS) {
 expect(isBetaTalentId(id), id).toBe(false)
 }
 })

 it('collectTalentEffects emits nothing for carried golden_core talents', () => {
 // Hostile carried save: dormant ids in selectedTalentIds. Roster
 // over-admission turns them into LIVE stat multipliers
 // (cultivation_speed +20%/40%, insight_gain +50%/100%) - dormancy
 // leaking into visible play.
 expect(collectTalentEffects(DORMANT_GOLDEN_CORE_TALENT_IDS)).toEqual([])
 expect(
 collectTalentEffects(DORMANT_GOLDEN_CORE_TALENT_IDS, {
 kd_thanh_dan: 2,
 kd_linh_dan: 2,
 }),
 ).toEqual([])
 })
})

describe('building write seam: scope-hidden chi_hien_quan must be unbuildable / unupgradable', () => {
 it('canBuildBuilding and buildBuilding refuse chi_hien_quan under the lock', () => {
 const gameManager = new GameManager()
 gameManager.catalogOps.registerBuildings(buildings)
 const p = player({ realmId: 'qi_refining' })

 // BETA_BUILDING_FEATURES maps chi_hien_quan -> manualWorkforce
 // (hidden). Every other domain write seam in the codebase returns
 // {ok:false,reason:'scope_hidden'} - the build/upgrade seam must
 // fail closed identically instead of minting a live instance and
 // writing player.autoWorkerCapacity.
 expect(gameManager.buildingOps.canBuildBuilding('chi_hien_quan', p)).toBe(false)
 expect(gameManager.buildingOps.buildBuilding('chi_hien_quan', p)).toBeNull()
 expect(gameManager.buildingManager.getAll()).toEqual([])
 expect(p.autoWorkerCapacity).toBe(0)
 })

 it('control: a live (unmapped) building with an identical free cost still builds', () => {
 const gameManager = new GameManager()
 gameManager.catalogOps.registerBuildings(buildings)
 const p = player({ realmId: 'qi_refining' })

 // Same tier-1 crafting_station shape, upgradeCost[0] === [] - the
 // only difference is the scope-feature mapping, so the contrast
 // isolates the missing gate.
 expect(gameManager.buildingOps.buildBuilding('gathering_outpost', p)).not.toBeNull()
 })

 it('upgradeBuilding refuses a carried chi_hien_quan instance and spends nothing', () => {
 const gameManager = new GameManager()
 gameManager.catalogOps.registerBuildings(buildings)
 gameManager.catalogOps.registerMaterials(materials)
 const p = player({ realmId: 'qi_refining' })
 gameManager.setActivePlayer(p)

 // Carried save: the dormant instance already exists (restore never
 // strips owned records). Level 1 -> 2 meets the realm requirement
 // (qi_refining tier 2 >= level+1) and the ore is funded - scope is
 // the ONLY possible rejector.
 gameManager.buildingManager.add({
 instanceId: 'inst_chq',
 buildingId: 'chi_hien_quan',
 level: 1,
 lastCollectedAt: 0,
 accrualRealmId: 'qi_refining',
 })
 const ore = materials.find((m) => m.id === 'mortal_ore_decade')!
 gameManager.materialBag.add(ore, 10)

 expect(gameManager.buildingOps.upgradeBuilding('inst_chq')).toBe(false)
 expect(gameManager.materialBag.getAmount('mortal_ore_decade')).toBe(10)
 expect(gameManager.buildingManager.get('inst_chq')?.level).toBe(1)
 expect(p.autoWorkerCapacity).toBe(0)
 })
})

describe('technique training seam: dormant-way techniques must not accrue mastery on a carried save', () => {
 it('gainMastery stays inert for a dormant-way active technique', () => {
 const gameManager = new GameManager()
 gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
 const sword = swordSave()
 sword.realmId = 'qi_refining'
 sword.realmLevel = 12
 gameManager.setActivePlayer(sword)

 // Carried sword save at qi_refining: sword_control_art grade 1 is
 // IN-BAND (grade === realmIndex), so the realm trainable ceiling is
 // min(18, 12) = 12 - every gate except scope is open. Kills settle
 // pendingTechniqueMastery through this exact call
 // (BattleLootSystem.settleTechniqueMastery -> TechniqueSystem.
 // gainMastery), writing mastery/rank into the dormant record and
 // mirroring player.techniqueProgress - which then feeds
 // techniqueRank prerequisites on beta unlock nodes.
 const template = TECHNIQUES.find((t) => t.id === 'sword_control_art')!
 gameManager.techniqueManager.setActive({
 ...structuredClone(template),
 rank: 4,
 mastery: 0,
 gradeHistory: {},
 })
 sword.techniqueProgress = { rank: 4, grade: 1 }

 const result = gameManager.techniqueSystem.gainMastery(10_000, 'qi_refining', 12)

 expect(result).toEqual({ gained: 0, rankUps: 0 })
 expect(gameManager.techniqueManager.getActive()?.rank).toBe(4)
 expect(sword.techniqueProgress).toEqual({ rank: 4, grade: 1 })
 })

 it('control: the beta spell technique still trains in-band', () => {
 const gameManager = new GameManager()
 gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
 const spell = player({ realmId: 'qi_refining', realmLevel: 12 })
 gameManager.setActivePlayer(spell)
 const template = TECHNIQUES.find((t) => t.id === 'five_elements_art')!
 gameManager.techniqueManager.setActive({
 ...structuredClone(template),
 rank: 4,
 mastery: 0,
 gradeHistory: {},
 })

 const result = gameManager.techniqueSystem.gainMastery(10_000, 'qi_refining', 12)
 expect(result.gained).toBeGreaterThan(0)
 expect(gameManager.techniqueManager.getActive()!.rank).toBeGreaterThan(4)
 })
})
