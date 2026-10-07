# Fixpoint r36 — AUT (adversarial) audit of `bb7bc574`

Auditor: AUT (exploit hunter). Audited commit: `bb7bc574` on
`codex/hoa-cau-fireball-vfx` (the full r35 adjudication). Method: every r35
change attacked first, then siblings of each class. Every claim verified
against the checked-out source; confirmations carry executed repros in
`src/services/save/auditR36Aut.probe.test.ts` (9 tests, all passing under
`npx vitest run <file> --pool=threads`).

## Verdict

**FAIL** — 1 Medium + 2 Low + 1 Nit confirmed; 1 further Nit recorded as
pre-existing/out-of-scope. No Critical/High. All assigned attack vectors
were exercised; the rejected ones are enumerated at the bottom with their
kill evidence.

---

## Confirmed findings

### r36-AUT-1 (Medium) — the administrative latch parks the fallback channel only; the live renderer-ACK channel resolves the whole parked turn — including the terminal settlement mint — under `authority-pause`/`user-pause`

The r35-AUT-1 gate's contract is "an administratively latched clock parks
the step until released" (and the r35-B probe is literally named "frozen
means frozen on every channel"). That is only true for the wall-clock
channel. The primary channel never parks.

Mechanism chain (source):

- `awaitStep` (`GameManagerTurnBattleOps.ts` ~:815-890) parks a step and
  leaves `pendingStepDone[signal]` registered while the new gate re-arms
  the fallback timer.
- `CombatAnimationRuntime.acknowledgeTurnReady/ActionImpact/
  ActionComplete` (`CombatAnimationRuntime.ts:265,:322,:418`) gate on
  `deps.isSessionBlocking()` + `playbackToken` identity **only** — they
  never consult `combatClock.getFreezeReasons()`.
- Their production driver is the Phaser scene
  (`combat-action-feedback.ts:104`, `SkillPresentationRunner.update()`
  :187,:191), which keeps ticking while the combat clock is frozen — the
  combat scene stays mounted during `reconnecting` and `user-pause`.
- So a parked turn resolves ready→impact→complete under the latch:
  `settleStep` → `done()` → `onTurnDrained` → `turnToken.resolve` →
  `settleCombatOutcome` — mints included.

Executed repro (probes A1/A2/A3, fake timers never advanced — the gated
fallback provably cannot run, so everything that resolves arrived through
`acknowledge*`):

- A1: `authority-pause` latched, released interactive session →
  `acknowledgeTurnReady` declares, `acknowledgeActionImpact` damages the
  enemy (1,000,000 → 999,848 hp), `acknowledgeActionComplete` ends the
  turn — `totalTurnsElapsed` 0→1, token IDLE, `'authority-pause'` still
  latched.
- A2: killing impact under `authority-pause` → `completeAction` →
  `'victory'` → `settleCombatOutcome` → `completedStageIds` mint +
  `battle_end` — the full terminal settlement ran under the latch (its
  own `combatClock.stop()` is what finally clears the reason set).
- A3: identical drain under `'user-pause'`. (`'tab-hidden'` cannot reach
  it — its RAF-driven channel dies with the tab.)

Bound and honest reachability: residual mechanical work of the in-flight
turn only (no new claims — the clock stays frozen), plus terminal
settlement when that residual kills. Same-owner mint on `'same'` lineage
(accrual banked during an unproven-authority window); wiped on
`'replaced'` (deny-direction: a legitimately earned turn evaporates with
the restore); unreachable inside the `bootGame` commit awaits (scene
unmounted) and under `'tab-hidden'`. Severity Medium for the broken
contract the fix itself asserts; the adjudicator may reasonably reclassify
as accepted "finish-the-swing" semantics — but then the gate's comment
and the r35-B probe name should stop claiming every channel parks.

### r36-AUT-2 (Low) — expired-but-queued fallback closures survive `clearPendingSteps`: a stale-cycle fallback wipes the new cycle's parked settle and drives the new battle's mechanics early

The step bookkeeping is signal-keyed with no cycle binding, and
`clearPendingSteps` can only `clearTimeout` handles — a timer callback
already dispatched into the event-loop task queue cannot be cancelled
(standard uncancellable-task edge).

