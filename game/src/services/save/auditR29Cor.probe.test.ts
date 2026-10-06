// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameSave } from './saveTypes'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { primeMortalCreationPick } from './GameSave.fixture'
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
import { EventBus } from '../../core/events/EventBus'
import { TribulationDirector } from '../../core/tribulation/TribulationDirector'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { QuestManager } from '../../core/quest/QuestManager'
import { PillBag } from '../../core/pill/PillBag'
import { useSaveIssueStore } from '../../stores/saveIssue'
import { DATA_REFUSE_CODES } from '../session/BackendStatus'
import { authorityStateForError } from '../session/OnlineSessionController'

// ============================================================================
// QA probe - fixpoint r29 COR wave. Audits the r28 adjudication batch at
// faa893c1:
//
//   (A) claim 1 - restoreJobs shift-arm foldable truth table: reservation
//       null / scalar / {specialIngredients:{}} / [null] / [{non-object
//       fields}] / well-formed - each row pins shift-or-verbatim, digest
//       staleness, and the grant-time verify verdict.
//   (B) claim 2 - ID_COLLECTION_CAP boundary at 1024/1025 on
//       player.talentLevels, plus a Proxy get-trap census proving the
//       sibling walks pay zero iterations over-cap - and the sibling gap
//       on player.nodeLevels (validateSkillCoreCoverage walks uncapped).
//   (C) claim 3 - saveIssue store scope/clear semantics feeding the
//       App.vue refuse arm; DATA_REFUSE_CODES membership; authority map.
//   (D) claim 4 - finite-clock guard edges on AlchemySystem.tick and
//       settleOffline: NaN / +-Infinity / +-2^53 / 1e300 zero-advance;
//       +- (2^53 - 1) still advance.
//   (E) sibling ungated-clock seams (finding F1): decompose tick /
//       restore / settleOffline, questManager.restore, tribulation
//       restoreRuntime, restoreJobs / restoreStates at -Infinity.
//   (F) regression pins on honest shapes.
//
// ASCII only (P15).
// ============================================================================

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

const ANY_PILL = () => new PillBag()
const RESOLVE_ANY = (pillId: string) => ({ id: pillId })

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('r29 COR - claim 1: restoreJobs foldable truth table (A)', () => {
  it('A1 reservation=null: shift arm survives (no re-derive), stamps shift, verify denies on costScale', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r29_a1')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([{ ...job, reservation: null }] as never, currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.startedAtMs).toBe(currentMs)
    expect(restored.reservation).toEqual({ specialIngredients: [] })
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBe('costScale')
  })

  it('A2 reservation=scalar (5): same converge - shift runs, normalized to bare specials, verify costScale-deny', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r29_a2')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([{ ...job, reservation: 5 }] as never, currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.startedAtMs).toBe(currentMs)
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBe('costScale')
  })

  it('A3 reservation={specialIngredients:{}}: NOT foldable - stale writer digest kept through shift, verify digest-deny', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r29_a3')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs(
      [
        {
          ...job,
          reservation: { ...job.reservation!, specialIngredients: {} },
        },
      ] as never,
      currentMs,
    )
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.startedAtMs).toBe(currentMs)
    // stale digest preserved verbatim (no re-derive ran)
    expect(restored.reservation!.digest).toBe(writerDigest)
    expect(restored.reservation!.specialIngredients).toEqual([])
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBe('digest')
  })

  it('A4 specials=[null]: element is not a foldable object - stale digest, element normalizes to {}, verify element-deny', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r29_a4')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs(
      [
        {
          ...job,
          reservation: { ...job.reservation!, specialIngredients: [null] },
        },
      ] as never,
      currentMs,
    )
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.reservation!.digest).toBe(writerDigest)
    expect(restored.reservation!.specialIngredients).toEqual([{}])
    // element shape fails before the digest fold is even reached
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBe('specialIngredients')
  })

  it('A5 specials=[{materialId:1, amount:"x"}]: foldable=true (objects only) - re-derive ran, verify element-deny', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r29_a5')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs(
      [
        {
          ...job,
          reservation: {
            ...job.reservation!,
            specialIngredients: [{ materialId: 1, amount: 'x' }],
          },
        },
      ] as never,
      currentMs,
    )
    const restored = reader.alchemySystem.getJobs()[0]!

    // foldable: the re-derive ran - stored digest is consistent with the
    // shifted stamps + stored (normalized) reservation
    expect(restored.reservation!.digest).not.toBe(writerDigest)
    expect(restored.reservation!.digest).toBe(
      alchemyJobReservationDigest(restored, restored.reservation!),
    )
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBe('specialIngredients')
  })

  it('A6 specials=[{materialId:"x", amount:NaN}]: foldable=true, re-derive no-throw, verify element-deny', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r29_a6')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs(
      [
        {
          ...job,
          reservation: {
            ...job.reservation!,
            specialIngredients: [{ materialId: 'x', amount: Number.NaN }],
          },
        },
      ] as never,
      currentMs,
    )
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBe('specialIngredients')
  })

  it('A7 well-formed post-dated job: re-derive runs and grant-time verify still passes (honest skew replay)', () => {
    const { job, recipe } = mortalJob(currentMs + 60_000, 'r29_a7')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.startedAtMs).toBe(currentMs)
    expect(restored.reservation!.digest).toBe(
      alchemyJobReservationDigest(restored, restored.reservation!),
    )
    expect(verifyAlchemyJobReservation(restored, recipe)).toBeNull()
  })

  it('A8 verbatim arm (startedAt <= restoreNow) + malformed reservation: no shift, normalize still tolerates', () => {
    const { job } = mortalJob(currentMs - 60_000, 'r29_a8')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs(
      [
        {
          ...job,
          reservation: { ...job.reservation!, specialIngredients: [null] },
        },
      ] as never,
      currentMs,
    )
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.startedAtMs).toBe(currentMs - 60_000)
    expect(restored.reservation!.digest).toBe(writerDigest)
    expect(restored.reservation!.specialIngredients).toEqual([{}])
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBe('specialIngredients')
  })
})

