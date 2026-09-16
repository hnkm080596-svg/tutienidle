# QA Review: transition asset-load race fix (DOM fence + error pin timing)

- Date: 2026-09-16
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/presentation/assets/AssetBundleManager.ts`
  - `game/src/presentation/GamePresentationCoordinator.ts`
  - `game/src/App.vue`
  - `game/src/presentation/assets/AssetBundleManager.test.ts`
  - `game/src/presentation/GamePresentationCoordinator.test.ts`

## Scope and Risk Map

Changed systems: presentation transition authority (`GamePresentationCoordinator`), asset loading (`AssetBundleManager`), boot/error wiring (`App.vue`). Mapper output: domain `ui-input-lifecycle`; 4 task-owned paths unmapped — manually routed to `ui-input-lifecycle` + `pinia-phaser-sync` (the coordinator decides when `GameRoot`/`PhaserCanvas` mounts, which is the Vue↔Phaser host-lifecycle boundary). One-hop consumers inspected: `useBootFlow` stage derivation, `PhaserCanvas`/`useDynamicRegion` host lifecycle, `PhaserSceneAdapter` readiness waiters, `VueRouteAdapter` mount waiters, `PresentationTransitionOverlay` error card.

Exclusions (pre-existing dirty paths, not reviewed): `src/core/the-tu/TheTuAnMechanicModifiers.ts`, `src/core/the-tu/TheTuKitModifiers.ts`, `src/core/battle/turn/*` (test + impl), `docs/specs/2026-09-16-cultivation-path-framework-*`, `docs/superpowers/plans/2026-09-16-cultivation-path-framework.md`.

Escalation decision: the change sits at a Vue↔Phaser lifecycle boundary (an escalation trigger), but it introduces no new ownership — it restores the documented `useBootFlow` intent (a failed game transition's `error.failedRequest.target` pins the stage so the host survives retry) and narrows an existing fence to the resource kind it protects. Every material hypothesis below resolved conclusively at unit or live-browser layer; the change touches no save/economy/combat/persistence boundary. Bounded without deep audit.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-DOM-1 | DOM image load in `AssetBundleManager` | `setLoaderScene` registers while `new Image()`/`decode()` in flight | Synchronization: DOM results live in the browser cache; a loader-scene swap cannot stale them, so the load must commit, not reject | Timing boundary | `ensureLoaded` resolves; `isResourceLoaded(key) === true` | Unit | High — this was the confirmed defect; now covered by `first entry: loader registering mid-DOM-load must not fail the ensure` |
| INV-DOM-2 | `loadedResources`/`inFlightLoads` after swap | DOM key committed pre-swap is cleared by `setLoaderScene`; next `ensureLoaded` re-runs | Recoverability/idempotency: cleared record re-loads from browser cache; no stuck "neither loaded nor loadable" key | Repeat | re-`ensureLoaded` resolves and marks the bundle loaded | Unit | Medium — dedup map and record set are cleared together; fresh `loadSingleDomImage` re-registers both (verified by inspection; reload is a cache hit) |
| INV-DOM-3 | Phaser batch bound to old loader scene | swap mid-`loadDescriptors` | Stale state: old-generation Phaser keys must not publish into the new texture cache | Stale state | `ensureLoaded` rejects `superseded`; `isLoaded` false | Unit | High — unchanged fence; covered by updated `loader swap mid-DOM-load` test asserting Phaser rejection while DOM keys commit |
| INV-DOM-4 | `inFlightLoads` entry identity | swap clears map; new same-key load starts; old continuation resolves | Exactly-once: old continuation must not delete the new generation's in-flight entry | Repeat | identity-guarded `inFlightLoads.delete` | Unit | Medium — pre-existing identity guard, unchanged by this diff |
| INV-DOM-5 | dispose during in-flight DOM load | `dispose()` while `domImageLoader` pending | Boundedness: resolving into a disposed manager is unreachable state | Interruption | manager discarded; `ensureLoaded` post-dispose throws `disposed` | Unit | Low — DOM path now commits the record into a dead instance; no live consumer reads it |
| INV-ERR-1 | `error.failedRequest.target` pin | `retry()` on a failed game route while curtain closes | Lifecycle: stage must stay on the failed game target through `closing` so `GameRoot`/`PhaserCanvas` (the Phaser host) is not unmounted and destroyed mid-retry | Interruption | during deferred `curtain.close`: `phase === 'closing'` AND `error.failedRequest.target === 'home'` | Unit | High — covered by new test `retry keeps the failure record pinned until the curtain is closed` |
| INV-ERR-2 | stale error during a fresh `request()` | non-retry transition reaches `loading` | Monotonicity: a committed transition drops the stale failure once `targetRoute` takes over as the stage pin | Stale state | `error === null` after curtain close resolves | Unit | Medium — strictly better than before (previously only `retry()`/back cleared it) |
| INV-ERR-3 | retry fails before step 3 (e.g. curtain close timeout, `behindCurtain` reject, hold failure) | catch path | Recoverability: the new failure overwrites `error` with the current `failedRequest`; pin never points at a dead transition | Interruption | `phase = 'failed'`; `error = { failedRequest: preparedRequest, message }` (lines 519-523) | Inspection | High — resolved by code read: catch assigns `this.error` unconditionally on any throw |
| INV-ERR-4 | `onTransitionBack` from failed combat | `request('home', behindCurtain = abandonBattle)` | Atomicity: `abandonBattle` runs inside the closed curtain; error clears at `loading`, after the curtain covers the prior screen | Interruption | domain teardown ordering preserved; error shell stays mounted through `closing` | Unit + inspection | Medium — `clearError()` removal moves the clear ~3 statements later within the same closed-curtain window; backdrop behavior unchanged |
| INV-ERR-5 | `clearError()` public API | external dismissal without a new transition | Lifecycle: still clears + notifies for non-transition dismissal | Repeat | `error === null`, `notify` called | Unit | Low — API retained; existing test at line 456 still exercises it |
| INV-HOST-1 | Phaser host across a real retry | fail → user clicks Retry | Lifecycle: host is reused, not destroyed and rebuilt (which reopened the cold-boot race) | Repeat | no `setLoaderScene(null)` → re-create cycle on retry | Browser | High — NOT directly exercised live (no failure occurred to retry against); unit evidence for the pin + removal of the dominant failure cause bound the residual |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/presentation/GamePresentationCoordinator.test.ts src/presentation/assets/AssetBundleManager.test.ts` | 41/41 pass; 3 new/updated tests were RED before the fix, GREEN after | intended-reason regression evidence for INV-DOM-1, INV-DOM-3, INV-ERR-1 |
| `npm run type-check` | pass | — |
| `npx vitest run` (full suite) | 594 files / 4715 tests pass, 4 expected-fail | pre-existing expected failures only |
| `npm run build` | pass | chunk-size warning on Phaser bundle, pre-existing |
| Live browser `http://localhost:5175`, fresh entry: guest → create character → talent → allocate → "Bước vào tiên đồ" | reached `home` with in-game UI (`Mở bảng lệnh Động Phủ`, tutorial `Bỏ Qua`/`Tiếp Theo`); 0 console errors; no `superseded`/`timed out` | direct runtime evidence, run 1 |
| Live browser, second full run after reload (`Chơi ngay` → full creation flow) | reached `home`, 0 console errors | direct runtime evidence, run 2; confirms race closure is not a one-off timing win |
| `git diff` review of task-owned files | only intended changes; all temporary `[ABM]`/`[GPC]`/`[PSA]`/`[CRA]`/`[PC]` logs removed (`PhaserSceneAdapter.ts`, `VueRouteAdapter.ts`, `PhaserCanvas.vue` back to HEAD) | confirmed via grep, no matches |

## Findings

None. No `Confirmed`, `Suspected`, or `Coverage gap` findings remain against the task-owned diff.

## New or Changed QA Tests

None authored by this review — the implementation already carries intended-reason regression tests (`first entry: loader registering mid-DOM-load must not fail the ensure`, updated `loader swap mid-DOM-load`, `retry keeps the failure record pinned until the curtain is closed`), each proven RED before the fix.

## Gaps and Residual Risk

- INV-HOST-1 (host reuse on a real retry click) is proven at unit layer only; no live failure was available to retry against after the race fix. Residual is bounded: the stage-pin invariant is unit-tested, and the dominant failure trigger (DOM fence) is removed. A live retry would need a fault-injection hook (e.g. blocking one asset request) that does not exist today — recording as a non-material coverage note rather than a gap blocking the verdict.
- The `Renderer readiness timed out` variant shares the cold-boot window but no independent `prepare` defect was confirmed; the 10s `prepareReady` deadline is unchanged. If it recurs without the asset error, the waiter/scene-ready path deserves its own instrumentation run.

## Pre-existing Failures

- Vue Router warning `R0004: No match found for "/"` on initial load — cosmetic, unrelated.
- Tone.js `AudioContext` autoplay warnings — pre-existing, unrelated.
- 4 expected-fail tests in the full suite per project configuration.
