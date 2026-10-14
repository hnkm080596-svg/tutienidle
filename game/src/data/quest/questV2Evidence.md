# S4 MAINLINE CONTENT — worker result

Date: 2026-10-14. Worktree: `E:/tutienidle/.agent-worktrees/quest-v2-content`.
Branch: `codex/quest-v2-content`. App root: this worktree's `game/`.
Base: `c516dab9cb99403524b5806e84d675443b20b200` (clean initial status).
Local commit is explicitly authorized for coordinator handoff; its exact SHA is in the final worker reply / `git rev-parse HEAD`. No push, master integration, deletion, or cleanup is authorized or performed.

**Result: authored content and bounded worker checks delivered; aggregate QA_UNVERIFIED; release remains gated.**
This report is worker evidence for the coordinator's aggregate ledger, not a terminal QA verdict or merge/release approval.

## G0 — task card

One responsibility: author V2-01..21 from the three Act documents with 2–3 typed objectives, base rewards, admission/claim-predecessor gates, narrative, and real catalog target proof. Before: V1 catalog and engine only. After: an additional unregistered authored-intent catalog, with V1 bytes preserved.

Write boundary is **new `game/src/data/quest/questV2*` only**:

| File | Responsibility |
| --- | --- |
| `questV2Types.ts` | Strict authoring-only discriminated union, tuple arity, stable IDs, evidence intent and release gates |
| `questV2Mainline.ts` | 21 definitions / 44 leaves; base reward amounts; story and suggested CTA copy |
| `questV2Mainline.test.ts` | 27 content/catalog tests; no mock engine or invented completion evaluator |
| `questV2QaTask.json` | Bounded handoff task input for canonical lesson routing |
| `questV2QaBrief.json` | Actual `qa:internal prepare` draft output; not declared ready |
| `questV2Evidence.md` | G0–G5 evidence, source proof, incidents and aggregate gaps |

Non-goals: engine/registry/save/UI edits; producer hooks; achievement rewards; runtime activation; migration; dependencies; faucet changes; realm advancement. Vietnamese here is content data, not added UI implementation.

Maintained contract: roadmap R8.1 (activation through lifecycle reconciliation; queries observational). Current source confirms `QuestSystem.reconcileActiveQuests`, `getActiveQuests`, `QuestCondition = collect | kill | flag`, and `App.vue → catalogOps.registerQuests(QUESTS)`. S4 changes none of those paths. The new authoring types must not be imported by foundation/core as a substitute for S1's domain contracts. A future adapter must explicitly validate supported semantics and release acceptance; no cast or kill/flag downgrade is permitted.

Stop condition: all 21 authored definitions have verified targets and coherent gates; any required producer/faucet/cutover ambiguity stays blocked rather than acquiring a fabricated implementation.

## G1 — questions and applicable domain checks

| Question | Decision and evidence |
| --- | --- |
| Q1 | PASS for authored content: exact ordered 21 IDs, 44 leaves, predecessor claims, individual base amounts and Act totals asserted in `questV2Mainline.test.ts`; lifecycle/claim execution remains outside S4 |
| Q2 | PASS boundary: `QuestSystem`/`QuestManager` own progress/claim; `RewardSystem` owns grants; new files contain no command or state mutation |
| Q3 | N/A new mutable gameplay state: readonly declarations only; existing quest save/reset ownership unchanged; V2 persistence is a release gap |
| Q4 | SOURCE_PROOF dormancy: `App.vue:95,488` imports/registers V1 `QUESTS`; `GameManagerCatalogOps.registerQuests` consumes `Quest[]`; no V2 reference elsewhere in `src` |
| Q5 | Reuse real catalogs in tests; no new runtime primitive or receipt producer. Authoring union records required intent, not a runtime capability claim |
| Q6 | PASS dependency direction: `questV2Mainline.ts` has one type-only import from `questV2Types`; the latter imports nothing; test imports are test-only |
| Q7 | N/A timing/presentation mutation: no clock, Vue, Phaser, ACK, gameplay event emission or realm transition introduced |
| Q8 | PASS boundary: zero migrated runtime consumers; all unsupported semantics gated. Existing V1 collect turn-in behavior is unchanged |
| Q9 | PASS boundary: catalog declarations make no lifecycle/query calls; R8.1 source and existing lifecycle tests retained |
| Q10 | Intent explicit: fresh events require distinct committed receipts after activation; stage/realm milestones reconcile by lifecycle; existing gear/assignment exceptions explicit. Dedupe/atomicity/restore proof is S1–S3/coordinator work, not claimed here |
| Q11 | V1 remains live through its original registration path; additive IDs have zero overlap with V1. Both catalogs must never pay equivalent rewards without accepted cutover/migration |
| Q12 | PASS bounded scope: all additions match `questV2*`, no tracked baseline changes; P3/OCR/P4/P5 receipts below; aggregate readiness/independence/full verification are explicitly missing |

