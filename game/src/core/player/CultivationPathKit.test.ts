import { describe, expect, it } from 'vitest'
import {
  CULTIVATION_PATH_MODULES,
  getActiveWayDefinition,
  isCultivationPathOffered,
} from './CultivationPathKit'
import { listOfferableWays } from './CultivationPathSystem'
import { createDefaultPlayer } from './Player'
import { DOMAIN_SOURCE_WHITELIST } from '../stats/StatDomain'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'

// Cultivation Path Framework (spec 2026-09-16, M1+M7) — the kit catalog
// evolved in place into the path/way module catalog. These tests pin
// the catalog contract: exactly 3 base path ids, way definitions carry
// the former kit fields, and the legacy 5-id union + its era adapters
// are gone (a persisted _an id fails the v66 save check).

describe('CULTIVATION_PATH_MODULES — catalog shape', () => {
  it('contains exactly the three base path ids', () => {
    expect(Object.keys(CULTIVATION_PATH_MODULES).sort()).toEqual(['kiem_tu', 'phap_tu', 'the_tu'])
  })

  it('module.id matches its catalog key; way ids are unique per path; way.pathId === catalog key', () => {
    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      expect(pathModule.id).toBe(pathId)

      const wayIds = Object.keys(pathModule.ways)
      expect(new Set(wayIds).size).toBe(wayIds.length)

      for (const [wayId, way] of Object.entries(pathModule.ways)) {
        expect(way.id).toBe(wayId)
        expect(way.pathId).toBe(pathId)
      }
    }
  })

  it('declares exactly the six current ways', () => {
    expect(Object.keys(CULTIVATION_PATH_MODULES.kiem_tu.ways).sort()).toEqual(['hien', 'ngu'])
    expect(Object.keys(CULTIVATION_PATH_MODULES.phap_tu.ways).sort()).toEqual(['ngo_dao', 'ngu_hanh'])
    expect(Object.keys(CULTIVATION_PATH_MODULES.the_tu.ways).sort()).toEqual(['hien', 'ung_the'])
  })

  it('every way techniqueId resolves against the technique templates', () => {
    const techniqueIds = new Set(TECHNIQUES.map((technique) => technique.id))

    for (const pathModule of Object.values(CULTIVATION_PATH_MODULES)) {
      for (const way of Object.values(pathModule.ways)) {
        expect(techniqueIds.has(way.techniqueId), `${pathModule.id}/${way.id}`).toBe(true)
      }
    }
  })

  it('every declared way skillId resolves against the skill templates', () => {
    const skillIds = new Set(SKILLS.map((skill) => skill.id))

    for (const pathModule of Object.values(CULTIVATION_PATH_MODULES)) {
      for (const way of Object.values(pathModule.ways)) {
        for (const skillId of way.skillIds ?? []) {
          expect(skillIds.has(skillId), `${pathModule.id}/${way.id}:${skillId}`).toBe(true)
        }
      }
    }
  })

  it('every way declares its owned stat domains via the stats facet', () => {
    for (const pathModule of Object.values(CULTIVATION_PATH_MODULES)) {
      for (const way of Object.values(pathModule.ways)) {
        expect(
          way.stats?.domains?.length,
          `${pathModule.id}/${way.id} must declare owned domains`,
        ).toBeGreaterThan(0)
      }
    }
  })
})

