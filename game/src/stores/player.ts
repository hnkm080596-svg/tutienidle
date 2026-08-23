import { defineStore } from 'pinia'
import { createDefaultPlayer, type PlayerData } from '../core/player/Player'
import { addCultivation, breakthrough as breakthroughSystem } from '../core/cultivation/CultivationSystem'
import { equipElement as equipElementSystem, unequipElement as unequipElementSystem } from '../core/element/ElementLoadout'
import type { ElementType } from '../core/element/ElementType'
import { calculateOfflineProgress } from '../core/idle/OfflineProgressSystem'
import { calculateOfflineTime } from '../core/idle/GameClock'
import { saveGame, loadGame } from '../services/save/SaveSystem'
import type { GameManager } from '@/core/game/GameManager'
import { getRequiredCultivation, BASE_CULTIVATION_PER_SECOND } from '@/core/realm/realmSystem'
import { calculateStats, type StatModifier } from '@/core/stats/StatCalculator'
import { getSwordIntentModifiers } from '@/core/player/SwordIntentSystem'

export const usePlayerStore = defineStore('player', {
  state: (): PlayerData => createDefaultPlayer(),

  getters: {
    cultivationRequired(state) {
      return getRequiredCultivation(state.realmId, state.realmLevel)
    },

    // Dùng lại đúng công thức cultivationRequired — trước đây tự tính
    // "realmLevel * 100" (sai, không khớp getRequiredCultivation thật
    // sự dùng ở nơi khác), nay chỉ còn 1 nguồn công thức duy nhất.
    cultivationProgress(): number {
      return Math.min(this.cultivation / this.cultivationRequired, 1)
    },

    // Stats cuối cùng = baseStats + modifiers (equipment/talent, tĩnh)
    // + externalModifiers (buff/technique, do GameManager gộp mỗi tick).
    // Đây là nguồn duy nhất UI/CombatEntity nên đọc.
    finalStats(state) {
      return calculateStats(state.baseStats, [
        ...state.modifiers,
        ...state.externalModifiers,
        // Kiếm Ý vĩnh viễn (Kiếm Tu, 2026-08-15) — tính LIVE từ
        // totalCultivationGained, xem core/player/SwordIntentSystem.ts.
        ...getSwordIntentModifiers(state.totalCultivationGained),
      ])
    },
  },

  actions: {
    // Pháp Tu Redesign (magicpath, 2026-08-18) — cultivationRate đã bị
    // xoá khỏi Stats, tốc độ tu luyện giờ CỐ ĐỊNH
    // BASE_CULTIVATION_PER_SECOND cho MỌI người chơi, không đọc
    // finalStats/không nhận bonus nào nữa (tâm pháp/skill/buff/gear
    // không còn đường nào rút ngắn tu luyện). Vẫn đồng bộ vào
    // `cultivationPerSecond` — field này vẫn cần giữ vì đó là snapshot
    // được LƯU vào save, dùng để tính tiến độ ngoại tuyến lúc load (xem
    // player.load()). Trả về lượng tu vi THẬT vừa cộng được (sau khi
    // đã chặn ở "required", xem addCultivation()).
    cultivate(deltaSeconds: number): number {
      this.cultivationPerSecond = BASE_CULTIVATION_PER_SECOND

      const before = this.cultivation

      addCultivation(this, this.cultivationPerSecond * deltaSeconds)

      const gained = this.cultivation - before

      // Kiếm Ý vĩnh viễn (Kiếm Tu, 2026-08-15) — đếm dồn suốt đời,
      // KHÔNG theo `this.cultivation` (bị đột phá tiêu hao) mà theo
      // TỔNG đã từng tích được, xem core/player/SwordIntentSystem.ts.
      this.totalCultivationGained += gained

      // Tâm Pháp có thanh kinh nghiệm riêng (2026-08-20) — cùng nguồn
      // "gained" nuôi Kiếm Ý ở trên, xem core/technique/TechniqueTier.ts's
      // getTechniqueTier().
      return gained
    },

    breakthrough(): boolean {
      return breakthroughSystem(this)
    },

    // Pháp Tu Redesign (magicpath) — Element Loadout, cùng pattern
    // breakthrough() ở trên (pure function core/element/ElementLoadout.ts,
    // không qua GameManager vì chỉ đụng PlayerData, không cần registry
    // nào khác).
    equipElement(element: ElementType): boolean {
      return equipElementSystem(this, element)
    },

    unequipElement(element: ElementType): boolean {
      return unequipElementSystem(this, element)
    },

    // Gọi bởi App.vue mỗi tick với kết quả từ
    // GameManager.getAggregatedModifiers(). Store không tự tính
    // buff/technique modifier, chỉ lưu lại để finalStats dùng.
    setExternalModifiers(modifiers: StatModifier[]) {
      this.externalModifiers = modifiers
    },

    // Modifier "tĩnh" từ equipment (xem ghi chú kiểu PlayerData).
    // Gọi ngay sau equip/unequip/enhance, không phải mỗi tick —
    // khác setExternalModifiers ở trên.
    setEquipmentModifiers(modifiers: StatModifier[]) {
      this.modifiers = modifiers
    },


    // true nếu MỚI đánh dấu (chưa từng unlock trước đó) — dùng để
    // chống cộng trùng hiệu ứng gắn passive khi đột phá đại cảnh giới
    // (xem composables/useBreakthrough.ts).
    markRealmEnhancementUnlocked(key: string): boolean {
      if (this.unlockedRealmEnhancements.includes(key)) {
        return false
      }

      this.unlockedRealmEnhancements.push(key)

      return true
    },

    // Nhận gameManager từ App.vue thay vì tự giữ instance trong
    // store — GameManager không phải reactive state của Vue (xem
    // ghi chú trong GameManager.ts/App.vue), store chỉ pass-through.
    save(gameManager: GameManager) {
      // lastSavedAt phải được cập nhật TRƯỚC khi ghi file,
      // nếu không offline progress lần sau sẽ bị tính dư
      // (vì file lưu mốc thời gian cũ hơn thời điểm save thật).
      this.lastSavedAt = Date.now()

      saveGame(this, gameManager)
    },

    // Chỉ merge phần PlayerData vào store — phần còn lại của save
    // (skill/technique/inventory/exploration) trả nguyên trong
    // `save` để App.vue tự gọi gameManager.restoreFromSave(), vì
    // store không nên biết về GameManager.
    load() {
      const outcome = loadGame()

      if (outcome.status !== 'ok') {
        return outcome
      }

      const { save } = outcome

      // GameClock là nguồn duy nhất tính thời gian offline.
      // lastSavedAt của save file chính là lastOnlineAt của GameClockState.
      const { offlineSeconds } = calculateOfflineTime({
        lastOnlineAt: save.player.lastSavedAt,
      })

      const offline = calculateOfflineProgress(offlineSeconds, save.player.cultivationPerSecond)

      Object.assign(this, save.player)

      this.cultivation += offline.cultivation

      // Cùng luật "không tích lũy dư quá mức cần đột phá" như
      // addCultivation() (xem CultivationSystem.ts) — save cũ (trước
      // khi luật này có) hoặc offline progress dồn nhiều có thể đẩy
      // cultivation vượt ngưỡng, phải chặn lại ở đây vì Object.assign
      // gán thẳng, không đi qua addCultivation().
      this.cultivation = Math.min(this.cultivation, this.cultivationRequired)

      return { status: 'ok' as const, offline, save }
    },
  },
})
