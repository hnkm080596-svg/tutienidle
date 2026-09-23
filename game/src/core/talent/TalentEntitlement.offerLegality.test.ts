// M-F-TALENT (ruling S15-18) + C2C round 47 - the persisted offer set
// must satisfy the same structural legality as the live draw, enforced
// by ONE shared predicate (isLegalBreakthroughOffer): realm-pool member
// AND weight > 0 AND catalog-resolvable. This file mocks the pool to
// pin the weight-0 member case that no authored pool currently carries.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { TalentDefinition } from './Talent'

vi.mock('../../data/talent/BreakthroughTalentPools', () => {
  const legal: TalentDefinition = {
    id: 'mock_legal',
    name: 'Mock Legal',
    description: 'live member',
    rarity: 'pham',
    weight: 10,
    tags: ['resource'],
    effects: [],
  }
  const dead: TalentDefinition = {
    id: 'mock_dead',
    name: 'Mock Dead',
    description: 'authored but never drawable (weight 0)',
    rarity: 'pham',
    weight: 0,
    tags: ['resource'],
    effects: [],
  }

  return {
    BREAKTHROUGH_TALENT_POOLS: {
      qi_refining: [legal, dead],
      foundation_establishment: [],
      golden_core: [],
    },
  }
})

import { usePlayerStore } from '../../stores/player'
import {
  drawBreakthroughTalentOffers,
  isLegalBreakthroughOffer,
  isTalentEntitlementActionable,
  reconcileTalentEntitlement,
  resolveTalentEntitlement,
} from './TalentEntitlement'

describe('isLegalBreakthroughOffer — the ONE shared offer legality rule (C2C-47)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('a live pool member (weight > 0, catalog-resolvable) is legal', () => {
    expect(isLegalBreakthroughOffer('qi_refining', 'mock_legal')).toBe(true)
  })

  it('a weight-0 pool member is never a legal offer - it can never be drawn', () => {
    expect(isLegalBreakthroughOffer('qi_refining', 'mock_dead')).toBe(false)
  })

  it('a catalog id outside the realm pool is a foreign offer - illegal', () => {
    // tc_dia_can resolves in the catalog but belongs to the
    // foundation_establishment pool, not qi_refining's.
    expect(isLegalBreakthroughOffer('qi_refining', 'tc_dia_can')).toBe(false)
    expect(isLegalBreakthroughOffer('qi_refining', 'retired_talent_id')).toBe(false)
  })

  it('the live draw can never produce a weight-0 member', () => {
    const player = usePlayerStore()

    for (let i = 0; i < 20; i++) {
      expect(drawBreakthroughTalentOffers(player, 'qi_refining')).not.toContain('mock_dead')
    }
  })

  it('resolution rejects a persisted weight-0 offer even though the id is a pool member', () => {
    const player = usePlayerStore()
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: ['mock_dead'] }

    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: 'mock_dead' })).toBe(false)

    expect(player.selectedTalentIds).not.toContain('mock_dead')
    expect(player.pendingTalentEntitlement).toBeDefined()
  })

  it('a record whose only offer is weight-0 is not actionable and reconciles away', () => {
    const player = usePlayerStore()
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: ['mock_dead'] }

    expect(isTalentEntitlementActionable(player)).toBe(false)

    reconcileTalentEntitlement(player)

    expect(player.pendingTalentEntitlement).toBeUndefined()
  })

  it('resolution still grants a legal offer from a mixed set - the dead id stays ungrantable', () => {
    const player = usePlayerStore()
    player.pendingTalentEntitlement = {
      realmId: 'qi_refining',
      offeredTalentIds: ['mock_legal', 'mock_dead'],
    }

    // Mixed sets only exist pre-validation - actionability asks whether
    // SOME offer is still legal+unowned.
    expect(isTalentEntitlementActionable(player)).toBe(true)
    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: 'mock_dead' })).toBe(false)
    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: 'mock_legal' })).toBe(true)

    expect(player.selectedTalentIds).toContain('mock_legal')
    expect(player.selectedTalentIds).not.toContain('mock_dead')
    expect(player.pendingTalentEntitlement).toBeUndefined()
  })
})
