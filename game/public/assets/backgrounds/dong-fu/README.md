# Thanh Vân Động Phủ background

`thanh-van-dong-fu-base.png` is a `1672 × 941` environment-only home scene. It intentionally contains no character and no building. Empty terraces are reserved for separately overlaid interactive world objects.

The composition includes a rear terrace, upper-left and mid-left terraces, a right-side spring terrace, a central cultivation platform, and a lower-center gate foundation.

This production pass mounts the art at runtime: `DongFuScene.vue` renders `thanh-van-dong-fu-base.png` as the cover-fit base layer of the home scene (2026-08-26). The old Phaser-side mount in `MainScene.ts` was removed to keep a single render pipeline.

`dong-fu-layout-preview.png` is a flattened QA mockup showing the six separate building PNGs placed over the background. It is not a runtime texture.
