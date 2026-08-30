# Dong Fu building art V2 source

This directory contains concept sheets, approved masters, prompts, and production notes for the five runtime Dong Fu buildings.

The first approval gate, `concepts/buildings-concept-sheet-v1.png`, was approved by the user on 2026-08-30. It is the identity, camera, silhouette, and ink-style reference for individual production masters.

Runtime assets belong under `public/assets/buildings/dong-fu/v2/`; runtime code must never reference files in this directory.

Animated and particle VFX are outside this production pass.

## Runtime production contract

- Stable IDs: `spirit_spring`, `equipment_hall`, `pill_room`, `teleport_array`, and `gathering_outpost`.
- `gathering_outpost` is displayed as `Khai Vật Đường`; its save-facing ID is unchanged.
- Every building layer is an aligned `1254 × 1254` RGBA PNG: ground shadow, base, silhouette mask, then locked overlay.
- Spring, summer, autumn, and winter use one shared `1672 × 941` scene-space RGBA overlay each. Time-of-day remains a runtime grade, so geometry never changes.
- Bounds, baseline, hitbox, scene placement, and future VFX anchors are owned by `DongFuBuildingArt.ts`.
- Files under `public/assets/buildings/dong-fu/v2/previews/` are QA-only and must never be used by runtime URL builders.

Built-in transparent generation produced a fake checkerboard during the first extraction attempt and was rejected. Approved masters were regenerated on uniform chroma-magenta extraction plates, keyed to genuine alpha, and edge-decontaminated deterministically by `scripts/build-dong-fu-building-layers.ps1`. The chroma plates are source artifacts only and are never runtime assets.
