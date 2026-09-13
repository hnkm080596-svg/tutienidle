# Bản đồ thế giới (World Map — hex)

**Trạng thái:** **Primitive scaffolded** — mechanism + validator đầy đủ trong `core/world-map/`, nhưng **chưa có consumer** (không scene/panel/store nào render hay đọc map ngoài test).

## Model

- `HexCoordinate` — axial `{ q, r }`, `HEX_DIRECTIONS` (6 hướng flat-top), `hexCoordinateKey`, `addHexCoordinates`, `getHexNeighbor(s)`, `getHexDistance` (chuẩn `max(|dq|,|dr|,|ds|)`).
- `HexLayout` — `FlatTopHexLayout { size, origin }`: `axialToPixel`, `pixelToAxial` (round về hex gần nhất), `getFlatTopHexCorners`. `size` = khoảng tâm→góc trái/phải → footprint `2×size` rộng, `√3×size` cao.
- `WorldMapDefinition` — `{ id, zoneId, name, initialCenter, sprites: WorldMapSpriteDefinition[], tiles: WorldMapTile[] }`.
  - `WorldMapTile`: `id`, `coordinate`, `spriteId` (base terrain), `overlaySpriteIds?` (render theo thứ tự mảng), `stageId?` (ô gắn stage gameplay), `elevation?` (cao hơn render sau cùng hàng), `terrainId?` (tag semantic cho tool/rule tương lai).
  - `WorldMapSpriteDefinition`: `id`, `source` (`image` url hoặc `sheet` url+frame rect — tách map data khỏi atlas exporter), `anchor?` (điểm chuẩn hoá ngồi trên tâm hex).
- `compareWorldMapTileDepth` — painter order: theo hàng (`r + q/2`) → `elevation` → `q`.

## Validator — `WorldMapValidator`

`validateWorldMap(definition, options)` trả `WorldMapValidationIssue[]` với code:

`duplicate_sprite_id`, `invalid_sprite_source`, `duplicate_tile_id`, `duplicate_coordinate`, `unknown_sprite`, `duplicate_stage`, `unknown_stage`, `missing_stage`, `non_adjacent_stage`.

`WorldMapValidationOptions`: `validStageIds` (mọi stage id đã đăng ký), `requiredStageIds` (stage bắt buộc có trên map, theo thứ tự), `requireAdjacentStages` (stage bắt buộc liên tiếp phải ở hex kề nhau).

## Liên quan

- [enemies-stages.md](./enemies-stages.md) — `stageId` trên tile trỏ Stage definition.
- [presentation.md](./presentation.md) — renderer tương lai sẽ thuộc layer này.
