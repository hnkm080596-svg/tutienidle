import { describe, expect, it } from 'vitest'
import { calculateEffectiveStats, type StatModifier } from '../stats/StatCalculator'
import type { StatDomain } from '../stats/StatDomain'
import { createDefaultPlayer, resolvePlayerFinalStats } from './Player'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import type { CultivationPathId, PathCapabilityDeps, CultivationWayId } from './CultivationPathKit'
// Importing the path system registers its spell delta deriver with the
// stats module (D12 contract) — the registration itself is under test.
import {
  applyPathChoice,
  getActivePath,
  getActiveWay,
  getActiveElement,
  getActiveRoute,
  getSwordScrollPreset,
  hasPathCapability,
  hasStaticPathCapability,
  isActivePath,
  isActiveWay,
  listOfferableWays,
  SPELL_ATTUNEMENT_MANA_REGEN_PER_POINT,
  SPELL_ATTUNEMENT_MAX_MP_PER_POINT,
  resolvePathCapabilities,
} from './CultivationPathSystem'

// Task 7 (D12/D19, INV-10): attunement feeds MP ONLY through the spell
// domain gate — emitted once at assembly from resolved attribute totals,
// and re-emitted as a gated delta by the registered deltaDeriver when
// attunement moves mid-battle.

const PHAP_TU_DOMAINS: ReadonlySet<StatDomain> = new Set<StatDomain>(['spell'])

function attunementBuff(flat: number): StatModifier {
  return {
    id: `test:attunement:${flat}`,
    sourceId: 'test',
    sourceType: 'buff',
    stat: 'attunement',
    flat,
  }
}

