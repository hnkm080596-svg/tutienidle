// QA repro (buff2 M4 deep audit) -- the survive-effects lane used to mint
// `survive.<battleGeneration>.<entityId>.grant` / `.cleanse` with NO
// occurrence discriminator, so two grant-bearing survive events on the
// same entity inside one battle re-minted an identical operationId and
// faulted the scheduler.
//
// THỂ TU BETA: the Bat Tu Ba The ultimate is parked (no ultimate slot),
// so the body way can no longer reach a second grant-bearing survive
// source -- the designed Bat Tu -> talent-charge pairing is post-beta.
// What remains pin-able in beta: the talent charge grants tu_sinh_ngo
// through the survive lane's `.grant` authored op (still exercising the
// occurrence-discriminated mint), and the spent guard lets the next
// lethal through cleanly.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { CORE_REALM_LEVEL } from '../realm/realmSystem'

import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  return { gameManager, combatSource }
}

function mortalAtGate(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = CORE_REALM_LEVEL
  player.skillInsight = 99
  return player
}

function makeDummy(id: string) {
  return defineEnemy({
    id,
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 10_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

describe('survive-effects op minting (QA deep audit)', () => {
  it('talent-charge grant settles through the survive lane; spent guard lets the next lethal through', () => {
    const { gameManager } = makeManager()
    const player = mortalAtGate()
    player.selectedTalentIds = ['bat_tu_the']
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
    gameManager.progressionOps.purchaseNode('cuong_chien', player)
    gameManager.progressionOps.syncTalentCombatPassive(player)
    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummy('survive_qa'))

    const battle = gameManager.getTurnBattle()
    expect(battle).not.toBeNull()
    const participant = battle!.players[0]!

    const buffsOf = (definitionId: string) =>
      gameManager.getBattleBuffs(participant.entity.id).filter(
        (instance) => instance.definitionId === definitionId,
      )

    // Lethal 1 -- no beta extraSource exists (Bat Tu is parked), so the
    // talent guard consumes its charge and grants tu_sinh_ngo + cleanses
    // through the survive lane's `.grant` authored op (the mint that used
    // to collide on repeated survive events).
    gameManager.combatSystem.applyDirectDamage(participant.entity, 999_999, 'survive_qa')
    expect(participant.entity.alive).toBe(true)
    expect(participant.entity.currentHp).toBe(1)
    expect(buffsOf('tu_sinh_ngo')).toHaveLength(1)
    expect(buffsOf('bat_tu_ba_the')).toHaveLength(0)

    const scheduler = gameManager.turnBattleOps.getTurnBattleSystem().combatScheduler
    expect(scheduler).toBeDefined()
    expect(scheduler!.state).not.toBe('faulted')

    // Lethal 2 -- the guard's charge is spent and no other survive source
    // exists in beta: the hit is simply lethal.
    expect(() =>
      gameManager.combatSystem.applyDirectDamage(participant.entity, 999_999, 'survive_qa'),
    ).not.toThrow()

    expect(participant.entity.alive).toBe(false)
    expect(scheduler!.state).not.toBe('faulted')
  })

  it('two threshold converts of the same buff inside one turn settle both applies', () => {
    // Same defect class as the survive lane: `passive.<gen>.<turn>.<buffId>`
    // had no occurrence discriminator. Vo Anh (dodge trigger, max 5
    // stacks -> sat_na convert, reset to 0) converts twice if >=10 dodge
    // events land inside one actor action (a multi-hit flurry).
    const { gameManager } = makeManager()
    const player = mortalAtGate()
    player.selectedTalentIds = ['vo_anh']
    gameManager.progressionOps.syncTalentCombatPassive(player)
    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummy('passive_qa'))

    const battle = gameManager.getTurnBattle()
    expect(battle).not.toBeNull()
    const scheduler = gameManager.turnBattleOps.getTurnBattleSystem().combatScheduler
    expect(scheduler).toBeDefined()

    for (let i = 0; i < 10; i += 1) {
      gameManager.eventBus.emit('dodge', { targetId: 'player' })
    }

    expect(scheduler!.state).not.toBe('faulted')
    const satNa = gameManager
      .getBattleBuffs('player')
      .filter((instance) => instance.definitionId === 'sat_na')
    expect(satNa.length).toBeGreaterThanOrEqual(1)
  })
})
