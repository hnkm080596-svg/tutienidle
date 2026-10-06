# Fixpoint r26 — INTEGRATION/COHERENCE audit

**Audited commit:** `8f3cb237` (r25 adjudication batch + wire-form gate follow-up)
**Scope:** the assembled system around `driveSave`'s write-side gate — write-path coverage, generation fencing, restore-side heal coverage, authority-degrade consistency across seams, and the gate's warn/result contract vs every caller.
**Probe evidence:** `src/services/save/auditR26Int.probe.test.ts` — 17 tests, all green (`npx vitest run ... --pool=threads`).

## Verdict

**FAIL** — 1 High, 1 Medium, 2 Low, 3 Nit. The gate itself is correctly placed and its invariants hold (single funnel, correct fencing, slot-survives deny); the actionable defect is what the refusal does downstream: the envelope it mints cannot reach any recovery surface, converting a loadable save into a permanent wedge.

## Invariant ledger

| Invariant | Result | Evidence |
|---|---|---|
| Every write to the slot passes `validateGameSaveShape` on the wire form | CONFIRMED | `save()` funnels inflight + join-or-displace queue + promotion into `driveSave`; conflict retry resyncs then re-`service.save`s the SAME already-gated snapshot; `resetCharacter` is a delete, not a write; `LocalCloudSaveService.save` and `SupabaseCloudSaveService.save` are reachable only through the coordinator; `importSaveRaw` and `adoptCommittedPending` carry their own stricter gates; `restoreBackup` deliberately ungated (r25 adjudication). Probe seam (a). |
| Stale-generation queued writes never reach storage or the gate | CONFIRMED | `save()` promotes with `entry.generation === this.generation ? driveSave : staleGenerationResult`; `reset()` drains with `STALE_GENERATION`. Probe: queued invalid snapshot + `reset()` resolves `STALE_GENERATION`, `service.save` called once (inflight only). |
| Restore-minted cursors clamp at `Date.now()` | CONFIRMED | `settleNowMs`, `offlineSinceMs` (new third operand), `effectProvenanceMs`, `boundTimedEffectClocks.appliedAtMs`/dead-arm `expiresAtMs`, quest `lastDailyResetAtMs`, autoFarm `lastCheckedMs` (via `settleAutoFarmOffline(player, 0)` on every armed restore — clamps `> now` to `now`). Probe seam (d) test 2. |
| Verbatim-restore channels that carry `lastSavedAt` pins can never produce a gate-passing write while post-dated | CONFIRMED (by design) | workerCycles `startedAtMs > lastSavedAt` pin :3503, alchemyJobs :3736, `tribulation.cooldownUntil <= lastSavedAt + 300s` :4546. Consistent deny: stamps preserved, slot safe — but see R26-INT-01/02 for what the deny does to callers. `decompose.nextCycleAt` is verbatim+unpinned (safe — prior round note confirmed). |
| Absent-authority degrade is deny-direction on every seam | CONFIRMED | `useAppLifecycle` :458-477 mints `{kind:'live-replacement', nowMs: Date.now()}`; `sanitizeRestoreAuthority` whitelist degrades foreign kinds to the same; `App.vue` resume seam mints `{kind:'live-replacement', nowMs: serverAuthority?.serverNowMs ?? Date.now()}` (server stamp when present, wall-clock deny when absent); `EarlyGameSession.restoreCheckpoint` supplies no authority → legacy client window — correct for a local-only simulation harness that never binds remote authority. Probe seam (f). |
| No caller deadlocks or double-writes on 'unavailable' | CONFIRMED | `persistPlayer` toasts once; `useUpdates`/`useElectronBridge` flushes report FLUSH_FAILED and proceed; `observeSaveResult` no-ops locally, pauses remotely; queued resolvers all settle (shared result); conflict retry writes the same snapshot once. No double-write path found. |

## Findings

### R26-INT-01 — High — The gate's refusal envelope cannot arm any recovery surface; a consistent +Δ remote save wedges boot forever with no reset affordance

**Class:** write-gate contract defect (refusal envelope vs downstream arms).

