# Round A sealed review — AUTHORITY/PERSISTENCE lens
reviewer context: devin-9e4abadb76a04d838916f1628f33faeb (sealed; priorFindingsVisible=NO)
sealed against product cba106e9f87b… @873635bd

```
REVIEW_RESULT as your final structured output when done. No reply needed until sealed.

[devin] @ 1790176497 (event-01a0ced58ecb70a19b71e6573a547d52)
Acknowledged — mid-review: diff surface and restore/authority code paths mapped (collector channel vs bat-mach:* modifier channel vs intrinsic baseStats; preflight integrity chain located). Next: PlayerData persisted-field census vs snapshot surface, volatile normalization, census oracle completeness, then vitest runs and the sealed result.

[devin] @ 1790177706 (event-01a0cee802497e62b58e1c6eefdb28d8)
REVIEW_RESULT — mf-journey-2026-09-23 / round-A-authority / product cba106e9f87b, sealed on @873635bd.

Access: complete — cloned, detached at frozen SHA, full diff (10 files, +2601/−10) + all referenced production sources read; ran both touched vitest files.
Independence: context devin-9e4abadb76a04d838916f1628f33faeb; priorFindingsVisible=NO; no docs/qa/runs or reviewer results read (impl's own quick.md not opened).

FINDINGS (5):
F1 HIGH — Determinism leg flaky by construction (EXECUTED, failed 2/4 runs). TrucCoJourney.test.ts:897–915 asserts same-seed snapshots equal, but the settle draws `offeredTalentIds` on Math.random (TalentEntitlement.ts:106; harness exposes no rng seam) and resolving `offered[0]` can grant `tc_linh_giac` (insight_gain +30%, BreakthroughTalentPools.ts:149–160), which feeds per-kill insight via BattleLootSystem.ts:341–351 into compared snapshot fields skillInsight/totalSkillInsightGained (EarlyGameSession.ts:594–595). Observed 1937 vs 2514 ≈×1.3. Volatile normalization strips the offer record, not its resolved consequence. ~11% flake/invocation. Fix: inject a deterministic rng (spyOn Math.random or rng seam) or resolve a fixed-identity decision.
F2 MEDIUM — Census oracle under-covers writer paths (static). TrucCoJourney.test.ts:1088–1135 enumerates channels + registered grants + signature/drop tables, but not quest itemDrops/rewards, building producesMaterialId, equipment auto-dissolve, companion token grants, reward-ops/tick grants, or essence-substitution — so an unregistered second authority for an authorized material evades `duplicated`; `granted` being a Set also collapses double-registered grants. Latent today (registry empty, guarded non-vacuous); oracle over-claims "exactly one acquisition authority".
F3 LOW — `hiddenChannelCycles` persisted per site (SaveSystem.ts:376) but undeclared on ProductionSiteStateSave (saveTypes.ts ~267). Pre-existing v81 drift between writer and save schema, surfaced by lens.
F4 LOW — Harness `drainTribul... [truncated]

[user: Devin Bot (api)] @ 1790177761 (event-01a0cee8d87274d3a17b43b68f5355d7)
Seal received — coordinator needs only your finding INDEX (sealed text truncated in transport). Reply one line per finding: F-N | severity | title (one short clause) — plus your final Result line and the unresolved-hypotheses list in ≤6 lines. No new findings; index extraction only.

[devin] @ 1790177772 (event-01a0cee901fd7462a20d739bc279d22e)
F-1 | High | Determinism leg flaky: Math.random entitlement draw resolves insight_gain talent into compared snapshot fields (executed 2/4 fails)
F-2 | Medium | Census oracle misses non-loot writer paths (quests/buildings/dissolve/tokens/substitution); Set-collapsed double grants
F-3 | Low | hiddenChannelCycles persisted but undeclared on ProductionSiteStateSave (pre-existing schema drift)
F-4 | Low | Harness drainTribulationOutcome clears director without post-settle ordering guard (test-expressible, no production counterpart)
F-5 | Nit | isWriterOwner probes 3 data fields, omits setEquipmentModifiers → mid-apply throw on misclassified owner

Result: SEALED_RESULT

Unresolved: (1) offeredTalentIds/perfectClearSeconds restore-fidelity masking is latent, no repro; (2) post-restore modifier rebuild unasserted by journey (unit-covered); (3) scoped vitest only, no full suite; (4) same census gap in HiddenMaterialChannels.test.ts read-not-run; (5) no deep audit of runStage/EarlyGameLoop legs.
```
