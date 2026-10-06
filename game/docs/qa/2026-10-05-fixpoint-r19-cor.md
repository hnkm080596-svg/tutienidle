# Fixpoint r19 — COR audit (blind) of commit 8f60f30c (the r18 adjudication batch)

Auditor role: COR (correctness/regression). Blind to other waves' findings.
Attacked: `boundTimedEffectClocks`/`payoutExpiresAtMs` re-anchors in
`stores/player.ts`, the `LaneCursor.seeded` chain-root flag + widened
budget-exhaustion jump + forfeit parity in `WorkerLaneAdvance.ts`, the
all-seeded-heads field-epoch re-stamp in `ProductionOffline.ts`, and the
`offlineSinceIsServerEpoch` flag removal across
`GameManagerSaveRestore.ts`/`ProductionSystem.ts` — plus same-surface
siblings (validator probes, decompose/autofarm settles, epoch stamping).

Verdict: **FAIL WITH REASON** — 1 Low (deny-direction, exotic precondition;
may adjudicate as accepted residual). Everything else verified clean.

Repro evidence: `game/src/services/save/fixpointR19Cor.qa.test.ts` —
2 deterministic repros for the finding (both fail on 8f60f30c) + 4
verification pins that pass. Scoped run
`npx vitest run src/services/save src/core/production src/stores`:
**992 pass, only the 2 repros fail.** `npm run type-check` clean.

## Confirmed findings

### R19-COR-1 — dead arm kills a validator-admitted honest record whose stamps sit in an earlier clock epoch than the save marker — Low

`boundTimedEffectClocks` (player.ts:135-144) routes
`expires <= lastSavedAt` to the dead arm `min(authorityNow, Date.now())`.
The comparison treats `expires <= lastSavedAt` as "dead at save" — but
that equivalence only holds when the record's stamps and the marker
share one clock epoch. An honest payload can carry them in different
epochs: the record is written while the device clock is correct, the
clock steps forward before the save write (manual set / RTC correction /
drift), and corrects again before the restore. The record is then
honestly live on the field clock (`expires > Date.now()`) yet reads
dead-in-marker-epoch (`expires <= lastSavedAt`), so the dead arm clamps
the stored expiry to `now` and the buff dies at boot. Loss = the whole
honest remainder, bounded by `TU_LINH_TRAN_DURATION_MS` (24h). Deny
direction only — no mint.

Honest repro shape (repro a, `expires = now + 14h`, `lastSavedAt =
now + 30d`): the validator ADMITS the record — `appliedAt <= lastSavedAt`
and `expires <= lastSavedAt + 24h + 7d` both hold — but the cps probe
normalizes the honestly-buffed `cultivationPerSecond` 12.5 → 10 under the
same marker-epoch comparison, and `restoreFromSave` stores
`expiresAtMs = currentMs` (dead at boot) instead of `currentMs + 14h`.

Companion payout arm (repro b, cold-boot 120s window): the honestly
buffed real interval pays flat — `120 x 10 = 1200` instead of
`120 x 10 x 1.25 = 1500` — because `payoutExpiresAtMs` keeps the raw
stamp (dead-position semantics) and the payload-epoch window
`[lastSavedAt, lastSavedAt + width]` sits entirely past the record's
stamp. Same root cause, same deny direction.

Assessment for adjudication: the identical *crafted* payload (forged
future marker + forged mid-window `expires`) is indistinguishable — a
looser dead arm would revive a dead buff — so this is a genuine
trade-off, arguably correctly resolved toward deny. Reported because the
r18 audit's "dead arm correct direction both ways" clean claim
(2026-10-05-fixpoint-r18-cor.md) only covered single-epoch records; the
flip shape was unexamined. Pre-existing arm (r15-COR-A), surfaced under
the r18 surface review — not an r18-introduced regression.

## Clean (audited, no defect)

- **Live arm admits the whole honest class**: `min(expires,
  provenance + dur)` with `provenance = min(lastSavedAt, authorityNow)`
  keeps single buys (`expires = apply + dur <= lastSavedAt + dur`),
  rebuy chains (`appliedAt` frozen at first buy, `expires` max-extends,
  still `<= lastSavedAt + dur`), and same-epoch skews whole; the +7d
  validator allowance is absorbed by the `+24h` clamp (no
  admit-then-over-grant). `TU_LINH_TRAN_DURATION_MS` is genuinely the
  class max — `activateTuLinhTran` is the only non-stackable writer and
  every authored pill regen is `stackable: true` (60-120s durations).
- **Crafts stay dead**: `appliedAt > lastSavedAt` rejected upstream;
  `expires > lastSavedAt + 24h + 7d` rejected; in-between claims clamp
  to `provenance + 24h` — at most the authored duration of liveness past
  trusted-now, the same cap an honest just-before-save buy gets.
- **`payoutExpiresAtMs`/`percentAtSave` consistency**: `percentAtSave`
  samples RAW stamps at `lastSavedAt` (validator-probe parity, so a
  buffed snapshot divides back correctly); the payout copy bounds only
  live claims and keeps dead positions — a crafted inflated snapshot
  cannot widen the paid rate past `claim/(1+p) x (1+p) = claim`.
