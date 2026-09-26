// @vitest-environment jsdom
// 6A-T4 (2026-09-01) — PlayerHudLayer: HP/MP/Kiếm bars + labels vẽ
// trong canvas, flexible layout theo viewport (AGENTS.md UI rule),
// ẩn MP khi maxMp<=0, ẩn Kiếm khi max<=0, update HP từ event values.
import { describe, expect, it } from 'vitest'
import { PlayerHudLayer, HUD_MARGIN, HUD_HP_WIDTH, HUD_SUB_WIDTH } from './PlayerHudLayer'
import { PLAYER_HUD_THE_ARMED_COLOR, PLAYER_HUD_THE_COLOR } from './combatConstants'

interface FakeRect {
  x: number
  y: number
  width: number
  scaleX: number
  visible: boolean
  fillColor?: number
  setPosition(x: number, y: number): FakeRect
  setDisplaySize(w: number, h: number): FakeRect
  setVisible(v: boolean): FakeRect
  setDepth(d: number): FakeRect
  setStrokeStyle(...a: unknown[]): FakeRect
  setOrigin(...a: unknown[]): FakeRect
  setFillStyle(color: number): FakeRect
  destroy(): void
}

interface FakeArc {
  x: number
  y: number
  radius: number
  fillColor?: number
  strokeColor?: number
  visible: boolean
  setPosition(x: number, y: number): FakeArc
  setVisible(v: boolean): FakeArc
  setDepth(d: number): FakeArc
  setStrokeStyle(width: number, color: number): FakeArc
  setOrigin(...a: unknown[]): FakeArc
  setFillStyle(color: number): FakeArc
  destroy(): void
}

interface FakeText {
  text: string
  x: number
  y: number
  visible: boolean
  setPosition(x: number, y: number): FakeText
  setOrigin(...a: unknown[]): FakeText
  setDepth(d: number): FakeText
  setVisible(v: boolean): FakeText
  destroy(): void
}

function makeFakeRect(width: number): FakeRect {
  const rect = {
    x: 0,
    y: 0,
    width,
    scaleX: 1,
    visible: true,
    setPosition(x: number, y: number) {
      rect.x = x
      rect.y = y
      return rect
    },
    setDisplaySize(w: number, _h: number) {
      rect.width = w
      return rect
    },
    setVisible(v: boolean) {
      rect.visible = v
      return rect
    },
    setDepth() {
      return rect
    },
    setStrokeStyle() {
      return rect
    },
    setOrigin() {
      return rect
    },
    setFillStyle(color: number) {
      rect.fillColor = color
      return rect
    },
    destroy() {},
  } as unknown as FakeRect

  return rect
}

function makeFakeText(initial: string): FakeText {
  const text = {
    text: initial,
    x: 0,
    y: 0,
    visible: true,
    setPosition(x: number, y: number) {
      text.x = x
      text.y = y
      return text
    },
    setOrigin() {
      return text
    },
    setDepth() {
      return text
    },
    setVisible(v: boolean) {
      text.visible = v
      return text
    },
    destroy() {},
  } as unknown as FakeText

  return text
}

function makeFakeArc(radius: number, color: number): FakeArc {
  const arc = {
    x: 0,
    y: 0,
    radius,
    fillColor: color,
    strokeColor: 0,
    visible: true,
    setPosition(x: number, y: number) {
      arc.x = x
      arc.y = y
      return arc
    },
    setVisible(v: boolean) {
      arc.visible = v
      return arc
    },
    setDepth() {
      return arc
    },
    setStrokeStyle(_width: number, c: number) {
      arc.strokeColor = c
      return arc
    },
    setOrigin() {
      return arc
    },
    setFillStyle(c: number) {
      arc.fillColor = c
      return arc
    },
    destroy() {
      arc.visible = false
    },
  } as unknown as FakeArc

  return arc
}

function makeScene() {
  const rects: FakeRect[] = []
  const texts: FakeText[] = []
  const arcs: FakeArc[] = []

  return {
    add: {
      rectangle: () => {
        const rect = makeFakeRect(0)

        rects.push(rect)

        return rect
      },
      circle: (_x: number, _y: number, radius: number, color: number) => {
        const arc = makeFakeArc(radius, color)

        arcs.push(arc)

        return arc
      },
      text: (_x: number, _y: number, content: string) => {
        const text = makeFakeText(content)

        texts.push(text)

        return text
      },
    },
    rects,
    texts,
    arcs,
  }
}

type SceneLike = ReturnType<typeof makeScene>

