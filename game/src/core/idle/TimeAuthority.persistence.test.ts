import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimeAuthority } from './TimeAuthority'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { buildGameSave } from '../../services/save/SaveSystem'
import { CloudSaveCoordinator } from '../../services/cloudSave/CloudSaveCoordinator'
import type { CloudSaveService, CloudSaveWriteResult } from '../../services/cloudSave/CloudSaveService'

afterEach(() => vi.useRealTimers())

describe('authorized time persistence', () => {
  it('stamps detached snapshots using elapsed authority despite wall edits', () => {
    vi.useFakeTimers()
    const epoch = Date.UTC(2026, 9, 12)
    vi.setSystemTime(epoch)
    let mono = 0
    const time = new TimeAuthority({ wallNow: () => epoch, monotonicNow: () => mono })
    const manager = new GameManager({ time })
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    mono = 1000
    vi.setSystemTime(epoch + 86_400_000)
    const save = buildGameSave(player, manager)
    expect(save.player.lastSavedAt).toBe(epoch + 1000)
    player.name = 'changed'
    expect(save.player.name).not.toBe(player.name)
  })

  it('carries only current-generation authenticated ACK time to callers', async () => {
    let resolveWrite!: (result: CloudSaveWriteResult) => void
    const service: CloudSaveService = {
      capability: 'remote-authoritative',
      load: async () => ({ status: 'empty', revision: 0 }),
      save: () => new Promise(resolve => { resolveWrite = resolve }),
    }
    const coordinator = new CloudSaveCoordinator(service)
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    const pending = coordinator.save(buildGameSave(player, manager))
    coordinator.reset()
    resolveWrite({ status: 'ok', revision: 1, serverNowMs: 2_000_000_000_000 })
    const result = await pending
    expect(result.status).toBe('ok')
    expect(result).not.toHaveProperty('serverNowMs')
    expect(coordinator.getRevision()).toBe(0)
    const current = coordinator.save(buildGameSave(player, manager))
    resolveWrite({ status: 'ok', revision: 1, serverNowMs: 2_000_000_000_001 })
    expect(await current).toMatchObject({ serverNowMs: 2_000_000_000_001 })
  })
})
