# Fixpoint r20 — INT (integration coherence) audit

**Audit target:** commit `060826af` on `codex/hoa-cau-fireball-vfx` — the
r19 adjudication batch (non-finite lane guard hardening, two stale-comment
fixes, R19-COR-1 accepted-residual flips). Re-verifies the r18 surface at
the new tip.

**Verdict: PASS WITH EVIDENCE** — 1 Nit finding (one more stale comment
fragment the r19 fix pass missed). No Medium-or-higher defect; every
audited contract verified coherent.

## Axis 1 — WorkerLaneAdvance non-finite guard: zero-advance coherence for all callers

**Coherent.**

The guard (WorkerLaneAdvance.ts:123-138) fires BEFORE lane construction and
returns `{completed: [], pending: [...params.pending], forfeited: 0,
consumedBudgetMs: 0, seededPending: []}`.

- `tickWorkers` (ProductionSystem.ts:414-426, observe): the allocator runs
  first (`state.activeWorkerSlots` assigned :391-393), then
  `state.workerCycles = result.pending` persists the identical cycle object
  refs — no copies, no mutation. `completed: []` ⇒ `grantCycleRewards`
  never runs ⇒ no double-grant. `activeWorkerSlots` accounting is upstream
  of the advance call ⇒ unaffected.
- `settleWorkersOffline` (ProductionOffline.ts:157-170, deadline): on
  zero-advance `seededPending: []` ⇒ `seededHeads` Set is empty ⇒ the
  re-stamp map (:186-194) returns every `cycle` verbatim ⇒ saved objects
  persist byte-identical. `budgetMs -= 0` ⇒ the shared 10h cap budget is
  untouched for the next site. `settled` counts only real completions.
- `seededPending: []` with `pending: [...params.pending]` is consistent:
  the `seeded` mark only exists on lanes the empty-lane construction loop
  spawned; the guard returns before that loop, so nothing in `pending` can
  carry it. `seededPending` is keyed by object identity, and the guard's
  `pending` holds exactly the same refs `params.pending` carried — the
  re-stamp Set can never touch them.
- Non-finite `slots` is unreachable: both callers source `slots` from
  `allocateWorkerSlots`, whose output is bounded by `Math.max(0,
  Math.floor(capacity))`; `capacity` is the domain's own resolved worker
  pool (finite int chain), not a persisted stamp.
- "Not client-reachable" claim verified: `validateProductionCycleSave`
  (saveShapeValidation.ts:3313-3422) pins `startedAtMs`/`completesAtMs`
  finite, exact span, `startedAtMs <= lastSavedAt`; `untilMs`/`cutoffMs`
  pass through `parseTimestampMs` (undefined on non-finite) before
  `serverAuthority` is built (SupabaseCloudSaveService.ts:460-463,772-775);
  `nowMs` is always a finite caller arg.
- Documented residual (by design, not a defect): the guard is per-site
  atomic — one non-finite entry wedges the site's WHOLE pending set
  permanently (finite siblings never advance, no seeds spawn) until the
  entry is cleared. This is the intended preserve-over-drop semantic; the
  alternative silently drops saved work.

Probe evidence: `auditR20Int.probe.test.ts` A/B/C — end-to-end through
both callers plus the mechanism contract pins (identity refs, empty
seededPending, zero consume), all green.

## Axis 2 — comment/doc coherence re-scan

**One missed fragment.**

The r19 fix updated both flagged sites correctly:

- `boundTimedEffectClocks` docstring (:107-109): now names the restore-map
  consumer + sibling `payoutExpiresAtMs` bound — accurate.
- `payoutTimedEffects` comment (:396-404): now describes the payout-epoch
  sibling split (`lastSavedAt + dur` vs `provenance + dur`, strictly
  tighter under fast clock) — accurate.
- `ProductionOffline.ts:152`: "save instant" → "authorized window start
  (offlineSinceMs)" — fixed, matches cold-boot semantics (`since` may be
  the server cutoff below `lastSavedAt`).
- The mechanism's own guard comment (WorkerLaneAdvance.ts:115-126)
  accurately describes the NaN-forever hang it prevents.
- No remaining `serverSeeded`/`offlineSinceIsServerEpoch`/`appliedAt`
  anchoring claims found in player.ts/ProductionOffline.ts; the
  `appliedAt` mentions that exist (:87, :117-119, :130-131) correctly
  describe the first-buy-stamp clamp.
- r18/r19 adjudication docs cross-checked vs shipped code: bound claims
  (provenance+dur storage, lastSavedAt+dur payout, dead-arm
  `min(nowMs, Date.now())`), jump-arm claims (`headCostMs > budgetLeftMs
  && cycleMs > budgetLeftMs`), residual lists (saved-chain stamp, stackable
  passthrough, forfeited-has-no-consumer) — all match.

