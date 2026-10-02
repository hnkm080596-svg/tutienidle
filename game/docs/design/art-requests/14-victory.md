# Scene 14 — VICTORY (Chiến Thắng) · Art Request Inventory

Reference: `game/docs/design/references/huyen-kim/scenes/14-victory.jpg`
Layout spec: `huyen-kim-scene-layout-spec` scene 15 (spec-id offset: ref #14 → spec #15)
Audit: `huyen-kim-reference-audit.md` §15 — build only EXACT / CORRECTED / FUTURE_IMPLEMENTED blocks.

All dimensions are design-space px (1672×941) unless noted. "Runtime CSS" rows are chrome already covered by shared kits or built in code — listed for traceability only.

## Requested art

| # | Component | data-art-id | Design px (region → item) | Type | Description | Layer |
|---|-----------|-------------|---------------------------|------|-------------|-------|
| 1 | VictoryRoller ×2 | `victory-roller` | 466/330/24×250 (edge band) | sprite | Jade scroll-roller rod: carved jade body with gold-capped ends, subtle inner shade so the scroll reads rolled; left/right mirrored | 2 (above surface, below chrome) |
| 2 | VictoryTitleBand | `victory-title-ink` | 526/330/620/120 | text-art / sprite | The large "Thắng" victory calligraphy in radiant gold-ink brushwork with subtle ink bleed + gold aura glow; ink-bleed backdrop patch behind it | 2 |
| 3 | VictorySectionPlaque | `victory-section-plaque` (+ shared `section-plaque`) | 560/430/550/40 chip | nine-slice | Small ornamental section plaque ("Phần Thưởng Nhận Được" / "Tăng Trưởng") with divider-ornament tails fading to both sides | 2 |
| 4 | VictoryRewardSlot | `victory-slot-{currency\|material\|pill\|equipment}` | 58×58 tiles in 526/280/620/120 row | icon set | Reward slot tiles: kind-tinted frame variants (jade-ish for currency linh thạch, neutral for materials, warm for pills, gilded for equipment) + corner amount badge plate | 1–2 |
| 5 | VictoryGrowthCard seals | `victory-growth-seal-{technique\|skill\|artifact}` | 30×30 in 526/420/620/140 row | icon set | Small round seal glyphs distinguishing technique mastery (gold ), skill insight (jade ), artifact insight (cinnabar ) | 2 |
| 6 | VictoryActions glyphs | `victory-action-retry`, `victory-action-continue` | 14×14 inside buttons | icon | Retry = jade circular-arrow glyph; Continue = gold double-chevron. (Buttons themselves are shared `button-ceremonial` family.) | 3 |

## Shared chrome reused (no new request)

- `surface-xl-scroll` (the horizontal scroll paper), `frame-xl-ceremony` (border), `ink-wash-backdrop` + `ink-wash-seal` (backdrop), `frame-s-slot` (reward tile + growth card frames), `button-ceremonial` (Thu Lại / Tiếp Tục), `divider-ornament` (plaque tails), `seal-accent` (roller caps).

## Runtime CSS (no art needed)

- Refight countdown on the retry button; scrollfade on overflow rows; amount badges; seal glyph placeholders (//); backdrop vignette.

## Ambiguities flagged (not self-decided)

- **Auto-battle countdown**: ref shows both buttons static; current behavior locks retry + shows countdown under auto run-modes — kept as-is (contract behavior).
- **Empty growth row**: when a battle yields no progress-kind rewards the Tăng Trưởng section collapses to a caption line; ref always shows cards — flag: should the section hide entirely on empty?
- **Slot count**: ref shows a fixed 4-slot row; summary data is dynamic (1 linh thạch + N item kinds) — implemented as wrapping scrollfade row.
- **Flavor line**: ref includes a small flavor caption under the title; added as `combat.victory.flavor` — confirm intended copy.
