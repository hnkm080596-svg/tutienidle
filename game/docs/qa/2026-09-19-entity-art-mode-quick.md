# QA Report — Entity Art Mode Switch (quick)

Date: 2026-09-19
Scope: branch `entity-art-mode` diff vs `master` — global `ENTITY_ART_MODE` compile-time
switch, uniform static/animated entity contract, shared placeholder policy, shared
lunge attack presentation, mode-aware scene + Vue surfaces.

## Task-owned paths reviewed

Production: `EntityArtMode.ts`, `CombatPresentationCatalogue.ts`,
`CombatEntityPresentation.ts`, `CombatAnimationTypes.ts`, `CombatAnimationRuntime.ts`,
`combat-animation-playback.ts`, `combat-grid-view.ts`, `combat-action-feedback.ts`,
`combat-player-visual.ts`, `CombatGridViewHost.ts`, `CombatScene.ts`, `MainScene.ts`,
`TranPhapCombatPreviewScene.ts`, `TribulationScene.ts`, `CombatPreload.ts`,
`TribulationPreload.ts` (new), `AssetBundleCatalog.ts`, `CombatArtTier.ts` (deleted),
`EntitySpriteCanvas.vue` (new), `PlayerPortrait.vue`, two asset scripts, placeholder PNG.

## Mapper result and escalation decision

`changed-risk-map.mjs`: domains = combat-and-tribulation, pinia-phaser-sync,
ui-input-lifecycle; `deepAuditCandidate: true` (cross-system breadth);
10 `unmappedPaths` — all presentation/catalogue/data-layer files inspected manually.

**Not escalated** — risk is confidently bounded: (a) zero domain-state mutation —
every change is presentation, asset loading, or test code; the battle engine,
persistence, economy, and clock paths are untouched (`src/core/battle` diff is a
type union plus a test-only accessor remap); (b) compile-time constant means each
shipped build exercises exactly one branch — no runtime mode race exists;
(c) runtime evidence was collected on the real build (below). Mandatory
escalation triggers (save/cloud, offline accrual, economy-persistence crossing,
unbounded lifecycle risk) are absent.

## Invariant ledger

| ID | State/owner | Invariant | Oracle | Result |
|---|---|---|---|---|
| INV-ART-1 | `CATALOGUE` emitted kinds | Synchronization: every entry kind == `ENTITY_ART_MODE` | `artModeUniformity.test.ts` | PASS |
| INV-ART-2 | `sprite.idle` bob tween | Lifecycle: killed on `destroyEntitySprite` | existing grid-view test | PASS |
| INV-ART-3 | unregistered entity id | Recoverability: same-kind placeholder, Rectangle only on double-fallback | grid-view tests + code | PASS |
| INV-ART-4 | Game-wide `anims` manager | Idempotency: re-registration guarded | `registerClipCatalogue` `exists()` guard | PASS |
| INV-ART-5 | `EntitySpriteCanvas` rAF | Lifecycle: cancelled on unmount; fetch-after-unmount guarded by `disposed` | code | PASS |
| INV-ART-6 | preload vs emitted catalogue | Boundedness: static mode queues no atlas, animated queues all incl. placeholder sheet | `queueCombatAssets` + `animatedCombatEntities()` read emitted `CATALOGUE`; bundle tests | PASS |
| INV-ART-7 | attack presentation | No removed clip names reachable | grep: `cast`/`punch`/`sweep_hand`/`ready` call sites absent | PASS |
| INV-ART-8 | `getAnimationState` remap | No production consumer of old names | grep: only test files reference it | PASS |
| INV-ART-9 | transition chaining | `repeat: 0` required or `ANIMATION_COMPLETE` never fires | new uniformity assertion pins it | PASS |

## Runtime evidence (P14, Edge via playwright-cli, worktree dev server :5621)

- Combat (Thanh Van - Dong 1): player + enemies render static PNGs, HP bars,
  turn chips; battle progressed round 1→7, player HP 108→80, one Son Khau
  killed and sprite removed; battle ended on defeat overlay with reward list.
- Tran Phap preview panel: perspective grid + formation list render, player
  PNG thumbnail renders.
- Character panel: `PlayerPortrait` `<img>` inside disc + taiji ring renders.
- Home/MainScene: cultivate sitting PNG renders.
- Console: 0 errors across all surfaces (2 pre-existing AudioContext warnings).

## Findings

- **Suspected → rejected**: `TranPhapCombatPreviewScene` player-texture sync
  could destroy/recreate every sync if the profile PNG is missing (expected
  key = profile key, drawn key = `player-mortal` fallback). Rejected as
  out-of-scope pre-existing: the old code compared against
  `combatTextureKey` identically; profile PNGs ship with the game.
- **Nit**: `TranPhapCombatPreviewScene.startEntityIdle` duplicates the
  entity-key resolution from `CombatAnimationPlayback` (~8 lines,
  documented in-code).
- **Coverage gap**: `EntitySpriteCanvas` and the `animated` branches of
  MainScene/TribulationScene have no runtime coverage while the shipped mode
  is `static`; they are exercised only by unit-level guards. Acceptable —
  the mode is a compile-time dev switch, and flipping it is a deliberate act
  that ships with its own verification pass.

## Verdict

**PASS WITH EVIDENCE** — full Vitest green (667 files / 5620 tests),
type-check + build green, uniformity/architecture guards green, direct
runtime evidence on all changed surfaces, zero console errors.
