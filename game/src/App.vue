<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { usePlayerStore } from './stores/player'
import { useUiStore } from './stores/ui'
import { GameClock, DEFAULT_MAX_OFFLINE_SECONDS } from './core/idle/GameClock'
import { OVERLAY_LAYERS } from './core/presentation/OverlayLayers'
import { bindOnlineAuthority, observeAuthoritySaveResult, unbindOnlineAuthority } from './composables/useOnlineAuthority'
import { bindSessionTeardown, unbindSessionTeardown } from './composables/useSessionAccount'
import { GameManager } from './core/game/GameManager'
import {
  initializeCharacter,
  initializationMetadataFromRemote,
  type CharacterInitializationMetadata,
} from './services/character/initializeCharacter'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from './composables/useGameState'
import {
  PHASER_SCENE_ADAPTER_KEY,
  ASSET_BUNDLE_MANAGER_KEY,
  VUE_ROUTE_ADAPTER_KEY,
  GAME_PRESENTATION_KEY,
  type CurtainPort,
  type DeadlineScheduler,
} from './presentation/PresentationContracts'
import { PhaserSceneAdapter } from './presentation/PhaserSceneAdapter'
import { AssetBundleManager } from './presentation/assets/AssetBundleManager'
import { CompositeRenderer, createVueRouteAdapter } from './presentation/VueRouteAdapter'
import { GamePresentationCoordinator } from './presentation/GamePresentationCoordinator'
import { createGamePresentation } from './presentation/createGamePresentation'
import { bindPresentationActive } from './presentation/bindPresentationActive'
import { bindCombatAudio } from './presentation/audio/combatAudioBinding'
import { bindUiAudio } from './presentation/audio/uiAudioBinding'
import { bindAmbientAudio } from './presentation/audio/ambientAudioDriver'
import { AudioManager } from './core/audio/AudioManager'
import { setReducedShakeEnabled } from './presentation/vfx/screenShakePolicy'
import { useAudioStore } from './stores/audio'
import { RafClockSource } from './presentation/clock/RafClockSource'
import { MainProcessClockSource } from './presentation/clock/MainProcessClockSource'
import { checkTribulationOutcomeAction } from './composables/useTribulation'
import { isBattleInProgress } from './core/battle/BattleTypes'
import { registerEnemySpawnDebug } from './core/dev/enemySpawnDebug'
import { useBreakthrough } from './composables/useBreakthrough'
import { useElectronBridge } from './composables/useElectronBridge'
import { bindUpdateSurface, unbindUpdateSurface, useUpdates } from './composables/useUpdates'
import { useCombatPause } from './composables/useCombatPause'
import { useNotificationStore } from './stores/notification'
import { useI18n } from 'vue-i18n'
import { useOfflineSummaryStore } from './stores/offlineSummary'
import { useSaveIssueStore } from './stores/saveIssue'
import { installAutomationFlagsPersistence } from './stores/uiFlagsPersistence'
import { useAppLifecycle, type BootOutcome } from './composables/useAppLifecycle'
import { hasResumeCandidate, markResetNotice } from './composables/resumeSession'
import { accountIdForSession, setSaveAccountId, resolveSaveKey } from './services/save/saveKeys'
import {
  getDiagnosticRecorder,
  recordDiagnostic,
} from './services/diagnostics/DiagnosticRecorder'
import { recordSaveOutcome } from './services/diagnostics/recordSaveOutcome'
import type { AuthSession } from './services/auth/AuthService'
import GameRoot from './components/layout/GameRoot.vue'
import RouteMount from './components/game/RouteMount.vue'
import PresentationTransitionOverlay from './components/game/PresentationTransitionOverlay.vue'
import CombatPauseOverlay from './components/game/combat/CombatPauseOverlay.vue'
import LoadingScreen from './components/common/LoadingScreen.vue'
import ErrorBoundary from './components/common/ErrorBoundary.vue'
import ErrorScreen from './components/common/ErrorScreen.vue'
import UpdateBanner from './components/common/UpdateBanner.vue'
import SaveIncompatibleScreen from './components/common/SaveIncompatibleScreen.vue'
import AuthEntryScreen from './components/onboarding/AuthEntryScreen.vue'
import CharacterCreationScreen, {
  type CharacterCreationPayload,
} from './components/onboarding/CharacterCreationScreen.vue'

import { materials } from './data/materials/materials'
import { SKILLS } from './data/skill/Skills'
import { TECHNIQUES } from './data/technique/Techniques'
import { ENEMIES } from './data/enemy/Enemies'
import { STAGES } from './data/stage/Stages'
import { zones } from './data/stage/Zones'
import { equipment } from './data/equipment/equipment'
import { affixes } from './data/equipment/affixes'
import { pills } from './data/pill/pills'
import { talismans } from './data/talisman/talismans'
import { buffs } from './data/buff/buffs'
import { formations } from './data/formation/formations'
import { alchemyRecipes } from './data/alchemy/alchemyRecipes'
import { buildings } from './data/building/buildings'
import { ALL_PROGRESSION_NODES } from './data/progression/ProgressionNodeCatalog'
import { QUESTS } from './data/quest/quests'
import { isCultivationPoseActive } from './core/cultivation/CultivationPose'
import { useBootFlow } from './composables/useBootFlow'
import { cloudSaveCoordinator } from './services/cloudSave/CloudSaveServiceFactory'
import { backendBundle, backendComposition, backendFatal } from './services/backend/backendBundle'
import {
  deleteSave,
  restoreGameSession,
  SAVE_RESET_REQUEST_EVENT,
} from './services/save/SaveSystem'
import {
  OnlineSessionController,
  type AuthorityState,
} from './services/session/OnlineSessionController'
import { runReconnectPipeline } from './services/session/reconnectPipeline'
import {
  readSupabaseSession,
  resolveSupabaseSession,
} from './services/supabase/SupabaseSession'
import type { QuitFlushFailedNotice } from './shared/session/FlushResult'
import {
  bindFeedbackProviders,
  bindFeedbackService,
  unbindFeedbackProviders,
  unbindFeedbackService,
} from './services/feedback/FeedbackService'

const player = usePlayerStore()
const ui = useUiStore()

