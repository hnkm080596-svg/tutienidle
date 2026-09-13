# Game Presentation Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` when Agent/Task dispatch is available, otherwise `executing-plans`. Execute tasks in dependency order and track the checkboxes. Read the spec before editing. This document does not authorize implementation, commit, merge or deployment by itself.

**Goal:** Một owner điều phối presentation từ fire-up đến Auth, tạo nhân vật, Động Phủ, Combat và Độ Kiếp; asset loading và READY không làm gameplay chạy trước hình ảnh.

**Architecture:** Coordinator sở hữu route/transition; adapter sở hữu primary scene lifecycle; runtime sở hữu session/hold/action token. Vue nhận snapshot chỉ đọc. Giữ domain, clock, save và settlement ở owner hiện có.

**Tech Stack:** TypeScript, Vue Composition API, Pinia, Phaser, Vitest, Playwright; không thêm dependency.

**Spec:** [Audited design](../specs/2026-09-09-game-presentation-coordinator-design.md).

**Baseline:** `6cd15f3ba3769f9af62daa9dea5d467f5bdcac03`, audit 2026-09-09. Đây là plan thay thế bản nhập từ thư mục `outputs` của user, đã đưa các hiệu chỉnh vào spec. Chưa thực thi test hay production implementation.

## 0. Quy tắc thực thi

- Mọi path dưới đây tương đối với `game/` của worktree, trừ path có ghi repo root. Không chạy trong checkout khác vì tiện.
- User hiện yêu cầu tài liệu. Chỉ bắt đầu task implementation sau yêu cầu thực thi; không xem checkbox là quyền commit.
- Khi được thực thi: đọc root `AGENTS.md`, `AstraDoctrine.md`, roadmap R1–R6 và QA R5; dùng `using-git-worktrees`, tạo `.agent-worktrees/game-presentation-coordinator`, branch mặc định `codex/game-presentation-coordinator` nếu chưa tồn tại. Kiểm tra branch/path thực tế; không ghi đè worktree có sẵn.
- Không sửa gameplay/reward/save schema/asset keys/dependencies; không làm luôn R6 art hay refactor toàn bộ GameManager. Các public API runtime mới dưới đây nằm trong scope của migration này.
- Core không import Vue/Phaser/`src/presentation`. Không dùng `any`; không cast test fixture để che thiếu contract. Comment source dùng English ASCII; UI tiếng Việt qua local i18n.
- Đọc skill Vue/Phaser/UI khi sửa các file tương ứng. TDD cho regression; E3 simplify trước verify/review. Thay đổi này là major architecture và scene infrastructure nên final verification là **full**, không quick.
- Red test có chủ đích là bước TDD, không phải gate PASS. Khi chạy verification gate, dừng ở lỗi đầu tiên, phân loại và sửa task-caused failure trước khi tiếp tục.
- Plan chọn start/stop, không sleep/wake trong lần migration đầu vì cleanup hiện dựa vào shutdown.
- Sau mỗi task ghi ledger: files, current/target owner, consumers migrated, commands/results, retained debt. Không ghi PASS cho lệnh chưa chạy.
- Các đoạn code dưới đây là chữ ký đích và test/kernel logic cụ thể. Tên mới được đánh dấu Create; không giả định chúng đã có trong repo. Dùng symbol để tìm vị trí vì số dòng sẽ đổi.

## 1. Những quyết định đã khóa để agent không tự thiết kế lại

1. Ba identity: runtime session ID, runtime hold generation, coordinator transition ID. Action playback token vẫn độc lập.
2. READY không bật runtime. Attach sau READY; release sau curtain open. Hold chặn cả tick, ACK và manual choice.
3. Failure không gọi `setPresentationActive(false)` theo đường drain cũ. Retry cùng session; không `startStage`/unequip/settle lần nữa.
4. Query snapshot không tick, emit, grant hay mutate. Tách builder từ `emitTurnBattleEntitySnapshot` và giữ emitter dùng cùng builder.
5. Primary adapter bao gồm initial start; `PhaserCanvas` không tự kích Main do đứng đầu config.
6. Home gồm DOM art; READY đợi cả Vue và Phaser. Render target trước khi đợi READY; currentRoute chỉ commit sau đó.
7. Start command được admission đồng bộ trước side effects. UI không tự set combat trước khi domain trả true.
8. Repeat cycle giữ party và fighting; fresh startStage tạo session mới, rebind cùng CombatScene. Không trộn hai trường hợp.
9. Độ Kiếp hold cả câu hỏi/timer/answer/lightning. Không có cancel-tribulation API tại baseline; error chỉ retry session hoặc đi qua restart flow hiện có.
10. MainMenu và loading_save/initializing được giữ; lifecycle.bootGame vẫn khởi động tick/autosave. Không tạo timer trong coordinator.
11. Timeout không chuyển interactive thành headless. Chỉ đường headless chủ ý mới giữ drain contract cũ.
12. Recovery pending action phải replay đúng pha với token mới; đã impact thì không áp damage lần hai.

## 2. Bản đồ file và consumer

