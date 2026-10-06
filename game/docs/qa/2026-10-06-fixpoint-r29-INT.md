# QA Review: fixpoint r29 — INT (integration coherence) audit of the r26 + r27 + r28 batches

- Date: 2026-10-06
- Mode: deep (scoped to cross-layer agreement: gates, seams, authority sources, envelopes, mount contracts)
- Verdict: **PASS WITH EVIDENCE** — 0 Critical / 0 High / 0 Medium / 3 Low / 3 Nits. Every r28 fix lands coherently at its seams: all six `saveIssue.report` sites pair with `bootFlow.fail()`, the `'local'` scope verdict is correct for every reachable refuse path, the `clear()` ok-arm sweep is consistent (and its residual coverage gap is unreachable-but-harmless), the tick guard covers both alchemy settle callers, and `DATA_REFUSE_CODES ⊆ authorityStateForError` maps cleanly to `'recovery'`. The open items are sibling-coverage gaps on ungated feeds (decompose channels, `startJob` origination, local-tier sim freeze) plus doc/cost nits — all deny-or-bounded, none reachable through honest writers.
- Audit commit: `faa893c1` on `codex/hoa-cau-fireball-vfx` (own clone at `/home/ubuntu/audit-r29-int`, checked out exactly)
- Probe: `game/src/services/save/auditR29Int.probe.test.ts` — 11 probes, all green (`npx vitest run src/services/save/auditR29Int.probe.test.ts --pool=threads`, vitest 4.1.11, node 22)
- Type-check: `npm run type-check` clean (vue-tsc build, exit 0 — the ~15 pre-existing `src/ui-preview/` TS2307 are the adjudicated out-of-scope residual).
- Task-owned paths: `game/src/services/save/auditR29Int.probe.test.ts`, `game/docs/qa/2026-10-06-fixpoint-r29-INT.md` only (no production edits).

## Scope and Risk Map

The r29 question: do the r28-corrected layers still agree *with each other* at every consumer and seam — report/fail() pairing vs the mount gate, scope provenance vs sibling report arms, `clear()` on the ok arm vs every report site, the tick guard vs other settle callers (`settleOffline` feeds, live tick drivers, restore-time settles), cap-guard parity vs sibling validators, envelopes vs `authorityStateForError` arms.

The r28 batch's five moving parts were re-attacked first (foldable-witness re-derive, downstream talentLevels cap guards, the persistPlayer refuse arm's `'local'` scope + `fail()` pairing + ok-arm `clear()`, the tick/settle nowMs guard, the accepted-residual list), then siblings of each class (adjacent stamp writers, adjacent collections, adjacent settle channels, adjacent throw paths).

## Invariant Ledger

