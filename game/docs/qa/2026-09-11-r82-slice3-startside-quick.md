# QA Quick — R8.2 Slice 3: Tribulation Start-Side Prep Migration

- **Date:** 2026-09-11
- **Scope:** branch `r8-start-side-flow` — new
  `TribulationOutcomeService.startTribulationPrepared()` (+2 tests),
  `useTribulation.ts` `triggerBreakthroughAction` delegates prep+start to
  the domain inside the admitted callback.

## Mapper result

Single domain `combat-and-tribulation`, `deepAuditCandidate: false`.
`useTribulation.ts` manually routed: the migrated consumer (reviewed
below).

## Invariant ledger

| # | Hypothesis | Evidence | Result |
|---|---|---|---|
| H1 | Prep ordering drift (unequip must precede the session) | Service test: unequip + modifier sync asserted BEFORE `getActiveTribulation()` becomes non-null; same relative order as the pre-migration admitted callback | PASS |
| H2 | Admission/orphaning semantics change | `runAdmitted` wrapper untouched; the domain call happens INSIDE the admitted callback exactly where the old writes were; no compensate command invented (spec constraint preserved) | PASS |
| H3 | Failure path leaks prep side effects | Unknown-realm refusal test: `startTribulation` false, no active session. Note: unequip still happens on refusal — SAME as the old Vue path (it also unequipped before calling startTribulation), behavior parity preserved | PASS (parity, including the wart) |
| H4 | End-to-end tribulation flow intact | dotPha (8) + artifact (3) suites pass unchanged — they drive triggerBreakthroughAction through the REAL new path | PASS |
| H5 | Persistence/one-hop consumers | SaveRoundTrip 9 + questLifecycle 4 green; no schema or quest-lifecycle surface touched | PASS |
| H6 | Guards | architecture guards 10/10 (in the 48-test focused run) | PASS |

## Confirmed defects

None.

## Suspected / coverage gaps

- Refusal-path unequip (H3) preserves a pre-existing wart: the player is
  unequipped even when the tribulation refuses to start. Parity-correct
  today; flagged as a candidate UX/product decision for the future (not
  architecture).
- P14 deferred (isolated worktree; no visual surface).

## Verification evidence

- type-check PASS, build PASS, full suite **475 files / 3206 tests PASS**
- eslint clean; R14 guards green

## Verdict

**PASS WITH EVIDENCE**
