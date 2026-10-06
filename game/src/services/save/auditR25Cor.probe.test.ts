// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { QuestManager } from '../../core/quest/QuestManager'
import { QuestRegistry } from '../../core/quest/QuestRegistry'
import { QuestSystem } from '../../core/quest/QuestSystem'
import { QUESTS } from '../../data/quest/quests'
import { restoreAuthorityNowMs, sanitizeRestoreAuthority } from './saveTypes'
import type { GameSave, RestoreTimeAuthority } from './saveTypes'
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

// ============================================================================
// QA probe - fixpoint r25 COR wave. Audits the r24 adjudication batch
// (2a3f95a9) and the sibling surfaces its classes touch:
//
//   (A) R25-COR-1 FIXED: sanitizeRestoreAuthority degrades a
//       PRESENT-but-corrupt authority to zero-accrual live-replacement,
//       and under remote-authoritative an absent serverTimeUtc
//       (unparseable/dropped field collapsing serverAuthority to
//       undefined at both producers) now mints the same deny primitive
//       upstream instead of routing to the client window over the
//       payload's editable lastSavedAt. Probes pin the seam delta and
//       the upstream guard collapse (mirrored one-to-one - the helpers
//       are module-private).
//   (S) settleNowMs' third clamp (Date.now()) - redundant on the absent
//       arm (authorityNowMs already resolves Date.now()), real on the
//       forward-skewed cold-boot arm: dues in (now, untilMs] defer to the
//       next live tick instead of seeding persisted stamps past the next
//       lastSavedAt (r24-INT-01). Rewound-clock input collapses the
//       window deny-side only.
//   (Q) ID_COLLECTION_CAP=1024 on every player-owned id collection -
//       quest lists, the requireArray'd id arrays, and the Record key
//       maps (nodeLevels/nodeOneShotGrants/perfectClearSeconds). The
//       authored rosters are all small, so no honest save approaches
//       the cap; R25-COR-3's uncapped sibling lists are bounded by the
//       same constant now.
//   (D) quests.lastDailyResetAtMs - persisted day-bucket marker under
//       client clock (r16-INT-04 adjudicated the epoch); a crafted-past
//       stamp survives admission (|x| < 2^52, not <= lastSavedAt) and
//       fires the daily reset early. Dormant today: the authored roster
//       has zero 'daily' quests, so the reset clears nothing.
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000

let currentMs = 1_725_160_000_000

function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 1,
    baseStats: {},
    modifiers: [],
    externalModifiers: [],
    spiritStone: 0,
    selectedTalentIds: [],
    hasSeenTutorial: false,
    totalCultivationGained: 0,
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    nodeLevels: {},
    purchasedNodeIds: [],
    completedStageIds: [],
    bodyProgression: {
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
    },
    physiqueGrade: 'pham',
    breakthroughGrade: 6,
    grantedRealmPassiveIds: [],
    persistentTimedEffects: [],
    refinementPoints: 100,
    lastRefinementRegenAtMs: currentMs,
    lastSavedAt: currentMs,
  }

  return { player: { ...base, ...playerOverrides } } as unknown as GameSave
}

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

/** Mirrors SupabaseCloudSaveService.ts:138-145 verbatim - the helper is
 *  module-private, so the probe replicates the guard to pin what the two
 *  serverAuthority producers actually receive. */