describe('way definitions — authored content carried over from kits', () => {
  it("kiem_tu hien keeps the ngu_kiem technique and metal element", () => {
    const way = CULTIVATION_PATH_MODULES.kiem_tu.ways.hien

    expect(way?.techniqueId).toBe('ngu_kiem')
    expect(way?.element).toBe('metal')
  })

  it('kiem_tu ngu exists in the catalog with the van_kiem_quyet technique and the tram Lv3 gate', () => {
    const way = CULTIVATION_PATH_MODULES.kiem_tu.ways.ngu

    expect(way?.techniqueId).toBe('van_kiem_quyet')
    expect(way?.offerGate).toEqual({ requiresSkillLevel: { skillId: 'tram', level: 3 } })
  })

  it('phap_tu ngu_hanh carries the base kit stats and the foundation_establishment reward', () => {
    const way = CULTIVATION_PATH_MODULES.phap_tu.ways.ngu_hanh

    expect(way?.techniqueId).toBe('dai_ngu_hanh_chan_quyet')
    expect(way?.statModifiers?.map((modifier) => modifier.id)).toEqual([
      'phap_tu_linh_luc',
      'phap_tu_linh_luc_regen',
      'phap_tu_ho_the',
    ])
    expect(way?.realmRewards?.foundation_establishment).toEqual({
      techniqueId: 'dai_ngu_hanh_quyet_truc_co',
      artifactId: 'ngu_hanh_chau',
    })
  })

  it('phap_tu ngo_dao carries the an kit stats and the linh_bao cast gate', () => {
    const way = CULTIVATION_PATH_MODULES.phap_tu.ways.ngo_dao

    expect(way?.techniqueId).toBe('ngo_dao_chan_quyet')
    expect(way?.statModifiers?.map((modifier) => modifier.id)).toEqual([
      'ngo_dao_linh_luc',
      'ngo_dao_linh_luc_regen',
      'ngo_dao_ho_the',
    ])
    expect(way?.offerGate).toEqual({ requiresSkillCastLevel: { skillId: 'linh_bao', level: 3 } })
  })

  it("the_tu hien keeps the kim_cang_bat_hoai_the technique and metal element", () => {
    const way = CULTIVATION_PATH_MODULES.the_tu.ways.hien

    expect(way?.techniqueId).toBe('kim_cang_bat_hoai_the')
    expect(way?.element).toBe('metal')
  })

  it('the_tu ung_the carries the an kit: ung_the_than_quyet, huy_quyen gate, the economy capability', () => {
    const way = CULTIVATION_PATH_MODULES.the_tu.ways.ung_the

    expect(way?.techniqueId).toBe('ung_the_than_quyet')
    expect(way?.offerGate).toEqual({ requiresSkillLevel: { skillId: 'huy_quyen', level: 3 } })
    expect(way?.capabilities?.static).toContain('the_tu.the_economy')
  })
})

describe('getActiveWayDefinition — strict persisted pair', () => {
  it('resolves the way for every valid (path, way) pair', () => {
    const cases: Array<[string, string, string]> = [
      ['kiem_tu', 'hien', 'ngu_kiem'],
      ['kiem_tu', 'ngu', 'van_kiem_quyet'],
      ['phap_tu', 'ngu_hanh', 'dai_ngu_hanh_chan_quyet'],
      ['phap_tu', 'ngo_dao', 'ngo_dao_chan_quyet'],
      ['the_tu', 'hien', 'kim_cang_bat_hoai_the'],
      ['the_tu', 'ung_the', 'ung_the_than_quyet'],
    ]

    for (const [pathId, wayId, techniqueId] of cases) {
      const way = getActiveWayDefinition({
        cultivationPath: pathId as 'kiem_tu',
        cultivationWay: wayId,
      })
      expect(way?.id, `${pathId}/${wayId}`).toBe(wayId)
      expect(way?.techniqueId).toBe(techniqueId)
    }
  })

  it('fails closed on a way-less save, a foreign way, or no path', () => {
    expect(getActiveWayDefinition({ cultivationPath: 'the_tu' })).toBeUndefined()
    expect(
      getActiveWayDefinition({ cultivationPath: 'the_tu', cultivationWay: 'ngo_dao' }),
    ).toBeUndefined()
    expect(getActiveWayDefinition({ cultivationWay: 'hien' })).toBeUndefined()
    expect(getActiveWayDefinition({})).toBeUndefined()
  })
})

describe('isCultivationPathOffered — way offer gates', () => {
  it('ungated ways are always offered', () => {
    const player = createDefaultPlayer()

    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.kiem_tu.ways.hien!, player)).toBe(true)
    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.phap_tu.ways.ngu_hanh!, player)).toBe(
      true,
    )
    expect(isCultivationPathOffered(CULTIVATION_PATH_MODULES.the_tu.ways.hien!, player)).toBe(true)
  })

  it('ung_the keeps the huy_quyen Lv3 requiresSkillLevel gate (skillLevels mirror)', () => {
    const way = CULTIVATION_PATH_MODULES.the_tu.ways.ung_the!

    const below = createDefaultPlayer()
    below.skillLevels = { huy_quyen: 2 }
    expect(isCultivationPathOffered(way, below)).toBe(false)

    const met = createDefaultPlayer()
    met.skillLevels = { huy_quyen: 3 }
    expect(isCultivationPathOffered(way, met)).toBe(true)

    // Missing mirror (never learned) hides the way.
    expect(isCultivationPathOffered(way, createDefaultPlayer())).toBe(false)
  })

  it('ngo_dao gates on linh_bao cast level via skillCastCounts + CAST_LEVELING_THRESHOLDS', () => {
    const way = CULTIVATION_PATH_MODULES.phap_tu.ways.ngo_dao!
    const lv3Casts = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

    const below = createDefaultPlayer()
    below.skillCastCounts = { linh_bao: lv3Casts - 1 }
    expect(isCultivationPathOffered(way, below)).toBe(false)

    const met = createDefaultPlayer()
    met.skillCastCounts = { linh_bao: lv3Casts }
    expect(isCultivationPathOffered(way, met)).toBe(true)

    // Cast-count gate, not the skillLevels mirror: a Lv3 mirror with no
    // casts does NOT satisfy it.
    const levelsOnly = createDefaultPlayer()
    levelsOnly.skillLevels = { linh_bao: 3 }
    levelsOnly.skillCastCounts = {}
    expect(isCultivationPathOffered(way, levelsOnly)).toBe(false)
  })

  it('the ngu way gate evaluates tram Lv3', () => {
    const ngu = CULTIVATION_PATH_MODULES.kiem_tu.ways.ngu!

    const below = createDefaultPlayer()
    below.skillLevels = { tram: 2 }
    expect(isCultivationPathOffered(ngu, below)).toBe(false)

    const met = createDefaultPlayer()
    met.skillLevels = { tram: 3 }
    expect(isCultivationPathOffered(ngu, met)).toBe(true)
  })
})