// Automation flags persistence (2026-08-26, uiFlagsPersistence.ts) -
// $subscribe bat MOI duong mutation (ke ca gan truc tiep
// `ui.battleRunMode = ...` trong CombatVictoryPanel/StageSelectPanel),
// ghi snapshot vao localStorage. Ghi re (JSON nho), skip khi snapshot
// khong doi de tranh ghi lap vo nghia moi tick.
// (2026-08-30) isAutoConsumeTinhHoa da GO - Luyen The tu dau tu qua
// essence stream; chi con battleRunMode + combatInputMode.
// Mission A4 - dirty check theo composite battleRunMode|combatInputMode
// trong installAutomationFlagsPersistence: thay doi chi moi
// combatInputMode van phai ghi. Giu disposer de Mission B6 gan
// unmount cleanup.
const automationFlagsUnsubscribe = installAutomationFlagsPersistence(ui)
const notification = useNotificationStore()
const { t } = useI18n()
const offlineSummary = useOfflineSummaryStore()
const saveIssue = useSaveIssueStore()

// Beta Phase 4 (Boot Loading Screen) - Boot -> Load Save -> Initialize ->
// Home. Set true o cuoi onMounted() sau khi moi thu (load save/dang
// ky data/tick loop) da san sang.
const isBooted = ref(false)
// GameClock chi do thoi gian (pure clock). GameManager chi dieu
// phoi cac system. Viec "moi giay thi lam gi" la trach nhiem cua
// vong lap tick() duoi day - noi duy nhat biet ca 2 ben.
const clock = new GameClock()
const gameManager = new GameManager()

// Real app renders: every combat/tribulation session starts HELD and only
// ticks after the coordinator has revealed it (READY -> attach -> curtain
// open -> release). Headless instances (tests/tools) stay unheld.
gameManager.setPresentationMode('interactive')

// Combat counts on its OWN clock, not on the 1 Hz world interval below.
// The world tick would deliver a three-second countdown to Phaser as three
// bursts of ten 0.1s steps inside one frame; on the render cadence the same
// countdown arrives one step at a time, in step with what is drawn.
//
// Task 7: under Electron, window.electronAPI.combatClock is the main-process
// host (immune to Chromium's rAF throttling) - prefer it when present. Plain
// web builds have no window.electronAPI and keep the RAF-driven fallback.
// The engine only ever sees the ClockSource interface either way.
const combatClockSource = window.electronAPI
  ? new MainProcessClockSource(window.electronAPI.combatClock)
  : new RafClockSource()
gameManager.setCombatClockSource(combatClockSource)

// ARCH-013/L04 - the Electron bridge subscriptions are an owned resource:
// ipcRenderer.on handlers have no auto-dispose, so unmount must call the
// disposer useElectronBridge returns or a remount/HMR would stack a second
// quit-flush save. Disposed again before each re-subscribe (entered twice).
let electronBridgeDispose: (() => void) | undefined

// Presentation coordinator & adapters (Task 5-12, AGENTS.md P17)
const phaserSceneAdapter = new PhaserSceneAdapter()
const assetBundleManager = new AssetBundleManager()
const compositeRenderer = new CompositeRenderer(phaserSceneAdapter)

// The overlay IS the curtain. Before it was mounted the coordinator held a
// no-op stub, so nothing ever covered the screen during a scene swap and the
// close/open deadlines measured nothing.
const transitionOverlayRef = ref<{
  close: (id: number, signal: AbortSignal) => Promise<void>
  open: (id: number, signal: AbortSignal) => Promise<void>
} | null>(null)

const curtainPort: CurtainPort = {
  close: async (id, signal) => {
    await transitionOverlayRef.value?.close(id, signal)
  },
  open: async (id, signal) => {
    await transitionOverlayRef.value?.open(id, signal)
  },
}
// E2E contention relief (R12 retained debt): parallel Playwright workers
// each own a WebGL context, so a transition phase can legitimately outlast
// the wall-clock deadlines under load. playwright.config sets
// VITE_PRESENTATION_DEADLINE_SCALE on the dev server; unset/1 keeps
// production timing untouched.
const deadlineScale = Number(import.meta.env.VITE_PRESENTATION_DEADLINE_SCALE ?? 1)
const deadlineScheduler: DeadlineScheduler | undefined =
  deadlineScale > 1
    ? {
        set: (callback, ms) => setTimeout(callback, ms * deadlineScale),
        clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      }
    : undefined

const coordinator = new GamePresentationCoordinator({
  sessionPort: gameManager.getPresentationPort(),
  renderer: compositeRenderer,
  curtain: curtainPort,
  assets: assetBundleManager,
  scheduler: deadlineScheduler,
  initialRoute: 'boot',
  initialBootSubphase: 'intro',
})
const presentation = createGamePresentation({
  coordinator,
  eventBus: gameManager.eventBus,
  getCurrentSession: () => gameManager.getCurrentPresentationSession(),
})
const routeAdapter = createVueRouteAdapter(coordinator, compositeRenderer)

// RC-3: presentationActive has exactly ONE owner - the coordinator, via this
// binding. It is true only while the COMMITTED route is combat and the
// combat session is attached. CombatScene must never assert this for
// itself (self-report is the pattern the coordinator design rejected).
const unbindPresentationActive = bindPresentationActive(coordinator, gameManager)

// Audio: domain combat events -> SFX (observation only, A7). Bound at module
// scope next to the other event-bus bindings; store handles enabled/volume.
// routeProvider lets the binding suppress off-route cues (farm.cycle).
const unbindCombatAudio = bindCombatAudio(gameManager.eventBus, {
  routeProvider: () => coordinator.getSnapshot().currentRoute,
})

// W10: push the reducedShake flag into the presentation shake gate - scenes
// read the module-level scale (src/game may not import stores).
const audioStore = useAudioStore()
// Persisted enabled=false must gate every activation path before the
// first gesture (GameButton unlocks the manager directly).
audioStore.hydrateManager()

// W7: uiStore panel/wheel transitions -> ui.panel.*/ui.wheel.* cues.
const unbindUiAudio = bindUiAudio(ui)

// W8: committed route -> music slot crossfade (silent until real assets);
// W4: same route drives the lazy audio-* bundle fetch (unlock+enabled gated).
const unbindAmbientAudio = bindAmbientAudio(coordinator, audioStore, assetBundleManager)

watch(
  () => audioStore.reducedShake,
  (value) => setReducedShakeEnabled(value),
  { immediate: true },
)