Applicable E/L/C checks: E2 `acquire` uses delivered quantity and never consumes at claim; E7 reward totals checked against Act tables (balance-check). L1–L4 have unchanged runtime paths; their V2 execution remains release-gated. C6 content uses authored intent rather than ID branches or unsupported runtime hooks. No combat engine, save, time, UI or runtime entry point changed, so their execution modules and P13/P14 are N/A for this dormant slice. They become mandatory at producer/cutover integration.

E1/E3/E4/E5: N/A transactional failure, paid/random generation, live preview/commit and online/offline allocation changes; S4 performs none. E6: real generated production catalog exports are used by membership/roster tests. L1/L2/L3/L4: no new live producer, registration or consequential command; original V1 lifecycle tests pass, while V2 panel-independent advancement, registration and retry/reset execution remain unverified until integration. C1–C5/C7: N/A hit/vitals/stat/buff/skill execution, required combat context and ACK changes; only stage/enemy identifiers and whole-win intent are authored. Save/UI modules: N/A code changes in those domains; runtime obligations remain recorded as release gaps.

## Catalog ID proof and producer census

The tests import the **actual exports**, including generated catalogs, rather than scraping names from documentation.

| Reference | Real source / additional proof |
| --- | --- |
| `mortal_wild_boar`, `bandit`, `foundation_spirit_wolf` | `data/enemy/Enemies.ts:ENEMIES`; each also present in a real `STAGES.enemyPool` |
| `mortal_wood_decade`, `mortal_ore_decade`, `qi_refining_ore_decade`, `foundation_establishment_ore_decade`, `tu_linh_thao_qi_refining_decade` | `data/materials/materials.ts:materials` |
| `tu_linh_dan_qi_refining` | `data/pill/pills.ts:pills`; Q10 is the sole one-pill reward |
| `mortal_dong_10` | `data/stage/Stages.ts:STAGES`; boss exactly `mortal_ferocious_wild_boar`, also in ENEMIES |
| `qi_refining_abyssal_pool` | STAGES; boss exactly `ferocious_bandit`, also in ENEMIES |
| `foundation_floor_10` | STAGES; boss exactly `foundation_ferocious_spirit_wolf`, also in ENEMIES |
| `mortal`, `qi_refining`, `foundation_establishment` | `data/realms/realm.ts:REALMS` |
| `alchemy.crafted` | `core/quest/Quest.ts:QUEST_FLAG_IDS`; existing flag does not by itself prove durable craft receipt support |

Catalog existence is **not** faucet, affordability, player entitlement, durable producer, or runtime reachability proof.

| Quest | Objectives / intended authoritative producer |
| --- | --- |
| 01 | delivered wood 3 (material landing); boar kills 1 (enemy defeat) |
| 02 | boar kills 3; mortal level 3 (realm durable attainment) |
| 03 | delivered mortal ore 3; ore batch claimed 1 (production commit) |
| 04 | equipped item 1 with unique mutation / existing equipped state (equipment); boar kills 3 |
| 05 | body commit 1 (Body owner); boar kills 2 |
| 06 | mortal level 8; new body commit 1 |
| 07 | whole `mortal_dong_10` win (stage settlement); mortal level 12 |
| 08 | qi attained (realm); fire attained (path owner); bandit kills 3 |
| 09 | delivered qi herb 5; herb batch 1 |
| 10 | successful `alchemy.crafted` 1 (alchemy commit); bandit kills 2 |
| 11 | technique rank 1 (technique owner, decision gate); fire node progress 1 (node owner, reconcile decision gate) |
| 12 | delivered qi ore 3; successful equipment enhancement 1 |
| 13 | body commit 1 at minimum qi; bandit kills 5 |
| 14 | qi level 12; whole `qi_refining_abyssal_pool` win |
| 15 | foundation attained; delivered foundation ore 3; ore batch 1 |
| 16 | wolf kills 5; pill consumption **and benefit** committed 1 (Pill owner) |
| 17 | account-owned companion (companion owner); assignment commit 1 or currently assigned state at reconcile (formation owner) |
| 18 | equipment enhancement 1 at minimum foundation; current companion formation count >=1, revalidated at claim |
| 19 | two distinct new body commits; technique rank 1 (decision gate) |
| 20 | wolf kills 6; two whole-battle victories with valid companion formation captured at battle start |
| 21 | companion formation (claim-state versus stage-win snapshot decision gate); whole `foundation_floor_10` win |

