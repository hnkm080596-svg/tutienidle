// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { spawnSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { existsSync, rmSync } from 'node:fs'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import type { GameSave } from './SaveSystem'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  calculateOfflineTime,
  DEFAULT_MAX_OFFLINE_SECONDS,
} from '../../core/idle/GameClock'
import { pills } from '../../data/pill/pills'
import {
  alchemyJobReservationDigest,
  alchemySecondsFor,
} from '../../core/alchemy/AlchemySystem'
import type { ActiveAlchemyJob, AlchemyJobReservation } from '../../core/alchemy/AlchemySystem'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { buildProfessionMaterialId } from '../../core/profession/ProfessionMaterial'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  SITE_SPEED_MULTIPLIERS,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'

// ============================================================================
// QA repro - fixpoint r22 AUT wave (blind audit of commit bf3b44a1, the
// r21 magnitude pin on every persisted timestamp cursor).
//
// Surface map at this tip:
//  A. THE STACKABLE EXEMPTION - FIXED (r22-AUT-1): boundTimedEffectClocks
//     kept durationStackable expiries VERBATIM (player.ts:131-139) and
//     the gate documented "expiresAtMs-appliedAtMs is NOT bound" for
//     regen claims - parking an EXPIRY minted liveness (9e15 = ~285M
//     years of regen vs 75s authored). The bound now applies to every
//     effect: live stackable claims clamp at provenance + 24h like
//     every sibling class. These probes pin the deny.
//  B. SECOND-ORDER - FIXED (same finding): the stackable refresh
//     clamps every write at 2^52 - 1, so a sub-pin admitted expiry can
//     never be ratcheted out-of-domain by an honest drink.
//  C. NON-TIMESTAMP MAGNITUDE - FIXED (hardening nit): the accrue
//     loop's O(acc) drain is now an O(1) floor-division jump.
//  D. BOUNDARY / RE-DERIVED (PASS arms) - exact 2^52 gate pins; the
//     mechanism's own 2^53 line still covers non-save feeds; deep-past
//     lastSavedAt vs every settle cap; alchemy's span pin keeps jobs
//     unparkable.
// ============================================================================

declare const process: { env: Record<string, string | undefined> }



// The authored mp_regen pill at the lowest claimable tier (retired only
// at mortal). Its regen shape drives every validator bound below.
const PILL_ID = 'hoi_linh_dan_qi_refining'
const authored = pills.find((pill) => pill.id === PILL_ID)
const authoredRegen = authored?.effects.find((effect) => effect.type === 'regen')
const AUTHORED_DURATION_S = authoredRegen?.durationSeconds ?? 75
const AUTHORED_MAX_FLAT = (authoredRegen?.mpPerSecond ?? 0) * 1.5

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

function craftedStackableEffect(expiresAtMs: number, appliedAtMs = 1_000): PersistentTimedEffect {
  return {
    id: 'fx-craft',
    sourceItemId: PILL_ID,
    appliedAtMs,
    expiresAtMs,
    effectGroup: 'hoi_linh_dan', // authored regen effectGroup = family.id
    durationStackable: true, // authored stackable = true
    modifiers: [
      {
        id: 'm1',
        sourceId: 'fx-craft',
        sourceType: 'pill',
        stat: 'manaRegenPerTurn',
        flat: AUTHORED_MAX_FLAT,
        domain: 'spell',
      },
    ],
  }
}

function saveWithEffect(expiresAtMs: number): Record<string, unknown> {
  const save = validSave()
  const p = save.player as PlayerData
  p.lastSavedAt = 1_760_000_000_000
  p.persistentTimedEffects = [craftedStackableEffect(expiresAtMs)]
  return save
}

const gameManager = new GameManager()

