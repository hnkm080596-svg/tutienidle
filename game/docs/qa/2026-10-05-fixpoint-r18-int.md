# Fixpoint r18 INT — integration coherence audit of cef2af9e (the r17 adjudication batch)

Wave r18 INT scope: verify the r17 batch stays coherent across system
boundaries — (a) `advanceWorkerLanes` `spawnedSeedsAreServerEpoch` +
`serverSeededPending` + the O(1) exhausted-budget jump vs the online
tickWorkers path; (b) every `offlineSinceIsServerEpoch` caller for a
missing/incorrect flag; (c) the `payoutExpiresAtMs` signature change and
`boundTimedEffectClocks` dead arm; (d) stale comments/docs for the
removed provenance bound or `persistedLanes`; plus ordering/shift
semantics across the two settle paths.

**Verdict: FAIL — 1 Medium (latent class) + 1 Nit.** Deterministic repro
on branch `devin/audit-r18-int-cef2af9e`
(`src/stores/auditR18Int.repro.test.ts`, 2 red pins).

## Confirmed findings

### R18-INT-01 — the r17-COR-B1 duration bound kills honest non-stackable REBUY chains — Medium (latent)

The r17 fix replaced the provenance bound with the claim's own-duration
bound `min(appliedAt, ·) + TU_LINH_TRAN_DURATION_MS`, treating
`appliedAt + duration` as the honest-max expiry. That is only true for a
first-application claim. `applyTimedEffect`'s non-stackable merge keeps
`existing.appliedAtMs` at the FIRST application while max-extending
`existing.expiresAtMs` on every same-group rebuy
(`GameManagerPersistentEffectOps.ts:315-321`), so an honest repeat
purchase produces `expires - appliedAt > duration` — the exact shape
the shape validator admits and documents as legitimate
(`saveShapeValidation.ts:1556-1589`: "an honest repeat purchase
legitimately produces a span beyond TU_LINH_TRAN_DURATION_MS", expires
admitted up to `lastSavedAt + duration + 7d`).

Both new bounds contradict that admitted shape by anchoring at
`appliedAt` instead of `lastSavedAt`:

- **Stored expiry** (`boundTimedEffectClocks`, player.ts:131-139):
  honest record `appliedAt = save - 30h`, rebuy ~1h before save →
  `expires = save + 23h`. Bound = `appliedAt + 24h = save - 6h` →
  stored `expiresAtMs` clamps into the past → the live buff dies at
  every restore.
- **Payout expiry** (`payoutExpiresAtMs`, player.ts:157-175):
  `min(appliedAt, lastSavedAt) + duration = save - 6h` < window start
  → the whole offline window pays flat unbuffed (repro: 100s × buffed
  4/s should pay 400, pays 320).

