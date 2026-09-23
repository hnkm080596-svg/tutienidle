# Reconciliation adjudication — mf-journey-2026-09-23 Round A

Coordinator adjudication of sealed reviewer findings (A: correctness
devin-5d5be1282a47450f8e514ec259faf959; B: authority/persistence
devin-9e4abadb76a04d838916f1628f33faeb). Every reviewer claim below was
re-verified against the frozen target tree before recording — reviewers
propose, the coordinator verifies.

Target: /home/ubuntu/repos/tutienidle/.agent-worktrees/mf-journey-target
@ 873635bd (diff origin/p7/truc-co...873635bd; merge-base cf766c83).

## Deduplication map

- B-F1 → F-A-1 (HIGH)
- A-F1 → F-A-2 (MEDIUM)
- B-F2 + A-F4 → F-A-3 (MEDIUM; convergent — same census-oracle gap,
  B's version is the superset: adds non-loot writer enumeration +
  Set-collapse of double-registered grants)
- A-F2 → F-A-4 (LOW)
- A-F3 + B-F4 → F-A-5 (LOW; convergent — drainTribulationOutcome has
  no settle-ordering / committed-outcome guard)
- B-F3 → F-A-6 (LOW, REAL_DEFECT pre-existing on base)
- B-F5 → F-A-7 (NIT)
- A-F5 → F-A-8 (NIT)

## Per-finding source verification

F-A-1 CONFIRMED (HIGH, TEST_DEFECT). Leg J (TrucCoJourney.test.ts
:882-916) asserts `expect(second).toEqual(first)` over a snapshot that
includes `skillInsight`/`totalSkillInsightGained`
(EarlyGameSession.ts:124-125, written at :594-595). The leg resolves
`offeredTalentIds[0]` (:897-900) — offers drawn on `Math.random`
(TalentEntitlement.ts uses Math.random; the harness itself documents
this at EarlyGameSession.ts:616-617 "Entitlement offers draw on
Math.random by contract"). BreakthroughTalentPools.ts:149-160
`tc_linh_giac` grants `insight_gain` 0.3/0.6/1, applied via
TalentEffects.ts:95 `sumPercent(...,'insight_gain',...)` into per-kill
insight (BattleLootSystem.ts). So `offered[0]` = tc_linh_giac ⇒
different skillInsight ⇒ snapshot inequality ⇒ flake. Reviewer executed
2/4 failures (~11%/invocation); observed 1937 vs 2514. Mechanism +
execution both check out. HIGH stands: the load-bearing determinism
guarantee of the journey suite is flaky by construction.

F-A-2 CONFIRMED (MEDIUM, TEST_DEFECT/oracle-blind-spot). The snapshot
extension (EarlyGameSession.ts:586-671) covers realmId, realmLevel,
cultivation family, skillInsight family, attributePoints, paths,
completedStageIds, nodeLevels, tribulationState, bodyProgression,
physiqueGrade, highestFoundationAchieved, pendingTalentEntitlement.realmId
(only), technique, artifact, companionGifts?, hiddenChannelCycles — but
NOT selectedTalentIds, talentLevels, companions, bag contents, baseStats,
or equipment modifiers, all journey-mutated persisted fields. Paired
with F-A-1: the oracle covers derived fields fed by nondeterminism
while omitting the primary fields that would detect it — the field
selection is incoherent in both directions.

F-A-3 CONFIRMED (MEDIUM, COVERAGE_GAP). Census leg
(TrucCoJourney.test.ts:1088-1135) derives `granted` from
VISIBLE_GRANT_SOURCES + channel emissions + authored drop/signature
tables; it does not enumerate quest itemDrops/rewards, building
producesMaterialId, equipment auto-dissolve, companion token grants,
reward-ops/tick grants, or essence substitution. `granted` is a Set →
a material double-registered across two grant sources collapses into
one element and evades the `duplicated` check. Vacuous today (registry
empty, assertion guarded non-vacuous at :869) — but the oracle
over-claims "exactly one acquisition authority".

F-A-4 CONFIRMED (LOW, TEST_DEFECT seam fidelity). Production start path
is `TribulationOutcomeService.startTribulationPrepared`
(TribulationOutcomeService.ts:420-432): `equipmentOps.unequipAllEquipment()`
+ `player.setEquipmentModifiers(...)` BEFORE `startTribulation`.
Harness `runTribulation` (EarlyGameSession.ts:356-377) calls
`gameManager.startTribulation` directly, skipping both — a session with
equipment equipped enters tribulation with modifiers live, a stat
profile production never produces; the ARCH-002 ghost snapshot inside
startTribulation captures it. Masked because journey legs don't equip
before tribulation and settle-time unequip covers the residue.

F-A-5 CONFIRMED (LOW, TEST_DEFECT seam fidelity; convergent).
`drainTribulationOutcome` (EarlyGameSession.ts:406-414): reconcile →
pending? return false → `director.clear()` → return true. On an empty
director it still returns true — the seam reports "cleared-or-deferred",
not "outcome drained", and permits drain-before-settle ordering that
production's checkTribulationOutcomeAction cannot reach (it only drains
after settle produces a receipt). A-F3/B-F4 independently.

F-A-6 CONFIRMED (LOW, REAL_DEFECT, pre-existing on base).
`SaveSystem.ts:376` persists `hiddenChannelCycles` per site;
`ProductionSiteStateSave` (saveTypes.ts:267-283) does not declare it.
ProductionTypes.ts:87 declares it on the runtime state. Writer/schema
drift on origin/p7/truc-co — NOT introduced by this diff (sweep-only).
Recorded as pre-existing REAL_DEFECT: does not gate this diff, but is a
genuine corpus finding.

F-A-7 CONFIRMED (NIT, TEST_DEFECT). `isWriterOwner`
(EarlyGameSession.ts:580-584) probes `realmId`, `baseStats`,
`selectedTalentIds`; its own docstring (:577-579) says the writer
contract is "PlayerData fields + setEquipmentModifiers" — the probe
omits `setEquipmentModifiers`, so a misclassified owner throws mid-apply
inside drainTribulationOutcome rather than being rejected at the guard.

F-A-8 CONFIRMED (NIT, TEST_DEFECT). `vi.setSystemTime(Date.now())` at
TrucCoJourney.test.ts:648, :808, :1013 — under `vi.useFakeTimers()`,
`Date.now()` already returns the fake clock; setting system time to it
is a no-op. Dead/confusing lines.

## Impl-reported naming-drift items (coordinator adjudication)

zhou_tian id, gift_* mixed ids, bat-mach: prefix — all three are
persisted identifiers inside save data and channel attribution. Renaming
them IS a save-format change; recording-not-fixing inside the mission's
naming-conventions.md amendment is the required honest behavior, not a
defect. Already ledgered as F-C-3 (NON_ACTIONABLE, REJECTED_WITH_PROOF).
The naming-conventions amendment does create a second surface where
drift debt lives — but it is a record, not an authority: no conflict
with the census oracle's authority claim.

## Reviewer verdict synthesis

Both reviewers: access complete, priorFindingsVisible=NO (attested).
Convergent independent discoveries: F-A-3 (both reviewers hit the census
oracle's non-drop-writer gap), F-A-5 (both hit the drain ordering gap).
Convergent discovery on 2 of 8 deduped findings is a strong signal the
attack lenses overlapped correctly and the findings are real, not
idiosyncratic.

Outcome: NOT QUALIFIED-clean — 8 actionable findings (1 High, 2 Medium,
3 Low, 2 Nit) + 1 pre-existing Low real defect recorded. authorizedRepairs
is empty (review-only run): repairs belong on the impl branch.
