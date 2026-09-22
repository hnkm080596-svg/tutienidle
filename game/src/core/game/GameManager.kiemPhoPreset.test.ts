import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import type { OrbId } from '../kiem-tu/KiemTuState'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Kiem Tu Reimagined Task 7 — the setKiemPhoPreset op contract:
// realm-gated orb unlocks, 1..9 length, out-of-combat only, writes
// PlayerData.swordPath.preset (the persisted field — cursor/log never
// persist).

function makeDummyEnemy(id: string) {
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
      evasionRate: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

function setup(realmId: string, way: 'sword_pathway' | 'hidden_sword_pathway' = 'sword_pathway') {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  player.cultivationWay = way
  player.realmId = realmId
  player.swordPath = freshSwordPathState()

  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

describe('setKiemPhoPreset', () => {
  it('accepts a valid preset and persists it on player.swordPath', () => {
    const { gameManager, player } = setup('foundation_establishment')

    expect(
      gameManager.progressionOps.setKiemPhoPreset(player, ['orb_dam', 'orb_chem'] as OrbId[]),
    ).toBe(true)
    expect(player.swordPath!.preset).toEqual(['orb_dam', 'orb_chem'])
  })

  it('rejects orbs not yet unlocked at the player realm', () => {
    const { gameManager, player } = setup('qi_refining')

    // qi_refining unlocks orb_dam only — orb_chem lands at realm index 2.
    expect(gameManager.progressionOps.setKiemPhoPreset(player, ['orb_chem'] as OrbId[])).toBe(false)
    expect(player.swordPath!.preset).toEqual(['orb_dam'])
  })

  it('rejects empty and over-9 presets', () => {
    const { gameManager, player } = setup('golden_core')

    expect(gameManager.progressionOps.setKiemPhoPreset(player, [])).toBe(false)
    expect(
      gameManager.progressionOps.setKiemPhoPreset(
        player,
        Array.from({ length: 10 }, () => 'orb_dam') as OrbId[],
      ),
    ).toBe(false)
    expect(player.swordPath!.preset).toEqual(['orb_dam'])
  })

  it('rejects while a battle is in progress', () => {
    const { gameManager, player } = setup('foundation_establishment')
    gameManager.progressionOps.learnSkill('tram', player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kpp_enemy'))

    expect(
      gameManager.progressionOps.setKiemPhoPreset(player, ['orb_dam', 'orb_chem'] as OrbId[]),
    ).toBe(false)
    expect(player.swordPath!.preset).toEqual(['orb_dam'])
  })

  it('rejects on the ngu way and for non-kiem-tu players', () => {
    const { gameManager, player } = setup('foundation_establishment', 'hidden_sword_pathway')

    expect(
      gameManager.progressionOps.setKiemPhoPreset(player, ['orb_dam', 'orb_chem'] as OrbId[]),
    ).toBe(false)

    const spellPath = createDefaultPlayer()
    spellPath.cultivationPath = 'spell'
    expect(
      gameManager.progressionOps.setKiemPhoPreset(spellPath, ['orb_dam'] as OrbId[]),
    ).toBe(false)
  })
})
