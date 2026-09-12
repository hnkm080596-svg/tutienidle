import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import type { Stage } from '../stage/Stage'
import type { StatusVfxAttachedEvent, StatusVfxRemovedEvent } from '../battle/BattleEvents'

// Phase A6 (9.5 #7) — production wiring regression: a real turn-based
// fight must emit status_vfx_* events so the Phaser buff-icon pipeline
// (dead since the real-time engine was retired) renders icons/tooltips
// again. Doc Chuong (wood Phap Tu basic) applies trung_doc at chance 1.0.

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  attack: 0,
  attackSpeed: 1,
  attackRangeRanks: 9,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function makeDummyEnemy() {
  return defineEnemy({
    id: 'status_vfx_dummy',
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...ENEMY_STATS_INPUT },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function stageFixture(): Stage {
  return {
    id: 'status_vfx_stage',
    name: 'status_vfx_stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'status_vfx_dummy', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
}

describe('GameManager — turn-based status VFX feed (Phase A6)', () => {
  it('ailment applied by a real skill hit emits status_vfx_attached with turn duration on the enemy', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const attached: StatusVfxAttachedEvent[] = []
    const removed: StatusVfxRemovedEvent[] = []
    gameManager.eventBus.on<StatusVfxAttachedEvent>('status_vfx_attached', (e) => attached.push(e))
    gameManager.eventBus.on<StatusVfxRemovedEvent>('status_vfx_removed', (e) => removed.push(e))

    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.nodeLevels['lap_dao_thuan_wood'] = 1

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerEnemyTemplates([makeDummyEnemy()])
    gameManager.registerStages([stageFixture()])
    gameManager.setActivePlayer(player)

    const stats = calculateStats(player.baseStats, player.modifiers)
    // Stage battles construct the engine WITH TURN_BUFF_REGISTRY —
    // non-stage battles (startBattleWithPlayer) intentionally run a
    // registry-less engine where applySkillAilments no-ops.
    expect(
      gameManager.startStage(player, stats, gameManager.getStage('status_vfx_stage')!, false),
    ).toBe(true)

    // Advance until the first doc_chuong hit lands trung_doc (chance 1.0)
    // — intro+countdown+first turns; the cap keeps broken wiring from
    // hanging the test.
    for (let i = 0; i < 300 && attached.length === 0; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(attached.length).toBeGreaterThan(0)
    const ailment = attached.find((e) => e.dotType === 'trung_doc')
    expect(ailment).toBeDefined()
    expect(ailment!.targetId.startsWith('status_vfx_dummy')).toBe(true)
    // durationSeconds carries TURNS now — trung_doc's authored duration.
    expect(ailment!.durationSeconds).toBeGreaterThan(0)
    expect(ailment!.polarity).toBe('debuff')
    expect(ailment!.buffName).toBeTruthy()
  })

  it('a buff applied at battle construction (formation grant) emits status_vfx_attached on first observation', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const attached: StatusVfxAttachedEvent[] = []
    gameManager.eventBus.on<StatusVfxAttachedEvent>('status_vfx_attached', (e) => attached.push(e))

    const player = createDefaultPlayer()
    // A real formation's shared party buff is applied inside
    // buildTurnBattle(), BEFORE the first 'fighting' step. First
    // observation must emit attach or the icon can never spawn.
    player.formationLoadout = { formationId: 'cuu_cung_tran', assignments: [] }

    gameManager.registerEnemyTemplates([makeDummyEnemy()])
    gameManager.registerStages([stageFixture()])
    gameManager.setActivePlayer(player)

    const stats = calculateStats(player.baseStats, player.modifiers)
    expect(
      gameManager.startStage(player, stats, gameManager.getStage('status_vfx_stage')!, false),
    ).toBe(true)

    for (let i = 0; i < 300 && attached.length === 0; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const grant = attached.find(
      (e) => e.dotType === 'tran_phap_cuu_cung_buff' && e.targetId === 'player',
    )
    expect(grant).toBeDefined()
    // Formation buffs are authored duration: Infinity → permanent flag.
    expect(grant!.permanent).toBe(true)
  })
})
