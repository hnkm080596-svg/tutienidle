# Mission B — Runtime Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Game only acknowledges persistence when data is actually committed; no session soft-locks from lifecycle races.

**Architecture:** Quit-flush checks the typed save result before acking; character creation becomes a boot transaction (first durable save inside `useAppLifecycle.bootGame`, before `clock.start()`/`startTickLoop`); stage slot release is unconditional on defeat; async battle-start results are awaited everywhere; auto-farm gets a real stop path.

**Tech Stack:** TypeScript, Vue 3, Electron IPC, Vitest, Playwright (wiring checks only).

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission B. Audit evidence: `docs/qa/2026-09-16-full-project-scout-audit.md` T1-2, T1-4, T1-5, T1-6, T1-8, T1-12, T6-51, T6-52.

## Global Constraints

- Dev-stage rule: no migrations / compat shims; fix code directly.
- P8: no `any`. P15: English ASCII comments. P16: new UI strings via `t()` (composables/module-level code uses `i18n.global.t` — precedent: `useBreakthrough.ts:6,46`, `useTribulation.ts:100-104`).
- P13: B1/B2 touch boot + Electron IPC — verify with the relevant e2e or a manual runtime check, not just unit tests.
- P17: presentation must not become gameplay authority — stop controls issue commands to domain ops.
- `src/App.wiring.test.ts` Layer 2 asserts every member returned by `useAppLifecycle()` is consumed via `lifecycle.<member>` in `App.vue` (or explicitly allowlisted). The Task 2 design adds NO new returned member — keep it that way, or extend `INTENTIONALLY_UNWIRED_LIFECYCLE_MEMBERS` with a reason.
- New i18n keys must be added to BOTH `src/locales/vi.json` and `src/locales/en.json` — `tests/architecture/i18nKeyParity.test.ts` guards parity.
- Worktree: `.agent-worktrees/durability` (branch `fix/durability`).

**Verified type note (read before Task 1/2):** `player.save(gameManager)` (`src/stores/player.ts:287-299`) returns `cloudSaveCoordinator.save(...)` → `Promise<CloudSaveWriteResult>` where `CloudSaveWriteResult = { status:'ok'; revision:number; recoveredFromConflict? } | { status:'conflict'; currentRevision:number } | { status:'unavailable'; message:string; retryable:boolean }` (`src/services/cloudSave/CloudSaveService.ts:15-18`). There is NO `'failed'` status — `SaveWriteResult` (`{status:'ok'}|{status:'failed';reason}`, `SaveSystem.ts:392`) is a different type returned by the raw `writeGameSave`, not by `player.save`. The audit's "`status:'failed'`" shorthand means "any non-ok status".

---

### Task 1: Quit-save acknowledgement + re-entrancy guard (spec B1, audit T1-2 + T6-52)

**Files:**
- Modify: `src/composables/useElectronBridge.ts:65-80` (quit flush handler — currently `await player.save(gameManager)` in `try`, `notifyFlushComplete()` in `finally`, result never inspected)
- Create: `src/main-process/quitFlush.ts` (extract `bindQuitFlush` out of `electron/main.ts` — main.ts has no test harness by design; the `src/main-process/combatClockHost.ts` + `attachPowerMonitorToClockHost` split is the established precedent for testable main-process glue)
- Modify: `electron/main.ts:110,120-157` (wire the extracted handler; keep `FLUSH_TIMEOUT_MS` semantics)
- Test: `src/composables/useElectronBridge.test.ts` (extend — mock `player.save` non-ok), `src/main-process/quitFlush.test.ts` (new)

**Interfaces:**
- Consumes: `player.save(gameManager): Promise<CloudSaveWriteResult>`; `useNotificationStore().push(kind, message)` (`src/stores/notification.ts:46`); existing key `panels.settings.notifications.saveFailed` (`src/locales/vi.json:491`).
- Produces: `createQuitFlush(deps)` → `(win, event) => void` handler with two `WeakSet`s — `flushedWindows` (close finished, pass through) and `flushingWindows` (flush in-flight: still `preventDefault()`, but do NOT re-send `app:before-quit-flush` or register a second `app:flush-complete` listener).

- [ ] **Step 1: Failing tests**

  In `useElectronBridge.test.ts` — the existing `makeApi()` already captures the flush callback via `api.onBeforeQuitFlush.mock.calls[0][0]`. The real Pinia stores are used (`setActivePinia(createPinia())`), so spy on the store action:

```ts
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'

it('flush save resolves non-ok → still notifies main (2s backstop must not hang the app) BUT logs + surfaces the failure', async () => {
  setActivePinia(createPinia())
  const { api } = makeApi()
  window.electronAPI = api

  const playerStore = usePlayerStore()
  const saveSpy = vi.spyOn(playerStore, 'save').mockResolvedValue({
    status: 'unavailable',
    message: 'quota full',
    retryable: false,
  })
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  useElectronBridge(fakeGameManager)
  const flushCallback = api.onBeforeQuitFlush.mock.calls[0]![0]
  flushCallback()

  // notifyFlushComplete must still fire — a failed save never blocks the close.
  await vi.waitFor(() => expect(api.notifyFlushComplete).toHaveBeenCalledTimes(1))
  expect(saveSpy).toHaveBeenCalledTimes(1)
  expect(errorSpy).toHaveBeenCalledWith(
    '[electron] quit flush save failed',
    expect.objectContaining({ status: 'unavailable' }),
  )
  expect(useNotificationStore().toasts.some((toast) => toast.kind === 'error')).toBe(true)

  errorSpy.mockRestore()
})

it('flush save resolves ok → notify, no error log, no error toast', async () => {
  setActivePinia(createPinia())
  const { api } = makeApi()
  window.electronAPI = api

  vi.spyOn(usePlayerStore(), 'save').mockResolvedValue({ status: 'ok', revision: 1 })
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  useElectronBridge(fakeGameManager)
  api.onBeforeQuitFlush.mock.calls[0]![0]()

  await vi.waitFor(() => expect(api.notifyFlushComplete).toHaveBeenCalledTimes(1))
  expect(errorSpy).not.toHaveBeenCalled()
  expect(useNotificationStore().toasts).toHaveLength(0)

  errorSpy.mockRestore()
})
```

  New `src/main-process/quitFlush.test.ts` (plain vitest env — the module must not import `electron` at runtime; narrow structural interfaces only):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQuitFlush, FLUSH_TIMEOUT_MS } from './quitFlush'

