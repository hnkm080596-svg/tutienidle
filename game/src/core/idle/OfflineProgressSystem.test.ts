import { describe, expect, it } from 'vitest'
import { calculateOfflineProgress } from './OfflineProgressSystem'
import { calculateOfflineTime, DEFAULT_MAX_OFFLINE_SECONDS } from './GameClock'

describe('calculateOfflineTime — cap 24 giờ (mục XIV spec)', () => {
  it('trả đúng số giây trôi qua khi dưới cap', () => {
    const lastOnlineAt = 1_000_000
    const oneHourLater = lastOnlineAt + 60 * 60 * 1000

    const result = calculateOfflineTime({ lastOnlineAt }, oneHourLater)

    expect(result.offlineSeconds).toBe(3600)
  })

  it('clamp ở 24 giờ dù offline lâu hơn', () => {
    const lastOnlineAt = 1_000_000
    const threeDaysLater = lastOnlineAt + 3 * 24 * 60 * 60 * 1000

    const result = calculateOfflineTime({ lastOnlineAt }, threeDaysLater)

    expect(result.offlineSeconds).toBe(DEFAULT_MAX_OFFLINE_SECONDS)
  })

  it('không âm khi timestamp hiện tại nhỏ hơn lastOnlineAt (đồng hồ máy lùi)', () => {
    const lastOnlineAt = 1_000_000

    const result = calculateOfflineTime({ lastOnlineAt }, lastOnlineAt - 5000)

    expect(result.offlineSeconds).toBe(0)
  })
})

describe('calculateOfflineProgress', () => {
  it('quy đổi thời gian offline thành tu vi theo cultivationPerSecond', () => {
    const result = calculateOfflineProgress(3600, 2.5)

    expect(result.elapsedSeconds).toBe(3600)
    expect(result.cultivation).toBe(9000)
  })

  it('không âm dù offlineSeconds âm', () => {
    const result = calculateOfflineProgress(-100, 5)

    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('NaN cultivationPerSecond → cultivation 0, không poison kết quả', () => {
    const result = calculateOfflineProgress(3600, Number.NaN)

    expect(result.cultivation).toBe(0)
  })

  it('+Infinity / -Infinity cultivationPerSecond → cultivation 0', () => {
    expect(calculateOfflineProgress(3600, Number.POSITIVE_INFINITY).cultivation).toBe(0)
    expect(calculateOfflineProgress(3600, Number.NEGATIVE_INFINITY).cultivation).toBe(0)
  })
})
