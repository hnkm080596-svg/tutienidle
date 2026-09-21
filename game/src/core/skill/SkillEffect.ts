import type { SkillEffectType } from  './SkillTypes'
import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'
import type { EffectScope } from '../battle/CombatAction'
import type { ElementType } from '../element/ElementType'
import type { BuffModifierPayload } from '../battle/contracts/operations'
import type { SpellPathRoute } from '../phap-tu/PhapTuState'

// Phap Tu Hoa An (spec 2026-09-17 sec.62) -- a generic post-landing
// interaction with the caster's SAME-SOURCE instance of `buffId` on the
// hit target (spec sec.7: a caster's seal skills touch only their own
// instance). Each entry compiles to one authored op inside the landed
// gate, AFTER the skill's ailment applications, in authored order
// (Phan Thien: apply -> manual tick -> potency modifier -> extend).
// `routes` gates the entry to the listed Phap Tu routes -- the route
// seam (applyRouteToTurnSkill) strips non-matching entries; undefined
// = all routes.
export type SkillAilmentInteraction =
  | {
      kind: 'trigger_periodic'
      buffId: string
      routes?: readonly SpellPathRoute[]
    }
  | {
      kind: 'add_modifier'
      buffId: string
      // Keyed modifier -- spec sec.27: identity = id + appliedBy source
      // (the executor stamps appliedBy); same-key default 'replace'.
      modifier: Omit<BuffModifierPayload, 'appliedBy'>
      routes?: readonly SpellPathRoute[]
    }
  | {
      kind: 'extend_duration'
      buffId: string
      turns: number
      routes?: readonly SpellPathRoute[]
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

  // Dùng cho effect 'damage' khi skill pha trộn nhiều loại damage
  // (vd 20% Physical + 80% Fire) — có mặt thì thay thế hoàn toàn
  // damageType.
  components?: SkillDamageComponent[]

  // 0..1 — tỉ lệ áp dụng debuff SAU KHI đòn đã trúng, roll ĐỘC LẬP
  // với dodge/crit của damage chính (không mặc định 100%, phải khai
  // rõ trong data skill). Unified Buff System (Task 11, 2026-09-01) —
  // trước đây riêng cho effect 'ailment' (đi cùng ailmentId), giờ dùng
  // chung với effect 'debuff' (đi cùng buffId ở trên).
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

  // Pháp Tu Lifedrain (Mộc Tu) — CHỈ có ý nghĩa cùng consumesAilmentId/
  // damagePerStack. Hồi máu cho SOURCE = healPercentOfDamage × bonus
  // damage Detonate vừa gây. Tách riêng khỏi leechPercent toàn cục vì
  // nhánh Detonate đi thẳng currentHp (không qua missile/CombatSystem's
  // leech pipeline) — leechPercent KHÔNG tự áp dụng cho true damage này.
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

  // "Cảnh giới càng cao sát thương càng lớn": cộng thêm ratio ×
  // source.realmIndex (0-based, 9 đại cảnh giới) vào scalingBonus.
  realmDamageRatio?: number

  // Pháp Tu Thuần Hệ (E-2, 2026-09-03) — CHỈ dùng cho effect 'buff'
  // scope 'source' (Hậu Thổ Thành Lũy): số tầng của buff tự áp = số
  // target CÒN SỐNG mà action vừa trúng (ctx.affectedTargets, cap trần
  // maxStacks của buff qua BuffSystem.apply nhiều lần). 0 target →
  // không buff. Không set = 'buff' hoạt động như cũ (1 lần apply).
  // Mission C Task 10a supersession note: the turn-engine port
  // (TurnSkillBuffApplication.stacksPerAffectedTarget) keeps the
  // alive-only stacking but deliberately drops the "0 target -> no
  // buff" clause — whiffed actions still grant the base stack,
  // consistent with the `stacks ?? 1` default.
  stacksPerAffectedTarget?: boolean

  /** Bonus multiplier theo Linh Lực tối đa của Pháp Tu. */
  manaScalingRatio?: number

  /** Bonus sát thương phẳng quy đổi thành multiplier theo ATK của source. */
  skillExperienceRatio?: number

  // Combat Rework Phase 3 — CHỈ dùng cho effect 'damage'. Khai hành vi
  // bay Pierce/Bounce/Homing/AOE cho MỌI missile effect này bắn ra
  // (kể cả nhiều missile của hitCountByRealm) — xem
  // undefined = Normal, hành vi giữ nguyên như trước khi có field này.


  // Pháp Tu Thuần Hệ (E-5, 2026-09-03) — CHỈ dùng cho effect 'damage'.
  // Spawn 1 zone tại target với element từ `zoneElement` (mặc định
  // 'metal' nếu không khai). Dùng cho Tắt Phương Giông Thổ (fire) /
  // Kiếm Mộc Thông Thiên (wood). Authored data only — the turn engine
  // reports it via collectUnsupportedSkillSemantics; no runtime zone
  // spawner is wired (the sword-zone channel was retired, spec
  // 2026-09-15 §7).
  grantsZone?: boolean

  zoneElement?: ElementType

  // Zone tuning dials for grantsZone — names are historical (the
  // mechanism is generic: Phap Tu authors fire/wood zones). Parked:
  // no runtime spawner is wired after the sword-zone channel retired.
  swordZoneCharges?: number
  swordZoneTickInterval?: number
  swordZoneDamageRatio?: number // × finalMultiplier của effect này = damagePerTick
}
