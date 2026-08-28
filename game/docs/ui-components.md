# UI Components â€” Äáº·c táº£ toÃ n bá»™ giao diá»‡n

> Cáº­p nháº­t: 2026-08-29 (sau UI primitives refactor)
> Nguá»“n sá»± tháº­t vá» mÃ u: `game/src/assets/theme.css` â€” theme **"Má»±c & Báº¡c"** (Ink & Silver)

## Tá»•ng quan

- **95 component Vue** chia theo 14 nhÃ³m thÆ° má»¥c (xem má»¥c lá»¥c).
- Stack: Vue 3 + TypeScript, CSS scoped thuáº§n. KhÃ´ng UI library (Tailwind/Element Plus...), khÃ´ng preprocessor (Sass/Less).
- RiÃªng `App.vue` dÃ¹ng `<style>` global (reset body + boot-error); `src/assets/theme.css` lÃ  biáº¿n theme toÃ n cá»¥c; má»i component cÃ²n láº¡i dÃ¹ng `<style scoped>`.
- Gáº§n nhÆ° **100% mÃ u Ä‘i qua CSS variables** â€” hex/rgba cá»©ng chá»‰ xuáº¥t hiá»‡n trong shadow vÃ  mask hiá»‡u á»©ng.
- **Lá»›p primitives (má»›i 2026-08-29)**: `common/primitives/` (Bar, Chip, Eyebrow, StatRow, EmptyState) + composite `SceneHeader` lÃ  nguá»“n sá»± tháº­t duy nháº¥t cho 6 pattern tá»«ng bá»‹ trÃ¹ng láº·p (~90 Ä‘oáº¡n CSS tá»± viáº¿t trÃªn ~30 file Ä‘Ã£ Ä‘Æ°á»£c há»£p nháº¥t). Spec: `docs/superpowers/specs/2026-08-29-ui-primitives-refactor-design.md`.
- NguyÃªn táº¯c primitives: **props chá»‰ Ä‘iá»u khiá»ƒn hÃ nh vi, má»i visual qua CSS var** â€” nÆ¡i dÃ¹ng override `style="--bar-from: var(--el-color)"` thay vÃ¬ thÃªm prop.

## Má»¥c lá»¥c

