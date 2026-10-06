// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave, restoreGameSession } from './SaveSystem'
import type { GameSave } from './saveTypes'
import { validateGameSaveShape } from './saveShapeValidation'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import {
  alchemyJobReservationDigest,
  alchemySecondsFor,
  verifyAlchemyJobReservation,
} from '../../core/alchemy/AlchemySystem'
import type { ActiveAlchemyJob } from '../../core/alchemy/AlchemySystem'
import { PillBag } from '../../core/pill/PillBag'
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
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type { CloudSaveService } from '../cloudSave/CloudSaveService'
import { DATA_REFUSE_CODES, type BackendErrorCode } from '../session/BackendStatus'
import { authorityStateForError } from '../session/OnlineSessionController'

// ============================================================================
// QA probe - fixpoint r29 AUT wave. Adversarial audit of the r28 batch at
// faa893c1: restoreJobs foldable-witness gate, talentLevels sibling-walk caps,
// persistPlayer 'local' scope + report/fail pairing, alchemy tick/settleOffline
// finite-clock guard.
//
// FINDINGS:
//   F1 (Medium) - the 'local'-scope premise is falsified by a remote path:
//     SupabaseCloudSaveService:974-989 maps server REJECTED responses onto
//     'unavailable' + SAVE_INVALID/SAVE_TOO_LARGE - the SAME result contract
//     the App.vue:599-612 arm consumes. The arm reports scope 'local'
//     unconditionally, so a deterministic server-side refuse arms a card
//     whose remoteResettable is false: the only offered destructive action
//     is deleteSave() on the local mirror, which heals nothing - the remote
//     last-good restores, the next write refuses identically, and the user
//     loops forever. The sibling lifecycle arms (useAppLifecycle.ts:568,
//     :691) scope 'remote' for exactly this refuse class, explicitly because
//     remote reset "is the only real un-wedge"; result.detail carries the
//     provenance the arm ignores (OUTGOING_* = gate-emitted, anything else
//     = adapter-emitted).
//   F2 (Low) - restoreJobs/restoreStates take restoreNowMs with no finite
//     guard: a -Infinity feed re-anchors every began-pair to -Infinity
//     completesAtMs (digest re-derived over the shifted stamps, so the
//     foldable arm stays self-consistent) and the next honest tick settles
//     the whole queue - instant mint on an ungated feed. Same class the
//     r28-AUT-2 guard closed for tick/settleOffline; in production
//     restoreClockMs is finite by construction (min of bounded lastSavedAt,
//     Date.now()), so this is guard parity, listed for consistency.
//   F3 (Nit) - cap-walk coverage is inconsistent: an over-cap nodeLevels is
//     refused at :2026 yet the skill-grant walks at :3158/:3225/:3253 still
//     iterate the refused record (their issue output proves it), and every
//     requireArray/optionalArray consumer (purchasedNodeIds :1206, skills
//     :3049+, materials :4895+, ...) pays the per-entry walk on cap-refused
//     arrays. Verdict is unchanged (refused either way) - wasted iteration
//     plus issue noise on crafted payloads, same class r28-COR-Nit closed
//     for talentLevels' derived consumers.
//   F4 (Nit) - persistPlayer refuse arm double-signals: after report+fail()
//     the shared `result.status !== 'ok'` tail still fires the
//     autosaveFailed toast and latches saveFailureNotified - one refuse
//     shows both the terminal card and a transient toast.
//   F5 (Nit) - the ok-arm saveIssue.clear() added by r28 is unreachable in
//     session: every report() arm pairs with bootFlow.fail() or an
//     authority recovery terminal (observeAuthoritySaveResult ->
//     'recovery' for DATA_REFUSE_CODES), and the persistPlayer gate
//     authority.canMutate() then refuses every later persist - no ok write
//     can ever sweep an armed card. Harmless dead protection.
//
// VERIFIED-HELD arms are asserted as positive behavior below.
// ============================================================================

const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest
const MORTAL_CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100, 1) * 1000

let currentMs = 1_725_160_000_000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
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

