# Động Phủ panel survey — artUI C-series (line-by-line)

Survey date: 2026-10-06. Branch: `devin/artui-c-login` (off `devin/artui-b-design-system`).
Scope: every surface reachable from the home scene — the stage chrome itself,
the 21-icon nav rail, building function panels, standalone overlays, hidden-scope
panels, and shared components they all sit on.

**TL;DR (đọc 60s):** 22 surface đã khảo sát line-by-line + preview live.
Rail trái trong game ĐÃ khớp mock (20 mục + lock, @2d1a2238). Wire G3 = port
layout mock vào `*FidelityScene` hiện có — model thật đủ, không cần adapter.
**43 rulings** kèm default ở §4 — mỗi cái chỉ cần duyệt/sửa. Nổi bật: vendor
không có design nào (R33), Trợ Giúp là panel mới không phải form (R37), 2 bản
formation xung đột (R41), quest chỉ có mainline vs 5 nhóm mock (R31), title art
victory/defeat thiếu trong pack (R36). Slice order đề xuất C0→C18 ở §10.
Mọi mock label đã có key thật trừ ~4 cái (§8b); ~8 e2e spec pin layout cũ
cần repin theo slice (§8c).

Legend:
- **Wire-now** = element maps 1:1 onto an existing Pc* component or tien-hiep-2026-10 asset; no design decision needed.
- **RULING** = needs Minh's call before implementation.
- **Risk** = hidden dep, scope leak, or "old has / new doesn't" gap.

---

## 0. Taxonomy — what "động phủ panels" means in code

Two parallel panel systems (presentation/contracts/panelIds.ts):
- `LeftPanelMode`: character, inventory, exploration (Sản Xuất / auto-farm), settings, equipment_hall, pill_room, worker_lodge (scope-hidden), scripture_pavilion, stage_select (Bản Đồ), vendor.
- `StandalonePanel`: skill, realm, quan_khi, quest, artifact, tran_phap, companion, technique, body.

Building → panel routing (data/building/buildings.ts, single funnel `openBuilding`):
gathering_outpost→exploration, equipment_hall→equipment_hall, pill_room→pill_room,
teleport_array→stage_select, vendor→vendor, chi_hien_quan→worker_lodge (scope-hidden).

Nav rail (21 icons): home, character, skill, equipment, body, technique, realm,
inventory, alchemy, formation, exploration, quest, production, vendor, settings,
feedback + locked: artifact, companion, guild, sect, portal.

---

## 1. Home stage (DongFuStage) — in-flight rewire @2d1a2238

**Wired already (real read-models):** profile card (avatar + name + realm + progress),
currency chips, quest tracker card (opens quest panel), 21-icon rail (locked/active
states, collapse + indicator, transition seam), command wheel coexists (Backquote),
Thiên Cơ Bảng parked below quest card, AutoFarmIndicator, notice line.

### Wire-now
- Rail icons: `icons/navigation-{id}-v2.png` all present in pack — done.
- Rail chrome: `navigation-backing-dark-v3.png`, `navigation-medallion-v1.png`, `navigation-landscape-seam-v1.png` — done.
- Currencies: `resource-{coin,crystal,essence,jade}-v1.png` + PcPaperButton secondary — done.

### RULING — home scene
- **R1. Building hotspots removed.** The old vista had 5 clickable building markers (pill_room 386,120; equipment_hall 868,133; gathering_outpost 126,410; teleport_array 1250,449; vendor 980,470) with ready/upgradeable dots. The approved mock paints none — buildings are rail-only now. Keep rail-only, or restore markers (pack has `landmark-v1.png` + `PcPaperLandmark.vue` unused)?
- **R2. artifact/companion are realm-gated unlockables**, not permanently locked. The wheel computes `disabledContext` (isArtifactDomainUnlocked etc.) — the rail hard-locks them forever. Wire the same realm predicates into `navLocked()` so they unlock on the rail too?
- **R3. Building status badges lost on the rail.** Wheel slots + old hotspots showed ready (kho đầy)/upgradeable dots; rail shows none. Add a dot to equipment/alchemy/production/vendor rail buttons (reuses `navigation.getBuildingStatus`)?
- **R4. Thiên Cơ Bảng** still the old dark drawer parked under the quest card (top:290 right:30). Restyle to paper chrome, fold into quest card, or leave until its own redesign pass?
- **R5. Currency icon mapping is positional** (`CHIP_ICON[index]`), and real chips are the 3 linh-thạch tiers — not the mock's 4 currencies. Icon per tier vs one stone icon? (Index mapping breaks if a 4th chip appears when companion unlocks.)
- **R6. Teleport array building has no rail entry** — 'exploration' nav opens stage_select (the same surface the array opens), but the array's own level/upgrade/status is invisible from the rail. Acceptable (wheel still shows it) or needs a plaque?
- **R7. scripture_pavilion (Tàng Kinh Các) has no rail icon** — wheel-only today. The pack has no scripture icon; keep wheel-only or add to rail?
- **R8. Command wheel + board + AutoFarmIndicator** keep old chrome until their redesign passes — confirm "park old chrome" per-surface is the plan.

### Risk
- `df-notice` at left:420/top:110 can collide with the currencies row (starts left:682) on long strings.
- Old `DongFuHomeContent`/`DongFuVista`/`DongFuHud` now dormant — kept for raw-source test pins or slated for removal? (same question as dormant creation shell files).
- `player portrait` real art was in old HUD; avatar slot now uses the generic 'character' nav icon — placeholder or final?

---

## 2. Kiến trúc mount — 3 đường vào panel

```
rail icon (DongFuStage.navAction)
  ├─ 'character'/'inventory' → ui.characterOverlayOpen + characterSceneTab
  │     → LeftPanel.vue → CharacterSurface→CharacterFidelityScene / InventoryPanel→InventorySurface→InventoryFidelityScene
  ├─ openLeftPanel(mode) → FunctionOverlayPanel.vue
  │     ├─ PAPER_MODES (chrome riêng, đã fidelity): stage_select→ExplorationSurface, pill_room→AlchemySurface, equipment_hall→EquipmentSurface, settings→SettingsSurface
  │     ├─ scrollMode: exploration→ProductionPanel (trong ImperialScrollScene — panel cuối cùng còn vỏ scroll cũ)
  │     └─ legacyMode (OverlayPanel cũ): worker_lodge, scripture_pavilion, vendor
  └─ openStandalonePanel(panel) → GameRoot (lazy-mount, mountedStandalone Set)
        → SkillPathPanel→SkillSurface, RealmPanel→RealmSurface, QuanKhiPanel (OverlayPanel CŨ),
          QuestPanel→QuestScene, ArtifactPanel (OverlayPanel CŨ), TranPhapPanel (OverlayPanel CŨ),
          CompanionPanel (OverlayPanel CŨ), TechniquePanel→TechniqueSurface, BodyPanel→BodySurface
```

