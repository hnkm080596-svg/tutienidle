// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { sanitizeRestoreAuthority } from './saveTypes'
import type { RestoreTimeAuthority } from './saveTypes'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { REWARD_TABLE_VERSION } from '../../core/production/ProductionCycles'
import { MAX_STACK_AMOUNT } from '../../core/inventory/StackLimits'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type { CloudSaveService } from '../cloudSave/CloudSaveService'

// ============================================================================
// QA probe - fixpoint r25 AUT wave (audit of commit 2a3f95a9, the r24
// adjudication batch: sanitizeRestoreAuthority degrades a PRESENT-but-corrupt
// authority to zero-accrual live-replacement; settleNowMs gains a Date.now()
// clamp; validateQuestSave gains QUEST_LIST_CAP=1024).
//
// Attack arms under test:
//   A. Degraded {live-replacement, Date.now()} - does any channel still mint?
//   B. The Date.now() settle clamp - does the window START (offlineSinceMs)
//      stay clamped enough that persisted stamps can't outrun the next
//      save's own lastSavedAt pin? (R24-INT-01 sibling arms)
//      POST-R25: offlineSinceMs / effectProvenanceMs / appliedAtMs all
//      clamp at Date.now(), and the CloudSaveCoordinator.driveSave gate
//      refuses a payload that fails admission BEFORE it reaches the
//      service - the self-brick class is closed at both ends.
//   C. ID_COLLECTION_CAP - ordering, per-entry cost, and the sibling
//      collections now under the same cap (materials 2048 denies).
//   D. Stamp classes vs the |x| < 2^52 domain check (-0, fractional,
//      object-coercible); an UNKNOWN kind now degrades to live-
//      replacement (R25-AUT-4 whitelist).
// ============================================================================

const NOW = 1_725_160_000_000
const TWO_POW_52 = 2 ** 52
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerBuildings(buildings)
  return manager
}

function makeSave(
  overrides: {
    lastSavedAt?: number
    autoFarmStage?: { stageId: string; lastCheckedMs: number } | null
    autoWorkerCapacity?: number
    productionSites?: GameSave['productionSites']
    materials?: GameSave['materials']
    quests?: GameSave['quests']
  } = {},
): GameSave {
  const manager = registeredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  player.cultivation = 0
  player.cultivationPerSecond = 1
  if (overrides.autoFarmStage !== undefined) {
    player.autoFarmStage = overrides.autoFarmStage
  }
  if (overrides.autoWorkerCapacity !== undefined) {
    player.autoWorkerCapacity = overrides.autoWorkerCapacity
  }
  const save = buildGameSave(player, manager)
  save.player.lastSavedAt = overrides.lastSavedAt ?? NOW
  if (overrides.productionSites !== undefined) {
    save.productionSites = overrides.productionSites
  }
  if (overrides.materials !== undefined) {
    save.materials = overrides.materials
  }
  if (overrides.quests !== undefined) {
    save.quests = overrides.quests
  }
  if (overrides.autoWorkerCapacity !== undefined && overrides.autoWorkerCapacity > 0) {
    // F-W-16: a non-zero persisted capacity requires the chi_hien_quan
    // building witness in the same payload.
    save.buildings = [
      {
        instanceId: 'r25_chq',
        buildingId: 'chi_hien_quan',
        level: 1,
        lastCollectedAt: 0,
      },
    ]
  }
  return save
}

function workerCycleSave(startedAtMs: number): NonNullable<
  NonNullable<GameSave['productionSites']>[number]['workerCycles']
>[number] {
  const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM['mortal']
  if (baseSeconds === undefined) throw new Error('mortal cycle base missing')
  const spanMs = computeCycleSeconds(baseSeconds, 1) * 1000
  return {
    cycleId: 'r25-forged-head',
    siteId: 'thanh_van_lam',
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: REWARD_TABLE_VERSION,
    rollSeed: 42,
    startedAtMs,
    completesAtMs: startedAtMs + spanMs,
  }
}

