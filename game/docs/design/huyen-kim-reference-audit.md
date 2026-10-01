# Huyền Kim Sơn Thủy — Reference Forensic Audit

Baseline: `devin/frontend-ready` @ `e9cb0dd6` (worktree `.agent-worktrees/huyen-kim-frontend`).
Design viewport: **1672 × 941** (normalized; all reference images are 1024×576 or 1024×384 composites — coordinates here are given as normalized fractions, the layout spec converts to px).
Authority order per mission §4: repository/domain > canonical beta scope > discovery authority > reference composition.

Classification legend: **EXACT** (block maps cleanly to a real surface) · **CORRECTED** (composition kept, content/function replaced) · **FUTURE_IMPLEMENTED** (real system, beta-hidden) · **RESERVED** (architecture slot, no contract yet) · **INVALID** (AI-invented, does not survive).

## 0. Reference set

| img | file suffix | content |
|---|---|---|
| R00 | `-0` | Character Creation (full scene) |
| R01 | `-1` | Realm (full scene) |
| R02 | `-2` | Character (full scene) |
| R03 | `-3` | Login (full scene) |
| R04 | `-4` | Body — Luyện Thể (full scene) |
| R05 | `-5` | Skill (full scene) |
| R06 | `-6` | Technique (full scene) |
| R07 | `-7` | Combat (full scene) |
| R08 | `-8` | Exploration / Sơn Hà Đồ (full scene) |
| R09 | `-9` | Động Phủ home (full scene) |
| R10 | `-10` | Settings (Imperial Scroll shell) |
| R11 | `-11` | Defeat (Ceremonial Scroll) |
| R12 | `-12` | Quest (Imperial Scroll shell) |
| R13 | `-13` | Alchemy (full scene) |
| R14 | `-14` | Victory (Ceremonial Scroll) |
| R15 | `-15` | Tribulation (full scene) |
| R16 | `-16` | Equipment / Trang Bị (full scene; contains the only inventory grid) |
| R17 | `-17` | Composite: Tribulation, Victory, Defeat, Settings, Quest |
| R18 | `-18` | Composite: Skill, Body, Exploration, Alchemy, Equipment, Combat |
| R19 | `-19` | Composite: Login, Creation, Home, Character, Realm, Technique |

Scene coverage: 17/18 scenes have direct references. **Inventory has no standalone reference** — the only bag-grid depiction lives inside R16 (right-hand grid). Inventory is derived from the same component grammar (mission §16-09).

## 1. Global blocks (recur across scenes)

| Ref block | Class | Repo evidence |
|---|---|---|
| Top-left identity card (avatar + name + realm + cultivation bar) | EXACT minus VIP | `GlobalTopBar.vue` identity button → `ui.openLeftPanel('character')`; PlayerPortrait + realm line + cultivation progress. **VIP badge is INVALID** (no VIP system). |
| Top-right resource pills | EXACT(count corrected) | `CurrencyHud.vue` = 3 spirit-stone tiers (`SPIRIT_STONE_MATERIALS`: Hạ/Trung/Thượng phẩm Linh Thạch). Refs draw 4 pills — 4th resource is invented. |
| Top-right utility seals (Thư/Sự Kiện/Cửa Hàng/Cài Đặt) | CORRECTED | Real utilities: AutoFarmIndicator, Feedback (Thư-like but is feedback dialog), Túi Đồ (bag → inventory), Cài Đặt. "Sự Kiện"/"Cửa Hàng" are INVALID (no event/shop domain). |
| Vertical side-nav rail inside scroll | EXACT pattern | Matches mission §7 side-navigation safe area; items must be real panel ids (see per-scene lists). |
| Ornate close seal (✕ top-right) | EXACT | `OverlayPanel.vue` close affordance. |
| Section titles with red seal stamp | EXACT | Decorative seal + app-rendered text; seal art only. |
| Building plaques on world (vertical hanging tags) | EXACT pattern, CORRECTED content | `HomeBuildingIcons.vue` + `DongFuBuildingArt.scenePlacement` — beta buildings = pill_room, gathering_outpost, teleport_array, equipment_hall, vendor (5). Ref invents ~10 (Tông Môn, Bí Cảnh, Linh Điền, Thư Viện, Cửu Trần Mậu Trận…) → those are INVALID names; `chi_hien_quan` is scope-hidden (`BETA_BUILDING_FEATURES`). |
| Scroll outer shell w/ carved rollers + lantern ornaments | EXACT | Becomes `ImperialScroll` shell family (mission §6-B/§7). Rollers + body + frame + plaque are shared assets. |