function workerCycle(startedAtMs: number, cycleId: string): ProductionCycle {
  return {
    cycleId,
    siteId: FOREST_SITE_ID,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 42,
    startedAtMs,
    completesAtMs: startedAtMs + MORTAL_CYCLE_MS,
  }
}

const JOB_RECIPE = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!

function jobAt(startedAtMs: number, jobId: string) {
  return alchemyJobFixture(
    {
      jobId,
      recipeId: JOB_RECIPE.id,
      pillId: JOB_RECIPE.pillId,
      herbMaterialId: JOB_RECIPE.herbVariants[0]!.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + alchemySecondsFor(JOB_RECIPE, 1) * 1000,
      roomLevelAtStart: 1,
    },
    undefined,
    JOB_RECIPE,
  )
}

function makeSave(overrides: { lastSavedAt?: number } = {}): GameSave {
  const manager = registeredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  const save = buildGameSave(player, manager)
  save.player.lastSavedAt = overrides.lastSavedAt ?? currentMs
  return save
}

/** The App.vue persistPlayer arm predicate, kept verbatim so the probe
 *  asserts against the real acceptance shape (App.vue:591-599). */
function persistPlayerRefuseArmMatches(result: { status: string; retryable?: boolean; code?: BackendErrorCode }): boolean {
  return (
    result.status === 'unavailable' &&
    !result.retryable &&
    result.code !== undefined &&
    DATA_REFUSE_CODES.has(result.code)
  )
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

// ============================================================================
// r28-AUT-4 verification: the new finite-clock guard on tick/settleOffline.
// ============================================================================
describe('r29-AUT - tick/settleOffline finite-clock guard boundary sweep', () => {
  clockIsolated()

  const HOSTILE_CLOCKS: Array<[string, unknown]> = [
    ['NaN', NaN],
    ['+Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['+2^53', 2 ** 53],
    ['-2^53', -(2 ** 53)],
    ['1e300', 1e300],
    ['-1e300', -1e300],
    ['string clock', '1725160000000'],
    ['null clock', null],
    ['undefined clock', undefined],
    ['object clock', {}],
  ]

  for (const [label, clock] of HOSTILE_CLOCKS) {
    it(`tick(${label}) zero-advances - job preserved, no events, no pill`, () => {
      const reader = registeredManager()
      // in-flight: completes currentMs - 60s + span, so an unguarded settle
      // at a hostile clock would mint it instantly.
      reader.alchemySystem.restoreJobs([jobAt(currentMs - 60_000, `r29_guard_${label}`)], currentMs)

      const bag = new PillBag()
      reader.alchemySystem.tick(clock as number, bag, (id) => ({ id }), () => 0)

      expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(0)
      expect(bag.getAmount(JOB_RECIPE.pillId)).toBe(0)
      expect(reader.alchemySystem.getJobs()).toHaveLength(1)
    })
  }

  it('boundary: 2^52 - 1 is admitted and settles a due job (guard is >= 2^52)', () => {
    const reader = registeredManager()
    const inside = 2 ** 52 - 1
    // due well before the admitted boundary clock; the job's stamps sit
    // inside [0, 2^52) so the shift arm re-grounds them (verbatim span).
    const jobStart = inside - 3_600_000
    const job = jobAt(jobStart, 'r29_boundary_in')
    reader.alchemySystem.restoreJobs([job], inside - 3_000_000)

    const bag = new PillBag()
    reader.alchemySystem.tick(inside, bag, (id) => ({ id }), () => 0)

    expect(reader.alchemySystem.getJobs()).toHaveLength(0)
    expect(bag.getAmount(JOB_RECIPE.pillId)).toBeGreaterThan(0)
  })

  it('boundary: 2^52 is refused - a due job is preserved, no pill mints', () => {
    const reader = registeredManager()
    reader.alchemySystem.restoreJobs([jobAt(currentMs - 60_000, 'r29_boundary_out')], currentMs)

    const bag = new PillBag()
    reader.alchemySystem.tick(2 ** 52, bag, (id) => ({ id }), () => 0)

    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
    expect(bag.getAmount(JOB_RECIPE.pillId)).toBe(0)
  })

  it('settleOffline(NaN) returns 0 and preserves the queue', () => {
    const reader = registeredManager()
    reader.alchemySystem.restoreJobs([jobAt(currentMs - 60_000, 'r29_so_nan')], currentMs)
    const bag = new PillBag()
    expect(reader.alchemySystem.settleOffline(bag, (id) => ({ id }), NaN)).toBe(0)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
  })
})

// ============================================================================
// r28-COR-High verification: the foldable-witness gate on restoreJobs' shift
// arm. Every malformed-but-defined reservation class skips the re-derive and
// keeps a stale digest, so the shifted job can never pass grant-time verify.
// ============================================================================
describe('r29-AUT - foldable guard arm matrix (non-foldable keeps stale digest -> deny)', () => {
  clockIsolated()

  const MALFORMED_RESERVATIONS: Array<[string, (job: ReturnType<typeof jobAt>) => unknown]> = [
    ['null', () => null],
    ['scalar number', () => 42],
    ['scalar string', () => 'x'],
    ['empty object', () => ({})],
    ['specialIngredients={}', (job) => ({ ...job.reservation!, specialIngredients: {} })],
    ['specialIngredients=5', (job) => ({ ...job.reservation!, specialIngredients: 5 })],
    ['specialIngredients=[null]', (job) => ({ ...job.reservation!, specialIngredients: [null] })],
    [
      'specialIngredients=[1,2]',
      (job) => ({ ...job.reservation!, specialIngredients: [1, 2] }),
    ],
    [
      'specialIngredients=[{}]',
      (job) => ({ ...job.reservation!, specialIngredients: [{}] }),
    ],
  ]

  for (const [label, makeReservation] of MALFORMED_RESERVATIONS) {
    it(`post-dated job + reservation:${label} restores without throw; shifted stamps keep the stale digest and settle as failed`, () => {
      const reader = registeredManager()
      const job = jobAt(currentMs + 60_000, `r29_fold_${label}`)
      const postDated = {
        ...job,
        reservation: makeReservation(job),
      } as unknown as ActiveAlchemyJob

      expect(() =>
        reader.alchemySystem.restoreJobs([postDated], currentMs),
      ).not.toThrow()

      const restored = reader.alchemySystem.getJobs()[0]!
      // The shift arm re-grounded the began-pair at the restore clock.
      expect(restored.startedAtMs).toBe(currentMs)
      expect(restored.completesAtMs).toBe(job.completesAtMs - 60_000)

      // Stale digest (or no reservation at all) can never verify at settle:
      // the shifted job fails instead of minting once it comes due.
      const bag = new PillBag()
      reader.alchemySystem.tick(currentMs + 3_600_000, bag, (id) => ({ id }), () => 0)
      const events = reader.alchemySystem.drainSettlementEvents()
      expect(events).toHaveLength(1)
      expect(events[0]!.success).toBe(false)
      expect(bag.getAmount(JOB_RECIPE.pillId)).toBe(0)
    })
  }

  it('foldable arm: valid specialIngredients re-derives the digest over shifted stamps -> verify passes -> honest settle mints', () => {
    const reader = registeredManager()
    const postDated = jobAt(currentMs + 60_000, 'r29_fold_ok')

    reader.alchemySystem.restoreJobs([postDated], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs)
    expect(verifyAlchemyJobReservation(restored, JOB_RECIPE)).toBeNull()

    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs + 3_600_000, bag, (id) => ({ id }), () => 0)
    const events = reader.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(true)
    expect(bag.getAmount(JOB_RECIPE.pillId)).toBeGreaterThan(0)
  })

  it('semantically-bad specials are still foldable (digest re-derived) but grant-verify denies at the shape check', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 60_000, 'r29_fold_shape')
    const postDated = {
      ...job,
      reservation: {
        ...job.reservation!,
        specialIngredients: [{ materialId: 5, amount: 'x' }],
      },
    } as unknown as ActiveAlchemyJob

    reader.alchemySystem.restoreJobs([postDated], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!
    // Foldable: digest was re-derived over the shifted stamps, so the
    // stored digest is self-consistent - but verify's specials shape arm
    // still denies before ever reaching the digest compare.
    expect(verifyAlchemyJobReservation(restored, JOB_RECIPE)).toBe('specialIngredients')
  })

  it('sparse specialIngredients ([hole, hole]) is foldable (every skips holes) but still denies at the recipe-length check', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 60_000, 'r29_fold_sparse')
    const sparse = new Array(2) // length 2, zero elements
    const postDated = {
      ...job,
      reservation: {
        ...job.reservation!,
        specialIngredients: sparse,
      },
    } as unknown as ActiveAlchemyJob

    reader.alchemySystem.restoreJobs([postDated], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!
    // The restore normalizer maps holes to {} clones; either way the
    // recipe expects exactly one authored special - deny, never mint.
    expect(verifyAlchemyJobReservation(restored, JOB_RECIPE)).not.toBeNull()
  })
})

