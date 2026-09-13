# Combat Real-Time / Turn Authority Implementation Plan

> **SUPERSEDED by `2026-09-10-combat-turn-mechanism.md`.** That plan absorbs
> Tasks 1-3 of this one verbatim and rebuilds the rest on the `TurnToken` state
> machine and the resolution pipeline. Do not execute this plan. It is kept only
> as the record of how the work was scoped before the turn mechanism spec
> existed.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give combat its own self-counting clock, make turn order structurally
one-at-a-time, and make every scene change happen behind a fully closed curtain.

**Architecture:** A new `CombatClock` counts from its own render-cadence source,
stops only while the battle is off screen, and never exchanges time with the
world tick. Holding the gauge during a turn is the gauge's own rule, kept in the
gauge — the clock is never told about turns. The turn engine stops being polled
by `GameManager.update()` and is instead advanced by that clock, with each turn
terminated by Phaser's existing three-step acknowledgement. The presentation
coordinator gains a closed-curtain work window so domain commands with visible
effects can no longer run in front of the player.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser 4, Playwright.

**Spec:** `game/docs/superpowers/specs/2026-09-10-combat-realtime-turn-authority-design.md`

## Global Constraints

- **All paths are relative to `game/`.** Run every command from `game/`.
- **P3 verification.** `quick` = `npm run type-check` + `npx vitest run <scope>`.
  `full` = `npm run type-check` + `npm run build` + `npx vitest run`. Tasks 5, 6
  and 8 require `full` (Phaser scene infra / driving paths / architecture).
- **P13 runtime wiring.** Tasks 3, 5, 6, 7 change wiring or driving paths. Unit
  tests are not sufficient evidence; run the relevant Playwright spec and drive
  the behaviour. "Nothing happens, no error" means suspect wiring first.
- **P14 browser verification.** Tasks 6, 7 change what is on screen. Verify in a
  real browser via `playwright-cli`, read the printed dev port, prefer Edge.
- **P5 code review.** Run `code-review` after simplification, before declaring
  any task with ≥5 changed production lines complete. Resolve findings ≥80.
- **P7 no commits without authorization.** Each task ends with a prepared commit
  command. **Do not run it until the user authorizes.** Show the staged diff and
  the message, then wait.
- **P8 no new `any`.** If one is unavoidable, flag it in the task summary.
- **A step is `COMBAT_STEP_SECONDS = 0.1`.** Inside combat, durations are in
  steps. The pre-battle countdown display is the only place that may express
  seconds (spec §4.3).
- **Vocabulary is enforced.** `tick` belongs to the world clock; `advance` and
  `step` belong to `CombatClock`. `tick` on a combat-time path is a defect.
- **No catch-up in combat, ever.** No ceiling, no clamp, no banking (spec A10).
- **A freeze is data, never a paused scene (spec A7 / §5.2a).** Character
  animation runs on Phaser's own loop and must keep playing through every
  freeze, pause and manual wait. Never call `scene.pause()`,
  `scene.scene.pause()`, `anims.pauseAll()`, or assign `anims.paused` to express
  a battle-state freeze. Skill VFX starting and stopping is normal — they are
  episodic; character animation stopping is a defect.

---

## File Structure

**Created:**

- `src/core/battle/turn/CombatClock.ts` — the clock, the freeze-reason set, the
  `ClockSource` interface, `ManualClockSource`. Pure; no DOM.
- `src/core/battle/turn/CombatClock.test.ts`
- `src/presentation/clock/RafClockSource.ts` — the production source. DOM-aware,
  so it lives outside `core/`.
- `src/presentation/clock/RafClockSource.test.ts`
- `src/composables/useCombatPause.ts` — visibility → freeze, Continue → resume.
- `src/composables/useCombatPause.test.ts`
- `src/components/game/combat/CombatPauseOverlay.vue` — the pause overlay. Not
  the curtain; separate owner, separate layer (spec §6.1).
- `src/components/game/combat/CombatPauseOverlay.test.ts`
- `src/core/game/GameManagerTurnBattleOps.combatClock.test.ts` — clock integration.
- `src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts` — §10 law.
- `src/core/game/GameManager.cooldownAuthority.test.ts` — RC-5 characterization.
- `src/core/game/CombatTimeClassification.test.ts` — the §5 parity test.
- `src/presentation/bindPresentationActive.ts` — the single owner of
  `presentationActive` (spec §8).

**Modified:**

- `src/components/game/PresentationTransitionOverlay.vue` — curtain symmetry.
- `src/presentation/GamePresentationCoordinator.ts` — closed-curtain work window.
- `src/presentation/createGamePresentation.ts` — command moves into the window.
- `src/presentation/PresentationContracts.ts` — the window's type.
- `src/core/battle/turn/CombatAnimationRuntime.ts` — `isTurnInFlight()` plus a
  change notification.
- `src/core/game/GameManagerTurnBattleOps.ts` — owns the clock; combat leaves
  `updateBattleFixedStep`.
- `src/core/game/GameManager.ts` — clock source setter, freeze/resume facade,
  removal of the seconds cooldown call.
- `src/App.vue` — installs `RafClockSource`, owns `presentationActive`, mounts
  the pause overlay.
- `src/game/scenes/CombatScene.ts` — `update(time, delta)` interpolates the
  telegraph.

---

## Task 1: Curtain reopen must always animate (RC-2)

