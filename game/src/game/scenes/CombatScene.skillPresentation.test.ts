// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import type { SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import type { EntitySprite } from './combat/combatTypes'

const spriteStub = (x: number): EntitySprite => ({ kind: 'rect', rect: { x, y: 0 },
  offsetX: 0, footY: 60, personWidth: 24, personHeight: 40 }) as unknown as EntitySprite
const ref = { sessionId: 1, requestId: '1', token: 'playback-1' }
const source = { entityId: 'player', row: 1, column: 1 }
const target = { entityId: 'enemy', row: 1, column: 8 }
const cast: SkillCastPresentation = { ref, rootSkillId: 'ngu_kiem_thuat', resolvedSkillId: 'ngu_kiem_thuat',
  presetId: 'ngu_kiem_flight', source, declaredTargets: [target], candidateInstanceCount: 1, disposition: 'action',
  slotRole: 'basic' }
const resolved: SkillPresentationResolved = { ref, sealed: true, groups: [{
  groupId: 'g', role: 'primary', resolvedSkillId: 'ngu_kiem_thuat', presetId: 'ngu_kiem_flight',
  source, actualTargets: [target], footprint: { kind: 'cells', cells: [{ row: 1, column: 8 }] },
  outcomes: [{ kind: 'hit', outcomeId: 'hit', target, hitOrdinal: 0, landed: true, crit: false, hpDamage: 8, killed: false }],
}] }
function fixture() {
  const scene = createTestScene()
  const port = { getPendingPlaybackToken: () => ref.token, acknowledgeActionImpact: vi.fn(),
    acknowledgeActionComplete: vi.fn(), acknowledgeTurnReady: vi.fn() }
  scene.gameManagerRef = port
  scene.cameras = { main: { shake: vi.fn() } }
  scene.add = { graphics: () => {
    const graphics: Record<string, unknown> = {}
    for (const key of ['clear', 'setVisible', 'setDepth', 'lineStyle', 'lineBetween', 'fillStyle',
      'fillTriangle', 'strokeCircle', 'strokeEllipse', 'destroy']) graphics[key] = () => graphics
    return graphics
  } }
  scene.projection = { gridToScreen: (row: number, column: number) => ({ x: column * 50, y: row * 50 }) }
  return { scene, port }
}
describe('CombatScene shared skill playback wiring', () => {
  it('subscribes only sealed presentation facts for primary skill visuals', () => {
    const { scene } = fixture()
    const names = scene.getCombatEventBindings().map(([name]: [string]) => name)
    expect(names).toContain('skill_presentation_cast')
    expect(names).toContain('skill_presentation_resolved')
    // Impact-sync: 'turn_cast_start' is gone - the authored cast/attack/ult
    // clip resolves inside the skill_presentation_cast handler
    // (startCastPlayback), so ONE binding drives visuals, clips and ACKs.
    expect(names).not.toContain('turn_cast_start')
    expect(names).not.toContain('action_impact')
  })
  it('runs the production recipe with exactly one captured impact and complete ACK', () => {
    const { scene, port } = fixture()
    port.acknowledgeActionImpact.mockImplementation(() => scene.onSkillResolved(resolved))
    scene.onSkillCast(cast)
    scene.skillPlayback.update(370)
    expect(port.acknowledgeActionImpact).toHaveBeenCalledExactlyOnceWith(ref.token)
    scene.skillPlayback.update(250)
    expect(port.acknowledgeActionComplete).toHaveBeenCalledExactlyOnceWith(ref.token)
    expect(scene.skillVfxDebug.pool.active).toBe(0)
  })
  it('drives the actor impulse toward the declared target on a melee cast', () => {
    const { scene, port } = fixture()
    scene.sprites.set('player', spriteStub(50))
    scene.sprites.set('enemy', spriteStub(400))
    const tweenConfigs: Array<Record<string, unknown>> = []
    scene.tweens = { add: (cfg: Record<string, unknown>) => tweenConfigs.push(cfg), killTweensOf: vi.fn() }
    scene.onSkillCast({ ...cast, presetId: 'slash' })
    expect(tweenConfigs[0]).toMatchObject({ targets: scene.sprites.get('player'), offsetX: 8, yoyo: true, duration: 180 })
    expect(port.acknowledgeActionImpact).not.toHaveBeenCalled()
  })
  it('still fires the impulse under reduced motion - it is the "who acted" signal', () => {
    const { scene } = fixture()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    try {
      scene.sprites.set('player', spriteStub(50))
      const tweenConfigs: Array<Record<string, unknown>> = []
      scene.tweens = { add: (cfg: Record<string, unknown>) => tweenConfigs.push(cfg), killTweensOf: vi.fn() }
      scene.onSkillCast({ ...cast, presetId: 'slash' })
      expect(tweenConfigs.some(cfg => cfg.offsetX === 8)).toBe(true)
    } finally { vi.unstubAllGlobals() }
  })
  it('resumes a post-impact receipt without replaying damage and returns all pool leases', () => {
    const { scene, port } = fixture()
    scene.applyResumePlayback({ phase: 'complete', token: ref.token, resolved })
    scene.skillPlayback.update(120)
    expect(port.acknowledgeActionImpact).not.toHaveBeenCalled()
    expect(port.acknowledgeActionComplete).toHaveBeenCalledExactlyOnceWith(ref.token)
    expect(scene.skillVfxDebug.pool.active).toBe(0)
  })
})