function parseTimestampMsMirror(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

/** Mirrors the SAVE_READY arm (SupabaseCloudSaveService.ts:765-776): an
 *  absent or unparseable serverTimeUtc collapses the WHOLE authority to
 *  undefined, not just the stamp. */
function serverAuthorityFor(serverTimeUtc: unknown): { serverNowMs: number } | undefined {
  const serverNowMs = parseTimestampMsMirror(serverTimeUtc)
  return serverNowMs === undefined ? undefined : { serverNowMs }
}

/** Mirrors useAppLifecycle.ts:458-477 post-fix: remoteAuthoritative +
 *  absent serverAuthority -> live-replacement deny primitive (never
 *  the legacy client window). */
function timeAuthorityFor(remoteAuthoritative: boolean, serverAuthority: { serverNowMs: number } | undefined): RestoreTimeAuthority | undefined {
  return !remoteAuthoritative
    ? undefined
    : serverAuthority !== undefined
      ? { kind: 'cold-boot', sinceMs: serverAuthority.serverNowMs - DAY_MS, untilMs: serverAuthority.serverNowMs }
      : { kind: 'live-replacement', nowMs: Date.now() }
}

describe('auditR25 COR probe - absent-authority arm under remote (R25-COR-1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('A1 absent authority pays the payload-marker client window - the deny live-replacement enforces is strictly weaker upstream', () => {
    // lastSavedAt is a payload field the bypassing writer controls
    // outright; a crafted -10d marker is admission-clean (probe A3).
    const craftedLastSavedAt = currentMs - 10 * DAY_MS

    const absent = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: craftedLastSavedAt }),
      undefined,
    )
    // The absent arm pays min(now - marker, 24h) - a full day of
    // cultivation over a marker nobody authoritative vouched for.
    expect(absent.elapsedSeconds).toBe(86400)
    expect(absent.cultivation).toBeGreaterThan(0)

    setActivePinia(createPinia())
    const denied = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: craftedLastSavedAt }),
      { kind: 'live-replacement', nowMs: currentMs },
    )
    expect(denied.elapsedSeconds).toBe(0)
    expect(denied.cultivation).toBe(0)

    setActivePinia(createPinia())
    const bounded = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: craftedLastSavedAt }),
      { kind: 'cold-boot', sinceMs: currentMs - 3600_000, untilMs: currentMs },
    )
    expect(bounded.elapsedSeconds).toBe(3600)

    // The sanitize boundary itself: `undefined` is the ONLY input that
    // routes to the client window - every present authority (corrupt or
    // honest) is denied or server-bounded since r24.
    expect(sanitizeRestoreAuthority(undefined)).toBeUndefined()
  })

  it('A2 end-to-end: the marker alone decides whether a queued pill pays - undefined vs live-replacement on the same save', () => {
    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
    expect(recipe).toBeDefined()
    const variant = recipe.herbVariants.find((v) => v.age === 'myriad_year')!
    const lastSavedAt = currentMs - 10 * DAY_MS

    const run = (authority: RestoreTimeAuthority | undefined) => {
      const writer = registeredManager()
      const writerPlayer = createDefaultPlayer()
      writer.setActivePlayer(writerPlayer)
      primeMortalCreationPick(writerPlayer, writer.skillManager)
      writer.buildingManager.add({
        instanceId: 'b-pill',
        buildingId: 'pill_room',
        level: 1,
        lastCollectedAt: 0,
      })
      writer.alchemySystem.restoreJobs([
        alchemyJobFixture(
          {
            jobId: 'r25_cor_a2',
            recipeId: recipe.id,
            pillId: recipe.pillId,
            herbMaterialId: variant.materialId,
            startedAtMs: lastSavedAt - 60_000,
            completesAtMs: lastSavedAt + 30 * 60_000,
            roomLevelAtStart: 1,
          },
          undefined,
          recipe,
        ),
      ])
      const save = buildGameSave(writerPlayer, writer)
      save.player.lastSavedAt = lastSavedAt

      const manager = registeredManager()
      manager.setActivePlayer(createDefaultPlayer())
      manager.saveOps.restoreFromSave(save, authority)
      return {
        jobs: manager.alchemySystem.getJobs().length,
        events: manager.alchemySystem.drainSettlementEvents(),
      }
    }

    // Absent authority: elapsed 86400 > 60 runs the gated settles with
    // settleNowMs = marker + 24h - the job due 30min after the marker
    // is inside the marker-positioned window and pays out.
    const absent = run(undefined)
    expect(absent.jobs).toBe(0)
    expect(absent.events.length).toBeGreaterThan(0)

    // Live-replacement on the SAME payload: zero-accrual - the identical
    // job survives unsettled. The difference between grant and deny is
    // entirely `serverAuthority === undefined` upstream.
    const denied = run({ kind: 'live-replacement', nowMs: currentMs })
    expect(denied.jobs).toBe(1)
    expect(denied.events).toHaveLength(0)
  })

  it('A3 the crafted marker is admission-clean: deep-past lastSavedAt passes validateGameSaveShape', () => {
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    const save = buildGameSave(writerPlayer, writer)

    const wire = JSON.parse(JSON.stringify(save)) as GameSave
    wire.player.lastSavedAt = currentMs - 10 * DAY_MS

    const shape = validateGameSaveShape(wire)
    expect(shape.ok).toBe(true)
    expect(shape.issues.filter((issue) => issue.path.includes('lastSavedAt'))).toHaveLength(0)
  })

  it('A4 the service arm: absent or unparseable serverTimeUtc now degrades to live-replacement - the A1 grant is closed (R25-COR-1 fixed)', () => {
    // Honest Postgres timestamptz text parses (both space-separated and
    // ISO-T forms, +/-HH and +/-HH:mm offsets).
    expect(serverAuthorityFor('2025-08-30 12:26:40.123456+00')).toBeDefined()
    expect(serverAuthorityFor('2025-08-30T12:26:40.123456+00:00')).toBeDefined()

    // The malformed set - field dropped by contract drift, null, wrong
    // type, empty, or a string Date.parse cannot read. Every one of
    // these still yields serverAuthority === undefined, but upstream
    // now degrades to the zero-accrual deny primitive instead of the
    // client-window absent arm.
    for (const malformed of [undefined, null, 0, '', 'garbage', 'soon(tm)', '2025-13-45T99:99:99Z']) {
      expect(serverAuthorityFor(malformed)).toBeUndefined()
      expect(timeAuthorityFor(true, serverAuthorityFor(malformed))).toEqual({
        kind: 'live-replacement',
        nowMs: currentMs,
      })
    }

    // The degraded authority pays nothing: a malformed response under
    // remote-authoritative can no longer reach the A1 client window.
    const deniedAuthority = timeAuthorityFor(true, serverAuthorityFor('garbage'))
    const denied = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: currentMs - 10 * DAY_MS }),
      deniedAuthority,
    )
    expect(denied.elapsedSeconds).toBe(0)
  })
})

