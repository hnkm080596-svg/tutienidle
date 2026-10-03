# Art Requests — Scene 01 · Login (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here, so a live search for the id lands on the component and on this row.

Reference: `game/docs/design/references/huyen-kim/scenes/01-login.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655).
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper.

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `LoginSceneVista` | `auth-creation-00-sky` *(delivered)* | 1672×941 | vista | Night sky, huge golden full moon top-center with faint gold constellation/orbit rings, scattered stars | Parallax L0 (order 0, static, opaque base) |
| 2 | `LoginSceneVista` | `auth-creation-01-far-mountains` *(delivered)* | 1672×941 | vista | Farthest blue-grey misty mountain ranges, layered silhouettes fading into the sky | Parallax L1 (order 1, far-slow, drift ≤4×2) |
| 3 | `LoginSceneVista` | `auth-creation-02-mid-landscape` *(delivered)* | 1672×941 | vista | Mid-ground mountains and deep valley, faint warm lights | Parallax L2 (order 2, mid, drift ≤8×4) |
| 4 | `LoginSceneVista` | `auth-creation-03-focal-architecture` *(delivered)* | 1672×941 | vista | Golden-lit temple/pagoda complexes, waterfalls spilling into mist, cliff edges | Parallax L3 (order 3, ground, drift ≤10×5) |
| 5 | `LoginSceneVista` | `auth-creation-04-low-mist` *(delivered)* | 1672×941 | vista | Low valley cloud/mist banks drifting across the scene | Parallax L4 (order 4, mist-slow, drift ≤12×6) |
| 6 | `LoginSceneVista` | `auth-creation-05-foreground` *(delivered)* | 1672×941 | vista | Foreground: left cliff with seated long-haired cultivator (ivory robe, gold trim, facing the moon), cherry-blossom tree + petals top-left, lit stone lantern bottom-left, drifting petals | Parallax L5 (order 5, foreground, drift ≤18×9) |
| 7 | `LoginLogoBlock` | `login-logo-mountains` | ~368×120 | chrome | Dark ink-mountain silhouette plate behind the wordmark — layered black-ink peaks, slight mist at base, mounted on the parchment like a painted crest | z0 of logo block (under wordmark) |
| 8 | `LoginLogoBlock` | `login-logo-wordmark` | ~340×64 | chrome | Brush calligraphy wordmark "Tu Tiên IDLE" — gold→ivory strokes with ink-dark edge shadow, slight italic sweep. Audit class EXCEPTED: baked-text logo needs separate approval; app-rendered title is the fallback | z1 of logo block (over mountains) |
| 9 | `LoginLogoBlock` | `login-logo-seal` | ~40×40 | prop | Small cinnabar seal stamp with white glyph (仙 or studio mark), slightly rotated, at the wordmark's right-lower edge | z1, right side of logo block |
| 10 | `LoginScrollCard` | `login-scroll-lantern` | ~34×68 | prop | Glowing gold paper lantern hanging from a short chain at the frame's top-left edge — warm emissive core, jade lower cap | Outside frame left edge, hangs from top |
| 11 | `LoginScrollCard` | `login-scroll-tassel` | ~24×112 | prop | Jade bead + dark hanging tassel ornament on the frame's right edge (~26% from top), blue-green silk strands, gold collar | Outside frame right edge, hangs vertically |
| 12 | `LoginScrollCard` | `login-card-inkwash` | ~448×210 | vista | Faint ink-mountain wash painted INSIDE the parchment's lower area (very low contrast, ivory-on-paper ink), sits under the form content | Under content z3, above paper surface z1 |
| 13 | `LoginLocaleChips` | `login-icon-globe` | ~18×18 | chrome | Globe glyph — circle with meridian/parallel lines, gold hairline; icon-set gap (no stable symbol exists) | Inline, left of the locale chips |
| 14 | `AuthSecondaryActions` | `login-icon-clock` | ~20×20 | chrome | Clock / history glyph — ring + hands, gold hairline, for the "Tiếp Tục" button; icon-set gap | Inline, left of button label |
| 15 | `AuthSecondaryActions` | `login-icon-lotus` | ~20×20 | chrome | Lotus blossom glyph — three jade petals, for the "Chơi Khách" button; icon-set gap | Inline, left of button label |

## Covered by delivered chrome (no drawing needed — listed so the sheet stays complete)

| Component surface | Delivered asset |
|---|---|
| Scroll card body | `surface-xl-scroll` (ready) |
| Scroll card outer frame | `frame-xl-ceremony` (ready) |
| Card corner filigree ×4 | `corner-ornament` (ready) |
| Đăng Nhập / Đăng Ký tab banners | `tab-seal` (ready, tintable — jade active, dark inactive) |
| ID + password field boxes | `text-field` (ready) |
| Primary Đăng Nhập CTA | `button-ceremonial` (ready) |
| Tiếp Tục / Chơi Khách buttons | `button-standard` (ready, tintable) |
| "— Hoặc —" divider | `divider-ornament` (ready, tintable) |
| Locale chip backs | `seal-chip` (ready, tintable) |
| ID field person glyph | `character` stable symbol (delivered) |
| Password field lock glyph | `lock` stable symbol (delivered) |

## Explicit exclusions — do NOT draw

| Ref element | Audit class | Reason |
|---|---|---|
| "Ghi nhớ đăng nhập" checkbox | INVALID | No remember-me API exists. |
| "Quên mật khẩu?" link | INVALID | No reset flow exists. |
| Password eye-toggle (field eye icon) | RESERVED detail | Flagged as reserved chrome in the audit — not scaffolded. |
| Social-login buttons | REMOVED | Not in ref and no backend. |
| Language dropdown chrome | CORRECTED → chips | Spec replaces the ref's dropdown with `LOCALE_OPTIONS` chips at card top-right. |
