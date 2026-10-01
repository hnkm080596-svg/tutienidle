# FRONTEND CONTRACT — BETA SCOPE LOCK v2 (15-surface map)

Audience: Codex (frontend implementation) and Minh. This is the single
canonical map from every beta-facing UI surface to the backend read-model /
mutation seam it must consume. **The frontend never rederives a
scope/progression predicate from raw `PlayerData`** — every surface reads its
verdict from the read-models below. If a surface needs a fact not listed here,
that is a contract gap: stop and flag it; do not import domain predicates.

Verdict semantics (single vocabulary, `core/betaScope.ts`):

| state | meaning | UI treatment |
|---|---|---|
| `available` | in scope AND progression met | render normally |
| `progression-locked` | in scope, gate unmet | render with lock treatment + `reason` |
| `scope-hidden` | out of beta scope entirely | do not render; no teaser, no "locked" |

Authorities:
`game/src/core/betaScope.ts` (feature/way/element/roster/recipe/tab allow-lists
+ `betaScopeVerdict`/`betaSurfaceVerdict`/`betaSurfaceVisible`/`isScopeHidden`),
`game/src/core/betaScopeSkillDomain.ts` (combat rail + skill tree + precursor
surfaces), `game/src/core/betaScopeSurface.ts` (navigation/building/panel/realm
ladder/ending/save surfaces), `game/src/core/betaScopeTechniqueDomain.ts`
(technique surface), `game/src/core/betaScopeQuestDomain.ts` (quest surface),
`game/src/core/game/GameManagerAlchemyOps.ts` (alchemy surface).

All read-models hang off the GameManager facade: `gameManager.realmAdvanceOps`,
`progressionOps`, `stageOps`, `alchemyOps`, `questOps`, `buildingOps`,
`equipmentOps`, `turnBattleOps`. Reactive refresh reads `stateVersion` /
`useStateVersion()` like the existing panels do.

---

## 1. Character creation (`components/onboarding/CharacterCreationScreen.vue`)

| | |
|---|---|
| READ MODEL | `characterCreationService.rollTalents(): Promise<TalentDefinition[]>` — the 9-talent roll (`CHARACTER_CREATION_ROLL_SIZE`); every id is already inside `BETA_CREATION_TALENT_IDS` (18 ids, `pham_cot` excluded). `checkNameAvailable(name): Promise<boolean>`. `validateDraft(draft, offeredIds)` → `{ok:true}|{ok:false;code;message}`. |
| MUTATION | `characterCreationService.createCharacter({name, talentIds})` → `CharacterCreationResult` = `{ok:true;characterId;character?}|{ok:false;code;message}`. Draft fields: `name` + `talentIds` ONLY — no skill pick, no way pick, no element pick. |
| VOCABULARY | `CharacterCreationErrorCode` = `invalid_name` `invalid_talents` `invalid_skill` `name_taken` `server_unavailable` `character_exists`. `CHARACTER_CREATION_TALENT_COUNT` = 1 (pick exactly one talent). |
| DO-NOT-DERIVE | Never render way/element/skill choosers. `BETA_MORTAL_STARTER_SKILL_ID` (`linh_bao`) is applied at the boot seam — a `mortalBasicSkillId` draft field is ignored downstream, never offered. The backend creation RPC enforces the same talent allow-list, so the offer list needs no client-side re-filter. |

## 2. Ngũ Hành initiation — Phàm Nhân → Luyện Khí (`components/panels/QuanKhiPanel.vue`)

| | |
|---|---|
| READ MODEL | `listOfferableWays(player)` filtered by `offer.eligible && isBetaWay(offer.wayId)` — beta offer list = `spell_pathway` only. `declaresElementAxis(way)` marks the way needing an element pick; `BETA_PLAYABLE_ELEMENTS` is the 5-element set. The skill-tree read-model (§4) doubles as the pre-commit display: uncommitted spell way → the five root nodes render `purchasable` as element commit picks. |
| MUTATION | `gameManager.realmAdvanceOps.commitFiveElementInitiation(element, player)` → `{ok:true}|{ok:false;reason:FiveElementInitiationFailure}` — one atomic call commits path + way + element + realm + root node; failure is rolled back byte-equivalent. `chooseCultivationPath` refuses `declaresElementAxis` ways — never call it for `spell_pathway`. |
| VOCABULARY | `FiveElementInitiationFailure` (15 codes): `invalid_element` `not_mortal` `already_committed` `realm_level_too_low` `in_combat` `way_unavailable` `way_not_offered` `element_committed` `missing_technique` `technique_occupied` `technique_grade_exceeds` `missing_element_root` `element_root_blocked` `missing_kit_skill` `commit_failed`. Render `reason` verbatim. |
| DO-NOT-DERIVE | Never evaluate initiation eligibility locally — `listOfferableWays` + `isBetaWay` is the whole gate; a way not in the filtered list does not exist. Never pre-validate the element pick; the op is the sole authority and its failure code is the display. |

