# QA Review: Task 9.2 — restoreFromSave payload-identity idempotency guard (QA-002)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/stores/player.ts`, `game/src/stores/player.restoreFromSave.test.ts`

## Scope and Risk Map

Changed systems: Pinia player store (`restoreFromSave` action) — added a payload-identity guard (module-level `WeakMap` keyed by store instance, same pattern as the proven `lastExternalModifiers` snapshot at player.ts:55). Mapper output: `domains: ["pinia-phaser-sync"]`, `deepAuditCandidate: false`, `unmappedPaths: []`. Domain pack loaded: pinia-phaser-sync; save-and-cloud also loaded because the changed action is a save-restore seam (manual routing).

One-hop consumers inspected in current code:

1. `SaveSystem.restoreGameSession` (SaveSystem.ts:447-470) — calls `player.restoreFromSave(save)` exactly once; `SaveSystem.bootRestore.test.ts` spy asserts single-call/non-mutation on rejection → guard inside the body cannot affect it (verified: suite green).
2. `App.vue` bootGame (App.vue:419-456) — one restore per boot via `onAuthenticated`/`onCharacterCreated`; uses `offline` only for the >60s summary modal. A hypothetically repeated boot with the same save now becomes a no-op (correct QA-002 semantics).
3. `player.load()` (player.ts:305-313) — single `restoreFromSave` call.
4. New-game/reset path — NO `reset()`/new-game action exists in the player store (grep verified). New game = `deleteSave()` + `window.location.reload()` (App.vue:250, SaveIncompatibleScreen.vue:38-40) → page reload creates a fresh pinia → guard state is naturally fresh. No reset hook needed; nothing to clear.

Exclusions: untracked docs (`game/docs/superpowers/plans/…`, `specs/…`, prior QA report) — not task-owned, untouched.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-REST-1 | PlayerData in Pinia player store | `restoreFromSave(save)` called twice with the SAME payload (repeat operator) | Idempotency — offline cultivation credited exactly once; second call is a no-op returning the same OfflineResult | Repeat: same save object, second call after time advances | `second.cultivation === first.cultivation` and store `cultivation` unchanged after 2nd call | Vitest unit (new test 1, RED→GREEN evidence) | High: silent economy duplication at boot |
| INV-REST-2 | PlayerData in Pinia player store | `restoreFromSave(save2)` with a DIFFERENT payload (lastSavedAt/cultivation changed) | Full apply — no false-positive guard block on legitimate re-restore | Value mutation: newer lastSavedAt, different cultivationPerSecond | `result.cultivation === 1200` (20/s×60s), `elapsedSeconds === 60`, `cultivationPerSecond === 20` | Vitest unit (new test 2) | High: guard must not brick boot retry/recovery |
| INV-REST-3 | PlayerData normalization invariants | Guard skip path must not bypass normalization on a full apply | Atomicity — nodeLevels fallback + attackRange baseline still run after Object.assign | Missing-field mutation: `nodeLevels = undefined` | `nodeLevels === {}`, `attackRange > 0` | Vitest unit (new test 3) + existing artifact/aiStrategy suites | Medium: UI crash regression ("không xóa được save") |
| INV-REST-4 | Guard snapshot (WeakMap per store instance) | Fresh pinia per test/session; repeated restore on a NEW store instance | Lifecycle/synchronization — no cross-instance guard leakage | Stale state: reuse identity across pinia instances | Each test's beforeEach creates a fresh pinia; identity lookups keyed by instance (same proven pattern as `lastExternalModifiers`) | Vitest unit (whole store seam, 184 tests) | Medium |
| INV-REST-5 | PlayerData conservation | Second same-payload call must not double Object.assign either (state fully stable) | Exactly-once — no state re-application side effects | Repeat operator, observing multiple fields | `player.cultivation` unchanged after 2nd call (test 1) | Vitest unit | Medium |
| INV-REST-6 | Identity string `${lastSavedAt}\|${cultivation}` | Two saves sharing both identity fields but differing elsewhere | Collision would skip a legitimately different payload | Value mutation: same lastSavedAt+cultivation, different spiritStone | Code inspection only | Static | Low (see findings) |
| INV-REST-7 | GameManager.restoreFromSave (separate owner) | Repeated session restore would re-apply manager-owned state (equipment/materials) | Exactly-once across owners | Repeat operator | Code inspection only | Static | Low (out of task scope, see findings) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| RED: `npm.cmd run test -- src/stores/player.restoreFromSave.test.ts` (before guard) | 1 failed / 2 passed — `expected 400 to be 300` | Intended failure: second same-payload call credited +100 (10s × 10/s elapsed between calls) → double-credit reproduced deterministically via mocked `Date.now` |
| GREEN: `npm.cmd run test -- src/stores/player.restoreFromSave.test.ts src/services/save/SaveSystem.bootRestore.test.ts` | 2 files, 6/6 passed | bootRestore spy single-call contract intact |
| Seam: `npm.cmd run test -- src/stores src/services/save src/core/idle` | 19 files, 184/184 passed | Full store + save + idle surface |
| `npm.cmd run type-check` | pass, no errors | vue-tsc --build |
| Grep `reset(`/`$reset`/newGame in `game/src` | No player-store reset action; new-game = deleteSave + reload | Justifies no guard-reset hook (fresh pinia on reload) |

