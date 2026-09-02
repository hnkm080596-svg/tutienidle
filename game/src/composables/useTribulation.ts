import { usePlayerStore } from '../stores/player'
import { useGameManager } from './useGameState'
import { getCurrentRealm } from '../core/realm/realmSystem'
import { KIEP_THUONG_DEBUFF } from '../data/buff/buffs'
import { FOUNDATION_LABELS } from '../core/breakthrough/FoundationType'
import type { GameManager } from '../core/game/GameManager'
import type { ActiveTribulationState } from '../core/tribulation/TribulationDirector'
import { useWorldAnnouncementStore } from '../stores/worldAnnouncement'
import { useUiStore } from '../stores/ui'
import { isBattleInProgress } from '../core/battle/BattleTypes'
import { getSpiritStoneMaterialIdForRealmTier } from '../core/material/SpiritStoneMaterial'
import { getRealmTier } from '../core/realm/RealmTierMap'
import {
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK,
} from '../data/tribulation/TribulationChapters'

// Trảm gate (blockIfNoBasicAttack, 2026-08-20 → gỡ 2026-08-21) — Pháp
// Tu giờ tự học + trang bị SẴN 1 chiêu cơ bản (Hỏa Cầu Thuật) ngay lúc
// chọn path (xem GameManager.chooseCultivationPath()/useBattleActions.
// ts), nên tình huống "chưa trang bị gì" không còn xảy ra — bỏ hẳn
// kiểm tra trước trận đấu này, kể cả ở Độ Kiếp.
type PlayerStore = ReturnType<typeof usePlayerStore>

// Phạt thất bại giờ chuẩn hóa theo realm (spec dot-pha-loi-kiep §5.7,
// data/tribulation/TribulationChapters.ts) — hằng số cứng cũ đã dỡ.

function resolveNextBreakthroughRealm(currentRealmId: string): string | null {
  if (currentRealmId === 'mortal') return 'qi_refining'
  if (currentRealmId === 'qi_refining') return 'foundation_establishment'
  return null
}

/**
 * Bấm nút đột phá (Quán Khí / Trúc Cơ / Độ Kiếp sau Trúc Cơ). Tự
 * resolve target realm từ player.realmId hiện tại.
 *
 * Luôn auto-unequip TRƯỚC khi vào kiếp (idempotent — không có đồ thì
 * không tháo gì). Caller hiện panel xác nhận "Độ kiếp cũng là độ thân"
 * trước khi gọi hàm này.
 */
export function triggerBreakthroughAction(
  player: PlayerStore,
  gameManager: GameManager,
): boolean {
  if (!gameManager.canTriggerBreakthrough(player.$state)) {
    return false
  }

  const battle = gameManager.getBattle()
  if (battle && isBattleInProgress(battle.state)) {
    return false
  }

  const targetRealmId = resolveNextBreakthroughRealm(player.realmId)
  if (!targetRealmId) {
    return false
  }

  gameManager.unequipAllEquipment()
  player.setEquipmentModifiers(gameManager.getEquipmentModifiers())

  const started = gameManager.startTribulation(player.$state, player.finalStats, targetRealmId)

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

  // Kiếp mới (spec dot-pha-loi-kiep §5.1) KHÔNG qua battle — state nằm
  // trong ActiveTribulationState của Director.
  if (active.state === 'ongoing') {
    return false
  }

  if (active.state === 'victory') {
    resolveVictory(player, gameManager, active)
  } else if (active.state === 'defeat') {
    resolveDefeat(player, gameManager, active)
  }

  gameManager.clearActiveTribulation()
  useUiStore().exitTribulationScene()
  gameManager.eventBus.emit('tribulation_scene_exit', undefined)

  return true
}

