# QA Review: BETA-FINAL PR5 — online admission / reconnect / authorized offline accrual / result-bearing quit flush

- Date: 2026-09-29
- Mode: quick
- Verdict: PASS WITH EVIDENCE (with one resolved Confirmed finding)
- Task-owned paths: `src/services/session/OnlineSessionController.ts`, `src/services/session/reconnectPipeline.ts`, `src/shared/session/FlushResult.ts`, `src/composables/useAppLifecycle.ts`, `src/composables/useElectronBridge.ts`, `src/composables/useOnlineAuthority.ts`, `src/main-process/quitFlush.ts`, `electron/main.ts`, `electron/preload.ts`, `src/services/cloudSave/{CloudSaveService,CloudSaveCoordinator,SupabaseCloudSaveService}.ts`, `src/services/save/{SaveSystem,saveTypes}.ts`, `src/services/supabase/SupabaseSession.ts`, `src/stores/player.ts`, `src/core/battle/turn/CombatClock.ts`, `src/core/game/{GameManagerSaveRestore,GameManagerAutoFarmOps}.ts`, `src/core/presentation/OverlayLayers.ts`, `src/App.vue`, `src/components/panels/SettingsPanel.vue`, `src/locales/{en,vi}.json`, `playwright.beta.config.ts`, `tests/e2e/beta-authority.spec.ts`, plus the new/edited `*.test.ts` files.

## Scope and Risk Map

