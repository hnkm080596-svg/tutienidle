import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { MORTAL_PRECURSOR_SKILL_IDS } from '../skill/MortalPrecursors'
import { resolveCultivationPathRuntime } from '../player/CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from '../player/CultivationPathRuntime'
import { SWORD_BASIC } from '../../data/skill/TurnBasicAttacks'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// The sword resolveBasic only reads BASIC_ATTACKS_BY_BUILD — the dep
// surface is stubbed; nothing here is invoked for this path.
const PATH_RUNTIME_STUB_DEPS = {
  skillManager: {},
  skillSystem: {},
  skillTemplates: {},
  nodeRegistry: { getAll: () => [] },
  getNodeLevel: () => 0,
  getSpellPathElement: () => undefined,
  routeProfileProvider: () => {
    throw new Error('unused')
  },
} as unknown as CultivationPathRuntimeDeps

// Kiem Tu Reimagined (spec 2026-09-15 K1/K3/K19) — path choice commits
// way 'sword_pathway' with the canonical fresh state; NO route lock, no
// legacy skill grants, no keystone purchase. Mortal precursor skills
// (the whole set, table-driven) become uncastable/unequippable the
// moment ANY path is chosen.

function setup() {
  const gameManager = new GameManager()

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  return gameManager
}

function setupMortalWithPathReady(tramTotalCasts: number) {
  const gameManager = setup()
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { tram: tramTotalCasts }
  player.nodeLevels.core_tram = tramTotalCasts >= 10000 ? 3 : tramTotalCasts >= 1000 ? 2 : 1

  gameManager.progressionOps.learnSkill('tram', player)

  return { gameManager, player }
}

describe('GameManager — Kiem Tu path choice = fresh hien state', () => {
  it('chooseCultivationPath(sword) sets the canonical fresh state', () => {
    const { gameManager, player } = setupMortalWithPathReady(0)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('sword')
    expect(player.cultivationWay).toBe('sword_pathway')
    expect(player.swordPath).toEqual(freshSwordPathState())
  })

  it('no route lock: tram cast counts never alter the fresh hien state', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)
    expect(player.cultivationWay).toBe('sword_pathway')
    expect(player.swordPath).toEqual(freshSwordPathState())
  })

  it('grants NO legacy kiem-tran/bat-kiem skill — hien basics come from the orb preset', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)

    expect(gameManager.skillManager.has('kiem_tran_luong_nghi')).toBe(false)
    expect(gameManager.skillManager.has('bat_kiem_thuat')).toBe(false)
    // The merged technique still lands (path kit contract unchanged).
    expect(gameManager.techniqueManager.getActive()?.id).toBe('sword_control_art')
  })

  it('chooseCultivationPath(spell) leaves swordPath undefined', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player)).toBe(true)
    expect(player.swordPath).toBeUndefined()
  })

  it('freshSwordPathState returns a detached copy each call', () => {
    const a = freshSwordPathState()
    const b = freshSwordPathState()

    a.preset.push('orb_chem')

    expect(b.preset).toEqual(['orb_dam'])
  })
})

describe('K3 — mortal precursor pick lock post-path', () => {
  it.each(MORTAL_PRECURSOR_SKILL_IDS)(
    'precursor %s cannot be re-picked once a path is chosen',
    skillId => {
      const { gameManager, player } = setupMortalWithPathReady(10_000)

      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)

      // The mortal-only write rejects unconditionally for path players
      // (gate runs BEFORE the learned/exists check).
      expect(
        gameManager.progressionOps.setMortalBasicSkill(player, skillId),
      ).toBe(false)
    },
  )

  it('precursor pick still works for a mortal (no path chosen)', () => {
    const { gameManager, player } = setupMortalWithPathReady(0)

    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'tram')).toBe(true)
  })

  it('sword basic no longer resolves to authored tram (mortal-only)', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)

    // The authored-skill seam: post-path, no Skill object backs the
    // basic (orbs take over at Task 6; the static SWORD_BASIC fallback
    // — which coincidentally carries id 'tram' — is a separate def with
    // no authored scaling/cast-count semantics). Mission C Task 9 moved
    // the resolution behind the path-runtime boundary — assert through
    // it: the resolved basic IS the static authored def, by identity.
    const runtime = resolveCultivationPathRuntime(player, PATH_RUNTIME_STUB_DEPS)

    expect(runtime.resolveBasic(player)).toBe(SWORD_BASIC)
  })
})
