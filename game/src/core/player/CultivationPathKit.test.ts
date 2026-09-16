import { describe, expect, it } from 'vitest'
import {
  CULTIVATION_PATH_MODULES,
  LEGACY_PATH_TO_WAY,
  getPathWayDefinition,
  isCultivationPathOffered,
  type CultivationPathId,
} from './CultivationPathKit'
import { getOfferableCultivationPaths } from './CultivationPathSystem'
import { createDefaultPlayer } from './Player'
import { CULTIVATION_PATH_STAT_DOMAINS, DOMAIN_SOURCE_WHITELIST } from '../stats/StatDomain'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'

// Cultivation Path Framework (spec 2026-09-16, M1) — the kit catalog
// evolved in place into the path/way module catalog. These tests pin
// the catalog contract: 3 base paths, way definitions carry the former
// kit fields, and the legacy 5-id -> (path, way) adapter resolves every
// union member until M7 deletes it.

const LEGACY_PATH_IDS: readonly CultivationPathId[] = [
  'phap_tu',
  'phap_tu_an',
  'kiem_tu',
  'the_tu',
  'the_tu_an',
]

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
      'phap_tu_an_linh_luc',
      'phap_tu_an_linh_luc_regen',
      'phap_tu_an_ho_the',
    ])
    expect(way?.offerGate).toEqual({ requiresSkillCastLevel: { skillId: 'linh_bao', level: 3 } })
  })

  it("the_tu hien keeps the kim_cang_bat_hoai_the technique and metal element", () => {
    const way = CULTIVATION_PATH_MODULES.the_tu.ways.hien

    expect(way?.techniqueId).toBe('kim_cang_bat_hoai_the')
    expect(way?.element).toBe('metal')
  })

  it('the_tu ung_the carries the an kit: ung_the_than_quyet, huy_quyen gate, the resource flag', () => {
    const way = CULTIVATION_PATH_MODULES.the_tu.ways.ung_the

    expect(way?.techniqueId).toBe('ung_the_than_quyet')
    expect(way?.offerGate).toEqual({ requiresSkillLevel: { skillId: 'huy_quyen', level: 3 } })
    expect(way?.usesTheResource).toBe(true)
  })
})

describe('LEGACY_PATH_TO_WAY — transition adapter (deleted in M7)', () => {
  it('covers every CultivationPathId union member, no extras', () => {
    expect(Object.keys(LEGACY_PATH_TO_WAY).sort()).toEqual([...LEGACY_PATH_IDS].sort())

    for (const pathId of LEGACY_PATH_IDS) {
      expect(LEGACY_PATH_TO_WAY[pathId], pathId).toBeDefined()
    }
  })

  it('maps each legacy id to its expected (path, way) pair', () => {
    expect(LEGACY_PATH_TO_WAY.kiem_tu).toEqual({ pathId: 'kiem_tu', wayId: 'hien' })
    expect(LEGACY_PATH_TO_WAY.phap_tu).toEqual({ pathId: 'phap_tu', wayId: 'ngu_hanh' })
    expect(LEGACY_PATH_TO_WAY.phap_tu_an).toEqual({ pathId: 'phap_tu', wayId: 'ngo_dao' })
    expect(LEGACY_PATH_TO_WAY.the_tu).toEqual({ pathId: 'the_tu', wayId: 'hien' })
    expect(LEGACY_PATH_TO_WAY.the_tu_an).toEqual({ pathId: 'the_tu', wayId: 'ung_the' })
  })

  it('every mapping resolves to a real way in the catalog', () => {
    for (const pathId of LEGACY_PATH_IDS) {
      const mapping = LEGACY_PATH_TO_WAY[pathId]
      const way = CULTIVATION_PATH_MODULES[mapping.pathId]?.ways[mapping.wayId]

      expect(way, pathId).toBeDefined()
      expect(way?.id).toBe(mapping.wayId)
      expect(way?.pathId).toBe(mapping.pathId)
    }
  })
})

describe('getPathWayDefinition', () => {
  it('returns the mapped way definition for all five legacy path ids', () => {
    expect(getPathWayDefinition('kiem_tu')?.id).toBe('hien')
    expect(getPathWayDefinition('phap_tu')?.id).toBe('ngu_hanh')
    expect(getPathWayDefinition('phap_tu_an')?.id).toBe('ngo_dao')
    expect(getPathWayDefinition('the_tu')?.id).toBe('hien')
    expect(getPathWayDefinition('the_tu_an')?.id).toBe('ung_the')
  })

  it('resolves the authored technique for each legacy id', () => {
    expect(getPathWayDefinition('kiem_tu')?.techniqueId).toBe('ngu_kiem')
    expect(getPathWayDefinition('phap_tu')?.techniqueId).toBe('dai_ngu_hanh_chan_quyet')
    expect(getPathWayDefinition('phap_tu_an')?.techniqueId).toBe('ngo_dao_chan_quyet')
    expect(getPathWayDefinition('the_tu')?.techniqueId).toBe('kim_cang_bat_hoai_the')
    expect(getPathWayDefinition('the_tu_an')?.techniqueId).toBe('ung_the_than_quyet')
  })

  it('returns undefined for an id outside the legacy union', () => {
    expect(getPathWayDefinition('not_a_path' as CultivationPathId)).toBeUndefined()
  })
})

