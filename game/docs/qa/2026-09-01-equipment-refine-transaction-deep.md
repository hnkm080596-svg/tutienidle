# QA Review: equipment Refine transaction rework

- Date: 2026-09-01
- Mode: deep
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/App.vue`, `game/src/core/equipment/EquipmentBag.ts`, `game/src/core/equipment/EquipmentSystem.ts`, `game/src/core/game/GameManager.ts`, `game/src/services/save/SaveSystem.ts`, `game/src/services/save/saveShapeValidation.ts`, `game/src/core/presentation/ActionAvailability.ts`, `game/src/composables/useEquipmentActions.ts`, `game/src/components/panels/EquipmentHallPanel.vue`, `game/src/locales/vi.json`, `game/src/locales/en.json`, and their focused tests

## Scope and Risk Map

Refine is a synchronous paid preview/commit transition spanning an exact live equipment object, its inventory membership, forge-use budget, unified essence, generic spirit stones, equipped modifier projection, current-save restore, and Vue overlay lifecycle. The changed-risk mapper routed the explicit task paths to all seven domain packs because `GameManager` and save restore are shared hotspots; direct ownership review narrowed the material hypotheses to inventory/equipment, economy conservation, current-save recovery, and UI lifecycle.

Fix-round-2 re-review invalidated the earlier `PASS WITH GAPS` conclusion: intended RED tests confirmed that current equipment entries could pass shallow validation and crash restore, string-ID provenance could be reused by another/live-again object or after state changes, and finite RNG values outside `[0,1]` could debit resources and violate the 5%-20% contract. Fix-round-3 re-review then contradicted the round-2 `PASS WITH GAPS` claim as well: unknown current template/affix references were silently discarded after earlier restore owners could mutate, equipment and slot-state entries accepted arbitrary slot strings, Refine provenance omitted `mainStat`, and malformed runtime payload entries could throw or be accepted. Fix-round-4 re-review exposed three further contradictions: manager-local registry preflight ran after `App.vue` had already restored Pinia and assigned the active player; Refine provenance still omitted optional equipment metadata (`realmLevel`, `zoneId`, and `icon`); and the commit boundary inspected top-level payload length/entries before proving the payload was an array. All findings are retained below as confirmed history and resolved regressions rather than being erased from the report.

Old-save migration remains out of scope under the development-build rule. Combat, time/offline, cloud concurrency, and Phaser lifecycle were inspected as one-hop consumers but no new asynchronous writer, clock, frame-loop transition, or network operation was added.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-REFINE-1 | `saveShapeValidation` current equipment | Parse a current entry before restore | Required main-stat identity/source/stat fields exist; optional numeric modifier fields are finite; affix ID is nonempty, tier is a positive integer, value is finite, and both equipment/slot-state slots belong to `EQUIPMENT_SLOTS` | Missing, null, NaN, infinity, wrong enum | Exact validation path and `corrupted` load outcome | Unit/integration | Critical |
| INV-REFINE-2 | App restore coordinator + Pinia player + `GameManager` + equipment/affix registries | Restore entries containing a current template or affix definition that no longer exists | Every registry reference is preflighted before Pinia restore, active-player assignment, or manager restore; the manager repeats the same defensive preflight; catalog drift produces a controlled handled result instead of an unhandled startup failure or partial mutation | Stale data/catalog removal/reorder/outer-owner ordering | Handled rejected result; complete prior Pinia, manager, bag, material, and modifier state unchanged | Integration | Critical |
| INV-REFINE-3 | `EquipmentSystem` pending capability | Preview, replace the bag object with the same ID/snapshot, commit | Only the exact live object that paid may commit | Replacement/stale identity | Commit rejects and replacement value is unchanged | Unit | Critical |
| INV-REFINE-4 | Equipment object state | Mutate item ID, slot/equipped/protection, grade, quality, forge budget, optional `realmLevel`/`zoneId`/`icon`, any actual `mainStat` identity/source/type/stat/tag/numeric field, or affix identity/tier/order/raw value after preview | Every relevant source snapshot remains exact until commit, including optional undefined-to-defined and defined-to-undefined transitions | Value mutation/add/remove/reorder/stale state | `invalid_refine_preview`; full item snapshot unchanged by rejection | Unit | Critical |
| INV-REFINE-5 | `EquipmentBag` membership | Remove/re-add the same object, manually dissolve it, or auto-dissolve/re-add it | A membership lifecycle change permanently invalidates the old paid capability | Interruption/reorder | Membership generation changes; commit rejects | Unit/integration | Critical |
| INV-REFINE-6 | Single pending capability | Start another preview, fail a preview on another item, explicitly discard, switch/unmount UI, commit, or replay | At most one bounded capability exists; every attempt/cancel consumes the old one exactly once | Repeat/interruption/lifecycle | Old payload rejects; rendered pending controls disappear; no value changes | Unit/component | Critical |
| INV-REFINE-7 | Preview payload | Commit a top-level null/object/string/number container, or absent, tampered, decreasing, out-of-tier, NaN/infinite, null/primitive/missing/extra/reordered/duplicate, or replayed entries | The top-level container must be an array before length/iteration; only the exact finite generated payload and exact entry shape commit once; every malformed attempt rejects without throw/mutation and consumes the capability | Tamper/repeat/reorder/container/value shape | Exact result/reason, no throw, affix snapshot, rejected replay | Unit | Critical |
| INV-REFINE-8 | Refine RNG | Roll with `0`, `1`, `-1`, `1.01`, NaN, or infinities, including a bad later line | Only `[0,1]` inclusive is accepted; rejection occurs before any forge/material spend and no partial multi-line result escapes | Boundary/value mutation | Exact endpoint values; all owner snapshots unchanged on rejection | Unit | Critical |
| INV-REFINE-9 | Forge/material owners | Preview/commit at every quality and nonzero discount | Preview debits exactly one forge use and the displayed essence/generic-stone costs once; commit does not debit again | Conservation/repeat/stale derived state | Exact before/after balances and displayed cost | Unit/integration | Critical |
| INV-REFINE-10 | Raw affix values | Refine below min, at/above max, nonfinite, locked, or missing-tier lines | Eligibility reads finite raw values; product precedes clamp; max/locked/missing-tier lines consume no RNG | Boundary/value mutation | Exact eligible indices, calls, value and rejection reason | Unit | Critical |
| INV-REFINE-11 | Equipment Hall Vue lifecycle | Render both locales, preview, keep/discard, or tear down overlay | Paid-action meaning remains complete and wrappable; discard/teardown invalidates core provenance | Locale/lifecycle/interaction | Rendered copy/buttons and rejected direct stale commit | Component/static | High |
| INV-REFINE-12 | Persisted valid transaction | Preview, commit, JSON round-trip, validate, and restore | Post-commit value, remaining materials/forge uses, identity/tier, and equipped modifier survive once | Persistence/reload | Fresh-manager bag/material/modifier equality | Integration | Critical |
| INV-REFINE-13 | Shared one-hop systems | Review combat/time/cloud/Phaser consumers | No new timer, event listener, offline settlement, or async writer changes Refine ordering | Timing/concurrency/degraded environment | Ownership inspection and full regression | Inspection/suite | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| Fix-round-2 focused RED: `npm.cmd test -- --run` with save validator/load, EquipmentBag, EquipmentSystem, GameManager Refine, panel, and ActionAvailability files | EXPECTED FAIL | 7 files failed; **49 failed / 255 passed**. The failures reproduced 22 structural validator holes, malformed save acceptance, two membership holes, 20 provenance/RNG holes, the unknown-affix restore throw, missing UI discard, and missing reason mapping. |
| Fix-round-3 exact focused RED: four validator/round-trip/core/manager files | EXPECTED FAIL | **21 failed / 275 passed**. Two unknown registry references were silently accepted; two slot enums plus two JSON round trips passed; all 12 `mainStat` mutations plus optional removal committed; null payload threw and an entry with an extra key committed. Missing/extra/reordered/duplicate cardinality probes were already green and retained as mutation-resistant regressions. |
| Fix-round-3 exact GREEN | PASS | Four files / **296 tests**. Every intended RED became green. |
| Fix-round-3 core/save/manager matrix | PASS | Nine files / **332 tests**, including SaveSystem, EquipmentBag auto-dissolve, Refine/Wash/Dissolve manager integration, and build snapshot. |
| Fix-round-4 exact focused RED: `npm.cmd test -- --run src/core/equipment/EquipmentSystem.test.ts src/services/save/SaveSystem.bootRestore.test.ts src/core/game/GameManager.refineTransaction.test.ts` | EXPECTED FAIL | 2 files failed / 1 passed; **12 failed / 209 passed**. Six optional-metadata mutations committed, three malformed top-level containers threw before rejection, and all three boot-coordinator regressions failed because the preflight-first coordinator did not exist. The number-container probe was already safely rejected and remains in the matrix. |
| Fix-round-4 exact GREEN: same three-file command | PASS | Three files / **221 tests**. Every intended RED became green. |
| Fix-round-4 App/store/manager/core/save matrix | PASS | 14 files / **356 tests**, covering real Pinia boot ordering, SaveSystem/load shape/round trip/cloud, Refine/Wash/Dissolve manager paths, player stores, boot flow, and build snapshot. |
| Core/save/bag/manager GREEN focused run | PASS | 6 files / **292 tests**. |
| Equipment Hall locale/discard GREEN | PASS | 1 file / **12 tests** before the QA teardown probe; both vi/en discard flows rejected a direct stale commit. |
| Save round-trip/cloud/bag/manager/UI cross-check | PASS | 5 files / **29 tests**. |
| Deep-QA mutation probes: multi-line late-invalid RNG + panel unmount | PASS | 2 files / **197 tests**; a bad second eligible roll caused no debit, and unmount consumed the pending capability. |
| Final `npm.cmd test -- --run` | PASS | Fix-round-4 result: **283 files / 1866 tests**. |
| `npm.cmd run type-check` | PASS | `vue-tsc --build`, zero errors. |
| `npm.cmd run build` | PASS | 648 modules transformed; inherited large-chunk warning only. |
| Focused ESLint on final round-4 production/tests | PASS | Zero errors; one inherited `KIEM_TRAN_SLOT_INDEX` unused-symbol warning in `GameManager.ts`. |
| Changed-risk mapper on explicit fix-round-4 paths | DEEP CANDIDATE | All seven domains, no unmapped paths; `App.vue`, shared manager, and save/session hotspots required this deep audit. Direct ownership inspection narrowed the changed synchronous chains to boot restore, Refine provenance, and commit validation; no new timer, network, frame-loop, or combat writer was introduced. |
| Stale/caller scans + `git diff --check` | PASS | App boot uses the preflight-first coordinator; the manager invokes the same public preflight defensively; optional snapshot fields and the top-level array guard have expected definitions/callers. No production `pendingRefinePreviews`, retired variance/cost symbol, or symmetric +/-20 copy remains. Historical wording remains only in reports. |
| Playwright/direct browser constrained-geometry check | NOT VERIFIED | Intentionally not rerun per coordinator instruction because the established runner prints successful cases but does not terminate cleanly. No direct-browser geometry oracle was available. |

## Findings

### QA-2026-09-01-010: current equipment save shape could reach restore-crashing state

- Severity: Critical
- Status: Confirmed (resolved in fix round 2)
- Invariant: INV-REFINE-1 and INV-REFINE-2
- Preconditions: A current-version equipment entry has missing/invalid `mainStat` contract fields, malformed affix identity/tier/value, or an affix ID absent from the registered catalog.
- Reproduction: Validate missing identity/source/stat and null/nonfinite optional numeric values; load a shallow malformed current entry; restore a syntactically valid entry with an unknown affix ID.
- Expected: Structural corruption hard-fails before restore; registry-dependent unknown IDs cannot reach a throwing lookup.
- Actual before repair: Shallow validation returned `ok`; `refreshModifiers()` threw `Affix not found` for an unknown ID.
- Evidence: Intended RED failures in `saveShapeValidation.test.ts`, `SaveSystem.test.ts`, and `GameManager.refineTransaction.test.ts`; all now green.
- Test file: `game/src/services/save/saveShapeValidation.test.ts`, `game/src/services/save/SaveSystem.test.ts`, `game/src/core/game/GameManager.refineTransaction.test.ts`
- Owner subsystem: Save shape / equipment restore
- Blast radius: Current-save boot failure or nonfinite modifier contamination.

### QA-2026-09-01-011: string-ID provenance survived object/state/lifecycle changes

- Severity: High
- Status: Confirmed (resolved in fix round 2)
- Invariant: INV-REFINE-3 through INV-REFINE-7
- Preconditions: A paid Refine preview exists, then the object is replaced, removed/re-added, manually/automatically dissolved, mutated outside affixes, canceled, or superseded by a failed preview on another item.
- Reproduction: Commit the original exact payload after each transition.
- Expected: Every stale transition rejects without mutation; canceled/consumed capability cannot replay.
- Actual before repair: Same-ID replacement, same-object re-add, non-affix state changes, dissolve/re-add, and a failed preview on a different ID could retain/accept old Map-backed provenance.
- Evidence: Intended RED failures in `EquipmentSystem.test.ts` and absent UI/core discard method; exact-object/membership/full-snapshot/cancel regressions now pass.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`, `game/src/core/equipment/EquipmentBag.autoDissolve.test.ts`, `game/src/components/panels/EquipmentHallPanel.test.ts`
- Owner subsystem: Equipment Refine preview capability / bag lifecycle / Vue overlay
- Blast radius: Applying a paid roll to a different or stale item state, including after destructive ownership transitions.

