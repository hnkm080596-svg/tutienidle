// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 - same seam as the r20-r29 probes: exercise the
// enabled implementation paths, not the dormant scope-hidden shells.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { defineEnemy } from '../../core/enemy/Enemy'
import type { Stage } from '../../core/stage/Stage'
import { asBaseStats } from '../../core/stats/StatBlock'
import { SKILLS } from '../../data/skill/Skills'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { SPIRIT_STONE_MATERIAL } from '../../core/material/SpiritStoneMaterial'
import { OnlineSessionController } from '../session/OnlineSessionController'
import { useSaveIssueStore } from '../../stores/saveIssue'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { buildGameSave } from './SaveSystem'
import { primeMortalCreationPick } from './GameSave.fixture'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { EquipmentBag, EQUIPMENT_PROTECTION_CAP } from '../../core/equipment/EquipmentBag'
import { makeInstance as makeEquipmentInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { ProductionSystem } from '../../core/production/ProductionSystem'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from '../../core/production/ProductionCatalog'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import type {
  ProductionCycle,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'

// ============================================================================
// QA probe - fixpoint r30 INT wave. Audits the r29 adjudication batch at
// 33ade943 for INTEGRATION COHERENCE between the corrected layers:
//
//   (F) combat channel vs the entryStage sim-freeze: r29 froze the tick
//       loop on entryStage === 'game' so a mounted refuse card parks the
//       world sim under LOCAL authority too. Turn battles do NOT run on
//       that tick - they advance on the dedicated CombatClock
//       (RafClockSource in browser / MainProcessClockSource in Electron,
//       wired App.vue:199-201) and the only freezeCombat callers are
//       pauseSimulation('authority-pause'), useCombatPause('tab-hidden')
//       and CombatTopBar('user-pause'). The App.vue coded-refuse arm calls
//       none of them. Under REMOTE authority observeSaveResult ->
//       enterTerminal -> deps.onPause('terminal') -> pauseSimulation ->
//       freezeCombat does fire (called before bootFlow.fail(), while
//       entryStage is still 'game'); under LOCAL authority observeSaveResult
//       early-returns (no reconnect dep) and no freeze signal exists at
//       all. An in-flight auto battle keeps resolving behind the mounted
//       SaveIncompatibleScreen on the local tier.
//   (R) negative-magnitude lastSavedAt: isBoundedTimestamp admits |x| <
//       2**52, so a crafted -1e15 marker validates. Every derivation then
//       collapses to the deep-past epoch - equivalent to the already-
//       admitted crafted-PAST class, strictly weaker (pair-pins like
//       tribulation.cooldownUntil <= lastSavedAt + span collapse to
//       unadmittable). Documented rejection, probed anyway.
//   (C) cap parity: requireArray/optionalArray [] returns + nodeLevels
//       gate + EQUIPMENT_PROTECTION_CAP (live sole-writer vs save gate
//       counting locked === true || favorite === true over equipment only;
//       slots carry no protection flags - no double count).
//   (D) persistPlayer arm contract: report('corrupted', ..., 'local') is
//       the exact write the refuse arm performs; the sibling ok-arm clear
//       and remote-tier recovery coverage stay with r28/r29 pins.
//   (E) verbatim-restore parity: under the only real restore driver
//       (restoreClockMs = min(lastSavedAt, Date.now()), always finite and
//       |x| < 2**52 < 2**53) the clockOk shift arm engages; the bad-clock
//       verbatim arm is a dead guard for real callers and keeps the deny
//       direction consistent.
// ============================================================================

let currentMs = 1_725_160_000_000

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

function validWireSave(): GameSave {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  return {
    cycleId: `r30i_cycle_${siteId}_${startedAtMs}`,
    siteId,
    collectionRealmId: REALM,
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs,
    completesAtMs,
  }
}

function makeState(siteId: string, cycles: ProductionCycle[]): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 0,
    workerCycles: cycles,
  }
}

function createProductionSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })
}

function controller(
  remote: boolean,
  deps: { onPause?: (reason: string) => void } = {},
): OnlineSessionController {
  return new OnlineSessionController({
    monotonicNow: () => 0,
    scheduleInterval: () => 0,
    clearHandle: () => undefined,
    reconnect: remote ? () => new Promise(() => {}) : undefined,
    onPause: deps.onPause,
  })
}