| ID | Pair under test | Contract that must agree | Attack operator | Observable oracle | Probe | Result |
| --- | --- | --- | --- | --- | --- | --- |
| INT-P1 | `tick` guard vs in-flight queue | non-finite/≥2^53 clock must zero-advance, preserving jobs | `tick(NaN\|±2^53\|+Inf)` on a due job | jobs preserved, no events, no pill | P1 | holds |
| INT-P2 | `settleOffline` vs `tick` | the settle caller inherits the one guard (no parallel settle path) | `settleOffline(NaN)` / `(2^53)` | 0 settled, queue intact; honest clock settles once | P2 | holds |
| INT-P3 | decompose channels vs same drivers | sibling settle/live channels should share the guard doctrine | `decompose.settleOffline(1e300)`; `decompose.tick(NaN)` | settle loop hits its 5000 ceiling + mints output; NaN tick mints once AND poisons `nextCycleAt` to NaN so every later finite tick mints again | P3 | **divergence confirmed (Low-1)** |
| INT-O1 | `startJob` origination vs tick guard | a hostile clock must not mint a corrupt-deadline job | `startJob(..., nowMs=NaN)` then `tick(finite)` | `completesAtMs` NaN, witness self-consistent (verify passes), next finite tick settles → pill lands | O1 | **divergence confirmed (Low-2)** |
| INT-O2 | `startJob` boundary | huge clock direction | `startJob(..., 1e300)` | `completesAtMs === 1e300` (span absorbed below float ulp) → job parks forever | O2 | holds (deny direction) |
| INT-T1 | coded refuse vs remote authority | `'recovery'` terminal freezes the tick loop | `observeSaveResult(unavailable, SAVE_INVALID, retryable:false)` | state `'recovery'`, `canMutate()` false | T1 | holds |
| INT-T2 | coded refuse vs local authority | the mounted error surface claims terminal — the sim should agree | same refuse, no `reconnect` dep | `observeSaveResult` early-returns (`:287-291`); `authorityState` stays `'ready'`, `canMutate()` true → `useAppLifecycle` tick gate (`:238`) never flips | T2 | **divergence confirmed (Low-3)** |
| INT-T3 | `clear()` ok arm vs refuse reachability | the sweep must be reachable in the refuse scenario | remote refuse then any write | terminal `'recovery'` → `canMutate()` false → `persistProgress` gated at `:313` → `clear()` unreachable post-refuse; harmless (store re-inits on reload) | T3 | holds (coverage note, not a defect) |
| INT-C1 | `requireArray` cap vs `validateStatModifierEntries` | refuse without paying the sibling walk | 1025-element `player.modifiers`, bad element at [1024] | cap issue + `player.modifiers[1024]` both present | C1 | **divergence confirmed (Nit-1)** |
| INT-C2 | `nodeLevels` cap vs the three sibling walks | refuse without paying `:3158/:3225/:3253` | 1025-key `nodeLevels` incl. `major_quan_the:1` | cap issue + `player.nodeLevels.major_quan_the` grant-source issue (produced ONLY by the `:3225` walk — the root walk is skipped) | C2 | **divergence confirmed (Nit-1)** |
| INT-C3 | `talentLevels` r28 guard census | over-cap record yields ONLY the cap issue | 1025-key `talentLevels` | exactly one `player.talentLevels` issue, no per-key issues | C3 | holds (control) |
| INT-R1 | report → mount pairing census | every `saveIssue.report` site pairs `bootFlow.fail()` | source-level census | `App.vue:603-604`, `App.vue:718-719`; `useAppLifecycle.ts:409-414`, `:429-430`, `:479-480`, `:568-569`, `:691-692` — 7 sites, all paired | R1 (source audit) | holds |
| INT-R2 | scope provenance vs `remoteResettable` | `'local'` arm never offers `resetCharacter()` | report `'local'` under both tiers | `remoteAuthoritative && scope==='remote'` → false | R2 (store probe T3) | holds |
| INT-ENV | `DATA_REFUSE_CODES` vs `authorityStateForError` | both codes map to `'recovery'` | mapping census | `SAVE_INVALID`/`SAVE_TOO_LARGE`/`CONFIGURATION_ERROR` → `'recovery'` | T1 + source | holds |

## Findings

### r29-INT-1 (Low, confirmed): `DecomposeSystem.tick`/`settleOffline` lack the nowMs guard the r28 batch added to `AlchemySystem.tick` — same drivers, opposite verdicts

**Mechanism chain (probe P3):**

- `GameManagerTickOps.ts:212` feeds `alchemySystem.tick(Date.now())`; `:264` feeds `decomposeSystem.tick(Date.now())`. `GameManagerSaveRestore.ts:497` feeds `decomposeSystem.settleOffline(settleNowMs, offlineSinceMs)`; `:533` feeds `alchemySystem.settleOffline(..., settleNowMs, ...)`. The SAME computed cursors drive both domains.
- `DecomposeSystem.settleOffline` (`DecomposeSystem.ts:284-330`) has internal bounding (`settled < 5000`, O(1) fast-forward capped at `nowMs`, window clamps) but NO `Number.isFinite(nowMs)`/`2^53` gate: `settleOffline(1e300, since)` computes `windowStartMs ≈ 1e300 - cap`, fast-forwards `nextCycleAt` to it, then runs the settle loop to its 5000-cycle ceiling, consuming/minting per `runOneCycle`. Probe: `settled === 5000`, ore-backed output drained > 0.
- `DecomposeSystem.tick(NaN)` is worse than a bounded mint: `nowMs < this.nextCycleAt` is false → `:190` rebases `nextCycleAt = NaN + cycleMs = NaN` → `runOneCycle()` mints once → every subsequent finite tick compares `x < NaN` → false → mints again. The timer stays poisoned — a per-tick mint for the rest of the session. Probe P3 asserts `!Number.isFinite(nextCycleAt)` after `tick(NaN)` and ≥2 output entries after two finite ticks.