Mapper output: domains `combat-and-tribulation`, `pinia-phaser-sync`, `save-and-cloud`, `ui-input-lifecycle`; `deepAuditCandidate: true` ("critical state boundary: save-and-cloud", "cross-system change: 4 domains"). 9 task-owned `unmappedPaths` were manually routed by code inspection: `OnlineSessionController.ts`/`reconnectPipeline.ts`/`FlushResult.ts` → save-and-cloud authority owner; `useAppLifecycle.ts`/`useElectronBridge.ts`/`quitFlush.ts`/`preload.ts` → ui-input-lifecycle + save-and-cloud; `GameManagerSaveRestore.ts`/`GameManagerAutoFarmOps.ts` → time-and-offline (loaded in addition to the mapper's four packs). Escalation considered per quick-review mandatory rules: the change does touch save/cloud consistency, clock/offline accrual ownership, and Vue/Pinia/Phaser lifecycle — those are exactly the PR5 scope itself; every high-risk hypothesis below received a conclusive oracle at unit level or documented bound, so the quick ledger resolves them rather than converting the whole task to deep. Residual material risk that quick mode cannot oracle (real-staging heartbeat/revoke timing and Electron IPC) is listed as evidence gap, not a hidden pass.

Exclusions: none — every dirty path is task-owned.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-A1 | `GameClock.previousTime` / lifecycle resume | authority resume re-anchors live clock | paused window discarded; `tickDeltaOnResume <= normalTickDelta` | timing boundary | `clock.start()` resets `previousTime = now` (GameClock.ts:101-105); resumeSimulation calls `clock.start()` before re-arming intervals | unit + source | High — catch-up theft on resume | Resolved: re-anchor proven |
| INV-A2 | `CombatClock` reasons | `freeze('authority-pause')` during pause | paused combat delta discarded, per-reason resume | repeat/timing | new test: 100 steps of source time emit 0 while frozen, 1 after resume | unit | High | PASS (CombatClock.test.ts) |
| INV-A3 | controller `generation` | heartbeat/reconnect resolves after suspend/pause/acknowledge | stale continuations never admit | interruption/stale | generation captured before every `await`; `!==` check before transition | unit | High | PASS (OnlineSessionController.test.ts) |
| INV-A4 | `.authority-overlay` vs focused control | Enter/Tab on a stale-focused button behind overlay | no mutation path while overlay visible | keyboard bypass | DOM overlay blocks pointer only — keyboard activation of a pre-focused control bypassed it → **fixed via `inert` on every sibling surface** | source | High | FIXED (QA-2026-09-29-PR5-1) |
| INV-A5 | `simPaused` latch | terminal during boot admission (`entryStage !== 'game'`) | a pause of a non-live sim must not latch; next live pause must apply | reorder | `pauseSimulation` early-returned only on `simPaused` — a boot-time terminal latched it, so the next real pause skipped `clock.stop()`/`freezeCombat` → combat kept stepping under blocked admission → **fixed via `entryStage === 'game'` guard** | unit repro | High | FIXED (QA-2026-09-29-PR5-2) |
| INV-A6 | `observeSaveResult` in local-only mode | failed local write (quota/IO) | local write failure is the caller's error surface, not an authority transition | degraded env | with no `reconnect` dep, `pause()` armed nothing → permanent 'reconnecting' overlay → **fixed: non-ok results no-op without remote authority** | unit repro | High | FIXED (QA-2026-09-29-PR5-3) |
| INV-A7 | quit flush request/generation/sender binding | forged sender / late ACK / timeout / retry quoting stale id | only a 'saved' bound to the PENDING attempt + window sender closes | forged/replay/timing | quitFlush.test.ts 10 cases: mismatched requestId ignored, foreign sender ignored, timeout never closes, retry quotes failed id, double-close blocked | unit | High | PASS |
| INV-A8 | reconnect pipeline order | refresh → heartbeat → load → lineage compare | spec order; 'replaced' hands payload + server clock for zero-accrual restore | reorder | reconnectPipeline.test.ts asserts `['refresh','heartbeat','load']`, short-circuits, terminal mapping | unit | High | PASS |
| INV-A9 | cold-boot authorized window | `restoreGameSession(player, manager, save, {cold-boot, sinceMs: cutoff, untilMs: serverNow})` | owners consume the window; a T0 pending save retried at T1 accrues T0..T1 (R12) | stale state | SaveSystem.timeAuthority.test.ts: cutoff-bounded window beats stale payload age; live-replacement grants 0 | unit | High | PASS |
| INV-A10 | post-accrual durability leg | commit `player.save` before `markReady`/`clock.start` | `coldBootTickCountBeforeAccrualAck === 0` | ordering | lifecycle test: save invoked before clock.start; non-ok commit fails boot, no markReady | unit | High | PASS |
| INV-A11 | mutation gate vs drivers | every autonomous driver + manual persist while `canMutate() === false` | domain snapshot unchanged | repeat/late callbacks | production-composition test: tick/autosave/manual-persist fire while blocked → `{cultivation, persisted, combatSteps}` unchanged | unit | High | PASS |
| INV-A12 | save-outcome observation | every `player.save` callsite reports to the authority | one observed write surface | ungated caller | SettingsPanel handleSave/handleExport bypassed → **fixed via `observeAuthoritySaveResult` facade**; electronBridge local-mode fallback unobserved (see finding 4) | source | Medium | PARTIAL (QA-2026-09-29-PR5-4) |
| INV-A13 | overlay stacking | authority surface vs curtain/panels | one z-scale owner | layering | hardcoded `z-index: 1900` replaced by `OVERLAY_LAYERS.authority = 1950` (above gameplay modals, under appError/saveGate/curtain per contract) | source | Low | FIXED |
| INV-A14 | single-flight refresh | parallel refresh calls / transient failure / stale generation | one in-flight; transient keeps credential; cleared session never resurrected | concurrency/stale | SupabaseSession.test.ts: 3 parallel → 1 call; 5xx/throw retain refresh token; generation guard | unit | High | PASS |
| INV-A15 | `markFailed` from 'ready' (defensive) | markFailed on live state | no silent stuck state | unreachable-path | markFailed's 'reconnecting' branch does not arm retry — unreachable in real flow (boot-only caller); documented | source | Low | Non-finding (bounded) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/services/session src/composables/useAppLifecycle.test.ts src/composables/useElectronBridge.test.ts src/main-process/quitFlush.test.ts src/services/save src/stores/player.restoreFromSave.test.ts src/core/game/GameManagerSaveRestore src/core/idle` | 28 files / 720 tests green (pre-QA-fix count; post-fix scoped re-runs below) | deterministic injected scheduler/monotonic clock |
| post-fix `npx vitest run` over session/lifecycle/quitFlush/electronBridge/save/supabase/idle scopes | 80 + 655 + 59 + 4 tests green | QA fixes included |
| `npm run type-check` | green after QA fixes | `inert` binding, OverlayLayers, useOnlineAuthority compile |
| `npm run verify` (full build + suite) | PASS — type-check + vite build + vitest 823 files / 7422 tests green (5 expected-fail, 1 skipped) | run post-fix on the final state |
| `npm run test:supabase` | **Not verified** — `/home/ubuntu/.secrets/supabase.env` absent on this box; `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_DB_URL` unavailable | staging evidence gap; spec fails nonzero by convention when env is absent |
| `npx playwright test --config playwright.beta.config.ts` | **Not verified** — same env gap (spec requires live staging heartbeat) | spec authored; never run green |
| Real Electron quit/suspend IPC | **Not verified** — browser-based run only; native powerMonitor/close events need the Electron shell | plan itself requires "real Electron clock/quit proof"; unit-level protocol proven, shell-level pending |

## Findings

### QA-2026-09-29-PR5-1: keyboard path bypassed the authority overlay
- Severity: High → resolved (fixed)
- Status: Confirmed (source proof + DOM semantics; no runtime needed — a `keydown` on a focused element reaches it regardless of overlay coverage)
- Invariant: INV-A4 — no mutation path while overlay visible (spec §9)
- Preconditions: player had a focused button inside a panel when authority dropped
- Reproduction: focus a mutating button, force 'reconnecting', dispatch `keydown Enter` — the control still activates
- Expected: no interaction reaches behind-overlay controls
- Actual: pointer blocked by overlay element; keyboard activation of the stale-focused element was not
- Evidence: overlay carried no focus management; fixed by `inert` on GameRoot/CombatPauseOverlay/PresentationTransitionOverlay bound to `authorityOverlayActive` (App.vue:533-540, 934, 942, 948)
- Test file: none added (DOM `inert` semantic; overlay visibility covered by beta e2e spec pending staging env)
- Owner subsystem: ui-input-lifecycle
- Blast radius: any focused mutator during reconnect/terminal — domain mutation under blocked admission

### QA-2026-09-29-PR5-2: stale `simPaused` latch swallowed the next live pause
- Severity: High → resolved (fixed)
- Status: Confirmed (failing reproduction test that fails for the intended reason before the fix, green after)
- Invariant: INV-A5 — pause of a live sim must apply
- Preconditions: `markFailed`/terminal during boot admission (`entryStage !== 'game'`) → `onPause('terminal')` → `pauseSimulation` latched `simPaused = true`
- Reproduction: `useAppLifecycle.test.ts` — "a terminal during boot does not latch simPaused - the next live pause still applies"
- Expected: pre-boot pause is a no-op; later live pause stops the clock + freezes combat
- Actual: `simPaused` stuck true → later `pauseSimulation()` early-returned → intervals kept firing, `clock.stop()`/`freezeCombat('authority-pause')` never ran → combat clock could keep stepping under blocked admission and the wall clock would have paid the paused delta at the next admitted tick
- Evidence: reproduction test added pre-fix (red), fix `entryStage.value !== 'game'` guard (useAppLifecycle.ts:236), re-run green
- Test file: `src/composables/useAppLifecycle.test.ts`
- Owner subsystem: ui-input-lifecycle / save-and-cloud
- Blast radius: combat + accrual mutation under blocked admission after any boot-time terminal

### QA-2026-09-29-PR5-3: failed local-mode save parked the authority in 'reconnecting' forever
- Severity: Medium → resolved (fixed)
- Status: Confirmed (failing-path reasoning + new unit repro)
- Invariant: INV-A6 — local write failures are the caller's error surface
- Preconditions: local-only mode (`reconnect`/`probe` deps undefined); any `player.save` returning non-ok (quota, serialization throw)
- Reproduction: `OnlineSessionController.test.ts` — "a failed save in local-only mode is not an admission transition"
- Expected: no admission transition in local mode
- Actual: `observeSaveResult` non-ok → `pause('save-failed')` → 'reconnecting'; with `deps.reconnect` undefined neither `armRetry` nor `attemptReconnect` ran → permanent blocking overlay whose only escape was the give-up acknowledge → wrongful sign-out pressure in local mode
- Evidence: guard `if (!this.deps.reconnect) return` on the failure branch (OnlineSessionController.ts:269-273); 'ok' renewal stays unconditional (harmless)
- Test file: `src/services/session/OnlineSessionController.test.ts`
- Owner subsystem: save-and-cloud
- Blast radius: every local-mode save failure — including the previously unobserved SettingsPanel saves wired by finding 4 — would have wedged the session

### QA-2026-09-29-PR5-4: two save callsites bypassed the admission observer
- Severity: Medium → resolved (fixed)
- Status: Confirmed (source proof: `player.save` callsites lacking `observeSaveResult`)
- Invariant: INV-A12 — every save outcome reports to the authority
- Preconditions: `SettingsPanel.handleSave` / `handleExport` called `player.save(gameManager)` directly
- Expected: all writes renew the lease or trigger pause/terminal
- Actual: silent bypass — a remote write failure from settings never reached `observeSaveResult`
- Evidence: `useOnlineAuthority.ts` lazy-bound facade added; App.vue binds the instance (`bindOnlineAuthority`), persistPlayer delegates to `observeAuthoritySaveResult`, both panel callsites now report
- Test file: none added (binding wiring; behavior covered by controller tests)
- Owner subsystem: save-and-cloud
- Blast radius: unobserved write failure → stale lease accounting
- Note: `useElectronBridge`'s local-mode fallback flush (`handlers.flush` absent) writes through `player.save` without reporting — acceptable by design: the absent `handlers.flush` implies local-only mode, where observation is a documented no-op after finding 3's fix. Bounded non-finding.

### QA-2026-09-29-PR5-5: hardcoded overlay z-index violated the single-scale rule
- Severity: Low → resolved (fixed)
- Status: Confirmed (source)
- Invariant: INV-A13 / A2 constitution — app-scope z-index only via `OVERLAY_LAYERS`
- Evidence: `OVERLAY_LAYERS.authority = 1950` added (above gameplay modals, below appError/saveGate/curtain); all three overlays bind it inline
- Owner subsystem: ui-input-lifecycle

## New or Changed QA Tests

- `src/composables/useAppLifecycle.test.ts` — pause-latch reproduction (INV-A5) + production-composition blocked-driver snapshot (INV-A11)
- `src/services/session/OnlineSessionController.test.ts` — local-only observeSaveResult reproduction (INV-A6)
- `src/core/battle/turn/CombatClock.test.ts` — 'authority-pause' freeze/resume (INV-A2)

## Gaps and Residual Risk

- **Staging run absent**: `npm run test:supabase` and `playwright.beta.config.ts` spec require `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_DB_URL`; `/home/ubuntu/.secrets/supabase.env` does not exist on this box. The e2e spec fails nonzero without env per fixture convention — never a skip-pass. Evidence kind for the live-path claims is therefore static + unit, not live.
- **Native Electron quit/suspend**: protocol proven at unit level (`quitFlush.test.ts`, `useElectronBridge.test.ts`); the real `powerMonitor`/`close` events were not exercised in a packaged Electron shell.
- **INV-A15 documented**: `markFailed` mapped-'reconnecting' doesn't arm retry; unreachable in the real flow (boot-only caller, controller is in 'checking' there). Recorded as bounded non-finding, not silently dropped.

## Pre-existing Failures

None observed in scoped runs.