// Autoplay policy: unlock AudioContext on the first pointer gesture anywhere
// (Phaser canvas clicks never reach GameButton). keydown is armed too -
// keyboard-only activation fires click, not pointerdown, so keyboard
// users on non-primitive surfaces would never hydrate+unlock. Not
// `once`: a transiently failed unlock (Tone.start() rejects) must leave
// the listener armed so a later gesture still retries. The listener is
// disarmed when the chain reports ready; a mount with the chain already
// ready skips arming at all (onReady would fire synchronously before any
// disarm handle exists).
const unlockAudioOnFirstGesture = () => useAudioStore().unlock()
const audioManager = AudioManager.getInstance()
const disarmAudioUnlockListeners = () => {
  window.removeEventListener('pointerdown', unlockAudioOnFirstGesture)
  window.removeEventListener('keydown', unlockAudioOnFirstGesture)
}
let disarmAudioUnlock: (() => void) | undefined
if (!audioManager.isUnlocked()) {
  window.addEventListener('pointerdown', unlockAudioOnFirstGesture)
  window.addEventListener('keydown', unlockAudioOnFirstGesture)
  // onReady would fire synchronously when already unlocked, so the
  // isUnlocked gate above is what keeps the listener unarmed on remount.
  // Keep the unregister handle: if unlock never succeeds the callback
  // would otherwise leak on the module singleton across remounts.
  disarmAudioUnlock = audioManager.onReady(disarmAudioUnlockListeners)
}

provide(PHASER_SCENE_ADAPTER_KEY, phaserSceneAdapter)
provide(ASSET_BUNDLE_MANAGER_KEY, assetBundleManager)
provide(VUE_ROUTE_ADAPTER_KEY, routeAdapter)
provide(GAME_PRESENTATION_KEY, presentation)

// A failed tribulation transition with a breakthrough ALREADY in progress
// offers RETRY ONLY: there is no domain cancel-tribulation command, and
// inventing a penalty-free way home would silently rewrite the outcome of a
// breakthrough already in progress. That only applies once a tribulation
// session actually exists, though - a behindCurtain tribulation request that
// failed before ever producing one (the domain declined at the door; see
// GamePresentationCoordinator's Task 2 closed-curtain window) has no
// breakthrough to protect, so Back is safe there. Kind-scoped so a lingering
// combat session can never be misread as an active tribulation (same
// footgun useTribulation.ts's kind-scoped read guards against).
function hasActiveTribulationToProtect(): boolean {
  return gameManager.getCurrentPresentationSession('tribulation') !== null
}

const canRecoverToHome = computed(() => {
  const failedTarget = routeAdapter.error.value?.failedRequest.target
  return failedTarget !== 'tribulation' || !hasActiveTribulationToProtect()
})

function onTransitionRetry() {
  void presentation.coordinator.retry()
}

function onTransitionBack() {
  const failed = routeAdapter.error.value?.failedRequest

  if (!failed || (failed.target === 'tribulation' && hasActiveTribulationToProtect())) {
    return
  }

  // Pre-boot there is no game tree to return to: GameRoot - and the
  // home/combat/tribulation mount witness inside it - only mounts once
  // isBooted flips. Requesting 'home' here would await-ready a witness that
  // cannot exist and replay the same readiness timeout. "Back" before boot
  // means returning to the auth screen, the same escape the boot-error
  // branch offers; requesting the already-current route is always admissible.
  if (!isBooted.value) {
    void coordinator.request({ target: 'auth' })
    return
  }

  // Returning home from a failed combat entry goes through the domain owner
  // first - the battle must be abandoned, not merely hidden. The teardown
  // runs inside the closed-curtain window so the error shell stays mounted -
  // and nothing else changes - until the curtain has fully covered the
  // previous screen. The error itself is dismissed by the coordinator at the
  // 'loading' step: dropping it any earlier removes the failedRequest pin
  // that keeps the game stage mounted through 'closing'.
  const abandonFailedCombat = failed.target === 'combat'

  void coordinator.request({
    target: 'home',
    behindCurtain: () => {
      if (abandonFailedCombat) {
        gameManager.abandonBattle()
      }

      return true
    },
  })
}

const bootFlow = useBootFlow(coordinator, routeAdapter)
const entryStage = bootFlow.stage
const bootError = ref('')
let introHandle: number | undefined

// BETA-FINAL PR11 / spec B8 - late-bind the diagnostic context now that the
// coordinator and save coordinator exist: every recorded event then carries
// the committed route, the coarse save revision, and one per-boot
// correlation id. The stable report id arrives async from main (Electron);
// the recorder's fallback id serves until it resolves (and forever on web).
const diagnosticsRecorder = getDiagnosticRecorder()
diagnosticsRecorder?.bindContext({
  routeProvider: () => coordinator.getSnapshot().currentRoute,
  revisionProvider: () => cloudSaveCoordinator.getRevision(),
  saveHashProvider: cachedSaveHash,
  correlationId: crypto.randomUUID(),
})
if (window.electronAPI?.getDiagnosticReportId) {
  void window.electronAPI
    .getDiagnosticReportId()
    .then((id) => diagnosticsRecorder?.bindContext({ reportId: id }))
    .catch(() => undefined)
}

// BETA-FINAL PR13 / spec B7 - bind the feedback intake to the bundle's
// service (supabase adapter or the honest local stand-in) and late-bind the
// same coarse context the diagnostics ring carries: committed route + live
// save revision. The server re-derives owner/session/build/revision itself;
// these providers only fill the client-side context fields.
bindFeedbackService(backendBundle.feedbackService)
bindFeedbackProviders({
  route: () => coordinator.getSnapshot().currentRoute,
  saveRevision: () => cloudSaveCoordinator.getRevision(),
})

/** SHA-256 (truncated) of the cached raw save - the manifest's coarse
 *  corruption signal. Never the save bytes themselves. */
async function cachedSaveHash(): Promise<string | undefined> {
  try {
    const raw = localStorage.getItem(resolveSaveKey())
    if (raw === null || raw === '') return undefined
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
  } catch {
    return undefined
  }
}

gameManager.catalogOps.registerMaterials(materials)
gameManager.catalogOps.registerSkillTemplates(SKILLS)
gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
gameManager.catalogOps.registerStages(STAGES)
gameManager.catalogOps.registerZones(zones)
gameManager.catalogOps.registerEquipment(equipment)
gameManager.catalogOps.registerAffixes(affixes)
gameManager.catalogOps.registerPills(pills)
// Buffs are NOT the legacy Phu/Tran types - the turn engine resolves
// 'buff'/'debuff' effects via buffRegistry.get() (THROWS on miss);
// dropping this line leaves the registry empty and crashes mid-battle
// (review fix 2026-08-26).
// Skill buff-carrying Kiem Tu cu da chuyen node (spec 2026-08-29),
// registry van can cho buff he khac (Tho Giap/Do Kiep...).
gameManager.catalogOps.registerBuffs(buffs)
gameManager.catalogOps.registerTalismans(talismans)
gameManager.catalogOps.registerFormations(formations)
gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
gameManager.catalogOps.registerBuildings(buildings)
// One source: the catalog union drives both runtime registration and
// saveShapeValidation - hand-enumerating the arrays here would drift.
gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
gameManager.catalogOps.registerQuests(QUESTS)

