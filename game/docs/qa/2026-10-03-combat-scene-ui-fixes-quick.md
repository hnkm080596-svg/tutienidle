# QA Review: combat-scene UI fixes (Huyền Kim audit findings)

- Date: 2026-10-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: game/src/components/scenes/combat/CombatActionDock.vue, game/src/components/game/combat/CombatSkillDockPanel.vue, game/src/components/scenes/combat/CombatAiRail.vue, game/src/game/scenes/CombatScene.ts, game/src/game/scenes/combat/PlayerHudLayer.ts, game/src/game/scenes/combat/combat-snapshot-reconcile.ts, game/src/game/scenes/combat/combat-vfx-spawner.ts, game/src/core/battle/turn/TurnActionPresentationEvents.ts, game/src/components/scenes/victory/VictoryScene.vue, game/src/components/game/combat/CombatDefeatPanel.vue, game/src/components/scenes/dong-fu/DongFuStage.vue, game/tests/e2e/combat-overlay-layout.spec.ts + touched *.test.ts

## Scope and Risk Map

Mapper: domains combat-and-tribulation + pinia-phaser-sync + ui-input-lifecycle; `deepAuditCandidate: true` (3 domains). Escalation decision: NOT escalated — the three domains meet only at the presentation seam (snapshot → HUD read; DOM overlays): no save/clock/economy/progression transaction, no lifecycle authority change. Risk bounded by runtime evidence at 1440×810 plus 884 scoped unit tests. Exclusions: none — every task-owned path reviewed (17/17 OCR coverage).

## Invariant Ledger

| Invariant | Hypothesis attacked | Check | Result |
| --- | --- | --- | --- |
| Battlefield flex box stays >0 height while skill dock mounted | `display:contents` wrapper removes the flex child that starved `.combat-scene-overlay__battlefield` | runtime rect dump | battlefield y=46 h=764 (was h=0) |
| ai-panel reachable in-viewport during fighting | rail lands inside 810p viewport after fix | runtime rect + screenshot | aiPanel x=14 y=121 w=196 h=241; all 5 strategy radios visible |
| ai-panel content paints above InkNineSlice surface | `layer="surface"` fill at z1 vs static content — convention `> :not(.ink-nine-slice){z-index:2}` | runtime + convention doc | strategy list readable |
| HUD (HP/MP/Kiếm/Thế) visible at battle start before first damage | `setVisible(inBattle)` ran while `inBattle=false` on late create(); snapshot HP/MP fast-path seeds before first `entity_vitals_changed` | runtime + Phaser object poke | hpVisible=true, hpFill x=13.78 (=1440·16/1672), y=80.98 (=810·72/941+row), label "108 / 108" at full HP |
| HUD anchor = spec 13 canvas-left top (16/72 of 1672×941) | ratios over vw viewport | unit test + runtime | hpFill assertions PASS |
| Stale post-battle snapshot cannot re-show a hidden HUD | `update*` writes object visibility directly; terminal-phase feed would defeat `onBattleEnd`'s hide | source proof + phase gate `phase !== 'victory' && !== 'defeat'` | guarded; 884 tests green |
| Result envelope = spec 45.45% both panels at all viewports | fixed 582px only correct at 1280w | runtime | victory w=654, defeat w=654.47 @1440 = 45.45% |
| Home floating chrome hidden while overlay surface owns screen | df-board/quest/notice bleed onto exploration paper | runtime rect | `.df-board` rect 0×0 under stage_select; present at home |
| Snapshot payload extension breaks no consumer | `currentMp`/`maxMp` added to `TurnBattleEntityVisualState` | type-check + 884 vitest | clean |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | clean, exit 0 | |
| `npx vitest run` scoped (combat scene dir + CombatScene* + core/battle/turn + dong-fu + scenes/combat) | 108 files / 884 tests PASS | |
| Playwright headless runtime capture pass @1440×810, fonts.googleapis stubbed | full pass: fighting rects, HUD poke, victory + defeat envelope, df-board hide | screenshots in /tmp/combat-fix-audit-v7/ |
| OCR delegate preview (workspace) | 17 reviewable, 17 reviewed, 0 skipped — coverage 100% | Delegation Mode; rules resolved from .opencodereview/rule.json |

