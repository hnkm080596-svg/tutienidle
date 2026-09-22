# QA Review: M-QI-05 canonical Core Node level authority

- Date: 2026-09-23
- Mode: deep (mandatory escalation — `deepAuditCandidate: true`: critical state boundary save-and-cloud, time-and-offline adjacency, cross-system change over 6 domains)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: all 133 reviewable files in the mission diff (`game/src/**` production + `game/src/**/*.test.ts` + `game/tests/**`); mission docs (`game/docs/p7/missions/mqi-05-core-node-level.*.md`) and the deleted `game/src/core/skill/SkillUpgradeBalance.ts` excluded per OCR preview

## Scope and Risk Map

The mission consolidates skill-level authority into `player.nodeLevels[core_<skillId>]`:

- New leaf `SkillCoreLevel` (id convention, level read, frozen Insight curve), generated + authored catalog `SkillCoreNodes` (39 template cores + 14 native cores).
- `NodeSystem` gains core gates (grant-only, cast-channel Insight rejection, no Van Dao waive), `grantSkillCore`, and revoke cascade through `grantsSkillCoreIds`.
- `GameManagerProgressionOps` owns the atomic learn funnel (`preflightLearnableSkill`, `preflightSkillCoreGrant`, `grantSkillCoreBySkillId`, `learnSkill(skillId, player)`) and the Insight channel `levelUpSkill`.
- `SkillSystem` loses all writable level state: provider seam (`skillLevelProvider`) for `getEffectiveSkill`/`progressionOf`/`getScaledPassiveModifiers`; `upgradeSkill`/`getSkillUpgradeInsightCost` deleted; `recordCast` reports `targetLevel` to the GameManager-owned sink.
- Combat snapshot projection (`projectCanonicalSkillLevels`) feeds `CombatEntity.skillLevels`; `TurnSkillDefinition.progressionOwnerId` routes internal actions to their parent core.
- Save boundary v73: `skillLevels` presence rejected; `core_*` entries validated (catalog, integer range, ownership mirror, coverage of learned levelled skills, way `coreSkillIds`, owned-node `grantsSkillCoreIds`); restore re-derives `skill.level` from templates.
- UI: `SkillPathEntry` union renders learned templates and native defs; detail surface reads canonical level; tree excludes cores.
- Way commit (`chooseCultivationPath`) preflights kit skills + passives + starter basic + `coreSkillIds` before `applyPathChoice`.

One-hop consumers inspected: `NodeTreePanel`, `SkillDetailView`, `SkillPathList`, `SkillPathPanel`, `commandWheelCatalog`, `EarlyGameBootstrap`, `EarlyGameSession`, `App.vue` registration, `RealmAdvanceOps` way commit, `GameManagerTurnBattleOps` cast sink, `playerToCombatEntity`, save restore, e2e ritual spec.