**Reachability:** production callers pass `Date.now()` (honest); `settleNowMs`/`offlineSinceMs` are `Math.min`-clamped against `Date.now()`/`authorityNowMs` upstream and `lastSavedAt` is pinned to `isBoundedTimestamp` by the save validator — no gated feed can supply NaN/1e300. The channel is additionally dormant in the current beta flag set (`equipmentOreDecompose: false` → `isScopeHidden` early-returns at `:154`/`:286`), so the gap is only exercisable by ungated callers/tests, or if the flag flips while an ungated feed exists.

**Severity rationale:** Low — same class as the adjudicated r28-AUT-2 input surface (ungated feeds only), but strictly asymmetric: the fix's stated rationale was "guard parity with `advanceWorkerLanes`", and parity is incomplete across the two sibling domains those same drivers feed. `advanceWorkerLanes` additionally pins slots/budget/pending stamps; decompose pins none of its clock inputs.

### r29-INT-2 (Low, confirmed): `AlchemySystem.startJob` has no nowMs bound — a NaN clock bakes a NaN deadline the tick guard never inspects (grant-direction)

**Mechanism chain (probe O1):**

- `startJob` (`AlchemySystem.ts:448-585`) stamps `completesAtMs = nowMs + alchemySecondsFor(...) * 1000` and `startedAtMs = nowMs` with no finiteness/range check (`:538`, `:577-578`).
- `startJob(..., nowMs=NaN)` returns `ok:true`, mints a job whose `completesAtMs` is `NaN`, and folds a self-consistent reservation digest over the NaN stamps (`alchemyJobReservationDigest` stringifies field values — `'NaN'` folds identically on both sides, so `verifyAlchemyJobReservation` returns `null` at settle).
- `tick(finite)` then hits `nowMs < job.completesAtMs` → `finite < NaN` → false → settle arm → verify passes → `jobSuccessPercent` rolls → pill lands. Probe O1: `pills.getAmount(recipe.pillId) === 1`, success event emitted.
- The r28 guard inspects the *clock argument*, not the *stored deadline* — it cannot see a deadline polluted at origination. Symmetric sibling: `startJob(..., 1e300)` mints `completesAtMs === 1e300` (span absorbed below ulp) → parked forever + occupies the live slot budget (deny direction; probe O2).

**Reachability:** the only production caller `GameManagerAlchemyOps.ts:182` passes `Date.now()`; `restoreJobs` writes are covered by the validator's `isBoundedTimestamp` pins. Ungated feeds only.

**Severity rationale:** Low — grant-direction (a pill mints early) but requires a caller feeding NaN `nowMs`, which no production path does. It is the exact adjacency the task brief asked to attack (sibling stamp path of the same defect class r28-AUT-2 guarded).

### r29-INT-3 (Low, confirmed): the refuse arm mounts the "terminal" error surface but the sim keeps ticking under local authority — remote/local tier asymmetry

**Mechanism chain (probes T1/T2):**

- Remote tier: `persistPlayer` → `observeSaveResult` maps the coded refuse to `'recovery'` via `authorityStateForError` → `enterTerminal` → `onPause('terminal')` → `pauseSimulation` clears handles; `canMutate()` false → the `useAppLifecycle` tick interval (`:237-238`) stops calling `onTick`. THEN `saveIssue.report` + `bootFlow.fail()` mount `SaveIncompatibleScreen`. The world is frozen behind the terminal surface. Consistent.
- Local tier (`reconnect` dep undefined, `App.vue:654-660`): `observeSaveResult` early-returns at `:287-291` ("Local-only mode has no authority to lose") → `authorityState` stays `'ready'` → `canMutate()` true → the tick loop keeps advancing `GameManager.update` behind the mounted `SaveIncompatibleScreen` for the rest of the page lifetime. `persistProgress` is gated at `:313` (`entryStage !== 'game'`) so no writes land — the divergence is sim-advance, not persistence.
- Reachable under local authority via `driveSave`'s client-provenance refuses (`OUTGOING_UNSERIALIZABLE`/`OUTGOING_ADMISSION_REJECTED` → `SAVE_INVALID` non-retryable) — the validator firing on the outgoing wire is the honest-reachable path (a runtime-corrupt payload, e.g. a future hostile field write).

