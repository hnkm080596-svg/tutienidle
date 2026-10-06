import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import type { Stage } from '../../core/stage/Stage'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { accrueCultivationInsight } from '../../core/cultivation/CultivationInsight'
import { validateGameSaveShape } from './saveShapeValidation'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'
import { sanitizeRestoreAuthority, type RestoreTimeAuthority } from './saveTypes'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'

// ============================================================================
// QA repro - fixpoint r24 AUT wave (blind audit of commit f50fdaf9, the r23
// batch: sanitizeRestoreAuthority drops a present-but-out-of-domain authority
// to undefined -> legacy client-clock semantics; CultivationInsight resets a
// non-finite accumulator to 0; doc/comment-only otherwise).
//
// Arms assigned this wave:
//  (a) sanitize fallback grant regression - a corrupt-only attacker converts
//      ANY present authority into client-clock semantics over the payload's
//      editable lastSavedAt. CONFIRMED r24-AUT-1: a poisoned cold-boot stamp
//      pays min(now - lastSavedAt, 24h) where the server approved less
//      (a 0-width window pays 24h). The all-or-nothing drop also means
//      corrupting ONE stamp discards the honest sibling.
//  (b) live-replacement out-of-domain nowMs - CONFIRMED r24-AUT-2: the kind
//      that exists to pay ZERO (replacement-in-place) pays the full client
//      window once its only stamp crosses 2^52. No in-domain crafted
//      authority can mint via live-replacement - the drop is the ONLY path.
//  (c) acc=0 reset - deny direction, no mint: the acc is admission-pinned
//      < threshold, so the reset wipes at most a sub-threshold remainder
//      plus the current gained; acc carries no anti-abuse state.
//  (d) remaining unbounded persisted inputs: stack amounts / quest progress
//      / collection lengths stay accepted-by-design; pins for counters hold.
//  (e) authority symmetry: one seam hands the SAME authority object to both
//      restores; both sanitize identically - no asymmetric window exists,
//      but the shared fail-open mints on both sides.
// ============================================================================

declare const process: { env: Record<string, string | undefined> }

const NOW = 1_725_160_000_000
const TWO_POW_52 = 2 ** 52
// Date.parse admits finite stamps out to +/-8.64e15 ms - the band
// (2^52, 8.64e15] is producible by a corrupt server timestamp yet is
// outside the domain sanitizeRestoreAuthority enforces.
const OUT_OF_DOMAIN_MS = 8_600_000_000_000_000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  return manager
}

function makeSave(overrides: { lastSavedAt?: number; autoFarmStage?: { stageId: string; lastCheckedMs: number } | null } = {}): GameSave {
  const manager = registeredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  player.cultivation = 0
  player.cultivationPerSecond = 1
  if (overrides.autoFarmStage !== undefined) {
    player.autoFarmStage = overrides.autoFarmStage
  }
  const save = buildGameSave(player, manager)
  save.player.lastSavedAt = overrides.lastSavedAt ?? NOW
  return save
}

