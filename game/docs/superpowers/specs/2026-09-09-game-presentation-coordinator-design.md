# Game Presentation Coordinator & Asset Bundle Design

Date: 2026-09-09

Status: Source-audited proposal; not implemented

Audit baseline: `6cd15f3ba3769f9af62daa9dea5d467f5bdcac03`
Scope: application entry, Vue/Phaser presentation routing, runtime readiness and asset loading. No gameplay redesign.

Plan: [Implementation plan](../plans/2026-09-09-game-presentation-coordinator-plan.md).

## 1. Provenance and audit limits

Imported and revised from the user's `2026-09-09-game-presentation-coordinator-design.md` and companion plan in `C:/Users/hnkm0/Documents/Codex/2026-09-09/referenced-chatgpt-conversation-this-is-an-4/outputs/`. External originals are retained. This revision incorporates the draft plan's corrections and additional source-audit findings; the original product intent remains one presentation owner from fire-up, reliable transitions and lazy assets.

Audit performed against source, production callers, existing test definitions, roadmap R1–R6, R5 QA and relevant git history. No runtime/test execution was performed in this documentation task. Findings below distinguish inspected code from behavior that implementation must reproduce in a browser. This is a review of the systems touched by this spec, not a certification of every game subsystem.

Current maintained architecture: [roadmap](../../roadmap.md), [R5 QA](../../qa/2026-09-08-r5-runtime-presentation-quick.md). R5 is complete in the roadmap; R6 remains next. This proposal neither marks R6 done nor changes roadmap priorities. Some older roadmap paragraphs describe historical behavior; current code wins for baseline observations.

## 2. Source-audit findings and required corrections

Paths in this table are relative to `game/src/`. Locate symbols, not stale line numbers.

| ID | Evidence at baseline | Decision |
|---|---|---|
| F01 | `game/scenes/MainScene.ts:subscribeCombatEvents/onBattleStart` listens to `battle_start`; no production emitter remains. `core/game/StageWaveSystem.ts` calls into `GameManagerTurnBattleOps.startBattle/startStage`. `git show 834113f6 -- game/src/core/battle/legacy/BattleSystem.ts` shows the producer deletion. | Replace the missing lifecycle contract after complete stage setup. Browser reproduction remains required; do not call DOM combat visibility proof of active CombatScene. |
| F02 | `core/battle/turn/PresentationGate.ts` makes readiness sticky and mutates itself to ready after 15 seconds. | Per-session interactive hold; no timeout fallback to headless and no query-side mutation. |
| F03 | `CombatScene.subscribeCombatEvents/unsubscribeCombatEvents` writes `setPresentationActive`. `CombatAnimationRuntime.setPresentationActive(false)` drains pending action phases. | Coordinator requests attachment via runtime-owned token validation. Failure detach holds; it must not apply damage or silently choose actions. |
| F04 | `GameManagerTurnBattleOps.updateBattleFixedStep` emits `emitTurnBattleEntitySnapshot` inside branches that the gate blocks. | Synchronous detached snapshot query before any tick; reuse the event's canonical builder. READY cannot wait for a blocked tick. |
| F05 | `CombatScene.onBattleStart` also resets presentation on fresh refight. `restartTurnBattleCycle` retains player participants and enters fighting directly. | Migrate reset-only event consumers too. Fresh session rebind differs from continuous repeat. |
| F06 | `useCombatSceneActive` uses battle state plus `ui.combatSceneDismissed`. `GameRoot` gives combat precedence over tribulation. `DongFuScene` uses `useStageActive` for visibility. | Route visibility has one owner; terminal battle retained at Home is valid. |
| F07 | `useBattleActions.startSelectedStage` writes preferences, emits cultivation change and enters UI combat before `startStage` returns. | Reserve transition admission before domain command; rejected command cannot close panels or claim Combat. |
| F08 | `GameManagerTurnBattleOps.abandonBattle` returns a boolean. Result panels and exit modal emit navigation events separately. | Abandon before Home; false means remain. Result dismissal is separate and does not erase terminal domain state. |
| F09 | `GameManager.updateBattleFixedStep` calls `TribulationDirector.update(deltaSeconds)` separately. Director owns mind questions, chapter timers, lightning and emits start during initialization. | Hold the whole tribulation progression, including answer commands, rather than only combat ticking or lightning rendering. Snapshot initial state after setup. |
| F10 | `useTribulation.triggerBreakthroughAction` unequips before starting; `checkTribulationOutcomeAction` settles, clears and emits exit. There is no general domain cancel-tribulation command. | Admission before unequip; renderer retry never repeats start or settlement. Do not invent a failure-to-Home path that silently cancels an ongoing tribulation. |
| F11 | `useBootFlow` includes intro/auth/loading_save/character/initializing/game/error. `App` also has MainMenu; `useAppLifecycle.bootGame` owns clock/tick startup. | Preserve menu and boot subphases, restore handling and one timer owner. Coordinator is constructed at App startup, Phaser lazily. |
| F12 | `PhaserCanvas` auto-starts the first configured scene, registers bridges after game creation, and caches old positions by age. | Adapter owns initial primary activation too; initialize bridge before primary scene start; cache/readiness generation belongs to each game instance. |
| F13 | `MainScene` and `CombatScene` both call `queueCombatAssets`; Home needs some player keys too. `DongFuStackLoader` loads DOM art, outside Phaser. | Derive bundles from existing catalogs, preserve Home player assets and required DOM layers. Use independent loader; do not activate target to obtain its loader. |
| F14 | Existing E2E `create-to-combat.spec.ts` checks DOM overlay/result, not Phaser scene activation. R5 QA reports deferred P14. | Add actual Phaser state, materialization, progression, cold load/failure/retry and second-entry coverage. Historical PASS is not evidence of this migration. |

