# TC16 — Blind Terminal Falsification Report

- Commit: `ab0b135e021dbc915821c0855de3d395ce82a5ce` (devin/qa-fixpoint, pinned)
- Probe suite: `tests/architecture/tc16Falsification.qa.test.ts` — `npx vitest run` → **3/3 pass**
- Findings JSON: `docs/qa/runs/qa-fixpoint-master/evidence/tc16-findings.json`

## Verdict: PASS

Zero qualifying defects at Medium or above. Every unproducible-claim mint path probed either fails the shape gate (`assertSaveAcceptable` + `validateGameSaveShape`) or is re-gated/neutralized at the settle/restore seam. The only residues found are same-value forged counters a writer could produce, which are the declared accepted residual class.

## Method

Attacked the persisted surface fresh: for each persisted collection asked whether a dup/out-of-envelope/forged-claim could mint resources or claims at restore or settle — `saveShapeValidation` bounds vs writer shapes, `GameManagerSaveRestore.restoreFromSave` replacement semantics, offline-settle caps, tribulation/breakthrough state machines, devtools hooks, cross-slice coherence.

## Findings (all Nit — documented inert admissions, no defects)

| id | sev | claim | outcome |
|----|-----|-------|---------|
| F-TC16-EQ-DUPSLOT | Nit | Two `equipped:true` items on one slot | shape gate admits; `EquipmentBag.indexEquipped` collapses the dup (last wins) — restore mints ≤1 modifier set. Hold test pins the end-state. |
| F-TC16-TRIB-SKIPREALM | Nit | Forged victory receipt skipping a realm rung | shape gate admits (no adjacency bound); `settleOutcome` re-derives `isRealmTransitionEnabled` + `canTriggerBreakthrough` + hiddenDormant → returns null, nothing applied. |
| F-TC16-ALCHEMY-RECIPE-MISMATCH | Nit | Job `pillId` forged to a dormant-family pill | `validateAlchemyJobsSave` pins `pillId === recipe.pillId` and herb/span bounds → rejected at the gate. |

## Swept — no qualifying defect (condensed)

- **Quest slice**: shape-only validation, but progress/completion claims are writer-producible counters (excluded residual). `isBetaQuestEnabled` re-gates unlock/projection/claim; daily cadence absent from the catalog entirely.
- **Offline accrual**: production capped at 10h, auto-farm at 24h and requires `perfectClearStageIds` membership + authored cycle seconds + realm-earnable stage. Forged `lastSavedAt` can't widen the window.
- **persistentTimedEffects**: `tu_linh_tran` pinned to authored group/percent/span; pill regen pinned to authored `regenEffect` (single `manaRegenPerTurn` flat ≤ `mpPerSecond × 1.5`); dormant-family source ids rejected; future `appliedAtMs` rejected.
- **externalModifiers**: shape-checked then reset to `[]` on restore (per-tick mirror).
- **nodeLevels**: cross-way claims can't aggregate (`nodePathApplies`/`nodeWayApplies` at aggregation, not just purchase); prereq/mutex/realm/nodeCount gates replayed; core/skill-core coverage and F-SKL-1 producing-writer rules verified.
- **phaGiapCarryStacks**: mints only when the `pha_giap` talent is owned; seeds clamp to `maxStacks` (over-bank mints nothing beyond producible stacks); realm change zeroes the bank.
- **alchemyJobs**: concurrent-slot ceiling from persisted pill_room level (no room → 0 slots → rejection); room level/span/herb/pillId all pinned to authored recipe; dormant-family jobs park at tick; settle re-derives the deliverable.
- **tribulation slice**: cooldown bounded to `lastSavedAt + 300s`; grade bounded by `persistedResolvableFoundationRank`; `great_dao` rejected; receipt slot dedups re-settle.
- **Mortal boundary**: `cultivationPath`/`cultivationWay` rejected at realmId `mortal`; technique-holder contract exact-match; hidden-perfection strict-prefix integrity.
- **Devtools**: every window hook is `import.meta.env.DEV`-gated.
- **Import/export (`recoveryApi`)**: runs the identical validate+acceptance pipeline as boot restore.

## Gaps / limits

- No browser-runtime probing was performed (devtools hooks were verified `import.meta.env.DEV`-gated by inspection only).
- Pinned leg-order sims were reviewed for persisted-shape effects only; live simulation ordering outside the save surface was not fuzzed.
