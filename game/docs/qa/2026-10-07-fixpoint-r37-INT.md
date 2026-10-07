# Fixpoint r37 — INT (integration coherence) audit

- Commit under audit: `796df2ee` ("qa fixpoint r36 adjudication: owner-scoped latch carry + cycle-epoch stale-fallback guard + curtain teardown")
- Branch audited: `codex/hoa-cau-fireball-vfx` @ `796df2ee` (exact checkout)
- Probe: `src/services/save/auditR37Int.probe.test.ts` — **16/16 green** (`npx vitest run src/services/save/auditR37Int.probe.test.ts --pool=threads`)
- Auditor: r37 INT, blind (no coordinator guidance beyond the prompt seams)
- Scope: the six r36 fixes (`GameManagerTurnBattleOps` F1/F2/F3/F5, `App.vue` curtain watch, `EarlyGameSession.restoreCheckpoint` discard) + r36-AUT-1 bounds; every `clearPendingSteps` caller; sibling latch/timer/ACK arms.

## Verdict

**PASS WITH EVIDENCE** — 0 actionable defects at any severity. Six mandated seams verified coherent end-to-end with deterministic probes; one bounded design-residual recorded as Nit (non-blocking).

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 0 |
| Nit      | 1 (design residual, bounded) |

---

## INT-1 — epoch guard vs queued stale fallback (same-generation drive) — REJECTED

**Prompt candidate:** a queued fallback that was already dequeued into the macrotask queue before `clearTimeout` survives a same-generation window and drives `driveStepWork` on a signal whose `pendingStepDone` entry was already consumed — is the `pendingStepDone[signal] = undefined` write + drive a real hole?

**Mechanism chain verified in `GameManagerTurnBattleOps.ts`:**

1. `awaitStep` arms `setTimeout(fallback)` storing `{ signal, timer }` in `pendingStepTimers` and capturing `generationAtArm = pendingStepGeneration` (~:848).
2. `clearPendingSteps` increments `pendingStepGeneration` **before** wiping `pendingStepTimers`/`pendingStepDone` (~:281 and the wipe loop) — so every entry ever armed is stale post-bump, checked inside the fallback closure's first statement (`if (generationAtArm !== this.pendingStepGeneration) return`).
3. `beginTurnPipeline` (:772) runs `clearPendingSteps()` + `pipeline.reset()` **before** pushing new steps — every arming path (`ready` claim, `impact` resubmit at :2641, `drainToCombatEnd` loop, admin-latch re-arm) funnels through it.
4. **Same-generation window** (queued callback fires after its own settle consumed the map entry, before the next `clearPendingSteps`): the fallback does `pendingStepDone[signal]` → `undefined`, writes `pendingStepDone[signal] = undefined` (harmless self-map write to a map owned by no one now), then calls `driveStepWork` → `runtime` pending guards (`pendingReadyActor`/`pendingDeclaredAction`/`pendingImpact` all consumed by the real settle) reject the drive — `CombatAnimationRuntime.drainPendingPlayback` only drains live pending state; the pipeline's `completeStep` is idempotent (`if (this.parkedOn !== step) return`, `TurnPipeline.ts`). A stale drive therefore cannot re-trigger declare/impact on a consumed step.
5. Dead-battle arm: `signal`-carrying callback checks `getTurnBattle() === signal.battle` — a replaced battle makes the fallback drop the entry without `done()` (by design; the pipeline is torn down with the battle).

**Probes (group A, 4 tests green):**
- A1/A2: capture every `setTimeout` during a parked turn; fire the captured stale callback manually → parked settle survives, declare not driven, `getTurnTokenState` still CLAIMED-parked; then next `beginTurnPipeline` bumps → re-firing early-returns before even reading the map.
- A3: same-generation queued callback after real ACK settle consumed its entry → no double drive, `pendingStepDone` map clean, token flow proceeds to next step.
- A4: deferral-arm residue bound — re-arms at most `AWAIT_STEP_DEFERRAL_CAP_MS/ANIMATION_FALLBACK_MS = 8` dead handles per parked step (was unbounded pre-F3); `clearPendingSteps` wipes the whole array regardless of liveness.

