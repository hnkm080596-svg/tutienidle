import { describe, expect, it } from 'vitest'
import { calculateEffectiveStats, type StatModifier } from '../stats/StatCalculator'
import type { StatDomain } from '../stats/StatDomain'
import { createDefaultPlayer, resolvePlayerFinalStats } from './Player'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import type { CultivationPathId, PathCapabilityDeps, PathWayId } from './CultivationPathKit'
// Importing the path system registers its phap_tu delta deriver with the
// stats module (D12 contract) — the registration itself is under test.
import {
  applyPathChoice,
  getActivePath,
  getActiveWay,
  getActiveElement,
  getActiveRoute,
  getKiemTuPreset,
  hasPathCapability,
  hasStaticPathCapability,
  isActivePath,
  isActiveWay,
  listOfferableWays,
  PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT,
  PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
  resolvePathCapabilities,
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

// ---------------------------------------------------------------------------
// P1 - Canonical Path Authority (spec 2026-09-20 section P1): capability resolution.
// The capability layer is DERIVED - the committed (path, way) pair plus the
// owning slice/skill/node state; it never mutates and never owns state.
// ---------------------------------------------------------------------------

const NO_DEPS: PathCapabilityDeps = { hasSkill: () => false }

describe('resolvePathCapabilities / hasPathCapability - P1 capability authority', () => {
  it('a mortal player resolves no capabilities', () => {
    expect(resolvePathCapabilities(mortalPlayer(), NO_DEPS).size).toBe(0)
  })

  it.each([
    ['kiem_tu', 'hien', ['kiem_tu.kiem_pho']],
    ['kiem_tu', 'ngu', ['kiem_tu.ngu_kiem_dao']],
    ['phap_tu', 'ngu_hanh', ['phap_tu.elemental_casting', 'phap_tu.the_pool']],
    ['phap_tu', 'ngo_dao', []],
    ['the_tu', 'hien', []],
    ['the_tu', 'ung_the', ['the_tu.the_economy']],
  ] as const)('(%s, %s) resolves exactly the declared static set: %j', (pathId, wayId, expected) => {
    const player = mortalPlayer()
    player.cultivationPath = pathId
    player.cultivationWay = wayId

    expect([...resolvePathCapabilities(player, NO_DEPS)].sort()).toEqual([...expected].sort())
    for (const cap of expected) {
      expect(hasPathCapability(player, cap, NO_DEPS)).toBe(true)
    }
  })

  it('a capability owned by a different way never leaks through', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'hien'

    expect(hasPathCapability(player, 'kiem_tu.ngu_kiem_dao', NO_DEPS)).toBe(false)
    expect(hasPathCapability(player, 'the_tu.the_economy', NO_DEPS)).toBe(false)
    expect(hasPathCapability(player, 'phap_tu.elemental_casting', NO_DEPS)).toBe(false)
  })

  it('a way-less or mismatched pair resolves nothing - fail closed', () => {
    const wayLess = mortalPlayer()
    wayLess.cultivationPath = 'kiem_tu'

    expect(resolvePathCapabilities(wayLess, NO_DEPS).size).toBe(0)

    const mismatched = mortalPlayer()
    mismatched.cultivationPath = 'phap_tu'
    mismatched.cultivationWay = 'ung_the'

    expect(resolvePathCapabilities(mismatched, NO_DEPS).size).toBe(0)
  })

  it('phap_tu.reaction_aura requires the learned ngo_dao_hon_don passive - deps.hasSkill is the seam', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngo_dao'

    expect(hasPathCapability(player, 'phap_tu.reaction_aura', NO_DEPS)).toBe(false)
    expect(
      hasPathCapability(player, 'phap_tu.reaction_aura', {
        hasSkill: (id) => id === 'ngo_dao_hon_don',
      }),
    ).toBe(true)
  })

  it('phap_tu.reaction_aura stays false on ngu_hanh even with the passive learned', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'

    expect(
      hasPathCapability(player, 'phap_tu.reaction_aura', { hasSkill: () => true }),
    ).toBe(false)
  })

  it('phap_tu.empowered_ult requires the linh_ngo node of the COMMITTED element', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'
    player.phapTu.element = 'fire'

    expect(hasPathCapability(player, 'phap_tu.empowered_ult', NO_DEPS)).toBe(false)

    // A linh_ngo node for a different element does not empower fire's ult.
    player.nodeLevels = { linh_ngo_bat_thu_can_quet: 1 }
    expect(hasPathCapability(player, 'phap_tu.empowered_ult', NO_DEPS)).toBe(false)

    player.nodeLevels = { linh_ngo_tat_phuong_giang_the: 1 }
    expect(hasPathCapability(player, 'phap_tu.empowered_ult', NO_DEPS)).toBe(true)
  })

  it('empowered_ult stays false with no committed element', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'
    player.nodeLevels = { linh_ngo_tat_phuong_giang_the: 1 }

    expect(hasPathCapability(player, 'phap_tu.empowered_ult', NO_DEPS)).toBe(false)
  })

  it('hasStaticPathCapability answers from the declared static list only - conditional caps return false', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngo_dao'

    // reaction_aura is conditional: the static read cannot prove it, so it
    // fails closed rather than lying.
    expect(hasStaticPathCapability(player, 'phap_tu.reaction_aura')).toBe(false)

    player.cultivationWay = 'ngu_hanh'
    expect(hasStaticPathCapability(player, 'phap_tu.elemental_casting')).toBe(true)
    expect(hasStaticPathCapability(player, 'phap_tu.empowered_ult')).toBe(false)
    expect(hasStaticPathCapability(player, 'kiem_tu.kiem_pho')).toBe(false)
  })
})