## 3. Combat action rail (`components/game/combat/hud/TurnCombatSkillBar.vue` + `composables/useTurnCombatManual.ts`)

| | |
|---|---|
| READ MODEL | `progressionOps.betaCombatRolesFor(player)` → `BetaCombatRoleEntry[]` = always `[basic, special, ultimate]` in order; entry = `{role, skillId|null, state, reason?}`. Display names resolve via `turnSkillDisplayMetaOf(skillId)`. `progressionOps.betaCombatSurfacesFor(player)` → `BetaPrecursorSurfaceVerdict[]` for the two suppressed combat surfaces (`sword-dynamic-basic` orb picker, `an-ultimate-emblem`) — both `scope-hidden` for every beta player shape. |
| MUTATION | Manual cast: `gameManager.submitTurnChoice(role)` behind `isAwaitingManualTurnChoice()`; `gameManager.setBattleManualMode(enabled)` mirrors `ui.combatInputMode`. These are turn-battle primitives — the rail read-model is surface state, the live cast loop stays on `buildTurnSkillPresentation`/slotList entries (`TurnSkillPresentationEntry`). |
| VOCABULARY | `BetaCombatRole` = `basic` `special` `ultimate`. `BetaScopeVerdict` for `state`. `reason` = `out-of-beta-scope` `realm-gate` `element-uncommitted` `not-learned` `non-beta-way` `unresolved-way-state`. `TurnSkillPresentationEntry.state` = `ready` `cooldown` `blocked_resource` `empty`. |
| DO-NOT-DERIVE | **Ultimate is permanently `scope-hidden` — no ultimate slot exists in beta. Never render it as an empty or "locked" button; it is absent.** Never render the sword orb picker or the Ấn dao emblem (`betaCombatSurfacesFor` covers both). Never read `player.ultimate`/`getResolvedSkillRoles` to decide rail shape — the model's `skillId`/`state` carry it. The mortal special's `realm-gate` and the committed special's `realm-gate`/`not-learned` reasons are display-ready; do not recheck keystones or `hasSkill`. |

## 4. Skill tree — Đạo Luân (`components/panels/SkillPathPanel.vue` + `skill-path/*`)

| | |
|---|---|
| READ MODEL | `progressionOps.betaSkillTreeFor(player, tree?)` → `BetaSkillTree{element, realmId, way, wayName, wayNodeTreeTag, elementCasting, nodes: BetaSkillTreeNode[]}`. `progressionOps.activeElementTreeFor(player)` → the renderable slice (`state !== 'scope-hidden'`) for the committed branch. Per-node: `state`, `reason`, `prerequisites[]` + `levelGates[]` (each carrying `met` + display targets), `nextLevelCost`, `affordable`, `canUpgrade`, `effectiveMaxLevel`, `level`. |
| MUTATION | `progressionOps.purchaseNode(nodeId, player)` / `upgradeNode(...)` — rejection reasons unchanged; the model re-resolves on the next `stateVersion` bump. |
| VOCABULARY | `BetaSkillTreeNode.state` = `purchased` `purchasable` `available` `progression-locked` `scope-hidden`. `reason` = `initiation-pending` `prerequisites-unmet` `insufficient-insight` `unresolved-way-state` `non-beta-way` `grant-only-node` `foreign-stamp` `other-element-branch`. |
| DO-NOT-DERIVE | Never import a `NodeSystem` predicate (`canPurchaseNode`, `getNodeLevel`, `getEffectiveNodeMaxLevel`, `getNextLevelCost`, `hasPrerequisite`, `nodePathApplies`, `nodeWayApplies`, `isNodeElementActive`, `ownedNodeIds`, `getBlockingNodeLevelGates`) or `getSkillCoreLevel` — the model resolved all of it. **Never reconstruct which element branch is visible from `player.spellPath`/`getActiveElement`/`elementTag` — read `tree.element` / use `activeElementTreeFor`.** Tree identity fields (`element`, `way`, `wayName`, `wayNodeTreeTag`, `elementCasting`) replace `CultivationPathSystem`/`getActiveWayDefinition`/`hasStaticPathCapability` calls. The 4 non-committed element branches arrive `scope-hidden` (not locked); foreign-way nodes `scope-hidden` `non-beta-way`. |

