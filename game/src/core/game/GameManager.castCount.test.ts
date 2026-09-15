import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'

// 9.5 #9 — production wiring regression: turn-engine casts of the
// primary player feed player.skillCastCounts/skillLevels (the mirror
// NodeSystem `skillCastCount` prerequisites + bat_kiem route gate read)
// through TurnBattleSystem.onSkillCast → SkillSystem.recordCast →
// castCountSink. Enemy/companion casts must NOT write into the mirror.

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function makeDummyEnemy() {
  return defineEnemy({
    id: 'cast_count_dummy',
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...ENEMY_STATS_INPUT },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('GameManager — turn-engine cast counting wiring (9.5 #9)', () => {
  it('cast tram của player chính ghi vào skillCastCounts + totalExperience + skillLevels mirror', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'

    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram')

    gameManager.startBattleWithPlayer(player, makeDummyEnemy())

    // intro + countdown + vài lượt fighting — tram là basic của kiem_tu.
    // Advance until the player's first cast lands (gauge fill depends on
    // attackSpeed; the cap keeps a broken wiring from hanging the test).
    for (let i = 0; i < 200 && !player.skillCastCounts?.['tram']; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const tramCasts = player.skillCastCounts?.['tram'] ?? 0
    const tram = gameManager.skillManager.get('tram')!

    expect(tramCasts).toBeGreaterThan(0)
    expect(tram.totalExperience).toBe(tramCasts)
    expect(player.skillLevels?.['tram']).toBe(tram.level)

    // Chỉ cast của player chính được mirror — enemy 'generic_physical'
    // (và mọi actor khác) không bao giờ ghi vào đây.
    expect(Object.keys(player.skillCastCounts ?? {})).toEqual(['tram'])
  })
})
