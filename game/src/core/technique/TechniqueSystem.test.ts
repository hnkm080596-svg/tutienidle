import { describe, expect, it, vi } from 'vitest'
import type { Technique } from './Technique'
import { TechniqueManager } from './TechniqueManager'
import { TechniqueSystem } from './TechniqueSystem'

const FIVE_ELEMENTS: Technique = {
  id: 'five_elements_art',
  name: 'Tiểu Ngũ Hành Quyết',
  description: 'test',
  grade: 1,
  rank: 0,
  mastery: 0,
  quality: 'hoang',
  gradeHistory: {},
}

const DAO_INSIGHT: Technique = {
  ...FIVE_ELEMENTS,
  id: 'dao_insight_art',
  name: 'Ngộ Đạo Chân Quyết',
}

function makeSystem() {
  const manager = new TechniqueManager()
  return { manager, system: new TechniqueSystem(manager) }
}

describe('TechniqueManager (0-or-1)', () => {
  it('starts empty and exposes getActive/get/has/getAll', () => {
    const { manager } = makeSystem()
    expect(manager.getActive()).toBeUndefined()
    expect(manager.get('x')).toBeUndefined()
    expect(manager.has('x')).toBe(false)
    expect(manager.getAll()).toEqual([])
  })

  it('setActive stores a single technique; getAll returns a copy', () => {
    const { manager } = makeSystem()
    manager.setActive({ ...FIVE_ELEMENTS })
    expect(manager.getActive()?.id).toBe('five_elements_art')
    expect(manager.get('five_elements_art')?.id).toBe('five_elements_art')
    expect(manager.get('other')).toBeUndefined()
    expect(manager.has('five_elements_art')).toBe(true)
    const all = manager.getAll()
    expect(all).toHaveLength(1)
    all[0]!.mastery = 999
    expect(manager.getActive()!.mastery).toBe(0)
  })

  it('setActive(null) clears the holder', () => {
    const { manager } = makeSystem()
    manager.setActive({ ...FIVE_ELEMENTS })
    manager.setActive(null)
    expect(manager.getActive()).toBeUndefined()
  })

  it('restore keeps at most the first entry and detaches input', () => {
    const { manager } = makeSystem()
    const entry = { ...FIVE_ELEMENTS, mastery: 42 }
    manager.restore([entry, { ...DAO_INSIGHT }])
    expect(manager.getActive()?.id).toBe('five_elements_art')
    expect(manager.getAll()).toHaveLength(1)
    entry.mastery = 0
    expect(manager.getActive()!.mastery).toBe(42)
  })
})

describe('TechniqueSystem.grant', () => {
  it('grants into an empty holder with template progression defaults', () => {
    const { manager, system } = makeSystem()
    expect(system.grant({ ...FIVE_ELEMENTS, grade: 1, rank: 3, mastery: 50 }, 'qi_refining')).toBe(true)
    const active = manager.getActive()!
    expect(active.id).toBe('five_elements_art')
    expect(active.grade).toBe(1)
    expect(active.rank).toBe(0)
    expect(active.mastery).toBe(0)
    expect(active.quality).toBe('hoang')
    expect(active.gradeHistory).toEqual({})
  })

  it('detaches the granted instance from the template', () => {
    const { manager, system } = makeSystem()
    const template = { ...FIVE_ELEMENTS }
    system.grant(template, 'qi_refining')
    template.mastery = 999
    expect(manager.getActive()!.mastery).toBe(0)
  })

  it('is a defensive noop when the same technique is already active', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    manager.getActive()!.mastery = 42
    expect(system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')).toBe(true)
    expect(manager.getActive()!.mastery).toBe(42)
  })

  it('refuses a different technique while one is active', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    expect(system.grant({ ...DAO_INSIGHT }, 'qi_refining')).toBe(false)
    expect(manager.getActive()!.id).toBe('five_elements_art')
  })

  it('refuses when the template grade exceeds the realm ceiling', () => {
    const { manager, system } = makeSystem()
    expect(system.grant({ ...FIVE_ELEMENTS }, 'mortal')).toBe(false)
    expect(system.grant({ ...FIVE_ELEMENTS, grade: 2 }, 'qi_refining')).toBe(false)
    expect(system.grant({ ...FIVE_ELEMENTS }, 'not_a_realm')).toBe(false)
    expect(manager.getActive()).toBeUndefined()
  })
})

