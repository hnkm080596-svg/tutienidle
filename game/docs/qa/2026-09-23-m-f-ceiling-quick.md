# QA Review: M-F-CEILING release-policy authority

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `src/core/realm/ReleasePolicy.ts` (new), `ReleasePolicy.test.ts` (new), `src/core/game/GameManagerRealmAdvanceOps.ts`, `src/core/tribulation/TribulationDirector.ts`, `src/core/companion/CompanionAvailability.ts`, `src/core/game/FormationPlacement.ts`, `src/core/artifact/ArtifactProgression.ts`, `src/data/ui/commandWheelCatalog.ts`, `src/components/game/DongFuCommandWheel.vue`, `src/core/player/CultivationPathSystem.ts`, `src/core/material/Material.ts`, `src/core/pill/Pill.ts`, `src/core/alchemy/AlchemySystem.ts`, `src/data/materials/materials.ts`, `src/data/pill/pills.ts`, `src/data/alchemy/alchemyRecipes.ts`, `src/core/game/BattleLootSystem.ts`, `src/core/game/GameManagerAlchemyOps.ts`, `src/core/quest/QuestSystem.ts`, `src/locales/vi.json`, `src/locales/en.json`, test fixtures under `src/core/tribulation/*.test.ts`, `src/core/game/battleLootTestSetup.ts`.

## Scope and Risk Map

`changed-risk-map.mjs` returned all 20 listed paths as `unmappedPaths` and `deepAuditCandidate: false`. Manual routing:

- economy-and-progression — `ReleasePolicy`, `GameManagerRealmAdvanceOps`, `CultivationPathSystem`, `BattleLootSystem`, `QuestSystem`, `GameManagerAlchemyOps`, `materials/pills/recipes` data.
- combat-and-tribulation — `TribulationDirector` admission gate.
- ui-input-lifecycle — `commandWheelCatalog` + `DongFuCommandWheel` context rename (display-only predicate feed).