The honest-max expiry for the non-stackable class is
`lastApply + duration ≤ lastSavedAt + duration`; any bound below that
cuts some honest shape. The r17 bound preserves single-purchase tails
under skew (real win vs r14) but newly denies the whole rebuy class —
the validator's own comment contradicts it. Note the shapes are
fundamentally ambiguous: a crafted record with old `appliedAt` +
far-future `expires` is indistinguishable from an honest rebuy chain, so
the bound trades honest-chain survival for deny-strength — that trade
should be deliberate (or the validator's +7d admission narrowed), not
accidental.

**Repro**: `src/stores/auditR18Int.repro.test.ts` — both pins red
deterministically (`expiresAtMs` clamped to `appliedAt + 24h`; payout
320 vs 400).

**Reachability today**: zero — `activateTuLinhTran` (the only
non-stackable writer) has no production caller (tests only), and every
authored regen pill is `stackable: true` (`pills.ts`), which exempts
them from the bound entirely. The defect is real but dormant: it fires
the moment any non-stackable timed-effect writer becomes reachable, and
today only serves deny-direction against crafted saves claiming the
honest chain shape. Severity argued Medium because the contract between
the validator's admitted shape and the restore bound is now broken —
adjudicator may demote to Low on dormancy.

### R18-INT-02 — stale r14-AUT-2 comment block still describes the removed provenance bound — Nit

`player.ts:99-104` still documents the non-stackable forward bound as
"anchors at the save's own provenance (`provenanceMs = min(lastSavedAt,
now)`... `expires > lastSavedAt + TU_LINH_TRAN_DURATION_MS` is
impossible provenance") — superseded by the r17 duration bound, which
the very next comment block (:125-130) describes differently. A reader
gets two contradictory accounts of the live arm; `provenanceMs` now only
feeds the non-finite-`appliedAt` fallback (:137). Comment-only.

## Clean (audited, no defect)

- **Online-path parity (a)**: `tickWorkers` (ProductionSystem.ts:358-434)
  calls `advanceWorkerLanes` with no `budgetMs` and no
  `spawnedSeedsAreServerEpoch` → `hasBudget` is false so the O(1) jump
  block is unreachable online, `serverSeeded` is never set so
  `serverSeededPending` is always empty, and the only reader of that
  field is `settleWorkersOffline`. `state.workerCycles = result.pending`
  stays unshifted — correct: online seeds spawn at field-epoch `nowMs`.
- **Jump-block equivalence (a)**: `skippedDues = floor((now - due)/cycle)
  + 1` counts exactly the dues the walked loop would forfeit (head +
  in-window successors); reinsert gate `deadline && canSpawn &&
  inFlight < slots` is identical to the walked respawn rule evaluated on
  the same `inFlight` value; `saved` is cleared and `serverSeeded`
  preserved on the reinserted lane; RNG consumption is unchanged
  (forfeits never build cycles). One divergence: `forfeited` counts
  unborn successors the walked loop would never reach (oversubscribed
  lanes die at the head), but `forfeited` is a dead counter — no caller
  reads it (`result.pending`, `result.completed`,
  `result.consumedBudgetMs`, `result.serverSeededPending` are the only
  consumed fields). Caveat only if `forfeited` ever becomes telemetry.
- **Flag plumbing (b)**: `offlineSinceIsServerEpoch` is derived once in
  `GameManagerSaveRestore:434-436` and correct for every reachable
  caller — cold-boot via `useAppLifecycle:458-468` (flag true iff the
  server bound strictly anchors `offlineSinceMs`; under cold-boot
  `authorityNowMs - elapsed*1000 == sinceMs` exactly, so the flag
  reduces to `sinceMs < lastSavedAt`), legacy/warm restore (bound ≥
  `lastSavedAt` → false → client-epoch lanes unshifted ✓),
  `EarlyGameSession.restoreCheckpoint` → `restoreGameSession` without
  authority → false ✓, and test callers of `settleProductionOffline`
  (flag absent = client-anchored windows ✓; the timeAuthority harness
  passes true ✓). `productionSystem.settleOffline` has exactly one
  production caller (GameManagerSaveRestore:443). Equality edge
  (`bound == lastSavedAt`) correctly yields false — both epochs name
  the same instant.
- **Twins checked**: `decomposeSystem.settleOffline` and
  `alchemySystem.settleOffline` take the same window but never seed
  stamps at `offlineSinceMs` — decompose advances its own persisted
  client-epoch `nextCycleAt`, alchemy jobs carry persisted
  `completesAtMs` — so no server-epoch stamp leaks into the save and
  the absent flag is correct there. Settlement events carry
  materialId/amount/overflow only — no stamp consumers.
- **Ordering/shift semantics**: `pending = lanes.map` is index-aligned
  with `lanes` (1:1, sort-stable); `serverSeededPending` filters that
  same order → deterministic. Double-shift impossible: shifted pending
  heads persist as `saved` cycles and `serverSeededPending` requires
  `saved === undefined`; saved-lane successors copy `serverSeeded`
  (undefined) → never marked. Missed-shift impossible: the only settle
  that stamps `serverSeeded` is the one that shifts.
- **(c) surface**: `payoutExpiresAtMs` has exactly one call site
  (player.ts:406) — updated; `effectProvenanceMs` still legitimately
  feeds `boundTimedEffectClocks`. Dead arm `min(nowMs, Date.now())` is
  deny-direction under fast, slow, and crafted-future-`lastSavedAt`
  clocks; non-finite inputs fall through to own-stamp consistent with
  the validator's finite-`lastSavedAt` gate (:2297).
- **(d) docs**: no stale references to `persistedLanes` or the
  provenance bound outside dated adjudication records (historical by
  convention). The one stale comment is R18-INT-02.
- **NaN `emptyLaneStartMs` infinite loop**: unreachable — any NaN
  upstream (`lastSavedAt`, authority stamps) also NaNs
  `elapsedOfflineSeconds`, failing the `> 60` settle gate before
  `advanceWorkerLanes` runs; `lastSavedAt` is finite-gated by the
  validator regardless.

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/core/production src/stores src/services/save` —
  **981/983 pass**; the only 2 failures are the intentional repro pins
  in the new additive file `src/stores/auditR18Int.repro.test.ts`
  (no production code touched). Pre-existing suite fully green.