// Armed-farm variant - the perfect-clear witness keeps the farm eligible
// through restore's re-check, mirroring the r15-COR-E pins.
function makeArmedFarmSave(lastCheckedMs: number): { save: GameSave; manager: GameManager } {
  const manager = registeredManager()
  const farmStage: Stage = {
    id: 'farm_stage',
    name: 'farm_stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'stage_probe', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
  manager.catalogOps.registerStages([farmStage])
  const save = makeSave({
    lastSavedAt: lastCheckedMs,
    autoFarmStage: { stageId: 'farm_stage', lastCheckedMs },
  })
  save.player.perfectClearStageIds = ['farm_stage']
  save.player.perfectClearSeconds = { farm_stage: 100 }
  return { save, manager }
}

// r23-style minimal valid save for shape-gate probes (arm d).
function validSave(): Record<string, unknown> {
  const p = createDefaultPlayer()
  p.realmId = 'qi_refining'
  p.realmLevel = 1
  p.cultivation = 0
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

describe('fixpoint r24 AUT - sanitizeRestoreAuthority fail-open audit (f50fdaf9)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // ARM (a) - cold-boot selective poison. One corrupt stamp drops the
  // WHOLE authority (all-or-nothing), converting the server-approved
  // window [sinceMs, untilMs] into the client window (now-lastSavedAt,
  // 24h cap) over the payload's editable marker.
  // ------------------------------------------------------------------
  it('A1 baseline: an honest cold-boot pays exactly the approved window', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 100_000,
      untilMs: NOW,
    })

    expect(result.elapsedSeconds).toBe(100)
    expect(result.cultivation).toBe(100)
  })

  it('A2 r24-AUT-1: poisoning untilMs only mints the client window over the approved one', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    // The guard drops the whole authority - the kind survives nowhere.
    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: NOW - 100_000, untilMs: OUT_OF_DOMAIN_MS }),
    ).toBeUndefined()

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 100_000,
      untilMs: OUT_OF_DOMAIN_MS,
    })

    // Server approved 100s; the dropped authority pays the payload's own
    // claimed staleness (900s) - 9x the approved window.
    expect(result.elapsedSeconds).toBe(900)
    expect(result.cultivation).toBeGreaterThan(100)
  })

  it('A3 r24-AUT-1: a zero-width approved window pays the full client window after one poisoned stamp', () => {
    const player = usePlayerStore()
    // Payload claims the save is 24h old - the maximum the client
    // fallback can mint through this arm.
    const save = makeSave({ lastSavedAt: NOW - 24 * 3_600_000 })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW, // server approved ZERO accrual (cutoff == serverNow)
      untilMs: OUT_OF_DOMAIN_MS, // one corrupt stamp drops both
    })

    // Approved 0 -> pays min(now - lastSavedAt, 86400) = 86400.
    expect(result.elapsedSeconds).toBe(86_400)
    expect(result.cultivation).toBeGreaterThan(0)
  })

  it('A4 selective poison: corrupting sinceMs alone discards the honest untilMs too (all-or-nothing)', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: -OUT_OF_DOMAIN_MS, untilMs: NOW }),
    ).toBeUndefined()

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: -OUT_OF_DOMAIN_MS,
      untilMs: NOW,
    })

    // The honest untilMs is lost with the corrupt sinceMs - client pays 900.
    expect(result.elapsedSeconds).toBe(900)
  })

  it('A5 confiscation wedge: poisoning an honest wide window underpays the approved span (manager settle)', () => {
    const player = usePlayerStore()
    const { save, manager } = makeArmedFarmSave(NOW - 900_000)
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    const honest = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 172_800_000, // 48h approved window
      untilMs: NOW,
    })
    expect(honest.status).toBe('ok')
    // The manager resolves the cold-boot elapsed UNCAPPED: the full
    // 172800s reaches every settle channel (each applies its own cap).
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 172_800)

    // Fresh state - same payload, untilMs corrupted out of domain.
    setActivePinia(createPinia())
    const player2 = usePlayerStore()
    const { save: save2, manager: manager2 } = makeArmedFarmSave(NOW - 900_000)
    const settleSpy2 = vi.spyOn(manager2.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    const poisoned = restoreGameSession(player2, manager2, save2, {
      kind: 'cold-boot',
      sinceMs: NOW - 172_800_000,
      untilMs: OUT_OF_DOMAIN_MS,
    })
    expect(poisoned.status).toBe('ok')
    // The 900s client window replaces the approved 172800s - a corrupt
    // stamp confiscates ~99.5% of the approved settle span (wedge).
    expect(settleSpy2).toHaveBeenCalledWith(expect.objectContaining({}), 900)
  })

  it('A6 posture pin: an in-domain crafted cold-boot still out-mints the fallback', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    // |sinceMs| = 4e15 < 2^52 -> survives the guard verbatim. The guard
    // never bounded the full-control attacker (accepted r23 residual);
    // the fallback only moves the CORRUPT-only attacker from deny to mint.
    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: -(TWO_POW_52 - 1),
      untilMs: NOW,
    })

    expect(result.elapsedSeconds).toBe(86_400) // player-store 24h cap
  })

  // ------------------------------------------------------------------
  // ARM (b) - live-replacement out-of-domain nowMs. The kind exists to
  // accrue ZERO (replacement-in-place); dropping the authority on a
  // corrupt stamp silently converts it into the client fallback.
  // ------------------------------------------------------------------
  it('B1 baseline: live-replacement accrues zero', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    const result = player.restoreFromSave(save, { kind: 'live-replacement', nowMs: NOW })

    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('B2 r24-AUT-2: a Date.parse-range nowMs drops live-replacement to the client window - zero-accrual dies', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: OUT_OF_DOMAIN_MS }),
    ).toBeUndefined()

    const result = player.restoreFromSave(save, {
      kind: 'live-replacement',
      nowMs: OUT_OF_DOMAIN_MS,
    })

    // Pre-r23 the same stamp stayed kind:'live-replacement' -> elapsed 0.
    // Post-r23 the kind is discarded entirely -> pays the payload's
    // claimed staleness. There is NO in-domain nowMs that pays through
    // live-replacement: corruption is the only mint on this channel.
    expect(result.elapsedSeconds).toBe(900)
    expect(result.cultivation).toBeGreaterThan(0)
  })

  it('B3 negative out-of-domain nowMs mints identically (sign-agnostic drop)', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    const result = player.restoreFromSave(save, {
      kind: 'live-replacement',
      nowMs: -OUT_OF_DOMAIN_MS,
    })

    expect(result.elapsedSeconds).toBe(900)
  })

  it('B4 manager side: poisoned live-replacement turns the zero-accrual settle into the full client window', () => {
    const player = usePlayerStore()
    const { save, manager } = makeArmedFarmSave(NOW - 900_000)
    manager.setActivePlayer(player.$state)
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const decomposeSpy = vi.spyOn(manager.decomposeSystem, 'settleOffline')

    const honest = restoreGameSession(player, manager, save, {
      kind: 'live-replacement',
      nowMs: NOW,
    })
    expect(honest.status).toBe('ok')
    // Server replaced the head -> every consumer re-anchors on zero.
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 0)
    expect(decomposeSpy).not.toHaveBeenCalled()

    // Fresh state, same payload, one corrupt stamp (Date.now stays
    // mocked - restoreAllMocks would drop the epoch for both blocks).
    setActivePinia(createPinia())
    const player2 = usePlayerStore()
    const { save: save2, manager: manager2 } = makeArmedFarmSave(NOW - 900_000)
    manager2.setActivePlayer(player2.$state)
    const settleSpy2 = vi.spyOn(manager2.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const decomposeSpy2 = vi.spyOn(manager2.decomposeSystem, 'settleOffline')
    const productionSpy2 = vi.spyOn(manager2.productionSystem, 'settleOffline')

    const poisoned = restoreGameSession(player2, manager2, save2, {
      kind: 'live-replacement',
      nowMs: OUT_OF_DOMAIN_MS,
    })
    expect(poisoned.status).toBe('ok')
    // elapsed = now - lastSavedAt = 900s - the farm settles the window
    // the replacement semantics exist to deny, and the >60s gate now
    // fires production/decompose catch-up that honest stamps suppress.
    expect(settleSpy2).toHaveBeenCalledWith(expect.objectContaining({}), 900)
    expect(decomposeSpy2).toHaveBeenCalled()
    expect(productionSpy2).toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // ARM (c) - acc=0 reset is deny-direction: the acc is admission-pinned
  // < threshold and carries no anti-abuse state, so the reset wipes at
  // most a sub-threshold remainder plus the current gained.
  // ------------------------------------------------------------------
  it('C1 non-finite acc resets to 0 without minting insight (deny)', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ngo_dao'] // insight_per_cultivation threshold 2000
    player.cultivationInsightAccumulator = Number.POSITIVE_INFINITY

    accrueCultivationInsight(player, 500)

    expect(player.cultivationInsightAccumulator).toBe(0)
    expect(player.skillInsight).toBe(0)
    expect(player.totalSkillInsightGained).toBe(0)
  })

  it('C2 a poisoned gained wipes an honest sub-threshold remainder - small deny, not a mint', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ngo_dao']
    player.cultivationInsightAccumulator = 1_999 // max admitted remainder

    accrueCultivationInsight(player, Number.POSITIVE_INFINITY)

    // The honest 1999 (one step short of minting skillInsight) is lost
    // together with the gained - the guard can only underpay.
    expect(player.cultivationInsightAccumulator).toBe(0)
    expect(player.skillInsight).toBe(0)
  })

  it('C3 sibling class: every OTHER required-finite counter still bricks the write->load cycle', () => {
    // r23 repaired cultivationInsightAccumulator alone; a runtime non-finite
    // on any sibling field still serializes to null -> validator rejects
    // -> boot.fail recovery loop. Latent-hardening residue, no live feed.
    const save = validSave()
    ;(save.player as PlayerData).skillInsight = Number.POSITIVE_INFINITY

    const roundTripped = JSON.parse(JSON.stringify(save)) as Record<string, unknown>
    expect((roundTripped.player as PlayerData).skillInsight).toBeNull()
    expect(validateGameSaveShape(roundTripped).ok).toBe(false)
  })

  it('C4 reachability: the max client-window restore keeps acc finite - the reset never fires via restore', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 24 * 3_600_000 })
    save.player.cultivationInsightAccumulator = 1_999
    // ngo_dao talent persisted -> threshold active through restore.
    ;(save.player as PlayerData).selectedTalentIds = ['ngo_dao']

    player.restoreFromSave(save) // no authority -> full 24h client window

    // offlineGained is bounded (<=86400s x capped cps) -> acc stays
    // finite; the reset arm is unreachable through every restore path.
    expect(Number.isFinite(player.cultivationInsightAccumulator)).toBe(true)
    expect(player.cultivationInsightAccumulator).toBeGreaterThanOrEqual(0)
  })

  // ------------------------------------------------------------------
  // ARM (d) - remaining unbounded persisted inputs. Re-verified: the
  // accepted honest-shape class (stack amounts, quest progress,
  // collection counts) still admits; the pinned counters still deny.
  // ------------------------------------------------------------------
  it('D1 stack amount is admitted unbounded (accepted self-cheat class)', () => {
    const save = validSave()
    save.materials = [{ materialId: 'tinh_hoa_pham_the', amount: 1e15 }]
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('D2 quest active progress is admitted unbounded (bounded authored reward)', () => {
    const save = validSave()
    ;(save as { quests?: unknown }).quests = {
      active: [{ questId: 'q_probe', progress: 1e12, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    }
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('D3 dedup-only string lists (questFlags / completedOnceIds) admit unbounded counts - perf wedge nit', () => {
    const save = validSave()
    // 5k unique flags pass the shape gate: element type + set-dedup are
    // the only rules - no count cap anywhere (unlike the equipment bag's
    // EQUIPMENT_BAG_SOFT_CAP or effectGroup merge-dedup, which bound
    // their collections by construction). Restore walks the list O(n)
    // and the payload inflates writes - a size wedge, not a mint.
    ;(save as { quests?: unknown }).quests = {
      active: [],
      completedOnceIds: Array.from({ length: 5_000 }, (_, i) => `q_done_${i}`),
      lastDailyResetAtMs: 0,
      questFlags: Array.from({ length: 5_000 }, (_, i) => `flag_${i}`),
    }
    const started = performance.now()
    const verdict = validateGameSaveShape(save)
    expect(verdict.ok).toBe(true)
    expect(performance.now() - started).toBeLessThan(30_000)
  })

  it('D4 the pinned counters still deny: phaGiapCarryStacks bank max + attributePoints level bound', () => {
    const stacks = validSave()
    ;(stacks.player as PlayerData).phaGiapCarryStacks = 1e12
    expect(validateGameSaveShape(stacks).ok).toBe(false)

    const points = validSave()
    ;(points.player as PlayerData).attributePoints = 1e9
    expect(validateGameSaveShape(points).ok).toBe(false)
  })

  // ------------------------------------------------------------------
  // ARM (e) - authority symmetry. restoreGameSession hands the SAME
  // authority object to player.restoreFromSave then
  // GameManagerSaveRestore.restoreFromSave; each sanitizes internally.
  // No asymmetric window exists - the shared fail-open mints on both.
  // ------------------------------------------------------------------
  it('E1 one poisoned authority mints symmetrically through restoreGameSession', () => {
    const player = usePlayerStore()
    const { save, manager } = makeArmedFarmSave(NOW - 900_000)
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'live-replacement',
      nowMs: OUT_OF_DOMAIN_MS,
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') {
      throw new Error(result.message)
    }
    // Player side: the dropped authority paid the client window.
    expect(result.offline.elapsedSeconds).toBe(900)
    // Manager side: the same dropped object paid its settle channels.
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 900)
  })

  it('E2 the manager restore sanitizes independently - no path skips it while the player side is guarded', () => {
    const { save, manager } = makeArmedFarmSave(NOW - 900_000)
    // A direct sibling call WITHOUT player.restoreFromSave: the sanitize
    // inside saveOps.restoreFromSave drops the authority identically.
    manager.setActivePlayer(JSON.parse(JSON.stringify(save.player)) as PlayerData)
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    manager.saveOps.restoreFromSave(save, { kind: 'live-replacement', nowMs: OUT_OF_DOMAIN_MS })

    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 900)
  })
})
