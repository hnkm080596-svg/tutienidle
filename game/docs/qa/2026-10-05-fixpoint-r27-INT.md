# QA Review: fixpoint r27 — INT (integration coherence) audit of the r26 + r27-COR batches

- Date: 2026-10-05
- Mode: deep (scoped to cross-layer agreement: gates, seams, authority sources, envelopes)
- Verdict: **PASS WITH EVIDENCE** — 0 Critical / 0 High / 0 Medium, 1 Low, 5 Nits. No pair of corrected layers was found to disagree in a way that grants, wedges, or silently diverges; every divergence found is deny-direction and bounded.
- Audit commit: `7bea330a` on `codex/hoa-cau-fireball-vfx` (detached worktree `.agent-worktrees/audit-r27-int`)
- Probe: `game/src/services/save/auditR27Int.probe.test.ts` — 16 probes, all green (`npx vitest run src/services/save/auditR27Int.probe.test.ts --pool=threads`)
- Task-owned paths: `game/src/services/save/auditR27Int.probe.test.ts`, `game/docs/qa/2026-10-05-fixpoint-r27-INT.md` only (no production edits).

## Scope and Risk Map

The INT question: after r26 (restoreClock re-domain, armed refuse envelopes, collection caps) + r27-COR (restoreClock drops the authority; digest re-derive; cooldown/nextCycleAt clamps; `specialIngredients` pre-check; `talentLevels` cap; `sanitizeRestoreAuthority` null arm), do the corrected layers still agree *with each other* at every consumer and seam?

Attack surface decomposed into contract pairs that must agree:

1. **Write-gate vs read-gate**: `driveSave`'s outgoing `validateGameSaveShape` must refuse exactly what the read side refuses — one validator, one verdict (R2, C2).
2. **Restore → serialize → re-admit round-trip**: a shifted payload must re-pass the same admission or the system self-bricks on the next autosave (R1, D1).
3. **Authority-source orthogonality**: deadline channels read `restoreClockMs` (save-epoch); accrual reads `restoreAuthorityNowMs` (authority-epoch). The two must never cross-contaminate (A1, A2).
4. **Envelope codes vs authority arms**: every `DATA_REFUSE_CODES` member must have a terminal `authorityStateForError` arm, and the armed predicate (`unavailable && !retryable && code ∈ DATA_REFUSE_CODES`) must match what the coordinator actually emits (C1–C4).
5. **Dedupe/identity vs re-restore**: `computeRestoreIdentity` excludes `lastSavedAt` — a marker-only delta must converge, a content delta must re-restore (D3).
6. **Sibling asymmetries**: cap ordering across collection validators (E1), per-channel admission-pin coverage (E2), verify-vs-clone failure modes (E3), settle re-stamp vs marker pin (E4), merge-vs-replace restore semantics (D2).

## Invariant Ledger

| ID | Pair under test | Contract that must agree | Attack operator | Observable oracle | Probe | Result |
| --- | --- | --- | --- | --- | --- | --- |
| INT-R1 | +Δ marker payload → 4 restore seams → `buildGameSave` → `validateGameSaveShape` | admitted-in must admit-out (no self-brick) | uniform +30s epoch shift on all began/deadline stamps | `ok:true` twice; shifted stamps = `now` | R1 | holds |
| INT-R2 | `driveSave` vs `validateGameSaveShape` | post-dated `startedAt` refuses on BOTH sides, identical envelope under local & remote adapters | `startedAt > lastSavedAt` | `{unavailable, retryable:false, code:SAVE_INVALID, detail:OUTGOING_ADMISSION_REJECTED}` ×2, adapter untouched | R2, C2 | holds |
| INT-R3 | non-finite `lastSavedAt` → restoreClock | defensive `Number.isFinite` arm falls to `Date.now()` | `lastSavedAt = NaN` through ungated `saveOps` | lane grounds at now | R3 | holds |
| INT-A1 | same payload × {undefined, honest cold-boot, live-replacement, corrupt-LOW cold-boot} | deadline stamps identical across all authorities; only accrual varies | 4-source authority matrix | workerCycles/alchemyJobs/cooldownUntil/nextCycleAt verbatim & equal | A1 | holds |
| INT-A2 | malformed authority forms (null, NaN, 2^53, unknown kind, huge until) | degrade to deny primitive; restore clock untouched | value mutation on `timeAuthority` | verbatim restore in all 5 forms | A2 | holds |
| INT-C1 | `DATA_REFUSE_CODES` vs `authorityStateForError` | every armed code has a terminal arm; boundary codes stay distinct | enumerate all codes | `SAVE_INVALID`/`SAVE_TOO_LARGE` → 'recovery'; `CONFIGURATION_ERROR` → 'recovery' but NOT armed | C1 | holds (boundary noted) |
| INT-C3 | `observeSaveResult` vs adapter capability | transitions only when a `reconnect` dep exists; `AUTH_EXPIRED` non-retryable always revokes | local controller vs remote controller | local stays 'ready'; remote → 'recovery'/'revoked'/'reconnecting' | C3 | holds |
| INT-C4 | `OUTGOING_UNSERIALIZABLE` arm | non-serializable snapshot lands on the same armed envelope | BigInt in payload | `SAVE_INVALID` + `OUTGOING_UNSERIALIZABLE`, adapter untouched | C4 | holds |
| INT-D1 | fast-clock remote save + live-replacement | cross-device skew re-grounds at THIS device's clock; next write passes | remote marker +120s, lane inside its epoch | lane → `now`; rebuilt wire `ok:true` | D1 | holds |
| INT-D2 | decompose merge vs production replace (different payloads) | documented asymmetry is observable and bounded | two restores, second payload's deadline earlier | production replaced ('lane-two'); decompose keeps live `max` | D2 | holds (Nit-5) |
| INT-D3 | `computeRestoreIdentity` dedupe | marker-only delta converges; content delta re-restores | marker-only delta then content delta | `restoreStates` spy 0 calls; tampered lane survives; 'lane-three' restores | D3 | holds |
| INT-E1 | cap ordering: `optionalArray` vs `validateNonNegativeIntMap` | same `ID_COLLECTION_CAP`, different reporting shape | >1024 malformed entries in both | array: cap issue + per-entry issues; map: cap issue only | E1 | asymmetry confirmed (Nit-2) |
| INT-E2 | admission pins: `decompose.nextCycleAt` vs `tribulation.cooldownUntil` | deadline channels pinned differently at the gate | far-future stamp in each | decompose admitted (`ok:true`); tribulation refused | E2 | asymmetry confirmed (Nit-3) |
| INT-E3 | `verifyAlchemyJobReservation` vs `restoreJobs` clone arm | same malformed witness, different failure mode | `specialIngredients: {}` | verify → `'specialIngredients'` (clean); clone → `TypeError` | E3 | divergence confirmed (Low-1) |
| INT-E4 | seeded-head re-stamp (r16-18) vs marker pin (r26) | shifted pending heads stay inside the next write's epoch | `settleNow < Date.now()` | heads shifted by exactly `Date.now() − settleNow`; wire re-passes | E4 | holds |

