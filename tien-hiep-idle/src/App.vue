<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { usePlayerStore } from './stores/player'
import { useUiStore } from './stores/ui'
import { GameClock } from './core/idle/GameClock'
import { TICK_INTERVAL_MS } from './core/idle/SpeedSettings'
import { GameManager } from './core/game/GameManager'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from './composables/useGameState'
import { checkTribulationOutcomeAction } from './composables/useTribulation'
import { useBreakthrough } from './composables/useBreakthrough'
import { useNotificationStore } from './stores/notification'
import { useOfflineSummaryStore } from './stores/offlineSummary'
import { useSaveIssueStore } from './stores/saveIssue'
import GameRoot from './components/layout/GameRoot.vue'
import LoadingScreen from './components/common/LoadingScreen.vue'
import ErrorBoundary from './components/common/ErrorBoundary.vue'
import ErrorScreen from './components/common/ErrorScreen.vue'
import SaveIncompatibleScreen from './components/common/SaveIncompatibleScreen.vue'

import { materials } from './data/materials/materials'
import { explorations } from './data/exploration/explorations'
import { SKILLS } from './data/skill/Skills'
import { TECHNIQUES } from './data/technique/Techniques'
import { ENEMIES } from './data/enemy/Enemies'
import { TRIBULATIONS } from './data/enemy/Tribulations'
import { STAGES } from './data/stage/Stages'
import { zones } from './data/stage/Zones'
import { equipment } from './data/equipment/equipment'
import { affixes } from './data/equipment/affixes'
import { equipmentSets } from './data/equipment/equipmentSets'
import { pills } from './data/pill/pills'
import { talismans } from './data/talisman/talismans'
import { buffs } from './data/buff/buffs'
import { formations } from './data/formation/formations'
import { recipes } from './data/recipe/recipes'
import { ailments } from './data/ailment/ailments'
import { buildings } from './data/building/buildings'
import { processingRecipes } from './data/building/processingRecipes'
import { PHAP_TU_NODES } from './data/progression/PhapTuNodes'

const player = usePlayerStore()
const ui = useUiStore()
const notification = useNotificationStore()
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

gameManager.registerMaterials(materials)
gameManager.registerExplorations(explorations)
gameManager.registerSkillTemplates(SKILLS)
gameManager.registerTechniqueTemplates(TECHNIQUES)
gameManager.registerEnemyTemplates(ENEMIES)
gameManager.registerEnemyTemplates(TRIBULATIONS)
gameManager.registerStages(STAGES)
gameManager.registerZones(zones)
gameManager.registerEquipment(equipment)
gameManager.registerAffixes(affixes)
gameManager.registerEquipmentSets(equipmentSets)
gameManager.registerPills(pills)
gameManager.registerTalismans(talismans)
gameManager.registerBuffs(buffs)
gameManager.registerFormations(formations)
gameManager.registerRecipes(recipes)
gameManager.registerAilments(ailments)
gameManager.registerBuildings(buildings)
gameManager.registerProcessingRecipes(processingRecipes)
gameManager.registerProgressionNodes(PHAP_TU_NODES)

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

let tickHandle: number | undefined

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

  // clock vẫn update() đều để giữ mốc thời gian thực đồng bộ (tránh
  // "nhảy cóc" khi bỏ pause) — pause chỉ chặn simulatedDelta, không
  // đụng tới clock thật.
  const simulatedDelta = ui.isPaused ? 0 : deltaSeconds

  if (simulatedDelta > 0) {
    // GameManager luôn được update trước, để battle (nếu có) và
    // buff/skill cooldown luôn chạy đúng nhịp thời gian thực.
    gameManager.update(simulatedDelta)

    // Beta Phase 4 (Notification/UX) — rút toast phát sinh TRONG
    // GameManager (hiện chỉ loot, xem GameManager.grantItemDrops())
    // mỗi tick, đẩy vào notificationStore để ToastContainer hiện.
    for (const event of gameManager.drainNotifications()) {
      notification.push(event.kind, event.message)
    }

    // Đang trong trận thì không cộng tu vi — 2 việc loại trừ nhau.
    // Tầm Bảo (gather, trước là "Thu Thập") không bị ảnh hưởng: nó tự
    // tính tiến độ qua startedAt/collect(), không phụ thuộc vào nhánh
    // này. player.isCultivating giờ là SUY RA (không còn bấm được, xem
    // ghi chú `wasFighting` ở trên) — luôn bằng !isFighting.
    const battleBeforeAuto = gameManager.getBattle()
    const isFighting = battleBeforeAuto !== null && battleBeforeAuto.state === 'fighting'

    player.isCultivating = !isFighting

    if (isFighting !== wasFighting) {
      gameManager.eventBus.emit('cultivation_changed', { isCultivating: !isFighting })

      wasFighting = isFighting
    }

    if (player.isCultivating) {
      player.cultivate(simulatedDelta)
    }

    // Auto Đột Phá tiểu cảnh giới (2026-08-20) — user tick checkbox ở
    // CharacterPanel.vue (ui.isAutoBreakthrough), tick() tự bấm thay mỗi
    // khi tu vi đủ. CHỈ tiểu cảnh giới — Trúc Cơ/đại cảnh giới vẫn cần
    // bấm tay (BreakthroughRequirementPanel.vue, yêu cầu vật phẩm).
    if (ui.isAutoBreakthrough && player.cultivation >= player.cultivationRequired) {
      breakthrough()
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
    player.setExternalModifiers(gameManager.getAggregatedModifiers(player.$state))
  }

  bumpState()
}

