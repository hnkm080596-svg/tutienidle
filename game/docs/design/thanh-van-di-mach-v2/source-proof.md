# S0 — Source proof: Thanh Vân Dị Mạch V2

Audit date: 2026-10-14. Source baseline **c516dab9cb99403524b5806e84d675443b20b200**; branch `codex/quest-v2-source-proof`; checkout `E:/tutienidle/.agent-worktrees/quest-v2-source-proof`. Initial `git status --short` was empty. This is a source audit and documentation deliverable, not implementation or release approval. The implementation plan's older `e894af77b` snapshot is not this audit's baseline.

## G0 task card and evidence boundary

Responsibility: prove whether each of the 21 proposed quests has real targets, obtainable inputs, authoritative producers and compatible persistence; record missing capability without changing gameplay. Only this document, [economy-simulation.md](economy-simulation.md) and [release-blockers.md](release-blockers.md) are writable outputs. No production, V1 spec, QA policy, UI, dependencies or other worktrees are edited. Local commit of these three files is explicitly authorized; shared-review integration belongs to the coordinator.

Read: root `AGENTS.md`, `AstraDoctrine.md`, roadmap R8.1, architecture-worker-workflow proportional audit rules, QA protocol README/taxonomy/ledger schema/learning policy, IMPLEMENTATION S0 and all three ACT specs. Source references below are relative to `game/` unless prefixed `game/`. Symbols, rather than transient line ranges, bind the evidence to the baseline SHA.

Evidence levels: **SOURCE** = inspected actual implementation/catalog; **MISSING** = proposed quest capability absent from current condition/consumer chain; **BLOCKED CONTENT** = target/input or legal operation unavailable under current release/state; **PROPOSAL** = decision requiring approval or implementation. No source reading is represented as an executed gameplay test.

## Canonical source index

| Ref | Source and inspected symbol / obligation |
| --- | --- |
| Q | `src/core/quest/Quest.ts:QuestCondition`, `QuestProgress.ts`, `QuestManager.ts:restore/markCompletedOnce`, `QuestSystem.ts:reconcileActiveQuests/claim/onEnemyDefeated/onMaterialCollected/onFlag` — only kill, collect and flag; scalar progress; collect debits bag on claim; no allOf/acquire/receipt ledger. |
| O | `src/core/game/GameManagerQuestOps.ts:notifyMaterialGained/claimQuest`; `GameManagerTickOps.ts:reconcileQuestLifecycle` and settlement drain; `services/character/initializeCharacter.ts:initializeCharacter` — real command/lifecycle consumers. |
| P | `src/core/production/ProductionCatalog.ts:THANH_VAN_*`, `ProductionSystem.ts:tick/rollRewards/drainSettlementEvents`, `ProductionCycles.ts:buildProductionCycle`; `ProductionBalance.ts` — forest/mine/grotto, seeded rolls, actual delivered material funnel; settlement event omits cycle identity. |
| B | `src/core/game/BattleLootSystem.ts` defeat hook and `grantResolvedDrops`; `GameManagerBattleRewardOps.ts` victory branch — kill on defeat fact; whole-stage victory writes `player.completedStageIds`; no V2 stage objective or formation-bound durable battle receipt. |
| C | `src/data/stage/Stages.ts`, `data/enemy/{MortalEnemies,FoundationEnemies,Enemies}.ts`, `data/drop/{StageDropTables,FamilyDropTables}.ts` — exact stage/enemy/drop registrations. |
| R | `src/core/game/GameManagerRealmAdvanceOps.ts` initiation/minor/major transition commands; `realm/realmSystem.ts`; `player/Player.ts` — current realm/level and committed path state; no per-realm V2 attainment ledger. |
| T | `src/core/technique/TechniqueSystem.ts:gainMastery/advanceGrade`, `TechniqueProgression.ts:getTechniqueRankCeiling/getTechniqueMasteryForNextRank`, `Technique.ts:gradeHistory` — rank via mastery, grade reset, sealed final-rank history. |
| N | `src/core/progression/NodeSystem.ts:purchaseNode/upgradeNode/getNextLevelCost`; `data/progression/{PhapTuNodes,PhapTuNodes.builders,PhapTuBasicNodes,SkillCoreNodes}.ts` — real fire nodes, authoritative nodeLevels, no V2 node receipt. |
| D | `src/core/game/GameManagerRealmAdvanceOps.ts:investBodyChapter`; `realm/body/{BodyProgressionSystem,BodyRefinementChapter}.ts`; `data/realm/{BodyRefinement,PhysiqueEssence}.ts` — consumes actual chapter currency, zero on complete/gated/empty; finite six-tier body_refinement. |
| E | `src/core/game/EquipmentOpsSystem.ts:equipItem/enhanceSlot`; `equipment/EquipmentSystem.ts:equip/enhance`, `EquipmentOperationCostCatalog.ts`, `EnhanceCurve.ts` — equip operation and slot enhancement; insufficient input rejects, random failure spends attempt cost but does not raise slot level. |
| A | `src/core/game/GameManagerAlchemyOps.ts`, `alchemy/AlchemySystem.ts`, `GameManagerTickOps.ts` successful settle → `QUEST_FLAG_ALCHEMY_CRAFTED`; `data/alchemy/alchemyRecipes.ts`; `production/DecomposeSystem.ts` — craft inputs, real success/failure, wood/herb/ore conversion. |
| U | `src/core/game/GameManagerPillOps.ts:usePillDetailed`, `pill/PillSystem.ts`; `data/pill/PillFamilies.ts` — consume/benefit validation, exact-realm profession pills, cap/retired/material-pill rejection. |
| F | `src/core/companion/{CompanionAvailability,CompanionGifts}.ts`; `data/companion/{Companions,CompanionGiftMoments}.ts`; `GameManagerCompanionOps.ts:claimCompanionGift`; `src/core/game/FormationPlacement.ts`, formation operations in `GameManager` — ownership, authored gift records and formation gates. |
| S | `src/services/save/{saveTypes,saveVersion,saveShapeValidation,SaveSystem}.ts`; `GameManagerSaveRestore.ts` — detached serialized quest slice, replace-on-restore, current version 90, 88→89→90 compatibility only. |
| L | `src/core/betaFeatureFlags.ts`, `betaScope.ts:isBetaQuestEnabled/betaRecipeFamilyOfId`; `realm/ReleasePolicy.ts` — beta flags, recipe admission, no pull pool, ceiling Trúc Cơ. |

