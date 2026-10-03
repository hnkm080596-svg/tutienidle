// 'elemental' dung cho damage toi tu nhieu SkillDamageComponent tron
// lan (vd 20% Physical + 80% Fire) - xem ElementDamageCalculator.ts.
// 'primordial' (Hon Nguyen) thay the han 'true' cu - gay sat thuong
// CHUAN, bo qua Armor/Resistance hoan toan. KHONG con 'magic' - da
// gop vao tong hop 5 hanh (khong skill/enemy nao dung damage type
// 'magic' rieng, xac nhan qua grep luc revamp).
export type DamageType = 'physical' | 'primordial' | 'elemental'

// No (rage) da GO (spec 2026-08-29-kiem-the-kiem-y muc 5.4) -
// consumer duy nhat (Pha Thien Nhat Kich) chuyen thanh passive node
// cua route Bat Kiem, pool currentRage/MAX_RAGE don sach khong de
// mo coi (dev phase, khong migration).

// The Tu Reimagined (spec 2026-09-15 D7/section 7.13) - Momentum
// (momentum cap/momentum resource/per-hit momentum grant/momentum resource
// resourceType) retired; the hidden path fuels reactive checks from
// currentThe, the visible path has no pool resource.


// Phap Tu Dao Sac (spec 2026-08-30-phap-tu-dao-sac sec2.3) - The Thuan
// he Phap Tu sau Lap Dao: pool 0-100 tich xuyen kill trong phien farm
// (+10 moi link chuoi cast hoan tat, +20 finisher E), KHONG decay,
// day thi ban duoc Ultimate nhanh (reset ve 0). So lieu khoi diem
// playtest theo convention.
export const RESOURCE_THE = 'the'
export const MAX_THE = 100
export const THE_GAIN_PER_LINK = 10
export const THE_GAIN_PER_FINISHER = 20

// stat-system-reimagined Task 5 (D5/D11) - explicit hit outcome level:
//   miss     - accuracy/dodge roll failed; nothing landed
//   absorbed - landed, but ward + MP shield absorbed everything
//   taken    - hpDamage > 0
// Only `taken` fires damage-proportional triggers (leech,
// on-hit-taken procs); `landed` (absorbed OR taken) still fires
// ailment-application rolls and resets turnsSinceLastHitLanded.
export type HitOutcome = 'miss' | 'absorbed' | 'taken'

export interface DamageResult {
  sourceId: string

  targetId: string

  rawDamage: number

  finalDamage: number

  // Post-absorb HP loss (finalDamage - wardAbsorbed - manaShieldAbsorbed).
  // Leech/on-hit-taken triggers read THIS, never finalDamage (D11).
  hpDamage: number

  outcome: HitOutcome

  damageType: DamageType

  critical: boolean

  // true neu target ne duoc (accuracy vs evasion contest - xem
  // CombatSystem.resolveHit()), auto finalDamage/rawDamage = 0 va
  // KHONG co gi bi tru/tich.
  dodged: boolean

  // true neu target block thanh cong (giam damage theo
  // blockEffectiveness) - khong loai tru dodged, chi 1 trong 2 xay ra.
  blocked: boolean

  // Phan damage bi Ward hap thu truoc khi tru vao currentHp - 0 neu
  // khong co ward hoac ward da can. TOTAL = external + native.
  wardAbsorbed: number

  // The Tu Reimagined (plan Task 11) - the externalWard component of
  // wardAbsorbed: the separate protection-only pool (source-tagged,
  // exempt from wardMax/regen) absorbs BEFORE native currentWard.
  externalWardAbsorbed: number

  // Phap Tu Redesign (magicpath) - phan damage bi Mana Shield "day"
  // sang mana (SAU Ward, TRUOC HP) - 0 neu khong co manaShieldPercent
  // hoac mana da can. Xem CombatSystem.resolveAttack().
  manaShieldAbsorbed: number

  targetKilled: boolean
}
