# Fixpoint audit r28 — AUT (adversarial exploit)

Auditor: r28-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `1582467f` (r26 batch + r27-COR + r27-AUT/INT fixes). Role: assume the fix
claims are exploitable and break them — mint paths, deny/wedge paths,
self-brick writes, envelope escapes, throw-paths past the fail-closed
wrapper, bypasses around every new guard.

Worktree: `.agent-worktrees/audit-r28-aut` @ `1582467f`. Read-only on
production code; every claim below carries an EXECUTED deterministic repro
in `src/services/save/auditR28Aut.probe.test.ts` (22 tests, all passing —
`npx vitest run <file> --pool=threads`, `@vitest-environment node`,
`Date.now` mocked). Report branch: `devin/audit-r28-AUT-1582467f`.

Verification executed:
- `npx vitest run src/services/save/auditR28Aut.probe.test.ts --pool=threads`
  — 22/22 green.
- Full read of the touched seams at the audit commit:
  `GameManagerSaveRestore.ts` (:349-449 — `restoreClockMs`,
  `elapsedOfflineSeconds`, `settleNowMs`, `offlineSinceMs` + all four seam
  calls :476-540), `ProductionSystem.restoreStates`/:129-184 +
  `ProductionOffline.settleWorkersOffline` (:55-196 — the
  `PRODUCTION_OFFLINE_CAP_SECONDS` budget flow), `AlchemySystem`
  (:150-290 verify order, :376-415 restoreJobs, :585-734 tick),
  `WorkerLaneAdvance` (:26-74 params, :146-173 guard, :235-303 arms),
  `TribulationDirector.restoreRuntime`/:843-883 + `serializeRuntime`/:813-832,
  `TribulationOutcomeService.settleOutcome`/:130-249,
  `TribulationCommitWitness`/fixture, `DecomposeSystem`/:215-330,
  `player.ts` offline payout (:369-499), `OfflineProgressSystem` (all 32),
  `GameClock.calculateOfflineTime`/:79-99 + `DEFAULT_MAX_OFFLINE_SECONDS`,
  `saveShapeValidation.ts` (wrapper :5059-5069, ID caps, stamp/entry pins,
  production :3444-3669, alchemy :3674-3813, quest :3268-3346, tribulation
  :4740-4860, cultivation pins :631-651/:1080-1124/:2288-2295),
  `saveAcceptance.ts` (all 367), `SaveSystem.ts` (:273-318 restoreGameSession,
  :479-638 inspect/load/backup), `SupabaseCloudSaveService.ts` (:290-465
  pending-journal + adoptCommittedPending), `CloudSaveCoordinator.ts`
  (:141-240 driveSave), `BackendStatus.ts` `DATA_REFUSE_CODES`,
  `GameManagerAutoFarmOps.ts` (all 437), `ProductionSystem.ts`
  `rollHiddenChannelRewards` :541-601.

---

## Verdict: PASS WITH EVIDENCE (0 Critical / 0 High / 0 Medium / 2 Low / 3 Nit)

