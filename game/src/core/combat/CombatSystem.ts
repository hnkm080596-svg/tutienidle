import type { CombatEntity } from './CombatEntity'

import { calculateBaseDamage, applyMultiplierAndCritical, calculateScalingBonus } from './DamageCalculator'
import { calculateSkillBaseDamage } from './ElementDamageCalculator'
import { getRealmPressureMultiplier } from './RealmPressure'
import { getHitChance } from './Accuracy'
import { applyEndurance } from './Endurance'

import type { DamageResult } from './CombatTypes'

import type { EventBus } from '../events/EventBus'
import type { ActionDamageInfo, HitResolveOptions } from '../battle/ActionImpactSystem'
import type { ElementType } from '../element/ElementType'
import { EntityVitalsSystem, type VitalsChangeReason } from './EntityVitalsSystem'
import { clampStatValue } from '../stats/StatMetadata'
import type { SurviveLethalGuard } from '../talent/SurviveLethalGuard'
import type { SkillManager } from '../skill/SkillManager'
import { SkillTriggerRunner } from '../skill/SkillTriggerRunner'
import type { SkillEffectContext } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { dotRecoveryTriggers } from './DotRecovery'
import type { Buff, BuffDefinitionCatalog } from '../buff/BuffTypes'

// Plans/magicpathgeneral Phase 9 (2026-08-21) — DOT RES is a
// "*Percent" stat (fraction 0..1, same scale as ailmentResistPercent/
// ailmentPotencyPercent...), NOT the "Rating" (net/100) scale of
// Resistance.ts's getResistanceMitigationPercent() (used for the 5
// element Power/Resistance/Penetration stats) — do not reuse that
// helper here or the scale drifts.
const DOT_RESISTANCE_CAP = 0.75
const DOT_RESISTANCE_FLOOR = -1

/**
 * Toàn bộ combat giờ đi qua action impact (xem ActionImpactSystem/
 * BattleSystem) — resolveActionHit() là điểm vào
 * DUY NHẤT tính damage thật (attack()/attackWithElements() cũ đã bị
 * xoá, không còn nơi nào gọi từ khi combat chuyển hẳn sang action impact).
 *
 * Pipeline đầy đủ (đúng thứ tự accuracy → dodge → block →
 * armor/resistance → endurance → ward → HP): mitigation Armor/
 * Resistance đã áp xong TRONG calculateBaseDamage()/
 * calculateSkillBaseDamage() (mỗi component tự mitigate theo đúng
 * loại của nó — không gộp chung 1 công thức được vì skill nhiều
 * component có thể mang nhiều hành khác nhau cùng lúc). Block và
 * Armor/Resistance đều là % nhân đơn thuần nên thứ tự tính giữa 2
 * bước không đổi kết quả cuối (phép nhân giao hoán) — chỉ thứ tự
 * SỰ KIỆN/emit mới theo đúng accuracy→dodge→block như yêu cầu.
 */
export interface SurviveEffectsPolicy {
  buffSystem: BuffSystem
  registry: BuffDefinitionCatalog
  grantBuffId?: string
  cleanseDebuffs?: boolean
}

/**
 * The Tu Reimagined (plan Task 9) — ordered survive-lethal contract.
 * killIfDead iterates the session's sources; the first `survived:true`
 * wins. `grantBuffId`/`grantBuffDurationOverride`/`cleanseDebuffs` are
 * applied through the session's SurviveEffectsPolicy (buffSystem +
 * registry) — the grant is OPTIONAL: a free survive (e.g. an already-
 * active Bat Tu buff) returns bare {survived:true} so repeat lethals
 * never refresh the buff (review-#6 fix).
 */
export type SurviveLethalResult =
  | { survived: false }
  | {
      survived: true
      grantBuffId?: string
      grantBuffDurationOverride?: number
      cleanseDebuffs?: boolean
    }

export interface SurviveLethalSource {
  trySurvive(entity: CombatEntity): SurviveLethalResult
}

export class CombatSystem {
  readonly vitals: EntityVitalsSystem

  // Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — session
  // battle-scoped: id entity player + guard giữ lượt sống sót. null =
  // không bảo vệ (trận Độ Kiếp, trận không có PlayerData, hoặc không có
  // thiên phú). GameManager set/reset mỗi lần bắt đầu trận.
  //
  // v4 (spec 2026-09-03 §4.1): surviveEffects mở rộng cho Bất Tử Thể
  // — khi guard cứu sống: tẩy debuff trên player + áp buff sống sót (mặc định Tử Sinh Ngộ).
  // R4 (AR-18): SurviveEffectsPolicy là cấu hình declarative, không hardcode 'tu_sinh_ngo'.
  private surviveLethalSession: {
    playerEntityId: string
    guard: SurviveLethalGuard
    surviveEffects?: SurviveEffectsPolicy
    /**
     * The Tu Reimagined (plan Task 9, D9) — ordered sources evaluated
     * BEFORE the talent guard: the Bat Tu ultimate is the first line of
     * survival; the talent is the extra life once the ult is spent.
     */
    extraSources?: SurviveLethalSource[]
  } | null = null

  // Trigger/Action rework Task 10 (2026-08-31 spec) — onKill firing.
  // buffRegistry is a shared, non-battle-specific
  // dependency (same kind BattleSystem itself receives via its own
  // constructor — see BattleSystem.ts) — injected here as an optional final
  // constructor param so CombatSystem can build a real SkillEffectContext
  // without crashing on an empty registry `.get()` miss. `skillManager`/
  // `buffRegistry` are optional; every existing
  // `new CombatSystem(eventBus)` call site keeps compiling unchanged.
  private readonly skillTriggerRunner = new SkillTriggerRunner()

  constructor(
    readonly eventBus: EventBus,
    private readonly skillManager?: SkillManager,
    private readonly buffRegistry?: BuffRegistry,
  ) {
    this.vitals = new EntityVitalsSystem(eventBus)
  }

  /**
   * Mission C Task 8 — combat rolls read ONE random source. The battle
   * lifecycle owner sets it per cycle (seeded session rng); anything not
   * inside a battle keeps the Math.random default. CombatSystem is
   * shared per-GameManager, so the source is SETTABLE, never
   * constructor-frozen.
   */
  // Lazy default — reads Math.random at each call so test spies still
  // intercept (matches TurnBattleSystem's rng convention).
  private randomSource: () => number = () => Math.random()

  setRandomSource(rng: () => number): void {
    this.randomSource = rng
  }

  setSurviveLethalSession(
    session: {
      playerEntityId: string
      guard: SurviveLethalGuard
      surviveEffects?: SurviveEffectsPolicy
      extraSources?: SurviveLethalSource[]
    } | null,
  ): void {
    this.surviveLethalSession = session
  }

  applyDirectDamage(target: CombatEntity, amount: number, sourceId: string, reason: VitalsChangeReason = 'damage') {
    const applied = this.vitals.applyDamage(target, amount, reason, sourceId)
    this.killIfDead(target, sourceId)
    return applied
  }

  // finalDamagePercent/finalDamageReductionPercent (affix top-tier, thay
  // Supreme Strength/Intelligence) — HIT-layer multiplier: dùng chung bởi
  // resolveAttack() VÀ mọi damage phản hồi trực tiếp (ward-break,
  // reaction) để affix này thật sự áp dụng xuyên suốt pipeline, không chỉ
  // đòn đánh chính. KHÔNG áp cho DoT — dotResistancePercent là lớp giảm
  // duy nhất của DoT (stat-system-reimagined Task 6, D13).
  private finalDamageMultiplier(attacker: CombatEntity | undefined, defender: CombatEntity): number {
    return (1 + (attacker?.stats.finalDamagePercent ?? 0)) * (1 - clampStatValue('finalDamageReductionPercent', defender.stats.finalDamageReductionPercent))
  }

  applyModifiedDirectDamage(target: CombatEntity, rawAmount: number, attacker: CombatEntity, reason: VitalsChangeReason = 'damage') {
    const amount = Math.max(0, rawAmount * this.finalDamageMultiplier(attacker, target))
    return this.applyDirectDamage(target, amount, attacker.id, reason)
  }

  applyHealing(target: CombatEntity, amount: number, sourceId: string, reason: VitalsChangeReason = 'healing') {
    return this.vitals.applyHealing(target, amount, reason, sourceId)
  }

