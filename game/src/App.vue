<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref } from 'vue'
import { usePlayerStore } from './stores/player'
import { useUiStore } from './stores/ui'
import { GameClock, DEFAULT_MAX_OFFLINE_SECONDS } from './core/idle/GameClock'
import { GameManager } from './core/game/GameManager'
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
import { useAudioStore } from './stores/audio'
import { RafClockSource } from './presentation/clock/RafClockSource'
import { MainProcessClockSource } from './presentation/clock/MainProcessClockSource'
import { checkTribulationOutcomeAction } from './composables/useTribulation'
import { isBattleInProgress } from './core/battle/BattleTypes'
import { registerEnemySpawnDebug } from './core/dev/enemySpawnDebug'
import { useBreakthrough } from './composables/useBreakthrough'
import { useElectronBridge } from './composables/useElectronBridge'
import { useCombatPause } from './composables/useCombatPause'
import { useNotificationStore } from './stores/notification'
import { useI18n } from 'vue-i18n'
import { useOfflineSummaryStore } from './stores/offlineSummary'
import { useSaveIssueStore } from './stores/saveIssue'
import { savePersistedUiAutomationFlags } from './stores/uiFlagsPersistence'
import { useAppLifecycle, type BootOutcome } from './composables/useAppLifecycle'
import GameRoot from './components/layout/GameRoot.vue'
import RouteMount from './components/game/RouteMount.vue'
import PresentationTransitionOverlay from './components/game/PresentationTransitionOverlay.vue'
import CombatPauseOverlay from './components/game/combat/CombatPauseOverlay.vue'
import LoadingScreen from './components/common/LoadingScreen.vue'
import ErrorBoundary from './components/common/ErrorBoundary.vue'
import ErrorScreen from './components/common/ErrorScreen.vue'
import SaveIncompatibleScreen from './components/common/SaveIncompatibleScreen.vue'
import AuthEntryScreen from './components/onboarding/AuthEntryScreen.vue'
import MainMenu from './components/menu/MainMenu.vue'
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
import { PHAP_TU_NODES } from './data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from './data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from './data/progression/KiemTuNodes'
import { THE_TU_NODES } from './data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from './data/progression/TheTuAnNodes'
import { QUESTS } from './data/quest/quests'
import { isCultivationPoseActive } from './core/cultivation/CultivationPose'
import { useBootFlow } from './composables/useBootFlow'
import { cloudSaveCoordinator } from './services/cloudSave/CloudSaveServiceFactory'
import {
  buildGameSave,
  deleteSave,
  restoreGameSession,
  SAVE_RESET_REQUEST_EVENT,
} from './services/save/SaveSystem'

const player = usePlayerStore()
const ui = useUiStore()

// Automation flags persistence (2026-08-26, uiFlagsPersistence.ts) —
// $subscribe bắt MỌI đường mutation (kể cả gán trực tiếp
// `ui.battleRunMode = ...` trong CombatVictoryPanel/StageSelectPanel),
// ghi snapshot vào localStorage. Ghi rẻ (JSON nhỏ), skip khi snapshot
// không đổi để tránh ghi lặp vô nghĩa mỗi tick.
// (2026-08-30) isAutoConsumeTinhHoa đã GỠ — Luyện Thể tự đầu tư qua
// essence stream; chỉ còn battleRunMode.
// battleRunMode là string đơn giản — so sánh trực tiếp thay vì
// JSON.stringify() (alloc string + object mỗi mutation vô ích cho 1
// field nguyên thuỷ).
let lastAutomationSnapshot: string | undefined

ui.$subscribe((_mutation, state) => {
  if (state.battleRunMode === lastAutomationSnapshot) {
    return
  }

  lastAutomationSnapshot = state.battleRunMode

  savePersistedUiAutomationFlags({
    battleRunMode: state.battleRunMode,
    combatInputMode: state.combatInputMode,
  })
}, { detached: true })
const notification = useNotificationStore()
const { t } = useI18n()
const offlineSummary = useOfflineSummaryStore()
const saveIssue = useSaveIssueStore()

