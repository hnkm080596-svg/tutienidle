# Audio Credits — TutienIdle

Only CC0 / public-domain or self-created assets are accepted here (licensing
rule: `docs/audio-game-feel-plan.md` §"Giấy phép asset"). Record every file
you add:

| File | Source | Author | License | Notes |
|------|--------|--------|---------|-------|
| _(none yet)_ | | | | |

Directory layout (manifest `src` values resolve against `public/`):

- `music/` — route music slots (`music.menu`, `music.home.*`, `music.combat`, `music.tribulation`)
- `sfx/` — combat/world cues (`combat.*`, `tribulation.*`, `stinger.*`, `progress.*`, `craft.*`, `farm.*`, `ambient.*`)
- `ui/` — interface cues (`ui.*`)

Dropping `.ogg` files in the right folder and pointing the cue's `src` at
them in `src/core/audio/AudioCueManifest.ts` is the entire flow — missing
files are silent no-ops.
