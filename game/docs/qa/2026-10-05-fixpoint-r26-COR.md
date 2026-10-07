# Fixpoint r26 — COR (correctness/regression) blind audit

- **Scope:** the r25 adjudication batch at `8f3cb237` (branch `codex/hoa-cau-fireball-vfx`) — `3588ebf9` + the wire-form driveSave follow-up — plus sibling surfaces its classes touch.
- **Batch under audit:** (1) `driveSave` write-side `validateGameSaveShape` gate on the WIRE form + `OUTGOING_UNSERIALIZABLE` (retryable:false) arm; (2) remote absent-authority degrade to `live-replacement`; (3) three new `Date.now()` clamp operands (`settleNowMs`, `effectProvenanceMs`, `boundTimedEffectClocks.appliedAtMs`); (4) `ID_COLLECTION_CAP=1024` across every array channel + three records; (5) `sanitizeRestoreAuthority` kind whitelist; (6) test-side fixture hardening.
- **Probe evidence:** `src/services/save/auditR26Cor.probe.test.ts` — 11/11 green under `npx vitest run src/services/save/auditR26Cor.probe.test.ts --pool=threads`.
- **Verdict:** **PASS WITH EVIDENCE** — one **Medium** residual arm of the exact class the batch fixed (verbatim-restored relational stamps still self-brick the write gate, remote side is a lockout not a defer), three **Low** findings (cap coverage asymmetry, uncoded refuse taxonomy, honest equipment-cap overrun), four **Nits**. The batch itself is sound: honest `buildGameSave` payloads pass the gate end-to-end (probe D1, fresh + mid-game), the refuse preserves the healthy slot, queue/generation semantics are unchanged, the absent-authority degrade is fail-closed, and the clamps absorb honest cross-machine skew deny-side.

---

## Findings

### R26-COR-1 — Medium: verbatim-restored relational stamps still self-brick the outgoing gate (residual arm of the class the batch claims to close)

**Claim.** The batch's own motivation comment (`CloudSaveCoordinator.ts:147-154`) describes post-dated stamps syncing in, restoring verbatim, and bricking the next write — and closes it by refusing that write. But the refuse is terminal-by-state, not transient: the restored *live* state keeps the post-dated stamps forever, so **every** subsequent write fails the gate until the stamps pass in real time. The r25 clamps only cover the *spawned* cursors (`offlineSinceMs`-seeded lanes, timed-effect `appliedAtMs`/`expiresAtMs` via `boundTimedEffectClocks`/`effectProvenanceMs`) — they do not touch the verbatim-restore channels:

| Channel | Admission pin | Restore seam | Re-stamp? |
|---|---|---|---|
| `productionSites[].workerCycles[].startedAtMs` | `<= lastSavedAt` (`saveShapeValidation.ts:3503`) | `ProductionSystem.restoreStates` — `{...cycle}` verbatim (:147) | never |
| `alchemyJobs[].startedAtMs` | `<= lastSavedAt` (:3733) | `AlchemySystem.restoreJobs` — verbatim spread (:358) | never |
| `tribulation.cooldownUntil` | `<= lastSavedAt + 300s` (:4549-4558) | `TribulationDirector.restoreRuntime` — verbatim (:855) | never |
| `persistentTimedEffects[].appliedAtMs` | `<= lastSavedAt` (:1565) | `boundTimedEffectClocks` — clamps at `min(nowMs, Date.now())` | **clamped (r25)** |

The pins compare each stamp to the **payload's own `lastSavedAt`**, so a save written under a forward-skewed clock (`lastSavedAt = now+δ`, lane/deadline stamps `<= now+δ+span`) admits cleanly at load, restores the future stamps verbatim into live state, and the very next `player.save` stamps `lastSavedAt = Date.now()` beneath them — `OUTGOING_ADMISSION_REJECTED`, deterministically, on every write until real time reaches the stamp horizon. A crafted far-future pair (e.g. year 3000) never heals.

**Probes (deterministic, end-to-end):**