## IDs and real faucets

The 21 IDs `tvdm2_main_01` through `tvdm2_main_21` are **proposed**, absent from `src/data/quest/quests.ts`. Existing mainline has 15 rows, including two folded collect IDs; see cutover below. Existing target IDs are valid, but identity validity alone does not certify objectives.

| Target | Source proof and gate |
| --- | --- |
| `mortal_wild_boar`, `mortal_ferocious_wild_boar`; `mortal_dong_10` | C: mortal roster and stage normals/boss. Stage defeat and stage victory are different facts. |
| `bandit`, `ferocious_bandit`; `qi_refining_abyssal_pool` | C: Luyện Khí roster and final stage; realmSystem also uses this exact stage for Trúc Cơ admission. |
| `foundation_spirit_wolf`, `foundation_ferocious_spirit_wolf`; `foundation_floor_10` | C: foundation roster and final stage. No flood-dragon ID substituted for the authored wolf target. |
| `mortal_wood_decade`, `mortal_ore_decade`, `qi_refining_ore_decade`, `foundation_establishment_ore_decade` | P + `data/materials/materials.ts` / `profession/ProfessionMaterial.ts` generated realm/kind/age catalog. Forest and mine produce exact IDs probabilistically; Luyện Khí and Trúc Cơ ore additionally appears in C stage loot. Mortal stage pool grants equipment, not wood/ore. |
| `tu_linh_thao_qi_refining_decade` | Generated pill-herb catalog; P grotto chooses realm → admitted recipe family → age. No generic enemy herb drop route (`data/enemy/Enemies.ts`, stage/family pools). |
| `tu_linh_dan_qi_refining` | Generated from `PILL_FAMILIES`; recipe `alchemy_tu_linh_dan_qi_refining`, beta admitted. Q10's one pill reward stays one; exact-realm consume means it is **not usable in Trúc Cơ** for Q16. |
| Trúc Cơ usable pill | `tu_linh_dan_foundation_establishment` and `alchemy_tu_linh_dan_foundation_establishment` exist, admitted cultivation family; consume requires exact realm and remaining benefit/cap eligibility. No guaranteed starter pill or generic stage pill source proved. |
| Equipment | C stage `equipment_any` plus family equipment pools → B registry template/instance grant → EquipmentBag → E equip. Mortal pool draw chance 0.15; random source exists but has no guaranteed bounded wait. Auto-dissolve/full-bag settings can prevent retained gear. |
| `than_nong`, `khai_minh` gifts | F moments `gift_than_nong_foundation_entry` at realm entry and `gift_khai_minh_foundation_floor_10` at first-clear. These are in-game authored records, not evidence of universal operator delivery. **Both gift issuance and claim are unavailable while companion=false.** |

