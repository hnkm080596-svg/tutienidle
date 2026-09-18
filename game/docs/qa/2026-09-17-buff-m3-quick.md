# QA Report — Buff M3 lifecycle/periodic protocol (quick)

Date: 2026-09-17 · Mode: quick · Scope: `game/src/core/buff2/` M3 diff
(`BuffSystem.ts` lifecycle section, `BuffPersistence.ts`,
`BuffQuery.ts` canonical-sort fix, `BuffTestFixtures.ts` lctx/settle helpers)

## Risk map

`changed-risk-map.mjs` → all task paths `unmappedPaths` (buff2 is a new
subsystem; zero production consumers until M4 cutover). Manual routing:
domain = combat-and-tribulation; no one-hop production callers exist —
the only consumers are buff2's own tests/fixtures. Risk bounded to
internal spec conformance; no runtime regression surface yet.

## Invariant ledger

| ID | Hypothesis | Invariant | Check | Result |
| --- | --- | --- | --- | --- |
| INV-M3-1 | Earlier unit kills target -> later units skip | Lifecycle | `emitLifecycleUnit` revalidates `store.get` + `isAlive(targetId)` per unit | PASS — pinned by `tick-1 kill -> ticks 2-3 skip` |
| INV-M3-2 | Pending `uses` mark double-folds | Exactly-once | `resolveChannel` + `collectUseMarks` exclude `pendingRequestId` entries | PASS |
| INV-M3-3 | Mark leaks after instance removal | Atomicity | `removeInstance` releases entry marks + filters `pendingUses` | PASS |
| INV-M3-4 | Interval remainder lost on killed units | Determinism | Accumulator written upfront per r4 BLOCKER 2 — intended | PASS (spec-intended) |
| INV-M3-5 | Source death mid-phase | Lifecycle | Spec assigns source-death sweep to Phase B gated on `removeOnSourceDeath`; `onEntityDeath` + Phase B both check the flag | PASS |
| INV-M3-6 | Conversion double-fires | Exactly-once | Threshold fires once; new instance counters reset, old removed `'replaced'` | PASS — pinned by conversion tests |
| INV-M3-7 | requestId collisions | Determinism | Per-instance `periodicTickCount` ordinal; no rootActionId dependence | PASS |
| INV-M3-8 | Manual all-dead emits nothing | Truthful result | `firstLiveIndex < 0` -> `{started:false, candidateUnitCount}` | PASS — pinned |
| INV-M3-9 | Query ordering nondeterministic | Determinism | `getForTarget`/`getForSource`/`getByDefinition` leaked insertion order | DEFECT FOUND + FIXED — now `compareInstance`-sorted |
| INV-M3-10 | Persistence mode strands periodic | Recoverability | Constructor rejects periodic defs; no settled handler registered | PASS — pinned |
| INV-M3-11 | Continuation skips dead instance mid-series | Lifecycle | `handlePeriodicSettled` loop revalidates `store.get` + `isAlive` — no test pinned it | COVERED — two new tests added |

## Findings

- **FIXED during M3** — `BuffQuery` multi-instance queries leaked
  insertion order (INV-M3-9). `getForTarget`, `getForSource`,
  `getByDefinition` now sort with `compareInstance`. Found by
  `BuffOrdering.test.ts`; verified 157/157 green.
- No unresolved defects. Coverage gap INV-M3-11 closed by two tests in
  `BuffLifecycle.test.ts` (continuation death / instance removal).

## Evidence

- `npx vitest run src/core/buff2` — 13 files / 157 tests, all pass.
- `npm run type-check` (vue-tsc --build) — clean.
- New QA-pinning tests: `continuation: unit A consequence kills the
  target -> B skipped at revalidation`, `continuation: unit A
  consequence removes the instance -> B skipped at revalidation`.

## Verdict

PASS WITH EVIDENCE
