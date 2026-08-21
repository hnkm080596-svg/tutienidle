import type { SkillEffectType } from  './SkillTypes'
import type { SkillDamageComponent } from './SkillDamageComponent'
import type { AilmentId } from '../ailment/AilmentTypes'
import type { StatType } from '../stats/StatTypes'
import type { ProjectileBehavior } from '../combat/missile/Missile'

export interface SkillEffect {
  type: SkillEffectType

  value?: number

  duration?: number

  stacks?: number

  buffId?: string

  damageType?: 'physical' | 'primordial'

  // Dùng cho effect 'damage' khi skill pha trộn nhiều loại damage
  // (vd 20% Physical + 80% Fire) — có mặt thì thay thế hoàn toàn
  // damageType (xem SkillEffectSystem.ts).
  components?: SkillDamageComponent[]

  // Chỉ dùng cho effect type 'ailment' — tra AilmentRegistry theo id
  // này để lấy category/duration/dpsRatio/ccEffect mặc định, cùng
  // pattern effect 'buff'/'debuff' tra BuffRegistry theo buffId.
  ailmentId?: AilmentId

  // 0..1 — tỉ lệ áp dụng ailment SAU KHI đòn đã trúng, roll ĐỘC LẬP
  // với dodge/crit của damage chính (không mặc định 100%, phải khai
  // rõ trong data skill).
  ailmentChance?: number

  // Kim Tu Trúc Cơ Pure ("Kim Thế" major, Plans/KimPath mục 9/11,
  // 2026-08-21) — CHỈ dùng cho effect 'ailment'. Khi true VÀ roll
  // ailmentChance THÀNH CÔNG, +source.stats.kimTheGainPerProc vào
  // CombatEntity.currentKimThe (0 nếu chưa mua "Kim Thế") — xem
  // SkillEffectSystem.ts's apply(), case 'ailment'. KHÁC hẳn
  // Skill.grantsHoaThePerCast/grantsThoThePerCast (gate theo CAST,
  // không phải theo ROLL THÀNH CÔNG).
  grantsKimThePerProc?: boolean

  // Kim Tu ("Huyết Phá", Plans/magicpathgeneral Phase 13, 2026-08-21)
  // — CÙNG điều kiện/nhánh với grantsKimThePerProc ở trên (roll
  // ailmentChance THÀNH CÔNG), nhưng tích vào CombatEntity.
  // currentHuyetPha thay vì currentKimThe — 2 counter độc lập, 1 skill
  // có thể cấp cả hai cùng lúc. Chạm MAX_HUYET_PHA thì consume/reset +
  // burst damage (xem SkillEffectSystem.ts's apply(), case 'ailment').
  grantsHuyetPhaPerProc?: boolean

  // Chỉ dùng cho effect 'damage' — hệ số scale multiplier theo
  // attribute của SOURCE lúc cast, cộng dồn qua nhiều entry. 1 phần
  // tử trong `attributes` = coefficient thường (vd Linh Căn cho
  // skill hệ pháp thuật); NHIỀU phần tử = "Adaptive" kiểu Last Epoch
  // (dùng giá trị CAO NHẤT trong nhóm) — xem SkillEffectSystem.ts.
  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]

  // Pháp Tu Detonate (vd Bạo Viêm "cash in" stack Bỏng) — CHỈ dùng cho
  // effect 'damage'. Nếu target đang có ailment này, gây bonus damage
  // = stacks × damagePerStack (true damage, KHÔNG qua Armor/Resistance
  // — cùng tinh thần primordialPower "bỏ qua mitigation") RỒI xoá hẳn
  // ailment đó khỏi target — đổi DOT đang chạy lấy 1 cục burst ngay,
  // xem SkillEffectSystem.ts. Không set = effect 'damage' hoạt động
  // như cũ (chỉ bắn missile thường).
  consumesAilmentId?: AilmentId

  damagePerStack?: number

  // Pháp Tu Lifedrain (Mộc Tu) — CHỈ có ý nghĩa cùng consumesAilmentId/
  // damagePerStack. Hồi máu cho SOURCE = healPercentOfDamage × bonus
  // damage Detonate vừa gây. Tách riêng khỏi leechPercent toàn cục vì
  // nhánh Detonate đi thẳng currentHp (không qua missile/CombatSystem's
  // leech pipeline) — leechPercent KHÔNG tự áp dụng cho true damage này.
  healPercentOfDamage?: number

  // Pháp Tu (Thổ Tu, 2026-08-15) — "tự nổ khiên": CHỈ dùng cho effect
  // 'damage'. Tiêu thụ TOÀN BỘ currentWard của SOURCE (không phải
  // target) cho 1 cục true damage bonus = currentWard × damagePerWardPoint
  // (bỏ qua Armor/Resistance, cùng tinh thần consumesAilmentId), rồi
  // xoá sạch currentWard về 0. Không set = effect 'damage' hoạt động
  // như cũ. Xem SkillEffectSystem.ts.
  consumesWardForDamage?: boolean

  damagePerWardPoint?: number

  // Kiếm Tu (Ngự Kiếm Thuật, 2026-08-15) — CHỈ dùng cho effect
  // 'damage'. Bắn (source.realmIndex + 1) missile liên tiếp thay vì
  // 1, mỗi cái tự roll critical/dodge riêng — xem SkillEffectSystem.ts.
  hitCountByRealm?: boolean

  // Kiếm Tu (Kiếm Khai Thiên Môn, 2026-08-15) — "dựa vào số Kiếm Ý
  // đang có": cộng thêm ratioPerPoint × currentSwordIntent (CHỈ ĐỌC,
  // không tiêu Kiếm Ý — khác Vạn Kiếm Triều Tông's `cost`) vào
  // scalingBonus, cùng chỗ attributeScaling. Số nhỏ vì currentSwordIntent
  // có thể lên tới 9999 (xem CombatTypes.ts's MAX_SWORD_INTENT).
  swordIntentDamageRatio?: number

  // Kiếm Tu (Kiếm Khai Thiên Môn, 2026-08-15) — "cảnh giới càng cao
  // sát thương càng lớn": cộng thêm ratio × source.realmIndex (0-based,
  // 9 đại cảnh giới) vào scalingBonus.
  realmDamageRatio?: number

  // Combat Rework Phase 3 — CHỈ dùng cho effect 'damage'. Khai hành vi
  // bay Pierce/Bounce/Homing/AOE cho MỌI missile effect này bắn ra
  // (kể cả nhiều missile của hitCountByRealm) — xem
  // core/combat/missile/Missile.ts's ProjectileBehavior, SkillEffectSystem.ts.
  // undefined = Normal, hành vi giữ nguyên như trước khi có field này.
  projectileBehavior?: ProjectileBehavior

  // Thổ Tu Pure (Plans/EarthPath mục XVI, 2026-08-21) — CHỈ dùng cho
  // effect 'damage'. Khi true VÀ source.stats.earthAoeRadius > 0 (đã
  // mua Major "Thổ Thế"), SkillEffectSystem tự build 1 ProjectileBehavior
  // từ earthAoeRadius/earthAoeSecondaryDamagePercent/earthKnockbackDistance
  // GHI ĐÈ `projectileBehavior` tĩnh ở trên — Thổ Cầu Thuật bắn đơn mục
  // tiêu như bình thường cho tới khi Pure major mở AOE+Knockback thật.
  // Không set/earthAoeRadius=0 = dùng projectileBehavior tĩnh như cũ.
  earthPureProjectileBehavior?: boolean
}