const { breakthrough } = useBreakthrough(gameManager)

// Task 8 (A11, spec sec.6.1) - an unwatched battle pauses visibly and resumes
// only on Continue; returning to the tab is not consent to resume. Gated on
// getCombatClockState() !== 'stopped' so the overlay never appears outside
// combat (no battle mounted == nothing to pause).
const { isPaused: isCombatPaused, continueBattle, dispose: disposeCombatPause } = useCombatPause(
  gameManager,
  { isCombatActive: () => gameManager.getCombatClockState() !== 'stopped' },
)

// Cau noi reactivity chung cho cac panel doc bag/equipment - xem
// composables/useGameState.ts. tick() tu tang moi giay; cac action
// mutate GameManager tu panel (equip/craft/enhance...) goi bumpState()
// ngay sau do de UI phan hoi tuc thoi, khong cho tick ke tiep.
const stateVersion = ref(0)

function bumpState() {
  stateVersion.value++
}

provide(GAME_MANAGER_KEY, gameManager)
provide(STATE_VERSION_KEY, stateVersion)
provide(BUMP_STATE_KEY, bumpState)

// Remediation Task 5 (2026-09-05) - lifecycle idempotence extract sang
// useAppLifecycle.ts (tick/autosave interval guard, bootInFlight guard,
// symmetric event-bus/DOM listener cleanup). App.vue giu phan tick co
// phu thuoc UI (cultivate/bumpState/notification dedupe).
const lifecycle = useAppLifecycle({
  clock,
  scheduleInterval: (callback, timeoutMs) => window.setInterval(callback, timeoutMs),
  clearHandle: (handle) => window.clearInterval(handle),
  addEventListener: (type, handler) => {
    if (type === 'visibilitychange') {
      document.addEventListener(type, handler as EventListener)
    } else {
      window.addEventListener(type, handler as EventListener)
    }
  },
  removeEventListener: (type, handler) => {
    if (type === 'visibilitychange') {
      document.removeEventListener(type, handler as EventListener)
    } else {
      window.removeEventListener(type, handler as EventListener)
    }
  },
  boot: bootFlow,
  coordinator: cloudSaveCoordinator,
  // B1-D - thin closures over the authority instance declared below: the
  // lifecycle runs them only inside bootGame/tick calls, by which time
  // the const is initialized (TDZ is a call-time concern, not a
  // construction-order one).
  authority: {
    canMutate: () => onlineAuthority.canMutate(),
    beginChecking: () => onlineAuthority.beginChecking(),
    markReady: () => onlineAuthority.markReady(),
    markFailed: (code) => onlineAuthority.markFailed(code),
    observeSaveResult: (result) => onlineAuthority.observeSaveResult(result),
  },
  player,
  gameManager,
  // Fix (2026-09-06) - bootGame() tu startTickLoop(tick) khi boot thanh
  // cong (xem useAppLifecycle.ts). `tick` la function declaration nen da
  // hoisted, tham chieu duoc o day du dinh nghia vat ly nam sau (duoi).
  tick,
  offlineSummary,
  saveIssue,
  entryStage,
  // Composable giu player dang loose (khong import Pinia store type vao
  // core-facing signature) - cast TAI BIEN nay khop dung loai that.
  restoreGameSession: (playerOwner, manager, save, timeAuthority) =>
    restoreGameSession(
      playerOwner as Parameters<typeof restoreGameSession>[0],
      manager,
      save as Parameters<typeof restoreGameSession>[2],
      timeAuthority,
    ),
  persistPlayer: async () => {
    const result = await player.save(gameManager)

    // B1-D - every save outcome renews the health lease or pauses/
    // terminates admission by its error class.
    observeAuthoritySaveResult(result)

    // B8 - non-ok save outcomes are diagnostic events (never save bytes).
    recordSaveOutcome(result, 'autosave')

    // Canh bao autosave fail chi 1 lan cho moi chuoi fail - reset co khi
    // ghi thanh cong lai de chuoi fail ke tiep van duoc bao.
    if (result.status !== 'ok' && !saveFailureNotified) {
      saveFailureNotified = true
      notification.push('error', t('notifications.autosaveFailed'))
      console.warn('[autosave] progress was not saved', result)
    } else if (result.status === 'ok') {
      saveFailureNotified = false
    }

    return result
  },
  onError: (message) => {
    bootError.value = message
    recordDiagnostic({
      source: 'renderer',
      severity: 'error',
      category: 'lifecycle',
      code: 'BOOT_FAILED',
      message,
    })
  },
  // B2 - a retried character creation after a failed first save cannot
  // roll its starter grants back in memory; the composable calls this to
  // recover on a clean process (same convention as resetSaveFromSettings).
  hardReset: () => window.location.reload(),
})

// B1-D - the online-admission authority (30s heartbeat / <=40s health
// lease / spec-ordered reconnect / result-bearing flush). In remote mode
// probe+reconnect are bound to the supabase adapter and GoTrue refresh;
// in local/mock mode the gate is uniform but the lease is unbounded.
const authorityState = ref<AuthorityState>('signed-out')
const quitFlushOffer = ref<QuitFlushFailedNotice | null>(null)
const remoteAuthority = cloudSaveCoordinator.capability === 'remote-authoritative'
const supabaseConfig =
  backendComposition.status === 'ready' ? backendComposition.config : null

