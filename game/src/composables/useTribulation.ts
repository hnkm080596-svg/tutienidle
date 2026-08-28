import { usePlayerStore } from '../stores/player'
import { useGameManager } from './useGameState'
import { getCurrentRealm } from '../core/realm/realmSystem'
import { KIEP_THUONG_DEBUFF } from '../data/buff/buffs'
import { FOUNDATION_LABELS, type FoundationType } from '../core/breakthrough/FoundationType'
import type { GameManager, ActiveTribulation } from '../core/game/GameManager'
import { useWorldAnnouncementStore } from '../stores/worldAnnouncement'
import { useUiStore } from '../stores/ui'
import { isBattleInProgress } from '../core/battle/BattleTypes'
import { SPIRIT_STONE_MATERIAL_ID } from '../core/material/SpiritStoneMaterial'

// Trảm gate (blockIfNoBasicAttack, 2026-08-20 → gỡ 2026-08-21) — Pháp
// Tu giờ tự học + trang bị SẴN 1 chiêu cơ bản (Hỏa Cầu Thuật) ngay lúc
// chọn path (xem GameManager.chooseCultivationPath()/useBattleActions.
// ts), nên tình huống "chưa trang bị gì" không còn xảy ra — bỏ hẳn
// kiểm tra trước trận đấu này, kể cả ở Độ Kiếp.
type PlayerStore = ReturnType<typeof usePlayerStore>

// Mất 1 PHẦN tu vi hiện có khi thất bại (mục 13 spec `breakthrough`
// — "mất một phần Linh lực"), KHÔNG mất Đại Đạo Chi Cơ hay bất kỳ vật
// phẩm nào (đúng "Không nên để mất Đại Đạo Chi Cơ 0.01% chỉ vì thất
// bại một lần").
const TRIBULATION_DEFEAT_CULTIVATION_LOSS_PERCENT = 0.5
const TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS = 50

/**
 * Bấm nút "TRÚC CƠ" — vào thẳng Độ Kiếp Trúc Cơ, KHÔNG hỏi lại/hiện
 * điều kiện gì (mục 10 — hard rule). (2026-08-27) Thiết kế hiện tại:
 * mốc 12 tầng là Nhân Đạo baseline; các cấp đột phá ẩn khác (ví dụ 4
 * mức Kiến Cơ cho Luyện Khí → Trúc Cơ) sẽ được thiết kế sau, nên dùng
 * thẳng foundationType cố định 'human' (baseline, 0% bonus Kiến Cơ —
 * xem data/realm/RealmPassives.ts's KIEN_CO_MAIN_STAT_PERCENT). Hàm
 * THUẦN (nhận player/gameManager qua tham số) — dùng được cả từ
 * component con (qua useTribulation() bên dưới) lẫn App.vue's tick()
 * (App.vue tự provide GameManager cho cây con, provide()/inject()
 * KHÔNG hoạt động khi component tự inject() giá trị CHÍNH NÓ vừa
 * provide, nên App.vue không thể gọi useGameManager()/useTribulation()
 * — phải gọi thẳng hàm này với gameManager/player nó đã có sẵn).
 */
export function triggerFoundationBreakthroughAction(player: PlayerStore, gameManager: GameManager): boolean {
  if (!gameManager.canTriggerFoundationBreakthrough(player.$state)) {
    return false
  }

  const battle = gameManager.getBattle()

  if (battle && isBattleInProgress(battle.state)) {
    return false
  }

  const foundationType: FoundationType = 'human'

  const started = gameManager.startTribulation(player.$state, player.finalStats, 'foundation_establishment', foundationType)

  if (started) {
    useUiStore().enterTribulationScene()
  }

  return started
}

/**
 * Đột Phá tổng quát (2026-08-16) — MỌI đại cảnh giới còn lại (Kim Đan
 * trở đi) dùng đường này thay vì hệ Căn Cơ 4-tier riêng của Trúc Cơ.
 * Không có resolveFoundation nào cả — enemy Kiếp cố định theo
 * targetRealmId (xem GameManager.ts's TRIBULATION_ENEMY_ID_BY_REALM).
 * `targetRealmId` LUÔN là `getNextRealm(player.realmId)?.id` — caller
 * (BreakthroughRequirementPanel.vue) tự resolve trước khi gọi.
 */
export function triggerRealmBreakthroughAction(targetRealmId: string, player: PlayerStore, gameManager: GameManager): boolean {
  if (!gameManager.canTriggerRealmBreakthrough(player.$state)) {
    return false
  }

  const battle = gameManager.getBattle()

  if (battle && isBattleInProgress(battle.state)) {
    return false
  }

  const started = gameManager.startTribulation(player.$state, player.finalStats, targetRealmId)

  if (started) {
    useUiStore().enterTribulationScene()
  }

  return started
}

export function triggerQuanKhiAction(player: PlayerStore, gameManager: GameManager): boolean {
  if (player.realmId !== 'mortal' || player.cultivationPath || player.realmLevel < 12) {
    return false
  }

  const battle = gameManager.getBattle()
  if (battle && isBattleInProgress(battle.state)) {
    return false
  }

  const started = gameManager.startTribulation(player.$state, player.finalStats, 'qi_refining')
  if (started) {
    useUiStore().enterTribulationScene()
  }
  return started
}

