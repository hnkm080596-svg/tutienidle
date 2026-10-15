# UI Soundpack integration — Quest V2 worktree (2026-10-15)

## Scope / G0

- Worktree: `E:\tutienidle\.agent-worktrees\quest-v2-integration`; branch `codex/quest-v2-integration`; baseline HEAD `1f094581bc6187bf91a55564a91c4a4b8753a7f4`.
- User request: bring the existing Codex UI Soundpack into this worktree and connect currently declared audio cues to the game's established audio pipeline.
- Source (left unchanged): `E:\tutienidle\.agent-worktrees\ui-sound-pack\deliverables\ui-sound-pack` (`codex/ui-sound-pack`, uncommitted deliverable).
- Owner / consumer chain: `AudioCueManifest.AUDIO_CUES` -> `AssetBundleCatalog.audioDescriptorsFor` -> route-specific `audioAssetWiring` / `AssetBundleManager` -> `AudioManager.playCue` -> existing UI/presentation producers.
- Changes: copy all deliverables under `deliverables/ui-sound-pack`; install 43 mapped WAVs under `game/public/assets/audio/ui`; populate `src` on 37 already declared cues in `AudioCueManifest`; update one existing bundle test and add `tests/architecture/audioSoundpackAssets.test.ts`.
- Preserve all Quest V2 modifications, existing cue channel/ducking/cooldowns/fallbacks, and source soundpack. No deletions, commits, merges, pushes or deployment.
- Outside scope: 11 proposed cues with no manifest/producer contract, 2 reserved cues, audio redesign, scene-specific audio hooks, audio changes to Quest V2 gameplay.

## Architecture / G1

| Check | Decision / evidence |
| --- | --- |
| Q1 | Existing emitted cues resolve to authored WAV files when loaded; fallback remains available until decode. Missing/failed file remains optional. |
| Q2/Q3 | Existing `AudioManager` and manifest remain the single playback/cue owners. No gameplay state introduced. |
| Q4 | `AudioCueManifest` -> `AssetBundleCatalog` descriptors -> `audioAssetWiring` -> `AudioManager`, existing consumers unchanged. |
| Q5/Q6 | Reuse `AudioCueDef.src` string/string-array, lazy audio asset bundles, decoder and variants. No new manager or dependency. |
| Q7 | Presentation audio remains detached from gameplay settlement, reward and clock authority. |
| Q8 | All 37 `status: existing` entries in `integration-map.json` have exactly matching runtime `src` values. |
| Q9/Q10 | No reads trigger gameplay mutations. Existing fallback and optional loading contracts remain; no new async owner. |
| Q11 | Existing synth fallbacks retained. Reserved/proposed cues remain in listening deliverable only. |
| Q12 | No Quest code changed by this integration. Verification and gaps below. |

## Evidence / G2–G5 checkpoint

- Deliverable: 60 WAV files, listening page, manifests, mapping, previews and original ZIP copied. ZIP SHA-256 matches source.
- Runtime assets: 43 WAVs selected by the 37 existing cue IDs, source-to-target SHA-256 mismatch count `0`.
- Manifest-to-mapping mismatch count `0` (all 37 IDs and each variant URL compared).
- `npm run type-check`: PASS (after moving file-system test into architecture test suite).
- `npx vitest run src/core/audio/AudioCueManifest.test.ts src/presentation/assets/AssetBundleCatalog.test.ts src/core/audio/AudioManager.test.ts tests/architecture/audioSoundpackAssets.test.ts tests/architecture/audioManifestCompleteness.test.ts`: **5 files / 62 tests PASS** with TEMP/TMP redirected to a dedicated worktree folder. Without redirected temp, all suites failed before collection on a sandbox `EPERM` temporary rename.
- `npm run build-only -- --outDir .qa-audio-build-20261015`: PASS. This new build directory avoids erasing pre-existing `dist/`, in accordance with the user's no-deletion constraint. All 43 WAVs exist in the built output; SHA-256 mismatches `0`.
- `git diff --check`: PASS. No source soundpack modification.
- Actual browser/audio-listening runtime: **UNVERIFIED**. Playwright Chromium unavailable; Edge failed to launch with `TargetClosedError2` / exit code `3221225477` under the sandbox, including a worktree-local browser profile attempt. Vite server started in the target worktree, but HTTP loopback requests returned socket permission errors, so HTTP/audio playback could not be certified. The failed Edge attempt temporarily created a profile inside `game/`, triggering a Vite watcher `EBUSY` error; the entire profile was preserved by moving it to the worktree root `.qa-audio-edge-profile/`. Vite was successfully restarted from this worktree afterward.
- Full Vitest, full fixed-point protocol, P18 OCR and sequential P5 gates: **NOT COMPLETED**. OCR workspace preview was attempted against the already-dirty aggregate Quest worktree, returned no reviewable-file list before interruption, and produced no valid OCR verdict. Existing Quest V2 worktree changes were already uncommitted. Targeted smoke/build proof does not certify the aggregate state.
- Overall QA state for this integration: **QA_UNVERIFIED** (runtime and protocol evidence missing). Asset copy, manifest routing and static build checks passed.

## Follow-up acceptance

Run the game from this worktree in a browser/desktop environment that can load its local server. Check audio unlock after a click, panel open/close, confirm/cancel, tab/click, successful Quest claim and mute/volume across route transitions. Verify the game sounds once per authoritative result and does not double-play click + toast success or falsely announce failed actions. Confirm native Windows `file://`/asset-base behavior before release. Then complete the repository's P18/P4/P5 protocol gates on the resulting aggregate state.
