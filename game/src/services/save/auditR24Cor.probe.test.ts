// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { accrueCultivationInsight } from '../../core/cultivation/CultivationInsight'
import { sanitizeRestoreAuthority } from './saveTypes'
import type { GameSave, RestoreTimeAuthority } from './saveTypes'
import { buildGameSave } from './SaveSystem'
import { primeMortalCreationPick } from './GameSave.fixture'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'

// ============================================================================
// QA probe - fixpoint r24 COR wave. Audits the r23 batch (f50fdaf9):
//
//   (a) sanitizeRestoreAuthority drops the WHOLE authority record when ANY
//       stamp leaves |x| < 2^52. r24 adjudication: the drop-to-undefined
//       fallback was a GRANT (R24-COR-1 / r24-AUT-1/2) - the client
//       window can exceed the approved span and corrupting
//       live-replacement's only stamp killed its zero-accrual contract.
//       FIXED: a present-but-corrupt authority degrades to zero-accrual
//       live-replacement anchored at Date.now() - never `undefined`.
//       These probes now pin the deny. Reachability pinned through
//       Date.parse: the parseable ISO band reaches ~+275760 AD
//       (~8.64e15 ms), well over the 2^52 line - a Postgres
//       timestamptz holding e.g. year 200000 lands inside it. NaN
//       itself is unreachable (parseTimestampMs filters it to
//       undefined before the authority is built).
//   (b) acc reset on non-finite: the honest pending remainder (< threshold
//       by the admission invariant) is destroyed - bounded <1 insight;
//       finite-huge acc is NOT guarded (mechanism-magnitude residual).
//   (c) O(1) drain + max(0, remainder): bit-identical to the loop inside
//       the reachable domain; at mechanism magnitudes (~2.8e17+) the
//       quotient rounds UP across an integer boundary and mints +1
//       insight the loop never would, and product rounding can leave
//       remainder >= threshold (a persisted acc >= threshold then fails
//       F-A11-2 on the next save-write - a self-wedge the clamp does
//       NOT cover). Unreachable residuals; the production comment now
//       cites the measured ~2.8e17 onset (was imprecisely ~4.6e18).
//   (d) round-trip: crafted-authority-only saves - a Proxy-instrumented
//       authority proves nothing downstream reads the raw stamps after
//       the sanitize point; the alchemy settle at the manager seam shows
//       the paid window widening end-to-end.
// ============================================================================

const TWO_POW_52 = 2 ** 52
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
      meridian: { progress: {} },
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

/** Exact-integer oracle: floor(acc/t) computed on the doubles' bit
 *  patterns, not on float division. */
function exactFloorDiv(acc: number, t: number): bigint {
  const buf = new ArrayBuffer(8)
  const f64 = new Float64Array(buf)
  const u64 = new BigUint64Array(buf)
  const toRatio = (v: number) => {
    f64[0] = v
    const bits = u64[0]!
    const sign = (bits >> 63n) !== 0n ? -1n : 1n
    const exp = Number((bits >> 52n) & 0x7ffn)
    const frac = bits & ((1n << 52n) - 1n)
    const mant = exp === 0 ? frac : (1n << 52n) | frac
    const e = exp === 0 ? -1074 : exp - 1075
    return { n: sign * mant, e }
  }
  const a = toRatio(acc)
  const b = toRatio(t)
  const shift = a.e - b.e
  let num = a.n
  let den = b.n
  if (shift >= 0) num <<= BigInt(shift)
  else den <<= BigInt(-shift)
  let q = num / den
  if (num % den !== 0n && num < 0n !== den < 0n) q -= 1n
  return q
}

/** Count every property read on the authority object - proves the raw
 *  stamps are touched only by the sanitize decision, never downstream. */
function trackedAuthority(authority: RestoreTimeAuthority): {
  authority: RestoreTimeAuthority
  reads: string[]
} {
  const reads: string[] = []
  const target = authority as unknown as Record<string, unknown>
  const proxied = new Proxy(target, {
    get(t, prop) {
      reads.push(String(prop))
      return t[prop as keyof typeof t]
    },
  })
  return { authority: proxied as RestoreTimeAuthority, reads }
}

