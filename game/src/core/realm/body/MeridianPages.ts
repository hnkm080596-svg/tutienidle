// M-E (decision D2) - the meridian PAGE model. One page per realm;
// page identity IS the realm id (no separate page table - grouping is
// derived from MeridianDefinition.pageRealmId, array order preserved
// so the strict-prefix openedIds contract stays flat).
//
// Unlock contract: unlockedPageRealmIndex <= currentRealmIndex.
// Monotonic by construction (realm index never decreases) - a page
// NEVER re-locks across realm advance, and lower-realm completability
// post-advance is preserved by the chapter's pace gate only applying
// inside the page's own realm.
import { MERIDIANS, type MeridianDefinition } from '../../../data/realm/Meridians'
import { getRealmIndex } from '../realmSystem'
import type { PlayerData } from '../../player/Player'

export interface MeridianPageEntry {
  meridian: MeridianDefinition
  /** Global index in the canonical MERIDIANS sequence - the page model
   * owns this so consumers never re-derive ordering. */
  flatIndex: number
}

export interface MeridianPage {
  pageRealmId: string
  meridians: readonly MeridianPageEntry[]
}

/** D2 contract: the page is unlocked iff the player's realm index has
 * reached the page's realm index. Fails closed on unknown ids - an
 * unresolved page or an unresolved player realm is locked, never
 * silently open. */
export function isMeridianPageUnlocked(
  player: Pick<PlayerData, 'realmId'>,
  pageRealmId: string,
): boolean {
  const playerIndex = getRealmIndex(player.realmId)
  const pageIndex = getRealmIndex(pageRealmId)

  if (playerIndex === -1 || pageIndex === -1) {
    return false
  }

  return playerIndex >= pageIndex
}

/** Pages derived from the meridian list grouped by pageRealmId,
 * preserving first-appearance order. openedIds stays a flat
 * strict-prefix list across pages - page membership is derived,
 * never persisted. The definitions param exists so tests can
 * characterize grouping on fabricated multi-page data without
 * adding fake content to the canonical catalog.
 *
 * AUTHORING INVARIANT (spec sec.3.6): pageRealmId realm indices must
 * be non-decreasing in array order - each page a contiguous block.
 * A closed page reappearing later would merge under this grouping
 * while breaking the shared sequence/topology contract. */
export function listMeridianPages(
  meridians: readonly MeridianDefinition[] = MERIDIANS,
): readonly MeridianPage[] {
  const pages: { pageRealmId: string; meridians: MeridianPageEntry[] }[] = []

  meridians.forEach((meridian, flatIndex) => {
    const page = pages.find((candidate) => candidate.pageRealmId === meridian.pageRealmId)
    if (page) {
      page.meridians.push({ meridian, flatIndex })
    } else {
      pages.push({ pageRealmId: meridian.pageRealmId, meridians: [{ meridian, flatIndex }] })
    }
  })

  return pages
}
