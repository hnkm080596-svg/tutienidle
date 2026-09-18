import type { ElementStatType } from '../element/ElementStatType'

export type StatType =
  // Core — bỏ magicAttack/magicDefense (gộp vào tổng hợp 5 hành, xem
  // ElementDamageCalculator.ts — không còn skill/enemy nào dùng damage
  // type 'magic' riêng nữa).
  | 'might'
  | 'defense'
  | 'maxHp'
  | 'maxMp'
  | 'speed'
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
  | 'wardRegenPerTurn'
  // Pháp Tu (Thổ Tu, 2026-08-15) — % wardMax phản thành damage vào
  // NGUỒN khi Hộ Thuẫn của mình vừa vỡ hẳn (currentWard chạm 0), xem
  // CombatSystem.ts's resolveAttack(). Tính theo DUNG LƯỢNG khiên tối
  // đa, KHÔNG theo damage nhận vào (generic thorns stat đã gỡ — T12).
  | 'wardBreakDamagePercent'
  // Pháp Tu Redesign (magicpath) — Mana Shield: % sát thương (SAU Ward,
  // TRƯỚC HP) được đẩy sang mana thay vì máu, quy đổi 1:1 — xem
  // CombatSystem.resolveAttack(). Khác Ward: không phải pool riêng,
  // dùng THẲNG currentMp đang có (đánh đổi tài nguyên cast skill lấy
  // sinh tồn — đúng tinh thần "linh lực giảm sát thương").
  | 'manaShieldPercent'
  | 'leechPercent'
  // The Tu Reimagined (spec 2026-09-15 T12) — generic thorns stat retired;
  // reflection is a the_tu mechanic (phan_chinh), not a stat.
  // stat-system-reimagined Task 4 (D18) -- receiver-side amplification of
  // HP restores that are NOT damage-derived: hpRegenPerTurn ticks, direct
  // heal effects, authored recovery triggers (dotRecovery). NEVER scales
  // leech (hpDamage * leechPercent is leech's sole lever), ward/MP regen,
  // or shield absorb.
  | 'healingEffectivenessPercent'
  | 'hpRegenPerTurn'
  | 'manaRegenPerTurn'
  // The Tu An (spec 2026-09-15 T4/section 3.2) — reactive chance stats,
  // the_tu_an-gated. Derived ONLY from attributes via the two-channel
  // emission (CultivationPathSystem); INV-13 forbids authored modifiers.
  // Stored RAW (may exceed REACTIVE_CHANCE_CAP) — cap applies at the
  // roll/display site via clampStatValue, never inside the pipeline.
  | 'counterChance'
  | 'protectChance'
  | 'followUpChance'
  | 'finalDamagePercent'
  | 'finalDamageReductionPercent'
  | 'criticalAvoidance'
  | 'chanceToIgnoreResistance'
  | 'ailmentResistPercent'
  | 'ailmentPotencyPercent'
  // Kiem Tu (2026-08-15) - % amplification of ALL 'damage' effects of
  // active skills (not basic attacks), see finalMultiplier in the
  // damage pipeline. Sources: node/talent/equipment.
  | 'skillDamagePercent'
  // Hỏa Tu (Plans/FirePath, "Tật Hỏa" minor, 2026-08-21) — % cộng
  // thêm vào tốc độ đạn bay (MissileSystem cũ đã xóa; combat hiện dùng
  // ActionImpactSystem). Nền 0, không ảnh
  // hưởng path/hành nào chưa có nguồn cấp.
  // Hỏa Tu Trúc Cơ (Plans/FirePath mục 6/8, 2026-08-21) — cộng THẲNG
  // vào effect.ailmentChance lúc roll áp ailment (xem
  // resolveAilmentApplicationChance), clamped to 1 max.
  // Nền 0 — Hỏa Cầu Thuật Luyện Khí có ailmentChance gốc < 1 (KHÔNG
  // còn luôn luôn áp Thiêu Đốt), node "Dẫn Hỏa"/"Hỏa Nguyên" cộng
  // thêm % này.
  | 'elementApplicationPercent'
  // Hỏa Tu Trúc Cơ (Plans/FirePath mục 8, "Cộng Minh" minor) — %
  // khuếch đại burst damage lúc Reaction kích hoạt. Nền 0.
  | 'reactionEffectPercent'
  // Mộc Tu (Plans/PoisonPath, 2026-08-21) — % cộng thêm vào duration
  // của MỌI ailment nguồn này áp ra (xem AilmentSystem.apply()), tổng
  // quát cùng tinh thần ailmentPotencyPercent (đó là % sát thương/giây,
  // đây là % thời lượng). Nền 0 — Độc Tức là nguồn cấp đầu tiên.
  | 'ailmentDurationPercent'
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
  // stat-system-reimagined Task 3 (D16/D17) -- poisonRecoveryPercent,
  // maxMpPercent and manaRegenPercent retired: poison recovery becomes a
  // buff-effect trigger read (dotRecoveryTriggers, CombatSystem), and
  // MP % grants are plain percent modifiers on maxMp/manaRegenPerTurn.

  // Realm passive stat modifiers.
  | 'realmPassivePercent'
  // Equipment enhancement delta (percent change per affix row).
  | 'affixDeltaPercent'
  // Production speed multiplier.
  | 'productionSpeedMultiplier'
  // Artifact grade multiplier.
  | 'artifactGradeMultiplier'
  // Pill cultivation percent (relative to realm tier requirement).
  | 'cultivationPercent'

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
