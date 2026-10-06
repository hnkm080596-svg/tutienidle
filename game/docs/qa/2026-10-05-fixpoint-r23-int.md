# QA Review: fixpoint r23 INT — integration coherence of the r22 batch

- Date: 2026-10-05
- Mode: quick (scoped INT audit)
- Verdict: **PASS WITH EVIDENCE** (dispatch PASS/FAIL frame: **PASS** — no Medium+; the r22 batch composes coherently at every audited seam)
- Audit commit: `da0d553d` ("fixpoint r22" batch: `|x| < 2^52` admission bound on every persisted timestamp; stackable expiry clamped at restore like siblings; stackable writer clamped at `2^52 - 1`; `autoWorkerCapacity <= 65536`; O(1) insight drain; r20 hang probe on `--pool=threads`)
- Task-owned paths: `game/src/services/save/auditR23Int.probe.test.ts` (new, 11 probes), `game/docs/qa/2026-10-05-fixpoint-r23-int.md` (this file)

## Scope and Risk Map

The five dispatched seams:

- **(a) `persistentTimedEffects` consumers + dual-clamp coherence** — `stores/player.ts` `boundTimedEffectClocks` (:119-153, restore map, authority epoch `provenance + 24h`) vs `payoutExpiresAtMs` (:171-185, payout copy, payload epoch `lastSavedAt + 24h`); readers: `getActiveTimedModifiers`/`tickTimedEffects` (map copy), `splitCultivationSpeedWindow` segments + `percentAtSave`/`liveTltPercent` (RAW payload at `lastSavedAt`, deliberate r16-INT-01), restore fold/`isCurrentShapeModifier` (modifier shape, not clocks).
- **(b) 2^52 gate vs derived cursors** — `offlineSinceMs`/`settleNowMs` (`GameManagerSaveRestore:409-429`), `autoFarmStage.lastCheckedMs` (`GameManagerAutoFarmOps:214-387`), `decompose.nextCycleAt` (`DecomposeSystem:146-320`), `quests.lastDailyResetAtMs` (`QuestManager:147-200`), `buildings[].lastCollectedAt` (seconds-domain, `BuildingManager:39-54` / `BuildingSystem:322-349,420-456`), `workerCycles`/`alchemyJobs` deadline pairs, `tribulation.cooldownUntil`, `seededPending` field-epoch re-stamp (`ProductionOffline:184-194`), `idleSkillInsightDaily.dayBucket` (day index, `requireNonNegativeNumber` :2462-2481).
- **(c) writer clamp vs save-shape round-trip** — `applyTimedEffect` merge arms (`GameManagerPersistentEffectOps:307-364`) → `buildGameSave` → `validateGameSaveShape`.
- **(d) capacity pin interplay** — `autoWorkerCapacity > 65_536` pin (:1033-1045) + F-W-16 `chi_hien_quan` existence pin (:4354-4370), same path `player.autoWorkerCapacity`.
- **(e) stale comments/docs contract drift** — sweep for residual "stackable expiry unboundable" / "upstream pins keep inputs finite" claims.

Escalation decision: none — audit-only wave, no production edits, no save/cloud protocol change.

## Invariant Ledger

