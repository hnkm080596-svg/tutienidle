import { describe, expect, it } from 'vitest'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { domainViolations, clearDomainViolations } from '../stats/StatDomain'
import { calculateStats } from '../stats/StatCalculator'
import { createBaseStats } from '../stats/StatBlock'
import {
  NEUTRAL_ROUTE_PROFILE,
  SPELL_PATH_ROUTES,
  applyRouteToEffectiveSkill,
  applyRouteToTurnSkill,
  resolveRouteProfile,
} from './PhapTuRoutes'

describe('SpellPathRoutes', () => {
  it('dot route scales damage down and ailment chance up', () => {
    const eff = applyRouteToEffectiveSkill(
      {
        effects: [
          { type: 'damage', value: 100 },
          { type: 'debuff', buffId: 'bong', ailmentChance: 0.5 },
        ],
      } as EffectiveSkill,
      SPELL_PATH_ROUTES.dot,
    )

    expect(eff.effects[0]).toMatchObject({ value: 85 })
    expect(eff.effects[1]).toMatchObject({ ailmentChance: 0.625 })
  })

  it('dot route scales dealDamage trigger actions too', () => {
    const eff = applyRouteToEffectiveSkill(
      {
        effects: [],
        triggers: [
          {
            trigger: 'onCast',
            actions: [{ type: 'dealDamage', value: 100, damageType: 'physical' }],
          },
        ],
      } as unknown as EffectiveSkill,
      SPELL_PATH_ROUTES.dot,
    )

    expect(eff.triggers![0]!.actions[0]).toMatchObject({ value: 85 })
  })

  it('neutral when route null', () => {
    expect(resolveRouteProfile({ element: 'fire', route: null }).directMultiplier).toBe(1)
    expect(resolveRouteProfile({ element: 'fire', route: 'dot' }).statModifiers).not.toEqual([])
    expect(resolveRouteProfile(undefined)).toBe(NEUTRAL_ROUTE_PROFILE)
  })

  it('no route scales damage up and ailment chance down', () => {
    const eff = applyRouteToEffectiveSkill(
      {
        effects: [
          { type: 'damage', value: 100 },
          { type: 'debuff', buffId: 'bong', ailmentChance: 0.5 },
        ],
      } as EffectiveSkill,
      SPELL_PATH_ROUTES.no,
    )

    expect(eff.effects[0]!.value).toBeCloseTo(115)
    expect(eff.effects[1]).toMatchObject({ ailmentChance: 0.25 })
  })

  it('ailmentStackBonus lands on appliesAilments stacks post-conversion', () => {
    const turnSkill = {
      id: 'hoa_cau_thuat',
      cooldownTurns: 0,
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'bong', chance: 0.5 }],
    } as TurnSkillDefinition

    const routed = applyRouteToTurnSkill(turnSkill, SPELL_PATH_ROUTES.dot)
    // Mission C Task 10c — an omitted stacks means 1 by engine default
    // (TurnBattleSystem ailment.stacks ?? 1), so the bonus ADDS to the
    // implicit stack, not to zero.
    expect(routed.appliesAilments![0]!.stacks).toBe(2)

    const neutral = applyRouteToTurnSkill(turnSkill, NEUTRAL_ROUTE_PROFILE)
    expect(neutral.appliesAilments![0]!.stacks).toBeUndefined()
  })

  it('route stat modifiers carry the spell domain and full StatModifier identity', () => {
    for (const modifier of SPELL_PATH_ROUTES.dot.statModifiers) {
      expect(modifier.domain).toBe('spell')
      expect(modifier.sourceType).toBe('realm')
      expect(modifier.sourceId).toBe('spell')
      expect(modifier.id).toBeTruthy()
    }
  })
})