### QA-2026-09-01-012: finite RNG outside probability domain could violate Refine and charge

- Severity: High
- Status: Confirmed (resolved in fix round 2)
- Invariant: INV-REFINE-8
- Preconditions: Injected/corrupt RNG returns a finite value below zero or above one.
- Reproduction: Roll with `-1` or `1.01`, plus NaN and infinities, and place an invalid roll after a valid eligible-line roll.
- Expected: `invalid_random_roll` before forge/material spend with no partial values.
- Actual before repair: `-1` and `1.01` were accepted and could decrease or exceed 20%; nonfinite rolls used an unrelated affix-value reason.
- Evidence: Five intended RED boundary cases; final endpoint/domain/multi-line atomicity regressions pass and the presentation reason is mapped.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`, `game/src/core/presentation/ActionAvailability.test.ts`
- Owner subsystem: Equipment Refine RNG/transaction boundary
- Blast radius: Contract violation plus irreversible paid-resource loss.

### Prior confirmed findings retained from fix round 1

- `QA-2026-09-01-007`: stale vi/en symmetric-variance copy; resolved by rendered locale regressions.
- `QA-2026-09-01-008`: commit accepted missing/tampered/stale/replayed payloads; its affix/payload protections remain green but fix round 2 strengthened object/state/membership provenance.
- `QA-2026-09-01-009`: effective-value normalization and shallow numeric validation hid malformed raw values; finite raw eligibility and serialized-null rejection remain green, with fix round 2 completing the rest of the saved main-stat/affix shape.

### QA-2026-09-01-013: unknown current registry references were silently discarded after partial restore could begin

- Severity: Critical
- Status: Confirmed (resolved in fix round 3)
- Invariant: INV-REFINE-2
- Preconditions: A syntactically current save contains a valid equipment entry followed by an entry whose template or affix ID is absent from the runtime registries, plus another restore-owned state such as materials.
- Reproduction: Restore the save into a registered fresh manager and compare material, equipment, and modifier owners before/after.
- Expected: A controlled hard failure occurs before any restore owner mutates.
- Actual before repair: Unknown entries were silently filtered inside the later equipment loop; materials had already been added, so the load could appear successful while losing current equipment and partially mutating other owners.
- Evidence: Two intended RED cases in `GameManager.refineTransaction.test.ts`; both now throw controlled template/affix errors with material, bag, and modifiers unchanged.
- Test file: `game/src/core/game/GameManager.refineTransaction.test.ts`
- Owner subsystem: `GameManager` current-save registry preflight
- Blast radius: Silent current-equipment loss and partially restored sessions.

### QA-2026-09-01-014: current equipment slots accepted arbitrary strings

- Severity: Critical
- Status: Confirmed (resolved in fix round 3)
- Invariant: INV-REFINE-1
- Preconditions: A current equipment entry or equipment-slot state uses a nonempty string outside the six canonical slots.
- Reproduction: Validate direct current shapes and the same shapes after JSON round trip.
- Expected: Exact `.slot` path hard-fails before `EquipmentSlotManager` or modifier refresh receives the entry.
- Actual before repair: Both fields were checked only as strings; invalid equipment could make modifier refresh dereference a missing canonical slot, while invalid slot state polluted the fixed-slot map.
- Evidence: Four intended RED cases across direct validator and JSON round-trip tests; all now green against `EQUIPMENT_SLOTS`.
- Test file: `game/src/services/save/saveShapeValidation.test.ts`, `game/src/services/save/SaveRoundTrip.test.ts`
- Owner subsystem: Current save shape / equipment slot restore
- Blast radius: Current-save boot failure or invalid persistent slot ownership.

### QA-2026-09-01-015: Refine provenance omitted the complete main-stat source snapshot

- Severity: High
- Status: Confirmed (resolved in fix round 3)
- Invariant: INV-REFINE-4
- Preconditions: A paid preview exists and any actual `StatModifier` field is changed, added, or removed before commit.
- Reproduction: Mutate `id`, `sourceId`, `sourceType`, `stat`, `tag`, `flat`, `percent`, `multiplier`, `stacks`, `maxStacks`, `perLevelFlat`, or `perLevelPercent`; separately remove a snapshotted optional field.
- Expected: Commit rejects atomically and consumes the capability.
- Actual before repair: Every mutation was ignored because `mainStat` was absent from provenance; the stale paid payload committed.
- Evidence: Thirteen intended RED cases in `EquipmentSystem.test.ts`; all now reject against an explicit full-field clone/comparison.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`
- Owner subsystem: Refine pending capability
- Blast radius: Applying a paid result to equipment whose stat source changed after preview.

