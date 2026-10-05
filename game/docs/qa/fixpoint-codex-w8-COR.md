# QA Fixpoint — Wave 8 — COR (correctness) audit

**Delta under audit:** `cc4a51e7..4f456cfd` — the wave-7 adjudicated fixes
(blacklist arm + B1-D commit arm, resume-budget hardening, aborted-transition
compensation, retry-on-'failed', pin updates).

**Method:** detached worktree @ 4f456cfd, `npm ci` (node 22),
`npm run type-check` clean, `npx vitest run` over touched scopes
(services/session, services/save, composables/useAppLifecycle, presentation)
= 70 files / 1125 tests green. Every changed site read end-to-end;
EXECUTED claims backed by scratch harnesses run and deleted (never
committed).

**Verdict: 0 Critical / 0 High / 2 Medium / 1 Low / 4 Nit**

## Verified claims — wave-7 fix ledger

| # | Wave-7 fix | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | firstSave arm → NON_DATA_WEDGE_CODES blacklist {NETWORK_UNAVAILABLE, SESSION_REVOKED, AUTH_EXPIRED, PROTOCOL_OUTDATED, MAINTENANCE, CONFIGURATION_ERROR} | VERIFIED | SOURCE_PROOF + pins. Producer census: `mapError` emits only NETWORK_UNAVAILABLE/SESSION_REVOKED/PROTOCOL_OUTDATED/AUTH_EXPIRED/SERVER_ERROR; AUTH_EXPIRED variants at :516/:536; adapterThrow/staleGenerationResult emit `code: undefined`. Non-blacklisted arm set = {SAVE_INVALID, SAVE_TOO_LARGE, SERVER_ERROR, undefined} — exactly what w5aut.repro.test.ts now pins (6 no-arm + 4 arm). Save-consumed codes are typed `BackendErrorCode`; no foreign-code producer exists (reconcile `rejected` codes never reach a write result). |
| 2 | B1-D commit arm at scope 'local' (unavailable + !retryable + non-blacklisted → report + markFailed + boot.fail) | VERIFIED as coded — but see W8-COR-1 | EXECUTED. Scratch boot repro: remote-authoritative 'ok' load + `player.save` → `unavailable+!retryable+SAVE_INVALID` → `saveIssue.report('corrupted','',undefined,'local')`, `boot.fail` ×1, `onError` NOT fired, `markFailed` NOT double-fired (observeSaveResult already entered 'recovery'). Uncoded (adapter-throw-shaped) commit refuse arms too and DOES markFailed('recovery'). NETWORK_UNAVAILABLE commit → generic path, no arm. |
| 3 | markFailed('recovery') skipped only for {SAVE_INVALID, SAVE_TOO_LARGE} | VERIFIED | SOURCE_PROOF. `authorityStateForError`'s 'recovery' set ∩ reachable `unavailable` codes outside the blacklist = exactly {SAVE_INVALID, SAVE_TOO_LARGE}; CONFIGURATION_ERROR is 'recovery'-mapped but blacklisted, SAVE_CONFLICT never arrives with status 'unavailable'. The skip set is complete, no clobber. |
| 4 | resumeFailureStreak resets in beginChecking + acknowledge | VERIFIED | SOURCE_PROOF + pin (fresh-budget test). beginChecking early-returns only for ready/checking/terminal-non-recovery — 'signed-out'/'reconnecting'/'recovery' all proceed and reset. acknowledge() resets from terminal/'reconnecting'. Edge audited: a stale-generation continuation can write `streak++` after acknowledge() cleared it, but the next beginChecking overwrites — no debt escapes into a new admission. |
| 5 | Catch-path escalation gated `generation === this.generation` | VERIFIED | SOURCE_PROOF + pin (parked-then-throws stays 'revoked'). markFailed inside onResume bumps generation → catch escalation suppressed; the same fence guards markReady. |
| 6 | markReady inside try, both branches | VERIFIED | A throwing markReady (onStateChange fan-out) now counts toward the budget instead of floating an unhandled rejection (W7-AUT-4 closed). Residual micro-window: a throw mid-markReady can leave 'ready' with heartbeat unarmed — self-heals because clearRetry (last step) never ran, so the armed retry re-attempts within reconnectRetryMs → markReady re-runs. Nit-level residue only. |
| 7 | `onResume: void \| Promise<void>` awaited | VERIFIED | Awaiting widens the generation-fence window in the correct direction: a 'replaced'-lineage reject (App.vue's markFailed+report inside onResume) or a reject-then-throw keeps terminal authority. See W8-COR-3 for the local-branch re-entry the await introduces. |
| 8 | Throwing deps.reconnect shares the streak budget | VERIFIED | Outer catch `streak++` + same generation gate; deterministic thrower escalates to 'recovery' after 3 instead of churning the RPC forever. Resume-failure budget shared across pipeline+resume throws — documented intent. |
| 9 | Aborted flag = `controller.signal.aborted` captured before self-abort | VERIFIED | Capture at :487 runs before `controller.abort()` at :499; truthy only on external abort (error-route preempt :224-228, dispose :274-284). Deadline timeouts leave it falsy → compensate fires exactly for external-abort orphans, never for genuine failures (which keep the session for retry()). Compensating on dispose is the safe direction (orphan on dispose is strictly worse). |
| 10 | Catch-path curtain reopen bounded (DEADLINES.curtainOpen, fresh signal) | VERIFIED | `withTimeout(curtain.open(...), DEADLINES.curtainOpen, ..., reopenSignal)` — every await in executeTransition is now bounded → inFlightPromise settles bounded → preempt's `await inFlightPromise` and `whenIdle()` are bounded → W7-INT-3 / W7-AUT-5 starvation closed. Small residue in W8-COR-4. |
| 11 | runAdmitted compensates on 'rejected' OR ('failed' && aborted===true) | VERIFIED | `forgetSession` is a Set.delete — idempotent-safe; ordering forgetSession→compensate is right (compensate-throw still leaves dedupe cleared, matching "retry replays" semantics). behindCurtain never ran → `accepted` null → no false compensate. Genuine 'failed' keeps the session for the error card's retry() — re-request replays the domain command, superseding the orphan. |
| 12 | useBootFlow.fail() retries 'rejected' OR 'failed', bound 10 | VERIFIED | Error-route requests are never aborted and never rejected-for-preemption-except-during-another-error-transition; a wedged error mount retries 10× then breadcrumbs — bounded, no forever loop. Worst case ~10 × transition window (~2–4 min) of curtain churn on a deterministic error-mount thrower before the breadcrumb — acceptable, Nit-noted. |
| 13 | Pin updates (w5aut parametric split; OnlineSessionController streak/generation pins; onResume mock → void) | VERIFIED | Pins assert the right edges; suite green. BUT the flagship commit arm itself is unpinned → W8-COR-2. |

## Findings

### W8-COR-1 — B1-D commit arm mounts a recovery surface whose only remedy is a destructively-labelled no-op loop

**Severity: Medium**
**Class:** COR (remedy/contract honesty)
**Evidence:** EXECUTED + SOURCE_PROOF

**Mechanism.** The arm (`useAppLifecycle.ts:546-560`) reports
`saveIssue.report('corrupted', '', undefined, 'local')` for a permanent
data-class refuse on the post-accrual commit. On SaveIncompatibleScreen at
scope 'local' + remote-authoritative mode, the three affordances render as:

1. **Export — hidden.** `v-if="saveIssue.raw"` and the arm passes `raw: ''`.
   The arm's own comment claims "the export affordance preserves what the
   accrual produced" — false: the refused commit payload (the only bytes
   that matter for salvage; the player's accrued state) is never captured
   into `raw`. Comment and code contradict.
2. **Import — no-op.** `handleImport` branches on `remoteAuthoritative`
   (not scope): validate + re-export a download only; it writes nothing to
   remote or local. It cannot heal this failure shape at all.
3. **"Delete & Start Over" — loops.** Confirm copy: "Delete the current
   save and start a new character — this cannot be undone." What it
   actually does: `deleteSave()` clears SAVE_KEY + journal/acked-cache/
   quarantine envelopes + reload. The commit payload is
   `buildGameSave(player.$state)` — recomputed from the remote head +
   offline accrual, never from those envelopes (verified: `load()` on 'ok'
   resolves/quarantines the journal before restore; the pending payload
   cannot reach the commit bytes). A deterministic SAVE_INVALID /
   SAVE_TOO_LARGE / SERVER_ERROR refuse therefore re-derives identically
   → same arm → same screen. The arm's comment asserts the reset
   "self-heals to the healthy remote head" — that is false for its
   primary intended class.

**EXECUTED repro (scratch, deleted after run):** two sequential
`bootGame({createNewCharacter:false})` runs with remote-authoritative 'ok'
load + deterministic `SAVE_INVALID` commit refuse fire the identical arm
(`report('corrupted','',undefined,'local')` + `boot.fail`) both times —
the second run simulates post-`deleteSave()` reload; nothing the user can
click changes the outcome.

**Trigger:** any permanent data-class refuse on the commit — RPC
payload-refuse (SAVE_INVALID/SAVE_TOO_LARGE), unrecognized/authority
SERVER_ERROR (400/4xx refuse classes), or uncoded adapter faults
(`SAVE_ADAPTER_THROW`, and latently `STALE_GENERATION` — unreachable on the
boot-commit path today since no concurrent save caller exists, but the arm
would fire for it if one ever races).

**Impact.** The user is permanently wedged either way (the pre-arm generic
card was equally terminal for this class), so this is not a regression of
recoverability — it is a surface that (a) misdiagnoses a WRITE refuse as
read-corruption/incompatibility while the remote head provably loaded,
(b) offers one destructive-looking action whose "cannot be undone / start
a new character" copy is false — it deletes nothing the commit consumes
and never starts a new character, and (c) withholds the export the arm's
own comment claims to provide. Same lying-surface class as W5-COR-2
(confirm dialog asserting the opposite of behavior → Medium).

**Fix direction.** Pass the refused commit payload as `raw` (the accrued
snapshot exists — it is exactly what was refused) so Export delivers the
salvage the comment promises; rename the failure shape honestly
(write-refuse, not read-corruption); and either offer the remote reset as
an explicitly-labelled last resort ("the server refuses this save data —
delete cloud save and restart" loses the character, but is the only heal
for a deterministic payload refuse) or drop the local-reset button for
this arm, since it provably cannot heal what it claims to delete.

### W8-COR-2 — the wave-7 flagship commit arm has zero behavioral pins

**Severity: Medium**
**Class:** COR (coverage)
**Evidence:** EXECUTED (grep census + the scratch repro above functions as
the missing pin)

The new arm at `useAppLifecycle.ts:546-560` — the headliner W7-COR-1 fix —
is asserted by no test. The only boot-commit test uses `status:'conflict'`
which never reaches the arm; w5aut.repro.test.ts pins only the firstSave
arm. A silent regression here (arm unwired in a refactor) restores the
permanent account wedge the wave set out to close, with no red test.

**Fix direction:** commit the repro shape — remote-authoritative 'ok' load
+ `player.save` unavailable+!retryable per armed code
{SAVE_INVALID, SAVE_TOO_LARGE, SERVER_ERROR, undefined} → assert
`report('corrupted','',undefined,'local')` + `boot.fail` + no `onError` +
markFailed skip for the payload pair; plus one blacklisted-code
commit-refuse asserting the generic path.

### W8-COR-3 — local-mode `attemptReconnect` never arms `reconnectInFlight`; the new `await` makes resumeFromSuspend re-entrant

**Severity: Low**
**Class:** COR (re-entrancy contract)
**Evidence:** EXECUTED_REPRO (scratch, deleted after run)

`attemptReconnect`'s top-level `if (this.reconnectInFlight) return` guard
covers both branches, but the flag is only set in the remote branch — the
local branch (`!deps.reconnect`, :463-485) runs `await onResume?.('same')`
with it still false. Since wave 7 widened `onResume` to
`void | Promise<void>` and awaits it, the state stays 'reconnecting'
through the await window — even for a synchronous onResume (`await`
suspends to a microtask before `markReady`).

**Executed:** two `resumeFromSuspend()` calls in that window → `onResume`
invoked twice; with an async onResume, two restores run genuinely
concurrently (max concurrency 2 measured). `resumeFromSuspend` is driven
by the Electron bridge's suspend/resume OS notifications — burst-capable.

**Impact today:** dormant. Shipped onResume is synchronous; its effects
are `AUTH_RESUMED` diagnostic (double-logs) + `resumeSimulation()` which
is `simPaused`-guarded and no-ops on the second call. No save/suspend
double-commit path exists in local mode (observeSaveResult early-returns
without deps.reconnect).

**Fix direction:** set `reconnectInFlight` around the local branch too
(one flag, same semantics — the contract now admits Promise-returning
onResume, so the missing guard is live for the widened contract).

### W8-COR-4 — Nit: catch-path reopen's fresh AbortController is dropped; a hung `curtain.open` leaks its signal listeners

`GamePresentationCoordinator` catch path creates
`new AbortController()` and keeps only `.signal`; on a curtainOpen
timeout, `withTimeout` rejects but nothing can abort the signal → the
hung promise's abort-listeners leak forever. Bounded (the wedge itself is
closed); fix by keeping the controller ref and aborting on timeout.

