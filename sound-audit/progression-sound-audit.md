# Sound Coverage Audit — Progression + Cultivation Moments

Branch `devin/1791567361-ornate-dialog-art`, code under `game/src`. Three emit seams: (1) eventBus → `combatAudioBinding.ts`, (2) direct `audio.cue()` calls, (3) `KIND_SOUND` in `ToastContainer.vue:19-33` — any `notifications.push({kind})` ⇒ `ui.toast.<kind>`.

Legend: ✅ = cue emits today · 🟡 = emits but wrong channel · 🔇 = silent · 🎫 = armed-reserved cue exists (`src: ''`, no producer)

## 1. Body cultivation (`GameManagerRealmAdvanceOps.investBodyChapter`, `BodySurface`, `useBodySceneModel`)

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Manual pour/invest — Luyện Thể | `BodySurface.vue:244` → `useBodySceneModel.ts:484` → `RealmAdvanceOps:1139-1174` | 🟡 `ui.toast.upgrade` via 'upgrade' toast (only `body_refinement` pushes) | generic toast chime; pour is a big animated moment deserving its own cue | `body.invest` (new) |
| Manual invest — Bát Mạch / Chu Thiên | same call path; early return at `RealmAdvanceOps:1145-1147` | 🔇 silent | `emitBodyChapterInvested` only fires for `body_refinement` | `body.invest` + toast for other chapters |
| Tier complete (body_refinement N/N) | `RealmAdvanceOps:1151-1159` | 🟡 same `ui.toast.upgrade` toast | milestone buried in generic toast | `body.tier_complete` (new) or `progress.breakthrough`-adjacent stinger |
| Meridian open (Bát Mạch khai mạch) | `RealmAdvanceOps` invest success, no notify branch | 🔇 silent | no notification, no cue | `body.meridian_open` (new) |
| Zhou_tian step + 18/36 milestones (Tiểu/Đại Chu Thiên) | `RealmAdvanceOps` zhou_tian branch | 🔇 silent | same | `body.zhoutian_step`, `body.zhoutian_cycle` (new) |
| Chapter unlock | read-model predicate `isBodyChapterUnlocked`, no event | 🔇 silent | unlock is invisible to audio | `body.chapter_unlock` (new) or toast |
| Realm-locked invest hint | `RealmAdvanceOps:1099-1129` | ✅ `ui.toast.warning` (once per tier) | — | — |
| Auto-invest | none — `App.vue` comment claims `GameManager.update()` owns auto-invest but no such call exists on this branch (stale comment) | n/a | — | — |

## 2. Breakthrough / Tribulation (`useBreakthrough`, `useTribulation`, `NghichChuTian`)

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Minor breakthrough (auto-tick, `App.vue:969`) | `useBreakthrough.ts:44-49` | 🔇 silent — `progress.breakthrough` only plays when `result.announcement` exists (major realm change, `BreakthroughOutcomeService.ts` gates it) | the MOST frequent progression sound in the game plays nothing | `progress.level_up` (new, lighter than breakthrough) or `ui.toast.upgrade` |
| Major realm breakthrough | `useBreakthrough.ts:48` + `worldAnnouncement.show` | ✅ `progress.breakthrough` + `stinger.announce` (default cue param `worldAnnouncement.ts:26-29`) | — | — |
| Tribulation enter | `combatAudioBinding.ts:40` (`tribulation_started`) | ✅ `tribulation.begin` | `presentation_session_started` intentionally silent for tribulation — by design | — |
| Lightning strike / chapter change | binding `:44-45` | ✅ `tribulation.thunder` / `tribulation.chapter` | — | — |
| Mind question answer | binding `:46-48` (`mind_question_result`) | ✅ `tribulation.answer.ok` / `tribulation.answer.fail` | — | — |
| Tribulation outcome | binding `:49-51` | ✅ `tribulation.victory` / `tribulation.fail` | — | — |
| Path choose / initiation commit | `QuanKhiPanel.vue:173,198`, `SkillPathIntroModal.vue:183` | ✅ `progress.path_choose` + `stinger.announce` | — | — |
| `attemptNghichChuTian` | `RealmAdvanceOps:1183` → `hidden/NghichChuTian.ts:173-238` | 🔇 silent (domain returns presentation-neutral result, no toast, no emit). **Also: no UI caller exists on this branch — dead command surface** | when wired: success/failure/insufficient all need sounds | success → `progress.quan_the` 🎫; fail → `tribulation.fail` |

