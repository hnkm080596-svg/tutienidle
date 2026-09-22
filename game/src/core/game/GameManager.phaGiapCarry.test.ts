import { SKILLS } from '../../data/skill/Skills'
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'

// Talent v4 M2 — Pha Giap cross-battle carry wiring (spec §4.1 row 2,
// §7): the ops layer banks floor(stacks * 0.5) at the victory terminal
// and re-seeds them at the next startBattleWithPlayer, AFTER the
// per-battle resetStacks. PassiveSystem owns the stacks; PlayerData
// owns the bank. These tests pin the ops wiring end-to-end.

function makeEnemy(): ReturnType<typeof defineEnemy> {
  return defineEnemy({
    id: 'pg_enemy',
    name: 'PG Enemy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

function phaGiapModifier(manager: GameManager) {
  return manager.skillManager.get('talent_passive_pha_giap')!.passiveModifiers![0]!
}

function winBattle(manager: GameManager, clock: ManualClockSource) {
  // Intro (20) + countdown (30) consume fixed steps before fighting.
  for (let i = 0; i < 80 && manager.getTurnBattle()!.state !== 'fighting'; i++) {
    clock.advance(COMBAT_STEP_SECONDS)
  }
  const tb = manager.getTurnBattle()!
  tb.enemies[0]!.entity.currentHp = 0
  tb.enemies[0]!.entity.alive = false
  for (let i = 0; i < 20 && manager.getTurnBattle()!.state !== 'victory'; i++) {
    clock.advance(COMBAT_STEP_SECONDS)
  }
  expect(manager.getTurnBattle()!.state).toBe('victory')
}

describe('GameManager — Pha Giap carry wiring (M2)', () => {
  it('victory banks 50% stacks; tran sau seed lai dung so', () => {
    const manager = new GameManager()
    manager.catalogOps.registerSkillTemplates(SKILLS)
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = createDefaultPlayer()
    player.selectedTalentIds = ['pha_giap']
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)


    // Battle 1: build 4 stacks via 'hit' events, then win.
    manager.startBattleWithPlayer(player, makeEnemy())
    for (let i = 0; i < 4; i++) {
      manager.eventBus.emit('hit', { type: 'hit', sourceId: 'player', targetId: 'e' })
    }
    expect(phaGiapModifier(manager).stacks).toBe(4)

    winBattle(manager, clock)

    expect(player.phaGiapCarryStacks).toBe(2) // floor(4 * 0.5)
    expect(player.phaGiapCarryRealmId).toBe('qi_refining')

    // Battle 2: resetStacks ran inside startBattle, then the bank
    // re-seeded the passive — stacks open at 2, not 0.
    manager.startBattleWithPlayer(player, makeEnemy())

    expect(phaGiapModifier(manager).stacks).toBe(2)
  })

  it('realm change giua 2 tran -> bank bi decay ve 0, khong seed', () => {
    const manager = new GameManager()
    manager.catalogOps.registerSkillTemplates(SKILLS)
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = createDefaultPlayer()
    player.selectedTalentIds = ['pha_giap']
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)


    manager.startBattleWithPlayer(player, makeEnemy())
    phaGiapModifier(manager).stacks = 4
    winBattle(manager, clock)

    expect(player.phaGiapCarryStacks).toBe(2)

    // Player crossed to golden_core between battles.
    player.realmId = 'golden_core'
    manager.startBattleWithPlayer(player, makeEnemy())

    expect(player.phaGiapCarryStacks).toBe(0)
    expect(phaGiapModifier(manager).stacks ?? 0).toBe(0)
  })

  it('thua tran cung bank (plan Slice 6: bat ke ket qua)', () => {
    const manager = new GameManager()
    manager.catalogOps.registerSkillTemplates(SKILLS)
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = createDefaultPlayer()
    player.selectedTalentIds = ['pha_giap']
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)


    manager.startBattleWithPlayer(player, makeEnemy())
    for (let i = 0; i < 80 && manager.getTurnBattle()!.state !== 'fighting'; i++) {
      clock.advance(COMBAT_STEP_SECONDS)
    }
    phaGiapModifier(manager).stacks = 4

    // Player dies -> defeat terminal banks the same 50%.
    const tb = manager.getTurnBattle()!
    tb.players[0]!.entity.currentHp = 0
    tb.players[0]!.entity.alive = false
    for (let i = 0; i < 20 && manager.getTurnBattle()!.state !== 'defeat'; i++) {
      clock.advance(COMBAT_STEP_SECONDS)
    }

    expect(manager.getTurnBattle()!.state).toBe('defeat')
    expect(player.phaGiapCarryStacks).toBe(2)
  })

  it('khong co pha_giap -> victory khong tao carry', () => {
    const manager = new GameManager()
    manager.catalogOps.registerSkillTemplates(SKILLS)
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)


    manager.startBattleWithPlayer(player, makeEnemy())
    winBattle(manager, clock)

    expect(player.phaGiapCarryStacks).toBe(0)
    expect(player.phaGiapCarryRealmId).toBeNull()
  })
})