function startTickLoop() {
  tickHandle = window.setInterval(tick, TICK_INTERVAL_MS)
}

// Phím tắt Tab mở/đóng NavMenuOverlay.vue (bảng navigation toàn màn
// hình, xem RightPanel.vue/GameRoot.vue) — phải preventDefault() vì
// Tab mặc định của trình duyệt sẽ nhảy focus sang phần tử kế tiếp.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    event.preventDefault()

    ui.toggleNavMenu()
  }
}

onMounted(() => {
  const loaded = player.load()

  // Phase 5 (Reliability, mục XVI) — save đọc được nhưng version
  // không khớp / JSON hỏng KHÔNG được coi như "chưa từng có save".
  // Chặn boot lại đây, để SaveIncompatibleScreen quyết thay vì âm
  // thầm tạo nhân vật mới đè lên tiến trình cũ ở lần save() kế tiếp.
  if (loaded.status === 'incompatible' || loaded.status === 'corrupted') {
    saveIssue.report(loaded.status, loaded.raw, loaded.status === 'incompatible' ? loaded.foundVersion : undefined)

    return
  }

  if (loaded.status === 'ok') {
    // registerXxx() ở trên đã chạy trước onMounted (module-level
    // trong <script setup>) nên registry đã sẵn data để resolve id
    // — restoreFromSave() PHẢI gọi sau đó, không phải trước.
    const equipmentModifiers = gameManager.restoreFromSave(loaded.save)

    player.setEquipmentModifiers(equipmentModifiers)

    // Fix (2026-08-20) — "Trảm" (basic_strike) trước đây CHỈ được cấp
    // ở nhánh nhân vật mới bên dưới, restoreFromSave() chỉ re-add skill
    // đã CÓ SẴN trong save.skills. Save tạo trước khi grant này tồn
    // tại (hoặc bất kỳ lý do gì thiếu basic_strike) sẽ kẹt ở Phàm Nhân
    // không có đòn đánh nào — Phàm Nhân chưa có Skill Loadout UI để tự
    // sửa. Idempotent, an toàn no-op với save đã có sẵn skill này.
    if (!gameManager.skillManager.has('basic_strike')) {
      gameManager.learnSkill('basic_strike')
      gameManager.equipSkillWithoutSlot('basic_strike')
    }

    // Beta Phase 4 (mục XIV) — chỉ hiện modal nếu offline đủ dài
    // (>60s, tránh phiền khi refresh nhanh) — thay console.log cũ.
    if (loaded.offline.elapsedSeconds > 60) {
      offlineSummary.show({
        elapsedSeconds: loaded.offline.elapsedSeconds,
        cultivation: loaded.offline.cultivation,
      })
    }
  } else {
    // Nhân vật mới: học sẵn + trang bị tâm pháp tu luyện cơ bản, nếu
    // không sẽ không có công pháp nào ở slot tu luyện để
    // syncRealmPassive() tra passiveSkillIdsByRealm khi đột phá.
    gameManager.learnTechnique('spirit_gathering_scripture')
    gameManager.equipTechnique('spirit_gathering_scripture')

    // Phàm Nhân (2026-08-16) — Tụ Linh Quyết không mang theo skill
    // chiến đấu nào (thuần tu luyện), nhưng nhân vật vẫn cần đánh được
    // 10 Động trước khi chọn Pháp Tu/Kiếm Tu — cấp sẵn "Trảm" (skill
    // basic_strike có sẵn trong data, trước đây chưa ai grant) làm đòn
    // đánh thường mặc định. Phàm Nhân CHƯA có Skill Loadout UI (xem
    // PLAN HOÀN CHỈNH mục 7/8) nên equip KHÔNG qua slot. Sau khi chọn
    // path, kit's basic skill tự GHI ĐÈ (SkillSystem.equipToSlot()/
    // equipWithoutSlot() tự dọn skill isBasicAttack cũ, xem ghi chú ở đó).
    gameManager.learnSkill('basic_strike')
    gameManager.equipSkillWithoutSlot('basic_strike')

    // Truyền Tống Trận/Khai Thác rework (theo yêu cầu — "mặc định có,
    // không thì làm sao có nguyên liệu") — 2 Building này giờ granted
    // SẴN cho nhân vật mới, không cần build() thủ công (khác 4 building
    // Tứ Nghệ và các resource building khác, vẫn phải xây bình thường).
    // Add THẲNG qua buildingManager (bỏ qua canBuild/cost) — đây là
    // grant khởi tạo, không phải hành động build của người chơi.
    for (const buildingId of ['teleport_array', 'gathering_outpost']) {
      gameManager.buildingManager.add({
        instanceId: crypto.randomUUID(),
        buildingId,
        level: 1,
        lastCollectedAt: clock.nowSeconds(),
      })
    }
  }

  clock.start()

  startTickLoop()

  window.addEventListener('keydown', onKeydown)

  isBooted.value = true
})

onUnmounted(() => {
  clock.stop()

  if (tickHandle) {
    clearInterval(tickHandle)
  }

  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <SaveIncompatibleScreen v-if="saveIssue.status" />

  <ErrorBoundary v-else>
    <LoadingScreen v-if="!isBooted" />

    <GameRoot v-else />
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
  background: var(--ink-950);
  font-family: var(--font-body);
  color: var(--text-primary);
}
</style>