| File | Vai trò / hành động |
|---|---|
| Create `src/core/presentation/PresentationSession.ts` + `.test.ts` | Session/hold primitive; không route |
| Modify `src/core/battle/turn/CombatAnimationRuntime.ts` | Gate ACK/choice, detach/resume pending playback |
| Modify `src/core/battle/turn/PresentationGate.ts` + test | Migrate/retire sticky timeout sau khi consumer chuyển hết |
| Modify `src/core/battle/turn/TurnActionPresentationEvents.ts` + test | Pure snapshot builder dùng chung emitter/query |
| Modify `src/core/game/GameManagerTurnBattleOps.ts`, `GameManager.ts` | Session lifecycle, facade, notification sau setup |
| Create `src/presentation/PresentationContracts.ts` | Route/request/result/ports |
| Create `src/presentation/GamePresentationCoordinator.ts` + test | Admission/state machine/deadlines |
| Create `src/presentation/createGamePresentation.ts` + test | Runtime/Vue/Phaser composition and command facade |
| Create `src/presentation/PhaserSceneAdapter.ts` + test | Primary start/stop, game generation, READY |
| Create `src/presentation/VueRouteAdapter.ts` + test | Reactive bridge, composite mounted readiness |
| Create `src/presentation/assets/AssetBundleCatalog.ts`, `AssetBundleManager.ts` + tests | Resource enumeration, queue/dedupe/cache |
| Create `src/game/scenes/AssetLoaderScene.ts` | Loader không render, sống theo Phaser.Game |
| Create `src/components/game/PresentationTransitionOverlay.vue` + test | Curtain, input lock, error shell |
| Modify `src/components/game/PhaserCanvas.vue` | Inject adapters, host readiness, cleanup |
| Modify `src/game/scenes/MainScene.ts`, `CombatScene.ts`, `TribulationScene.ts` | Render/READY; bỏ tự chuyển scene |
| Modify `src/composables/useBattleActions.ts` | Admission trước startSelectedStage/startBattle |
| Modify `src/components/game/combat/CombatVictoryPanel.vue`, `CombatDefeatPanel.vue`, `CombatExitConfirmModal.vue`, `CombatIntroOverlay.vue` | Dismiss/abandon/refight, tách curtain |
| Modify `src/core/tribulation/TribulationDirector.ts`, `src/composables/useTribulation.ts`, `src/components/game/tribulation/TribulationSceneOverlay.vue` | Session hold/query và settlement→route |
| Modify `src/App.vue`, `src/composables/useBootFlow.ts`, `useAppLifecycle.ts` | Startup route facade, preserve clock/save |
| Modify `src/components/layout/GameRoot.vue`, `src/components/game/MainScene.vue`, `DongFuScene.vue`, `src/composables/useCombatSceneActive.ts`, `src/stores/ui.ts` | One visibility source, stable canvas |
| Modify `src/game/support/CombatPreload.ts`, `DongFuStackLoader.ts`, `src/components/panels/StageSelectPanel.vue` | Enumerate/reuse resources; prefetch |
| Create `tests/e2e/presentation-routing.spec.ts`, `src/presentation/presentationOwnership.test.ts` | Runtime and ownership guards |
| Create `docs/qa/2026-09-09-presentation-coordinator.md` during execution | Evidence ledger and QA verdict |

Existing sources to reuse: `PlayerVisualProfiles`, `EnemyArt`, `CombatAnimationSet`, `ThanhVanArt`, `InkWashUiPhaser`, `DongFuArt`, `useDialogFocus`, UI tokens/primitives. Keep action event bus and renderer helpers. Inventory/production/quest code is read-only except existing runtime smoke observations.

## 3. Shared contracts (define once, import everywhere)

Task 2 creates runtime contracts in core. Use `number` IDs allocated by one GameManager-lifetime allocator; route/session kind accompanies them. No Date.now identity.

```ts
export type SessionKind = 'combat' | 'tribulation'
export type PresentationMode = 'headless' | 'interactive'
export type SessionRef = Readonly<{ kind: SessionKind; sessionId: number }>
export type PresentationHold = Readonly<{
  sessionId: number
  generation: number
}>
export interface SessionPresentationPort {
  getCurrentSession(): SessionRef | null
  hold(session: SessionRef): PresentationHold | null
  attach(token: PresentationHold): boolean
  release(token: PresentationHold): boolean
  detach(token: PresentationHold, policy: 'hold' | 'headless'): boolean
}
```

`hold` validates a current session, creates a new binding generation, synchronously blocks runtime and invalidates old callback acceptance. It returns null for stale identity. `release` requires attached current token. `detach(hold)` preserves pending work; `detach(headless)` is an explicit mode command, never a failure handler. Facade validates kind before delegating; primitive is reused, not another mutable copy of runtime state.

Task 5 creates presentation contracts. RouteRequest intentionally requires a session for combat/tribulation.

```ts
import type { SessionRef } from '../core/presentation/PresentationSession'
export type Route = 'boot' | 'auth' | 'character' | 'home' | 'combat' | 'tribulation' | 'error'
export type RouteRequest =
  | Readonly<{ target: 'combat' | 'tribulation'; session: SessionRef }>
  | Readonly<{ target: 'boot' | 'auth' | 'character' | 'home' | 'error' }>
export type Phase = 'idle' | 'closing' | 'loading' | 'activating' | 'awaiting-ready' | 'opening' | 'failed'
export type TransitionResult = Readonly<{
  status: 'entered' | 'unchanged' | 'rejected' | 'failed'
  transitionId: number
}>
export interface RendererPort {
  prepare(request: RouteRequest, id: number, signal: AbortSignal): Promise<void>
  deactivate(route: Route): Promise<void>
}
export interface CurtainPort {
  close(id: number, signal: AbortSignal): Promise<void>
  open(id: number, signal: AbortSignal): Promise<void>
}
export interface AssetPort {
  ensureFor(request: RouteRequest, signal: AbortSignal): Promise<void>
}
export interface DeadlineScheduler {
  set(callback: () => void, ms: number): unknown
  clear(handle: unknown): void
}
```

Prepare resolves only after composite READY; internally register waiters before mount/start. Route kind must equal session.kind or reject. Coordinator API: `request(request): Promise<TransitionResult>`, `getSnapshot()`, `subscribe(listener): () => void`, `dispose(): void`; Task 6 adds command admission via `runAdmitted` below. Snapshot contains currentRoute/renderRoute, currentSession/targetSession, phase/id, boot subphase/menu and error details; expose detached readonly values.