function resolveVictory(player: PlayerStore, gameManager: GameManager, active: ActiveTribulationState) {
  const realm = getCurrentRealm(active.targetRealmId)

  if (active.targetRealmId === 'qi_refining') {
    useUiStore().standalonePanel = 'quan_khi'
    useWorldAnnouncementStore().show('QUÁN KHÍ THÀNH CÔNG', 'Đạo hữu đã vượt lôi kiếp — hãy chọn con đường tu luyện để bước vào Luyện Khí kỳ.')
    return
  }

  player.realmId = active.targetRealmId
  player.realmLevel = 1
  player.cultivation = 0

  // Task 17 (rework P5) — tháo toàn bộ trang bị NGAY sau khi đổi realm,
  // TRƯỚC mọi sync passive bên dưới — tránh kẹt đồ lệch phẩm mới (Task 16
  // gate chặn equip lệch phẩm nhưng không tự tháo đồ cũ). Slot state
  // (enhanceLevel...) không đổi, chỉ equipped flag + modifier.
  gameManager.unequipAllEquipment()
  player.setEquipmentModifiers(gameManager.getEquipmentModifiers())

  // Spec dot-pha-loi-kiep §4.2/§4.4 — bậc Kiến Cơ công bố SAU khi đạt;
  // highestFoundationAchieved nuôi passive Kiến Cơ (RealmPassives.ts).
  if (active.targetRealmId === 'foundation_establishment') {
    player.highestFoundationAchieved = active.grade
  }

  gameManager.syncRealmPassive(player.$state)
  gameManager.syncRealmStatPassive(player.$state)

  // Tâm pháp + pháp bảo theo path/realm đều do data kit và GameManager
  // cấp idempotent; composable chỉ điều phối kết quả nghi lễ/UI.
  gameManager.grantCultivationPathRealmReward(player.$state, player.realmId)

  // Spec §4.3/§4.4 — thắng kiếp Đại Đạo Trúc Cơ: Phàm Cốt chuyển hóa
  // thành Phàm Nhân Chi Cốt (đảo hình phạt thành thưởng, first-pass
  // +75% tốc tu — hiệu ứng khác playtest quyết định).
  if (active.targetRealmId === 'foundation_establishment' && active.grade === 'great_dao') {
    const index = player.selectedTalentIds.indexOf('pham_cot')

    if (index >= 0) {
      player.selectedTalentIds.splice(index, 1)
    }

    if (!player.selectedTalentIds.includes('pham_nhan_chi_cot')) {
      player.selectedTalentIds.push('pham_nhan_chi_cot')
    }
  }

  // Discovery moment — reveal bậc vừa đạt (Trúc Cơ) hoặc tên cảnh giới.
  if (active.targetRealmId === 'foundation_establishment') {
    useWorldAnnouncementStore().show(
      `★ ${FOUNDATION_LABELS[active.grade].toUpperCase()} TRÚC CƠ ★`,
      'Đạo hữu đã vượt qua Độ Kiếp, chính thức bước vào Trúc Cơ kỳ.',
    )
  } else {
    useWorldAnnouncementStore().show(
      `★ ${realm.name.toUpperCase()} ★`,
      `Đạo hữu đã vượt qua Độ Kiếp, chính thức bước vào ${realm.name}.`,
    )
  }
}

function resolveDefeat(player: PlayerStore, gameManager: GameManager, active: ActiveTribulationState) {
  // Phạt chuẩn hóa theo realm (spec §5.7) — tu vi giảm dần theo realm
  // (sàn 20%), Linh Thạch scale theo realm.
  const lossPercent = Math.max(
    TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR,
    TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM[active.targetRealmId] ??
      TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK,
  )

  player.cultivation = Math.floor(player.cultivation * (1 - lossPercent))

  // Plan Workstream F — penalty có thể trừ QUÁ số dư: trừ amount thực tế
  // Math.min(owned, requested) trên MaterialBag.
  const stoneLoss = TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM[active.targetRealmId] ??
    TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK
  const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(active.targetRealmId))
  const owned = gameManager.materialBag.getAmount(spiritStoneId)

  gameManager.materialBag.remove(spiritStoneId, Math.min(owned, stoneLoss))

  // Task 9b (fix round 2) - pass player.finalStats so the debuff's
  // duration-scaling formula (ailmentResistPercent/ailmentDurationPercent)
  // reads the player's REAL gear, same `finalStats` already threaded to
  // startTribulation() above.
  gameManager.applyPersistentBuff(KIEP_THUONG_DEBUFF, player.finalStats)

  // Spec §4.3 — thua kiếp Đại Đạo: mất VĨNH VIỄN cơ hội Đại Đạo, mọi
  // lần xét sau cap ở Thiên Đạo.
  if (active.targetRealmId === 'foundation_establishment' && active.grade === 'great_dao') {
    player.greatDaoOpportunityLost = true

    useWorldAnnouncementStore().show('Đại Đạo Đoạn Tuyệt', 'Nghịch thiên bất thành — cơ duyên Đại Đạo Chi Cơ đã vĩnh viễn đóng lại. Lần tới tối đa là Thiên Đạo.')
    return
  }

  useWorldAnnouncementStore().show('Độ Kiếp Thất Bại', 'Kiếp Thương còn vương lại — hãy dưỡng thương rồi thử lại.')
}

/**
 * Cầu nối Vue cho component CON (đọc player/gameManager qua injection
 * bình thường, xem useGameState.ts). App.vue tự gọi thẳng *Action() ở
 * trên thay vì composable này.
 */
export function useTribulation() {
  const player = usePlayerStore()
  const gameManager = useGameManager()

  return {
    triggerBreakthrough: () => triggerBreakthroughAction(player, gameManager),
    checkTribulationOutcome: () => checkTribulationOutcomeAction(player, gameManager),
  }
}