## 2. Per-scene audit

### 01 — Login (R03)

| Block | Class | Note |
|---|---|---|
| Full-bleed vista (moon/cliff/cultivator) | EXACT (backdrop art — gameplay-art excluded) | `InkWashBackdrop` / world backdrop; not UI inventory. |
| Right anchored scroll card (~38–42% width) | EXACT | Composition: form lives in a scroll panel, not a floating modal. |
| "Tu Tiên IDLE" brush logo + seal | EXCEPTED | Only baked-text art allowed is a separately-approved logo; else app-rendered title. |
| Đăng Nhập / Đăng Ký tabs | EXACT | `AuthEntryScreen.vue` mode tabs. |
| ID + password fields w/ icons | EXACT | `isValidLoginId`/`isValidPassword`; eye-toggle is minor chrome (RESERVED detail). |
| "Ghi nhớ đăng nhập" checkbox | **INVALID** | No remember-me API. |
| "Quên mật khẩu?" link | **INVALID** | No reset flow exists. |
| Đăng Nhập primary button | EXACT | submit / authenticate. |
| "— Hoặc —" divider | EXACT | `divider-ornament`. |
| "Tiếp Tục" + "Chơi Khách" buttons | EXACT | `continueSaved()` (resume candidate) + guest auth. |
| Language selector | EXACT (chips, not dropdown) | `LOCALE_OPTIONS` chips; same slot position. |
| (not in ref) Guest upgrade card, cross-account confirm, reset/credential notices | EXACT additions | `GuestUpgradeCard`, `ConfirmModal`, durable-error notice — real states the spec must keep. |

### 02 — Character Creation (R00)

| Block | Class | Note |
|---|---|---|
| Left world art / right scroll panel split | EXACT | Creation panel becomes a scroll; art side is backdrop. |
| "Đạo Danh" name input | EXACT | `isValidCharacterName`, maxlength 20. |
| Dice/random-name button | **INVALID** | No random-name API; remove. |
| "Thiên Phú" — 3 art talent cards | CORRECTED | Real roll = **9 talents** (`CHARACTER_CREATION_ROLL_SIZE = 9`); pick exactly 1; cards are text+seal, reroll button exists. Talent art = excluded gameplay art; card chrome = UI. |
| "Kỹ Năng Khởi Đầu" selector | **RESERVED** | Beta starter is fixed (`linh_bao` / `BETA_MORTAL_STARTER_SKILL_ID`); keep the slot in the full-product architecture, hidden in beta. |
| "Bắt Đầu Hành Trình" CTA | EXACT | `creation-finish`; summary line ("name + talent") precedes it. |
| Back button | EXACT | top-left ghost. |

### 03 — Động Phủ (R09) — primary composition anchor

