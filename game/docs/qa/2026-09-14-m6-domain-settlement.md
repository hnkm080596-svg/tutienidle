# M6 — Domain-owned tribulation settlement (ARCH-006 second half) — G5 evidence

Date: 2026-09-14. Worker: mission M6. Worktree
`.agent-worktrees/arch-m6-domain-settlement`, branch
`arch/m6-domain-settlement` (fork `1775f441`, on top of M3 + M5).

## G0 task card

```text
TASK CARD
Task / user request: M6 — make tribulation outcome settlement
  domain-owned, terminal, identity-based, idempotent, and independent of
  presentation success (ARCH-006 second half). Permanent consequences
  must commit exactly once even if the curtain close/request is
  rejected, the transition fails, a duplicate tick lands while a request
  is in-flight, or presentation timing is interrupted.
Assigned worktree / branch:
  E:\tutienidle\.agent-worktrees\arch-m6-domain-settlement /
  arch/m6-domain-settlement
Requested observable behavior: App.vue's per-tick
  checkTribulationOutcomeAction(player, gameManager, presentation)
  settles consequences synchronously on the tick; the home transition
  only renders the committed receipt (announcement, panel, drain, scene
  exit) behind the curtain; rejected/failed/in-flight windows leave the
  outcome pending for next-tick retry without re-applying anything.
Single responsibility / invariant: exactly one consequence commit per
  committed outcome, owned by TribulationOutcomeService against a
  domain-owned CommittedTribulationOutcome record stamped by
  TribulationDirector.commitOutcome (unchanged sole terminal writer).
Current owner (defect): useTribulation.checkTribulationOutcomeAction ran
  resolveVictory/resolveDefeat INSIDE behindCurtain — permanent writes
  were gated on curtain/transition success, and re-read mutable live
  state at curtain time.
Target owner: TribulationOutcomeService.settleOutcome (once-only commit
  against director.getCommittedOutcome()); the adapter drops to pure
  receipt rendering.
Existing primitive/mechanism reused: ActiveTribulationState.state
  terminal flag (M5); PresentationSession session id as the attempt
  identity; coordinator's existing rejection/in-flight-share/failed-
  request semantics (M3) — no coordinator change required.
Missing capability: a committed-outcome record keyed to the run's
  attempt identity with a once-only receipt slot.
Production chain: App.vue:468 tick ->
  checkTribulationOutcomeAction -> TribulationOutcomeService.settleOutcome
  (commit) -> coordinator.request({target:'home', behindCurtain:
  consumeReceipt}) (presentation: presentOutcome + director.clear() +
  exitTribulationScene).
State: committedOutcome/attemptId written only by the director
  (commitOutcome stamps, start() resets, clear() drains); receipt bound
  only by the service; presentation reads, never writes.
Expected files and why:
  - src/core/tribulation/TribulationDirector.ts — stamps the record at
    the single commit site; getCommittedOutcome(); clear() drains.
  - src/core/tribulation/TribulationOutcomeService.ts — settleOutcome
    once-only entry; resolve* relaxed to outcome facts.
  - src/composables/useTribulation.ts — settle-before-request migration.
  - src/presentation/GamePresentationCoordinator.ts — owner in scope;
    NO change needed (M3 semantics already provide the contract).
  - src/core/tribulation/TribulationOutcomeSettlement.test.ts — new
    domain once-only/exactness suite (real factory).
  - src/presentation/tribulationRouting.test.ts — curtain-failure /
    rejected-request / in-flight-duplicate regressions + real-terminal
    migration of the live-state mutation scaffolds.
  - docs/qa/2026-09-14-m6-domain-settlement.md — this report.
Explicit non-goals: commitOutcome contract changes (M5 frozen); pacing
  authority moves to rendering; progression scope expansion; save/
  restore schema; unrelated refactors.
Applicable roadmap phase: §0.8a wave 1 M6; R8.2 outcome ownership;
  ARCH-004/M3 session identity; M5 terminal writer.
Tests and gates: P3 quick (type-check + vitest tribulation/presentation/
  composables) per mission; P13/P14 evaluated below.
Stop condition: repro matrix green + required scopes green + type-check.
Unresolved material assumptions: none.
```

## G1 — Q1-Q12 evidence