// Beta Phase 4 (Boot Loading Screen) — Boot → Load Save → Initialize →
// Home. Set true ở cuối onMounted() sau khi mọi thứ (load save/đăng
// ký data/tick loop) đã sẵn sàng.
const isBooted = ref(false)
// GameClock chỉ đo thời gian (pure clock). GameManager chỉ điều
// phối các system. Việc "mỗi giây thì làm gì" là trách nhiệm của
// vòng lặp tick() dưới đây — nơi duy nhất biết cả 2 bên.
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
// host (immune to Chromium's rAF throttling) — prefer it when present. Plain
// web builds have no window.electronAPI and keep the RAF-driven fallback.
// The engine only ever sees the ClockSource interface either way.
const combatClockSource = window.electronAPI
  ? new MainProcessClockSource(window.electronAPI.combatClock)
  : new RafClockSource()
gameManager.setCombatClockSource(combatClockSource)

// ARCH-013/L04 — the Electron bridge subscriptions are an owned resource:
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
  initialShowMainMenu: false,
})
const presentation = createGamePresentation({
  coordinator,
  eventBus: gameManager.eventBus,
  getCurrentSession: () => gameManager.getCurrentPresentationSession(),
})
const routeAdapter = createVueRouteAdapter(coordinator, compositeRenderer)

// RC-3: presentationActive has exactly ONE owner — the coordinator, via this
// binding. It is true only while the COMMITTED route is combat and the
// combat session is attached. CombatScene must never assert this for
// itself (self-report is the pattern the coordinator design rejected).
const unbindPresentationActive = bindPresentationActive(coordinator, gameManager)

// Audio: domain combat events -> SFX (observation only, A7). Bound at module
// scope next to the other event-bus bindings; store handles enabled/volume.
const unbindCombatAudio = bindCombatAudio(gameManager.eventBus)

// Autoplay policy: unlock AudioContext on the first pointer gesture anywhere
// (Phaser canvas clicks never reach GameButton). `once` keeps it one-shot.
const unlockAudioOnFirstGesture = () => useAudioStore().unlock()
window.addEventListener('pointerdown', unlockAudioOnFirstGesture, { once: true })

provide(PHASER_SCENE_ADAPTER_KEY, phaserSceneAdapter)
provide(ASSET_BUNDLE_MANAGER_KEY, assetBundleManager)
provide(VUE_ROUTE_ADAPTER_KEY, routeAdapter)
provide(GAME_PRESENTATION_KEY, presentation)

// MainMenu overlay state synced with coordinator snapshot
const showMainMenu = computed({
  get: () => routeAdapter.showMainMenu.value,
  set: (val: boolean) => coordinator.setShowMainMenu(val),
})

function handleMenuStart() {
  showMainMenu.value = false
  void bootGame(false)
}

function handleMenuSettings() {
  ui.leftPanelMode = 'settings'
}

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

gameManager.catalogOps.registerMaterials(materials)
gameManager.catalogOps.registerSkillTemplates(SKILLS)
gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
gameManager.catalogOps.registerStages(STAGES)
gameManager.catalogOps.registerZones(zones)
gameManager.catalogOps.registerEquipment(equipment)
gameManager.catalogOps.registerAffixes(affixes)
gameManager.catalogOps.registerPills(pills)
// Buff KHÔNG phải Phù/Trận legacy — SkillEffectSystem resolve effect
// 'buff'/'debuff' qua buffRegistry.get() (THROW khi thiếu); bỏ dòng
// này làm registry rỗng và crash giữa trận (fix review 2026-08-26).
// Skill buff-carrying Kiếm Tu cũ đã chuyển node (spec 2026-08-29),
// registry vẫn cần cho buff hệ khác (Thổ Giáp/Độ Kiếp...).
gameManager.catalogOps.registerBuffs(buffs)
gameManager.catalogOps.registerTalismans(talismans)
gameManager.catalogOps.registerFormations(formations)
gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
gameManager.catalogOps.registerBuildings(buildings)
gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
gameManager.catalogOps.registerProgressionNodes(THE_TU_NODES)
gameManager.catalogOps.registerProgressionNodes(THE_TU_AN_NODES)
gameManager.catalogOps.registerQuests(QUESTS)

