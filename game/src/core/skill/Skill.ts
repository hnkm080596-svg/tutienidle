import type {
  SkillType,
  SkillTarget,
  SkillResourceType,
  PassiveTrigger,
} from './SkillTypes'
import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { SkillSpecialization } from './SkillSpecialization'
import type { ActionTargeting, CombatVfxPresetId } from '../battle/CombatAction'
import type { TriggerBinding } from './SkillTrigger'

/**
 * Skill execution policy (plan sec8.1) - authored timing semantics of the
 * legacy real-time auto-cast engine. The turn engine does NOT consume
 * this field (turn cadence lives on TurnSkillDefinition.cooldownTurns /
 * chargeTurns); it remains authored data preserved by save-restore
 * backfill. Kinds:
 * - `attack_speed`: cadence theo Attack Speed (x multiplier), khong ICD,
 *   khong CDR, khong cast time.
 * - `cooldown`: resolve tuc thoi, timer = skill.cooldown, chiu CDR.
 * - `cast_time`: niem truoc khi thi trien; cast time chiu Cast Speed,
 *   cooldown commit luc BAT DAU niem, chiu CDR.
 * - `attack_speed_cast`: vua niem vua co nhip tai dung theo Attack Speed;
 *   khong chiu CDR.
 * - `channel`: TU LUC lien tuc, khong cooldown, khong cast time; moi
 *   `tickSeconds` gay 1 phat.
 */
export type SkillExecutionPolicy =
  | {
      kind: 'attack_speed'
      attackSpeedMultiplier?: number
    }
  | {
      kind: 'cooldown'
    }
  | {
      kind: 'cast_time'
      castTime: number
    }
  | {
      kind: 'attack_speed_cast'
      castTime: number
      attackSpeedMultiplier?: number
    }
  // Kiem Tu Bat Kiem (2026-08-28) - TU LUC: khong cooldown, khong cast
  // time; nhan vat o trang thai channel lien tuc, MOI tickSeconds gay 1
  // phat theo effects/target cua skill (BattleSystem.updateChanneling).
  // tickSeconds chinh duoc bang UI trong tran (3-9s, spec sec4.2).
  | {
      kind: 'channel'
      tickSeconds: number
    }

export interface Skill {
  id: string

  name: string

  description: string

  type: SkillType

  level: number

  maxLevel: number

  /** XP con lai trong cap hien tai; Huy Kiem tu nhan +1 moi lan cast. */
  experience?: number

  /** XP tich luy suot doi, dung cho he so sat thuong va hook mo Kiem Tu. */
  totalExperience?: number

  requiredRealmId?: string

  requiredRealmLevel?: number

  // Authored cooldown in seconds - the turn engine consumes it as
  // cooldownTurns via toTurnSkillDefinition (LegacySkillAdapter, M5e);
  // runtime cooldown state
  // lives on TurnSkillSlot.remainingCooldownTurns (no Skill-side clock).
  cooldown: number

  // Cast Time (2026-08-21) - giay "niem" TRUOC KHI hieu ung thi trien.
  // Skill execution policy rework (plan sec8) - field nay CHI con la du
  // lieu tham khao cho skill co `execution` kind 'cast_time'/
  // 'attack_speed_cast' (policy tu khai castTime rieng); runtime KHONG
  // doc fallback tu day nua. Giu de UI/tooltip hien thi.
  castTime?: number

  // Luong tai nguyen can de cast, y nghia tuy resourceType (mana,
  // the) - 'none' thi KHONG khai field nay (skill free,
  // runtime khong doc cost).
  cost?: number

  target: SkillTarget

  effects: SkillEffect[]

  passiveModifiers?: StatModifier[]

  // Bat buoc khi type === 'active', mac dinh coi nhu 'none' neu
  // khong set.
  resourceType?: SkillResourceType

  // Skill execution policy (plan sec8.1/sec8.3) - BAT BUOC cho MOI active
  // skill; passive khong dung. Runtime chi doc field nay - khong con
  // fallback isBasicAttack/castTime/path. Xem type doc phia tren.
  execution?: SkillExecutionPolicy

