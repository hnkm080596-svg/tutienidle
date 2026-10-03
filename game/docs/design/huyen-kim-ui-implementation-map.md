# Huyền Kim Sơn Thủy — UI Implementation Map

Baseline `devin/frontend-ready @ e9cb0dd6`. **Do not implement from this file until Minh approves the spec and the art pack lands** (see report footer). This map tells the frontend agent what each future surface consumes: component → shell → assets → layout region → read-model → mutation API → refactor complexity.

Companion files: `huyen-kim-scene-layout-spec.json` (regions), `huyen-kim-ui-asset-inventory.json` (assets), `huyen-kim-reference-audit.md` (what's real).

## 0. Global rules for the implementation agent

1. **Visibility flows only through canonical read models** — `betaScopeSurface`/`betaWheelSlots`/`isBetaBuildingSurface`/`isBetaPanelSurface`/`betaRealmLadderNodes`/`betaNextRealmSurfaceFor`/`isBetaEquipmentTab`/`betaCombatRolesFor`/quest/pill/equipment read models. Never re-derive scope from raw registries; unlisted ids are scope-hidden.
2. **Shells**: `ImperialScrollScene` (new), `CeremonialScroll` (new), world scenes keep DOM-over-world pattern. All coordinates in layout JSON are 1672×941 design px; canonical runtime space is 1280×720 (`HDViewport`) — map design px via ~0.765 uniform scale or `--game-vw/--game-vh` % (Ruling 01, ratified).
3. **New shared components to build**: `ImperialScrollScene` (rollers + reveal mask + frame + plaque + nav rail + close), `NavSeal` item, `HkBar` (entity-bar consumer), `ScrollReveal` anim (450–550ms open / 300–380ms close, reduced-motion crossfade), `ImperialNavRail` (driven by panel id list).
4. **frame-s-slot released (Ruling 03)**: P0 shared slot chrome — inventory cells, equip sockets, reward slots, material chips, requirement chips, compact sockets. One neutral base + runtime state/rarity tints. `SlotView`/`BagGrid` keep existing art as interim until the pack lands; dense grids may stay slice-free if tint reads suffice.
5. **Combat HUD stays canvas-or-DOM consistent**: `PlayerHudLayer` is canvas today; parity target is DOM HUD using `entity-bar`/`avatar-frame` — do not render both at once.
6. **Text** is always app-rendered; assets carry empty safe rects. Vietnamese diacritics must fit `text_safe_rect` at font-size minimums — flag collisions.
7. **No fake affordances**: anything hidden/RESERVED renders nothing (no disabled placeholder, no teaser, no tooltip).

## 1. Scene-by-scene map

### 01 Login — `world`
- **Current**: `AuthEntryScreen.vue` (mounted pre-session inside `GameRoot`).
- **Future shell**: full-bleed vista + right-aligned imperial-scroll card (`auth-scroll` region).
- **Assets**: surface-m-panel, frame-m-modal, text-field, button-standard/ceremonial, tab-seal, seal-chip (locale), divider-ornament.
- **Regions**: scene 01 (`auth-scroll`, `form`, `mode-tabs`, `secondary-actions`, `upgrade-card`).
- **Read-model/APIs**: `auth` service (`isValidLoginId`, `isValidPassword`), `continueSaved()`, guest auth, `GuestUpgradeCard` + `ConfirmModal`.
- **Complexity**: medium (shell swap + invalid controls removed).

### 02 Character Creation — `world`
- **Current**: `CharacterCreationScreen.vue` (name + 9-talent roll + fixed starter).
- **Future shell**: vista left / scroll right.
- **Assets**: text-field, talent card (`talent-card-scroll` existing), button-ceremonial, nav/back button-compact.
- **Read-model**: creation service (`CHARACTER_CREATION_ROLL_SIZE=9`), `creation-finish` action.
- **Hidden/RESERVED**: starter-skill selector slot exists in layout (`starter-slot`) but renders nothing beta.
- **Complexity**: medium.

### 03 Động Phủ — `world` (home)
- **Current**: `DongFuScene.vue` + `HomeBuildingIcons.vue` + `DongFuBuildingArt.ts` placements + `DongFuCommandWheel.vue` + `ThienCoRail.vue` + `GlobalTopBar.vue` (+ `AutoFarmIndicator`, feedback, bag, settings) + `BuildingDetailPopover.vue`.
- **Future**: same world scene; hotspots get `building-plaque` tags; wheel slots get `dao-luan-node` + `dao-luan-center`; top bar gets `identity-plate` + `avatar-frame` + `resource-pill` + `icon-button-utility`; Thiên Cơ drawer gets `surface-l-drawer` + `list-row`; quest tracker chip = new small component on `questOps.getBetaQuestSurfaceModels`.
- **Read-models**: `betaWheelSlots()` (rings 1–4; hidden slots absent), `isBetaBuildingSurface()`, Thiên Cơ entries (breakthrough/quest/ready/active/upgradeable kinds; daily cadence hidden).
- **Mutations**: wheel slot → `ui.openLeftPanel`/standalone panel or building popover; Thiên Cơ entry → its canonical action.
- **Regions**: scene 03 (hub r96, inner r185, outer r264, 5 building anchors at authored % placements).
- **Complexity**: medium-high (wheel orbit layout exists; re-skin + plaque labels + quest chip are the work).

### 04 Character — `imperial-scroll`
- **Current**: `CharacterPanel.vue` + `CharacterDetailCard.vue` (Chi Tiết drawer).
- **Future**: `ImperialScrollScene` + scene-04 regions; wheel → `el-formation-*` existing art + `avatar-frame`; stats → `list-row`; talents → `seal-chip`.
- **Read-models**: player read-models (identity, realm, combatPower, 5 main stats + points, talent seals, element affinities, derived stats).
- **Mutations**: attribute allocate.
- **Not owned**: meridian/body (→08), technique (→06), skill tree (→07).
- **Complexity**: medium.

### 05 Realm — `imperial-scroll`
- **Current**: `RealmPanel.vue` + `BreakthroughRequirementPanel`.
- **Future**: ascent-map (`rune-node` path over inner vista) + right rail (realm card, `entity-bar` cultivation, rate/ETA, passives, requirement `seal-chip`s, `button-ceremonial` Đột Phá).
- **Read-models**: `betaRealmLadderNodes()`, `betaNextRealmSurfaceFor()` (null → no teaser), realm passive rows, cultivation/rate/ETA.
- **Mutations**: `realmAdvanceOps` breakthrough.
- **Complexity**: medium-high (ascent map is new layout work; domain unchanged).

### 06 Technique — `imperial-scroll`
- **Current**: active technique lives on `TechniqueBand` inside `SkillPathPanel`.
- **Future**: standalone scroll — tech card, artifact frame (excluded art inside), `dao-luan-node` grade track, upgrade-compare panel.
- **Read-models**: active technique + grade progression from technique domain.
- **Mutations**: technique upgrade action.
- **Forbidden**: way-library tabs; lore browsing → `ScripturePavilionPanel` (`LoreCodex`) stays separate.
- **Complexity**: medium-high (new surface extracting TechniqueBand).

### 07 Skill — `imperial-scroll`
- **Current**: `SkillPathPanel.vue` + `NodeTreePanel` + `NodeInspector`/`SkillDetailView` + `NativeCoreDetail`.
- **Future**: way-card + element tabs (pre-commit) + radial `tree-canvas` (`rune-node`/`dao-luan-node`) + detail panel.
- **Read-models**: `wayIdentity`, `betaCombatRolesFor`, skill-domain models, `skillInsight`, node state (locked/available/learned/max/gate-blocked).
- **Mutations**: skill upgrade/learn actions; element commitment.
- **Complexity**: high (radial tree layout is new).

### 08 Body — `imperial-scroll`
- **Current**: body progression surfaces (`Luyện Thể`/`Bát Mạch`/`Chu Thiên` chapters — `BodyChapter.ts` registry).
- **Future**: chapter rail (`nav-seal-vertical`) + figure focus (`dao-luan-node` orb ring + `stat-meridian-figure`) + tier chips + detail/invest panel.
- **Read-models**: chapter registry + per-chapter progress/costs; Nghịch Chu Thiên DISCOVERY-HIDDEN.
- **Mutations**: chapter invest/opening APIs.
- **Complexity**: medium.

### 09 Inventory — `imperial-scroll`
- **Current**: `InventoryPanel.vue` + `BagGrid`/`SlotView` + `BagPaginationControls`.
- **Future**: scroll shell, `tab-seal` category tabs (Equipment/Material/Pill only), slot grid unchanged mechanics, capacity footer, `frame-xs-tooltip` item popover.
- **Read-models**: bag sections + capacity + filters.
- **Complexity**: low-medium (mostly shell + chrome swap).

### 10 Exploration / Sơn Hà Đồ — `imperial-scroll`
- **Current**: `StageSelectPanel.vue` (zone→chapter→stage).
- **Future**: zone rail (1 zone now; RESERVED), `tab-seal` chapters, `map-canvas` with `stage-node`+`boss-seal` (10/chapter, boss on 10) — painted substrate arrives from the gameplay/world art pipeline (Ruling 04); interim fallback = `surface-m-panel`/ink-wash parchment under the nodes; UI consumes map chrome only (frame, route lines, nodes, markers, labels, masks, edge treatment, detail chrome) — detail panel w/ 4 mode radios (manual/repeat/progress/perfect_farm), `entity-bar` progress footer (chests RESERVED).
- **Read-models**: `getStageSurfaceModels` / `isBetaStageSurface` (locked/available/cleared/perfect + boss).
- **Mutations**: `battleRunMode` select → start combat.
- **Complexity**: high (map band layout + node states).

### 11 Alchemy — `imperial-scroll`
- **Current**: `AlchemyView.vue` + `PillRoomPanel.vue` host.
- **Future**: recipe `list-row`s, detail panel (variants radio, fuel/stone `seal-chip` costs, preview, brew CTA + block reason), `job-queue` rows w/ `entity-bar` progress + cancel. `focal-cauldron` = `alchemy-cauldron-prop` UI scene prop (Ruling 02, decorative only).
- **Read-models**: recipes (realm-filtered, non-retired), `getAlchemyJobs`, `maxJobSlots` (building level).
- **Mutations**: `startAlchemyJob` (no quantity), cancel.
- **Forbidden**: quantity stepper, fast-forward, paid slot unlock, recipe categories (RESERVED).
- **Complexity**: medium.

### 12 Equipment / Khí Đường — `imperial-scroll`
- **Current**: `EquipmentHallPanel.vue` + `EquipmentPaperdoll` (6 slots).
- **Future**: `nav-seal-vertical` ops rail (enhance/wash/refine/dissolve/decompose; beta renders enhance+dissolve only via `isBetaEquipmentTab`), paperdoll w/ `frame-s-slot` sockets (released, Ruling 03), item card, compact `bag-grid`, stats strip (RESERVED).
- **Read-models**: `equipmentOps.getSlotState` + affixes + grade chip.
- **Mutations**: per-op equipment actions.
- **Complexity**: medium.

### 13 Combat — `world`
- **Current**: `CombatSceneOverlay.vue`, `CombatTopBar.vue`, `CombatSkillDockPanel.vue`→`TurnCombatSkillBar.vue`, `CombatAiPanel.vue`, `TurnOrderStrip.vue`, `BattleLogPanel.vue`, `PlayerHudLayer.ts` (canvas), `CombatIntroOverlay`/`CombatPauseOverlay`/`CombatExitConfirmModal`/`CombatVictoryPanel`/`CombatDefeatPanel`/`RewardList.vue`.
- **Future**: chrome re-skin only — `skill-orb-frame` on dock slots, `turn-token` on strip chips, `entity-bar` everywhere (canvas HUD parity or DOM port), `icon-button-utility` exit.
- **Read-models**: combat insets (dock publishes width via ResizeObserver — keep), `betaCombatRolesFor` (Basic+Special beta), AI strategies (5), turn order, `combatInputMode`.
- **Mutations**: skill cast, AI select, pause/exit-confirm.
- **Forbidden**: speed control (no API); chat; extra HUD chrome.
- **Complexity**: medium (re-skin; behavior untouched).

### 14 Tribulation — `world`
- **Current**: tribulation surface (`active.chapterIndex/chaptersTotal`, `questionSecondsRemaining`, `lightningStrikesTaken`, `currentQuestion`+`answerQuestion`, `hp/maxHp`, `isFinished` result).
- **Future**: chapter tracker (`dao-luan-node` medallions, dynamic count, non-selectable), title band (`scroll-title-plaque`), status card (`timer-ring`), mind card (dynamic answers), `entity-bar` HP cluster, result card.
- **Forbidden**: auto/skip, nav bars, invented "Tâm Ma %" meter.
- **Complexity**: medium.

### 15 Victory — `ceremonial-scroll`
- **Current**: `CombatVictoryPanel.vue` (already `surface-xl-scroll` + `frame-xl-ceremony` shapes).
- **Future**: envelope from shared shell + `ceremony-ribbon` gold title, reward slots (dynamic count), reward-line `list-row`s (cultivation/insight/stones/items), actions: Thử Lại + Tiếp Tục (auto-mode → retry countdown, continue hidden).
- **Read-models**: `getBattleRewardSummary()`, auto/manual flags.
- **Complexity**: low-medium.

### 16 Defeat — `ceremonial-scroll`
- **Current**: `CombatDefeatPanel.vue`.
- **Future**: same envelope, cinnabar ribbon variant, `isCultivationGap` hint text, partial `RewardList`, actions (danger retry + return w/ 10s label; repeat-mode 3s auto-retry, any-click cancels).
- **Complexity**: low.

### 17 Settings — `imperial-scroll`
- **Current**: `SettingsPanel.vue`.
- **Future**: rail sections → sections grid: `seal-chip` locale/UI-scale groups, `slider-track`+`slider-thumb` audio rows, `toggle-track` where real toggles exist, save/account `list-row` actions + `ConfirmModal` flows, feedback/updates/build rows.
- **Forbidden**: brightness/sensitivity/FPS/resolution/VSync/voice-language (no APIs); global footer save (per-action confirms instead).
- **Complexity**: low-medium.

### 18 Quest — `imperial-scroll`
- **Current**: `QuestPanel.vue` + `questOps.getBetaQuestSurfaceModels`.
- **Future**: `tab-seal` cadence groups (once only beta), `list-row` quest rows w/ `entity-bar` progress + `seal-chip` type, detail (objectives, shortfall, rewards, claim `button-ceremonial`), empty state.
- **RESERVED**: daily cadence, categories (main/side/achievement), "go-to" deep link.
- **Complexity**: low-medium.

## 2. Micro overlays (all scenes)

`OverlayPanel.vue`, `ConfirmModal`, tooltips (`useTooltip`), `BuildingDetailPopover`, `CombatExitConfirmModal` → `frame-xs-tooltip` / `frame-m-modal` / `surface-m-panel`; close = `icon-button-utility`; actions = `button-standard`/`button-compact`. Focus-trap + Esc + backdrop rules unchanged.

## 3. Implementation order (suggested)

1. **Shell primitives**: `ImperialScrollScene` + reveal anim + `NavSeal`/`ImperialNavRail` + `HkBar` + chrome bindings (`huyen-kim-chrome.json` ← art pack manifest).
2. **Top bar + wheel + Thiên Cơ** (scene 03) — highest visibility.
3. **Scroll scenes** in gameplay-critical order: 05 Realm → 07 Skill → 10 Exploration → 11 Alchemy → 12 Equipment → 09 Inventory → 04 Character → 08 Body → 06 Technique → 18 Quest → 17 Settings.
4. **Combat chrome** (13) + **Tribulation** (14) + ceremonial (15/16).
5. **Auth/Creation** (01/02) last — self-contained.

## 4. Validation surfaces for the implementation agent

- `npm run type-check` + scoped `vitest` (P3 quick); `npm run verify` when touching build/pipeline.
- `combat-ui-audit-capture` skill for combat HUD parity screenshots.
- `game-qa` Playwright flows for wheel open/close, scroll reveal, modal traps.
- Visibility assertions: scope-hidden ids render nothing (snapshot tests on `betaWheelSlots`, building rail, ops rail).
- Geometry QA at 1600×900 + 1366×768: no primary region overlap.