## Verified-consistent (rejected candidates)

- **Remote adapter can never emit `retryable:true` on an armed code** — `SupabaseCloudSaveService` REJECTED arm (:968-989) maps `SAVE_INVALID`/`SAVE_TOO_LARGE` to `retryable:false` always. The armed predicate is unreachable for retryable refuses; the pre-r26 retryable+codeless shape cannot reappear through the real adapter.
- **`effectProvenanceMs` vs `restoreClockMs` deliberately differ** — `player.ts:419-421` keeps the authority inside timed-effect clamps (`min(lastSavedAt, authorityNowMs, now)`), while `restoreClockMs` excludes it. Confirmed correct: a corrupt-LOW authority must deny effect accrual (deny-direction) but must not re-anchor began-stamps. The split is the fix, not a bug.
- **`lastAppliedPayloadHash` vs `player.lastRestoredPayloads`** — two dedupe layers (manager :160, store :381) read the same `computeRestoreIdentity`; both skip identical payloads. No ordering hazard: the store runs first and both converge on the same identity.
- **Settle window math is deny-bounded on both ends** — `settleNowMs = min(lastSavedAt + elapsed, authorityNowMs, Date.now())` (:445-449) and `offlineSinceMs = min(lastSavedAt, authorityNowMs − elapsed, now)` (:471-475). Corrupt-LOW authority shrinks the window to ~nothing; it cannot enlarge it. Matches the r27 design note.
- **`authorityStateForError` boundary codes** — `SERVER_ERROR`, `NETWORK_UNAVAILABLE` → 'reconnecting'; `CONFIGURATION_ERROR` → 'recovery' but outside `DATA_REFUSE_CODES` (no saveIssue arm). This asymmetry is intentional per the `BackendStatus.ts` comment (non-data refuses must not offer remote reset). Consistent, documented.
- **`SaveIncompatibleScreen` mid-game mount** — `v-if="saveIssue.status"` at App.vue:1211 mounts over the running game when the persistPlayer arm reports; this is the intended remediation surface (the player exports/resets rather than silently losing progress). Not a defect.
- **`buildings[].lastCollectedAt` epoch split** — seconds-epoch (~1.8e9), outside the ms re-domain by design. `getStoredAmount` (:329-345) bounds both directions: far-future stamp → `elapsed ≤ 0` → 0 (deny); deep-past stamp → `min(elapsed·rate, capacity)` → capacity-bounded. No cross-epoch interaction with `restoreClockMs` — the channels cannot disagree because they never meet.
- **`PendingSaveJournal` ungated replay / `restoreBackup` ungated** — adjudicated residuals per brief; confirmed `restoreBackup` only swaps localStorage keys — the next load still passes through `restoreGameSession`'s gate, so the "ungated" claim refers to storage, not admission.
- **Seeded-head re-stamp under corrupt-LOW authority** — settle mints `seeded:true` lanes rooted at `offlineSince` (authority-derived), but `fieldEpochShiftMs = max(0, Date.now() − nowMs)` re-grounds only those pending heads into the field epoch before persistence (E4). Persisted `startedAt ≤` next marker → next write admits. The two epochs agree at the seam.

