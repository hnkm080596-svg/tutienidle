import type { AilmentId } from '../ailment/AilmentTypes'
import type { AilmentSystem } from '../ailment/AilmentSystem'
import type { AilmentRegistry } from '../ailment/AilmentRegistry'
import type { CombatEntity } from '../combat/CombatEntity'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'
import type { CombatSystem } from '../combat/CombatSystem'
import type { BuffSystem } from '../buff/BuffSystem'
import type { BuffRegistry } from '../buff/BuffRegistry'
import type { EventBus } from '../events/EventBus'
import type { ElementType } from './ElementType'
import { ELEMENT_REACTIONS } from './ElementReaction'

// Kim Tu ("Thiêu Huyết", Plans/KimPath mục 5, 2026-08-21) — trần TỔNG
// % maxHp 1 target có thể mất qua MỌI lần Reaction "Thiêu Huyết" cộng
// dồn trong 1 trận — số liệu minh hoạ (30%), doc chỉ nói "có giới hạn
// riêng", không chốt số.
const MAX_HP_REDUCTION_CAP_PERCENT = 0.3

/**
 * Combat Rework Phase 6 — không giữ state riêng (bảng phản ứng là dữ
 * liệu tĩnh), chỉ có 1 hành vi: quét ailment ĐANG có trên target ngay
 * sau khi 1 ailment MỚI vừa áp thành công, tìm cặp khớp bảng
 * ELEMENT_REACTIONS rồi kích. Gọi bởi SkillEffectSystem.apply() —
 * KHÔNG sửa AilmentSystem.apply() (giữ nguyên phạm vi, tách biệt 2
 * mối quan tâm: "áp ailment" vs "2 ailment có phản ứng với nhau không").
 */
export class ReactionManager {
  constructor(private readonly eventBus: EventBus) {}