## Task 1 — Baseline and characterization (no production changes)

**Read:** source table above, `src/core/game/StageWaveSystem.ts`, existing `GameManager.presentationGate.test.ts`, `GameManager.actionPlayback.test.ts`, `GameManager.stageRestart.test.ts`, `src/App.wiring.test.ts`, `src/composables/useAppLifecycle.test.ts`, `tests/e2e/helpers.ts`, `create-to-combat.spec.ts`, `boot-fresh.spec.ts`.

**Create:** execution QA ledger and `tests/e2e/presentation-routing.spec.ts`. **Output:** baseline findings by F01–F14, exact working branch/HEAD, red browser regression if reproducible.

- [ ] From authorized worktree run `git status --short`, `git rev-parse HEAD`, `git branch --show-current`. Stop if overlap exists. Record baseline drift from this plan.
- [ ] Search `rg -n 'battle_start|combat_scene_exit|tribulation_scene_exit|setPresentationActive|enterCombatScene|enterTribulationScene' src -g '!*.test.ts'`. Classify navigation, visual reset, snapshot cleanup, domain signal; do not remove all matches blindly.
- [ ] Run baseline full gate from `game`: `npm run type-check`, then `npm run build`, then `npx vitest run`, sequentially. Record actual results and pre-existing failures; stop/classify first failure, do not hide it.
- [ ] Reuse `bootToGuestHome`, `createCharacterThroughUi`, `enterHome`; open command wheel via Tab, `[data-wheel-slot="teleport_array"]`, click `stage-start-button`. Add this assertion immediately after click, before waiting for a result:

```ts
await expect.poll(() => page.evaluate(() => {
  const game = (window as Window & {
    __tutienPhaserGame?: { scene: { isActive(key: string): boolean } }
  }).__tutienPhaserGame
  return Boolean(game?.scene.isActive('CombatScene'))
    && !game?.scene.isActive('MainScene')
})).toBe(true)
```

- [ ] Run `npx playwright test tests/e2e/presentation-routing.spec.ts` using the configured actual server/worktree. If isolated-worktree browser exception applies, explicitly defer P14 and record that no runtime reproduction was made here.
- [ ] Record existing assertions for terminal dismissal, repeat party retention, fresh restart reset, manual pending choice; add characterization assertions in their existing files if absent.

**Gate:** precise baseline, no claim that browser regression is reproduced solely from source. Do not spend this task fixing unrelated failing tests.

## Task 2 — Session primitive and stage lifecycle

**Create:** `src/core/presentation/PresentationSession.ts`, `.test.ts`. **Modify:** `GameManager.ts`, `GameManagerTurnBattleOps.ts`, presentation gate tests. **Consumes:** existing startStage boolean. **Produces:** core contracts in §3 and runtime current-session query.

- [ ] Export class `PresentationSession` with constructor requiring no renderer; implement allocator `allocate(): number` shared by GameManager and primitive methods `begin(session, mode): void`, `hold(session): PresentationHold | null`, `attach(token): boolean`, `release(token): boolean`, `detach(token, policy): boolean`, `end(session): void`, `isBlocking(): boolean`. Store current identity, generation, attached/held flags in the primitive only.
- [ ] Write tests before implementation using the exact public methods. Representative oracle:

```ts
const gate = new PresentationSession()
const session = { kind: 'combat', sessionId: 1 } as const
gate.begin(session, 'interactive')
const token = gate.hold(session)!
expect(gate.isBlocking()).toBe(true)
expect(gate.release(token)).toBe(false)
expect(gate.attach(token)).toBe(true)
expect(gate.isBlocking()).toBe(true)
expect(gate.release(token)).toBe(true)
expect(gate.isBlocking()).toBe(false)
const retry = gate.hold(session)!
expect(gate.release(token)).toBe(false)
expect(gate.attach(retry)).toBe(true)
```

- [ ] Cover headless begin unblocked; begin session 2 invalidates session 1 tokens; stale hold returns null; repeated queries do not change state; advancing fake time 60 seconds does not release interactive hold; end is idempotent.
- [ ] Bind GameManager-lifetime allocator to stage ops. A successful `startStage` begins held before it returns; notify only after all wave/pending/reward setup. Failed start creates no session. Direct public `startBattle` callers must also be enumerated and get an intentional headless/interactive policy; nested stage bootstrap must not publish two sessions.
- [ ] Keep continuous repeat on the same session; fresh start increments. When replacing/abandoning, invalidate old session through runtime owner. Emit typed `presentation_session_started` containing SessionRef; listener reads full current snapshot, not event payload internals.
- [ ] Add facade `getCurrentPresentationSession(): SessionRef | null`, `getPresentationPort(): SessionPresentationPort` without exposing mutable runtime instances. Register App interactive intent before start; default headless preserves existing tests/tools.
- [ ] Run `npx vitest run src/core/presentation/PresentationSession.test.ts src/core/game/GameManager.presentationGate.test.ts src/core/game/GameManager.stageRestart.test.ts` in red/green cycle.

**Gate:** fresh session starts held; failed start no ID/notification; repeat retains identity. No new core→presentation import.

## Task 3 — Hold-safe action runtime and retry continuation

**Modify:** `CombatAnimationRuntime.ts`, `GameManagerTurnBattleOps.ts`, GameManager facade; tests `CombatAnimationRuntime.test.ts`, `CombatAnimationRuntime.r5.reaudit.test.ts`, `GameManager.actionPlayback.test.ts`, `GameManager.presentationGate.test.ts`.

