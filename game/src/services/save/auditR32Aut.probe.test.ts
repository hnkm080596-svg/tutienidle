// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { AlchemySystem, alchemySecondsFor } from '../../core/alchemy/AlchemySystem'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { ProductionSystem } from '../../core/production/ProductionSystem'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_PRODUCTION_SITES,
} from '../../core/production/ProductionCatalog'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { PillBag } from '../../core/pill/PillBag'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { settleProductionOffline } from '../../core/production/ProductionOffline'
import type { ProductionCycle, ProductionSiteState } from '../../core/production/ProductionTypes'
import { GameManagerPersistentEffectOps } from '../../core/game/GameManagerPersistentEffectOps'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'

// BETA SCOPE - only the decompose engine is force-visible for this suite
// (scope-hidden in beta); every other scope keeps real visibility. Same
// convention as auditR31Aut.probe.test.ts.
vi.mock('../../core/betaScope', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../core/betaScope')>()
  return {
    ...original,
    isScopeHidden: (feature: string) =>
      feature === 'equipmentOreDecompose' ? false : original.isScopeHidden(feature),
  }
})

// ============================================================================
// QA probe - fixpoint r32 AUT wave. Adversarial audit of the r31 batch at
// 1d27aee4: the [0, 2^52) non-negative persisted-clock domain on
// workerCycles + alchemyJobs, the mint-headroom guards
// (!(clock + max(0, span) < 2^52)), the restoreJobs drop-vs-park asymmetry,
// the bootGame simPaused=false re-baseline, and the TLT-shaped appliedAtMs
// push-arm clamp (min(2^52 - 1, Date.now())).
//
// FINDINGS:
//   F1 (Low) - restoreJobs drop-check mirrors the validator's BOUND pins
//     but not its ORDERING pin: an in-domain inverted pair
//     (completesAtMs <= startedAtMs, both in [0, 2^52)) is not dropped,
//     restores verbatim, and settles on the next honest tick (the
//     reservation fixture digest is self-consistent over the crafted
//     stamps, so the witness replays and the pill mints). The same pair
//     lands in persistentTimedEffects-style wedge territory: persisted,
//     the next buildGameSave write refuses on the ordering pin. Sibling
//     contrast: the identical inverted pair fed to advanceWorkerLanes is
//     denied (zero-advance), so the two engines diverge on the same
//     crafted input. Reachability: validator-bypassed payloads only
//     (the load gate refuses the pair first) - defense-in-depth parity
//     gap, Low per the r30/r31 reachability precedent.
//   F2 (Low) - both restore shift arms mint INVERTED pairs: the headroom
//     check `restoreNowMs + (completesAtMs - startedAtMs) < 2^52` is
//     trivially satisfied by a negative span, so a post-dated inverted
//     pair (startedAtMs > restoreNowMs, completesAtMs < startedAtMs)
//     shifts to {startedAtMs: restoreNow, completesAtMs: restoreNow +
//     (negative)} - an inverted minted pair. In alchemy it settles
//     instantly at the next tick (mint); in production it parks at the
//     ordering deny and wedges the next write. Same bypass reachability.
//   F3 (Nit) - DecomposeSystem.restore mergedDeadline is the only
//     surviving +span mint point without r31 headroom: mergedDeadline =
//     min(max(0, restoredDeadline), restoreNowMs + cycleMs) can exceed
//     2^52 when BOTH the payload deadline is out-of-domain (bypassed
//     payload) AND restoreNowMs sits within cycleMs of the bound (ungated
//     caller clock). Result: nextCycleAt >= 2^52 -> next write refuses.
//     Nit: two unreachables deep.
//   F4 (Nit) - ProductionOffline fieldEpochShiftMs re-stamps seeded lane
//     heads by `Date.now() - nowMs` with no headroom: a client clock
//     crafted ~2^52 ms ahead of the settle epoch (the min() clamps on
//     the clock INPUTS keep nowMs in-domain while the raw Date.now()
//     delta escapes) mints startedAtMs/completesAtMs >= 2^52 -> wedge.
//     Crafted-clock class only.
//   F5 (Nit) - applyTimedEffect push arm propagates NaN: a caller-crafted
//     effect.appliedAtMs of undefined/NaN makes Math.max(floor, NaN) = NaN
//     persist - the r31 clamp bounds the ceiling but not the NaN case -
//     and the validator's isBoundedTimestamp(NaN) refuses the next write.
//     Companion Nit: the stackable arm derives `duration` from the RAW
//     caller stamps (effect.expiresAtMs - effect.appliedAtMs), so a
//     +/-2^52 span pushes existing.expiresAtMs to the 2^52-1 ceiling
//     (near-permanent in-session buff; the restore seam re-clamps).
//     Ungated-caller inputs only.
//
// VERIFIED-HELD arms are asserted as controls: exact-boundary deny/admit
// on the nowMs headroom, the r31 out-of-domain drop, decompose tick
// headroom, startJob invalid_clock, and the TribulationDirector/Quest
// restore seams inspected statically (same min()-clamp shape).
// ============================================================================

