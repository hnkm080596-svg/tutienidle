# QA Review: buildings-default-built (bo co che xay, mac dinh toan bo kien truc lv1)

- Date: 2026-10-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: game/src/core/building/BuildingSystem.ts, game/src/core/game/GameManagerBuildingOps.ts, game/src/core/game/GameManager.ts, game/src/core/game/GameManagerSaveRestore.ts, game/src/services/character/initializeCharacter.ts, game/src/services/save/SaveSystem.ts, game/src/services/save/saveTypes.ts, game/src/services/save/saveShapeValidation.ts, game/src/core/betaScopeSurface.ts, game/src/stores/ui.ts, game/src/composables/useBuildingNavigation.ts, game/src/components/layout/GameRoot.vue, game/src/components/scenes/dong-fu/{DongFuStage,DongFuHomeScene,hotspots/DongFuBuildingHotspots,wheel/DongFuCommandWheelLayer}.vue, game/src/components/scenes/exploration/ExplorationSurface.vue, game/src/components/panels/ProductionPanel.vue, game/src/locales/{en,vi}.json, game/src/core/dev/enemySpawnDebug.ts, game/src/core/stats/StatDomain.ts, deleted: BuildingDetailPopover.vue, BuildingConstructionGate.vue(+test), core/dev/DevMode.ts, plus task-owned test files.

## Scope and Risk Map

Mapper (`changed-risk-map.mjs`): domains economy-and-progression, pinia-phaser-sync, save-and-cloud, ui-input-lifecycle; deepAuditCandidate=true (save boundary + 4 domains). Boundedness documented: the only save-boundary mutation is `reconcileBuildings` inside `restoreGameSession`'s existing try, AFTER the atomic slice restore and BEFORE any session commit — a throw there produces the same handled 'rejected' path as any other restore fault, and preflight/shape validation runs before it, so rejected saves never receive grants. Recovery behavior is unchanged structurally (same statuses, same recovery surfaces); what changed is only that accepted saves gain missing lv1 buildings — exactly the requested semantics. UnmappedPaths inspected in current code: useBuildingNavigation.ts (single navigation funnel, popover branches removed), betaScopeSurface.ts (dormant threshold rebased), GameManagerBuildingOps.ts (build API removed, reconcile added, upgrade lock kept), locales (blocks removed/kept), enemySpawnDebug.ts/StatDomain.ts (comment refs only). No material unrouteable risk → quick mode retained.

## Invariant Ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BDB-1 | buildingManager slice / GameManagerSaveRestore | Load pre-change save missing buildings | Recoverability: accepted save gains lv1 buildings, rejected save gains none | Stale state | restored manager contents + catalog coverage | SaveSystem boundary test | High — save loss/regression risk |
| INV-BDB-2 | restoreGameSession tx | Retry same payload after rejection | Idempotency: no duplicate grant | Repeat | building count stays catalog-sized | GameManagerSaveRestore.boundary retry test | High |
| INV-BDB-3 | buildingManager | Save carries lv5 CHQ | Monotonicity: carried level preserved, reconcile skips existing | Stale state | level stays 5; capacity = formula(5) | boundary test (grants-all + carried-lv5) | High |
| INV-BDB-4 | autoWorkerCapacity player field | reconcile grants CHQ lv1 | Conservation: capacity = getWorkerCapacityForLevel(level), never stale | Value mutation | playerStore.autoWorkerCapacity === 5 for carried lv2 CHQ | GameManagerSaveRestore.boundary + workerCapacity tests | High — dormant-flag semantics depend on it |
| INV-BDB-5 | unsupportedReleaseReason | Restored save with scope-hidden dormant progression | Monotonicity/flag truth: dormant manual-workforce flags only above lv1 baseline | Value mutation | capacity > BETA_BASELINE_WORKER_CAPACITY flags; =3 does not | betaScopeAuthoritySeam.qa.test.ts | High — threshold semantics changed |
| INV-BDB-6 | upgradeCost rows / BuildingSystem.upgrade | lv1→lv2 upgrade after default-built | Conservation: same cost index as before (index = current level); row 0 vestigial | Cross-system chain | quoteUpgrade/upgrade deduct upgradeCost[level] | BuildingSystem.test.ts (existing upgrade cases green) | High — economy sink must not shift |
| INV-BDB-7 | pill_room admission (AlchemyOps + surface) | Brew with lv1 pill_room | Fail-closed preserved: no instance → room_not_built; lv1 → domain rules apply | Reorder | reason union + disabled brew unchanged | AlchemySurface.test.ts | Medium |
| INV-BDB-8 | chi_hien_quan scope-hidden | reconcile grants CHQ lv1 on every real load | Scope rule: hidden building stays hidden/dormant, upgrade refused | Cross-system | isBetaBuildingSurface=false → upgradeBuilding returns false; no surface exposes it | betaConsumerSeamsProbes (upgrade-fails), scopeWriteSeamsBlind | High |
| INV-BDB-9 | UI popover/gate removal | Click hotspot/wheel on any building | Lifecycle: no unbuilt UI can appear; built buildings open function panel | Repeat/reorder | leftPanelMode opens; no popover store field remains | DongFuCommandWheel.test, ui.test, HomeBuildingIcons.test | Medium |
| INV-BDB-10 | initializeCharacter | New/reconstructed character creation | Exactly-once grant at lv1 for full catalog | Repeat | reconcileBuildings called once with (player, now) | initializeCharacter.test.ts | High |
| INV-BDB-11 | ensureAllBuilt loop | Partial add failure mid-loop | Atomicity: failure stays inside session try → whole restore 'rejected' | Interruption | no partial commit observable (payload hash uncommitted) | reasoning + existing rejection path | Medium — no test; see Gaps |
| INV-BDB-12 | Kept notBuilt i18n keys + defensive isBuilt=false branches | Any reachable state | Defensive dead ends must never surface | Stale state | isBuilt always true on every reachable path (reconcile covers load; creation covers new) | reasoning; ui-preview visual check pending | Low |