**Files:**
- Modify: `src/components/game/PresentationTransitionOverlay.vue:68-130`
- Test: `src/components/game/PresentationTransitionOverlay.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: no API change. `close(id, signal)` and `open(id, signal)` keep their
  signatures; only their settling behaviour changes.

- [ ] **Step 1: Write the failing test**

Add to `src/components/game/PresentationTransitionOverlay.test.ts`:

```ts
it('resolves immediately when the panels already sit at the requested state', async () => {
  vi.useFakeTimers()
  const { instance, unmount } = mountOverlay()

  try {
    // Never closed, so the panels are already at the open transform. A naive
    // implementation arms a transitionend that can never fire and only settles
    // via the 600ms safety timeout.
    let settled = false
    const controller = new AbortController()
    const promise = instance.open(1, controller.signal).then(() => {
      settled = true
    })

    await nextTick()
    await nextTick()

    expect(settled).toBe(true)
    expect(instance.curtainState.value).toBe('opened')

    await promise
  } finally {
    vi.useRealTimers()
    unmount()
  }
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/components/game/PresentationTransitionOverlay.test.ts -t "already sit at the requested state"`

Expected: FAIL — `settled` is still `false`, because the promise is waiting on
the 600 ms safety timeout that fake timers never advance.

- [ ] **Step 3: Implement the guard**

In `animateCurtain`, immediately after the reduced-motion branch, add:

```ts
  // A curtain state whose settled transform equals the current transform fires
  // no transition, so no `transitionend` ever arrives and the promise would
  // settle only via the safety timeout, with nothing animated. Resolve now
  // instead of pretending an animation ran.
  const settled = state === 'closing' ? 'closed' : 'opened'

  if (curtainState.value === settled) {
    return nextTick()
  }
```

- [ ] **Step 4: Run the whole overlay suite**

Run: `npx vitest run src/components/game/PresentationTransitionOverlay.test.ts`
Expected: PASS, including the pre-existing reduced-motion and abort tests.

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 6: Prepare the commit (do not run without authorization)**

```bash
git add src/components/game/PresentationTransitionOverlay.vue src/components/game/PresentationTransitionOverlay.test.ts
git commit -m "fix(presentation): curtain open always animates or resolves honestly

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Closed-curtain work window (RC-1)

The domain command currently runs before the transition starts, so a
`combat -> combat` refight resets the battle in full view. Move its execution
inside the transition, after the curtain has closed.

**Files:**
- Modify: `src/presentation/PresentationContracts.ts`
- Modify: `src/presentation/GamePresentationCoordinator.ts:247-330`
- Modify: `src/presentation/createGamePresentation.ts:95-160`
- Test: `src/presentation/GamePresentationCoordinator.test.ts`

**Interfaces:**
- Consumes: `RouteRequest`, `TransitionResult`, `CurtainPort` from Task 0 code.
- Produces:
  - `RouteRequest` gains an optional `behindCurtain?: () => boolean` — run after
    the curtain closes; returning `false` fails the transition.
  - `runAdmitted(target, command, options?)` keeps its signature. `command` is
    no longer invoked before `coordinator.request`; it is passed through as
    `behindCurtain`.

- [ ] **Step 1: Write the failing coordinator test**

Add to `src/presentation/GamePresentationCoordinator.test.ts`:

```ts
it('runs behindCurtain only after the curtain has fully closed', async () => {
  const order: string[] = []
  const curtain = {
    close: async () => { order.push('curtain-closed') },
    open: async () => { order.push('curtain-opened') },
  }
  const coordinator = makeCoordinator({ curtain, initialRoute: 'home' })

  const result = await coordinator.request({
    target: 'combat',
    session: { kind: 'combat', sessionId: 1 },
    behindCurtain: () => { order.push('domain-command'); return true },
  })

  expect(result.status).toBe('entered')
  expect(order).toEqual(['curtain-closed', 'domain-command', 'curtain-opened'])
})

it('fails the transition when behindCurtain returns false', async () => {
  const coordinator = makeCoordinator({ initialRoute: 'home' })

  const result = await coordinator.request({
    target: 'combat',
    session: { kind: 'combat', sessionId: 1 },
    behindCurtain: () => false,
  })

  expect(result.status).toBe('failed')
})
```

Use whatever factory the existing file already uses to build a coordinator; if it
has no `makeCoordinator`, follow the construction style of the tests already in
that file and keep the assertions identical.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/presentation/GamePresentationCoordinator.test.ts -t "behindCurtain"`
Expected: FAIL — `behindCurtain` is not a known property and is never called.

- [ ] **Step 3: Add the field to the contract**

In `src/presentation/PresentationContracts.ts`, add to `RouteRequest`:

```ts
  /**
   * Domain work with visible effect, executed inside the closed-curtain window
   * (spec RC-1). Runs after the curtain is fully closed and before the target
   * is revealed. Returning false fails the transition.
   */
  behindCurtain?: () => boolean
```

- [ ] **Step 4: Execute it inside the window**

In `GamePresentationCoordinator.executeTransition`, immediately after the
`await this.withTimeout(this.curtain.close(...))` block and its
`this.checkAborted(signal)`:

```ts
      // Closed-curtain work window (spec RC-1). A refight is a combat -> combat
      // transition against a renderer that is already live, so the reset must
      // happen here - never before the curtain covered it.
      if (request.behindCurtain && !request.behindCurtain()) {
        throw new Error('Domain command rejected inside the closed-curtain window')
      }
```

- [ ] **Step 5: Stop running the command early**

In `createGamePresentation.runAdmitted`, delete the `request = command()` block
and everything that depended on having a request before `coordinator.request`.
Replace the body between the `canEnter` guard and the `coordinator.request` call
with:

```ts
    isAdmitting = true
    let accepted: RouteRequest | null = null

    const behindCurtain = (): boolean => {
      try {
        accepted = command()
      } catch {
        accepted = null
      }

      if (accepted && 'session' in accepted && accepted.session) {
        reservedSessionId = accepted.session.sessionId
        handledSessionIds.add(accepted.session.sessionId)
      }

      return accepted !== null
    }

    let result: TransitionResult
    try {
      result = await coordinator.request({ target, behindCurtain } as RouteRequest)
    } finally {
      isAdmitting = false
      reservedSessionId = null
    }

    if (result.status === 'rejected' && accepted) {
      forgetSession(accepted)
      options.compensate?.()
    }

    return result
```

- [ ] **Step 6: Handle the session identity the request no longer carries**

`isValidRequest` requires a session for `combat`/`tribulation`, but the session
now only exists after `behindCurtain` runs. Relax the check to accept a request
that carries `behindCurtain`, and re-validate after the window:

In `isValidRequest`, before the session check:

```ts
    // A behindCurtain request produces its session inside the window, so its
    // identity cannot be validated up front. It is validated after the window.
    if (request.behindCurtain) {
      return true
    }
```

In `executeTransition`, immediately after the `behindCurtain` call added in
Step 4, adopt the session the command produced:

```ts
      if (request.behindCurtain) {
        const produced = this.sessionPort.getCurrentSession()

        if (!produced || produced.kind !== request.target) {
          throw new Error('Domain command produced no session for the target route')
        }

        this.targetSession = produced
        holdToken = this.sessionPort.hold(produced)

        if (!holdToken) {
          throw new Error(`Failed to acquire hold for session ${produced.sessionId}`)
        }
      }
```

- [ ] **Step 7: Run the presentation suite**

Run: `npx vitest run src/presentation/`
Expected: PASS. If a pre-existing test asserted that the command runs before the
request, update it — that assertion is the defect this task removes, and say so
in the commit body.

- [ ] **Step 8: Run the battle-action suite**

Run: `npx vitest run src/composables/useBattleActions.test.ts src/core/game/`
Expected: PASS.

- [ ] **Step 9: Full verification (P3 full — architecture change)**

Run: `npm run type-check && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 10: Runtime wiring evidence (P13)**

Run: `npx playwright test tests/e2e/presentation-routing.spec.ts --workers=1`
Expected: PASS. This spec is the F01 oracle and must stay green.

- [ ] **Step 11: Prepare the commit (do not run without authorization)**

```bash
git add src/presentation/ src/composables/useBattleActions.ts
git commit -m "fix(presentation): run domain commands inside the closed-curtain window

A combat -> combat refight is a transition against a live renderer, so running
the domain command before the transition reset the battle in full view.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Give `presentationActive` an owner (RC-3)

`setPresentationActive()` has no caller, so `tickPacing` always runs with
`resolveImmediately = true` and every ready actor resolves in one burst.

**Files:**
- Modify: `src/App.vue:138-158`
- Test: `src/App.wiring.test.ts`

**Interfaces:**
- Consumes: `coordinator.subscribe(listener)`, `CoordinatorSnapshot`
  (`currentRoute`, `currentSession`), `gameManager.setPresentationActive(active)`.
- Produces: no new API.

- [ ] **Step 1: Write the failing wiring test**

Add to `src/App.wiring.test.ts`:

```ts
it('activates combat playback exactly when the combat route is committed', () => {
  const calls: boolean[] = []
  const gameManager = { setPresentationActive: (v: boolean) => calls.push(v) }
  const listeners: Array<(s: any) => void> = []
  const coordinator = { subscribe: (l: (s: any) => void) => { listeners.push(l); return () => {} } }

  bindPresentationActive(coordinator as any, gameManager as any)

  listeners[0]({ currentRoute: 'home', currentSession: null })
  listeners[0]({ currentRoute: 'combat', currentSession: { kind: 'combat', sessionId: 1 } })
  listeners[0]({ currentRoute: 'combat', currentSession: { kind: 'combat', sessionId: 1 } })
  listeners[0]({ currentRoute: 'home', currentSession: null })

  // Only edges are reported, never repeats.
  expect(calls).toEqual([false, true, false])
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/App.wiring.test.ts -t "activates combat playback"`
Expected: FAIL — `bindPresentationActive` is not exported.

- [ ] **Step 3: Implement the binding**

Create `src/presentation/bindPresentationActive.ts`:

```ts
import type { CoordinatorSnapshot } from './PresentationContracts'

interface PlaybackTarget {
  setPresentationActive(active: boolean): void
}

interface SnapshotSource {
  subscribe(listener: (snapshot: CoordinatorSnapshot) => void): () => void
}

/**
 * `presentationActive` has exactly one owner: the coordinator (spec section 8).
 * It is true only while the COMMITTED route is combat and the combat session is
 * attached - CombatScene must never assert this for itself, because a scene
 * claiming its own readiness is the self-report pattern the coordinator design
 * already rejected.
 */
export function bindPresentationActive(
  coordinator: SnapshotSource,
  target: PlaybackTarget,
): () => void {
  let last: boolean | null = null

  return coordinator.subscribe((snapshot) => {
    const active =
      snapshot.currentRoute === 'combat' &&
      snapshot.currentSession !== null &&
      snapshot.currentSession.kind === 'combat'

    if (active === last) {
      return
    }

    last = active
    target.setPresentationActive(active)
  })
}
```

Re-export it from `src/App.wiring.test.ts`'s import path, and call it in
`App.vue` right after `const routeAdapter = createVueRouteAdapter(...)`:

```ts
const unbindPresentationActive = bindPresentationActive(coordinator, gameManager)
```

Add `unbindPresentationActive()` to the existing `onUnmounted` disposal block.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/App.wiring.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the combat suites that the gate now affects**

Run: `npx vitest run src/core/game/ src/core/battle/turn/`
Expected: PASS. Tests that construct `GameManager` directly never call
`bindPresentationActive`, so they stay on the headless path and are unaffected.

- [ ] **Step 6: Runtime evidence (P13) — this is the actual bug fix**

Run: `npm run dev`, note the printed port, then with `playwright-cli` in Edge:
start a stage, and record the wall-clock time of each `battle_end`-side action
completion. Confirm actions no longer land in the same frame.

Expected: strictly ordered, visibly separated actions. Note in the summary that
each turn now costs up to one world tick (~1 s) until Task 5 lands — that is the
expected intermediate state, not a regression.

- [ ] **Step 7: Prepare the commit (do not run without authorization)**

```bash
git add src/presentation/bindPresentationActive.ts src/App.vue src/App.wiring.test.ts
git commit -m "fix(combat): give presentationActive an owner so turns are gated

setPresentationActive had no production caller, so tickPacing always ran with
resolveImmediately and every ready actor resolved in one burst.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: The `CombatClock` primitive

Standalone and pure. Nothing consumes it yet, so this task cannot break combat.

**Files:**
- Create: `src/core/battle/turn/CombatClock.ts`
- Create: `src/core/battle/turn/CombatClock.test.ts`
- Create: `src/presentation/clock/RafClockSource.ts`
- Create: `src/presentation/clock/RafClockSource.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `COMBAT_STEP_SECONDS = 0.1`
  - `type CombatClockState = 'running' | 'frozen' | 'stopped'`
  - `type OffScreenReason = 'tab-hidden' | 'not-revealed'` — the clock's only
    conditions. There is deliberately **no** turn-related reason: holding the
    gauge during a turn is the gauge's rule and lives in the gauge (spec A6).
  - `interface ClockSource { start(onFrame: (elapsedSeconds: number) => void): void; stop(): void }`
  - `class ManualClockSource implements ClockSource { advance(seconds: number): void }`
  - `class CombatClock` with `start()`, `stop()`, `freeze(reason)`,
    `resume(reason)`, `getState()`, `getFreezeReasons()`, `getElapsedSteps()`,
    `onStep(listener: (steps: number) => void): () => void`
  - `class RafClockSource implements ClockSource`

- [ ] **Step 1: Write the failing tests**

Create `src/core/battle/turn/CombatClock.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CombatClock, ManualClockSource, COMBAT_STEP_SECONDS } from './CombatClock'

describe('CombatClock', () => {
  function makeClock() {
    const source = new ManualClockSource()
    const clock = new CombatClock(source)
    const steps: number[] = []
    clock.onStep((n) => steps.push(n))
    clock.start()
    return { source, clock, steps }
  }

  it('emits whole steps derived from elapsed time, not from frames', () => {
    const { source, steps } = makeClock()

    // Ten small frames totalling one step must emit exactly one step, and a
    // single large frame of the same total must emit the same. This is what
    // makes turn order frame-rate independent (spec 4.4).
    for (let i = 0; i < 10; i += 1) {
      source.advance(COMBAT_STEP_SECONDS / 10)
    }

    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)

    source.advance(COMBAT_STEP_SECONDS * 3)
    expect(steps.reduce((a, b) => a + b, 0)).toBe(4)
  })

  it('discards off-screen time instead of banking it', () => {
    const { source, clock, steps } = makeClock()

    clock.freeze('tab-hidden')
    source.advance(COMBAT_STEP_SECONDS * 100)

    expect(steps).toEqual([])
    expect(clock.getState()).toBe('frozen')

    clock.resume('tab-hidden')
    source.advance(COMBAT_STEP_SECONDS)

    // One step, not 101 - the frozen 100 are gone for good (spec A10).
    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('needs every off-screen reason resumed before it runs again', () => {
    const { source, clock, steps } = makeClock()

    clock.freeze('tab-hidden')
    clock.freeze('not-revealed')
    clock.resume('tab-hidden')

    source.advance(COMBAT_STEP_SECONDS * 5)
    expect(steps).toEqual([])
    expect(clock.getFreezeReasons()).toEqual(['not-revealed'])

    clock.resume('not-revealed')
    source.advance(COMBAT_STEP_SECONDS)
    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('is idempotent per reason', () => {
    const { clock } = makeClock()

    clock.freeze('tab-hidden')
    clock.freeze('tab-hidden')
    clock.resume('tab-hidden')

    expect(clock.getState()).toBe('running')
    clock.resume('tab-hidden')
    expect(clock.getState()).toBe('running')
  })

  it('knows nothing about turns', () => {
    // Spec AC-7c. The clock must never become the place where other people's
    // rules are kept - every consumer decides for itself when a step applies.
    const source = readFileSync('src/core/battle/turn/CombatClock.ts', 'utf8')

    expect(source).not.toMatch(/turn-in-flight|actor|playback/i)
  })

  it('stops counting once stopped', () => {
    const { source, clock, steps } = makeClock()

    clock.stop()
    source.advance(COMBAT_STEP_SECONDS * 10)

    expect(steps).toEqual([])
    expect(clock.getState()).toBe('stopped')
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx vitest run src/core/battle/turn/CombatClock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CombatClock`**

Create `src/core/battle/turn/CombatClock.ts`:

```ts
/**
 * Combat's own clock (spec 2026-09-10, section 4 and 6).
 *
 * It COUNTS FOR ITSELF. There is deliberately no `advance(dt)` on this class:
 * a clock that receives its delta from another clock is a subscriber, and
 * inherits that clock's cadence, throttling and catch-up. Time enters only
 * through the injected ClockSource.
 *
 * It PUBLISHES STEPS AND GATES NOBODY. The only thing it knows is whether the
 * battle is on screen (A6a). It has no turn-related freeze reason: "hold the
 * gauge while a turn is in flight" is the gauge's rule and lives in the gauge
 * (A6). Keeping it here would make this class a hidden gate holding rules its
 * consumers own, which every future consumer would then inherit by accident.
 *
 * Off-screen time is discarded, never banked (A10).
 */

export const COMBAT_STEP_SECONDS = 0.1

export type CombatClockState = 'running' | 'frozen' | 'stopped'

/** The only conditions the clock knows about; both mean "not on screen". */
export type OffScreenReason = 'tab-hidden' | 'not-revealed'

export interface ClockSource {
  start(onFrame: (elapsedSeconds: number) => void): void
  stop(): void
}

/** Test/headless source: time moves only when a caller says so. */
export class ManualClockSource implements ClockSource {
  private onFrame: ((elapsedSeconds: number) => void) | null = null

  start(onFrame: (elapsedSeconds: number) => void): void {
    this.onFrame = onFrame
  }

  stop(): void {
    this.onFrame = null
  }

  advance(seconds: number): void {
    this.onFrame?.(seconds)
  }
}

export class CombatClock {
  private state: CombatClockState = 'stopped'
  private readonly reasons = new Set<OffScreenReason>()
  private readonly listeners = new Set<(steps: number) => void>()
  private carrySeconds = 0
  private elapsedSteps = 0

  constructor(private readonly source: ClockSource) {}

  start(): void {
    if (this.state !== 'stopped') {
      return
    }

    this.state = this.reasons.size > 0 ? 'frozen' : 'running'
    this.carrySeconds = 0
    this.source.start((elapsed) => this.onFrame(elapsed))
  }

  stop(): void {
    if (this.state === 'stopped') {
      return
    }

    this.state = 'stopped'
    this.reasons.clear()
    this.carrySeconds = 0
    this.source.stop()
  }

  freeze(reason: OffScreenReason): void {
    if (this.state === 'stopped') {
      return
    }

    this.reasons.add(reason)
    this.state = 'frozen'
    // Partial progress toward the next step is dropped with the off-screen time.
    this.carrySeconds = 0
  }

  resume(reason: OffScreenReason): void {
    if (this.state === 'stopped') {
      return
    }

    this.reasons.delete(reason)

    if (this.reasons.size === 0) {
      this.state = 'running'
    }
  }

  getState(): CombatClockState {
    return this.state
  }

  getFreezeReasons(): readonly OffScreenReason[] {
    return [...this.reasons]
  }

  getElapsedSteps(): number {
    return this.elapsedSteps
  }

  onStep(listener: (steps: number) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private onFrame(elapsedSeconds: number): void {
    if (this.state !== 'running' || elapsedSeconds <= 0) {
      return
    }

    this.carrySeconds += elapsedSeconds

    const steps = Math.floor(this.carrySeconds / COMBAT_STEP_SECONDS)

    if (steps <= 0) {
      return
    }

    this.carrySeconds -= steps * COMBAT_STEP_SECONDS
    this.elapsedSteps += steps

    for (const listener of this.listeners) {
      listener(steps)
    }
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/battle/turn/CombatClock.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing `RafClockSource` test**

Create `src/presentation/clock/RafClockSource.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RafClockSource } from './RafClockSource'

describe('RafClockSource', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reports elapsed seconds between frames and stops cleanly', () => {
    const frames: Array<(t: number) => void> = []
    let nextHandle = 1

    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      frames.push(cb)
      return nextHandle++
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const source = new RafClockSource()
    const deltas: number[] = []
    source.start((d) => deltas.push(d))

    frames[0](1000)
    frames[1](1016)
    frames[2](1032)

    // The first frame establishes the baseline and reports nothing.
    expect(deltas.length).toBe(2)
    expect(deltas[0]).toBeCloseTo(0.016, 3)

    source.stop()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run and confirm it fails**

Run: `npx vitest run src/presentation/clock/RafClockSource.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `RafClockSource`**

Create `src/presentation/clock/RafClockSource.ts`:

```ts
import type { ClockSource } from '@/core/battle/turn/CombatClock'

/**
 * Production ClockSource: combat counts on the render cadence, so the battle
 * advances exactly as fast as it is drawn. DOM-aware, so it lives outside
 * core/ - core must stay headlessly testable.
 *
 * A hidden document stops delivering frames. That is not handled here: it is
 * handled as an explicit pause (spec A11 / section 6.1), because a silently
 * stalled battle is what this design exists to avoid.
 */
export class RafClockSource implements ClockSource {
  private handle: number | null = null
  private lastTimestamp: number | null = null

  start(onFrame: (elapsedSeconds: number) => void): void {
    if (this.handle !== null) {
      return
    }

    const frame = (timestamp: number) => {
      if (this.lastTimestamp !== null) {
        onFrame((timestamp - this.lastTimestamp) / 1000)
      }

      this.lastTimestamp = timestamp
      this.handle = requestAnimationFrame(frame)
    }

    this.handle = requestAnimationFrame(frame)
  }

  stop(): void {
    if (this.handle !== null) {
      cancelAnimationFrame(this.handle)
    }

    this.handle = null
    this.lastTimestamp = null
  }
}
```

- [ ] **Step 8: Run both new suites and type-check**

Run: `npx vitest run src/core/battle/turn/CombatClock.test.ts src/presentation/clock/ && npm run type-check`
Expected: PASS, 0 type errors.

- [ ] **Step 9: Prepare the commit (do not run without authorization)**

```bash
git add src/core/battle/turn/CombatClock.ts src/core/battle/turn/CombatClock.test.ts src/presentation/clock/
git commit -m "feat(combat): add CombatClock, a clock that counts for itself

No catch-up, freeze reasons are a set, and time enters only through an injected
ClockSource. Not yet consumed by the battle loop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Combat leaves the world clock (RC-4)

The largest task, and deliberately atomic: the integration and the test
migration cannot be reviewed apart. Roughly 16-20 test files drive battles
through `gameManager.update()` and must move to the manual source in the same
commit, or the suite is red between commits.

**Files:**
- Modify: `src/core/battle/turn/CombatAnimationRuntime.ts` (one new predicate)
- Modify: `src/core/game/GameManagerTurnBattleOps.ts:631-705, 466-520, 587-620`
- Modify: `src/core/game/GameManager.ts`
- Modify: `src/App.vue`
- Modify: the combat-driving test files enumerated in Step 1
- Test: `src/core/game/GameManagerTurnBattleOps.combatClock.test.ts` (create)

**Interfaces:**
- Consumes: `CombatClock`, `ClockSource`, `ManualClockSource`,
  `COMBAT_STEP_SECONDS` from Task 4.
- Produces:
  - `CombatAnimationRuntime.isTurnInFlight(): boolean`
  - `CombatAnimationRuntime` dep `onTurnInFlightChanged?: (inFlight: boolean) => void`
  - `GameManager.setCombatClockSource(source: ClockSource): void`
  - `GameManager.freezeCombat(reason: OffScreenReason): void`
  - `GameManager.resumeCombat(reason: OffScreenReason): void`
  - `GameManager.getCombatClockState(): CombatClockState`
  - `GameManager.getElapsedCombatSteps(): number`

- [ ] **Step 1: Enumerate the tests that actually drive combat**

Run:

```bash
grep -rl "gameManager\.update(\|manager\.update(" src --include=*.test.ts \
  | xargs grep -l "startStage\|turnBattle\|getBattle()" \
  | sort > /tmp/combat-driving-tests.txt
cat /tmp/combat-driving-tests.txt
```

Record the list in the task summary. Every file in it is migrated in Step 8.

- [ ] **Step 2: Write the failing integration test**

Create `src/core/game/GameManagerTurnBattleOps.combatClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'

describe('combat runs on CombatClock, not the world tick', () => {
  it('does not advance the battle when only the world clock ticks', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    const { player, stats, stage } = startAStage(manager)

    const before = manager.getBattle()?.state

    // A full world second must move nothing in combat any more.
    manager.update(1)

    expect(manager.getBattle()?.state).toBe(before)
  })

  it('advances the battle when its own clock advances', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    source.advance(COMBAT_STEP_SECONDS * 25)

    expect(manager.getBattle()?.introTurnsRemaining).toBe(0)
  })

  it('stops while off screen and never banks that time', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    manager.freezeCombat('not-revealed')
    source.advance(COMBAT_STEP_SECONDS * 500)
    manager.resumeCombat('not-revealed')

    const stepsAfterFreeze = manager.getBattle()?.introTurnsRemaining

    source.advance(COMBAT_STEP_SECONDS)

    expect(manager.getBattle()?.introTurnsRemaining).toBe((stepsAfterFreeze ?? 0) - 1)
  })

  it('keeps the clock running through a turn while the gauge holds', () => {
    // Spec AC-5: the clock is not told about turns. A manual wait holds the
    // GAUGE; time itself keeps passing.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setBattleManualMode(true)
    startAStage(manager)

    // Reach a manual actor's turn.
    source.advance(COMBAT_STEP_SECONDS * 200)

    const heldGauge = manager.getBattle()?.players[0]?.entity.actionGauge
    const stepsBefore = manager.getElapsedCombatSteps()

    source.advance(COMBAT_STEP_SECONDS * 600)

    expect(manager.getBattle()?.players[0]?.entity.actionGauge).toBe(heldGauge)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(stepsBefore)
    expect(manager.getCombatClockState()).toBe('running')
  })
})
```

Write `startAStage(manager)` as a local helper following whatever fixture the
existing `src/core/game/GameManager.introPhase.test.ts` uses to start a stage.
Copy that setup verbatim rather than inventing one.

- [ ] **Step 3: Run and confirm it fails**

Run: `npx vitest run src/core/game/GameManagerTurnBattleOps.combatClock.test.ts`
Expected: FAIL — `setCombatClockSource` is not a function.

- [ ] **Step 4: Expose turn-in-flight as one predicate**

In `src/core/battle/turn/CombatAnimationRuntime.ts`, add:

```ts
  /**
   * One predicate for "a turn is currently in flight" - the acknowledgement
   * chain and a manual choice are the same condition as far as the gauge is
   * concerned (spec section 7). The GAUGE consults this; the clock never does.
   */
  isTurnInFlight(): boolean {
    return this.isActionPlaybackWaiting() || this.isAwaitingManualTurnChoice()
  }
```

That is the whole step. There is deliberately **no** change notification and no
subscriber: the gauge reads this predicate synchronously at the moment it is
about to advance, which is the only moment the answer matters. An event would
mean two representations of the same fact and a window in which they disagree.

- [ ] **Step 5: Give `GameManagerTurnBattleOps` the clock**

Add fields and wire the notifier where the runtime is constructed:

```ts
  private combatClock = new CombatClock(new ManualClockSource())
  private detachClockStep: (() => void) | null = null

  setCombatClockSource(source: ClockSource): void {
    const wasRunning = this.combatClock.getState() !== 'stopped'

    this.combatClock.stop()
    this.detachClockStep?.()
    this.combatClock = new CombatClock(source)
    this.detachClockStep = this.combatClock.onStep((steps) => this.advanceCombat(steps))

    if (wasRunning) {
      this.combatClock.start()
    }
  }

  freezeCombat(reason: OffScreenReason): void {
    this.combatClock.freeze(reason)
  }

  resumeCombat(reason: OffScreenReason): void {
    this.combatClock.resume(reason)
  }

  getCombatClockState(): CombatClockState {
    return this.combatClock.getState()
  }

  getElapsedCombatSteps(): number {
    return this.combatClock.getElapsedSteps()
  }

  private advanceCombat(steps: number): void {
    for (let i = 0; i < steps; i += 1) {
      this.stepTurnBattle()
    }
  }
```

Nothing subscribes the clock to turn state. The clock is not told when a turn
starts or ends, and that is the design (spec A6a).

- [ ] **Step 6: Move the battle branch out of the world tick**

Cut the whole `if (this.turnBattle) { ... }` block out of `updateBattleFixedStep`
and paste it as the body of a new private method. The `presentationSession`
branch is dropped here and re-expressed as an off-screen clock reason in
Step 6a; the two wait-guards collapse into one `isTurnInFlight()` check:

```ts
  /**
   * One combat step. Called only by CombatClock - never by the world tick.
   *
   * The clock keeps running through a turn; it is the GAUGE that holds (spec
   * A6). Steps that arrive during a turn are dropped here, never accumulated,
   * so an unbounded turn buys nobody a head start.
   *
   * The former `presentationSession.isBlocking()` branch is gone: a held
   * session means the battle is not on screen, which is an OFF-SCREEN reason
   * that stops the clock upstream (`'not-revealed'`).
   */
  private stepTurnBattle(): void {
    if (!this.turnBattle) {
      return
    }

    if (this.turnBattle.state === 'intro') {
      this.turnBattleSystem.tickIntro(this.turnBattle)
      emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
      return
    }

    if (this.turnBattle.state === 'countdown') {
      this.turnBattleSystem.tickCountdown(this.turnBattle)
      emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
      return
    }

    if (this.turnBattle.state !== 'fighting') {
      return
    }

    // The gauge's own rule, kept with the gauge (spec 5.1). Read at the moment
    // it matters rather than mirrored into a flag someone else maintains.
    if (this.combatAnimationRuntime.isTurnInFlight()) {
      // A turn owns the battle. Positions and HP still move during its impact,
      // so the snapshot still goes out - only the gauge holds.
      emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
      return
    }

    const readyActor = this.turnBattleSystem.tickPacing(
      this.turnBattle,
      !this.combatAnimationRuntime.isPresentationActive(),
    )

    if (readyActor !== null && this.combatAnimationRuntime.isPresentationActive()) {
      this.combatAnimationRuntime.notifyReadyActor(readyActor)
    } else if (
      readyActor !== null &&
      this.turnBattle.players.includes(readyActor) &&
      this.combatAnimationRuntime.isBattleManualMode()
    ) {
      this.combatAnimationRuntime.pauseForManualActor(readyActor)
    }

    emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
  }
```

The two separate guards that used to skip a step (`isAwaitingManualTurnChoice`,
`isActionPlaybackWaiting`) collapse into the single `isTurnInFlight()` check
above — one rule, one place, owned by the thing it governs.

- [ ] **Step 6a: Pause the clock while the battle is not on screen**

A held session means the battle has not been revealed yet. Wire it as an
off-screen reason where `presentationSession` hold state changes:

```ts
    if (this.presentationSession.isBlocking()) {
      this.combatClock.freeze('not-revealed')
    } else {
      this.combatClock.resume('not-revealed')
    }
```

Call this from `startStage` after the battle is built, and from wherever the
session transitions (attach/release), so a battle waiting behind a closed
curtain does not burn gauge before the player sees it.

In `updateBattleFixedStep`, keep the surrounding loop for the world-side work
that follows it (auto-farm reward rolls and everything after the battle branch),
and delete only the battle branch.

- [ ] **Step 7: Start and stop the clock with the battle**

In `startStage`, after the battle has been rebuilt and just before `return true`:

```ts
    this.combatClock.stop()
    this.combatClock.start()
```

In `abandonBattle`, before `return true`, and in the victory/defeat terminal path
that already emits `battle_end`:

```ts
    this.combatClock.stop()
```

Add the facade on `GameManager`:

```ts
  setCombatClockSource(source: ClockSource): void {
    this.turnBattleOps.setCombatClockSource(source)
  }

  freezeCombat(reason: OffScreenReason): void {
    this.turnBattleOps.freezeCombat(reason)
  }

  resumeCombat(reason: OffScreenReason): void {
    this.turnBattleOps.resumeCombat(reason)
  }

  getCombatClockState(): CombatClockState {
    return this.turnBattleOps.getCombatClockState()
  }

  getElapsedCombatSteps(): number {
    return this.turnBattleOps.getElapsedCombatSteps()
  }
```

- [ ] **Step 8: Migrate the combat-driving tests**

For every file from Step 1, at the top of the setup that constructs the manager:

```ts
const combatSource = new ManualClockSource()
gameManager.setCombatClockSource(combatSource)
```

Then replace every `gameManager.update(n)` **whose purpose is to advance the
battle** with `combatSource.advance(n)`. Leave `update(n)` calls that exist to
advance cultivation, production or auto-farm exactly as they are — those are
world-clock assertions and this change must not alter them.

Where a single call did both, split it into two lines and note the split in a
comment, because the two clocks are now genuinely independent.

- [ ] **Step 9: Install the real source in `App.vue`**

After `gameManager.setPresentationMode('interactive')`:

```ts
// Combat counts on the render cadence, never on the world tick (spec RC-4).
const combatClockSource = new RafClockSource()
gameManager.setCombatClockSource(combatClockSource)
```

- [ ] **Step 10: Run the new integration test**

Run: `npx vitest run src/core/game/GameManagerTurnBattleOps.combatClock.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 11: Run the full suite**

Run: `npx vitest run`
Expected: PASS. `GameManager.fixedStepCatchup.test.ts` will need attention — the
combat half of fixed-step catch-up no longer exists (A10). Keep its world-side
assertions; delete the combat-side ones and say so in the commit body.

- [ ] **Step 12: Full verification (P3 full)**

Run: `npm run type-check && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 13: Runtime and browser evidence (P13 + P14)**

Run: `npx playwright test --workers=1`
Expected: 17/17 PASS.

Then `npm run dev` and, in Edge via `playwright-cli`: enter a stage and confirm
the countdown counts down smoothly rather than in three jumps, and that turns
follow one another without a one-second gap. State exactly what was seen.

- [ ] **Step 14: Prepare the commit (do not run without authorization)**

```bash
git add src/core/battle/turn/ src/core/game/ src/App.vue src/presentation/clock/
git commit -m "refactor(combat): combat counts on its own clock, not the world tick

The world's 1Hz interval split into ten 0.1s steps inside one JS frame, so a
three-second countdown reached Phaser as three bursts and several actors could
resolve in the same frame. Combat now advances on CombatClock at render cadence,
freezing while a turn is in flight. The world tick is unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The unwatched pause (A11)

**Files:**
- Create: `src/composables/useCombatPause.ts`
- Create: `src/composables/useCombatPause.test.ts`
- Create: `src/components/game/combat/CombatPauseOverlay.vue`
- Create: `src/components/game/combat/CombatPauseOverlay.test.ts`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `GameManager.freezeCombat`, `GameManager.resumeCombat`,
  `GameManager.getCombatClockState` from Task 5.
- Produces: `useCombatPause(gameManager)` returning
  `{ isPaused: Ref<boolean>, continueBattle: () => void, dispose: () => void }`.

- [ ] **Step 1: Write the failing composable test**

Create `src/composables/useCombatPause.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCombatPause } from './useCombatPause'

describe('useCombatPause', () => {
  let visibility: DocumentVisibilityState = 'visible'

  function stubVisibility() {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
  }

  afterEach(() => {
    visibility = 'visible'
    vi.restoreAllMocks()
  })

  it('pauses when hidden and does NOT resume when visible again', () => {
    stubVisibility()
    const calls: string[] = []
    const gameManager = {
      freezeCombat: (r: string) => calls.push(`freeze:${r}`),
      resumeCombat: (r: string) => calls.push(`resume:${r}`),
    }

    const { isPaused, continueBattle, dispose } = useCombatPause(gameManager as any)

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(isPaused.value).toBe(true)
    expect(calls).toEqual(['freeze:tab-hidden'])

    // Returning attention is not consent to resume (spec A11).
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(isPaused.value).toBe(true)
    expect(calls).toEqual(['freeze:tab-hidden'])

    continueBattle()
    expect(isPaused.value).toBe(false)
    expect(calls).toEqual(['freeze:tab-hidden', 'resume:tab-hidden'])

    dispose()
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx vitest run src/composables/useCombatPause.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the composable**

Create `src/composables/useCombatPause.ts`:

```ts
import { ref, type Ref } from 'vue'

interface CombatClockOwner {
  freezeCombat(reason: 'tab-hidden'): void
  resumeCombat(reason: 'tab-hidden'): void
}

/**
 * An unwatched battle pauses visibly and waits for Continue (spec A11).
 *
 * Returning to the tab deliberately does NOT resume: the player must see what
 * they are resuming into. This is what makes "combat has no catch-up" honest -
 * nobody is asked to reason about time they did not watch.
 */
export function useCombatPause(gameManager: CombatClockOwner): {
  isPaused: Ref<boolean>
  continueBattle: () => void
  dispose: () => void
} {
  const isPaused = ref(false)

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'hidden' || isPaused.value) {
      return
    }

    isPaused.value = true
    gameManager.freezeCombat('tab-hidden')
  }

  const continueBattle = () => {
    if (!isPaused.value) {
      return
    }

    isPaused.value = false
    gameManager.resumeCombat('tab-hidden')
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  return {
    isPaused,
    continueBattle,
    dispose: () => document.removeEventListener('visibilitychange', onVisibilityChange),
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/composables/useCombatPause.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing overlay test**

Create `src/components/game/combat/CombatPauseOverlay.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import CombatPauseOverlay from './CombatPauseOverlay.vue'

describe('CombatPauseOverlay', () => {
  it('emits continue when the button is pressed', async () => {
    const wrapper = mount(CombatPauseOverlay, { global: { plugins: [i18n] } })

    await wrapper.get('[data-testid="combat-pause-continue"]').trigger('click')

    expect(wrapper.emitted('continue')).toHaveLength(1)
  })
})
```

If the repo's other component tests mount via `createApp` rather than
`@vue/test-utils`, follow that local convention instead and keep the assertion.

- [ ] **Step 6: Run and confirm it fails**

Run: `npx vitest run src/components/game/combat/CombatPauseOverlay.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the overlay**

Create `src/components/game/combat/CombatPauseOverlay.vue`:

```vue
<script setup lang="ts">
/**
 * The pause overlay is NOT the curtain (spec section 6.1). The curtain belongs
 * to the presentation coordinator and covers route transitions; this belongs to
 * the battle and covers a stopped clock. Separate owners, separate layers,
 * neither drives the other.
 *
 * It dims and blocks input. It does NOT stop the scene: units keep breathing
 * behind it (spec A7 / 5.2a). A paused battle must look like a battle waiting,
 * not like a screenshot - so the dim is deliberately light enough to see them.
 */
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ continue: [] }>()

const { t } = useI18n({
  messages: {
    vi: { title: 'Trận đấu tạm dừng', body: 'Trận chỉ diễn ra khi bạn đang xem.', action: 'Tiếp tục' },
    en: { title: 'Battle paused', body: 'The battle only runs while you are watching.', action: 'Continue' },
  },
})
</script>

<template>
  <div class="combat-pause" data-testid="combat-pause-overlay" role="dialog" aria-modal="true">
    <div class="combat-pause__card">
      <h3 class="combat-pause__title">{{ t('title') }}</h3>
      <p class="combat-pause__body">{{ t('body') }}</p>
      <button
        type="button"
        class="combat-pause__action"
        data-testid="combat-pause-continue"
        @click="emit('continue')"
      >
        {{ t('action') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.combat-pause {
  position: absolute;
  inset: 0;
  /* Below the curtain's z-index 1000 on purpose: a route transition outranks a
     paused battle, and the two must never contend for the same layer. */
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Light enough that the units are still visible animating behind it (A7). */
  background: rgba(0, 0, 0, 0.55);
}

.combat-pause__card {
  padding: 24px 32px;
  text-align: center;
  background: var(--ink-900, #141820);
  border: 1px solid var(--gold-400, #d4a72c);
  border-radius: 8px;
  max-width: min(360px, 88vw);
}

.combat-pause__title {
  margin: 0 0 10px;
  color: var(--gold-300, #ffd54f);
  font-family: var(--font-display, serif);
  font-size: var(--text-md, 18px);
}

.combat-pause__body {
  margin: 0 0 18px;
  color: var(--text-secondary, #cbd5e1);
  font-size: var(--text-sm, 14px);
}

.combat-pause__action {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  background: var(--gold-400, #d4a72c);
  color: #000;
  font-size: var(--text-sm, 14px);
  cursor: pointer;
}
</style>
```

- [ ] **Step 8: Mount it in `App.vue`**

Alongside the existing presentation wiring:

```ts
const { isPaused: isCombatPaused, continueBattle, dispose: disposeCombatPause } =
  useCombatPause(gameManager)
```

Add `disposeCombatPause()` to `onUnmounted`. In the template, inside the game
branch and **below** the transition overlay:

```vue
<CombatPauseOverlay v-if="isCombatPaused" @continue="continueBattle" />
```

- [ ] **Step 9: Run the suites**

Run: `npx vitest run src/composables/useCombatPause.test.ts src/components/game/combat/CombatPauseOverlay.test.ts src/App.wiring.test.ts && npm run type-check`
Expected: PASS, 0 type errors.

- [ ] **Step 10: Browser evidence (P14)**

`npm run dev`, then in Edge: start a battle, switch to another tab for ~10 s,
come back. Confirm the overlay is showing, the gauge has not moved, and the
battle resumes only after pressing Continue. Screenshot the paused state.

**Then verify A7 explicitly:** take two screenshots ~1 s apart while the pause
overlay is up, and confirm the character sprites are on *different animation
frames*. If they are identical, something is pausing the scene and that is a
defect, not a pause. Do the same during an unbounded manual-choice wait.

- [ ] **Step 11: Prepare the commit (do not run without authorization)**

```bash
git add src/composables/useCombatPause.ts src/composables/useCombatPause.test.ts src/components/game/combat/CombatPauseOverlay.vue src/components/game/combat/CombatPauseOverlay.test.ts src/App.vue
git commit -m "feat(combat): pause an unwatched battle and wait for Continue

Returning to the tab does not resume. A battle only runs while it is watched,
and the player never has to reason about time they did not see.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: The telegraph becomes art (RC-4, presentation half)

Snapshots become targets; `CombatScene` interpolates toward them on Phaser's own
clock, exactly as it already does for positions.

**Files:**
- Modify: `src/game/scenes/CombatScene.ts:776` (`update`), `:1425-1471`
  (`reconcileTurnCountdownSpawn`)
- Test: `src/game/scenes/CombatScene.turnCountdownSpawn.test.ts`

**Interfaces:**
- Consumes: `TurnBattleEntitySnapshotEvent.countdownProgress`,
  `PendingSpawnVisualState.progress`.
- Produces: no new public API. `CombatScene.update(time: number, delta: number)`
  replaces the current zero-argument `update()`.

- [ ] **Step 1: Write the failing test**

Add to `src/game/scenes/CombatScene.turnCountdownSpawn.test.ts`:

```ts
it('interpolates the telegraph between snapshots instead of jumping', () => {
  const { scene, handles } = makeSceneWithCountdown()

  // Two snapshots a whole step apart - the visual must not jump straight to the
  // second value, it must cross the gap on render frames.
  scene.onTurnBattleEntitySnapshot(snapshotWithProgress(0))
  scene.onTurnBattleEntitySnapshot(snapshotWithProgress(0.5))

  scene.update(0, 8)
  const midway = handles[0].lastProgress

  expect(midway).toBeGreaterThan(0)
  expect(midway).toBeLessThan(0.5)

  scene.update(0, 200)
  expect(handles[0].lastProgress).toBeCloseTo(0.5, 2)
})
```

Build `makeSceneWithCountdown`, `snapshotWithProgress` and the spy handle by
following the fixtures already present in that file; record `lastProgress` on
the fake VFX handle's `update(progress)`.

- [ ] **Step 2: Run and confirm it fails**

Run: `npx vitest run src/game/scenes/CombatScene.turnCountdownSpawn.test.ts -t "interpolates the telegraph"`
Expected: FAIL — `update` takes no arguments and the handle jumps to 0.5.

- [ ] **Step 3: Store the target instead of applying it**

In `reconcileTurnCountdownSpawn`, replace `existing.update(event.countdownProgress)`
with a target write, and add the field:

```ts
  /** Latest published telegraph target. The picture chases this on render
   *  frames; the simulation never draws (spec section 5.2). */
  private telegraphTarget = 0
  private telegraphShown = 0
```

```ts
      if (existing) {
        this.telegraphTarget = event.countdownProgress
        continue
      }
```

Keep the `undefined` branch exactly as it is: flushing handles on countdown end
is mechanism, not art.

- [ ] **Step 4: Chase the target in `update`**

Change the signature and add the chase:

```ts
  update(_time: number, delta: number) {
    // Existing body stays here, unchanged.

    this.advanceTelegraph(delta)
  }

  /**
   * The telegraph is art (spec section 5.2): the snapshot supplies a target and
   * this closes the distance on Phaser's clock. Without it the telegraph shows
   * exactly as many frames as the simulation publishes.
   */
  private advanceTelegraph(deltaMs: number): void {
    if (this.turnCountdownSpawnVfxHandles.size === 0) {
      return
    }

    const rate = Math.min(1, deltaMs / 120)

    this.telegraphShown += (this.telegraphTarget - this.telegraphShown) * rate

    for (const handle of this.turnCountdownSpawnVfxHandles.values()) {
      handle.update(this.telegraphShown)
    }
  }
```

Reset `telegraphTarget` and `telegraphShown` to `0` wherever
`turnCountdownSpawnVfxHandles.clear()` already runs, so a refight starts from
zero rather than from the previous battle's last value.

- [ ] **Step 5: Run the scene suites**

Run: `npx vitest run src/game/scenes/`
Expected: PASS. Any test calling `scene.update()` with no arguments needs
`scene.update(0, 16)`.

- [ ] **Step 6: Full verification (P3 full — Phaser scene infra)**

Run: `npm run type-check && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 7: Browser evidence (P14) — this is the reported bug**

`npm run dev`, Edge: start a stage and watch the party spawn telegraph. Confirm
it advances continuously across its full duration rather than in three beats.
Capture a short sequence of screenshots or describe frame-by-frame what changed.

- [ ] **Step 8: Prepare the commit (do not run without authorization)**

```bash
git add src/game/scenes/CombatScene.ts src/game/scenes/CombatScene.turnCountdownSpawn.test.ts
git commit -m "fix(combat): interpolate the spawn telegraph on the render clock

Snapshots are targets, not frames. The telegraph no longer shows only as many
steps as the simulation happens to publish.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Retire the seconds cooldown clock (RC-5)

Characterize first, then sever. The call is not removed on the assumption that
it is dead.

**Files:**
- Create: `src/core/game/GameManager.cooldownAuthority.test.ts`
- Modify: `src/core/game/GameManager.ts:2997`

**Interfaces:**
- Consumes: `TurnSkillAction.tickCooldowns`, `TurnSkillSlot.remainingCooldownTurns`.
- Produces: no API change.

- [ ] **Step 1: Write the characterization test**

Create `src/core/game/GameManager.cooldownAuthority.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'

describe('cooldown has exactly one authority, counted in turns', () => {
  it('does not move a turn cooldown when world seconds pass', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    const participant = startBattleWithCooldownSkill(manager)

    participant.special!.remainingCooldownTurns = 3

    // Sixty world seconds. A seconds-based cooldown clock would drain this.
    manager.update(60)

    expect(participant.special!.remainingCooldownTurns).toBe(3)
  })

  it('keeps the basic slot always ready', () => {
    const manager = new GameManager()
    const participant = startBattleWithCooldownSkill(manager)

    expect(participant.basic?.remainingCooldownTurns ?? 0).toBe(0)
  })
})
```

Write `startBattleWithCooldownSkill` by copying the fixture from
`src/core/battle/turn/TurnSkillAction.test.ts` and starting a stage the way
`GameManager.introPhase.test.ts` does.

- [ ] **Step 2: Run it against the current code**

Run: `npx vitest run src/core/game/GameManager.cooldownAuthority.test.ts`
Expected: PASS — this is characterization, not a bug reproduction. It proves the
turn cooldown is already independent of world seconds. If it FAILS, stop: the
two authorities are entangled and that is a bigger finding than this task
assumes. Report it instead of proceeding.

- [ ] **Step 3: Prove nothing reads the seconds cooldown in the turn path**

Run:

```bash
grep -rn "remainingCooldownBySlot" src --include=*.ts | grep -v "\.test\." | grep -v "core/skill/"
```

Expected: no results outside `core/skill/`. Record the output in the summary. If
there are hits, they are the real consumers and must be migrated before Step 4.

- [ ] **Step 4: Sever the call**

In `src/core/game/GameManager.ts`, delete:

```ts
    this.skillSystem.update(deltaSeconds, 0)
```

and replace the comment above it with:

```ts
    // Cooldowns are counted in TURNS and have one authority (spec A9,
    // TurnSkillAction.tickCooldowns). The seconds-based SkillSystem clock that
    // used to tick here was a second authority for the same concept and was
    // retired after GameManager.cooldownAuthority.test.ts proved no turn path
    // reads it.
```

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS. Any failure here names a real consumer of the seconds clock —
migrate it rather than restoring the call.

- [ ] **Step 6: Full verification (P3 full)**

Run: `npm run type-check && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 7: Browser evidence (P14)**

`npm run dev`, Edge: run a battle with a skill that has a non-zero cooldown.
Confirm the skill becomes unavailable after use and returns after the stated
number of the holder's turns, not after a number of seconds.

- [ ] **Step 8: Prepare the commit (do not run without authorization)**

```bash
git add src/core/game/GameManager.ts src/core/game/GameManager.cooldownAuthority.test.ts
git commit -m "refactor(combat): retire the seconds-based cooldown clock

Cooldowns are counted in turns and now have exactly one authority. The legacy
SkillSystem seconds clock ticked unconditionally alongside it; characterized as
unread by any turn path, then severed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Real-time commands land at the turn boundary (spec §10)

The law: a command never mutates battle state at the moment it arrives. This is
the direct answer to the reported interleaving-corruption risk, and it is the
one spec section with no code behind it yet.

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts`
- Modify: `src/core/game/GameManager.ts`
- Test: `src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts` (create)

**Interfaces:**
- Consumes: `CombatClock`, `stepTurnBattle`, `isTurnInFlight` from Task 5.
- Produces:
  - `GameManagerTurnBattleOps.enqueueAtTurnBoundary(command: () => void): void`
  - `GameManager.enqueueAtTurnBoundary(command: () => void): void`

- [ ] **Step 1: Enumerate what actually mutates a running battle from outside**

Run:

```bash
grep -rn "recomputeTurnStats\|TurnStatsRecompute\|setBattleManualMode\|battleRunMode" src --include=*.ts --include=*.vue \
  | grep -v "\.test\." | sort
```

Record every call site that can fire while `getBattle()` is non-null. Those are
the commands this task routes through the boundary. Do not route anything that
cannot fire mid-battle — an empty route is worse than no route, because it
implies a guarantee that is not there.

- [ ] **Step 2: Write the failing test**

Create `src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'

describe('real-time commands land at a turn boundary', () => {
  /** Drives the battle until a manual actor is waiting - a real turn in flight. */
  function reachManualTurn(manager: GameManager, source: ManualClockSource) {
    manager.setBattleManualMode(true)
    source.advance(COMBAT_STEP_SECONDS * 200)
  }

  it('defers a command submitted while a turn is in flight', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('gear-change'))

    // The turn owns the battle, so nothing outside it may write - even though
    // the clock is still running and steps are still arriving.
    source.advance(COMBAT_STEP_SECONDS * 10)
    expect(applied).toEqual([])

    manager.submitTurnChoice('basic')
    source.advance(COMBAT_STEP_SECONDS)

    expect(applied).toEqual(['gear-change'])
  })

  it('applies queued commands in submission order, once each', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('first'))
    manager.enqueueAtTurnBoundary(() => applied.push('second'))

    manager.submitTurnChoice('basic')
    source.advance(COMBAT_STEP_SECONDS * 5)

    expect(applied).toEqual(['first', 'second'])
  })
})
```

Reuse the `startAStage` helper written in Task 5 Step 2.

- [ ] **Step 3: Run and confirm it fails**

Run: `npx vitest run src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts`
Expected: FAIL — `enqueueAtTurnBoundary` is not a function.

- [ ] **Step 4: Implement the queue**

In `GameManagerTurnBattleOps`:

```ts
  /**
   * Commands arrive on wall-clock time; battle state changes on turn
   * boundaries (spec section 10). Queueing them gives exactly one instant at
   * which combat state may change from outside, and at that instant no action
   * is in flight.
   */
  private boundaryQueue: Array<() => void> = []

  enqueueAtTurnBoundary(command: () => void): void {
    if (!this.turnBattle) {
      command()
      return
    }

    this.boundaryQueue.push(command)
  }

  private drainBoundaryQueue(): void {
    if (this.boundaryQueue.length === 0) {
      return
    }

    const queued = this.boundaryQueue
    this.boundaryQueue = []

    for (const command of queued) {
      command()
    }
  }
```

Drain in `stepTurnBattle()` **immediately after** the `isTurnInFlight()` early
return added in Task 5 Step 6, and before `tickPacing`:

```ts
    // Past the in-flight guard, so no action is in flight and the gauge is
    // about to advance: this instant IS the turn boundary (spec section 10).
    this.drainBoundaryQueue()
```

Placing it above that guard would defeat the whole task — commands would land
mid-turn, which is exactly the interleaving this law forbids.

Clear the queue in `startStage` and `abandonBattle` alongside the existing
per-battle resets, so a command queued against a battle that no longer exists
cannot reach the next one.

Add the facade on `GameManager`:

```ts
  enqueueAtTurnBoundary(command: () => void): void {
    this.turnBattleOps.enqueueAtTurnBoundary(command)
  }
```

- [ ] **Step 5: Route the call sites found in Step 1**

For each mid-battle mutator enumerated in Step 1, wrap its battle-affecting body
in `gameManager.enqueueAtTurnBoundary(() => { ... })`. Leave
`submitTurnChoice` alone: it is what a frozen manual turn is waiting for and is
consumed by the turn already in flight (spec §10), not deferred past it.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/core/game/ src/composables/`
Expected: PASS.

- [ ] **Step 7: Full verification (P3 full)**

Run: `npm run type-check && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 8: Prepare the commit (do not run without authorization)**

```bash
git add src/core/game/ src/composables/
git commit -m "feat(combat): apply real-time commands at the turn boundary

There is now exactly one instant at which combat state may change from outside,
and at that instant no action is in flight and the clock is stopped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Lock the classification and update the roadmap

**Files:**
- Create: `src/core/game/CombatTimeClassification.test.ts`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: everything from Tasks 4-8.
- Produces: no runtime API. A guard test plus roadmap truth.

- [ ] **Step 1: Write the parity test**

Create `src/core/game/CombatTimeClassification.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Spec section 5 assigns every time-dependent combat field to exactly one
 * authority. This test is the enforcement: it fails when a new seconds-valued
 * or delta-driven path appears in the combat engine without a classification.
 */
describe('combat time classification (spec section 5)', () => {
  it('no combat engine file consumes deltaSeconds', () => {
    const files = [
      'src/core/battle/turn/TurnBattleSystem.ts',
      'src/core/battle/turn/TurnSkillAction.ts',
      'src/core/battle/turn/ActionGauge.ts',
    ]

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} must not consume world deltaSeconds`).not.toMatch(/deltaSeconds/)
    }
  })

  it('the world tick no longer drives the turn battle', () => {
    const source = readFileSync('src/core/game/GameManagerTurnBattleOps.ts', 'utf8')
    const driver = source.slice(source.indexOf('updateBattleFixedStep'))
    const nextMethod = driver.indexOf('\n  private stepTurnBattle')

    expect(driver.slice(0, nextMethod)).not.toMatch(/tickPacing|tickIntro|tickCountdown/)
  })

  it('no freeze is implemented by pausing the Phaser scene', () => {
    // Spec A7 / 5.2a: the freeze is a data concept. Pausing the scene would
    // stop character animation, and a battle whose units stand frozen mid-pose
    // looks broken rather than paused. This is the obvious wrong implementation,
    // so it gets a guard.
    const files = [
      'src/game/scenes/CombatScene.ts',
      'src/components/game/PhaserCanvas.vue',
      'src/composables/useCombatPause.ts',
      'src/core/game/GameManagerTurnBattleOps.ts',
    ]

    for (const file of files) {
      const source = readFileSync(file, 'utf8')

      expect(source, `${file} must not pause the scene to express a freeze`)
        .not.toMatch(/scene\.pause\(|anims\.pauseAll\(|anims\.paused\s*=/)
    }
  })

  it('the countdown display is the only combat surface that expresses seconds', () => {
    // Spec section 4.3: inside combat, durations are steps. The pre-battle
    // countdown is the sole exception, because the player reads 3, 2, 1.
    const files = [
      'src/core/battle/turn/TurnBattleSystem.ts',
      'src/core/battle/turn/TurnSkillAction.ts',
      'src/core/battle/turn/ActionGauge.ts',
      'src/core/battle/turn/TurnBuffSystem.ts',
    ]

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const offenders = source
        .split('\n')
        .filter((line) => /\bSeconds\b|\bseconds\b/.test(line) && !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))

      expect(offenders, `${file} must express combat durations in steps, not seconds`).toEqual([])
    }
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/core/game/CombatTimeClassification.test.ts`
Expected: PASS after Tasks 5 and 8. If it fails, a classification was violated —
fix the source, not the test.

- [ ] **Step 3: Update the roadmap**

In `docs/roadmap.md`, add an entry recording the real contract: combat owns a
self-counting clock with no catch-up; a turn is mechanism terminated by Phaser's
acknowledgement; cooldowns are counted in turns with one authority; the world
tick's cadence is unchanged. Link the spec path. State the retained debt
verbatim from the spec's section 12.

- [ ] **Step 4: Full verification and QA gate (P3 full, P4)**

Run: `npm run type-check && npm run build && npx vitest run && npx playwright test --workers=1`
Expected: all green, 17/17 E2E.

Then run the adversarial QA pass and write the result to
`docs/qa/2026-09-10-combat-realtime-turn-authority.md`. QA-pass writes are
restricted to `**/*.test.ts`, `tests/e2e/**`, `docs/qa/**` — no production edits.

- [ ] **Step 5: Prepare the commit (do not run without authorization)**

```bash
git add src/core/game/CombatTimeClassification.test.ts docs/roadmap.md docs/qa/
git commit -m "test(combat): lock the time classification and record the contract

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Known cost, stated up front

Task 5 is large and cannot be split without leaving the suite red between
commits: roughly 16-20 test files drive battles through `gameManager.update()`
and must move to the manual clock source in the same change that stops the world
tick from driving combat. If that scope needs to shrink, the honest split is to
stop after Task 3 — Tasks 1-3 fix the curtain and the turn gate, are independent
of the clock work, and are shippable on their own.