| ID | Answer — evidence |
|---|---|
| Q1 | Observable: consequences commit on the tick, once, regardless of curtain outcome; pending record survives rejection/failure; retry re-presents the same receipt and drains once. Evidence: TribulationOutcomeSettlement.test.ts (7 tests) + tribulationRouting.test.ts M6 describe (3 tests). |
| Q2 | Owners: `TribulationDirector` owns the committed-outcome record lifecycle (stamp/reset/drain); `TribulationOutcomeService` owns the once-only commit (`settleOutcome`); `useTribulation` owns only presentation sequencing; `GamePresentationCoordinator` retains routing/curtain/deadline ownership (unchanged). |
| Q3 | `committedOutcome`/`attemptId` — writer: director only (`commitOutcome` stamps; `start()` resets; `clear()` drains). `receipt` — bound only by `settleOutcome`. Readers: `getCommittedOutcome()` (service + adapter + tests). No persistence (runs are not saved mid-flight — pre-existing). |
| Q4 | Real chain verified by source: App.vue:468 unchanged 3-arg call (pinned by tests/architecture/tribulationOutcomeWiring.test.ts); GameManagerTickOps.ts:284 director.update; commitOutcome remains private, called at the two M5 terminal sites (director :513 defeat, :567 victory). |
| Q5 | Existing primitive reused: the run's own presentation sessionId is the attempt identity (`attemptId = sessionId` at start() :229) — no new id mint, no ambient session re-query (ARCH-004 safe). The receipt slot on the record is the dedup identity — no separate dedup registry. |
| Q6 | Imports: director gains a TYPE-ONLY import of TribulationOutcomeResult; service gains a TYPE-ONLY import of TribulationDirector — erased at compile, direction still core-internal. No Vue/Pinia/Phaser/presentation imports added to core (coreImportDirection.test.ts PASS). |
| Q7 | Timing (tick), commit (settleOutcome), presentation (curtain consume) separated: consequences commit in the tick before any curtain call; the curtain work is announce/drain/exit only. P17/A7 restored — presentation failure can no longer change or strand gameplay outcome. |
| Q8 | Consumers: App.vue unchanged; consumeReceipt renders the receipt (announcement via i18n keys, standalone panel, director.clear(), exitTribulationScene) in the same order the old applyOutcome did (present -> clear -> exit). No other production caller of resolveVictory/resolveDefeat exists (grep: only the service itself + unit tests). |
| Q9 | `getCommittedOutcome()` is observational — returns the live record; binding `receipt` is the service's single write. `getState()` mutability is retained debt (see below) but no longer drives settlement. |
| Q10 | Duplicate/stale: settleOutcome returns the bound receipt on every later call (loi_kiep stack, cultivation cut, stone removal, debuff, talent conversion all asserted single-application). In-flight duplicate request shares the coordinator's promise via isSameRequest — behindCurtain runs once (close-call count pinned). A new attempt cannot overwrite a pending record: start() refuses while `active` is non-null. |
| Q11 | Old path: `applyOutcome` inside behindCurtain removed — settlement relocated to the synchronous tick; curtain now consumes the receipt. The mutable `active.state` scaffolding in tribulationRouting tests replaced by real terminal drives. |
| Q12 | Scope proof: `git status` — 4 modified (3 production owners + routing test) + 1 new test file + this report. Coordinator intentionally untouched. |

## Triggered domain modules

- **C1** PASS — damage/vitals flow untouched; commitOutcome unchanged (M5 contract kept: same state write, same defeat cooldown, same single `tribulation_outcome` emit — all 7 M5 terminal tests still green).
- **L2** PASS — the terminal outcome is committed by the domain; presentation consumes a bound receipt and can no longer originate, delay, or lose the consequence commit.
- **L4** PASS — duplicate ticks (settle dedup via receipt identity), stale requests (in-flight share), rejected requests (record pending → next-tick retry), and transition failure (pending → retry) all converge; new-run overwrite impossible (start() guard).
- **S (save/restore)** — evaluated: no save schema touched; a mid-run reload discards the whole in-memory run exactly as before (no persistence seam exists for tribulation state — pre-existing). The covered "reload timing" window — consequences already committed at the tick, drain pending — is now safe by construction (commit precedes curtain).
- E/U modules N/A — no economy schema or UI surface changes.

## Behavior before -> after

- Before: `checkTribulationOutcomeAction` wrapped `resolveVictory/resolveDefeat` in `behindCurtain` — the consequence commit ran inside the curtain window. A rejected route request deferred the entire settlement; consequences re-read mutable `active` state at curtain time; a failure between commit and drain had no domain record to resume from.
- After: the tick calls `settleOutcome(player, gameManager, director)`: the director's `CommittedTribulationOutcome` (stamped once by commitOutcome with `attemptId` = the run's sessionId, `outcome`, `targetRealmId`, `grade`, `receipt: null`) is resolved once; `receipt` binds and every later call returns it unchanged. The `{target:'home', behindCurtain: consumeReceipt}` request only announces + drains (`director.clear()` ends the session) + exits the scene. Rejection leaves the record pending; next tick re-issues the same receipt — once-only by receipt identity, retry-safe by record persistence.

## Files changed -> purpose

