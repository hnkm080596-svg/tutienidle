/**
 * TC8 blind falsification probes - hostile save payloads against the
 * current validation/restore/emit boundary (commit ae4af514).
 * Convention: every `expect` asserts the HONEST boundary behavior, so a
 * failing assertion IS the defect landing. console.log lines capture the
 * measured outcome either way.
 */
import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { lockBetaWaysForTests } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaTalentsForTests } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/game/__fixtures__/betaTalentsUnlock'

import { GameManager } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/player/Player'
import { materials } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/materials/materials'
import { pills } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/pill/pills'
import { equipment } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/equipment/equipment'
import { affixes } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/equipment/affixes'
import { buildings } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/building/buildings'
import { SKILLS } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/skill/Skills'
import { TECHNIQUES } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/technique/Techniques'
import { alchemyRecipes } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/alchemy/alchemyRecipes'
import { QUESTS } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/data/quest/quests'
import { usePlayerStore } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/stores/player'
import { restoreGameSession, type GameSave } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/services/save/saveVersion'
import { validateGameSaveShape } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/services/save/saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/services/save/saveAcceptance'
import { withMortalCreationPick } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/services/save/GameSave.fixture'
import { getActiveCultivationSpeedPercent, TU_LINH_TRAN_DURATION_MS } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/economy/TuLinhTranBalance'
import { GameManagerAutoFarmOps } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/game/GameManagerAutoFarmOps'
import { toTurnSkillDefinition } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/skilldef/LegacySkillAdapter'
import { getPrecursorFlatDamageBonus } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/skill/SkillSystem'
import { TribulationOutcomeService } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/tribulation/TribulationOutcomeService'
import { getRealmIndex, CORE_REALM_LEVEL, QI_REFINING_BREAKTHROUGH_STAGE_ID } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/realm/realmSystem'
import { getActiveWayDefinition } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/player/CultivationPathKit'
import type { RealmId } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/realm/Realm'
import type { Technique } from '/home/ubuntu/repos/tutienidle/.agent-worktrees/tc8-review/game/src/core/technique/Technique'

// Re-pin the real beta lock (the shared setup file unlocks everything).
lockBetaWaysForTests()
lockBetaFeaturesForTests()
lockBetaTalentsForTests()

const catalogs = staticSaveAcceptanceCatalogs()

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates([...SKILLS])
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  manager.catalogOps.registerQuests(QUESTS)
  return manager
}

function grantWayCores(player: PlayerData) {
  for (const skillId of getActiveWayDefinition(player)?.coreSkillIds ?? []) {
    const coreId = `core_${skillId}`
    player.nodeLevels[coreId] = Math.max(player.nodeLevels[coreId] ?? 0, 1)
    if (!player.purchasedNodeIds.includes(coreId)) player.purchasedNodeIds.push(coreId)
  }
}

function committedPlayer(realmId: RealmId, overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.spellPath = { element: null }
  player.realmId = realmId
  player.realmLevel = 1
  delete player.mortalBasicSkillId
  Object.assign(player, overrides)
  grantWayCores(player)
  return player
}

function mortalPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  Object.assign(player, overrides)
  return player
}

function wayTechnique(realmIndex: number): Technique {
  const entry = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
  entry.grade = Math.max(1, Math.min(entry.grade, realmIndex))
  entry.gradeHistory = {}
  for (let g = 1; g < entry.grade; g += 1) {
    entry.gradeHistory[g] = { finalRank: 18, completionState: 'vien_man' }
  }
  if (entry.grade < realmIndex) {
    entry.gradeHistory[entry.grade] = { finalRank: 18, completionState: 'vien_man' }
  }
  return entry
}

function buildSave(
  player: PlayerData,
  overrides: Partial<GameSave> = {},
  mortal = false,
): GameSave {
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: mortal ? [] : [wayTechnique(getRealmIndex(player.realmId))],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    alchemyJobs: [],
    decompose: {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    },
    ...overrides,
  }
  if (mortal) withMortalCreationPick(save, 'linh_bao')
  return save
}

function classify(save: GameSave) {
  const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
  const acceptable =
    shape.ok === true &&
    shape.normalizedSave !== undefined &&
    isSaveAcceptable(shape.normalizedSave as GameSave, catalogs)
  return { shape, acceptable }
}

