# UI/UX Audit — slice `creation-meta`

- **Repo:** hnkm080596-svg/tutienidle @ `origin/master` (0f1d84d1)
- **Branch:** `devin/ui-scan-creation-meta`
- **Scope:** title/start + first-launch, character creation funnel, save/load + offline resume, SettingsPanel, help/tutorial, world announcement, global nav chrome, 404/empty-route.
- **Method:** real playthrough (guest → creation → tutorial → home → wheel → settings) + Playwright/CDP; store pokes (`pinia._s.get('worldAnnouncement').show()`, `.$i18n.locale='en'`) and `localStorage` surgery for gated surfaces; 820×700 narrow pass; vi/en pass. Save mutation needed `Storage.prototype.setItem` patching via `addInitScript` — the pagehide autosave rewrites the save during reload, so editing the key pre-reload is silently overwritten (worth knowing: manual edits to `localStorage` between sessions are clobbered on unload).
- **Viewport:** 1440×900 default, 820×700 narrow.

## Verdict

**C+ overall.** The ink-wash art direction is genuinely beautiful and consistent on the game stage (home, wheel, character drawers, announcements). The creation funnel works end-to-end and is easy to complete. But the meta surface has a systemic, screen-spanning defect — **most headings render dark-on-dark and are near-invisible** — plus a **tutorial that instructs players to press buttons that no longer exist**, a navigation model discoverable only by accident, a missing-language-switch (the EN translation ships but is unreachable and half-Vietnamese anyway), and a ConfirmModal in a completely different visual language.

## Screen grades

| # | Screen | Grade | Notes |
|---|--------|-------|-------|
| 1 | LoadingScreen (boot intro) | B+ | Clean, ~3s fixed, honors reduced-motion; no skip. `01` |
| 2 | AuthEntryScreen (login/register) | C+ | Solid error UX + guest path; h1 + active tab dark-on-dark; fixed-width card. `03` `04` `80` |
| 3 | CharacterCreationScreen | C+ | Completes smoothly, good gating; all section h2 invisible; EN mode mixed-language. `05`–`10`, `40`, `41`, `81` |
| 4 | TutorialOverlay (9 steps) | D | Step copy references removed UI; fully hardcoded VI; title invisible. `12` `42` |
| 5 | Home + nav shell / DongFuCommandWheel | C+ | Pretty + good lock feedback; hidden entry point, icon 404s, bottom slot clipped. `13` `23` `24` `51` |
| 6 | SettingsPanel | C | Save ops complete with confirms; narrow column in huge overlay, no language/shake sections, h4 dark. `25`–`28`, `45`, `52` |
| 7 | OfflineSummaryModal | B | Clear duration + gains, blocking + Esc; title dark-on-dark. `60` `62` |
| 8 | SaveIncompatibleScreen | B− | Real recovery path (export/import/reset); no backdrop, title dark-on-dark. `70` `71` |
| 9 | ErrorScreen (app-level) | B | Works, generic. `32` |
| 10 | WorldAnnouncementOverlay | A− | Strong typewriter scrim, dismissable. `46` |
| 11 | Scripture Pavilion (lore codex) | C+ | Layout fine; empty state is a dead end. `47` |
| 12 | Character drawer (left+right) | A− | Rich, polished, readable. `49` |
| 13 | Generic boot-error branch | n/a | Code-inspected only — unreachable without a real boot failure (`App.vue` error branch). |
| 14 | 404 / empty route | n/a | No router exists — app is a stage state machine (`entryStage`), so there is no route to 404. Not a defect in itself, but there is no URL-addressable deep-linking either. |
| 15 | TalentEntitlementModal | n/a | Skipped: gated behind realm breakthrough (Đột Phá) — needs `player.pendingTalentEntitlement` populated with a *legal* offer for the current realm; a fabricated record is reconciled away by the component's own `watchEffect`. Code-inspected. |

## Findings (by severity)

