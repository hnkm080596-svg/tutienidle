import { defineStore } from 'pinia'
import { createDefaultPlayer, type PlayerData } from '../core/player/Player'
import {
  DEFAULT_COMBAT_AI_STRATEGY,
  isCombatAiStrategy,
} from '../core/battle/CombatAiStrategy'
import {
  addCultivation,
  breakthrough as breakthroughSystem,
} from '../core/cultivation/CultivationSystem'
import {
  equipElement as equipElementSystem,
  unequipElement as unequipElementSystem,
} from '../core/element/ElementLoadout'
import type { ElementType } from '../core/element/ElementType'
import { calculateOfflineProgress } from '../core/idle/OfflineProgressSystem'
import { calculateOfflineTime } from '../core/idle/GameClock'
import { buildGameSave, loadGame, type GameSave } from '../services/save/SaveSystem'
import { cloudSaveCoordinator } from '../services/cloudSave/CloudSaveServiceFactory'
import { PLAYER_BASE_RANGE_RANKS } from '@/core/stats/StatBlock'
import type { GameManager } from '@/core/game/GameManager'
import { getRequiredCultivation, BASE_CULTIVATION_PER_SECOND } from '@/core/realm/realmSystem'
import { getCultivationSpeedMultiplier, getInsightPerCultivation } from '@/core/talent/TalentEffects'
import { calculateStats, type StatModifier } from '@/core/stats/StatCalculator'
import { getKiemYDamageMultipliers, getKiemYTier } from '@/core/player/KiemYSystem'
import { normalizeArtifactProgress } from '@/core/artifact/ArtifactProgression'

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
      // Kiếm Ý vĩnh viễn (spec 2026-08-29-kiem-the-kiem-y mục 3.3) —
      // thay SwordIntentSystem cũ (tier theo tu vi đã dỡ): tier theo
      // bossKillCount (KiemYSystem), CHỈ áp khi đã chốt path Kiếm Tu
      // route Bạt Kiếm (Đơn Kiếm ăn tier, Đa Kiếm không).
      const kiemYModifiers: StatModifier[] = []
      if (state.cultivationPath === 'kiem_tu' && state.kiemTuRoute === 'bat_kiem' && state.bossKillCount > 0) {
        const multipliers = getKiemYDamageMultipliers(getKiemYTier(state.bossKillCount))
        kiemYModifiers.push(
          { id: 'kiem_y:skill_damage', sourceId: 'kiem_y', sourceType: 'attribute', stat: 'skillDamagePercent', flat: multipliers.skillDamagePercent },
          { id: 'kiem_y:critical_rate', sourceId: 'kiem_y', sourceType: 'attribute', stat: 'criticalRate', flat: multipliers.criticalRate },
          { id: 'kiem_y:critical_damage', sourceId: 'kiem_y', sourceType: 'attribute', stat: 'criticalDamage', flat: multipliers.criticalDamage },
        )
      }

      return calculateStats(state.baseStats, [
        ...state.modifiers,
        ...state.externalModifiers,
        ...kiemYModifiers,
      ])
    },
  },

  actions: {
    // Tốc độ tu luyện nền = BASE_CULTIVATION_PER_SECOND, nhân với effect
    // 'cultivation_speed' của thiên phú đã chọn (2026-08-27). Các nguồn
    // buff/tâm pháp/trang bị vẫn KHÔNG có đường thay đổi tốc độ tu luyện.
    // `cultivationPerSecond` là snapshot được LƯU vào save, dùng để tính
    // tiến độ ngoại tuyến lúc load (xem player.load()). Trả về lượng tu
    // vi THẬT vừa cộng được (sau khi đã chặn ở "required", xem
    // addCultivation()).
    cultivate(deltaSeconds: number): number {
      // Guard 0.01 (plan §6) — percent âm hợp lệ (Phàm Cốt −75% → 0.25×)
      // nhưng không bao giờ về 0/âm.
      this.cultivationPerSecond =
        BASE_CULTIVATION_PER_SECOND *
        Math.max(0.01, getCultivationSpeedMultiplier(this.selectedTalentIds))

      // Tụ Linh Trận (economy-fixes-sinks-plan §3.2 B1, 2026-08-29) —
      // cộng dồn % từ các effect tu_linh_tran đang active (thường chỉ 1
      // effect tại 1 thời điểm, nhưng để an toàn sum qua tất cả).
      const tuLinhPercent = this.persistentTimedEffects
        .filter((effect) => effect.expiresAtMs > Date.now())
        .reduce((sum, effect) => sum + (effect.cultivationSpeedPercent ?? 0), 0)

      if (tuLinhPercent > 0) {
        this.cultivationPerSecond *= 1 + tuLinhPercent
      }

      const before = this.cultivation

      addCultivation(this, this.cultivationPerSecond * deltaSeconds)

      const gained = this.cultivation - before

      // Đếm tu vi dồn suốt đời (không bị đột phá tiêu hao) — nuôi
      // technique tier; tier Kiếm Ý sau spec 2026-08-29 đọc
      // bossKillCount (xem KiemYSystem.ts).
      this.totalCultivationGained += gained

      // Thiên phú Ngộ Đạo (talent-direction-choice-plan §6) — đổi tu vi
      // tu luyện ONLINE lấy Cảm Ngộ Kỹ năng theo ngưỡng. Chưa đủ ngưỡng
      // thì dồn accumulator sang lần sau. Chỉ online — offline là thiết
      // kế riêng sau này.
      const insightThreshold = getInsightPerCultivation(this.selectedTalentIds)

      // Guard `> 0` (audit fix 2026-08-31): talent data edit đặt
      // cultivationPerInsight: 0 từng tạo infinite loop (accumulator -= 0
      // không giảm) — freeze tick 100ms vĩnh viễn. Ngưỡng 0 vô nghĩa, bỏ
      // hẳn nhánh insight.
      if (insightThreshold !== undefined && insightThreshold > 0 && gained > 0) {
        this.cultivationInsightAccumulator += gained

        while (this.cultivationInsightAccumulator >= insightThreshold) {
          this.cultivationInsightAccumulator -= insightThreshold
          this.skillInsight += 1
          this.totalSkillInsightGained += 1
        }
      }

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
    // khác setExternalModifiers ở trên. player.modifiers là bucket
    // DÙNG CHUNG cho nhiều nguồn tĩnh khác (realm passive, Luyện Thể,
    // pill vĩnh viễn — phân biệt qua sourceType/id prefix), nên chỉ
    // được thay THẾ phần sourceType 'equipment', không được gán đè cả
    // mảng — gán đè từng xoá sạch mọi nguồn khác mỗi lần equip/reload.
    setEquipmentModifiers(modifiers: StatModifier[]) {
      this.modifiers = [
        ...this.modifiers.filter(modifier => modifier.sourceType !== 'equipment'),
        ...modifiers,
      ]
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

      return cloudSaveCoordinator.save(buildGameSave(this, gameManager))
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

      const offline = this.restoreFromSave(outcome.save)

      return { ...outcome, offline }
    },

    restoreFromSave(save: GameSave) {
      // GameClock là nguồn duy nhất tính thời gian offline.
      // lastSavedAt của save file chính là lastOnlineAt của GameClockState.
      const { offlineSeconds } = calculateOfflineTime({
        lastOnlineAt: save.player.lastSavedAt,
      })

      const offline = calculateOfflineProgress(offlineSeconds, save.player.cultivationPerSecond)

      Object.assign(this, save.player)

      // Node level (plan §6.1) — save cũ giữa v46 thiếu object này;
      // thiếu = chưa lĩnh ngộ node nào, KHÔNG được để undefined kẹo
      // getNodeLevel/aggregate crash toàn UI (nguyên nhân "không xóa
      // được save" — app chết trước khi tới được Settings).
      this.nodeLevels ??= {}
      this.purchasedNodeIds ??= []

      // Combat AI strategy (plan §10.2) — save không có field hoặc giá
      // trị sai dùng default 'nearest'. Không migration (development
      // build), fallback đủ cho development save.
      this.combatAiStrategy = isCombatAiStrategy(save.player.combatAiStrategy)
        ? save.player.combatAiStrategy
        : DEFAULT_COMBAT_AI_STRATEGY

      // Balance pass 2026-08-26 — repair save CŨ: baseStats được snapshot
      // nguyên trạng vào save, nên nhân vật tạo ở bản base range 1/9 giữ
      // mãi giá trị cũ và KHÔNG BAO GIỜ với tới quái (triệu chứng "vẫn
      // tele nhưng 0 sát thương, nhấp nháy teleport"). attackRange là
      // baseline THUỘC CODE (không có đường đầu tư trực tiếp — bonus chỉ
      // chảy qua StatModifier) nên ép về đúng baseline hiện hành.
      this.baseStats.attackRange = PLAYER_BASE_RANGE_RANKS

      this.cultivation += offline.cultivation

      // Cùng luật "không tích lũy dư quá mức cần đột phá" như
      // addCultivation() (xem CultivationSystem.ts) — save cũ (trước
      // khi luật này có) hoặc offline progress dồn nhiều có thể đẩy
      // cultivation vượt ngưỡng, phải chặn lại ở đây vì Object.assign
      // gán thẳng, không đi qua addCultivation().
      this.cultivation = Math.min(this.cultivation, this.cultivationRequired)

      // Bản Mệnh Pháp Bảo (doc §10.2) — sửa mọi invariant sai ngay sau
      // blind Object.assign() ở trên: nghề không khớp, thiếu state dù
      // đủ gate, grade/path sai enum, realm/level/EXP vượt trần.
      normalizeArtifactProgress(this)

      return offline
    },
  },
})