function boot(save: GameSave) {
  setActivePinia(createPinia())
  const playerStore = usePlayerStore()
  const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
  const manager = makeManager()
  const result = shape.ok
    ? restoreGameSession(playerStore, manager, shape.normalizedSave as GameSave)
    : { status: 'rejected' as const, message: 'shape' }
  return { playerStore, manager, result, shape }
}

const NHAP_DAO_MODS = (percent: number) =>
  ['maxHp', 'hpRegenPerTurn', 'maxMp', 'manaRegenPerTurn'].map((stat) => ({
    id: `realm-passive:nhap_dao:${stat}`,
    sourceId: 'nhap_dao',
    sourceType: 'realm' as const,
    stat,
    percent,
  }))

const KIEN_CO_MODS = (percent: number) =>
  ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'].map((stat) => ({
    id: `realm-passive:kien_co:${stat}`,
    sourceId: 'kien_co',
    sourceType: 'realm' as const,
    stat,
    percent,
  }))

const LOI_KIEP_MODS = (percent: number) =>
  ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'].map((stat) => ({
    id: `talent_loi_kiep_${stat}`,
    sourceId: 'loi_kiep',
    sourceType: 'talent' as const,
    stat,
    percent,
  }))

// ---------------------------------------------------------------- A: builder-input magnitude
describe('TC8-A breakthroughGrade (nhap_dao builder input, legit range [1,6])', () => {
  it('A1: forged breakthroughGrade=1e9 emits +3e7 percent live', () => {
    const save = buildSave(
      committedPlayer('qi_refining', { breakthroughGrade: 1e9 }),
      {},
      false,
    )
    save.player.grantedRealmPassiveIds = ['qi_refining']
    save.player.modifiers = NHAP_DAO_MODS(0.18)

    const { shape, acceptable } = classify(save)
    console.log(`[A1] shape.ok=${shape.ok} acceptable=${acceptable} issues=${JSON.stringify(shape.ok ? [] : shape.issues)}`)
    const { playerStore, manager, result } = boot(save)
    console.log(`[A1] restore=${result.status}`)

    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    const cleanPlayer = committedPlayer('qi_refining')
    cleanPlayer.breakthroughGrade = 6
    cleanPlayer.grantedRealmPassiveIds = ['qi_refining']
    cleanPlayer.modifiers = []
    const cleanStats = makeManager().resolveAmbientPlayerStats(cleanPlayer)
    console.log(`[A1] forged maxHp=${stats.maxHp} vs clean-authored maxHp=${cleanStats.maxHp}`)
    // Honest bound: grade<=6 -> percent<=0.18 -> maxHp at most ~1.2x clean.
    expect(stats.maxHp).toBeLessThan(cleanStats.maxHp * 2)
  })

  it('A2: forged breakthroughGrade=100 mortal-side (marker forge) lands too', () => {
    const player = mortalPlayer({ breakthroughGrade: 100 })
    const save = buildSave(player, {}, true)
    save.player.grantedRealmPassiveIds = ['qi_refining']
    save.player.modifiers = NHAP_DAO_MODS(0.18)

    const { shape } = classify(save)
    const { playerStore, manager, result } = boot(save)
    console.log(`[A2] mortal shape.ok=${shape.ok} restore=${result.status}`)
    if (result.status !== 'ok') return
    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    const cleanStats = makeManager().resolveAmbientPlayerStats(mortalPlayer())
    console.log(`[A2] mortal forged maxHp=${stats.maxHp} clean=${cleanStats.maxHp}`)
    expect(stats.maxHp).toBeLessThan(cleanStats.maxHp * 2)
  })
})

