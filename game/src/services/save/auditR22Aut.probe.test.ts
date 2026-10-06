// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { spawnSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { existsSync, rmSync } from 'node:fs'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
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
//  A. THE STACKABLE EXEMPTION - boundTimedEffectClocks keeps
//     durationStackable expiries VERBATIM (player.ts:131-139), and the
//     shape gate explicitly documents "expiresAtMs-appliedAtMs is NOT
//     bound" for regen claims (saveShapeValidation.ts:1657). The r21
//     adjudication classified sub-pin far-future as "deny-direction
//     self-park" - this probe tests whether a 9e15 stackable expiry
//     mints (permanent live buff) instead of parking.
//  B. SECOND-ORDER - applyTimedEffect's stackable refresh is
//     ADDITIVE (max(now, expires) + duration): a sub-pin admitted
//     expiry in (2^53 - dur, 2^53) crosses the domain bound at write
//     time and wedges the save it wrote.
//  C. NON-TIMESTAMP MAGNITUDE - cultivationInsightAccumulator is
//     requireNonNegativeNumber only and feeds a while(acc >= threshold)
//     loop on every cultivate tick + the offline accrue - the r21
//     magnitude->unbounded-loop class on a non-timestamp field.
//  D. BOUNDARY / RE-DERIVED (PASS arms) - exact 2^53 pins; deep-past
//     lastSavedAt vs every settle cap; alchemy's span pin keeps jobs
//     unparkable.
// ============================================================================

declare const process: { env: Record<string, string | undefined> }

const TWO_POW_53 = 2 ** 53 // 9007199254740992

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
  // ------------------------------------------------------------------
  // A1 - F-R22-01 arm A (mint): validator ADMITS the crafted stackable
  // expiry, and the live modifier read returns it NOW - the field is
  // grant-direction, not the documented deny-direction park.
  // ------------------------------------------------------------------
  it('A1 validator ADMITS stackable expiresAtMs = 9e15 - no forward bound (F-R22-01)', () => {
    const validation = validateGameSaveShape(saveWithEffect(9e15))
    expect(validation.ok).toBe(true)
    // Control: the same magnitude on a NON-stackable sibling field is
    // not what was admitted - prove the exemption is specific to the
    // stackable arm by rejecting the TLT-typed twin (TLT has a
    // provenance bound; regen-stackable has none).
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

  it('A2 restored stackable expiry stays live - modifier readable at boot now (mint arm)', () => {
    // boundTimedEffectClocks exempts durationStackable from every clamp
    // (player.ts:131) - the admitted record reaches live state verbatim.
    const player = createDefaultPlayer()
    player.persistentTimedEffects = [craftedStackableEffect(9e15)]
    const live = gameManager.effectOps.getActiveTimedModifiers(player, Date.now())
    expect(live.some((modifier) => modifier.stat === 'manaRegenPerTurn')).toBe(true)
  })

  // ------------------------------------------------------------------
  // B - F-R22-01 arm B (second-order): an admitted sub-pin expiry plus
  // ONE honest re-drink lands >= 2^53 at write time - the save wedges
  // itself on the very field r21 pinned.
  // ------------------------------------------------------------------
  it('B validator admits expiresAtMs just under 2^53; one refresh writes an out-of-domain stamp', () => {
    const save = saveWithEffect(TWO_POW_53 - 1_000)
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
    expect(rewritten.expiresAtMs).toBeGreaterThanOrEqual(TWO_POW_53)

    // The writer persisted it verbatim - the NEXT load rejects the
    // save the game itself produced (self-brick, no external edit).
    expect(validateGameSaveShape(save).ok).toBe(false)
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

      // MECHANISM GAP (admission closed today): the child armed the
      // call (reached it, not a startup crash) and was still inside
      // the loop when the timeout killed it - the loop is O(acc) not
      // O(1). Any future admission path that re-opens the magnitude
      // wedges on the first tick; a Math.floor(acc/threshold) jump is
      // the defensive fix.
      expect(existsSync(marker)).toBe(true)
      expect(result.status).not.toBe(0)
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
  it('D1 boundary: |stamp| == 2^53 rejected, 2^53-1 admitted, +22000 still advances', () => {
    const lastSaved = (stamp: number) => {
      const save = validSave()
      ;(save.player as PlayerData).lastSavedAt = stamp
      return validateGameSaveShape(save).ok
    }
    expect(lastSaved(TWO_POW_53)).toBe(false)
    expect(lastSaved(-TWO_POW_53)).toBe(false)
    expect(lastSaved(TWO_POW_53 - 1)).toBe(true)

    // No absorb inside the admitted domain: ulp at [2^52, 2^53) is 1
    // and the smallest authored cycleMs is 22000 (mortal L9:
    // ceil(100/4.6)=22s) - every authored delta advances the cursor.
    const minAuthoredCycleMs =
      computeCycleSeconds(
        CYCLE_BASE_SECONDS_BY_REALM['mortal']!,
        SITE_SPEED_MULTIPLIERS.length,
      ) * 1000
    expect(minAuthoredCycleMs).toBe(22_000)
    const edge = TWO_POW_53 - 1
    expect(edge + minAuthoredCycleMs).toBeGreaterThan(edge)
    expect(edge + 1).not.toBe(edge)
  })

  it('D2 deep-past lastSavedAt (-9e15) is admitted but every settle path self-caps', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = -9e15
    expect(validateGameSaveShape(save).ok).toBe(true)

    // Cultivation/autofarm window: capped at the authored 24h ceiling.
    expect(
      calculateOfflineTime({ lastOnlineAt: -9e15 }).offlineSeconds,
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
      emptyLaneStartMs: -9e15,
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
      startedAtMs: 9e15 - spanMs,
      completesAtMs: 9e15,
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
