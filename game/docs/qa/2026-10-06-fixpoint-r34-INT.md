# Fixpoint r34 — INT wave audit

- **Commit audited:** `db694183` (branch `codex/hoa-cau-fireball-vfx`)
- **Role:** INT — integration coherence: do the r33 pieces still agree with each other and their consumers?
- **Probe:** `src/services/save/auditR34Int.probe.test.ts` — 14 tests, all green (`npx vitest run --pool=threads`).
- **Verdict: PASS WITH EVIDENCE — zero actionable findings at any severity.** This is the fixpoint signal.

## Attack surface and disposition

### R — post-admission combat unlatch (`bootGame` tail :729-751)

**Confirmed coherent.** Evidence:

1. **The markReady -> enterGame window is unreachable by frames.** The tail
   `authority.markReady()` -> `resumeCombat('authority-pause')` ->
   `clock.start()` -> `startTickLoop(tick)` -> `boot.enterGame()` contains no
   `await` (probe R7 pins this on source). A CombatClock only advances inside
   `onFrame` callbacks (CombatClock.ts :82-113), and the game `tick` loop does
   not exist until `startTickLoop` arms it — so **a resumed CombatClock cannot
   step before the tick loop starts**: the question in the brief answers itself,
   no frame can land between the unlatch and `enterGame`.
2. **`persistProgress` cannot observe the open gate in that window.** The gate
   at :318 is `persistenceSuppressed || entryStage !== 'game' || saveInFlight ||
   !authority.canMutate()`. Probe R1 invokes `persistProgress()` *from inside*
   `markReady` — `canMutate()` already true, `entryStage` still the interim
   surface — and the write refuses. The code itself relies on this conjunct
   (:655 comment: the firstSave path does not use persistProgress precisely
   because the `entryStage!=='game'` gate would skip it). Autosave/visibility
   listeners cannot race the window either: `startAutosave` only arms on
   'entered' (App.vue :1050) and the listeners are only attached after entry.
   Other `entryStage` readers are the App template mounts — pure rendering.
3. **Every fail arm keeps the latch.** Verified each arm reads its status and
   returns before :731: `unavailable` (:413), `deleted` (:420),
   `incompatible`/`corrupted` (:429), `pending-conflict`/`pending-quarantined`
   (:440), `empty && !createNewCharacter` (:456), restore `rejected` (:492),
   commit non-ok incl. DATA_REFUSE remote arm (:560-601), grants throw (:631),
   firstSave throw (:661) and firstSave non-ok incl. DATA_REFUSE (:684-724).
   Probes pin four arm classes end-to-end: `unavailable` was already pinned in
   r33; r34 adds `corrupted` + restore-`rejected` (R4), `require-character` (R3),
   concurrent `skipped` (R2), a throwing `coordinator.load` (R6), and a fresh
   lifecycle instance over the same GameManager (R5 — the reason lives on the
   CombatClock, not the composable).
4. **Only the named reason clears.** `resumeCombat('authority-pause')` deletes
   exactly that reason (CombatClock.resume is per-reason); user-pause/tab-hidden
   reasons are untouched — matching the :731-735 comment.

### D — inverted-pair drop parity (`restoreStates` .flatMap :158-200)

**Confirmed coherent.** Evidence:

1. **Survivor order preserved at the boundary** — a sandwiched inverted pair
   yields `[cyc_a, cyc_b]` (probe D1). (`advanceWorkerLanes` later re-sorts
   `pending` by `dueMs` — its own contract, unaffected.)
2. **No positional consumers.** The only UI reader
   (ProductionPanel.vue :154) evaluates `workerCycles.length` and
   `activeWorkerSlots` independently; `assignedWorkers` is a pool count, not a
   per-lane index; `tickWorkers` reallocates `activeWorkerSlots` fresh every
   tick (:429,:444-446). Nothing indexes cycles positionally.
3. **Drop touches only `workerCycles` entries** — `hiddenChannelCycles` clone,
   `assignedWorkers`, `activeWorkerSlots` pass through verbatim (probe D3).