| Block | Class | Note |
|---|---|---|
| Identity card top-left (hex avatar, name, realm, HP bar, VIP) | CORRECTED | `GlobalTopBar` identity (avatar+name+realm+cultivation bar). HP bar → cultivation progress. VIP INVALID. |
| 4 resource pills + utility icons (Thư/Sự Kiện/Cửa Hàng/Cài Đặt) | CORRECTED | 3 pills + AutoFarm/Feedback/Bag/Settings. |
| ~10 building plaques | CORRECTED | 5 beta buildings at authored `scenePlacement` anchors (pill_room 13%/58%, equipment_hall 25%/45%, gathering_outpost 68.5%/45.5%, vendor 80%/46%, teleport_array 90%/80%); chi_hien_quan scope-hidden. |
| Central cultivation dais (Đạo Luân platform + cultivator) | EXACT | `home-player` trigger + `PlayerPortrait` cultivate variant + CSS rings (`home-linhnhan`). |
| Radial command wheel (~9 orbit nodes) | EXACT pattern / CORRECTED labels | `DongFuCommandWheel` — 2 orbits (inner = ring-1 cultivation core, outer = rings 2–4); slots from `betaWheelSlots()` — scope-hidden slots (phap_bao/formation/companion/talisman) absent; "Tạo Nhân Vật"/"Thế Giới" labels INVALID; exploration enters via teleport_array building plaque/StageSelect. |
| Thiên Cơ Bảng right drawer | EXACT | `ThienCoRail.vue` (breakthrough/quest/ready/active/upgradeable kinds, entry CTA). Daily-quest rows = cadence 'daily' → scope-hidden. |
| Bottom-left chat strip (server/sect/system) | **INVALID** | No chat domain. (Keep zero reserved space.) |
| Bottom-right quest tracker chip | EXACT → real equivalent | Quest HUD chip maps to beta quest surface (`questOps.getBetaQuestSurfaceModels`); new component candidate, not an existing one. |

### 04 — Character (R02)

| Block | Class | Note |
|---|---|---|
| Left nav rail: Nhân Vật/Túi Đồ/Kỹ Năng/Luyện Đan/Công Pháp/Đồng Hành | CORRECTED | Maps to real scroll side-nav (character/inventory/skill/alchemy/scripture…); Đồng Hành = companion → FUTURE_IMPLEMENTED (hidden). |
| Identity header (name, Lv, realm/floor, seals) | EXACT | `CharacterPanel` header (name/realm line/combat power + talent seals). "Môn Phái/Danh Hiệu" rows INVALID (no sect/title fields). |
| Central portrait + 5-disc Ngũ Hành wheel | EXACT | `element-wheel` (existing `el-formation-orbs`/`el-formation-ring` assets) + element % from player stats. |
| "Chiến Lực" plaque | EXACT | combatPower. |
| "Thuộc Tính Chính" 5 main stats w/ allocate | EXACT | 5 main stats + attribute points + MAX caps (meridian node cards). |
| "Thiên Phú" card | EXACT | talent seals + detail card. |
| "Ngũ Hành Tổn Tất" (element %) | EXACT | element wheel + % summary. |
| Right "Chi Tiết" derived-stat drawer | EXACT | `CharacterDetailCard` — real derived stats replace invented numbers. |
| Meridian progression here | INVALID for this scene | Real feature lives in Body (mission §16-04). |

### 05 — Realm (R01)

| Block | Class | Note |
|---|---|---|
| Left rail (Cảnh Giới active / Tu Luyện / Công Pháp / Kỵ Ngộ) | CORRECTED | Realm scene's internal nav = realm/body/technique siblings are separate scrolls; inside Realm keep ladder + detail only. "Kỵ Ngộ" → Thiên Cơ surface (not a tab). |
| Vertical ascent path of nodes 1–18 over vista | EXACT (into scroll content) | 18 tầng per realm; node track = per-level milestone column. Realm rungs come from `betaRealmLadderNodes()` (mortal→…→Trúc Cơ; no Kim Đan teaser). Vista sits INSIDE the scroll content region. |
| Realm milestone banners (Trúc Khí/Trúc Cơ) | EXACT concept | Realm-transition markers along the ladder. |
| Right card: realm icon, Tầng n/18, desc | EXACT | `RealmPanel` cultivator rail (name/realm line). |
| Tu Luyện Tiến Độ bar + Tốc Độ + ETA | EXACT | cultivation bar, rate/h, ETA exist. |
| "Thuộc Tính Tầng Hiện Tại" 6-stat grid | CORRECTED | Realm passive rows come from `realmStatPassiveRows` (realm passives), not invented fixed ±%. |
| "Thiên Phú Cảnh Giới" | EXACT | Realm passive block. |
| "Điều Kiện Đột Phá Tầng N" chips | EXACT | `BreakthroughRequirementPanel` requirements (met/unmet). |
| "Đột Phá Tầng N" CTA | EXACT | `realmAdvanceOps` breakthrough; disabled state carries reason. |

