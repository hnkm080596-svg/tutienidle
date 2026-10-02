// BLIND-AUTHORITY FOURTH BIND - FIX WAVE 4 regression guards (CLOSED).
// The carried-save boundary bound four live surfaces without consulting
// the scope authority: resolveActiveWayStatDomains let a dormant way's
// stats.domains reach battle build (deltaDerivers mint
// BETA_SCOPE_HIDDEN_STAT_KEYS mid-battle), resolvePlayerVisualProfileId
// repainted the figure with dormant-path art, the realm-passive card
// ignored hiddenBreakthroughRealmIds, and the pill chip ignored the
// dormant family. Way domains + the visual profile live in this file;
// the card and chip live in their own betaScope guard files.
//
// Contract (Contract sec.H): the save keeps loading and plays as
// mortal-equivalent - unsupportedReleaseReason still flags it
// 'way_out_of_scope' while every live surface binds nothing dormant.
import { describe, expect, it } from 'vitest'

import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import type { TurnBattle } from '../../core/battle/turn/TurnBattleSystem'
import { defineEnemy } from '../../core/enemy/Enemy'
import { resolveActiveWayStatDomains } from '../../core/player/CultivationPathSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { unsupportedReleaseReason } from '../../core/betaScopeSurface'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { createPinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'

// Re-pin the canonical beta lock (global setup unlocks ways/features).
lockBetaFeaturesForTests()
lockBetaWaysForTests()

function carriedSave(cultivationPath: string, cultivationWay: string): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = cultivationPath as PlayerData['cultivationPath']
  player.cultivationWay = cultivationWay as PlayerData['cultivationWay']
  player.realmId = 'qi_refining'
  return player
}

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes([
    ...KIEM_TU_NODES,
    ...PHAP_TU_NODES,
    ...SKILL_CORE_NODES,
    ...THE_TU_NODES,
    ...THE_TU_AN_NODES,
  ])
  gameManager.setCombatClockSource(new ManualClockSource())
  return gameManager
}

function startBattle(gameManager: GameManager, player: PlayerData): TurnBattle {
  gameManager.setActivePlayer(player)
  gameManager.startBattleWithPlayer(
    player,
    defineEnemy({
      id: 'w4_dummy',
      name: 'Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: { maxHp: 100_000, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    }),
  )
  const battle = gameManager.getTurnBattle()
  expect(battle).not.toBeNull()
  return battle!
}

// The catalog template - gradeEffects must be authored so only the
// domain gate (never an empty effect table) can suppress MP emission.
function fiveElementsArt() {
  return { ...TECHNIQUES.find((technique) => technique.id === 'five_elements_art')! }
}

function techniqueTierStats(gameManager: GameManager, player: PlayerData): string[] {
  const channel = gameManager.effectOps
    .getBattleBaseChannels(player)
    .find((entry) => entry.channel === 'technique_tier')
  return (channel?.modifiers ?? []).map((modifier) => modifier.stat)
}

describe('F-WAY-SCOPE-DOMAIN - resolveActiveWayStatDomains binds no dormant domains', () => {
  it.each([
    ['sword_pathway', 'sword'],
    ['body_pathway', 'body'],
    ['hidden_sword_pathway', 'sword'],
    ['hidden_body_pathway', 'body'],
    ['hidden_spell_pathway', 'spell'],
  ])('a carried %s save emits zero stat domains', (way, path) => {
    const player = carriedSave(path, way)

    // Flagged out of scope yet still playing - the bind stays inert.
    expect(unsupportedReleaseReason(player)).toBe('way_out_of_scope')
    expect(resolveActiveWayStatDomains(player)).toEqual([])
  })

  it('control: the beta spell_pathway keeps its spell domain', () => {
    expect(resolveActiveWayStatDomains(carriedSave('spell', 'spell_pathway'))).toEqual(['spell'])
  })

  it('control: a way-less mortal save resolves no way domains', () => {
    expect(resolveActiveWayStatDomains(createDefaultPlayer())).toBeUndefined()
  })

  it('a carried hidden_spell save mints no technique-tier MP modifiers', () => {
    const gameManager = makeManager()
    gameManager.techniqueManager.setActive(fiveElementsArt())

    // The technique itself is beta-owned and admitted - only the carried
    // domain claim was minting maxMp/manaRegenPerTurn through the ungated
    // resolveActiveWayStatDomains read. hpRegenPerTurn is the universal
    // regen every technique holder owns, so it stays emitted.
    expect(techniqueTierStats(gameManager, carriedSave('spell', 'hidden_spell_pathway')))
      .toEqual(['hpRegenPerTurn'])
  })

  it('control: spell_pathway emits the technique-tier MP modifiers', () => {
    const gameManager = makeManager()
    gameManager.techniqueManager.setActive(fiveElementsArt())

    const stats = techniqueTierStats(gameManager, carriedSave('spell', 'spell_pathway'))
    expect(stats).toContain('maxMp')
    expect(stats).toContain('manaRegenPerTurn')
  })
})

describe('F-WAY-SCOPE-DOMAIN - battle build binds no dormant domains', () => {
  it('a carried body_pathway save enters battle with no body domain', () => {
    const participant = startBattle(makeManager(), carriedSave('body', 'body_pathway')).players[0]!

    expect(participant.activeDomains?.has('body') ?? false).toBe(false)
  })

  it('a carried hidden_body_pathway save enters battle with no hidden_body domain', () => {
    const participant = startBattle(makeManager(), carriedSave('body', 'hidden_body_pathway')).players[0]!

    expect(participant.activeDomains?.has('hidden_body') ?? false).toBe(false)
    expect(participant.activeDomains?.has('body') ?? false).toBe(false)
  })

  it('a carried sword_pathway save enters battle with no sword domain', () => {
    const participant = startBattle(makeManager(), carriedSave('sword', 'sword_pathway')).players[0]!

    expect(participant.activeDomains?.has('sword') ?? false).toBe(false)
  })

  it('control: the beta spell_pathway binds its spell domain', () => {
    const participant = startBattle(makeManager(), carriedSave('spell', 'spell_pathway')).players[0]!

    expect(participant.activeDomains?.has('spell')).toBe(true)
  })
})

describe('F-VISUAL-PROFILE - the carried save collapses the figure to mortal', () => {
  it('a carried sword save resolves the mortal visual profile from the store', () => {
    const player = usePlayerStore(createPinia())
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'

    expect(player.visualProfileId).toBe('mortal')
  })

  it('a carried hidden_way save resolves the mortal visual profile from the store', () => {
    const player = usePlayerStore(createPinia())
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'

    expect(player.visualProfileId).toBe('mortal')
  })
})