## Findings

### QA-2026-10-05-R27-INT-1 — `restoreJobs` clone arm throws `TypeError` on the witness shape the validator now names cleanly

- **Severity: Low** — Status: **Confirmed** (probe E3)
- Layers disagree on failure mechanism: `verifyAlchemyJobReservation` (r27-COR-2) returns the clean `'specialIngredients'` verdict for `reservation: {costScale, digest, specialIngredients: {}}`, but the ungated-path clone at `AlchemySystem.ts:393-399` still runs `(job.reservation?.specialIngredients ?? []).map(...)` — a truthy non-array reaches `.map` and throws `TypeError`. Reachable only through callers that bypass `validateGameSaveShape` (in-memory injection, `importSaveRaw`-adjacent paths) — `restoreGameSession` wraps the throw as `'rejected'` (deny, handled surface; user sees "restore refused"). Bounded, deny-direction; the class is a residue of fixing the gate without re-checking the sibling fold site.

### QA-2026-10-05-R27-INT-2 (Nit) — cap-reporting asymmetry between array and map collection validators

- **Severity: Nit** — Status: **Confirmed** (probe E1)
- `optionalArray`/`requireArray` emit the `ID_COLLECTION_CAP` issue AND still walk every entry (over-cap `productionSites` produces cap + per-entry issues); `validateNonNegativeIntMap` returns early (cap issue only). Same refusal outcome, different issue shape — pure diagnostics asymmetry; no acceptance difference. Worth noting only because the batch claims uniform caps.

### QA-2026-10-05-R27-INT-3 (Nit) — `decompose.nextCycleAt` is the only deadline channel with no vs-marker admission pin

- **Severity: Nit** — Status: **Confirmed** (probe E2)
- `validateGameSaveShape` pins `workerCycles[].startedAtMs ≤ lastSavedAt` and `tribulation.cooldownUntil ≤ lastSavedAt + 300s`, but a far-future `decompose.nextCycleAt` is admitted on boundedness alone (< 2^52). Post-admission the restore clamp (`≤ restoreNow + cycleMs`) owns it — so the outcome is identical (no mint; clamped at +30s). The gate is strictly weaker on this channel than its sibling; noted as coverage asymmetry, not an exploit path.

### QA-2026-10-05-R27-INT-4 (Nit) — dead arm in `verifyAlchemyJobReservation` after the r27 pre-check

- **Severity: Nit** — Status: **Confirmed** (source read)
- `AlchemySystem.ts:212-214` checks `Array.isArray(witness.specialIngredients)` before the digest fold; the later `!Array.isArray(witnessSpecials)` arm at :243 can now never fire (non-arrays already returned). Harmless dead code; flagged so the next cleanup knows it is unreachable, not defensive.

### QA-2026-10-05-R27-INT-5 (Nit) — decompose restore merges, siblings replace — on a *different* payload the live timer outlives the payload's own deadline

- **Severity: Nit** — Status: **Confirmed** (probe D2)
- `DecomposeSystem.restore` computes `nextCycleAt = max(live, clampedRestored)` (idempotence design for same-payload re-restore) while production/alchemy/tribulation are hard replace. On a genuinely different payload (probe D2: wire2's deadline +5s vs live +20s) the live (later) timer survives the payload's own earlier deadline — the authoritative remote save does not fully own this channel's clock. Bounded to ≤ authored `cycleMs` ahead, deny-direction only (a later timer fires *less* often); flagged as the one place where "restore is REPLACEMENT" (M1/ARCH-001 comment :164-169) is not literally true.

### QA-2026-10-05-R27-INT-6 (Nit) — `saveIssue.report` re-overwrites the store on every wedged autosave

- **Severity: Nit** — Status: **Confirmed** (source read, App.vue:582-595)
- While a save stays wedged on a coded non-retryable refuse, every autosave tick rebuilds the export payload and calls `saveIssue.report('corrupted', …)` — the store record is overwritten each tick (idempotent display; the `SaveIncompatibleScreen` card mounts once via `v-if`). Bounded to one Pinia write per autosave interval; no queue growth. Listed for completeness — not user-visible churn.

## Fixpoint assessment

No Critical/High/Medium findings. The one Low is a failure-*mode* divergence on an ungated entry path that still lands on `'rejected'` — deny-direction and contained. All five Nits are documentation-class asymmetries the coordinator may accept outright. The core INT question — "is there a payload or sequence where two corrected layers disagree" — resolved to **no**: write gate and read gate run one validator (R2/C2), the restore→serialize→admit round-trip self-heals on both epoch-shift shapes (R1/D1), all four authority sources converge on identical deadline stamps while accrual stays authority-scoped (A1/A2), every armed envelope code has a matching terminal authority arm (C1/C3/C4), and the r16-18 seeded-head re-stamp composes cleanly with the r26 marker pin (E4).

Fixpoint signal for this surface: **converged modulo the Low/Nit list above** — none requires a production change to keep the authority contract honest.
