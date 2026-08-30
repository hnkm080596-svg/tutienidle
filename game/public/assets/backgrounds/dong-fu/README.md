# Dong Fu outdoor sect background

The Dong Fu screen is an open-air immortal-sect landscape, not a literal cave. Runtime art lives in [`modular/`](./modular/) and is composed from ten aligned parallax layers. It shares the current `ThanhVanVariant` with combat, so home and battle use the same season and time of day.

The long foreground cliff is intentionally straight and contains open anchor regions for separately rendered 2D buildings. The low side-view cultivation dais remains fixed at the center. Buildings, characters, UI and interaction state must stay outside the background textures.

`thanh-van-dong-fu-base.png`, `thanh-van-dong-fu-master-buildings-v1.png`, and `dong-fu-layout-preview.png` are legacy/reference images. They are not loaded by `DongFuScene.vue`.

Visual QA composites are under `modular/previews/`; they are never runtime-loaded.
