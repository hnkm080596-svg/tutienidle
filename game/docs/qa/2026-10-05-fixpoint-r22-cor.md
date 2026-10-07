# Fixpoint r22 — COR audit (commit bf3b44a1)

Scope: independent re-audit of the r21 adjudication batch — magnitude
bound `|x| < 2^53` on every persisted timestamp cursor
(`saveShapeValidation.ts` `isBoundedTimestamp` /
`isNonNegativeBoundedTimestamp`), the WorkerLaneAdvance guard widening
(`nowMs` magnitude + `slots` bounded integer 0..65536), the
DecomposeSystem O(1) fast-forward jump, and the flipped/pinned tests in
`auditR21*` / `fixpointR20Cor.qa.test.ts` / `ProductionOffline.test.ts`.

Verdict: **FAIL** — one Confirmed Medium (R22-COR-1).

## Invariant ledger

| # | Attack | Result |
|---|--------|--------|
| 1 | Honest writer stamps vs `|x| < 2^53` | Clean — every authored writer emits `Date.now()±small-delta` (≤ ~8.64e15): buildGameSave lastSavedAt, pill regen now+dur, TLT max-extend, worker-cycle seeds (≤ Date.now()+cycleMs after the field-epoch shift ≤ Date.now()), alchemy started/completes, buildings lastCollectedAt (seconds domain ~1.7e9), tribulation now+300s, quest reset now, autofarm now−remainder. One exception — see R22-COR-1. |
| 2 | O(1) jump vs stepping loop, all edges | Clean — differential probe: 13/13 matrix cases land identically (exact divisor, n0==end, windowStart<n0, n0 past end/now, crafted-future offlineSince, 10h cap pin, sub-pin admitted 9e15 parks, fractional remainder, cap-edge ±1ms, mid-window, deep-past). cycleMs≤0 diverges *strictly better* (old hung, new exits ≤5000) and is unreachable via the default 30s constructor. FP: for authored cycleMs ≥ 22_000 and ends ≤ 8.64e15, `floor(d/c)` cannot mis-round — a one-step error needs ulp(k) ≥ 2/c, i.e. d ≥ ~9e15, above every reachable end. |
| 3 | slots 0..65536 vs honest callers | Clean — honest ceiling is `1 + 2*chi_hien_quan(9)` = 19 (or 3 under the beta scope-lock); allocator output ≤ floor(capacity). 65536 is a loop-bound constant, never a reachable ceiling. |
| 4 | Validator admission vs mechanism guard | Consistent — strict complement at the same boundary (admits `|x| < 2^53`, mechanism rejects `|x| ≥ 2^53`; 2^53−1 admitted, 2^53 rejected — verified). Sub-pin admitted data parks and re-admits forever *except* the write-ratchet arm (R22-COR-1). |
| 5 | Flipped/pinned tests | Clean — r20Cor (a) flip asserts a real rejection + issue path, plus a sub-bound boundary control that is genuinely admitted; the deny-side pins assert `consumedBudgetMs === 0` which is the guard's real early-return contract; the slots-boundary spec asserts real mechanism output at 0 and 65536. |

## Verification evidence