// ------------------------------------------------ B: realm-eligibility hole on kien_co marker
describe('TC8-B kien_co marker on non-foundation realms', () => {
  it('B1: mortal save claiming foundation_establishment passive + heaven (+10% mains)', () => {
    const player = mortalPlayer()
    player.baseStats.strength = 100
    const save = buildSave(player, {}, true)
    save.player.grantedRealmPassiveIds = ['foundation_establishment']
    save.player.modifiers = KIEN_CO_MODS(0.1)
    save.player.highestFoundationAchieved = 'heaven'

    const { shape, acceptable } = classify(save)
    const { playerStore, manager, result } = boot(save)
    console.log(`[B1] mortal+kien_co shape.ok=${shape.ok} acceptable=${acceptable} restore=${result.status}`)
    if (result.status !== 'ok') return
    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    // Clean side takes the SAME restore path (base 100 -> cap clamped) so
    // only the kien_co claim differs.
    const cleanPlayer = mortalPlayer()
    cleanPlayer.baseStats.strength = 100
    const cleanSave = buildSave(cleanPlayer, {}, true)
    const clean = boot(cleanSave)
    const cleanStats = clean.manager.resolveAmbientPlayerStats(clean.playerStore.$state)
    const emittedKienCo = playerStore.$state.modifiers.filter((m) => m.sourceId === 'kien_co').length
    console.log(`[B1] strength forged=${stats.strength} clean-booted=${cleanStats.strength} kienCoEmitted=${emittedKienCo}`)
    expect(stats.strength).toBe(cleanStats.strength)
  })

  it('B2: qi_refining claims heaven-grade kien_co without the breakthrough', () => {
    const player = committedPlayer('qi_refining', { highestFoundationAchieved: 'heaven' })
    player.baseStats.strength = 100
    const save = buildSave(player)
    save.player.grantedRealmPassiveIds = ['qi_refining', 'foundation_establishment']
    save.player.modifiers = [...NHAP_DAO_MODS(0.18), ...KIEN_CO_MODS(0.1)]

    const { shape } = classify(save)
    const { playerStore, manager, result } = boot(save)
    console.log(`[B2] qr+kien_co shape.ok=${shape.ok} restore=${result.status}`)
    if (result.status !== 'ok') return
    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    const cleanPlayer = committedPlayer('qi_refining')
    cleanPlayer.baseStats.strength = 100
    cleanPlayer.grantedRealmPassiveIds = ['qi_refining']
    cleanPlayer.modifiers = NHAP_DAO_MODS(0.18)
    const clean = boot(buildSave(cleanPlayer))
    const cleanStats = clean.manager.resolveAmbientPlayerStats(clean.playerStore.$state)
    console.log(`[B2] strength forged=${stats.strength} clean-booted=${cleanStats.strength}`)
    expect(stats.strength).toBe(cleanStats.strength)
  })
})

// ---------------------------------------------------------- C: loi_kiep global bound (0.9)
describe('TC8-C loi_kiep persisted percent trusted verbatim', () => {
  it('C1: qi_refining claims 0.9 loi_kiep percent (beta max legit ~0.2)', () => {
    const player = committedPlayer('qi_refining', {
      selectedTalentIds: ['loi_kiep'],
      talentLevels: { loi_kiep: 1 },
    })
    const save = buildSave(player)
    save.player.grantedRealmPassiveIds = ['qi_refining']
    save.player.modifiers = [...NHAP_DAO_MODS(0.18), ...LOI_KIEP_MODS(0.9)]

    const { shape, acceptable } = classify(save)
    const { playerStore, manager, result } = boot(save)
    console.log(`[C1] shape.ok=${shape.ok} acceptable=${acceptable} restore=${result.status}`)
    if (result.status !== 'ok') return
    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    const cleanPlayer = committedPlayer('qi_refining')
    cleanPlayer.grantedRealmPassiveIds = ['qi_refining']
    const cleanStats = makeManager().resolveAmbientPlayerStats(cleanPlayer)
    console.log(`[C1] strength forged=${stats.strength} clean=${cleanStats.strength}`)
    expect(stats.strength).toBeLessThan(cleanStats.strength * 1.3)
  })
})

