# Fixpoint adjudication — wave r33

Base audited: `a014b7fb` (r32 adjudication tip). Auditors: COR / AUT / INT
(blind trio). Adjudication commit: this commit.

## Wave verdicts

| Auditor | Verdict | Findings |
|---|---|---|
| COR | FAIL | 0 Medium + 1 Low + 6 Nit |
| AUT | FAIL | 1 Medium + 1 Low + 2 Nit |
| INT | FAIL | 1 Medium + 0 Low + 3 Nit |

## Fixed

### R33-INT-1 == R33-AUT-1 (Medium) — `resumeCombat('authority-pause')` ran before boot admission was proven

Both auditors independently pinned the same defect, introduced by the
r32-INT-1 fix. The two-part pause latch (`simPaused` flag + the
CombatClock `'authority-pause'` reason) was being cleared at `bootGame`
ENTRY — before `authority.beginChecking()`, before `await
coordinator.load()`, before every failure branch. Consequences probed by
both auditors:

- FAIL leg: a terminal pause -> acknowledge -> re-auth whose retry load
  fails mounted the terminal error card over a RUNNING battle —
  `pauseSimulation` early-returns while `entryStage !== 'game'`, so no
  seam could re-latch it (the r30-INT-1 "combat behind the terminal
  card" class re-opened on the retry-fail edge).
- SUCCESS leg: the clock was already `running` inside the awaited
  `coordinator.load()` — RAF/main-process frames could step the
  in-flight battle on PRE-restore objects, and a settle inside the
  commit window could desync post-restore state.

Fix (INT's suggested direction): the `simPaused = false` re-baseline
stays at entry (it must — a stale flag would make the next
`pauseSimulation` a dead no-op), but `resumeCombat('authority-pause')`
moved to the success tail — right after `authority.markReady()` and
before `clock.start()`/`boot.enterGame()`. Every fail arm above it now
keeps the reason latched; a successful re-boot still clears it, which is
exactly the r32-INT-1 intent (`useAppLifecycle.ts:346` re-baseline +
:731-736 post-admission clear).

Probe flips: `auditR33Int.probe.test.ts` R1/R2/R3 now pin the deny
(failed boot keeps `['authority-pause']` + frozen + zero steps on
advance; frames inside the load window step nothing; source pin asserts
the unlatch sits AFTER `markReady()` and before `enterGame()`); R4
contrast pin (successful boot clears the latch) unchanged.
`auditR33Aut.probe.test.ts` A/B flipped the same way.

### R33-COR-F1 == R33-AUT-2 (Low, converged on by two blind auditors) — inverted workerCycle parked verbatim wedged the site and every later write

`restoreStates` parked inverted cycles verbatim while `restoreJobs`
dropped them. A crafted inverted `workerCycle` then (a) froze its whole
site's advance — the `pending.some` ordering deny takes every healthy
sibling lane with it — and (b) self-refused every later save write on
the ordering pin (`SAVE_INVALID`, non-retryable, whole-save wedge).

An inverted pair is impossible-authored, so dropping loses no semantics.
`restoreStates` now drops `completesAtMs <= startedAtMs` at the
boundary, mirroring `restoreJobs` exactly
(`ProductionSystem.ts:159-170`): the poison never reaches live state, the
site self-heals, and the next write validates. Out-of-domain stamps
still park verbatim (the r31 deny doctrine — a parked far-future due
idles only its own channel; semantically defensible and unchanged).

Probes flipped in all three files — COR A1/A2/A4, AUT D1/D-wire, INT
C2-1 — plus the r32 AUT pin (`auditR32Aut` :252 now pins the drop at
restore plus the mechanism-level ordering deny for direct feeds).

## Adjudicated exceptions

| ID | Sev | Disposition |
|---|---|---|
| R33-INT-2 | Nit | EXCEPTION. `setCombatClockSource` -> `combatClock.stop()` clears the whole reason set, so a mid-pause source swap would drop 'authority-pause'/'user-pause'. Unreachable: production calls it once at App.vue mount before any battle exists; there is no mid-pause source-swap caller (census: one callsite). Recorded so a future caller knows the latch is not preserved across swaps. |
| R33-INT-3 | Nit | EXCEPTION. Writer classifies the TLT ceiling on `effectGroup`, the validator enters the TLT branch on `sourceItemId === 'tu_linh_tran'` + a separate group pin. The key mismatch can only NARROW a writeable shape (crafted TLT-source/foreign-group records get the generic `2^52-1` ceiling but are refused at admission on the group pin anyway); the reverse over-clamps harmlessly. Deny-only divergence. |
| R33-INT-4 | Nit | EXCEPTION. Dual span-source contract: internal cursor dues chain off the caller `cycleMs` while the persisted head mints the authored span. Pre-existing (r32 only aligned the headroom denominator); both live callers pass the coherent pair, so only a hypothetical third caller sees the split. The persisted stamp stays in-domain via `mintedSpanMs`. |
| R33-COR-F2 | Nit | EXCEPTION. `advanceWorkerLanes` mints non-stamp fields caller-trusted — crafted `siteLevel: NaN` / `rng() = 1.5` / realm↔baseSeconds incoherence mints records the write gate refuses. Real callers pass coherent params (`state.level` integer-pinned, `sessionRng` ∈ [0,1), realm-keyed base) — latent caller-contract gap only, same class as the r32 COR-F5 residual. |
| R33-COR-F3 | Nit | EXCEPTION. `DecomposeSystem` `options.cycleSeconds: NaN` → `this.cycleMs = NaN` → NaN `nextCycleAt` wedges the write gate. Constructor-crafted only — production constructs `new DecomposeSystem(this.materialBag)` with no options (constant 30_000). |
| R33-COR-F4 | Nit | EXCEPTION. `TribulationDirector.restoreRuntime`: `slice?.cooldownUntil ?? 0` doesn't catch `NaN` → NaN rides live state and `getCooldownSeconds` opens the gate on a crafted feed. Not a write wedge (`serializeRuntime`'s `>0` gate drops it); admission pins `cooldownUntil` non-negative bounded, so crafted-feed only. |
| R33-COR-F5 | Nit | EXCEPTION. `applyTimedEffect` merge arms trust `existing.expiresAtMs` finite — a planted NaN live expiry propagates into a persisted NaN wedge. Unreachable via a validated save (admission pins every expiry finite); the NaN must be planted in live state — the live-trust boundary the merge arms always had. |
| R33-COR-F6 | Nit | EXCEPTION. Push arm can emit a TLT record with `expires < applied` (crafted caller only — both real writers emit `expires > applied`). Dead-on-arrival: `tickTimedEffects` drops it the same tick; the wedge is sub-tick-transient at most. |
| R33-COR-F7 | Nit | EXCEPTION. TLT `expiresCeiling` anchors at apply-time `Date.now()` + slack while the write pin anchors at `lastSavedAt` + slack — a ceiling-claimed expiry overshoots the pin only under a backward wall-clock jump between apply and write AND a crafted max claim. Honest expiries carry ~7d of slack. |
| R33-AUT-3 | Nit | EXCEPTION. `advanceWorkerLanes` trusts caller `cycleMs`/authored coherence — a hypothetical incoherent caller mints instant full-authored-span completions. Both real callers (`tickWorkers`, `settleWorkersOffline`) pass the coherent `computeCycleSeconds` pair; no reachable defect. Same note as R33-INT-4. |
| R33-AUT-4 | Nit | EXCEPTION. `pending.some(cycle => cycle.completesAtMs ...)` dereferences entries without an object-shape check — a raw non-object `pending` array throws TypeError. Admission pins every entry `isObject` and `restoreStates` is only fed validated data; ungated-feed-only TypeError paths are the standing accepted class. |

## Verification (this commit)

- `npm run type-check` — clean.
- `npx vitest run src/services/save src/core/production --pool=threads` —
  1767 green.
- `npx vitest run src/composables src/core --pool=threads` — 5115 green.
- `npx vitest run tests/architecture --pool=threads` — 995 green
  (P15 ASCII ratchet included).
- `npx eslint` on touched files — clean.
- R33 probes: INT 15/15, AUT 16/16, COR 50/50 — all deny-pins
  post-flip.
