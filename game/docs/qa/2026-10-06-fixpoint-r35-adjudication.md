# Fixpoint r35 — adjudication

Wave r35 blind audit of r34 adjudication commit `b1ffef6c`
(`codex/hoa-cau-fireball-vfx`). Auditors: COR / AUT / INT.

## Verdicts

| Role | Verdict | Findings | Report |
|------|---------|----------|--------|
| COR | FAIL | 0C / 0H / 1M / 1L / 2N | `2026-10-06-fixpoint-r35-COR.md` |
| AUT | FAIL | 0C / 1H / 1M / 0L / 0N | `2026-10-06-fixpoint-r35-AUT.md` |
| INT | FAIL | 0C / 0H / 1M / 0L / 1N | `2026-10-06-fixpoint-r35-INT.md` |

## Fixed

### F1 — 'replaced' reconnect-resume resurrects the ghost battle (r35-COR-F1 Medium + R35-INT-1 Medium — two auditors converged on the same seam)

Sibling seam of r34-COR-F1 the boot discard did not cover:
`OnlineSessionController.attemptReconnect` → `App.vue` `onResume`
`('replaced', save)` → `restoreGameSession` rewrites `player.$state` in
place (deleteProperty sweep + Object.assign — same object identity) →
`resumeSimulation()` clears `'authority-pause'` and the pre-pause frozen
battle resumes into the replacement character's content: kills bank into
the restored bag, the dead stage lease keeps auto-farming. Reachable in
remote-authoritative mode via a designed path — mid-battle authority
pause + remote head advance during the pause (second device / replayed
journal). Strictly more reachable than r34-COR-F1: no row deletion or
character creation needed.

Fix: `App.vue` `onResume` 'replaced' && save arm calls
`gameManager.discardStaleBattle()` after a successful restore (the
rejected arm still markFailed + bootFlow.fail + returns without
unlatching — unchanged), before `lifecycle.resumeSimulation()`. Silent
teardown, no terminal, no banking — identical primitive to the boot-path
discard. The 'same' lineage arm rebinds nothing and keeps resuming the
legitimately-owned battle (probe control).

### F2 — per-battle machinery outlives the discard (r35-COR-F2 Low + R35-INT-2 Nit — converged)

`discardInFlightBattle` cleared every binding but left the minted
per-battle machinery mounted: `turnRuntime`, `battleBuffRegistry`,
`combatScheduler`. `getBattleBuffs(entityId)` then answered dead-entity
data (stale-read leak; every write path was already `turnBattle`-guarded
so no write leak existed). Fixed: the three fields are cleared in
`discardInFlightBattle`. `turnBattleSystem` intentionally stays — it is
the permanent engine-owned instance (ctor + per-session re-mint), not
per-battle state. `combatRng` likewise stays (non-nullable, re-minted per
cycle; all its readers run only under a live battle).

### F3 — rationale wording (r35-COR-F3 Nit)

The r34 comments said the bind paths "rebind `player.$state` wholesale";
the mechanism is in-place mutation (`Object.assign` + delete sweep on the
same store object). Comments in `useAppLifecycle.ts` and `App.vue`
reworded — the observable effect is identical (bindings point at the very
object whose contents the new owner now owns), which is why the ghost
stays live at all.


### F4 — wall-clock fallback bypassed the CombatClock latch (r35-AUT-1 High)

`awaitStep`'s `setTimeout` fallback (ANIMATION_FALLBACK_MS=4000, deferral
cap 8x) drove `driveStepWork` without ever consulting the CombatClock:
a ghost parked mid-turn kept draining on real time while the boot awaited
a remote commit (or any authority pause), and its terminal mints landed
on whichever character the rebound `player.$state` now owned — the same
rebind window as F1, reachable without any unlatch at all. Two gaps
closed at the top of the fallback closure:

1. Dead-battle drop: `turnBattle === null` / terminal state / clock
   'stopped' → clear the parked settle and return (the discarded ghost
   can no longer settle post-teardown).