**3 thế hệ design đang tồn tại trong repo:**
- G1 cũ: OverlayPanel/ImperialScrollScene + ink chrome (worker_lodge, vendor, scripture, quan_khi, artifact, tran_phap, companion)
- G2 fidelity: `*FidelityScene` + `PaperPanelNavigation` + huyen-kim paper (character, skill, body, technique, realm, inventory, alchemy, exploration, quest, equipment, settings) — PRODUCTION hiện tại
- G3 approved: `Home*ArtPanel` mock trong `ui-landscape-design.html` — panel mở TRÊN canvas home (left:24%, top:12.5%, 74%×75%, nền `shared-paper-page-v1.png`, card `character-card-nine-slice-v2.png`, control family `EquipmentArt*`)

**G3 = target đã duyệt.** Wire = port layout Home*ArtPanel vào fidelity scene tương ứng, feed data thật.

**Primitives G3 cần promote** (hiện chỉ ở `ui-preview/equipment/` — preview-only, không được production dùng): `EquipmentArtButton`, `EquipmentArtCard`, `EquipmentArtSlot`, `EquipmentEnergyTube`, `EquipmentPaperdollPreview`, `ProductionSourceArtCard`, `QuestCategoryArtButton`, `QuestObjectiveArt`, `SkillNodeArtButton`. → RULING ownership bên dưới.

---

## 3. Per-panel survey (G3 mock vs production fidelity)

### 3.1 CHARACTER (rail → characterOverlayOpen → CharacterSurface→CharacterFidelityScene)

| | G3 mock (`HomeCharacterArtPanel`) | Production (`CharacterFidelityScene`) |
|---|---|---|
| Shell | panel trong home canvas 74%×75%, nền paper-page, KHÔNG có top nav | full-canvas overlay + `PaperPanelNavigation` (nav ngang trên cùng) |
| Cột trái | portrait: tên, "identity" dòng, hero art `player-mortal-ink-sword-concept-v2.png`, card Sức Mạnh (combat power) | `CharacterFidelityIdentity` (tên+seal ◆), `CharacterFidelityFigure` (figure.png) |
| Cột giữa | card main-stats: 5 stats + tube fill + nút `+` (`attribute-plus-v2.png`), MAX state; card talent 1 dòng (icon+name); card elements 5 icon ivory+value | `CharacterFidelityStats`: 5 stat rows (label+value+fill tube+`+` allocatable) + talents seal-list (tất cả talents, rarity class) + element summary (icon+share) |
| Cột phải | detail scroll: 3 card nhóm (basic/combat/other rows dt/dd) | `CharacterFidelityDetails` aside: combat + other groups |
| Events | select stat/talent/element, allocate | select, allocate, navigate, back — đủ |
| Sự cố | preview render BẢN DUYỆT stamp | |

**Wire-now:** thay chrome cf-* → `character-card-nine-slice-v2` cho 3 cột card; hero art `player-mortal-ink-sword-concept-v2.png` (có sẵn, mock dùng ảnh thật!); `attribute-plus-v2.png` cho nút +; element ivory icons `element-*-ivory-v1.png`; tube có energy-flow animation sẵn trong mock CSS.

**DELTA/ruling:**
- **R9.** Mock không có `PaperPanelNavigation` — câu hỏi chung cho mọi panel G3: giữ nav ngang trên cùng (G2) hay rail trái đã đủ điều hướng? (Mock mount panel TRONG home canvas → rail vẫn thấy bên trái panel.)
- **R10.** Prod talents = danh sách seal đầy đủ; mock chỉ 1 card talent. Giữ list talent (thành card scroll) thay vì 1 dòng?
- **R11.** Prod figure = `figure.png` huyen-kim; mock = hero concept v2 art — chọn hero concept làm figure chính?
- **R12.** Mock có card "Sức Mạnh" (combat power số lớn) — prod `CharacterUiModel.combatPower` đã có sẵn. Wire-now, chỉ cần vị trí card.
- Mock "identity" dòng mơ hồ — prod có realm+path+pathVerse. Mock bỏ sót path → cần hiện trong card portrait?
- Stat MAX state: mock `MAX` khi capped — prod đã có `capped` flag. Wire-now.
- Action rail (Quán Khí entry, respec?) — prod `CharacterActionRail` render khi `showQuanKhiEntry`; mock không có → **R13: Quán Khí mở từ đâu?** (hiện chỉ mở từ nút trong action rail của character panel; rail 21-icon KHÔNG có quan_khi)

### 3.2 INVENTORY (rail → characterOverlayOpen+tab='inventory' → InventoryPanel→InventoryFidelityScene)

| | G3 mock | Production |
|---|---|---|
| Tabs | tabs ngang: bag/decompose (+tab đổi filter nav) | `activeBagTab` model: material/equipment/consumable? (BagTab) |
| Toolbar | search ô + filter buttons (decompose mode) + count | toolbar: filter nav + search input + sort button |
| Grid | `EquipmentArtSlot` grid + empty cells "Trống" | item-grid button (icon+amount) |
| Decompose | card phải: target slot + result material + nút | **prod không có decompose trong inventory** (decompose sống ở equipment forge) |
| Chi tiết | (không — mock chỉ slot select) | `InventoryFidelityDetail` aside: art+name+quality+desc+amount+nút dùng |
| Footer | pagination ‹1› + sort ↕ | không có pagination |

**Wire-now:** slot grid → `EquipmentArtSlot` (item-slot-v1.png asset); search row; tab style.

**RULING:**
- **R14.** Decompose ở inventory (mock) vs ở forge (prod) — đưa thẻ decompose vào inventory theo mock, hay giữ ở Khi Đường?
- **R15.** Pagination ‹1› trong mock — prod không phân trang (scroll). Cần pagination thật hay bỏ?
- Mock thiếu detail panel (prod có) → giữ chi tiết item.

### 3.3 SETTINGS (rail → leftPanelMode=settings → SettingsSurface→SettingsFidelityScene)

| | G3 (`HomeSupportArtPanel` kind=settings) | Production |
|---|---|---|
| Nav | cột trái `QuestCategoryArtButton` 3 section (audio/video?/…) | `settings-layout` nav trái + section |
| Controls | toggle checkbox + range + % output | `SettingsFidelitySection`: range/toggle/select theo control model |
| Actions | (mock không có) | actions row |