describe('fixpoint r22 AUT - magnitude bound audit (bf3b44a1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // A1 - F-R22-01 arm A (mint), now pinned: the magnitude gate rejects
  // 9e15 outright (bound tightened to |x| < 2^52), and the restore
  // clamp caps any sub-pin live claim at provenance + 24h.
  // ------------------------------------------------------------------
  it('A1 validator REJECTS stackable expiresAtMs = 9e15 (2^52 magnitude pin, r22 fix)', () => {
    const validation = validateGameSaveShape(saveWithEffect(9e15))
    expect(validation.ok).toBe(false)
    const tltTwin = validSave()
    const p = tltTwin.player as PlayerData
    p.lastSavedAt = 1_760_000_000_000
    p.persistentTimedEffects = [
      {
        id: 'fx-tlt',
        sourceItemId: 'tu_linh_tran',
        appliedAtMs: 1_000,
        expiresAtMs: 9e15,
        effectGroup: 'tu_linh_tran',
        cultivationSpeedPercent: 0.25,
        modifiers: [],
      },
    ]
    expect(validateGameSaveShape(tltTwin).ok).toBe(false)
  })

  it('A2 sub-pin far-future stackable expiry (save+30d) restores clamped to provenance+24h - mint dead', () => {
    // The denied shape the gate admits: a 30-day stackable deadline is
    // inside |x| < 2^52 so shape validation passes it, but the restore
    // clamp (no more stackable exemption) bounds it at
    // min(lastSavedAt, authorityNow) + 24h - no permanent mint.
    const playerStore = usePlayerStore()
    const lastSavedAt = 1_760_000_000_000
    const expires = lastSavedAt + 30 * 86_400_000

    const save = saveWithEffect(expires)
    expect(validateGameSaveShape(save).ok).toBe(true)

    playerStore.restoreFromSave(save as unknown as GameSave, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: lastSavedAt + 60_000,
    })

    const stored = playerStore.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(lastSavedAt + TU_LINH_TRAN_DURATION_MS)
    // The parked record no longer claims a live modifier past the
    // class-max window - by authorityNow + 30d the claim is dead.
    const live = gameManager.effectOps.getActiveTimedModifiers(
      playerStore.$state as PlayerData,
      lastSavedAt + 30 * 86_400_000,
    )
    expect(live.some((modifier) => modifier.stat === 'manaRegenPerTurn')).toBe(false)
  })

  // ------------------------------------------------------------------
  // B - F-R22-01 arm B (second-order): an admitted sub-pin expiry plus
  // ONE honest re-drink lands >= 2^53 at write time - the save wedges
  // itself on the very field r21 pinned.
  // ------------------------------------------------------------------
  it('B validator admits expiresAtMs just under 2^52; refresh clamps inside the domain (r22 fix)', () => {
    const TWO_POW_52 = 2 ** 52
    const save = saveWithEffect(TWO_POW_52 - 1_000)
    expect(validateGameSaveShape(save).ok).toBe(true)

    const player = save.player as PlayerData
    const now = 1_760_000_000_000

    // The honest re-drink - same group, authored duration.
    gameManager.effectOps.applyTimedEffect(player, {
      id: `pill-regen:${PILL_ID}:${now}`,
      sourceItemId: PILL_ID,
      appliedAtMs: now,
      expiresAtMs: now + AUTHORED_DURATION_S * 1000,
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      modifiers: [
        {
          id: 'm2',
          sourceId: 'pill',
          sourceType: 'pill',
          stat: 'manaRegenPerTurn',
          flat: (authoredRegen?.mpPerSecond ?? 3),
          domain: 'spell',
        },
      ],
    })

    const rewritten = player.persistentTimedEffects[0]!
    // PINNED DENY: the stackable writer clamps at 2^52 - 1 - the
    // additive refresh can never mint an out-of-domain stamp.
    expect(rewritten.expiresAtMs).toBe(TWO_POW_52 - 1)

    // The save the game itself produced still validates - the
    // self-brick chain is closed.
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  // ------------------------------------------------------------------
  // C - F-R22-02: cultivationInsightAccumulator admitted unbounded;
  // it IS the conversion loop bound - magnitude -> unbounded loop on a
  // non-timestamp field (same class r21 closed on cursors).
  // ------------------------------------------------------------------
  it('C1 PASS arm - the accumulator IS pinned: >= threshold and >0-without-talent both rejected', () => {
    // F-A11-2 already binds cultivationInsightAccumulator to the claimed
    // talents' insight_per_cultivation threshold - the drain loop's own
    // invariant is replayed at admission. Reachability for the hang
    // below is CLOSED at this gate today.
    const withAcc = (acc: number, talents: string[]) => {
      const save = validSave()
      const p = save.player as PlayerData
      p.selectedTalentIds = talents
      p.cultivationInsightAccumulator = acc
      return validateGameSaveShape(save)
    }
    // 1e15 >= every authored threshold (1000..2000) - rejected.
    expect(withAcc(1e15, ['ngo_dao']).ok).toBe(false)
    // Even a tiny claim is impossible without the talent (no writer).
    expect(withAcc(1, []).ok).toBe(false)
    // Honest shape: below the authored threshold - admitted.
    expect(withAcc(1_999, ['ngo_dao']).ok).toBe(true)
  })

  it('C2 mechanism hardening note - the accrue loop itself is unbounded IF reached (child probe dies by timeout)', { timeout: 60_000 }, () => {
    const spec = fileURLToPath(new URL('./auditR22InsightHang.probe.test.ts', import.meta.url))
    const vitestBin = fileURLToPath(new URL('../../../node_modules/.bin/vitest', import.meta.url))
    const marker = fileURLToPath(new URL('./.r22-hang-armed', import.meta.url))
    try {
      rmSync(marker, { force: true })
    } catch {
      // marker cleanup is best-effort
    }
    try {
      // --pool=threads so the kill takes the looping worker down with
      // the process (same harness as the r21 nowMs hang probe).
      const result = spawnSync(vitestBin, ['run', spec, '--reporter=dot', '--pool=threads'], {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: { ...process.env, R22_INSIGHT_HANG_PROBE: '1', R22_HANG_MARKER_FILE: marker },
        timeout: 25_000,
      })

      // FIXED (r22-AUT nit): accrueCultivationInsight now does the
      // O(1) Math.floor(acc/threshold) jump - the armed child completes
      // inside the timeout instead of hanging on a 5e11-step loop.
      expect(existsSync(marker)).toBe(true)
      expect(result.status).toBe(0)
    } finally {
      try {
        rmSync(marker, { force: true })
      } catch {
        // marker cleanup is best-effort
      }
    }
  })

  // ------------------------------------------------------------------
  // D - PASS arms: the pins that DO hold.
  // ------------------------------------------------------------------
  it('D1 boundary: |stamp| == 2^52 rejected, 2^52-1 admitted, +22000 still advances', () => {
    const TWO_POW_52 = 2 ** 52
    const lastSaved = (stamp: number) => {
      const save = validSave()
      ;(save.player as PlayerData).lastSavedAt = stamp
      return validateGameSaveShape(save).ok
    }
    expect(lastSaved(TWO_POW_52)).toBe(false)
    expect(lastSaved(-TWO_POW_52)).toBe(false)
    expect(lastSaved(TWO_POW_52 - 1)).toBe(true)

    // No absorb inside the admitted domain: ulp at [2^51, 2^52) is 1
    // and the smallest authored cycleMs is 22000 (mortal L9:
    // ceil(100/4.6)=22s) - every authored delta advances the cursor.
    const minAuthoredCycleMs =
      computeCycleSeconds(
        CYCLE_BASE_SECONDS_BY_REALM['mortal']!,
        SITE_SPEED_MULTIPLIERS.length,
      ) * 1000
    expect(minAuthoredCycleMs).toBe(22_000)
    const edge = TWO_POW_52 - 1
    expect(edge + minAuthoredCycleMs).toBeGreaterThan(edge)
    expect(edge + 1).not.toBe(edge)
  })

  it('D2 deep-past lastSavedAt (-4e15) is admitted but every settle path self-caps', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = -4e15
    expect(validateGameSaveShape(save).ok).toBe(true)

    // Cultivation/autofarm window: capped at the authored 24h ceiling.
    expect(
      calculateOfflineTime({ lastOnlineAt: -4e15 }).offlineSeconds,
    ).toBe(DEFAULT_MAX_OFFLINE_SECONDS)

    // Production: the negative anchor seeds lane dues far in the past,
    // but every completion is paid from the 10h budget - the walk ends
    // at most budget/cycleMs completions per lane, then jump-forfeits.
    const result = advanceWorkerLanes({
      siteId: 'probe',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [],
      slots: 1,
      nowMs: Date.now(),
      emptyLaneStartMs: -4e15,
      advanceMode: 'deadline',
      budgetMs: PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
    })
    expect(result.completed.length).toBeLessThanOrEqual(
      Math.ceil((PRODUCTION_OFFLINE_CAP_SECONDS * 1000) / 100_000) + 1,
    )
  })

  it('D3 alchemy pair cannot park far-future - startedAtMs <= lastSavedAt pin', () => {
    const recipe = alchemyRecipes.find(
      (candidate) => candidate.realmId === 'mortal' && candidate.retired !== true,
    )!
    const variant = recipe.herbVariants[0]!
    const spanMs = alchemySecondsFor(recipe, 1) * 1000

    // Self-consistent except the impossible startedAtMs: digest replays,
    // span exact, ordering holds - so the ONLY issue is the pin.
    const job = {
      jobId: 'r22_alch_job_1',
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: variant.materialId,
      startedAtMs: 4e15 - spanMs,
      completesAtMs: 4e15,
      roomLevelAtStart: 1,
    }
    const witness: Omit<AlchemyJobReservation, 'digest'> = {
      woodId: buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age),
      fuelWoodAmount: recipe.fuelWoodAmount,
      spiritStoneCost: recipe.spiritStoneCost,
      herbAmount: recipe.herbAmount,
      specialIngredients: recipe.specialIngredients ?? [],
      costScale: 1,
    }
    const fullJob: ActiveAlchemyJob = {
      ...job,
      reservation: {
        ...witness,
        digest: alchemyJobReservationDigest(job as ActiveAlchemyJob, witness),
      },
    }

    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = 1_760_000_000_000
    save.buildings = [
      { instanceId: 'r22_b1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
    ]
    save.alchemyJobs = [fullJob]

    // A far-future completesAtMs needs an even-later startedAtMs, which
    // the startedAtMs <= lastSavedAt pin rejects - jobs stay unparkable.
    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(false)
    expect(
      validation.issues.every((issue) => issue.path.includes('startedAtMs')),
    ).toBe(true)
  })
})
