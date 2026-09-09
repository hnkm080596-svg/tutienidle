# QA Review: R10 — Session Snapshot & Restore Boundary (AR-12, AR-15 local scope)

- Date: 2026-09-09
- Mode: deep (save/restore is critical infrastructure per plan §Global Constraints; two production-crashing regressions found and repaired during this pass)
- Verdict: **PASS WITH EVIDENCE**
- Branch: `r10-save-restore-boundary`
- Plan: `game/docs/superpowers/plans/2026-09-08-r10-save-restore-boundary.md`
- Spec: `game/docs/superpowers/specs/2026-09-08-r10-save-restore-boundary-design.md`

## Scope

All 6 tasks of the R10 plan (S1-S5 + mission close). S1 (buildGameSave detachment) and part of S2 were already committed before this session (2026-09-08). This session: fixed a type error blocking S2's WIP test from compiling, then implemented and verified S2 (whole-payload identity gate), S3 (replacement semantics), S4 (once-only settle + preflight coverage), and S5 (local-adapter boundary), plus **two regressions found while verifying, not part of the original plan**.

## Task-by-task

| Task | Repair | Evidence |
| --- | --- | --- |
| S1 | `buildGameSave` deep-detaches player state via `structuredClone` | pre-existing (2026-09-08), reverified this session |
| S2 | `computeRestoreIdentity()` — whole-payload hash (player minus `lastSavedAt` + materials + quests) replaces the weak `lastSavedAt\|cultivation` fingerprint in `usePlayerStore.restoreFromSave()` | `SaveSystem.restoreIdentity.test.ts` (5 cases) |
| S3 | `GameManagerSaveRestore.restoreFromSave()` now clears `materialBag`/`pillBag` before applying save contents — restore is replacement, not additive | `GameManagerSaveRestore.replace.test.ts` (3 cases, RED-verified against pre-fix code) |
| S4 part 1 | `GameManagerSaveRestore` gains its own payload-identity tracker; offline settle (production/decompose/auto-farm/alchemy) is skipped entirely on a repeated identical payload instead of re-running | `GameManagerSaveRestore.onceOnlySettle.test.ts` (2 cases, RED-verified) |
| S4 part 2 | `preflightSaveRegistryReferences()` extended to hard-reject unknown materials/pills/buildings before any owner mutation (previously silently dropped) | `GameManagerSaveRestore.preflight.test.ts` (3 cases, RED-verified) |
| S5 | `CloudSaveService.capability: 'local-only'` descriptor + factory test + `BOUNDS.md` documenting the local-adapter boundary | `CloudSaveServiceFactory.test.ts` (2 cases) |

## Regressions found and repaired (not in the original plan)

### F1: `player.save()` crashed on every real save attempt

**Severity: Critical.** `buildGameSave`'s S1 fix (`...structuredClone(player)`) only works when the caller passes a plain `PlayerData` object — every unit test does. The **actual production call site**, `usePlayerStore.save()`, passes `this`/`this.$state`: a Vue-reactive `Proxy` tree. `structuredClone` has no concept of `Proxy` exotic objects and throws `DataCloneError` on the first nested reactive object/array it meets — including an *empty* one (`nodeLevels: {}`, `grantedRealmPassiveIds: []`). Every real save from the Settings UI (and the periodic autosave, which goes through the same action) was crashing synchronously before it ever reached the storage layer.

Confirmed via direct reproduction (`usePlayerStore()` from a real `createPinia()`, call `.save()`) and independently via the pre-existing `SettingsPanel.test.ts` quota-failure test, which was failing with the same `DataCloneError` instead of reaching its expected `QuotaExceededError` path.

**Repair:** `toRaw(this.$state)` at the call site exits reactivity before `buildGameSave`'s `structuredClone` runs. `services/save/SaveSystem.ts` itself stays framework-agnostic (no Vue import); only the one call site that was passing a reactive object needed to un-reactive it first.

**Regression tests:** `player.save.test.ts` (2 cases) — one reproduces the crash directly, one verifies the persisted snapshot is genuinely detached (mutating the store after `save()` does not change what was written to `localStorage`).

### F2: Restore aliasing defeats the S2 identity guard

Found while debugging why a pre-existing idempotency test (`player.restoreFromSave.test.ts`) started failing after S2. `Object.assign(this, save.player)` (the restore direction) shallow-copies nested fields — `this.baseStats` becomes the **same object** as `save.player.baseStats`. The restore's own normalization step (`this.baseStats.attackRange = PLAYER_BASE_RANGE_RANKS`) then mutates that shared object, corrupting the caller's `save` argument. A second `restoreFromSave(save)` call with the **same reference** then computes a different identity hash than the first call did — silently defeating the S2 guard it was supposed to feed.

