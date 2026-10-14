import type { AchievementCounter, AchievementLedgerState } from './Achievement'
import { ACHIEVEMENT_COUNTERS, natural, strings } from './AchievementRegistry'
import type { AchievementRegistry } from './AchievementRegistry'
import { evaluateAchievement } from './AchievementEvaluator'

export function emptyAchievementLedger(playerId: string, enabledAt: number): AchievementLedgerState {
  return { version: 1, playerId, enabledAt, revision: 0, receiptIds: [], operationIds: [], counters: {},
    equipmentInstanceIds: [], facts: [], claimedIds: [], dailyClaimDays: [], weeklyClaims: [],
    entitledCompanionIds: [], assignedCompanionIds: [] }
}

export function cloneAchievementLedger(state: AchievementLedgerState): AchievementLedgerState {
  return { version: 1, playerId: state.playerId, enabledAt: state.enabledAt, revision: state.revision,
    receiptIds: [...state.receiptIds], operationIds: [...state.operationIds],
    counters: { ...state.counters }, equipmentInstanceIds: [...state.equipmentInstanceIds],
    facts: [...state.facts], claimedIds: [...state.claimedIds], dailyClaimDays: [...state.dailyClaimDays],
    weeklyClaims: state.weeklyClaims.map((entry) => ({ ...entry })),
    entitledCompanionIds: [...state.entitledCompanionIds], assignedCompanionIds: [...state.assignedCompanionIds] }
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const contains = <T>(older: readonly T[], newer: readonly T[]) => older.every((value) => newer.includes(value))

function canonicalLedger(state: AchievementLedgerState): string {
  const copy = cloneAchievementLedger(state)
  for (const key of ['receiptIds', 'operationIds', 'equipmentInstanceIds', 'facts', 'claimedIds', 'entitledCompanionIds', 'assignedCompanionIds'] as const) {
    copy[key].sort()
  }
  copy.dailyClaimDays.sort((a, b) => a - b)
  copy.weeklyClaims.sort((a, b) => a.claimId.localeCompare(b.claimId))
  copy.counters = Object.fromEntries(Object.entries(copy.counters).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify(copy)
}

/** Validation is atomic; storage authentication/latest-save selection belongs to the save owner. */
export function parseAchievementLedger(input: unknown, playerId: string, enabledAt: number, registry: AchievementRegistry): AchievementLedgerState | undefined {
  if (!object(input) || input.version !== 1 || input.playerId !== playerId || input.enabledAt !== enabledAt || !natural(input.revision)) return
  if (Object.keys(input).some((key) => !Object.hasOwn(emptyAchievementLedger(playerId, enabledAt), key))) return
  const arrays = ['receiptIds', 'operationIds', 'equipmentInstanceIds', 'facts', 'claimedIds', 'entitledCompanionIds', 'assignedCompanionIds'] as const
  if (arrays.some((key) => !strings(input[key])) || !object(input.counters)
    || !Array.isArray(input.dailyClaimDays) || !input.dailyClaimDays.every(natural)
    || new Set(input.dailyClaimDays).size !== input.dailyClaimDays.length
    || !Array.isArray(input.weeklyClaims)) return
  if (Object.entries(input.counters).some(([key, value]) => !ACHIEVEMENT_COUNTERS.includes(key as AchievementCounter) || !natural(value))) return
  if (input.weeklyClaims.some((entry: unknown) => !object(entry) || typeof entry.claimId !== 'string' || !entry.claimId.trim() || !natural(entry.period))) return
  // The guards above establish the full versioned shape before copying it.
  const state = input as unknown as AchievementLedgerState
  if ((state.counters.unique_equipment ?? 0) !== state.equipmentInstanceIds.length
    || new Set(state.weeklyClaims.map((entry) => entry.claimId)).size !== state.weeklyClaims.length
    || state.weeklyClaims.some((entry) => !state.operationIds.includes(`weekly:${entry.claimId}`))
    || state.operationIds.length > state.receiptIds.length
    || state.receiptIds.length > state.revision
    || (Object.values(state.counters).some((count) => count > 0) && state.receiptIds.length === 0)
    || ACHIEVEMENT_COUNTERS.some((counter) => !['mortal_wood', 'mortal_ore', 'qi_herb', 'foundation_ore'].includes(counter) && (state.counters[counter] ?? 0) > state.receiptIds.length)
    || (state.counters.body_foundation ?? 0) > (state.counters.body_all ?? 0)
    || (state.facts.includes('companion:entitled') !== (state.entitledCompanionIds.length > 0))
    || (state.facts.includes('companion:assigned') !== state.assignedCompanionIds.some((id) => state.entitledCompanionIds.includes(id)))) return
  if (state.claimedIds.some((id) => {
    const row = registry.get(id)
    return !row || !evaluateAchievement(row, state).ready
  })) return
  return cloneAchievementLedger(state)
}

/** Lifetime history may only grow within a live owner, even if a caller inflates revision. */
export function preservesAchievementHistory(previous: AchievementLedgerState, next: AchievementLedgerState): boolean {
  if (next.revision < previous.revision) return false
  for (const key of ['receiptIds', 'operationIds', 'equipmentInstanceIds', 'facts', 'claimedIds', 'dailyClaimDays', 'entitledCompanionIds', 'assignedCompanionIds'] as const) {
    if (!contains(previous[key] as readonly (string | number)[], next[key] as readonly (string | number)[])) return false
  }
  if (Object.entries(previous.counters).some(([key, count]) => (next.counters[key as AchievementCounter] ?? 0) < (count ?? 0))) return false
  if (!previous.weeklyClaims.every((entry) => next.weeklyClaims.some((other) => other.claimId === entry.claimId && other.period === entry.period))) return false
  return next.revision !== previous.revision || canonicalLedger(next) === canonicalLedger(previous)
}
