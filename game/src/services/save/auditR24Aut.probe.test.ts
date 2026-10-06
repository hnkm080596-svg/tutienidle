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
// r24 adjudication: r24-AUT-1/2 confirmed - the drop-to-undefined fallback
// is a GRANT (the client window can exceed the approved span; a corrupt
// live-replacement nowMs is the only mint on a channel built to pay zero).
// Fix: a present-but-corrupt authority degrades to zero-accrual
// live-replacement anchored at the local clock - never to `undefined`.
// These probes now pin the DENY behavior.
//
// Arms assigned this wave:
//  (a) sanitize fallback grant regression - r24-AUT-1 FIXED: a poisoned
//      cold-boot stamp accrues ZERO instead of paying the editable
//      min(now - lastSavedAt, 24h) client window.
//  (b) live-replacement out-of-domain nowMs - r24-AUT-2 FIXED: the kind
//      that exists to pay ZERO stays zero-accrual through a corrupt stamp.
//  (c) acc=0 reset - deny direction, no mint: the acc is admission-pinned
//      < threshold, so the reset wipes at most a sub-threshold remainder
//      plus the current gained; acc carries no anti-abuse state.
//  (d) remaining unbounded persisted inputs: stack amounts / quest progress
//      stay accepted-by-design; pins for counters hold. The dedup-only
//      quest string lists got a count cap (QUEST_LIST_CAP = 1024) -
//      probe D3 now pins the rejection.
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

  it('A2 r24-AUT-1 fixed: poisoning untilMs denies accrual instead of minting the client window', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    // Corrupt stamp -> degrade to zero-accrual live-replacement at the
    // local clock - the client window is never reached.
    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: NOW - 100_000, untilMs: OUT_OF_DOMAIN_MS }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 100_000,
      untilMs: OUT_OF_DOMAIN_MS,
    })

    // Server approved 100s; a corrupt stamp pays ZERO (deny), not the
    // payload's claimed 900s staleness.
    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('A3 r24-AUT-1 fixed: a zero-width approved window pays ZERO after one poisoned stamp', () => {
    const player = usePlayerStore()
    // Payload claims the save is 24h old - what the client window WOULD
    // mint if the corrupt authority fell back to it.
    const save = makeSave({ lastSavedAt: NOW - 24 * 3_600_000 })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW, // server approved ZERO accrual (cutoff == serverNow)
      untilMs: OUT_OF_DOMAIN_MS, // corrupt stamp -> deny, not client window
    })

    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('A4 selective poison: corrupting sinceMs alone denies accrual (no partial-authority path)', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: -OUT_OF_DOMAIN_MS, untilMs: NOW }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: -OUT_OF_DOMAIN_MS,
      untilMs: NOW,
    })

    // The honest untilMs cannot be trusted once its sibling is corrupt -
    // zero accrual, never the client window.
    expect(result.elapsedSeconds).toBe(0)
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
    // r24-AUT-1 fixed: a corrupt stamp settles ZERO (deny) - neither the
    // approved 172800s nor the 900s client window is paid.
    expect(settleSpy2).toHaveBeenCalledWith(expect.objectContaining({}), 0)
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

  it('B2 r24-AUT-2 fixed: a Date.parse-range nowMs keeps live-replacement zero-accrual', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: OUT_OF_DOMAIN_MS }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })

    const result = player.restoreFromSave(save, {
      kind: 'live-replacement',
      nowMs: OUT_OF_DOMAIN_MS,
    })

    // The zero-accrual contract survives the corrupt stamp - no channel
    // mint is possible through live-replacement.
    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('B3 negative out-of-domain nowMs denies identically (sign-agnostic)', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 900_000 })

    const result = player.restoreFromSave(save, {
      kind: 'live-replacement',
      nowMs: -OUT_OF_DOMAIN_MS,
    })

    expect(result.elapsedSeconds).toBe(0)
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
    // r24-AUT-2 fixed: the zero-accrual settle survives - the farm gets
    // (_, 0) and production/decompose catch-up stays suppressed.
    expect(settleSpy2).toHaveBeenCalledWith(expect.objectContaining({}), 0)
    expect(decomposeSpy2).not.toHaveBeenCalled()
    expect(productionSpy2).not.toHaveBeenCalled()
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

  it('D3 dedup-only string lists (questFlags / completedOnceIds) now reject counts past QUEST_LIST_CAP (fixed nit)', () => {
    const save = validSave()
    // The count cap closes the last unbounded-collection surface: 5k
    // unique entries used to validate (perf wedge), now rejected.
    ;(save as { quests?: unknown }).quests = {
      active: [],
      completedOnceIds: Array.from({ length: 5_000 }, (_, i) => `q_done_${i}`),
      lastDailyResetAtMs: 0,
      questFlags: Array.from({ length: 5_000 }, (_, i) => `flag_${i}`),
    }
    expect(validateGameSaveShape(save).ok).toBe(false)

    // Honest-sized payloads still admit.
    ;(save as { quests?: unknown }).quests = {
      active: [],
      completedOnceIds: ['q_done_1', 'q_done_2'],
      lastDailyResetAtMs: 0,
      questFlags: ['flag_1'],
    }
    expect(validateGameSaveShape(save).ok).toBe(true)
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
  it('E1 one poisoned authority denies symmetrically through restoreGameSession', () => {
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
    // Both sides see the same degraded zero-accrual authority.
    expect(result.offline.elapsedSeconds).toBe(0)
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 0)
  })

  it('E2 the manager restore sanitizes independently - no path skips it while the player side is guarded', () => {
    const { save, manager } = makeArmedFarmSave(NOW - 900_000)
    // A direct sibling call WITHOUT player.restoreFromSave: the sanitize
    // inside saveOps.restoreFromSave degrades identically to zero accrual.
    manager.setActivePlayer(JSON.parse(JSON.stringify(save.player)) as PlayerData)
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    manager.saveOps.restoreFromSave(save, { kind: 'live-replacement', nowMs: OUT_OF_DOMAIN_MS })

    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 0)
  })
})
