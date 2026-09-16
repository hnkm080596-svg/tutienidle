import { describe, expect, it } from 'vitest'
import { calculateEffectiveStats, type StatModifier } from '../stats/StatCalculator'
import type { StatDomain } from '../stats/StatDomain'
import { createDefaultPlayer, resolvePlayerFinalStats } from './Player'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import type { CultivationPathId, PathWayId } from './CultivationPathKit'
// Importing the path system registers its phap_tu delta deriver with the
// stats module (D12 contract) — the registration itself is under test.
import {
  applyPathChoice,
  getActivePath,
  getActiveWay,
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
    player.cultivationWay = 'ngu_hanh'
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
    player.cultivationWay = 'ngu_hanh'
    player.baseStats.attunement = 5

    const stats = resolvePlayerFinalStats(player, [attunementBuff(5)])

    expect(stats.maxMp).toBeCloseTo(10 * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT, 6)
  })

  it('INV-10: a mid-battle attunement delta emits the gated MP delta exactly once', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'
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
    player.cultivationWay = 'hien'
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
    player.cultivationWay = 'ngu_hanh'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)])

    expect(effective.maxMp).toBe(resolved.maxMp)
    expect(effective.manaRegenPerTurn).toBe(resolved.manaRegenPerTurn)
  })

  it('a non-attunement delta emits no MP delta', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'
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
  it('returns all six offerable pairs: 3 ungated ways + the 3 gated ways', () => {
    const player = mortalPlayer()

    expect(listOfferableWays(player).map(offerId)).toEqual([
      'phap_tu/ngu_hanh',
      'kiem_tu/hien',
      'the_tu/hien',
      'phap_tu/ngo_dao',
      'kiem_tu/ngu',
      'the_tu/ung_the',
    ])
  })

  it('kiem_tu/ngu is listed and becomes eligible at tram Lv3 (M6: ritual-only way)', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 2 }

    const at = (p: typeof player) =>
      listOfferableWays(p).find((offer) => offer.wayId === 'ngu')?.eligible

    expect(at(player)).toBe(false)

    player.skillLevels.tram = 3
    expect(at(player)).toBe(true)
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

  it('all six ways flag eligible once every gate is met', () => {
    const player = mortalPlayer()
    player.skillCastCounts = { linh_bao: LINH_BAO_L3 }
    player.skillLevels = { huy_quyen: 3, tram: 3 }

    expect(listOfferableWays(player).every((offer) => offer.eligible)).toBe(true)
  })
})

describe('applyPathChoice — the sole path/way write authority', () => {
  it('rejects an unknown path id with zero mutation', () => {
    const player = mortalPlayer()

    const result = applyPathChoice(player, 'khong_ton_tai' as CultivationPathId, 'hien')

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

  it('rejects kiem_tu/ngu below tram Lv3 — the offerGate runs inside the authority', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 2 }

    const result = applyPathChoice(player, 'kiem_tu', 'ngu')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.kiemTu).toBeUndefined()
  })

  it('accepts kiem_tu/ngu at tram Lv3 — writes the BASE kiem_tu id + the way', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 3 }

    expect(applyPathChoice(player, 'kiem_tu', 'ngu').ok).toBe(true)
    expect(player.cultivationPath).toBe('kiem_tu')
    expect(player.cultivationWay).toBe('ngu')
    expect(player.kiemTu).toEqual(freshKiemTuState())
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
    ['kiem_tu', 'hien'],
    ['phap_tu', 'ngu_hanh'],
    ['the_tu', 'hien'],
  ] as const)(
    '(%s, %s) writes cultivationWay + the BASE cultivationPath id',
    (pathId, wayId) => {
      const player = mortalPlayer()

      expect(applyPathChoice(player, pathId, wayId)).toEqual({ ok: true })
      expect(player.cultivationWay).toBe(wayId)
      // M7 — the base path id persists directly; the legacy-id adapter
      // is gone.
      expect(player.cultivationPath).toBe(pathId)
    },
  )

  it.each([
    ['phap_tu', 'ngo_dao', { skillCastCounts: { linh_bao: LINH_BAO_L3 } }],
    ['the_tu', 'ung_the', { skillLevels: { huy_quyen: 3 } }],
  ] as const)(
    '(%s, %s) writes the BASE id + way once its gate is met — hidden ways are ways, not path ids',
    (pathId, wayId, mirrors) => {
      const player = mortalPlayer()
      Object.assign(player, mirrors)

      expect(applyPathChoice(player, pathId, wayId)).toEqual({ ok: true })
      expect(player.cultivationWay).toBe(wayId)
      expect(player.cultivationPath).toBe(pathId)
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

describe('getActivePath / getActiveWay — strict persisted-pair reads', () => {
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

  it('a way-less save is corrupt — both reads resolve nothing', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'

    expect(getActivePath(player)).toBeUndefined()
    expect(getActiveWay(player)).toBeUndefined()
  })

  it('a (path, way) pair the catalog does not own resolves nothing', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ung_the'

    expect(getActivePath(player)).toBeUndefined()
    expect(getActiveWay(player)).toBeUndefined()
  })
})