**Chain:**
1. A consistent `+Δ` payload reaches the remote head (crafted file imported on one device then synced, or an honest write minted while the device's clock was ahead — the remote tier is exactly the multi-device seam where clock-skewed writes arrive). `+Δ` here means every persisted stamp shifted together — internally consistent, so `validateGameSaveShape` and `isSaveAcceptable` both pass.
2. Next boot, remote-authoritative: load → 'ok' → `restoreGameSession` restores deadline channels verbatim → `player.save()` → `driveSave` wire-validates and refuses: `{status:'unavailable', detail:'OUTGOING_ADMISSION_REJECTED', retryable:true, code:undefined}`.
3. `authority.observeSaveResult(commit)` runs first — `code:undefined` → `authorityStateForError(undefined)` → 'reconnecting' → `pause('save-failed')` (transient classification for a deterministic, never-succeeds-on-this-payload refuse).
4. The refuse arm at `useAppLifecycle.ts:567-582` requires `!commit.retryable && commit.code && DATA_REFUSE_CODES.has(commit.code)`. The gate's refusal has `retryable:true` and **no `code`** — the arm can never fire. Falls to generic `onError(commit.message)` + `boot.fail()`.
5. Result: every boot fails with a generic error. `SaveIssueScreen` (the only surface that can remote-reset or export the refused payload) is never mounted — it requires `saveIssue.report`, which lives inside the arm that can't fire. The arm's own comment (:551-567) describes this exact wedge for server-side refuses — the gate mints the same wedge shape with an envelope the machinery can't see.
6. While `Δ` persists, `observeSaveResult`'s 'reconnecting' also arms heartbeat retry churn behind the fail screen (reconnect pipeline is load+resume only, never re-saves — so reconnects succeed, then the NEXT save refuses again; bounded churn, no deadlock, no double-write).

**Reachability:** crafted `+Δ` payload via import→remote sync (deterministic — probe-verified end to end at the coordinator boundary), or a real-world clock-ahead write on one device later read on another. Same reachability profile as the r25-INT-01 class the batch closed.

**Why the batch cannot see it:** the gate was added inside the adapter boundary and deliberately returns the coordinator's local `detail` vocabulary (`OUTGOING_*`), not the Supabase `code` vocabulary the recovery arms pattern-match (`SAVE_INVALID`/`SAVE_TOO_LARGE` + `retryable:false`). `retryable:true` is honest for the *write* (wall-time decay eventually admits it) but wrong for the *boot commit* — the accrual write can never be re-issued, and nothing routes the refusal to the surface that owns its resolution.

**Suggested direction:** either (a) mint a `code` for gate refusals that the DATA_REFUSE arms know (add the outgoing detail to the data-refuse vocabulary at :567/:690, or map `OUTGOING_ADMISSION_REJECTED` → 'recovery' in `authorityStateForError`), or (b) pass a dedicated classification the boot arms read. The semantics need a decision: for the in-session autosave caller `retryable:true` is correct (Δ decays → write succeeds); for the boot-commit caller the same refuse is terminal-per-boot and needs the recovery surface — the arm may want to key on `detail` rather than relying on a code that conflates retry semantics.

**Probe evidence:** seam (c) — the refused result asserts `code === undefined`, `retryable === true`, `detail === 'OUTGOING_ADMISSION_REJECTED'`; the replicated arm predicate `!retryable && code && DATA_REFUSE_CODES.has(code)` evaluates false; `authorityStateForError(undefined) === 'reconnecting'`. Seam (d) — the consistent `+Δ` payload passes admission, restores verbatim, and the repacked write is refused before `service.save`.

---

### R26-INT-02 — Medium — Local tier: a consistent +Δ save boots into a session that can never persist anything (and the export escape is gated on the refused save)

**Chain:** consistent `+Δ` local save → `loadGame` 'ok' (shape is self-consistent — the boot gate can't see clock skew) → enters game → every subsequent write refused: 15s autosave, manual `handleSave`, quit-flush, `useUpdates` install flush, and `handleExport` (which `await player.save()` first — refused → 'exportFailed' toast → the live-state export never runs). The healthy old slot stays untouched (gate works), but the session accrues zero durable progress; the only signal is a repeating saveFailed toast.

**Recovery:** `Δ` decay heals it (bounded for small skews); Settings → reset character is the destructive un-wedge (`handleReset` → `SAVE_RESET_REQUEST_EVENT` → `deleteSave` + coordinator reset). Import of a stamp-fixed file also heals. So local has a recovery affordance, unlike the remote arm — Medium.

**Reachability:** `importSaveRaw` accepts a consistent `+Δ` file (shape + acceptance only, no clock checks — verified :763-771), or a write minted while the local clock ran ahead.

**Probe evidence:** seam (d) — `LocalCloudSaveService` end-to-end: healthy write commits, `+Δ` restore → repack fails validation → coordinator refuses → `SAVE_KEY` bytes unchanged.

---

### R26-INT-03 — Low — In-session arrival of a post-dated remote save produces a reconnect flap (deterministic refuse classified transient)

**Chain:** mid-session remote 'replaced' event → resume restores a `+Δ` payload verbatim → next write refused → `observeSaveResult` → 'reconnecting' → `pause` + retry → reconnect pipeline (auth→heartbeat→load→resume, never re-saves) → 'ready' → next write refused again → flap until wall-time `Δ` decays or the user leaves. Bounded churn, no deadlock, no double-write — but a deterministic data-class refuse is being driven through the transient state machine, so the session can flap indefinitely for large `Δ` instead of surfacing the data problem.

**Reachability:** requires the remote head to change to `+Δ` mid-session (cross-device write from a clock-ahead device, or the user's own skewed write from a previous session). Narrower than INT-01 because the boot path is the primary entry.

**Suggested direction:** same envelope fix as INT-01 would resolve this arm too — a `code`/`detail` the authority layer recognizes as data-class could go terminal 'recovery' instead of 'reconnecting'.

---

### R26-INT-04 — Low — ID_COLLECTION_CAP missed the remaining record walks (crafted-collection walk inflation survives on 5 channels)

**Chain:** the batch capped `requireArray`/`optionalArray` + `nodeLevels`/`nodeOneShotGrants`/`perfectClearSeconds`, but these walks still run unbounded `Object.entries`/`.every`:
- `player.hiddenBeastKills` (:2359, via `validateNonNegativeIntMap` :535 — no count check)
- `player.productionSites[].hiddenChannelCycles` (:3569, same helper)
- `player.nodeFreePurchaseRecord` (:2269)
- `player.skillCastCounts` (:1858-1878)
- `player.nodeOneShotGrants[].learnedSkillIds` (:2294 `.every` inside the capped parent)

A crafted payload with 2000 valid entries in each passes admission and the write gate — then every autosave re-walks all entries (the gate made the wedge per-write, not just per-boot).

**NOT a sibling:** `talentLevels` — probe-verified the `selectedTalentIds` ownership pin (:806-812) rejects level entries for unowned ids, and `selectedTalentIds` itself is capped ≤1024 — the record is indirectly bounded. `baseStats` keys are whitelisted at restore (crafted keys never reach the next write).

**Reachability:** crafted payload only; self-inflicted CPU burn per validate. No honest path to inflation.

**Suggested direction:** one `Object.keys().length > ID_COLLECTION_CAP` guard inside `validateNonNegativeIntMap` covers two channels; the three remaining records need per-site guards (or a shared `requireRecord` helper alongside the array helpers).

**Probe evidence:** seam (e) — 2000-entry crafted records validate `ok:true` on all four flat channels plus the two nested walks; the three capped controls still reject at 1025; `talentLevels` rejects via the ownership pin.

---

### R26-INT-05 — Nit — `OUTGOING_UNSERIALIZABLE` is unreachable from production

`player.save()` passes `buildGameSave($state, manager)` output — `buildGameSave` already runs `detachSaveValue` (JSON round-trip) on every channel, so the object handed to `coordinator.save` is definitionally serializable. The `try/catch` around `JSON.parse(JSON.stringify(snapshot))` fires only for a caller that bypasses `buildGameSave` (tests, future direct callers). Contract is correct (`retryable:false` — deterministic refuse); the arm is defensive-only.

**Probe evidence:** seam (b) — BigInt field → `OUTGOING_UNSERIALIZABLE`, `retryable:false`, `service.save` untouched; NaN → wire `null` → refused (confirms the wire form is what is judged); `version: undefined` dropped on the wire → refused.

---

### R26-INT-06 — Nit — PendingSaveJournal replay bypasses the gate for pre-gate records

`replayPendingWrite` (:302-358) replays `record.rawPayload` via RPC with no gate — correct by design (the payload passed the gate when journaled), but a record journaled by a pre-r25 build carrying `+Δ` would still commit and `adoptCommittedPending` (:441-451, shape+acceptance — both pass for consistent `+Δ`) adopts it as the head → the INT-01 wedge. Self-limiting: only journals written before this batch. Noted for the adjudication ledger.

---

### R26-INT-07 — Nit — `restoreBackup` remains deliberately ungated

`restoreBackup` writes `BACKUP_KEY` bytes verbatim into `SAVE_KEY` (recovery lane; only previously-admitted bytes land there). A `+Δ` backup re-installs the wedge — consistent with the adjudication's deliberate exemption; a stale backup can regress though. For completeness only.

## Notes for adjudication

- The gate's core claims all verified: single funnel, correct generation ordering, wire-form judged, refuse-before-service, healthy slot survives, no caller deadlock/double-write. The verdict is FAIL purely on INT-01 — the gate protects storage but its refusal is undeliverable to the one surface (SaveIssueScreen/remote-reset) that resolves the wedge it creates.
- `effectProvenanceMs`/appliedAtMs clamps verified — no persisted channel still mints `authorityNowMs > now` stamps (the remaining verbatim channels are all pinned vs `lastSavedAt` → consistent deny).
- `lastRefinementRegenAtMs` exists only as a SaveSystem comment — retired channel, no live stamp to audit.
- The `console.warn` on refusal logs `outgoing.issues` — issue objects carry path+message, no secret material. Fine.

## Probe run

```
npx vitest run src/services/save/auditR26Int.probe.test.ts --pool=threads
→ 17 tests passed, ~2s
```