// ============================================================================
// F1 - remote-emitted DATA_REFUSE_CODES reach the 'local'-scope arm.
// ============================================================================
describe('r29-AUT - F1: server-emitted refuse codes reach the local-scope arm', () => {
  clockIsolated()

  it('a remote-authoritative adapter emits unavailable+SAVE_INVALID through coordinator.save (adapter WAS invoked)', async () => {
    const save = makeSave()

    const fakeService: CloudSaveService = {
      capability: 'remote-authoritative',
      load: async () => ({
        status: 'ok',
        save,
        revision: 7,
        raw: JSON.stringify(save),
        discardedEquipmentCount: 0,
      }),
      save: async () => ({
        // The exact contract SupabaseCloudSaveService:974-989 mints on a
        // server REJECTED response - same shape, adapter invoked.
        status: 'unavailable',
        message: 'server refused the write',
        retryable: false,
        code: 'SAVE_INVALID',
        detail: 'SAVE_INVALID',
      }),
      resetCharacter: async () => ({ status: 'deleted' }),
    }
    const coordinator = new CloudSaveCoordinator(fakeService)
    await coordinator.load() // adopt revision 7 like a real boot

    const result = await coordinator.save(save)
    expect(result.status).toBe('unavailable')
    if (result.status !== 'unavailable') throw new Error('unreachable')
    expect(result.code).toBe('SAVE_INVALID')
    expect(result.retryable).toBe(false)

    // The App.vue:591-599 arm predicate cannot distinguish this
    // adapter-emitted refuse from a local outgoing-gate refuse - it reports
    // 'local' either way.
    expect(persistPlayerRefuseArmMatches(result)).toBe(true)

    // Armed 'local' under a remote-authoritative adapter: remoteResettable
    // (SaveIncompatibleScreen.vue - remoteAuthoritative && scope ===
    // 'remote') is false, so the only offered destructive action is
    // deleteSave() on the local mirror. The remote row that
    // deterministically refuses every write is untouched -> recovery loop.
    const remoteAuthoritative = fakeService.capability === 'remote-authoritative'
    const armedScope: string = 'local'
    const remoteResettable = remoteAuthoritative && armedScope === 'remote'
    expect(remoteResettable).toBe(false)
  })

  it('both DATA_REFUSE_CODES are server-emittable (SAVE_INVALID, SAVE_TOO_LARGE) and the arm matches each', async () => {
    for (const code of ['SAVE_INVALID', 'SAVE_TOO_LARGE'] as const) {
      const fakeService: CloudSaveService = {
        capability: 'remote-authoritative',
        load: async () => ({ status: 'empty', revision: 0 }),
        save: async () => ({
          status: 'unavailable',
          message: 'server refused',
          retryable: false,
          code,
          detail: code,
        }),
      }
      const coordinator = new CloudSaveCoordinator(fakeService)
      const result = await coordinator.save(makeSave())
      if (result.status !== 'unavailable') throw new Error('expected unavailable')
      expect(persistPlayerRefuseArmMatches(result)).toBe(true)
    }
  })

  it('provenance exists but is ignored: gate refuses carry detail OUTGOING_*, adapter refuses carry anything else', async () => {
    // Local-gate refuse: an oversized / shape-invalid write never reaches
    // the adapter - the coordinator mints detail=OUTGOING_* itself.
    const fakeService: CloudSaveService = {
      capability: 'remote-authoritative',
      load: async () => ({ status: 'empty', revision: 0 }),
      save: async () => {
        throw new Error('adapter must never be invoked for a gate refuse')
      },
    }
    const coordinator = new CloudSaveCoordinator(fakeService)

    const save = makeSave()
    // Craft a shape-invalid write: a non-string realmId trips the local
    // outgoing gate before the adapter (validateGameSaveShape only -
    // material refs are acceptance-surface, not shape).
    save.player.realmId = 5 as unknown as string

    const result = await coordinator.save(save)
    if (result.status !== 'unavailable') throw new Error('expected unavailable')
    expect(result.code).toBe('SAVE_INVALID')
    expect(result.detail).toBe('OUTGOING_ADMISSION_REJECTED')

    // Same code, different detail -> the arm could tell provenance from
    // result.detail and chose not to (it ignores detail entirely).
    expect(persistPlayerRefuseArmMatches(result)).toBe(true)
  })
})