| # | Hypothesis | Check | Result |
|---|------------|-------|--------|
| H1 | `boundTimedEffectClocks` and `payoutExpiresAtMs` can disagree so that payout pays a **dead-in-map / live-in-payout** buff or **vice versa** | Dead classification is the SAME predicate in both arms (`expires <= lastSavedAt`); divergence is live-arm only, exists exactly when `authorityNowMs < lastSavedAt` (marker ahead of authority: fast-clock save or crafted future marker under cold-boot), and is one-directional: `map bound = min(lastSavedAt, until)+24h <= lastSavedAt+24h = payout bound`. **Reversal (live-in-map/dead-in-payout) is impossible by construction.** The reachable direction — live-in-payout while the map parks the record at `until+24h` — pays at most the server-approved width at the authored rate (≤25% TLT), positioned in the payload epoch as designed (r16-COR-1). Executed: probe A1 pins divergence+dir­ection+payout, A2 pins convergence when `untilMs > lastSavedAt`, A3 pins dead-arm agreement | **Coherent — divergence real but bounded and one-directional** (probe) |
| H2 | Non-finite `lastSavedAt` splits the two arms differently | Map → live arm (`provenance = authorityNow` → `until+24h`); payout → verbatim raw (unbounded) — genuinely divergent, BUT the gate rejects the marker (`isBoundedTimestamp`), and even bypassed, `payloadWindowStartMs = NaN` → window end NaN → `splitCultivationSpeedWindow` bounds collapse → `calculateOfflineProgress(NaN)` → NaN payout, never a mint | **Coherent** (gate + NaN dead-end; no mint path) |
| H3 | A derived cursor still lands on/past the 2^53 mechanism line or mints an out-of-domain write | Census per cursor (probes B1-B6 + source): `offlineSinceMs` outermost admitted marker derives in-domain post-2^52 (r22-int boundary arithmetic); far-future marker → seeds lanes at future cursor → deny-park, `|4.5e15| < 2^53` no wedge (B2). `settleNowMs` min-clamped at `authorityNow`. `autoFarmStage.lastCheckedMs` re-anchors on EVERY restore branch incl. `elapsed<=60`/`live-replacement` `settle(0)` (B3) and again each world tick; unresolvable stage drops the record at `reconcileAutoFarmRuntime`. `decompose.nextCycleAt` rebases `> now + cycleMs → now + cycleMs` (B6); restore `floor`/`max(0)`/merge-`max`. `lastDailyResetAtMs` → `min(stamp, Date.now())` field epoch (B4). `lastCollectedAt` seconds-domain → `> nowSeconds → nowSeconds` (B5); claim re-pins `currentTime - fraction/rate`. `workerCycles`/`alchemyJobs` carry `startedAtMs <= lastSavedAt` + exact span pins → deadline ≤ `lastSavedAt + span` — **far-future deadlines rejected at the gate, stronger than the 2^52 bound** (B1). `cooldownUntil` verbatim → bounded deny-park. `seededPending` shift = real skew only | **Coherent — every cursor is restore-clamped, re-stamped into its field epoch, or gate-closed tighter than 2^52** |
| H4 | `applyTimedEffect → buildGameSave → validateGameSaveShape` can self-reject | Stackable arm clamps `2^52 - 1` (r22-COR-1, re-executed in C1). Non-stackable `max` arm: operands are admitted writer stamps → result ≤ max admitted envelope; for `tu_linh_tran` the admission envelope (`lastSavedAt + 24h + 7d`) still contains the merge output at next save since `lastSavedAt'` advances to save-now (C1). A crafted non-stackable record inside a regen group is unreachable — the shape pin fixes `durationStackable === authored` (every authored regen pill is `stackable: true`). Restored map stamps satisfy `stored <= max(now, provenance+24h)` → always inside the admitted timestamp domain | **Coherent — no self-rejection path** (probe C1) |
| H5 | `capacity > 0` ∧ `> 65536` ∧ no CHQ → contradictory/duplicate messaging | Two DISTINCT issues fire on `player.autoWorkerCapacity`: mechanism cap (`'vượt trần slot cơ chế 65536'`) + F-W-16 existence (`'> 0 yêu cầu tồn tại instance chi_hien_quan trong buildings'`) — independent contract statements, distinguishable repairs (D1). Under-cap + no CHQ → F-W-16 only; `= 0` → clean; CHQ present → clean (stale capacity recomputed at restore, `GameManagerSaveRestore:334-342`). A fractional capacity cannot reach the mechanism (admits only with CHQ present → recomputed to `1 + level*2` integer; under scope-hidden `betaEffectiveWorkerCapacity` returns flat 3) | **Coherent** (probe D1) |
| H6 | Stale "unboundable stackable expiry" / "keep inputs finite" contract claims remain | `player.ts:88-153` docblock + `saveShapeValidation:1678-1685` correctly describe the r22 contract ("forward bound lives at the restore seam"). `WorkerLaneAdvance` "guard only rejects non-finite / huge finite honored by design" is mechanism-truth (admission is a different layer) — accurate. `materials.ts` "effectively unbounded" is stack-count domain — unrelated. Prior-wave docs are dated records. **One live drift found**: the decision ledger — see Finding 02 | **Finding 02 (Low)** + **Finding 01 (Nit)** + **Finding 03 (Nit)** |
| H7 | `accrueCultivationInsight` O(1) `steps*threshold` can overshoot `acc` → negative residue → next-save reject | Numeric sweep: `floor(acc/t)*t > acc` DOES occur for non-integer `t` (π, 0.1, 1/3: ~1ulp). For **integer** thresholds the round-up zone is unreachable — `k*t` sits ≥1 ulp below the rounding boundary of `acc/t` (empirically swept `t ∈ {250..4096}, k<64` → zero negatives; `t=1024,k=8` binade-edge demo rounds DOWN). All authored `cultivationPerInsight` are integers (1000/1500/2000) and `getInsightPerCultivation` sums them → integer. Any residue also self-heals on the next accrue (`acc += gained` lifts it back ≥0) | **Coherent** (authored domains keep the edge unreachable; documented for the ledger) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run src/services/save/auditR23Int.probe.test.ts` | **11/11 passed** | Probes A1-A3 (dual clamps), B1-B6 (derived cursors), C1 (writer round-trip), D1 (capacity interplay) — all executed, not source-only |
| `npm run type-check` (worktree) | clean | `vue-tsc --build` exit 0 |
| Float sweep `floor(acc/t)*t > acc` | negative residue only for non-integer thresholds | node one-off; unreachable under authored integer thresholds |
| Store-level restore executed | `playerStore.restoreFromSave` with cold-boot authority | map stamps + `offline.cultivation` observed end-to-end |

## Findings

### QA-2026-10-05-r23-int-01: payout-bound comment overclaims "equal whenever a payout can run"

- Severity: **Nit**
- Status: **Confirmed** (source + probe A1)
- Invariant: comments describe the current contract.
- Actual: `player.ts:410-411` — "(the payout-epoch sibling of the restore map's bound: `lastSavedAt + dur` vs `provenance + dur` - **equal whenever a payout can run**, strictly tighter under a fast clock)". Under cold-boot with `lastSavedAt > untilMs` a payout **can** still run (the authorized width re-anchors at the payload marker, r16-COR-1) while the bounds diverge — probe A1 observes `stored = untilMs + 24h` vs payout bound `lastSavedAt + 24h`, with the buff covering the full approved window. The semantics are correct (map bound ≤ payout bound always); only the "equal whenever" claim is wrong.
- Test file: `auditR23Int.probe.test.ts` (A1/A2).
- Blast radius: none — wording.

### QA-2026-10-05-r23-int-02: `appliedAtMs` clamp anchors authority epoch while sibling dead arm anchors field epoch

- Severity: **Nit**
- Status: **Confirmed** (source; consequence analyzed, not a reachable defect)
- Invariant: clamp anchors use the epoch the field's contract reads.
- Actual: `boundTimedEffectClocks` (`player.ts:125-127`) clamps `appliedAtMs = min(raw, nowMs)` on `authorityNowMs`, while the dead-expiry arm deliberately clamps on `min(nowMs, Date.now())` — the field epoch (r15-COR-A comment). A crafted `appliedAtMs ∈ (clientNow, untilMs]` under `payload.lastSavedAt > clientNow` stores a stamp above the next save's `lastSavedAt` claim — but F-TC9-1 already rejects the RAW crafted value identically (`stored > clientNow' ⟹ raw > clientNow'`), so the clamp is a strict subset: it can never mint a rejection the payload itself would not have produced, and it can repair a raw value (`min` downward) the payload could not. Asymmetric-but-harmless; flagging for the ledger since the same function mixes both epoch anchors on purpose-looking lines.
- Test file: none beyond A1-A3 (no behavioral delta reachable).
- Blast radius: none — the divergence is confined to crafted inputs and changes no verdict.

### QA-2026-10-05-r23-int-03: `decisions-needed.md` D-2026-10-05-01 is stale — the ruling it asks for was implemented in r22

- Severity: **Low**
- Status: **Confirmed** (source + r22 diff)
- Invariant: the open-decision ledger reflects open questions.
- Actual: `docs/qa/decisions-needed.md:6-24` still asks the product owner to choose between "cap the accepted remaining duration at restore (`expires <= lastSavedAt + K`)" and "accept the residual permanently", on the premise that "Validator and restore both have to let it through". r22-AUT-1 already shipped the K-cap option: `boundTimedEffectClocks` + `payoutExpiresAtMs` bound every live expiry at `provenance/lastSavedAt + TU_LINH_TRAN_DURATION_MS` (K = 24h), and the r22 adjudication recorded the residual (chains > ~360 drinks lose their tail past save+24h). A future coordinator triaging the ledger would re-litigate a resolved question — or worse, implement a second cap on top of the first. The item should be closed (mark the implemented ruling) or re-scoped (e.g. whether K=24h is the product-correct K, and whether admission should additionally pin `expires - appliedAt` span for stackables — currently unbound at admission by design, bounded at restore).
- Test file: none (doc drift).
- Blast radius: process-only.

## New or Changed QA Tests

- `game/src/services/save/auditR23Int.probe.test.ts` — 11 probes:
  - **A1** marker ahead of authority: map stores `until+24h`, payout pays `lastSavedAt+24h` coverage over the approved window — divergence + direction pinned.
  - **A2** authority ahead of marker: both arms coincide at `lastSavedAt+24h`.
  - **A3** dead-at-save record: verbatim payload stamp on both reads, zero buff coverage.
  - **B1** far-future `workerCycle.completesAtMs` (2^52-1): gate-closed by `startedAtMs<=lastSavedAt` + span pins; mechanism deny-parks an injected one, re-persisted in-domain.
  - **B2** derived far-future `offlineSinceMs` (2^52-1) seeds a future-dated lane: zero completions, `|stamp| < 2^53` → no mechanism wedge.
  - **B3** `autoFarmStage.lastCheckedMs = 2^52-1`: `settle(0)` re-anchors to now on the ≤60s/live-replacement restore branch.
  - **B4** `lastDailyResetAtMs = 2^52-1` → `min(stamp, nowMs)` at restore.
  - **B5** `lastCollectedAt = 2^52-1` seconds → clamped to `nowSeconds`.
  - **B6** `decompose.nextCycleAt = 2^52-1` → tick rebases to `now + cycleMs`.
  - **C1** stackable re-drink on a parked `2^52-1` expiry clamps at the domain edge; non-stackable TLT `max` merge lands inside the TLT admission envelope; the resulting save re-validates.
  - **D1** capacity `70000` + no CHQ → exactly two issues on `player.autoWorkerCapacity`; under-cap/no-CHQ → F-W-16 only; `0` or CHQ present → clean.

## Gaps and Residual Risk

- The A-series probes exercise `playerStore.restoreFromSave` directly (store path, real clamps) but not `restoreGameSession` end-to-end; `saveOps.restoreFromSave` ordering (settle calls) is covered by source trace + prior-wave probes.
- `tickTimedEffects` drops restored-dead records on the next tick — verified by source; not probed at runtime.
- Sub-pin far-future parking remains the accepted residual class (r22 adjudication): expiry/cursor fields bounded at restore, deadline fields gated tighter (`startedAtMs <= lastSavedAt` + span). No new class found.

## Pre-existing Failures

None observed in the audited scope.

## Learned-Defect Loop

| ID | Component | Trigger pattern | Missed invariant | Why prior QA missed it | Regression test | Domain-pack weighting recommendation |
|---|---|---|---|---|---|---|
| QA-2026-10-05-r23-int-03 | `docs/qa/decisions-needed.md` | a fix lands but the decision ledger item that motivated it stays OPEN | ledger items must be retired when the code adjudicates them mechanically | adjudication docs record residuals but nothing sweeps `decisions-needed.md` for implemented rulings | manual sweep each wave (this audit) | add "close-or-rescope open decision items affected by the wave" to the wave checklist |