## 21 quests × all objective leaves

Every row inherits **MISSING allOf/per-leaf persistence** (Q). Event leaves start after activation; state leaves require explicit lifecycle reconciliation, never a render query. `ore`/`herb` in specs are semantic resource labels: actual ProductionSiteKind is `mine`/`grotto`; a typed adapter or spec decision is required.

| Quest ID suffix | Each leaf → producer/owner/source | Gate, failure and outstanding proof |
| --- | --- | --- |
| 01 | acquire wood 3 → P settlement/B delivery → O funnel; kill boar 1 → B → Q | New acquire keeps items, counts delivered only; starter 15 wood must credit zero. Mortal wood production probability/time in economy doc. No persistent delivery dedupe yet. |
| 02 | kill boar 3 → B/Q; mortal level 3 → R | Kill after activation. Current higher realm is sufficient evidence of prior mandatory mortal level 3, but no stored general milestone receipt; reconcile needs an approved inference rule. Failed advancement contributes nothing. |
| 03 | acquire mortal ore 3 → P/O; production ore batch 1 → P | Starter 6 ore not credit. Successful autonomous completion exists; no manual batch-claim command, no batch ID in drain event. Zero-delivery batch semantics need decision. |
| 04 | equipped 1 → E/bag state; kill boar 3 → B/Q | Real loot obtainable before this step; not guaranteed by three kills. Spec mixes committed event with current-equipped fallback: choose state-at-least and claim revalidation or durable event semantics explicitly. Failed equip zero; do not farm remove/re-add. |
| 05 | body commit 1 → D; kill boar 2 → B/Q | Body tier 1 opens mortal level 2; needs tinh_hoa_pham_the. Ops invests available currency up to tier cap, not selectable one-unit clicks. Complete chapter returns zero forever: post-active requirement can softlock. |
| 06 | mortal level 8 → R; fresh body commit 1 → D | Historical level can reconcile by approved mandatory-transition inference. Full body chapter cannot emit new progress; source does not reserve a future invest for this quest. |
| 07 | clear mortal_dong_10 → B completedStageIds; mortal level 12 → R | Durable stage state is available but Q has no stage leaf. Boss kill then loss must remain incomplete. Realm owner, not claim, performs initiation; early initiation must preserve old quest. |
| 08 | qi realm → R; fire path → committed player.spellPath.element; kill bandit 3 → B/Q | L admits spell/fire only. Realm/path snapshot is real; Q needs witness/reconcile leaf. Neither opening element UI nor observing a kill proves path commitment. |
| 09 | acquire qi Tu Linh herb 5 → P/O; herb batch 1 → P | Exact herb obtainable, substantial probabilistic wait. Current production automatically settles; `siteKind:herb` is not runtime enum. Preserve herbs for craft; overflow has no acquisition credit. |
| 10 | alchemy.crafted 1 → A tick success → Q onFlag; kill bandit 2 → B/Q | Existing flag counts active successful jobs, including success whose pills overflow; no craft-ID dedupe ledger. Failed craft consumes legitimate reserved inputs but must not progress. Five quest herbs alone do not fund fuel/essence/stone; reward pill arrives only after this step. |
| 11 | technique rank ≥1 → T; fire node progress 1 → N | QI grade1/rank ceiling min(18,realmLevel); 300 mastery, victory settlement needed. A legal basic node e.g. hoa_diem_uy costs 600 insight; earlier Q08..10 give 1600. Node commit is not necessarily Skill.level mutation: bind leaf to nodeLevels or a named skill-core contract. Saturated old tree needs state fallback. |
| 12 | acquire qi ore 3 → P or C/B/O; enhance success 1 → E | Three decade qi ore convert to zero essence; need 8 for two essence at slot0. Enhancement attaches to **slot**, even empty, not item. Production ops passes player.realmId for the catalog cost; equipped template is only a fallback for absent catalog rows. Failed RNG spends normal cost; emits no success progress. All slots at cap need fallback. |
| 13 | body commit minRealm qi 1 → D; kill bandit 5 → B/Q | Higher realm removes mortal level gate but does not reset body_refinement. Qi drops bao essence; chapter still spends pham essence with cross-grade fill retired. Must return to mortal farm if pham stock absent; complete chapter hard-blocks event leaf. |
| 14 | qi level12 → R; clear qi_refining_abyssal_pool → B | Stage state persists. Current foundation realm implies mandatory qi12+stage only through valid realm-transition invariant; do not invent generic history. Boss death/retreat/loss not stage credit. |
| 15 | foundation realm → R; acquire foundation ore3 → P/C/B/O; ore batch1 → P | Requires real foundation admission, not Q14 claim alone. Correct realm/age delivery; site snapshot carries collection realm; old qi cycle may finish at foundation and pay qi inputs. |
| 16 | kill foundation wolf5 → B/Q; pill_used1 → U | Pill consumption exists; V2 receipt missing. Q10 qi pill fails wrong_realm at foundation. Need foundation craft inputs and benefit room; capped/retired/material pill rejects. Throw path may consume pill fail-closed; cannot issue success just because bag decreased. |
| 17 | owned companion → F player.companions; assigned member → formation ops/loadout | **BLOCKED CONTENT** L companion=false, formation=false. Entry gift source exists but disabled; restore does not prove backfill entitlement for accounts already at foundation. First-clear gift is downstream of Q21 and cannot be the only solution. |
| 18 | enhance success at foundation → E; current member ≥1 → F | Formation off blocks leaf. Define operation realm vs item realm; success on an empty slot is allowed by owner but spec says item. Member removal before claim must invalidate current-state leaf. |
| 19 | two new body commits → D; rank≥1 → T | Finite chapter: cannot require two new investments from full/one-invest-away saves. Rank resets on grade-up; gradeHistory holds sealed final rank but not every historic highest rank after downgrade/respec. Choose current rank or qualified durable milestone. |
| 20 | kill wolf6 → B/Q; victory with formation2 → battle terminal + battle-start party | Formation unavailable; missing persisted battle identity and qualifying start snapshot tied to terminal receipt. Two kills in a lost battle can count kill leaf only. Offline aggregate loot cannot be declared two victories without resolved IDs. |
| 21 | member≥1 → F; clear foundation_floor_10 → B | Formation off. Current member at claim vs stage-win snapshot is unresolved in ACT III. Existing completedStageIds has no saved formation provenance. Early clear cannot prove historical companion presence. Meta achievement ach_story_thanh_van_sealed is proposed separate ledger, not another quest grant. |