## Findings

### QA-2026-10-03-1: ai-panel content painted under InkNineSlice surface fill
- Severity: Medium
- Status: Confirmed (runtime evidence) — repaired during implementation
- Invariant: DOM rail contents render above their decorative layer="surface" fill
- Reproduction: after fix 1 the rail frame was visible at y=121 but strategy text invisible — surface nine-slice (z1, absolute inset) painted over static siblings
- Expected: all 5 targeting strategies readable/clickable
- Actual: frame only; fixed via documented convention `.combat-ai-rail > :not(.ink-nine-slice){position:relative;z-index:2}` — matches TribulationStatusCard pattern
- Evidence: /tmp/combat-fix-audit-v7/combat-fighting.png (strategy list visible)
- Test file: none (CSS-layer convention; runtime evidence)
- Owner subsystem: ui-input-lifecycle
- Blast radius: ai-panel only

### QA-2026-10-03-2: HUD seed could re-show a layer hidden by onBattleEnd
- Severity: Medium
- Status: Confirmed by SOURCE_PROOF — repaired before QA
- Invariant: `playerHud.update*` writes Phaser object visibility directly, bypassing the layer's hidden state; a late snapshot after `onBattleEnd` would re-show the HP bar
- Reproduction: in-band — `emitTurnBattleEntitySnapshot` can emit a terminal-phase snapshot; ungated feed re-shows
- Fix: feed only for live phases (`intro|countdown|fighting`) — `phase !== 'victory' && !== 'defeat'`
- Test file: none added (gate is a two-line predicate; covered by existing reconcile tests)
- Owner subsystem: combat-and-tribulation / pinia-phaser-sync seam
- Blast radius: CombatScene HUD only

### QA-2026-10-03-3: combat-overlay-layout e2e guard retained bottom-left HUD zone
- Severity: Low
- Status: Confirmed — repaired (spec migrated to top-left)
- Invariant: guard must assert the spec'd HUD zone, not the retired bottom-left one
- Evidence: tests/e2e/combat-overlay-layout.spec.ts canvasHudZone updated to top-left ratios
- Blast radius: test only

## New or Changed QA Tests

- `PlayerHudLayer.test.ts` — layout spec rewritten to spec-13 top-left ratio assertions (proves proportional anchor, resize follows viewport)
- `combat-entity-reconciliation.test.ts`, `CombatScene.turnCountdownSpawn.test.ts`, `TurnActionPresentationEvents.test.ts` — snapshot literals extended with `currentMp/maxMp` (shape contract)
- `tests/e2e/combat-overlay-layout.spec.ts` — HUD zone guard moved to top-left band per spec 13
- Runtime capture pass (throwaway localhost probe, not committed) — reproduced the full flow (guest boot → fighting rects → HUD poke → victory → natural defeat via hp=1 + `combatInputMode='auto'`)

## Gaps and Residual Risk

- Defeat-panel mount requires `combatInputMode='auto'` + real killing blows (engine evaluates defeat inside `resolveActorTurn`, not on direct entity kills) — the capture drives that path; direct-kill shortcuts flip state without the battle pipeline (documented in the script).
- e2e Playwright specs (combat-overlay-layout, turn-combat-hud) not executed in this pass — dev-server captures exercised the same surfaces at 1440×810.
- Pre-existing latent issue (out of scope, recorded): `PlayerHudLayer.update*` bypasses layer-hidden state for `entity_vitals_changed` too — a post-battle_end vitals event could re-show HP. No live emitter observed post-terminal; flagged for the HUD owner.

## Pre-existing Failures

None observed in scope.