describe('auditR25 COR probe - settleNowMs third clamp (R25-COR-2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('S1 forward-skewed cold-boot: dues inside (now, untilMs] defer to the live tick instead of settling early', () => {
    // Server clock 1h ahead of the client: the approved window covers
    // [since, until] = now-2h .. now+1h. settleNowMs must clamp at
    // Date.now() so persisted heads never outrun the next lastSavedAt.
    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
    const variant = recipe.herbVariants.find((v) => v.age === 'myriad_year')!
    const lastSavedAt = currentMs - 2 * 3600_000

    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    writer.buildingManager.add({
      instanceId: 'b-pill',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })
    // Job due 30min INSIDE the skew window (now < due <= until).
    writer.alchemySystem.restoreJobs([
      alchemyJobFixture(
        {
          jobId: 'r25_cor_s1',
          recipeId: recipe.id,
          pillId: recipe.pillId,
          herbMaterialId: variant.materialId,
          startedAtMs: lastSavedAt - 60_000,
          completesAtMs: currentMs + 30 * 60_000,
          roomLevelAtStart: 1,
        },
        undefined,
        recipe,
      ),
    ])
    const save = buildGameSave(writerPlayer, writer)
    save.player.lastSavedAt = lastSavedAt

    const manager = registeredManager()
    manager.setActivePlayer(createDefaultPlayer())
    manager.saveOps.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs + 3600_000,
    })

    // Post-r24 clamp: the skew-window job survives pending - the live
    // tick pays it at its real deadline (defer, not loss).
    expect(manager.alchemySystem.getJobs().length).toBe(1)
    expect(manager.alchemySystem.drainSettlementEvents()).toHaveLength(0)

    // The elapsed-driven channel still pays the FULL approved span
    // (10800s) - the clamp moved the persist-epoch bound, not the grant.
    setActivePinia(createPinia())
    const bounded = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt }),
      { kind: 'cold-boot', sinceMs: lastSavedAt, untilMs: currentMs + 3600_000 },
    )
    expect(bounded.elapsedSeconds).toBe(10800)
    expect(bounded.cultivation).toBeGreaterThan(0)
  })

  it('S2 the third operand is redundant on the absent arm, and a rewound client clock only collapses to zero-width (deny)', () => {
    // authorityNowMs for an absent authority IS Date.now() - the third
    // Math.min operand can never tighten it (same clock, later call).
    expect(restoreAuthorityNowMs(undefined)).toBe(currentMs)
    expect(restoreAuthorityNowMs({ kind: 'live-replacement', nowMs: 1 })).toBe(1)
    expect(restoreAuthorityNowMs({ kind: 'cold-boot', sinceMs: 0, untilMs: 7 })).toBe(7)

    // Client clock rewound behind the save marker: elapsed clamps to 0
    // and settleNowMs = now < lastSavedAt - pure deny, no negative pay.
    const honestSave = buildMinimalSave({ lastSavedAt: currentMs })
    currentMs -= 3600_000
    const rewound = usePlayerStore().restoreFromSave(honestSave, undefined)
    expect(rewound.elapsedSeconds).toBe(0)
    expect(rewound.cultivation).toBe(0)
  })
})

