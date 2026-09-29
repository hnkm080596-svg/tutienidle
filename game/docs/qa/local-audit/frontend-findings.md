# Frontend / Player-Info Audit — local-audit

Round: playthrough audit (human-view), branch `local-audit`. Method: Playwright-driven session at 1440×900 — auth → character creation → Động Phủ → all command-wheel panels → teleport → turn combat (Động 1). Computed-style contrast measured programmatically (WCAG 4.5:1 reference). Console/page errors captured throughout: **zero errors** (only benign AudioContext-autoplay + ReadPixels GPU warnings).

Findings use `### FE-<id> — <SEVERITY> — <title>`.

## Ledger

| ID | Severity | Surface |
|----|----------|---------|
| FE-01 | High | Tutorial overlay text unreadable (dark-on-dark) |
| FE-02 | Medium | Building panel headings invisible on ink overlay |
| FE-03 | Medium | Combat skill dock: slots crushed/invisible, dock is an empty black column pre-fight |
| FE-04 | Medium | Battle log occluded behind skill dock |
| FE-05 | Medium | No HUD on Động Phủ home — core idle loop invisible |
| FE-06 | Low | Sprite nameplate hardcoded "Player" |
| FE-07 | Low | Quest cards never show the reward |
| FE-08 | Low | Bottom-left vitals: double-overlapped HP text |
| FE-09 | Low | `.kicker` eyebrows 2.19:1 on paper bg |
| FE-10 | Low | Stage-select locked modes + no power/difficulty hint |

---

### FE-01 — HIGH — Tutorial overlay renders paper-palette text on dark scrim (≈1.2:1)

- **File:** `game/src/components/common/TutorialOverlay.vue:82-120`
- **Measured (computed):** title `color: rgb(33,31,26)` (--paper-text, near-black) on `rgba(8,9,13,0.76)` scrim → **1.21:1**; step counter `--paper-eyebrow` cinnabar → **3.64:1**; body `--paper-text-soft` similarly dark.
- **Repro:** fresh boot → guest → finish creation → `.tutorial-overlay` "Chào mừng Đạo Hữu" panel. Screenshot `07a`: title visually invisible, only a faint ghost.
- **Root cause:** overlay surfaces are ink-dark (`--scrim` + `ink-nine-slice` art), but the panel styles use the **light-paper token family** (`--paper-text`, `--paper-text-soft`, `--paper-eyebrow`). The paper→dark remap exists only inside `.ink-drawer` (`theme.css:458-470`) — this overlay is not inside it.
- **Impact:** the first thing every new player sees is illegible. Blocks tutorial comprehension (menu hint, building intro).

### FE-02 — MEDIUM — `.building-heading__name` (and sibling ink-overlay headings) render dark-on-dark

- **File:** `game/src/components/layout/FunctionOverlayPanel.vue:135` (`color: var(--paper-text, #211f1a)`)
- **Measured (computed):** "Truyền Tống Trận" title `rgb(33,31,26)` on `rgba(5,5,8,0.92)` `overlay-panel--ink` → **1.24:1**. Same pattern observed on Đan Phòng + Khai Vật Đường headers and `SettingsPanel` section labels (`SettingsPanel.vue:234/239/329` use `--paper-text*` on the ink overlay).
- **Root cause:** same class as FE-01 — `overlay-panel--ink` surfaces don't remap the paper token family; components authored for parchment inherit dark fallback colors.
- **Impact:** every building overlay's title is a ghost; players can't tell which building is open except by content.

### FE-03 — MEDIUM — Combat skill dock renders slots as ~10px slivers; dock is an empty black column outside fighting