### R20-INT-01 — Nit — stale "shared helper" claim at the restore-map call site

`game/src/stores/player.ts:613-615` (comment over the
`persistentTimedEffects` restore map):

> `r12-COR: bound the wall-clock window a persisted timed effect may
> claim - shared helper above (r13-INT-01/02: seconds-domain honest
> ceilings; stackable chains keep their forward expiry).`

"shared helper" is stale post-r15 the same way R19-INT-01's docstring line
was: `boundTimedEffectClocks` is no longer shared — the payout read maps
through the sibling `payoutExpiresAtMs` (:405-408), and the restore map is
this function's only caller. The r19 fix pass corrected the docstring and
the payout-side comment but missed this third instance of the same stale
claim. Cosmetic; risk is a future reader editing the wrong function under
the "shared" assumption. Evidence: SOURCE_PROOF + caller grep (single
call site at :616-626).

## Axis 3 — bound-pair contract `boundTimedEffectClocks` vs `payoutExpiresAtMs`

**Verified, invariant holds on every path.**

- Invariant `storage bound <= payout bound`: live arm binds at
  `min(expires, provenance + dur)` with `provenance = min(lastSavedAt,
  authorityNow) <= lastSavedAt` ⇒ `provenance + dur <= lastSavedAt + dur`
  ⇒ storage never looser than payout. Dead arm stores
  `min(expires, min(authorityNow, Date.now())) <= expires <= lastSavedAt`
  ⇒ also under the payout bound. Universal form: `stored.expiresAtMs <=
  min(savedExpires, lastSavedAt + dur)` on every path.
- No divergent path: the payout map (:405-408) and the restore map
  (:616-626) both run unconditionally inside `restoreFromSave`; the only
  early exit is the payload-identity no-op (:352-356) which skips BOTH.
  The legacy/undefined-authority path passes the identical
  `save.player.lastSavedAt` + `effectProvenanceMs` args
  (`authorityNowMs = Date.now()`).
- `live-replacement` authority: elapsed 0 ⇒ zero payout, storage bound
  still applies — same code, no inconsistency.
- `applyTimedEffect` (GameManagerPersistentEffectOps.ts:307-352) confirms
  the honest shape the bound admits: non-stackable group merge keeps
  `appliedAtMs` at first buy, `expiresAtMs = max(existing, new)` ⇒
  `expires <= lastApply + dur <= lastSavedAt + dur`.

Probe evidence: probe D (6-case matrix over authority kinds ×
dead/live/over-claim × clock skew — exact arm bound + pair invariant
pinned), probe E (legacy path runs payout AND storage bound on the same
args).

## Axis 4 — test placement + flipped R19-COR-1 assertions

**Acceptable + aligned.**

- The new guard pins sit in `ProductionOffline.test.ts` (:437-477) testing
  the mechanism directly. `advanceWorkerLanes` has no dedicated test file;
  the mechanism's only production driver through `deadline` mode is the
  settle path this file already harnesses, and the file reuses its own
  `makeCycle`/`createHarness` conventions. A dedicated file would be
  cleaner isolation but is not required for coherence — the guard's
  purpose is protecting these callers. Placement acceptable.
- The flipped R19-COR-1 repros (`fixpointR19Cor.qa.test.ts`) pin exactly
  the adjudication's deny semantics: (a) `stored.expiresAtMs ===
  currentMs` pins the dead-arm deny position; (b) `cultivation === 1200`
  pins the flat 120×10 payout after cps normalization. Both assert
  `validation.ok` first — the rejected record is admitted-and-bounded,
  matching the doc's "admitted but denied" claim. Green at 060826af.

## Evidence

- Probe file: `game/src/services/save/auditR20Int.probe.test.ts` — 5
  probes (A settle-path coherence, B observe-path coherence, C mechanism
  contract, D bound-pair matrix, E legacy parity), all green at 060826af.
- Type-check: `npm run type-check` clean.
- Scoped suite: `npx vitest run src/core/production src/services/save` —
  49 files / 904 tests green at 060826af (includes all r18/r19 pin files).

## Residual / verified-clean notes

- Per-site-atomic wedge under a poisoned pending entry — preserve
  semantics by design; unreachable via validated saves.
- Saved-chain heads keep own stamps under forward shift (r19-int residual)
  — unchanged, still pinned.
- Stackable `expiresAtMs` passthrough — r14-AUT-1 accepted residual,
  identical in both bound functions.
- `forfeited` has no production consumer — r18-AUT-N1 disposition holds.