**Wire-now:** nav cột trái bằng QuestCategoryArtButton + navigation-settings icon; giữ control model prod.

**RULING:** mock có **kind='feedback'** dùng cùng panel với 5 nhóm help — feedback hiện là dialog cục bộ trong DongFuStage (R16: feedback = full panel hay dialog?).

### 3.4 EQUIPMENT HALL / KHÍ ĐƯỜNG (rail equipment → equipment_hall → EquipmentSurface→EquipmentFidelityScene)

| | G3 (`HomeEquipmentArtPanel`) | Production |
|---|---|---|
| Header | title + divider img | title + subtitle |
| Tabs | nav tabs (equipment/forge modes → `eq.tabs.*`) | sockets + bag/forge mode nav (enhance/dissolve/decompose) |
| Trái | `EquipmentPaperdollPreview` — paperdoll slots | `equipment-sockets` hàng socket item |
| Phải | `EquipmentArtCard` chứa `EquipmentBagPreview` hoặc `EquipmentForgePreview` theo tab | bag grid + `ForgeFidelityWorkspace` (compact) / `ForgeBatchBag` |
| Tooltip | — | `EquipmentPaperTooltip` |
| Summary | — | `equipment-summary` (HP/ATK/DEF tổng) |

**Wire-now:** tab nav style mock; paperdoll preview component layout; card shell `EquipmentArtCard`.

**RULING:**
- **R17.** Prod summary card (HP/ATK/DEF) — mock không hiển thị; giữ?
- **R18.** Prod sockets là hàng ngang trên; mock paperdoll dọc trái — đổi sang paperdoll layout luôn?
- Forge tabs trong prod = enhance/dissolve/decompose/…(5 tabs `panels.equipmentHall.tabs.*`); mock chỉ 2 tab (equipment + forge). Tab map chính xác?

### 3.5 SKILL (rail → standalone=skill → SkillPathPanel→SkillSurface→SkillFidelityScene)

| | G3 (`HomeSkillArtPanel`) | Production |
|---|---|---|
| Header | title + element chips nav (icon+label) | title + identity + element chips — đã trùng khớp |
| Tree | SVG pipe `skill-connection-pipe-v1.png` + glow lines active; node `SkillNodeArtButton` (kind active/passive/locked, icon, level, selected) | `SkillPaperTree`: nodes+edges SVG, `SkillPaperNode` — trùng ý tưởng |
| Phải | card chi tiết node: name, level·state, description, effects dl, conditions, costLabel, nút upgrade | `SkillPaperDetails`: header icon+name+level·state, effect rows, conditions, upgrade btn |
| Footer | — | `skill-meta` + respec button |

**Wire-now:** swap pipe asset `skill-connection-pipe-v1.png` vào SkillPaperTree edges; SkillNodeArtButton → SkillPaperNode skin.

**RULING:**
- **R19.** Prod có respec button (footer) — mock không vẽ; giữ respec ở đâu?
- Mock active connection = glow flow animation — prod edge style phẳng; dùng luôn asset pipe+flow?

### 3.6 BODY / LUYỆN THỂ (rail → standalone=body → BodyPanel→BodySurface→BodyFidelityScene)

| | G3 (`HomeBodyArtPanel`) | Production |
|---|---|---|
| Nav trái | 3 family tabs ren/khai/dan (icon lit/unlit + spine line) | chapter buttons (`model.chapters`) icon+label+hint, is-locked |
| Giữa | `body-stage`: silhouette ngồi + lớp anatomy (skin/muscle/blood/spine 10 đốt/heart/forehead 3 nodes) lit theo tier | `BodyPaperFigure`: meridian = orbs anchor positions; khác = unit-rail buttons + milestones |
| Phải | (trong mock phần sau — details card) | `BodyPaperDetails`: title+desc+gains dl+costs+progress+extra+invest btn |

**Wire-now:** nav trái lit/unlit icon assets (`navigation-{ren,khai,dan}-{lit,unlit}` trong pack body/), spine tube `meridian-tube-lit.png`.

**RULING:**
- **R20.** Anatomy silhouette G3 (10 vertebra, heart, forehead nodes, blood lit) = concept khác hẳn prod orbs/rail. Đây là redesign lớn nhất — dùng anatomy cho chương nào? (Mock hardcode tab 'ren'.) Prod chapters thực tế là gì — cần map ren/khai/dan ↔ chapters.
- **R21.** Body prod có `model.extra` block + gates + material costs — mock không hiển thị; giữ chi tiết phải.

### 3.7 TECHNIQUE / TÂM PHÁP (standalone=technique, gated LK+pathway → TechniqueSurface→TechniqueFidelityScene)

| | G3 | Production |
|---|---|---|
| Trái | manual heading (icon+name+quality) + `manual-art-space` + milestone nodes (SkillNodeArtButton passive, 4 stage lit/unlit) | `TechniquePaperArtifact`: name + stages row (seal ◇ buttons) + sections |
| Phải | stat card: progress tube 70%, rank, stats dl (power/defense/mana), grade-comparison current→next, material cost (crystal), nút advance | `TechniquePaperInfo` sections + `TechniquePaperUpgrade`: advance btn |

**Wire-now:** milestone node row (SkillNodeArtButton) thay technique-stage seals; stat card layout; grade-comparison current→next.

**RULING:**
- **R22.** `manual-art-space` trong mock = vùng trống chờ art sách — Minh cung cấp art manual?
- Prod `model.sections` (mô tả nhiều section) vs mock chỉ 1 name/quality — giữ sections.

### 3.8 REALM / CẢNH GIỚI (standalone=realm → RealmSurface→RealmFidelityScene)

| | G3 | Production |
|---|---|---|
| Track | timeline ngang: milestones landscape ảnh (`realm/landscape-1..3`), current/locked, translateX theo index | `RealmPaperMap`: anchors trên map (marker buttons major/reached/current/selected) |
| Card | active-card: name, level, meditation img, cultivation tube 650/1000, speed +2/s, estimate, conditions ✓, 2 nút (advance + tribulation locked<12) | `RealmPaperDetails`: identity (seal+name+floor), passives list, cta btn |
| Footer | effects + introduction 2 card | — |

**Wire-now:** meditation img `realm/meditation`, landscape milestone imgs, condition ✓ list, 2 nút action (advance/tribulation) — tribulation gating đã có trong prod (breakthrough emit).