- **W1** — `tribulation.cooldownUntil = lastSavedAt+300s` exactly at the authored bound: `validateGameSaveShape` ok → `restoreRuntime` → `serializeRuntime` returns the stamp byte-identical → rebuilt save with `lastSavedAt = now` fails at `.tribulation.cooldownUntil`.
- **W2** — same chain through `alchemyJobs`: span-coherent future pair via `alchemyJobFixture` admits → `restoreJobs` verbatim (`getJobs()[0].startedAtMs` = the future stamp) → next write fails at `alchemyJobs[0].startedAtMs`.
- **W-class contrast** — probe **G3** proves the sibling channel is closed: a skewed-writer TLT effect re-domains (`appliedAtMs` clamped to `<= now`, `expiresAtMs` to `provenance+24h`) and the rebuilt write validates clean. The r25 pattern exists; it was applied to the spawn/effect seams but not the verbatim lanes.

**Reachability.** Honest: (a) system clock stepped backward mid-session (NTP correction, manual adjust, dual-boot drift) between the stamp and the save; (b) **cross-device skew under remote-authoritative** — device A at +δ writes lane stamps that admit, device B at real time loads them verbatim and its boot post-accrual commit refuses. Crafted: any payload editor can mint the pair.

**Consequence per tier (this is where the comment understates):**

- **Local:** the documented outcome — "progress defers until the stamps are in-domain again (bounded deny)" — autosave silently refuses, sim keeps running; heals at the skew horizon.
- **Remote boot:** the post-accrual commit (`useAppLifecycle.ts:533-560`) is refused → `observeSaveResult` maps `code === undefined` to `'reconnecting'` (bookkeeping only at boot) → generic `onError` + `boot.fail()` — **the player cannot enter the game at all** for the skew horizon, and the surface offers only "back to auth". The `DATA_REFUSE_CODES` arm (`:51-54,571`) that routes data-class refuses to the corrupted surface — whose own comment says the remote reset is "the only real un-wedge (it deletes the character whose writes can never commit)" — is unreachable because the coordinator refuse carries no `code`.
- **Remote mid-session:** every autosave refuse → `pause('save-failed')` → `armRetry` + `attemptReconnect` (heartbeat + load RPC) → resume → next autosave refuses — a pause/resume churn loop once per save cadence for the whole horizon.
- **Crafted far-future:** permanent on every tier — the "bounded deny" is unbounded for them.

**Why Medium, not High/Low:** the wedge is deny-direction and partially by design (the batch deliberately accepted deferred progress as the refuse outcome), but the design comment documents the *local* outcome; on remote the same payload is a hard lockout with no recovery affordance, and the verbatim channels are the exact sibling arms of the class the batch fixed. Adjacent-channel clamps (re-stamp `min(stamp, nowMs)` at `restoreJobs`/`restoreStates`/`restoreRuntime`, or an authority-bound like `boundTimedEffectClocks`) close it the same way r25 did for effects.

### R26-COR-2 — Low: `ID_COLLECTION_CAP` coverage is not uniform — uncapped sibling records/nested arrays still admit unbounded counts

Probe **C2**: `player.baseStats` and `player.nodeFreePurchaseRecord` each accept 1025-key maps cleanly (`ok: true`); `player.purchasedNodeIds`/`nodeLevels` at 1025 refuse (C1). Uncapped remainder:

- `player.baseStats` — per-entry value check only (`:652`); forged keys whitelist out at restore (StatType filter), so it self-heals on the next write.
- `player.nodeFreePurchaseRecord` — values `>=0` only (`:2269-2276`); restored verbatim, so a forged map persists and re-taxes every write-gate validation; deny-direction only (`computeNodeRefund` subtracts it, `NodeSystem.ts:532` — a forge can only *shrink* refunds).
- `nodeOneShotGrants[].learnedSkillIds` — parent map capped, but each nested array is `every(string)` only (`:2295-2300`) — unbounded per entry.
- `hiddenPerfection.hiddenBreakthroughRealmIds` — array-shaped check only (`:1821`); the `great_dao` witness check is an `.includes`, not a length bound.
- (`talentLevels` is effectively bounded — each key must appear in `selectedTalentIds` (:808), itself capped and pick-ceilinged.)

Impact is admission + per-write/per-load walk cost and payload bloat on crafted input (deny/padding class) — no grant found. Either cap them symmetrically or correct the "every player-owned collection" coverage comment.

### R26-COR-3 — Low: the refuses carry no `BackendErrorCode` — deterministic-invalid state classifies as 'reconnecting' (churn), and the documented un-wedge surface is unreachable