// ---------------------------------------------------------- D: skill instance fields trusted
describe('TC8-D persisted skill combat scalars survive restore', () => {
  it('D1: forged cooldown/cost/targeting on learned linh_bao land in the turn adapter', () => {
    const player = mortalPlayer()
    const save = buildSave(player, {}, true)
    const linhBao = save.skills.find((s) => s.id === 'linh_bao')!
    const authored = SKILLS.find((s) => s.id === 'linh_bao')!
    linhBao.cooldown = 0
    linhBao.targeting = { shape: 'all_lanes', columnRadius: 3, maxTargets: 99 }
    console.log(`[D1] authored cooldown=${authored.cooldown} targeting=${JSON.stringify(authored.targeting)}`)

    const { shape } = classify(save)
    const { manager, result } = boot(save)
    console.log(`[D1] shape.ok=${shape.ok} restore=${result.status}`)
    if (result.status !== 'ok') return
    const live = manager.skillManager.get('linh_bao')!
    const turn = toTurnSkillDefinition(live, manager.skillSystem.getEffectiveSkill(live))
    console.log(`[D1] live cooldownTurns=${turn.cooldownTurns} resourceCost=${turn.resourceCost} targeting=${JSON.stringify(turn.targeting)}`)
    expect(turn.cooldownTurns).toBe(authored.cooldown)
    expect(turn.targeting.shape).toBe('single')
  })

  it('D2: forged totalExperience=1e9 mints precursor flat damage', () => {
    const player = mortalPlayer()
    const save = buildSave(player, {}, true)
    const linhBao = save.skills.find((s) => s.id === 'linh_bao')!
    linhBao.totalExperience = 1e9

    const { manager, result } = boot(save)
    console.log(`[D2] restore=${result.status}`)
    if (result.status !== 'ok') return
    const live = manager.skillManager.get('linh_bao')!
    const effective = manager.skillSystem.getEffectiveSkill(live)
    const forgedBonus = getPrecursorFlatDamageBonus(1e9)
    const cleanBonus = getPrecursorFlatDamageBonus(0)
    const action = (effective.triggers?.[0]?.actions ?? [])[0]
    console.log(`[D2] forged flat bonus=${forgedBonus} (clean=${cleanBonus}) live action value=${(action as { value?: number })?.value}`)
    expect((action as { value: number }).value).toBe(1 + cleanBonus)
  })

  it('D3: dormant passive claim (passive_kim_dan_chi_quang, golden_core) becomes a live passive', () => {
    const player = committedPlayer('qi_refining')
    const save = buildSave(player)
    save.player.grantedRealmPassiveIds = ['qi_refining']
    save.player.modifiers = NHAP_DAO_MODS(0.18)
    save.skills.push(structuredClone(SKILLS.find((s) => s.id === 'passive_kim_dan_chi_quang')!))

    const { shape } = classify(save)
    const { manager, result } = boot(save)
    console.log(`[D3] shape.ok=${shape.ok} restore=${result.status}`)
    if (result.status !== 'ok') return
    const livePassives = manager.skillManager.getPassiveSkills().map((s) => s.id)
    console.log(`[D3] live passives=${JSON.stringify(livePassives)}`)
    expect(livePassives).not.toContain('passive_kim_dan_chi_quang')
  })
})

// ---------------------------------------------------------- E: auto-farm cycle flood
describe('TC8-E auto-farm perfectClearSeconds magnitude', () => {
  function farmHarness() {
    const rolls: string[] = []
    const stage = { id: 'forged_stage' } as never
    const ops = new GameManagerAutoFarmOps({
      stageManager: {
        acquire: vi.fn(() => ({ stageId: 'forged_stage' })),
        release: vi.fn(),
        owns: vi.fn(() => false),
      } as never,
      stageTemplates: { get: vi.fn(() => stage), has: vi.fn(() => true) } as never,
      battleLoot: {
        beginBattle: vi.fn(),
        setChannel: vi.fn(),
        setSession: vi.fn(),
        processDefeatedEnemies: vi.fn(() => rolls.push('roll')),
        settleTechniqueMastery: vi.fn(),
      } as never,
      stageWaves: { pickEnemyForTurnSpawn: vi.fn(() => undefined) } as never,
      enemySystem: { spawn: vi.fn() } as never,
      buildPlayerRewardReceiver: vi.fn(() => ({} as never)),
      eventBus: { emit: vi.fn() } as never,
    })
    return { ops, rolls }
  }

  it('E1: cycleSeconds=0.001 mints 2000 reward cycles per offline second', () => {
    const { ops, rolls } = farmHarness()
    const player = committedPlayer('qi_refining')
    player.autoFarmStage = { stageId: 'forged_stage', lastCheckedMs: Date.now() }
    player.perfectClearStageIds = ['forged_stage']
    player.perfectClearSeconds = { forged_stage: 0.001 }
    ops.settleAutoFarmOffline(player, 1)
    console.log(`[E1] reward rolls minted in 1s offline at cycleSeconds=0.001: ${rolls.length}`)
    // A legit perfect clear is >= seconds per run -> at most ~1 cycle/sec.
    expect(rolls.length).toBeLessThan(10)
  })

  it('E2: forged autoFarmStage without perfectClear drops at reconcile (honest)', () => {
    const { ops } = farmHarness()
    const player = committedPlayer('qi_refining')
    player.autoFarmStage = { stageId: 'never_cleared', lastCheckedMs: Date.now() }
    player.perfectClearStageIds = []
    ops.reconcileAutoFarmRuntime(player)
    expect(player.autoFarmStage).toBeNull()
  })
})