### [High] Section headings are dark-on-dark across the whole meta surface
- **Screens:** auth (`h1 "Tiên Hiệp Idle"`, active tab "Đăng nhập"), creation (all three step titles — "Danh xưng theo suốt tiên đồ", "Chọn một Thiên Phú", "Chọn Công Pháp Khởi Đầu"), settings (`h4` "Cỡ Chữ Giao Diện"/"Âm Thanh"), offline modal ("BẾ QUAN KẾT THÚC"), save-incompatible (title), tutorial (title).
- **What the player sees:** headings render in a near-black serif (`--ink-*`/dark variable) on the dark card background — readable only by squinting; on creation, the two section titles are literally invisible at a glance. `04`, `05`, `25`, `60`, `70`, `12`, `45`.
- **Why it's a problem:** the primary hierarchy cue on every meta screen is broken; this is the first thing every new player sees.
- **Suggestion:** flip these to the paper/gold text variables used by the rest of the card text, or audit the `--paper-text`/`--ink` token assignment on `.auth-*`, `.creation-*`, `.settings-*`, modal headers.

### [High] Tutorial copy references UI that no longer exists
- **Screen:** TutorialOverlay step 1 (+ related steps).
- **What the player sees:** "Bấm **Menu** (hoặc phím Tab) bất cứ lúc nào để mở bảng điều hướng tới các khu vực" — there is no Menu button; the wheel opens via the unlabeled character or `Tab`. Later steps reference a bottom "CHIẾN ĐẤU" bar that was removed in the redesign. `12`
- **Why it's a problem:** the very first onboarding instruction can't be followed as written; teaches the player the tutorial lies.
- **Suggestion:** re-author `TUTORIAL_STEPS` against current chrome ("bấm vào nhân vật hoặc phím Tab để mở vòng lệnh"), and move strings to i18n keys (currently fully hardcoded VI — see below).

### [High] No persistent navigation affordance — main menu is discoverable only by accident
- **Screen:** home / global chrome.
- **What the player sees:** after the tutorial there is no header bar, hamburger, or labeled menu button anywhere; the only paths to settings/character/etc. are (a) clicking the meditating character figure (`.home-player__trigger`, unlabeled, no hint ring after first view) or (b) the undocumented `Tab` key. `13` `23`
- **Why it's a problem:** a returning player who skipped/forgot the tutorial cannot find settings, save, or any panel — the entire meta layer hides behind an unlabeled hot-spot. Combined with the stale tutorial text, nav is effectively undocumented.
- **Suggestion:** add a small persistent affordance (corner ⋯/≡ button, or a labeled hint under the character "bấm để mở menu · Tab").

### [High] Language switch is unreachable + EN locale is a half-translated mix
- **Screen:** SettingsPanel (no switcher exists anywhere); EN-mode surfaces.
- **What the player sees:** `createI18n` ships full `en.json` but no code path assigns `locale` — EN is only reachable by poking `$i18n.locale` in devtools. When forced on: chrome labels translate, but talents/skills/quests/toasts stay Vietnamese (data-side), wheel slot labels stay Vietnamese (`commandWheelCatalog` labels aren't i18n'd), talent tag chips show raw English keys (`cultivation`, `combat`…), and the creation kicker renders the hybrid "ĐẠO NAME". `40` `42` `44` `45`
- **Why it's a problem:** a promised setting (vi↔en) doesn't exist in UI, and the EN build would ship visibly broken bilingual text.
- **Suggestion:** add the switcher (settings + auth), gate EN behind it only when data-content is localized; i18n the wheel labels and talent tags (or hide tags in EN).

### [High] ConfirmModal speaks a different visual language
- **Screen:** any confirm (settings reset/reload/import, incompatible-reset).
- **What the player sees:** a translucent dark-navy box with neon-blue glow borders and spaced caps ("XOÁ SAVE") floating over the warm cream/ink panels — also semi-transparent, so underlying text bleeds through and both layers become hard to read. `28` `71`
- **Why it's a problem:** jarring theme break at the exact moments of highest trust (destructive confirms); the see-through modal hurts legibility of the warning itself.
- **Suggestion:** restyle ConfirmModal on the paper/dark-ink tokens and make the panel opaque.

