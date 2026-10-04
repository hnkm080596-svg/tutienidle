import { describe, expect, it } from 'vitest'
import type { ActorAnchorFact, SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { HoaCauFireballPresentation, hoaCauHandAnchor } from './HoaCauFireballPresentation'

const source = { entityId: 'player', row: 1, column: 1 }
const target = { entityId: 'enemy', row: 1, column: 8 }
const ref = { sessionId: 1, requestId: 'fire', token: 'fire-token' }
const cast: SkillCastPresentation = {
  ref, rootSkillId: 'hoa_cau_thuat', resolvedSkillId: 'hoa_cau_thuat', presetId: 'hoa_cau_comet',
  source, declaredTargets: [target], candidateInstanceCount: 1, disposition: 'action', slotRole: 'basic',
}
function fixture(options: { isCurrent?: () => boolean; reducedMotion?: boolean; targetY?: number; artVariant?: string } = {}) {
  const sprites: Array<{ key: string; frame: string; x: number; y: number; scale: number; scaleY: number; angle: number; alpha: number; visible: boolean; destroyed: boolean }> = []
  const surface = {
    anchor: (fact: ActorAnchorFact) => fact.entityId === 'player' ? { x: 100, y: 100 } : { x: 400, y: options.targetY ?? 100 },
    depth: () => 10,
    isCurrent: options.isCurrent,
    reducedMotion: options.reducedMotion,
    artVariant: options.artVariant,
    createSprite: (key: string, frame: string) => {
      const state = { key, frame, x: 0, y: 0, scale: 1, scaleY: 1, angle: 0, alpha: 1, visible: true, destroyed: false }
      sprites.push(state)
      return {
        setFrame: (value: string) => { state.frame = value },
        setPosition: (x: number, y: number) => { state.x = x; state.y = y },
        setVisible: (value: boolean) => { state.visible = value },
        setScale: (x: number, y = x) => { state.scale = x; state.scaleY = y }, setAngle: (value: number) => { state.angle = value }, setDepth: () => {},
        setAlpha: (value: number) => { state.alpha = value },
        destroy: () => { state.destroyed = true },
      }
    },
  }
  const presenter = new HoaCauFireballPresentation(surface)
  return { presenter, sprites }
}
function receipt(landed: boolean): SkillPresentationResolved {
  return { ref, sealed: true, groups: [{ groupId: 'primary', role: 'primary', resolvedSkillId: 'hoa_cau_thuat',
    presetId: 'hoa_cau_comet', source, actualTargets: [target], footprint: { kind: 'entity-targets', entityIds: ['enemy'] },
    outcomes: [{ kind: 'hit', outcomeId: 'hit', target, hitOrdinal: 0, landed, crit: false, hpDamage: landed ? 10 : 0, killed: false }],
  }] }
}

describe('Hỏa Cầu Phaser handoff', () => {
  it('keeps portal, charge and Fire 9 in sequence before landed Fire 20', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 3687.5)
    expect(sprites).toHaveLength(0)
    presenter.update(625)
    expect(sprites[0]?.key).toBe('hoa-cau-portal-open')
    expect(sprites[0]).toMatchObject({ x: 124, y: 100 })
    presenter.update(800)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-charge' && sprite.visible)).toBe(true)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')).toMatchObject({ x: 172, y: 100 })
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')!.scale).toBeGreaterThanOrEqual(1)
    presenter.update(1700)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-9' && sprite.visible)).toBe(true)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-fire-9')?.scale).toBeGreaterThanOrEqual(0.65)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-charge' && sprite.visible)).toBe(false)
    const fire = sprites.find(sprite => sprite.key === 'hoa-cau-fire-9')!
    expect(fire).toMatchObject({ x: 172, y: 100, angle: -90 })
    presenter.update(281.25)
    expect(fire).toMatchObject({ x: 286, y: 100, angle: -90 })
    presenter.update(281.25)
    presenter.resolve(receipt(true))
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-20' && sprite.visible)).toBe(true)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-9' && sprite.visible)).toBe(false)
  })

  it('does not explode on a miss and tears down every sprite on cancel', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 2062.5)
    presenter.update(2062.5)
    presenter.resolve(receipt(false))
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-20')).toBe(false)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-fire-9')?.visible).toBe(false)
    presenter.cancel()
    expect(sprites.every(sprite => sprite.destroyed)).toBe(true)
  })

  it('ignores stale receipts from a different playback token', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 2062.5)
    presenter.resolve({ ...receipt(true), ref: { ...ref, token: 'stale' } })
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-20')).toBe(false)
  })

  it('cancels sprites when the pending playback token goes stale', () => {
    let current = true
    const { presenter, sprites } = fixture({ isCurrent: () => current })
    presenter.start(cast, 2062.5)
    current = false
    presenter.update(16)
    expect(sprites.every(sprite => sprite.destroyed)).toBe(true)
  })

  it('renders Fire 20 for every landed primary target', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 2062.5)
    const second = { entityId: 'enemy-2', row: 2, column: 7 }
    const result = receipt(true)
    presenter.resolve({ ...result, groups: [{ ...result.groups[0]!, outcomes: [
      ...result.groups[0]!.outcomes,
      { kind: 'hit', outcomeId: 'hit-2', target: second, hitOrdinal: 1,
        landed: true, crit: false, hpDamage: 5, killed: false },
    ] }] })
    expect(sprites.filter(sprite => sprite.key === 'hoa-cau-fire-20' && sprite.visible)).toHaveLength(2)
  })

  it('keeps reduced-motion charge on readable core frames without release flash', () => {
    const { presenter, sprites } = fixture({ reducedMotion: true })
    presenter.start(cast, 3687.5)
    presenter.update(1425)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')?.frame).toBe('frame_9')
    presenter.update(1690)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')?.frame).toBe('frame_15')
  })

  it('resamples the full portal ACTIVE sheet across the charge phase', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 3687.5)
    presenter.update(3124)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-active')?.frame).toBe('frame_51')
  })

  it('bridges OPEN→ACTIVE→CLOSE with one held edge frame and a short crossfade', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 3687.5)
    presenter.update(1424)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-open')).toMatchObject({ frame: 'frame_24', visible: true })
    presenter.update(1)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-open')).toMatchObject({ frame: 'frame_24', alpha: 1, visible: true })
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-active')).toMatchObject({ frame: 'frame_0', alpha: 0, visible: true })
    presenter.update(90)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-open')?.alpha).toBeCloseTo(Math.SQRT1_2)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-active')?.alpha).toBeCloseTo(Math.SQRT1_2)
    presenter.update(1609)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-active')).toMatchObject({ frame: 'frame_51', visible: true })
    presenter.update(1)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-active')).toMatchObject({ frame: 'frame_51', alpha: 1, visible: true })
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-close')).toMatchObject({ frame: 'frame_0', alpha: 0, visible: true })
    presenter.update(180)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-active')?.visible).toBe(false)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-portal-close')).toMatchObject({ alpha: 1, visible: true })
  })

  it('pins the magic circle to the raised Pháp Tu palm', () => {
    const point = hoaCauHandAnchor({ x: 210, y: 325, displayWidth: 244 * 0.95,
      displayHeight: 252 * 0.95, originX: 0.5, originY: 1 })
    expect(point.x).toBeCloseTo(317.35)
    expect(point.y).toBeCloseTo(129.3)
  })

  it('travels horizontally in front of the hand and explodes at that same height', () => {
    const { presenter, sprites } = fixture({ targetY: 220 })
    presenter.start(cast, 3687.5)
    presenter.update(3687.5)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-fire-9')).toMatchObject({ x: 400, y: 100, angle: -90 })
    presenter.resolve(receipt(true))
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-fire-20')).toMatchObject({ x: 400, y: 100 })
  })

  it('previews the new fire circle continuously without replacing the original asset sequence', () => {
    const { presenter, sprites } = fixture({ artVariant: 'ember_gold' })
    presenter.start(cast, 3687.5)
    presenter.update(825)
    const ring = sprites.find(sprite => sprite.key === 'hoa-cau-ember-gold-circle')
    expect(ring).toMatchObject({ visible: true, x: 124, y: 100 })
    const openingScale = ring!.scale
    presenter.update(600)
    expect(ring).toMatchObject({ visible: true, alpha: 1 })
    expect(ring!.scale).toBeGreaterThan(openingScale)
    presenter.update(1700)
    expect(ring!.visible).toBe(true)
    expect(sprites.some(sprite => sprite.key.startsWith('hoa-cau-portal-'))).toBe(false)
  })

  it('previews a larger right-facing fireball but keeps the existing Fire 20 impact', () => {
    const { presenter, sprites } = fixture({ artVariant: 'ember_gold' })
    presenter.start(cast, 3687.5)
    presenter.update(3125)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-ember-gold-projectile')).toMatchObject({
      visible: true, x: 172, y: 100, angle: 0,
    })
    presenter.update(562.5)
    presenter.resolve(receipt(true))
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-20' && sprite.visible)).toBe(true)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-9')).toBe(false)
  })

  it('plays the Arcadia phoenix projectile and its attached tail throughout the test flight', () => {
    const { presenter, sprites } = fixture({ artVariant: 'phoenix_projectile' })
    presenter.start(cast, 3687.5)
    presenter.update(3125)
    const fire = sprites.find(sprite => sprite.key === 'hoa-cau-phoenix-projectile')
    expect(fire).toMatchObject({ visible: true, x: 172, y: 100, angle: 0 })
    expect(fire!.scale).toBeGreaterThanOrEqual(1)
    expect(fire!.frame).toBe('frame_0')
    presenter.update(281.25)
    expect(fire).toMatchObject({ visible: true, x: 286, y: 100 })
    expect(fire!.frame).not.toBe('frame_0')
    presenter.update(281.25)
    presenter.resolve(receipt(true))
    expect(fire!.visible).toBe(false)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-20' && sprite.visible)).toBe(true)
  })

  it('previews the authored Arcadia fire circle from raised hand through its dissolve', () => {
    const { presenter, sprites } = fixture({ artVariant: 'phoenix_projectile' })
    presenter.start(cast, 3687.5)
    presenter.update(625)
    const circle = sprites.find(sprite => sprite.key === 'hoa-cau-triple-fire-circle')
    expect(circle).toMatchObject({ visible: true, frame: 'frame_0', x: 124, y: 100 })
    expect(circle!.scaleY / circle!.scale).toBeGreaterThan(1.5)
    presenter.update(800)
    expect(circle?.visible).toBe(true)
    expect(circle?.frame).not.toBe('frame_0')
    expect(sprites.some(sprite => sprite.key.startsWith('hoa-cau-portal-'))).toBe(false)
    presenter.update(1699)
    expect(circle?.frame).toBe('frame_63')
    presenter.update(1)
    expect(circle?.visible).toBe(false)
  })

  it('makes the preview Fire 20 impact visibly larger than the old production size', () => {
    const { presenter, sprites } = fixture({ artVariant: 'phoenix_projectile' })
    presenter.start(cast, 3687.5)
    presenter.update(3687.5)
    presenter.resolve(receipt(true))
    const impact = sprites.find(sprite => sprite.key === 'hoa-cau-fire-20')
    expect(impact).toMatchObject({ visible: true, x: 400, y: 100 })
    expect(impact!.scale).toBeGreaterThanOrEqual(1.1)
  })
})
