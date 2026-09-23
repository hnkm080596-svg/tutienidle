// GameManagerCompanionOps (companion-gacha Task 4, 2026-09-12) - ops
// orchestration tests: pull atomicity, Duyen Phan crediting, exchange
// gates ordering, feed early-reject. The real chieu_hien_lenh registry
// entry ships in Task 6, so tests inject a stub Material with the
// production id straight into the bag (MaterialBag.add stores the
// template on the stack - pullCompanion never touches the registry).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import type { Material } from '../material/Material'
import { BETA_COMPANION_IDS, BETA_COMPANIONS, COMPANIONS } from '../../data/companion/Companions'
import type { CompanionDefinition, CompanionInstance } from '../../data/companion/Companions'
import { REALMS } from '../../data/realms/realm'
import { COMPANION_PULL_TOKEN_ID, EXCHANGE_COST } from './GameManagerCompanionOps'
import { MAX_CONSTELLATION_RANK } from '../companion/CompanionProgression'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'

// M-F-COMPANION-GIFT: ops gate on companionAcquirablePool() - inject the
// pool directly so every contract arm is coverable: null = real Beta
// flag (pool closed), BETA_COMPANIONS = open pool (architecture kept,
// success paths still exercisable), [] = enabled-but-authored-empty.
let acquirablePoolOverride: readonly CompanionDefinition[] | null = null
vi.mock('../companion/CompanionAvailability', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../companion/CompanionAvailability')>()
  return {
    ...actual,
    companionAcquirablePool: () =>
      acquirablePoolOverride ?? actual.companionAcquirablePool(),
  }
})
function openPullPool(): void {
  acquirablePoolOverride = BETA_COMPANIONS
}
function authoredEmptyPool(): void {
  acquirablePoolOverride = []
}

// Stub built from the ops constant so a token-id rename drags this stub
// along and the not_feedable test pins the exclusion set to the real id.
const PULL_TOKEN: Material = {
  id: COMPANION_PULL_TOKEN_ID,
  name: 'Chiêu Hiền Lệnh',
  category: 'other',
  sourceType: 'boss',
}

// Plain feed material: no profession meta -> flat 10 exp each.
const FEED_MATERIAL: Material = {
  id: 'test_feed_material',
  name: 'Test Feed',
  category: 'other',
  sourceType: 'monster',
}

// P7-M9 (decision D4): the Companion domain unlocks at Tru Co, so the
// success-path tests run on a foundation_establishment player; the
// realm-gate describe below covers the locked realms explicitly.
const FOUNDATION_MAX_LEVEL = REALMS.find((realm) => realm.id === 'foundation_establishment')!.maxLevel

function makeManager(realmId = 'foundation_establishment'): { manager: GameManager; player: PlayerData } {
  const manager = new GameManager()
  const player = createDefaultPlayer()
  player.realmId = realmId
  manager.setActivePlayer(player)
  return { manager, player }
}

// Math.random = 0 -> roll lands in the first pooled grade in GRADE_ORDER
// present in the Beta pool (huyen) and pickDefinitionOfGrade takes index
// 0 of the huyen pool, so every pull deterministically returns
// BETA_COMPANIONS[0] (than_nong).
function mockPullsToFirstDefinition(): void {
  vi.spyOn(Math, 'random').mockReturnValue(0)
}

function ownedInstance(overrides: Partial<CompanionInstance> = {}): CompanionInstance {
  return {
    instanceId: 'inst-1',
    definitionId: BETA_COMPANIONS[0]!.id,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  acquirablePoolOverride = null
})