## Verification Evidence

| Command / observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | post-edit state |
| `npx vitest run` (full suite) | 918 pass / 1 skip / 0 fail | includes rewritten building/save/beta-scope suites |
| `npx vitest run tests/architecture/asciiComments.test.ts` | pass | new comments ASCII-only |
| Mapper + manual routing of unmappedPaths | bounded | see Scope section |
| Source inspection: `restoreGameSession` ordering | reconcile inside try, after restoreFromSave, before modifier sync | SaveSystem.ts ~L299 |
| Source inspection: `unsupportedReleaseReason` call site | evaluated on restored $state post-reconcile | useAppLifecycle.ts ~L465 |
| Grep: `.build(`/`buildBuilding`/`canBuildBuilding`/`BuildRejectReason` consumers | none remain | popover removed, DevMode.ts deleted |
| Dead surface check | `.game-root__building-popover-layer` CSS + stale `.construction-gate__upgrade` assertion removed during OCR; reran layout+game suites 118/118 green | — |

## Findings

### QA-2026-10-03-01: reconcile grant anchors `lastCollectedAt` at wall-clock load time
- Severity: Low
- Status: Suspected (design-consistent; no runtime defect)
- Invariant: Determinism/fairness of accrual start
- Preconditions: old save missing a building
- Reproduction: inspect `reconcileBuildings(player, Date.now()/1000)` in SaveSystem.ts
- Expected/Actual: granted buildings accrue from load, not from save's lastSavedAt — intended (building did not exist during the offline window). Consistent with previous `build()` semantics which anchored at build time.
- Evidence: source inspection; `accrualRealmId` set to current realm (EM-01 contract)
- Test file: none needed
- Owner subsystem: SaveSystem/GameManagerBuildingOps
- Blast radius: granted instance only

### QA-2026-10-03-02: `useAppLifecycle.test.ts` still says "2 starter buildings" in comments
- Severity: Low
- Status: Confirmed (comment-only staleness, zero behavior)
- Invariant: documentation accuracy
- Reproduction: grep comment text
- Expected/Actual: comment describes old 2-building grant; code paths unchanged. Deferred — cosmetic, non-functional, task scope is mechanic removal not comment rewrite.
- Evidence: grep
- Test file: none
- Owner: tests/docs
- Blast radius: none

### QA-2026-10-03-03: Forged `autoWorkerCapacity > 3` with no CHQ instance loses dormant flag after reconcile
- Severity: Low
- Status: Suspected → rejected as defect (fail-safe improvement)
- Invariant: dormant-record flagging
- Preconditions: save with `autoWorkerCapacity=7`, no chi_hien_quan instance
- Reproduction: load → reconcile adds CHQ lv1 → refreshAutoWorkerCapacity rewrites 7→3 → `unsupportedReleaseReason` sees 3 → unflagged
- Expected: pre-change such a save would flag manual_workforce_state
- Actual: field is corrected to baseline; the dormant RECORD the flag exists for (a built+upgraded CHQ) always carries an instance with level≥2 → capacity≥5 → still flags. A bare forged field without its record is corruption the reconcile now repairs — strictly better.
- Evidence: source inspection of flag ordering + reconcile
- Test file: none
- Owner: betaScopeSurface
- Blast radius: corrupted saves only

## New or Changed QA Tests

- `GameManagerSaveRestore.boundary.test.ts`: retry-on-same-payload now asserts full catalog ids (sorted) — proves reconcile-on-session-seam idempotency; new test grants all lv1 + preserves carried lv5 CHQ + asserts `autoWorkerCapacity === getWorkerCapacityForLevel(5)`.
- `SaveSystem.conformance.test.ts`: populateSource uses the ops reconcile — proves session-restore grant.
- `betaScopeAuthoritySeam.qa.test.ts`: reconcile-grants-dormant + idempotent/carried-level cases pin INV-BDB-2/3/5.
- `initializeCharacter.test.ts`: reconcile seam call asserted once with (player, 4242).
- `BuildingSystem.test.ts`: ensureAllBuilt grant test.
- `TrucCoJourney.test.ts`: buildings subset-compare + capacity-vs-formula parity.

## Gaps and Residual Risk

- INV-BDB-11 partial-failure atomicity is reasoned from the shared session try/catch, not executed (no harness injects a mid-loop manager.add throw; risk is bounded by identical treatment of every other restore step).
- Visual plaque/tooltip states pending runtime check on `ui-dong-fu.html` per addendum (test-level evidence already shows defensive branches unreachable).
- No E2E boot-with-old-save run (repo has no pre-change fixture; boundary/conformance tests cover the seam).

## Pre-existing Failures

None observed; the earlier TrucCoJourney parity failure was task-caused and fixed (subset-compare).