## 5. Technique (`components/panels/skill-path/TechniqueBand.vue` + `TechniqueSlotCard.vue`)

| | |
|---|---|
| READ MODEL | `realmAdvanceOps.getBetaTechniqueSurfaceModel(player)` → `BetaTechniqueSurfaceModel{techniqueId?, state, name?, grade?, rank?, mastery?, icon?, description?, element?, quality?, tier?, masteryForNextRank?, rankCapped?, sections, gradeAdvance{available, disabledReason, targetGrade?, materialId?, materialName?, cost?, owned?}}`. `sections` ships display rows verbatim. `gradeAdvance` quotes the cost even when disabled — a greyed button renders the price line. |
| MUTATION | `realmAdvanceOps.tryAdvanceTechniqueGrade(player)` — the only grade-advance write. |
| VOCABULARY | `state` = `unavailable` `available`. `gradeAdvance.disabledReason` = `no-technique` `grade-ceiling` `realm-gate` `insufficient-material` `busy` `null`. |
| DO-NOT-DERIVE | Never compute grade eligibility, ceilings, or material sufficiency — `canAdvanceTechniqueGrade`, `getTechniqueGradeUpgradeCost`, `getTechniqueGradeCeiling`, `getTechniqueMasteryForNextRank`, `getTechniqueTierForRank`, `getTechniqueEffects`, `TECHNIQUE_RANK_CAP` and the `useTechniqueSections` composable are all banned in shell code. Render `gradeAdvance` as given. |

## 6. Realm / progression (`components/panels/RealmPanel.vue` + `realm/*`)

| | |
|---|---|
| READ MODEL | `betaRealmLadderNodes()` → mortal rung + in-window passive nodes only. `progressionOps.betaNextRealmSurfaceFor(player)` → `{nextRealmId, nextRealmName} | null` — **null at the Trúc Cơ ceiling (Kim Đan is out of beta)**. `betaHiddenRealmRecordFor(player, realmId)` → always `undefined` in beta (hidden record preserved on legacy saves, never surfaced). `realmAdvanceOps.canTriggerBreakthrough(player)` / `getBreakthroughRequirements(player)` for the breakthrough card. Body chapters read via `getBodyChapterProgress`/`isBodyChapterUnlocked` (`body_refinement` `meridian` `zhou_tian`). |
| MUTATION | `realmAdvanceOps.breakthroughWithConsequences(player)` → `BreakthroughOutcomeResult` (`kind` + optional `announcement` with i18n keys/params — `useBreakthrough` resolves it to `worldAnnouncement.show`). `realmAdvanceOps.investBodyChapter(player, chapterId)`. |
| VOCABULARY | `BetaNextRealmSurface` = `{nextRealmId, nextRealmName}`. Breakthrough outcome kinds: success / failure (+ tribulation chain announcements). |
| DO-NOT-DERIVE | **Null `betaNextRealmSurfaceFor` = no next-realm UI at all — there is no Kim Đan breakthrough CTA, no "next: Kim Đan" label, no progress-into-Kim-Đan bar.** Hidden progression rows (Pháp Cốt / Quán Thể / Nghịch) never render — the model returns `undefined`. Never index `REALMS`/`RealmTierMap` past the release window for display. |

## 7. Stage select (`components/panels/StageSelectPanel.vue`)