  checkAndTrigger(
    targetAilments: AilmentSystem,
    newAilmentId: AilmentId,
    source: CombatEntity,
    target: CombatEntity,
    combatSystem: CombatSystem,
    // Thổ Tu (Plans/EarthPath, 2026-08-21) — CHỈ cần khi Reaction có
    // appliesAilmentId/appliesBuffId (Dung Nham/Trói Chân/Độc Thế),
    // optional để mọi call site cũ (test/production trước đợt Thổ)
    // không cần sửa gì — không có registry thì các reaction đó rơi về
    // nhánh mặc định (xoá 2 ailment, không sinh hiệu ứng mới) thay vì
    // crash.
    ailmentRegistry?: AilmentRegistry,
    sourceBuffs?: BuffSystem,
    buffRegistry?: BuffRegistry,
    // Plans/magicpathgeneral Phase 12 (2026-08-21) — CHỈ cần khi
    // Reaction có spawnsLavaZone (Dung Nham), optional cùng lý do
    // ailmentRegistry ở trên — không truyền thì reaction đó chỉ áp
    // phần ailment, KHÔNG spawn Lava Zone (không crash).
    spawnLavaZone?: (spec: {
      ownerId: string
      row: number
      column: number
      laneRadius: number
      columnRadius: number
      duration: number
      tickInterval: number
      damagePerTick: number
      element: ElementType | 'physical'
    }) => void,
    // Thiên phú Phản Phác (talent-direction-choice-plan §6) — xác suất giữ
    // lại CẢ 2 ailment ở nhánh consume chuẩn thay vì tiêu, mở đường chain
    // reaction kế tiếp. Nền 0 = hành vi mặc định (xoá cả 2). CHỈ tác động
    // nhánh chuẩn; các nhánh đặc biệt (appliesBuffId/appliesAilmentId/
    // keepsAilmentId) giữ nguyên hành vi.
    reactionKeepChance = 0,
  ) {
    for (const existingId of targetAilments.getActiveIds()) {
      if (existingId === newAilmentId) {
        continue
      }

      const reaction = ELEMENT_REACTIONS[newAilmentId]?.[existingId] ?? ELEMENT_REACTIONS[existingId]?.[newAilmentId]

      if (!reaction) {
        continue
      }

      // True damage — bỏ qua Armor/Resistance, cùng tinh thần Detonate
      // (SkillEffectSystem.ts's consumesAilmentId) vì đây cũng là
      // "cash in" 2 hiệu ứng ĐÃ mitigate sẵn lúc áp ban đầu. Hỏa Tu
      // Trúc Cơ ("Cộng Minh" minor, Plans/FirePath mục 8, 2026-08-21) —
      // reactionEffectPercent khuếch đại baseDamage, nền 0 nên không
      // ảnh hưởng path nào chưa có nguồn cấp.
      //
      // Mộc Tu ("Độc Viêm", Plans/PoisonPath mục 3, 2026-08-21) —
      // percentOfTargetCurrentHp đọc target.currentHp NGAY TẠI ĐÂY
      // (trước khi bị trừ bởi chính lần kích này), cộng dồn với
      // baseDamage rồi mới khuếch đại reactionEffectPercent chung.
      const flatAndPercentDamage =
        reaction.baseDamage + (reaction.percentOfTargetCurrentHp ? target.currentHp * reaction.percentOfTargetCurrentHp : 0)

      const reactionDamage = flatAndPercentDamage * (1 + source.stats.reactionEffectPercent)

      combatSystem.applyModifiedDirectDamage(target, reactionDamage, source, 'reaction')

      // Kim Tu ("Thiêu Huyết", Hỏa+Kim, Plans/KimPath mục 5, 2026-08-21)
      // — trừ vĩnh viễn % maxHp, trần MAX_HP_REDUCTION_CAP_PERCENT CỘNG
      // DỒN qua nhiều lần Reaction (đúng lo ngại doc tự nêu "tránh boss
      // bị xoá HP quá nhanh"). currentHp clamp lại nếu vượt maxHp mới.
      if (reaction.maxHpReductionPercent) {
        const alreadyReduced = target.totalMaxHpReductionPercent ?? 0

        const appliedPercent = Math.min(reaction.maxHpReductionPercent, MAX_HP_REDUCTION_CAP_PERCENT - alreadyReduced)

        if (appliedPercent > 0) {
          target.maxHp = Math.max(1, target.maxHp * (1 - appliedPercent))
          combatSystem.vitals.clampToMaxHp(target, 'reaction', source.id)
          target.totalMaxHpReductionPercent = alreadyReduced + appliedPercent
        }
      }

      if (reaction.appliesBuffId && sourceBuffs && buffRegistry) {
        // Thổ Tu ("Độc Thế" reaction, Thổ+Mộc, Plans/EarthPath mục VII)
        // — 2 ailment bị tiêu như thường, nhưng KHÔNG áp gì lên target
        // — thay vào đó cấp 1 tầng buff self-stack lên chính SOURCE.
        targetAilments.remove(existingId)
        targetAilments.remove(newAilmentId)

        sourceBuffs.apply(buffRegistry.get(reaction.appliesBuffId))
      } else if (reaction.appliesAilmentId && ailmentRegistry) {
        // Thổ Tu ("Dung Nham"/"Trói Chân" reaction, Plans/EarthPath mục
        // V/VI) — 2 ailment bị tiêu sinh ra 1 ailment MỚI trên target
        // (DoT hoặc CC), duration nhân thêm reactionEffectPercent (Định
        // Thổ) — đúng doc mục XIII's ví dụ "Trói Chân 2.5s -> tăng theo
        // Reaction Effect". Ưu tiên nhánh này TRƯỚC water-extend bên
        // dưới — 2 ailment consumed ở đây SINH RA ailment mới, "giữ lại
        // te_cong" không còn ý nghĩa (te_cong đã bị tiêu thành Trói
        // Chân/Dung Nham).
        targetAilments.remove(existingId)
        targetAilments.remove(newAilmentId)

        const template = ailmentRegistry.get(reaction.appliesAilmentId)

        targetAilments.apply(template, source, target, ailmentRegistry)

        if (source.stats.reactionEffectPercent > 0) {
          targetAilments.renewWithExtension(reaction.appliesAilmentId, template.duration * source.stats.reactionEffectPercent)
        }

        // Thổ Tu ("Dung Nham" reaction, Plans/EarthPath mục V — Plans/
        // magicpathgeneral Phase 12) — NGOÀI ailment trên target ở trên,
        // spawn thêm 1 Lava Zone tại VỊ TRÍ target lúc kích hoạt, tồn
        // tại ĐỘC LẬP với target đó sau khi spawn.
        if (reaction.spawnsLavaZone && spawnLavaZone) {
          spawnLavaZone({
            ownerId: source.id,
            row: target.row,
            column: Math.round(target.x),
            ...reaction.spawnsLavaZone,
          })
        }
      } else {
        // Thủy Tu Trúc Cơ Reaction ("Dẫn Lưu" major, Plans/waterpath mục
        // VII, 2026-08-21) — nếu định nghĩa reaction khai
        // `keepsAilmentId` (Plans/magicpathgeneral Phase 5, 2026-08-21 —
        // trước đây hard-code `existingId === 'te_cong'` ở đây, giờ kéo
        // ra thành data trên ElementReactionDefinition) VÀ đúng vế đó
        // đang tham gia reaction VÀ source có waterReactionExtensionSeconds
        // > 0, GIỮ LẠI vế đó (gia hạn thêm N giây, KHÔNG tiêu) thay vì
        // xoá như mặc định — tạo loop "Thủy → Reaction → Thủy vẫn còn →
        // Reaction tiếp". Nền 0/không khai = hành vi mặc định (xoá cả
        // 2, đúng Phase 3's rule "mọi debuff tham gia reaction đều bị
        // consume trừ khi definition chủ động chỉ định").
        const keptAilmentId =
          reaction.keepsAilmentId === existingId ? existingId : reaction.keepsAilmentId === newAilmentId ? newAilmentId : undefined

        const extensionSeconds = getSkillRuntimeStat(source, 'waterReactionExtensionSeconds')
        if (keptAilmentId && extensionSeconds > 0) {
          const otherAilmentId = keptAilmentId === existingId ? newAilmentId : existingId

          targetAilments.remove(otherAilmentId)
          targetAilments.renewWithExtension(keptAilmentId, extensionSeconds)
        } else if (reactionKeepChance > 0 && Math.random() < reactionKeepChance) {
          // Thiên phú Phản Phác (plan §6) — roll trúng thì bỏ qua CẢ HAI
          // remove: ailment tồn tại nguyên vẹn trên target (không mutate,
          // đúng invariant Phase 16), có thể kích reaction tiếp theo.
        } else {
          targetAilments.remove(existingId)
          targetAilments.remove(newAilmentId)
        }
      }

      this.eventBus.emit('reaction', {
        type: 'reaction',
        sourceId: source.id,
        targetId: target.id,
        name: reaction.name,
        damage: reactionDamage,
      })

      combatSystem.killIfDead(target, source.id)

      // 1 ailment mới chỉ kích TỐI ĐA 1 phản ứng — tránh chain phản
      // ứng dây chuyền vô hạn nếu sau này có >2 ailment cùng active.
      return
    }
  }
}