describe('pullCompanion', () => {
  it('rejects without a token and preserves all balances (open pool reaches the token gate)', () => {
    openPullPool()
    const { manager, player } = makeManager()

    const result = manager.companionOps.pullCompanion()

    expect(result).toEqual({ ok: false, reason: 'missing_token' })
    expect(player.duyenPhan).toBe(0)
    expect(player.companions).toHaveLength(0)
    expect(player.companionPullsSinceRare).toBe(0)
  })

  it('spends one token, credits +1 Duyen Phan, and appends the new instance', () => {
    openPullPool()
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 2)
    mockPullsToFirstDefinition()

    const result = manager.companionOps.pullCompanion()

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.outcome.kind).toBe('new')
    expect(result.outcome.definition.id).toBe(BETA_COMPANIONS[0]!.id)
    expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(1)
    expect(player.duyenPhan).toBe(1)
    expect(result.duyenPhan).toBe(1)
    // huyen < dia -> pity counter keeps counting.
    expect(player.companionPullsSinceRare).toBe(1)
    expect(result.pullsSinceRare).toBe(1)
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.definitionId).toBe(BETA_COMPANIONS[0]!.id)
    expect(player.companions[0]!.constellationRank).toBe(0)
  })

  it('duplicate pull raises constellation rank in place and still credits +1 Duyen Phan', () => {
    openPullPool()
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 1)
    mockPullsToFirstDefinition()
    player.companions.push(ownedInstance({ constellationRank: 2 }))

    const result = manager.companionOps.pullCompanion()

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.outcome.kind).toBe('constellation_up')
    expect(result.outcome.constellationRankAfter).toBe(3)
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.instanceId).toBe('inst-1')
    expect(player.companions[0]!.constellationRank).toBe(3)
    expect(player.duyenPhan).toBe(1)
  })

  it('duplicate pull on a maxed constellation pays the +5 Duyen Phan bonus', () => {
    openPullPool()
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 1)
    mockPullsToFirstDefinition()
    player.companions.push(ownedInstance({ constellationRank: MAX_CONSTELLATION_RANK }))

    const result = manager.companionOps.pullCompanion()

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.outcome.kind).toBe('constellation_maxed')
    // Instance untouched; +1 base +5 bonus = +6 total.
    expect(player.companions[0]!.constellationRank).toBe(MAX_CONSTELLATION_RANK)
    expect(player.duyenPhan).toBe(6)
    expect(result.duyenPhan).toBe(6)
  })

  it('every roll lands inside the Beta pool — the full catalog is never acquirable (P7-M-G)', () => {
    openPullPool()
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 20)
    // Sweep rolls across every effective-rate bucket: only huyen (< 2/3)
    // and dia (< 1) definitions exist in the Beta pool.
    const rolls = [0, 0.3, 0.5, 0.66, 0.67, 0.8, 0.99]
    let index = 0
    vi.spyOn(Math, 'random').mockImplementation(() => rolls[index++ % rolls.length]!)

    for (let pull = 0; pull < rolls.length * 2; pull++) {
      const result = manager.companionOps.pullCompanion()

      if (!result.ok) {
        throw new Error(`expected ok, got ${result.reason}`)
      }

      expect(BETA_COMPANION_IDS).toContain(result.outcome.definition.id)
      expect(result.outcome.definition.id).not.toBe('ho_ly_tinh')
    }
  })

  it('pity guarantees the only dia+ Beta definition — khai_minh (P7-M-G)', () => {
    openPullPool()
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 1)
    player.companionPullsSinceRare = 29
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const result = manager.companionOps.pullCompanion()

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.outcome.definition.id).toBe('khai_minh')
    expect(player.companionPullsSinceRare).toBe(0)
  })
})

