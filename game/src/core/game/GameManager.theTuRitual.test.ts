import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { CULTIVATION_PATH_MODULES, isCultivationPathOffered } from '../player/CultivationPathKit'
import { CAST_LEVELING_THRESHOLDS, HUY_QUYEN_L3_CASTS } from '../skill/SkillSystem'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { skillCoreNodeId } from '../progression/SkillCoreLevel'

// The Tu Reimagined (spec 2026-09-15, T6 + section 2.3) — Task 2:
// 1. huy_quyen is a mortal cast-leveled basic (Lv2@1k, Lv3@10k casts),
//    learned wherever tram is granted, NOT insight-upgradeable.
// 2. hidden_body is offered at the Initiation Ritual iff huy_quyen is Lv3
//    (live read of the skillLevels mirror at offer/choose time).
// 3. Choosing either body path equips its technique and strips the
//    mortal loadout skills (tram + huy_quyen).

function setup() {
  const gameManager = new GameManager()

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  return gameManager
}

function setupMortal(huyQuyenCasts = 0) {
  const gameManager = setup()
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { huy_quyen: huyQuyenCasts }
  player.nodeLevels[skillCoreNodeId('huy_quyen')] = huyQuyenCasts >= 10000 ? 3 : huyQuyenCasts >= 1000 ? 2 : 1

  gameManager.progressionOps.learnSkill('tram', player)
  gameManager.progressionOps.learnSkill('huy_quyen', player)

  return { gameManager, player }
}

describe('huy_quyen — mortal cast-leveled skill', () => {
  it('exists in SKILLS with attack_speed execution, no resource, maxLevel 3', () => {
    const skill = SKILLS.find((entry) => entry.id === 'huy_quyen')

    expect(skill).toBeDefined()
    expect(skill!.execution?.kind).toBe('attack_speed')
    expect(skill!.resourceType).toBe('none')
    expect(skill!.maxLevel).toBe(3)
  })

  it('auto-levels by cast count: Lv2 at 1000, Lv3 at 10000, never Lv4', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('huy_quyen', player)
    const skill = gameManager.skillManager.get('huy_quyen')!
    const coreId = skillCoreNodeId('huy_quyen')

    for (let cast = 0; cast < 999; cast++) gameManager.skillSystem.recordCast('huy_quyen')
    expect(player.nodeLevels[coreId]).toBe(1)

    gameManager.skillSystem.recordCast('huy_quyen')
    expect(player.nodeLevels[coreId]).toBe(2)

    for (let cast = 1000; cast < 10000; cast++) gameManager.skillSystem.recordCast('huy_quyen')
    expect(player.nodeLevels[coreId]).toBe(3)
    expect(skill.totalExperience).toBe(10000)

    for (let cast = 0; cast < 5000; cast++) gameManager.skillSystem.recordCast('huy_quyen')
    expect(player.nodeLevels[coreId]).toBe(3)
    expect(skill.totalExperience).toBe(15000)

    // Authored level stays frozen - canonical progress is the core.
    expect(skill.level).toBe(1)
  })

  it('CAST_LEVELING_THRESHOLDS covers tram + huy_quyen; HUY_QUYEN_L3_CASTS reads the table', () => {
    expect(CAST_LEVELING_THRESHOLDS['tram']).toEqual({ lv2: 1000, lv3: 10000 })
    expect(CAST_LEVELING_THRESHOLDS['huy_quyen']).toEqual({ lv2: 1000, lv3: 10000 })
    expect(HUY_QUYEN_L3_CASTS).toBe(10000)
  })

  it('cast-leveled skills reject insight upgrade + report no insight cost', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.skillInsight = 999

    gameManager.progressionOps.learnSkill('huy_quyen', player)

    expect(gameManager.progressionOps.getSkillCoreUpgradeCost('huy_quyen', player)).toBeUndefined()
    expect(gameManager.progressionOps.levelUpSkill('huy_quyen', player)).toBe(false)
    expect(player.nodeLevels[skillCoreNodeId('huy_quyen')]).toBe(1)
  })
})

describe('isCultivationPathOffered — ritual offer gate', () => {
  it('the hien ways are always offered; ung_the requires huy_quyen Lv3', () => {
    const below = createDefaultPlayer()
    below.nodeLevels[skillCoreNodeId('huy_quyen')] = 2

    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.body.ways.body_pathway!, below)).toBe(true)
    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.spell.ways.spell_pathway!, below)).toBe(true)
    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.sword.ways.sword_pathway!, below)).toBe(true)
    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.body.ways.hidden_body_pathway!, below)).toBe(false)

    const met = createDefaultPlayer()
    met.nodeLevels[skillCoreNodeId('huy_quyen')] = 3

    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.body.ways.hidden_body_pathway!, met)).toBe(true)
  })

  it('missing huy_quyen mirror (never learned) hides ung_the', () => {
    const player = createDefaultPlayer()

    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.body.ways.hidden_body_pathway!, player)).toBe(false)
  })
})

