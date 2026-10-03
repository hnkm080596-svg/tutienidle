# Scene 04 — Nhân Vật (Character) Art Requests

Design space **1672×941**, imperial-scroll envelope 92.1vw × 89.3vh. Temporary CSS art stands in for each row below; every temp surface is marked `art-needed` + `data-art-id` in the DOM. Reused ready chrome (not requested here): `avatar-frame`, `section-plaque`, `surface-l-drawer`, `seal-chip`, `list-row` styling, `el-*.png` element discs, `el-formation-{orbs,ring,star}`.

| # | component | data-art-id | design-px | type | description | layer order |
|---|---|---|---|---|---|---|
| 1 | CharacterIdentityHeader | `character-name-seal` | 26×26 | raster | Carved cinnabar seal stamp beside the player name (ivory carved character face, beveled edge). Sits inline after the name. | 2 (above text baseline, topmost in header) |
| 2 | CharacterIdentityHeader | `combat-power-plaque` | ~300×60 | 9-slice or raster | Ornate dark ink plaque with gilt filigree border housing the Chiến Lực readout (right end of identity band). | 1 (behind emblem + text) |
| 3 | CharacterIdentityHeader | `combat-power-emblem` | 48×48 | raster | Circular gilt emblem with crossed swords (or faction sigil) at the plaque's left end. | 2 (on plaque, left of text) |
| 4 | CharacterTalentSeals | `talent-seal-glyph-{rarity}` | 34×34 ×5 | raster ×5 | Octagonal seal-glyph medallion per talent rarity (`pham`/`linh`/`dia`/`thien`/`di`) — same carved-seal language as creation screen, tier-tinted cores. | 1 (left end of each seal chip) |
| 5 | CharacterFigureWheel | `character-figure-backdrop` | 400×418 | raster | Painted ink-vista backdrop plate for the figure region: moonlit haze, faint cloud strokes, standing dais at foot. UI scene dressing (no gameplay identity). Must read behind the formation rings and figure. | 0 (rearmost in region) |
| 6 | CharacterMainStatRow | `character-stat-seal-{key}` | 44×44 ×5 | raster ×5 | Hành-seal icon per main attribute — `strength` (Lực/cinnabar), `dexterity` (Phong/jade), `intelligence` (Thần/indigo), `attunement` (Linh/azure), `vitality` (Thể/bronze). Carved glyph on tinted seal core. | 1 (row icon, leftmost) |

## Runtime-CSS (no art needed)

- Stat row progress track + fill (`main-stat__track`/`__bar`): hairline gauge, runtime fill — matches `entity-bar` family; keep CSS unless Minh wants a painted track.
- Section-plaque flanking ornaments (hairline + diamond): runtime CSS strokes.
- Backdrop plate border: reuses gold hairline language of `list-row`.

## Notes for Minh

- Palette anchors: ink `#101718`, jade `#315f55`, muted gold `#b99a55`, ivory paper; cinnabar accent `#B54432` only on the name seal.
- All glyphs should read carved/intaglio (ivory face on tinted seal core), consistent with `seal-chip` and `tab-seal`.
- The figure backdrop must stay low-contrast — the PlayerPortrait sprite and element discs composite on top.
