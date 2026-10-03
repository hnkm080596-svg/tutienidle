import { onBeforeUnmount, type Ref } from 'vue'
import type { GameManager } from '../core/game/GameManager'
import type { CloudSaveCoordinator } from '../services/cloudSave/CloudSaveCoordinator'
import type { CloudSaveWriteResult } from '../services/cloudSave/CloudSaveService'
import type { BackendErrorCode, RemoteCharacterMetadata } from '../services/session/BackendStatus'
import type { RestoreTimeAuthority } from '../services/save/saveTypes'
import type { PlayerData } from '../core/player/Player'
import { unsupportedReleaseReason } from '../core/betaScopeSurface'
import type { BetaUnsupportedReason } from '../core/betaScopeSurface'
import { ESSENCE_STREAM_ARRIVAL_EVENT } from '../core/battle/BattleEvents'
import { TICK_INTERVAL_MS } from '../core/idle/SpeedSettings'
import { i18n } from '@/i18n'
import { recordSaveOutcome } from '../services/diagnostics/recordSaveOutcome'

/**
 * Remediation Task 5 (2026-09-05) - App boot/tick/listener lifecycle
 * IDEMPOTENT, extract tu App.vue <script setup> de test duoc (script
 * setup khong test truc tiep; toan bo dependency inject qua options).
 *
 * Bat bien:
 * 1. startTickLoop()/startAutosave() goi nhieu lan -> dung 1 interval
 *    (truoc day setInterval de handle - interval cu leak, tick 2x/giay).
 * 2. bootGame() 2 lan khi boot dau con pending -> boot flow chi chay 1
 *    lan (bootInFlight guard; reset khi fail de retry con duong).
 * 3. persistProgress() goi don trong khi save chua xong -> 1 lan save
 *    (saveInFlight - da co truoc day, giu nguyen contract).
 * 4. stopAll()/unmount: MOI event-bus handler + DOM listener go
 *    symmetric voi dang ky; goi lai la no-op (idempotent teardown).
 * 5. ARCH-013/L04 - stopAll() la terminal: bump `lifecycleGeneration` de
 *    moi continuation con pending qua await (boot load) tro thanh stale -
 *    khong restore, khong start interval, khong route request nao duoc
 *    ghi vao App da teardown; va chan luon boot/timer/listener MOI sau do
 *    (cung idiom generation fence cua useDynamicRegion/PhaserSceneAdapter).
 *    persistProgress la ngoai le CO Y: flush cuoi cua App.vue's onUnmounted
 *    chay SAU onBeforeUnmount(stopAll) - listener-driven callers thi da bi
 *    go het roi nen khong co stale persist nao toi duoc do.
 */
export interface UseAppLifecycleDeps {
  clock: { start: () => void; stop: () => void; nowSeconds: () => number }
  /** Tuong thich window.setInterval - inject de test kiem soat timer. */
  scheduleInterval: (callback: () => void, timeoutMs: number) => number
  /** Tuong thich window.clearInterval - inject de test assert. */
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
  coordinator: Pick<CloudSaveCoordinator, 'load' | 'save' | 'reset' | 'capability'>
  /** B1-D - the online-admission authority: the lifecycle marks boot
   *  admission, gates the tick/autosave on it and exposes the reversible
   *  pause/resume the controller calls on authority loss/recovery. */
  authority: {
    canMutate: () => boolean
    beginChecking: () => void
    markReady: () => void
    markFailed: (code: BackendErrorCode | 'recovery' | undefined) => void
    observeSaveResult: (result: CloudSaveWriteResult) => void
  }
  player: {
    save: (gameManager: GameManager) => Promise<CloudSaveWriteResult>
    $state: object
  }
  gameManager: GameManager
  /**
   * Callback tick moi giay (deltaSeconds, cultivate, bumpState... - phu
   * thuoc UI nen van song o App.vue). bootGame() TU khoi dong interval
   * nay khi boot thanh cong (xem bootGame() ben duoi) - composable da so
   * huu clock.start()/startAutosave() nen gop luon startTickLoop() vao
   * cung mot cho, tranh lap lai dung lop bug da gay freeze toan bo game
   * (extract composable nhung quen rewire loi goi startTickLoop() o noi
   * goi - xem freeze-rootcause.md 2026-09-06).
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
    timeAuthority?: RestoreTimeAuthority,
  ) => { status: string; message?: string; offline?: { elapsedSeconds: number; cultivation: number } }
  persistPlayer: () => Promise<unknown>
  onError: (message: string) => void
  /**
   * Contract sec.H notice seam: a save that loads with out-of-scope state
   * still plays - this surfaces the dormant-record reason to the UI
   * (toast/banner owned by the caller). Called at most once per restored
   * load; never for in-scope saves.
   */
  unsupportedSaveNotice?: (reason: BetaUnsupportedReason) => void
  /**
   * Full page reload seam (App.vue passes window.location.reload). Used
   * when a retried character creation would otherwise double-apply the
   * starter grants left over from a failed first save - no manager-level
   * reset exists, so the only honest recovery is a clean process (same
   * convention as the settings delete-save flow).
   */
  hardReset: () => void
}

