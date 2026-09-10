# Combat Turn Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use
> superpowers:subagent-driven-development or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal.** Give combat a self-counting clock that stops while a turn is in
flight, make turn order structurally one-at-a-time via an explicit turn token,
model turn-end as a drained resolution pipeline, and make every scene change
happen behind a fully closed curtain.

**Architecture.** A `CombatClock` counts from its own source and freezes while
the turn engine reports a non-idle token state. The turn engine gains a state
machine and a resolution pipeline; the pipeline, not a set of ad-hoc flags, is
the sole definition of when a turn ends. External commands land at the turn
boundary. The presentation coordinator runs domain commands inside a
closed-curtain window. The Electron host runs the clock source on the main
process and disables background throttling so the clock remains honest when
the window is not focused.

**Tech stack.** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser 4, Playwright,
Electron.

**Spec.** `game/docs/superpowers/specs/2026-09-10-combat-turn-mechanism-design.md`
and `game/docs/superpowers/specs/2026-09-10-combat-realtime-turn-authority-design.md`.

---

## Global constraints

- All paths are relative to `game/`. Run every command from `game/`.
- **P3 verification.** `quick` = `npm run type-check` + `npx vitest run <scope>`.
  `full` = `npm run type-check` + `npm run build` + `npx vitest run`. Tasks 5, 6,
  8, and 11 require `full`.
- **P13 runtime wiring.** Tasks 3, 5, 6, 7, 8, 10, 11 change wiring or driving
  paths. Unit tests are not sufficient evidence; run the relevant Playwright
  spec and drive the behaviour. "Nothing happens, no error" means suspect
  wiring first.
- **P14 browser verification.** Tasks 7, 8, 9 change what is on screen. Verify
  in a real browser via `playwright-cli`. Read the printed dev port. Prefer
  Edge.
- **P5 code review.** Run `code-review` after simplification and before
  declaring any task with ≥5 changed production lines complete. Resolve
  findings ≥80.
- **P7 no commits without authorization.** Each task ends with a prepared
  commit command. Do not run it until the user authorizes. Show the staged
  diff and the message, then wait.
- **P8 no new `any`.** If one is unavoidable, flag it in the task summary.
- **A step is `COMBAT_STEP_SECONDS = 0.1`.** Inside combat, durations are in
  steps. The pre-battle countdown display is the only surface that may express
  seconds.
- **Vocabulary is enforced.** `tick` belongs to the world clock. `advance` and
  `step` belong to `CombatClock`. `resolve` belongs to the turn engine's
  pipeline. `tick` on a combat-time path is a defect.
- **No catch-up in combat.** No ceiling, no clamp, no banking.
- **A freeze is data, never a paused scene.** Character animation runs on
  Phaser's own loop and must keep playing through every freeze, pause, and
  manual wait. Never call `scene.pause()`, `scene.scene.pause()`,
  `anims.pauseAll()`, or assign `anims.paused` to express a battle-state
  freeze. Skill VFX starting and stopping is normal; character animation
  stopping is a defect.

---

## File structure

**Created:**

- `src/core/battle/turn/CombatClock.ts` — clock, freeze-reason set,
  `ClockSource` interface, `ManualClockSource`. Pure; no DOM.
- `src/core/battle/turn/CombatClock.test.ts`
- `src/core/battle/turn/TurnToken.ts` — the state machine and pipeline.
- `src/core/battle/turn/TurnToken.test.ts`
- `src/core/battle/turn/TurnPipeline.ts` — step types and the dynamic queue.
- `src/core/battle/turn/TurnPipeline.test.ts`
- `src/presentation/clock/RafClockSource.ts` — DOM-aware fallback source.
- `src/presentation/clock/RafClockSource.test.ts`
- `src/presentation/clock/MainProcessClockSource.ts` — production source under
  Electron; receives ticks over IPC.
- `src/presentation/clock/MainProcessClockSource.test.ts`
- `src/main-process/combatClockHost.ts` — main-process timer that emits ticks.
- `src/main-process/combatClockHost.test.ts`
- `src/composables/useCombatPause.ts`
- `src/composables/useCombatPause.test.ts`
- `src/components/game/combat/CombatPauseOverlay.vue`
- `src/components/game/combat/CombatPauseOverlay.test.ts`
- `src/presentation/bindPresentationActive.ts`
- `src/core/game/GameManagerTurnBattleOps.combatClock.test.ts`
- `src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts`
- `src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts`
- `src/core/game/GameManager.cooldownAuthority.test.ts`
- `src/core/game/CombatTimeClassification.test.ts`

**Modified:**

- `src/components/game/PresentationTransitionOverlay.vue`
- `src/presentation/GamePresentationCoordinator.ts`
- `src/presentation/createGamePresentation.ts`
- `src/presentation/PresentationContracts.ts`
- `src/core/battle/turn/CombatAnimationRuntime.ts`
- `src/core/battle/turn/TurnBattleSystem.ts`
- `src/core/battle/turn/TurnSkillAction.ts`
- `src/core/game/GameManagerTurnBattleOps.ts`
- `src/core/game/GameManager.ts`
- `src/App.vue`
- `src/game/scenes/CombatScene.ts`
- `electron/main.ts`
- `electron/preload.ts`

---

## Task 1 — Curtain reopen always animates (RC-2)

**Files.**
- Modify: `src/components/game/PresentationTransitionOverlay.vue`
- Test: `src/components/game/PresentationTransitionOverlay.test.ts`

**Interfaces.** No API change. `close(id, signal)` and `open(id, signal)` keep
their signatures; only their settling behaviour changes.

- [ ] **Step 1: Write the failing test**

Add to `src/components/game/PresentationTransitionOverlay.test.ts`:

```ts
it('resolves immediately when the panels already sit at the requested state', async () => {
  vi.useFakeTimers()
  const { instance, unmount } = mountOverlay()

  try {
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

Step 2: Run and confirm failure
npx vitest run src/components/game/PresentationTransitionOverlay.test.ts -t "already sit at the requested state"

Expected: FAIL — the promise settles only via the 600 ms safety timeout.

□ Step 3: Implement the guard
In animateCurtain, after the reduced-motion branch:
  const settled = state === 'closing' ? 'closed' : 'opened'

  if (curtainState.value === settled) {
    return nextTick()
  }
  Step 4: Run the whole overlay suite
npx vitest run src/components/game/PresentationTransitionOverlay.test.ts

Expected: PASS.

□ Step 5: Type-check
npm run type-check

Expected: 0 errors.

□ Step 6: Prepare commit (do not run without authorization)
git add src/components/game/PresentationTransitionOverlay.vue src/components/game/PresentationTransitionOverlay.test.ts
git commit -m "fix(presentation): curtain open always animates or resolves honestly

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 2 — Closed-curtain work window (RC-1)
Move domain-command execution inside the transition, after the curtain has
closed. Today the command runs before the transition starts, so a
combat → combat refight resets the battle in full view.

Files.

Modify: src/presentation/PresentationContracts.ts

Modify: src/presentation/GamePresentationCoordinator.ts

Modify: src/presentation/createGamePresentation.ts

Test: src/presentation/GamePresentationCoordinator.test.ts

Interfaces.

RouteRequest gains behindCurtain?: () => boolean.

runAdmitted(target, command, options?) keeps its signature.

□ Step 1: Write failing coordinator tests
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

it('fails the transition and reopens the curtain when behindCurtain returns false', async () => {
  const coordinator = makeCoordinator({ initialRoute: 'home' })
  const openSpy = vi.spyOn(coordinator.curtain, 'open')

  const result = await coordinator.request({
    target: 'combat',
    session: { kind: 'combat', sessionId: 1 },
    behindCurtain: () => false,
  })

  expect(result.status).toBe('failed')
  expect(openSpy).toHaveBeenCalled()
})
Step 2: Run and confirm failure
npx vitest run src/presentation/GamePresentationCoordinator.test.ts -t "behindCurtain"

Expected: FAIL.

□ Step 3: Add the field
In src/presentation/PresentationContracts.ts:
  /**
   * Domain work with visible effect, executed inside the closed-curtain window.
   * Runs after the curtain is fully closed and before the target is revealed.
   * Returning false fails the transition.
   */
  behindCurtain?: () => boolean
  Step 4: Execute inside the window
In GamePresentationCoordinator.executeTransition, after
await this.withTimeout(this.curtain.close(...)) and its checkAborted:
      if (request.behindCurtain && !request.behindCurtain()) {
        throw new Error('Domain command rejected inside the closed-curtain window')
      }
Step 5: Stop running the command early
In createGamePresentation.runAdmitted, replace the body between the
canEnter guard and the coordinator.request call:
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
    Step 6: Adopt the session the window produced
In isValidRequest, before the session check:

ts
    if (request.behindCurtain) {
      return true
    }
In executeTransition, immediately after the behindCurtain call from
Step 4:

ts
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
□ Step 7: Run the presentation suite
npx vitest run src/presentation/

Expected: PASS. Update any test that asserted the command runs before the
request; that assertion is what this task removes.

□ Step 8: Run the battle-action suite
npx vitest run src/composables/useBattleActions.test.ts src/core/game/

Expected: PASS.

□ Step 9: Full verification
npm run type-check && npm run build && npx vitest run

Expected: all green.

□ Step 10: Runtime evidence (P13)
npx playwright test tests/e2e/presentation-routing.spec.ts --workers=1

Expected: PASS.

□ Step 11: Prepare commit (do not run without authorization)
bash
git add src/presentation/ src/composables/useBattleActions.ts
git commit -m "fix(presentation): run domain commands inside the closed-curtain window

A combat -> combat refight is a transition against a live renderer, so running
the domain command before the transition reset the battle in full view.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 3 — Give presentationActive an owner (RC-3)
setPresentationActive() has no caller, so tickPacing always runs with
resolveImmediately = true and every ready actor resolves in one burst.

Files.

Modify: src/App.vue

Create: src/presentation/bindPresentationActive.ts

Test: src/App.wiring.test.ts

Interfaces.

Consumes: coordinator.subscribe(listener), CoordinatorSnapshot,
gameManager.setPresentationActive(active).

Produces: bindPresentationActive(coordinator, target): () => void.

□ Step 1: Write the failing wiring test
Add to src/App.wiring.test.ts:

ts
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

  expect(calls).toEqual([false, true, false])
})
□ Step 2: Run and confirm failure
npx vitest run src/App.wiring.test.ts -t "activates combat playback"

Expected: FAIL — bindPresentationActive is not exported.

□ Step 3: Implement the binding
Create src/presentation/bindPresentationActive.ts:

ts
import type { CoordinatorSnapshot } from './PresentationContracts'

interface PlaybackTarget {
  setPresentationActive(active: boolean): void
}

interface SnapshotSource {
  subscribe(listener: (snapshot: CoordinatorSnapshot) => void): () => void
}

/**
 * `presentationActive` has exactly one owner: the coordinator. It is true only
 * while the COMMITTED route is combat and the combat session is attached.
 * CombatScene must never assert this for itself; a scene claiming its own
 * readiness is the self-report pattern the coordinator design rejected.
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
In App.vue, right after const routeAdapter = createVueRouteAdapter(...):

ts
const unbindPresentationActive = bindPresentationActive(coordinator, gameManager)
Add unbindPresentationActive() to the existing onUnmounted disposal block.

□ Step 4: Run the test
npx vitest run src/App.wiring.test.ts

Expected: PASS.

□ Step 5: Run the affected suites
npx vitest run src/core/game/ src/core/battle/turn/

Expected: PASS. Tests that construct GameManager directly never call
bindPresentationActive and remain on the headless path.

□ Step 6: Runtime evidence (P13)
npm run dev, note the port, then in Edge via playwright-cli: start a stage
and record the wall-clock time of each action completion. Confirm actions no
longer land in the same frame. Note that each turn now costs up to one world
tick (~1 s) until Task 5 lands — that is the expected intermediate state.

□ Step 7: Prepare commit (do not run without authorization)
bash
git add src/presentation/bindPresentationActive.ts src/App.vue src/App.wiring.test.ts
git commit -m "fix(combat): give presentationActive an owner so turns are gated

setPresentationActive had no production caller, so tickPacing always ran with
resolveImmediately and every ready actor resolved in one burst.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 4 — CombatClock primitive
Standalone and pure. Nothing consumes it yet, so this task cannot break combat.

Files.

Create: src/core/battle/turn/CombatClock.ts

Create: src/core/battle/turn/CombatClock.test.ts

Create: src/presentation/clock/RafClockSource.ts

Create: src/presentation/clock/RafClockSource.test.ts

Interfaces.

COMBAT_STEP_SECONDS = 0.1

type CombatClockState = 'running' | 'frozen' | 'stopped'

type FreezeReason = 'tab-hidden' | 'not-revealed' | 'turn-in-flight'

interface ClockSource { start(onFrame: (elapsedSeconds: number) => void): void; stop(): void }

class ManualClockSource implements ClockSource { advance(seconds: number): void }

class CombatClock with start(), stop(), freeze(reason),
resume(reason), getState(), getFreezeReasons(), getElapsedSteps(),
onStep(listener: (steps: number) => void): () => void

class RafClockSource implements ClockSource

□ Step 1: Write the failing tests
Create src/core/battle/turn/CombatClock.test.ts:

ts
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

    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('needs every reason resumed before it runs again', () => {
    const { source, clock, steps } = makeClock()

    clock.freeze('tab-hidden')
    clock.freeze('turn-in-flight')
    clock.resume('tab-hidden')

    source.advance(COMBAT_STEP_SECONDS * 5)
    expect(steps).toEqual([])
    expect(clock.getFreezeReasons()).toEqual(['turn-in-flight'])

    clock.resume('turn-in-flight')
    source.advance(COMBAT_STEP_SECONDS)
    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('is idempotent per reason', () => {
    const { clock } = makeClock()

    clock.freeze('turn-in-flight')
    clock.freeze('turn-in-flight')
    clock.resume('turn-in-flight')

    expect(clock.getState()).toBe('running')
    clock.resume('turn-in-flight')
    expect(clock.getState()).toBe('running')
  })

  it('knows nothing about turns, actors, or pipelines', () => {
    // The clock must never become the place where other people's rules are
    // kept. Every consumer decides for itself when a step applies.
    const source = readFileSync('src/core/battle/turn/CombatClock.ts', 'utf8')

    expect(source).not.toMatch(/turn-in-flight[^']|actor|pipeline|gauge/i)
  })

  it('ignores non-finite and non-positive frames', () => {
    const { source, steps } = makeClock()

    source.advance(NaN)
    source.advance(Infinity)
    source.advance(0)
    source.advance(-1)

    expect(steps).toEqual([])
  })

  it('stops counting once stopped', () => {
    const { source, clock, steps } = makeClock()

    clock.stop()
    source.advance(COMBAT_STEP_SECONDS * 10)

    expect(steps).toEqual([])
    expect(clock.getState()).toBe('stopped')
  })
})
□ Step 2: Run and confirm failure
npx vitest run src/core/battle/turn/CombatClock.test.ts

Expected: FAIL — module not found.

□ Step 3: Implement CombatClock
Create src/core/battle/turn/CombatClock.ts:

ts
/**
 * Combat's own clock.
 *
 * It counts for itself. There is deliberately no `advance(dt)` on this class:
 * a clock that receives its delta from another clock is a subscriber and
 * inherits that clock's cadence, throttling, and catch-up. Time enters only
 * through the injected ClockSource.
 *
 * It publishes steps and gates nobody. The only thing it knows is whether it
 * is allowed to count and, if not, which reasons are holding it back. It has
 * no turn-related concept of its own: "freeze while a turn is in flight" is a
 * reason supplied by the caller, not a rule stored here.
 *
 * Off-screen and mid-turn time are discarded, never banked.
 */

export const COMBAT_STEP_SECONDS = 0.1

export type CombatClockState = 'running' | 'frozen' | 'stopped'

/**
 * Reasons the clock may be held back. `tab-hidden` and `not-revealed` describe
 * the battle not being on screen. `turn-in-flight` describes the turn engine
 * having claimed the token and not yet released it. All three compose
 * uniformly: the clock runs only when the reason set is empty.
 */
export type FreezeReason = 'tab-hidden' | 'not-revealed' | 'turn-in-flight'

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
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return
    }

    this.onFrame?.(seconds)
  }
}

export class CombatClock {
  private state: CombatClockState = 'stopped'
  private readonly reasons = new Set<FreezeReason>()
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

  freeze(reason: FreezeReason): void {
    if (this.state === 'stopped') {
      return
    }

    this.reasons.add(reason)
    this.state = 'frozen'
    this.carrySeconds = 0
  }

  resume(reason: FreezeReason): void {
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

  getFreezeReasons(): readonly FreezeReason[] {
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
□ Step 4: Run the tests
npx vitest run src/core/battle/turn/CombatClock.test.ts

Expected: PASS, 7 tests.

□ Step 5: Write the failing RafClockSource test
Create src/presentation/clock/RafClockSource.test.ts:

ts
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

    expect(deltas.length).toBe(2)
    expect(deltas[0]).toBeCloseTo(0.016, 3)

    source.stop()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('drops an unreasonably large gap rather than reporting it', () => {
    const frames: Array<(t: number) => void> = []
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const source = new RafClockSource()
    const deltas: number[] = []
    source.start((d) => deltas.push(d))

    frames[0](1000)
    // Simulate a stall: next frame arrives 3 seconds later with no freeze
    // reason set. The clock must not bank the gap.
    frames[1](4000)

    expect(deltas.every((d) => d < 1)).toBe(true)
  })
})
□ Step 6: Run and confirm failure
npx vitest run src/presentation/clock/RafClockSource.test.ts

Expected: FAIL — module not found.

□ Step 7: Implement RafClockSource
Create src/presentation/clock/RafClockSource.ts:

ts
import type { ClockSource } from '@/core/battle/turn/CombatClock'

/**
 * Fallback ClockSource for the browser path: combat counts on the render
 * cadence, so the battle advances exactly as fast as it is drawn. DOM-aware,
 * so it lives outside core/ — core must stay headlessly testable.
 *
 * The production source under Electron is MainProcessClockSource. This one
 * remains for development in a plain browser and for tests.
 *
 * A frame that arrives more than STALL_THRESHOLD after the previous one is
 * treated as a stall and its gap is dropped. If the tab was hidden, the freeze
 * reason set handles it explicitly; if the stall was a browser-level throttle
 * with the tab still visible, dropping the gap is the honest behaviour,
 * because no catch-up is allowed in combat.
 */
const STALL_THRESHOLD_MS = 500

export class RafClockSource implements ClockSource {
  private handle: number | null = null
  private lastTimestamp: number | null = null

  start(onFrame: (elapsedSeconds: number) => void): void {
    if (this.handle !== null) {
      return
    }

    const frame = (timestamp: number) => {
      if (this.lastTimestamp !== null) {
        const deltaMs = timestamp - this.lastTimestamp

        if (deltaMs < STALL_THRESHOLD_MS) {
          onFrame(deltaMs / 1000)
        }
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
□ Step 8: Run both new suites and type-check
npx vitest run src/core/battle/turn/CombatClock.test.ts src/presentation/clock/ && npm run type-check

Expected: PASS, 0 type errors.

□ Step 9: Prepare commit (do not run without authorization)
bash
git add src/core/battle/turn/CombatClock.ts src/core/battle/turn/CombatClock.test.ts src/presentation/clock/
git commit -m "feat(combat): add CombatClock, a clock that counts for itself

No catch-up, freeze reasons are a set, and time enters only through an injected
ClockSource. Not yet consumed by the battle loop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 5 — Turn token state machine and resolution pipeline
The turn engine gains a single source of authority for "a turn is in flight"
and a single definition of when it ends. Nothing consumes it yet; this task is
pure and testable.

Files.

Create: src/core/battle/turn/TurnToken.ts

Create: src/core/battle/turn/TurnToken.test.ts

Create: src/core/battle/turn/TurnPipeline.ts

Create: src/core/battle/turn/TurnPipeline.test.ts

Modify: src/core/battle/turn/TurnSkillAction.ts (declare counterable,
counterSkillId)

Interfaces.

type TokenState = 'IDLE' | 'CLAIMED' | 'AWAITING_INPUT' | 'RESOLVING' | 'COMBAT_OVER'

class TurnToken with getState(), claim(actor), awaitInput(),
submitChoice(action), resolve(), endCombat(), reset(),
onStateChange(listener)

`reset()` returns the token to `IDLE` and is called by `startStage` (spec 3.3).
Without it a battle that ended in `COMBAT_OVER` leaves a terminal token for the
next battle, whose first `claim()` is then rejected and which never starts.

type PipelineStep = ... — union of step types.

class TurnPipeline with push(step), drain(), isDrained(),
getDepth(), reset(), wasChainDepthLimited(), and a constructor
taking an onDrained callback

Steps are asynchronous: `run(done)` calls `done()` exactly once (spec 4.1a).
`drain()` advances until it reaches a step that has not completed, parks, and
resumes itself when that step reports done.

□ Step 1: Write the failing TurnPipeline tests
Create src/core/battle/turn/TurnPipeline.test.ts:

ts
import { describe, expect, it, vi } from 'vitest'
import { TurnPipeline } from './TurnPipeline'

/** Mechanical steps complete inline; this is the common shape. */
const sync = (kind: any, fn: () => void) => ({ kind, run: (done: () => void) => { fn(); done() } })

describe('TurnPipeline', () => {
  it('runs steps serially in push order', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []

    pipeline.push({
      kind: 'animation',
      actorId: 'a',
      animationId: 'x',
      run: (done) => { order.push('anim'); done() },
    })
    pipeline.push(sync('hit', () => order.push('hit')))
    pipeline.push(sync('reaction', () => order.push('react')))

    pipeline.drain()

    expect(order).toEqual(['anim', 'hit', 'react'])
    expect(pipeline.isDrained()).toBe(true)
  })

  it('accepts new steps pushed from inside a running step', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []

    pipeline.push({
      kind: 'hit',
      run: (done) => {
        order.push('hit')
        pipeline.push(sync('reaction', () => order.push('react')))
        done()
      },
    })

    pipeline.drain()

    expect(order).toEqual(['hit', 'react'])
  })

  it('parks on a step that has not completed, then resumes itself', () => {
    // Spec 4.1a: an ANIMATION step finishes when the renderer says so, which is
    // not the instant it started. The pipeline must wait, not skip.
    const pipeline = new TurnPipeline()
    const order: string[] = []
    let finishAnimation: (() => void) | null = null

    pipeline.push({
      kind: 'animation',
      actorId: 'a',
      animationId: 'x',
      run: (done) => { order.push('anim-start'); finishAnimation = done },
    })
    pipeline.push(sync('hit', () => order.push('hit')))

    const result = pipeline.drain()

    expect(result.parked).toBe(true)
    expect(order).toEqual(['anim-start'])
    expect(pipeline.isDrained()).toBe(false)

    finishAnimation!()

    expect(order).toEqual(['anim-start', 'hit'])
    expect(pipeline.isDrained()).toBe(true)
  })

  it('completes a step only once when the event and its fallback timer race', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []
    let done1: (() => void) | null = null

    pipeline.push({
      kind: 'semantic-vfx',
      run: (done) => { done1 = done },
    })
    pipeline.push(sync('idle-check', () => order.push('idle')))

    pipeline.drain()

    done1!()
    done1!()

    expect(order).toEqual(['idle'])
  })

  it('fires onDrained exactly once when the queue empties', () => {
    const onDrained = vi.fn()
    const pipeline = new TurnPipeline(onDrained)

    pipeline.push(sync('hit', () => {}))
    pipeline.drain()

    expect(onDrained).toHaveBeenCalledTimes(1)
  })

  it('caps chained reactions at depth 10 but still drains mechanical steps', () => {
    // Spec 4.3: the reaction chain is dropped; SEMANTIC_VFX and IDLE_CHECK
    // still run so the turn terminates normally instead of being cut off.
    const pipeline = new TurnPipeline()
    const order: string[] = []
    let depth = 0

    const pushNext = () => {
      depth += 1
      order.push(`r${depth}`)

      if (depth < 20) {
        pipeline.push(sync('reaction', pushNext))
      }
    }

    pipeline.push(sync('reaction', pushNext))
    pipeline.push(sync('idle-check', () => order.push('idle')))
    const result = pipeline.drain()

    expect(result.chainDepthLimited).toBe(true)
    expect(depth).toBe(10)
    expect(order.at(-1)).toBe('idle')
    expect(pipeline.isDrained()).toBe(true)
  })

  it('ignores a re-entrant drain from inside a running step', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []

    pipeline.push({
      kind: 'hit',
      run: (done) => {
        pipeline.push(sync('reaction', () => order.push('react')))
        // A nested drain must not start a second traversal.
        expect(pipeline.drain().parked).toBe(false)
        order.push('hit')
        done()
      },
    })

    pipeline.drain()

    expect(order).toEqual(['hit', 'react'])
  })

  it('keeps the chain-depth counter across a park and resume', () => {
    const pipeline = new TurnPipeline()
    let depth = 0
    let resume: (() => void) | null = null

    const pushNext = () => {
      depth += 1

      if (depth === 3) {
        pipeline.push({ kind: 'semantic-vfx', run: (done) => { resume = done } })
      }

      if (depth < 20) {
        pipeline.push(sync('reaction', pushNext))
      }
    }

    pipeline.push(sync('reaction', pushNext))
    pipeline.drain()
    resume!()

    // Still 10, not 10-after-reset: the counter belongs to the turn.
    expect(depth).toBe(10)
  })

  it('reports zero depth once drained', () => {
    const pipeline = new TurnPipeline()
    pipeline.push(sync('idle-check', () => {}))

    expect(pipeline.getDepth()).toBe(1)
    pipeline.drain()
    expect(pipeline.getDepth()).toBe(0)
  })
})
□ Step 2: Run and confirm failure
npx vitest run src/core/battle/turn/TurnPipeline.test.ts

Expected: FAIL — module not found.

□ Step 3: Implement TurnPipeline
Create src/core/battle/turn/TurnPipeline.ts:

ts
/**
 * The resolution pipeline. One serial queue of steps; a step fully completes
 * before the next begins; steps may push new steps onto the same queue. The
 * pipeline is the sole definition of when a turn is in flight: as long as it
 * has steps, the turn has not ended.
 */

export const MAX_CHAIN_DEPTH = 10

/**
 * Every step calls `done()` exactly once. Mechanical steps call it inline and
 * behave like a plain serial loop; ANIMATION and SEMANTIC_VFX call it when the
 * renderer reports completion (spec 4.1a).
 */
export type StepRun = (done: () => void) => void

export type PipelineStep =
  | { kind: 'awaiting-input'; run: StepRun }
  | { kind: 'animation'; actorId: string; animationId: string; run: StepRun }
  | { kind: 'hit'; run: StepRun }
  | { kind: 'reaction'; run: StepRun }
  | { kind: 'death-check'; run: StepRun }
  | { kind: 'semantic-vfx'; run: StepRun }
  | { kind: 'idle-check'; run: StepRun }

export interface DrainResult {
  chainDepthLimited: boolean
  /** True = parked on a step that has not completed yet; it will resume itself. */
  parked: boolean
}

/** Steps that still run after the chain-depth guard fires (spec 4.3). */
const MECHANICAL_AFTER_LIMIT: ReadonlySet<PipelineStep['kind']> = new Set([
  'semantic-vfx',
  'idle-check',
])

export class TurnPipeline {
  private queue: PipelineStep[] = []
  private reactionDepth = 0
  private running = false
  private parkedOn: PipelineStep | null = null
  private chainDepthLimited = false

  /** Fired when the queue empties and nothing is parked - the turn has ended. */
  constructor(private readonly onDrained: () => void = () => {}) {}

  push(step: PipelineStep): void {
    this.queue.push(step)
  }

  getDepth(): number {
    return this.queue.length + (this.parkedOn === null ? 0 : 1)
  }

  isDrained(): boolean {
    return this.queue.length === 0 && this.parkedOn === null
  }

  wasChainDepthLimited(): boolean {
    return this.chainDepthLimited
  }

  /**
   * Clears everything for a new turn. The chain-depth counter belongs to the
   * TURN, not to a drain() call, so only this resets it - otherwise an async
   * step in the middle of a reaction chain would silently reset the guard.
   */
  reset(): void {
    this.queue = []
    this.parkedOn = null
    this.running = false
    this.reactionDepth = 0
    this.chainDepthLimited = false
  }

  drain(): DrainResult {
    if (this.running) {
      // Re-entrant call from inside a running step. That step already appended
      // to the queue and the outer traversal will reach it; starting a second
      // traversal here would interleave steps and break serial execution.
      return { chainDepthLimited: this.chainDepthLimited, parked: false }
    }

    this.running = true

    while (this.queue.length > 0) {
      const step = this.queue.shift()!

      this.parkedOn = step
      step.run(() => this.completeStep(step))

      if (this.parkedOn === step) {
        // Did not complete synchronously: park and wait to be resumed.
        this.running = false

        return { chainDepthLimited: this.chainDepthLimited, parked: true }
      }

      if (step.kind === 'reaction') {
        this.reactionDepth += 1

        if (this.reactionDepth >= MAX_CHAIN_DEPTH && !this.chainDepthLimited) {
          this.chainDepthLimited = true
          console.warn(
            `[combat] reaction chain depth limit (${MAX_CHAIN_DEPTH}) reached; forcing resolution`,
          )

          // Spec 4.3: drop the reaction chain but let the remaining mechanical
          // steps finish, so the turn terminates normally rather than being cut.
          this.queue = this.queue.filter((queued) => MECHANICAL_AFTER_LIMIT.has(queued.kind))
        }
      }
    }

    this.running = false

    if (this.isDrained()) {
      this.onDrained()
    }

    return { chainDepthLimited: this.chainDepthLimited, parked: false }
  }

  /** Idempotent per step: an event and its fallback timer may both fire. */
  private completeStep(step: PipelineStep): void {
    if (this.parkedOn !== step) {
      return
    }

    this.parkedOn = null

    if (!this.running) {
      // Async completion arrived after we parked - resume the traversal.
      this.drain()
    }
  }
}
□ Step 4: Run the pipeline tests
npx vitest run src/core/battle/turn/TurnPipeline.test.ts

Expected: PASS, 9 tests.

□ Step 5: Write the failing TurnToken tests
Create src/core/battle/turn/TurnToken.test.ts:

ts
import { describe, expect, it } from 'vitest'
import { TurnToken } from './TurnToken'

describe('TurnToken', () => {
  it('starts idle', () => {
    const token = new TurnToken()
    expect(token.getState()).toBe('IDLE')
  })

  it('routes a player-team claim into awaiting-input under manual mode', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'p1', isPlayerTeam: true, manualMode: true })
    expect(token.getState()).toBe('AWAITING_INPUT')
  })

  it('routes an auto or enemy claim straight to resolving', () => {
    const auto = new TurnToken()
    auto.claim({ actorId: 'p1', isPlayerTeam: true, manualMode: false })
    expect(auto.getState()).toBe('RESOLVING')

    const enemy = new TurnToken()
    enemy.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: true })
    expect(enemy.getState()).toBe('RESOLVING')
  })

  it('releases the token back to idle when resolution ends', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    expect(token.getState()).toBe('RESOLVING')

    token.resolve({ bothSidesAlive: true })
    expect(token.getState()).toBe('IDLE')
  })

  it('transitions to COMBAT_OVER when one side has no living actor', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    token.resolve({ bothSidesAlive: false })
    expect(token.getState()).toBe('COMBAT_OVER')
  })

  it('refuses to claim while not idle', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    expect(() =>
      token.claim({ actorId: 'e2', isPlayerTeam: false, manualMode: false }),
    ).toThrow(/not idle/i)
  })

  it('notifies subscribers on every state change', () => {
    const token = new TurnToken()
    const states: string[] = []
    token.onStateChange((s) => states.push(s))

    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    token.resolve({ bothSidesAlive: true })

    expect(states).toEqual(['CLAIMED', 'RESOLVING', 'IDLE'])
  })
})
□ Step 6: Run and confirm failure
npx vitest run src/core/battle/turn/TurnToken.test.ts

Expected: FAIL — module not found.

□ Step 7: Implement TurnToken
Create src/core/battle/turn/TurnToken.ts:

ts
/**
 * The turn token. Only one exists per battle. It is the sole authority on
 * whether combat is between turns or inside one. Everything the clock needs
 * to know about turns is derived from this state machine; nothing else in the
 * engine is allowed to keep a parallel "in flight" flag.
 */

export type TokenState =
  | 'IDLE'
  | 'CLAIMED'
  | 'AWAITING_INPUT'
  | 'RESOLVING'
  | 'COMBAT_OVER'

export interface ClaimArgs {
  actorId: string
  isPlayerTeam: boolean
  manualMode: boolean
}

export interface ResolveArgs {
  bothSidesAlive: boolean
}

export class TurnToken {
  private state: TokenState = 'IDLE'
  private readonly listeners = new Set<(state: TokenState) => void>()

  getState(): TokenState {
    return this.state
  }

  claim(args: ClaimArgs): void {
    if (this.state !== 'IDLE') {
      throw new Error(`Cannot claim turn token while state is ${this.state}, not IDLE`)
    }

    this.setState('CLAIMED')

    if (args.isPlayerTeam && args.manualMode) {
      this.setState('AWAITING_INPUT')
    } else {
      this.setState('RESOLVING')
    }
  }

  submitChoice(): void {
    if (this.state !== 'AWAITING_INPUT') {
      throw new Error(`Cannot submit choice while state is ${this.state}`)
    }

    this.setState('RESOLVING')
  }

  resolve(args: ResolveArgs): void {
    if (this.state !== 'RESOLVING') {
      throw new Error(`Cannot resolve while state is ${this.state}`)
    }

    this.setState(args.bothSidesAlive ? 'IDLE' : 'COMBAT_OVER')
  }

  onStateChange(listener: (state: TokenState) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(next: TokenState): void {
    this.state = next

    for (const listener of this.listeners) {
      listener(next)
    }
  }
}
□ Step 8: Run the token tests
npx vitest run src/core/battle/turn/TurnToken.test.ts

Expected: PASS, 7 tests.

□ Step 9: Declare counter configuration
In src/core/battle/turn/TurnSkillAction.ts, add to the action shape:

ts
  /** Whether this skill can be used as a counter. */
  counterable: boolean
  /** Skill used when this actor counters. Null means the basic attack. */
  counterSkillId: string | null
Populate with false / null at existing construction sites so the type
compiles; behaviour is not wired in this task.

□ Step 10: Run the whole new suite and type-check
npx vitest run src/core/battle/turn/ && npm run type-check

Expected: PASS, 0 type errors.

□ Step 11: Prepare commit (do not run without authorization)
bash
git add src/core/battle/turn/TurnToken.ts src/core/battle/turn/TurnToken.test.ts \
        src/core/battle/turn/TurnPipeline.ts src/core/battle/turn/TurnPipeline.test.ts \
        src/core/battle/turn/TurnSkillAction.ts
git commit -m "feat(combat): add turn token state machine and resolution pipeline

One token per battle owns agency. Turn-end is defined as a drained pipeline,
not as a specific event. Chain depth is capped at 10.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 5.5 — Wire the turn engine into the battle
Task 5 builds a token and a pipeline that nothing owns, nothing feeds and
nothing drains. This task is the bridge. Without it the pipeline is dead code
and turn-end is still decided by the old flags, which is the one outcome the
whole design exists to prevent.

**The bridge already exists in part.** `CombatAnimationRuntime` has a
three-signal handshake that Phaser already drives, and it maps onto the three
asynchronous steps almost exactly:

| Existing signal | Fires when | Becomes |
|---|---|---|
| `acknowledgeTurnReady` | ready flourish finished | completion of the `ANIMATION` step |
| `acknowledgeActionImpact` | impact frame reached | completion of the impact `SEMANTIC_VFX` step, whose body is the `HIT_RESOLUTION` work |
| `acknowledgeActionComplete` | action VFX finished | completion of the trailing `SEMANTIC_VFX` step |

So this task reuses the handshake instead of inventing a second one. What is
new is the ownership, the ordering, and the fallback timer.

Files.

Modify: src/core/game/GameManagerTurnBattleOps.ts

Modify: src/core/battle/turn/CombatAnimationRuntime.ts

Create: src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts

Interfaces.

Consumes: TurnToken, TurnPipeline, MAX_CHAIN_DEPTH from Task 5; CombatClock
from Task 4.

Produces:
- `GameManagerTurnBattleOps` privately owns one `TurnToken` and one
  `TurnPipeline`; the token resets per battle, the pipeline per turn.
- `CombatAnimationRuntime` dep `stepCompletionSink?: { onReady(): void;
  onImpact(): void; onComplete(): void }` — the runtime calls these after its
  existing ack bodies run, so it reports that a step finished without knowing
  what a pipeline is.
- `GameManager.getTurnTokenState(): TokenState` — marked `@internal`.
- `ANIMATION_FALLBACK_MS = 4000`.

□ Step 1: Write the failing end-to-end turn test
Create src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts:

ts
import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'

describe('turn engine is actually wired', () => {
  it('claims, resolves through the pipeline, and returns to IDLE', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setPresentationActive(true)
    startAStage(manager)

    // Run past intro and countdown into fighting.
    source.advance(COMBAT_STEP_SECONDS * 60)
    expect(manager.getBattle()?.state).toBe('fighting')

    // A gauge fills and claims the token; the clock freezes.
    source.advance(COMBAT_STEP_SECONDS * 200)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('frozen')

    // Nothing advances until the renderer acknowledges each step.
    const gaugeWhileHeld = manager.getBattle()?.enemies[0]?.entity.actionGauge
    source.advance(COMBAT_STEP_SECONDS * 100)
    expect(manager.getBattle()?.enemies[0]?.entity.actionGauge).toBe(gaugeWhileHeld)

    // Drive the handshake the way Phaser does.
    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('running')
  })

  it('does not let intro or countdown claim the token', () => {
    // Spec 3.3: the token is active only while the phase is fighting.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    expect(manager.getBattle()?.state).toBe('intro')
    source.advance(COMBAT_STEP_SECONDS * 10)
    expect(manager.getTurnTokenState()).toBe('IDLE')
  })

  it('resets a COMBAT_OVER token when the next battle starts', () => {
    // Spec 3.3 / blocker A5: a terminal token inherited by a fresh battle
    // rejects its first claim and freezes that battle forever.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    manager.abandonBattle()

    startAStage(manager)

    expect(manager.getTurnTokenState()).toBe('IDLE')
  })

  it('completes a parked step on the fallback timer when no ack arrives', () => {
    // Spec 4.1a: a missing renderer event must not park the pipeline forever,
    // because that leaves the token non-IDLE and the clock frozen for good.
    vi.useFakeTimers()

    try {
      const manager = new GameManager()
      const source = new ManualClockSource()
      manager.setCombatClockSource(source)
      manager.setPresentationActive(true)
      startAStage(manager)
      source.advance(COMBAT_STEP_SECONDS * 260)

      expect(manager.getTurnTokenState()).not.toBe('IDLE')

      // No acknowledgement at all - simulate a destroyed sprite.
      vi.advanceTimersByTime(30_000)

      expect(manager.getTurnTokenState()).toBe('IDLE')
      expect(manager.getCombatClockState()).toBe('running')
    } finally {
      vi.useRealTimers()
    }
  })
})

Write startAStage by copying the fixture from
src/core/game/GameManager.introPhase.test.ts.

□ Step 2: Run and confirm failure
npx vitest run src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts

Expected: FAIL - getTurnTokenState is not a function.

□ Step 3: Own the token and the pipeline
In GameManagerTurnBattleOps:

ts
  private readonly turnToken = new TurnToken()
  private readonly pipeline = new TurnPipeline(() => this.onTurnDrained())

  /** @internal - for tests and the dev inspector, never for gameplay code. */
  getTurnTokenState(): TokenState {
    return this.turnToken.getState()
  }

In startStage, next to the other per-battle resets (blocker A5):

ts
    this.turnToken.reset()
    this.pipeline.reset()
    this.boundaryQueue = []

□ Step 4: Claim the token from the pacing step
Replace the ready-actor handling inside stepTurnBattle's fighting branch:

ts
    // tickPacing NEVER resolves a turn any more, in any mode. Resolution is the
    // pipeline's job; leaving resolve=true here would give turn-end a second
    // owner, which is the defect this document exists to remove.
    const readyActor = this.turnBattleSystem.tickPacing(this.turnBattle, false)

    if (readyActor === null) {
      emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
      return
    }

    this.turnToken.claim({
      actorId: readyActor.id,
      isPlayerTeam: this.turnBattle.players.includes(readyActor),
      manualMode: this.combatAnimationRuntime.isBattleManualMode(),
    })

    this.combatClock.freeze('turn-in-flight')

    if (this.turnToken.getState() === 'AWAITING_INPUT') {
      this.combatAnimationRuntime.pauseForManualActor(readyActor)
      emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
      return
    }

    this.beginTurnPipeline(readyActor)
    emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)

Only the fighting branch reaches this code, so spec 3.3 holds by construction:
intro and countdown return before it and can never claim the token.

`submitTurnChoice` must call `beginTurnPipeline(awaitedActor)` after the token
transitions AWAITING_INPUT -> RESOLVING, so a manual turn takes the same path as
an auto one from that point on.

□ Step 5: Build the pipeline for one turn
ts
  /**
   * One turn = one pipeline. The three asynchronous steps map onto the
   * handshake CombatAnimationRuntime already exposes; the mechanical steps
   * complete inline.
   */
  private beginTurnPipeline(actor: TurnBattleParticipant): void {
    this.pipeline.reset()

    this.pipeline.push({
      kind: 'animation',
      actorId: actor.id,
      animationId: 'action',
      run: (done) => {
        this.awaitStep('ready', done)
        this.combatAnimationRuntime.notifyReadyActor(actor)
      },
    })

    this.pipeline.push({
      kind: 'semantic-vfx',
      run: (done) => this.awaitStep('impact', done),
    })

    this.pipeline.push({
      kind: 'semantic-vfx',
      run: (done) => this.awaitStep('complete', done),
    })

    this.pipeline.push({ kind: 'idle-check', run: (done) => done() })

    this.pipeline.drain()
  }

Reactions, death checks and on-death effects are pushed from inside the
HIT_RESOLUTION work that acknowledgeActionImpact already performs. They land on
the same queue and drain in order, which is what makes counters, reflects and
on-death chain naturally (spec 4.2) without any new scheduling.

□ Step 6: The completion sink and the fallback timer
ts
  private pendingStepDone: Partial<Record<'ready' | 'impact' | 'complete', () => void>> = {}

  /**
   * Parks a step until the renderer reports the matching signal, or until the
   * fallback fires (spec 4.1a). Whichever comes first wins; TurnPipeline makes
   * the completion idempotent, so the loser is harmless.
   *
   * The fallback is not an optimisation. It is what stops a destroyed sprite or
   * a cancelled tween from parking the pipeline forever, which would leave the
   * token non-IDLE and the clock frozen for the rest of the session.
   */
  private awaitStep(signal: 'ready' | 'impact' | 'complete', done: () => void): void {
    const timer = setTimeout(done, ANIMATION_FALLBACK_MS)

    this.pendingStepDone[signal] = () => {
      clearTimeout(timer)
      done()
    }
  }

  private settleStep(signal: 'ready' | 'impact' | 'complete'): void {
    const settle = this.pendingStepDone[signal]
    this.pendingStepDone[signal] = undefined
    settle?.()
  }

Wire the sink where the runtime is constructed:

ts
      stepCompletionSink: {
        onReady: () => this.settleStep('ready'),
        onImpact: () => this.settleStep('impact'),
        onComplete: () => this.settleStep('complete'),
      },

In CombatAnimationRuntime, call the sink as the LAST statement of each ack body,
after the existing work, so battle state is already applied when the pipeline
advances:

ts
    this.deps.stepCompletionSink?.onReady()

Same with onImpact in acknowledgeActionImpact and onComplete in
acknowledgeActionComplete. Also call all three, in order, at the end of
handlePresentationDeactivated after it drains its pending phases - leaving the
scene mid-turn must not park the pipeline.

□ Step 7: End the turn when the pipeline drains
ts
  private onTurnDrained(): void {
    const battle = this.turnBattle

    if (!battle) {
      return
    }

    const bothSidesAlive =
      battle.players.some((p) => p.entity.alive) && battle.enemies.some((e) => e.entity.alive)

    this.turnToken.resolve({ bothSidesAlive })

    if (this.turnToken.getState() === 'COMBAT_OVER') {
      // Blocker A6: victory and defeat never pass through abandonBattle, so a
      // command queued in the last turn would otherwise drain into the NEXT
      // battle's first boundary.
      this.boundaryQueue = []
      this.combatClock.stop()
      return
    }

    this.combatClock.resume('turn-in-flight')
  }

□ Step 8: Retire the old predicates (blocker C3)
isActionPlaybackWaiting() and isAwaitingManualTurnChoice() described the same
fact the token now owns. Either delete them and migrate their callers, or keep
them as thin reads DERIVED from the token. Do not leave three independent
representations of "a turn is in flight".

Run:

bash
grep -rn "isActionPlaybackWaiting\|isAwaitingManualTurnChoice\|isTurnInFlight" src --include=*.ts --include=*.vue | grep -v "\.test\."

Every hit is either migrated or justified in the task summary.

□ Step 9: Run the tests
npx vitest run src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts src/core/battle/turn/

Expected: PASS.

□ Step 10: Full verification (P3 full - architecture change)
npm run type-check && npm run build && npx vitest run

Expected: all green.

□ Step 11: Runtime evidence (P13)
npx playwright test --workers=1

Then npm run dev and, in Edge: run a full battle to victory. Confirm units act
strictly one at a time and each action's animation completes before the next
begins. A hang means a step parked without completing - find which signal never
arrived rather than raising the fallback.

□ Step 12: Prepare the commit (do not run without authorization)
bash
git add src/core/game/ src/core/battle/turn/
git commit -m "feat(combat): wire the turn token and resolution pipeline into the battle

The pipeline now owns turn-end. Phaser's existing three-signal handshake
supplies the asynchronous step completions, with a fallback timer so a missing
renderer event cannot park a turn forever.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

---

Task 6 — Combat leaves the world clock
The largest task. Roughly 16–20 test files drive battles through
gameManager.update() and must move to the manual clock source in the same
change, or the suite is red between commits.

Files.

Modify: src/core/battle/turn/CombatAnimationRuntime.ts

Modify: src/core/game/GameManagerTurnBattleOps.ts

Modify: src/core/game/GameManager.ts

Modify: src/App.vue

Create: src/core/game/GameManagerTurnBattleOps.combatClock.test.ts

Create: src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts

Modify: the combat-driving test files enumerated in Step 1

Interfaces.

CombatAnimationRuntime.isTurnInFlight(): boolean becomes the token-state
predicate: token.getState() !== 'IDLE'.

GameManager.setCombatClockSource(source: ClockSource): void

GameManager.freezeCombat(reason: FreezeReason): void

GameManager.resumeCombat(reason: FreezeReason): void

GameManager.getCombatClockState(): CombatClockState

GameManager.getElapsedCombatSteps(): number

□ Step 1: Enumerate combat-driving tests
bash
grep -rl "gameManager\.update(\|manager\.update(" src --include=*.test.ts \
  | xargs grep -l "startStage\|turnBattle\|getBattle()" \
  | sort > /tmp/combat-driving-tests.txt
cat /tmp/combat-driving-tests.txt
Record the list in the task summary. Every file in it is migrated in Step 8.

□ Step 2: Write the failing clock integration test
Create src/core/game/GameManagerTurnBattleOps.combatClock.test.ts:

ts
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'

describe('combat runs on CombatClock, not the world tick', () => {
  it('does not advance the battle when only the world clock ticks', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    const before = manager.getBattle()?.state
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

    const before = manager.getBattle()?.introTurnsRemaining
    source.advance(COMBAT_STEP_SECONDS)

    expect(manager.getBattle()?.introTurnsRemaining).toBe((before ?? 0) - 1)
  })

  it('freezes the clock while a turn is in flight, not merely the gauge', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setBattleManualMode(true)
    startAStage(manager)

    // Reach a manual actor's turn.
    source.advance(COMBAT_STEP_SECONDS * 200)

    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')

    const stepsBefore = manager.getElapsedCombatSteps()
    source.advance(COMBAT_STEP_SECONDS * 600)

    // No step was consumed while the token was held.
    expect(manager.getElapsedCombatSteps()).toBe(stepsBefore)
  })
})
Create src/core/game/__fixtures__/startAStage.ts by copying the setup used by
GameManager.introPhase.test.ts, or import whatever fixture that file uses.

□ Step 3: Run and confirm failure
npx vitest run src/core/game/GameManagerTurnBattleOps.combatClock.test.ts

Expected: FAIL — setCombatClockSource is not a function.

□ Step 4: isTurnInFlight becomes the token predicate
In src/core/battle/turn/CombatAnimationRuntime.ts:

ts
  /**
   * True whenever the token is not idle. This is the single predicate for
   * "a turn is in flight"; the clock is told through a freeze reason, not
   * through a mirrored flag.
   */
  isTurnInFlight(): boolean {
    return this.turnToken.getState() !== 'IDLE'
  }
The runtime gains a reference to the TurnToken. No change notification and
no subscriber: the freeze reason is added/removed by whoever owns the token
state, and the predicate is read synchronously at the moment it matters.

□ Step 5: Give GameManagerTurnBattleOps the clock and token
Add fields:

ts
  private combatClock = new CombatClock(new ManualClockSource())
  private readonly turnToken = new TurnToken()
  private detachClockStep: (() => void) | null = null
  private detachTokenListener: (() => void) | null = null
Wire the token's state changes into the clock's freeze reason:

ts
  private attachTurnTokenToClock(): void {
    this.detachTokenListener?.()

    this.detachTokenListener = this.turnToken.onStateChange((state) => {
      if (state === 'IDLE') {
        this.combatClock.resume('turn-in-flight')
      } else {
        this.combatClock.freeze('turn-in-flight')
      }
    })
  }
Public surface:

ts
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

  freezeCombat(reason: FreezeReason): void {
    this.combatClock.freeze(reason)
  }

  resumeCombat(reason: FreezeReason): void {
    this.combatClock.resume(reason)
  }

  getCombatClockState(): CombatClockState {
    return this.combatClock.getState()
  }

  getElapsedCombatSteps(): number {
    return this.combatClock.getElapsedSteps()
  }

  getFreezeReasons(): readonly FreezeReason[] {
    return this.combatClock.getFreezeReasons()
  }

  private advanceCombat(steps: number): void {
    for (let i = 0; i < steps; i += 1) {
      // A step may claim the token, which freezes the clock. The remaining
      // steps of this batch were earned before that happened and must be
      // DROPPED, not spent - spending them would tick the gauge while a turn is
      // in flight, which is the exact thing the token exists to prevent, and
      // banking them would be catch-up, which the spec forbids outright.
      if (this.turnToken.getState() !== 'IDLE') {
        break
      }

      this.stepTurnBattle()
    }
  }
□ Step 6: Move the battle branch out of the world tick
Cut the whole if (this.turnBattle) { ... } block out of
updateBattleFixedStep and paste it as the body of a new private method:

ts
  /**
   * One combat step. Called only by CombatClock - never by the world tick.
   *
   * The clock is frozen by the token's state change, so no step arrives while
   * a turn is in flight. There is no re-check here; the freeze reason is the
   * single mechanism.
   *
   * The former `presentationSession.isBlocking()` branch is gone: a held
   * session means the battle is not on screen, which is an off-screen reason
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

    this.drainBoundaryQueueIfIdle()

    const readyActor = this.turnBattleSystem.tickPacing(
      this.turnBattle,
      !this.combatAnimationRuntime.isPresentationActive(),
    )

    if (readyActor !== null) {
      this.turnToken.claim({
        actorId: readyActor.entity.id,
        isPlayerTeam: this.turnBattle.players.includes(readyActor),
        manualMode: this.combatAnimationRuntime.isBattleManualMode(),
      })

      if (this.combatAnimationRuntime.isPresentationActive()) {
        this.combatAnimationRuntime.notifyReadyActor(readyActor)
      }
    }

    emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
  }
The drainBoundaryQueueIfIdle helper is defined in Task 10; for this task it
is a no-op placeholder so the call site exists.

□ Step 6a: Pause the clock while the battle is not on screen
Wire session blocking as an off-screen reason:

ts
    if (this.presentationSession.isBlocking()) {
      this.combatClock.freeze('not-revealed')
    } else {
      this.combatClock.resume('not-revealed')
    }
Call this from startStage after the battle is built and from wherever the
session transitions (attach/release).

□ Step 7: Start and stop the clock with the battle
In startStage, after the battle is rebuilt and immediately before
return true:

ts
    this.attachTurnTokenToClock()
    this.combatClock.stop()
    this.combatClock.start()
In abandonBattle, before return true, and in the victory/defeat terminal
path that emits battle_end:

ts
    this.combatClock.stop()
Add the facade on GameManager:

ts
  setCombatClockSource(source: ClockSource): void {
    this.turnBattleOps.setCombatClockSource(source)
  }

  freezeCombat(reason: FreezeReason): void {
    this.turnBattleOps.freezeCombat(reason)
  }

  resumeCombat(reason: FreezeReason): void {
    this.turnBattleOps.resumeCombat(reason)
  }

  getCombatClockState(): CombatClockState {
    return this.turnBattleOps.getCombatClockState()
  }

  getElapsedCombatSteps(): number {
    return this.turnBattleOps.getElapsedCombatSteps()
  }

  getFreezeReasons(): readonly FreezeReason[] {
    return this.turnBattleOps.getFreezeReasons()
  }
□ Step 8: Migrate the combat-driving tests
For every file from Step 1, at the top of the setup that constructs the
manager:

ts
const combatSource = new ManualClockSource()
gameManager.setCombatClockSource(combatSource)
Replace every gameManager.update(n) whose purpose is to advance the
battle with combatSource.advance(n). Leave update(n) calls that exist to
advance cultivation, production, or auto-farm exactly as they are — those are
world-clock assertions and this change must not alter them.

Where a single call did both, split it into two lines with a comment, because
the two clocks are now genuinely independent.

Before starting Step 8, produce a per-file checklist by running:

bash
for f in $(cat /tmp/combat-driving-tests.txt); do
  echo "=== $f ==="
  grep -n "update(" "$f"
done
Annotate each line as world or battle in the task summary before editing.

□ Step 9: Write the failing turn-engine integration test
Create src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts:

ts
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'

describe('turn engine integration', () => {
  it('reports a non-idle token state during a manual wait', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setBattleManualMode(true)
    startAStage(manager)

    source.advance(COMBAT_STEP_SECONDS * 200)

    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')
  })

  it('returns to idle after a manual choice resolves', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setBattleManualMode(true)
    startAStage(manager)

    source.advance(COMBAT_STEP_SECONDS * 200)
    manager.submitTurnChoice('basic')
    source.advance(COMBAT_STEP_SECONDS * 5)

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('running')
  })
})
Add getTurnTokenState() to the GameManager facade for this test. It is a
diagnostic accessor; do not use it in production code.

□ Step 10: Run the two integration tests
npx vitest run src/core/game/GameManagerTurnBattleOps.combatClock.test.ts src/core/game/GameManagerTurnBattleOps.turnEngine.test.ts

Expected: PASS.

□ Step 11: Run the full suite
npx vitest run

Expected: PASS. GameManager.fixedStepCatchup.test.ts will need attention —
the combat half of fixed-step catch-up no longer exists. Keep its world-side
assertions; delete the combat-side ones and say so in the commit body.

□ Step 12: Full verification
npm run type-check && npm run build && npx vitest run

Expected: all green.

□ Step 13: Runtime and browser evidence (P13 + P14)
npx playwright test --workers=1

Expected: 17/17 PASS.

Then npm run dev and, in Edge via playwright-cli: enter a stage and
confirm the countdown counts down smoothly rather than in three jumps, and
that turns follow one another without a one-second gap. State exactly what was
seen.

□ Step 14: Prepare commit (do not run without authorization)
bash
git add src/core/battle/turn/ src/core/game/ src/App.vue src/presentation/clock/
git commit -m "refactor(combat): combat counts on its own clock, not the world tick

The world's 1 Hz interval split into ten 0.1 s steps inside one JS frame, so a
three-second countdown reached Phaser as three bursts and several actors could
resolve in the same frame. Combat now advances on CombatClock at render
cadence, freezing while a turn is in flight. The turn token is the sole
authority on that freeze. The world tick is unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 7 — Electron main-process clock host
Under Electron, the renderer's RAF can be throttled even when the window is
focused and always when it is not. Run the timer on the main process and pass
ticks over IPC so the clock has an honest source.

Files.

Create: src/main-process/combatClockHost.ts

Create: src/main-process/combatClockHost.test.ts

Create: src/presentation/clock/MainProcessClockSource.ts

Create: src/presentation/clock/MainProcessClockSource.test.ts

Modify: electron/main.ts

Modify: electron/preload.ts

Modify: src/App.vue

Interfaces.

Main-process combatClockHost exposes start(intervalMs, send) and stop().

Preload exposes window.combatClock.onTick(cb) and .stop().

MainProcessClockSource implements ClockSource wraps the preload surface.

□ Step 1: Write the failing main-process host test
Create src/main-process/combatClockHost.test.ts:

ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCombatClockHost } from './combatClockHost'

describe('combatClockHost', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits elapsed seconds on each tick', () => {
    vi.useFakeTimers()
    const ticks: number[] = []
    const host = createCombatClockHost()

    host.start(50, (d) => ticks.push(d))
    vi.advanceTimersByTime(200)
    host.stop()

    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.every((d) => d > 0.04 && d < 0.06)).toBe(true)
  })

  it('stops cleanly', () => {
    vi.useFakeTimers()
    const ticks: number[] = []
    const host = createCombatClockHost()

    host.start(50, (d) => ticks.push(d))
    host.stop()
    vi.advanceTimersByTime(500)

    expect(ticks).toEqual([])
  })

  it('drops a stalled interval instead of replaying it', () => {
    // OS sleep, lid close, suspended process: the interval fires once with an
    // enormous elapsed. Combat has no catch-up, so that gap is discarded.
    vi.useFakeTimers()
    const ticks: number[] = []
    const host = createCombatClockHost()

    host.start(50, (d) => ticks.push(d))
    vi.advanceTimersByTime(50)

    const beforeStall = ticks.length

    // Jump the wall clock far past the stall threshold without running timers,
    // then let one interval fire.
    vi.setSystemTime(new Date(Date.now() + 8 * 60 * 60 * 1000))
    vi.advanceTimersByTime(50)

    host.stop()

    expect(ticks.length).toBe(beforeStall)
  })
})
□ Step 2: Run and confirm failure
npx vitest run src/main-process/combatClockHost.test.ts

Expected: FAIL — module not found.

□ Step 3: Implement combatClockHost
Create src/main-process/combatClockHost.ts:

ts
/**
 * Main-process clock host. The renderer's requestAnimationFrame can be
 * throttled by Chromium; the main process timer is not. This host ticks at a
 * fixed interval and sends the elapsed seconds to the renderer over IPC. The
 * combat engine sees only the injected ClockSource, so the transport is
 * invisible to it.
 */

/**
 * A gap larger than this means the process was not running - OS sleep, lid
 * close, suspension. It is reported as nothing at all rather than as elapsed
 * combat time, mirroring RafClockSource's STALL_THRESHOLD_MS. Combat has no
 * catch-up; a battle nobody was running did not advance.
 */
const STALL_THRESHOLD_SECONDS = 1

export interface CombatClockHost {
  start(intervalMs: number, send: (elapsedSeconds: number) => void): void
  stop(): void
}

export function createCombatClockHost(): CombatClockHost {
  let handle: NodeJS.Timeout | null = null
  let last = 0

  return {
    start(intervalMs, send) {
      if (handle !== null) {
        return
      }

      last = Date.now()

      handle = setInterval(() => {
        const now = Date.now()
        const elapsed = (now - last) / 1000
        last = now

        // Stall guard. An OS sleep, a lid close or a suspended process makes
        // setInterval fire once with an enormous elapsed - eight hours asleep
        // would hand the renderer 288000 steps to replay. That is catch-up, and
        // combat has none: a stalled interval reports nothing and the battle
        // simply resumes where it stood.
        if (elapsed > STALL_THRESHOLD_SECONDS) {
          return
        }

        if (elapsed > 0) {
          send(elapsed)
        }
      }, intervalMs)
    },

    stop() {
      if (handle !== null) {
        clearInterval(handle)
      }

      handle = null
    },
  }
}
□ Step 4: Run the host test
npx vitest run src/main-process/combatClockHost.test.ts

Expected: PASS.

□ Step 5: Write the failing MainProcessClockSource test
Create src/presentation/clock/MainProcessClockSource.test.ts:

ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { MainProcessClockSource } from './MainProcessClockSource'

describe('MainProcessClockSource', () => {
  it('forwards ticks from the preload bridge', () => {
    let handler: ((d: number) => void) | null = null
    const bridge = {
      onTick: vi.fn((cb: (d: number) => void) => {
        handler = cb
        return () => { handler = null }
      }),
      stop: vi.fn(),
    }

    const source = new MainProcessClockSource(bridge)
    const deltas: number[] = []
    source.start((d) => deltas.push(d))

    handler!(0.05)
    handler!(0.05)
    expect(deltas).toEqual([0.05, 0.05])

    source.stop()
    expect(bridge.stop).toHaveBeenCalled()
  })
})
□ Step 6: Run and confirm failure
npx vitest run src/presentation/clock/MainProcessClockSource.test.ts

Expected: FAIL.

□ Step 7: Implement MainProcessClockSource
Create src/presentation/clock/MainProcessClockSource.ts:

ts
import type { ClockSource } from '@/core/battle/turn/CombatClock'

export interface CombatClockBridge {
  onTick(callback: (elapsedSeconds: number) => void): () => void
  stop(): void
}

export class MainProcessClockSource implements ClockSource {
  private detach: (() => void) | null = null

  constructor(private readonly bridge: CombatClockBridge) {}

  start(onFrame: (elapsedSeconds: number) => void): void {
    if (this.detach !== null) {
      return
    }

    this.detach = this.bridge.onTick(onFrame)
  }

  stop(): void {
    this.detach?.()
    this.detach = null
    this.bridge.stop()
  }
}
□ Step 8: Wire Electron main, preload, and App.vue
electron/main.ts:

ts
const win = new BrowserWindow({
  webPreferences: {
    backgroundThrottling: false,
    preload: /* existing path */,
  },
})

const host = createCombatClockHost()

ipcMain.on('combat-clock:start', () => {
  host.start(16, (elapsed) => win.webContents.send('combat-clock:tick', elapsed))
})

ipcMain.on('combat-clock:stop', () => {
  host.stop()
})
electron/preload.ts:

ts
contextBridge.exposeInMainWorld('combatClock', {
  onTick: (cb: (elapsedSeconds: number) => void) => {
    const handler = (_e: unknown, elapsed: number) => cb(elapsed)
    ipcRenderer.on('combat-clock:tick', handler)
    ipcRenderer.send('combat-clock:start')

    return () => {
      ipcRenderer.removeListener('combat-clock:tick', handler)
      ipcRenderer.send('combat-clock:stop')
    }
  },
  stop: () => ipcRenderer.send('combat-clock:stop'),
})
src/App.vue, replacing the RafClockSource line from Task 6 Step 9:

ts
const combatClockSource = window.combatClock
  ? new MainProcessClockSource(window.combatClock)
  : new RafClockSource()

gameManager.setCombatClockSource(combatClockSource)
Declare the window.combatClock type in a .d.ts if the repo has one.

□ Step 9: Run the new suites
npx vitest run src/main-process/ src/presentation/clock/ && npm run type-check

Expected: PASS, 0 errors.

□ Step 10: Runtime evidence (P13 + P14)
npx playwright test --workers=1

Expected: 17/17 PASS.

Then build and launch the Electron app, minimize the window for ~20 s, restore
it, and confirm the battle advanced by roughly the wall-clock elapsed time. Log
getElapsedCombatSteps() on window focus to make the comparison direct.

□ Step 11: Prepare commit (do not run without authorization)
bash
git add src/main-process/ src/presentation/clock/MainProcessClockSource.ts \
        src/presentation/clock/MainProcessClockSource.test.ts \
        electron/main.ts electron/preload.ts src/App.vue
git commit -m "feat(combat): run the clock source on the Electron main process

Chromium throttles the renderer's RAF; the main process timer is not throttled.
backgroundThrottling is disabled for the same reason. The combat engine sees
only the ClockSource interface and is unaware of the transport.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 8 — The unwatched pause (A11)
Even with the main-process clock, an OS sleep or a closed lid cannot be
compensated for. The pause is the user-facing guarantee that combat is not
running invisibly.

Files.

Create: src/composables/useCombatPause.ts

Create: src/composables/useCombatPause.test.ts

Create: src/components/game/combat/CombatPauseOverlay.vue

Create: src/components/game/combat/CombatPauseOverlay.test.ts

Modify: src/App.vue

Interfaces.

useCombatPause(gameManager) returns
{ isPaused: Ref<boolean>, continueBattle: () => void, dispose: () => void }.

□ Step 1: Write the failing composable test
Create src/composables/useCombatPause.test.ts:

ts
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

    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(isPaused.value).toBe(true)
    expect(calls).toEqual(['freeze:tab-hidden'])

    continueBattle()
    expect(isPaused.value).toBe(false)
    expect(calls).toEqual(['freeze:tab-hidden', 'resume:tab-hidden'])

    dispose()
  })

  it('does not pause when not in combat', () => {
    stubVisibility()
    const calls: string[] = []
    const gameManager = {
      freezeCombat: (r: string) => calls.push(`freeze:${r}`),
      resumeCombat: (r: string) => calls.push(`resume:${r}`),
    }

    const { isPaused, dispose } = useCombatPause(gameManager as any, {
      isCombatActive: () => false,
    })

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))

    expect(isPaused.value).toBe(false)
    expect(calls).toEqual([])

    dispose()
  })
})
□ Step 2: Run and confirm failure
npx vitest run src/composables/useCombatPause.test.ts

Expected: FAIL.

□ Step 3: Implement the composable
Create src/composables/useCombatPause.ts:

ts
import { ref, type Ref } from 'vue'

interface CombatClockOwner {
  freezeCombat(reason: 'tab-hidden'): void
  resumeCombat(reason: 'tab-hidden'): void
}

interface Options {
  /**
   * Returns true while a battle is present and on screen. When false, a
   * visibility change does not pause: there is nothing to pause, and the
   * overlay must not appear outside combat.
   */
  isCombatActive?: () => boolean
}

/**
 * An unwatched battle pauses visibly and waits for Continue.
 *
 * Returning to the tab deliberately does NOT resume: the player must see what
 * they are resuming into. This is what makes "combat has no catch-up" honest,
 * because nobody is asked to reason about time they did not watch.
 */
export function useCombatPause(
  gameManager: CombatClockOwner,
  options: Options = {},
): {
  isPaused: Ref<boolean>
  continueBattle: () => void
  dispose: () => void
} {
  const isPaused = ref(false)

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'hidden' || isPaused.value) {
      return
    }

    if (options.isCombatActive && !options.isCombatActive()) {
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
□ Step 4: Run the test
npx vitest run src/composables/useCombatPause.test.ts

Expected: PASS.

□ Step 5: Write the failing overlay test
Create src/components/game/combat/CombatPauseOverlay.test.ts:

ts
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
If the repo mounts components via createApp instead of @vue/test-utils,
follow the local convention and keep the assertion.

□ Step 6: Run and confirm failure
npx vitest run src/components/game/combat/CombatPauseOverlay.test.ts

Expected: FAIL.

□ Step 7: Implement the overlay
Create src/components/game/combat/CombatPauseOverlay.vue:

vue
<script setup lang="ts">
/**
 * The pause overlay is not the curtain. The curtain belongs to the
 * presentation coordinator and covers route transitions; this belongs to the
 * battle and covers a stopped clock. Separate owners, separate layers,
 * neither drives the other.
 *
 * It dims and blocks input. It does not stop the scene: units keep breathing
 * behind it. A paused battle must look like a battle waiting, not like a
 * screenshot, so the dim is light enough to see the units.
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
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
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
□ Step 8: Mount it in App.vue
ts
const { isPaused: isCombatPaused, continueBattle, dispose: disposeCombatPause } =
  useCombatPause(gameManager, {
    isCombatActive: () => gameManager.getCombatClockState() !== 'stopped',
  })
Add disposeCombatPause() to onUnmounted. In the template, inside the game
branch and below the transition overlay:

vue
<CombatPauseOverlay v-if="isCombatPaused" @continue="continueBattle" />
□ Step 9: Run the suites
npx vitest run src/composables/useCombatPause.test.ts src/components/game/combat/CombatPauseOverlay.test.ts src/App.wiring.test.ts && npm run type-check

Expected: PASS, 0 errors.

□ Step 10: Browser evidence (P14)
npm run dev, then in Edge: start a battle, switch to another tab for ~10 s,
come back. Confirm the overlay is showing, the gauge has not moved, and the
battle resumes only after pressing Continue.

Then verify A7 explicitly: take two screenshots ~1 s apart while the pause
overlay is up, and confirm the character sprites are on different animation
frames. If they are identical, something is pausing the scene and that is a
defect, not a pause. Do the same during an unbounded manual-choice wait.

□ Step 11: Prepare commit (do not run without authorization)
bash
git add src/composables/useCombatPause.ts src/composables/useCombatPause.test.ts \
        src/components/game/combat/CombatPauseOverlay.vue src/components/game/combat/CombatPauseOverlay.test.ts \
        src/App.vue
git commit -m "feat(combat): pause an unwatched battle and wait for Continue

Returning to the tab does not resume. A battle only runs while it is watched,
and the player never has to reason about time they did not see.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 9 — Telegraph interpolation (presentation half)
Snapshots become targets; CombatScene interpolates toward them on Phaser's
own clock, exactly as it already does for positions.

Files.

Modify: src/game/scenes/CombatScene.ts

Test: src/game/scenes/CombatScene.turnCountdownSpawn.test.ts

Interfaces.

CombatScene.update(time: number, delta: number) replaces the current
zero-argument update().

□ Step 1: Write the failing test
Add to src/game/scenes/CombatScene.turnCountdownSpawn.test.ts:

ts
it('interpolates the telegraph between snapshots instead of jumping', () => {
  const { scene, handles } = makeSceneWithCountdown()

  scene.onTurnBattleEntitySnapshot(snapshotWithProgress(0))
  scene.onTurnBattleEntitySnapshot(snapshotWithProgress(0.5))

  scene.update(0, 8)
  const midway = handles[0].lastProgress

  expect(midway).toBeGreaterThan(0)
  expect(midway).toBeLessThan(0.5)

  scene.update(0, 200)
  expect(handles[0].lastProgress).toBeCloseTo(0.5, 2)
})
Build makeSceneWithCountdown, snapshotWithProgress, and the spy handle by
following the fixtures already present in that file.

□ Step 2: Run and confirm failure
npx vitest run src/game/scenes/CombatScene.turnCountdownSpawn.test.ts -t "interpolates the telegraph"

Expected: FAIL.

□ Step 3: Store the target instead of applying it
In reconcileTurnCountdownSpawn, replace existing.update(event.countdownProgress)
with a target write, and add the fields:

ts
  private telegraphTarget = 0
  private telegraphShown = 0
ts
      if (existing) {
        this.telegraphTarget = event.countdownProgress
        continue
      }
Keep the undefined branch as-is: flushing handles on countdown end is
mechanism, not art.

□ Step 4: Chase the target in update
ts
  update(_time: number, delta: number) {
    // Existing body stays here.

    this.advanceTelegraph(delta)
  }

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
Reset telegraphTarget and telegraphShown to 0 wherever
turnCountdownSpawnVfxHandles.clear() already runs.

□ Step 5: Run the scene suites
npx vitest run src/game/scenes/

Expected: PASS. Any test calling scene.update() with no arguments needs
scene.update(0, 16).

□ Step 6: Full verification
npm run type-check && npm run build && npx vitest run

Expected: all green.

□ Step 7: Browser evidence (P14)
npm run dev, Edge: start a stage and watch the party spawn telegraph. Confirm
it advances continuously across its full duration rather than in three beats.
Capture screenshots or describe frame-by-frame what changed.

□ Step 8: Prepare commit (do not run without authorization)
bash
git add src/game/scenes/CombatScene.ts src/game/scenes/CombatScene.turnCountdownSpawn.test.ts
git commit -m "fix(combat): interpolate the spawn telegraph on the render clock

Snapshots are targets, not frames. The telegraph no longer shows only as many
steps as the simulation happens to publish.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 10 — External command boundary (spec §9)
The law: a command never mutates battle state at the moment it arrives. This
is the direct answer to the interleaving-corruption risk.

Files.

Modify: src/core/game/GameManagerTurnBattleOps.ts

Modify: src/core/game/GameManager.ts

Test: src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts

Interfaces.

GameManagerTurnBattleOps.enqueueAtTurnBoundary(command: () => void): void

GameManager.enqueueAtTurnBoundary(command: () => void): void

□ Step 1: Enumerate mid-battle mutators
bash
grep -rn "recomputeTurnStats\|TurnStatsRecompute\|setBattleManualMode\|battleRunMode" \
  src --include=*.ts --include=*.vue | grep -v "\.test\." | sort
Record every call site that can fire while getBattle() is non-null. Route
only those. An empty route is worse than no route, because it implies a
guarantee that is not there.

□ Step 2: Write the failing test
Create src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts:

ts
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'

describe('external commands land at a turn boundary', () => {
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

    source.advance(COMBAT_STEP_SECONDS * 10)
    expect(applied).toEqual([])

    manager.submitTurnChoice('basic')
    source.advance(COMBAT_STEP_SECONDS * 5)

    expect(applied).toEqual(['gear-change'])
  })

  it('holds commands while a manual turn remains unresolved', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('x'))

    source.advance(COMBAT_STEP_SECONDS * 10000)
    expect(applied).toEqual([])
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
□ Step 3: Run and confirm failure
npx vitest run src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts

Expected: FAIL.

□ Step 4: Implement the queue
In GameManagerTurnBattleOps:

ts
  /**
   * Commands arrive on wall-clock time; battle state changes on turn
   * boundaries. Queueing them gives exactly one instant at which combat state
   * may change from outside, and at that instant no action is in flight.
   */
  private boundaryQueue: Array<() => void> = []

  enqueueAtTurnBoundary(command: () => void): void {
    if (!this.turnBattle) {
      command()
      return
    }

    if (this.turnToken.getState() === 'IDLE') {
      command()
      return
    }

    this.boundaryQueue.push(command)
  }

  private drainBoundaryQueueIfIdle(): void {
    if (this.boundaryQueue.length === 0) {
      return
    }

    if (this.turnToken.getState() !== 'IDLE') {
      return
    }

    const queued = this.boundaryQueue
    this.boundaryQueue = []

    for (const command of queued) {
      command()
    }
  }
drainBoundaryQueueIfIdle is called at the top of stepTurnBattle (see Task 6
Step 6). Because the clock is frozen whenever the token is not idle, a step
only arrives when the token is idle, and the drain runs before tickPacing
can claim the next turn. That instant is the boundary.

Clear the queue in three places - `startStage`, `abandonBattle`, **and the
`RESOLVING -> COMBAT_OVER` transition**:

ts
    this.boundaryQueue = []
The third one is the easy one to miss and the one that actually bites. A
victory or defeat never passes through `abandonBattle`, so a command queued
during the last turn of one battle would sit in the queue and drain into the
NEXT battle's first boundary - a gear change from a fight that is already over,
applied to a fight that just started. Hook it where the token reports
`COMBAT_OVER`, next to `clock.stop()`.

Add the facade on GameManager:

ts
  enqueueAtTurnBoundary(command: () => void): void {
    this.turnBattleOps.enqueueAtTurnBoundary(command)
  }
□ Step 4a: Write the failing cross-battle leak test
Add to src/core/game/GameManagerTurnBattleOps.commandBoundary.test.ts:

ts
  it('discards commands queued against a battle that ended', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('stale'))

    // End this battle, then start a fresh one and let it reach a boundary.
    manager.abandonBattle()
    startAStage(manager)
    source.advance(COMBAT_STEP_SECONDS * 400)

    expect(applied).toEqual([])
  })

Run it, watch it fail, then make it pass with the three clear sites above.
Repeat the same assertion for a battle that ends in victory rather than abandon
- that is the path abandonBattle does not cover.

□ Step 5: Route the call sites from Step 1
For each mid-battle mutator found in Step 1, wrap its battle-affecting body in
gameManager.enqueueAtTurnBoundary(() => { ... }). Leave submitTurnChoice
alone: it is consumed by AWAITING_INPUT, not deferred past it.

□ Step 6: Run the tests
npx vitest run src/core/game/ src/composables/

Expected: PASS.

□ Step 7: Full verification
npm run type-check && npm run build && npx vitest run

Expected: all green.

□ Step 8: Prepare commit (do not run without authorization)
bash
git add src/core/game/ src/composables/
git commit -m "feat(combat): apply external commands at the turn boundary

There is now exactly one instant at which combat state may change from outside,
and at that instant no action is in flight and the clock is stopped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Task 11 — Lock the classification and update the roadmap
Files.

Create: src/core/game/CombatTimeClassification.test.ts

Modify: docs/roadmap.md

Create: docs/qa/2026-09-10-combat-turn-mechanism.md

□ Step 1: Write the parity test
Create src/core/game/CombatTimeClassification.test.ts:

ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Every time-dependent combat field belongs to exactly one authority. This
 * test is the enforcement: it fails when a new seconds-valued or delta-driven
 * path appears in the combat engine without a classification.
 */
describe('combat time classification', () => {
  it('no combat engine file consumes deltaSeconds', () => {
    const files = [
      'src/core/battle/turn/TurnBattleSystem.ts',
      'src/core/battle/turn/TurnSkillAction.ts',
      'src/core/battle/turn/ActionGauge.ts',
    ]

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} must not consume world deltaSeconds`)
        .not.toMatch(/deltaSeconds|\bdt\b|\bdelta\b/i)
    }
  })

  it('the world tick no longer drives the turn battle', () => {
    const source = readFileSync('src/core/game/GameManagerTurnBattleOps.ts', 'utf8')
    const battleBranchStart = source.indexOf('updateBattleFixedStep')
    const nextMethod = source.indexOf('\n  private stepTurnBattle', battleBranchStart)
    const sliceEnd = nextMethod === -1 ? undefined : nextMethod

    expect(source.slice(battleBranchStart, sliceEnd))
      .not.toMatch(/tickPacing|tickIntro|tickCountdown/)
  })

  it('no freeze is implemented by pausing the Phaser scene', () => {
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

  it('the turn-in-flight predicate is the token state, not a mirrored flag', () => {
    const source = readFileSync(
      'src/core/battle/turn/CombatAnimationRuntime.ts',
      'utf8',
    )
    const fnStart = source.indexOf('isTurnInFlight')
    const fnEnd = source.indexOf('\n  }', fnStart)

    expect(source.slice(fnStart, fnEnd)).toMatch(/turnToken\.getState\(\)/)
  })

  it('the countdown display is the only combat surface expressing seconds', () => {
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
        .filter((line) => {
          const trimmed = line.trimStart()
          if (trimmed.startsWith('*') || trimmed.startsWith('//')) {
            return false
          }
          return /\bSeconds\b|\bseconds\b/.test(line)
        })

      expect(offenders, `${file} must express combat durations in steps, not seconds`)
        .toEqual([])
    }
  })
})
□ Step 2: Run it
npx vitest run src/core/game/CombatTimeClassification.test.ts