// ---------------------------------------------------------------------------
describe('arm A - degraded zero-accrual authority reaches no paying channel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('corrupt authority + armed farm + production site: cultivation/autofarm/production/decompose all silent; alchemy cursor = payload marker', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({
      lastSavedAt: NOW - 48 * HOUR_MS,
      autoFarmStage: { stageId: 'thanh_van_farm_1', lastCheckedMs: NOW - 48 * HOUR_MS },
      autoWorkerCapacity: 3,
      productionSites: [{ siteId: 'thanh_van_lam', level: 1, autoRestart: true }],
    })
    const farmSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const productionSpy = vi.spyOn(manager.productionSystem, 'settleOffline')
    const decomposeSpy = vi.spyOn(manager.decomposeSystem, 'settleOffline')
    const alchemySpy = vi.spyOn(manager.alchemySystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 48 * HOUR_MS,
      untilMs: Number.POSITIVE_INFINITY, // corrupt -> zero-accrual degrade
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    expect(result.offline.elapsedSeconds).toBe(0)
    expect(result.offline.cultivation).toBe(0)
    // elapsed 0 <= 60 gate: production + decompose settles never run.
    expect(productionSpy).not.toHaveBeenCalled()
    expect(decomposeSpy).not.toHaveBeenCalled()
    // The armed farm is re-anchored with elapsed 0 (never a paying call).
    expect(farmSpy).toHaveBeenCalledWith(expect.objectContaining({}), 0)
    // Unconditional alchemy settle sees the payload marker as its cursor:
    // dues strictly inside (lastSavedAt, now] do NOT deliver - tighter
    // than the absent-authority window (which pays dues up to now).
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW - 48 * HOUR_MS,
      0,
      expect.any(Number),
      expect.any(Function),
    )
  })

  it('same payload: absent authority pays the client window while the degraded authority pays zero - degraded is strictly tighter', () => {
    const craftPayload = () =>
      makeSave({
        lastSavedAt: NOW - 48 * HOUR_MS,
        autoFarmStage: { stageId: 'thanh_van_farm_1', lastCheckedMs: NOW - 48 * HOUR_MS },
      })

    const absentPlayer = usePlayerStore()
    const absentManager = registeredManager()
    absentManager.setActivePlayer(absentPlayer.$state)
    const absentResult = restoreGameSession(absentPlayer, absentManager, craftPayload(), undefined)
    expect(absentResult.status).toBe('ok')
    if (absentResult.status !== 'ok') throw new Error(absentResult.message)
    expect(absentResult.offline.elapsedSeconds).toBe(86_400) // 24h cap on a 48h client window
    expect(absentResult.offline.cultivation).toBeGreaterThan(0)

    setActivePinia(createPinia())
    const degradedPlayer = usePlayerStore()
    const degradedManager = registeredManager()
    degradedManager.setActivePlayer(degradedPlayer.$state)
    const degradedResult = restoreGameSession(degradedPlayer, degradedManager, craftPayload(), {
      kind: 'live-replacement',
      nowMs: TWO_POW_52, // corrupt -> degraded zero-accrual anchor
    })
    expect(degradedResult.status).toBe('ok')
    if (degradedResult.status !== 'ok') throw new Error(degradedResult.message)
    expect(degradedResult.offline.elapsedSeconds).toBe(0)
    expect(degradedResult.offline.cultivation).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('arm B - window START is not Date.now()-clamped (R24-INT-01 residual)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('R25-AUT-1 FIXED: future marker + wholly-future cold-boot still pays the approved span but lane heads clamp at Date.now() -> the next save validates', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    // Both adversarial inputs stay in-domain: a future-dated payload
    // marker AND a cold-boot window wholly in the future
    // (elapsed = 600s > 60 fires the settle gate).
    const FUTURE = NOW + DAY_MS
    const save = makeSave({
      lastSavedAt: FUTURE,
      autoWorkerCapacity: 3,
      productionSites: [{ siteId: 'thanh_van_lam', level: 1, autoRestart: true }],
    })
    expect(validateGameSaveShape(save).ok).toBe(true)

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: FUTURE,
      untilMs: FUTURE + 600_000, // honored in-domain window, wholly future
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // The store still pays the approved 600s span (window semantics
    // unchanged - the fix only pins the persisted stamp epoch).
    expect(result.offline.elapsedSeconds).toBe(600)

    const repackaged = buildGameSave(player.$state, manager)
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    expect(heads.length).toBeGreaterThan(0)
    // FIXED: offlineSinceMs clamps at Date.now() = NOW, so seeded heads
    // can never outrun the next save's own lastSavedAt pin.
    expect(heads.every((cycle) => cycle.startedAtMs <= NOW)).toBe(true)

    // The game's own write re-validates - the self-brick arm is closed.
    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(true)
  })

  it("R25-AUT-2 CLOSED BY GATE: the admission pin still compares to the payload's own marker, but the write-side gate refuses the self-failing write", async () => {
    const FUTURE = NOW + DAY_MS
    const save = makeSave({
      lastSavedAt: FUTURE,
      autoWorkerCapacity: 3, // lifts the authored lane ceiling so a crafted lane admits
      productionSites: [
        {
          siteId: 'thanh_van_lam',
          level: 1,
          autoRestart: true,
          workerCycles: [workerCycleSave(NOW + 60_000)], // future, but <= FUTURE marker
        },
      ],
    })
    // Admission passes: startedAtMs (NOW+60s) <= lastSavedAt (NOW+24h).
    // Deadline channels restore verbatim - real deadlines are preserved.
    expect(validateGameSaveShape(save).ok).toBe(true)

    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    // ABSENT authority: elapsed = max(0, now - future) = 0 -> no settle,
    // lanes persist verbatim.
    const result = restoreGameSession(player, manager, save, undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    const repackaged = buildGameSave(player.$state, manager)
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    expect(heads.some((cycle) => cycle.startedAtMs > NOW)).toBe(true)
    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(false)

    // R25-AUT-2 fixed by the write-side gate: the self-failing payload
    // is refused inside driveSave before the service ever sees it - the
    // healthy slot survives on both tiers (the INT probe pins the same
    // gate on the coordinator seam).
    let serviceSawSave = false
    const service: CloudSaveService = {
      capability: 'local-only',
      async load() {
        return { status: 'empty', revision: 0 }
      },
      async save(_save, expectedRevision) {
        serviceSawSave = true
        return { status: 'ok', revision: expectedRevision + 1 }
      },
    }
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    const writeResult = await coordinator.save(repackaged)
    expect(writeResult.status).toBe('unavailable')
    if (writeResult.status === 'unavailable') {
      expect(writeResult.detail).toBe('OUTGOING_ADMISSION_REJECTED')
    }
    expect(serviceSawSave).toBe(false)
  }) 

  it('deny-side complement: a fully-past approved window keeps settleNowMs <= now and the round-trip re-validates', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({
      lastSavedAt: NOW,
      autoWorkerCapacity: 3,
      productionSites: [{ siteId: 'thanh_van_lam', level: 1, autoRestart: true }],
    })
    const productionSpy = vi.spyOn(manager.productionSystem, 'settleOffline')
    const alchemySpy = vi.spyOn(manager.alchemySystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 2 * HOUR_MS,
      untilMs: NOW - HOUR_MS, // honored window wholly in the past
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // settleNowMs = min(lastSavedAt + elapsed, untilMs, now) = untilMs -
    // the clamp denies post-approval dues on the unconditional seams too.
    expect(productionSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(String),
      NOW - HOUR_MS,
      expect.objectContaining({ offlineSinceMs: NOW - 2 * HOUR_MS }),
    )
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW - HOUR_MS,
      0,
      expect.any(Number),
      expect.any(Function),
    )

    const repackaged = buildGameSave(player.$state, manager)
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    for (const cycle of heads) {
      expect(cycle.startedAtMs).toBeLessThanOrEqual(NOW)
      expect(Math.abs(cycle.startedAtMs)).toBeLessThan(TWO_POW_52)
    }
    expect(validateGameSaveShape(repackaged).ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('arm C - QUEST_LIST_CAP and sibling collections', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cap boundary: 1024 entries admit, 1025 deny on active/completedOnceIds/questFlags', () => {
    const baseQuests = () => ({
      active: [] as { questId: string; progress: number; claimed: boolean }[],
      completedOnceIds: [] as string[],
      questFlags: [] as string[],
      lastDailyResetAtMs: NOW,
    })

    const underCap = baseQuests()
    underCap.completedOnceIds = Array.from({ length: 1024 }, (_, i) => `q_${i}`)
    underCap.questFlags = Array.from({ length: 1024 }, (_, i) => `f_${i}`)
    const saveUnder = makeSave({ quests: underCap })
    expect(validateGameSaveShape(saveUnder).ok).toBe(true)

    const overCapIds = baseQuests()
    overCapIds.completedOnceIds = Array.from({ length: 1025 }, (_, i) => `q_${i}`)
    const saveOverIds = makeSave({ quests: overCapIds })
    const shapeOverIds = validateGameSaveShape(saveOverIds)
    expect(shapeOverIds.ok).toBe(false)
    expect(shapeOverIds.issues.some((i) => i.path.includes('completedOnceIds'))).toBe(true)

    const overCapFlags = baseQuests()
    overCapFlags.questFlags = Array.from({ length: 1025 }, (_, i) => `f_${i}`)
    const saveOverFlags = makeSave({ quests: overCapFlags })
    expect(validateGameSaveShape(saveOverFlags).ok).toBe(false)

    const overCapActive = baseQuests()
    overCapActive.active = Array.from({ length: 1025 }, (_, i) => ({
      questId: `q_${i}`,
      progress: 0,
      claimed: false,
    }))
    const saveOverActive = makeSave({ quests: overCapActive })
    expect(validateGameSaveShape(saveOverActive).ok).toBe(false)
  })

  it('sibling collections now share the cap: a 2048-entry materials list fails ID_COLLECTION_CAP (R25-COR-3 fixed)', () => {
    const save = makeSave({
      materials: Array.from({ length: 2048 }, () => ({
        materialId: 'tinh_hoa_pham_the',
        amount: 1,
      })),
    })
    // ID_COLLECTION_CAP now bounds every requireArray'd list uniformly.
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('crafted stack amount over stackLimit is admitted by the gate but clamped at the bag seam (deny)', () => {
    const save = makeSave({
      materials: [{ materialId: 'tinh_hoa_pham_the', amount: 1e12 }],
    })
    // The validator has no writer-bound pin on stack amount (contrast
    // cultivation > required, which IS pinned) - admission passes.
    expect(validateGameSaveShape(save).ok).toBe(true)

    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const result = restoreGameSession(player, manager, save, undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // MaterialBag.add clamps at material.stackLimit ?? MAX_STACK_AMOUNT -
    // the crafted 1e12 never lands.
    expect(manager.materialBag.getAmount('tinh_hoa_pham_the')).toBe(MAX_STACK_AMOUNT)
  })
})

// ---------------------------------------------------------------------------
describe('stamp classes vs the |x| < 2^52 domain check', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('in-domain edge classes pass VERBATIM: -0, fractional, subnormal, and deep-past/future magnitudes', () => {
    const negZero: RestoreTimeAuthority = { kind: 'live-replacement', nowMs: -0 }
    expect(sanitizeRestoreAuthority(negZero)).toBe(negZero)

    const fractional: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: NOW - 0.5,
      untilMs: NOW + 0.5,
    }
    expect(sanitizeRestoreAuthority(fractional)).toBe(fractional)

    const subnormal: RestoreTimeAuthority = {
      kind: 'live-replacement',
      nowMs: Number.MIN_VALUE,
    }
    expect(sanitizeRestoreAuthority(subnormal)).toBe(subnormal)

    const deepPast: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: -(TWO_POW_52 - 2),
      untilMs: -(TWO_POW_52 - 1),
    }
    expect(sanitizeRestoreAuthority(deepPast)).toBe(deepPast)
  })

  it('out-of-domain and non-numeric classes fail closed to the zero-accrual anchor: strings, null, coercible objects, NaN, infinities, |x| >= 2^52', () => {
    const degrade = { kind: 'live-replacement' as const, nowMs: NOW }
    const cases: unknown[] = [
      { kind: 'live-replacement', nowMs: '1725160000000' },
      { kind: 'live-replacement', nowMs: null },
      { kind: 'live-replacement', nowMs: { valueOf: () => NOW } }, // coercible: Number.isFinite(obj) = false
      { kind: 'live-replacement', nowMs: Number.NaN },
      { kind: 'live-replacement', nowMs: Number.POSITIVE_INFINITY },
      { kind: 'live-replacement', nowMs: TWO_POW_52 },
      { kind: 'cold-boot', sinceMs: NOW, untilMs: -TWO_POW_52 },
      { kind: 'cold-boot', sinceMs: NOW - 1000, untilMs: 9e15 }, // Date.parse-reachable magnitude
    ]
    for (const value of cases) {
      expect(
        sanitizeRestoreAuthority(value as RestoreTimeAuthority),
        JSON.stringify(value),
      ).toEqual(degrade)
    }
  })

  it('FAIL-OPEN arm: an UNKNOWN kind with in-domain stamps is honored verbatim and falls through to the client-clock elapsed branch', () => {
    // kind is client-constructed today, so this needs a hypothetical
    // future caller passing a raw server-shaped record - but the
    // sanitizer's contract is fail-closed and this arm is not.
    const rogue = {
      kind: 'server-approved', // unknown kind, valid stamp
      nowMs: NOW - 300_000,
    } as unknown as RestoreTimeAuthority

    // FIXED: the kind whitelist degrades an unrecognized kind to the
    // zero-accrual primitive instead of honoring it verbatim.
    expect(sanitizeRestoreAuthority(rogue)).toEqual({
      kind: 'live-replacement',
      nowMs: NOW,
    })

    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 300_000 })
    const result = player.restoreFromSave(save, rogue)
    // The degraded authority pays nothing - the client-clock fall-
    // through is closed.
    expect(result.elapsedSeconds).toBe(0)
  })
})
