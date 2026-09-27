import type { CombatEntity } from './CombatEntity'
import type { EventBus } from '../events/EventBus'
import { clampStatValue } from '../stats/StatMetadata'

export type VitalsChangeReason = 'damage' | 'dot' | 'ward_break' | 'healing' | 'leech' | 'regen' | 'reaction' | 'reflection' | 'heavenly_tribulation' | 'survive_lethal' | 'ward_spend' | 'ward_grant' | 'stat_refresh' | 'sacrifice'

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

/** 6A (2026-09-01) — floating "+N" xanh; emit từ applyHealing (healing/leech). */
export interface CombatHealEvent {
  type: 'heal'
  sourceId?: string
  targetId?: string
  value: number
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

  /**
   * Authoritative ward mutation (R1 / AR-01). Resource spending must go
   * through the vitals owner so observation (vitals events) stays uniform;
   * ward never goes below zero and 0-cost spends still emit for parity.
   */
  spendWard(target: CombatEntity, amount: number, reason: VitalsChangeReason, sourceId?: string) {
    const hpBefore = target.currentHp
    const wardBefore = target.currentWard
    const mpBefore = target.currentMp

    target.currentWard = Math.max(0, target.currentWard - Math.max(0, amount))

    this.emit(target, reason, wardBefore - target.currentWard, hpBefore, wardBefore, mpBefore, sourceId)

    return wardBefore - target.currentWard
  }

  /**
   * Authoritative ward GRANT (combat-contract M3 -- the apply_shield
   * channel's only writer; review r2 HIGH 6: never `currentWard += x`
   * outside the vitals authority). Mirrors spendWard's shape in the
   * opposite direction: clamps at the live wardMax ceiling (same
   * ceiling applyTurnRegen uses), dead entities reject the grant (same
   * boundary as applyHealing -- a ward on a corpse is a phantom), and
   * every grant emits the vitals event so observation stays uniform.
   * `amount` on the event is the ward actually gained.
   */
  grantWard(target: CombatEntity, amount: number, reason: VitalsChangeReason, sourceId?: string) {
    if (!target.alive) {
      return 0
    }

    const hpBefore = target.currentHp
    const wardBefore = target.currentWard
    const mpBefore = target.currentMp

    target.currentWard = Math.min(target.stats.wardMax, target.currentWard + Math.max(0, amount))

    const applied = target.currentWard - wardBefore
    this.emit(target, reason, applied, hpBefore, wardBefore, mpBefore, sourceId)

    return applied
  }

  applyHealing(target: CombatEntity, amount: number, reason: VitalsChangeReason, sourceId?: string) {
    // M8 (ARCH-010) — dead entities reject ordinary healing: no
    // resurrection policy exists, so a heal landing after the death flag
    // (e.g. a post-status-phase heal on a DoT-killed actor) must not
    // silently un-kill or emit a phantom vitals event.
    if (!target.alive) {
      return 0
    }

    const hpBefore = target.currentHp
    const wardBefore = target.currentWard
    const mpBefore = target.currentMp
    // stat-system-reimagined Task 4 (D18/INV-13) — receiver-side heal
    // amplification: every HP restore EXCEPT damage-derived leech scales
    // with the receiver's healingEffectivenessPercent. Leech output stays
    // hpDamage * leechPercent, bitwise.
    const effectiveness =
      reason === 'leech' ? 0 : clampStatValue('healingEffectivenessPercent', target.stats.healingEffectivenessPercent)
    const applied = Math.max(0, amount * (1 + effectiveness))

    target.currentHp = Math.min(target.maxHp, target.currentHp + applied)
    const actualHealing = target.currentHp - hpBefore
    this.emit(target, reason, applied, hpBefore, wardBefore, mpBefore, sourceId)

    // 6A (2026-09-01) — event 'heal' cho floating "+N" xanh trong
    // CombatScene. CHỈ healing/leech (nguồn có ý nghĩa hiển thị),
    // KHÔNG regen (spam mỗi tick) và actual > 0 — the float shows the
    // HP really gained post-clamp, never the pre-clamp attempt.
    if (actualHealing > 0 && (reason === 'healing' || reason === 'leech')) {
      this.eventBus.emit<CombatHealEvent>('heal', {
        type: 'heal',
        sourceId,
        targetId: target.id,
        value: actualHealing,
      })
    }

    return actualHealing
  }

  /**
   * M8 (ARCH-003) — authoritative per-turn resource regeneration.
   * The turn engine (the only production caller) decides WHICH pools
   * regenerate and with what amounts — including the Ward delay gate —
   * once per entity turn; this owner clamps every pool to its live
   * ceiling and emits a single 'regen' vitals event carrying all three
   * before/after views. Dead entities regen nothing (same boundary as
   * applyHealing's dead rejection). No-op calls emit nothing, matching
   * the previous full-HP skip that kept 'regen' events off every tick.
   */
  applyTurnRegen(
    target: CombatEntity,
    deltas: { hp?: number; mp?: number; ward?: number },
    sourceId?: string,
  ): { hp: number; mp: number; ward: number } {
    const applied = { hp: 0, mp: 0, ward: 0 }

    if (!target.alive) {
      return applied
    }

    const hpBefore = target.currentHp
    const wardBefore = target.currentWard
    const mpBefore = target.currentMp

    if ((deltas.hp ?? 0) > 0) {
      // D18/INV-13 — hpRegenPerTurn ticks are HP restores (not
      // damage-derived), so the receiver's healingEffectivenessPercent
      // amplifies them. The mp/ward legs are not HP and never scale.
      const scaled =
        deltas.hp! * (1 + clampStatValue('healingEffectivenessPercent', target.stats.healingEffectivenessPercent))
      target.currentHp = Math.min(target.maxHp, target.currentHp + scaled)
      applied.hp = target.currentHp - hpBefore
    }

    if ((deltas.mp ?? 0) > 0) {
      target.currentMp = Math.min(target.stats.maxMp, target.currentMp + deltas.mp!)
      applied.mp = target.currentMp - mpBefore
    }

    if ((deltas.ward ?? 0) > 0) {
      target.currentWard = Math.min(target.stats.wardMax, target.currentWard + deltas.ward!)
      applied.ward = target.currentWard - wardBefore
    }

    if (applied.hp > 0 || applied.mp > 0 || applied.ward > 0) {
      // `amount` keeps the existing 'regen' contract (the HP portion);
      // mp/ward movement is observable through the before/after fields.
      this.emit(target, 'regen', applied.hp, hpBefore, wardBefore, mpBefore, sourceId)
    }

    return applied
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