Both `OUTGOING_*` refuses return `detail` but no `code` (probe **D2** asserts `result.code === undefined`). Downstream: `authorityStateForError(undefined)` → default arm → `'reconnecting'` (`OnlineSessionController.ts:118-137`). Consequences:

- Runtime autosave (remote): `observeSaveResult` → `pause('save-failed')` → auto-reconnect pipeline per refuse (heartbeat + load + resume). A deterministic-invalid live state produces infinite churn — overlay flicker + RPC spam per autosave tick — instead of a terminal park.
- Boot commit: generic `onError` + `boot.fail()` — no `saveIssue.report('corrupted', …)` path, so no remote-reset affordance, which `useAppLifecycle.ts:565` calls "the only real un-wedge" for exactly this "writes can never commit" class.
- `retryable: true` on `OUTGOING_ADMISSION_REJECTED` is also wrong-by-state: retrying the same invalid snapshot can never succeed; it is only meaningful across distinct future snapshots.

Arguably partial-design (a *transiently* skewed state does heal, so "transient" is not strictly wrong), but classification-by-absent-code collides the deliberate refuse with generic transport noise.

### R26-COR-4 — Low: an honest save CAN exceed `ID_COLLECTION_CAP` on the equipment channel — total write wedge while the hoard holds

`EQUIPMENT_BAG_SOFT_CAP = 500` (`EquipmentBag.ts:14`) is enforced by `autoDissolveOverflow` (:76), which only dissolves non-equipped/non-locked/non-favorite items (:79). A player who locks/favorites >1024 accumulated items produces an honest `player.equipment` array the gate refuses — every subsequent write fails (probe C1 pins the cap firing on the sibling `purchasedNodeIds`). Reachability is edge-honest (deliberate mass locking over long play) and self-heals the moment the hoard dips below 1024, but the wedge is total while it holds. `alchemyJobs` cannot honestly overrun — the authored slot bound (`maxJobs <= 4`, `:4454-4466`) is itself validated. Worth either a bag hard-cap below 1024 (counting locked/favorite) or an admission carve-out; adjudication may accept this as a parked residual.

### Nits

- **N1 — `sanitizeRestoreAuthority(null)` throws `TypeError` before the whitelist degrades** (probe **G1**). `timeAuthority.kind` on `null` reads before the kind check. Unreachable today — the param is a runtime arg from the two construction sites, never a payload field — but a future JSON-sourced caller crashes instead of degrading.
- **N2 — double `JSON.stringify` per write**: the gate serializes the whole snapshot to build `wire`, then the adapter serializes again for storage. Trivial at save cadence; noted for completeness.
- **N3 — `OUTGOING_UNSERIALIZABLE` is a dead arm for honest writes**: `buildGameSave` already JSON-detaches every slice (`detachSaveValue`), so an in-memory snapshot that fails stringify can only come from live-state corruption (circular/BigInt), never the writer. Correct as a fail-safe; just unreachable through `player.save`.
- **N4 — pre-existing dormant arm carried forward**: `quests.lastDailyResetAtMs` remains a payload-editable day-bucket marker with no `<= lastSavedAt` pin (r25-COR-4) — still dormant (zero authored `daily` quests).

---

## Checked and rejected / verified clean

