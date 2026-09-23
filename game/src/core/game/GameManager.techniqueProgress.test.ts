// P7-M6 - the GameManager-bound progress sink keeps
// player.techniqueProgress honest: NodeSystem's techniqueRank/
// techniqueGrade prerequisites read the mirror because hasPrerequisite
// only sees PlayerData (same contract as skillCastCounts/skillLevels).
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { Technique } from '../technique/Technique'

const SWORD_ART: Technique = {
  id: 'sword_control_art',
  name: 'fixture',
  description: 'fixture',
  grade: 1,
  rank: 0,
  mastery: 0,
  quality: 'hoang',
  gradeHistory: {},
}

describe('player.techniqueProgress mirror (P7-M6)', () => {
  it('stays undefined while no technique is held', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    expect(player.techniqueProgress).toBeUndefined()
  })

  it('grant/rank-up/grade-advance republish the mirror through the bound player', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    manager.techniqueSystem.grant({ ...SWORD_ART }, 'qi_refining')
    expect(player.techniqueProgress).toEqual({ rank: 0, grade: 1 })

    // Mastery accrual without a rank-up does NOT republish (unmirrored).
    manager.techniqueSystem.gainMastery(100, 'qi_refining', 18)
    expect(player.techniqueProgress).toEqual({ rank: 0, grade: 1 })

    manager.techniqueSystem.gainMastery(200, 'qi_refining', 18)
    expect(player.techniqueProgress).toEqual({ rank: 1, grade: 1 })

    manager.techniqueSystem.gainMastery(2700, 'qi_refining', 18)
    // M-F-TECHNIQUE: grade-up is catch-up-only - the grade-1 cycle
    // seals (defensively, at the transaction) when advancing inside
    // foundation_establishment (index 2).
    manager.techniqueSystem.advanceTechniqueGrade('foundation_establishment')
    expect(player.techniqueProgress).toEqual({ rank: 0, grade: 2 })
  })

  it('restore republishes from the canonical holder; a stale mirror self-corrects', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    // Simulate a live mirror left behind by an earlier holder.
    manager.techniqueSystem.restore([{ ...SWORD_ART, rank: 4, grade: 2 }])
    expect(player.techniqueProgress).toEqual({ rank: 4, grade: 2 })

    manager.techniqueSystem.restore([{ ...SWORD_ART, rank: 2, grade: 1 }])
    expect(player.techniqueProgress).toEqual({ rank: 2, grade: 1 })
  })

  it('an empty restore clears the mirror back to the undefined default', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    manager.techniqueSystem.restore([{ ...SWORD_ART, rank: 4, grade: 2 }])
    expect(player.techniqueProgress).toEqual({ rank: 4, grade: 2 })

    manager.techniqueSystem.restore([])
    expect(player.techniqueProgress).toBeUndefined()
    expect('techniqueProgress' in player).toBe(true)
  })

  it('a mirror write never escapes onto a different bound player', () => {
    const manager = new GameManager()
    const playerA = createDefaultPlayer()
    const playerB = createDefaultPlayer()

    manager.setActivePlayer(playerA)
    manager.techniqueSystem.restore([{ ...SWORD_ART, rank: 1, grade: 1 }])
    expect(playerA.techniqueProgress).toEqual({ rank: 1, grade: 1 })

    // Rebinding does not clone the mirror onto the new player...
    manager.setActivePlayer(playerB)
    expect(playerB.techniqueProgress).toBeUndefined()

    // ...and the next publish targets the CURRENT bound player only.
    manager.techniqueSystem.gainMastery(300, 'qi_refining', 18)
    expect(playerB.techniqueProgress).toEqual({ rank: 2, grade: 1 })
    expect(playerA.techniqueProgress).toEqual({ rank: 1, grade: 1 })
  })
})
