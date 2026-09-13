# QA Review: mortal unarmed combat art v2

- Date: 2026-09-13
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/public/assets/characters/player/mortal/player-mortal-combat-atlas-v2.png`
  - `game/public/assets/characters/player/mortal/player-mortal-combat-atlas-v2.json`
  - `game/scripts/pack-mortal-combat-art.mjs`
  - `game/src/core/battle/CombatAnimationTypes.ts`
  - `game/src/game/scenes/CombatScene.ts`
  - `game/src/game/scenes/CombatScene.combatAnimations.test.ts`
  - `game/src/presentation/art/CombatEntityPresentation.ts`
  - `game/src/presentation/art/CombatPresentationCatalogue.ts`
  - `game/tests/architecture/animationCatalogue.test.ts`
  - `game/tests/architecture/atlasFramesExist.test.ts`

## Scope and Risk Map

The change replaces the mortal combat presentation atlas with a 107-frame,
trimmed PNG+JSON atlas and adds three body-only one-shot clips. After visual
review, the three attack clips were re-authored as deliberate held key poses
instead of latent 16-frame interpolation, preventing stretched "rubber limb"
frames. `idle` has 32 frames. `ready` and `standby` intentionally share one
11-frame guard range.
`CombatScene` selects `cast`, `sweep_hand`, or `punch` from the presentation-only
skill mapping; gameplay resolution and damage ownership are unchanged.

The risk mapper routed the change to `combat-and-tribulation` and
`pinia-phaser-sync`, with `deepAuditCandidate: true` because two presentation
domains are touched. Manual inspection bounded the risk to static asset loading,
clip registration, and EventBus-to-Phaser presentation; no save, clock,
reward, progression, or authoritative battle-state mutation changed, so quick
review remained proportionate.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-MORTAL-1 | Presentation catalogue | Resolve mortal art into animated clips | All seven animation names exist, with one shared guard range and no partial record | Missing name, duplicate range, wrong repeat | Exact catalogue keys/ranges/rates | Vitest | High: registration otherwise fails silently |
| INV-MORTAL-2 | Atlas JSON | Load the declared frame ranges | Every declared `frame_NNN.png` exists exactly once and is trimmed | Missing frame, off-by-one, identity trim | JSON frame set and trim bounds | Vitest | High: Phaser can play a short clip without throwing |
| INV-MORTAL-3 | Atlas extent metadata | Apply source-size and trim data to sprite projection | Each clip's declared extent equals its tallest trimmed frame | Wrong source size, wrong normalized extent | Measured JSON comparison | Vitest | High: sprite scale/anchor can drift visibly |
| INV-MORTAL-4 | CombatScene presentation | Receive `turn_cast_start` with a skill id | Skill id selects only a presentation animation; gameplay outcome remains event-owned | Unknown id, missing id, repeated event | Mapping test plus scene runtime path | Vitest + browser | Medium: visual mismatch only |
| INV-MORTAL-5 | Asset bundle and Phaser scene | Enter a real combat | v2 PNG and JSON return successfully and the mortal sprite is visible | Missing asset, wrong loader, runtime registration failure | HTTP 200, screenshot, zero browser errors | Playwright | High: no visual result without this handoff |
| INV-MORTAL-6 | Death presentation | Play the death range | Death clip reaches a one-knee chest-clutch pose and does not return to standby inside the art | Wrong frame order, standing final frame | Contact-sheet inspection | Visual review | Medium: localized presentation defect |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` from `game/` | Passed | `vue-tsc --build` exited 0 after the final mapping change |
| `npm run build` from `game/` | Passed | Vite production build exited 0; existing chunk-size warning only |
| Focused atlas tests | Passed | 3 files, 14 tests passed: catalogue, frame existence, measured extents |
| Focused CombatScene tests | Passed | 2 files, 23 tests passed |
| Atlas JSON inspection | Passed | 107 contiguous frames, 128x128 source boxes, 850x1265 atlas, JSON image name matches PNG |
| PixelLab frame review | Passed | Idle 32, cast 16, sweep 16, punch 16, and death 16 were inspected. Attack clips use stable static key poses repeated into intentional pixel-animation holds; no stretched limbs, weapons, or sweep effect remain. |
| Browser boot and console check | Passed with gap | A fresh guest session booted with 0 console errors; its initial progression path did not reach the combat scene again after the revised atlas was packed. |
| Full `npx vitest run` | Passed | 536 files / 3680 tests passed |

## Findings

No confirmed task-owned defects found.

## New or Changed QA Tests

- `game/tests/architecture/animationCatalogue.test.ts` locks the seven mortal
  clips, the shared guard range, impact frames, and opening-skill mapping.
- `game/tests/architecture/atlasFramesExist.test.ts` reads the v2 JSON,
  verifies exact frame names/ranges, trim data, source sizes, bounds, and atlas
  loading style.
- `game/tests/architecture/artExtentDeclared.test.ts` continues to derive the
  tallest trimmed frame and compare every declared normalized extent.
- `game/src/game/scenes/CombatScene.combatAnimations.test.ts` covers
  registration of all seven animation names.

## Gaps and Residual Risk

- The revised atlas has not been replayed through a fresh real CombatScene
  session. Contact-sheet inspection plus the deterministic catalogue, atlas,
  extent, and mapping tests cover its import contract, but not the timed
  in-canvas playback of every action.
- The atlas is packed by the project-local Canvas script in TexturePacker JSON
  Hash shape. TexturePacker CLI provenance is not claimed.
- Existing browser warnings remain; they did not involve task-owned files or
  the combat asset path.