  // ================= Combat Grid Rework (2026-08-24) =================
  targeting?: ActionTargeting

  // AOE theo grid: lan quanh o PRIMARY target. undefined/0 = single.
  laneRadius?: number

  columnRadius?: number

  // Override preset VFX impact; mac dinh suy tu element.
  vfxPresetId?: CombatVfxPresetId

  // Bat buoc khi type === 'passive' - xem PassiveSystem.
  passiveTrigger?: PassiveTrigger

  // Talent v4 (spec 2026-09-03 sec3.3 E2) - passive chi tich stack khi
  // dieu kien nay dung (PassiveSystem doc HP ratio cua player qua
  // hpReader closure; vang reader thi coi nhu dieu kien thoa -
  // defensive cho PassiveSystem dung kieu cu ngoai combat).
  // CP-01 - 'hpNotBelow' added for the mirrored talent pair Can Than /
  // Can Than (phan): the downside leg must apply only above the same
  // threshold, otherwise it halves the upside leg when both are live.
  passiveCondition?: { kind: 'hpBelow' | 'hpNotBelow'; percent: number }

  // Talent v4 - khi 1 modifier cham maxStacks: apply buff nay len
  // player qua buffApplier closure roi reset stack cua modifier ve 0
  // (nhip "tich -> nguong -> bung no -> tich lai"). Vang applier thi
  // bung no bi bo qua nhung stack van reset - khong tich ket o tran.
  passiveConvertsTo?: { buffId: string }

  // Phap Tu profession-tier ladder (2026-08-14) - nhan PHAN LOAI thuan
  // UI cho passive skill (Skill.ts's Tam Phap summary panel nhom
  // passive theo huong build) - khong anh huong runtime, chi to chuc
  // hien thi "Core/DOT/Burst" cho nguoi choi de hieu build cua minh.
  // 'ult' (spec 2026-08-29-kiem-the-kiem-y) - Kiem Tu manual ult;
  // same presentation-only label, not role ownership.
  buildTag?: 'core' | 'dot' | 'burst' | 'ult'

  // "No ky tam thoi chua ra mat" (2026-08-15) - reserved flag; the
  // real-time cast gate that read it was retired with SkillSystem's
  // legacy cast APIs (9.5 #9). Data stays authored-able for UI badges
  // (isUnreleased prop on CombatSkillSlot).
  unreleased?: boolean

  // Pool grant fields retired: grantsMomentumPerHit (momentum removed,
  // spec 2026-09-15 D7) and grantsSwordIntentPerHit/grantsHoaThePerCast/
  // grantsThoThePerCast (entity pools moved off CombatEntity).


  // The Tu (Combat Rework Phase 7) - danh TRUNG thi tru them N vao
  // target.currentBreakGauge (neu target co, xem CombatEntity.ts) -
  // KHONG qua Damage Engine/mitigation, cung tinh than Detonate. Cham
  // 0 thi Stagger (ap 'choang'), xem BattleSystem's missile-resolve
  // callback.
  breakDamagePerHit?: number

  // grantsHoaThePerCast/grantsThoThePerCast removed with the entity
  // pools (kiem-tu/phap-tu reimagined state model).

  // Core Loop Foundation checklist (Muc SKILL) - danh sach lua chon
  // "behavior-changing node" (template, khong doi giua cac instance
  // neu co nhieu - hien game chi co 1 instance/skill nen khong quan
  // trong). Khong khai = skill nay chua co specialization nao.
  specializations?: SkillSpecialization[]

  // Lua chon CUA NGUOI CHOI - instance-level, mac dinh chua chon
  // (dung effects/passiveModifiers/passiveTrigger goc). Xem
  // SkillSystem.selectSpecialization()/getEffectiveSkill().
  selectedSpecializationId?: string

  // Trigger/Action rework (2026-08-31 spec) - a skill fully migrated off
  // `effects` declares its behavior here instead: each binding pairs a
  // TriggerType with an ordered SkillAction list. Consumed live by the
  // turn engine via toTurnSkillDefinition in LegacySkillAdapter (the legacy
  // runner that
  // fired these bindings was removed with the dormant M13 path).
  triggers?: TriggerBinding[]
}