**Repair:** `Object.assign(this, structuredClone(save.player))` — restore input is now a value, same principle as S1's snapshot-is-a-value fix applied to the opposite direction.

**Regression test:** added to `SaveSystem.restoreIdentity.test.ts` — asserts `save.player.baseStats` is unchanged after a restore, and that a second `restoreFromSave(save)` call with the same reference converges.

### F3 (minor, test-only): flaky `CombatSystem.skillScaling.test.ts` under full-suite run order

Unrelated pre-existing test from an earlier session (2026-09-09, combat R0 mission) started failing when run as part of the full R10 suite. Root cause: target fixtures were missing an explicit `blockChance: 0` override (the `stats` override object *replaces* `createCombatant()`'s defaults entirely, not merges), so target block chance came from `createBaseStats()`'s raw default — combined with unpinned `Math.random()`, this intermittently rolled a block and skewed `finalDamage` by the block-effectiveness factor. Pinned `Math.random()` and added the missing override; unrelated to save/restore but found and fixed during full-suite verification.

## Verification Evidence

| Command | Result |
| --- | --- |
| `npm run type-check` | Exit 0 |
| `npm run build` | Exit 0, pre-existing large-chunk warning only |
| `npx vitest run` (full suite, final pass) | 445 files / 2988 tests passed, no skips |
| Every new test file, RED-verified against pre-fix code before implementing | S2 (4/4 fail), S3 (3/3 fail), S4-settle (1/2 fail — the "different payload" case correctly passed even pre-fix), S4-preflight (3/3 fail), F1 repro (1/1 fail), F2 repro + pre-existing `player.restoreFromSave.test.ts` (both fail identically pre-fix) |
| Trial merge into current `master` (git merge, no conflicts across S1-S5 commits + this session's fixes) | clean; full verification re-run post-merge before this report |

## Gaps and Residual Risk

- `computeRestoreIdentity()`'s whole-payload hash covers `player` (minus `lastSavedAt`) + `materials` + `quests` — not equipment/buildings/skills/techniques/production/alchemy. A payload that differs ONLY in one of those uncovered fields would still converge as "the same payload" and skip re-settling. This is a deliberate scope boundary carried from S2's original design (documented there), not a new gap — but it means the once-only-settle guard (S4) inherits the same coverage boundary. Widening the hash to the full save is a reasonable follow-up if a future audit finds a live counterexample, but no live one is known today (the only production restore-repeat scenario — boot retry — restores the exact same payload object, not a partially-varied one).
- No live-browser/E2E save/reload check this session (P14 not run); the fixes were verified via the full unit/integration suite plus direct reproduction of the crash. A save → reload → save cycle in a real browser session would be good confirming evidence before the next release cut, but is not required to close this mission per AGENTS.md's isolated-worktree exception.
- AR-15 remote scope remains explicitly out of scope (per plan) — S5 only documents and guards the current local-only boundary.

## New or Changed QA Tests

- `game/src/services/save/SaveSystem.restoreIdentity.test.ts` (S2 + F2 aliasing case)
- `game/src/core/game/GameManagerSaveRestore.replace.test.ts` (S3)
- `game/src/core/game/GameManagerSaveRestore.onceOnlySettle.test.ts` (S4 part 1)
- `game/src/core/game/GameManagerSaveRestore.preflight.test.ts` (S4 part 2)
- `game/src/services/cloudSave/CloudSaveServiceFactory.test.ts` (S5)
- `game/src/stores/player.save.test.ts` (F1)
- `game/src/core/combat/CombatSystem.skillScaling.test.ts` (F3, hardened, not new)

## Notes / Suggestions

All 6 plan tasks complete; two critical/high-value regressions found and repaired beyond the plan's original scope. F1 in particular means the plan's own stated goal ("A save snapshot is a detached value") had, until this session, made the *actual save action* unusable in a real browser — the isolated unit tests that used plain `PlayerData` objects never exercised the real reactive call site. Recommend a standing pattern for this class of bug: whenever a `structuredClone`/serialization-boundary fix is added inside a domain function, also grep for and directly exercise its Pinia/Vue call sites (not just plain-object test fixtures), since reactive-Proxy incompatibility is invisible to type-checking.
