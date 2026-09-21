// M-E (decision D2) - the meridian PAGE model: one page per realm,
// monotonic unlock (unlockedPageRealmIndex <= currentRealmIndex), pages
// never re-lock. MeridianPages.ts owns the single predicate + derived
// grouping shared by the chapter gate and MeridianSection.
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../../player/Player'
import { MERIDIANS } from '../../../data/realm/Meridians'
import { REALMS } from '../../../data/realms/realm'
import {
  isMeridianPageUnlocked,
  listMeridianPages,
} from './MeridianPages'

describe('MeridianPages (P7 M-E, D2)', () => {
  it('isMeridianPageUnlocked: mortal -> locked, qi_refining -> unlocked', () => {
    const player = createDefaultPlayer()

    player.realmId = 'mortal'
    expect(isMeridianPageUnlocked(player, 'qi_refining')).toBe(false)

    player.realmId = 'qi_refining'
    expect(isMeridianPageUnlocked(player, 'qi_refining')).toBe(true)
  })

  it('pages never re-lock: every realm at/above qi_refining keeps the page open', () => {
    const player = createDefaultPlayer()
    const qiIndex = REALMS.findIndex((r) => r.id === 'qi_refining')
    expect(qiIndex).toBeGreaterThanOrEqual(0)

    for (const realm of REALMS.slice(qiIndex)) {
      player.realmId = realm.id
      expect(isMeridianPageUnlocked(player, 'qi_refining')).toBe(true)
    }
    // ...and every realm BELOW it is locked.
    for (const realm of REALMS.slice(0, qiIndex)) {
      player.realmId = realm.id
      expect(isMeridianPageUnlocked(player, 'qi_refining')).toBe(false)
    }
  })

  it('fails closed on unknown ids (page or player realm)', () => {
    const player = createDefaultPlayer()
    expect(isMeridianPageUnlocked(player, 'not_a_realm')).toBe(false)
    player.realmId = 'not_a_realm'
    expect(isMeridianPageUnlocked(player, 'qi_refining')).toBe(false)
    expect(isMeridianPageUnlocked(player, 'not_a_realm')).toBe(false)
  })

  it('listMeridianPages: one qi_refining page holding all 9 in canonical order', () => {
    const pages = listMeridianPages()

    expect(pages).toHaveLength(1)
    expect(pages[0]!.pageRealmId).toBe('qi_refining')
    expect(pages[0]!.meridians.map((entry) => entry.meridian.id)).toEqual(
      MERIDIANS.map((m) => m.id),
    )
    // flatIndex carries the global canonical position - consumers
    // never re-derive sequence order.
    expect(pages[0]!.meridians.map((entry) => entry.flatIndex)).toEqual(
      MERIDIANS.map((_, index) => index),
    )
  })

  it('data invariant: every pageRealmId resolves a real realm', () => {
    const realmIds = new Set(REALMS.map((r) => r.id))
    for (const meridian of MERIDIANS) {
      expect(realmIds.has(meridian.pageRealmId)).toBe(true)
    }
  })

  // Spec sec.3.6 authoring invariant: flat openedIds + derived page
  // grouping is only sound if page realm indices are non-decreasing in
  // canonical order - each page a contiguous block, a closed page
  // never reappearing.
  it('data invariant: pageRealmId realm indices are non-decreasing in canonical order', () => {
    let previousIndex = -1
    const closedPages = new Set<string>()

    for (const meridian of MERIDIANS) {
      const index = REALMS.findIndex((r) => r.id === meridian.pageRealmId)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeGreaterThanOrEqual(previousIndex)
      expect(closedPages.has(meridian.pageRealmId)).toBe(false)
      if (index > previousIndex) {
        if (previousIndex >= 0) closedPages.add(MERIDIANS[MERIDIANS.indexOf(meridian) - 1]!.pageRealmId)
        previousIndex = index
      }
    }
  })

  // Two-page characterization on fabricated definitions: grouping
  // splits pages, the lower page stays usable at the higher realm,
  // and the higher page is locked at the lower realm.
  it('groups a fabricated two-page list; unlock follows realm index independently per page', () => {
    const fabricated = [
      { ...MERIDIANS[0]!, id: 'page1_a', pageRealmId: 'mortal' },
      { ...MERIDIANS[1]!, id: 'page1_b', pageRealmId: 'mortal' },
      { ...MERIDIANS[2]!, id: 'page2_a', pageRealmId: 'foundation_establishment' },
    ]

    const pages = listMeridianPages(fabricated)
    expect(pages).toHaveLength(2)
    expect(pages[0]!.pageRealmId).toBe('mortal')
    expect(pages[0]!.meridians.map((entry) => entry.meridian.id)).toEqual(['page1_a', 'page1_b'])
    expect(pages[0]!.meridians.map((entry) => entry.flatIndex)).toEqual([0, 1])
    expect(pages[1]!.pageRealmId).toBe('foundation_establishment')
    expect(pages[1]!.meridians.map((entry) => entry.meridian.id)).toEqual(['page2_a'])
    expect(pages[1]!.meridians.map((entry) => entry.flatIndex)).toEqual([2])

    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    expect(isMeridianPageUnlocked(player, 'mortal')).toBe(true)
    expect(isMeridianPageUnlocked(player, 'foundation_establishment')).toBe(false)

    // After advancing, the lower page stays open - never re-locks.
    player.realmId = 'foundation_establishment'
    expect(isMeridianPageUnlocked(player, 'mortal')).toBe(true)
    expect(isMeridianPageUnlocked(player, 'foundation_establishment')).toBe(true)
  })
})
