// A10 adversarial probes - fabricated-claim attacks against the
// scope-authority WRITE/EMIT seams. Each test forges a save record that
// is PROVABLY IMPOSSIBLE for a live beta writer to mint, runs the real
// acceptance layer (validateGameSaveShape / restoreFromSave) plus the
// real emit consumer, and observes whether the claim becomes live.
import { describe, expect, it } from 'vitest'
import {
  createDefaultPlayer,
  resolvePlayerStatAssembly,
  type PlayerData,
} from '/home/ubuntu/repos/tutienidle/game/src/core/player/Player'
import { GameManager } from '/home/ubuntu/repos/tutienidle/game/src/core/game/GameManager'
import { SKILLS } from '/home/ubuntu/repos/tutienidle/game/src/data/skill/Skills'
import { TECHNIQUES } from '/home/ubuntu/repos/tutienidle/game/src/data/technique/Techniques'
import { STAGES } from '/home/ubuntu/repos/tutienidle/game/src/data/stage/Stages'
import { ENEMIES } from '/home/ubuntu/repos/tutienidle/game/src/data/enemy/Enemies'
import { zones } from '/home/ubuntu/repos/tutienidle/game/src/data/stage/Zones'
import { materials } from '/home/ubuntu/repos/tutienidle/game/src/data/materials/materials'
import { pills } from '/home/ubuntu/repos/tutienidle/game/src/data/pill/pills'
import { validateGameSaveShape } from '/home/ubuntu/repos/tutienidle/game/src/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '/home/ubuntu/repos/tutienidle/game/src/services/save/saveVersion'
import { collectTalentEffects } from '/home/ubuntu/repos/tutienidle/game/src/core/talent/TalentEffects'
import { getActiveCultivationSpeedPercent } from '/home/ubuntu/repos/tutienidle/game/src/core/economy/TuLinhTranBalance'
import { betaCompletionFor, unsupportedReleaseReason } from '/home/ubuntu/repos/tutienidle/game/src/core/betaScopeSurface'
import { assertSaveAcceptable } from '/home/ubuntu/repos/tutienidle/game/src/services/save/saveAcceptance'
import { equipment } from '/home/ubuntu/repos/tutienidle/game/src/data/equipment/equipment'
import { affixes } from '/home/ubuntu/repos/tutienidle/game/src/data/equipment/affixes'
import { buildings } from '/home/ubuntu/repos/tutienidle/game/src/data/building/buildings'
import { SPIRIT_STONE_MATERIAL_ID } from '/home/ubuntu/repos/tutienidle/game/src/core/material/SpiritStoneMaterial'

// Legal beta creation output: linh_bao pick + learned entry + core
// grant - the shape mortalBoundaryContractViolation requires.
function mortalPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.mortalBasicSkillId = 'linh_bao'
  player.nodeLevels = { ...player.nodeLevels, core_linh_bao: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_linh_bao']
  return player
}

const LINH_BAO_SAVE_ENTRY = {
  id: 'linh_bao',
  name: 'Linh Bão',
  description: 'creation pick',
  type: 'active',
  level: 1,
  maxLevel: 10,
  cooldown: 0,
  target: 'enemy',
  effects: [],
}

function validSave(player: PlayerData): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [structuredClone(LINH_BAO_SAVE_ENTRY)],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

// The FULL acceptance chain every load runs: shape validation, the
// registry/preflight acceptance contract, and the dormant-record flag.
function fullAcceptance(save: Record<string, unknown>) {
  const shape = validateGameSaveShape(save)
  assertSaveAcceptable(save as never, {
    hasEquipment: (id) => equipment.some((e) => e.id === id),
    hasAffix: (id) => affixes.some((a) => a.id === id),
    hasMaterial: (id) => materials.some((m) => m.id === id),
    hasPill: (id) => pills.some((p) => p.id === id),
    hasBuilding: (id) => buildings.some((b) => b.id === id),
    getSiteDefinition: () => undefined, // forged saves carry no productionSites
    hasTechnique: (id) => TECHNIQUES.some((t) => t.id === id),
  })
  return shape
}

