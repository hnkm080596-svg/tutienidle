# Shared UI frame focused verification

Scope: outer game frame, body portals, tooltip bounds, notification anchors, legacy skin ownership limits. No full QA was run, per user scope.

- Type-check passed.
- 10 focused tests passed: shared frame (4 viewport shapes), design canvas resize, toast rendering and small-screen position/scale.
- At 655x576, GameRoot is x=0, y=103.78125, width=655, height=368.4375. SceneDesignCanvas and Phaser share that rectangle with subpixel raster rounding.
- Rail checks opened Tu Si, Cong Phap, Trang Bi, Luyen The, Canh Gioi, Tru Vat, Luyen Dan, Son Ha Do, Nhiem Vu, San Xuat, Kien Truc, Cai Dat and Tro Giup. Rendered GamePanel bounds stayed inside the shared rectangle. Transition frames can temporarily include both departing and arriving panels.
- Tam Phap is progression-locked in this runtime save. Its panel was not verified; its pending toast uses the shared anchor.
- Toast root at 655x576 uses scale 0.454861, design top 204 and right 18 mapped to screen coordinates.
- Legacy skin remains available outside component boundaries; no asset or CSS file was deleted.

Limitations: tooltip flip/shift/size and body-modal/FX constraints were source-reviewed and type-checked; every tooltip type, confirmation flow and cinematic was not visually exercised. This is focused UI evidence, not an unqualified full-game QA verdict.
