import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { getSkillCoreLevel } from '../progression/SkillCoreLevel'
import { getCastLeveledSkillLevel } from '../skill/CastLeveling'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'

// 9.5 #9 — production wiring regression: turn-engine casts of the
// primary player feed player.skillCastCounts + the canonical Core Node
// level (nodeLevels[core_<id>] - M-QI-05; NodeSystem `skillCastCount`
// prerequisites + the offer gates read it) through
// TurnBattleSystem.onSkillCast -> SkillSystem.recordCast -> castCountSink.
// Enemy/companion casts must NOT write into the mirror.

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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

describe('GameManager — turn-engine cast counting wiring (9.5 #9)', () => {
  it('cast tram của player chính ghi vào skillCastCounts + totalExperience + core_tram level', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const player = createDefaultPlayer()
    player.cultivationPath = 'sword'

    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram', player)

    gameManager.startBattleWithPlayer(player, makeDummyEnemy())

    // intro + countdown + vài lượt fighting — tram là basic của sword.
    // Advance until the player's first cast lands (gauge fill depends on
    // attackSpeed; the cap keeps a broken wiring from hanging the test).
    for (let i = 0; i < 200 && !player.skillCastCounts?.['tram']; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const tramCasts = player.skillCastCounts?.['tram'] ?? 0
    const tram = gameManager.skillManager.get('tram')!

    expect(tramCasts).toBeGreaterThan(0)
    expect(tram.totalExperience).toBe(tramCasts)
    expect(getSkillCoreLevel(player, 'tram')).toBe(getCastLeveledSkillLevel('tram', tramCasts))

    // Chỉ cast của player chính được mirror — enemy 'generic_physical'
    // (và mọi actor khác) không bao giờ ghi vào đây.
    expect(Object.keys(player.skillCastCounts ?? {})).toEqual(['tram'])
  })
})
