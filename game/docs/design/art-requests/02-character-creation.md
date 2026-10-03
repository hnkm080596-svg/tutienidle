# Scene 02 — Character Creation · art requests (Huyền Kim)

Design space **1672×941**. Ref: `docs/design/references/huyen-kim/scenes/02-character-creation.jpg`.
Sizes are design-px estimates read off the ref — keep proportions, not exact pixel math.
Every row below is a surface already marked `.art-needed` + `data-art-id` in
`src/components/scenes/creation/` (temp CSS art today; PNG replaces CSS when delivered).

Shared chrome is **not** re-requested — scene 02 reuses manifest slots that are already
drawn: `surface-xl-scroll` + `frame-xl-ceremony` (scroll body/frame), `scroll-title-plaque`
+ `section-plaque` (title/section plaques), `corner-ornament` ×4 (scroll corners),
`text-field` (name field), `button-ceremonial` (finish CTA), `button-compact` (reroll),
`icon-button-utility` (back button). Vista base = shipped `auth-creation` parallax stack.
Prop art on this page only.

## New art (14 assets)

| component | data-art-id | design px | type | visual per ref | layer / stack |
|---|---|---|---|---|---|
| CreationVistaFigure `__rock` | `creation-vista-rock` | ~760×260 | vista prop | Craggy dark-ink rock ledge filling the vista's lower-left; figure sits on it | vista front, under figure |
| CreationVistaFigure `__body` | `creation-vista-figure` | ~760×710 | vista prop | Seated cultivator in right-facing profile dominating the vista's left half: flowing black hair + topknot, white-and-ink robes pooling over the ledge, faint gold rim light | vista front, on rock |
| CreationVistaBanner | `creation-vista-banner` | ~60×280 | vista prop | Vertical hanging calligraphy strip at the far-left edge: ivory paper, ink glyphs top-to-bottom, red tassel cord on the bottom tip | vista front, left edge |
| CreationVistaDesk `__slab` | `creation-vista-desk` | ~300×90 | vista prop | Low stone writing desk in front of the figure, dark ink slab | vista front, beside figure |
| CreationVistaDesk `__scroll` | `creation-desk-scroll` | ~90×40 | vista prop | Half-unrolled paper scroll lying on the desk, ivory paper | on desk slab |
| CreationVistaDesk `__burner` | `creation-desk-burner` | ~40×50 | vista prop | Small bronze incense burner at the desk edge, thin smoke wisp | on desk slab |
| CreationScrollOrnaments `__lantern` | `creation-scroll-lantern` | ~90×70 | prop | Lit paper lantern hooked on the scroll's top-right ear, warm ivory glow + thread tassel | above frame-xl-ceremony, top-right |
| CreationScrollOrnaments `__tassel` ×2 | `creation-scroll-tassel` | ~40×110 | prop | Red silk tassels hanging off BOTH scroll rims mid-height (left + right pair) | above frame-xl-ceremony, both rims |
| CreationSealStamp | `creation-title-seal` | ~56×56 | prop | Square cinnabar seal stamp beside the title plaque, white carved glyph inside | scroll body, right of title |
| CreationSectionHeader `__seal` | `creation-section-seal` | ~36×36 | prop | Small round ink medallion with a light glyph, leading each section title (2 uses: Đạo Danh, Thiên Phú) | scroll body, section title left |
| TalentCard frame | `talent-card-frame` | 176×112 | chrome-adjacent prop | Dark ink card face for one talent: painted gilt filigree corners, thin gold keyline, name band, subtle paper texture; selected state gains jade rim (runtime tint — one base art). NOTE: ref draws PORTRAIT cards ~180×240 with a painted vignette on top; the 3×3/176×112 grid is the spec's corrected fit for all 9 roll offers — keep landscape, paint to this shape | talent grid cell |
| TalentCardEmblem | `talent-card-emblem` | ~56×56 | prop | Circular emblem disc centered on the card: luminous motif (moon/beast/sword vignette) in muted gold on jade-dark disc, rarity ring tintable (`--rank-color-*`) | inside talent card |
| TalentCard corner seal | `talent-card-seal` | ~28×28 | prop | Small round ink seal medallion hanging on the card's bottom-center edge | inside talent card, bottom edge |
| CreationStarterSlot `__banner` | `starter-slot-banner` | 564×56 | prop | Dim brush/mountain banner bar under the Kỹ Năng Khởi Đầu plaque — RESERVED region, not visible in beta | scroll body, between talent grid and footer |
| CreationFooter `__flourish` | `creation-cta-flourish` | ~46×14 ×2 | prop | Small gold leaf/lotus flourish flanking the finish CTA plaque (left + mirrored right) | footer, beside button-ceremonial |

## Layer order (back → front)

1. `auth-creation` parallax stack (sky → far mountains → mist — already shipped)
2. `creation-vista-rock` → `creation-vista-figure` → `creation-vista-desk` (+ `creation-desk-scroll`, `creation-desk-burner`) → `creation-vista-banner` at the left edge
3. Vista right-edge ink-fade gradient (runtime CSS, no art)
4. `surface-xl-scroll` (scroll paper) → `frame-xl-ceremony` (outer frame)
5. `corner-ornament` ×4 + `creation-scroll-lantern` + `creation-scroll-tassel`
6. Scroll body content: `scroll-title-plaque` + `creation-title-seal` → `section-plaque`/`creation-section-seal` → `text-field` → `talent-card-*` grid → `starter-slot-banner` (hidden beta) → `creation-cta-flourish` + `button-ceremonial`
