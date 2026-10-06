import { describe, expect, it, vi } from 'vitest'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { GameManager } from '../../core/game/GameManager'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'

// DecomposeSystem is scope-hidden in the current beta - same unlock
// pattern as DecomposeSystem.test.ts so settleOffline runs its real arm.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import type { DecomposeSaveState } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { PRODUCTION_OFFLINE_CAP_SECONDS } from '../../core/production/ProductionBalance'

// ============================================================================
// QA probe - fixpoint r22 COR wave: WRITE-side ratchet escapes the r21
// admission bound (2^53 magnitude pin on every persisted timestamp).
//
// The r21 batch pinned the READ side (admission) only. The pill-regen
// durationStackable arm of applyTimedEffect is the ONE writer that ADDS
// to a persisted stamp:
//
//   existing.expiresAtMs = Math.max(Date.now(), existing.expiresAtMs) + duration
//
// A crafted-but-admitted stackable expiresAtMs parked just under 2^53 is
// therefore NOT inert (unlike the "parked" residual the r21 adjudication
// accepted for read-only stamps): a single honest re-drink of the same
// pill family ratchets the stamp OVER the bound, buildGameSave persists
// the out-of-domain value verbatim, and the NEXT validateGameSaveShape
// permanently rejects the save (export/delete recovery = save loss).
//
// Chain under test:
//   (1) forged save with crafted effect admits (all authored-shape pins met)
//   (2) honest applyTimedEffect (60s duration, same effectGroup) extends
//       the parked stamp past 2^53
//   (3) rebuild + revalidate -> REJECTED at expiresAtMs
// ============================================================================

const BOUND = 2 ** 53 // 9_007_199_254_740_992

// Crafted deadline: inside the admission domain but within one authored
// pill duration (mortal regen = 60_000ms) of the bound.
const CRAFTED_EXPIRES = 9_007_199_254_700_000

const craftedEffect: PersistentTimedEffect = {
  id: 'r22_craft_1',
  sourceItemId: 'hoi_linh_dan_mortal',
  effectGroup: 'hoi_linh_dan',
  durationStackable: true,
  appliedAtMs: 1_000_000_000_000,
  expiresAtMs: CRAFTED_EXPIRES,
  modifiers: [
    {
      id: 'r22_m1',
      sourceId: 'r22_craft_1',
      sourceType: 'pill',
      stat: 'manaRegenPerTurn',
      flat: 2,
      domain: 'spell',
    },
  ],
}

describe('auditR22 COR probe - write-side ratchet vs 2^53 admission bound', () => {
  it('crafted sub-bound stackable expiry admits, then one honest drink wedges the save', () => {
    // (1) forge: honest save shape + injected crafted effect -> admitted.
    const forgedSave = buildGameSave(createDefaultPlayer(), new GameManager())
    forgedSave.player.persistentTimedEffects = [
      JSON.parse(JSON.stringify(craftedEffect)) as PersistentTimedEffect,
    ]

    const admission = validateGameSaveShape(forgedSave)
    expect(admission.ok, JSON.stringify(admission.issues)).toBe(true)

    // Post-restore state: boundTimedEffectClocks passes a stackable
    // expiresAtMs through verbatim (stores/player.ts:135-143), so the
    // live player carries the parked stamp unchanged.
    const player = createDefaultPlayer()
    player.persistentTimedEffects = [
      JSON.parse(JSON.stringify(craftedEffect)) as PersistentTimedEffect,
    ]

    // (2) one honest re-drink of the same family: the writer mints
    // appliedAtMs=now / expiresAtMs=now+60_000, so duration=60_000.
    const now = Date.now()
    const honestDrink: PersistentTimedEffect = {
      id: 'r22_honest_1',
      sourceItemId: 'hoi_linh_dan_mortal',
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      appliedAtMs: now,
      expiresAtMs: now + 60_000,
      modifiers: [
        {
          id: 'r22_m2',
          sourceId: 'r22_honest_1',
          sourceType: 'pill',
          stat: 'manaRegenPerTurn',
          flat: 2,
          domain: 'spell',
        },
      ],
    }

    new GameManager().effectOps.applyTimedEffect(player, honestDrink)

    // Ratchet landed past the bound: the persisted stamp is now a value
    // the r21 admission pin itself rejects.
    expect(player.persistentTimedEffects).toHaveLength(1)
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBeGreaterThanOrEqual(BOUND)

    // (3) next save+load cycle: buildGameSave persists it verbatim and
    // the validator permanently rejects the save.
    const secondSave = buildGameSave(player, new GameManager())
    const revalidation = validateGameSaveShape(secondSave)
    expect(revalidation.ok).toBe(false)
    expect(
      revalidation.issues.some(
        (issue) => issue.path === 'player.persistentTimedEffects[0].expiresAtMs',
      ),
    ).toBe(true)
  })

  it('control: honest sub-bound stackable expiry stays admitted across the same drink', () => {
    const player = createDefaultPlayer()
    const now = Date.now()
    player.persistentTimedEffects = [
      {
        id: 'r22_ok_1',
        sourceItemId: 'hoi_linh_dan_mortal',
        effectGroup: 'hoi_linh_dan',
        durationStackable: true,
        appliedAtMs: now - 30_000,
        expiresAtMs: now + 30_000,
        modifiers: [
          {
            id: 'r22_m3',
            sourceId: 'r22_ok_1',
            sourceType: 'pill',
            stat: 'manaRegenPerTurn',
            flat: 2,
            domain: 'spell',
          },
        ],
      },
    ]

    new GameManager().effectOps.applyTimedEffect(player, {
      id: 'r22_ok_2',
      sourceItemId: 'hoi_linh_dan_mortal',
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      appliedAtMs: now,
      expiresAtMs: now + 60_000,
      modifiers: [
        {
          id: 'r22_m4',
          sourceId: 'r22_ok_2',
          sourceType: 'pill',
          stat: 'manaRegenPerTurn',
          flat: 2,
          domain: 'spell',
        },
      ],
    })

    const save = buildGameSave(player, new GameManager())
    const validation = validateGameSaveShape(save)
    expect(validation.ok, JSON.stringify(validation.issues)).toBe(true)
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBeLessThan(BOUND)
  })
})

