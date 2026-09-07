# Combat Runtime/Presentation/Logic Separation + Gameplay Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (project convention, AGENTS.md P6: Claude Code sessions with subagent-dispatch available prefer SDD; opencode agents without one always use Inline Execution instead). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the combat engine's presentation-ack machinery into an
isolated `CombatAnimationRuntime` (per AGENTS.md P17), and fix the 3
playtest symptoms (enemy spawn overlap, combat too fast to observe,
attacking an empty top-left cell) plus add the missing intro/transition
phase before countdown.

**Architecture:** `TurnBattleSystem` stays the business-logic system
(gauge-advance decisions, targeting, wave triggers, victory conditions).
`CombatAnimationRuntime` (new) becomes the timing/presentation-ack
component — it owns the `pendingReadyActor`/`pendingDeclaredAction`/
`pendingImpact`/`playbackToken`/`presentationActive`/`battleManualMode`/
`awaitedManualActor` state currently loose on `GameManager`, and derives
per-actor animation state for Phaser to read. `GameManager` becomes a
thin forwarder to the runtime for all ack/presentation methods — no
public signature changes. `CombatSystem`/`ActionImpactSystem` (damage)
and `CombatScene.ts` (Phaser presentation) are untouched boundaries.

**Tech Stack:** TypeScript, Vue 3, Phaser 3, Vitest, Playwright (P14).

**Spec:** `docs/superpowers/specs/2026-09-07-combat-runtime-separation-design.md`

## Global Constraints

- P17 (`AGENTS.md`): a runtime/clock component's only job is timing —
  never business/gating logic. Presentation (Phaser) owns animation/VFX
  playback and acks back. Damage stays in its own system. No component
  mutates another's private state directly.
- P15: new/edited code comments are English, plain ASCII only.
- P16: new hardcoded UI strings go through i18n (`useI18n({ useScope:
  'local' })` + locale JSON), not literal Vietnamese in `.vue`/`.ts`.
- No change to damage math, targeting rules (`selectTarget()`), or the
  overall wave-batch spawn algorithm shape — only the within-wave slot
  collision behavior (spec Non-Goals).
- No manual-mode UI work — auto mode is the only path today and stays
  that way after this plan.
- `GameManager.acknowledgeTurnReady()`/`acknowledgeActionImpact()`/
  `acknowledgeActionComplete()`/`setPresentationActive()`/
  `setBattleManualMode()`/`isBattleManualMode()`/
  `isAwaitingManualTurnChoice()`/`submitTurnChoice()`/
  `isActionPlaybackWaiting()`/`expectPresentationLayer()`/
  `isAwaitingPresentationLayer()` keep their exact existing signatures —
  `CombatScene.ts` and existing tests call them unchanged.

---

### Task 1: Extract `CombatAnimationRuntime`

**Files:**
- Create: `game/src/core/battle/turn/CombatAnimationRuntime.ts`
- Create: `game/src/core/battle/turn/CombatAnimationRuntime.test.ts`
- Modify: `game/src/core/game/GameManager.ts` (remove the relocated
  fields/method bodies, replace with a `combatAnimationRuntime` instance
  and thin forwarding methods)

**Interfaces:**
- Consumes: `TurnBattleSystem` (`declareActorAction`, `applyActionImpact`,
  `completeAction`, `resolveActorTurn`), `PresentationGate` (existing,
  `game/src/core/battle/turn/PresentationGate.ts`), `TurnBattle`/
  `TurnBattleParticipant`/`TurnDeclaredAction` types (existing,
  `TurnBattleSystem.ts`), `CombatAnimationName` (existing,
  `game/src/game/support/CombatAnimationSet.ts`), event emitters
  `emitTurnCastStart`/`emitTurnActionImpact`/`emitTurnStandbyComplete`
  (existing, wherever `GameManager.ts` currently imports them from).
