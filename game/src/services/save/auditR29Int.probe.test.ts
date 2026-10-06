// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 - the r29 INT probes exercise the scope-hidden
// decompose channel's ENABLED implementation (sec.11-15: dormant, not
// deleted) so the settle-guard parity can be measured on the engine,
// not on the feature flag.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import {
  AlchemySystem,
  alchemySecondsFor,
  verifyAlchemyJobReservation,
} from '../../core/alchemy/AlchemySystem'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import type { Material } from '../../core/material/Material'
import { PillBag } from '../../core/pill/PillBag'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { materials } from '../../data/materials/materials'
import { LUYEN_KHI_TINH_HOA_ID } from '../../core/equipment/TinhHoaMaterial'
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

// ============================================================================
// QA probe - fixpoint r29 INT wave. Audits the r26 + r27 + r28 batches at
// faa893c1 for INTEGRATION COHERENCE between the corrected layers:
//
//   (P) tick/settle guard parity: r28-AUT-2 added the
//       !Number.isFinite(nowMs) || |nowMs| >= 2**53 zero-advance to
//       AlchemySystem.tick claiming guard parity with advanceWorkerLanes.
//       The sibling decompose channels (tick + settleOffline) are fed by
//       the SAME drivers (GameManagerTickOps:264 Date.now(),
//       GameManagerSaveRestore:497 settleNowMs) and have NO equivalent
//       guard - same hostile clock, opposite verdicts.
//   (O) origination gap: the guard hardens the SETTLE seam but
//       AlchemySystem.startJob has no nowMs bound - a NaN/huge clock at
//       mint time bakes a deadline the tick guard never sees (the tick
//       compares against the stored completesAtMs, not the fed nowMs).
//   (T) refuse-arm tier parity: the App.vue coded-refuse arm now mounts
//       the error surface via bootFlow.fail() + saveIssue.report. Under
//       remote authority observeSaveResult parks the sim ('recovery'
//       terminal -> canMutate false -> tick loop idles). Under local
//       authority the same refuse leaves the tick loop advancing the
//       world behind the mounted SaveIncompatibleScreen.
//   (C) cap-guard parity: r28 gated the two downstream talentLevels
//       walks; sibling walks on nodeLevels (:3158/:3225/:3253) and every
//       requireArray/optionalArray element validator still iterate an
//       over-cap collection after the refuse already lands.
//   (R) report/fail + clear() contract: the fixed arm pairs report with
//       the mount gate; clear() on the ok arm is unreachable under a
//       remote refuse (terminal 'recovery' gates persistProgress before
//       any ok write can sweep) - coverage documented, harmless.
// ============================================================================

let currentMs = 1_725_160_000_000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

