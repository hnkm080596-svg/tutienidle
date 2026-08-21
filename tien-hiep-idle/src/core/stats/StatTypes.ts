import type { ElementStatType } from '../element/ElementStatType'

export type StatType =
  // Core — bỏ magicAttack/magicDefense (gộp vào tổng hợp 5 hành, xem
  // ElementDamageCalculator.ts — không còn skill/enemy nào dùng damage
  // type 'magic' riêng nữa).
  | 'attack'
  | 'defense'
  | 'maxHp'
  | 'maxMp'
  | 'attackSpeed'
  | 'movementSpeed'
  | 'attackRange'
  | 'criticalRate'
  | 'criticalDamage'
  // Đổi ý nghĩa từ xác suất (0..1) sang LE-style Rating (số mở, đấu
  // với attackerRating qua getHitChance() — xem CombatSystem.ts).
  | 'evasionRate'

  // Tầng Attribute gốc — dẫn xuất ra các stat phái sinh qua
  // deriveAttributeModifiers() trong StatCalculator.ts, không phải
  // build point-allocation riêng — nhận modifier qua ĐÚNG pipeline
  // hiện có (equipment/technique/buff/pill) như mọi stat khác.
  | 'strength'      // Căn Cốt
  | 'dexterity'      // Thân Pháp
  | 'intelligence'    // Thần Thức
  | 'attunement'     // Linh Căn
  | 'vitality'       // Thể Chất

  // Cơ chế mới theo Last Epoch (Armor/Ward/Endurance/Block/Accuracy/
  // Leech/Thorns — xem core/combat/{Armor,Resistance,Endurance}.ts và
  // CombatSystem.resolveHit()).
  | 'accuracyRating'
  | 'blockChance'
  | 'blockEffectiveness'
  | 'enduranceThreshold'
  | 'endurancePercent'
  | 'wardMax'
  | 'wardRegenPerSecond'
  // Pháp Tu (Thổ Tu, 2026-08-15) — % wardMax phản thành damage vào
  // NGUỒN khi Hộ Thuẫn của mình vừa vỡ hẳn (currentWard chạm 0), xem
  // CombatSystem.ts's resolveAttack(). Tách khỏi thornsPercent (đó là
  // % theo damage NHẬN vào, cái này % theo DUNG LƯỢNG khiên).
  | 'wardBreakDamagePercent'
  // Pháp Tu Redesign (magicpath) — Mana Shield: % sát thương (SAU Ward,
  // TRƯỚC HP) được đẩy sang mana thay vì máu, quy đổi 1:1 — xem
  // CombatSystem.resolveAttack(). Khác Ward: không phải pool riêng,
  // dùng THẲNG currentMp đang có (đánh đổi tài nguyên cast skill lấy
  // sinh tồn — đúng tinh thần "linh lực giảm sát thương").
  | 'manaShieldPercent'
  | 'leechPercent'
  | 'thornsPercent'
  | 'hpRegenPerSecond'
  | 'manaRegenPerSecond'
  | 'cooldownReduction'
  // Cast Time (2026-08-21) — % rút ngắn Cast Time hiệu lực của skill có
  // Skill.castTime > 0 (xem BattleSystem.updateCasting()), TÁCH KHỎI
  // attackSpeed/cooldownReduction hoàn toàn (Cast Time là khoảng "niệm"
  // TRƯỚC khi hiệu ứng thi triển, Cooldown là khoảng CHỜ SAU khi đã thi
  // triển — 2 khái niệm độc lập). Cùng công thức nhân với
  // cooldownReduction (effectiveDelta = deltaSeconds * (1 + percent)).
  // Nền 0 — chưa skill/node nào cấp field này.
  | 'castSpeedPercent'
  | 'criticalAvoidance'
  | 'chanceToIgnoreResistance'
  | 'ailmentResistPercent'
  | 'ailmentPotencyPercent'
  // Kiếm Tu (2026-08-15) — % khuếch đại TOÀN BỘ effect 'damage' của
  // skill chủ động (không phải đòn đánh thường), xem SkillEffectSystem.
  // ts's finalMultiplier. Nguồn duy nhất hiện tại: Kiếm Ý vĩnh viễn
  // (tích luỹ theo linh lực tu luyện, xem core/player/SwordIntentSystem.ts).
  | 'skillDamagePercent'
  // Hỏa Tu (Plans/FirePath, "Tật Hỏa" minor, 2026-08-21) — % cộng
  // thêm vào MISSILE_SPEED cố định (xem
  // core/combat/missile/MissileSystem.ts's fire()). Nền 0, không ảnh
  // hưởng path/hành nào chưa có nguồn cấp.
  | 'projectileSpeedPercent'
  // Hỏa Tu Trúc Cơ (Plans/FirePath mục 6/8, 2026-08-21) — cộng THẲNG
  // vào effect.ailmentChance lúc roll áp ailment (xem
  // SkillEffectSystem.ts's apply(), case 'ailment'), clamp tối đa 1.
  // Nền 0 — Hỏa Cầu Thuật Luyện Khí có ailmentChance gốc < 1 (KHÔNG
  // còn luôn luôn áp Thiêu Đốt), node "Dẫn Hỏa"/"Hỏa Nguyên" cộng
  // thêm % này.
  | 'elementApplicationPercent'
  // Hỏa Tu Trúc Cơ (Plans/FirePath mục 8, "Cộng Minh" minor) — %
  // khuếch đại reaction.baseDamage lúc Reaction kích hoạt (xem
  // core/element/ReactionManager.ts's checkAndTrigger()). Nền 0.
  | 'reactionEffectPercent'
  // Mộc Tu (Plans/PoisonPath, 2026-08-21) — % cộng thêm vào duration
  // của MỌI ailment nguồn này áp ra (xem AilmentSystem.apply()), tổng
  // quát cùng tinh thần ailmentPotencyPercent (đó là % sát thương/giây,
  // đây là % thời lượng). Nền 0 — Độc Tức là nguồn cấp đầu tiên.
  | 'ailmentDurationPercent'
  // Skill rework (2026-08-21) — 19 field "Thế tài nguyên" (Hỏa Thế/Thủy
  // Thế/Mộc Thế/Thổ Thế/Kim Thế/Huyết Phá). Số GỐC sống trên object Skill
  // (xem Skill.ts's SkillResourceStatKey — Node Tree ghi trực tiếp vào
  // đó, GameManager.purchaseNode()), NHƯNG combat vẫn đọc qua field
  // CombatEntity.stats bên dưới như mọi stat khác — SkillSystem.
  // getSkillResourceStatModifiers() (xem SkillSystem.ts) đồng bộ giá trị
  // từ Skill thành StatModifier (sourceType 'skill') mỗi lần
  // GameManager.getAggregatedModifiers() chạy, CÙNG pipeline với
  // getScaledPassiveModifiers(). Field-level comment đã dời hẳn sang
  // Skill.ts (nguồn gốc thật) — ở đây chỉ còn danh sách tên field cho
  // CombatEntity.stats/Stats union.
  | 'hoaTheGainPerCast'
  | 'hoaTheDecayReductionPercent'
  | 'thuyThePercent'
  | 'waterReactionExtensionSeconds'
  | 'poisonRootPercentPerStack'
  | 'poisonRootMaxStacks'
  | 'poisonRootThresholdBonusPercent'
  | 'earthAoeRadius'
  | 'earthAoeSecondaryDamagePercent'
  | 'earthKnockbackDistance'
  | 'skillImpactPercent'
  | 'thoTheGainPerCast'
  | 'kimTheGainPerProc'
  | 'kimTheDotDamagePercentPerStack'
  | 'kimTheDotResistancePenetrationPercentPerStack'
  | 'kimTheMaxStacksBonus'
  | 'metalAilmentPotencyPercent'
  | 'huyetPhaGainPerProc'
  | 'huyetPhaBurstDamage'

  // Plans/magicpathgeneral Phase 9 (2026-08-21) — DOT RES: giảm THẲNG %
  // damage nhận từ MỌI tick DoT (Bỏng/Trúng Độc/Chảy Máu/Tê Cóng/Tê
  // Điện/Hoại Tử/Dung Nham/Huyết Độc/Vạn Kiếm Vũ...), xem
  // CombatSystem.applyDotDamage() — tái dùng chung công thức/trần
  // với Resistance.ts's getResistanceMitigationPercent() (resistance -
  // penetration, trần ±). KHÔNG ảnh hưởng duration/tỉ lệ áp/stack/tick
  // rate của ailment (đúng yêu cầu "Không ảnh hưởng: duration,
  // application chance, stack, tick rate" — DOT RES CHỈ đứng giữa raw
  // damage và final damage). Nền 0.
  | 'dotResistancePercent'
  // Plans/magicpathgeneral Phase 11 (2026-08-21) — Poison Recovery:
  // khi 1 tick DoT element 'wood' (Trúng Độc) gây damage, hồi lại %
  // này của damage THẬT SỰ đã trừ (SAU dotResistancePercent) về HP
  // NGUỒN đã gây ra DoT đó — xem CombatSystem.applyDotDamage().
  // Nguồn cấp đầu tiên: buff "Độc Căn" (Thổ+Mộc Reaction Reward, xem
  // data/buff/buffs.ts — hoàn thành phần "+2% HP Recovery từ Poison
  // Damage"/tầng từng bị hoãn ở PoisonPath/EarthPath vì DoT tick trước
  // đây chưa resolve được entity NGUỒN). Nền 0.
  | 'poisonRecoveryPercent'

  // Ngũ hành — GIỮ NGUYÊN field code (wood/fire/earth/metal/water),
  // chỉ đổi Ý NGHĨA: không còn chu kỳ sinh/khắc, mỗi hành là 1 damage
  // type độc lập kiểu Last Epoch (xem ElementDamageCalculator.ts).
  | ElementStatType

  // Hỗn Nguyên (Void) — damage type mới, gây sát thương CHUẨN (bỏ qua
  // Armor/Resistance hoàn toàn), thay thế hẳn DamageType 'true' cũ.
  | 'primordialPower'

// PLAN HOÀN CHỈNH mục 2/3 — 5 Main Stat người chơi tự phân phối điểm
// vào (xem GameManager.allocateAttributePoint()), tách khỏi StatType
// đầy đủ chỉ để có 1 union hẹp cho tham số/UI, KHÔNG tạo field mới —
// vẫn CHÍNH 5 field 'attribute' category đã có sẵn ở trên.
export type MainStatKey = 'strength' | 'dexterity' | 'intelligence' | 'attunement' | 'vitality'

export const MAIN_STAT_KEYS: MainStatKey[] = ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality']
