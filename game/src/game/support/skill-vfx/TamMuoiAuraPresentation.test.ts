import { describe, expect, it } from 'vitest'
import type {
  ActorAnchorFact,
  SkillCastPresentation,
  SkillPresentationResolved,
} from '@/core/battle/turn/SkillPresentationFacts'
import { TamMuoiAuraPresentation, isTamMuoiAuraCast } from './TamMuoiAuraPresentation'

const source: ActorAnchorFact = { entityId: 'player', row: 1, column: 1 }
const ref = { sessionId: 1, requestId: 'aura', token: 'aura-token' }
const cast: SkillCastPresentation = {
  ref, rootSkillId: 'tam_muoi_chan_hoa', resolvedSkillId: 'tam_muoi_chan_hoa',
  presetId: 'tam_muoi_aura',
  source, declaredTargets: [source], candidateInstanceCount: 1,
  disposition: 'action', slotRole: 'special',
}

type SpriteState = {
  key: string; frame: string; x: number; y: number; scale: number
  angle: number; alpha: number; depth: number; visible: boolean
  destroyed: boolean; additive: boolean
}

function fixture(options: { isCurrent?: () => boolean; reducedMotion?: boolean } = {}) {
  const sprites: SpriteState[] = []
  const surface = {
    anchor: (fact: ActorAnchorFact) =>
      fact.entityId === 'player' ? { x: 210, y: 325, scale: 0.95, depth: 590 } : undefined,
    isCurrent: options.isCurrent,
    reducedMotion: options.reducedMotion,
    createSprite: (key: string, frame: string) => {
      const state: SpriteState = {
        key, frame, x: 0, y: 0, scale: 1, angle: 0, alpha: 1,
        depth: 0, visible: true, destroyed: false, additive: false,
      }
      sprites.push(state)
      return {
        setFrame: (value: string) => { state.frame = value },
        setPosition: (x: number, y: number) => { state.x = x; state.y = y },
        setVisible: (value: boolean) => { state.visible = value },
        setScale: (x: number) => { state.scale = x },
        setAngle: (value: number) => { state.angle = value },
        setAlpha: (value: number) => { state.alpha = value },
        setDepth: (value: number) => { state.depth = value },
        setBlendAdd: (additive: boolean) => { state.additive = additive },
        destroy: () => { state.destroyed = true },
      }
    },
  }
  return { presenter: new TamMuoiAuraPresentation(surface), sprites }
}

function receipt(): SkillPresentationResolved {
  return {
    ref, sealed: true,
    groups: [{
      groupId: 'primary', role: 'primary', resolvedSkillId: 'tam_muoi_chan_hoa',
      presetId: 'tam_muoi_aura', source, actualTargets: [source],
      footprint: { kind: 'entity-targets', entityIds: ['player'] },
      outcomes: [{ kind: 'status', outcomeId: 'buff', target: source, action: 'apply', applied: true }],
    }],
  }
}

describe('Tam Muoi aura presentation', () => {
  it('gates on the tam_muoi_aura preset with an action cast', () => {
    expect(isTamMuoiAuraCast(cast)).toBe(true)
    expect(isTamMuoiAuraCast({ ...cast, presetId: 'hoa_cau_comet' })).toBe(false)
    expect(isTamMuoiAuraCast({ ...cast, disposition: 'empty' })).toBe(false)
    expect(isTamMuoiAuraCast({ ...cast, disposition: 'charge-tick' })).toBe(false)
  })

  it('wraps the caster in the two blended layers for the whole cast', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 1200)
    expect(sprites).toHaveLength(2)
    presenter.update(16)
    const back = sprites.find(s => s.key === 'tam-muoi-fire-aura-back')!
    const front = sprites.find(s => s.key === 'tam-muoi-fire-aura-front')!
    expect(back).toMatchObject({ visible: true, x: 210, y: 325, additive: true, depth: 589.5 })
    expect(front).toMatchObject({ visible: true, x: 210, y: 325, additive: true, depth: 590.5 })
    expect(back.scale).toBeCloseTo(0.95)
    expect(front.scale).toBeCloseTo(0.95)
    // Fade-in: still dim partway through the 220ms ramp.
    expect(back.alpha).toBeLessThan(0.5)
    presenter.update(600)
    expect(back.alpha).toBe(1)
    // Each layer loops its own occupied range over the same 1200ms phase.
    presenter.update(340)
    expect(back.frame).toBe('frame_28')
    expect(front.frame).toBe('frame_29')
    presenter.update(800)
    expect(back.frame).toBe('frame_17')
    expect(front.frame).toBe('frame_17')
  })

  it('ignites on the sealed receipt - swells, flashes, then despawns', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 1200)
    presenter.update(1200)
    presenter.resolve(receipt())
    const back = sprites.find(s => s.key === 'tam-muoi-fire-aura-back')!
    expect(back.visible).toBe(true)
    expect(back.alpha).toBe(1)
    // Swell peaks mid-ignite (k ~= 0.5).
    presenter.update(240)
    expect(back.scale).toBeGreaterThan(1.1)
    expect(back.alpha).toBe(1)
    // Tail fades out, then both layers despawn.
    presenter.update(239)
    expect(back.alpha).toBeLessThan(1)
    expect(back.visible).toBe(true)
    presenter.update(1)
    expect(sprites.every(s => s.destroyed)).toBe(true)
  })

  it('ignores receipts that carry a different playback token', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 1200)
    presenter.update(600)
    presenter.resolve({ ...receipt(), ref: { ...ref, token: 'stale' } })
    presenter.update(16)
    // No ignite started: the aura is still in plain loop mode.
    const back = sprites.find(s => s.key === 'tam-muoi-fire-aura-back')!
    expect(back.alpha).toBe(1)
    expect(back.scale).toBeCloseTo(0.95)
  })

  it('tears down when the pending playback token goes stale', () => {
    let current = true
    const { presenter, sprites } = fixture({ isCurrent: () => current })
    presenter.start(cast, 1200)
    presenter.update(16)
    current = false
    presenter.update(16)
    expect(sprites.every(s => s.destroyed)).toBe(true)
  })

  it('does not admit a cast that arrives with a non-action disposition', () => {
    const { presenter, sprites } = fixture()
    presenter.start({ ...cast, disposition: 'empty' }, 1200)
    presenter.update(600)
    expect(sprites).toHaveLength(0)
  })

  it('despawns on its own when the resolve never lands', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 1200)
    presenter.update(1900)
    expect(sprites.some(s => s.visible)).toBe(true)
    presenter.update(101) // releaseMs + 800 overdue bound crossed
    expect(sprites.every(s => s.destroyed)).toBe(true)
  })

  it('keeps reduced-motion ignites to a short fade with no swell', () => {
    const { presenter, sprites } = fixture({ reducedMotion: true })
    presenter.start(cast, 1200)
    presenter.update(1200)
    presenter.resolve(receipt())
    const back = sprites.find(s => s.key === 'tam-muoi-fire-aura-back')!
    presenter.update(100)
    expect(back.scale).toBeCloseTo(0.95) // no swell
    expect(back.alpha).toBeLessThan(1)
    presenter.update(100)
    expect(sprites.every(s => s.destroyed)).toBe(true)
  })
})
