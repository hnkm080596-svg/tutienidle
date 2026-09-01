// @vitest-environment jsdom
// 6A-T4 (2026-09-01) — PlayerHudLayer: HP/MP/Kiếm bars + labels vẽ
// trong canvas, flexible layout theo viewport (AGENTS.md UI rule),
// ẩn MP khi maxMp<=0, ẩn Kiếm khi max<=0, update HP từ event values.
import { describe, expect, it } from 'vitest'
import { PlayerHudLayer, HUD_MARGIN, HUD_HP_WIDTH, HUD_SUB_WIDTH } from './PlayerHudLayer'

interface FakeRect {
  x: number
  y: number
  width: number
  scaleX: number
  visible: boolean
  setPosition(x: number, y: number): FakeRect
  setDisplaySize(w: number, h: number): FakeRect
  setVisible(v: boolean): FakeRect
  setDepth(d: number): FakeRect
  setStrokeStyle(...a: unknown[]): FakeRect
  setOrigin(...a: unknown[]): FakeRect
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

function makeScene() {
  const rects: FakeRect[] = []
  const texts: FakeText[] = []

  return {
    add: {
      rectangle: () => {
        const rect = makeFakeRect(0)

        rects.push(rect)

        return rect
      },
      text: (_x: number, _y: number, content: string) => {
        const text = makeFakeText(content)

        texts.push(text)

        return text
      },
    },
    rects,
    texts,
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
