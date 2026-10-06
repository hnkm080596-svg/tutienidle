// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import type { GameSave } from './SaveSystem'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  settleProductionOffline,
  type ProductionOfflineDeps,
} from '../../core/production/ProductionOffline'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import type {
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import { QuestManager } from '../../core/quest/QuestManager'
import { BuildingManager } from '../../core/building/BuildingManager'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { defineEnemy } from '../../core/enemy/Enemy'
import type { Stage } from '../../core/stage/Stage'
import { pills } from '../../data/pill/pills'

// ============================================================================
// QA probe - fixpoint r23 INT wave (audit of commit da0d553d, the r22
// batch: |x| < 2^52 admission bound on every persisted timestamp,
// stackable expiry clamped at restore like siblings, stackable writer
// clamped at 2^52-1, autoWorkerCapacity <= 65536, O(1) insight drain).
//
// Integration-coherence seams probed here:
//   A) boundTimedEffectClocks (provenance + 24h, authority epoch) vs
//      payoutExpiresAtMs (lastSavedAt + 24h, payload epoch) - the two
//      restore-time clamps disagree exactly when the payload marker
//      runs AHEAD of authorityNow (crafted/broken-clock saves). The
//      divergence is one-directional (map bound <= payout bound) and
//      bounded, and the paid width still sits inside the approved
//      window - pinned as intended semantics, never the reverse.
//   B) every derived cursor downstream of an admitted stamp: the
//      far-future offlineSinceMs seed, the workerCycles far-future
//      deadline (gate-closed by the startedAtMs<=lastSavedAt + span
//      pins, deny-parked by the mechanism if injected), the autoFarm
//      lastCheckedMs re-anchor on every restore branch, the quest
//      daily-reset clamp, the seconds-domain buildings clamp, and the
//      decompose nextCycleAt rebase.
//   C) writer -> save-shape round-trip: applyTimedEffect's
//      non-stackable max-arm on an admitted 2^52-1 expiry can only
//      land inside the admitted domain - no self-rejection.
//   D) autoWorkerCapacity > 65536 AND no chi_hien_quan instance - the
//      two pins report two distinct issues on the same path.
// ============================================================================

const L = 1_760_000_000_000 // payload marker (epoch-ms scale)
const TWO_POW_52 = 2 ** 52

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000

const gameManager = new GameManager()

function validSave(): Record<string, unknown> {
  const p = createDefaultPlayer()
  p.realmId = 'qi_refining'
  p.realmLevel = 1
  p.cultivation = 0
  // realm >= qi_refining needs the initiation receipts: a derivable
  // breakthroughGrade (<= max(1, completedTiers)) and a non-empty
  // techniques[] - the validator otherwise fails the BASE save.
  p.breakthroughGrade = 1
  return {
    version: CURRENT_SAVE_VERSION,
    player: p,
    techniques: [{ id: 'thien_hoa_cong' }],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    productionSites: [],
    alchemyJobs: [],
  }
}

function tltEffect(expiresAtMs: number, appliedAtMs: number): PersistentTimedEffect {
  return {
    id: 'fx-tlt',
    sourceItemId: 'tu_linh_tran',
    appliedAtMs,
    expiresAtMs,
    effectGroup: 'tu_linh_tran',
    cultivationSpeedPercent: 0.25,
    modifiers: [],
  }
}

function makeState(
  siteId: string,
  overrides: Partial<ProductionSiteState> = {},
): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 0,
    workerCycles: [],
    ...overrides,
  }
}

function createDeps(states: Map<string, ProductionSiteState>): ProductionOfflineDeps {
  const siteDefinitions = new Map<string, ProductionSiteDefinition>(
    THANH_VAN_PRODUCTION_SITES.map((site) => [site.siteId, site]),
  )
  return {
    states,
    getSiteDefinition: (siteId) => siteDefinitions.get(siteId),
    grantCycleRewards: () => {},
  }
}

