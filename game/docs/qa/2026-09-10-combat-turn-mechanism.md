# QA Review: combat turn mechanism + real-time/turn authority

- Date: 2026-09-11
- Branch: `feat/combat-turn-mechanism` (11 tasks, forked from master `4346b9a8`)
- Mode: whole-branch closeout QA (Task 11 of the plan), **not** the dedicated
  `tutienidle-adversarial-qa` capability — that capability is not available in
  this harness. See "Adversarial pass method" below for what was done instead.
- Verdict: **PASS WITH RETAINED DEBT**
- Specs in force:
  - `docs/superpowers/specs/2026-09-10-combat-turn-mechanism-design.md`
    (binding authority on turn order, turn-end, the resolution pipeline,
    manual mode, the external-command boundary)
  - `docs/superpowers/specs/2026-09-10-combat-realtime-turn-authority-design.md`
    (in force except where the document above supersedes it; owns the
    two-clock separation, no catch-up, the off-screen pause, the
    closed-curtain work window, `presentationActive` ownership, the cooldown
    authority, and the §5 time classification — including §4.4 frame-rate
    independence)
- Task-owned paths (full branch diff, merge-base `4346b9a8`): 66 files,
  `+4064/-460`. Touches `src/core/battle/turn/*`, `src/core/game/GameManager*`,
  `src/game/scenes/CombatScene.ts`, `src/presentation/*`,
  `src/main-process/combatClockHost.ts`, `src/composables/useCombatPause.ts`,
  `src/components/game/combat/CombatPauseOverlay.vue`, plus locale strings.

## Scope

This document closes the branch. It does not re-review every task's diff line
by line — each of Tasks 1-10 already went through its own task-scoped review
(recorded in `progress.md`), several with multiple fix rounds. This pass:

1. Verifies the §5 classification (real-time vs. turn-domain vs. world-clock)
   is now enforced by a test that fails on a real re-violation, not merely on
   a comment change (`src/core/game/CombatTimeClassification.test.ts`).
2. Runs the full verification gate for real and pastes the output.
3. Performs a lighter, self-directed adversarial pass over what changed,
   since the dedicated QA subagent capability was unavailable.
4. Transcribes every `deferred`/`DEFERRED`/`minor (deferred)` line from
   `progress.md` into a gaps list, without softening any of them.

## Classification enforcement: what the parity test actually guards

`src/core/game/CombatTimeClassification.test.ts`, 5 assertions:

1. **No `deltaSeconds`/`dt`/`delta` consumption in the turn-domain files**
   (`TurnBattleSystem.ts`, `TurnSkillAction.ts`, `ActionGauge.ts`). Comment
   lines are excluded from the scan — the raw `/\bdelta\b/i` regex the task
   brief specified also matches the English word "delta" inside legitimate,
   unrelated prose ("gauge-delta effect", a one-shot gauge push feature
   documented in comments) and would have failed on wording, not on the
   invariant. **Would newly fail if:** a function in one of these three files
   took a `deltaSeconds` (or `dt`/`delta`) parameter and used it — e.g. if a
   future change reintroduced `skillSystem.update(deltaSeconds, 0)`-style
   wiring into the turn domain. Proven by injecting exactly that
   (`const deltaSeconds = 1; void deltaSeconds` inside `TurnBattleSystem.ts`)
   and observing the test fail with the injected line reported as the
   offender, then reverting.
2. **The world tick (`updateBattleFixedStep`) never calls
   `tickPacing`/`tickIntro`/`tickCountdown`.** The brief's original method-body
   extraction searched for the next `private stepTurnBattle` declaration
   after `updateBattleFixedStep`; in the shipped code `stepTurnBattle` is
   declared *before* `updateBattleFixedStep`, so that search always landed at
   end-of-file and happened to pass only because nothing textually after
   `updateBattleFixedStep` mentions the tick* methods — an accident of file
   ordering, not a scoped check of the method body. Rewritten to extract the
   real method body by brace-depth counting from the actual declaration line
   (also fixing a related bug: a plain `indexOf('updateBattleFixedStep(')`
   matches a comment earlier in the file that mentions the method by name).
   **Would newly fail if:** `updateBattleFixedStep`'s body called
   `tickPacing`/`tickIntro`/`tickCountdown` again. Proven by injecting a
   `tickPacing` call into the method body and observing failure, then
   reverting.