const onlineAuthority = bindOnlineAuthority(new OnlineSessionController({
  probe: remoteAuthority ? () => cloudSaveCoordinator.heartbeat() : undefined,
  reconnect:
    remoteAuthority && supabaseConfig
      ? () =>
          runReconnectPipeline({
            refreshAuth: async () => {
              const resolved = await resolveSupabaseSession(supabaseConfig)
              if (resolved) {
                return 'ok'
              }
              // The credential's presence distinguishes a transient
              // transport failure (retained - retry later) from a proven
              // terminal rejection (cleared inside resolveSupabaseSession).
              return readSupabaseSession() ? 'unavailable' : 'expired'
            },
            heartbeat: () => cloudSaveCoordinator.heartbeat(),
            load: () => cloudSaveCoordinator.load(),
            expectedRevision: () => cloudSaveCoordinator.getRevision(),
          })
      : undefined,
  // The ONE save queue: quit/logout/flush join the same queue a manual
  // or autosave does - there is never a second write path.
  flushSave: () => player.save(gameManager),
  monotonicNow: () => performance.now(),
  scheduleInterval: (callback, timeoutMs) => window.setInterval(callback, timeoutMs),
  clearHandle: (handle) => window.clearInterval(handle),
  onPause: (reason) => {
    recordDiagnostic({
      source: 'renderer',
      severity: 'warning',
      category: 'session',
      code: 'AUTH_PAUSED',
      message: `authority paused (${reason})`,
      details: { reason },
    })
    lifecycle.pauseSimulation()
  },
  onResume: (lineage, save, serverAuthority) => {
    recordDiagnostic({
      source: 'renderer',
      severity: 'info',
      category: 'session',
      code: 'AUTH_RESUMED',
      message: `authority resumed (${lineage})`,
      details: { lineage },
    })
    if (lineage === 'replaced' && save) {
      // Zero-accrual live replacement (B1-D): queues/jobs restore from
      // the authoritative payload with the reconnect's server clock bound
      // as 'now' - no offline catch-up is owed (the sim stayed admitted
      // or was paused; nothing accrued).
      restoreGameSession(player, gameManager, save, {
        kind: 'live-replacement',
        nowMs: serverAuthority?.serverNowMs ?? Date.now(),
      })
    }
    lifecycle.resumeSimulation()
  },
  onStateChange: (state) => {
    authorityState.value = state
    recordDiagnostic({
      source: 'renderer',
      severity: AUTHORITY_TERMINAL_STATES.has(state) ? 'error' : 'info',
      category: 'session',
      code: `AUTH_${state.toUpperCase().replace(/-/g, '_')}`,
      message: `authority state: ${state}`,
      details: { state },
    })
  },
}))

// BETA-FINAL PR12 / spec B6 - the ONE update surface: the sanitized
// UpdateState projection plus the prepare-install handshake. Install
// admission pauses the SIMULATION (authority.pause would bump the
// generation and self-sabotage the request-time equality fence), drains
// the ONE save queue through the same result-bearing flush, and installs
// only on 'saved' - a failure keeps the candidate parked, never installs.
const updateSurface = bindUpdateSurface(
  useUpdates(
    {
      flush: (requestId) => onlineAuthority.flush(requestId),
      pauseAdmission: () => lifecycle.pauseSimulation(),
      resumeAdmission: () => lifecycle.resumeSimulation(),
      generation: () => onlineAuthority.currentGeneration,
    },
    gameManager,
  ),
)
const updateInstallFailed = computed(() => updateSurface?.installFailed.value ?? null)

const AUTHORITY_TERMINAL_STATES: ReadonlySet<AuthorityState> = new Set([
  'conflict',
  'revoked',
  'recovery',
  'maintenance',
  'update-required',
])

const authorityTerminal = computed(() => AUTHORITY_TERMINAL_STATES.has(authorityState.value))

// While an authority overlay is up every surface behind it is inert:
// pointer is already covered by the overlay element, and inert removes
// the keyboard path too (a stale-focused button behind the overlay would
// otherwise still fire on Enter/Tab-activation - spec: no mutation path
// may reach the domain while admission is blocked).
const authorityOverlayActive = computed(
  () => isBooted.value && (authorityState.value === 'reconnecting' || authorityTerminal.value),
)

const authorityMessage = computed(() => {
  switch (authorityState.value) {
    case 'revoked':
      return t('authority.revoked')
    case 'conflict':
      return t('authority.conflict')
    case 'maintenance':
      return t('authority.maintenance')
    case 'update-required':
      return t('authority.updateRequired')
    default:
      return t('authority.recovery')
  }
})

/** The ONLY path back to auth from a terminal authority state - the
 *  owned acknowledgement the controller requires before signing out. */
function acknowledgeAuthority() {
  onlineAuthority.acknowledge()
  bootFlow.showAuth()
}

// B1.9 - the return-to-auth teardown the session-account composable
// invokes after flush/revoke/signout/local clear. Everything a logout
// abandons here is re-bound by the next onAuthenticated: the save queue
// resets, the authority dies back to signed-out, and the mounted game
// tree unmounts before the auth card returns.
function teardownToAuth() {
  lifecycle.stopAll()
  onlineAuthority.stopAll()
  cloudSaveCoordinator.reset()
  isBooted.value = false
  bootFlow.showAuth()
}
bindSessionTeardown(teardownToAuth)

function retryQuitFlush() {
  const offer = quitFlushOffer.value
  quitFlushOffer.value = null
  if (offer) {
    window.electronAPI?.retryQuitFlush(offer.requestId)
  }
}

function cancelQuitFlush() {
  const offer = quitFlushOffer.value
  quitFlushOffer.value = null
  if (offer) {
    window.electronAPI?.cancelQuitClose(offer.requestId)
  }
}

function forceQuitFlush() {
  const offer = quitFlushOffer.value
  quitFlushOffer.value = null
  if (offer) {
    window.electronAPI?.forceQuitClose(offer.requestId)
  }
}

// Canh bao autosave fail chi 1 lan cho moi chuoi fail - autosave chay
// moi 15s nen neu toast moi tick thi spam; reset co khi ghi thanh cong
// lai de chuoi fail ke tiep van duoc bao.
let saveFailureNotified = false

function persistProgress() {
  void lifecycle.persistProgress()
}

function resetSaveFromSettings() {
  lifecycle.suppressPersistence()

  // Mission A review - deleteSave() returns false on storage failure;
  // reloading anyway would boot back into the same save the user tried
  // to delete.
  if (deleteSave()) {
    markResetNotice()
    window.location.reload()
  } else {
    notification.push('error', t('notifications.resetDeleteFailed'))
  }
}

// Cultivation <-> combat (2026-08-20) - khong con nut bam thu cong, tu
// luyen la trang thai SUY RA THANG tu isFighting moi tick (chien dau
// thi khong tu luyen, khong chien dau thi tu tu luyen). Theo doi gia
// tri isFighting cua tick TRUOC de chi emit 'cultivation_changed' dung
// luc chuyen trang thai (MainScene.ts's onCultivationChanged() doi
// pose ngoi thien) - tranh emit lap lai moi tick.
let wasFighting = false