- **Files:** `game/src/components/game/combat/CombatSkillDockPanel.vue:61-76` (fixed `width: clamp(340px,27vw,440px)`, always mounted), `hud/TurnCombatSkillBar.vue:134` (`v-if="visible"` = `isBattleFighting`), `hud/CombatSkillSlot.vue:173-176` (root has **no intrinsic size**).
- **Measured (DOM):** dock occupies `414×854` at all times. Pre-fight: `.turn-combat-skill-bar` absent → column is a black void (shot 61). During fight: slot buttons exist but measure ~10px apart at x=1039/1049/1059, y=67 (shot 60) — visually nothing renders; only the "Thủ công" checkbox shows.
- **Impact:** the entire manual-combat interaction surface is invisible. Manual mode cannot be played — slots can't be seen or aimed at; the right quarter of the combat screen is dead space.
- **Note:** `CombatSkillSlot` root is `position: relative` with no width/height; if all children are absolutely positioned/conditional, the slot collapses — consistent with measured ~10px spacing.

### FE-04 — MEDIUM — Battle log panel is rendered but visually occluded by the skill dock

- **Files:** `game/src/components/game/combat/BattleLogPanel.vue:72+`, mounted `CombatSceneOverlay.vue:116`; dock z-index 12 (`CombatSkillDockPanel.vue:75`).
- **Measured (DOM):** `.battle-log-panel` visible at x=1172 y=838 (260×54) — **inside the dock's opaque 1026–1440 region**. Not visible in screenshots (shot 60/61 bottom-right is pure black).
- **Root cause:** UI-013 comment acknowledges "dock mép phải đè lên log" and added a collapse toggle, but the log still positions under the dock's opaque `dark-drawer-fill` column → hidden regardless of collapse state.
- **Impact:** turn-based combat log (damage, skill names, targets) unreachable in practice.

### FE-05 — MEDIUM — Động Phủ home exposes zero player state (no HUD)

- **Measured (DOM):** on home, the only `data-testid` present is `presentation-overlay`; a class scan for `hud|status|vitals|resource|currency|realm|topbar` finds **nothing**. No tu-vi progress, linh thạch, realm, chiến lực, or HP shown. Player must press Tab and open panels for any state.
- **Impact:** for an idle game, the accrual loop (the product) has no at-a-glance feedback on the main screen — no "+X tu vi/min" ticker, no currency counter, no progress bar toward next realm.
- **Note:** building labels (level + locked state) do render on the scene; the gap is purely player-state.

### FE-06 — LOW — Combat/main-scene nameplate shows literal "Player"

- **Files:** `game/src/game/scenes/CombatScene.ts:767` (`'Player'` label), `MainScene.ts:186,410`.
- **Evidence:** all combat shots show the sprite captioned "Player" while the turn-queue chip correctly shows the character name "Kiểm Toán Giả".
- **Impact:** cosmetic inconsistency; reads like a leftover dev placeholder.

### FE-07 — LOW — Quest cards never disclose the reward

- **Measured (DOM):** `.quest-panel__card` contains name, desc, `0/5` progress, and a "Nhận Thưởng" button — but no reward contents (item/currency/amount). Description text is generic ("...để nhận thưởng").
- **Impact:** players can't evaluate quest value before doing it; reward discovery only after completion.

### FE-08 — LOW — Bottom-left vitals medallion shows overlapping duplicate HP text

- **Evidence:** shots 52/53/60 bottom-left corner — two HP text runs overlap ("103/108" over a second `10x/108`), slightly offset, illegible.
- **Impact:** the only persistent vitals readout in combat is garbled. Likely two stacked labels (medallion + bar label) both rendering the same value.

### FE-09 — LOW — `.kicker` eyebrow labels at 2.19:1 on paper background

- **Measured:** `rgb(168,164,152)` (--chrome-500, calibrated for dark surfaces) on `#f5f0e4` paper → **2.19:1** — used for "ĐẠO DANH"/"THIÊN MỆNH"/"KHỞI THỦ" eyebrows on the creation screen.
- **Impact:** decorative eyebrows are barely-visible smudges; cosmetic but systematic.

### FE-10 — LOW — Stage select: locked modes give no unlock criteria; no power/difficulty guidance

