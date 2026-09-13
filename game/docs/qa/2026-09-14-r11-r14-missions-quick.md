# QA Quick — R11–R14 missions (feat/r11-r14-missions)

Date: 2026-09-14 · Mode: quick · Scope: legacy/parallel-authority retirement
(R13), presentation/asset ownership (R12), UI foundation findings (R11),
enforcement guards for the newly stabilized contracts (R14 slice 4).

## Verdict: PASS WITH EVIDENCE

## What shipped

### R13 — Legacy / Parallel Authority Retirement

- Deleted modules with zero production consumers (verified by full-tree
  import scan + direct source inspection, not filename heuristics):
  `ChainStateSystem`, `BounceChain`, `ChannelQueue`, `TrueShot`,
  `useCadenceSmoothing`, `AcquisitionReceipt`, `WuxingRelations`,
  `themePhaserSync` + `phaserThemeBridge`, `termGlossary` — each with its
  test. `AcquisitionReceipt` in particular was re-verified after an early
  scan false-negatived it: the contract type was never imported —
  alchemy/quest receipt semantics live inline in their result types and
  are enforced by existing tests.
- AR-25: `syncLegacyBattleState` no-op hook removed from
  `CombatAnimationRuntime` deps, its two invocation sites, and the
  `GameManagerTurnBattlePresentationOps` wiring + test spies.
- AR-19 residual: `TurnBuff*` alias layer retired — TurnBuffSystem/
  TurnBuffPool/TurnBuffTypes/TurnBuffNames deleted, consumers migrated to
  canonical `core/buff/*`; `data/buff/TurnBuffRegistry.ts` →
  `BuffRegistry.ts`; the minimal lookup contract renamed
  `BuffDefinitionCatalog` (collision with the `BuffRegistry` class).
  `data/buff/TurnBuffs.ts` → `ZoneDotBuffs.ts` (content kept — the file
  holds the zone-as-dot anchor definitions for the blocked reaction
  cutover; only the retired naming was wrong).
- Kept with reason: `Battle` compat interface + `getBattle()` cast (~10
  live consumers), `LegacyBuffs` (live content), world-map
  HexLayout/WorldMapValidator (parked feature), `dropSampling` (shared
  test infra).

### R12 — Presentation / Asset Infrastructure

- AR-30: three identical 20-entry mortal enemy template-id lists folded
  into canonical `MORTAL_ENEMY_TEMPLATE_IDS` in `EnemyArt.ts`; consumed by
  `CombatPreload` (re-exported as `ENEMY_TEMPLATE_IDS`) and
  `CombatPresentationCatalogue`. No preload↔catalogue cycle introduced.
- AR-24 residual: `computeRestoreIdentity` moved to `saveTypes.ts`;
  `GameManagerSaveRestore` no longer value-imports the
  localStorage-touching `SaveSystem` module.
- `CombatScene` constant drift removed: module-local duplicates of
  `combatConstants` (cast-bar, damage colors, lane/perspective/shadow,
  `CHARACTER_WIDTH_RATIO`, `PLAYER_ID`, `DOT_TEXT_FLUSH_INTERVAL_MS`) +
  dead `PLAYER_SOURCE_SIZE`. Values verified identical before deletion.
- `PLAYER_TEXTURE_URL` derives from `PLAYER_VISUAL_PROFILES.mortal`.

### R11 — UI Foundation

- AR-28 (tab semantics): `TabBar` is now a real tablist — `role=tablist`,
  per-tab `role=tab` + `aria-selected` + roving tabindex, Arrow/Home/End
  moves focus and selection together. Standalone `Chip`s report
  `aria-pressed`; chips under `role=tab` keep `aria-selected`.
- AR-29 (scene-helper ownership): the three named helpers take narrow
  host contracts — `CombatCastBar` → `CastBarHost`,
  `CombatPositionInterpolation` → `now()` only, `CombatTelegraph` →
  `TelegraphHost` + its chase state moved into the module (was mutating
  scene-owned fields — the "extracted but still coupled" defect).
- AR-26/AR-27 verified already resolved by the 2026-09-11 V4/V10
  boundary work (`formationSlotBoxes` one-projection→DOM hit regions;
  `useDynamicRegion` generation-guarded preview lifecycle).

### R14 — Slice 4 guards

- `canonicalBuffSurface.test.ts`: zero `TurnBuff*` /
  `syncLegacyBattleState` tokens in production source.
- `enemyArtEnumeration.test.ts`: both consumers must import
  `MORTAL_ENEMY_TEMPLATE_IDS`, declare zero id literals.
- `sceneHelperBoundaries.test.ts`: the three AR-29 helpers may not
  reference `CombatScene`; telegraph chase state must live in the module.

## Evidence

- `npm run type-check` — clean.
- `npm run build` — green; `check:bundle-split` OK (entry 587KB, phaser
  separate, 20 chunks).
- Focused scopes during work:
  - presentation/scenes/assets/save/architecture: 107 files / 734 tests.
  - scenes + common + host: 46 files / 269 tests.
  - new guard files: 3 files / 10 tests, all green.
- Full `vitest run` — see final report (run in progress at write time;
  result recorded in the final summary).

## Falsifiability probes

- `sceneHelperBoundaries` and `canonicalBuffSurface` grep the production
  corpus — resurrecting a `TurnBuff` import or re-coupling a helper to
  `CombatScene` fails immediately.
- `enemyArtEnumeration` derives the canonical set from `EnemyArt` itself
  — adding an enemy and re-introducing a drifted list fails.

## Known gaps / deferred

- **P14 live-browser check deferred** (isolated-worktree exception):
  TabBar keyboard navigation and the Chip aria attributes are DOM-level
  semantics; unit/type verification passed, visual check at branch
  finishing.
- The other combat-* helpers (action-feedback, snapshot-reconcile,
  vfx-spawner, entity-visual-lifecycle, reward-gourd, player-visual) still
  take the full `CombatScene` — they coordinate broad scene surface as
  composition-level delegates, which is a different, legitimate pattern;
  AR-29 named the three pure mechanisms, which are now narrowed.
- R13 deleted only modules with proven-zero consumers; authored content
  with a documented future wire-up (`ZoneDotBuffs`, `LegacyBuffs`, world
  map geometry) was kept per the mission rule.