- Produces: `class CombatAnimationRuntime` with public methods
  `expectPresentationLayer(): void`,
  `isAwaitingPresentationLayer(): boolean`,
  `setPresentationActive(active: boolean): void`,
  `isActionPlaybackWaiting(): boolean`,
  `acknowledgeTurnReady(token?: string): void`,
  `acknowledgeActionImpact(token?: string): void`,
  `acknowledgeActionComplete(token?: string): void`,
  `setBattleManualMode(enabled: boolean): void`,
  `isBattleManualMode(): boolean`,
  `isAwaitingManualTurnChoice(): boolean`,
  `submitTurnChoice(role: TurnSkillSlotRole): boolean`,
  `getPendingPlaybackToken(): string | null`,
  `getAnimationState(actorId: string): CombatAnimationName`,
  `notifyReadyActor(actor: TurnBattleParticipant): void` (called by
  `GameManager`'s tick loop when `tickPacing()` returns a ready actor
  while `presentationActive` is true — sets `pendingReadyActor` +
  bumps `playbackToken`, replacing the inline block currently at
  `GameManager.ts:3659-3668`), `handlePresentationDeactivated(): void`
  (the cleanup currently inside `setPresentationActive(false)`'s
  branches at `GameManager.ts:2608-2640`).

- [ ] **Step 1: Read the exact current implementation to port**

Read these exact line ranges from `game/src/core/game/GameManager.ts`
before writing anything (line numbers per this session's survey — verify
against current file, they may have shifted slightly): `2527` (field
`awaitedManualActor`), `2530-2540` (`setBattleManualMode`/
`isBattleManualMode`), `2542-2543` (`isAwaitingManualTurnChoice`),
`2558-2571` (`presentationGate` field + `expectPresentationLayer`/
`isAwaitingPresentationLayer`), `2574-2580` (`pendingReadyActor`/
`pendingDeclaredAction`/`pendingImpact` fields), `2582-2603`
(`playbackToken`/`nextPlaybackToken`/`presentationActive` field +
`setPresentationActive`), `2602-2641` (`setPresentationActive` full
body), `2643-2645` (`isActionPlaybackWaiting`), `2648-2771`
(`acknowledgeTurnReady`/`acknowledgeActionImpact`/
`acknowledgeActionComplete`/`submitTurnChoice`), and the
`updateBattleFixedStep()` block at `3642-3677` (the `'fighting'` branch
that reads `pendingReadyActor`/`pendingDeclaredAction`/`pendingImpact`
and calls `tickPacing`). Also find `nextPlaybackToken()`'s body and
`getPendingPlaybackToken()`'s body (referenced from `CombatScene.ts` per
the earlier survey) — grep `GameManager.ts` for both names.

- [ ] **Step 2: Write `CombatAnimationRuntime.ts`**

Move every field and method identified in Step 1 verbatim into the new
class, changing only: `this.turnBattle` → call the injected
`getBattle(): TurnBattle | null` getter; `this.turnBattleSystem` →
constructor-injected `turnBattleSystem: TurnBattleSystem`; `this.eventBus`
→ constructor-injected `eventBus: EventBus`; `this.syncLegacyBattleState()`
→ constructor-injected `syncLegacyBattleState: () => void` callback
(this stays a `GameManager`-only concern — the runtime calls it exactly
where the original code did, via the injected callback, so behavior is
identical). Constructor signature:

```ts
constructor(private readonly deps: {
  turnBattleSystem: TurnBattleSystem
  eventBus: EventBus
  getBattle: () => TurnBattle | null
  syncLegacyBattleState: () => void
}) {}
```

Add `getAnimationState(actorId: string): CombatAnimationName`:

```ts
getAnimationState(actorId: string): CombatAnimationName {
  if (this.pendingReadyActor?.id === actorId) {
    return 'ready'
  }

  if (this.pendingDeclaredAction?.actor.id === actorId) {
    return 'cast'
  }

  if (this.pendingImpact?.actor.id === actorId) {
    return 'standby'
  }

  return 'idle'
}
```

