# mf-journey-2026-09-23 — Round A verdict (internal fixed-point QA, first real run)

Target: PR #19, `devin/1790160949-m-f-journey` @ `873635bd`, diff
`origin/p7/truc-co...873635bd` (merge-base `cf766c83`). Product state
`cba106e9f87b…`. Run scope: review-only (`authorizedRepairs=[]`).

## Verdict: QA_BLOCKED_SCOPE — NOT qualified-clean

9 actionable findings (1 High, 2 Medium, 4 Low, 2 Nit) confirmed by
coordinator adjudication; all repairs belong on the impl branch, outside
this run's authorized scope. 3 coordinator records
(F-C-1/F-C-2/F-C-3) rejected-with-proof as non-actionable.

Reviewers: 3 fresh isolated Devin sessions, sealed, all attested
priorFindingsVisible=NO — REV-A-CORRECTNESS (devin-5d5be128…),
REV-B-AUTHORITY (devin-9e4abadb…), REV-C-INTEGRATION
(devin-f9c6b046…). Convergent independent discovery on 4 of 9 findings
(F-A-2 a+c, F-A-3 a+b, F-A-4 a+c, F-A-5 a+b+c, F-A-8 a+c) — the
strongest possible signal for a first run.

## Findings

| id | sev | class | location | summary |
|----|-----|-------|----------|---------|
| F-A-1 | High | TEST_DEFECT | TrucCoJourney.test.ts:882-916 · TalentEntitlement.ts (Math.random) · BreakthroughTalentPools.ts:149-160 · EarlyGameSession.ts:594-595 | Leg J determinism asserts snapshot equality over fields fed by an unseeded `Math.random` talent draw; resolving `offered[0]` can grant `tc_linh_giac` insight_gain → compared `skillInsight`/`totalSkillInsightGained` diverge. EXECUTED: 2/4 failures, ~11% flake/invocation. Fix: deterministic rng seam or fixed-identity decision. |
| F-A-2 | Medium | TEST_DEFECT | EarlyGameSession.ts:586-671 | Snapshot/checkpoint oracle omits journey-mutated persisted fields (selectedTalentIds, talentLevels, companions, bag, baseStats, modifiers); checkpoint parity can't verify restore's deliberate `bat-mach:*` rebuild. PR body's "all landed v73-v81 persisted fields" claim over-states coverage. Convergent A+C. |
| F-A-3 | Medium | COVERAGE_GAP | TrucCoJourney.test.ts:1066-1135 | Census oracle enumerates only VISIBLE_GRANT_SOURCES + channels + authored drop tables — not quest itemDrops/rewards, building producesMaterialId, equipment auto-dissolve, companion tokens, reward-ops, essence substitution; `granted` Set collapses double-registered grants. Vacuous today (empty registry), over-claims "exactly one authority". Convergent A+B. |
| F-A-4 | Low | TEST_DEFECT | EarlyGameSession.ts:356-377 vs TribulationOutcomeService.ts:420-432 | `runTribulation` skips `startTribulationPrepared`'s unequip-all + modifier resync — equipped-through-tribulation is a fixture-only state the ghost snapshot can capture. Dormant (no leg equips first). Convergent A+C. |
| F-A-5 | Low | TEST_DEFECT | EarlyGameSession.ts:406-414 | `drainTribulationOutcome` returns true on an empty director (no committed/settle-ordering guard; settle throws while drain vacuously succeeds — nil asymmetry). Triple-convergent A+B+C. |
| F-A-6 | Low | REAL_DEFECT (pre-existing) | SaveSystem.ts:376 vs saveTypes.ts:267-283 | `hiddenChannelCycles` persisted per site but undeclared on `ProductionSiteStateSave`. Base-branch writer/schema drift — recorded for corpus, does not gate this diff. |
| F-A-7 | Nit | TEST_DEFECT | EarlyGameSession.ts:580-584 | `isWriterOwner` probes 3 data fields, omits `setEquipmentModifiers` from its own documented contract — misclassified owner throws mid-apply. |
| F-A-8 | Nit | TEST_DEFECT | TrucCoJourney.test.ts:648/808/1013 | `vi.setSystemTime(Date.now())` is a no-op under armed fake timers ×3. Convergent A+C. |
| F-A-9 | Low | TEST_DEFECT | GameManagerTickOps.ts:42-44 + EarlyGameSession.ts:363-371 | Per-tick auto-invest during tribulation's tick loop drains leg-A essence surplus — leg D's exact-tier asserts silently depend on the coupling. |

Coordinator adjudication detail: `evidence/reconciliation-adjudication.md`.
Sealed review transcripts: `reviews/round-a-reviewer-{a,b,c}.md`.

## Naming-drift adjudication (impl-reported items)

zhou_tian id, gift_* mixed ids, bat-mach: prefix — honest records, not
defects: all are persisted identifiers inside save data/channel
attribution; renaming is a save-format change, so recorded-not-fixed in
`naming-conventions.md` is required behavior (F-C-3, rejected-with-proof).

## Protocol-run friction (learning corpus)

1. Record API replaces in place but cannot delete superseded records;
   run-field corrections need journaled ledger edits (requiredDomains
   was corrected post-init this way).
2. `request.json` edits post-init don't propagate into `ledger.run`.
3. `additionalProperties:false` rejects unknown keys — record bodies need
   exact field sets (several silent retries this run).
4. Session-message transport truncates sealed results at ~6-8k chars —
   reviewers must persist results as artifacts (now under `reviews/`)
   or chunk; index-extraction replies worked but cost a round trip each.
5. SWE-2 concurrency cap (5) blocked the third reviewer dispatch until
   sealed reviewers were slept — reviewer scheduling must account for
   the mode's session limit.
6. MC9 cycle shape assumes sequential CORRECTNESS→AUTHORITY→INTEGRATION
   linkage; sealed parallel reviewers satisfy it only via
   `previousPhaseReviewId` as ordering position — honest (visibility is
   separately attested) but worth a doc clarification.
7. Evidence records require run-dir-contained artifact paths — reviewer
   executions need transcript files under `reviews/` to hash-anchor.
8. C2 invariant/coverage matrix undeclared this run (census recorded as
   CEN-* records only) — decide() honestly reports it unmet; future runs
   should derive invariants from the attack model up front.