**Output:** held ACK/manual/tick behavior; explicit runtime resume command. Keep existing three ACK method names and mandatory token validation behavior.

- [ ] Add injected runtime gate query; before each of `acknowledgeTurnReady`, `acknowledgeActionImpact`, `acknowledgeActionComplete`, `submitTurnChoice`, reject while held or wrong binding. Before fixed-step battle driver, return from that driver while held; do not return from all GameManager.update.
- [ ] Replace failure teardown with hold detach; never call `handlePresentationDeactivated` there. Preserve explicit headless drain tests and manual-choice semantics.
- [ ] Add `preparePresentationResume(): ResumePlayback | null` on runtime: preserve pending actor/declared action/impact; renew playback token once per new binding; return detached render data. Define discriminated payload using existing visual IDs/target IDs:

```ts
type ResumePlayback =
  | Readonly<{ phase: 'ready'; token: string; actorId: string }>
  | Readonly<{ phase: 'cast'; token: string; actorId: string; skillId: string; targetIds: readonly string[] }>
  | Readonly<{ phase: 'complete'; token: string; actorId: string; targetIds: readonly string[] }>
  | Readonly<{ phase: 'manual'; actorId: string }>
```

- [ ] `preparePresentationResume` is an explicit command called once when reattaching, never from a reactive getter. It does not declare/resolve/apply damage. Query initial state afterward; play resume after release so synchronous completion callbacks are accepted. No pending phase returns null.
- [ ] For each pending phase capture HP, totalTurnsElapsed, pending token, awaited choice before hold; call all ACKs with old and missing tokens plus update/manual submit; assert unchanged. Attach/release/replay new token; assert exactly one impact/complete across failure+retry. A stale old callback after retry must still do nothing.
- [ ] Add accepted abandon cleanup through runtime owner: clear pending phase/token without drain; assert a previously valid late impact cannot damage defeated/abandoned battle.
- [ ] Run `npx vitest run src/core/battle/turn/CombatAnimationRuntime.test.ts src/core/battle/turn/CombatAnimationRuntime.r5.reaudit.test.ts src/core/game/GameManager.actionPlayback.test.ts src/core/game/GameManager.presentationGate.test.ts src/core/game/GameManager.stageRestart.test.ts`.

**Gate:** failure is not a gameplay mutation; retry resumes each phase and manual choice without duplicate action. If resume cannot be proven, stop this slice—do not advertise a working retry with stuck pending state.

## Task 4 — Pure initial combat snapshot

**Modify:** `src/core/battle/turn/TurnActionPresentationEvents.ts` and existing `TurnActionPresentationEvents.test.ts`; stage ops/GameManager query. **Output:** initial combat view independent of ticking.

- [ ] Extract `buildTurnBattleEntitySnapshot(battle: TurnBattle): TurnBattleEntitySnapshotEvent` from existing emitter; retain same field semantics. Emitter becomes exactly:

```ts
eventBus.emit('turn_battle_entity_snapshot', buildTurnBattleEntitySnapshot(battle))
```

- [ ] Preserve existing event literal `turn_battle_entity_snapshot` and its consumer payload; this task does not rename the bus contract.
- [ ] Facade `getCombatPresentationSnapshot(sessionId: number)` returns null on stale ID; otherwise `{ sessionId, entities: buildTurnBattleEntitySnapshot(battle) }`. Return detached arrays/objects, including nested pending spawn data; no runtime entities.
- [ ] Tests: stage in intro with zero ticks has player and correct empty/pending enemies; countdown progress unchanged; mutation of returned arrays does not touch battle; reading twice emits zero events and changes no ticks/HP/rewards; emitted payload equals builder at same state.
- [ ] Run `npx vitest run src/core/battle/turn/TurnActionPresentationEvents.test.ts src/core/game/GameManager.introPhase.test.ts src/core/game/GameManager.stageRestart.test.ts`.

**Gate:** renderer can reconcile while gate is closed. Old `positions` cache is not removed until Task 10 proves parity.

## Task 5 — Coordinator transition state machine

**Create:** contracts and `GamePresentationCoordinator.ts`, `.test.ts`. **Consumes:** §3 ports. **Produces:** request/snapshot/subscribe/dispose.

- [ ] Build tests with injected deferred promises (not sleep):

```ts
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
```

- [ ] Encode the spec §6 route table and domain guards as one validation function. Same route/session during failure retries; same idle healthy route/session returns unchanged. New Combat session runs rebind. Conflict returns rejected and does not allocate another domain operation.
- [ ] Implement ordered kernel: acquire hold → close → ensure host/assets → deactivate → set renderRoute → prepare/READY → commit/attach → open → release → idle. Failed attach/release is a transition failure, never ignored. Keep the session/generation captured throughout.
- [ ] At each deferred point inspect snapshot/call log: no renderRoute mount before assets; no currentRoute commit before READY; no runtime release before open. Assert the full call order in the test, not just final state.
- [ ] Inject scheduler for 2s curtain, 30s host/assets, 10s READY. Use Promise.race with abort and timer cleanup; after every await verify alive/current generation. Deadlines cover deactivate/activation too; no unbounded adapter promise.
- [ ] Failure cancels subscriptions; retain old renderer if not deactivated, else error cover and clean partially active target. Snapshot carries failed request and which renderer remains available. Retry requests same session with a new transition ID. A changed/missing session rejects retry.
- [ ] Test synchronous READY, missing READY, stale READY, listener unsubscribe, duplicate requests, conflicting request, open failure after commit, dispose at every phase and late promise completion. Subscription callbacks receive detached snapshots.
- [ ] Run `npx vitest run src/presentation/GamePresentationCoordinator.test.ts`.