Spec verdict: original direction is appropriate, but the imported draft is not safe to execute unchanged. F02–F04 and F07–F12 are lifecycle contracts, not optional polish. This revision supersedes the contradictory statements in that draft.

## 3. Goals and non-goals

Goals: one observable route owner; one primary Phaser lifecycle adapter; assets ready before activation; READY for the exact generation; runtime held until reveal; preserved action ACK semantics; coherent cold/warm entry, refight, repeat and failure recovery; one application clock.

Non-goals: gameplay formulas, balance, skill data, rewards, save schema, content art/key changes, replacing Auth/Character with Phaser, new dependencies, generic plugin/resource framework, aggressive unload, unrelated cleanup. Do not merge pending R6 art work as part of this migration.

Three options were assessed: restoring only `battle_start` is a short-term wiring fix but leaves split ownership; a generic scene/router framework costs more and obscures the small fixed route set; the selected application coordinator plus narrow runtime/renderer ports repairs the actual chain. No temporary hotfix is required by this task.

## 4. Authority and module boundaries

| Responsibility | Target owner | Must not own |
|---|---|---|
| Domain session ID, held/running state | Headless `core/presentation/PresentationSession.ts` composed by domain runtimes | Route, Vue refs, Phaser |
| Combat pending phases, tokens, damage sequencing | `CombatAnimationRuntime` and existing TurnBattle owners | Scene activation |
| Tribulation outcomes/timers | `TribulationDirector`; existing settlement caller retained | Curtain or route |
| Route and transition generation | `presentation/GamePresentationCoordinator.ts` | Gameplay formulas, reward application |
| Command admission and domain-to-route mapping | `presentation/createGamePresentation.ts` | Direct domain state mutation |
| Primary scene start/stop and READY registry | `presentation/PhaserSceneAdapter.ts` | Domain outcomes |
| Vue preparation, mounted readiness | `presentation/VueRouteAdapter.ts` | Second writable route |
| Bundle catalog and load state | `presentation/assets/*` with independent `AssetLoaderScene` | Battle outcome or asset eviction policy |
| Clock, tick/autosave, save initialization | Existing `useAppLifecycle` and save owners | Scene selection |

Core never imports `src/presentation`, Vue or Phaser. Runtime contracts live below their consumers. No new Pinia route authority: expose detached coordinator snapshots through a Vue adapter. `PhaserCanvas` owns game construction/destruction, publishes game readiness and registers adapters; App owns coordinator lifetime. Preview `TranPhapCombatPreviewScene` and nonvisual loader are explicitly outside the exclusive primary-scene invariant, but have documented lifecycle owners.

## 5. Identity and runtime readiness

Three identities have different purposes:

