# Thanh Vân, Động Phủ, and Building Art Production Plan

## Scope

- Thanh Vân: four seasons combined with four times of day (`4 × 4 = 16` scenes).
- Động Phủ: one layered home environment without baked character or buildings.
- Buildings: one transparent base illustration per active world object.
- No runtime mounting in this production pass.

## Thanh Vân composition model

Season layers preserve one camera and battlefield geometry:

1. far mountains and cloud sea
2. central mountain / gate / waterfall
3. perspective battle ground
4. left foreground frame
5. right foreground frame
6. seasonal atmosphere particles

Time layers are shared across seasons:

1. morning sky and light
2. noon sky and light
3. evening sky and light
4. night sky and light

The season and time layers are combined at runtime, yielding sixteen coherent variants without duplicating every raster layer.

## Active Động Phủ world objects

Verified against `src/data/building/buildings.ts` and `HomeBuildingIcons.vue`:

- `scripture_pavilion` — Tàng Kinh Các; static world object
- `spirit_spring` — Linh Tuyền
- `equipment_hall` — Khí Đường
- `pill_room` — Đan Phòng
- `teleport_array` — Truyền Tống Trận
- `gathering_outpost` — Sản Xuất

Legacy entries such as Phù Viện, Trận Đài, Linh Thảo Viên, Lò Luyện, and Thiên Công Phường are intentionally excluded because they are no longer active building definitions.

## Building state model

Each building is rendered once on a genuinely transparent canvas with stable padding and a grounded three-quarter view. Runtime state does not replace the art:

- default: base image
- hover: warm outline, slight lift, and stronger ground glow
- selected: persistent gold/jade outline plus selection ring
- locked/unbuilt: desaturated dark silhouette
- upgradeable: small pulsing badge/effect outside the building image

This keeps the hit target and silhouette stable across interaction states.
