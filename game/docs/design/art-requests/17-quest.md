# Scene 17 — Quest (Nhiệm Vụ) Art Inventory

Reference: `scenes/17-quest.jpg`. Spec scene "18" Quest regions:
group-tabs 288/176/640/44 · quest-list 288/232/620/540 ·
detail-panel 924/176/608/610 · empty-state 924/380/608/200
(design space 1672×941).

Every temp surface carries `art-needed` + `data-art-id` in the
component tree under `game/src/components/scenes/quest/`.

| # | Component | data-art-id | Design-px | Type | Description | Layer order |
|---|-----------|-------------|-----------|------|-------------|-------------|
| 1 | QuestGroupTabs pill | `tab-seal` | ~120×34 each | chrome | Horizontal pill for group tabs (Tất Cả / cadence); inactive = dark ink fill + thin gold-stroke, active = muted-gold fill + ink text (matches ref's selected pill). Rounded full-pill. | 1 surface fill + label |
| 2 | QuestRow surface | `list-row` | ~596×62 | chrome | Row chrome (assigned chrome slot `list-row` — already shared). Gold-stroke card; selected state = jade border + gold name. | 1 surface |
| 3 | QuestRow thumb | `quest-row-thumb` | 58×44 | prop | Small scenic vignette per quest (landscape snippet) at the row's left edge. Per-quest or per-cadence variant; jade-ink tile stands in now. | 1 clipped image inside row |
| 4 | QuestRow cadence chip | `seal-chip` | ~64×18 | chrome | Small seal-style chip on the row's top line showing cadence (Một Lần / One-Time). Colored variant per cadence in the ref (red/green/blue/purple/gold). | above row surface, below text |
| 5 | QuestDetailPanel surface | `surface-m-panel` | 608×610 | chrome | Detail card (assigned chrome slot `surface-m-panel` — already shared). | 1 surface |
| 6 | QuestDetailPanel name band | `entity-bar` | ~576×32 | chrome | Thin bar behind the quest name between vista and description (spec asset `entity-bar` — shared slot, token fill stands in). | inside panel, below vista |
| 7 | QuestDetailVista | `quest-vista` | ~576×168 | vista | Painted landscape banner across the top of the detail panel (mountains/valley ink scene). The ref shows a unique scene per quest — one generic quest vista is fine for scaffold; per-quest variants optional later. | inside panel, below ribbon overlap |
| 8 | QuestDetailVista ribbon | `quest-cadence-ribbon` | ~34×96 | prop | Vertical hanging ribbon pinned over the vista's top-left carrying the cadence label (ref shows red ribbon with category text). Notch-tail cut, soft drop shadow. | above vista |
| 9 | QuestSectionPlaque | `section-plaque` | ~150×26 | chrome | Small hanging-tab section headers ("Mục Tiêu Nhiệm Vụ" / "Thưởng Nhiệm Vụ") — jade tab + gold text (assigned chrome slot `section-plaque` — already shared). | above section content |
| 10 | Reward cell icon | `reward-icon` | 46×46 cell | prop | Icon cells with xN corner count for reward entries. Currency kinds (linh thạch, tu vi, cảm ngộ) need token glyphs; material/pill rewards reuse their registry icons directly. | inside cell |
| 11 | Claim button | `button-ceremonial` | ~full-width×44 | chrome | Large claim CTA at the panel's foot (assigned chrome slot `button-ceremonial` — shared GameButton lg). | 1 chrome + label |

## Notes for Minh

- **Cadence ribbon color**: the ref ribbon is red and reads a quest
  *category* (Chính Tuyến); the scaffold renders *cadence* (Một Lần)
  because categories have no data model in beta. If categories return,
  recolor per category (red main / green side / blue daily / purple
  weekly / gold achievement — the same palette the row chips use).
- **Row thumbs**: one generic ink tile stands in everywhere. A
  per-cadence thumb set (or per-quest scenic snippets) will need a
  data-art-id scheme like `quest-thumb-<cadence>`.
- **Quest tracker chip** (bottom-right HUD, scene 03 region
  `quest-tracker`) already shipped its own temp styling in scene 03 —
  the pill + quest glyph is fine; only revisit if the HUD chip needs a
  painted frame like the list rows.
- **Excluded on purpose**: "Lời Dặn" flavor quote block and "Lv.NN"
  row badge in the ref have no data source (flagged to coordinator) —
  no art assigned yet.
