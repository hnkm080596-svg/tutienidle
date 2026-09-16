import { describe, expect, it } from 'vitest'
import { calculateEffectiveStats, type StatModifier } from '../stats/StatCalculator'
import type { StatDomain } from '../stats/StatDomain'
import { createDefaultPlayer, resolvePlayerFinalStats } from './Player'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import type { CultivationPathBaseId, PathWayId } from './CultivationPathKit'
// Importing the path system registers its phap_tu delta deriver with the
// stats module (D12 contract) — the registration itself is under test.
import {
  applyPathChoice,
  getActivePath,
  getActiveWay,
  getOfferableCultivationPaths,
  isPhapTuAnEligible,
  listOfferableWays,
  PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT,
  PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
} from './CultivationPathSystem'

// Task 7 (D12/D19, INV-10): attunement feeds MP ONLY through the phap_tu
// domain gate — emitted once at assembly from resolved attribute totals,
// and re-emitted as a gated delta by the registered deltaDeriver when
// attunement moves mid-battle.

const PHAP_TU_DOMAINS: ReadonlySet<StatDomain> = new Set<StatDomain>(['phap_tu'])

function attunementBuff(flat: number): StatModifier {
  return {
    id: `test:attunement:${flat}`,
    sourceId: 'test',
    sourceType: 'buff',
    stat: 'attunement',
    flat,
  }
}

describe('phap_tu attunement -> MP emission (D12)', () => {
  it('assembly: a phap_tu player gains MP from attunement through the gate', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 10

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.maxMp).toBeCloseTo(10 * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT, 6)
    expect(stats.manaRegenPerTurn).toBeCloseTo(10 * PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT, 6)
  })

  it('assembly: a non-phap_tu player gets no MP from attunement', () => {
    const player = createDefaultPlayer()
    player.baseStats.attunement = 10

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.maxMp).toBe(0)
    expect(stats.manaRegenPerTurn).toBe(0)
  })

  it('assembly: modifier-driven attunement counts toward the MP emission', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 5

    const stats = resolvePlayerFinalStats(player, [attunementBuff(5)])

    expect(stats.maxMp).toBeCloseTo(10 * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT, 6)
  })

  it('INV-10: a mid-battle attunement delta emits the gated MP delta exactly once', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    // The entity owns phap_tu — declared via the effective-stat context
    // (mid-battle derivers only run for domains the entity carries).
    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)], {
      activeDomains: PHAP_TU_DOMAINS,
    })

    // Base 10 already contributed at assembly; the delta pass must add
    // ONLY the +5 delta's share — 15 x rate total, not 25 x rate.
    expect(effective.attunement).toBe(15)
    expect(effective.maxMp).toBeCloseTo(15 * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT, 6)
    expect(effective.manaRegenPerTurn).toBeCloseTo(15 * PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT, 6)
  })

  it('mid-battle: a NON-phap_tu entity with an attunement delta gains no MP', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    // Kiem Tu never owns phap_tu — the domain deltaDeriver must not run
    // for this entity even though it is globally registered.
    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)], {
      activeDomains: new Set<StatDomain>(['kiem_tu']),
    })

    expect(effective.attunement).toBe(15)
    expect(effective.maxMp).toBe(0)
    expect(effective.manaRegenPerTurn).toBe(0)
  })

  it('mid-battle: no declared domains -> no domain deriver runs at all', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)])

    expect(effective.maxMp).toBe(resolved.maxMp)
    expect(effective.manaRegenPerTurn).toBe(resolved.manaRegenPerTurn)
  })

  it('a non-attunement delta emits no MP delta', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(resolved, [
      { id: 'test:str', sourceId: 'test', sourceType: 'buff', stat: 'strength', flat: 5 },
    ], { activeDomains: PHAP_TU_DOMAINS })

    expect(effective.maxMp).toBe(resolved.maxMp)
    expect(effective.manaRegenPerTurn).toBe(resolved.manaRegenPerTurn)
  })
})

// ---------------------------------------------------------------------------
// Cultivation Path Framework M2 — the path/way authority. The Initiation
// Ritual's offer list and path/way writes both flow through here.
// ---------------------------------------------------------------------------