// M-F-TECHNIQUE - mastery accrues inside the realm-scaled ceiling:
// min(18, realmLevel) while the live grade matches the realm band;
// 0 while lagging.
describe('TechniqueSystem.gainMastery', () => {
  it('accrues partial mastery without ranking up', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    const result = system.gainMastery(100, 'qi_refining', 5)
    expect(result).toEqual({ gained: 100, rankUps: 0 })
    expect(manager.getActive()!.mastery).toBe(100)
    expect(manager.getActive()!.rank).toBe(0)
  })

  it('cascades multiple ranks in one call and drains spent mastery', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    // cost 300/rank; 700 -> rank 2, mastery 100 (realmLevel 5 permits)
    const result = system.gainMastery(700, 'qi_refining', 5)
    expect(result).toEqual({ gained: 700, rankUps: 2 })
    expect(manager.getActive()!.rank).toBe(2)
    expect(manager.getActive()!.mastery).toBe(100)
  })

  it('consumes only what is needed to the realmLevel ceiling; tail is discarded', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    // ceiling at realmLevel 18 = rank 18 -> needed 300*18 = 5400
    const result = system.gainMastery(6000, 'qi_refining', 18)
    expect(result).toEqual({ gained: 5400, rankUps: 18 })
    expect(manager.getActive()!.rank).toBe(18)
    expect(manager.getActive()!.mastery).toBe(0)
  })

  it('clamps at the realmLevel ceiling, not the absolute cap', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    // realmLevel 5 -> ceiling 5 -> needed 300*5 = 1500
    const result = system.gainMastery(5400, 'qi_refining', 5)
    expect(result).toEqual({ gained: 1500, rankUps: 5 })
    expect(manager.getActive()!.rank).toBe(5)
    expect(manager.getActive()!.mastery).toBe(0)

    // no-op at the ceiling
    expect(system.gainMastery(500, 'qi_refining', 5)).toEqual({ gained: 0, rankUps: 0 })
    expect(manager.getActive()!.rank).toBe(5)
  })

  it('trains nothing while the live grade lags the realm band', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    // grade 1 holder inside foundation_establishment (index 2) is sealed:
    // ceiling 0 regardless of realmLevel.
    expect(system.gainMastery(9999, 'foundation_establishment', 18)).toEqual({ gained: 0, rankUps: 0 })
    expect(manager.getActive()!.rank).toBe(0)
    expect(manager.getActive()!.mastery).toBe(0)
  })

  it('is a no-op with no active technique', () => {
    const { system } = makeSystem()
    expect(system.gainMastery(100, 'qi_refining', 5)).toEqual({ gained: 0, rankUps: 0 })
  })

  it('scales the per-rank cost with grade', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'foundation_establishment')
    const active = manager.getActive()!
    active.grade = 2
    // grade 2 cost = 600/rank; 600 -> exactly rank 1, mastery 0
    expect(system.gainMastery(600, 'foundation_establishment', 5)).toEqual({ gained: 600, rankUps: 1 })
    expect(active.rank).toBe(1)
    expect(active.mastery).toBe(0)
  })
})

// M-F-TECHNIQUE (F4) - realm-exit freeze: seals the live cycle into
// gradeHistory when the NEW realm's index exceeds the live grade.
describe('TechniqueSystem.sealFrozenCycle', () => {
  it('seals the live cycle on major-realm exit with the departing realmLevel', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    manager.getActive()!.rank = 12

    expect(system.sealFrozenCycle('foundation_establishment', 12)).toBe(true)
    expect(manager.getActive()!.gradeHistory[1]).toEqual({
      finalRank: 12,
      completionState: 'dai_thanh',
    })
    // mirror state untouched - the live holder keeps rank/grade literally
    expect(manager.getActive()!.rank).toBe(12)
    expect(manager.getActive()!.grade).toBe(1)
  })

  it('is write-if-absent: an existing record is never overwritten', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    manager.getActive()!.rank = 12

    expect(system.sealFrozenCycle('foundation_establishment', 12)).toBe(true)
    manager.getActive()!.rank = 99 as never
    expect(system.sealFrozenCycle('golden_core', 18)).toBe(true)
    expect(manager.getActive()!.gradeHistory[1]).toEqual({
      finalRank: 12,
      completionState: 'dai_thanh',
    })
  })

  it('is a no-op when the new realm does not exceed the live grade', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS, grade: 2 }, 'foundation_establishment')
    // grade 2 holder in a grade-2 realm - in-band, nothing seals
    expect(system.sealFrozenCycle('foundation_establishment', 5)).toBe(false)
    expect(manager.getActive()!.gradeHistory).toEqual({})
  })

  it('is a no-op with no active technique', () => {
    const { system } = makeSystem()
    expect(system.sealFrozenCycle('foundation_establishment', 12)).toBe(false)
  })
})