1. [Há»‡ mÃ u chuáº©n â€” theme.css](#1-há»‡-mÃ u-chuáº©n--themecss)
2. [Primitives â€” common/primitives/ (5)](#2-primitives--commonprimitives-5)
3. [Common â€” common/ (20)](#3-common--common-20)
4. [Layout â€” layout/ (4)](#4-layout--layout-4)
5. [Panels â€” panels/ (22)](#5-panels--panels-22)
6. [Panel con â€” skill-path (5)](#6-panel-con--skill-path-5)
7. [Panel con â€” bag-sections (4)](#7-panel-con--bag-sections-4)
8. [Panel con â€” loadout-sections (4)](#8-panel-con--loadout-sections-4)
9. [Panel con â€” scripture (2)](#9-panel-con--scripture-2)
10. [Panel con â€” artifact (4)](#10-panel-con--artifact-4)
11. [Combat â€” game/combat/ (10)](#11-combat--gamecombat-10)
12. [Combat HUD â€” game/combat/hud/ (6)](#12-combat-hud--gamecombathud-6)
13. [Game / Scene â€” game/ (7)](#13-game--scene--game-7)
14. [Onboarding â€” onboarding/ (2)](#14-onboarding--onboarding-2)
15. [Quy Æ°á»›c pattern toÃ n UI](#15-quy-Æ°á»›c-pattern-toÃ n-ui)

---

## 1. Há»‡ mÃ u chuáº©n â€” theme.css

**ÄÆ°á»ng dáº«n**: `game/src/assets/theme.css`. Font: *Noto Serif* (`--font-display`) + *Be Vietnam Pro* (`--font-body`), import Google Fonts.

### Thang ná»n má»±c (Ink)
| Token | Hex | Vai trÃ² |
|---|---|---|
| `--ink-950` | `#0a0a0d` | Ná»n sÃ¢u nháº¥t â€” viewport, input, track |
| `--ink-900` | `#131318` | Ná»n panel chÃ­nh |
| `--ink-800` | `#1b1b22` | Surface ná»•i â€” nÃºt secondary, slot filled |
| `--ink-700` | `#24242e` | NÃºt disabled, track bar |
| `--ink-line` | `#33333f` | Viá»n chuáº©n |
| `--ink-line-soft` | `#24242c` | Viá»n má»m |

### Há» báº¡c (Chrome) â€” thay vÃ ng tá»« 2026-08-28
| Token | Hex | Vai trÃ² |
|---|---|---|
| `--chrome-100` | `#f4f1ea` | Báº¡c tráº¯ng â€” nÃºt chÃ­nh, title, corner |
| `--chrome-300` | `#d9d4c7` | Báº¡c sÃ¡ng â€” viá»n Ä‘ang chá»n, focus |
| `--chrome-500` | `#b3ada0` | Báº¡c â€” eyebrow, viá»n ngoÃ i |
| `--chrome-700` | `#7c7870` | Báº¡c tá»‘i â€” disabled, tint ná»n onboarding |

(VÃ ng giá» **chá»‰ lÃ  mÃ u dá»¯ liá»‡u**: `--gold-100..700` â€” rank 7 "kim", Ná»™ KhÃ­, dot tráº¡ng thÃ¡i.)

### Chá»¯ / Semantic
| Token | Hex | Vai trÃ² |
|---|---|---|
| `--text-primary` | `#ebe6d9` | Chá»¯ chÃ­nh (giáº¥y ngÃ ) |
| `--text-secondary` | `#b3ada0` | Chá»¯ phá»¥ / mÃ´ táº£ |
| `--text-muted` | `#7c7870` | Chá»¯ má» / hint |
| `--jade` | `#6fbf73` | Xanh ngá»c â€” thÃ nh cÃ´ng, valid, MP |
| `--crimson` | `#e5484d` | Äá» â€” lá»—i, nguy hiá»ƒm, thiáº¿u |
| `--azure` | `#5b9bd5` | Xanh dÆ°Æ¡ng â€” info, bá»‹ cháº·n |
| `--gold-500` | `#ffd54f` | Ná»™ KhÃ­ / Kiáº¿m Ã (combat resource) |
| `--hp-color` | `#d8d5cc` | Tráº¯ng xÃ¡m â€” fill HP combat |

### Thang pháº©m cháº¥t 9 báº­c (SlotView/tooltip dÃ¹ng chung)
`--rank-color-1` xÃ¡m `#8a877e` Â· `2` báº¡c `#d8d5cc` Â· `3` lá»¥c `#6fbf73` Â· `4` thanh `#33d9d9` Â· `5` lam `#5b9bd5` Â· `6` tÃ­m `#9b7de3` Â· `7` kim `#ffd54f` Â· `8` xÃ­ch `#ff6b4a` Â· `9` `#fff6d8` + `--rank-gradient-9` (gradient 7 mÃ u vÃ²ng).
Alias: `--eq-quality-*` (9 báº­c trang bá»‹), `--grade-*` (HoÃ ng/Huyá»n/Äá»‹a/ThiÃªn/TiÃªn â†’ rank 1/3/5/7/9), `--affix-tier-1..5` (â†’ rank 1/3/5/7/9), `--affix-exalted` `#e8c74a`.

### NgÅ© HÃ nh + má»Ÿ rá»™ng
Má»™c `#7cb342` Â· Há»a `#e53935` Â· Thá»• `#a1795a` Â· Kim `#cfd8dc` Â· Thá»§y `#42a5f5` Â· Há»—n NguyÃªn `#9b5de5` Â· Phong `#4dd0e1` Â· LÃ´i `#ffca28` â€” token `--el-*`.

### Scene tokens (palette theo khu chá»©c nÄƒng)
| Khu | Token | MÃ u chá»§ Ä‘áº¡o |
|---|---|---|
| KhÃ­ ÄÆ°á»ng / Äan PhÃ²ng | `--scene-fire-*` | Ember cam (`deep #15100d`, `accent #e0a45b`, `text #f3cf8b`, `glow #ff6b1f`) |
| Äá»‹a Giá»›i (teleport) | `--scene-portal-*` | Teal (`deep #0c181c`, `accent #72c5d8`, `glow #49bdd2`) |
| Linh Tuyá»n | `--scene-water-*` | Azure (`deep #0a1216`, `accent = --azure`, `text #d6ecf9`) |
| Sáº£n Xuáº¥t â€” LÃ¢m/QuÃ¡ng/Äá»™ng | `--scene-forest/mine/grotto-*` | Xanh rá»«ng / nÃ¢u vÃ ng / teal |
| ThiÃªn Kiáº¿p | `--scene-tribulation-*` | Xanh-tÃ­m (`deep #08101e`, `line #9edaff`, `time #7658d6`, `hp #d34c4c`, `glow #69bfff`) |

### KÃ­ch thÆ°á»›c / hiá»‡u á»©ng
| Token | GiÃ¡ trá»‹ |
|---|---|
| `--radius-sm` / `--radius-md` | `4px` / `8px` |
| `--shadow-panel` | `0 8px 24px rgba(0,0,0,0.45)` |
| `--shadow-glow-chrome` | `0 0 12px rgba(217,212,199,0.35)` |
| `--scrim` / `--scrim-heavy` | `rgba(8,9,13,.76)` / `rgba(5,5,8,.92)` |
| `--focus-ring-chrome` | `0 0 0 2px rgba(217,212,199,0.65)` |
| `--space-1..6` | `4/8/12/16/24px` (khÃ´ng nhÃ¢n ui-scale) |
| `--text-xsâ€¦hero` | `12/13/14/15/16/18/20/24/32/96px` Ã— `var(--ui-scale,1)` (set runtime qua Settings 90â€“125%) |
| `--tap-min` / `--tap-comfortable` | `40px` / `44px` Ã— ui-scale |
| `--combat-*-h` | clamp chiá»u cao 4 bar combat (topbar 46â€“72 / status 44â€“68 / event 32â€“48 / control 48â€“76px) |
| Class `.ornate-frame` | Khung triá»‡n 3 lá»›p báº¡c (outer `--chrome-500` + inner `--chrome-300` + corner `--chrome-100`) â€” tháº£ `<span class="ornate-frame" />` lÃ  cÃ³ |
| Scrollbar | áº¨n toÃ n app (`scrollbar-width: none` + webkit) â€” panel váº«n scroll |

---

## 2. Primitives â€” common/primitives/ (5)

Lá»›p atom, má»—i component Ä‘Ãºng 1 pattern. Props = hÃ nh vi; visual = CSS var.

### Bar
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/primitives/Bar.vue`
- **Chá»©c nÄƒng**: Thanh fill ngang **duy nháº¥t** cá»§a toÃ n app â€” tu vi, EXP tier, production cycle, HP/MP/Ná»™ combat, countdown thiÃªn kiáº¿p, cast bar. `role="progressbar"` + aria Ä‘áº§y Ä‘á»§.
- **Props**: `value`, `max`, `height` (default 8px), `pill` (radius 999px), `anchor` (`left`/`right` â€” thu tá»« pháº£i cho Tribulation).
- **CSS var**: `--bar-track` (default `--ink-700`) Â· `--bar-from`/`--bar-to` (gradient fill; default **house style** `--jade â†’ --chrome-300`; solid = from=to â€” HP `--hp-color`, Ná»™ `--gold-500`).
- **Äáº·c táº£**: slot `label` giá»¯a bar (`tabular-nums`, text-shadow); fill transition width 200ms. Thay 17/19 bar tá»± lÃ m â€” riÃªng ArtifactCombatSlot (mask cooldown dá»c) chá»§ Ä‘Ã­ch khÃ´ng dÃ¹ng.

### Chip
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/primitives/Chip.vue`
- **Chá»©c nÄƒng**: Pill chá»n Ä‘Æ°á»£c â€” atom cho TabBar vÃ  má»i filter/mode/spec switcher.
- **Props**: `active`, `disabled`.
- **CSS var**: `--chip-active-bg` (default transparent; Settings tint `--chrome-300 12%`, SkillLoadoutStrip `--ink-700`, StageSelect filter portal-teal).
- **Äáº·c táº£**: idle `--ink-800` + viá»n `--ink-line-soft` + chá»¯ `--text-secondary`; active viá»n `--chrome-300` + chá»¯ `--chrome-100`; min-height `--tap-min`; focus ring báº¡c.

### Eyebrow
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/primitives/Eyebrow.vue`
- **Chá»©c nÄƒng**: Section title uppercase â€” chuáº©n hÃ³a dáº£i tracking .02â€“.13em cÅ© vá» 1 giÃ¡ trá»‹.
- **Props**: `as` (h3/h4/h5/span/p), `tone` (chrome/muted/inherit).
- **CSS var**: `--eyebrow-tracking` (default .04em).

### StatRow
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/primitives/StatRow.vue`
- **Chá»©c nÄƒng**: HÃ ng label â€” value cho báº£ng chá»‰ sá»‘ 2 cá»™t (thay ~14 chá»— tá»± viáº¿t).
- **Props**: `label`, `tone` (default/positive/negative/warning/muted â€” khá»›p há»‡ tone Tooltip), `bordered`; slot value (cháº¥p nháº­n span mÃ u riÃªng).
- **Äáº·c táº£**: value `tabular-nums` cÄƒn pháº£i; tone positive `--jade` / negative `--crimson` / warning `--chrome-100` / muted `--text-muted`.

### EmptyState
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/primitives/EmptyState.vue`
- **Chá»©c nÄƒng**: Khá»‘i trá»‘ng centered â€” thay ~13 div empty tá»± viáº¿t.
- **Props**: `size` (sm 8px / md 16px / lg 24px padding), `framed` (viá»n dashed `--ink-line`).

---

## 3. Common â€” common/ (20)

### SceneHeader *(composite, 2026-08-29)*
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/SceneHeader.vue`
- **Chá»©c nÄƒng**: Khá»‘i scene header dÃ¹ng chung 4 panel cÃ³ artwork (KhÃ­ ÄÆ°á»ng, Äá»‹a Giá»›i, Linh Tuyá»n, Äan PhÃ²ng) â€” áº£nh full-bleed + scrim + caption + slot decoration.
- **Props**: `asset`, `scene` (`fire`/`portal`/`water` â†’ tá»± map cá»¥m `--scene-deep/accent/text/text-soft/glow` scope), `height`, `objectPosition`, `imageOpacity`, `caption`.
- **Slots**: `decoration` (forge-fire, vÃ²ng portal, orb, lÃµi Ä‘an â€” cÃ¡ tÃ­nh tá»«ng panel) + default (ná»™i dung chá»“ng, StageSelect dÃ¹ng row header).
- **Äáº·c táº£**: caption bottom-left Noto Serif `--text-sm` letter-spacing .18em text-shadow; scrim gradient dá»c máº·c Ä‘á»‹nh (StageSelect override gradient ngang portal).

### GameButton
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/GameButton.vue`
- **Chá»©c nÄƒng**: NÃºt chuáº©n toÃ n game â€” spinner loading, hover nháº¥c nháº¹, 4 variant Ã— 3 size Ã— 2 shape.
- **Props**: `variant` (primary/secondary/danger/ghost), `size` (sm/md/lg), `shape` (rect/circle â€” nÃºt icon trÃ²n "+"), `accentVar` (tÃªn CSS var â€” gradient accent scene, vd `--scene-fire-text` lÃ² Ä‘an), `disabled`, `loading`, `type`.
- **MÃ u sáº¯c**:
  - Primary: gradient `--chrome-100 â†’ --chrome-500`, chá»¯ `--ink-950`, hover glow `--shadow-glow-chrome`
  - Secondary: ná»n `--ink-800`, viá»n `--ink-line`, hover viá»n `--chrome-300`
  - Danger: ná»n `--crimson`, chá»¯ `#fff`, hover glow Ä‘á»
  - Ghost: trong suá»‘t, chá»¯ `--text-secondary`, hover `--chrome-100`
  - accentVar: gradient `var(--button-accent) â†’ color-mix(accent 72%, --ink-950)`
- **Äáº·c táº£**: radius `--radius-sm`; font-weight 700; sm `--tap-min` / md `--tap-comfortable` / lg +8px; disabled opacity .55; hover `translateY(-1px)`; spinner 12px 0.6s.

### GamePanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/GamePanel.vue`
- **Chá»©c nÄƒng**: Panel ná»n chuáº©n má»i khá»‘i ná»™i dung â€” header (title + slot header-actions) + body slot.
- **Props**: `title?`, `variant` (default/compact/ornate), `padding` (none/sm/md).
- **MÃ u sáº¯c**: default gradient `160deg --ink-900 â†’ --ink-800` viá»n `--ink-line`; ornate gradient `--ink-950 â†’ --ink-800` + `.ornate-frame`; title `--chrome-100`.
- **Äáº·c táº£**: radius `--radius-md` (compact `--radius-sm`), shadow `--shadow-panel`; title Noto Serif `--text-panel-title` letter-spacing .04em.

### OverlayPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/OverlayPanel.vue`
- **Chá»©c nÄƒng**: Overlay dialog giá»¯a mÃ n hÃ¬nh dÃ¹ng chung â€” click backdrop Ä‘á»ƒ Ä‘Ã³ng (khÃ¡c ConfirmModal). **Fit-engine (2026-08-29)**: body lÃ  ngÃ¢n sÃ¡ch flex cho ná»™i dung (con flex-fit hoáº·c paginate, khÃ´ng scroll); card cÃ³ `container-type: inline-size` (tÃªn `overlay-panel`) â€” má»i panel con Ä‘o theo CARD, khÃ´ng pháº£i viewport.
- **Props**: `open`, `title`, `width` (default `min(900px, 94vw)`), `height`, `layer` (z-index).
- **Props**: `open`, `title`, `width` (default `min(900px, 94vw)`), `height`, `layer` (z-index).
- **MÃ u sáº¯c**: backdrop `--scrim` + blur 4px; card gradient `155deg --ink-800 â†’ --ink-950` viá»n `1px --chrome-500`; h3 `--chrome-100`.
- **Äáº·c táº£**: max-height 94vh, radius `--radius-md`, shadow `--shadow-panel`; nÃºt âœ• vuÃ´ng `--tap-min`; enter/leave `translateY(12px) scale(.985)` 0.2s.

### TabBar
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/TabBar.vue` â€” rebuild trÃªn Chip (2026-08-29).
- **Chá»©c nÄƒng**: Thanh tab Ä‘iá»u hÆ°á»›ng dáº¡ng grid, badge sá»‘ tÃ¹y chá»n (NotificationBadge).
- **Props**: `tabs` ({id, label, badge?}[]), `modelValue` (v-model), `columns`, `layout` (`grid` Ä‘á»u cá»™t / `row` flex:1 tá»«ng chip).
- **Äáº·c táº£**: item lÃ  Chip; badge offset `-4px`; gap `--space-1`.

### SlotView
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/SlotView.vue` (+ `SlotTypes.ts`)
- **Chá»©c nÄƒng**: Ã” item generic â€” icon PNG/monogram chá»¯, tint mÃ u theo Quality rank (1â€“9), chip Pháº©m, glyph validation âœ“/âœ•/!, marker â— Ä‘ang máº·c/NEW, mÅ©i tÃªn so sÃ¡nh â–²/â–¼, badge, sá»‘ lÆ°á»£ng xN, caption tÃªn nhiá»u mÃ u, veil khÃ³a ðŸ”’/disabled âŠ˜/spinner.
- **Props**: `item` (null = trá»‘ng), `icon`, `nameSegments`, `equipmentQualityRank` (1â€“9), `rarityRank`, `state` (5 trá»¥c semantic), `badges`, `amount`...
- **MÃ u sáº¯c**: surface trá»‘ng `--slot-surface` (`--ink-900`) / cÃ³ item `--slot-surface-raised` (`--ink-800`); viá»n theo `--slot-quality-color` (`--rank-color-N`); rank 9 glow + gradient 7 mÃ u; valid `--jade`, invalid `--crimson`.
- **Äáº·c táº£**: aspect-ratio 1:1, radius `--radius-sm`; icon 84%; glyph 13px top-left; chip 8px top-right; hover icon `translateY(-1px)`; dÃ¹ng `aria-disabled` (giá»¯ tooltip).

### Tooltip
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/Tooltip.vue`
- **Chá»©c nÄƒng**: Tooltip global (Teleport + Floating UI) â€” kind: technique / graded item (Pháº©m) / equipment (giá»¯ Alt = advanced) / building / plain; accent Ä‘á»™ng theo rank.
- **MÃ u sáº¯c**: viá»n trÃ¡i 3px accent (`--rank-color-N` â†’ `--tooltip-accent`); ná»n gradient má»±c pha accent 12%; row tones: positive `--jade`, negative `--crimson`, warning `--chrome-100`, special `--affix-exalted`; tier 5 chá»¯ gradient 7 mÃ u.
- **Äáº·c táº£**: max-width plain 240 / rich 320 / equipment 380px; icon-shell 54px; fade 35/30ms; prefers-reduced-motion.

### ToastContainer
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/ToastContainer.vue`
- **Chá»©c nÄƒng**: Toast neo gÃ³c trÃªn pháº£i (Teleport) â€” toast loot icon + eyebrow "NHáº¬N ÄÆ¯á»¢C" + tÃªn nhiá»u mÃ u + sá»‘ lÆ°á»£ng; sá»‘ toast theo chiá»u cao mÃ n hÃ¬nh.
- **MÃ u sáº¯c**: ná»n `--ink-900` 96% alpha; viá»n trÃ¡i 3px mÃ u kind â€” loot `--jade`, craft/warning `--chrome-300`, save `--azure`, error `--crimson`.
- **Äáº·c táº£**: `top/right: 24px; z-1500`; toast max-width 160px font `--text-xs`; enter slide `translateX(56px)` 0.4s.

### NotificationBadge
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/NotificationBadge.vue`
- **Chá»©c nÄƒng**: Badge Ä‘á» idle-game â€” dot (cÃ³/khÃ´ng) hoáº·c count ("99+").
- **MÃ u sáº¯c**: ná»n `--crimson`, viá»n `--ink-950`, chá»¯ `#fff`, glow Ä‘á».
- **Äáº·c táº£**: radius `999px`; dot 9Ã—9px; count min-width 16px.

### ActionFeedbackLog
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/ActionFeedbackLog.vue`
- **Chá»©c nÄƒng**: "Nháº­t kÃ½ thao tÃ¡c" â€” feedback action gameplay, neo gÃ³c dÆ°á»›i pháº£i.
- **MÃ u sáº¯c**: viá»n trÃ¡i 3px `--entry-color` theo tone â€” success `--jade`, warning `--chrome-300`, error `--crimson`; ná»n `--ink-900` alpha.
- **Äáº·c táº£**: `fixed; right/bottom: 24px; z-1200`; width `min(320px, 90vw)`; entry cÅ© opacity .75.

### ConfirmModal
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/ConfirmModal.vue`
- **Chá»©c nÄƒng**: Modal xÃ¡c nháº­n (thay `window.confirm`) â€” KHÃ”NG Ä‘Ã³ng khi click backdrop.
- **Props**: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `danger`.
- **MÃ u sáº¯c**: backdrop `--scrim` + blur 4px; card gradient `160deg --ink-950 â†’ --ink-800` + `.ornate-frame`; nÃºt qua GameButton.
- **Äáº·c táº£**: card `min(420px, 92vw)`; `role="alertdialog"`.

### OfflineSummaryModal
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/OfflineSummaryModal.vue`
- **Chá»©c nÄƒng**: "Báº¾ QUAN Káº¾T THÃšC" â€” 2 StatRow (Thá»i gian, + Linh lá»±c tone positive) + nÃºt Tiáº¿p Tá»¥c.
- **Äáº·c táº£**: `z-1800`; GamePanel ornate; StatRow value 600 weight.

### LoadingScreen
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/LoadingScreen.vue`
- **Chá»©c nÄƒng**: MÃ n boot "TIÃŠN HIá»†P IDLE" + vÃ²ng pulse.
- **MÃ u sáº¯c**: ná»n `--ink-950`; title `--chrome-100`; vÃ²ng `2px solid --chrome-100`.
- **Äáº·c táº£**: full 100vwÃ—100vh; pulse 36px scale .8â†”1.1 1.1s infinite.

### ErrorBoundary / ErrorScreen
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/ErrorBoundary.vue` / `ErrorScreen.vue`
- **Chá»©c nÄƒng**: Boundary = renderless, báº¯t lá»—i cÃ¢y con Ä‘áº©y errorStore. Screen = overlay full-screen â€” Thá»­ Láº¡i / Vá» Trang Chá»§.
- **MÃ u sáº¯c** (Screen): backdrop `--scrim-heavy`; panel gradient má»±c + `.ornate-frame`; title **`--crimson`**.
- **Äáº·c táº£**: `z-3000`; panel max 420px.

### SaveIncompatibleScreen
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/SaveIncompatibleScreen.vue`
- **Chá»©c nÄƒng**: Full-screen khi save há»ng â€” Táº£i save / Nháº­p save / XoÃ¡ & báº¯t Ä‘áº§u má»›i (danger qua ConfirmModal).
- **Äáº·c táº£**: `z-4000`; panel max 460px; input file áº©n phá»§ label.

### WorldAnnouncementOverlay
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/WorldAnnouncementOverlay.vue`
- **Chá»©c nÄƒng**: ThÃ´ng bÃ¡o Ä‘áº¡i sá»± â€” tiÃªu Ä‘á» lá»›n + body typewriter 28ms/kÃ½ tá»±, click Ä‘Ã³ng.
- **MÃ u sáº¯c**: backdrop `--scrim-heavy`; title `--chrome-100` + glow 24px.
- **Äáº·c táº£**: `z-2000`; title `--text-display-lg`.

### TutorialOverlay
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/TutorialOverlay.vue`
- **Chá»©c nÄƒng**: HÆ°á»›ng dáº«n láº§n Ä‘áº§u â€” progress "x / y", Bá» Qua (ghost) / Tiáº¿p Theo (primary).
- **Äáº·c táº£**: `z-1900`; panel `min(420px, 92vw)`.

### PlayerPortrait
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/PlayerPortrait.vue`
- **Chá»©c nÄƒng**: áº¢nh PNG nhÃ¢n váº­t â€” variant 'cultivate' (animation float/breathe/aura/qi-ring khi `animated`) hoáº·c 'portrait' (tÄ©nh).
- **Props**: `variant`, `height` (default 239), `animated`.
- **MÃ u sáº¯c**: aura radial `--chrome-500` 22% blur 10px; qi-ring viá»n `--chrome-500` 42%.
- **Äáº·c táº£**: float 6s; breathe 5s; qi-ring ellipse 3/1 6s; prefers-reduced-motion.

### BreakthroughRequirementPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/common/BreakthroughRequirementPanel.vue`
- **Chá»©c nÄƒng**: Panel Äá»™t PhÃ¡ trÆ°á»›c Äá»™ Kiáº¿p â€” 1 slot váº­t pháº©m, nÃºt Luyá»‡n (Linh Tháº¡ch), ÄÃ³ng / Äá»™ Kiáº¿p (GameButton).
- **MÃ u sáº¯c**: slot viá»n `--ink-700` â†’ ready `--jade`.

---

## 4. Layout â€” layout/ (4)

### GameRoot
- **ÄÆ°á»ng dáº«n**: `game/src/components/layout/GameRoot.vue`
- **Chá»©c nÄƒng**: Root layout â€” mount MainScene + má»i lá»›p chrome (panels, overlays, toasts, tooltip, modals); combat active thÃ¬ áº©n chrome Äá»™ng Phá»§, hiá»‡n Combat/Tribulation overlay; click vÃ¹ng trá»‘ng Ä‘Ã³ng panel.
- **MÃ u sáº¯c**: ná»n `--ink-950`; shadow popover `rgba(0,0,0,.68)`.
- **Äáº·c táº£**: viewport 100vwÃ—100vh overflow hidden; left panel absolute `clamp(360px, 30vw, 480px)` z-10, container query; â‰¤900px â†’ `min(44vw, 400px)`; popover layer z-20.

### LeftPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/layout/LeftPanel.vue`
- **Chá»©c nÄƒng**: Drawer trÃ¡i â€” CharacterPanel (hoáº·c Equipment 30% + content 70%).
- **MÃ u sáº¯c**: ná»n `--ink-900`; viá»n pháº£i `--ink-line`; shadow `--shadow-panel`.
- **Äáº·c táº£**: slide `translateX(-100%)` + `blur(12px)` .28s ease.

### RightPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/layout/RightPanel.vue`
- **Chá»©c nÄƒng**: Drawer pháº£i â€” EquipmentPaperdoll 30% + InventoryPanel 70%.
- **Äáº·c táº£**: `clamp(340px, 27vw, 440px)`; slide `translateX(100%)` .28s; container query `right-panel`.

### FunctionOverlayPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/layout/FunctionOverlayPanel.vue`
- **Chá»©c nÄƒng**: Modal trung tÃ¢m Ä‘iá»u phá»‘i 7 panel chá»©c nÄƒng theo `ui.leftPanelMode` (Sáº£n Xuáº¥t, CÃ i Äáº·t, KhÃ­ ÄÆ°á»ng, Äan PhÃ²ng, Linh Tuyá»n, TÃ ng Kinh CÃ¡c, Äá»‹a Giá»›i).
- **Äáº·c táº£**: OverlayPanel `min(1120px, 94vw) Ã— min(820px, 92vh)`.

---

## 5. Panels â€” panels/ (22)

### CharacterPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/CharacterPanel.vue`
- **Chá»©c nÄƒng**: Panel NhÃ¢n Váº­t â€” chÃ¢n dung + aura mÃ u há»‡ nghá», tÃªn/cáº£nh giá»›i/Chiáº¿n Lá»±c, ThiÃªn PhÃº, 5 nhÃ³m chá»‰ sá»‘ (nÃºt "+" = GameButton circle), báº£n Ä‘á»“ NgÅ© HÃ nh chip pentagram + Há»—n NguyÃªn, chip buff Ä‘an.
- **MÃ u sáº¯c**: aura radial `--aura` (mÃ u element, fallback `--chrome-500`); tier thiÃªn phÃº â†’ `--rank-color-1/3/5/7/8`.
- **Äáº·c táº£**: figure 112Ã—116px aura breathe 5s; chip absolute 260Ã—310px ngÅ© giÃ¡c.

### RealmPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/RealmPanel.vue`
- **Chá»©c nÄƒng**: Overlay Cáº£nh Giá»›i â€” chÃ¢n dung animated, thanh Tu Vi (**Bar 24px pill, label trong bar**), nÃºt Ä‘áº¡i Ä‘á»™t phÃ¡ (GameButton), 9 node cáº£nh giá»›i, lÆ°á»›i passive.
- **MÃ u sáº¯c**: node complete `--jade`, current `--chrome-300` + glow báº¡c; Bar default house style; override `--bar-track: --ink-950`.
- **Äáº·c táº£**: OverlayPanel `min(1120px,94vw) Ã— min(760px,90vh)`; node hÃ¬nh khiÃªn `50% 50% 12px 12px` ná»‘i ::after.

### LuyenThePanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/LuyenThePanel.vue`
- **Chá»©c nÄƒng**: Overlay Luyá»‡n Thá»ƒ â€” Ä‘áº§u tÆ° Tinh Hoa theo táº§ng, toggle tá»± Ä‘á»™ng, 6 tier (done/active/realm_locked/locked).
- **Primitives**: Bar 5px, GameButton secondary (invest), EmptyState lg.
- **MÃ u sáº¯c**: active tier viá»n `--chrome-300`; khÃ³a realm `--crimson`; auto label `--jade`.

### QuanKhiPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/QuanKhiPanel.vue`
- **Chá»©c nÄƒng**: Overlay QuÃ¡n KhÃ­ â€” chá»n con Ä‘Æ°á»ng tu luyá»‡n KHÃ”NG thá»ƒ Ä‘á»•i (confirm danger); Kiáº¿m Tu: chá»n Ä‘Æ°á»ng Kiáº¿m Tráº­n/Báº¡t Kiáº¿m (reversible).
- **Primitives**: GameButton danger + **override gradient crimson chá»§ Ä‘Ã­ch** (signaling nghi thá»©c vÄ©nh viá»…n): `linear-gradient(180deg, --crimson, --ink-800)` viá»n `--chrome-500`; selected gradient jade + glow.
- **Äáº·c táº£**: OverlayPanel 480px; nÃºt full-width.

### SkillPathPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/SkillPathPanel.vue`
- **Chá»©c nÄƒng**: Overlay Ká»¹ NÄƒng 3 cá»™t (1400px): trÃ¡i SkillPathList/ElementPathList, giá»¯a NodeTreePanel (PhÃ¡p Tu) hoáº·c SkillDetailView, pháº£i SkillLoadoutStrip, Ä‘Ã¡y NodeInspector.
- **MÃ u sáº¯c**: viá»n chia cá»™t `--ink-line`; Ä‘iá»ƒm Cáº£m Ngá»™ `--chrome-100`; cÃ¢y áº©n Huy Kiáº¿m: node `--jade` glow 18px.
- **Äáº·c táº£**: grid `20% / auto / 22%`; node Huy Kiáº¿m elip 112Ã—72px.

### TechniquePanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/TechniquePanel.vue`
- **Chá»©c nÄƒng**: Overlay TÃ¢m PhÃ¡p â€” tháº» hero (TechniqueSlotCard), thanh EXP tier (**Bar 5px**), nhÃ³m Chiáº¿n Äáº¥u/Tu Luyá»‡n (**Eyebrow + StatRow bordered**).
- **Äáº·c táº£**: OverlayPanel `min(560px, 90vw)`.

### InventoryPanel / BagGrid
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/InventoryPanel.vue` / `BagGrid.vue`
- **Chá»©c nÄƒng**: InventoryPanel = wrapper má»ng. BagGrid = khung HÃ nh Trang â€” header "Kho Váº­t / N" + **TabBar 3 tab** (Trang Bá»‹/NguyÃªn Liá»‡u/Äan DÆ°á»£c) Ä‘á»•i BagSection.
- **Äáº·c táº£**: gáº§n nhÆ° khÃ´ng mÃ u riÃªng â€” mÃ u á»Ÿ TabBar + section con.

### EquipmentHallPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/EquipmentHallPanel.vue`
- **Chá»©c nÄƒng**: KhÃ­ ÄÆ°á»ng â€” rÃ¨n trang bá»‹ 4 tab (**TabBar**): CÆ°á»ng HÃ³a / Táº©y Luyá»‡n / Tinh Luyá»‡n / HÃ³a Luyá»‡n (multi-select + confirm 2 bÆ°á»›c).
- **Primitives**: **SceneHeader fire 132px** (decoration: forge-fire + anvil âš’), TabBar, GameButton, SlotView.
- **MÃ u sáº¯c**: scene lá»­a â€” ná»n `--scene-fire-deep`, chá»¯ `--scene-fire-text` `#f3cf8b`; thiáº¿u chi phÃ­ `--crimson`; preview reward `--jade`.
- **Äáº·c táº£**: áº£nh `sepia(.18) saturate(1.25)`; forge-fire 85Ã—95px animation 1.35s; grid slot `repeat(6, minmax(70px,1fr))` â†’ 3 cá»™t mobile.

### EquipmentPaperdoll
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/EquipmentPaperdoll.vue`
- **Chá»©c nÄƒng**: 6 slot trang bá»‹ lÆ°á»›i 3Ã—2 â€” SlotView Ä‘áº§y Ä‘á»§, click thÃ¡o Ä‘á»“.
- **Äáº·c táº£**: grid 3Ã—2 gap 6px; slot vuÃ´ng aspect 1:1; khÃ´ng mÃ u riÃªng (token `--slot-*`).

### ArtifactPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/ArtifactPanel.vue`
- **Chá»©c nÄƒng**: Overlay Báº£n Má»‡nh PhÃ¡p Báº£o â€” ghÃ©p 4 con (Overview + ExperienceBar + GradeSection + PathCards); 2 **EmptyState lg** cho state chÆ°a cÃ³ definition / chÆ°a thá»©c tá»‰nh.
- **Äáº·c táº£**: OverlayPanel `min(560px,92vw) Ã— min(720px,88vh)`.

### QuestPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/QuestPanel.vue`
- **Chá»©c nÄƒng**: Overlay Nhiá»‡m Vá»¥ â€” 2 nhÃ³m (HÃ ng NgÃ y/Nhiá»‡m Vá»¥), card + **Bar 6px** (override `--chrome-300` solid) + nÃºt Nháº­n ThÆ°á»Ÿng (GameButton).
- **Äáº·c táº£**: OverlayPanel 760Ã—640.

### ProductionPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/ProductionPanel.vue`
- **Chá»©c nÄƒng**: Sáº£n Xuáº¥t â€” 3 card Ä‘iá»ƒm tÃ i nguyÃªn (LÃ¢m/QuÃ¡ng/Äá»™ng ThiÃªn) sigil HÃ¡n (æœ¨/ç¤¦/è—¥), **Bar 8px** (fill transition .5s linear), Auto, nÃ¢ng cáº¥p; bá»c BuildingConstructionGate.
- **Primitives**: Bar, GameButton (start sm primary / upgrade ghost / convert sm).
- **MÃ u sáº¯c**: má»—i loáº¡i card 1 palette â€” forest/mine/grotto qua `--scene-forest/mine/grotto-*`; stats `--jade`.

### PillRoomPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/PillRoomPanel.vue`
- **Chá»©c nÄƒng**: Äan PhÃ²ng â€” 2 táº§ng: AlchemyView (60%) + PillBagSection (40%).
- **Äáº·c táº£**: chá»‰ viá»n chia `--ink-line` â€” mÃ u á»Ÿ 2 con.

### AlchemyView
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/AlchemyView.vue`
- **Chá»©c nÄƒng**: Luyá»‡n Äan 2 cá»™t â€” **SceneHeader fire 150px** (lÃµi Ä‘an ä¸¹) + 8 Ä‘an phÆ°Æ¡ng / preview, chi phÃ­ (**StatRow negative khi thiáº¿u**), nÃºt Báº¯t Ä‘áº§u luyá»‡n (GameButton **accentVar `--scene-fire-text`**), lÃ² Ä‘ang cháº¡y (**Bar 6px**) + Huá»· (ghost).
- **MÃ u sáº¯c**: scene lá»­a â€” nÃºt luyá»‡n gradient vÃ ng lá»­a; outcome `--jade`; thiáº¿u/huá»· `--crimson`.

### SpiritSpringPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/SpiritSpringPanel.vue`
- **Chá»©c nÄƒng**: Linh Tuyá»n â€” **SceneHeader water 210px** (orb animation) + **Bar 8px pill** (override `--scene-water-accent â†’ --jade`) + Thu hoáº¡ch / Ä‘á»•i pháº©m (GameButton override ná»n azure Ä‘áº·c).
- **Äáº·c táº£**: orb 42px animation `spring-orb` 2.2s (ná»•i -8px + scale 1.08).

### StageSelectPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/StageSelectPanel.vue`
- **Chá»©c nÄƒng**: Chá»n tráº­n â€” **SceneHeader portal 118px** (row copy + vÃ²ng ç•Œ) â†’ filter Äá»‹a Giá»›i/Cáº£nh Giá»›i (**Chip portal-teal override**) â†’ táº§ng map 5 cá»™t â†’ cháº¿ Ä‘á»™ (**Chip Ã—3**: Thá»§ CÃ´ng/Láº·p Láº¡i/Tá»± Äá»™ng) â†’ Báº¯t Ä‘áº§u (GameButton).
- **MÃ u sáº¯c**: ná»n `--scene-portal-deep` teal; node boss/final `--crimson`; BOSS chá»¯ `--crimson` 62% + white.
- **Äáº·c táº£**: grid 5 cá»™t node min-height 94px; 2 EmptyState (chÆ°a cÃ³ táº§ng sm / chá»n táº§ng lg).

### ScripturePavilionPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/ScripturePavilionPanel.vue`
- **Chá»©c nÄƒng**: TÃ ng Kinh CÃ¡c â€” **TabBar layout row 2 tab** (CÃ´ng PhÃ¡p / Lore) Ä‘á»•i TechniqueCodex / LoreCodex.
- **Äáº·c táº£**: gáº§n nhÆ° khÃ´ng mÃ u riÃªng â€” chá»‰ khung Ä‘iá»u phá»‘i.

### LoreCodexModal
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/LoreCodexModal.vue`
- **Chá»©c nÄƒng**: Modal Ä‘á»c lore item (Teleport) â€” nÃºt ÄÃ³ng (GameButton secondary sm).
- **MÃ u sáº¯c**: backdrop `--scrim`; panel `--ink-900` viá»n `--chrome-500`.
- **Äáº·c táº£**: `min(340px,92vw)` â†’ max 480px, max-height 84vh; `white-space: pre-line`.

### SettingsPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/SettingsPanel.vue`
- **Chá»©c nÄƒng**: CÃ i Äáº·t â€” save (lÆ°u/táº£i/xuáº¥t/nháº­p/xoÃ¡ qua ConfirmModal) + cá»¡ chá»¯ UI 90â€“125% (**Chips** `--chip-active-bg: --chrome-300 12%`).
- **Äáº·c táº£**: radius `--radius-sm`; input file áº©n phá»§ label.

### BuildingPanelHeader
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/BuildingPanelHeader.vue`
- **Chá»©c nÄƒng**: Header panel cÃ´ng trÃ¬nh â€” áº£nh trÃ²n, tÃªn + cáº¥p, nÃºt NÃ¢ng (GameButton sm + viá»n `--chrome-300` riÃªng).
- **MÃ u sáº¯c**: gradient ngang `--ink-900 â†’ --ink-950`; artwork viá»n `--chrome-500` 40% + glow; cáº¥p `--jade`.
- **Äáº·c táº£**: min-height 88px; artwork 74Ã—64px `border-radius: 50% 50% --radius-sm --radius-sm`.

### BuildingConstructionGate
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/BuildingConstructionGate.vue`
- **Chá»©c nÄƒng**: Gate cÃ´ng trÃ¬nh â€” chÆ°a xÃ¢y hiá»‡n mÃ n khÃ³a (icon chá»¯ + chi phÃ­ + nÃºt XÃ¢y Dá»±ng GameButton); Ä‘Ã£ xÃ¢y render slot.
- **Äáº·c táº£**: mÃ n khÃ³a cÄƒn giá»¯a cá»™t; disabled opacity .5.

---

## 6. Panel con â€” skill-path (5)

### SkillPathList
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/skill-path/SkillPathList.vue`
- **Chá»©c nÄƒng**: Cá»™t trÃ¡i cho path KHÃ”NG cÃ³ Node Tree (Kiáº¿m Tu/PhÃ m) â€” list skill nhÃ³m theo cáº£nh giá»›i.
- **MÃ u sáº¯c**: card `--ink-800`; selected ná»n `--chrome-300` 18% + viá»n `--chrome-300`.

### ElementPathList
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/skill-path/ElementPathList.vue`
- **Chá»©c nÄƒng**: Cá»™t trÃ¡i PhÃ¡p Tu â€” chá»n HÃ nh (Há»a/Má»™c/Thá»§y/Kim/Thá»• + Phong/LÃ´i ðŸ”’), tiáº¿n Ä‘á»™ lÄ©nh ngá»™ (**Bar 3px** mÃ u Ä‘á»™ng `--bar-from/--bar-to = --el-color`).
- **MÃ u sáº¯c**: selected ná»n + viá»n + glow `--el-color`; locked opacity .55.

### SkillDetailView
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/skill-path/SkillDetailView.vue`
- **Chá»©c nÄƒng**: Cá»™t giá»¯a path khÃ´ng Node Tree â€” chi tiáº¿t skill: tÃªn, mÃ´ táº£, nÃºt NÃ¢ng Cáº¥p (GameButton ghost + viá»n `--chrome-500`), báº£ng thÃ´ng sá»‘ (**StatRow bordered Ã—3**); EmptyState lg khi chÆ°a chá»n.
- **Äáº·c táº£**: empty padding 40px.

### SkillLoadoutStrip
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/skill-path/SkillLoadoutStrip.vue`
- **Chá»©c nÄƒng**: Dáº£i "PhÃ¡p Thuáº­t Äang Váº­n HÃ nh" â€” Ã´ loadout (SlotView) má»Ÿ RadialSkillSelector; nÃºt specialization (**Chips** `--chip-active-bg: --ink-700`); slot khÃ³a má» opacity .45.
- **Äáº·c táº£**: slot flex `1 1 30%` min-width 64px tá»± wrap.

### NodeInspector
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/skill-path/NodeInspector.vue`
- **Chá»©c nÄƒng**: ÄÃ¡y SkillPathPanel â€” chi tiáº¿t node: badge cáº¥p, tráº¡ng thÃ¡i (ÄÃ£ LÄ©nh Ngá»™ `--jade` / CÃ³ Thá»ƒ `--chrome-100` / ChÆ°a Äá»§ `--text-muted`), lÃ½ do khÃ³a `--crimson`, stat áº£nh hÆ°á»Ÿng (**StatRow bordered**), nÃºt LÄ©nh Ngá»™/NÃ¢ng Cáº¥p (GameButton sm viá»n `--chrome-100`); EmptyState lg.
- **Äáº·c táº£**: badge pill 999px.

---

## 7. Panel con â€” bag-sections (4)

### PillBagSection
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/bag-sections/PillBagSection.vue`
- **Chá»©c nÄƒng**: Grid Ä‘an dÆ°á»£c â€” buff regen Ä‘ang cháº¡y deadline tháº­t, tooltip Ä‘áº§y Ä‘á»§, sort 4 mode + pagination, click uá»‘ng Ä‘an.
- **MÃ u sáº¯c**: buff box `--ink-800` viá»n `--jade`; giÃ¡ trá»‹ `--jade`; Ä‘áº¿m ngÆ°á»£c `--chrome-500`.
- **Äáº·c táº£**: grid responsive ResizeObserver (`--grid-columns` Ä‘á»™ng); slot vuÃ´ng 1:1; mÃ u pháº©m qua `--grade-*`.

### MaterialBagSection
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/bag-sections/MaterialBagSection.vue`
- **Chá»©c nÄƒng**: Grid nguyÃªn liá»‡u â€” sort 5 mode, Linh Tháº¡ch ghim Ä‘áº§u, tooltip phÃ¢n loáº¡i/nguá»“n/niÃªn Ä‘áº¡i; thuáº§n hiá»ƒn thá»‹.
- **Äáº·c táº£**: khÃ´ng mÃ u riÃªng â€” SlotView + grade token.

### EquipmentBagSection
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/bag-sections/EquipmentBagSection.vue`
- **Chá»©c nÄƒng**: Grid trang bá»‹ chÆ°a máº·c â€” click máº·c; tooltip Alt so sÃ¡nh; sort 6 mode.
- **Äáº·c táº£**: khÃ´ng mÃ u riÃªng â€” rank qua SlotView.

### BagPaginationControls
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/bag-sections/BagPaginationControls.vue`
- **Chá»©c nÄƒng**: Footer chung 3 bag-section â€” pagination `â€¹ 1 2 3 â€º` giá»¯a + nÃºt sort menu tháº£ LÃŠN (mode/Ä‘áº£o chiá»u/reset); khung háº¹p áº©n label.
- **MÃ u sáº¯c**: page active gradient báº¡c; menu `--ink-900` viá»n `--chrome-500` shadow panel.
- **Äáº·c táº£**: grid `1fr auto 1fr`; menu z-30; container query â‰¤420px; sort button tá»± viáº¿t (aria-haspopup + SVG inline â€” khÃ´ng pháº£i chip cluster).

---

## 8. Panel con â€” loadout-sections (4)

### TechniqueSlotCard
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/loadout-sections/TechniqueSlotCard.vue`
- **Chá»©c nÄƒng**: Tháº» TÃ¢m PhÃ¡p trang bá»‹ (thuáº§n hiá»ƒn thá»‹) â€” SlotView + tÃªn + badge tier + **Bar 4px** + "X/Y" hoáº·c "ViÃªn MÃ£n"; biáº¿n thá»ƒ `hero` layout dá»c + badge "ÄANG TU LUYá»†N".
- **MÃ u sáº¯c**: badge tier viá»n `--chrome-500`; status `--jade`; Bar house style.
- **Äáº·c táº£**: normal icon 56px / hero icon 46% width; v-tooltip cáº¥u trÃºc.

### RadialSkillSelector
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/loadout-sections/RadialSkillSelector.vue`
- **Chá»©c nÄƒng**: Overlay chá»n skill vÃ²ng trÃ²n â€” skill viable xáº¿p quanh tÃ¢m (trigonometry JS), tÃ¢m hiá»‡n slot + nÃºt Gá»¡.
- **MÃ u sáº¯c**: backdrop `--scrim`; tÃ¢m `--ink-900` viá»n `2px --chrome-300` + glow; Gá»¡ `--crimson`; current `--jade`.
- **Äáº·c táº£**: tÃ¢m 88px; item 72px; bÃ¡n kÃ­nh min 108px tá»± tÃ­nh.

### NodeTreePanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/loadout-sections/NodeTreePanel.vue`
- **Chá»©c nÄƒng**: CÃ¢y node PhÃ¡p Tu theo branch â€” depth tháº­t, node card click chá»n, SVG SkillConnections, animation unlock 2 pha (flow 750ms â†’ pulse/ring 500ms).
- **MÃ u sáº¯c**: node `--ink-800`; purchased ná»n `--branch-color` 18%; viá»n theo `--branch-color` (mÃ u hÃ nh); unlocking `--chrome-300` + glow 14px.
- **Äáº·c táº£**: node 140px; tier cÃ¡ch 22px; locked opacity .5 váº«n click.

### SkillConnections
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/loadout-sections/SkillConnections.vue`
- **Chá»©c nÄƒng**: Layer SVG Ä‘Æ°á»ng ná»‘i parentâ†’child â€” 3 tráº¡ng thÃ¡i locked/active/unlocking.
- **MÃ u sáº¯c**: stroke `--branch-color` opacity .3/.75; unlocking `--chrome-300` 2.5px + drop-shadow.
- **Äáº·c táº£**: bezier; unlocking `stroke-dasharray: 10 8` animation flow 750ms.

---

## 9. Panel con â€” scripture (2)

### TechniqueCodex
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/scripture/TechniqueCodex.vue`
- **Chá»©c nÄƒng**: Tab CÃ´ng PhÃ¡p â€” 1 tháº» hero + grid SlotView má»i cÃ´ng phÃ¡p; chÆ°a há»c "???" má» khÃ´ng click.
- **Äáº·c táº£**: slot 56px flex wrap; locked opacity .45 `pointer-events: none`.

### LoreCodex
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/scripture/LoreCodex.vue`
- **Chá»©c nÄƒng**: Tab Lore â€” grid item lore ÄÃƒ NHáº¶T; click má»Ÿ LoreCodexModal; **EmptyState** khi rá»—ng.
- **Äáº·c táº£**: grid slot 56px flex wrap.

---

## 10. Panel con â€” artifact (4)

### ArtifactOverview
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/artifact/ArtifactOverview.vue`
- **Chá»©c nÄƒng**: VÃ¹ng 1 â€” icon chá»¯ "ç " (fallback chÆ°a cÃ³ art), tÃªn phÃ¡p báº£o + meta "Nghá» Â· Pháº©m".
- **MÃ u sáº¯c**: icon radial `--chrome-500 â†’ --ink-900` viá»n `--chrome-500` glow báº¡c.
- **Äáº·c táº£**: icon trÃ²n 64px.

### ArtifactExperienceBar
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/artifact/ArtifactExperienceBar.vue`
- **Chá»©c nÄƒng**: VÃ¹ng 2 â€” thanh EXP phÃ¡p báº£o (**Bar 8px**) 3 tráº¡ng thÃ¡i mÃ u hÃ³a qua override var: training `--chrome-300` / capped `--azure` / viÃªn mÃ£n `--jade`; track `--ink-950`.
- **Äáº·c táº£**: head row + status message.

### ArtifactGradeSection
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/artifact/ArtifactGradeSection.vue`
- **Chá»©c nÄƒng**: VÃ¹ng 3 â€” báº£ng Pháº©m / há»‡ sá»‘ / tháº¡ch (**StatRow Ã—3**, value `--chrome-100` 600) + nÃºt NÃ¢ng Pháº©m (GameButton sm viá»n `--chrome-500`).
- **Äáº·c táº£**: disabled trong suá»‘t opacity .4.

### ArtifactPathCards
- **ÄÆ°á»ng dáº«n**: `game/src/components/panels/artifact/ArtifactPathCards.vue`
- **Chá»©c nÄƒng**: VÃ¹ng 4 â€” 3 card hÆ°á»›ng CÃ´ng/Thá»§/Khá»‘ng, milestone táº§ng 1/3/6/12/18 (dot unlock + tooltip); chá»n reversible ngoÃ i combat.
- **MÃ u sáº¯c**: **path mÃ u** qua `--path-color` â€” attack `--crimson` / defense `--azure` / control `--jade`; selected ná»n color-mix 16% + viá»n + glow; milestone unlocked ná»n `--path-color` 22%.
- **Äáº·c táº£**: card cá»™t; milestone flex:1 bo 3px; locked opacity .4.

---

## 11. Combat â€” game/combat/ (10)

### CombatSceneOverlay
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatSceneOverlay.vue`
- **Chá»©c nÄƒng**: Khung xÆ°Æ¡ng UI Combat Scene â€” TopBar â†’ StatusBar â†’ battlefield (canvas xuyÃªn qua + AiPanel/BuildHud) â†’ EventBar â†’ ControlBar + ResultModal + CountdownOverlay; ResizeObserver cáº¥p `combatInsets` xuá»‘ng Phaser.
- **Äáº·c táº£**: `absolute inset 0 z-15` flex column; cao bar chuáº©n hÃ³a clamp (topbar 46â€“72 / status 44â€“68 / event 32â€“48 / control 48â€“76px).

### CombatTopBar
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatTopBar.vue`
- **Chá»©c nÄƒng**: Thanh trÃªn â€” tÃªn Äá»‹a Giá»›i â€¢ MÃ n + tiáº¿n Ä‘á»™ quÃ¡i.
- **MÃ u sáº¯c**: ná»n `--ink-950` 70% + blur 6px; title `--chrome-100` Noto Serif.

### CombatStatusBar
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatStatusBar.vue`
- **Chá»©c nÄƒng**: Thanh sá»‘ liá»‡u ngÆ°á»i chÆ¡i â€” HP (luÃ´n), MP (PhÃ¡p Tu), tÃ i nguyÃªn Ná»™/Kiáº¿m Ã; **3 Ã— Bar 14px** vá»›i label trong bar.
- **MÃ u sáº¯c**: fill HP `--hp-color` / MP `--jade` / Ná»™ `--gold-500` (solid â€” `--bar-from = --bar-to`); track `--ink-900` viá»n `--ink-line`; label text-shadow Ä‘en.
- **Äáº·c táº£**: cá»™t player `min(260px, 30vw)`; fill .15s ease.

### CombatEventBar
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatEventBar.vue`
- **Chá»©c nÄƒng**: Feed sá»± kiá»‡n Ä‘Ã¡ng chÃº Ã½ â€” pháº£n á»©ng ngÅ© hÃ nh ðŸ”¥ / ChÃ­ Máº¡ng ðŸ’¥ / Háº¡ Gá»¥c â˜ .
- **Äáº·c táº£**: max 6 entry 3.5s; `pointer-events: none`.

### CombatControlBar
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatControlBar.vue`
- **Chá»©c nÄƒng**: Thanh dÆ°á»›i â€” nÃºt âœ• ThoÃ¡t Tráº­n (GameButton secondary, hover crimson) + modal xÃ¡c nháº­n (2 GameButton: á»ž Láº¡i secondary / ThoÃ¡t Tráº­n danger); slider Báº¡t Kiáº¿m 3â€“9s.
- **MÃ u sáº¯c**: bar `--ink-950` Ä‘áº·c viá»n `--ink-line`; modal viá»n `--crimson`.

### CombatResultModal
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatResultModal.vue`
- **Chá»©c nÄƒng**: Wrapper backdrop káº¿t quáº£ (chá»‰ tráº­n Stage) â€” chá»n Victory/Defeat panel.
- **Äáº·c táº£**: `absolute inset 0 z-30` flex center; backdrop `--scrim`.

### CombatVictoryPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatVictoryPanel.vue`
- **Chá»©c nÄƒng**: "â˜… THáº®NG â˜…" â€” rewards tÃ­ch lÅ©y; auto: ÄÃ¡nh Láº¡i + Ä‘áº¿m 3s (progress leo mÃ n); manual: thÃªm Tiáº¿p Tá»¥c.
- **Primitives**: 2 GameButton (primary ÄÃ¡nh Láº¡i / secondary Tiáº¿p Tá»¥c).
- **MÃ u sáº¯c**: panel `--ink-900` **viá»n `--chrome-500`** (báº¡c = tháº¯ng); giÃ¡ trá»‹ reward `--jade`.

### CombatDefeatPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatDefeatPanel.vue`
- **Chá»©c nÄƒng**: "â˜  THáº¤T Báº I" â€” rewards; TÃ¡i Chiáº¿n (GameButton danger) + Vá» Äá»™ng Phá»§ (secondary, hover crimson); auto repeat Ä‘áº¿m 3s; fallback 10s.
- **MÃ u sáº¯c**: panel `--ink-900` **viá»n `--crimson`**; title `--crimson`.

### CombatCountdownOverlay
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatCountdownOverlay.vue`
- **Chá»©c nÄƒng**: Äáº¿m ngÆ°á»£c 3-2-1-Xuáº¥t Tráº­n!
- **MÃ u sáº¯c**: chá»¯ `--chrome-100`; text-shadow kÃ©p glow 24px + Ä‘en.
- **Äáº·c táº£**: `--text-hero` (96px) Noto Serif 700; animation pop `scale 1.6â†’1` .3s.

### CombatAiPanel
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/CombatAiPanel.vue`
- **Chá»©c nÄƒng**: Radio 5 chiáº¿n lÆ°á»£c AI má»¥c tiÃªu (Gáº§n nháº¥t/Æ¯u tiÃªn Boss/Elite/HP tháº¥p/HP cao) gÃ³c trÃ¡i battlefield.
- **MÃ u sáº¯c**: ná»n `--scrim` + blur 2px; radio `accent-color: --chrome-300`.
- **Äáº·c táº£**: font `--text-xs`; option `--tap-min`; tÄ©nh.

---

## 12. Combat HUD â€” game/combat/hud/ (6)

### CombatBuildHud
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/hud/CombatBuildHud.vue`
- **Chá»©c nÄƒng**: Wrapper chá»n HUD theo phÃ¡i â€” `phap_tu` â†’ PhapTu, `kiem_tu` â†’ KiemTu, máº·c Ä‘á»‹nh â†’ Mortal.

### CombatSkillSlot
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/hud/CombatSkillSlot.vue`
- **Chá»©c nÄƒng**: Ã” ká»¹ nÄƒng chung má»i phÃ¡i â€” bá»c SlotView + mask cooldown dá»c, sá»‘ Ä‘áº¿m tháº­p phÃ¢n, **cast bar Bar 3px** chÃ¬a `bottom: -6px` (override `--bar-from = --bar-to = --jade`, transition .05s), chi phÃ­ gÃ³c, filter xÃ¡m khi thiáº¿u tÃ i nguyÃªn/out-of-range.
- **Äáº·c táº£**: mask height % transition .1s; sá»‘ Ä‘áº¿m Noto Serif `--text-lg`.

### MortalCombatHud
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/hud/MortalCombatHud.vue`
- **Chá»©c nÄƒng**: HUD PhÃ m NhÃ¢n â€” Ä‘Ãºng 1 Ã´ lá»›n Tráº£m (cadence Attack Speed, mask ná»™i suy mÆ°á»£t).
- **Äáº·c táº£**: container + slot **88px**.

### PhapTuCombatHud
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/hud/PhapTuCombatHud.vue`
- **Chá»©c nÄƒng**: HUD PhÃ¡p Tu â€” 5 Ã´ skill luÃ´n dá»±ng Ä‘á»§ (trá»‘ng/khÃ³a/unreleased hiá»‡n rÃµ) + 1 ArtifactCombatSlot.
- **Äáº·c táº£**: flex wrap center gap `--space-2`; slot **72px**.

### KiemTuCombatHud
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/hud/KiemTuCombatHud.vue`
- **Chá»©c nÄƒng**: HUD Kiáº¿m Tu â€” Ã´ Ngá»± Kiáº¿m (cadence) 88px Ä‘á»©ng riÃªng + 2 ká»¹ nÄƒng chuá»—i 72px ná»‘i "â†’" (váº­n kiáº¿m), khÃ´ng copy dáº£i 5 Ã´ PhÃ¡p Tu.
- **MÃ u sáº¯c**: link "â†’" `--chrome-300`.

### ArtifactCombatSlot
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/combat/hud/ArtifactCombatSlot.vue`
- **Chá»©c nÄƒng**: Ã” Báº£n Má»‡nh phÃ¡p báº£o (NgÅ© HÃ nh ChÃ¢u ç ) â€” KHÃ”NG dÃ¹ng Bar (mask cooldown dá»c riÃªng, height-driven); icon ç , dot hÃ nh káº¿ tiáº¿p, badge stack khá»‘ng cháº¿ / â˜… sáºµn sÃ ng.
- **MÃ u sáº¯c**: slot `--ink-800` viá»n `1px --el-color` (Ä‘á»™ng theo hÃ nh káº¿); stacks `--crimson`; ready gradient báº¡c.

---

## 13. Game / Scene â€” game/ (7)

### PhaserCanvas
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/PhaserCanvas.vue`
- **Chá»©c nÄƒng**: Phaser canvas wrapper duy nháº¥t â€” 1 game transparent (arcade physics) chá»©a 3 scene [Main, Combat, Tribulation]; ResizeObserver; EventBus bridge.
- **Äáº·c táº£**: `100% Ã— 100%`; cleanup Ä‘áº§y Ä‘á»§ onUnmounted.

### MainScene
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/MainScene.vue`
- **Chá»©c nÄƒng**: Container viewport â€” DongFuScene (DOM overlay) Ä‘Ã¨ PhaserCanvas; combat thÃ¬ DongFuScene áº©n.
- **MÃ u sáº¯c**: ná»n `--ink-950`.

### DongFuScene
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/DongFuScene.vue`
- **Chá»©c nÄƒng**: Tháº¿ giá»›i home Äá»™ng Phá»§ â€” ná»n art PNG (1672Ã—941 cover) + fallback gradient CSS; Linh NhÃ£n 3 vÃ²ng tráº­n phÃ¡p; 4 particle linh khÃ­; nhÃ¢n váº­t tu luyá»‡n lÃ  nÃºt trigger command wheel; vignette.
- **MÃ u sáº¯c**: sky gradient `#0a0a0d â†’ #131318 â†’ #1b1b22`; Linh NhÃ£n vÃ²ng `--chrome-500` 30â€“48% + outer `--azure` 25% glow blur 6px; motes `--chrome-100`; vignette `rgba(0,0,0,.5)`.
- **Äáº·c táº£**: Linh NhÃ£n `perspective(320px) rotateX(64deg)` pulse 4.5s/3.2s; motes 3px 7s.

### HomeBuildingIcons
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/HomeBuildingIcons.vue`
- **Chá»©c nÄƒng**: Hotspot cÃ¡c tÃ²a nhÃ  trÃªn art â€” nÃºt vÃ´ hÃ¬nh theo % tá»a Ä‘á»™, hover outline + VFX theo loáº¡i + label cáº¥p.
- **MÃ u sáº¯c**: accent má»—i building â€” Äan PhÃ²ng `--el-fire`, KhÃ­ ÄÆ°á»ng `--crimson`, Tráº­n PhÃ¡p `--chrome-500`, Linh Tuyá»n `--azure`, Tiá»nå“¨ `--text-muted`; outline/hover-label/glow color-mix theo accent.
- **Äáº·c táº£**: hotspot ellipse `border-radius: 46%`; VFX 5 loáº¡i â€” portal 3 vÃ²ng xoay, alchemy/forge 3 dot bay, spring/gather ripple; prefers-reduced-motion táº¯t VFX.

### DongFuCommandWheel
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/DongFuCommandWheel.vue`
- **Chá»©c nÄƒng**: Báº£ng lá»‡nh command wheel 2 quá»¹ Ä‘áº¡o trÃ²n â€” click nhÃ¢n váº­t má»Ÿ; slot fan-out cung xoáº¯n 112Â°, 2 vÃ²ng quay ngÆ°á»£c chiá»u; backdrop/Escape/Tab Ä‘Ã³ng.
- **MÃ u sáº¯c**: slot `--ink-900` 88% viá»n `--ink-line` â†’ hover `--chrome-300`; **ring identity viá»n trÃ¡i 3px**: ring1 `--chrome-500` / ring2 `--azure` / ring3 `--jade` / ring4 `--el-primordial`.
- **Äáº·c táº£**: slot pill 999px min 57px; tÃ¢m left 50% top 66%; bÃ¡n kÃ­nh adaptive `clamp(96â€“340px)`; fan-out 320ms cubic-bezier transform chain giá»¯ chá»¯ tháº³ng.

### BuildingDetailPopover
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/BuildingDetailPopover.vue`
- **Chá»©c nÄƒng**: Popover chi tiáº¿t building chÆ°a xÃ¢y â€” tÃªn/mÃ´ táº£/chi phÃ­ (**Eyebrow + StatRow tone negative khi thiáº¿u**) + nÃºt XÃ¢y Dá»±ng (GameButton primary).
- **MÃ u sáº¯c**: gradient má»±c + `.ornate-frame`; thiáº¿u `--crimson` (qua StatRow negative).
- **Äáº·c táº£**: radius `--radius-md`; min 260 / max 320px; max-height `calc(100vh - 48px)` scroll.

### TribulationSceneOverlay
- **ÄÆ°á»ng dáº«n**: `game/src/components/game/tribulation/TribulationSceneOverlay.vue`
- **Chá»©c nÄƒng**: Overlay ThiÃªn Kiáº¿p â€” Ä‘á»“ng há»“ Ä‘áº¿m ngÆ°á»£c + **2 Bar 8px**: time thu tá»« pháº£i (`anchor="right"`, gradient `#7658d6 â†’ #9edaff+white`) + HP (solid `#d34c4c`); track `--scene-tribulation-deep` viá»n `#9edaff`.
- **Äáº·c táº£**: timer `--text-display-lg` 800 glow `#69bfff`; track `min(340px, 80vw)`; neo theo tá»‰ lá»‡ viewport khá»›p Phaser; fill .15s linear; z-15.

---

## 14. Onboarding â€” onboarding/ (2)

### AuthEntryScreen
- **ÄÆ°á»ng dáº«n**: `game/src/components/onboarding/AuthEntryScreen.vue`
- **Chá»©c nÄƒng**: ÄÄƒng nháº­p/Ä‘Äƒng kÃ½ (login ID + máº­t kháº©u) hoáº·c guest (dá»«ng TrÃºc CÆ¡).
- **MÃ u sáº¯c**: ná»n radial 3 stop (chrome-700 8% tint â†’ `--ink-900` â†’ `--ink-950`) + lÆ°á»›i cháº¥m 44px opacity .1 + 2 vÃ²ng sÆ°Æ¡ng `--chrome-500` blur 80px; card gradient má»±c + shadow kÃ©p; con dáº¥u ä»™ viá»n `--chrome-100`; tab underline active `--chrome-100` + gáº¡ch 2px `--chrome-500`; input focus viá»n `--chrome-300`; lá»—i `--crimson`; dot server `--jade` glow.
- **Äáº·c táº£**: card `min(390px, ...)` padding 34px; seal 54px xoay 45Â°; eyebrow letter-spacing .28em.

### CharacterCreationScreen
- **ÄÆ°á»ng dáº«n**: `game/src/components/onboarding/CharacterCreationScreen.vue`
- **Chá»©c nÄƒng**: Wizard 3 bÆ°á»›c táº¡o nhÃ¢n váº­t â€” Äáº¡o danh â†’ chá»n ThiÃªn PhÃº (reroll) â†’ phÃ¢n bá»• 5 Ä‘iá»ƒm cÄƒn cÆ¡.
- **MÃ u sáº¯c**: ná»n radial nhÆ° AuthEntry; panel gradient má»±c + `.ornate-frame`; talent card selected viá»n `--chrome-300` + inset ring + glow 12%; tier thiÃªn phÃº â†’ `--rank-color-1/3/5/7/8`; counter há»£p lá»‡ `--jade`; lá»—i `--crimson`.
- **Äáº·c táº£**: stepper 26px trÃ²n ná»‘i káº» 1px; talent grid 3 cá»™t min-height 128px hover `translateY(-2px)`.

---

## 15. Quy Æ°á»›c pattern toÃ n UI

> Sau primitives refactor (2026-08-29), cÃ¡c pattern tá»«ng bá»‹ ~90 chá»— tá»± viáº¿t Ä‘Ã£ **há»£p nháº¥t** vá» 1 nguá»“n sá»± tháº­t. Báº£ng nÃ y lÃ  quy Æ°á»›c báº¯t buá»™c khi viáº¿t UI má»›i.

| Pattern | Nguá»“n sá»± tháº­t | Ghi chÃº |
|---|---|---|
| **Progress bar** | `primitives/Bar.vue` | house style: track `--ink-700` + fill `--jade â†’ --chrome-300`; override qua `--bar-track/--bar-from/--bar-to`, solid = from=to |
| **NÃºt chÃ­nh (CTA)** | `GameButton` primary | gradient báº¡c `--chrome-100 â†’ --chrome-500`, chá»¯ `--ink-950` |
| **NÃºt danger** | `GameButton` danger | ná»n `--crimson` pháº³ng, chá»¯ tráº¯ng |
| **NÃºt scene accent** | `GameButton` + `accentVar` | gradient Ä‘á»• tá»« CSS var scene (lÃ² Ä‘an, linhduyá»n) |
| **NÃºt icon trÃ²n** | `GameButton` + `shape="circle"` | nÃºt "+" allocate stat |
| **Panel modal** | gradient `160deg --ink-950 â†’ --ink-800` + `.ornate-frame` + `--shadow-panel` | ConfirmModal, Error, Save, Tutorial... |
| **OverlayPanel** | gradient `155deg --ink-800 â†’ --ink-950` viá»n `--chrome-500` | má»i panel chá»©c nÄƒng |
| **Tab / filter chip** | `primitives/Chip.vue` + `TabBar` | cÃ´ng thá»©c idle `--ink-800`/`--ink-line-soft`/`--text-secondary` â†’ active `--chrome-300`/`--chrome-100` + `--chip-active-bg` |
| **Section title** | `primitives/Eyebrow.vue` | uppercase, `--eyebrow-tracking` .04em |
| **Stat row** | `primitives/StatRow.vue` | value `tabular-nums`, tone jade/crimson/chrome/muted |
| **Empty state** | `primitives/EmptyState.vue` | size sm/md/lg, framed dashed |
| **Scene header** | `SceneHeader.vue` | asset + scene token map + slot decoration |
| **ThÃ nh cÃ´ng / thiáº¿u sÃ³t** | `--jade` / `--crimson` | toÃ n UI |
| **Chá»¯ sá»‘** | `font-variant-numeric: tabular-nums` | má»i giÃ¡ trá»‹ count/Ä‘áº¿m |
| **Accessibility** | `--tap-min` 40px, focus ring báº¡c, aria role, prefers-reduced-motion | toÃ n UI |

### Ngoáº¡i lá»‡ cÃ³ chá»§ Ä‘Ã­ch (khÃ´ng dÃ¹ng primitive)
- `ArtifactCombatSlot` â€” mask cooldown **dá»c** height-driven, khÃ´ng pháº£i bar ngang.
- `BagPaginationControls` sort button â€” nÃºt Ä‘Æ¡n cÃ³ `aria-haspopup` + SVG inline, khÃ´ng pháº£i chip cluster.
- `AuthEntryScreen` tab underline + `CharacterCreationScreen` stepper + `DongFuCommandWheel` radial â€” chá»§ Ä‘Ã­ch visual khÃ¡c biá»‡t.
- `QuanKhiPanel` nÃºt chá»n path â€” giá»¯ gradient crimson (nghi thá»©c khÃ´ng hoÃ n tÃ¡c), override cá»¥c bá»™ trÃªn GameButton danger.

### Äiá»ƒm cáº§n biáº¿t khi thÃªm UI má»›i
1. Bar/nÃºt/chip/title/row/empty/scene-header: **dÃ¹ng primitive trÆ°á»›c**, chá»‰ override CSS var â€” khÃ´ng tá»± viáº¿t CSS má»›i.
2. MÃ u má»›i: thÃªm token vÃ o `theme.css`, khÃ´ng hex cá»©ng trong component.
3. Chiá»u cao nÃºt báº¥m â‰¥ `--tap-min`; sá»‘ liá»‡u `tabular-nums`; animation tÃ´n trá»ng `prefers-reduced-motion`.

## 16. Fit-refactor (2026-08-29) — panel tự co giãn mọi tỉ lệ

Spec: docs/superpowers/specs/2026-08-29-ui-fit-refactor-design.md (branch ui-fit-refactor).

### Nguyên tắc
- Panel = **ngân sách flex**: chrome (scene/tabs/header) co giãn bằng clamp(vh), phần còn lại cho nội dung.
- **0 scrollbar**: scrollbar ẩn toàn cục (theme.css từ trước); list vô hạn → **phân trang đo ngân sách** (usePanelPagination — ResizeObserver đo chiều cao thật, pageSize reactive, tự lùi trang); vùng "đọc" (cây node, form) wheel-scroll ẩn thanh + fade-edge .scrollfade.
- **Container query đo theo CARD**: .overlay-panel__card { container-type: inline-size } — breakpoint panel con theo @container overlay-panel (max-width: ...), không còn lệch viewport.
- Floor đọc được: --text-xs×ui-scale, hàng ≥ --tap-min.

### Thay đổi chính
- OverlayPanel body: overflow: auto → flex budget column.
- SceneHeader: height nhận chuỗi CSS; 4 scene chrome clamp vh (rèn 72–132, lò 88–150, portal 72–118, spring 96–210).
- SkillPathPanel: 3 cột stack dọc @container 900px; cột bên cap min(20%/22%, 280/300px).
- CharacterPanel: pentagram container-relative (%, clamp 180–260px), tự co < 260px.
- RealmPanel: 9 node auto-fit minmax(min(108px,100%),1fr) — hết dead zone 901–957px.
- Khí Đường Hóa Luyện + 2 codex: phân trang theo ngân sách (usePanelPagination).
- Drawer: floor 260px dưới 900px, full-width < 620px.
- usePanelPagination composable mới (src/composables/).