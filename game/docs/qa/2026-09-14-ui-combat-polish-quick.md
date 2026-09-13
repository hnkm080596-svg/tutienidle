# QA Review: UI/combat polish batch — formation preview race, death sequence, panel overflow, reroll layout

- Date: 2026-09-14
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/src/presentation/host/useDynamicRegion.ts` (+ `.test.ts`)
  - `game/src/game/scenes/combat/combat-animation-playback.ts`
  - `game/src/game/scenes/CombatScene.ts`
  - `game/src/game/scenes/CombatScene.combatAnimations.test.ts`
  - `game/src/components/onboarding/CharacterCreationScreen.vue`
  - `game/src/components/panels/QuestPanel.vue`
  - `game/src/components/panels/WorkerLodgePanel.vue`

## Scope and Risk Map

User-reported batch: formation preview intermittently shows no units; death shows generic fall/fade instead of the death clip and the corpse frame leaks into the next battle; quest + Chieu Hien Quan panels clip content; talent grid collapses during reroll.

Mapper output: `deepAuditCandidate: true` ("cross-system change: 4 domains"), `unmappedPaths` = `useDynamicRegion.*`. Not escalated because every touch is presentation-side only: no domain state, economy, save, or clock semantics change. `useDynamicRegion` manually routed to pinia-phaser-sync / ui-input-lifecycle; its only live consumers are `PhaserCanvas.vue` and `TranPhapPanel.vue` — both inspected one-hop.

Exclusions: other dirty paths in the main checkout belong to the `architecture-qa-repairs` worktree (autoFarm/tribulation repros, i18n parity) — reviewed for overlap only, not audited.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-REG-1 | `useDynamicRegion` readiness | `dispatch()` before scene `create()` | Synchronization: initial `FORMATION_ASSIGNMENTS_EVENT` reaches the scene's subscription | Reorder | Event delivered after `create`, in order | Vitest (fake Phaser lifecycle) | High — the reported "units sometimes missing" defect |
| INV-REG-2 | same | Region `onReady` timing | Lifecycle: fires only after every *booted* scene's `create()` | Timing boundary | `onReady` not called until `fireCreate()` | Vitest | High |
| INV-REG-3 | same | Dormant scene in config (PhaserCanvas: CombatScene/TribulationScene not started) | Lifecycle: PENDING scenes must not gate readiness | Value mutation (status 0) | `onReady` fires with dormant scene present; late `create` harmless | Vitest | Critical — without the `status > 0` filter `onReady` deadlocks and the main game host never publishes |
| INV-REG-4 | same | Teardown before ready/create | Lifecycle: queue dropped with generation | Interruption | No emits after destroy | Vitest | Medium |
| INV-DEATH-1 | `beginDeathSequence` (combat-animation-playback) | Entity dies with registered `-death` clip | Presentation: clip is the body visual; generic rotate/fade must not run on top | Reorder (tween vs clip) | No tween config carries `onComplete` when clip plays; destroy on ANIMATION_COMPLETE | Vitest | High — the reported visual defect |
| INV-DEATH-2 | same | Entity dies without clip (static enemies, rect fallback) | Preserve legacy fall/fade as the only death visual | Repeat | tweenConfigs[0] is body tween, destroy gated on it | Vitest (unchanged test) | Medium |
| INV-DEATH-3 | `CombatScene.onBattleStart` | New battle after player death | Synchronization: death-clip residue must not survive reset | Stale state | Last `play()` call is `-idle`; `playerDying` cleared | Vitest | High — the reported "reset shows death anim" defect |
| INV-DEATH-4 | `ANIMATION_COMPLETE` once-listener | Death clip replaced before completing | Exactly-once finalize; no double destroy | Interruption | Identity check `sprites.get(id) !== sprite` + isPlayer guard | code inspection | Low — pre-existing exposure, unchanged by this fix |
| INV-UI-1 | `CharacterCreationScreen` talent step | Reroll while cards mounted | Layout stability + input blocked during roll | Repeat | Grid stays mounted (`v-if` now requires `talents.length === 0`); `disabled` + `pointer-events:none` + `aria-busy` | DOM/jsdom not wired — P14 deferred | Medium |
| INV-UI-2 | `QuestPanel`, `WorkerLodgePanel` | Content taller than overlay | Boundedness: content scrolls instead of clipping under `overflow:hidden` body | Value mutation (long lists) | `height:100%; min-height:0; overflow-y:auto` matches VendorPanel/ProductionPanel pattern | visual only — P14 deferred | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run useDynamicRegion.test.ts` | 12/12 pass | Includes new queue-order, scene-gated onReady, and dormant-scene tests |
| `npx vitest run CombatScene.combatAnimations.test.ts` | 22/22 pass | New contract tests + reset-idle regression test |
| `npx vitest run src/game/scenes src/presentation` | 399/400 | Sole failure: pre-existing `REPRO:` tribulation-route repro owned by `architecture-qa-repairs` branch (flips green there) — not caused by this diff |
| `npx vue-tsc --build` | clean | |
| Phaser 4.2.1 source check (`dist/phaser.js`) | `sys.events.emit(Events.CREATE, scene)` runs AFTER `scene.create()` returns and `status` becomes `RUNNING`; dormant config scenes keep `status = PENDING(0)` until `scene.start()` | Confirms the `status > 0` filter and `create`-event handshake match real engine semantics |
| `presentationFor(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey)` | `kind: 'animated'` | Player has a real `-death` clip; the fall/fade tween was running on top of it |
| `rollCharacterCreationTalents()` | fixed `count = 9` | Grid row count is stable across rerolls; no residual resize after data lands |

