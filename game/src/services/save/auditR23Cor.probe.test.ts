// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { GameManager } from '../../core/game/GameManager'
import { accrueCultivationInsight } from '../../core/cultivation/CultivationInsight'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'
import { STAGES } from '../../data/stage/Stages'
import { buildGameSave } from './SaveSystem'
import type { GameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'

// ============================================================================
// QA probe - fixpoint r23 COR wave. Audits the r22 batch (da0d553d):
//
//   (a) boundTimedEffectClocks now clamps EVERY persisted timed effect,
//       stackable included - live arm at provenance + 24h, dead arm at
//       min(nowMs, Date.now()). Attack: honest boundary shapes must not
//       be wrongly clamped (expires == lastSavedAt, == provenance+24h,
//       fast-clock provenance asymmetry, over-24h honest chains).
//   (c) isBoundedTimestamp tightened to |x| < 2^52 on every persisted
//       cursor - r21-legal stamps in (2^52, 2^53) must reject, BOUND-1
//       must admit (the writer clamp lands exactly there).
//   (d) accrueCultivationInsight is O(1) floor-division - must mint the
//       identical result as the old loop in the honest domain, and the
//       exact divergence shape at mechanism-level magnitude is pinned.
//   (e) --pool=threads child probes: covered by fixpointR20Cor.qa.test.ts
//       running clean on vitest 4.1.11 (verified in wave report).
// ============================================================================

const BOUND = 2 ** 52 // 4_503_599_627_370_496
const DAY_MS = 24 * 60 * 60 * 1000

// Same minimal-save helper shape as player.restoreFromSave.test.ts -
// restoreFromSave deliberately does NOT re-run the validator, which is
// what makes it the right seam for probing the clamp arms directly.
function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 10,
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
    lastRefinementRegenAtMs: Date.now(),
    lastSavedAt: Date.now(),
  }

  return { player: { ...base, ...playerOverrides } } as unknown as GameSave
}

function stackableRegenEffect(expiresAtMs: number): PersistentTimedEffect {
  return {
    id: 'r23_stack',
    sourceItemId: 'hoi_linh_dan',
    effectGroup: 'pill_regen',
    durationStackable: true,
    appliedAtMs: 1_000_000_000_000,
    expiresAtMs,
    modifiers: [
      {
        id: 'r23_m1',
        sourceId: 'r23_stack',
        sourceType: 'pill',
        stat: 'manaRegenPerTurn',
        flat: 2,
        domain: 'spell',
      },
    ],
  }
}

function tltEffect(expiresAtMs: number): PersistentTimedEffect {
  return {
    id: 'r23_tlt',
    sourceItemId: 'tu_linh_tran',
    effectGroup: 'tu_linh_tran',
    durationStackable: false,
    appliedAtMs: 1_000_000_000_000,
    expiresAtMs,
    cultivationSpeedPercent: 0.25,
    modifiers: [],
  }
}

let currentMs = 1_725_160_000_000