  /**
   * M8 (ARCH-003) — per-turn HP/MP/Ward regeneration entry point. The
   * turn engine supplies already-decided per-turn deltas; the vitals
   * authority owns clamping, the dead-entity boundary, and the single
   * 'regen' vitals event.
   */
  applyTurnRegen(
    target: CombatEntity,
    deltas: { hp?: number; mp?: number; ward?: number },
    sourceId?: string,
  ): { hp: number; mp: number; ward: number } {
    return this.vitals.applyTurnRegen(target, deltas, sourceId)
  }

  /**
   * Authoritative ward spend (R1 / AR-01): mutation belongs to the vitals
   * owner; CombatSystem exposes the typed entry point so orchestrators do
   * not write entity fields directly.
   */
  spendWard(target: CombatEntity, amount: number, reason: VitalsChangeReason = 'ward_spend', sourceId?: string) {
    return this.vitals.spendWard(target, amount, reason, sourceId)
  }

  resolveActionHit(
    source: CombatEntity,
    target: CombatEntity,
    damage: ActionDamageInfo,
    options: Partial<HitResolveOptions> = {},
  ): DamageResult {
    if (!options.guaranteedHit && !this.rollHit(source, target)) {
      return this.resolveDodge(source, target, damage.kind)
    }

    const isCritical = options.critical !== undefined ? options.critical : this.rollCritical(source, target)

    // R3 re-audit (AR-03 gap) — authored per-skill scaling (attributeScaling/
    // manaScalingRatio, carried on ActionDamageInfo.
    // scaling since the converter used to drop them) plus the general
    // skillDamagePercent stat (equipment/node), which previously
    // had no live consumer in the turn engine at all — same formula
    // SkillEffectSystem.apply() used for the older, non-turn execution path.
    const scalingBonus = calculateScalingBonus(source, damage.scaling)

    const effectiveMultiplier =
      damage.multiplier *
      (options.damageMultiplier ?? 1) *
      (1 + scalingBonus) *
      (1 + clampStatValue('skillDamagePercent', source.stats.skillDamagePercent)) *
      getRealmPressureMultiplier(source, target)

    // Chance to Ignore Resistance — roll 1 LẦN/đòn (khác Penetration phẳng,
    // đây là "bỏ qua hoàn toàn" mitigation của đòn đó nếu trúng).
    // Resolved armor policy (armorBypass/armorPierceFraction) comes from the
    // caller — the calculator executes the already-rolled outcome.
    const ignoreResistance =
      options.armorBypass === true ||
      this.randomSource() < clampStatValue('chanceToIgnoreResistance', source.stats.chanceToIgnoreResistance)

    const baseDamage = damage.kind === 'elemental'
      ? calculateSkillBaseDamage(source, target, damage.components, ignoreResistance)
      : calculateBaseDamage(source, target, damage.kind, ignoreResistance, options.armorPierceFraction ?? 0)

    const afterCrit = applyMultiplierAndCritical(baseDamage, effectiveMultiplier, isCritical, source.stats.criticalDamage)

    const blocked = this.rollBlock(target)

    const afterBlock = blocked ? afterCrit * (1 - clampStatValue('blockEffectiveness', target.stats.blockEffectiveness)) : afterCrit

    const afterEndurance = applyEndurance(afterBlock, target.stats.enduranceThreshold, clampStatValue('endurancePercent', target.stats.endurancePercent))

    // Floor "tối thiểu 1" áp trong resolveAttack() SAU finalDamageMultiplier
    // (finalDamagePercent/finalDamageReductionPercent) — đòn bị giảm nhiều
    // tầng vẫn luôn gây được ít nhất 1 sát thương, kể cả khi affix giảm
    // sát thương cuối cùng kéo về dưới 1.
    const finalDamage = afterEndurance

    const result: DamageResult = {
      sourceId: source.id,

      targetId: target.id,

      rawDamage: finalDamage,

      finalDamage,

      hpDamage: 0,

      // resolveAttack() overwrites with the real outcome once the absorb
      // layers run — 'taken' is only the pre-absorb placeholder.
      outcome: 'taken',

      damageType: damage.kind,

      critical: isCritical,

      dodged: false,

      blocked,

      wardAbsorbed: 0,

      externalWardAbsorbed: 0,

      manaShieldAbsorbed: 0,

      // Settled AFTER ward/MP-shield absorb, HP apply and
      // SurviveLethalGuard inside resolveAttack() — predicting it here
      // (pre-multiplier, pre-absorb) lies on both directions.
      targetKilled: false,
    }

    return this.resolveAttack(source, target, result, isCritical, blocked)
  }