/**
 * Gọi mỗi tick từ App.vue, TRƯỚC nhánh Auto-refight Stage — battle
 * Tribulation không qua Stage nên GameManager chỉ tự set 'victory'/
 * 'defeat', không tự phản ứng. Trả về true nếu VỪA xử lý xong 1 kết
 * quả trong tick này, để App.vue biết bỏ qua Auto-refight Stage ngay
 * tick đó (tránh startStage() đè mất battle Tribulation vừa kết thúc
 * trước khi kịp đọc).
 */
export function checkTribulationOutcomeAction(player: PlayerStore, gameManager: GameManager): boolean {
  const active = gameManager.getActiveTribulation()

  if (!active) {
    return false
  }

  const battle = gameManager.getBattle()

  if (!battle || isBattleInProgress(battle.state)) {
    return false
  }

  if (battle.state === 'victory') {
    resolveVictory(player, gameManager, active)
  } else if (battle.state === 'defeat') {
    resolveDefeat(player, gameManager)
  }

  gameManager.clearActiveTribulation()
  useUiStore().exitTribulationScene()
  gameManager.eventBus.emit('tribulation_scene_exit', undefined)

  return true
}

function resolveVictory(player: PlayerStore, gameManager: GameManager, active: ActiveTribulation) {
  const realm = getCurrentRealm(active.targetRealmId)

  if (active.targetRealmId === 'qi_refining') {
    useUiStore().standalonePanel = 'quan_khi'
    useWorldAnnouncementStore().show('QUÁN KHÍ THÀNH CÔNG', 'Đạo hữu đã vượt lôi kiếp — hãy chọn con đường tu luyện để bước vào Luyện Khí kỳ.')
    return
  }

  player.realmId = active.targetRealmId
  player.realmLevel = 1
  player.cultivation = 0

  if (active.foundationType) {
    player.highestFoundationAchieved = active.foundationType
  }

  gameManager.syncRealmPassive(player.$state)
  gameManager.syncRealmStatPassive(player.$state)

  // Tâm pháp + pháp bảo theo path/realm đều do data kit và GameManager
  // cấp idempotent; composable chỉ điều phối kết quả nghi lễ/UI.
  gameManager.grantCultivationPathRealmReward(player.$state, player.realmId)

  // Beta Phase 4 (World Announcement, mục XVI tài liệu) — "discovery
  // moment" reveal Căn Cơ vừa đạt (Trúc Cơ) hoặc đơn giản là cảnh giới
  // mới (mọi cảnh giới khác, đột phá tổng quát 2026-08-16). Pinia store
  // gọi được trực tiếp ở đây (khác useGameManager() — Pinia dùng
  // active-pinia toàn cục, không qua provide/inject theo cây component,
  // xem ghi chú triggerFoundationBreakthroughAction() phía trên).
  if (active.foundationType) {
    useWorldAnnouncementStore().show(
      `★ ${FOUNDATION_LABELS[active.foundationType].toUpperCase()} TRÚC CƠ ★`,
      'Đạo hữu đã vượt qua Độ Kiếp, chính thức bước vào Trúc Cơ kỳ.',
    )
  } else {
    useWorldAnnouncementStore().show(
      `★ ${realm.name.toUpperCase()} ★`,
      `Đạo hữu đã vượt qua Độ Kiếp, chính thức bước vào ${realm.name}.`,
    )
  }
}

function resolveDefeat(player: PlayerStore, gameManager: GameManager) {
  player.cultivation = Math.floor(player.cultivation * (1 - TRIBULATION_DEFEAT_CULTIVATION_LOSS_PERCENT))

  // Plan Workstream F — penalty có thể trừ QUÁ số dư: trừ amount thực tế
  // Math.min(owned, requested) trên MaterialBag.
  const owned = gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

  gameManager.materialBag.remove(
    SPIRIT_STONE_MATERIAL_ID,
    Math.min(owned, TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS),
  )

  gameManager.applyPersistentBuff(KIEP_THUONG_DEBUFF)

  // Beta Phase 4 — thông điệp ngắn, không phô trương (khác thắng lợi).
  useWorldAnnouncementStore().show('Độ Kiếp Thất Bại', 'Kiếp Thương còn vương lại — hãy dưỡng thương rồi thử lại.')
}

/**
 * Đột Phá Trúc Cơ (Phase 5) — cầu nối Vue cho component CON (đọc
 * player/gameManager qua injection bình thường, xem useGameState.ts).
 * App.vue tự gọi thẳng *Action() ở trên thay vì composable này (lý do
 * xem doc triggerFoundationBreakthroughAction()).
 */
export function useTribulation() {
  const player = usePlayerStore()
  const gameManager = useGameManager()

  return {
    triggerFoundationBreakthrough: () => triggerFoundationBreakthroughAction(player, gameManager),
    triggerRealmBreakthrough: (targetRealmId: string) => triggerRealmBreakthroughAction(targetRealmId, player, gameManager),
    triggerQuanKhi: () => triggerQuanKhiAction(player, gameManager),
    checkTribulationOutcome: () => checkTribulationOutcomeAction(player, gameManager),
  }
}