describe('auditR23 COR probe - timed-effect clamp boundary (attack a)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stackable expires == provenance + 24h passes the live arm whole', () => {
    // Boundary equality on the live arm: min(expires, prov+24h) must
    // return the stamp verbatim when expires IS the bound. A `<` where
    // `<=` belongs would silently shave an honest record at exactly
    // its authored ceiling.
    const player = usePlayerStore()
    const save = buildMinimalSave({
      lastSavedAt: currentMs,
      persistentTimedEffects: [
        stackableRegenEffect(currentMs + TU_LINH_TRAN_DURATION_MS),
      ],
    })

    player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    expect(effect.expiresAtMs).toBe(currentMs + TU_LINH_TRAN_DURATION_MS)
  })

  it('stackable expires == lastSavedAt takes the dead arm (<=, not <)', () => {
    // Dead arm boundary: expires == lastSavedAt means the record was
    // already dead in the payload epoch. The arm test is `<=` - one
    // ms past the marker is live, at the marker is dead.
    const player = usePlayerStore()
    const save = buildMinimalSave({
      lastSavedAt: currentMs,
      persistentTimedEffects: [stackableRegenEffect(currentMs)],
    })

    player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    expect(effect.expiresAtMs).toBeLessThanOrEqual(currentMs)
  })

  it('stackable expires == lastSavedAt + 1ms is live and survives whole', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      lastSavedAt: currentMs,
      persistentTimedEffects: [stackableRegenEffect(currentMs + 1)],
    })

    player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    expect(effect.expiresAtMs).toBe(currentMs + 1)
  })

  it('TLT (non-stackable) expires == lastSavedAt + 24h survives; +1ms clamps', () => {
    // TLT is the class the 24h bound was authored for - the equality
    // boundary must hold for it too.
    const live = usePlayerStore()
    live.restoreFromSave(
      buildMinimalSave({
        lastSavedAt: currentMs,
        persistentTimedEffects: [tltEffect(currentMs + DAY_MS)],
      }),
    )
    expect(live.persistentTimedEffects[0]!.expiresAtMs).toBe(
      currentMs + DAY_MS,
    )

    setActivePinia(createPinia())
    const over = usePlayerStore()
    over.restoreFromSave(
      buildMinimalSave({
        lastSavedAt: currentMs,
        persistentTimedEffects: [tltEffect(currentMs + DAY_MS + 1)],
      }),
    )
    expect(over.persistentTimedEffects[0]!.expiresAtMs).toBe(
      currentMs + DAY_MS,
    )
  })

  it('honest stackable chain accumulated past prov+24h truncates at the bound (accepted residual)', () => {
    // r22 accepted residual, pinned: durationStackable expiry accrues
    // per drink, so a chain whose honest tail lands past
    // provenance+24h loses the overflow (deny-direction: expires only
    // shrinks, never mints). Regen durations are 60-195s, so this needs
    // ~440+ accumulated drinks in one group; the truncation repeats on
    // every restore until the stamp re-enters the window.
    const player = usePlayerStore()
    const save = buildMinimalSave({
      lastSavedAt: currentMs,
      persistentTimedEffects: [stackableRegenEffect(currentMs + 30 * 3_600_000)],
    })

    player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    expect(effect.expiresAtMs).toBe(currentMs + DAY_MS)
  })

  it('fast-clock save narrows the live bound to authorityNow + 24h (deny-direction)', () => {
    // provenance = min(lastSavedAt, authorityNow): a save whose payload
    // clock ran 2h fast keeps the bound at now+24h. A claim expiring
    // 30h past the payload marker loses (30h - 24h - 2h skew) of tail.
    const player = usePlayerStore()
    const fastSavedAt = currentMs + 2 * 3_600_000
    const save = buildMinimalSave({
      lastSavedAt: fastSavedAt,
      persistentTimedEffects: [stackableRegenEffect(fastSavedAt + 30 * 3_600_000)],
    })

    player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    // bound is authorityNow+24h (currentMs+24h), NOT lastSavedAt+24h.
    expect(effect.expiresAtMs).toBe(currentMs + DAY_MS)
  })

  it('slow-clock dead arm: expires <= lastSavedAt still clamps dead even if stamp reads future', () => {
    // Device clock 3h behind the payload epoch: the record is dead at
    // save (expires <= lastSavedAt) and must stay dead - the dead arm
    // clamps at min(nowMs, Date.now()), not provenance+duration, so a
    // slow authority clock cannot revive it.
    const player = usePlayerStore()
    const savedAt = currentMs + 3 * 3_600_000
    const save = buildMinimalSave({
      lastSavedAt: savedAt,
      persistentTimedEffects: [stackableRegenEffect(currentMs + 3_600_000)],
    })

    player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    expect(effect.expiresAtMs).toBeLessThanOrEqual(currentMs)
  })
})

