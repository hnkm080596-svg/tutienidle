# Huyen Kim Reference Fidelity - Scene Matrix (18/18)

Design space 1672x941 -> runtime 1280x720 (x0.7655). Before shots at `evidence/before/` @1280x720; references under `docs/design/references/huyen-kim/scenes/`.

Status vocabulary: NOT_STARTED / IN_PROGRESS / VISUAL_ACCEPTED / ART_BLOCKED / QA_UNVERIFIED.

| S | Scene | Entry (fixture) | Ref | Before evidence | Key delta to fix | Status |
|---|---|---|---|---|---|---|
| 01 | Login | `/` fresh context | 01-login.jpg | before/01-login.png + after/01-login.png | DONE: right-anchored ivory scroll (surface-xl-scroll + frame-xl-ceremony chrome), left vista, safe-area content | VISUAL_ACCEPTED |
| 02 | Creation | guest auth -> creation | 02-character-creation.jpg | before/02-character-creation.png + after/02-character-creation.png | DONE: ivory scroll + ceremony frame, compact 3x3 grid, readable plaque, CTA in safe area | VISUAL_ACCEPTED |
| 03 | Dong Fu | home; wheel Tab | 03-dong-fu.jpg | before/03-dong-fu-{closed,open}.png + after/03-dong-fu-{closed,open}.png | DONE: autumn/night moonlit kit, 2 orbits (inner ~138/outer ~197px), node+glyph+label-below, vertical plaque tags, icon-only seals, Thien Co chip+drawer, quest tracker chip | VISUAL_ACCEPTED |
| 04 | Character | openLeftPanel('character') | 04-character.jpg | before/04-character.png + after/04-character.png | DONE: portrait + stat silhouette + Ngũ Hành wheel focal composition per ref; Chi Tiết drawer on demand | VISUAL_ACCEPTED |
| 05 | Realm | openStandalonePanel('realm') | 05-realm.jpg | before/05-realm.png + after/05-realm.png | DONE: vista + canonical 3-rung ascent spine (ref's 18-node path was AI fantasy - domain truth wins); progress/rate/CTA rail | VISUAL_ACCEPTED |
| 06 | Technique | openStandalonePanel('technique'); mortal = empty | 06-technique.jpg | before/06-technique.png + after/06-technique.png | DONE: plinth centerpiece + hero TechniqueSlotCard + effects/mastery rail + grade track; empty state has structure now | VISUAL_ACCEPTED |
| 07 | Skill | openStandalonePanel('skill') | 07-skill.jpg | before/07-skill.png + after/07-skill.png | DONE: skill-tree parallax substrate + radial constellation layout (skillGraphLayout) + rune-node chrome + zoom/pan + inspector | VISUAL_ACCEPTED |
| 08 | Body | openStandalonePanel('body') | 08-body.jpg | before/08-body.png + after/08-body.png | DONE: figure + 8-orb "Kỳ Kinh Bát Mạch" ring bound to canonical node state (spoke transform fix) | VISUAL_ACCEPTED |
| 09 | Inventory | openLeftPanel('inventory') | 12-equipment.jpg (grammar) | before/09-inventory.png + after/09-inventory.png | DONE: dominant grid + capacity/tools footer; bag-rail grammar shared with S12 | VISUAL_ACCEPTED |
| 10 | Exploration | openLeftMode('stage_select') | 09-exploration.jpg | before/10-exploration.png + after/10-exploration.png | DONE: painted map frame/mask/divider + serpentine trail (stageTrailLayout, 0..1000 viewBox) + seal nodes + lock/boss markers; building-heading contrast + scroll header clearance fixed | VISUAL_ACCEPTED |
| 11 | Alchemy | openLeftMode('pill_room') | 11-alchemy.jpg | before/11-alchemy.png + after/11-alchemy.png | DONE: recipe rail + stable cauldron focal + detail/action column + prominent queue strip (interactive) | VISUAL_ACCEPTED |
| 12 | Equipment | openLeftMode('equipment_hall') | 12-equipment.jpg | before/12-equipment.png + after/12-equipment.png | DONE: paperdoll-base substrate + 6 sockets + ops tabs + compact bag rail | VISUAL_ACCEPTED |
| 13 | Combat | stage -> start | 10-combat.jpg | before/13-combat.png + after/13-combat.png + mid-fight crops | DONE: battlefield dominant; edge-hugging HUD (AI panel left, turn strip top, skill orbs right, canvas HP/MP/Kiếm stack bottom-left via PlayerHudLayer); orbs/tokens already on combat chrome | VISUAL_ACCEPTED |
| 14 | Tribulation | realm -> Quán Khí (seeded realmLevel 12) | 13-tribulation.jpg | before/14-tribulation.png + after/14-tribulation.png | DONE: stray frame-xl-ceremony viewport ring removed (full-bleed storm); question card right + timer ring; left status card (surface-m-panel + plaque); tracker pips top; HP cluster bottom; route invariant scrolls==[] pinned in capture spec | VISUAL_ACCEPTED |
| 15 | Victory | battle win | 14-victory.jpg | before/15-victory.png + after/15-victory.png | DONE: ceremonial ribbon + ceremony frame + reward slots (light-readable labels on dark slot surface) + growth card + dual CTA; title token fixed (dead --text-display-md -> --text-display-lg) | VISUAL_ACCEPTED |
| 16 | Defeat | battle loss | 15-defeat.jpg | before/16-defeat.png + after/16-defeat.png | DONE: cinnabar ribbon THẤT BẠI + hint + retry/return with countdown; same token fix | VISUAL_ACCEPTED |
| 17 | Settings | openLeftMode('settings') | 16-settings.jpg | before/17-settings.png + after/17-settings.png | DONE: stale paper-on-dark removed (sections back to pale cards on paper, note readable, dark rail pills per ref kept); all canonical surfaces/actions intact | VISUAL_ACCEPTED |
| 18 | Quest | openStandalonePanel('quest') | 17-quest.jpg | before/18-quest.png + after/18-quest.png | DONE: list rail + detail column inside scroll (canonical rows); empty state now centered across content grid instead of rail-only | VISUAL_ACCEPTED |


## Shell host census (Task 4)

One host per scene; ImperialScrollScene is the single scroll shell (rollers/plaque/grain/frame/nav rail + header/main/footer zones). No consumer renders a nested scroll (verified: no panel imports ImperialScrollScene inside a scroll subtree except the host itself).

| Scene | Host file | ui-store authority | data-hk-scene |
|---|---|---|---|
| 04 character / 09 inventory | LeftPanel.vue (shared scroll, tab swap) | characterOverlayOpen + characterSceneTab | scene=character|inventory |
| 10 stage_select / 11 pill_room / 12 equipment_hall / exploration / 17 settings | FunctionOverlayPanel.vue | leftPanelMode | scene=<mode> |
| 05 realm / 07 skill / 06 technique / 08 body / 18 quest | own panel files (RealmPanel, SkillPathPanel, TechniquePanel, BodyPanel, QuestPanel) | standalonePanel | scene prop set |
| 13 combat / 14 tribulation | CombatSceneOverlay / TribulationSceneOverlay (route-owned, not scroll) | routeAdapter | route host |
| 15 victory / 16 defeat | CombatVictoryPanel / CombatDefeatPanel inside combat overlay | combat outcome | ceremony panels |
| 01 login / 02 creation | AuthEntryScreen / CharacterCreationScreen (onboarding, not scroll) | onboarding flow | data-hk-scene set |
| micro overlays (worker_lodge / scripture_pavilion / vendor / QuanKhi etc.) | OverlayPanel legacy | leftPanelMode / standalonePanel | legacy (Task 10 chrome only) |

Entry paths: wheel slots -> ui.openLeftPanel/openStandalonePanel; building hotspots -> navigation.openBuilding -> popover/leftPanelMode; top-bar seals -> openLeftPanel. Every opener funnels through ui.closeHomeOverlays() first (mutual exclusivity); mount chokepoint = GameRoot isBetaStandalonePanel.
