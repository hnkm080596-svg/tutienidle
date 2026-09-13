# QA Quick — R8.2 Tribulation Outcome Migration

- **Date:** 2026-09-11
- **Scope:** branch `r8-progression-outcomes`, worktree `.agent-worktrees/r8-progression-outcomes`
- **Task-owned diff:** new `core/tribulation/TribulationOutcomeService.ts` (+ test), rewrite of `composables/useTribulation.ts` as thin presentation adapter, guard comment/exemption update in `tests/architecture/coreImportDirection.test.ts`, design spec doc.

## Mapper result

`changed-risk-map.mjs`: domain `combat-and-tribulation`; one-hop consumers
"combat presentation and controls" + "loot, progression, and persistence
after combat"; `deepAuditCandidate: false`. Manual routing of unmapped
paths: design doc (context only), adapter (the migrated consumer —
reviewed in depth below), guard test (config comment + test-file
exemption rationale).

## Invariant ledger & attack operators

| # | Hypothesis | Operator / evidence | Result |
|---|---|---|---|
| H1 | Behavior drift in migration (A12 parity) | Full parity matrix: qi_refining victory (announcement-only, realm untouched), realm entry resets, foundation recording, talent conversion, defeat loss formulas, spirit-stone partial removal, Kiep Thuong debuff, Great Dao permanent loss — service tests 6/6 + PRE-EXISTING dotPha/artifact suites pass with assertions UNCHANGED (11/11) | PASS |
| H2 | Presentation ordering drift (announce-before-clear, panel nav, route home, scene-exit event) | Adapter inspection + all sequencing preserved: service resolve → presentOutcome → clearActiveTribulation → exitTribulationScene → route home → event emit. Vietnamese announcement strings byte-identical (verified by string diff) | PASS |
| H3 | Pinia $state absent-key write loses highestFoundationAchieved (SUSPECTED latent bug in the OLD Vue path? No — old path wrote through the STORE proxy; migration probe confirmed raw $state would break it) | Probe #1/#2 (removed): writing absent optional keys on `store.$state` does NOT reflect through the proxy; store writes do. Service contract now REQUIRES the store instance (writer extends PlayerData; adapter passes the store) | PASS (contract-level prevention, documented in service header) |
| H4 | Double-application (A3): outcome applied twice | Adapter clears the session immediately after resolve; `checkTribulationOutcomeAction` early-returns when `active === null`; App.vue calls once per tick. Realm/talent writes idempotent; cultivation loss cannot double-fire because a second call sees no active session | PASS (by-construction; same structure as the pre-migration path) |
| H5 | Quest/loot/persistence one-hop consumers | `GameManager.questLifecycle` 19 tests, `QuestSystem` suite, `SaveRoundTrip` 9 tests (incl. `greatDaoOpportunityLost` field), `BreakthroughGrades` 7 tests (domain read of the loss flag) — all green | PASS |
| H6 | A6 guard regression from new core test importing pinia/stores | Guard tripped the new test file during development (working as intended); resolved by documented production-only exemption (A12 composition-root testing). R14 guard suite 10/10 | PASS |

## Confirmed defects

None. One real design constraint was surfaced and handled during
development (H3): the service writes MUST go through the store instance,
not `$state` — encoded in the type contract + service header doc, and
proven necessary by a reproducible probe during design.

## Suspected / coverage gaps

- Real-browser tribulation run not performed (P14 deferred, isolated
  worktree). The headless suites cover the outcome logic end-to-end
  through the real GameManager tick loop.
- i18n: announcement strings remain hardcoded in the domain result (same
  as the pre-migration Vue code). Pre-existing convention gap, tracked.

## Verification evidence

- `npm run type-check`: PASS
- `npm run build`: PASS
- Full suite: **472 files / 3197 tests PASS** (baseline 471/3191; +6
  service tests; guard comment change exempted core tests from A6 scan)
- `eslint` on all three touched source files: clean

## Verdict

**PASS WITH EVIDENCE**