function tick() {
  const { deltaSeconds } = clock.update()

  if (deltaSeconds <= 0) {
    return
  }

  // W9.2 (2026-08-27) - tab bi throttle/treo lau co the tra ve delta
  // rat lon trong mot tick. Clamp theo dung tran offline 24h de thoi
  // gian "duoi kip" khong vuot offline cap; combat da co tran catch-up
  // rieng trong GameManager.updateBattleFixedStep().
  const simulatedDelta = Math.min(deltaSeconds, DEFAULT_MAX_OFFLINE_SECONDS)

  if (simulatedDelta > 0) {
    // GameManager luon duoc update truoc, de battle (neu co) va
    // buff/skill cooldown luon chay dung nhip thoi gian thuc.
    gameManager.tickOps.update(simulatedDelta)

    // Beta Phase 4 (Notification/UX) - rut toast phat sinh TRONG
    // GameManager (hien chi loot, xem GameManager.grantItemDrops())
    // moi tick, day vao notificationStore de ToastContainer hien.
    for (const event of gameManager.drainNotifications()) {
      notification.push(
        event.kind,
        event.messageKey ? t(event.messageKey, event.messageParams ?? {}) : event.message,
        event.loot,
      )
    }

    // No cultivation gain while in a battle - the two are mutually
    // exclusive. Tam Bao (gather, formerly "Thu Thap") is unaffected:
    // it tracks progress via startedAt/collect() and does not depend on
    // this branch. Tu vi still increases during combat; the
    // cultivation_changed event only drives the visual pose.
    const battleBeforeAuto = gameManager.getTurnBattle()
    const isFighting = battleBeforeAuto !== null && isBattleInProgress(battleBeforeAuto.state)

    // Cultivation progresses alongside combat. Fighting only controls the
    // scene pose; it no longer suspends cultivation gains.
    if (isFighting !== wasFighting) {
      gameManager.eventBus.emit('cultivation_changed', {
        isCultivating: isCultivationPoseActive(isFighting),
      })

      wasFighting = isFighting
    }

    player.cultivate(simulatedDelta)

    // Tieu canh gioi tu tang (2026-08-28) - tick() bam breakthrough()
    // moi khi tu vi day, khong con checkbox bat/tat (dung tinh than
    // idle game + chu game quyet dinh). Dai canh gioi van qua nghi le
    // rieng (Quan Khi/Truc Co/Do Kiep), xem useTribulation.ts.
    if (player.cultivation >= player.cultivationRequired) {
      breakthrough()
    }

    // R5 (AR-14) + F7 (QA-2026-09-09-RR7): Body refinement auto-invest is
    // owned by GameManager.update() (domain authority, exactly-once per
    // tick). App must not call it again; bumpState() below refreshes the UI.

    // Dot Pha Truc Co - phan ung thang/thua Do Kiep NGAY (battle
    // Tribulation khong qua Stage/Combat Scene result modal nao ca, xem
    // useTribulation.ts's resolveVictory/resolveDefeat + World
    // Announcement - day van la luong ket qua DUY NHAT cho Tribulation).
    //
    // F1 fix (2026-09-13): `presentation` is required - without it the
    // outcome is applied but the coordinator never issues
    // request({ target: 'home' }), so the route soft-locks on
    // 'tribulation' until reload. Guarded by
    // tests/architecture/tribulationOutcomeWiring.test.ts.
    checkTribulationOutcomeAction(player, gameManager, presentation)

    // Combat UI Redesign - Auto-refight (thang/thua Stage thi tu danh
    // tiep) KHONG con chay tuc thoi o tick() nua: CombatVictoryPanel.vue
    // hien ket qua truoc, TU dem nguoc 3s roi moi goi lai startBattle()
    // (dung spec muc 15/19 - nguoi choi phai kip thay man hinh
    // Thang/Thua). Xem CombatResultModal.vue cho toan bo logic do.

    // Buff/Technique co the vua het han hoac vua duoc them trong
    // update() o tren -> dong bo lai modifier cho player moi tick.
    //
    // perf-optimize-pass Task 5: getAggregatedModifiers() van dung mang
    // MOI moi tick (signature GameManager giu nguyen), nhung
    // setExternalModifiers() nay tu dirty-check noi dung va BO QUA lan
    // gan trung - nen `finalStats` chi invalidate khi buff/technique
    // that su doi, khong con recompute 10 lan/giay. Day la ly do
    // bumpState() ben duoi CO Y giu nguyen (chay moi tick cho dong ho/
    // resource counter): stat da duoc tach han khoi stateVersion.
    player.setExternalModifiers([
      ...gameManager.effectOps.getAggregatedModifiers(player.$state),
      // ARCH-002 (M7) - the live runtime channel (timed effects, Phu/Tran
      // sockets) is part of the same modifier union the battle provider
      // serves; the menu shows what combat actually uses.
      ...gameManager.effectOps.getActiveRuntimeModifiers(player.$state),
    ])
  }

  bumpState()
}

async function bootGame(createNewCharacter = false): Promise<BootOutcome> {
  // Entry flow: guest auth, login, character creation - every route
  // into the game funnels through here so GameRoot can mount.
  // Idempotent: calling again once booted is a no-op.
  // Remediation Task 5 - bootInFlight guard trong composable: boot thu 2
  // khi boot dau con pending bi skip; guard reset khi fail de retry chay
  // duoc. Phan duoi chi xu ly UI hien thi theo outcome.
  const outcome = await lifecycle.bootGame({
    createNewCharacter,
    onRestoreOk: () => {
      // Fix (2026-08-20) - grant "Tram" save cu (idempotent). P7-M4:
      // learn-only - the mortal runtime resolves an absent pick as tram.
      if (!gameManager.skillManager.has('tram')) {
        gameManager.progressionOps.learnSkill('tram', player.$state)
      }
      // Phap Tu Reimagined Task 2 - mortal-path actives (idempotent).
      // huy_quyen (The Tu Reimagined sec.2.3) shares this seam - learned,
      // so the hidden_body_pathway offer gate reads it on old saves.
      for (const mortalSkillId of ['linh_bao', 'huy_quyen']) {
        if (!gameManager.skillManager.has(mortalSkillId)) {
          gameManager.progressionOps.learnSkill(mortalSkillId, player.$state)
        }
      }
    },
    onNewCharacter: (metadata) => {
      // Nhan vat moi / CHARACTER_UNINITIALIZED: mot starter snapshot
      // DUY NHAT tu canonical metadata (server row thang nhat hon; nguoc
      // lai pending creation payload cho mock/local).
      const resolved = metadata ? initializationMetadataFromRemote(metadata) : pendingCreationMetadata
      pendingCreationMetadata = undefined
      if (resolved === undefined) {
        throw new Error('onNewCharacter ran without a creation pick')
      }
      initializeCharacter(resolved, {
        gameManager,
        player: player.$state,
        nowSeconds: () => clock.nowSeconds(),
      })
    },
  })

  if (outcome.status === 'entered') {
    // No-op (undefined) ngay neu khong chay trong Electron (window.electronAPI
    // khong ton tai o ban web) - xem composables/useElectronBridge.ts.
    // Dispose lan truoc neu co: boot 'entered' hai lan khong duoc chong
    // subscription.
    electronBridgeDispose?.()
    electronBridgeDispose = useElectronBridge(gameManager, {
      // B1-D - the quit/update/logout flush is the authority's
      // result-bearing one; a failed attempt surfaces the
      // retry/cancel/force-close offer instead of closing.
      flush: (requestId) => onlineAuthority.flush(requestId),
      onFlushFailed: (notice) => {
        quitFlushOffer.value = notice
      },
      suspend: () => onlineAuthority.suspend(),
      resume: () => onlineAuthority.resumeFromSuspend(),
    })

    // Dev-only console helpers (spec v3 B5) - registered here so BOTH
    // new-character and restored-save entries get them; the function
    // itself early-returns outside import.meta.env.DEV. B1.9a - mock
    // bundle only: bypassing realm/cost gates inside a remote-committed
    // save would poison the authoritative row.
    if (backendBundle.mode === 'mock') {
      registerEnemySpawnDebug({ gameManager, player: player.$state })
    }

    isBooted.value = true
    lifecycle.startAutosave()
  }

  return outcome
}

