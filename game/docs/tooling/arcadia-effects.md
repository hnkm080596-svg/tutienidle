# Arcadia Effects tooling bridge

This document is the discovery and handoff contract between Tu Tien IDLE and the
external [Arcadia Effects](https://github.com/xaidan777/Arcadia-Effects) editor.
Arcadia is an authoring tool, not a game dependency. Its checkout, effect source
files, and editor runtime stay outside this repository.

## Verified local installation

Verified on 2026-10-04:

- Tool repository: `E:\tutienidle-tools\arcadia-effects`
- Application root: `E:\tutienidle-tools\arcadia-effects\Arcada Effects`
- Upstream commit: `ed2bd1b371ecdaae9274f207c77535c61610f0f8`
- Upstream remote: `https://github.com/xaidan777/Arcadia-Effects.git`
- Verified Node.js: `v24.19.0`
- Editor URL: `http://127.0.0.1:5179/`

`Arcada Effects` is the directory name in the upstream repository; keep that
spelling when resolving paths. Arcadia requires Node.js only. Do not run
`npm install`; the editor has no package-manager or build step.

## Start the editor locally

For an interactive Windows session, run:

```powershell
Set-Location 'E:\tutienidle-tools\arcadia-effects\Arcada Effects'
.\run.bat
```

`run.bat` starts `node server.mjs` and opens the browser. For an agent or a
terminal session where opening a browser is undesirable, run:

```powershell
Set-Location 'E:\tutienidle-tools\arcadia-effects\Arcada Effects'
node server.mjs
```

Open `http://127.0.0.1:5179/`. Stop the foreground server with `Ctrl+C`.
Server mode persists effects to `library/*.json`. Opening `index.html` directly
uses browser `localStorage` instead and is not the canonical shared workflow.

## Codex and agent workflow

Before creating or changing an effect, read these files in the Arcadia
application root:

1. `CLAUDE.md` for repository rules and tool routing.
2. `skills/afx-effect-authoring/SKILL.md` for the authoring workflow.
3. `docs/FORMAT.md` for the JSON contract.
4. The closest existing example under `library/`.

Create a new `library/<EffectName>.json`; do not overwrite an existing user's
effect without explicit authorization. Use stable `doc.id` and layer IDs, keep
effect/layer names in English, then validate from the application root:

```powershell
node tools/validate.mjs 'library/<EffectName>.json'
```

Preview the saved file with a deep link such as:

```text
http://127.0.0.1:5179/?open=<EffectName>.json&tab=atlas&fresh=1
```

The `fresh=1` query forces the saved file to win over the browser working copy
and can discard unsaved browser edits for that effect. Use it only after
confirming there is no browser-only work to keep; it does not delete the saved
JSON. Visual review remains required because the validator checks structure and
simulation, not whether the effect reads well in the game.

## Cloud-hosted versus local/self-hosted agents

A local agent or a self-hosted agent running on this Windows machine can use the
verified `E:` path directly. A cloud-hosted sandbox cannot assume that the local
drive is mounted. In that environment:

1. Read this file to discover the tool and exact upstream repository.
2. Clone Arcadia into a writable sibling or session-tools directory.
3. Resolve the application root as `<clone>/Arcada Effects`.
4. Read Arcadia's local instructions, create a new library JSON, and run the
   validator there.
5. Start `node server.mjs` only when the environment exposes localhost/browser
   access. If it does not, return the validated JSON as an artifact for local
   visual review and export; do not claim atlas-export proof.

Example bootstrap from a writable parent directory:

```text
git clone https://github.com/xaidan777/Arcadia-Effects.git tutienidle-tools/arcadia-effects
cd "tutienidle-tools/arcadia-effects/Arcada Effects"
node tools/validate.mjs
```

The adjacent local checkout is not synchronized automatically with a cloud
clone. To share authored effects, use a separately authorized Arcadia fork or
transfer the individual `library/*.json` as a task artifact. Do not copy the
whole editor into the game repository.

## Export and Phaser handoff

In Arcadia's Atlas tab, prefer `RGBA on transparent background` for normal
Phaser compositing. Export:

- `Download PNG` for a uniform-grid sprite sheet.
- `Meta JSON` for `frameWidth`, `frameHeight`, frame count, grid, duration, and
  fps.
- `Export sequence` for a ZIP containing numbered PNG frames and `meta.json`.

The editable source of truth remains `library/<EffectName>.json`. The PNG sheet
or PNG sequence is a generated artifact.

Importing an export into Tu Tien IDLE is a separate implementation task. That
task should:

1. Copy only the approved generated assets into a reviewed location such as
   `game/public/assets/vfx/arcadia/<effect-slug>/`.
2. Preserve the Arcadia JSON or its separate-repository commit as provenance.
3. Register a uniform grid through the canonical
   `game/src/presentation/assets/AssetBundleCatalog.ts` spritesheet descriptor;
   do not bypass the catalog by loading directly in `CombatScene`.
4. Add the presentation playback adapter/consumer and lifecycle cleanup. The
   current `PhaserSkillVfxDriver` is procedural, so an exported sheet is not live
   merely because it exists under `public/`.
5. Keep gameplay resolution authoritative in core systems; VFX playback may
   acknowledge presentation timing but must not decide damage, costs, rewards,
   or effects.
6. Verify the exact effect in its production Phaser scene, including dimensions,
   frame order/fps, alpha, blend mode, anchor/scale/depth, cleanup, and reduced
   motion behavior.

## Hỏa Cầu Thuật handoff (2026-10-04)

The editable source is mirrored at
`game/art/vfx/hoa-cau-thuat/Hoa Tu Charge.json` for cloud-agent discovery and
stored locally in Arcadia's `library/Hoa Tu Charge.json` for visual editing.
The source mirror is not loaded by the game. After editing in Arcadia, copy the
saved JSON back to the mirror, validate it, and regenerate the RGBA atlas from
the game directory:

```powershell
node 'E:\tutienidle-tools\arcadia-effects\Arcada Effects\tools\validate.mjs' 'art/vfx/hoa-cau-thuat/Hoa Tu Charge.json'
node scripts/export-arcadia-charge.mjs 'E:\tutienidle-tools\arcadia-effects\Arcada Effects'
```

The generated sheet and Phaser metadata are
`game/public/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.png` and `.json`.
Portal sheets and their generated frame indexes live beside the charge asset.
`scripts/index-hoa-cau-portals.mjs` regenerates those indexes without changing
the supplied PNGs. `scripts/index-hoa-cau-fire.mjs` creates BOM-free, occupied
frame-only indexes for the **existing** Fire 9/Fire 20 PNGs; it never replaces
those spritesheets. Both index scripts can be run again after source-asset
changes.

The runtime owner is `HoaCauFireballPresentation` in `CombatScene`. It starts
after cast admission, follows the actual cast clip's impact deadline, and only
uses a sealed landed-hit fact to show Fire 20. The existing skill runner alone
issues impact/complete ACKs. The Arcadia charge has 18 frames over 550 ms; its
release is at 550 ms relative to charge start. With the authored shared Phap Tu
basic attack marker (frame 10 at 8 fps), portal OPEN lasts 612.5 ms, Tụ Hỏa
releases Fire 9 at 1162.5 ms, and Fire 9 reaches the impact ACK at 1312.5 ms.
These cast-relative boundaries adapt to the actual played clip; Fire 9 travel
is never baked into the Arcadia source.

Current Hỏa Cầu revision: the 18 Arcadia frames are retimed over the full
1700 ms portal ACTIVE phase (1425–3125 ms after cast admission). Fire 9 launches
at 3125 ms as CLOSE begins; CLOSE finishes at 3625 ms and the target impact
marker is 3687.5 ms. The earlier short timing paragraph above is historical.
