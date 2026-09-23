import type { EventBus } from '../events/EventBus'
import type { SkillManager } from './SkillManager'
import type { SkillSystem } from './SkillSystem'
import type { PassiveTrigger } from './SkillTypes'
import type { Skill } from './Skill'
import { addStack } from '../stats/StatCalculator'
import type { StatModifier } from '../stats/StatCalculator'
import type { PlayerData } from '../player/Player'
import { getPassiveStackCarry } from '../talent/TalentEffects'

export interface CombatEventPayload {
  type: string
  sourceId?: string
  targetId?: string
}

export const PLAYER_ID = 'player'

/**
 * EventBus dung ten event tu do (string), khong phai PassiveTrigger.
 * CombatSystem.attack() emit 'damage' cho su kien "bi danh trung" -
 * map sang PassiveTrigger 'damage_taken' de khop nghia; cac ten con
 * lai trung thang voi gia tri PassiveTrigger. 'cast' duoc
 * BattleSystem.castSkill() emit rieng (xem BattleSystem.ts). 'dodge'
 * gio duoc CombatSystem.resolveDodge() emit that (ne don - xem
 * CombatSystem.ts), targetId la ben ne duoc.
 *
 * Export de FormationSystem.ts (tran phap kham vu khi, cung co che
 * trigger nhung theo trang bi thay vi theo skill) dung chung, tranh
 * lap bang map nay o 2 noi.
 */
export const EVENT_TO_TRIGGER: Record<string, PassiveTrigger> = {
  attack: 'attack',
  hit: 'hit',
  critical: 'critical',
  kill: 'kill',
  cast: 'cast',
  damage: 'damage_taken',
  dodge: 'dodge',
  block: 'block',
}

// 'damage_taken'/'dodge'/'block' xay ra CHO player (player la target)
// - con lai xay ra DO player gay ra (player la source). Export de
// FormationSystem.ts dung chung, tranh lech logic giua 2 noi.
export const TARGET_BASED_TRIGGERS: PassiveTrigger[] = ['damage_taken', 'dodge', 'block']

/**
 * Tich stack cho skill.passiveModifiers - truoc day khong noi nao
 * lam viec nay (comment cu trong GameManager nhac applySkillEvent()
 * nhung ham do chua tung viet). Mutate truc tiep modifier trong
 * object Skill dang nam o SkillManager (giong Technique/Skill level
 * mutate tai cho), khong dung ModifierSystem rieng - nho vay stack
 * tu dong round-trip qua save/load cung voi Skill.
 */
export class PassiveSystem {
  private readonly perSecondAccumulator = new Map<string, number>()

  constructor(
    eventBus: EventBus,
    private readonly skillManager: SkillManager,
    private readonly skillSystem: SkillSystem,
    // Talent v4 (spec 2026-09-03 S3.3 E2) - 2 closure do GameManager
    // cung cap, optional theo pattern CombatSystem (moi call site hien
    // co compile khong doi): buffApplier ap buff "bung no" len player
    // entity trong tran; hpReader tra HP ratio hien tai cua player
    // (undefined ngoai tran -> passiveCondition coi nhu thoa).
    private readonly buffApplier?: (buffId: string) => void,
    private readonly hpReader?: () => number | undefined,
  ) {
    for (const eventName of Object.keys(EVENT_TO_TRIGGER)) {
      eventBus.on<CombatEventPayload>(eventName, event => this.handleEvent(eventName, event))
    }
  }

  // Talent v4 E2 - passiveCondition chi co 1 kind hien nay ('hpBelow'),
  // de union mo duoc sau nay ma khong doi call site. Vang condition hoac
  // vang reader -> luon true (khong chan passive cu).
  private meetsCondition(condition: Skill['passiveCondition']): boolean {
    if (!condition || condition.kind !== 'hpBelow') {
      return true
    }

    const hpRatio = this.hpReader?.()

    return hpRatio === undefined ? true : hpRatio < condition.percent
  }

  // Talent v4 E2 - modifier vua tich cham maxStacks: ap buff bung no
  // (neu co applier) roi reset stack ve 0. Vang passiveConvertsTo thi
  // giu hanh vi cu (stack ket o tran).
  private tryConvertAtThreshold(
    modifier: StatModifier,
    convertsTo: Skill['passiveConvertsTo'],
  ): void {
    if (!convertsTo) {
      return
    }

    if (modifier.maxStacks === undefined || (modifier.stacks ?? 0) < modifier.maxStacks) {
      return
    }

    this.buffApplier?.(convertsTo.buffId)

    modifier.stacks = 0
  }

