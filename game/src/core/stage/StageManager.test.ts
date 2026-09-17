import { describe, expect, it } from 'vitest'
import { StageManager } from './StageManager'
import type { Stage } from './Stage'

// Mission C audit C4 — the single stage slot is a capability, not ambient
// state: acquire() returns the lease object that IS the ownership token,
// and only that exact object can release the slot. A stale or foreign
// token must be a no-op, never a stomp.

const STAGE_A: Stage = {
  id: 'lease_a', name: 'Lease A', description: '', floor: 1,
  enemyPool: [], totalEnemyCount: 1, waves: [1], spawnIntervalSeconds: 1,
}
const STAGE_B: Stage = { ...STAGE_A, id: 'lease_b' }

describe('StageManager — capability lease', () => {
  it('acquire returns the lease token; a second acquire is refused while held', () => {
    const manager = new StageManager()

    const lease = manager.acquire(STAGE_A)

    expect(lease).not.toBeNull()
    expect(lease?.stageId).toBe(STAGE_A.id)
    expect(manager.get()).toBe(lease)
    expect(manager.acquire(STAGE_B)).toBeNull()
  })

  it('release(foreignToken) is a no-op — the real owner keeps the slot', () => {
    const manager = new StageManager()
    const other = new StageManager()

    const mine = manager.acquire(STAGE_A)!
    const foreign = other.acquire(STAGE_B)!

    expect(manager.release(foreign)).toBe(false)
    expect(manager.get()).toBe(mine)
  })

  it('release(owner) frees the slot; the dead token cannot release again', () => {
    const manager = new StageManager()
    const lease = manager.acquire(STAGE_A)!

    expect(manager.release(lease)).toBe(true)
    expect(manager.get()).toBeNull()
    // Stale token: the object is no longer the active lease.
    expect(manager.release(lease)).toBe(false)
  })

  it('a new owner after release is a different token — the old one stays dead', () => {
    const manager = new StageManager()
    const first = manager.acquire(STAGE_A)!
    manager.release(first)

    const second = manager.acquire(STAGE_B)!

    // The first lease can no longer interfere with the new owner.
    expect(manager.release(first)).toBe(false)
    expect(manager.get()).toBe(second)
  })

  it('release(null) is a safe no-op', () => {
    const manager = new StageManager()
    const lease = manager.acquire(STAGE_A)!

    expect(manager.release(null)).toBe(false)
    expect(manager.get()).toBe(lease)
  })
})