Add `notifyReadyActor(actor)` — the body currently inline at
`GameManager.ts:3659-3668`:

```ts
notifyReadyActor(actor: TurnBattleParticipant): void {
  this.pendingReadyActor = actor
  this.playbackToken = this.nextPlaybackToken()

  emitTurnReady(this.deps.eventBus, actor.id)
}
```

- [ ] **Step 3: Write `CombatAnimationRuntime.test.ts`**

Port the manual-mode and presentation-ack cases from
`GameManager.actionPlayback.test.ts`/`GameManager.presentationGate.test.ts`
(read both files first) to construct `CombatAnimationRuntime` directly
with a minimal fake `TurnBattleSystem`/`TurnBattle` fixture (reuse
whatever fixture helper those existing test files already use — do not
invent a second fixture builder). At minimum:

```ts
import { describe, expect, it, vi } from 'vitest'
import { CombatAnimationRuntime } from './CombatAnimationRuntime'

describe('CombatAnimationRuntime', () => {
  it('reports idle animation state when no phase is pending', () => {
    const runtime = new CombatAnimationRuntime({
      turnBattleSystem: {} as never,
      eventBus: { emit: vi.fn() } as never,
      getBattle: () => null,
      syncLegacyBattleState: vi.fn(),
    })

    expect(runtime.getAnimationState('player')).toBe('idle')
  })
})
```

Add the remaining cases (ready/cast/standby state reporting,
`acknowledgeTurnReady` stale-token no-op, manual-mode pause/resume) by
porting the equivalent assertions from the two existing `GameManager`
test files, adapted to call the runtime directly instead of
`gameManager`.

- [ ] **Step 4: Run the new test file, verify it fails then passes**