export interface BootOutcome {
  status: 'entered' | 'require-character' | 'failed' | 'skipped'
}

export interface BootOptions {
  createNewCharacter: boolean
  /** Chay khi restore save ok - grant skill/init UI phu thuoc App (offline modal da show trong composable). */
  onRestoreOk?: (offline: { elapsedSeconds: number; cultivation: number }) => void
  /** Runs when a new character enters - the starter grants owned by App.
   *  Remote-authoritative CHARACTER_UNINITIALIZED carries the canonical
   *  server metadata the starter snapshot must be rebuilt from (B1.4);
   *  absent for the local/pending-payload path. */
  onNewCharacter?: (metadata?: RemoteCharacterMetadata) => void | Promise<void>
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
    authority,
    player,
    gameManager,
    tick,
    offlineSummary,
    saveIssue,
    entryStage,
    restoreGameSession,
    persistPlayer,
    onError,
    unsupportedSaveNotice,
  } = deps

  let autosaveHandle: number | undefined
  let bootInFlight = false
  let saveInFlight = false
  let persistenceSuppressed = false
  let stopped = false
  // B1-D - reversible authority pause: the OnlineSessionController calls
  // pauseSimulation() on OBSERVED authority loss and resumeSimulation()
  // once the reconnect pipeline lands. Distinct from `stopped` (terminal
  // teardown): intervals come back and the clock re-anchors so the
  // paused delta is discarded rather than paid as catch-up.
  let simPaused = false
  // B2 (audit T1-8 follow-up) - starter grants commit to runtime state
  // BEFORE the first save; if that save fails, the buildings/materials/
  // activePlayer already applied cannot be rolled back in memory. A
  // second createNewCharacter boot must reload instead of re-granting.
  let newCharacterGrantsApplied = false
  // ARCH-013/L04 - boot generation. `stopAll()` bumps it, so every async
  // continuation that captured the pre-stop value can tell it is stale and
  // must not write (restore, timers, route transitions) into a disposed
  // lifecycle. Same generation-fence idiom as useDynamicRegion /
  // PhaserSceneAdapter gameGeneration.
  let lifecycleGeneration = 0

  const AUTOSAVE_INTERVAL_MS = 15_000

  // --- Event-bus handlers: dang ky mot lan, go symmetric khi teardown ---

  // Tinh hoa tuon chay (2026-08-30) - state machine essence stream.
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

  // --- Tick loop (App.vue dang ky callback tick co phu thuoc UI) ---

  let onTick: (() => void) | undefined
  let tickHandle: number | undefined

  /**
   * Dang ky callback tick. Goi lai khi interval da chay la NO-OP -
   * interval cu KHONG bi de (fix leak: truoc day setInterval gan thang
   * tickHandle, interval truoc do thanh rac chay mai mai).
   */
  function startTickLoop(tick: () => void): void {
    if (tickHandle !== undefined || stopped) {
      return
    }

    onTick = tick
    // B1-D - the callback still checks admission at fire time: a late
    // interval callback that outlives pause() must not tick (the paused
    // delta is discarded by the clock re-anchor on resume, not paid).
    tickHandle = scheduleInterval(() => {
      if (authority.canMutate()) {
        onTick?.()
      }
    }, TICK_INTERVAL_MS)
  }

  function startAutosave(): void {
    if (autosaveHandle !== undefined || stopped) {
      return
    }

    autosaveHandle = scheduleInterval(() => void persistProgress(), AUTOSAVE_INTERVAL_MS)
    addEventListener('visibilitychange', onVisibilityChange)
    addEventListener('pagehide', onPageHide)
  }

  // --- B1-D reversible pause/resume (authority-driven) ---

  function pauseSimulation(): void {
    // Only a live simulation pauses: an authority terminal during boot
    // admission must not latch simPaused - a stale flag would turn the
    // NEXT live pause into a no-op (clock running, combat unfrozen).
    if (stopped || simPaused || entryStage.value !== 'game') {
      return
    }
    simPaused = true

    if (tickHandle !== undefined) {
      clearHandle(tickHandle)
      tickHandle = undefined
    }
    if (autosaveHandle !== undefined) {
      clearHandle(autosaveHandle)
      autosaveHandle = undefined
    }
    removeEventListener('visibilitychange', onVisibilityChange)
    removeEventListener('pagehide', onPageHide)

    // Stop the live clock so resume() re-anchors at real-now: the paused
    // window is discarded, not paid as offline catch-up (B1.7).
    clock.stop()
    // Combat domain freeze under its own reason - the combat clock
    // resumes when the reason clears, never by a plain stop/start.
    gameManager.freezeCombat('authority-pause')
  }

  function resumeSimulation(): void {
    if (stopped || !simPaused || entryStage.value !== 'game') {
      return
    }
    simPaused = false

    // Re-anchor the live clock at now: the next tick sees a ~interval
    // delta (tickDeltaOnResume <= normalTickDelta), the paused window is
    // gone for good.
    clock.start()
    gameManager.resumeCombat('authority-pause')

    if (onTick) {
      startTickLoop(onTick)
    }
    startAutosave()
  }

  // --- Persistence ---

  async function persistProgress(): Promise<void> {
    // `stopped` CO Y khong nam trong gate nay: moi caller do listener/interval
    // dieu khien da bi stopAll() go (visibilitychange/pagehide off, autosave
    // cleared), nen khong con stale caller nao toi duoc day. Caller duy nhat
    // con lai sau stopAll la flush TAN CUNG chu dich trong App.vue's
    // onUnmounted - va no BAT BUOC phai chay: Vue goi onBeforeUnmount(stopAll)
    // TRUOC onUnmounted, neu stopped chan save thi "persist first so a
    // development reload cannot roll the player back" la dead code
    // (review round 1 - ARCH-013/L04).
    if (persistenceSuppressed || entryStage.value !== 'game' || saveInFlight || !authority.canMutate()) {
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

    // B1-D - boot admission opens here: 'ready' is only reached after
    // auth/session/compatibility/load/pending/restore/durability all pass
    // (the durability leg is the post-accrual commit below).
    authority.beginChecking()

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

      const remoteAuthoritative = coordinator.capability === 'remote-authoritative'

      // ARCH-013 fence re-checked BEFORE the load: the local load path
      // has side effects (it consumes the one-shot import-handoff marker
      // even on a byte mismatch), so a boot made stale must not pay for
      // a disposed lifecycle.
      if (bootGeneration !== lifecycleGeneration) {
        return { status: 'skipped' }
      }

      // Local mode keeps the synthetic empty shortcut for new characters
      // (deleteSave already cleared the slot; there is no row to read).
      // Remote-authoritative mode always performs the authoritative
      // load: after create_character it returns CHARACTER_UNINITIALIZED
      // carrying the canonical metadata + server checkpoint the
      // revision-0 write requires.
      const loaded = createNewCharacter && !remoteAuthoritative
        ? (coordinator.reset(), await Promise.resolve({ status: 'empty' as const, revision: 0 as const }))
        : await coordinator.load()

      // ARCH-013/L04 generation fence - spans EVERY status branch below:
      // 'ok' would restore/start/enter, but the failure branches are route
      // transitions too (boot.fail -> 'error', requireCharacter ->
      // 'character'), and onError/saveIssue.report write UI state into a
      // possibly-unmounted App. New awaits added here must re-check this
      // same generation.
      if (bootGeneration !== lifecycleGeneration) {
        return { status: 'skipped' }
      }

      if (loaded.status === 'unavailable') {
        authority.markFailed(loaded.code)
        onError(loaded.message)
        boot.fail()
        return { status: 'failed' }
      }

      if (loaded.status === 'deleted') {
        // Terminal remote state (B1.10) - the character row is
        // soft-deleted; no in-client recovery path exists, so this
        // surfaces as a plain boot failure, not the recovery surface.
        authority.markFailed('recovery')
        onError(i18n.global.t('save.characterDeleted'))
        boot.fail()
        return { status: 'failed' }
      }

      if (loaded.status === 'incompatible' || loaded.status === 'corrupted') {
        authority.markFailed('recovery')
        saveIssue.report(
          loaded.status,
          'raw' in loaded && typeof loaded.raw === 'string' ? loaded.raw : '',
          loaded.status === 'incompatible' && 'foundVersion' in loaded ? loaded.foundVersion : undefined,
        )
        boot.fail()
        return { status: 'failed' }
      }

      if (loaded.status === 'pending-conflict' || loaded.status === 'pending-quarantined') {
        // B1-C - a durable pending mutation could not resolve forward:
        // genuine CAS divergence (record retained in the journal) or a
        // corrupt/uncommittable record (parked in quarantine). The
        // pending payload bytes route through the same export/delete
        // recovery surface as a corrupted save; deleteSave drops the
        // envelope keys so a resolved pending never wedges the next boot.
        authority.markFailed('recovery')
        saveIssue.report('corrupted', loaded.pendingRaw)
        boot.fail()
        return { status: 'failed' }
      }

      if (loaded.status === 'empty' && !createNewCharacter) {
        boot.requireCharacter()
        return { status: 'require-character' }
      }

      boot.startInitializing()

      if (loaded.status === 'ok') {
        // B1-D cold boot: the SERVER-authorized window bounds every
        // offline-accrual owner - progression_cutoff_at -> serverNowUtc
        // from the load row; a missing cutoff (pre-checkpoint saves)
        // degrades to the payload's own lastSavedAt marker under the
        // same server 'until' bound. Never the editable client clock.
        const timeAuthority: RestoreTimeAuthority | undefined =
          remoteAuthoritative && loaded.serverAuthority
            ? {
                kind: 'cold-boot',
                sinceMs:
                  loaded.serverAuthority.cutoffMs
                  ?? loaded.save.player.lastSavedAt
                  ?? loaded.serverAuthority.serverNowMs,
                untilMs: loaded.serverAuthority.serverNowMs,
              }
            : undefined

        const restored = restoreGameSession(player, gameManager, loaded.save, timeAuthority)

        if (restored.status === 'rejected') {
          // A save the boot path cannot consume must reach a recovery
          // surface (export/delete) like incompatible/corrupted; routing
          // 'rejected' to onError leaves the offending save wedged on
          // every subsequent boot (QA F-INT-01). The precise rejection
          // reason stays in the diagnostics channel; the recovery
          // surface deliberately shows a generic corrupted state.
          authority.markFailed('recovery')
          console.warn('[boot] save rejected by restore preflight:', restored.message)
          saveIssue.report('corrupted', loaded.raw)
          boot.fail()
          return { status: 'failed' }
        }

        const offline = restored.offline ?? { elapsedSeconds: 0, cultivation: 0 }

        // Contract sec.H: an out-of-scope save still loads and plays -
        // the dormant records it carries are flagged with a notice, not
        // silently dropped or auto-migrated. Evaluated on the restored
        // state, once per load.
        const unsupportedReason = unsupportedReleaseReason(
          player.$state as PlayerData,
          {
            alchemyJobs: loaded.save.alchemyJobs,
            decompose: loaded.save.decompose,
          },
        )
        if (unsupportedReason !== null) {
          unsupportedSaveNotice?.(unsupportedReason)
        }

        // Beta Phase 4 (muc XIV) - chi hien modal neu offline du dai
        // (>60s, tranh phien khi refresh nhanh).
        if (offline.elapsedSeconds > 60) {
          offlineSummary.show({
            elapsedSeconds: offline.elapsedSeconds,
            cultivation: offline.cultivation,
          })
        }

        onRestoreOk?.(offline)

        // B1-D durability leg: the post-accrual snapshot + the new
        // progression cutoff must COMMIT (CAS) before any tick or spend
        // command runs. A lost write is unresolvable authority - the
        // journal keeps it retriable on the next authoritative load, but
        // this boot must surface, never tick on uncommitted accrual.
        if (remoteAuthoritative) {
          let commit: CloudSaveWriteResult

          try {
            commit = await player.save(gameManager)
          } catch (error: unknown) {
            console.error('[boot] post-accrual commit threw', error)
            commit = {
              status: 'unavailable',
              message: i18n.global.t('panels.settings.notifications.saveFailed'),
              retryable: true,
            }
          }

          if (bootGeneration !== lifecycleGeneration) {
            return { status: 'skipped' }
          }

          authority.observeSaveResult(commit)

          if (commit.status !== 'ok') {
            recordSaveOutcome(commit, 'boot-commit')
            onError(
              commit.status === 'conflict'
                ? i18n.global.t('save.conflict')
                : commit.message,
            )
            boot.fail()
            return { status: 'failed' }
          }
        }
      } else {
        // Dirty-transaction guard, checked for EVERY grant-path entry -
        // not only createNewCharacter: remote CHARACTER_UNINITIALIZED
        // reaches this branch on a plain boot(false) retry too (the row
        // still has no save). Re-running grants over the partially or
        // fully granted managers would duplicate buildings/materials and
        // commit the doubled state, so a repeat resolves to a reload.
        if (newCharacterGrantsApplied) {
          deps.hardReset()
          return { status: 'skipped' }
        }

        // Mark the transaction dirty BEFORE the callback runs
        // (Mission B audit): the callback drives non-idempotent grants
        // across several mutable authorities. A mid-grant throw leaves a
        // partially-mutated runtime - the flag must already be set so any
        // later retry takes the dirty-transaction branch (hardReset)
        // instead of re-running grants on top of the partial state.
        newCharacterGrantsApplied = true

        try {
          // Remote CHARACTER_UNINITIALIZED hands the canonical server
          // metadata down so exactly one starter snapshot is rebuilt -
          // never a reroll (B1.4). Local/mock creation paths carry no
          // metadata; App falls back to the pending creation payload.
          // Await even though the signature permits void: an async
          // rejection must land in this same catch.
          await onNewCharacter?.(loaded.status === 'uninitialized' ? loaded.character : undefined)
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

        // Audit T1-8 fix - the first durable save is INSIDE the boot
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
          authority.observeSaveResult(firstSave)
          recordSaveOutcome(firstSave, 'boot-first-save')
          onError(
            firstSave.status === 'conflict'
              ? i18n.global.t('save.conflict')
              : firstSave.message,
          )
          boot.fail()
          return { status: 'failed' }
        }
      }

      // B1-D - admission granted only now: heartbeat arms, the health
      // lease starts, and the mutation gate opens for the clock below.
      authority.markReady()

      clock.start()

      // Fix (2026-09-06) - bootGame() TU start tick loop thay vi nho
      // caller nho goi startTickLoop() sau khi boot xong. Day chinh la
      // loi goi tung bi rot khi Task 5 extract inline boot logic cua
      // App.vue sang composable nay (commit d6d9a1d) - ket qua:
      // GameManager.update() khong bao gio chay trong browser that, toan
      // bo game (combat/tu luyen/san xuat...) dung hinh vo thoi han du
      // 2651 unit test van xanh (test goi thang gameManager.tickOps.update(), bo
      // qua dung lop wiring nay). Gop vao bootGame() - noi da so huu
      // clock.start()/startAutosave() - de "extract composable, quen
      // rewire" khong con kha nang lap lai duoc nua.
      startTickLoop(tick)
      boot.enterGame()

      return { status: 'entered' }
    } finally {
      // Reset guard KE CA khi fail - boot lai (auth retry) van chay duoc.
      bootInFlight = false
    }
  }

  /** Reset-save flow: chan autosave/save flush truoc khi xoa save + reload. */
  function suppressPersistence(): void {
    persistenceSuppressed = true
    stopAll()
  }

  function isPersistenceSuppressed(): boolean {
    return persistenceSuppressed
  }

  // --- Essence stream state (tick doc qua getters, khong giu state local) ---

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
   * Teardown TERMINAL: go moi listener + interval VA vo hieu moi async
   * continuation con pending (boot generation bump - ARCH-013/L04). Sau
   * stopAll khong con boot/timer/listener moi duoc dang ky: composable
   * nay thuoc 1 mount, mount moi dung instance moi. persistProgress() van
   * duoc phep - caller post-stop duy nhat la flush tan cung trong App.vue's
   * onUnmounted (beforeUnmount da go moi listener-driven caller). Idempotent
   * - goi nhieu lan an toan (guard `stopped` cho unsubscribe; clearHandle
   * chi chay khi handle con ton tai; generation cu bump - inequality la du).
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

  /** Hook Vue - tu teardown khi component unmount (HMR/reload an toan). */
  onBeforeUnmount(stopAll)

  return {
    startTickLoop,
    startAutosave,
    persistProgress,
    bootGame,
    /** B1-D - reversible authority pause/resume (the
     *  OnlineSessionController drives these); idempotent. */
    pauseSimulation,
    resumeSimulation,
    isSimPaused: () => simPaused,
    stopAll,
    suppressPersistence,
    isPersistenceSuppressed,
    consumeEssenceArrival,
    isEssenceHeadlessTimedOut,
    clearEssenceEmitted,
    /** Test/mount-tracing - handle hien hanh (undefined = khong interval). */
    getTickHandle: () => tickHandle,
    getAutosaveHandle: () => autosaveHandle,
  }
}
