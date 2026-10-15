import type { AchievementDefinition, AchievementLedgerState } from './Achievement'

export function longestDailyStreak(days: readonly number[]): number {
  let longest = 0
  let current = 0
  let previous: number | undefined
  for (const day of [...new Set(days)].sort((a, b) => a - b)) {
    current = previous !== undefined && day - previous === 1 ? current + 1 : 1
    longest = Math.max(longest, current)
    previous = day
  }
  return longest
}

/** Pure lifetime evaluation; it never infers owner facts or grants a reward. */
export function evaluateAchievement(row: AchievementDefinition, state: AchievementLedgerState) {
  const objective = row.objective
  let current: number
  let target: number
  switch (objective.kind) {
    case 'counter':
      current = state.counters[objective.counter] ?? 0
      target = objective.target
      break
    case 'facts':
      current = objective.keys.filter((key) => state.facts.includes(key)).length
      target = objective.keys.length
      break
    case 'daily_streak':
      current = longestDailyStreak(state.dailyClaimDays)
      target = objective.target
      break
    case 'weekly_claims':
      current = new Set(state.weeklyClaims.map((entry) => entry.period)).size >= objective.minimumPeriods
        ? state.weeklyClaims.length : Math.min(state.weeklyClaims.length, objective.target - 1)
      target = objective.target
      break
  }
  const realmAvailable = row.band === 'mortal' || row.band === 'fixed'
    || state.facts.includes(`realm:${row.band}`)
    || (row.band === 'qi_refining' && state.facts.includes('realm:foundation_establishment'))
  const available = realmAvailable && (objective.kind !== 'facts'
    || !objective.keys.includes('companion:entitled') || state.entitledCompanionIds.length > 0)
  return { current: Math.min(current, target), target, ready: available && current >= target, available }
}
