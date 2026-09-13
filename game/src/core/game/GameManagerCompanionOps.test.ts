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
import { COMPANIONS } from '../../data/companion/Companions'
import type { CompanionInstance } from '../../data/companion/Companions'
import { REALMS } from '../../data/realms/realm'
import { COMPANION_PULL_TOKEN_ID, EXCHANGE_COST } from './GameManagerCompanionOps'
import { MAX_CONSTELLATION_RANK } from '../companion/CompanionProgression'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'

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

const MORTAL_MAX_LEVEL = REALMS.find((realm) => realm.id === 'mortal')!.maxLevel

function makeManager(): { manager: GameManager; player: PlayerData } {
  const manager = new GameManager()
  const player = createDefaultPlayer()
  manager.setActivePlayer(player)
  return { manager, player }
}

// Math.random = 0 -> roll lands in the first pooled grade in GRADE_ORDER
// (hoang) and pickDefinitionOfGrade takes index 0 of the hoang pool, so
// every pull deterministically returns COMPANIONS[0] (roster order keeps
// the 4 hoang definitions first).
function mockPullsToFirstDefinition(): void {
  vi.spyOn(Math, 'random').mockReturnValue(0)
}

function ownedInstance(overrides: Partial<CompanionInstance> = {}): CompanionInstance {
  return {
    instanceId: 'inst-1',
    definitionId: COMPANIONS[0]!.id,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pullCompanion', () => {
  it('rejects without a token and preserves all balances', () => {
    const { manager, player } = makeManager()

    const result = manager.companionOps.pullCompanion()

    expect(result).toEqual({ ok: false, reason: 'missing_token' })
    expect(player.duyenPhan).toBe(0)
    expect(player.companions).toHaveLength(0)
    expect(player.companionPullsSinceRare).toBe(0)
  })

  it('spends one token, credits +1 Duyen Phan, and appends the new instance', () => {
    const { manager, player } = makeManager()
    manager.materialBag.add(PULL_TOKEN, 2)
    mockPullsToFirstDefinition()

    const result = manager.companionOps.pullCompanion()

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.outcome.kind).toBe('new')
    expect(result.outcome.definition.id).toBe(COMPANIONS[0]!.id)
    expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(1)
    expect(player.duyenPhan).toBe(1)
    expect(result.duyenPhan).toBe(1)
    // hoang < dia -> pity counter keeps counting.
    expect(player.companionPullsSinceRare).toBe(1)
    expect(result.pullsSinceRare).toBe(1)
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.definitionId).toBe(COMPANIONS[0]!.id)
    expect(player.companions[0]!.constellationRank).toBe(0)
  })

  it('duplicate pull raises constellation rank in place and still credits +1 Duyen Phan', () => {
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
})

describe('exchangeCompanion', () => {
  it('rejects an unknown definition', () => {
    const { manager, player } = makeManager()
    player.duyenPhan = 1000

    const result = manager.companionOps.exchangeCompanion('no_such_companion')

    expect(result).toEqual({ ok: false, reason: 'unknown_definition' })
    expect(player.duyenPhan).toBe(1000)
  })

  it('rejects on insufficient Duyen Phan without deducting anything', () => {
    const { manager, player } = makeManager()
    player.duyenPhan = EXCHANGE_COST.hoang - 1

    const result = manager.companionOps.exchangeCompanion(COMPANIONS[0]!.id)

    expect(result).toEqual({ ok: false, reason: 'insufficient_duyen_phan' })
    expect(player.duyenPhan).toBe(EXCHANGE_COST.hoang - 1)
    expect(player.companions).toHaveLength(0)
  })

  it('pushes a fresh instance for an unowned companion', () => {
    const { manager, player } = makeManager()
    player.duyenPhan = EXCHANGE_COST.hoang

    const result = manager.companionOps.exchangeCompanion(COMPANIONS[0]!.id)

    if (!result.ok) {
      throw new Error(`expected ok, got ${result.reason}`)
    }

    expect(result.kind).toBe('new')
    expect(result.definition.id).toBe(COMPANIONS[0]!.id)
    expect(result.duyenPhan).toBe(0)
    expect(player.companions).toHaveLength(1)
    expect(player.companions[0]!.definitionId).toBe(COMPANIONS[0]!.id)
    expect(player.companions[0]!.realmId).toBe('mortal')
    expect(player.companions[0]!.realmLevel).toBe(1)
    expect(player.companions[0]!.constellationRank).toBe(0)
  })

  it('raises constellation rank in place for an owned companion below C6', () => {
    const { manager, player } = makeManager()
    player.duyenPhan = EXCHANGE_COST.hoang + 7
    player.companions.push(ownedInstance({ constellationRank: 1 }))

    const result = manager.companionOps.exchangeCompanion(COMPANIONS[0]!.id)

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
    const { manager, player } = makeManager()
    // 0 DP on purpose: the constellation_maxed gate runs first.
    player.companions.push(ownedInstance({ constellationRank: MAX_CONSTELLATION_RANK }))

    const result = manager.companionOps.exchangeCompanion(COMPANIONS[0]!.id)

    expect(result).toEqual({ ok: false, reason: 'constellation_maxed' })
    expect(player.duyenPhan).toBe(0)
    expect(player.companions[0]!.constellationRank).toBe(MAX_CONSTELLATION_RANK)
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
    // Player is mortal; a mortal companion at realm maxLevel is capped.
    player.companions.push(ownedInstance({ realmLevel: MORTAL_MAX_LEVEL }))

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
})

describe('no active player', () => {
  it('every op returns no_active_player', () => {
    const manager = new GameManager()

    expect(manager.companionOps.pullCompanion()).toEqual({ ok: false, reason: 'no_active_player' })
    expect(manager.companionOps.exchangeCompanion('x')).toEqual({ ok: false, reason: 'no_active_player' })
    expect(manager.companionOps.feedCompanion('x', 'y', 1)).toEqual({ ok: false, reason: 'no_active_player' })
  })
})