## Findings

### QA-2026-09-14-001: scene-ready handshake deadlocked on never-started scenes (self-found, fixed before verdict)

- Severity: Critical (would block main game boot once merged)
- Status: found and fixed during implementation review — regression test added
- Invariant: INV-REG-3 (Lifecycle)
- Preconditions: any `useDynamicRegion` consumer registering dormant scenes — `PhaserCanvas.vue` registers `[AssetLoaderScene, MainScene, CombatScene, TribulationScene]`, only MainScene auto-starts.
- Reproduction: the first iteration of the fix iterated `created.scene.scenes` unconditionally; a PENDING(0) scene's `create` event never fires, so `pendingCreates` never reached 0 → `regionReady`/`onReady` never resolved.
- Actual (pre-fix): dormant scenes gate readiness → `publishHostWhenSized` never runs.
- Evidence: Phaser source `bootQueue`/`bootScene` (status stays `CONST.PENDING` until `bootScene`), plus new Vitest case.
- Test file: `src/presentation/host/useDynamicRegion.test.ts` ("a scene registered but never started (PENDING) does not block region readiness")
- Owner subsystem: `useDynamicRegion`
- Blast radius: every `PhaserCanvas` boot — contained; fixed in the same commit scope.

No `Confirmed` defect remains open.

## New or Changed QA Tests

- `useDynamicRegion.test.ts`: dispatch queues pre-create and replays in order; `onReady` waits for scene `create()`; dormant PENDING scene does not block readiness; teardown drops the queue.
- `CombatScene.combatAnimations.test.ts`: animated entity death runs no body fall/fade tween and destroys on `ANIMATION_COMPLETE` alone; `onBattleStart` replays `-idle` so the corpse frame cannot carry into a new battle.

## Gaps and Residual Risk

- **P14 deferred (worktree exception):** CSS overflow and the reroll no-reflow fix are visual; Vitest/jsdom cannot see layout. Live-browser check required at branch finishing: open quest list + Chieu Hien Quan (worker_lodge overlay) with overflowing content, reroll talents, run a combat kill + defeat → "Đánh lại" to watch the death clip and the reset.
- If a future death clip uses `repeat: -1`, `ANIMATION_COMPLETE` never fires and the sprite would linger (finalize gate). Same exposure existed when the tween was also a gate; noted, unchanged.
- `dispatch()` to a scene that starts *after* region readiness is still fire-and-forget at the game-event level — unchanged pre-existing contract, acceptable for current consumers.

## Pre-existing Failures

- `src/presentation/tribulationRouting.test.ts > REPRO: production outcome check …` — red on master by design; fixed on the `architecture-qa-repairs` branch (task 1.2 there flips it). Not caused by this diff.
