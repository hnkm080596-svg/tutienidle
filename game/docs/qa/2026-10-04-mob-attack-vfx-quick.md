# QA Review: mob-attack-vfx (5 new Arcadia monster attack sheets)

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/art/vfx/mob-attacks/*`, `game/scripts/export-arcadia-mob-attacks.mjs`, `game/public/assets/vfx/mob-*/`, `game/src/data/vfx/VfxSheetManifest.ts`, `game/tests/e2e/monster-attack-vfx.spec.ts`

## Scope and Risk Map

Changed systems: VfxSheetManifest bindings (5 presets -> authored atlases under `/assets/vfx/mob-*`), new effect JSON + builders + export script, e2e spec BINDINGS expectations.
One-hop consumers: `SkillPresentationRecipes.getSkillPresentationRecipe` (sheet cue injection, `sheetMs`/`impactMs`), `vfxSheetCombatDescriptors` -> `CombatPreload` + `AssetBundleCatalog` + dev `skill-vfx.ts` preload, `PhaserSkillVfxDriver.openSheet` (pin, origin, fitPx).
Exclusions: gameplay logic, runner behaviour, player-skill VFX, kept `fire_burst`/`slash` bindings untouched (idempotent no-diff).

## Invariant Ledger

| ID | Hypothesis | Check | Result | Evidence |
|----|------------|-------|--------|----------|
| I1 | Sheet cue fires exactly once per target at impact start | probe samples + manual lab | PASS | e2e probe counts; lab snapshot impacts=1..3 across replays |
| I2 | Spawned sprite plays frames [first..last], pinned at open-time hit point | e2e frame window + 160px anchor asserts | PASS | `monster-attack-vfx.spec.ts` 7 bindings green |
| I3 | Frame window covers sheetMs <= recipe durationMs (no clip tail-cut) | cross-check script | PASS | sheetMs 333-633 vs preset durations 420-700ms; all windows inside atlas counts |
| I4 | Atlas files exist at descriptor URLs and load as atlasjson | runtime | PASS (post-fix) | lab shows frames rendering; vite 404 absent |
| I5 | Grounded vs upright anchor picks feet vs body correctly | lab screenshots | PASS | earth/water/slam at feet ring; bite/claw on body |
| I6 | Authoring deterministic (seeds fixed, no Math.random/Date.now) | grep + validator | PASS | all em.seed set; validator 0 errors |
| I7 | Binding URLs resolve under new mob-* dirs without hardcoded path | code review | FAIL->FIXED | I7-F1 below |
| I8 | Art reads at 48-64px combat scale | zoom crops of e2e captures | PASS (post-iteration) | zoom-*.png evidence |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` | clean | none |
| `npx vitest run` scoped (vfx + presentation + preload) | 404 pass | none |
| `npx playwright test monster-attack-vfx.spec.ts` | 1 pass (57-70s) | full pipeline in real browser |
| `node tools/validate.mjs` x5 effect JSON | 0 errors each | Arcadia clone outside worktree (read/exec only) |
| `node scripts/export-arcadia-mob-attacks.mjs` | 5 atlases written | byte sizes listed in build log |
| Lab manual-mode screenshots @430/500/560ms | sprites on player, no drift | spriteActive:0 is expected (atlasPools only) |
| Programmatic manifest<->atlas cross-check | all windows/dims agree | script output |

## Findings

### QA-2026-10-04-01: mob-* atlas URLs 404 (binding dir hardcoded)
- Severity: High
- Status: Confirmed -> fixed before pass close
- Invariant: I4
- Preconditions: binding for a sheet not under `spritesheets/`
- Reproduction: open dev lab mob_wild_wolf -> Phaser "File failed: atlasjson" + blank VFX
- Expected: `/assets/vfx/mob-bite/bite.json` loads
- Actual: URL built as `/assets/vfx/spritesheets/mob-bite/bite.json` (404)
- Evidence: vite dev log + Phaser load error in lab console; fix = optional `dir` param on `binding()`, mob bindings pass `/assets/vfx/mob-<name>`; re-verified in lab + e2e
- Test file: `tests/e2e/monster-attack-vfx.spec.ts` (would fail on missing frames)
- Owner subsystem: VfxSheetManifest
- Blast radius: all 5 new bindings; pre-existing sheets unaffected (default dir preserved)

### QA-2026-10-04-02: export texture-presence check could mask missing texs
- Severity: Low
- Status: Confirmed -> fixed
- Invariant: I4 (build-time)
- Reproduction: `AFX.Sprites.texs.size < doc.textures.length` weak after registry accumulates across loop iterations
- Fix: per-doc `doc.textures.every(t => texs.has(t.id))`
- Owner subsystem: export script (tooling, not runtime)

## New or Changed QA Tests

- `game/tests/e2e/monster-attack-vfx.spec.ts` - BINDINGS entries updated to new keys/frame windows so frame-window + anchor assertions cover all 5 new sheets; scripted-special section switched to `vfx-sheet-mob-water`.

## Gaps and Residual Risk

- Lab `spriteActive: 0` is a counters artifact (atlasPools only) - not an error; recorded to prevent future misreads.
- e2e freeze-frame timing is nondeterministic; frame-window asserts are the deterministic oracle, screenshots are supplementary evidence.
- Arcadia source clone lives outside the worktree (per environment layout) - used read/exec only, no edits.

## Pre-existing Failures

None observed in scope.