3. **No freeze is implemented by pausing the Phaser scene**
   (`CombatScene.ts`, `PhaserCanvas.vue`, `useCombatPause.ts`,
   `GameManagerTurnBattleOps.ts`). **Would newly fail if:** any of those files
   called `scene.pause(`, `anims.pauseAll(`, or assigned `anims.paused =`.
   Proven by injecting a `scene.scene.pause()` call into `CombatScene.ts` and
   observing failure, then reverting.
4. **`isTurnInFlight()` reads the token's own state, not a mirrored flag.**
   The brief cited `CombatAnimationRuntime.ts`, but that method does not exist
   there — it is declared on `GameManagerTurnBattleOps` (0 hits for the name
   in `CombatAnimationRuntime.ts`, confirmed by grep). As written, the brief's
   version would find an empty string and fail for the wrong reason (missing
   symbol) rather than the right one. Corrected to the real file.
   **Would newly fail if:** `isTurnInFlight()`'s body stopped calling
   `this.turnToken.getState()` — e.g. if it read a separately-maintained
   boolean instead. Proven by replacing the body with a private mirrored
   `boolean` field and observing failure, then reverting.
5. **The countdown display is the only combat surface expressing seconds**
   (`TurnBattleSystem.ts`, `TurnSkillAction.ts`, `ActionGauge.ts`,
   `TurnBuffSystem.ts`), scanning non-comment lines. The brief's
   `/\bSeconds\b|\bseconds\b/` is word-boundary-anchored, which does **not**
   match "Seconds" in the middle of a camelCase identifier — there is no word
   boundary between "n" and "S" in `durationSeconds` — so a field named like
   the exact violation this test exists to catch (`remainingCooldownSeconds`,
   `perfectClearSeconds`-style) would slip through silently. Replaced with a
   case-insensitive substring match (`/seconds/i`), still restricted to
   non-comment lines. **Would newly fail if:** a camelCase field or variable
   containing "seconds" appeared in code in one of these four files. Proven by
   adding `export const PROBE_durationSeconds = 3` to `TurnBuffSystem.ts` and
   observing failure with a bounded-regex control case failing to catch it
   first, then reverting; confirmed with the fixed regex.

All five deviations from the brief were necessary to make the test check what
it claims to check, not to make it pass. Each was proven both ways: RED with
the literal brief text or an injected violation, GREEN on real code, and RED
again on a targeted mutation after the fix. See TDD evidence below for the
literal commands and output.

## TDD evidence

