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
