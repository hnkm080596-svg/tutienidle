# QA Review: P7-M6 technique-gated node prerequisites (mirror + evaluator)

- Date: 2026-09-22
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `src/core/progression/ProgressionNode.ts` (two new prerequisite union variants)
  - `src/core/progression/NodeSystem.ts` (evaluator branches)
  - `src/core/player/Player.ts` (optional `techniqueProgress` mirror + declared default)
  - `src/core/technique/TechniqueSystem.ts` (progress sink + `restore()` seam)
  - `src/core/game/GameManager.ts` (sink wiring to `activePlayer`)
  - `src/core/game/GameManagerSaveRestore.ts` (dep swap to `techniqueSystem`)
  - `src/core/simulation/BattleSimulation.ts` (bind-then-restore ordering)
  - `src/components/panels/skill-path/NodeInspector.vue` (two lock reasons)
  - `src/services/save/saveShapeValidation.ts` (optional mirror shape check)
  - `src/locales/en.json`, `src/locales/vi.json` (lock-reason strings)
  - tests: `NodeSystem.test.ts`, `TechniqueSystem.test.ts`, `GameManager.techniqueProgress.test.ts`, `GameManagerSaveRestore.boundary.test.ts`, `BattleSimulation.test.ts`, `NodeInspector.test.ts`, `saveShapeValidation.test.ts`, `SaveSystem.conformance.test.ts`, `GameManager.deadIds.test.ts`
  - docs: `docs/p7/missions/m6-technique-gated-nodes.spec.md`, `.plan.md`

## Scope and Risk Map

`changed-risk-map.mjs` mapped the diff to economy-and-progression, save-and-cloud, pinia-phaser-sync, ui-input-lifecycle (plus combat/time domains transitively) and returned `deepAuditCandidate: true` with 5 unmapped paths (`GameManagerSaveRestore.ts`, `Player.ts`, `BattleSimulation.ts`, locales).

**Escalation decision — quick retained, bounded-risk rationale:** the change is additive and derived-only. No persisted authority moved: the canonical holder contract (v70) is unchanged; `techniqueProgress` is a one-way mirror republished from the holder at every mutation seam and on every restore. The restore seam change is `manager.restore` -> `system.restore` = the same call plus a publish. The evaluator additions are fail-closed reads. Locales are pure additions. `time-and-offline` was flagged only transitively — no clock or offline-accrual path is touched. Every unmapped path was inspected in current code and routed manually. No material economy/progression transaction, recovery-semantics, or Vue/Pinia/Phaser lifecycle risk exceeds the quick boundary; each high-risk hypothesis received a conclusive oracle (unit/integration + live runtime).