// ============================================================================
// F2 - restoreNowMs has no finite guard on restoreJobs / restoreStates.
// ============================================================================
describe('r29-AUT - F2: hostile restoreNowMs clocks restore verbatim now (fixed)', () => {
  clockIsolated()

  it('restoreJobs(jobs, -Infinity) restores verbatim - post-dated job stays parked (r29-F1 deny)', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 60_000, 'r29_f2_mint')

    // FIXED: a non-finite/huge restore clock disables the shift arm -
    // the pair keeps its stamps (post-dated -> parked = deny).
    reader.alchemySystem.restoreJobs([job], -Infinity)
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs + 60_000)
    expect(restored.completesAtMs).toBe(currentMs + 60_000 + (job.completesAtMs - job.startedAtMs))

    // No mint on the next honest tick - the deadline is still future.
    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs, bag, (id) => ({ id }), () => 0)
    expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(0)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
    expect(bag.getAmount(JOB_RECIPE.pillId)).toBe(0)
  })

  it('restoreStates(states, -Infinity) restores workerCycles verbatim (r29-F1 deny - no re-anchor)', () => {
    const system = createProductionSystem()
    const cycle = workerCycle(currentMs + 60_000, 'r29_f2_lane')
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [cycle],
        },
      ],
      -Infinity,
    )
    const restored = system.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(restored.startedAtMs).toBe(cycle.startedAtMs)
    expect(restored.completesAtMs).toBe(cycle.completesAtMs)
  })

  it('restoreJobs(jobs, NaN) keeps stamps verbatim (NaN comparisons are false) - deny direction preserved', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 60_000, 'r29_f2_nan')
    reader.alchemySystem.restoreJobs([job], NaN)
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(job.startedAtMs)
    expect(restored.completesAtMs).toBe(job.completesAtMs)
  })

  it('restoreJobs(jobs, +Infinity) keeps stamps verbatim (nothing is post-dated vs +Infinity)', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 60_000, 'r29_f2_inf')
    reader.alchemySystem.restoreJobs([job], Infinity)
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(job.startedAtMs)
  })
})

