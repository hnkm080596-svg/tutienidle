import { describe, expect, it } from 'vitest'
import { StageManager, type StageLease } from './StageManager'
import type { Stage } from './Stage'

// Mission C audit C4/C5 — the single stage slot is a capability, not
// ambient state: acquire() returns an opaque StageLease token and only
// that exact minted object can release the slot. getActive() hands out a
// read-only SNAPSHOT that is deliberately NOT the token — an
// observational read must never recover release capability for a slot
// someone else owns.

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
    expect(manager.owns(lease)).toBe(true)
    expect(manager.acquire(STAGE_B)).toBeNull()
  })

  it('getActive returns a snapshot — observational state, never the capability token', () => {
    const manager = new StageManager()
    const lease = manager.acquire(STAGE_A)!

    const snapshot = manager.getActive()!

    expect(snapshot.stageId).toBe(STAGE_A.id)
    expect(snapshot.spawnedCount).toBe(1)
    // The snapshot is a different object from the minted token: holding
    // it grants read access only, never ownership.
    expect(snapshot).not.toBe(lease)
    expect(manager.owns(snapshot as unknown as StageLease)).toBe(false)
  })

  it('the observational snapshot cannot release the owner\'s slot (C5)', () => {
    const manager = new StageManager()
    const lease = manager.acquire(STAGE_A)!

    // release(snapshot) is a compile-time error (the snapshot lacks the
    // lease brand); even forced through a cast it is not the minted
    // object, so runtime identity still refuses it.
    const snapshot = manager.getActive()!
    expect(manager.release(snapshot as unknown as StageLease)).toBe(false)

    expect(manager.owns(lease)).toBe(true)
    expect(manager.getActive()?.stageId).toBe(STAGE_A.id)
  })

  it('mutating a returned snapshot cannot corrupt the held record', () => {
    const manager = new StageManager()
    manager.acquire(STAGE_A)

    const snapshot = manager.getActive()!
    ;(snapshot as { spawnedCount: number }).spawnedCount = -999

    expect(manager.getActive()?.spawnedCount).toBe(1)
  })

  it('a forged token literal cannot release the slot — identity, not shape', () => {
    const manager = new StageManager()
    const lease = manager.acquire(STAGE_A)!

    const forged = { stageId: STAGE_A.id } as unknown as StageLease
    expect(manager.release(forged)).toBe(false)
    expect(manager.owns(lease)).toBe(true)
  })

  it('release(foreignToken) is a no-op — the real owner keeps the slot', () => {
    const manager = new StageManager()
    const other = new StageManager()

    const mine = manager.acquire(STAGE_A)!
    const foreign = other.acquire(STAGE_B)!

    expect(manager.release(foreign)).toBe(false)
    expect(manager.owns(mine)).toBe(true)
  })

  it('release(owner) frees the slot; the dead token cannot release again', () => {
    const manager = new StageManager()
    const lease = manager.acquire(STAGE_A)!

    expect(manager.release(lease)).toBe(true)
    expect(manager.getActive()).toBeNull()
    expect(manager.owns(lease)).toBe(false)
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
    expect(manager.owns(second)).toBe(true)
    expect(manager.getActive()?.stageId).toBe(STAGE_B.id)
  })

  it('release(null) is a safe no-op', () => {
    const manager = new StageManager()
    const lease = manager.acquire(STAGE_A)!

    expect(manager.release(null)).toBe(false)
    expect(manager.owns(lease)).toBe(true)
  })
})
