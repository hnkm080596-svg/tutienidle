<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { usePlayerStore } from './stores/player'
import { useUiStore } from './stores/ui'
import { GameClock, DEFAULT_MAX_OFFLINE_SECONDS } from './core/idle/GameClock'
import { GameManager } from './core/game/GameManager'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from './composables/useGameState'
import { checkTribulationOutcomeAction } from './composables/useTribulation'
import { isBattleInProgress } from './core/battle/BattleTypes'
import { useBreakthrough } from './composables/useBreakthrough'
import { useElectronBridge } from './composables/useElectronBridge'
import { useNotificationStore } from './stores/notification'
import { useI18n } from 'vue-i18n'
import { useOfflineSummaryStore } from './stores/offlineSummary'
import { useSaveIssueStore } from './stores/saveIssue'
import { savePersistedUiAutomationFlags } from './stores/uiFlagsPersistence'
import { useAppLifecycle } from './composables/useAppLifecycle'
import GameRoot from './components/layout/GameRoot.vue'
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
import { KIEM_TU_NODES } from './data/progression/KiemTuNodes'
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
// MainMenu overlay — TẠM VÔ HIỆU HÓA (mặc định ẩn). Luồng boot hiện
// hành là auth-first (AuthEntryScreen), e2e tests khóa contract đó.
// MainMenu che AuthEntryScreen (fixed overlay z-1000) khiến luồng cũ
// không dùng được. Task 8 của plan online-foundation thay thế cả
// MainMenu lẫn AuthEntryScreen bằng WelcomeAuthScreen hợp nhất — khi
// đó xoá luôn state này, không đầu tư thêm cho MainMenu.
const showMainMenu = ref(false)

function handleMenuStart() {
  showMainMenu.value = false
  void bootGame(false)
}

function handleMenuSettings() {
  ui.leftPanelMode = 'settings'
}
const bootFlow = useBootFlow()
const entryStage = bootFlow.stage
const bootError = ref('')
let introHandle: number | undefined

// GameClock chỉ đo thời gian (pure clock). GameManager chỉ điều
// phối các system. Việc "mỗi giây thì làm gì" là trách nhiệm của
// vòng lặp tick() dưới đây — nơi duy nhất biết cả 2 bên.
const clock = new GameClock()
const gameManager = new GameManager()

// Defect Task 3 (2026-09-05) — boot-race gate: real app WILL mount a Phaser
// presentation layer (PhaserCanvas async bootstrap). Combat ticking pauses
// until CombatScene mounts (setPresentationActive(true) → markReady) or the
// 15s safety-net trips (Phaser bootstrap failure fallback).
gameManager.expectPresentationLayer()

gameManager.registerMaterials(materials)
gameManager.registerSkillTemplates(SKILLS)
gameManager.registerTechniqueTemplates(TECHNIQUES)
gameManager.registerEnemyTemplates(ENEMIES)
gameManager.registerStages(STAGES)
gameManager.registerZones(zones)
gameManager.registerEquipment(equipment)
gameManager.registerAffixes(affixes)
gameManager.registerPills(pills)
// Buff KHÔNG phải Phù/Trận legacy — SkillEffectSystem resolve effect
// 'buff'/'debuff' qua buffRegistry.get() (THROW khi thiếu); bỏ dòng
// này làm registry rỗng và crash giữa trận (fix review 2026-08-26).
// Skill buff-carrying Kiếm Tu cũ đã chuyển node (spec 2026-08-29),
// registry vẫn cần cho buff hệ khác (Thổ Giáp/Độ Kiếp...).
gameManager.registerBuffs(buffs)
gameManager.registerTalismans(talismans)
gameManager.registerFormations(formations)
gameManager.registerAlchemyRecipes(alchemyRecipes)
gameManager.registerBuildings(buildings)
gameManager.registerProgressionNodes(PHAP_TU_NODES)
gameManager.registerProgressionNodes(KIEM_TU_NODES)
gameManager.registerQuests(QUESTS)

