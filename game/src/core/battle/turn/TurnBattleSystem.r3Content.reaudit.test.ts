import { afterEach, describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { enemyToCombatEntity } from '../../enemy/Enemy'
import { ENEMIES } from '../../../data/enemy/Enemies'
import { toTurnBattleParticipant } from '../../game/TurnBattleAdapter'
import { PHAP_TU_REACTION_SPECIAL, PHAP_TU_REACTION_ULTIMATE, REACTION_PATH_POOL } from '../../../data/skill/TurnReactionPathSkills'
import { GENERIC_PHYSICAL_BASIC } from '../../../data/skill/TurnBasicAttacks'
import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'
import type { TurnSkillDefinition } from './TurnSkillAction'

function setup(skill: TurnSkillDefinition) {
  const bus = new EventBus()
  const system = new TurnBattleSystem(new CombatSystem(bus), 10, TURN_BUFF_REGISTRY, undefined, REACTION_PATH_POOL)
  const source = enemyToCombatEntity(structuredClone(ENEMIES[0]!))
  source.id = 'source'
  source.type = 'player'
  source.currentMp = 1000
  source.stats.speed = 1000
  source.stats.accuracyRating = 10000
  source.stats.criticalRate = 0
  const target = enemyToCombatEntity(structuredClone(ENEMIES[0]!))
  target.id = 'target'
  target.currentHp = target.maxHp = 100000
  target.stats.evasionRate = 0
  target.stats.blockChance = 0
  const actor = toTurnBattleParticipant(source, 0, skill)
  const enemy = toTurnBattleParticipant(target, 1, GENERIC_PHYSICAL_BASIC)
  const battle: TurnBattle = { players: [actor], enemies: [enemy], state: 'fighting' }
  return { system, battle, actor, enemy, bus }
}

afterEach(() => vi.restoreAllMocks())

describe('R3 production Reaction Path contracts', () => {
  it('applies the ailments of the production elemental picks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const { system, battle, enemy } = setup(PHAP_TU_REACTION_SPECIAL)
    system.resolveNextStep(battle)
    expect(enemy.buffs.getAll().length).toBeGreaterThan(0)
  })

  it('casts production reaction empowerment without damaging the opponent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const { system, battle, actor, enemy } = setup(PHAP_TU_REACTION_ULTIMATE)
    const before = enemy.entity.currentHp
    system.resolveNextStep(battle)
    expect(actor.buffs.getAllById('reaction_empowerment')).toHaveLength(1)
    expect(enemy.entity.currentHp).toBe(before)
  })
})