describe('isCultivationPathOffered — way offer gates', () => {
  it('ungated ways are always offered', () => {
    const player = createDefaultPlayer()

    expect(isCultivationPathOffered(getPathWayDefinition('kiem_tu')!, player)).toBe(true)
    expect(isCultivationPathOffered(getPathWayDefinition('phap_tu')!, player)).toBe(true)
    expect(isCultivationPathOffered(getPathWayDefinition('the_tu')!, player)).toBe(true)
  })

  it('ung_the keeps the huy_quyen Lv3 requiresSkillLevel gate (skillLevels mirror)', () => {
    const way = getPathWayDefinition('the_tu_an')!

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
    const way = getPathWayDefinition('phap_tu_an')!
    const lv3Casts = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

    const below = createDefaultPlayer()
    below.skillCastCounts = { linh_bao: lv3Casts - 1 }
    expect(isCultivationPathOffered(way, below)).toBe(false)

    const met = createDefaultPlayer()
    met.skillCastCounts = { linh_bao: lv3Casts }
    expect(isCultivationPathOffered(way, met)).toBe(true)

    // Cast-count gate, not the skillLevels mirror: a Lv3 mirror with no
    // casts does NOT satisfy it (isPhapTuAnEligible parity).
    const levelsOnly = createDefaultPlayer()
    levelsOnly.skillLevels = { linh_bao: 3 }
    levelsOnly.skillCastCounts = {}
    expect(isCultivationPathOffered(way, levelsOnly)).toBe(false)
  })

  it('the ngu way gate evaluates tram Lv3 even though nothing offers it yet', () => {
    const ngu = CULTIVATION_PATH_MODULES.kiem_tu.ways.ngu!

    const below = createDefaultPlayer()
    below.skillLevels = { tram: 2 }
    expect(isCultivationPathOffered(ngu, below)).toBe(false)

    const met = createDefaultPlayer()
    met.skillLevels = { tram: 3 }
    expect(isCultivationPathOffered(ngu, met)).toBe(true)
  })
})

describe('getOfferableCultivationPaths — transition offers (unchanged signature/results)', () => {
  it('returns the base trio plus gated _an ids in legacy order; ngu is never an offer', () => {
    const player = createDefaultPlayer()
    player.skillLevels = { huy_quyen: 3, tram: 3 }
    player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }

    const offered = getOfferableCultivationPaths(player)

    expect(offered).toEqual(['phap_tu', 'kiem_tu', 'the_tu', 'phap_tu_an', 'the_tu_an'])
    // 'ngu' is a way id inside the kiem_tu module — it can never appear
    // as a legacy offer id (R2: not offerable until M6).
    expect(offered).not.toContain('ngu')
  })

  it('with no gates met only the base trio is offered', () => {
    const player = createDefaultPlayer()

    expect(getOfferableCultivationPaths(player)).toEqual(['phap_tu', 'kiem_tu', 'the_tu'])
  })

  it('phap_tu_an follows the linh_bao cast threshold exactly', () => {
    const player = createDefaultPlayer()
    player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 - 1 }
    expect(getOfferableCultivationPaths(player)).not.toContain('phap_tu_an')

    player.skillCastCounts.linh_bao = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3
    expect(getOfferableCultivationPaths(player)).toContain('phap_tu_an')
  })

  it('the_tu_an follows the huy_quyen Lv3 mirror exactly', () => {
    const player = createDefaultPlayer()
    player.skillLevels = { huy_quyen: 2 }
    expect(getOfferableCultivationPaths(player)).not.toContain('the_tu_an')

    player.skillLevels.huy_quyen = 3
    expect(getOfferableCultivationPaths(player)).toContain('the_tu_an')
  })
})

describe('stat domains — the_tu_an', () => {
  it("CULTIVATION_PATH_STAT_DOMAINS maps the_tu_an to its own domain", () => {
    expect(CULTIVATION_PATH_STAT_DOMAINS['the_tu_an']).toEqual(['the_tu_an'])
    expect(CULTIVATION_PATH_STAT_DOMAINS['the_tu']).toEqual(['the_tu'])
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