/** A real writer-produced save in wire form (validateGameSaveShape-clean). */
function validWireSave(): GameSave {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

function mortalRecipe() {
  return alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
}

function mortalJob(startedAtMs: number, jobId: string) {
  const recipe = mortalRecipe()
  const variant = recipe.herbVariants[0]!
  const span = alchemySecondsFor(recipe, 1) * 1000
  const job = alchemyJobFixture(
    {
      jobId,
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: variant.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + span,
      roomLevelAtStart: 1,
    },
    undefined,
    recipe,
  )
  return { job, recipe, span }
}

function material(id: string): Material {
  return { id, name: id, category: 'other', sourceType: 'monster' }
}

/** A MaterialBag stocked for one tu_linh_dan mortal job (herb x2 + wood x2). */
function stockedBag() {
  const bag = new MaterialBag()
  const registry = new MaterialRegistry()
  const recipe = mortalRecipe()
  const herbId = recipe.herbVariants[0]!.materialId
  const woodId = 'mortal_wood_decade'
  registry.register(material(herbId))
  registry.register(material(woodId))
  bag.add(registry.get(herbId), recipe.herbAmount)
  bag.add(registry.get(woodId), recipe.fuelWoodAmount)
  return { bag, registry, herbId, recipe }
}

function controller(remote: boolean): OnlineSessionController {
  return new OnlineSessionController({
    monotonicNow: () => 0,
    scheduleInterval: () => 0,
    clearHandle: () => undefined,
    reconnect: remote ? () => new Promise(() => {}) : undefined,
  })
}

const refuse = {
  status: 'unavailable' as const,
  code: 'SAVE_INVALID' as const,
  retryable: false,
  message: 'x',
}

// ----------------------------------------------------------------------------
// (P) nowMs guard parity: alchemy channels zero-advance, decompose channels
// mint/park on the same hostile clock.
// ----------------------------------------------------------------------------

describe('auditR29 INT probe - tick/settle nowMs guard parity (P)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('P1 alchemy tick zero-advances on non-finite/overflow clocks - jobs preserved', () => {
    const { job } = mortalJob(currentMs - 60_000, 'r29i_p1')
    const system = new AlchemySystem()
    system.restoreJobs([job as never], currentMs - 120_000)
    const bag = new PillBag()

    for (const hostile of [Number.NaN, 2 ** 53, -(2 ** 53), Number.POSITIVE_INFINITY]) {
      system.tick(hostile, bag, () => ({ id: job.pillId }), () => 0)
    }

    // The due job is PRESERVED, not minted - deny direction.
    expect(system.getJobs()).toHaveLength(1)
    expect(system.drainSettlementEvents()).toEqual([])
    expect(bag.getAmount(job.pillId)).toBe(0)
  })

  it('P2 alchemy settleOffline inherits the same guard (delegates to tick)', () => {
    const { job } = mortalJob(currentMs - 60_000, 'r29i_p2')
    const system = new AlchemySystem()
    system.restoreJobs([job as never], currentMs - 120_000)
    const bag = new PillBag()

    expect(system.settleOffline(bag, () => ({ id: job.pillId }), Number.NaN)).toBe(0)
    expect(system.settleOffline(bag, () => ({ id: job.pillId }), 2 ** 53)).toBe(0)
    expect(system.getJobs()).toHaveLength(1)

    // Control: an honest clock settles a DUE job exactly once.
    const fresh = new AlchemySystem()
    const { job: j2 } = mortalJob(currentMs - 700_000, 'r29i_p2b')
    fresh.restoreJobs([j2 as never], currentMs - 720_000)
    expect(fresh.settleOffline(bag, () => ({ id: j2.pillId }), currentMs)).toBe(1)
  })

  it('P3 decompose channels lack the guard - same hostile clock mints/ poisons (r29-INT-1)', () => {
    const bag = new MaterialBag()
    const ore = materials.find((m) => m.id === 'mortal_ore_decade')!
    bag.add(ore, 100_000)
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(1)
    system.setSetting({ workers: 1 })
    system.tick(1_000) // arms: first deadline at 31_000

    // settleOffline(1e300) - the SAME input the alchemy channel
    // zero-advances - runs the bounded loop to its 5000-cycle ceiling.
    const settled = system.settleOffline(1e300, 1_000)
    expect(settled).toBe(5000)
    expect(system.drainOutput().reduce((s, e) => s + e.amount, 0)).toBeGreaterThan(0)

    // tick(NaN) mints once AND poisons nextCycleAt - every later finite
    // tick mints again (NaN < x is false -> settle arm, rebase to NaN).
    const bag2 = new MaterialBag()
    bag2.add(ore, 100_000)
    const live = new DecomposeSystem(bag2, { cycleSeconds: 30 })
    live.updateCapacity(1)
    live.setSetting({ workers: 1 })
    live.tick(1_000)

    live.tick(Number.NaN)
    expect(Number.isFinite(live.getSaveState().nextCycleAt)).toBe(false)
    live.tick(60_000)
    live.tick(90_000)
    // Two finite ticks minted two more cycles - the timer stayed poisoned.
    const drained = live.drainOutput()
    expect(drained.some((e) => e.materialId === LUYEN_KHI_TINH_HOA_ID)).toBe(true)
    expect(drained.length).toBeGreaterThanOrEqual(2)
  })
})

// ----------------------------------------------------------------------------
// (O) origination gap: startJob has no nowMs bound - the settle guard only
// sees the deadline the caller already baked.
// ----------------------------------------------------------------------------

describe('auditR29 INT probe - startJob origination gap (O)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('O1 startJob(NaN) mints a NaN-deadline job the guard never sees - next finite tick pays the pill (r29-INT-2)', () => {
    const { bag, registry, herbId, recipe } = stockedBag()
    const system = new AlchemySystem()
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))

    const started = system.startJob(
      recipe,
      herbId,
      bag,
      registry,
      1_000_000, // spirit stone on hand
      1, // room level
      Number.NaN, // nowMs - unbounded at origination
      1, // slots
    )
    expect(started.ok).toBe(true)

    const minted = system.getJobs()[0]!
    expect(Number.isFinite(minted.completesAtMs)).toBe(false)

    // The witness is self-consistent over the NaN stamps (digest folds
    // 'NaN' identically on both sides) - grant-time verify cannot catch it.
    expect(verifyAlchemyJobReservation(minted, recipe)).toBeNull()

    // The tick guard inspects nowMs, not the stored deadline: a finite
    // tick treats NaN < completesAtMs as false -> settle arm -> pill lands.
    const pills = new PillBag()
    system.tick(1_000, pills, (id) => ({ id }), () => 0.1)
    expect(system.getJobs()).toHaveLength(0)
    expect(pills.getAmount(recipe.pillId)).toBe(1)
    expect(system.drainSettlementEvents()[0]?.success).toBe(true)
  })

  it('O2 boundary: startJob(1e300) mints a parked-forever job (deny direction, documented)', () => {
    const { bag, registry, herbId, recipe } = stockedBag()
    const system = new AlchemySystem()
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))

    const started = system.startJob(recipe, herbId, bag, registry, 1_000_000, 1, 1e300, 1)
    expect(started.ok).toBe(true)
    // 1e300 + span is absorbed below float precision - the deadline IS 1e300.
    expect(system.getJobs()[0]!.completesAtMs).toBe(1e300)

    const pills = new PillBag()
    system.tick(currentMs + 86_400_000, pills, (id) => ({ id }), () => 0.1)
    expect(system.getJobs()).toHaveLength(1) // parked - occupies the slot, never settles
    expect(pills.getAmount(recipe.pillId)).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// (T) refuse arm vs authority tier: remote freezes the sim, local keeps it