describe('auditR25 COR probe - quest cap and sibling lists (R25-COR-3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function realSave(mutate: (wire: Record<string, unknown>) => void): Record<string, unknown> {
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    const save = buildGameSave(writerPlayer, writer)
    const wire = JSON.parse(JSON.stringify(save)) as Record<string, unknown>
    mutate(wire)
    return wire
  }

  it('Q1 the cap rejects crafted quest lists: 1025-entry active/completedOnceIds/questFlags all fail', () => {
    const activeOverflow = realSave((wire) => {
      ;(wire as { quests?: unknown }).quests = {
        active: Array.from({ length: 1025 }, (_, i) => ({
          questId: `craft_${i}`,
          progress: 0,
          claimed: false,
        })),
        completedOnceIds: [],
        lastDailyResetAtMs: currentMs,
      }
    })
    const activeResult = validateGameSaveShape(activeOverflow)
    expect(activeResult.ok).toBe(false)
    expect(activeResult.issues.some((issue) => issue.path === '.quests.active')).toBe(true)

    const onceOverflow = realSave((wire) => {
      ;(wire as { quests?: unknown }).quests = {
        active: [],
        completedOnceIds: Array.from({ length: 1025 }, (_, i) => `craft_${i}`),
        lastDailyResetAtMs: currentMs,
      }
    })
    const onceResult = validateGameSaveShape(onceOverflow)
    expect(onceResult.ok).toBe(false)
    expect(onceResult.issues.some((issue) => issue.path === '.quests.completedOnceIds')).toBe(true)

    const flagsOverflow = realSave((wire) => {
      ;(wire as { quests?: unknown }).quests = {
        active: [],
        completedOnceIds: [],
        questFlags: Array.from({ length: 1025 }, (_, i) => `flag_${i}`),
        lastDailyResetAtMs: currentMs,
      }
    })
    const flagsResult = validateGameSaveShape(flagsOverflow)
    expect(flagsResult.ok).toBe(false)
    expect(flagsResult.issues.some((issue) => issue.path === '.quests.questFlags')).toBe(true)
  })

  it('Q2 honest saves can never reach 1024: the whole authored roster (21 quests) validates clean', () => {
    expect(QUESTS.length).toBe(21)
    const honest = realSave((wire) => {
      ;(wire as { quests?: unknown }).quests = {
        active: QUESTS.map((quest) => ({ questId: quest.id, progress: 0, claimed: false })),
        completedOnceIds: QUESTS.map((quest) => quest.id),
        questFlags: ['flag_a'],
        lastDailyResetAtMs: currentMs,
      }
    })
    const result = validateGameSaveShape(honest)
    expect(result.ok).toBe(true)
    expect(result.issues.filter((issue) => issue.path.startsWith('.quests'))).toHaveLength(0)
  })

  it('Q3 sibling lists are now capped too: 2048 crafted entries on the stage/node id lists fail admission (R25-COR-3 fixed)', () => {
    const padded = realSave((wire) => {
      const player = wire.player as Record<string, unknown>
      const craftedStageIds = Array.from({ length: 2048 }, (_, i) => `craft_stage_${i}`)
      const craftedNodeIds = Array.from({ length: 2048 }, (_, i) => `craft_node_${i}`)
      player.completedStageIds = craftedStageIds
      player.perfectClearStageIds = craftedStageIds
      player.purchasedNodeIds = [...(player.purchasedNodeIds as string[]), ...craftedNodeIds]
      player.nodeLevels = {
        ...(player.nodeLevels as Record<string, number>),
        ...Object.fromEntries(craftedNodeIds.map((id) => [id, 1])),
      }
    })
    const result = validateGameSaveShape(padded)
    // ID_COLLECTION_CAP closes the wedge uniformly: requireArray and
    // the Record key walks all bound at 1024, so every padded list
    // fails on its own path.
    expect(result.issues.some((issue) => issue.path.includes('completedStageIds'))).toBe(true)
    expect(result.issues.some((issue) => issue.path.includes('perfectClearStageIds'))).toBe(true)
    expect(result.issues.some((issue) => issue.path.includes('purchasedNodeIds'))).toBe(true)
    expect(result.issues.some((issue) => issue.path.includes('nodeLevels'))).toBe(true)
    expect(result.ok).toBe(false)
  })
})