| | |
|---|---|
| READ MODEL | `gameManager.stageOps.getStageSurfaceModels(player)` → `StageSurfaceModel[]` (30 floors, zone order, exactly one `current` frontier): `{stageId, act?, realmId?, floor?, state, isBossFloor, displayEnemy?, rewardPreview?, autoFarmAvailable, startAvailable, disabledReason}`. `displayEnemy`/`rewardPreview` are roster-filtered — only `BETA_ENEMY_ROSTER` ids can appear. |
| MUTATION | `useBattleActions().startSelectedStage(zoneId, stage, mode)` → `turnBattleOps.startStage(player, stage, repeat)` behind the presentation gate; `turnBattleOps.autoFarmOps.startAutoFarm(player, stageId)` / `stopAutoFarm(player)` gated by `autoFarmAvailable`. |
| VOCABULARY | `state` = `locked` `current` `available` `completed` `perfect`. `disabledReason.kind` = `realm` `floor` `progress` `busy` (`null` when startable). |
| DO-NOT-DERIVE | Never call `catalogOps.isStageUnlocked`/`stageLockReasonCode` for the list — the model carries the verdict + reason. Never recompute boss floors or roster admission. Never render an enemy not in `displayEnemy`. |

## 8. Equipment (`components/panels/EquipmentHallPanel.vue` + `equipment-hall/*`, `EquipmentPaperdoll.vue`)

| | |
|---|---|
| READ MODEL | `isBetaEquipmentTab(tabId)` admits only `enhance` + `dissolve` (`BETA_EQUIPMENT_TABS`). Enhance tab reads `equipmentOps.getAllSlotStates()`, `getEnhanceCost(slot, realmId)`, `getEnhanceSpiritStoneCost(slot, realmId)`, `equipmentBag.getEquippedInSlot(slot)`. Dissolve tab reads `previewDissolveRewards(instanceIds)` + bag/template accessors. |
| MUTATION | `equipmentOps.equipItem(instanceId, player)`, `unequipItem(instanceId)`, `enhanceSlot(slot, player)`, `dissolveItems(instanceIds)` → `{ok, reason?}`. |
| VOCABULARY | `BETA_EQUIPMENT_TABS` = `['enhance','dissolve']`. Scope-hidden ops answer `{ok:false, reason:'scope_hidden'}`. |
| DO-NOT-DERIVE | Never render wash/refine/decompose tabs or buttons — the domain ops return `scope_hidden` and the tab allow-list drops them. `previewWashItem`/`commitWashItem`/`previewRefineItem`/`commitRefineItem`/`decompose` do not exist for beta UI. |

## 9. Alchemy — Đan Phòng (`components/panels/AlchemyView.vue`)

| | |
|---|---|
| READ MODEL | `alchemyOps.getBetaAlchemyRecipeModels(player)` → `BetaAlchemySurfaceModel{roomLevel, maxConcurrentJobs, activeJobs, recipes: BetaAlchemyRecipeModel[]}`. Each recipe row: `{recipeId, pillId, familyId, realmId, realmMatchesPlayer, breakthroughAvailable, variants[](herb/fuel amounts + `owned` + `sufficient`), spiritStoneMaterialId, spiritStoneCost, spiritStoneOwned, specialIngredients[](`sufficient`), craftable, activeJob?}`. Only `BETA_ENABLED_RECIPE_FAMILIES` (5: tu_linh_dan hoi_linh_dan khai_linh_dan thong_mach_dan truc_co_dan) appear. |
| MUTATION | `alchemyOps.startAlchemyJob(...)` — dormant-family ids get `{ok:false, reason:'scope_hidden'}`; `cancelAlchemyJob(...)`; `previewAlchemyOutcome(...)` for the result preview. |
| VOCABULARY | `craftable` (single per-recipe start verdict), `realmMatchesPlayer`, `breakthroughAvailable`, per-variant/per-ingredient `sufficient`. |
| DO-NOT-DERIVE | Never enumerate `getAlchemyRecipes()` or filter families locally — dormant families never appear in `recipes`. Never recompute `craftable` from bag quantities; the model already folded herb/fuel/stone/special sufficiency in. |

## 10. Quest (`components/panels/QuestPanel.vue`)