// ============================================================================
// Differential probe - DecomposeSystem.settleOffline O(1) jump (r21) vs
// the r20 stepping loop it replaced. Faithful old-stepping replica over
// the same window arithmetic; asserts identical landing + settled count
// on every edge (exact divisor, n0==end, windowStart<nextCycleAt,
// nextCycleAt already past end/now, crafted-future offlineSince, cap
// window pin, sub-pin admitted n0).
// ============================================================================

const DECOMPOSE_CYCLE_MS = 30_000

function simulateOldStepping(
  n0: number,
  cycleMs: number,
  nowMs: number,
  offlineSinceMs: number,
): { landed: number; settled: number } {
  const windowStartMs = Math.max(
    n0 - cycleMs,
    Math.floor(offlineSinceMs),
    nowMs - PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
  )
  const fastForwardEndMs = Math.min(windowStartMs, nowMs)
  let n = n0
  while (n <= fastForwardEndMs) {
    n += cycleMs
  }
  let settled = 0
  while (n <= nowMs && settled < 5000) {
    settled += 1
    n += cycleMs
  }
  return { landed: n, settled }
}

function runRealSettle(
  nextCycleAt: number,
  cycleSeconds: number,
  nowMs: number,
  offlineSinceMs: number,
): { landed: number; settled: number } {
  const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds })
  system.updateCapacity(4)
  const state: DecomposeSaveState = {
    started: true,
    settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
    nextCycleAt,
  }
  system.restore(state)
  const settled = system.settleOffline(nowMs, offlineSinceMs)
  return { landed: system.getSaveState().nextCycleAt, settled }
}

describe('auditR22 COR probe - decompose O(1) jump vs r20 stepping loop', () => {
  const NOW = 1_725_160_000_000

  it.each([
    // [label, nextCycleAt, nowMs, offlineSinceMs]
    // n0 = end - cycleMs exactly: quotient integer -> both take one step past end.
    ['exact divisor: n0 sits one cycle below end', NOW - 30_030_000, NOW, NOW - 30_000_000],
    ['n0 == fastForwardEnd: exactly one step', NOW - 36_000_000, NOW, 0],
    ['windowStart < nextCycleAt: no fast-forward', NOW - 150_000, NOW, 0],
    ['nextCycleAt already past now: zero settle', NOW + 9_000_000, NOW, 0],
    ['crafted-future offlineSince forces end > n0', 1_000_000_000_000, 1_000_000_100_000, 1_000_000_000_005],
    ['cap window pin (10h) dominates deep-past n0', 0, NOW, 0],
    ['n0 inside settle window: all dues complete', NOW - 150_000, NOW, NOW - 600_000],
    ['sub-pin admitted huge n0 stays parked', 9e15, NOW, 0],
    ['fractional remainder c-1 below boundary', 1, NOW, 0],
    ['n0 one ms after cap edge', NOW - 36_000_001, NOW, NOW - 36_000_001],
    ['n0 exactly at cap edge', NOW - 36_000_000, NOW, NOW - 36_000_000],
    ['n0 mid-window non-divisor', NOW - 25_000_000, NOW, 0],
    ['deep-past n0 with mid offlineSince', 10_000, NOW, NOW - 3_600_000],
  ])('landing + settled identical: %s', (_label, n0, nowMs, offlineSince) => {
    const real = runRealSettle(n0, DECOMPOSE_CYCLE_MS / 1000, nowMs, offlineSince)
    // Restore clamps the injected cursor the same way both eras did.
    const n0Clamped = Number.isFinite(Math.floor(n0)) ? Math.max(0, Math.floor(n0)) : 0
    const old = simulateOldStepping(n0Clamped, DECOMPOSE_CYCLE_MS, nowMs, offlineSince)
    expect(real.landed).toBe(old.landed)
    expect(real.settled).toBe(old.settled)
  })

  it('cycleMs = 0: new arm exits bounded (old stepping hung forever)', () => {
    // cycleSeconds=0 -> cycleMs=0. Old code: while(n<=end) n+=0 hangs.
    // New code: cycleMs>0 guard skips the jump, bounded settle loop
    // drains at most 5000 completions and exits.
    const start = Date.now()
    const real = runRealSettle(1_000_000, 0, NOW, 0)
    expect(Date.now() - start).toBeLessThan(5_000)
    expect(real.settled).toBeLessThanOrEqual(5000)
    expect(real.landed).toBe(1_000_000)
  })

  it('cycleMs < 0: new arm exits bounded (old stepping ran away negative)', () => {
    // cycleMs=-30_000: fast-forward guard skips (cycleMs>0 fails); the
    // bounded settle loop walks nextCycleAt DOWN 30s per completion,
    // exits at the 5000 cap. Old stepping decremented n forever inside
    // the fast-forward loop (infinite hang).
    const real = runRealSettle(1_000_000, -30, NOW, 0)
    expect(real.settled).toBe(5000)
    expect(real.landed).toBe(1_000_000 - 5000 * 30_000)
  })
})
