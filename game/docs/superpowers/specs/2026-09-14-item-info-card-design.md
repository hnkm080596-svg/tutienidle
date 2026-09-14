# Unified Item Info Spec — Hybrid Ink Card (Phương án C)

- Date: 2026-09-14
- Status: approved-in-chat (user picked option C after viewing side-by-side mockup)
- Scope: presentation only — no gameplay/stat/rule changes. One spec for how EVERY item surface renders identity, quality and stats.

## Problem

Item info is inconsistent across surfaces (user pain point: "không đồng nhất ở nhiều nơi, cần quy định lại"). Each context (bag tabs, paperdoll, equipment hall, codex, vendor, loot, Trận) composes its own label/tooltip/badge treatment. This spec defines ONE contract.

## User-approved decisions

| Decision | Ruling |
|---|---|
| Density | Rich — keep all current signals (badges, Chất edge, beam) |
| Style | Hybrid C — dark ink card + Chinese-cultivation structure (seal, letter-spaced eyebrows, brush dividers, calligraphy name) |
| Naming | ONE color for the whole name = item's quality identity (Diablo rule); Phẩm/Set/Địa Giới demoted to meta line |
| Phẩm on cell | Seal stamp (ấn triện) corner — Vietnamese grade ordinal, NOT realm glyph (realm names collide) |
| Chất on cell | Keep colored edge + border-beam (user: "ok rồi với viền màu xoay") |
| Icon header in tooltip | A real SlotView in static mode, not a bare img |
| Compare | 2 cards side-by-side, only when the slot has an equipped counterpart |
| Advanced mode | Dead — affix ranges render inline (muted) always |
| Scope | All surfaces where an item appears |

## 1. Cell spec — every filled item cell, everywhere

```
┌──────────┐
│▓seal     │  ấn triện TL
│  [icon]  │
│          │
│      x99 │  amount BR
└──────────┘
 viền = Chất (--slot-rarity-color) + border-beam fx khi tier ≥ 4
```

- **Seal stamp**: crimson square (~30% cell edge), cream grade-ordinal text, top-left. Replaces the Phẩm underlay wash (removed — it read as a gray gradient on the glass tiles).
  - Input: existing `equipmentQualityRank` prop (1–10) — same prop, new rendering. Seal renders ONLY when a rank is present; items with no grade show no stamp (and the card meta line omits the grade segment).
  - Ordinal map (Vietnamese, "Phẩm" elided as common suffix):

    | rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
    |---|---|---|---|---|---|---|---|---|---|---|
    | grade | Cửu | Bát | Thất | Lục | Ngũ | Tứ | Tam | Nhị | Nhất | Tiên |
    | seal | CỬU | BÁT | THẤT | LỤC | NGŨ | TỨ | TAM | NHỊ | NHẤT | TIÊN |

  - **Seal rim tint (chốt)**: rim tinted by `--rank-color-N` of `equipmentQualityRank` — the seal IS the Phẩm signal, so its accent follows the Phẩm ramp, not Chất.