Run: `npm --prefix game run test -- CombatAnimationRuntime.test.ts`
Expected first: FAIL (`CombatAnimationRuntime.ts` doesn't exist yet, or
the specific method under test isn't implemented). After Step 2's file
exists: PASS.

- [ ] **Step 5: Wire `GameManager` as a thin forwarder**

In `GameManager.ts`, replace the fields/methods moved in Step 2 with:

```ts
private readonly combatAnimationRuntime = new CombatAnimationRuntime({
  turnBattleSystem: this.turnBattleSystem,
  eventBus: this.eventBus,
  getBattle: () => this.turnBattle,
  syncLegacyBattleState: () => this.syncLegacyBattleState(),
})

expectPresentationLayer(): void {
  this.combatAnimationRuntime.expectPresentationLayer()
}

isAwaitingPresentationLayer(): boolean {
  return this.combatAnimationRuntime.isAwaitingPresentationLayer()
}

setPresentationActive(active: boolean): void {
  this.combatAnimationRuntime.setPresentationActive(active)
}

isActionPlaybackWaiting(): boolean {
  return this.combatAnimationRuntime.isActionPlaybackWaiting()
}

acknowledgeTurnReady(token?: string): void {
  this.combatAnimationRuntime.acknowledgeTurnReady(token)
}

acknowledgeActionImpact(token?: string): void {
  this.combatAnimationRuntime.acknowledgeActionImpact(token)
}

acknowledgeActionComplete(token?: string): void {
  this.combatAnimationRuntime.acknowledgeActionComplete(token)
}

setBattleManualMode(enabled: boolean): void {
  this.combatAnimationRuntime.setBattleManualMode(enabled)
}

isBattleManualMode(): boolean {
  return this.combatAnimationRuntime.isBattleManualMode()
}

isAwaitingManualTurnChoice(): boolean {
  return this.combatAnimationRuntime.isAwaitingManualTurnChoice()
}

submitTurnChoice(role: TurnSkillSlotRole): boolean {
  return this.combatAnimationRuntime.submitTurnChoice(role)
}

getPendingPlaybackToken(): string | null {
  return this.combatAnimationRuntime.getPendingPlaybackToken()
}
```

Replace the `updateBattleFixedStep()` `'fighting'` branch's direct field
reads (`this.awaitedManualActor`, `this.presentationActive`,
`this.pendingReadyActor`, etc.) with
`this.combatAnimationRuntime.isAwaitingManualTurnChoice()`, and the
`readyActor !== null && this.presentationActive` branch's body with
`this.combatAnimationRuntime.notifyReadyActor(readyActor)` (the
`presentationActive` check itself needs a runtime getter — add
`isPresentationActive(): boolean` to `CombatAnimationRuntime` alongside
the others, forwarded the same way). Keep `this.presentationGate` reads
inside `updateBattleFixedStep()`'s top-of-loop `isBlocking()` check
routed through `this.combatAnimationRuntime.isAwaitingPresentationLayer()`.

- [ ] **Step 6: Run the full existing test suite**

Run: `npm --prefix game run test`
Expected: PASS, including unmodified
`GameManager.actionPlayback.test.ts`, `GameManager.presentationGate.test.ts`,
`GameManager.stageRestart.test.ts` — these prove the relocation preserved
`GameManager`'s public contract exactly.

- [ ] **Step 7: Run type-check**

Run: `npm --prefix game run type-check` (or the project's exact
type-check script name — check `game/package.json`'s `scripts` block
first if unsure)
Expected: PASS, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add game/src/core/battle/turn/CombatAnimationRuntime.ts game/src/core/battle/turn/CombatAnimationRuntime.test.ts game/src/core/game/GameManager.ts
git commit -m "refactor(combat): extract CombatAnimationRuntime from GameManager (P17)"
```

---

### Task 2: No-Target Guard (empty-arena pause)

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`tickPacing()`,
  currently starting at line 344)
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `isStageComplete` (existing import from `./WaveSpawnTrigger`,
  already imported in this file), `TurnBattle.wave` shape (existing).
- Produces: `tickPacing()` returns `null` and resets every participant's
  `actionGauge` to `0` for any tick where `battle.enemies` has zero
  living members and more enemies are still coming (pending telegraph or
  a future wave); sets `battle.state = 'victory'` and returns `null` when
  the stage is truly complete instead.

- [ ] **Step 1: Write the failing test**

```ts
it('freezes and resets gauges when the arena is empty but more enemies are coming', () => {
  const battle = buildFightingBattleFixture({
    // use whichever fixture helper this file already exports/uses —
    // read the top of TurnBattleSystem.test.ts for the exact helper name
    // and required shape before writing this call
  })

  battle.enemies = []
  battle.players[0]!.actionGauge = GAUGE_MAX - 1
  battle.wave = {
    totalEnemyCount: 3,
    spawnedCount: 1,
    waves: [3],
    waveIndex: 1,
    pendingEnemySpawns: [
      { participant: buildEnemyParticipantFixture(), ticksRemaining: 5, totalTicks: 8 },
    ],
  }

  const system = new TurnBattleSystem(/* same constructor args other tests in this file use */)

  const ready = system.tickPacing(battle)

  expect(ready).toBeNull()
  expect(battle.players[0]!.actionGauge).toBe(0)
})
```

Adapt `buildFightingBattleFixture`/`buildEnemyParticipantFixture` to
whatever fixture builders already exist in this test file — read the
file first, do not invent parallel fixture helpers.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts -t "freezes and resets gauges"`
Expected: FAIL (gauge stays at `GAUGE_MAX - 1`, or `ready` is not `null`
because the current code has no such guard).

- [ ] **Step 3: Implement the guard**

In `tickPacing()`, insert immediately after the wave/telegraph block
closes (after the code currently ending at line 395) and before the
follow-up-queue check (currently line 399):

```ts
const livingEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

if (livingEnemyCount === 0) {
  const pendingCount = battle.wave?.pendingEnemySpawns.length ?? 0
  const waveIndex = battle.wave?.waveIndex ?? 0
  const waveCount = battle.wave?.waves.length ?? 0
  const spawnedCount = battle.wave?.spawnedCount ?? 0
  const totalEnemyCount = battle.wave?.totalEnemyCount ?? 0

  const moreComing = pendingCount > 0 || waveIndex < waveCount

  if (moreComing) {
    for (const participant of [...battle.players, ...battle.enemies]) {
      participant.actionGauge = 0
    }

    return null
  }

  if (isStageComplete(spawnedCount, totalEnemyCount, livingEnemyCount, pendingCount)) {
    battle.state = 'victory'

    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts -t "freezes and resets gauges"`
Expected: PASS

- [ ] **Step 5: Run the full TurnBattleSystem test file**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts`
Expected: PASS (no regressions — this guard only activates in the
previously-unguarded empty-arena tick, so a battle with living enemies
present takes the exact same path as before).

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "fix(combat): pause and reset gauges instead of resolving a turn with no living enemy"
```

---

### Task 3: Enemy Spawn Slot Dedupe (within one wave)

**Files:**
- Modify: `game/src/core/battle/EnemySpawnPlacement.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (wave-spawn
  loop, currently `tickPacing()` lines 385-391)
- Test: `game/src/core/battle/EnemySpawnPlacement.test.ts` (create if it
  does not already exist — check first)

**Interfaces:**
- Consumes: `standingSlotPosition`, `STANDING_SLOT_COUNT` (existing,
  `game/src/core/battle/BattlefieldRegions.ts`).
- Produces: `resolveEnemySpawnPosition(region, occupiedSlots?: Set<string>): { position: GridPosition; slotKey: string }`
  — read the current exact signature of this function in
  `EnemySpawnPlacement.ts` before changing it (the survey this session
  did not capture its full current signature — read the file first).
  The new `occupiedSlots` parameter is optional so any other existing
  caller (e.g. the Boss branch, which uses `centerOfRegion()` and may not
  route through this function at all) is unaffected if it doesn't pass one.

- [ ] **Step 1: Read the current implementation**

Read `game/src/core/battle/EnemySpawnPlacement.ts` in full, and the call
site at `TurnBattleSystem.ts:383-391`, before writing any change — confirm
the exact current function name, parameter list, and return shape (the
design doc describes intent, not verbatim current code).

- [ ] **Step 2: Write the failing test**

```ts
it('assigns distinct slots to every enemy spawned in the same wave when the wave fits within the slot pool', () => {
  const occupied = new Set<string>()
  const positions = new Set<string>()

  for (let i = 0; i < STANDING_SLOT_COUNT * STANDING_SLOT_COUNT; i++) {
    const { position, slotKey } = resolveEnemySpawnPosition(SOME_REGION_FIXTURE, occupied)

    occupied.add(slotKey)
    positions.add(`${position.row}-${position.column}`)
  }

  expect(positions.size).toBe(STANDING_SLOT_COUNT * STANDING_SLOT_COUNT)
})
```

Replace `SOME_REGION_FIXTURE` with whatever the file's existing tests (or
`FormationPlacement.test.ts`/`BattlefieldRegions.test.ts`, which already
exercise `PLAYER_SIDE_REGION`/enemy region constants) use as the region
fixture — read those first rather than inventing a new region shape.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm --prefix game run test -- EnemySpawnPlacement.test.ts -t "distinct slots"`
Expected: FAIL (compile error if `occupiedSlots`/`slotKey` don't exist
yet, or duplicate positions if the function ignores the parameter).

- [ ] **Step 4: Implement the dedupe**

Modify the random-slot branch to build the slot key as
`` `${slotRow}-${slotColumn}` ``, filter the `STANDING_SLOT_COUNT *
STANDING_SLOT_COUNT` possible keys against the passed-in `occupiedSlots`
set, and pick uniformly among the remaining free keys (fall back to
uniform-random-among-all-9 when every slot is occupied, i.e. `waveSize >
9` — do not throw or return null, per the existing "never returns null"
contract documented in this file). Return `slotKey` alongside `position`
so the caller can accumulate it.

- [ ] **Step 5: Wire the wave-spawn loop to pass and accumulate occupied slots**

In `TurnBattleSystem.ts`'s `tickPacing()`, change the wave-spawn loop
(lines 385-391) to build an `occupiedSlots` set once before the loop and
pass/update it each iteration:

```ts
const occupiedSlots = new Set<string>()

for (let index = 0; index < waveSize; index++) {
  const participant = this.spawnEnemy(occupiedSlots) // exact call shape depends on Step 1's findings — spawnEnemy is the injected factory, confirm whether it already threads through to resolveEnemySpawnPosition or needs its own occupiedSlots parameter added
  const totalTicks = spawnTelegraphTicks(participant.entity)

  battle.wave.pendingEnemySpawns.push({ participant, ticksRemaining: totalTicks, totalTicks })
  battle.wave.spawnedCount += 1
}
```

If `this.spawnEnemy` (the constructor-injected factory) doesn't currently
accept a parameter, trace its definition (likely in `GameManager.ts`,
wherever `turnBattleSystem` is constructed) and thread `occupiedSlots`
through it to `resolveEnemySpawnPosition()`. This is the one step in this
plan where the exact shape depends on code not fully read during the
design survey — read `this.spawnEnemy`'s injection site before writing
this step's final code.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm --prefix game run test -- EnemySpawnPlacement.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full test suite**

Run: `npm --prefix game run test`
Expected: PASS, no regressions in `TurnBattleSystem.test.ts` or
`EnemySpawnPlacement.test.ts`'s existing cases (Boss-branch spawn
behavior untouched).