const { breakthrough } = useBreakthrough(gameManager)

// Task 8 (A11, spec §6.1) — an unwatched battle pauses visibly and resumes
// only on Continue; returning to the tab is not consent to resume. Gated on
// getCombatClockState() !== 'stopped' so the overlay never appears outside
// combat (no battle mounted == nothing to pause).
const { isPaused: isCombatPaused, continueBattle, dispose: disposeCombatPause } = useCombatPause(
  gameManager,
  { isCombatActive: () => gameManager.getCombatClockState() !== 'stopped' },
)

// Cầu nối reactivity chung cho các panel đọc bag/equipment — xem
// composables/useGameState.ts. tick() tự tăng mỗi giây; các action
// mutate GameManager từ panel (equip/craft/enhance...) gọi bumpState()
// ngay sau đó để UI phản hồi tức thời, không chờ tick kế tiếp.
const stateVersion = ref(0)

function bumpState() {
  stateVersion.value++
}

provide(GAME_MANAGER_KEY, gameManager)
provide(STATE_VERSION_KEY, stateVersion)
provide(BUMP_STATE_KEY, bumpState)

// Remediation Task 5 (2026-09-05) — lifecycle idempotence extract sang
// useAppLifecycle.ts (tick/autosave interval guard, bootInFlight guard,
// symmetric event-bus/DOM listener cleanup). App.vue giữ phần tick có
// phụ thuộc UI (cultivate/bumpState/notification dedupe).
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
  player,
  gameManager,
  // Fix (2026-09-06) — bootGame() tự startTickLoop(tick) khi boot thành
  // công (xem useAppLifecycle.ts). `tick` là function declaration nên đã
  // hoisted, tham chiếu được ở đây dù định nghĩa vật lý nằm sau (dưới).
  tick,
  offlineSummary,
  saveIssue,
  entryStage,
  // Composable giữ player dạng loose (không import Pinia store type vào
  // core-facing signature) — cast TẠI BIÊN này khớp đúng loại thật.
  restoreGameSession: (playerOwner, manager, save) =>
    restoreGameSession(playerOwner as Parameters<typeof restoreGameSession>[0], manager, save as Parameters<typeof restoreGameSession>[2]),
  persistPlayer: async () => {
    const result = await player.save(gameManager)

    // Cảnh báo autosave fail chỉ 1 lần cho mỗi chuỗi fail — reset cờ khi
    // ghi thành công lại để chuỗi fail kế tiếp vẫn được báo.
    if (result.status !== 'ok' && !saveFailureNotified) {
      saveFailureNotified = true
      notification.push('error', 'Không lưu được tiến trình — bộ nhớ trình duyệt đầy. Hãy hóa luyện bớt trang bị.')
      console.warn('[autosave] progress was not saved', result)
    } else if (result.status === 'ok') {
      saveFailureNotified = false
    }

    return result
  },
  onError: (message) => {
    bootError.value = message
  },
})

// Cảnh báo autosave fail chỉ 1 lần cho mỗi chuỗi fail — autosave chạy
// mỗi 15s nên nếu toast mỗi tick thì spam; reset cờ khi ghi thành công
// lại để chuỗi fail kế tiếp vẫn được báo.
let saveFailureNotified = false

function persistProgress() {
  void lifecycle.persistProgress()
}

function resetSaveFromSettings() {
  lifecycle.suppressPersistence()
  deleteSave()
  window.location.reload()
}

// Cultivation ⇄ combat (2026-08-20) — không còn nút bấm thủ công, tu
// luyện là trạng thái SUY RA THẲNG từ isFighting mỗi tick (chiến đấu
// thì không tu luyện, không chiến đấu thì tự tu luyện). Theo dõi giá
// trị isFighting của tick TRƯỚC để chỉ emit 'cultivation_changed' đúng
// lúc chuyển trạng thái (MainScene.ts's onCultivationChanged() đổi
// pose ngồi thiền) — tránh emit lặp lại mỗi tick.
let wasFighting = false

