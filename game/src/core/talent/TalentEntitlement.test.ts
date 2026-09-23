// M-F-TALENT (ruling S15-18, mission graph) - the mandatory breakthrough
// talent transaction: ONE committed victory -> ONE persisted UPGRADE/NEW
// decision -> ONE granted result. These tests pin the domain contract:
// entitlement origination (deduped realm-pool draw, ReleasePolicy-gated),
// decision legality, single-result resolution, no-bypass persistence.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { BREAKTHROUGH_TALENT_POOLS } from '../../data/talent/BreakthroughTalentPools'
import { getTalentDefinition } from '../../data/talent/Talents'
import {
  createTalentEntitlement,
  drawBreakthroughTalentOffers,
  getTalentLevel,
  getTalentMaxLevel,
  getUpgradeableTalentIds,
  isTalentEntitlementActionable,
  reconcileTalentEntitlement,
  resolveTalentEntitlement,
} from './TalentEntitlement'

/** Pool member ids for a realm, for membership assertions. */
function poolIds(realmId: string): string[] {
  return (BREAKTHROUGH_TALENT_POOLS[realmId] ?? []).map((def) => def.id)
}

/** An upgradeable pool talent (levels authored) of the given realm. */
function upgradeablePoolId(realmId: string): string {
  const def = (BREAKTHROUGH_TALENT_POOLS[realmId] ?? []).find(
    (entry) => getTalentMaxLevel(entry) > 1,
  )
  if (def === undefined) throw new Error(`realm ${realmId} has no leveled pool talent`)
  return def.id
}

describe('drawBreakthroughTalentOffers — realm pool, dedupe, eligibility', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('returns up to 3 unique ids from the realm pool', () => {
    const player = usePlayerStore()

    const offers = drawBreakthroughTalentOffers(player, 'qi_refining')

    expect(offers.length).toBeGreaterThan(0)
    expect(offers.length).toBeLessThanOrEqual(3)
    expect(new Set(offers).size).toBe(offers.length)
    for (const id of offers) {
      expect(poolIds('qi_refining')).toContain(id)
    }
  })

  it('excludes already-owned talents (dedupe vs selectedTalentIds)', () => {
    const player = usePlayerStore()
    const pool = poolIds('qi_refining')
    player.selectedTalentIds = [pool[0]!]

    const offers = drawBreakthroughTalentOffers(player, 'qi_refining')

    expect(offers).not.toContain(pool[0])
  })

  it('ReleasePolicy suppresses future-realm pools (golden_core closed in Beta)', () => {
    const player = usePlayerStore()

    expect(poolIds('golden_core').length).toBeGreaterThan(0) // authored dormant pool
    expect(drawBreakthroughTalentOffers(player, 'golden_core')).toEqual([])
  })

  it('unknown realm pool -> empty offers', () => {
    const player = usePlayerStore()

    expect(drawBreakthroughTalentOffers(player, 'mortal')).toEqual([])
  })
})

describe('createTalentEntitlement — origination at breakthrough settle', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('writes a persisted record: realmId + bound offeredTalentIds', () => {
    const player = usePlayerStore()

    const record = createTalentEntitlement(player, 'qi_refining')

    expect(record).toBeDefined()
    expect(record!.realmId).toBe('qi_refining')
    expect(record!.offeredTalentIds.length).toBeGreaterThan(0)
    expect(record!.offeredTalentIds.length).toBeLessThanOrEqual(3)
    // The store wraps the stored record in a reactive proxy - pin the
    // persisted contents, not reference identity.
    expect(player.pendingTalentEntitlement).toEqual(record)
  })

  it('does NOT overwrite an already-pending entitlement (idempotent re-settle)', () => {
    const player = usePlayerStore()
    const first = createTalentEntitlement(player, 'qi_refining')!

    // A second origination (even for a different realm - the degenerate
    // re-settle) keeps the bound record untouched.
    const second = createTalentEntitlement(player, 'foundation_establishment')

    expect(second).toEqual(first)
    expect(player.pendingTalentEntitlement).toEqual(first)
    expect(player.pendingTalentEntitlement!.realmId).toBe('qi_refining')
    expect(player.pendingTalentEntitlement!.offeredTalentIds).toEqual(first.offeredTalentIds)
  })

  it('ReleasePolicy-disabled realm originates nothing', () => {
    const player = usePlayerStore()

    expect(createTalentEntitlement(player, 'golden_core')).toBeUndefined()
    expect(player.pendingTalentEntitlement).toBeUndefined()
  })
})

