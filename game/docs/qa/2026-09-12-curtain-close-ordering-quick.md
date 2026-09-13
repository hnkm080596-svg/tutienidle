# QA Review: curtain close ordering on boot transitions + generalized to all scene-to-scene transitions

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `src/composables/useBootFlow.ts`, `src/composables/useBootFlow.test.ts`, `src/presentation/GamePresentationCoordinator.ts`, `src/presentation/GamePresentationCoordinator.test.ts`, `src/presentation/tribulationRouting.test.ts`, `src/composables/useBattleActions.ts`, `src/composables/useTribulation.ts`, `src/App.vue`, `src/components/onboarding/AuthEntryScreen.vue`, `src/components/onboarding/CharacterCreationScreen.vue`, `src/components/game/combat/CombatVictoryPanel.vue`, `src/components/game/combat/CombatDefeatPanel.vue`, `src/components/game/combat/CombatExitConfirmModal.vue`, `src/components/game/combat/CombatExitConfirmModal.test.ts`, `src/components/game/combat/CombatExitConfirmModal.focus.test.ts`, `docs/roadmap.md`

## Scope and Risk Map

User report: pressing "Choi ngay" (guest) swaps the background scene before the
curtain finishes closing; expected order is close curtain -> swap scene ->
open curtain -> restore focus.

Root cause (pre-fix, verified by reading + mutation log): the coordinator
publishes `targetRoute` at transition start, and `useBootFlow.stage` promoted
to the `'game'` branch on that signal immediately, unmounting the entry
screen while the panels were still sliding. Separately, `startSaveLoad` /
`enterGame` cleared/set the boot subphase ahead of the request, so the dark
`LoadingScreen` replaced the auth/character screen instantly at click time -
a second visible swap with no curtain at all.

Fix:
- `stage` only counts `targetRoute` once `phase` is past `closing` (the
  curtain is then opaque); the loader-scene dependency is unaffected because
  `AssetBundleManager.waitForLoaderScene` and `PhaserSceneAdapter.waitForGameReady`
  already wait for the host asynchronously.
- Boot subphases (`loading_save`/`initializing`) no longer map to a screen
  swap; they remain coordinator bookkeeping (snapshot still records them).
  `BootStage` union narrowed accordingly.
- Coordinator clears `bootSubphase` when the target starts mounting
  (executeTransition step 5), replacing the callers' pre-request clears.
- Auth/creation buttons keep their busy state until unmount so the held
  screen still shows feedback during the save load.

Mapper: all task-owned paths returned `unmappedPaths`; manually routed to
`ui-input-lifecycle` + `pinia-phaser-sync` (route/screen lifecycle) and
`save-and-cloud` (boot save load ordering). One-hop consumers inspected:
`App.vue` entry branches, `useAppLifecycle.bootGame`/`persistProgress`
(`entryStage !== 'game'` gate unchanged), `VueRouteAdapter`, RouteMount
witnesses, `AssetBundleManager`, `PhaserSceneAdapter`.

Second pass (generalization): mapper flagged `deepAuditCandidate` with
`save-and-cloud` among the routed domains. Risk confidently bounded without
escalation: the tribulation outcome calls the SAME `TribulationOutcomeService`
methods with the same arguments - only their timing moved into the
closed-curtain window; save shape, persistence writes, and progression rules
are untouched. Combat session lifecycle on exit is unchanged (session ends
via the same domain events; the coordinator never held it for a session-less
`home` request).

Full transition-edge audit (all `coordinator.request` issuers):
- boot -> auth/character/home/error via `useBootFlow` - fixed in pass 1.
- home -> combat / combat -> combat via `runAdmitted` - domain command was
  already inside `behindCurtain`; UI commit runs post-`entered`.
- home -> tribulation via `runAdmitted` - already correct.
- combat -> home via three panels - NOW behind `behindCurtain` through the
  shared `useBattleActions.exitCombatToHome` (single teardown owner).
- tribulation -> home via `checkTribulationOutcomeAction` - outcome work now
  rides `behindCurtain`; tick loop retries a rejected request.
- error -> home via `onTransitionBack` - abandon + `clearError` inside
  `behindCurtain`.