### W8-COR-5 — Nit: `fail()` worst case is ~10 retry cycles of full transition duration before the breadcrumb

A deterministically-throwing error-port prepare now burns up to ~10 ×
(curtainClose + deactivate + prepare + reopen windows) of curtain churn
behind the generic card before `console.error` breadcrumbs. Bounded and
intended (resilience for transient mount failures); noted only as a
latency ceiling.

### W8-COR-6 — Nit: direct `coordinator.request()` callers with domain-bearing `behindCurtain` get no compensate-on-abort

`exitCombatToHome` (`useBattleActions.ts:121`) bypasses runAdmitted: its
behind-curtain teardown (`abandonBattle` + `combat_scene_exit` emit) can
deliver before an error-route abort lands → 'failed' aborted with no
compensator → combat scene live while the domain battle is already torn
down. Bounded: the teardown is idempotent and retry() re-issues the same
request, converging to 'home'. Residual of the runAdmitted-only
compensation contract — worth a comment, not a fix.

### W8-COR-7 — Nit: throw-path residues around the new try scopes

- A throwing `onPause`/`onStateChange` inside the outer catch's
  `markFailed('recovery')` → `enterTerminal` → can still float a
  rejection (narrowed W7-AUT-4 residue; requires the notification dep
  itself to throw deterministically, and the escalation caps the churn).
- A `markReady` throw mid-fan-out leaves 'ready' with heartbeat unarmed —
  self-heals via the still-armed retry (clearRetry is markReady's last
  step), so the window is ≤ reconnectRetryMs.

## Notes for adjudication

- The two Mediums are the same wedge viewed twice: the arm is correct as
  wired (W8-COR-1's complaint is the remedy surface it points at, and the
  arm's own comments overclaim what 'local' delivers); W8-COR-2 is the
  missing pin that would have caught a silent un-wiring.
- No Critical/High: nothing in the delta wedges a NEW path, destroys
  data, or regresses a shipped flow. The 'local' scope's remote-reset
  withholding is doctrinally correct; the deficit is that nothing
  workable is offered in its place for the deterministic class.
