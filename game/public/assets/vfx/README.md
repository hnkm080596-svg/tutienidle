# VFX Spritesheet Library

Imported from the user-provided local library:

`E:\Sprite3\Assets\Texture2D\SpriteSequences\Spritesheets`

Import inventory (2026-08-26):

- 568 PNG spritesheets
- 569 JSON metadata files
- 1,137 source files total
- 210,562,869 bytes total

The original filenames are intentionally preserved so each PNG can remain
paired with its metadata and assets can be traced back to the source library.

Do not preload this whole directory. Load only the atlas required by the current
scene or skill. Example:

```ts
this.load.atlas(
  'energy-explosion-15',
  '/assets/vfx/spritesheets/2D Cartoon FX (Energy Explosion) #15.png',
  '/assets/vfx/spritesheets/2D Cartoon FX (Energy Explosion) #15.json',
)
```

Frame keys in the imported JSON files follow the `frame_0`, `frame_1`, ...
convention. Confirm the desired frame rate and animation repeat behavior when a
specific atlas is integrated into combat.