### 06 — Technique (R06)

| Block | Class | Note |
|---|---|---|
| Left info card (Công Pháp title, name, Phẩm rank, effects) | EXACT | Active technique only — the canonical technique today lives on `TechniqueBand` inside `SkillPathPanel`; Technique scene promotes it to a full scroll. No way-selector tabs (mission §16-06). |
| Central book/scroll artifact on dais | EXCEPTED prop | Technique content illustration = gameplay art (excluded); the dais/plinth dressing is optional scene art. |
| "Cảnh Giới Công Pháp" rank track (7 nodes) | CORRECTED | Technique grade progression track — real grades come from technique domain (not realm names Luyện Khí→Độ Kiếp; those labels are AI-wrong). |
| Right "Tăng Rank" compare panel (old vs new stats) | EXACT | Grade/rank upgrade preview + material cost rows + Linh Thạch bar + CTA. |
| Material requirement cards | EXACT | Material chips w/ owned/needed (items excluded as art). |
| Sword/Spell/Body library tabs | **INVALID IA** (absent anyway) | No browsing library; `LoreCodex` (Tàng Kinh Các) is a separate lore surface — RESERVED secondary tab, not technique switching. |

### 07 — Skill (R05)

| Block | Class | Note |
|---|---|---|
| Left identity card "Pháp Tu • Hỏa Hành" | EXACT | `wayIdentity` — active way + committed element (`SkillPathPanel` subtitle + element tabs). |
| Radial tree: center core + orbit nodes | EXACT pattern / CORRECTED data | Center = technique/way core (`NativeCoreDetail`/TechniqueBand); orbit = `NodeTreePanel` branch nodes for committed element. Pre-commitment shows Ngũ Hành initiation structure. |
| Node padlock overlays + connecting lines | EXACT | `rune-node` states (locked/available/learned/max) + runtime edge strokes. |
| Right detail card (name, role tag "Kỹ Năng Cơ Bản", Lv n/N, current vs next effect, cost rows, "Tăng Cấp") | EXACT | `SkillDetailView` + `NodeInspector` — costs use real currencies (skill insight etc.), invented "Hỏa Nguyên Quyển" replaced. |
| Role grammar (Basic/Special/Ultimate/Passive-Core) | EXACT w/ beta filter | `betaScopeSkillDomain` — ultimate hidden, special locked until unlock; full-product grammar kept. |
| Insight counter "✦ Ngộ Tính" | EXACT | header `skillInsight` chip. |

### 08 — Body (R04)

| Block | Class | Note |
|---|---|---|
| Left rail: Luyện Thể / Bát Mạch / Chu Thiên | EXACT | The 3 body chapters = `body_refinement` (Luyện Thể, base-stat tiers) → `meridian` (Bát Mạch, one-shot openings + pages) → `zhou_tian` (Chu Thiên circulation). `BodyChapter.ts` registry order IS the progression chain. |
| Central cultivator + orbiting meridian orbs | EXACT | Meridian map = node ring (dao-luan-node family); Nghịch Chu Thiên sub-state is DISCOVERY-HIDDEN until unlocked. |
| Tầng selector chips (1–5) | EXACT | Tier/page selector per chapter (locked = ink + lock). |
| Right card: stats gained + material requirements + CTA | EXACT | Invest/progress contract per chapter; costs from chapter definition. |
| "Luyện Thể" CTA (jade) | EXACT | Chapter invest API. |

### 09 — Inventory (no dedicated ref; inside R16)

| Block | Class | Note |
|---|---|---|
| Category tabs (Tất Cả/Vũ Khí/Phòng Cụ/Phụ Kiện/Nguyên Liệu) | CORRECTED | Real sections = Equipment / Material / Pill (`bag-sections/`). No technique category (mission §16-09). Future categories RESERVED. |
| Dense icon grid (6×5) w/ rarity borders + level + lock + element corner | EXACT | `BagGrid` + `SlotView` (slot chrome stays slice-free per state matrix §2.6 — rarity tint via tokens). |
| "Dung Lượng 86/240 +" capacity + Sort/Filter | EXACT pattern | Bag capacity + existing sort/filter controls (`BagPaginationControls`). |
| Item detail/compare card | EXACT | Existing tooltip/detail surface via SlotView. |