const refuse = {
  status: 'unavailable' as const,
  code: 'SAVE_INVALID' as const,
  retryable: false,
  message: 'x',
}

/** A live auto battle on the manual combat clock (enemyClear.test.ts pattern). */
function combatArena() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials([SPIRIT_STONE_MATERIAL])
  const enemy = defineEnemy({
    id: 'r30i_dummy',
    name: 'R30 Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 1 },
  })
  const stage: Stage = {
    id: 'r30i_stage',
    name: 'R30 Stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: enemy.id, weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 100 })

  gameManager.catalogOps.registerEnemyTemplates([enemy])
  gameManager.catalogOps.registerStages([stage])
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  expect(gameManager.progressionOps.learnSkill('linh_bao', player)).toBe(true)
  expect(gameManager.progressionOps.setMortalBasicSkill(player, 'linh_bao')).toBe(true)

  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  return { gameManager, player, stage, combatSource }
}

function advanceUntilVictory(
  gameManager: GameManager,
  combatSource: ManualClockSource,
  maxSteps = 400,
): boolean {
  for (let i = 0; i < maxSteps; i += 1) {
    combatSource.advance(COMBAT_STEP_SECONDS)
    if (gameManager.getTurnBattle()?.state === 'victory') {
      return true
    }
  }
  return false
}

// ----------------------------------------------------------------------------
// (F) combat channel vs the refuse-mount freeze: the battle resolves on the
// combat clock with zero freeze input - the error surface cannot reach it.
// ----------------------------------------------------------------------------