describe('chooseCultivationPath — body ritual', () => {
  it('(body, hien) grants diamond_body_art and clears the mortal pick (precursors stay learned)', () => {
    const { gameManager, player } = setupMortal(0)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('body')
    expect(player.cultivationWay).toBe('body_pathway')
    expect(gameManager.techniqueManager.getActive()?.id).toBe('diamond_body_art')
    expect(gameManager.skillManager.has('tram')).toBe(true)
    expect(gameManager.skillManager.has('huy_quyen')).toBe(true)
    expect(player.mortalBasicSkillId).toBeUndefined()
    expect(player.realmId).toBe('qi_refining')
  })

  it('(body, ung_the) is rejected when huy_quyen is below Lv3 — zero mutation', () => {
    const { gameManager, player } = setupMortal(9999)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
    expect(gameManager.techniqueManager.getActive()).toBeUndefined()
  })

  it('(body, ung_the) at Lv3 writes the base body id + ung_the way (precursors stay learned)', () => {
    const { gameManager, player } = setupMortal(10000)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('body')
    expect(player.cultivationWay).toBe('hidden_body_pathway')
    expect(gameManager.techniqueManager.getActive()?.id).toBe('responsive_body_art')
    expect(gameManager.skillManager.has('tram')).toBe(true)
    expect(gameManager.skillManager.has('huy_quyen')).toBe(true)
    expect(player.realmId).toBe('qi_refining')
  })
})

describe('ritual preflight — core metadata atomicity (M-QI-05)', () => {
  function setupWithTamperedCore(coreId: string, maxLevel: number) {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(
      SKILL_CORE_NODES.map((node) => (node.id === coreId ? { ...node, maxLevel } : node)),
    )

    return gameManager
  }

  function ritualSnapshot(gameManager: GameManager, player: ReturnType<typeof createDefaultPlayer>) {
    return {
      player: structuredClone(player),
      learnedIds: gameManager.skillManager.getAll().map((skill) => skill.id),
      techniqueId: gameManager.techniqueManager.getActive()?.id,
    }
  }

  function expectRitualUnchanged(
    gameManager: GameManager,
    player: ReturnType<typeof createDefaultPlayer>,
    before: ReturnType<typeof ritualSnapshot>,
  ) {
    expect(player).toEqual(before.player)
    expect(gameManager.skillManager.getAll().map((skill) => skill.id)).toEqual(before.learnedIds)
    expect(gameManager.techniqueManager.getActive()?.id).toBe(before.techniqueId)
  }

  it('a tampered STARTER core (core_huy_quyen maxLevel) rejects the hien ritual with zero mutation', () => {
    // starterBasicSkillId 'huy_quyen' sits in the atomic preflight list:
    // template maxLevel 3 vs tampered core maxLevel 99 -> preflightLearnableSkill
    // fails BEFORE applyPathChoice, so path/way/realm/technique/mortal
    // pick/skills/nodeLevels stay byte-identical.
    const gameManager = setupWithTamperedCore('core_huy_quyen', 99)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    player.mortalBasicSkillId = 'tram'
    gameManager.progressionOps.learnSkill('tram', player)

    const before = ritualSnapshot(gameManager, player)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(false)
    expectRitualUnchanged(gameManager, player, before)
  })

  it('a tampered NATIVE core (core_tham_the maxLevel) rejects the ung_the ritual with zero mutation', () => {
    // preflightSkillCoreGrant compares the registered core against the
    // authored catalog policy (10 for damage-bearing natives): a
    // tampered/mismatched maxLevel fails BEFORE the path/way commit.
    const gameManager = setupWithTamperedCore('core_tham_the', 99)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    player.skillCastCounts = { huy_quyen: 10000 }
    player.nodeLevels[skillCoreNodeId('huy_quyen')] = 3
    player.mortalBasicSkillId = 'tram'
    gameManager.progressionOps.learnSkill('tram', player)
    gameManager.progressionOps.learnSkill('huy_quyen', player)

    const before = ritualSnapshot(gameManager, player)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'hidden_body_pathway', player)).toBe(false)
    expectRitualUnchanged(gameManager, player, before)
  })
})
