// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { restoreGameSession, type GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import { usePlayerStore } from '../../stores/player'

// Mission B external-audit finding (HIGH): a persisted autoFarmStage used
// to restore WITHOUT re-acquiring the single StageManager slot —
// settleAutoFarmOffline pays the offline window but nothing re-arms the
// runtime lease, while tickAutoFarm reads persisted state alone. After
// reload the slot reads free, so a real stage start succeeds and combat
// runs CONCURRENT with an auto-farm that keeps mutating the shared
// BattleLootSystem session every cycle. This suite drives the full
// restoreGameSession seam — not a hand-set player.autoFarmStage.

const DUMMY = defineEnemy({
  id: 'restore_farm_dummy', name: 'Restore Farm Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 10, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 5 },
})

const FARM_STAGE: Stage = {
  id: 'restore_farm_a',
  name: 'Farm A',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: DUMMY.id, weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

const COMBAT_STAGE: Stage = {
  id: 'restore_combat_b',
  name: 'Combat B',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: DUMMY.id, weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

const FARM_STAGE_B: Stage = {
  id: 'restore_farm_b',
  name: 'Farm B',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: DUMMY.id, weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

function baseSave(player: PlayerData): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: [],
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
  }
}

function harness() {
  setActivePinia(createPinia())
  const playerStore = usePlayerStore()
  const gameManager = new GameManager()

  gameManager.catalogOps.registerEnemyTemplates([DUMMY])
  gameManager.catalogOps.registerStages([FARM_STAGE, COMBAT_STAGE, FARM_STAGE_B])

  // The save's player slice carries an armed farm for FARM_STAGE. A recent
  // lastSavedAt keeps the offline window UNDER the >60s settle gate —
  // the reconcile must not hide behind that gate (a fast reload restores
  // an armed farm too).
  const savedPlayer = createDefaultPlayer()
  savedPlayer.perfectClearStageIds.push(FARM_STAGE.id)
  savedPlayer.perfectClearSeconds[FARM_STAGE.id] = 100 // cycle = 50s
  savedPlayer.autoFarmStage = {
    stageId: FARM_STAGE.id,
    lastCheckedMs: Date.now() - 30_000,
  }
  savedPlayer.lastSavedAt = Date.now() - 30_000

  return { playerStore, gameManager, save: baseSave(savedPlayer) }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Mission B audit — auto-farm StageManager lease survives restore', () => {
  it('persisted farm -> full restore re-acquires the slot; combat B refused; stop releases it', () => {
    const { playerStore, gameManager, save } = harness()

    const restored = restoreGameSession(playerStore, gameManager, save)
    expect(restored.status).toBe('ok')

    // The runtime lease must mirror the persisted authority.
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)

    // A normal stage start must refuse while the farm holds the slot.
    const player = playerStore.$state
    expect(gameManager.turnBattleOps.startStage(player, COMBAT_STAGE)).toBe(false)

    // stopAutoFarm releases the lease; combat B then starts normally.
    gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player)
    expect(player.autoFarmStage).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()
    expect(gameManager.turnBattleOps.startStage(player, COMBAT_STAGE)).toBe(true)
  })

  it('restored farm keeps paying cycles through the world tick (lease held, not just persisted state)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { playerStore, gameManager, save } = harness()
    const restored = restoreGameSession(playerStore, gameManager, save)
    expect(restored.status).toBe('ok')

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z'))
    gameManager.tickOps.update(0.1)

    // 60s elapsed vs 50s cycle -> exactly 1 cycle rolled.
    expect(gameManager.getBattleRewardSummary().spiritStone).toBeGreaterThan(0)
  })

  it('fail-closed: persisted-armed without an owned lease never mints rewards', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { playerStore, gameManager, save } = harness()
    save.player.autoFarmStage = null
    const restored = restoreGameSession(playerStore, gameManager, save)
    expect(restored.status).toBe('ok')
    expect(gameManager.stageManager.getActive()).toBeNull()

    // Post-C5 the old repro — an external caller releasing the farm's
    // token via get()+release() — is impossible by construction (the
    // observational snapshot carries no release capability). The
    // reachable equivalent: persisted authority armed while the ops
    // holds no lease at all (a state write that bypassed startAutoFarm).
    playerStore.$state.autoFarmStage = { stageId: FARM_STAGE.id, lastCheckedMs: Date.now() - 60_000 }

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z'))
    gameManager.tickOps.update(0.1)

    // Persisted authority says armed, runtime lease says free: the tick
    // must not mint rewards into a free slot.
    expect(gameManager.getBattleRewardSummary().spiritStone).toBe(0)
  })

  it('persisted farm for an UNREGISTERED stage -> lease cleared, slot stays free', () => {
    const { playerStore, gameManager, save } = harness()
    save.player.autoFarmStage = { stageId: 'removed_stage', lastCheckedMs: Date.now() - 30_000 }

    const restored = restoreGameSession(playerStore, gameManager, save)
    expect(restored.status).toBe('ok')

    // Dead persisted lease is dropped, not left armed-but-inert.
    expect(playerStore.$state.autoFarmStage).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()
  })

  it('persisted farm for a stage never perfect-cleared -> lease cleared (same gate as startAutoFarm)', () => {
    const { playerStore, gameManager, save } = harness()
    // Registered stage, but the save drops it from perfectClearStageIds —
    // a crafted/foreign payload must not hold the slot while paying
    // nothing (tickAutoFarm needs perfectClearSeconds too).
    save.player.perfectClearStageIds = []

    const restored = restoreGameSession(playerStore, gameManager, save)
    expect(restored.status).toBe('ok')

    expect(playerStore.$state.autoFarmStage).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()
  })

  it('re-restoring a same-farm payload keeps the armed lease (reconcile is idempotent)', () => {
    const { playerStore, gameManager, save } = harness()

    expect(restoreGameSession(playerStore, gameManager, save).status).toBe('ok')
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)

    // A genuinely different payload carrying the SAME armed farm must not
    // see the held slot as a conflict and disarm it — stageManager.start
    // returns false for any occupied slot.
    const secondSave = baseSave({
      ...save.player,
      name: 'Renamed',
      autoFarmStage: { stageId: FARM_STAGE.id, lastCheckedMs: Date.now() - 20_000 },
    })
    secondSave.player.perfectClearStageIds = [FARM_STAGE.id]

    expect(restoreGameSession(playerStore, gameManager, secondSave).status).toBe('ok')

    expect(playerStore.$state.autoFarmStage?.stageId).toBe(FARM_STAGE.id)
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)
  })

  it('re-restoring a NO-farm payload releases the previously-armed farm lease', () => {
    // Same-GameManager re-restore of a DIFFERENT payload is a supported
    // contract (boot retry loading a changed save, replace/onceOnlySettle
    // suites). Persisted authority switched farm A off — the lease the
    // first restore acquired must not stay orphaned on the slot.
    const { playerStore, gameManager, save } = harness()

    expect(restoreGameSession(playerStore, gameManager, save).status).toBe('ok')
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)

    const secondSave = baseSave({ ...save.player, name: 'NoFarm', autoFarmStage: null })

    expect(restoreGameSession(playerStore, gameManager, secondSave).status).toBe('ok')

    expect(playerStore.$state.autoFarmStage).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()

    // The freed slot must accept a manual stage again.
    expect(gameManager.turnBattleOps.startStage(playerStore.$state, COMBAT_STAGE)).toBe(true)
  })

  it('re-restoring a DIFFERENT-farm payload swaps the lease (A -> B)', () => {
    const { playerStore, gameManager, save } = harness()

    expect(restoreGameSession(playerStore, gameManager, save).status).toBe('ok')
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)

    const secondPlayer = {
      ...save.player,
      name: 'FarmSwap',
      perfectClearStageIds: [FARM_STAGE_B.id],
      perfectClearSeconds: { [FARM_STAGE_B.id]: 100 },
      autoFarmStage: { stageId: FARM_STAGE_B.id, lastCheckedMs: Date.now() - 20_000 },
    }

    expect(restoreGameSession(playerStore, gameManager, baseSave(secondPlayer)).status).toBe('ok')

    expect(playerStore.$state.autoFarmStage?.stageId).toBe(FARM_STAGE_B.id)
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE_B.id)
  })

  it('a foreign lease on the SAME stage is not converged — imported farm drops fail-closed', () => {
    // A manual battle holding the slot for the very stage the incoming
    // payload farms: matching stageId alone must NOT satisfy reconcile —
    // the farm never acquired that lease. Arming the persisted farm on
    // top of it would let tickAutoFarm pay into the live battle's shared
    // BattleLootSystem session.
    const { playerStore, gameManager, save } = harness()

    const foreignLease = gameManager.stageManager.acquire(FARM_STAGE)
    expect(foreignLease).not.toBeNull()

    expect(restoreGameSession(playerStore, gameManager, save).status).toBe('ok')

    expect(playerStore.$state.autoFarmStage).toBeNull()
    // The foreign lease is untouched — reconcile never releases a slot
    // it did not acquire.
    expect(gameManager.stageManager.owns(foreignLease)).toBe(true)
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)
  })

  it('persisted-armed + a foreign same-stage lease still pays nothing (tick is ownership-gated)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { playerStore, gameManager, save } = harness()
    save.player.autoFarmStage = null
    expect(restoreGameSession(playerStore, gameManager, save).status).toBe('ok')

    // A foreign owner holds the slot for the stage a direct state write
    // farms — matching stageId alone must not satisfy the tick (paying
    // here would mint into the foreign battle's shared loot session).
    const foreignLease = gameManager.stageManager.acquire(FARM_STAGE)!
    playerStore.$state.autoFarmStage = { stageId: FARM_STAGE.id, lastCheckedMs: Date.now() - 60_000 }

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z'))
    gameManager.tickOps.update(0.1)

    expect(gameManager.getBattleRewardSummary().spiritStone).toBe(0)
    expect(gameManager.stageManager.owns(foreignLease)).toBe(true)
  })

  it('same-stage re-restore that REVOKED the perfect-clear drops the lease (eligibility re-validated every restore)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { playerStore, gameManager, save } = harness()

    expect(restoreGameSession(playerStore, gameManager, save).status).toBe('ok')
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)

    // Shape-valid payload: no cross-field invariant ties armed farm to
    // perfectClearStageIds. A converged-check before validation would
    // keep the lease minting on a revoked stage — the tick never
    // re-checks perfectClearStageIds.
    const secondSave = baseSave({ ...save.player, name: 'Revoked', perfectClearStageIds: [] })

    expect(restoreGameSession(playerStore, gameManager, secondSave).status).toBe('ok')

    expect(playerStore.$state.autoFarmStage).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()

    vi.setSystemTime(new Date('2026-09-04T10:05:00Z'))
    gameManager.tickOps.update(0.1)

    expect(gameManager.getBattleRewardSummary().spiritStone).toBe(0)
  })

  it('same-stage re-restore with a MISSING cycle time drops the inert lease (combat unblocked)', () => {
    const { playerStore, gameManager, save } = harness()

    expect(restoreGameSession(playerStore, gameManager, save).status).toBe('ok')
    expect(gameManager.stageManager.getActive()?.stageId).toBe(FARM_STAGE.id)

    // Shape-valid payload: perfectClearSeconds validates only PRESENT
    // entries — a missing key passes shape checks but can never complete
    // a cycle. Keeping the lease would block manual stages inertly.
    const secondPlayer = { ...save.player, name: 'NoCycle', perfectClearSeconds: {} }

    expect(restoreGameSession(playerStore, gameManager, baseSave(secondPlayer)).status).toBe('ok')

    expect(playerStore.$state.autoFarmStage).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()
    expect(gameManager.turnBattleOps.startStage(playerStore.$state, COMBAT_STAGE)).toBe(true)
  })
})
