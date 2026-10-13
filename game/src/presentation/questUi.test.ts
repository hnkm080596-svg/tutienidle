import { describe, expect, it } from 'vitest'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'
import { questRowStatus, selectVisibleQuestId, trackedHomeQuest } from './questUi'

function quest(id: string, options: {
  locked?: boolean
  claimed?: boolean
  claimable?: boolean
} = {}): BetaQuestSurfaceModel {
  return {
    id,
    name: id,
    description: id,
    cadence: 'once',
    progress: 0,
    target: 3,
    targetLabel: null,
    rewards: [],
    claim: {
      available: options.claimable ?? false,
      claimed: options.claimed ?? false,
      disabledReason: options.claimed ? 'already-claimed' : 'incomplete',
    },
    ...(options.locked ? { lockedPreview: { afterQuestName: 'First quest' } } : {}),
  }
}

describe('quest UI selection and projection', () => {
  it('selects the first unlocked row when the first preview is locked', () => {
    expect(selectVisibleQuestId([quest('locked', { locked: true }), quest('active')], null)).toBe('active')
  })

  it('never selects a locked preview, including on a previous selected id', () => {
    const rows = [quest('locked', { locked: true })]
    expect(selectVisibleQuestId(rows, null)).toBeNull()
    expect(selectVisibleQuestId(rows, 'locked')).toBeNull()
    expect(selectVisibleQuestId([], 'active')).toBeNull()
  })

  it('keeps the current unlocked row during unrelated row updates', () => {
    const rows = [quest('active'), quest('other')]
    expect(selectVisibleQuestId(rows, 'other')).toBe('other')
  })

  it('opens the same quest as the home tracker after an earlier quest was claimed', () => {
    const rows = [
      quest('claimed', { claimed: true }),
      quest('active'),
      quest('locked', { locked: true }),
      quest('ready', { claimable: true }),
    ]
    expect(trackedHomeQuest(rows)?.id).toBe('ready')
    expect(selectVisibleQuestId(rows, null)).toBe('ready')
    expect(selectVisibleQuestId(rows, 'active')).toBe('active')

    const afterClaim = rows.map((row) => row.id === 'ready' ? quest('ready', { claimed: true }) : row)
    expect(trackedHomeQuest(afterClaim)?.id).toBe('active')
    expect(selectVisibleQuestId(afterClaim, null)).toBe('active')
    expect(selectVisibleQuestId(afterClaim, 'ready')).toBe('ready')

    const allClaimed = [quest('claimed', { claimed: true }), quest('ready', { claimed: true })]
    expect(selectVisibleQuestId(allClaimed, null)).toBe('claimed')
  })

  it('distinguishes claimable, active, claimed and locked statuses', () => {
    expect(questRowStatus(quest('locked', { locked: true, claimable: true }))).toBe('pending')
    expect(questRowStatus(quest('claimed', { claimed: true }))).toBe('complete')
    expect(questRowStatus(quest('ready', { claimable: true }))).toBe('ready')
    expect(questRowStatus(quest('active'))).toBe('doing')
  })

  it('tracks claimable quests before unfinished unlocked quests, even if locked appears first', () => {
    const rows = [quest('locked', { locked: true }), quest('active'), quest('ready', { claimable: true })]
    expect(trackedHomeQuest(rows)?.id).toBe('ready')
    expect(trackedHomeQuest(rows.slice(0, 2))?.id).toBe('active')
  })

  it('hides tracker when there is no unfinished unlocked quest', () => {
    expect(trackedHomeQuest([quest('locked', { locked: true })])).toBeNull()
    expect(trackedHomeQuest([quest('claimed', { claimed: true })])).toBeNull()
    expect(trackedHomeQuest([])).toBeNull()
  })
})