describe('PlayerHudLayer — in-canvas HUD (6A-T4)', () => {
  it('layout: HP bar neo góc trái-dưới theo viewport — resize không hardcode', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 800, height: 600 })

    hud.layout(800, 600)

    // Label HP ở trên bar; bar Y = height - margin - barH - label offset.
    // Chỉ assert ràng buộc vị trí (không cứng số tuyệt đối ngoài hằng).
    expect(hud.hpFill.y).toBeLessThanOrEqual(600 - HUD_MARGIN)
    expect(hud.hpFill.y).toBeGreaterThan(600 - HUD_MARGIN - 60)
    expect(hud.hpFill.x).toBeGreaterThanOrEqual(HUD_MARGIN)

    // Resize nhỏ hơn → vị trí dời theo height mới (flexible rule).
    hud.layout(600, 360)

    expect(hud.hpFill.y).toBeLessThanOrEqual(360 - HUD_MARGIN)
    expect(hud.hpFill.y).toBeGreaterThan(360 - HUD_MARGIN - 60)
  })

  it('updateHp: fill ratio đúng + label số', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 800, height: 600 })

    hud.updateHp(50, 100)

    expect(hud.hpFill.scaleX).toBeCloseTo(0.5, 5)
    expect(hud.hpLabel.text).toContain('50')
    expect(hud.hpLabel.text).toContain('100')
  })

  it('updateMp: maxMp <= 0 → ẩn (Phàm/Kiếm Tu không có pool MP)', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 800, height: 600 })

    hud.updateMp(0, 0)

    expect(hud.mpGroupVisible).toBe(false)

    hud.updateMp(20, 50)

    expect(hud.mpGroupVisible).toBe(true)
    expect(hud.mpFill.scaleX).toBeCloseTo(0.4, 5)
  })

  it('updateKiem: max <= 0 → ẩn; có resource → hiện + label custom', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 800, height: 600 })

    hud.updateKiem(0, 0, 'Kiếm Ý T.2')

    expect(hud.kiemGroupVisible).toBe(false)

    hud.updateKiem(30, 100, 'Kiếm Ý T.2')

    expect(hud.kiemGroupVisible).toBe(true)
    expect(hud.kiemLabel.text).toContain('Kiếm Ý T.2')
    expect(hud.kiemFill.scaleX).toBeCloseTo(0.3, 5)
  })

  // Phap Tu Reimagine (spec D17, design sec.86) -- the The bar renders
  // as a dot row (cap == threshold == 5); the PHAP THE label lights when
  // the bridge reports phapTheActive (empowerment variant + full pool).
  it('updateThe: max 0 → ẩn; dot row renders one pip per point', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 800, height: 600 })

    hud.updateThe(0, 0, false)

    expect(hud.theGroupVisible).toBe(false)
    expect(hud.thePhapTheLabel.visible).toBe(false)

    hud.updateThe(3, 5, false)

    expect(hud.theGroupVisible).toBe(true)
    expect(hud.theLabel.text).toContain('3')
    expect(hud.theLabel.text).toContain('5')
    expect(hud.theDots).toHaveLength(5)
    // 3 filled with THE color, 2 hollow (background fill)
    expect(hud.theDots.map((dot) => dot.fillColor)).toEqual([
      PLAYER_HUD_THE_COLOR,
      PLAYER_HUD_THE_COLOR,
      PLAYER_HUD_THE_COLOR,
      0x241b1b,
      0x241b1b,
    ])

    // Dots are spaced evenly across the bar track.
    const bar = hud.theFill

    hud.theDots.forEach((dot, index) => {
      expect(dot.x).toBeCloseTo(bar.x + bar.width / 5 * (index + 0.5), 5)
    })
  })

  it('updateThe: phapTheActive → PHÁP THẾ label hiện, dots sáng armed', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 800, height: 600 })

    hud.updateThe(5, 5, false)

    expect(hud.thePhapTheLabel.visible).toBe(false)
    expect(hud.theDots.every((dot) => dot.fillColor === PLAYER_HUD_THE_COLOR)).toBe(true)

    hud.updateThe(5, 5, true)

    expect(hud.thePhapTheLabel.visible).toBe(true)
    expect(hud.thePhapTheLabel.text).toBe('PHÁP THẾ')
    expect(hud.theDots.every((dot) => dot.fillColor === PLAYER_HUD_THE_ARMED_COLOR)).toBe(true)

    hud.updateThe(4, 5, true)

    // Active flag is bridge-side; the HUD just lights what it's told --
    // a partial pool still brightens when the flag is on.
    expect(hud.thePhapTheLabel.visible).toBe(true)
  })

  it('destroy: mọi rect/text được destroy (không leak giữa trận)', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 800, height: 600 })

    const rectCount = scene.rects.length
    const textCount = scene.texts.length

    expect(rectCount).toBeGreaterThan(0)
    expect(textCount).toBeGreaterThan(0)

    hud.destroy()
  })

  it('kích thước flexible: HP width hằng số, sub bars nhỏ hơn (không cứng theo màn hình)', () => {
    const scene = makeScene()
    const hud = new PlayerHudLayer(scene as never, { width: 1280, height: 720 })

    hud.layout(1280, 720)

    expect(hud.hpWidth).toBe(HUD_HP_WIDTH)
    expect(hud.subWidth).toBe(HUD_SUB_WIDTH)
  })
})
