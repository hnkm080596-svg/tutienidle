# TC15 — Blind Terminal Falsification Report

**Verdict: PASS WITH GAPS** (2 confirmed Medium gaps in one defect class: in-page realmLevel pacing not replayed at the body-progression integrity boundary)

- Target: `devin/qa-fixpoint` pinned at `af3666e7a3b987c270d7acdeb4fe3f91166be4db`
- Surface assigned: forged/structured hostile saves across the whole persisted shape, settle seams, deferred/async restore, tribulation state machine, leg-order sims, devtools hooks, cross-surface consistency
- Probe: `tests/architecture/tc15SavePacingFalsification.qa.test.ts` — 6 tests, run `npx vitest run tests/architecture/tc15SavePacingFalsification.qa.test.ts` → **3 failures, 3 passes**. Each failure is a secure-expectation assertion that the boundary should reject an unproducible claim.

## F-TC15-MERIDIAN-PACING (Medium) — in-page meridian pacing not replayed

**Writer contract.** `MeridianChapter.invest()` paces opens inside the page realm: while `player.realmId === 'qi_refining'`, opening meridian *k* is refused when `realmLevel < MERIDIANS[k].requiredRealmLevel` (2,4,6,8,10,12,14,16). Past the page realm only sequential ordering binds.

**Gap.** `assertBodyProgressionIntegrity` replays strict-prefix `openedIds`, the page unlock (M-E D2), and the body_refinement chapter prerequisite (C2C-64) — but not the in-page `realmLevel` pacing. An unproducible claim is admitted.

**Repro (failing test).**
```
qi_refining, realmLevel 1, body_refinement 6/6, physiqueGrade 'bao',
openedIds = all 8 meridians
→ validateGameSaveShape: ok
→ assertBodyProgressionIntegrity: does NOT throw   (expected: throw)
```
The `body_refinement 6/6` part is itself a producible claim post-mortal (refinement completed in Pham Nhan, then initiation) — so the meridian over-claim is reachable with only one incoherent field.

**Mint path.** `applyAllBodyModifiers(player)` runs at restore (`GameManagerSaveRestore.ts:455`) and `MeridianChapter.applyModifiers` emits `bat-mach:<id>:<stat>` percent modifiers for every id in `openedIds` — forged +18% maxHp, +5% def, +8% hpRegenPerTurn, +5% might, +4% crit, +5% on all five main stats (strength/dexterity/intelligence/attunement/vitality) in visible beta play (kinh mach chain is LIVE).

**Sibling search.** Partial over-claims at the same realm — probed 5 openedIds at realmLevel 8 (5th requires 10): also admitted (failing test). zhou_tian is NOT a sibling: `integrityIssues` replays realm capacity via `getZhouTianCapacity` (C2C-75). body_refinement is a sibling, reported below.

**Controls.** mortal + all-8 openedIds → rejected (page-lock); qi_refining level 4 + {nham, doi} → accepted (producible).

## F-TC15-BODYREF-PACING (Medium) — mortal realmLevel pacing not replayed

**Writer contract.** `BodyRefinementChapter.invest()` paces tiers inside Pham Nhan via `isTierRequiredRealmLevelMet`: tier *k* requires `realmLevel >= BODY_REFINEMENT_TIERS[k].requiredRealmLevel` (2,4,6,8,10,12) while `realmId === 'mortal'`.

**Gap.** `integrityIssues` checks `completedTiers ∈ 0..6`, `currentTierProgress < cap`, progress==0 when complete, and `physiqueGrade` exact derivation (INV-8) — but not mortal realmLevel pacing.

**Repro (failing test).**
```
mortal, realmLevel 1, completedTiers=6, currentTierProgress=0,
physiqueGrade 'bao' (the derived grade for 6/6)
→ assertBodyProgressionIntegrity: does NOT throw   (expected: throw)
```
Documentary probe (passed): `collectBodyBaseStatDeltas` on that player returns non-empty deltas — the admitted claim mints.

**Mint path.** `collectTierBaseStatDeltas` sums per-tier `baseGains` at ratio 1 for all 6 tiers → `collectBodyBaseStatDeltas` → `resolvePlayerStatAssembly` assembledBase → direct base-stat inflation; no persisted modifier claim needed. `breakthroughGrade ≤ bodyTiers+1` bound inherits the forged tier count. Siblings: any `completedTiers` whose tier `requiredRealmLevel` exceeds the mortal `realmLevel`, and progress parked on a locked tier (`currentTierProgress > 0` on a tier `invest` would refuse).

