# QA Review: R6 mortal player combat atlas

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/public/assets/characters/player/mortal/player-mortal-combat-atlas-v1.png`
  - `game/public/assets/characters/player/mortal/player-mortal-combat-atlas-v1.json`
  - `game/src/presentation/art/CombatPresentationCatalogue.ts`
  - `game/tests/architecture/animationCatalogue.test.ts`
  - `game/tests/architecture/artExtentDeclared.test.ts`
  - `game/tests/architecture/atlasFramesExist.test.ts`
  - `pixellab-mcp.config.toml.example`

## Scope and Risk Map

The change adds one trimmed mortal player atlas and points the mortal profile,
the kiem-tu fallback that shares its texture key, and the generic mortal
fallback key at that atlas. The existing asset catalog queues it as an atlas;
CombatPreload calls `load.atlas`, and CombatScene generates named frames from
the clip ranges. The ordinary enemy and MainScene static paths were excluded
from production changes.

The risk mapper returned these task-owned paths as `unmappedPaths` and no
automatic domain route. Manual routing covered combat presentation, the
asset-bundle/preload consumer, CombatScene frame registration, and the
Pinia/Phaser runtime handoff. The change does not alter gameplay state,
clocking, rewards, save data, or scene lifecycle ownership, so deep audit was
not required.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-R6-1 | Combat presentation catalogue | Resolve the mortal profile into its animated presentation | All five required names exist and no retired state is introduced | Missing/extra state | Exact catalogue keys | Vitest | High: runtime registration depends on a complete record |
| INV-R6-2 | Mortal atlas metadata and JSON | Register each declared first/last range | Every requested `frame_NNN.png` exists exactly once in the atlas | Name drift, range off-by-one, reorder | Exact JSON frame key set | Vitest | High: Phaser can silently create a short animation |
| INV-R6-3 | Mortal atlas JSON | Load trimmed frames through the atlas loader | Every frame has real `sourceSize` and `spriteSourceSize`, with in-bounds trim rectangles | Identity trim, malformed rectangle, source-size drift | JSON fields and bounds | Vitest | High: scale and anchor geometry depend on this |
| INV-R6-4 | Mortal clip metadata | Resolve each clip's playback configuration | Ranges are ordered, rates are positive, loops use `-1`, one-shots use `0`, and impact frames are inside their ranges | Boundary values and wrong repeat | Authored range/rate/repeat/impact assertions | Vitest | High: cast/death timing depends on these values |
| INV-R6-5 | Asset catalog and CombatPreload | Enter combat and queue animated assets | The real mortal sheet is loaded once as an atlas and the JSON/PNG URLs resolve | Missing asset, duplicate sheet, grid-loader regression | Browser network responses and loader code | Vitest + Playwright | High: no visual output without this handoff |
| INV-R6-6 | CombatScene presentation | Start a real mortal combat encounter | The atlas-backed player sprite is visible in the Phaser canvas | Real create-to-combat flow | Browser screenshot and visible player | Playwright | Medium: confirms runtime wiring and visual scale path |
| INV-R6-7 | MainScene/static player path | Return to the home scene after combat | Static home artwork remains available and is not replaced by the combat atlas | Cross-route asset collision | Browser screenshot and 200 response for static PNG | Playwright | Low: the task is combat-only |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run type-check` from `game/` | Passed | `vue-tsc --build` exited 0 |
| `npx.cmd vitest run tests/architecture/animationCatalogue.test.ts tests/architecture/atlasFramesExist.test.ts tests/architecture/artExtentDeclared.test.ts` | Passed | 3 files, 13 tests passed |
| `npx.cmd prettier --check ...` on the four changed TypeScript files | Passed | All matched files use Prettier code style |
| Atlas JSON inspection | Passed | 65 contiguous `frame_000.png` through `frame_064.png` entries; 128x128 source frames; 1280x896 atlas; JSON image name matches PNG |
| Browser create-to-combat flow on `http://127.0.0.1:5176/` | Passed | Created a test character, entered Thanh Van / Dong 1, and observed the mortal sprite in CombatScene canvas |
| Browser request inspection | Passed | Mortal combat atlas PNG and JSON both returned HTTP 200; no browser errors were reported |
| Visual contact-sheet inspection | Passed | Idle, ready, standby, cast, and death sequences were inspected; cast impact is pose-based after removing the generated slash arcs |

## Findings

No confirmed defects found in the reviewed scope.

## New or Changed QA Tests

- `game/tests/architecture/animationCatalogue.test.ts` locks the mortal
  atlas key, five authored ranges, rates, repeat modes, and impact frames.
- `game/tests/architecture/atlasFramesExist.test.ts` reads the resolved
  mortal JSON from `public/`, verifies exact frame names/ranges, trim data,
  source sizes, bounds, and rejects grid spritesheet registration.
- `game/tests/architecture/artExtentDeclared.test.ts` derives the tallest
  trimmed frame in each clip range and compares the declared normalized extent
  against it.

## Gaps and Residual Risk

- `phap_tu` still uses the legacy placeholder catalogue because no dedicated
  Phap Tu art was requested. `kiem_tu` and `player-mortal` intentionally reuse
  the mortal atlas as specified.
- TexturePacker CLI was unavailable in the environment. The final PNG and
  Phaser 3 JSON Hash are manually packed in the same trimmed format and pass
  the runtime/JSON guards, but the report cannot prove provenance from the
  TexturePacker binary itself.
- The browser run confirmed atlas loading and a visible combat sprite, while
  the static contact sheets covered all five authored sequences. A dedicated
  browser oracle for pausing on every individual state is not present.

## Pre-existing Failures

The browser emitted many existing Vue Router and vue-i18n warnings while
running the app, including missing onboarding translation keys. The run
reported zero browser errors; these warnings were outside the task-owned
files and did not block the atlas load or combat render.