const BOUND = 2 ** 52
let currentMs = 1_725_160_000_000

const JOB_RECIPE = alchemyRecipes.find((recipe) => recipe.id === 'alchemy_thong_mach_dan')!
const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest

function jobAt(startedAtMs: number, jobId: string, completesAtMs?: number) {
  return alchemyJobFixture(
    {
      jobId,
      recipeId: JOB_RECIPE.id,
      pillId: JOB_RECIPE.pillId,
      herbMaterialId: JOB_RECIPE.herbVariants[0]!.materialId,
      startedAtMs,
      completesAtMs: completesAtMs ?? startedAtMs + alchemySecondsFor(JOB_RECIPE, 1) * 1000,
      roomLevelAtStart: 1,
    },
    undefined,
    JOB_RECIPE,
  )
}

function cycleAt(startedAtMs: number, completesAtMs: number): ProductionCycle {
  return {
    cycleId: 'cycle_probe',
    siteId: FOREST_SITE_ID,
    collectionRealmId: 'luyen_khi',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs,
    completesAtMs,
  }
}

function validWireSave(): GameSave {
  const writer = new GameManager()
  writer.catalogOps.registerEquipment(equipment)
  writer.catalogOps.registerAffixes(affixes)
  writer.catalogOps.registerBuildings(buildings)
  writer.catalogOps.registerPills(pills)
  writer.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

function clockIsolated() {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
}

function alchemyWithRecipe(): AlchemySystem {
  const system = new AlchemySystem()
  system.setRecipeLookup((recipeId) => alchemyRecipes.find((recipe) => recipe.id === recipeId))
  return system
}

function productionSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: [],
    mineRewards: [],
    grottoHerbs: [],
  })
}

// ============================================================================
// F1 - restoreJobs: in-domain inverted pair is NOT dropped; it settles
// (mints) on the next honest tick. The drop-check covers the bound pins
// but not the validator's completesAtMs > startedAtMs ordering pin.
// ============================================================================
describe('r32-AUT F1 - AlchemySystem.restoreJobs ordering-parity gap', () => {
  clockIsolated()

  it('in-domain inverted pair is DROPPED at restore - ordering parity pinned (r32 fix)', () => {
    const system = alchemyWithRecipe()
    // completesAtMs < startedAtMs, both inside [0, 2^52): passes every
    // bound pin (finite, >= 0, < bound) while violating ordering -
    // r32-AUT-1 dropped it at the boundary instead of letting it
    // settle-mint on the next tick.
    const inverted = jobAt(currentMs - 1000, 'job_inverted_pair', currentMs - 1500)
    system.restoreJobs([inverted], currentMs)

    expect(system.getJobs()).toHaveLength(0)

    const pillBag = new PillBag()
    const resolvePill = (pillId: string) => ({ id: pillId })
    system.tick(currentMs, pillBag, resolvePill as never, () => 0)

    expect(system.drainSettlementEvents()).toHaveLength(0)
  })

  it('sibling contrast: the identical inverted pair is denied by advanceWorkerLanes', () => {
    const inverted = cycleAt(currentMs - 1000, currentMs - 1500)
    const result = advanceWorkerLanes({
      siteId: FOREST_SITE_ID,
      collectionRealmId: 'luyen_khi',
      siteLevel: 1,
      baseSeconds: 30,
      cycleMs: 30_000,
      pending: [inverted],
      slots: 1,
      nowMs: currentMs,
      advanceMode: 'deadline',
      budgetMs: 86_400_000,
    })

    // completesAtMs <= startedAtMs is an ordering deny here - zero
    // advance, the pair parks. The alchemy sibling paid it instead.
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
  })
})

