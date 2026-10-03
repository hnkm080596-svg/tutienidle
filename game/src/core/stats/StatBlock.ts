import type { StatType } from './StatTypes'

export type Stats = Record<StatType, number>

// R14 (AR-02/AR-05, type-level half) - nominal marker for RAW authored
// base stats (createBaseStats output, PlayerData.baseStats). The phantom
// brand makes `calculateStats(baseStats)` reject resolved `Stats`
// values: feeding an already-derived snapshot back into the derivation
// pipeline (the R2 double-derivation regression class) no longer
// compiles without an explicit `asBaseStats` boundary cast. Type-only:
// zero runtime cost, save payloads unchanged. CombatEntity.baseStats
// intentionally stays plain `Stats` - it holds the resolved-at-entry
// snapshot (the combat base), not authored raw input.
declare const baseStatsBrand: unique symbol

export type BaseStats = Stats & { readonly [baseStatsBrand]: 'base' }

/**
 * Boundary cast for values that are KNOWN to be raw base stats but
 * arrive through a plain `Stats` channel (authored data, save payloads,
 * fixture overrides). Naming the seam keeps accidental resolved-stat
 * reuse from compiling.
 */
export function asBaseStats(stats: Stats): BaseStats {
  return stats as BaseStats
}

// stat-system-reimagined Task 3 (D16) -- attackRange / PLAYER_BASE_RANGE_RANKS
// retired: reach is a skill/action-targeting concern, not a character
// stat. The old teleport-autocast battle path that consumed them is
// dormant; the live turn engine resolves reach from action targeting.
export function createBaseStats(overrides: Partial<Stats> = {}): BaseStats {
  return {
    might: 10,
    defense: 5,

    maxHp: 100,
    maxMp: 0,

    // Turn-based conversion (2026-09-04) - nen 100, ATB gauge-fill-rate
    // stat (ActionGauge.advanceGauge() doc truc tiep). Neo gia tri 100
    // theo quy uoc SPD cua Honkai: Star Rail (baseline ~100-115) - chi
    // la chon don vi de doc, GAUGE_MAX=1000 khong quan tam do lon tuyet
    // doi, chi quan tam ti le speed giua cac actor.
    speed: 100,

    criticalRate: 0.05,
    criticalDamage: 1.5,

    // Rating (khong con xac suat 0..1) - dau voi accuracyRating cua
    // doi phuong qua getHitChance() (xem CombatSystem.ts). Baseline
    // 25 vs accuracyRating mac dinh 100 -> ~80% ti le trung goc, gan
    // voi cam giac "95% trung/5% ne" cu nhung van de cho cho dau tu
    // that vao 1 trong 2 phia.
    evasionRate: 5,

    // Tang Attribute goc - baseline 1 cho player (2026-08-20, giam tu
    // 10: o baseline cu, tran Pham Nhan cung la 10 nen
    // allocateAttributePoint() khong co headroom nao de dau tu - 1 chua
    // dung 9 diem toi tran Pham Nhan, xem StatCap.ts). Quai mac dinh 0
    // qua normalizeEnemyStats(), xem core/enemy/EnemyStatInput.ts.
    strength: 1,
    dexterity: 1,
    intelligence: 1,
    attunement: 1,
    vitality: 1,

    // Co che moi (Last Epoch) - xem core/combat/{Armor,Resistance,
    // Endurance}.ts.
    accuracyRating: 100,
    // Block (2026-09-01, T5.5): base 5% - doi xung 2 chieu voi enemy (elite
    // author duoc block qua special; player nhan base + affix boots/armor
    // + sau nay The Tu skill). Soft cap 0.75 trong StatMetadata chan nguon
    // cong don; HARD cap 0.90 ap tai rollBlock (buff tam khong vuot).
    blockChance: 0.05,
    blockEffectiveness: 0.25,
    enduranceThreshold: 10,
    endurancePercent: 0.7,
    wardMax: 0,
    wardRegenPerTurn: 0,
    wardBreakDamagePercent: 0,
    manaShieldPercent: 0,
    linhLucHoTheCap: 0,
    leechPercent: 0,
    // generic thorns stat retired (spec 2026-09-15 T12).
    healingEffectivenessPercent: 0,
    hpRegenPerTurn: 0,
    manaRegenPerTurn: 0,
    finalDamagePercent: 0,
    finalDamageReductionPercent: 0,
    criticalAvoidance: 0,
    chanceToIgnoreResistance: 0,
    ailmentResistPercent: 0,
    ailmentPotencyPercent: 0,
    // The Tu An reactive chances (spec 2026-09-15 section 3.2) - base 0;
    // the only source is the hidden_body attribute->chance emission.
    counterChance: 0,
    protectChance: 0,
    followUpChance: 0,
    skillDamagePercent: 0,
    elementApplicationPercent: 0,
    reactionEffectPercent: 0,
    ailmentDurationPercent: 0,
    dotResistancePercent: 0,

    // Realm passive stat modifier (useRealmStatPassives).
    realmPassivePercent: 0,
    // Equipment enhancement delta % (EquipmentHallPanel).
    affixDeltaPercent: 0,
    // Production speed multiplier.
    productionSpeedMultiplier: 1,
    // Artifact grade multiplier.
    artifactGradeMultiplier: 1,
    // Pill cultivation percent.
    cultivationPercent: 0,

    // Ngu hanh - mac dinh 0, chi co gia tri khi duoc cap qua
    // StatModifier (equipment/technique/buff...). Xem
    // core/element/ElementStatType.ts. Khong con chu ky sinh/khac -
    // moi hanh la 1 damage type doc lap kieu Last Epoch.
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

    // Spec 2026-08-30-phap-tu-dao-sac sec5 - Phong/Loi (wind/lightning
    // Power/Resistance/Penetration) da bi XOA khoi Stats: 0 skill/0
    // node/0 reaction tung ton tai nen day toan stat chet, khong giu
    // baseline 0 vo nghia.

    // Hon Nguyen (Void) - bo qua moi mitigation, khong co Resistance/
    // Penetration rieng (xem StatTypes.ts).
    primordialPower: 0,

    ...overrides,
  } as BaseStats
}
