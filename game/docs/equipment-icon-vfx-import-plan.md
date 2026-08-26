# Equipment Icon and VFX Import Plan

## Scope

- Create five random visual variants for each of the eight real equipment
  templates: `base_kiem`, `base_chau`, `base_quyen`, `base_quan`, `base_bao`,
  `base_hai`, `base_gioi`, and `base_truy`.
- Import the user-provided VFX spritesheet library from
  `E:\Sprite3\Assets\Texture2D\SpriteSequences\Spritesheets`.
- Wire the new item icons into the existing `EQUIPMENT_ICON_POOLS` mechanism.

## Equipment icon rules

- 40 final PNG files: five variants x eight templates.
- Final runtime dimensions are exactly 64 x 64 pixels.
- Refined chibi mac-hoa / hand-painted ink artifact art, matching the established
  game assets while remaining readable at inventory scale. Mac-hoa controls the
  brush texture; it must not make equipment look crude or unfinished.
- One centered object only, strong silhouette, real RGBA transparency, and safe
  padding for the inventory frame.
- Every variant needs its own recognizable ornament language: cloud, lotus,
  crane, mountain, wave, celestial, or elemental motifs expressed through
  guards, filigree, engraving, inlay, embroidery, or an internal magic core.
- Use restrained mineral and elemental color accents over an ink-wash base. Do
  not bake rarity frames, broad rarity glows, labels, quantities, or enhancement
  marks into the icon because those states are rendered by the UI. A contained
  internal glow is required for Châu because Châu are magic orbs, not inert
  marbles.
- Slot placeholders under `public/assets/equipment-slots/` remain unchanged.
  Real item variants live under `public/assets/equipment/items/<template-id>/`.

## Icon matrix

| Template | Item type | Five visual variants |
| --- | --- | --- |
| `base_kiem` | Kiếm | five ornate straight swords with distinct cloud/lotus/crane/mountain/celestial motifs; no saber, spear, or staff |
| `base_chau` | Châu | five Ngũ Hành magic orbs with energy cores, ritual rings, and distinct internal sigils; never plain material balls |
| `base_quyen` | Quyền | five matching fist-guard / martial-gauntlet designs |
| `base_quan` | Quán | five traditional headpiece/crown designs |
| `base_bao` | Bào | five robe designs |
| `base_hai` | Hài | five traditional shoe/boot designs |
| `base_gioi` | Giới | five ring designs |
| `base_truy` | Trụy | five pendant designs |

## VFX import

- Destination: `public/assets/vfx/spritesheets/`.
- Preserve all original filenames and PNG/JSON pairs.
- Expected source inventory: 568 PNG files, 569 JSON files, 1,137 files total,
  approximately 201 MiB.
- Do not preload the entire library. Future combat integrations should load only
  named atlases that a scene or skill actually uses.
- Add an import README with the source path, inventory, and a Phaser atlas load
  example.

## Production order

1. Inventory equipment slots and source VFX format.
2. Import and verify the VFX library without renaming files.
3. Generate five icons per equipment template using one ImageGen call per icon.
4. Normalize real alpha and downscale final files to 64 x 64.
5. Update `EQUIPMENT_ICON_POOLS` and relevant tests.
6. Run contact-sheet QA, focused tests, type-check, and build.

## Acceptance criteria

- Each equipment template resolves to exactly five valid 64 x 64 RGBA icons.
- Random icon selection remains constrained to the exact item template, so a
  Kiếm instance can never receive Châu or Quyền art.
- The VFX destination contains the same PNG/JSON file count as the source.
- Existing slot-placeholder images are not overwritten.
- Tests, type-check, and build complete successfully, aside from explicitly
  documented unrelated failures.
