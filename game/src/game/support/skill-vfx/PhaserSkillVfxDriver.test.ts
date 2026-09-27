import { describe, expect, it, vi } from 'vitest'
import { PhaserSkillVfxDriver, type SkillVfxSurface, type SkillVfxGraphics } from './PhaserSkillVfxDriver'
import type { SkillCue, SkillCueContext } from '@/presentation/skills/SkillPresentationRecipe'
const source = { entityId: 'player', row: 1, column: 1 }
const target = { entityId: 'enemy', row: 1, column: 8 }
const cue = { primitive: 'trajectory' as const, anchor: 'target' as const, shape: 'blade' as const, offsetMs: 0, durationMs: 370 }
const recipe = { id: 'test', version: 1 as const, color: 0xffffff, castMs: 370, impactMs: 80, recoveryMs: 170, cast: [], impact: [], recovery: [] }
function fixture(quality: 'standard' | 'low' = 'standard', reducedMotion = false) {
  const draws: string[] = []
  let destroyed = 0
  const graphics = () => {
    const obj: Record<string, unknown> = {}
    for (const key of ['clear', 'setVisible', 'setDepth', 'lineStyle', 'lineBetween', 'fillStyle',
      'fillTriangle', 'strokeCircle', 'strokeEllipse']) obj[key] = () => { if (key !== 'clear') draws.push(key); return obj }
    obj.destroy = () => { destroyed++ }
    return obj as unknown as SkillVfxGraphics
  }
  const surface: SkillVfxSurface = {
    graphics, anchor: fact => ({ x: fact.column * 50, y: fact.row * 50 }),
    ground: fact => ({ x: fact.column * 50, y: fact.row * 50 }),
    uprightDepth: () => 450, actorImpulse: vi.fn(), cameraImpulse: vi.fn(),
  }
  const driver = new PhaserSkillVfxDriver(surface, quality, reducedMotion)
  const context: SkillCueContext = { ref: { sessionId: 1, requestId: '1', token: '1' }, recipe,
    phase: 'cast', cast: { ref: { sessionId: 1, requestId: '1', token: '1' }, rootSkillId: 'test',
      resolvedSkillId: 'test', presetId: 'metal_slash', source, declaredTargets: [target],
      candidateInstanceCount: 100, disposition: 'action' } }
  return { driver, context, draws, surface, destroyed: () => destroyed }
}
describe('pooled Phaser skill driver', () => {
  it.each(['standard', 'low'] as const)('bounds and releases ten thousand cue lifecycles at %s quality', quality => {
    const f = fixture(quality)
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('global RNG touched') })
    try {
      for (let n = 0; n < 10000; n++) {
        const handle = f.driver.open(cue, f.context)
        handle.sample(200)
        if (n % 2) handle.finish()
        else handle.cancel()
      }
      expect(f.driver.stats.active).toBe(0)
      expect(f.driver.stats.allocated).toBe(1)
      f.driver.destroy()
      expect(f.destroyed()).toBe(1)
    } finally { random.mockRestore() }
  })
  it('does not fabricate impact for missed, skipped or absent hits', () => {
    const f = fixture()
    const context: SkillCueContext = { ...f.context, phase: 'resolved', cast: undefined,
      group: { groupId: 'g', role: 'primary', resolvedSkillId: 'test', presetId: 'metal_slash',
        source, actualTargets: [target], footprint: { kind: 'none' },
        outcomes: [{ kind: 'hit', outcomeId: 'miss', target, landed: false, crit: false, hpDamage: 0, killed: false, hitOrdinal: 0 }] } }
    const handle = f.driver.open({ ...cue, primitive: 'stroke', shape: 'slash' }, context)
    handle.sample(20)
    expect(f.driver.stats.active).toBe(0)
    expect(f.surface.cameraImpulse).not.toHaveBeenCalled()
    handle.finish()
  })
  it('fires the actor impulse once for the source fact without leasing graphics', () => {
    const f = fixture()
    const impulseCue = { primitive: 'actor-impulse' as const, anchor: 'source' as const,
      shape: 'impulse' as const, offsetMs: 0, durationMs: 180, impulsePx: 8 }
    const handle = f.driver.open(impulseCue, f.context)
    handle.sample(10)
    handle.finish()
    // The playback-scoped cast rides along so the surface can aim the slide.
    expect(f.surface.actorImpulse).toHaveBeenCalledExactlyOnceWith(source, 180, 8, f.context.cast)
    expect(f.driver.stats.active).toBe(0)
    expect(f.draws).toHaveLength(0)
  })
  it('gates actor-impulse on the same action dispositions as trajectory', () => {
    for (const disposition of ['blocked', 'charge-start', 'charge-tick', 'empty'] as const) {
      const f = fixture()
      const context: SkillCueContext = { ...f.context,
        cast: { ...f.context.cast!, disposition } }
      const handle = f.driver.open({ primitive: 'actor-impulse', anchor: 'source',
        shape: 'impulse', offsetMs: 0, durationMs: 180, impulsePx: 8 }, context)
      handle.sample(10)
      expect(f.surface.actorImpulse).not.toHaveBeenCalled()
    }
    for (const disposition of ['action', 'charge-release'] as const) {
      const f = fixture()
      const context: SkillCueContext = { ...f.context,
        cast: { ...f.context.cast!, disposition } }
      f.driver.open({ primitive: 'actor-impulse', anchor: 'source',
        shape: 'impulse', offsetMs: 0, durationMs: 180, impulsePx: 8 }, context)
      expect(f.surface.actorImpulse).toHaveBeenCalledExactlyOnceWith(source, 180, 8, context.cast)
    }
  })
  it('gates trajectory one-shots on the action dispositions as well', () => {
    // W7 disposition pin: a blocked/charge-tick/empty cast shows the aura
    // cast cue only - no one-shot cue may move an actor or the camera.
    for (const disposition of ['blocked', 'charge-start', 'charge-tick', 'empty'] as const) {
      const f = fixture()
      const context: SkillCueContext = { ...f.context,
        cast: { ...f.context.cast!, disposition } }
      const handle = f.driver.open(cue, context)
      handle.sample(10)
      expect(f.driver.stats.active).toBe(0)
      expect(f.draws).toHaveLength(0)
      expect(f.surface.actorImpulse).not.toHaveBeenCalled()
      expect(f.surface.cameraImpulse).not.toHaveBeenCalled()
    }
  })
  it.each(['actor-impulse', 'camera-cue'] as const)('warns and draws nothing if a %s cue ever reaches accent', primitive => {
    // W7 structural pin for the accent() guard: one-shot primitives must
    // exit open() before the graphics lease; if a future dispatch change
    // lets one through, the draw path warns loudly instead of rendering
    // a wrong ellipse.
    const f = fixture()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const drawPath = f.driver as unknown as { accent(g: SkillVfxGraphics, cue: SkillCue, color: number,
        point: { x: number, y: number }, origin: { x: number, y: number }, elapsed: number): void }
      const graphics = f.surface.graphics()
      drawPath.accent(graphics, { primitive, anchor: 'source', shape: 'impulse',
        offsetMs: 0, durationMs: 100 }, 0xffffff, { x: 1, y: 2 }, { x: 0, y: 0 }, 10)
      expect(warn).toHaveBeenCalledExactlyOnceWith(`[SkillVfx] ${primitive} cue reached the draw path`)
      expect(f.draws).toHaveLength(0)
    } finally { warn.mockRestore() }
  })
  const landedContext = (f: ReturnType<typeof fixture>, overrides?: Partial<SkillCueContext>): SkillCueContext => ({
    ...f.context, phase: 'resolved' as const, cast: undefined, primaryLanded: true,
    group: { groupId: 'g', role: 'primary' as const, resolvedSkillId: 'test', presetId: 'metal_slash',
      source, actualTargets: [target], footprint: { kind: 'none' as const },
      outcomes: [{ kind: 'hit' as const, outcomeId: 'h', target, landed: true, crit: false, hpDamage: 4, killed: false, hitOrdinal: 0 }] },
    ...overrides })
  const comboGroup = (landed: boolean) => ({
    groupId: 'combo', role: 'combo' as const, resolvedSkillId: 'combo', presetId: 'kiem_combo_tam_thich' as const,
    source, actualTargets: [target], footprint: { kind: 'none' as const },
    outcomes: [{ kind: 'hit' as const, outcomeId: 'c', target, landed, crit: false, hpDamage: landed ? 4 : 0, killed: false, hitOrdinal: 0 }] })
  const cameraCue = { primitive: 'camera-cue' as const, anchor: 'source' as const,
    shape: 'camera' as const, offsetMs: 0, durationMs: 140, intensity: 0.005 }
  it('warns and drops one-shot cues opened in a phase that cannot serve them', () => {
    // The validator rejects these placements for recipes; the open() guards
    // cover contexts built by callers that never validated (a misplaced cue
    // reads facts that do not exist in that phase and could only no-op).
    const impulse = { primitive: 'actor-impulse' as const, anchor: 'source' as const,
      shape: 'impulse' as const, offsetMs: 0, durationMs: 180, impulsePx: 8 }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const resolved = fixture()
      resolved.driver.open(impulse, landedContext(resolved))
      expect(resolved.surface.actorImpulse).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[SkillVfx] actor-impulse cue outside cast playback dropped')
      const castPhase = fixture()
      castPhase.driver.open(cameraCue, castPhase.context)
      expect(castPhase.surface.cameraImpulse).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[SkillVfx] camera-cue cue outside resolved playback dropped')
    } finally { warn.mockRestore() }
  })
  it('latches camera impulses per requestId so a rotated resume token cannot refire them', () => {
    const f = fixture()
    const landed = landedContext(f)
    // preparePresentationResume rotates ref.token but keeps requestId:
    // replaying the same action must not fire a second impulse.
    const resumed = (ctx: SkillCueContext) => ({ ...ctx, ref: { ...ctx.ref, token: 'resumed-token' } })
    f.driver.open(cameraCue, landed)
    f.driver.open(cameraCue, resumed(landed))
    expect(f.surface.cameraImpulse).toHaveBeenCalledExactlyOnceWith(140, 0.005)
    // The generic landed-hit impulse shares the latch: same action, same cap.
    const stroke = { primitive: 'stroke' as const, anchor: 'targets' as const,
      shape: 'slash' as const, offsetMs: 0, durationMs: 100 }
    const fresh = { ...landed, ref: { sessionId: 1, requestId: '2', token: 'tok-2' } }
    f.driver.open(stroke, fresh)
    f.driver.open(stroke, resumed(fresh))
    expect(f.surface.cameraImpulse).toHaveBeenCalledTimes(2)
    expect(f.surface.cameraImpulse).toHaveBeenLastCalledWith(45, 0.001)
  })
  it('fires an authored camera-cue once per action on a landed hit', () => {
    const f = fixture()
    const context = landedContext(f)
    f.driver.open(cameraCue, context)
    f.driver.open(cameraCue, context)
    expect(f.surface.cameraImpulse).toHaveBeenCalledExactlyOnceWith(140, 0.005)
  })
  it('gates an authored camera-cue on the primary group outcome, not its own group', () => {
    // Routed composite (spec W2.3/W2.5): a camera-cue riding a combo-role
    // group must follow the receipt's PRIMARY group outcome, plumbed as
    // primaryLanded. Its own lane's outcome is irrelevant.
    const primaryLanded = fixture()
    primaryLanded.driver.open(cameraCue, landedContext(primaryLanded, {
      group: comboGroup(false), primaryLanded: true }))
    expect(primaryLanded.surface.cameraImpulse).toHaveBeenCalledExactlyOnceWith(140, 0.005)
    const primaryWhiffed = fixture()
    primaryWhiffed.driver.open(cameraCue, landedContext(primaryWhiffed, {
      group: comboGroup(true), primaryLanded: false }))
    expect(primaryWhiffed.surface.cameraImpulse).not.toHaveBeenCalled()
  })
  it('suppresses camera cues without a landed hit and under reduced motion', () => {
    const f = fixture()
    const base = landedContext(f)
    const missed = { ...base, primaryLanded: false, group: { ...base.group!,
      outcomes: [{ kind: 'hit' as const, outcomeId: 'm', target, landed: false, crit: false, hpDamage: 0, killed: false, hitOrdinal: 0 }] } }
    f.driver.open(cameraCue, missed)
    expect(f.surface.cameraImpulse).not.toHaveBeenCalled()
    const reduced = fixture('standard', true)
    reduced.driver.open(cameraCue, landedContext(reduced))
    expect(reduced.surface.cameraImpulse).not.toHaveBeenCalled()
  })
  it('gates the generic camera impulse on landed hits and yields to authored cues', () => {
    const f = fixture()
    const stroke = { primitive: 'stroke' as const, anchor: 'targets' as const,
      shape: 'slash' as const, offsetMs: 0, durationMs: 100 }
    // Landed non-crit hit fires the generic impulse.
    f.driver.open(stroke, landedContext(f))
    expect(f.surface.cameraImpulse).toHaveBeenCalledExactlyOnceWith(45, 0.001)
    // Authored precedence suppresses the generic impulse action-wide.
    const authored = fixture()
    authored.driver.open(stroke, landedContext(authored, { hasAuthoredCameraCue: true }))
    expect(authored.surface.cameraImpulse).not.toHaveBeenCalled()
    // A landed hit on a non-primary group does not fire the generic impulse.
    const combo = fixture()
    combo.driver.open(stroke, landedContext(combo, {
      group: { ...landedContext(combo).group!, role: 'combo' } }))
    expect(combo.surface.cameraImpulse).not.toHaveBeenCalled()
  })
  it('releases all leases on reset and stale handles cannot release new cues', () => {
    const f = fixture()
    const old = f.driver.open(cue, f.context)
    f.driver.reset()
    const current = f.driver.open(cue, f.context)
    old.cancel()
    expect(f.driver.stats.active).toBe(1)
    current.finish()
    expect(f.driver.stats.active).toBe(0)
  })
})