describe('isActivePath / isActiveWay - generic identity reads (P1)', () => {
  it('resolve through the catalog and fail closed on a corrupt pair', () => {
    const player = mortalPlayer()

    expect(isActivePath(player, 'kiem_tu')).toBe(false)
    expect(isActiveWay(player, 'hien')).toBe(false)

    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'hien'

    expect(isActivePath(player, 'kiem_tu')).toBe(true)
    expect(isActivePath(player, 'phap_tu')).toBe(false)
    expect(isActiveWay(player, 'hien')).toBe(true)
    expect(isActiveWay(player, 'ngu')).toBe(false)

    // A way id the kiem_tu module does not own corrupts the pair.
    player.cultivationWay = 'ngo_dao'
    expect(isActivePath(player, 'kiem_tu')).toBe(false)
    expect(isActiveWay(player, 'ngo_dao')).toBe(false)
  })
})

describe('canonical subpath reads (P1-M3) - module-owned axes, capability-gated', () => {
  it('getActiveElement resolves only under an elemental_casting way', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'

    expect(getActiveElement(player)).toBeUndefined()

    player.phapTu.element = 'water'
    expect(getActiveElement(player)).toBe('water')

    // ngo_dao owns no element axis even if stale slice data lingers.
    player.cultivationWay = 'ngo_dao'
    expect(getActiveElement(player)).toBeUndefined()
  })

  it('getActiveElement fails closed on a corrupt pair', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu' // way-less
    player.phapTu.element = 'fire'

    expect(getActiveElement(player)).toBeUndefined()
  })

  it('getActiveRoute resolves only under ngu_hanh', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'

    expect(getActiveRoute(player)).toBeUndefined()

    player.phapTu.route = 'dot'
    expect(getActiveRoute(player)).toBe('dot')

    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'hien'
    expect(getActiveRoute(player)).toBeUndefined()
  })

  it('getKiemTuPreset resolves the hien preset slice, defensive copy', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'hien'

    expect(getKiemTuPreset(player)).toBeUndefined()

    player.kiemTu = freshKiemTuState()
    player.kiemTu.preset = ['orb_dam', 'orb_chem']

    const preset = getKiemTuPreset(player)
    expect(preset).toEqual(['orb_dam', 'orb_chem'])

    // ngu owns no preset axis - the slice may exist but the read is empty.
    player.cultivationWay = 'ngu'
    expect(getKiemTuPreset(player)).toBeUndefined()
  })

  it('narrow presentation slices satisfy the read shapes', () => {
    // TheBarPlayerState shape: pair + phapTu + nodeLevels, no kiemTu.
    const bridgeState = {
      cultivationPath: 'phap_tu' as const,
      cultivationWay: 'ngu_hanh' as const,
      phapTu: { element: 'fire' as const, route: 'no' as const },
      nodeLevels: {},
    }

    expect(getActiveElement(bridgeState)).toBe('fire')
    expect(getActiveRoute(bridgeState)).toBe('no')
    expect(hasStaticPathCapability(bridgeState, 'phap_tu.elemental_casting')).toBe(true)
  })
})
