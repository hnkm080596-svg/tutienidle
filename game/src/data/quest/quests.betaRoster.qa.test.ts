import { describe, expect, it } from 'vitest'
import { QUESTS } from './quests'
import { STAGES } from '../stage/Stages'
import { stageSpawnableEnemyIds } from '../../core/stage/StageSpawnableEnemies'

// QA-2026-09-30-ROSTER-1 - BETA SCOPE LOCK v2 consequence: the locked
// stage roster (12 identities) leaves several kill-quest targets with
// no spawn source. onEnemyDefeated matches the defeated enemy's
// TEMPLATE id exactly (BattleLootSystem.processDefeatedEnemies ->
// QuestSystem), so a quest whose enemyId is spawnable on no beta stage
// can never progress. it.fails pins each confirmed case - the pin
// flips green when the owning content phase retargets or removes the
// quest (do not flip by weakening this assertion).
describe('kill quests vs the beta stage roster (QA repro)', () => {
  const spawnableIds = new Set<string>()
  for (const stage of STAGES) {
    for (const id of stageSpawnableEnemyIds(stage)) {
      spawnableIds.add(id)
    }
  }

  const killQuestEnemyIds = QUESTS.flatMap((quest) =>
    quest.condition.kind === 'kill' && quest.condition.enemyId
      ? [{ questId: quest.id, enemyId: quest.condition.enemyId }]
      : [],
  )

  it('inventory: kill quests with explicit targets', () => {
    // Guards the repro list itself: these quests exist and target
    // template ids (enemyId omitted would be 'any kill').
    expect(killQuestEnemyIds).toContainEqual({ questId: 'kill_wild_wolf_10', enemyId: 'wild_wolf' })
    expect(killQuestEnemyIds).toContainEqual({
      questId: 'daily_kill_bandit_15',
      enemyId: 'bandit',
    })
    expect(killQuestEnemyIds).toContainEqual({
      questId: 'kill_foundation_stone_fungus_15',
      enemyId: 'foundation_stone_fungus',
    })
    expect(killQuestEnemyIds).toContainEqual({
      questId: 'kill_foundation_flood_dragon_whelp_10',
      enemyId: 'foundation_flood_dragon_whelp',
    })
  })

  it.fails('every explicit kill target is spawnable on some beta stage', () => {
    // FAILS now: bandit / foundation_stone_fungus /
    // foundation_flood_dragon_whelp are dormant identities - no beta
    // stage declares them, and the hidden-beast substitution is gated
    // to declared spawnable ids only.
    expect(
      killQuestEnemyIds
        .filter(({ enemyId }) => !spawnableIds.has(enemyId))
        .map(({ questId }) => questId),
    ).toEqual([])
  })
})