// ---------------------------------------------------------- F: timed-effect deadline unbounded
describe('TC8-F persistentTimedEffects expiry magnitude', () => {
  it('F1: tu_linh_tran expiresAtMs=1e15 (writer caps at 24h) -> permanent buff', () => {
    const player = committedPlayer('qi_refining')
    const save = buildSave(player)
    save.player.persistentTimedEffects = [
      {
        id: 'forge_tlt',
        sourceItemId: 'tu_linh_tran',
        effectGroup: 'tu_linh_tran',
        appliedAtMs: Date.now(),
        expiresAtMs: 1e15,
        cultivationSpeedPercent: 0.25,
        modifiers: [],
      },
    ]

    const { shape } = classify(save)
    const { playerStore, result } = boot(save)
    console.log(`[F1] shape.ok=${shape.ok} restore=${result.status}`)
    if (result.status !== 'ok') return
    const live = getActiveCultivationSpeedPercent(playerStore.$state.persistentTimedEffects, Date.now())
    const farFuture = getActiveCultivationSpeedPercent(playerStore.$state.persistentTimedEffects, Date.now() + TU_LINH_TRAN_DURATION_MS + 1)
    console.log(`[F1] live speed% now=${live} after authored 24h window=${farFuture}`)
    expect(farFuture).toBe(0)
  })
})

// ---------------------------------------------------------- G: forged committedOutcome
describe('TC8-G tribulation committedOutcome claim', () => {
  it('G1: qi_refining->foundation victory claim settles without the battle', () => {
    const player = committedPlayer('qi_refining', {
      realmLevel: CORE_REALM_LEVEL,
      completedStageIds: [QI_REFINING_BREAKTHROUGH_STAGE_ID],
      selectedTalentIds: ['loi_kiep'],
      talentLevels: { loi_kiep: 1 },
    })
    const save = buildSave(player)
    save.player.grantedRealmPassiveIds = ['qi_refining']
    save.player.modifiers = NHAP_DAO_MODS(0.18)
    save.tribulation = {
      committedOutcome: {
        attemptId: 1,
        outcome: 'victory',
        targetRealmId: 'foundation_establishment',
        grade: 'earth',
        breakthroughType: 'normal',
        receipt: null,
        settlementError: false,
      },
    }

    const { shape } = classify(save)
    const { playerStore, manager, result } = boot(save)
    console.log(`[G1] shape.ok=${shape.ok} restore=${result.status}`)
    if (result.status !== 'ok') return
    const outcome = new TribulationOutcomeService().settleOutcome(
      playerStore as never,
      manager as never,
      manager.tribulationDirector,
    )
    console.log(`[G1] settle=${JSON.stringify(outcome?.kind)} realm=${playerStore.$state.realmId} entitlement=${JSON.stringify(playerStore.$state.pendingTalentEntitlement?.realmId ?? null)} loiKiepMods=${playerStore.$state.modifiers.filter((m) => m.sourceId === 'loi_kiep').length}`)
    // Honest outcome: a save claiming a victory never fought must not settle.
    expect(outcome?.kind).not.toBe('victory')
    expect(playerStore.$state.realmId).toBe('qi_refining')
  })
})

// ---------------------------------------------------------- H: realm claim beyond beta scope
describe('TC8-H dormant realm claim', () => {
  it('H1: golden_core committed save validates and loads (no beta-realm bound)', () => {
    const player = committedPlayer('golden_core' as RealmId)
    const save = buildSave(player)
    const { shape, acceptable } = classify(save)
    const { result } = boot(save)
    console.log(`[H1] golden_core shape.ok=${shape.ok} acceptable=${acceptable} restore=${result.status}`)
    // The beta slice ends at foundation_establishment - no current-version
    // writer can produce golden_core. Honest bound: reject or flag.
    expect(shape.ok).toBe(false)
  })
})

