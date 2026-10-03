# Art Requests — Scene 16 · Settings / Cài Đặt (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here.

Reference: `game/docs/design/references/huyen-kim/scenes/16-settings.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655). Ref `16-settings.jpg` maps to **spec scene 17 "Settings"** — imperial-scroll shell, z14 inside the scroll content area.
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper · cinnabar `--cinnabar`.

## Region → component map

| Spec region (scene 17) | Box (design px) | Component |
|---|---|---|
| sections-grid | 288/176/1244/610 z14 | `SettingsPanel` root grid → `SettingsNavRail` (left seal column) + `settings-panel__workspace` → per-section children |
| — nav rail (ref's left category seals) | inside sections-grid | `SettingsNavRail` + `settings-panel__nav-glyph` per seal |
| — section plaques | inside sections-grid | `SettingsSectionFrame` (h4 + `settings-panel__plaque` + slot) |
| — save block | general tab | `SettingsSaveSection` (warning note + save/reload/export/import/reset actions) |
| — display block | display tab | `SettingsUiScaleSection` + `SettingsLanguageSection` (chip rows) |
| — audio block | audio tab | `SettingsAudioSection` (toggle chips + slider rows, `settings-audio-*` testids) |
| — support block | support tab | `SettingsFeedbackSection` |
| — account block | account tab (remote-auth only) | `SettingsAccountSection` + `GuestUpgradeCard` + logout |
| — updates block | update tab | `SettingsUpdateSection` (`update-*` testids) |
| — build block | build tab | `SettingsBuildSection` (mono dl) |
| footer-actions | 288/794/1244/56 | **RESERVED** — per-action confirms, no global save bar; not scaffolded |

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `SettingsSectionFrame` h4 | `settings-section-plaque` | ~28×28 | prop | Small square ink plaque / seal tile left of each section title — dark ink field, gold rim, tiny glyph | inside section header, left of h4 text |
| 2 | `SettingsNavRail` seal | `settings-nav-glyph-{id}` (general · display · audio · support · account · update · build) | ~24×24 each | prop | Small round glyph medallion centered on the left edge of each vertical nav seal — jade orb on ink ground | inside nav seal, left of label |
| 3 | scroll shell | `settings-vista` (suggestion) | 1672×941 | vista | Ref shows the pale paper scroll over the dimmed home vista — delivered `ImperialScrollScene` chrome already supplies this; flag only if a scene-specific vista is wanted | z0 under overlay (excluded) |
| 4 | section row dividers | `settings-row-rule` (suggestion) | ~1244×2 | chrome | Thin gold/ink horizontal rule between option rows in the ref — currently plain list rows | inside sections-grid |
| 5 | toggle knob | `settings-toggle-orb` (suggestion) | ~36×20 | chrome | Ref's pill toggles show a jade knob on an ink track — delivered `seal-chip`/`Chip` used meanwhile | inside toggle rows |
| 6 | slider track+thumb | `slider-track` / `slider-thumb` (suggestion) | ~180×8 / ~16×16 | chrome | Ref sliders: thin jade track, round ink thumb with gold rim — HK slider chrome vars (`has-hk-slider`) already tint native range inputs | inside slider rows |

## Covered by delivered chrome (no drawing needed)

| Component surface | Delivered asset |
|---|---|
| Scroll shell (paper, rollers, title band "Cài Đặt", close seal) | `ImperialScrollScene` (ready) |
| Left icon rail (scene-switching seals) | `hk-scroll__rail` / `ImperialNavRail` (ready — scroll chrome, not settings nav) |
| Nav seal buttons | `settings-panel__nav-seal` CSS (delivered look) |
| Chip controls (locale, ui-scale, toggles) | `Chip` / `seal-chip` (ready) |
| Action buttons (save/export/import/reset/logout/update) | `GameButton` variants incl. danger (ready) |
| Slider tinting | `has-hk-slider` CSS vars on native range inputs (ready) |
| Account upgrade card | `GuestUpgradeCard` (ready) |
| Section surface | `settings-panel__section` + `scrollfade` workspace (ready) |

## Audit blocks NOT scaffolded

- **Hiển Thị section** — RESERVED by audit §17 (no real display controls yet). The nav seal still renders `display` because the existing `navSections` contract + e2e pin it (`[data-section="display"]` seal must exist); its tab holds only real controls (UI scale, language).
- **Footer Khôi Phục / Hủy / Lưu** — RESERVED: per-action confirms, no global save bar.
- **INVALID controls** — brightness, mouse sensitivity, FPS cap, graphics quality, resolution, V-sync, voice language: not scaffolded.

## Ambiguity flags

- Ref shows all sections as ONE continuous scroll; app uses a left-nav + single-active-section workspace. Kept the app's information architecture (nav contract is pinned by e2e `data-section` seals); ref's stacked-scroll layout would need a structural change — coordinator call.
- Ref's left rail is settings categories; the scroll's own icon rail (`hk-scroll__rail`) is ALSO visible at the far left, giving a double-rail look vs the ref's single rail. Kept scroll chrome as delivered — flag if the imperial rail should hide inside settings.
- `width: 100%` added to `.settings-panel` root: the decomposed version collapsed to ~24px inside the flex scroll content without it (original stretched via flex `align-items: normal` quirk). Explicit width matches the original's rendered geometry.
- Guest account tab is hidden for guest sessions (`remoteAuthoritative`-gated) per existing contract; ref shows an account block — flag if a guest-visible account section is wanted.