1. Runtime `sessionId`, monotonic within its GameManager lifetime. Fresh successful stage/tribulation starts allocate a new ID; rejected starts allocate none. Use a shared allocator within GameManager to avoid combat/tribulation collisions. Session IDs are ephemeral, not saved.
2. Runtime hold `generation`, incremented on acquiring a new renderer binding/retry. Old attach/release/detach calls are rejected even for the same domain session.
3. Coordinator `transitionId`, monotonic for presentation attempts. Include adapter/game lifetime checks on callbacks. Action playback tokens remain their existing independent identity.

Interactive sessions start held before they can tick. Headless instances remain independently runnable; App selects interactive mode before any start. `attach` marks renderer availability but does not release ticking or accept outcome-advancing ACKs. `release` after reveal enables pacing. Queries never mutate readiness or settle anything.

Held runtime drops presentation-wait time rather than accumulating catch-up for release. Hold only the relevant combat/tribulation driver, not all `GameManager.update`, cultivation, production or autosave. Gate all three action ACK entry points and manual submit paths as well as tick paths. No delayed callback may bypass a held session merely because its old playback token still matches.

Failure detaches with hold semantics and invalidates old callback acceptance. Preserve pending phase, chosen action and already-applied impact. Retry must supply a detached resume description with a fresh playback token and replay only the missing presentation phase after reveal: ready → ready animation; declared → cast then impact ACK; impacted → completion visuals/ACK only; awaited manual → same choice UI. Never repeat `declareActorAction` or `applyActionImpact` to reconstruct visuals. Token renewal and resume payload are runtime commands/queries, not scene-side private mutation. A lost renderer during an action cannot be declared recoverable until this is tested.

Explicit headless detachment retains the existing domain-owned drain policy for intentional headless use; presentation failure never invokes it. Ending/abandoning a combat session invalidates pending ACKs through the owner without applying extra impact.

## 6. Route and admission contract

Routes: `boot | auth | character | home | combat | tribulation | error`.

One snapshot includes `currentRoute` (committed), `renderRoute` (being mounted behind curtain), active session reference, transition phase/ID and boot subphase. Boot subphase preserves `intro | loading_save | initializing`; menu visibility is presentation state owned by this same coordinator. Runtime initialization success is a separate fact, not a second route authority.

Allowed normal edges:

| From | Allowed target and guard |
|---|---|
| boot | auth; character after empty save; home after initialization; error |
| auth | boot for loading_save/initializing; character after load; home after initialization; error |
| character | auth on Back; boot initializing; home after creation/initialization; error |
| home | combat with matching successful stage session; tribulation with matching session and no ongoing stage; auth only through existing session teardown; error |
| combat | home after accepted abandon or terminal dismissal; combat for a new stage session rebind; error |
| tribulation | home after settlement/clear; error |
| error | retry failed target for same still-valid session, or return through verified boot/auth recovery; home only if domain permits |

Duplicate request with the same route AND session while in flight shares one outcome. Same committed route/session is unchanged only when idle and healthy. Conflicting request is rejected before domain effects. New session at Combat rebinds once without destroying the game. Continuous repeat retains the same presentation session and attachment, resets action generation via the existing runtime path and does not restart countdown/curtain.

Application entry methods synchronously acquire admission before invoking `startStage` or the breakthrough action, then pass the returned authoritative session into the coordinator. Domain start events are wake-ups, not unique required delivery: after registration, query the current session; subscription plus replay is deduplicated. Publish stage notification only after wave setup, reward/survival setup and pending-state reset are finished. UI writes implying successful entry occur only after successful domain acceptance. No routing lock may reject an already-started valid session and silently leave it running unseen.

## 7. Transition sequence and recovery

Sequence: validate/admit → hold session → close curtain → ensure Phaser host/independent loader where needed → load required assets → deactivate prior primary → set renderRoute/mount target → reconcile snapshot and wait READY → commit currentRoute/attach → open curtain → release runtime → unlock.

READY is registered before activation and requires the same transition/session/game generation. Phaser scene is created, subscribed, laid out at a nonzero measured size, and reconciled with initial state; required Vue chrome/DOM images are mounted. Composite route READY waits for both. `isActive` alone is insufficient. Scene does not set presentationActive. Initial queries work while the runtime is held.

Bounded phases: close/open 2 seconds each; host/assets 30 seconds; activation/composite READY 10 seconds. Timer injection makes tests deterministic. Every await checks cancellation/generation. Timeout aborts scoped listeners and exposes a visible actionable failure; it never releases gameplay. Set failed phase and render an error cover even if the curtain animation itself failed.