### 10 — Exploration / Sơn Hà Đồ (R08)

| Block | Class | Note |
|---|---|---|
| Painted landscape map w/ 3 chapter tracks | EXACT pattern / CORRECTED structure | Real data: **1 zone `thanh_van`, 3 chapters × 10 stages** (`Stages.ts`: mortal ch.1, qi_refining ch.2, foundation ch.3). Map painting = gameplay world background (excluded); node track + plaques = UI. Multi-zone rail = RESERVED. |
| Left zone card + circular chapter icons | CORRECTED | Zone selector exists but only 1 zone ships in beta — rail reserved for full product; chapter selector chips real. |
| Numbered stage nodes + floor-10 BOSS nodes | EXACT | `bossEnemyId` on floor 10 per chapter; node states locked/available/cleared/perfect + boss marker (`isBetaStageSurface` via `getStageSurfaceModels`). |
| Right detail: stage art, enemies, rewards, power check, mode toggles | EXACT / CORRECTED | Stage detail = `StageSelectPanel` right pane. Modes = **manual / repeat / progress / perfect_farm** (4). "Thủ Công/Tự Lập/Tự Vượt Ải/Càn Quét Hoàn Mỹ" ≈ same four — labels corrected. "Lượt khiêu chiến 10/10" = invented (no attempt counter) → INVALID unless stamina ships. |
| Bottom progress track + chest milestones (10/20/30) | RESERVED | Zone progress bar is natural (30 stages); chest rewards have no contract → RESERVED. |

### 11 — Alchemy (R13)

| Block | Class | Note |
|---|---|---|
| Side rail (Luyện Đan active + Luyện Khí/Luyện Phù/Chế Tạp/Thu Thập) | RESERVED | Only Luyện Đan exists; sibling professions are future (gathering maps to `gathering_outpost` building, not this panel). |
| Recipe filter chips (Tất Cả/Tăng CG/Trị Liệu/Thuộc Tính) | **INVALID** for beta | `AlchemyRecipe` has no category field. RESERVED for full product. |
| Recipe list column | EXACT | `AlchemyView` recipe rows (name, herb count, grade). |
| Central cauldron + material slots | **UI SCENE PROP** (Ruling 02) | Owned by UI Art Agent as `alchemy-cauldron-prop`. Pure decorative scene dressing — no gameplay/item/world-building identity, no stats. |
| Right detail: materials, fuel, stone cost, duration, preview | EXACT | Real: herb variants radio (owned/enough), fuel wood row, spirit stone row, duration, outcome preview ("chắc chắn N + X% thêm"). |
| "Số Lượng Luyện" stepper | **INVALID** | `startAlchemyJob` has no quantity param. |
| Job queue strip "Hàng Chờ (3/4)" + progress + cancel | EXACT minus extras | `getAlchemyJobs` + `maxJobSlots` from building level; cancel exists; ⏩ fast-forward INVALID; "Mở thêm hàng chờ 200" INVALID (slots from building upgrade only). |

### 12 — Equipment / Khí Đường (R16)

| Block | Class | Note |
|---|---|---|
| Left rail ops: Trang Bị/Cường Hóa/Tẩy Luyện/Tinh Luyện/Dung Hợp/Phân Giải | EXACT pattern / CORRECTED labels | Real ops: **enhance, wash, refine, dissolve, decompose** (`isBetaEquipmentTab` → beta shows enhance + dissolve only; others FUTURE_IMPLEMENTED). Ref's "Dung Hợp/Phân Giải" ≈ dissolve/decompose wording drift; a 6th op would be INVALID. |
| Paperdoll w/ equipment slots around figure | EXACT (count corrected) | `EquipmentPaperdoll` = **6 slots**: helmet, necklace, ring, weapon, armor, boots (ref draws ~10). Slot state carries enhance level even when empty. |
| Selected item card (name +N, grade chip, stars, main/affix stats, flavor) | EXACT | Equipment detail from `equipmentOps.getSlotState` + affixes; grade chip = `professionGradeRank`. |
| Inventory grid + category tabs + capacity | EXACT (categories corrected) | Shares BagGrid grammar (scene 09). |
| Bottom derived-stats strip + set-bonus row | RESERVED | "Huyền Thiên (6/6)" set bonuses = no set domain in beta; stat strip duplicates Character → keep as optional secondary region (RESERVED). |

