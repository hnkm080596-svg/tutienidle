import { describe, expect, it, vi } from 'vitest'
import { PhaserSkillVfxDriver, type SkillVfxSurface, type SkillVfxGraphics } from './PhaserSkillVfxDriver'
import type { SkillCueContext } from '@/presentation/skills/SkillPresentationRecipe'
const source = { entityId: 'player', row: 1, column: 1 }
const target = { entityId: 'enemy', row: 1, column: 8 }
const cue = { primitive: 'trajectory' as const, anchor: 'target' as const, shape: 'blade' as const, offsetMs: 0, durationMs: 370 }
const recipe = { id: 'test', version: 1 as const, color: 0xffffff, castMs: 370, impactMs: 80, recoveryMs: 170, cast: [], impact: [], recovery: [] }
function fixture(quality: 'standard' | 'low' = 'standard') {
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
    uprightDepth: () => 450, cameraImpulse: vi.fn(),
  }
  const driver = new PhaserSkillVfxDriver(surface, quality)
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