**Severity rationale:** Low — behaviorally contained (no writes, exit requires reload/reset which resolves the wedge) but it is a real semantic asymmetry the r28 fix surfaced: pairing `report()` with `fail()` made the surface claim "terminal" while only the remote tier actually halts the world. The codebase itself treats "the world kept advancing behind a terminal claim" as a bug class (`useAppLifecycle.ts:629-631` comment on the firstSave arm). Fix would be a `pauseSimulation()`/authority-neutral gate on the local arm — flagged for the coordinator, not patched (QA scope).

### r29-INT-4 (Nit, confirmed): cap-guard parity incomplete — sibling walks still pay post-refuse iteration for `nodeLevels` and all `requireArray`/`optionalArray` collections

**Mechanism (probes C1/C2/C3):**

- `nodeLevels` refuses over-cap at `:2026` via `else if` — the root walk is skipped — but the sibling walks at `:3158`, `:3225`, `:3253` take `if (nodeLevels !== undefined)` (the local var set at `:3041` by `isObject` alone, not by the cap) and iterate the full record, including `PROGRESSION_NODE_BY_ID.get` per key ×3. Probe C2: over-cap record with `major_quan_the:1` yields BOTH `player.nodeLevels` (cap) AND `player.nodeLevels.major_quan_the` (grant-source issue producible only by the `:3225` walk).
- `requireArray` (`:455-457`) and `optionalArray` (`:481-483`) push the cap issue AND return the array → every element validator still walks the over-cap collection: `validateStatModifierEntries` (probe C1: `player.modifiers[1024]` issue lands), `validateAlchemyJobsSave` (worst case: `verifyAlchemyJobReservation`'s per-job digest fold on an already-refused array), equipment/quest/technique validators.
- Control (probe C3): over-cap `talentLevels` yields exactly one issue — the r28 guards hold where they were applied. The parity gap is real but cost-only: every iteration runs on an already-refused payload; no verdict change, no mint path. Same class and same severity as the r28-COR-Nit fix (just incomplete sibling coverage — `requireArray`'s comment at `:452-454` claims every array is "honestly bounded by an authored roster", which was never true for the element validators).

### r29-INT-5 (Nit, confirmed by source + SupabaseCloudSaveService:968-988): the persistPlayer arm's `'local'` verdict is right; its justification comment is wrong

`App.vue:597-602` (paraphrased comment): the refuse codes "only fire when the adapter was never invoked" — but `SupabaseCloudSaveService.save()` maps a server-side `REJECTED` outcome (`SAVE_INVALID`/`SAVE_SCHEMA_UNSUPPORTED`/`SAVE_TOO_LARGE`) onto the same `unavailable(code ∈ DATA_REFUSE_CODES, retryable:false)` envelope. The adapter CAN have been invoked and refused by the server. The `'local'` verdict still lands correctly — a rejected commit never lands bytes, so the remote row provably holds last-good (same doctrine as the pending-conflict arm's `'local'`) — but the recorded mechanism misdescribes the path set, which matters for the next auditor: under a server refuse the *journal* is cleared at `:971-973` (reload is clean), while under the client refuse it was never written. Recommendation: reword to "the refused bytes never committed — remote holds last-good on both the never-invoked and the server-rejected paths".

### r29-INT-6 (Nit, confirmed): `BackendStatus.ts:39-42` comment is stale post-r28

`DATA_REFUSE_CODES`'s comment still claims the codes "arm the remote-scope save-issue surface" — after r28 the persistPlayer arm always passes `'local'`. Doc-only; the set membership and every consumer are correct.

### r29-INT-7 (Nit, listed): `saveFailureNotified` dedupe flag latches + toast double-signal on the refuse turn

The refuse arm runs AFTER `recordSaveOutcome`/`autosaveFailed` toast pushes — the player sees a toast AND the corrupted surface in the same turn, and `saveFailureNotified` stays `true` (only the ok arm resets it; unreachable post-refuse under remote per T3). Cosmetic noise; the surface is the correct escalation. Also noted: `saveIssue.clear()` has no caller on the `flushSave`/`player.save` quit/update-flush channel — an ok flush would leave an armed status, but under remote the terminal state blocks those writes anyway, and under local the surface is already mounted; no reachable divergence.

## Verified-consistent (rejected candidates)

- **report/fail() pairing census** — 7 sites total (`App.vue:603-604` persistPlayer, `:718-719` onResume reject; `useAppLifecycle.ts:409-414` incompatible/corrupted load, `:429-430` pending-conflict/quarantined, `:479-480` restore rejected, `:568-569` boot-commit refuse, `:691-692` firstSave refuse) — every one pairs `saveIssue.report` with `boot.fail()`/`bootFlow.fail()`; the mount gate (`SaveIncompatibleScreen` renders only under `RouteMount v-else-if="entryStage === 'error'"` + `v-if="saveIssue.status"`, `App.vue:1218-1225`) is reachable from each.
- **Scope provenance across all arms** — persistPlayer `'local'` (bytes never committed, client OR server-side refused); boot-commit/firstSave `'remote'` (`:518` gated `remoteAuthoritative`, remote head provably uncommittable → remote reset is the only real un-wedge — adjudicated doctrine); onResume `'remote'` (rejected payload IS the server-authoritative bundle, and onResume only exists on the remote tier since `reconnect` is undefined locally); pending-conflict `'local'` (remote head healthy). All consistent.
- **Boot arms' hardcoded `'remote'` under local tier** — previously adjudicated "not a defect" (r28-COR report, `SaveIncompatibleScreen.vue:32`: `remoteResettable = remoteAuthoritative && scope==='remote'` — the mislabel is unreachable for the destructive affordance under local). Re-verified: the commit arm sits inside `if (remoteAuthoritative)` (`:518`) and is locally unreachable regardless.
- **`restoreJobs` foldable guard vs admission verify ordering** — gated saves cannot reach the guard's malformed-witness branch: `validateGameSaveShape`'s alchemyJobs walk (`:3805-3822`) requires `isObject(reservation)` and runs `verifyAlchemyJobReservation` (which names `specialIngredients`/`costScale`/element shape BEFORE the digest fold at `:214-231`). The foldable check is defense-in-depth for ungated feeds; a `{foo:1}` element passes "foldable" but the re-derived digest still mismatches at grant-time verify → deny preserved. Parity note: a malformed-element job under the shift arm gets a re-derived digest (matching shifted stamps) vs verbatim keeping the original — both denied at grant; no verdict divergence.
- **Tick guard vs all settle callers** — `settleOffline` delegates to `tick` (`:742`): one guard covers both. `restoreJobs` takes no nowMs clock into a settle path (only shift decisions). The `fieldEpochShiftMs = max(0, Date.now() - nowMs)` re-stamp in `ProductionOffline`/`WorkerLaneAdvance` seed-roots parked heads — bounded deny direction.
- **Cap parity elsewhere** — every other `Object.entries` walk on player-owned id collections is behind a count cap: `baseStats` `:659`, `talentLevels` root `:790` + both downstream walks `:856`/`:1047` (the r28 adds), `nodeLevels` root `:2026`, `nodeFreePurchaseRecord` `:2312`, `nodeOneShotGrants` `:2330`, `learnedSkillIds` `:2347`, `perfectClearSeconds` `:2473`, quest `active` `:3290`, `completedOnceIds` `:3332`, `questFlags` `:3346`, `validateNonNegativeIntMap` `:538`. Only INT-4's collections remain.
- **Envelopes vs `authorityStateForError`** — `SAVE_INVALID`/`SAVE_TOO_LARGE`/`CONFIGURATION_ERROR` → `'recovery'`; the remote adapter emits `retryable:false` on every armed code; `beginChecking` permits `'recovery'→'checking'` (the only re-enterable terminal — needed for reset→reload); `markReady` does not clear `'recovery'` (only reachable via `acknowledge`/new boot — consistent).
- **Quest cursor channel** — `questManager.restore(..., Date.now())` deliberately takes wall clock, not `restoreClockMs` (documented design; claims cannot retro-date). Consistent.
- **`restoreGameSession` catch → 'rejected' → report+fail** — the throw path degrades through the same surface pairing; coherent.

## Pre-existing / out-of-scope notes (not r29 findings)

- ~15 TS2307 in `src/ui-preview/` — adjudicated out-of-scope residual; type-check passes (they're excluded from the build graph).
- `player.equipment` honest hoard >1024 — escalated residual (D-02), unchanged.
- `OUTGOING_UNSERIALIZABLE` unreachable for honest writers — adjudicated residual, unchanged.
- `saveIssue.report` idempotent overwrite, NaN `cooldownUntil` non-persistence, quest progress/claimed unbounded, decompose `max(live,restored)` merge, skewed-honest began-pairs — adjudicated r28 residuals, re-verified unchanged in behavior.
