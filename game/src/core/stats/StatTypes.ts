import type { ElementStatType } from '../element/ElementStatType'

export type StatType =
  // Core - bo magicAttack/magicDefense (gop vao tong hop 5 hanh, xem
  // ElementDamageCalculator.ts - khong con skill/enemy nao dung damage
  // type 'magic' rieng nua).
  | 'might'
  | 'defense'
  | 'maxHp'
  | 'maxMp'
  | 'speed'
  | 'criticalRate'
  | 'criticalDamage'
  // Doi y nghia tu xac suat (0..1) sang LE-style Rating (so mo, dau
  // voi attackerRating qua getHitChance() - xem CombatSystem.ts).
  | 'evasionRate'

  // Tang Attribute goc - dan xuat ra cac stat phai sinh qua
  // deriveAttributeModifiers() trong StatCalculator.ts, khong phai
  // build point-allocation rieng - nhan modifier qua DUNG pipeline
  // hien co (equipment/technique/buff/pill) nhu moi stat khac.
  | 'strength'      // Can Cot
  | 'dexterity'      // Than Phap
  | 'intelligence'    // Than Thuc
  | 'attunement'     // Linh Can
  | 'vitality'       // The Chat

  // Co che moi theo Last Epoch (Armor/Ward/Endurance/Block/Accuracy/
  // Leech/Thorns - xem core/combat/{Armor,Resistance,Endurance}.ts va
  // CombatSystem.resolveHit()).
  | 'accuracyRating'
  | 'blockChance'
  | 'blockEffectiveness'
  | 'enduranceThreshold'
  | 'endurancePercent'
  | 'wardMax'
  | 'wardRegenPerTurn'
  // Phap Tu (Tho Tu, 2026-08-15) - % wardMax phan thanh damage vao
  // NGUON khi Ho Thuan cua minh vua vo han (currentWard cham 0), xem
  // CombatSystem.ts's resolveAttack(). Tinh theo DUNG LUONG khien toi
  // da, KHONG theo damage nhan vao (generic thorns stat da go - T12).
  | 'wardBreakDamagePercent'
  // Phap Tu Redesign (magicpath) - Mana Shield: % sat thuong (SAU Ward,
  // TRUOC HP) duoc day sang mana thay vi mau, quy doi 1:1 - xem
  // CombatSystem.resolveAttack(). Khac Ward: khong phai pool rieng,
  // dung THANG currentMp dang co (danh doi tai nguyen cast skill lay
  // sinh ton - dung tinh than "linh luc giam sat thuong").
  | 'manaShieldPercent'
  // Phap Tu Reimagined (spec D9) - Linh Luc Ho The: DR CAP on hostile
  // direct hits, scaled by the LIVE LL ratio (currentMp / maxMp) at hit
  // resolution - LL = 0 => DR = 0; costs no extra LL. Only the
  // hit-resolving lane (resolveAttack) reads it: DoT / reaction / flat
  // profiles bypass by construction (F11).
  | 'linhLucHoTheCap'
  | 'leechPercent'
  // The Tu Reimagined (spec 2026-09-15 T12) - generic thorns stat retired;
  // reflection is a body mechanic (phan_chan), not a stat.
  // stat-system-reimagined Task 4 (D18) -- receiver-side amplification of
  // HP restores that are NOT damage-derived: hpRegenPerTurn ticks, direct
  // heal effects, authored recovery triggers (dotRecovery). NEVER scales
  // leech (hpDamage * leechPercent is leech's sole lever), ward/MP regen,
  // or shield absorb.
  | 'healingEffectivenessPercent'
  | 'hpRegenPerTurn'
  | 'manaRegenPerTurn'
  // The Tu An (spec 2026-09-15 T4/section 3.2) - reactive chance stats,
  // hidden_body-gated. Derived ONLY from attributes via the two-channel
  // emission (CultivationPathSystem); INV-13 forbids authored modifiers.
  // Stored RAW (may exceed REACTIVE_CHANCE_CAP) - cap applies at the
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
  // Hoa Tu (Plans/FirePath, "Tat Hoa" minor, 2026-08-21) - % cong
  // them vao toc do dan bay (MissileSystem cu da xoa; combat hien dung
  // ActionImpactSystem). Baseline 0; does not affect
  // paths/elements without an authored source.
  // Fire-pathway Truc Co (Plans/FirePath items 6/8, 2026-08-21): multiplied
  // into effect.ailmentChance at ailment roll: chance = baseChance x
  // (1 + elementApplicationPercent) in ApplicationResolver.resolve,
  // clamped to 1 max. Baseline 0 -- Hoa Cau Thuat at Luyen Khi has raw
  // ailmentChance < 1 (Thieu Dot is NOT always applied); the diem_chuan
  // node of the basic lane and the old "Dan Hoa"/"Hoa Nguyen" nodes all
  // feed through this channel.
  | 'elementApplicationPercent'
  // Hoa Tu Truc Co (Plans/FirePath muc 8, "Cong Minh" minor) - %
  // khuech dai burst damage luc Reaction kich hoat. Nen 0.
  | 'reactionEffectPercent'
  // Moc Tu (Plans/PoisonPath, 2026-08-21) - % cong them vao duration
  // cua MOI ailment nguon nay ap ra (xem AilmentSystem.apply()), tong
  // quat cung tinh than ailmentPotencyPercent (do la % sat thuong/giay,
  // day la % thoi luong). Nen 0 - Doc Tuc la nguon cap dau tien.
  | 'ailmentDurationPercent'
  // Plans/magicpathgeneral Phase 9 (2026-08-21) - DOT RES: giam THANG %
  // damage nhan tu MOI tick DoT (Bong/Trung Doc/Chay Mau/Te Cong/Te
  // Dien/Hoai Tu/Dung Nham/Huyet Doc/Van Kiem Vu...), xem
  // CombatSystem.applyDotDamage() - tai dung chung cong thuc/tran
  // voi Resistance.ts's getResistanceMitigationPercent() (resistance -
  // penetration, tran +/-). KHONG anh huong duration/ti le ap/stack/tick
  // rate cua ailment (dung yeu cau "Khong anh huong: duration,
  // application chance, stack, tick rate" - DOT RES CHI dung giua raw
  // damage va final damage). Nen 0.
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

  // Ngu hanh - GIU NGUYEN field code (wood/fire/earth/metal/water),
  // chi doi Y NGHIA: khong con chu ky sinh/khac, moi hanh la 1 damage
  // type doc lap kieu Last Epoch (xem ElementDamageCalculator.ts).
  | ElementStatType

  // Hon Nguyen (Void) - damage type moi, gay sat thuong CHUAN (bo qua
  // Armor/Resistance hoan toan), thay the han DamageType 'true' cu.
  | 'primordialPower'

// PLAN HOAN CHINH muc 2/3 - 5 Main Stat nguoi choi tu phan phoi diem
// vao (xem GameManager.allocateAttributePoint()), tach khoi StatType
// day du chi de co 1 union hep cho tham so/UI, KHONG tao field moi -
// van CHINH 5 field 'attribute' category da co san o tren.
export type MainStatKey = 'strength' | 'dexterity' | 'intelligence' | 'attunement' | 'vitality'

export const MAIN_STAT_KEYS: MainStatKey[] = ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality']