No mint, no wedge, no self-brick, no envelope escape, no throw past the
fail-closed wrapper confirmed against the r26+r27 surface. Every claimed
fix holds under direct attack (V1-V10 below). The two confirmed findings
are same-class hardening gaps reachable only through feeds that bypass the
save validator — today every production feed is gated — and even if reached,
they degrade into the `restoreGameSession` 'rejected' envelope (bounded
deny), not mints. They are adjudication inputs for the fixpoint loop, not
convergence blockers.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R28-AUT-1 | Low | inconsistent hardening / throw-path sibling | `AlchemySystem.restoreJobs` — the r26 shift arm (:386-401) folds `alchemyJobReservationDigest(shifted, job.reservation)` at :399 BEFORE the r27 clone-normalize (`specialIngredients` → `[]` when non-array) at :403-413. A post-dated job carrying `reservation:null`, `specialIngredients:{}`, or `specialIngredients:[null]` still `.map`-throws inside the digest fold — the exact TypeError class r27-AUT-2 closed on the non-shift arm. Same malformed reservation on a non-post-dated job restores cleanly (contrast proven F1c vs F1d). Same-envelope siblings: `restoreStates([null])` throws at `state.siteId` (:137), `restoreJobs([null])` at `job.startedAtMs` (:386), `QuestManager.restore(null)` at `state.active` (:147), `advanceWorkerLanes({pending:[null]})` throws *inside* its own zero-advance `.some` guard (:158-163 reads `cycle.completesAtMs` unguarded). Reachability: ungated feeds only — sole production caller `GameManagerSaveRestore.ts:528` passes `normalizedSave` and the validator rejects every one of these shapes earlier (non-object entry via requireArray/per-entry object checks, malformed specials via `verifyAlchemyJobReservation` 'specialIngredients'). |
| R28-AUT-2 | Low | missing finite-clock guard parity | `AlchemySystem.tick`/`settleOffline` carries no `Number.isFinite(nowMs)` guard — asymmetric with `advanceWorkerLanes` (:150-151, r21-COR-2 doctrine: a non-finite clock zero-advances). `tick(NaN)` and `tick(1e300)` treat every in-flight job as due (`NaN < completesAtMs` is false → settle arm) and mint the whole queue instantly; `tick(-1e300)` parks all. Reachability: ungated feeds only — an ungated `NaN lastSavedAt` propagates through `??`/`Math.min` into `settleNowMs` and the `settleOffline` call (:533) is unconditional; JSON saves cannot express NaN and the validator's `isBoundedTimestamp` rejects it on every gated path. Same feed already mints unconditionally via a forged `completesAtMs`, so incremental surface is thin — flagged for guard parity with the sibling this wave hardened. |
| R28-AUT-3 | Nit | boundary-asymmetry note | A bypassed `NaN`/`Infinity` began-stamp hits every `> restoreNowMs` comparison as "not post-dating" (NaN > x is false) → skips the r26 shift arm entirely → lands verbatim; a `NaN completesAtMs` then settles at the first live `tick` (same F2 class, thin). Similarly `cooldownUntil: NaN` stores NaN but `serializeRuntime` guards `cooldownUntil > 0` so it never persists — deny-equivalent to the admissible `cooldownUntil: 0`. Not actionable beyond the F1/F2 guards. |
| R28-AUT-4 | Nit | pre-existing hygiene (not the delta) | `auditR25Int.probe.test.ts` carries 3 non-ASCII comments (Greek `Δ`) that trip `tests/architecture/asciiComments.test.ts` at this commit; unrelated to the r26+r27 surface. Also `src/ui-preview/*` has ~15 pre-existing TS2307 missing-module errors under `tsc -p tsconfig.app.json` — pre-existing at 1582467f, none from this audit's files. |
| R28-AUT-5 | Nit | self-authored quest fields | `quests.active[].progress`/`claimed` have no authored-goal bound — a crafted save claims a quest early, but the mint is only the authored quest reward (same class as craftable `completedOnceIds`; deny-equivalent/informational residual). |

---

## Attack verdicts — every fix claim held (V1-V10)

**V1 — r26 `restoreStates` began-pair shift.** Post-dated `workerCycles`
pair `(currentMs+60_000, +60_000+MORTAL_CYCLE_MS)` re-grounds to
`[currentMs, currentMs+span]` with span preserved; an in-flight pair
(`currentMs-5_000`) and a boundary pair (`startedAtMs == restoreNowMs`,
strict `>`) are untouched. Probe: `V1`.

**V2 — r26 `restoreJobs` shift + digest re-derivation.** Same pair shift;
`reservation.digest` re-derived over the shifted stamps — the witness still
replays (`verifyAlchemyJobReservation` → null) and the digest equality is
asserted directly. Probe: `V2`. (Note: this arm is where R28-AUT-1 lives —
digest folds BEFORE the r27 clone-normalize.)

**V3 — `cooldownUntil` clamp.** Honest `currentMs+60_000` kept verbatim;
`currentMs+3600_000+span` clamps at `restoreNow + TRIBULATION_COOLDOWN_SECONDS*1000`;
`Infinity` clamps to the same bound; `NaN` stores internally but serializes
out via the `> 0` guard (R28-AUT-3). Probe: `V3`.

**V4 — `DecomposeSystem.nextCycleAt` clamp.** Honest `+10_000` kept;
`+86_400_000` clamps at `restoreNow + cycleMs`; `NaN`/non-finite keeps the
live timer (fully null-tolerant restore). Probe: `V4`.

**V5 — fail-closed `validateGameSaveShape` (r27-AUT-1).** A payload object
whose `player` property is a throwing getter produces
`{ok:false, issues:[...{path:''}]}` — refused, no propagation. Probe: `V5`.
All six production call sites gate on `shape.ok` (verified by read):
`SaveSystem.inspectLocalSave` :524, `importSaveRaw` :758, `recoveryApi` :58,
`driveSave` :182, `SupabaseCloudSaveService` :441/:748.

**V6 — `sanitizeRestoreAuthority` deny primitive.** `undefined` stays
`undefined` (absent = legacy local semantics); `null`, non-object,
missing-stamp, `NaN`, `±2^52`, `Infinity`, unknown-kind, and
`live-replacement {nowMs:NaN}` all degrade to `{kind:'live-replacement'}`;
a well-formed authority passes through by identity. Probe: `V6`.

**V7 — `DATA_REFUSE_CODES` arm.** Exactly `{SAVE_INVALID, SAVE_TOO_LARGE}`.
Probe: `V7`. `driveSave` refuse envelope `{code:'SAVE_INVALID',
retryable:false}` verified by read (:161-186 both outgoing arms).