  private handleEvent(eventName: string, event: CombatEventPayload) {
    const trigger = EVENT_TO_TRIGGER[eventName]

    if (!trigger) {
      return
    }

    // Chi tich passive cua player - enemy chua co khai niem passive
    // rieng o scope hien tai.
    const relevant = TARGET_BASED_TRIGGERS.includes(trigger)
      ? event.targetId === PLAYER_ID
      : event.sourceId === PLAYER_ID

    if (!relevant) {
      return
    }

    for (const skill of this.skillManager.getPassiveSkills()) {
      // Core Loop Foundation checklist (Muc SKILL) - doc qua
      // getEffectiveSkill() de ton trong Specialization da chon
      // (co the doi han passiveTrigger/passiveModifiers).
      const effective = this.skillSystem.getEffectiveSkill(skill)

      if (effective.passiveTrigger !== trigger) {
        continue
      }

      // Talent v4 E2 - dieu kien HP chan TRUOC khi tich stack.
      if (!this.meetsCondition(effective.passiveCondition)) {
        continue
      }

      for (const modifier of effective.passiveModifiers ?? []) {
        addStack(modifier)

        this.tryConvertAtThreshold(modifier, effective.passiveConvertsTo)
      }
    }
  }

  /**
   * Dua stack cua moi passive skill ve 0 - goi khi 1 tran MOI bat
   * dau (xem GameManager.startBattle()). Theo yeu cau: cac chi so
   * tich luy qua passive (vd Linh Khi Cam Ung +cong kich/don trung)
   * la buff TRONG TRAN, khong tich luy qua nhieu tran/save nua -
   * khac thiet ke permanent progression ban dau.
   */
  resetStacks() {
    for (const skill of this.skillManager.getPassiveSkills()) {
      const effective = this.skillSystem.getEffectiveSkill(skill)

      for (const modifier of effective.passiveModifiers ?? []) {
        modifier.stacks = 0
      }
    }

    this.perSecondAccumulator.clear()
  }

  /**
   * Talent v4 M2 - Pha Giap carry (spec S4.1 row 2 / S7): a fraction of
   * the bound passive's stacks banks into player.phaGiapCarryStacks at
   * battle victory and re-seeds the next battle (call AFTER resetStacks).
   * The bank decays when realmId changes - a new realm wipes the old
   * blade marks. Banked stacks belong to the realm they were earned in;
   * both fields are persisted on PlayerData (save v61).
   */
  bankBattleCarryStacks(player: PlayerData): void {
    const carry = getPassiveStackCarry(player.selectedTalentIds, player.talentLevels)

    if (!carry) {
      return
    }

    const skill = this.skillManager.get(carry.passiveSkillId)

    if (!skill) {
      return
    }

    const effective = this.skillSystem.getEffectiveSkill(skill)
    const stacks = (effective.passiveModifiers ?? []).reduce(
      (sum, modifier) => sum + (modifier.stacks ?? 0),
      0,
    )

    player.phaGiapCarryStacks = Math.floor(stacks * carry.fraction)
    player.phaGiapCarryRealmId = player.realmId
  }

  /**
   * Re-seed the carried stacks onto the bound passive - call once per
   * battle AFTER resetStacks(). Realm change lazily decays the bank
   * (the bank records the realm it was earned in).
   */
  seedBattleCarryStacks(player: PlayerData): void {
    const carry = getPassiveStackCarry(player.selectedTalentIds, player.talentLevels)

    if (!carry) {
      return
    }

    if (
      player.phaGiapCarryRealmId !== null &&
      player.phaGiapCarryRealmId !== undefined &&
      player.phaGiapCarryRealmId !== player.realmId
    ) {
      player.phaGiapCarryStacks = 0
      player.phaGiapCarryRealmId = null
    }

    let remaining = Math.floor(player.phaGiapCarryStacks ?? 0)

    if (remaining <= 0) {
      return
    }

    const skill = this.skillManager.get(carry.passiveSkillId)

    if (!skill) {
      return
    }

    const effective = this.skillSystem.getEffectiveSkill(skill)

    for (const modifier of effective.passiveModifiers ?? []) {
      const capacity = modifier.maxStacks ?? remaining
      const seeded = Math.min(capacity - (modifier.stacks ?? 0), remaining)

      if (seeded <= 0) {
        continue
      }

      modifier.stacks = (modifier.stacks ?? 0) + seeded
      remaining -= seeded

      if (remaining <= 0) {
        break
      }
    }
  }

  /**
   * Passive co passiveTrigger === 'per_second' tich 1 stack moi
   * giay day du troi qua - accumulator rieng theo tung skill de
   * khong mat phan le giua cac tick.
   */
  tick(deltaSeconds: number) {
    for (const skill of this.skillManager.getPassiveSkills()) {
      const effective = this.skillSystem.getEffectiveSkill(skill)

      if (effective.passiveTrigger !== 'per_second') {
        continue
      }

      const accumulated = (this.perSecondAccumulator.get(skill.id) ?? 0) + deltaSeconds

      const wholeSeconds = Math.floor(accumulated)

      if (wholeSeconds <= 0) {
        this.perSecondAccumulator.set(skill.id, accumulated)

        continue
      }

      // Talent v4 E2 - per_second chiu cung passiveCondition nhu passive
      // theo event (chan truoc khi tich, phan le accumulator giu nguyen).
      if (!this.meetsCondition(effective.passiveCondition)) {
        this.perSecondAccumulator.set(skill.id, accumulated)

        continue
      }

      for (const modifier of effective.passiveModifiers ?? []) {
        addStack(modifier, wholeSeconds)

        this.tryConvertAtThreshold(modifier, effective.passiveConvertsTo)
      }

      this.perSecondAccumulator.set(skill.id, accumulated - wholeSeconds)
    }
  }
}
