# Fixpoint r19 adjudication — audit commit 8f60f30c (the r18 batch)

Wave r19 (3 blind auditors: COR / AUT / INT) attacked the r18 batch.
Verdicts: **AUT PASS WITH EVIDENCE (0 defects + 1 hardening note)**,
**INT PASS WITH EVIDENCE (0 Medium+ + 2 Nit stale comments)**,
**COR FAIL WITH REASON (1 Low, deny-direction)**.

## Confirmed findings

| Finding | Sev | Disposition |
| --- | --- | --- |
| R19-AUT hardening note — `advanceWorkerLanes` guarded `nowMs`/`budgetMs` non-finite but not `emptyLaneStartMs` or pending dues: a NaN due never satisfies `dueMs > nowMs`, skips the jump arm, forfeits, and respawns NaN-due forever — an infinite deadline-mode loop. Not client-reachable (validator pins every stamp finite upstream) | Low | FIXED — the existing defensive guard now also rejects non-finite `emptyLaneStartMs` and non-finite pending `startedAtMs`/`completesAtMs`; zero-advance result preserves in-flight lanes. 2 pins added in `ProductionOffline.test.ts`. |
| R19-INT-01 — `boundTimedEffectClocks` docstring still claimed "Shared by the offline-payout read" though payout runs the sibling `payoutExpiresAtMs` since r15 | Nit | FIXED — docstring now names the restore-map consumer and the sibling payout bound explicitly. |
| R19-INT-02 — r13-INT-03 comment "(same bound as the restore map below)" went false under `lastSavedAt > authorityNow` after the r15 bound split | Nit | FIXED — comment now describes the payout-epoch sibling relationship (equal whenever a payout can run, tighter under fast clock). Cosmetic sibling "the save instant" → "the authorized window start" in ProductionOffline.ts. |
|| R19-COR-1 — the dead arm's `expires <= lastSavedAt` marker comparison is epoch-consistent only when record and marker share one clock epoch: an honestly-live record (written synced, clock stepped forward before the save, corrected before restore) reads dead-in-marker-epoch and clamps to now at boot — losing its remaining duration | Low | ACCEPTED RESIDUAL — every relaxation preserving the honest flipped-epoch case admits a deterministic mint of equal-or-greater size (forged future marker + expires in (now, marker] revives a buff; the dead arm is the ONLY bound on that path). Honest loss requires a rare sequence (clock step past the buff's own expiry, then correction before restore), is bounded <= remaining duration, once per boot, deny-direction. The two repros flipped to pin the DENY semantics — a future regression that re-opens the mint fails the suite. |

## Clean (audited, no defect)

- **AUT**: every crafted triple lands inside the bound — deep-past
  `appliedAt` ignored by the bound; validator-ceiling `expires =
  lastSavedAt + 24h + 7d` clamps to `lastSavedAt + 24h`; forged-future
  `lastSavedAt` stores exactly `until + 24h` with zero-width payout;
  non-finite/stackable/order-violating records rejected upstream. cps
  probe parity verified byte-level (`liveTltPercent` == `percentAtSave`
  domain); micro-percent `1e-9` stays defunct. Jump guard O(1) under
  every crafted lane incl. `dueMs = -1e15` (exact int arithmetic) and
  `cycleMs = 0` (drains, no respawn). Seeded heads always shifted into
  `(fieldNow, fieldNow + cycle]` — none early; saved lanes cannot carry
  the `seeded` flag (recomputed from lane provenance). 20 probes green.
- **INT**: exactly one consumer each for `boundTimedEffectClocks`
  (restore map) and `payoutExpiresAtMs` (payout map); bounds equal
  whenever payout can run, stored strictly tighter under fast clock
  (deny-direction). `seeded && saved` unreachable; observe-mode seeds
  cannot leak `seededPending` consumers; `pending`<->`lanes` 1:1;
  forfeit parity pinned (dying lane head-only, survivor full tail).
  Zero orphaned `offlineSinceIsServerEpoch`/`serverSeeded*` references.
  `emptyLaneStartMs` producer/consumer pair coherent across all restore
  paths; `start <= end` proved for all orderings. 5 probes green.
- **COR**: jump arm `budgetLeft < min(headCost, cycleMs)` ≡ walk
  (inFlight never grows in-loop -> respawn decision at jump ≡
  per-iteration); forfeit parity pinned end-to-end (oversubscribed
  lane dies at +1, survivor counts full `skippedDues`). Re-stamp
  shifts exactly seed-rooted heads (`[800k,900k] -> [1.0M,1.1M]`),
  saved-chain `[750k,850k]` verbatim — COR-D1 closed, double-shift
  structurally impossible. Flag removal complete; `offlineSince <=
  settleNow` for all orderings; sibling caps (decompose, autofarm,
  validator pins) unchanged. Honestly-dead-arm pin keeps raw stamps.
- Documented residuals re-verified bounded: saved-chain head ~1-cycle
  early pay (one-time, self-healing); stackable expiry passthrough
  (mint channel closed by shape gate); `rollSeed` range pin.

## Verification

`npm run type-check` clean; scoped `npx vitest run src/core/production
src/services/save src/stores` — all green incl. the adopted auditor
pins (`fixpointR19Aut.qa.test.ts` 20, `auditR19Int.probe.test.ts` 5,
`fixpointR19Cor.qa.test.ts` 6 — two repros flipped to pin the
adjudicated deny semantics).