## 3. Discoveries

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Perfect stage clear | `BattleRewardOps.ts:244` → binding `perfect_clear` | ✅ `progress.perfect` | — | — |
| Hidden beast window opened | `BattleLootSystem.ts:489` → binding `hidden_window_opened` | ✅ `progress.hidden_open` (scope-hidden: trial events only via `trialEvents`) | — | — |
| Hidden realm discovered (Quan Thể / Nghich) | `QuanTheDiversion.ts:~119`, `HiddenLineage.ts:172-188` — pure writers, no emit | 🔇 silent | discovering a hidden lineage is a marquee moment with no sound | `progress.quan_the` 🎫 (manifest comment says exactly this: "no producer passes this cue id today") |
| `completeHiddenBody` | `HiddenLineage.ts:197-227` | 🔇 silent | body- completion silent | `progress.quan_the` 🎫 or `progress.breakthrough` |
| Recipe discovery | n/a — recipes are static realm-gated catalog data, no discovery mechanic exists | n/a | — | — |

## 4. Quests (`GameManagerQuestOps`)

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Quest turn-in/claim | `QuestOps.ts:227-274` | ✅ 'loot' toast "Hoàn thành" ⇒ `ui.toast.loot`; reward material toasts also loot | generic loot sound, not quest-specific | `quest.complete` (new) |
| Quest accept | `reconcileActiveQuests` auto-admits on tick (`QuestOps.ts:266`) | 🔇 silent — no accept UX moment exists by design | — | `quest.accept` (new) if accept UX added |
| Quest becomes claimable | completion flag set in tick reconcile | 🔇 silent | "quest ready" moment missing | `ui.toast.loot` or dedicated notify |
| Daily quest reset | `GameManagerTickOps.ts:141` | ✅ 'craft' toast (scope-hidden) | — | — |

## 5. Equipment actions (`useEquipmentActions`, `EquipmentOpsSystem`, equipment-hall tabs)

All player-initiated ops route through `useEquipmentActions.ts` → `actionFeedback` store (Nhật ký thao tác). **`actionFeedback` has zero audio wiring** — this one gap silences the whole family.

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Equip/unequip | `EquipmentPaperdoll.vue:242` | ✅ `ui.equip` | — | — |
| Enhance success | `EnhanceTab.vue` → `useEquipmentActions.enhance` | 🔇 silent (feedback log only) | signature game feel moment | `equipment.enhance.ok` (new) |
| Enhance fail (has `enhanceFailStreak` state) | same | 🔇 silent | fail needs a distinct thud | `equipment.enhance.fail` (new) |
| Wash preview / commit (Đoán Tâm) | `WashTab.vue` + `washPreview/washCommit` | 🔇 silent | — | `equipment.wash` (new) |
| Refine preview / commit (Tinh Luyện) | `RefineTab.vue` + `refinePreview/refineCommit` | 🔇 silent | — | `equipment.refine` (new) |
| Dissolve (Hóa Luyện) | `DissolveTab.vue` + `dissolve`; material credit toasts only via quest hook | 🔇 silent | — | `equipment.dissolve` (new) |
| Auto-dissolve on overflow | `EquipmentOpsSystem.ts:138-141` | ✅ 'loot' toast | — | — |
| Bag overflow | `EquipmentOpsSystem.ts:131` | ✅ 'warning' toast | — | — |