// advancing behind the mounted error surface.
// ----------------------------------------------------------------------------

describe('auditR29 INT probe - refuse arm authority-tier parity (T)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('T1 remote authority: coded refuse enters terminal recovery - canMutate false freezes the tick loop', () => {
    const remote = controller(true)
    remote.beginChecking()
    remote.markReady()
    expect(remote.canMutate()).toBe(true)

    remote.observeSaveResult(refuse as never)
    expect(remote.authorityState).toBe('recovery')
    expect(remote.canMutate()).toBe(false)
  })

  it('T2 local authority (no reconnect dep): the same coded refuse leaves authority ready - tick loop keeps advancing behind the mounted surface (r29-INT-3)', () => {
    const local = controller(false)
    local.beginChecking()
    local.markReady()
    expect(local.canMutate()).toBe(true)

    // observeSaveResult early-returns without a reconnect dep
    // (OnlineSessionController:287-291) - no admission transition, so
    // useAppLifecycle's tick loop gate (authority.canMutate, :238) never
    // flips while entryStage 'error' mounts SaveIncompatibleScreen.
    local.observeSaveResult(refuse as never)
    expect(local.authorityState).toBe('ready')
    expect(local.canMutate()).toBe(true)
  })

  it('T3 clear() on the ok arm is unreachable after a remote refuse - persistProgress is gated at canMutate (r29-INT-5 note)', () => {
    const saveIssue = useSaveIssueStore()
    saveIssue.report('corrupted', '{}', undefined, 'local')

    const remote = controller(true)
    remote.beginChecking()
    remote.markReady()
    remote.observeSaveResult(refuse as never)

    // Terminal 'recovery' -> canMutate false -> persistProgress early-
    // returns at useAppLifecycle:313 before any ok write can run
    // saveIssue.clear(). The armed card survives until reload re-inits
    // the store; the mount gate already owns the surface, so this is a
    // coverage note, not a live defect.
    expect(remote.canMutate()).toBe(false)
    expect(saveIssue.status).toBe('corrupted')
    saveIssue.clear()
    expect(saveIssue.status).toBeNull()
    expect(saveIssue.scope).toBe('remote')
  })
})

// ----------------------------------------------------------------------------
// (C) cap-guard parity: the refuse lands first, but sibling walks on
// nodeLevels / requireArray collections still pay the full iteration.
// ----------------------------------------------------------------------------

describe('auditR29 INT probe - cap guard parity vs sibling walks (C)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('C1 over-cap player.modifiers: refuse at the cap AND the element walk still validates index 1024 (r29-INT-4)', () => {
    const wire = validWireSave()
    const modifiers: unknown[] = Array.from({ length: 1024 }, (_, i) => ({
      id: `m${i}`,
      sourceId: 's',
      sourceType: 't',
      stat: 'hp',
    }))
    modifiers.push(42) // malformed element past the cap
    wire.player.modifiers = modifiers as never

    const result = validateGameSaveShape(wire)
    expect(result.ok).toBe(false)
    const paths = result.issues.map((i) => i.path)
    expect(paths).toContain('player.modifiers') // cap refuse
    // The sibling element walk paid the full post-refuse iteration.
    expect(paths).toContain('player.modifiers[1024]')
  })

  it('C2 over-cap player.nodeLevels: refuse at the cap AND the grant-source sibling walk still fires on a real node (r29-INT-4)', () => {
    const wire = validWireSave()
    const nodeLevels: Record<string, number> = { major_quan_the: 1 }
    for (let i = 0; i < 1024; i += 1) {
      nodeLevels[`pad_${i}`] = 1
    }
    wire.player.nodeLevels = nodeLevels as never

    const result = validateGameSaveShape(wire)
    expect(result.ok).toBe(false)
    const paths = result.issues.map((i) => i.path)
    expect(paths).toContain('player.nodeLevels') // cap refuse at :2026
    // major_quan_the grants core 'quan_the'; the :3225 sibling walk
    // pushed the missing-grant issue - proof it iterated the refused
    // record. No per-key root-walk issues exist (that walk is skipped).
    expect(paths).toContain('player.nodeLevels.major_quan_the')
    expect(paths.some((p) => p.startsWith('player.nodeLevels.pad_'))).toBe(false)
  })

  it('C3 parity census: over-cap player.talentLevels yields ONLY the cap issue - the r28-guarded walks skip (control)', () => {
    const wire = validWireSave()
    const talentLevels: Record<string, number> = {}
    for (let i = 0; i <= 1024; i += 1) {
      talentLevels[`fake_talent_${i}`] = 1
    }
    wire.player.talentLevels = talentLevels

    const result = validateGameSaveShape(wire)
    expect(result.ok).toBe(false)
    const paths = result.issues.map((i) => i.path)
    expect(paths).toContain('player.talentLevels')
    expect(paths.some((p) => p.startsWith('player.talentLevels.'))).toBe(false)
  })
})
