# QA Quick Review — fix/presentation-debt (R12 retained debt cleanup)

Date: 2026-09-16. Mode: quick. Reviewer: Devin (coordinator session).

## Scope

Task-owned production paths (worktree `.agent-worktrees/presentation-debt`):

- `game/src/App.vue` — E2E deadline-scale scheduler injection
- `game/src/game/scenes/CombatScene.ts` — transitional `queueCombatAssets` net retired
- `game/src/game/support/CombatPreload.ts` — helper re-documented as parity authority
- `game/src/composables/useStageActive.ts`, `useCombatSceneActive.ts` — route-adapter-only authority, fail-loud
- `game/src/composables/useBattleActions.ts` — `ui.exitCombatScene()` call dropped
- `game/src/composables/useTribulation.ts` — `enter/exitTribulationScene` calls dropped
- `game/src/components/layout/GameRoot.vue` — tribulation visibility from route
- `game/src/stores/ui.ts` — `combatSceneDismissed`, `isTribulationSceneActive`, `exitCombatScene`, `enter/exitTribulationScene` removed; `combatOrigin` retained
- `game/playwright.config.ts` — `webServer.env.VITE_PRESENTATION_DEADLINE_SCALE=3`
- `game/src/components/game/combat/CombatExitConfirmModal.vue` — comment only

Test-owned edits (migrated to route-adapter stub or emit assertions): DongFuScene, DongFuCommandWheel, HomeBuildingIcons, CombatDefeatPanel, CombatExitConfirmModal(.focus), useStageActive.resultLifecycle, stores/ui tests.

## Risk map

`changed-risk-map.mjs`: domains = combat-and-tribulation, pinia-phaser-sync, ui-input-lifecycle; `deepAuditCandidate: true` (3 domains); unmapped: playwright.config.ts, useBattleActions.ts, useTribulation.ts, CombatPreload.ts.

**Deep escalation waived** — risk confidently bounded per transition:

1. **Net removal (CombatScene.preload).** Worst case = missing texture at scene start → placeholder/black. Evidence: live cold combat entry on the dev server with a queued-key probe reported `queued 0` and screenshot showed every sprite/backdrop texture rendered. `tests/architecture/catalogPreloadParity.test.ts` pins bundle descriptors to this helper's key set both directions; `CombatPreload.test.ts` pins dedupe. Bounded.
2. **Deadline scale.** `VITE_PRESENTATION_DEADLINE_SCALE` unset/1 → `scheduler: undefined` → `defaultDeadlineScheduler` (bit-identical production path). Scale only reachable via the playwright webServer env. Worst case if env leaks into a real deployment: deadlines ×3 — still finite, still detects stuck transitions. Bounded.
3. **ui-flag removal.** Dual authority eliminated; coordinator `activeRoute` is the single writer of screen visibility. `combatOrigin` retained for stage-origin gating (CombatResultModal/ExitConfirmModal readers verified). Fail-loud `throw` on missing adapter converts silent mis-mounts into immediate errors — all production mounts sit under App.vue's `provide`.
4. **Tribulation exit.** Route `'tribulation'`/`'home'` transitions already own overlay mount; `tribulationRouting.test.ts` (9 tests) covers drain/retry including curtain-failure reissue. The removed store calls were redundant writes.

## Invariant ledger (checked)

- Home/DongFu hidden iff route ∈ {combat, tribulation} — same truth the coordinator commits. OK.
- Battle sticky at victory/defeat: scene stays mounted until route request home — preserved (route, not battle state, drives visibility). OK.
- `combat_scene_exit` still emitted on exit (PhaserCanvas position-snapshot cleanup consumer intact). OK.
- Non-presentation fallback path in `useBattleActions`/`startTribulationPrepared` is test-only by design; production always has GAME_PRESENTATION_KEY. OK.
- `combatOrigin` can be stale-'stage' into a tribulation run — pre-existing behavior, unchanged by this diff. Noted, not a regression.
- No adapter → composables throw at setup. Deliberate fail-loud contract; all prod consumers mount under App.vue provides. OK.

## Evidence

- `npm run type-check`: clean (0 errors).
- Scoped vitest: 150 tests green across touched areas — composables (resultLifecycle 6, useTribulation artifact+dotPha 11, bootFlow 7, panelPagination 2), components (DongFuScene 6, DongFuCommandWheel 14, HomeBuildingIcons 16, CombatDefeatPanel 5, ExitConfirmModal 8), stores/ui 1, presentation (coordinator 28, combatRouting 7, tribulationRouting 9, sessionHandoff 5, createGamePresentation 11, VueRouteAdapter 3), CombatPreload 3, catalogPreloadParity 3, tribulationOutcomeWiring 2, progressionOutcomeOwnership 2.
- Live pass (main checkout, dev server, cold combat entry): `[preload-probe] queued 0` + screenshot shows all combat textures.

## Coverage gaps (not defects)

- No unit test pins the fail-loud `throw` on missing `VUE_ROUTE_ADAPTER_KEY` — trivial contract, low value.
- `VITE_PRESENTATION_DEADLINE_SCALE` wiring verified by config/code shape only; a dedicated e2e asserting scaled deadlines would require a contended environment — disproportionate.
- `--workers=4` reliability under the scale is unverified on this machine (suite runs at workers=2); the mechanism removes the wall-clock failure mode but parallel-4 throughput is untested.

## Verdict

**PASS WITH EVIDENCE** — net removal verified live, dual-authority removal verified by route-authority tests, deadline scale is a no-op outside E2E. Remaining risk confined to documented coverage gaps.
