import { ACHIEVEMENTS, ACHIEVEMENT_MATERIAL_COUNTERS, ACHIEVEMENT_ENEMY_COUNTERS } from '../../data/achievement/achievements'
import { utcDayBucket } from '../idle/GameClock'
import type { AchievementAuthority, AchievementClaimAward, AchievementClaimResult, AchievementCounter,
  AchievementLedgerState, AchievementOwnerSnapshot, AchievementReadModel, AchievementReceipt } from './Achievement'
import { AchievementRegistry, natural, nonempty, strings } from './AchievementRegistry'
import { evaluateAchievement } from './AchievementEvaluator'
import { cloneAchievementLedger, emptyAchievementLedger, parseAchievementLedger, preservesAchievementHistory } from './AchievementPersistence'

const authorities: Record<AchievementReceipt['kind'], AchievementAuthority> = {
  material_delivered: 'inventory', enemy_defeated: 'battle', production_batch_claimed: 'production',
  equipment_equipped: 'equipment', body_refinement_committed: 'body', alchemy_crafted: 'alchemy',
  equipment_enhanced: 'equipment', battle_victory: 'battle', technique_rank_reached: 'technique',
  companion_entitled: 'companion', formation_companion_assigned: 'formation',
  daily_quest_claimed: 'quest', weekly_quest_claimed: 'quest',
}
const addUnique = <T>(values: T[], value: T) => { if (!values.includes(value)) values.push(value) }

/** Dormant headless authority. Callers must supply durable, producer-owned witnesses. */
export class AchievementSystem {
  private state: AchievementLedgerState
  private settling = false
  private readonly registry: AchievementRegistry

  constructor(private readonly playerId: string, private readonly enabledAt: number, registry = new AchievementRegistry(ACHIEVEMENTS)) {
    if (!nonempty(playerId) || !natural(enabledAt)) throw new Error('Achievement identity and activation baseline are required')
    this.registry = registry
    this.state = emptyAchievementLedger(playerId, enabledAt)
  }

  get(id: string): AchievementReadModel | undefined {
    const row = this.registry.get(id)
    return row ? { ...row, reward: { ...row.reward }, ...evaluateAchievement(row, this.state), claimed: this.state.claimedIds.includes(id) } : undefined
  }

  getAll(): readonly AchievementReadModel[] {
    return this.registry.getAll().map((row) => this.get(row.id)!)
  }

  snapshot(): AchievementLedgerState {
    if (this.settling) throw new Error('Achievement settlement must finish before saving')
    return cloneAchievementLedger(this.state)
  }

  restore(input: unknown): boolean {
    if (this.settling) return false
    const next = parseAchievementLedger(input, this.playerId, this.enabledAt, this.registry)
    if (!next || !preservesAchievementHistory(this.state, next)) return false
    this.state = next
    return true
  }

  private updateCompanionFacts(next: AchievementLedgerState): void {
    if (next.entitledCompanionIds.length) addUnique(next.facts, 'companion:entitled')
    if (next.assignedCompanionIds.some((id) => next.entitledCompanionIds.includes(id))) addUnique(next.facts, 'companion:assigned')
  }

  reconcile(snapshot: AchievementOwnerSnapshot): boolean {
    if (this.settling || !snapshot || snapshot.playerId !== this.playerId || !natural(this.state.revision + 1)
      || !strings(snapshot.completedStageIds) || !strings(snapshot.completedOnceIds)
      || !strings(snapshot.reachedRealmIds) || !strings(snapshot.attainedElementIds)
      || (snapshot.techniqueRankThreeEver !== undefined && typeof snapshot.techniqueRankThreeEver !== 'boolean')
      || (snapshot.entitledCompanionIds !== undefined && !strings(snapshot.entitledCompanionIds))
      || (snapshot.assignedCompanionIds !== undefined && !strings(snapshot.assignedCompanionIds))) return false
    const next = cloneAchievementLedger(this.state)
    for (const [prefix, ids] of [['stage', snapshot.completedStageIds], ['quest', snapshot.completedOnceIds],
      ['realm', snapshot.reachedRealmIds], ['element', snapshot.attainedElementIds]] as const) {
      for (const id of ids) addUnique(next.facts, `${prefix}:${id}`)
    }
    if (snapshot.techniqueRankThreeEver) addUnique(next.facts, 'technique:rank3')
    for (const id of snapshot.entitledCompanionIds ?? []) addUnique(next.entitledCompanionIds, id)
    for (const id of snapshot.assignedCompanionIds ?? []) addUnique(next.assignedCompanionIds, id)
    this.updateCompanionFacts(next)
    if (JSON.stringify(next) === JSON.stringify(this.state)) return true
    next.revision++
    this.state = next
    return true
  }