| Surface | Result |
|---|---|
| Honest `buildGameSave` payload vs the gate (fresh pre-creation-pick AND mid-game with pill_room + alchemy job + tribulation cooldown) | Probe **D1**: wire-form validates `ok` with zero issues — no honest snapshot refuses, including the firstSave arm that `isSaveAcceptable` would have blocked. |
| Joined/displaced queued callers on a refuse | Probe **D4**: inflight write resolves `ok`; both joined callers resolve with the promoted entry's `OUTGOING_ADMISSION_REJECTED`; adapter saw exactly one write; no resolver stranded. |
| Stale-generation queued entries | Drain path skips `driveSave` entirely (`:130-132`) — generation fence unchanged by the gate. |
| Local conflict-recovery retry | `driveSave` gate runs once per drive; the conflict `load()` + single `service.save` retry reuses the same admitted snapshot — no re-gate needed, no semantic change. |
| `resetCharacter` | Delegates to adapter + `reset()`; the gate does not block reset (it writes nothing). Unaffected. |
| Absent-authority degrade under remote | `useAppLifecycle.ts:469-477` mints `live-replacement` — fail-closed, zero-accrual (probe **G2**). Non-remote keeps `undefined` → legacy client window (probe **G2**: elapsed > 0) — no new deny primitive for local callers. |
| `live-replacement` mint under `!remoteAuthoritative` | Unreachable — the ternary short-circuits to `undefined` before the arm. Verified in code + G2. |
| `sanitizeRestoreAuthority` whitelist completeness | Only construction sites are `useAppLifecycle` (`cold-boot`/`live-replacement`) and `App.vue` onResume (`live-replacement`) — all whitelisted (probe **G1**). Unknown kind → degrade, never a stamp read. |
| `Date.now()` clamps vs honest ahead-of-now stamps | Probe **G3**: a +1h-skewed writer's TLT effect restores with `appliedAtMs` pulled to `<= now` and `expiresAtMs <= provenance+24h` — skew absorbed deny-side, live effect preserved, rebuilt write validates clean. |
| `settleNowMs` third operand | Verified: redundant on absent arm (`authorityNowMs` already resolves `Date.now()`), binding on forward-skewed `cold-boot` — dues in `(now, untilMs]` defer to the live tick instead of seeding persisted stamps past the next `lastSavedAt`. Same conclusion as r25's S-probes; unchanged at this commit. |
| TLT `expiresAtMs > lastSavedAt + 24h + 7d` pin vs restored live arm | Cannot wedge: live arm caps at `provenance+24h <= now+24h` and the pin allows `+24h+7d` — 7-day margin always absorbs the clamp. |
| Write gate shape-only vs remote read gate `isSaveAcceptable` | Deliberate asymmetry (pre-creation saves must not be acceptance-blocked). Residual: a shape-ok payload with unknown registry ids commits remotely, then fails acceptance on next load → 'corrupted' surface with remote reset — self-inflicted deny, reachable only via crafted input. Recorded, not actionable. |
| `decompose.nextCycleAt` / `autoFarmStage.lastCheckedMs` | Bounded-timestamp only, no `<= lastSavedAt` pin — future stamps admit and are re-anchored at settle (`>now -> now`); no wedge arm. |
| `quests` / `techniques` honest bounds | `techniques.length < 1` only required at realm >= `qi_refining` (`:4356`); default mortal saves carry none and pass (D1). Quest cap unreachable honestly (roster 21). |
| Per-element walks still run after a cap fires | Cosmetic: the cap decides rejection, not early-exit; walk cost stays O(n) as before on crafted input — same as the pre-gate load path. No new hot loop. |

---

## Learned-defect loop

| Lesson | Class | Detector escape | Pin proposed |
|---|---|---|---|
| Verbatim-restore seams need the same re-domain bound the spawn seams got | verbatim-stamp wedge | r25 clamped spawn cursors + timed effects; the job/lane/cooldown restores copy payload stamps untouched | probes W1/W2 pin admit -> verbatim -> refuse; candidate: `min(stamp, authorityNowMs)` at the three restore seams |
| A refuse taxonomy without a `code` collides with transport noise | error-classification gap | `authorityStateForError(undefined)` defaults to transient; data-class routing needs a code | probe D2 pins `code === undefined`; candidate: mint a BackendErrorCode (or a refuse-kind) so 'recovery'/'reconnecting' is a choice, not a default |
| "Every player-owned collection" caps need a census, not a whitelist | asymmetric bounds | four sibling containers uncapped; nested arrays escape parent caps | probe C2 pins the gap; symmetric record-cap + nested-array cap |
| Honest overflow channels must be enumerated before a hard count cap | cap vs writer ceiling | equipment soft-cap mechanics allow honest >1024 (locked/favorite hoard) | probe C1 + `autoDissolveOverflow` exemption evidence |

**COR auditor sign-off: r26 — PASS WITH EVIDENCE.** Findings: Medium ×1 (R26-COR-1, deferred to adjudication), Low ×3 (R26-COR-2/3/4), Nit ×4. The r25+r26 batch's claimed classes hold on every honest path probed; the residual wedge is confined to the verbatim-stamp siblings and the refuse-classification seam.