  private rollHit(source: CombatEntity, target: CombatEntity): boolean {
    return this.randomSource() < getHitChance(source.stats.accuracyRating, target.stats.evasionRate)
  }

  // Block hard cap 90% (2026-09-01, T5.5): soft cap 0.75 (StatMetadata)
  // chặn stat cộng dồn từ affix/talent; buff tạm có thể vượt soft cap
  // nhưng KHÔNG BAO GIỜ vượt 0.90 tại điểm roll — chặn "bất tử chặn đòn".
  private static readonly BLOCK_HARD_CAP = 0.9

  private rollBlock(target: CombatEntity): boolean {
    const softCapped = clampStatValue('blockChance', target.stats.blockChance)

    return this.randomSource() < Math.min(CombatSystem.BLOCK_HARD_CAP, softCapped)
  }

  /**
   * Public vì critical phải roll lúc BẮN missile (mang theo suốt
   * hành trình bay), không còn roll ngay lúc tính damage như trước —
   * cần gọi được từ BattleSystem lẫn SkillEffectSystem (2 nơi bắn
   * missile), không chỉ nội bộ CombatSystem. `target` dùng để trừ
   * Critical Strike Avoidance của phía phòng thủ (chance hiệu lực
   * không thể âm).
   */
  rollCritical(source: CombatEntity, target: CombatEntity): boolean {
    const effectiveChance = clampStatValue('criticalRate', source.stats.criticalRate - target.stats.criticalAvoidance)

    return this.randomSource() < effectiveChance
  }

  /**
   * Trượt (accuracy thua evasion trong contest — xem Accuracy.ts) —
   * không tính damage, không trừ HP, không tích rage. Chỉ emit
   * 'dodge' (giữ nguyên tên event/trigger cũ, không đổi PassiveSystem/
   * FormationSystem) rồi trả kết quả rỗng — KHÔNG đi qua resolveAttack().
   */
  private resolveDodge(
    source: CombatEntity,
    target: CombatEntity,
    damageType: DamageResult['damageType'],
  ): DamageResult {
    this.eventBus.emit('dodge', {
      type: 'dodge',

      sourceId: source.id,

      targetId: target.id,
    })

    return {
      sourceId: source.id,

      targetId: target.id,

      rawDamage: 0,

      finalDamage: 0,

      hpDamage: 0,

      outcome: 'miss',

      damageType,

      critical: false,

      dodged: true,

      blocked: false,

      wardAbsorbed: 0,

      externalWardAbsorbed: 0,

      manaShieldAbsorbed: 0,

      targetKilled: false,
    }
  }