describe('auditR30 INT probe - combat channel vs refuse-mount freeze (F)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('F1 a live auto battle resolves on the combat clock with no freeze signal - the local refuse arm invokes none (r30-INT-1)', () => {
    const { gameManager, player, stage, combatSource } = combatArena()

    expect(gameManager.turnBattleOps.startStage(player, stage)).toBe(true)
    expect(['intro', 'fighting']).toContain(gameManager.getTurnBattle()?.state)

    // The refuse arm (App.vue:578-608) performs report() + bootFlow.fail()
    // and nothing else at the domain level - observed domain-side, combat
    // sees no freeze reason at all (the entryStage gate only stops the
    // tick interval from calling onTick; the combat clock never consults
    // entryStage).
    expect(gameManager.getFreezeReasons()).toEqual([])

    // The full turn pipeline - gauge fill, claim, awaitStep fallback
    // driving mechanics without any renderer - completes on clock
    // steps alone: the battle resolves to victory while the mounted
    // error card sits over it.
    expect(advanceUntilVictory(gameManager, combatSource)).toBe(true)
    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(gameManager.getFreezeReasons()).toEqual([])
  })

  it('F2 control: freezeCombat(authority-pause) does hold the same battle - the freeze primitive exists, the local refuse path just never engages it', () => {
    const { gameManager, player, stage, combatSource } = combatArena()

    expect(gameManager.turnBattleOps.startStage(player, stage)).toBe(true)
    gameManager.freezeCombat('authority-pause')
    expect(gameManager.getFreezeReasons()).toContain('authority-pause')

    for (let i = 0; i < 200; i += 1) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    // Frozen: the battle still exists and never reaches resolution.
    expect(gameManager.getTurnBattle()?.state).not.toBe('victory')
    expect(gameManager.getTurnBattle()?.state).not.toBe('defeat')

    gameManager.resumeCombat('authority-pause')
    expect(advanceUntilVictory(gameManager, combatSource)).toBe(true)
  })

  it('F3 asymmetry pin: remote refuse cascades onPause(terminal) - which reaches freezeCombat via pauseSimulation - while local observeSaveResult early-returns', () => {
    const remotePause = vi.fn()
    const remote = controller(true, { onPause: remotePause })
    remote.beginChecking()
    remote.markReady()
    remote.observeSaveResult(refuse as never)
    expect(remote.authorityState).toBe('recovery')
    // enterTerminal -> deps.onPause('terminal') -> pauseSimulation ->
    // freezeCombat('authority-pause'): the combat freeze chain exists
    // only on the remote tier.
    expect(remotePause).toHaveBeenCalledWith('terminal')

    const localPause = vi.fn()
    const local = controller(false, { onPause: localPause })
    local.beginChecking()
    local.markReady()
    local.observeSaveResult(refuse as never)
    expect(local.authorityState).toBe('ready')
    expect(localPause).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// (R) negative-magnitude lastSavedAt: admitted (isBoundedTimestamp is
// sign-agnostic), but every derivation collapses into the deep-past class -
// the same mint the crafted-past anchor already gets, never more.
// ----------------------------------------------------------------------------

describe('auditR30 INT probe - negative-anchor marker equivalence (R)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('R1 lastSavedAt = -1e15 validates; deep-past lanes restore verbatim and mint on the next tick - identical to the admitted crafted-past class (rejected as a new finding)', () => {
    const wire = validWireSave()
    const anchor = -1_000_000_000_000_000 // |x| = 1e15 < 2**52 - admitted
    wire.player.lastSavedAt = anchor

    // The negative marker itself validates - isBoundedTimestamp is
    // sign-agnostic. (A crafted save cannot also carry worker lanes at
    // mortal tier - autoWorkerCapacity 0 gives a 0-lane ceiling - so the
    // anchor's only live effect is the deep-past epoch at restore.)
    const result = validateGameSaveShape(wire)
    expect(result.ok).toBe(true)

    // Under the real restore driver restoreClockMs = min(lastSavedAt,
    // Date.now()) = anchor: a lane pinned <= anchor is below the restore
    // clock, so the shift arm is skipped and the pair is restored
    // verbatim - the deny-safe direction for a began-past lane.
    const system = createProductionSystem()
    system.restoreStates(
      [makeState(LAM, [makeCycle(LAM, anchor - CYCLE_MS, anchor)])],
      anchor,
    )
    const restored = system.getState(LAM)!.workerCycles!
    expect(restored).toHaveLength(1)
    expect(restored[0].startedAtMs).toBe(anchor - CYCLE_MS)
    expect(restored[0].completesAtMs).toBe(anchor)

    // Crafted-past control (anchor = 1_000_000): identical verbatim
    // restore, identical mint surface - the negative anchor buys nothing
    // the admitted past anchor does not already buy.
    const control = createProductionSystem()
    control.restoreStates(
      [makeState(LAM, [makeCycle(LAM, 1_000_000 - CYCLE_MS, 1_000_000)])],
      1_000_000,
    )
    expect(control.getState(LAM)!.workerCycles![0].startedAtMs).toBe(1_000_000 - CYCLE_MS)
  })

  it('R2 a negative anchor can never carry a tribulation cooldown - cooldownUntil <= lastSavedAt + 300s collapses (leg is strictly weaker than crafted-past)', () => {
    const wire = validWireSave()
    const anchor = -1_000_000_000_000_000
    wire.player.lastSavedAt = anchor
    wire.tribulation = { cooldownUntil: 1 } as never

    const result = validateGameSaveShape(wire)
    expect(result.ok).toBe(false)
    const paths = result.issues.map((i) => i.path)
    expect(paths).toContain('.tribulation.cooldownUntil')
  })
})

// ----------------------------------------------------------------------------
// (C) cap parity: over-cap collections pay the cap issue and nothing else;
// the protection cap counts identical unions on the live and wire sides.
// ----------------------------------------------------------------------------

