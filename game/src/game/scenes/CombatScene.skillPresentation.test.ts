// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import type { SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
const ref = { sessionId: 1, requestId: '1', token: 'playback-1' }
const source = { entityId: 'player', row: 1, column: 1 }
const target = { entityId: 'enemy', row: 1, column: 8 }
const cast: SkillCastPresentation = { ref, rootSkillId: 'ngu_kiem_thuat', resolvedSkillId: 'ngu_kiem_thuat',
  presetId: 'ngu_kiem_flight', source, declaredTargets: [target], candidateInstanceCount: 1, disposition: 'action' }
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
  it('resumes a post-impact receipt without replaying damage and returns all pool leases', () => {
    const { scene, port } = fixture()
    scene.applyResumePlayback({ phase: 'complete', token: ref.token, resolved })
    scene.skillPlayback.update(120)
    expect(port.acknowledgeActionImpact).not.toHaveBeenCalled()
    expect(port.acknowledgeActionComplete).toHaveBeenCalledExactlyOnceWith(ref.token)
    expect(scene.skillVfxDebug.pool.active).toBe(0)
  })
})