describe('fixpoint r23 INT - integration coherence probes (da0d553d)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Intentionally NOT locking the beta tables: the global setup admits
    // the full feature table, and the decompose/autoFarm probes need the
    // mechanisms live (scope-hidden surfaces idle deliberately).
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // A) dual-clamp coherence (seam a)
  // ------------------------------------------------------------------
  it('A1 marker ahead of authority: map binds provenance+24h, payout binds lastSavedAt+24h (one-directional divergence)', () => {
    const playerStore = usePlayerStore()
    // Fast-clock save restored on a corrected clock under cold-boot:
    // untilMs sits 30d BEHIND the payload marker. The 1h server window
    // is the only approved offline span.
    const untilMs = L - 30 * 86_400_000
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = L
    // 5/s folded claim: percentAtSave reads the RAW record live at
    // lastSavedAt (25%) -> unbuffed 4/s. Raw payouts stay under the
    // qi_refining L1 cultivation requirement (42000) so the reported
    // gain is not clamped by the level cap.
    p.cultivationPerSecond = 5
    p.persistentTimedEffects = [tltEffect(L + 3 * 86_400_000, L - 1_000)]
    // Live claim admits: expires <= lastSavedAt + 24h + 7d skew window.
    expect(validateGameSaveShape(save).ok).toBe(true)

    const offline = playerStore.restoreFromSave(save as unknown as GameSave, {
      kind: 'cold-boot',
      sinceMs: untilMs - 3_600_000,
      untilMs,
    })

    // Map arm: provenance = min(lastSavedAt, untilMs) = untilMs ->
    // stored expires = untilMs + 24h - dead at real-now, no forward mint.
    const stored = playerStore.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(untilMs + TU_LINH_TRAN_DURATION_MS)
    // Direction pin: the map bound never exceeds the payout bound.
    expect(stored.expiresAtMs).toBeLessThanOrEqual(L + TU_LINH_TRAN_DURATION_MS)

    // Payout arm kept the payload-epoch bound (lastSavedAt + 24h), so
    // the buff covers the WHOLE approved 1h window: unbuffed 4 x 1.25.
    // (Had payoutExpiresAtMs anchored at provenance like the map arm,
    // the record would read dead for the whole window -> 4/s = 14400.)
    expect(offline.elapsedSeconds).toBe(3_600)
    expect(offline.cultivation).toBe(5 * 3_600)

    // The map copy reads dead at restore-time now - no dead-in-payout
    // /live-in-map reversal exists, only the bounded live-in-payout.
    const live = gameManager.effectOps.getActiveTimedModifiers(
      playerStore.$state as PlayerData,
      Date.now(),
    )
    expect(live).toHaveLength(0)
  })

  it('A2 authority ahead of marker: the two bounds coincide (convergent arm)', () => {
    const playerStore = usePlayerStore()
    const untilMs = L + 7_200_000 // server 2h ahead of the marker
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = L
    p.cultivationPerSecond = 5
    p.persistentTimedEffects = [tltEffect(L + 3 * 86_400_000, L - 1_000)]

    const offline = playerStore.restoreFromSave(save as unknown as GameSave, {
      kind: 'cold-boot',
      sinceMs: L,
      untilMs,
    })

    // provenance = min(L, untilMs) = L -> both arms land on L + 24h.
    const stored = playerStore.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(L + TU_LINH_TRAN_DURATION_MS)
    expect(offline.elapsedSeconds).toBe(7_200)
    expect(offline.cultivation).toBe(5 * 7_200)
  })

  it('A3 dead-at-save record: both readers agree - payload stamp kept, zero buff coverage', () => {
    const playerStore = usePlayerStore()
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = L
    // 0.25/s keeps the raw 24h payout (21600) under the qi_refining L1
    // requirement cap (42000).
    p.cultivationPerSecond = 0.25
    p.persistentTimedEffects = [tltEffect(L - 1_000, L - 2_000)]

    const offline = playerStore.restoreFromSave(save as unknown as GameSave)

    // Dead arm: stored verbatim (already past in every epoch); the
    // payout window [L, L + 24h-capped] sees the record dead at its own
    // start -> unbuffed rate for the whole capped window.
    const stored = playerStore.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(L - 1_000)
    expect(offline.elapsedSeconds).toBe(86_400)
    expect(offline.cultivation).toBe(0.25 * 86_400)
  })

  // ------------------------------------------------------------------
  // B) derived cursors (seam b)
  // ------------------------------------------------------------------
  it('B1 far-future persisted workerCycle deadline is gate-closed AND deny-parks at the mechanism', () => {
    // Gate side: the span + startedAtMs<=lastSavedAt pins already close
    // the far-future deadline (stronger than the timestamp bound).
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = L
    save.productionSites = [
      makeState(LAM, {
        workerCycles: [
          {
            cycleId: 'r23_probe_1',
            siteId: LAM,
            collectionRealmId: REALM,
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed: 1,
            startedAtMs: TWO_POW_52 - 1 - CYCLE_MS,
            completesAtMs: TWO_POW_52 - 1,
          },
        ],
      }),
    ]
    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(false)
    expect(
      validation.issues.some((issue) => issue.path.includes('startedAtMs')),
    ).toBe(true)

    // Mechanism side: the same record fed directly parks - the deadline
    // is never due, never minted, and re-persists inside the domain.
    const pending = {
      cycleId: 'r23_probe_1',
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevelAtStart: 1,
      rewardTableVersion: 1,
      rollSeed: 1,
      startedAtMs: TWO_POW_52 - 1 - CYCLE_MS,
      completesAtMs: TWO_POW_52 - 1,
    }
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { workerCycles: [pending] })],
    ])
    const deps = createDeps(states)
    const nowMs = Date.now()
    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      nowMs,
      // 1 slot, 1 pending lane -> no empty lane seeds normal completions;
      // the crafted far-future deadline is the only occupant.
      { workerCapacity: 1, offlineSinceMs: nowMs - 3_600_000 },
    )
    expect(settled).toBe(0)
    const kept = states.get(LAM)!.workerCycles![0]!
    expect(kept.completesAtMs).toBe(TWO_POW_52 - 1) // deny-parked, still in-domain
  })

  it('B2 derived far-future offlineSinceMs seed parks the lane (deny), never mints', () => {
    // lastSavedAt near +2^52 derives offlineSinceMs ~= 4.5e15 (marker
    // clamps window start: min(lastSavedAt, authorityNow - elapsed) with
    // elapsed<0 -> the marker itself). The mechanism guard (<2^53) lets
    // it through - the lane seeds a future deadline and pays nothing.
    const result = advanceWorkerLanes({
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
      cycleMs: CYCLE_MS,
      pending: [],
      slots: 1,
      nowMs: Date.now(),
      emptyLaneStartMs: TWO_POW_52 - 1,
      advanceMode: 'deadline',
      budgetMs: 36_000_000,
      rng: () => 0.5,
    })
    expect(result.completed).toHaveLength(0)
    // A lane IS seeded, at the derived future cursor - still in-domain.
    expect(result.seededPending).toHaveLength(1)
    expect(result.seededPending[0]!.completesAtMs).toBe(TWO_POW_52 - 1 + CYCLE_MS)
  })

  it('B3 autoFarm lastCheckedMs: crafted far-future stamp re-anchors on the elapsed<=60 restore branch', () => {
    const DUMMY = defineEnemy({
      id: 'r23_farm_dummy',
      name: 'Farm Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 10,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 5 },
    })
    const FARM_STAGE: Stage = {
      id: 'r23_farm_stage',
      name: 'Farm Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: DUMMY.id, weight: 1 }],
      totalEnemyCount: 2,
      waves: [2],
      spawnIntervalSeconds: 0,
    }
    const manager = new GameManager()
    const player = createDefaultPlayer()
    player.perfectClearStageIds.push(FARM_STAGE.id)
    player.perfectClearSeconds[FARM_STAGE.id] = 100
    player.autoFarmStage = {
      stageId: FARM_STAGE.id,
      lastCheckedMs: TWO_POW_52 - 1, // crafted far-future anchor
    }
    manager.catalogOps.registerEnemyTemplates([DUMMY])
    manager.catalogOps.registerStages([FARM_STAGE])
    manager.setActivePlayer(player)

    // The <=60s/live-replacement restore branch runs settle(0) - the
    // >now clamp re-anchors before any remainder math.
    manager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 0)
    expect(player.autoFarmStage!.lastCheckedMs).toBeGreaterThan(0)
    expect(player.autoFarmStage!.lastCheckedMs).toBeLessThanOrEqual(Date.now())
    expect(player.autoFarmStage!.lastCheckedMs).toBeGreaterThan(Date.now() - 60_000)
  })

  it('B4 quest lastDailyResetAtMs: far-future stamp clamps to the field epoch at restore', () => {
    const questManager = new QuestManager()
    const now = 1_760_000_000_000
    questManager.restore(
      { active: [], completedOnceIds: [], lastDailyResetAtMs: TWO_POW_52 - 1 },
      now,
    )
    expect(questManager.getLastDailyResetAtMs()).toBe(now)
  })

  it('B5 buildings lastCollectedAt (seconds domain): far-future stamp clamps to nowSeconds', () => {
    const buildingManager = new BuildingManager()
    buildingManager.restore([
      {
        instanceId: 'r23_b1',
        buildingId: 'gathering_outpost',
        level: 1,
        lastCollectedAt: TWO_POW_52 - 1,
      },
    ])
    const restored = buildingManager.get('r23_b1')!
    expect(restored.lastCollectedAt).toBeLessThanOrEqual(Date.now() / 1000)
    expect(restored.lastCollectedAt).toBeGreaterThan(Date.now() / 1000 - 60)
  })

  it('B6 decompose nextCycleAt: far-future deadline rebases to now + cycleMs on first tick', () => {
    const decompose = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    decompose.updateCapacity(3)
    decompose.restore({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: TWO_POW_52 - 1,
      started: true,
    })
    const now = Date.now()
    decompose.tick(now)
    expect(decompose.getSaveState().nextCycleAt).toBe(now + 30_000)
  })

  // ------------------------------------------------------------------
  // C) writer -> shape round-trip (seam c)
  // ------------------------------------------------------------------
  it('C1 writer round-trip: stackable re-drink at the domain edge + non-stackable TLT max-arm both re-validate', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const authored = pills.find((pill) => pill.id === 'hoi_linh_dan_qi_refining')
    const authoredRegen = authored?.effects.find((effect) => effect.type === 'regen')
    const authoredDurationS = authoredRegen?.durationSeconds ?? 75
    const authoredFlat = authoredRegen?.mpPerSecond ?? 3

    // Arm 1 - stackable merge at the admitted edge: a parked 2^52-1
    // expiry plus one honest re-drink clamps at 2^52-1, never out of
    // domain (r22-COR-1 pin).
    p.persistentTimedEffects = [
      {
        id: 'fx-craft',
        sourceItemId: 'hoi_linh_dan_qi_refining',
        appliedAtMs: L - 1_000,
        expiresAtMs: TWO_POW_52 - 1,
        effectGroup: 'hoi_linh_dan',
        durationStackable: true, // authored stackable = true
        modifiers: [
          {
            id: 'm1',
            sourceId: 'fx-craft',
            sourceType: 'pill',
            stat: 'manaRegenPerTurn',
            flat: authoredFlat,
            domain: 'spell',
          },
        ],
      },
    ]
    const now = Date.now()
    gameManager.effectOps.applyTimedEffect(p, {
      id: `pill-regen:hoi_linh_dan_qi_refining:${now}`,
      sourceItemId: 'hoi_linh_dan_qi_refining',
      appliedAtMs: now,
      expiresAtMs: now + authoredDurationS * 1000,
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      modifiers: [
        {
          id: 'm2',
          sourceId: 'pill',
          sourceType: 'pill',
          stat: 'manaRegenPerTurn',
          flat: authoredFlat,
          domain: 'spell',
        },
      ],
    })
    expect(p.persistentTimedEffects[0]!.expiresAtMs).toBe(TWO_POW_52 - 1)

    // Arm 2 - non-stackable TLT max-merge: expires = max(existing, new)
    // can only land inside the TLT admission envelope (<= lastSavedAt +
    // 24h + 7d) since both operands are authored-writer stamps.
    p.persistentTimedEffects.push(tltEffect(now - 1_000 + TU_LINH_TRAN_DURATION_MS, now - 1_000))
    const later = tltEffect(now + TU_LINH_TRAN_DURATION_MS + 60_000, now)
    gameManager.effectOps.applyTimedEffect(p, later)
    const storedTlt = p.persistentTimedEffects.find(
      (effect) => effect.effectGroup === 'tu_linh_tran',
    )!
    expect(storedTlt.expiresAtMs).toBe(now + TU_LINH_TRAN_DURATION_MS + 60_000)

    // The game would stamp lastSavedAt = Date.now() on save; emulate
    // that so the F-TC9-1 appliedAt<=lastSavedAt pin sees the marker.
    p.lastSavedAt = now
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  // ------------------------------------------------------------------
  // D) capacity pin interplay (seam d)
  // ------------------------------------------------------------------
  it('D1 capacity>65536 AND no chi_hien_quan -> two distinct issues on the same path', () => {
    const capacityIssues = (capacity: number, buildings: unknown[]) => {
      const save = validSave()
      ;(save.player as PlayerData).autoWorkerCapacity = capacity
      save.buildings = buildings
      return validateGameSaveShape(save).issues.filter(
        (issue) => issue.path === 'player.autoWorkerCapacity',
      )
    }

    // Both pins fire: the mechanism cap and the CHQ-existence pin are
    // independent contract statements on the same field.
    const both = capacityIssues(70_000, [])
    expect(both).toHaveLength(2)
    expect(both.some((issue) => issue.message.includes('65536'))).toBe(true)
    expect(both.some((issue) => issue.message.includes('chi_hien_quan'))).toBe(true)

    // Under the cap, only the F-W-16 existence pin fires.
    const underCap = capacityIssues(5, [])
    expect(underCap).toHaveLength(1)
    expect(underCap[0]!.message).toContain('chi_hien_quan')

    // capacity 0 is the only honest no-CHQ shape.
    expect(capacityIssues(0, [])).toHaveLength(0)

    // A CHQ instance discharges F-W-16; stale capacity values are
    // admitted because restore recomputes from the formula.
    const withChq = capacityIssues(5, [
      { instanceId: 'r23_c1', buildingId: 'chi_hien_quan', level: 1, lastCollectedAt: 0 },
    ])
    expect(withChq).toHaveLength(0)
  })
})
