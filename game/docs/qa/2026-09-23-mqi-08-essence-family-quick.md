# QA Review: M-QI-08 Grade-Aware Essence Family

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/data/realm/PhysiqueEssence.ts` (new registry: family map, band map, band drops)
  - `game/src/data/realm/PhysiqueEssence.test.ts` (new)
  - `game/src/data/materials/materials.ts` (2 new Material entries)
  - `game/src/core/realm/body/BodyChapter.ts` (`bodyChapterEssenceGrade` predicate)
  - `game/src/core/game/BattleLootSystem.ts` (particle predicate widened to family membership)
  - `game/src/core/game/BattleLootSystem.dropResult.test.ts` (2 new particle-routing tests)
  - `game/src/data/enemy/HiddenBeasts.ts` (comment only - documents the huyet_mong exception)
  - docs (spec/plan) excluded - C2C-reviewed artifacts, not runtime code

## Scope and Risk Map

Mapper: domains `combat-and-tribulation`, `economy-and-progression`, `inventory-equipment`; `deepAuditCandidate: true` ("cross-system change: 3 domains"); one `unmappedPaths` entry (`BattleLootSystem.dropResult.test.ts` - test file, manually routed to combat-and-tribulation, no production risk).

Escalation decision: risk confidently bounded by inspection - quick mode retained.
- No persistence surface: save shape untouched; material-bag save validation is structural only (`id string + amount >= 0`, saveShapeValidation.ts:776/1485) - new material ids do not change validation semantics.
- No transaction changed: `investBodyChapter` still reads `currency.id` verbatim; `bodyChapterEssenceGrade` is a new pure export with no wired consumer until M-QI-09.
- The only behavior change is particle classification in `BattleLootSystem` - and it is behavior-identical on every reachable drop today (only `tinh_hoa_pham_the` can drop; no table, recipe, or vendor references the new ids).
- The essence stream consumer (`useAppLifecycle.ts:148-166`) reads only `event.kind === 'essence'` as a boolean timing signal - no item identity or amount coupling; the bag deposit precedes the particle and stands alone.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-MQI08-1 | Reward particle stream / BattleLootSystem | Material drop lands | Exactly-once + routing fidelity: family member emits 'essence', others 'item' | Value mutation (non-family id), boundary (family id) | `reward_particle` event kind | Vitest unit | High impact if misrouted (future M-QI-10 drops); reachable today only via pham |
| INV-MQI08-2 | MaterialBag / BattleLootSystem | Family material drop | Conservation: deposit precedes particle; overflow/notification paths unchanged | Reorder (deposit vs emit) | `materialBag.getAmount` + emit order in code | Vitest unit | Medium - path unchanged, deposit is above the predicate |
| INV-MQI08-3 | `luyen_khi_tinh_hoa` (crafting essence) / dissolve path | Any drop of the OTHER 'essence'-category material | Classification: NOT physique essence - must stay 'item' | Value mutation (essence category, non-family id) | `physiqueEssenceGradeOf('luyen_khi_tinh_hoa') === undefined` + 'item' particle for sig_mat | Vitest unit | Medium - category name collides conceptually; registry pins the distinction |
| INV-MQI08-4 | BodyChapterCurrency / BodyChapter | `bodyChapterEssenceGrade(currency)` | Namespace rule: pill-bag currency with colliding id must NOT classify | Value mutation (synthetic `{bag:'pill', id:'tinh_hoa_bao_the'}`) | Predicate returns undefined for pill currency; 'pham' for refinement material | Vitest unit | High - silent misclassification would poison M-QI-09 substitution |
| INV-MQI08-5 | PHYSIQUE_ESSENCE_BAND_DROPS / PhysiqueEssence | Authored band entries | Consistency: entry names its band's grade material by construction; mortal entry equals live line | Drift (live table retune) | `toEqual` live mortal guaranteed line; per-band materialId check | Vitest unit | Medium - authored-only data, no live consumer until M-QI-10 |
| INV-MQI08-6 | New Material entries / MaterialRegistry | Registry enumeration consumers | Boundedness: new ids are inert until a drop/recipe/vendor references them | Cross-system chain (who iterates `materials`) | No wholesale `materials.map/filter` consumer found; registry is id-keyed | Code inspection | Medium - consumers (bag UI, vendor, quests) read bag contents or authored refs only |
| INV-MQI08-7 | Save validation / saveShapeValidation | Hypothetical save carrying `tinh_hoa_bao_the` | Recoverability: structural stack validation unchanged | Stale state (pre-M-QI-10 save) | `validateStackEntries` = id-string + amount>=0, no registry membership check | Code inspection | Low - behavior identical before/after |
| INV-MQI08-8 | Essence stream state machine / useAppLifecycle | 'essence' particle for a family material | Presentation-only: emit flag + arrival timeout; no amount/identity read | Repeat (multiple family drops in one kill) | `onRewardParticle` reads only `event.kind` | Code inspection | Medium - bounded; bag credit is independent of the stream |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (P3 full: type-check + build + full vitest) | Green - 738 files / 6607 passed / 4 expected-fail | Full suite includes new registry tests + loot routing tests |
| `npx vitest run src/data/realm/PhysiqueEssence.test.ts src/core/game/BattleLootSystem.dropResult.test.ts src/data/materials` | 24/24 green | Focused surface |
| `npx vitest run tests/architecture/asciiComments.test.ts` | Green (P15) | New comments ASCII-clean |
| Wholesale `materials` iteration grep | No consumer iterates the catalog to grant/offer; consumers use id-keyed `MaterialRegistry` or bag contents | Code inspection |
| `validateStackEntries` (saveShapeValidation.ts:776) | Structural only; no registry membership check | Code inspection |
| `useAppLifecycle` essence handlers (148-166) | Boolean emit/arrival tracking only | Code inspection |

## Findings

None. Every high-ranked hypothesis resolved against shipped oracles (new unit tests) or decisive code inspection.

## New or Changed QA Tests

None beyond the task's own TDD suite (authored during implementation, inside QA allowlist paths anyway):
- `src/data/realm/PhysiqueEssence.test.ts` - 13 tests: authored set, round-trips, sparse lookups (incl. `golden_core`/`unknown_realm` negatives), material shape, band-map pin, drift sentinel vs live mortal line, premature-wiring guard on LQ/TC bands, namespace-gated `bodyChapterEssenceGrade` incl. the synthetic pill-collision regression.
- `BattleLootSystem.dropResult.test.ts` - 2 tests: family member (`tinh_hoa_bao_the`) routes 'essence'; non-family material keeps 'item'.

## Gaps and Residual Risk

- `bodyChapterEssenceGrade` has no wired consumer by design (M-QI-09 consumes it). Direct unit coverage exists; integration coverage arrives with the consumer. Not a gap in this mission's contract.
- `PHYSIQUE_ESSENCE_BAND_DROPS` is authored-but-unwired by design; the drift sentinel + premature-wiring guard keep the boundary honest until M-QI-10.
- P13/P14 not triggered: no wiring-critical files touched (no App.vue/lifecycle/GameManager.update/scene/save-load path). The changed predicate is behavior-identical on all currently reachable drops, and the one new presentation class is unit-covered via the event seam.

## Pre-existing Failures

None observed in scope. The 4 `expected fail` tests in the suite are pre-existing project-wide markers unrelated to this diff.
