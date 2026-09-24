import { onBeforeUnmount, type Ref } from 'vue'
import type { GameManager } from '../core/game/GameManager'
import type { CloudSaveCoordinator } from '../services/cloudSave/CloudSaveCoordinator'
import type { CloudSaveWriteResult } from '../services/cloudSave/CloudSaveService'
import { ESSENCE_STREAM_ARRIVAL_EVENT } from '../core/battle/BattleEvents'
import { TICK_INTERVAL_MS } from '../core/idle/SpeedSettings'
import { i18n } from '@/i18n'

/**
 * Remediation Task 5 (2026-09-05) — App boot/tick/listener lifecycle
 * IDEMPOTENT, extract từ App.vue <script setup> để test được (script
 * setup không test trực tiếp; toàn bộ dependency inject qua options).
 *
 * Bất biến:
 * 1. startTickLoop()/startAutosave() gọi nhiều lần → đúng 1 interval
 *    (trước đây setInterval đè handle — interval cũ leak, tick 2×/giây).
 * 2. bootGame() 2 lần khi boot đầu còn pending → boot flow chỉ chạy 1
 *    lần (bootInFlight guard; reset khi fail để retry còn đường).
 * 3. persistProgress() gọi dồn trong khi save chưa xong → 1 lần save
 *    (saveInFlight — đã có trước đây, giữ nguyên contract).
 * 4. stopAll()/unmount: MỌI event-bus handler + DOM listener gỡ
 *    symmetric với đăng ký; gọi lại là no-op (idempotent teardown).
 * 5. ARCH-013/L04 — stopAll() là terminal: bump `lifecycleGeneration` để
 *    mọi continuation còn pending qua await (boot load) trở thành stale —
 *    không restore, không start interval, không route request nào được
 *    ghi vào App đã teardown; và chặn luôn boot/timer/listener MỚI sau đó
 *    (cùng idiom generation fence của useDynamicRegion/PhaserSceneAdapter).
 *    persistProgress là ngoại lệ CỐ Ý: flush cuối của App.vue's onUnmounted
 *    chạy SAU onBeforeUnmount(stopAll) — listener-driven callers thì đã bị
 *    gỡ hết rồi nên không có stale persist nào tới được đó.
 */
export interface UseAppLifecycleDeps {
  clock: { start: () => void; stop: () => void; nowSeconds: () => number }
  /** Tương thích window.setInterval — inject để test kiểm soát timer. */
  scheduleInterval: (callback: () => void, timeoutMs: number) => number
  /** Tương thích window.clearInterval — inject để test assert. */
  clearHandle: (handle: number) => void
  addEventListener: (type: string, handler: EventListenerOrEventListenerObject) => void
  removeEventListener: (type: string, handler: EventListenerOrEventListenerObject) => void
  boot: {
    startSaveLoad: () => void
    startInitializing: () => void
    enterGame: () => void
    fail: () => void
    requireCharacter: () => void
    showAuth: () => void
  }
  coordinator: Pick<CloudSaveCoordinator, 'load' | 'save' | 'reset'>
  player: {
    save: (gameManager: GameManager) => Promise<CloudSaveWriteResult>
    $state: object
  }
  gameManager: GameManager
  /**
   * Callback tick mỗi giây (deltaSeconds, cultivate, bumpState... — phụ
   * thuộc UI nên vẫn sống ở App.vue). bootGame() TỰ khởi động interval
   * này khi boot thành công (xem bootGame() bên dưới) — composable đã sở
   * hữu clock.start()/startAutosave() nên gộp luôn startTickLoop() vào
   * cùng một chỗ, tránh lặp lại đúng lớp bug đã gây freeze toàn bộ game
   * (extract composable nhưng quên rewire lời gọi startTickLoop() ở nơi
   * gọi — xem freeze-rootcause.md 2026-09-06).
   */
  tick: () => void
  offlineSummary: { show: (summary: { elapsedSeconds: number; cultivation: number }) => void }
  saveIssue: {
    report: (status: 'incompatible' | 'corrupted', raw: string, foundVersion?: number) => void
  }
  entryStage: Ref<string>
  restoreGameSession: (
    player: unknown,
    gameManager: GameManager,
    save: unknown,
  ) => { status: string; message?: string; offline?: { elapsedSeconds: number; cultivation: number } }
  persistPlayer: () => Promise<unknown>
  onError: (message: string) => void
  /**
   * Full page reload seam (App.vue passes window.location.reload). Used
   * when a retried character creation would otherwise double-apply the
   * starter grants left over from a failed first save - no manager-level
   * reset exists, so the only honest recovery is a clean process (same
   * convention as the settings delete-save flow).
   */
  hardReset: () => void
  /**
   * Spec F8 - optional login-time remote save reconciliation. Invoked
   * inside bootGame after boot.startSaveLoad() and before
   * coordinator.load(), only when !createNewCharacter. A rejection is
   * logged and boot proceeds on the local slot - remote unavailability
   * must never block boot.
   */
  remoteSync?: () => Promise<unknown>
}