function makeFixture() {
  const listeners: Array<() => void> = []
  const ipcMain = {
    once: vi.fn((_channel: string, listener: () => void) => { listeners.push(listener) }),
    removeListener: vi.fn((_channel: string, listener: () => void) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }),
  }
  const win = { webContents: { send: vi.fn() }, close: vi.fn() }
  const event = { preventDefault: vi.fn() }
  return { ipcMain, listeners, win, event }
}

describe('createQuitFlush — close handler', () => {
  afterEach(() => vi.useRealTimers())

  it('first close: preventDefault + one flush request + one listener; nothing closes yet', () => {
    const { ipcMain, listeners, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledWith('app:before-quit-flush')
    expect(ipcMain.once).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(1)
    expect(win.close).not.toHaveBeenCalled()
  })

  it('second close while flush is in-flight: still blocked, but NO duplicate send/listener (T6-52)', () => {
    vi.useFakeTimers()
    const { ipcMain, listeners, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)
    onClose(win, event)

    // The user close is still held (preventDefault again) — but the renderer
    // save must not be re-triggered and no second flush-complete listener may
    // be registered.
    expect(event.preventDefault).toHaveBeenCalledTimes(2)
    expect(win.webContents.send).toHaveBeenCalledTimes(1)
    expect(ipcMain.once).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(1)
  })

  it('flush-complete → win.close() re-enters close and passes through (no preventDefault/send)', () => {
    const { ipcMain, listeners, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)
    listeners[0]!() // renderer acked

    expect(win.close).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(0) // removeListener ran

    // Simulated re-entrant close from win.close(): already-flushed → return early.
    onClose(win, event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledTimes(1)
  })

  it('timeout backstop finishes the flush when the renderer never acks', () => {
    vi.useFakeTimers()
    const { ipcMain, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)
    vi.advanceTimersByTime(FLUSH_TIMEOUT_MS)

    expect(win.close).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/composables/useElectronBridge.test.ts src/main-process/quitFlush.test.ts`). The first new test fails today: `console.error` IS already called (the `catch` exists) but only on a THROW — a resolved `{status:'unavailable'}` produces no log and no toast, so the `errorSpy`/`toasts` assertions fail. `quitFlush.test.ts` fails on import (module does not exist yet).

- [ ] **Step 3: Implement**

  `src/main-process/quitFlush.ts` — moved-verbatim logic plus the in-flight WeakSet:

```ts
/**
 * Quit-flush close handler for the Electron main process. Extracted from
 * electron/main.ts so this glue has test coverage - main.ts itself has
 * none (same precedent as combatClockHost.ts). The renderer saves on
 * 'app:before-quit-flush' and acks via 'app:flush-complete'; a timeout
 * backstop closes anyway if the ack never arrives.
 *
 * Two WeakSets split the two reasons a 'close' event must be ignored:
 * - flushedWindows: finish() already ran and called win.close() - this
 *   re-entrant event is the intended final close, let it through.
 * - flushingWindows: a second user close landed during the flush window.
 *   It must stay blocked (preventDefault) but must NOT re-send the flush
 *   request or stack a second 'app:flush-complete' listener - the in-flight
 *   finish() still owns the close.
 */
export const FLUSH_TIMEOUT_MS = 2000

export interface QuitFlushWindow {
  webContents: { send(channel: 'app:before-quit-flush'): void }
  close(): void
}

export interface QuitFlushCloseEvent {
  preventDefault(): void
}

export interface QuitFlushIpcMain {
  once(channel: string, listener: () => void): void
  removeListener(channel: string, listener: () => void): void
}

export function createQuitFlush(deps: {
  ipcMain: QuitFlushIpcMain
  timeoutMs?: number
}): (win: QuitFlushWindow, event: QuitFlushCloseEvent) => void {
  const timeoutMs = deps.timeoutMs ?? FLUSH_TIMEOUT_MS
  const flushedWindows = new WeakSet<QuitFlushWindow>()
  const flushingWindows = new WeakSet<QuitFlushWindow>()

  return function bindQuitFlush(win, event) {
    if (flushedWindows.has(win)) {
      return
    }

    event.preventDefault()

    if (flushingWindows.has(win)) {
      return
    }

    flushingWindows.add(win)

    let settled = false

    const finish = () => {
      if (settled) {
        return
      }

      settled = true

      clearTimeout(timeoutHandle)
      deps.ipcMain.removeListener('app:flush-complete', finish)

      flushingWindows.delete(win)
      flushedWindows.add(win)
      win.close()
    }

    deps.ipcMain.once('app:flush-complete', finish)
    win.webContents.send('app:before-quit-flush')

    const timeoutHandle = setTimeout(finish, timeoutMs)
  }
}
```

  `electron/main.ts`: `import { createQuitFlush } from '../src/main-process/quitFlush'`; inside `main()` next to `clockHost` creation: `const onQuitFlushClose = createQuitFlush({ ipcMain })`; replace `win.on('close', event => bindQuitFlush(win, event))` (line 110) with `win.on('close', event => onQuitFlushClose(win, event))`; delete the old `FLUSH_TIMEOUT_MS`/`flushedWindows`/`bindQuitFlush` block at lines 120-157 (keep the explanatory comment, updated, above the new call site). `BrowserWindow`/`Electron.Event`/`ipcMain` satisfy the narrow interfaces structurally — if the compiler objects at the boundary, widen `QuitFlushIpcMain`'s listener to `(...args: never[]) => void`, do NOT cast to `any`.

  `useElectronBridge.ts` — capture the result and surface non-ok:

```ts
import { useNotificationStore } from '../stores/notification'
import { i18n } from '@/i18n'
// inside useElectronBridge, after `const gameManager = ...`:
const notification = useNotificationStore()

const offBeforeQuitFlush = electronAPI.onBeforeQuitFlush(() => {
  void (async () => {
    try {
      const result = await player.save(gameManager)

      // The write result is the acknowledgement contract: a resolved
      // non-ok status is still a failed save and must be logged +
      // surfaced. notifyFlushComplete stays in finally - the close is
      // never blocked by a save failure (the 2s main timeout backstops).
      if (result.status !== 'ok') {
        console.error('[electron] quit flush save failed', result)
        notification.push('error', i18n.global.t('panels.settings.notifications.saveFailed'))
      }
    } catch (error: unknown) {
      console.error('[electron] quit flush save failed', error)
      notification.push('error', i18n.global.t('panels.settings.notifications.saveFailed'))
    } finally {
      electronAPI.notifyFlushComplete()
    }
  })()
})
```

- [ ] **Step 4: Run — expect PASS + `npm run type-check`.** P13: Electron quit-flush cannot be driven by the web Playwright suite — state that a manual packaged-app check is needed (or verify `electron/main.ts` still compiles under the electron tsconfig used by `vite-plugin-electron`).
- [ ] **Step 5: Commit** `fix(electron): ack quit-flush save result, guard re-entrant close`

---

### Task 2: Character-creation boot transaction (spec B2, audit T1-8)

**Files:**
- Modify: `src/composables/useAppLifecycle.ts` — `UseAppLifecycleDeps.player.save` type (:46-49) and the new-character branch of `bootGame` (:290-292)
- Modify: `src/App.vue:635-664` (`onCharacterCreated` drops its post-boot save; `buildGameSave` import may become unused — remove it from the `services/save/SaveSystem` import at :76-80 if so)
- Test: `src/composables/useAppLifecycle.test.ts` (new describe block)

**Interfaces:**
- Consumes: `player.save(gameManager): Promise<CloudSaveWriteResult>` (the same canonical write `persistPlayer` wraps — `App.vue:379-393`).
- Produces: `bootGame({createNewCharacter:true})` sequence becomes `reset → onNewCharacter grants → player.save → [generation fence] → clock.start → startTickLoop → boot.enterGame → 'entered'`; any non-ok save returns `{status:'failed'}` with `onError` + `boot.fail()` BEFORE `clock.start()`.
- Chosen shape: option (1) — the save moves INTO `bootGame`'s new-character branch. Option (2) (`lifecycle.stopAll()` on failure in `App.vue`) is REJECTED: `stopAll()` is terminal (`stopped=true` blocks every later `bootGame`), so a failed character creation could never be retried from the error screen.

- [ ] **Step 1: Failing tests** — append to `useAppLifecycle.test.ts`:

```ts
describe('useAppLifecycle — B2 character-creation save transaction (audit T1-8)', () => {
  it('new character: first durable save commits BEFORE tick loop / enterGame (order via invocationCallOrder)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('entered')
    expect(stubs.player.save).toHaveBeenCalledTimes(1)

    const saveOrder = (stubs.player.save as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!
    const enterOrder = stubs.boot.enterGame.mock.invocationCallOrder[0]!
    expect(saveOrder).toBeLessThan(enterOrder)
    expect(stubs.clock.start.mock.invocationCallOrder[0]!).toBeGreaterThan(saveOrder)

    lifecycle.stopAll()
  })

  it('new character save non-ok → outcome failed, boot.fail + onError, tick loop and clock NEVER start', async () => {
    const stubs = makeStubs()
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'unavailable',
      message: 'storage blocked',
      retryable: false,
    })
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
    expect(stubs.onError).toHaveBeenCalledWith('storage blocked')
    expect(lifecycle.getTickHandle()).toBeUndefined()
    expect(stubs.clock.start).not.toHaveBeenCalled()
    expect(stubs.intervals).toHaveLength(0)

    lifecycle.stopAll()
  })

  it('conflict save result maps to the session-conflict message', async () => {
    const stubs = makeStubs()
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'conflict',
      currentRevision: 2,
    })
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('failed')
    expect(stubs.onError).toHaveBeenCalledWith('Save đã thay đổi ở một phiên khác.')

    lifecycle.stopAll()
  })

  it('stopAll during the first-save await → continuation is stale, no fail/enter/tick (generation fence extends over the new await)', async () => {
    const stubs = makeStubs()

    let releaseSave: (value: unknown) => void = () => undefined
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (releaseSave = resolve)),
    )

    const lifecycle = makeLifecycle(stubs)
    const boot = lifecycle.bootGame({ createNewCharacter: true })

    // Park bootGame AT the player.save await before stopping — calling
    // stopAll() synchronously only exercises the existing fence after
    // coordinator.reset(), leaving the new post-save fence uncovered.
    await vi.waitFor(() => expect(stubs.player.save).toHaveBeenCalled())
    lifecycle.stopAll()
    releaseSave({ status: 'ok', revision: 1 })

    const outcome = await boot

    expect(outcome.status).toBe('skipped')
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    expect(stubs.intervals).toHaveLength(0)
    expect(stubs.clock.start).not.toHaveBeenCalled()
  })
})
```

  Note: `makeStubs()` already types `player.save` loosely; after the deps retype the default stub `{status:'ok', revision:1}` remains a valid `CloudSaveWriteResult`.

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/composables/useAppLifecycle.test.ts`). Today `player.save` is never called by `bootGame` and the outcome is always `'entered'` for a new character — the first three tests fail on `toHaveBeenCalledTimes(1)` / `toBe('failed')`; the fourth only fails AFTER the fence lands — today `player.save` is never invoked so the `vi.waitFor` itself times out, which still fails the test as intended; once implemented it proves the post-save generation fence works.

