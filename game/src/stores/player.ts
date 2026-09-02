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
import { calculateOfflineProgress, type OfflineResult } from '../core/idle/OfflineProgressSystem'
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

// Dirty-check cho setExternalModifiers (perf-optimize-pass Task 5).
// App.vue gọi setExternalModifiers() MỖI TICK (10Hz) với mảng MỚI do
// GameManager.getAggregatedModifiers() dựng lại; gán reference mới làm
// getter `finalStats` invalidate mỗi tick dù nội dung buff/technique
// không đổi -> mọi consumer tính lại vô ích. Ở đây giữ lại "chữ ký" nội
// dung của lần gán gần nhất để bỏ qua các lần gán trùng nội dung.
//
// Vì sao SNAPSHOT theo GIÁ TRỊ (string) chứ không deep-compare với
// `this.externalModifiers`: nguồn modifier (BuffSystem/SkillSystem) có
// thể trả về CHÍNH object cũ và mutate tại chỗ (vd stacks đổi). Khi đó
// hai bên của phép so sánh trỏ cùng object nên deep-compare luôn thấy
// "giống nhau" và ta sẽ bỏ sót thay đổi thật. Chữ ký copy giá trị ra
// string nên bắt được đúng trường hợp này.
//
// WeakMap theo store instance (KHÔNG phải biến module dùng chung) để
// mỗi pinia instance — nhất là trong test, mỗi test tạo pinia mới — có
// snapshot riêng, và snapshot tự thu hồi cùng store. Không đụng vào
// state/save shape.
interface ExternalModifierSnapshot {
  // Đúng giá trị mà state đang giữ sau lần gán gần nhất (proxy reactive
  // của Pinia). Nếu nơi khác thay mảng này (load save, $reset, $patch)
  // thì reference lệch -> ta gán lại thay vì tin vào chữ ký cũ.
  applied: StatModifier[]

  signature: string
}

const lastExternalModifiers = new WeakMap<object, ExternalModifierSnapshot>()

// QA-002 idempotency (Task 9.2) — payload-identity guard cho
// restoreFromSave(), cùng pattern lastExternalModifiers phía trên:
// WeakMap theo store instance, non-reactive, không persist vào save
// (dev phase — không migration). Lưu kết quả OfflineResult của lần
// restore gần nhất; cùng payload gọi lại = no-op trả Y HỆT kết quả đó
// (chống double-credit offline cultivation + double Object.assign khi
// boot flow bị retry/recovery chạy 2 lần), payload KHÁC = áp đầy đủ
// (boot lại với save mới hơn vẫn hoạt động). Identity là
// `lastSavedAt|cultivation` từ save — cặp giá trị này khác hàm ý save
// đã đổi (lần save sau luôn có lastSavedAt mới hơn).
interface RestoredPayloadSnapshot {
  identity: string

  offline: OfflineResult
}

const lastRestoredPayloads = new WeakMap<object, RestoredPayloadSnapshot>()

// Ký tự điều khiển làm dấu phân cách — không bao giờ xuất hiện trong
// id/sourceId/stat/tag (toàn chuỗi định danh do code sinh), nên hai mảng
// khác nội dung không thể vô tình trùng chữ ký vì ghép chuỗi.
const SIGNATURE_SEPARATOR = '\u0001'

// "Nội dung giống hệt" = cùng số lượng, cùng THỨ TỰ, và từng entry khớp
// TOÀN BỘ field của StatModifier có ảnh hưởng tới calculateStats
// (id/sourceId/sourceType/stat/tag + 7 field số). Thứ tự được tính vào
// vì mảng này được spread thẳng vào pipeline; giữ chặt hơn cần thiết ở
// chỗ này chỉ khiến ta gán lại thừa (an toàn), không bao giờ bỏ sót.
// `?? ''` phân biệt được 0 ("0") với undefined ("").
function externalModifierSignature(modifiers: StatModifier[]): string {
  const parts: (string | number)[] = [modifiers.length]

  for (const modifier of modifiers) {
    parts.push(
      modifier.id,
      modifier.sourceId,
      modifier.sourceType,
      modifier.stat,
      modifier.tag ?? '',
      modifier.flat ?? '',
      modifier.percent ?? '',
      modifier.multiplier ?? '',
      modifier.stacks ?? '',
      modifier.maxStacks ?? '',
      modifier.perLevelFlat ?? '',
      modifier.perLevelPercent ?? '',
    )
  }

  return parts.join(SIGNATURE_SEPARATOR)
}

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
    // Dirty-check (perf-optimize-pass Task 5, xem ghi chú đầu file):
    // KHÔNG gán reference mới nếu nội dung y hệt lần gán trước — giữ
    // nguyên object cũ để getter `finalStats` (và mọi computed phái
    // sinh) không invalidate 10 lần/giây khi buff/technique không đổi.
    setExternalModifiers(modifiers: StatModifier[]) {
      const previous = lastExternalModifiers.get(this)

      const signature = externalModifierSignature(modifiers)

      // `previous.applied === this.externalModifiers` bảo đảm chỉ bỏ qua
      // khi state VẪN đang giữ đúng mảng ta gán lần trước — nếu load
      // save/$reset/$patch đã thay mảng khác thì chữ ký cũ vô nghĩa,
      // phải gán lại.
      if (
        previous !== undefined &&
        previous.signature === signature &&
        previous.applied === this.externalModifiers
      ) {
        return
      }

      this.externalModifiers = modifiers

      // Lưu lại ĐÚNG giá trị state trả về (proxy reactive của Pinia),
      // không phải `modifiers` thô, để phép so sánh reference ở trên
      // đúng ở tick sau.
      lastExternalModifiers.set(this, { applied: this.externalModifiers, signature })
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
      // QA-002 idempotency — payload-identity guard (pattern
      // lastExternalModifiers): cùng save gọi lại = no-op (chống
      // double-credit offline cultivation + double Object.assign). Save
      // KHÁC (boot retry/recovery) vẫn áp đầy đủ. Non-reactive, không
      // persist (dev phase — không migration).
      const payloadIdentity = `${save.player.lastSavedAt}|${save.player.cultivation}`
      const previousRestore = lastRestoredPayloads.get(this)

      if (previousRestore !== undefined && previousRestore.identity === payloadIdentity) {
        return previousRestore.offline // elapsed 0 — no-op đúng nghĩa, trả lại kết quả lần trước
      }

      // GameClock là nguồn duy nhất tính thời gian offline.
      // lastSavedAt của save file chính là lastOnlineAt của GameClockState.
      const { offlineSeconds } = calculateOfflineTime({
        lastOnlineAt: save.player.lastSavedAt,
      })

      const offline = calculateOfflineProgress(offlineSeconds, save.player.cultivationPerSecond)

      lastRestoredPayloads.set(this, { identity: payloadIdentity, offline })

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