describe('auditR25 COR probe - quest day-bucket marker (R25-COR-4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D1 a crafted-past lastDailyResetAtMs survives admission and restore, then fires an early daily reset', () => {
    const craftedStamp = currentMs - 10 * DAY_MS

    // Admission: only |x| < 2^52 bounds the stamp - no <= lastSavedAt pin.
    const wire = (() => {
      const writer = registeredManager()
      const writerPlayer = createDefaultPlayer()
      writer.setActivePlayer(writerPlayer)
      primeMortalCreationPick(writerPlayer, writer.skillManager)
      const save = buildGameSave(writerPlayer, writer)
      const parsed = JSON.parse(JSON.stringify(save)) as Record<string, unknown>
      ;(parsed as { quests?: unknown }).quests = {
        active: [],
        completedOnceIds: [],
        lastDailyResetAtMs: craftedStamp,
      }
      return parsed
    })()
    const shape = validateGameSaveShape(wire)
    expect(shape.issues.filter((issue) => issue.path.includes('lastDailyResetAtMs'))).toHaveLength(0)

    // Restore clamps only the FUTURE direction (min(stamp, now)) - the
    // crafted past stamp is preserved verbatim.
    const manager = new QuestManager()
    manager.restore(
      {
        active: [],
        completedOnceIds: [],
        lastDailyResetAtMs: craftedStamp,
      },
      currentMs,
    )
    expect(manager.getLastDailyResetAtMs()).toBe(craftedStamp)

    // The day-bucket comparison then fires the reset: a save-edited
    // stamp earns the same early reset a forward client clock would.
    const registry = new QuestRegistry()
    for (const quest of QUESTS) registry.register(quest)
    const system = new QuestSystem()
    const fired = system.checkAndResetDaily(registry, manager, createDefaultPlayer(), currentMs)
    expect(fired).toBe(true)
    expect(manager.getLastDailyResetAtMs()).toBe(currentMs)

    // Dormant arm today: every authored quest is 'once', so the reset
    // cleared no re-earnable daily board (severity Nit while the roster
    // stays daily-free).
    expect(QUESTS.some((quest) => quest.cadence === 'daily')).toBe(false)
    expect(manager.getActive()).toHaveLength(0)
  })
})