describe('spell attunement -> MP emission (D12)', () => {
  it('assembly: a spell player gains MP from attunement through the gate', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.baseStats.attunement = 10

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.maxMp).toBeCloseTo(10 * SPELL_ATTUNEMENT_MAX_MP_PER_POINT, 6)
    expect(stats.manaRegenPerTurn).toBeCloseTo(10 * SPELL_ATTUNEMENT_MANA_REGEN_PER_POINT, 6)
  })

  it('assembly: a non-spell player gets no MP from attunement', () => {
    const player = createDefaultPlayer()
    player.baseStats.attunement = 10

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.maxMp).toBe(0)
    expect(stats.manaRegenPerTurn).toBe(0)
  })

  it('assembly: modifier-driven attunement counts toward the MP emission', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.baseStats.attunement = 5

    const stats = resolvePlayerFinalStats(player, [attunementBuff(5)])

    expect(stats.maxMp).toBeCloseTo(10 * SPELL_ATTUNEMENT_MAX_MP_PER_POINT, 6)
  })

  it('INV-10: a mid-battle attunement delta emits the gated MP delta exactly once', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    // The entity owns spell — declared via the effective-stat context
    // (mid-battle derivers only run for domains the entity carries).
    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)], {
      activeDomains: PHAP_TU_DOMAINS,
    })

    // Base 10 already contributed at assembly; the delta pass must add
    // ONLY the +5 delta's share — 15 x rate total, not 25 x rate.
    expect(effective.attunement).toBe(15)
    expect(effective.maxMp).toBeCloseTo(15 * SPELL_ATTUNEMENT_MAX_MP_PER_POINT, 6)
    expect(effective.manaRegenPerTurn).toBeCloseTo(15 * SPELL_ATTUNEMENT_MANA_REGEN_PER_POINT, 6)
  })

  it('mid-battle: a NON-spell entity with an attunement delta gains no MP', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    // Kiem Tu never owns spell — the domain deltaDeriver must not run
    // for this entity even though it is globally registered.
    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)], {
      activeDomains: new Set<StatDomain>(['sword']),
    })

    expect(effective.attunement).toBe(15)
    expect(effective.maxMp).toBe(0)
    expect(effective.manaRegenPerTurn).toBe(0)
  })

  it('mid-battle: no declared domains -> no domain deriver runs at all', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)])

    expect(effective.maxMp).toBe(resolved.maxMp)
    expect(effective.manaRegenPerTurn).toBe(resolved.manaRegenPerTurn)
  })

  it('a non-attunement delta emits no MP delta', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
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
      'spell/spell_pathway',
      'sword/sword_pathway',
      'body/body_pathway',
      'spell/hidden_spell_pathway',
      'sword/hidden_sword_pathway',
      'body/hidden_body_pathway',
    ])
  })

  it('sword/hidden_sword_pathway is listed and becomes eligible at tram Lv3 (M6: ritual-only way)', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 2 }

    const at = (p: typeof player) =>
      listOfferableWays(p).find((offer) => offer.wayId === 'hidden_sword_pathway')?.eligible

    expect(at(player)).toBe(false)

    player.skillLevels.tram = 3
    expect(at(player)).toBe(true)
  })

  it('base ways are always eligible; gated ways flag ineligible with a reason below their gate', () => {
    const player = mortalPlayer()

    const offers = listOfferableWays(player)
    const byId = new Map(offers.map((offer) => [offerId(offer), offer]))

    expect(byId.get('spell/spell_pathway')?.eligible).toBe(true)
    expect(byId.get('sword/sword_pathway')?.eligible).toBe(true)
    expect(byId.get('body/body_pathway')?.eligible).toBe(true)

    expect(byId.get('spell/hidden_spell_pathway')?.eligible).toBe(false)
    expect(byId.get('spell/hidden_spell_pathway')?.reason).toBeTruthy()
    expect(byId.get('body/hidden_body_pathway')?.eligible).toBe(false)
    expect(byId.get('body/hidden_body_pathway')?.reason).toBeTruthy()
  })

  it('hidden_spell_pathway becomes eligible exactly at linh_bao cast Lv3', () => {
    const player = mortalPlayer()
    player.skillCastCounts = { linh_bao: LINH_BAO_L3 - 1 }

    const at = (p: typeof player) =>
      listOfferableWays(p).find((offer) => offer.wayId === 'hidden_spell_pathway')?.eligible

    expect(at(player)).toBe(false)

    player.skillCastCounts.linh_bao = LINH_BAO_L3
    expect(at(player)).toBe(true)
  })

  it('hidden_body_pathway becomes eligible exactly at huy_quyen Lv3 (skillLevels mirror)', () => {
    const player = mortalPlayer()
    player.skillLevels = { huy_quyen: 2 }

    const at = (p: typeof player) =>
      listOfferableWays(p).find((offer) => offer.wayId === 'hidden_body_pathway')?.eligible

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

    const result = applyPathChoice(player, 'khong_ton_tai' as CultivationPathId, 'sword_pathway')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.swordPath).toBeUndefined()
  })

  it('rejects an unknown way id with zero mutation', () => {
    const player = mortalPlayer()

    const result = applyPathChoice(player, 'spell', 'khong_ton_tai' as CultivationWayId)

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
  })

  it('rejects a way id that belongs to a different path', () => {
    const player = mortalPlayer()

    // 'sword_pathway' is a real way — of sword and body, not spell.
    const result = applyPathChoice(player, 'spell', 'sword_pathway')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
  })

  it('rejects an offerable-but-gated way the player has not unlocked — zero mutation', () => {
    const player = mortalPlayer()
    player.skillCastCounts = { linh_bao: LINH_BAO_L3 - 1 }

    const result = applyPathChoice(player, 'spell', 'hidden_spell_pathway')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
  })

  it('rejects sword/hidden_sword_pathway below tram Lv3 — the offerGate runs inside the authority', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 2 }

    const result = applyPathChoice(player, 'sword', 'hidden_sword_pathway')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.swordPath).toBeUndefined()
  })

  it('accepts sword/hidden_sword_pathway at tram Lv3 — writes the BASE sword id + the way', () => {
    const player = mortalPlayer()
    player.skillLevels = { tram: 3 }

    expect(applyPathChoice(player, 'sword', 'hidden_sword_pathway').ok).toBe(true)
    expect(player.cultivationPath).toBe('sword')
    expect(player.cultivationWay).toBe('hidden_sword_pathway')
    expect(player.swordPath).toEqual(freshSwordPathState())
  })

  it('rejects a second choice once a path is committed', () => {
    const player = mortalPlayer()

    expect(applyPathChoice(player, 'sword', 'sword_pathway').ok).toBe(true)

    const result = applyPathChoice(player, 'body', 'body_pathway')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBe('sword')
    expect(player.cultivationWay).toBe('sword_pathway')
  })

  it.each([
    ['sword', 'sword_pathway'],
    ['spell', 'spell_pathway'],
    ['body', 'body_pathway'],
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
    ['spell', 'hidden_spell_pathway', { skillCastCounts: { linh_bao: LINH_BAO_L3 } }],
    ['body', 'hidden_body_pathway', { skillLevels: { huy_quyen: 3 } }],
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

  it('sword commits the canonical fresh sword_pathway slice (way-slice lifecycle owned here)', () => {
    const player = mortalPlayer()

    expect(applyPathChoice(player, 'sword', 'sword_pathway').ok).toBe(true)
    expect(player.swordPath).toEqual(freshSwordPathState())
  })

  it('non-kiem paths create no swordPath slice', () => {
    const player = mortalPlayer()

    expect(applyPathChoice(player, 'spell', 'spell_pathway').ok).toBe(true)
    expect(player.swordPath).toBeUndefined()
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
    applyPathChoice(player, 'body', 'body_pathway')

    expect(getActivePath(player)).toBe('body')
    expect(getActiveWay(player)).toBe('body_pathway')
  })

  it('a way-less save is corrupt — both reads resolve nothing', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'

    expect(getActivePath(player)).toBeUndefined()
    expect(getActiveWay(player)).toBeUndefined()
  })

  it('a (path, way) pair the catalog does not own resolves nothing', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_body_pathway'

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
    ['sword', 'sword_pathway', ['sword.sword_scroll']],
    ['sword', 'hidden_sword_pathway', ['sword.sword_riding']],
    ['spell', 'spell_pathway', ['spell.elemental_casting', 'spell.essence_pool']],
    ['spell', 'hidden_spell_pathway', []],
    ['body', 'body_pathway', []],
    ['body', 'hidden_body_pathway', ['body.essence_economy']],
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
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'

    expect(hasPathCapability(player, 'sword.sword_riding', NO_DEPS)).toBe(false)
    expect(hasPathCapability(player, 'body.essence_economy', NO_DEPS)).toBe(false)
    expect(hasPathCapability(player, 'spell.elemental_casting', NO_DEPS)).toBe(false)
  })

  it('a way-less or mismatched pair resolves nothing - fail closed', () => {
    const wayLess = mortalPlayer()
    wayLess.cultivationPath = 'sword'

    expect(resolvePathCapabilities(wayLess, NO_DEPS).size).toBe(0)

    const mismatched = mortalPlayer()
    mismatched.cultivationPath = 'spell'
    mismatched.cultivationWay = 'hidden_body_pathway'

    expect(resolvePathCapabilities(mismatched, NO_DEPS).size).toBe(0)
  })

  it('spell.reaction_aura requires the learned ngo_dao_hon_don passive - deps.hasSkill is the seam', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'

    expect(hasPathCapability(player, 'spell.reaction_aura', NO_DEPS)).toBe(false)
    expect(
      hasPathCapability(player, 'spell.reaction_aura', {
        hasSkill: (id) => id === 'ngo_dao_hon_don',
      }),
    ).toBe(true)
  })

  it('spell.reaction_aura stays false on spell_pathway even with the passive learned', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'

    expect(
      hasPathCapability(player, 'spell.reaction_aura', { hasSkill: () => true }),
    ).toBe(false)
  })

  it('spell.empowered_ult requires the linh_ngo node of the COMMITTED element', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath.element = 'fire'

    expect(hasPathCapability(player, 'spell.empowered_ult', NO_DEPS)).toBe(false)

    // A linh_ngo node for a different element does not empower fire's ult.
    player.nodeLevels = { linh_ngo_bat_thu_can_quet: 1 }
    expect(hasPathCapability(player, 'spell.empowered_ult', NO_DEPS)).toBe(false)

    player.nodeLevels = { linh_ngo_tat_phuong_giang_the: 1 }
    expect(hasPathCapability(player, 'spell.empowered_ult', NO_DEPS)).toBe(true)
  })

  it('empowered_ult stays false with no committed element', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.nodeLevels = { linh_ngo_tat_phuong_giang_the: 1 }

    expect(hasPathCapability(player, 'spell.empowered_ult', NO_DEPS)).toBe(false)
  })

  it('hasStaticPathCapability answers from the declared static list only - conditional caps return false', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'

    // reaction_aura is conditional: the static read cannot prove it, so it
    // fails closed rather than lying.
    expect(hasStaticPathCapability(player, 'spell.reaction_aura')).toBe(false)

    player.cultivationWay = 'spell_pathway'
    expect(hasStaticPathCapability(player, 'spell.elemental_casting')).toBe(true)
    expect(hasStaticPathCapability(player, 'spell.empowered_ult')).toBe(false)
    expect(hasStaticPathCapability(player, 'sword.sword_scroll')).toBe(false)
  })
})