Cheapest fix: wire `actionFeedback` store → `ui.toast.*` (it's already a success/warning/error channel). Then enhance/dissolve sound for free; dedicated `equipment.*` cues optional on top.

## 6. Alchemy / pills (`AlchemySurface`, `GameManagerTickOps`, `PillBagSection`)

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Job start | `AlchemySurface.vue:387` | ✅ `craft.start` | — | — |
| Start rejected | `AlchemySurface.vue:381` | ✅ `ui.error` | — | — |
| Job cancel | `AlchemySurface.vue:394` | ✅ `ui.cancel` | — | — |
| Job settle success | `TickOps.ts:238-242` | ✅ 'craft' toast ⇒ `ui.toast.craft` | — | — |
| Job settle **failure** | `TickOps.ts:250-253` | 🟡 pushes **'craft' kind** ⇒ `ui.toast.craft` — failure chimes like success | wrong channel | kind `'error'` ⇒ `ui.toast.error`, or `craft.fail` (new) |
| Pill consume success | `PillBagSection.vue:227` | ✅ 'loot' toast | — | `pill.use` (new, optional) |
| Pill consume rejected | `PillBagSection.vue:249` | ✅ 'warning' toast | — | — |
| Pill arm (Sẵn) | `PillBagSection.vue:268+` | 🔇 silent | arm/disarm toggle has no click | `ui.click` |
| Worker decompose delivery | `TickOps.ts` → `deliverDecomposeOutput` | ✅ 'craft' toast | — | — |

## 7. Vendor / economy

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Sell confirm | `VendorPanel.vue:134` | ✅ `ui.purchase` + 'loot' toast | — | — |
| Sell rejected (insufficient/blocked) | `VendorPanel.vue:110-115` | ✅ 'warning' toast | — | — |
| Buy | n/a — sell-only vendor on this branch | — | — | — |

## 8. Skills / nodes / attributes (`useProgressionActions`, `SkillPathPanel`, `SkillSurface`)

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Skill level-up | `GameManager.ts:288-299` (called `:536,:629`) | ✅ 'upgrade' toast ⇒ `ui.toast.upgrade` | — | — |
| Node purchase / upgrade | `useProgressionActions.ts` `purchaseNode`/`upgradeNode` | 🔇 silent | 🎫 `progress.node_unlock` armed-reserved, no producer | wire `progress.node_unlock` |
| Respec (`devResetBranch`/`respecNodeTree`) | `useProgressionActions.ts` | 🔇 silent | 🎫 `progress.reroll` reserved for "token spend preview"; respec fits reroll semantics | `progress.reroll` |
| Specialization select | `useProgressionActions.ts` `selectSkillSpecialization` | 🔇 silent | — | `progress.node_unlock` or `progress.path_choose` |
| Attribute point allocate | `useProgressionActions.ts` `allocateAttributePoint` | 🔇 silent | — | `ui.click` or `progress.node_unlock` |
| Talent pick | `TalentEntitlementModal.vue:97` | ✅ `progress.talent_pick` | — | — |
| Technique mastery settle | `BattleLootSystem.ts:200-222` | 🟡 'insight' `reward_particle` ⇒ `combat.loot` | no mastery-specific/rank-up cue | `progress.node_unlock`-adjacent (new `mastery.rank` optional) |

## 9. Notifications / toasts

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Toast becomes visible | `ToastContainer.vue:19-33` `KIND_SOUND` | ✅ loot/craft/upgrade/save/warning/error ⇒ `ui.toast.*` | fires only when toast becomes visible; silent if never rendered — fine | — |
| `actionFeedback` op log (Nhật ký thao tác) | `stores/actionFeedback.ts` | 🔇 no audio at all | whole equipment panel silent because of this | map success/errorKey/warningKey → `ui.toast.*` |
| `pushLootNotification` | `BattleLootSystem.ts:777` | ✅ 'loot' toast | — | — |
| World announcement | `worldAnnouncement.ts:26-29` | ✅ `stinger.announce` default, overridable | — | — |
| Save | save toast | ✅ `ui.toast.save` | — | — |
| Offline gains | offline summary | ✅ `stinger.offline` | — | — |

## 10. Workers / production / farm / companions

| Moment | Location | State | Gap | Suggested cue |
|---|---|---|---|---|
| Worker/production settle | `TickOps.ts:192-197` | ✅ 'loot' toast per material gained | — | — |
| Building manual collect (Linh Tuyền claim) | `GameManagerBuildingOps.ts:247-286` | 🔇 silent unless overflow — success path pushes NO toast, only `notifyMaterialGained` (quest hook) | click-the-spring-to-harvest has no payoff sound | 'loot' toast ⇒ `ui.toast.loot` |
| Bag overflow on collect | `BuildingOps.ts:283` | ✅ 'warning' toast | — | — |
| Farm arm / stop / arm-fail | `ExplorationSurface.vue` | ✅ `farm.arm` / `farm.stop` / `ui.error` | — | — |
| Farm cycle completion | binding `farm_cycle` (route-gated to 'home') | ✅ `farm.cycle` | — | — |
| Companion recruit / exchange / gift claim | `GameManagerCompanionOps.ts:153,212,221,295` | ✅ 'loot' toasts | — | — |
| Cultivation start/stop | `cultivation_changed` → binding | ✅ `ambient.cultivate.on` / `.off` | — | — |

## Armed-reserved inventory vs gaps

| Reserved cue (no producer) | Best-fit silent moment |
|---|---|
| `progress.node_unlock` | skill node purchase/upgrade, specialization select, attribute allocate |
| `progress.quan_the` | hidden realm discovery (`QuanTheDiversion`, `HiddenLineage`), `attemptNghichChuTian` success — manifest comment already names this intent |
| `progress.reroll` | respec flows (`respecNodeTree`, `devResetBranch`, wash preview/commit) |
| `progress.create`, `progress.auto`, `farm.discover` | no matching moment in scope (reserved for future) |

## Missing cue families (new ids needed, not just wiring)

- `body.*` — invest, tier_complete, meridian_open, zhoutian_step/cycle, chapter_unlock (whole Luyện Thể family silent or toast-borrowing)
- `equipment.*` — enhance.ok/fail, wash, refine, dissolve (or wire `actionFeedback` → `ui.toast.*` as cheap fix)
- `quest.*` — accept, complete (today complete borrows `ui.toast.loot`)
- `progress.level_up` — minor breakthroughs (auto-tick) play nothing today; `progress.breakthrough` is too grand for every minor tier
- `craft.fail` — alchemy failure currently chimes `ui.toast.craft` same as success
- `mastery.rank` (optional) — technique mastery rank-ups share generic `combat.loot`

**Top-3 highest-impact gaps by play frequency:** (1) minor breakthroughs — every realm tier-up is silent; (2) entire equipment panel — one missing store wiring silences 4 tabs; (3) zhou_tian/meridian invest — silent despite the animated pour.

Stopping here per instructions — no code changes made.