// ============================================================================
// F2 - the restore shift arms mint INVERTED pairs: the headroom check
// restoreNowMs + (completes - started) < 2^52 is trivially true for a
// negative span, so a post-dated inverted pair shifts to
// {started: now, completes: now + (negative)}.
// ============================================================================
describe('r32-AUT F2 - restore shift arms mint inverted pairs', () => {
  clockIsolated()

  it('restoreJobs shift arm: post-dated inverted pair DROPPED outright - no minted inversion (r32 fix)', () => {
    const system = alchemyWithRecipe()
    // Post-dated (startedAtMs > restoreNowMs) AND inverted
    // (completesAtMs < startedAtMs): a negative span used to pass the
    // headroom trivially and shift into a FRESH inverted minted pair;
    // r32-AUT-2 drops the pair before the shift is even considered.
    const crafted = jobAt(currentMs + 2000, 'job_shift_inverted', currentMs + 1000)
    system.restoreJobs([crafted], currentMs)

    expect(system.getJobs()).toHaveLength(0)

    const pillBag = new PillBag()
    system.tick(currentMs, pillBag, ((pillId: string) => ({ id: pillId })) as never, () => 0)
    expect(system.drainSettlementEvents()).toHaveLength(0)
  })

  it('restoreStates drops an inverted pair at the boundary; the mechanism still ordering-denies a direct feed (r33 parity)', () => {
    const system = productionSystem()
    const inverted = cycleAt(currentMs + 2000, currentMs + 1000)
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [inverted],
        },
      ],
      currentMs,
    )

    // r33-COR-F1/AUT-2: the impossible-authored pair now drops at the
    // restore boundary - parity with restoreJobs - instead of parking
    // verbatim and wedging every later write. The pure mechanism keeps
    // its ordering deny for any feed that bypasses restore.
    expect(system.getState(FOREST_SITE_ID)!.workerCycles!).toHaveLength(0)

    const result = advanceWorkerLanes({
      siteId: FOREST_SITE_ID,
      collectionRealmId: 'luyen_khi',
      siteLevel: 1,
      baseSeconds: 30,
      cycleMs: 30_000,
      pending: [inverted],
      slots: 1,
      nowMs: currentMs,
      advanceMode: 'deadline',
      budgetMs: 86_400_000,
    })
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
  })
})

// ============================================================================
// F3 - DecomposeSystem.restore: mergedDeadline = min(max(0, restored),
// restoreNowMs + cycleMs) - the cap itself is a minted stamp and can land
// >= 2^52 when restoreNowMs sits within cycleMs of the bound.
// ============================================================================
describe('r32-AUT F3 - DecomposeSystem.restore mergedDeadline over-bound mint', () => {
  clockIsolated()

  it('crafted deadline + near-bound restoreNow: merged cap clamps to 2^52 - 1 (r32 fix)', () => {
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    system.updateCapacity(1)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: BOUND + 1000,
        started: true,
      },
      BOUND - 1,
    )

    // mergedDeadline = min(BOUND + 1000, min((BOUND - 1) + 30000,
    // 2^52 - 1)) = BOUND - 1: the cap itself can no longer mint
    // out-of-domain, so the next save write stays admissible.
    expect(system.getSaveState().nextCycleAt).toBe(BOUND - 1)
  })

  it('end-to-end: the minted stamp refuses the next save write', () => {
    const save = validWireSave()
    save.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: BOUND + 1000,
      started: true,
    }
    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.path.includes('decompose'))).toBe(true)
  })
})

