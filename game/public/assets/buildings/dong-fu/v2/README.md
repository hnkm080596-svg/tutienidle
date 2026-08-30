# Dong Fu building runtime art V2

This is the intended runtime building set for the modular 2D Dong Fu scene.

## Stable building IDs

- `spirit_spring` — Linh Tuyền
- `equipment_hall` — Khí Đường
- `pill_room` — Đan Phòng
- `teleport_array` — Truyền Tống Trận
- `gathering_outpost` — Khai Vật Đường

`gathering_outpost` keeps its save-facing ID and behavior; only its display name changed.

## Per-building contract

Each building directory contains four pixel-aligned `1254 × 1254` RGBA PNGs, rendered in this order:

1. `ground-shadow.png`
2. `base.png`
3. `silhouette-mask.png` for hover/selection outline
4. `locked-overlay.png` when the building is unbuilt

`DongFuBuildingArt.ts` owns the measured visual bounds, architectural baseline, hitbox, scene placement, z-index, and deferred VFX anchors. Do not recenter or crop one technical layer independently.

## Shared presentation

`shared/seasons/` contains one pointer-transparent `1672 × 941` overlay for each of spring, summer, autumn, and winter. Time-of-day uses restrained runtime grading, so building geometry and hit targets remain identical across all sixteen combinations.

Files in `previews/` are deterministic QA composites only. Runtime URL builders must never reference them.

Animated water, forge sparks, alchemy smoke, portal glyphs, command tokens, moving transport lines, and animated seasonal debris are deliberately deferred.