  private resolveAttack(
    source: CombatEntity,
    target: CombatEntity,
    result: DamageResult,
    critical: boolean,
    blocked: boolean,
  ) {
    const targetBefore = { hp: target.currentHp, ward: target.currentWard, mp: target.currentMp }
    // Floor "tối thiểu 1" áp SAU finalDamageMultiplier (xem resolveActionHit)
    // — mọi đòn trúng đích luôn gây ít nhất 1 sát thương.
    result.finalDamage = Math.max(1, result.finalDamage * this.finalDamageMultiplier(source, target))

    if (critical) {
      this.eventBus.emit('critical', {
        type: 'critical',

        sourceId: source.id,

        targetId: target.id,
      })
    }

    if (blocked) {
      this.eventBus.emit('block', {
        type: 'block',

        sourceId: source.id,

        targetId: target.id,
      })
    }

    this.eventBus.emit('hit', {
      type: 'hit',

      sourceId: source.id,

      targetId: target.id,
    })

    // Pháp Tu (Thổ Tu, 2026-08-15) — reset đồng hồ "chưa bị đánh" MỖI
    // LẦN thật sự trúng đòn (kể cả khi bị block/không có ward) —
    // wardRegenPerTurn chỉ hồi sau khi mốc này đủ lâu, xem
    // BattleSystem.updateRegen().
    target.turnsSinceLastHitLanded = 0

    // The Tu Reimagined (plan Task 11, D3) — external ward absorbs
    // FIRST: the source-tagged, protection-only pool takes the hit
    // before the native ward. result.wardAbsorbed keeps the TOTAL for
    // the existing events/UI; externalWardAbsorbed splits the new layer.
    let externalWardAbsorbed = 0

    if (target.externalWard && target.externalWard.amount > 0) {
      externalWardAbsorbed = Math.min(target.externalWard.amount, result.finalDamage)
      target.externalWard.amount -= externalWardAbsorbed

      if (target.externalWard.amount <= 0) {
        target.externalWard = undefined
      }
    }

    // Ward hấp thụ TRƯỚC currentHp — phần dư (nếu ward không đủ hoặc
    // không có) mới thật sự trừ máu.
    const remainingAfterExternal = result.finalDamage - externalWardAbsorbed
    const nativeWardAbsorbed = Math.min(target.currentWard, remainingAfterExternal)

    target.currentWard -= nativeWardAbsorbed

    const wardAbsorbed = externalWardAbsorbed + nativeWardAbsorbed

    let hpDamage = remainingAfterExternal - nativeWardAbsorbed

    // Pháp Tu Redesign (magicpath) — Mana Shield: SAU Ward, TRƯỚC HP.
    // % phần damage CÒN LẠI (không phải finalDamage gốc — Ward đã che
    // bớt trước) được đẩy sang mana, quy đổi 1:1, PHẦN MANA KHÔNG ĐỦ
    // CHE thì tràn ngược lại HP (không "ăn free" khi cạn mana, đúng
    // yêu cầu "sát thương giảm sẽ đánh đổi bằng mana").
    const manaShieldPortion = hpDamage * clampStatValue('manaShieldPercent', target.stats.manaShieldPercent)

    const manaShieldAbsorbed = Math.min(manaShieldPortion, target.currentMp)

    target.currentMp -= manaShieldAbsorbed

    hpDamage -= manaShieldAbsorbed

    // D11 — hpDamage is the ACTUAL HP the target lost: the vitals
    // authority clamps at 0, so an overkill hit counts only the HP that
    // existed. The returned delta, not the pre-clamp amount, is what
    // leech/on-taken triggers scale on.
    const actualHpDamage = this.vitals.applyHpDamageFromSnapshot(target, hpDamage, result.finalDamage, 'damage', targetBefore, source.id)

    result.wardAbsorbed = wardAbsorbed

    result.externalWardAbsorbed = externalWardAbsorbed

    result.manaShieldAbsorbed = manaShieldAbsorbed

    // D5/D11 — hpDamage is the post-absorb truth: the hit "landed"
    // either way (timer reset + hit event above), but only `taken`
    // (hpDamage > 0) may fire damage-proportional triggers below.
    result.hpDamage = actualHpDamage

    result.outcome = actualHpDamage > 0 ? 'taken' : 'absorbed'

    // Nộ (rage) đã GỠ (spec 2026-08-29-kiem-the-kiem-y mục 5.4) —
    // khối tích currentRage theo damage gây/nhận dỡ sạch.

    // Explicit contract (review 2026-09-15): `value` stays the
    // pre-absorb impact (finalDamage); hpDamage/wardAbsorbed/
    // manaShieldAbsorbed carry the post-absorb truth. Presentation
    // showing "HP lost" must read hpDamage — a fully absorbed hit shows
    // no HP number.
    this.eventBus.emit('damage', {
      type: 'damage',

      sourceId: source.id,

      targetId: target.id,

      value: result.finalDamage,

      hpDamage: actualHpDamage,

      wardAbsorbed,

      externalWardAbsorbed,

      manaShieldAbsorbed,

      damageType: result.damageType,

      critical,
    })

    // Leech — damage-proportional trigger: fires only on `taken`
    // (hpDamage > 0), scaled on the HP THẬT SỰ lost post-absorb (D11 —
    // a fully-warded hit feeds no leech, an overkill feeds only the HP
    // the target actually had).
    if (actualHpDamage > 0 && source.stats.leechPercent > 0 && source.alive) {
      this.applyHealing(source, actualHpDamage * clampStatValue('leechPercent', source.stats.leechPercent), source.id, 'leech')
    }

    // Pháp Tu (Thổ Tu) — "Khiên Nổ": Ward VỪA hấp thụ xong VÀ vừa vỡ
    // hẳn (currentWard chạm 0 sau đòn này) thì phản thêm 1 cục damage
    // riêng vào NGUỒN, tỉ lệ theo wardMax (khiên càng lớn nổ càng
    // đau). The Tu Reimagined (spec 2026-09-15 T12): generic thorns stat
    // retired — ward-break is the surviving defender-side kickback.
    // Task 11 — the gate reads the NATIVE component only: an
    // external-only absorb with currentWard already 0 never procs
    // ward break, and externalWard never feeds its wardMax-scaled
    // magnitude (it isn't the holder's own ward).
    if (nativeWardAbsorbed > 0 && target.currentWard <= 0 && target.stats.wardBreakDamagePercent > 0) {
      this.applyModifiedDirectDamage(source, target.stats.wardMax * target.stats.wardBreakDamagePercent, target, 'ward_break')
    }

    this.killIfDead(target, source.id)

    // targetKilled is only truthful now — absorb layers, the HP clamp
    // and SurviveLethalGuard have all run.
    result.targetKilled = !target.alive

    // Ward-break kickback can kill the source — check it too; the
    // target is the "killer" in that case.
    this.killIfDead(source, target.id)

    return result
  }