describe('auditR30 INT probe - cap parity (C)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('C1 over-cap alchemyJobs returns [] at the binding - the cap issue lands and every downstream check (element walk, maxJobs) sees zero elements (r29-INT-4 sibling parity)', () => {
    const wire = validWireSave()
    wire.alchemyJobs = Array.from({ length: 1025 }, (_, i) => ({ jobId: `j${i}` })) as never

    const result = validateGameSaveShape(wire)
    expect(result.ok).toBe(false)
    // Top-level collections surface with the leading-dot path
    // convention ('.alchemyJobs'); the refused binding returns [] so no
    // element-level 'alchemyJobs[i]' issue can exist.
    const alchemyIssues = result.issues.filter((i) => i.path.startsWith('.alchemyJobs') || i.path.startsWith('alchemyJobs'))
    expect(alchemyIssues).toHaveLength(1)
    expect(alchemyIssues[0].path).toBe('.alchemyJobs')
    expect(result.issues.filter((i) => i.path.includes('alchemyJobs[')).length).toBe(0)
  })

  it('C2 an 11th protected equipment entry refuses at the save gate - EQUIPMENT_PROTECTION_CAP parity with setProtected (ruling D-02)', () => {
    const wire = validWireSave()
    wire.equipment = Array.from({ length: EQUIPMENT_PROTECTION_CAP + 1 }, (_, i) =>
      makeEquipmentInstance({ instanceId: `eq_${i}`, locked: true }),
    ) as never

    const result = validateGameSaveShape(wire)
    expect(result.ok).toBe(false)
    const capIssues = result.issues.filter(
      (i) => i.path === 'equipment' && i.message.includes('EQUIPMENT_PROTECTION_CAP'),
    )
    expect(capIssues).toHaveLength(1)
  })

  it('C3 live-side union parity: protectedCount and the gate count the same locked-or-favorite union - cap holds at 10, the 11th refuses, flags on an already-protected item stay free', () => {
    const bag = new EquipmentBag()
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP + 1; i += 1) {
      bag.add(makeEquipmentInstance({ instanceId: `item_${i}` }))
    }

    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP; i += 1) {
      expect(bag.setProtected(`item_${i}`, 'locked', true).ok).toBe(true)
    }
    expect(bag.setProtected('item_10', 'locked', true)).toEqual({
      ok: false,
      reason: 'protection_cap',
    })

    // Union semantics: adding 'favorite' to an already-locked instance
    // grows no pool - the write still refuses the NEXT distinct item.
    expect(bag.setProtected('item_0', 'favorite', true).ok).toBe(true)
    expect(bag.setProtected('item_10', 'favorite', true)).toEqual({
      ok: false,
      reason: 'protection_cap',
    })

    // Clearing ONE flag on a double-flagged item keeps it protected
    // (item_0 is still favorite) - the pool stays full.
    expect(bag.setProtected('item_0', 'locked', false).ok).toBe(true)
    expect(bag.setProtected('item_10', 'favorite', true)).toEqual({
      ok: false,
      reason: 'protection_cap',
    })

    // Un-protecting entirely frees the slot - the gate counts the same
    // union, so wire and live sides stay identical.
    expect(bag.setProtected('item_0', 'favorite', false).ok).toBe(true)
    expect(bag.setProtected('item_10', 'favorite', true).ok).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (D) refuse-arm write contract: the arm performs exactly this store write.
// ----------------------------------------------------------------------------

describe('auditR30 INT probe - refuse-arm store contract (D)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D1 the arm writes status corrupted + scope local; no caller-side consumers diverge on the early return', () => {
    const saveIssue = useSaveIssueStore()
    saveIssue.report('corrupted', '{"x":1}', undefined, 'local')

    expect(saveIssue.status).toBe('corrupted')
    expect(saveIssue.scope).toBe('local')
    expect(saveIssue.raw).toBe('{"x":1}')
  })
})

// ----------------------------------------------------------------------------
// (E) verbatim-restore parity under the real driver: restoreClockMs is
// always finite (min of two admitted-bounded stamps), so the clockOk shift
// arm is the only live path and the verbatim arm keeps the deny direction.
// ----------------------------------------------------------------------------

describe('auditR30 INT probe - verbatim restore parity (E)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('E1 restoreStates under a finite restore clock shifts a post-dated lane pair to the restore anchor (live path of every real caller)', () => {
    const system = createProductionSystem()
    const postDated = makeCycle(LAM, 2_000_000, 2_000_000 + CYCLE_MS)
    system.restoreStates([makeState(LAM, [postDated])], 1_000_000)

    const cycle = system.getState(LAM)!.workerCycles![0]
    expect(cycle.startedAtMs).toBe(1_000_000)
    expect(cycle.completesAtMs).toBe(1_000_000 + CYCLE_MS)
  })

  it('E2 restoreStates under a bad clock keeps the post-dated lane verbatim - parked, deny direction, consistent with every r29 verbatim arm', () => {
    const system = createProductionSystem()
    const postDated = makeCycle(LAM, 2_000_000, 2_000_000 + CYCLE_MS)
    system.restoreStates([makeState(LAM, [postDated])], Number.NaN)

    const cycle = system.getState(LAM)!.workerCycles![0]
    expect(cycle.startedAtMs).toBe(2_000_000)
    expect(cycle.completesAtMs).toBe(2_000_000 + CYCLE_MS)
  })
})
