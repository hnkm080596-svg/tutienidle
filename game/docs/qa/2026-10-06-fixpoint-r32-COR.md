# Fixpoint r32 — COR audit report

- **Wave:** r32 blind audit, role **COR** (correctness)
- **Auditing:** r31 adjudication commit `1d27aee4` (`codex/hoa-cau-fireball-vfx`), checked out exactly
- **Probe file:** `src/services/save/auditR32Cor.probe.test.ts` — 40 tests, all green (`npx vitest run <file> --pool=threads`)
- **Attack surface assigned:** non-negative persisted domain on `workerCycles[]`/`alchemyJobs[]` stamps; mint headroom at every `clock + delta` site; drop-vs-park restore asymmetry; `simPaused` re-baseline ordering; `appliedAtMs` clamp vs `<= lastSavedAt` pin; new `-1/-0/+0/2^52-1/2^52` edges.

## Verdict

**FAIL — 0 Critical / 0 High / 0 Medium / 3 Low / 3 Nit.**

Every LOW is an ungated-caller/hostile-clock latent — no save-path reachability (the validator closes all of them); the class contract the batch declared ("every minted stamp stays inside `[0, 2^52)`") has three remaining seams it doesn't hold on. Nothing makes honest behavior fail; nothing lets a crafted *save* through.

## Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| COR-F1 | **Low** | `AlchemySystem.restoreJobs` carries **no ordering pin** — the flatMap (`AlchemySystem.ts:389-463`) drops only out-of-domain stamps; an in-domain **reversed pair** (`completesAtMs <= startedAtMs`) parks verbatim and settles on the next honest `tick` — `nowMs < completesAtMs` is false → settle arm → verified reservation → **pill minted**. Two sub-arms: (a) `started <= restoreNow` parks then settles as soon as `now >= completes`; (b) `started > restoreNow` hits the **shift arm**, which preserves the negative span — minted `completesAtMs = restoreNow + span` can go **negative** (the headroom bounds only the `< 2^52` side) → settles instantly AND self-wedges the next write. Sibling `advanceWorkerLanes` denies the identical class zero-advance (`WorkerLaneAdvance.ts:170-179` ordering pin). | Probes D: reversed `{100, 50}` → parked (len 1) → `tick` → settlement event `success:true`, pill delivered; `{started: 1e12+100, completes: 500}` at `restoreNow=5e11` → restored `completesAtMs < 0`. Contrast pin: same pair denied at `advanceWorkerLanes`. |
| COR-F2 | **Low** | `advanceWorkerLanes` headroom denominates the **`cycleMs` param**, but the persisted pending stamp is minted by `buildProductionCycle` as `startMs + computeCycleSeconds(baseSeconds, siteLevel) * 1000` (`ProductionCycles.ts:37-38`) — a *different* expression. A caller passing `cycleMs` **smaller** than the authored span is admitted by the guard while the minted `completesAtMs` lands `>= 2^52` → next write self-refuses. Both real callers (`tickWorkers`, `settleWorkersOffline`) pass the coherent pair `cycleMs === computeCycleSeconds(baseSeconds, level)*1000`, so latent; the same divergence silently desyncs deadline-mode successor dues (`due += cycleMs` walked vs `startMs + computeCycleSeconds` persisted). | Probe E: `{nowMs: 2^52-60_000, emptyLaneStartMs: same, cycleMs: 30_000}` (incoherent w/ mortal authored span 100_000ms) → **admitted**, `seededPending[0].completesAtMs >= 2^52`; coherent control stays `< 2^52`. |
| COR-F3 | **Low** | `settleProductionOffline`'s field-epoch re-stamp (`ProductionOffline.ts:184-194`) mints `startedAtMs/completesAtMs + fieldEpochShiftMs` (=`Date.now() - nowMs`) with **no `< 2^52` headroom** — the one mint site in the batch's own class left unguarded; every sibling `+delta` mint got `!(x + delta < 2^52)`. Reachable only with device clock inside `[2^52 - cycleMs, 2^52)` (epoch edge — `lastSavedAt` itself wedges a `cycleMs` later), i.e. hostile-clock-only today. | Probe F: `Date.now() = 2^52 - 1 - 15_000`, `settleNow = 1e12`, seeded window → restored `workerCycles` carry `completesAtMs >= 2^52`. |
| COR-F4 | **Nit** | `restoreJobs` shift-arm headroom `restoreNowMs + span < 2^52` is **provably dead code**: after the domain drop, `completesAtMs < 2^52` and the shift precondition `startedAtMs > restoreNowMs` imply `restoreNow + span < completes < 2^52`, so the park arm can never fire (the drop already removes every pair that could trigger it). Harmless over-guard; the "else verbatim park" comment describes an unreachable behavior on THIS seam (on `restoreStates` — no domain drop — the arm *is* reachable and correct). | Probed C3: post-dated pair with `completes >= 2^52` is DROPPED before the arm; in-domain post-dated always shifts. |
| COR-F5 | **Nit** | Saved-cycle **reward-shaping fields** are unpinned at the mechanism: `advanceWorkerLanes` denies only stamp-domain + ordering; a pending lane's `collectionRealmId`/`siteLevelAtStart`/`rewardTableVersion`/`rollSeed` ride `lane.saved` verbatim into `grantCycleRewards`/`rollHiddenChannelRewards` → ungated feed grants crafted-realm/level-tier rewards. Validator pins all of them (realm ≤ player, level ≤ site, rollSeed range, span = authored) → save-path unreachable; noted so the latent class isn't re-derived. | Code-verified (`WorkerLaneAdvance.ts:292-295`, `323-326`; grant reads `cycle.collectionRealmId`/`siteLevelAtStart`/`rollSeed`). |
| COR-F6 | **Nit** | `en.json`/`vi.json` lost their trailing newline in this commit (diff artifact — `\ No newline at end of file`). Cosmetic only. | `git show 1d27aee4 -- src/locales/` tail hunk. |

