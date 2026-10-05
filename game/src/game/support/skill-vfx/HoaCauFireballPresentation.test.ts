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
function fixture(options: { isCurrent?: () => boolean; reducedMotion?: boolean; targetY?: number } = {}) {
  const sprites: Array<{ key: string; frame: string; x: number; y: number; scale: number; scaleY: number; angle: number; alpha: number; visible: boolean; destroyed: boolean }> = []
  const surface = {
    anchor: (fact: ActorAnchorFact) => fact.entityId === 'player' ? { x: 100, y: 100 } : { x: 400, y: options.targetY ?? 100 },
    depth: () => 10,
    isCurrent: options.isCurrent,
    reducedMotion: options.reducedMotion,
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
  it('keeps fire-circle, charge and phoenix in sequence before landed Fire 20', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 3687.5)
    expect(sprites).toHaveLength(0)
    presenter.update(625)
    expect(sprites[0]?.key).toBe('hoa-cau-fire-circle-inner')
    expect(sprites[0]).toMatchObject({ x: 124, y: 100 })
    presenter.update(800)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-charge' && sprite.visible)).toBe(true)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')).toMatchObject({ x: 172, y: 100 })
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')!.scale).toBeGreaterThanOrEqual(1)
    presenter.update(1700)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-phoenix-projectile' && sprite.visible)).toBe(true)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-charge' && sprite.visible)).toBe(false)
    const fire = sprites.find(sprite => sprite.key === 'hoa-cau-phoenix-projectile')!
    expect(fire).toMatchObject({ x: 172, y: 100, angle: 0 })
    presenter.update(281.25)
    expect(fire).toMatchObject({ x: 286, y: 100, angle: 0 })
    presenter.update(281.25)
    presenter.resolve(receipt(true))
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-20' && sprite.visible)).toBe(true)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-phoenix-projectile' && sprite.visible)).toBe(false)
  })

  it('does not explode on a miss and tears down every sprite on cancel', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 2062.5)
    presenter.update(2062.5)
    presenter.resolve(receipt(false))
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-20')).toBe(false)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-phoenix-projectile')?.visible).toBe(false)
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
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')?.frame).toBe('frame_27')
    presenter.update(1690)
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-charge')?.frame).toBe('frame_44')
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
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-phoenix-projectile')).toMatchObject({ x: 400, y: 100, angle: 0 })
    presenter.resolve(receipt(true))
    expect(sprites.find(sprite => sprite.key === 'hoa-cau-fire-20')).toMatchObject({ x: 400, y: 100 })
  })

  it('plays the Arcadia phoenix projectile and its attached tail throughout the test flight', () => {
    const { presenter, sprites } = fixture()
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
    const { presenter, sprites } = fixture()
    presenter.start(cast, 3687.5)
    presenter.update(625)
    const circle = sprites.find(sprite => sprite.key === 'hoa-cau-fire-circle-inner')
    // Per-ring sheets index the full 0..63 timeline; frame_0 is authored t=0.
    expect(circle).toMatchObject({ visible: true, frame: 'frame_0', x: 124, y: 100 })
    expect(circle!.scaleY / circle!.scale).toBeGreaterThan(1.5)
    presenter.update(800)
    expect(circle?.visible).toBe(true)
    expect(circle?.frame).toBe('frame_20')
    expect(sprites.some(sprite => sprite.key.startsWith('hoa-cau-portal-'))).toBe(false)
    presenter.update(1699)
    expect(circle?.frame).toBe('frame_62')
    presenter.update(1)
    expect(circle?.visible).toBe(false)
  })

  it('makes the preview Fire 20 impact visibly larger than the old production size', () => {
    const { presenter, sprites } = fixture()
    presenter.start(cast, 3687.5)
    presenter.update(3687.5)
    presenter.resolve(receipt(true))
    const impact = sprites.find(sprite => sprite.key === 'hoa-cau-fire-20')
    expect(impact).toMatchObject({ visible: true, x: 400, y: 100 })
    expect(impact!.scale).toBeGreaterThanOrEqual(1.1)
  })

  it('adds the middle ring and flies the azure phoenix on an empowered cast', () => {
    const { presenter, sprites } = fixture()
    presenter.start({ ...cast, empowered: true }, 3687.5)
    presenter.update(625)
    // Two authored rings: the inner seal plus the middle ring - each from
    // its own atlas at its own radius (the authored "2 vong" tier).
    const ringKeys = sprites.filter(sprite => sprite.key.startsWith('hoa-cau-fire-circle-') && sprite.visible)
      .map(sprite => sprite.key)
    expect(ringKeys).toEqual(['hoa-cau-fire-circle-inner', 'hoa-cau-fire-circle-middle'])
    presenter.update(800)
    // The converging charge also burns azure on the empowered cast.
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-charge-azure' && sprite.visible)).toBe(true)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-charge' && sprite.visible)).toBe(false)
    presenter.update(1700)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-phoenix-empowered' && sprite.visible)).toBe(true)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-phoenix-projectile' && sprite.visible)).toBe(false)
    presenter.cancel()
    // A normal cast still shows the inner ring, the orange charge and the
    // red comet.
    const { presenter: plain, sprites: plainSprites } = fixture()
    plain.start(cast, 3687.5)
    plain.update(625)
    const plainRingKeys = plainSprites.filter(sprite => sprite.key.startsWith('hoa-cau-fire-circle-') && sprite.visible)
      .map(sprite => sprite.key)
    expect(plainRingKeys).toEqual(['hoa-cau-fire-circle-inner'])
    plain.update(800)
    expect(plainSprites.some(sprite => sprite.key === 'hoa-cau-charge' && sprite.visible)).toBe(true)
    expect(plainSprites.some(sprite => sprite.key === 'hoa-cau-charge-azure' && sprite.visible)).toBe(false)
    plain.update(1700)
    expect(plainSprites.some(sprite => sprite.key === 'hoa-cau-phoenix-projectile' && sprite.visible)).toBe(true)
    expect(plainSprites.some(sprite => sprite.key === 'hoa-cau-phoenix-empowered' && sprite.visible)).toBe(false)
  })

  it('adds all three authored rings only on an ultimate cast', () => {
    const { presenter, sprites } = fixture()
    presenter.start({ ...cast, empowered: true, slotRole: 'ultimate' }, 3687.5)
    presenter.update(625)
    const ringKeys = sprites.filter(sprite => sprite.key.startsWith('hoa-cau-fire-circle-') && sprite.visible)
      .map(sprite => sprite.key)
    expect(ringKeys).toEqual(['hoa-cau-fire-circle-inner', 'hoa-cau-fire-circle-middle', 'hoa-cau-fire-circle-outer'])
  })

  it('renders the authored Arcadia set for every cast, with or without a Tam Muoi window', () => {
    const { presenter, sprites } = fixture()
    presenter.start({ ...cast, casterBuffIds: ['tam_muoi'] }, 3687.5)
    presenter.update(625)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-fire-circle-inner' && sprite.visible)).toBe(true)
    presenter.update(3687.5 - 625)
    expect(sprites.some(sprite => sprite.key === 'hoa-cau-phoenix-projectile' && sprite.visible)).toBe(true)

    const { presenter: plain, sprites: plainSprites } = fixture()
    plain.start(cast, 3687.5)
    plain.update(625)
    expect(plainSprites.some(sprite => sprite.key === 'hoa-cau-fire-circle-inner' && sprite.visible)).toBe(true)
    plain.update(3687.5 - 625)
    expect(plainSprites.some(sprite => sprite.key === 'hoa-cau-phoenix-projectile' && sprite.visible)).toBe(true)
  })
})
