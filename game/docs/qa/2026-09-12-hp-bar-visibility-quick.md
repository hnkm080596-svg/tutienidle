# QA quick — HP bar floating while combatant hidden (2026-09-12)

Branch: `fix/hp-bar-visibility` (worktree `.agent-worktrees/hp-bar-visibility`).
Trigger: user report after merging pc-tag-system — "kẹt các thanh HP": thanh HP quái
lơ lửng trên sân trong intro / đếm ngược 3-2-1 dù quái chưa xuất hiện.

## Root cause

Sprite visibility was toggled through `sprite.rect.setVisible(...)` at 6 scattered
call sites (`CombatScene.ts` x4, `combat-vfx-spawner.ts` x2). `rect` is only the body;
`label`, `shadow`, `healthBar.background`, `healthBar.fill` are independent Phaser
GameObjects at `DEPTH_OVERLAY_UI + 2` and were never hidden. Latent since the
telegraph hide-then-reveal path existed (player had no health bar, so nothing showed);
exposed by c942a278 (2026-09-12) which started hiding enemies/companions — which do
have health bars — during intro/countdown.

Violated invariant: A2/A3 — whole-combatant visibility had no single owner, and the
*decision* state was itself ad-hoc: `turnCountdownPendingIds`, `materializingIds`,
`playerMaterialized` were read/written from ~30 sites in `CombatScene.ts` +
`combat-vfx-spawner.ts`.

## Fix

The roadmap "CombatScene rule" already names **Entity Visual Lifecycle** as the
mechanism to extract when evidence supports it — this defect is that evidence.

- `combat/combat-entity-visual-lifecycle.ts` — `CombatEntityVisualLifecycle` is the
  ONE owner of per-combatant visibility state: `pending → materializing → visible`
  plus the legacy real-time `playerMaterialized` flag. Narrow API:
  `markPending` / `applyGating` / `revealPending` / `markMaterializing` /
  `consumeMaterializing` / `hidePlayer` / `materializePlayer` / `markPlayerMaterialized` /
  `clear`. Read-only views for tests/reconcilers.
- `CombatGridView.setSpriteVisible(sprite, visible)` — the one *applier* (grid view
  owns create/position/destroy of every sprite part): rect + label + shadow +
  healthBar bg/fill toggle together.
- The three ad-hoc fields are retired; all call sites route through `entityVisual`.
- Architecture guard `tests/architecture/entityVisualLifecycle.test.ts` (comment-blind
  scan, red-drilled): no sprite-part `.setVisible(` outside combat-grid-view, no
  `setSpriteVisible(` outside the two owners, retired names stay gone.
  `PlayerHudLayer` exempted — screen-space HUD chrome, not entity-sprite parts.

## Hypotheses checked

| # | Hypothesis | Evidence | Verdict |
|---|---|---|---|
| a | Hidden combatant still shows HP bar / label / shadow | `combat-grid-view.spriteVisibility.test.ts` — all five parts toggle together; `combat-entity-visual-lifecycle.test.ts` — pending → applyGating hides, revealPending shows | fixed |
| a2 | Visibility decision re-scatters (owner bypass) | `tests/architecture/entityVisualLifecycle.test.ts` — red-drilled: direct `rect.setVisible` in CombatScene fails the guard | guarded |
| b | Flush at countdown end reveals HP bar together with body | `CombatScene.turnCountdownSpawn.test.ts` flush case asserts companion `healthBar` bg/fill visible | fixed |
| c | Player-shaped sprite (no shadow / healthBar) throws | spriteVisibility test, optional-chained parts | pass |
| d | Wave enemies (pendingEnemySpawns) wrongly hidden | They never enter `turnCountdownPendingIds`; 'create' branch computes `!pending` = true, same as before | pass (unchanged) |
| e | Enemy death leaves HP bar | `destroyEntitySprite` already destroys bg/fill — untouched | pass (unchanged) |
| f | Regression in scene suite | `npx vitest run src/game/scenes` — 32 files / 191 tests green; type-check 0 | pass |

## Gaps (reported, out of scope)

- Status-icon rows (`scene.statuses`, icon + stackLabel) and cast bars are per-entity
  GameObjects NOT covered by `setSpriteVisible`. They only exist during 'fighting'
  after reveal, so no floating case is known; if a status is ever attached during the
  hidden window it would float the same way. Candidate follow-up: route them through
  the same owner.
- P14 live-browser check deferred (isolated worktree); run from the main checkout after
  integration: start Động 1, watch intro + 3-2-1 — no HP bar / name label / shadow may
  appear before the body materializes.

Verdict: **PASS WITH GAPS** (gaps are follow-ups, not blockers).
