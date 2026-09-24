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
import { SPELL_PATHWAY, HIDDEN_SPELL_PATHWAY } from '../phap-tu/PhapTuPath'
import { BODY_PATHWAY, HIDDEN_BODY_PATHWAY } from '../the-tu/TheTuPath'
import { SWORD_PATHWAY, HIDDEN_SWORD_PATHWAY } from '../kiem-tu/KiemTuPath'

// Mission C Task 9 - the path-runtime boundary is the ONLY dispatch site
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
  rewards: { techniqueMastery: 0, spiritStone: 0 },
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

  it('mortal runtime resolves the persisted mortalBasicSkillId pick', () => {
    const deps = makeDeps()
    const skillTemplates = deps.skillTemplates as TemplateRegistry<Skill>
    for (const skill of SKILLS) {
      skillTemplates.register(skill.id, skill)
    }
    for (const id of ['tram', 'linh_bao', 'huy_quyen']) {
      (deps.skillSystem as SkillSystem).learn(skillTemplates.get(id)!)
    }

    const picked = createDefaultPlayer()
    picked.mortalBasicSkillId = 'linh_bao'
    expect(resolveCultivationPathRuntime(picked, deps).resolveBasic(picked)?.id).toBe('linh_bao')

    const fist = createDefaultPlayer()
    fist.mortalBasicSkillId = 'huy_quyen'
    expect(resolveCultivationPathRuntime(fist, deps).resolveBasic(fist)?.id).toBe('huy_quyen')

    const unset = createDefaultPlayer()
    expect(resolveCultivationPathRuntime(unset, deps).resolveBasic(unset)?.id).toBe('tram')
  })

  it('illegal or unlearned picks fall back to the tram default', () => {
    const deps = makeDeps()
    const skillTemplates = deps.skillTemplates as TemplateRegistry<Skill>
    for (const skill of SKILLS) {
      skillTemplates.register(skill.id, skill)
    }
    (deps.skillSystem as SkillSystem).learn(skillTemplates.get('tram')!)

    const illegal = createDefaultPlayer()
    illegal.mortalBasicSkillId = 'hoa_cau_thuat'
    expect(resolveCultivationPathRuntime(illegal, deps).resolveBasic(illegal)?.id).toBe('tram')

    const unlearned = createDefaultPlayer()
    unlearned.mortalBasicSkillId = 'huy_quyen'
    expect(resolveCultivationPathRuntime(unlearned, deps).resolveBasic(unlearned)?.id).toBe('tram')
  })

  // P7-M4 sec.4.5b - path starter basics: the way declares
  // starterBasicSkillId; the runtime resolves it THROUGH the committed
  // way definition as a fallback until the way's own kit supersedes.
  describe('path starter basics (way-authored fallback)', () => {
    function depsWithLearned(ids: readonly string[]): CultivationPathRuntimeDeps {
      const deps = makeDeps()
      const skillTemplates = deps.skillTemplates as TemplateRegistry<Skill>
      for (const skill of SKILLS) {
        skillTemplates.register(skill.id, skill)
      }
      for (const id of ids) {
        (deps.skillSystem as SkillSystem).learn(skillTemplates.get(id)!)
      }
      return deps
    }

    it('authored contract — starter ids live on the way definitions', () => {
      expect(SPELL_PATHWAY.starterBasicSkillId).toBe('linh_bao')
      expect(BODY_PATHWAY.starterBasicSkillId).toBe('huy_quyen')
      expect(SWORD_PATHWAY.starterBasicSkillId).toBeUndefined()
      expect(HIDDEN_SWORD_PATHWAY.starterBasicSkillId).toBeUndefined()
      expect(HIDDEN_SPELL_PATHWAY.starterBasicSkillId).toBeUndefined()
      expect(HIDDEN_BODY_PATHWAY.starterBasicSkillId).toBeUndefined()
    })

    it('spell_pathway resolves linh_bao as basic until an element is picked', () => {
      const deps = depsWithLearned(['linh_bao', 'hoa_cau_thuat'])
      const player = createDefaultPlayer()
      player.cultivationPath = 'spell'
      player.cultivationWay = 'spell_pathway'

      expect(resolveCultivationPathRuntime(player, deps).resolveBasic(player)?.id).toBe('linh_bao')
    })

    it('the element kit supersedes the starter once the element commits', () => {
      const deps = depsWithLearned(['linh_bao', 'hoa_cau_thuat'])
      deps.getSpellPathElement = () => 'fire'
      const player = createDefaultPlayer()
      player.cultivationPath = 'spell'
      player.cultivationWay = 'spell_pathway'

      expect(resolveCultivationPathRuntime(player, deps).resolveBasic(player)?.id).toBe('hoa_cau_thuat')
    })

    it('body_pathway resolves huy_quyen as basic until a root node exists', () => {
      const deps = depsWithLearned(['huy_quyen'])
      const player = createDefaultPlayer()
      player.cultivationPath = 'body'
      player.cultivationWay = 'body_pathway'

      expect(resolveCultivationPathRuntime(player, deps).resolveBasic(player)?.id).toBe('huy_quyen')
    })

    it('the owned root kit supersedes the starter', () => {
      const deps = depsWithLearned(['huy_quyen'])
      deps.getNodeLevel = (nodeId) => (nodeId === 'cuong_chien' ? 1 : 0)
      const player = createDefaultPlayer()
      player.cultivationPath = 'body'
      player.cultivationWay = 'body_pathway'

      expect(resolveCultivationPathRuntime(player, deps).resolveBasic(player)?.id).toBe('cuong_quyen')
    })

    it('an unlearned starter is skipped to the next fallback (defensive check)', () => {
      const deps = depsWithLearned([])
      const player = createDefaultPlayer()
      player.cultivationPath = 'spell'
      player.cultivationWay = 'spell_pathway'

      const basic = resolveCultivationPathRuntime(player, deps).resolveBasic(player)
      expect(basic).toBeDefined()
      expect(basic?.id).not.toBe('linh_bao')
    })
  })

  it('sword runtimes expose the dynamic-basic provider; neither way authors emblem slots', () => {
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
    // Ngu Kiem Beta — no emblem slots: one evolving basic is the whole
    // kit (special/ultimate stay undefined by design).
    expect(nguRuntime.emblemSlots?.()).toBeUndefined()
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

  it('sword ngu parity through the real build: provider survives, emblem slots absent', () => {
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
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })
})