- **Evidence:** shot 30 — "Lặp Lại", "Tự Động Tiến Ải", "Tự Động Hoàn Mỹ" render disabled with no tooltip/unlock hint (visible in shot; verified grayed state). Enemy list shows names/level/type but no recommended chiến lực vs the player's 20.52K.
- **Impact:** player can't tell when/why auto modes unlock or gauge stage difficulty from the UI.

---

## Notes — reviewed and cleared (frontend)

- **Wheel clipping:** all 14 command-wheel slots measured inside viewport at 1440×900 — earlier perceived bottom-clip was a screenshot misread. Cleared.
- **Wheel structure:** singular slot ids (`skill`, `quest`, `pill_room`, `gathering_outpost`, `teleport_array`, `equipment_hall`, `scripture_pavilion`, `chi_hien_quan`, `phap_bao`, `formation_slot`, `companion_roster`, `character`, `realm`, `settings`) — all open correctly; locked slots show a badge.
- **Creation flow:** name validation counter (13/20), talent pick with grade colors (PHẨM/LINH/ĐỊA), skill pick, reroll, finish gate — all functional; card text readable on paper (14.48:1 titles, 6.05:1 labels). Cleared (except FE-09 eyebrows).
- **Character/Realm panels:** chiến lực 20.52K, 5 attributes, ngũ hành, realm ladder (10 tiers with open/locked states), Luyện Thể/Kỳ Kinh/Chu Thiên sub-tracks, tu vi bar `110/600` — info-dense and readable. Cleared.
- **Production panel:** capacity `0/1270`, `+2,1/phút` rate, per-node level/multiplier/worker/material costs with red insufficiency markers — good info density. Cleared.
- **Stage select core:** floor list with enemy preview (name/Lv/type/elite%), wave count `10 quái`, realm tabs — functional. Cleared except FE-10.
- **Combat top bar:** zone name, wave progress `3/10 quái`, round `Hiệp 2/20`, turn-order chips with per-unit HP bars — good. Cleared.
- **Zero console/page errors** across the entire playthrough; no failed requests.
- **Settings panel content:** save/load/export/import buttons, font scale 90-125%, audio toggle+slider — all functional; the dark label issue is covered by FE-02.

---

# Round 2 — per-realm playthrough audit (Phàm Nhân → Luyện Khí → Trúc Cơ)

Method: real breakthrough ritual driven live (seed `realmLevel=12` → Quán Khí → Tâm Ma Kiếp tribulation → talent entitlement → way pick (Pháp Tu) → Lễ Nhập Môn → qi_refining), plus direct realm-seed probes into `foundation_establishment`.

### FE-11 — MEDIUM — Building construction popover clips cost rows; no visible build action

- **Files:** building popover (FunctionOverlayPanel building path; observed on `chi_hien_quan`, `equipment_hall`, `pill_room`).
- **Evidence:** shots `qq-chi_hien_quan`, `qq-equipment_hall`, `22-panel-pill_room` — the compact card shows name + description + "CHI PHÍ XÂY DỰNG" heading then ends: Chiêu Hiền Quán shows **zero** cost rows, Khí Đường shows **one truncated row** ("Thập Niên Linh Mộc Phàm Nhân ?/6"), Đan Phòng two rows — and **no build/upgrade button is visible in the card** at 1440×900.
- **Impact:** player cannot see full construction cost nor confirm building; the primary build action is undiscoverable in the popover (must find another entry point or scroll if it exists).

### FE-12 — LOW — Realm "ladder" in Cảnh Giới panel is a passive-node list that mislabels reachable realms "Sắp ra mắt"

