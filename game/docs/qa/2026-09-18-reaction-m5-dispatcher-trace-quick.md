# Quick Adversarial QA — Reaction M5 (dispatcher + trace + determinism)

- **Scope**: `ReactionDispatcher` (deferred immediate handler),
  `ReactionTrace` (§85 formatter + §60 comparator + digest),
  `ReactionSystem` trace recording (incl. `no_candidates` trace),
  `resolutionToBatch`/`isConsumedParticipantRole` shared helpers,
  `settleBatch` fixture driver, docs updates.
- **Mode**: quick — no live-path production change (engine remains
  inert + unwired; the live turn-selection path was deep-QA'd in M4).
- **Date**: 2026-09-18. **Branch**: `feat/reaction-core`.

## Verification

| Command | Result |
|---|---|
| `npx vitest run src/core/reaction src/core/battle src/core/buff2` | 127 files / 1047 passed — PASS |
| `vue-tsc --build` | clean — PASS |

## Invariant ledger

- **`boardQuery.read` returns a fresh snapshot** — `trace.board` cannot
  drift post-evaluation (verified at `ReactionBoard.ts:34-46`).
- **Resolved-event ordering** — the dispatcher emits
  `reaction_resolved` at dispatch; the scheduler drains handler-emitted
  events AFTER the returned settlement, so consumers observe
  post-commit ordering identical to the headless runner's post-commit
  emission. Eager emission is forced: the production batch frame emits
  no reaction-specific events. A stale preflight abort is impossible
  inside the synchronous frame (nothing mutates between evaluate and
  the batch's own ops) — documented in the dispatcher header.
- **`reaction_skipped` stays batch-lane** — emitted only by the
  headless runner post-preflight (its `reason` union is
  `'stale_reaction_snapshot'` only, which the dispatcher cannot
  foresee); production records the skip in the combat trace — the
  wiring mission decides whether the gameplay event also surfaces.
- **Single batch shape** — `resolutionToBatch` is shared by the
  headless runner and the dispatcher's default `batchFactory`; both
  lanes produce identical `rxbatch.<eventId>.<reactionId>` batches.
- **Exactly-once** — the dispatcher is stateless; double-invoke yields
  an equivalent settlement (test-pinned). Event dedup is
  scheduler-owned (it never delivers the same event twice).
- **Gate double-check is pure/idempotent** — the dispatcher's
  fast-path `gate.check` precedes the system's internal authoritative
  check; no state consumed.
- **Determinism** — no new RNG; `compareReactionTraces` orders by
  seq→source→target→reactionId; `reactionTraceDigest` is a pure
  string projection; seeded 200-application runs produce identical
  digests + boards (test-pinned, incl. a different-seed divergence
  sanity check).
- **`settleBatch` is fixture-only** — mirrors the production frame
  (validate → preflight → ordered ops → deferred materialize →
  executor) over the same stub ports; production code untouched.
- **Sequential settle** — a settled reaction batch mutates the board
  before the next application evaluates (test pins post-consume fire
  stacks = 3, not pre-reaction 2; evaluate calls interleave strictly
  between applications — no batched end-of-cast scan).

## Findings

None Critical/High/Medium.

- **[Nit] Eager `reaction_resolved` emission is an architectural
  consequence**, not a choice — if a future scheduler interleaved work
  between handler-return and batch-run, the event could precede a skip.
  The contract guarantees non-interleave (sec.43); the invariant is
  documented on the dispatcher.
- **[Nit] `runSeededSequence` leans on `boards` deep-equality** for
  final-state comparison — adequate for the 200-application matrix;
  instance ids are minted by a deterministic counter so deep-equality
  is meaningful.

## Verdict

**PASS WITH EVIDENCE** — quick audit complete: invariants verified by
inspection + pinned tests; 1047 tests green across reaction/battle/buff2
scopes; type-check clean; engine remains production-inert and unwired.
