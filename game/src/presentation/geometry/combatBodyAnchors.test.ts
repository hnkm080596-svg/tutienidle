import { describe, expect, it } from 'vitest'
import { bodyAnchor, type BodyBox } from './combatBodyAnchors'

function body(overrides: Partial<BodyBox> = {}): BodyBox {
  return {
    footX: 100,
    footY: 200,
    personWidth: 40,
    personHeight: 120,
    facing: 'right',
    ...overrides,
  }
}

describe('bodyAnchor', () => {
  it('bottom is the foot point itself', () => {
    expect(bodyAnchor('bottom', body())).toEqual({ x: 100, y: 200 })
  })

  it('top is a person height above the feet', () => {
    expect(bodyAnchor('top', body())).toEqual({ x: 100, y: 80 })
  })

  it('centre is exactly halfway between them', () => {
    const top = bodyAnchor('top', body())
    const bottom = bodyAnchor('bottom', body())
    const centre = bodyAnchor('centre', body())

    expect(centre.y).toBeCloseTo((top.y + bottom.y) / 2, 5)
    expect(centre.x).toBe(100)
  })

  it('front leads the facing direction and back trails it', () => {
    const right = body({ facing: 'right' })

    expect(bodyAnchor('front', right).x).toBe(120)
    expect(bodyAnchor('back', right).x).toBe(80)
  })

  it('front and back SWAP when facing does, so an enemy faces the player', () => {
    // The one piece of state in an otherwise pure derivation. Getting it
    // backwards puts every enemy's effects behind it, which looks deliberate
    // until somebody stares at it (Spec C §4.2).
    const left = body({ facing: 'left' })

    expect(bodyAnchor('front', left).x).toBe(80)
    expect(bodyAnchor('back', left).x).toBe(120)
  })

  it('facing does not move top, bottom or centre', () => {
    for (const id of ['top', 'bottom', 'centre'] as const) {
      expect(bodyAnchor(id, body({ facing: 'right' }))).toEqual(
        bodyAnchor(id, body({ facing: 'left' })),
      )
    }
  })

  it('front and back sit at centre height', () => {
    const centre = bodyAnchor('centre', body())

    expect(bodyAnchor('front', body()).y).toBe(centre.y)
    expect(bodyAnchor('back', body()).y).toBe(centre.y)
  })

  it('two differently-sized entities at different cells each get their own anchors, not shared state', () => {
    // Spec C §5: "one mechanism" for every entity means the formula is the
    // same, not that two DIFFERENT bodies produce the same numbers — a wolf
    // half the player's height at a different foot position must not leak
    // the player's geometry (or vice versa) through any shared/global state.
    const wolf = body({ footX: 100, footY: 200, personWidth: 40, personHeight: 80, facing: 'left' })
    const player = body({ footX: 300, footY: 400, personWidth: 60, personHeight: 140, facing: 'right' })

    expect(bodyAnchor('top', wolf)).toEqual({ x: 100, y: 120 })
    expect(bodyAnchor('top', player)).toEqual({ x: 300, y: 260 })
    expect(bodyAnchor('front', wolf)).toEqual({ x: 80, y: bodyAnchor('centre', wolf).y })
    expect(bodyAnchor('front', player)).toEqual({ x: 330, y: bodyAnchor('centre', player).y })
  })
})
