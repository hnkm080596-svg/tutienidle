# Fixpoint r31 adjudication — 2026-10-06

Wave: r31 at e90f46a2. Auditors: COR `67618bf8`, AUT `4ace3dd2`, INT `ada43900`.
Aggregate: **2 Medium + 5 Low + 3 Nit** (dedup'd). All actionable items resolved.

## Findings and dispositions

### COR F-NEG-MINT (Medium) — CONFIRMED, FIXED
Four persisted timestamp fields (`workerCycles[].startedAtMs/completesAtMs`,
`alchemyJobs[].startedAtMs/completesAtMs`) admitted negative values: the gate
only checked finite-magnitude `< 2^52`. A crafted negative pair passed the
validator, then `advanceWorkerLanes`/`AlchemySystem.tick` walked the deep-past
chain and minted the whole pending list on the next tick.

- Gate promoted to `isNonNegativeBoundedTimestamp` (`[0, 2^52)`) on all four
  fields (`saveShapeValidation.ts` workerCycle + alchemyJob pins).
- Boundary behavior is intentionally asymmetric: `AlchemySystem.restoreJobs`
  drops out-of-domain pairs at the boundary (a denied job must never sit in the
  live queue), while `ProductionSystem.restoreStates` parks workerCycles
  verbatim so the deny lands deterministically in `advanceWorkerLanes`.
- `WorkerLaneAdvance` denies any pending cycle whose stamps are `< 0` or
  `>= 2^52` — zero-advance, verbatim parking.

### INT-1 (Medium) — CONFIRMED, FIXED
`simPaused` latch survived a full `bootGame` re-baseline: after a fresh boot
(re-auth / new save) the stale latch left the sim visibly running while the
pause flag was still set, so a later `pauseSimulation()` call matched the
"already paused" early-return and silently skipped the CombatClock freeze —
a combat fight kept running behind the paused shell.

- `simPaused = false` re-baseline at the top of `bootGame`
  (`useAppLifecycle.ts`): a fresh boot always starts un-paused; the second
  pause now actually freezes CombatClock. Pinned by INT S1 (source-ordering
  + behavior probes).

### HEADROOM (Low, promoted class) — FIXED
Every *minted* stamp `clock + delta` must stay inside the persisted domain.
Sites guarded with `!(nowMs + Math.max(0, delta) < 2 ** 52)` (the `!(…)` form
also denies NaN deltas):

- `WorkerLaneAdvance`: `nowMs + cycleMs` on both the seed arm and the
  pending head, plus `emptyLaneStartMs + cycleMs`.
- `AlchemySystem.startJob`: `nowMs + spanMs` (a brew starting at a near-bound
  clock now refuses `invalid_clock` instead of minting an unwritable
  `completesAtMs`).
- `DecomposeSystem.tick` + `settleOffline`: `nowMs + cycleMs`.
- Both restore shift arms (`AlchemySystem.restoreJobs`,
  `ProductionSystem.restoreStates`): `restoreNowMs + span < 2^52`, else the
  pair parks verbatim.

### WIN-ASYM (Low) — FIXED
`emptyLaneStartMs` admitted negative window starts while the sibling pending
arms denied them. Now non-negative + headroom; a crafted negative window
start zero-advances (deny-lean — a forged negative `lastSavedAt` yields zero
offline accrual, never a mint).

### F-APPLIEDAT / INT-4 (Low) — FIXED
`applyTimedEffect`'s push arm clamped `expiresAtMs` but pushed `appliedAtMs`
verbatim; the validator pins `appliedAtMs <= lastSavedAt` so a crafted
`appliedAtMs = 1e16` wedged every later save-write. The clamp ceiling is
`min(2^52 - 1, Date.now())` — the bare `2^52 - 1` ceiling would still fail
the `<= lastSavedAt` pin. `expiresAtMs` keeps the bare-bound clamp (live
buffs legitimately exceed `now`).

## Nit dispositions

- **AUT-3 (Nit) — ACCEPTED, documented**: `sanitizeRestoreAuthority` treats
  the server-authority timestamp as sign-agnostic magnitude while the
  persisted domain is non-negative. Same deny outcome either way — a
  negative authority still fails the domain check downstream; tightening the
  sign check here changes nothing reachable. Recorded so future auditors
  don't re-derive it.
- **INT-3 (Nit) — ACCEPTED, documented**: same class as AUT-3 — a
  sign-asymmetric domain mismatch where both branches land on deny.
- **Comment hygiene**: one Vietnamese phrase inside a `//` comment in
  `auditR29Aut.probe.test.ts` flagged by the P15 ratchet — rewritten ASCII.

## Collateral pin updates (17 older tests flipped)

The deny-by-domain tightening changed behavior older probes pinned as
*admitted*: every negative/deep-past pending stamp or window start now
zero-advances verbatim instead of walking the chain. All flipped to deny
pins (assert verbatim parking, `completed = 0`, `forfeited = 0`):

- `fixpointR19Aut` W1/W2/W4 — deep-past saved heads.
- `auditR21Aut` B5 (deep-past sub-pin), E1/E2 (saved-lane jump paths).
- `auditR21Cor` "pending just inside 2^53" (was a positive-control settle;
  now a verbatim-deny pin).
- `auditR21Int` "huge budgetMs" — rebased to `emptyLaneStartMs = 0`,
  `nowMs = 1e15` so the same O(budget) probe stays inside the domain;
  "re-admissible" — `-4e15` arm split into an explicit deny case.
- `auditR22Int` outermost admitted marker `-(2^52-1)` — derived negative
  window now denies verbatim.
- `auditR23Int` B2 — far-future seed now denied at mint-headroom instead
  of parking the lane.
- `auditR30Aut` F3 boundary — top admitted `startJob` clock is
  `2^52 - 1 - spanMs`; `2^52 - 1` moved to the deny list.
- `auditR30Cor` C — `tick(2^52 - 1)` now zero-advances (headroom).
- `ProductionOffline` "starve" test — the CAP_MS span moved to
  `BOUND - 200_000` so it stays in-domain.
- `betaLocalCorrectnessAudit` F-LC-1b — the forged-cooldown wedge demo is
  closed: `restoreRuntime` clamps to the authored bound, so the pin now
  asserts `seconds <= 300`.
- `AlchemySurface` + `i18nKeyParity` — `alchemy.reason.invalid_clock`
  locale key added (en + vi); it is a reachable `startJob` reason.

## Verification

- `npm run type-check` — clean.
- `npx vitest run --pool=threads` (full) — 998 files, 9740 tests green.
- `npx eslint` on all touched production files — clean.
- P15 ASCII ratchet — clean.
