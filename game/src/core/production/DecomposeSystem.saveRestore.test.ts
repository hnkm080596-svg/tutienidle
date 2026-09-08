// R7 (AR-08) - DecomposeSystem persistence + offline settle.
// Processing state (settings + cycle timer) joins GameSave; restore
// clamps to live capacity; a repeated settle over the same window
// must not double-award (A3 restore semantics).
import { describe, expect, it } from 'vitest'
import { DecomposeSystem } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { PRODUCTION_OFFLINE_CAP_SECONDS } from './ProductionBalance'

function makeSystem(cycleSeconds = 30) {
  const bag = new MaterialBag()
  const system = new DecomposeSystem(bag, { cycleSeconds })
  return { system, bag }
}

function addOre(bag: MaterialBag, id: string, amount: number): void {
  const material = materials.find((entry) => entry.id === id)
  if (!material) {
    throw new Error(`materials fixture missing ${id}`)
  }
  bag.add(material, amount)
}

describe('DecomposeSystem save/restore (AR-08)', () => {
  it('save state round-trips settings and cycle timer', () => {
    const { system } = makeSystem()
    system.updateCapacity(4)
    system.setSetting({ workers: 3, gradeFilter: 'all', ageFilter: 'decade' })
    system.tick(1_000)

    const snapshot = structuredClone(system.getSaveState())

    const fresh = makeSystem()
    fresh.system.updateCapacity(4)
    fresh.system.restore(snapshot)

    expect(fresh.system.getSettings()).toEqual(system.getSettings())
    expect(fresh.system.getSaveState().nextCycleAt).toBe(snapshot.nextCycleAt)
    expect(fresh.system.getSaveState().started).toBe(true)
  })

  it('restore clamps workers to the CURRENT capacity (stale-save safety)', () => {
    const { system } = makeSystem()
    system.updateCapacity(6)
    system.setSetting({ workers: 6 })
    const snapshot = structuredClone(system.getSaveState())

    const stale = makeSystem()
    stale.system.updateCapacity(2)
    stale.system.restore(snapshot)
    expect(stale.system.getSettings().workers).toBe(2)
  })

  it('restore with undefined keeps defaults (old saves without the slice)', () => {
    const { system } = makeSystem()
    expect(() => system.restore(undefined)).not.toThrow()
    expect(system.getSettings().workers).toBe(0)
    expect(system.getSettings().gradeFilter).toBe('all')
  })
})

describe('DecomposeSystem offline settle (AR-08)', () => {
  it('settles cycles completed inside the offline window, once', () => {
    const { system, bag } = makeSystem()
    addOre(bag, 'mortal_ore_decade', 1000)
    system.updateCapacity(2)
    system.setSetting({ workers: 2 })
    system.tick(1_000) // starts the timer; first cycle at 31_000

    const now = 1_000 + 120_000 // two 30s cycles elapsed
    const settledFirst = system.settleOffline(now, 1_000)
    const drainedFirst = system.drainOutput().reduce((s, e) => s + e.amount, 0)
    expect(settledFirst).toBeGreaterThanOrEqual(1)
    expect(drainedFirst).toBeGreaterThan(0)
    // Ore was actually consumed.
    const oreLeft = bag.getAll().reduce((s, stack) => s + stack.amount, 0)
    expect(oreLeft).toBeLessThan(1000)

    // Repeat settle over the SAME window must not double-award.
    const settledAgain = system.settleOffline(now, 1_000)
    const drainedAgain = system.drainOutput().reduce((s, e) => s + e.amount, 0)
    expect(settledAgain).toBe(0)
    expect(drainedAgain).toBe(0)
  })

  it('does not settle cycles beyond the offline cap window', () => {
    const { system, bag } = makeSystem()
    addOre(bag, 'mortal_ore_decade', 1_000_000)
    system.updateCapacity(1)
    system.setSetting({ workers: 1 })
    system.tick(0)

    // "Offline" for 100 hours - the settle window is capped at
    // PRODUCTION_OFFLINE_CAP_SECONDS, so settled cycles are bounded.
    const offlineMs = 100 * 3600_000
    const settled = system.settleOffline(offlineMs, 0)
    const capCycles = Math.floor((PRODUCTION_OFFLINE_CAP_SECONDS * 1000) / 30_000)
    expect(settled).toBeLessThanOrEqual(capCycles)
    expect(settled).toBeGreaterThan(0)
  })

  it('workers 0 -> offline settle is a no-op', () => {
    const { system } = makeSystem()
    system.updateCapacity(4)
    system.setSetting({ workers: 0 })
    system.tick(0)
    expect(system.settleOffline(60_000, 0)).toBe(0)
    expect(system.drainOutput()).toEqual([])
  })

  it('output respects ore stock - dry cycles produce no output', () => {
    const { system, bag } = makeSystem()
    addOre(bag, 'mortal_ore_decade', 4) // exactly one cycle of 2 workers
    system.updateCapacity(2)
    system.setSetting({ workers: 2 })
    system.tick(0)

    const settled = system.settleOffline(120_000, 0)
    // Cycles tick as their deadlines pass (same as the online engine);
    // only the ore-backed one produces output.
    expect(settled).toBe(4)
    const output = system.drainOutput()
    expect(output).toHaveLength(1)
    expect(output[0]!.materialId).toBe(LUYEN_KHI_TINH_HOA_ID)
  })
})