No producer is implemented or advertised as available by this table. All definitions carry `objective_engine_and_durable_producers`, `v1_v2_cutover_no_duplicate_rewards`, `realm_admission_preserves_old_quests`, and `economy_playthrough` gates. Quest-specific faucet, skill/rank, companion and formation gates are also carried in data. The head has no predecessor ID; `predecessor:'claimed'` applies when `unlocksAfterQuestId` is present. Minimum realm attainment never requires equality with an old realm.

## G2/G3 — construction and repair evidence

Initial RED: `npx vitest run src/data/quest/questV2Mainline.test.ts --configLoader runner` failed the missing authored-catalog assertion (0 modules versus expected 1), before production definitions were created. Later content tests are source-derived characterization oracles, not runtime completion tests.

Found during construction/OCR: Q04 lacked explicit `uniqueMutation`; Q17 was initially labeled as a general historical assignment milestone. Both were repaired to preserve the Act contracts, before the final P3/OCR/P4/P5 sequence. Added gear/assignment pins; the new gear pin was observed RED before repair. Sibling search across all authored evidence kinds retained historical reconciliation only for realm/path/stage milestones, explicitly pending technique semantics; event-only body/kill/acquire/batch/upgrade/pill/battle objectives stay fresh-event based. No production engine repair occurred.

Simplifier decision: retain the explicit 21-row dataset and stable objective IDs for auditability. Do not introduce factories, a second reward resolver, progress simulation, or generic engine abstractions. Formatting applied to new TypeScript only; no `any` type, unsafe cast, new dependency, or non-ASCII source comment.

## Balance check

Sources: all three Act reward tables and the new base-reward dataset; existing `QuestSystem.scaleQuestRewardByRealm` inspected (stone/cultivation scaling, insight unscaled). This is static economy conformance, not gameplay feasibility simulation.

| Act | Base stone / cultivation / insight | Effective stone / cultivation / insight |
| --- | --- | --- |
| I (x1) | 170 / 390 / 0 | 170 / 390 / 0 |
| II (x8) | 270 / 320 / 6,800 | 2,160 / 2,560 / 6,800 |
| III (x50) | 230 / 250 / 37,000 | 11,500 / 12,500 / 37,000 |
| Total | 670 / 960 / 43,800 | **13,830 / 15,450 / 43,800** |

One qi pill at Q10, unscaled. No quest material rewards that self-feed acquisition goals; no realm breakthrough, artifact, gacha token, Kim Dan, Special/Ultimate requirement, or direct achievement grant. Q21 achievement eligibility belongs to the separate achievement ledger. CONCERNS: costs, caps, sources, timings and entitlement still require real S0/S3/S8 economy/playthrough proof.

## G4 — verification and P18

Final code/test fingerprints (SHA-256):

```text
questV2Mainline.ts      e4a8b1caca9a28863d33d4ee05aee79a3039211acba13f7c3f509bd15b2a560f
questV2Types.ts         0483ff147a4940ce537d982bf88dd0d6c2dcd7a61d51b6e7499adebb72c6df6b
questV2Mainline.test.ts bcd3690578a76119d0ee8db7de42dabe85092943092cb7427ec1404cf624435d
```

All P3 commands run from this worktree's `game/`:

| Evidence | Observed result |
| --- | --- |
| `npm run type-check` (final code/test state) | exit 0 |
| `npx vitest run src/data/quest src/core/quest --configLoader runner` | exit 0; **6 files / 73 tests**, including **27 new catalog tests**, V1 catalog/roster, manager, system and R8.1 lifecycle |
| Spec comparison executed in worktree | 21 exact names/descriptions/opening/ending matches; 44 unique objective IDs; all release gates present; no collect fallback |
| `ocr --version` | installed v1.12.13; no install/update/provider call |
| `ocr delegate preview -f json` + `ocr delegate rule <all selected paths>` | latest code/test + JSON task/brief reviewed; 5/5 reviewed, 0 skipped, 100% coverage; 0 unresolved Medium+ |
| `qa:internal prepare` using `questV2QaTask.json` | exit 0; actual draft in `questV2QaBrief.json`; 7 routed lessons NOT_APPLICABLE |
| `qa:internal preflight` on that draft | exit 1 / **BLOCKED**: missing aggregate planningBaseline and unresolved producer/cutover assumptions |

Preflight was captured at handoff, after source G0/G1 and construction. It is not retrospective prevention readiness. No aggregate ledger, schedule, clean-round review or learning-policy promotion was created: those paths exceed the user's `questV2*` write boundary. The coordinator must resolve C9 and create/admit its own aggregate run before integration acceptance. No independent reviewer was dispatched without the mandatory shared-ledger reservation.

Final handoff OCR preview: total files 6; reviewable files 5, all reviewed; skipped reviewable files 0; coverage 100%. The sixth file, this Markdown report, is explicitly excluded by OCR as `unsupported_ext` and is additionally checked manually for claim/evidence/scope consistency. Latest TypeScript bytes are the final P3/P4/P5 bytes above; JSON artifacts parse successfully. Final handoff OCR reasoning found zero unresolved confirmed Medium-or-higher findings. This evidence receipt does not change gameplay/content/test bytes or claim aggregate approval.

P13/P14: N/A for unregistered data-only changes; no browser, visual, runtime progress or 21-quest completion claim. Full `npm run verify` is not run for this P3-quick worker slice; required final aggregate full verification remains missing.

## P4 — bounded adversarial QA

Mode: quick. Risk mapper: economy-and-progression, no unmapped paths, `deepAuditCandidate:false`. One-hop runtime consumers inspected but unchanged. No live economy/progression transaction changed; broad release feasibility remains excluded and gated. Report placed here because explicit write scope overrides the usual `docs/qa/` destination.

| Invariant | Attack / observable | Evidence / result |
| --- | --- | --- |
| Additive IDs / chain | duplicate, orphan, wrong predecessor or realm band | ordered exact-ID and per-quest tests; no V1 collision |
| Acquisition semantics | turn-in, starting-item backfill, overflow quantity substitution | structural assertion: delivered/fresh receipt/non-consuming intent; runtime handling not claimed |
| Win versus kill | boss killed then battle lost cannot be represented as stage completion | 3 whole-stage-win targets, no kill fallback; exact stage/boss identities asserted |
| Currency bands | accidental pre-scaling or insight/item multiplication | per-quest base rows and exact Act effective totals; sole one-pill reward |
| Early witnesses | equality realm lock / current-rank or stale formation guessed silently | minimum realm admission; explicit technique/Q21 decision gates; current-state Q18 evidence |
| Accidental release | declaration imported by live registration | `rg` census outside `questV2*` has no hits; App registers V1 QUESTS only |
| Copy/content drift | compare every narrative against source Act | executed exact 21-row comparison passed |

**P4 operation: PASS WITH EVIDENCE for the declared dormant authored-content surface only.** No unresolved confirmed in-scope finding remains. The engine's duplicate/stale/failed/restore/full-bag behavior is not exercised by these tests and remains release-gated; this operation cannot satisfy aggregate QA.

## P5 — sequential resulting-state review

These are coordinator/worker self-reviews, **not independent Clean A/B contexts**. The three code/test hashes above remained unchanged between the following separate reviews.

### Sequential Review Pass 1