// ============================================================================
// F4 - ProductionOffline fieldEpochShiftMs: seeded lane heads are
// re-stamped +max(0, Date.now() - nowMs) with NO headroom - a client
// clock ~2^52 ahead of the settle epoch mints over-bound persisted
// stamps while every clock INPUT stays min()-clamped in-domain.
// ============================================================================
describe('r32-AUT F4 - fieldEpochShiftMs over-bound re-stamp', () => {
  clockIsolated()

  it('seeded heads re-stamp over 2^52 when Date.now() races the settle epoch', () => {
    const states = new Map<string, ProductionSiteState>([
      [
        FOREST_SITE_ID,
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 0,
          workerCycles: [],
        },
      ],
    ])

    // Crafted client clock ~2^52 ahead of the settle epoch: the min()
    // clamps on restoreNowMs/settleNowMs/offlineSinceMs keep nowMs
    // in-domain, but the raw Date.now() delta is added verbatim.
    currentMs = 1_725_160_000_000 + BOUND

    const settled = settleProductionOffline(
      {
        states,
        getSiteDefinition: (siteId) =>
          THANH_VAN_PRODUCTION_SITES.find((site) => site.siteId === siteId),
        grantCycleRewards: () => {},
      },
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      1_725_160_000_000,
      {
        workerCapacity: 1,
        offlineSinceMs: 1_725_160_000_000 - 1,
        workerAssignments: new Map(),
        rng: () => 0.5,
      },
    )

    expect(settled).toBe(0)
    const seeded = states.get(FOREST_SITE_ID)!.workerCycles!
    expect(seeded).toHaveLength(1)
    // r32-AUT-4: the re-stamp arm now checks shift headroom - a
    // +Date.now() delta that would push the head past 2^52 is skipped
    // and the head keeps its settle-epoch stamps (parked, deny).
    expect(seeded[0]!.completesAtMs).toBeLessThan(BOUND)
    expect(seeded[0]!.startedAtMs).toBeLessThan(BOUND)
  })
})

// ============================================================================
// F5 - applyTimedEffect: NaN propagation on the new appliedAtMs clamp and
// the raw-span duration read in the stackable arm.
// ============================================================================
describe('r32-AUT F5 - applyTimedEffect stamp edges', () => {
  clockIsolated()

  const ops = () =>
    new GameManagerPersistentEffectOps({
      persistentBuffs: undefined,
      skillSystem: undefined,
      techniqueManager: undefined,
      nodeRegistry: undefined,
      equipmentBag: undefined,
      materialRegistry: undefined,
      materialBag: undefined,
      getActivePlayer: () => undefined,
    } as never)

  it('push arm coerces a NaN appliedAtMs to now - persisted stamp stays valid (r32 fix)', () => {
    const player = createDefaultPlayer()
    const effect = {
      id: 'probe_nan',
      sourceItemId: 'probe',
      appliedAtMs: Number.NaN,
      expiresAtMs: currentMs + 1000,
      modifiers: [],
    } as unknown as PersistentTimedEffect

    ops().applyTimedEffect(player, effect)

    const pushed = player.persistentTimedEffects[0]!
    // r32-AUT-5: Math.min/max propagate NaN - the coerce lands the stamp
    // at the just-applied ceiling (deny-lean: no crafted head start).
    expect(pushed.appliedAtMs).toBe(currentMs)
    expect(Number.isFinite(pushed.appliedAtMs)).toBe(true)

    // The written save refuses: NaN serializes to null / fails
    // isBoundedTimestamp either way.
    const save = validWireSave()
    save.player.persistentTimedEffects.push({
      id: 'probe_nan',
      sourceItemId: 'probe',
      appliedAtMs: null,
      expiresAtMs: save.player.lastSavedAt,
      modifiers: [],
    } as never)
    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.path.includes('appliedAtMs'))).toBe(true)
  })

  it('stackable arm derives duration from RAW caller stamps -> expiry pinned at 2^52 - 1', () => {
    const player = createDefaultPlayer()
    player.persistentTimedEffects.push({
      id: 'existing',
      sourceItemId: 'probe',
      effectGroup: 'probe_group',
      appliedAtMs: currentMs - 1000,
      expiresAtMs: currentMs + 1000,
      modifiers: [],
    })

    ops().applyTimedEffect(player, {
      id: 'crafted',
      sourceItemId: 'probe',
      effectGroup: 'probe_group',
      durationStackable: true,
      appliedAtMs: -(BOUND - 1),
      expiresAtMs: BOUND - 1,
      modifiers: [],
    })

    // duration = max(0, (2^52-1) - -(2^52-1)) ~ 9e15 -> existing expiry
    // clamps to the domain ceiling: a near-permanent in-session buff.
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(BOUND - 1)
  })
})

