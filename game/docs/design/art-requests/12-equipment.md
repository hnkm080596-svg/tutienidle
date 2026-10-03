# Scene 12 — Equipment (Trang Bị / Khí Đường) Art Inventory

Reference: `game/docs/design/references/huyen-kim/scenes/12-equipment.jpg` · spec: `huyen-kim-scene-layout-spec.md` §Scene 12 · Design space 1672×941, content area 288/176/1244/610.

Every `art-needed` surface below is temporary CSS until Minh's art lands. `data-art-id` = manifest slot id (chrome) or request id (prop/vista). Components live under `game/src/components/scenes/equipment/`.

Region columns (design px): `ops-rail` 288/176/132/610 · `paperdoll` 436/176/380/610 · `item-card` 832/176/330/610 · `bag-grid` 1178/176/354/610.

| # | Component | data-art-id | Design-px (w×h) | Type | Description | Layer order |
|---|-----------|-------------|-----------------|------|-------------|-------------|
| 1 | `rail/EquipmentOpsSeal` | `nav-seal-vertical` | ~84×128 per seal, 6 seals stacked @ 288/176 | chrome | Hanging seal tile behind each rail entry; active = gold glow (runtime state, paint neutral + hover only) | seal art z0 → glyph + vertical label above |
| 2 | `rail/EquipmentOpsSeal` | `ops-seal-glyph` | ~25×25 inside seal | prop | Per-op seal pictogram (Cường Hóa/Tẩy Luyện/Tinh Luyện/Hóa Luyện/Phân Giải); today a ◆ diamond — the Trang Bị view seal already uses the stable `equipment` glyph | inside seal, left of label |
| 3 | `paperdoll/EquipmentPaperdollStage` | `equipment-paperdoll-base` | 380×610 @ 436/176 | vista | Existing stable mannequin substrate under the 6 sockets — kept, no new art needed (stableSceneArtUrl) | z0 under sockets |
| 4 | `paperdoll/EquipmentPaperdollStage` | `equipment-stage-plinth` | ~310×70 @ bottom of paperdoll | prop | Painted plinth slab + jade glow the figure stands on (ref's pedestal under the doll); temp CSS radial shadow now | under doll, above backdrop |
| 5 | `detail/EquipmentItemCard` | `surface-m-panel` | 330×610 @ 832/176 | chrome | Item card ground + border; hosts detail OR the active op workspace | z0 slice → content z2 |
| 6 | `detail/EquipmentItemDetail` | `seal-chip` | ~72×24 each | chrome | Small chip seals: quality name (top-right in ref) + "Đã Mặc" equipped tag; text-colored per quality at runtime | inside card, top row |
| 7 | `detail/EquipmentItemDetail` | `button-standard` | ~full-width×40 | chrome | Equip/Unequip action button at card foot (GameButton md auto-chrome) | z0 slice → label z2 |
| 8 | `bag/EquipmentBagPanel` | `surface-m-panel` | 354×610 @ 1178/176 | chrome | Bag panel ground + border on the RIGHT (owner ruling: ref keeps bag right, not forge) | z0 slice → BagGrid z2 |
| 9 | `bag/EquipmentBagPanel` → `BagGrid` | `tab-pill` (existing) | ~72×24 × 3 | chrome | Category tab pills — canonical BagGrid already wires these (Tất Cả/Trang Bị/Nguyên Liệu Đan corrected to the real sections) | inside bag header |
| 10 | `bag/EquipmentBagPanel` → `BagGrid` | `frame-s-slot` | 48×48 per cell | chrome | Item cell frames in the grid — already wired inside bag-sections | per cell |

## Notes for Minh

- **Star row** (5 lit/unlit stars under the name plate) is runtime text (★ per quality rank out of `ITEM_QUALITY_ORDER` = 5); the ref shows 6 — flag for audit whether a 6-star domain was intended. Paint only if a star glyph icon is wanted, else CSS suffices.
- **"Chiến Lực" plaque** under the paperdoll in the ref is intentionally unbuilt: combat power is a CharacterPanel-local display heuristic, not a shared read-model — no data to quote. If it ships, it needs a small plaque chip art (~140×36).
- **Capacity readout** ("Dung Lượng 86/200" in the ref) has no capacity model — bags are unbounded; the canonical BagGrid shows a per-tab count only. Flag for design.
- **Rail count**: ref shows ~6 seals; the contract ships the Trang Bị view seal + beta-admitted ops (Cường Hóa + Hóa Luyện at launch; Tẩy Luyện/Tinh Luyện/Phân Giải are scope-hidden). Paint the seal sheet for up to 6 slots anyway.
- **Op workspace** mounts inside `item-card` (detail + ops share the region per spec); the qi-hall `.qi-hall__*` vocabulary sheet styles the op bodies — no new art requested beyond rows/buttons already inventoried elsewhere.
- Chrome slots 1, 5, 6, 7, 8, 9, 10 are already wired to manifest art (entries document placement for restyling). Net-new paint: 2 (op glyphs), 4 (plinth), and optionally the star glyph + Chiến Lực plaque.
