import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { CombatEntityId } from '../battle/contracts/ids'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { ENEMIES } from '../../data/enemy/Enemies'
import { STAGES } from '../../data/stage/Stages'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// P3-M3 - the deterministic production-combat proof for the vertical
// slice. A REAL stage (mortal_dong_1 - chapter 1 floor 1, real enemy
// templates) driven by a REAL ngo_dao ritual build under
// SeededCombatRng: seal applications, reaction resolution, victory
// terminal, and stage completion are asserted on the same run - the
// spec's "exercise Seal / Reaction / Ngo Dao in production combat"
// evidence, deterministic because every combat roll rides the session
// stream. Loot contents are NOT asserted (drop rolls sit outside the
// seeded stream by design).

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3
const STAGE_ONE = STAGES.find((stage) => stage.id === 'mortal_dong_1')!
const SEAL_IDS = new Set(['hoa_an', 'han_tuc', 'doc_can', 'liet_thuong', 'tran_an'])

function harness(seed: number) {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  gameManager.setBattleRngFactory(() => new SeededCombatRng(seed))

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
  gameManager.catalogOps.registerStages(STAGES)

  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { linh_bao: LING_BAO_L3 }
  gameManager.setActivePlayer(player)
  expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(true)

  const reactions: string[] = []
  gameManager.eventBus.on<{ reactionId: string }>('reaction_resolved', (e) => {
    reactions.push(e.reactionId)
  })

  return { gameManager, combatSource, player, reactions }
}

function allEnemyBuffIds(gameManager: GameManager): string[] {
  const battle = gameManager.getTurnBattle()
  if (!battle) return []
  return battle.enemies.flatMap((enemy) =>
    gameManager.getBattleBuffs(enemy.entity.id as CombatEntityId).map((b) => b.definitionId),
  )
}

describe('vertical slice - seeded real stage-1 battle (ngo_dao)', () => {
  it('a real stage battle resolves to victory with seals + a reaction observed on the runtime', () => {
    const { gameManager, combatSource, player, reactions } = harness(20260922)

    expect(gameManager.turnBattleOps.startStage(player, STAGE_ONE)).toBe(true)

    const sealsSeen = new Set<string>()
    let steps = 0
    while (true) {
      const state = gameManager.getTurnBattle()!.state
      if (state === 'victory' || state === 'defeat') break
      combatSource.advance(COMBAT_STEP_SECONDS)
      for (const id of allEnemyBuffIds(gameManager)) {
        if (SEAL_IDS.has(id)) sealsSeen.add(id)
      }
      steps += 1
      if (steps > 4000) throw new Error('stage-1 battle did not terminate within 4000 combat steps')
    }

    expect(gameManager.getTurnBattle()!.state).toBe('victory')
    // Reward settlement observable without loot internals: the stage is
    // marked complete on the player's record.
    expect(player.completedStageIds).toContain('mortal_dong_1')
    // Production seal machinery ran in combat: all 5 canonical seals
    // landed on stage-1 enemies via real skill hits (aura entry grant is
    // separately covered by ngoDaoReaction + the E2E spec).
    expect(sealsSeen).toEqual(new Set(['hoa_an', 'han_tuc', 'doc_can', 'liet_thuong', 'tran_an']))
    // Deterministic reaction proof: under this seed the battle resolves
    // exactly these canonical reactions (seeded stream pinned - an
    // engine/pipeline regression changes this set).
    expect([...new Set(reactions)].sort()).toEqual(
      ['duong_viem', 'nhuan_moc', 'tu_thuy', 'tuc_viem', 'xuyen_tho'].sort(),
    )
  })

  it('same seed + same inputs produce the same outcome (determinism)', () => {
    const run = (seed: number) => {
      const { gameManager, combatSource, player } = harness(seed)
      expect(gameManager.turnBattleOps.startStage(player, STAGE_ONE)).toBe(true)
      let steps = 0
      while (true) {
        const battle = gameManager.getTurnBattle()!
        if (battle.state === 'victory' || battle.state === 'defeat') {
          // Terminal state + turns elapsed + step count - a stronger
          // fingerprint than the outcome flag alone.
          return `${battle.state}:${battle.totalTurnsElapsed ?? 0}:${steps}`
        }
        combatSource.advance(COMBAT_STEP_SECONDS)
        if (++steps > 4000) throw new Error('no terminal within 4000 steps')
      }
    }

    const a = run(777)
    const b = run(777)
    expect(a).toBe(b)
  })
})
