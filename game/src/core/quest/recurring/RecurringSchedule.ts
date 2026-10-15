import { utcDayBucket, utcWeekBucket } from '../../idle/GameClock'

export type RecurringCadence = 'daily' | 'weekly'
export type RecurringRealmBand = 'mortal' | 'qi_refining' | 'foundation_establishment'

export interface RecurringOffer {
  templateId: string
  variantId: string
}

export interface RecurringBoard {
  cadence: RecurringCadence
  period: number
  saveId: string
  contentVersion: string
  realmBand: RecurringRealmBand
  offers: RecurringOffer[]
  claimedTemplateIds: string[]
}

export interface RecurringScheduleState {
  daily: RecurringBoard | null
  weekly: RecurringBoard | null
}

export type ReconcileResult =
  | { kind: 'assigned' | 'existing'; board: RecurringBoard }
  | { kind: 'insufficient_pool'; eligibleCount: number }
  | { kind: 'invalid_time' | 'invalid_input' | 'clock_rollback' | 'identity_mismatch' | 'busy' }

export type ClaimResult =
  | { kind: 'claimed'; board: RecurringBoard }
  | {
      kind:
        | 'missing_board'
        | 'invalid_time'
        | 'expired'
        | 'not_offered'
        | 'already_claimed'
        | 'quota_exhausted'
        | 'objective_incomplete'
        | 'reward_failed'
        | 'invalid_input'
        | 'busy'
    }

const DAY_MS = 86_400_000
const MAX_DATE_MS = 8_640_000_000_000_000
const MAX_DAY_PERIOD = Math.floor(MAX_DATE_MS / DAY_MS)
const MAX_WEEK_PERIOD = Math.floor((MAX_DAY_PERIOD - 4) / 7)
const OFFER_COUNT = 3
const CLAIM_LIMIT = 2

function isCadence(value: unknown): value is RecurringCadence {
  return value === 'daily' || value === 'weekly'
}

function isRealmBand(value: unknown): value is RecurringRealmBand {
  return value === 'mortal' || value === 'qi_refining' || value === 'foundation_establishment'
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOffer(value: unknown): value is RecurringOffer {
  return typeof value === 'object' && value !== null &&
    'templateId' in value && isNonemptyString(value.templateId) &&
    'variantId' in value && isNonemptyString(value.variantId)
}

function isValidPeriod(cadence: RecurringCadence, period: unknown): period is number {
  return Number.isSafeInteger(period) &&
    (cadence === 'daily'
      ? (period as number) >= 0 && (period as number) <= MAX_DAY_PERIOD
      : (period as number) >= -1 && (period as number) <= MAX_WEEK_PERIOD)
}

export { utcWeekBucket } from '../../idle/GameClock'

export function recurringPeriodBucket(cadence: RecurringCadence, timestampMs: number): number {
  return cadence === 'daily' ? utcDayBucket(timestampMs) : utcWeekBucket(timestampMs)
}

export function nextRecurringResetAt(cadence: RecurringCadence, period: number): number {
  return cadence === 'daily' ? (period + 1) * DAY_MS : ((period + 1) * 7 + 4) * DAY_MS
}

function isValidTimestamp(ms: number): boolean {
  return Number.isFinite(ms) && ms >= 0 && ms <= MAX_DATE_MS
}

function copyBoard(board: RecurringBoard): RecurringBoard {
  return {
    ...board,
    offers: board.offers.map((offer) => ({ ...offer })),
    claimedTemplateIds: [...board.claimedTemplateIds],
  }
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }
  return hash >>> 0
}

function eligiblePool(offers: readonly RecurringOffer[]): RecurringOffer[] {
  const byId = new Map<string, RecurringOffer>()
  for (const offer of offers) {
    const existing = byId.get(offer.templateId)
    if (!existing || offer.variantId < existing.variantId) {
      byId.set(offer.templateId, { ...offer })
    }
  }
  return [...byId.values()]
}

/**
 * Domain scheduler: the caller supplies a producer-verified eligible pool.
 * Opening UI must never call reconcile or claim.
 * Reward granting remains with the real reward authority: grantAtomically
 * must either settle the complete reward or return false with no mutations.
 */
export class RecurringSchedule {
  private state: RecurringScheduleState = { daily: null, weekly: null }
  private pendingClaim: { cadence: RecurringCadence; templateId: string } | null = null

  getBoard(cadence: RecurringCadence): RecurringBoard | null {
    const board = this.state[cadence]
    return board === null ? null : copyBoard(board)
  }

  getState(): RecurringScheduleState {
    return {
      daily: this.getBoard('daily'),
      weekly: this.getBoard('weekly'),
    }
  }

