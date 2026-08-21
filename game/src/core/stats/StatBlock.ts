import type { StatType } from './StatTypes'

export type Stats = Record<StatType, number>

// Player là tower cố định, tầm bắn "vô hạn" (xa hơn màn hình) — dùng
// số hữu hạn rất lớn thay vì literal Infinity: PlayerData được
// JSON.stringify() khi lưu save, Infinity serialize thành null, sau
// JSON.parse() lại thành null khiến so sánh "distance > attackRange"
// coi như "> 0" — vô hiệu hoá tầm bắn vô hạn ngay sau lần save/load
// đầu tiên (bug âm thầm). Số này lớn hơn nhiều world-scale hiện tại
// (WORLD_VIEW_HALF_WIDTH=300, ENEMY_SPAWN_X=400 — xem BattleLane.ts)
// nên hiệu quả tương đương vô hạn mà vẫn serialize an toàn.
const PLAYER_ATTACK_RANGE_INFINITE = 999999

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

    // Tower defense — player bắn trúng bất kỳ đâu trên sân, không
    // cần quái tới gần trước (xem PLAYER_ATTACK_RANGE_INFINITE).
    attackRange: PLAYER_ATTACK_RANGE_INFINITE,

    criticalRate: 0.05,
    criticalDamage: 1.5,

    // Rating (không còn xác suất 0..1) — đấu với accuracyRating của
    // đối phương qua getHitChance() (xem CombatSystem.ts). Baseline
    // 25 vs accuracyRating mặc định 100 -> ~80% tỉ lệ trúng gốc, gần
    // với cảm giác "95% trúng/5% né" cũ nhưng vẫn để chỗ cho đầu tư
    // thật vào 1 trong 2 phía.
    evasionRate: 25,

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
    criticalAvoidance: 0,
    chanceToIgnoreResistance: 0,
    ailmentResistPercent: 0,
    ailmentPotencyPercent: 0,
    skillDamagePercent: 0,
    projectileSpeedPercent: 0,
    elementApplicationPercent: 0,
    reactionEffectPercent: 0,
    ailmentDurationPercent: 0,
    hoaTheGainPerCast: 0,
    hoaTheDecayReductionPercent: 0,
    thuyThePercent: 0,
    waterReactionExtensionSeconds: 0,
    poisonRootPercentPerStack: 0,
    poisonRootMaxStacks: 0,
    poisonRootThresholdBonusPercent: 0,
    earthAoeRadius: 0,
    earthAoeSecondaryDamagePercent: 0,
    earthKnockbackDistance: 0,
    skillImpactPercent: 0,
    thoTheGainPerCast: 0,
    kimTheGainPerProc: 0,
    kimTheDotDamagePercentPerStack: 0,
    kimTheDotResistancePenetrationPercentPerStack: 0,
    kimTheMaxStacksBonus: 0,
    metalAilmentPotencyPercent: 0,
    huyetPhaGainPerProc: 0,
    huyetPhaBurstDamage: 0,
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
