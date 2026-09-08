# QA Review: R8.1 Quest Activation Lifecycle

- Date: 2026-09-08
- Mode: quick (with documented non-escalation: mapper flagged `deepAuditCandidate: true` via time-and-offline + 4 domains, but this mission adds NO save schema change, NO offline accrual change, and NO daily-reset ownership change — it only moves quest activation from a UI read to lifecycle commands. All risk is bound at unit/integration layers below.)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/quest/QuestSystem.ts` (reconcileActiveQuests + pure getActiveQuests)
  - `game/src/core/game/GameManager.ts` (reconcileQuestLifecycle, markQuestRealmTransition, tick wiring, realm writer hook)
  - `game/src/core/game/GameManagerSaveRestore.ts` (post-restore reconcile)
  - `game/src/composables/useTribulation.ts` (realm-transition command)
  - migrated tests: `QuestSystem.test.ts`, `GameManager.overflowSurfacing.test.ts`

## Scope and Risk Map

Changed systems: quest activation lifecycle (query side effect removed; lifecycle command added at boot/restore/daily-realm triggers). One-hop consumers inspected: QuestPanel read (unchanged shape), BattleLootSystem kill hook, GameManager collect hook, daily reset tick, restore path, realm transition writers (GameManager minor advance + Vue tribulation).

Exclusions: none. `unmappedPaths` (useTribulation.ts, GameManagerSaveRestore.ts) manually routed: tribulation = combat-and-tribulation pack (command-only change, no outcome logic touched); SaveRestore = save-and-cloud pack (reconcile call only, no schema change).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-R81-1 | QuestSystem query | getActiveQuests x2 | Purity: reads never activate/mutate | Repeat | state snapshot equal | unit | High |
| INV-R81-2 | QuestManager active set | reconcile twice | Idempotency: no duplicate entries, no progress reset | Repeat | active ids unique + progress kept | unit | High |
| INV-R81-3 | Event hooks (kill/collect) | kill before/after activation | No retroactive credit; counts after activation only | Reorder | progress value | unit | High |
| INV-R81-4 | Daily rollover | reset then reconcile | Board rebuilt (v1: zero progress), kills count without UI | Timing boundary | progress after kill | unit+integration | High |
| INV-R81-5 | Restore boundary | restoreFromSave (fresh boot) | Synchronization: restored progress preserved; completedOnce stays dead; eligibility converges | Stale state / Repeat | progress values + active set | integration | Critical |
| INV-R81-6 | Realm transition | realmId change + flag + tick | Newly unlocked quests activate without UI | Cross-system chain | progress defined for gated ids | integration | High |
| INV-R81-7 | Single activation path | grep ensureActive callers | One owner: reconcile is the only production activation | Static | call-site inventory | grep | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx.cmd vitest run` (full suite) | 423 files / 2904 tests PASS | includes 19 new/updated quest tests |
| `npm.cmd run type-check` | PASS | vue-tsc --build |
| `npx.cmd vitest run src/core/game/GameManager.r81qa.test.ts` | 4/4 PASS | restore-boundary adversarial matrix |
| grep `ensureActive\(` | only QuestManager def, QuestSystem.reconcile, 1 intentional test fixture | single activation path evidence |
| `npm.cmd run build` | Not run this mode | quick mode; full build verified in R7 mission on adjacent shared code — run at integration if required |
| Playwright browser (P14) | Deferred - user waived live-browser pass (2026-09-08 integration session) | app booted clean on main checkout during integration (0 console errors); quest panel consumes the unchanged read shape - jsdom component tests cover the panel |

## Findings

None confirmed. No failing reproduction test; all adversarial boundary tests pass.

### Suspected / coverage notes (no defect)

- The Vue tribulation realm writer now calls `markQuestRealmTransition()` (command). Until R8.2 moves outcome logic into the domain, a hypothetical realm change that bypasses BOTH known writers would delay quest unlock to the next daily-reset reconcile — bounded staleness, not a correctness break.
- `getActiveQuests` retains its `player` parameter for interface stability even though the pure read no longer needs it; harmless, noted for a future signature cleanup (out of scope).

## New or Changed QA Tests

- `game/src/core/game/GameManager.r81qa.test.ts` — restore-boundary matrix: progress preservation, completedOnce permanence, stale-day rebuild through the reset tick, idempotent multi-reconcile.
- `game/src/core/game/GameManager.questLifecycle.test.ts` — real-manager wiring: unopened-UI kill counting, daily rollover rebuild, restore reconcile, realm-transition unlock.
- `game/src/core/quest/QuestSystem.lifecycle.test.ts` — domain command semantics incl. purity guard.

## Gaps and Residual Risk

- P14 browser check deferred (isolated-worktree exception) — the QuestPanel consumes the same read shape, so visual risk is minimal, but a main-checkout pass remains required at integration.
- E2E quest-flow spec (kill → count → claim with panel closed throughout) would harden the wiring against future regressions; the current Vitest integration tests cover the same chain headlessly.

## Pre-existing Failures

None observed (full suite green at audit time).
