# S10 Exploration (Sơn Hà Đồ) + S11 Alchemy (Đan Phòng) — visual review

Evidence: `evidence/before/` (audit set, pre-fidelity) vs `evidence/after/`
(10-exploration.png, 11-alchemy.png). References are AI-generated guides;
canonical runtime data stayed authoritative.

## S10 — exploration map

| Axis | Reference | Before | After | Verdict |
|------|-----------|--------|-------|---------|
| Composition | Map canvas fills the scroll, stages ride a winding mountain trail | Flat card grid (Tầng 1..N) | Parchment map field (`exploration-map-frame` + `-mask`), serpentine SVG trail, nodes positioned by `stageTrailLayout` | MATCH (runtime geometry) |
| Chrome/material | Painted map frame, chapter divider, seal nodes | none | `exploration-map-frame`, `exploration-chapter-divider`, `boss-seal`, lock symbols | MATCH |
| Focal point | Trail + current stage | Grid cards | Trail serpentine + selected-node glow | MATCH |
| Runtime authority | n/a | zone/chapter filters + stage list canonical | unchanged — `stageNodes` from the same read-models; lock state via `isStageUnlocked`/`stageLockReason` | PRESERVED |
| Information | Stage meta beside map | detail column | unchanged detail column + autofarm strip | PRESERVED |
| Interaction | click node -> select | same | same | PRESERVED |
| Responsive | map keeps aspect | grid wrapped | scrollable parchment, mask feathers edges | ACCEPTABLE |

### Defects found and fixed during review
- `stageTrailLayout` emitted path coordinates in a 0..100 space while the
  SVG declared `viewBox 0 0 1000 1000` — the trail collapsed to a 10%-size
  speck in the corner. Fixed scale (×1000) and pinned by
  `stageTrailLayout.test.ts` (asserts 0..1000 coordinate range).
- Map title was being eaten by the scrollfade top mask — moved to a pinned
  `.stage-select__map-head` band inside the frame interior.
- Title then grazed the frame's painted top band; head offset and scroll
  padding tuned until clear at 1280x720 and 1600x900.
- Building heading ("Truyền Tống Trận") rendered the on-dark
  `--surface-text` ramp onto the pale scroll interior — glyphs washed out,
  read as clipped text. `building-heading--imperial` now uses the paper
  ramp; the stale "dark ink-paper" comment corrected. Root cause is shared
  by every building panel in the imperial scroll — fix is shared too.
- `.hk-scroll__header` gained `padding-top: 4.2cqh` — the paper art's top
  curl shadow reaches ~6cqh into the inner region; header text now starts
  below it. Benefits all imperial `#header` consumers.
- Third trail row initially sat under the frame's bottom band — vertical
  span compressed (MARGIN_TOP .13 + TRAIL_SPAN_Y .50) so all ten stage
  nodes land inside the parchment at 720p without scrolling.

### Residual
- Playfair Display (the `--font-display` face) lacks composed glyphs for
  Vietnamese stacked diacritics ("ề", "ố"); fallback marks render detached.
  App-wide font-coverage quirk, pre-existing, flagged for a future
  typography pass — not a scene-10 defect.

## S11 — alchemy

| Axis | Reference | Before | After | Verdict |
|------|-----------|--------|-------|---------|
| Composition | Recipe rail / cauldron centerpiece / detail column | list + small detail | three-part layout, stable cauldron art centered | MATCH |
| Chrome/material | Ornate cauldron, warm interior | plain | stable cauldron PNG, imperial paper | MATCH |
| Focal point | Cauldron | buried | centered, ~40% of interior width | MATCH |
| Runtime authority | n/a | recipe/job models canonical | unchanged — `alchemyOps.startAlchemyJob`, `cancelAlchemyJob`; cauldron is decorative only | PRESERVED |
| Queue | prominent strip | nested tab | top queue strip with interactive cancel (no `aria-hidden` on interactive content) | MATCH |
| Outcome copy | n/a | muddled | guaranteed+bonus / guaranteed / chance-only / none phrasing fixed | MATCH |

### Residual
- Disabled "Bắt đầu luyện" CTA (no materials) is low-contrast gold-on-pale
  — readable but faint; acceptable disabled state.
- Queue strip is empty in a fresh-mortal capture by definition; exercised
  in unit tests (`AlchemyView.test.ts` 3/3).

## Evidence note (integrity)

The `evidence/before/` directory was accidentally overwritten at 11:24 by a
capture run that omitted `HK_FIDELITY_DIR`. The baseline was restored from
the 04:58 audit capture set in `docs/qa/evidence/huyen-kim/`, which predates
all fidelity work. S03's open-wheel before exists only as
`03-dong-phu.png` (single shot).