Mechanism chain: fallback armed in cycle N expires inside the macrotask
slice where `beginBattleCycle` swapped `this.turnBattle`. When the queued
task runs, `liveBattle` is the NEW battle (live), the drop arm is skipped,
the admin gate passes, and the drive arm executes
`pendingStepDone[signal] = undefined` — wiping the **new** battle's
parked settle for that signal — then `driveStepWork(signal)` runs
`acknowledge*` with the CURRENT `playbackToken` (freshly minted, valid),
resolving the new turn's mechanics early. The stale `done()` lands on the
dead pipeline (idempotent, inert).

Executed repro (probe B1, queue-captured `setTimeout`):

- Cycle 1 parks `'ready'` (fallback captured); `startBattleWithPlayer`
  ('fresh' policy — mid-turn `startStage` is refused by the wave lease)
  swaps the cycle; cycle 2 parks its own `'ready'`.
- Invoking the stale callback: `pendingStepDone['ready']` → `undefined`
  (new settle wiped), `pendingDeclaredAction` set, `turn_cast_start`
  emitted exactly once — the new battle's declare ran early, driven by a
  ghost callback before its own step timer ever fired.
- Bound: the new step still completes through its own fallback (invoked
  next — `done()` heals the park); same-owner work only, ordering
  violation. Probe B2 pins the benign arm: a stale fire before the new
  battle claims is a clean no-op.

Reachability: narrow timing (expiry and the synchronous swap must share a
task-queue slice — plausible under load/jank or batched timers), no mint,
self-healing → Low.

### r36-AUT-3 (Low) — `EarlyGameSession.restoreCheckpoint` is a third in-place `$state` rewrite seam with no battle discard at all

`EarlyGameSession.restoreCheckpoint` (`EarlyGameSession.ts:644-657`) calls
the production `restoreGameSession` — the same in-place delete-sweep +
`Object.assign` — on a real `GameManager` whose live battle binds
`playerDataForTurnBattle` to that same object (aliased by
`player.$state`, not copied). A mid-battle restore leaves the ghost
attached to the rewritten contents: its subsequent turns mint onto the
"new" character — the exact class r34-COR-F1 (boot) and r35-INT-1
(reconnect) closed; this seam has neither a discard nor any ordering
against it.

Reachability: simulation/test-harness seam only (`EarlyGameLoop`,
`EssenceSubstitutionEconomy`, sim suites, the r25/r26 audit probes); no
production path calls it during a live battle. Mint is confined to the
sim's own `$state` → Low, flagged so the class inventory stays complete.

### r36-AUT-4 (Nit) — `pendingStepTimers` grows one entry per re-arm while administratively parked

Each admin-gate re-arm pushes a fresh handle
(`GameManagerTurnBattleOps.ts:843`); expired handles are never pruned, so
the array grows ~1 entry per `ANIMATION_FALLBACK_MS` for the whole park
duration (probe C1: ≥4 entries after 3 intervals). Cleared at settle /
cycle entry — bounded, cosmetic → Nit.

### r36-AUT-5 (Nit, pre-existing, out-of-scope) — `setCombatClockSource` silently drops every latch

The r35 gate reads `this.combatClock.getFreezeReasons()` — the mutable
current instance. `setCombatClockSource` (:395-406) swaps the clock
wholesale: all administrative reasons die with the old instance, and
`'turn-in-flight'` never re-latches (the token listener is
transition-only) → a swapped clock runs while the token sits RESOLVING,
and the next claim hits the non-IDLE guard. Reachable today only via
init/test/sim seams (`App.vue:201` init-time, `EarlyGameSession`,
`BattleSimulation`, `tests/lab`) — pre-existing hazard the r35 gate
inherits by reading the mutable instance; recorded so later waves don't
re-derive it.

---

## Rejected candidates (verified clean on `bb7bc574`)

1. **`'turn-in-flight'` inside the step-7 latch snapshot → wedge**
   (F5 attack): killed — `clearCycleEntryState` → `turnToken.reset()` →
   IDLE → `resume('turn-in-flight')` fires at cycle entry, *before* the
   snapshot; probe C2 shows the new cycle claims and resolves cleanly.
   No accumulated claim can wedge.