4. **Boundary map exact:** `completes <= started` drops — including
   `{+Inf,+Inf}` (`Inf<=Inf` is true). A `NaN` pair and `{-Inf, t>` are *not*
   dropped — they fail the comparison and park verbatim, then the mechanism's
   `pending.some` deny + the write gate keep the documented deny residual
   (probes D2, D4). That residual is unreachable for honest saves:
   `buildProductionCycle` only mints finite stamps.
5. **Self-heal through the real path:** a site left with zero lanes and
   `autoRestart` refills on the next `tickWorkers` via `emptyLaneStartMs`
   seeding (probe D5, ProductionSystem level, not the pure function).
6. **Shifted survivors stay wire-admissible:** a post-dated pair re-anchored at
   `restoreNowMs` writes back clean (probe D6) — ordering, authored-span and
   `startedAtMs <= lastSavedAt` pins all hold after the uniform shift.
7. **Dropped lanes can never reach the wire** (already pinned in r33 C2:
   `restoreStates` output is what `buildGameSave` serializes, so the ordering
   pin never sees them).

### P — flipped-pin coherence (r32Aut :252 + r33 pins)

**Confirmed coherent.** The r33 adjudication flipped `auditR32Aut` :252 to
assert *both* directions: the restore boundary now drops the inverted pair,
and the mechanism-level ordering deny still holds for feeds that bypass
`restoreStates`. Probe P1 drives the real bypass feed —
`settleProductionOffline` over a directly-crafted states map containing an
inverted pair — and observes zero completions, zero grants, verbatim pending:
the deny survives exactly where the self-heal does not run. The two claims do
not contradict each other; they pin different seams of the same policy.

## Checked and rejected candidates (recorded, not findings)

- **Missing `cycleId` uniqueness pin (alchemy has `seenJobIds` :3715-3746).**
  Rejected: `cycleId` is minted-unique (`nextCycleId` counter+timestamp) and
  **never read anywhere** — it is a write-only identifier, so a replayed
  `cycleId` grants nothing a second crafted cycle would not already grant. The
  alchemy pin exists because a replayed job re-delivers a pill for a burned
  reservation; production cycles burn no input, so the asymmetry is
  principled. *Nit:* the field is dead weight — worth deleting or using, not
  a defect.
- **Duplicate `siteId` entries in `productionSites`** — `restoreStates`'s
  `states.set(siteId, ...)` is last-wins (overwrite, not additive), bounded by
  the lane ceiling on the surviving entry; crafted-only, deterministic. Nit.
- **`activeWorkerSlots` restore-verbatim staleness** — a UI read between
  restore and the next `tickWorkers` sees the persisted count rather than the
  recomputed one (probe D3 pins the verbatim pass-through deliberately).
  Pre-existing display-lag at most one tick; unchanged by r33. Nit.
- **Throwing `coordinator.load`** leaves the app on the loading surface with
  the latch held (probe R6): the deny direction is *consistent* with r33
  intent (frozen behind an unborn surface beats free-running); the stuck
  spinner is the pre-existing uncaught-rejection UX, unchanged by this batch.
  Nit, pre-existing.
- **Doc precision:** the r33 adjudication describes a parked out-of-domain
  pair as idling "only its own channel"; the same parked pair also refuses
  every subsequent save write through the domain pins (whole-save wedge) —
  deliberate deny, unreachable for honest saves, already an accepted residual;
  wording only. Nit.
- **`bootGame` while `entryStage==='game'`** — no caller path exists (entries
  are auth/creation surfaces only); `pauseSimulation`/`persistProgress` are
  entryStage-gated anyway. Rejected.

## Method notes

- All probes deterministic: `Date.now` mocked at `currentMs`, combat driven by
  `ManualClockSource`, deferred-load gate for the in-flight `skipped` case.
- `useAppLifecycle` deps are destructured at setup — probe mocks flip behavior
  via `mockImplementation` on the same `vi.fn` objects, not reassignment.
- Regression: `auditR33Int` (15) + `auditR32Aut` (13) still green alongside.