const LINH_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

function offerId(offer: { pathId: string; wayId: string }): string {
  return `${offer.pathId}/${offer.wayId}`
}

function mortalPlayer() {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  return player
}

describe('listOfferableWays — (path, way) offer authority', () => {
  it('returns all five offerable pairs: 3 base ways + the 2 gated hidden ways', () => {
    const player = mortalPlayer()

    expect(listOfferableWays(player).map(offerId)).toEqual([
      'phap_tu/ngu_hanh',
      'kiem_tu/hien',
      'the_tu/hien',
      'phap_tu/ngo_dao',
      'the_tu/ung_the',
    ])
  })

  it('kiem_tu/ngu is absent entirely — even at tram Lv9 (filtered until M6)', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 9 }
    player.skillCastCounts = { tram: 999_999 }

    const offers = listOfferableWays(player)

    expect(offers.map(offerId)).not.toContain('kiem_tu/ngu')
    expect(offers).toHaveLength(5)
  })

  it('base ways are always eligible; gated ways flag ineligible with a reason below their gate', () => {
    const player = mortalPlayer()

    const offers = listOfferableWays(player)
    const byId = new Map(offers.map((offer) => [offerId(offer), offer]))

    expect(byId.get('phap_tu/ngu_hanh')?.eligible).toBe(true)
    expect(byId.get('kiem_tu/hien')?.eligible).toBe(true)
    expect(byId.get('the_tu/hien')?.eligible).toBe(true)

    expect(byId.get('phap_tu/ngo_dao')?.eligible).toBe(false)
    expect(byId.get('phap_tu/ngo_dao')?.reason).toBeTruthy()
    expect(byId.get('the_tu/ung_the')?.eligible).toBe(false)
    expect(byId.get('the_tu/ung_the')?.reason).toBeTruthy()
  })

  it('ngo_dao becomes eligible exactly at linh_bao cast Lv3', () => {
    const player = mortalPlayer()
    player.skillCastCounts = { linh_bao: LINH_BAO_L3 - 1 }

    const at = (p: typeof player) =>
      listOfferableWays(p).find((offer) => offer.wayId === 'ngo_dao')?.eligible

    expect(at(player)).toBe(false)

    player.skillCastCounts.linh_bao = LINH_BAO_L3
    expect(at(player)).toBe(true)
  })

  it('ung_the becomes eligible exactly at huy_quyen Lv3 (skillLevels mirror)', () => {
    const player = mortalPlayer()
    player.skillLevels = { huy_quyen: 2 }

    const at = (p: typeof player) =>
      listOfferableWays(p).find((offer) => offer.wayId === 'ung_the')?.eligible

    expect(at(player)).toBe(false)

    player.skillLevels.huy_quyen = 3
    expect(at(player)).toBe(true)
  })

  it('legacy delegate getOfferableCultivationPaths returns the eligible legacy ids', () => {
    const player = mortalPlayer()
    player.skillCastCounts = { linh_bao: LINH_BAO_L3 }
    player.skillLevels = { huy_quyen: 3 }

    expect(getOfferableCultivationPaths(player)).toEqual([
      'phap_tu',
      'kiem_tu',
      'the_tu',
      'phap_tu_an',
      'the_tu_an',
    ])
  })

  it('isPhapTuAnEligible delegate tracks the ngo_dao offer flag', () => {
    const player = mortalPlayer()

    expect(isPhapTuAnEligible(player)).toBe(false)

    player.skillCastCounts = { linh_bao: LINH_BAO_L3 }
    expect(isPhapTuAnEligible(player)).toBe(true)
  })
})