## Verified-correct / rejected candidates (evidence, not findings)

| Candidate | Verdict |
|-----------|---------|
| Boundary `-1 / -0 / +0 / 2^52-1 / 2^52 / NaN / ±Inf` on every new gate (`advanceWorkerLanes` nowMs/emptyLaneStartMs/pending, `startJob`, `DecomposeSystem.tick`/`settleOffline`, validator `isNonNegativeBoundedTimestamp`) | **Confirmed correct** — probed A/B truth tables; `-0`/`+0` admit-as-tiny-past is the documented accepted residual; `2^52-1` the top admitted value; `2^52` denied everywhere. |
| `!(nowMs + Math.max(0, delta) < 2^52)` deny form | Correct — denies NaN deltas too (`max(0, NaN) = NaN` → `!(NaN < x)` fires). Boundary `nowMs + delta = 2^52` denies; `-1` admits. |
| `emptyLaneStartMs < 0` (WIN-ASYM) | Fixed correctly — negative window start zero-advances verbatim now (deny-lean, matches `offlineSinceMs` siblings). |
| Drop (`restoreJobs`) vs park (`restoreStates`) asymmetry | Consistent with the documented doctrine: alchemy drops out-of-domain pairs at the boundary so a denied job never sits in the live queue; production parks so the deny lands deterministically in `advanceWorkerLanes` (which now also carries the negative/bound `.some()` pin). Both land on deny. |
| `simPaused = false` re-baseline ordering in `bootGame` | Correct — placed after `bootInFlight/stopped` early-returns, before the await; `pauseSimulation` requires `entryStage === 'game'` so no pause can latch mid-boot; `CombatClock.stop()` clears freeze reasons on teardown so the reset can't orphan an `authority-pause` freeze behind a running shell. |
| `appliedAtMs` clamp `min(min(2^52-1, Date.now()), max(-(2^52-1), applied))` | Correct for the pin it serves: `<= lastSavedAt` at next write (`lastSavedAt = Date.now()` ≥ clamp ceiling). Crafted `>= 2^52` lands at `now`; `-Inf`→`-(2^52-1)` still passes the magnitude pin on `appliedAtMs` (signed domain kept for timed effects — deny-lean since liveness keys on `expiresAtMs`). |
| `alchemy.reason.invalid_clock` locale | Wired en+vi; `AlchemySurface` resolves via `te(key)` with `fallback` — even a miss degrades. |
| `DecomposeSystem.restore` merged-deadline `min(max(0, restored), restoreNow + cycleMs)` | Can never exceed the bound — `restoredDeadline` is itself admission-pinned `< 2^52`, so `min()` ≤ it. (Same line of reasoning prior waves recorded.) |
| `WorkerLaneAdvance` successor/seed mints (`due = dueMs + cycleMs`, `due = emptyLaneStartMs + cycleMs`) | Bounded by `nowMs + cycleMs < 2^52` and `emptyLaneStartMs + cycleMs < 2^52` — exact headroom (coherent params; see F2 for the incoherent-param gap). |
| `skippedDues` fast-forward jump (`lastDueMs + cycleMs ≤ nowMs + cycleMs`) | In-domain via the nowMs headroom. |
| Deny-path payload-root tolerance (`advanceWorkerLanes(null)`, `restoreJobs(null)`) | Throws `TypeError` (the deny return reads `params.pending`; `restoreJobs` calls `jobs.flatMap`) — pre-existing shape, callers are typed; **not** a new r31 regression. Noted as accepted latent (not re-listed as a finding). |
| `en.json`/`vi.json` key parity | `invalid_clock` added to both; `i18nKeyParity` test green in the r31 verification. |

## Reachability summary

All three Lows share the r31 precedent profile: **no reachable crafted-save path** — `validateGameSaveShape` pins ordering + spans + non-negative domain on every field these arms consume, and every in-app clock feed is `min`-clamped at `Date.now()` (~1.7e12, nowhere near `2^52` ≈ 4.5e15). They are defense-in-depth seams where the batch's own declared invariant ("every minted stamp stays in `[0, 2^52)`" / "honest pairs never denied") doesn't hold uniformly:

- **F1** — restore-side ordering pin missing on the alchemy seam (production sibling has it).
- **F2** — headroom denominates `cycleMs` while the minted stamp uses `computeCycleSeconds(...)` (param-coherence contract).
- **F3** — the `+fieldEpochShiftMs` re-stamp lacks the headroom entirely.

Fix direction for each is a one-line guard / pin; none is required for correctness today, but the class the batch closed is left open at exactly these three seams.

## Verification

- `npx vitest run src/services/save/auditR32Cor.probe.test.ts --pool=threads` — **40/40 green**.
- `npm run type-check` — clean.
- Probes deterministic: `Date.now` mocked; no sleeps, no timing dependence.
- Branch `devin/audit-r32-COR-1d27aee4` — contains only this report + the probe file (QA-write paths).