### [Medium] SettingsPanel is a sparse narrow column inside a huge overlay
- **Screen:** settings.
- **What the player sees:** a ~460px column of save buttons + 4 scale chips + audio row floats inside a near-fullscreen bordered frame — most of the overlay is empty; no tabs/sections, no language or shake toggle, no keybind display. `25` `52`
- **Suggestion:** either size the overlay to content, or organize into visible sections (Save / Display / Audio / Language) — and add the missing controls the design calls for.

### [Medium] Command wheel slot icons all 404 → text-only circles
- **Screen:** command wheel.
- **What the player sees:** every orbit slot is a plain circle containing its label text; `wheelIconPath` resolves `/assets/ui/wheel/{id}.png` but `public/assets/ui/wheel/` doesn't exist, so `onIconError` hides every icon. `23`
- **Suggestion:** ship the icon set or drop the icon pipeline until assets land.

### [Medium] Wheel bottom slot is clipped by the viewport edge
- **Screen:** command wheel (both 1440×900 and 820×700).
- **What the player sees:** "Truyền Tống" sits at the bottom orbit apex and is cut mid-label at the viewport edge. `44` `51`
- **Suggestion:** raise the wheel center (currently `top: 66%`) or shrink orbit radius with a viewport-height bound.

### [Medium] Every reload replays intro + auth — no "continue" fast path
- **Screen:** boot flow.
- **What the player sees:** reload → fixed 3 s intro → auth card → must click "Chơi ngay" again → boot → home. ~7–8 s and 2 interactions on every reload, even with a valid guest save. No "continue as {name}" button. `21` `22`
- **Suggestion:** remember the last auth method (signed flag) and show a one-click "Tiếp tục — {name}" on the auth card, or auto-resume guests.

### [Medium] Scripture codex empty state gives no forward path
- **Screen:** scripture pavilion.
- **What the player sees:** "Chưa tìm thấy mảnh mối nào" and nothing else — no hint of where lore fragments come from. `47`
- **Suggestion:** one line of guidance ("mảnh mối rơi ra khi …") or a locked-entry teaser list.

### [Medium] Talent tag chips leak raw English data keys in VI UI
- **Screen:** creation talent cards.
- **What the player sees:** card footers render `cultivation`, `resource`, `defense`, `combat`, `crafting` verbatim while everything else is Vietnamese. `05` `08`
- **Suggestion:** map tags through i18n (or strip them — the rarity label already conveys tier).

### [Low] Save-incompatible screen loses the ink backdrop + heading contrast
- **Screen:** SaveIncompatibleScreen.
- **What the player sees:** pure black page behind the card (no `InkWashBackdrop`), and the title again dark-on-dark; actions are solid (export raw save / import / danger reset with confirm). `70` `71`
- **Suggestion:** render the backdrop under error stages too; same heading fix.

### [Low] Post-reset lands on auth with no continuity
- **Screen:** save-incompatible reset / settings reset end-state.
- **What the player sees:** after "Xoá & Bắt Đầu Mới" + confirm, app reloads to the generic auth card — no "your save was cleared, start again" handoff, guest must click through again. `72`
- **Suggestion:** carry a small notice into the next boot ("Đã xoá save — bắt đầu lại nào").

### [Nit] Dead code: `src/components/menu/*` + `menu.main.*` locale keys
- MenuButton/MenuLogo/MenuBackground have zero imports; `menu.main.*` keys exist in both locales. Leftover from the removed main menu — delete or wire back.

### [Nit] Boot-error branch (`App.vue`) unreachable in normal play
- Generic `.boot-error` block (vs. SaveIncompatible variant) can't be exercised without a real boot failure — noted as code-inspected; ensure it has the same heading treatment when it renders.

### [Nit] "ĐẠO NAME" hybrid kicker in EN creation
- `onboarding.creation.nameStep.kicker` = "DAO NAME" renders with diacritic-styled font as "ĐẠO NAME" — pick one language. `40`