function bootedGameManager(): GameManager {
  const gm = new GameManager()
  gm.catalogOps.registerSkillTemplates(SKILLS)
  gm.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gm.catalogOps.registerEnemyTemplates(ENEMIES)
  gm.catalogOps.registerStages(STAGES)
  gm.catalogOps.registerZones(zones)
  gm.catalogOps.registerMaterials(materials)
  gm.catalogOps.registerPills(pills)
  return gm
}

describe('A10-P1: forged selectedTalentIds - breakthrough-pool talents on a realm that can never hold them', () => {
  it('mortal save + lk_linh_mach: validator accepts, emit emits +15% spirit stones', () => {
    const player = mortalPlayer()
    player.selectedTalentIds.push('lk_linh_mach')

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)
    expect(unsupportedReleaseReason(player)).toBeNull()

    // lk_* talents are only minted by the qi_refining breakthrough
    // entitlement - a mortal save holding one is a fabricated claim.
    const effects = collectTalentEffects(player.selectedTalentIds, player.talentLevels)
    expect(effects.some((e) => e.kind === 'spirit_stone_gain' && e.percent === 0.15)).toBe(true)
  })

  it('qi_refining save + tc_truc_hon: validator accepts, emit emits +15% cultivation speed', () => {
    const player = mortalPlayer()
    player.realmId = 'qi_refining'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.mortalBasicSkillId = undefined
    player.selectedTalentIds.push('tc_truc_hon')

    const save = validSave(player)
    save.techniques = [structuredClone(TECHNIQUES.find((entry) => entry.id === 'five_elements_art')!)]
    const result = fullAcceptance(save)
    expect(result.ok).toBe(true)
    expect(unsupportedReleaseReason(player)).toBeNull()

    // tc_* talents are only minted by the foundation_establishment
    // breakthrough entitlement - unreachable at qi_refining.
    const effects = collectTalentEffects(player.selectedTalentIds, player.talentLevels)
    expect(effects.some((e) => e.kind === 'cultivation_speed' && e.percent === 0.15)).toBe(true)
  })

  it('mortal save + levelled forged talent: talentLevels upgrade table also emits', () => {
    const player = mortalPlayer()
    player.selectedTalentIds.push('lk_linh_mach')
    player.talentLevels['lk_linh_mach'] = 2

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)

    const effects = collectTalentEffects(player.selectedTalentIds, player.talentLevels)
    expect(effects.some((e) => e.kind === 'spirit_stone_gain' && e.percent === 0.3)).toBe(true)
  })
})

describe('A10-P2: forged skills[] realm-ladder passive membership', () => {
  it('mortal save + passive_kim_dan_chi_quang (golden_core - beyond the beta ceiling): validator accepts, restore learns it, emit emits', () => {
    const gm = bootedGameManager()
    const player = mortalPlayer()

    const forgedSkill = SKILLS.find((skill) => skill.id === 'passive_kim_dan_chi_quang')!
    expect(forgedSkill.requiredRealmId).toBe('golden_core')

    const save = validSave(player)
    save.skills = [structuredClone(LINH_BAO_SAVE_ENTRY), structuredClone(forgedSkill)]

    const result = fullAcceptance(save)
    expect(result.ok).toBe(true)
    expect(unsupportedReleaseReason(player)).toBeNull()

    // Production restore path (GameManagerSaveRestore.restoreFromSave):
    // template-registered ids survive -> skillManager.restore().
    gm.saveOps.restoreFromSave(save as never)
    expect(gm.skillManager.has('passive_kim_dan_chi_quang')).toBe(true)

    // Emit seam: getScaledPassiveModifiers skips only way-owned dormant
    // ids; realm-ladder passives are not way-owned -> LIVE emission.
    const emitted = gm.skillSystem.getScaledPassiveModifiers()
    expect(emitted.some((m) => m.sourceId === 'passive_kim_dan_chi_quang')).toBe(true)
  })

  it('qi_refining save + passive_truc_co_y_chi (foundation - one realm ahead): also emits', () => {
    const gm = bootedGameManager()
    const player = mortalPlayer()
    player.realmId = 'qi_refining'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.mortalBasicSkillId = undefined

    const forgedSkill = SKILLS.find((skill) => skill.id === 'passive_truc_co_y_chi')!
    const save = validSave(player)
    save.techniques = [structuredClone(TECHNIQUES.find((entry) => entry.id === 'five_elements_art')!)]
    save.skills = [structuredClone(LINH_BAO_SAVE_ENTRY), structuredClone(forgedSkill)]

    expect(fullAcceptance(save).ok).toBe(true)
    gm.saveOps.restoreFromSave(save as never)
    expect(gm.skillManager.has('passive_truc_co_y_chi')).toBe(true)
    const emitted = gm.skillSystem.getScaledPassiveModifiers()
    expect(emitted.some((m) => m.sourceId === 'passive_truc_co_y_chi')).toBe(true)
  })
})