function tick() {
  const { deltaSeconds } = clock.update()

  if (deltaSeconds <= 0) {
    return
  }

  // W9.2 (2026-08-27) — tab bị throttle/treo lâu có thể trả về delta
  // rất lớn trong một tick. Clamp theo đúng trần offline 24h để thời
  // gian "đuổi kịp" không vượt offline cap; combat đã có trần catch-up
  // riêng trong GameManager.updateBattleFixedStep().
  const simulatedDelta = Math.min(deltaSeconds, DEFAULT_MAX_OFFLINE_SECONDS)

  if (simulatedDelta > 0) {
    // GameManager luôn được update trước, để battle (nếu có) và
    // buff/skill cooldown luôn chạy đúng nhịp thời gian thực.
    gameManager.tickOps.update(simulatedDelta)

    // Beta Phase 4 (Notification/UX) — rút toast phát sinh TRONG
    // GameManager (hiện chỉ loot, xem GameManager.grantItemDrops())
    // mỗi tick, đẩy vào notificationStore để ToastContainer hiện.
    for (const event of gameManager.drainNotifications()) {
      notification.push(
        event.kind,
        event.messageKey ? t(event.messageKey, event.messageParams ?? {}) : event.message,
        event.loot,
      )
    }

    // Đang trong trận thì không cộng tu vi — 2 việc loại trừ nhau.
    // Tầm Bảo (gather, trước là "Thu Thập") không bị ảnh hưởng: nó tự
    // tính tiến độ qua startedAt/collect(), không phụ thuộc vào nhánh
    // này. Tu vi vẫn tăng cả trong combat; isCultivating là trạng thái kinh tế
    // (luôn bật), còn event cultivation_changed chỉ điều khiển pose hình ảnh.
    const battleBeforeAuto = gameManager.getTurnBattle()
    const isFighting = battleBeforeAuto !== null && isBattleInProgress(battleBeforeAuto.state)

    // Cultivation progresses alongside combat. Fighting only controls the
    // scene pose; it no longer suspends cultivation gains.
    player.isCultivating = true

    if (isFighting !== wasFighting) {
      gameManager.eventBus.emit('cultivation_changed', {
        isCultivating: isCultivationPoseActive(isFighting),
      })

      wasFighting = isFighting
    }

    player.cultivate(simulatedDelta)

    // Tiểu cảnh giới tự tăng (2026-08-28) — tick() bấm breakthrough()
    // mỗi khi tu vi đầy, không còn checkbox bật/tắt (đúng tinh thần
    // idle game + chủ game quyết định). Đại cảnh giới vẫn qua nghi lễ
    // riêng (Quán Khí/Trúc Cơ/Độ Kiếp), xem useTribulation.ts.
    if (player.cultivation >= player.cultivationRequired) {
      breakthrough()
    }

    // R5 (AR-14) + F7 (QA-2026-09-09-RR7): Body refinement auto-invest is
    // owned by GameManager.update() (domain authority, exactly-once per
    // tick). App must not call it again; bumpState() below refreshes the UI.

    // Đột Phá Trúc Cơ — phản ứng thắng/thua Độ Kiếp NGAY (battle
    // Tribulation không qua Stage/Combat Scene result modal nào cả, xem
    // useTribulation.ts's resolveVictory/resolveDefeat + World
    // Announcement — đây vẫn là luồng kết quả DUY NHẤT cho Tribulation).
    //
    // F1 fix (2026-09-13): `presentation` is required - without it the
    // outcome is applied but the coordinator never issues
    // request({ target: 'home' }), so the route soft-locks on
    // 'tribulation' until reload. Guarded by
    // tests/architecture/tribulationOutcomeWiring.test.ts.
    checkTribulationOutcomeAction(player, gameManager, presentation)

    // Combat UI Redesign — Auto-refight (thắng/thua Stage thì tự đánh
    // tiếp) KHÔNG còn chạy tức thời ở tick() nữa: CombatVictoryPanel.vue
    // hiện kết quả trước, TỰ đếm ngược 3s rồi mới gọi lại startBattle()
    // (đúng spec mục 15/19 — người chơi phải kịp thấy màn hình
    // Thắng/Thua). Xem CombatResultModal.vue cho toàn bộ logic đó.

    // Buff/Technique có thể vừa hết hạn hoặc vừa được thêm trong
    // update() ở trên -> đồng bộ lại modifier cho player mỗi tick.
    //
    // perf-optimize-pass Task 5: getAggregatedModifiers() vẫn dựng mảng
    // MỚI mỗi tick (signature GameManager giữ nguyên), nhưng
    // setExternalModifiers() nay tự dirty-check nội dung và BỎ QUA lần
    // gán trùng — nên `finalStats` chỉ invalidate khi buff/technique
    // thật sự đổi, không còn recompute 10 lần/giây. Đây là lý do
    // bumpState() bên dưới CỐ Ý giữ nguyên (chạy mỗi tick cho đồng hồ/
    // resource counter): stat đã được tách hẳn khỏi stateVersion.
    player.setExternalModifiers([
      ...gameManager.effectOps.getAggregatedModifiers(player.$state),
      // ARCH-002 (M7) — the live runtime channel (timed effects, Phu/Tran
      // sockets) is part of the same modifier union the battle provider
      // serves; the menu shows what combat actually uses.
      ...gameManager.effectOps.getActiveRuntimeModifiers(player.$state),
    ])
  }

  bumpState()
}