  /**
   * Plans/magicpathgeneral Phase 9-12 (2026-08-21) — điểm áp dụng THẬT
   * SỰ cho 1 tick "damage-over-time-ở-1-điểm" — dùng chung bởi
   * AilmentSystem.update() (DoT gắn trên entity) VÀ BattleSystem.
   * updateLavaZones() (Lava Zone — Phase 12 nói rõ "không phải DoT
   * trên target", nhưng damage vẫn cần qua ĐÚNG pipeline DOT RES/
   * Poison Recovery/DamageEvent, chỉ khác nguồn KÍCH HOẠT tick là 1
   * VÙNG theo vị trí thay vì 1 Ailment instance). Đúng pipeline Phase
   * 10 "DoT tick → DamageEvent → sourceId/targetId/effectId → DOT RES
   * → final damage". `source` có thể undefined (nguồn đã chết/rời
   * trận) — chỉ ảnh hưởng Kim Thế xuyên kháng + Poison Recovery (2
   * hiệu ứng cần ĐỌC nguồn còn sống), DOT RES phía target vẫn áp bình
   * thường vì đó là stat của TARGET.
   */
  applyDotDamage(params: {
    sourceId: string
    source: CombatEntity | undefined
    // stat-system-reimagined Task 4 (D18) -- the source's own buff list,
    // so authored dotRecovery triggers (Doc Can) can be read at tick
    // time. Callers resolve it alongside `source` (resolveSourceBuffs);
    // absent = no recovery contribution.
    sourceBuffs?: readonly Buff[]
    target: CombatEntity
    rawDamage: number
    element?: ElementType | 'physical'
    effectId: string
  }) {
    const { sourceId, source, sourceBuffs, target, rawDamage, element, effectId } = params

    const mitigation = Math.min(DOT_RESISTANCE_CAP, Math.max(DOT_RESISTANCE_FLOOR, target.stats.dotResistancePercent))

    // stat-system-reimagined Task 6 (D13/INV-4) — DoT is a closed
    // economy: dotResistancePercent (minus authored penetration) is the
    // ONLY mitigation. finalDamageMultiplier (finalDamagePercent/
    // finalDamageReductionPercent) is a HIT-layer lever and does NOT
    // apply here; ward/MP shield/leech never see DoT either.
    const finalDamage = Math.max(0, rawDamage * (1 - mitigation))

    // hpDamage contract (review 2026-09-15): DoT has no absorb layers,
    // but the 0-clamp still applies — an overkill tick reports only the
    // HP the target actually had.
    const actualHpDamage = this.vitals.applyDamage(target, finalDamage, 'dot', sourceId)

    this.eventBus.emit('damage', {
      type: 'damage',

      sourceId,

      targetId: target.id,

      value: finalDamage,

      hpDamage: actualHpDamage,

      damageType: 'elemental',

      effectId,
    })

    // stat-system-reimagined Task 4 (D18) — authored DoT recovery: buff
    // effects of type 'dotRecovery' on the SOURCE heal it for a fraction
    // of the damage THẬT SỰ đã trừ (sau DOT RES và HP clamp — overkill
    // ticks cannot recover more than the target lost). The element match
    // is authored on the effect (Doc Can = 'wood'), not hardcoded here —
    // dead/absent sources recover nothing. Reason 'healing', not 'leech':
    // this is an authored recovery trigger that DOES scale with the
    // source's healingEffectivenessPercent, unlike damage-derived leech.
    const recovery = dotRecoveryTriggers(source, element, sourceBuffs)

    if (source && recovery > 0) {
      this.applyHealing(source, actualHpDamage * recovery, source.id, 'healing')
    }

    this.killIfDead(target, sourceId)
  }