## G1 answers and actual consumer/state lifecycle

| Questions | Source-backed answer |
| --- | --- |
| Q1/Q8 | 21 allOf definitions and distinct event/state/current-state semantics remain proposed; matrix accounts for all 44 leaves (Q08/Q15 have three, all other rows two). Failure must preserve progress/reward while respecting domain attempt costs. |
| Q2/Q3 | Q owns quest progress/claim; each gameplay owner above owns outcome. QuestManager active/completedOnceIds/questFlags/reset stamp → S detached snapshot → replace restore. Player owns stage/path/formation/companion/body state; technique manager owns live grade/rank/history. No second mutable UI history authorized. |
| Q4/Q9 | initializeCharacter → tickOps lifecycle; tick/loot → questOps material and QuestSystem kill/flag; questOps claim → QuestSystem/reward/bags → reconcile. Restore invokes reconcile after player finalization. Queries remain observational under R8.1. |
| Q5/Q6/Q7 | Reuse catalogs, delivered funnel, completedStageIds, gradeHistory and domain return values; contracts below gameplay/presentation. Clock sets deadlines, owners settle outcomes, UI renders and commands. Production notification drain is not a durable receipt ledger. |
| Q10 | Existing one-time claims and detached replace restore do not dedupe every proposed producer across restart/offline/replay. Need event identity from source and consumer-specific persisted dedupe. Full/capped old state is a valid adversarial input. |
| Q11 | All 15 existing mainline rows remain live at baseline; collect retains turn-in semantics. V2 cannot simply be appended for the same character without preventing dual reward schedules. |
| Q12 | Scope is three Markdown files; production G2–G4 gates N/A for S0, recorded as future obligations. No aggregate QA_FIXED_POINT_REACHED claim. Coordinator must re-audit any producer changed after this SHA. |