## Findings

### QA-2026-09-03-001: Identity collision window — same `lastSavedAt` + same `cultivation`, different other fields
- Severity: Low
- Status: Suspected
- Invariant: INV-REST-6 (Idempotency identity precision)
- Preconditions: two distinct saves where `lastSavedAt` and `player.cultivation` are both identical but other PlayerData fields differ, restored into the SAME store instance in one session.
- Reproduction: not reachable through current callers — `buildGameSave` stamps `lastSavedAt = Date.now()` at save time and boot loads from storage once per session; autosave cadence is 15s, so two distinct payloads sharing both identity fields require two save writes in the same millisecond with unchanged cultivation, then two restores in one session (no such caller exists).
- Expected: guard only skips byte-identical re-application intent.
- Actual: identity is the brief-prescribed `${lastSavedAt}|${cultivation}` pair; a contrived collision would skip the second apply.
- Evidence: static inspection of player.ts:322 and all call sites (App.vue, SaveSystem.ts, player.load).
- Test file: none (not reachable via any current caller)
- Owner subsystem: stores/player
- Blast radius: theoretical; no current caller sequence can produce it.

### QA-2026-09-03-002: Guard covers only the player-store owner, not `GameManager.restoreFromSave`
- Severity: Low
- Status: Coverage gap
- Invariant: INV-REST-7 (Exactly-once across restore owners)
- Preconditions: a future caller repeats `restoreGameSession` with the same save in one session — player state would no-op (guarded) while manager-owned state (equipment/materials/slots) re-applies.
- Reproduction: no such caller exists today (`restoreGameSession` is called once at boot; QA-002 is scoped to the player store per the design doc §2.1).
- Expected: whole-session exactly-once semantics across all owners.
- Actual: only the Pinia player owner is guarded.
- Evidence: static inspection of SaveSystem.ts:447-470, GameManager.ts:3051.
- Test file: none
- Owner subsystem: services/save + core/game (out of task scope)
- Blast radius: none for current callers; becomes material only if a retry caller is added later (recommend guarding at `restoreGameSession` level then).

## New or Changed QA Tests

`game/src/stores/player.restoreFromSave.test.ts` (committed with the fix):
1. Same-payload double call → offline credited once; deterministic via mocked advancing `Date.now` (proves INV-REST-1/5; was RED pre-fix with 400 vs 300).
2. Different-payload call → full apply with exact arithmetic assertions (proves INV-REST-2).
3. `nodeLevels` missing + attackRange baseline after full apply (proves INV-REST-3).

## Gaps and Residual Risk

- INV-REST-6 and INV-REST-7 remain static-analysis-only (Suspected / Coverage gap, both Low and unreachable through current callers) — do not materially weaken the conclusion.
- Mocked-clock pattern mirrors `SaveSystem.bootRestore.test.ts` (`vi.spyOn(Date, 'now')` + `restoreAllMocks`); no flakiness observed across repeated runs.

## Pre-existing Failures

None observed (all suites green before and after).