// ============================================================================
// F3 - cap-walk coverage asymmetry: refused collections are still iterated.
// ============================================================================
describe('r29-AUT - F3: sibling walks skip cap-refused collections (fixed)', () => {
  clockIsolated()

  it('over-cap nodeLevels is refused at the root cap and the skill-grant walks emit nothing', () => {
    const save = makeSave()
    // 1 registered core at level 1 with no grant source + filler keys to
    // exceed ID_COLLECTION_CAP (1024). The :3253 walk pushing
    // 'core không có nguồn grant' proves the refused record was iterated.
    const nodeLevels: Record<string, number> = {}
    for (let i = 0; i < 1_100; i += 1) {
      nodeLevels[`fake_node_${i}`] = 1
    }
    for (const node of SKILL_CORE_NODES) {
      nodeLevels[node.id] = 1
    }
    save.player.nodeLevels = nodeLevels

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === 'player.nodeLevels' && i.message.includes('ID_COLLECTION_CAP'))).toBe(true)
    // FIXED (r29-F2): the coverage binding cap-gates - no per-key
    // issues survive on the refused record.
    expect(
      result.issues.some((i) => i.path.startsWith('player.nodeLevels.')),
    ).toBe(false)
  })

  it('over-cap purchasedNodeIds array: cap issue pushed, ownership-mirror walk iterates nothing', () => {
    const save = makeSave()
    save.player.purchasedNodeIds = Array.from({ length: 2_000 }, (_, i) => `ghost_${i}`)
    save.player.nodeLevels = {}

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some((i) => i.path === 'player.purchasedNodeIds' && i.message.includes('ID_COLLECTION_CAP')),
    ).toBe(true)
    // FIXED (r29-INT-4): the helper returns [] on over-cap - the
    // ownership-mirror walk iterates nothing on the refused array.
    const mirrorIssues = result.issues.filter(
      (i) => i.path.startsWith('player.purchasedNodeIds[') && i.message.includes('ownership mirror'),
    )
    expect(mirrorIssues.length).toBe(0)
  })

  it('over-cap talentLevels IS skipped by the r28-derived-consumer arms (asymmetry pinned)', () => {
    const save = makeSave()
    const talentLevels: Record<string, number> = {}
    for (let i = 0; i < 1_100; i += 1) {
      talentLevels[`fake_talent_${i}`] = 1
    }
    save.player.talentLevels = talentLevels

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some((i) => i.path === 'player.talentLevels' && i.message.includes('ID_COLLECTION_CAP')),
    ).toBe(true)
    // The r28 caps gate the CPS-headroom and entitlement-sanitize arms:
    // no per-entry talent issues from those derived consumers.
    expect(result.issues.filter((i) => i.path.startsWith('player.talentLevels[')).length).toBe(0)
  })
})

