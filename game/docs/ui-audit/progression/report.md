# UI/UX Audit — Slice: Progression

**Branch:** `devin/ui-scan-progression` · **Scan target:** `origin/master` · **Tester:** Devin (played as a player via Playwright/CDP, live DOM + Pinia state)

## Verdict

Progression loop is **playable end-to-end** (create → cultivate → Quán Khí ritual → path choice → qi_refining systems) and the ceremonial moments have strong ink-paper styling. But the FIRST major gate a player ever meets gives zero feedback, the single most consequential irreversible choice offers zero information, and several flagship screens ship visible polish bugs (watermark collision, dead-black dock, float leak, English tag leaks). **Overall grade: C+** — the skeleton is right, the surfaces are not finished.

## How each screen was reached

| Screen | How reached |
|---|---|
| Command wheel, home DongFu | Played: guest boot → character creation → "Bỏ Qua" tutorial → click character |
| RealmPanel (mortal & qi_refining) | Wheel → "Cảnh Giới"; mortal at Tầng 2, qi_refining after full ritual |
| Quán Khí breakthrough (mortal) | Real realmLevel grind is ~hours of idle; seeded `player.realmLevel = 12` via Pinia `$patch` (button state identical to real readiness — verified `canBreakthrough` is a live computed), then clicked through the real flow |
| Tâm Ma Kiếp question tribulation | Real: confirm modal → tribulation route; answered chapter 1, let ch.2 lapse (HP 108→68) |
| TalentEntitlementModal | Real: rendered automatically on victory (mandatory, un-cancellable by design) |
| QuanKhiPanel + path confirm | Real: auto-opened after entitlement; chose Kiếm Tu → Ngự Kiếm Tâm Kinh |
| SkillPathPanel + Linh Mạch node tree | Wheel → "Kỹ Năng" at qi_refining/sword |
| Meridian / Luyện Thể / Chu Thiên sections | RealmPanel scroll (`.realm-panel` is the scroll container, not `.overlay-panel__body`) |
| Quán Thể hidden row | Seeded `player.hiddenPerfection.realms.qi_refining.discovered = true` via `$patch` (discovery is gameplay-gated; the row renders per `MeridianSection.vue` HIDDEN-B block) |
| StageSelectPanel + floors | Wheel → "Truyền Tống Trận" (unlocks at qi_refining) |
| Auto-farm | Real: Động 1 with "Tự Động Tiến Ải" — auto-advanced to Động 2, then lost. `AutoFarmIndicator` additionally seeded (`autoFarmStage` `$patch`) since it only arms for perfect_farm |
| Tribulation defeat presentation | Not reached live (consumed ritual); code-verified: `tribulation.overlay.resultDefeat` "KIẾP THẤT BẠI" + `announce.tribulation.defeat` announcement exist |
| Narrow 820px, EN locale | `page.setViewportSize(820×900)`; EN forced via i18n composer (no in-game switcher exists — see finding) |

## Graded screens

| # | Screen | Grade | One-line verdict |
|---|---|---|---|
| 1 | Home + command wheel | B | Orbit menu is readable & pretty; bottom slot clips off-screen |
| 2 | RealmPanel — mortal | **D** | First-ever progression gate shows a dead button with zero explanation |
| 3 | RealmPanel — qi_refining | B | Requirement rows + sections exist and are informative |
| 4 | Breakthrough confirm modal | B+ | Clear double-gate; irrelevant equipment warning at mortal |
| 5 | Tribulation overlay (Tâm Ma Kiếp quiz) | C | Mechanics legible (chapter, timer, HP) but title watermark collides with the question card; scene is a big void |
| 6 | Talent entitlement modal | B | Polished card choice; raw English tags leak; copy promises an upgrade branch that may not render |
| 7 | Quán Khí path ritual | **D+** | Permanent class choice presented as 3 identical unlabeled buttons — no info to decide with |
| 8 | SkillPathPanel + node tree (Kiếm Phổ) | C+ | Rich tree but auto-fits to ~40% = unreadable; mixed EN/vi labels |
| 9 | StageSelectPanel | B | Best panel of the slice — floor cards, enemy preview, mode chips with hints |
| 10 | Combat / auto-progress chrome | C | 27%-width dock renders as a black void; HP float leak |
| 11 | AutoFarmIndicator | B | Works; low-contrast label |
| 12 | CharacterPanel (talents, stat points) | B+ | Talent cards + "CÒN 2 ĐIỂM" allocation are clear and pretty |
| 13 | Kỳ Kinh Bát Mạch (meridian) + Quán Thể | B | Sequential gating communicated well; hidden row distinct gold card |
| 14 | Chu Thiên section | B | "PHONG ẤN — Hoàn thành Kỳ Kinh Bát Mạch trước" is exactly right |
| 15 | Narrow viewport 820px | B | Panels reflow; stage select stacks vertically without breakage |
| 16 | EN locale | C | Not reachable from UI at all; renders acceptably when forced |

