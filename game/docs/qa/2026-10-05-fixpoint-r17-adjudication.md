# Fixpoint r17 adjudication — audit commit 5feb1270 (the r16 batch)

Wave r17 (3 blind auditors: COR / AUT / INT) attacked the r16 epoch-repair
batch. Verdicts: **COR FAIL (2 Low + 1 Nit)**, **AUT FAIL (1 Medium-High)**,
**INT FAIL (1 Medium + 1 Nit)**.

## The root class: epoch-blindness in the new mechanics

All confirmed defects reduce to the same invariant the r15/r16 batches
established — persisted payload fields live in the client epoch while
server-epoch anchors may only bound widths — applied to the mechanisms the
r16 batch itself introduced:

- the spawned-lane field-epoch re-stamp (r16-INT-03) classified lanes by
  OBJECT IDENTITY instead of chain origin, so saved-lane successors were
  shifted like server-seeded spawns;
- the live-claim provenance bound (r14 vintage) anchored a payload-epoch
  claim against an authority-epoch stamp, cutting honest tails by `skew`;
- the per-cycle lane walk had no depth bound at all (the decompose system's
  twin defense was never ported to the lane-chain mechanics).

## Confirmed findings

| Finding | Sev | Disposition |
| --- | --- | --- |
| R17-INT-01 / R17-COR-D1 — saved-lane SUCCESSORS rebuilt as fresh cycles failed the `persistedLanes` identity check and were shifted `+skew` late like virtual-seed chains -> pending successor's `completesAtMs` pushed up to `Date.now() - settleNowMs` late per site per boot | Medium (INT) / Low (COR) | FIXED — lanes now carry the epoch flag on the CHAIN ROOT: `advanceWorkerLanes` takes `spawnedSeedsAreServerEpoch`, tags seed cursors `serverSeeded`, propagates the flag to each successor, and only `serverSeededPending` members (server-seeded AND not saved) receive the `+fieldEpochShiftMs` re-stamp. `GameManagerSaveRestore` derives the flag from `offlineSinceMs === authorityNowMs - elapsed*1000` (an offlineSince that IS the server anchor) rather than from lane object identity. Saved-lane successors and client-anchored seeds keep their stamps. |
| R17-AUT-1 — per-cycle worker-lane settle walk unbounded: `lastSavedAt = 0` (1970) gave ~53.7M iterations / ~3.4s sync; `startedAtMs = -1e15` gives ~1e10 iterations. Twin of the r12-INT decompose attack the lane mechanics never inherited | Medium-High | FIXED — deadline-mode lane chains now jump O(1) to the post-window head once the budget is spent: `skippedDues = floor((now - due)/cycleMs) + 1` forfeits at once, `forfeited` accumulates the count, and the lane re-queues only when the slot contract allows it (`deadline` mode + `canSpawn` + `inFlight < slots`) — forfeited oversubscribed lanes die as before, preserving the budget-exhausted parity. `PRODUCTION_OFFLINE_CAP_SECONDS` (10h) bounds the honest depth anyway (~360 cycles at 100s). |
| R17-COR-B1 — live-claim provenance bound `min(lastSavedAt, authorityNow) + 24h` is computed in the authority epoch: under fast clock an honest record with `remaining > 24h - skew` loses up to `skew` of +25% tail in BOTH payout and stored expiry (repro: skew 2h, remaining 23h -> 1062 vs honest 1071) | Low | FIXED — replaced the provenance bound by the claim's OWN DURATION bound, split by purpose. Payout: `min(appliedAt, lastSavedAt) + TU_LINH_TRAN_DURATION_MS` — pure payload epoch; every live claim is capped at its honest-max class (freshly-applied full duration) so the claim-class invariant holds AND the whole honest tail pays (repro now 1071; the two r16 "residual" pins flip 5000 -> 5150). Storage: `min(appliedAt, authorityNow) + duration` — far-future `appliedAt` markers still cap at `now + duration` (no real buff time minted); the residual shrink `min(0, appliedAt - until)` for a claim applied within the last `skew` is irreducible (indistinguishable from a forged appliedAt). Dead arm now clamps at `min(authorityNow, Date.now())` so a slow clock cannot revive a save-dead record either. A >24h-duration non-stackable record (e.g. appliedAt=0 + far-future expires — the shape an old test encoded) is now correctly paid flat unbuffed. |
| R17-COR-N1 — `appliedAtMs` stored clamp mixes epochs | Nit | DOCUMENTED — cosmetic: liveness keys on `expiresAtMs`; `appliedAtMs` feeds no payout math. The `min(appliedAt, authorityNow)` clamp stays (a future `appliedAt` in storage is a forge marker anyway). |
| r17-INT-02 — stale comment still described r14-INT-6 semantics | Nit | FIXED — comment rewritten (r16-INT-04 clamp reads the field epoch). |

## Clean (audited, no defect)

- Payout window width — proved `== elapsed*1000` for all finite inputs; non-finite `lastSavedAt` rejected by the shape gate, and even admitted NaN produces zero segments (deny-safe).
- `percentAtSave` probe parity — raw payload stamps at `lastSavedAt`, identical semantics to the validator's `liveTltPercent` probe; `expires == lastSavedAt` dead-at-marker consistent across all three probes.
- `reconcileBuildings` grant stamping — `Date.now()/1000` field epoch; `getStoredAmount` readers agree; future stamps clamp.
- Spawned-lane negative space — spawns are always fresh objects; unsplit saved lanes survive as `lane.saved` (identity preserved, never shifted).
- Forge `lastSavedAt` directions (deep past / future / NaN / `sinceMs > untilMs`) — payout width never exceeds `elapsed*1000` and `elapsed <= 86400s`; NaN rejected.
- Buildings — past stamps bounded by `min(elapsed, 10h)*rate <= capacity`; future stamps clamp.

## Residual (documented, accepted)

- **Daily-reset marker in the past re-opens dailies once per load** (AUT suggestion) — self-healing after the very save that arms it; wiping and re-arming pays nothing beyond the honest daily grant. Accepted: the marker's own epoch is ambiguous under skew, and denying the reset would lose an honest daily instead.
- **Stackable regen chain expiry unbounded** — standing residual (r14-COR-3/INT-3, extended r16-AUT): no honest bound exists for additive chains; honest chains reach the same shape. Tracked in `decisions-needed.md` D-2026-10-05-01.
- **Spawned-lane shift is one-way** — under a slow clock the shift is 0 and spawned lanes keep bounded underpay (deny direction, self-healing on next settle).

## Verification

`npm run type-check` clean; scoped `npx vitest run src/stores src/services/save
src/core/production src/core/quest src/core/building` — **1040 tests, all
green** (5 new/updated pins: spawned-lane epoch shift x3, settle-loop depth
bound x2, plus the two r16 residual pins re-expected 5000 -> 5150 and the
honest-shape rewrite of the live-buff restore pin).
