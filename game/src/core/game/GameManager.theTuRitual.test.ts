import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { CULTIVATION_PATH_KITS, isCultivationPathOffered } from '../player/CultivationPathKit'
import { CAST_LEVELING_THRESHOLDS, HUY_QUYEN_L3_CASTS } from '../skill/SkillSystem'

// The Tu Reimagined (spec 2026-09-15, T6 + section 2.3) — Task 2:
// 1. huy_quyen is a mortal cast-leveled basic (Lv2@1k, Lv3@10k casts),
//    learned wherever tram is granted, NOT insight-upgradeable.
// 2. the_tu_an is offered at the Initiation Ritual iff huy_quyen is Lv3
//    (live read of the skillLevels mirror at offer/choose time).
// 3. Choosing either the_tu path equips its technique and strips the
//    mortal loadout skills (tram + huy_quyen).

function setup() {
  const gameManager = new GameManager()

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)

  return gameManager
}

function setupMortal(huyQuyenCasts = 0) {
  const gameManager = setup()
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { huy_quyen: huyQuyenCasts }
  player.skillLevels = { huy_quyen: huyQuyenCasts >= 10000 ? 3 : huyQuyenCasts >= 1000 ? 2 : 1 }

  gameManager.progressionOps.learnSkill('tram')
  gameManager.progressionOps.learnSkill('huy_quyen')
  gameManager.skillSystem.equipToSlot('tram', 0)

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
    gameManager.progressionOps.learnSkill('huy_quyen')
    const skill = gameManager.skillManager.get('huy_quyen')!

    for (let cast = 0; cast < 999; cast++) gameManager.skillSystem.recordCast('huy_quyen')
    expect(skill.level).toBe(1)

    gameManager.skillSystem.recordCast('huy_quyen')
    expect(skill.level).toBe(2)

    for (let cast = 1000; cast < 10000; cast++) gameManager.skillSystem.recordCast('huy_quyen')
    expect(skill.level).toBe(3)
    expect(skill.totalExperience).toBe(10000)

    for (let cast = 0; cast < 5000; cast++) gameManager.skillSystem.recordCast('huy_quyen')
    expect(skill.level).toBe(3)
    expect(skill.totalExperience).toBe(15000)
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

    gameManager.progressionOps.learnSkill('huy_quyen')

    expect(gameManager.skillSystem.getSkillUpgradeInsightCost('huy_quyen')).toBeUndefined()
    expect(gameManager.skillSystem.upgradeSkill('huy_quyen', player)).toBe(false)
    expect(gameManager.skillManager.get('huy_quyen')!.level).toBe(1)
  })
})

describe('isCultivationPathOffered — ritual offer gate', () => {
  it('the_tu is always offered; the_tu_an requires huy_quyen Lv3', () => {
    const below = createDefaultPlayer()
    below.skillLevels = { huy_quyen: 2 }

    expect(isCultivationPathOffered(CULTIVATION_PATH_KITS.the_tu, below)).toBe(true)
    expect(isCultivationPathOffered(CULTIVATION_PATH_KITS.phap_tu, below)).toBe(true)
    expect(isCultivationPathOffered(CULTIVATION_PATH_KITS.kiem_tu, below)).toBe(true)
    expect(isCultivationPathOffered(CULTIVATION_PATH_KITS.the_tu_an, below)).toBe(false)

    const met = createDefaultPlayer()
    met.skillLevels = { huy_quyen: 3 }

    expect(isCultivationPathOffered(CULTIVATION_PATH_KITS.the_tu_an, met)).toBe(true)
  })

  it('missing huy_quyen mirror (never learned) hides the_tu_an', () => {
    const player = createDefaultPlayer()

    expect(isCultivationPathOffered(CULTIVATION_PATH_KITS.the_tu_an, player)).toBe(false)
  })
})

describe('chooseCultivationPath — the_tu ritual', () => {
  it('the_tu equips kim_cang_bat_hoai_the and strips tram + huy_quyen', () => {
    const { gameManager, player } = setupMortal(0)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('the_tu', player)).toBe(true)
    expect(player.cultivationPath).toBe('the_tu')
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('kim_cang_bat_hoai_the')
    expect(gameManager.skillManager.get('tram')!.equipped).toBe(false)
    expect(gameManager.skillManager.get('huy_quyen')!.equipped).toBe(false)
    expect(player.realmId).toBe('qi_refining')
  })

  it('the_tu_an is rejected when huy_quyen is below Lv3', () => {
    const { gameManager, player } = setupMortal(9999)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('the_tu_an', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.realmId).toBe('mortal')
  })

  it('the_tu_an at Lv3 equips ung_the_than_quyet and strips mortal skills', () => {
    const { gameManager, player } = setupMortal(10000)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('the_tu_an', player)).toBe(true)
    expect(player.cultivationPath).toBe('the_tu_an')
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('ung_the_than_quyet')
    expect(gameManager.skillManager.get('tram')!.equipped).toBe(false)
    expect(gameManager.skillManager.get('huy_quyen')!.equipped).toBe(false)
    expect(player.realmId).toBe('qi_refining')
  })
})