| File | Purpose |
|---|---|
| `src/core/tribulation/TribulationDirector.ts` | `CommittedTribulationOutcome` interface; `committedOutcome`/`attemptId` fields; stamp at the single commitOutcome site; `getCommittedOutcome()`; `clear()` drains; `start()` resets + binds attemptId to the allocated session id. |
| `src/core/tribulation/TribulationOutcomeService.ts` | New `settleOutcome(player, gameManager, director)` once-only entry; `TribulationOutcomeFacts` contract (`targetRealmId`, `grade`); `resolveVictory`/`resolveDefeat` relaxed from `ActiveTribulationState` to facts — exact consequence behavior unchanged. |
| `src/composables/useTribulation.ts` | `checkTribulationOutcomeAction` settles synchronously via `settleOutcome`, then issues the home request with `consumeReceipt` (presentOutcome + clear + scene exit) — zero player-state writes in the adapter. |
| `src/presentation/GamePresentationCoordinator.ts` | Owner in scope, NO change — M3's rejection/in-flight-share/failed-request contract is exactly what the retry semantics consume; verified by the new tests. |
| `src/core/tribulation/TribulationOutcomeSettlement.test.ts` | NEW — 7 real-factory tests: record identity/lifecycle, bypassed-commit produces nothing, once-only victory/defeat/Great Dao exactness, per-attempt receipt isolation. |
| `src/presentation/tribulationRouting.test.ts` | Two scaffold tests migrated from `active.state = 'victory'` mutation to real terminal drives; NEW describe (3 tests): rejected-while-entry-in-flight retry, duplicate in-flight tick dedup, curtain-close-failure pending+retry — all through the real coordinator with a deferred curtain. |

## New-regression spec (G2)

```text
Invariant / module ID: exactly-once domain settlement, presentation-
  independent (Q1/Q7/Q10, L2/L4, P17/A7).
Production input: real GameManager + authored chapters + real
  coordinator/PhaserSceneAdapter/CompositeRenderer/AssetBundleManager
  with a deferred/failable curtain.
Action: drive runs to real terminals; issue checkTribulationOutcomeAction
  while the entry transition is in-flight (rejection), while the home
  request is in-flight (dedup), and under a rejecting curtain (failure);
  retry on the next tick.
Expected: consequences land at settle time (realm/cultivation/foundation/
  talent/stones/debuff/Great Dao lock — exact values asserted); receipt
  identity stable; record pending until the successful curtain drains;
  announcement rendered exactly once; route ends at 'home'; director
  cleared exactly once.
Why the old path fails: settlement inside behindCurtain meant a rejected
  request skipped the commit entirely (deferred to an uncertain retry)
  and consequences were re-derived from mutable live state; no domain
  record existed to resume a mid-flight interruption.
Observed red -> green: new suites written against the new contract; the
  two migrated routing tests prove the old mutation scaffold can no
  longer drive settlement (a mutated live state yields NO committed
  outcome — asserted).
```

## Verification (P3 quick — actual commands)

| Command | Result |
|---|---|
| `npm run type-check` (vue-tsc --build) | exit 0 |
| `npx vitest run src/core/tribulation src/presentation src/composables` | 52 files / 335 tests PASS |
| `npx vitest run tests/architecture` | 29 files / 116 tests PASS (coreImportDirection, tribulationOutcomeWiring, progressionOutcomeOwnership included) |
| `npx eslint` on the 5 touched files | 0 errors; `no-explicit-any` warnings are the file's established test-mock `as any` convention (13 warnings, none new in kind) |

## QA (P4) / code-review (P5)