### 13 — Combat (R07)

| Block | Class | Note |
|---|---|---|
| Top-center stage banner (Chương/Màn + "Hiệp 2/10") | CORRECTED | `CombatTopBar` = zone•stage title + `spawned/total` progress (or hidden-trial survival banner). Round count exists (`roundsElapsed` in TurnOrderStrip) — "Hiệp n/m" maps to round counter, not wave limit. |
| Top-right x2 speed / Tự Động / pause | CORRECTED | Pause overlay + exit-confirm exist; manual/auto toggle lives on skill bar (`combatInputMode`); **no battle-speed control** — x2 INVALID. |
| Top-left player HUD (avatar, HP/MP, buff icons) | EXACT | `PlayerHudLayer` (canvas): HP bar + MP/Kiếm/Thế/Ward sub-bars + Thế pip row; buff icons = buff strip (real). |
| Turn-order portrait strip under top center | EXACT | `TurnOrderStrip` — ATB gauge fill per chip, party HP, perfect-clear round limit. |
| Left AI panel (target radios) | EXACT (count) | `CombatAiPanel` — **5 strategies**: nearest/boss_first/elite_first/lowest_hp/highest_hp (ref shows 4). |
| Right vertical skill dock (circular ornate buttons) | EXACT | `CombatSkillDockPanel` → `TurnCombatSkillBar`: role slots from `betaCombatRolesFor` — beta = Basic+Special (Ultimate scope-hidden); cooldown mask, resource-cost block, awaiting-choice pulse. Q/W hotkey badges unverified → RESERVED detail. |
| Enemy HP bars + damage numbers | EXACT (canvas) | Entity-bar chrome family for canvas/DOM parity. |
| Battlefield (grid, actors, VFX) | excluded | Gameplay art. |

### 14 — Tribulation (R15)

| Block | Class | Note |
|---|---|---|
| Chapter tracker (3 step medallions) | EXACT | `active.chapterIndex/chaptersTotal` + `chapterName` — sequential, NOT user-selectable. Step count is dynamic (chaptersTotal). |
| "Độ Kiếp tầng 9" card / Tiến độ 2/3 | CORRECTED | Realm label from tribulation state; progress = chapter x/y. |
| Left status card (timer, Tâm Ma %, attempt count) | CORRECTED | Real fields: `questionSecondsRemaining`, `lightningStrikesTaken`. "Độ Tâm Ma 72%"/attempt counters invented → replaced by strikes + timer. |
| Mind question card w/ A–D answers | EXACT | `currentQuestion` + `answerQuestion(index)`; answer count dynamic (repo renders `answers[]` — not fixed 4). |
| Bottom bars (Đạo Tâm + Linh Lực) + 8 pips | CORRECTED | Real: single HP bar (`hp/maxHp`) + strikes counter; second resource bar INVALID; pips → chapter/strike markers. |
| Bottom quick-nav (Nhân Vật/Túi Đồ/Kỹ Năng/Trận Pháp) | **INVALID** | Tribulation is immersive; Trận Pháp scope-hidden. |
| Tự Động / Bỏ Qua controls | **INVALID** | No auto/skip contract for tribulation chapters. |
| Result overlay (victory/defeat text) | EXACT | `isFinished` + result title/text. |

### 15 — Victory (R14)