- External session start (`handleSessionStarted`) - the domain command ran
  before presentation observed it; cannot be deferred. Documented limit.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CUR-1 | `useBootFlow.stage` (derived from coordinator snapshot) | `enterGame`/`requireCharacter` while phase = `closing` | Synchronization: mounted screen must not change before the curtain is opaque | Timing boundary | `stage` stays at current route during `closing`; DOM mutation log shows no mount during `curtain=closing` | Vitest + Playwright | High - this was the reported defect |
| INV-CUR-2 | Phaser host mount (GameRoot/PhaserCanvas) vs `ensureFor` | Promote at `loading` instead of transition start | Lifecycle: host must exist before asset load needs it | Reorder | Transition still reaches `idle`/`entered`; `gameRoot` mounts at `phase=loading` while `curtain=closed` | Playwright | High - promotion delay could reintroduce the cold-boot deadlock |
| INV-CUR-3 | Vue-ready witness (RouteMount/CompositeRenderer) | Non-game target (`character`) mounts behind closed curtain | Lifecycle: target screen must mount before commit | Reorder | `creation=true` appears at `awaiting-ready` with `curtain=closed`; stage `character` after mount | Vitest + Playwright | Medium |
| INV-CUR-4 | `bootSubphase` ownership | Subphase cleared when target mounts, not before request | Synchronization: no pre-curtain stage flip | Timing boundary | `snapshot.bootSubphase` non-null during `closing`, null after mount | Vitest | Medium |
| INV-CUR-5 | Failed game transition | `prepare` throws -> `failed` phase | Recoverability: game host stays mounted for retry | Interruption | Existing test: `stage` stays `game` via `error.failedRequest` path | Vitest (existing, still green) | Medium |
| INV-CUR-6 | Demotion home->auth | Leaving a game route | Lifecycle: host stays until route actually changes | Reorder | `GAME_ROUTES.has(route)` keeps `game` through `closing`; demotes at `renderRoute` | Code inspection (unchanged path) | Low |
| INV-CUR-7 | Auth/creation busy state | Successful auth/create then save load | Lifecycle: feedback persists; double-submit still blocked | Repeat | `submitting`/`creating` stay true until unmount; overlay locks input during transition anyway | Code inspection | Low - residual: a `rejected` request would leave the button disabled (unreachable from this screen in practice) |
| INV-CUR-8 | `persistProgress` gate | `entryStage` during save load now `auth` not `loading_save` | Conservation: autosave stays gated outside game | Value mutation | `entryStage !== 'game'` still blocks persist during boot | Code inspection | Low |
| INV-CUR-9 | combat->home teardown (abandon, `battleRunMode`, `combatSceneDismissed`, `combat_scene_exit`) | Victory "Tiep Tuc", defeat "Ve Dong Phu", exit-confirm "Thoat Tran", 10s auto-return | Synchronization: nothing visible changes before the curtain is opaque | Timing boundary | Coordinator call-log proves work runs strictly between `curtain.close` and `curtain.open`; panel screens stay mounted through `closing` | Vitest (new) + fallback-sync component tests | High - same defect class as the boot report |
| INV-CUR-10 | tribulation outcome resolution (realm/penalty writes, announcement, `standalonePanel`, `exitTribulationScene`) | `checkTribulationOutcomeAction` per-tick once state is terminal | Synchronization + exactly-once: outcome applies once, behind the curtain | Timing boundary / repeat | Deferred apply inside `behindCurtain`; rejected request leaves outcome pending for next tick; duplicate in-flight calls share one request | Vitest (updated tribulationRouting) | High - outcome writes are progression-affecting |
| INV-CUR-11 | `isUnchanged` short-circuit | Request with `behindCurtain` whose target === currentRoute | Conservation: pending domain work must still execute | Reorder | Same-route behindCurtain request runs a full transition (close -> work -> open) | Vitest (new) | Medium |
| INV-CUR-12 | session adoption at step 2b | `behindCurtain` on non-session target | Conservation: teardown work must not be forced to produce a session | Value mutation | `home`+behindCurtain enters without a session; combat/tribulation still require the produced session | Vitest (new) | Medium |
| INV-CUR-13 | error-shell dismissal | `onTransitionBack` (failed transition) | Synchronization: error shell stays mounted until the curtain covers | Timing boundary | `abandonBattle` (failed combat) + `clearError` run inside `behindCurtain` | Code inspection + error-recovery e2e | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | 0 errors |
| `npx vitest run src/composables/useBootFlow.test.ts src/presentation/GamePresentationCoordinator.test.ts src/composables/useAppLifecycle.test.ts` | PASS | 43 tests |
| `npx vitest run src/presentation src/composables ...` (broader sweep) | PASS | 43 files / 276 tests |
| `npx playwright test tests/e2e/boot-fresh.spec.ts tests/e2e/presentation-routing.spec.ts` | PASS | 2 tests incl. F01 scene-activation oracle |
| `npx playwright test tests/e2e/save-reload.spec.ts` | PASS | returning-player reauth path |
| Ad-hoc Playwright mutation log (scratch spec, deleted) | PASS | Full log: `closing` entries show `auth=true`/`creation=true` with no mount change; `gameRoot=true` first appears at `phase=loading curtain=closed`; `creation=true` at `awaiting-ready curtain=closed` |
| `npx vitest run` broader sweep (worktree) | PASS | 71 files / 420 tests incl. new coordinator ordering tests |
| `npx playwright test` presentation-routing + boot-fresh + create-to-combat + error-recovery | PASS | 5 tests; create-to-combat covers entry -> battle -> result end-to-end |
| `GamePresentationCoordinator.test.ts` new cases | PASS | behindCurtain on `home` runs strictly between close/open with no session; same-route behindCurtain is never 'unchanged' |