**Gate:** no rejected/failing transition releases session; no unbounded lock or invisible failed screen. Renderer failure does not call domain start/settle.

## Task 6 — Admission before domain side effects

**Create:** `src/presentation/createGamePresentation.ts`, `.test.ts` foundation. **Modify:** `src/composables/useBattleActions.ts` only when ready to wire the vertical slice in Task 10.

**Output:** application command facade and admission operation:

```ts
runAdmitted(command: () => RouteRequest | null): Promise<TransitionResult>
```

- [ ] `runAdmitted` checks/sets a synchronous reservation before invoking command. If locked, return rejected without invoking callback. Callback returning null means domain rejection; release reservation and retain current UI. Successful callback yields exact authoritative session request; hand reservation into transition rather than calling a second lock acquisition.
- [ ] Catch callback exceptions, release reservation, show classified error. The callback is synchronous because current start commands are synchronous; do not add async gameplay transaction machinery.
- [ ] Wire a buffered notification bridge: subscribe first, query current session second; dedupe same session. Notification fired inside admitted start must join reserved transition, not start a competing transition. External accepted session startup is observed and held; query late registration to recover missed start.
- [ ] Tests use a callback spy and actual GameManager integration: two immediate clicks call start once; start false causes zero route/panel/cultivation writes; current stage metadata comes from accepted session rather than selected preferences. Notifications plus returned request cause one transition.
- [ ] Run `npx vitest run src/presentation/createGamePresentation.test.ts src/presentation/GamePresentationCoordinator.test.ts`.

**Gate:** no side effects on rejection; no session accepted then discarded because the notification raced its own reservation.

## Task 7 — Asset catalog and independent loader

**Create:** `src/presentation/assets/AssetBundleCatalog.ts`, `AssetBundleManager.ts`, their tests, `src/game/scenes/AssetLoaderScene.ts`. **Modify:** `src/game/support/CombatPreload.ts`, `DongFuStackLoader.ts` only for reusable enumeration/decode.

**Interfaces:** `ensureLoaded(bundleIds: readonly AssetBundleId[], signal: AbortSignal): Promise<void>`, `prefetch(bundleIds: readonly AssetBundleId[]): Promise<void>`, `isLoaded(id): boolean`, `dispose(): void`. AssetBundleId is `core-ui | home | combat | tribulation`. Keep `queueCombatAssets` as compatibility wrapper until Task 13.

- [ ] Extract resource descriptors from existing queue logic and catalogs. Model existing image, spritesheet, atlas/multiatlas and DOM image kinds with discriminated unions and exact current options. Do not force every kind through `load.image`.
- [ ] Catalog tests compare current combat enumeration to wrapper queued keys and animation sheet keys. Explicitly assert Home contains standing/cultivating player keys and DongFu layers, but not enemies/gourd.
- [ ] Build independent loader scene; no display objects, no domain access, no automatic next scene. Its lifecycle is requested by adapter. Make loader readiness available before ensure; no ensure→target.preload→ensure cycle.
- [ ] Manager maintains successful resources, in-flight requests and serialized physical load batches. Identity collision (same cache key with different URL/type/frame config) rejects with diagnostic; don't silently reuse wrong texture.
- [ ] Register file-error and complete listeners before starting queue. Check resource cache after queue completion; failed required multiatlas child causes rejection. Preserve successful keys; retry only absent/failed entries. Empty queue resolves without waiting for an event that will never fire.
- [ ] Add DOM decode using current DongFu loader's injectable Image loader pattern. Abort waiter and clean handlers; shared resource can finish for another waiter. No filesystem/network credential reads are involved.
- [ ] Unit matrix: cached ensure; concurrent ensure+prefetch one physical request; cancel A while B succeeds; error then retry; atlas child error; descriptor collision; game destroyed mid-load; fresh game cache empty; prefetch rejection handled by caller.
- [ ] Run `npx vitest run src/presentation/assets src/game/support/CombatPreload.test.ts src/game/support/DongFuArt.test.ts` plus the new loader test if split into its own file.

**Gate:** manager never claims success just from COMPLETE; cache lifetime equals owning game; Home keeps necessary art without eager combat.

## Task 8 — Phaser adapter and game-host boot order

**Create:** `src/presentation/PhaserSceneAdapter.ts`, `.test.ts`. **Modify:** `PhaserCanvas.vue`, its tests; primary scenes receive activation context and READY callback in Task 10/11.

- [ ] Adapter registers readiness waiter before scene start, with `{transitionId, sessionId, gameGeneration}`. Public `reportReady(context)` resolves only the matching pending waiter once. Keep registry private to adapter.
- [ ] Ensure registry/eventBus/GameManager/profile bridges are populated before activating a primary. Prevent first MainScene autostart by using the nonvisual loader/bootstrap arrangement. Do not call start from PhaserCanvas to work around ordering.
- [ ] Maintain exactly one Main/Combat/Tribulation active in steady state; adapter stop previous before start next. Track partial-start state for error cleanup. Same Combat new session calls explicit scene rebind instead of destroying Phaser.Game.
- [ ] PhaserCanvas resolves host readiness once nonzero dimensions and bridges exist. Keep ResizeObserver and one game instance; on unmount abort adapter/loaders and dispose before destroy. Late dynamic import must not create a game after unmount.
- [ ] Tests: synchronous READY during create, stale game callback after remount, scene throws on create, stop cleanup, startup no unsolicited Main, resize before/after ready, same-route rebind, destroy while ensure pending.
- [ ] Run `npx vitest run src/presentation/PhaserSceneAdapter.test.ts src/components/game/PhaserCanvas.test.ts src/game/scenes/MainScene.lifecycle.test.ts`.

**Gate:** only adapter activates primary scenes, including first Home; no registry race, orphan game or cached-ready cross-game leak.