describe('isActivePath / isActiveWay - generic identity reads (P1)', () => {
  it('resolve through the catalog and fail closed on a corrupt pair', () => {
    const player = mortalPlayer()

    expect(isActivePath(player, 'sword')).toBe(false)
    expect(isActiveWay(player, 'sword_pathway')).toBe(false)

    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'

    expect(isActivePath(player, 'sword')).toBe(true)
    expect(isActivePath(player, 'spell')).toBe(false)
    expect(isActiveWay(player, 'sword_pathway')).toBe(true)
    expect(isActiveWay(player, 'hidden_sword_pathway')).toBe(false)

    // A way id the sword module does not own corrupts the pair.
    player.cultivationWay = 'hidden_spell_pathway'
    expect(isActivePath(player, 'sword')).toBe(false)
    expect(isActiveWay(player, 'hidden_spell_pathway')).toBe(false)
  })
})

describe('canonical subpath reads (P1-M3) - module-owned axes, capability-gated', () => {
  it('getActiveElement resolves only under an elemental_casting way', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'

    expect(getActiveElement(player)).toBeUndefined()

    player.spellPath.element = 'water'
    expect(getActiveElement(player)).toBe('water')

    // ngo_dao owns no element axis even if stale slice data lingers.
    player.cultivationWay = 'hidden_spell_pathway'
    expect(getActiveElement(player)).toBeUndefined()
  })

  it('getActiveElement fails closed on a corrupt pair', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell' // way-less
    player.spellPath.element = 'fire'

    expect(getActiveElement(player)).toBeUndefined()
  })

  it('getActiveRoute resolves only under spell_pathway', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'

    expect(getActiveRoute(player)).toBeUndefined()

    player.spellPath.route = 'dot'
    expect(getActiveRoute(player)).toBe('dot')

    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'
    expect(getActiveRoute(player)).toBeUndefined()
  })

  it('getSwordScrollPreset resolves the sword_pathway preset slice, defensive copy', () => {
    const player = mortalPlayer()
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'

    expect(getSwordScrollPreset(player)).toBeUndefined()

    player.swordPath = freshSwordPathState()
    player.swordPath.preset = ['orb_dam', 'orb_chem']

    const preset = getSwordScrollPreset(player)
    expect(preset).toEqual(['orb_dam', 'orb_chem'])

    // ngu owns no preset axis - the slice may exist but the read is empty.
    player.cultivationWay = 'hidden_sword_pathway'
    expect(getSwordScrollPreset(player)).toBeUndefined()
  })

  it('narrow presentation slices satisfy the read shapes', () => {
    // TheBarPlayerState shape: pair + spellPath + nodeLevels, no swordPath.
    const bridgeState = {
      cultivationPath: 'spell' as const,
      cultivationWay: 'spell_pathway' as const,
      spellPath: { element: 'fire' as const, route: 'no' as const },
      nodeLevels: {},
    }

    expect(getActiveElement(bridgeState)).toBe('fire')
    expect(getActiveRoute(bridgeState)).toBe('no')
    expect(hasStaticPathCapability(bridgeState, 'spell.elemental_casting')).toBe(true)
  })
})