- **Files:** `src/data/realm/RealmPassiveNodes.ts:23-28` (`comingSoon: index >= 2`), `src/components/panels/RealmPanel.vue:102-113`.
- **Evidence:** mortal panel shows "1 Nhập Đạo · Chưa mở / 2 Kiến Cơ · Chưa mở / 3 Trúc Cơ · Sắp ra mắt …" — reads as a realm ladder claiming **Trúc Cơ isn't in the release**, while `progressionCeilingRealmId = 'foundation_establishment'` (Trúc Cơ IS the reachable beta ceiling) and the stage select has a functional Trúc Cơ tab.
- **Also:** label mismatch for the same tier — stage tab says "Luyện Khí" while the passive node for `qi_refining` is labeled "Kiến Cơ".
- **Impact:** contradictory progression signals; players can't tell whether Trúc Cơ is reachable.

### FE-13 — LOW — No forward guidance after breaking into Luyện Khí

- **Evidence:** after Lễ Nhập Môn, home is visually identical; nothing announces "Luyện Khí stage tab unlocked", "Đan Phòng now buildable", or "new material tier". Unlock discovery is entirely self-driven through tabs. Main-quest names do encode progression goals ("Từng Bước Nhập Đạo", "Lĩnh Ngộ Kỹ Năng") but no pointer appears at the transition moment.
- **Impact:** the biggest milestone in the game lands silently; a player may keep grinding mortal Tầng and never notice the Luyện Khí tab.

### FE-14 — LOW — Ceremony banner text truncates mid-word at the panel edge

- **Evidence:** shot `rit-07-way-choices` — "QUÁN KHÍ THÀNH CÔNG / Đạo hữu đã vượt lôi kiếp — hãy chọn con đường tu luyện để bước vào Lu…" clipped at right edge; shot `rit-09-announcement` — "LỄ NHẬP MÔN / …chính thức bước vào Pháp Tu — Đại…" clipped. Same on `rit-02` confirm dialog title region.
- **Impact:** the single most dramatic moment of the loop renders truncated copy.

### FE-15 — LOW — Locked-realm stage tabs are fully browsable; lock affordance only at entry

- **Evidence:** at qi_refining, Trúc Cơ tab lists all 10 `foundation_floor_*` stages with enemy names/levels before any lock message. Code gates correctly — `GameManagerCatalogOps.isStageUnlocked` (`GameManagerCatalogOps.ts:275-289`) refuses entry below realm index — but the UI doesn't mark the tab/nodes as locked while browsing.
- **Impact:** player can plan around content they can't enter; mild — entry itself is correctly refused.

### FE-16 — LOW — Command wheel can race into an invisible-slot state

- **Evidence:** once during rapid Escape→Tab cycling, wheel DOM kept `[data-wheel-slot]` elements with `data-wheel-orbit` but rendered none visible (click timed out on `pill_room`). Recovered on next toggle.
- **Impact:** flaky; one-off observation — wheel occasionally needs a second Tab press.

## Per-realm review summary

**Mortal (Phàm Nhân):** creation → tutorial (FE-01 illegible) → home has zero HUD (FE-05); wheel slots for Trúc Cơ/Kim Đan features show correct lock tooltips ("Cần đạt Trúc Cơ", "Chưa mở trong bản hiện tại"); realm panel exposes Quán Khí gate at L12 + passive ladder + Luyện Thể/Kỳ Kinh/Chu Thiên subsystems; stage select gives 10 floors + enemy previews.

**Breakthrough ritual (mortal → qi_refining):** Quán Khí → "Độ kiếp cũng là độ thân" confirm → Tâm Ma Kiếp quiz tribulation (2 chapters, timed questions, HP 108→68 under failed rushes) → talent entitlement pick (3 cards, grade-colored, readable) → way pick with explicit "KHÔNG thể đổi lại" warning → ceremony announcement → realm commits. Flow is functional and legible end-to-end — **best-executed surface in the game** (modulo FE-14 truncation).

