import { describe, it, expect, vi } from 'vitest'
import { HiddenBeastSystem } from './HiddenBeastSystem'
import {
  hiddenBeastChannels,
  type HiddenBeastChannel,
} from '../../data/drop/HiddenMaterialChannels'
import { createDefaultPlayer, type PlayerData } from '../player/Player'

function luyenKhiPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  return player
}

function fixtureChannel(overrides: Partial<HiddenBeastChannel> = {}): HiddenBeastChannel {
  return {
    kind: 'hidden_beast',
    id: 'fixture_beast',
    bandRealmId: 'qi_refining',
    enemyId: 'fixture_enemy',
    killThreshold: 10,
    spawnChancePerSpawn: 0.5,
    ...overrides,
  }
}

function channelSystem(
  channels: readonly HiddenBeastChannel[],
  getEnemyTemplate: (id: string) => unknown = (id) => ({ id }),
): HiddenBeastSystem {
  return new HiddenBeastSystem({
    getEnemyTemplate: getEnemyTemplate as (id: string) => never,
    channels,
  })
}

// Template stub - system chi can object co id la du de test logic window.
const HUYET_MONG = hiddenBeastChannels()[0]!
const system = channelSystem(hiddenBeastChannels())

describe('HiddenBeastSystem - channel-driven spawn substitution (m-f-body-hidden sec.3)', () => {
  it('shipped registry parity: 999 kill cua so DONG; 1000 kill MO', () => {
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { huyet_mong: HUYET_MONG.killThreshold - 1 }
    expect(system.isWindowOpen(player, HUYET_MONG)).toBe(false)
    player.hiddenBeastKills = { huyet_mong: HUYET_MONG.killThreshold }
    expect(system.isWindowOpen(player, HUYET_MONG)).toBe(true)
  })

  it('giet quai an cua channel -> reset chi channel do', () => {
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { huyet_mong: HUYET_MONG.killThreshold + 50 }
    system.onEnemyDefeated(player, 'huyet_mong', 'qi_refining')
    expect(player.hiddenBeastKills.huyet_mong).toBe(0)
  })

  it('giet quai THUONG trong band: dem tiep tuc tang (KHONG reset)', () => {
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { huyet_mong: HUYET_MONG.killThreshold }
    system.onEnemyDefeated(player, 'pool_toad', 'qi_refining')
    expect(player.hiddenBeastKills.huyet_mong).toBe(HUYET_MONG.killThreshold + 1)
  })

  it('khong phai quai trong band cua channel nao: dem khong doi', () => {
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { huyet_mong: 500 }
    system.onEnemyDefeated(player, 'foundation_stone_fungus', 'foundation_establishment')
    expect(player.hiddenBeastKills.huyet_mong).toBe(500)
  })

  it('maybeReplaceSpawn: window DONG -> undefined; window MO + roll trung -> template channel enemy', () => {
    const closed = luyenKhiPlayer()
    expect(system.maybeReplaceSpawn(closed, 'qi_refining')).toBeUndefined()

    // Deps controlled-roll. Math.random is PINNED (same discipline as
    // CombatSystem.skillScaling.test.ts, fd22f2b6): the old unpinned loop
    // "accepted real binomial variance" on 100 rolls of 5% -> ~0.59% chance
    // of zero hits per run, which surfaced as a full-suite flake. The pinned
    // sequence hits on every 20th roll -> exactly 5 hits in 100 rolls,
    // deterministically inside the (0, 20) bound below.
    const open = luyenKhiPlayer()
    open.hiddenBeastKills = { huyet_mong: HUYET_MONG.killThreshold }
    let rollIndex = 0
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => (rollIndex++ % 20 === 0 ? 0.01 : 0.99))
    let sawBeast = 0
    for (let i = 0; i < 100; i++) {
      const replaced = system.maybeReplaceSpawn(open, 'qi_refining')
      if (replaced?.id === 'huyet_mong') sawBeast++
    }
    randomSpy.mockRestore()

    expect(sawBeast).toBeGreaterThan(0)
    expect(sawBeast).toBeLessThan(20)
  })

  it('maybeReplaceSpawn ngoai band cua channel -> undefined', () => {
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { huyet_mong: HUYET_MONG.killThreshold }
    expect(system.maybeReplaceSpawn(player, 'foundation_establishment')).toBeUndefined()
  })

  it('SYMMETRIC multi-channel kill semantics: giet beast cua A reset A VA tang B; giet beast cua B reset B VA tang A', () => {
    const channelA = fixtureChannel({ id: 'beast_a', enemyId: 'enemy_a' })
    const channelB = fixtureChannel({ id: 'beast_b', enemyId: 'enemy_b' })
    const multi = channelSystem([channelA, channelB])
    const player = luyenKhiPlayer()

    player.hiddenBeastKills = { beast_a: 5, beast_b: 7 }
    multi.onEnemyDefeated(player, 'enemy_a', 'qi_refining')
    expect(player.hiddenBeastKills.beast_a).toBe(0)
    expect(player.hiddenBeastKills.beast_b).toBe(8)

    player.hiddenBeastKills = { beast_a: 3, beast_b: 9 }
    multi.onEnemyDefeated(player, 'enemy_b', 'qi_refining')
    expect(player.hiddenBeastKills.beast_a).toBe(4)
    expect(player.hiddenBeastKills.beast_b).toBe(0)
  })

  it('hai channel cung band: authored order quyet dinh; channel sau chi roll khi channel truoc khong trung', () => {
    const channelA = fixtureChannel({ id: 'beast_a', enemyId: 'enemy_a', spawnChancePerSpawn: 0 })
    const channelB = fixtureChannel({ id: 'beast_b', enemyId: 'enemy_b', spawnChancePerSpawn: 1 })
    const multi = channelSystem([channelA, channelB])
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { beast_a: 10, beast_b: 10 }

    // A rolls 0% (misses even though window open), B's 100% wins.
    expect(multi.maybeReplaceSpawn(player, 'qi_refining', () => 0.5)?.id).toBe('enemy_b')

    const firstWins = channelSystem([
      fixtureChannel({ id: 'beast_a', enemyId: 'enemy_a', spawnChancePerSpawn: 1 }),
      channelB,
    ])
    expect(firstWins.maybeReplaceSpawn(player, 'qi_refining', () => 0.5)?.id).toBe('enemy_a')
  })

  it('guaranteedSpawnAfterKills: dat bound -> thay the KHONG can roll (bound khong tieu thu rng)', () => {
    const boundChannel = fixtureChannel({
      id: 'bound_beast',
      enemyId: 'bound_enemy',
      killThreshold: 10,
      spawnChancePerSpawn: 0,
      guaranteedSpawnAfterKills: 25,
    })
    const bound = channelSystem([boundChannel])
    const player = luyenKhiPlayer()

    player.hiddenBeastKills = { bound_beast: 24 }
    expect(bound.maybeReplaceSpawn(player, 'qi_refining', () => 0.999)).toBeUndefined()

    player.hiddenBeastKills = { bound_beast: 25 }
    const rngSpy = vi.fn(() => 0.999)
    expect(bound.maybeReplaceSpawn(player, 'qi_refining', rngSpy)?.id).toBe('bound_enemy')
    expect(rngSpy).not.toHaveBeenCalled()
  })

  it('band ngoai release ceiling -> khong bao gio thay the (isRealmAvailable dormancy)', () => {
    const dormant = channelSystem([
      fixtureChannel({
        id: 'dormant_beast',
        bandRealmId: 'nascent_soul',
        enemyId: 'dormant_enemy',
        killThreshold: 1,
        spawnChancePerSpawn: 1,
      }),
    ])
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { dormant_beast: 100 }

    expect(dormant.maybeReplaceSpawn(player, 'nascent_soul', () => 0)).toBeUndefined()
  })

  it('channel enemy khong resolve duoc -> bo qua an toan, thu channel sau', () => {
    const broken = channelSystem(
      [
        fixtureChannel({ id: 'missing_beast', enemyId: 'missing_enemy', spawnChancePerSpawn: 1 }),
        fixtureChannel({ id: 'beast_b', enemyId: 'enemy_b', spawnChancePerSpawn: 1 }),
      ],
      (id) => (id === 'enemy_b' ? { id } : undefined),
    )
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { missing_beast: 10, beast_b: 10 }

    expect(broken.maybeReplaceSpawn(player, 'qi_refining', () => 0.5)?.id).toBe('enemy_b')
  })
})

describe('HiddenBeastSystem - band-less stage never attracts a hidden beast (F-W-12)', () => {
  it('stageRealmId undefined: window open + guaranteed bound -> still undefined', () => {
    const channel = fixtureChannel({
      guaranteedSpawnAfterKills: 0,
      spawnChancePerSpawn: 1,
    })
    const system = channelSystem([channel])
    const player = luyenKhiPlayer()
    player.hiddenBeastKills = { [channel.id]: channel.killThreshold + 100 }

    expect(system.isWindowOpen(player, channel)).toBe(true)
    expect(system.maybeReplaceSpawn(player, undefined)).toBeUndefined()
    expect(system.maybeReplaceSpawn(player, channel.bandRealmId)).toEqual({ id: channel.enemyId })
  })
})
