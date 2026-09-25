import { describe, expect, it } from 'vitest'
import type { SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { SkillPresentationRunner } from './SkillPresentationRunner'
import type { SkillPresentationDriver, SkillPresentationRecipe } from './SkillPresentationRecipe'

const ref = { sessionId: 1, requestId: 'request-1', token: 'token-1' }
const source = { entityId: 'player', row: 1, column: 1 }
const target = { entityId: 'enemy', row: 1, column: 8 }
const cast: SkillCastPresentation = {
  ref, rootSkillId: 'test', resolvedSkillId: 'test', presetId: 'metal_slash',
  source, declaredTargets: [target], candidateInstanceCount: 1, disposition: 'action',
}
function batch(token = ref.token): SkillPresentationResolved {
  return {
    ref: { ...ref, token }, sealed: true,
    groups: [{
      groupId: 'primary', role: 'primary', resolvedSkillId: 'test', presetId: 'metal_slash',
      source, actualTargets: [target], footprint: { kind: 'cells', cells: [{ row: 1, column: 8 }] },
      outcomes: [{ kind: 'hit', outcomeId: 'hit-1', target, hitOrdinal: 0,
        landed: true, crit: false, hpDamage: 10, killed: false }],
    }],
  }
}
const recipe: SkillPresentationRecipe = {
  id: 'test', version: 1, color: 0xffffff,
  castMs: 370, impactMs: 80, recoveryMs: 170,
  cast: [{ primitive: 'trajectory', offsetMs: 0, durationMs: 370, anchor: 'target', shape: 'blade' }],
  impact: [{ primitive: 'stroke', offsetMs: 0, durationMs: 80, anchor: 'target', shape: 'slash' }],
  recovery: [{ primitive: 'trajectory', offsetMs: 0, durationMs: 170, anchor: 'source', shape: 'blade', recall: true }],
}
function fixture(options: { synchronous?: boolean; throwVisual?: boolean } = {}) {
  const calls: string[] = []
  let pendingToken: string | null = ref.token
  let leased = 0
  let insideImpact = false
  const errors: unknown[] = []
  const driver: SkillPresentationDriver = {
    open() {
      if (options.throwVisual) throw new Error('visual failure')
      leased++
      let alive = true
      const release = () => { if (alive) { alive = false; leased-- } }
      return { sample() {}, finish: release, cancel: release }
    },
  }
  const port = {
    getPendingPlaybackToken: () => pendingToken,
    acknowledgeActionImpact() {
      calls.push('impact')
      insideImpact = true
      if (options.synchronous) runner.resolve(batch())
      insideImpact = false
    },
    acknowledgeActionComplete() {
      if (insideImpact) throw new Error('reentrant completion')
      calls.push('complete')
      pendingToken = null
    },
  }
  const runner = new SkillPresentationRunner(driver, () => recipe, error => errors.push(error))
  return { runner, port, calls, errors, leases: () => leased, setToken: (token: string | null) => { pendingToken = token } }
}
describe('shared skill presentation runner', () => {
  it('reaches commit once and waits for a sealed result before completing', () => {
    const f = fixture()
    f.runner.start(cast, f.port)
    f.runner.update(369)
    expect(f.calls).toEqual([])
    f.runner.update(1)
    expect(f.calls).toEqual(['impact'])
    f.runner.update(2000)
    expect(f.calls).toEqual(['impact'])
    f.runner.resolve(batch())
    f.runner.update(0)
    f.runner.update(249)
    expect(f.calls).toEqual(['impact'])
    f.runner.update(1)
    expect(f.calls).toEqual(['impact', 'complete'])
    expect(f.leases()).toBe(0)
  })
  it('inboxes synchronous outcomes without completing inside the impact ACK', () => {
    const f = fixture({ synchronous: true })
    f.runner.start(cast, f.port)
    f.runner.update(370)
    expect(f.calls).toEqual(['impact'])
    f.runner.update(250)
    expect(f.calls).toEqual(['impact', 'complete'])
    expect(f.errors).toEqual([])
  })
  it('waits for a longer combo rather than letting the primary release the turn', () => {
    const f = fixture()
    const comboRecipe = { ...recipe, impactMs: 400, recoveryMs: 0, recovery: [],
      impact: [{ primitive: 'stroke' as const, offsetMs: 0, durationMs: 400, anchor: 'target' as const, shape: 'slash' as const }] }
    const runner = new SkillPresentationRunner({ open: () => ({ sample() {}, finish() {}, cancel() {} }) },
      presetId => presetId === 'fire_burst' ? comboRecipe : recipe)
    runner.start(cast, f.port)
    runner.update(370)
    const result = batch()
    runner.resolve({ ...result, groups: [...result.groups, { ...result.groups[0]!, groupId: 'combo', role: 'combo', presetId: 'fire_burst' }] })
    runner.update(0)
    runner.update(250)
    expect(f.calls).toEqual(['impact'])
    runner.update(150)
    expect(f.calls).toEqual(['impact', 'complete'])
  })
  it('rejects early, duplicate and stale outcomes and duplicate cast delivery', () => {
    const f = fixture()
    f.runner.start(cast, f.port)
    f.runner.resolve(batch())
    f.runner.start(cast, f.port)
    f.runner.update(370)
    f.runner.resolve(batch('old-token'))
    f.runner.update(500)
    expect(f.calls).toEqual(['impact'])
    f.runner.resolve(batch())
    f.runner.resolve(batch())
    f.runner.update(0)
    f.runner.update(250)
    f.runner.start(cast, f.port)
    f.runner.update(1000)
    expect(f.calls).toEqual(['impact', 'complete'])
  })
  it.each([0, 100, 370, 400, 600])('cancels at %ims with no late complete or leaked resource', ms => {
    const f = fixture({ synchronous: true })
    f.runner.start(cast, f.port)
    f.runner.update(Math.min(ms, 370))
    if (ms > 370) f.runner.update(ms - 370)
    const before = [...f.calls]
    f.runner.cancel()
    f.runner.cancel()
    f.runner.update(1000)
    expect(f.calls).toEqual(before)
    expect(f.leases()).toBe(0)
  })
  it('cannot acknowledge through an obsolete command port after replacement', () => {
    const old = fixture()
    const next = fixture()
    old.runner.start(cast, old.port)
    old.runner.start({ ...cast, ref: { ...ref, requestId: 'request-2' } }, next.port)
    old.runner.update(370)
    expect(old.calls).toEqual([])
    expect(next.calls).toEqual(['impact'])
    old.runner.resolve({ ...batch(), ref: { ...ref, requestId: 'request-2' } })
    old.runner.update(0)
    old.runner.update(250)
    expect(next.calls).toEqual(['impact', 'complete'])
  })
  it('keeps pacing when the visual driver fails and reports the fault', () => {
    const f = fixture({ synchronous: true, throwVisual: true })
    f.runner.start(cast, f.port)
    f.runner.update(370)
    f.runner.update(250)
    expect(f.calls).toEqual(['impact', 'complete'])
    expect(f.errors.length).toBeGreaterThan(0)
    expect(f.leases()).toBe(0)
  })
  it('ignores invalid time deltas and cancels when runtime expires the token', () => {
    const f = fixture()
    f.runner.start(cast, f.port)
    for (const delta of [NaN, Infinity, -1]) f.runner.update(delta)
    expect(f.calls).toEqual([])
    f.setToken('another-token')
    f.runner.update(1000)
    expect(f.calls).toEqual([])
    expect(f.leases()).toBe(0)
  })
  it('resumes post-impact with a short tail and never resolves damage twice', () => {
    const f = fixture()
    f.runner.resumeResolved(batch(), f.port)
    f.runner.update(119)
    expect(f.calls).toEqual([])
    f.runner.update(1)
    expect(f.calls).toEqual(['complete'])
  })
})
