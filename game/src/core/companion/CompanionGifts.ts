// CompanionGifts (M-F-COMPANION-GIFT) - the gift-issue fire function.
// Seams call it with a trigger fact; it appends a CompanionGiftRecord
// per matching authored moment, write-if-absent so re-fires (repeat
// realm write, refight wins, restored-state replays) stay no-ops. Pure
// append over player.companionGifts - no claims, no grants, no
// notifications (claim is the ops transaction).
import { isBetaCompanionGift } from '../../data/companion/Companions'
import type { CompanionGiftRecord } from '../../data/companion/Companions'
import {
  COMPANION_GIFT_MOMENTS,
  type CompanionGiftMoment,
  type CompanionGiftTrigger,
} from '../../data/companion/CompanionGiftMoments'
import type { PlayerData } from '../player/Player'

function triggerMatches(
  moment: CompanionGiftMoment,
  trigger: CompanionGiftTrigger,
): boolean {
  switch (moment.trigger.kind) {
    case 'realm_entered':
      return (
        trigger.kind === 'realm_entered' &&
        moment.trigger.realmId === trigger.realmId
      )
    case 'stage_completed':
      return (
        trigger.kind === 'stage_completed' &&
        moment.trigger.stageId === trigger.stageId
      )
  }
}

/**
 * Append gift records for every moment bound to `trigger`. Returns the
 * records appended this call ([] on no match / all already issued).
 * Skips non-giftable definitionIds: a moment pointing outside the Beta
 * gift authority fails loud in tests and silently refuses here - no
 * unclaimable record is ever persisted.
 */
export function issueCompanionGifts(
  player: PlayerData,
  trigger: CompanionGiftTrigger,
  moments: readonly CompanionGiftMoment[] = COMPANION_GIFT_MOMENTS,
): CompanionGiftRecord[] {
  const appended: CompanionGiftRecord[] = []

  for (const moment of moments) {
    if (!triggerMatches(moment, trigger) || !isBetaCompanionGift(moment.definitionId)) {
      continue
    }

    if (player.companionGifts.some((record) => record.id === moment.id)) {
      continue
    }

    const record: CompanionGiftRecord = {
      id: moment.id,
      definitionId: moment.definitionId,
      claimed: false,
    }

    player.companionGifts.push(record)
    appended.push(record)
  }

  return appended
}