One-hop consumers inspected: `hasPrerequisite` callers (`canPurchaseNode`, `revealWhen`, `NodeInspector.lockedReasons`, `NodeTreePanel` `kind==='node'` filters — all non-exhaustive), `restoreGameSession` ordering (store REPLACE -> `setActivePlayer` -> saveOps restore), `techniqueSystem.restore` callers (saveOps :302, `BattleSimulation` :149), `manager.setActive` callers (test fixtures only), `createDefaultPlayer()` restore-whitelist contract, autosave/`buildGameSave` serialization of `undefined`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-M6-1 | progress sink / `GameManager` closure | `setActivePlayer` re-binds after wiring | Synchronization: sink must write the CURRENT player, not a captured stale object | Reorder | mirror lands on rebound player | unit (`GameManager.techniqueProgress.test.ts` playerA->playerB rebind) | High: stale sink = gates dead forever | RESOLVED — sink reads `this.activePlayer` at call time (GameManager.ts:487-491); rebind case green |
| INV-M6-2 | persisted mirror / SaveSystem | restore save with forged `techniqueProgress` | Recoverability: canonical holder republishes over drift | Value mutation | persisted save after autosave shows holder-derived pair | live runtime (P13/P14) | High: forged gate-bypass must self-correct | RESOLVED — staged `{rank:99,grade:9}` + `sword_control_art@4/1` -> persisted `{rank:4,grade:1}` after restore + autosave cycle |
| INV-M6-3 | mirror absent / `NodeSystem` | evaluate technique prereq with no mirror | Boundedness/fail-closed: missing mirror never unlocks | Value mutation | `hasPrerequisite` returns false | unit | High: gate must not pass on undefined | RESOLVED — both kinds return false |
| INV-M6-4 | canonical writer / `TechniqueSystem` | any `rank`/`grade` mutation path | Synchronization: every mutation seam publishes | Cross-system chain | grep census + tests per seam (grant/rank-up/grade-advance/restore) | unit + static | High: an unpublished seam = silent stale mirror | RESOLVED — all four seams publish; mastery-only deltas correctly skip (pair unchanged); `setTechniqueQuality` untouched (not mirrored); `manager.setActive` callers are test fixtures only |
| INV-M6-5 | lock reasons / `NodeInspector` | locked node shows technique-gate text | UI correctness: dedicated reasons for both kinds | Stale state | rendered reason strings via mounted component | component (real i18n) | Medium | RESOLVED — rank + grade render dedicated keys; en/vi parity |
| INV-M6-6 | save shape / `saveShapeValidation` | malformed mirror values | Recoverability: structural rejection before restore | Value mutation | issues per class: non-object, missing key, negative, non-integer, non-finite | unit | High | RESOLVED — all classes reject; missing/valid accept |
| INV-M6-7 | sim ordering / `BattleSimulation` | postRitual `purchase_node` vs technique restore | Ordering: mirror must exist before evaluation | Reorder | captured player carries mirror in sim | unit | High | RESOLVED — `setActivePlayer` precedes `techniqueSystem.restore` (:149); test captures the bound player |
| INV-M6-8 | purchase path / `NodeSystem` | `canPurchaseNode` with technique gates | Exactly-once/atomicity: purchase respects gates | Value mutation | false at boundary, true inside | unit | Medium | RESOLVED — shares `hasPrerequisite` |
| INV-M6-9 | undefined default / JSON | serialize player with no technique | Boundedness: `undefined` field must not persist as phantom data | Value mutation | raw save has no `techniqueProgress` key | live runtime | Medium | RESOLVED — leg-1 save omits the key entirely |
| INV-M6-10 | `kind` consumers / union extension | new variants vs existing readers | Compatibility: no exhaustive-switch breakage | Cross-system chain | census of every `prerequisite.kind` reader | static | Medium | RESOLVED — all consumers are non-exhaustive if/else chains or `.filter` predicates; `revealWhen` routes through the same `hasPrerequisite` |
| INV-M6-11 | restore-before-bind / callers | `techniqueSystem.restore` without an active player | Synchronization: publish no-ops safely when unbound | Reorder | sink `if (!this.activePlayer) return` | unit + static | Medium | RESOLVED — both production callers (saveOps :302 post-bind, sim :149 post-bind) order correctly; unbound publish is a safe no-op |
| INV-M6-12 | transient forged window / `restoreFromSave` | forged mirror lands at REPLACE before republish at :302 | Atomicity: nothing may evaluate the mirror mid-restore | Timing boundary | code order between preflight and :302 | static | Medium | RESOLVED — preflight + template-refresh only; no `hasPrerequisite` evaluation occurs inside restore (node levels restore verbatim; purchase gating is a post-restore concern) |
| INV-M6-13 | empty-holder restore / sink | `restore([])` on a player that had a mirror | Monotonicity: mirror must clear with the holder | Repeat | `techniqueProgress` becomes `undefined`, not stale | unit | Medium | RESOLVED — `publishProgress()` fires `null`; sink writes `progress ?? undefined` restoring the declared default |
| INV-M6-14 | throw mid-restore / holder | `manager.restore` throws | Atomicity: holder+mirror stay a consistent pair | Interruption | publish skipped; both remain pre-restore values | static + unit (preflight precedes mutation) | Medium | RESOLVED — preflight rejects before owner mutation; a `structuredClone` throw leaves holder AND mirror at the same prior state |
| INV-M6-15 | version/migration policy / save boundary | old-version save carrying the field | Recoverability: version rejection precedes field reads | Stale state | `version !== CURRENT` rejected first | unit (saveVersion tests) | Low | RESOLVED — existing gate unchanged |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (type-check + build + full vitest) | 716 files / 6327 tests pass, 5 expected-fail | Full P3 surface; earlier `sessionHandoff` flake passed on standalone + rerun |
| Live runtime leg 1 (fresh guest creation) | save v72, `techs:[]`, no `techniqueProgress` key | Playwright script against worktree dev server :5879 |
| Live runtime leg 2 (staged sword save, forged mirror) | persisted save republished to `{rank:4,grade:1}` from `sword_control_art@4/1` | direct localStorage read after 15s autosave cycle |
| Live runtime leg 2b (unplanned: `grade:2` on qi_refining) | app rejected the save fail-closed at login ("Trở về đăng nhập" only) | live proof the v70 holder contract rejects out-of-ceiling technique state |
| Console error census across all legs | 0 errors | errors[] collected via page console/pageerror hooks |
| Production-bypass census (`manager.setActive`/`manager.restore`) | only test fixtures + `TechniqueSystem` internals | grep over `src/` |
| `kind` consumer census | no exhaustive switches; `revealWhen` shares `hasPrerequisite` | grep + NodeSystem.ts:167 |

## Findings

None. No `Confirmed`, `Suspected`, or `Coverage gap` items remain.

## New or Changed QA Tests

None added by this QA pass — every hypothesis resolved to existing task-owned test coverage or live runtime evidence.

## Gaps and Residual Risk

- `sessionHandoff.test.ts` flaked once inside the full suite (expected `victory`, got `defeat`), passed standalone and in the rerun — pre-existing suite-timing interaction, not M6-owned. Retained as `Flaky` evidence, already tracked as a known pattern.
- QA-2026-09-21-M4-F1 (talent-passive restore wipe) is a confirmed pre-existing defect outside M6 scope, pinned by `SaveSystem.talentPassiveRestore.qa.test.ts` (`it.fails`).

## Pre-existing Failures

- `SaveSystem.talentPassiveRestore.qa.test.ts` (`it.fails`) — expected-fail reproduction of QA-2026-09-21-M4-F1, unrelated to this diff.