**RULING:**
- **R23.** Track mock = timeline ngang landscape cards vs prod = map anchor path. Hai concept khác — chọn timeline?
- **R24.** Nút "Độ Kiếp" riêng trong realm card (locked dưới floor 12) — prod route tribulation qua breakthrough cta. Giữ 2 nút?
- **R25.** Realm footer effects/introduction — prod `model.passives` + section khác đã cover?

### 3.9 ALCHEMY / LUYỆN ĐAN (rail alchemy → pill_room → AlchemySurface→AlchemyFidelityScene)

| | G3 | Production |
|---|---|---|
| Nav | recipe list `EquipmentArtButton` (icon+name) | `AlchemyPaperRecipes` recipe-row list |
| Stage | `alchemy-stage`: connectors meridian-tube + ingredient slots + cauldron art + pill center frame | `AlchemyPaperCauldron`: cauldron art + selected-herb chip |
| Phải | progress card: 4 tube (mastery/fire/purity/stability) + nút start | `AlchemyPaperDetails`: header, herb variants radio, outcome, brew btn |
| Queue | — | `AlchemyPaperQueue`: jobs progress + cancel |

**Wire-now:** cauldron stage mới (connectors + ingredient slots x/y%); cauldron art đã có `alchemy-cauldron-prop@2x.png`.

**RULING:**
- **R26.** 4 progress tube (mastery/fire/purity/stability) — prod không có metric này. Có wire số thật (tỉ lệ thành/level mastery trong data?) hay bỏ?
- **R27.** Herb variants radio (prod, 5 tuổi khoáng) vs mock ingredient slots cố định — giữ radio variants trong card phải.
- Queue — giữ `AlchemyPaperQueue` (mock bỏ sót).

### 3.10 EXPLORATION / SƠN HÀ ĐỒ + BẢN ĐỒ (rail exploration → stage_select → StageSelectPanel→ExplorationSurface→ExplorationFidelityScene)

| | G3 (`HomeExplorationArtPanel` = map chỉ) | Production |
|---|---|---|
| Map | `PaperSceneDesigns kind='map'` — vùng map thiết kế | `ExplorationPaperMap`: chapter bands + stage-node buttons (state/boss/perfect/selected) |
| Header | title | zone chips + title/subtitle |
| Phải | — | `ExplorationPaperDetails`: armed-farm bar, stage title, mode chips (auto/manual?), build link, start btn |

**Wire-now:** map gọn (mock chỉ title+map).

**RULING:**
- **R28.** Mock exploration = chỉ map, không có panel chi tiết/nút start — prod có details đầy đủ. Đây có phải chủ ý "Bản Đồ chỉ để nhìn" hay mock chưa vẽ phần phải? (stage_select là cửa vào combat — nút start là core!) → giữ details.
- Zone chips (prod) vs mock không — giữ.

### 3.11 PRODUCTION / KHAI VẬT (rail production → exploration mode → ProductionPanel trong ImperialScrollScene — G1!)

| | G3 (`HomeProductionArtPanel`) | Production (scroll cũ) |
|---|---|---|
| Header | hall name+level+intro + vein card (Linh Mạch: tube+stored+rate+Thu hoạch) | summary p + Linh Mạch card (progress+rate+collect) |
| Sources | 3 `ProductionSourceArtCard` (icon+landscape img+level+running toggle+upgrade) | site-card grid: art+name+kind+desc+stats+reward+Bar progress+auto toggle |
| Worker | — | `worker-allocation` block (manual sliders / auto hint + reserved) — scope feature manualWorkforce |

**Wire-now:** vein card → Linh Mạch (tube + Thu hoạch); 3 source art card layout (landscape img — asset nào? cần check `landscapes[]` mock source).

**RULING:**
- **R29.** Panel cuối cùng còn vỏ `ImperialScrollScene` — promote ProductionPanel lên paper chrome như 4 anh em đã migrate?
- **R30.** `worker-allocation` (manual workforce) — scope-hidden feature, mock không có. Giữ trong panel hay bỏ theo scope?

### 3.12 QUEST / NHIỆM VỤ (standalone=quest → QuestPanel→QuestScene→QuestFidelityScene)

| | G3 | Production |
|---|---|---|
| Nav | `QuestCategoryArtButton` cột trái (icon nav-*-v2 + label+hint) | tabs ngang filters |
| List | card list: img+name+progress tube+status small | quest-list button: img+name+status+› |
| Chi tiết | banner img + name + group; description; objectives ✓/◇ +amount; progress tube; rewards slots ×N; nút claim | `QuestFidelityDetail`: banner+desc+objectives+`VictoryFidelityRewards`+action (claim/follow/claimed) |

**Wire-now:** category nav trái; list tube; detail banner style; reward slots.

**RULING:**
- **R31.** Quest groups trong mock = 4-5 category icon buttons; prod filters là text tabs (daily/main/…). Map category ↔ filter như nào? Mock group names lấy từ nav icons → cần taxonomy quest thật.

### 3.13 FORMATION / TRẬN PHÁP (rail formation → NAV_FEATURE_LOCKED → scope-hidden; prod TranPhapPanel = OverlayPanel cũ)

G3 (`HomeFormationArtPanel`): tabs deploy/formations/rank; board 3×3 cells (item-slot-v1 + portrait + ＋/×) + current formation mini-grid + brush circle; details card (choices 9-grid list, info, position, rank progress tube); roster row slots + reset/confirm.

**RULING:**
- **R32.** Formation có mock ĐẦY ĐỦ mặc dù scope-hidden — khi mở scope, design đã có sẵn. Hiện tại rail icon = forever-locked; wheel slot formation_slot → realm (?). Confirm giữ lock, design sẵn sàng khi mở.
- TranPhapPanel prod = overlay cũ với formation slots assignment + AtlasIdleSprite — wire khi scope mở.

### 3.14 VENDOR (rail vendor → leftPanelMode=vendor → VendorPanel OverlayPanel cũ)

**G3 mock KHÔNG TỒN TẠI** — rail icon `navigation-vendor-v2.png` có, nhưng `activePanel` union của LandscapeDesignPreview không gồm 'vendor'.

Prod VendorPanel: description + sell-card (resource rows bán lấy linh thạch, qty input, total, nút bán) + ConfirmModal. Sell-only, không có buy list.

**RULING:**
- **R33.** Vendor chưa có design duyệt — cần mock mới hay port tạm style paper? (wire-now: mount VendorPanel vào paper shell như siblings, giữ sell-card.)

### 3.15 FEEDBACK (rail feedback → local dialog)

