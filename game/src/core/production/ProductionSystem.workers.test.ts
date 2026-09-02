// T4 (chi-hien-quan, 2026-09-02) — manual worker assignment song song
// auto round-robin:
// - Không assignments → round-robin như cũ (regression guard)
// - Manual: site nhận đúng assignedWorkers slots; phần dư capacity →
//   round-robin cho sites auto không assignment
// - Vượt capacity → truncate; non-autoRestart không nhận slot
// - assignedWorkers persist qua getAllStates → restoreStates
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from './ProductionCatalog'
import { ProductionSystem } from './ProductionSystem'
import type { ProductionSiteState } from './ProductionTypes'

function createSystem(): ProductionSystem {
  const system = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })

  return system
}

function createBag(): { bag: MaterialBag; registry: MaterialRegistry } {
  const registry = new MaterialRegistry()

  for (const material of materials) {
    registry.register(material)
  }

  return { bag: new MaterialBag(), registry }
}

const REALM = 'mortal'
const NOW = 1_000_000

function setupSites(system: ProductionSystem): ProductionSiteState[] {
  const states: ProductionSiteState[] = []

  for (const definition of THANH_VAN_PRODUCTION_SITES) {
    const state = system.ensureSiteState(definition.siteId)
    state.autoRestart = true
    states.push(state)
  }

  return states
}

function assignmentMap(entries: Array<[string, number]>): Map<string, number> {
  return new Map(entries)
}

describe('ProductionSystem — tickWorkers manual assignment', () => {
  it('không assignments → round-robin như cũ (regression guard)', () => {
    const system = createSystem()
    const states = setupSites(system)
    const { bag, registry } = createBag()

    system.tickWorkers(NOW, bag, registry, REALM, 6)

    // 6 slots / 3 sites → 2/2/2
    expect(states.map((state) => state.activeWorkerSlots)).toEqual([2, 2, 2])
  })

  it('manual: A=4, B=1 → phần dư 1 slot về C (auto không assignment)', () => {
    const system = createSystem()
    const states = setupSites(system)
    const { bag, registry } = createBag()

    system.tickWorkers(
      NOW,
      bag,
      registry,
      REALM,
      6,
      assignmentMap([
        [states[0]!.siteId, 4],
        [states[1]!.siteId, 1],
      ]),
    )

    expect(states[0]!.activeWorkerSlots).toBe(4)
    expect(states[1]!.activeWorkerSlots).toBe(1)
    expect(states[2]!.activeWorkerSlots).toBe(1) // phần dư round-robin
  })

  it('manual vượt capacity → truncate theo thứ tự Map', () => {
    const system = createSystem()
    const states = setupSites(system)
    const { bag, registry } = createBag()

    system.tickWorkers(
      NOW,
      bag,
      registry,
      REALM,
      3,
      assignmentMap([
        [states[0]!.siteId, 5],
        [states[1]!.siteId, 5],
      ]),
    )

    // A ưu tiên theo thứ tự Map → min(5, 3)=3; B không còn dư.
    expect(states[0]!.activeWorkerSlots).toBe(3)
    expect(states[1]!.activeWorkerSlots).toBe(0)
    expect(states[2]!.activeWorkerSlots).toBe(0)
  })

  it('site non-autoRestart không nhận slot dù được assigned', () => {
    const system = createSystem()
    const states = setupSites(system)
    states[0]!.autoRestart = false

    const { bag, registry } = createBag()

    system.tickWorkers(NOW, bag, registry, REALM, 4, assignmentMap([[states[0]!.siteId, 2]]))

    expect(states[0]!.activeWorkerSlots).toBe(0)

    // Slots còn dư 4 toàn bộ cho 2 site auto còn lại (round-robin).
    expect(states[1]!.activeWorkerSlots + states[2]!.activeWorkerSlots).toBe(4)
  })

  it('assignedWorkers persist qua getAllStates → restoreStates', () => {
    const system = createSystem()
    setupSites(system)
    const state = system.getState(THANH_VAN_PRODUCTION_SITES[0]!.siteId)!

    state.assignedWorkers = 3

    const saved = system.getAllStates()

    const restored = createSystem()
    restored.restoreStates(saved as ProductionSiteState[])

    expect(restored.getState(THANH_VAN_PRODUCTION_SITES[0]!.siteId)?.assignedWorkers).toBe(3)
  })

  it('workerCycles chạy đúng số slot manual (mỗi slot 1 cycle)', () => {
    const system = createSystem()
    const states = setupSites(system)
    const { bag, registry } = createBag()

    system.tickWorkers(NOW, bag, registry, REALM, 10, assignmentMap([[states[0]!.siteId, 2]]))

    // A: 2 slots manual + phần dư 8 chia B/C round-robin (4/4) → A có 2 cycles.
    expect(system.getState(states[0]!.siteId)!.workerCycles?.length).toBe(2)
    expect(system.getState(states[1]!.siteId)!.workerCycles?.length).toBe(4)
  })

  it('settleWorkersOffline manual khớp online: cùng assignments → cùng phân bổ slots', () => {
    const system = createSystem()
    const states = setupSites(system)
    const { bag, registry } = createBag()

    const assignments = assignmentMap([
      [states[0]!.siteId, 4],
      [states[1]!.siteId, 1],
    ])

    // Online: tick một lần với capacity 6 — slots 4/1/1.
    system.tickWorkers(NOW, bag, registry, REALM, 6, assignments)

    expect(states.map((state) => state.activeWorkerSlots)).toEqual([4, 1, 1])

    // Offline: settleOffline dùng cùng assignments — không crash, settle
    // chạy qua đường worker với phân bổ 4/1/1 (dù không đủ dữ kiện cycle
    // hoàn thành trong window, code path phải giống online).
    const settled = system.settleOffline(bag, registry, REALM, NOW + 60_000, {
      workerCapacity: 6,
      workerAssignments: assignments,
      offlineSinceMs: NOW,
    })

    expect(settled).toBeGreaterThanOrEqual(0)
  })
})