- [ ] **Step 3: Implement**

  `useAppLifecycle.ts`:
  1. `import type { CloudSaveWriteResult } from '../services/cloudSave/CloudSaveService'`.
  2. Change the dep type at :46-49 to `save: (gameManager: GameManager) => Promise<CloudSaveWriteResult>` (`player.save` returns exactly this).
  3. In `bootGame`, replace the `else { onNewCharacter?.() }` branch (:290-292):

```ts
      if (loaded.status === 'ok') {
        // ... unchanged restore branch ...
        onRestoreOk?.(offline)
      } else {
        onNewCharacter?.()

        // Audit T1-8 fix — the first durable save is INSIDE the boot
        // transaction: a new character must not reach a ticking runtime
        // until the write commits. Previously App.vue saved AFTER boot
        // returned 'entered', so a failed/conflicted write left the tick
        // loop running on an unpersisted character (bootError showed but
        // the world kept advancing). persistPlayer is NOT used here: its
        // autosave-failure toast/warn dedupe is runtime-loop behaviour,
        // and persistProgress()'s entryStage!=='game' gate would skip the
        // write anyway at this point in boot.
        const firstSave = await player.save(gameManager)

        // Same generation fence as the load await above: a stopAll() that
        // landed during the write makes everything below stale.
        if (bootGeneration !== lifecycleGeneration) {
          return { status: 'skipped' }
        }

        if (firstSave.status !== 'ok') {
          // Verbatim move of the existing App.vue string (pre-existing
          // P16 gap — no save-conflict key exists in either locale
          // today). Cheap fix while here: add `save.conflict` to both
          // locales and use `i18n.global.t` (precedent
          // `useBreakthrough.ts:6,46`); do both or neither, not a
          // half-migration.
          onError(
            firstSave.status === 'conflict'
              ? 'Save đã thay đổi ở một phiên khác.'
              : firstSave.message,
          )
          boot.fail()
          return { status: 'failed' }
        }
      }
```

  (`firstSave.status === 'conflict'` narrows the union so `firstSave.message` type-checks on the `'unavailable'` remainder — no casts.)

  `App.vue` `onCharacterCreated` becomes:

```ts
async function onCharacterCreated(payload: CharacterCreationPayload) {
  player.name = payload.name
  player.selectedTalentIds = payload.talentIds

  for (const [stat, amount] of Object.entries(payload.attributes) as Array<
    [keyof CharacterCreationPayload['attributes'], number]
  >) {
    player.baseStats[stat] += amount
  }

  // The first durable save now lives inside the boot transaction
  // (useAppLifecycle.bootGame): 'entered' is only returned after the write
  // commits, and the tick loop never starts on a failed save — the old
  // post-boot save block here let the runtime tick on an unpersisted
  // character (audit T1-8).
  await bootGame(true)
}
```

  Remove `buildGameSave` from the `services/save/SaveSystem` import if it is no longer referenced elsewhere in the file. `cloudSaveCoordinator` stays (still injected as `coordinator` into `useAppLifecycle` at :365). Bonus correctness: `player.save` sets `lastSavedAt = Date.now()` (`player.ts:291`) — the removed block's raw `cloudSaveCoordinator.save(buildGameSave(...))` never did, so the first save's offline-progress anchor was stale.

- [ ] **Step 4: Run — expect PASS + `npm run type-check`.** P13: wiring-critical — run `npx playwright test tests/e2e/create-to-combat.spec.ts tests/e2e/boot-fresh.spec.ts` (the character-creation boot path) inside the implementation worktree per current P14 — no worktree deferral; if the browser genuinely cannot launch, capture the failure evidence and report an explicit blocker.
- [ ] **Step 5: Commit** `fix(boot): commit first durable save before starting runtime`

---

### Task 3: Release stage slot on defeat during auto-repeat (spec B3, audit T1-4)

**Files:**
- Modify: `src/core/game/GameManagerBattleRewardOps.ts:135-137` (repeat-mode guard inside the victory/defeat terminal)
- Test: `src/core/game/GameManager.repeatStage.test.ts` (extend — it already owns repeat-mode coverage and the `startStage(player, stage, true)` idiom)

**Interfaces:**
- Consumes: `deps.stageWaves.stopRepeat()` → `stageManager.stop()` + `repeatStageContinuously = false` (`StageWaveSystem.ts:92-95`); `StageManager.start()` returns `false` while `active` is held (`StageManager.ts:23-37`); `getStageProgress()` returns `null` once the slot is released (`GameManagerTurnBattleOps.ts:1335-1347` → `StageWaveSystem.getProgress` → `stageManager.get()`).
- Produces: on `state === 'defeat'` the terminal calls `stopRepeat()` unconditionally — the stage system's own contract comment ("Người chơi CHỦ ĐỘNG thoát trận giữa chừng / player chết — dừng stage và tắt auto-repeat", `StageWaveSystem.ts:89-91`). Victory + repeat is unchanged: `restartTurnBattleCycle` (`GameManagerTurnBattleOps.ts:1137`, called only on victory at :746-752) still reuses the held slot.

- [ ] **Step 1: Failing test** — add to `GameManager.repeatStage.test.ts` (reuse its imports; copy the `fragilePlayer`/`LETHAL_ENEMY` stat shape from `GameManager.battleEndPublication.test.ts:43-50,84-89` — headless battles there reach defeat without playback acks because `setPresentationActive` is never called):

```ts
it('defeat during auto-repeat releases the stage slot — a later startStage must not no-op (audit T1-4)', () => {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)

  const killer = defineEnemy({
    id: 'repeat_killer',
    name: 'Repeat Killer',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 10_000_000,
      might: 5_000,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
  const stage: Stage = {
    id: 'repeat_defeat_stage',
    name: 'Repeat Defeat Stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: killer.id, weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 0, maxHp: 50, speed: 10 })

  gameManager.catalogOps.registerEnemyTemplates([killer])
  gameManager.catalogOps.registerStages([stage])
  gameManager.setActivePlayer(player)

  expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

  for (let i = 0; i < 4_000 && gameManager.getTurnBattle()?.state !== 'defeat'; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }

  expect(gameManager.getTurnBattle()?.state).toBe('defeat')

  // The leaked slot is the whole bug: it must be released on defeat even
  // while repeat is armed, or every future startStage returns false.
  expect(gameManager.turnBattleOps.getStageProgress()).toBeNull()
  expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/core/game/GameManager.repeatStage.test.ts`) — `getStageProgress()` is non-null and the second `startStage` returns `false` today.
- [ ] **Step 3: Implement** — in `GameManagerBattleRewardOps.grantTurnBattleRewards`, change the guard at :135-137:

```ts
      // Defeat releases the stage slot UNCONDITIONALLY - auto-repeat only
      // survives victory (settleCombatOutcome restarts in place; a dead
      // player ends stage + repeat per StageWaveSystem's own contract).
      // Skipping stopRepeat() here used to leak StageManager.active, so
      // every later startStage no-opped for the rest of the session (T1-4).
      if (turnBattle.state === 'defeat' || !this.deps.getRepeatContinuously()) {
        this.deps.stageWaves.stopRepeat()
      }
```

  Do not touch the victory path or `turnBattleRepeatContinuously` — the next `startStage` re-arms it via `stageWaves.start(player, stage, repeatContinuously)` (`GameManagerTurnBattleOps.ts:1220`). **Mission C cross-plan note:** plan C's former Task 4 specified this same edit — it has been rewritten to defer here; THIS task is the single owner of the `:135-137` change. Mission C owns the repeat carry/reset policy — this task only fixes the leak.
- [ ] **Step 4: Run — expect PASS** + rerun `npx vitest run src/core/game` (the repeat/bossRepeatCycle/stageRestart/battleEndPublication suites cover the unchanged victory-repeat path).
- [ ] **Step 5: Commit** `fix(battle): release stage slot on defeat during auto-repeat`

---

### Task 4: Async refight contract (spec B4, audit T1-5)