**Luyện Khí (qi_refining):** new stage tab with 10 `qi_refining_*` stages and realm-scaled enemies; production costs/upgrade mats rescale to Luyện Khí tier (Linh Mạch +11.9/min vs +2.1 mortal); buildings remain unbuilt with Luyện Khí-tiered material costs (natural economy gating, no hard realm lock); formation/companion still correctly locked; hidden-realm mechanic hooks exist (QuanThe) — not visually audited.

**Trúc Cơ (foundation_establishment):** release ceiling per `ReleasePolicy.progressionCeilingRealmId`; reachable only through the qi_refining breakthrough chain — direct save injection is correctly **fail-closed rejected** ("Invalid technique progression state in save: five_elements_art") with an incompatible-save recovery modal (dark-on-dark title — same FE-02 class). Stage tab browsable but entry gated by `isStageUnlocked`. Formation/companion unlock predicates target this realm — verified wired, not playtested (requires a second live tribulation).

**Save-integrity observations:** realm-seeding attempts confirmed the restore preflight is genuinely fail-closed (naive `realmId` patch rejected outright; committed-path save patched to foundation rejected on technique grade-history consistency). Rejected saves surface a recovery modal — verified twice. This is a strength worth noting for the cloud master.

---

# Round 3 — Trúc Cơ breakthrough live run + foundation surfaces

Method: fresh boot → creation → seed mortal L12 → **win Quán Khí live** (quiz answers driven via `tribulationDirector.getState().currentQuestion.correctAnswerIndex`) → way pick → qi_refining → seed qi L12 + `qi_refining_abyssal_pool` → **win Trúc Cơ tribulation live** (mind chapter answered; tank/lightning chapters survived via runtime test-only defense override on the director ghost — audit tooling, not a product path) → foundation_establishment reached legitimately through the release-window chain.

### FE-17 — MEDIUM — Release-ceiling gate (Kim Đan) shows a dead button with zero explanation

- **Evidence:** shot `f14-realm-foundation` — at Trúc Cơ · Tầng 1 the realm panel renders a dim "Kim Đan" button with **no requirement rows, no "Sắp ra mắt"/"Chưa mở" label, no tooltip** (BreakthroughGate returns `[]` for closed transitions, so the requirements section is empty and the button just sits disabled). Compounds with FE-12: the same panel simultaneously shows the *passive node* for the realm the player is standing in as "Sắp ra mắt".
- **Impact:** at the exact content ceiling a paying player's progression screen is a dead end with no "this is the current beta cap" message. One line of copy fixes it.

### FE-18 — LOW — Formation panel lists 5 formations with no effect/slot information

- **Evidence:** shot `f11-formation_slot` — rows for Độc Hành/Lưỡng Nghi/Tam Tài/Ngũ Hành/Cửu Cung Trận show names only; no member count, effect, or slot preview on the row; grid shows the player chip with a truncated name ("Kiểm Toán G…"); only a "Lưu Trận Pháp" button. No hover hint observed on rows.
- **Impact:** player cannot compare formations to pick one — pure name-list.

### FE-19 — LOW — Companion roster empty state is a dead panel

- **Evidence:** shot `f11-companion_roster` — full-size dark panel containing one line "Chưa có đồng đội nào — chiêu mộ tại Chiêu Hiền Quán."; the pointer names the source building but offers no button/link to open it.
- **Impact:** missed conversion moment — the unlock just happened, the player is right there, and the panel gives no action.

### FE-20 — LOW — Realm panel node description cards clip at the panel bottom edge

- **Evidence:** shots `f3-realm-qi-cap`, `f14-realm-foundation` — "Nhập Đạo"/"Kiến Cơ" description cards render partially cut by the panel's lower boundary at 900px viewport (text ends mid-sentence at the edge).

### FE-21 — NIT — Stage detail numbering mixes "Tầng N" and "Màn 3.1"

- **Evidence:** shot `f13-stage1` — nodes are labeled "Tầng 1…10" while the detail header reads "Màn 3.1" and node-card enemy lists truncate to "Viêm Giáp Viên ·…". Two numbering vocabularies for the same thing.