describe('r29 COR - claim 2: ID_COLLECTION_CAP boundary (B)', () => {
  function saveWithTalentLevels(entries: number): {
    save: GameSave
    gets: string[]
  } {
    const save = validWireSave()
    const rec: Record<string, number> = {}
    for (let i = 0; i < entries; i += 1) {
      rec[`cap_probe_${i}`] = 1
    }
    const gets: string[] = []
    const proxy = new Proxy(rec, {
      get(target, prop) {
        if (typeof prop === 'string' && prop.startsWith('cap_probe_')) {
          gets.push(prop)
        }
        return Reflect.get(target, prop)
      },
    })
    ;(save.player as unknown as Record<string, unknown>).talentLevels = proxy
    return { save, gets }
  }

  it('B1 exactly 1024 talentLevels entries: no cap issue on the root path', () => {
    const { save } = saveWithTalentLevels(1024)
    const shape = validateGameSaveShape(save)

    expect(
      shape.issues.filter(
        (i) => i.path === 'player.talentLevels' && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toHaveLength(0)
  })

  it('B2 1025 entries: cap issue fires AND zero value-reads on the record - every sibling walk is gated', () => {
    const { save, gets } = saveWithTalentLevels(1025)
    const shape = validateGameSaveShape(save)

    expect(
      shape.issues.some(
        (i) => i.path === 'player.talentLevels' && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    // CPS headroom (:856) and entitlement sanitize (:1045) both gate on
    // Object.keys <= cap now - Object.entries never runs, so the get
    // trap stays empty.
    expect(gets).toHaveLength(0)
  })

  it('B3 sibling gap: over-cap player.nodeLevels still pays Object.entries walks in validateSkillCoreCoverage', () => {
    const save = validWireSave()
    const rec: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) {
      rec[`node_probe_${i}`] = 0
    }
    const gets: string[] = []
    const proxy = new Proxy(rec, {
      get(target, prop) {
        if (typeof prop === 'string' && prop.startsWith('node_probe_')) {
          gets.push(prop)
        }
        return Reflect.get(target, prop)
      },
    })
    ;(save.player as unknown as Record<string, unknown>).nodeLevels = proxy
    const shape = validateGameSaveShape(save)

    expect(
      shape.issues.some(
        (i) => i.path === 'player.nodeLevels' && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    // FIXED (r29-F2): the binding now cap-gates like talentLevels -
    // over-cap records pay zero value-reads on the coverage walks.
    expect(gets).toHaveLength(0)
  })
})

describe('r29 COR - claim 3: refuse-arm scope/fail/clear semantics (C)', () => {
  it('C1 DATA_REFUSE_CODES is exactly {SAVE_INVALID, SAVE_TOO_LARGE}', () => {
    expect([...DATA_REFUSE_CODES].sort()).toEqual(['SAVE_INVALID', 'SAVE_TOO_LARGE'])
  })

  it('C2 report(scope:local) arms status+scope; remote-reset offer requires remote scope (SaveIncompatibleScreen :32)', () => {
    const store = useSaveIssueStore()

    store.report('corrupted', 'rawbytes', undefined, 'local')

    expect(store.status).toBe('corrupted')
    expect(store.scope).toBe('local')
    // remoteResettable = remoteAuthoritative && scope === 'remote'
    const remoteAuthoritative = true
    expect(remoteAuthoritative && store.scope === 'remote').toBe(false)
  })

  it('C3 report is overwrite-idempotent and clear() sweeps every armed field incl. scope back to remote', () => {
    const store = useSaveIssueStore()

    store.report('incompatible', 'a', 3, 'remote')
    store.report('corrupted', 'b', undefined, 'local')
    expect(store.status).toBe('corrupted')
    expect(store.raw).toBe('b')
    expect(store.foundVersion).toBeUndefined()
    expect(store.scope).toBe('local')

    store.clear()
    expect(store.status).toBeNull()
    expect(store.raw).toBe('')
    expect(store.foundVersion).toBeUndefined()
    expect(store.scope).toBe('remote')
  })

  it('C4 authorityStateForError maps both refuse codes to recovery (reachable from the remote adapter too)', () => {
    for (const code of DATA_REFUSE_CODES) {
      expect(authorityStateForError(code)).toBe('recovery')
    }
    // sibling server codes do NOT arm the refuse surface
    expect(authorityStateForError('SERVER_ERROR')).toBe('reconnecting')
    expect(authorityStateForError('SAVE_CONFLICT')).toBe('conflict')
  })
})

describe('r29 COR - claim 4: finite-clock guard edges on alchemy tick/settleOffline (D)', () => {
  const BLOCKED_CLOCKS = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    2 ** 53,
    -(2 ** 53),
    1e300,
    -1e300,
  ]

  it.each(BLOCKED_CLOCKS)('tick(%j) zero-advances: in-flight job preserved untouched', (edge) => {
    const reader = registeredManager()
    const { job } = mortalJob(currentMs - 60_000, `edge_${String(edge)}`)

    reader.alchemySystem.restoreJobs([job], currentMs)
    reader.alchemySystem.tick(edge, ANY_PILL(), RESOLVE_ANY)

    const jobs = reader.alchemySystem.getJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.startedAtMs).toBe(job.startedAtMs)
    expect(jobs[0]!.completesAtMs).toBe(job.completesAtMs)
  })

  it.each(BLOCKED_CLOCKS)('settleOffline(..., %j) returns 0 and preserves the queue', (edge) => {
    const reader = registeredManager()
    const { job } = mortalJob(currentMs - 60_000, `so_${String(edge)}`)

    reader.alchemySystem.restoreJobs([job], currentMs)
    const settled = reader.alchemySystem.settleOffline(ANY_PILL(), RESOLVE_ANY, edge)

    expect(settled).toBe(0)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
  })

  it('boundary: tick(2**53 - 1) still advances - the due job settles', () => {
    const reader = registeredManager()
    const { job } = mortalJob(currentMs - 60_000, 'edge_hi_ok')

    reader.alchemySystem.restoreJobs([job], currentMs)
    reader.alchemySystem.tick(2 ** 53 - 1, ANY_PILL(), RESOLVE_ANY)

    expect(reader.alchemySystem.getJobs()).toHaveLength(0)
  })

  it('boundary: tick(-(2**53 - 1)) is admitted by the |x| bound - a past clock parks (deny), never settles', () => {
    const reader = registeredManager()
    const { job } = mortalJob(currentMs - 60_000, 'edge_lo_ok')

    reader.alchemySystem.restoreJobs([job], currentMs)
    reader.alchemySystem.tick(-(2 ** 53 - 1), ANY_PILL(), RESOLVE_ANY)

    // admitted, and a negative clock is strictly < completesAtMs -> the
    // job is parked, not minted
    const jobs = reader.alchemySystem.getJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.completesAtMs).toBe(job.completesAtMs)
  })

  it('honest feed regression: tick(Date.now()) settles the due job', () => {
    const reader = registeredManager()
    const { job } = mortalJob(currentMs - 60_000, 'honest')

    reader.alchemySystem.restoreJobs([job], currentMs)
    reader.alchemySystem.tick(currentMs + 10 * 60_000, ANY_PILL(), RESOLVE_ANY)

    expect(reader.alchemySystem.getJobs()).toHaveLength(0)
  })
})

describe('r29 COR - sibling ungated-clock seams (E) - finding F1', () => {
  function decomposeWithOre() {
    const bag = new MaterialBag()
    const ore = materials.find((m) => /_ore_/.test(m.id))!
    bag.add(ore, 10_000)
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs,
        started: true,
      },
      currentMs,
    )
    return { system, bag, oreId: ore.id }
  }

  it('E1 decompose.tick(NaN) zero-advances - no mint, nextCycleAt stays finite (r29-F1 guard)', () => {
    const { system, bag, oreId } = decomposeWithOre()
    const oreBefore = bag.getAll().find((s) => s.material.id === oreId)!.amount

    system.tick(Number.NaN)
    system.tick(1e300)

    // deny-direction: nothing minted, nothing poisoned
    expect(system.drainOutput()).toHaveLength(0)
    expect(bag.getAll().find((s) => s.material.id === oreId)!.amount).toBe(oreBefore)
    expect(system.getSaveState().nextCycleAt).toBe(currentMs)

    const save = validWireSave() as unknown as Record<string, unknown>
    save['decompose'] = system.getSaveState()
    const shape = validateGameSaveShape(save as never)
    expect(shape.ok).toBe(true)
  })

  it('E2 decompose.restore(state, NaN) merges the deadline verbatim - no poison, no re-anchor (r29-F1)', () => {
    const { system } = decomposeWithOre()

    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 30_000,
        started: true,
      },
      Number.NaN,
    )

    const state = system.getSaveState()
    // verbatim merge under a broken clock: the restored stamp stands
    // (max(live, restored)) - parked, deny direction, still write-clean
    expect(state.nextCycleAt).toBe(currentMs + 30_000)
    const save = validWireSave() as unknown as Record<string, unknown>
    save['decompose'] = state
    expect(validateGameSaveShape(save as never).ok).toBe(true)
  })

  it('E3 decompose.settleOffline(+Infinity, since) zero-settles under a broken clock (r29-F1)', () => {
    const { system } = decomposeWithOre()

    const settled = system.settleOffline(Number.POSITIVE_INFINITY, currentMs)

    expect(settled).toBe(0)
    expect(system.drainOutput().length).toBe(0)
    expect(system.getSaveState().nextCycleAt).toBe(currentMs)
  })

  it('E4 questManager.restore(state, NaN) keeps the marker verbatim - finite, write-clean (r29-F1)', () => {
    const manager = new QuestManager()

    manager.restore(
      {
        active: [],
        completedOnceIds: [],
        lastDailyResetAtMs: currentMs,
        questFlags: [],
      },
      Number.NaN,
    )

    expect(manager.getState().lastDailyResetAtMs).toBe(currentMs)
    const save = validWireSave() as unknown as Record<string, unknown>
    save['quests'] = manager.getState()
    const shape = validateGameSaveShape(save as never)
    expect(shape.ok).toBe(true)
  })

  it('E5 tribulation.restoreRuntime(slice, NaN) keeps the restored cooldown verbatim (r29-F1 deny)', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })

    director.restoreRuntime({ cooldownUntil: currentMs + 5000 }, Number.NaN)

    // verbatim under a broken clock: the cooldown stands (deny - no
    // free retry), and it persists normally
    expect(director.getCooldownSeconds(currentMs)).toBeCloseTo(5, 0)
    expect(director.getCooldownSeconds(currentMs) > 0).toBe(true)
    expect(director.serializeRuntime().cooldownUntil).toBe(currentMs + 5000)
  })

  it('E6 alchemy.restoreJobs(jobs, -Infinity) restores verbatim - post-dated job stays parked (r29-F1 deny)', () => {
    const reader = registeredManager()
    const { job, span } = mortalJob(currentMs + 60_000, 'neg_inf')

    reader.alchemySystem.restoreJobs([job], Number.NEGATIVE_INFINITY)
    const restored = reader.alchemySystem.getJobs()[0]!
    // no re-anchor under a broken clock - the pair keeps its stamps
    expect(restored.startedAtMs).toBe(currentMs + 60_000)
    expect(restored.completesAtMs).toBe(currentMs + 60_000 + span)

    // and it is NOT due on the next honest tick (parked - deny)
    reader.alchemySystem.tick(currentMs, ANY_PILL(), RESOLVE_ANY)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
  })
})

describe('r29 COR - regression pins on honest shapes (F)', () => {
  it('F1 honest in-flight job restores verbatim - digest unchanged, stamps unchanged', () => {
    const { job } = mortalJob(currentMs - 60_000, 'reg1')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.startedAtMs).toBe(currentMs - 60_000)
    expect(restored.reservation!.digest).toBe(writerDigest)
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBeNull()
  })

  it('F2 a valid writer save still validates clean - no false positive from the new cap walks', () => {
    const shape = validateGameSaveShape(validWireSave())
    expect(shape.ok).toBe(true)
    expect(shape.issues).toHaveLength(0)
  })

  it('F3 decompose.tick under honest clock mints exactly one cycle and re-anchors finite', () => {
    const bag = new MaterialBag()
    const ore = materials.find((m) => /_ore_/.test(m.id))!
    bag.add(ore, 10)
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(2)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs,
        started: true,
      },
      currentMs,
    )

    system.tick(currentMs + 30_000)

    expect(system.drainOutput().length).toBe(1)
    const state = system.getSaveState()
    expect(Number.isFinite(state.nextCycleAt)).toBe(true)
    expect(state.nextCycleAt).toBe(currentMs + 60_000)
  })
})