### QA-2026-09-01-016: malformed runtime Refine payload entries could throw or bypass exact shape

- Severity: High
- Status: Confirmed (resolved in fix round 3)
- Invariant: INV-REFINE-7
- Preconditions: A paid preview exists and the commit boundary receives a null or structurally extra payload entry despite TypeScript's static API.
- Reproduction: Cast runtime `unknown` payloads containing `null` or `{ index, value, extra }`; also retain primitive/missing/cardinality/reorder/duplicate probes.
- Expected: No throw or mutation; `invalid_refine_preview`; capability consumed.
- Actual before repair: Null dereference threw and an entry with an extra key was accepted and committed.
- Evidence: Two intended RED cases plus already-green malformed/cardinality mutation probes in `EquipmentSystem.test.ts`; the exact non-null object guard now keeps the whole matrix green.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`
- Owner subsystem: Refine runtime commit boundary
- Blast radius: UI/session failure or untrusted payload acceptance after an irreversible paid preview.

### QA-2026-09-01-017: App boot mutated Pinia before registry-dependent save rejection

- Severity: Critical
- Status: Confirmed (resolved in fix round 4)
- Invariant: INV-REFINE-2
- Preconditions: A structurally valid current save contains an equipment template or affix ID missing from the registered runtime catalogs, and App boot reaches the loaded-save branch.
- Reproduction: Run the real Pinia player owner and a registered `GameManager` through the boot restore sequence with unknown-template and unknown-affix saves; snapshot both owners and their equipment modifiers before the call.
- Expected: Registry references are checked before any player or manager restore mutation, and startup receives a controlled rejected result for the existing boot-error path.
- Actual before repair: `App.vue` restored the player and assigned it to the manager before `GameManager.restoreFromSave` reached its preflight, so the later throw escaped the async boot path after Pinia had already changed.
- Evidence: Three intended RED cases in `SaveSystem.bootRestore.test.ts`; unknown template and affix now return handled rejection with byte-for-byte player state and serialized manager/material/equipment/modifier state unchanged, while the valid save restores both owners.
- Test file: `game/src/services/save/SaveSystem.bootRestore.test.ts`
- Owner subsystem: App boot / Pinia player / current-save registry orchestration
- Blast radius: Unhandled startup failure plus a partially restored live session.

### QA-2026-09-01-018: Refine provenance omitted optional equipment metadata

- Severity: High
- Status: Confirmed (resolved in fix round 4)
- Invariant: INV-REFINE-4
- Preconditions: A paid Refine preview exists and `realmLevel`, `zoneId`, or `icon` is added, changed, or removed before commit.
- Reproduction: Exercise undefined-to-defined and defined-to-undefined transitions for each optional field, then commit the exact preview payload.
- Expected: Every transition rejects atomically as `invalid_refine_preview` and consumes the capability.
- Actual before repair: All six mutations were absent from `RefineInstanceSnapshot`, so the stale paid payload committed.
- Evidence: Six intended RED cases in `EquipmentSystem.test.ts`; all now reject against the extended snapshot/comparison.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`
- Owner subsystem: Refine pending capability
- Blast radius: Applying paid results after the underlying equipment identity/provenance metadata changed.

