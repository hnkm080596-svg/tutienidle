import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from './Player'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { NodeRegistry } from '../progression/NodeRegistry'
import { TemplateRegistry } from '../game/TemplateRegistry'
import type { Skill } from '../skill/Skill'
import { NEUTRAL_ROUTE_PROFILE } from '../phap-tu/PhapTuRoutes'
import { resolveCultivationPathRuntime } from './CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from './CultivationPathRuntime'
import { GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'

// Mission C Task 9 — the path-runtime boundary is the ONLY dispatch site
// for cultivation-path combat integration. GameManagerTurnBattleOps
// consumes the runtime interface; it never branches on path identity.

function makeDeps(): CultivationPathRuntimeDeps {
  const skillManager = new SkillManager()
  return {
    skillManager,
    skillSystem: new SkillSystem(skillManager),
    skillTemplates: new TemplateRegistry<Skill>(),
    nodeRegistry: new NodeRegistry(),
    getNodeLevel: () => 0,
    getSpellPathElement: () => undefined,
    routeProfileProvider: () => NEUTRAL_ROUTE_PROFILE,
  }
}

const ENEMY = defineEnemy({
  id: 'path_rt_enemy',
  name: 'Dummy',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: { maxHp: 1_000_000, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

describe('CultivationPathRuntime registry', () => {
  it('dispatches every authored path:way pair plus the mortal fallback', () => {
    const deps = makeDeps()
    const pairs: Array<[string, string]> = [
      ['sword', 'sword_pathway'],
      ['sword', 'hidden_sword_pathway'],
      ['spell', 'spell_pathway'],
      ['spell', 'hidden_spell_pathway'],
      ['body', 'body_pathway'],
      ['body', 'hidden_body_pathway'],
    ]

    for (const [path, way] of pairs) {
      const player = createDefaultPlayer()
      player.cultivationPath = path as typeof player.cultivationPath
      player.cultivationWay = way as typeof player.cultivationWay
      expect(resolveCultivationPathRuntime(player, deps)).toBeDefined()
    }

    const mortal = createDefaultPlayer()
    expect(resolveCultivationPathRuntime(mortal, deps).resolveBasic(mortal)).toBe(GENERIC_PHYSICAL_BASIC)
  })

  it('sword runtimes expose the dynamic-basic provider; ngu adds emblem slots', () => {
    const deps = makeDeps()

    const hien = createDefaultPlayer()
    hien.cultivationPath = 'sword'
    hien.cultivationWay = 'sword_pathway'
    hien.swordPath = freshSwordPathState()
    const hienRuntime = resolveCultivationPathRuntime(hien, deps)
    expect(hienRuntime.buildDynamicBasic?.(hien, [], () => 0.5)).toBeDefined()
    expect(hienRuntime.emblemSlots?.()).toBeUndefined()

    const ngu = createDefaultPlayer()
    ngu.cultivationPath = 'sword'
    ngu.cultivationWay = 'hidden_sword_pathway'
    ngu.swordPath = freshSwordPathState()
    const nguRuntime = resolveCultivationPathRuntime(ngu, deps)
    expect(nguRuntime.buildDynamicBasic?.(ngu, [], () => 0.5)).toBeDefined()
    const emblems = nguRuntime.emblemSlots?.()
    expect(emblems?.special?.id).toBe('tu_kiem_y')
    expect(emblems?.ultimate?.id).toBe('kiem_dao_cascade')
  })

  it('a battle built through the ops consumes an injected path runtime — no path branch in the consumer', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)

    // A path-id the shipped registry does NOT know: only an injectable
    // resolver could produce this marker runtime.
    const marker = { ...GENERIC_PHYSICAL_BASIC, id: 'fake_path_basic' }
    gameManager.setPathRuntimeResolver(() => ({
      resolveBasic: () => marker,
      resolveSpecialUltimate: () => undefined,
      resolveMaxThe: () => 7,
      resolveStatDomains: () => undefined,
    }))

    gameManager.startBattleWithPlayer(player, ENEMY)

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('fake_path_basic')
    expect(participant.entity.maxThe).toBe(7)
  })

  it('sword ngu parity through the real build: provider + emblem slots survive the boundary', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    player.cultivationPath = 'sword'
    player.cultivationWay = 'hidden_sword_pathway'
    player.swordPath = { ...freshSwordPathState(), kiemDaoCount: 2 }
    gameManager.setActivePlayer(player)

    gameManager.startBattleWithPlayer(player, ENEMY)
    combatSource.advance(COMBAT_STEP_SECONDS)

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.dynamicBasic).toBeDefined()
    expect(participant.special?.skill.id).toBe('tu_kiem_y')
    expect(participant.ultimate?.skill.id).toBe('kiem_dao_cascade')
  })
})