- `npx vitest run src/services/save src/core/production src/stores` at bf3b44a1: **73 files, 1088 passed / 3 skipped** (matches the adjudication doc's counts).
- New probe: `src/services/save/auditR22Cor.probe.test.ts` — 17/17 pass:
  - `crafted sub-bound stackable expiry admits, then one honest drink wedges the save` — reproduces R22-COR-1 end-to-end through real validator + real `applyTimedEffect` + real `buildGameSave` + real revalidation.
  - 13-case landing/settled differential between a faithful r20 stepping-loop replica and the shipped O(1) jump.
  - cycleMs=0 and cycleMs<0 arms exit bounded (≤5000, documented divergence).

## Findings

### R22-COR-1 — Medium (Confirmed): write-side ratchet escapes the 2^53 admission bound and permanently wedges the save

The r21 batch pinned the **admission** domain `|x| < 2^53` but one writer
**adds to a persisted stamp**, so validator-admitted input can produce
validator-rejected output through a single honest action:

1. **Admit**: forged save carries
   `persistentTimedEffects[0] = { sourceItemId: 'hoi_linh_dan_mortal',
   effectGroup: 'hoi_linh_dan', durationStackable: true,
   appliedAtMs: 1e12, expiresAtMs: 9_007_199_254_700_000 (< 2^53),
   modifiers: [manaRegenPerTurn flat 2] }`. It satisfies every
   authored-shape pin — the pill-regen arm has **no provenance bound on
   expiresAtMs** (the TLT arm has `expires ≤ lastSavedAt + duration + 7d`;
   the pill arm deliberately doesn't, because the stackable refresh
   legitimately widens the span). `validateGameSaveShape` → `ok: true`.
2. **Restore**: `boundTimedEffectClocks` (stores/player.ts:135-143) passes
   a `durationStackable` expiry through verbatim — the record is live
   (forever-buff — the accepted "parked" residual class).
3. **Honest action**: the player re-drinks the same family.
   `applyTimedEffect` (GameManagerPersistentEffectOps.ts:316-318) takes
   the `durationStackable` arm:
   `existing.expiresAtMs = Math.max(Date.now(), existing.expiresAtMs) + duration`
   → `9_007_199_254_760_000 ≥ 2^53`.
4. **Persist**: `buildGameSave` writes it verbatim → the next
   `validateGameSaveShape` rejects `persistentTimedEffects[0].expiresAtMs`
   → save fails shape validation on **every** subsequent boot →
   permanent wedge (recovery = export/delete → save loss).

Why this is not the accepted residual: the r21 adjudication accepted
sub-pin far-future stamps as "deny-direction self-park" — inert data that
re-admits forever. On this arm the parked value is **not inert**: the
honest writer ratchets it over the bound, converting an admitted craft
into a persistent save rejection. The commit's own premise — "no legal
writer can produce |x| ≥ 2^53" — is violated by a legal writer whenever
a parked near-bound stamp is present.

Reachability: requires a crafted save import (same threat-model
precondition as every finding this wave fixed) plus one ordinary in-game
action (drinking the same pill family). Craft window: any
`expiresAtMs ∈ [2^53 − authoredDurationMs, 2^53)` — e.g. 60_000ms wide
for the mortal tier.

Fix direction (adjudicator's call): bound the ratchet, e.g.
`existing.expiresAtMs = Math.min(2**53 - 1, Math.max(...) + duration)`,
or bound the arm at admission for stackable pill effects
(`expiresAtMs ≤ lastSavedAt + duration + allowance`, mirroring the TLT
provenance pin — span is unbounded, absolute expiry is not).

Evidence: `auditR22Cor.probe.test.ts` test 1 (admit → ratchet → persist
→ reject, all real code paths); control test shows the honest sub-bound
shape stays admitted.

### R22-COR-2 — Nit: pkill sweep pattern can still self-match the parent

`fixpointR20Cor.qa.test.ts` finally-block sweeps with
`pkill -f 'fixpointR20CorSlotsHang.probe.test.ts --reporter=dot'`. That
is narrower than the old bare-name pattern, but if a developer runs
`npx vitest run fixpointR20Cor.qa.test.ts fixpointR20CorSlotsHang.probe.test.ts --reporter=dot`
the parent's own cmdline contains the exact pattern and the sweep kills
the parent run. Only fires in that exact invocation shape; directory
runs (`vitest run src/services/save --reporter=dot`) don't embed the
file name. A unique env-var marker file name or matching
`vitest run <probe> --reporter=dot` verbatim would close it fully.

## Gaps / reachability notes

- `allocateWorkerSlots` (WorkerAllocator) loops `index < remaining` over
  an unbounded `floor(capacity)`: a huge crafted capacity would spin
  upstream of the new `slots ≤ 65536` guard. Unreachable from save data —
  `autoWorkerCapacity` is re-derived from the chi_hien_quan building level
  at restore (≤ 19), and the validator rejects capacity > 0 without the
  building. Same caller-authorized class as `budgetMs` (finite-pinned by
  contract, callers authorize). No action.
- Validator vs mechanism domains verified complementary at the exact
  boundary; mechanism also enforces ordering + (for pending lanes)
  non-finite rejection — admitted ⇒ mechanism-safe in every arm except
  R22-COR-1's write side.

## Pre-existing (not introduced by bf3b44a1)

- `productionSites[].hiddenChannelCycles` is `validateNonNegativeIntMap`
  (non-negative int, unbounded). A crafted counter ≥
  `channel.guaranteedAfterCycles` mints one guaranteed hidden-channel
  material on the next eligible grotto settle cycle
  (ProductionSystem.ts:553-579), then resets to 0 — bounded to ~1
  material/channel per forge and strictly weaker than directly forging
  `materials[].amount` (also unbounded `requireNonNegativeNumber`). Same
  accepted self-forge class; recorded for the ledger.
- Sub-pin far-future stamps (e.g. 9e15) remain admitted and park — the
  documented r21 residual; R22-COR-1 is the one arm where parking
  escalates.
- `cycleMs ≤ 0` in DecomposeSystem: old code hung; new code exits bounded
  after ≤5000 completions (grants 5000 empty-bag cycles vs hang) —
  strictly better, unreachable via the default 30s constructor.