One-hop consumers inspected in current code: `useTribulation.ts` (calls `canTriggerBreakthrough` and `GameManager.startTribulation` — both now consult the authority upstream), `RealmPanel`/`EarlyGameSession` (auto-consult via `canTriggerBreakthrough`), `GameManagerSaveRestore`/`GameManagerTickOps`/`GameManagerRewardOps`/`GameManagerBuildingOps`/`GameManagerCompanionOps`/`EquipmentOpsSystem` `bag.add` sites (restore/settle/sink flows — deliberately NOT gated; see INV-CEILING-4), `CompanionProgression.ts:106` (companion's own `realmId` field, not the player transition — out of scope). Escalation decision: no mandatory deep trigger — no save-format change (`breakthroughRealmId` is static data, not persisted), no clock/offline change, and every realm-write path was enumerated and bounded by code inspection.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CEILING-1 | `player.realmId` / `GameManagerRealmAdvanceOps` + `TribulationDirector` | breakthrough admission at the ceiling boundary | Boundedness: a closed transition yields no requirements and refuses director start | Reorder + stale state (call admission directly, skipping UI) | `getBreakthroughRequirements` returns `[]` at TC; `director.start` returns `false` for `foundation_establishment→golden_core`, `true` for `mortal→qi_refining` | unit | High — progression lock is the mission core |
| INV-CEILING-2 | domain predicates (companion/formation/artifact) | `isRealmAvailable(unlock) && reached(unlock)` composition | Monotonicity: grandfathered saves keep domains; domain closes only when the unlock realm itself leaves the window | Stale state (dev save at `golden_core`) | `golden_core` save returns `true`; a hypothetical suppressed unlock realm returns `false` | unit | High — save-regression risk |
| INV-CEILING-3 | acquisition routes (loot, quest `itemDrops`, alchemy job start) | breakthrough-scoped delivery of `foundation_establishment`-tagged resources | Conservation: dormant tagged resources are never created via an authored route | Value mutation (tagged vs untagged in the same batch) | tagged TC material/pill suppressed while untagged `potion_hp`/`iron_ore` delivered; alchemy returns `realm_unavailable` before `room_not_built` | unit | High — economy creation |
| INV-CEILING-4 | restore/settle/sink `bag.add` sites | reload and settle with OWNED tagged resources | Recoverability + conservation: owned tagged resources survive restore and are never stripped | Interruption (reload holding `truc_co_dan`) | `GameManagerSaveRestore`/`settle` add paths contain no policy check — verified by inspection; only authored acquisition routes consult the policy | code inspection | Medium — gating here would be silent data loss |
| INV-CEILING-5 | `commandWheelCatalog` context | `hasFoundationRealm` -> `artifactDomainUnlocked` rename | Synchronization: phap_bao slot disabled state equals the artifact domain predicate | — | slot reports disabled until `artifactDomainUnlocked` true; zero `hasFoundationRealm` references remain | unit + grep | Low |
| INV-CEILING-6 | `alchemy.reason.*` locales | new `realm_unavailable` reason | Recoverability (UX): reason resolves to a real message, not the generic fallback | — | `i18nKeyParity` green; keys present in both `vi.json` and `en.json` | unit | Low |
| INV-CEILING-7 | `normalizeArtifactProgress` awaken gate | `meetsAwakenGate` via `isArtifactDomainUnlocked` | Monotonicity: artifact awakening allowed iff domain open (incl. grandfathered) | stale state | TC player `true`, pre-TC `false`, GC dev-save `true` | unit | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | full `tsc` pass |
| `npx vitest run` scoped suite (realm/tribulation/loot/quest/alchemy dirs + `tests/architecture`) | 707 tests green incl. `ReleasePolicy.test.ts` (17 tests) | Vitest output |
| `npx vitest run tests/architecture/i18nKeyParity.test.ts src/i18n src/components/panels/AlchemyView.test.ts` | 21 tests green | confirms locale key parity after `realm_unavailable` addition |
| `grep "realmId = "` production realm-write audit | all player-realm writes are `mortal→qi_refining` (`chooseCultivationPath`, inside window) or post-victory `settleOutcome` (downstream of gated admission) | `CompanionProgression` realm field is per-companion, not player transition |
| `grep hasFoundationRealm` | 0 references | rename complete |
| `git diff` realm-tag inspection | `great_dao_seed`, `truc_co_dan`, `alchemy_truc_co_dan` tagged `foundation_establishment`; `doan_bao_thach`, `chieu_hien_lenh`, `thien_dia_chi_kieu` deliberately untagged | owned by other missions |

## Findings

None Confirmed.

## New or Changed QA Tests

None added during this QA pass — the task's own `ReleasePolicy.test.ts` already covers the ledger hypotheses with executed evidence.

## Gaps and Residual Risk

- Coverage gap (Low): `equipment`/`equipment_any` drop kinds have no `breakthroughRealmId` channel — no authored breakthrough-scoped equipment exists today; a future author would need a new field.
- Suspected (Low): `GameManagerBuildingOps` claims and `EquipmentOpsSystem` salvage rewards can deliver arbitrary `materialId`s from authored data without consulting the policy. Today no authored source emits a tagged material, so the gap is latent, not reachable.
- Suspected (Low): `isRealmTransitionEnabled` admits forward skip-ahead (e.g. `mortal→foundation_establishment`) — matches the pre-existing chapters-presence semantics and an existing test (`useTribulation` dotPha admits mortal→TC directly); production only offers adjacent targets via `getNextRealm`. Documented design, not a defect.

## Pre-existing Failures

None observed in scoped runs.

## Addendum — C2C-9 pinned semantics (post-review findings 1-4)

- Tag completeness: `src/data/breakthrough/BreakthroughScopedResources.ts` is the canonical census of breakthrough-scoped resources; the integrity tests assert census ids carry a valid `breakthroughRealmId` and every tagged record is declared (both directions). The live gate binds the census via `TRUC_CO_DAN_PILL_ID`.
- Grandfathering removed (simple rule): domain predicates require `isRealmAvailable(playerRealmId)` — a persisted save beyond the ceiling hides companion/formation/artifact domains. Tests pin `golden_core` → hidden. (Refined by C2C-12 below: hiding is access-only — restore never strips persisted ownership.)
- Single-check invariant documented in `ReleasePolicy.ts` header: policy consulted once at origination; restore/delivery never re-checks. Audit: `grantCultivationPathRealmReward` (the only originating settle path) is gated; `GameManagerBuildingOps`/`EquipmentOpsSystem`/`GameManagerRewardOps`/`GameManagerTickOps`/`GameManagerCompanionOps` authored rewards emit no tagged ids today (latent gap unchanged); alchemy job completion delivers an authorized product gated at job start.
- Tribulation funnel enforced: `tests/architecture/tribulationAdmissionFunnel.test.ts` censuses director construction + `director.start` call sites to GameManager.ts and pins `startTribulationPrepared` as a delegation wrapper.

## Addendum — C2C-12 pinned semantics (impl review findings 1-4)

- Adjacent-only transitions: `isRealmTransitionEnabled` now requires `toIndex === fromIndex + 1 && isRealmAvailable(target)` — skip-ahead (e.g. mortal→Trúc Cơ) is rejected at the single funnel. Fixtures/tests repointed to the canonical source realm.
- Acquisition gate derives from the transition: `isBreakthroughAcquisitionEnabled(target)` resolves the canonical predecessor→target transition (predecessor-less realms degrade to availability) so the resource gate cannot drift from the tribulation gate; a per-realm drift test asserts equality for every authored target.
- Non-destructive restore boundary pinned: `normalizeArtifactProgress` never strips a persisted matching artifact for a release-hidden realm — the gate controls awakening only. Access is disabled at the domain seam: `BattleLootSystem.grantArtifactExperience` consults `isArtifactDomainUnlocked` (beyond-ceiling → no EXP, ownership preserved) and wheel slots stay locked. Regression test covers both.
- Wheel lock reason distinguished: `CommandWheelDisabledContext.realmReleaseUnavailable` (resolved from `!isRealmAvailable(player.realmId)`) gives hidden-by-release slots a separate tooltip (`'Chưa mở trong bản hiện tại'`) vs the `'Cần đạt Trúc Cơ'` progression lock.
