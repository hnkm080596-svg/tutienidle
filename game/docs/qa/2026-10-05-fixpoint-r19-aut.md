# Fixpoint r19 AUT audit — commit 8f60f30c (r18 adjudication batch)

Blind adversarial audit of the r18 batch: TLT claim bound re-anchored to
`min(expires, lastSavedAt + 24h)` (payout) / `min(expires,
min(lastSavedAt, authorityNow) + 24h)` (storage); WorkerLaneAdvance jump
guard widened to `headCostMs > budgetLeftMs && cycleMs > budgetLeftMs`;
`seededPending` field-epoch re-stamp `+max(0, Date.now() - nowMs)`
replacing the server-epoch flag; dying-lane forfeit parity = 1. Attack
surface: crafted save payloads passing `validateGameSaveShape` plus a
forged device clock, hunting residual mint paths.

**Verdict: PASS WITH EVIDENCE.** No residual mint path confirmed; every
attacked bound verified held by deterministic probes (20 passing tests).
One non-client-reachable hardening note recorded below.

## Confirmed findings

None. The documented residuals from earlier waves re-verified bounded:

- **Saved-lane pending head early-pay (~1 cycle).** A saved lane's
  surviving head is not seed-rooted, so the re-stamp skips it and its
  own payload-epoch deadline persists verbatim (probe S3). Under a fast
  field clock that stamp can already be past `Date.now()` — it pays once
  at the next `tickWorkers`, then the lane refills at `nowMs` in
  `observe` mode (no chain). Bounded: one cycle per saved lane head,
  `workerCycles.length <= betaEffectiveWorkerCapacity`.
- **Stackable expiry passthrough (r14-AUT-1).** Unchanged — and the mint
  channel stays closed: `durationStackable:true` forged onto a TLT record
  is rejected by the shape gate (probe T5), and non-`tu_linh_tran`
  sources cannot carry `cultivationSpeedPercent` at all.
- **`workerCycles[].rollSeed` range-pinned only.** Same provenance-limit
  class as before; reward roll bounded per saved cycle, one grant each.

## Considered and clean (attacker probes)

**(1) TLT claim bound.** `boundTimedEffectClocks` /
`payoutExpiresAtMs`, `player.ts:111-174, 404-406`.

- *Deep-past appliedAt + live expires* (T1): `{applied = save-400d,
  expires = lastSavedAt+22h}` stores at its own stamp — inside
  `provenance + 24h` already, never widened. `appliedAtMs` clamps at
  `min(appliedAt, authorityNow)`; the bound ignores `appliedAt` entirely,
  so forging it cannot stretch anything.
- *Validator-ceiling expiry* (T2): `expires = lastSavedAt + 24h + 7d`
  (widest admitted shape) stores at `lastSavedAt + 24h` — dies with the
  save's own provenance, strictly below `authorityNow + 24h` for a stale
  save. The r14-AUT-2 revive direction stays closed (R3).
- *Forged-future marker* (T3/T8): `lastSavedAt = until + 30d` → the live
  arm clamps provenance at `min(lastSavedAt, authorityNow) = until`, so
  the stored buff caps at exactly `until + 24h` — never beyond; the
  offline window collapses to width 0 (`elapsed = 0`), zero payout.
- *Non-finite fields* (T4): `expiresAtMs`/`appliedAtMs` =
  Infinity/NaN rejected by the shape gate before restore ever runs.
- *Ordering pins* (T6): `expires < appliedAt` and
  `appliedAt > lastSavedAt` both rejected.
- *Stackable bypass* (T5): `durationStackable:true` on a TLT record is
  rejected — the passthrough arm is unreachable for the TLT class.
- *Payout width* (T7): a claim live for only 1ms of a 30s window pays
  exactly `10 x 29.999 + 12.5 x 0.001` — the segments, not the storage
  bound, decide; the claim cannot ride `lastSavedAt + 24h` past its own
  death. Marker-exact death (`expires == lastSavedAt`) emits zero buffed
  seconds (R1).
- *cps snapshot probe parity* (R4): the validator's `liveTltPercent`
  (saveShapeValidation.ts:829) and restore's `percentAtSave`
  (player.ts:444) sample the same raw domain at `lastSavedAt` — moving
  `expires` by 1ms across the marker moves both from `p = 0` to
  `p = 0.25` identically (admitted cps 10 vs 12.5). A forged
  `percent = 1e-9` loosens the bound by only `1e-9`, so the r15-AUT-1
  micro-percent/micro-window shape stays defunct: `unbuffed =
  claim/(1+p)` is pinned at BASE, never `BASE x 1.25`.
- *Cold-boot window derivation*: `elapsed = min(until - since, 86400s)`
  is a pure server-asserted duration (no client clock inside), still
  capped at 24h by `calculateOfflineTime`'s default; `since > until`
  collapses to 0 (R2); `since < lastSavedAt` positions the same
  authorized width in the payload epoch — per r14-COR-1's client-ahead
  contract — and paid width can never exceed `elapsed` at a rate
  `<= BASE x 1.25`. Legacy local path keeps the `86400s` cap.
- *Dead arm* (T9): `expires <= lastSavedAt` clamps at
  `min(nowMs, Date.now())` — under a slow device clock a dead record
  stores at field-now (reaped), under a fast clock at authority-now
  (already past); both deny directions, no revive.

**(2) WorkerLaneAdvance jump guard.** `WorkerLaneAdvance.ts:193-222`.

- *Huge-span saved head* (W1): `headCost = 7.6d > 10h` budget and
  `cycleMs > budget` arm the jump — O(1), ~zero wall time, the pending
  head re-inserts at the first due past `nowMs` in `(now, now+cycle]`,
  `forfeited` finite.