  /**
   * Public — AilmentSystem (DoT tick) dùng chung để đảm bảo chết vì
   * hiệu ứng theo thời gian cũng emit đúng 'death'/'kill' như chết vì
   * đòn đánh trực tiếp, không lặp code kiểm tra HP<=0 ở 2 nơi.
   */
  killIfDead(
    entity: CombatEntity,
    killerId: string,
    skillContext?: { killer: CombatEntity; skillId: string },
  ) {
    if (entity.currentHp > 0 || !entity.alive) {
      return
    }

    // Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — đòn lẽ ra
    // chết thành sống sót HP = 1, trừ 1 lượt của trận. KHÔNG kích hoạt
    // trong trận Độ Kiếp (session null — GameManager.beginTribulation xoá).
    //
    // The Tu Reimagined (plan Task 9, D9) — the session's ordered
    // extraSources run BEFORE the talent guard: Bat Tu Ba The's ultimate
    // is the first line; the talent charge is the extra life once the
    // ult is spent/on cooldown. Each source returns a result object —
    // HP=1 plus an OPTIONAL buff grant (a free survive grants nothing,
    // so an active buff can never be refreshed by repeat lethals).
    const surviveSession = this.surviveLethalSession

    if (surviveSession && entity.id === surviveSession.playerEntityId) {
      const applySurviveResult = (
        result: { grantBuffId?: string; grantBuffDurationOverride?: number; cleanseDebuffs?: boolean },
      ) => {
        entity.currentHp = 1

        // v4 (spec 2026-09-03 §4.1) — "độ thân cũng là độ tâm": tẩy mọi
        // debuff đang bám trên player + áp buff sống sót. Chỉ chạy khi
        // session mang surviveEffects (GameManager wiring set từ battle
        // hiện tại — BuffSystem của PLAYER, không phải của địch).
        const effects = surviveSession.surviveEffects

        if (effects) {
          if (result.cleanseDebuffs !== false) {
            for (const buff of effects.buffSystem.getAll()) {
              if (buff.polarity === 'debuff' && buff.targetId === entity.id) {
                effects.buffSystem.remove(buff.id, buff.sourceId)
              }
            }
          }

          const grantId = result.grantBuffId

          if (grantId) {
            const grantBuff = effects.registry.get(grantId)

            if (grantBuff) {
              // clearsCcOnApply (Bat Tu Ba The, Task 9/11) — the grant
              // path strips the pool's cc effects before the buff lands,
              // same as the appliesBuffs resolution path.
              if (grantBuff.clearsCcOnApply) {
                effects.buffSystem.clearCcEffects()
              }
              effects.buffSystem.apply(grantBuff, entity, entity, effects.registry, result.grantBuffDurationOverride)
            }
          }
        }

        // Event vitals của đòn damage (emit TRƯỚC killIfDead) đã mang
        // killed = true vì HP chạm 0 — phát thêm event hiệu chỉnh SAU khi
        // guard giữ lượt sống sót để consumer (HUD/scene) đọc trạng thái
        // CUỐI là còn sống, không kẹt ở hình ảnh "đã chết".
        this.vitals.emitCurrent(entity, 'survive_lethal', 1, {
          hp: 0,
          ward: entity.currentWard,
          mp: entity.currentMp,
        }, killerId)

        this.eventBus.emit('talent_survive_lethal', {
          type: 'talent_survive_lethal',
          entityId: entity.id,
          sourceId: killerId,
        })
      }

      for (const source of surviveSession.extraSources ?? []) {
        const result = source.trySurvive(entity)

        if (result.survived) {
          applySurviveResult(result)
          return
        }
      }

      if (surviveSession.guard.tryConsumeUse()) {
        const effects = surviveSession.surviveEffects
        applySurviveResult({
          grantBuffId: effects?.grantBuffId,
          cleanseDebuffs: effects?.cleanseDebuffs,
        })
        return
      }
    }

    entity.alive = false

    this.eventBus.emit('death', {
      type: 'death',

      sourceId: killerId,

      targetId: entity.id,
    })

    this.eventBus.emit('kill', {
      type: 'kill',

      sourceId: killerId,

      targetId: entity.id,
    })

    this.fireKillTriggers(entity, skillContext)
  }