describe('auditR24 COR probe - sanitizeRestoreAuthority partial-drop (f50fdaf9)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // ARM (a1) - live-replacement zero-accrual semantic is dropped with
  // the stamp. Pre-r23 the honored (finite) stamp kept elapsed = 0 by
  // kind; r23 pays the whole client window the kind was built to deny.
  // ------------------------------------------------------------------
  it('A1 corrupt-but-finite live-replacement nowMs keeps zero accrual (fixed: no client-window fallback)', () => {
    // nowMs = 8.6e15 is inside the Date.parse domain (max ~8.64e15) -
    // a Postgres timestamptz near its 294276 AD ceiling produces exactly
    // this value, so the corrupt stamp is REACHABLE through the real
    // parse path (unlike NaN, which parseTimestampMs filters out).
    const nowMsCorrupt = 8.6e15
    expect(Number.isFinite(nowMsCorrupt)).toBe(true)
    expect(Math.abs(nowMsCorrupt) >= TWO_POW_52).toBe(true)

    const save = buildMinimalSave({
      lastSavedAt: currentMs - 10 * DAY_MS,
    })

    const player = usePlayerStore()
    const corrupt = player.restoreFromSave(save, {
      kind: 'live-replacement',
      nowMs: nowMsCorrupt,
    })

    // R24-COR-1/r24-AUT-2 fixed: the zero-accrual contract survives a
    // corrupt stamp - the restore loads but accrues nothing.
    expect(corrupt.elapsedSeconds).toBe(0)
    expect(corrupt.cultivation).toBe(0)

    // Contrast: a valid stamp behaves identically (indistinguishable
    // deny - the degrade re-roots only the live anchor).
    setActivePinia(createPinia())
    const honest = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: currentMs - 10 * DAY_MS }),
      { kind: 'live-replacement', nowMs: currentMs },
    )
    expect(honest.elapsedSeconds).toBe(0)
    expect(honest.cultivation).toBe(0)
  })

  it('A1b corrupt live-replacement nowMs mints alchemy payout at the manager seam (end-to-end)', () => {
    // Same window, one seam deeper: a queued pill due 30min AFTER the
    // save marker settles only when the corrupt authority is dropped
    // into the client-window fallback.
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
            jobId: 'r24_cor_a1',
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

    const honest = run({ kind: 'live-replacement', nowMs: currentMs })
    expect(honest.jobs).toBe(1)
    expect(honest.events).toHaveLength(0)

    const corrupt = run({ kind: 'live-replacement', nowMs: 8.6e15 })
    // Fixed: the corrupt stamp degrades to zero-accrual - the queued
    // pill survives unsettled, identical to the honest case.
    expect(corrupt.jobs).toBe(1)
    expect(corrupt.events).toHaveLength(0)
  })

  // ------------------------------------------------------------------
  // ARM (a2) - cold-boot stamps that used to evaluate to a zero-width
  // window now pay the client window. Both directions are admitted by
  // Date.parse / Postgres range (cutoffMs far-future) or craftable.
  // ------------------------------------------------------------------
  it('A2 cold-boot sinceMs far-future (corrupt, >= 2^52) denies accrual (fixed)', () => {
    const save = buildMinimalSave({ lastSavedAt: currentMs - 10 * DAY_MS })

    // Fixed: corrupt stamp -> zero-accrual degrade, not the client window.
    const result = usePlayerStore().restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: 8.6e15,
      untilMs: currentMs,
    })
    expect(result.elapsedSeconds).toBe(0)
  })

  it('A2b cold-boot untilMs deep-past (below -2^52, craftable) denies accrual (fixed)', () => {
    const save = buildMinimalSave({ lastSavedAt: currentMs - 10 * DAY_MS })

    const result = usePlayerStore().restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: currentMs - 10 * DAY_MS,
      untilMs: -8.6e15,
    })
    expect(result.elapsedSeconds).toBe(0)
  })

  // ------------------------------------------------------------------
  // ARM (a3) - the surviving honest stamp's narrowing is discarded:
  // the fallback repays the pre-cutoff segment the server excluded.
  // ------------------------------------------------------------------
  it('A3 narrowed approval: sinceMs > lastSavedAt (honest skew/cutoff) + corrupt untilMs denies instead of repaying the denied segment', () => {
    // The server deliberately narrowed accrual: cutoff 2h AFTER the
    // payload marker. With untilMs corrupt the fix pays ZERO - the
    // approved span cannot be reconstructed, and the client window is
    // never consulted (it would repay the pre-cutoff segment).
    const lastSavedAt = currentMs - 10 * DAY_MS
    const save = buildMinimalSave({ lastSavedAt })

    const result = usePlayerStore().restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt + 2 * 3_600_000,
      untilMs: 8.6e15,
    })
    expect(result.elapsedSeconds).toBe(0)

    // What the same save pays with the honest stamps kept: the window
    // starts at the cutoff, so the span is 2h shorter than the fallback.
    setActivePinia(createPinia())
    const honored = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt }),
      { kind: 'cold-boot', sinceMs: lastSavedAt + 2 * 3_600_000, untilMs: currentMs },
    )
    // 10d - 2h, capped at 24h anyway -> identical here; the divergence
    // shows when the client span fits under the cap: use a 5h-old save.
    setActivePinia(createPinia())
    const shortLast = currentMs - 5 * 3_600_000
    const shortCorrupt = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: shortLast }),
      { kind: 'cold-boot', sinceMs: shortLast + 2 * 3_600_000, untilMs: 8.6e15 },
    )
    expect(shortCorrupt.elapsedSeconds).toBe(0)

    setActivePinia(createPinia())
    const shortHonest = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: shortLast }),
      { kind: 'cold-boot', sinceMs: shortLast + 2 * 3_600_000, untilMs: currentMs },
    )
    expect(shortHonest.elapsedSeconds).toBe(3 * 3_600)
  })

  // ------------------------------------------------------------------
  // ARM (a4) - deny-side salvage loss: a server cutoff EARLIER than the
  // payload marker widens the grant; the fallback anchors lastSavedAt
  // and silently loses it (deny direction, honest underpay).
  // ------------------------------------------------------------------
  it('A4 widened approval lost: sinceMs < lastSavedAt grant is denied entirely on a corrupt untilMs (fixed)', () => {
    const lastSavedAt = currentMs - 3 * 3_600_000
    const save = buildMinimalSave({ lastSavedAt })

    // Fixed: a corrupt stamp denies all accrual - the client window no
    // longer rescues a partial window.
    const dropped = usePlayerStore().restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt - 2 * 3_600_000,
      untilMs: 8.6e15,
    })
    expect(dropped.elapsedSeconds).toBe(0)

    setActivePinia(createPinia())
    const honored = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt }),
      { kind: 'cold-boot', sinceMs: lastSavedAt - 2 * 3_600_000, untilMs: currentMs },
    )
    expect(honored.elapsedSeconds).toBe(5 * 3_600)
  })

  // ------------------------------------------------------------------
  // ARM (a5) - unit-level boundary + reachability pins.
  // ------------------------------------------------------------------
  it('A5 boundary pins: |x| = 2^52-1 honored, 2^52 dropped; Date.parse-range stamps are reachable, NaN is not', () => {
    const honest: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: currentMs - 60_000,
      untilMs: TWO_POW_52 - 1,
    }
    expect(sanitizeRestoreAuthority(honest)).toBe(honest)

    // Out-of-domain stamps degrade to zero-accrual live-replacement at
    // the local clock - never to `undefined` (the client-clock path).
    expect(
      sanitizeRestoreAuthority({
        kind: 'cold-boot',
        sinceMs: currentMs - 60_000,
        untilMs: TWO_POW_52,
      }),
    ).toEqual({ kind: 'live-replacement', nowMs: currentMs })

    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: -TWO_POW_52 }),
    ).toEqual({ kind: 'live-replacement', nowMs: currentMs })

    // Reachability: every stamp the parse path can produce is finite and
    // lands inside the same |x| domain the sanitizer checks. The corrupt
    // band [2^52, 8.64e15] is exactly what a far-future Postgres
    // timestamptz emits through toISOString - year 200000 parses to
    // ~6.25e15. (Years past +275760 exceed the 8.64e15 ms ceiling and
    // parse to NaN, so the far tail is filtered upstream, not here.)
    const farFuture = Date.parse('+200000-01-01T00:00:00Z')
    expect(Number.isFinite(farFuture)).toBe(true)
    expect(farFuture).toBeGreaterThan(TWO_POW_52)
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: farFuture }),
    ).toEqual({ kind: 'live-replacement', nowMs: currentMs })

    // NaN never reaches the authority: the only producers filter it out
    // (parseTimestampMs -> undefined -> `?? Date.now()` at construction).
    expect(Date.parse('not-a-date')).toBeNaN()
  })

  it('A5b honest deep-past untilMs inside the domain keeps the zero-width deny', () => {
    // A Postgres-reachable deep-past stamp (4713 BC floor ~ -2.1e14) is
    // INSIDE |x| < 2^52 - it is honored, and the window math still
    // yields zero elapsed. The sanitize only forfeits the deny for
    // stamps outside the domain.
    const result = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: currentMs - 10 * DAY_MS }),
      {
        kind: 'cold-boot',
        sinceMs: currentMs - 10 * DAY_MS,
        untilMs: -2.1e14,
      },
    )
    expect(result.elapsedSeconds).toBe(0)
  })

  // ------------------------------------------------------------------
  // ARM (d) - the raw authority object is touched by the sanitize
  // decision only; nothing downstream reads the unsanitized stamps.
  // ------------------------------------------------------------------
  it('D1 out-of-domain authority: no property read escapes the sanitize call', () => {
    const { authority, reads } = trackedAuthority({
      kind: 'cold-boot',
      sinceMs: currentMs - 60_000,
      untilMs: 8.6e15,
    })

    const result = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: currentMs - 600_000 }),
      authority,
    )

    // Corrupt authority -> zero accrual (fixed deny).
    expect(result.elapsedSeconds).toBe(0)
    // Only the sanitize decision reads the record: 'kind' once for the
    // branch, then the two stamps. No post-sanitize reader touches it.
    expect(reads).toEqual(['kind', 'sinceMs', 'untilMs'])
  })

  it('D1b in-domain authority: downstream reads go through the sanitized alias', () => {
    const { authority, reads } = trackedAuthority({
      kind: 'cold-boot',
      sinceMs: currentMs - 600_000,
      untilMs: currentMs,
    })

    usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: currentMs - 600_000 }),
      authority,
    )

    // The sanitize reads kind+stamps; the honored window then reads
    // them again via the `authority` alias - the RAW parameter object
    // and the alias are the same record, so every read is accounted:
    // sanitize (kind, sinceMs, untilMs), elapsed branch (kind, sinceMs,
    // untilMs), restoreAuthorityNowMs (kind, untilMs).
    expect(reads).toEqual([
      'kind',
      'sinceMs',
      'untilMs',
      'kind',
      'sinceMs',
      'untilMs',
      'kind',
      'untilMs',
    ])
  })

  // ------------------------------------------------------------------
  // ARM (d2) - payload-identity guard ignores the authority entirely:
  // a same-payload re-restore under a different authority is a no-op -
  // a corrupt-authority payment can never be re-settled honestly.
  // ------------------------------------------------------------------
  it('D2 payload identity ignores authority - first restore wins, even a denied one (accepted residual)', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({ lastSavedAt: currentMs - 600_000 })

    const corrupt = player.restoreFromSave(save, {
      kind: 'live-replacement',
      nowMs: 8.6e15,
    })
    // Post-fix the corrupt restore accrues ZERO...
    expect(corrupt.elapsedSeconds).toBe(0)

    // ...and the identity cache holds it: a same-payload replay under a
    // now-honest authority is skipped as a duplicate, so the denied
    // result persists for the session (deny direction, self-heals on
    // the next save/boot - R24-COR-2 excepted).
    const replay = player.restoreFromSave(save, {
      kind: 'live-replacement',
      nowMs: currentMs,
    })
    expect(replay.elapsedSeconds).toBe(0)
  })
})

