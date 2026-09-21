import { describe, expect, it, vi } from 'vitest'
import type { Technique } from './Technique'
import { TechniqueManager } from './TechniqueManager'
import { TechniqueSystem } from './TechniqueSystem'
import { TECHNIQUE_RANK_CAP } from './TechniqueProgression'

const FIVE_ELEMENTS: Technique = {
  id: 'five_elements_art',
  name: 'Tiểu Ngũ Hành Quyết',
  description: 'test',
  grade: 1,
  rank: 0,
  mastery: 0,
  quality: 'hoang',
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

describe('TechniqueSystem.gainMastery', () => {
  it('accrues partial mastery without ranking up', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    const result = system.gainMastery(100)
    expect(result).toEqual({ gained: 100, rankUps: 0 })
    expect(manager.getActive()!.mastery).toBe(100)
    expect(manager.getActive()!.rank).toBe(0)
  })

  it('cascades multiple ranks in one call and drains spent mastery', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    // cost 300/rank; 700 -> rank 2, mastery 100
    const result = system.gainMastery(700)
    expect(result).toEqual({ gained: 700, rankUps: 2 })
    expect(manager.getActive()!.rank).toBe(2)
    expect(manager.getActive()!.mastery).toBe(100)
  })

  it('consumes only what is needed to cap; tail is discarded, gained reports consumed', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    // needed to cap = 300*10 = 3000; grant 4500 -> consumed 3000, rank 10, mastery 0
    const result = system.gainMastery(4500)
    expect(result).toEqual({ gained: 3000, rankUps: 10 })
    expect(manager.getActive()!.rank).toBe(TECHNIQUE_RANK_CAP)
    expect(manager.getActive()!.mastery).toBe(0)
  })

  it('is a no-op at rank 10 cap', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    system.gainMastery(3000)
    const result = system.gainMastery(500)
    expect(result).toEqual({ gained: 0, rankUps: 0 })
    expect(manager.getActive()!.rank).toBe(10)
    expect(manager.getActive()!.mastery).toBe(0)
  })

  it('is a no-op with no active technique', () => {
    const { system } = makeSystem()
    expect(system.gainMastery(100)).toEqual({ gained: 0, rankUps: 0 })
  })

  it('scales the per-rank cost with grade', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    const active = manager.getActive()!
    active.grade = 2
    // grade 2 cost = 600/rank; 600 -> exactly rank 1, mastery 0
    expect(system.gainMastery(600)).toEqual({ gained: 600, rankUps: 1 })
    expect(active.rank).toBe(1)
    expect(active.mastery).toBe(0)
  })
})

describe('TechniqueSystem.advanceTechniqueGrade', () => {
  it('refuses below rank cap', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    expect(system.advanceTechniqueGrade()).toBe(false)
    expect(manager.getActive()!.grade).toBe(1)
  })

  it('at rank cap: grade+1 and resets rank/mastery', () => {
    const { manager, system } = makeSystem()
    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    system.gainMastery(3000)
    expect(system.advanceTechniqueGrade()).toBe(true)
    const active = manager.getActive()!
    expect(active.grade).toBe(2)
    expect(active.rank).toBe(0)
    expect(active.mastery).toBe(0)
  })

  it('refuses with no active technique', () => {
    const { system } = makeSystem()
    expect(system.advanceTechniqueGrade()).toBe(false)
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
    expect(system.gainMastery(100)).toEqual({ gained: 100, rankUps: 0 })
    expect(sink).not.toHaveBeenCalled()

    // rank-up republishes the new pair
    expect(system.gainMastery(200)).toEqual({ gained: 200, rankUps: 1 })
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenLastCalledWith({ rank: 1, grade: 1 })
  })

  it('advanceTechniqueGrade republishes {rank: 0, grade + 1}; refusal stays silent', () => {
    const { system } = makeSystem()
    const sink = vi.fn()
    system.setProgressSink(sink)

    system.grant({ ...FIVE_ELEMENTS }, 'qi_refining')
    expect(system.advanceTechniqueGrade()).toBe(false)
    sink.mockClear()

    system.gainMastery(3000)
    sink.mockClear()

    expect(system.advanceTechniqueGrade()).toBe(true)
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
