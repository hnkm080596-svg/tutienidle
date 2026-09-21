import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { CANONICAL_REALM_PASSIVE_LADDER } from '../../data/progression/RealmPassiveLadder'

// P7-M2 - the realm-entry passive is WAY-owned: the committed way's
// realmRewards[realm].passiveSkillId (composed from the canonical
// ladder), delivered by syncRealmPassive. Techniques no longer carry
// the ladder (passiveSkillIdsByRealm) or initiation passives
// (innateSkillId) - both channels retired.

function makeManager({ skipSkillIds = [] as string[] } = {}) {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(
    SKILLS.filter((skill) => !skipSkillIds.includes(skill.id)),
  )
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  // sword ritual grants a node on commit - the transaction boundary
  // requires it registered (same fixture as the phapTuAnPath suite).
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  return { gameManager, player }
}

describe('realm-entry passive — way-owned (P7-M2)', () => {
  it('sword ritual grants the canonical qi_refining passive + the way initiation passive', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)
    expect(player.realmId).toBe('qi_refining')

    // Canonical ladder entry at qi_refining (syncRealmPassive seam) -
    // membership IS the active authority (learned passives always apply).
    expect(gameManager.skillManager.has(CANONICAL_REALM_PASSIVE_LADDER.qi_refining!)).toBe(true)

    // Way-declared initiation passive (was ngu_kiem.innateSkillId).
    expect(gameManager.skillManager.has('passive_kiem_tam_lanh_liet')).toBe(true)
  })

  it('body ritual grants the way initiation passive', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(true)
    expect(gameManager.skillManager.has('passive_kim_cang_y_chi')).toBe(true)
  })

  it('syncRealmPassive is idempotent on repeat calls', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)

    const skill = gameManager.skillManager.get(CANONICAL_REALM_PASSIVE_LADDER.qi_refining!)

    expect(() => {
      gameManager.realmAdvanceOps.syncRealmPassive(player)
      gameManager.realmAdvanceOps.syncRealmPassive(player)
    }).not.toThrow()
    expect(gameManager.skillManager.get(CANONICAL_REALM_PASSIVE_LADDER.qi_refining!)).toBe(skill)
  })

  it('a way-less or way-mismatched player gets NO passive — the canonical ladder does not leak', () => {
    const { gameManager } = makeManager()

    // Mortal, no pair at all.
    const mortal = createDefaultPlayer()
    mortal.realmId = 'qi_refining'
    mortal.realmLevel = 1
    gameManager.realmAdvanceOps.syncRealmPassive(mortal)
    expect(gameManager.skillManager.has(CANONICAL_REALM_PASSIVE_LADDER.qi_refining!)).toBe(false)

    // Corrupt pair: path set, way missing - resolves no way.
    const corrupt = createDefaultPlayer()
    corrupt.realmId = 'qi_refining'
    corrupt.realmLevel = 1
    corrupt.cultivationPath = 'sword'
    gameManager.realmAdvanceOps.syncRealmPassive(corrupt)
    expect(gameManager.skillManager.has(CANONICAL_REALM_PASSIVE_LADDER.qi_refining!)).toBe(false)

    // Cross-path way: resolves no way either.
    const mismatched = createDefaultPlayer()
    mismatched.realmId = 'qi_refining'
    mismatched.realmLevel = 1
    mismatched.cultivationPath = 'sword'
    mismatched.cultivationWay = 'spell_pathway'
    gameManager.realmAdvanceOps.syncRealmPassive(mismatched)
    expect(gameManager.skillManager.has(CANONICAL_REALM_PASSIVE_LADDER.qi_refining!)).toBe(false)
  })

  it('the technique grant alone delivers no passive — the technique is not the passive owner', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.realmId = 'qi_refining'
    player.realmLevel = 1

    expect(gameManager.realmAdvanceOps.grantCanonicalTechnique('myriad_swords_art', player)).toBe(true)
    expect(gameManager.skillManager.has('passive_kiem_tam_lanh_liet')).toBe(false)
  })

  it('a missing passiveSkillIds template fails the whole choice atomically — zero mutation', () => {
    const { gameManager, player } = makeManager({ skipSkillIds: ['passive_kim_cang_y_chi'] })
    gameManager.setActivePlayer(player)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
    expect(gameManager.techniqueManager.getActive()).toBeUndefined()
    expect(gameManager.skillManager.has('passive_kim_cang_y_chi')).toBe(false)
  })

  it('a passive-only realmRewards record returns true while the grant op delivers nothing itself', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.realmId = 'qi_refining'
    gameManager.realmAdvanceOps.grantCanonicalTechnique('myriad_swords_art', player)

    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'
    player.realmId = 'foundation_establishment'

    // The composed record exists ({passiveSkillId} only) - the op
    // reports the way's reward, but technique/artifact stay untouched.
    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(gameManager.techniqueManager.getActive()?.id).toBe('myriad_swords_art')
    expect(player.artifact).toBeUndefined()

    // Delivery is syncRealmPassive's channel.
    gameManager.realmAdvanceOps.syncRealmPassive(player)
    expect(
      gameManager.skillManager.has(CANONICAL_REALM_PASSIVE_LADDER.foundation_establishment!),
    ).toBe(true)
  })
})