2. Administrative-latch gate: any freeze reason outside the pipeline's
   own pair parks the step (re-arm, no `deferredMs` growth) until
   released. Exempt by design: `'turn-in-flight'` — the token claim the
   fallback exists to unblock — and `'not-revealed'` — the presentation
   session's hold, owned by the deferral arm below whose 8x cap-drain
   still completes held turns mechanically (pins kept green).

### F5 — a latched ghost's restart erased 'authority-pause' (r35-AUT-2 Medium)

`settleCombatOutcome` victory + `repeatContinuously` + live lease →
`restartTurnBattleCycle` → `beginBattleCycle` step 7 ran
`combatClock.stop() + start()` — `stop()` clears the whole reason set,
so the restart erased 'authority-pause' (and 'user-pause'/'tab-hidden')
and left the zombie cycle RUNNING behind a failed boot's error surface,
where `pauseSimulation` can never re-latch. Fixed: snapshot
`getFreezeReasons()` before `stop()`, re-`freeze()` each reason after
`start()` — the cycle's own latches ('turn-in-flight' is cleared and
re-claimed by the new turn anyway) and `syncOffScreenFreeze()`'s
'not-revealed' re-derivation are unaffected.

## Exceptions (recorded, not fixed)

| Finding | Severity | Reason |
|---------|----------|--------|
| r35-COR-F4 — dangling post-discard internals (battleLoot session, rewardOps flags, combatRng stream, detach wirings, lastStageEnemyTemplate, generation counters) | Nit | Each is write-guarded (`processDefeatedEnemies`/`grantTurnBattleRewards` gate on `getTurnBattle()`), reset at the next `beginBattleCycle`, or inert on an empty surface. No reachable reader — the auditor lists them only so future waves don't re-audit. |
| r35-INT-2 residual (`turnBattleSystem`/`combatRng` kept mounted) | Nit | By design — engine-owned, session-lifetime objects, not per-battle; every read is `turnBattle`-guarded or returns an empty value. |

## Probe flips (pins updated to the new contract)

- `auditR35INT.probe.test.ts` A1 — models the fixed arm
  (restore → `discardStaleBattle()` → `resumeSimulation()`): asserts
  'stopped', null battle, `[]` reasons, null stageProgress, zero combat
  steps, and a fresh battle minted on the rebound character runs clean.
- `auditR35COR.probe.test.ts` D1 — same arm through the real
  `OnlineSessionController` reconnect pipeline: ghost dies before the
  unlatch; no stones bank into char B's bag.
- `auditR35COR.probe.test.ts` E — pins the F2 fix: `getBattleBuffs`
  returns `[]` post-discard; `getTurnBattleSystem` still returns the
  engine-owned system.
- `auditR34Aut.probe.test.ts` A1/B1 — pre-discard pins written against
  `db694183` updated: an 'entered' boot is now battleless ('stopped',
  `[]` reasons) instead of 'running'/'frozen'.
- `auditR35AUT.probe.test.ts` section B (5 tests) — the parked-pipeline
  contract: authority-paused ghost parks across 10x fallback ticks and
  completes only after `resumeCombat`; terminal ghost can never reach
  victory (no mint/event, latch intact); repeat ghost can't self-unlatch;
  rebind-window mint denied; control test keeps the honest
  turn-in-flight-only fallback path green.
- `auditR35AUT.probe.test.ts` C3 — the remote-commit-leg mint window
  flips to deny: ghost parks through the whole commit dwell, discard
  runs on entry, rebound character mints nothing.
- `auditR35AUT.probe.test.ts` C6 — failed-boot running zombie flips to
  the frozen-zombie pin: kept battle stays 'frozen' with
  'authority-pause' intact, no mint, no restart.

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save src/core/game tests/architecture
  --pool=threads` — 3753 passed / 11 expected-fail / 12 skipped
  (0 failures; includes the 17 flipped AUT probes and the 5 cap-drain
  pins preserved by the 'not-revealed' exemption).
- `npx eslint` on every touched file — 0 errors (2 pre-existing
  `vue/one-component-per-file` warnings in `useAppLifecycle.test.ts`).
- P15: all new comments plain ASCII.

## Loop status

Wave r35 reported actionable findings — the fixpoint loop continues:
wave r36 audits the r35 adjudication commit.
