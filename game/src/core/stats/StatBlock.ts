import type { StatType } from './StatTypes'

export type Stats = Record<StatType, number>

// Player KHÔNG còn tower tầm bắn vô hạn (combat-gate-teleport-autocast
// plan §2.4 + balance pass 2026-08-26): avatar tấn công dùng Chebyshev
// quanh ô đang đứng. Base range = 5 — khớp trần attackRange quái
// (MAX_ENEMY_ATTACK_RANGE_RANKS = 5): quái dừng bắn xa nhất ở cột 1+5=6,
// Player với tới cột ≤6 nên mọi trận đều có thể chiến thắng. Tâm pháp
// Đại Ngũ Hành Chân Quyết cộng thêm +2 qua Technique.combatModifiers
// (Pháp Tu range nền = 7).
//
// BASELINE THUỘC CODE, không thuộc progression: baseStats.attackRange
// KHÔNG bao giờ được người chơi đầu tư trực tiếp (bonus range chỉ chảy
// qua StatModifier — tâm pháp/trang bị), nên load save CŨ có thể ép về
// đúng baseline này (xem stores/player.ts's restoreFromSave).
export const PLAYER_BASE_RANGE_RANKS = 5

export function createBaseStats(): Stats {
  return {
    attack: 10,
    defense: 5,

    maxHp: 100,
    maxMp: 50,

    attackSpeed: 1,

    // Player là tower cố định, không dùng movementSpeed cho bản thân
    // nữa (xem BattleSystem.resolveMovement()) — vẫn giữ stat này vì
    // enemy dùng chung Stats shape, chỉ enemy còn thật sự di chuyển.
    movementSpeed: 60,

    // Avatar Player tấn công bằng Chebyshev range quanh ô đang đứng
    // (plan §2.3/§2.4) — base 1; enemy dùng chung Stats shape với
    // attackRange đo tới CỘNG CỔNG (canEnemyReachGate).
    attackRange: PLAYER_BASE_RANGE_RANKS,

    criticalRate: 0.05,
    criticalDamage: 1.5,

    // Rating (không còn xác suất 0..1) — đấu với accuracyRating của
    // đối phương qua getHitChance() (xem CombatSystem.ts). Baseline
    // 25 vs accuracyRating mặc định 100 -> ~80% tỉ lệ trúng gốc, gần
    // với cảm giác "95% trúng/5% né" cũ nhưng vẫn để chỗ cho đầu tư
    // thật vào 1 trong 2 phía.
    evasionRate: 5,

    // Tầng Attribute gốc — baseline 1 cho player (2026-08-20, giảm từ
    // 10: ở baseline cũ, trần Phàm Nhân cũng là 10 nên
    // allocateAttributePoint() không có headroom nào để đầu tư — 1 chừa
    // đúng 9 điểm tới trần Phàm Nhân, xem StatCap.ts). Quái mặc định 0
    // qua normalizeEnemyStats(), xem core/enemy/EnemyStatInput.ts.
    strength: 1,
    dexterity: 1,
    intelligence: 1,
    attunement: 1,
    vitality: 1,

    // Cơ chế mới (Last Epoch) — xem core/combat/{Armor,Resistance,
    // Endurance}.ts.
    accuracyRating: 100,
    blockChance: 0,
    blockEffectiveness: 0.25,
    enduranceThreshold: 10,
    endurancePercent: 0.7,
    wardMax: 0,
    wardRegenPerSecond: 0,
    wardBreakDamagePercent: 0,
    manaShieldPercent: 0,
    leechPercent: 0,
    thornsPercent: 0,
    hpRegenPerSecond: 0,
    manaRegenPerSecond: 1,
    cooldownReduction: 0,
    castSpeedPercent: 0,
    finalDamagePercent: 0,
    finalDamageReductionPercent: 0,
    criticalAvoidance: 0,
    chanceToIgnoreResistance: 0,
    ailmentResistPercent: 0,
    ailmentPotencyPercent: 0,
    skillDamagePercent: 0,
    elementApplicationPercent: 0,
    reactionEffectPercent: 0,
    ailmentDurationPercent: 0,
    dotResistancePercent: 0,
    poisonRecoveryPercent: 0,

    // Ngũ hành — mặc định 0, chỉ có giá trị khi được cấp qua
    // StatModifier (equipment/technique/buff...). Xem
    // core/element/ElementStatType.ts. Không còn chu kỳ sinh/khắc —
    // mỗi hành là 1 damage type độc lập kiểu Last Epoch.
    woodPower: 0,
    woodResistance: 0,
    woodPenetration: 0,

    firePower: 0,
    fireResistance: 0,
    firePenetration: 0,

    earthPower: 0,
    earthResistance: 0,
    earthPenetration: 0,

    metalPower: 0,
    metalResistance: 0,
    metalPenetration: 0,

    waterPower: 0,
    waterResistance: 0,
    waterPenetration: 0,

    // Phong/Lôi (Pháp Tu Redesign, magicpath) — cùng shape với Ngũ
    // Hành, mặc định 0. Unlock-gate (Nguyên Anh+) là chuyện của
    // progression (Element unlock), KHÔNG phải chuyện của Stats — quái/
    // player CHƯA unlock vẫn có 2 field này = 0, vô hại.
    windPower: 0,
    windResistance: 0,
    windPenetration: 0,

    lightningPower: 0,
    lightningResistance: 0,
    lightningPenetration: 0,

    // Hỗn Nguyên (Void) — bỏ qua mọi mitigation, không có Resistance/
    // Penetration riêng (xem StatTypes.ts).
    primordialPower: 0,
  }
}
