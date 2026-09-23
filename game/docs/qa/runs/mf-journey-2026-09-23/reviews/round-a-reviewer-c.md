# Round A sealed review — INTEGRATION lens
reviewer context: devin-f9c6b0463f594468954bcbcae47fc7e7 (sealed; priorFindingsVisible=NO)
sealed against product cba106e9f87b… @873635bd

```
REVIEW_RESULT.

[devin] @ 1790179923 (event-01a0cf09d39b7712b3cbc6e543c27145)
REVIEW_RESULT
run: mf-journey-2026-09-23 | round: A | lens: INTEGRATION | target: devin/1790160949-m-f-journey @ 873635bd502921a6164eff368cb470af8c735915 | base: origin/p7/truc-co | PR #19

ATTESTATION — sources actually read: checked out 873635bd and diffed vs origin/p7/truc-co (10 files, +2601/−10, all under game/docs + game/src/core/simulation/earlygame). Read in full: EarlyGameSession.ts (675 lines), TrucCoJourney.test.ts (1137), EarlyGameSession.test.ts diff. Read targeted production sources: src/composables/useTribulation.ts, src/core/tribulation/TribulationOutcomeService.ts:140-453, src/core/game/GameManager.ts:1343-1390, GameManagerSaveRestore.ts:550-659, GameManagerRealmAdvanceOps.ts, GameManagerBattleRewardOps.ts:150-230, GameManagerTickOps.ts:100-140, src/services/save/SaveSystem.ts:60-296, saveTypes.ts:190-210, saveShapeValidation.ts:270-280, src/core/talent/TalentEntitlement.ts:100-179, src/data/realm/Meridians.ts + MeridiansStore.ts, src/data/realms/realm.ts, src/core/realm/body/BodyChapter.ts + BodyRefinementChapter.ts:20-70 + MeridianChapter.ts (full), GiftDrops/Companions defs, HiddenMaterialChannels.ts, BodyPerfection.ts, docs/naming-conventions.md + docs/p7 mission notes + the impl's own docs/qa report file (last three are diff content under review). EXECUTED: `npx vitest run` on both touched test files → 17/17 pass in ~2.6s (node_modules already present; npm ci unnecessary).
priorFindingsVisible: NO — read no docs/qa/runs/ review files and no other session's output.
accessLimitations: headless seam only (no deployed/UI run); full suite not re-run beyond the two touched files.

FINDING INDEX
F-1 | Medium | runTribulation skips startTribulationPrepared — equipped-through-tribulation is fixture-only state
F-2 | Medium | checkpoint parity oracle omits persisted player.modifiers — restore's deliberate bat-mach rebuild unverified in assembled path
F-3 | Low | per-tick auto-invest during tribulation couples Leg-A essence surplus to Leg-D exact-tier prec... [truncated]

[user: Devin Bot (api)] @ 1790179946 (event-01a0cf0a2faa7deda933e1968e4de441)
Seal received — transport truncated after F-3. Reply with ONLY: the remaining index lines (F-3 onward: F-N | severity | title clause), then your final Result line and unresolved-hypotheses list (≤6 lines). No new findings; index extraction only.

[devin] @ 1790179950 (event-01a0cf0a3e8a7381bf150913395d0594)
F-3 | Low | per-tick auto-invest during tribulation couples Leg-A essence surplus to Leg-D exact-tier precondition
F-4 | Low | settle/drain asymmetry on nil outcome — settle throws, drain returns vacuous true
F-5 | Nit | dead vi.setSystemTime(Date.now()) calls ×3 under armed fake timers

Result: SEALED_RESULT

Unresolved hypotheses:
- Quantified battle-stat divergence from kept equipment during tribulation unmeasured (journey's LQ stats are synthetic anyway).
- hiddenChannelCycles site-order parity unexercised ([]→[] today); assumes serialized insertion order survives restore.
- pourCultivationOvercharge could leave cultivation>0 at settle under other overshoot shapes (asserted 0 here, passed).
- Census oracles activate unreviewed the day the first real BODY_PERFECTION material lands.
- Cross-file order independence assumed via vitest worker isolation; within-file isolation rests on fresh-pinia-per-test.
```
