# QA Review: fixpoint r27 — COR audit of the r26 adjudication batch (a9a9c37c)

- Date: 2026-10-05
- Mode: deep (scoped to the r26 diff + class siblings)
- Verdict: **FAIL** — one Confirmed **High** (regression introduced by the batch's own bound), one Confirmed **Medium** (armed-envelope bypass via a throwing validator call), two Confirmed **Low**, two Nits/pre-existing notes.
- Audit commit: `a9a9c37c` on `codex/hoa-cau-fireball-vfx` (detached worktree `.agent-worktrees/audit-r27-cor`)
- Probe: `game/src/services/save/auditR27Cor.probe.test.ts` — 18 probes, all green (`npx vitest run src/services/save/auditR27Cor.probe.test.ts --pool=threads`)
- Task-owned paths: none (read-only audit; QA-write paths only)

## Scope and Risk Map

r26 changed: shared `restoreClockMs = Math.min(restoreAuthorityNowMs(authority), Date.now())` (`GameManagerSaveRestore.ts:356`) feeding four restore seams (`ProductionSystem.restoreStates`, `DecomposeSystem.restore`, `AlchemySystem.restoreJobs`, `TribulationDirector.restoreRuntime`); `driveSave` refuses now carry `code:'SAVE_INVALID'`/`retryable:false`; `DATA_REFUSE_CODES` exported from `BackendStatus.ts` and consumed by `useAppLifecycle` (commit-fail arm :556, firstSave arm :679) and `App.vue` persistPlayer (:585); `ID_COLLECTION_CAP` extended to `validateNonNegativeIntMap` (`hiddenBeastKills`, `productionSites[].hiddenChannelCycles`), `baseStats`, `skillCastCounts`, `nodeFreePurchaseRecord`, `nodeOneShotGrants[].learnedSkillIds`, `hiddenPerfection.hiddenBreakthroughRealmIds`; `sanitizeRestoreAuthority(null)` degrades instead of throwing.

One-hop consumers attacked: `WorkerLaneAdvance` (lane shift invariants, 'observe' vs 'deadline'), `alchemyJobReservationDigest`/`verifyAlchemyJobReservation` (digest over shifted stamps), `OnlineSessionController.authorityStateForError` (code→state), `SupabaseCloudSaveService.parseTimestampMs` (the authority stamp source), `player.ts boundTimedEffectClocks` (sibling re-anchor seam), every `Record<string,number>`-shaped save field vs `ID_COLLECTION_CAP`.

Excluded (adjudicated residuals, per brief): cursor-channel far-future self-harm deny, equipment hoard >1024 (D-02), `PendingSaveJournal`/`restoreBackup` ungated, `OUTGOING_UNSERIALIZABLE` unreachability, join-or-displace contract, stackable-chain tail loss.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-R27-W1 | `workerCycles[]` / ProductionSystem.restoreStates | restore with post-dated began-pair | Monotonicity: startedAt ≤ completesAt, span exact, boundary strict `>` | Value mutation (started >, =, now+1; mixed array) | restored stamps; lane order | unit probe W1 | high |
| INV-R27-W2 | `alchemyJobs[]` / AlchemySystem.restoreJobs | same + reservation witness | Exactly-once: shifted job must settle exactly once, witness replays | Reorder + value mutation | `verifyAlchemyJobReservation` → null; tick delivery event | probe W2/W3 | high |
| INV-R27-W3 | witnessless job / restoreJobs | shift without reservation | Atomicity: no fabricated grant | Value mutation (reservation absent) | settle fails, delivered 0 | probe W4 | medium |
| INV-R27-W4 | `tribulation.cooldownUntil` / restoreRuntime | restore skewed stamp | Boundedness: authored max remaining | Timing boundary | serializeRuntime().cooldownUntil | probe W5 | medium |
| INV-R27-W5 | `decompose.nextCycleAt` / DecomposeSystem.restore | restore skewed/past stamp + repeat restore | Boundedness + merge monotonic | Timing boundary + repeat | getSaveState().nextCycleAt | probe W6 | medium |
| INV-R27-W6 | honest save / all seams | restore under absent authority | Regression: verbatim stamps | Interruption (legacy path) | restored stamps unchanged | probe W7 | high |
| INV-R27-F1 | restoreClockMs / GameManagerSaveRestore | restore under finite-LOW authority | Boundedness: corrupt authority must deny, not grant (r24 law) | Value mutation (untilMs=-1, 1.7e9) | all four channels collapse to ~authority epoch → live-tick grants | probes F1–F5 | **highest** |
| INV-R27-F2 | began-pair / skewed honest stamp under server until | restore with until < started | Boundedness of over-fire | Stale state | pays ≤ skew early | probe F6 | low |
| INV-R27-F3 | restoreClockMs high side | untilMs = 4e15 (< 2^52) | Boundedness: Date.now() cap | Value mutation | honest pair verbatim | probe F7 | medium |
| INV-R27-G1 | `verifyAlchemyJobReservation` | reservation missing `specialIngredients` | Recoverability: validator never throws | Value mutation (field absent) | TypeError propagates | probe G1 | medium |
| INV-R27-G2 | driveSave refuse envelope | save whose wire throws the gate | Recoverability: deterministic-invalid → 'recovery' surface | Cross-system chain | codeless `SAVE_ADAPTER_THROW` → 'reconnecting' | probe G2 | medium |
| INV-R27-C1 | 7 newly capped collections | >1024 keys each | Boundedness: early cap refusal | Value mutation | cap issue at collection path | probe C1 | medium |
| INV-R27-C2 | `player.talentLevels` | >1024 keys | Boundedness: sibling map uncapped | Value mutation | no cap issue; per-entry walk runs | probe C2 | low |

## Findings

### QA-2026-10-05-R27-001 (r27-COR-1): finite-low `authorityNowMs` converts the re-anchor into a cross-channel instant-grant

- **Severity: High** — Status: **Confirmed** (probes F1–F5)
- Invariant: Boundedness / Recoverability — corrupt authority input must deny, never grant.
- Mechanism: `restoreClockMs = Math.min(authorityNowMs, Date.now())` bounds only the **high** side of the restore clock. `sanitizeRestoreAuthority` accepts any finite stamp with `|x| < 2^52`, and its corrupt-input handling is asymmetric by design: non-finite/huge/unknown-kind/null degrade to `{kind:'live-replacement', nowMs: Date.now()}` — the r24 zero-accrual **deny** primitive. A **finite LOW** stamp (a `serverTimeUtc`/`progressionCutoffAt` bug returning epoch-seconds ~1.7e9, a stale-era `until`, or simply 0/negative) passes sanitize as a legitimate `cold-boot` and becomes `restoreClockMs` ≈ stamp.
  Every honest began-pair stamp (~1.7e12) post-dates it, so all four r26 seams "re-anchor" them to the authority epoch:
  - `workerCycles[].startedAtMs/completesAtMs` → `[untilMs, untilMs+span]` — lands in the past → the first live `tickWorkers` (`advanceWorkerLanes`, 'observe' mode — **no budgetMs**) completes every in-flight lane head instantly (probe F1, F5).
  - `alchemyJobs[]` → shifted with a correctly **re-derived digest**, so `verifyAlchemyJobReservation` replays fine → the first `alchemySystem.tick` mints the pills (probe F2, F5 — delivered ≥ 1).
  - `tribulation.cooldownUntil` → `min(stamp, until + 300s)` ≈ epoch → cooldown evaporates (probe F3, F5).
  - `decompose.nextCycleAt` → `until + cycleMs` ≈ epoch → the pending cycle fires on the next tick (probe F4, F5).
  The grants flow through the **live tick path**, so the offline-settle cap (`settleNowMs ≤ authorityNowMs` → zero offline window) never even sees them: the same corrupt stamp that denies the offline window grants every in-flight deadline. That is the exact inversion of the deny direction the codebase maintains for corrupt authority everywhere else (r24-AUT degrade, r25-COR-1 fail-closed, timed-effect clamps, player-store `effectProvenanceMs`).
- **Regression status: introduced by r26.** Pre-r26 these seams restored verbatim — a corrupt-low authority moved nothing, deadlines stayed honest-future and simply waited (deny-side). The re-anchor fix created the grant path: `startedAtMs > restoreNowMs` is the only trigger, and the trigger condition is satisfied by *all* honest stamps whenever the restore clock is low.
- Reachability: server-side authority corruption only — `untilMs = parseTimestampMs(response.serverTimeUtc)` / resume `serverNowMs` (`SupabaseCloudSaveService.ts:663-664, 765-776`; `useAppLifecycle.ts:450-456`). A client attacker cannot inject it; the threat class is a server bug or a stale/corrupt window — precisely the input class `sanitizeRestoreAuthority` exists to defend, and it defends only one direction.
- Expected: a corrupt authority stamp can never mint early completions — degrade to the zero-accrual primitive like every other corrupt-authority arm (e.g. treat an `untilMs`/`nowMs` that pre-dates the payload's own `lastSavedAt` epoch — the payload the server itself witnessed at upload — as corrupt).
- Actual: every in-flight deadline across four systems completes on the first tick after restore.
- Evidence: probes F1 (completed lane at observe-tick), F2 (pill delivered at tick), F3/F4 (cooldown/nextCycleAt collapse), F5 (end-to-end through `saveOps.restoreFromSave` with `{kind:'cold-boot', sinceMs:-2e12, untilMs:1_700_000_000}` — all four channels land at ~1.7e9 < now, first tick pays), F7 (high-side pin: until=4e15 → `min` clamps at `Date.now()` — safe, demonstrating the asymmetry).
- Blast radius: bounded by in-flight inventory (each pending lane head / alchemy job pays once; cooldown skips one gate; decompose fires one cycle early) — but it bypasses both the deadline machinery and the offline cap for a real progression grant, and it is silent (no surface flags it).
- Test file: `game/src/services/save/auditR27Cor.probe.test.ts` — describe block "(F)".

### QA-2026-10-05-R27-002 (r27-COR-2): `verifyAlchemyJobReservation` throws on a reservation missing `specialIngredients` — the throw escapes the r26 armed refuse envelope

- **Severity: Medium** — Status: **Confirmed** (probes G1–G2)
- Invariant: Recoverability — the shape gate must never throw; a deterministic-invalid outgoing payload must land on the coded `SAVE_INVALID` → terminal `'recovery'` arm.
- Mechanism: `alchemyJobReservationDigest` folds `reservation.specialIngredients.map(...)` (`AlchemySystem.ts:171`) and `verifyAlchemyJobReservation` calls it at :211 **before** the `Array.isArray(witnessSpecials)` check at :235. A wire job with `reservation: { costScale: 1, digest: X }` (no specials) is `isObject` → passes `costScale` → `.map` on `undefined` → **TypeError escapes `validateGameSaveShape`** (the call site at `saveShapeValidation.ts:3788` is unwrapped).
  - At `driveSave` (`CloudSaveCoordinator.ts:182`) the throw propagates to `.catch(adapterThrow)` → `{status:'unavailable', retryable:false, detail:'SAVE_ADAPTER_THROW'}` **with no `code`** → `authorityStateForError(undefined)` → `'reconnecting'` pause+retry churn — the exact failure mode r26 eliminated for deterministic-invalid payloads, and the `saveIssue.report('corrupted', …)` recovery surface never arms (probe G2).
  - Root cause is **pre-existing** (the verify order predates r26); the r26 interaction is that the armed envelope's contract assumes the gate returns `{ok:false}` — any throw converts to a codeless adapterThrow, so one malformed field re-opens the reconnect-churn class across the whole save-write path. Other unguarded validator callers (`importSaveRaw`, `adoptCommittedPending`) propagate the crash rather than refuse.
- Reachability: crafted payload only — every honest `startJob` stamps `specialIngredients: [...]`; a restored crafted reservation is normalized (`specialIngredients: []` cloned in) before it can reach the in-memory gate, so the throw needs a payload that skips the restore seam (e.g. in-memory injection or an import-order path that validates before restoring).
- Expected: specials check before the digest fold (or the digest fold null-safe) → validator reports `reservation.specialIngredients` → refuse lands on the armed `SAVE_INVALID` arm.
- Actual: TypeError → codeless adapterThrow → 'reconnecting'.
- Test file: probe file, describe "(G)".

### QA-2026-10-05-R27-003 (r27-COR-3): `player.talentLevels` is the one `Record<string,number>` sibling still uncapped

- **Severity: Low** — Status: **Confirmed** (probe C2)
- Invariant: Boundedness — uniform collection caps.
- Mechanism: `saveShapeValidation.ts:791` iterates `player.talentLevels` entries with per-entry checks (int level, `maxLevel` bound, ownership-vs-`selectedTalentIds`) and never applies `ID_COLLECTION_CAP`. A 1025-key map pays 1025 per-entry validations and emits per-entry issues instead of one early collection refusal — the validator-cost gap the batch closed on `baseStats`, `skillCastCounts`, `nodeFreePurchaseRecord`, `hiddenBeastKills`, `hiddenChannelCycles`, `learnedSkillIds`, `hiddenBreakthroughRealmIds` (all verified live by probe C1).
- Reachability: crafted save only; no grant — unknown/unowned ids fail per-entry anyway. Impact is gate cost + the asymmetric "uniform caps" claim.
- Test file: probe file, probe C2.

### QA-2026-10-05-R27-004 (r27-COR-4): skewed-honest began-pairs under a server `until` pay early — bounded over-fire, documented

- **Severity: Low** — Status: **Confirmed** (probe F6), recorded for adjudication as an accepted-bound question.
- A save written on a client clock legitimately ahead of the server's `serverNowMs` has honest stamps `startedAtMs ∈ (until, lastSavedAt]`; the re-anchor cannot distinguish skewed-honest from impossible-authored, so the shift fires and each pair pays up to `lastSavedAt - until` earlier than authored. Bounded by the skew itself and inherent to the fix's premise — flagged so the coordinator can explicitly accept the bound (vs. r26's own preamble which treats post-dating as crafted-only).

### QA-2026-10-05-R27-005: `restoreJobs` fabricates `{specialIngredients: []}` onto witnessless jobs — pre-existing semantic drift

- **Severity: Nit** — Status: **Confirmed** (probe W4), **pre-existing** (present at `3588ebf9`, only re-indented at r26) — recorded, not a finding against this batch.
- The unconditional tail clone `reservation: { ...job.reservation, specialIngredients: (… ?? []).map(...) }` spreads `undefined` into `{ specialIngredients: [] }`: a reservation-less job exits restore *carrying* a reservation-shaped object. Deny-equivalent (settle fails on `costScale` either way, and admission refused witnessless jobs before too — no wedge change), but consumers reading `reservation !== undefined` now see a phantom. Worth one line so the diff isn't blamed later.

### QA-2026-10-05-R27-006: `learnedSkillIds` cap shares the generic 'phải là mảng string' issue text

- **Severity: Nit** — the `>1024` arm at `saveShapeValidation.ts:2326` fires the same message as malformed input; diagnostics can't distinguish cap from corruption without reading the payload.

## Verified-correct claims (rejected candidates)

- **Began-pair ordering invariants**: span preserved exactly (`completesAt - startedAt` unchanged), strict `>` boundary at `startedAtMs == restoreNowMs` (probe W1), lane order handled by `advanceWorkerLanes`' internal dueMs sort — restore order irrelevant. Mixed arrays shift only the post-dated entries; in-flight pairs untouched.
- **Digest re-derive**: covers `startedAtMs`/`completesAtMs` + specials (probe W3 — `alchemy_thong_mach_dan` specials-bearing reservation replays `null`); witnessless jobs never get a fabricated digest (deny preserved, W4). Re-derive is recipe-independent by design so `recipeId`-miss jobs keep a coherent witness.
- **settleNowMs ≤ restoreClockMs**: re-anchored pairs can never double-settle offline then re-fire — `settleNowMs = min(lastSavedAt+elapsed, authorityNow, now)` is never above the clock that produced the shift.
- **Honest pre-r26 regression**: absent authority → legacy client clock → verbatim restore (probe W7); honest deadline values inside each bound pass untouched on all four channels (W1/W5/W6, plus r26 probes W1/W2 already green).
- **Concurrency/ordering in restoreJobs**: synchronous map over a wholesale `this.jobs` swap — no interleaving exists in the restore path; repeated restores are deduped by the payload-identity guard upstream.
- **Envelope shape**: refuses carry `code:'SAVE_INVALID'` + `retryable:false`, joined/queued callers resolve with the refused result, adapter untouched (r26 probe D-suite still green); `DATA_REFUSE_CODES` consumers read the exported set.
- **Other began-time siblings swept**: `persistentTimedEffects.appliedAtMs/expiresAtMs` were re-anchored in an earlier round (`boundTimedEffectClocks`), `autoFarmStage.lastCheckedMs`/`buildings[].lastCollectedAt`/`quest.lastDailyResetAtMs` carry no `≤ lastSavedAt` admission pin → post-dated values are deny-side only, no write-wedge — consistent, not findings.

## Verification Evidence

| Command/observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/services/save/auditR27Cor.probe.test.ts --pool=threads` | 18/18 pass | deterministic; `Date.now` mocked at 1_725_160_000_000; worktree at `a9a9c37c` |
| `git diff a9a9c37c~1 a9a9c37c` | reviewed in full | four-seam diff, envelope, caps, null-degrade |
| r26 probe suite `auditR26Cor.probe.test.ts` | still green at a9a9c37c | regression baseline |

## Gaps and Residual Risk

- No live server available: the `serverTimeUtc → untilMs` corruption story is exercised at the `restoreFromSave` boundary with a hand-supplied authority object; the Supabase parse path is source-verified (`parseTimestampMs` returns any parseable finite ms — e.g. `"1970-01-20"` parses small-but-finite).
- F1's "instant grant" magnitude is bounded by in-flight inventory; no claim made about unbounded minting.
- The decompose channel under corrupt-low authority fires at most one early cycle at tick (rebase to `now+cycleMs`); the 24h `settleOffline` replay arm is gated by `settleNowMs` which collapses to the same low stamp — verified consistent.

## Pre-existing Failures

- `verifyAlchemyJobReservation` verify order (digest before `Array.isArray(specialIngredients)`) — predates r26; r27-COR-2 records the interaction, root-cause fix belongs to the next batch.
- `restoreJobs` unconditional reservation clone → phantom `{specialIngredients: []}` on witnessless jobs — predates r26 (Nit, R27-005).