// Task 3 — the GameManager closure does ALL scoping: only the selected
// element's kit sees route factors; mortal skills / passives / other
// elements / other paths resolve neutral.
describe('route scoping via SkillSystem provider', () => {
  function spellPathPlayer(element: 'fire', route: 'dot' | 'no') {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element, route }
    return player
  }

  it('dot route scales the selected kit basic but not linh_bao', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    const player = spellPathPlayer('fire', 'dot')
    gameManager.setActivePlayer(player)

    gameManager.progressionOps.learnSkill('hoa_cau_thuat')
    gameManager.progressionOps.learnSkill('linh_bao')

    const hoaCau = gameManager.skillManager.get('hoa_cau_thuat')!
    const linhBao = gameManager.skillManager.get('linh_bao')!

    const routedHoaCau = gameManager.skillSystem.getEffectiveSkill(hoaCau)
    const routedLinhBao = gameManager.skillSystem.getEffectiveSkill(linhBao)

    // Kit member: damage 1 -> 0.85, ailment 0.5 -> 0.625.
    expect(routedHoaCau.effects[0]).toMatchObject({ value: 0.85 })
    expect(routedHoaCau.effects[1]).toMatchObject({ ailmentChance: 0.625 })

    // Mortal skill outside the kit: identical under 'dot' vs 'no'.
    player.spellPath.route = 'no'
    expect(gameManager.skillSystem.getEffectiveSkill(linhBao)).toEqual(routedLinhBao)
  })

  it('no element yet -> every skill resolves neutral even on spell', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: null, route: null }
    gameManager.setActivePlayer(player)

    gameManager.progressionOps.learnSkill('hoa_cau_thuat')
    const hoaCau = gameManager.skillManager.get('hoa_cau_thuat')!

    expect(gameManager.skillSystem.getEffectiveSkill(hoaCau).effects[0]).toMatchObject({ value: 1 })
  })

  it('non-spell path never sees route factors', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    const player = createDefaultPlayer()
    player.cultivationPath = 'sword'
    gameManager.setActivePlayer(player)

    gameManager.progressionOps.learnSkill('hoa_cau_thuat')
    const hoaCau = gameManager.skillManager.get('hoa_cau_thuat')!

    expect(gameManager.skillSystem.getEffectiveSkill(hoaCau).effects[0]).toMatchObject({ value: 1 })
  })
})

// Task 3 — route modifiers enter the STATIC partition of BOTH
// aggregators and never the live one (route is fixed during battle).
describe('route stat modifiers aggregation', () => {
  function routedPlayer(route: 'dot' | 'no') {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route }
    return player
  }

  it('getAggregatedModifiers + getBattleBaseModifiers carry route mods; live does not', () => {
    const gameManager = new GameManager()
    const player = routedPlayer('dot')

    const menu = gameManager.effectOps.getAggregatedModifiers(player)
    const battleBase = gameManager.effectOps.getBattleBaseModifiers(player)
    const live = gameManager.effectOps.getLiveBattleModifiers(player)

    for (const routeMod of SPELL_PATH_ROUTES.dot.statModifiers) {
      expect(menu).toContainEqual(routeMod)
      expect(battleBase).toContainEqual(routeMod)
      expect(live).not.toContainEqual(routeMod)
    }
  })

  it('route modifiers pass the StatDomain gate (no violations)', () => {
    clearDomainViolations()
    const gameManager = new GameManager()
    const player = routedPlayer('no')

    const mods = gameManager.effectOps.getBattleBaseModifiers(player)
    const routeMods = mods.filter((m) => m.sourceId === 'spell' && m.id.startsWith('phap_tu_route_'))

    expect(routeMods).toHaveLength(2)
    calculateStats(createBaseStats(), routeMods)
    expect(domainViolations.filter((v) => v.modifier.id.startsWith('phap_tu_route_'))).toHaveLength(0)
  })

  it('no route -> no route modifiers anywhere', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: null }

    expect(gameManager.effectOps.getAggregatedModifiers(player)).not.toContainEqual(
      expect.objectContaining({ sourceId: 'spell', id: expect.stringContaining('route') }),
    )
  })

  it('non-spell path with a committed route -> no route modifiers (dirty-state defense)', () => {
    // Review fix (HIGH-2): criticalRate/criticalDamage/ailmentPotency are
    // universal stats — a route value that leaked onto a phap_tu_an or
    // sword player must not reach the aggregators.
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'
    player.spellPath = { element: 'fire', route: 'no' }

    expect(gameManager.effectOps.getAggregatedModifiers(player)).not.toContainEqual(
      expect.objectContaining({ sourceId: 'spell', id: expect.stringContaining('route') }),
    )
    expect(gameManager.effectOps.getBattleBaseModifiers(player)).not.toContainEqual(
      expect.objectContaining({ sourceId: 'spell', id: expect.stringContaining('route') }),
    )
  })
})