describe('resolveTalentEntitlement — one result, legality, no bypass', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('NEW: grants an offered talent at level 1 and clears the record', () => {
    const player = usePlayerStore()
    const offered = poolIds('qi_refining')[0]!
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [offered] }

    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: offered })).toBe(true)

    expect(player.selectedTalentIds).toContain(offered)
    expect(getTalentLevel(player, offered)).toBe(1)
    expect(player.pendingTalentEntitlement).toBeUndefined()
  })

  it('NEW: rejects an id that was not offered — record stays, nothing granted', () => {
    const player = usePlayerStore()
    const offered = poolIds('qi_refining')[0]!
    const notOffered = poolIds('qi_refining')[1]!
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [offered] }

    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: notOffered })).toBe(false)

    expect(player.selectedTalentIds).not.toContain(notOffered)
    expect(player.pendingTalentEntitlement).toBeDefined()
  })

  it('NEW: rejects an id the player already owns', () => {
    const player = usePlayerStore()
    const offered = poolIds('qi_refining')[0]!
    player.selectedTalentIds = [offered]
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [offered] }

    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: offered })).toBe(false)
    expect(player.pendingTalentEntitlement).toBeDefined()
  })

  it('UPGRADE: owned talent with a legal next level gains +1 level and clears', () => {
    const player = usePlayerStore()
    const target = upgradeablePoolId('qi_refining')
    player.selectedTalentIds = [target]
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [] }

    expect(resolveTalentEntitlement(player, { kind: 'upgrade', talentId: target })).toBe(true)

    expect(getTalentLevel(player, target)).toBe(2)
    expect(player.pendingTalentEntitlement).toBeUndefined()
  })

  it('UPGRADE: rejects a talent already at max level', () => {
    const player = usePlayerStore()
    // A creation talent (no authored level table -> maxLevel 1).
    player.selectedTalentIds = ['pham_cot']
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [] }

    expect(resolveTalentEntitlement(player, { kind: 'upgrade', talentId: 'pham_cot' })).toBe(false)
    expect(getTalentLevel(player, 'pham_cot')).toBe(1)
    expect(player.pendingTalentEntitlement).toBeDefined()
  })

  it('UPGRADE: rejects an id the player does not own', () => {
    const player = usePlayerStore()
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [] }

    expect(
      resolveTalentEntitlement(player, { kind: 'upgrade', talentId: upgradeablePoolId('qi_refining') }),
    ).toBe(false)
    expect(player.pendingTalentEntitlement).toBeDefined()
  })

  it('no pending record -> resolution is a no-op false', () => {
    const player = usePlayerStore()

    expect(
      resolveTalentEntitlement(player, { kind: 'new', talentId: poolIds('qi_refining')[0]! }),
    ).toBe(false)
  })
})

describe('level model — getTalentLevel / getTalentMaxLevel / getUpgradeableTalentIds', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('absent talentLevels entry reads as level 1; maxLevel = 1 + authored level rows', () => {
    const player = usePlayerStore()
    const leveled = getTalentDefinition(upgradeablePoolId('qi_refining'))!
    const unleveled = getTalentDefinition('pham_cot')!

    expect(getTalentLevel(player, leveled.id)).toBe(1)
    expect(getTalentMaxLevel(leveled)).toBeGreaterThan(1)
    expect(getTalentMaxLevel(unleveled)).toBe(1)
  })

  it('upgradeable list = owned talents below maxLevel only', () => {
    const player = usePlayerStore()
    const leveled = upgradeablePoolId('qi_refining')
    player.selectedTalentIds = ['pham_cot', leveled]

    expect(getUpgradeableTalentIds(player)).toEqual([leveled])

    // At max -> drops out of the upgradeable list.
    player.talentLevels = { [leveled]: getTalentMaxLevel(getTalentDefinition(leveled)!) }
    expect(getUpgradeableTalentIds(player)).toEqual([])
  })
})