| | |
|---|---|
| READ MODEL | `questOps.getBetaQuestSurfaceModels()` → `BetaQuestSurfaceModel[]`: `{id, name, description, cadence, progress, target, targetLabel|null, rewards[], claim{available, claimed, disabledReason}, turnIn?{materialId, required, owned}}`. `rewards[]` is already admitted-filtered (`isQuestRewardDropAdmitted` — the same predicate `claim()` enforces). |
| MUTATION | `questOps.canClaimQuest(questId)` + `questOps.claimQuest(questId)` → boolean. |
| VOCABULARY | `cadence` is always `'once'` — **no daily cadence exists in beta** (`isBetaQuestEnabled` returns false for `daily`). `claim.disabledReason` = `incomplete` `missing-turnin-items` `already-claimed` `null`. `turnIn` previews the live material shortfall. |
| DO-NOT-DERIVE | Never render a daily quest surface, streak, or reset timer. Never touch `itemDrops`/`ReleasePolicy`/reward admission — rewards arrive filtered. Never re-evaluate `isBetaQuestEnabled`. |

## 11. Production (`components/panels/ProductionPanel.vue`, gathering outpost)

| | |
|---|---|
| READ MODEL | `buildingOps.getProductionViews(nowMs)` → per-site production views (rate, stored, autoRestart). Outpost card: `getBuildingStoredAmount(instanceId, now)` + `getBuildingCapacity(instanceId)` + `getBuildingRatePerMinute(instanceId)`. `quoteProductionUpgrade(siteId, player)` → upgrade quote `{upgradable, ...}`. `getWorkforceView()` → `WorkforceView` — **automatic workforce only; manual allocation is scope-hidden**. `getWorkerLodgeSurfaceModel(player)` → `{tabs:[{id, verdict, manualAssignOffered?}]}` — every tab (incl. `nhan_cong` via `WORKER_LODGE_TAB_FEATURE` → `manualWorkforce`) resolves `scope-hidden`. |
| MUTATION | `buildingOps.collectBuilding(instanceId, player, now)`, `setProductionAutoRestart(siteId, enabled)`, `upgradeProductionSite(siteId, player)`. `assignWorkers(...)` must never be reachable — the allocation UI exists only behind `betaSurfaceVisible('manualWorkforce')` which is false in beta. |
| VOCABULARY | `WORKER_LODGE_TAB_FEATURE`: `nhan_cong`→`manualWorkforce`, `qua_tang`/`chieu_mo`/`duyen_phan`→`companion` — all `scope-hidden`. |
| DO-NOT-DERIVE | Never render the Chi Hiền Quán (worker lodge) surface or any manual assign/recruit/gift/bond UI — automatic production runs as a background system with no UI. Never deep-link `worker_lodge`. |

## 12. Navigation chrome (`components/game/DongFuCommandWheel.vue`, `stores/ui.ts`, `layout/*`)

| | |
|---|---|
| READ MODEL | `betaWheelSlots()` → the filtered `COMMAND_WHEEL_SLOTS` list — render exactly this. `isBetaBuildingSurface(id)`: live = `teleport_array` `pill_room` `gathering_outpost` `equipment_hall` `vendor`; hidden = `chi_hien_quan`. `isBetaStandalonePanel(id)`: live = `skill` `realm` `quan_khi` `quest`; hidden = `artifact` `tran_phap` `companion`. `isBetaLeftPanelMode(id)`: all live except `worker_lodge`. Per-slot `available()`/`disabledReason()` still apply on top of the scope filter. |
| MUTATION | `ui.openStandalonePanel(id)` / `openLeftPanel(mode)` / `openBuildingPopover(id)` — all fail closed on a scope-hidden id; the store drops the call. |
| VOCABULARY | `BetaScopeVerdict` — the wheel/building/panel ids are scope vocabulary, not presentation data. |
| DO-NOT-DERIVE | Never import `COMMAND_WHEEL_SLOTS` directly or add a wheel slot for `phap_bao`/`formation_slot`/`companion_roster`/`chi_hien_quan`. Never mount `ArtifactPanel`/`TranPhapPanel`/`CompanionPanel`/`WorkerLodgePanel` — `GameRoot`'s `isBetaStandalonePanel` gate is the mount authority; do not create a parallel path. |

## 13. HUD currencies (`components/game/CurrencyHud.vue`)