Expected: PASS after Tasks 6 and 10. If it fails, fix the source, not the test.

□ Step 3: Update the roadmap
In docs/roadmap.md, add an entry recording the contract:

Combat owns a self-counting clock with no catch-up. The clock freezes while a
turn is in flight via the turn-in-flight freeze reason.

A turn is one token. Turn order is one-at-a-time by construction. Turn-end is
a drained resolution pipeline, not an event.

External commands land at the turn boundary; internal effects apply
immediately.

Cooldowns are counted in turns with one authority.

The world tick's cadence is unchanged.

The Electron host runs the clock source on the main process with
backgroundThrottling: false.

Retained debt: no mid-combat save, no multi-tab leader election, OS sleep
resumes without catch-up.

Link both spec paths.

□ Step 4: Full verification and QA gate
npm run type-check && npm run build && npx vitest run && npx playwright test --workers=1

Expected: all green, 17/17 E2E.

Then run the adversarial QA pass and write the result to
docs/qa/2026-09-10-combat-turn-mechanism.md. QA-pass writes are restricted to
**/*.test.ts, tests/e2e/**, docs/qa/** — no production edits.

□ Step 5: Prepare commit (do not run without authorization)
bash
git add src/core/game/CombatTimeClassification.test.ts docs/roadmap.md docs/qa/
git commit -m "test(combat): lock the time classification and record the contract

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
Known cost, stated up front
Task 6 is large and cannot be split without leaving the suite red between
commits: roughly 16–20 test files drive battles through gameManager.update()
and must move to the manual clock source in the same change that stops the
world tick from driving combat.

If the scope needs to shrink, the honest split is to stop after Task 3. Tasks
1–3 fix the curtain and the turn gate, are independent of the clock work, and
are shippable on their own. Tasks 4–5 are pure additions and can land in any
order after that. Tasks 6 and 7 must land together. Tasks 8–11 are independent
of one another and can land in any order once 6 and 7 are in.
---

## Review resolution status (2026-09-10)

The review below was written against the previous revision. This section records
what has been folded in since, so nobody reads a resolved finding as open.

### Blockers — all closed

| # | Finding | Where it is now |
|---|---|---|
| A1 | `TurnPipeline` owned by nobody, fed by nobody, drained by nobody | **Task 5.5** (new). Ownership, step construction, drain, and the bridge to the existing three-signal handshake |
| A2 | Animation completion signal undefined | Spec §4.1a + Task 5.5 Step 6. `acknowledgeTurnReady` / `acknowledgeActionImpact` / `acknowledgeActionComplete` are the signals; `ANIMATION_FALLBACK_MS` is the backstop |
| A3 | `advanceCombat` spends the rest of a batch after the token is claimed | Task 6 Step 5. The loop breaks the moment the token leaves `IDLE`; leftover steps are dropped, never banked |
| A4 | Main-process clock replays an OS sleep as catch-up | Task 7. `STALL_THRESHOLD_SECONDS` in `combatClockHost`, with a regression test that jumps the system clock eight hours |
| A5 | A `COMBAT_OVER` token is inherited by the next battle | Spec §3.3 + Task 5.5 Step 3. `turnToken.reset()` in `startStage`, with a test |
| A6 | Boundary queue survives a victory into the next battle | Spec §9.2 + Task 5.5 Step 7 + Task 10. Cleared at `RESOLVING → COMBAT_OVER` as well as `startStage` and abandon, with a cross-battle leak test |
| C2 | Relationship between `TurnToken` and `TurnBattleState` undefined | Spec §3.3. The token is active only while the phase is `fighting`; intro and countdown cannot claim it |

### Also folded in

- **C1** — A7 is now scoped to a visible window (turn mechanism spec §12). Browser throttling of a hidden tab is platform behaviour, and A11's pause is the response.
- **C3** — Task 5.5 Step 8 retires `isActionPlaybackWaiting` / `isAwaitingManualTurnChoice` or derives them from the token, with a grep step to prove no third representation survives.
- **D3** — Flee is an external command and queues to the boundary (spec §9.1), stated with its UX cost.
- **D5** — The token holder's action animation completes, then the death animation plays; never blended, never overlapped (spec §4.5).
- **E5** — `drain()` is non-re-entrant and the chain-depth counter belongs to the turn, so it survives a park and resume (spec §4.1a, with two tests).

### Still open, deliberately deferred

These were classed "có thể làm sau" and are **not** covered by any task yet. They
are recorded here so they are not lost:

- **B1** — counter skill wiring (`counterable` / `counterSkillId` are declared but nothing pushes a counter `REACTION`). AC-2 and AC-3 are untested until this lands.
- **B2** — aura lifecycle (apply inside `HIT_RESOLUTION`, remove on buff expiry). AC-11 untested.
- **B3** — buff decrement at `CLAIMED → RESOLVING`.
- **B4** — chain-depth limit is unit-tested in the pipeline but not at integration level. AC-8 untested end to end.
- **B5** — death check after every damage apply. AC-15 untested.
- **D1** — the manual-mode UI is assumed to exist (`useTurnCombatManual`, `TurnCombatSkillBar`, `CombatSkillSlot`); no task references or verifies it against `AWAITING_INPUT`.
- **D2** — nobody blocks input while the token is non-`IDLE`. Clicks that are neither `submitTurnChoice` nor an external command have no defined behaviour.
- **E2** — no dev inspector for `{ tokenState, pipelineDepth, clockState, freezeReasons, elapsedSteps }`. Worth having before debugging this machinery in anger.
- **E4** — Electron's `visibilitychange` timing is assumed to match the browser; untested on Electron.
- **E6** — `CombatPauseOverlay` has `role="dialog"` but no focus trap.

Anything in this list that turns out to block a task during execution upgrades
to a blocker and stops that task, per the plan's own escalation rule.

---

A. Lỗ hổng nghiêm trọng — sẽ gây bug nếu không xử lý
A1. TurnPipeline không ai instantiate, không ai push steps
Task 5 tạo TurnPipeline và test nó. Task 6 dùng TurnToken cho freeze reason. Nhưng:

Không task nào nói ai giữ instance của TurnPipeline

Không task nào nói ai push ANIMATION step khi action bắt đầu

Không task nào nói ai push HIT_RESOLUTION khi animation đến hit frame

Không task nào nói ai push REACTION khi hit resolve

Không task nào nói ai gọi pipeline.drain()

Đây là lỗ hổng lớn nhất. Spec định nghĩa pipeline, plan test pipeline, nhưng không có cầu nối giữa pipeline và TurnBattleSystem/CombatAnimationRuntime. Task 6 chỉ wire token state → clock freeze. Pipeline hiện đang là dead code.

Cần: một task wire pipeline vào engine, và một task cho animation callbacks (xem A2).

A2. Animation completion callback không được đề cập
ANIMATION step cần biết khi animation kết thúc để complete. Phaser có animationcomplete event, nhưng:

Plan không nói event này được dùng

Plan không nói ai subscribe

Plan không nói nếu animation bị cancel giữa chừng (actor chết) thì step complete thế nào

Nếu ANIMATION step không complete được → pipeline treo → token không về IDLE → clock frozen vĩnh viễn.

Cần: định nghĩa rõ animation completion signal. Có thể dùng Phaser event, có thể dùng duration biết trước, có thể dùng cả hai với fallback timeout.

A3. Vòng lặp advanceCombat không check token state
Task 6 Step 5:

ts
private advanceCombat(steps: number): void {
  for (let i = 0; i < steps; i += 1) {
    this.stepTurnBattle()
  }
}
Nếu source.advance(0.5) → steps = 5. Vòng lặp chạy 5 lần. Lần 1 claim token (state = AWAITING_INPUT). Lần 2-5 vẫn chạy vì loop không check token state. Clock đã frozen nhưng vòng lặp đã nhận steps rồi.

Kết quả: gauge bị tick thêm 4 lần trong lúc token không IDLE. Đúng cái bug mà spec §A3 muốn tránh.

Fix:

ts
private advanceCombat(steps: number): void {
  for (let i = 0; i < steps; i += 1) {
    if (this.turnToken.getState() !== 'IDLE') {
      break
    }
    this.stepTurnBattle()
  }
}
Hoặc clock emit từng step một. Nhưng spec nói "no catch-up", nên drop các step còn lại là đúng.

A4. Main-process clock không có stall guard — OS sleep = catch-up
Task 7 combatClockHost:

ts
handle = setInterval(() => {
  const now = Date.now()
  const elapsed = (now - last) / 1000
  last = now
  if (elapsed > 0) send(elapsed)
}, intervalMs)
Nếu OS sleep 8 tiếng, setInterval fire 1 lần sau khi wake với elapsed = 28800s. Gửi xuống renderer. CombatClock nhận, steps = 288000. advanceCombat chạy 288000 lần.

Đây chính xác là catch-up mà spec §A10 cấm. RafClockSource có STALL_THRESHOLD_MS = 500, nhưng combatClockHost thì không.

Fix: host cũng phải có stall threshold, ví dụ drop nếu elapsed > 1s. Hoặc dùng powerMonitor.on('resume') của Electron để reset last = Date.now() và freeze clock.

A5. TurnToken không reset khi startStage
TurnToken là instance field. Nếu battle cũ kết thúc với state COMBAT_OVER, battle mới gọi startStage → token vẫn là COMBAT_OVER. claim() sẽ throw vì state không IDLE.

Fix: hoặc tạo token mới trong startStage, hoặc thêm reset() method vào TurnToken và gọi từ startStage.

A6. Boundary queue không clear khi battle kết thúc tự nhiên
Task 10 nói clear queue trong startStage và abandonBattle. Nhưng battle có thể kết thúc qua COMBAT_OVER (victory/defeat) — path này không đi qua abandonBattle.

Nếu player enqueue command, battle kết thúc, command vẫn nằm trong queue. Battle tiếp theo drain → command của battle cũ chạy trong battle mới.

Fix: clear queue ở RESOLVING → COMBAT_OVER transition.

B. Spec có, plan không có — dead spec
B1. Counter skill chưa được wire
Spec §7.1 định nghĩa counterable và counterSkillId. Task 5 chỉ add fields với giá trị false/null. Không task nào wire logic "khi bị counterable attack, push REACTION với counterSkillId".

Không có task test AC-2 (counter miss) hay AC-3 (counter kills A).

B2. Aura lifecycle chưa được wire
Spec §6 nói aura decrement ở CLAIMED → RESOLVING. Không task nào implement.

Không có task test AC-11 (aura không extend turn).

B3. Buff decrement chưa được wire
Spec §6 nói buff decrement ở CLAIMED → RESOLVING. Không task nào implement.

B4. Chain depth limit chưa được wire vào engine
TurnPipeline.drain() có chain depth limit. Nhưng nếu pipeline không được dùng (xem A1), limit này không bao giờ chạy. AC-8 không được test ở integration level.

B5. AC-15 (death check per damage) chưa có task
Spec định nghĩa death check sau mỗi damage. Không task nào implement. Không test.

C. Mâu thuẫn spec vs reality
C1. A7 "animation keeps playing through every freeze" — trái với browser reality
Spec nói character animation phải tiếp tục chạy qua mọi freeze. Nhưng khi tab hidden, browser throttle RAF → Phaser loop dừng → animation dừng.

Đây không phải lỗi code, mà là mâu thuẫn giữa spec và nền tảng. Spec cần note rõ:

A7 áp dụng cho freeze khi tab visible (manual wait, turn in-flight). Khi tab hidden, browser throttle là hành vi nền tảng không thể tránh, và pause overlay (A11) là response.

C2. State machine spec không có INTRO/COUNTDOWN
Spec §3 định nghĩa 5 states: IDLE, CLAIMED, AWAITING_INPUT, RESOLVING, COMBAT_OVER. Nhưng TurnBattleSystem hiện có state = 'intro' | 'countdown' | 'fighting'.

Hai state machine này sống ở 2 layer khác nhau nhưng spec không nói quan hệ. Câu hỏi mở:

Trong intro/countdown, token state là gì? IDLE? Nhưng nếu IDLE, stepTurnBattle gọi tickIntro → OK. Nhưng tickPacing không được gọi trong intro. OK.

Khi nào token bắt đầu được phép claim? Sau countdown → fighting.

Spec cần nói rõ: "Turn token chỉ active trong phase fighting. Intro và countdown không chiếm token."

C3. isTurnInFlight() cũ vẫn còn ở nơi khác
Plan Task 6 Step 4 đổi isTurnInFlight() thành token predicate. Nhưng plan cũ có isActionPlaybackWaiting() và isAwaitingManualTurnChoice(). Hai method này có bị xóa không? Nếu không, có 3 predicate cùng tồn tại.

Cần: xóa hoặc redirect về token predicate.

D. Chưa được address trong plan
D1. Manual mode UI
Spec §7 nói AWAITING_INPUT state. Nhưng UI để player chọn action trong manual mode là gì? Plan không có component nào. Giả định UI cũ có sẵn? Nếu có, plan nên reference. Nếu không, thiếu task.

D2. Input blocking khi turn in-flight
Khi token không IDLE, clock frozen. Nhưng player vẫn có thể click UI (ability button, item button). Click đó làm gì?

Nếu là submitTurnChoice trong AWAITING_INPUT → OK

Nếu là command khác → cần boundary queue (Task 10)

Nếu là UI không có semantic → cần block

Plan không nói ai block input, block ở đâu.

D3. Flee / retreat / party swap
Đây là external commands. Có bị queue không? Nếu player muốn flee khẩn cấp trong manual wait, họ phải:

Submit turn choice → turn resolve → boundary → flee command execute

Nghĩa là flee mất thêm 1 turn. Có thể không phải UX mong muốn.

Plan cần nói rõ: flee là external command (queue), hay là special case (immediate)?

D4. getTurnTokenState() là public API cho test
Task 6 Step 9 thêm accessor này. Nhưng public API không nên tồn tại chỉ cho test. Cần:

Đánh dấu @internal trong JSDoc

Hoặc dùng __testing namespace

Hoặc chỉ expose qua test helper

D5. Turn của actor chết — animation behavior
Case 3 (counter kills A): A là token holder, A chết trong turn của mình. Animation attack của A đang chạy. Khi A chết:

Animation attack tiếp tục đến hết?

Chuyển ngay sang death animation?

Blend?

Plan không nói. Đây là design question, không chỉ implementation. Cần quyết định trước khi code.

D6. backgroundThrottling: false cho tất cả windows
Plan chỉ nói window chính. Nếu game có multi-window (settings, debug, overlay), cần set cho tất cả.

E. Vấn đề nhỏ nhưng nên biết
E1. IPC overhead 60/s
Task 7 dùng interval 16ms → 60 IPC/s từ main sang renderer. Có thể chấp nhận được nhưng plan không đề cập overhead.

E2. Debug tooling
Không có task nào thêm inspector để xem token state, pipeline steps, clock reasons trong runtime. Debug các bug A1-A6 sẽ rất khó nếu không có.

Đề xuất: thêm dev-only overlay hiển thị { tokenState, pipelineDepth, clockState, freezeReasons, elapsedSteps }.

E3. Metrics / logging
Chỉ có chain depth warning. Không có log cho các transition, không đo turn duration, không đo chain depth distribution. Khó phát hiện regression.

E4. Electron visibilitychange behavior khác browser
Trong Electron, document.visibilityState fire khi window minimize? Có, nhưng timing khác. Plan giả định giống browser. Cần test riêng trên Electron.

E5. TurnPipeline.drain() re-entrancy
drain() có thể được gọi lại trong khi queue còn? Plan không nói. Nếu có, reactionDepth reset về 0 giữa chừng — chain depth limit không hoạt động đúng.

E6. CombatPauseOverlay accessibility
Đã nhắc lần trước: role="dialog" nhưng không có focus trap. Player dùng keyboard có thể tab ra ngoài.

F. Tóm tắt — những gì phải làm trước khi implement
Blockers (phải có trước khi code):

A1 — Task wire TurnPipeline vào engine (task mới)

A2 — Định nghĩa animation completion signal (task mới)

A3 — Fix advanceCombat break on token non-idle

A4 — Stall guard cho main-process host

A5 — Reset token khi startStage

A6 — Clear boundary queue khi COMBAT_OVER

C2 — Định nghĩa quan hệ giữa TurnToken state và TurnBattleSystem state

Nên làm trước:

D5 — Quyết định animation của token holder khi chết

D3 — Quyết định flee/retreat là external hay special

D1 — Reference UI manual mode hiện có

Có thể làm sau:

B1-B5 — Wire counter, aura, buff decrement, death check (mỗi cái là task riêng)

D2 — Input blocking

E2 — Debug inspector

E4 — Electron visibilitychange test

E6 — Focus trap

G. Đánh giá lại plan
Plan đã tốt hơn nhiều sau 2 vòng. Nhưng nó vẫn còn hở ở tầng engine integration. Task 5 tạo pipeline, Task 6 dùng token, nhưng không ai nối chúng vào TurnBattleSystem và CombatAnimationRuntime.

Nói thẳng: nếu implement đúng theo plan hiện tại, pipeline sẽ không bao giờ chạy, và turn-end sẽ vẫn được quyết định bởi các flag cũ. Clock sẽ frozen nhờ token state, nhưng token chỉ được claim/release bởi stepTurnBattle — mà stepTurnBattle lại không được pipeline điều khiển. Vòng luẩn quẩn.

Đây là khoảng trống kiến trúc lớn nhất. Cần một task mới (đặt giữa Task 5 và Task 6) định nghĩa:

Ai giữ TurnPipeline

Ai push steps

Ai gọi drain()

Animation completion signal là gì

Khi nào TurnToken.resolve() được gọi

Task này có thể gọi là Task 5.5 — Wire turn engine into TurnBattleSystem.

Sau khi thêm task đó, plan mới thực sự implement được spec.