// ---------------------------------------------------------- I: equipment affix list unbounded
describe('TC8-I equipment instance claims', () => {
  it('I1: >GLOBAL_MAX_AFFIXES (8) affix lines + slot-ineligible affix on a weapon', () => {
    const player = committedPlayer('qi_refining')
    const save = buildSave(player)
    const affix = affixes.find((a) => a.id === 'prefix_ward')!
    const tierMax = affix.tiers[affix.tiers.length - 1]!
    save.equipment = [
      {
        instanceId: 'i1',
        itemId: 'base_kiem',
        slot: 'weapon',
        equipped: true,
        grade: 'cuu_pham',
        quality: 'tien',
        mainStat: {
          id: 'i1:might',
          sourceId: 'i1',
          sourceType: 'equipment',
          stat: 'might',
          flat: 20,
        },
        // prefix_ward is authored for helmet/necklace ONLY - and 9 lines
        // exceed the authored GLOBAL_MAX_AFFIXES=8 roll bound.
        affixes: Array.from({ length: 9 }, (_, i) => ({
          affixId: i === 0 ? 'prefix_ward' : 'prefix_max_hp',
          tier: tierMax.tier,
          value: tierMax.max,
        })),
        forgeUsesTotal: 0,
        forgeUsesRemaining: 0,
      },
    ] as never
    save.equipmentSlots = [{ slot: 'weapon', enhanceLevel: 0 }] as never

    const { shape, acceptable } = classify(save)
    const { playerStore, manager, result } = boot(save)
    console.log(`[I1] shape.ok=${shape.ok} acceptable=${acceptable} restore=${result.status}`)
    if (result.status !== 'ok') return
    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    const cleanStats = makeManager().resolveAmbientPlayerStats(committedPlayer('qi_refining'))
    console.log(`[I1] wardMax forged=${stats.wardMax} (clean=${cleanStats.wardMax}) maxHp forged=${stats.maxHp} clean=${cleanStats.maxHp}`)
    expect(stats.wardMax).toBe(cleanStats.wardMax)
    expect(stats.maxHp).toBeLessThan(cleanStats.maxHp + 70 * 8)
  })
})

// ---------------------------------------------------------- J: quest progress forge -> reward
describe('TC8-J quest progress claim', () => {
  it('J1: forged kill-quest progress pays the reward on claim', () => {
    const player = mortalPlayer()
    const save = buildSave(player, {
      quests: {
        active: [{ questId: 'kill_wild_wolf_10', progress: 10, claimed: false }],
        completedOnceIds: [],
        lastDailyResetAtMs: 0,
      },
    }, true)

    const { shape } = classify(save)
    const { manager, result } = boot(save)
    console.log(`[J1] shape.ok=${shape.ok} restore=${result.status}`)
    if (result.status !== 'ok') return
    const questSystem = manager.questSystem
    const bags = {
      materialBag: manager.materialBag,
      materialRegistry: manager.materialRegistry,
      pillBag: manager.pillBag,
      pillRegistry: manager.pillRegistry,
      notifications: [],
      playerRealmId: 'mortal',
    } as never
    const canClaim = questSystem.canClaim(manager.questRegistry, manager.questManager, bags, 'kill_wild_wolf_10')
    console.log(`[J1] forged progress claimable=${canClaim}`)
    expect(canClaim).toBe(false)
  })
})

