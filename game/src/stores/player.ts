import { defineStore } from 'pinia'
import { createDefaultPlayer, resolvePlayerFinalStats, type PlayerData } from '../core/player/Player'
import {
  DEFAULT_COMBAT_AI_STRATEGY,
  isCombatAiStrategy,
} from '../core/battle/CombatAiStrategy'
import {
  addCultivation,
  breakthrough as breakthroughSystem,
} from '../core/cultivation/CultivationSystem'

import { calculateOfflineProgress, type OfflineResult } from '../core/idle/OfflineProgressSystem'
import { calculateOfflineTime } from '../core/idle/GameClock'
import { buildGameSave, computeRestoreIdentity, loadGame, type GameSave } from '../services/save/SaveSystem'
import { cloudSaveCoordinator } from '../services/cloudSave/CloudSaveServiceFactory'
import { asBaseStats, createBaseStats } from '@/core/stats/StatBlock'
import {
  migrateStatModifiers,
  migrateStatRecordKeys,
} from '@/core/stats/statKeyMigration'
import type { GameManager } from '@/core/game/GameManager'
import { getRequiredCultivation, BASE_CULTIVATION_PER_SECOND } from '@/core/realm/realmSystem'
import { getCultivationRampMultiplier, getCultivationSpeedMultiplier, getInsightPerCultivation } from '@/core/talent/TalentEffects'
import type { StatModifier } from '@/core/stats/StatCalculator'
import { normalizeArtifactProgress } from '@/core/artifact/ArtifactProgression'
import {
  resolvePlayerVisualProfileId,
  type PlayerVisualProfileId,
} from '@/core/player/PlayerVisualForm'

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
      // stat-system-reimagined review fix: domain decides whether the
      // gate delivers a gated-stat modifier — same-fields-different-
      // domain MUST break the signature or the new grant never lands.
      modifier.domain ?? '',
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
    // ARCH-002 (M7): formula lives in resolvePlayerFinalStats() — the same
    // owner the battle entry path resolves through (post-reset, fresh
    // aggregation instead of this mirror field).
    finalStats(state) {
      return resolvePlayerFinalStats(state, state.externalModifiers)
    },

    // The character's visual form — derived FROM the entity itself
    // (realmId + cultivationPath), one single source. Everywhere the
    // character appears reads from here: PhaserCanvas writes the registry
    // gate for CombatScene/MainScene, TranPhapPanel sends it to the
    // preview scene. Art content (textures/anchors) lives in
    // PLAYER_VISUAL_PROFILES on the presentation side — this is only the id.
    visualProfileId(state): PlayerVisualProfileId {
      return resolvePlayerVisualProfileId({
        realmId: state.realmId,
        cultivationPath: state.cultivationPath,
      })
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
        Math.max(0.01, getCultivationSpeedMultiplier(this.selectedTalentIds)) *
        // M2 — Hau Tich Bat Phat: per-realm-level ramp (neutral 1 when
        // absent). Multiplied into the saved rate so the offline grant
        // (cultivationPerSecond * elapsed) inherits the same curve.
        getCultivationRampMultiplier(this.selectedTalentIds, this.realmLevel)

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
      // technique tier.
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

      // R10 (AR-12): this.$state is a live reactive Pinia proxy —
      // buildGameSave() owns making a detached-value snapshot safe from
      // that (JSON round-trip, not structuredClone, since structuredClone
      // cannot handle Proxy objects at any nesting depth). Callers just
      // pass the state through.
      return cloudSaveCoordinator.save(buildGameSave(this.$state, gameManager))
    },

    // Chỉ merge phần PlayerData vào store — phần còn lại của save
    // (skill/technique/inventory/exploration) trả nguyên trong
    // `save` để App.vue tự gọi gameManager.saveOps.restoreFromSave(), vì
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
      // R10 (AR-12) — payload-identity guard: WHOLE-payload hash (qua
      // computeRestoreIdentity — exclude lastSavedAt), không còn
      // fingerprint 2-field. Cùng save gọi lại = no-op; save KHÁC (dù
      // cùng lastSavedAt|cultivation) áp đầy đủ.
      const payloadIdentity = computeRestoreIdentity(save)
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

      // R10 (AR-12, S4 follow-up) — deep-clone before assigning: a plain
      // Object.assign shallow-copies nested fields (baseStats, modifiers,
      // ...), so this.baseStats becomes the SAME object as
      // save.player.baseStats. A later in-place store mutation then
      // leaked back into the
      // caller's `save` object — corrupting it for any later reuse (the
      // payload-identity guard above included: a second restoreFromSave
      // call with the SAME `save` reference would see a hash that changed
      // out from under it and wrongly treat it as a new payload). A
      // restore input must be treated as a value, same principle as
      // buildGameSave's snapshot-is-a-value fix (S1).
      //
      // M1 (ARCH-001) — the player slice is REPLACE semantics, not merge:
      // overlay the payload onto createDefaultPlayer() so fields the save
      // does not declare reset to defaults instead of keeping the previous
      // session's values, then drop state keys the result does not have
      // (any dynamic $state key outside PlayerData would otherwise survive
      // a restore — a plain assign only overwrites, never removes).
      const clonedPlayer = structuredClone(save.player)

      // Mission A6 — whitelist before the spread: only keys declared by
      // createDefaultPlayer() may enter $state. A foreign key in the
      // payload (hand-edited save, foreign payload) would otherwise be
      // spread onto the store AND re-serialized by every later
      // buildGameSave — self-replicating junk.
      const allowedPlayerKeys = new Set(Object.keys(createDefaultPlayer()))

      for (const key of Object.keys(clonedPlayer)) {
        if (!allowedPlayerKeys.has(key)) {
          Reflect.deleteProperty(clonedPlayer, key)
        }
      }

      // Same whitelist inside baseStats — migrateStatRecordKeys passes
      // unknown keys through, so a foreign stat key would survive onto
      // $state the same way.
      const allowedStatKeys = new Set(Object.keys(createBaseStats()))
      const migratedBaseStats: Record<string, number> = {}

      for (const [key, value] of Object.entries(
        migrateStatRecordKeys(clonedPlayer.baseStats),
      )) {
        if (allowedStatKeys.has(key)) {
          migratedBaseStats[key] = value
        }
      }

      const restoredPlayer: PlayerData = {
        ...createDefaultPlayer(),
        ...clonedPlayer,
        // Stat-key migration (stat-system-reimagined rename pass) —
        // saves written under the old key names (attack/manaRegenPerSecond/
        // speedMultiplier/...) get remapped, retired keys (attackRange/
        // maxMpPercent/manaRegenPercent/poisonRecoveryPercent) drop their
        // stale values, and keys the save never declared fall back to
        // createBaseStats() baselines instead of staying undefined. Set
        // inside the construction literal so the restore writes the
        // record exactly once.
        baseStats: asBaseStats({
          ...createBaseStats(),
          ...migratedBaseStats,
        }),
      }

      // Same rename pass for StatModifier.stat fields persisted on the
      // player slice — legacy equipment/talent/buff modifiers kept the
      // old keys ('attack' & co.) and would stay inert without remap.
      // Modifiers on RETIRED stats (attackRange & co.) drop entirely.
      restoredPlayer.modifiers = migrateStatModifiers(restoredPlayer.modifiers ?? [])
      restoredPlayer.externalModifiers = migrateStatModifiers(
        restoredPlayer.externalModifiers ?? [],
      )
      restoredPlayer.persistentTimedEffects = (restoredPlayer.persistentTimedEffects ?? []).map(
        (effect) => ({
          ...effect,
          modifiers: migrateStatModifiers(effect.modifiers ?? []),
        }),
      )

      for (const key of Object.keys(this.$state)) {
        if (!(key in restoredPlayer)) {
          Reflect.deleteProperty(this.$state, key)
        }
      }

      Object.assign(this, restoredPlayer)

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

      // Route the offline grant through addCultivation() — same
      // clamp-at-required rule as before (the old `+=` then
      // Math.min was a copy of that rule), plus the M2 Hai Nap
      // overflow bank.
      const cultivationBefore = this.cultivation + this.cultivationOvercharge

      addCultivation(this, offline.cultivation)

      const offlineGained =
        this.cultivation + this.cultivationOvercharge - cultivationBefore

      // M2 — Ngo Dao (spec §4.3 row 20): the insight_per_cultivation
      // accumulator settles the offline grant too, through the SAME
      // threshold/counters as the online cultivate() path.
      const offlineInsightThreshold = getInsightPerCultivation(this.selectedTalentIds)

      if (
        offlineInsightThreshold !== undefined &&
        offlineInsightThreshold > 0 &&
        offlineGained > 0
      ) {
        this.cultivationInsightAccumulator += offlineGained

        while (this.cultivationInsightAccumulator >= offlineInsightThreshold) {
          this.cultivationInsightAccumulator -= offlineInsightThreshold
          this.skillInsight += 1
          this.totalSkillInsightGained += 1
        }
      }

      // Bản Mệnh Pháp Bảo (doc §10.2) — sửa mọi invariant sai ngay sau
      // blind Object.assign() ở trên: nghề không khớp, thiếu state dù
      // đủ gate, grade/path sai enum, realm/level/EXP vượt trần.
      normalizeArtifactProgress(this)

      // M1 (ARCH-001) — commit the payload identity only AFTER the whole
      // apply succeeded: a mid-restore throw leaves it uncommitted so a
      // retry with the same payload re-applies instead of being skipped
      // by the guard above.
      lastRestoredPayloads.set(this, { identity: payloadIdentity, offline })

      return offline
    },
  },
})