**RED (brief's literal test against the real codebase):**

```
$ npx vitest run src/core/game/CombatTimeClassification.test.ts
...
 FAIL  ... > no combat engine file consumes deltaSeconds
AssertionError: expected 'export interface TurnResourcePool {...' to match /deltaSeconds|\bdt\b|\bdelta\b/i
(source contains "gauge-delta effect" / "gauge-delta deferral" / "delta cộng lên trên" — all in comments)

 FAIL  ... > the turn-in-flight predicate is the token state, not a mirrored flag
AssertionError: expected '' to match /turnToken\.getState\(\)/
(isTurnInFlight does not exist in CombatAnimationRuntime.ts)

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
```

Both failures are test defects (wrong scope, wrong file), not production
defects — confirmed by grep before touching test code (`grep -n "delta"` on
the three files showed only comment hits; `grep -rn isTurnInFlight src`
showed the real declaration in `GameManagerTurnBattleOps.ts`).

**GREEN (after fixing the test's scope, not the production code):**

```
$ npx vitest run src/core/game/CombatTimeClassification.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**Meaningfulness proof (mutate production, expect RED, revert, confirm GREEN)**
— five injections, one per assertion, each reverted with `git checkout --`
immediately after observing failure; `git status --short` showed a clean tree
before proceeding. Sample (assertion 4, the most surprising one):

```diff
-  isTurnInFlight(): boolean {
-    return this.turnToken.getState() !== 'IDLE'
-  }
+  private probeMirroredFlag = false
+  isTurnInFlight(): boolean {
+    return this.probeMirroredFlag
+  }
```
```
FAIL ... > the turn-in-flight predicate is the token state, not a mirrored flag
AssertionError: expected 'isTurnInFlight(): boolean {\n    // PARITY-TEST-PROBE...\n    return this.probeMirroredFlag' to match /turnToken\.getState\(\)/
```
Reverted; suite back to 5/5 green.

## Full verification gate (pasted, not summarized)

**`npm run type-check`** — clean after annotating the two test-file arrow
function parameters (`(line: string) =>`) that `vue-tsc --build` flagged as
implicit `any` (calling `.filter()` on a value typed via the project's
`node:fs`-ambient-types-omitted convention needs an explicit annotation; the
receiver being effectively untyped does not suppress the check the way it
does for a directly-any-typed variable used elsewhere):

```
> tien-hiep-idle@0.0.0 type-check
> vue-tsc --build

(no output — 0 errors)
```

**`npm run build`** — clean:

```
✓ 742 modules transformed.
...
✓ built in 7.52s
```
(Pre-existing chunk-size warning only, unrelated to this branch.)

**`npx vitest run`** (full suite) — clean on this run:

```
 Test Files  468 passed (468)
      Tests  3175 passed (3175)
   Duration  221.69s
```

No failure surfaced from the three known pre-existing flakes
(`TurnBattleSystem.selfBuff.qa.test.ts`, `TurnBattleSystem.test.ts`,
`TurnBattleSystem.dotSource.qa.test.ts`, all unpinned `Math.random()` — see
Gaps). A clean run does not mean they are fixed; it means this particular run
didn't roll the unlucky seed. They are listed in Gaps regardless, per
instruction.

**`npx playwright test --workers=1`** — 17/17 passed:

```
  ok 12 tests\e2e\presentation-routing.spec.ts ... (15.3s)
  ok 13 tests\e2e\reduced-motion.spec.ts ... (4.8s)
  ok 14 tests\e2e\save-reload.spec.ts ... (19.3s)
  ok 15 tests\e2e\standing-slot-panel.spec.ts ... (13.3s)
  ok 16 tests\e2e\turn-combat-hud.spec.ts ... (1.9m)
  ok 17 tests\e2e\wave-vfx-capture.spec.ts ... (26.0s)

  17 passed (6.5m)
```

## Adversarial pass method (dedicated tool unavailable)

The `tutienidle-adversarial-qa` capability is not available in this harness.
In its place, an adversarial pass was done directly:

1. **Classification test itself was adversarially mutated** — see above. This
   is the most direct form of adversarial testing available for this task's
   specific deliverable: prove the guard can fail, not just that it currently
   passes.
2. **Grepped the full branch diff (merge-base `4346b9a8..HEAD`) for new `any`
   in production code.** Found exactly 4 occurrences, all in test files
   (`App.wiring.test.ts` — two `as any`/`(s: any)` casts on a mock
   coordinator/GameManager, already noted as a deferred minor finding for
   Task 3; `TurnPipeline.test.ts` — `kind: any` on a test-only `sync` step
   helper, inherited from the brief and already noted as a deferred minor
   finding for Task 5). Zero new `any` in shipped production code.
3. **Cross-checked the boundary queue's clear sites** against the plan's own
   record (spec §9.2: cleared on `startStage`, abandon, and
   `RESOLVING → COMBAT_OVER`, not only the first two). Found five clear sites
   in `GameManagerTurnBattleOps.ts` (lines 586, 715, 1056, 1124 at time of
   writing, plus the declaration at 161) — matches the ledger's account of
   Task 10's fix round adding the `startBattle()` clear alongside the
   pre-existing three.
4. **Re-read the two full specs** end to end against the branch's shipped
   contract (this is what produced the roadmap entry) rather than trusting
   task-level summaries alone, specifically to avoid the citation trap named
   in this task's brief (§5 classification and §4.4 frame-rate independence
   live in the realtime-turn-authority doc, not the turn-mechanism doc — both
   are now correctly attributed in the roadmap entry and in this document).

This is narrower than the dedicated capability would have done (it would
likely have generated targeted invariant probes per file, the way the
Equipment Refine QA report in this same `docs/qa/` directory did). It is
disclosed as such rather than presented as equivalent coverage.

## What this pass did NOT re-verify

- The correctness of Tasks 1-10's own production logic — each already went
  through independent task-scoped review (see `progress.md`), some with
  multiple fix rounds and hand-traced verification. Re-deriving that here
  would not be an adversarial pass, it would be redundant work; the whole-
  branch review that follows this task is the intended venue for a fresh full
  read.
- Real-hardware Electron minimize/restore and OS suspend/resume (open
  controller action from Task 7, carried forward — see Gaps).

## Gaps (every `deferred`/`DEFERRED`/`minor (deferred)` line from `progress.md`, verbatim in substance, not softened)

**Flakes (out of this plan's scope, pre-existing):**
- `TurnBattleSystem.selfBuff.qa.test.ts`, `TurnBattleSystem.test.ts`,
  `TurnBattleSystem.dotSource.qa.test.ts` — all unpinned `Math.random()`.
  Together they make a clean full-suite run close to a coin flip.
  `GameManager.actionPlayback.test.ts:77-94` shows the pinning pattern
  (`evasionRate: 0`) that would fix them; Task 10 used it successfully for one
  test in this same family (the victory-boundary flake).

**Open controller action (platform premise not empirically re-confirmed here):**
- Real-hardware Electron minimize/restore + OS suspend/resume check (Task 7
  brief Step 10). The stall-guard logic is unit-proven with fake timers; the
  premise that main-process `setInterval` is actually throttle-immune in a
  packaged, minimized window, and that `powerMonitor` suspend/resume actually
  fire end-to-end, has not been confirmed on real hardware. The Task 8 pause
  overlay independently covers the visible-to-the-player case (tab hidden),
  bounding the downside.

**Task 1:**
- `settledStateFor`-shaped ternary (`state === 'closing' ? 'closed' :
  'opened'`) repeated 3x in `PresentationTransitionOverlay.vue`; could be
  hoisted. Pure DRY polish.

**Task 2:**
- `isSameRequest`/`isUnchanged` cannot distinguish two sessionless
  `behindCurtain` requests for the same route (unreachable today via
  `runAdmitted`'s `isAdmitting` gate, but the coordinator itself does not
  enforce it).
- The implementer's stated purpose for the curtain reopen was wrong — the
  error shell covers the screen regardless; the reopen only restores internal
  `curtainState` bookkeeping.
- **The error shell's Back button is a silent no-op.** `onTransitionBack`
  (`App.vue:210-211`) calls `coordinator.request({ target: 'home' })`, but on
  a failed transition `currentRoute` was never committed so it is still
  `'home'`; `ALLOWED_EDGES.home` has no `'home'` self-entry, and `request()`
  lacks the `target === currentRoute` shortcut that only `canEnter()` has
  (`:153`). The request is rejected before `executeTransition`, `phase` stays
  `'failed'`, and the error card's `v-if` keeps it on screen. Pre-existing,
  not caused by Task 2; also affects the combat Back path on a first-attempt
  failure (it only appears to work for a refight failure, where
  `currentRoute` was already committed to `'combat'`). Suggested fixes: add a
  `'home'` self-edge, or give `request()` the same same-route shortcut
  `canEnter()` has. Needs a regression test. **No task in this plan owns
  this.**
- `createGamePresentation.ts:145-149` has two literally identical if/else
  branch bodies — required for per-arm TS narrowing without a cast, not a
  copy-paste error, but worth a comment.
- An earlier fix-round report's full-suite arithmetic was off by one.

**Task 3:**
- `App.wiring.test.ts:352-353` uses `any` for the snapshot listener type;
  could use `CoordinatorSnapshot`. Test-only, brief-mandated, matches repo
  convention.
- P13 runtime evidence (the 24-events-spaced-1.9-3.0s measurement) is
  prose-only and not re-derivable after the diagnostic spec was deleted
  pre-commit. Inherent to this evidence class; nothing to act on.

**Task 4:**
- The `+ 1e-10` epsilon at `CombatClock.ts:134` is additive and never decays,
  so a `carrySeconds` legitimately just under a step boundary
  (`COMBAT_STEP_SECONDS - 5e-11`) rounds up one step early. Verified harmless
  at 0.1s granularity with real frame deltas and non-compounding (the
  subtraction uses the true value), but worth a second look now that the turn
  engine actually consumes `getElapsedSteps()`.
- The "knows nothing about turns" test is still a source-grep, not semantic —
  a lookup table keyed by reason, or a renamed parameter, would slip past it.
  Meaningfully stronger than the original regex, not airtight.

**Task 5:**
- `TurnPipeline.reset()` has no guard against being called synchronously from
  inside a running step's `run()` — stale `step` reference, queue reassigned
  under the loop, `onDrained()` can fire after an abort-intent reset.
  Verified (Task 6 review) that the first real caller never does this, but
  the guard itself is still absent.
- The `sync` test helper types `kind: any`, bypassing the
  `PipelineStep['kind']` union. Inherited verbatim from the brief; test-only.

**Task 6:**
- `awaitStep`'s fallback calls `done()` unconditionally after
  `driveStepWork`, but every `acknowledge*` early-returns under
  `presentationSession.isBlocking()`. If the fallback fires while the session
  is held (e.g. mid `detachPresentation('hold')`, which keeps
  `presentationActive` true without draining), the mechanical work is skipped
  while the step completes anyway — a narrower window of the same failure
  mode. Requires a renderer detached-and-held during an in-flight turn whose
  fallback elapses before reattachment.
- `getAnimationState()` reports `'idle'` for a manual actor during
  `AWAITING_INPUT`, since `pauseForManualActor` no longer sets
  `pendingReadyActor`. No production caller today.
- A second pre-existing unpinned-`Math.random()` flake was found in
  `TurnBattleSystem.test.ts` (pass/pass/pass/fail on unchanged code), joining
  the known one — see Flakes above.

**Task 8:**
- No test dispatches a second hidden event while already paused, so the
  no-stacking guard is verified by inspection only (the underlying `Set`
  makes it safe regardless).
- `CombatPauseOverlay` has `role="dialog" aria-modal="true"` but no focus
  trap, no `aria-labelledby`, no autofocus on Continue. Matches the brief's
  template and exceeds local convention (sibling overlays use no ARIA at
  all).
- The A7 (animation-never-stops) evidence framing slightly overstates what a
  simulated `visibilitychange` can prove about genuine OS backgrounding — the
  browser stops `requestAnimationFrame` once a tab is really hidden, which is
  platform behaviour the pause overlay exists to answer, not something the
  task can defeat.

**Task 9:**
- `onBattleStart()` does not clear `turnCountdownSpawnVfxHandles`. The
  implementer called this "provably unreachable by construction"; the
  re-reviewer disagreed — the real guarantee is that the turn engine always
  publishes an undefined-progress snapshot before combat proper starts, which
  is a cross-system invariant enforced nowhere in `CombatScene`. If a future
  battle-start path ever skips the flush snapshot, or a countdown is
  interrupted by a forced start, the leak returns. Fragile, not proven.

**Cross-cutting (no task owns these; carried to this document per the
`AGENTS.md` retained-debt convention):**
- No mid-combat save or load. Combat state is ephemeral.
- No multi-tab leader election. One instance is assumed.
- OS sleep and lid-closed events resume the clock source without catch-up. No
  banking of missed time.
- Browser throttling below a hidden document (a slow machine, a heavy tab) is
  deliberately left to the player (spec §12) — the pause overlay covers the
  hidden-document case only.

## Verdict rationale

**PASS WITH RETAINED DEBT.** The classification is now enforced by a test
proven to fail on real violations of each of its five guards, not merely on
prose changes — the specific failure mode this task's brief warned against
and that an earlier dispatch on this branch actually committed (mis-citing
which spec document owns §5/§4.4). The full verification gate is green for
real: type-check, build, 468/468 test files (3175/3175 tests), and 17/17 E2E,
all pasted above rather than summarized. Nothing in this task's own scope
(the test, the roadmap entry, this document) was skipped or watered down.

The "retained debt" qualifier reflects that this branch — like every branch
before it in this project's history — carries forward known, disclosed gaps
rather than claiming a clean slate: three pre-existing test flakes, one
unconfirmed hardware premise, and roughly twenty small findings spanning
Tasks 1-9, all already individually triaged as acceptable-to-ship by their
own task reviews. None of them contradict the four defects this branch set
out to fix, and none of them are new discoveries — this document's job was to
transcribe them faithfully, not to re-litigate them.
