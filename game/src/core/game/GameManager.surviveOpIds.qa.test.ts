// QA repro (buff2 M4 deep audit) -- the survive-effects lane mints
// `survive.<battleGeneration>.<entityId>.grant` / `.cleanse` with NO
// occurrence discriminator. Two grant-bearing survive events on the same
// entity inside one battle (the DESIGNED Bat Tu Ba The -> talent-charge
// pairing: "the ultimate is the first line; the talent charge is the
// extra life once the ult is spent") re-mint an identical operationId,
// which the scheduler rejects with a structural fault -- faulting the
// scheduler and bricking every later buff op/lifecycle boundary.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { CORE_REALM_LEVEL } from '../realm/realmSystem'
import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from '../battle/contracts/ids'

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_NODES)
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
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('survive-effects op minting (QA deep audit)', () => {
  it('Bat Tu grant then talent-charge grant on the same entity settles both survive events', () => {
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
    const entityId = participant.entity.id as CombatEntityId

    const buffsOf = (definitionId: string) =>
      gameManager.getBattleBuffs(participant.entity.id).filter(
        (instance) => instance.definitionId === definitionId,
      )

    // Lethal 1 -- the Bat Tu extraSource consumes the ult slot and grants
    // bat_tu_ba_the through the survive lane's `.grant` authored op.
    gameManager.combatSystem.applyDirectDamage(participant.entity, 999_999, 'survive_qa')
    expect(participant.entity.alive).toBe(true)
    expect(participant.entity.currentHp).toBe(1)
    expect(buffsOf('bat_tu_ba_the')).toHaveLength(1)

    // Expire the granted window so the next lethal falls through to the
    // talent charge (the designed extra-life ordering).
    const scheduler = gameManager.turnBattleOps.getTurnBattleSystem().combatScheduler
    expect(scheduler).toBeDefined()
    scheduler!.enqueueAuthored([
      {
        type: 'remove_buff',
        operationId: 'qa.strip_bat_tu' as CombatOperationId,
        payload: {
          selector: {
            kind: 'target_definition',
            targetId: entityId,
            definitionId: 'bat_tu_ba_the' as BuffDefinitionId,
          },
          removalReason: 'expired',
        },
        origin: {
          kind: 'proc',
          originId: 'qa.strip',
          sourceId: entityId,
          rootActionId: 'qa.strip',
        },
      },
    ])
    scheduler!.run()
    expect(buffsOf('bat_tu_ba_the')).toHaveLength(0)

    // Lethal 2 -- Bat Tu source declines (buff gone, slot on cooldown);
    // the talent charge grants tu_sinh_ngo + cleanses. Its `.grant` op
    // re-mints the operationId lethal 1 already reserved.
    expect(() =>
      gameManager.combatSystem.applyDirectDamage(participant.entity, 999_999, 'survive_qa'),
    ).not.toThrow()

    expect(participant.entity.alive).toBe(true)
    expect(participant.entity.currentHp).toBe(1)
    expect(buffsOf('tu_sinh_ngo')).toHaveLength(1)
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
