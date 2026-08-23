import type { CombatEntity } from './CombatEntity'
import type { EventBus } from '../events/EventBus'

export type VitalsChangeReason = 'damage' | 'dot' | 'thorns' | 'ward_break' | 'healing' | 'leech' | 'regen' | 'reaction' | 'heavenly_tribulation'

export interface EntityVitalsChangedEvent {
  type: 'entity_vitals_changed'
  entityId: string
  sourceId?: string
  reason: VitalsChangeReason
  hpBefore: number
  hpAfter: number
  maxHp: number
  wardBefore: number
  wardAfter: number
  maxWard: number
  mpBefore: number
  mpAfter: number
  maxMp: number
  amount: number
  killed: boolean
}

export class EntityVitalsSystem {
  constructor(private readonly eventBus: EventBus) {}

  applyDamage(target: CombatEntity, amount: number, reason: VitalsChangeReason, sourceId?: string) {
    const hpBefore = target.currentHp
    const wardBefore = target.currentWard
    const mpBefore = target.currentMp
    const applied = Math.max(0, amount)

    target.currentHp = Math.max(0, target.currentHp - applied)
    this.emit(target, reason, applied, hpBefore, wardBefore, mpBefore, sourceId)

    return hpBefore - target.currentHp
  }

  applyHpDamageFromSnapshot(
    target: CombatEntity,
    hpDamage: number,
    totalDamage: number,
    reason: VitalsChangeReason,
    before: { hp: number; ward: number; mp: number },
    sourceId?: string,
  ) {
    target.currentHp = Math.max(0, target.currentHp - Math.max(0, hpDamage))
    this.emit(target, reason, totalDamage, before.hp, before.ward, before.mp, sourceId)
    return before.hp - target.currentHp
  }

  clampToMaxHp(target: CombatEntity, reason: VitalsChangeReason, sourceId?: string) {
    const hpBefore = target.currentHp
    const wardBefore = target.currentWard
    const mpBefore = target.currentMp

    target.currentHp = Math.min(target.currentHp, target.maxHp)
    this.emit(target, reason, hpBefore - target.currentHp, hpBefore, wardBefore, mpBefore, sourceId)
  }

  applyHealing(target: CombatEntity, amount: number, reason: VitalsChangeReason, sourceId?: string) {
    const hpBefore = target.currentHp
    const wardBefore = target.currentWard
    const mpBefore = target.currentMp
    const applied = Math.max(0, amount)

    target.currentHp = Math.min(target.maxHp, target.currentHp + applied)
    this.emit(target, reason, applied, hpBefore, wardBefore, mpBefore, sourceId)

    return target.currentHp - hpBefore
  }

  emitCurrent(target: CombatEntity, reason: VitalsChangeReason, amount: number, before: {
    hp: number
    ward: number
    mp: number
  }, sourceId?: string) {
    this.emit(target, reason, amount, before.hp, before.ward, before.mp, sourceId)
  }

  private emit(
    target: CombatEntity,
    reason: VitalsChangeReason,
    amount: number,
    hpBefore: number,
    wardBefore: number,
    mpBefore: number,
    sourceId?: string,
  ) {
    this.eventBus.emit<EntityVitalsChangedEvent>('entity_vitals_changed', {
      type: 'entity_vitals_changed',
      entityId: target.id,
      sourceId,
      reason,
      hpBefore,
      hpAfter: target.currentHp,
      maxHp: target.maxHp,
      wardBefore,
      wardAfter: target.currentWard,
      maxWard: target.stats.wardMax,
      mpBefore,
      mpAfter: target.currentMp,
      maxMp: target.stats.maxMp,
      amount,
      killed: target.currentHp <= 0,
    })
  }
}