// ============================================================================
// Controls - r31 guards verified held at the exact boundaries.
// ============================================================================
describe('r32-AUT controls - r31 guards held at exact boundaries', () => {
  clockIsolated()

  it('WorkerLaneAdvance nowMs headroom: deny when nowMs + cycleMs === 2^52, admit below', () => {
    const base = {
      siteId: FOREST_SITE_ID,
      collectionRealmId: 'luyen_khi',
      siteLevel: 1,
      baseSeconds: 30,
      cycleMs: 30_000,
      pending: [] as ProductionCycle[],
      slots: 1,
      advanceMode: 'deadline' as const,
      budgetMs: 86_400_000,
    }

    // Exact-boundary mint: nowMs + cycleMs === 2^52 -> deny.
    const denied = advanceWorkerLanes({
      ...base,
      nowMs: BOUND - 30_000,
      emptyLaneStartMs: BOUND - 30_000,
    })
    expect(denied.pending).toHaveLength(0)
    expect(denied.completed).toHaveLength(0)

    // One ms below: admit; the minted due stays < 2^52.
    const admitted = advanceWorkerLanes({
      ...base,
      nowMs: BOUND - 30_001,
      emptyLaneStartMs: BOUND - 30_001,
    })
    expect(admitted.pending).toHaveLength(1)
    expect(admitted.pending[0]!.completesAtMs).toBeLessThan(BOUND)
  })

  it('restoreJobs drops out-of-domain stamps (r31 non-negative domain held)', () => {
    const system = alchemyWithRecipe()
    const negative = jobAt(-1, 'job_negative', 1000)
    const overBound = jobAt(BOUND, 'job_over_bound', BOUND + 1000)
    system.restoreJobs([negative, overBound], currentMs)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('DecomposeSystem.tick headroom: deny at the bound, mint stays in-domain below it', () => {
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    system.updateCapacity(1)
    system.setSetting({ workers: 1 })
    system.restore(
      { settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 }, nextCycleAt: 1, started: true },
      currentMs,
    )

    system.tick(BOUND - 30_000 + 1)
    // Denied: nowMs + cycleMs > 2^52 - nextCycleAt untouched.
    expect(system.getSaveState().nextCycleAt).toBe(1)

    system.tick(BOUND - 30_000 - 1)
    // Admitted: minted due lands exactly at BOUND - 1 < 2^52.
    expect(system.getSaveState().nextCycleAt).toBe(BOUND - 1)
  })

  it('AlchemySystem.startJob headroom: invalid_clock within a span of the bound', () => {
    const system = alchemyWithRecipe()
    const span = alchemySecondsFor(JOB_RECIPE, 1) * 1000
    const herb = JOB_RECIPE.herbVariants[0]!.materialId

    const denied = system.startJob(
      JOB_RECIPE,
      herb,
      new MaterialBag(),
      new MaterialRegistry(),
      0,
      1,
      BOUND - span + 1,
      4,
    )
    expect(denied.ok).toBe(false)
    expect(denied.reason).toBe('invalid_clock')

    // Control: one ms below the bound the headroom passes and the next
    // gate in the chain (wrong_herb on the empty registry) answers instead.
    const control = system.startJob(
      JOB_RECIPE,
      herb,
      new MaterialBag(),
      new MaterialRegistry(),
      0,
      1,
      BOUND - span - 1,
      4,
    )
    expect(control.ok).toBe(false)
    expect(control.reason).not.toBe('invalid_clock')
  })
})