G3 `HomeSupportArtPanel kind='feedback'` = help panel 5 nhóm. Prod: dialog cục bộ trong DongFuStage.
**R34.** Feedback = full support panel (mock) hay giữ dialog nhỏ?

### 3.16 Non-rail surfaces

- **worker_lodge** (Chi Hiên Quán → worker_lodge, scope-hidden manualWorkforce): 3 tab QuaTang/ChieuMo/DuyenPhan + capacity card — under beta renders nothing. No mock. → giữ ẩn.
- **scripture_pavilion** (Tàng Kinh Các): wheel-catalog entry duy nhất (không building, không rail icon) → LoreCodex overlay. No mock. **R35:** thêm rail icon? (pack thiếu icon scripture)
- **quan_khi**: chỉ mở từ CharacterActionRail. No mock. **R13** cover.
- **artifact / companion**: scope-hidden + realm-gated; no mock. **R2** cover (rail hard-lock vs unlock predicate).
- **guild/sect/portal**: rail locked decorative, không có panel production nào → future.

---

## 4. Rulings tổng hợp (để Minh quyết khi quay lại)

| ID | Câu hỏi | Gợi ý mặc định |
|---|---|---|
| R1 | Rail-only vs khôi phục building hotspots (landmark-v1 + PcPaperLandmark có sẵn chưa dùng) | rail-only (mock đã duyệt) |
| R2 | artifact/companion trên rail: hard-lock hay realm-gated như wheel | realm-gated |
| R3 | Badge trạng thái công trình (sẵn thu/nâng cấp) lên icon rail | thêm dot |
| R4 | Thiên Cơ Bảng: restyle paper hay fold vào quest card | giữ parked, redesign riêng |
| R5 | Currency chips: icon theo tier linh thạch vs 4 loại mock | icon per tier (3) |
| R6 | Teleport array invisible trên rail | chấp nhận (wheel còn) |
| R7 | Scripture pavilion không có rail icon | wheel-only |
| R8 | Wheel/board/autofarm giữ chrome cũ tới khi có redesign riêng | giữ |
| R9 | PaperPanelNavigation top-nav trong mọi panel — giữ hay bỏ (rail đã nav)? | bỏ nav ngang, giữ nút back |
| R10 | Character talent: 1 card (mock) vs list seal (prod) | list scroll |
| R11 | Character figure: hero concept v2 vs figure.png huyen-kim | hero concept |
| R12 | Card Sức Mạnh (combatPower) | wire-now |
| R13 | Quán Khí mở từ đâu trong G3? (rail không có icon, action rail mất) | thêm nút trong card portrait |
| R14 | Decompose ở inventory (mock) vs forge (prod) | forge |
| R15 | Inventory pagination ‹1› vs scroll | scroll |
| R16 | "Trợ Giúp" = panel hướng dẫn 5 topic (KHÔNG phải form báo lỗi) vs prod chỉ có FeedbackDialog | thêm panel help mới, giữ dialog riêng |
| R17 | Equipment summary HP/ATK/DEF | giữ |
| R18 | Paperdoll dọc trái vs sockets ngang | paperdoll (mock) |
| R19 | Respec button vị trí | giữ footer meta |
| R20 | Body anatomy silhouette vs orbs/rail | cần Minh xem mock trực tiếp |
| R21 | Body details (costs/gates/extra) | giữ card phải |
| R22 | Technique manual art space | chờ art |
| R23 | Realm: timeline ngang vs map anchors | timeline (mock) |
| R24 | Nút Độ Kiếp riêng trong realm card | giữ 2 nút |
| R25 | Realm footer effects/intro | fold vào details |
| R26 | Alchemy 4 tube mastery/fire/purity/stability — có số thật không | bỏ nếu không có data |
| R27 | Herb variants radio giữ | giữ |
| R28 | Exploration mock chỉ map — details+start vẫn cần | giữ details |
| R29 | ProductionPanel promote lên paper shell | promote |
| R30 | worker-allocation block dưới scope | giữ, scope-gated |
| R31 | Quest 5 nhóm mock (Chính Tuyến/Ngày/Tuần/Thành Tựu/Thám Hiểm) vs prod chỉ chain 'mainline' + status filters (daily đã scope-lock beta) | rail giữ 5 nhóm: Chính Tuyến live, 4 nhóm còn lại "Chưa lộ" |
| R32 | Formation design sẵn sàng khi scope mở | ghi nhận |
| R33 | Vendor không có mock | paper shell tạm, chờ design |
| R34 | (xem R16) | |
| R35 | Scripture rail icon | wheel-only |
| R36 | Title art victory/defeat thiếu trong pack | giữ huyen-kim title tạm |
| R37 | Panel Trợ Giúp mới (5 topic hướng dẫn) | thêm — khác mục đích FeedbackDialog |
| R38 | Tooltips (stat-source + item inspect) mock không vẽ | giữ — hợp đồng hiện có |
| R39 | Alchemy queue strip không có trong mock | giữ strip dưới cauldron |
| R40 | System surfaces (loading/entitlement/feedback/confirm) có design riêng | wire khi tới lượt |
| R41 | 2 bản formation design (landscape 9-slot vs auxiliary pentagram) | landscape 9-slot |
| R42 | Un-mocked panels reskin Pc* hay cần mock? | reskin theo secondary; vendor cần quyết thêm |
| R43 | 9 system surfaces chưa có design (toast/announce/tutorial/pause…) | reskin Pc*, giữ z-order |

---

## 5. Ownership / chia nhỏ component — proposal

Vấn đề: 13 `Home*ArtPanel` + 8 `EquipmentArt*`/`Skill*`/`Quest*`/`ProductionSource*` primitives đang sống trong `src/ui-preview/` (preview-only, không được production import). Fidelity scenes production dùng `Pc*` + `InkNineSlice` + `PaperPanelNavigation` (common). Để wire G3 vào production theo đúng ownership:

**Bước 1 — promote primitives lên common:**
`ui-preview/equipment/{EquipmentArtButton,EquipmentArtCard,EquipmentArtSlot,EquipmentEnergyTube,EquipmentPaperdollPreview,EquipmentBagPreview,EquipmentForgePreview}.vue` + `ProductionSourceArtCard.vue` + `QuestCategoryArtButton.vue` + `QuestObjectiveArt.vue` + `SkillNodeArtButton.vue` → `components/common/art/` (hoặc `components/common/pc/`). Import nội bộ sửa từ `ui-preview/` → alias `@/components/common/art`.