| Block | Class | Note |
|---|---|---|
| Horizontal ceremonial scroll w/ jade rollers | EXACT | `surface-xl-scroll` + rollers family; `CombatVictoryPanel` already uses scroll surface + ceremony frame. |
| Giant "Thắng" calligraphy + subtitle | EXCEPTED-text | Rendered by app (title), not baked into art; the brush backdrop flourish is ornament. |
| Reward slot row (7 slots) | EXACT | `RewardList` / `getBattleRewardSummary()` — slot count dynamic. |
| "Tăng Trưởng" growth cards (EXP/Tu Vi/Độ Thân Mật) | CORRECTED | Real rewards = cultivation, skillInsight, spiritStone, items (RewardList kinds). "Độ Thân Mật" = companion intimacy → FUTURE_IMPLEMENTED hidden. |
| "Thử Lại" + "Tiếp Tục" actions | EXACT | refight + continue; auto-mode countdown variant exists. |
| Bottom-left "Hệ Thống" log lines | EXACT | `BattleLogPanel` system/battle feed (not chat). |

### 16 — Defeat (R11)

| Block | Class | Note |
|---|---|---|
| Same ceremonial scroll, cinnabar treatment | EXACT | `CombatDefeatPanel` (cinnabar frame tint). |
| "Nguyên Nhân Thất Bại" hint | EXACT | `isCultivationGap` → cultivate vs gear hint text. |
| "Thưởng Nhận Được" partial rewards | EXACT | `hasAnyReward` + RewardList. |
| "Thử Lại" (danger) + "Trở Về" actions | EXACT | retry 3s countdown (repeat mode) + return-home 10s fallback. |

### 17 — Settings (R10)

| Block | Class | Note |
|---|---|---|
| Imperial scroll w/ left nav rail | EXACT shell | Target shell for all major panels. |
| Rail: Chung/Âm Thanh/Hiển Thị/Ngôn Ngữ/Lưu Trữ/Tài Khoản(+Cập Nhật/Hỗ Trợ) | CORRECTED | Real groups: Language chips, UI scale options, Audio (music/sfx/ui sliders), Save (save/reload/export/import/reset + last-saved), Account (guest upgrade/logout/abandon), Feedback, Updates (electron only), Build info. Ref's brightness/mouse-sensitivity/FPS/graphics-quality/resolution/V-sync/voice-language controls = **INVALID** (no such APIs); "Hiển Thị" section = RESERVED (graphics quality is RESERVED per mission §5). |
| Slider rows + toggle rows + dropdowns | EXACT controls | Slider + toggle + chip control families = real primitives needed. |
| Footer: Khôi Phục / Hủy / Lưu Cài Đặt | CORRECTED | Repo applies settings live; explicit Save/Reset pattern exists for save actions — footer actions = RESERVED (confirm flows per action, not a global save). |

### 18 — Quest (R12)

| Block | Class | Note |
|---|---|---|
| Tab row (Tất Cả/Chính Tuyến/Phụ Tuyến/Ngày/Tuần) + left category rail (incl. Thành Tựu) | CORRECTED | Real taxonomy = cadence `once | daily` + realm gates; beta renders `once` group only. Ngày/Tuần = FUTURE_IMPLEMENTED (daily cadence exists in domain). Chính/Phụ Tuyến & Thành Tựu = RESERVED (no field). |
| Quest list rows (icon, name, type chip, Lv, desc, progress, ✓) | EXACT | `QuestPanel` rows — progress bar, reward chips, claim button. |
| Right detail: objectives checklist + reward row + flavor + CTA | EXACT | `BetaQuestSurfaceModel` — objectives = condition (collect/kill) + turn-in shortfall; CTA = **claim** only ("Tiếp Tục Nhiệm Vụ" deep-link = RESERVED). |
| "Lời Dặn" flavor quote | EXACT pattern | description field. |

## 3. Reference errors corrected (consolidated)