- **Badge layout**: seal TL · `+N` enhance TR · `▲▼` compare BL · `xN` amount BR (positions as now; corners hold one overlay each — no stacking).
- **Crowding rule (chốt)**: on cells < 48px, suppress in this order — `▲▼` compare first (the compare card pair already carries deltas), then `NEW` marker, then realm·tuổi (material). Seal + amount never hide (identity + count are the cell's minimum). `●` equipped / `NEW` share the marker slot, never co-render.
- **Markers**: `●` equipped / `NEW` / realm·tuổi (material) — unchanged.
- **Caption**: off everywhere (existing ruling); `showLabel` opt-in stays (combat skill bar).
- Validation glyphs, veils, hover art per variant — unchanged.

## 2. Naming — one color

- Tooltip title renders the whole name in the item's quality color:
  - Equipment → Chất: `--rank-color-(2·rarityRank-1)` (rarityRank 1–5 → ramp odd steps).
  - Material/pill/talisman/formation → Phẩm rank color `--rank-color-N` (1–10).
  - Rule of thumb: **name color = that item type's quality identity**.
- Meta line under title (muted): `Loại · Cảnh giới: {grade} ({realm})` + Set/Địa Giới descriptor where present.
- `composeEquipmentNameSegments` stays the owner of name STRUCTURE (segment boundaries, joined aria/tooltip text). Per-segment color is dead after this change: `colorVar`/`tone` fields are removed from the `NameSegment` return type (would be dead data) — the whole title takes ONE `nameColorVar`/`nameTone` instead. Tiên quality keeps its rainbow gradient through that single tone (applied to the whole name, not a segment). Renderers to migrate: Tooltip title, ToastContainer loot segments, SlotView `showLabel` caption, MaterialBagSection name segments.
- Text-only surfaces (loot toast, quest reward rows, vendor rows) — one fixed pattern (chốt): `{Tên màu quality} {grade muted}` → "Thanh Vân Kiếm · Ngũ Phẩm". No per-site variants.

## 3. Tooltip card — hybrid dark card

```
┌──────────────────────────────┐
│ ┌────────┐  Hoàng - Thanh Vân Kiếm   (--font-display, Chất color)
│ │SlotView│  Vũ Khí · Cảnh giới: Ngũ Phẩm (Nguyên Anh)
│ │ static │
│ └────────┘
│ CHỦ THUỘC ─────────────────   eyebrow giãn chữ + divider
│ Sức Mạnh +42                  main stat emphasized
│ PHỤ THUỘC ─────────────────
│ ◆ Bạo Kích +8%   T3   [5–12]  range muted inline, always
│ ◆ Xuyên Giáp +4    T1   [2–6]
│ RÈN LUYỆN ──────────────────
│ Cường hóa +3/9 · Rèn 2/3
│ "Mô tả..."                    muted italic, dashed divider
└──────────────────────────────┘
```

- Surface: existing dark `surface-m-paper` layer + ink frame (unchanged base); ornaments added: letter-spaced eyebrow sections, thin dividers, `◆` affix markers toned by quality.
- Header = a real `SlotView` rendered in **static mode**: `role="img"` + `aria-label` from the same `accessibleLabel ?? label` source as the cell; no click/hover/tooltip emission; same art + seal + Chất edge + badges as the source cell. Payload field `slotPreview` carries the source cell's SlotView props; Tooltip binds them directly (no rebuild logic).
- `advancedSections` removed from `EquipmentTooltipContent`; ranges always inline.
- Graded kinds (`material | pill | talisman | formation`): same card skeleton — static slot header (their `gradeRank` feeds the seal), name in rank color, meta line = grade label + `Sở hữu: N`, description, sections.
- **`Sở hữu: N` rule (chốt)**: shows whenever owned count ≥ 1 on ANY surface (vendor, codex, loot preview included). Omitted entirely at 0 — never renders "Sở hữu: 0".
- `element`/`technique`/`building`/`plain` kinds: unchanged.

## 4. Compare — paired cards

- `EquipmentTooltipContent.compareWith?: Omit<EquipmentTooltipContent, 'compareWith'>` — non-recursive by type so a compare card can't nest a third. The builder emits it when the hovered item's equipment slot currently holds an instance (bag + hall pickers, anywhere equipped context exists).
- Tooltip renders the pair left→right: `[Đang Mặc] [Item hover]`; the equipped card gets an "ĐANG MẶC" eyebrow.
- Delta `▲▼ ±N` on the hovered card's stat rows vs the equipped instance (`computeEquipmentStatDeltas` — existing owner).
- On-cell `▲▼` badge stays (glance signal even though the card pair exists).
- Floating-ui keeps pair inside viewport (existing flip/shift).

## 5. Surfaces — spec applies to all

Bag tabs (equipment/material/pill/talisman/formation) · EquipmentPaperdoll (6 worn) · hall tabs & pickers (Enhance/Wash/Refine/Dissolve/Decompose) · codex entries · vendor list · loot/reward rows · Trận panel · combat drops. Text-only mentions follow §2 naming color.

**Availability boundary (chốt)**: the spec governs RENDERING, not availability — surfaces that lock tooltips in combat keep their lock (combat HUD keeps labels/captions); no new tooltip surface is introduced into combat by this spec.

## 5b. Accessibility (review addendum)

- **Seal**: decorative — `aria-hidden="true"` on the stamp element; the grade text folds into the cell's `aria-label` ("{name}, {grade}"). Screen readers get Phẩm through the label, not the glyph.
- **Static SlotView header**: `role="img"` + `aria-label` from the same `accessibleLabel ?? label` source as the source cell.
- **Compare pair**: each card `role="group"` + `aria-label` ("Đang mặc" / "Vật phẩm đang xem") so SR users can tell the two cards apart.
- `◆` affix markers and eyebrow dividers: `aria-hidden`; affix rows keep the existing `aria-label="{label}, bậc {tier}: {value}"` pattern.
- Color is never the only signal: Chất edge pairs with seal text; delta `▲▼` pairs with signed number + tone class.

## 5c. Migration sweep (acceptance criteria)

Refactor touches many consumers — sweep list to verify "no surface composes item identity locally":

1. Bag tabs (5 sections) — cell renders seal + standard badge set; tooltip = card skeleton.
2. EquipmentPaperdoll — worn cells identical signal set.
3. Hall tabs (5) — pickers identical; compare card pairs work where equipped context exists.
4. Codex / vendor / loot / quest reward / Trận — same card + same naming color rule.
5. Grep sweep: no consumer builds its own colored name string or local stat-section composition outside the shared builders (`useEquipmentTooltip`, bag `BagCell`/tooltip builders).
6. Test coverage: vitest asserts card structure (title single color, eyebrow sections, static slot header, `Sở hữu` rule, compare pair presence/aria) for equipment + at least one graded kind; existing tooltip tests updated, not deleted.

## 6. Implementation outline

- `SlotTypes.ts` / `SlotView.vue`: grade-ordinal seal map + seal layer replacing Phẩm underlay (remove underlay element + CSS + `gradeUnderlayColor`); `static` prop mode (non-interactive, role=img, suppresses own tooltip/hover/click); `showLabel` stays.
- `useTooltip.ts`: `slotPreview?: SlotViewProps` + `compareWith?: EquipmentTooltipContent`; drop `advancedSections` from equipment kind (graded kinds unchanged shape, rendered by the same card layout).
- `useEquipmentTooltip.ts`: merge advanced rows into `sections` with `[min–max]` muted inline; emit `compareWith` when equipped instance is passed; emit `slotPreview`.
- `Tooltip.vue`: hybrid card layout (eyebrows, dividers, `◆` markers, dashed desc divider); static-slot header; compare pair rendering.
- Consumers: bag sections, hall tabs, paperdoll, codex, vendor, loot, Trận — ensure `equipmentQualityRank`/`rarityRank` props reach cells so the seal shows; remove any per-site divergent label composition.
- i18n keys for section labels (`Chủ Thuộc`/`Phụ Thuộc`/`Rèn Luyện`/`Đang Mặc`) — reuse existing `panels.*` keys where present; new keys in vi/en pairs (P16).

## 7. Risks & open questions

- Pair width (~2×320px) near panel edges — floating-ui flip covers; verify at 1280px viewport.
- Seal legibility on ~40px cells: ordinal max 4 chars (THẤT/NHẤT) at ~9–10px — acceptable; verify visually.
- Static SlotView must not instantiate `v-tooltip` or emit click — the `static` flag gates both.
- Scratch mockup `public/_scratch-item-cards.html` must be deleted before commit (QA artifact).

## 8. Out of scope

- Stat formulas, affix rolls, grade/quality domain definitions.
- Element/technique/building/plain tooltip kinds.
- Non-item slots (skill, building, formation slots keep their own looks).