- *Affordable saved head* (W2): a deep-past head whose span fits the
  budget completes once through the normal path (in-flight work is
  honored), then the chain walks/jumps under the same shared budget —
  360 completions for a 100s cycle under the 10h cap, deterministic.
- *`cycleMs = 0` site* (W3): `canSpawn = false` → no respawn, no seeds;
  the single lane drains in one iteration.
- *`skippedDues`/`Math.floor` extremes* (W4): `dueMs = -1e15` with a 22s
  cycle gives `skippedDues ~4.5e10` — integer arithmetic is exact at
  these magnitudes (doubles represent all ints < 2^53), the re-inserted
  head lands in `(now, now+cycle]`, loop terminates O(1).
- *Guard arm coverage*: the widened `&&` covers `budgetLeft in
  (0, cycleMs)` — a leftover too small for one successor now jumps
  instead of spinning forfeit cycles. The forfeit-parity asymmetry
  (`skippedDues` vs `1` for a dying lane) is the documented r18-N1
  parity choice: a lane that still holds a slot forfeits its whole
  skipped span; a lane out of slots forfeits the head only — matching
  what the per-iteration walk would have produced.
- *Reachability of the arm*: `startedAtMs <= lastSavedAt` and
  `span === computeCycleSeconds*1000` exactly are validator-pinned, so
  `dueMs <= nowMs` is the only way a lane enters the loop; the jump
  math above always lands `lastDue <= now < lastDue + cycle` in exact
  arithmetic, and FP drift at admissible magnitudes converges (each
  pass shrinks the remaining distance by ~100x).

**(3) `seededPending` re-stamp.** `ProductionOffline.ts:183-193`,
`WorkerLaneAdvance.ts` lanes.

- *Deep-past client anchor under a fast clock* (S1): crafted
  `offlineSinceMs = 0` seeds chains that settle under the 10h budget;
  every seed-rooted pending head is re-stamped by
  `+max(0, Date.now() - settleNowMs)` into `(fieldNow, fieldNow +
  cycle]` — none lands early. The client cannot anchor `offlineSinceMs`
  itself: upstream `GameManagerSaveRestore` computes
  `min(lastSavedAt, authorityNow - elapsed)` — the payload marker only
  ever pulls the anchor deeper into the past, which makes the seed
  window WIDER and the walk longer (bounded by the budget), never
  earlier.
- *Slow clock* (S2): `Date.now() < settleNow` → shift = 0 → seeded
  heads persist at the settle epoch, still strictly after field-now —
  the bounded underpay direction only.
- *Saved lanes can't smuggle the flag* (S3): `seeded` is set only in the
  empty-lane seed loop (`lanes.length < slots` at seed time) and
  inherited by successors inside `advanceWorkerLanes` — a crafted
  `workerCycles` entry can never carry it (the flag is recomputed from
  lane provenance, not read from the payload). `seededPending` is
  index-aligned to `lanes` via the same map that builds `pending`, so
  only seed-rooted heads take the shift; a saved lane's surviving head
  keeps its own deadline verbatim.
- *Re-stamp monotonicity*: `max(0, ...)` shifts forward only; shifted
  dues are `(nowMs, nowMs + cycle] + shift = (fieldNow, fieldNow +
  cycle]` — always after field-now. There is no code path that moves a
  seeded deadline earlier.

**(4) Residual surfaces.**

- `restoreFromSave` window derivation re-verified above (R2, T8);
  `elapsedSeconds` in the result is the authorized span and
  `cultivation` is the post-`addCultivation` delta — the realm-level
  requirement cap is an additional bound on every offline grant
  (mortal-1 grants hard-stop at 600).
- `boundTimedEffectClocks` dead arm verified under both clock
  directions (T9 + source trace).
- `payload-identity` guard: the WHOLE-payload hash means replaying the
  same crafted save is a no-op; a second crafted payload restores anew
  but re-derives the same bounds — no accumulate-on-restore.
- Non-TLT timed effects with `cultivationSpeedPercent` are
  validator-rejected; `getActiveCultivationSpeedPercent`'s own filter
  (`group + sourceItemId + 0 < percent <= 0.25`) double-bounds the
  percent channel even if a foreign record slipped through.

## Hardening note (outside threat model — not client-reachable)

`advanceWorkerLanes` guards `nowMs`/`budgetMs` non-finite but not
`emptyLaneStartMs` or pending dues: a NaN `emptyLaneStartMs` in
`deadline` mode would push a NaN-due lane whose `dueMs > nowMs` is
false forever, `headCost = NaN` skips the jump arm, `costMs = NaN`
forfeits, and the lane respawns NaN-due indefinitely — an infinite
forfeit/respawn loop. Not reachable through `validateGameSaveShape`
(`lastSavedAt`/`startedAtMs`/`completesAtMs` all finite-pinned, and the
span-equality pin forces finite dues) nor through `tickWorkers`
(`emptyLaneStartMs = nowMs`). Worth a defensive `Number.isFinite` on
`emptyLaneStartMs`/pending dues if a future caller ever feeds
unvalidated input — a one-line guard matching the existing nowMs/budget
check. Recorded as a Low hardening suggestion, not a confirmed defect.

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save/fixpointR19Aut.qa.test.ts
  src/services/save/fixpointR18Cor.qa.test.ts
  src/stores/player.r18Aut.test.ts` — **25 passed / 0 failed** (the r18
  repro tests stay green on 8f60f30c, confirming the adjudicated fixes).

Repros on `devin/audit-r19-aut-8f60f30c`: 20 deterministic probes in
`src/services/save/fixpointR19Aut.qa.test.ts` (T1-T9, W1-W4, S1-S3,
R1-R4). No production code touched.