// ============================================================================
// F4/F5 - persistPlayer arm: double-signal and unreachable clear() pins.
// ============================================================================
describe('r29-AUT - F4/F5: refuse-arm provenance + recovery pairing pins', () => {
  clockIsolated()

  it('DATA_REFUSE_CODES map to authority state recovery (terminal) - an armed card gates every later persist', () => {
    expect(authorityStateForError('SAVE_INVALID')).toBe('recovery')
    expect(authorityStateForError('SAVE_TOO_LARGE')).toBe('recovery')
    // 'recovery' sits in AUTHORITY_TERMINAL_STATES: once a refuse arms the
    // card, authority.canMutate() stays false, so the r28 ok-arm
    // saveIssue.clear() can never run inside the same session (dead
    // protection - harmless).
  })

  it('a gated restore-seam throw still degrades to rejected (envelope holds after the r28 guards)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const save = makeSave()
    save.materials.push({ materialId: 'r29_forged_material', amount: 1 })

    let result: ReturnType<typeof restoreGameSession> | undefined
    expect(() => {
      result = restoreGameSession(player, manager, save)
    }).not.toThrow()
    expect(result).toMatchObject({ status: 'rejected' })
  })

  it('digest fold is deterministic on -Infinity stamps (F2 mint requires self-consistency)', () => {
    const job = jobAt(-Infinity, 'r29_neg_inf')
    // Recompute the same fold the shift arm would have minted.
    const redigest = alchemyJobReservationDigest(job, {
      woodId: job.reservation!.woodId,
      fuelWoodAmount: job.reservation!.fuelWoodAmount,
      spiritStoneCost: job.reservation!.spiritStoneCost,
      herbAmount: job.reservation!.herbAmount,
      specialIngredients: job.reservation!.specialIngredients,
      costScale: job.reservation!.costScale,
    })
    expect(redigest).toBe(job.reservation!.digest)
  })
})