// ---------------------------------------------------------- K: shape boundary cases
describe('TC8-K shape boundary cases', () => {
  function probe(name: string, mutate: (save: GameSave) => void, expectReject: boolean) {
    it(name, () => {
      const save = buildSave(committedPlayer('qi_refining'))
      save.player.grantedRealmPassiveIds = ['qi_refining']
      save.player.modifiers = NHAP_DAO_MODS(0.18)
      mutate(save)
      const { shape, acceptable } = classify(save)
      console.log(`[K] ${name}: shape.ok=${shape.ok} acceptable=${acceptable}`)
      if (expectReject) expect(shape.ok === false || acceptable === false).toBe(true)
    })
  }

  probe('negative attributePoints', (s) => { s.player.attributePoints = -5 }, true)
  probe('attributePoints as string', (s) => { (s.player as never).attributePoints = 'ten' }, true)
  probe('realmId unknown string', (s) => { (s.player as never).realmId = 'not_a_realm' }, true)
  probe('realmLevel negative', (s) => { s.player.realmLevel = -3 }, true)
  probe('attributePoints array', (s) => { (s.player as never).attributePoints = [1, 2] }, true)
  probe('modifiers null', (s) => { (s.player as never).modifiers = null }, true)
  probe('modifier percent negative', (s) => {
    s.player.modifiers = [{ id: 'realm-passive:nhap_dao:maxHp', sourceId: 'nhap_dao', sourceType: 'realm', stat: 'maxHp', percent: -0.5 }]
  }, true)
  probe('equipment affix value negative', (s) => {
    s.equipment = [{ instanceId: 'i1', itemId: 'base_kiem', slot: 'weapon', equipped: true, grade: 'cuu_pham', quality: 'hoang', mainStat: { id: 'i1:might', sourceId: 'i1', sourceType: 'equipment', stat: 'might', flat: 12 }, affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: -99 }], forgeUsesTotal: 0, forgeUsesRemaining: 0 }] as never
  }, true)
  probe('material quantity huge', (s) => { s.materials = [{ itemId: 'linh_thach', amount: 1e18 }] }, true)
  probe('unknown material id', (s) => { s.materials = [{ itemId: 'fake_ore', amount: 5 }] }, true)
  probe('quest progress beyond amount', (s) => {
    s.quests = { active: [{ questId: 'kill_wild_wolf_10', progress: 99999, claimed: false }], completedOnceIds: [], lastDailyResetAtMs: 0 }
  }, true)
  probe('talent id unknown', (s) => { s.player.selectedTalentIds = ['fake_talent_x'] }, true)
  probe('timers lastSavedAt NaN', (s) => { s.player.lastSavedAt = NaN }, true)
  probe('extra unknown top-level key tolerated?', (s) => { (s as never).unknownSlice = { forged: true } }, false)
  probe('attributePoints=999 on level-1 (bound: cultivation tier)', (s) => { s.player.attributePoints = 999 }, true)
  probe('kien_co modifier payload WITHOUT grant marker (mixed state)', (s) => {
    s.player.grantedRealmPassiveIds = ['qi_refining']
    s.player.modifiers = KIEN_CO_MODS(0.1)
    s.player.highestFoundationAchieved = 'heaven'
  }, true)
  probe('marker WITHOUT payload modifiers (mixed state, coherent?)', (s) => {
    s.player.grantedRealmPassiveIds = ['qi_refining', 'foundation_establishment']
    s.player.modifiers = NHAP_DAO_MODS(0.18)
    s.player.highestFoundationAchieved = 'heaven'
  }, true)
})

// ---------------------------------------------------------- controls (honest boundary)
describe('TC8-Z controls', () => {
  it('Z1: version mismatch hard-rejects', () => {
    const save = buildSave(committedPlayer('qi_refining'))
    ;(save as { version: unknown }).version = CURRENT_SAVE_VERSION - 1
    const { shape } = classify(save)
    expect(shape.ok).toBe(false)
  })

  it('Z2: forged meridian claim (bat-mach id) is stripped at restore', () => {
    const player = committedPlayer('qi_refining')
    const save = buildSave(player)
    save.player.grantedRealmPassiveIds = ['qi_refining']
    save.player.modifiers = [
      ...NHAP_DAO_MODS(0.18),
      {
        id: 'bat-mach:nham_mach:maxHp',
        sourceId: 'nham_mach',
        sourceType: 'realm',
        stat: 'maxHp',
        percent: 0.05,
      },
    ]
    const { playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(playerStore.$state.modifiers.find((m) => m.id === 'bat-mach:nham_mach:maxHp')).toBeUndefined()
  })

  it('Z3: mortal save missing linh_bao pick is rejected (boundary honest)', () => {
    const player = mortalPlayer()
    const save = buildSave(player, {}, false) // no mortal pick, no path
    const { shape, acceptable } = classify(save)
    console.log(`[Z3] mortal w/o pick: shape.ok=${shape.ok} acceptable=${acceptable}`)
    expect(shape.ok === false || acceptable === false).toBe(true)
  })
})