- **Jump arm ≡ walk**: `headCostMs > budgetLeftMs && cycleMs >
  budgetLeftMs` is exactly "this due AND every successor unpayable"
  (all successors cost `cycleMs`; `budgetLeftMs` is monotone
  non-increasing, so once armed it stays armed). `inFlight` never grows
  inside the loop (respawn is -1/+1 per due, else net -1 on lane death),
  so the respawn check's outcome at jump time equals every walked
  iteration's — `forfeited += skippedDues` on reinsert and `+= 1` on
  death are both walk-parity exact. `skippedDues` math
  (`floor((now-due)/cycle)+1`) leaves `lastDue <= now < lastDue+cycle`
  for any finite `due <= now` with `cycleMs > 0`; rng stream untouched
  (skipped dues mint no rollSeeds); `lane.saved = undefined` on reinsert
  drops the dead saved identity correctly. Pin-verified: 360 completions
  then `forfeited = 640` via the jump, pending head at `100.1M`, and an
  oversubscribed (`slots = 0`) pair reports exactly `forfeited = 2`.
- **`seeded` flag propagation**: set only at settle-time seeding
  (`emptyLaneStartMs` block), inherited by successors
  (`seeded: lane.seeded`), preserved through jump reinserts (same lane
  object mutated), never on `params.pending`-rooted lanes;
  `seededPending`/`pending` index alignment is 1:1 over the same `lanes`
  array, and object identity makes the `Set` membership exact.
- **All-seeded re-stamp**: `max(0, Date.now() - nowMs)` remaps each
  seed-rooted head's `startedAt/completesAt` so the field clock reads
  `Date.now + remaining` — verified exact under every anchor epoch:
  local-authority settles produce `settleNowMs = Date.now()` (shift 0);
  cold-boot slow-clock produces `nowMs > Date.now` (shift clamps 0,
  correct — device-epoch stamps tick on the device clock); cold-boot
  fast-clock shifts `+skew` onto the device epoch (correct deadline).
  Client-anchored deep-past seeds (the r18-COR-4 class) now shift to
  `Date.now + remaining` instead of persisting past-due — pin-verified
  end-to-end through `settleProductionOffline` (seeded head
  `[800k, 900k] -> [1.0M, 1.1M]` under a +200k skew while the saved
  chain's successor stays `[750k, 850k]` raw — COR-D1 regression closed).
  Double-shift impossible: a persisted shifted head is a *saved* lane at
  the next settle (flag lives on `LaneCursor`, not the cycle object).
  Post-shift validator pins hold: span preserved exactly;
  `startedAt' <= Date.now() <= next lastSavedAt`.
- **Callers**: `offlineSinceIsServerEpoch`/`spawnedSeedsAreServerEpoch`/
  `serverSeededPending`/`serverSeeded` fully excised — zero orphaned
  references repo-wide; single settle path
  (`GameManagerSaveRestore:435 -> ProductionSystem.settleOffline ->
  settleProductionOffline -> settleWorkersOffline -> advanceWorkerLanes`),
  no double-settle; `offlineSinceMs = min(lastSavedAt, until - elapsed)
  <= settleNowMs` holds on every authority kind (elapsed is always
  `>= 0` via `calculateOfflineTime`'s `max(0, ...)`);
  `ProductionSystem.settleOffline` resolves `resolveTerritoryTier`
  before settling (no raw-realm divergence vs `tickWorkers`); observe
  mode can never arm the jump (`budgetMs` is undefined online) and its
  per-tick pending write is flag-free.
- **Sibling surfaces**: `DecomposeSystem.settleOffline` cap-back and
  `settleAutoFarmOffline`'s `min(capped, anchorGap)` clamp are unchanged
  and still bound their own settle classes; `restoreAuthorityNowMs` NaN
  cannot reach the anchors (parseTimestampMs upstream) and
  `advanceWorkerLanes`'s non-finite guard fails closed anyway.
- **r18-adopted repro pins pass on 8f60f30c** (`fixpointR18Cor.qa.test.ts`,
  `ProductionOffline.test.ts` re-stamp pins, `player.r18Aut.test.ts`,
  `auditR18Int.repro.test.ts`).

## Carried observation (pre-existing, not charged to r18)

- The `workerCycles` `startedAtMs <= lastSavedAt` validator pin
  (saveShapeValidation.ts:3416) rejects ANY save whose field stamps sit
  ahead of the marker — a backward clock correction after fast-clock
  writes already bounces such saves for online-spawned cycles; the
  +skew re-stamp widens the exposed stamp set by exactly the seeded
  heads. Deny direction, exotic precondition; recording for adjudication
  completeness only.

## Severity summary

| Finding | Severity | Direction |
| --- | --- | --- |
| R19-COR-1 dead arm kills cross-epoch honest record | Low | honest deny, <= 24h of one buff; indistinguishable from revive craft |
