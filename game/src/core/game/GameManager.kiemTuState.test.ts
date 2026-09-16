import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { freshKiemTuState, MORTAL_PRECURSOR_SKILL_IDS } from '../kiem-tu/KiemTuState'
import { resolveCultivationPathRuntime } from '../player/CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from '../player/CultivationPathRuntime'
import { KIEM_TU_BASIC } from '../../data/skill/TurnBasicAttacks'

// The kiem_tu resolveBasic only reads BASIC_ATTACKS_BY_BUILD — the dep
// surface is stubbed; nothing here is invoked for this path.
const PATH_RUNTIME_STUB_DEPS = {
  skillManager: {},
  skillSystem: {},
  skillTemplates: {},
  nodeRegistry: { getAll: () => [] },
  getNodeLevel: () => 0,
  getPhapTuElement: () => undefined,
  routeProfileProvider: () => {
    throw new Error('unused')
  },
} as unknown as CultivationPathRuntimeDeps

// Kiem Tu Reimagined (spec 2026-09-15 K1/K3/K19) — path choice commits
// way 'hien' with the canonical fresh state; NO route lock, no
// legacy skill grants, no keystone purchase. Mortal precursor skills
// (the whole set, table-driven) become uncastable/unequippable the
// moment ANY path is chosen.

function setup() {
  const gameManager = new GameManager()

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)

  return gameManager
}

function setupMortalWithPathReady(tramTotalCasts: number) {
  const gameManager = setup()
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { tram: tramTotalCasts }
  player.skillLevels = { tram: tramTotalCasts >= 10000 ? 3 : tramTotalCasts >= 1000 ? 2 : 1 }

  gameManager.progressionOps.learnSkill('tram')
  gameManager.skillSystem.equipToSlot('tram', 0)

  return { gameManager, player }
}

describe('GameManager — Kiem Tu path choice = fresh hien state', () => {
  it('chooseCultivationPath(kiem_tu) sets the canonical fresh state', () => {
    const { gameManager, player } = setupMortalWithPathReady(0)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'hien', player)).toBe(true)
    expect(player.cultivationPath).toBe('kiem_tu')
    expect(player.cultivationWay).toBe('hien')
    expect(player.kiemTu).toEqual(freshKiemTuState())
  })

  it('no route lock: tram cast counts never alter the fresh hien state', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'hien', player)).toBe(true)
    expect(player.cultivationWay).toBe('hien')
    expect(player.kiemTu).toEqual(freshKiemTuState())
  })

  it('grants NO legacy kiem-tran/bat-kiem skill — hien basics come from the orb preset', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'hien', player)

    expect(gameManager.skillManager.has('kiem_tran_luong_nghi')).toBe(false)
    expect(gameManager.skillManager.has('bat_kiem_thuat')).toBe(false)
    // The merged technique still lands (path kit contract unchanged).
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('ngu_kiem')
  })

  it('chooseCultivationPath(phap_tu) leaves kiemTu undefined', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu', 'ngu_hanh', player)).toBe(true)
    expect(player.kiemTu).toBeUndefined()
  })

  it('freshKiemTuState returns a detached copy each call', () => {
    const a = freshKiemTuState()
    const b = freshKiemTuState()

    a.preset.push('orb_chem')

    expect(b.preset).toEqual(['orb_dam'])
  })
})

describe('K3 — mortal precursor lock post-path', () => {
  it.each(MORTAL_PRECURSOR_SKILL_IDS)(
    'precursor %s cannot re-equip into a loadout slot once a path is chosen',
    skillId => {
      const { gameManager, player } = setupMortalWithPathReady(10_000)

      gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'hien', player)

      // Gate runs BEFORE the learned/exists check — precursor ids reject
      // unconditionally for path players (covers linh_bao/huy_quyen the
      // day they get authored, no test change needed).
      expect(
        gameManager.progressionOps.setSkillLoadoutSlot(player, 0, skillId),
      ).toBe(false)
    },
  )

  it('precursor equip still works for a mortal (no path chosen)', () => {
    const { gameManager, player } = setupMortalWithPathReady(0)

    expect(gameManager.progressionOps.setSkillLoadoutSlot(player, 0, 'tram')).toBe(true)
  })

  it('kiem_tu basic no longer resolves to authored tram (mortal-only)', () => {
    const { gameManager, player } = setupMortalWithPathReady(10_000)

    gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'hien', player)

    // The authored-skill seam: post-path, no Skill object backs the
    // basic (orbs take over at Task 6; the static KIEM_TU_BASIC fallback
    // — which coincidentally carries id 'tram' — is a separate def with
    // no authored scaling/cast-count semantics). Mission C Task 9 moved
    // the resolution behind the path-runtime boundary — assert through
    // it: the resolved basic IS the static authored def, by identity.
    const runtime = resolveCultivationPathRuntime(player, PATH_RUNTIME_STUB_DEPS)

    expect(runtime.resolveBasic(player)).toBe(KIEM_TU_BASIC)
  })
})