- [ ] **Step 8: Commit**

```bash
git add game/src/core/battle/EnemySpawnPlacement.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/EnemySpawnPlacement.test.ts
git commit -m "fix(combat): de-duplicate enemy standing-slot spawns within a single wave"
```

---

### Task 4: Intro/Transition Phase

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`TurnBattleState`
  type, line 85; add `introTurnsRemaining?: number` to `TurnBattle`
  interface near `countdownTurnsRemaining`)
- Modify: `game/src/core/game/GameManager.ts` (`updateBattleFixedStep()`
  new `'intro'` branch; battle-construction call sites start at `'intro'`)
- Create: `game/src/components/game/combat/CombatIntroOverlay.vue`
- Modify: `game/src/components/game/combat/CombatSceneOverlay.vue` (mount
  the new overlay alongside `<CombatCountdownOverlay />`)
- Modify: `game/src/locales/vi.json`, `game/src/locales/en.json` (new
  i18n keys for the intro overlay, per P16)
- Test: `game/src/core/game/GameManager.introPhase.test.ts` (new)

**Interfaces:**
- Consumes: `PresentationGate`/`setPresentationActive` (existing,
  unchanged), whatever accessor `CombatTopBar.vue` already uses to read
  zone name + stage/floor number — read `CombatTopBar.vue` first and
  reuse the exact same accessor, do not add a second source of truth.