const { breakthrough } = useBreakthrough(gameManager)

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
    gameManager.update(simulatedDelta)

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
    const battleBeforeAuto = gameManager.getBattle()
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

    // === Tinh hoa tuôn chảy (2026-08-30) ===
    // 1. essenceArrivalSeen → stream hoàn tất → invest ngay.
    // 2. essenceEmitted lâu quá chưa thấy arrival → headless → invest
    //    (CombatScene không chạy, hoặc bail vì thiếu nguồn).
    // 3. Cả hai đều drain qua investBodyRefinement() — tự gate.
    // State sống trong lifecycle composable (handlers đăng ký một lần);
    // tick đọc + reset qua getter/setter expose.
    if (lifecycle.consumeEssenceArrival()) {
      const consumed = gameManager.investBodyRefinement(player.$state)

      if (consumed > 0) {
        bumpState()
      }
    }

    if (lifecycle.isEssenceHeadlessTimedOut()) {
      lifecycle.clearEssenceEmitted()
      const consumed = gameManager.investBodyRefinement(player.$state)

      if (consumed > 0) {
        bumpState()
      }
    }

    // Đột Phá Trúc Cơ — phản ứng thắng/thua Độ Kiếp NGAY (battle
    // Tribulation không qua Stage/Combat Scene result modal nào cả, xem
    // useTribulation.ts's resolveVictory/resolveDefeat + World
    // Announcement — đây vẫn là luồng kết quả DUY NHẤT cho Tribulation).
    checkTribulationOutcomeAction(player, gameManager)

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
    player.setExternalModifiers(gameManager.getAggregatedModifiers(player.$state))
  }

  bumpState()
}

async function bootGame(createNewCharacter = false) {
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
        gameManager.learnSkill('tram')
        gameManager.setSkillLoadoutSlot(player.$state, 0, 'tram')
      } else if (!gameManager.skillManager.getEquippedInSlot(0)) {
        gameManager.setSkillLoadoutSlot(player.$state, 0, 'tram')
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
      gameManager.learnTechnique('tu_linh_quyet')
      gameManager.equipTechnique('tu_linh_quyet')
      gameManager.learnSkill('tram')
      gameManager.setSkillLoadoutSlot(player.$state, 0, 'tram')

      for (const buildingId of ['teleport_array', 'gathering_outpost']) {
        const instance = {
          instanceId: crypto.randomUUID(),
          buildingId,
          level: 1,
          lastCollectedAt: clock.nowSeconds(),
        }

        gameManager.buildingManager.add(instance)
        gameManager.refreshAutoWorkerCapacity(player.$state, instance)
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
        gameManager.setProductionAutoRestart(definition.siteId, true)
        gameManager.startProductionCycle(definition.siteId, player.$state)
      }

      gameManager.setActivePlayer(player.$state)
    },
  })

  if (outcome.status === 'entered') {
    // No-op ngay nếu không chạy trong Electron (window.electronAPI không
    // tồn tại ở bản web) — xem composables/useElectronBridge.ts.
    useElectronBridge(gameManager)

    isBooted.value = true
    lifecycle.startAutosave()
  }
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

  await bootGame(true)
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

  if (introHandle) {
    clearTimeout(introHandle)
  }

  // Remediation Task 5 — symmetric cleanup: event-bus handlers, DOM
  // listeners, tick + autosave intervals (idempotent, gọi lại an toàn).
  lifecycle.stopAll()
  window.removeEventListener(SAVE_RESET_REQUEST_EVENT, resetSaveFromSettings)
})
</script>

<template>
  <!-- MainMenu overlay tạm (Task 8 online-foundation sẽ thay thế):
       hiện từ lúc mount phủ trên intro/auth, đóng vĩnh viễn khi
       bootGame() chạy — qua nút "Bắt đầu tu luyện" hoặc auth flow.
       z-index 1000 (MainMenu.vue .main-menu-overlay) phủ LoadingScreen
       3s đầu; user thấy menu thay vì màn loading. -->
  <Transition>
    <MainMenu
      v-if="showMainMenu"
      class="main-menu-overlay"
      @start="handleMenuStart"
      @settings="handleMenuSettings"
    />
  </Transition>

  <LoadingScreen v-if="entryStage === 'intro'" />

  <AuthEntryScreen v-else-if="entryStage === 'auth'" @authenticated="onAuthenticated" />

  <CharacterCreationScreen
    v-else-if="entryStage === 'character'"
    @back="bootFlow.showAuth"
    @complete="onCharacterCreated"
  />

  <SaveIncompatibleScreen v-else-if="saveIssue.status" />

  <main v-else-if="entryStage === 'error'" class="boot-error">
    <h1>Không thể khởi động</h1>
    <p>{{ bootError }}</p>
    <button type="button" @click="bootFlow.showAuth">Trở về đăng nhập</button>
  </main>

  <ErrorBoundary v-else>
    <!-- LoadingScreen chỉ hiện TRONG QUÁ TRÌNH boot (loading_save /
         initializing), SAU KHI MainMenu đã đóng. -->
    <LoadingScreen v-if="!isBooted" />

    <!-- GameRoot chỉ hiện khi boot xong -->
    <GameRoot v-if="isBooted" />
  </ErrorBoundary>

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
  z-index: 1000;
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