## Task 9 — Vue adapter, curtain and composite READY

**Create:** `src/presentation/VueRouteAdapter.ts`, test; `PresentationTransitionOverlay.vue`, test. **Modify:** `GameRoot.vue` minimum mount bridge; use UI primitives/tokens, `useDialogFocus` where its focus semantics fit.

- [ ] Vue adapter holds a shallow readonly view of coordinator snapshots and unsubscribes on dispose. It does not expose setters for currentRoute. renderRoute controls target mount behind the curtain.
- [ ] Report Vue READY only after mount/nextTick and required DOM image decode; composite renderer prepare awaits Vue plus Phaser. Boot/Auth/Character/error renderer does not wait for a Phaser host.
- [ ] Overlay implements CurtainPort via exposed methods with transition ID/AbortSignal. Resolve once on actual animation completion for both panels; ignore bubbled child events. Reduced motion resolves after DOM state is applied. Abort removes event/timer listeners.
- [ ] Keep visible loading/error shell independent of loaded textures. Disable pointer and keyboard gameplay/hotkey paths while locked; do not disable retry/error buttons. Restore focus to an existing destination element after unlock; use aria-busy/status and local i18n labels.
- [ ] Mount overlay outside combat-only conditional so cold entry and boot failures are covered. Old CombatIntroOverlay retains phase/title; remove its duplicate navigation curtain in Task 10.
- [ ] Tests: component mounted under renderRoute while currentRoute old; waits for both READY sources; animation abort/reduced motion; repeated close/open doesn't leak; Tab/Enter/hotkey cannot activate stage underneath; error retry focusable.
- [ ] Run `npx vitest run src/presentation/VueRouteAdapter.test.ts src/components/game/PresentationTransitionOverlay.test.ts src/presentation/GamePresentationCoordinator.test.ts`.

**Gate:** no mount/READY deadlock, inaccessible error cover or keyboard bypass. Visual correctness still needs P14.

## Task 10 — Complete Combat entry/exit/refight vertical slice

**Modify:** composition, `useBattleActions.ts`, `MainScene.ts`, `CombatScene.ts`, result/exit/intro components, snapshot bridge in PhaserCanvas. **Create:** `src/presentation/combatRouting.test.ts`.

- [ ] Integrate with a real GameManager, production stage/skill registration patterns from existing tests and injected renderer/curtain ports. Verify start initializes full stage session before subscriber sees it; tick held; initial snapshot delivered; READY/open releases.
- [ ] Replace MainScene battle-start navigation and CombatScene exit listener at cutover; do not leave two active route owners. Start actions use runAdmitted. Commit panel closure/cultivation event/preferences implying success only after start accepted.
- [ ] Combat create subscribes, sets HUD/layout, applies new query snapshot and reports READY. Remove scene `setPresentationActive(true/false)` calls after runtime attachment bridge is connected. Preserve all 3 action ACK calls/tokens; callback closures capture identity, never fetch the latest token to validate an old animation.
- [ ] Replace `onBattleStart` reset-only subscription with explicit `rebindSession(context, snapshot)`; reuse its real reset behavior. Reset actor death transforms, per-battle flags/background generation and stale VFX exactly as current helper responsibilities require. Continuous repeat does not invoke full rebind.
- [ ] Apply resume payload from Task 3 after reveal/release. Ready/cast/complete use existing animation helpers; manual restores choice UI. Late callbacks from prior scene/session cannot mutate current action.
- [ ] Exit modal calls domain abandon then Home only when true. Terminal result dismissal requests Home without abandon/reset. Defeat/victory refight uses fresh session; repeat cycle remains internal.
- [ ] Remove duplicate navigation curtain from CombatIntroOverlay, retain existing intro ticks/title then countdown. No wall-clock-based extra gameplay countdown. Remove age-only cross-session snapshot acceptance; retire positions replay only once entity snapshot covers cold/warm render consumers.
- [ ] Integration tests: cold entry zero ticks until release; second entry held; result dismissal retains terminal battle; rejected abandon stays Combat; fresh refight session changes once; repeat players same identity and state fighting; pending phase recovery exact-once.
- [ ] Run `npx vitest run src/presentation/combatRouting.test.ts src/core/game/GameManager.actionPlayback.test.ts src/core/game/GameManager.stageRestart.test.ts src/game/scenes/CombatScene.actionPlayback.test.ts src/core/game/GameManager.introPhase.test.ts`.
- [ ] Run Task 1 browser regression to green and visually inspect player/enemy materialization, countdown, action/VFX and return/second entry. If P14 deferred, record concern rather than claiming this gate fully green.

**Checkpoint A:** actual combat chain works before expanding boot/tribulation. Do not remove eager combat assets before this checkpoint's cold-entry coverage exists.

## Task 11 — Tribulation session, hold and outcome routing

**Modify:** `TribulationDirector.ts`, `GameManager.ts`, `useTribulation.ts`, Main/Tribulation scenes, `TribulationSceneOverlay.vue`. **Create:** `src/presentation/tribulationRouting.test.ts`. Reuse core session primitive from Task 2.

