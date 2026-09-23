# QA Review: M-F-BODY-PERFECTION hidden Body perfection

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/realm/body/BodyPerfection.ts`, `game/src/data/realm/BodyPerfection.ts`, `game/src/core/game/GameManager.ts`, `GameManagerQuestOps.ts`, `GameManagerTickOps.ts`, `GameManagerCompanionOps.ts`, `GameManagerRealmAdvanceOps.ts`, `GameManagerRewardOps.ts`, `GameManagerEconomyOps.ts`, `GameManagerBuildingOps.ts`, `BattleLootSystem.ts`, `battleLootTestSetup.ts`, `GameManagerSaveRestore.ts`, `src/core/player/Player.ts`, `src/core/quest/QuestSystem.ts`, `src/core/realm/body/BodyProgressionSystem.ts`, `src/components/panels/RealmPanel.vue`, `src/components/panels/realm/BodyPerfectionSection.vue`, `src/locales/{en,vi}.json`, `src/services/save/{saveVersion,saveShapeValidation}.ts`, plus 7 new/managed test files (`BodyPerfection.test.ts` data+domain, `BodyPerfection.channel.test.ts`, `GameManagerBodyPerfection.test.ts`, `SaveSystem.bodyPerfection.test.ts`, `BodyPerfectionSection.test.ts`, `tests/e2e/body-perfection-hidden.spec.ts`).
- Exclusions: `SkillPathPanel.test.ts` (pre-existing duplicate-key fix on the same branch, unrelated to the feature — noted out-of-scope); nothing else dirty in the worktree is task-owned-external.

## Scope and Risk Map

Changed systems: new canonical `player.bodyPerfection` slice (discovery write-once + perfected realms); `notifyMaterialGained` funnel consolidation (rename + 3 newly hooked landings); `perfectBodyRealm` transaction in realmAdvanceOps; body-scoped effective-delta channel in `resolvePlayerStatAssembly`; hidden RealmPanel col; save v77 + delegated shape/integrity validators.

One-hop consumers: `resolvePlayerStatAssembly` (sole consumer of the scaled channel), RealmPanel columns, preflight save validation, quest collect progress, all material-granting paths (loot drops, auto-dissolve rewards, decompose delivery, companion refund, essence change credit, building/economy/reward/tick landings).

Escalation decision (mapper said `deepAuditCandidate: true`): NOT escalated — the risk is confidently bounded: (a) save/cloud touch is the established dev-phase additive-slice + version-bump convention (identical shape to v61–v76), with a delegated module-owned validator, no migration-contract change; (b) time/offline touch is a single funnel call inside `deliverDecomposeOutput`, whose replay semantics are guarded by the existing R7 no-double-award invariant (verified green in this tree) and the write-once discovery guard; (c) the "6 domains" spread is a mechanical dep rename across ops files plus two genuine new hook landings, each pinned exactly-once; (d) the persistence-crossing transaction (`perfectBodyRealm`) is atomic-by-construction (all gates + probe before any mutation) and pinned for zero-mutation/idempotency/late-perfection. Unmapped paths are all manually routable: GameManager*Ops = rename sites / funnel subscribers; Player.ts = additive required slice + channel swap; locales = string additions; test files = the task's own coverage.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BP-1 | funnel `notifyMaterialGained` (GameManagerQuestOps) | any live material landing | Exactly-once for quest progress + discovery | repeat, reorder, zero/overflow | spy call-count + `discoveredMaterials` | vitest integration | High (widest wiring surface) |
| INV-BP-2 | `bodyPerfection.discoveredMaterials` (core/realm/body) | first delivery of an authored id | Monotonicity — write-once, survives consumption | repeat, cross-system chain | marker retained after consume | vitest unit | High (canonical-state ruling) |
| INV-BP-3 | `perfectBodyRealm` transaction | commit under gate failure arms | Atomicity — zero mutation on reject | value mutation (shortfall/undiscovered), reorder | bag + slice unchanged | vitest ops | High (ruling: atomic) |
| INV-BP-4 | perfected realm | re-transact same realm | Idempotency | repeat | returns false, no second debit | vitest ops | High |
| INV-BP-5 | Body base-stat channel | resolve stat assembly | Boundedness/isolation — +10pp additive per perfected realm, no leak | value mutation, cross-system | scaled deltas; non-body stats byte-identical | vitest unit+assembly | High |
| INV-BP-6 | persisted slice (save boundary) | restore crafted/legal payloads | Recoverability + integrity (family, subset, realm cap) | value mutation, stale state | rejected vs ok status | vitest save seam | High |
| INV-BP-7 | hidden surface (RealmPanel col) | discovery write → UI | Lifecycle/monotonicity — absent until first discovery, partial reveal only | interruption (reload), stale state | col count, rendered names | jsdom + Playwright | High (ruling: hidden until discovered) |
| INV-BP-8 | restore path | replayed decompose settle | Exactly-once — no re-discovery / double funnel fire on re-restore | interruption, repeat | R7 no-double-award + write-once marker | vitest (structural: no funnel call site in restore) | Medium |
| INV-BP-9 | save version | load v76 / v77 | Recoverability — previous version rejected, current accepted | value mutation | incompatible + foundVersion | vitest save | Medium (r60-f5) |
| INV-BP-10 | realm cap | perfect/discover across realm boundary | Boundedness — future perfect rejected, future discovery legal | value mutation | integrity status | vitest unit+save | Medium (r60-f2) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | pass | clean after fixture-hoisting + comment-ASCII fixes |
| `npm run build` | pass | vite build green |
| `npx vitest run` (full) | 6960 passed / 3 failed — all pre-existing/env | `dongFu*` ×2: `spawnSync magick ENOENT` (ImageMagick absent — env limitation); `SettingsPanel.test.ts` reset-save: fails identically on stashed untouched base (pre-existing) |
| `npx vitest run` 6 new/touched specs | pass (68 tests) | funnel pins, transaction arms, channel math, save round-trip, hidden surface |
| `npx playwright test body-perfection-hidden` (worktree dev server, real port) | 2/2 pass | production RealmPanel shows exactly 2 body cols, `.body-perfection-section` count 0, no title text, zero console errors — fresh boot AND save+reload |
| `GameManager.r7qa.test.ts` (restore-twice no double-award) | pass in full run | bounds INV-BP-8's replay hypothesis |

## Findings

None — no `Confirmed` defect. Two implementation-phase defects were found and repaired before this QA pass (missing `?.`-tolerance in `assertBodyPerfectionIntegrity` for absent-slice legacy payloads — exposed by `GameManager.legacySkillRestore.test.ts` and fixed; second BattleLootSystem grant site unpinned — test added, green). Both are recorded here for the trail; they are not open findings.

Post-report addendum (C2C impl review r76): three Medium + one Low review findings were fixed after this report — zero-delivery now gates before subscriber dispatch (`notifyMaterialGained` head-return + `deliverDecomposeOutput` calls the funnel only when `delivered > 0`; pinned both call counts), `perfectBodyRealm`'s probe is a fail-closed `try/catch` boolean boundary (probe-failure zero-mutation test added), restore exclusion is pinned (bag-held fixture material + empty `discoveredMaterials` restores undiscovered, no funnel/subscriber call), and `bodyPerfectionMaterialIds` now returns `[]` for unknown realms per the spec contract.

## New or Changed QA Tests

- `game/tests/e2e/body-perfection-hidden.spec.ts` — production runtime evidence: structurally absent perfection col on fresh boot and after save+reload (the only runtime state the all-empty production registry can express).
- `GameManagerBodyPerfection.test.ts` — added the auto-dissolve grant-site pin during implementation (the second `notifyMaterialGained` call site), completing plan-5.3 both-sites coverage.

## Gaps and Residual Risk

- Production registry ships all-empty: every positive perfection flow (reveal/partial/perfect) is fixture-injected evidence only — by design (spec S10); real-content behavior will be exercised when the content pass authors material lists. Non-material gap.
- `MaterialBag.remove` return ignored in `perfectBodyRealm` — unreachable past the synchronous `ownedOf >= 1` gate; recorded as a Nit, deferred.
- `magick`-dependent asset tests cannot run in this environment (pre-existing env limitation, unrelated).

## Pre-existing Failures

- `dongFuBuildingPipeline.test.ts`, `dongFuBackgroundAssets.test.ts` — `spawnSync magick ENOENT` (ImageMagick not installed).
- `SettingsPanel.test.ts` reset-save — fails identically on stashed untouched base (confirm-modal selector), pre-existing.
- `SkillPathPanel.test.ts` — duplicate-key type-check failure repaired on the branch before implementation (out-of-scope fix, reported for the record).