  ingest(receipt: AchievementReceipt): boolean {
    if (this.settling || !receipt || receipt.playerId !== this.playerId || receipt.committed !== true
      || !nonempty(receipt.eventId) || !nonempty(receipt.sourceId) || !natural(receipt.occurredAt)
      || receipt.occurredAt < this.enabledAt
      || !Object.hasOwn(authorities, receipt.kind) || receipt.authority !== authorities[receipt.kind]
      || this.state.receiptIds.includes(receipt.eventId) || !natural(this.state.revision + 1)) return false
    const next = cloneAchievementLedger(this.state)
    let operation: string | undefined
    const increment = (counter: AchievementCounter, amount = 1) => {
      const value = (next.counters[counter] ?? 0) + amount
      if (!natural(value)) return false
      next.counters[counter] = value
      return true
    }
    switch (receipt.kind) {
      case 'material_delivered': {
        if (!nonempty(receipt.materialId) || !natural(receipt.quantityDelivered) || receipt.quantityDelivered === 0) return false
        const counter = Object.hasOwn(ACHIEVEMENT_MATERIAL_COUNTERS, receipt.materialId) ? ACHIEVEMENT_MATERIAL_COUNTERS[receipt.materialId] : undefined
        if (counter && !increment(counter, receipt.quantityDelivered)) return false
        break
      }
      case 'enemy_defeated': {
        if (!nonempty(receipt.enemyId)) return false
        const counter = Object.hasOwn(ACHIEVEMENT_ENEMY_COUNTERS, receipt.enemyId) ? ACHIEVEMENT_ENEMY_COUNTERS[receipt.enemyId] : undefined
        if (counter && !increment(counter)) return false
        break
      }
      case 'production_batch_claimed':
        if (!nonempty(receipt.batchId) || !nonempty(receipt.realmAtCommit)) return false
        operation = `batch:${receipt.batchId}`
        if (receipt.realmAtCommit === 'mortal' && !increment('production_batches')) return false
        break
      case 'equipment_equipped':
        if (!nonempty(receipt.instanceId)) return false
        addUnique(next.equipmentInstanceIds, receipt.instanceId)
        next.counters.unique_equipment = next.equipmentInstanceIds.length
        break
      case 'body_refinement_committed':
        if (!['mortal', 'qi_refining', 'foundation_establishment'].includes(receipt.realmAtCommit) || !increment('body_all')) return false
        if (receipt.realmAtCommit === 'foundation_establishment' && !increment('body_foundation')) return false
        break
      case 'alchemy_crafted':
        if (!nonempty(receipt.craftId) || !increment('alchemy_crafts')) return false
        operation = `craft:${receipt.craftId}`
        break
      case 'equipment_enhanced':
        if (!nonempty(receipt.enhancementId) || !increment('enhancements')) return false
        operation = `enhance:${receipt.enhancementId}`
        break
      case 'battle_victory':
        if (!nonempty(receipt.battleId) || typeof receipt.formationAtBattleStart !== 'boolean') return false
        operation = `battle:${receipt.battleId}`
        if (receipt.formationAtBattleStart && !increment('formed_victories')) return false
        break
      case 'technique_rank_reached':
        if (!natural(receipt.rank) || receipt.rank < 1) return false
        if (receipt.rank >= 3) addUnique(next.facts, 'technique:rank3')
        break
      case 'companion_entitled':
      case 'formation_companion_assigned':
        if (!nonempty(receipt.companionId)) return false
        addUnique(receipt.kind === 'companion_entitled' ? next.entitledCompanionIds : next.assignedCompanionIds, receipt.companionId)
        this.updateCompanionFacts(next)
        break
      case 'daily_quest_claimed':
        if (!nonempty(receipt.claimId) || !natural(receipt.utcDayBucket) || receipt.utcDayBucket !== utcDayBucket(receipt.occurredAt)) return false
        operation = `daily:${receipt.claimId}`
        addUnique(next.dailyClaimDays, receipt.utcDayBucket)
        break
      case 'weekly_quest_claimed':
        if (!nonempty(receipt.claimId) || !natural(receipt.utcWeekBucket) || receipt.utcWeekBucket !== Math.floor((utcDayBucket(receipt.occurredAt) + 3) / 7)) return false
        operation = `weekly:${receipt.claimId}`
        next.weeklyClaims.push({ claimId: receipt.claimId, period: receipt.utcWeekBucket })
        break
    }
    if (operation) {
      if (next.operationIds.includes(operation)) return false
      next.operationIds.push(operation)
    }
    next.receiptIds.push(receipt.eventId)
    next.revision++
    this.state = next
    return true
  }

  /** Settlement must be atomic/idempotent by claimId; true means durably delivered in full. */
  claim(id: string, settle: (award: AchievementClaimAward) => boolean): AchievementClaimResult {
    const row = this.registry.get(id)
    if (!row) return 'unknown-achievement'
    if (this.state.claimedIds.includes(id)) return 'already-claimed'
    if (this.settling || !evaluateAchievement(row, this.state).ready || !natural(this.state.revision + 1)) return 'not-ready'
    const previous = this.state
    this.state = cloneAchievementLedger(previous)
    this.state.claimedIds.push(id)
    this.settling = true
    try {
      const delivered = settle({ claimId: `achievement:${encodeURIComponent(this.playerId)}:${encodeURIComponent(id)}`,
        achievementId: id, playerId: this.playerId, band: row.band, reward: Object.freeze({ ...row.reward }) })
      if (delivered !== true) { this.state = previous; return 'delivery-failed' }
      this.state.revision++
      return 'granted'
    } catch {
      this.state = previous
      return 'delivery-failed'
    } finally { this.settling = false }
  }
}
