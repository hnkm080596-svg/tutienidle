# Scene 09 Exploration — Art Inventory (art-needed)

Source ref: `docs/design/references/huyen-kim/scenes/09-exploration.jpg` · Spec: `huyen-kim-scene-layout-spec` scene_id `10` · Audit block authority: `huyen-kim-reference-audit.md` scene 10.

Palette: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper.

All rows below are `art-needed` temp CSS surfaces. Delivered stable art reused as-is (NOT listed): `exploration-map-frame` (canvas frame), `exploration-map-mask` (edge feather), `exploration-chapter-divider` (map-head divider), `boss-seal` chrome (boss medallion badge), `huyen-kim/symbols/lock.svg` (locked node glyph).

| # | Component | data-art-id | Design-px size (≈) | Type | Visual description per ref | Layer / stack |
|---|---|---|---|---|---|---|
| 1 | ExplorationMapPanel → `.stage-map` | `exploration-map-substrate` | 700×524 | vista | Painted "Sơn Hà Đồ" parchment map field: sepia paper with soft ink-wash terrain behind the bands (ruling 04 — substrate is the world-art pipeline's piece; UI requests the backdrop texture) | Z2 field, under bands |
| 2 | ExplorationChapterBand ch1 | `exploration-band-vista-ch1` | ~700×160 | vista | Chapter 1 "Phàm Nhân" terrain band: warm jade-green wash, misty foothill silhouette along the bottom | Z2a inside substrate |
| 3 | ExplorationChapterBand ch2 | `exploration-band-vista-ch2` | ~700×160 | vista | Chapter 2 "Luyện Khí" band: ink-blue wash, higher peaks, faint spirit-stream veins | Z2a inside substrate |
| 4 | ExplorationChapterBand ch3 | `exploration-band-vista-ch3` | ~700×160 | vista | Chapter 3 "Trúc Cơ" band: violet-purple wash, steeper crags, colder mist | Z2a inside substrate |
| 5 | ExplorationChapterMarker ch1 | `exploration-chapter-seal-ch1` | ~56×56 | chrome | Circular chapter seal medallion: jade-green enamel, ink ring, numeral "1" (ref: colored realm discs at each band's left edge) | Z3 over wash, left edge |
| 6 | ExplorationChapterMarker ch2 | `exploration-chapter-seal-ch2` | ~56×56 | chrome | Same medallion form, ink-blue enamel, numeral "2" | Z3 |
| 7 | ExplorationChapterMarker ch3 | `exploration-chapter-seal-ch3` | ~56×56 | chrome | Same medallion form, violet enamel, numeral "3" | Z3 |
| 8 | ExplorationStageNode | `exploration-stage-node` | ~44×44 + label | prop | Numbered waypoint seal: small ink circle with ivory numeral + tiny floor caption. State variants per matrix §2.10: idle ink ring · hover gold rim · selected jade glow · current gold breath · cleared jade fill · perfect gold fill · locked 45% dim + mist + lock.svg · boss = larger fiery cinnabar medallion (~60×60) wearing delivered `boss-seal` art + "BOSS" ribbon | Z3 over trail |
| 9 | (trail path, `.stage-map__trail-path`) | — | — | (runtime) | Winding dashed route line between nodes — stays runtime SVG stroke; painted route art is substrate scope | — |
| 10 | ExplorationChapterTabs chip | `exploration-chapter-tab` | ~150×36 ×3 | chrome | Tab-seal chips above the map: parchment pill, active = gold rim (matrix §2.8 tab-seal) | Z3 header row |
| 11 | ExplorationZoneRail (RESERVED) | `exploration-zone-rail` | 140×560 | chrome | Zone-card rail slot — audit RESERVED: no art until the coordinator enables the rail; listed for slot reservation only | Z3 left column |
| 12 | ExplorationDetailPanel | `exploration-detail-panel-bg` | 372×610 | chrome | Dark ink detail slab: near-black panel with faint gold top sheen, thin frame — the ref's right-hand information card | Z3 right column, under children |
| 13 | ExplorationStageThumb | `exploration-detail-stage-thumb` | ~450×125 | prop | Painted stage vista thumbnail ("Sườn Thanh Vân" landscape snippet: ink mountains on parchment sky, stage code chip bottom-right) | inside detail |
| 14 | ExplorationEnemyList sigil | `exploration-enemy-portrait` | ~38×38 | prop | Enemy portrait card: circular monster portrait medallion (ref shows 3 enemy portrait cards; contract ships ONE displayEnemy card — portrait grid art to artist's discretion) | inside detail |
| 15 | ExplorationRewardRow slot | `exploration-reward-slot` | ~80×60 ×~6 | prop | Reward icon slots: small gold-rimmed cells with item glyph + count chip (ref "Thưởng Vượt Ải" row) | inside detail |
| 16 | ExplorationStartRow CTA | `exploration-start-cta` | ~460×52 | chrome | "Khiêu Chiến" ceremonial plaque: big gold-edged ink button (button-ceremonial family); disabled = washed ink | inside detail |
| 17 | ExplorationProgressFooter track | `exploration-progress-track` | ~1244×56 footer, ~1000×16 bar | chrome | Bottom progress bar: ink-rimmed horizontal track on parchment, gold tick studs at 10/20/30 | Z3 footer |
| 18 | ExplorationProgressFooter fill | `exploration-progress-fill` | variable ×16 | chrome | Jade gradient fill inside the track | inside track |

## Not built (audit authority)
- Attempt counter "Lượt khiêu chiến 10/10" — INVALID.
- Chest visuals at milestone ticks 10/20/30 — RESERVED (generic tick studs only, row 17).
- Zone-card rail — RESERVED (row 11 renders nothing until enabled).
- "Thưởng Hoàn Thành Chương" chapter-completion reward icons in footer — RESERVED with the chests.

## Flagged ambiguities (no read-model found — not self-decided)
- Power-compare rows (ref: two "chiến lực" rows above the CTA) — no `recommendedPower`/player-power read-model exists for stage surfaces.
- Zone description paragraph under "Thanh Vân" — `Zone` has `name` only, no flavor-text field.
- Ref's 3 enemy portraits vs contract's single `displayEnemy` — needs a coordinator ruling on roster-card grid intent.
- Chapter flavor lines under each band's realm seal — no read-model.