describe('A10-P3: forged grantedRealmPassiveIds marker + claim modifier', () => {
  it('mortal save + foundation marker + kien_co modifier + highestFoundationAchieved=heaven: validator accepts, emit +10% all main stats', () => {
    const player = mortalPlayer()
    player.grantedRealmPassiveIds.push('foundation_establishment')
    player.highestFoundationAchieved = 'heaven'
    player.modifiers.push({
      id: 'realm-passive:kien_co:strength',
      sourceId: 'kien_co',
      sourceType: 'realm',
      stat: 'strength',
      percent: 0.1,
    })

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)
    expect(unsupportedReleaseReason(player)).toBeNull()

    const baseline = resolvePlayerStatAssembly(createDefaultPlayer(), []).stats
    const forged = resolvePlayerStatAssembly(player, []).stats
    expect(forged.strength).toBeCloseTo(baseline.strength * 1.1)
  })

  it('mortal save + qi_refining marker + nhap_dao modifier: emits +18% maxHp at grade 6', () => {
    const player = mortalPlayer()
    player.grantedRealmPassiveIds.push('qi_refining')
    player.modifiers.push({
      id: 'realm-passive:nhap_dao:maxHp',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'maxHp',
      percent: 0.18,
    })

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)

    const baseline = resolvePlayerStatAssembly(createDefaultPlayer(), []).stats
    const forged = resolvePlayerStatAssembly(player, []).stats
    expect(forged.maxHp).toBeCloseTo(baseline.maxHp * 1.18)
  })
})

describe('A10-P4: forged breakthroughGrade magnitude on a legit qi_refining save', () => {
  it('grade=50 (writer mints 1-6): validator accepts, nhap_dao emits +150%', () => {
    const player = mortalPlayer()
    player.realmId = 'qi_refining'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.mortalBasicSkillId = undefined
    player.breakthroughGrade = 50
    player.grantedRealmPassiveIds.push('qi_refining')
    player.modifiers.push({
      id: 'realm-passive:nhap_dao:maxHp',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'maxHp',
      percent: 0.18,
    })

    const save = validSave(player)
    save.techniques = [structuredClone(TECHNIQUES.find((entry) => entry.id === 'five_elements_art')!)]
    const result = fullAcceptance(save)
    expect(result.ok).toBe(true)

    const baseline = resolvePlayerStatAssembly(createDefaultPlayer(), []).stats
    const forged = resolvePlayerStatAssembly(player, []).stats
    // Rebuilt claim: percent = breakthroughGrade * 0.03 = 1.5 -> +150%.
    expect(forged.maxHp).toBeCloseTo(baseline.maxHp * 2.5)
  })
})