export interface BootOutcome {
  status: 'entered' | 'require-character' | 'failed' | 'skipped'
}

export interface BootOptions {
  createNewCharacter: boolean
  /** Chạy khi restore save ok — grant skill/init UI phụ thuộc App (offline modal đã show trong composable). */
  onRestoreOk?: (offline: { elapsedSeconds: number; cultivation: number }) => void
  /** Chạy khi tạo nhân vật mới — grant khởi đầu phụ thuộc App. */
  onNewCharacter?: () => void
}

export function useAppLifecycle(deps: UseAppLifecycleDeps) {
  const {
    clock,
    scheduleInterval,
    clearHandle,
    addEventListener,
    removeEventListener,
    boot,
    coordinator,
    player,
    gameManager,
    tick,
    offlineSummary,
    saveIssue,
    entryStage,
    restoreGameSession,
    persistPlayer,
    onError,
    remoteSync,
  } = deps

  let autosaveHandle: number | undefined
  let bootInFlight = false
  let saveInFlight = false
  let persistenceSuppressed = false
  let stopped = false
  // B2 (audit T1-8 follow-up) — starter grants commit to runtime state
  // BEFORE the first save; if that save fails, the buildings/materials/
  // activePlayer already applied cannot be rolled back in memory. A
  // second createNewCharacter boot must reload instead of re-granting.
  let newCharacterGrantsApplied = false
  // ARCH-013/L04 — boot generation. `stopAll()` bumps it, so every async
  // continuation that captured the pre-stop value can tell it is stale and
  // must not write (restore, timers, route transitions) into a disposed
  // lifecycle. Same generation-fence idiom as useDynamicRegion /
  // PhaserSceneAdapter gameGeneration.
  let lifecycleGeneration = 0

  const AUTOSAVE_INTERVAL_MS = 15_000

  // --- Event-bus handlers: đăng ký một lần, gỡ symmetric khi teardown ---

  // Tinh hoa tuôn chảy (2026-08-30) — state machine essence stream.
  let essenceEmitted = false
  let essenceArrivalSeen = false
  let lastEssenceEmitTime = 0
  const HEADLESS_TIMEOUT_MS = 2000

  const onEssenceArrival = () => {
    essenceArrivalSeen = true
  }

  const onRewardParticle = (event: { kind?: string }) => {
    if (event.kind === 'essence') {
      essenceEmitted = true
      lastEssenceEmitTime = performance.now()
    }
  }

  gameManager.eventBus.on<void>(ESSENCE_STREAM_ARRIVAL_EVENT, onEssenceArrival)
  gameManager.eventBus.on<{ kind: string }>('reward_particle', onRewardParticle)

  // --- DOM listeners (visibility/pagehide autosave flush) ---

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      void persistProgress()
    }
  }

  const onPageHide = () => {
    void persistProgress()
  }

  // --- Tick loop (App.vue đăng ký callback tick có phụ thuộc UI) ---

  let onTick: (() => void) | undefined
  let tickHandle: number | undefined

  /**
   * Đăng ký callback tick. Gọi lại khi interval đã chạy là NO-OP —
   * interval cũ KHÔNG bị đè (fix leak: trước đây setInterval gán thẳng
   * tickHandle, interval trước đó thành rác chạy mãi mãi).
   */
  function startTickLoop(tick: () => void): void {
    if (tickHandle !== undefined || stopped) {
      return
    }

    onTick = tick
    tickHandle = scheduleInterval(() => onTick?.(), TICK_INTERVAL_MS)
  }

  function startAutosave(): void {
    if (autosaveHandle !== undefined || stopped) {
      return
    }

    autosaveHandle = scheduleInterval(() => void persistProgress(), AUTOSAVE_INTERVAL_MS)
    addEventListener('visibilitychange', onVisibilityChange)
    addEventListener('pagehide', onPageHide)
  }

  // --- Persistence ---

  async function persistProgress(): Promise<void> {
    // `stopped` CỐ Ý không nằm trong gate này: mọi caller do listener/interval
    // điều khiển đã bị stopAll() gỡ (visibilitychange/pagehide off, autosave
    // cleared), nên không còn stale caller nào tới được đây. Caller duy nhất
    // còn lại sau stopAll là flush TẬN CÙNG chủ đích trong App.vue's
    // onUnmounted — và nó BẮT BUỘC phải chạy: Vue gọi onBeforeUnmount(stopAll)
    // TRƯỚC onUnmounted, nếu stopped chặn save thì "persist first so a
    // development reload cannot roll the player back" là dead code
    // (review round 1 — ARCH-013/L04).
    if (persistenceSuppressed || entryStage.value !== 'game' || saveInFlight) {
      return
    }

    saveInFlight = true

    try {
      await persistPlayer()
    } catch (error: unknown) {
      console.error('[autosave] unexpected save failure', error)
    } finally {
      saveInFlight = false
    }
  }

  // --- Boot flow (idempotent while in-flight) ---

  async function bootGame(options: BootOptions): Promise<BootOutcome> {
    if (bootInFlight || stopped) {
      return { status: 'skipped' }
    }

    bootInFlight = true
    // Captured BEFORE the first await. Everything past the await below
    // compares against this: a stopAll() that landed while the load was in
    // flight makes every later side effect (restore, clock, intervals,
    // route requests) stale work for a disposed lifecycle.
    const bootGeneration = lifecycleGeneration

    try {
      const { createNewCharacter, onRestoreOk, onNewCharacter } = options

      if (createNewCharacter && newCharacterGrantsApplied) {
        // A previous attempt already committed starter grants to runtime
        // state and its first save failed - re-running onNewCharacter
        // would double-grant buildings/materials and persist the doubled
        // state. Reload for a clean process instead of re-granting.
        deps.hardReset()
        return { status: 'skipped' }
      }

      boot.startSaveLoad()

      if (!createNewCharacter && remoteSync) {
        try {
          await remoteSync()
        } catch (error: unknown) {
          // Remote reconciliation must never block boot - the local slot
          // is the authority for loadGame() either way.
          console.warn('[boot] remote save sync failed; continuing on local slot', error)
        }
      }

      // Nhân vật mới reset revision về 0 khớp storage (deleteSave đã xoá
      // revision key) — tránh CAS-fail save đầu tiên.
      const loaded = createNewCharacter
        ? (coordinator.reset(), await Promise.resolve({ status: 'empty' as const, revision: 0 as const }))
        : await coordinator.load()

      // ARCH-013/L04 generation fence — spans EVERY status branch below:
      // 'ok' would restore/start/enter, but the failure branches are route
      // transitions too (boot.fail -> 'error', requireCharacter ->
      // 'character'), and onError/saveIssue.report write UI state into a
      // possibly-unmounted App. New awaits added here must re-check this
      // same generation.
      if (bootGeneration !== lifecycleGeneration) {
        return { status: 'skipped' }
      }

      if (loaded.status === 'unavailable') {
        onError(loaded.message)
        boot.fail()
        return { status: 'failed' }
      }

      if (loaded.status === 'incompatible' || loaded.status === 'corrupted') {
        saveIssue.report(
          loaded.status,
          'raw' in loaded && typeof loaded.raw === 'string' ? loaded.raw : '',
          loaded.status === 'incompatible' && 'foundVersion' in loaded ? loaded.foundVersion : undefined,
        )
        boot.fail()
        return { status: 'failed' }
      }

      if (loaded.status === 'empty' && !createNewCharacter) {
        boot.requireCharacter()
        return { status: 'require-character' }
      }

      boot.startInitializing()

      if (loaded.status === 'ok') {
        const restored = restoreGameSession(player, gameManager, loaded.save)

        if (restored.status === 'rejected') {
          // A save the boot path cannot consume must reach a recovery
          // surface (export/delete) like incompatible/corrupted; routing
          // 'rejected' to onError leaves the offending save wedged on
          // every subsequent boot (QA F-INT-01). The precise rejection
          // reason stays in the diagnostics channel; the recovery
          // surface deliberately shows a generic corrupted state.
          console.warn('[boot] save rejected by restore preflight:', restored.message)
          saveIssue.report('corrupted', JSON.stringify(loaded.save))
          boot.fail()
          return { status: 'failed' }
        }

        const offline = restored.offline ?? { elapsedSeconds: 0, cultivation: 0 }

        // Beta Phase 4 (mục XIV) — chỉ hiện modal nếu offline đủ dài
        // (>60s, tránh phiền khi refresh nhanh).
        if (offline.elapsedSeconds > 60) {
          offlineSummary.show({
            elapsedSeconds: offline.elapsedSeconds,
            cultivation: offline.cultivation,
          })
        }

        onRestoreOk?.(offline)
      } else {
        // Mark the transaction dirty BEFORE the callback runs
        // (Mission B audit): the callback drives non-idempotent grants
        // across several mutable authorities. A mid-grant throw leaves a
        // partially-mutated runtime — the flag must already be set so any
        // later retry takes the dirty-transaction branch (hardReset)
        // instead of re-running grants on top of the partial state.
        newCharacterGrantsApplied = true

        try {
          // Await even though the type is () => void: a promise-returning
          // callback is silently assignable to it, and an async rejection
          // must land in this same catch rather than escaping bootGame.
          await onNewCharacter?.()
        } catch (error: unknown) {
          // Same visible-failure contract as a throwing first save: a
          // grant-phase throw must resolve through boot.fail()/onError,
          // not escape bootGame as an unhandled rejection (the
          // `await bootGame(true)` caller has no catch) leaving the app
          // on the loading screen forever.
          console.error('[boot] character creation grants threw', error)

          if (bootGeneration !== lifecycleGeneration) {
            return { status: 'skipped' }
          }

          onError(i18n.global.t('save.createFailed'))
          boot.fail()
          return { status: 'failed' }
        }

        // Audit T1-8 fix — the first durable save is INSIDE the boot
        // transaction: a new character must not reach a ticking runtime
        // until the write commits. Previously App.vue saved AFTER boot
        // returned 'entered', so a failed/conflicted write left the tick
        // loop running on an unpersisted character (bootError showed but
        // the world kept advancing). persistPlayer is NOT used here: its
        // autosave-failure toast/warn dedupe is runtime-loop behaviour,
        // and persistProgress()'s entryStage!=='game' gate would skip the
        // write anyway at this point in boot.
        let firstSave: CloudSaveWriteResult

        try {
          firstSave = await player.save(gameManager)
        } catch (error: unknown) {
          // A throwing service must still resolve the transaction
          // visibly - coordinator.save has no try/catch, so a remote
          // CloudSaveService rejecting on network failure would escape
          // bootGame as an unhandled rejection and leave the app on the
          // loading screen forever (boot.fail() never runs).
          console.error('[boot] first character save threw', error)

          if (bootGeneration !== lifecycleGeneration) {
            return { status: 'skipped' }
          }

          onError(i18n.global.t('panels.settings.notifications.saveFailed'))
          boot.fail()
          return { status: 'failed' }
        }

        // Same generation fence as the load await above: a stopAll() that
        // landed during the write makes everything below stale.
        if (bootGeneration !== lifecycleGeneration) {
          return { status: 'skipped' }
        }

        if (firstSave.status !== 'ok') {
          onError(
            firstSave.status === 'conflict'
              ? i18n.global.t('save.conflict')
              : firstSave.message,
          )
          boot.fail()
          return { status: 'failed' }
        }
      }

      clock.start()

      // Fix (2026-09-06) — bootGame() TỰ start tick loop thay vì nhờ
      // caller nhớ gọi startTickLoop() sau khi boot xong. Đây chính là
      // lời gọi từng bị rớt khi Task 5 extract inline boot logic của
      // App.vue sang composable này (commit d6d9a1d) — kết quả:
      // GameManager.update() không bao giờ chạy trong browser thật, toàn
      // bộ game (combat/tu luyện/sản xuất...) đứng hình vô thời hạn dù
      // 2651 unit test vẫn xanh (test gọi thẳng gameManager.tickOps.update(), bỏ
      // qua đúng lớp wiring này). Gộp vào bootGame() — nơi đã sở hữu
      // clock.start()/startAutosave() — để "extract composable, quên
      // rewire" không còn khả năng lặp lại được nữa.
      startTickLoop(tick)
      boot.enterGame()

      return { status: 'entered' }
    } finally {
      // Reset guard KỂ CẢ khi fail — boot lại (auth retry) vẫn chạy được.
      bootInFlight = false
    }
  }

  /** Reset-save flow: chặn autosave/save flush trước khi xoá save + reload. */
  function suppressPersistence(): void {
    persistenceSuppressed = true
    stopAll()
  }

  function isPersistenceSuppressed(): boolean {
    return persistenceSuppressed
  }

  // --- Essence stream state (tick đọc qua getters, không giữ state local) ---

  function consumeEssenceArrival(): boolean {
    if (!essenceArrivalSeen) {
      return false
    }

    essenceArrivalSeen = false
    essenceEmitted = false

    return true
  }

  function isEssenceHeadlessTimedOut(): boolean {
    return !essenceArrivalSeen && essenceEmitted
      && performance.now() - lastEssenceEmitTime > HEADLESS_TIMEOUT_MS
  }

  function clearEssenceEmitted(): void {
    essenceEmitted = false
  }

  /**
   * Teardown TERMINAL: gỡ mọi listener + interval VÀ vô hiệu mọi async
   * continuation còn pending (boot generation bump — ARCH-013/L04). Sau
   * stopAll không còn boot/timer/listener mới được đăng ký: composable
   * này thuộc 1 mount, mount mới dựng instance mới. persistProgress() vẫn
   * được phép — caller post-stop duy nhất là flush tận cùng trong App.vue's
   * onUnmounted (beforeUnmount đã gỡ mọi listener-driven caller). Idempotent
   * — gọi nhiều lần an toàn (guard `stopped` cho unsubscribe; clearHandle
   * chỉ chạy khi handle còn tồn tại; generation cứ bump — inequality là đủ).
   */
  function stopAll(): void {
    lifecycleGeneration += 1

    if (!stopped) {
      stopped = true

      gameManager.eventBus.off(ESSENCE_STREAM_ARRIVAL_EVENT, onEssenceArrival)
      gameManager.eventBus.off('reward_particle', onRewardParticle)
      removeEventListener('visibilitychange', onVisibilityChange)
      removeEventListener('pagehide', onPageHide)
    }

    if (tickHandle !== undefined) {
      clearHandle(tickHandle)
      tickHandle = undefined
    }

    if (autosaveHandle !== undefined) {
      clearHandle(autosaveHandle)
      autosaveHandle = undefined
    }
  }

  /** Hook Vue — tự teardown khi component unmount (HMR/reload an toàn). */
  onBeforeUnmount(stopAll)

  return {
    startTickLoop,
    startAutosave,
    persistProgress,
    bootGame,
    stopAll,
    suppressPersistence,
    isPersistenceSuppressed,
    consumeEssenceArrival,
    isEssenceHeadlessTimedOut,
    clearEssenceEmitted,
    /** Test/mount-tracing — handle hiện hành (undefined = không interval). */
    getTickHandle: () => tickHandle,
    getAutosaveHandle: () => autosaveHandle,
  }
}