## Findings

None confirmed. Residual low-severity notes:

- If `coordinator.request({target:'home'})` were ever `rejected` while the
  auth screen is displayed (requires a conflicting in-flight transition, not
  reachable from this screen through normal UI), the guest/login buttons
  would stay in their busy state. Overlay input locking and the
  `bootInFlight` guard make this practically unreachable; classified as
  Suspected/low, no reproduction produced.
- `bootSubphase` is now write-mostly bookkeeping: `stage` no longer reads
  it, but the coordinator snapshot still reports boot progress and clears it
  at target mount. Full removal would touch the snapshot contract
  (`PresentationContracts`, adapters, lifecycle call sites) - out of scope.
- `retry()` still rejects a failed request that carried `behindCurtain` on a
  non-session target (the "never re-issue a domain command" contract). For a
  failed combat->home exit, the error shell's Back button issues a fresh
  request whose own teardown is idempotent, so the path stays recoverable;
  the Retry button is a no-op on that specific failure. Suspected/low -
  rare path (transition must fail AFTER teardown ran).
- `confirmExit` no longer refuses when `abandonBattle()` returns false:
  false means "no live battle to abandon" (it already ended mid-close), so
  the exit intent still stands. Deliberate behavior change on an edge that
  previously left the modal up with no feedback.
- Tribulation outcome while the ENTRY transition is still in-flight:
  the home request is rejected, the outcome stays pending, and the next
  `App.vue` tick re-issues it. Verified via the updated
  `tribulationRouting` test which now settles entry first - this is the
  designed retry path, not a leak.

## New or Changed QA Tests

- `src/composables/useBootFlow.test.ts` (modified): asserts no game-branch
  promotion during `closing`, current-screen retention for a non-game target
  through the close animation, `bootSubphase` cleared at target mount, and
  updated bootstrap-stage expectations for the subphase-as-bookkeeping
  contract.
- Scratch Playwright spec used for the runtime mutation log was deleted
  after verification per P14 cleanup; assertions are covered by the unit
  tests above plus existing e2e specs.

## Gaps and Residual Risk

- No automated persistent spec asserts "no visible swap during closing" at
  the DOM level; evidence is the unit gate + one-off browser log. A durable
  e2e assertion could be added later if the ordering regresses again.
- Reduced-motion path resolves the curtain on nextTick; ordering invariant
  is phase-based so it holds there too (not separately exercised in
  browser).

## Pre-existing Failures

None observed.
