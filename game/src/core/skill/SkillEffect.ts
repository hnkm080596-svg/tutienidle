import type { SkillEffectType } from  './SkillTypes'
import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'
import type { EffectScope } from '../battle/CombatAction'
import type { ElementType } from '../element/ElementType'
import type { BuffModifierPayload } from '../battle/contracts/operations'
import type { BuffDefinitionId } from '../battle/contracts/ids'

// Phap Tu Hoa An (spec 2026-09-17 sec.62) -- a generic post-landing
// interaction with the caster's SAME-SOURCE instance of `buffId` on the
// hit target (spec sec.7: a caster's seal skills touch only their own
// instance). Each entry compiles to one authored op inside the landed
// gate, AFTER the skill's ailment applications, in authored order
// (Phan Thien: apply -> manual tick -> potency modifier -> extend).
// Phap Tu Reimagined (spec D12/F9) -- `whenSourceBuff` gates the entry
// on the SOURCE holding >=1 stack of the named buff (the adapter wraps
// the emitted op in `if stacks_at_least(self, whenSourceBuff, 1)`); the
// retired `routes` field died with route machinery.
export type SkillAilmentInteraction =
  | {
      kind: 'trigger_periodic'
      buffId: string
      whenSourceBuff?: BuffDefinitionId
    }
  | {
      kind: 'add_modifier'
      buffId: string
      // Keyed modifier -- spec sec.27: identity = id + appliedBy source
      // (the executor stamps appliedBy); same-key default 'replace'.
      modifier: Omit<BuffModifierPayload, 'appliedBy'>
      whenSourceBuff?: BuffDefinitionId
    }
  | {
      kind: 'extend_duration'
      buffId: string
      turns: number
      whenSourceBuff?: BuffDefinitionId
    }
  // Kiem Pho Beta (design sec.7) -- add stacks to the caster's
  // same-source instance through BuffSystem.addStacks (canonical cap
  // clamp; never creates an instance, never re-rolls application).
  // Compiled to add_buff_stacks; that op has no gateOnApplyResult lane,
  // so an entry meant to ride a self-applied seal must be authored as
  // add_modifier/extend_duration/trigger_periodic instead.
  | {
      kind: 'add_stacks'
      buffId: string
      stacks: number
      whenSourceBuff?: BuffDefinitionId
    }

/** Execution-phase rank of a SkillAilmentInteraction (Kiem Pho Beta
    ordering pin, design sec.8): stack application first, duration and
    instance-local modifiers next, manual periodic triggers last.
    Consumers that APPEND interactions to a derived def (KiemPho combo
    modifiers, node skill-definition modifiers) stable-sort on this so
    authored/append order can never reorder the phases. */
export function ailmentInteractionPhase(interaction: SkillAilmentInteraction): number {
  switch (interaction.kind) {
    case 'add_stacks':
      return 0
    case 'add_modifier':
    case 'extend_duration':
      return 1
    case 'trigger_periodic':
      return 2
  }
}

export interface SkillEffect {
  type: SkillEffectType

  /** Default: heal/buff -> source; damage/debuff -> affected_targets. */
  scope?: EffectScope

  value?: number

  duration?: number

  stacks?: number

  buffId?: string

  // Phap Tu Thuan He (E-3, 2026-09-03) - ONLY used for 'add_stack' /
  // 'remove_buff' effects (those two types used to be no-ops in the
  // removed legacy executor, owned by PassiveSystem). 'add_stack':
  // stacks added onto a RUNNING buff (default 1; does not create one if
  // absent); 'refresh' = true extends the duration of topped-up
  // instances.
  // 'remove_buff': 'polarity' filters by buff/debuff direction,
  // 'count' max instances removed (default 1, in pool order).
  refresh?: boolean

  polarity?: 'buff' | 'debuff'

  count?: number

  damageType?: 'physical' | 'primordial'

  // Dung cho effect 'damage' khi skill pha tron nhieu loai damage
  // (vd 20% Physical + 80% Fire) - co mat thi thay the hoan toan
  // damageType.
  components?: SkillDamageComponent[]

  // 0..1 - ti le ap dung debuff SAU KHI don da trung, roll DOC LAP
  // voi dodge/crit cua damage chinh (khong mac dinh 100%, phai khai
  // ro trong data skill). Unified Buff System (Task 11, 2026-09-01) -
  // truoc day rieng cho effect 'ailment' (di cung ailmentId), gio dung
  // chung voi effect 'debuff' (di cung buffId o tren).
  ailmentChance?: number

