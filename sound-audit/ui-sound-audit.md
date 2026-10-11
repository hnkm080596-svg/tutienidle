SOUND AUDIT — UI INTERACTIONS (devin/1791567361-ornate-dialog-art, game/src/components/**)

## Coverage model
| Layer | Mechanism | Result |
|---|---|---|
| Binding | uiAudioBinding.ts:44-68 (standalonePanel/leftPanelMode/characterOverlay + wheel) | ui.panel.open/close, ui.wheel.open/close |
| Primitive | GameButton:46 / OrnateButton:38 → ui.click; Chip:37 → ui.tab | covered per-instance |
| Component | audioStore.cue(id) in handler | per-site |
| Raw button/input | no cue | silent |

## A. Covered
- All GameButton/OrnateButton clicks: settings (save/update/account/feedback), worker-lodge tabs (ChieuMo:121, QuaTang:118, DuyenPhan exchange:163), ArtifactGradeSection:40, QuanKhi commit:334, Companion feed:486+close:327, AutoFarm stop:35, CombatTopBar pause:167, Victory/Defeat actions, TribulationMindCard:34, BreakthroughRequirementPanel:77-78, ProductionPanel collect:410+upgrade:480, BuildingUpgradeButton:49, CharacterMainStatRow allocate:93, QuestClaimCta:46, UpdateBanner/TutorialOverlay/SaveIncompatible/ErrorScreen.
- All Chip clicks: TabBar tabs, bag section chips, settings language/ui-scale/reduced-shake.
- Panel open/close + wheel (binding); DongFuStage navAction:282/activateSlot:332 (ui.wheel.select).
- Char creation reroll×2/finish (progress.reroll, progress.create, ui.error); vendor sell:134 (ui.purchase); paperdoll unequip:242 (ui.equip); toast watch (ui.toast.*); self-cued modals (ui.modal.*, ui.confirm/cancel, stinger.offline); exploration start/stop (farm.arm/stop, ui.error); alchemy (craft.start, ui.error, ui.cancel); TurnCombatSkillBar:154,161 (combat.select); QuanKhi path (progress.path_choose); TalentEntitlementModal decide (progress.talent_pick).

## B. Gaps — live interactions, no cue
| interaction | file:line | state | suggested cue |
|---|---|---|---|
| bag equip / op-tab pick | EquipmentBagSection.vue:72-79,437 | silent | ui.equip / ui.click |
| bag pagination + sort menu | EquipmentBagSection:396,404; BagPaginationControls:127-211 | silent | ui.panel.open / ui.tab |
| bag chip-select open/pick | BagChipSelect.vue:89-108 | silent | ui.tab |
| inventory tabs (raw button) | InventorySurface.vue:98 | silent | ui.tab |
| equipment workspace tabs (raw) | EquipmentSurface.vue:188 | silent | ui.tab |
| enhance confirm | EnhanceTab.vue:414 (EquipmentArtButton) | silent | ui.confirm / craft.start |
| wash/refine preview-keep-discard + lock | WashTab:336-342; RefineTab:337,394-400 | silent | ui.confirm / ui.cancel / ui.tab |
| dissolve select-all/clear/run | DissolveTab.vue:182,191,204 | silent | ui.click / ui.confirm |
| decompose selects | DecomposeTab.vue:126,143 | silent | ui.click |
| vendor qty input | VendorPanel.vue:197 | silent | ui.click (optional) |
| pill arm→drink | PillBagSection.vue:283 | silent | ui.confirm |
| quest row select | QuestRow.vue:58 | silent | ui.click |
| quest group tabs | QuestGroupTabs.vue:33,52 | silent | ui.tab |
| char stat allocate (fidelity card) | CharacterFidelityStats.vue:48 | silent | ui.confirm / progress.node_unlock |
| char talent card | CharacterFidelityStats.vue:60 | silent | ui.click |
| skill node tap-select | SkillPaperNode.vue:123 | silent | ui.click |
| skill node purchase/upgrade | SkillSurface.vue:810 | silent | progress.node_unlock (armed, unwired) |
| skill element tabs | SkillSurface @element | silent | ui.tab |
| technique stage select / advance | TechniquePaperArtifact:18; TechniquePaperUpgrade:18 | silent | ui.click / ui.confirm |
| realm floor select | RealmPaperMap → onSelectFloor | silent | ui.tab |
| realm breakthrough confirm | RealmSurface.onBreakthrough→requirement | ui.click only; attempt silent | progress.breakthrough (armed, no producer) |
| exploration zones/stages/modes/build/start/stop | ExplorationFidelityScene:26; PaperMap:26; PaperDetails:31,32,13 | silent | ui.tab / ui.click / ui.confirm |
| body chapter select + invest | BodyFidelityScene:52; BodyPaperDetails:272 | silent | ui.tab / ui.confirm |
| quanKhi orb append/remove | QuanKhiPanel.vue:422,443 | silent | ui.click / ui.cancel |
| companion card/feed-material select | CompanionPanel.vue:348,464 | silent | ui.click |
| tranPhap remove/select/confirm | TranPhapPanel.vue:368,384,424 | silent | ui.click / ui.confirm |
| artifact path pick | ArtifactPathCards.vue:35 | silent | progress.path_choose (armed) |
| constellation node/export | ConstellationNode:50; SkillConstellationPanel:209 | silent | ui.click |
| lore item open + pagination | LoreCodex.vue:77,82,84 | silent | ui.click (+verify ui.modal.open) |
| production radios/auto toggle | ProductionPanel.vue:348,358,458 | silent | ui.tab |
| settings nav rail | SettingsNavRail.vue:43 (QuestCategoryArtButton) | silent | ui.tab |
| settings volume sliders | SettingsAudioSection.vue:59,79 | silent | optional |
| combat manual-mode checkbox/exit | CombatTopBar.vue:156,180 | silent | ui.click |
| combat pause continue | CombatPauseOverlay.vue:40 | silent | ui.confirm |
| combat AI close/strategy radios | CombatAiPanel.vue:63,82 | silent | ui.cancel / ui.tab |
| combat skill slot (non-bar path) | CombatSkillSlot.vue:140 | silent | combat.select |
| battle log collapse / feedback clear | BattleLogPanel:77; ActionFeedbackLog:60,65 | silent | ui.click |
| transition retry/back | PresentationTransitionOverlay.vue:235,244 | silent | ui.click / ui.cancel |
| world announcement dismiss | WorldAnnouncementOverlay.vue:77 | silent | ui.cancel |
| login opening buttons | LoginOpening.vue (PcPaperButton) | silent | ui.click |
| login drawer scrim, exit-confirm | AuthEntryScreen.vue (PcPaperButton) | silent | ui.panel.close / ui.confirm |
| auth mode tabs | AuthModeTabs.vue:20 | silent | ui.tab (verify still mounted) |
| login locale chips | LoginLocaleChips.vue:12 | silent | ui.tab |
| password reveal | LoginPasswordField.vue:20 | silent | ui.click (optional) |
| creation path radio | CharacterCreationScreen.vue:61-64,178 | silent | progress.path_choose (armed) |
| creation talent toggle | CharacterCreationScreen.vue:107-112,183 | silent | progress.talent_pick / ui.tab |
| creation back | CharacterCreationScreen.vue:170 (PcPaperButton) | silent | ui.cancel |
| dongfu board heading/go | fidelity/DongFuBoard.vue:12,18 | silent | ui.click (go covered by panel.open) |
| dongfu rail collapse | DongFuStage.vue:468,478 | silent | ui.click |
| OrnateDialog X | OrnateDialog.vue:69 | silent (parent cues may not cover X) | ui.modal.close |
| paper nav/tabs/scene-actions | PaperPanelNavigation:19,21; PcPaperTabs:8; PcPaperSceneActions:32-35 | silent | ui.tab / ui.click |

## C. Armed-reserved rows, no producer
- progress.breakthrough → no producer (realm confirm path)
- progress.node_unlock → no producer (skill purchase/upgrade)
- progress.path_choose → only QuanKhi (missing: creation pickPath, ArtifactPathCards)
- progress.talent_pick → only entitlement modal (missing: creation toggleTalent)
- ui.equip → only unequip path (missing: bag equip, op selects)
- ui.modal.open/close → produced by self-cued modals; rows have NO synthFallback (silent even when fired); BreakthroughRequirementPanel/OrnateDialog-X paths don't fire it
- combat.countdown.tick → no producer (CombatCountdownOverlay:47 transitions)

## D. Deliberate silence
:sound="false" buttons inside self-cuing modals/toast dismiss; MaterialBag display slots; DevToolsPanel; no hover cues anywhere (uniform); combat.exit via binding.

## E. Preview-only (exclude)
Fidelity internals not mounted by canonical Surfaces: InventoryFidelityDetail, DongFuHomeContent/Hud, QuestFidelity*, SettingsFidelity*, TribulationFidelity*, VictoryFidelityScene, CombatFidelityControls.

## Structural takeaway
Bimodal coverage: GameButton/OrnateButton/Chip = covered; every raw <button>/radio/input = silent. Biggest silence clusters: raw tab bars (inventory/equipment/quest/settings-nav/auth/skill-element), equipment-hall art buttons, selection interactions, and the entire login/onboarding surface on PcPaperButton (highest-leverage single fix — also backs creation nav, DongFu currency, PcPaper* primitives).