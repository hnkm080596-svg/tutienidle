# QA Quick — R8.2 Slice 2: Breakthrough Outcome Migration

- **Date:** 2026-09-11
- **Scope:** branch `r8-breakthrough-outcomes` — new
  `core/tribulation/BreakthroughOutcomeService.ts` (+ tests),
  `GameManager.breakthroughWithConsequences` facade, rewrite of
  `composables/useBreakthrough.ts` as thin adapter, design spec doc.

## Mapper result

`changed-risk-map.mjs`: 5 domains, `deepAuditCandidate: true` (reasons:
save-and-cloud + time-and-offline critical boundaries, "breakthrough
composable mutates persisted state", cross-system breadth). Per the quick
workflow, escalation was weighed against bounding by code inspection:

- **Save boundary bounded:** zero schema change. The migrated fields
  (realmLevel, attributePoints, artifact, technique insight) persist
  identically; the write MECHANISM for artifact was the same
  `createDefaultArtifactProgress` assignment, now inside the service.
  `services/save` suites: 9 files / 135 tests PASS (incl. SaveRoundTrip).
- **Time/offline bounded:** breakthrough is tick-paced (App.vue tick,
  unchanged call site); no clock ownership, no offline-accrual path
  touched. `GameManager.update()` untouched by this diff (facade method
  only added).
- **Cross-system breadth bounded:** the only consumers are App.vue:428
  (tick call, unchanged signature) and the adapter itself; no Phaser/
  Pinia store internals touched. Persistence consumers (quest lifecycle)
  re-verified green.

Escalation to deep therefore NOT warranted: the mapper breadth comes from
GameManager being a hub file, not from the diff's reach.

## Invariant ledger

| # | Hypothesis | Evidence | Result |
|---|---|---|---|
| H1 | Behavior drift in migration | 5 service parity tests + pre-existing cultivationRitualFlow.integration (uses dai_ngu_hanh_quyet) + artifact tests, all unchanged assertions | PASS |
| H2 | Unreachable-branch handling | Characterized: CultivationSystem.breakthrough() never crosses major realms -> technique/artifact branches keyed on realmId change are unreachable. Preserved verbatim in the service with documented-dead markers; their future removal is a separate evidence-based decision | PASS (documented) |
| H3 | Double-application via tick | QA probe (BreakthroughOutcomeService.qa.test.ts): 3 consecutive calls -> exactly 3 levels + 3 points; failure consumes nothing | PASS |
| H4 | Persistence drift | services/save 135 tests green; no schema change; artifact write mechanism identical | PASS |
| H5 | Time/offline drift | No clock/offline path in diff; GameManager.update() untouched | PASS |
| H6 | R14 guards regression | architecture guards 10/10; no new vitals/baseStats writers; A6 production scan unchanged | PASS |

## Confirmed defects

None.

## Suspected / coverage gaps

- The documented-dead major-realm branches remain in the service (per
  A12, removal needs its own consumer-status pass). Marked clearly.
- P14 deferred (isolated worktree; no visual surface changed — the
  announcement text/render path is unchanged).

## Verification evidence

- type-check PASS, build PASS, full suite **473 files / 3202 tests PASS**
- architecture guards 10/10; eslint clean on all touched files
- QA probe suite 2/2 (tick-path accumulation + failure no-consume)

## Verdict

**PASS WITH EVIDENCE**