Unmapped mapper paths were all manually routed (22 entries — ops classes under `core/game`, path data under `core/{kiem-tu,the-tu,player}`, simulation harness under `core/simulation`, adapter under `core/skilldef`, view-model `SkillPathEntry.ts`, `data/ui/commandWheelCatalog.ts`, lab fixture `tests/lab/realData.ts`). `deepAuditCandidate` confirmed → deep mode run per mandatory escalation.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-1 | `nodeLevels[core]` / NodeSystem | `learnSkill` on already-learned levelled skill | Idempotency: no level reset, no duplicate mirror | Repeat | level preserved at 4, single `purchasedNodeIds` entry | `NodeSystem.cores.test.ts` | High — silent progression loss |
| INV-2 | cast channel / SkillSystem+GameManager sink | `recordCast` x N -> mirror + core write -> offerGate | Cross-system chain: counts mirror, core level, gate read agree | Cross-system chain | `skillCastCounts`, `nodeLevels.core_huy_quyen=3`, `isCultivationPathOffered` true | `GameManager.coreLevelChain.qa.test.ts` QA-1 (new) | High — previously untested end-to-end |
| INV-3 | save boundary / saveShapeValidation | v73 save with core entries, committed way, learned levelled skills | Recoverability: valid state restores; inconsistent state fails closed — forward coverage AND inverse ownership (D9f: every owned core traces to learned template / owned grant node / way.coreSkillIds) | Value mutation, interruption | `validateGameSaveShape` accept/reject incl. orphan `core_cuong_quyen` + orphan learned-template core; restore re-derives `skill.level` | `saveShapeValidation.test.ts`, `SaveSystem.conformance.test.ts`, `SaveRoundTrip.test.ts` | Critical — persistence corruption |
| INV-4 | Insight channel / `levelUpSkill` | upgrade at level 0 / max / cast-channel / unregistered | Boundedness + authority: all invalid transitions rejected, cost `5+3(L-1)` | Value mutation, repeat | `upgradeNode` boolean + insight debit | `NodeSystem.cores.test.ts` | High |
| INV-5 | battle projection / `projectCanonicalSkillLevels` | build with supplied PlayerData vs ambient | Synchronization: snapshot reads the build-source player, not `activePlayer` | Stale state | `entity.skillLevels` reflects supplied player's cores | `GameManager.buildSnapshot.test.ts` (post-fix) | High — fixed during this QA cycle earlier (real defect found and repaired pre-QA) |
| INV-6 | `grantSkillCore` / NodeSystem | repeat grant, grant onto higher level | Idempotency: no reset, no dup mirror | Repeat | level 4 kept, one mirror entry | `NodeSystem.cores.test.ts` | Medium |
| INV-7 | way commit / RealmAdvanceOps | `chooseCultivationPath` with unresolvable core or template | Atomicity: zero mutation on preflight failure | Value mutation | return false, no `cultivationWay`, no realm change | `GameManager.theTuRitual.test.ts`, `cultivationRitualFlow.integration.test.ts`, e2e matrix | Critical — partial commit |
| INV-8 | dev reset / `devResetBranch` | reset branch owning `grantsSkillCoreIds` cores | Conservation: refund spent Insight only (grant free); orphan cascade revokes | Reorder | refund = upgrades spent, cores removed | `NodeSystem.cores.test.ts` | High — Insight fabrication/loss |
| INV-9 | UI / `SkillDetailView`+`SkillPathPanel` | render learned vs native entries, upgrade button | Synchronization: displayed level = canonical; cast-channel shows count->threshold | Stale state | `Lv. n/m`, cast progress, `levelUpSkill` call | `SkillDetailView.test.ts`, `SkillPathPanel.test.ts` | Medium |
| INV-10 | internal actions / `progressionStub` | combo extra / reactive payload level lookup | Authority: `progressionOwnerId ?? id` inherits owner level; authored `levelScaling` consumes it | Cross-system chain | coefficient ratio 1+(L-1)x0.05 on payloads + generated combo; QA-2 end-to-end ratio ~1.45 | `LegacySkillAdapter.test.ts`, `KiemPhoProvider.test.ts`, QA-2 | Medium — closed by external-review round |
| INV-11 | fixed-level learned skills / provider+projection | coreless `maxLevel:1` skill reads | Boundedness: live level = 1, never 0 | Value mutation | `levelOf` fallback, projection `??= 1` | `SkillSystem.level.test.ts`, `buildSnapshot.test.ts` | High — regression caught earlier (0.95x damage bug, fixed pre-QA) |
| INV-12 | save version / saveVersion | v72 payload, `skillLevels` presence | Recoverability: fail closed, no silent migration | Interruption, stale state | `ok:false` + `player.skillLevels` path | `saveShapeValidation.test.ts` | Critical |
| INV-13 | hidden-way gates / CultivationPathKit | `requiresSkillLevel` reads canonical core | Authority: gate reads `getSkillCoreLevel` not retired mirror | Stale state | offered only when core >= required | `CultivationPathKit.test.ts` + e2e seeds (updated) | High |
| INV-14 | talent passives / `syncTalentCombatPassive` | passive learn through canonical funnel | Authority: templates registered, `learnSkill` inserts with clone | Repeat | passive membership + per-battle modifiers clone | `GameManager.talentv4.test.ts`, `talentPassiveRestore.qa.test.ts` | Medium |
| INV-15 | e2e fixture integrity | seeds must mirror canonical writers (nodeLevels+purchasedNodeIds) | Synchronization: seeded save passes v73 and opens gates | Stale state | `.game-root` mounts; offer count +1 | `cultivation-path-ritual.spec.ts` | High — fixture defect found + fixed |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run` (full suite) | 728 files / 6487 passed / 4 expected-fail | ~719s run completed before QA |
| `npm run type-check` | clean | vue-tsc, no errors |
| `npm run build` | pass | 1805 modules, 8.56s; pre-existing >500kB chunk warning unrelated |
| `tests/architecture/asciiComments.test.ts` (P15) | pass | 0 non-ASCII violations outside baseline |
| `ocr delegate preview/rule` + host review | 133/133 reviewed, 1 Medium found+fixed (starter-basic preflight), 2 nits fixed | Coverage accounting recorded in mission evidence |
| `GameManager.coreLevelChain.qa.test.ts` | 2/2 green | QA-1 cast->core->gate chain; QA-2 seeded-battle damage ratio ~1.45 (orb + combo channels both scaled) proves canonical level reaches damage resolution |
| `npx playwright test` (full e2e, 29 specs) | 25 passed / 4 failed — all 4 classified: 2 pre-existing on master, 2 isolated flakes | save-reload, boot-fresh, cultivation-path-ritual (7/7), create-to-combat all green after fixture repair; classification detail below |
| Live ritual matrix (e2e) | all 6 ways commit with canonical technique + grants | `sword_control_art`, `myriad_swords_art`, `five_elements_art`, `dao_insight_art`, `diamond_body_art`, `responsive_body_art` |

## Findings

### QA-2026-09-23-001: e2e ritual fixtures seeded retired save shape + stale assertions

- Severity: Medium (test defect only — no production consequence)
- Status: Confirmed (failing e2e evidence), FIXED within QA allowlist
- Invariant: fixture state must mirror what the canonical writers produce (Synchronization)
- Preconditions: `seedAndReload` patching `player.skillLevels`; `?.equipped` technique assertions; Vietnamese technique ids
- Reproduction: `npx playwright test tests/e2e/cultivation-path-ritual.spec.ts`
- Expected: seeds pass v73 validation; technique holder contract asserts canonical id
- Actual: v73 rejected `skillLevels` seeds (`.game-root` never mounted); `?.equipped` undefined on every way; technique ids were pre-M1 Vietnamese names
- Evidence: 6/7 spec failures; identical `equipped` failure reproduced on `master` (pre-existing since M2, `?.equipped` can never be true — `Technique` has no such field)
- Test file: `game/tests/e2e/cultivation-path-ritual.spec.ts` (repaired in place)
- Owner subsystem: e2e fixtures
- Blast radius: test-only

## New or Changed QA Tests

- `game/src/core/game/GameManager.coreLevelChain.qa.test.ts` — QA-1 exercises the real `recordCast` -> sink -> `nodeLevels[core]` -> `isCultivationPathOffered` chain end-to-end (previously tested only at the two ends); QA-2 runs the same seeded battle at orb Lv1 vs Lv10 and asserts the damage ratio ~1.45, proving canonical levels reach adapter damage resolution on BOTH the orb channel and the generated combo channel (combo extras carry the stamped `levelScaling` + `progressionOwnerId` per spec D11).
- `game/tests/e2e/cultivation-path-ritual.spec.ts` — seeds updated to `nodeLevels`/`purchasedNodeIds` mirrors; technique assertions replaced by the 0-or-1 holder contract with canonical English ids; `SaveShape` updated.
- Post-review additions (external implementation review round 1): `LegacySkillAdapter.test.ts` payload coefficient ratio (Lv6 = 1.25x through the owner-inherited `skill_level`), `KiemPhoProvider.test.ts` combo stamp + adapter ratio, `GameManager.theTuRitual.test.ts` tampered starter/native core atomicity (zero-mutation), `saveShapeValidation.test.ts` inverse-ownership orphans, `SkillCoreNodes.test.ts` `type:'major'` pin.
- Post-review additions (round 2): authored-catalog preflight (`preflightSkillCoreGrant` now requires a matching `SKILL_CORE_NODES` entry + `maxLevel`), stamped `levelScaling` on the three hidden-body reactive payloads + generated Kiem Pho combo damage, adapter payload-ratio oracle.
- Post-review additions (round 3): `saveShapeValidation.ts` inverse-ownership semantics corrected to canonical `nodeLevels[id] >= 1` per spec D9(d) (purchasedNodeIds stays a required mirror, never the source of truth); regressions cover learned-source orphans, grant-node-source orphans, way-source orphans, and mirror-only rejection. `SkillPathPanel.vue` gained an explicit center-mode contract per spec oracle 14 — visible Tree/Detail tabs (localized `panels.skillPath.centerTabs` in en+vi), native selection forces Detail mode, Tree tab restores the node/tree view; mounted tests cover both the sword/native and spell/ordinary-skill flows. The ritual e2e spec's localized assertion was restored to the accented `Ngự Kiếm Đạo` text (MEDIUM-1).
- Post-review additions (round 3 MEDIUM): the D7 presentation seam is now the pinned shape — new `skill-path/NativeCoreDetail.vue` renders owned native cores from the `SkillPathEntry` native view-model (which now projects `upgradeCost`/`canUpgrade`); `SkillDetailView.vue` is back to a `Skill | null` prop with canonical level reads; `SkillPathPanel` discriminates `selectedEntry.kind` in detail mode. New `NativeCoreDetail.test.ts` covers render/disabled/maxed/empty/upgrade dispatch; the mounted panel test asserts the discriminated surface.

## Gaps and Residual Risk

- ~~`progressionOwnerId` inheritance is transport-only~~ CLOSED by external review round 1 (HIGH-1): the three hidden-body reactive payloads and the generated Kiem Pho combo damage now author `levelScaling: 0.05`, so owner inheritance is damage-observable (adapter ratio tests + QA-2 ~1.45 end-to-end). Residual risk is limited to a future internal def mis-declaring an owner — a data-authoring concern for the balance phase, not a live defect.
- Cast sink writes `activePlayer`; a battle built with a different supplied `PlayerData` mirrors casts on the ambient player — identical to master's `skillCastCounts` semantics; noted as pre-existing design, not a regression.
- Mid-battle cast level-ups update live reads (`skillLevelProvider`-based passive scaling) exactly as `skill.level` did on master; the damage snapshot stays frozen per battle — parity preserved.
- Full e2e suite: 25/29 passed. The four failures were rerun in isolation and on `master` for classification — none are mission-caused (see Pre-existing Failures).

## Pre-existing Failures

- `cultivation-path-ritual.spec.ts` `?.equipped` assertions + Vietnamese technique ids: broken since P7-M1/M2 canonical renames on master (verified identical failure on `master`, test 286). Repaired in place as honest fixture maintenance within the QA allowlist.
- `PerfectionEconomy.test.ts` full-suite slowness: contention-related (~5.7s under parallel load, 1.04s isolated); timeout raised inside the file's own convention earlier in the mission.
- Vite >500kB chunk warnings on `npm run build`: pre-existing, out of scope (balance/performance phase).
- `combat-idle-motion-capture.spec.ts` ("player is playing no animation"): fails identically on `master` in isolation — pre-existing, unrelated to this mission's surface (no animation/scene code touched).
- `standing-slot-panel.spec.ts` (formation slot disabled, click timeout): fails identically on `master` in isolation — pre-existing (M9 ring-2 gating surface, not this diff; `commandWheelCatalog` changes here are comment-only).
- `create-to-combat.spec.ts` (result modal within 180s): passed in isolation at 1.9m — contention flake, mission-affected flow itself green.
- `cultivation-path-ritual.spec.ts` hidden-body case (console-error allowlist caught Vite WS reconnect noise): passed in isolation; all ritual assertions green — dev-server flake.
