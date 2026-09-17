# D/E/F Audit-Repair Round — Quick QA (2026-09-19)

Scope: remediation of the user's three-mission re-review against master `b4c3f914`
(Mission D `bfaa9dc6`, Mission E `66fd042b`, Mission F `f2fbd363`). Findings
fixed in the user's prescribed order: D1 -> D2 -> E1+E2 -> P15 sweep + guard;
D3 and F2 also repaired inside the same boundaries. Worktree:
`.agent-worktrees/mission-def-audit`.

## Task-owned production diff (semantic changes only)

| Finding | File(s) | Change |
|---|---|---|
| D1 | `ProductionSystem.tickWorkers`, `ProductionOffline.settleWorkersOffline` | Removed the `capacity <= 0` early return. Advanceable set = `autoRestart \|\| workerCycles.length > 0`; retained lanes advance/settle, slot allocation still gates new spawns. |
| D2 | `ProductionSystem.getState/getAllStates`, new `setWorkerAssignment`, `GameManagerBuildingOps.assignWorkers` | Queries return detached snapshots (deep `workerCycles` copy); the sole write consumer migrated to the domain command. |
| E1+E2 | `TribulationDirector` | Shared `snapshotActiveState()` (copies `currentQuestion` + `answers`); `getState()` no longer writes `this.active.hp`. |
| D3 | `WorkerCapacity`, `WorkforceView` | New `sanitizeWorkerPoolInputs()` owns total/reserved normalization; both consumers share it. |
| F2 | `SaveSystem.inspectLocalSave` (new), `SupabaseRemoteSave` | Pure inspection split from consuming `loadGame()`; remote newest-wins preflight no longer eats the import-handoff marker. |
| P15 | ~90 files | Blame-scoped D/E/F-authored lines only: `—`/`→`/`…` normalized, Vietnamese comment blocks translated; strings/UI/aria untouched. New ratchet guard `tests/architecture/asciiComments.test.ts` + baseline + `tribulationQueryPurity.test.ts` source guard. |

Excluded: 4 scratch scripts (deleted); baseline JSON (generated artifact,
intentional).

## Evidence gate

- **D1 red->green**: online retained lane settles once at capacity 0 with no
  respawn; offline identical; non-autoRestart sites settle once without
  respawn. Three legacy tests encoding the freeze semantics updated to the
  INV-D-03 contract.
- **D2 red->green**: `setWorkerAssignment` clamps `[0, capacity]`, handles
  `undefined` (AUTO) and unknown siteId (returns false); mutation through
  `getState()`/`getAllStates()` results no longer reaches the domain.
  One legacy test (`rollSeed` poke through the leaked reference) migrated to
  the snapshot API — `rollRewards` is seed-pure so the copy predicts the grant.
- **E1/E2 red->green**: `getPresentationSnapshot` returns an independent
  object graph; nested `currentQuestion.answers` mutation does not corrupt
  domain state; `getState()`/`getPresentationSnapshot()` are independent.
- **F2 red->green**: `inspectLocalSave()` preserves the handoff marker and
  returns identical status classifications; `loadGame()` still consumes it
  and reports `discardedEquipmentCount`.
- **P15**: guard green on the 963-file / 11,104-violation legacy baseline;
  injected violation fails the test (ratchet verified live).
- **Full verify**: type-check + build + 627 files / 5,248 tests green; 4
  expected-fail. Three timeouts (`dongFuBackgroundAssets`, `InventorySort`,
  `eslintCoreSeverity`) pass isolated in 2.7s/0.4s/4.8s — documented
  parallel-load environment flakes, not regressions.

## One-hop consumer inspection

- `SaveSystem` serializes production via `getAllStates().map(...) ->
  detachSaveValue` — already a projection; upstream detachment is strictly
  safer. Save round-trip tests assert `assignedWorkers` restore.
- `getTribulationPresentationSnapshot` has no write-back consumer
  (CombatScene uses the combat variant; tribulation path is read-only).
- `GameManagerBuildingOps.assignWorkers` keeps its legacy no-op-on-unknown
  semantics through the command's `false` return; capacity bound unchanged.
- Non-autoRestart settle-once uses the same `advanceWorkerLanes` slots=0
  path — lane completes at its own deadline, `workerCycles` empties, no
  respawn (top-up-then-settle order preserved).

## Deep-escalation assessment (mapper: `deepAuditCandidate`)

Not escalated — bounded rationale: every change is boundary-NARROWING
(more detached, more pure, single-owner), not new semantics. The save/cloud
delta removes an unintended consumption rather than adding behavior; the
classification surface is pinned identical by parity tests. The economy
delta restores the authored INV-D-03 contract with dedicated online/offline
coverage. Cross-system breadth is real but each fix is independent,
contract-restoring, and regression-pinned.

## Invariant ledger exercised

1. INV-D-03 retained lanes complete once then die — pinned online + offline.
2. One writer per mutable state — `assignedWorkers` now has exactly one.
3. Queries are observational — tribulation + production read surfaces detach.
4. Pure inspect vs consuming load — handoff marker has exactly one consumer.
5. P15 executable — ratchet guard + blame-scoped sweep, zero new violations.

## Round 2 addendum - D4 (re-review of dc4d8b50)

The re-review found one residual Medium: `getSiteView()` still called
`ensureSiteState()` (a query that materializes domain state) and returned
the live record in `view.state`, forwarded by
`GameManagerBuildingOps.getProductionViews()` to Vue.

Fix: the query now reads `this.states.get(siteId)`; an absent site
projects the identical level-1 idle default `ensureSiteState` would
create, and the view always carries `this.snapshotState(state)`.
`ensureSiteState` stays for its command callers (restore reconcile,
setAutoRestart).

Evidence: red->green regression in ProductionSystem.workers.test.ts -
the pre-fix query materialized the site AND the mutated `view.state`
leaked into the domain (both halves failed in one assertion). Scoped
re-run: 523 tests across production + save + boundary green - no caller
relied on the create-on-read side effect. Save footprint is unaffected:
the restore reconcile (`GameManagerSaveRestore` L391) ensures every
defined site on load regardless, and `tickWorkers` treats an absent
state identically to an empty one.

Residual (Nit): `ensureSiteState` still returns the live record -
commands returning domain refs is the existing seed convention; only
query surfaces were in scope.

## Residuals (documented, not blocking)

- **E3 (Low, pre-existing)**: triple HP representation in TribulationDirector
  (`ghost.currentHp`/`snapshotHp`/`active.hp`) remains — deferred rework,
  unchanged by this round.
- **Vue template comment scan** uses regex (not a parser); a template string
  containing a literal `<!--` sequence could false-positive. Legacy baseline
  tolerates existing instances.
- `methodBody` guard requires the opening brace on the declaration line —
  fails loudly (not silently) under Allman style.

Verdict: **PASS WITH EVIDENCE**