**Files:**
- Modify: `src/composables/useBattleActions.ts` — `runStageStart` (:42-83), `startBattle` (:85-90), `startSelectedStage` (:130-140): return type `boolean | Promise<boolean>` → `Promise<boolean>` uniformly
- Modify: `src/components/game/combat/CombatVictoryPanel.vue` — `refight` (:42-54), `retryNow` (:56-58), countdown callback (:66-112)
- Modify: `src/components/game/combat/CombatDefeatPanel.vue` — `refight` (:74-86), countdown wiring (:88), `retryNow` (:98-101)
- Modify: `src/composables/useAutoRetryCountdown.ts` — `onComplete` type (:16) + invocation (:47)
- Modify: `src/components/panels/StageSelectPanel.vue:203` — `startSelectedStage(...)` → `void startSelectedStage(...)` (result unused; `commit` inside `runStageStart` already owns the success path)
- Test: `src/composables/useAutoRetryCountdown.test.ts` (extend), `src/components/game/combat/CombatDefeatPanel.test.ts` (extend), `src/components/game/combat/CombatVictoryPanel.test.ts` (new — same mount pattern as the defeat test)

**Interfaces:**
- Produces: `startBattle`/`startSelectedStage`: `(… ) => Promise<boolean>`; `useAutoRetryCountdown(seconds, onComplete: () => void | Promise<void>)`.
- Root cause being closed: a `Promise<boolean>` is truthy, so `if (!refight())` rollback branches never ran when the start failed asynchronously; in the defeat panel `isAutoRetrying` stayed `true` forever, leaving the retry button permanently disabled.

- [ ] **Step 1: Failing tests**

  `useAutoRetryCountdown.test.ts` — new describe:

```ts
describe('useAutoRetryCountdown — B4 async onComplete', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts an async onComplete — runs once, rejection is logged not thrown unhandled', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onComplete = vi.fn(async () => {
      throw new Error('refight rejected')
    })
    const { start } = useAutoRetryCountdown(1, onComplete)

    start()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[auto-retry] onComplete callback failed',
      expect.any(Error),
    )

    errorSpy.mockRestore()
  })
})
```

  `CombatDefeatPanel.test.ts` — the mock needs a `turnBattleOps` surface (add to `MockGameManager` + `makeGameManager`): `turnBattleOps: { startStage: vi.fn(() => false) }` and `abandonBattle: vi.fn(() => false)`. New describe:

```ts
describe('CombatDefeatPanel — B4 failed refight recovery (audit T1-5)', () => {
  it('auto-retry countdown ends and startBattle resolves false → retry re-enabled, battleRunMode disarmed to manual', async () => {
    vi.useFakeTimers()
    const gm = makeGameManager()
    // Stage exists so refight() reaches startBattle; the domain refuses it.
    gm.catalogOps.getStage.mockReturnValue({ id: 'mortal_dong_1' })

    const panel = mountPanel(gm, 'repeat')
    panel.ui.selectedStageId = 'mortal_dong_1'
    await nextTick()

    await vi.advanceTimersByTimeAsync(3_000)
    await nextTick()

    expect(panel.ui.battleRunMode).toBe('manual')
    const retryButton = panel.container.querySelector('.combat-defeat-panel__retry')
    expect(retryButton?.classList.contains('is-disabled')).toBe(false)

    panel.unmount()
  })
})
```

  New `src/components/game/combat/CombatVictoryPanel.test.ts` — copy the `mountPanel` harness from `CombatDefeatPanel.test.ts` (same provides; no `ref` extra). Mock: `catalogOps.getStage` returns a stage object, `catalogOps.isStageUnlocked: vi.fn(() => true)`, `turnBattleOps.startStage: vi.fn(() => false)`; `vi.mock('@/core/stage/ProgressStageResolver', ...)` is only needed for the progress-mode case.

```ts
it('repeat mode: countdown refight resolves false → battleRunMode rolls back to manual (Promise truthiness regression)', async () => {
  vi.useFakeTimers()
  const panel = mountPanel() // battleRunMode 'repeat', selectedStageId set, getStage returns a stage
  await vi.advanceTimersByTimeAsync(3_000)
  await nextTick()
  expect(panel.ui.battleRunMode).toBe('manual')
  panel.unmount()
})

it('progress mode: advance to next stage fails → selectedStageId restored + manual', async () => {
  // resolveNextProgressStage mocked to { status:'ready', stage:{id:'next_stage'} };
  // isStageUnlocked → true; startStage → false.
  // Assert ui.selectedStageId === previous id and ui.battleRunMode === 'manual'.
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/composables/useAutoRetryCountdown.test.ts src/components/game/combat/CombatDefeatPanel.test.ts src/components/game/combat/CombatVictoryPanel.test.ts`). The countdown test fails on the `console.error` assertion (no catch today) and/or on the type of the callback; the panel tests fail because `refight()`'s Promise result is never awaited, so `battleRunMode` stays `'repeat'` and `isAutoRetrying` stays `true`.
- [ ] **Step 3: Implement**

  `useAutoRetryCountdown.ts`:

```ts
export function useAutoRetryCountdown(seconds: number, onComplete: () => void | Promise<void>) {
  // ... unchanged until the completion site:
    completed = true
    // onComplete may be async (B4 — refight awaits runAdmitted). A
    // rejection must be logged, not surface as an unhandled rejection from
    // a timer callback.
    void Promise.resolve(onComplete()).catch((error: unknown) => {
      console.error('[auto-retry] onComplete callback failed', error)
    })
```

  `useBattleActions.ts` — make the whole chain async:

```ts
  async function runStageStart(
    stage: Stage,
    repeat: boolean,
    commit: () => void,
  ): Promise<boolean> {
    const startStage = () =>
      gameManager.turnBattleOps.startStage(player.$state, stage, repeat)

    if (!presentation) {
      const started = startStage()

      if (started) {
        commit()
      }

      return started
    }

    const result = await presentation.runAdmitted(
      'combat',
      () => {
        if (!startStage()) {
          return null
        }

        const session = gameManager.getCurrentPresentationSession('combat')

        return session ? { target: 'combat', session } : null
      },
      { compensate: () => void gameManager.abandonBattle() },
    )

    if (result.status !== 'entered') {
      return false
    }

    commit()

    return true
  }

  async function startBattle(stage: Stage): Promise<boolean> {
    return runStageStart(stage, ui.battleRunMode === 'repeat', () => {
      ui.enterCombatScene('stage')
      bumpState()
    })
  }

  async function startSelectedStage(zoneId: string, stage: Stage, mode: BattleRunMode): Promise<boolean> {
    return runStageStart(stage, mode === 'repeat', () => { /* unchanged commit body */ })
  }
```

  `CombatVictoryPanel.vue`:

```ts
async function refight(): Promise<boolean> {
  if (!ui.selectedStageId) {
    return false
  }

  const stage = gameManager.catalogOps.getStage(ui.selectedStageId)

  if (!stage) {
    return false
  }

  return startBattle(stage)
}

function retryNow() {
  void refight()
}
```

  and the countdown callback becomes async with real awaits — `if (!(await refight())) { ui.selectedStageId = previousStageId; ui.battleRunMode = 'manual' }` in the progress branch (:93-96) and `if (!(await refight())) { ui.battleRunMode = 'manual' }` at :109-111.

  `CombatDefeatPanel.vue` — `refight` owns the failure rollback so both entry points (countdown + manual retry) share it:

```ts
async function refight(): Promise<void> {
  if (!ui.selectedStageId) {
    isAutoRetrying.value = false
    return
  }

  const stage = gameManager.catalogOps.getStage(ui.selectedStageId)

  if (!stage) {
    isAutoRetrying.value = false
    return
  }

  const started = await startBattle(stage)

  if (!started) {
    // A refused/failed start must not leave the retry button permanently
    // disabled (T1-5): re-enable it and disarm auto-retry, same rollback
    // contract as the victory panel's !refight() branch.
    isAutoRetrying.value = false
    ui.battleRunMode = 'manual'
  }
}

// countdown wiring stays a direct pass — the widened type accepts it:
const { remaining: retryCountdown, start: startAutoRetryCountdown, stop: stopAutoRetryCountdown } = useAutoRetryCountdown(RETRY_COUNTDOWN_SECONDS, refight)

function retryNow() {
  clearTimers()
  void refight()
}
```

  `StageSelectPanel.vue:203`: `void startSelectedStage(selectedZone.value.id, selectedStage.value, mode.value)`.

- [ ] **Step 4: Run — expect PASS + `npm run type-check`** (the `boolean | Promise<boolean>` → `Promise<boolean>` narrowing surfaces every remaining un-awaited caller as a type error — fix any that appear; do not leave `if (!startBattle(...))` patterns anywhere).
- [ ] **Step 5: Commit** `fix(combat): await async refight results, reset retry state on failure`

---

### Task 5: Auto-farm stop + timestamp guard (spec B5, audit T1-6 + T1-12)

**Files:**
- Modify: `src/core/game/GameManagerAutoFarmOps.ts` — `settleAutoFarmOffline` tail (:130-135)
- Create: `src/components/game/AutoFarmIndicator.vue` — persistent indicator + stop control. **Placement correction vs the audit note:** it must NOT live under `src/components/game/combat/hud/` — those components mount only inside `CombatSceneOverlay` (combat route), and auto-farm holds the single `StageManager` slot while armed, so no combat can be active at the same time. Mount it in `GameRoot.vue` inside the `v-if="!isFullSceneActive"` home-chrome block (:101-137, after `<DongFuCommandWheel />`), which is exactly where it is always reachable.
- Modify: `src/components/layout/GameRoot.vue` (import + mount)
- Modify: `src/components/panels/StageSelectPanel.vue` — armed-state row + stop (:277+ detail section), and guard the unconditional close in `start()` (:197-201)
- Modify: `src/locales/vi.json`, `src/locales/en.json` — new top-level `autoFarm` namespace
- Test: `src/core/game/GameManager.autoFarmOffline.test.ts` (extend — T1-12 case), `src/components/game/AutoFarmIndicator.test.ts` (new), `src/components/panels/StageSelectPanel.test.ts` (extend)

**Interfaces:**
- Consumes: `gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player.$state)` (`GameManagerAutoFarmOps.ts:77-84` — exists, zero production callers); `player.$state.autoFarmStage: { stageId: string; lastCheckedMs: number } | null` (`src/core/player/Player.ts:226`) — Pinia state, reactive in computeds.
- Produces: stop callable from a persistent HUD indicator AND from `StageSelectPanel`; `settleAutoFarmOffline` rebases a stale `lastCheckedMs` so the already-settled capped window cannot be paid twice by the next online `tickAutoFarm`.
- Scope note: the unconditional panel close (`ui.leftPanelMode = null` on a refused `startAutoFarm`, audit T4-38) is only minimally guarded here (`=== true` check, needed for the stop/failure UX to be coherent); the rest of T4-38 (mode disarm on stage change) stays with Mission E6.

- [ ] **Step 1: Failing tests**

  `GameManager.autoFarmOffline.test.ts` — new test in the Remediation describe (harness + `OFFLINE_STAGE` + `perfectClearSeconds['farm_stage'] = 100` already exist):

```ts
it('corrupt small-positive lastCheckedMs → settle pays one capped window, next online tick does NOT pay a second (audit T1-12)', () => {
  vi.useFakeTimers()
  try {
  const { gameManager, player } = harnessWithFarm()

  // tickAutoFarm reads activePlayer via tickOps.update — harnessWithFarm
  // does NOT set it (unlike GameManager.autoFarm.test.ts:53), so set it.
  gameManager.setActivePlayer(player)
  player.perfectClearStageIds.push('farm_stage')
  player.perfectClearSeconds['farm_stage'] = 100 // cycle = 50s

  // Corrupt save shape: epoch+1ms survives validation (finite, >= 0).
  player.autoFarmStage = { stageId: 'farm_stage', lastCheckedMs: 1 }

  // Cycle counter: getBattleRewardSummary().spiritStone aggregates reward
  // rolls without needing a material registry (same read as
  // GameManager.autoFarm.test.ts:118-120). Each cycle pays 2 enemies x 5.
  const before = gameManager.getBattleRewardSummary().spiritStone

  gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 24 * 60 * 60)

  // The settle covered the whole capped window, so the anchor must sit
  // INSIDE it — not still at epoch.
  const anchor = player.autoFarmStage!.lastCheckedMs
  expect(anchor).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000)
  expect(Number.isFinite(anchor)).toBe(true)

  const afterSettle = gameManager.getBattleRewardSummary().spiritStone
  expect(afterSettle).toBeGreaterThan(before)

  // One online tick at most pays the sub-cycle remainder — never another
  // 24h batch (1728 cycles x 2 enemies x 5 stone).
  gameManager.tickOps.update(0.1)

  const tickDelta = gameManager.getBattleRewardSummary().spiritStone - afterSettle
  expect(tickDelta).toBeLessThanOrEqual(2 * 5) // <= 1 cycle worth
  } finally {
    vi.useRealTimers()
  }
})
```

  (`vi.useFakeTimers()` pins `Date.now()`; no material registry needed for the summary counter — `battleEndPublication.test.ts`/`autoFarm.test.ts` read `getBattleRewardSummary().spiritStone` directly. The try/finally matters: `GameManager.autoFarmOffline.test.ts` has no `afterEach(vi.useRealTimers)` — unlike `autoFarm.test.ts:58-61` — so a leaked fake clock would corrupt later tests in the file.)

  **Also update the encoding-the-bug assertion:** `GameManager.autoFarmOffline.test.ts:108-116` (the 3-day settle test) asserts `lastCheckedMs <= startMs + 86_400_000 + 1000` — that upper bound encodes today's stale-anchor bug (any offline session longer than the 24h cap leaves the anchor days in the past, which is exactly what lets the next tick re-pay a capped window). Under the fix the anchor is `now - unsettled remainder`, so update that assertion to a lower-bound check (e.g. `toBeGreaterThan(Date.now() - cycleMs)`) and keep its other assertions.

  `AutoFarmIndicator.test.ts` — mount harness per `StageSelectPanel.test.ts` pattern (`createApp` + `h` + provides `GAME_MANAGER_KEY`, `STATE_VERSION_KEY`, `BUMP_STATE_KEY`, `app.use(i18n)`). The harness must register a fixture stage whose `name` is `'Farm Stage'` (real `STAGES` contain no `farm_stage` — the raw-id fallback would fail the `toContain('Farm Stage')` assertion case-sensitively):