// M-F-TECHNIQUE (F4) - the catch-up transaction: seal outgoing
// write-if-absent, grade+1, skipped-entry seal, rank/mastery 0,
// build preserved, monotonic inheritance applied.
describe('TechniqueSystem.advanceTechniqueGrade', () => {
  it('refuses while the live grade is in-band or the realm is lower', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    expect(system.advanceTechniqueGrade('qi_refining')).toBe(false)
    expect(system.advanceTechniqueGrade('mortal')).toBe(false)
    expect(manager.getActive()!.grade).toBe(1)
  })

  it('advances a lagging grade; build preserved; new cycle at rank 0 / mastery 0', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    manager.getActive()!.rank = 12
    manager.getActive()!.quality = 'thien'
    system.sealFrozenCycle('foundation_establishment', 12)

    expect(system.advanceTechniqueGrade('foundation_establishment')).toBe(true)
    const active = manager.getActive()!
    expect(active.grade).toBe(2)
    expect(active.rank).toBe(0)
    expect(active.mastery).toBe(0)
    expect(active.quality).toBe('thien')
    expect(active.id).toBe('five_elements_art')
    // the outgoing cycle's sealed record stands verbatim
    expect(active.gradeHistory[1]).toEqual({ finalRank: 12, completionState: 'dai_thanh' })
    // landed in-band (grade 2 == realmIndex 2) - no live-grade record
    expect(active.gradeHistory[2]).toBeUndefined()
  })

  it('defensively seals an outgoing cycle that was never frozen', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    manager.getActive()!.rank = 9
    // no sealFrozenCycle call - the transaction still records the
    // outgoing cycle as partial (never dai_thanh on realmLevel 0).
    expect(system.advanceTechniqueGrade('foundation_establishment')).toBe(true)
    expect(manager.getActive()!.gradeHistory[1]).toEqual({
      finalRank: 9,
      completionState: 'partial',
    })
  })

  it('skipped-entry seal: landing on a still-lagging grade seals {0, partial} at entry', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    manager.getActive()!.rank = 12
    system.sealFrozenCycle('golden_core', 12)

    // grade 1 -> 2 inside golden_core (index 3): grade 2 still lags.
    expect(system.advanceTechniqueGrade('golden_core')).toBe(true)
    const active = manager.getActive()!
    expect(active.grade).toBe(2)
    expect(active.gradeHistory[1]).toEqual({ finalRank: 12, completionState: 'dai_thanh' })
    expect(active.gradeHistory[2]).toEqual({ finalRank: 0, completionState: 'partial' })
  })

  it('sequential catch-up re-seals only write-if-absent', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    system.sealFrozenCycle('golden_core', 12)

    expect(system.advanceTechniqueGrade('golden_core')).toBe(true) // -> grade 2, born-dead sealed
    expect(system.advanceTechniqueGrade('golden_core')).toBe(true) // -> grade 3 in-band
    const active = manager.getActive()!
    expect(active.grade).toBe(3)
    expect(active.gradeHistory[2]).toEqual({ finalRank: 0, completionState: 'partial' })
    expect(active.gradeHistory[3]).toBeUndefined()
  })

  it('inheritance payload keeps the new cycle at rank 0 && mastery 0', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    manager.getActive()!.rank = 18
    system.sealFrozenCycle('foundation_establishment', 18) // vien_man outgoing record

    expect(system.advanceTechniqueGrade('foundation_establishment')).toBe(true)
    const active = manager.getActive()!
    // applied payload never grants rank or mastery (empty today)
    expect(active.rank).toBe(0)
    expect(active.mastery).toBe(0)
  })

  it('refuses with no active technique', () => {
    const { system } = makeSystem()
    expect(system.advanceTechniqueGrade('foundation_establishment')).toBe(false)
  })

  it('refuses a forged grade-0 holder and seals no key-0 record', () => {
    const { system, manager } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    const active = manager.getActive()!
    active.grade = 0

    expect(system.advanceTechniqueGrade('foundation_establishment')).toBe(false)
    expect(active.gradeHistory[0]).toBeUndefined()
  })
})

