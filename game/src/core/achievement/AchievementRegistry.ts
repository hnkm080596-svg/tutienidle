import type { AchievementDefinition, AchievementObjective } from './Achievement'

export const ACHIEVEMENT_COUNTERS = [
  'mortal_wood', 'wild_boar', 'production_batches', 'mortal_ore',
  'unique_equipment', 'body_all', 'bandit', 'qi_herb', 'alchemy_crafts',
  'enhancements', 'spirit_wolf', 'foundation_ore', 'formed_victories', 'body_foundation',
] as const

export const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
export const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length

function validObjective(objective: AchievementObjective): boolean {
  switch (objective?.kind) {
    case 'counter': return ACHIEVEMENT_COUNTERS.includes(objective.counter) && natural(objective.target) && objective.target > 0
    case 'facts': return strings(objective.keys) && objective.keys.length > 0
    case 'daily_streak': return objective.target === 7
    case 'weekly_claims': return objective.target === 4 && objective.minimumPeriods === 2
    default: return false
  }
}

/** Takes a detached, frozen copy so callers cannot mutate the evaluation contract. */
export class AchievementRegistry {
  private readonly definitions = new Map<string, AchievementDefinition>()

  constructor(definitions: readonly AchievementDefinition[]) {
    for (const row of definitions) {
      if (!nonempty(row.id) || !nonempty(row.title) || !nonempty(row.description)
        || !['mortal', 'qi_refining', 'foundation_establishment', 'fixed'].includes(row.band)
        || !validObjective(row.objective) || !row.reward
        || Object.entries(row.reward).some(([key, value]) => !['spiritStone', 'cultivation', 'skillInsight'].includes(key) || !natural(value))) {
        throw new Error('Invalid achievement definition')
      }
      if (this.definitions.has(row.id)) throw new Error(`Achievement already registered: ${row.id}`)
      const objective = row.objective.kind === 'facts'
        ? Object.freeze({ ...row.objective, keys: Object.freeze([...row.objective.keys]) })
        : Object.freeze({ ...row.objective })
      this.definitions.set(row.id, Object.freeze({ ...row, reward: Object.freeze({ ...row.reward }), objective }))
    }
  }

  get(id: string): AchievementDefinition | undefined { return this.definitions.get(id) }
  getAll(): readonly AchievementDefinition[] { return [...this.definitions.values()] }
}