```ts
it('hidden when no auto-farm is armed; armed → shows stage name and stop control; stop issues the domain command', async () => {
  const mounted = mountIndicator()
  const player = usePlayerStore(mounted.pinia)

  expect(mounted.container.querySelector('.auto-farm-indicator')).toBeNull()

  player.autoFarmStage = { stageId: 'farm_stage', lastCheckedMs: Date.now() }
  await nextTick()

  const indicator = mounted.container.querySelector('.auto-farm-indicator')
  expect(indicator).not.toBeNull()
  expect(indicator!.textContent).toContain('Farm Stage')

  mounted.container.querySelector<HTMLButtonElement>('[data-testid="autofarm-stop"]')!.click()
  await nextTick()

  expect(player.autoFarmStage).toBeNull()
  expect(mounted.container.querySelector('.auto-farm-indicator')).toBeNull()
})
```

  `StageSelectPanel.test.ts` — armed-state row + refused-start guard:

```ts
it('auto-farm armed → panel shows running state + stop control; stop releases the farm', async () => {
  // mountStageSelect() currently returns only { container, unmount } —
  // FIRST extend the helper to also return { pinia, manager }.
  const { container, pinia, unmount } = mountStageSelect()
  const player = usePlayerStore(pinia)
  const ui = useUiStore(pinia)

  player.autoFarmStage = { stageId: 'mortal_dong_1', lastCheckedMs: Date.now() }
  await nextTick()

  const stopButton = container.querySelector<HTMLButtonElement>('[data-testid="autofarm-stop"]')
  expect(stopButton).not.toBeNull()

  stopButton!.click()
  await nextTick()
  expect(player.autoFarmStage).toBeNull()
  unmount()
})

it('perfect-farm start refused (stage slot already held) → panel stays open, farm unchanged', async () => {
  const { container, pinia, manager, unmount } = mountStageSelect()
  const player = usePlayerStore(pinia)
  const ui = useUiStore(pinia)

  player.perfectClearStageIds.push('mortal_dong_1', 'mortal_dong_2')
  // Occupy the single stage slot with a farm on another stage.
  expect(manager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, 'mortal_dong_2')).toBe(true)
  ui.leftPanelMode = 'stage_select'
  await nextTick()

  // Select perfect_farm on the already-selected first stage, then Start.
  // The mode row renders 4 <Chip> children in order manual/repeat/
  // progress/perfect_farm (StageSelectPanel.vue:303-312).
  const farmChip = container.querySelectorAll<HTMLElement>('.stage-select__mode .chip')[3]!
  farmChip.click()
  await nextTick()
  container.querySelector<HTMLButtonElement>('[data-testid="stage-start-button"]')!.click()
  await nextTick()

  expect(ui.leftPanelMode).toBe('stage_select')
  expect(player.autoFarmStage?.stageId).toBe('mortal_dong_2')
  unmount()
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/core/game/GameManager.autoFarmOffline.test.ts src/components/game/AutoFarmIndicator.test.ts src/components/panels/StageSelectPanel.test.ts`).
- [ ] **Step 3: Implement**

  `GameManagerAutoFarmOps.settleAutoFarmOffline` — replace the tail (`autoFarm.lastCheckedMs += completedCycles * cycleMs` at :134) with the SAME anchor formula `tickAutoFarm` already uses at :189 (A9 — one anchoring rule, not two):

```ts
    // T1-12 — anchor to now minus the UNSETTLED remainder, identical to
    // tickAutoFarm:189. A stale/corrupt persisted lastCheckedMs used to
    // survive this line untouched: the settle paid the whole capped
    // window, then the next online tickAutoFarm clamped (now - staleTs)
    // to the cap and paid the SAME window a second time (double-pay —
    // also triggered by any honest session longer than the 24h cap).
    autoFarm.lastCheckedMs = Date.now() - (elapsedMs - completedCycles * cycleMs)
```

  Do NOT invent a `Math.max(advanced, floor)` variant — a floor at `now - elapsedMs` still sits `elapsedMs` in the past, so the next tick would re-pay the capped window and the test's `toBeLessThanOrEqual(2 * 5)` fails. The remainder form above makes the anchor ≈ `now` when the whole window settled.

  `src/components/game/AutoFarmIndicator.vue` — new, self-guarded (same pattern as `BattleLogPanel`'s self-hide):

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'

// Audit T1-6 fix — auto-farm holds the single StageManager slot while
// armed, so no combat can be mounted at the same time; the indicator must
// live in the home chrome (GameRoot), not the combat HUD. Stop is a
// domain command (A7): the component never mutates farm state itself.
const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()

const armedStageName = computed(() => {
  const armed = player.autoFarmStage
  if (!armed) {
    return null
  }

  return gameManager.catalogOps.getStage(armed.stageId)?.name ?? armed.stageId
})

function stopAutoFarm() {
  gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player.$state)
}
</script>

