import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CompanionInstance } from '../../data/companion/Companions'
import type { PlayerData } from '../player/Player'
import type { Stage } from '../stage/Stage'
import { companionBattleExpPerKill } from '../companion/CompanionProgression'
import { createBattle, createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

// Companion battle EXP (companion-gacha spec section 7, 2026-09-12): each
// companion assigned in the resolved party formation gains
// companionBattleExpPerKill(stageRealm) per kill; the 'player' slot and
// unassigned companions gain nothing. The formation is re-resolved per
// kill, so a mid-battle formation change affects the NEXT kill.

function makeCompanion(
  definitionId: string,
  overrides: Partial<CompanionInstance> = {},
): CompanionInstance {
  return {
    instanceId: `inst_${definitionId}`,
    definitionId,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
  }
}

// combatantId is 'player' or a companion definitionId - row/column only
// decide battlefield placement, which the exp grant does not read.
function assignFormation(player: PlayerData, ...companionIds: string[]) {
  player.formationLoadout = {
    formationId: 'test_formation',
    assignments: [
      { row: 0, column: 0, combatantId: 'player' },
      ...companionIds.map((combatantId, index) => ({
        row: 1,
        column: index,
        combatantId,
      })),
    ],
  }
}

describe('BattleLootSystem - companion battle EXP', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('assigned companion gains companionBattleExpPerKill(stage realm) per kill', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
    })

    player.companions.push(makeCompanion('test_companion_1'))
    assignFormation(player, 'test_companion_1')

    killEnemy()

    // qi_refining index 1 -> 2 * (1 + 1) = 4 exp for one kill.
    expect(companionBattleExpPerKill('qi_refining')).toBe(4)
    expect(player.companions[0]?.exp).toBe(4)

    killEnemy()

    expect(player.companions[0]?.exp).toBe(8)
  })

  it('a companion not in the formation gains nothing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
    })

    player.companions.push(
      makeCompanion('test_companion_1'),
      makeCompanion('test_companion_2'),
    )
    assignFormation(player, 'test_companion_1')

    killEnemy()

    expect(player.companions[0]?.exp).toBe(4)
    expect(player.companions[1]?.exp).toBe(0)
  })

  it('a kill with no stage context falls back to enemy.realmId', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player } = createLootTestSetup({
      realmId: 'foundation_establishment',
    })

    player.companions.push(makeCompanion('test_companion_1'))
    assignFormation(player, 'test_companion_1')

    killEnemy()

    // foundation_establishment index 2 -> 2 * (2 + 1) = 6.
    expect(companionBattleExpPerKill('foundation_establishment')).toBe(6)
    expect(player.companions[0]?.exp).toBe(6)
  })

  it('a companion at the player-realm ceiling stays clamped (exp stays 0)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player } = createLootTestSetup({
      realmId: 'mortal',
      stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
    })

    // Player is mortal (createDefaultPlayer); mortal maxLevel is 18, so a
    // mortal companion at tier 18 sits exactly at the ceiling and
    // applyCompanionExp discards the incoming exp.
    player.companions.push(makeCompanion('test_companion_1', { realmLevel: 18 }))
    assignFormation(player, 'test_companion_1')

    killEnemy()

    expect(player.companions[0]?.exp).toBe(0)
    expect(player.companions[0]?.realmLevel).toBe(18)
  })

  it('re-resolves the formation per kill - a mid-battle swap moves exp to the new assignee', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
    })

    player.companions.push(
      makeCompanion('test_companion_1'),
      makeCompanion('test_companion_2'),
    )
    assignFormation(player, 'test_companion_1')

    killEnemy()

    expect(player.companions[0]?.exp).toBe(4)
    expect(player.companions[1]?.exp).toBe(0)

    // Snapshot semantics: the swap happens between kills, so only the
    // currently-assigned companion gains exp on the second kill.
    assignFormation(player, 'test_companion_2')

    killEnemy()

    expect(player.companions[0]?.exp).toBe(4)
    expect(player.companions[1]?.exp).toBe(4)
  })

  it('a companion occupying two formation slots (malformed loadout) gains exp once, not per slot', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
    })

    player.companions.push(makeCompanion('test_companion_1'))
    // Malformed-but-loadable state: save validation never inspects
    // formationLoadout.assignments, so a crafted/current save can place
    // the same combatantId on two slots. Exactly-once is per COMPANION
    // per kill - combat itself spawns one participant (formation.find
    // takes the first slot), so granting twice overpays.
    player.formationLoadout = {
      formationId: 'test_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 0, combatantId: 'test_companion_1' },
        { row: 1, column: 1, combatantId: 'test_companion_1' },
      ],
    }

    killEnemy()

    expect(player.companions[0]?.exp).toBe(companionBattleExpPerKill('qi_refining'))
  })

  it('the auto-farm shim path (processDefeatedEnemies with a stage override) grants exp', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { loot, player } = createLootTestSetup({ realmId: 'mortal' })

    player.companions.push(makeCompanion('test_companion_1'))
    assignFormation(player, 'test_companion_1')

    // Same entry point and call shape as
    // GameManagerTurnBattleOps.rollAutoFarmCycleReward: a dead-enemies shim
    // plus the farmed stage as stageOverride. No second exp path exists.
    const farmStage: Stage = {
      id: 'idle_farm_stage',
      name: 'Idle Farm Stage',
      description: '',
      requiredRealmId: 'golden_core',
      floor: 1,
      enemyPool: [],
      totalEnemyCount: 1,
      waves: [1],
      spawnIntervalSeconds: 0,
    }

    loot.processDefeatedEnemies(createBattle([createDeadEnemy('mob')]), farmStage)

    // golden_core index 3 -> 2 * (3 + 1) = 8: the stage override anchors
    // the exp realm, not the mortal enemy.
    expect(companionBattleExpPerKill('golden_core')).toBe(8)
    expect(player.companions[0]?.exp).toBe(8)
  })
})