- [ ] Preserve `start` setup, `enterChapter`, question/chapter timing, victory/defeat, cooldown and settlement. Establish session before update/answer can progress; notify after complete setup. Expose session-tagged detached get-state query for late renderer (start/chapter events may predate it).
- [ ] Gate Director update and answerQuestion in interactive held mode. A 30-second renderer delay changes neither hp, questionSecondsRemaining, secondsRemaining nor strikesTaken. Do not hold GameManager's unrelated systems or convert Director delta into combat fixed ticks.
- [ ] Acquire application admission before triggerBreakthroughAction can unequip. Existing eligibility rules remain; no new realm or equipment policy. Retry only renderer request, never triggerBreakthroughAction again.
- [ ] Replace MainScene tribulation-start routing with composition notification/query; TribulationScene reports READY after subscriptions and initial state. Keep non-navigation chapter/lightning events.
- [ ] In outcome action capture session ID, resolve current victory/defeat exactly once, clear through existing domain owner, then request Home. Duplicate outcome check after clear is no-op; failed Home transition cannot settle again. Preserve Quán Khí standalone panel and announcements through Home reveal.
- [ ] No error button clears ongoing tribulation just to return Home. Offer retry; if existing application restart path is available, preserve its save/lifecycle policy without inventing cancellation semantics.
- [ ] Tests: no mind timeout or lightning during hold; rejected attempt during battle/transition has no unequip; duplicate outcome not double penalty/reward; retry same session; stale READY rejected; terminal prior combat cannot mask tribulation.
- [ ] Run `npx vitest run src/presentation/tribulationRouting.test.ts src/core/tribulation/TribulationDirector.test.ts src/composables/useTribulation.dotPha.test.ts src/composables/useTribulation.artifact.test.ts src/game/scenes/TribulationScene.inkWashUi.test.ts`.

**Gate:** full tribulation runtime is held, not just visual lightning; settlement remains independent of mounting.

## Task 12 — App startup and removal of duplicate Vue route authority

**Modify:** App, useBootFlow, useAppLifecycle, GameRoot, MainScene.vue, DongFuScene, useCombatSceneActive, ui store and exact callers found by search.

- [ ] Construct coordinator once in App setup before entry UI; provide adapter/facade. Keep Phaser import lazy in PhaserCanvas. Move `showMainMenu` route-related state into coordinator snapshot; preserve start/settings behavior and existing intro timer ownership without adding another.
- [ ] Turn useBootFlow into compatibility facade: showAuth/startSaveLoad/requireCharacter/startInitializing/enterGame/fail map to coordinator commands/subphases. Remove local stage ref after migrating App and tests. Preserve no-save, guest, auth, character Back, successful restore, incompatible/corrupted/unavailable errors.
- [ ] `useAppLifecycle.bootGame` still does restore, `clock.start`, `startTickLoop(tick)` and persistence; coordinator reacts to resulting facts. Preserve bootInFlight semantics and cancellation/disposal guards. Home READY must not be a second place calling bootGame.
- [ ] Mount game host on renderRoute need after initialization, not exclusively currentRoute Home; retain it across Home/Combat/Tribulation. Error cover for presentation failure must not destroy and recreate game on every retry.
- [ ] Migrate every combatSceneDismissed/isTribulationSceneActive/enterCombatScene/exitCombatScene caller; remove state/actions only once no consumers remain. `useCombatSceneActive` derives coordinator route. Keep selected stage and run mode preferences.
- [ ] DongFu visibility derives route instead of useStageActive. Home chrome does not appear through Combat/Tribulation during transition. New component mounts behind curtain use renderRoute consistently.
- [ ] Tests: MainMenu start, guest empty save→character, character Back, auth success/failure, load unavailable/corrupt/incompatible, duplicate boot, unmount mid-load, one clock/tick/autosave. Preserve existing save restore tests; don't regenerate expected saves to hide change.
- [ ] Run `npx vitest run src/App.wiring.test.ts src/composables/useBootFlow.test.ts src/composables/useAppLifecycle.test.ts src/components/game/PhaserCanvas.test.ts src/components/game/DongFuScene.test.ts`.
- [ ] Browser boot flow must observe cultivation increasing and a configured production operation progressing after Home, not just canvas existence. Use current UI/fixtures; no timer bypass injected into production.

**Checkpoint B:** coordinator is sole route owner from startup; existing runtime loop remains wired once.

## Task 13 — Lazy asset cutover and obsolete wiring removal

**Modify:** Main/Combat/Tribulation preload, StageSelectPanel, CombatPreload, scene backdrop loader. **Create:** `src/presentation/presentationOwnership.test.ts`.

- [ ] Switch primary preload to rely on already ensured bundles; remove MainScene eager combat queue only after Task 10 passes. Home bundle keeps both standing/cultivate keys. Retain compatibility wrapper only for a demonstrated remaining caller and document it.
- [ ] On stage selection opening call prefetch('combat') with handled rejection; click ensure joins same load. Backdrop variants request physical loading through manager, while scene's existing generation and no-mid-battle-swap rule remain authoritative.
- [ ] Search lifecycle events and flags again; remove navigation producers/consumers and obsolete clearPositions handlers. Keep legitimate gameplay `battle_end`, damage, cast, impact and profile updates. Verify both event subscription and unsubscription sites.
- [ ] AST guard using installed TypeScript checks primary lifecycle calls `start/stop/launch/sleep/wake/switch/run/restart`; only adapter allowlisted. Include initial config and known aliases in inspection. Preview own Game and nonvisual loader documented exceptions, not a broad scene-folder exemption.
- [ ] Add fixtures proving guard rejects direct scene.start and known alias calls outside adapter. Dynamic property access cannot be proven exhaustively; integration exclusivity checks remain required.
- [ ] Search `rg -n 'combatSceneDismissed|isTribulationSceneActive|combat_scene_exit|tribulation_scene_exit|battle_start|setPresentationActive' src -g '!*.test.ts'` and classify every remaining hit. No active old route writer allowed.
- [ ] Update roadmap narrowly with actual implemented contract/status and QA link only when shipped in worktree; do not mark R6 art complete. Record retained wrapper/preview/DOM helper debt explicitly.
- [ ] Run `npx vitest run src/presentation/presentationOwnership.test.ts src/presentation/assets src/game/support/CombatPreload.test.ts` and `npm run check:bundle-split` because lazy asset/chunk preservation matters.

