# Dong Fu building art V2 source

This directory contains concept sheets, approved masters, prompts, and production notes for the six runtime Dong Fu buildings.

The original V2 concept sheet is retained as history. The active redesign was approved from an inhabited Ký Bảo Các painted directly into the spring-morning landscape: buildings must read as maintained parts of the same ink painting rather than isolated game icons.

Runtime assets belong under `public/assets/buildings/dong-fu/v2/`; runtime code must never reference files in this directory.

Animated and particle VFX are outside this production pass.

## Runtime production contract

- Stable IDs: `spirit_spring`, `equipment_hall`, `pill_room`, `teleport_array`, `gathering_outpost`, and `vendor`.
- `gathering_outpost` is displayed as `Khai Vật Đường`; its save-facing ID is unchanged.
- `vendor` is displayed as `Ký Bảo Các`, the maintained sect treasure-exchange pavilion.
- Every building layer is an aligned `1254 × 1254` RGBA PNG: ground shadow, base, silhouette mask, then locked overlay.
- Spring, summer, autumn, and winter use one shared `1672 × 941` scene-space RGBA overlay each. Time-of-day remains a runtime grade, so geometry never changes.
- Bounds, baseline, hitbox, scene placement, and future VFX anchors are owned by `DongFuBuildingArt.ts`.
- Files under `public/assets/buildings/dong-fu/v2/previews/` are QA-only and must never be used by runtime URL builders.

Built-in transparent generation produced a fake checkerboard and was rejected. Active sources are the six uniform-white extraction masters in `masters-redesign/`. `scripts/build-dong-fu-building-layers.ps1` performs white unmatting, preserves the registered bounds and baseline, derives a footprint-shaped contact wash instead of an oval pedestal, and regenerates all four aligned RGBA layers. The legacy chroma plates are historical sources only.