async function bootGame(createNewCharacter = false): Promise<BootOutcome> {
  // MainMenu là entry tạm thời — mọi đường vào game (menu "Bắt đầu",
  // guest auth, đăng nhập, tạo nhân vật) đều phải tắt nó để GameRoot
  // hiện được. Idempotent: gọi lại khi menu đã ẩn là no-op.
  showMainMenu.value = false

  // Remediation Task 5 — bootInFlight guard trong composable: boot thứ 2
  // khi boot đầu còn pending bị skip; guard reset khi fail để retry chạy
  // được. Phần dưới chỉ xử lý UI hiển thị theo outcome.
  const outcome = await lifecycle.bootGame({
    createNewCharacter,
    onRestoreOk: (offline) => {
      // Fix (2026-08-20) — grant "Trảm" save cũ (idempotent).
      if (!gameManager.skillManager.has('tram')) {
        gameManager.progressionOps.learnSkill('tram')
        gameManager.progressionOps.setSkillLoadoutSlot(player.$state, 0, 'tram')
      } else if (!gameManager.skillManager.getEquippedInSlot(0)) {
        gameManager.progressionOps.setSkillLoadoutSlot(player.$state, 0, 'tram')
      }
      // Phap Tu Reimagined Task 2 — mortal-path actives (idempotent).
      for (const mortalSkillId of ['linh_bao', 'huy_quyen']) {
        if (!gameManager.skillManager.has(mortalSkillId)) {
          gameManager.progressionOps.learnSkill(mortalSkillId)
        }
      }

      // The Tu Reimagined (spec 2026-09-15 §2.3) — huy_quyen joins the
      // same starter-grant seam as tram (learned, not equipped) so the
      // ung_the offer gate has something real to read on old saves.
      if (!gameManager.skillManager.has('huy_quyen')) {
        gameManager.progressionOps.learnSkill('huy_quyen')
      }

      // Beta Phase 4 (mục XIV) — chỉ hiện modal nếu offline đủ dài.
      if (offline.elapsedSeconds > 60) {
        offlineSummary.show({
          elapsedSeconds: offline.elapsedSeconds,
          cultivation: offline.cultivation,
        })
      }
    },
    onNewCharacter: () => {
      // Nhân vật mới: học sẵn tâm pháp + skill + grant khởi đầu.
      gameManager.realmAdvanceOps.learnTechnique('tu_linh_quyet')
      gameManager.realmAdvanceOps.equipTechnique('tu_linh_quyet')
      gameManager.progressionOps.learnSkill('tram')
      gameManager.progressionOps.setSkillLoadoutSlot(player.$state, 0, 'tram')
      // Phap Tu Reimagined Task 2 — mortal-path actives.
      gameManager.progressionOps.learnSkill('linh_bao')
      // Huy Quyen — second mortal basic, learned unequipped; grinding it
      // to Lv3 (10.000 casts) is what reveals ung_the at the ritual.
      gameManager.progressionOps.learnSkill('huy_quyen')

      for (const buildingId of ['teleport_array', 'gathering_outpost']) {
        const instance = {
          instanceId: crypto.randomUUID(),
          buildingId,
          level: 1,
          lastCollectedAt: clock.nowSeconds(),
        }

        gameManager.buildingManager.add(instance)
        gameManager.buildingOps.refreshAutoWorkerCapacity(player.$state, instance)
      }

      // Starter pack đủ xây 3 base (Linh Tuyền/Khí Đường/Đan Phòng) —
      // id theo trục tuổi thống nhất (gp123 6E C2).
      for (const [materialId, amount] of [
        ['mortal_wood_decade', 15],
        ['mortal_ore_decade', 6],
      ] as const) {
        if (gameManager.materialRegistry.has(materialId)) {
          gameManager.materialBag.add(gameManager.materialRegistry.get(materialId), amount)
        }
      }

      // 3 nguồn Thanh Vân tự chạy + autoRestart.
      for (const definition of gameManager.productionSystem.getSiteDefinitions()) {
        gameManager.buildingOps.setProductionAutoRestart(definition.siteId, true)
        gameManager.buildingOps.startProductionCycle(definition.siteId, player.$state)
      }

      gameManager.setActivePlayer(player.$state)
    },
  })

  if (outcome.status === 'entered') {
    // No-op (undefined) ngay nếu không chạy trong Electron (window.electronAPI
    // không tồn tại ở bản web) — xem composables/useElectronBridge.ts.
    // Dispose lần trước nếu có: boot 'entered' hai lần không được chồng
    // subscription.
    electronBridgeDispose?.()
    electronBridgeDispose = useElectronBridge(gameManager)

    // Dev-only console helpers (spec v3 B5) - registered here so BOTH
    // new-character and restored-save entries get them; the function
    // itself early-returns outside import.meta.env.DEV.
    registerEnemySpawnDebug({ gameManager, player: player.$state })

    isBooted.value = true
    lifecycle.startAutosave()
  }

  return outcome
}