## Eliminated classes (evidence)

- **Tribulation committedOutcome** — `settleOutcome` re-derives hidden dormancy (`isBetaFeature('hiddenContent')`), `isRealmTransitionEnabled`, `canTriggerBreakthrough` before apply; grade bound to `persistedResolvableFoundationRank` over the save's own body records; `great_dao` rejected; `cooldownUntil ≤ lastSavedAt+300s`; receipt kind enum; settlementError parks.
- **Alchemy jobs** — count bound by persisted `pill_room` slot ladder; dormant families parked (`scopeHiddenPillFamilyOfId`); settle re-derives pill from authored recipe.
- **Decompose** — workers clamped to `autoWorkerCapacity` (itself requires a `chi_hien_quan` instance, F-W-16); scope gate; settle window forfeits past deadline; 5000-cycle cap; ore-stock bound.
- **Autofarm offline** — eligibility re-derived (`resolveValidAutoFarmStage` + `isValidCycleSeconds`); 24h cap.
- **Modifiers / timed effects** — closed claimed-source allowlist: realm passives byte-match the authored envelope (+`grantedRealmPassiveIds` markers), `bat-mach` exact shape, `loi_kiep` talent + `0.1×realmIndex` bound, `tu_linh_tran` exact span, pill regen authored shape; any other `sourceType:sourceId` rejected; aux fields (`stacks/multiplier/tag/domain/perLevel*`) rejected — TC14 fixes hold.
- **Formation loadout** — commit-contract replay: formation membership, `cellPattern` containment, combatant existence, dup combatant/cell rejection.
- **Techniques** — holder contract: exactly 1 entry = `activeWay.techniqueId`; grade ≤ ceiling(realm); rank ≤ CAP; mastery consistency; `gradeHistory` canonical keyset + record shape.
- **Realm witness** — realm ≥ qi_refining requires `techniques` + `breakthroughGrade ≥ 1`; realm ≥ foundation requires `highestFoundationAchieved` bounded by derivable body records.
- **Body progression (elsewhere)** — strict-prefix meridian ids, page-lock (M-E D2), chapter prerequisite order (C2C-64), physiqueGrade exact derivation (INV-8), zhou_tian realm capacity (C2C-75).
- **hiddenPerfection** — strict-prefix completed list, two-view `bodyCompleted` agreement, authored realms, realm-order bounds.
- **Specializations** — `reconcileSpecClaims` revokes (never grants) specs with unowned claiming nodes.
- **Refund/mirror** — `computeNodeRefund` clamps ≥ 0; `externalModifiers` cleared; `techniqueProgress` republished from canonical holder.
- **Restore funnel** — local, cloud `coordinator.load()`, pending-save reconcile, and sim restore all pass `restoreGameSession` → `preflightSaveRegistryReferences` → `assertSaveAcceptable`; no bypass.
- **Devtools hooks** — `enemySpawnDebug` is `import.meta.env.DEV` guarded; no production mint.
- **Residual class (excluded per ruling)** — bag/material amounts, quest progress, timestamps within caps, counters within authored bounds, fully consistent progression forgeries.

## Deferred findings (Low/Nit)

- **D-TC15-NODELEVELS-UNKNOWN-KEY (Nit)** — unknown `nodeLevels[<id>]` silently skipped (`saveShapeValidation.ts` ~1651 `if (node === undefined) continue`) instead of rejected; inert dead data.
- **D-TC15-PHAGIAP-CARRY-STACKS (Low)** — no tight authored bound; seed clamps at talent `maxStacks` (~5) vs writer-observed ~2; small headroom, requires owning the talent.
- **D-TC15-SKILLCASTCOUNTS-PRECURSOR (Low)** — `skillCastCounts` mirror unbounded → `getPrecursorFlatDamageBonus = floor(totalExperience/10)` uncapped on LIVE mortal precursor skills; borderline with the human-accepted same-value-counter residual class — recorded, excluded per ruling.

## Access limitations

None. Analysis is source + deterministic vitest probes at the pinned commit; no production code modified, nothing committed. UI/browser surface was out of scope for this pass (save-boundary focus).