**Gate:** cold Home doesn't fetch full combat payload; cold Combat still works; no hidden second scene/route authority.

## Task 14 — Final verification, deep QA and handoff

**Modify:** `tests/e2e/presentation-routing.spec.ts`, execution QA report. QA-phase writes only test/E2E/QA docs. Production fixes leave QA phase, then repeat impacted verification.

- [ ] Apply code-simplifier to final production diff; preserve behavior and contracts. Run `git diff --check`.
- [ ] Run sequential full gate: `npm run type-check` → `npm run build` → `npx vitest run`. Stop on first failure, fix task-caused issue, rerun required mode. No guessed test counts or copied historical PASS.
- [ ] Run code-review after simplification/verification. Resolve findings confidence ≥80; substantial fixes require simplify/verify/review again. Use requesting-code-review when delegating an explicit review.
- [ ] Run tutienidle-adversarial-qa **deep**: time, lifecycle, pending actions, scene failure and persistence adjacency justify deep mode. Record deterministic evidence per invariant; do not edit production inside QA.
- [ ] E2E command: `npx playwright test tests/e2e/presentation-routing.spec.ts tests/e2e/create-to-combat.spec.ts tests/e2e/boot-fresh.spec.ts tests/e2e/turn-combat-hud.spec.ts`. Read actual DEV_PORT/server output and verify it serves this worktree; don't assume 5173. Existing config uses DEV_PORT/default 5175 and reuses a server, so an unrelated server must not supply evidence.
- [ ] For P14 load playwright-cli, prefer Edge, run `npm run dev` and use actual printed URL. Navigate each changed flow, screenshot and inspect. Console clean alone is not evidence. Close session/clean scratch, retain only intentional QA artifacts.
- [ ] Exercise matrix below, record each as PASS/failure/gap with observed state and evidence. Delay/block only required asset URLs observed from catalog, not unrelated auth/network requests.

| Scenario | Required oracle |
|---|---|
| Cold Home | DOM art/player ready; full combat assets not eagerly fetched |
| Cold Combat + delayed required asset | cover visible, intro/waves/HP unchanged until reveal |
| Required asset failure + retry | error controls reachable, same session, missing file reload only |
| Missing/stale READY | timeout held; stale signal cannot commit/unlock |
| Double start click | one domain start, one session, one transition |
| Second entry | held again; correct party/enemies and no stale corpse/VFX |
| Fresh refight vs continuous repeat | new session/rebind vs same session/no new countdown |
| Ready/cast/impacted/manual renderer loss | phase resumes, old token rejected, damage exactly once |
| Exit accepted/rejected | Home only after valid domain outcome; no late impact |
| Tribulation mind/tank and victory/defeat | no hidden timer loss; settlement once then Home |
| Boot/restore retry/unmount | no late mount, no duplicate loop/restore/reward |
| Resize and reduced motion | nonzero layout; curtain completes; input/focus correct |
| Real progression | enemy materializes, action/VFX runs, domain counters change; Home cultivation/production also advances |

- [ ] Handoff summary: worktree/branch, files, ownership delta, exact checks/results, QA/review verdict, P13/P14 evidence, retained debt. If browser deferred by isolated-worktree exception, state `DONE_WITH_CONCERNS`, obtain authorized preview during branch finishing; don't call final runtime acceptance complete.
- [ ] Do not commit, merge or push without explicit authorization. Do not delete worktree just because code tests pass.

## 4. Dependency order and small-agent handoff

Execute 1→2→3→4→5→6→7→8→9→10→11→12→13→14. Tasks 7 and 5 can be parallel only after shared contracts fixed and file ownership isolated; integration coordinator reviews combined diff. Shared GameManager/PhaserCanvas/App changes are sequential. Do not create user-owned Codex tasks as substitute subagents.

Delegate one task with: spec path, plan task number, actual worktree/branch/HEAD, allowed files, consumed/produced contracts, required tests, known baseline failures and explicit exclusions. Require files changed, command evidence and limitations in reply. Coordinator inspects actual diff, not only the agent's summary.

At a checkpoint, resume from checked ledger and git diff, not from assumptions that earlier tasks passed. A checkbox is checked only with output evidence. If a source path/signature differs from this baseline, inspect current owner and update the plan/ledger before changing contract; do not invent an adapter that silently ignores missing functionality.

## 5. Coverage map and document review

| Spec requirement/finding | Implementation tasks |
|---|---|
| F01 missing navigation / reset consumer | 1, 6, 10, 13 |
| F02–F03 session hold, failure drain | 2, 3, 5 |
| F04 cold snapshot deadlock | 4, 8–10 |
| F05 repeat/refight distinction | 2, 3, 10 |
| F06 one visibility owner | 9, 11, 12 |
| F07 admission before effects | 6, 10, 11 |
| F08 abandon/dismiss | 3, 10 |
| F09–F10 tribulation clock/settlement | 2, 11 |
| F11 boot/menu/clock/restore | 9, 12 |
| F12 game bootstrap/lifetime | 7, 8, 12 |
| F13 bundles/DOM/home keys | 7, 9, 13 |
| F14 real runtime evidence | 1, 10, 12, 14 |
| Pending-action retry, deadlines, stale completion | 3, 5, 8, 14 |
| Disposal, readonly state, ownership enforcement | 2, 5, 8, 9, 12, 13 |

Documentation audit result: design/plan now use the same ownership, routes, naming and migration sequence; no production success is asserted. Verification of this documentation consists of relative links, referenced baseline paths, contradiction/placeholder scan and git diff checks. Production tests and browser work belong to execution, not this docs-only task.