**Bước 2 — mỗi surface tự sở hữu layout G3:** không mount `Home*ArtPanel` vào production (chúng là mock, hardcode data). Thay vào đó port template+CSS vào `scenes/{surface}/fidelity/` như một "G3 skin" trên cùng `*UiModel` — vd `CharacterFidelityScene` đổi shell sang panel-card layout mock nhưng vẫn nhận `model: CharacterUiModel` + emit intents. Mock files giữ nguyên trong ui-preview làm tham chiếu visual.

**Bước 3 — assets theo pack, không theo component:** mọi asset G3 đã ở `public/assets/ui/tien-hiep-2026-10/` (icons/, controls/, body/, realm/, source/, combat/, tribulation/). Component common chỉ tham chiếu `resolveAssetUrl` — không copy asset vào component dir.

**Bước 4 — mount contract giữ nguyên:** không đổi 3 seam (characterOverlayOpen / leftPanelMode / standalonePanel) và không đổi beta-scope gates ở mount — G3 skin nằm dưới fidelity layer, không chạm routing.

**Rủi ro mở ra:**
- `Home*ArtPanel` CSS dùng absolute `position:absolute;left:24%;top:12.5%` (canvas-relative) — port sang fidelity scene phải đổi thành layout trong canvas có sẵn (fidelity scene đã là absolute-inset:0 trong design canvas).
- Mock panels KHÔNG render `PaperPanelNavigation` — nếu R9 quyết bỏ nav ngang thì fidelity mất cơ chế navigate giữa các surface (rail làm việc này); nhưng prod standalone có thể mở khi không ở home? (standalone mở cả từ wheel + rail — rail luôn sẵn tại home; wheel cũng vậy) → nav ngang dư thừa, back vẫn cần.
- EquipmentPaperdollPreview/EquipmentBagPreview/EquipmentForgePreview mock chứa fake data — port = chỉ lấy shell/style, data vẫn từ equipmentUi model.

## 6. Coverage checklist (line-by-line)

Done: home (§1), character, inventory, settings, equipment, skill, body, technique, realm, alchemy, exploration, production, quest, formation, vendor, feedback + non-rail (worker_lodge, scripture, quan_khi, artifact, companion, guild/sect/portal), combat/tribulation/victory/defeat asset map (§9a), visual pass live trên 13 mock panel (§9a-2), prod-only features (§9b), preview index 25 trang (§9c), system surfaces ngoài canvas (§9d), locale audit (§8b), test-pin radius (§8c), quest taxonomy (R31).

## 10. Suggested slice order (sau khi Minh rule R1–R43)

| Slice | Nội dung | Phụ thuộc | Rulings chặn |
|---|---|---|---|
| C0-foundation | Promote primitives→common/art + rail seam đã có (2d1a2238) + inner PaperPanelNavigation gỡ mặc định | — | R9, R38 |
| C1-character | CharacterFidelity → mock layout + Chi Tiết drawer + tooltips | C0 | R11, R38 |
| C2-inventory | InventoryFidelity + detail aside + decompose decision | C0 | R14, R15 |
| C3-skill | SkillFidelity → element chips + cross tree | C0 | — |
| C4-body | BodyFidelity → silhouette | C0 | R20 |
| C5-technique | TechniqueFidelity → 4-node row | C0 | R22 |
| C6-realm | RealmFidelity → timeline + Kim Đan key | C0 | — |
| C7-quest | QuestFidelity → 5-group rail (1 live + 4 "Chưa lộ") | C0 | R31 |
| C8-alchemy | AlchemyFidelity → pill rail + cauldron + queue strip | C0 | R39 + lò đan asset |
| C9-equipment | EquipmentFidelity → 4 tab + paperdoll + tooltip | C0 | R18, R38 |
| C10-exploration | ExplorationFidelity → vista map | C0 | R28 |
| C11-production | ProductionPanel promote paper shell | C0 | R29, R30 |
| C12-settings | SettingsFidelity → 3-group rail (map 7 nhóm) | C0 | — |
| C13-help | Trợ Giúp panel mới | C0 | R37 |
| C14-secondary | reskin tran_phap/artifact/companion/worker_lodge/scripture/quan_khi/vendor | C0 | R33, R35, R42 |
| C15-combat | CombatFidelity → pack mới chrome | §9a | R36 |
| C16-tribulation | TribulationFidelity → pack mới | §9a | — |
| C17-victory/defeat | titles + chrome | §9a | R36 |
| C18-system | loading/entitlement/feedback/confirm + reskin 9 modal | C0 | R40, R43 |

Mỗi slice = 1 PR vào chuỗi sau B; chỉ mở khi rulings tương ứng đã quyết.

## 7. Asset audit (mọi file mock tham chiếu — đã kiểm tồn tại trong `public/`)

**Có đủ:** `controls/` (attribute-plus-v2, character-card-nine-slice-v1+v2, equipment-{brush-circle,circle-frame,divider,filter-{normal,hover,pressed,selected}-v2,level-seal,tab-brush}, inspector-v1, item-slot-v1, landmark-v1, navigation-{backing-dark-v3,connector,landscape-seam,medallion}, resource-{coin,crystal,essence,jade}, skill-connection-pipe-v1, skill-node-{main,parent,passive,sub}-v1); `icons/` (navigation-{21 ids}-v2 + element-{metal,wood,water,fire,earth}-ivory-v1); `body/` (silhouette-{seated,upper}, anatomy-{blood,heart,vertebra}-{lit,unlit}, biceps-{l,r}-{lit,unlit}, forehead-{node,ring}-{lit,unlit}, process-{bi,cot,huyet,mach,nhuc,tang}-{lit,unlit}, meridian-{junction,node,ring,tube}-{lit,unlit}, galaxy-*-{lit,unlit}, navigation-{ren,khai,dan}-{lit,unlit}); `realm/` (landscape-1..3-v1, meditation-v1, active-card-frame-v1.svg); `source/` (shared-paper-page-v1, panel-frame-v2, ink-panel-cutout-v3, opening/world-vista-warm, …); `combat/` (21 file incl. portrait-3-state, health-*, skill-*, initiative-queue); `tribulation/` (12 file); characters/player/mortal/player-mortal-ink-sword-concept-v2.png; materials/linh_khoang.png + linh_moc.png + herbs.

**Mock dùng ảnh tái chế** (không phải asset riêng): production source-card landscapes = world-vista-warm + realm/landscape-3 + opening-vista-warm; quest list pictures = vista/landscape/meditation/materials — OK tái dùng, không cần art mới.