## V1 save cutover decision package

**SOURCE:** S current save version 90; migrateSaveToCurrentVersion accepts 88 via stone flatten, 89 via re-stamp, and 90; other versions return null. Quest slice is optional and missing defaults to empty. QuestManager.restore preserves unknown string completion IDs and copies scalar progress, but that is not a V2 migration. No content-version/cohort identity exists for these quests. Mainline folded IDs must not be guessed as main_09/main_11.

| V1 order | Exact saved quest ID | Narrative overlap with V2; not an automatic completion map |
| --- | --- | --- |
| 1 | main_01_da_san_dau_tien | Q01/Q02 kills |
| 2 | main_02_lam_chi_san | Q01 wood, but V1 turned in material |
| 3 | main_03_ho_khieu_lam_trung | Q02/Q04 boar kills |
| 4 | main_04_quang_chi_nguyen | Q03 ore, without batch witness |
| 5 | main_05_thuy_lang_dam | Q04/Q05 kills |
| 6 | main_06_vuong_gia_da_de | Q07 boss kills, **not** stage victory |
| 7 | main_07_ngu_hanh_nhap_mon | Q08 realm + kills, no explicit element leaf |
| 8 | main_08_viem_ho_coc | Q10/Q13 kills |
| 9 | collect_tu_linh_thao_1 | Q09 herb turn-in, no production witness |
| 10 | main_10_dan_lo_so_khai | Q10 craft and pill reward |
| 11 | collect_qi_refining_ore_decade_1 | Q12 ore turn-in, no enhance proof |
| 12 | main_12_trun_don_khoang | Q13 kills |
| 13 | main_13_giao_xa_uyen_dam | Q14 boss kills, **not** stage victory |
| 14 | main_14_do_kiep_truc_co | Q15/Q16 foundation admission/kills |
| 15 | main_15_giao_sung_chung_cuc | Q21 boss kills, **not** formation/clear proof |

**Recommended PROPOSAL for approval:** character-scoped cohort pin. Characters initialized under V2 receive contentVersion=2 and only V2 mainline; every pre-cutover save/character with V1 ownership (including missing quest slice) pins contentVersion=1 and keeps the exact V1 catalog, partial progress, completed IDs and turn-in costs. Do not pay V2-equivalent rewards to V1 cohort. Missing slice must not be mistaken for newly created account: creation provenance/cutover marker is required. Retain V1 definitions/sidequests; daily remains off. This preserves old rewards without fabricating a semantic 15→21 conversion, but deliberately excludes old characters from V2 story/meta achievement unless a separate approved non-paying replay migration is built.

Alternative, higher-risk PROPOSAL: explicit snapshot migration with version marker, per-reward entitlement ledger and approved mapping of historical claims; preserve actual attained state only, do not backfill kills/acquisitions/craft/formation history without witnesses. Narrative overlap table above cannot decide economic equivalence because amounts/objectives differ. No arbitrary subtraction of old paid currency from current wallet and no reward regrant during reconciliation. This option needs product approval and migration fixtures before release.

Required fixtures for either policy: fresh V2, V1 head/partial collect/claimable/unclaimed/completed, folded IDs 9/11, missing quest slice, unknown IDs, versions 88/89/90 and incompatible older version, realm ahead of chain, full body/tree/slots, claim then save/reopen, restore twice, changed payload same player identity, local+cloud paths, full bag and duplicate producer replay. Migration writes once and does not itself grant rewards. No cutover is implemented or approved by S0.

## G5 documentation handoff

Source findings and future producer checks are in the two companion documents. Reviewed scope: 21 rows / 44 objective leaves, target catalogs, reward scaling, required recipe/conversion paths, actual release gates and V1 save boundary. Source audit is complete at the stated snapshot; **V2 release remains BLOCKED CONTENT / QA_UNVERIFIED**. No production tests, build, Playwright or isolated aggregate clean rounds ran; source-only evidence does not satisfy those gates. Proportional docs checks are recorded in release-blockers; aggregate QA, learning capture/promotion and shared-review integration remain coordinator responsibilities outside these three authorized files.
