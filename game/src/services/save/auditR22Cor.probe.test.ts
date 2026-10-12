import { describe, expect, it, vi } from 'vitest'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { GameManager } from '../../core/game/GameManager'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'

// Legacy decompose timers remain accepted as inert save data.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'

// ============================================================================
// QA probe - fixpoint r22 COR wave: WRITE-side ratchet vs the
// admission bound. WAS (r22-COR-1): the r21 batch pinned the READ
// side only; the pill-regen durationStackable arm of applyTimedEffect
// is the ONE writer that ADDS to a persisted stamp:
//
//   existing.expiresAtMs = Math.max(Date.now(), existing.expiresAtMs) + duration
//
// A crafted-but-admitted stackable expiresAtMs parked just under the
// bound was NOT inert: one honest re-drink ratcheted the stamp OVER
// the bound, buildGameSave persisted it verbatim, and the next
// validateGameSaveShape permanently rejected the save - a parked
// record becoming save loss through normal play.
//
// r22 fix: the write clamps inside the admitted domain (|x| < 2^52,
// tightened from 2^53 for derivation headroom). Chain pinned:
//   (1) forged save with crafted effect admits (all authored-shape pins met)
//   (2) honest applyTimedEffect (60s) clamps the stamp at 2^52 - 1
//   (3) rebuild + revalidate -> still ADMITTED (save never bricks)
// ============================================================================

const BOUND = 2 ** 52 // 4_503_599_627_370_496

// Crafted deadline: inside the admission domain but within one
// authored pill duration (60_000ms) of the bound.
const CRAFTED_EXPIRES = BOUND - 40_000

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

describe('auditR22 COR probe - write-side ratchet vs 2^52 admission bound', () => {
  it('crafted sub-bound stackable expiry admits; honest drink clamps inside the domain (r22 fix)', () => {
    // (1) forge: honest save shape + injected crafted effect -> admitted.
    const forgedSave = buildGameSave(createDefaultPlayer(), new GameManager())
    forgedSave.player.persistentTimedEffects = [
      JSON.parse(JSON.stringify(craftedEffect)) as PersistentTimedEffect,
    ]

    const admission = validateGameSaveShape(forgedSave)
    expect(admission.ok, JSON.stringify(admission.issues)).toBe(true)

    // Post-admission state: the parked stamp survives the gate, and
    // boundTimedEffectClocks (stores/player.ts) bounds it at
    // provenance + 24h on the next restore - never a verbatim
    // carry-through, never a mint. This spec drives the live path
    // directly so the persisted stamp feeds the re-drink unchanged.
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

    // PINNED DENY (r22 fix): the write clamps at BOUND - 1 - the ratchet
    // cannot carry the persisted stamp out of the admitted domain.
    expect(player.persistentTimedEffects).toHaveLength(1)
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(BOUND - 1)

    // (3) next save+load cycle: the write stayed inside the domain, so
    // the rebuilt save still validates - the save can never brick
    // through normal play, and the parked deadline itself is bounded
    // by the restore clamp (r22-AUT-1).
    const secondSave = buildGameSave(player, new GameManager())
    const revalidation = validateGameSaveShape(secondSave)
    expect(revalidation.ok, JSON.stringify(revalidation.issues)).toBe(true)
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
    // Stack semantics unchanged: the live expiry extends by the full
    // authored duration from its own deadline (now+30s + 60s).
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(now + 90_000)
  })
})

describe('auditR22 COR probe - legacy decompose timer is inert', () => {
  it('restore accepts old worker fields without settling or mutating inventory', () => {
    const bag = new MaterialBag()
    const system = new DecomposeSystem(bag)
    system.restore({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: 0,
      started: true,
    })

    expect(system.getSaveState()).toEqual({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    })
    expect(bag.getAll()).toHaveLength(0)
  })
})