**Thiếu/thận trọng:**
- `huyen-kim/alchemy/alchemy-cauldron-prop@2x.png` — mock dùng asset GÓI CŨ (huyen-kim, không phải tien-hiep-2026-10). Asset tồn tại nhưng làm lộn pack — cần asset lò đan trong pack mới hoặc giữ tạm.
- Không có rail icon scripture_pavilion (R7) và không có Home*ArtPanel cho vendor (R33), worker_lodge, scripture, artifact, companion, quan_khi.
- `manual-art-space` (technique) trống — chờ art (R22).

## 8. Dữ liệu thật → mock (adapter check)

Mọi `*Surface.vue` đã build model THẬT qua `gameManager.*Ops` + `usePlayerStore` (skill: `betaSkillTreeFor` + nodeRegistry; realm: `betaNextRealmSurfaceFor` + `getBreakthroughRequirements` + ETA; technique: `getBetaTechniqueSurfaceModel` + `tryAdvanceTechniqueGrade`; body: `useBodySceneModel`; quest: `getBetaQuestSurfaceModels`). → wire G3 = đổi template/style của `*FidelityScene`, model giữ nguyên. Không cần adapter mới.

## 8b. Locale audit (2026-10-06)

`vi.json` = `en.json` = 1557 keys, parity sạch. Mock labels phần lớn đã có key thật: 'Chưa lộ' (`locked`), 'Auto lặp lại', 'Thu hoạch' (`collect`), realm names (`*.realms.{goldenCore→Kim Đan, nascentSoul→Nguyên Anh, soulTransformation→Hóa Thần, voidRefinement→Luyện Hư, tribulation→Độ Kiếp}`), 5 tab equipment (`panels.equipmentHall.tabs.{enhance,wash,refine,dissolve,decompose}`), dao-lu ('Chọn Đạo Lộ Khởi Đầu', tuKiem/tuPhap/tuThe).

**Copy mismatch:** mock ghi "**Kết Đan**" nhưng key thật = "**Kim Đan**" — cùng realm, khác tên. Ruling nhỏ: dùng key prod (Kim Đan).

**Labels mock chưa có key** (cần thêm khi wire): 'Hoạt Động' (help topic), 'Lên Cấp' (prod dùng 'Nâng Cấp'), 'Hạ Giới' (quest difficulty chip), 'Tạm khóa' (locked badge text). 36 file `src/ui-preview/*Messages.ts` (hardcoded preview-only) được thay bằng key thật khi wire — không port nguyên.

## 8c. Test-pin blast radius

~35 spec e2e, **~8 pin trực tiếp vào class/structure fidelity** (`cf-*`, `equipment-socket`, `technique-stage`, `alchemy-paper`, `quest-detail`, `paper-nav`, `item-detail` …) + 4 architecture tests (`i18nKeyParity`, `betaScopeRenderedTokens`, `betaConsumerSeamMounts`, `huyenKimChromeManifest`) + nhóm `huyen-kim-*` spec (imperial-shell/reference-fidelity/stable-art/scroll-lifecycle/fidelity-capture). Mỗi G3 slice phải kèm pin-update trong cùng PR; spec `huyen-kim-*` sẽ dần lỗi thời khi chrome chuyển pack — xếp lịch retire/repoint theo slice.

## 9a. Combat / Tribulation / Victory / Defeat (scenes, không phải panel nhưng cùng pack)

**Combat** (`CombatFidelityScene` + 6 sub): hiện toàn bộ chrome trỏ `huyen-kim` pack cũ (`panel-nine-slice`, `ornament-ring-v1`, meters). Pack mới `combat/` có manifest với semantic id → map wire-now:
- player-status-v1 (khung avatar+bars), portrait-{normal,selected,inactive}-v1 (thay ornament-ring)
- health-frame/fill + hp-caption + enemy-health (meters), initiative-queue (thanh lượt)
- skill-{tray,active,inactive,label}, item-slot, quantity-badge (skill/slot UI)
- control-{normal,hover,selected,pressed}-v1 (nút Tự Động/Thoát/strategy), expand-button, area-title

**Tribulation** (`TribulationFidelityScene` + chapters/frame/question): cũng trỏ huyen-kim. Pack `tribulation/` đủ bộ: title-plaque, chapter-plaque+tassel, question-panel, answer-{normal,hover,selected,pressed}, countdown, hp-frame, time-tube, caption-plaque. `zhou-meditation-v1.png` (huyen-kim) → `realm/meditation-v1.png` pack mới.

**Victory/Defeat**: dùng `victory-title-v1`/`defeat-title-v1` + `divider-ornament` huyen-kim — **pack mới KHÔNG có title art victory/defeat** → ruling R36 (giữ title cũ / cần art mới / dùng chung title-plaque style tribulation).

**R36.** Title art victory/defeat thiếu trong pack — giữ huyen-kim title hay cần Minh art?

## 9a-2. Visual pass (xác nhận trên preview live 2026-10-06)

Đã click kiểm từng panel trên `ui-landscape-design.html` — tất cả render đúng như code mô tả. **3 correction so với đọc code:**

1. **"Trợ Giúp" (feedback icon) KHÔNG phải form feedback** — đó là panel hướng dẫn onboarding: 5 topic rail (Bắt Đầu/Nhân Vật/Tu Luyện/Trang Bị/Hoạt Động) + card nội dung hướng dẫn ("Hành trình tu tiên", "Thao Tác Giao Diện"). Prod hiện có `FeedbackDialog` = form báo lỗi — hai thứ khác nhau. → R16 đổi: mock thêm panel HELP mới, không thay thế FeedbackDialog.
2. **Thương Hội (vendor) icon có trên rail nhưng là dead button** — click không mở gì: mock chưa có panel vendor (xác nhận R33).
3. **Quest card (góc phải header) chỉ là display** — click không làm gì trong mock. Ruling: card trên production có nên link sang quest panel?

**R37.** Panel Trợ Giúp mới — thêm vào prod (5 topic hướng dẫn) hay chỉ giữ FeedbackDialog hiện có? (Gợi ý: thêm — content dạng hướng dẫn, khác mục đích form báo lỗi.)

## 9b. Prod-only features mocks bỏ qua — keep candidates

Fidelity scenes hiện có các feature G2 mock KHÔNG vẽ — cần ruling "giữ" hay "bỏ":