### QA-2026-09-01-019: malformed top-level Refine payload containers were dereferenced before validation

- Severity: High
- Status: Confirmed (resolved in fix round 4)
- Invariant: INV-REFINE-7
- Preconditions: A paid preview exists and the runtime commit boundary receives null, an object, a string, or a number instead of the values array.
- Reproduction: Cast each top-level value through the TypeScript boundary and assert no throw, no affix mutation, exact rejection, and consumed replay capability.
- Expected: The container is proven to be an array before length or iterator access; every invalid shape returns `invalid_refine_preview` atomically.
- Actual before repair: Null threw while reading `length`, and object/string values reached `.every` and threw; number happened to reject safely but was not protected by an explicit container contract.
- Evidence: Four-container regression matrix in `EquipmentSystem.test.ts`; all cases now reject without throw or mutation and consume the capability.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`
- Owner subsystem: Refine runtime commit boundary
- Blast radius: UI/session failure after an irreversible paid preview.

No confirmed or suspected product finding remains open in the audited scope.

## New or Changed QA Tests

- `game/src/core/equipment/EquipmentSystem.test.ts`: RNG domain and late-line atomicity; exact object, full state, lifecycle, manual/auto dissolve, explicit discard, cross-item failed preview, tamper, and replay.
- `game/src/core/equipment/EquipmentSystem.test.ts` (fix round 3): every actual `StatModifier` field plus optional removal, null/primitive/missing/extra/reordered/duplicate runtime payloads, capability consumption, and rejection atomicity.
- `game/src/core/equipment/EquipmentSystem.test.ts` (fix round 4): both presence directions for `realmLevel`, `zoneId`, and `icon`, plus top-level null/object/string/number payload containers with no-throw, nonmutation, and capability-consumption oracles.
- `game/src/core/equipment/EquipmentBag.autoDissolve.test.ts`: membership generation on remove/re-add and auto-dissolve.
- `game/src/services/save/saveShapeValidation.test.ts`: required `StatModifier` shape, all optional numeric fields, affix identity/tier/value, both canonical slot enums, valid current entry, and legacy discard ordering.
- `game/src/services/save/SaveRoundTrip.test.ts`: equipment and slot-state invalid enums still reject after JSON serialization.
- `game/src/services/save/SaveSystem.test.ts`: malformed current entry classifies as corrupted.
- `game/src/core/game/GameManager.refineTransaction.test.ts`: unknown template/affix preflight hard-failure before any owner mutation and valid persisted transaction.
- `game/src/services/save/SaveSystem.bootRestore.test.ts`: exact App restore coordinator against real Pinia and a registered manager; unknown template/affix produces handled rejection before either owner changes, and a valid save restores both owners and modifier projection.
- `game/src/components/panels/EquipmentHallPanel.test.ts`: vi/en paid rule/discard and unmount invalidation through the real manager.
- `game/src/core/presentation/ActionAvailability.test.ts`: dedicated invalid-RNG feedback mapping.

## Gaps and Residual Risk

- Constrained real-browser geometry remains a bounded coverage gap. Component assertions prove complete text, semantic buttons, and the existing flex row now wraps; no direct browser measurement proves the narrowest container. This does not weaken the state-safety verdict, but the visual conclusion is limited to component/static evidence.
- Playwright was not rerun because the known runner teardown issue was explicitly excluded from this round. No process/session remains active.
- Pending Refine capability is intentionally process-local and ephemeral. Reload discards it and cannot refund the already-paid preview; this matches the existing preview design but is not a resumable transaction.
- Registry-dependent unknown template/affix IDs are preflighted by the App restore coordinator before Pinia restore or active-player assignment; `GameManager.restoreFromSave` defensively invokes the same public pure check before manager mutation. The data-agnostic save parser remains responsible only for structural validity.
- Old-save migration is intentionally unsupported in the development phase.

## Pre-existing Failures

- None in Vitest, type-check, or build.
- The production build retains the existing large-chunk warning.
- The previously observed Playwright non-terminating teardown is a tooling gap, not evidence of a Refine product failure.