describe('exchangeCompanion', () => {
  it('rejects an unknown definition', () => {
    openPullPool()
    const { manager, player } = makeManager()
    player.duyenPhan = 1000

    const result = manager.companionOps.exchangeCompanion('no_such_companion')

    expect(result).toEqual({ ok: false, reason: 'unknown_definition' })
    expect(player.duyenPhan).toBe(1000)
  })

  it('rejects on insufficient Duyen Phan without deducting anything', () => {
    openPullPool()
    const { manager, player } = makeManager()
    player.duyenPhan = EXCHANGE_COST.huyen - 1

    const result = manager.companionOps.exchangeCompanion(BETA_COMPANIONS[0]!.id)

    expect(result).toEqual({ ok: false, reason: 'insufficient_duyen_phan' })
    expect(player.duyenPhan).toBe(EXCHANGE_COST.huyen - 1)
    expect(player.companions).toHaveLength(0)
  })

  it('pushes a fresh instance for an unowned companion', () => {
    openPullPool()
    const { manager, player } = makeManager()
    player.duyenPhan = EXCHANGE_COST.huyen

    const result = manager.companionOps.exchangeCompanion(BETA_COMPANIONS[0]!.id)

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.kind).toBe('new')
    expect(result.definition.id).toBe(BETA_COMPANIONS[0]!.id)
    expect(result.duyenPhan).toBe(0)
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.definitionId).toBe(BETA_COMPANIONS[0]!.id)
    expect(player.companions[0]!.realmId).toBe('mortal')
    expect(player.companions[0]!.realmLevel).toBe(1)
    expect(player.companions[0]!.constellationRank).toBe(0)
  })

  it('raises constellation rank in place for an owned companion below C6', () => {
    openPullPool()
    const { manager, player } = makeManager()
    player.duyenPhan = EXCHANGE_COST.huyen + 7
    player.companions.push(ownedInstance({ constellationRank: 1 }))

    const result = manager.companionOps.exchangeCompanion(BETA_COMPANIONS[0]!.id)

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.kind).toBe('constellation_up')
    expect(result.constellationRankAfter).toBe(2)
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.instanceId).toBe('inst-1')
    expect(player.companions[0]!.constellationRank).toBe(2)
    expect(player.duyenPhan).toBe(7)
  })

  it('rejects a maxed constellation before checking points', () => {
    openPullPool()
    const { manager, player } = makeManager()
    // 0 DP on purpose: the constellation_maxed gate runs first.
    player.companions.push(ownedInstance({ constellationRank: MAX_CONSTELLATION_RANK }))

    const result = manager.companionOps.exchangeCompanion(BETA_COMPANIONS[0]!.id)

    expect(result).toEqual({ ok: false, reason: 'constellation_maxed' })
    expect(player.duyenPhan).toBe(0)
    expect(player.companions[0]!.constellationRank).toBe(MAX_CONSTELLATION_RANK)
  })

  it('rejects a full-catalog-but-non-Beta definition as unknown_definition (P7-M-G)', () => {
    openPullPool()
    const { manager, player } = makeManager()
    // ho_ly_tinh stays in COMPANIONS as future content but is not
    // Beta-acquirable - the exchange must not mint it.
    expect(COMPANIONS.some((definition) => definition.id === 'ho_ly_tinh')).toBe(true)
    expect(BETA_COMPANION_IDS).not.toContain('ho_ly_tinh')
    player.duyenPhan = 500

    const result = manager.companionOps.exchangeCompanion('ho_ly_tinh')

    expect(result).toEqual({ ok: false, reason: 'unknown_definition' })
    expect(player.duyenPhan).toBe(500)
    expect(player.companions).toHaveLength(0)
  })
})