| Panel | Feature prod | Mock | Gợi ý |
|---|---|---|---|
| Character | `statSources.ts` + `rowTooltip` — breakdown nguồn stat khi hover từng dòng | detail scroll phẳng, không tooltip | giữ tooltip (hợp đồng G2, data sẵn) |
| Inventory | `InventoryFidelityDetail` aside: art + desc + số lượng + nút Use | slot click không làm gì | giữ detail panel khi chọn slot |
| Equipment | `EquipmentPaperTooltip` hover inspect; 2 mode bag↔forge + 5 tab forge (enhance/temper/refine/dissolve/decompose qua ForgeBatchBag/Workspace) | 4 tab đơn giản, không tooltip | giữ tooltip + 5 mode (decompose ở forge vẫn đúng R14) |
| Alchemy | `AlchemyPaperQueue`: hàng job đang luyện + % + nút hủy × | không queue | giữ queue strip (feature thật) |
| Quest | detail banner art + ✓/◇ objectives + rewards + claim/follow action | gần giống (có card chi tiết + Nhận) | aligned |
| Technique | stages + mastery bar + sections rows + artifact book | 4-node + detail card | aligned (4 node = stages) |
| Settings | ~7 nhóm (account/audio/build/feedback/language/save/uiScale/update) | 3 nhóm | map cả 7 nhóm prod vào rail mock |
| Realm | passives "Hiệu Quả Đã Nhận" + Giới Thiệu footer | có sẵn trong mock | aligned |

**R38.** Tooltip inspect: character stat-source tooltip + equipment item tooltip — giữ trong G3 skin? (mặc định: giữ, đã là hợp đồng a11y/tooltip hiện có)

**R39.** Alchemy queue strip — mock không vẽ vị trí; giữ strip dưới cauldron (vị trí hiện tại) hay gộp vào card chi tiết? (mặc định: giữ strip)

## 9c. Preview page index + design ngoài landscape mock

25 trang `ui-*.html`. `ui-landscape-design.html` = mock G3 đã duyệt (13 panel, surveyed §3). Các trang còn lại:

**Design cho surface KHÔNG có trong landscape mock:**
- `ui-system-design.html` — 5 ví dụ: **màn loading** (title + progress bar), **FeedbackDialog G3** (category chips + fields + report inspector), **TalentEntitlementModal** (newTalent + upgrade row + mandatory note — prod có `TalentEntitlementModal.vue`), ConfirmModal, incompatible dialog.
- `ui-auxiliary-design.html` — 4 ví dụ: **formation pentagram** (ngũ hành 5 điểm + inspector effects/costs + apply — KHÁC hẳn formation ở landscape mock!), tooltip, dialog, settings 5-category rail.
- `ui-secondary.html` — reskin REAL prod components: TranPhapPanel, ArtifactPanel, CompanionPanel, worker-lodge tabs (ChieuMo/DuyenPhan/QuaTang), Tooltip, OverlayPanel, ConfirmModal, OfflineSummaryModal, LoreCodexModal (gồm cả surface release-hidden). → design target cho các panel KHÔNG có Home*ArtPanel = reskin Pc* trên component hiện có, không layout mới.
- `ui-design-review.html` — index/liệt kê.

**Design exploration cũ (trước landscape mock):** combat-outcome-design (combat + turn log + victory/defeat + breakthrough variants), collection-craft-design (alchemy/forge), character-progression-design (character + path choice), dong-fu/secondary-standalone.

**Per-panel preview pages** (đối chiếu từng surface): ui-{character,skill,equipment,forge,body,technique,realm,inventory,alchemy,exploration,quest,settings,combat,tribulation,victory,defeat}.html — cùng nguồn gốc G2-solo, tham khảo khi wire từng slice.

**Vendor:** vắng mặt ở CẢ secondary preview — không có design nào cả (R33 tăng mức).

**R40.** System surfaces có design riêng: loading screen + TalentEntitlementModal + FeedbackDialog + ConfirmModal — wire theo style system-design khi tới lượt (không cần ruling mới, chỉ xếp slice).
**R41.** HAI bản formation design xung đột: landscape = lưới 9 ô + roster tabs vs auxiliary = pentagram 5 điểm + apply. Minh chọn một — gợi ý: landscape 9-slot (khớp model tran_phap hiện tại hơn?).
**R42.** Un-mocked panels (tran_phap/artifact/companion/worker_lodge/quan_khi/scripture/artifact) wire theo kiểu secondary: reskin Pc* lên component hiện có, giữ layout. Vendor không có ở đâu cả → cần mock mới hoặc reskin mù.

## 9d. System surfaces (mount ngoài canvas — Teleport/App overlays)

| Surface | Mount | Design có? |
|---|---|---|
| Loading/boot | App | ✓ system-design (title+progress) |
| FeedbackDialog | DongFuStage→body | ✓ system-design (5 fields + report) |
| TalentEntitlementModal | GameRoot | ✓ system-design |
| ConfirmModal | body Teleport | ✓ system-design (+ secondary) |
| Save-incompatible dialog | body | ~ system-design 'incompatible' |
| Tooltip | body Teleport (contained opt) | ~ auxiliary tooltip example |
| OfflineSummaryModal | GameRoot | ✗ |
| ToastContainer | body | ✗ |
| ActionFeedbackLog | body | ✗ |
| WorldAnnouncementOverlay | in-flow | ✗ |
| TutorialOverlay | GameRoot | ✗ |
| CombatPauseOverlay | App | ✗ |
| PresentationTransitionOverlay | App | ✗ |
| BetaCompletionModal | App | ✗ |
| GuestAbandonDialog | panel | ✗ |

**R43.** 9 surface ✗ (offline summary, toast, action log, announcement, tutorial, pause, transition, beta-completion, guest-abandon) không có design — reskin Pc* mặc định hay cần mock? (Gợi ý: reskin — đều là modal/overlay đơn giản; overlay z-order/OVERLAY_LAYERS giữ nguyên.)

## 9. Dormant files (cũ còn, mới chưa dùng / mới có cũ vẫn sống)

- `scenes/character/Character*.vue` (7 file vùng cũ: IdentityHeader/FigureWheel/MainStats/…) — dormant, CharacterPanel→CharacterSurface→fidelity. Giữ hay xóa?
- Tương tự `scenes/realm/Realm*.vue` (9 file), `scenes/quest/{list,tabs,detail}/`, `scenes/settings/Settings*Section.vue` (8 file), `scenes/creation/Creation*.vue` + `TalentCard.vue` — dormant sau fidelity.
- `scenes/dong-fu/fidelity/{DongFuHomeContent,DongFuVista,DongFuHud,DongFuWheel}` — vista/hud dormant; wheel ĐANG DÙNG (Backquote).
- `ui-preview/Home*ArtPanel` — mock, không production (giữ làm reference hay move sang scenes khi port xong?).