Reviewed state: final post-P3/post-OCR authored code and tests, after the equipment/assignment repairs and added producer-target pins. Reviewed all 21 goals, narratives, numeric targets, objective IDs, rewards, chain/admission and oracle quality. Findings: none unresolved (Critical/High/Medium/Low/Nit: 0). Fixes: none. Verification: 73/73 final P3 evidence; additional current-source cardinality/semantics assertions passed. No repeat P3 on unchanged bytes.

### Sequential Review Pass 2

Reviewed state after Pass 1 fixes: **YES** (Pass 1 had no fixes). Fresh authority/dependency/consumer review: App → CatalogOps → V1 QuestRegistry; QuestSystem reconciliation/query and reward resolver; no runtime V2 import, mutation, cache, grant, UI authority or domain dependency on authoring types. Q11/Q19 rank and Q21 formation ambiguity remain explicit release decisions. Findings: none unresolved (all severities: 0). Fixes: none. Verification: unchanged fingerprints; source census and tracked diff empty.

### Sequential Review Pass 3

Reviewed state after Pass 2 fixes: **YES** (Pass 2 had no fixes). Fresh integration attacks: V1 and V2 reward duplication if both admitted, late realm/stage admission, lose-after-boss-death, unentitled companion, invalid/removed formation, missing delivered material, empty/failed pill, grade reset, simultaneous batch/acquire credit. Current authored declarations preserve the required distinction or explicitly block producer/cutover acceptance; no runtime support is inferred. Real catalog/stage/flag seams and unchanged V1 tests inspected. Findings: none unresolved in the authored boundary (all severities: 0). Fixes: none. Verification: same final hashes; 73/73 evidence includes original V1/R8.1 guards. Browser evidence N/A here; producer/cutover integration will require actual headless/runtime attack proof.

No deferred in-scope Low/Nit finding or waiver. No final-pass fix, hence no Pass 4 required for this worker state. These passes do not substitute for the coordinator's aggregate review.

## Incidents / learning intake for coordinator

| Incident | Root class / escape | Resolution / proposed protection |
| --- | --- | --- |
| Initial test-write command used `game/` twice | TOOL / wrong current-directory assumption | No file created; corrected path inside worktree; pin worktree/app root in task card |
| Vitest bundle/cache EPERM in sandbox | TOOL / dependency/temp-cache path restrictions | Retained failures; runner config loader plus approved test execution succeeded; no dependency or config edit |
| Body oracle expected a third mortal body objective | TEST_DEFECT / manual count transcription | First 26-test run: 25 pass, 1 fail. Act I specifies Q05/Q06 only; corrected oracle to two mortal, one qi and two-commit Q19; latest suite green. Proposal: full independent per-leaf spec comparison at content acceptance |
| Q04 uniqueness omitted; Q17 assignment described too broadly | CON-03 / authoring semantics lost during translation | Source contract re-audit, sibling evidence-kind hunt and regression pins; repaired before final pipeline |

No automatic learning qualification/promotion is claimed. Coordinator must ingest these records in its authorized learning ledger and independently qualify any generalized detector; nothing was written outside `questV2*`.

## G5 — coordinator action and remaining gaps

Local handoff contains only the six new paths above. Review the exact local commit's diff against the stated base and retain this worktree. Do not register the new catalog until S1–S3 producers, durable progress/save/claim contracts, all faucet/cost/cap proofs and V1/V2 no-double-reward cutover are accepted. In particular:

- Q11/Q19: choose and test current-grade versus durable rank witness semantics; Q11 starter node eligibility / already-progressed reconciliation.
- Q17/Q18/Q20/Q21: prove companion entitlement for every beta account and actual formation evidence ownership; no quest-created companion or fallback invented.
- Q21: decide claim-time formation versus durable stage-win snapshot and migration; never infer a formation snapshot from `completedStageIds` alone.
- All 21: actual atomic claim, receipt dedupe, stale/failed action rejection, lifecycle admission without panel opening, save/reopen/restore and real playthrough remain unverified.
- Aggregate readiness/C9, shared ledger, learning intake, independent Clean A/B, novel attacks, applicable mutation coverage, exact aggregate full verification and terminal predicate remain coordinator obligations.

**QA_UNVERIFIED for the aggregate; authored S4 content is ready for coordinator review with producer/cutover release gates intact.** The requested local commit is a transport handoff, not a release-ready or fixed-point assertion.