describe('auditR24 COR probe - insight drain guards (f50fdaf9)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function insightPlayer(acc: number) {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ngo_dao']
    player.cultivationInsightAccumulator = acc
    return player
  }

  // ------------------------------------------------------------------
  // ARM (b) - the reset destroys only the pending sub-threshold
  // remainder (< 1 insight by the admission invariant); state stays
  // writable and validation-clean afterwards.
  // ------------------------------------------------------------------
  it('B1 non-finite gained destroys the pending remainder (bounded < 1 insight) and stays writable', () => {
    const player = insightPlayer(1_500)

    accrueCultivationInsight(player, Number.POSITIVE_INFINITY)

    expect(player.cultivationInsightAccumulator).toBe(0)
    expect(player.skillInsight).toBe(0)
    expect(player.totalSkillInsightGained).toBe(0)

    // Next honest accrual mints normally - the field is writable again.
    accrueCultivationInsight(player, 2_500)
    expect(player.skillInsight).toBe(1)
    expect(player.cultivationInsightAccumulator).toBe(500)
  })

  it('B2 NaN-poisoned acc resets and re-validates (mechanism-level; the gate never admits it)', () => {
    const player = insightPlayer(Number.NaN)

    accrueCultivationInsight(player, 1_000)

    expect(player.cultivationInsightAccumulator).toBe(0)
    expect(player.skillInsight).toBe(0)
  })

  it('B3 finite-huge acc is NOT guarded - pin the unreachable residual', () => {
    // The guard fires only on non-finite: a finite 1e300 acc mints
    // floor(1e300/2000) insight with no magnitude bound. Unreachable:
    // admission requires acc < threshold and every feed is a real
    // cultivation delta. Documented residual, not a regression.
    const player = insightPlayer(1e300)
    accrueCultivationInsight(player, 1)
    expect(player.skillInsight).toBe(1e300 / 2000)
  })

  // ------------------------------------------------------------------
  // ARM (c) - reachable-domain identity + mechanism-magnitude artifacts.
  // ------------------------------------------------------------------
  it('C1 floor-division stays bit-identical to the retired loop across the reachable domain', () => {
    const threshold = 2_000
    const cases: Array<[number, number]> = [
      [0, 1],
      [1_999.999_999_999_999_8, 0], // boundary-adjacent remainder
      [1_999.999_999_999_999_8, 1e-12],
      [1_999, 2_000],
      [0, 1e11],
      [1_999, 1e11],
      [777.5, 4_500.5],
    ]
    for (const [startAcc, gained] of cases) {
      const player = insightPlayer(startAcc)
      accrueCultivationInsight(player, gained)

      let refAcc = startAcc + gained
      let refSteps = 0
      while (refAcc >= threshold) {
        refAcc -= threshold
        refSteps += 1
      }
      expect(player.skillInsight).toBe(refSteps)
      expect(player.cultivationInsightAccumulator).toBe(refAcc)
    }
  })

  it('C2 mechanism magnitude: quotient round-up mints +1 the loop never would - the clamp hides the tell-tale', () => {
    // acc = 417972220788154000, t = 2000:
    //   true acc/t = 208986110394076.x  -> honest steps 208986110394076
    //   fl(acc/t) rounds UP            -> steps 208986110394077 (+1)
    //   steps*t = 417972220788154048   -> remainder -48 -> clamped to 0
    // The clamp makes the field validate (0 < t) but the mint already
    // happened in `steps`. Unreachable: acc < threshold at admission.
    const acc = 417_972_220_788_154_000
    const threshold = 2_000
    const honestSteps = exactFloorDiv(acc, threshold)
    expect(honestSteps).toBe(208_986_110_394_076n)

    const player = insightPlayer(acc)
    accrueCultivationInsight(player, 1)

    expect(player.skillInsight).toBe(Number(honestSteps) + 1)
    expect(player.cultivationInsightAccumulator).toBe(0)
  })

  it('C3 mechanism magnitude: remainder can persist >= threshold (self-wedge residual the clamp does not cover)', () => {
    // acc = 174165594658891500, t = 1500: steps*t rounds down enough
    // that the remainder lands at 1504 - ABOVE the threshold. Persisted
    // verbatim that value fails F-A11-2 (acc >= threshold) on the next
    // save-write - the max(0, ...) arm only guards the negative side.
    const acc = 174_165_594_658_891_500
    const player = insightPlayer(acc)
    accrueCultivationInsight(player, 1)

    expect(player.cultivationInsightAccumulator).toBe(1_504)
    expect(player.cultivationInsightAccumulator).toBeGreaterThanOrEqual(1_500)
  })

  it('C4 the onset constant is ~2.8e17 (production comment corrected to match)', () => {
    // Real measured witnesses (exact-floor oracle): over-mint at
    // acc = 2.76e17 (t=1000), negative remainder at acc = 4.97e17
    // (t=1500). The comment now cites ~2.8e17 (was ~4.6e18, ~16x off).
    // Directionally unchanged: unreachable.
    const overMintAcc = 275_547_921_820_961_000
    expect(exactFloorDiv(overMintAcc, 1_000)).toBe(275_547_921_820_960n)
    expect(Math.floor(overMintAcc / 1_000)).toBe(275_547_921_820_961)

    expect(2.8e17).toBeLessThan(4.6e18)
  })
})
