import { describe, expect, it } from 'vitest'
import { QUESTS } from './quests'
import { STAGES } from '../stage/Stages'
import { stageSpawnableEnemyIds } from '../../core/stage/StageSpawnableEnemies'

// QA-2026-09-30-ROSTER-1 - BETA SCOPE LOCK v2 consequence: the locked
// stage roster (12 identities) left several kill-quest targets with
// no spawn source. onEnemyDefeated matches the defeated enemy's
// TEMPLATE id exactly (BattleLootSystem.processDefeatedEnemies ->
// QuestSystem), so a quest whose enemyId is spawnable on no beta stage
// can never progress.
// Phase-5 resolution: the daily cadence and its three quests left the
// active lifecycle (entries removed); the two once-cadence fallout
// quests retargeted onto legitimate roster siblings (mud golem for
// stone fungus, the ferocious flood-dragon whelp for the whelp). This
// pin now guards the resolved state: every authored explicit kill
// target must stay spawnable on some beta stage.
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
      questId: 'kill_foundation_stone_fungus_15',
      enemyId: 'foundation_mud_golem',
    })
    expect(killQuestEnemyIds).toContainEqual({
      questId: 'kill_foundation_floor_10_boss_1',
      enemyId: 'foundation_ferocious_flood_dragon_whelp',
    })
    expect(killQuestEnemyIds).toContainEqual({
      questId: 'kill_foundation_flood_dragon_whelp_10',
      enemyId: 'foundation_ferocious_flood_dragon_whelp',
    })
  })

  it('every explicit kill target is spawnable on some beta stage', () => {
    // Resolved Phase-5: every remaining explicit kill target is a
    // beta-roster identity declared spawnable by the stage funnel.
    expect(
      killQuestEnemyIds
        .filter(({ enemyId }) => !spawnableIds.has(enemyId))
        .map(({ questId }) => questId),
    ).toEqual([])
  })
})