// P7-M6 - the progress sink republishes the holder's {rank, grade} to
// the PlayerData mirror exactly where the pair can change. The sink is
// the ONLY channel that keeps player.techniqueProgress honest for
// NodeSystem techniqueRank/techniqueGrade prerequisites.
describe('TechniqueSystem progress sink (P7-M6)', () => {
  it('grant fires the sink with {rank: 0, grade: template.grade} on success only', () => {
    const { system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    expect(system.grant({ ...FIVE_ELEMENTS, grade: 1, rank: 7, mastery: 50 }, 'qi_refining')).toBe(true)
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenLastCalledWith({ rank: 0, grade: 1 })
  })

  it('grant noop/refusal paths do not fire', () => {
    const { system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    // grade ceiling refuse on an EMPTY holder -> no holder, no publish
    expect(system.grant({ ...FIVE_ELEMENTS, grade: 9 }, 'qi_refining')).toBe(false)

    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    sink.mockClear()

    // same-id defensive noop -> nothing changed
    expect(system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')).toBe(true)
    // different-id refuse
    expect(system.grant({ ...DAO_INSIGHT }, 'qi_refining')).toBe(false)

    expect(sink).not.toHaveBeenCalled()
  })

  it('gainMastery fires only when rank actually increases', () => {
    const { system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    sink.mockClear()

    // mastery accrual without a rank-up stays silent (mastery unmirrored)
    expect(system.gainMastery(100, 'qi_refining', 5)).toEqual({ gained: 100, rankUps: 0 })
    expect(sink).not.toHaveBeenCalled()

    // rank-up republishes the new pair
    expect(system.gainMastery(200, 'qi_refining', 5)).toEqual({ gained: 200, rankUps: 1 })
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenLastCalledWith({ rank: 1, grade: 1 })
  })

  it('sealFrozenCycle does not fire (the mirror stays the live pair)', () => {
    const { system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    sink.mockClear()

    expect(system.sealFrozenCycle('foundation_establishment', 12)).toBe(true)
    expect(sink).not.toHaveBeenCalled()
  })

  it('advanceTechniqueGrade republishes {rank: 0, grade + 1}; refusal stays silent', () => {
    const { system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    expect(system.advanceTechniqueGrade('qi_refining')).toBe(false)
    sink.mockClear()

    system.sealFrozenCycle('foundation_establishment', 12)

    expect(system.advanceTechniqueGrade('foundation_establishment')).toBe(true)
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenLastCalledWith({ rank: 0, grade: 2 })
  })

  it('setTechniqueQuality does not fire (quality is unmirrored)', () => {
    const { system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    sink.mockClear()

    expect(system.setTechniqueQuality('thien')).toBe(true)
    expect(sink).not.toHaveBeenCalled()
  })

  it('restore republishes the holder pair, or null when the payload is empty', () => {
    const { manager, system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    system.restore([{ ...FIVE_ELEMENTS, rank: 6, grade: 3, mastery: 42 }])
    expect(manager.getActive()?.rank).toBe(6)
    expect(sink).toHaveBeenLastCalledWith({ rank: 6, grade: 3 })

    system.restore([])
    expect(manager.getActive()).toBeUndefined()
    expect(sink).toHaveBeenLastCalledWith(null)
  })
})

describe('TechniqueSystem.setTechniqueQuality', () => {
  it('writes a valid quality onto the active technique', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    expect(system.setTechniqueQuality('thien')).toBe(true)
    expect(manager.getActive()!.quality).toBe('thien')
  })

  it('rejects an invalid quality and leaves state untouched', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    expect(system.setTechniqueQuality('legendary' as never)).toBe(false)
    expect(manager.getActive()!.quality).toBe('hoang')
  })

  it('refuses with no active technique', () => {
    const { system } = makeSystem()
    expect(system.setTechniqueQuality('hoang')).toBe(false)
  })
})
