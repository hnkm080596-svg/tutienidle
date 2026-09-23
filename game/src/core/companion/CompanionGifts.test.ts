// CompanionGifts (M-F-COMPANION-GIFT Step 3) - the mail/gift fire
// function + authored-moment registry integrity. issueCompanionGifts is
// pure write-if-absent over player.companionGifts; the registry is
// content - every moment's definitionId must resolve inside the Beta
// gift authority so no unclaimable record can ever be authored.
import { describe, expect, it } from 'vitest'
import { issueCompanionGifts } from './CompanionGifts'
import {
  COMPANION_GIFT_MOMENTS,
  type CompanionGiftMoment,
} from '../../data/companion/CompanionGiftMoments'
import {
  BETA_COMPANION_GIFT_IDS,
  COMPANIONS,
  isBetaCompanionGift,
} from '../../data/companion/Companions'
import { REALMS } from '../../data/realms/realm'
import { STAGES } from '../../data/stage/Stages'
import { createDefaultPlayer } from '../player/Player'

function moment(overrides: Partial<CompanionGiftMoment> = {}): CompanionGiftMoment {
  return {
    id: 'test_moment',
    trigger: { kind: 'realm_entered', realmId: 'foundation_establishment' },
    definitionId: 'than_nong',
    ...overrides,
  }
}

describe('issueCompanionGifts', () => {
  it('appends a {id, definitionId, claimed:false} record on the matching realm_entered moment', () => {
    const player = createDefaultPlayer()
    const appended = issueCompanionGifts(player, {
      kind: 'realm_entered',
      realmId: 'foundation_establishment',
    })

    expect(appended).toEqual([
      { id: 'gift_than_nong_foundation_entry', definitionId: 'than_nong', claimed: false },
    ])
    expect(player.companionGifts).toEqual(appended)
  })

  it('appends on the matching stage_completed moment', () => {
    const player = createDefaultPlayer()
    const appended = issueCompanionGifts(player, {
      kind: 'stage_completed',
      stageId: 'foundation_floor_10',
    })

    expect(appended).toEqual([
      { id: 'gift_khai_minh_foundation_floor_10', definitionId: 'khai_minh', claimed: false },
    ])
    expect(player.companionGifts).toHaveLength(1)
  })

  it('issues nothing on a non-matching trigger', () => {
    const player = createDefaultPlayer()

    expect(
      issueCompanionGifts(player, { kind: 'realm_entered', realmId: 'qi_refining' }),
    ).toEqual([])
    expect(
      issueCompanionGifts(player, { kind: 'stage_completed', stageId: 'mortal_floor_1' }),
    ).toEqual([])
    expect(player.companionGifts).toHaveLength(0)
  })

  it('does not fire a realm moment on a same-named stage trigger (kind is part of the match)', () => {
    const player = createDefaultPlayer()
    const injected = [
      moment({ id: 'realm_moment', trigger: { kind: 'realm_entered', realmId: 'foundation_establishment' } }),
    ]

    expect(
      issueCompanionGifts(
        player,
        { kind: 'stage_completed', stageId: 'foundation_establishment' },
        injected,
      ),
    ).toEqual([])
  })

  it('is idempotent: a duplicate fire never appends the same record twice', () => {
    const player = createDefaultPlayer()
    const trigger = { kind: 'realm_entered', realmId: 'foundation_establishment' } as const

    expect(issueCompanionGifts(player, trigger)).toHaveLength(1)
    expect(issueCompanionGifts(player, trigger)).toEqual([])
    expect(player.companionGifts).toHaveLength(1)
  })

  it('skips non-giftable moments: a non-catalog definitionId is never persisted', () => {
    const player = createDefaultPlayer()
    const injected = [
      moment({
        id: 'bad_moment',
        trigger: { kind: 'realm_entered', realmId: 'foundation_establishment' },
        definitionId: 'no_such_companion',
      }),
      moment({
        id: 'non_gift_catalog_moment',
        trigger: { kind: 'realm_entered', realmId: 'foundation_establishment' },
        // Real catalog member, but NOT in the Beta gift authority.
        definitionId: 'ho_ly_tinh',
      }),
    ]

    expect(
      issueCompanionGifts(
        player,
        { kind: 'realm_entered', realmId: 'foundation_establishment' },
        injected,
      ),
    ).toEqual([])
    expect(player.companionGifts).toHaveLength(0)
  })

  it('one trigger can issue two moments when authored (id == moment.id, order preserved)', () => {
    const player = createDefaultPlayer()
    const injected = [
      moment({ id: 'moment_a', definitionId: 'than_nong' }),
      moment({ id: 'moment_b', definitionId: 'khai_minh' }),
    ]

    const appended = issueCompanionGifts(
      player,
      { kind: 'realm_entered', realmId: 'foundation_establishment' },
      injected,
    )

    expect(appended.map((record) => record.id)).toEqual(['moment_a', 'moment_b'])
    expect(appended.map((record) => record.definitionId)).toEqual(['than_nong', 'khai_minh'])
  })
})

describe('COMPANION_GIFT_MOMENTS registry integrity', () => {
  it('moment ids are unique', () => {
    const ids = COMPANION_GIFT_MOMENTS.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the authored Beta moments pin the deferred placements (content pass owns final)', () => {
    const ids = COMPANION_GIFT_MOMENTS.map((entry) => entry.id)
    expect(ids).toContain('gift_than_nong_foundation_entry')
    expect(ids).toContain('gift_khai_minh_foundation_floor_10')
  })

  it('every moment definitionId satisfies the Beta gift authority', () => {
    for (const entry of COMPANION_GIFT_MOMENTS) {
      expect(
        isBetaCompanionGift(entry.definitionId),
        `moment '${entry.id}' definitionId '${entry.definitionId}' is not a Beta gift`,
      ).toBe(true)
    }
  })

  it('BETA_COMPANION_GIFT_IDS is a subset of the real COMPANIONS catalog', () => {
    for (const id of BETA_COMPANION_GIFT_IDS) {
      expect(
        COMPANIONS.some((definition) => definition.id === id),
        `gift id '${id}' does not resolve in COMPANIONS - a dead persisted record class`,
      ).toBe(true)
    }
  })

  it('realm triggers reference authored realms', () => {
    for (const entry of COMPANION_GIFT_MOMENTS) {
      const trigger = entry.trigger
      if (trigger.kind === 'realm_entered') {
        expect(
          REALMS.some((realm) => realm.id === trigger.realmId),
          `moment '${entry.id}' references unknown realm '${trigger.realmId}'`,
        ).toBe(true)
      }
    }
  })

  it('stage triggers reference authored stages', () => {
    for (const entry of COMPANION_GIFT_MOMENTS) {
      const trigger = entry.trigger
      if (trigger.kind === 'stage_completed') {
        expect(
          STAGES.some((stage) => stage.id === trigger.stageId),
          `moment '${entry.id}' references unknown stage '${trigger.stageId}'`,
        ).toBe(true)
      }
    }
  })
})

describe('isBetaCompanionGift', () => {
  it('accepts only the Beta gift catalog members', () => {
    expect(isBetaCompanionGift('than_nong')).toBe(true)
    expect(isBetaCompanionGift('khai_minh')).toBe(true)
  })

  it('rejects real catalog members outside the gift authority', () => {
    expect(COMPANIONS.some((definition) => definition.id === 'ho_ly_tinh')).toBe(true)
    expect(isBetaCompanionGift('ho_ly_tinh')).toBe(false)
  })

  it('rejects ids absent from the catalog entirely', () => {
    expect(isBetaCompanionGift('not_a_companion')).toBe(false)
  })
})