- Produces: `TurnBattleState` includes `'intro'`; a battle starts at
  `state: 'intro'`, `introTurnsRemaining: INTRO_TOTAL_TICKS` (new
  constant, 20 ticks = 2s, colocated with `COUNTDOWN_TOTAL_TICKS` in
  `GameManager.ts`).

- [ ] **Step 1: Read the exact current battle-construction and zone/stage accessor code**

Read `GameManager.ts`'s `startStage()`/`restartTurnBattleCycle()` (wherever
`TurnBattle` objects are constructed with `state: 'countdown'`) and
`CombatTopBar.vue`'s zone/stage name reading code, in full, before writing
this task's changes.

- [ ] **Step 2: Write the failing test**

```ts
it('starts a new battle in the intro phase before countdown', () => {
  const gameManager = buildGameManagerFixture() // reuse whatever helper GameManager.stageRestart.test.ts already uses

  gameManager.startStage(SOME_STAGE_FIXTURE) // match the existing test file's call

  expect(gameManager.getBattle()?.state).toBe('intro')
})

it('advances from intro to countdown after introTurnsRemaining ticks', () => {
  const gameManager = buildGameManagerFixture()

  gameManager.startStage(SOME_STAGE_FIXTURE)

  for (let i = 0; i < INTRO_TOTAL_TICKS; i++) {
    gameManager.updateBattleFixedStep(BATTLE_FIXED_STEP_SECONDS) // or whatever the existing tests already use to drive one tick
  }

  expect(gameManager.getBattle()?.state).toBe('countdown')
})
```