describe('listOfferableWays — ritual offers', () => {
  it('lists all six (path, way) pairs: ungated first, gated last in path order', () => {
    const player = createDefaultPlayer()
    player.skillLevels = { huy_quyen: 3, tram: 3 }
    player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }

    const offered = listOfferableWays(player).map((offer) => `${offer.pathId}/${offer.wayId}`)

    expect(offered).toEqual([
      'phap_tu/ngu_hanh',
      'kiem_tu/hien',
      'the_tu/hien',
      'phap_tu/ngo_dao',
      'kiem_tu/ngu',
      'the_tu/ung_the',
    ])
    expect(listOfferableWays(player).every((offer) => offer.eligible)).toBe(true)
  })

  it('with no gates met only the ungated trio is eligible — gated ways stay listed with a reason', () => {
    const player = createDefaultPlayer()

    const offers = listOfferableWays(player)
    const eligible = offers.filter((offer) => offer.eligible)

    expect(eligible.map((offer) => `${offer.pathId}/${offer.wayId}`)).toEqual([
      'phap_tu/ngu_hanh',
      'kiem_tu/hien',
      'the_tu/hien',
    ])
    for (const offer of offers.filter((o) => !o.eligible)) {
      expect(offer.reason, `${offer.pathId}/${offer.wayId}`).toBeDefined()
    }
  })

  it('ngo_dao follows the linh_bao cast threshold exactly', () => {
    const player = createDefaultPlayer()
    const ngoDao = (p: typeof player) =>
      listOfferableWays(p).find((o) => o.pathId === 'phap_tu' && o.wayId === 'ngo_dao')

    player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 - 1 }
    expect(ngoDao(player)?.eligible).toBe(false)

    player.skillCastCounts.linh_bao = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3
    expect(ngoDao(player)?.eligible).toBe(true)
  })

  it('ung_the follows the huy_quyen Lv3 mirror exactly', () => {
    const player = createDefaultPlayer()
    const ungThe = () =>
      listOfferableWays(player).find((o) => o.pathId === 'the_tu' && o.wayId === 'ung_the')

    player.skillLevels = { huy_quyen: 2 }
    expect(ungThe()?.eligible).toBe(false)

    player.skillLevels.huy_quyen = 3
    expect(ungThe()?.eligible).toBe(true)
  })
})

describe('stat domains — the_tu_an domain ownership', () => {
  it('the ung_the way facet owns the the_tu_an domain; hien owns the_tu', () => {
    expect(CULTIVATION_PATH_MODULES.the_tu.ways.ung_the?.stats?.domains).toEqual(['the_tu_an'])
    expect(CULTIVATION_PATH_MODULES.the_tu.ways.hien?.stats?.domains).toEqual(['the_tu'])
  })

  it('DOMAIN_SOURCE_WHITELIST declares the the_tu / the_tu_an emitter homes', () => {
    const theTuFiles = (DOMAIN_SOURCE_WHITELIST.the_tu ?? []).map((e) => e.file)
    const theTuAnFiles = (DOMAIN_SOURCE_WHITELIST.the_tu_an ?? []).map((e) => e.file)

    expect(theTuFiles).toContain('data/progression/TheTu*')
    expect(theTuFiles).toContain('data/skill/TheTu*')
    expect(theTuFiles).toContain('data/buff/TheTu*')
    expect(theTuAnFiles).toContain('data/progression/TheTuAn*')
    expect(theTuAnFiles).toContain('data/skill/TheTu*')
    expect(theTuAnFiles).toContain('data/buff/TheTu*')
  })
})
