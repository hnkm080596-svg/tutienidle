import type { SkillEffectType } from  './SkillTypes'
import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'
import type { EffectScope } from '../battle/CombatAction'
import type { ElementType } from '../element/ElementType'

export interface SkillEffect {
  type: SkillEffectType

  /** Default: heal/buff -> source; damage/debuff -> affected_targets. */
  scope?: EffectScope

  value?: number

  duration?: number

  stacks?: number

  buffId?: string

  // Pháp Tu Thuần Hệ (E-3, 2026-09-03) — CHỈ dùng cho effect
  // 'add_stack'/'remove_buff' (trước đây 2 type này là no-op trong
  // SkillEffectSystem, thuộc PassiveSystem). 'add_stack': số tầng cộng
  // thêm lên buff ĐANG CHẠY (mặc định 1; không tạo mới nếu chưa có);
  // 'refresh' = true gia hạn duration các instance vừa cộng.
  // 'remove_buff': 'polarity' lọc theo hướng buff/debuff, 'count' số
  // instance gỡ tối đa (mặc định 1, theo thứ tự pool).
  refresh?: boolean

  polarity?: 'buff' | 'debuff'

  count?: number

  damageType?: 'physical' | 'primordial'

  // Dùng cho effect 'damage' khi skill pha trộn nhiều loại damage
  // (vd 20% Physical + 80% Fire) — có mặt thì thay thế hoàn toàn
  // damageType (xem SkillEffectSystem.ts).
  components?: SkillDamageComponent[]

  // 0..1 — tỉ lệ áp dụng debuff SAU KHI đòn đã trúng, roll ĐỘC LẬP
  // với dodge/crit của damage chính (không mặc định 100%, phải khai
  // rõ trong data skill). Unified Buff System (Task 11, 2026-09-01) —
  // trước đây riêng cho effect 'ailment' (đi cùng ailmentId), giờ dùng
  // chung với effect 'debuff' (đi cùng buffId ở trên).
  ailmentChance?: number

  // Kim Tu Trúc Cơ Pure ("Kim Thế" major, Plans/KimPath mục 9/11,
  // 2026-08-21) — CHỈ dùng cho effect 'debuff'. Khi true VÀ roll
  // ailmentChance THÀNH CÔNG, +source.skillStats.kimTheGainPerProc vào
  // CombatEntity.currentKimThe (0 nếu chưa mua "Kim Thế") — xem
  // SkillEffectSystem.ts's apply(), case 'debuff'. KHÁC hẳn
  // Skill.grantsHoaThePerCast/grantsThoThePerCast (gate theo CAST,
  // không phải theo ROLL THÀNH CÔNG).
  grantsKimThePerProc?: boolean

  // Kim Tu ("Huyết Phá", Plans/magicpathgeneral Phase 13, 2026-08-21)
  // — CÙNG điều kiện/nhánh với grantsKimThePerProc ở trên (roll
  // ailmentChance THÀNH CÔNG), nhưng tích vào CombatEntity.
  // currentHuyetPha thay vì currentKimThe — 2 counter độc lập, 1 skill
  // có thể cấp cả hai cùng lúc. Chạm MAX_HUYET_PHA thì consume/reset +
  // burst damage (xem SkillEffectSystem.ts's apply(), case 'debuff').
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
  consumesAilmentId?: string

  damagePerStack?: number

  // Pháp Tu Thuần Hệ (E-1, 2026-09-03) — CHỈ dùng cho effect 'damage'
  // (Vân Mộc Lan Độc + biến thể). SAU KHI missile resolve, đọc TỔNG
  // stacks của ailment `spreadsAilmentId` trên PRIMARY target, áp lên
  // MỌI target phụ trong cùng action (scope 'affected_targets', trừ
  // primary) qua BuffSystem.apply() — mỗi lần apply = +1 stack theo
  // stackMode của buff, nên số lần apply = ceil(total ×
  // `spreadStackPercent`) (mặc định 1 = 100%). Primary không đổi (trừ
  // khi `spreadRefreshesPrimary` → gia hạn duration primary).
  spreadsAilmentId?: string

  spreadStackPercent?: number

  spreadRefreshesPrimary?: boolean

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

  // Pháp Tu Thuần Hệ (E-4, 2026-09-03) — CHỈ dùng cho effect 'damage'.
  // Bắn SỐ LẦN CỐ ĐỊNH N missile (vd Bát Thuần "8 đợt sóng"), mỗi cái
  // tự roll critical/dodge riêng — cùng tinh thần hitCountByRealm.
  // LOẠI TRỪ NHAU: nếu cả hai đều set, hitCount THẮNG (số tường minh
  // ưu tiên hơn công thức theo cảnh giới) — xem SkillEffectSystem.ts.
  hitCount?: number

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

  /** Bonus multiplier theo Linh Lực tối đa của Pháp Tu. */
  manaScalingRatio?: number

  /** Bonus sát thương phẳng quy đổi thành multiplier theo ATK của source. */
  skillExperienceRatio?: number

  // Combat Rework Phase 3 — CHỈ dùng cho effect 'damage'. Khai hành vi
  // bay Pierce/Bounce/Homing/AOE cho MỌI missile effect này bắn ra
  // (kể cả nhiều missile của hitCountByRealm) — xem
  // undefined = Normal, hành vi giữ nguyên như trước khi có field này.

  // Thổ Tu Pure (Plans/EarthPath mục XVI, 2026-08-21) — CHỈ dùng cho
  // effect 'damage'. Khi true VÀ source.skillStats.earthAoeRadius > 0 (đã
  // từ earthAoeRadius/earthAoeSecondaryDamagePercent/earthKnockbackDistance
  // tiêu như bình thường cho tới khi Pure major mở AOE+Knockback thật.
  earthPureAreaBehavior?: boolean

  // Kiếm Trận keystone (Tam Tài — Task 8, 2026-08-28) — CHỈ dùng cho
  // effect 'damage'. Khi true, SAU KHI missile của effect này bắn xong,
  // spawn 1 SwordZone tại vị trí TARGET (không phải source — vùng kiếm
  // khí tồn tại độc lập sau khi trận đã bày, cùng tinh thần LavaZone),
  // xem SkillEffectSystem.ts + BattleSystem.spawnSwordZone(). Không set
  // = effect 'damage' hoạt động như cũ (chỉ bắn missile thường).
  // Pháp Tu Thuần Hệ (E-5, 2026-09-03) — GIỮ NGUYÊN cho Kiếm Tu, luôn
  // zone 'metal'; grantsZone là bản tổng quát (mọi element) — resolver
  // gộp `grantsSwordZone || grantsZone`.
  grantsSwordZone?: boolean

  // Pháp Tu Thuần Hệ (E-5, 2026-09-03) — CHỈ dùng cho effect 'damage'.
  // Bản tổng quát của grantsSwordZone: spawn 1 zone tại target với
  // element từ `zoneElement` (mặc định 'metal' nếu không khai). Dùng
  // cho Tắt Phương Giông Thổ (fire) / Kiếm Mộc Thông Thiên (wood).
  // Cùng bộ field swordZone* bên dưới (tick/charges/damageRatio).
  grantsZone?: boolean

  zoneElement?: ElementType

  swordZoneCharges?: number
  swordZoneTickInterval?: number
  swordZoneDamageRatio?: number // × finalMultiplier của effect này = damagePerTick
}