1. Login: remember-me + forgot-password removed (no APIs).
2. Creation: dice button removed; talent roll = 9 not 3; starter-skill selector hidden (fixed starter).
3. Home: VIP badge removed; utilities = farm/feedback/bag/settings; building plaques = 5 authored buildings; chat strip removed entirely.
4. Realm: fixed ±% stat grid → realm passive rows; realm-name grade track on Technique → technique grades.
5. Character: Môn Phái/Danh Hiệu rows removed; 6th stat not invented (5 mains).
6. Skill: invented currencies replaced by skill insight/materials; ultimate slot hidden in beta.
7. Body: orb labels → real meridian/page names; hidden Nghịch Chu Thiên stays discovery-hidden.
8. Exploration: zone rail reduced to real zones (1 now, rail reserved); attempt counter removed; mode labels = manual/repeat/progress/perfect_farm.
9. Alchemy: quantity stepper removed; fast-forward and paid slot unlock removed; recipe categories removed (beta); job cap from building level.
10. Equipment: slot count 6 (not ~10); ops = enhance/wash/refine/dissolve/decompose, beta renders enhance+dissolve; "Dung Hợp" folded into dissolve.
11. Combat: AI options = 5 real strategies; x2 speed removed; no wave counter (spawned/total + round).
12. Tribulation: no auto/skip/nav bars; single HP bar + strikes; dynamic answer count.
13. Victory: growth cards = real reward kinds (no intimacy row in beta).
14. Settings: all invented controls removed; real sections only (language/ui-scale/audio/save/account/feedback/updates/build).
15. Quest: tabs → cadence groups; claim-only CTA.
16. Resource pills = 3 everywhere (not 4).
17. Inventory categories = Equipment/Material/Pill only.

## 4. Preserved-but-hidden (full product)

- Kiếm Tu + Thể Tu + hidden ways (Quan Khi offers beyond spell)
- Companion (roster, intimacy feed, formation synergy)
- Formation / Trận Pháp (6×6 loadout grid)
- Artifact / Bản Mệnh Pháp Bảo
- Manual workforce (Chỉ Hiền Quán / Worker Lodge)
- Daily-quest cadence
- Combat Ultimate slot + Kiếm orb-picker + Pháp Tu Ẩn emblem
- Equipment Wash/Refine/Decompose tabs
- Kim Đan and later realms (incl. artifact domain deferred past ceiling)
- Hidden beasts / hidden perfection records / Nghịch Chu Thiên

## 5. RESERVED future surfaces

- Character-creation starter-skill selector
- Zone rail + multi-zone map architecture; chapter-complete chest milestones
- Recipe categories (alchemy) and sibling professions rail
- Equipment set-bonus strip; bottom derived-stats strip inside equipment
- Quest categories (main/side/achievement) and quest "go-to" deep link; HUD quest tracker chip (new component)
- Settings display section (graphics quality/resolution) + global footer action pattern
- Building plaque upgrade/state badge variants; LoreCodex as Tàng Kinh Các second tab
- Combat speed control; keybind badges; challenge-attempt counter

## 6. Minh rulings applied (post-audit)

All four audit ambiguities are now decided and synchronized across the package:

1. **Viewport — RULING 01.** Design/reference space **1672×941**; canonical runtime layout space **1280×720** (`HD_VIEWPORT`, `presentation/viewport/HDViewport.ts`, uniform scale + letterbox). All regions are normalized to design px with % equivalents and the ~0.765 uniform mapping; no redesign around 1280×720.
2. **Alchemy cauldron — RULING 02.** `alchemy-cauldron-prop` is a **UI scene prop, UI Art Agent owned** (scene 11 focal dressing). No gameplay/item/world-building identity, no independent building stats.
3. **frame-s-slot — RULING 03.** Released from HOLD → **P0, shared, drawable, UI Art Agent owned**. Consumers: inventory, equipment sockets, rewards, materials, requirements, compact socket-like surfaces. One neutral base + runtime state/rarity treatment — no per-state rasters. `scrollbar` remains HOLD.
4. **Exploration map substrate — RULING 04.** The painted Sơn Hà Đồ geography belongs to the **gameplay/world art pipeline** — excluded from UI Art Agent ownership. UI agent owns only map chrome: frame, route lines, stage nodes (normal/boss), selected/locked treatment, chapter markers, zone labels, masks, map edge treatment, stage-detail chrome. Interim substrate fallback = `surface-m-panel`/`surface-l-ink-data` parchment inside the scroll.

Remaining ambiguities: **NONE**.