Failure before deactivation retains prior renderer. After deactivation, cover the partially active target and stop it via adapter. Record actual renderer availability, not just currentRoute. Retry uses a fresh transition generation for the same valid domain session and reloads missing assets. Ongoing tribulation offers retry or existing application restart behavior; no invented cancel/penalty-free Home path. Combat return-home recovery calls accepted abandon first. Do not automatically retry forever. Dispose aborts, unsubscribes and leaves no late mount/commit.

## 8. Assets

Bundles: core-ui (common required UI), home (Phaser player combat/cultivate keys plus required DongFu DOM layers), combat (current ThanhVan backdrop, player/enemy images and animation sheets, gourd, required VFX/UI), tribulation (cultivate/scene UI assets). Catalog derives from existing `CombatPreload`, `PlayerVisualProfiles`, `EnemyArt`, `CombatAnimationSet`, `ThanhVanArt`, `InkWashUiPhaser`, `DongFuArt`; no duplicated hand-maintained lists.

Curtain loading/error shell uses existing CSS/tokens and text so it works before assets/Phaser. Persistent nonvisual loader is ready independently of the target. Adapter starts primary scenes only after ensure; prevent default first-primary autostart in config.

Manager deduplicates by resource identity/type/key with URL/config collision detection. Serialize physical loader batches; resolve each subscriber for its own required resources. COMPLETE is not proof of success: observe file failures and verify texture/cache including atlas subfiles. Empty and cached requests resolve. Preserve successful entries after partial failure; retry missing/failed entries. Cancellation of one waiter does not cancel another waiter's shared load. Destroying a Phaser.Game invalidates its cache and pending subscribers. DOM image completion includes decode where supported; required failure rejects, optional fallback must be catalog-declared.

Home must retain player textures after eager combat preload is removed. Prefetch Combat on stage-selection opening; failure remains diagnosable and later ensure retries. Existing backdrop variant selection/no-mid-battle swap stays scene-local, while physical loading uses the manager. Never consume/randomize a new variant merely to enumerate assets. Keep cached resources for the game lifetime; no texture eviction on exit.

## 9. UI and lifecycle preservation

Keep Auth, CharacterCreation, MainMenu, save-incompatible/error presentation and the stable game host. Moving boot route state does not re-run restore, reset saves, create another clock or start another autosave loop. Late boot completion after disposal must not initialize/mount a session.

Separate navigation curtain from combat intro phase; retain existing intro duration/title and countdown behavior without a second gameplay timer. Curtain owns close/open completion and cancellation, blocks pointer plus keyboard/hotkeys, respects reduced motion, restores focus to a valid destination, and exposes loading/error text via existing primitives and local i18n. Error controls remain reachable while gameplay is inert. Fit actual container; do not depend on a fixed screen size.

`useCombatSceneActive` becomes a read-only route-derived facade if useful to consumers. Remove route flags only after all callers migrate; stage selection/run mode remain preferences. Home/DongFu visibility must not read stale battle state. Tribulation settlement, Quán Khí panel and announcements remain with their current application/domain owners and are not triggered by image arrival, READY or scene mounting.

## 10. Acceptance and execution boundaries

- Steady interactive combat before dismissal: Combat primary active, Main inactive, matching session attached, runtime released. During loading/failure the same session is held with visible cover.
- Terminal combat may remain after dismissal at Home; no invariant requires all non-idle battle objects to render Combat forever.
- Cold and warm entry, fresh refight, continuous repeat, rejected starts, accepted/rejected abandon, pending-action recovery and tri-state tribulation outcomes retain intent.
- Loading delay does not consume countdown, mind-question time, lightning or battle progression; after release normal clocks resume.
- No primary lifecycle calls outside adapter (including initial activation, restart/run/launch/switch); preview/loader infrastructure exceptions explicit.
- No independent writable route flag or legacy navigation producer/consumer remains. Keep gameplay events and canonical rendering helpers.
- Full P3, meaningful P13 E2E, P14 visual flow, simplification, code review and deep adversarial QA required for implementation. Deep QA is appropriate because timing and lifecycle both change. QA pass cannot modify production.
- Any isolated-worktree P14 deferral is `DONE_WITH_CONCERNS`, not verified runtime completion; do browser work from an authorized preview checkout before full acceptance.

Documentation-only audit is complete when both documents agree, source references resolve and the plan covers every finding. That does not authorize production implementation, commit, merge or deployment.