<template>
  <div v-if="armedStageName" class="auto-farm-indicator">
    <span class="auto-farm-indicator__label">
      {{ t('autoFarm.running', { stage: armedStageName }) }}
    </span>
    <GameButton variant="danger" size="sm" data-testid="autofarm-stop" @click="stopAutoFarm">
      {{ t('autoFarm.stop') }}
    </GameButton>
  </div>
</template>

<style scoped>
.auto-farm-indicator {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 12;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  background: color-mix(in srgb, var(--ink-950) 80%, transparent);
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--paper-text);
}
</style>
```

  `GameRoot.vue` — `import AutoFarmIndicator from '../game/AutoFarmIndicator.vue'` and mount inside the `v-if="!isFullSceneActive"` template block after `<DongFuCommandWheel />` (:136).

  `StageSelectPanel.vue` — script:

```ts
// Auto-farm B5 — armed state is player state (survives reload), so the
// panel mirrors it: running farm row + stop control, and the perfect-farm
// start only closes the panel when the domain accepted it.
const armedFarmStage = computed(() => {
  const armed = player.$state.autoFarmStage
  if (!armed) {
    return null
  }

  return gameManager.catalogOps.getStage(armed.stageId) ?? null
})

function stopAutoFarm() {
  gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player.$state)
}
```

  In `start()`:

```ts
  if (mode.value === 'perfect_farm') {
    // Only close on an accepted start - a refused start (slot held by a
    // running farm, missing perfect clear) keeps the panel open so the
    // failure is visible instead of silent (partial T4-38).
    if (gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, selectedStage.value.id)) {
      ui.leftPanelMode = null
    }
    return
  }
```

  Template — inside `<section class="stage-select__detail">` (:277), BEFORE `<template v-if="selectedStage">` so it shows even with nothing selected:

```vue
        <div v-if="armedFarmStage" class="stage-select__autofarm">
          <span>{{ t('autoFarm.running', { stage: armedFarmStage.name }) }}</span>
          <GameButton variant="danger" size="sm" data-testid="autofarm-stop" @click="stopAutoFarm">
            {{ t('autoFarm.stop') }}
          </GameButton>
        </div>
```

  plus a `.stage-select__autofarm` style row (flex, gap, muted text — match the file's existing token usage).

  Locales — add to BOTH files at top level (alphabetical position alongside `actionFailure`/`alchemy`):

```json
"autoFarm": {
  "running": "Đang Tự Động Hoàn Mỹ: {stage}",
  "stop": "Dừng"
}
```

```json
"autoFarm": {
  "running": "Auto-farming Perfect Clear: {stage}",
  "stop": "Stop"
}
```

- [ ] **Step 4: Run — expect PASS + `npm run type-check`.** P13/P14: user-visible wiring — note for the reviewer whether e2e coverage of the indicator exists (none today; `tests/e2e/create-to-combat.spec.ts` drives stage select but not farming); flag manual verification.
- [ ] **Step 5: Commit** `fix(autofarm): wire stop control and clamp corrupt timestamps`

---

### Task 6: Detached `$subscribe` cleanup (spec B6, audit T6-51)

**Files:**
- Modify: `src/App.vue` — `:96` already captures `const _automationFlagsUnsubscribe = installAutomationFlagsPersistence(ui)`; wire the call into `onUnmounted` (:674-711, next to `electronBridgeDispose?.()` at :688)
- The subscription itself lives inside `installAutomationFlagsPersistence` (`src/stores/uiFlagsPersistence.ts:109-131`, `{ detached: true }` at :129) — do NOT add a second `ui.$subscribe` in App.vue; that would double-install the persistence writer.
- No test file: `App.vue` is not unit-mountable; coverage is the HMR/remount semantics already exercised in `useAppLifecycle.test.ts` patterns + manual verification.

**Interfaces:**
- `installAutomationFlagsPersistence(ui)` returns the `ui.$subscribe(cb, { detached: true })` disposer. `detached: true` is what makes manual cleanup mandatory — the subscription outlives the component otherwise, and every HMR/remount stacks another persistence writer.

- [ ] **Step 1: Confirm current state** — the disposer is already captured (Mission A Task 5 merged this) but the leading-underscore name `_automationFlagsUnsubscribe` documents it as intentionally-unused; nothing calls it. If execution order changes and this somehow lands before Mission A, first create the capture (`const automationFlagsUnsubscribe = installAutomationFlagsPersistence(ui)`), then continue.
- [ ] **Step 2: Implement** — rename `_automationFlagsUnsubscribe` → `automationFlagsUnsubscribe` (the underscore is now a lie) and call it in `onUnmounted`, next to `electronBridgeDispose?.()`:

```ts
  // detached:true means Vue will NOT auto-unsubscribe on unmount; the
  // disposer must be called or every HMR remount stacks another
  // persistence writer (audit T6-51).
  automationFlagsUnsubscribe()
```

- [ ] **Step 3: Run `npm run type-check` + `npx vitest run src/App.wiring.test.ts src/App.routeMountWitness.test.ts src/stores`** — note: `App.wiring.test.ts` only collects top-level function declarations/arrow initializers, so it does NOT detect an orphaned `const` disposer binding; the wiring is verified by reading the diff (call site inside `onUnmounted`) plus type-check.
- [ ] **Step 4: Commit** `fix(app): dispose detached automation-flags subscription`

---

## Mission B done-criteria

- Quit path logs + surfaces save failure via the notification store; still acks (2s backstop intact); a second `close` during the flush window cannot re-send `app:before-quit-flush` or stack a second `app:flush-complete` listener.
- New character cannot reach a ticking runtime without a committed save: `player.save` runs inside `bootGame` before `clock.start()`/`startTickLoop`, failure → `onError` + `boot.fail()` + `{status:'failed'}`, and the generation fence covers the new await.
- Defeat + repeat releases `StageManager.active` (`stopRepeat` unconditional on defeat); repeat victory still restarts in place.
- `startBattle`/`refight`/`startSelectedStage` are `Promise<boolean>` and awaited everywhere; failed starts restore `battleRunMode`/selection/`isAutoRetrying`.
- Auto-farm is stoppable from a persistent `AutoFarmIndicator` (home chrome) and from `StageSelectPanel`; a corrupt small-positive `lastCheckedMs` can no longer double-pay across settle→tick.
- The detached `ui.$subscribe` disposer is captured and called on unmount.
- `npm run type-check` + `npx vitest run src/composables src/core/game src/components/game src/components/panels src/main-process src/stores` green; `tests/e2e/create-to-combat.spec.ts` + `tests/e2e/boot-fresh.spec.ts` for the boot transaction (P13); P4 quick QA; P5 three-lens review round.