## Round-3 verified-good surface (recorded so cloud doesn't re-check)

- **Trúc Cơ confirm dialog**: warns "Không thể mặc trang bị khi độ kiếp" + technique-freeze consequence before commit — informed-choice UX done right.
- **Tribulation (Trúc Cơ)**: 3 chapters (mind quiz 4Q timed → body tank → lightning tank), readable quiz UI, live HP bar; **defeat path** shows "Độ Kiếp Thất Bại — Kiếp Thương còn vương lại — hãy dưỡng thương rồi thử lại" (consequence + recovery instruction — good).
- **Victory path**: announcement renders resolved grade ("★ NHÂN ĐẠO TRÚC CƠ ★") + second talent-entitlement modal fires.
- **Unlock predicates work**: wheel diff mortal→foundation — `formation_slot`/`companion_roster` shed their LOCK state at Trúc Cơ; `phap_bao` stays locked (Kim Đan deferred) — gating accurate per realm.
- **Foundation stages enterable**: `foundation_floor_1` Bắt Đầu enabled at foundation, disabled at qi_refining — `isStageUnlocked` realm gate verified both directions.
- **Realm panel requirement rows** (qi cap): "✓ Luyện Khí tầng 12 / ✓ Chương 10 hoàn thành" — explicit checklist before the Trúc Cơ button; this pattern just isn't extended to the closed ceiling (FE-17).
- Save-commit lag after ceremony: realm commits in memory immediately; the localStorage save lags until the next autosave/manual save — a reload in the gap could lose the breakthrough. Narrow window, Low-level risk already implied by INFRA findings.

---

# Round 4 — mobile viewport audit (390×844, touch)

Method: fresh mortal boot on mobile emulation; measured bounding boxes + viewport overflow + touch targets.

### FE-22 — HIGH — Combat on mobile: ~50% of the viewport is a dead black column

- **Evidence:** shot `m9-combat` at 390×844 — the vertical divider sits at x≈197; the Phaser scene + countdown + sprites render only in the left half while the entire right half is the fixed dock column rendered as empty black (same FE-03 root, catastrophic at mobile width). `dockW=197` measured ≈ 50.5% of `vw=390`.
- **Impact:** the single most important screen is effectively half-width on phones; sprites, turn queue, and telegraphs all compress into 197px.

### FE-23 — LOW — Command wheel labels clip at the left viewport edge

- **Evidence:** shot `m5-wheel` — the orbit ring overflows the 390px canvas; the Chiêu Hiền Quán slot's label renders "u Hiền Quán" (leading characters cut by the screen edge).
- **Impact:** cosmetic; slot remains tappable (57×57px targets — all ≥44px, no sub-40px targets found anywhere).

### FE-24 — LOW — "Ai Mục Tiêu" targeting panel permanently overlays the shrunken combat scene

- **Evidence:** shot `m9-combat` — a 5-radio target-priority card sits over the top-left of the battle area from the countdown onward; combined with FE-22 the actually-visible unobstructed scene is a fraction of the viewport.
- **Impact:** informational clutter on the smallest screen — should default to collapsed on narrow viewports.

## Round-4 verified-good

- **No horizontal overflow** at 390px (`scrollWidth === clientWidth === 390`).
- **Stage select adapts well** — tabs, floor chips, detail card with description + "10 quái" + per-enemy cards (Lv/type/element %), mode row, Chỉnh Build + Bắt Đầu footer all fit and stay readable (shot `m8-stage-detail`). "Truyền Tống Trận" title remains FE-02 dark-on-dark.
- **Inventory (Kho Vật)** mobile layout clean: tabs Trang Bị/Nguyên Liệu/Đan Dược + filter chips, empty grid state.
- **Wheel on mobile works by tap**; all 14 slots ≥57×57px — touch-target compliant.
- **Zero page errors** in mobile session; only the known AudioContext/WebGL warnings.