  reconcile(input: {
    cadence: RecurringCadence
    nowMs: number
    saveId: string
    contentVersion: string
    realmBand: RecurringRealmBand
    eligibleOffers: readonly RecurringOffer[]
  }): ReconcileResult {
    if (this.pendingClaim !== null) return { kind: 'busy' }
    if (!isValidTimestamp(input.nowMs)) return { kind: 'invalid_time' }
    if (
      !isCadence(input.cadence) || !isNonemptyString(input.saveId) ||
      !isNonemptyString(input.contentVersion) || !isRealmBand(input.realmBand) ||
      !Array.isArray(input.eligibleOffers) || !input.eligibleOffers.every(isOffer)
    ) return { kind: 'invalid_input' }
    const period = recurringPeriodBucket(input.cadence, input.nowMs)
    const existing = this.state[input.cadence]
    if (existing !== null) {
      if (existing.saveId !== input.saveId) return { kind: 'identity_mismatch' }
      if (existing.period > period) return { kind: 'clock_rollback' }
      if (existing.period === period) return { kind: 'existing', board: copyBoard(existing) }
    }

    const pool = eligiblePool(input.eligibleOffers)
    if (pool.length < OFFER_COUNT) return { kind: 'insufficient_pool', eligibleCount: pool.length }
    const seed = JSON.stringify([input.saveId, input.cadence, period, input.realmBand, input.contentVersion])
    const selected = pool
      .sort((left, right) => {
        const score = stableHash(`${seed}|${left.templateId}`) - stableHash(`${seed}|${right.templateId}`)
        return score || left.templateId.localeCompare(right.templateId)
      })
      .slice(0, OFFER_COUNT)

    const board: RecurringBoard = {
      cadence: input.cadence,
      period,
      saveId: input.saveId,
      contentVersion: input.contentVersion,
      realmBand: input.realmBand,
      offers: selected,
      claimedTemplateIds: [],
    }
    this.state[input.cadence] = board
    return { kind: 'assigned', board: copyBoard(board) }
  }

  claim(input: {
    cadence: RecurringCadence
    templateId: string
    nowMs: number
    isObjectiveComplete: (offer: RecurringOffer, board: RecurringBoard) => boolean
    grantAtomically: (offer: RecurringOffer, board: RecurringBoard) => boolean
  }): ClaimResult {
    if (
      !isCadence(input.cadence) || !isNonemptyString(input.templateId) ||
      typeof input.isObjectiveComplete !== 'function' ||
      typeof input.grantAtomically !== 'function'
    ) return { kind: 'invalid_input' }
    const board = this.state[input.cadence]
    if (board === null) return { kind: 'missing_board' }
    if (!isValidTimestamp(input.nowMs)) return { kind: 'invalid_time' }
    if (recurringPeriodBucket(input.cadence, input.nowMs) !== board.period) {
      return { kind: 'expired' }
    }
    const offer = board.offers.find((candidate) => candidate.templateId === input.templateId)
    if (!offer) return { kind: 'not_offered' }
    if (board.claimedTemplateIds.includes(input.templateId)) return { kind: 'already_claimed' }
    if (board.claimedTemplateIds.length >= CLAIM_LIMIT) return { kind: 'quota_exhausted' }
    if (this.pendingClaim !== null) {
      return {
        kind: this.pendingClaim.cadence === input.cadence &&
          this.pendingClaim.templateId === input.templateId ? 'already_claimed' : 'busy',
      }
    }

    const detachedBoard = copyBoard(board)
    // Keep the reservation out of persisted snapshots until grant success.
    this.pendingClaim = { cadence: input.cadence, templateId: input.templateId }
    try {
      if (input.isObjectiveComplete({ ...offer }, copyBoard(detachedBoard)) !== true) {
        return { kind: 'objective_incomplete' }
      }
      if (this.state[input.cadence] !== board) {
        return { kind: 'expired' }
      }
      // The reward owner must provide a fully atomic synchronous grant.
      if (input.grantAtomically({ ...offer }, copyBoard(detachedBoard)) !== true) {
        return { kind: 'reward_failed' }
      }
      board.claimedTemplateIds.push(input.templateId)
      return { kind: 'claimed', board: copyBoard(board) }
    } catch {
      return { kind: 'reward_failed' }
    } finally {
      this.pendingClaim = null
    }
  }

  restore(candidate: unknown, expectedSaveId: string): boolean {
    if (this.pendingClaim !== null || !isNonemptyString(expectedSaveId)) return false
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return false
    const input = candidate as Record<string, unknown>
    const next: RecurringScheduleState = { daily: null, weekly: null }
    for (const cadence of ['daily', 'weekly'] as const) {
      const raw = input[cadence]
      if (raw === null) continue
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
      const value = raw as Record<string, unknown>
      if (
        value.cadence !== cadence ||
        !isValidPeriod(cadence, value.period) ||
        value.saveId !== expectedSaveId ||
        !isNonemptyString(value.contentVersion) ||
        !isRealmBand(value.realmBand) ||
        !Array.isArray(value.offers) ||
        value.offers.length !== OFFER_COUNT ||
        !Array.isArray(value.claimedTemplateIds) ||
        value.claimedTemplateIds.length > CLAIM_LIMIT
      ) return false

      const offers: RecurringOffer[] = []
      for (const rawOffer of value.offers) {
        if (
          !isOffer(rawOffer) ||
          offers.some((item) => item.templateId === rawOffer.templateId)
        ) return false
        offers.push({ templateId: rawOffer.templateId, variantId: rawOffer.variantId })
      }
      const claims = value.claimedTemplateIds
      if (
        claims.some((id: unknown) => typeof id !== 'string' || !offers.some((offer) => offer.templateId === id)) ||
        new Set(claims).size !== claims.length
      ) return false
      next[cadence] = {
        cadence,
        period: value.period as number,
        saveId: expectedSaveId,
        contentVersion: value.contentVersion,
        realmBand: value.realmBand as RecurringRealmBand,
        offers,
        claimedTemplateIds: [...claims],
      }
    }
    this.state = next
    return true
  }
}