- P4-equivalent adversarial pass (no QA agent dispatch available to this
  worker — coordinator may re-run `tutienidle-adversarial-qa` at merge).
  Probed: (a) rejected request while entry in-flight → pending, settle
  already committed, retry drains once; (b) duplicate tick in-flight →
  isSameRequest shares the promise, close invoked once, receipt
  identical; (c) curtain close failure → consequences committed, run NOT
  drained, next tick re-requests and drains once (no re-cut cultivation,
  no second debuff, announcement once); (d) post-drain check →
  settleOutcome returns null → false, no request; (e) mutated live state
  without commitOutcome → no record → nothing to settle (the old
  scaffold's bypass now provably inert); (f) second attempt → fresh
  attemptId + unsettled record, first receipt cannot leak; (g) start()
  refuses while a terminal run is pending — records can't be
  overwritten; (h) failure AFTER behindCurtain ran (e.g. prepare
  timeout) → run already drained, tick issues no further request, error
  shell's Back button is the pre-existing escape; (i) `retry()` on a
  failed outcome request correctly rejects (behindCurtain present) —
  retry authority stays with the tick, matching the pending-record
  design. Verdict: PASS WITH EVIDENCE (self-review).
- P5 code review (self): no production `any`; comments English ASCII
  (P15); no new i18n strings (P16); type-only cross-imports between
  director and service are compile-erased; `resolveVictory`/`resolveDefeat`
  remain public as the granular primitives the once-only entry delegates
  to (existing unit tests call them directly — narrowing visibility
  would break them without ownership gain). No findings >=80.
- P13: App.vue call site unchanged (same 3-arg signature, same tick
  position); the wiring guard test passes; runtime behavior verified via
  the real-coordinator tests (the closest headless proxy to the App.vue
  tick loop). The dev-server/E2E drive is deferred — see below.
- P14: deferred per the isolated-worktree exception (`.agent-worktrees/**`
  browser launch is unreliable); the changed seam is headless-domain +
  coordinator-level and covered by the real-coordinator suite. Recommend
  the live-browser tribulation run be confirmed from an authorized
  checkout during branch finishing.

## Review round 1 — Important finding fixed

**Finding (Important):** `settleOutcome` bound `committed.receipt` only
AFTER `resolveVictory`/`resolveDefeat` returned. A mid-apply throw left
the receipt unbound, so every subsequent tick re-ran the full apply —
`tribulationBonusStacks += 1` per retry, cultivation re-cut compounding,
stones re-removed, debuff re-applied. The exception also propagated out
of `checkTribulationOutcomeAction` into `tick()` — an uncaught per-second
exception that skips `bumpState()`, a containment regression vs the old
coordinator try/catch which surfaced a 'failed' transition + error card.

**Fix (implemented shape):**

- `CommittedTribulationOutcome` gains `settlementError: Error | null`
  (TribulationDirector.ts) — a terminal-failure marker initialized at the
  commit stamp.
- `settleOutcome` wraps the resolve in try/catch
  (TribulationOutcomeService.ts): on throw it stores the normalized Error
  on the record, logs once via `console.error`, and returns null. Later
  calls short-circuit on the marker — the apply never re-runs, so
  partially-landed consequences cannot compound. The method can no
  longer throw.
- `checkTribulationOutcomeAction` (useTribulation.ts) fetches the record
  first; a null result with `committed.settlementError` set takes a
  drain-failed-run path: `presentSettlementError()` announces the failure
  (new i18n keys `announce.tribulation.settlementError.title/body` in
  en.json + vi.json — parity guard passes), `director.clear()` drains,
  `exitTribulationScene()` runs — all inside the curtain with the same
  pending/rejected/in-flight retry semantics as the receipt path, so a
  failed settle can never soft-lock the tribulation scene.

**Regression tests added (3):**

- Domain: throwing defeat resolve (`applyPersistentBuff` injected) —
  cultivation cut and stone removal land exactly once across the throwing
  settle and the follow-up tick; `settlementError` recorded; no re-apply.
- Domain: throwing victory resolve (`unequipAllEquipment` injected) —
  loi_kiep stack + realm write land exactly once; retry converges.
- Coordinator: `checkTribulationOutcomeAction` under an injected debuff
  throw — `expect(...).not.toThrow()` (nothing escapes into the tick),
  record marked failed, drain-home transition completes once, failure
  announcement shown once, debuff write attempted exactly once.

**Post-fix verification:** `npm run type-check` exit 0;
`npx vitest run src/core/tribulation src/presentation src/composables`
52 files / 338 tests PASS (was 335); `i18nKeyParity` 10/10 PASS; eslint
0 errors on touched files.

## Unresolved task work / retained debt

- `getState()` still returns the mutable live `ActiveTribulationState`
  (pre-existing). Settlement no longer depends on it — the new suite
  pins that a mutated live state yields no committed outcome — but a
  future mission may still want a read-only snapshot or factory seam.
- `resolveVictory`/`resolveDefeat` stay public (unit-tested primitives);
  a caller COULD bypass `settleOutcome`'s dedup by invoking them
  directly — no production caller does. Optional hardening: package-
  private visibility once the unit tests migrate to settleOutcome.
- Mid-run reload discards the whole tribulation run (no persistence
  seam — pre-existing, unchanged). The committed record is in-memory by
  design; consequences already committed at settle time are persisted
  with the player as usual.
- A failure AFTER `consumeReceipt` ran (post-curtain prepare timeout)
  leaves the run drained and the route at 'tribulation' under the error
  card — the Back button issues a plain `{target:'home'}` request
  (pre-existing escape hatch). Consequences remain exactly-once.
- Known pre-existing suite failures outside this scope (from mission
  context): 4 `perfectClear` assertions in combat/auto-farm specs — this
  diff touches no combat code; verified scope `src/core/tribulation
  src/presentation src/composables` is fully green (335/335).
- `tribulation_outcome` remains producer-only (no production event
  subscriber — App.vue polls via the tick) — unchanged, documented in
  the audit.