describe('applyPathChoice — the sole path/way write authority', () => {
  it('rejects an unknown path id with zero mutation', () => {
    const player = mortalPlayer()

    const result = applyPathChoice(player, 'khong_ton_tai' as CultivationPathBaseId, 'hien')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.kiemTu).toBeUndefined()
  })

  it('rejects an unknown way id with zero mutation', () => {
    const player = mortalPlayer()

    const result = applyPathChoice(player, 'phap_tu', 'khong_ton_tai' as PathWayId)

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
  })

  it('rejects a way id that belongs to a different path', () => {
    const player = mortalPlayer()

    // 'hien' is a real way — of kiem_tu and the_tu, not phap_tu.
    const result = applyPathChoice(player, 'phap_tu', 'hien')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
  })

  it('rejects an offerable-but-gated way the player has not unlocked — zero mutation', () => {
    const player = mortalPlayer()
    player.skillCastCounts = { linh_bao: LINH_BAO_L3 - 1 }

    const result = applyPathChoice(player, 'phap_tu', 'ngo_dao')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
  })

  it('rejects kiem_tu/ngu even at tram Lv9 — the way is not offerable until M6', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 9 }
    player.skillCastCounts = { tram: 999_999 }

    const result = applyPathChoice(player, 'kiem_tu', 'ngu')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.kiemTu).toBeUndefined()
  })

  it('rejects a second choice once a path is committed', () => {
    const player = mortalPlayer()

    expect(applyPathChoice(player, 'kiem_tu', 'hien').ok).toBe(true)

    const result = applyPathChoice(player, 'the_tu', 'hien')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBe('kiem_tu')
    expect(player.cultivationWay).toBe('hien')
  })

  it.each([
    ['kiem_tu', 'hien', 'kiem_tu'],
    ['phap_tu', 'ngu_hanh', 'phap_tu'],
    ['the_tu', 'hien', 'the_tu'],
  ] as const)(
    '(%s, %s) writes cultivationWay + the legacy-effective cultivationPath %s',
    (pathId, wayId, expectedLegacyPath) => {
      const player = mortalPlayer()

      expect(applyPathChoice(player, pathId, wayId)).toEqual({ ok: true })
      expect(player.cultivationWay).toBe(wayId)
      // M7 deletion adapter — unmigrated consumers keep reading the
      // legacy id for the chosen pair.
      expect(player.cultivationPath).toBe(expectedLegacyPath)
    },
  )

  it.each([
    ['phap_tu', 'ngo_dao', 'phap_tu_an', { skillCastCounts: { linh_bao: LINH_BAO_L3 } }],
    ['the_tu', 'ung_the', 'the_tu_an', { skillLevels: { huy_quyen: 3 } }],
  ] as const)(
    '(%s, %s) writes cultivationWay + legacy id %s once its gate is met',
    (pathId, wayId, expectedLegacyPath, mirrors) => {
      const player = mortalPlayer()
      Object.assign(player, mirrors)

      expect(applyPathChoice(player, pathId, wayId)).toEqual({ ok: true })
      expect(player.cultivationWay).toBe(wayId)
      expect(player.cultivationPath).toBe(expectedLegacyPath)
    },
  )

  it('kiem_tu commits the canonical fresh hien slice (way-slice lifecycle owned here)', () => {
    const player = mortalPlayer()

    expect(applyPathChoice(player, 'kiem_tu', 'hien').ok).toBe(true)
    expect(player.kiemTu).toEqual(freshKiemTuState())
  })

  it('non-kiem paths create no kiemTu slice', () => {
    const player = mortalPlayer()

    expect(applyPathChoice(player, 'phap_tu', 'ngu_hanh').ok).toBe(true)
    expect(player.kiemTu).toBeUndefined()
  })
})

describe('getActivePath / getActiveWay — reads through the transition', () => {
  it('returns undefined for a player with no choice', () => {
    const player = mortalPlayer()

    expect(getActivePath(player)).toBeUndefined()
    expect(getActiveWay(player)).toBeUndefined()
  })

  it('reads the committed pair after applyPathChoice', () => {
    const player = mortalPlayer()
    applyPathChoice(player, 'the_tu', 'hien')

    expect(getActivePath(player)).toBe('the_tu')
    expect(getActiveWay(player)).toBe('hien')
  })

  it('derives the way for a legacy-shaped player (cultivationPath only)', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu_an'

    expect(getActivePath(player)).toBe('phap_tu')
    expect(getActiveWay(player)).toBe('ngo_dao')
  })

  it('cultivationWay is authoritative once written', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu_an'
    player.cultivationWay = 'ngo_dao'

    expect(getActiveWay(player)).toBe('ngo_dao')
  })
})