describe('feedCompanion', () => {
  it('rejects an unknown instance id', () => {
    const { manager, player } = makeManager()
    manager.materialRegistry.register(FEED_MATERIAL)
    manager.materialBag.add(FEED_MATERIAL, 5)
    player.companions.push(ownedInstance())

    const result = manager.companionOps.feedCompanion('not-an-instance', FEED_MATERIAL.id, 1)

    expect(result).toEqual({ ok: false, reason: 'unknown_instance' })
    expect(manager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(5)
  })

  it('rejects a level-maxed companion BEFORE removing material', () => {
    const { manager, player } = makeManager()
    manager.materialRegistry.register(FEED_MATERIAL)
    manager.materialBag.add(FEED_MATERIAL, 5)
    // Player is at foundation; a foundation companion at realm maxLevel is capped.
    player.companions.push(
      ownedInstance({ realmId: 'foundation_establishment', realmLevel: FOUNDATION_MAX_LEVEL }),
    )

    const result = manager.companionOps.feedCompanion('inst-1', FEED_MATERIAL.id, 2)

    expect(result).toEqual({ ok: false, reason: 'level_maxed' })
    // The early-reject ordering is the point: bag untouched.
    expect(manager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(5)
    expect(player.companions[0]!.exp).toBe(0)
  })

  it('rejects a non-feedable material (out-of-scope category) without consuming it', () => {
    const { manager, player } = makeManager()
    const herb: Material = {
      id: 'test_herb',
      name: 'Test Herb',
      category: 'herb',
      sourceType: 'exploration',
    }
    manager.materialRegistry.register(herb)
    manager.materialBag.add(herb, 5)
    player.companions.push(ownedInstance())

    const result = manager.companionOps.feedCompanion('inst-1', herb.id, 2)

    expect(result).toEqual({ ok: false, reason: 'not_feedable' })
    expect(manager.materialBag.getAmount(herb.id)).toBe(5)
    expect(player.companions[0]!.exp).toBe(0)
  })

  it('rejects currency and the pull token despite registry presence', () => {
    const { manager, player } = makeManager()
    manager.materialRegistry.register(SPIRIT_STONE_MATERIAL)
    manager.materialRegistry.register(PULL_TOKEN)
    manager.materialBag.add(SPIRIT_STONE_MATERIAL, 5)
    manager.materialBag.add(PULL_TOKEN, 5)
    player.companions.push(ownedInstance())

    // PULL_TOKEN is category 'other' - inside the allowed feed scope - so
    // this proves the explicit excluded-id gate, not the category filter.
    expect(manager.companionOps.feedCompanion('inst-1', SPIRIT_STONE_MATERIAL.id, 1)).toEqual({
      ok: false,
      reason: 'not_feedable',
    })
    expect(manager.companionOps.feedCompanion('inst-1', PULL_TOKEN.id, 1)).toEqual({
      ok: false,
      reason: 'not_feedable',
    })
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL.id)).toBe(5)
    expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(5)
    expect(player.companions[0]!.exp).toBe(0)
  })

  it('rejects a material missing from the registry even when the bag holds it', () => {
    const { manager, player } = makeManager()
    // In the bag but NOT registered -> unknown_material, bag untouched.
    manager.materialBag.add(FEED_MATERIAL, 5)
    player.companions.push(ownedInstance())

    const result = manager.companionOps.feedCompanion('inst-1', FEED_MATERIAL.id, 1)

    expect(result).toEqual({ ok: false, reason: 'unknown_material' })
    expect(manager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(5)
  })

  it('rejects when the bag holds fewer than count', () => {
    const { manager, player } = makeManager()
    manager.materialRegistry.register(FEED_MATERIAL)
    manager.materialBag.add(FEED_MATERIAL, 1)
    player.companions.push(ownedInstance())

    const result = manager.companionOps.feedCompanion('inst-1', FEED_MATERIAL.id, 3)

    expect(result).toEqual({ ok: false, reason: 'insufficient_material' })
    expect(manager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(1)
    expect(player.companions[0]!.exp).toBe(0)
  })

  it('applies exp and decrements the bag on a valid feed', () => {
    const { manager, player } = makeManager()
    manager.materialRegistry.register(FEED_MATERIAL)
    manager.materialBag.add(FEED_MATERIAL, 5)
    player.companions.push(ownedInstance())

    const result = manager.companionOps.feedCompanion('inst-1', FEED_MATERIAL.id, 5)

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    // 5 x flat-10 = 50 exp; mortal tier 1 costs 40 -> level 2, 10 left.
    expect(result.expGained).toBe(50)
    expect(result.levelsGained).toBe(1)
    expect(result.realmBreakthroughs).toEqual([])
    expect(result.clampedExp).toBe(0)
    expect(manager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(0)
    expect(player.companions[0]!.realmLevel).toBe(2)
    expect(player.companions[0]!.exp).toBe(10)
  })

  it('still feeds an owned non-Beta instance — full-catalog ownership survives (P7-M-G)', () => {
    const { manager, player } = makeManager()
    manager.materialRegistry.register(FEED_MATERIAL)
    manager.materialBag.add(FEED_MATERIAL, 5)
    // A player who somehow owns future-content ho_ly_tinh keeps full
    // ownership ops - only acquisition is Beta-pool-gated.
    player.companions.push(ownedInstance({ definitionId: 'ho_ly_tinh' }))

    const result = manager.companionOps.feedCompanion('inst-1', FEED_MATERIAL.id, 5)

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.expGained).toBe(50)
    expect(manager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(0)
  })
})

// P7-M9 (decision D4): the Companion domain begins at Tru Co. The realm
// gate runs BEFORE every other check (token, definition, instance) and
// preserves all balances.
describe('companion realm gate', () => {
  it('pullCompanion rejects realm_locked at mortal and qi_refining, token untouched', () => {
    for (const realmId of ['mortal', 'qi_refining']) {
      const { manager, player } = makeManager(realmId)
      manager.materialBag.add(PULL_TOKEN, 2)

      expect(manager.companionOps.pullCompanion()).toEqual({ ok: false, reason: 'realm_locked' })
      expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(2)
      expect(player.duyenPhan).toBe(0)
      expect(player.companions).toHaveLength(0)
      expect(player.companionPullsSinceRare).toBe(0)
    }
  })

  it('the realm gate fires before the token check', () => {
    const { manager } = makeManager('mortal')

    // No token in the bag: realm_locked, not missing_token.
    expect(manager.companionOps.pullCompanion()).toEqual({ ok: false, reason: 'realm_locked' })
  })

  it('exchangeCompanion rejects realm_locked below Tru Co, duyenPhan untouched', () => {
    const { manager, player } = makeManager('qi_refining')
    player.duyenPhan = 1000

    expect(manager.companionOps.exchangeCompanion(BETA_COMPANIONS[0]!.id)).toEqual({
      ok: false,
      reason: 'realm_locked',
    })
    expect(player.duyenPhan).toBe(1000)
    expect(player.companions).toHaveLength(0)
  })

  it('feedCompanion rejects realm_locked below Tru Co, bag untouched', () => {
    const { manager, player } = makeManager('mortal')
    manager.materialRegistry.register(FEED_MATERIAL)
    manager.materialBag.add(FEED_MATERIAL, 5)
    player.companions.push(ownedInstance())

    expect(manager.companionOps.feedCompanion('inst-1', FEED_MATERIAL.id, 2)).toEqual({
      ok: false,
      reason: 'realm_locked',
    })
    expect(manager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(5)
    expect(player.companions[0]!.exp).toBe(0)
  })
})

describe('no active player', () => {
  it('every op returns no_active_player', () => {
    const manager = new GameManager()

    expect(manager.companionOps.pullCompanion()).toEqual({ ok: false, reason: 'no_active_player' })
    expect(manager.companionOps.exchangeCompanion('x')).toEqual({ ok: false, reason: 'no_active_player' })
    expect(manager.companionOps.feedCompanion('x', 'y', 1)).toEqual({ ok: false, reason: 'no_active_player' })
    expect(manager.companionOps.claimCompanionGift('x')).toEqual({ ok: false, reason: 'no_active_player' })
  })
})

// M-F-COMPANION-GIFT (A1/A2): empty pool is an explicit valid state -
// the ops gate on companionAcquirablePool() and reject BEFORE any
// currency check or debit, whether the pool is closed by the Beta flag
// or an enabled pool is authored empty.
describe('pull/exchange pool_unavailable gate', () => {
  it('pullCompanion rejects pool_unavailable with a token on hand; all three counters conserved', () => {
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 5)

    const result = manager.companionOps.pullCompanion()

    expect(result).toEqual({ ok: false, reason: 'pool_unavailable' })
    expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(5)
    expect(player.duyenPhan).toBe(0)
    expect(player.companionPullsSinceRare).toBe(0)
    expect(player.companions).toHaveLength(0)
    expect(manager.drainNotifications()).toHaveLength(0)
  })

  it('pool_unavailable precedes missing_token: a closed pool rejects even with no token', () => {
    const { manager } = makeManager()

    expect(manager.companionOps.pullCompanion()).toEqual({ ok: false, reason: 'pool_unavailable' })
  })

  it('an enabled-but-authored-empty pool rejects the same way (A2 second arm)', () => {
    authoredEmptyPool()
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 2)

    const result = manager.companionOps.pullCompanion()

    expect(result).toEqual({ ok: false, reason: 'pool_unavailable' })
    expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(2)
    expect(player.duyenPhan).toBe(0)
    expect(player.companionPullsSinceRare).toBe(0)
  })

  it('exchangeCompanion rejects pool_unavailable before its definition lookup', () => {
    const { manager, player } = makeManager()
    player.duyenPhan = 1000

    // Valid Beta id AND an unknown id both hit the pool gate first.
    expect(manager.companionOps.exchangeCompanion(BETA_COMPANIONS[0]!.id)).toEqual({
      ok: false,
      reason: 'pool_unavailable',
    })
    expect(manager.companionOps.exchangeCompanion('no_such_companion')).toEqual({
      ok: false,
      reason: 'pool_unavailable',
    })
    expect(player.duyenPhan).toBe(1000)
    expect(player.companions).toHaveLength(0)
  })

  it('the realm gate still precedes pool_unavailable (gate order: realm > pool > token)', () => {
    const { manager, player } = makeManager('qi_refining')
    manager.materialBag.add(PULL_TOKEN, 2)

    expect(manager.companionOps.pullCompanion()).toEqual({ ok: false, reason: 'realm_locked' })
    expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(2)
    expect(player.duyenPhan).toBe(0)
  })
})

// M-F-COMPANION-GIFT (A3/A4): the gift claim transaction - record
// lookup, one-way consume, pull-parity grant, single ops-owned loot
// notification, full idempotency.
describe('claimCompanionGift', () => {
  function giftRecord(
    definitionId = 'than_nong',
    claimed = false,
  ): { id: string; definitionId: string; claimed: boolean } {
    return { id: 'gift_test', definitionId, claimed }
  }

  it('rejects realm_locked below Truc Co without mutating the record', () => {
    const { manager, player } = makeManager('qi_refining')
    player.companionGifts.push(giftRecord())

    expect(manager.companionOps.claimCompanionGift('gift_test')).toEqual({
      ok: false,
      reason: 'realm_locked',
    })
    expect(player.companionGifts[0]!.claimed).toBe(false)
    expect(player.companions).toHaveLength(0)
  })

  it('rejects unknown_gift when no record carries the id', () => {
    const { manager } = makeManager()

    expect(manager.companionOps.claimCompanionGift('absent')).toEqual({
      ok: false,
      reason: 'unknown_gift',
    })
  })

  it('rejects unknown_gift when definitionId does not resolve in COMPANIONS', () => {
    const { manager, player } = makeManager()
    player.companionGifts.push(giftRecord('ghost_companion'))

    expect(manager.companionOps.claimCompanionGift('gift_test')).toEqual({
      ok: false,
      reason: 'unknown_gift',
    })
    expect(player.companionGifts[0]!.claimed).toBe(false)
  })

  it('rejects unknown_gift for a real catalog member outside the gift authority', () => {
    const { manager, player } = makeManager()
    player.companionGifts.push(giftRecord('ho_ly_tinh'))

    expect(manager.companionOps.claimCompanionGift('gift_test')).toEqual({
      ok: false,
      reason: 'unknown_gift',
    })
    expect(player.companionGifts[0]!.claimed).toBe(false)
    expect(player.companions).toHaveLength(0)
  })

  it('claims a pending record: fresh instance appended, claimed set, one loot notification', () => {
    const { manager, player } = makeManager()
    player.companionGifts.push(giftRecord('than_nong'))

    const result = manager.companionOps.claimCompanionGift('gift_test')

    if (!result.ok || result.alreadyClaimed) {
      throw new Error('expected a fresh successful claim')
    }
    expect(result.kind).toBe('new')
    expect(result.definition.id).toBe('than_nong')
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.definitionId).toBe('than_nong')
    expect(player.companions[0]!.constellationRank).toBe(0)
    expect(player.companionGifts[0]!.claimed).toBe(true)
    // Claims grant no loyalty duyenPhan - only the maxed-duplicate bonus.
    expect(result.duyenPhan).toBe(0)
    expect(player.duyenPhan).toBe(0)

    const notifications = manager.drainNotifications()
    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.kind).toBe('loot')
  })

  it('duplicate claim converts like a pull: owned companion ranks up in place', () => {
    const { manager, player } = makeManager()
    player.companions.push(ownedInstance({ definitionId: 'than_nong', constellationRank: 1 }))
    player.companionGifts.push(giftRecord('than_nong'))

    const result = manager.companionOps.claimCompanionGift('gift_test')

    if (!result.ok || result.alreadyClaimed) {
      throw new Error('expected a fresh successful claim')
    }
    expect(result.kind).toBe('constellation_up')
    expect(result.constellationRankAfter).toBe(2)
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.instanceId).toBe('inst-1')
    expect(player.companions[0]!.constellationRank).toBe(2)
    expect(player.companionGifts[0]!.claimed).toBe(true)
  })

  it('maxed duplicate converts to +5 Duyen Phan and still claims', () => {
    const { manager, player } = makeManager()
    player.companions.push(
      ownedInstance({ definitionId: 'than_nong', constellationRank: MAX_CONSTELLATION_RANK }),
    )
    player.companionGifts.push(giftRecord('than_nong'))

    const result = manager.companionOps.claimCompanionGift('gift_test')

    if (!result.ok || result.alreadyClaimed) {
      throw new Error('expected a fresh successful claim')
    }
    expect(result.kind).toBe('constellation_maxed')
    expect(result.duyenPhan).toBe(5)
    expect(player.duyenPhan).toBe(5)
    expect(player.companions[0]!.constellationRank).toBe(MAX_CONSTELLATION_RANK)
    expect(player.companionGifts[0]!.claimed).toBe(true)
  })

  it('re-claim is a pure no-op: alreadyClaimed result, zero state deltas, no notification', () => {
    const { manager, player } = makeManager()
    player.companionGifts.push(giftRecord('than_nong'))

    const first = manager.companionOps.claimCompanionGift('gift_test')
    if (!first.ok) throw new Error('first claim failed')
    const drained = manager.drainNotifications()
    expect(drained).toHaveLength(1)

    const second = manager.companionOps.claimCompanionGift('gift_test')
    expect(second).toEqual({
      ok: true,
      alreadyClaimed: true,
      definition: expect.objectContaining({ id: 'than_nong' }),
    })
    expect(player.companions).toHaveLength(1)
    expect(player.duyenPhan).toBe(0)
    expect(manager.drainNotifications()).toHaveLength(0)
  })
})