| | |
|---|---|
| READ MODEL | Spirit-stone chips = `SPIRIT_STONE_MATERIALS` × `materialBag.getAmount(stone.id)` (all tiers render; an empty tier shows 0). Cultivation/realm identity comes from the player store + `getCurrentRealm`. |
| MUTATION | None — the HUD is read-only. |
| VOCABULARY | Material ids from `SPIRIT_STONE_MATERIALS`; labels via `materialLabel(id, materialRegistry)`. |
| DO-NOT-DERIVE | Never render companion pull-token (`COMPANION_PULL_TOKEN_ID`) or `duyenPhan` chips — gated behind `isBetaFeature('companion')`, scope-hidden in beta. Never add artifact/formation currency rows. |

## 14. Notifications & milestone chrome (`stores/notification.ts`, `stores/worldAnnouncement.ts`, `components/game/ThienCoRail.vue`)

| | |
|---|---|
| READ MODEL | `useNotificationStore` — `toasts`/`queuedToasts`, `push(kind, message, loot?)`; App.vue drains `gameManager.drainNotifications()` per tick into it. `useWorldAnnouncementStore.show(title, body, cueId?)` — the one modal banner (breakthrough etc.), auto-close 5s. `useThienCoEntries()` → `ThienCoEntry[]` (max 4; `kind`: `breakthrough` `quest` `ready` `active` `upgradeable`) — already skips scope-hidden buildings via `isBetaBuildingSurface`. |
| MUTATION | `notification.push(...)`, `worldAnnouncement.show(...)`, `worldAnnouncement.hide()`. |
| VOCABULARY | `NotificationKind` = `loot` `craft` `upgrade` `error` `warning` `save`. `ThienCoEntryKind` as above. `TOAST_DURATION_MS` = 3500, `MAX_QUEUED_TOASTS` = 100. |
| DO-NOT-DERIVE | Never synthesize notification entries for scope-hidden systems (companion gift, artifact awaken, hidden-window cues — none may surface). Never push a Kim Đan breakthrough announcement. |

## 15. Beta completion & legacy-save support (`betaScopeSurface.ts` §E)

| | |
|---|---|
| READ MODEL | `progressionOps.betaCompletionFor(player)` → `{act3FinalBossDefeated, betaComplete}` — true when the stage carrying `BETA_FINAL_BOSS_ENEMY_ID` (`foundation_ferocious_flood_dragon_whelp`, act-3 floor-10 boss) is in `completedStageIds`. This is the deliberate ending beat. `progressionOps.betaSupportedFor(player)` → boolean; `unsupportedReleaseReason(player)` → `BetaUnsupportedReason|null`. |
| MUTATION | None — render only. A legacy save is never auto-converted; it loads intact (dormant state preserved) and carries its reason. |
| VOCABULARY | `BetaUnsupportedReason` = `realm_beyond_release` `way_out_of_scope` `hidden_progression_state` `companion_owned` `artifact_owned` `formation_loadout`. |
| DO-NOT-DERIVE | On `betaComplete`: render the Beta-Complete beat — **no Kim Đan continuation CTA, no "content continues" teaser**. On an unsupported save: render the unsupported-state notice keyed by `unsupportedReleaseReason`; never auto-migrate or strip dormant fields. |

---

## Dormant systems — no beta UI may reference them

Companion (all surfaces: pulls, gifts, EXP, roster), Trận Pháp, artifact /
pháp_bảo, hidden content (beasts, lineage, ngộ đạo, Nghịch Chu Thiên,
`hidden_window_opened` cue), manual workforce (whole Worker Lodge surface +
production allocation UI), Kiếm/Thể/hidden ways, equipment wash/refine/
ore-decompose, daily quests, the ultimate combat slot, Kim Đan breakthrough.
These stay implemented + unit-tested behind `BETA_FEATURES` — dormant, not
deleted. The guards in `tests/architecture/` fail if a shell file imports the
dormant availability authorities or mounts their surfaces.

## Precursor growth law (all three mortal precursors)

`tram`, `linh_bao`, `huy_quyen` share: **+1 flat damage per 10 completed casts,
uncapped** (`getPrecursorFlatDamageBonus`); cast levels cap at Lv3
(`CAST_LEVELING_THRESHOLDS` 1000/10000). A cast-count meter reads
`player.skillCastCounts[skillId]` — do not invent a separate counter.
