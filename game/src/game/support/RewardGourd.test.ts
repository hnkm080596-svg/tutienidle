import { describe, expect, it } from 'vitest'
import {
  computeGourdPlacement,
  easeRewardProgress,
  resolveGourdMouth,
  resolveRewardControlPoint,
  rewardMoteScale,
  rewardSwirlOffset,
} from './RewardGourd'

// Reward gourd pure helpers (plan §6.2/§7.3 + §9): safe-area placement,
// mouth anchor và quỹ đạo hút.
describe('computeGourdPlacement — safe area (plan §6.2)', () => {
  it('góc trái dưới, NGAY phía trên bottom inset', () => {
    const placement = computeGourdPlacement({ canvasHeight: 900, bottomInset: 120 })

    expect(placement.baseX).toBeGreaterThan(0)
    expect(placement.baseY).toBeLessThan(900 - 120)
    expect(placement.baseY).toBeCloseTo(900 - 120 - 18, 5)
  })

  it('resize: inset đổi → vị trí đổi theo, luôn giữ margin', () => {
    const small = computeGourdPlacement({ canvasHeight: 600, bottomInset: 90 })
    const large = computeGourdPlacement({ canvasHeight: 1000, bottomInset: 140 })

    expect(small.baseY).not.toBe(large.baseY)
    expect(computeGourdPlacement({ canvasHeight: 600, bottomInset: 90 })).toEqual(small)
  })
})

describe('resolveGourdMouth', () => {
  it('miệng hồ lô nằm TRÊN đáy placeholder theo anchor y=0.14', () => {
    const placement = computeGourdPlacement({ canvasHeight: 800, bottomInset: 100 })
    const mouth = resolveGourdMouth(placement)

    expect(mouth.x).toBeCloseTo(placement.baseX, 5)
    expect(mouth.y).toBeCloseTo(placement.baseY - placement.height * 0.86, 5)

    // Miệng phải nằm TRÊN thân (y nhỏ hơn đáy).
    expect(mouth.y).toBeLessThan(placement.baseY)
  })
})

describe('reward stream motion (plan §7.3)', () => {
  const start = { x: 700, y: 300 }

  it('control point tính từ start; end được inject LIVE qua closure', () => {
    const controlFor = resolveRewardControlPoint(start, 'insight')

    // Cùng start, end khác → control khác: resize/teleport re-resolve
    // đích mà không phụ thuộc state cũ.
    const c1 = controlFor({ x: 100, y: 700 })
    const c2 = controlFor({ x: 140, y: 640 })

    expect(c1.x).toBeCloseTo((start.x + 100) / 2, 5)
    expect(c1.y).toBeLessThan(Math.min(start.y, 700)) // vồng LÊN trên
    expect(c2.x).toBeCloseTo((start.x + 140) / 2, 5)
  })

  it('ease quad-in: tăng tốc nửa sau', () => {
    expect(easeRewardProgress(0)).toBe(0)
    expect(easeRewardProgress(0.5)).toBeCloseTo(0.25, 5)
    expect(easeRewardProgress(1)).toBe(1)
    // Nửa sau đi được quãng dài hơn nửa đầu.
    expect(easeRewardProgress(0.9) - easeRewardProgress(0.5)).toBeGreaterThan(
      easeRewardProgress(0.5) - easeRewardProgress(0.1),
    )
  })

  it('swirl về 0 ở hai đầu quỹ đạo — mote chui vào miệng không tạt ngang', () => {
    for (const seed of [0, 0.37, 0.73]) {
      expect(rewardSwirlOffset(0, seed)).toEqual({ x: 0, y: 0 })
      expect(rewardSwirlOffset(1, seed)).toEqual({ x: 0, y: 0 })
    }

    // Giữa đường có lệch hữu hạn.
    const mid = rewardSwirlOffset(0.5, 0.4)

    expect(Math.hypot(mid.x, mid.y)).toBeLessThan(12)
  })

  it('mote scale co lại khi tới miệng (1 → 0.35)', () => {
    expect(rewardMoteScale(0)).toBeCloseTo(1, 5)
    expect(rewardMoteScale(1)).toBeCloseTo(0.35, 5)
  })
})