// C2C round 42 - resolution must enforce the same pool/policy authority
// as origination (a persisted record is never trusted), and the drain
// lock must never hold on a record that presents zero legal decisions.
describe('resolveTalentEntitlement — persisted-record authority (C2C-42)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('NEW: rejects an offered id that is not a member of the record realm pool', () => {
    const player = usePlayerStore()
    // A shaped record can carry any catalog id - tc_* is valid but not
    // a member of the qi_refining pool, so it is not a legal offer.
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: ['tc_dia_can'] }

    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: 'tc_dia_can' })).toBe(false)

    expect(player.selectedTalentIds).not.toContain('tc_dia_can')
    expect(player.pendingTalentEntitlement).toBeDefined()
  })

  it('NEW: rejects when the record realm pool is release-suppressed', () => {
    const player = usePlayerStore()
    const dormant = poolIds('golden_core')[0]!
    player.pendingTalentEntitlement = { realmId: 'golden_core', offeredTalentIds: [dormant] }

    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: dormant })).toBe(false)

    expect(player.selectedTalentIds).not.toContain(dormant)
    expect(player.pendingTalentEntitlement).toBeDefined()
  })

  it('NEW: latent talentLevels for the unowned id normalize to level 1 on grant', () => {
    const player = usePlayerStore()
    const offered = poolIds('qi_refining')[0]!
    player.talentLevels = { [offered]: 3 } // shaped save: level without ownership
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [offered] }

    expect(resolveTalentEntitlement(player, { kind: 'new', talentId: offered })).toBe(true)

    expect(player.selectedTalentIds).toContain(offered)
    expect(getTalentLevel(player, offered)).toBe(1)
  })

  it('a record whose offers are all already owned + no upgradeables clears on reconcile', () => {
    const player = usePlayerStore()
    const ownedMaxed = upgradeablePoolId('qi_refining')
    player.selectedTalentIds = [ownedMaxed, 'pham_cot']
    player.talentLevels = { [ownedMaxed]: getTalentMaxLevel(getTalentDefinition(ownedMaxed)!) }
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [ownedMaxed] }

    expect(isTalentEntitlementActionable(player)).toBe(false)

    reconcileTalentEntitlement(player)

    expect(player.pendingTalentEntitlement).toBeUndefined()
  })

  it('a record on a release-suppressed realm pool clears on reconcile', () => {
    const player = usePlayerStore()
    player.pendingTalentEntitlement = {
      realmId: 'golden_core',
      offeredTalentIds: [poolIds('golden_core')[0]!],
    }

    expect(isTalentEntitlementActionable(player)).toBe(false)

    reconcileTalentEntitlement(player)

    expect(player.pendingTalentEntitlement).toBeUndefined()
  })

  it('a record with one legal decision is actionable and survives reconcile', () => {
    const player = usePlayerStore()
    const record = { realmId: 'qi_refining', offeredTalentIds: [poolIds('qi_refining')[0]!] }
    player.pendingTalentEntitlement = record

    expect(isTalentEntitlementActionable(player)).toBe(true)

    reconcileTalentEntitlement(player)

    expect(player.pendingTalentEntitlement).toEqual(record)
  })

  it('empty offers + one legal UPGRADE stays actionable on the upgrade branch alone', () => {
    const player = usePlayerStore()
    const target = upgradeablePoolId('qi_refining')
    player.selectedTalentIds = [target]
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [] }

    expect(isTalentEntitlementActionable(player)).toBe(true)
  })
})
