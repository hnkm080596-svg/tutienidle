# Scene 06 — Technique (Công Pháp / Tâm Pháp) Art Inventory

Reference: `game/docs/design/references/huyen-kim/scenes/06-technique.jpg` · spec: `huyen-kim-scene-layout-spec.md` §Scene 06 · Design space 1672×941, content area 288/176/1244/610.

Every `art-needed` surface below is temporary CSS until Minh's art lands. `data-art-id` = manifest slot id (chrome) or request id (prop/vista). Components live under `game/src/components/scenes/technique/`.

| # | Component | data-art-id | Design-px (w×h) | Type | Description | Layer order |
|---|-----------|-------------|-----------------|------|-------------|-------------|
| 1 | `card/TechniqueInfoCard` | `surface-m-panel` | 400×480 @ 288/176 | chrome | Left "Công Pháp" card ground + carved border; title row + help seal sit on top | z0 slice → content z2 |
| 2 | `card/TechniqueInfoCard` | `icon-button-utility` | 24×24 | chrome | Circular "?" help seal, top-right of the card title row (slot unwired — temp CSS until a dedicated help-seal consumer) | inside card header |
| 3 | `card/TechniqueNamePlate` | `seal-chip` | ~96×26 | chrome | Cinnabar quality seal chip beside the technique name ("TÀN PHẨM" style, text-colored per quality) | z0 slice → label z2 |
| 4 | `card/TechniqueSectionBlock` | `section-plaque` | ~160×24 | chrome | Thin gold plaque behind each section eyebrow ("Hiệu Quả Chính" style headers; real labels come from the model) | z0 slice → eyebrow z2 |
| 5 | `vista/TechniqueArtifactVista` | `technique-artifact` | ~340×442 centered in 448×480 @ 704/176 | prop | **EXCLUDED-ART PLACEHOLDER** — painted technique scroll/book resting on the dais; bamboo-slat temp panel now. Replaces the frame content (the runtime slot card stands in inside it) | above plinth, under flourish |
| 6 | `vista/TechniqueArtifactVista` | `technique-display-plinth` | 448×480 @ 704/176 | vista | Existing carved pedestal PNG (`stableSceneArtUrl`) — kept, no new art needed | z0 under frame |
| 7 | `vista/TechniqueArtifactVista` | `divider-ornament` | ~350×18 @ bottom | prop | Gold ornament divider strip under the artifact frame (ref's small flourish under the vista) | top-most vista layer |
| 8 | `track/TechniqueGradeNode` | `dao-luan-node` | 44×44 | chrome | Ring medallion disc behind each grade label; `is-current` = gold glow, `is-next` = dashed jade ring | disc → label below |
| 9 | `track/TechniqueGradeTrack` | — (link connector) | 56×2 | prop | Jade→gold connector bar between grade nodes (minor; keep as CSS or fold into track strip art) | between nodes |
| 10 | `upgrade/TechniqueUpgradePanel` | `surface-m-panel` | 364×610 @ 1168/176 | chrome | Right "Tăng Rank → Nâng Cảnh" panel ground + border; full-height column | z0 slice → content z2 |
| 11 | `upgrade/TechniqueMaterialCard` | `list-row` | ~332×48 | chrome | Row tile behind material name + owned/needed count | z0 slice → row z2 |
| 12 | `upgrade/TechniqueMaterialCard` | `frame-s-slot` | 40×40 | chrome | Small slot frame for the material icon glyph (◆ placeholder now — glyph art TBD per material) | inside row, left |
| 13 | `upgrade/TechniqueUpgradeCta` | `button-ceremonial` | ~180×48 | chrome | Ceremonial pill CTA ("Nâng Cảnh" + price line); disabled = greyed but still quotes cost | z0 slice → label z2 |

## Notes for Minh

- **Region geometry** (design px): tech-card 288/176/400/480 · artifact-vista 704/176/448/480 · grade-track 288/668/864/118 · upgrade-panel 1168/176/364/610. Spec lists tech-card h=610 which would collide with the track; the ref shows it ending at the vista's bottom edge (≈480) — flag for confirmation.
- **Caption "Cảnh Giới Công Pháp"** (grade-track header) and the node labels are runtime text — letterspaced caps styling only, no art.
- **Node states** are runtime overlays (gold ring = current grade, dashed jade = target); paint only the neutral ring disc.
- The **Linh Thạch/stone cost** second material card in the ref has no model source — the contract quotes one material per advance; keep the row art generic for a single row.
- Chrome slots (1, 3, 4, 8, 10, 11, 12, 13) are already wired to manifest art; entries here document the placement for restyling. Props (2, 5, 7, 9) are net-new paint.