  // ONLY for 'damage' effects - multiplier scaled by the
  // attributes of the SOURCE at cast time, summed across entries. One
  // element in `attributes` = a flat coefficient (e.g. Linh Can for
  // spell-path skills); MULTIPLE elements = Last Epoch-style "Adaptive"
  // (uses the HIGHEST value in the group).
  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]

  // Phap Tu Detonate (e.g. Bao Viem "cash in" Burn stacks) - ONLY for
  // 'damage' effect. If the target carries this ailment, deals bonus
  // damage = stacks * damagePerStack (true damage, bypassing
  // Armor/Resistance - same spirit as primordialPower's "ignore
  // mitigation"), THEN removes the ailment entirely - converting a
  // running DOT into an immediate burst. Unset = 'damage' behaves as
  // before (plain missile).
  consumesAilmentId?: string

  damagePerStack?: number

  // Phap Tu Hoa An (spec 2026-09-17 sec.62 Cuu Tieu) -- scope of the
  // consumesAilmentId consume. 'any' = legacy parity: every source's
  // instance of the ailment on the target is read + consumed (Detonate
  // semantics). 'own' = same-source only -- the caster's own instance
  // (spec sec.7 default for Hoa seal skills). Unset = 'any'.
  consumesAilmentScope?: 'own' | 'any'

  // Phap Tu Hoa An (spec 2026-09-17 sec.62 Xich Viem shared/no) -- 'damage'
  // effects only: scale the DIRECT hit's coefficient by same-source
  // ailment stacks WITHOUT consuming. Bonus = live same-source stack
  // count x damagePerStack, folded into the hit coefficient per target.
  scalesWithAilmentStacks?: { ailmentId: string; damagePerStack: number }

  // Phap Tu Hoa An (spec 2026-09-17 sec.62) -- 'damage' effects only:
  // same-source seal interactions that run inside the landed gate after
  // ailment applications (see SkillAilmentInteraction above). Never a
  // direct state mutation -- each entry is an authored ailment op.
  ailmentInteractions?: readonly SkillAilmentInteraction[]

  // Phap Tu Lifedrain (Moc Tu) - CHI co y nghia cung consumesAilmentId/
  // damagePerStack. Hoi mau cho SOURCE = healPercentOfDamage x bonus
  // damage Detonate vua gay. Tach rieng khoi leechPercent toan cuc vi
  // nhanh Detonate di thang currentHp (khong qua missile/CombatSystem's
  // leech pipeline) - leechPercent KHONG tu ap dung cho true damage nay.
  healPercentOfDamage?: number

  // Phap Tu (Tho Tu, 2026-08-15) - "shield self-detonate": ONLY for the
  // 'damage' effect. Consumes the SOURCE's ENTIRE currentWard (not the
  // target) for a true-damage bonus burst = currentWard *
  // damagePerWardPoint (bypasses Armor/Resistance, same spirit as
  // consumesAilmentId), then clears currentWard to 0. Unset = 'damage'
  // behaves as before.
  consumesWardForDamage?: boolean

  damagePerWardPoint?: number

  // Kiem Tu (Ngu Kiem Thuat, 2026-08-15) - ONLY for 'damage' effects.
  // Fires (source.realmIndex + 1) missiles in a row instead of 1, each
  // rolling critical/dodge independently.
  hitCountByRealm?: boolean

  // Phap Tu Thuan He (E-4, 2026-09-03) - ONLY for 'damage' effects.
  // Fires a FIXED count of N missiles (e.g. Bat Thuan "8 waves"), each
  // rolling critical/dodge independently - same spirit as
  // hitCountByRealm. MUTUALLY EXCLUSIVE: if both are set, hitCount WINS
  // (the explicit number beats the realm formula).
  hitCount?: number

  // "Canh gioi cang cao sat thuong cang lon": cong them ratio x
  // source.realmIndex (0-based, 9 dai canh gioi) vao scalingBonus.
  realmDamageRatio?: number

  // Phap Tu Thuan He (E-2, 2026-09-03) - CHI dung cho effect 'buff'
  // scope 'source' (Hau Tho Thanh Luy): so tang cua buff tu ap = so
  // target CON SONG ma action vua trung (ctx.affectedTargets, cap tran
  // maxStacks cua buff qua BuffSystem.apply nhieu lan). 0 target ->
  // khong buff. Khong set = 'buff' hoat dong nhu cu (1 lan apply).
  // Mission C Task 10a supersession note: the turn-engine port
  // (TurnSkillBuffApplication.stacksPerAffectedTarget) keeps the
  // alive-only stacking but deliberately drops the "0 target -> no
  // buff" clause - whiffed actions still grant the base stack,
  // consistent with the `stacks ?? 1` default.
  stacksPerAffectedTarget?: boolean

  /** Bonus multiplier theo Linh Luc toi da cua Phap Tu. */
  manaScalingRatio?: number

  /** Bonus sat thuong phang quy doi thanh multiplier theo ATK cua source. */
  skillExperienceRatio?: number

  // Combat Rework Phase 3 - CHI dung cho effect 'damage'. Khai hanh vi
  // bay Pierce/Bounce/Homing/AOE cho MOI missile effect nay ban ra
  // (ke ca nhieu missile cua hitCountByRealm) - xem
  // undefined = Normal, hanh vi giu nguyen nhu truoc khi co field nay.


  // Phap Tu Thuan He (E-5, 2026-09-03) - CHI dung cho effect 'damage'.
  // Spawn 1 zone tai target voi element tu `zoneElement` (mac dinh
  // 'metal' neu khong khai). Dung cho Tat Phuong Giong Tho (fire) /
  // Kiem Moc Thong Thien (wood). Authored data only - the turn engine
  // reports it via collectUnsupportedSkillSemantics; no runtime zone
  // spawner is wired (the sword-zone channel was retired, spec
  // 2026-09-15 sec7).
  grantsZone?: boolean

  zoneElement?: ElementType

  // Zone tuning dials for grantsZone - names are historical (the
  // mechanism is generic: Phap Tu authors fire/wood zones). Parked:
  // no runtime spawner is wired after the sword-zone channel retired.
  swordZoneCharges?: number
  swordZoneTickInterval?: number
  swordZoneDamageRatio?: number // x finalMultiplier cua effect nay = damagePerTick
}
