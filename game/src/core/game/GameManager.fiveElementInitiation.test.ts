import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/CastLeveling'
import { BETA_MORTAL_STARTER_SKILL_ID } from '../betaScope'
import { getActiveElement } from '../player/CultivationPathSystem'

// BETA SCOPE LOCK v2 (phase-2) - commitFiveElementInitiation atomicity
// proof: a mid-commit leg failure (past the full preflight, inside the
// commit region) must leave the player byte-equivalent to the
// pre-commit state and never half-commit path/way/element/realm.
// Faults are injected through the PUBLIC ops surface (the same
// instances the domain op calls) so the test drives the real commit
// code, not a mock of it.

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

function setup() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.mortalBasicSkillId = BETA_MORTAL_STARTER_SKILL_ID
  player.skillCastCounts = { linh_bao: LING_BAO_L3 }

  return { gameManager, player }
}

function snapshotOf(gameManager: GameManager, player: PlayerData): string {
  return JSON.stringify({
    player,
    skills: gameManager.skillManager.getAll(),
    techniques: gameManager.techniqueManager.getAll(),
  })
}

function expectByteEquivalent(
  before: string,
  gameManager: GameManager,
  player: PlayerData,
): void {
  expect(snapshotOf(gameManager, player)).toBe(before)
}

describe('commitFiveElementInitiation - success path', () => {
  it('commits path + way + element + realm + technique in one op', () => {
    const { gameManager, player } = setup()

    const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)

    expect(result.ok).toBe(true)
    expect(player.cultivationPath).toBe('spell')
    expect(player.cultivationWay).toBe('spell_pathway')
    expect(player.mortalBasicSkillId).toBeUndefined()
    expect(getActiveElement(player)).toBe('fire')
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)
    expect(gameManager.techniqueManager.getActive()?.id).toBe('five_elements_art')
    expect(gameManager.skillManager.has('hoa_cau_thuat')).toBe(true)
    expect(gameManager.progressionOps.getNodeLevel('hoa_linh_ngo', player)).toBe(1)
  })
})

describe('commitFiveElementInitiation - mid-commit fault injection (zero partial mutation)', () => {
  it('starter basic learn fails -> thrown, byte-equivalent player', () => {
    const { gameManager, player } = setup()
    const before = snapshotOf(gameManager, player)

    // The way's starterBasicSkillId leg throws when learn() cannot
    // land the kit member (the op verifies has() after learn()).
    vi.spyOn(gameManager.progressionOps, 'learnSkill').mockReturnValue(false)

    expect(() =>
      gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player),
    ).toThrow('five-element initiation: starter learn failed: linh_bao')

    expectByteEquivalent(before, gameManager, player)
  })

  it('element kit basic learn fails mid-leg -> commit_failed, byte-equivalent player', () => {
    const { gameManager, player } = setup()
    // Pre-learn the way starter so the starter leg passes and the
    // injected learn failure lands inside the element leg (root
    // purchase + kit basic learn + element commit).
    gameManager.progressionOps.learnSkill(BETA_MORTAL_STARTER_SKILL_ID, player)
    const before = snapshotOf(gameManager, player)

    vi.spyOn(gameManager.progressionOps, 'learnSkill').mockReturnValue(false)

    const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)

    expect(result).toEqual({ ok: false, reason: 'commit_failed' })
    expectByteEquivalent(before, gameManager, player)
  })

  it('element commit op fails -> commit_failed, byte-equivalent player', () => {
    const { gameManager, player } = setup()
    const before = snapshotOf(gameManager, player)

    vi.spyOn(gameManager.progressionOps, 'selectSpellPathElement').mockReturnValue(false)

    const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)

    expect(result).toEqual({ ok: false, reason: 'commit_failed' })
    expectByteEquivalent(before, gameManager, player)
  })

  it('realm advance leg throws -> thrown, byte-equivalent player', () => {
    const { gameManager, player } = setup()
    const before = snapshotOf(gameManager, player)

    // Private commit leg: a realm-advance crash mid-transaction must
    // still roll back the whole commit (element/root/kit included).
    vi.spyOn(
      gameManager.realmAdvanceOps as unknown as {
        commitInitiationRealmAdvance: (p: PlayerData) => void
      },
      'commitInitiationRealmAdvance',
    ).mockImplementation(() => {
      throw new Error('injected realm advance crash')
    })

    expect(() =>
      gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player),
    ).toThrow('injected realm advance crash')

    expectByteEquivalent(before, gameManager, player)
  })

  it('technique grant fails -> commit_failed, byte-equivalent player', () => {
    const { gameManager, player } = setup()
    const before = snapshotOf(gameManager, player)

    vi.spyOn(gameManager.realmAdvanceOps, 'grantCanonicalTechnique').mockReturnValue(false)

    const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)

    expect(result).toEqual({ ok: false, reason: 'commit_failed' })
    expectByteEquivalent(before, gameManager, player)
  })
})

describe('commitFiveElementInitiation - commit postconditions under injection', () => {
  it('failed commit leaves the caller retriable (no poisoned half-state)', () => {
    const { gameManager, player } = setup()

    const spy = vi
      .spyOn(gameManager.progressionOps, 'selectSpellPathElement')
      .mockReturnValue(false)

    expect(gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)).toEqual({
      ok: false,
      reason: 'commit_failed',
    })

    spy.mockRestore()

    const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)

    expect(result.ok).toBe(true)
    expect(getActiveElement(player)).toBe('fire')
  })
})