**V8 — `isSaveAcceptable` is a boolean envelope.** A registry violation
(unknown `materialId`) returns `false` without throwing; the untampered
save returns `true`. Probe: `V8`.

**V9 — deep-past `lastSavedAt` is bounded to honest caps on every
channel.** `calculateOfflineTime` defaults `maxOfflineSeconds =
DEFAULT_MAX_OFFLINE_SECONDS` (24h) — the player's cultivation payout is
capped before `addCultivation` ever sees it; production settles under a
`PRODUCTION_OFFLINE_CAP_SECONDS` (10h) `budgetMs` (verified:
`ProductionOffline.ts:67` passes `PRODUCTION_OFFLINE_CAP_SECONDS * 1000`);
autofarm caps elapsed at `DEFAULT_MAX_OFFLINE_SECONDS`
(`GameManagerAutoFarmOps.settleAutoFarmOffline`). Probe `V9` demonstrates
a lane whose dues all sit at `-4e15` completes at most the 10h budget:
`consumedBudgetMs ≤ 36_000_000`, `completed ≤ slots*(budget/cycle+1)`,
everything past the cap forfeits. No unbounded mint.

**V10 — `settlementError:true` committedOutcome is inert, not
exploitable.** Admission: the realm binding is skipped ONLY for the
`settlementError === true` arm (verified: the same record with
`settlementError:false` + mismatched `departingRealmId` is rejected on
`departingRealmId`; `settlementError:true` passes) — but the witness must
still replay (`verifyTribulationCommitWitness` runs unconditionally).
Restore: `settleOutcome` returns null at :163-164 on the `settlementError`
arm BEFORE the witness/realm-binding check (:199-205) — a forged record
stays pending-inert forever; `receipt` stays null. Probe: `V10`.

## Rejected candidates (attacked, mechanism disproven)

| Candidate | Rejection |
|---|---|
| Pending-journal adoption escape | `adoptCommittedPending` (:421-465) fully gates: JSON.parse → `version === CURRENT_SAVE_VERSION` + `record.schemaVersion` match → `validateGameSaveShape` → `isSaveAcceptable`. No envelope escape. |
| Autofarm offline mint/wedge | `settleAutoFarmOffline` (:214-307): eligibility re-check, `isValidCycleSeconds` finite ≥1, non-finite elapsed bail, `elapsed` capped `[0, 24h]`, `lastCheckedMs` re-anchored when non-finite/negative/future, anchor-gap intersect, anchor stamped BEFORE payout (mid-loop fail = underpay), lease identity+stageId pinned; `reconcileAutoFarmRuntime` foreign-lease fail-closed; `rollAutoFarmCycleReward` try/finally restores 'active'. Airtight. |
| `hiddenChannelCycles` mint | `rollHiddenChannelRewards` gates on `isScopeHidden('hiddenContent')` → frozen under prod; even when enabled, `guaranteedAfterCycles` bounds emit to `amount:1` once per bound-trip then resets counter; validator caps map ≤1024 + non-negative ints. Deterministic bounded mint only. |
| Quest `progress`/`claimed` bound-escape | Mints only the authored quest reward — same class as craftable `completedOnceIds` (deny-equivalent; listed as R28-AUT-5 Nit). |
| `driveSave` envelope escape | Shape-only gate is deliberate (:161-164: pre-creation-pick saves are shape-valid but acceptance-failing — requiring acceptance would block legit writes). Refuse arms carry `code:'SAVE_INVALID'` + `retryable:false` → armed `DATA_REFUSE_CODES` surface → `saveIssue.report('corrupted')`. No escape. |
| Fully-consistent forged witness bundles | Documented residual — same-value class owned by the future online-authority layer; the validator cannot distinguish a forged-but-consistent witness from a real one. Known-adjudicated. |
| `cultivation` pin bypass via `totalCultivationGained`/`cultivationOvercharge` crafted pair | The pins are satisfiable by a crafted pair (`overcharge ≤ totalGained` with both fields free), but `player.cultivation` itself is pinned `≤ getRequiredCultivation(realmId, realmLevel)` and the ONLY mint path (offline payout) is capped at 24h × cps via `calculateOfflineTime`'s default cap — the crafted bank claim is a *persistence claim* (`isSaveAcceptable` does not replay the bank against gain history — but nothing MINTS cultivation beyond the honest 24h cap, so a crafted pair claims at most what honest play accrues per save window, inflated by a self-authored `totalCultivationGained` — same-value residual, not a new mint). |

## Deliverables

- Probe: `src/services/save/auditR28Aut.probe.test.ts` — 22 tests, all
  passing, deterministic (`Date.now` mocked via `vi.spyOn`,
  `@vitest-environment node`).
- This report.
- Branch `devin/audit-r28-AUT-1582467f` carrying only these two files.
