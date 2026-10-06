# Fixpoint R21 Adjudication — timestamp magnitude class, closed at admission

Audited tip: `be30c152` (wave r21). Auditors: COR (FAIL: 1M+2L+3N), AUT (FAIL:
~Medium + 2L + 1N), INT (PASS: 1L + 2N). All three converged on one defect
class — the same class r20-COR-1 pinned at mechanism level but left open at
the shape gate: **persisted millisecond stamps were validator-admitted with
only finite + ordering + exact-span pins — no magnitude bound.**

## The ruling (decision made, not escalated — mechanical contract split)

r20 adjudication parked the magnitude pin inside `advanceWorkerLanes` as
"mechanism-owned: preserve-then-persist". r21 proved that split is strictly
worse than rejection:

1. **Save-reachable (COR-1, AUT A1)**: `workerCycles[].startedAtMs /
   completesAtMs` at |x| >= 2^53 passed `validateGameSaveShape` (finite,
   ordered, exact authored span, `startedAtMs <= lastSavedAt` — all true
   at magnitude 9.1e15 or -1e16).
2. **Permanent across every driver (COR-2, AUT B1/B4, INT-B)**: once
   persisted, the crafted entry trips the mechanism guard on EVERY
   `settleOffline` AND every online `tickWorkers`, is returned verbatim,
   and is re-persisted by the next save — a silent per-site freeze that
   survives forever. Worse than a loud save rejection: the player keeps
   playing with a dead site and never knows.
3. **Fixed-point direction**: when a crafted record can only harm the
   attacker's own save, admitting it (deny-direction) is only defensible
   while admission is *required* for honest shapes. Here it is not:
   honest stamps are epoch-ms (~1.8e12), five orders below the pin. So
   **admission co-owns the bound** — the validator rejects `|stamp| >=
   2^53` on every persisted timestamp cursor, and the mechanism guard
   keeps its pin as defense-in-depth for non-save feeds (same layering
   as `slots`, where the gate already pins and the mechanism mirrors).

The 2^53 bound is the exact-integer-ms domain: above it, float ulp/2
exceeds every authored `cycleMs` (>= 22000, always a multiple of 1000 —
AUT C1 verified all authored cycleMs), so `due + cycleMs` absorbs back
to `due` and the deadline loop grants at zero cost forever (COR-1's
~57M-iteration sibling in DecomposeSystem got an O(1) jump instead —
see COR-4).

## Fixes

| Finding | Severity | Disposition |
|---|---|---|
| R21-COR-1: `-1e308` lastSavedAt seeds `emptyLaneStartMs` below the FP-absorb line; settle hangs, save unbootable | High | FIXED — two layers: (a) validator `isNonNegativeBoundedTimestamp`-style magnitude pin now rejects `|stamp| >= 2^53` on `player.lastSavedAt` and every persisted cursor below; (b) the mechanism guard already pinned `emptyLaneStartMs` — now `nowMs` too (COR-2's arm). |
| R21-COR-2: `nowMs = 1e300` trips the jump arm into the absorption zone — unbounded deadline loop | Medium | FIXED — `advanceWorkerLanes` rejects `Math.abs(nowMs) >= 2^53`. Unreachable via saves (settleNowMs clamps at authorityNowMs); pinned for non-save feeds. Child-process probe now exits 0. |
| R21-COR-3 (same class as COR-1 via `pending` arm) | Medium | FIXED — the guard's pending-arm magnitude pin stays; the validator now rejects the pair at admission (`validateProductionCycleSave` bounded stamps). INT-B flipped: save dies at gate; direct-feed wedge test kept as mechanism-level defense-in-depth pin. |
| R21-COR-4: DecomposeSystem fast-forward steps ~57M no-op `+=` iterations for restored `nextCycleAt = 0` | Medium | FIXED — O(1) jump: `skippedCycles = floor((end - nextCycleAt)/cycleMs) + 1`; identical landing semantics (first cycle strictly past the window), proven in probe. |
| R21-COR-5: pkill self-kill — probe spec matched its own vitest cmdline pattern | Nit | FIXED — pkill pattern now quotes the exact `--reporter=dot` arg so a bare spec-name match cannot hit the parent. |
| R21-COR-6: deny path leaves `consumedBudgetMs` undefined-ish | Nit | FIXED — deny specs now assert `consumedBudgetMs === 0` alongside zero-advance. |
| AUT F-R21-01 (pending pair admitted) / -02 (all-sites freeze via marker) / -03 (self-heal asymmetry doc) | Medium / Low / Nit | FIXED at admission (01); 02's freeze arm now save-unreachable, mechanism-level probe kept (B3); 03 recorded — payload-scoped deny that self-heals is intended. |
| AUT F1/F2: sub-pin `9e15` stamps admitted, park alchemy/decompose/building/tribulation channels forever | Low | **ACCEPTED residual.** The >= 2^53 arm (absorb/hang — attacker CAN weaponize against themselves into a brick) is closed. Sub-pin far-future parking is pure deny-direction self-harm on the attacker's own save: a forged entry parks its own channel, mints nothing, harms no one else. Any tighter absolute ceiling on the marker would reject honest saves written on broken future clocks (the r15-COR-D class — that regression cost a real save once). Forfeited-counter inflation is observational (no consumer). Probes kept as admission-pins documenting the residual boundary. |
| INT-01: `slots` accepts non-integer/huge — only reachable through direct feeds | Low | FIXED — bounded non-negative integer contract `0 <= slots <= 65536` (JSDoc + guard + pins). 65536 boundary spec exercises the legal edge without seeding (heavy seed push omitted — timing). |
| INT-02: `budgetMs` unbounded | Low | NO FIX — documented contract: `budgetMs` is caller-authorized; `PRODUCTION_OFFLINE_CAP_SECONDS = 10h` bounds the real caller upstream; JSDoc says so explicitly. Any finite value honored by design. |
| INT-03: guard comment drifted (~1.8e12 "honest bound" phrasing) | Nit | FIXED — comment now states the domain bound (exact-integer-ms, 2^53) not the honest-stamp magnitude. |

## Residual ledger (all severity-closed)

- Sub-pin far-future parked entries (9e15 family) on every persisted
  timestamp channel — accepted, reason above (AUT F1/F2 probes kept).
- Mechanism-level verbatim freeze on non-save crafted feeds —
  intended defense-in-depth (COR probe kept as pin).
- `forfeited` counter inflation — observational, no consumer (AUT B5).

## Verification

`npm run type-check` clean. `npx vitest run src/services/save
src/core/production src/stores`: 1088 passed / 3 skipped. All stale
admission-pin tests flipped to rejection expectations (AUT A1-A3, D3;
INT-B; COR admission probe); COR child-process hang probe flipped to
pinned clean exit; boundary specs cover the legal edge just inside
2^53 (`-4.5e15` pending, `9e15` F1/F2 residual pins).
