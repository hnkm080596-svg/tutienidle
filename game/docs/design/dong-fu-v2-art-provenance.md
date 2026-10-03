# Scene 03 - art v2

Generated with the built-in ImageGen tool, 2026-10-03. Visual target: `references/huyen-kim/scenes/03-dong-fu.jpg`.

Asset directory: `public/assets/ui/huyen-kim/scene/dong-fu-v2/`.

- `world-master.png`: composition master; preserve as reference, do not combine with foreground in runtime (duplicate geometry).
- `rear.png`: rear environment plate.
- `foreground.png`: transparent foreground dais and near scenery; same canvas as rear plate.
- `cultivator.png`: transparent seated figure.
- The rear and foreground are intended for separate parallax movement. These generated layers are not yet integrated into the live scene.
- `panel-nine-slice.png`: square 1254 x 1254 nine-slice source, 360 px inset on each edge. `panel-nine-slice.json` specifies source coordinates and logical display dimensions. Fixed corner ornaments, plain stretchable edges, independent center. Do not stretch the earlier portrait frame as a single image.
- `dong-fu-nine-slice-preview.html` demonstrates this texture at 320 x 460, 600 x 180 and 252 x 252, all with 52 px display borders. This is an asset preview, not live-game integration or a completed Scene 03.
- Browser visual check: all three sizes display the same corner ornament size and continuous edges. Screenshot: `../qa/huyen-kim-reference-fidelity/evidence/dong-fu-nine-slice-preview.png`. This confirms the asset slicing sample only, not game QA.

## Final generation prompts

## dongFuWorldPrompt

Use case: precise-object-edit. Image 1 is the exact composition target, a Vietnamese cultivation game home screen. Create a clean high-resolution 16:9 ENVIRONMENT BACKGROUND PLATE for this very scene, preserving its architecture, camera, layered floating mountains, waterfalls, bridges, pink blossom trees, gigantic warm moon centered at x50% y15%, blue-black starry sky, ornate illuminated pagodas and cinematic black/gold/ivory painterly fantasy style. Remove ALL interface: all text, nameplates, top HUD, avatar, coins, icons, radial command wheel and its gold circles, right quest panel, bottom chat box, quest tracker. Reconstruct scenery behind removed interface naturally, same architectural density and composition. Remove ONLY the seated central HUMAN so that the large ornate round cultivation dais at bottom center remains empty, intact, at the same scale and position. Keep the platform and front stairs/rails. NO people, NO text, NO symbols floating as UI, NO UI panels. Preserve the reference environment rather than designing another village. Buildings must remain integrated into the master landscape, not separate cutouts. This is the opaque rear/middle painting plate for a parallax scene, foreground character and atmospheric mist will be separate transparent layers.

## dongFuFigurePrompt

Use case: background-extraction. Image 1 is the reference. Extract and faithfully repaint ONLY the seated central male cultivator as an isolated full-body transparent PNG game asset. Preserve the reference identity, long flowing black hair, small gold hair crown, black/gold brocade and ivory robes, handsome youthful xianxia face looking slightly down to the right, cross-legged meditation pose, both hands holding a tiny glowing gold qi light in lap. Exact high-end richly detailed painterly fantasy treatment from the reference, warm moonlit gold highlights, no chibi proportions. Full silhouette visible, cloth and hair trailing left. Center the seated figure in a square canvas, generous clear alpha margin. Remove the entire landscape, platform, interface, all text, all command-wheel icons and gold orbit lines. No backdrop, no shadow plane, no extra symbol, no frame. True transparent background, clean soft hair edges. The asset will be placed on the existing empty round dais; do NOT include the dais itself.

## dongFuForegroundPrompt

Use case: background-extraction. Image 1 is an exact EDIT TARGET. Produce a transparent full-canvas 16:9 parallax FOREGROUND layer from this image. Retain ONLY the nearest round ornate cultivation dais at bottom center (including its gold circular floor, stone skirt and railings), the front stairs/path approaching it, closest bottom-edge lanterns and stone railings, and nearest blurred cherry blossom branches at bottom-left and bottom-right. Preserve their exact geometry, placement, scale, colors and perspective on the original full canvas. Everything else including all sky, moon, mountains, waterfalls and distant buildings must be fully transparent. Keep the top 70% of canvas transparent; the dais starts near y76% with its railings at y73%. Do not move or enlarge any element. No people, no text, no UI. This must overlay the original master without rearrangement; genuine alpha, crisp clean architecture edges and delicate blossom edges. Output same full 16:9 composition.

## dongFuRearPrompt

Use case: precise-object-edit. Image 1 is the exact edit target and must retain its full 16:9 framing. Make a parallax REAR ENVIRONMENT plate: remove ONLY nearest foreground objects in the bottom 30 percent: the big central round cultivation dais and its stairs/path, bottom-edge lanterns, front stone balustrades and blurred near blossom branches at bottom corners. Inpaint that formerly occluded bottom area with distant misty mountain valleys, cloud and waterfall continuation. Preserve the entire sky, moon, celestial circles, all mountains and ALL distant buildings at their exact pixel locations above and around the removed foreground. Do not change composition, lighting, architecture, colors or camera. No new foreground platform, no characters, no UI, no text. This opaque plate will sit BEHIND a separately extracted exact-position foreground. No other edits.

## dongFuNineSlicePrompt

Use case: precise-object-edit. Image 1 is the edit target: an ornate black-green and aged-gold game UI frame. Convert it into a genuine NINE-SLICE SOURCE TEXTURE. Keep its elegant fine gold linework, dark ink lacquer, and four sculpted curling corner ornaments. Make the canvas SQUARE. Put all unique ornamentation entirely within the outer 22% corner squares. The four edge strips between corner squares must be perfectly straight, constant thickness, simple parallel gold lines, no central crests, no leaves or unique motifs halfway along any edge. Remove the top-center and bottom-center emblems completely. The middle 56% square must be uniform nearly-black green subtle ink texture with no identifiable painting, writing or ornament, suitable for stretching in both directions. Front orthographic, axis aligned rectangular frame, symmetric corner footprint. Keep outer transparent margin minimal and equal on all sides. Real alpha transparency outside the frame; opaque dark interior. No labels, no slice guides, no grid, no letters, no drop shadow, no mockup. This is a single production texture, not an illustration of nine separate tiles. Corners must remain beautiful when held fixed while the plain edge strips and center are independently stretched.