Match fixture/helper names to whatever `GameManager.stageRestart.test.ts`
already establishes — read it first.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm --prefix game run test -- GameManager.introPhase.test.ts`
Expected: FAIL (`state` is `'countdown'` immediately, no `'intro'` exists).

- [ ] **Step 4: Add `'intro'` to `TurnBattleState` and `TurnBattle`**

```ts
export type TurnBattleState = 'intro' | 'countdown' | 'fighting' | 'victory' | 'defeat'
```

Add `introTurnsRemaining?: number` to the `TurnBattle` interface, directly
below the existing `countdownTurnsRemaining?: number` field, with a
matching doc comment describing the intro phase (English, per P15).

- [ ] **Step 5: Add the `INTRO_TOTAL_TICKS` constant and battle-construction change**

In `GameManager.ts`, next to `COUNTDOWN_TOTAL_TICKS = 30`:

```ts
const INTRO_TOTAL_TICKS = 20
```

Change every `TurnBattle` construction site found in Step 1 to start
`state: 'intro'`, `introTurnsRemaining: INTRO_TOTAL_TICKS` instead of
`state: 'countdown'`.

- [ ] **Step 6: Add the `'intro'` tick branch**

In `updateBattleFixedStep()`, add a branch before the existing
`'countdown'` branch:

```ts
} else if (this.turnBattle.state === 'intro') {
  this.turnBattle.introTurnsRemaining = Math.max(0, (this.turnBattle.introTurnsRemaining ?? 0) - 1)

  if (this.turnBattle.introTurnsRemaining === 0) {
    this.turnBattle.state = 'countdown'
  }
}
```

Place this as an `else if` alongside the existing `this.turnBattle.state
=== 'countdown'` / `=== 'fighting'` branches (inside the same
`if (this.presentationGate.isBlocking()) { ... } else if (...)` chain —
route the blocking check through
`this.combatAnimationRuntime.isAwaitingPresentationLayer()` per Task 1's
Step 5 if Task 1 landed first; otherwise use `this.presentationGate.isBlocking()`
directly and let Task 1 pick this up during its own forwarding pass).

- [ ] **Step 7: Run test to verify it passes**

Run: `npm --prefix game run test -- GameManager.introPhase.test.ts`
Expected: PASS

- [ ] **Step 8: Add i18n keys**

In `game/src/locales/vi.json` and `en.json`, add (nested under a new
`combat.overlay.intro` key, matching `combat.overlay.countdown`'s
existing nesting pattern — read that key's exact location first):

```json
"intro": {
  "loading": "..."
}
```

vi: whatever zone-reveal label reads naturally (e.g. a loading/entering
label) — write actual copy here, not a placeholder; en: the English
equivalent.

- [ ] **Step 9: Write `CombatIntroOverlay.vue`**

Model directly on `CombatCountdownOverlay.vue`'s structure (`<script
setup>`, `useI18n()`, `useGameManager()`/`useStateVersion()` computed
pattern):

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const visible = computed(() => {
  stateVersion.value

  return gameManager.getBattle()?.state === 'intro'
})

// Reuse the exact zone/stage accessor CombatTopBar.vue already uses —
// read that component's current implementation before filling this in.
const zoneStageLabel = computed(() => {
  stateVersion.value

  return '' // TODO resolved during implementation from CombatTopBar.vue's accessor — not a placeholder left in the final diff
})
</script>

<template>
  <div v-if="visible" class="combat-intro-overlay">
    <div class="combat-intro-overlay__curtain combat-intro-overlay__curtain--left" />
    <div class="combat-intro-overlay__curtain combat-intro-overlay__curtain--right" />
    <span class="combat-intro-overlay__label">{{ zoneStageLabel }}</span>
  </div>
</template>

<style scoped>
.combat-intro-overlay {
  position: absolute;
  inset: 0;
  z-index: 13;
  pointer-events: none;
  overflow: hidden;
}

.combat-intro-overlay__curtain {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  background: var(--surface-900, #0a0a0a);
  animation: combat-intro-curtain-close 0.4s ease-out forwards;
}

.combat-intro-overlay__curtain--left {
  left: 0;
  transform: translateX(-100%);
}

.combat-intro-overlay__curtain--right {
  right: 0;
  transform: translateX(100%);
}

@keyframes combat-intro-curtain-close {
  to {
    transform: translateX(0);
  }
}

.combat-intro-overlay__label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--text-hero);
  color: var(--gold-300);
  z-index: 1;
}
</style>
```