function onAuthenticated(session: AuthSession) {
  // Spec F8 - bind the save slot BEFORE boot loads: every storage path
  // resolves through resolveSaveKey() from this point on.
  // B1-C - bump the save generation FIRST: an in-flight write from the
  // previous session/account cannot touch the journal or cache once it
  // resolves (reset/logout/user-switch fence), and queued writers drain
  // instead of committing under the new account.
  cloudSaveCoordinator.reset()
  setSaveAccountId(accountIdForSession(session))
  void bootGame(false)
}

// BETA-CREATION - the creation payload (or the canonical character the
// RPC committed) is consumed by onNewCharacter inside the boot
// transaction (learn precedes pick write).
let pendingCreationMetadata: CharacterInitializationMetadata | undefined

async function onCharacterCreated(payload: CharacterCreationPayload) {
  pendingCreationMetadata = payload.character
    ? initializationMetadataFromRemote(payload.character)
    : { name: payload.name, talentIds: payload.talentIds }

  // The first durable save now lives inside the boot transaction
  // (useAppLifecycle.bootGame): 'entered' is only returned after the write
  // commits, and the tick loop never starts on a failed save - the old
  // post-boot save block here let the runtime tick on an unpersisted
  // character (audit T1-8).
  await bootGame(true)
}

onMounted(() => {
  window.addEventListener(SAVE_RESET_REQUEST_EVENT, resetSaveFromSettings)

  // B1.2 - a fatal backend composition (release build without an
  // explicit working VITE_BACKEND_MODE, mock in release, or supabase
  // without credentials) lands on the configuration surface BEFORE
  // auth; every service in the bundle is fail-closed as a backstop.
  if (backendFatal) {
    bootError.value = backendFatal.message
    recordDiagnostic({
      source: 'renderer',
      severity: 'fatal',
      category: 'lifecycle',
      code: 'BACKEND_CONFIG_FATAL',
      message: backendFatal.message,
    })
    bootFlow.fail()
    return
  }

  // ui-audit creation-meta - reload used to replay the full 3s title intro
  // even with a session+save on disk; resume candidates get a short beat.
  // B1.8: async - the durable guest credential is hydrated here so the
  // Electron restart path also earns the short intro.
  void hasResumeCandidate().then((resumable) => {
    introHandle = window.setTimeout(() => {
      bootFlow.showAuth()
    }, resumable ? 450 : 3000)
  })
})

onUnmounted(() => {
  // Vite HMR also unmounts this component. Persist first so a development
  // reload cannot roll the player back to an old manual save.
  if (!lifecycle.isPersistenceSuppressed()) {
    void persistProgress()
  }

  clock.stop()

  // ARCH-013/L04 - combat counts on its own clock source: an unmounted App
  // that leaves it running keeps a live rAF loop (or main-process IPC
  // subscription) driving a detached GameManager - under HMR that is a
  // second invisible game advancing alongside the new mount.
  combatClockSource.stop()
  electronBridgeDispose?.()
  electronBridgeDispose = undefined
  automationFlagsUnsubscribe()
  disposeCombatPause()

  if (introHandle) {
    clearTimeout(introHandle)
  }

  // Remediation Task 5 - symmetric cleanup: event-bus handlers, DOM
  // listeners, tick + autosave intervals (idempotent, goi lai mot cach an toan).
  lifecycle.stopAll()
  // B1-D - the authority's heartbeat/retry timers die with the mount;
  // a remount builds a fresh instance.
  onlineAuthority.stopAll()
  unbindFeedbackService()
  unbindFeedbackProviders()
  unbindOnlineAuthority(onlineAuthority)
  updateSurface?.dispose()
  unbindUpdateSurface(updateSurface)
  unbindSessionTeardown(teardownToAuth)
  window.removeEventListener(SAVE_RESET_REQUEST_EVENT, resetSaveFromSettings)

  // Presentation teardown: aborts any in-flight transition and drops every
  // subscription, so a late READY/asset callback cannot mount or commit into
  // a disposed app (matters on HMR too, which unmounts this component).
  presentation.dispose()
  routeAdapter.dispose()
  unbindPresentationActive()
  unbindCombatAudio()
  unbindUiAudio()
  unbindAmbientAudio()
  disarmAudioUnlockListeners()
  disarmAudioUnlock?.()
  disarmAudioUnlock = undefined
  phaserSceneAdapter.dispose()
  assetBundleManager.dispose()
})
</script>