  // Task 10 — onKill fires on the KILLER's own casting skill (known via
  // skillContext.skillId, which is always the killer's skill). Only
  // fires when the caller supplied BOTH a killer CombatEntity and a
  // skillId (see killIfDead's doc): CombatSystem has no entity registry
  // to resolve a bare killerId string into a CombatEntity, and no
  // "currently casting skill" concept on its own — callers that only
  // have a killerId (applyDirectDamage/applyModifiedDirectDamage/
  // applyDotDamage today) skip firing, same as non-skill deaths
  // (DoT ticks, ward-break).
  //
  // onDeath is intentionally NOT fired here (2026-09-01 review ruling,
  // overriding the original brief's Step 3 snippet): onDeath is meant to
  // represent "the DYING entity's OWN skill has an onDeath binding",
  // which requires enumerating the VICTIM's skills for one with an
  // onDeath trigger — but CombatSystem/SkillManager only expose lookup
  // by a single known skillId (skillManager.get(id)), not "all skills
  // belonging to entity X". skillContext.skillId is the KILLER's skill,
  // so firing onDeath against it here would attribute the trigger to the
  // wrong entity's skill. Deferred to a future task once a per-entity
  // skill-list lookup exists; OnDeathContext/the 'onDeath' TriggerType
  // (Task 1) stay declared, just unfired from this call site for now.
  //
  // buffRegistry is a shared, non-battle-specific
  // dependency — injected via the constructor (2026-09-01 review fix)
  // and used for real here when provided; skip firing entirely if
  // missing rather than constructing an empty throwaway registry
  // (BuffDefinitionCatalog.get() THROWS on a miss, so an empty throwaway registry
  // would crash killIfDead() mid-battle-tick the first time a bound
  // action looked one up — not silently no-op).
  //
  // sourceBuffs/targetBuffs ARE still throwaway/stubbed (unchanged from
  // the original design): those are the per-battle BUFF POOLS for this
  // battle's specific entities (as opposed to the shared REGISTRY that
  // defines what buffs exist at all), and CombatSystem has no access to
  // BattleSystem's real per-battle pools. An onKill action that only
  // touches CombatEntity fields directly (grantResource/consumeResource)
  // works correctly through this path; an onKill action that reads/
  // writes a persistent buff POOL (as opposed to just looking up a
  // registry definition) will not see/affect the real battle-scoped pool.
  private fireKillTriggers(
    victim: CombatEntity,
    skillContext?: { killer: CombatEntity; skillId: string },
  ): void {
    if (!skillContext || !this.skillManager || !this.buffRegistry) {
      return
    }

    const skill = this.skillManager.get(skillContext.skillId)

    if (!skill?.triggers?.length) {
      return
    }

    const ctx: SkillEffectContext = {
      combatSystem: this,
      fireHit: () => ({ landed: true }),
      buffRegistry: this.buffRegistry,
      sourceBuffs: new BuffSystem(new BuffPool()),
      targetBuffs: new BuffSystem(new BuffPool()),
    }

    this.skillTriggerRunner.fire(
      'onKill',
      { source: skillContext.killer, target: victim, skill },
      skill.triggers,
      skillContext.killer,
      victim,
      ctx,
    )
  }
}