describe('auditR23 COR probe - 2^52 admission band (attack c)', () => {
  // Stamps in (2^52, 2^53) were r21-legal; the tightened gate must
  // reject them. Positive control: BOUND - 1 admits (the writer clamp
  // lands exactly there). No honest writer emits stamps in the band -
  // every persisted cursor is now-anchored or clamped at BOUND - 1.
  const BAND = 4_600_000_000_000_000 // inside (2^52, 2^53)

  function cleanSave() {
    return buildGameSave(createDefaultPlayer(), new GameManager())
  }

  it('player.lastSavedAt in (2^52, 2^53) rejects; BOUND-1 admits', () => {
    const over = cleanSave()
    over.player.lastSavedAt = BAND
    expect(validateGameSaveShape(over).ok).toBe(false)

    const atBound = cleanSave()
    atBound.player.lastSavedAt = BOUND
    expect(validateGameSaveShape(atBound).ok).toBe(false)

    const admitted = cleanSave()
    admitted.player.lastSavedAt = BOUND - 1
    const result = validateGameSaveShape(admitted)
    expect(result.ok, JSON.stringify(result.issues)).toBe(true)
  })

  it('stackable regen expiresAtMs in (2^52, 2^53) rejects (isolated pin: no forward bound)', () => {
    // pill regen records have NO forward deadline bound at admission -
    // only the timestamp gate stops a far-future stackable expiry.
    const save = cleanSave()
    save.player.persistentTimedEffects = [
      stackableRegenEffect(BAND),
    ] as unknown as typeof save.player.persistentTimedEffects

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('player.autoFarmStage.lastCheckedMs in (2^52, 2^53) rejects', () => {
    const save = cleanSave()
    save.player.autoFarmStage = {
      stageId: STAGES[0]!.id,
      lastCheckedMs: BAND,
    } as unknown as typeof save.player.autoFarmStage

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('player.autoWorkerCapacity > 65536 rejects; 65536 admits', () => {
    const over = cleanSave()
    over.player.autoWorkerCapacity = 65_537
    expect(validateGameSaveShape(over).ok).toBe(false)

    // F-W-16 sibling pin: capacity > 0 requires a chi_hien_quan
    // instance in buildings - include one so ONLY the 65536 bound is
    // under test here.
    const atBound = cleanSave()
    atBound.player.autoWorkerCapacity = 65_536
    atBound.buildings = [
      {
        instanceId: 'inst_r23_chq',
        buildingId: 'chi_hien_quan',
        level: 1,
        lastCollectedAt: Date.now(),
      },
    ] as unknown as typeof atBound.buildings
    const result = validateGameSaveShape(atBound)
    expect(result.ok, JSON.stringify(result.issues)).toBe(true)
  })
})

describe('auditR23 COR probe - writer clamp downstream (attack b)', () => {
  it('an expiry clamped at BOUND-1 still reads live in getActiveTimedModifiers', () => {
    // The clamped stamp is ~4.5e15 (far future in wall time): liveness
    // is `expiresAtMs > now` - the comparison is unaffected by the
    // stamp's magnitude, so a clamped record keeps paying its modifier.
    const player = createDefaultPlayer()
    player.persistentTimedEffects = [
      {
        ...stackableRegenEffect(BOUND - 1),
        modifiers: [
          {
            id: 'r23_live_m',
            sourceId: 'r23_stack',
            sourceType: 'pill',
            stat: 'manaRegenPerTurn',
            flat: 7,
            domain: 'spell',
          },
        ],
      },
    ]

    const mods = new GameManager().effectOps.getActiveTimedModifiers(player, Date.now())
    expect(mods.some((m) => m.id === 'r23_live_m')).toBe(true)
  })
})

describe('auditR23 COR probe - O(1) insight drain vs loop (attack d)', () => {
  function referenceLoop(acc: number, threshold: number): { acc: number; minted: number } {
    let minted = 0
    while (acc >= threshold) {
      acc -= threshold
      minted += 1
    }
    return { acc, minted }
  }

  function insightPlayer() {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ngo_dao'] // authored threshold 2000
    return player
  }

  it('honest-domain equivalence: identical mint + remainder vs the old loop', () => {
    // Boundaries +-ulp around every multiple of 2000 up to a magnitude
    // the reference loop can still run, plus a random sweep. The drain
    // must produce the SAME (minted, remainder) pair the loop produced.
    const threshold = 2000
    const cases: number[] = []
    for (let k = 1; k <= 5000; k++) {
      cases.push(k * threshold - 1, k * threshold, k * threshold + 1)
    }
    let rngState = 0x9e3779b9
    const nextRandom = () => {
      rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5
      return Math.abs(rngState) % 10_000_000
    }
    for (let i = 0; i < 20_000; i++) cases.push(nextRandom())

    for (const acc of cases) {
      const player = insightPlayer()
      player.cultivationInsightAccumulator = acc
      accrueCultivationInsight(player, 0.5) // gained>0 required; +0.5 lands inside the same window
      const expectedAfter = referenceLoop(acc + 0.5, threshold)
      expect(
        player.cultivationInsightAccumulator,
        `acc=${acc}`,
      ).toBe(expectedAfter.acc)
      expect(player.skillInsight).toBe(expectedAfter.minted)
      expect(player.totalSkillInsightGained).toBe(expectedAfter.minted)
    }
  })

  it('MECHANISM EDGE: product rounding breaks the remainder invariant at acc >= ~4.6e18 (r23 finding)', () => {
    // steps*threshold >= 2^53 loses exactness: for acc =
    // 4600000000000073728 (a legal float, fed by a single huge
    // `gained`), floor(acc/2000) = 2300000000000037 but
    // steps*threshold rounds to acc + 512 - the remainder lands at
    // -512 < 0. The persisted accumulator then fails
    // requireNonNegativeNumber on the NEXT save, wedging it.
    //
    // Reachability: LOW. Honest accumulators are always < threshold
    // and honest gained is cultivation-delta bounded (cps * tick,
    // cap-clamped offline) - nowhere near 1e18. Every admission path
    // (F-A11-2: acc >= threshold rejects; non-negative pin) blocks the
    // crafted shape. Mechanism-level only.
    const player = insightPlayer()
    player.cultivationInsightAccumulator = 0
    accrueCultivationInsight(player, 4_600_000_000_000_073_700)

    expect(player.skillInsight).toBe(2300000000000037)
    // PINNED BREAK: the remainder is negative - outside [0, threshold)
    // the old loop guaranteed. The next save's own validator rejects it.
    expect(player.cultivationInsightAccumulator).toBe(-512)
    expect(
      validateGameSaveShape(buildGameSave(player, new GameManager())).ok,
    ).toBe(false)
  })

  it('DATA HAZARD: a fractional threshold would diverge from the loop (unauthored today)', () => {
    // The drain's comment claims an identical result - only true for
    // INTEGER thresholds. For a fractional authored n (e.g. 0.3) the
    // two forms disagree even at small magnitudes: floor(acc/t) can
    // mint one more/less than the loop and the product-subtraction can
    // leave a negative remainder. All authored insight_per_cultivation
    // values are integers (2000/1500/1000), so this is latent - pin it
    // before a data entry ever ships a fraction.
    const t = 0.3
    let divergenceFound = false
    for (let k = 1; k < 100 && !divergenceFound; k++) {
      const acc = k * t
      const steps = Math.floor(acc / t)
      const rem = acc - steps * t
      const loop = referenceLoop(acc, t)
      if (steps !== loop.minted || rem !== loop.acc) divergenceFound = true
    }
    expect(divergenceFound).toBe(true)
  })
})
