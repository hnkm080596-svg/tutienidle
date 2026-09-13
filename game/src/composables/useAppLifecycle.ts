import { onBeforeUnmount, type Ref } from 'vue'
import type { GameManager } from '../core/game/GameManager'
import type { CloudSaveCoordinator } from '../services/cloudSave/CloudSaveCoordinator'
import { ESSENCE_STREAM_ARRIVAL_EVENT } from '../core/battle/BattleEvents'

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
    save: (gameManager: GameManager) => Promise<unknown>
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
  } = deps

  let autosaveHandle: number | undefined
  let bootInFlight = false
  let saveInFlight = false
  let persistenceSuppressed = false
  let stopped = false
  // ARCH-013/L04 — boot generation. `stopAll()` bumps it, so every async
  // continuation that captured the pre-stop value can tell it is stale and
  // must not write (restore, timers, route transitions) into a disposed
  // lifecycle. Same generation-fence idiom as useDynamicRegion /
  // PhaserSceneAdapter gameGeneration.
  let lifecycleGeneration = 0

  const AUTOSAVE_INTERVAL_MS = 15_000
  const TICK_INTERVAL_MS = 1_000

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

      boot.startSaveLoad()

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
          onError(restored.message ?? 'Restore failed')
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
        onNewCharacter?.()
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