2. **Non-exempt reason smuggled in to force a drain**: inversion — any
   non-exempt reason makes the fallback *park* (deny-direction), and all
   three producers (`authority-pause`, `user-pause`, `tab-hidden`) are
   owner-released. Forging `'turn-in-flight'`/`'not-revealed'` can't help
   either: a manual `'turn-in-flight'` freeze self-clears at token IDLE,
   and `'not-revealed'` re-derives at the next `syncOffScreenFreeze`.
3. **`'not-revealed'` as cover for an administrative pause / C3-window
   latch dominance**: enumerated — the admin check runs *before* the
   `isBlocking` deferral arm, so any admin reason always dominates.
   Every remote-commit window pairs `'authority-pause'`
   (`pauseSimulation` before the boot commit leg and the reconnect
   pause), so the 8x cap-drain cannot run inside a commit await; a held
   session alone only re-opens the deferral arm, not the admin gate.
   (Also pinned by the r35-B last probe.)
4. **`'same'` lineage rewrite**: `runReconnectPipeline` returns
   `save: undefined` on `'same'` — zero `$state` mutation, nothing to
   discard. The `lineage === 'replaced' && save` gate is exact: replaced
   without a payload can't have rewritten anything either.
5. **Resume arms besides `App.vue` `'replaced'`**: full enumeration —
   `resumeSimulation` callers: `App.vue:747` (discard-guarded on the
   only rewrite arm) and `App.vue:773` (update-install admission — a
   client→server flush, no `$state` rewrite); `resumeCombat
   ('authority-pause')`: `useAppLifecycle.ts:299` (inside
   `resumeSimulation`) and `:757` (boot tail, discard-guarded at :741);
   `useCombatPause.ts:53` (`'tab-hidden'`) and `CombatTopBar.vue:102,119`
   (`'user-pause'`) unlatch UI-owned reasons with no rewrite nearby.
   `restoreGameSession` callers: `:493` boot ok-arm (guarded), `:718`
   resume (guarded), `EarlyGameSession:648` (→ finding 3). Boot rejected
   arm and resume rejected arm still `markFailed`+`fail` with no unlatch.
6. **Dead-battle drop wiping a live new-cycle settle**: unreachable —
   armed timers die in `clearPendingSteps`; the drop arm only ever
   observes `null`/terminal/`'stopped'` state where its
   `pendingStepDone[signal] = undefined` writes into `{}`. Every
   in-cycle terminal path completes the parked step synchronously
   (`completeAction` → `sink.onComplete` in the same ack) or clears the
   pending maps at cycle entry. The `idle-check` step completes inline
   (`run: (done) => done()`) and can never park. The real stale-closure
   reachability is the drive arm — reported as finding 2.
7. **Cross-cycle ACK token collision**: `playbackToken` resets to `''`
   on `resetPendingState` and mints `playback-N` monotonically; stale
   tokens fail the identity check and return silently (:271,:328,:428).
   Also verified: post-discard ACKs are no-ops (r35-A probes).
8. **F2 nulls (`turnRuntime`/`battleBuffRegistry`/`combatScheduler`)
   crashing a survivor**: every reader is guarded (:588, :674,
   :1039-1048, :1083, :1467, :1511, :1993); `abandonBattle` and a
   second `discardStaleBattle` on the post-discard state are clean
   no-ops (r35-A probes already pin).
9. **`discardStaleBattle` on a not-revealed/held session**: `session.end`
   before `combatClock.stop()` — `stop()` clears the reason set anyway;
   nothing can resurrect it (r35-A catch-arm probe pins).
10. **ACK drain inside the `bootGame` awaits**: CombatScene is unmounted
    during boot — no RAF, no ACKs; and the `:741` discard runs before
    the `:757` unlatch. The commit-leg window stays parked (r35-C probes
    re-verified this wave's premise).

## Probe inventory

`src/services/save/auditR36Aut.probe.test.ts` — 9 tests, node env,
deterministic (fake timers; `Math.random` pinned to 0; `setTimeout`
queue-captured in B):

- A: latch-bypass drains (authority-pause turn resolve; killing-impact
  terminal mint under latch; user-pause; unlatched control).
- B: stale-cycle fallback (settle wipe + early declare; benign no-op
  variant).
- C: timer-growth Nit evidence; `'turn-in-flight'`-snapshot rejection
  pin; latch-preserving restart pin.