describe('A10-P4b: forged loi_kiep accrual modifier (writer: tribulation victory only)', () => {
  it('mortal save holding loi_kiep + talent_loi_kiep_* percent=0.3: validator accepts, emit emits +30%', () => {
    const player = mortalPlayer()
    player.selectedTalentIds.push('loi_kiep') // a legit creation pick
    player.modifiers.push({
      id: 'talent_loi_kiep_strength',
      sourceId: 'loi_kiep',
      sourceType: 'talent',
      stat: 'strength',
      percent: 0.3,
    })

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)
    expect(unsupportedReleaseReason(player)).toBeNull()

    // The ONLY writer of talent_loi_kiep_* is applyLoiKiepVictoryBonus -
    // a mortal has never won a tribulation, so any percent>0 is forged.
    const baseline = resolvePlayerStatAssembly(createDefaultPlayer(), []).stats
    const forged = resolvePlayerStatAssembly(player, []).stats
    expect(forged.strength).toBeCloseTo(baseline.strength * 1.3)
  })
})

describe('A10-P5: forged perfectClear + autoFarm on a beyond-realm stage', () => {
  it('mortal save + perfect-clear claim on foundation_floor_1: validator accepts, auto-farm mints rewards', () => {
    const gm = bootedGameManager()
    const player = mortalPlayer()

    // foundation_floor_1 requires foundation_establishment - a mortal
    // can never enter it, let alone perfect-clear it.
    const stage = STAGES.find((s) => s.id === 'foundation_floor_1')!
    expect(stage.requiredRealmId).toBe('foundation_establishment')

    player.perfectClearStageIds.push('foundation_floor_1')
    player.perfectClearSeconds['foundation_floor_1'] = 60
    player.autoFarmStage = { stageId: 'foundation_floor_1', lastCheckedMs: Date.now() - 120_000 }

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)
    expect(unsupportedReleaseReason(player)).toBeNull()

    // Eligibility seam: no realm/eligibility re-check on the claim.
    expect(gm.turnBattleOps.autoFarmOps.isAutoFarmStageEligible(player, 'foundation_floor_1')).toBe(true)

    const stonesBefore = gm.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
    gm.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 120)
    const stonesAfter = gm.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(stonesAfter).toBeGreaterThan(stonesBefore)
  })
})

describe('A10-P5b: forged completedStageIds on the final boss stage (mortal)', () => {
  it('foundation_floor_10 in completedStageIds passes acceptance -> betaComplete read-model fires', () => {
    const player = mortalPlayer()
    player.completedStageIds.push('foundation_floor_10')

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)

    // betaCompletionFor never re-checks realm - the fabricated clear
    // lights the Beta Complete surface on a mortal save.
    expect(betaCompletionFor(player).betaComplete).toBe(true)
  })
})

describe('A10-P6: forged persistentTimedEffects tu_linh_tran (dead writer + unbounded expiry)', () => {
  it('mortal save + tu_linh_tran effect expiring in year 2126: validator accepts, +25% cultivation speed live', () => {
    const player = mortalPlayer()
    player.persistentTimedEffects.push({
      id: 'forged_1',
      sourceItemId: 'tu_linh_tran',
      effectGroup: 'tu_linh_tran',
      appliedAtMs: Date.now(),
      expiresAtMs: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000, // writer mints 24h only
      cultivationSpeedPercent: 0.25,
      durationStackable: false,
      modifiers: [],
    })

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(true)
    expect(unsupportedReleaseReason(player)).toBeNull()

    // Emit seam (CultivationTick): +25% cultivation speed, effectively
    // permanent.
    expect(getActiveCultivationSpeedPercent(player.persistentTimedEffects, Date.now())).toBeCloseTo(0.25)
  })

  it('forged percent ABOVE the writer bound is rejected (writer-shape guard works)', () => {
    const player = mortalPlayer()
    player.persistentTimedEffects.push({
      id: 'forged_2',
      sourceItemId: 'tu_linh_tran',
      effectGroup: 'tu_linh_tran',
      appliedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      cultivationSpeedPercent: 0.9,
      durationStackable: false,
      modifiers: [],
    })

    const result = fullAcceptance(validSave(player))
    expect(result.ok).toBe(false)
  })
})
