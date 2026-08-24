import { describe, expect, it } from 'vitest'
import type { GameSave } from '../save/SaveSystem'
import type { CloudSaveLoadResult, CloudSaveService, CloudSaveWriteResult } from './CloudSaveService'
import { CloudSaveCoordinator } from './CloudSaveCoordinator'

const snapshot = {} as GameSave

function mockService(
  loadResults: Array<() => CloudSaveLoadResult>,
  saveResults: Array<(expectedRevision: number) => CloudSaveWriteResult>,
): { service: CloudSaveService; writes: number[] } {
  const writes: number[] = []
  let loadIndex = 0
  let saveIndex = 0
  const service: CloudSaveService = {
    async load() {
      const next = loadResults[Math.min(loadIndex, loadResults.length - 1)]!
      loadIndex += 1
      return next()
    },
    async save(_save, expectedRevision) {
      writes.push(expectedRevision)
      const next = saveResults[Math.min(saveIndex, saveResults.length - 1)]!
      saveIndex += 1
      return next(expectedRevision)
    },
  }
  return { service, writes }
}

describe('CloudSaveCoordinator', () => {
  it('uses loaded revision for the next write and advances after success', async () => {
    const writes: number[] = []
    const service: CloudSaveService = {
      async load() { return { status: 'ok', save: snapshot, revision: 4 } },
      async save(_save, expectedRevision) { writes.push(expectedRevision); return { status: 'ok', revision: 5 } },
    }
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    expect(await coordinator.save(snapshot)).toEqual({ status: 'ok', revision: 5 })
    expect(writes).toEqual([4])
    expect(coordinator.getRevision()).toBe(5)
  })

  // Fix (2026-08-24) — conflict không còn terminal: coordinator re-sync
  // revision mới nhất rồi retry đúng một lần.
  it('recovers from conflict by re-syncing the latest revision and retrying once', async () => {
    const { service, writes } = mockService(
      [
        () => ({ status: 'ok', save: snapshot, revision: 4 }),
        () => ({ status: 'empty', revision: 0 }),
      ],
      [
        () => ({ status: 'conflict', currentRevision: 9 }),
        expected => ({ status: 'ok', revision: expected + 1 }),
      ],
    )
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const result = await coordinator.save(snapshot)

    expect(result).toEqual({ status: 'ok', revision: 1, recoveredFromConflict: true })
    expect(writes).toEqual([4, 0])
    expect(coordinator.getRevision()).toBe(1)
  })

  it('keeps the conflict result when re-sync cannot read storage, but stays recoverable', async () => {
    const { service, writes } = mockService(
      [
        () => ({ status: 'ok', save: snapshot, revision: 4 }),
        () => ({ status: 'unavailable', message: 'storage broken', retryable: false }),
      ],
      [() => ({ status: 'conflict', currentRevision: 9 })],
    )
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const result = await coordinator.save(snapshot)

    expect(result).toEqual({ status: 'conflict', currentRevision: 9 })
    expect(writes).toEqual([4])
    expect(coordinator.getRevision()).toBe(4)
  })

  it('surfaces a repeated conflict after a failed retry but keeps the fresh revision', async () => {
    const { service, writes } = mockService(
      [
        () => ({ status: 'ok', save: snapshot, revision: 4 }),
        () => ({ status: 'empty', revision: 0 }),
      ],
      [() => ({ status: 'conflict', currentRevision: 9 })],
    )
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const result = await coordinator.save(snapshot)

    expect(result.status).toBe('conflict')
    expect(writes).toEqual([4, 0])
    // Revision đã được nạp lại từ storage — autosave kế tiếp sẽ dùng giá trị đúng.
    expect(coordinator.getRevision()).toBe(0)
  })

  it('reset() starts a fresh revision chain for a new character', async () => {
    const { service, writes } = mockService(
      [() => ({ status: 'ok', save: snapshot, revision: 7 })],
      [expected => ({ status: 'ok', revision: expected + 1 })],
    )
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    await coordinator.save(snapshot)
    expect(coordinator.getRevision()).toBe(8)

    coordinator.reset()
    expect(coordinator.getRevision()).toBe(0)

    await coordinator.save(snapshot)
    expect(writes).toEqual([7, 0])
  })
})