<template>
  <RouteMount v-if="entryStage === 'intro'" route="boot">
    <LoadingScreen />
  </RouteMount>

  <RouteMount v-else-if="entryStage === 'auth'" route="auth">
    <AuthEntryScreen @authenticated="onAuthenticated" />
  </RouteMount>

  <RouteMount v-else-if="entryStage === 'character'" route="character">
    <CharacterCreationScreen
      @back="bootFlow.showAuth"
      @complete="onCharacterCreated"
    />
  </RouteMount>

  <RouteMount v-else-if="entryStage === 'error'" route="error">
    <!-- SaveIncompatibleScreen is a CONTENT VARIANT of the error route, not a
         route of its own: it must stay inside the error RouteMount witness.
         As a sibling v-else-if branch it would match before this branch
         whenever saveIssue.status is set, the error mount witness would never
         report, and every incompatible/corrupted-save boot would hang on
         "Renderer readiness timed out". -->
    <SaveIncompatibleScreen v-if="saveIssue.status" />

    <main v-else class="boot-error">
      <h1>{{ backendFatal ? t('errors.backendConfig.title') : t('errors.boot.title') }}</h1>
      <p>{{ bootError }}</p>
      <!-- No back-to-auth escape on a fatal composition: auth cannot
           admit anything against an unconfigured backend. -->
      <button v-if="!backendFatal" type="button" @click="bootFlow.showAuth">{{ t('errors.boot.backToAuth') }}</button>
    </main>
  </RouteMount>

  <ErrorBoundary v-else>
    <!-- LoadingScreen shows ONLY during boot (intro, or while the
         transition into the game has not entered). -->
    <LoadingScreen v-if="!isBooted" />

    <!-- GameRoot chi hien khi boot xong; inert while an authority
         overlay owns the surface (B1-D). -->
    <GameRoot v-if="isBooted" :inert="authorityOverlayActive" />
  </ErrorBoundary>

  <!-- Task 8 (A11) - the unwatched pause. Data-driven by useCombatPause()
       (visibilitychange -> freezeCombat('tab-hidden')), NOT the curtain
       above: separate owner (the battle vs. the presentation coordinator),
       separate z-layer (OVERLAY_LAYERS.combatPause < curtain so the
       curtain can always cover it), neither may drive the other. -->
  <CombatPauseOverlay v-if="isCombatPaused" :inert="authorityOverlayActive" @continue="continueBattle" />

  <!-- Curtain/loading/error cover lives ABOVE every entry branch so cold boot
       and boot failures are covered too, not just in-game transitions. -->
  <PresentationTransitionOverlay
    ref="transitionOverlayRef"
    :inert="authorityOverlayActive"
    :phase="routeAdapter.phase.value"
    :is-locked="routeAdapter.isLocked.value"
    :error="routeAdapter.error.value"
    :can-return-home="canRecoverToHome"
    @retry="onTransitionRetry"
    @back="onTransitionBack"
  />

  <!-- B1-D - the authority surface is ALWAYS blocking: while the sim is
       paused no pointer/keyboard path may reach a mutator (spec: actions
       cannot mutate while the overlay is visible). 'reconnecting' shows
       the reconnect status plus the owned give-up escape back to auth;
       terminal states require the same owned acknowledgement; the
       quit-flush retry/cancel/force-close offer comes from Electron main. -->
  <div v-if="authorityState === 'reconnecting' && isBooted" class="authority-overlay" :style="{ zIndex: OVERLAY_LAYERS.authority }">
    <div class="authority-card">
      <p>{{ t('authority.reconnecting') }}</p>
      <button type="button" @click="acknowledgeAuthority">
        {{ t('authority.reauth') }}
      </button>
    </div>
  </div>

  <div v-else-if="authorityTerminal && isBooted" class="authority-overlay" :style="{ zIndex: OVERLAY_LAYERS.authority }">
    <div class="authority-card">
      <p>{{ authorityMessage }}</p>
      <button type="button" @click="acknowledgeAuthority">
        {{ t('authority.reauth') }}
      </button>
      <!-- 'update-required' is terminal FOR THE SESSION - the update
           surface stays reachable so the user can fetch the build the
           backend demands instead of dead-ending at the gate. -->
      <button
        v-if="authorityState === 'update-required' && updateSurface"
        type="button"
        @click="updateSurface.check()"
      >
        {{ t('updates.check') }}
      </button>
    </div>
  </div>

  <div v-if="quitFlushOffer" class="authority-overlay" :style="{ zIndex: OVERLAY_LAYERS.authority }">
    <div class="authority-card">
      <h2>{{ t('quitFlush.title') }}</h2>
      <p>{{ t('quitFlush.message', { code: quitFlushOffer.code ?? quitFlushOffer.status }) }}</p>
      <div class="authority-actions">
        <button type="button" @click="retryQuitFlush">{{ t('quitFlush.retry') }}</button>
        <button type="button" @click="cancelQuitFlush">{{ t('quitFlush.cancel') }}</button>
        <button type="button" @click="forceQuitFlush">{{ t('quitFlush.force') }}</button>
      </div>
    </div>
  </div>

  <!-- BETA-FINAL PR12 - the install admission failed (blocked/failed
       flush or timeout): explicit recovery only - retry mints a NEW
       requestId; 'later' keeps the verified candidate parked. Neither
       path turns a failed flush into an install. -->
  <div v-if="updateInstallFailed" class="authority-overlay" :style="{ zIndex: OVERLAY_LAYERS.authority }">
    <div class="authority-card">
      <h2>{{ t('updates.installFailed.title') }}</h2>
      <p>{{ t('updates.installFailed.message', { code: updateInstallFailed.code ?? updateInstallFailed.status }) }}</p>
      <div class="authority-actions">
        <button type="button" @click="updateSurface?.retryInstall()">{{ t('updates.installFailed.retry') }}</button>
        <button type="button" @click="updateSurface?.later()">{{ t('updates.installFailed.later') }}</button>
      </div>
    </div>
  </div>

  <UpdateBanner v-if="isBooted" />

  <ErrorScreen />
</template>

<style>
/* body co margin mac dinh 8px cua trinh duyet - .game-root (100vh)
   bi day lech xuong dung 8px do, khien phan duoi cung (bottom bar,
   tab bar...) bi tran khoi viewport. Reset o day vi ca app chua
   co global CSS reset nao khac. background/font-family/color ap token
   tu assets/theme.css (import trong main.ts) - tranh chop nen trang
   mac dinh truoc khi Vue mount, va moi component ke thua font/mau chu
   goc tru khi tu override. */
html,
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: var(--paper-50);
  font-family: var(--font-body);
  color: var(--paper-text);
}

.boot-error {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-content: center;
  justify-items: center;
  background: var(--paper-50);
}
.boot-error h1 {
  color: var(--crimson);
  font-family: var(--font-display);
}
.boot-error p {
  color: var(--text-secondary);
}
.boot-error button {
  padding: 10px 16px;
  border: 1px solid var(--paper-line);
  background: var(--paper-100);
  color: var(--paper-text);
  cursor: pointer;
}

/* B1-D authority surface - blocking reconnect/terminal/quit-flush card. */
.authority-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-content: center;
  background: rgba(20, 16, 12, 0.72);
}

.authority-card {
  min-width: 320px;
  max-width: 420px;
  padding: 20px 24px;
  background: var(--paper-50);
  border: 1px solid var(--paper-line);
  color: var(--paper-text);
  text-align: center;
}

.authority-card h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  color: var(--crimson);
}

.authority-card button {
  margin: 12px 4px 0;
  padding: 10px 16px;
  border: 1px solid var(--paper-line);
  background: var(--paper-100);
  color: var(--paper-text);
  cursor: pointer;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.4s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