function onAuthenticated() {
  void bootGame(false)
}

async function onCharacterCreated(payload: CharacterCreationPayload) {
  player.name = payload.name
  player.selectedTalentIds = payload.talentIds

  for (const [stat, amount] of Object.entries(payload.attributes) as Array<
    [keyof CharacterCreationPayload['attributes'], number]
  >) {
    player.baseStats[stat] += amount
  }

  const outcome = await bootGame(true)

  // ARCH-013/L04 (review round 1): chỉ persist khi boot THẬT SỰ chạy grants
  // — outcome 'skipped' (teardown giữa load / double-invoke) nghĩa là
  // onNewCharacter chưa grant technique/skill/buildings/starter materials,
  // lưu lúc này sẽ ghi một nhân vật thiếu starter content; 'failed' đã bị
  // bootFlow.fail() xử lý rồi, không có gì hợp lệ để save.
  if (outcome.status !== 'entered') {
    return
  }

  // R10 (AR-12): buildGameSave() owns making player.$state's reactive
  // Pinia proxy safe to snapshot — callers just pass it through.
  const result = await cloudSaveCoordinator.save(buildGameSave(player.$state, gameManager))
  if (result.status !== 'ok') {
    bootError.value =
      result.status === 'conflict' ? 'Save đã thay đổi ở một phiên khác.' : result.message
    bootFlow.fail()
  }
}

onMounted(() => {
  window.addEventListener(SAVE_RESET_REQUEST_EVENT, resetSaveFromSettings)

  introHandle = window.setTimeout(() => {
    bootFlow.showAuth()
  }, 3000)
})