Resolve the `zoneStageLabel` TODO by copying `CombatTopBar.vue`'s exact
accessor pattern (read it in Step 1) — the final committed file must not
contain the placeholder comment.

- [ ] **Step 10: Mount the overlay in `CombatSceneOverlay.vue`**

Add `import CombatIntroOverlay from './CombatIntroOverlay.vue'` and
`<CombatIntroOverlay />` next to the existing
`<CombatCountdownOverlay />` line.

- [ ] **Step 11: Run the full test suite and type-check**

Run: `npm --prefix game run test && npm --prefix game run type-check`
Expected: PASS

- [ ] **Step 12: P14 manual verification**

Start a real stage battle via Playwright (or `playwright-cli`, per P14)
and visually confirm: curtains close, zone/stage text is visible,
curtains reopen, then the existing 3-2-1 countdown runs as before.

- [ ] **Step 13: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/game/GameManager.ts game/src/components/game/combat/CombatIntroOverlay.vue game/src/components/game/combat/CombatSceneOverlay.vue game/src/locales/vi.json game/src/locales/en.json game/src/core/game/GameManager.introPhase.test.ts
git commit -m "feat(combat): add intro/transition phase before countdown"
```

---

### Task 5: Animation Timing Tuning

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: none new.
- Produces: no interface change — pure constant tuning.

- [ ] **Step 1: Change the duration constants**

```ts
const ATTACK_LUNGE_DURATION_MS = 350 // was 75 — too fast to observe (2026-09-07 playtest)
```

And at the ready-pulse tween (currently `duration: 90` near line 2271):

```ts
duration: 250, // was 90 — too fast to observe (2026-09-07 playtest)
```

- [ ] **Step 2: Run the full test suite**

Run: `npm --prefix game run test`
Expected: PASS — no test asserts on these exact millisecond values (if
one does, read it and update the asserted value to match, since the
symptom this task fixes is specifically that the old value was too fast).

- [ ] **Step 3: P14 manual verification**

Run a real stage battle and confirm a single turn's ready→lunge→impact
cycle is now visually trackable at normal speed.

- [ ] **Step 4: Commit**

```bash
git add game/src/game/scenes/CombatScene.ts
git commit -m "fix(combat): slow attack/ready animation timing so turns are observable"
```

---

## Verification (after all tasks)

- [ ] Full suite: `npm --prefix game run test` — all pass.
- [ ] Type-check: `npm --prefix game run type-check` — 0 errors.
- [ ] Build: `npm --prefix game run build` — succeeds.
- [ ] P14: one full real-browser stage battle — intro curtain/zone text
  plays, countdown 3-2-1 plays, no attack happens before an enemy sprite
  is visible, a full wave's enemies land on visually distinct standing
  slots (up to 9), a single turn is trackable at normal speed.
- [ ] Use `superpowers:finishing-a-development-branch` to merge/PR once
  green (this plan should run in its own worktree per
  `superpowers:using-git-worktrees`, branch off `master`).