## Findings (ordered by severity)

### [Critical] Quán Khí disabled with zero requirement info at mortal realm

- **Screen:** RealmPanel at `mortal` (first big gate every player hits)
- **Player sees:** A greyed-out "Quán Khí" button. Nothing else — no checklist, no tooltip, no "cần Phàm Nhân tầng 12". The player must guess why it's dead.
- **Evidence:** shots `04-realm-panel.png` (mortal Tầng 2 — no rows under the button) vs `18-realm-panel-qi.png` / `51-en-realm.png` (qi_refining — `✗ Luyện Khí tầng 12`, `✗ Chương 10 hoàn thành` render fine).
- **Why it's a problem:** The domain already returns the row — `getBreakthroughRequirements` yields `[{key:'level'}]` for mortal — but `RealmPanel.vue` computes `requirements` only `player.realmId === 'qi_refining'`, so the read-model that drives the gate is never rendered. New players hit their first wall blind.
- **Suggestion:** Drop the `realmId === 'qi_refining'` scope so every realm renders its requirement rows (the rows already map `level`/`chapterClear` keys to localized text).

### [High] Quán Khí path ritual offers an irreversible choice with zero information

- **Screen:** QuanKhiPanel ("Quán Khí" path selection)
- **Player sees:** "Chọn con đường tu luyện — quyết định này KHÔNG thể đổi lại." then three identical crimson buttons: "Bước Vào Pháp Tu — Đại Ngũ Hành Chân Quyết", "Bước Vào Kiếm Tu — Ngự Kiếm Tâm Kinh", "Bước Vào Thể Tu — Kim Cang Bất Hoại Thể". No description, no tooltip, no preview of skills/playstyle.
- **Evidence:** `13-quankhi-path-panel.png`. `QuanKhiPanel.vue` renders each way as a bare `GameButton` — while the *hidden* ways DO get a full card (`quan-khi-panel__hidden-card` with description listing the sealed kit's skill names). Normal paths get less info than hidden ones.
- **Why it's a problem:** The game itself marks this as permanent (danger styling + double-confirm modal). Asking a player to commit forever with no comparative data is the worst possible version of a good ritual beat.
- **Suggestion:** Render each normal way as a card like `hidden-card`: way name + 1-line fantasy + the kit's skill names (the same `sealedKitSkillNames` resolution already exists). Optionally a "?" tooltip per path.

### [High] Combat right dock renders as a dead black void (~27% of viewport)

- **Screen:** Combat scene / auto-progress run
- **Player sees:** Battlefield art covers the left ~72%; the right ~28% is a solid black column containing only a bare "☐ Thủ công" checkbox at its top edge. No visible skill slots.
- **Evidence:** `26-autofarm-running.png`, `27-battle-settled.png`, `29-home-autofarm.png`. `CombatSkillDockPanel.vue` fixes `width: clamp(340px, 27vw, 440px)` with `dark-drawer-fill` — the dock IS the black band, and `TurnCombatSkillBar` inside it shows nothing but the manual-mode checkbox in these screenshots (slot buttons either absent or invisible-dark).
- **Why it's a problem:** During the game's main spectacle, a quarter of the screen reads as broken/unrendered. If slots are meant to appear, they're illegible; if not meant for auto mode, the dock shouldn't occupy space.
- **Suggestion:** Ensure sword-path kit skills visibly render in the dock (check empty-state when no manual-castable skills exist), or collapse the dock to icon-rail in auto modes. Verify against `TurnCombatSkillBar` slot rendering for a fresh qi_refining sword player.

### [High] Tribulation title watermark collides with the question card

- **Screen:** Tâm Ma Kiếp (mind-question) tribulation overlay
- **Player sees:** Giant ghost "THIÊN KIẾP" text clipped mid-glyph by the bordered question card; "Chương 1 / 2" sits on top of the clipped letters. Looks like a layering bug, not a design watermark.
- **Evidence:** `08-after-confirm.png`.
- **Why it's a problem:** This is the peak ceremony screen for the first breakthrough — the collision reads as a z-ordering/positioning mistake.
- **Suggestion:** Move the watermark lower (behind the character circle) or fade it before it reaches the card zone; alternatively drop the card's vertical position below the title.

### [High] Node tree auto-fits to ~40% zoom — node text unreadable

- **Screen:** SkillPathPanel → Linh Mạch node tree (Kiếm Phổ)
- **Player sees:** Node cards tiny at the default fit-zoom (40%), names/effects illegible without manually pressing "+". Detail pane works fine once a node is clicked (prereqs in red, "Lĩnh Ngộ" gated correctly).
- **Evidence:** `20-skill-panel.png`, `21-tree-zoomed.png` (node detail works). `NodeTreePanel.vue` auto-computes `fitZoom` to fit all branches — the whole tree is too big for the viewport so it shrinks past legibility.
- **Why it's a problem:** First contact with the build-crafting surface is a wall of microtext; the fit-all default optimizes for "see everything" over "read anything".
- **Suggestion:** Clamp minimum fit-zoom to a readable floor (~60-70%) and let the viewport pan/scroll; or start zoomed to the current frontier (unlocked/next nodes) with a "Về vừa khung" reset.

### [Medium] Cultivation bar shows no rate and no ETA

- **Screen:** RealmPanel cultivation bar (both realms tested)
- **Player sees:** "9053 / 13200 Tu Vi" — a static fill. No "+x/s", no "~2h to Tầng 2", no countdown. For an idle game the rate IS the game.
- **Evidence:** `04-realm-panel.png`, `18-realm-panel-qi.png`, `51-en-realm.png` ("12430 / 13200 Cultivation").
- **Why it's a problem:** Players can't evaluate what talents/techniques changed, or when to come back. The "idle" loop loses its core readout.
- **Suggestion:** Append rate under/next to the bar ("+{rate} Tu Vi/phút · Tầng kế sau ~{eta}") — the tick already runs in `App.vue`; expose the per-second gain.

### [Medium] Command wheel bottom slot clips below the viewport

- **Screen:** Home command wheel
- **Player sees:** The bottom "Truyền Tống" pill is cut in half by the screen edge at 1568×993.
- **Evidence:** `50b-en-wheel.png` (bottom pill sliced), `03-wheel-open.png`.
- **Why:** Orbit radius puts the lowest slot below the fold on normal windows.
- **Suggestion:** Constrain wheel radius so the lowest slot clears the bottom chrome, or shift the orbit center up a few %.

### [Medium] Locked stage floors selectable; "Bắt Đầu" dead with no reason

- **Screen:** StageSelectPanel
- **Player sees:** Every floor card (2–10 incl. BOSS) clickable → detail pane fills with real enemies → "Bắt Đầu" silently disabled. No lock icon on floor cards, no "hoàn thành tầng trước" hint. Locked floors only differ by `opacity .45` + `cursor: not-allowed` — subtle on parchment.
- **Evidence:** `22-stage-select.png`, `23-stage-floor5.png`.
- **Suggestion:** Add a lock badge/`is-locked` overlay line ("Hoàn thành Tầng 4 trước") on the detail pane or on the floor card itself; alternatively disable floor buttons outright.

### [Medium] Realm ladder has no "you are here" for Phàm Nhân; terminology mixes

- **Screen:** RealmPanel node track
- **Player sees:** 9 nodes starting at "Nhập Đạo" — mortal is not in the track, so a new player has no highlighted home node. At qi_refining node 1 reads "Nhập Đạo — đã lĩnh ngộ" while the header says "Luyện Khí · Tầng 1": two different vocabularies (realm name vs passive-node label, "đã lĩnh ngộ" = node language applied to realms) with no legend linking them.
- **Evidence:** `04-realm-panel.png` (mortal: all nodes "Chưa mở"/"Sắp ra mắt"), `18-realm-panel-qi.png`.
- **Suggestion:** Either add a mortal node or mark node 1 as the current realm with its realm name; swap "đã lĩnh ngộ" for "đang tu hành" on the live node.

### [Medium] Combat top-bar leaks unrounded HP float

- **Screen:** Combat (auto-progress)
- **Player sees:** `KhaVanTu 107/111.24000000000001` in the top bar.
- **Evidence:** `27-battle-settled.png`, `29-home-autofarm.png` ("112/111.24000000000001").
- **Suggestion:** `Math.floor`/`Math.round` the max-HP side (the current-HP side is already integer).

### [Medium] Floor-description tooltip overlaps the detail pane's own description

- **Screen:** StageSelectPanel detail
- **Player sees:** A black tooltip box carrying the cave description floats ON TOP of the detail pane's identical description text — same content twice, one occluding the other.
- **Evidence:** `23-stage-floor5.png`.
- **Suggestion:** Suppress the node tooltip once that stage is selected (its description already renders in the detail pane).

### [Medium] Talent cards leak raw English dev tags on Vietnamese UI

- **Screen:** Character creation talents + TalentEntitlementModal
- **Player sees:** `resource`, `cultivation`, `mechanic`, `combat`, `defense` in lowercase English under the description — internal taxonomy printed via `talent.tags[0]`.
- **Evidence:** `10-talent-entitlement-modal.png` ("resource"/"cultivation"/"mechanic"), `01-creation-picked.png` ("combat"/"resource").
- **Suggestion:** Map tags through the locale (`talentTag.{key}` → "Tài Nguyên"/"Tu Luyện"/"Cơ Chế") or drop the `<small>{{ talent.tags[0] }}</small>` line.

### [Medium] No visible close affordance on any overlay panel

- **Screen:** All `OverlayPanel`-hosted screens (RealmPanel, QuanKhiPanel, StageSelectPanel, SkillPathPanel…)
- **Player sees:** A panel with header, body — no ✕. Close requires discovering Escape or clicking the dimmed scrim. `OverlayPanel.vue` emits `close` on `@click.self` + `onEscape` only; the header renders no button.
- **Evidence:** every panel screenshot (e.g. `18-realm-panel-qi.png`, `22-stage-select.png`).
- **Suggestion:** Add a small ✕ in `.overlay-panel__header` — one change fixes the whole family.

### [Medium] EN locale ships but is unreachable

- **Screen:** Global / SettingsPanel
- **Player sees:** No language option anywhere; `i18n` hardcodes `locale: 'vi'`, nothing in production code ever sets `'en'` (SettingsPanel has no language row — `53-settings.png` shows the settings entry exists but the wheel also clips it).
- **Why:** en.json is a full dictionary that's dead weight — and untestable truncation-wise for real users.
- **Suggestion:** Either add a language toggle in SettingsPanel or mark EN dev-only. Minor EN copy nits when forced: "Luyện Khí floor 12" lowercase vs Title Case neighbors (`51-en-realm.png`).

### [Low] Victory announcement overlaps the QuanKhiPanel it opens

- **Screen:** Post-tribulation transition
- **Player sees:** "QUÁN KHÍ THÀNH CÔNG" gold overlay renders on top of the just-opened path-selection panel for ~4s — the buttons are clickable under the scrim but the text is unreadable mid-fade.
- **Evidence:** `11-after-talent-pick.png`, `12-post-tribulation.png`.
- **Suggestion:** Delay the standalone panel mount until the announcement fades, or push the panel open *after* `announcements.show` completes.

### [Low] Equipment warning shows even with nothing equipped

- **Screen:** BreakthroughRequirementPanel
- **Player sees:** "Không thể mặc trang bị khi độ kiếp" for a fresh mortal who owns zero equipment — an irrelevant warning under the (correct) dramatic title.
- **Evidence:** `07-breakthrough-confirm.png`.
- **Suggestion:** Render the warning only when `equipped.length > 0`.

### [Low] Node tree chrome mixes languages and ambiguous affordances

- **Screen:** SkillPathPanel node tree
- **Player sees:** Eyebrow literally "NODE TREE" (English) while the respec dialog says "Cây Node" and the tab says "Cây Kỹ Năng" — three names for one thing. Budget pill reads "+ 3 Cảm Ngộ" — the "+" makes a balance look like a delta.
- **Evidence:** `20-skill-panel.png`, `21-tree-zoomed.png`; `vi.json` → `panels.nodeTree.title: "Node Tree"`.
- **Suggestion:** Pick one Vietnamese term ("Cây Lĩnh Ngộ"?) for vi title, keep "Node Tree" only for EN; render budget as "Cảm Ngộ: 3" or a chip icon.

### [Low] Combat AI panel is a permanent translucent overlay over the scene

- **Screen:** Combat battlefield
- **Player sees:** "AI Mục Tiêu" radio list pinned top-left over the art — always open, can't collapse, scene art shows through it.
- **Evidence:** `26-autofarm-running.png`–`29-home-autofarm.png`.
- **Suggestion:** Collapse to a gear/target icon button that expands on click; it matters only when changing target priority.

### [Low] "Thủ công" control is a bare native checkbox

- **Screen:** Combat skill dock (top-right)
- **Player sees:** An unstyled OS checkbox + text label floating on the black dock — clashes with every other control's chip/button styling.
- **Evidence:** `27-battle-settled.png` top-right corner.
- **Suggestion:** Restyle as a `Chip`/toggle matching the mode chips in StageSelectPanel.

### [Low] AutoFarmIndicator label is low-contrast

- **Screen:** Home chrome during perfect-farm
- **Player sees:** "Đang Tự Động Hoàn Mỹ: Động 1" in thin dim text on translucent black — hard to read against the bright scene. (Mode label is correct — it only arms for perfect_farm.)
- **Evidence:** `31-autofarm-indicator.png`.
- **Suggestion:** Raise label contrast (`--paper-text` → brighter) or add a status dot.

### [Nit] Confirm modal chrome differs from its parent panel

- **Screen:** QuanKhiPanel → confirm
- **Player sees:** Gold ink-ceremony frame panel, then a cyan-glow "system" confirm modal — two modal languages stacked mid-ritual.
- **Evidence:** `14-quankhi-confirm-modal.png`.
- **Suggestion:** Use the ink variant for path-confirm (it's a ceremony, not a system warning).

### [Nit] Stray empty separator bar at bottom of realm node track

- **Screen:** RealmPanel bottom edge
- **Player sees:** A thin empty bar rendered below node 9 — looks like a clipped connector/empty row.
- **Evidence:** `32-realm-qi-bottom.png` bottom edge, `51-en-realm.png`.
- **Suggestion:** Remove or cap the node connector row after the last node.

### [Nit] Entitlement body promises an upgrade branch that may not render

- **Screen:** TalentEntitlementModal
- **Player sees:** "…hoặc đột phá thiên phú đang có lên tầng cao hơn" even when `upgradeableTalents` is empty (my run: only the 3 new cards rendered).
- **Evidence:** `10-talent-entitlement-modal.png` + `TalentEntitlementModal.vue` (upgrade section is `v-if`).
- **Suggestion:** Make the body copy conditional on `upgradeableTalents.length`.

## Screenshot index

| File | Captures |
|---|---|
| `00-auth.png`, `00-creation-empty.png`*(unused)*, `01-creation-picked.png` | Boot → creation (talent cards show the raw-tag leak) |
| `01-home-dongfu.png` | Home DongFu scene |
| `03-wheel-open.png`, `50b-en-wheel.png`, `17-wheel-qi.png` | Command wheel (bottom clip visible) |
| `04-realm-panel.png` | RealmPanel mortal Tầng 2 — dead Quán Khí, no requirements |
| `05-realm-panel-bottom.png`, `05-realm-breakthrough-hover.png` | Mortal sections scrolled |
| `06-realm-lv12-ready.png` | Seeded Tầng 12 — button enables, still no requirement text |
| `07-breakthrough-confirm.png` | Độ kiếp confirm modal |
| `08-after-confirm.png` | Tâm Ma Kiếp question + watermark collision |
| `10-talent-entitlement-modal.png` | Talent entitlement (raw EN tags) |
| `11/12/13/14/15/16` | Quán Khí announcement overlap → path panel → confirm → settled |
| `18/19`, `32-35` | RealmPanel qi_refining — requirements, meridians, Luyện Thể, Chu Thiên sealed |
| `36-quan-the-hidden.png` | Quán Thể hidden row (gold card, "DIVERTING" in forced EN) |
| `20/21` | SkillPathPanel + node tree at 40% fit zoom; node detail with prereqs |
| `22/23/25` | StageSelectPanel — floors, mode chips, locked-floor dead start, tooltip overlap |
| `24-character-panel.png` | Talent cards + THUỘC TÍNH allocation + Quán Khí re-entry chip |
| `26-29` | Auto-progress combat — black dock void, HP float, AI panel |
| `30-skill-dock-right.png` | Right-edge region (post-combat home render for contrast) |
| `31-autofarm-indicator.png` | Perfect-farm indicator (store-seeded) |
| `40/41/43` | 820px narrow — realm 2-col reflow, stage select vertical stack |
| `51/55` | Forced EN — readable, minor capitalization inconsistency |
| `53-settings.png` | Wheel shows Cài Đặt slot (language switcher absent by code inspection) |