**Conclusion:** not a hole — the stale write targets a `pendingStepDone` slot the owner already vacated, and the drive is gated by the runtime pending guards + idempotent `completeStep`. Same-generation queue drift is unreachable-by-construction after the bump and provably inert before it.

## INT-2 — `'user-pause'` filter vs `CombatTopBar` lifecycle — VERIFIED

**Checked:**
- `beginBattleCycle` step 7 (:2063) snapshot `getFreezeReasons().filter(r => r !== 'user-pause')` → `stop()+start()` carries only session-scoped + pipeline-internal reasons onto the new battle's clock.
- `CombatTopBar.watch(battle)` resets `userPaused.value = false` **without** resuming the old clock — correct now, since carrying it would freeze the new battle behind a button claiming unpaused (the r36 rationale); the old clock's `stop()` clears the orphaned flag with the instance.
- `onUnmounted` resumes `'user-pause'` **only if** `userPaused.value` still true — during `abandonBattle` the unmount fires after the clock is dead; the resume targets the dying instance and is inert (probe B2 shows the bar's unmount release lands on a stopped clock and does not revive it).
- Non-repeat combat-over: `watch(battle)` clears the flag when `battle` ref goes null, teardown `stop()` clears the reason set; post-`discardStaleBattle` `getFreezeReasons()` = `[]`.

**Probes (group B, 3 tests green):** B1 mixed latch carry — `{user-pause, authority-pause, tab-hidden, turn-in-flight}` parked, repeat restart carries exactly the 3 non-user-pause reasons; B2 unmount-during-abandon release is inert; B3 non-repeat combat-over leaves `[]` and flag coherent.

## INT-3 — source-swap latch preservation vs `not-revealed` staleness — VERIFIED

**Checked:**
- `setCombatClockSource` (:395-420) snapshots `getFreezeReasons()` pre-`stop()`, re-`freeze()`s verbatim post-`start()` — `'not-revealed'` and `'turn-in-flight'` survive the swap onto the new `CombatClock` instance.
- Ownership post-swap: `PresentationSession`'s port wraps every transition (`attach`/`release`/`hold`) in `withOffScreenSync` → `deps.syncOffScreenFreeze()` — so the session that latched `'not-revealed'` still owns unlatching it on the **new** clock (the port calls into `turnBattleOps` reason APIs, which read the current `clock` field — not the swapped-out instance). Probe C1 confirms `port.release(rehold)` (after `port.attach`, per contract) unlatches `'not-revealed'` post-swap.
- `syncOffScreenFreeze` itself only runs at cycle boundaries **plus** every port transition — enumerated: `beginBattleCycle`, `clearCycleEntryState`, all `PresentationSession` port calls. No other path derives/removes `'not-revealed'`, so a preserved copy cannot go stale **unless** the port stops calling back — which is the ported-session contract, not a new hole.
- Double swap (C2): reason set preserved verbatim across two consecutive `setCombatClockSource` calls.

**Probes (group C, 3 tests green).**

## INT-4 — curtain watch vs boot-fail/recovery screens — VERIFIED (bounded)

**Checked:**
- `App.vue` `watch(stateVersion)` clears `useCombatPause.isPaused` when `'tab-hidden'` is absent from `getFreezeReasons()`; overlay mounts `v-if="isCombatPaused"`.
- Z-order: `OVERLAY_LAYERS.combatPause = 900 < curtain/boot-fail surface = 5000` — a stale curtain never covers the error/recovery surface; it renders **under** it.
- Tick gate: `useAppLifecycle` only calls `bumpState()` when `entryStage === 'game' && authority.canMutate()` — on boot-fail/recovery screens the 1-second tick is suppressed, but `stateVersion` still bumps on any panel mutation; worst-case lag on a screen transition is bounded by the next mutation or the re-entry into `game`.
- Post-discard re-latch: `useCombatPause.sync` checks `isCombatActive` — a discarded battle cannot re-derive `'tab-hidden'` even if the tab is still hidden.

**Probes (group D, 2 tests green):** D1 pins `OVERLAY_LAYERS.combatPause < curtain` + `App.vue` source-level watch presence; D2 stubbed-document contract — post-discard, hidden tab cannot re-latch.

**Conclusion:** the 1-tick teardown lag is cosmetic-bounded and never masks an error surface; the gate keeps the curtain a game-screen concern only.

## INT-5 — `restoreCheckpoint` discard vs mid-battle journey — VERIFIED

**Checked:**
- `EarlyGameSession.restoreCheckpoint` (:644-660): `restoreGameSession` → on `status === 'ok'` → `discardStaleBattle()` → `this.player = playerOwner.$state`. The discard is gated on a **successful** restore.
- All in-repo `restoreCheckpoint` callers enumerated: `auditR26Int`, `auditR25Int`, `MortalChapterJourney.test`, `TrucCoJourney.test` — every existing caller restores onto a **fresh** session; zero production callers (sim-only seam, as designed).
- No sim path relies on the battle surviving a checkpoint restore — a restore is a wholesale `$state` rewrite; keeping the old battle would reintroduce the ghost-battle class r36 closed at boot/reconnect.

**Probes (group E, 2 tests green):**
- E1 ok-path: session parked mid-stage (`fighting` battle + held lease + claimed-token lineage) → `restoreCheckpoint` ok → battle null, token `IDLE`, `getStageProgress()` null (lease freed), `player` repointed → `runStage('mortal_dong_1')` completes `victory` on the restored profile.
- E2 rejected-path (new this wave): incoherent save (zhou_tian past meridian gate, post-mortal realm) → `status === 'rejected'` → the live `fighting` battle object, its state, and the stage lease are **byte-identical** pre/post — the discard never fires on a no-op restore.

**Conclusion:** the discard is precisely scoped to the restore seam; the journey sim re-enters cleanly; no consumer needs the battle to survive.

## INT-6 — r36-AUT-1 bounds (ACK drain under latch) — VERIFIED

**Checked (`CombatAnimationRuntime.ts`):**
- Gate order: `isSessionBlocking()` → `!token || token !== this.playbackToken` → pending* guards. A stale/wrong-token ACK rejects at gate 2 — before any drain.
- `getPendingPlaybackToken()` is non-null iff `pendingReadyActor`/`pendingDeclaredAction`/`pendingImpact` is live — i.e., the token exists only for the **in-flight** turn's residual.
- `drainPendingPlayback` runs the residual mechanics inline then fires all three sink signals — the drain cannot exceed the residual because it is defined by it; `resetPendingState` clears the token on teardown, so a drain cannot survive a discard (post-discard `playbackToken` is null → gate 2 rejects).
- Owner bound: the token is minted per-claim on the runtime instance; a `discardStaleBattle` clears it — a replacement battle's token cannot be satisfied by the old battle's ACK.

**Probes (group F, 2 tests green):** F1 stale-token ACK on a replacement battle is rejected; F2 drain under an admin latch bounded to the in-flight residual (`drainPendingPlayback` count + no cross-owner mint).

## Residuals (non-blocking)

- **Nit — deferral-arm dead handles:** the `deferredMs < AWAIT_STEP_DEFERRAL_CAP_MS` arm re-arms a `setTimeout` without splicing the just-fired handle (the fired handle is already dead — the splice is only needed for the admin-latch arm which re-uses the array for live-timer accounting). Bound: ≤ 8 dead entries per parked step before the cap drains to `drainPendingPlayback`; `clearPendingSteps` wipes regardless. Reachable only during a parked admin latch. Not a leak — array slots, not live timers. Recommend leaving as-is; fixing would complicate the live-only invariant for zero behavioral gain.

## Files in the audit branch

- `game/docs/qa/2026-10-07-fixpoint-r37-INT.md` (this report)
- `game/src/services/save/auditR37Int.probe.test.ts` (16 tests, `// @vitest-environment node`, deterministic — `Date.now` mocked via `vi.setSystemTime`, `Math.random` pinned to 0)