onUnmounted(() => {
  // Vite HMR also unmounts this component. Persist first so a development
  // reload cannot roll the player back to an old manual save.
  if (!lifecycle.isPersistenceSuppressed()) {
    void persistProgress()
  }

  clock.stop()

  // ARCH-013/L04 — combat counts on its own clock source: an unmounted App
  // that leaves it running keeps a live rAF loop (or main-process IPC
  // subscription) driving a detached GameManager — under HMR that is a
  // second invisible game advancing alongside the new mount.
  combatClockSource.stop()
  electronBridgeDispose?.()
  electronBridgeDispose = undefined
  disposeCombatPause()

  if (introHandle) {
    clearTimeout(introHandle)
  }

  // Remediation Task 5 — symmetric cleanup: event-bus handlers, DOM
  // listeners, tick + autosave intervals (idempotent, gọi lại một cách an toàn).
  lifecycle.stopAll()
  window.removeEventListener(SAVE_RESET_REQUEST_EVENT, resetSaveFromSettings)

  // Presentation teardown: aborts any in-flight transition and drops every
  // subscription, so a late READY/asset callback cannot mount or commit into
  // a disposed app (matters on HMR too, which unmounts this component).
  presentation.dispose()
  routeAdapter.dispose()
  unbindPresentationActive()
  unbindCombatAudio()
  window.removeEventListener('pointerdown', unlockAudioOnFirstGesture)
  phaserSceneAdapter.dispose()
  assetBundleManager.dispose()
})
</script>

<template>
  <!-- MainMenu overlay tạm (Task 8 online-foundation sẽ thay thế):
       hiện từ lúc mount phủ trên intro/auth, đóng vĩnh viễn khi
       bootGame() chạy — qua nút "Bắt đầu tu luyện" hoặc auth flow.
       Layer: OVERLAY_LAYERS.mainMenu (MainMenu.vue tự bind) phủ
       LoadingScreen 3s đầu; user thấy menu thay vì màn loading. -->
  <Transition>
    <MainMenu
      v-if="showMainMenu"
      class="main-menu-overlay"
      @start="handleMenuStart"
      @settings="handleMenuSettings"
    />
  </Transition>

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
      <h1>Không thể khởi động</h1>
      <p>{{ bootError }}</p>
      <button type="button" @click="bootFlow.showAuth">Trở về đăng nhập</button>
    </main>
  </RouteMount>

  <ErrorBoundary v-else>
    <!-- LoadingScreen chỉ hiện TRONG QUÁ TRÌNH boot (intro, hoặc khi
         transition vào game chưa entered), SAU KHI MainMenu đã đóng. -->
    <LoadingScreen v-if="!isBooted" />

    <!-- GameRoot chỉ hiện khi boot xong -->
    <GameRoot v-if="isBooted" />
  </ErrorBoundary>

  <!-- Task 8 (A11) — the unwatched pause. Data-driven by useCombatPause()
       (visibilitychange -> freezeCombat('tab-hidden')), NOT the curtain
       above: separate owner (the battle vs. the presentation coordinator),
       separate z-layer (OVERLAY_LAYERS.combatPause < curtain so the
       curtain can always cover it), neither may drive the other. -->
  <CombatPauseOverlay v-if="isCombatPaused" @continue="continueBattle" />

  <!-- Curtain/loading/error cover lives ABOVE every entry branch so cold boot
       and boot failures are covered too, not just in-game transitions. -->
  <PresentationTransitionOverlay
    ref="transitionOverlayRef"
    :phase="routeAdapter.phase.value"
    :is-locked="routeAdapter.isLocked.value"
    :error="routeAdapter.error.value"
    :can-return-home="canRecoverToHome"
    @retry="onTransitionRetry"
    @back="onTransitionBack"
  />

  <ErrorScreen />
</template>

<style>
/* body có margin mặc định 8px của trình duyệt — .game-root (100vh)
   bị đẩy lệch xuống đúng 8px đó, khiến phần dưới cùng (bottom bar,
   tab loadout...) bị tràn khỏi viewport. Reset ở đây vì cả app chưa
   có global CSS reset nào khác. background/font-family/color áp token
   từ assets/theme.css (import trong main.ts) — tránh chớp nền trắng
   mặc định trước khi Vue mount, và mọi component kế thừa font/màu chữ
   gốc trừ khi tự override. */
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

.main-menu-overlay {
  position: fixed;
  inset: 0;
  /* No z-index here — the component binds OVERLAY_LAYERS.mainMenu itself
     so the app-level overlay order has a single source. */
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
